import * as THREE from 'three';
import { ARENA_HALF, ITEM_DEFS, OBSTACLES, TUNING } from './config';
import type { ItemKind, ItemMarker, ItemSystem } from './config';

/** Rare world items with glowing beacons. */

interface SteamPuff { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }

interface Item {
  kind: ItemKind;
  group: THREE.Group;
  pos: THREE.Vector3;
  t: number;
  beacon: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;   // per item: its opacity pulses
  ring: THREE.Mesh;
  model: THREE.Group;
  steam: SteamPuff[];                   // espresso only
}

const FIRST_SPAWN_S = 15;
const DEFS = Object.values(ITEM_DEFS);
const TOTAL_WEIGHT = DEFS.reduce((sum, d) => sum + d.weight, 0);
const SPAWN_EDGE = ARENA_HALF - 3;

export function createItemSystem(scene: THREE.Scene): ItemSystem {
  // Shared geometries and materials, built lazily and reused by every item.
  const geos = new Map<string, THREE.BufferGeometry>();
  const mats = new Map<string, THREE.Material>();
  const geo = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => {
    let g = geos.get(key);
    if (!g) { g = make(); geos.set(key, g); }
    return g;
  };
  const mat = (key: string, make: () => THREE.Material): THREE.Material => {
    let m = mats.get(key);
    if (!m) { m = make(); mats.set(key, m); }
    return m;
  };
  const cyl = (rt: number, rb: number, h: number, seg = 16, open = false) =>
    geo(`cyl:${rt}:${rb}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  const box = (w: number, h: number, d: number) =>
    geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
  const sph = (r: number) => geo(`sph:${r}`, () => new THREE.SphereGeometry(r, 12, 8));
  const tor = (r: number, tube: number, arc: number) =>
    geo(`tor:${r}:${tube}:${arc}`, () => new THREE.TorusGeometry(r, tube, 8, 20, arc));
  const std = (color: number, emissive = 0, emissiveIntensity = 0, side: THREE.Side = THREE.FrontSide) =>
    mat(`std:${color}:${emissive}:${emissiveIntensity}:${side}`, () =>
      new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: 0.55, side }));
  const part = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
    const me = new THREE.Mesh(g, m);
    me.position.set(x, y, z);
    return me;
  };

  /** Roughly 1 unit across, centred on the origin. */
  function buildModel(kind: ItemKind): THREE.Group {
    const g = new THREE.Group();
    switch (kind) {
      case 'chicken': {
        const plate = part(cyl(0.7, 0.7, 0.05, 20), std(0xffffff), 0, -0.35, 0);
        const body = part(sph(0.45), std(0xb5651d));
        body.scale.set(1.3, 0.9, 1);
        g.add(plate, body);
        for (const side of [-1, 1]) {
          const leg = part(cyl(0.12, 0.12, 0.5, 10), std(0xc97a3a), side * 0.5, 0.3, 0);
          leg.rotation.z = -side * 0.8;
          const bone = part(sph(0.07), std(0xffffff), side * 0.7, 0.47, 0);
          g.add(leg, bone);
        }
        break;
      }
      case 'shopVac': {
        const canister = part(cyl(0.4, 0.4, 0.7, 16), std(0xd32f2f));
        const lid = part(cyl(0.42, 0.42, 0.1, 16), std(0x111111), 0, 0.4, 0);
        const hose = part(tor(0.35, 0.06, Math.PI), std(0x111111), 0.4, 0, 0);
        hose.rotation.z = -Math.PI / 2;
        const nozzle = part(cyl(0.12, 0.12, 0.4, 10), std(0x9e9e9e), 0.35, -0.45, 0);
        nozzle.rotation.z = Math.PI / 2;
        g.add(canister, lid, hose, nozzle);
        break;
      }
      case 'weedKiller': {
        const body = part(cyl(0.3, 0.3, 0.9, 16), std(0x76ff03, 0x33aa00, 0.3));
        const band = part(cyl(0.31, 0.31, 0.22, 16, true), std(0xffeb3b), 0, -0.1, 0);
        const stripe = part(cyl(0.32, 0.32, 0.08, 16, true), std(0x111111), 0, -0.1, 0);
        const neck = part(box(0.15, 0.25, 0.15), std(0xffffff), 0, 0.575, 0);
        const head = part(box(0.35, 0.18, 0.2), std(0xffffff), 0.05, 0.79, 0);
        g.add(body, band, stripe, neck, head);
        break;
      }
      case 'espresso': {
        const cup = part(cyl(0.3, 0.25, 0.5, 16, true), std(0xffffff, 0, 0, THREE.DoubleSide), 0, 0.3, 0);
        const bottom = part(cyl(0.25, 0.25, 0.02, 16), std(0xffffff), 0, 0.05, 0);
        const saucer = part(cyl(0.5, 0.5, 0.04, 20), std(0xffffff), 0, 0.02, 0);
        const coffee = part(cyl(0.28, 0.28, 0.02, 16), std(0x3e2723), 0, 0.55, 0);
        g.add(cup, bottom, saucer, coffee);
        break;
      }
      case 'compostBin': {
        const bin = part(box(0.9, 0.7, 0.7), std(0x2e7d32), 0, 0.35, 0);
        const lid = part(box(0.95, 0.12, 0.75), std(0x2e7d32), 0, 0.76, 0);
        const purple = std(0xe040fb, 0xe040fb, 0.6);
        g.add(
          bin, lid,
          part(box(0.97, 0.04, 0.04), purple, 0, 0.84, 0.375),
          part(box(0.97, 0.04, 0.04), purple, 0, 0.84, -0.375),
          part(box(0.04, 0.04, 0.77), purple, 0.475, 0.84, 0),
          part(box(0.04, 0.04, 0.77), purple, -0.475, 0.84, 0),
        );
        break;
      }
    }
    return g;
  }

  function addSteam(model: THREE.Group): SteamPuff[] {
    const puffs: SteamPuff[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
      const mesh = part(sph(0.07), m);
      model.add(mesh);
      puffs.push({ mesh, mat: m });
    }
    return puffs;
  }

  const items: Item[] = [];
  let spawnTimer = FIRST_SPAWN_S;

  function pickKind(): ItemKind {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const def of DEFS) {
      r -= def.weight;
      if (r < 0) return def.kind;
    }
    return DEFS[DEFS.length - 1].kind;
  }

  function findSpot(px: number, pz: number): { x: number; z: number } | null {
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = TUNING.itemRingMin + Math.random() * (TUNING.itemRingMax - TUNING.itemRingMin);
      const x = Math.max(-SPAWN_EDGE, Math.min(SPAWN_EDGE, px + Math.sin(a) * r));
      const z = Math.max(-SPAWN_EDGE, Math.min(SPAWN_EDGE, pz + Math.cos(a) * r));
      if (OBSTACLES.every((o) => Math.hypot(o.x - x, o.z - z) > o.radius + 2)) return { x, z };
    }
    return null;
  }

  function spawn(px: number, pz: number): boolean {
    const spot = findSpot(px, pz);
    if (!spot) return false;
    const kind = pickKind();
    const def = ITEM_DEFS[kind];

    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);

    const beaconMat = new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    const beacon = part(cyl(0.6, 0.6, 60, 16, true), beaconMat, 0, 30, 0);

    const ring = part(
      geo('ring', () => new THREE.TorusGeometry(1.4, 0.08, 8, 40)),
      mat(`ring:${def.color}`, () => new THREE.MeshBasicMaterial({ color: def.color })),
      0, 0.05, 0,
    );
    ring.rotation.x = Math.PI / 2;

    const model = buildModel(kind);
    model.position.y = 1.2;
    const steam = kind === 'espresso' ? addSteam(model) : [];

    group.add(beacon, ring, model);
    scene.add(group);
    items.push({
      kind, group, pos: new THREE.Vector3(spot.x, 0, spot.z), t: 0,
      beacon, beaconMat, ring, model, steam,
    });
    return true;
  }

  function animate(it: Item, dt: number) {
    const t = it.t;
    it.beaconMat.opacity = 0.225 + 0.075 * Math.sin(t * 2);   // pulses 0.15..0.3
    it.ring.scale.setScalar(1.125 + 0.125 * Math.sin(t * 3)); // pulses 1..1.25
    it.model.position.y = 1.2 + 0.2 * Math.sin(t * 2.5);
    it.model.rotation.y += 1.5 * dt;
    for (let i = 0; i < it.steam.length; i++) {
      const s = it.steam[i];
      const phase = (t * 0.5 + i / it.steam.length) % 1;
      s.mesh.position.set(0, 0.6 + phase * 0.9, 0);
      s.mesh.scale.setScalar(0.6 + 0.6 * phase);
      s.mat.opacity = 0.6 * (1 - phase);
    }
  }

  function removeItem(i: number) {
    const it = items[i];
    scene.remove(it.group);
    it.beaconMat.dispose();
    for (const s of it.steam) s.mat.dispose();
    items.splice(i, 1);
  }

  function update(dt: number, playerFeet: THREE.Vector3): ItemKind[] {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && items.length < TUNING.itemMax) {
      // If no spot was found, the timer stays <= 0 and we retry next frame.
      if (spawn(playerFeet.x, playerFeet.z)) spawnTimer = TUNING.itemSpawnS;
    }

    const collected: ItemKind[] = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt;
      animate(it, dt);
      const d = Math.hypot(it.pos.x - playerFeet.x, it.pos.z - playerFeet.z);
      if (d < 1.6 && playerFeet.y < 3) {
        collected.push(it.kind);
        removeItem(i);
      } else if (d > TUNING.itemLeashDist) {
        removeItem(i);
      }
    }
    return collected.reverse();
  }

  function active(): readonly ItemMarker[] {
    return items.map((it) => ({ kind: it.kind, pos: it.pos }));
  }

  function reset() {
    while (items.length > 0) removeItem(items.length - 1);
    spawnTimer = FIRST_SPAWN_S;
  }

  return { update, active, reset };
}
