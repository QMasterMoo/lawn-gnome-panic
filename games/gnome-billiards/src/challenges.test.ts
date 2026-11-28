import { describe, expect, it } from 'vitest';
import { BALL_R, CUE_BALL, TABLE_H, TABLE_W } from './config';
import { POCKETS } from './physics';
import { CHALLENGES, challengeBalls, checkChallenge } from './challenges';

describe('challenge mode', () => {
  it('every challenge has valid non-overlapping balls inside the cushions and outside pockets', () => {
    for (const c of CHALLENGES) {
      const balls = challengeBalls(c);
      expect(balls.some((b) => b.id === CUE_BALL), `${c.id} missing cue ball`).toBe(true);
      expect(balls.filter((b) => b.id !== CUE_BALL).length, `${c.id} needs object balls`).toBeGreaterThanOrEqual(1);
      for (const b of balls) {
        expect(b.x, `${c.id} ball ${b.id} x`).toBeGreaterThanOrEqual(BALL_R);
        expect(b.x, `${c.id} ball ${b.id} x`).toBeLessThanOrEqual(TABLE_W - BALL_R);
        expect(b.y, `${c.id} ball ${b.id} y`).toBeGreaterThanOrEqual(BALL_R);
        expect(b.y, `${c.id} ball ${b.id} y`).toBeLessThanOrEqual(TABLE_H - BALL_R);
        for (const p of POCKETS) {
          const d = Math.hypot(b.x - p.x, b.y - p.y);
          expect(d, `${c.id} ball ${b.id} inside pocket`).toBeGreaterThanOrEqual(p.r);
        }
      }
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const d = Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y);
          expect(d, `${c.id} overlap ${balls[i].id}/${balls[j].id}`).toBeGreaterThanOrEqual(2 * BALL_R - 1e-6);
        }
      }
    }
  });

  it('checkChallenge detects win, scratch loss, and out-of-shots loss', () => {
    const def = CHALLENGES[0]; // straight-in, parShots 1
    const before = challengeBalls(def);
    const wonBalls = before.map((b) => (b.id === 1 ? { ...b, pocketed: true } : b));
    expect(checkChallenge(def, before, wonBalls, { firstHit: 1, pocketed: [1] }, 1).status).toBe('won');

    const scratchBalls = before.map((b) => (b.id === CUE_BALL ? { ...b, pocketed: true } : b));
    expect(checkChallenge(def, before, scratchBalls, { firstHit: 1, pocketed: [CUE_BALL] }, 1).status).toBe('lost');

    expect(checkChallenge(def, before, before, { firstHit: 1, pocketed: [] }, 1).status).toBe('lost');
  });
});
