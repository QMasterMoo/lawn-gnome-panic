import { STORAGE_KEY_HIGH_SCORE } from './config';

export function getHighScore(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    if (raw === null) return 0;
    const value = parseInt(raw, 10);
    return Number.isNaN(value) ? 0 : value;
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
      // Storage unavailable: the score is still a new high score for this run.
    }
    return true;
  }
  return false;
}
