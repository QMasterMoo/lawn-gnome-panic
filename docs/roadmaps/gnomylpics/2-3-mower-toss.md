~~~~text
Epic: 2 Events
Depends on: none

## Environment
Working directory: C:\Users\cpsai\cstabnick\lawn-gnome-panic\.claude\worktrees\gnomylpics (a git worktree; stay inside it).
Git Bash: if `node` is not found run `export PATH="/c/Program Files/nodejs:$PATH"`. Dependencies are installed.
Game: games/gnomylpics (Vite + TypeScript strict + Phaser 4.2.1). Two other workers are editing
src/scenes/DashScene.ts and src/scenes/TripleJumpScene.ts at the same time; do not touch them.
Do not run git commit. Do not start a dev server. Do not run `vite build`.

## Goal
Replace the stub in games/gnomylpics/src/scenes/MowerTossScene.ts with the real Mower Toss (hammer throw with a lawn
mower): all 4 lanes throw at once. Alternate two keys to spin the mower up, press both keys together to let go while a
sweeping angle needle is near 45 degrees, and the mower flies, lands and skids. Longest throw wins. CPUs throw too.

## Read first
- games/gnomylpics/src/config.ts: SCENES.mowerToss, TOSS, COLORS, TEX.mower, MeetData, PlayerSlot, GAME_WIDTH
- games/gnomylpics/src/runner.ts: AlternatingRunner (constructor(boost, max, drag); tap(side) returns 'good' | 'stumble' | 'ignored'; update(dtS); .speed; .stumbling) and CpuTapper (update(dtMs) returns 0 | 1 | null)
- games/gnomylpics/src/input.ts: listenTaps(scene, players, (playerIndex, side) => void) and BothKeysDetector (new BothKeysDetector(windowMs); tap(side, nowMs) returns true when both keys were pressed within the window)
- games/gnomylpics/src/lanes.ts: drawHeader, drawLane, addGnome, laneGround, laneTop, laneMessage, laneResult, countdown, dust
- games/gnomylpics/src/meet.ts: finishEvent(scene, meet, raw, display)

## Change
- games/gnomylpics/src/scenes/MowerTossScene.ts only. Keep `export class MowerTossScene extends Phaser.Scene`, the
  constructor `super(SCENES.mowerToss)`, and `create(data: MeetData): void`. Add `update(_time: number, delta: number): void`.

World: metres along the lane from the thrower. x_px(m) = TOSS.startX + m * TOSS.pxPerM (100 m = x 1070).
Height: y_px(h) = laneGround(i) - h * TOSS.heightPxPerM.

Behaviour:
1. IMPORTANT: Phaser reuses the scene instance for every new meet. Reset ALL per-event state inside create().
2. create(): drawHeader(this, meet, 'Alternate to spin the mower. Press BOTH keys together to let go when the needle is near 45°.').
   Per lane: drawLane(this, p); a grey throwing circle under the thrower (ellipse at x_px(0), laneGround(i), 50x14, depth 1);
   white distance lines every 10 m from 10 m to 110 m (2 px wide, 40 px tall, ending at the ground, alpha 0.6, depth 1) with
   labels "10m", "20m"... (depth 2). addGnome(this, p, x_px(0)). The mower: `this.add.image(x, y, TEX.mower).setDepth(11)`.
   The angle needle: a Graphics object per lane (depth 12), redrawn each frame while spinning: a line of length 46 from
   the gnome's chest (x_px(0), laneGround(i) - 28) at the current release angle (up and to the right), green when within
   ±7° of 45, white otherwise, plus a faint 45° guide line.
3. Per player state `phase`: 'wait' → 'spin' → 'flight' → 'skid' → 'done'. Fields: spinner =
   new AlternatingRunner(TOSS.spinPerTap, TOSS.maxSpin, TOSS.spinDragPerSec) (its .speed is the spin in rad/s),
   orbitAngle, both = new BothKeysDetector(TOSS.bothKeysWindowMs), needlePhase (random 0..2π per player so lanes differ),
   flight x/h metres and vx/vh m/s, resultM. CPUs: new CpuTapper(p.skill).
4. countdown(this, ...) sets phase 'spin' for everyone and goTime = this.time.now.
5. Release angle in degrees at time t (s since GO): mid = (needleMinDeg + needleMaxDeg) / 2, amp = (needleMaxDeg - needleMinDeg) / 2,
   angleDeg = mid + amp * Math.sin(needlePhase + t * 2 * Math.PI / TOSS.needlePeriodS).
