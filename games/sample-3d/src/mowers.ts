import * as THREE from 'three';
import {
  ARENA_HALF, MOWER_TIERS, OBSTACLES, TUNING, WAVES,
  type EnemyView, type MowerKill, type MowerModel, type MowerSystem, type MowerTier, type Obstacle, type RegularTier, type WavePhase,
} from './config';
import { createMowerModel } from './mowerModels';

interface Mower {
  id: number;
  tier: MowerTier;
  pos: THREE.Vector3;
  radius: number;
  hp: number;
  maxHp: number;
  heading: number;
  model: MowerModel;
  slowFactor: number;
  slowS: number;
  flashS: number;
  dyingS: number; // < 0 means alive
}

/** The last target seen by update(); spawnBoss() has no target parameter. */
const lastTarget = new THREE.Vector3();

/**
 * A point at distance [minR, maxR] from target, on a random bearing, clamped to the lawn.
 * Tries up to 12 times to find one clear of every obstacle; returns the last candidate if none is clear.
 */
function ringPoint(target: THREE.Vector3, minR: number, maxR: number, clearance: number): { x: number; z: number } {
  const lim = ARENA_HALF - clearance - 1;
  let x = target.x;
  let z = target.z;
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    x = Math.max(-lim, Math.min(lim, target.x + Math.cos(angle) * r));
    z = Math.max(-lim, Math.min(lim, target.z + Math.sin(angle) * r));
    if (OBSTACLES.every((o) => Math.hypot(o.x - x, o.z - z) > o.radius + clearance + 0.5)) break;
  }
  return { x, z };
}

