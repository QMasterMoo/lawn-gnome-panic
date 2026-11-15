// STUB: terrain, scenery, lights and collision. Replaced in epic 2.
import * as THREE from 'three';
import { TUNING } from './config';

let ground: THREE.Mesh | null = null;

/** Builds the ground, water, scenery, sky colour, fog and lights into the scene. Call once. */
export function buildWorld(scene: THREE.Scene): void {
  ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5f9e3f }));
  scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445522, 2));
}

/** Ground height at (x, z). Deterministic and cheap. */
export function heightAt(_x: number, _z: number): number {
  return 0;
}

/** True where a walker may not stand: outside the world, in water, or inside a house, tree, rock or the well. */
export function isBlocked(x: number, z: number): boolean {
  return Math.abs(x) > TUNING.worldHalf - 1 || Math.abs(z) > TUNING.worldHalf - 1;
}

/** The ground mesh, for raycasting clicks. */
export function getGroundMesh(): THREE.Object3D {
  if (!ground) throw new Error('buildWorld first');
  return ground;
}

/** Name of the region containing (x, z), or 'the Wilds'. */
export function regionNameAt(_x: number, _z: number): string {
  return 'the Wilds';
}
