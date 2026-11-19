import type * as ToneNS from 'tone';
import { describe, expect, it } from 'vitest';
import type { Keep, Tone } from '../engine';
import { lintSongGraph } from '../analyze/graph';
import { analyzeTheory } from '../analyze/theory';
import { CLUB_GNOME_TRACKS, buildClubGnomeTrack, clubGnomeTracks, type ClubGnomeArea } from './clubGnome';

const AREAS: ClubGnomeArea[] = ['town', 'gnomecino', 'arcade', 'park'];

describe('Club Gnome area music', () => {
  it('gives every area one to three tracks', () => {
    for (const area of AREAS) {
      const n = clubGnomeTracks(area).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
    expect(new Set(CLUB_GNOME_TRACKS.map((t) => t.id)).size).toBe(CLUB_GNOME_TRACKS.length);
  });

  for (const track of CLUB_GNOME_TRACKS.filter((t) => t.id !== 'casino-lounge')) { // the lounge is the shared blackjack jazz, checked elsewhere
    it(`${track.id}: fits its key, with no graph problems`, () => {
      const build = (T: Tone, keep: Keep, out: ToneNS.Volume) => buildClubGnomeTrack(T, keep, out, 42, track.id);
      const graph = lintSongGraph(build);
      expect(graph.issues).toEqual([]);
      const theory = analyzeTheory(build, 32);
      expect(theory.detectedKey.inScaleRatio).toBeGreaterThan(0.9);
      expect(theory.score).toBeGreaterThanOrEqual(80);
    });
  }
});
