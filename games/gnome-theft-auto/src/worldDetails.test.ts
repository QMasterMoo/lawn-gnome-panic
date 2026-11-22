import { describe, expect, it } from 'vitest';
import { getPrefab } from '@lawn/prefabs';
import { WORLD_HALF } from './config';
import { WORLD_DETAILS } from './worldDetails';

describe('worldDetails', () => {
  it('contains at least 25 unique, in-bounds details using valid prefabs and R-021 compliant text', () => {
    expect(WORLD_DETAILS.length).toBeGreaterThanOrEqual(25);
    const ids = new Set<string>();
    const banned = /\b(wet|wetter|wetness|soak\w*|blood\w*|gore|bleed\w*)\b/i;

    for (const d of WORLD_DETAILS) {
      expect(ids.has(d.id), d.id).toBe(false);
      ids.add(d.id);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(WORLD_HALF);
      expect(Math.abs(d.z)).toBeLessThanOrEqual(WORLD_HALF);
      expect(d.toast).not.toMatch(banned);
      expect(d.props.length).toBeGreaterThan(0);
      for (const p of d.props) {
        expect(getPrefab(p.id), `missing prefab ${p.id} in ${d.id}`).toBeDefined();
      }
    }
  });
});
