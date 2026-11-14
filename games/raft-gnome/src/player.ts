// Gnome movement, jumping, collision with the raft and the third-person mouse-look camera.
import * as THREE from 'three';
import { CHARACTERS, KEYS, RAFT_TOP, TILE_SIZE, TOOLS, TUNING, type Ctx, type System } from './config';
import { createGnomeModel } from './gnome';
import { isWalkable, tileAt } from './rules';

/** Pitch limits in radians (slightly below flat, up to looking down steeply). */
const PITCH_MIN = -0.15;
const PITCH_MAX = 1.2;
/** How fast the gnome turns to face its walking direction (per second, exponential). */
const TURN_RATE = 12;
/** Collision probe: a step is checked this far ahead of the gnome. */
const WALL_MARGIN = 0.3;
/** Height the gnome is raised by while sitting on the riding mower. */
const RIDING_SEAT_Y = 0.55;
/** Camera: look-at point above the feet, and the lowest the camera may go. */
const CAMERA_TARGET_HEIGHT = 1.2;
const CAMERA_MIN_Y = 0.5;
/** Title screen orbit around the raft. */
const TITLE_CENTER_X = 1;
const TITLE_CENTER_Z = 1;
const TITLE_RADIUS = 12;
const TITLE_HEIGHT = 6;
const TITLE_SPEED = 0.1;
const TITLE_LOOK_Y = 0.5;
/** Camera zoom: how fast the distance catches up with the wheel target (per second, exponential). */
const ZOOM_RATE = 10;
const ZOOM_WHEEL_STEP = 0.01;
/** Grass puffs under the feet while running. */
const PUFF_MAX = 40;
const PUFF_INTERVAL = 0.12;
const PUFF_LIFE = 0.4;
const PUFF_RISE = 0.3;
const PUFF_SIZE = 0.06;
const PUFF_PER_STEP = 3;
const PUFF_RUN_SPEED = 3;
const PUFF_SPREAD = 0.3;
const PUFF_GRASS = 0x5fae3c;
const PUFF_SAND = 0xe8d29a;

interface Puff {
  mesh: THREE.Mesh;
  active: boolean;
  age: number;
  baseX: number;
  baseY: number;
  baseZ: number;
}

