import { heightAt } from './terrain';
// src/player.ts
import * as THREE from 'three';
import { ARENA_HALF, PLAYER_RADIUS, TUNING } from './config';
import type { InputState, Obstacle, PlayerState, PlayerStats } from './config';

export function createPlayerState(stats: PlayerStats): PlayerState {
  return {
    position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3(), facing: 0, grounded: true, jumpsUsed: 0,
    stamina: stats.staminaMax, staminaDelay: 0, sprinting: false, exhausted: false,
  };
}

const CLAMP_LIMIT = ARENA_HALF - PLAYER_RADIUS - 0.3;

export function updatePlayer(p: PlayerState, input: InputState, cameraYaw: number, obstacles: readonly Obstacle[], stats: PlayerStats, dt: number): { jumped: boolean } {
  // 1. Remember height and reset the jump flag.
  const prevY = p.position.y;
  let jumped = false;

  // 2. Wish direction relative to the camera, normalised if longer than 1.
  const fx = Math.sin(cameraYaw);
  const fz = Math.cos(cameraYaw);
  const rx = -Math.cos(cameraYaw);
  const rz = Math.sin(cameraYaw);
  let wx = fx * input.moveY + rx * input.moveX;
  let wz = fz * input.moveY + rz * input.moveX;
  const wLen = Math.hypot(wx, wz);
  if (wLen > 1) {
    wx /= wLen;
    wz /= wLen;
  }

  // 2b. Sprint and stamina.
  const moving = Math.hypot(wx, wz) > 0.1;
  if (p.exhausted && p.stamina >= stats.staminaMax * TUNING.staminaExhaustedResume) p.exhausted = false;
  p.sprinting = input.sprint && moving && !p.exhausted && p.stamina > 0;
  if (p.sprinting) {
    p.stamina = Math.max(0, p.stamina - dt);
    p.staminaDelay = stats.staminaRegenDelayS;
    if (p.stamina <= 0) p.exhausted = true;
  } else if (p.staminaDelay > 0) {
    p.staminaDelay -= dt;
  } else {
    p.stamina = Math.min(stats.staminaMax, p.stamina + stats.staminaRegenPerSec * dt);
  }
  const speed = stats.moveSpeed * (p.sprinting ? stats.sprintMultiplier : 1);

  // 3. Horizontal acceleration toward the wished velocity.
  const targetX = wx * speed;
  const targetZ = wz * speed;
  let dvx = targetX - p.velocity.x;
  let dvz = targetZ - p.velocity.z;
  const maxStep = TUNING.accel * dt * (p.grounded ? 1 : TUNING.airControl);
  const dvLen = Math.hypot(dvx, dvz);
  if (dvLen > maxStep) {
    const s = maxStep / dvLen;
    dvx *= s;
    dvz *= s;
  }
  p.velocity.x += dvx;
  p.velocity.z += dvz;

  // 4. Turn the facing toward the movement direction.
  if (Math.hypot(wx, wz) > 0.1) {
    const desired = Math.atan2(wx, wz);
    let diff = desired - p.facing;
    diff = ((diff + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const maxTurn = TUNING.turnSpeed * dt;
    p.facing += Math.max(-maxTurn, Math.min(maxTurn, diff));
  }

  // 5. Jump (ground jump or air jump).
  if (input.jump && p.jumpsUsed < stats.maxJumps) {
    p.velocity.y = stats.jumpSpeed;
    p.jumpsUsed += 1;
    p.grounded = false;
    jumped = true;
  }

  // 6. Gravity and integrate position.
  p.velocity.y -= TUNING.gravity * dt;
  p.position.addScaledVector(p.velocity, dt);

  // 7. Obstacles: stand on top, or get pushed out of the sides.
  // The lawn has hills: the floor is the terrain, and obstacle tops sit on the terrain under them.
  let groundHeight = heightAt(p.position.x, p.position.z);
  for (const o of obstacles) {
    const ox = p.position.x - o.x;
    const oz = p.position.z - o.z;
    const d = Math.hypot(ox, oz);
    const top = heightAt(o.x, o.z) + o.height;
    if (d < o.radius && prevY >= top - 0.05) {
      groundHeight = Math.max(groundHeight, top);
    } else if (d < o.radius + PLAYER_RADIUS && p.position.y < top) {
      let nx = 1;
      let nz = 0;
      if (d >= 1e-4) {
        nx = ox / d;
        nz = oz / d;
      }
      const pushDist = o.radius + PLAYER_RADIUS;
      p.position.x = o.x + nx * pushDist;
      p.position.z = o.z + nz * pushDist;
      const dot = p.velocity.x * nx + p.velocity.z * nz;
      if (dot < 0) {
        p.velocity.x -= nx * dot;
        p.velocity.z -= nz * dot;
      }
    }
  }

  // 8. Ground contact.
  // Snap down slopes too (within a small step), so walking downhill is not a series of tiny falls.
  const onSlope = p.grounded && p.position.y - groundHeight < 0.6;
  if ((p.position.y <= groundHeight || onSlope) && p.velocity.y <= 0) {
    p.position.y = groundHeight;
    p.velocity.y = 0;
    p.grounded = true;
    p.jumpsUsed = 0;
  } else if (p.grounded) {
    // Walked off an edge: one air jump remains.
    p.grounded = false;
    if (p.jumpsUsed === 0) p.jumpsUsed = 1;
  }

  // 9. Keep inside the arena.
  if (p.position.x > CLAMP_LIMIT || p.position.x < -CLAMP_LIMIT) {
    p.position.x = Math.sign(p.position.x) * CLAMP_LIMIT;
    p.velocity.x = 0;
  }
  if (p.position.z > CLAMP_LIMIT || p.position.z < -CLAMP_LIMIT) {
    p.position.z = Math.sign(p.position.z) * CLAMP_LIMIT;
    p.velocity.z = 0;
  }

  // 10. Report.
  return { jumped };
}
