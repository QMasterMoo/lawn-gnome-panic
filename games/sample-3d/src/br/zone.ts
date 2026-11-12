import * as THREE from 'three';
import { ARENA_HALF, TUNING, type ZoneState, type ZoneSystem } from '../config';

/** Small seeded PRNG (mulberry32). Returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 64x64 tile of diagonal orange stripes on a transparent background. */
function makeStripeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 64, 64);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ff6d00';
  // Stripes of width 16 every 32px along the top edge, sliding 64px over the tile height.
  // Period 64 horizontally and vertically, so the tile wraps seamlessly.
  for (let o = -96; o <= 96; o += 32) {
    ctx.beginPath();
    ctx.moveTo(o, 0);
    ctx.lineTo(o + 16, 0);
    ctx.lineTo(o + 80, 64);
    ctx.lineTo(o + 64, 64);
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

/** The shrinking safe circle ("THE MOW ZONE" is everything outside it). */
export function createZone(scene: THREE.Scene): ZoneSystem {
  const s: ZoneState = { cx: 0, cz: 0, radius: TUNING.zoneStartRadius, nextRadius: TUNING.zoneStartRadius, phase: 'waiting', secondsToNext: 0 };

  // Internal schedule. Times are on the match clock (elapsedS).
  let rng = mulberry32(Math.floor(Math.random() * 4294967296));
  let nextCx = 0;          // centre the coming shrink ends on
  let nextCz = 0;
  let nextAt = 0;          // when the next shrink starts (phase 'waiting')
  let shrinkStartT = 0;    // shrink window (phase 'shrinking')
  let shrinkEndT = 0;
  let startCx = 0;         // circle at the moment the shrink started
  let startCz = 0;
  let startR = 0;

  // Visuals.
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const texture = new THREE.CanvasTexture(makeStripeCanvas());
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const wallMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 128, 1, true), wallMat);
  group.add(wall);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.985, 1, 128),
    new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true, fog: false, depthTest: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 5;
  group.add(ring);

  let repeatRadius = -1;

  function applyVisuals(dt: number) {
    if (s.radius !== repeatRadius) {
      repeatRadius = s.radius;
      texture.repeat.set(s.radius / 4, 12);
    }
    texture.offset.x += dt * 0.05;

    wall.position.set(s.cx, 30, s.cz);
    wall.scale.set(s.radius, 60, s.radius);

    ring.visible = s.phase === 'waiting';
    ring.position.set(nextCx, 0.06, nextCz);
    // Ring lies flat (rotated about X), so local x/y scale the world x/z plane.
    ring.scale.set(s.nextRadius, s.nextRadius, 1);
  }

  /** Picks the next target radius and centre. Called at the start of each wait. */
  function prepareNext() {
    const nextRadius = Math.max(TUNING.zoneFinalRadius, s.radius * TUNING.zoneShrinkFactor);
    const dist = rng() * Math.max(0, s.radius - nextRadius);
    const dir = rng() * Math.PI * 2;
    const lim = ARENA_HALF - nextRadius;
    nextCx = clamp(s.cx + Math.cos(dir) * dist, -lim, lim);
    nextCz = clamp(s.cz + Math.sin(dir) * dist, -lim, lim);
    s.nextRadius = nextRadius;
  }

  function startShrink() {
    s.phase = 'shrinking';
    startCx = s.cx;
    startCz = s.cz;
    startR = s.radius;
    shrinkStartT = nextAt;
    shrinkEndT = nextAt + TUNING.zoneShrinkS;
  }

  function finishShrink() {
    s.cx = nextCx;
    s.cz = nextCz;
    s.radius = s.nextRadius;
    if (s.radius <= TUNING.zoneFinalRadius) {
      s.phase = 'final';
      s.nextRadius = s.radius;
      nextCx = s.cx;
      nextCz = s.cz;
    } else {
      s.phase = 'waiting';
      nextAt = shrinkEndT + TUNING.zoneHoldS;
      prepareNext();
    }
  }

  function reset(seed?: number) {
    rng = mulberry32(seed ?? Math.floor(Math.random() * 4294967296));
    s.cx = 0;
    s.cz = 0;
    s.radius = TUNING.zoneStartRadius;
    s.phase = 'waiting';
    s.secondsToNext = 0;
    nextAt = TUNING.zoneFirstDelayS;
    prepareNext();
  }

  reset();

  return {
    update(dt: number, elapsedS: number) {
      // Advance through as many transitions as the clock has passed (handles large dt).
      for (;;) {
        if (s.phase === 'waiting' && elapsedS >= nextAt) {
          startShrink();
        } else if (s.phase === 'shrinking' && elapsedS >= shrinkEndT) {
          finishShrink();
        } else {
          break;
        }
      }

      if (s.phase === 'shrinking') {
        const span = shrinkEndT - shrinkStartT;
        const t = span > 0 ? clamp((elapsedS - shrinkStartT) / span, 0, 1) : 1;
        const e = smoothstep(t);
        s.cx = startCx + (nextCx - startCx) * e;
        s.cz = startCz + (nextCz - startCz) * e;
        s.radius = startR + (s.nextRadius - startR) * e;
        s.secondsToNext = Math.max(0, shrinkEndT - elapsedS);
      } else if (s.phase === 'waiting') {
        s.secondsToNext = Math.max(0, nextAt - elapsedS);
      } else {
        s.secondsToNext = 0;
      }

      applyVisuals(dt);
      return s;
    },
    state() {
      return s;
    },
    isOutside(x: number, z: number) {
      return Math.hypot(x - s.cx, z - s.cz) > s.radius;
    },
    setVisible(visible: boolean) {
      group.visible = visible;
    },
    reset(seed?: number) {
      reset(seed);
      applyVisuals(0);
    },
  };
}
