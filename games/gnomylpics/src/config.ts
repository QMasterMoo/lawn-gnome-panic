export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Every event lays its players out in 4 horizontal lanes below a header bar. */
export const MAX_PLAYERS = 4;
export const HEADER_H = 80;
export const LANE_H = (GAME_HEIGHT - HEADER_H) / MAX_PLAYERS; // 160

export const SCENES = {
  boot: 'Boot',
  title: 'Title',
  dash: 'Dash',
  tripleJump: 'TripleJump',
  mowerToss: 'MowerToss',
  results: 'Results',
  final: 'Final',
} as const;

export type EventId = 'dash' | 'tripleJump' | 'mowerToss';

/** The meet runs these events in this order. Each id is also its scene key via EVENT_SCENE. */
export const EVENTS: { id: EventId; title: string; blurb: string; unit: string; higherIsBetter: boolean }[] = [
  { id: 'dash', title: '60m Gnome Dash', blurb: 'Tap your two keys in turn: left, right, left, right. Same key twice = stumble!', unit: 's', higherIsBetter: false },
  { id: 'tripleJump', title: 'Triple Jump', blurb: 'Alternate to sprint. Tap to take off before the red line, then tap again each time you land: hop, skip, JUMP.', unit: 'm', higherIsBetter: true },
  { id: 'mowerToss', title: 'Mower Toss', blurb: 'Alternate to spin the mower up. Press BOTH keys together to let go when the angle needle is near 45 degrees.', unit: 'm', higherIsBetter: true },
];

export const EVENT_SCENE: Record<EventId, string> = {
  dash: SCENES.dash,
  tripleJump: SCENES.tripleJump,
  mowerToss: SCENES.mowerToss,
};

/** Points by finishing place (index 0 = 1st). Ties share the better place. */
export const PLACE_POINTS = [5, 3, 2, 1] as const;

/** Generated in BootScene. */
export const TEX = {
  /** gnome0..gnome3: 40x56 gnome, hat in PLAYER_COLORS[i]. Origin (0.5, 1) = feet. */
  gnome: (i: number) => `gnome${i}`,
  mower: 'mower', // 44x28 red push mower, wheels at the bottom
  spark: 'spark', // 6x6 white square, for particles and dust
  sand: 'sand',   // 64x16 sand tile
} as const;

export const PLAYER_COLORS = [0xe53935, 0x1e88e5, 0xfdd835, 0x8e24aa] as const;
export const PLAYER_CSS = ['#e53935', '#1e88e5', '#fdd835', '#ab47bc'] as const;

/** Key layout for humans 1..4: [left key, right key], as KeyboardEvent.code values. */
export const KEYSETS: { codes: [string, string]; labels: [string, string] }[] = [
  { codes: ['KeyA', 'KeyD'], labels: ['A', 'D'] },
  { codes: ['ArrowLeft', 'ArrowRight'], labels: ['←', '→'] },
  { codes: ['KeyJ', 'KeyL'], labels: ['J', 'L'] },
  { codes: ['Numpad4', 'Numpad6'], labels: ['Num4', 'Num6'] },
];

export const COLORS = {
  background: '#2e7d32',
  grass: 0x43a047,
  grassDark: 0x388e3c,
  track: 0xc1440e,
  trackLine: 0xffffff,
  sand: 0xe6c27a,
  foul: 0xff1744,
  header: 0x1b1b1b,
  text: '#ffffff',
  accent: '#ffd54f',
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard';

/** CPU skill per difficulty, 0..1. Events read player.skill. */
export const CPU_SKILL: Record<Difficulty, number> = { easy: 0.35, normal: 0.6, hard: 0.85 };

/** Shared running model (src/runner.ts). Speeds in metres per second. */
export const RUN = {
  tapBoost: 1.1,        // m/s added per correct alternating tap
  maxSpeed: 11,         // m/s cap
  dragPerSec: 2.4,      // m/s lost per second (stop tapping and you slow down)
  stumbleSpeedMult: 0.4,// speed multiplied by this on an out-of-order tap
  stumbleMs: 450,       // taps are ignored this long after a stumble
} as const;

/** CPU tapping: interval between taps in ms, and chance a tap is out of order. Interpolated by skill. */
export const CPU_TAP = {
  intervalMsAtSkill0: 150,
  intervalMsAtSkill1: 85,
  mistakeAtSkill0: 0.08,
  mistakeAtSkill1: 0.01,
} as const;

export const DASH = { distanceM: 60, pxPerM: 17, startX: 120, timeLimitS: 25 } as const;

export const TRIPLE = {
  runwayM: 25,           // run-up length from start to the foul line
  takeoffZoneM: 4,       // tapping is "take off" in the last this many metres before the foul line
  pxPerM: 26,
  startX: 60,
  phaseMult: [0.36, 0.3, 0.42] as const, // hop, skip, jump: phase distance = speed * mult (metres per m/s)
  landWindowMs: 180,     // tap within this of a landing for a perfect (keeps 100% speed)
  goodWindowMs: 360,     // within this = good (keeps 85% speed); outside = flop, sequence ends
  phaseAirMs: [520, 460, 700] as const,
} as const;

export const TOSS = {
  spinTimeS: 5,          // seconds of spinning; then the mower is released automatically
  spinPerTap: 0.9,       // rad/s of spin added per correct tap
  maxSpin: 22,           // rad/s
  spinDragPerSec: 2.5,
  bothKeysWindowMs: 50,  // both keys within this window = release
  releaseSpeedPerSpin: 1.5, // launch m/s per rad/s of spin
  gravity: 9.8,
  skidMult: 0.15,        // extra skid distance = landing horizontal speed * this
  pxPerM: 10,            // horizontal: 100 m = 1000 px
  heightPxPerM: 3,       // vertical is squashed so the arc fits the lane
  startX: 70,
  needlePeriodS: 1.4,    // the release-angle needle sweeps min..max..min in this time
  needleMinDeg: 10,
  needleMaxDeg: 80,
  orbitPx: 30,           // mower orbit radius around the gnome while spinning
} as const;

/** One player in the meet. Lane index = position in MeetState.players. */
export interface PlayerSlot {
  index: number;          // 0..3, also lane and colour index
  name: string;           // "P1" .. or "CPU Gnorbert"
  cpu: boolean;
  skill: number;          // 0..1, CPUs only (humans 1)
  keys: [string, string]; // KeyboardEvent.code for the left and right key (CPUs: ['', ''])
  keyLabels: [string, string];
}

export interface EventResult {
  eventId: EventId;
  /** Raw measure per player (seconds for the dash, metres for the others). null = DNF / foul. */
  raw: (number | null)[];
  /** Text shown in results, e.g. "8.42 s", "FOUL", "DNF". */
  display: string[];
  places: number[]; // 1-based
  points: number[];
}

/** The whole meet. Passed as the data object to every event, results and final scene. */
export interface MeetState {
  players: PlayerSlot[];
  eventIndex: number;     // index into EVENTS of the current (or just finished) event
  totals: number[];       // points per player
  history: EventResult[];
}

/** Data object for this.scene.start(EVENT_SCENE[id] / SCENES.results / SCENES.final, data). */
export interface MeetData {
  meet: MeetState;
}

export type SfxName = 'tap' | 'stumble' | 'go' | 'beep' | 'jump' | 'land' | 'flop' | 'whoosh' | 'thud' | 'cheer';
