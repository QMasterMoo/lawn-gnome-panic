// Talents and classes: the rank of each talent and the class the player chose. Stub until epic 3.
import type { ClassId } from './config';
import { state } from './state';

/** Current rank of a talent (0 when not learned). */
export function talentRank(id: string): number {
  return state.talents[id] ?? 0;
}

/** Whether the player may spend a point on this talent right now. Always false until epic 3. */
export function canLearn(id: string): boolean {
  void id;
  return false;
}

/** Spends a point on a talent. Empty until epic 3. */
export function learnTalent(id: string): void {
  void id;
}

/** Gives back every talent point. Empty until epic 3. */
export function respec(): void {}

/** Picks the player's class. Empty until epic 3. */
export function chooseClass(c: ClassId): void {
  void c;
}

/** Points spent in one branch of a class's talent tree. Always 0 until epic 3. */
export function branchPoints(classId: ClassId, branch: string): number {
  void classId;
  void branch;
  return 0;
}
