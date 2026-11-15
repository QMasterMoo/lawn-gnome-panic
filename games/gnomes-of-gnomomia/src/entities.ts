// STUB: NPCs, enemies and loot piles in the world, with enemy AI. Replaced in epic 2.
import type * as THREE from 'three';
import type { Entity, InvSlot } from './config';

/** Spawns every NPC in NPCS and every enemy in SPAWN_GROUPS. Call once after buildWorld. */
export function spawnWorldEntities(_scene: THREE.Scene): void {}
export function updateEntities(_dt: number): void {}
export function getEntity(_id: number): Entity | undefined {
  return undefined;
}
/** Every live entity (dead enemies included, check .dead). */
export function allEntities(): readonly Entity[] {
  return [];
}
/** The entity a raycast hit belongs to (walks up parents for userData.entityId). */
export function entityFromObject(_obj: THREE.Object3D): Entity | undefined {
  return undefined;
}
/** Kill an enemy: death pose, loot pile, 'enemy-killed', respawn timer. */
export function killEntity(_id: number): void {}
export function spawnLoot(_x: number, _z: number, _items: InvSlot[], _gold: number): Entity | null {
  return null;
}
/** Remove an entity (a looted pile) from the world for good. */
export function removeEntity(_id: number): void {}
