// src/terrain.ts
// The shape of the lawn. Everything that stands on the ground asks heightAt(x, z).
// Pure and deterministic: no state, cheap enough to call per object per frame.
import * as THREE from 'three';
import { ARENA_HALF } from './config';

/** Big landmark mounds (and one dip): centre, radius, height in units (gnome ~1.4 tall). */
const FEATURES: readonly { x: number; z: number; r: number; h: number }[] = [
  { x: -90, z: 60, r: 35, h: 9 },
  { x: 110, z: -70, r: 40, h: 11 },
  { x: 60, z: 140, r: 30, h: 7 },
  { x: -150, z: -120, r: 45, h: 12 },
  { x: -170, z: 150, r: 32, h: 8 },
  { x: 160, z: 170, r: 28, h: 6 },
  { x: 140, z: 90, r: 30, h: -4 }, // a shallow dip
];

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 0 where the ground must stay flat (the start area and near the fences and house), 1 in the open lawn. */
function flatMask(x: number, z: number): number {
  const fromStart = smoothstep(30, 60, Math.hypot(x, z));
  const fromEdge = smoothstep(4, 24, ARENA_HALF - Math.max(Math.abs(x), Math.abs(z)));
  return fromStart * fromEdge;
}

/** Ground height at (x, z). 0 on the flat parts; roughly -4..+16 elsewhere. */
export function heightAt(x: number, z: number): number {
  const m = flatMask(x, z);
  if (m <= 0) return 0;
  let h =
    2.2 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.4) +
    1.3 * Math.sin(x * 0.047 + z * 0.031) +
    0.6 * Math.sin(x * 0.11 - z * 0.09);
  for (const f of FEATURES) {
    const d2 = (x - f.x) * (x - f.x) + (z - f.z) * (z - f.z);
    h += f.h * Math.exp(-d2 / (f.r * f.r));
  }
  return h * m;
}

/** Ground normal at (x, z), written into `out` (also returned). */
export function normalAt(x: number, z: number, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
  const e = 0.5;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return out.set(-dx, 2 * e, -dz).normalize();
}
