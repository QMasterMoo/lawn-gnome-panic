// The Verge: STUB (a flat meadow). Its zone issue replaces this with the real layout from src/data/README.md.
import type { ZoneDef } from '../../config';

export const ZONE: ZoneDef = {
  id: 'verge',
  name: 'The Verge',
  levels: [25, 30],
  half: 80,
  spawn: { x: 0, z: 10 },
  shrine: { x: 0, z: 0, name: 'The Verge' },
  regions: [],
  lakes: [],
  houses: [],
  theme: { ground: 0x5f9e3f, groundAlt: 0x67a745, flora: 'grass', floraDensity: 0.5, fog: 0x9fd0f0, sky: 0x9fd0f0, hilliness: 0 },
  exits: [{ to: 'hedgewood', x: 0, z: 76, r: 4, arriveX: 0, arriveZ: 0, label: 'Back' }],
};
