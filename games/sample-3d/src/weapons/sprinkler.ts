import * as THREE from 'three';
import { COLORS, SPRINKLER_LEVELS } from '../config';
import type { Weapon, WeaponContext } from '../config';

const PULSE_S = 0.4;
const DROPLET_S = 0.5;
const DROPLET_COUNT = 10;
const GRAVITY = 15;

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

function removeEffect(scene: THREE.Scene, effect: Effect): void {
  scene.remove(effect.group);
  disposeGroup(effect.group);
}

function makePulse(scene: THREE.Scene, x: number, z: number, radius: number): Effect {
  const material = new THREE.MeshBasicMaterial({
    color: COLORS.water,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.06, z);
  const group = new THREE.Group();
  group.add(ring);
  scene.add(group);

  let age = 0;
  return {
    group,
    step(dt: number): boolean {
      age += dt;
      const k = Math.min(age / PULSE_S, 1);
      const s = 0.2 + (radius - 0.2) * k;
      ring.scale.set(s, s, 1);
      material.opacity = 0.8 * (1 - k);
      return age >= PULSE_S;
    },
  };
}

function makeDroplets(scene: THREE.Scene, x: number, z: number): Effect {
  const material = new THREE.MeshBasicMaterial({ color: COLORS.water });
  const geometry = new THREE.SphereGeometry(0.06, 8, 6);
  const group = new THREE.Group();
  scene.add(group);

  const drops: { mesh: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
  for (let i = 0; i < DROPLET_COUNT; i++) {
    const angle = (i / DROPLET_COUNT) * Math.PI * 2;
    const speed = 5 + Math.random() * 3;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0.4, z);
    group.add(mesh);
    drops.push({ mesh, vx: Math.cos(angle) * speed, vy: 3, vz: Math.sin(angle) * speed });
  }

  let age = 0;
  return {
    group,
    step(dt: number): boolean {
      age += dt;
      for (const d of drops) {
        d.vy -= GRAVITY * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
      }
      return age >= DROPLET_S;
    },
  };
}

export function createSprinkler(scene: THREE.Scene): Weapon {
  let level = 1;
  let timer = 1;
  const effects: Effect[] = [];
  const levelStats = () => SPRINKLER_LEVELS[level - 1];

  return {
    id: 'sprinkler',
    setLevel(l: number) {
      level = Math.min(SPRINKLER_LEVELS.length, Math.max(1, Math.round(l)));
    },
    update(ctx: WeaponContext) {
      for (let i = effects.length - 1; i >= 0; i--) {
        if (effects[i].step(ctx.dt)) {
          removeEffect(scene, effects[i]);
          effects.splice(i, 1);
        }
      }

      timer -= ctx.dt;
      if (timer > 0) return;

      const L = levelStats();
      const targets = ctx.enemies.filter((e) => dist2D(ctx.player, e.pos) < L.radius + e.radius);
      if (targets.length === 0) {
        timer = 0.2;
        return;
      }

      for (const e of targets) {
        ctx.damage(e.id, L.damage * ctx.stats.damageMult);
        ctx.slow(e.id, L.slowFactor, L.slowS);
      }
      ctx.playSfx('splash');
      effects.push(makePulse(scene, ctx.player.x, ctx.player.z, L.radius));
      effects.push(makeDroplets(scene, ctx.player.x, ctx.player.z));
      timer = L.cooldownS * ctx.stats.cooldownMult;
    },
    dispose() {
      for (const e of effects) removeEffect(scene, e);
      effects.length = 0;
    },
  };
}
