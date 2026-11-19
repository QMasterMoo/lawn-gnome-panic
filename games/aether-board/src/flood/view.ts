// Flood Run view: the water surfaces, cannons and geysers, drawn with three.js. Reads the pure sim and obstacles;
// owns no simulation state. Built once; per frame it only rewrites vertex heights and colours.
import * as THREE from 'three';
import { buildPrefab } from '@lawn/prefabs';
import type { World } from '../world';
import { cannonState, geyserState } from './obstacles';
import { FLOOD, type Cannon, type Flood, type Geyser, type Obstacles, type RunGrid } from './types';

export interface FloodView {
  /** dt real seconds; t the sim clock for cannonState / geyserState; camPos for culling runs far from the camera. */
  update(dt: number, t: number, camPos: THREE.Vector3): void;
  dispose(): void;
}

const WATER_NEAR = 700;
const OBJECT_NEAR = 600;
const SPRAY_N = 40;
const SHALLOW = new THREE.Color(0x38bdf8);
const DEEP = new THREE.Color(0x0284c7);
const UP = new THREE.Vector3(0, 1, 0);

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

interface WaterRun {
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  pos: Float32Array;
  col: Float32Array;
  cx: number;
  cz: number;
}

interface CannonView {
  c: Cannon;
  group: THREE.Group;
  sphere: THREE.Mesh;
  jet: THREE.Mesh;
  jetMat: THREE.MeshBasicMaterial;
  spray: THREE.Points;
  sprayPos: Float32Array;
  sprayLat: Float32Array;
  sprayUp: Float32Array;
  sinY: number;
  cosY: number;
}

interface GeyserView {
  g: Geyser;
  group: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  column: THREE.Mesh;
  colMat: THREE.MeshBasicMaterial;
}

