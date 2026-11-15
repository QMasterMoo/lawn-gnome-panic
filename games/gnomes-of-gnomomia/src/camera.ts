// STUB: RuneScape-style orbit camera. Replaced in epic 2.
import type * as THREE from 'three';

let cam: THREE.PerspectiveCamera | null = null;

export function initCamera(camera: THREE.PerspectiveCamera, _canvas: HTMLCanvasElement): void {
  cam = camera;
}
export function updateCamera(_dt: number, target: THREE.Vector3): void {
  if (!cam) return;
  cam.position.set(target.x, target.y + 10, target.z + 12);
  cam.lookAt(target);
}
