// Experience, skill use and character level. Placeholder numbers; epic 2 replaces the curves.
import { TUNING, UI, type QuestDef, type Rank, type SkillId } from './config';
import { ATTRIBUTES, SKILLS } from './data/core';
import { bus, say } from './events';
import { skillXpToNext } from './rules';
import { maxHp, maxMp, state } from './state';

/** Experience needed to reach the next character level. */
export function xpToNext(level: number): number {
  return 40 + 30 * level + 4 * level * level;
}

/** Experience for killing an enemy of this level and rank. */
export function killXp(enemyLevel: number, rank: Rank): number {
  void rank;
  return 6 + 2 * enemyLevel;
}

/** Experience for finishing a quest. */
export function questXp(q: QuestDef): number {
  return killXp(q.level, 'normal') * 10;
}

/** Adds experience and announces it. No level-ups yet. */
export function grantXp(amount: number): void {
  state.xp += amount;
  bus.emit('xp-gained', { amount, total: state.xp });
}

/** Highest level a skill may reach at this character level. Placeholder: always 100. */
export function skillCap(level: number = state.level): number {
  void level;
  return 100;
}

/** Subscribes progression systems to events. Placeholder: nothing yet. */
export function initProgression(): void {}

/** Record `xp` uses of a skill: may raise the skill, and the character level after enough skill-ups. */
export function useSkill(skill: SkillId, xp = 1): void {
  const s = state.skills[skill];
  if (s.level >= 100) return;
  s.xp += xp;
  while (s.level < 100 && s.xp >= skillXpToNext(s.level)) {
    s.xp -= skillXpToNext(s.level);
    s.level++;
    state.skillUps++;
    bus.emit('skill-up', { skill, level: s.level });
    const name = SKILLS.find((k) => k.id === skill)?.name ?? skill;
    say(`Your ${name} skill is now ${s.level}.`, UI.good);
  }
  // Character level: every skillUpsPerLevel skill-ups, one level, full HP and mana.
  while (state.skillUps >= TUNING.skillUpsPerLevel) {
    state.skillUps -= TUNING.skillUpsPerLevel;
    state.level++;
    for (const a of ATTRIBUTES) state.attributes[a]++;
    state.hp = maxHp();
    state.mp = maxMp();
    bus.emit('level-up', { level: state.level });
    say(`Level up! You are now level ${state.level}.`, UI.gold);
  }
  bus.emit('changed', {});
}