export function createMowerSystem(scene: THREE.Scene): MowerSystem {
  let mowers: Mower[] = [];
  let pendingKills: MowerKill[] = [];
  let nextId = 1;
  let spawnTimer = 1;

  const alive = (): Mower[] => mowers.filter((m) => m.dyingS < 0);

  function pickTier(mix: WavePhase['mix']): RegularTier {
    const entries = (Object.entries(mix) as [RegularTier, number][]).filter(([, w]) => w > 0);
    let total = 0;
    for (const [, w] of entries) total += w;
    if (total <= 0) return 'reel';
    let r = Math.random() * total;
    for (const [tier, w] of entries) {
      r -= w;
      if (r < 0) return tier;
    }
    return entries[entries.length - 1][0];
  }

  function spawn(tier: MowerTier, target: THREE.Vector3, x?: number, z?: number, heading?: number): void {
    const def = MOWER_TIERS[tier];
    let sx: number;
    let sz: number;
    if (x !== undefined && z !== undefined) {
      sx = x;
      sz = z;
    } else {
      const p = ringPoint(target, TUNING.spawnRingMin, TUNING.spawnRingMax, def.radius);
      sx = p.x;
      sz = p.z;
    }
    const model = createMowerModel(tier);
    scene.add(model.group);
    model.group.position.set(sx, 0, sz);
    mowers.push({
      id: nextId++,
      tier,
      pos: new THREE.Vector3(sx, 0, sz),
      radius: def.radius,
      hp: def.hp,
      maxHp: def.hp,
      heading: heading ?? Math.atan2(target.x - sx, target.z - sz),
      model,
      slowFactor: 1,
      slowS: 0,
      flashS: 0,
      dyingS: -1,
    });
  }

  function update(
    dt: number,
    elapsedS: number,
    target: THREE.Vector3,
    obstacles: readonly Obstacle[],
    onMow: (x: number, z: number) => void,
  ): MowerKill[] {
    lastTarget.copy(target);

    // 1. Spawning by wave.
    let wave: WavePhase = WAVES[0];
    for (const w of WAVES) if (w.fromS <= elapsedS) wave = w;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = wave.spawnEveryS;
      if (alive().length < wave.maxAlive) spawn(pickTier(wave.mix), target);
    }

    const live = alive();

    // Leash: a non-combine mower that fell far behind is moved back into the spawn ring.
    for (const m of live) {
      if (m.tier === 'combine') continue;
      if (Math.hypot(m.pos.x - target.x, m.pos.z - target.z) <= TUNING.mowerLeashDist) continue;
      const p = ringPoint(target, TUNING.spawnRingMin, TUNING.spawnRingMax, m.radius);
      m.pos.x = p.x;
      m.pos.z = p.z;
      m.heading = Math.atan2(target.x - p.x, target.z - p.z);
    }

    // 2. Steering and movement.
    for (const m of live) {
      const def = MOWER_TIERS[m.tier];
      m.slowS -= dt;
      const mul = m.slowS > 0 ? m.slowFactor : 1;
      const speed = def.speed * mul;
      const desired = Math.atan2(target.x - m.pos.x, target.z - m.pos.z);
      const diff = Math.atan2(Math.sin(desired - m.heading), Math.cos(desired - m.heading));
      const maxTurn = def.turnRate * dt;
      m.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
      m.pos.x += Math.sin(m.heading) * speed * dt;
      m.pos.z += Math.cos(m.heading) * speed * dt;
    }

    // 3. Obstacles (the combine plows through them).
    for (const m of live) {
      if (m.tier === 'combine') continue;
      for (const o of obstacles) {
        const dx = m.pos.x - o.x;
        const dz = m.pos.z - o.z;
        const d = Math.hypot(dx, dz);
        const min = o.radius + m.radius;
        if (d >= min) continue;
        const nx = d < 1e-4 ? 1 : dx / d;
        const nz = d < 1e-4 ? 0 : dz / d;
        m.pos.x = o.x + nx * min;
        m.pos.z = o.z + nz * min;
      }
    }

    // 4. Separation between living mowers.
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const sum = a.radius + b.radius;
        if (d >= sum) continue;
        const overlap = sum - d;
        const nx = d < 1e-4 ? 1 : dx / d;
        const nz = d < 1e-4 ? 0 : dz / d;
        if (a.tier === 'combine' || b.tier === 'combine') {
          // The combine holds its ground; the other mower gives way in full.
          const other = a.tier === 'combine' ? b : a;
          const sign = a.tier === 'combine' ? 1 : -1;
          other.pos.x += sign * nx * overlap;
          other.pos.z += sign * nz * overlap;
        } else {
          a.pos.x -= nx * overlap / 2;
          a.pos.z -= nz * overlap / 2;
          b.pos.x += nx * overlap / 2;
          b.pos.z += nz * overlap / 2;
        }
      }
    }

    // 5. Keep inside the lawn.
    for (const m of live) {
      const lim = ARENA_HALF - m.radius;
      m.pos.x = Math.max(-lim, Math.min(lim, m.pos.x));
      m.pos.z = Math.max(-lim, Math.min(lim, m.pos.z));
    }

    // 6. Visuals and 7. Mowing.
    for (const m of live) {
      const def = MOWER_TIERS[m.tier];
      const speed = def.speed * (m.slowS > 0 ? m.slowFactor : 1);
      m.flashS -= dt;
      m.model.setFlash(m.flashS > 0);
      m.model.group.position.set(m.pos.x, 0, m.pos.z);
      m.model.group.rotation.y = m.heading;
      m.model.animate(dt, speed);

      onMow(m.pos.x, m.pos.z);
      if (m.tier === 'combine') {
        const fx = Math.sin(m.heading);
        const fz = Math.cos(m.heading);
        const rx = -fz; // right = (-cos h, 0, sin h)
        const rz = fx;
        onMow(m.pos.x + fx * 2 + rx * 1.6, m.pos.z + fz * 2 + rz * 1.6);
        onMow(m.pos.x + fx * 2 - rx * 1.6, m.pos.z + fz * 2 - rz * 1.6);
      }
    }

    // 8. Dying mowers shrink, spin and are removed.
    const kept: Mower[] = [];
    for (const m of mowers) {
      if (m.dyingS < 0) {
        kept.push(m);
        continue;
      }
      m.dyingS -= dt;
      m.model.group.scale.setScalar(Math.max(0.01, m.dyingS / 0.25));
      m.model.group.rotation.y += 15 * dt;
      if (m.dyingS <= 0) {
        scene.remove(m.model.group);
      } else {
        kept.push(m);
      }
    }
    mowers = kept;

    // 9. Report kills since the last call.
    return pendingKills.splice(0);
  }

  return {
    update,
    enemies(): readonly EnemyView[] {
      return alive();
    },
    damage(id: number, amount: number): void {
      const m = alive().find((x) => x.id === id);
      if (!m) return;
      m.hp -= amount;
      m.flashS = 0.08;
      if (m.hp <= 0) {
        m.hp = 0;
        m.dyingS = 0.25;
        pendingKills.push({ id: m.id, tier: m.tier, x: m.pos.x, z: m.pos.z });
      }
    },
    slow(id: number, factor: number, seconds: number): void {
      const m = alive().find((x) => x.id === id);
      if (!m) return;
      m.slowFactor = factor;
      m.slowS = Math.max(m.slowS, seconds);
    },
    spawnBoss(): void {
      const p = ringPoint(lastTarget, TUNING.bossSpawnDist, TUNING.bossSpawnDist + 3, MOWER_TIERS.combine.radius);
      spawn('combine', lastTarget, p.x, p.z);
    },
    bossHp(): { hp: number; max: number } | null {
      const boss = alive().find((m) => m.tier === 'combine');
      return boss ? { hp: boss.hp, max: boss.maxHp } : null;
    },
    reset(): void {
      for (const m of mowers) scene.remove(m.model.group);
      mowers = [];
      pendingKills = [];
      spawnTimer = 1;
    },
  };
}
