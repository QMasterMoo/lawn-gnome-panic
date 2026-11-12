import * as THREE from 'three';
import {
  ARENA_HALF, MOWER_TIERS, OBSTACLES, TUNING, WAVES,
  type EnemyView, type MowerKill, type MowerModel, type MowerSystem, type MowerTier, type Obstacle, type RegularTier, type WavePhase,
  type MowerDifficulty,
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
  vy: number; // vertical speed while falling off an obstacle
  pitch: number; // visual nose pitch (radians, negative = nose up)
  climbing: boolean; // true while crawling up a climbable obstacle's side
  model: MowerModel;
  slowFactor: number;
  slowS: number;
  flashS: number;
  dyingS: number; // < 0 means alive
}

/** Speed multiplier while a mower is crawling up an obstacle's side. */
const CLIMB_SPEED_FACTOR = 0.4;

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

/** The target closest to (x, z) by dist2D, or null when there are none. Ties go to the earlier target. */
function nearestTarget(x: number, z: number, targets: readonly THREE.Vector3[]): THREE.Vector3 | null {
  let best: THREE.Vector3 | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function createMowerSystem(scene: THREE.Scene): MowerSystem {
  let mowers: Mower[] = [];
  let pendingKills: MowerKill[] = [];
  let nextId = 1;
  let spawnTimer = 1;
  let holdS = 0;
  let bossHpMult = 1;
  let diff: MowerDifficulty = { speedMult: 1, hpMult: 1, spawnMult: 1, maxAliveMult: 1 };
  let night01 = 0;

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
    model.setNight(night01);
    model.group.rotation.order = 'YXZ';
    scene.add(model.group);
    model.group.position.set(sx, 0, sz);
    const hp = tier === 'combine' ? def.hp * bossHpMult : def.hp * diff.hpMult;
    mowers.push({
      id: nextId++,
      tier,
      pos: new THREE.Vector3(sx, 0, sz),
      radius: def.radius,
      hp,
      maxHp: hp,
      heading: heading ?? Math.atan2(target.x - sx, target.z - sz),
      vy: 0,
      pitch: 0,
      climbing: false,
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
    targets: readonly THREE.Vector3[],
    obstacles: readonly Obstacle[],
    onMow: (x: number, z: number) => void,
  ): MowerKill[] {
    // targets[0] is the player; the boss always goes after the player.
    if (targets.length > 0) lastTarget.copy(targets[0]);

    // 1. Spawning by wave. With other gnomes present the cap doubles, and each spawn
    // rings either the player or a random other gnome.
    let wave: WavePhase = WAVES[0];
    for (const w of WAVES) if (w.fromS <= elapsedS) wave = w;
    if (holdS > 0) holdS -= dt;
    else spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = wave.spawnEveryS * diff.spawnMult;
      const cap = Math.round((targets.length > 1 ? wave.maxAlive * 2 : wave.maxAlive) * diff.maxAliveMult);
      if (targets.length > 0 && alive().length < cap) {
        const around = targets.length === 1 || Math.random() < 0.5
          ? targets[0]
          : targets[1 + Math.floor(Math.random() * (targets.length - 1))];
        spawn(pickTier(wave.mix), around);
      }
    }

    const live = alive();

    // Leash: a non-combine mower whose nearest target is far behind is moved back into the spawn ring around the player.
    if (targets.length > 0) {
      const player = targets[0];
      for (const m of live) {
        if (m.tier === 'combine') continue;
        const near = nearestTarget(m.pos.x, m.pos.z, targets);
        if (near === null || Math.hypot(m.pos.x - near.x, m.pos.z - near.z) <= TUNING.mowerLeashDist) continue;
        const p = ringPoint(player, TUNING.spawnRingMin, TUNING.spawnRingMax, m.radius);
        m.pos.x = p.x;
        m.pos.z = p.z;
        m.pos.y = 0;
        m.vy = 0;
        m.climbing = false;
        m.heading = Math.atan2(player.x - p.x, player.z - p.z);
      }
    }

    // 2. Steering and movement. Each mower turns toward its nearest target; with no targets it keeps its heading.
    for (const m of live) {
      const def = MOWER_TIERS[m.tier];
      m.slowS -= dt;
      const mul = m.slowS > 0 ? m.slowFactor : 1;
      const speed = def.speed * diff.speedMult * mul * (m.climbing ? CLIMB_SPEED_FACTOR : 1);
      const near = nearestTarget(m.pos.x, m.pos.z, targets);
      if (near !== null) {
        const desired = Math.atan2(near.x - m.pos.x, near.z - m.pos.z);
        const diff = Math.atan2(Math.sin(desired - m.heading), Math.cos(desired - m.heading));
        const maxTurn = def.turnRate * dt;
        m.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
      }
      m.pos.x += Math.sin(m.heading) * speed * dt;
      m.pos.z += Math.cos(m.heading) * speed * dt;
    }

    // 3. Obstacles (the combine plows through them at y = 0).
    // Tall ones block as before. Climbable ones (height <= mowerClimbMaxHeight) are crawled up and over.
    for (const m of live) {
      if (m.tier === 'combine') continue;
      let surface = 0; // highest climbable top the mower's centre is over
      let climbTop = -1; // highest top of a climbable side the mower is touching and still below
      for (const o of obstacles) {
        const dx = m.pos.x - o.x;
        const dz = m.pos.z - o.z;
        const d = Math.hypot(dx, dz);
        if (o.height > TUNING.mowerClimbMaxHeight) {
          const min = o.radius + m.radius;
          if (d >= min) continue;
          const nx = d < 1e-4 ? 1 : dx / d;
          const nz = d < 1e-4 ? 0 : dz / d;
          m.pos.x = o.x + nx * min;
          m.pos.z = o.z + nz * min;
          continue;
        }
        // On top: supported out to the lip (+60% of its body), so it does not fall and re-climb at the edge.
        if (d < o.radius || (d < o.radius + m.radius * 0.6 && m.pos.y >= o.height - 0.1)) {
          surface = Math.max(surface, o.height);
        } else if (d < o.radius + m.radius && m.pos.y < o.height - 0.05) {
          climbTop = Math.max(climbTop, o.height);
        }
      }

      m.climbing = climbTop > 0;
      if (m.climbing) {
        m.pos.y = Math.min(climbTop, m.pos.y + TUNING.mowerClimbSpeed * dt);
        m.vy = 0;
      } else if (m.pos.y > surface + 0.01) {
        m.vy -= TUNING.gravity * dt;
        m.pos.y = Math.max(surface, m.pos.y + m.vy * dt);
      } else {
        m.pos.y = surface;
        m.vy = 0;
      }

      const targetPitch = m.climbing ? -1.2 : m.vy < 0 ? 0.5 : 0;
      m.pitch += (targetPitch - m.pitch) * (1 - Math.exp(-10 * dt));
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
      const speed = def.speed * diff.speedMult * (m.slowS > 0 ? m.slowFactor : 1) * (m.climbing ? CLIMB_SPEED_FACTOR : 1);
      m.flashS -= dt;
      m.model.setFlash(m.flashS > 0);
      m.model.group.position.set(m.pos.x, m.pos.y, m.pos.z);
      m.model.group.rotation.y = m.heading;
      m.model.group.rotation.x = m.pitch;
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
    setNight(value: number) {
      night01 = value;
      for (const m of mowers) m.model.setNight(value);
    },
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
    spawnBoss(count: number, hpMult: number): void {
      bossHpMult = hpMult;
      for (let i = 0; i < count; i++) {
        const p = ringPoint(lastTarget, TUNING.bossSpawnDist, TUNING.bossSpawnDist + 3 + i * 6, MOWER_TIERS.combine.radius);
        spawn('combine', lastTarget, p.x, p.z);
      }
    },
    bossHp(): { hp: number; max: number; count: number } | null {
      let hp = 0;
      let max = 0;
      let count = 0;
      for (const m of alive()) {
        if (m.tier !== 'combine') continue;
        hp += m.hp;
        max += m.maxHp;
        count++;
      }
      return count > 0 ? { hp, max, count } : null;
    },
    setDifficulty(d: MowerDifficulty): void {
      diff = { ...d };
    },
    holdSpawns(seconds: number): void {
      holdS = Math.max(holdS, seconds);
    },
    reset(): void {
      for (const m of mowers) scene.remove(m.model.group);
      mowers = [];
      pendingKills = [];
      spawnTimer = 1;
      holdS = 0;
    },
  };
}
