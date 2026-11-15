~~~~text
Epic: 2 Events
Depends on: none

## Environment
Working directory: C:\Users\cpsai\cstabnick\lawn-gnome-panic\.claude\worktrees\gnomylpics (a git worktree; stay inside it).
Git Bash: if `node` is not found run `export PATH="/c/Program Files/nodejs:$PATH"`. Dependencies are installed.
Game: games/gnomylpics (Vite + TypeScript strict + Phaser 4.2.1). Two other workers are editing
src/scenes/DashScene.ts and src/scenes/MowerTossScene.ts at the same time; do not touch them.
Do not run git commit. Do not start a dev server. Do not run `vite build`.

## Goal
Replace the stub in games/gnomylpics/src/scenes/TripleJumpScene.ts with the real Triple Jump: all 4 lanes jump at
once. Alternate two keys to sprint, tap to take off before the red foul line, then tap on each landing to chain
hop, skip and jump into the sand. CPUs compete too.

## Read first
- games/gnomylpics/src/config.ts: SCENES.tripleJump, TRIPLE, RUN, COLORS, TEX.sand, MeetData, PlayerSlot, GAME_WIDTH
- games/gnomylpics/src/runner.ts: AlternatingRunner (tap(side) returns 'good' | 'stumble' | 'ignored'; update(dtS) returns metres moved; .speed; .stumbling) and CpuTapper (update(dtMs) returns 0 | 1 | null)
- games/gnomylpics/src/input.ts: listenTaps(scene, players, (playerIndex, side) => void)
- games/gnomylpics/src/lanes.ts: drawHeader, drawLane, addGnome, laneGround, laneTop, laneMessage, laneResult, countdown, dust
- games/gnomylpics/src/meet.ts: finishEvent(scene, meet, raw, display)

## Change
- games/gnomylpics/src/scenes/TripleJumpScene.ts only. Keep `export class TripleJumpScene extends Phaser.Scene`, the
  constructor `super(SCENES.tripleJump)`, and `create(data: MeetData): void`. Add `update(_time: number, delta: number): void`.

World: positions are metres along the lane, 0 = start. x_px(m) = TRIPLE.startX + m * TRIPLE.pxPerM.
Foul line at m = TRIPLE.runwayM (25 m → x 710). The result is measured from the foul line.

Behaviour:
1. IMPORTANT: Phaser reuses the scene instance for every new meet. Reset ALL per-event state inside create().
2. create(): drawHeader(this, meet, 'Alternate to sprint. In the last 4 m tap to take off (before the red line!), then tap each time you land.').
   Per lane: drawLane(this, p); runway rectangle (COLORS.track, height 24, top at laneGround(i) - 20, from x 0 to the pit, depth 1);
   a white takeoff-zone marker at m = runwayM - TRIPLE.takeoffZoneM; a red (COLORS.foul) 4 px foul line at m = runwayM, depth 2;
   a sand pit from m = runwayM + 7 to the right edge: `this.add.tileSprite(x, laneGround(i) - 20, width, 24, TEX.sand).setOrigin(0, 0).setDepth(1)`;
   labels "8m", "10m", "12m", "14m" above the pit at m = runwayM + 8 etc. (depth 2). Then addGnome(this, p, x_px(0)).
3. Per player state machine `phase`: 'wait' → 'run' → 'zone' → 'air' → 'done'. Fields: runner = new AlternatingRunner(),
   posM, speed (frozen at takeoff), jumpIndex (0 hop, 1 skip, 2 jump), air start time, air from/to metres, landAt (ms),
   queuedTap (boolean), resultM: number | null, display string; CPUs: new CpuTapper(p.skill) plus planned takeoff point
   and planned landing tap offsets (see 8).
4. countdown(this, ...) sets every phase to 'run' and goTime = this.time.now.
5. 'run': taps go to runner.tap(side) (same stumble message/sfx as below); each frame posM += runner.update(dt).
   On 'stumble': laneMessage(this, i, gnome.x, 'STUMBLE!', '#ff5252'); playSfx('stumble') (import from '../audio').
   When posM >= runwayM - TRIPLE.takeoffZoneM → phase 'zone'; laneMessage 'JUMP!'.
