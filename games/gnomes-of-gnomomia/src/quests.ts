// STUB: quest tracking. Replaced in epic 2.
import type { Condition } from './config';

/** Subscribes to game events. Call once, AFTER createDialogue so the dialogue sees the state before a turn-in. */
export function initQuests(): void {}
export function questStatus(_id: string): 'none' | 'active' | 'done' {
  return 'none';
}
export function startQuest(_id: string): void {}
export function checkCondition(_c: Condition | undefined): boolean {
  return true;
}
