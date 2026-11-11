# Roadmap: sample-3d (Lawn Gnome Panic)

## Goal

A 3D prototype in `games/sample-3d/`: a third-person game in the browser. A garden gnome runs around a fenced lawn, chased by lawn mowers that spawn faster and drive faster over time. He collects golden acorns, can jump (and double jump) over mowers and onto stumps, rocks, bushes and a birdbath. One touch from a mower ends the run ("MOWED!"). Mowers leave mowed stripes in the lawn. Title screen, HUD and game-over screen as an HTML overlay; high score in localStorage.

Everything is built in code: the gnome, the mowers and the acorns are made from three.js primitives and animated procedurally; sounds are WebAudio synth. No asset files, no physics engine (flat ground plus cylinder obstacles, hand-written collision).

Stack: Vite 8.3.8, TypeScript 7.0.2, three 0.187.0 (+ @types/three 0.187.0).

Conventions used everywhere:
- Y is up. The ground is y = 0. The lawn spans x and z from -ARENA_HALF to +ARENA_HALF.
- A yaw angle `a` (radians) means the forward vector `(sin a, 0, cos a)`. Yaw 0 faces +z. The right vector for yaw `a` is `(-cos a, 0, sin a)`. `object.rotation.y = a` turns a model built facing +z to face yaw `a`. The yaw from a direction (dx, dz) is `Math.atan2(dx, dz)`.
- Models are built facing +z with their feet/base at y = 0.

## Shape

| Epic | Done when | Issues |
|---|---|---|
| 1. Scaffold | The game builds; `config.ts` holds every shared type, constant and tuning value; `main.ts` holds the complete game loop; every module exists as a stub. | 1 |
| 2. Systems | Input and camera, player controller, gnome model, world, mowers, acorns, and UI/storage/audio are each done; the game plays end to end. | 7, parallel |

No dependencies inside an epic. Epic 2 issues each own different files and meet only through `src/config.ts` and `src/main.ts` (written in epic 1, read-only in epic 2).

---

## Epic 1: Scaffold

### 1.1 Scaffold games/sample-3d with config, game loop and stubs

~~~~text
Epic: 1 Scaffold
Depends on: none

## Environment
- Repository root: C:/Users/cstab/Documents/gaming (Git Bash path /c/Users/cstab/Documents/gaming). Run commands from the root.
- If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- The root package.json already declares npm workspaces "games/*". Do not edit it. games/sample-dodge is another game: do not edit it, but you may read games/sample-dodge/tsconfig.json and package.json as examples.
- You are the only worker in this epic.

## Goal
A buildable Vite + TypeScript + three.js project in games/sample-3d whose main.ts already contains the full game loop, written against stub modules that later workers fill in.

## Read first
- games/sample-dodge/package.json and games/sample-dodge/tsconfig.json: copy their shape.

