// STUB: pure RPG rules (dice, to-hit, skill progression). Replaced in epic 2.
import type { SkillId } from './config';

export function rollDice(count: number, _sides: number, _rng: () => number = Math.random): number {
  return count;
}
export function attributeMod(_value: number): number {
  return 0;
}
export function skillBonus(_level: number): number {
  return 0;
}
export function attackRoll(_bonus: number, _armor: number, _rng: () => number = Math.random): { hit: boolean; roll: number } {
  return { hit: true, roll: 10 };
}
export function skillXpToNext(level: number): number {
  return level;
}
/** Record one use of a skill (mutates state; emits 'skill-up' / 'level-up'). */
export function useSkill(_skill: SkillId, _xp = 1): void {}
