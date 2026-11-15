import Phaser from 'phaser';
import { CPU_TAP, RUN } from './config';

export type TapOutcome = 'good' | 'stumble' | 'ignored';

/**
 * The alternating-tap model shared by every event. Pure logic, no Phaser objects.
 * Correct alternation adds speed; the same key twice in a row is a stumble (speed cut, taps ignored briefly).
 * The first tap may be either key.
 */
export class AlternatingRunner {
  speed = 0;
  private lastSide: 0 | 1 | null = null;
  private stunMs = 0;

  constructor(
    private boost: number = RUN.tapBoost,
    private max: number = RUN.maxSpeed,
    private drag: number = RUN.dragPerSec,
  ) {}

  get stumbling(): boolean {
    return this.stunMs > 0;
  }

  tap(side: 0 | 1): TapOutcome {
    if (this.stunMs > 0) return 'ignored';
    if (this.lastSide === side) {
      this.speed *= RUN.stumbleSpeedMult;
      this.stunMs = RUN.stumbleMs;
      this.lastSide = null; // after a stumble either key starts again
      return 'stumble';
    }
    this.lastSide = side;
    this.speed = Math.min(this.max, this.speed + this.boost);
    return 'good';
  }

  /** Advance time. Returns distance covered this step in metres. */
  update(dtS: number): number {
    this.stunMs = Math.max(0, this.stunMs - dtS * 1000);
    this.speed = Math.max(0, this.speed - this.drag * dtS);
    return this.speed * dtS;
  }
}

/**
 * Drives an AlternatingRunner-style tapper for a CPU. Call `update(dtMs)` each frame; it returns the side to tap
 * (0 or 1) when the CPU taps this frame, or null. Taps alternate, with an occasional deliberate mistake.
 */
export class CpuTapper {
  private nextIn: number;
  private side: 0 | 1 = 0;
  constructor(private skill: number) {
    this.nextIn = this.interval() + Phaser.Math.Between(0, 200); // reaction time at the start
  }
  private interval(): number {
    const base = Phaser.Math.Linear(CPU_TAP.intervalMsAtSkill0, CPU_TAP.intervalMsAtSkill1, this.skill);
    return base * Phaser.Math.FloatBetween(0.8, 1.25);
  }
  update(dtMs: number): 0 | 1 | null {
    this.nextIn -= dtMs;
    if (this.nextIn > 0) return null;
    this.nextIn += this.interval();
    const mistake = Math.random() < Phaser.Math.Linear(CPU_TAP.mistakeAtSkill0, CPU_TAP.mistakeAtSkill1, this.skill);
    if (!mistake) this.side = this.side === 0 ? 1 : 0;
    return this.side;
  }
}
