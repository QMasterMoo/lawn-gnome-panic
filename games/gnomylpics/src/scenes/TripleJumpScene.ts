import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, SCENES, TEX, TRIPLE, type MeetData, type MeetState, type PlayerSlot } from '../config';
import { playSfx } from '../audio';
import { listenTaps } from '../input';
import { AlternatingRunner, CpuTapper } from '../runner';
import { addGnome, countdown, drawHeader, drawLane, dust, laneGround, laneMessage, laneResult } from '../lanes';
import { finishEvent } from '../meet';

/* Visual and timing constants local to this event. */
const TRACK_H = 24;
const TAKEOFF_MARK_W = 3;
const FOUL_LINE_W = 4;
const PIT_START_M = 7;               // sand pit starts this far past the foul line
const PIT_LABELS = [8, 10, 12, 14];  // metres past the foul line
const SAND_MARK = 0x9c7a3c;
const PERFECT_CSS = '#69f0ae';
const GOOD_CSS = '#ffd54f';
const FAIL_CSS = '#ff5252';
const JUMP_H_PX = [34, 28, 54];      // hop, skip, jump arc heights
const AIR_IGNORE_MS = 120;           // taps this soon after an air phase starts are not judged
const MIN_ZONE_SPEED = 4;            // m/s, so a slow player still reaches the line
const LANDING_SPEED_MULT = 0.85;     // speed kept after a GOOD landing
const RUN_LIMIT_MS = 25000;          // safety timeout after GO
const RESULT_DELAY_MS = 1500;

type Phase = 'wait' | 'run' | 'zone' | 'air' | 'done';

interface Athlete {
  slot: PlayerSlot;
  gnome: Phaser.GameObjects.Image;
  runner: AlternatingRunner;
  cpu: CpuTapper | null;
  phase: Phase;
  posM: number;          // metres along the lane, 0 = start
  speed: number;         // m/s, frozen at takeoff
  jumpIndex: number;     // 0 hop, 1 skip, 2 jump
  airFrom: number;       // metres
  airTo: number;         // metres
  airStart: number;      // ms
  airDur: number;        // ms
  landAt: number;        // ms
  landed: boolean;
  queuedTap: boolean;
  cpuTakeoffM: number;
  cpuTapAt: number | null;
  bob: number;
  resultM: number | null;
  display: string;
}

/** x in pixels of a position in metres along the lane. */
const xPx = (m: number): number => TRIPLE.startX + m * TRIPLE.pxPerM;

export class TripleJumpScene extends Phaser.Scene {
  private meet!: MeetState;
  private athletes: Athlete[] = [];
  private goTime: number | null = null;
  private finished = false;

  constructor() {
    super(SCENES.tripleJump);
  }

  create(data: MeetData): void {
    // Phaser reuses this scene for every meet: reset all per-event state here.
    this.meet = data.meet;
    this.goTime = null;
    this.finished = false;
    const meet = this.meet;

    drawHeader(this, meet, 'Alternate to sprint. In the last 4 m tap to take off (before the red line!), then tap each time you land.');
    this.athletes = meet.players.map((p) => {
      drawLane(this, p);
      this.drawTrackMarkings(p.index);
      return {
        slot: p,
        gnome: addGnome(this, p, xPx(0)),
        runner: new AlternatingRunner(),
        cpu: p.cpu ? new CpuTapper(p.skill) : null,
        phase: 'wait',
        posM: 0,
        speed: 0,
        jumpIndex: 0,
        airFrom: 0,
        airTo: 0,
        airStart: 0,
        airDur: 1,
        landAt: 0,
        landed: false,
        queuedTap: false,
        cpuTakeoffM: TRIPLE.runwayM,
        cpuTapAt: null,
        bob: 0,
        resultM: null,
        display: '',
      };
    });

    listenTaps(this, meet.players, (idx, side) => this.onHumanTap(idx, side));
    countdown(this, () => this.onGo());
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    const now = this.time.now;
    const dtS = delta / 1000;
    for (const a of this.athletes) {
      if (a.phase === 'run') this.updateRun(a, delta, now);
      else if (a.phase === 'zone') this.updateZone(a, dtS);
      else if (a.phase === 'air') this.updateAir(a, now);
    }
    if (this.athletes.length > 0 && this.athletes.every((a) => a.phase === 'done')) {
      this.finished = true;
      const raw = this.athletes.map((a) => a.resultM);
      const display = this.athletes.map((a) => a.display);
      const meet = this.meet;
      this.time.delayedCall(RESULT_DELAY_MS, () => finishEvent(this, meet, raw, display));
    }
  }

  /* ---------- setup ---------- */

