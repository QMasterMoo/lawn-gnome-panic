import Phaser from 'phaser';
import { COLORS, DASH, GAME_WIDTH, RUN, SCENES, type MeetData, type MeetState, type PlayerSlot } from '../config';
import { addGnome, countdown, drawHeader, drawLane, dust, laneGround, laneMessage, laneResult, laneTop } from '../lanes';
import { finishEvent } from '../meet';
import { AlternatingRunner, CpuTapper } from '../runner';
import { listenTaps } from '../input';
import { playSfx } from '../audio';

/* Visual constants for the dash (kept local on purpose). */
const TRACK_H = 30;            // track band height in px
const TRACK_ABOVE_GROUND = 22; // track band top sits this far above the ground line
const LINE_W = 4;              // start and finish line width in px
const LABEL_EVERY_M = 10;      // metre labels every 10 m
const METER_X = 10;
const METER_DY = 32;           // meter y offset from lane top
const METER_W = 120;
const METER_H = 6;
const METER_OK = 0x66bb6a;
const METER_STUMBLE = 0xff5252;
const METER_BG = 0x000000;
const BOB_PX = 8;              // running bob height in px
const DUST_EVERY_MS = 250;
const DUST_MIN_SPEED = 3;      // m/s
const FINISH_HOP_PX = 20;
const RESULT_DELAY_MS = 1500;

/** The 60 m Gnome Dash: 4 lanes race at once. Alternate your two keys to run; the same key twice is a stumble. */
export class DashScene extends Phaser.Scene {
  // Per-race state. Phaser reuses this scene instance for every meet, so create() resets all of it.
  private raceMeet!: MeetState;
  private players: PlayerSlot[] = [];
  private gnomes: Phaser.GameObjects.Image[] = [];
  private meters: Phaser.GameObjects.Rectangle[] = [];
  private runners: AlternatingRunner[] = [];
  private cpus: (CpuTapper | null)[] = [];
  private distM: number[] = [];
  private finishS: (number | null)[] = [];
  private over: boolean[] = [];   // finished or DNF
  private bobPhase: number[] = [];
  private dustMs: number[] = [];
  private firstFinisher = true;
  private running = false;
  private done = false;
  private goTime = 0;

  constructor() {
    super(SCENES.dash);
  }

  create(data: MeetData): void {
    const meet = data.meet;
    this.raceMeet = meet;
    this.players = meet.players;
    this.gnomes = [];
    this.meters = [];
    this.runners = [];
    this.cpus = [];
    this.distM = [];
    this.finishS = [];
    this.over = [];
    this.bobPhase = [];
    this.dustMs = [];
    this.firstFinisher = true;
    this.running = false;
    this.done = false;
    this.goTime = 0;

    drawHeader(this, meet, 'Alternate your two keys as fast as you can. Same key twice = STUMBLE!');

    const finishX = DASH.startX + DASH.distanceM * DASH.pxPerM;
    meet.players.forEach((p) => {
      const i = p.index;
      drawLane(this, p);
      const ground = laneGround(i);
      const trackY = ground - TRACK_ABOVE_GROUND;

      this.add.rectangle(0, trackY, GAME_WIDTH, TRACK_H, COLORS.track).setOrigin(0, 0).setDepth(1);
      this.add.rectangle(DASH.startX, trackY, LINE_W, TRACK_H, COLORS.trackLine).setOrigin(0, 0).setDepth(2);
      this.add.rectangle(finishX, trackY, LINE_W, TRACK_H, COLORS.trackLine).setOrigin(0, 0).setDepth(2);
      for (let m = LABEL_EVERY_M; m < DASH.distanceM; m += LABEL_EVERY_M) {
        this.add
          .text(DASH.startX + m * DASH.pxPerM + 6, trackY + 2, `${m}m`, { fontFamily: 'Arial', fontSize: '14px', color: COLORS.text })
          .setDepth(2);
      }

      this.gnomes[i] = addGnome(this, p, DASH.startX);

      this.add.rectangle(METER_X, laneTop(i) + METER_DY, METER_W, METER_H, METER_BG, 0.5).setOrigin(0, 0).setDepth(40);
      this.meters[i] = this.add
        .rectangle(METER_X, laneTop(i) + METER_DY, 0, METER_H, METER_OK)
        .setOrigin(0, 0)
        .setDepth(41);

      this.runners[i] = new AlternatingRunner();
      this.cpus[i] = p.cpu ? new CpuTapper(p.skill) : null;
      this.distM[i] = 0;
      this.finishS[i] = null;
      this.over[i] = false;
      this.bobPhase[i] = 0;
      this.dustMs[i] = 0;
    });

    listenTaps(this, meet.players, (i, side) => this.onTap(i, side));

    countdown(this, () => {
      this.running = true;
      this.goTime = this.time.now;
    });
  }

