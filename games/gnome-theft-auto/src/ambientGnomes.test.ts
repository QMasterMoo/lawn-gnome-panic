import { describe, expect, it } from 'vitest';
import { WORLD_HALF } from './config';
import { AMBIENT_GNOMES } from './ambientGnomes';

describe('ambientGnomes', () => {
  it('defines at least 25 unique, in-bounds chatter gnomes obeying R-021', () => {
    expect(AMBIENT_GNOMES.length).toBeGreaterThanOrEqual(25);
    const ids = new Set<string>();
    const banned = /\b(wet|wetter|wetness|soak\w*|blood\w*|gore|bleed\w*)\b/i;

    for (const g of AMBIENT_GNOMES) {
      expect(ids.has(g.id), g.id).toBe(false);
      ids.add(g.id);
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.bubble.length).toBeGreaterThan(0);
      expect(g.bubble).not.toMatch(banned);
      expect(Math.abs(g.x)).toBeLessThanOrEqual(WORLD_HALF);
      expect(Math.abs(g.z)).toBeLessThanOrEqual(WORLD_HALF);
    }
  });
});
