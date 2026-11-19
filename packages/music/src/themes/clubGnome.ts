// Club Gnome area music: one or two tracks per place, all generated in code with Tone.js.
//
//   town      fountain-folk      "Meet You at the Fountain"  bouncy ukulele folk, daytime (4/4, 106-114 bpm, major)
//             lamplight-waltz    "Lamplight Waltz"           soft evening waltz (3/4, 84-92 bpm, lydian)
//   gnomecino casino-lounge      "Cards and Candlelight"     the shared blackjack jazz (see blackjackJazz.ts)
//             high-rollers       "High Rollers"              slow smoky swing, rhodes and vibes (4/4, 78-86 bpm, dorian)
//   arcade    arcade-attract     "Insert Coin"               bright chiptune (4/4, 128-136 bpm, major)
//             arcade-high-score  "High Score Rush"           fast chiptune, minor (4/4, 152-160 bpm)
//   park      park-breeze        "Fairway Breeze"            fingerpicked guitar and flute (4/4, 92-100 bpm, mixolydian)
//             dockside-shanty    "Dockside Shanty"           squeezebox sea shanty (6/8, 96-104 bpm, dorian)
//
// Every track is a TrackSpec (key, mode, chords per bar, which voices, a drum grid) run by one small engine:
// chords, bass, drums and a melody that is composed from the seed (a two-bar question, an answer, a rhythm that
// repeats). The same seed always gives the same song. No assets; nothing to credit.
import type * as ToneNS from 'tone';
import { buildBlackjackJazz } from '../blackjackJazz';
import type { Keep, Tone } from '../engine';
import { createFx } from '../mix';
import { chordTones, degreeToMidi, midiToNote, mulberry32, MODES, voiceLead, type ModeName } from '../theory';

export type ClubGnomeArea = 'town' | 'gnomecino' | 'arcade' | 'park';
export type ClubGnomeTrackId =
  | 'fountain-folk'
  | 'lamplight-waltz'
  | 'casino-lounge'
  | 'high-rollers'
  | 'arcade-attract'
  | 'arcade-high-score'
  | 'park-breeze'
  | 'dockside-shanty';

export interface ClubGnomeTrackInfo {
  id: ClubGnomeTrackId;
  area: ClubGnomeArea;
  title: string;
}

/** Every track, in the order an area plays them. */
export const CLUB_GNOME_TRACKS: readonly ClubGnomeTrackInfo[] = [
  { id: 'fountain-folk', area: 'town', title: 'Meet You at the Fountain' },
  { id: 'lamplight-waltz', area: 'town', title: 'Lamplight Waltz' },
  { id: 'casino-lounge', area: 'gnomecino', title: 'Cards and Candlelight' },
  { id: 'high-rollers', area: 'gnomecino', title: 'High Rollers' },
  { id: 'arcade-attract', area: 'arcade', title: 'Insert Coin' },
  { id: 'arcade-high-score', area: 'arcade', title: 'High Score Rush' },
  { id: 'park-breeze', area: 'park', title: 'Fairway Breeze' },
  { id: 'dockside-shanty', area: 'park', title: 'Dockside Shanty' },
];

export function clubGnomeTracks(area: ClubGnomeArea): ClubGnomeTrackInfo[] {
  return CLUB_GNOME_TRACKS.filter((t) => t.area === area);
}

// ------------------------------------------------------------------ specs

type ChordVoice = 'uke' | 'rhodes' | 'squeeze' | 'chip' | 'guitar';
type BassVoice = 'upright' | 'round' | 'chip';
type LeadVoice = 'glock' | 'flute' | 'vibes' | 'chip' | 'whistle';
type DrumKit = 'folk' | 'waltz' | 'brush' | 'chip' | 'chipFast' | 'shanty';
type BassKind = 'r' | 'f' | 'o' | 't' | 'a'; // root, fifth, octave, third, approach to the next root

/** Rows of a drum grid: one character per sixteenth, 'x' hit, 'o' soft hit, '.' rest. */
interface DrumPattern { k?: string; s?: string; h?: string }

