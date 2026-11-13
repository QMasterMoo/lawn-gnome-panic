/**
 * src/music.ts: a new old-school (90s/00s) jungle / drum & bass track for every run.
 *
 * API: startMusic() on run start (new random seed each time), pause/resumeMusic() with the
 * pause menu, stopMusic() on run end and in the lobby. Music keeps playing during level-up picks.
 * setMusicMuted()/isMusicMuted() back the 🎵 button and the M key (src/ui/muteButton.ts).
 *
 * Design decisions, and why:
 *
 * - Tone.js (MIT; a library, not an asset) is loaded with a dynamic import, so it sits in its own
 *   chunk and a failed load just means no music. Every call is wrapped in try/catch: music must
 *   never break the game. It uses its own AudioContext, separate from the SFX in audio.ts.
 *
 * - No samples. The classic breaks are not CC0, which repo rules forbid (docs/assets.md), so the kit is
 *   synthesized (MembraneSynth kick, pink noise + membrane snare, high-passed noise hats). The breaks
 *   (Amen, Think, Funky Drummer, Apache) are used only as rhythm templates: 2-bar, 16th-note grids in
 *   BREAKS, transcribed by hand and approximate. Each run picks a main break for A/C and a different
 *   one for B. The snare is pink noise, band-limited to 900 Hz to 4.5 kHz, after white noise sounded too bright.
 *
 * - Chopping was first fully random every bar, which played back as "too random". Now each run
 *   chops a handful of bars once and repeats them. Swaps keep the downbeat and backbeat, and only
 *   take a slice from the same spot in another beat, so the groove keeps its shape. The `amount`
 *   argument of chopBar() is the knob: 0 is the straight break.
 *
 * - Song form is A B A C, 16 bars per section, looped. The first A opens with the straight break, and the bass
 *   comes in at bar 8. B has its own progression, bass riff, stab rhythm and harder chops.
 *   C starts with an 8-bar breakdown (drums out, pad + held reese, hats creeping back), then the beat drops back in. A snare-roll fill
 *   comes every 8 bars, and a dub echo "throw" catches the last snare of every 4th bar.
 *
 * - Harmony is chord-memory style, inspired by the Cthulhu plugin: a bank of PRESETS, each a minor
 *   mode (aeolian, dorian, phrygian, harmonic minor) plus two 4-chord progressions written as scale
 *   degrees. Chords are stacked in thirds inside the mode (7ths for the pad, 9ths for the stabs), so
 *   they always fit the mode. voiceLead() picks the inversion that moves least from the previous chord;
 *   this replaced random root jumps, which sounded messy. The bass plays chord roots, kept
 *   near the tonic. Each run logs its preset, key and tempo to the console.
 *
 * - Mixing is deliberately basic: a glue compressor and limiter on the master, about -12 dB under the
 *   SFX. Drums go through a gritty compressed bus with the snare pulled down. Tonal parts sit on a
 *   bus that ducks on each kick (fake sidechain). Stabs, pad, reese and the reverb return are
 *   high-passed so the sine sub owns the low end. Stabs feed a ping-pong delay into a hall reverb, and the pad feeds the reverb.
 *
 * - Lifecycle: every start tears down the Transport, its events and all nodes (`disposables`)
 *   before building again, otherwise the next run stacks a second track on top. A `generation`
 *   counter drops stale async starts. All triggers use the `time` passed to the Loop callback,
 *   never Tone.now(), or the break flams.
 */
import type * as ToneNS from 'tone';

type Tone = typeof ToneNS;

/** One 16th-note slice of the break. g = ghost snare, o = open hat. */
interface Slice { k?: 1; s?: 1; g?: 1; h?: 1; o?: 1 }

/**
 * A 2-bar break from text rows, 32 steps each ('x' = hit). Rows: k kick, s snare, g ghost snare,
 * h closed hat/ride, o open hat. Blank rows mean "none".
 */
