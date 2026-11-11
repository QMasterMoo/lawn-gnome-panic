import * as THREE from 'three';
import { PITCHFORK_LEVELS } from '../config';
import type { Weapon, WeaponContext } from '../config';

const THRUST_S = 0.25;
const RETRY_S = 0.2;
const HOLD_HEIGHT = 0.8;

export function createPitchfork(scene: THREE.Scene): Weapon {
  let level = 1;
  let timer = 1;
  let thrustCount = 0;
  let thrustAge = THRUST_S; // >= THRUST_S means no thrust in progress
  let thrustReach = 0;
  let royalThrust = false;
  let started = false;

  const levelStats = () => PITCHFORK_LEVELS[level - 1];

  // Shared per-instance geometry and materials (disposed in dispose()).
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xaeb4bb, metalness: 0.6, roughness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.7, roughness: 0.3 });
  const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6);
  const crownGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.06, 8);
  const tineGeo = new THREE.BoxGeometry(0.03, 0.03, 0.5);

  const group = new THREE.Group();
  group.visible = false;
  const handle = new THREE.Mesh(handleGeo, woodMat);
  const crown = new THREE.Mesh(crownGeo, goldMat);
  crown.position.set(0, 0.73, 0);
  const tines: THREE.Mesh[] = [-1, 0, 1].map(() => new THREE.Mesh(tineGeo, steelMat));
  group.add(handle, crown, ...tines);
  scene.add(group);

  /** Spaces the three tines by the current halfWidth. */
  const layoutTines = () => {
    const hw = levelStats().halfWidth;
    [-hw, 0, hw].forEach((x, i) => {
      tines[i].position.set(x, 0.775, 0.25);
    });
  };
  layoutTines();

  return {
    id: 'pitchfork',
    setLevel(l: number) {
      level = Math.min(PITCHFORK_LEVELS.length, Math.max(1, Math.round(l)));
      layoutTines();
    },
    update(ctx: WeaponContext) {
      const L = levelStats();
      const fx = Math.sin(ctx.facing);
      const fz = Math.cos(ctx.facing);

      timer -= ctx.dt;
      if (timer <= 0) {
        // Forward f = (sin a, 0, cos a); side p = (cos a, 0, -sin a).
        const px = Math.cos(ctx.facing);
        const pz = -Math.sin(ctx.facing);
        const hits = ctx.enemies.filter((e) => {
          const dx = e.pos.x - ctx.player.x;
          const dz = e.pos.z - ctx.player.z;
          const along = dx * fx + dz * fz;
          const side = dx * px + dz * pz;
          return along >= -e.radius && along <= L.reach + e.radius && Math.abs(side) <= L.halfWidth + e.radius;
        });

        if (hits.length === 0) {
          timer = RETRY_S;
        } else {
          thrustCount++;
          royalThrust = thrustCount % L.royalEvery === 0;
          const amount = (royalThrust ? L.damage * L.royalMult : L.damage) * ctx.stats.damageMult;
          for (const e of hits) ctx.damage(e.id, amount);
          ctx.playSfx('hit');

          thrustAge = 0;
          thrustReach = L.reach;
          for (const t of tines) t.material = royalThrust ? goldMat : steelMat;
          timer = L.cooldownS * ctx.stats.cooldownMult;
        }
      }

      // Slide animation: reach * sin(pi t) over THRUST_S.
      let slide = 0;
      if (thrustAge < THRUST_S) {
        thrustAge = Math.min(thrustAge + ctx.dt, THRUST_S);
        const t = thrustAge / THRUST_S;
        slide = thrustReach * Math.sin(Math.PI * t);
        if (thrustAge >= THRUST_S) {
          for (const tn of tines) tn.material = steelMat;
          royalThrust = false;
        }
      }

      group.position.set(
        ctx.player.x + fx * slide,
        ctx.player.y + HOLD_HEIGHT,
        ctx.player.z + fz * slide,
      );
      group.rotation.y = ctx.facing;
      if (!started) {
        group.visible = true;
        started = true;
      }
    },
    dispose() {
      scene.remove(group);
      handleGeo.dispose();
      crownGeo.dispose();
      tineGeo.dispose();
      woodMat.dispose();
      steelMat.dispose();
      goldMat.dispose();
    },
  };
}
