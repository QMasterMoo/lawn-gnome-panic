import { describe, expect, it } from 'vitest';
import {
  CUSTOM_STAT_BUDGET,
  POINTS_PER_GAME,
  POINTS_PER_TOURNAMENT_WIN,
  POINTS_PER_WIN_BONUS,
  PRO_TEAMS,
  STAT_MAX,
  STAT_MIN,
  awardMatchProgression,
  defaultCustomGnome,
  getRemainingStatPoints,
  getTotalStatBudget,
} from './teams';

describe('Custom Gnome 0-100 stats & progression', () => {
  it('starts with 0-100 stats within the base budget', () => {
    const g = defaultCustomGnome();
    expect(getTotalStatBudget(g)).toBe(CUSTOM_STAT_BUDGET);
    expect(getRemainingStatPoints(g)).toBe(0);
    for (const val of Object.values(g.stats)) {
      expect(val).toBeGreaterThanOrEqual(STAT_MIN);
      expect(val).toBeLessThanOrEqual(STAT_MAX);
    }
  });

  it('has all pro team stats on the 0-100 scale', () => {
    for (const team of PRO_TEAMS) {
      for (const p of team.roster) {
        expect(p.stats.speed).toBeGreaterThanOrEqual(30);
        expect(p.stats.speed).toBeLessThanOrEqual(100);
        expect(p.stats.threePt).toBeLessThanOrEqual(100);
        expect(p.stats.dunk).toBeLessThanOrEqual(100);
        expect(p.stats.defense).toBeLessThanOrEqual(100);
      }
    }
  });

  it('awards +3 for a game played, +2 extra for a win, and +20 for a tournament win', () => {
    const g = defaultCustomGnome();
    const base = getTotalStatBudget(g);

    const lossRes = awardMatchProgression(g, { won: false });
    expect(lossRes.earned).toBe(POINTS_PER_GAME);
    expect(g.progression.gamesPlayed).toBe(1);
    expect(g.progression.wins).toBe(0);
    expect(getRemainingStatPoints(g)).toBe(3);

    const winRes = awardMatchProgression(g, { won: true });
    expect(winRes.earned).toBe(POINTS_PER_GAME + POINTS_PER_WIN_BONUS);
    expect(g.progression.gamesPlayed).toBe(2);
    expect(g.progression.wins).toBe(1);
    expect(getRemainingStatPoints(g)).toBe(8);

    const tourneyRes = awardMatchProgression(g, { won: true, tournamentWon: true });
    expect(tourneyRes.earned).toBe(POINTS_PER_GAME + POINTS_PER_WIN_BONUS + POINTS_PER_TOURNAMENT_WIN);
    expect(g.progression.tournamentWins).toBe(1);
    expect(getTotalStatBudget(g)).toBe(base + 3 + 5 + 25);
    expect(getRemainingStatPoints(g)).toBe(33);
  });
});
