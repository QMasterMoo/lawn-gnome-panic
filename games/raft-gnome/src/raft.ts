// Renders the grass raft from state.tiles: one group per tile, grass that grows taller,
// and a small burst of green bits when a tile is cut. Read-only on state.
import * as THREE from 'three';
import { COLORS, RAFT_TOP, TILE_SIZE, type Ctx, type System, type Tile } from './config';

const BLADES_PER_TILE = 28;
const BLADE_REBUILD_EPS = 0.02;
const CUT_DROP = 0.2;
const CUT_PARTICLES = 10;
const PARTICLE_LIFE = 0.6;
const GRAVITY = 9;
const PARTICLE_SIZE = 0.08;

interface BladeDef { x: number; z: number; q: THREE.Quaternion }

interface TileView {
  group: THREE.Group;
  turfMat: THREE.MeshStandardMaterial;
  blades: THREE.InstancedMesh;
  bladeDefs: BladeDef[];
  builtGrowth: number;
  lastGrowth: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

/** Tiny seeded LCG so a tile's blades land in the same places every time. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createRaft(ctx: Ctx): System {
  const scene = ctx.scene;
  const tiles = ctx.state.tiles;

  // Shared geometry and materials, created once.
  const dirtGeo = new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.7, TILE_SIZE * 0.98);
  const turfGeo = new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.06, TILE_SIZE * 0.98);
  const bladeGeo = new THREE.ConeGeometry(0.06, 1, 4);
  bladeGeo.translate(0, 0.5, 0);
  const particleGeo = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
  const dirtMat = new THREE.MeshStandardMaterial({ color: COLORS.dirt });
  const bladeMat = new THREE.MeshStandardMaterial({ color: COLORS.grass });
  const particleMat = new THREE.MeshStandardMaterial({ color: COLORS.grass });

  const tallColor = new THREE.Color(COLORS.grassTall);
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpMatrix = new THREE.Matrix4();

  const views = new Map<string, TileView>();
  const particles: Particle[] = [];

  function createTileView(tile: Tile): TileView {
    const group = new THREE.Group();
    group.position.set(tile.i * TILE_SIZE, 0, tile.j * TILE_SIZE);

    const dirt = new THREE.Mesh(dirtGeo, dirtMat);
    dirt.position.y = RAFT_TOP - 0.38;
    dirt.castShadow = true;

    const turfMat = new THREE.MeshStandardMaterial({ color: COLORS.grass });
    const turf = new THREE.Mesh(turfGeo, turfMat);
    turf.position.y = RAFT_TOP - 0.03;
    turf.castShadow = true;

    const rnd = seededRandom((tile.i * 73856093) ^ (tile.j * 19349663));
    const bladeDefs: BladeDef[] = [];
    for (let k = 0; k < BLADES_PER_TILE; k++) {
      const x = (rnd() - 0.5) * TILE_SIZE * 0.9;
      const z = (rnd() - 0.5) * TILE_SIZE * 0.9;
      const q = new THREE.Quaternion().setFromAxisAngle(UP, rnd() * Math.PI * 2);
      bladeDefs.push({ x, z, q });
    }
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, BLADES_PER_TILE);
    blades.castShadow = true;
    blades.frustumCulled = false;

    group.add(dirt, turf, blades);
    scene.add(group);

    return {
      group,
      turfMat,
      blades,
      bladeDefs,
      builtGrowth: -Infinity,
      lastGrowth: tile.growth,
    };
  }

  function rebuildBlades(view: TileView, growth: number): void {
    const h = 0.08 + growth * 0.55;
    tmpScale.set(1, h, 1);
    view.bladeDefs.forEach((b, k) => {
      tmpPos.set(b.x, RAFT_TOP, b.z);
      tmpMatrix.compose(tmpPos, b.q, tmpScale);
      view.blades.setMatrixAt(k, tmpMatrix);
    });
    view.blades.instanceMatrix.needsUpdate = true;
    view.builtGrowth = growth;
  }

  function removeTileView(key: string, view: TileView): void {
    scene.remove(view.group);
    view.turfMat.dispose();
    view.blades.dispose();
    views.delete(key);
  }

  function spawnCut(i: number, j: number): void {
    for (let k = 0; k < CUT_PARTICLES; k++) {
      const mesh = new THREE.Mesh(particleGeo, particleMat);
      mesh.position.set(
        i * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.8,
        RAFT_TOP,
        j * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.8,
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        2 + Math.random() * 2.5,
        (Math.random() - 0.5) * 3,
      );
      scene.add(mesh);
      particles.push({ mesh, vel, life: 0 });
    }
  }

  function updateParticles(dt: number): void {
    for (let n = particles.length - 1; n >= 0; n--) {
      const p = particles[n];
      if (!p) continue;
      p.life += dt;
      if (p.life >= PARTICLE_LIFE) {
        scene.remove(p.mesh);
        particles.splice(n, 1);
        continue;
      }
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(Math.max(0, 1 - p.life / PARTICLE_LIFE));
    }
  }

  return {
    update(dt: number) {
      // Remove groups whose tile is gone.
      for (const [key, view] of views) {
        if (!tiles.has(key)) removeTileView(key, view);
      }

      // Create groups for new tiles, and sync growth.
      for (const [key, tile] of tiles) {
        let view = views.get(key);
        if (!view) {
          view = createTileView(tile);
          views.set(key, view);
        }

        const growth = tile.growth;
        if (view.lastGrowth - growth > CUT_DROP) spawnCut(tile.i, tile.j);
        view.lastGrowth = growth;

        view.turfMat.color.setHex(COLORS.grass).lerp(tallColor, growth);
        if (Math.abs(growth - view.builtGrowth) > BLADE_REBUILD_EPS) rebuildBlades(view, growth);
      }

      updateParticles(dt);
    },
  };
}