  /** Runway, takeoff marker, foul line, sand pit and its distance labels for lane i. */
  private drawTrackMarkings(i: number): void {
    const ground = laneGround(i);
    const top = ground - 20;
    const pitX = xPx(TRIPLE.runwayM + PIT_START_M);
    this.add.rectangle(0, top, pitX, TRACK_H, COLORS.track).setOrigin(0, 0).setDepth(1);
    this.add.rectangle(xPx(TRIPLE.runwayM - TRIPLE.takeoffZoneM), top, TAKEOFF_MARK_W, TRACK_H, COLORS.trackLine).setOrigin(0, 0).setDepth(2);
    this.add.rectangle(xPx(TRIPLE.runwayM), top, FOUL_LINE_W, TRACK_H, COLORS.foul).setOrigin(0, 0).setDepth(2);
    this.add.tileSprite(pitX, top, GAME_WIDTH - pitX, TRACK_H, TEX.sand).setOrigin(0, 0).setDepth(1);
    for (const d of PIT_LABELS) {
      this.add
        .text(xPx(TRIPLE.runwayM + d), ground - 22, `${d}m`, {
          fontFamily: 'Arial Black, Arial', fontSize: '14px', color: COLORS.text, stroke: '#000000', strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(2);
    }
  }

  private onGo(): void {
    this.goTime = this.time.now;
    for (const a of this.athletes) {
      if (a.phase === 'wait') a.phase = 'run';
    }
  }

  /* ---------- input ---------- */

  private onHumanTap(index: number, side: 0 | 1): void {
    const a = this.athletes[index];
    if (!a) return;
    if (a.phase === 'run') this.runTap(a, side);
    else if (a.phase === 'zone') this.takeoff(a);
    else if (a.phase === 'air') this.airTap(a, this.time.now);
  }

  private runTap(a: Athlete, side: 0 | 1): void {
    if (a.runner.tap(side) === 'stumble') {
      laneMessage(this, a.slot.index, a.gnome.x, 'STUMBLE!', FAIL_CSS);
      playSfx('stumble');
    }
  }

  /** Judges a tap during an air phase at time `at`. Used for humans (at = now) and CPUs (scheduled time). */
  private airTap(a: Athlete, at: number): void {
    if (a.phase !== 'air' || a.jumpIndex === 2) return;
    if (at - a.airStart < AIR_IGNORE_MS) return;
    const delta = at - a.landAt;
    if (delta < -TRIPLE.goodWindowMs) {
      this.flop(a, 'TOO EARLY');
      return;
    }
    if (delta > TRIPLE.goodWindowMs) {
      this.flop(a, 'FLOP!');
      return;
    }
    if (a.queuedTap) return; // already judged for this landing

    const i = a.slot.index;
    const x = a.gnome.x;
    if (Math.abs(delta) <= TRIPLE.landWindowMs) {
      laneMessage(this, i, x, 'PERFECT!', PERFECT_CSS);
    } else {
      a.speed *= LANDING_SPEED_MULT;
      laneMessage(this, i, x, 'GOOD', GOOD_CSS);
    }

    if (delta < 0) {
      // Early but inside the window: the next phase starts exactly at the landing.
      a.queuedTap = true;
      return;
    }
    // After the landing: the gnome has been waiting on the ground, so the next phase starts now.
    this.land(a);
    if (a.phase === 'air') this.nextPhase(a, at);
  }

  /* ---------- phases ---------- */

  private takeoff(a: Athlete): void {
    a.phase = 'air';
    a.jumpIndex = 0;
    a.airTo = a.posM;
    this.startPhase(a, this.time.now);
  }

  /** Begins air phase a.jumpIndex at time t0, travelling speed * phaseMult metres from the current landing point. */
  private startPhase(a: Athlete, t0: number): void {
    const k = a.jumpIndex;
    a.airFrom = a.airTo;
    a.airTo = a.airFrom + a.speed * TRIPLE.phaseMult[k];
    a.airStart = t0;
    a.airDur = TRIPLE.phaseAirMs[k];
    a.landAt = t0 + a.airDur;
    a.landed = false;
    a.queuedTap = false;
    a.cpuTapAt = null;
    if (a.cpu && k < 2) {
      const spreadMs = 80 + 380 * (1 - a.slot.skill);
      a.cpuTapAt = a.landAt + Phaser.Math.FloatBetween(-1, 1) * spreadMs;
    }
    playSfx('jump');
  }

  private nextPhase(a: Athlete, t0: number): void {
    a.jumpIndex += 1;
    this.startPhase(a, t0);
  }

  /** The gnome touches down at the end of the current air phase. Ends the event for the jump. */
  private land(a: Athlete): void {
    if (a.landed) return;
    a.landed = true;
    a.posM = a.airTo;
    const i = a.slot.index;
    dust(this, xPx(a.posM), laneGround(i), a.jumpIndex === 2 ? 12 : 6, COLORS.sand);
    playSfx('land');
    if (a.jumpIndex === 2) {
      this.finishJump(a);
      return;
    }
    if (a.queuedTap) this.nextPhase(a, a.landAt);
  }

  private finishJump(a: Athlete): void {
    const i = a.slot.index;
    this.add.rectangle(xPx(a.posM), laneGround(i) - 3, 10, 4, SAND_MARK).setDepth(2);
    a.phase = 'done';
    a.resultM = Math.max(0, a.posM - TRIPLE.runwayM);
    a.display = `${a.resultM.toFixed(2)} m`;
    laneResult(this, i, a.display);
  }

  private flop(a: Athlete, message: string): void {
    a.phase = 'done';
    a.resultM = Math.max(0, a.posM - TRIPLE.runwayM);
    a.display = `${a.resultM.toFixed(2)} m`;
    laneMessage(this, a.slot.index, a.gnome.x, message, FAIL_CSS);
    playSfx('flop');
    this.tip(a);
    laneResult(this, a.slot.index, a.display);
  }

  private foul(a: Athlete): void {
    a.phase = 'done';
    a.resultM = null;
    a.display = 'FOUL';
    laneMessage(this, a.slot.index, a.gnome.x, 'FOUL!', FAIL_CSS);
    playSfx('flop');
    this.tip(a);
    laneResult(this, a.slot.index, 'FOUL');
  }

  private dnf(a: Athlete): void {
    a.phase = 'done';
    a.resultM = null;
    a.display = 'DNF';
    laneResult(this, a.slot.index, 'DNF');
  }

  private tip(a: Athlete): void {
    this.tweens.add({ targets: a.gnome, angle: 90, y: laneGround(a.slot.index), duration: 250 });
  }

  /* ---------- per-frame updates ---------- */

  private updateRun(a: Athlete, delta: number, now: number): void {
    if (this.goTime !== null && now - this.goTime >= RUN_LIMIT_MS) {
      this.dnf(a);
      return;
    }
    const dtS = delta / 1000;
    if (a.cpu) {
      const side = a.cpu.update(delta);
      if (side !== null) this.runTap(a, side);
    }
    a.posM += a.runner.update(dtS);
    this.sprint(a, a.runner.speed, dtS);
    if (a.posM >= TRIPLE.runwayM - TRIPLE.takeoffZoneM) this.enterZone(a);
  }

  private enterZone(a: Athlete): void {
    a.phase = 'zone';
    a.speed = Math.max(MIN_ZONE_SPEED, a.runner.speed);
    if (a.cpu) {
      const skill = a.slot.skill;
      a.cpuTakeoffM = Math.random() < 0.25 * (1 - skill)
        ? TRIPLE.runwayM + 0.2 // a deliberate foul
        : TRIPLE.runwayM - Phaser.Math.FloatBetween(0.05, 0.3 + 1.5 * (1 - skill));
    }
    laneMessage(this, a.slot.index, a.gnome.x, 'JUMP!', COLORS.accent);
  }

  private updateZone(a: Athlete, dtS: number): void {
    a.posM += a.speed * dtS;
    this.sprint(a, a.speed, dtS);
    if (a.posM > TRIPLE.runwayM) {
      this.foul(a);
      return;
    }
    if (a.cpu && a.posM >= a.cpuTakeoffM) this.takeoff(a);
  }

  private updateAir(a: Athlete, now: number): void {
    if (a.cpuTapAt !== null && now >= a.cpuTapAt) {
      const at = a.cpuTapAt;
      a.cpuTapAt = null;
      this.airTap(a, at);
    }
    if (a.phase !== 'air') return;

    const t = Phaser.Math.Clamp((now - a.airStart) / a.airDur, 0, 1);
    a.posM = a.airFrom + (a.airTo - a.airFrom) * t;
    a.gnome.x = xPx(a.posM);
    a.gnome.y = laneGround(a.slot.index) - 4 * JUMP_H_PX[a.jumpIndex] * t * (1 - t);

    if (!a.landed && now >= a.landAt) this.land(a);
    if (a.phase !== 'air') return;
    // No tap by the end of the good window after landing: flop.
    if (a.landed && !a.queuedTap && now >= a.landAt + TRIPLE.goodWindowMs) this.flop(a, 'FLOP!');
  }

  /** Sprinter bob and position for the run and zone phases. */
  private sprint(a: Athlete, speed: number, dtS: number): void {
    a.bob += speed * dtS * 3;
    a.gnome.x = xPx(a.posM);
    a.gnome.y = laneGround(a.slot.index) - Math.abs(Math.sin(a.bob)) * 8;
  }
}
