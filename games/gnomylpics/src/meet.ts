import Phaser from 'phaser';
import {
  CPU_SKILL, EVENTS, EVENT_SCENE, KEYSETS, MAX_PLAYERS, PLACE_POINTS, SCENES,
  type Difficulty, type EventResult, type MeetData, type MeetState, type PlayerSlot,
} from './config';

const CPU_NAMES = ['Gnorbert', 'Gnadia', 'Gnigel', 'Gnancy'];

/** A new meet: `humans` players on KEYSETS[0..humans-1], CPUs fill the remaining lanes. */
export function createMeet(humans: number, difficulty: Difficulty): MeetState {
  const players: PlayerSlot[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const cpu = i >= humans;
    // A little spread so CPUs do not all tie.
    const skill = cpu ? Phaser.Math.Clamp(CPU_SKILL[difficulty] + (i - 2) * 0.06, 0.05, 1) : 1;
    players.push({
      index: i,
      name: cpu ? `CPU ${CPU_NAMES[i]}` : `P${i + 1}`,
      cpu,
      skill,
      keys: cpu ? ['', ''] : KEYSETS[i].codes,
      keyLabels: cpu ? ['', ''] : KEYSETS[i].labels,
    });
  }
  return { players, eventIndex: 0, totals: players.map(() => 0), history: [] };
}

/**
 * Places from raw scores. null (DNF / foul) always ranks last. Ties share the better place.
 * Returns 1-based places.
 */
export function rankPlaces(raw: (number | null)[], higherIsBetter: boolean): number[] {
  const better = (a: number | null, b: number | null): boolean => {
    if (a === null) return false;
    if (b === null) return true;
    return higherIsBetter ? a > b : a < b;
  };
  return raw.map((r) => 1 + raw.filter((o) => better(o, r)).length);
}

/**
 * Every event scene calls this exactly once when all players are done.
 * Records the result, adds points and starts the Results scene.
 */
export function finishEvent(scene: Phaser.Scene, meet: MeetState, raw: (number | null)[], display: string[]): void {
  const ev = EVENTS[meet.eventIndex];
  const places = rankPlaces(raw, ev.higherIsBetter);
  const points = places.map((p, i) => (raw[i] === null ? 0 : PLACE_POINTS[p - 1] ?? 0));
  const result: EventResult = { eventId: ev.id, raw, display, places, points };
  meet.history.push(result);
  points.forEach((p, i) => (meet.totals[i] += p));
  const data: MeetData = { meet };
  scene.scene.start(SCENES.results, data);
}

/** From the Results scene: start the next event, or the Final scene after the last one. */
export function nextEvent(scene: Phaser.Scene, meet: MeetState): void {
  meet.eventIndex += 1;
  const data: MeetData = { meet };
  if (meet.eventIndex >= EVENTS.length) scene.scene.start(SCENES.final, data);
  else scene.scene.start(EVENT_SCENE[EVENTS[meet.eventIndex].id], data);
}

/** Start the meet's current event (used by the Title scene). */
export function startCurrentEvent(scene: Phaser.Scene, meet: MeetState): void {
  const data: MeetData = { meet };
  scene.scene.start(EVENT_SCENE[EVENTS[meet.eventIndex].id], data);
}