export function createPlayer(ctx: Ctx): System {
  const { camera, input } = ctx;
  const model = createGnomeModel(CHARACTERS.gnorman.look);
  ctx.scene.add(model.object);

  let yaw = 0;
  let pitch = 0.35;
  let elapsed = 0;
  let zoomTarget: number = TUNING.cameraDistance;
  let distance: number = TUNING.cameraDistance;
  let puffTimer = 0;

  // Pooled grass puff meshes: each step takes PUFF_PER_STEP of them, and they are hidden when done.
  const puffGeo = new THREE.BoxGeometry(PUFF_SIZE, PUFF_SIZE, PUFF_SIZE);
  const grassMat = new THREE.MeshStandardMaterial({ color: PUFF_GRASS });
  const sandMat = new THREE.MeshStandardMaterial({ color: PUFF_SAND });
  const puffs: Puff[] = [];
  for (let i = 0; i < PUFF_MAX; i++) {
    const mesh = new THREE.Mesh(puffGeo, grassMat);
    mesh.visible = false;
    ctx.scene.add(mesh);
    puffs.push({ mesh, active: false, age: 0, baseX: 0, baseY: 0, baseZ: 0 });
  }

  const spawnPuffs = (x: number, y: number, z: number, mat: THREE.Material): void => {
    for (let k = 0; k < PUFF_PER_STEP; k++) {
      const puff = puffs.find((q) => !q.active);
      if (!puff) return;
      puff.active = true;
      puff.age = 0;
      puff.baseX = x + (Math.random() - 0.5) * PUFF_SPREAD;
      puff.baseY = y;
      puff.baseZ = z + (Math.random() - 0.5) * PUFF_SPREAD;
      puff.mesh.material = mat;
      puff.mesh.visible = true;
    }
  };

  const updatePuffs = (dt: number): void => {
    for (const puff of puffs) {
      if (!puff.active) continue;
      puff.age += dt;
      if (puff.age >= PUFF_LIFE) {
        puff.active = false;
        puff.mesh.visible = false;
        continue;
      }
      const t = puff.age / PUFF_LIFE;
      puff.mesh.position.set(puff.baseX, puff.baseY + PUFF_RISE * t, puff.baseZ);
      puff.mesh.scale.setScalar(1 - t);
    }
  };

  return {
    update(dt: number) {
      const s = ctx.state;
      const p = s.player;
      const moving = s.mode === 'play' || s.mode === 'build';
      elapsed += dt;

      // Mouse wheel zoom (not in telescope mode), smoothed toward the target distance.
      if (s.mode === 'play' || s.mode === 'build' || s.mode === 'craft') {
        const next = zoomTarget + input.wheel() * ZOOM_WHEEL_STEP;
        zoomTarget = Math.min(TUNING.zoomMax, Math.max(TUNING.zoomMin, next));
      }
      distance += (zoomTarget - distance) * (1 - Math.exp(-ZOOM_RATE * dt));

      if (s.mode === 'title') {
        const a = elapsed * TITLE_SPEED;
        camera.position.set(
          TITLE_CENTER_X + Math.cos(a) * TITLE_RADIUS,
          TITLE_HEIGHT,
          TITLE_CENTER_Z + Math.sin(a) * TITLE_RADIUS,
        );
        camera.lookAt(TITLE_CENTER_X, TITLE_LOOK_Y, TITLE_CENTER_Z);
      }

      if (moving) {
        // Mouse look only while the pointer is locked.
        if (input.locked()) {
          const { dx, dy } = input.look();
          yaw -= dx * TUNING.mouseSensitivity;
          pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch + dy * TUNING.mouseSensitivity));
        }

        // Walking direction relative to the camera. Right is (-cos yaw, 0, sin yaw), which is the
        // camera's screen-right when looking along forward (sin yaw, 0, cos yaw).
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        const rx = -Math.cos(yaw);
        const rz = Math.sin(yaw);
        const fwd = (input.down(KEYS.forward) ? 1 : 0) - (input.down(KEYS.back) ? 1 : 0);
        const side = (input.down(KEYS.right) ? 1 : 0) - (input.down(KEYS.left) ? 1 : 0);
        let dx = fx * fwd + rx * side;
        let dz = fz * fwd + rz * side;
        const len = Math.hypot(dx, dz);
        if (len > 0) {
          dx /= len;
          dz /= len;
        }

        const sprint = input.down(KEYS.sprint) || input.down('ShiftRight') ? TUNING.sprintMult : 1;
        const speed = TUNING.moveSpeed * TOOLS[s.equipped].speedMult * sprint;
        p.velocity.x = dx * speed;
        p.velocity.z = dz * speed;

        // Turn toward the walking direction along the shortest angle.
        if (len > 0) {
          const target = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(target - p.facing), Math.cos(target - p.facing));
          p.facing += diff * Math.min(1, TURN_RATE * dt);
        }

        // Move one axis at a time; a step is accepted only if the cell ahead is walkable.
        const nx = p.position.x + p.velocity.x * dt;
        if (isWalkable(s, nx + Math.sign(p.velocity.x) * WALL_MARGIN, p.position.z)) {
          p.position.x = nx;
        } else {
          p.velocity.x = 0;
        }
        const nz = p.position.z + p.velocity.z * dt;
        if (isWalkable(s, p.position.x, nz + Math.sign(p.velocity.z) * WALL_MARGIN)) {
          p.position.z = nz;
        } else {
          p.velocity.z = 0;
        }

        if (input.pressed(KEYS.jump) && p.jumpsUsed < 2) {
          p.velocity.y = TUNING.jumpSpeed;
          p.jumpsUsed++;
          p.grounded = false;
        }
      } else {
        // Title, telescope and craft: no walking.
        p.velocity.x = 0;
        p.velocity.z = 0;
      }

      // Gravity and landing.
      if (!p.grounded) {
        p.velocity.y -= TUNING.gravity * dt;
        p.position.y += p.velocity.y * dt;
        if (p.position.y <= RAFT_TOP) {
          p.position.y = RAFT_TOP;
          p.velocity.y = 0;
          p.grounded = true;
          p.jumpsUsed = 0;
        }
      }

      // Safety: standing on something that is no longer walkable (the raft cast off from an island),
      // move to the nearest raft tile.
      if (p.grounded && !isWalkable(s, p.position.x, p.position.z)) {
        let best: { x: number; z: number } | null = null;
        let bestD = Infinity;
        for (const t of s.tiles.values()) {
          const cx = t.i * TILE_SIZE;
          const cz = t.j * TILE_SIZE;
          const d = Math.hypot(cx - p.position.x, cz - p.position.z);
          if (d < bestD) {
            bestD = d;
            best = { x: cx, z: cz };
          }
        }
        if (best) {
          p.position.set(best.x, RAFT_TOP, best.z);
          p.velocity.x = 0;
          p.velocity.z = 0;
        }
      }

      // Grass puffs while running on the raft or on an island (sand).
      const runSpeed = Math.hypot(p.velocity.x, p.velocity.z);
      if (moving && p.grounded && runSpeed > PUFF_RUN_SPEED) {
        puffTimer += dt;
        if (puffTimer >= PUFF_INTERVAL) {
          puffTimer -= PUFF_INTERVAL;
          const onTile = tileAt(s, p.position.x, p.position.z) !== undefined;
          spawnPuffs(p.position.x, p.position.y, p.position.z, onTile ? grassMat : sandMat);
        }
      } else {
        puffTimer = 0;
      }
      updatePuffs(dt);

      // Camera: third-person orbit round the gnome. Telescope mode drives the camera itself.
      if (moving || s.mode === 'craft') {
        const target = new THREE.Vector3(p.position.x, p.position.y + CAMERA_TARGET_HEIGHT, p.position.z);
        const cp = Math.cos(pitch);
        const dist = distance;
        camera.position.set(
          target.x + -Math.sin(yaw) * cp * dist,
          target.y + Math.sin(pitch) * dist,
          target.z + -Math.cos(yaw) * cp * dist,
        );
        if (camera.position.y < CAMERA_MIN_Y) camera.position.y = CAMERA_MIN_Y;
        camera.lookAt(target);
      }

      model.update(p, dt);
      model.object.visible = s.mode !== 'telescope';
      if (s.equipped === 'riding') model.object.position.y += RIDING_SEAT_Y;
    },
  };
}
