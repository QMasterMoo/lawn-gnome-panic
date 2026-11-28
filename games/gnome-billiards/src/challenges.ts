// Challenge Mode: 8 handcrafted trick-shot and run-out puzzles for Gnome Billiards.
import { BALL_R, CUE_BALL, TABLE_H, TABLE_W } from './config';
import type { Ball, ShotEvents } from './physics';

export type ChallengeDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Master';

export interface ChallengeDef {
  id: string;
  title: string;
  difficulty: ChallengeDifficulty;
  description: string;
  parShots: number;
  chipReward: number;
  balls: readonly { id: number; x: number; y: number }[];
  /** Specific object ball IDs that must be pocketed; if omitted, all object balls in `balls` must be pocketed. */
  targetIds?: readonly number[];
  /** When true (default), scratching fails immediately. */
  requireClean?: boolean;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'straight-in',
    title: 'Dead Straight',
    difficulty: 'Easy',
    description: 'Line up the 1-ball and sink it into the top-right corner in one clean shot.',
    parShots: 1,
    chipReward: 25,
    balls: [
      { id: CUE_BALL, x: 1.15, y: 0.5 },
      { id: 1, x: 1.68, y: 0.2 },
    ],
  },
  {
    id: 'long-cut',
    title: 'Long Distance',
    difficulty: 'Easy',
    description: 'Thread a full-table shot from the left rail. Try Fine Aim (🎯) for precision.',
    parShots: 1,
    chipReward: 40,
    balls: [
      { id: CUE_BALL, x: 0.22, y: 0.72 },
      { id: 2, x: 1.82, y: 0.16 },
    ],
  },
  {
    id: 'two-ball-run',
    title: 'Two-Step',
    difficulty: 'Medium',
    description: 'Clear both object balls in 2 shots with no scratches.',
    parShots: 2,
    chipReward: 50,
    balls: [
      { id: CUE_BALL, x: 0.8, y: 0.5 },
      { id: 3, x: 1.65, y: 0.22 },
      { id: 4, x: 1.65, y: 0.78 },
    ],
  },
  {
    id: 'combo-strike',
    title: 'Domino Effect',
    difficulty: 'Medium',
    description: 'Carom the 5-ball into the 9-ball to sink the 9 in a single shot!',
    parShots: 1,
    chipReward: 60,
    targetIds: [9],
    balls: [
      { id: CUE_BALL, x: 0.7, y: 0.45 },
      { id: 5, x: 1.35, y: 0.35 },
      { id: 9, x: 1.84, y: 0.14 },
    ],
  },
  {
    id: 'three-ball-sweep',
    title: 'Three-Ball Sweep',
    difficulty: 'Medium',
    description: 'Three balls across the felt. Sink them all in 3 shots.',
    parShots: 3,
    chipReward: 75,
    balls: [
      { id: CUE_BALL, x: 0.4, y: 0.5 },
      { id: 1, x: 0.95, y: 0.22 },
      { id: 6, x: 1.4, y: 0.78 },
      { id: 7, x: 1.75, y: 0.24 },
    ],
  },
  {
    id: 'rail-bank',
    title: 'Cross-Table Bank',
    difficulty: 'Hard',
    description: 'The 2-ball blocks the direct pocket. Bank the 8-ball off the bottom rail into the top side!',
    parShots: 1,
    chipReward: 90,
    targetIds: [8],
    balls: [
      { id: CUE_BALL, x: 0.98, y: 0.34 },
      { id: 8, x: 1.0, y: 0.68 },
      { id: 2, x: 1.0, y: 0.18 },
    ],
  },
  {
    id: 'cluster-bust',
    title: 'Tight Cluster',
    difficulty: 'Hard',
    description: 'Break apart the 4-ball cluster and clear the table in 3 shots.',
    parShots: 3,
    chipReward: 110,
    balls: [
      { id: CUE_BALL, x: 0.45, y: 0.5 },
      { id: 1, x: 1.4, y: 0.5 },
      { id: 3, x: 1.4 + 2 * BALL_R * 1.04, y: 0.5 - BALL_R * 1.1 },
      { id: 5, x: 1.4 + 2 * BALL_R * 1.04, y: 0.5 + BALL_R * 1.1 },
      { id: 7, x: 1.4 + 4 * BALL_R * 1.04, y: 0.5 },
    ],
  },
  {
    id: 'grandmaster-run',
    title: 'Gnomecino Run-Out',
    difficulty: 'Master',
    description: 'Clear all five balls in 5 shots without scratching. Pure table mastery.',
    parShots: 5,
    chipReward: 150,
    balls: [
      { id: CUE_BALL, x: 0.3, y: 0.5 },
      { id: 1, x: 0.65, y: 0.2 },
      { id: 2, x: 0.95, y: 0.8 },
      { id: 3, x: 1.35, y: 0.25 },
      { id: 4, x: 1.65, y: 0.75 },
      { id: 8, x: 1.8, y: 0.22 },
    ],
  },
];

export function challengeBalls(def: ChallengeDef): Ball[] {
  return def.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, pocketed: false }));
}

export function challengeTargets(def: ChallengeDef): number[] {
  if (def.targetIds && def.targetIds.length > 0) return [...def.targetIds];
  return def.balls.filter((b) => b.id !== CUE_BALL).map((b) => b.id);
}

export function checkChallenge(
  def: ChallengeDef,
  _before: readonly Ball[],
  after: readonly Ball[],
  ev: ShotEvents,
  shotsUsed: number,
): { status: 'playing' | 'won' | 'lost'; reason?: string; remaining: number } {
  const targets = new Set(challengeTargets(def));
  const remaining = after.filter((b) => !b.pocketed && targets.has(b.id)).length;
  if ((def.requireClean ?? true) && ev.pocketed.includes(CUE_BALL)) {
    return { status: 'lost', reason: 'Scratched! Cue ball went in.', remaining };
  }
  if (remaining === 0) {
    return { status: 'won', reason: 'Challenge cleared!', remaining: 0 };
  }
  if (shotsUsed >= def.parShots) {
    return { status: 'lost', reason: `Out of shots (${shotsUsed}/${def.parShots})!`, remaining };
  }
  return { status: 'playing', remaining };
}

const STORAGE_KEY = 'gnome-billiards-challenges.v1';

export function loadCompletedChallenges(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/** Records a challenge clear. Returns true if this was the first time clearing it. */
export function markChallengeComplete(id: string): boolean {
  const done = loadCompletedChallenges();
  const first = !done.has(id);
  done.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch {
    /* storage optional */
  }
  return first;
}

export { TABLE_H, TABLE_W };
