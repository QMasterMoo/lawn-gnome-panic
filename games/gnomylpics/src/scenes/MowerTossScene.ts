import Phaser from 'phaser';
import {
  GAME_WIDTH, PLAYER_COLORS, SCENES, TEX, TOSS, type MeetData, type MeetState, type PlayerSlot,
} from '../config';
import { AlternatingRunner, CpuTapper } from '../runner';
import { BothKeysDetector, listenTaps } from '../input';
import { addGnome, countdown, drawHeader, drawLane, dust, laneGround, laneMessage, laneResult, laneTop } from '../lanes';
import { playSfx } from '../audio';
import { finishEvent } from '../meet';

type Phase = 'wait' | 'spin' | 'flight' | 'skid' | 'done';

/** Visual and layout constants for this event. */
const DISTANCE_STEP_M = 10;
const DISTANCE_MAX_M = 110;
const HAND_H_M = 1.2;          // release height in metres
const DUD_SPEED = 2;           // m/s; slower releases plop at 1 m
const DUD_LANDING_M = 1;
const NEEDLE_LEN = 46;
const NEEDLE_CHEST_DY = 28;    // needle origin: this many px above the ground
const NEEDLE_GREEN_TOL_DEG = 7;
const TARGET_DEG = 45;
const SKID_MS = 450;
const RESULT_DELAY_MS = 1500;
const METER_W = 120;
const METER_H = 6;
const MOWER_ORBIT_Y_PX = 10;
const MOWER_RIDE_DY_PX = 22;   // mower sits this many px above the ground while spinning
const MOWER_SPIN_RATE = 8;     // rad/s of visual rotation while in flight
const COL_GUIDE = 0xffffff;
const COL_NEEDLE = 0xffffff;
const COL_NEEDLE_HIT = 0x69f0ae;
const COL_CIRCLE = 0x9e9e9e;
const COL_METER_BG = 0x000000;

interface Thrower {
  p: PlayerSlot;
  cpu: CpuTapper | null;
  spinner: AlternatingRunner;
  both: BothKeysDetector;
  phase: Phase;
  gnome: Phaser.GameObjects.Image;
  mower: Phaser.GameObjects.Image;
  needle: Phaser.GameObjects.Graphics;
  meter: Phaser.GameObjects.Graphics;
  needlePhase: number;
  orbitAngle: number;
  angleDeg: number;
  x: number;   // flight distance, metres
  h: number;   // flight height, metres
  vx: number;  // m/s
  vh: number;  // m/s
  resultM: number;
}

/** Metres along the lane from the thrower to screen x. */
function xPx(m: number): number {
  return TOSS.startX + m * TOSS.pxPerM;
}

/** Keeps the drawn mower on screen; the metres still count past the edge. */
function clampX(x: number): number {
  return Math.min(x, GAME_WIDTH - 20);
}

/** Hammer throw with a lawn mower: all lanes spin at once, both keys release, the mower flies, lands and skids. */
export class MowerTossScene extends Phaser.Scene {
  private throwers: Thrower[] = [];
  private goTime = 0;
  private finished = false;
  private meetRef: MeetState | null = null;

  constructor() {
    super(SCENES.mowerToss);
  }

  create(data: MeetData): void {
    const meet = data.meet;
    // Phaser reuses this scene instance for every meet: reset all per-event state here.
    this.throwers = [];
    this.goTime = 0;
    this.finished = false;
    this.meetRef = meet;

    drawHeader(this, meet, 'Alternate to spin the mower. Press BOTH keys together to let go when the needle is near 45°.');
    meet.players.forEach((p) => {
      drawLane(this, p);
      this.throwers.push(this.setupThrower(p));
    });
    listenTaps(this, meet.players, (i, side) => this.onTap(i, side));
    countdown(this, () => this.goSpin());
  }

  update(_time: number, delta: number): void {
    const dtS = delta / 1000;
    for (const t of this.throwers) {
      if (t.phase === 'spin') this.updateSpin(t, delta, dtS);
      else if (t.phase === 'flight') this.updateFlight(t, dtS);
    }
  }

