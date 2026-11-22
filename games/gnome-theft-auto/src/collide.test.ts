import { describe, expect, it } from 'vitest';
import { groundHeight } from './collide';
import type { Box } from './types';

describe('rooftop groundHeight', () => {
  const boxes: Box[] = [
    { minX: 10, maxX: 30, minZ: 10, maxZ: 30, h: 12 },
    { minX: 15, maxX: 25, minZ: 15, maxZ: 25, h: 20 },
  ];

  it('returns 0 on open ground', () => {
    expect(groundHeight(0, 0, 0.35, boxes, 0)).toBe(0);
  });

  it('returns building roof height when standing or landing on top', () => {
    expect(groundHeight(12, 12, 0.35, boxes, 12)).toBe(12);
    expect(groundHeight(20, 20, 0.35, boxes, 20)).toBe(20);
  });

  it('ignores roofs taller than maxY + step tolerance', () => {
    expect(groundHeight(20, 20, 0.35, boxes, 12)).toBe(12);
    expect(groundHeight(12, 12, 0.35, boxes, 0)).toBe(0);
  });
});
