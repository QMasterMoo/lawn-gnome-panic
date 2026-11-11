import * as THREE from 'three';
import { STORM_OF_DAGGERS_LEVELS } from '../config';
import type { StormOfDaggersLevel, Weapon, WeaponContext } from '../config';

const CAST_RANGE = 12;      // a cast needs some enemy this close to the gnome
const CAST_OFFSET = 4;      // cloud centre, units in front of the gnome
const MAX_CLOUDS = 2;
const RETRY_S = 0.2;
const ORBIT_RATE = 4;       // rad/s
const BOB_MID = 0.8;        // trowels bob between y 0.4 and 1.2
const BOB_AMP = 0.4;
const BOB_RATE = 3;
const HANDLE_OFFSET = 0.16; // handle sits this far behind the blade, along its length

interface Cloud {
  group: THREE.Group;
  blades: THREE.InstancedMesh;
  handles: THREE.InstancedMesh;
  cx: number;
  cz: number;
  radius: number;
  durationS: number;
  tickS: number;
  damage: number;
  count: number;
  fracs: number[];   // per trowel: orbit radius as a fraction of the cloud radius, 0.3..1.0
  age: number;
  tickTimer: number;
}

function dist2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function removeCloud(scene: THREE.Scene, cloud: Cloud): void {
  scene.remove(cloud.group);
  cloud.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.geometry.dispose();
      const mat = mesh.material;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
    }
  });
}

/** Rewrites every trowel's matrix for the cloud's current age. */
function placeTrowels(cloud: Cloud, dummy: THREE.Object3D): void {
  for (let i = 0; i < cloud.count; i++) {
    const base = (i / cloud.count) * Math.PI * 2;
    const a = base + ORBIT_RATE * cloud.age;
    const r = cloud.radius * (0.3 + 0.7 * cloud.fracs[i]);
    const x = cloud.cx + Math.cos(a) * r;
    const z = cloud.cz + Math.sin(a) * r;
    const y = BOB_MID + BOB_AMP * Math.sin(BOB_RATE * cloud.age + i);
    const yaw = -a; // blade long axis runs along the orbit tangent

    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    cloud.blades.setMatrixAt(i, dummy.matrix);

    // Handle: local (0, 0, -HANDLE_OFFSET) rotated by yaw
    dummy.position.set(
      x + Math.sin(yaw) * -HANDLE_OFFSET,
      y,
      z + Math.cos(yaw) * -HANDLE_OFFSET,
    );
    dummy.updateMatrix();
    cloud.handles.setMatrixAt(i, dummy.matrix);
  }
  cloud.blades.instanceMatrix.needsUpdate = true;
  cloud.handles.instanceMatrix.needsUpdate = true;
}

function makeCloud(scene: THREE.Scene, cx: number, cz: number, L: StormOfDaggersLevel, dummy: THREE.Object3D): Cloud {
  const group = new THREE.Group();

  const bladeGeo = new THREE.BoxGeometry(0.12, 0.02, 0.22);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c8 });
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, L.trowelCount);

  const handleGeo = new THREE.BoxGeometry(0.05, 0.03, 0.1);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x3e7d3a });
  const handles = new THREE.InstancedMesh(handleGeo, handleMat, L.trowelCount);

  blades.frustumCulled = false;
  handles.frustumCulled = false;

  const ringGeo = new THREE.RingGeometry(L.radius * 0.85, L.radius, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x9ad0ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.05, cz);

  group.add(blades, handles, ring);
  scene.add(group);

  const fracs: number[] = [];
  for (let i = 0; i < L.trowelCount; i++) fracs.push((i * 0.618034) % 1);

  const cloud: Cloud = {
    group,
    blades,
    handles,
    cx,
    cz,
    radius: L.radius,
    durationS: L.durationS,
    tickS: L.tickS,
    damage: L.damage,
    count: L.trowelCount,
    fracs,
    age: 0,
    tickTimer: L.tickS,
  };
  placeTrowels(cloud, dummy);
  return cloud;
}

export function createStormOfDaggers(scene: THREE.Scene): Weapon {
  let level = 1;
  let timer = 1;
  const clouds: Cloud[] = [];
  const dummy = new THREE.Object3D();
  const levelStats = () => STORM_OF_DAGGERS_LEVELS[level - 1];

  return {
    id: 'stormOfDaggers',
    setLevel(l: number) {
      level = Math.min(STORM_OF_DAGGERS_LEVELS.length, Math.max(1, Math.round(l)));
    },
    update(ctx: WeaponContext) {
      for (let i = clouds.length - 1; i >= 0; i--) {
        const c = clouds[i];
        c.age += ctx.dt;
        c.tickTimer -= ctx.dt;
        if (c.tickTimer <= 0) {
          c.tickTimer += c.tickS;
          for (const e of ctx.enemies) {
            if (dist2D({ x: c.cx, z: c.cz }, e.pos) < c.radius + e.radius) {
              ctx.damage(e.id, c.damage * ctx.stats.damageMult);
            }
          }
        }
        if (c.age >= c.durationS) {
          removeCloud(scene, c);
          clouds.splice(i, 1);
          continue;
        }
        placeTrowels(c, dummy);
      }

      timer -= ctx.dt;
      if (timer > 0) return;

      const L = levelStats();
      if (!ctx.enemies.some((e) => dist2D(ctx.player, e.pos) < CAST_RANGE)) {
        timer = RETRY_S;
        return;
      }
      if (clouds.length >= MAX_CLOUDS) {
        timer = RETRY_S;
        return;
      }

      const cx = ctx.player.x + Math.sin(ctx.facing) * CAST_OFFSET;
      const cz = ctx.player.z + Math.cos(ctx.facing) * CAST_OFFSET;
      clouds.push(makeCloud(scene, cx, cz, L, dummy));
      ctx.playSfx('shoot');
      timer = L.cooldownS * ctx.stats.cooldownMult;
    },
    dispose() {
      for (const c of clouds) removeCloud(scene, c);
      clouds.length = 0;
    },
  };
}
