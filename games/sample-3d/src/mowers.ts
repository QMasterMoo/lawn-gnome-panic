// src/mowers.ts
import * as THREE from 'three';
import { ARENA_HALF, COLORS, MOWER_RADIUS, TUNING, type MowerSystem, type Obstacle } from './config';

interface Mower {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  engine: THREE.Mesh;
  pos: THREE.Vector3;
  heading: number;
}

const WHEEL_RADIUS = 0.18;
const SPAWN_TIMER_START = 1.5;

// Shared geometry and materials: they are never disposed, so every mower reuses them.
const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.mowerBody });
const darkMat = new THREE.MeshStandardMaterial({ color: COLORS.mowerDark });

const deckGeo = new THREE.BoxGeometry(1.4, 0.3, 1.3);
const engineGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.3, 16);
const capGeo = new THREE.BoxGeometry(0.2, 0.1, 0.2);
const wheelGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.12, 16);
wheelGeo.rotateZ(Math.PI / 2);
const handleGeo = new THREE.BoxGeometry(0.05, 0.05, 1.0);
const crossbarGeo = new THREE.BoxGeometry(0.95, 0.06, 0.06);

/** Builds a mower facing +z with its base at y = 0 and its handle at the back (-z). */
function buildMowerMesh(): { group: THREE.Group; wheels: THREE.Mesh[]; engine: THREE.Mesh } {
  const group = new THREE.Group();
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  };

  const deck = mesh(deckGeo, bodyMat);
  deck.position.set(0, 0.35, 0);

  const engine = mesh(engineGeo, darkMat);
  engine.position.set(0, 0.65, 0.1);
  const cap = mesh(capGeo, bodyMat);
  cap.position.set(0, 0.2, 0); // local to the engine: world y 0.85 at rest
  engine.add(cap);

  const wheels: THREE.Mesh[] = [];
  for (const wx of [-0.72, 0.72]) {
    for (const wz of [-0.45, 0.45]) {
      const w = mesh(wheelGeo, darkMat);
      w.position.set(wx, 0.18, wz);
      wheels.push(w);
      group.add(w);
    }
  }

  for (const hx of [-0.45, 0.45]) {
    const h = mesh(handleGeo, darkMat);
    h.position.set(hx, 0.8, -0.95);
    h.rotation.x = -0.75;
    group.add(h);
  }
  const crossbar = mesh(crossbarGeo, darkMat);
  crossbar.position.set(0, 1.12, -1.3);
  group.add(crossbar);

  group.add(deck, engine);
  return { group, wheels, engine };
}

export function createMowerSystem(scene: THREE.Scene): MowerSystem {
  const mowers: Mower[] = [];
  let timer = SPAWN_TIMER_START;
  let t = 0;

  function spawn(): void {
    const along = (Math.random() * 2 - 1) * (ARENA_HALF - 2);
    const edge = (Math.random() < 0.5 ? -1 : 1) * (ARENA_HALF - 1.2);
    const alongX = Math.random() < 0.5;
    const x = alongX ? along : edge;
    const z = alongX ? edge : along;

    const { group, wheels, engine } = buildMowerMesh();
    const heading = Math.atan2(-x, -z); // toward the arena centre
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    mowers.push({ group, wheels, engine, pos: new THREE.Vector3(x, 0, z), heading });
  }

  return {
    update(dt: number, elapsedS: number, target: THREE.Vector3, obstacles: readonly Obstacle[], onMow: (x: number, z: number) => void) {
      t += dt;
      const speed = Math.min(TUNING.mowerSpeedMax, TUNING.mowerSpeedStart + TUNING.mowerSpeedRampPerSec * elapsedS);

      timer -= dt;
      if (timer <= 0 && mowers.length < TUNING.mowerMax) {
        spawn();
        timer = Math.max(TUNING.mowerSpawnMinS, TUNING.mowerSpawnStartS - TUNING.mowerSpawnRampPerSec * elapsedS);
      }

      for (const m of mowers) {
        // Steer toward the target with a limited turn rate.
        const desired = Math.atan2(target.x - m.pos.x, target.z - m.pos.z);
        let diff = desired - m.heading;
        diff = ((diff + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        const maxTurn = TUNING.mowerTurnRate * dt;
        m.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));

        m.pos.x += Math.sin(m.heading) * speed * dt;
        m.pos.z += Math.cos(m.heading) * speed * dt;

        // Keep out of obstacles.
        for (const o of obstacles) {
          const dx = m.pos.x - o.x;
          const dz = m.pos.z - o.z;
          const d = Math.hypot(dx, dz);
          const minD = o.radius + MOWER_RADIUS;
          if (d < minD) {
            const nx = d < 1e-4 ? 1 : dx / d;
            const nz = d < 1e-4 ? 0 : dz / d;
            m.pos.x = o.x + nx * minD;
            m.pos.z = o.z + nz * minD;
          }
        }
      }

      // Mowers push each other apart.
      const minPair = 2 * MOWER_RADIUS;
      for (let i = 0; i < mowers.length; i++) {
        for (let j = i + 1; j < mowers.length; j++) {
          const a = mowers[i].pos;
          const b = mowers[j].pos;
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const d = Math.hypot(dx, dz);
          if (d < minPair) {
            const overlap = minPair - d;
            const nx = d < 1e-4 ? 1 : dx / d;
            const nz = d < 1e-4 ? 0 : dz / d;
            const half = overlap / 2;
            a.x -= nx * half;
            a.z -= nz * half;
            b.x += nx * half;
            b.z += nz * half;
          }
        }
      }

      const lim = ARENA_HALF - MOWER_RADIUS;
      for (const m of mowers) {
        m.pos.x = Math.max(-lim, Math.min(lim, m.pos.x));
        m.pos.z = Math.max(-lim, Math.min(lim, m.pos.z));
      }

      // Visuals and mowing.
      for (const m of mowers) {
        m.group.position.set(m.pos.x, 0, m.pos.z);
        m.group.rotation.y = m.heading;
        for (const w of m.wheels) {
          w.rotation.x += (speed * dt) / WHEEL_RADIUS;
        }
        m.engine.position.y = 0.65 + Math.sin(t * 60) * 0.012;
        m.group.rotation.z = Math.sin(t * 45) * 0.01;
        onMow(m.pos.x, m.pos.z);
      }
    },

    positions: () => mowers.map((m) => m.pos),

    nearestDistance(p: THREE.Vector3): number {
      let best = Infinity;
      for (const m of mowers) {
        best = Math.min(best, Math.hypot(m.pos.x - p.x, m.pos.z - p.z));
      }
      return best;
    },

    reset() {
      for (const m of mowers) scene.remove(m.group);
      mowers.length = 0;
      timer = SPAWN_TIMER_START;
    },
  };
}
