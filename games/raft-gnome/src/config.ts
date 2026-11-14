// Shared types, tuning and data tables for Raft Gnome.
// Every system imports from here. Change numbers here, not in gameplay code.
import type * as THREE from 'three';

// =====================================================================
// Copied-model contract (gnome.ts, mowerModels.ts come from sample-3d)
// =====================================================================

export const COLORS = {
  gnomeHat: 0xd93636,
  gnomeShirt: 0x2f64c9,
  mowerDark: 0x222222,
  mowerGreen: 0x3fa34d,
  mowerYellow: 0xf2c230,
  mowerRed: 0xd8342c,
  reelWood: 0x9c6b3c,
  reelMetal: 0x8a9399,
  combineBody: 0x2e8b3a,
  combineAccent: 0xf2c230,
  combineGlass: 0x9fd8ff,
  water: 0x2f8fc4,
  waterDeep: 0x1b5f8f,
  sky: 0x7fc8f0,
  grass: 0x4caf50,
  grassTall: 0x2e7d32,
  dirt: 0x6d4c2e,
  sand: 0xe8d29a,
} as const;

/** How a gnome looks. */
export interface GnomeLook {
  hat: number;
  shirt: number;
  pants: number;
  skin: number;
  boots: number;
  beard: number | null;
  hair: { color: number; style: 'pigtails' } | null;
  freckles: boolean;
  dress: boolean;
  glasses: boolean;
}

export const CHARACTERS = {
  gnorman: {
    look: { hat: 0xd93636, shirt: 0x2f64c9, pants: 0x6b4a2e, skin: 0xf1c27d, boots: 0x222222, beard: 0xf4f4f4, hair: null, freckles: false, dress: false, glasses: false } as GnomeLook,
  },
};

/** The player's body. Feet at position (y = surface height). facing = rotation.y, 0 faces +z. */
export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  facing: number;
  grounded: boolean;
  /** Jumps since last landing (1 = normal jump). */
  jumpsUsed: number;
}

export interface GnomeModel {
  object: THREE.Group;
  update(p: PlayerState, dt: number): void;
  setDead(dead: boolean): void;
}

export type MowerTier = 'reel' | 'green' | 'yellow' | 'red' | 'combine';

export interface MowerModel {
  setNight(night01: number): void;
  group: THREE.Group;           // built facing +z, base at y = 0
  setFlash(on: boolean): void;
  animate(dt: number, speed: number): void;
}

// =====================================================================
// Tuning
// =====================================================================

export const TUNING = {
  moveSpeed: 5,          // m/s on foot (gnome.ts reads this for the walk cycle)
  jumpSpeed: 6,
  gravity: 20,
  mouseSensitivity: 0.0025,
  cameraDistance: 7,
  cameraHeight: 3,
  sprintMult: 1.6,      // speed multiplier while holding KEYS.sprint
  zoomMin: 3.5,         // camera distance range for the mouse wheel
  zoomMax: 14,
} as const;

/** Raft grid: tile (i, j) has its centre at world (i * TILE_SIZE, RAFT_TOP, j * TILE_SIZE). */
export const TILE_SIZE = 2;
/** Height of the walkable grass/island surface. Water surface is y = 0. */
export const RAFT_TOP = 0.3;
/** Starting tiles: a little 2 x 2 patch. */
export const START_TILES: readonly [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];

export const GRASS = {
  growSeconds: 40,       // growth 0 -> 1
  cutMin: 0.5,           // growth needed before a tile can be cut
  cutResetTo: 0.05,      // growth after cutting
  baseYield: 2,          // grass from cutting a fully grown tile by hand
  turfStartGrowth: 0.3,
  seededStartGrowth: 0,
} as const;

