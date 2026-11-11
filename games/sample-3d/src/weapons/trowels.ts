import * as THREE from 'three';
import type { Weapon, WeaponContext, TrowelLevel } from '../config';
import { COLORS, TROWEL_LEVELS } from '../config';

const BLADE_GEO = new THREE.BoxGeometry(0.45, 0.03, 0.14);
const BLADE_MAT = new THREE.MeshStandardMaterial({ color: COLORS.trowel, metalness: 0.8, roughness: 0.3 });
const HANDLE_GEO = new THREE.CylinderGeometry(0.04, 0.04, 0.25);
const HANDLE_MAT = new THREE.MeshStandardMaterial({ color: COLORS.reelWood });

function dist2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

function buildTrowel(): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(BLADE_GEO, BLADE_MAT);
  blade.position.x = 0.35;
  const handle = new THREE.Mesh(HANDLE_GEO, HANDLE_MAT);
  handle.rotation.z = Math.PI / 2;
  handle.position.x = 0.05;
  g.add(blade, handle);
  return g;
}

export function createTrowels(scene: THREE.Scene): Weapon {
  let level = 1;
  let angle = 0;
  const meshes: THREE.Group[] = [];
  const cooldowns = new Map<number, number>();
  const cur = (): TrowelLevel => TROWEL_LEVELS[level - 1];

  return {
    id: 'trowels',
    setLevel(lv: number) {
      level = lv;
    },
    update(ctx: WeaponContext) {
      const L = cur();

      while (meshes.length < L.count) {
        const g = buildTrowel();
        scene.add(g);
        meshes.push(g);
      }
      while (meshes.length > L.count) {
        const g = meshes.pop()!;
        scene.remove(g);
      }

      angle += 2 * Math.PI * L.revPerSec * ctx.dt;
      const count = meshes.length;
      for (let i = 0; i < count; i++) {
        const a = angle + (i * 2 * Math.PI) / count;
        meshes[i].position.set(
          ctx.player.x + Math.cos(a) * L.radius,
          ctx.player.y + 0.55,
          ctx.player.z + Math.sin(a) * L.radius,
        );
        meshes[i].rotation.y = -a;
      }

      for (const [id, t] of cooldowns) {
        const next = t - ctx.dt;
        if (next <= 0) cooldowns.delete(id);
        else cooldowns.set(id, next);
      }

      const damage = L.damage * ctx.stats.damageMult;
      for (const g of meshes) {
        for (const e of ctx.enemies) {
          if (cooldowns.has(e.id)) continue;
          if (dist2D(g.position.x, g.position.z, e.pos.x, e.pos.z) < e.radius + 0.35) {
            ctx.damage(e.id, damage);
            cooldowns.set(e.id, L.hitCooldownS);
          }
        }
      }
    },
    dispose() {
      for (const g of meshes) scene.remove(g);
      meshes.length = 0;
      cooldowns.clear();
    },
  };
}