interface TrackSpec {
  bpm: [number, number];
  /** Tonic as a MIDI note, picked from this range by the seed. */
  tonic: [number, number];
  mode: ModeName;
  /** Sixteenths per bar: 16 (4/4) or 12 (3/4 and 6/8). */
  grid: 12 | 16;
  /** 0..0.33: how late the off-beat eighths fall (0.33 is a triplet swing). */
  swing: number;
  /** Four-bar chord sections, as scale degrees (0 = I). */
  sections: number[][];
  /** The song: which section, and which voices play in it. */
  form: { s: number; lead?: boolean; drums?: boolean; up?: boolean }[];
  chord: ChordVoice;
  bass: BassVoice;
  lead: LeadVoice;
  kit: DrumKit;
  /** Chord hits: sixteenth positions in the bar and how long each rings (sixteenths). `arp` walks through the chord tones instead of striking them together. */
  comp: { steps: number[]; len: number; arp?: boolean };
  /** Bass notes: [position, kind, length in sixteenths]. */
  bassPat: [number, BassKind, number][];
  /** Melody: note lengths (sixteenths) it may use, how often it rests, and its register in scale degrees from the tonic. */
  melody: { lens: number[]; rest: number; lo: number; hi: number };
  /** Notes per chord: 4 (sevenths, the default) or 3 (triads, where a seventh would grate). */
  chordSize?: 3 | 4;
  /** A quiet sustained pad under everything. */
  pad?: boolean;
  /** Reverb length (seconds). */
  reverb: number;
  /** Extra master gain in dB (the voices are mixed quiet; soft tracks need more). */
  trim?: number;
  drums: DrumPattern;
}

