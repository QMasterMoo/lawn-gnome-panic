// STUB: the player's gnome, click-to-move and walking to an interaction. Replaced in epic 2.
import * as THREE from 'three';
import type { GnomeModel } from '@lawn/gnome';
import { SPAWN } from './config';

export type PlayerAction = { type: 'attack' | 'talk' | 'take'; target: number };

export const player: {
  position: THREE.Vector3;
  facing: number;
  /** Current interaction; null = idle or just walking. combat.ts swings while action.type === 'attack' and in range. */
  action: PlayerAction | null;
  /** Remaining waypoints. */
  path: { x: number; z: number }[];
  model: GnomeModel | null;
  dead: boolean;
  /** Seconds left of the weapon-swing animation; combat.ts sets it to 0.35 on each swing or cast. */
  swing: number;
} = { position: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), facing: 0, action: null, path: [], model: null, dead: false, swing: 0 };

export function createPlayer(_scene: THREE.Scene): void {}
/** Walk to a ground point; cancels any action. */
export function walkTo(_x: number, _z: number): void {}
/** Walk to an entity and then attack / talk / take. */
export function interact(_type: PlayerAction['type'], _entityId: number): void {}
/** Stop moving and drop the action. */
export function stopPlayer(): void {}
/** Place the player (respawn, load). */
export function teleportPlayer(_x: number, _z: number): void {}
export function updatePlayer(_dt: number): void {}