function grid(rows: Partial<Record<keyof Slice, string>>): Slice[] {
  const out: Slice[] = Array.from({ length: 32 }, () => ({}));
  for (const [key, row] of Object.entries(rows) as [keyof Slice, string][]) {
    const r = row.replace(/[ |]/g, '');
    for (let i = 0; i < 32; i++) if (r[i] === 'x') out[i][key] = 1;
  }
  return out;
}

/**
 * Classic breaks as rhythm templates only (hand-transcribed, approximate; no audio is used).
 * Each is 2 bars: an A bar and a variation bar that is good chop material.
 */
interface Break { name: string; steps: Slice[] }
const BREAKS: Break[] = [
  { name: 'Amen', steps: grid({ // The Winstons: bars 1 and 4
    k: 'x.x.......xx.... | x.x........x..x.',
    s: '....x..x.x..x..x | ....x..x.x...x..',
    g: '................ | ...............x',
    h: 'x.x.x.x.x.x.x.x. | x.x.x.x.x.x.x.x.',
    o: '................ | ..........x.....',
  }) },
  { name: 'Think', steps: grid({ // Lyn Collins: busy kick, open hat lifts
    k: 'x......x..x..... | x..x..x...x.....',
    s: '....x.......x... | ....x..x....x...',
    g: '..........x....x | .........x.....x',
    h: 'x.x.x.x.x.x.x.x. | x.x.x.x.x.x.x...',
    o: '......x......... | ..............x.',
  }) },
  { name: 'Funky Drummer', steps: grid({ // James Brown: 16th hats, ghost-note shuffle
    k: 'x.x.......x..x.. | x.x.......x.....',
    s: '....x.......x... | ....x.......x...',
    g: '.......x.x.....x | .x.....x.x.x...x',
    h: 'xxxxxx.xxxxxxxxx | xxxxxx.xxxxxxx.x',
    o: '......x......... | ......x.......x.',
  }) },
  { name: 'Apache', steps: grid({ // Incredible Bongo Band: rolling, swung feel
    k: 'x.....x...x..... | x.....x.x.x.....',
    s: '....x.......x... | ....x.......x.x.',
    g: '..x.......x..... | .......x.......x',
    h: 'x.x.x.x.x.x.x.x. | x.x.x.x.x.x.x.x.',
  }) },
];

// ----- harmony: chord-memory style presets in minor modes -----
// Scale steps of each mode, in semitones from the tonic.
const MODES = {
  aeolian:  [0, 2, 3, 5, 7, 8, 10],
  dorian:   [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], // harmonic minor: the raised 7th gives a major V
} as const;
type ModeName = keyof typeof MODES;

/** A preset: a mode and two 4-chord progressions (scale degrees, 0 = i), one for A sections and one for B. */
interface ChordPreset { name: string; mode: ModeName; a: number[]; b: number[] }
const PRESETS: ChordPreset[] = [
  { name: 'Aeolian Liquid',    mode: 'aeolian',  a: [0, 5, 2, 6], b: [3, 5, 6, 6] }, // i VI III VII | iv VI VII VII
  { name: 'Aeolian Rave',      mode: 'aeolian',  a: [0, 6, 5, 6], b: [0, 3, 5, 4] }, // i VII VI VII | i iv VI v
  { name: 'Dorian Roller',     mode: 'dorian',   a: [0, 3, 0, 3], b: [1, 3, 6, 0] }, // i IV i IV   | ii IV VII i
  { name: 'Dorian Soul',       mode: 'dorian',   a: [0, 1, 2, 1], b: [3, 2, 1, 0] }, // i ii III ii | IV III ii i
  { name: 'Phrygian Dread',    mode: 'phrygian', a: [0, 1, 0, 1], b: [0, 6, 5, 1] }, // i II i II   | i vii VI II
  { name: 'Phrygian Steppers', mode: 'phrygian', a: [0, 0, 6, 1], b: [5, 6, 1, 0] },
  { name: 'Harmonic Tension',  mode: 'harmonic', a: [0, 3, 4, 0], b: [5, 3, 4, 4] }, // i iv V i    | VI iv V V
  { name: 'Harmonic Noir',     mode: 'harmonic', a: [0, 5, 3, 4], b: [0, 1, 5, 4] },
];

