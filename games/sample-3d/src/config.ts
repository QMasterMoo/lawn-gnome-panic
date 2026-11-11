import type * as THREE from 'three';

/** The lawn spans -ARENA_HALF..ARENA_HALF on x and z. */
export const ARENA_HALF = 20;
export const PLAYER_RADIUS = 0.4;
export const MOWER_RADIUS = 0.9;
/** A player whose feet are at or above this height clears a mower. */
export const MOWER_HEIGHT = 0.7;

export const COLORS = {
  sky: 0x9ad7ff,
  grass: 0x4f9a35,
  grassMowed: 0x7cc456,
  fence: 0xf2efe6,
  bush: 0x2f7a2f,
  stump: 0x7a5230,
  stone: 0x9e9e9e,
  gnomeHat: 0xd93636,
  gnomeBeard: 0xf4f4f4,
  gnomeSkin: 0xf1c27d,
  gnomeShirt: 0x2f64c9,
  gnomePants: 0x6b4a2e,
  mowerBody: 0xd8342c,
  mowerDark: 0x222222,
  acorn: 0xd4a017,
  acornCap: 0x6b4a2e,
} as const;

/** Gameplay tuning. Change these to change the feel. */
export const TUNING = {
  moveSpeed: 6,              // m/s on the ground
  accel: 40,                 // m/s^2 toward the wished velocity
  airControl: 0.5,           // fraction of accel while airborne
  turnSpeed: 12,             // rad/s the gnome turns to face his movement
  jumpSpeed: 7,              // m/s upward on each jump
  gravity: 20,               // m/s^2
  maxJumps: 2,               // 2 = double jump
  cameraDistance: 7,
  cameraPitchDefault: 0.35,  // radians above horizontal
  cameraPitchMin: -0.1,
  cameraPitchMax: 1.2,
  cameraLookSensitivity: 0.0025, // radians per mouse pixel
  cameraKeyTurnSpeed: 2.5,   // rad/s for Q/E and the right stick
  mowerSpeedStart: 3,
  mowerSpeedMax: 7.5,
  mowerSpeedRampPerSec: 0.05,
  mowerTurnRate: 1.6,        // rad/s: how fast a mower can steer
  mowerSpawnStartS: 4,
  mowerSpawnMinS: 1.5,
  mowerSpawnRampPerSec: 0.03,
  mowerMax: 8,
  pickupSpawnS: 2.5,
  pickupMax: 5,
  pickupOnObstacleChance: 0.3,
  pickupScore: 10,
  survivalScorePerSec: 1,    // only while on the grass
} as const;

export type ObstacleKind = 'stump' | 'rock' | 'bush' | 'birdbath';

/** A vertical cylinder from y=0 to y=height. Nothing may enter it from the side; the player may stand on top. */
export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  z: number;
  radius: number;
  height: number;
}

export const OBSTACLES: readonly Obstacle[] = [
  { kind: 'stump', x: -6, z: 4, radius: 0.7, height: 0.6 },
  { kind: 'stump', x: 8, z: -7, radius: 0.7, height: 0.6 },
  { kind: 'rock', x: 3, z: 9, radius: 0.9, height: 0.45 },
  { kind: 'rock', x: -10, z: -8, radius: 0.9, height: 0.45 },
  { kind: 'bush', x: 11, z: 6, radius: 1.3, height: 1.1 },
  { kind: 'bush', x: -12, z: 11, radius: 1.3, height: 1.1 },
  { kind: 'bush', x: 5, z: -13, radius: 1.3, height: 1.1 },
  { kind: 'birdbath', x: 0, z: -4, radius: 0.6, height: 1.2 },
];

/** Read once per frame. Edge flags are true only on the frame the button went down. */
export interface InputState {
  moveX: number;  // -1..1, +1 = right
  moveY: number;  // -1..1, +1 = forward
  jump: boolean;
  start: boolean;
  lookX: number;  // radians this frame, + = turn the view right
  lookY: number;  // radians this frame, + = raise the camera (look more downward)
}

export interface PlayerState {
  position: THREE.Vector3; // feet
  velocity: THREE.Vector3;
  facing: number;          // yaw
  grounded: boolean;
  jumpsUsed: number;
}

export interface CameraRig {
  yaw: number;
  pitch: number;
  /** Moves the camera behind and above target (the player's feet). */
  update(target: THREE.Vector3, input: InputState, dt: number): void;
  /** Sets yaw, resets pitch to the default, and snaps (no smoothing) on the next update. */
  reset(yaw: number): void;
}

export interface GnomeModel {
  object: THREE.Group;
  /** Copies position and facing from p and animates limbs from p.velocity and p.grounded. */
  update(p: PlayerState, dt: number): void;
  setDead(dead: boolean): void;
}

export interface World {
  /** Paints a mowed patch on the lawn at (x, z). Cheap to call every frame per mower. */
  markMowed(x: number, z: number): void;
  update(dt: number): void;
  /** Restores the unmowed lawn. */
  reset(): void;
}

export interface MowerSystem {
  update(dt: number, elapsedS: number, target: THREE.Vector3, obstacles: readonly Obstacle[], onMow: (x: number, z: number) => void): void;
  /** Current mower centres (y = 0). */
  positions(): readonly THREE.Vector3[];
  /** Horizontal distance from p to the nearest mower; Infinity if none. */
  nearestDistance(p: THREE.Vector3): number;
  /** Removes all mowers. */
  reset(): void;
}

export interface PickupSystem {
  /** Animates, spawns and collects acorns. Returns how many the player collected this frame. */
  update(dt: number, playerFeet: THREE.Vector3): number;
  /** Removes all acorns. */
  reset(): void;
}

export interface GameOverData {
  score: number;
  secondsSurvived: number;
  acorns: number;
}

export interface UI {
  showTitle(highScore: number): void;
  showHud(score: number, seconds: number, acorns: number): void;
  showGameOver(data: GameOverData, isNewHigh: boolean, highScore: number): void;
}

export type GamePhase = 'title' | 'playing' | 'gameover';
export type SfxName = 'start' | 'jump' | 'pickup' | 'hit';
export const STORAGE_KEY_HIGH_SCORE = 'sample-3d.highScore';
