// Build mode: aim at the water beside the raft (tile kinds) or at a tile (props), click to place.
// Also draws every prop in state.props (sprinklers, lawn flamingos), in every mode.
import * as THREE from 'three';
import { BUILD_COSTS, BUILD_ORDER, KEYS, RAFT_TOP, SPRINKLER, TILE_SIZE, type BuildKind, type Ctx, type Mode, type Prop, type System } from './config';
import { canBuild, canPlace, cellAt, costText, hasItems, notify, placeTile, tileKey } from './rules';
import { sfx } from './audio';

/** Max distance (xz, metres) from the player to the aimed point. */
const REACH = 14;
const NEIGHBOURS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GHOST_OK = 0x66ff66;
const GHOST_NO = 0xff5555;

// ---------------------------------------------------------------- shared prop assets

const METAL = new THREE.MeshStandardMaterial({ color: 0x8a9399, metalness: 0.6, roughness: 0.4 });
const SPRAY_MAT = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6, depthWrite: false });
const REACH_MAT = new THREE.MeshBasicMaterial({ color: 0x4fb3ff, transparent: true, opacity: 0.08, depthWrite: false });
const PINK = new THREE.MeshStandardMaterial({ color: 0xff6fae, roughness: 0.6 });
const DARK_PINK = new THREE.MeshStandardMaterial({ color: 0xc2185b, roughness: 0.6 });
const BLACK = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

const BASE_GEO = new THREE.CylinderGeometry(0.4, 0.45, 0.1, 14);
const PIPE_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8);
const HUB_GEO = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8);
const ARM_GEO = new THREE.BoxGeometry(0.7, 0.04, 0.06);
const SPRAY_GEO = new THREE.SphereGeometry(0.06, 6, 5);
const REACH_GEO = new THREE.CircleGeometry(SPRINKLER.radius, 32);
REACH_GEO.rotateX(-Math.PI / 2);

const BODY_GEO = new THREE.SphereGeometry(0.16, 12, 10);
const NECK_GEO = new THREE.CylinderGeometry(0.035, 0.04, 0.2, 6);
const HEAD_GEO = new THREE.SphereGeometry(0.065, 10, 8);
const BEAK_GEO = new THREE.ConeGeometry(0.04, 0.14, 6);
const BEAK_TIP_GEO = new THREE.ConeGeometry(0.04, 0.05, 6);
const LEG_GEO = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 5);

/** One rendered prop: its object, and a per-frame hook. */
interface PropView {
  obj: THREE.Object3D;
  animate(dt: number, mode: Mode): void;
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  return m;
}

function makeSprinkler(p: Prop): PropView {
  const obj = new THREE.Group();
  obj.position.set(p.i * TILE_SIZE, RAFT_TOP, p.j * TILE_SIZE);

  const head = new THREE.Group();
  head.position.y = 0.55;
  const arm1 = part(ARM_GEO, METAL, 0, 0.03, 0);
  const arm2 = part(ARM_GEO, METAL, 0, 0.03, 0);
  arm2.rotation.y = Math.PI / 2;
  head.add(part(HUB_GEO, METAL, 0, 0, 0), arm1, arm2);

  const spray = new THREE.Group();
  const drops: THREE.Mesh[] = [];
  for (let k = 0; k < 16; k++) {
    const d = part(SPRAY_GEO, SPRAY_MAT, 0, 0.6, 0, false);
    spray.add(d);
    drops.push(d);
  }

  const reach = new THREE.Mesh(REACH_GEO, REACH_MAT);
  reach.position.y = 0.03;
  reach.visible = false;

  obj.add(
    part(BASE_GEO, METAL, 0, 0.05, 0),
    part(PIPE_GEO, METAL, 0, 0.325, 0),
    head,
    spray,
    reach,
  );

  let t = 0;
  return {
    obj,
    animate(dt: number, mode: Mode) {
      t += dt;
      head.rotation.y += 6 * dt;
      reach.visible = mode === 'build';
      spray.visible = mode !== 'title';
      if (!spray.visible) return;
      drops.forEach((d, k) => {
        const ph = (t / 1.2 + k / 16) % 1;
        const a = (k / 16) * Math.PI * 2;
        const r = SPRINKLER.radius * ph;
        d.position.set(Math.cos(a) * r, 0.6 + 0.9 * 4 * ph * (1 - ph) - 0.5 * ph, Math.sin(a) * r);
      });
    },
  };
}

function makeFlamingo(p: Prop): PropView {
  const obj = new THREE.Group();
  obj.position.set(p.i * TILE_SIZE, RAFT_TOP, p.j * TILE_SIZE);
  // Deterministic yaw from the cell, in 8 steps.
  obj.rotation.y = ((((p.i * 7 + p.j * 13) % 8) + 8) % 8) * Math.PI / 4;

  const body = part(BODY_GEO, PINK, 0, 0.5, 0);
  body.scale.set(1, 0.75, 1.5);
  const neck1 = part(NECK_GEO, PINK, 0, 0.6, 0.1);
  neck1.rotation.x = -0.4;
  const neck2 = part(NECK_GEO, PINK, 0, 0.74, 0.16);
  neck2.rotation.x = 0.3;
  const neck3 = part(NECK_GEO, PINK, 0, 0.86, 0.13);
  neck3.rotation.x = -0.3;
  const head = part(HEAD_GEO, PINK, 0, 0.92, 0.14);
  const beak = part(BEAK_GEO, PINK, 0, 0.9, 0.24);
  beak.rotation.x = Math.PI / 2 + 0.25;
  const tip = part(BEAK_TIP_GEO, BLACK, 0, 0.885, 0.285);
  tip.rotation.x = Math.PI / 2 + 0.25;
  const legA = part(LEG_GEO, DARK_PINK, -0.05, 0.175, 0);
  const legB = part(LEG_GEO, DARK_PINK, 0.05, 0.175, 0);

  obj.add(body, neck1, neck2, neck3, head, beak, tip, legA, legB);
  return { obj, animate: () => {} };
}

