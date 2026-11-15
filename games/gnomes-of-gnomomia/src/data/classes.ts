// Classes, their abilities and talents. STUB: epic 2 issue 07 transcribes docs/design/gnomomia/classes.md here.
import type { ClassDef, ClassId, TalentDef } from '../config';

export const CLASSES: Record<ClassId, ClassDef> = {
  warden: { id: 'warden', name: 'Warden', primary: 'strength', resource: 'grit', armor: ['cloth', 'leather', 'plate', 'shield'], abilities: [] },
  slinger: { id: 'slinger', name: 'Slinger', primary: 'agility', resource: 'focus', armor: ['cloth', 'leather'], abilities: [] },
  mage: { id: 'mage', name: 'Mage', primary: 'intelligence', resource: 'mana', armor: ['cloth'], abilities: [] },
};

export const TALENTS: Record<string, TalentDef> = {};

/** Points needed in a branch to learn a talent of each tier (indexed by tier). */
export const TIER_GATE = [0, 0, 2, 4, 6, 8, 12] as const;

/** Talent branches per class, in the order of classes.md. */
export const BRANCHES: Record<ClassId, readonly string[]> = {
  warden: ['bulwark', 'hedgecutter', 'groundbreaker'],
  slinger: ['acorneer', 'thornshot', 'trapper'],
  mage: ['sun', 'rain', 'bloom'],
};