  private setupThrower(p: PlayerSlot): Thrower {
    const i = p.index;
    const ground = laneGround(i);
    const cx = xPx(0);

    this.add.ellipse(cx, ground, 50, 14, COL_CIRCLE).setDepth(1);
    for (let d = DISTANCE_STEP_M; d <= DISTANCE_MAX_M; d += DISTANCE_STEP_M) {
      const x = xPx(d);
      this.add.rectangle(x, ground - 20, 2, 40, 0xffffff).setAlpha(0.6).setDepth(1);
      this.add
        .text(x, ground + 2, `${d}m`, { fontFamily: 'Arial', fontSize: '12px', color: '#ffffff' })
        .setOrigin(0.5, 0)
        .setDepth(2);
    }

    const gnome = addGnome(this, p, cx);
    const mower = this.add.image(cx + TOSS.orbitPx, ground - MOWER_RIDE_DY_PX, TEX.mower).setDepth(11);
    const needle = this.add.graphics().setDepth(12).setVisible(false);
    const meter = this.add.graphics().setDepth(40);

    return {
      p,
      cpu: p.cpu ? new CpuTapper(p.skill) : null,
      spinner: new AlternatingRunner(TOSS.spinPerTap, TOSS.maxSpin, TOSS.spinDragPerSec),
      both: new BothKeysDetector(TOSS.bothKeysWindowMs),
      phase: 'wait',
      gnome,
      mower,
      needle,
      meter,
      needlePhase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      orbitAngle: 0,
      angleDeg: TOSS.needleMinDeg,
      x: 0,
      h: HAND_H_M,
      vx: 0,
      vh: 0,
      resultM: 0,
    };
  }

  /** Countdown finished: everyone starts spinning. */
  private goSpin(): void {
    this.goTime = this.time.now;
    for (const t of this.throwers) {
      t.phase = 'spin';
      t.needle.setVisible(true);
    }
  }

  private onTap(i: number, side: 0 | 1): void {
    const t = this.throwers[i];
    if (!t || t.phase !== 'spin') return;
    // Both keys together let go. CPUs never press both keys, so only humans can trigger this.
    if (!t.p.cpu && t.both.tap(side, this.time.now)) {
      this.release(t);
      return;
    }
    const r = t.spinner.tap(side);
    if (r === 'stumble') {
      laneMessage(this, i, xPx(0), 'SLIP!', '#ff5252');
      playSfx('stumble');
    } else if (r === 'good' && !t.p.cpu) {
      playSfx('tap');
    }
  }

  private updateSpin(t: Thrower, deltaMs: number, dtS: number): void {
    const i = t.p.index;

    if (t.cpu) {
      const side = t.cpu.update(deltaMs);
      if (side !== null) this.onTap(i, side);
      if (t.phase !== 'spin') return; // the CPU tap may have released the mower
    }

    t.spinner.update(dtS);
    t.orbitAngle += t.spinner.speed * dtS;

    const ground = laneGround(i);
    t.mower.setPosition(xPx(0) + Math.cos(t.orbitAngle) * TOSS.orbitPx, ground - MOWER_RIDE_DY_PX + Math.sin(t.orbitAngle) * MOWER_ORBIT_Y_PX);
    t.mower.rotation = t.orbitAngle;
    t.gnome.setFlipX(Math.cos(t.orbitAngle) < 0);

    const now = this.time.now;
    t.angleDeg = this.angleAt(t, now);
    this.drawNeedle(t);
    this.drawMeter(t);

    const elapsedS = (now - this.goTime) / 1000;
    if (elapsedS >= TOSS.spinTimeS) {
      this.release(t);
      return;
    }
    if (t.cpu) {
      const skill = t.p.skill;
      const mustSpinFor = TOSS.spinTimeS * (0.55 + 0.35 * skill);
      const tolDeg = 4 + 22 * (1 - skill);
      if (elapsedS >= mustSpinFor && Math.abs(t.angleDeg - TARGET_DEG) <= tolDeg) this.release(t);
    }
  }

  /** Release angle in degrees at the given scene time. */
  private angleAt(t: Thrower, nowMs: number): number {
    const mid = (TOSS.needleMinDeg + TOSS.needleMaxDeg) / 2;
    const amp = (TOSS.needleMaxDeg - TOSS.needleMinDeg) / 2;
    const tS = (nowMs - this.goTime) / 1000;
    return mid + amp * Math.sin(t.needlePhase + (tS * 2 * Math.PI) / TOSS.needlePeriodS);
  }

