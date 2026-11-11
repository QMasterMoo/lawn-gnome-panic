import * as THREE from 'three';
import { HOSE_MISSILE_LEVELS } from '../config';
import type { EnemyView, Weapon, WeaponContext } from '../config';

const BEAM_COUNT = 5;
const BEAM_FADE_S = 0.15;
const RETRY_S = 0.2;
const START_Y = 1.0;
const TARGET_Y = 0.8;
const UP = new THREE.Vector3(0, 1, 0);

interface Beam {
  mesh: THREE.Mesh;
  age: number;
  active: boolean;
}

function dist2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Stretches a unit-height beam from the gnome's hand to the target and starts its fade. */
function aimBeam(beam: Beam, from: THREE.Vector3, to: EnemyView): void {
  const start = new THREE.Vector3(from.x, START_Y, from.z);
  const end = new THREE.Vector3(to.pos.x, TARGET_Y, to.pos.z);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const m = beam.mesh;
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
  m.scale.set(1, len, 1);
  m.visible = true;
  beam.active = true;
  beam.age = 0;
}

export function createHoseMissile(scene: THREE.Scene): Weapon {
  let level = 1;
  let timer = 1;
  const levelStats = () => HOSE_MISSILE_LEVELS[level - 1];

  const geometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 6);
  const material = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true });
  const beams: Beam[] = [];
  for (let i = 0; i < BEAM_COUNT; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    beams.push({ mesh, age: 0, active: false });
  }

  return {
    id: 'hoseMissile',
    setLevel(l: number) {
      level = Math.min(HOSE_MISSILE_LEVELS.length, Math.max(1, Math.round(l)));
    },
    update(ctx: WeaponContext) {
      for (const b of beams) {
        if (!b.active) continue;
        b.age += ctx.dt;
        const k = 1 - b.age / BEAM_FADE_S;
        if (k <= 0) {
          b.active = false;
          b.mesh.visible = false;
        } else {
          b.mesh.scale.x = k;
          b.mesh.scale.z = k;
        }
      }

      timer -= ctx.dt;
      if (timer > 0) return;

      const L = levelStats();
      const inRange = ctx.enemies
        .filter((e) => dist2D(ctx.player, e.pos) <= L.range)
        .sort(
          (a, b) =>
            dist2D(ctx.player, a.pos) - dist2D(ctx.player, b.pos) || a.id - b.id,
        );
      if (inRange.length === 0) {
        timer = RETRY_S;
        return;
      }

      const targets = inRange.slice(0, Math.min(L.jets, BEAM_COUNT));
      const dmg = L.damage * ctx.stats.damageMult;
      targets.forEach((e, i) => {
        ctx.damage(e.id, dmg);
        aimBeam(beams[i], ctx.player, e);
      });
      ctx.playSfx('shoot');
      timer = L.cooldownS * ctx.stats.cooldownMult;
    },
    dispose() {
      for (const b of beams) {
        scene.remove(b.mesh);
        b.active = false;
      }
      beams.length = 0;
      geometry.dispose();
      material.dispose();
    },
  };
}
