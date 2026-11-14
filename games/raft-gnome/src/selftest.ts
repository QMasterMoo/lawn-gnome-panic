// Scripted playthrough for headless checks: open the game with #selftest.
// Drives the real systems with synthetic key events and rule calls, then logs SELFTEST OK or console.error per failure.
// tools/smoke.sh <url>#selftest rg-selftest-ok
import { ISLANDS, ISLAND_ORDER, TILE_SIZE, type GameState, type IslandId } from './config';
import { chartCourse, castOff, craft, lootCrate, placeTile, raftExtent } from './rules';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const key = (type: 'keydown' | 'keyup', code: string) => window.dispatchEvent(new KeyboardEvent(type, { code }));
async function tap(code: string): Promise<void> {
  key('keydown', code);
  await wait(50);
  key('keyup', code);
  await wait(50);
}

export async function runSelfTest(state: GameState, ui: HTMLElement): Promise<void> {
  const fails: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (!ok) {
      fails.push(what);
      console.error('SELFTEST FAIL: ' + what);
    }
  };

  state.mode = 'play';
  Object.assign(state.inv, { grass: 60, dirt: 10, seed: 10, scrap: 40, fuel: 30, parts: 5 });
  await wait(200);

  await tap('KeyB');
  check((state.mode as string) === 'build', 'B enters build mode');
  await tap('KeyR');
  check(state.buildKind === 'seeded', 'R switches build kind');
  await tap('KeyB');
  check((state.mode as string) === 'play', 'B leaves build mode');

  check(placeTile(state, 2, 0, 'turf'), 'place turf tile');
  check(placeTile(state, 2, 1, 'seeded'), 'place seeded tile');
  check(!placeTile(state, 9, 9, 'turf'), 'cannot place detached tile');

  for (const r of ['telescope', 'push', 'gas', 'riding'] as const) check(craft(state, r), 'craft ' + r);
  check(state.equipped === 'riding', 'crafting a mower equips it');
  await tap('KeyQ');
  check(state.equipped === 'hands', 'Q cycles tools');
  await tap('KeyQ');
  check(state.equipped === 'push', 'Q cycles to push');

  // Mow: grow everything, walk forward with the push mower.
  for (const t of state.tiles.values()) t.growth = 1;
  state.player.position.set(0, state.player.position.y, 0);
  const grassBefore = state.inv.grass;
  key('keydown', 'KeyW');
  await wait(600);
  key('keyup', 'KeyW');
  check(state.inv.grass > grassBefore, 'walking with a mower cuts grass');
  check([...state.tiles.values()].every((t) => Math.abs(t.i * TILE_SIZE - state.player.position.x) < 20), 'player stays near raft');

  // Hand cut.
  await tap('KeyQ'); await tap('KeyQ'); await tap('KeyQ');
  check(state.equipped === 'hands', 'back to hands');
  for (const t of state.tiles.values()) t.growth = 1;
  const g2 = state.inv.grass;
  await tap('KeyE');
  check(state.inv.grass > g2, 'E cuts grass by hand');

  await tap('KeyT');
  check((state.mode as string) === 'telescope', 'T opens telescope');
  await tap('KeyT');
  check((state.mode as string) === 'play', 'T closes telescope');

  await tap('Tab');
  check((state.mode as string) === 'craft', 'Tab opens craft menu');
  await tap('Tab');
  check((state.mode as string) === 'play', 'Tab closes craft menu');

  // Sail to every island, dock, loot.
  for (const id of ISLAND_ORDER as readonly IslandId[]) {
    state.islands[id].spotted = true;
    chartCourse(state, id);
    const isl = ISLANDS[id];
    const d = isl.radius + raftExtent(state) + 3;
    const dirx = isl.x - state.sea.x, dirz = isl.z - state.sea.z;
    const len = Math.hypot(dirx, dirz);
    state.sea.x = isl.x - (dirx / len) * d;
    state.sea.z = isl.z - (dirz / len) * d;
    await wait(700);
    check(state.sea.docked === id, 'docks at ' + id);
    check(state.islands[id].visited, 'visited ' + id);
    isl.crates.forEach((_, k) => check(lootCrate(state, id, k), `loot ${id} crate ${k}`));
    castOff(state);
    check(state.sea.docked === null, 'cast off ' + id);
    await wait(300);
  }
  check(state.inv.parts >= 3, 'collected mower parts');

  console.log(fails.length ? `SELFTEST FAILED (${fails.length})` : 'SELFTEST OK');
  const marker = document.createElement('div');
  marker.id = fails.length ? 'rg-selftest-failed' : 'rg-selftest-ok';
  marker.style.display = 'none';
  ui.append(marker);
}

/**
 * Headless screenshots skip the WebGL canvas, so #snap=<scenario> copies the canvas into an <img> after a moment.
 * Scenarios: raft (default), island, mower, build, telescope, big.
 */
export async function runSnap(state: GameState, ui: HTMLElement, canvas: HTMLCanvasElement, scenario: string): Promise<void> {
  state.mode = 'play';
  Object.assign(state.inv, { grass: 60, dirt: 10, seed: 10, scrap: 40, fuel: 30, parts: 5 });
  if (scenario === 'big' || scenario === 'mower') {
    for (let i = -2; i <= 3; i++) for (let j = -2; j <= 3; j++) placeTile(state, i, j, 'turf');
    for (let i = -2; i <= 3; i++) for (let j = -2; j <= 3; j++) placeTile(state, i, j, 'turf');
  }
  if (scenario === 'mower') {
    for (const r of ['telescope', 'push', 'gas', 'riding'] as const) craft(state, r);
  }
  if (scenario === 'island') {
    const id: IslandId = 'mowerGraveyard';
    state.islands[id].spotted = true;
    chartCourse(state, id);
    const isl = ISLANDS[id];
    state.sea.x = isl.x - (isl.radius + raftExtent(state) + 2);
    state.sea.z = isl.z;
  }
  if (scenario === 'build') {
    await wait(100);
    await tap('KeyB');
  }
  if (scenario === 'telescope') {
    craft(state, 'telescope');
    await wait(100);
    await tap('KeyT');
  }
  await wait(1500);
  const img = document.createElement('img');
  img.id = 'rg-snap';
  img.src = canvas.toDataURL('image/png');
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:-1;';
  ui.append(img);
}
