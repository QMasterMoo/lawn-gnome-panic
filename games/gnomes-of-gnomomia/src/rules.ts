// Pure RPG rules (dice, to-hit, stats). Placeholders that keep today's numbers; epic 2 replaces them.
// No imports from state or events: this module stays a pure leaf.
import type { DamageType, EnemyDef, Family, ItemDef } from './config';

/** Sum of `count` dice with `sides` faces each. */
export function rollDice(count: number, sides: number, rng: () => number = Math.random): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(rng() * sides) + 1;
  return total;
}

/** RuneScape-style attribute bonus: 10 is 0, 12 is +1, 8 is -1. */
export function attributeMod(value: number): number {
  return Math.floor((value - 10) / 2);
}

/** Every 5 levels of a skill add +1 to rolls. */
export function skillBonus(level: number): number {
  return Math.floor(level / 5);
}

/** Uses of a skill needed to reach the next level. */
export function skillXpToNext(level: number): number {
  return 2 + Math.floor(level / 2);
}

/** Attribute power multiplier: 10 is 1.0. */
export function power(a: number): number {
  return 1 + (a - 10) / 40;
}

/** Accuracy granted by a skill level. */
export function accuracyFromSkill(level: number): number {
  return Math.floor(level / 20);
}

/** Damage bonus (fraction) granted by a skill level. */
export function damageFromSkill(level: number): number {
  return level / 400;
}

/** d20 roll. A 20 always hits, a 1 always misses, otherwise hit when roll + accuracy >= 10 + defense. */
export function attackRoll(
  accuracy: number,
  defense: number,
  critRange = 20,
  rng: () => number = Math.random,
): { hit: boolean; crit: boolean; roll: number } {
  const roll = rollDice(1, 20, rng);
  const hit = roll === 20 || (roll !== 1 && roll + accuracy >= 10 + defense);
  const crit = hit && roll >= critRange;
  return { hit, crit, roll };
}

/** Damage taken reduction from armor. Placeholder: no mitigation yet. */
export function mitigation(armor: number, attackerLevel: number): number {
  void armor;
  void attackerLevel;
  return 0;
}

/** [min, max] damage of a weapon. */
export function weaponRange(item: ItemDef): [number, number] {
  if (item.damageOverride) return [item.damageOverride[0], item.damageOverride[1]];
  const avg = 3 + 2 * (item.ilvl ?? 1);
  return [Math.round(0.6 * avg), Math.round(1.4 * avg)];
}

/** Armor value of a piece of armor or an offhand; 0 for everything else. */
export function armorValue(item: ItemDef): number {
  if (item.kind !== 'armor' && item.kind !== 'offhand') return 0;
  return item.armor ?? item.ilvl ?? 0;
}

/** Damage multiplier for a damage type against a family. Placeholder: always 1. */
export function typeMultiplier(type: DamageType, family: Family): number {
  void type;
  void family;
  return 1;
}

/** Combat numbers of an enemy. The only place EnemyDef's combat fields are read. */
export function enemyStats(def: EnemyDef): {
  hp: number;
  damage: [number, number];
  armor: number;
  accuracy: number;
  defense: number;
} {
  return {
    hp: def.hpOverride ?? 10 * def.level,
    damage: def.damageOverride ? [def.damageOverride[0], def.damageOverride[1]] : [1, 2 + def.level],
    armor: 0,
    accuracy: Math.min(5, Math.max(0, def.level - 1)),
    defense: def.defense ?? 0,
  };
}
