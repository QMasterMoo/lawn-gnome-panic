// Pure game rules on GameState. No rendering, no DOM. Systems call these instead of editing state ad hoc.
import * as THREE from 'three';
import {
  BUILD_COSTS, DEBRIS, GRASS, ISLAND_ORDER, ISLANDS, ITEM_IDS, RAFT_TOP, RECIPES, SEA, START_TILES, TILE_SIZE, TOOLS,
  type BuildKind, type DebrisDef, type GameState, type IslandId, type IslandState, type ItemId, type RecipeId, type Tile,
} from './config';

export function tileKey(i: number, j: number): string {
  return `${i},${j}`;
}

/** Grid cell containing world point (x, z). */
export function cellAt(x: number, z: number): { i: number; j: number } {
  return { i: Math.round(x / TILE_SIZE), j: Math.round(z / TILE_SIZE) };
}

export function tileAt(s: GameState, x: number, z: number): Tile | undefined {
  const { i, j } = cellAt(x, z);
  return s.tiles.get(tileKey(i, j));
}

export function newState(): GameState {
  const inv = Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as Record<ItemId, number>;
  const tiles = new Map<string, Tile>();
  for (const [i, j] of START_TILES) tiles.set(tileKey(i, j), { i, j, growth: 0.6 });
  const islands = Object.fromEntries(
    ISLAND_ORDER.map((id) => [id, { spotted: false, visited: false, looted: ISLANDS[id].crates.map(() => false) }]),
  ) as Record<IslandId, IslandState>;
  return {
    mode: 'title',
    time: 0,
    inv,
    tools: { hands: true, push: false, gas: false, riding: false },
    equipped: 'hands',
    hasTelescope: false,
    tiles,
    tilesBuilt: 0,
    buildKind: 'turf',
    player: {
      position: new THREE.Vector3(TILE_SIZE / 2, RAFT_TOP, TILE_SIZE / 2),
      velocity: new THREE.Vector3(),
      facing: 0,
      grounded: true,
      jumpsUsed: 0,
    },
    sea: { x: 0, z: 0, heading: SEA.startHeading, speed: SEA.driftSpeed, course: null, docked: null },
    islands,
    messages: [],
  };
}

export function notify(s: GameState, text: string): void {
  s.messages.push(text);
}

// ---------------------------------------------------------------- inventory

export function addItem(s: GameState, id: ItemId, n: number): void {
  s.inv[id] += n;
}

export function hasItems(s: GameState, cost: Partial<Record<ItemId, number>>): boolean {
  return ITEM_IDS.every((id) => s.inv[id] >= (cost[id] ?? 0));
}

/** Removes cost if affordable. Returns false (and changes nothing) if not. */
export function spend(s: GameState, cost: Partial<Record<ItemId, number>>): boolean {
  if (!hasItems(s, cost)) return false;
  for (const id of ITEM_IDS) s.inv[id] -= cost[id] ?? 0;
  return true;
}

export function costText(cost: Partial<Record<ItemId, number>>): string {
  return ITEM_IDS.filter((id) => cost[id]).map((id) => `${cost[id]} ${id}`).join(', ');
}

// ---------------------------------------------------------------- raft

/** Half-width of the raft from the origin, in metres (furthest tile edge). */
export function raftExtent(s: GameState): number {
  let r = 0;
  for (const t of s.tiles.values()) r = Math.max(r, Math.hypot(t.i * TILE_SIZE, t.j * TILE_SIZE) + TILE_SIZE * 0.7);
  return r;
}

export function canPlace(s: GameState, i: number, j: number): boolean {
  if (s.tiles.has(tileKey(i, j))) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => s.tiles.has(tileKey(i + di, j + dj)));
}

/** Places a tile if the cell is free, adjacent and affordable. Notifies on failure. */
export function placeTile(s: GameState, i: number, j: number, kind: BuildKind): boolean {
  if (!canPlace(s, i, j)) return false;
  const def = BUILD_COSTS[kind];
  if (!spend(s, def.cost)) {
    notify(s, `${def.name} needs ${costText(def.cost)}`);
    return false;
  }
  s.tiles.set(tileKey(i, j), { i, j, growth: kind === 'turf' ? GRASS.turfStartGrowth : GRASS.seededStartGrowth });
  s.tilesBuilt++;
  if (s.tilesBuilt === 3) notify(s, 'Dirt and grass seed are floating by now. Fish them up!');
  return true;
}

/** Cuts a tile if grown enough. Returns grass gained (0 if not cuttable). */
export function cutTile(s: GameState, t: Tile, yieldMult: number): number {
  if (t.growth < GRASS.cutMin) return 0;
  const gained = Math.max(1, Math.round(GRASS.baseYield * t.growth * yieldMult));
  t.growth = GRASS.cutResetTo;
  addItem(s, 'grass', gained);
  return gained;
}

