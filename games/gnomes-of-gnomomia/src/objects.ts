// World objects: valves, statues, signs and the like that the player can use. Stub until epic 2.
import type * as THREE from 'three';
import type { ZoneId } from './config';

/** Places a zone's objects in the scene. Empty until epic 2. */
export function spawnZoneObjects(scene: THREE.Scene, zone: ZoneId): void {
  void scene;
  void zone;
}

/** Uses an object (the verb from its definition). Empty until epic 2. */
export function useObject(objectId: string): void {
  void objectId;
}

/** The object id a mesh belongs to, or null. Always null until epic 2. */
export function objectFromMesh(obj: THREE.Object3D): string | null {
  void obj;
  return null;
}
