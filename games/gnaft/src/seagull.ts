// Seagull pest: now and then a gull lands on the tallest grass and eats it until the player shoos it away.
// Co-op: the host (or solo) simulates it into state.gull; every player renders it and can shoo it.
import * as THREE from 'three';
import { KEYS, RAFT_TOP, SEAGULL, TILE_SIZE, type Ctx, type GameState, type GullPhase, type System, type Tile } from './config';
import { notify, shooGull, tileKey } from './rules';
import { sfx } from './audio';

const MIN_GROWTH = 0.3;     // a tile must be at least this grown to attract a gull
const EAT_DONE = 0.05;      // below this the gull hops to a fresher tile
const HOP_RANGE = 3;        // tiles (Chebyshev) the gull may hop to
const HOP_TIME = 0.45;      // seconds for one hop
const RETRY_WAIT = 5;       // seconds to wait when no tile is grown enough
const SPAWN_RADIUS = 40;    // metres from the origin
const SPAWN_HEIGHT = 12;    // metres above the water
const FLEE_SPEED = 14;      // m/s
const FLEE_TIME = 4;        // seconds
const FLEE_CLIMB = 6;       // m/s upward while fleeing
const BONK_DISTANCE = 4;    // metres: F bonks a gull this close

type Phase = 'away' | 'flyIn' | 'eating' | 'flee';
type TileRef = { i: number; j: number };

interface Wing { root: THREE.Group; flap: THREE.Group; side: 1 | -1 }
interface GullModel { group: THREE.Group; body: THREE.Group; wings: Wing[] }

function buildGull(): GullModel {
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.5 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.7 });

  const group = new THREE.Group(); // origin at the feet; forward is +z
  const body = new THREE.Group();  // pitches for pecking; origin at body centre
  body.position.set(0, 0.26, 0);
  group.add(body);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), white);
  torso.scale.set(1, 0.7, 1.7);
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), white);
  head.position.set(0, 0.1, 0.25);
  head.castShadow = true;
  body.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 8), orange);
  beak.rotation.x = Math.PI / 2; // tip points along +z
  beak.position.set(0, 0.08, 0.37);
  beak.castShadow = true;
  body.add(beak);

  const wings: Wing[] = [];
  for (const side of [1, -1] as const) {
    const root = new THREE.Group(); // fold angle (rotation.y)
    root.position.set(side * 0.1, 0.05, 0);
    body.add(root);
    const flap = new THREE.Group(); // flap angle (rotation.z)
    root.add(flap);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.14), grey);
    wing.position.set(side * 0.18, 0, 0);
    wing.castShadow = true;
    flap.add(wing);
    wings.push({ root, flap, side });
  }

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), orange);
    leg.position.set(side * 0.06, 0.1, 0.02);
    leg.castShadow = true;
    group.add(leg);
  }

  return { group, body, wings };
}

function tileCentre(t: TileRef): THREE.Vector3 {
  return new THREE.Vector3(t.i * TILE_SIZE, RAFT_TOP, t.j * TILE_SIZE);
}

/** Most-grown tile that is at least MIN_GROWTH. With `from`, only tiles within `range` of it, excluding it. */
function findTile(s: GameState, from: TileRef | null, range: number): Tile | null {
  let best: Tile | null = null;
  for (const t of s.tiles.values()) {
    if (t.growth < MIN_GROWTH) continue;
    if (from) {
      if (t.i === from.i && t.j === from.j) continue;
      if (Math.max(Math.abs(t.i - from.i), Math.abs(t.j - from.j)) > range) continue;
    }
    if (!best || t.growth > best.growth) best = t;
  }
  return best;
}

function nextInterval(): number {
  return SEAGULL.intervalMin + Math.random() * (SEAGULL.intervalMax - SEAGULL.intervalMin);
}