function makeProp(p: Prop): PropView {
  return p.kind === 'sprinkler' ? makeSprinkler(p) : makeFlamingo(p);
}

// ---------------------------------------------------------------- system

export function createBuilding(ctx: Ctx): System {
  const { scene, camera, state, input } = ctx;

  const raycaster = new THREE.Raycaster();
  const centre = new THREE.Vector2(0, 0);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -RAFT_TOP);
  const hit = new THREE.Vector3();

  // Tile ghost: translucent box on the tile that would be placed.
  const ghostMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.35, TILE_SIZE * 0.98), ghostMat);
  ghost.visible = false;
  scene.add(ghost);

  // Prop ghost: translucent cylinder standing on the tile that would get the prop.
  const propGhostMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
  const propGhost = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 12), propGhostMat);
  propGhost.visible = false;
  scene.add(propGhost);

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

  /**
   * Cell the player is aiming at, or null. Prop kinds need the aimed cell itself.
   * Tile kinds forgive aim at a tile edge by trying neighbours.
   */
  function findTarget(kind: BuildKind): { i: number; j: number } | null {
    raycaster.setFromCamera(centre, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    const p = state.player.position;
    if (Math.hypot(hit.x - p.x, hit.z - p.z) > REACH) return null;
    const c = cellAt(hit.x, hit.z);
    if (BUILD_COSTS[kind].onTile) return canBuild(state, c.i, c.j, kind) ? c : null;
    if (canBuild(state, c.i, c.j, kind)) return c;
    let best: { i: number; j: number } | null = null;
    let bestD = Infinity;
    for (const [di, dj] of NEIGHBOURS) {
      const i = c.i + di;
      const j = c.j + dj;
      if (!canBuild(state, i, j, kind)) continue;
      const d = Math.hypot(hit.x - i * TILE_SIZE, hit.z - j * TILE_SIZE);
      if (d < bestD) {
        bestD = d;
        best = { i, j };
      }
    }
    return best;
  }

  // Rendered props, keyed `${kind}:${i},${j}`.
  const views = new Map<string, PropView>();

  function syncProps(dt: number): void {
    const live = new Set<string>();
    for (const p of state.props) {
      const key = `${p.kind}:${p.i},${p.j}`;
      live.add(key);
      let v = views.get(key);
      if (!v) {
        v = makeProp(p);
        views.set(key, v);
        scene.add(v.obj);
      }
      v.animate(dt, state.mode);
    }
    for (const [key, v] of views) {
      if (live.has(key)) continue;
      scene.remove(v.obj);
      views.delete(key);
    }
  }

  let time = 0;

  return {
    update(dt: number) {
      syncProps(dt);

      // Toggle build mode.
      if (input.pressed(KEYS.build)) {
        if (state.mode === 'play') {
          state.mode = 'build';
          notify(state, 'Build mode: click to place, R to switch build kind, B to exit');
        } else if (state.mode === 'build') {
          state.mode = 'play';
        }
      }
      if (state.mode !== 'build') {
        ghost.visible = false;
        propGhost.visible = false;
        hints.visible = false;
        return;
      }

      // Cycle build kind through BUILD_ORDER.
      if (input.pressed(KEYS.buildKind)) {
        const next = (BUILD_ORDER.indexOf(state.buildKind) + 1) % BUILD_ORDER.length;
        state.buildKind = BUILD_ORDER[next];
        const def = BUILD_COSTS[state.buildKind];
        notify(state, def.name + ': ' + costText(def.cost));
        sfx('click');
      }

      // Aim, ghost and placement.
      const kind = state.buildKind;
      const isProp = BUILD_COSTS[kind].onTile;
      time += dt;
      ghost.visible = false;
      propGhost.visible = false;
      const target = findTarget(kind);
      if (target) {
        const g = isProp ? propGhost : ghost;
        const gm = isProp ? propGhostMat : ghostMat;
        g.visible = true;
        g.position.set(target.i * TILE_SIZE, isProp ? RAFT_TOP + 0.4 : RAFT_TOP - 0.15, target.j * TILE_SIZE);
        gm.color.setHex(hasItems(state, BUILD_COSTS[kind].cost) ? GHOST_OK : GHOST_NO);
        gm.opacity = 0.45 + 0.1 * Math.sin(time * 5);
        if (input.mousePressed(0) && input.locked()) {
          if (placeTile(state, target.i, target.j, kind)) sfx('place');
          else sfx('error');
        }
      }

      // Edge hints only while a tile kind is selected; rebuilt only when the tile count changes.
      hints.visible = !isProp;
      if (state.tiles.size !== hintsSize) rebuildHints();
    },
  };
}