const SPECS: Record<Exclude<ClubGnomeTrackId, 'casino-lounge'>, TrackSpec> = {
  // Daytime in the square: a strummed ukulele, a bouncing bass, claps and a glockenspiel tune. C-ish major.
  'fountain-folk': {
    bpm: [106, 114], tonic: [60, 64], mode: 'ionian', grid: 16, swing: 0.08,
    sections: [[0, 4, 5, 3], [0, 4, 5, 3], [3, 0, 4, 4], [5, 3, 0, 4]],
    form: [
      { s: 0, lead: false, drums: false }, { s: 0 }, { s: 2 }, { s: 1, up: true },
      { s: 3 }, { s: 0, up: true }, { s: 2 }, { s: 1, lead: false },
    ],
    chord: 'uke', bass: 'upright', lead: 'glock', kit: 'folk',
    comp: { steps: [2, 6, 10, 14], len: 2 },
    bassPat: [[0, 'r', 3], [4, 'f', 3], [8, 'r', 3], [12, 'f', 3]],
    melody: { lens: [2, 2, 4, 4, 6], rest: 0.12, lo: 7, hi: 16 },
    reverb: 2.2,
    drums: { k: 'x.......x.......', s: '....x.......x...', h: '..o...o...o...o.' },
  },
  // Evening: a slow waltz with a rhodes, a pad and a vibraphone tune. Lydian, so it glows rather than resolves.
  'lamplight-waltz': {
    bpm: [84, 92], tonic: [53, 57], mode: 'lydian', grid: 12, swing: 0,
    sections: [[0, 4, 5, 1], [0, 1, 4, 0], [5, 1, 0, 4]],
    form: [
      { s: 0, lead: false, drums: false }, { s: 0 }, { s: 1 }, { s: 0, up: true },
      { s: 2 }, { s: 1, up: true }, { s: 0 }, { s: 2, lead: false },
    ],
    chordSize: 3,
    chord: 'rhodes', bass: 'round', lead: 'vibes', kit: 'waltz',
    comp: { steps: [4, 8], len: 3 },
    bassPat: [[0, 'r', 4]],
    melody: { lens: [4, 4, 6, 6, 8], rest: 0.1, lo: 7, hi: 15 },
    pad: true, reverb: 4.5,
    drums: { k: 'o...........', s: '....o...o...', h: '..o...o...o.' },
  },
  // The VIP room: a walking bass, brushes and a rhodes comping off the beat, a vibraphone line over it. Dorian, swung.
  'high-rollers': {
    bpm: [78, 86], tonic: [50, 53], mode: 'dorian', grid: 16, swing: 0.3,
    sections: [[0, 3, 0, 4], [1, 4, 0, 5], [3, 3, 0, 0]],
    form: [
      { s: 0, lead: false }, { s: 0 }, { s: 1 }, { s: 0, up: true },
      { s: 2 }, { s: 1, up: true }, { s: 0 }, { s: 2, lead: false },
    ],
    chord: 'rhodes', bass: 'upright', lead: 'vibes', kit: 'brush',
    comp: { steps: [0, 10], len: 5 },
    bassPat: [[0, 'r', 3], [4, 't', 3], [8, 'f', 3], [12, 'a', 3]],
    melody: { lens: [2, 4, 4, 6, 8], rest: 0.22, lo: 7, hi: 14 },
    pad: true, reverb: 3.2, trim: 8,
    drums: { k: 'o...o...o...o...', s: '....o.......o...', h: 'x.....x.x.....x.' },
  },
  // Attract mode: pulse-wave arpeggios, a bouncing triangle bass, a bright square tune. Major, light and quick.
  'arcade-attract': {
    bpm: [128, 136], tonic: [57, 60], mode: 'ionian', grid: 16, swing: 0,
    sections: [[0, 5, 3, 4], [0, 5, 3, 4], [3, 4, 0, 5], [1, 4, 0, 0]],
    form: [
      { s: 0, lead: false, drums: false }, { s: 0 }, { s: 2 }, { s: 1, up: true },
      { s: 3 }, { s: 0, up: true }, { s: 2 }, { s: 3, lead: false },
    ],
    chord: 'chip', bass: 'chip', lead: 'chip', kit: 'chip',
    comp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], len: 2, arp: true },
    bassPat: [[0, 'r', 2], [2, 'o', 2], [4, 'r', 2], [6, 'o', 2], [8, 'r', 2], [10, 'o', 2], [12, 'r', 2], [14, 'f', 2]],
    melody: { lens: [2, 2, 4, 4, 6], rest: 0.1, lo: 7, hi: 17 },
    reverb: 1.2,
    drums: { k: 'x.......x.....x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  },
  // The rush: minor, faster, sixteenth arpeggios and a driving kick. For when the cabinets get serious.
  'arcade-high-score': {
    bpm: [152, 160], tonic: [57, 60], mode: 'aeolian', grid: 16, swing: 0,
    sections: [[0, 5, 2, 6], [0, 5, 2, 6], [3, 5, 6, 4], [0, 3, 6, 4]],
    form: [
      { s: 0, lead: false, drums: false }, { s: 0 }, { s: 2 }, { s: 1, up: true },
      { s: 3 }, { s: 0, up: true }, { s: 2 }, { s: 3, lead: false },
    ],
    chord: 'chip', bass: 'chip', lead: 'chip', kit: 'chipFast',
    comp: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], len: 1, arp: true },
    bassPat: [[0, 'r', 2], [2, 'r', 2], [4, 'o', 2], [6, 'r', 2], [8, 'r', 2], [10, 'r', 2], [12, 'o', 2], [14, 'f', 2]],
    melody: { lens: [1, 2, 2, 3, 4], rest: 0.08, lo: 7, hi: 17 },
    reverb: 1,
    drums: { k: 'x...x...x...x...', s: '....x.......x..x', h: 'ooxooxooxooxooxo' },
  },
  // Links Park by day: a fingerpicked guitar, a soft flute tune, a lazy bass. Mixolydian, in no hurry.
  'park-breeze': {
    bpm: [92, 100], tonic: [55, 59], mode: 'mixolydian', grid: 16, swing: 0.15,
    sections: [[0, 3, 0, 4], [0, 3, 4, 0], [5, 3, 0, 4]],
    form: [
      { s: 0, lead: false, drums: false }, { s: 0 }, { s: 1 }, { s: 0, up: true },
      { s: 2 }, { s: 1, up: true }, { s: 0 }, { s: 2, lead: false },
    ],
    chord: 'guitar', bass: 'round', lead: 'flute', kit: 'folk',
    comp: { steps: [0, 3, 6, 8, 11, 14], len: 6, arp: true },
    bassPat: [[0, 'r', 6], [8, 'f', 6]],
    melody: { lens: [4, 4, 6, 6, 8], rest: 0.15, lo: 7, hi: 15 },
    reverb: 3,
    drums: { k: 'o.......o.......', s: '', h: '..o...o...o...o.' },
  },
  // The dock: a squeezebox rolling in 6/8 with a stomp and a tin whistle. Dorian, so it sounds a little salty.
  'dockside-shanty': {
    bpm: [96, 104], tonic: [50, 54], mode: 'dorian', grid: 12, swing: 0,
    sections: [[0, 0, 3, 4], [0, 6, 3, 0], [5, 3, 4, 0]],
    form: [
      { s: 0, lead: false, drums: false }, { s: 0 }, { s: 1 }, { s: 0, up: true },
      { s: 2 }, { s: 1, up: true }, { s: 0 }, { s: 2, lead: false },
    ],
    chord: 'squeeze', bass: 'upright', lead: 'whistle', kit: 'shanty',
    comp: { steps: [0, 6], len: 6 },
    bassPat: [[0, 'r', 4], [6, 'f', 4]],
    melody: { lens: [2, 2, 4, 6], rest: 0.1, lo: 7, hi: 15 },
    reverb: 2.5,
    drums: { k: 'x.....o.....', s: '......x.....', h: 'o.o.o.o.o.o.' },
  },
};

