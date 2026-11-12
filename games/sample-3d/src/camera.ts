import { heightAt } from './terrain';
// src/camera.ts
import * as THREE from 'three';
import { TUNING, type CameraRig, type CameraView, type InputState } from './config';

/** Third person (behind and above), first person (from the gnome's eyes) or top-down. */
export function createCameraRig(camera: THREE.PerspectiveCamera): CameraRig {
  let snap = true;
  let lastView: CameraView = 'third';
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();

  const rig: CameraRig = {
    yaw: 0,
    pitch: TUNING.cameraPitchDefault,
    view: 'third',
    update(target: THREE.Vector3, input: InputState, dt: number) {
      if (rig.view !== lastView) {
        // Each view keeps its own sensible pitch range; snap so the switch is instant.
        lastView = rig.view;
        rig.pitch = rig.view === 'first' ? 0 : TUNING.cameraPitchDefault;
        snap = true;
      }
      // Top-down is fixed: no turning, so the map never spins under you.
      if (rig.view !== 'top') rig.yaw -= input.lookX;
      const sy = Math.sin(rig.yaw);
      const cy = Math.cos(rig.yaw);

      if (rig.view === 'first') {
        // lookY > 0 (mouse down) looks down.
        rig.pitch = Math.min(1.3, Math.max(-1.3, rig.pitch + input.lookY));
        const cp = Math.cos(rig.pitch);
        camera.position.set(target.x + sy * 0.2, target.y + 1.15, target.z + cy * 0.2);
        look.set(camera.position.x + sy * cp, camera.position.y - Math.sin(rig.pitch), camera.position.z + cy * cp);
        camera.lookAt(look);
        snap = false;
        return;
      }

      if (rig.view === 'top') {
        // High overhead, slightly behind, so "up" on screen is the way you are facing.
        desired.set(target.x - sy * 9, target.y + 32, target.z - cy * 9);
      } else {
        rig.pitch = Math.min(TUNING.cameraPitchMax, Math.max(TUNING.cameraPitchMin, rig.pitch + input.lookY));
        const d = TUNING.cameraDistance;
        const cp = Math.cos(rig.pitch);
        desired.set(target.x - sy * cp * d, target.y + 1 + Math.sin(rig.pitch) * d, target.z - cy * cp * d);
        desired.y = Math.max(desired.y, heightAt(desired.x, desired.z) + 0.6); // never inside a hill
      }

      if (snap) {
        camera.position.copy(desired);
        snap = false;
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-10 * dt));
      }
      camera.lookAt(target.x, target.y + (rig.view === 'top' ? 0 : 1), target.z);
    },
    reset(yaw: number) {
      rig.yaw = yaw;
      rig.pitch = rig.view === 'first' ? 0 : TUNING.cameraPitchDefault;
      snap = true;
    },
  };
  return rig;
}
