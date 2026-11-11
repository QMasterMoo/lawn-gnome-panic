# Roadmap: sample-dodge

## Goal

A reference prototype in `games/sample-dodge/`: a top-down arena in the browser. The player moves with arrows/WASD, red enemies fly in from the edges with rising frequency, yellow coins appear to be collected, and one hit ends the run. Title screen, game-over screen with a high score saved in localStorage. All graphics and sounds are generated in code (no asset files). Also `tools/new-game.mjs`, which copies the sample into a new game folder.

Stack: Vite 8.3.8, TypeScript 7.0.2, Phaser 4.2.1 (arcade physics).

## Shape

| Epic | Done when | Issues |
|---|---|---|
| 1. Scaffold | The workspace installs; the game builds and boots to an empty title scene; `config.ts` holds every shared key and tuning value; every later file exists as a stub. | 1 |
| 2. Features | Textures, gameplay, title/game-over/high score, audio and the new-game tool are each done; the game builds and plays end to end. | 4, parallel |

No dependencies inside an epic. Epic 2 issues each own different files and talk only through `src/config.ts` (written in epic 1, read-only in epic 2) and the stub signatures.

---

## Epic 1: Scaffold

### 1.1 Scaffold games/sample-dodge with config and stubs

~~~~text
Epic: 1 Scaffold
Depends on: none

## Environment
- Repository root: C:/Users/cstab/Documents/gaming (Git Bash path /c/Users/cstab/Documents/gaming). Run commands from the root.
- If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- The root package.json already declares npm workspaces "games/*" and "packages/*". Do not edit it.
- You are the only worker in this epic.

## Goal
A buildable Vite + TypeScript + Phaser 4 project in games/sample-dodge that boots into a placeholder title scene, with src/config.ts holding every shared constant and a stub for every module later workers fill in.

## Read first
- package.json (root): workspaces setup.
- CLAUDE.md: repo rules.

## Change
- games/sample-dodge/package.json:
  name "sample-dodge", private true, type "module",
  scripts: "dev": "vite", "build": "tsc --noEmit && vite build", "preview": "vite preview", "typecheck": "tsc --noEmit"
  dependencies: "phaser": "4.2.1"
  devDependencies: "typescript": "7.0.2", "vite": "8.3.8"
- games/sample-dodge/tsconfig.json: target ES2022, module ESNext, moduleResolution "bundler", strict true, noEmit true, skipLibCheck true, lib ["ES2022","DOM"], include ["src"].
- games/sample-dodge/vite.config.ts: `import { defineConfig } from 'vite'; export default defineConfig({ base: './', server: { port: 5173 } });`
  If tsc complains that vite.config.ts is outside "include", that is fine because include is ["src"]; it is not type-checked.
- games/sample-dodge/index.html: full-window page, body margin 0, background #10131a, a <div id="game"></div>, and <script type="module" src="/src/main.ts"></script>. Title "Sample Dodge".
- games/sample-dodge/src/config.ts: EXACTLY the content under Contract below.
- games/sample-dodge/src/main.ts: creates `new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: GAME_WIDTH, height: GAME_HEIGHT, backgroundColor: COLORS.background, physics: { default: 'arcade', arcade: { debug: false } }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [BootScene, TitleScene, GameScene, GameOverScene] })`.
- games/sample-dodge/src/scenes/BootScene.ts, TitleScene.ts, GameScene.ts, GameOverScene.ts: stubs, see Contract.
- games/sample-dodge/src/audio.ts and src/storage.ts: stubs, see Contract.
- games/sample-dodge/CREDITS.md: "# Credits\n\nAll graphics and sounds are generated in code. No external assets.\n"
- games/sample-dodge/README.md: one paragraph on what the game is, then `npm run dev -w games/sample-dodge` and `npm run build -w games/sample-dodge`, and that tuning lives in src/config.ts.
- Then run `npm install` from the repository root.

Phaser import: use `import Phaser from 'phaser';` in every file. If TypeScript rejects the default import, check node_modules/phaser/package.json "types"/"exports" and use whichever form works (`import * as Phaser from 'phaser'`), and use the same form in every file you write; report which in your final message.

## Contract
src/config.ts, verbatim:

