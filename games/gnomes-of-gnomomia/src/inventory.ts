// STUB: inventory and equipment rules. Replaced in epic 2.
import type { EquipSlot } from './config';

/** Adds items (stacking stackables). False (and a message) if there is no room. */
export function addItem(_item: string, _count = 1): boolean {
  return true;
}
export function removeItem(_item: string, _count = 1): boolean {
  return true;
}
export function countItem(_item: string): number {
  return 0;
}
export function equipFromSlot(_index: number): void {}
export function unequip(_slot: EquipSlot): void {}
/** Left-click on an inventory slot: drink potions, equip gear, examine misc. */
export function useFromSlot(_index: number): void {}
export function dropFromSlot(_index: number): void {}
/** Take everything from a loot pile entity. */
export function pickUpLoot(_entityId: number): void {}
