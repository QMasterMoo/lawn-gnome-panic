~~~~text
Epic: 2 Events
Depends on: none

## Environment
Working directory: C:\Users\cpsai\cstabnick\lawn-gnome-panic\.claude\worktrees\gnomylpics (a git worktree; stay inside it).
Git Bash: if `node` is not found run `export PATH="/c/Program Files/nodejs:$PATH"`. Dependencies are installed.
Game: games/gnomylpics (Vite + TypeScript strict + Phaser 4.2.1). Two other workers are editing
src/scenes/TripleJumpScene.ts and src/scenes/MowerTossScene.ts at the same time; do not touch them.
Do not run git commit. Do not start a dev server. Do not run `vite build`.

## Goal
Replace the stub in games/gnomylpics/src/scenes/DashScene.ts with the real 60m Gnome Dash: 4 lanes race at once,
humans tap their two keys alternately to run, the same key twice in a row is a stumble, CPUs race too.

## Read first
- games/gnomylpics/src/config.ts: SCENES.dash, DASH, RUN, COLORS, MeetData, PlayerSlot, GAME_WIDTH
- games/gnomylpics/src/runner.ts: AlternatingRunner (tap(side) returns 'good' | 'stumble' | 'ignored'; update(dtS) returns metres moved; .speed; .stumbling) and CpuTapper (update(dtMs) returns 0 | 1 | null)
- games/gnomylpics/src/input.ts: listenTaps(scene, players, (playerIndex, side) => void)
- games/gnomylpics/src/lanes.ts: drawHeader, drawLane, addGnome, laneGround, laneTop, laneMessage, laneResult, countdown, dust
- games/gnomylpics/src/meet.ts: finishEvent(scene, meet, raw, display)
- games/gnomylpics/src/scenes/DashScene.ts: the stub you replace

## Change
- games/gnomylpics/src/scenes/DashScene.ts only. Keep `export class DashScene extends Phaser.Scene`, the constructor
  `super(SCENES.dash)`, and `create(data: MeetData): void`. Add `update(_time: number, delta: number): void`.

Behaviour:
1. IMPORTANT: Phaser reuses the scene instance for every new meet. Reset ALL per-race state inside create()
   (arrays, flags, timers); never rely on field initializers alone.
2. create(): `const meet = data.meet`. `drawHeader(this, meet, 'Alternate your two keys as fast as you can. Same key twice = STUMBLE!')`.
   For each player p in meet.players: `drawLane(this, p)`; draw the track at depth 1: a rectangle
   `this.add.rectangle(0, laneGround(i) - 22, GAME_WIDTH, 30, COLORS.track).setOrigin(0, 0).setDepth(1)`;
   a white start line at x = DASH.startX and a white finish line at x = DASH.startX + DASH.distanceM * DASH.pxPerM
   (rectangles 4 px wide spanning the track, depth 2, COLORS.trackLine); small "10m".."50m" labels
   every 10 m at depth 2. Then `addGnome(this, p, DASH.startX)` (origin is at the feet).
3. Per player state: `runner = new AlternatingRunner()`, `distM = 0`, `finishS: number | null = null`, `bobPhase = 0`,
   and for CPUs `new CpuTapper(p.skill)`.
4. `listenTaps(this, meet.players, (i, side) => this.onTap(i, side))`. Taps before GO and after a player finished are ignored.
   onTap: `const r = runner.tap(side)`. If r === 'stumble': `laneMessage(this, i, gnome.x, 'STUMBLE!', '#ff5252')`,
   `playSfx('stumble')` (import from '../audio'), and a quick tilt: `this.tweens.add({ targets: gnome, angle: 25, yoyo: true, duration: 200 })`.
   If r === 'good' and the player is human: `playSfx('tap')`.
5. `countdown(this, () => { this.running = true; this.goTime = this.time.now; })`.
6. update(): if not running or done, return. `dt = delta / 1000`. For each unfinished player: CPUs call
   `const s = cpu.update(delta); if (s !== null) this.onTap(i, s)`. Then `distM += runner.update(dt)`;
   gnome.x = DASH.startX + distM * DASH.pxPerM; running bob: `bobPhase += runner.speed * dt * 3`,
   gnome.y = laneGround(i) - Math.abs(Math.sin(bobPhase)) * 8; every ~0.25 s while speed > 3 call `dust(this, gnome.x - 10, laneGround(i))`.
   When distM >= DASH.distanceM: finishS = (this.time.now - goTime) / 1000, snap gnome to the finish line,
   `laneResult(this, i, finishS.toFixed(2) + ' s')`, `playSfx('cheer')` only for the first finisher, and a little hop tween.
7. Time limit: when (now - goTime) / 1000 > DASH.timeLimitS, every unfinished player gets DNF.
8. When every player has finishS or DNF: set done = true, then `this.time.delayedCall(1500, () => finishEvent(this, meet, raw, display))`
   with raw[i] = finishS (number) or null for DNF, display[i] = `${finishS.toFixed(2)} s` or 'DNF'. Call finishEvent exactly once.
9. Show a live speed meter per lane: a thin bar at the left under the name tag (x 10, y laneTop(i) + 32, max width 120)
   whose width is runner.speed / RUN.maxSpeed * 120, red tint while runner.stumbling.

Phaser 4 API to use: this.add.rectangle(x, y, w, h, color).setOrigin(0, 0).setDepth(n), this.add.text(x, y, str, style),
this.tweens.add({...}), this.time.now, this.time.delayedCall(ms, fn), rect.width = n (or rect.setSize(w, h)).

## Contract
- Scene key SCENES.dash ('Dash'); the scene receives `MeetData` ({ meet }) in create.
- Ends by calling `finishEvent(this, meet, raw: (number | null)[], display: string[])` once, arrays indexed by player index,
  raw in seconds (lower is better), null = DNF.
- Do not edit config.ts, runner.ts, input.ts, lanes.ts, meet.ts or audio.ts; put any extra visual constants at the top of DashScene.ts.

## Done when
- `npx tsc --noEmit -p games/gnomylpics` succeeds (other workers' scene files compile as stubs or finished files).
- Reading the code: alternating taps speed the gnome up, a repeated key triggers 'STUMBLE!', CPUs finish in roughly
  6-10 s, every player ends with a time or DNF, finishEvent is called once.

## Out of scope
All files other than games/gnomylpics/src/scenes/DashScene.ts.
~~~~