  update(_time: number, delta: number): void {
    if (!this.running || this.done) return;
    const dt = delta / 1000;

    const elapsedS = (this.time.now - this.goTime) / 1000;
    if (elapsedS > DASH.timeLimitS) {
      for (const p of this.players) {
        if (!this.over[p.index]) this.markDnf(p.index);
      }
      this.checkDone();
      if (this.done) return;
    }

    for (const p of this.players) {
      const i = p.index;
      if (this.over[i]) continue;

      const cpu = this.cpus[i];
      if (cpu) {
        const s = cpu.update(delta);
        if (s !== null) this.onTap(i, s);
      }

      const runner = this.runners[i];
      this.distM[i] += runner.update(dt);
      const gnome = this.gnomes[i];
      gnome.x = DASH.startX + this.distM[i] * DASH.pxPerM;

      this.bobPhase[i] += runner.speed * dt * 3;
      gnome.y = laneGround(i) - Math.abs(Math.sin(this.bobPhase[i])) * BOB_PX;

      this.dustMs[i] -= delta;
      if (runner.speed > DUST_MIN_SPEED && this.dustMs[i] <= 0) {
        dust(this, gnome.x - 10, laneGround(i));
        this.dustMs[i] = DUST_EVERY_MS;
      }

      const meter = this.meters[i];
      meter.setSize(Math.min(1, runner.speed / RUN.maxSpeed) * METER_W, METER_H);
      meter.setFillStyle(runner.stumbling ? METER_STUMBLE : METER_OK);

      if (this.distM[i] >= DASH.distanceM) this.finish(i);
    }
  }

  /** Taps before GO and after a player is over are ignored. CPUs come through here too. */
  private onTap(i: number, side: 0 | 1): void {
    if (!this.running || this.done || this.over[i]) return;
    const r = this.runners[i].tap(side);
    const gnome = this.gnomes[i];
    if (r === 'stumble') {
      laneMessage(this, i, gnome.x, 'STUMBLE!', '#ff5252');
      playSfx('stumble');
      this.tweens.add({ targets: gnome, angle: 25, yoyo: true, duration: 200 });
    } else if (r === 'good' && !this.players[i].cpu) {
      playSfx('tap');
    }
  }

  private finish(i: number): void {
    const t = (this.time.now - this.goTime) / 1000;
    this.over[i] = true;
    this.finishS[i] = t;

    const gnome = this.gnomes[i];
    gnome.x = DASH.startX + DASH.distanceM * DASH.pxPerM;
    gnome.y = laneGround(i);
    laneResult(this, i, `${t.toFixed(2)} s`);
    if (this.firstFinisher) {
      this.firstFinisher = false;
      playSfx('cheer');
    }
    this.tweens.add({ targets: gnome, y: gnome.y - FINISH_HOP_PX, yoyo: true, duration: 150 });

    this.checkDone();
  }

  private markDnf(i: number): void {
    this.over[i] = true;
    this.finishS[i] = null;
    this.meters[i].setSize(0, METER_H);
    laneResult(this, i, 'DNF');
  }

  /** When every player has a time or a DNF, report the results once. */
  private checkDone(): void {
    if (this.done || !this.players.every((p) => this.over[p.index])) return;
    this.done = true;
    const raw = this.players.map((p) => this.finishS[p.index]);
    const display = raw.map((r) => (r === null ? 'DNF' : `${r.toFixed(2)} s`));
    const meet = this.raceMeet;
    this.time.delayedCall(RESULT_DELAY_MS, () => finishEvent(this, meet, raw, display));
  }
}