export const FISHING = {
  minThrow: 4,           // metres
  maxThrow: 20,
  chargeSeconds: 1.2,    // hold time for a full throw
  hookRadius: 1.6,       // debris this close to the hook gets snagged
  reelSpeed: 8,          // m/s while holding the mouse button
  collectDistance: 1.8,  // hook this close to the player = items collected
  debrisMax: 14,         // live debris at once
  debrisSpawnSeconds: 1.6,
  spawnDistance: 45,     // debris spawns this far upstream
  spawnSpread: 30,       // sideways spread at spawn
  despawnDistance: 60,
  current: { x: -1.2, z: 0.3 }, // water flow (m/s) even when the raft is still
} as const;

export const SEA = {
  driftSpeed: 1.5,       // m/s with no course
  sailSpeed: 12,         // m/s while following a course
  startHeading: Math.PI / 2,
  dockGap: -1,           // dock when island distance <= island.radius + raftExtent + dockGap
  fogNear: 60,
  fogFar: 260,
  cameraFar: 3000,
} as const;

export const TELESCOPE = {
  fov: 12,
  normalFov: 60,
  aimToleranceDeg: 4,    // island bearing must be within this of the view direction
  spotSeconds: 1.0,      // hold aim this long to spot
  range: 2000,
} as const;

// =====================================================================
// Items, tools, recipes
// =====================================================================

export type ItemId = 'grass' | 'dirt' | 'seed' | 'scrap' | 'fuel' | 'parts';
export const ITEM_IDS: readonly ItemId[] = ['grass', 'dirt', 'seed', 'scrap', 'fuel', 'parts'];

export const ITEMS: Record<ItemId, { name: string; color: number; icon: string }> = {
  grass: { name: 'Grass', color: 0x4caf50, icon: '🌿' },
  dirt: { name: 'Dirt', color: 0x6d4c2e, icon: '🟫' },
  seed: { name: 'Grass Seed', color: 0xf2d16b, icon: '🌱' },
  scrap: { name: 'Scrap Metal', color: 0x9aa4ab, icon: '🔩' },
  fuel: { name: 'Fuel', color: 0xd8342c, icon: '⛽' },
  parts: { name: 'Mower Parts', color: 0xf2c230, icon: '⚙️' },
};

export type ToolId = 'hands' | 'push' | 'gas' | 'riding';
export const TOOL_ORDER: readonly ToolId[] = ['hands', 'push', 'gas', 'riding'];

export interface ToolDef {
  name: string;
  /** World radius cut around the mower front while moving. 0 = hands: press E to cut the tile under you. */
  radius: number;
  yieldMult: number;
  speedMult: number;
  /** Fuel used per tile cut. With 0 fuel a gas tool cannot cut. */
  fuelPerCut: number;
  /** Model from mowerModels.ts, null for hands. */
  model: MowerTier | null;
  modelScale: number;
}

export const TOOLS: Record<ToolId, ToolDef> = {
  hands: { name: 'Hands', radius: 0, yieldMult: 1, speedMult: 1, fuelPerCut: 0, model: null, modelScale: 1 },
  push: { name: 'Push Mower', radius: 1.4, yieldMult: 1.5, speedMult: 0.9, fuelPerCut: 0, model: 'reel', modelScale: 0.8 },
  gas: { name: 'Gas Mower', radius: 2.2, yieldMult: 2, speedMult: 1, fuelPerCut: 0.1, model: 'green', modelScale: 0.8 },
  riding: { name: 'Riding Mower', radius: 3.4, yieldMult: 2.5, speedMult: 1.6, fuelPerCut: 0.15, model: 'red', modelScale: 1.3 },
};

export type RecipeId = 'telescope' | 'push' | 'gas' | 'riding';
export const RECIPE_ORDER: readonly RecipeId[] = ['telescope', 'push', 'gas', 'riding'];
export interface Recipe { name: string; desc: string; cost: Partial<Record<ItemId, number>> }
export const RECIPES: Record<RecipeId, Recipe> = {
  telescope: { name: 'Telescope', desc: 'Press T to look for islands. Press C while aiming at a spotted island to chart a course.', cost: { grass: 12, dirt: 3 } },
  push: { name: 'Push Mower', desc: 'Cuts grass as you walk. 1.5x yield.', cost: { scrap: 6, grass: 8 } },
  gas: { name: 'Gas Mower', desc: 'Wider cut, 2x yield. Burns fuel.', cost: { scrap: 8, fuel: 4 } },
  riding: { name: 'Riding Mower', desc: 'Huge cut, fast, 2.5x yield. Burns fuel.', cost: { parts: 3, scrap: 10, fuel: 6 } },
};

