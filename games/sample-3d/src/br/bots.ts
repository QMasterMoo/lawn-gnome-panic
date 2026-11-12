import * as THREE from 'three';
import {
  ARENA_HALF, BASE_STATS, MOWER_TIERS, OBSTACLES, PLAYER_RADIUS, TUNING,
} from '../config';
import type {
  BotContext, BotSystem, Contestant, EnemyView, GnomeModel, InputState, KillEvent,
  Obstacle, PlayerState, PlayerStats, ZoneState,
} from '../config';
import { createGnome } from '../gnome';
import { createPlayerState, updatePlayer } from '../player';
import { generateGamertags } from './names';

const HAT_COLORS = [0xd93636, 0x8e24aa, 0x1e88e5, 0x43a047, 0xfb8c00, 0xfdd835, 0x00acc1, 0xec407a, 0x6d4c41, 0x212121];
const SHIRT_COLORS = [0x2f64c9, 0xc62828, 0x2e7d32, 0x6a1b9a, 0xef6c00, 0x455a64, 0xad1457, 0x00838f];

const TAG_OFFSET_Y = 2.1;
const DEAD_LINGER_S = 3;
const TRACER_S = 0.06;
const ZONE_EDGE_MARGIN = 12;
const THREAT_RANGE = 7;
const THREAT_JUMP_RANGE = 2.4;
const HUNT_RANGE = 14;
const KEEP_AWAY = 4.5;
const ATTACK_INTERVAL_S = 0.25;
const SPAWN_MIN_FROM_AVOID = 15;
const SPAWN_EDGE_MARGIN = 5;

interface Bot {
  id: number;
  name: string;
  state: PlayerState;
  stats: PlayerStats;
  model: GnomeModel;
  tag: THREE.Sprite;
  hearts: number;
  invulnS: number;
  zoneTimer: number;
  alive: boolean;
  deadS: number;
  lastCause: string;
  waypoint: { x: number; z: number };
  rethinkS: number;
  jumpCooldown: number;
  attackTimer: number;
}

interface Tracer {
  line: THREE.Line;
  array: Float32Array;
  attr: THREE.BufferAttribute;
  timeLeft: number;
}

/** Normalises a 2D vector; a zero vector stays zero. */
function unit(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z);
  return len < 1e-6 ? { x: 0, z: 0 } : { x: x / len, z: z / len };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Random point inside a circle of the given radius around (cx, cz). */
function randomInCircle(cx: number, cz: number, radius: number): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const r = radius * Math.sqrt(Math.random());
  return { x: cx + Math.cos(angle) * r, z: cz + Math.sin(angle) * r };
}

function findSpawnSpot(center: THREE.Vector3, avoid: THREE.Vector3): { x: number; z: number } {
  const limit = ARENA_HALF - SPAWN_EDGE_MARGIN;
  let spot = { x: center.x, z: center.z };
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = randomInCircle(center.x, center.z, TUNING.royaleSpawnRadius);
    spot = { x: clamp(p.x, -limit, limit), z: clamp(p.z, -limit, limit) };
    if (Math.hypot(spot.x - avoid.x, spot.z - avoid.z) < SPAWN_MIN_FROM_AVOID) continue;
    if (OBSTACLES.some((o) => Math.hypot(spot.x - o.x, spot.z - o.z) < o.radius + 1)) continue;
    return spot;
  }
  return spot;
}

/** Name tag: a dark rounded pill with white bold text, drawn to a canvas texture. */
export function createNameTag(name: string): THREE.Sprite {
  const w = 256;
  const h = 48;
  const r = 12;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) {
    g.beginPath();
    g.moveTo(r, 0);
    g.arcTo(w, 0, w, h, r);
    g.arcTo(w, h, 0, h, r);
    g.arcTo(0, h, 0, 0, r);
    g.arcTo(0, 0, w, 0, r);
    g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fill();
    g.font = 'bold 26px sans-serif';
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, w / 2, h / 2 + 1, w - 16);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.6, 0.5, 1);
  return sprite;
}