6. Taps while 'spin' (onTap(i, side)): first `if (both.tap(side, this.time.now)) { release(i); return; }`, then
   `const r = spinner.tap(side)`; on 'stumble': laneMessage(this, i, x_px(0), 'SLIP!', '#ff5252'), playSfx('stumble')
   (import playSfx from '../audio'); on 'good' for humans playSfx('tap').
7. 'spin' each frame: spinner.update(dt) (applies drag); orbitAngle += spinner.speed * dt; mower position on an ellipse:
   x = x_px(0) + Math.cos(orbitAngle) * TOSS.orbitPx, y = laneGround(i) - 22 + Math.sin(orbitAngle) * 10;
   mower.rotation = orbitAngle; flip the gnome (setFlipX) by the sign of Math.cos(orbitAngle) so it looks like it spins.
   A spin meter bar under the name tag (x 10, y laneTop(i) + 32, width spinner.speed / TOSS.maxSpin * 120).
   When (now - goTime) / 1000 >= TOSS.spinTimeS, release(i) automatically.
8. release(i): playSfx('whoosh'); a = current angleDeg in radians; v = spinner.speed * TOSS.releaseSpeedPerSpin;
   vx = v * cos(a), vh = v * sin(a); x = 0, h = 1.2 (hand height); laneMessage(this, i, x_px(0) + 40, `${Math.round(angleDeg)}°`);
   hide that lane's needle; phase 'flight'. A release with v < 2 m/s is a dud: the mower plops at 1 m.
9. 'flight' each frame: vh -= TOSS.gravity * dt; x += vx * dt; h += vh * dt; mower at (x_px(x), y_px(h)), mower.rotation += 8 * dt.
   Clamp the drawn x to GAME_WIDTH - 20 (the metres keep counting). When h <= 0: playSfx('thud'), dust(this, mower.x, laneGround(i), 10),
   skid = vx * TOSS.skidMult, phase 'skid', tween the mower to x_px(x + skid) (clamped) over 450 ms with ease 'Cubic.easeOut',
   rotation back to 0; on complete resultM = x + skid, phase 'done', laneResult(this, i, resultM.toFixed(1) + ' m'),
   and a small flag marker (thin rect + player-coloured triangle via this.add.triangle) at the landing spot.
10. CPUs: while spinning call cpu.update(delta) → onTap. Release decision: once (now - goTime) / 1000 >= TOSS.spinTimeS * (0.55 + 0.35 * skill),
    release when |angleDeg - 45| <= 4 + 22 * (1 - skill) (check each frame). The automatic release in 7 still applies.
11. When every player is 'done': done = true, `this.time.delayedCall(1500, () => finishEvent(this, meet, raw, display))`,
    raw[i] = resultM, display[i] = `${resultM.toFixed(1)} m`. Call finishEvent exactly once.

Expected numbers: max spin 22 rad/s → 33 m/s → about 111 m at 45°; a decent human ~14-18 rad/s → 45-75 m.

Phaser 4 API: this.add.image, this.add.graphics() then g.clear(); g.lineStyle(width, color, alpha); g.lineBetween(x1, y1, x2, y2);
this.add.ellipse(x, y, w, h, color), this.add.triangle(x, y, x1, y1, x2, y2, x3, y3, color), this.add.rectangle,
this.tweens.add, this.time.now, this.time.delayedCall, Phaser.Math.FloatBetween, image.setFlipX(bool).

## Contract
- Scene key SCENES.mowerToss ('MowerToss'); create(data: MeetData).
- Ends by calling `finishEvent(this, meet, raw: (number | null)[], display: string[])` once, indexed by player index,
  raw in metres (higher is better).
- Do not edit config.ts, runner.ts, input.ts, lanes.ts, meet.ts or audio.ts; put extra visual constants at the top of MowerTossScene.ts.

## Done when
- `npx tsc --noEmit -p games/gnomylpics` succeeds.
- Reading the code: spinning raises the spin meter, both keys release, CPUs throw 40-100 m depending on skill, the mower
  lands and skids, finishEvent is called exactly once.

## Out of scope
All files other than games/gnomylpics/src/scenes/MowerTossScene.ts.
~~~~