/** Chord tones for a scale degree, stacked in thirds inside the mode (size 4 = 7th chord, 5 = 9th). */
function chordTones(mode: readonly number[], degree: number, size: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < size; k++) {
    const idx = degree + 2 * k;
    out.push(mode[idx % 7] + 12 * Math.floor(idx / 7));
  }
  return out;
}

/** Picks the inversion/octave of `tones` (around `center`) that moves least from `prev`. */
function voiceLead(tones: number[], center: number, prev: number[] | null): number[] {
  const candidates: number[][] = [];
  for (let inv = 0; inv < tones.length; inv++) {
    const v = tones.map((t, i) => t + (i < inv ? 12 : 0)).sort((x, y) => x - y);
    for (let oct = -2; oct <= 2; oct++) {
      const shifted = v.map((t) => t + 12 * oct);
      const mid = (shifted[0] + shifted[shifted.length - 1]) / 2;
      if (Math.abs(mid - center) <= 7) candidates.push(shifted);
    }
  }
  if (!prev) return candidates.reduce((best, c) => {
    const d = (x: number[]) => Math.abs((x[0] + x[x.length - 1]) / 2 - center);
    return d(c) < d(best) ? c : best;
  });
  const cost = (c: number[]) => c.reduce((sum, t, i) => sum + Math.abs(t - prev[Math.min(i, prev.length - 1)]), 0);
  return candidates.reduce((best, c) => (cost(c) < cost(best) ? c : best));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One chopped bar from the 2-bar source. `amount` is the chance each 8th gets swapped.
 * Swaps only take a slice from the same spot in the beat, so the groove keeps its shape.
 */
function chopBar(rnd: () => number, source: Slice[], sourceBar: 0 | 1, amount: number): Slice[] {
  const out: Slice[] = [];
  for (let eighth = 0; eighth < 8; eighth++) {
    let src = eighth + sourceBar * 8;
    // Downbeat and backbeat stay put; elsewhere swap with the same 8th of a random beat.
    if (eighth !== 0 && eighth !== 2 && rnd() < amount) src = (eighth % 2) + 2 * Math.floor(rnd() * 8);
    const a = source[src * 2];
    const b = source[src * 2 + 1];
    if (eighth >= 6 && rnd() < amount * 0.3) out.push(a, a); // occasional stutter, late in the bar
    else out.push(a, b);
  }
  return out;
}

function withFill(rnd: () => number, bar: Slice[]): Slice[] {
  const out = bar.slice();
  const rollFrom = rnd() < 0.5 ? 12 : 8;
  for (let i = rollFrom; i < 16; i++) out[i] = i % 2 === 0 || i > 13 ? { s: 1 } : { g: 1 };
  return out;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToNote(m: number): string {
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

let tone: Tone | null = null;
let loading: Promise<Tone | null> | null = null;
let disposables: { dispose(): unknown }[] = [];
let generation = 0;
let playing = false;
let outVolume: ToneNS.Volume | null = null;

const MUSIC_DB = -12;
const MUTE_KEY = 'lgp-music-muted';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

export function isMusicMuted(): boolean { return muted; }

export function setMusicMuted(m: boolean): void {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* per-session only */ }
  try { if (outVolume) outVolume.mute = m; } catch { /* ignore */ }
}

function loadTone(): Promise<Tone | null> {
  if (tone) return Promise.resolve(tone);
  loading ??= import('tone')
    .then((m) => (tone = m))
    .catch(() => null);
  return loading;
}

function teardown(T: Tone): void {
  const transport = T.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;
  for (const d of disposables) {
    try { d.dispose(); } catch { /* ignore */ }
  }
  disposables = [];
  outVolume = null;
}

type Section = 'A' | 'B' | 'C';
const SONG: Section[] = ['A', 'B', 'A', 'C'];
const SECTION_BARS = 16;

function build(T: Tone, seed: number): void {
  const rnd = mulberry32(seed);
  const pick = <V>(xs: V[]): V => xs[Math.floor(rnd() * xs.length)];
  const keep = <V extends { dispose(): unknown }>(x: V): V => { disposables.push(x); return x; };

  const transport = T.getTransport();
  transport.bpm.value = 162 + Math.floor(rnd() * 14);

  // ----- master: glue compressor + limiter so the layers sit together -----
  const limiter = keep(new T.Limiter(-1)).toDestination();
  const glue = keep(new T.Compressor({ threshold: -20, ratio: 2.5, attack: 0.02, release: 0.25 })).connect(limiter);
  const out = keep(new T.Volume(MUSIC_DB)).connect(glue);
  out.mute = muted;
  outVolume = out;

  // ----- effects -----
  // Reverb return is high-passed so tails never muddy the bass.
  const revHp = keep(new T.Filter(300, 'highpass')).connect(out);
  const rev = keep(new T.Reverb({ decay: 3.5, preDelay: 0.02, wet: 1 })).connect(revHp);
  const delay = keep(new T.PingPongDelay({ delayTime: '8n.', feedback: 0.42, wet: 1 })).connect(rev);
  const throwDelay = keep(new T.FeedbackDelay({ delayTime: '4n', feedback: 0.5, wet: 1 })).connect(rev);
  const throwSend = keep(new T.Gain(0)).connect(throwDelay);
  const snareRoomSend = keep(new T.Gain(0.15)).connect(rev);

  // ----- drums -----
  const drumBus = keep(new T.Compressor({ threshold: -18, ratio: 4, attack: 0.005, release: 0.1 })).connect(out);
  const grit = keep(new T.Distortion(0.2)).connect(drumBus);
  const kick = keep(new T.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 } })).connect(grit);
  const snareBody = keep(new T.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 } })).connect(grit);
  snareBody.volume.value = -9;
  const snareHp = keep(new T.Filter(900, 'highpass')).fan(grit, snareRoomSend, throwSend);
  const snareLp = keep(new T.Filter(4500, 'lowpass')).connect(snareHp); // keeps the snare from sounding fizzy
  const snare = keep(new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.03 } })).connect(snareLp);
  snare.volume.value = -7;
  const hatHp = keep(new T.Filter(7000, 'highpass')).connect(drumBus);
  const hat = keep(new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 } })).connect(hatHp);
  hat.volume.value = -14;
  const snarePitch = pick(['D3', 'E3', 'F#3']);

  // ----- music bus: everything tonal ducks under the kick (simple sidechain pump) -----
  const duck = keep(new T.Gain(1)).connect(out);

  // Reese: fat detuned saws, swept lowpass, high-passed so the sub owns the low end.
  const reeseHp = keep(new T.Filter(90, 'highpass')).connect(duck);
  const reeseFilter = keep(new T.Filter(500, 'lowpass')).connect(reeseHp);
  keep(new T.LFO(0.08 + rnd() * 0.15, 250, 1100)).connect(reeseFilter.frequency).start();
  const reese = keep(new T.MonoSynth({ oscillator: { type: 'fatsawtooth', count: 3, spread: 25 }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.2 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 1, release: 0.2, baseFrequency: 2000, octaves: 0 } })).connect(reeseFilter);
  reese.volume.value = -14;
  const sub = keep(new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 } })).connect(duck);
  sub.volume.value = -6;

  // Stab and pad: high-passed, mostly into the effects.
  const stabHp = keep(new T.Filter(250, 'highpass')).fan(duck, delay);
  const stab = keep(new T.PolySynth(T.Synth, { oscillator: { type: pick(['fatsawtooth', 'fatsquare'] as const) }, envelope: { attack: 0.003, decay: 0.18, sustain: 0, release: 0.15 } })).connect(stabHp);
  stab.volume.value = -20;
  const padFilter = keep(new T.Filter(900, 'lowpass'));
  const padHp = keep(new T.Filter(200, 'highpass')).fan(duck, rev);
  padFilter.connect(padHp);
  const pad = keep(new T.PolySynth(T.Synth, { oscillator: { type: 'fatsawtooth', count: 2, spread: 20 }, envelope: { attack: 1.2, decay: 0.5, sustain: 0.7, release: 2 } })).connect(padFilter);
  pad.volume.value = -26;

  // ----- song material: A and B get their own chords, bass riff and stab rhythm -----
  const root = 33 + Math.floor(rnd() * 12); // tonic, A1..G#2
  const preset = pick(PRESETS);
  const mode = MODES[preset.mode];
  console.info(`[music] ${preset.name} in ${NOTE_NAMES[root % 12]} ${preset.mode}, ${Math.round(transport.bpm.value)} bpm`);
  // Pre-voice every chord of both progressions once, voice-leading through the whole loop.
  const voiceProg = (prog: number[], size: number, center: number): number[][] => {
    let prev: number[] | null = null;
    return prog.map((deg) => (prev = voiceLead(chordTones(mode, deg, size), center, prev)));
  };
  const padA = voiceProg(preset.a, 4, 7), padB = voiceProg(preset.b, 4, 7);   // 7ths, mid register
  const stabA7 = voiceProg(preset.a, 5, 16), stabB7 = voiceProg(preset.b, 5, 16); // 9ths, higher up
  const bassNote = (deg: number) => { const t = mode[deg % 7]; return t > 7 ? t - 12 : t; }; // keep the bass near the tonic
  const bassRiffs: [number, number][][] = [
    [[0, 6], [10, 4]],
    [[0, 3], [3, 3], [10, 6]],
    [[0, 12], [14, 2]],
    [[0, 4], [6, 4], [11, 5]],
  ];
  const riffA = pick(bassRiffs);
  const riffB = pick(bassRiffs);
  const stabRhythms = [[0, 6], [3, 10], [6, 14], [0, 3, 10]];
  const stabA = pick(stabRhythms);
  const stabB = pick(stabRhythms);
  const chordBars = 2;

  // Break bars: A (and C) chop the main break lightly; B switches to a second break, chopped harder.
  // Jungle tracks often swap breaks between sections, so B gets its own.
  const mainIdx = Math.floor(rnd() * BREAKS.length);
  const mainBreak = BREAKS[mainIdx].steps;
  const altBreak = BREAKS[(mainIdx + 1 + Math.floor(rnd() * (BREAKS.length - 1))) % BREAKS.length];
  const alt = altBreak.steps;
  const straight = [chopBar(rnd, mainBreak, 0, 0), chopBar(rnd, mainBreak, 1, 0)];
  const drumsA = [chopBar(rnd, mainBreak, 0, 0.15), chopBar(rnd, mainBreak, 1, 0.2), chopBar(rnd, mainBreak, 0, 0.15), chopBar(rnd, mainBreak, 1, 0.3)];
  const drumsB = [chopBar(rnd, alt, 0, 0.35), chopBar(rnd, alt, 1, 0.4), chopBar(rnd, alt, 0, 0.35), chopBar(rnd, alt, 1, 0.5)];
  console.info(`[music] breaks: ${BREAKS[mainIdx].name} (A/C), ${altBreak.name} (B)`);
  const fillA = withFill(rnd, drumsA[3]);
  const fillB = withFill(rnd, drumsB[3]);

  const step16 = T.Time('16n').toSeconds();
  let step = 0;
  let pattern: Slice[] | null = null;
  const loop = keep(new T.Loop((time) => {
    const bar = Math.floor(step / 16);
    const pos = step % 16;
    step++;
    const sectionIdx = Math.floor(bar / SECTION_BARS);
    const section = SONG[sectionIdx % SONG.length];
    const sb = bar % SECTION_BARS; // bar within section
    const intro = sectionIdx === 0;
    const breakdown = section === 'C' && sb < 8;

    if (pos === 0) {
      const lastOfEight = sb % 8 === 7;
      if (breakdown) pattern = sb >= 6 ? straight[sb % 2].map((s) => (s.h ? { h: 1 as const } : {})) : null; // hats creep back in
      else if (intro && sb < 8) pattern = lastOfEight ? fillA : straight[sb % 2];
      else if (section === 'B') pattern = lastOfEight ? fillB : drumsB[sb % 4];
      else pattern = lastOfEight ? fillA : drumsA[sb % 4];
    }
    // Dub throw: the last snare of every 4th bar echoes off into the reverb.
    if (pos === 12) throwSend.gain.setValueAtTime(sb % 4 === 3 ? 0.5 : 0, time);
    if (pos === 0) throwSend.gain.setValueAtTime(0, time);

    const isB = section === 'B';
    const ci = Math.floor(sb / chordBars) % 4;
    const chordRoot = root + bassNote((isB ? preset.b : preset.a)[ci]);
    const padChord = (isB ? padB : padA)[ci];
    const stabChord = (isB ? stabB7 : stabA7)[ci];

    const sl = pattern?.[pos];
    if (sl) {
      if (sl.k) {
        kick.triggerAttackRelease('C1', '8n', time, 0.95);
        duck.gain.setValueAtTime(0.5, time);
        duck.gain.linearRampToValueAtTime(1, time + 0.15);
      }
      if (sl.s) { snare.triggerAttackRelease('16n', time, 0.8); snareBody.triggerAttackRelease(snarePitch, '32n', time, 0.6); }
      else if (sl.g) snare.triggerAttackRelease('32n', time, 0.25);
      if (sl.o) hat.triggerAttackRelease('8n', time, 0.5);
      else if (sl.h) hat.triggerAttackRelease('32n', time, pos % 4 === 0 ? 0.6 : 0.35);
    }

    // Bass: enters halfway through the intro; in the breakdown only long held roots.
    if (!(intro && sb < 8)) {
      if (breakdown) {
        if (pos === 0 && sb % 2 === 0) {
          const dur = 32 * step16 * 0.95;
          reese.triggerAttackRelease(midiToNote(chordRoot), dur, time, 0.6);
        }
      } else {
        for (const [at, len] of section === 'B' ? riffB : riffA) {
          if (pos !== at) continue;
          const dur = len * step16 * 0.95;
          reese.triggerAttackRelease(midiToNote(chordRoot), dur, time, 0.8);
          sub.triggerAttackRelease(midiToNote(chordRoot - 12), dur, time, 0.9);
        }
      }
    }
    // Stabs: from the first B on, not in the breakdown.
    const stabSteps = section === 'B' ? stabB : stabA;
    if (sectionIdx >= 1 && !breakdown && stabSteps.includes(pos)) {
      stab.triggerAttackRelease(stabChord.map((i) => midiToNote(root + 24 + i)), '16n', time, 0.7);
    }
    // Pad: always, one chord per 2 bars.
    if (pos === 0 && sb % chordBars === 0) {
      pad.triggerAttackRelease(padChord.map((i) => midiToNote(root + 24 + i)), chordBars * 16 * step16 * 0.95, time, breakdown ? 0.8 : 0.5);
    }
  }, '16n'));
  loop.start(0);
}

/** Starts a brand new track. Call once per run. */
export function startMusic(seed: number = Math.floor(Math.random() * 2 ** 31)): void {
  const gen = ++generation;
  playing = true;
  void loadTone().then(async (T) => {
    if (!T || gen !== generation) return;
    try {
      await T.start();
      if (gen !== generation) return;
      teardown(T);
      build(T, seed);
      if (playing) T.getTransport().start('+0.05');
    } catch {
      // Music must never break the game.
    }
  });
}

export function pauseMusic(): void {
  playing = false;
  try { tone?.getTransport().pause(); } catch { /* ignore */ }
}

export function resumeMusic(): void {
  playing = true;
  try {
    if (tone && disposables.length > 0) tone.getTransport().start();
  } catch { /* ignore */ }
}

export function stopMusic(): void {
  generation++;
  playing = false;
  try { if (tone) teardown(tone); } catch { /* ignore */ }
}