```ts
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const SCENES = {
  boot: 'Boot',
  title: 'Title',
  game: 'Game',
  gameOver: 'GameOver',
} as const;

/** Texture keys generated in BootScene. Sizes in pixels. */
export const TEX = {
  player: 'player', // 32x32 circle
  enemy: 'enemy',   // 28x28 triangle
  coin: 'coin',     // 16x16 circle
  spark: 'spark',   // 6x6 square, for particles
} as const;

export const COLORS = {
  background: '#10131a',
  player: 0x4dd0e1,
  enemy: 0xff5252,
  coin: 0xffd54f,
  spark: 0xffffff,
  text: '#e8eaf6',
  accent: '#ffd54f',
} as const;

/** Gameplay tuning. Change these to change the feel. */
export const TUNING = {
  playerSpeed: 260,          // px/s
  enemySpeedMin: 90,         // px/s
  enemySpeedMax: 220,        // px/s
  enemySpawnStartMs: 900,    // first spawn interval
  enemySpawnMinMs: 250,      // fastest spawn interval
  enemySpawnRampMs: 15,      // interval shrinks by this per second survived
  coinSpawnMs: 1800,
  coinLifetimeMs: 5000,
  coinScore: 10,
  survivalScorePerSec: 1,
  hitToGameOverMs: 700,
} as const;

export type SfxName = 'start' | 'coin' | 'hit';

/** Passed from GameScene to GameOverScene via this.scene.start(SCENES.gameOver, data). */
export interface GameOverData {
  score: number;
  secondsSurvived: number;
}

export const STORAGE_KEY_HIGH_SCORE = 'sample-dodge.highScore';
```

Stubs (exported names and signatures are final; later workers replace the bodies):

```ts
// src/scenes/BootScene.ts
import Phaser from 'phaser';
import { SCENES } from '../config';
export class BootScene extends Phaser.Scene {
  constructor() { super(SCENES.boot); }
  create(): void { this.scene.start(SCENES.title); }
}

// src/scenes/TitleScene.ts
import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
export class TitleScene extends Phaser.Scene {
  constructor() { super(SCENES.title); }
  create(): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Sample Dodge (stub)', { color: COLORS.text, fontSize: '32px' }).setOrigin(0.5);
  }
}

// src/scenes/GameScene.ts
import Phaser from 'phaser';
import { SCENES } from '../config';
export class GameScene extends Phaser.Scene {
  constructor() { super(SCENES.game); }
  create(): void {}
}

// src/scenes/GameOverScene.ts
import Phaser from 'phaser';
import { SCENES, type GameOverData } from '../config';
export class GameOverScene extends Phaser.Scene {
  constructor() { super(SCENES.gameOver); }
  init(_data: GameOverData): void {}
  create(): void {}
}

// src/audio.ts
import type { SfxName } from './config';
export function playSfx(_name: SfxName): void {}

// src/storage.ts
export function getHighScore(): number { return 0; }
/** Saves score if it beats the stored high score. Returns true if it was a new high score. */
export function submitScore(_score: number): boolean { return false; }
```

## Done when
- `npm install` (repo root) succeeds.
- `npm run build -w games/sample-dodge` succeeds (tsc then vite build).
- games/sample-dodge/dist/index.html exists.

## Out of scope
- The root package.json, CLAUDE.md, docs/, tools/, .claude/.
- Real game logic in the stubs.
~~~~

---

## Epic 2: Features

