// Build mode: aim at the water beside the raft, click to add a raft tile.
import * as THREE from 'three';
import { BUILD_COSTS, KEYS, RAFT_TOP, TILE_SIZE, type Ctx, type System } from './config';
import { canPlace, cellAt, costText, hasItems, notify, placeTile, tileKey } from './rules';
import { sfx } from './audio';

/** Max distance (xz, metres) from the player to the aimed point. */
const REACH = 14;
const NEIGHBOURS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GHOST_OK = 0x66ff66;
const GHOST_NO = 0xff5555;

export function createBuilding(ctx: Ctx): System {
  const { scene, camera, state, input } = ctx;

  const raycaster = new THREE.Raycaster();
  const centre = new THREE.Vector2(0, 0);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -RAFT_TOP);
  const hit = new THREE.Vector3();

  // Ghost: translucent preview of the tile that would be placed.
  const ghostMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.35, TILE_SIZE * 0.98), ghostMat);
  ghost.visible = false;
  scene.add(ghost);

  // Edge hints: faint flat squares on every cell that can take a tile.
  const hintGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.98, TILE_SIZE * 0.98);
  hintGeo.rotateX(-Math.PI / 2);
  const hintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false });
  const hints = new THREE.Group();
  hints.visible = false;
  scene.add(hints);
  let hintsSize = -1;

  function rebuildHints(): void {
    hints.clear();
    const seen = new Set<string>();
    for (const t of state.tiles.values()) {
      for (const [di, dj] of NEIGHBOURS) {
        const i = t.i + di;
        const j = t.j + dj;
        const key = tileKey(i, j);
        if (seen.has(key)) continue;
        seen.add(key);
        if (!canPlace(state, i, j)) continue;
        const m = new THREE.Mesh(hintGeo, hintMat);
        m.position.set(i * TILE_SIZE, RAFT_TOP + 0.02, j * TILE_SIZE);
        hints.add(m);
      }
    }
    hintsSize = state.tiles.size;
  }

  /** Cell the player is aiming at, or null. Forgives aim at a tile edge by trying neighbours. */
  function findTarget(): { i: number; j: number } | null {
    raycaster.setFromCamera(centre, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    const p = state.player.position;
    if (Math.hypot(hit.x - p.x, hit.z - p.z) > REACH) return null;
    const c = cellAt(hit.x, hit.z);
    if (canPlace(state, c.i, c.j)) return c;
    let best: { i: number; j: number } | null = null;
    let bestD = Infinity;
    for (const [di, dj] of NEIGHBOURS) {
      const i = c.i + di;
      const j = c.j + dj;
      if (!canPlace(state, i, j)) continue;
      const d = Math.hypot(hit.x - i * TILE_SIZE, hit.z - j * TILE_SIZE);
      if (d < bestD) {
        bestD = d;
        best = { i, j };
      }
    }
    return best;
  }

  let time = 0;

  return {
    update(dt: number) {
      // Toggle build mode.
      if (input.pressed(KEYS.build)) {
        if (state.mode === 'play') {
          state.mode = 'build';
          notify(state, 'Build mode: click to place, R to switch tile, B to exit');
        } else if (state.mode === 'build') {
          state.mode = 'play';
        }
      }
      if (state.mode !== 'build') {
        ghost.visible = false;
        hints.visible = false;
        return;
      }

      // Switch tile kind.
      if (input.pressed(KEYS.buildKind)) {
        state.buildKind = state.buildKind === 'turf' ? 'seeded' : 'turf';
        const def = BUILD_COSTS[state.buildKind];
        notify(state, def.name + ': ' + costText(def.cost));
        sfx('click');
      }

      // Aim, ghost and placement.
      time += dt;
      const target = findTarget();
      if (target) {
        ghost.visible = true;
        ghost.position.set(target.i * TILE_SIZE, RAFT_TOP - 0.15, target.j * TILE_SIZE);
        ghostMat.color.setHex(hasItems(state, BUILD_COSTS[state.buildKind].cost) ? GHOST_OK : GHOST_NO);
        ghostMat.opacity = 0.45 + 0.1 * Math.sin(time * 5);
        if (input.mousePressed(0) && input.locked()) {
          if (placeTile(state, target.i, target.j, state.buildKind)) sfx('place');
          else sfx('error');
        }
      } else {
        ghost.visible = false;
      }

      // Edge hints, rebuilt only when the tile count changes.
      hints.visible = true;
      if (state.tiles.size !== hintsSize) rebuildHints();
    },
  };
}