// ------------------------------------------------------------------ composing

interface Note { t: number; note: string; dur: number; vel: number }
interface Hit { t: number; vel: number }
interface Chord { t: number; notes: string[]; dur: number; vel: number }

/** Picks the scale degree nearest `deg` whose pitch class is in `targets` (degrees mod 7). */
function snapToChord(deg: number, targets: number[]): number {
  let best = deg;
  let bestD = Infinity;
  for (let d = deg - 3; d <= deg + 3; d++) {
    const m = ((d % 7) + 7) % 7;
    if (!targets.includes(m)) continue;
    const dist = Math.abs(d - deg);
    if (dist < bestD) { best = d; bestD = dist; }
  }
  return best;
}

/** A two-bar rhythm: [position in two bars, length] in sixteenths. */
function makeRhythm(rng: () => number, spec: TrackSpec): [number, number][] {
  const bar = spec.grid;
  const out: [number, number][] = [];
  for (let b = 0; b < 2; b++) {
    let pos = 0;
    while (pos < bar) {
      let len = spec.melody.lens[Math.floor(rng() * spec.melody.lens.length)];
      if (pos + len > bar) len = bar - pos;
      const rest = pos > 0 && rng() < spec.melody.rest;
      if (!rest) out.push([b * bar + pos, len]);
      pos += len;
    }
  }
  return out;
}

/** One four-bar phrase: a question over bars 0-1 and an answer over 2-3 that reuses the rhythm. */
function composePhrase(
  rng: () => number,
  spec: TrackSpec,
  chordDegs: number[],
  rhythm: [number, number][],
): { bar: number; pos: number; len: number; deg: number }[] {
  const out: { bar: number; pos: number; len: number; deg: number }[] = [];
  const { lo, hi } = spec.melody;
  let cur = Math.round((lo + hi) / 2);
  for (let half = 0; half < 2; half++) {
    const notes = rhythm.map(([p, l], i) => ({ p, l, i }));
    notes.forEach(({ p, l, i }) => {
      const bar = half * 2 + Math.floor(p / spec.grid);
      const pos = p % spec.grid;
      const deg = chordDegs[bar];
      const tones = [deg, deg + 2, deg + 4].map((d) => ((d % 7) + 7) % 7);
      const stepR = rng();
      const move = stepR < 0.2 ? 0 : stepR < 0.55 ? 1 : stepR < 0.9 ? -1 : (rng() < 0.5 ? 2 : -2);
      let next = cur + (i === 0 ? (rng() < 0.5 ? -1 : 1) : move);
      const strong = pos % (spec.grid / 2) === 0;
      if (strong) next = snapToChord(next, tones);
      next = Math.max(lo, Math.min(hi, next));
      const isLast = i === notes.length - 1;
      if (isLast) {
        // The question ends open (a third or fifth of its chord); the answer ends on the chord's root.
        next = half === 0 ? snapToChord(next, [(deg + 2) % 7, (deg + 4) % 7]) : snapToChord(next, [deg % 7]);
        next = Math.max(lo, Math.min(hi, next));
      }
      cur = next;
      out.push({ bar, pos, len: isLast ? Math.max(l, spec.grid / 2) : l, deg: next });
    });
  }
  return out;
}

