import * as THREE from 'three';
import { WIND_CHIME_LULLABY_LEVELS } from '../config';
import type { Weapon, WeaponContext } from '../config';

const BRASS = 0xd4af37;
const RING_COLOR = 0xcfe8ff;
const RING_OPACITY = 0.5;
const RING_START_RADIUS = 0.2;
const RING_S = 0.8;
const RETRY_S = 0.2;
const HANG_Y = 1.6;
const TUBE_LEN = 0.5;
const TUBE_X = [-0.15, -0.05, 0.05, 0.15];

function dist2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function createWindChimeLullaby(scene: THREE.Scene): Weapon {
  let level = 1;
  let timer = 1;
  let time = 0;
  let ringAge = -1; // < 0 when the ring is idle

  const levelStats = () => WIND_CHIME_LULLABY_LEVELS[level - 1];

  // Chime: a brass bar with four swaying tubes hanging from it.
  const barGeometry = new THREE.BoxGeometry(0.4, 0.02, 0.02);
  const barMaterial = new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.8, roughness: 0.3 });
  const tubeGeometry = new THREE.CylinderGeometry(0.015, 0.015, TUBE_LEN, 6);
  const tubeMaterial = new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.8, roughness: 0.3 });

  const chime = new THREE.Group();
  const bar = new THREE.Mesh(barGeometry, barMaterial);
  chime.add(bar);
  const pivots: THREE.Group[] = [];
  for (const x of TUBE_X) {
    const pivot = new THREE.Group(); // pivots at the hang point so the tube swings from its top
    pivot.position.set(x, 0, 0);
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.position.y = -TUBE_LEN / 2;
    pivot.add(tube);
    chime.add(pivot);
    pivots.push(pivot);
  }
  scene.add(chime);

  // Shared expanding ring, unit radius and scaled per cast.
  const ringGeometry = new THREE.RingGeometry(0.95, 1, 48);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: RING_COLOR,
    transparent: true,
    opacity: RING_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  scene.add(ring);

  return {
    id: 'windChimeLullaby',
    setLevel(l: number) {
      level = Math.min(WIND_CHIME_LULLABY_LEVELS.length, Math.max(1, Math.round(l)));
    },
    update(ctx: WeaponContext) {
      time += ctx.dt;

      // Follow the player and sway the tubes.
      chime.position.set(ctx.player.x, ctx.player.y + HANG_Y, ctx.player.z);
      for (const p of pivots) p.rotation.z = 0.1 * Math.sin(3 * time);

      // Ring expansion and fade.
      if (ringAge >= 0) {
        ringAge += ctx.dt;
        const k = Math.min(ringAge / RING_S, 1);
        const L = levelStats();
        const s = RING_START_RADIUS + (L.radius - RING_START_RADIUS) * k;
        ring.scale.set(s, s, 1);
        ringMaterial.opacity = RING_OPACITY * (1 - k);
        if (k >= 1) {
          ring.visible = false;
          ringAge = -1;
        }
      }

      timer -= ctx.dt;
      if (timer > 0) return;

      const L = levelStats();
      const candidates = ctx.enemies
        .filter((e) => dist2D(ctx.player, e.pos) < L.radius + e.radius)
        .sort((a, b) => a.hp - b.hp || a.id - b.id);
      if (candidates.length === 0) {
        timer = RETRY_S;
        return;
      }

      // Take enemies weakest first until the next one would overflow the pool.
      let sum = 0;
      for (const e of candidates) {
        if (sum + e.hp > L.poolHp) break;
        sum += e.hp;
        ctx.slow(e.id, L.slowFactor, L.slowS);
      }

      ctx.playSfx('pickup');
      ring.position.set(ctx.player.x, 0.06, ctx.player.z);
      ring.scale.set(RING_START_RADIUS, RING_START_RADIUS, 1);
      ringMaterial.opacity = RING_OPACITY;
      ring.visible = true;
      ringAge = 0;
      timer = L.cooldownS * ctx.stats.cooldownMult;
    },
    dispose() {
      scene.remove(chime);
      scene.remove(ring);
      barGeometry.dispose();
      barMaterial.dispose();
      tubeGeometry.dispose();
      tubeMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
  };
}
