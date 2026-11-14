// The lawn shark: a fin circles the raft and every so often chews on an edge tile.
// Get over there and bonk it (F), or lose the tile.
// Co-op: the host (or solo) simulates it into state.shark; every player renders from state.shark and can bonk it.
import * as THREE from 'three';
import { KEYS, SHARK, TILE_SIZE } from './config';
import type { Ctx, SharkPhase, System } from './config';
import { sfx } from './audio';
import { bonkShark, edgeTiles, notify, raftExtent, removeTile, tileKey } from './rules';

const SHARK_GREY = 0x56606b;
const CIRCLE_SPEED = 4;      // m/s
const APPROACH_SPEED = 6;    // m/s
const FLEE_SPEED = 8;        // m/s
const FLEE_SECONDS = 5;
const BITE_OUT = 1.6;        // the bite point is this far from the tile centre, outward
const RETRY_SECONDS = 10;    // raft too small to bite: check again after this long
const SMOOTH_RATE = 8;       // 1/s: how fast a guest's shark eases toward the host's latest position
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

interface Splash { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export function createShark(ctx: Ctx): System {
  const { scene, state, input } = ctx;
  const sh = state.shark;

  // ---------------------------------------------------------------- model
  const group = new THREE.Group();
  group.position.set(sh.x, 0, sh.z);
  scene.add(group);

