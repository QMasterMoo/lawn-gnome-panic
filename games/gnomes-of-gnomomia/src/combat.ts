// STUB: melee, spells, enemy attacks, regen, death. Replaced in epic 2.
import type * as THREE from 'three';
import type { Entity, SpellId } from './config';

/** Keeps the scene for spell effects (fireball, heal sparkle). Call once. */
export function initCombat(_scene: THREE.Scene): void {}
export function updateCombat(_dt: number): void {}
export function enemyAttack(_e: Entity): void {}
export function castSpell(_spell: SpellId): void {}
/** Seconds until the next spell may be cast (0 = ready). */
export function spellCooldown(): number {
  return 0;
}
