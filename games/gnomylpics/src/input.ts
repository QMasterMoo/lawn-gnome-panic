import Phaser from 'phaser';
import type { PlayerSlot } from './config';

/** side 0 = the player's left key, 1 = right key. */
export type TapHandler = (playerIndex: number, side: 0 | 1) => void;

/**
 * Routes raw key presses of every human player to `onTap`. Key repeats are ignored, so holding a key is one tap.
 * Listens on window (so arrow keys and numpad work and the page never scrolls) and removes itself when the
 * scene shuts down. CPUs never produce taps here: event scenes call their own tap logic for CPUs.
 */
export function listenTaps(scene: Phaser.Scene, players: PlayerSlot[], onTap: TapHandler): void {
  const map = new Map<string, { player: number; side: 0 | 1 }>();
  for (const p of players) {
    if (p.cpu) continue;
    map.set(p.keys[0], { player: p.index, side: 0 });
    map.set(p.keys[1], { player: p.index, side: 1 });
  }
  const handler = (e: KeyboardEvent): void => {
    const hit = map.get(e.code);
    if (!hit) return;
    e.preventDefault();
    if (e.repeat) return;
    onTap(hit.player, hit.side);
  };
  window.addEventListener('keydown', handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', handler));
}

/**
 * Detects "both keys at once": call `tap(side, nowMs)` for every tap; returns true when the other key
 * was tapped within `windowMs` before this one.
 */
export class BothKeysDetector {
  private last: [number, number] = [-1e9, -1e9];
  constructor(private windowMs: number) {}
  tap(side: 0 | 1, nowMs: number): boolean {
    this.last[side] = nowMs;
    return nowMs - this.last[side === 0 ? 1 : 0] <= this.windowMs;
  }
}