// ------------------------------------------------------------------ voices

interface Voice { play(time: number, note: string | string[], dur: number, vel: number): void }

type Send = (amount: number, to: ToneNS.InputNode) => ToneNS.Gain;

function makeChordVoice(T: Tone, keep: Keep, out: ToneNS.Volume, fx: { rev: ToneNS.ToneAudioNode; delay: ToneNS.ToneAudioNode }, send: Send, kind: ChordVoice): Voice {
  if (kind === 'uke' || kind === 'guitar') {
    const guitar = kind === 'guitar';
    const lp = keep(new T.Filter(guitar ? 2600 : 3200, 'lowpass')).fan(out, send(0.22, fx.rev));
    const s = keep(new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: guitar ? 0.9 : 0.35, sustain: 0, release: guitar ? 0.8 : 0.2 },
    })).connect(lp);
    s.maxPolyphony = 10;
    s.volume.value = guitar ? -14 : -13;
    return { play: (t, n, d, v) => s.triggerAttackRelease(n, d, t, v) };
  }
  if (kind === 'rhodes') {
    const lp = keep(new T.Filter(2400, 'lowpass')).fan(out, send(0.3, fx.rev), send(0.12, fx.delay));
    const s = keep(new T.PolySynth(T.FMSynth, {
      harmonicity: 2, modulationIndex: 1.4,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.006, decay: 1.4, sustain: 0.18, release: 1.2 },
      modulationEnvelope: { attack: 0.004, decay: 0.5, sustain: 0.1, release: 0.4 },
    })).connect(lp);
    s.maxPolyphony = 10;
    s.volume.value = -14;
    return { play: (t, n, d, v) => s.triggerAttackRelease(n, d, t, v) };
  }
  if (kind === 'squeeze') {
    // A squeezebox: two detuned saws with a slow swell, held for the bar.
    const lp = keep(new T.Filter(1500, 'lowpass')).fan(out, send(0.25, fx.rev));
    const s = keep(new T.PolySynth(T.Synth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.25 },
    })).connect(lp);
    s.maxPolyphony = 10;
    s.volume.value = -22;
    return { play: (t, n, d, v) => s.triggerAttackRelease(n, d, t, v) };
  }
  // chip: a narrow pulse wave, short.
  const lp = keep(new T.Filter(5200, 'lowpass')).fan(out, send(0.1, fx.rev));
  const s = keep(new T.PolySynth(T.Synth, {
    oscillator: { type: 'pulse', width: 0.25 } as never,
    envelope: { attack: 0.002, decay: 0.09, sustain: 0.25, release: 0.04 },
  })).connect(lp);
  s.maxPolyphony = 8;
  s.volume.value = -22;
  return { play: (t, n, d, v) => s.triggerAttackRelease(n, d, t, v) };
}

function makeBassVoice(T: Tone, keep: Keep, out: ToneNS.Volume, kind: BassVoice): Voice {
  if (kind === 'chip') {
    const lp = keep(new T.Filter(900, 'lowpass')).connect(out);
    const s = keep(new T.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.003, decay: 0.12, sustain: 0.5, release: 0.05 },
    })).connect(lp);
    s.volume.value = -9;
    return { play: (t, n, d, v) => s.triggerAttackRelease(n as string, d, t, v) };
  }
  const round = kind === 'round';
  const lp = keep(new T.Filter(round ? 420 : 700, 'lowpass')).connect(out);
  const s = keep(new T.MonoSynth({
    oscillator: { type: round ? 'sine' : 'triangle' },
    envelope: { attack: round ? 0.04 : 0.008, decay: round ? 0.4 : 0.28, sustain: round ? 0.6 : 0.15, release: round ? 0.9 : 0.25 },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.3, baseFrequency: 160, octaves: round ? 0.6 : 1.8 },
  })).connect(lp);
  s.volume.value = round ? -10 : -8;
  return { play: (t, n, d, v) => s.triggerAttackRelease(n as string, d, t, v) };
}

