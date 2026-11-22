// First-time load Lakitu-style flying intro cutscene across Turfton and its surrounding biomes,
// descending smoothly behind the player gnome at SPAWN. Skipped if already seen or when demo URL flags are set.
import * as THREE from 'three';

const SEEN_KEY = 'gta-intro-seen-v1';

interface TourLeg {
  dur: number;
  from: [number, number, number];
  to: [number, number, number];
  lookFrom: [number, number, number];
  lookTo: [number, number, number];
  caption: string;
}

const LEGS: readonly TourLeg[] = [
  {
    dur: 4.0,
    from: [45, 78, -160],
    to: [28, 42, -10],
    lookFrom: [0, 8, -20],
    lookTo: [45, 10, -25],
    caption: 'WELCOME TO TURFTON — EVERY BLADE OF GRASS IS SPONSORED',
  },
  {
    dur: 3.8,
    from: [28, 42, -10],
    to: [-75, 28, 70],
    lookFrom: [45, 10, -25],
    lookTo: [-90, 5, 80],
    caption: 'MOWERS ARE FOR BORROWING. THE HAT WATCH IS WATCHING.',
  },
  {
    dur: 3.8,
    from: [-75, 28, 70],
    to: [40, 52, 165],
    lookFrom: [-90, 5, 80],
    lookTo: [0, 6, 40],
    caption: 'FIVE BIOMES. ZERO PERMITS. ONE GOLDEN ACORN.',
  },
];

const CSS = `
#gta-intro{position:fixed;inset:0;z-index:50;display:none;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;}
#gta-intro.on{display:block;}
#gta-intro .bar{position:absolute;left:0;right:0;height:min(9vh,56px);background:#000;}
#gta-intro .bar.top{top:0;}
#gta-intro .bar.bot{bottom:0;}
#gta-intro .cap{position:absolute;left:50%;bottom:calc(min(9vh,56px) + 18px);transform:translateX(-50%);padding:8px 18px;border-radius:999px;background:rgba(10,12,16,.78);border:1.5px solid rgba(255,210,63,.7);font-size:clamp(12px,2.8vw,16px);font-weight:800;letter-spacing:.08em;text-align:center;max-width:88vw;color:#ffd23f;}
#gta-intro .skip{position:absolute;right:calc(env(safe-area-inset-right) + 18px);top:calc(env(safe-area-inset-top) + min(9vh,56px) + 14px);min-width:112px;min-height:44px;padding:0 16px;border-radius:999px;border:2px solid rgba(255,255,255,.75);background:rgba(16,18,24,.82);color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer;pointer-events:auto;touch-action:manipulation;}
`;

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createIntroTour(
  ui: HTMLElement,
  hooks: { setUiVisible(v: boolean): void; onDone(): void },
): {
  readonly active: boolean;
  startIfFirstTime(params: URLSearchParams): void;
  update(dt: number, camera: THREE.PerspectiveCamera, target: { x: number; y: number; z: number; yaw: number }): void;
  skip(): void;
} {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'gta-intro';
  root.innerHTML = '<div class="bar top"></div><div class="bar bot"></div><div class="cap"></div><button type="button" class="skip">Skip Intro ▶▶</button>';
  ui.appendChild(root);

  const cap = root.querySelector('.cap') as HTMLElement;
  const skipBtn = root.querySelector('.skip') as HTMLButtonElement;

  let isActive = false;
  let legIdx = 0;
  let legT = 0;
  let savedFov = 62;
  let fovCaptured = false;
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();

  function finish(): void {
    if (!isActive) return;
    isActive = false;
    root.classList.remove('on');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    hooks.setUiVisible(true);
    hooks.onDone();
  }

  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
  window.addEventListener('keydown', (e) => {
    if (isActive && (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      finish();
    }
  });

  return {
    get active() { return isActive; },

    startIfFirstTime(params: URLSearchParams) {
      if (params.has('mount') || params.has('herd') || params.has('pileup') || params.has('no-intro')) return;
      try {
        if (localStorage.getItem(SEEN_KEY) === '1') return;
      } catch {
        return;
      }
      if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
      isActive = true;
      legIdx = 0;
      legT = 0;
      fovCaptured = false;
      root.classList.add('on');
      cap.textContent = LEGS[0].caption;
      hooks.setUiVisible(false);
    },

    update(dt, camera, target) {
      if (!isActive) return;
      if (!fovCaptured) {
        savedFov = camera.fov;
        fovCaptured = true;
      }
      legT += dt;
      // 3 aerial legs + 1 final Lakitu descent behind the player at SPAWN.
      const totalLegs = LEGS.length + 1;
      if (legIdx < LEGS.length) {
        const leg = LEGS[legIdx];
        cap.textContent = leg.caption;
        const u = ease(Math.min(1, legT / leg.dur));
        pos.set(
          leg.from[0] + (leg.to[0] - leg.from[0]) * u,
          leg.from[1] + (leg.to[1] - leg.from[1]) * u,
          leg.from[2] + (leg.to[2] - leg.from[2]) * u,
        );
        look.set(
          leg.lookFrom[0] + (leg.lookTo[0] - leg.lookFrom[0]) * u,
          leg.lookFrom[1] + (leg.lookTo[1] - leg.lookFrom[1]) * u,
          leg.lookFrom[2] + (leg.lookTo[2] - leg.lookFrom[2]) * u,
        );
        if (legT >= leg.dur) {
          legIdx++;
          legT = 0;
        }
      } else if (legIdx < totalLegs) {
        const dur = 3.0;
        cap.textContent = 'MEET PIP POTSWORTH ACROSS THE STREET';
        const u = ease(Math.min(1, legT / dur));
        const last = LEGS[LEGS.length - 1];
        const destX = target.x - Math.sin(target.yaw) * 6.5;
        const destY = target.y + 3.2;
        const destZ = target.z - Math.cos(target.yaw) * 6.5;
        pos.set(
          last.to[0] + (destX - last.to[0]) * u,
          last.to[1] + (destY - last.to[1]) * u,
          last.to[2] + (destZ - last.to[2]) * u,
        );
        look.set(
          last.lookTo[0] + (target.x - last.lookTo[0]) * u,
          last.lookTo[1] + (target.y + 1.0 - last.lookTo[1]) * u,
          last.lookTo[2] + (target.z - last.lookTo[2]) * u,
        );
        if (legT >= dur) {
          camera.fov = savedFov;
          camera.updateProjectionMatrix();
          finish();
          return;
        }
      }
      camera.fov = 56;
      camera.updateProjectionMatrix();
      camera.position.copy(pos);
      camera.lookAt(look);
    },

    skip() {
      finish();
    },
  };
}