export function createSeagull(ctx: Ctx): System {
  const gull = buildGull();
  gull.group.visible = false;
  ctx.scene.add(gull.group);
  const view = ctx.state.gull;

  // ---------------------------------------------------------------- simulation (host / solo only)
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let gullsSpawned = 0;
  let wait = 0;                 // away: seconds until the next spawn attempt
  let target: TileRef = { i: 0, j: 0 };
  let phaseTime = 0;            // seconds spent in the current phase
  let hop: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  /** The phase the simulation last set; null right after this player became host (it then takes over view). */
  let simPhase: GullPhase | null = null;

  function setPhase(p: GullPhase): void {
    view.phase = p;
    simPhase = p;
    phaseTime = 0;
  }

  function startFlee(): void {
    setPhase('flee');
    hop = null;
    // Away from the raft centre (whoever shooed it, it heads out to sea).
    let dx = pos.x;
    let dz = pos.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.01) {
      const a = Math.random() * Math.PI * 2;
      dx = Math.sin(a);
      dz = Math.cos(a);
      len = 1;
    }
    vel.set((dx / len) * FLEE_SPEED, FLEE_CLIMB, (dz / len) * FLEE_SPEED);
  }

  function faceVelocity(): void {
    if (Math.hypot(vel.x, vel.z) > 0.01) view.heading = Math.atan2(vel.x, vel.z);
  }

  function simulate(dt: number): void {
    const s = ctx.state;
    if (simPhase === null) {
      // Just became host: carry on from the shared view.
      pos.set(view.x, view.y, view.z);
      simPhase = view.phase;
      if (view.phase === 'eating' || view.phase === 'flyIn') {
        target = { i: Math.round(view.x / TILE_SIZE), j: Math.round(view.z / TILE_SIZE) };
        if (view.phase === 'eating' && !s.tiles.has(tileKey(target.i, target.j))) startFlee();
        if (view.phase === 'flyIn') {
          const t = findTile(s, null, Infinity);
          if (t) target = { i: t.i, j: t.j };
          else startFlee();
        }
      } else if (view.phase === 'flee') startFlee();
    }
    if (view.phase !== simPhase) {
      if (view.phase === 'flee') startFlee(); // shooed (rules.shooGull, here or by a guest)
      else setPhase(view.phase);
    }
    phaseTime += dt;

    if (view.phase === 'away') {
      view.flying = true;
      if (s.mode === 'title' || s.sea.docked) return;
      if (wait > 0) { wait -= dt; return; }
      if (gullsSpawned === 0 && s.time < SEAGULL.firstAfter) return;

      const tile = findTile(s, null, Infinity);
      if (!tile) { wait = RETRY_WAIT; return; }

      const a = Math.random() * Math.PI * 2;
      pos.set(Math.sin(a) * SPAWN_RADIUS, SPAWN_HEIGHT, Math.cos(a) * SPAWN_RADIUS);
      target = { i: tile.i, j: tile.j };
      gullsSpawned++;
      setPhase('flyIn');
    }

    if (view.phase === 'flyIn') {
      const goal = tileCentre(target);
      const dir = goal.clone().sub(pos);
      const dist = dir.length();
      const step = SEAGULL.flySpeed * dt;
      if (dist <= step) {
        pos.copy(goal);
        vel.set(0, 0, 0);
        setPhase('eating');
      } else {
        vel.copy(dir).multiplyScalar(SEAGULL.flySpeed / dist);
        pos.addScaledVector(vel, dt);
        faceVelocity();
      }
      view.flying = true;
    } else if (view.phase === 'eating') {
      if (hop) {
        hop.t = Math.min(1, hop.t + dt / HOP_TIME);
        pos.lerpVectors(hop.from, hop.to, hop.t);
        pos.y = RAFT_TOP + Math.sin(Math.PI * hop.t) * 0.6;
        if (hop.t >= 1) { pos.copy(hop.to); hop = null; }
      } else {
        const tile = s.tiles.get(tileKey(target.i, target.j));
        if (!tile) { startFlee(); } // grass is gone: no reward
        else {
          tile.growth = Math.max(0, tile.growth - SEAGULL.eatRate * dt);
          if (tile.growth < EAT_DONE) {
            const next = findTile(s, target, HOP_RANGE);
            if (!next) { startFlee(); }
            else {
              const to = tileCentre(next);
              hop = { from: pos.clone(), to, t: 0 };
              vel.copy(to).sub(pos);
              faceVelocity();
              target = { i: next.i, j: next.j };
            }
          }
        }
      }
      view.flying = hop !== null;
    } else if (view.phase === 'flee') {
      pos.addScaledVector(vel, dt);
      faceVelocity();
      view.flying = true;
      if (phaseTime >= FLEE_TIME) {
        setPhase('away');
        wait = nextInterval();
      }
    }
    view.x = pos.x;
    view.y = pos.y;
    view.z = pos.z;
  }

  // ---------------------------------------------------------------- presentation (everyone)
  let clock = 0;                // animation time
  let sfxWait = 0;              // seconds until the next eating squawk
  let seenPhase: GullPhase = view.phase;
  let landings = 0;

  function setPose(flying: boolean): void {
    const flap = Math.sin(clock * 14) * 0.8;
    for (const w of gull.wings) {
      w.root.rotation.y = flying ? 0 : w.side * 1.2; // folded back along the body when landed
      w.flap.rotation.z = flying ? w.side * flap : 0;
    }
    gull.body.rotation.x = flying ? 0.1 : 0.2 + 0.25 * Math.sin(clock * 6); // landed: peck
  }

  function render(dt: number, smooth: boolean): void {
    const s = ctx.state;
    if (view.phase !== seenPhase) {
      const from = seenPhase;
      seenPhase = view.phase;
      if (from === 'away') gull.group.position.set(view.x, view.y, view.z); // appear where it spawned
      if (view.phase === 'eating') {
        landings++;
        sfxWait = 3 + Math.random() * 2;
        sfx('gull');
        notify(s, landings === 1 ? 'A seagull is eating your lawn! Walk up to it or press F.' : 'Seagull!');
      }
    }
    gull.group.visible = view.phase !== 'away';
    if (!gull.group.visible) return;

    // A guest only gets the host's position a few times a second, so it eases toward it.
    const k = smooth ? 1 - Math.exp(-10 * dt) : 1;
    const g = gull.group.position;
    g.set(g.x + (view.x - g.x) * k, g.y + (view.y - g.y) * k, g.z + (view.z - g.z) * k);
    const turn = Math.atan2(Math.sin(view.heading - gull.group.rotation.y), Math.cos(view.heading - gull.group.rotation.y));
    gull.group.rotation.y += turn * k;
    setPose(view.flying);

    if (view.phase === 'eating' && !view.flying) {
      sfxWait -= dt;
      if (sfxWait <= 0) { sfx('gull'); sfxWait = 3 + Math.random() * 2; }
    }
  }

  return {
    update(dt: number): void {
      const s = ctx.state;
      clock += dt;

      // Any player can shoo it: walk up to it, or press F close by. A guest's shoo is sent to the host.
      if (view.phase === 'flyIn' || view.phase === 'eating') {
        const p = s.player.position;
        const g = gull.group.position;
        const d = Math.hypot(p.x - g.x, p.z - g.z);
        if (d <= SEAGULL.scareDistance || (d <= BONK_DISTANCE && ctx.input.pressed(KEYS.bonk))) {
          if (shooGull(s)) sfx('gull');
        }
      }

      if (s.netRole === 'guest') simPhase = null;
      else simulate(dt);
      render(dt, s.netRole === 'guest');
    },
  };
}
