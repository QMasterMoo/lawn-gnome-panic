/**
 * Game music: a generated jungle track per run, and a composed menu theme.
 *
 * Files:
 * - engine.ts: Tone.js loading, the single Transport, teardown between songs, mute, gesture unlock.
 * - mix.ts: shared reverb, echo and dub-throw returns.
 * - drums.ts: break grids (Amen, Think, Funky Drummer, Apache), the chopper, and the synthesized kit.
 * - theory.ts: RNG, note names, modes, chord stacking, voice leading.
 * - runTrack.ts: the per-run generator (its header records the design decisions).
 * - menuTheme.ts: the composed lobby theme.
 * - names.ts: made-up artist/title for the "Now playing" card.
 *
 * Tone.js (MIT; a library, not an asset) is dynamically imported, so it sits in its own chunk.
 * No samples anywhere: everything is synthesized.
 */
import { isMuted, pauseSong, playSong, resumeSong, setMuted, stopSong } from './engine';
import { buildMenuTheme } from './menuTheme';
import { trackInfo, type TrackInfo } from './names';
import { buildRunTrack } from './runTrack';

export type { TrackInfo };

/**
 * Starts a brand new run track and returns its made-up name. Call once per run.
 * Pass a shared seed (online matches) so every player gets the same track and name (not beat-synced).
 */
export function startMusic(seed: number = Math.floor(Math.random() * 2 ** 31)): TrackInfo {
  playSong((T, keep, out) => buildRunTrack(T, keep, out, seed));
  return trackInfo(seed);
}

/** Starts the lobby theme (from the top). */
export function startMenuMusic(): void {
  playSong(buildMenuTheme);
}

export const pauseMusic = pauseSong;
export const resumeMusic = resumeSong;
export const stopMusic = stopSong;
export const isMusicMuted = isMuted;
export const setMusicMuted = setMuted;