  private drawNeedle(t: Thrower): void {
    const g = t.needle;
    const cx = xPx(0);
    const cy = laneGround(t.p.index) - NEEDLE_CHEST_DY;
    g.clear();

    const guide = Phaser.Math.DegToRad(TARGET_DEG);
    g.lineStyle(2, COL_GUIDE, 0.25);
    g.lineBetween(cx, cy, cx + Math.cos(guide) * NEEDLE_LEN, cy - Math.sin(guide) * NEEDLE_LEN);

    const a = Phaser.Math.DegToRad(t.angleDeg);
    const hit = Math.abs(t.angleDeg - TARGET_DEG) <= NEEDLE_GREEN_TOL_DEG;
    g.lineStyle(3, hit ? COL_NEEDLE_HIT : COL_NEEDLE, 1);
    g.lineBetween(cx, cy, cx + Math.cos(a) * NEEDLE_LEN, cy - Math.sin(a) * NEEDLE_LEN);
  }

  private drawMeter(t: Thrower): void {
    const g = t.meter;
    const x = 10;
    const y = laneTop(t.p.index) + 32;
    g.clear();
    g.fillStyle(COL_METER_BG, 0.4);
    g.fillRect(x, y, METER_W, METER_H);
    g.fillStyle(PLAYER_COLORS[t.p.index], 1);
    const w = Math.min(METER_W, (t.spinner.speed / TOSS.maxSpin) * METER_W);
    g.fillRect(x, y, w, METER_H);
  }

  private release(t: Thrower): void {
    const i = t.p.index;
    t.phase = 'flight';
    playSfx('whoosh');

    t.angleDeg = this.angleAt(t, this.time.now);
    const a = Phaser.Math.DegToRad(t.angleDeg);
    const v = t.spinner.speed * TOSS.releaseSpeedPerSpin;
    t.vx = v * Math.cos(a);
    t.vh = v * Math.sin(a);
    t.x = 0;
    t.h = HAND_H_M;

    if (v < DUD_SPEED) {
      // A dud: the mower plops straight down at 1 m.
      t.x = DUD_LANDING_M;
      t.h = 0;
      t.vx = 0;
      t.vh = 0;
    }

    laneMessage(this, i, xPx(0) + 40, `${Math.round(t.angleDeg)}°`);
    t.needle.setVisible(false);
    t.meter.clear();
  }

  private updateFlight(t: Thrower, dtS: number): void {
    t.vh -= TOSS.gravity * dtS;
    t.x += t.vx * dtS;
    t.h += t.vh * dtS;
    t.mower.rotation += MOWER_SPIN_RATE * dtS;

    if (t.h > 0) {
      t.mower.setPosition(clampX(xPx(t.x)), laneGround(t.p.index) - t.h * TOSS.heightPxPerM);
      return;
    }
    this.land(t);
  }

  private land(t: Thrower): void {
    const i = t.p.index;
    const ground = laneGround(i);
    t.h = 0;
    t.phase = 'skid';
    t.mower.setPosition(clampX(xPx(t.x)), ground);
    playSfx('thud');
    dust(this, t.mower.x, ground, 10);

    const skid = t.vx * TOSS.skidMult;
    t.resultM = t.x + skid;
    this.tweens.add({
      targets: t.mower,
      x: clampX(xPx(t.resultM)),
      rotation: 0,
      duration: SKID_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => this.settle(t),
    });
  }

  private settle(t: Thrower): void {
    const i = t.p.index;
    const ground = laneGround(i);
    t.phase = 'done';
    laneResult(this, i, `${t.resultM.toFixed(1)} m`);

    // Flag marker at the landing spot.
    const fx = clampX(xPx(t.resultM));
    this.add.rectangle(fx, ground - 15, 2, 30, 0xffffff).setDepth(20);
    this.add.triangle(fx + 8, ground - 26, 0, 0, 12, 4, 0, 8, PLAYER_COLORS[i]).setDepth(20);

    if (this.finished || !this.throwers.every((x) => x.phase === 'done')) return;
    this.finished = true;
    const meet = this.meetRef;
    if (!meet) return;
    const raw: (number | null)[] = this.throwers.map((x) => x.resultM);
    const display = raw.map((r) => (r === null ? 'DNF' : `${r.toFixed(1)} m`));
    this.time.delayedCall(RESULT_DELAY_MS, () => finishEvent(this, meet, raw, display));
  }
}
