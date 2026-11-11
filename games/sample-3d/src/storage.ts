// src/storage.ts
import { STORAGE_KEY_HIGH_SCORE } from './config';

export function getHighScore(): number {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_KEY_HIGH_SCORE) ?? '', 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** Saves score if it beats the stored high score. Returns true if it was a new high score. */
export function submitScore(score: number): boolean {
  if (score > getHighScore()) {
    try {
      localStorage.setItem(STORAGE_KEY_HIGH_SCORE, String(score));
    } catch {
      // Storage unavailable: the score still counts for this session.
    }
    return true;
  }
  return false;
}