/** Bot gnomes for the battle royale demo. */
export function createBotSystem(scene: THREE.Scene): BotSystem {
  const bots: Bot[] = [];
  const tracers: Tracer[] = [];
  let nextId = 1;

  function showTracer(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    let t = tracers.find((tr) => tr.timeLeft <= 0);
    if (!t) {
      const array = new Float32Array(6);
      const attr = new THREE.BufferAttribute(array, 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', attr);
      const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
      const line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      scene.add(line);
      t = { line, array, attr, timeLeft: 0 };
      tracers.push(t);
    }
    t.array.set([ax, ay, az, bx, by, bz]);
    t.attr.needsUpdate = true;
    t.line.visible = true;
    t.timeLeft = TRACER_S;
  }

  /** Chooses this frame's input from the situation: zone, threats, hunting, roaming. */
  function think(bot: Bot, ctx: BotContext, zone: ZoneState, nearest: EnemyView | undefined, nearestDist: number, dt: number): InputState {
    const px = bot.state.position.x;
    const pz = bot.state.position.z;
    const toCentre = unit(zone.cx - px, zone.cz - pz);
    const centreDist = Math.hypot(zone.cx - px, zone.cz - pz);
    let desired = { x: 0, z: 0 };
    let sprint = false;
    let jump = false;

    if (centreDist > zone.radius - ZONE_EDGE_MARGIN) {
      // Zone: outside, or close to the edge. Run for the centre.
      desired = toCentre;
      sprint = true;
    } else if (nearest && nearestDist < THREAT_RANGE) {
      // Threat: run away, blended 30% toward the centre.
      const away = unit(px - nearest.pos.x, pz - nearest.pos.z);
      desired = { x: away.x + 0.3 * toCentre.x, z: away.z + 0.3 * toCentre.z };
      sprint = true;
      if (nearestDist < THREAT_JUMP_RANGE && bot.state.grounded && bot.jumpCooldown <= 0 && Math.random() < 0.5) {
        jump = true;
        bot.jumpCooldown = 1.2;
      }
    } else if (nearest && nearestDist < HUNT_RANGE) {
      // Hunt: keep about KEEP_AWAY from the enemy, circling when close.
      const toward = unit(nearest.pos.x - px, nearest.pos.z - pz);
      if (nearestDist > KEEP_AWAY) {
        desired = toward;
      } else {
        desired = { x: -toward.z, z: toward.x };
      }
    } else {
      // Roam: wander toward a waypoint inside the zone.
      bot.rethinkS -= dt;
      if (bot.rethinkS <= 0 || Math.hypot(bot.waypoint.x - px, bot.waypoint.z - pz) < 3) {
        bot.waypoint = randomInCircle(zone.cx, zone.cz, 0.7 * zone.radius);
        bot.rethinkS = 4 + Math.random() * 4;
      }
      desired = { x: bot.waypoint.x - px, z: bot.waypoint.z - pz };
    }

    // Obstacles: if one sits on the path 2 units ahead, turn 90 degrees.
    const dir = unit(desired.x, desired.z);
    const aheadX = px + dir.x * 2;
    const aheadZ = pz + dir.z * 2;
    if (ctx.obstacles.some((o: Obstacle) => Math.hypot(o.x - aheadX, o.z - aheadZ) < o.radius + 1.5)) {
      desired = { x: -dir.z, z: dir.x };
    }

    const move = unit(desired.x, desired.z);
    // cameraYaw is 0 for bots: forward is +z, right is -x.
    return { moveX: -move.x, moveY: move.z, jump, sprint, start: false, lookX: 0, lookY: 0 };
  }

  function stepBot(bot: Bot, dt: number, ctx: BotContext, zone: ZoneState, deaths: KillEvent[]): void {
    const px = bot.state.position.x;
    const pz = bot.state.position.z;
    bot.jumpCooldown -= dt;

    let nearest: EnemyView | undefined;
    let nearestDist = Infinity;
    for (const e of ctx.enemies) {
      const d = Math.hypot(e.pos.x - px, e.pos.z - pz);
      if (d < nearestDist) {
        nearest = e;
        nearestDist = d;
      }
    }

    // AI and physics.
    const input = think(bot, ctx, zone, nearest, nearestDist, dt);
    updatePlayer(bot.state, input, 0, ctx.obstacles, bot.stats, dt);

    // Combat: swing at the nearest enemy in range.
    bot.attackTimer -= dt;
    if (bot.attackTimer <= 0) {
      bot.attackTimer = ATTACK_INTERVAL_S;
      if (nearest && nearestDist <= TUNING.botAttackRange) {
        const dps = TUNING.botDpsStart + TUNING.botDpsPer10s * ctx.elapsedS / 10;
        ctx.damageEnemy(nearest.id, dps * ATTACK_INTERVAL_S);
        showTracer(px, 1.0, pz, nearest.pos.x, 0.6, nearest.pos.z);
      }
    }

    // Damage from mowers.
    bot.invulnS -= dt;
    if (bot.invulnS <= 0) {
      const hitter = ctx.enemies.find((e) => {
        const d = Math.hypot(e.pos.x - px, e.pos.z - pz);
        return d < PLAYER_RADIUS + e.radius && bot.state.position.y < e.pos.y + MOWER_TIERS[e.tier].height && bot.state.position.y > e.pos.y - 0.6;
      });
      if (hitter) {
        const def = MOWER_TIERS[hitter.tier];
        bot.hearts -= def.contactDamage;
        bot.invulnS = TUNING.invulnS;
        bot.lastCause = def.name;
      }
    }

    // Damage from the zone.
    if (ctx.zone.isOutside(px, pz)) {
      bot.zoneTimer -= dt;
      if (bot.zoneTimer <= 0) {
        bot.hearts -= 1;
        bot.zoneTimer = TUNING.zoneDamageEveryS * (ctx.zone.state().radius < TUNING.zoneLateRadius ? 0.5 : 1);
        bot.lastCause = 'THE MOW ZONE';
      }
    } else {
      bot.zoneTimer = Math.min(bot.zoneTimer, 0.5);
    }

    // Death.
    if (bot.hearts <= 0) {
      bot.alive = false;
      bot.model.setDead(true);
      bot.deadS = DEAD_LINGER_S;
      deaths.push({ victim: bot.name, cause: bot.lastCause });
    }
  }

  return {
    spawn(count: number, center: THREE.Vector3, avoid: THREE.Vector3): void {
      const names = generateGamertags(count);
      for (let i = 0; i < count; i++) {
        const spot = findSpawnSpot(center, avoid);
        const stats: PlayerStats = { ...BASE_STATS };
        const state = createPlayerState(stats);
        state.position.set(spot.x, 0, spot.z);
        state.facing = Math.random() * Math.PI * 2;

        const model = createGnome(
          HAT_COLORS[i % HAT_COLORS.length],
          SHIRT_COLORS[i % SHIRT_COLORS.length],
        );
        const tag = createNameTag(names[i]);
        scene.add(model.object, tag);

        bots.push({
          id: nextId++,
          name: names[i],
          state,
          stats,
          model,
          tag,
          hearts: TUNING.botHearts,
          invulnS: 0,
          zoneTimer: TUNING.zoneDamageEveryS,
          alive: true,
          deadS: 0,
          lastCause: 'UNEXPLAINED LAWN INCIDENT',
          waypoint: { x: spot.x, z: spot.z },
          rethinkS: 0,
          jumpCooldown: 0,
          attackTimer: 0,
        });
      }
    },

    update(dt: number, ctx: BotContext): KillEvent[] {
      const deaths: KillEvent[] = [];
      const zone = ctx.zone.state();

      for (const t of tracers) {
        if (t.timeLeft > 0) {
          t.timeLeft -= dt;
          if (t.timeLeft <= 0) t.line.visible = false;
        }
      }

      for (const bot of bots) {
        if (!bot.alive) {
          bot.deadS -= dt;
          if (bot.deadS <= 0 && bot.model.object.parent) {
            scene.remove(bot.model.object, bot.tag);
          }
          continue;
        }
        stepBot(bot, dt, ctx, zone, deaths);
      }

      // Visuals for every bot still in the scene.
      for (const bot of bots) {
        if (!bot.model.object.parent) continue;
        const p = bot.state.position;
        bot.model.update(bot.state, dt);
        const invulnerable = bot.alive && bot.invulnS > 0;
        bot.model.object.visible = !invulnerable || Math.floor(ctx.elapsedS * 12) % 2 === 0;
        bot.tag.position.set(p.x, p.y + TAG_OFFSET_Y, p.z);
      }

      return deaths;
    },

    contestants(): readonly Contestant[] {
      return bots.map((b) => ({ id: b.id, name: b.name, pos: b.state.position, alive: b.alive }));
    },

    aliveCount(): number {
      return bots.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
    },

    reset(): void {
      for (const bot of bots) {
        scene.remove(bot.model.object, bot.tag);
        const mat = bot.tag.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
      bots.length = 0;
      for (const t of tracers) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
      }
      tracers.length = 0;
    },
  };
}