export function createFloodView(scene: THREE.Scene, _world: World, flood: Flood, obstacles: Obstacles): FloodView {
  const root = new THREE.Group();
  root.name = 'flood-view';
  scene.add(root);

  // ---- shared materials and geometries
  const waterMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
  });
  const sphereGeo = new THREE.SphereGeometry(0.3, 10, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.9, depthWrite: false });
  const jetGeo = new THREE.CylinderGeometry(FLOOD.cannonRadius, 0.3, FLOOD.cannonRange, 14, 1, true);
  jetGeo.translate(0, FLOOD.cannonRange / 2, 0); // base at the muzzle, far end at +range
  const sprayMat = new THREE.PointsMaterial({
    color: 0xe0f7ff, size: 0.4, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const ringGeo = new THREE.RingGeometry(FLOOD.geyserRadius * 0.8, FLOOD.geyserRadius, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const columnGeo = new THREE.CylinderGeometry(FLOOD.geyserRadius * 0.5, FLOOD.geyserRadius * 0.5, 14, 16, 1, true);
  columnGeo.translate(0, 7, 0); // base at the vent, top 14 m up

  // ---- water: one mesh per run, built lazily
  const waters: (WaterRun | null)[] = flood.runs.map(() => null);

  function buildWater(r: RunGrid): WaterRun {
    const n = r.nu * r.nv;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let j = 0; j < r.nv; j++) {
      for (let k = 0; k < r.nu; k++) {
        const i = j * r.nu + k;
        pos[i * 3] = r.ox + r.fx * k * r.cell + r.sx * j * r.cell;
        pos[i * 3 + 2] = r.oz + r.fz * k * r.cell + r.sz * j * r.cell;
      }
    }
    // Index buffer: built once over every quad whose four corners are all ground.
    const idx = new Uint32Array(Math.max(0, (r.nu - 1) * (r.nv - 1) * 6));
    let m = 0;
    for (let j = 0; j < r.nv - 1; j++) {
      for (let k = 0; k < r.nu - 1; k++) {
        const a = j * r.nu + k;
        const b = a + 1;
        const c = a + r.nu;
        const d = c + 1;
        if (r.hole[a] || r.hole[b] || r.hole[c] || r.hole[d]) continue;
        idx[m++] = a; idx[m++] = c; idx[m++] = b;
        idx[m++] = c; idx[m++] = d; idx[m++] = b;
      }
    }
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(col, 3);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);
    geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, m), 1));
    const mesh = new THREE.Mesh(geo, waterMat);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    mesh.visible = false;
    root.add(mesh);
    return {
      mesh, geo, pos, col,
      cx: r.ox + (r.fx * (r.nu - 1) * r.cell + r.sx * (r.nv - 1) * r.cell) / 2,
      cz: r.oz + (r.fz * (r.nu - 1) * r.cell + r.sz * (r.nv - 1) * r.cell) / 2,
    };
  }

  function refreshWater(w: WaterRun, r: RunGrid): void {
    const n = r.nu * r.nv;
    for (let i = 0; i < n; i++) {
      const d = r.depth[i];
      const bed = r.bed[i];
      // Dry cells sink under the ground so they vanish.
      w.pos[i * 3 + 1] = d >= 0.02 ? bed + d : bed - 0.25;
      const tDeep = clamp01(d / 2.5);
      let cr = SHALLOW.r + (DEEP.r - SHALLOW.r) * tDeep;
      let cg = SHALLOW.g + (DEEP.g - SHALLOW.g) * tDeep;
      let cb = SHALLOW.b + (DEEP.b - SHALLOW.b) * tDeep;
      const foam = Math.max(clamp01((r.speed[i] - 6) / 8), d >= 0.02 && d < 0.15 ? 0.9 : 0);
      cr += (1 - cr) * foam;
      cg += (1 - cg) * foam;
      cb += (1 - cb) * foam;
      w.col[i * 3] = cr;
      w.col[i * 3 + 1] = cg;
      w.col[i * 3 + 2] = cb;
    }
    w.geo.attributes.position.needsUpdate = true;
    w.geo.attributes.color.needsUpdate = true;
  }

  // ---- cannons
  const cannonViews: CannonView[] = obstacles.cannons.map((c) => {
    const group = new THREE.Group();
    group.name = `flood-cannon-${c.id}`;
    const base = buildPrefab('flood-cannon', { scale: 2.5 });
    base.position.set(c.x, c.y - 1.4 + 0.2, c.z);
    base.rotation.y = c.yaw;
    group.add(base);

    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(c.x, c.y, c.z);
    sphere.visible = false;
    group.add(sphere);

    const jetMat = new THREE.MeshBasicMaterial({
      color: 0xe0f7ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const sinY = Math.sin(c.yaw);
    const cosY = Math.cos(c.yaw);
    const jet = new THREE.Mesh(jetGeo, jetMat);
    jet.name = 'flood-jet';
    jet.position.set(c.x, c.y, c.z);
    jet.quaternion.setFromUnitVectors(UP, new THREE.Vector3(sinY, 0, cosY));
    jet.visible = false;
    group.add(jet);

    const sprayPos = new Float32Array(SPRAY_N * 3);
    const sprayLat = new Float32Array(SPRAY_N);
    const sprayUp = new Float32Array(SPRAY_N);
    for (let i = 0; i < SPRAY_N; i++) {
      sprayLat[i] = Math.sin(i * 2.399 + c.id * 1.3) * 1.2;
      sprayUp[i] = Math.cos(i * 1.7 + c.id * 0.7) * 0.5 + 0.5;
    }
    const sprayGeo = new THREE.BufferGeometry();
    const sprayAttr = new THREE.BufferAttribute(sprayPos, 3);
    sprayAttr.setUsage(THREE.DynamicDrawUsage);
    sprayGeo.setAttribute('position', sprayAttr);
    const spray = new THREE.Points(sprayGeo, sprayMat);
    spray.frustumCulled = false;
    spray.visible = false;
    group.add(spray);

    root.add(group);
    return { c, group, sphere, jet, jetMat, spray, sprayPos, sprayLat, sprayUp, sinY, cosY };
  });

  // ---- geysers
  const geyserViews: GeyserView[] = obstacles.geysers.map((g) => {
    const group = new THREE.Group();
    group.name = `flood-geyser-${g.id}`;
    const vent = buildPrefab('flood-geyser-vent', { scale: (FLOOD.geyserRadius * 1.6) / 1.2 });
    vent.position.set(g.x, g.y + 0.05, g.z);
    group.add(vent);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(g.x, g.y + 0.08, g.z);
    ring.visible = false;
    group.add(ring);

    const colMat = new THREE.MeshBasicMaterial({
      color: 0xeaf6ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const column = new THREE.Mesh(columnGeo, colMat);
    column.name = 'flood-column';
    column.position.set(g.x, g.y + 0.05, g.z);
    column.visible = false;
    group.add(column);

    root.add(group);
    return { g, group, ring, ringMat, column, colMat };
  });

  return {
    update(_dt, t, camPos) {
      // Water: only the active runs near the camera.
      for (let ri = 0; ri < flood.runs.length; ri++) {
        const r = flood.runs[ri];
        let w = waters[ri];
        if (!r.active || !nearWater(r, camPos)) {
          if (w) w.mesh.visible = false;
          continue;
        }
        if (!w) {
          w = buildWater(r);
          waters[ri] = w;
        }
        w.mesh.visible = true;
        refreshWater(w, r);
      }

      // Cannons.
      for (const cv of cannonViews) {
        const c = cv.c;
        const dx = c.x - camPos.x;
        const dz = c.z - camPos.z;
        const near = dx * dx + dz * dz <= OBJECT_NEAR * OBJECT_NEAR;
        cv.group.visible = near;
        if (!near) continue;
        const st = cannonState(c, t);
        const k = st.k;
        cv.sphere.visible = st.phase === 'windup';
        if (st.phase === 'windup') cv.sphere.scale.setScalar(1 + 2 * k);
        const firing = st.phase === 'fire';
        cv.jet.visible = firing;
        cv.spray.visible = firing;
        if (!firing) continue;
        cv.jetMat.opacity = 0.55 * (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1);
        for (let i = 0; i < SPRAY_N; i++) {
          const f = (k * 2 + i / SPRAY_N) % 1;
          const d = f * FLOOD.cannonRange;
          const lat = cv.sprayLat[i];
          const p = i * 3;
          cv.sprayPos[p] = c.x + cv.sinY * d + cv.cosY * lat;
          cv.sprayPos[p + 1] = c.y + cv.sprayUp[i] * 0.6 - f * f * 2.5;
          cv.sprayPos[p + 2] = c.z + cv.cosY * d - cv.sinY * lat;
        }
        (cv.spray.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }

      // Geysers.
      for (const gv of geyserViews) {
        const g = gv.g;
        const dx = g.x - camPos.x;
        const dz = g.z - camPos.z;
        const near = dx * dx + dz * dz <= OBJECT_NEAR * OBJECT_NEAR;
        gv.group.visible = near;
        if (!near) continue;
        const st = geyserState(g, t);
        const k = st.k;
        const windup = st.phase === 'windup';
        const firing = st.phase === 'fire';
        gv.ring.visible = windup;
        if (windup) {
          gv.ring.scale.setScalar(0.7 + 0.3 * k);
          gv.ringMat.opacity = 0.35 + 0.5 * k;
        }
        gv.column.visible = firing;
        if (firing) {
          const rise = 1 - Math.pow(1 - k, 3);
          gv.column.scale.set(1, Math.max(0.02, rise), 1);
          gv.colMat.opacity = k > 0.7 ? 0.7 * (1 - (k - 0.7) / 0.3) : 0.7;
        }
      }
    },

    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) mat.dispose();
        }
      });
      root.clear();
      scene.remove(root);
      waters.fill(null);
      cannonViews.length = 0;
      geyserViews.length = 0;
      sphereGeo.dispose();
      sphereMat.dispose();
      jetGeo.dispose();
      sprayMat.dispose();
      ringGeo.dispose();
      columnGeo.dispose();
      waterMat.dispose();
    },
  };
}

function nearWater(r: RunGrid, camPos: THREE.Vector3): boolean {
  const cx = r.ox + (r.fx * (r.nu - 1) * r.cell + r.sx * (r.nv - 1) * r.cell) / 2;
  const cz = r.oz + (r.fz * (r.nu - 1) * r.cell + r.sz * (r.nv - 1) * r.cell) / 2;
  const dx = cx - camPos.x;
  const dz = cz - camPos.z;
  return dx * dx + dz * dz <= WATER_NEAR * WATER_NEAR;
}
