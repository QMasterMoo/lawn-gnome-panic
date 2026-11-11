import * as THREE from 'three';
import { COLORS, MUSHROOM_LEVELS } from '../config';
import type { Weapon, WeaponContext } from '../config';

const BLAST_S = 0.3;

interface Mine {
  group: THREE.Group;
  cap: THREE.Mesh;
  x: number;
  z: number;
  armS: number;
  phase: number;
}

/** A transient visual. step(dt) returns true once it has finished. */
interface Effect {
  group: THREE.Group;
  step(dt: number): boolean;
}

function dist2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.geometry.dispose();
      const mat = mesh.material;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
    }
  });
}

function buildMine(scene: THREE.Scene, x: number, z: number, armS: number, phase: number): Mine {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.18),
    new THREE.MeshStandardMaterial({ color: COLORS.mushroomStem }),
  );
  stem.position.y = 0.09;
  stem.castShadow = true;
  group.add(stem);

  // Dome: upper hemisphere of a sphere, centred at y 0.15.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: COLORS.mushroomCap }),
  );
  cap.position.y = 0.15;
  cap.castShadow = true;
  group.add(cap);

  // Four white spots on the dome surface; children of the cap so they pulse with it.
  const spotGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const polar = 0.6;
  const R = 0.21;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.position.set(R * Math.sin(polar) * Math.cos(a), R * Math.cos(polar), R * Math.sin(polar) * Math.sin(a));
    spot.castShadow = true;
    cap.add(spot);
  }

  scene.add(group);
  return { group, cap, x, z, armS, phase };
}

function makeBlast(scene: THREE.Scene, x: number, z: number, blastRadius: number): Effect {
  const material = new THREE.MeshBasicMaterial({
    color: 0xff9800,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
  sphere.position.set(x, 0.3, z);
  const group = new THREE.Group();
  group.add(sphere);
  scene.add(group);

  let age = 0;
  return {
    group,
    step(dt: number): boolean {
      age += dt;
      const k = Math.min(age / BLAST_S, 1);
      const s = 0.2 + (blastRadius - 0.2) * k;
      sphere.scale.setScalar(s);
      material.opacity = 0.8 * (1 - k);
      return age >= BLAST_S;
    },
  };
}

function removeEffect(scene: THREE.Scene, effect: Effect): void {
  scene.remove(effect.group);
  disposeGroup(effect.group);
}

export function createMushrooms(scene: THREE.Scene): Weapon {
  let level = 1;
  let timer = 1;
  let time = 0;
  const mines: Mine[] = [];
  const effects: Effect[] = [];
  const levelStats = () => MUSHROOM_LEVELS[level - 1];

  const removeMine = (m: Mine) => {
    scene.remove(m.group);
    disposeGroup(m.group);
  };

  return {
    id: 'mushrooms',
    setLevel(l: number) {
      level = Math.min(MUSHROOM_LEVELS.length, Math.max(1, Math.round(l)));
    },
    update(ctx: WeaponContext) {
      time += ctx.dt;

      for (let i = effects.length - 1; i >= 0; i--) {
        if (effects[i].step(ctx.dt)) {
          removeEffect(scene, effects[i]);
          effects.splice(i, 1);
        }
      }

      const L = levelStats();

      timer -= ctx.dt;
      if (timer <= 0) {
        timer = L.cooldownS * ctx.stats.cooldownMult;
        if (mines.length < L.maxMines) {
          mines.push(buildMine(scene, ctx.player.x, ctx.player.z, L.armS, Math.random() * Math.PI * 2));
        }
      }

      for (let i = mines.length - 1; i >= 0; i--) {
        const m = mines[i];

        if (m.armS > 0) {
          m.armS -= ctx.dt;
          m.cap.scale.setScalar(0.8 + 0.2 * Math.sin(time * 20));
          continue;
        }

        m.cap.scale.setScalar(1);
        m.group.position.y = 0.02 + Math.sin(time * 3 + m.phase) * 0.02;

        const armedByEnemy = ctx.enemies.some((e) => dist2D(m, e.pos) < L.triggerRadius + e.radius);
        if (!armedByEnemy) continue;

        for (const e of ctx.enemies) {
          if (dist2D(m, e.pos) - e.radius < L.blastRadius) {
            ctx.damage(e.id, L.damage * ctx.stats.damageMult);
          }
        }
        ctx.playSfx('boom');
        removeMine(m);
        mines.splice(i, 1);
        effects.push(makeBlast(scene, m.x, m.z, L.blastRadius));
      }
    },
    dispose() {
      for (const m of mines) removeMine(m);
      mines.length = 0;
      for (const e of effects) removeEffect(scene, e);
      effects.length = 0;
    },
  };
}
