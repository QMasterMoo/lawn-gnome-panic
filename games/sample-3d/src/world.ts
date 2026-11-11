// src/world.ts
import * as THREE from 'three';
import { ARENA_HALF, COLORS, OBSTACLES, type World } from './config';

const TEX_SIZE = 512;
const MOW_RADIUS_PX = 11;
const UPLOAD_INTERVAL_S = 0.1;

const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');
const clampByte = (v: number): number => Math.min(255, Math.round(v));

function shadowed<T extends THREE.Mesh>(m: T): T {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildWorld(scene: THREE.Scene): World {
  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x446644, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(15, 25, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26;
  sc.bottom = -26;
  sc.right = 26;
  sc.top = 26;
  sc.near = 1;
  sc.far = 70;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // Lawn: a painted canvas texture that shows mowed stripes.
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const paintBase = (): void => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(COLORS.grass);
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    const r = (COLORS.grass >> 16) & 255;
    const g = (COLORS.grass >> 8) & 255;
    const b = COLORS.grass & 255;
    const dark = `rgb(${clampByte(r * 0.9)},${clampByte(g * 0.9)},${clampByte(b * 0.9)})`;
    const light = `rgb(${clampByte(r * 1.08)},${clampByte(g * 1.08)},${clampByte(b * 1.08)})`;
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? dark : light;
      ctx.fillRect(Math.floor(Math.random() * (TEX_SIZE - 2)), Math.floor(Math.random() * (TEX_SIZE - 2)), 2, 2);
    }
  };
  paintBase();

  const lawn = shadowed(
    new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
    ),
  );
  lawn.rotation.x = -Math.PI / 2;
  scene.add(lawn);

  // Outer ground beyond the fence and hedges.
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x3f7f2b }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.01;
  outer.receiveShadow = true;
  scene.add(outer);

  // Picket fence around the lawn.
  const L = ARENA_HALF + 0.3;
  const fenceMat = new THREE.MeshStandardMaterial({ color: COLORS.fence });
  const picketGeo = new THREE.BoxGeometry(0.12, 0.8, 0.06);
  const railAlongX = new THREE.BoxGeometry(2 * L, 0.08, 0.06);
  const railAlongZ = new THREE.BoxGeometry(0.06, 0.08, 2 * L);
  const picketCount = Math.floor((2 * L) / 0.5);
  const fenceSides: { alongX: boolean; v: number }[] = [
    { alongX: true, v: L },
    { alongX: true, v: -L },
    { alongX: false, v: L },
    { alongX: false, v: -L },
  ];
  for (const s of fenceSides) {
    for (let i = 0; i <= picketCount; i++) {
      const t = -L + i * 0.5;
      const picket = shadowed(new THREE.Mesh(picketGeo, fenceMat));
      if (s.alongX) {
        picket.position.set(t, 0.4, s.v);
      } else {
        picket.position.set(s.v, 0.4, t);
        picket.rotation.y = Math.PI / 2;
      }
      scene.add(picket);
    }
    for (const y of [0.25, 0.6]) {
      const rail = shadowed(new THREE.Mesh(s.alongX ? railAlongX : railAlongZ, fenceMat));
      if (s.alongX) rail.position.set(0, y, s.v);
      else rail.position.set(s.v, y, 0);
      scene.add(rail);
    }
  }

  // Hedge ring outside the fence.
  const hedgeMat = new THREE.MeshStandardMaterial({ color: COLORS.bush });
  const H = ARENA_HALF + 2.5;
  const hedgeLen = ARENA_HALF * 2 + 5;
  for (const sign of [1, -1]) {
    const ns = shadowed(new THREE.Mesh(new THREE.BoxGeometry(hedgeLen, 1.8, 2), hedgeMat));
    ns.position.set(0, 0.9, sign * H);
    scene.add(ns);
    const ew = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, hedgeLen), hedgeMat));
    ew.position.set(sign * H, 0.9, 0);
    scene.add(ew);
  }

  // Obstacle meshes, one set per entry in OBSTACLES.
  const stumpMat = new THREE.MeshStandardMaterial({ color: COLORS.stump });
  const stumpTopMat = new THREE.MeshStandardMaterial({ color: 0xc9a46a });
  const stoneMat = new THREE.MeshStandardMaterial({ color: COLORS.stone });
  const rockMat = new THREE.MeshStandardMaterial({ color: COLORS.stone, flatShading: true });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x5ec8f2 });
  for (const o of OBSTACLES) {
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, dx: number, y: number, dz: number): THREE.Mesh => {
      const m = shadowed(new THREE.Mesh(geo, mat));
      m.position.set(o.x + dx, y, o.z + dz);
      scene.add(m);
      return m;
    };
    switch (o.kind) {
      case 'stump':
        add(new THREE.CylinderGeometry(o.radius, o.radius * 1.1, o.height, 16), stumpMat, 0, o.height / 2, 0);
        add(new THREE.CylinderGeometry(o.radius * 0.9, o.radius * 0.9, 0.02, 16), stumpTopMat, 0, o.height + 0.01, 0);
        break;
      case 'rock': {
        const rock = add(new THREE.DodecahedronGeometry(o.radius), rockMat, 0, o.height / 2, 0);
        rock.scale.y = o.height / o.radius;
        break;
      }
      case 'bush': {
        const bushMat = new THREE.MeshStandardMaterial({ color: COLORS.bush });
        const main = add(new THREE.SphereGeometry(o.radius, 16, 12), bushMat, 0, o.height - o.radius * 0.6, 0);
        main.scale.y = 0.8;
        add(new THREE.SphereGeometry(o.radius * 0.7, 12, 8), bushMat, -o.radius * 0.5, o.radius * 0.5, 0);
        add(new THREE.SphereGeometry(o.radius * 0.7, 12, 8), bushMat, o.radius * 0.5, o.radius * 0.5, 0);
        break;
      }
      case 'birdbath':
        add(new THREE.CylinderGeometry(0.15, 0.25, o.height - 0.1, 12), stoneMat, 0, (o.height - 0.1) / 2, 0);
        add(new THREE.CylinderGeometry(o.radius, o.radius * 0.6, 0.15, 20), stoneMat, 0, o.height - 0.075, 0);
        // Water: same proportions as the bowl, slightly inset (guessed interpretation of "same").
        add(new THREE.CylinderGeometry(o.radius * 0.85, o.radius * 0.6 * 0.85, 0.02, 20), waterMat, 0, o.height - 0.01, 0);
        break;
    }
  }

  // Decorative flower clusters in the corners (no collision).
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7d2a });
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6);
  const flowerGeo = new THREE.SphereGeometry(0.08, 10, 8);
  const flowerMats = [0xff8fb1, 0xffd93b, 0xffffff].map((c) => new THREE.MeshStandardMaterial({ color: c }));
  for (let i = 0; i < 12; i++) {
    let x = 0;
    let z = 0;
    do {
      x = (Math.random() * 2 - 1) * ARENA_HALF;
      z = (Math.random() * 2 - 1) * ARENA_HALF;
    } while (!(Math.abs(x) > 14 && Math.abs(z) > 14));
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(x, 0.125, z);
    scene.add(stem);
    const flower = new THREE.Mesh(flowerGeo, flowerMats[Math.floor(Math.random() * flowerMats.length)]);
    flower.position.set(x, 0.25, z);
    scene.add(flower);
  }

  // Mowed-patch painting.
  let dirty = false;
  let sinceUpload = UPLOAD_INTERVAL_S;

  const markMowed = (x: number, z: number): void => {
    const px = ((x + ARENA_HALF) / (2 * ARENA_HALF)) * TEX_SIZE;
    const py = ((z + ARENA_HALF) / (2 * ARENA_HALF)) * TEX_SIZE;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = hex(COLORS.grassMowed);
    ctx.beginPath();
    ctx.arc(px, py, MOW_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    dirty = true;
  };

  const update = (dt: number): void => {
    sinceUpload += dt;
    if (dirty && sinceUpload >= UPLOAD_INTERVAL_S) {
      tex.needsUpdate = true;
      dirty = false;
      sinceUpload = 0;
    }
  };

  const reset = (): void => {
    paintBase();
    tex.needsUpdate = true;
    dirty = false;
  };

  return { markMowed, update, reset };
}
