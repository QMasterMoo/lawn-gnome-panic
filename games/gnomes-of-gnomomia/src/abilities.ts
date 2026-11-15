// Abilities and the hotbar: what the player can use, its cooldowns and the resource bar. Stub until epic 3.
// Until then the two hotbar slots are the two spells.
import type { AbilityDef } from './config';
import { castSpell } from './combat';
import { maxMp, state } from './state';

/** Abilities the player knows right now. Empty until epic 3. */
export function knownAbilities(): AbilityDef[] {
  return [];
}

/** Uses the hotbar slot (0-based). Slot 0 is Flare, slot 1 is Mend. */
export function useHotbar(slot: number): void {
  if (slot === 0) castSpell('flare');
  else if (slot === 1) castSpell('mend');
}

/** Seconds left on an ability's cooldown (0 = ready). Always 0 until epic 3. */
export function abilityCooldown(id: string): number {
  void id;
  return 0;
}

/** The resource bar: mana for now. */
export function resource(): { kind: 'grit' | 'focus' | 'mana'; value: number; max: number } {
  return { kind: 'mana', value: state.mp, max: maxMp() };
}

/** Per-frame ability timers. Empty until epic 3. */
export function updateAbilities(dt: number): void {
  void dt;
}