// ---------------------------------------------------------------- crafting

export function craft(s: GameState, id: RecipeId): boolean {
  const owned = id === 'telescope' ? s.hasTelescope : s.tools[id];
  if (owned) {
    notify(s, `You already have a ${RECIPES[id].name}.`);
    return false;
  }
  if (!spend(s, RECIPES[id].cost)) {
    notify(s, `${RECIPES[id].name} needs ${costText(RECIPES[id].cost)}`);
    return false;
  }
  if (id === 'telescope') s.hasTelescope = true;
  else {
    s.tools[id] = true;
    s.equipped = id;
  }
  notify(s, `Crafted ${RECIPES[id].name}!`);
  return true;
}

/** Can the equipped tool cut right now (fuel check)? */
export function toolHasFuel(s: GameState): boolean {
  return TOOLS[s.equipped].fuelPerCut === 0 || s.inv.fuel > 0;
}

// ---------------------------------------------------------------- sea and islands

export function raftVelocity(s: GameState): { x: number; z: number } {
  return { x: Math.sin(s.sea.heading) * s.sea.speed, z: Math.cos(s.sea.heading) * s.sea.speed };
}

/** Island centre in scene coordinates (the raft sits at the scene origin). */
export function islandRelPos(s: GameState, id: IslandId): { x: number; z: number } {
  return { x: ISLANDS[id].x - s.sea.x, z: ISLANDS[id].z - s.sea.z };
}

/** True if (x, z) is on a raft tile, or on the island the raft is docked at. */
export function isWalkable(s: GameState, x: number, z: number): boolean {
  if (tileAt(s, x, z)) return true;
  if (s.sea.docked) {
    const p = islandRelPos(s, s.sea.docked);
    if (Math.hypot(x - p.x, z - p.z) <= ISLANDS[s.sea.docked].radius) return true;
  }
  return false;
}

export function chartCourse(s: GameState, id: IslandId): void {
  if (!s.islands[id].spotted) return;
  s.sea.course = id;
  s.sea.docked = null;
  notify(s, `Course charted for ${ISLANDS[id].name}.`);
}

/** Leave the docked island and drift on. */
export function castOff(s: GameState): void {
  if (!s.sea.docked) return;
  notify(s, `Cast off from ${ISLANDS[s.sea.docked].name}.`);
  s.sea.docked = null;
  s.sea.course = null;
}

/** Opens crate `index` on the docked island. Returns false if already looted or not docked there. */
export function lootCrate(s: GameState, id: IslandId, index: number): boolean {
  if (s.sea.docked !== id || s.islands[id].looted[index]) return false;
  s.islands[id].looted[index] = true;
  const loot = ISLANDS[id].crates[index];
  for (const item of ITEM_IDS) if (loot[item]) addItem(s, item, loot[item]!);
  notify(s, `Crate: ${costText(loot)}`);
  return true;
}

/** Debris kinds that can spawn now. */
export function debrisTable(s: GameState): DebrisDef[] {
  return DEBRIS.filter((d) =>
    d.unlock === 'start' ||
    (d.unlock === 'tiles3' && s.tilesBuilt >= 3) ||
    (d.unlock === 'island1' && s.islands.scrapyard.visited) ||
    (d.unlock === 'island2' && s.islands.fuelDepot.visited));
}

export function pickDebris(s: GameState): DebrisDef {
  const table = debrisTable(s);
  let r = Math.random() * table.reduce((a, d) => a + d.weight, 0);
  for (const d of table) if ((r -= d.weight) <= 0) return d;
  return table[0];
}

/** Grows grass, moves the sea, steers to the course and docks on arrival. Call once per frame in play. */
export function tickWorld(s: GameState, dt: number): void {
  s.time += dt;
  for (const t of s.tiles.values()) t.growth = Math.min(1, t.growth + dt / GRASS.growSeconds);

  if (s.sea.docked) {
    s.sea.speed = 0;
    return;
  }
  if (s.sea.course) {
    const p = islandRelPos(s, s.sea.course);
    const dist = Math.hypot(p.x, p.z);
    s.sea.heading = Math.atan2(p.x, p.z);
    s.sea.speed = SEA.sailSpeed;
    if (dist <= ISLANDS[s.sea.course].radius + raftExtent(s) + SEA.dockGap) {
      const id = s.sea.course;
      s.sea.docked = id;
      s.sea.course = null;
      s.sea.speed = 0;
      if (!s.islands[id].visited) {
        s.islands[id].visited = true;
        notify(s, `Landed on ${ISLANDS[id].name}! Look for crates (E).`);
      } else notify(s, `Docked at ${ISLANDS[id].name}.`);
      return;
    }
  } else s.sea.speed = SEA.driftSpeed;
  const v = raftVelocity(s);
  s.sea.x += v.x * dt;
  s.sea.z += v.z * dt;
}