Shared Environment text for every issue in this epic (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming (Git Bash /c/Users/cstab/Documents/gaming). Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-dodge, Vite + TypeScript (strict) + Phaser 4.2.1, arcade physics. Dependencies are installed; do not add any.
- Three other workers are editing other files in games/sample-dodge at the same time. Edit only the files your issue names. src/config.ts is read-only: import from it, never edit it.
- Check with `npx tsc --noEmit -p games/sample-dodge`. Do not run `vite build` or `npm run build` (they write dist/, which other workers share). If tsc reports an error only in a file you do not own, another worker is mid-edit: wait a little and re-run; if it persists, report it and do not edit that file.
- Use the same Phaser import form as the existing files in src/.

### 2.1 Generate textures in BootScene

~~~~text
Epic: 2 Features
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
BootScene draws every texture in TEX with Phaser Graphics so the game needs no image files, then starts the title scene.

## Read first
- games/sample-dodge/src/config.ts: TEX keys and sizes, COLORS.
- games/sample-dodge/src/scenes/BootScene.ts: the stub you replace.

## Change
- games/sample-dodge/src/scenes/BootScene.ts: in create(), use one `const g = this.add.graphics();` and for each texture: `g.clear()`, draw, `g.generateTexture(key, w, h)`. Then `g.destroy()` and `this.scene.start(SCENES.title)`.
  - TEX.player 32x32: fillStyle(COLORS.player) fillCircle(16,16,15); lineStyle(2, 0xffffff, 0.8) strokeCircle(16,16,14).
  - TEX.enemy 28x28: fillStyle(COLORS.enemy) fillTriangle(14,1, 27,27, 1,27).
  - TEX.coin 16x16: fillStyle(COLORS.coin) fillCircle(8,8,7); fillStyle(0xffffff, 0.6) fillCircle(6,5,2).
  - TEX.spark 6x6: fillStyle(COLORS.spark) fillRect(0,0,6,6).

## Contract
- `export class BootScene extends Phaser.Scene`, constructor calls `super(SCENES.boot)`.
- Texture keys exactly TEX.player, TEX.enemy, TEX.coin, TEX.spark at the sizes above.

## Done when
- `npx tsc --noEmit -p games/sample-dodge` reports no errors in BootScene.ts.

## Out of scope
Every other file. In particular GameScene.ts, TitleScene.ts, GameOverScene.ts, audio.ts, storage.ts, config.ts, main.ts.
~~~~

### 2.2 Implement the gameplay in GameScene

~~~~text
Epic: 2 Features
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
GameScene is the playable round: move, dodge enemies, collect coins, score, and hand off to the game-over scene on the first hit.

## Read first
- games/sample-dodge/src/config.ts: SCENES, TEX, TUNING, COLORS, GameOverData, GAME_WIDTH/HEIGHT.
- games/sample-dodge/src/scenes/GameScene.ts: the stub you replace.
- games/sample-dodge/src/audio.ts: `playSfx(name: SfxName): void` (another worker is implementing its body; just call it).

## Change
- games/sample-dodge/src/scenes/GameScene.ts. Fields on the class, reset in create() (the scene restarts, so do not rely on constructor initialisation):
  player (Phaser.Types.Physics.Arcade.SpriteWithDynamicBody), enemies and coins (Phaser.Physics.Arcade.Group), keys (cursor keys plus W/A/S/D), score (number), elapsedMs (number), spawnTimerMs (number), coinTimerMs (number), dead (boolean), hud (Phaser.GameObjects.Text), sparks (particle emitter).
  - create():
    - player = this.physics.add.sprite(GAME_WIDTH/2, GAME_HEIGHT/2, TEX.player); player.setCollideWorldBounds(true); player.body.setCircle(14, 2, 2).
    - enemies = this.physics.add.group(); coins = this.physics.add.group().
    - keys: this.input.keyboard!.createCursorKeys() and this.input.keyboard!.addKeys('W,A,S,D').
    - hud = this.add.text(12, 10, '', { color: COLORS.text, fontSize: '20px' }).setDepth(10).
    - sparks = this.add.particles(0, 0, TEX.spark, { speed: { min: 80, max: 260 }, lifespan: 500, scale: { start: 1, end: 0 }, emitting: false }).
    - this.physics.add.overlap(player, enemies, () => this.onHit()); this.physics.add.overlap(player, coins, (_p, c) => this.onCoin(c as Phaser.Physics.Arcade.Sprite)).
    - playSfx('start').
  - update(_time, delta):
    - If dead, return.
    - Input: x = (right||D) - (left||A), y = (down||S) - (up||W); normalise the vector so diagonals are not faster; player.setVelocity(x*TUNING.playerSpeed, y*TUNING.playerSpeed).
    - elapsedMs += delta. score += TUNING.survivalScorePerSec * delta/1000 (keep it fractional; display Math.floor).
    - Enemy spawn: spawnTimerMs -= delta; when <= 0, spawnEnemy() and reset to max(TUNING.enemySpawnMinMs, TUNING.enemySpawnStartMs - TUNING.enemySpawnRampMs * elapsedMs/1000).
    - Coin spawn: same pattern with TUNING.coinSpawnMs.
    - Destroy enemies more than 100px outside the 0..GAME_WIDTH x 0..GAME_HEIGHT rectangle.
    - hud.setText(`Score ${Math.floor(score)}   Time ${(elapsedMs/1000).toFixed(1)}s`).
  - spawnEnemy(): pick a random edge (Phaser.Math.Between(0,3)); position 20px outside it at a random point along it; enemy = enemies.create(x, y, TEX.enemy); aim at the player's current position: angle = Phaser.Math.Angle.Between(x, y, player.x, player.y); speed = Phaser.Math.Between(TUNING.enemySpeedMin, TUNING.enemySpeedMax); body velocity = (cos*speed, sin*speed); enemy.setRotation(angle + Math.PI/2).
  - spawnCoin(): coins.create at a random point at least 40px from the screen edges; this.time.delayedCall(TUNING.coinLifetimeMs, () => coin.destroy()); add a tween scaling 1 -> 1.25 yoyo repeat -1 duration 400.
  - onCoin(coin): coin.destroy(); score += TUNING.coinScore; playSfx('coin'); sparks.explode(8, coin.x, coin.y).
  - onHit(): if dead, return; dead = true; player.setVelocity(0,0); player.setTint(COLORS.enemy); this.physics.pause(); playSfx('hit'); this.cameras.main.shake(250, 0.01); sparks.explode(30, player.x, player.y); this.time.delayedCall(TUNING.hitToGameOverMs, () => this.scene.start(SCENES.gameOver, { score: Math.floor(score), secondsSurvived: Math.floor(elapsedMs/1000) } satisfies GameOverData)).

## Contract
- `export class GameScene extends Phaser.Scene`, `super(SCENES.game)`.
- Leaves with `this.scene.start(SCENES.gameOver, data)` where data is GameOverData { score: number; secondsSurvived: number }, both integers.
- Uses textures TEX.player, TEX.enemy, TEX.coin, TEX.spark (created by BootScene before this scene runs).
- Calls playSfx('start' | 'coin' | 'hit') from '../audio'.

## Done when
- `npx tsc --noEmit -p games/sample-dodge` reports no errors in GameScene.ts.

## Out of scope
Every other file, including config.ts (do not add tuning values; use what is there), audio.ts, BootScene.ts, TitleScene.ts, GameOverScene.ts, storage.ts, main.ts.
~~~~

### 2.3 Build the title and game-over scenes and high-score storage

~~~~text
Epic: 2 Features
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
A title screen that starts the game, a game-over screen that shows the run's result and the high score and restarts, and localStorage high-score persistence.

## Read first
- games/sample-dodge/src/config.ts: SCENES, COLORS, GAME_WIDTH/HEIGHT, GameOverData, STORAGE_KEY_HIGH_SCORE.
- games/sample-dodge/src/scenes/TitleScene.ts, GameOverScene.ts, src/storage.ts: stubs you replace.

## Change
- games/sample-dodge/src/storage.ts:
  - getHighScore(): read localStorage[STORAGE_KEY_HIGH_SCORE], parse int, return 0 if missing, NaN, or if localStorage throws (wrap in try/catch).
  - submitScore(score): if score > getHighScore(), write it (try/catch) and return true; else return false.
- games/sample-dodge/src/scenes/TitleScene.ts, create():
  - Centered texts: 'SAMPLE DODGE' (56px, COLORS.accent) at y=200; 'Arrows / WASD to move. Dodge red, grab gold.' (20px, COLORS.text) at y=290; `High score: ${getHighScore()}` (20px) at y=330; 'Press SPACE or click to start' (24px, COLORS.text) at y=420 with a tween alpha 1 -> 0.3 yoyo repeat -1 duration 600.
  - Start: this.input.keyboard!.once('keydown-SPACE', start) and this.input.once('pointerdown', start), where start = () => this.scene.start(SCENES.game).
- games/sample-dodge/src/scenes/GameOverScene.ts:
  - Field `private result: GameOverData = { score: 0, secondsSurvived: 0 }` and `private isNewHigh = false`.
  - init(data: GameOverData): this.result = data; this.isNewHigh = submitScore(data.score).
  - create(): centered 'GAME OVER' (56px, '#ff5252') y=180; `Score ${score}` (32px) y=260; `Survived ${secondsSurvived}s` (22px) y=305; if isNewHigh, 'NEW HIGH SCORE!' (26px, COLORS.accent) y=350 with a scale tween 1 -> 1.15 yoyo repeat -1; else `High score: ${getHighScore()}` (22px) y=350; 'SPACE / click: play again    ESC: title' (20px) y=440.
  - Ignore input for the first 400ms (this.time.delayedCall(400, ...) then register handlers) so a held key does not skip the screen. SPACE or pointerdown -> this.scene.start(SCENES.game); ESC (keydown-ESC) -> this.scene.start(SCENES.title). Use `once` for each.
  - Use COLORS.text for texts without a stated colour. setOrigin(0.5) on all.

## Contract
- `export class TitleScene` with super(SCENES.title); `export class GameOverScene` with super(SCENES.gameOver) and init(data: GameOverData).
- storage.ts exports exactly `getHighScore(): number` and `submitScore(score: number): boolean`.

## Done when
- `npx tsc --noEmit -p games/sample-dodge` reports no errors in TitleScene.ts, GameOverScene.ts or storage.ts.

## Out of scope
Every other file: GameScene.ts, BootScene.ts, audio.ts, config.ts, main.ts.
~~~~

### 2.4 Implement synth sound effects and the new-game tool

~~~~text
Epic: 2 Features
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
playSfx makes short sounds with WebAudio (no audio files), and `npm run new -- <name>` copies the sample into a new game folder.

## Read first
- games/sample-dodge/src/audio.ts: the stub you replace.
- games/sample-dodge/src/config.ts: SfxName.
- package.json (root): the "new" script runs `node tools/new-game.mjs`.

## Change
- games/sample-dodge/src/audio.ts:
  - A module-level `let ctx: AudioContext | null = null;` created lazily on first call (`new AudioContext()`); if ctx.state === 'suspended', call ctx.resume(). Wrap everything in try/catch so audio never throws into the game.
  - Helper `tone(freqStart: number, freqEnd: number, durationS: number, type: OscillatorType, volume: number)`: an OscillatorNode -> GainNode -> destination; frequency setValueAtTime(freqStart) then exponentialRampToValueAtTime(freqEnd, now+duration); gain setValueAtTime(volume) then exponentialRampToValueAtTime(0.001, now+duration); start now, stop now+duration.
  - playSfx: 'start' -> tone(330, 660, 0.15, 'square', 0.08); 'coin' -> tone(880, 1320, 0.08, 'square', 0.07) and a second tone(1320, 1760, 0.08, 'square', 0.05) starting 0.06s later (use setTimeout 60); 'hit' -> tone(220, 40, 0.4, 'sawtooth', 0.15).
- tools/new-game.mjs (Node ESM, no dependencies, use node:fs and node:path):
  - Usage: `node tools/new-game.mjs <name> [--from <existing-game>]`, default source sample-dodge.
  - Resolve the repo root from the script location (`new URL('..', import.meta.url)` with fileURLToPath).
  - Validate name against /^[a-z0-9][a-z0-9-]*$/; exit 1 with a message if invalid, if games/<name> already exists, or if the source does not exist.
  - fs.cpSync(src, dest, { recursive: true, filter: p => !/[\\/](node_modules|dist)([\\/]|$)/.test(p) }).
  - In dest package.json set "name" to <name> (JSON parse/stringify with 2-space indent and trailing newline).
  - In dest index.html replace the <title> text with <name>.
  - Print: `Created games/<name>. Next: npm install && npm run dev -w games/<name>`.

## Contract
- audio.ts exports exactly `playSfx(name: SfxName): void`.
- tools/new-game.mjs CLI as above.

## Done when
- `npx tsc --noEmit -p games/sample-dodge` reports no errors in audio.ts.
- `node tools/new-game.mjs Bad_Name` exits non-zero.
- `node tools/new-game.mjs tmp-check` creates games/tmp-check without node_modules or dist, with package.json name "tmp-check"; then delete games/tmp-check (`rm -rf games/tmp-check`) so nothing is left behind.

## Out of scope
Every other file in games/sample-dodge (scenes, config.ts, storage.ts, main.ts), and the root package.json.
~~~~