/** Building: new raft tiles go on water next to the raft; props go on top of an existing tile. */
export type TileKind = 'turf' | 'seeded';
export type PropKind = 'sprinkler' | 'flamingo';
export type BuildKind = TileKind | PropKind;
export const BUILD_ORDER: readonly BuildKind[] = ['turf', 'seeded', 'sprinkler', 'flamingo'];
export const BUILD_COSTS: Record<BuildKind, { name: string; cost: Partial<Record<ItemId, number>>; onTile: boolean }> = {
  turf: { name: 'Turf tile', cost: { grass: 4 }, onTile: false },
  seeded: { name: 'Seeded dirt tile', cost: { dirt: 2, seed: 1 }, onTile: false },
  sprinkler: { name: 'Sprinkler', cost: { scrap: 3, grass: 4 }, onTile: true },
  flamingo: { name: 'Lawn Flamingo', cost: { grass: 3, scrap: 1 }, onTile: true },
};
/** A sprinkler doubles growth on tiles whose centre is within this radius of it. */
export const SPRINKLER = { radius: 3.2, growthMult: 2 } as const;

// =====================================================================
// Debris and islands
// =====================================================================

/** When a debris kind starts appearing. */
export type Unlock = 'start' | 'tiles3' | 'island1' | 'island2';
/** bottle = a message in a bottle: no item, it reveals (spots) the nearest unspotted island. */
export interface DebrisDef { item: ItemId; amount: number; weight: number; unlock: Unlock; bottle?: boolean }
export const DEBRIS: readonly DebrisDef[] = [
  { item: 'grass', amount: 2, weight: 6, unlock: 'start' },
  { item: 'dirt', amount: 1, weight: 3, unlock: 'tiles3' },
  { item: 'seed', amount: 1, weight: 2, unlock: 'tiles3' },
  { item: 'scrap', amount: 1, weight: 2, unlock: 'island1' },
  { item: 'fuel', amount: 1, weight: 1, unlock: 'island2' },
  { item: 'grass', amount: 0, weight: 0.4, unlock: 'tiles3', bottle: true },
];

// =====================================================================
// Day, weather, pests
// =====================================================================

/** dayTime 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight. */
export const DAY = { lengthSeconds: 360, startTime: 0.08 } as const;
export const WEATHER = { clearMin: 90, clearMax: 180, rainMin: 30, rainMax: 60, growthMult: 2 } as const;
export const SEAGULL = { firstAfter: 60, intervalMin: 45, intervalMax: 90, eatRate: 0.25, scareDistance: 2.2, flySpeed: 9 } as const;
export const SHARK = { firstAfter: 150, intervalMin: 80, intervalMax: 140, biteSeconds: 8, bonkDistance: 3, circleRadius: 9, minTiles: 4 } as const;

