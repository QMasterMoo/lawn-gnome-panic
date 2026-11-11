// src/camera.ts
import * as THREE from 'three';
import { TUNING, type CameraRig, type InputState } from './config';

export function createCameraRig(camera: THREE.PerspectiveCamera): CameraRig {
  let snap = true;
  const desired = new THREE.Vector3();

  const rig: CameraRig = {
    yaw: 0,
    pitch: TUNING.cameraPitchDefault,
    update(target: THREE.Vector3, input: InputState, dt: number) {
      rig.yaw -= input.lookX;
      rig.pitch = Math.min(
        TUNING.cameraPitchMax,
        Math.max(TUNING.cameraPitchMin, rig.pitch + input.lookY),
      );

      const d = TUNING.cameraDistance;
      const cp = Math.cos(rig.pitch);
      desired.set(
        target.x - Math.sin(rig.yaw) * cp * d,
        target.y + 1 + Math.sin(rig.pitch) * d,
        target.z - Math.cos(rig.yaw) * cp * d,
      );
      desired.y = Math.max(desired.y, 0.5);

      if (snap) {
        camera.position.copy(desired);
        snap = false;
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-10 * dt));
      }
      camera.lookAt(target.x, target.y + 1, target.z);
    },
    reset(yaw: number) {
      rig.yaw = yaw;
      rig.pitch = TUNING.cameraPitchDefault;
      snap = true;
    },
  };
  return rig;
}