function makeLeadVoice(T: Tone, keep: Keep, out: ToneNS.Volume, fx: { rev: ToneNS.ToneAudioNode; delay: ToneNS.ToneAudioNode }, send: Send, kind: LeadVoice): Voice {
  if (kind === 'glock' || kind === 'vibes') {
    const vibes = kind === 'vibes';
    const lp = keep(new T.Filter(vibes ? 4200 : 6000, 'lowpass')).fan(out, send(0.3, fx.rev), send(0.2, fx.delay));
    const s = keep(new T.PolySynth(T.FMSynth, {
      harmonicity: vibes ? 4 : 3.5, modulationIndex: vibes ? 1.6 : 2.2,
      oscillator: { type: 'sine' }, modulation: { type: 'sine' },
      envelope: { attack: 0.002, decay: vibes ? 1.5 : 0.8, sustain: 0, release: vibes ? 1.6 : 0.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 },
    })).connect(lp);
    s.maxPolyphony = 6;
    s.volume.value = vibes ? -12 : -11;
    return { play: (t, n, d, v) => s.triggerAttackRelease(n, d, t, v) };
  }
  if (kind === 'flute' || kind === 'whistle') {
    const whistle = kind === 'whistle';
    const lp = keep(new T.Filter(whistle ? 4800 : 3600, 'lowpass')).fan(out, send(0.3, fx.rev), send(0.15, fx.delay));
    const s = keep(new T.Synth({
      oscillator: { type: whistle ? 'sine' : 'triangle' },
      envelope: { attack: whistle ? 0.02 : 0.06, decay: 0.2, sustain: 0.7, release: 0.25 },
    })).connect(lp);
    const vib = keep(new T.LFO({ frequency: 5, min: -9, max: 9 })).connect(s.detune);
    vib.start();
    s.volume.value = whistle ? -14 : -12;
    return { play: (t, n, d, v) => s.triggerAttackRelease(n as string, d, t, v) };
  }
  // chip lead: a square wave with a short bite.
  const lp = keep(new T.Filter(6000, 'lowpass')).fan(out, send(0.12, fx.rev), send(0.1, fx.delay));
  const s = keep(new T.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.002, decay: 0.1, sustain: 0.55, release: 0.06 },
  })).connect(lp);
  s.volume.value = -19;
  return { play: (t, n, d, v) => s.triggerAttackRelease(n as string, d, t, v) };
}

// ------------------------------------------------------------------ the engine