export type IslandId = 'scrapyard' | 'fuelDepot' | 'mowerGraveyard';
export const ISLAND_ORDER: readonly IslandId[] = ['scrapyard', 'fuelDepot', 'mowerGraveyard'];
export interface IslandDef {
  name: string;
  /** Sea coordinates of the centre (the raft starts at sea 0,0). */
  x: number;
  z: number;
  radius: number;
  /** One entry per crate: what it gives. */
  crates: Partial<Record<ItemId, number>>[];
  /** Theme hint for the island's props. */
  theme: string;
}
export const ISLANDS: Record<IslandId, IslandDef> = {
  scrapyard: { name: 'Scrapyard Isle', x: 220, z: 160, radius: 18, theme: 'heaps of rusty scrap, a broken shed', crates: [{ scrap: 6 }, { scrap: 5, dirt: 2 }, { scrap: 4, seed: 2 }] },
  fuelDepot: { name: 'Fuel Depot Key', x: -180, z: 520, radius: 20, theme: 'red fuel drums, a little gas pump', crates: [{ fuel: 5 }, { fuel: 4, scrap: 3 }, { fuel: 3, scrap: 3 }] },
  mowerGraveyard: { name: 'Mower Graveyard', x: 560, z: 760, radius: 24, theme: 'wrecked riding mowers half buried in sand', crates: [{ parts: 1, scrap: 4 }, { parts: 1, fuel: 3 }, { parts: 1, scrap: 4 }] },
};

// =====================================================================
// Game state
// =====================================================================

export type Mode = 'title' | 'play' | 'build' | 'telescope' | 'craft';

export interface Prop { kind: PropKind; i: number; j: number }
export interface Stats { cut: number; caught: number; tilesLost: number; gullsScared: number; sharksBonked: number }

export interface Tile { i: number; j: number; growth: number }

export interface IslandState { spotted: boolean; visited: boolean; looted: boolean[] }

export interface GameState {
  mode: Mode;
  time: number;
  inv: Record<ItemId, number>;
  tools: Record<ToolId, boolean>;
  equipped: ToolId;
  hasTelescope: boolean;
  /** Keyed by tileKey(i, j). */
  tiles: Map<string, Tile>;
  /** Tiles placed by the player (not the starting ones). */
  tilesBuilt: number;
  buildKind: BuildKind;
  player: PlayerState;
  /** The raft never moves in the 3D scene (it stays round the origin); the sea moves past it. */
  sea: { x: number; z: number; heading: number; speed: number; course: IslandId | null; docked: IslandId | null };
  islands: Record<IslandId, IslandState>;
  /** Toast messages; the HUD shows and removes them. */
  messages: string[];
  /** 0..1, advanced by tickWorld. See DAY. */
  dayTime: number;
  /** Set by the weather system. Rain multiplies grass growth by WEATHER.growthMult. */
  raining: boolean;
  /** Sprinklers and decorations standing on tiles (at most one per tile). */
  props: Prop[];
  stats: Stats;
  /** True once the final objective is complete. */
  won: boolean;
}

// =====================================================================
// System contract
// =====================================================================

export type SfxName =
  | 'throw' | 'reel' | 'catch' | 'place' | 'cut' | 'craft' | 'spot' | 'dock' | 'loot' | 'error' | 'click'
  | 'splash' | 'thunder' | 'gull' | 'shark' | 'bonk' | 'win' | 'bottle' | 'chomp';

/** Everything a system gets. Systems may add objects to scene and elements under ui, never restyle #ui. */
export interface Ctx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  state: GameState;
  input: import('./input').Input;
  /** Scene lights, created by main.ts. The day/night system animates them. */
  lights: { sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight };
  /** The shared #ui element. Append your own container to it. */
  ui: HTMLElement;
}

export interface System { update(dt: number): void }

/**
 * Key bindings (KeyboardEvent.code). Mouse: left button = fishing (play) / place tile (build).
 */
export const KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space',
  interact: 'KeyE',      // cut the tile under you by hand / open an island crate
  build: 'KeyB',         // toggle build mode
  buildKind: 'KeyR',     // in build mode: cycle BUILD_ORDER
  tool: 'KeyQ',          // cycle owned tools
  telescope: 'KeyT',     // toggle telescope (if crafted)
  chart: 'KeyC',         // telescope: chart course to aimed island; docked: cast off
  craft: 'Tab',          // open/close the craft menu
  bonk: 'KeyF',          // bonk a shark or seagull that is close
  sprint: 'ShiftLeft',
  music: 'KeyM',         // mute/unmute music
} as const;