6. 'zone': no more drag; the gnome keeps runner.speed (store it in speed, minimum 4 m/s so a slow player still reaches
   the line) and posM += speed * dt. Any tap → takeoff at posM. If posM passes runwayM first → FOUL: phase 'done',
   resultM = null, display 'FOUL', laneMessage 'FOUL!' red, playSfx('flop'), the gnome tips over (angle 90 tween).
7. 'air': phase k uses distance d = speed * TRIPLE.phaseMult[k] and duration TRIPLE.phaseAirMs[k]. Animate manually in
   update: t = (now - airStart) / dur clamped 0..1, posM = from + d * t, gnome.y = laneGround(i) - 4 * H[k] * t * (1 - t)
   with H = [34, 28, 54] px. playSfx('jump') at each takeoff. landAt = airStart + dur.
   - Timing for k = 0 and 1 (landing on the runway): a tap at time T is judged by delta = T - landAt.
     A tap with delta < -TRIPLE.goodWindowMs (too early, mashing) → flop with message 'TOO EARLY'.
     |delta| <= TRIPLE.landWindowMs → 'PERFECT!' (green), speed unchanged. |delta| <= TRIPLE.goodWindowMs → 'GOOD' (yellow), speed *= 0.85.
     A tap before landAt that is inside the window is remembered (queuedTap) and the next phase starts exactly at landAt.
     A tap after landAt starts the next phase at that moment (the gnome waits on the ground, playSfx('land'), dust).
     No tap by landAt + goodWindowMs → flop with message 'FLOP!'.
   - Flop: playSfx('flop'), gnome tips over, phase 'done', resultM = max(0, posM - runwayM), display `${resultM.toFixed(2)} m`.
   - k = 2 lands in the sand: no tap needed. dust(this, gnome.x, laneGround(i), 12, 0xe6c27a), playSfx('land'),
     resultM = posM - runwayM (distance from the foul line; taking off early costs distance), phase 'done',
     laneResult(this, i, resultM.toFixed(2) + ' m'), and a small sand mark at the landing point.
   - Ignore taps during the first 120 ms of every air phase (so the takeoff tap is not judged).
8. CPUs: in 'run' use cpu.update(delta) → this.onTap. On entering 'zone' pick takeoffM = runwayM - FloatBetween(0.05, 0.3 + 1.5 * (1 - skill));
   with chance 0.25 * (1 - skill) instead pick runwayM + 0.2 (a foul). Take off when posM >= takeoffM.
   For each landing (k = 0, 1) pick offsetMs = FloatBetween(-1, 1) * (80 + 380 * (1 - skill)) and tap at landAt + offsetMs
   (use the same judging code as humans).
9. Running bob while 'run'/'zone' like a sprinter: gnome.y = laneGround(i) - Math.abs(Math.sin(bob)) * 8, bob += speed * dt * 3.
10. Safety timeout: 25 s after GO, any player still in 'run' becomes DNF (resultM null, display 'DNF').
11. When all players are 'done': done = true and `this.time.delayedCall(1500, () => finishEvent(this, meet, raw, display))`
    with raw[i] = resultM (null for FOUL/DNF). Call finishEvent exactly once.

Phaser 4 API: this.add.rectangle(x, y, w, h, color).setOrigin(0, 0).setDepth(n), this.add.tileSprite(x, y, w, h, key),
this.add.text, this.tweens.add, this.time.now, this.time.delayedCall, Phaser.Math.FloatBetween, Phaser.Math.Clamp.

## Contract
- Scene key SCENES.tripleJump ('TripleJump'); create(data: MeetData).
- Ends by calling `finishEvent(this, meet, raw: (number | null)[], display: string[])` once, indexed by player index,
  raw in metres (higher is better), null = FOUL/DNF.
- Do not edit config.ts, runner.ts, input.ts, lanes.ts, meet.ts or audio.ts; put extra visual constants at the top of TripleJumpScene.ts.

## Done when
- `npx tsc --noEmit -p games/gnomylpics` succeeds.
- Reading the code: humans and CPUs can foul, flop or land; a full-speed perfect sequence lands around 11-12 m;
  finishEvent is called exactly once.

## Out of scope
All files other than games/gnomylpics/src/scenes/TripleJumpScene.ts.
~~~~