  const greyMat = new THREE.MeshStandardMaterial({ color: SHARK_GREY, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), greyMat);
  body.scale.set(0.7, 0.5, 1.5); // about 3 m long, just below the surface
  body.position.y = -0.4;
  group.add(body);

  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), greyMat);
  fin.scale.set(0.2, 1, 1);      // flattened along x into a blade
  fin.position.set(0, 0.5, 0.2);
  fin.castShadow = true;
  group.add(fin);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.6), greyMat);
  tail.position.set(0, 0.1, -1.7);
  tail.castShadow = true;
  group.add(tail);

  // White wake trailing behind the fin, fading with distance.
  const wakeGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (let k = 0; k < 6; k++) {
    const wakeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.8 * (1 - k / 6), depthWrite: false,
    });
    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    wake.scale.set(1.2, 0.04, 0.8);
    wake.position.set(0, 0.03, -2.2 - k * 0.9);
    group.add(wake);
  }

  // Pulsing red ring on the water at the bite point.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.3, 32),
    new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  // Splash bits while biting.
  const splashGeo = new THREE.SphereGeometry(0.12, 6, 4);
  const splashMats = [new THREE.MeshBasicMaterial({ color: 0xffffff }), new THREE.MeshBasicMaterial({ color: 0x9be38a })];
  const splashes: Splash[] = [];

  const active = (): boolean => state.mode !== 'title' && !state.sea.docked;

  // ---------------------------------------------------------------- simulation (host / solo only)
  /** Seconds until the next bite. null until the first attack gate passes. */
  let attackIn: number | null = null;
  let timer = 0;     // seconds left while biting or fleeing
  /** The phase the simulation last set. A different sh.phase was set from outside (a bonk, or this player just became host). */
  let simPhase: SharkPhase | null = null;

  function pickBite(): boolean {
    const edges = edgeTiles(state);
    if (edges.length === 0) return false;
    const tile = edges[Math.floor(Math.random() * edges.length)];
    const gaps = DIRS.filter(([di, dj]) => !state.tiles.has(tileKey(tile.i + di, tile.j + dj)));
    if (gaps.length === 0) return false;
    const [di, dj] = gaps[Math.floor(Math.random() * gaps.length)];
    sh.bite = {
      i: tile.i, j: tile.j, di, dj,
      x: tile.i * TILE_SIZE + di * BITE_OUT,
      z: tile.j * TILE_SIZE + dj * BITE_OUT,
    };
    return true;
  }

  /** Switches the simulation to a phase and starts its timer. */
  function enter(phase: SharkPhase): void {
    sh.phase = phase;
    simPhase = phase;
    if (phase === 'fleeing') timer = FLEE_SECONDS;
    else if (phase === 'biting') timer = SHARK.biteSeconds;
    else if (phase === 'circling') attackIn = rand(SHARK.intervalMin, SHARK.intervalMax);
  }

  function simulate(dt: number): void {
    if (sh.phase !== simPhase) enter(sh.phase);
    const on = active();
    switch (sh.phase) {
      case 'circling': {
        const cr = Math.max(6, raftExtent(state) + SHARK.circleRadius * 0.5);
        let radius = Math.max(1, Math.hypot(sh.x, sh.z));
        let angle = Math.atan2(sh.z, sh.x);
        radius += (cr - radius) * Math.min(1, dt * 2);
        angle += (CIRCLE_SPEED / radius) * dt;
        sh.x = Math.cos(angle) * radius;
        sh.z = Math.sin(angle) * radius;
        sh.heading = -angle; // path direction is (-sin a, cos a), which is heading -a

        if (on && attackIn === null && state.time >= SHARK.firstAfter) attackIn = 0;
        if (on && attackIn !== null) {
          attackIn -= dt;
          if (attackIn <= 0) {
            if (state.tiles.size <= SHARK.minTiles || !pickBite()) attackIn = RETRY_SECONDS;
            else {
              enter('approach');
              attackIn = null;
            }
          }
        }
        break;
      }
      case 'approach': {
        const dx = sh.bite.x - sh.x;
        const dz = sh.bite.z - sh.z;
        const d = Math.hypot(dx, dz);
        sh.heading = Math.atan2(dx, dz);
        const step = APPROACH_SPEED * dt;
        if (d <= step) {
          sh.x = sh.bite.x;
          sh.z = sh.bite.z;
          enter('biting');
        } else {
          sh.x += (dx / d) * step;
          sh.z += (dz / d) * step;
        }
        break;
      }
      case 'biting': {
        if (!state.tiles.has(tileKey(sh.bite.i, sh.bite.j))) {
          enter('circling');
          break;
        }
        sh.x = sh.bite.x;
        sh.z = sh.bite.z;
        sh.heading = Math.atan2(-sh.bite.di, -sh.bite.dj); // face the tile
        if (on) timer -= dt;
        if (on && timer <= 0) {
          removeTile(state, sh.bite.i, sh.bite.j, SHARK.minTiles);
          enter('fleeing');
        }
        break;
      }
      case 'fleeing': {
        const d = Math.hypot(sh.x, sh.z) || 1;
        const ux = sh.x / d;
        const uz = sh.z / d; // straight away from the raft
        sh.x += ux * FLEE_SPEED * dt;
        sh.z += uz * FLEE_SPEED * dt;
        sh.heading = Math.atan2(ux, uz);
        if (on) timer -= dt;
        if (on && timer <= 0) enter('circling');
        break;
      }
    }
  }

  // ---------------------------------------------------------------- presentation (everyone)
  let seenPhase: SharkPhase = sh.phase;
  let chompIn = 0;
  let splashIn = 0;
  let t = 0;         // animation clock

  function spawnSplash(): void {
    const mesh = new THREE.Mesh(splashGeo, splashMats[Math.random() < 0.5 ? 0 : 1]);
    mesh.position.set(sh.bite.x + rand(-0.6, 0.6), 0.1, sh.bite.z + rand(-0.6, 0.6));
    scene.add(mesh);
    splashes.push({ mesh, vx: rand(-1, 1), vy: rand(2, 4), vz: rand(-1, 1), life: 0.6 });
  }

  function updateSplashes(dt: number): void {
    for (let k = splashes.length - 1; k >= 0; k--) {
      const s = splashes[k];
      s.life -= dt;
      if (s.life <= 0) {
        scene.remove(s.mesh);
        splashes.splice(k, 1);
        continue;
      }
      s.vy -= 9.8 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
    }
  }

  /** Sounds and toasts on phase changes, so the host and every guest hear and read the same thing. */
  function onPhaseChange(from: SharkPhase, to: SharkPhase): void {
    if (to === 'approach') {
      sfx('shark');
      notify(state, 'The lawn shark is chewing your raft! Get over there and press F!');
    } else if (from === 'biting' && to === 'fleeing') {
      if (state.tiles.has(tileKey(sh.bite.i, sh.bite.j))) {
        sfx('bonk');
        notify(state, 'BONK! The shark swims off.');
      } else notify(state, 'The shark ate a tile!');
    }
  }

  function render(dt: number, smooth: boolean): void {
    if (sh.phase !== seenPhase) {
      onPhaseChange(seenPhase, sh.phase);
      seenPhase = sh.phase;
    }
    // A guest only gets the host's position a few times a second, so it eases toward it.
    const k = smooth ? 1 - Math.exp(-SMOOTH_RATE * dt) : 1;
    const biting = sh.phase === 'biting';
    if (biting) group.position.set(sh.bite.x, 0, sh.bite.z);
    else group.position.set(group.position.x + (sh.x - group.position.x) * k, 0, group.position.z + (sh.z - group.position.z) * k);
    const turn = Math.atan2(Math.sin(sh.heading - group.rotation.y), Math.cos(sh.heading - group.rotation.y));
    group.rotation.y += biting ? turn : turn * k;

    body.rotation.y = biting ? Math.sin(t * 14) * 0.18 : 0;                    // shake side to side
    if (biting) fin.position.set(0, 0.5, 0.2 + 0.7 * Math.max(0, Math.sin(t * 5))); // lunge at the tile
    else if (sh.phase === 'fleeing') fin.position.set(0, 0, 0.2);                   // fin dips under the water
    else if (sh.phase === 'circling') fin.position.set(0, 0.5 + Math.sin(t * 2) * 0.05, 0.2);
    else fin.position.set(0, 0.5, 0.2);

    ring.visible = biting;
    if (biting) {
      ring.position.set(sh.bite.x, 0.06, sh.bite.z);
      const pulse = 1 + 0.15 * Math.sin(t * 8);
      ring.scale.set(pulse, pulse, 1);
      if (active()) {
        chompIn -= dt;
        if (chompIn <= 0) {
          sfx('chomp');
          chompIn = 1;
        }
      }
      splashIn -= dt;
      if (splashIn <= 0) {
        spawnSplash();
        splashIn = 0.25;
      }
    } else chompIn = 0;
    updateSplashes(dt);
  }

  return {
    update(dt: number) {
      t += dt;
      const guest = state.netRole === 'guest';

      // Anyone close to the bite can bonk it. A guest's bonk is applied locally and sent to the host.
      if (sh.phase === 'biting' && input.pressed(KEYS.bonk)) {
        const p = state.player.position;
        if (Math.hypot(p.x - sh.bite.x, p.z - sh.bite.z) <= SHARK.bonkDistance) bonkShark(state);
      }

      if (guest) simPhase = null; // a guest promoted to host restarts the timers of the current phase
      else simulate(dt);
      render(dt, guest);
    },
  };
}
