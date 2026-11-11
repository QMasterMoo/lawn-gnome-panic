// src/pickups.ts
import * as THREE from 'three';
import { ARENA_HALF, COLORS, OBSTACLES, TUNING, type Obstacle, type PickupSystem } from './config';

// Shared geometries and materials for every acorn.
const nutGeometry = new THREE.SphereGeometry(0.2, 16, 12);
const nutMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.acorn,
  metalness: 0.3,
  roughness: 0.4,
  emissive: 0x553300,
});
const capGeometry = new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const capMaterial = new THREE.MeshStandardMaterial({ color: COLORS.acornCap });
const stemGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8);
const stemMaterial = new THREE.MeshStandardMaterial({ color: COLORS.acornCap });

function buildAcorn(): THREE.Group {
  const group = new THREE.Group();

  const nut = new THREE.Mesh(nutGeometry, nutMaterial);
  nut.scale.y = 1.25;
  nut.castShadow = true;
  group.add(nut);

  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = 0.12;
  cap.castShadow = true;
  group.add(cap);

  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.y = 0.3;
  stem.castShadow = true;
  group.add(stem);

  return group;
}

interface Acorn {
  group: THREE.Group;
  baseY: number;
  phase: number;
}

const SPAWN_TRIES = 20;
const MIN_ACORN_SPACING = 1.5;
const PLAYER_PICKUP_REACH = 0.9;

export function createPickupSystem(scene: THREE.Scene): PickupSystem {
  let acorns: Acorn[] = [];
  let t = 0;
  let timer = 0.5;

  function randomGroundPoint(): { x: number; z: number } {
    const span = ARENA_HALF - 2;
    return { x: (Math.random() * 2 - 1) * span, z: (Math.random() * 2 - 1) * span };
  }

  function farFromObstacles(x: number, z: number): boolean {
    return OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + 1);
  }

  function farFromAcorns(x: number, y: number, z: number): boolean {
    return acorns.every((a) => {
      const p = a.group.position;
      return Math.hypot(x - p.x, y - p.y, z - p.z) > MIN_ACORN_SPACING;
    });
  }

  function spawnOne(): void {
    for (let i = 0; i < SPAWN_TRIES; i++) {
      if (Math.random() < TUNING.pickupOnObstacleChance) {
        const o: Obstacle = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
        const y = o.height + 0.5;
        if (!farFromAcorns(o.x, y, o.z)) continue;
        place(o.x, y, o.z);
        return;
      }
      const { x, z } = randomGroundPoint();
      if (!farFromObstacles(x, z)) continue;
      if (!farFromAcorns(x, 0.5, z)) continue;
      place(x, 0.5, z);
      return;
    }
    // No free spot found within the try budget: skip this spawn.
  }

  function place(x: number, y: number, z: number): void {
    const group = buildAcorn();
    group.position.set(x, y, z);
    scene.add(group);
    acorns.push({ group, baseY: y, phase: Math.random() * Math.PI * 2 });
  }

  function removeAcorn(a: Acorn): void {
    scene.remove(a.group);
  }

  return {
    update(dt: number, playerFeet: THREE.Vector3): number {
      t += dt;
      timer -= dt;
      if (timer <= 0 && acorns.length < TUNING.pickupMax) {
        spawnOne();
        timer = TUNING.pickupSpawnS;
      }

      const reach = new THREE.Vector3(playerFeet.x, playerFeet.y + 0.5, playerFeet.z);
      let collected = 0;

      for (let i = acorns.length - 1; i >= 0; i--) {
        const a = acorns[i];
        a.group.position.y = a.baseY + Math.sin(t * 3 + a.phase) * 0.12;
        a.group.rotation.y += 2 * dt;

        if (a.group.position.distanceTo(reach) < PLAYER_PICKUP_REACH) {
          removeAcorn(a);
          acorns.splice(i, 1);
          collected++;
        }
      }

      return collected;
    },
    reset(): void {
      for (const a of acorns) removeAcorn(a);
      acorns = [];
      timer = 0.5;
    },
  };
}
