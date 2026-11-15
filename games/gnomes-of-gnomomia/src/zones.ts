// Zones: which map is loaded and where the player arrives. Stub until epic 2 (the zone loader and exits).
import type * as THREE from 'three';
import type { ZoneDef, ZoneId } from './config';
import { ZONES } from './content';
import { state } from './state';

let sceneRef: THREE.Scene | null = null;

/** The definition of the zone the player is in. */
export function currentZone(): ZoneDef {
  return ZONES[state.zone];
}

/** Switches zones. Empty until epic 2. */
export function loadZone(id: ZoneId, x?: number, z?: number): void {
  void id;
  void x;
  void z;
}

/** Keeps the scene the zones are built into. Call once. */
export function initZones(scene: THREE.Scene): void {
  sceneRef = scene;
}

/** Per-frame zone work (exits, zone events). Empty until epic 2. */
export function updateZones(dt: number): void {
  void dt;
  void sceneRef;
}