function buildFromSpec(T: Tone, keep: Keep, out: ToneNS.Volume, seed: number, spec: TrackSpec): void {
  const rng = mulberry32(seed);
  const bpm = spec.bpm[0] + Math.floor(rng() * (spec.bpm[1] - spec.bpm[0] + 1));
  const tonic = spec.tonic[0] + Math.floor(rng() * (spec.tonic[1] - spec.tonic[0] + 1));
  T.getTransport().bpm.value = bpm;
  out.volume.value += spec.trim ?? 4;
  const mode = MODES[spec.mode];

  // Bar length: 4/4 is four quarter notes; the 12-grid bars are 3/4 (a waltz) or 6/8 (two dotted quarters). Both
  // are 12 sixteenths, so the sixteenth is a quarter of a beat in 3/4 and 6/8 alike at this tempo.
  const SIX = 15 / bpm; // one sixteenth, seconds
  const BAR = SIX * spec.grid;
  const at = (bar: number, pos: number): number => bar * BAR + pos * SIX + (pos % 4 === 2 ? spec.swing * 2 * SIX : 0);
  const totalBars = spec.form.length * 4;
  const LOOP = totalBars * BAR;

  // One melody per section, composed once; the form decides who plays it where.
  const phrases = spec.sections.map((chordDegs) => composePhrase(rng, spec, chordDegs, makeRhythm(rng, spec)));

  const compEv: Note[] = [];
  const padEv: Chord[] = [];
  const bassEv: Note[] = [];
  const leadEv: Note[] = [];
  const kickEv: Hit[] = [];
  const snareEv: Hit[] = [];
  const hatEv: Hit[] = [];

  let prev: number[] | null = null;
  const arpOrder = [0, 1, 2, 3, 2, 1];
  spec.form.forEach((part, section) => {
    const degs = spec.sections[part.s];
    degs.forEach((deg, i) => {
      const bar = section * 4 + i;
      const voiced = voiceLead(chordTones(mode, deg, spec.chordSize ?? 4).map((t) => tonic + t), 62, prev);
      prev = voiced;
      const sorted = [...voiced].sort((a, b) => a - b);
      // Chords.
      spec.comp.steps.forEach((pos, k) => {
        const t = at(bar, pos);
        const dur = Math.min(spec.comp.len * SIX * 0.95, BAR - pos * SIX);
        const strong = pos === 0 || pos % (spec.grid / 2) === 0;
        if (spec.comp.arp) {
          const idx = arpOrder[(spec.comp.steps.length > 8 ? pos : k) % arpOrder.length] % sorted.length;
          compEv.push({ t, note: midiToNote(sorted[idx] + (spec.chord === 'chip' ? 12 : 0)), dur, vel: strong ? 0.55 : 0.4 });
        } else {
          sorted.forEach((n, j) => compEv.push({ t: t + (spec.chord === 'uke' ? j * 0.012 : 0), note: midiToNote(n), dur, vel: strong ? 0.55 : 0.42 }));
        }
      });
      if (spec.pad) padEv.push({ t: at(bar, 0), notes: sorted.map((n) => midiToNote(n - 12)), dur: BAR * 0.98, vel: 0.35 });

      // Bass: the chord's root kept near the bottom of the bass range.
      const nextDeg = degs[(i + 1) % 4];
      const place = (semi: number): number => {
        let m = tonic + semi;
        while (m > 50) m -= 12;
        while (m < 36) m += 12;
        return m;
      };
      const rootSemi = degreeToMidi(0, mode, deg);
      const root = place(rootSemi);
      for (const [pos, kind, len] of spec.bassPat) {
        let m = root;
        if (kind === 'f') m = root + 7;
        else if (kind === 'o') m = root + 12;
        else if (kind === 't') m = root + (mode[(deg + 2) % 7] - mode[deg % 7] + 12) % 12;
        else if (kind === 'a') m = place(degreeToMidi(0, mode, nextDeg)) + (rng() < 0.5 ? -1 : 1);
        bassEv.push({ t: at(bar, pos), note: midiToNote(m), dur: Math.max(SIX, len * SIX * 0.9), vel: pos === 0 ? 0.8 : 0.62 });
      }

      // Drums.
      if (part.drums !== false) {
        const { k, s, h } = spec.drums;
        for (let pos = 0; pos < spec.grid; pos++) {
          const vel = (c: string | undefined): number => (c === 'x' ? 0.9 : c === 'o' ? 0.4 : 0);
          const t = at(bar, pos);
          if (vel(k?.[pos])) kickEv.push({ t, vel: vel(k?.[pos]) });
          if (vel(s?.[pos])) snareEv.push({ t, vel: vel(s?.[pos]) });
          if (vel(h?.[pos])) hatEv.push({ t, vel: vel(h?.[pos]) });
        }
      }
    });

    // Melody.
    if (part.lead !== false) {
      for (const n of phrases[part.s]) {
        const bar = section * 4 + n.bar;
        const base = degreeToMidi(tonic, mode, n.deg);
        const midi = part.up && base + 12 <= 88 ? base + 12 : base;
        leadEv.push({
          t: at(bar, n.pos),
          note: midiToNote(midi),
          dur: Math.min(n.len * SIX * 0.92, (spec.grid - n.pos) * SIX),
          vel: n.pos === 0 ? 0.8 : 0.65,
        });
      }
    }
  });

  // ----- instruments -----
  const fx = createFx(T, keep, out, { reverbDecay: spec.reverb, echoTime: '8n.', echoFeedback: 0.25 });
  const send: Send = (amount, to) => keep(new T.Gain(amount)).connect(to);

  const chordV = makeChordVoice(T, keep, out, fx, send, spec.chord);
  const bassV = makeBassVoice(T, keep, out, spec.bass);
  const leadV = makeLeadVoice(T, keep, out, fx, send, spec.lead);

  const padLp = keep(new T.Filter(1300, 'lowpass')).fan(out, send(0.5, fx.rev));
  const pad = keep(new T.PolySynth(T.Synth, {
    oscillator: { type: 'fattriangle', count: 2, spread: 12 },
    envelope: { attack: 0.8, decay: 0.4, sustain: 0.8, release: 1.6 },
  })).connect(padLp);
  pad.maxPolyphony = 8;
  pad.volume.value = -22;

  const chip = spec.kit === 'chip' || spec.kit === 'chipFast';
  const brush = spec.kit === 'brush';
  const kick = keep(new T.MembraneSynth({
    pitchDecay: chip ? 0.02 : 0.04, octaves: chip ? 4 : 5,
    envelope: { attack: 0.001, decay: chip ? 0.14 : 0.3, sustain: 0, release: 0.1 },
  })).connect(out);
  kick.volume.value = brush ? -20 : chip ? -9 : -12;
  const snHp = keep(new T.Filter(chip ? 1800 : 1200, 'highpass')).fan(out, send(chip ? 0.03 : 0.18, fx.rev));
  const snare = keep(new T.NoiseSynth({
    noise: { type: brush ? 'pink' : 'white' },
    envelope: { attack: brush ? 0.012 : 0.001, decay: brush ? 0.2 : chip ? 0.09 : 0.14, sustain: 0, release: 0.05 },
  })).connect(snHp);
  snare.volume.value = brush ? -24 : chip ? -17 : -19;
  const hatHp = keep(new T.Filter(brush ? 3500 : 6500, 'highpass')).connect(out);
  const hat = keep(new T.NoiseSynth({
    noise: { type: brush ? 'pink' : 'white' },
    envelope: { attack: 0.002, decay: brush ? 0.2 : 0.04, sustain: 0, release: 0.02 },
  })).connect(hatHp);
  hat.volume.value = brush ? -26 : chip ? -26 : -28;

  // ----- schedule: one looping Part per voice, times in seconds -----
  const schedule = <V extends { t: number }>(events: V[], fn: (time: number, v: V) => void): void => {
    const pairs: [number, V][] = events.map((e) => [e.t, e]);
    const part = keep(new T.Part<[number, V]>((time, v) => {
      try { fn(time, v); } catch { /* skip this note */ }
    }, pairs));
    part.loop = true;
    part.loopEnd = LOOP;
    part.start(0);
  };
  const mono = (): ((t: number) => number) => {
    let last = -1;
    return (t) => (last = t > last ? t : last + 0.001);
  };
  const bassT = mono();
  const leadT = mono();
  const kickT = mono();
  const snareT = mono();
  const hatT = mono();
  schedule(compEv, (time, e) => chordV.play(time, e.note, e.dur, e.vel));
  if (spec.pad) schedule(padEv, (time, e) => pad.triggerAttackRelease(e.notes, e.dur, time, e.vel));
  schedule(bassEv, (time, e) => bassV.play(bassT(time), e.note, e.dur, e.vel));
  schedule(leadEv, (time, e) => leadV.play(leadT(time), e.note, e.dur, e.vel));
  schedule(kickEv, (time, e) => kick.triggerAttackRelease(chip ? 'C2' : 'C1', 0.2, kickT(time), e.vel));
  schedule(snareEv, (time, e) => snare.triggerAttackRelease(0.12, snareT(time), e.vel));
  schedule(hatEv, (time, e) => hat.triggerAttackRelease(0.05, hatT(time), e.vel));
}

/** Builds one Club Gnome track. The same seed always gives the same song. */
export function buildClubGnomeTrack(T: Tone, keep: Keep, out: ToneNS.Volume, seed: number, id: ClubGnomeTrackId): void {
  if (id === 'casino-lounge') {
    buildBlackjackJazz(T, keep, out, seed);
    return;
  }
  buildFromSpec(T, keep, out, seed, SPECS[id]);
}

/** Builder for `playSong`. */
export function clubGnomeSong(seed: number, id: ClubGnomeTrackId) {
  return (T: Tone, keep: Keep, out: ToneNS.Volume): void => buildClubGnomeTrack(T, keep, out, seed, id);
}
