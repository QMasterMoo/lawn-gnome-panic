// src/world.ts
import * as THREE from 'three';
import { ARENA_HALF, COLORS, type World } from './config';

const LAWN_SIZE = ARENA_HALF * 2;
const TILE_PX = 256;
const TILE_WORLD = 8; // one grass tile covers 8 world units
const STRIPE_WIDTH = 10;
const MOW_CAPACITY = 12000;
const MOW_CELL = 0.45;
const PICKET_SPACING = 2.2;
const PICKET_BODY_Y = 2.8; // 5.6 tall, base on the ground
const PICKET_TIP_Y = 6.0; // 0.8 tall cone sitting on top of the body
const RAIL_HEIGHTS = [1.4, 4.2];
const BRICK_Z = -ARENA_HALF - 0.6;

const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');
const clampByte = (v: number): number => Math.min(255, Math.round(v));
const shade = (c: number, f: number): string =>
  `rgb(${clampByte(((c >> 16) & 255) * f)},${clampByte(((c >> 8) & 255) * f)},${clampByte((c & 255) * f)})`;

function shadowed<T extends THREE.Mesh>(m: T): T {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function make2d(w: number, h: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

export function buildWorld(scene: THREE.Scene): World {
  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.2));
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -35;
  sc.bottom = -35;
  sc.right = 35;
  sc.top = 35;
  sc.near = 1;
  sc.far = 160;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03; // avoids shadow acne when the frustum is stretched for top-down
  let shadowRange = 35;
  scene.add(sun, sun.target);

  // Lawn base: a tiled grass texture with speckles.
  const grassCtx = make2d(TILE_PX, TILE_PX);
  grassCtx.fillStyle = hex(COLORS.grass);
  grassCtx.fillRect(0, 0, TILE_PX, TILE_PX);
  const dark = shade(COLORS.grass, 0.9);
  const light = shade(COLORS.grass, 1.1);
  for (let i = 0; i < 3000; i++) {
    grassCtx.fillStyle = Math.random() < 0.5 ? dark : light;
    grassCtx.fillRect(Math.floor(Math.random() * (TILE_PX - 2)), Math.floor(Math.random() * (TILE_PX - 2)), 2, 2);
  }
  const grassTex = new THREE.CanvasTexture(grassCtx.canvas);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(LAWN_SIZE / TILE_WORLD, LAWN_SIZE / TILE_WORLD);
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.anisotropy = 8;

  const lawn = new THREE.Mesh(
    new THREE.PlaneGeometry(LAWN_SIZE, LAWN_SIZE),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  scene.add(lawn);

  // Classic lawn stripes: 1x64 texture, one transparent band and one white band per repeat.
  // Each band is 10 world units, so one repeat is 20 units.
  const stripeCtx = make2d(1, 64);
  stripeCtx.fillStyle = 'rgba(255,255,255,0.05)';
  stripeCtx.fillRect(0, 32, 1, 32);
  const stripeTex = new THREE.CanvasTexture(stripeCtx.canvas);
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.repeat.set(1, LAWN_SIZE / (STRIPE_WIDTH * 2));
  const stripes = new THREE.Mesh(
    new THREE.PlaneGeometry(LAWN_SIZE, LAWN_SIZE),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  stripes.rotation.x = -Math.PI / 2;
  stripes.position.y = 0.02;
  stripes.renderOrder = 1;
  stripes.receiveShadow = true; // overlays must darken in shadow like the lawn under them
  scene.add(stripes);

  // Mowed decals: a ring buffer of instanced circles, one per 0.8-unit grid cell.
  const mowGeo = new THREE.CircleGeometry(1, 12);
  mowGeo.rotateX(-Math.PI / 2);
  const mowMat = new THREE.MeshStandardMaterial({
    color: COLORS.grassMowed,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mowed = new THREE.InstancedMesh(mowGeo, mowMat, MOW_CAPACITY);
  mowed.receiveShadow = true;
  mowed.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mowed.position.y = 0.04;
  mowed.renderOrder = 2;
  mowed.frustumCulled = false; // the count changes at runtime; a cached bounding sphere would go stale
  mowed.count = 0;
  scene.add(mowed);

  const mowedCells = new Set<string>();
  const cellAt: (string | undefined)[] = new Array<string | undefined>(MOW_CAPACITY).fill(undefined);
  let nextSlot = 0;
  let written = 0;
  const tmpMatrix = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3(0.32, 0.32, 0.32);
  const yAxis = new THREE.Vector3(0, 1, 0);

  const markMowed = (x: number, z: number): void => {
    const cx = Math.round(x / MOW_CELL);
    const cz = Math.round(z / MOW_CELL);
    const key = `${cx},${cz}`;
    if (mowedCells.has(key)) return;

    const slot = nextSlot;
    nextSlot = (nextSlot + 1) % MOW_CAPACITY;
    const old = cellAt[slot];
    if (old !== undefined) mowedCells.delete(old);
    cellAt[slot] = key;
    mowedCells.add(key);

    tmpPos.set(cx * MOW_CELL, 0, cz * MOW_CELL);
    tmpQuat.setFromAxisAngle(yAxis, (Math.random() - 0.5) * 0.6);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    mowed.setMatrixAt(slot, tmpMatrix);
    mowed.instanceMatrix.needsUpdate = true;
    written++;
    mowed.count = Math.min(written, MOW_CAPACITY);
  };

  // Fences: pickets on the west, east and south sides, plus two rails per side.
  const fenceMat = new THREE.MeshStandardMaterial({ color: COLORS.fence });
  const picketCount = Math.floor(LAWN_SIZE / PICKET_SPACING) + 1;
  const picketBodies = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 5.6, 0.25), fenceMat, picketCount * 3);
  const coneGeo = new THREE.ConeGeometry(0.78, 0.8, 4);
  coneGeo.rotateY(Math.PI / 4); // puts a flat face on the outward axis
  const picketTips = new THREE.InstancedMesh(coneGeo, fenceMat, picketCount * 3);
  const fenceSides = [
    { alongX: false, v: -ARENA_HALF - 0.5 }, // west
    { alongX: false, v: ARENA_HALF + 0.5 }, // east
    { alongX: true, v: ARENA_HALF + 0.5 }, // south
  ];
  let picketIndex = 0;
  for (const side of fenceSides) {
    const rotY = side.alongX ? 0 : Math.PI / 2;
    for (let i = 0; i < picketCount; i++) {
      const t = -ARENA_HALF + i * PICKET_SPACING;
      const x = side.alongX ? t : side.v;
      const z = side.alongX ? side.v : t;
      tmpQuat.setFromAxisAngle(yAxis, rotY);
      tmpPos.set(x, PICKET_BODY_Y, z);
      tmpMatrix.compose(tmpPos, tmpQuat, new THREE.Vector3(1, 1, 1));
      picketBodies.setMatrixAt(picketIndex, tmpMatrix);
      tmpPos.set(x, PICKET_TIP_Y, z);
      tmpMatrix.compose(tmpPos, tmpQuat, new THREE.Vector3(1, 1, 1));
      picketTips.setMatrixAt(picketIndex, tmpMatrix);
      picketIndex++;
    }
    for (const y of RAIL_HEIGHTS) {
      const rail = shadowed(
        new THREE.Mesh(
          side.alongX ? new THREE.BoxGeometry(LAWN_SIZE, 0.35, 0.3) : new THREE.BoxGeometry(0.3, 0.35, LAWN_SIZE),
          fenceMat,
        ),
      );
      rail.position.set(side.alongX ? 0 : side.v, y, side.alongX ? side.v : 0);
      scene.add(rail);
    }
  }
  picketBodies.instanceMatrix.needsUpdate = true;
  picketTips.instanceMatrix.needsUpdate = true;
  shadowed(picketBodies);
  shadowed(picketTips);
  scene.add(picketBodies, picketTips);

  // North edging: a row of bricks along the full width, every third one darker.
  const brickCount = Math.floor(LAWN_SIZE / PICKET_SPACING) + 1;
  const bricks = shadowed(
    new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.2, 1.1, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
      brickCount,
    ),
  );
  const brickLight = new THREE.Color(0xa0522d);
  const brickDark = new THREE.Color(0x8b4513);
  for (let i = 0; i < brickCount; i++) {
    tmpQuat.identity();
    tmpPos.set(-ARENA_HALF + i * 2.2, 0.55, BRICK_Z);
    tmpMatrix.compose(tmpPos, tmpQuat, new THREE.Vector3(1, 1, 1));
    bricks.setMatrixAt(i, tmpMatrix);
    bricks.setColorAt(i, i % 3 === 0 ? brickDark : brickLight);
  }
  bricks.instanceMatrix.needsUpdate = true;
  if (bricks.instanceColor) bricks.instanceColor.needsUpdate = true;
  scene.add(bricks);

  // Ground beyond the lawn.
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({ color: 0x3f7f2b }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);

  const update = (_dt: number, focus: THREE.Vector3): void => {
    sun.target.position.set(focus.x, 0, focus.z);
    sun.position.set(focus.x + 40, 70, focus.z + 25);
  };

  const reset = (): void => {
    mowedCells.clear();
    cellAt.fill(undefined);
    nextSlot = 0;
    written = 0;
    mowed.count = 0;
  };

  /** Half-size of the area around the player that gets shadows (wider in top-down). */
  const setShadowRange = (halfExtent: number): void => {
    if (halfExtent === shadowRange) return;
    shadowRange = halfExtent;
    sc.left = -halfExtent;
    sc.bottom = -halfExtent;
    sc.right = halfExtent;
    sc.top = halfExtent;
    sc.far = 160 + halfExtent;
    sc.updateProjectionMatrix();
  };

  return { markMowed, update, reset, setShadowRange };
}