## Change
- games/sample-3d/package.json: name "sample-3d", private true, type "module"; scripts "dev": "vite", "build": "tsc --noEmit && vite build", "preview": "vite preview", "typecheck": "tsc --noEmit"; dependencies "three": "0.187.0"; devDependencies "@types/three": "0.187.0", "typescript": "7.0.2", "vite": "8.3.8".
- games/sample-3d/tsconfig.json: same as games/sample-dodge/tsconfig.json.
- games/sample-3d/vite.config.ts: `import { defineConfig } from 'vite'; export default defineConfig({ base: './', server: { port: 5174 } });`
- games/sample-3d/index.html: title "Lawn Gnome Panic"; in <head> a <style>: `html,body{margin:0;height:100%;overflow:hidden;background:#9ad7ff}` `#game{display:block;width:100vw;height:100vh}` `#ui{position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff}`; body: `<canvas id="game"></canvas><div id="ui"></div><script type="module" src="/src/main.ts"></script>`.
- games/sample-3d/src/config.ts: EXACTLY the config.ts content under Contract.
- games/sample-3d/src/main.ts: EXACTLY the main.ts content under Contract.
- Stubs, EXACTLY as under Contract: src/input.ts, src/camera.ts, src/player.ts, src/gnome.ts, src/world.ts, src/mowers.ts, src/pickups.ts, src/ui.ts, src/storage.ts, src/audio.ts.
- games/sample-3d/CREDITS.md: "# Credits\n\nAll models, textures and sounds are generated in code. No external assets.\n"
- games/sample-3d/README.md: "# Lawn Gnome Panic" then one paragraph (a gnome dodging lawn mowers in 3D, collecting golden acorns), controls (WASD/arrows move, Space jump and double jump, mouse look after clicking the game or Q/E, gamepad supported), `npm run dev -w games/sample-3d` (http://localhost:5174), and that tuning lives in src/config.ts.
- Then run `npm install` from the repository root.

## Contract

src/config.ts, verbatim:

```ts
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
```

src/main.ts, verbatim:

```ts
import * as THREE from 'three';
import { COLORS, OBSTACLES, PLAYER_RADIUS, MOWER_RADIUS, MOWER_HEIGHT, TUNING, type GamePhase, type GameOverData } from './config';
import { createInput } from './input';
import { createCameraRig } from './camera';
import { createPlayerState, updatePlayer } from './player';
import { createGnome } from './gnome';
import { buildWorld } from './world';
import { createMowerSystem } from './mowers';
import { createPickupSystem } from './pickups';
import { createUI } from './ui';
import { getHighScore, submitScore } from './storage';
import { playSfx, setEngineLevel } from './audio';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.sky, 35, 80);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas);
const rig = createCameraRig(camera);
const world = buildWorld(scene);
const gnome = createGnome();
scene.add(gnome.object);
const mowers = createMowerSystem(scene);
const pickups = createPickupSystem(scene);
const ui = createUI(document.getElementById('ui') as HTMLElement);

let phase: GamePhase = 'title';
let player = createPlayerState();
let score = 0;
let elapsed = 0;
let acorns = 0;
let deadTimer = 0;

function startRound(): void {
  player = createPlayerState();
  score = 0;
  elapsed = 0;
  acorns = 0;
  mowers.reset();
  pickups.reset();
  world.reset();
  rig.reset(0);
  gnome.setDead(false);
  phase = 'playing';
  playSfx('start');
}

function endRound(): void {
  phase = 'gameover';
  deadTimer = 0;
  gnome.setDead(true);
  playSfx('hit');
  setEngineLevel(0);
  const data: GameOverData = { score: Math.floor(score), secondsSurvived: Math.floor(elapsed), acorns };
  const isNewHigh = submitScore(data.score);
  ui.showGameOver(data, isNewHigh, getHighScore());
}

ui.showTitle(getHighScore());

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const inp = input.read(dt);

  if (phase === 'playing') {
    elapsed += dt;
    const { jumped } = updatePlayer(player, inp, rig.yaw, OBSTACLES, dt);
    if (jumped) playSfx('jump');
    if (player.position.y < 0.05) score += TUNING.survivalScorePerSec * dt;

    mowers.update(dt, elapsed, player.position, OBSTACLES, (x, z) => world.markMowed(x, z));

    const got = pickups.update(dt, player.position);
    if (got > 0) {
      acorns += got;
      score += got * TUNING.pickupScore;
      playSfx('pickup');
    }

    setEngineLevel(Math.max(0, 1 - mowers.nearestDistance(player.position) / 15));

    for (const m of mowers.positions()) {
      const d = Math.hypot(m.x - player.position.x, m.z - player.position.z);
      if (d < PLAYER_RADIUS + MOWER_RADIUS && player.position.y < MOWER_HEIGHT) {
        endRound();
        break;
      }
    }
    if (phase === 'playing') ui.showHud(Math.floor(score), elapsed, acorns);
  } else {
    if (phase === 'gameover') deadTimer += dt;
    if (inp.start && (phase === 'title' || deadTimer > 0.6)) startRound();
  }

  gnome.update(player, dt);
  rig.update(player.position, inp, dt);
  world.update(dt);
  renderer.render(scene, camera);
});
```

Stubs, verbatim (exported names and signatures are final; later workers replace the bodies):

```ts
// src/input.ts
import type { InputState } from './config';
export function createInput(_canvas: HTMLCanvasElement): { read(dt: number): InputState } {
  return { read: () => ({ moveX: 0, moveY: 0, jump: false, start: false, lookX: 0, lookY: 0 }) };
}

// src/camera.ts
import * as THREE from 'three';
import { TUNING, type CameraRig, type InputState } from './config';
export function createCameraRig(camera: THREE.PerspectiveCamera): CameraRig {
  return {
    yaw: 0,
    pitch: TUNING.cameraPitchDefault,
    update(target: THREE.Vector3, _input: InputState, _dt: number) {
      camera.position.set(target.x, target.y + 3, target.z - 7);
      camera.lookAt(target.x, target.y + 1, target.z);
    },
    reset(yaw: number) { this.yaw = yaw; },
  };
}

// src/player.ts
import * as THREE from 'three';
import type { InputState, Obstacle, PlayerState } from './config';
export function createPlayerState(): PlayerState {
  return { position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3(), facing: 0, grounded: true, jumpsUsed: 0 };
}
export function updatePlayer(_p: PlayerState, _input: InputState, _cameraYaw: number, _obstacles: readonly Obstacle[], _dt: number): { jumped: boolean } {
  return { jumped: false };
}

// src/gnome.ts
import * as THREE from 'three';
import { COLORS, type GnomeModel, type PlayerState } from './config';
export function createGnome(): GnomeModel {
  const object = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 12), new THREE.MeshStandardMaterial({ color: COLORS.gnomeHat }));
  body.position.y = 0.6;
  object.add(body);
  return {
    object,
    update(p: PlayerState, _dt: number) { object.position.copy(p.position); object.rotation.y = p.facing; },
    setDead(_dead: boolean) {},
  };
}

// src/world.ts
import * as THREE from 'three';
import { ARENA_HALF, COLORS, type World } from './config';
export function buildWorld(scene: THREE.Scene): World {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x447744, 1.5));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2), new THREE.MeshStandardMaterial({ color: COLORS.grass }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return { markMowed(_x: number, _z: number) {}, update(_dt: number) {}, reset() {} };
}

// src/mowers.ts
import * as THREE from 'three';
import type { MowerSystem, Obstacle } from './config';
export function createMowerSystem(_scene: THREE.Scene): MowerSystem {
  return {
    update(_dt: number, _elapsedS: number, _target: THREE.Vector3, _obstacles: readonly Obstacle[], _onMow: (x: number, z: number) => void) {},
    positions: () => [],
    nearestDistance: (_p: THREE.Vector3) => Infinity,
    reset() {},
  };
}

// src/pickups.ts
import * as THREE from 'three';
import type { PickupSystem } from './config';
export function createPickupSystem(_scene: THREE.Scene): PickupSystem {
  return { update: (_dt: number, _playerFeet: THREE.Vector3) => 0, reset() {} };
}

// src/ui.ts
import type { GameOverData, UI } from './config';
export function createUI(root: HTMLElement): UI {
  return {
    showTitle(_highScore: number) { root.textContent = 'Lawn Gnome Panic (stub)'; },
    showHud(_score: number, _seconds: number, _acorns: number) {},
    showGameOver(_data: GameOverData, _isNewHigh: boolean, _highScore: number) {},
  };
}

// src/storage.ts
export function getHighScore(): number { return 0; }
/** Saves score if it beats the stored high score. Returns true if it was a new high score. */
export function submitScore(_score: number): boolean { return false; }

// src/audio.ts
import type { SfxName } from './config';
export function playSfx(_name: SfxName): void {}
/** 0 = silent, 1 = a mower is right next to the player. */
export function setEngineLevel(_level: number): void {}
```

If tsc reports an unused import (for example THREE in pickups.ts) as an error, keep the import and tell the planner; do not change signatures.

## Done when
- `npm install` (repo root) succeeds.
- `npm run build -w games/sample-3d` succeeds.
- games/sample-3d/dist/index.html exists.

## Out of scope
- The root package.json, games/sample-dodge, docs/, tools/, .claude/.
- Real logic in the stubs.
~~~~

---

## Epic 2: Systems

Shared Environment text for every issue in this epic (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming (Git Bash /c/Users/cstab/Documents/gaming). Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0. Import three as `import * as THREE from 'three';`. Dependencies are installed; do not add any.
- Conventions: Y is up, ground at y = 0, the lawn spans -ARENA_HALF..ARENA_HALF on x and z. A yaw `a` means forward `(sin a, 0, cos a)`, right `(-cos a, 0, sin a)`; yaw 0 faces +z; `object.rotation.y = a` turns a model built facing +z to face yaw a; yaw from a direction is `Math.atan2(dx, dz)`. Models are built facing +z with their base at y = 0.
- Six other workers are editing other files in games/sample-3d at the same time. Edit only the files your issue names. src/config.ts and src/main.ts are read-only: import from config, never edit either. Keep the exported names and signatures of your stub exactly.
- Check with `npx tsc --noEmit -p games/sample-3d`. Do not run vite build or npm run build (they write dist/, which other workers share), and do not start a dev server. If tsc reports an error only in a file you do not own, another worker is mid-edit: wait a little and re-run; if it persists, report it and do not edit that file.

### 2.1 Implement input and the follow camera

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Keyboard, mouse (pointer lock) and gamepad input read once per frame, and a smoothed third-person camera that orbits behind the player.

## Read first
- games/sample-3d/src/config.ts: InputState, CameraRig, TUNING (camera* values).
- games/sample-3d/src/input.ts, src/camera.ts: the stubs you replace.
- games/sample-3d/src/main.ts: how they are called (`input.read(dt)` once per frame, `rig.update(player.position, inp, dt)`, `rig.reset(0)`, `rig.yaw`).

## Change
- games/sample-3d/src/input.ts, `createInput(canvas)`:
  - Track held keys by `KeyboardEvent.code` in a Set (keydown adds, keyup removes; window listeners). Track edge presses in a second Set filled on keydown when `!e.repeat`, cleared at the end of each read(). Call e.preventDefault() for Space and arrow keys.
  - canvas 'click' -> `canvas.requestPointerLock()` and set a `clicked` flag (an edge, cleared each read).
  - document 'mousemove': if `document.pointerLockElement === canvas`, accumulate `e.movementX`, `e.movementY` into mouseDX, mouseDY (cleared each read).
  - read(dt): returns InputState:
    - moveX = (KeyD||ArrowRight) - (KeyA||ArrowLeft); moveY = (KeyW||ArrowUp) - (KeyS||ArrowDown) (booleans to 1/0).
    - lookX = mouseDX * TUNING.cameraLookSensitivity + ((KeyE?1:0) - (KeyQ?1:0)) * TUNING.cameraKeyTurnSpeed * dt; lookY = mouseDY * TUNING.cameraLookSensitivity.
    - jump = edge Space; start = edge Space || edge Enter || clicked.
    - Gamepad: `const pad = navigator.getGamepads?.()[0]`; if present, with deadzone 0.15 on each axis (value with |v| < 0.15 counts as 0): moveX += axes[0], moveY += -axes[1], lookX += axes[2] * cameraKeyTurnSpeed * dt, lookY += axes[3] * cameraKeyTurnSpeed * dt. Button 0 (`pad.buttons[0].pressed`) edge-detected against its value last read: on the rising edge set jump = true and start = true.
    - Clamp moveX and moveY to -1..1.
- games/sample-3d/src/camera.ts, `createCameraRig(camera)` returns a CameraRig object:
  - Fields yaw = 0, pitch = TUNING.cameraPitchDefault, and a private snap flag initially true.
  - update(target, input, dt):
    - yaw -= input.lookX; pitch = clamp(pitch + input.lookY, TUNING.cameraPitchMin, TUNING.cameraPitchMax).
    - d = TUNING.cameraDistance. desired = (target.x - sin(yaw)*cos(pitch)*d, target.y + 1 + sin(pitch)*d, target.z - cos(yaw)*cos(pitch)*d). desired.y = max(desired.y, 0.5).
    - If snap: camera.position.copy(desired), snap = false; else camera.position.lerp(desired, 1 - Math.exp(-10 * dt)).
    - camera.lookAt(target.x, target.y + 1, target.z).
  - reset(yaw): set yaw, pitch = TUNING.cameraPitchDefault, snap = true.
  Implement it as an object literal or a small class; reading `rig.yaw` from outside must give the current yaw.

## Contract
- `export function createInput(canvas: HTMLCanvasElement): { read(dt: number): InputState }`
- `export function createCameraRig(camera: THREE.PerspectiveCamera): CameraRig`
- Sign conventions as in InputState: lookX > 0 turns the view right (so yaw decreases), lookY > 0 raises the camera.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in input.ts or camera.ts.

## Out of scope
Every other file, including config.ts, main.ts and player.ts.
~~~~

### 2.2 Implement the player controller

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
updatePlayer moves the gnome relative to the camera with acceleration, turning, jumping, double jumping, gravity, standing on top of obstacles and being pushed out of their sides.

## Read first
- games/sample-3d/src/config.ts: PlayerState, InputState, Obstacle, TUNING, ARENA_HALF, PLAYER_RADIUS.
- games/sample-3d/src/player.ts: the stub you replace.

## Change
- games/sample-3d/src/player.ts. Keep createPlayerState as it is. Implement updatePlayer(p, input, cameraYaw, obstacles, dt), in this order:
  1. prevY = p.position.y. jumped = false.
  2. Wish direction: f = (sin cameraYaw, 0, cos cameraYaw), r = (-cos cameraYaw, 0, sin cameraYaw). wish = f*input.moveY + r*input.moveX (x and z only). If its length > 1, normalise it.
  3. Horizontal velocity: target = wish * TUNING.moveSpeed. delta = target - (p.velocity.x, p.velocity.z). maxStep = TUNING.accel * dt * (p.grounded ? 1 : TUNING.airControl). If |delta| > maxStep, scale delta to length maxStep. Add delta to velocity x and z.
  4. Facing: if |wish| > 0.1, desired = Math.atan2(wish.x, wish.z); diff = shortest signed angle from p.facing to desired (wrap into -PI..PI); p.facing += clamp(diff, -TUNING.turnSpeed*dt, TUNING.turnSpeed*dt).
  5. Jump: if input.jump and p.jumpsUsed < TUNING.maxJumps: p.velocity.y = TUNING.jumpSpeed; p.jumpsUsed += 1; p.grounded = false; jumped = true.
  6. Gravity and move: p.velocity.y -= TUNING.gravity * dt; p.position.addScaledVector(p.velocity, dt).
  7. Obstacles. groundHeight = 0. For each obstacle o: dx = p.position.x - o.x, dz = p.position.z - o.z, d = hypot(dx, dz).
     - If d < o.radius and prevY >= o.height - 0.05: groundHeight = max(groundHeight, o.height). (Standing on top.)
     - Else if d < o.radius + PLAYER_RADIUS and p.position.y < o.height: push out horizontally so d becomes o.radius + PLAYER_RADIUS (if d < 1e-4 use the direction (1, 0)); then remove the velocity component pointing into the obstacle: n = (dx, dz)/d; dot = vx*n.x + vz*n.z; if dot < 0, v -= n*dot.
  8. Ground: if p.position.y <= groundHeight and p.velocity.y <= 0: p.position.y = groundHeight; p.velocity.y = 0; p.grounded = true; p.jumpsUsed = 0. Otherwise: if p.grounded (he just walked off an edge), set p.grounded = false and, if p.jumpsUsed === 0, p.jumpsUsed = 1 (so one air jump remains).
  9. Clamp p.position.x and z to ±(ARENA_HALF - PLAYER_RADIUS - 0.3); zero the velocity component on the clamped axis.
  10. Return { jumped }.
  Use plain numbers or THREE.Vector3 temporaries created once at module level; do not allocate per frame.

## Contract
- `export function createPlayerState(): PlayerState` (unchanged)
- `export function updatePlayer(p: PlayerState, input: InputState, cameraYaw: number, obstacles: readonly Obstacle[], dt: number): { jumped: boolean }`, mutating p.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in player.ts.

## Out of scope
Every other file, including config.ts (use the TUNING values that are there), main.ts, camera.ts, gnome.ts.
~~~~

### 2.3 Build and animate the gnome

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
A recognisable garden gnome made of three.js primitives, with procedural run, jump and "mowed flat" animation.

## Read first
- games/sample-3d/src/config.ts: GnomeModel, PlayerState, COLORS, TUNING.moveSpeed.
- games/sample-3d/src/gnome.ts: the stub you replace.

## Change
- games/sample-3d/src/gnome.ts, createGnome(). One MeshStandardMaterial per colour (roughness 0.8). Every mesh castShadow = true. Build facing +z, feet at y = 0, inside an inner Group `rig` that is a child of `object` (so squash/flatten scales `rig`, while `object` carries position and rotation):
  - Legs: two pivot Groups at (±0.1, 0.3, 0); each holds a Box 0.14 x 0.3 x 0.14 (COLORS.gnomePants) at local y -0.15, and a Box 0.16 x 0.08 x 0.22 (COLORS.mowerDark, a boot) at local (0, -0.28, 0.03).
  - Body: Cylinder radiusTop 0.18, radiusBottom 0.24, height 0.38, 12 segments (COLORS.gnomeShirt) at y 0.48. A belt: Cylinder 0.235/0.235 height 0.05 (COLORS.mowerDark) at y 0.36.
  - Arms: two pivot Groups at (±0.27, 0.62, 0); each holds a Box 0.1 x 0.3 x 0.1 (COLORS.gnomeShirt) at local y -0.15 and a Sphere r 0.06 (COLORS.gnomeSkin, hand) at local y -0.32.
  - Head: Sphere r 0.17 (COLORS.gnomeSkin) at y 0.8. Nose: Sphere r 0.05 (COLORS.gnomeSkin) at (0, 0.8, 0.17). Eyes: two Spheres r 0.025 (0x111111) at (±0.06, 0.86, 0.15).
  - Beard: Cone radius 0.17 height 0.32, 12 segments (COLORS.gnomeBeard), rotation.x = Math.PI (point down), at (0, 0.62, 0.07).
  - Hat: Cone radius 0.2 height 0.5, 16 segments (COLORS.gnomeHat) at (0, 1.12, -0.02), rotation.x = -0.15.
- update(p, dt):
  - object.position.copy(p.position); object.rotation.y = p.facing.
  - If dead: rig.rotation.x approaches -Math.PI/2 and rig.scale.y approaches 0.25 (lerp factor 1 - exp(-12*dt)); limbs still; return.
  - speed = hypot(p.velocity.x, p.velocity.z). If grounded: phase += dt * speed * 2.2; amt = 0.8 * min(1, speed / TUNING.moveSpeed); legs rotation.x = ±sin(phase)*amt (left +, right -); arms rotation.x = ∓sin(phase)*amt*0.8; rig.position.y = |sin(phase)| * 0.06 * amt.
  - If airborne: legs rotation.x approach 0.5 / -0.3, arms rotation.x approach -2.4 (arms up), rig.position.y approaches 0.
  - Squash: target scale.y = airborne ? (p.velocity.y > 0 ? 1.12 : 0.96) : 1; scale.x and scale.z = 1 / sqrt(scale.y); lerp toward targets with factor 1 - exp(-15*dt).
- setDead(dead): store it; when false, reset rig.rotation.x = 0, rig.scale to (1,1,1), rig.position.y = 0.

## Contract
- `export function createGnome(): GnomeModel` where `object` is a THREE.Group whose position and rotation.y follow the player, total height about 1.4.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in gnome.ts.

## Out of scope
Every other file, including config.ts, main.ts, player.ts.
~~~~

### 2.4 Build the garden world with a mowable lawn

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The garden: lights with shadows, a lawn whose texture shows mowed stripes where mowers drive, a white picket fence around it, a ring of hedges outside it, and meshes for every obstacle in OBSTACLES.

## Read first
- games/sample-3d/src/config.ts: World, OBSTACLES, Obstacle, ARENA_HALF, COLORS.
- games/sample-3d/src/world.ts: the stub you replace.

## Change
- games/sample-3d/src/world.ts, buildWorld(scene):
  - Lights: `new THREE.HemisphereLight(0xffffff, 0x446644, 1.2)`; `const sun = new THREE.DirectionalLight(0xffffff, 2.5)` at (15, 25, 10), castShadow, shadow.mapSize 2048x2048, shadow.camera left/bottom -26 and right/top 26, near 1, far 70, shadow.bias -0.0005. Add both to scene (and sun.target at origin).
  - Lawn: a 512x512 canvas (document.createElement('canvas')), 2D context. paintBase(): fill COLORS.grass (as '#' + hex padded to 6), then 4000 random 2x2 speckles in a slightly darker and slightly lighter shade (e.g. multiply the colour channels by 0.9 and 1.08). `const tex = new THREE.CanvasTexture(canvas)`, tex.colorSpace = THREE.SRGBColorSpace, tex.anisotropy = 4. Plane (ARENA_HALF*2 x ARENA_HALF*2) with MeshStandardMaterial({ map: tex, roughness: 1 }), rotation.x = -Math.PI/2, receiveShadow.
  - markMowed(x, z): canvas pixel px = (x + ARENA_HALF) / (2*ARENA_HALF) * 512, py = (z + ARENA_HALF) / (2*ARENA_HALF) * 512 (this mapping matches the rotated plane's UVs). Fill a circle radius 11 px with COLORS.grassMowed at globalAlpha 0.5. Set dirty = true.
  - update(dt): accumulate time; if dirty and at least 0.1 s since the last upload, tex.needsUpdate = true, dirty = false.
  - reset(): paintBase(); tex.needsUpdate = true.
  - Outer ground: a 200x200 plane at y = -0.01 with colour 0x3f7f2b, receiveShadow.
  - Fence: along each of the four sides at distance ARENA_HALF + 0.3 from the centre, pickets every 0.5 m: Box 0.12 x 0.8 x 0.06 (COLORS.fence) at y 0.4, plus two rails per side (Box along the side, 0.06 thick, 0.08 tall, at y 0.25 and 0.6). Merge cost is fine at this size; use one shared geometry and material for pickets. castShadow on pickets.
  - Hedges outside the fence: along each side at distance ARENA_HALF + 2.5, a Box (side length + 5) x 1.8 x 2 (COLORS.bush), receiveShadow and castShadow.
  - Obstacles: for each o in OBSTACLES, at (o.x, 0, o.z), castShadow and receiveShadow:
    - stump: Cylinder(o.radius, o.radius * 1.1, o.height, 16) COLORS.stump at y = o.height/2, plus a top disc Cylinder(o.radius * 0.9, o.radius * 0.9, 0.02) colour 0xc9a46a at y = o.height + 0.01.
    - rock: Dodecahedron(o.radius) COLORS.stone, scale.y = o.height / o.radius, position y = o.height / 2 (so it sits on the ground), flatShading.
    - bush: three Spheres (COLORS.bush): r = o.radius at y = o.height - o.radius*0.6 (scale.y 0.8); two smaller r = o.radius*0.7 offset ±o.radius*0.5 on x at y = o.radius*0.5.
    - birdbath: Cylinder pedestal 0.15/0.25 height o.height - 0.1 (COLORS.stone) at y = (o.height - 0.1)/2; bowl Cylinder(o.radius, o.radius*0.6, 0.15, 20) at y = o.height - 0.075; water Cylinder(o.radius*0.85, same, 0.02) colour 0x5ec8f2 at y = o.height - 0.01.
  - A few decorative flower clusters (no collision): 12 small Spheres r 0.08 in pink/yellow/white at random points in the corners (|x| > 14 and |z| > 14), y 0.25, each on a thin green Cylinder stem.

## Contract
- `export function buildWorld(scene: THREE.Scene): World`
- markMowed(x, z) uses exactly the pixel mapping above.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in world.ts.

## Out of scope
Every other file, including config.ts (do not add obstacles), main.ts, mowers.ts.
~~~~

### 2.5 Build the lawn mowers and their chase AI

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Lawn mowers that spawn at the edges, steer toward the player with a limited turn rate (so he can outmanoeuvre them), get faster and more frequent over time, avoid each other and the obstacles, and mow the lawn as they go.

## Read first
- games/sample-3d/src/config.ts: MowerSystem, Obstacle, TUNING (mower* values), ARENA_HALF, MOWER_RADIUS, COLORS.
- games/sample-3d/src/mowers.ts: the stub you replace.

## Change
- games/sample-3d/src/mowers.ts, createMowerSystem(scene):
  - Internal `interface Mower { group: THREE.Group; wheels: THREE.Mesh[]; engine: THREE.Mesh; pos: THREE.Vector3; heading: number }` and an array of them. A spawn timer starting at 1.5 s, and a running time t for vibration.
  - buildMowerMesh() (facing +z, travel direction; handle at the back, -z). MeshStandardMaterial, castShadow on all:
    - Deck: Box 1.4 x 0.3 x 1.3 (COLORS.mowerBody) at y 0.35.
    - Engine: Cylinder 0.3/0.32 height 0.3 (COLORS.mowerDark) at (0, 0.65, 0.1); a small red Box 0.2 x 0.1 x 0.2 cap on it at y 0.85.
    - Wheels: four Cylinders r 0.18, h 0.12, 16 segments (COLORS.mowerDark), geometry rotated with rotateZ(Math.PI/2), at (±0.72, 0.18, ±0.45).
    - Handle: two Boxes 0.05 x 0.05 x 1.0 (COLORS.mowerDark) from the back of the deck rising backward: each at (±0.45, 0.8, -0.95), rotation.x = -0.75 (tilted up toward the back); a crossbar Box 0.95 x 0.06 x 0.06 at (0, 1.12, -1.3).
  - update(dt, elapsedS, target, obstacles, onMow):
    - t += dt. speed = min(TUNING.mowerSpeedMax, TUNING.mowerSpeedStart + TUNING.mowerSpeedRampPerSec * elapsedS).
    - Spawn: timer -= dt; if timer <= 0 and count < TUNING.mowerMax: spawn one; timer = max(TUNING.mowerSpawnMinS, TUNING.mowerSpawnStartS - TUNING.mowerSpawnRampPerSec * elapsedS). Spawn point: random side; a random coordinate along it in ±(ARENA_HALF-2), the other coordinate ±(ARENA_HALF-1.2); heading toward the arena centre (atan2(-x, -z)). Add the group to the scene.
    - For each mower: desired = atan2(target.x - pos.x, target.z - pos.z); diff = shortest signed angle; heading += clamp(diff, -TUNING.mowerTurnRate*dt, TUNING.mowerTurnRate*dt). pos.x += sin(heading)*speed*dt; pos.z += cos(heading)*speed*dt.
    - Obstacles: for each o, if horizontal distance d < o.radius + MOWER_RADIUS, push pos out to exactly that distance (direction (1,0) if d < 1e-4).
    - Mowers repel each other: for each pair closer than 2*MOWER_RADIUS, move each half the overlap apart.
    - Clamp pos.x and pos.z to ±(ARENA_HALF - MOWER_RADIUS).
    - Visuals: group.position.set(pos.x, 0, pos.z); group.rotation.y = heading; each wheel's rotation.x += speed*dt/0.18; engine.position.y = 0.65 + sin(t*60)*0.012; group.rotation.z = sin(t*45)*0.01.
    - onMow(pos.x, pos.z) once per mower per frame.
  - positions(): the array of mower pos vectors (y = 0).
  - nearestDistance(p): minimum hypot(pos.x - p.x, pos.z - p.z), Infinity if none.
  - reset(): remove every group from the scene, dispose nothing (geometries/materials may be shared module-level constants), clear the array, timer = 1.5.

## Contract
- `export function createMowerSystem(scene: THREE.Scene): MowerSystem` with exactly the methods in MowerSystem.
- A mower's collision footprint is a circle of radius MOWER_RADIUS around its pos.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowers.ts.

## Out of scope
Every other file, including config.ts, main.ts, world.ts. Collision between mowers and the player is in main.ts already; do not add it.
~~~~

### 2.6 Build the golden acorn pickups

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Golden acorns that appear on the lawn and on top of obstacles, bob and spin, and are collected when the gnome touches them.

## Read first
- games/sample-3d/src/config.ts: PickupSystem, OBSTACLES, TUNING (pickup* values), ARENA_HALF, COLORS.
- games/sample-3d/src/pickups.ts: the stub you replace.

## Change
- games/sample-3d/src/pickups.ts, createPickupSystem(scene):
  - Shared module-level geometries and materials. Acorn mesh as a Group: nut Sphere r 0.2 (COLORS.acorn, MeshStandardMaterial metalness 0.3 roughness 0.4 emissive 0x553300) with scale.y 1.25; cap Sphere r 0.22 with phiStart/phiLength full and thetaLength Math.PI/2 (a hemisphere, COLORS.acornCap) at y 0.12; stem Cylinder 0.025 h 0.1 (COLORS.acornCap) at y 0.3. castShadow.
  - Internal list of { group, baseY, phase }. A spawn timer starting at 0.5, time t.
  - update(dt, playerFeet):
    - t += dt. timer -= dt; if timer <= 0 and count < TUNING.pickupMax: spawn one, timer = TUNING.pickupSpawnS.
    - Spawn: with probability TUNING.pickupOnObstacleChance, pick a random obstacle o from OBSTACLES and place at (o.x, o.height + 0.5, o.z). Otherwise pick random x, z in ±(ARENA_HALF - 2) until the point is farther than o.radius + 1 from every obstacle (max 20 tries), y = 0.5. Do not spawn within 1.5 m of another acorn (retry the same way).
    - Animate: group.position.y = baseY + sin(t*3 + phase)*0.12; group.rotation.y += 2*dt.
    - Collect: if the distance from the acorn's position to (playerFeet.x, playerFeet.y + 0.5, playerFeet.z) < 0.9, remove it from the scene and the list and count it.
    - Return the count collected this frame.
  - reset(): remove all acorns from the scene, clear the list, timer = 0.5.

## Contract
- `export function createPickupSystem(scene: THREE.Scene): PickupSystem`.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in pickups.ts.

## Out of scope
Every other file, including config.ts, main.ts, world.ts.
~~~~

### 2.7 Build the HTML overlay, high-score storage and synth audio

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The title screen, HUD and game-over screen as an HTML overlay; the high score in localStorage; and WebAudio sound effects plus a mower engine drone that gets louder as mowers get closer.

## Read first
- games/sample-3d/src/config.ts: UI, GameOverData, SfxName, STORAGE_KEY_HIGH_SCORE.
- games/sample-3d/src/ui.ts, src/storage.ts, src/audio.ts: the stubs you replace.
- games/sample-3d/index.html: #ui already has position fixed, inset 0, pointer-events none, white system-ui text. Keep pointer-events none on everything you add, so clicks reach the canvas (a click starts the game and locks the mouse).

## Change
- games/sample-3d/src/ui.ts, createUI(root):
  - Inject one <style> element into document.head with classes: `.hud` (absolute, top 12px, left 16px, font-size 22px, font-weight 700, text-shadow 0 2px 4px rgba(0,0,0,.5)); `.panel` (absolute, inset 0, display flex, flex-direction column, align-items center, justify-content center, gap 12px, background rgba(10,30,10,.45), text-align center, text-shadow 0 2px 6px rgba(0,0,0,.6)); `.title` (font-size 64px, font-weight 900, color #ffd54f, letter-spacing 2px); `.big` 32px; `.small` 18px, opacity .9; `.blink` animation 1.2s infinite alternate from opacity 1 to .35; `.pop` (color #ffd54f, font-size 28px, animation pulsing scale 1 -> 1.12, .5s infinite alternate).
  - Build the elements once and switch which are visible (do not recreate each frame): a hud div, a title panel, a game-over panel.
  - showTitle(highScore): show the title panel only: "LAWN GNOME PANIC" (.title); "Dodge the lawn mowers. Grab the golden acorns." (.big is too large; use .small); "WASD / arrows to run · Space to jump (press again in the air to double jump) · Mouse or Q/E to look"; "Gamepad works too."; `High score: ${highScore}`; "Click or press Space to start" (.big .blink).
  - showHud(score, seconds, acorns): show only the hud; set its text to `Score ${score}   ·   ${seconds.toFixed(1)}s   ·   Acorns ${acorns}` only if that string changed since the last call.
  - showGameOver(data, isNewHigh, highScore): show only the game-over panel: "MOWED!" (.title, colour #ff6b5a); `Score ${data.score}` (.big); `Survived ${data.secondsSurvived}s · ${data.acorns} acorns` (.small); "NEW HIGH SCORE!" (.pop) if isNewHigh, else `High score: ${highScore}` (.small); "Click or press Space to play again" (.big .blink).
- games/sample-3d/src/storage.ts:
  - getHighScore(): parseInt of localStorage[STORAGE_KEY_HIGH_SCORE]; 0 if missing, NaN, or if localStorage throws (try/catch).
  - submitScore(score): if score > getHighScore(), write it (try/catch) and return true; else false.
- games/sample-3d/src/audio.ts (no Phaser, plain WebAudio; wrap every function body in try/catch so audio never throws):
  - Lazily create one AudioContext and a master GainNode (0.6) to destination. On every playSfx call, if ctx.state === 'suspended', ctx.resume().
  - tone(f0, f1, dur, type, vol, delay = 0): oscillator -> gain -> master; frequency setValueAtTime(f0, now+delay), exponentialRampToValueAtTime(f1, now+delay+dur); gain setValueAtTime(vol, now+delay), exponentialRampToValueAtTime(0.001, now+delay+dur); start/stop at those times.
  - playSfx: 'start' -> tone(330, 660, 0.15, 'square', 0.08) and tone(495, 990, 0.15, 'square', 0.06, 0.12); 'jump' -> tone(300, 600, 0.12, 'triangle', 0.12); 'pickup' -> tone(880, 1320, 0.08, 'square', 0.07) and tone(1320, 1760, 0.1, 'square', 0.05, 0.06); 'hit' -> tone(180, 40, 0.5, 'sawtooth', 0.2) and a noise burst: a 0.3 s AudioBuffer of random values -1..1 through a gain 0.25 -> 0.001 exponential ramp.
  - setEngineLevel(level): clamp 0..1. On the first call with level > 0, create the engine: a 'sawtooth' oscillator at 55 Hz and a second 'square' oscillator at 56.5 Hz, both through a BiquadFilter lowpass at 500 Hz into an engine GainNode (gain 0) into master; start both. Each call: engineGain.gain.setTargetAtTime(level * level * 0.12, now, 0.08); both oscillator frequencies setTargetAtTime(50 + level * 35 (+1.5 for the second), now, 0.1). Do not resume a suspended context here; playSfx does that on a user gesture.

## Contract
- ui.ts: `export function createUI(root: HTMLElement): UI`.
- storage.ts: `export function getHighScore(): number`, `export function submitScore(score: number): boolean`.
- audio.ts: `export function playSfx(name: SfxName): void`, `export function setEngineLevel(level: number): void`.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in ui.ts, storage.ts or audio.ts.

## Out of scope
Every other file, including config.ts, main.ts, index.html.
~~~~
