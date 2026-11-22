// Pure leash-zone helpers: determines boss ranks and whether a point lies inside an entity's leash boundary.
import { TUNING, type LeashArea, type Rank } from './config';

/** True for any boss-tier enemy rank whose targets are strictly bound by its leash zone. */
export function isBossRank(rank: Rank): boolean {
  return rank === 'miniboss' || rank === 'boss' || rank === 'worldboss' || rank === 'final';
}

/** True when `(x, z)` is within the entity's authored `leash` circle, or `TUNING.leashRange` of `home`. */
export function isWithinLeash(e: { home: { x: number; z: number }; leash?: LeashArea }, x: number, z: number): boolean {
  const cx = e.leash ? e.leash.x : e.home.x;
  const cz = e.leash ? e.leash.z : e.home.z;
  const r = e.leash ? e.leash.r : TUNING.leashRange;
  return Math.hypot(x - cx, z - cz) <= r;
}
