// Cutscenes: silent wanted-poster contracts (Don Compost) AND speaking character scenes across Turfton's story rooms,
// with @lawn/mutter voice blips, bottom-third subtitle cards, and optional late-night John Bodega & Asphalt cameos.
import * as THREE from 'three';
import { buildHeld, buildPrefab } from '@lawn/prefabs';
import type { GnomeLook, GnomeModel } from '@lawn/gnome';
import { createMutter } from '@lawn/mutter';
import { gnomeState, makeGnome } from '../gnomes';
import type { CutsceneHandle, CutsceneRequest, CutsceneRoom, DialogueLine } from './types';

export type { CutsceneRequest };

type V3 = [number, number, number];
/** A camera move: from -> to over `dur` seconds, always looking at `look`; `act` is what the actors do; `icon` the bubble. */
interface Shot { dur: number; from: V3; to: V3; look: V3; act?: 'lean' | 'posters' | 'point'; icon?: string }

export type Cutscene = CutsceneHandle;

/** The stage is built here, far outside the map. */
const ORIGIN = new THREE.Vector3(3000, 0, 3000);
const BODEGA_OFFSET = new THREE.Vector3(30, 0, 0);
const DARK = 0x0a0608;

const BOSS_LOOK: GnomeLook = {
  hat: 0x141414, shirt: 0xf4f1e6, pants: 0xf4f1e6, skin: 0xf1c27d, boots: 0x000000, beard: 0x9a9a9a,
  hair: null, freckles: false, dress: false, glasses: true, bowlCut: null,
};
const GUARD_LOOK: GnomeLook = {
  hat: 0x222226, shirt: 0x1c1c22, pants: 0x15151a, skin: 0xe0ac69, boots: 0x000000, beard: null,
  hair: null, freckles: false, dress: false, glasses: true, bowlCut: null,
};
const BASE_SPEAKER_LOOK: GnomeLook = {
  hat: 0xd93636, shirt: 0x2f8a4a, pants: 0x4b3a2a, skin: 0xf1c27d, boots: 0x222222, beard: 0xdddddd,
  hair: null, freckles: false, dress: false, glasses: false, bowlCut: null,
};

interface CharacterPreset {
  look: Partial<GnomeLook>;
  hz: number;
  held?: string;
  scale?: number;
}

const CHARACTER_PRESETS: Record<string, CharacterPreset> = {
  pip: { look: { hat: 0xc82828, shirt: 0x2f6b3a, pants: 0x3b2f24, beard: 0x6b4423, freckles: true }, hz: 126, scale: 1.38 },
  tansy: { look: { hat: 0xf08a24, shirt: 0x2f353d, pants: 0x23384d, beard: null, glasses: true, hair: { color: 0x6b3a1e, style: 'pigtails' } }, hz: 118, held: 'leaf-blower-cannon', scale: 1.42 },
  vesper: { look: { hat: 0x141418, shirt: 0xf8f8fa, pants: 0xf8f8fa, skin: 0xfafafa, beard: null, glasses: true }, hz: 92, held: 'brass-calipers', scale: 1.5 },
  granny: { look: { hat: 0x8e44ad, shirt: 0x7a4f7d, dress: true, beard: null, glasses: true, hair: { color: 0xdedede, style: 'pigtails' } }, hz: 132, held: 'gta-shotgun', scale: 1.44 },
  diggs: { look: { hat: 0x4b6329, shirt: 0x556b2f, pants: 0x384620, beard: 0x5c3e24 }, hz: 80, held: 'gta-rifle', scale: 1.52 },
  bracken: { look: { hat: 0x2e6f40, shirt: 0x4b3522, pants: 0x2f2519, beard: 0xd9d9d2 }, hz: 76, held: 'stopping-stone', scale: 1.48 },
  loam: { look: { hat: 0x9ec6de, shirt: 0x3c5266, pants: 0x283642, beard: 0xeeeeee, glasses: true }, hz: 84, held: 'porcelain-lantern', scale: 1.46 },
  bodega: { look: { hat: 0x7c4a2d, shirt: 0x3b7a57, beard: 0x8b5a2b }, hz: 88, scale: 1.42 },
  juniper: { look: { hat: 0x2f5a8f, shirt: 0x243447, pants: 0x1d2733, beard: null, glasses: true, hair: { color: 0x4a2f22, style: 'pigtails' } }, hz: 116, scale: 1.44 },
  reginald: { look: { hat: 0x18181e, shirt: 0xc9b99b, pants: 0x3a3228, beard: 0x9e9e9e, glasses: true }, hz: 96, held: 'brass-calipers', scale: 1.45 },
  sorrel: { look: { hat: 0x4f7a5a, shirt: 0x6d5c4d, beard: null, hair: { color: 0x7d4c2a, style: 'pigtails' } }, hz: 122, scale: 1.4 },
  clara: { look: { hat: 0xf6f6fa, shirt: 0xe6e8f0, skin: 0xfafafa, dress: true, beard: null }, hz: 134, held: 'porcelain-lantern', scale: 1.4 },
  brenda: { look: { hat: 0xd4a04a, shirt: 0xb84a7a, dress: true, beard: null, glasses: true }, hz: 112, scale: 1.48 },
  'big lou': { look: { hat: 0x18181e, shirt: 0x23262e, pants: 0x141418, beard: 0x222222, glasses: true }, hz: 78, scale: 1.56 },
  mossley: { look: { hat: 0x3b6ea5, shirt: 0x7c6a53, beard: 0xb8b0a0, glasses: true }, hz: 118, scale: 1.42 },
  burt: { look: { hat: 0x4b5563, shirt: 0xc9b99b, beard: 0x6b6b6b, glasses: true }, hz: 102, scale: 1.44 },
  driftwood: { look: { hat: 0x4f9d92, shirt: 0xd9c79e, beard: 0xe5e0d4 }, hz: 94, scale: 1.44 },
  cedric: { look: { hat: 0x8e44ad, shirt: 0x5b3b24, beard: 0x3a2a1d }, hz: 114, scale: 1.44 },
  bramble: { look: { hat: 0x8b5a2b, shirt: 0x4a6b3b, beard: 0xc4b8a4 }, hz: 100, scale: 1.46 },
  shelldon: { look: { hat: 0x7a8a78, shirt: 0x3f4740, beard: null, glasses: true }, hz: 110, scale: 1.4 },
  wally: { look: { hat: 0x6b4a2e, shirt: 0xc2a878, beard: 0xd9d9d9, glasses: true }, hz: 96, scale: 1.42 },
};

const ROOM_THEMES: Record<CutsceneRoom, { floor: number; wall: number; trim: number; ceiling: number; bg: number; light: number }> = {
  'mulch-club': { floor: 0x2a1810, wall: 0x4a1218, trim: 0xc9a227, ceiling: 0x1a0a0c, bg: 0x0a0608, light: 0xffc27a },
  'side-valve': { floor: 0x2c2f33, wall: 0x444b52, trim: 0xf08a24, ceiling: 0x1f2326, bg: 0x111417, light: 0xffd28a },
  'cloverfield-barn': { floor: 0x4b3621, wall: 0x7a2b20, trim: 0xd9c28a, ceiling: 0x321c12, bg: 0x1a110b, light: 0xffe0a8 },
  'unmowed-hollow': { floor: 0x254024, wall: 0x1f3620, trim: 0x76b041, ceiling: 0x122214, bg: 0x0d190f, light: 0xbef29c },
  'fells-shrine': { floor: 0xc9dbe6, wall: 0x5b7083, trim: 0x7cf0ff, ceiling: 0x2c3b4a, bg: 0x14202b, light: 0xb8ecff },
  'dust-overlook': { floor: 0xb98d56, wall: 0x8d6338, trim: 0xffd23f, ceiling: 0x543a1e, bg: 0x281b0e, light: 0xffd78a },
  street: { floor: 0x3b3f45, wall: 0x2d3238, trim: 0xffd23f, ceiling: 0x1a1e24, bg: 0x121722, light: 0xdbe9ff },
};

const FADE = 0.7;
/** The boss's armchair stands on a dais so he looks over the desk. */
const DAIS = 0.3;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp3 = (a: V3, b: V3, t: number, out: THREE.Vector3): THREE.Vector3 =>
  out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t).add(ORIGIN);

/** Shots for a contract: establish the room, the boss, the posters going down one by one, then the point. */
function contractShots(targets: number): Shot[] {
  const posterTime = 1.2 * targets + 0.8;
  return [
    { dur: 3.4, from: [0, 1.8, 6], to: [0, 1.5, 3.4], look: [0, 1.35, -3.4] },
    { dur: 3.0, from: [1.6, 1.2, -0.2], to: [0.7, 1.5, -1.2], look: [0, 1.65, -3.3], act: 'lean' },
    { dur: posterTime, from: [0, 2.6, -0.4], to: [0, 1.9, -1.0], look: [0, 0.8, -1.8], act: 'posters', icon: '🎯' },
    { dur: 3.0, from: [-1.3, 1.3, -0.8], to: [-0.5, 1.6, -1.5], look: [0, 1.65, -3.3], act: 'point', icon: '💰' },
  ];
}

/** Resolve speaker look, pitch, optional held prop, and scale from character preset + line override. */
function speakerLookAndHz(line: DialogueLine): { look: GnomeLook; hz: number; held?: string; scale: number } {
  const lower = line.speaker.toLowerCase();
  let preset: CharacterPreset | undefined;
  for (const [k, v] of Object.entries(CHARACTER_PRESETS)) {
    if (lower.includes(k)) { preset = v; break; }
  }
  return {
    look: { ...BASE_SPEAKER_LOOK, ...(preset?.look ?? {}), ...(line.look ?? {}) },
    hz: line.hz ?? preset?.hz ?? 100,
    held: preset?.held,
    scale: preset?.scale ?? 1.45,
  };
}

/** A wanted poster picture for a target: paper, the face, the hat and beard in its colours, a red cross. */
function posterTexture(look: GnomeLook, name: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 168;
  const g = cv.getContext('2d');
  if (g) {
    const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
    g.fillStyle = '#e6d6a2';
    g.fillRect(0, 0, 128, 168);
    g.strokeStyle = '#7a5a2a';
    g.lineWidth = 5;
    g.strokeRect(5, 5, 118, 158);
    g.fillStyle = '#5a2a14';
    g.font = '700 15px system-ui,sans-serif';
    g.textAlign = 'center';
    g.fillText('WANTED', 64, 26);
    if (look.beard !== null) {
      g.fillStyle = css(look.beard);
      g.beginPath(); g.ellipse(64, 104, 26, 30, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = css(look.skin);
    g.beginPath(); g.ellipse(64, 84, 22, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = css(look.hat);
    g.beginPath(); g.moveTo(36, 72); g.lineTo(92, 72); g.lineTo(64, 30); g.closePath(); g.fill();
    g.fillStyle = '#222';
    if (look.glasses) { g.fillRect(48, 80, 14, 7); g.fillRect(66, 80, 14, 7); g.fillRect(62, 82, 4, 2); }
    else { g.beginPath(); g.arc(55, 84, 2.5, 0, Math.PI * 2); g.arc(73, 84, 2.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#5a2a14';
    g.font = '700 11px system-ui,sans-serif';
    g.fillText(name.toUpperCase(), 64, 152, 110);
    g.strokeStyle = 'rgba(200,30,30,0.9)';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(28, 52); g.lineTo(100, 130); g.moveTo(100, 52); g.lineTo(28, 130); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Build `id`, scale it so its widest side (or height) is `size`, stand it on the floor, return it with its top height. */
function fit(id: string, size: number, by: 'w' | 'h'): { obj: THREE.Group; top: number } {
  const obj = buildPrefab(id, { lights: false });
  const bb = new THREE.Box3().setFromObject(obj);
  const dim = by === 'h' ? bb.max.y - bb.min.y : Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
  const k = dim > 0 ? size / dim : 1;
  obj.scale.setScalar(k);
  return { obj, top: (bb.max.y - bb.min.y) * k };
}

export function createCutscene(scene: THREE.Scene, ui: HTMLElement, hooks: { setUiVisible(v: boolean): void }): Cutscene {
  const voice = createMutter({ gain: () => 0.22 });
  const unlockVoice = (): void => voice.unlock();
  window.addEventListener('pointerdown', unlockVoice);
  window.addEventListener('keydown', unlockVoice);

  // ---- Overlay: letterbox bars, title card, subtitle box, fade, icon bubble, next/skip buttons ---------------------
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:60;display:none;pointer-events:auto;font-family:system-ui,sans-serif;';
  const bar = (top: boolean): HTMLDivElement => {
    const b = document.createElement('div');
    b.style.cssText = `position:absolute;left:0;right:0;${top ? 'top' : 'bottom'}:0;height:11vh;background:#000;`;
    return b;
  };
  const fade = document.createElement('div');
  fade.style.cssText = 'position:absolute;inset:0;background:#000;opacity:1;pointer-events:none;';
  const icon = document.createElement('div');
  icon.style.cssText = 'position:absolute;left:50%;bottom:16vh;transform:translateX(-50%);font-size:min(22vw,120px);line-height:1;filter:drop-shadow(0 4px 8px rgba(0,0,0,.7));display:none;';

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'position:absolute;top:max(14vh,calc(env(safe-area-inset-top) + 12px));left:50%;transform:translateX(-50%);padding:6px 16px;border-radius:999px;background:rgba(0,0,0,.72);border:1px solid rgba(255,210,63,.55);color:#ffd23f;font:800 13px/1.2 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;display:none;white-space:nowrap;';

  const subBox = document.createElement('div');
  subBox.style.cssText = 'position:absolute;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:calc(11vh + max(10px,env(safe-area-inset-bottom)));max-width:720px;margin:0 auto;padding:12px 16px;border-radius:14px;background:rgba(12,14,18,.84);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 24px rgba(0,0,0,.55);display:none;';
  const subHead = document.createElement('div');
  subHead.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;';
  const subSpeaker = document.createElement('div');
  subSpeaker.style.cssText = 'color:#ffd23f;font:800 15px/1.2 system-ui,sans-serif;letter-spacing:.02em;';
  const subBadge = document.createElement('span');
  subBadge.style.cssText = 'font-size:18px;line-height:1;';
  subHead.append(subSpeaker, subBadge);
  const subText = document.createElement('div');
  subText.style.cssText = 'color:#f5f7fa;font:500 15px/1.45 system-ui,sans-serif;margin-bottom:10px;';
  const subActions = document.createElement('div');
  subActions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.textContent = 'Next ▶';
  nextBtn.style.cssText = 'min-width:96px;min-height:44px;padding:8px 16px;border-radius:999px;border:2px solid #ffd23f;background:rgba(255,210,63,.18);color:#ffd23f;font:700 14px system-ui,sans-serif;cursor:pointer;';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.textContent = 'Skip ▶▶';
  skipBtn.style.cssText = 'min-width:96px;min-height:44px;padding:8px 16px;border-radius:999px;border:2px solid rgba(255,255,255,.65);background:rgba(0,0,0,.55);color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer;';

  const contractSkipBtn = document.createElement('button');
  contractSkipBtn.type = 'button';
  contractSkipBtn.textContent = 'Skip ▶';
  contractSkipBtn.style.cssText = 'position:absolute;right:max(18px,env(safe-area-inset-right));bottom:calc(12vh + 12px);min-width:88px;min-height:44px;padding:8px 16px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:rgba(0,0,0,.55);color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer;';

  subActions.append(nextBtn, skipBtn);
  subBox.append(subHead, subText, subActions);
  overlay.append(bar(true), bar(false), titleEl, icon, subBox, contractSkipBtn, fade);
  ui.append(overlay);

  // ---- Staging state ----------------------------------------------------------------------------------------------
  let stage: THREE.Group | null = null;
  const lightsSaved: { l: THREE.Light; i: number }[] = [];
  let savedBg: THREE.Scene['background'] = null;
  let savedFog: THREE.Scene['fog'] = null;
  let savedFov = 60;
  let mode: 'contract' | 'dialogue' = 'contract';
  let shots: Shot[] = [];
  let dialogueLines: DialogueLine[] = [];
  let lineIdx = 0;
  let lineT = 0;
  let lineDur = 3.5;
  let phase: 'off' | 'in' | 'play' | 'out' | 'after' = 'off';
  let phaseT = 0;
  let shotIdx = 0;
  let shotT = 0;
  let onDone: (() => void) | null = null;
  let boss: GnomeModel | null = null;
  let guards: GnomeModel[] = [];
  let speakerModel: GnomeModel | null = null;
  let bodegaKeeper: GnomeModel | null = null;
  let asphaltCat: THREE.Group | null = null;
  let posters: { mesh: THREE.Mesh; rest: THREE.Vector3; at: number }[] = [];
  let clock = 0;
  let seatY = 0.5;
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function buildRoomShell(g: THREE.Group, room: CutsceneRoom): void {
    const theme = ROOM_THEMES[room] ?? ROOM_THEMES['mulch-club'];
    const outdoor = room === 'street' || room === 'unmowed-hollow' || room === 'dust-overlook' || room === 'fells-shrine';
    const mat = (c: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
      m.position.set(x, y, z);
      m.receiveShadow = true;
      g.add(m);
    };
    box(16, 0.1, 15, 0, -0.05, 0, theme.floor);
    if (!outdoor) {
      box(14, 4.2, 0.2, 0, 2.1, -6.6, theme.wall);
      box(0.2, 4.2, 13, -7.1, 2.1, 0, theme.wall);
      box(0.2, 4.2, 13, 7.1, 2.1, 0, theme.wall);
      box(14, 0.2, 13, 0, 4.3, 0, theme.ceiling);
      box(14, 0.12, 0.2, 0, 0.3, -6.45, theme.trim);
    }

    const lampLight = new THREE.PointLight(theme.light, 18, 22, 1.4);
    lampLight.position.set(-2.2, 2.8, -1.6);
    g.add(lampLight);
    const spot = new THREE.SpotLight(0xffe8c2, 30, 16, 0.55, 0.6, 1.4);
    spot.position.set(0, 4.2, -1.0);
    spot.target.position.set(0, 1, -3.2);
    g.add(spot, spot.target);
  }

  function buildThemedSet(g: THREE.Group, room: CutsceneRoom): void {
    const prop = (id: string, size: number, by: 'w' | 'h', x: number, y: number, z: number, yaw = 0): void => {
      const built = fit(id, size, by);
      built.obj.position.set(x, y, z);
      built.obj.rotation.y = yaw;
      g.add(built.obj);
    };
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number, emissive = 0): void => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, emissive }),
      );
      m.position.set(x, y, z);
      g.add(m);
    };

    if (room === 'side-valve') {
      // Corrugated roll-up bay slats, orange trim, Black Dew barrels, wheelbarrow, workbench.
      for (let i = 0; i < 6; i++) box(5.4, 0.28, 0.14, 0, 0.5 + i * 0.42, -6.38, i % 2 === 0 ? 0x5c646d : 0x4a5159);
      box(5.8, 0.14, 0.2, 0, 3.1, -6.35, 0xf08a24, 0x5a2e04);
      prop('table', 2.4, 'w', 1.9, 0, -2.6, -0.2);
      prop('gta-dew-barrel', 1.1, 'h', -2.3, 0, -3.8, 0.4);
      prop('gta-dew-barrel', 1.1, 'h', -3.1, 0, -3.2, -0.3);
      prop('wheelbarrow', 2.0, 'w', 3.0, 0, -4.4, -0.7);
    } else if (room === 'cloverfield-barn') {
      // Red barn beams, haystacks, prize orange pumpkins on crates, Black Dew barrel.
      box(0.35, 4.2, 0.35, -4.2, 2.1, -5.8, 0x5c2018);
      box(0.35, 4.2, 0.35, 4.2, 2.1, -5.8, 0x5c2018);
      box(9.2, 0.32, 0.32, 0, 3.8, -5.8, 0x5c2018);
      prop('haystack', 1.7, 'w', -2.6, 0, -4.0, 0.2);
      prop('haystack', 1.5, 'w', 2.7, 0, -4.2, -0.4);
      prop('gta-dew-barrel', 1.1, 'h', -1.6, 0, -2.5, 0.3);
      const pumpkin = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xe6731e, roughness: 0.7 }),
      );
      pumpkin.scale.set(1.15, 0.8, 1.15);
      pumpkin.position.set(1.8, 0.36, -2.3);
      g.add(pumpkin);
    } else if (room === 'unmowed-hollow') {
      // Forest canopy backdrop, broadleaf trees, bushes, glowing Stopping Stone plinth.
      prop('broadleaf-tree', 4.6, 'h', -3.8, 0, -5.2, 0.3);
      prop('broadleaf-tree', 4.4, 'h', 3.9, 0, -5.0, -0.5);
      prop('round-bush', 2.0, 'w', -2.1, 0, -4.2, 0);
      prop('round-bush', 1.8, 'w', 2.2, 0, -4.4, 0.8);
      box(1.3, 0.65, 1.3, 1.7, 0.32, -2.5, 0x3b4d36);
      prop('stopping-stone', 0.85, 'h', 1.7, 0.65, -2.5, 0.4);
    } else if (room === 'fells-shrine') {
      // Ice-stone arch, snowdrifts, glowing cyan Aether crystals, flickering barrel fire.
      box(0.7, 3.6, 0.7, -2.4, 1.8, -5.2, 0x8ea6b8);
      box(0.7, 3.6, 0.7, 2.4, 1.8, -5.2, 0x8ea6b8);
      box(5.6, 0.7, 0.8, 0, 3.6, -5.2, 0xa8c2d4);
      prop('aether-crystal', 1.6, 'h', -2.6, 0, -3.4, 0.3);
      prop('aether-crystal', 1.4, 'h', 2.5, 0, -3.6, -0.5);
      box(0.7, 0.85, 0.7, 1.6, 0.42, -2.4, 0x4b4f54);
      box(0.45, 0.25, 0.45, 1.6, 0.92, -2.4, 0xff7a22, 0xc84600);
    } else if (room === 'dust-overlook') {
      // Sandbag parapet, desert cacti, tactical crate table, Black Dew barrel.
      box(9.0, 0.75, 0.65, 0, 0.38, -5.4, 0xb89664);
      prop('tall-cactus', 2.8, 'h', -3.4, 0, -4.2, 0.2);
      prop('tall-cactus', 2.4, 'h', 3.6, 0, -4.5, -0.3);
      prop('table', 2.0, 'w', 1.6, 0, -2.5, 0.15);
      prop('gta-dew-barrel', 1.1, 'h', -2.1, 0, -3.1, 0);
    } else if (room === 'mulch-club') {
      // Velvet back room: rug, bookshelves, armchair, lamp.
      prop('rug', 5.2, 'w', 0, 0.01, -2.0, 0);
      prop('bookshelf', 2.4, 'w', -3.6, 0, -6.1, 0);
      prop('bookshelf', 2.4, 'w', 3.6, 0, -6.1, 0);
      prop('lamp', 1.4, 'h', -2.4, 0, -4.6, 0);
      prop('table', 2.0, 'w', 1.6, 0, -2.4, 0);
    } else {
      // 'street': Turfton sidewalk storefront facade, neon sign, Acorn-Cola & Dandelion Fizz machines, picnic table.
      box(12, 3.8, 0.4, 0, 1.9, -6.0, 0x3b424c);
      box(4.6, 0.25, 0.35, 0, 3.1, -5.7, 0xffd23f, 0x8a6400);
      prop('gta-vending-cola', 1.6, 'h', -2.8, 0, -5.0, 0);
      prop('gta-vending-fizz', 1.6, 'h', 2.8, 0, -5.0, 0);
      prop('picnic-table', 2.2, 'w', 2.1, 0, -2.7, -0.25);
    }
  }

  function buildContract(req: Extract<CutsceneRequest, { kind?: 'contract' }>): void {
    const g = new THREE.Group();
    g.position.copy(ORIGIN);
    buildRoomShell(g, req.room);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
      m.position.set(x, y, z);
      g.add(m);
    };
    const rug = fit('rug', 6, 'w');
    rug.obj.position.set(0, 0.01, -1.2);
    g.add(rug.obj);
    const shelf = fit('bookshelf', 2.6, 'w');
    shelf.obj.position.set(-4.2, 0, -6.2);
    g.add(shelf.obj);
    const shelf2 = fit('bookshelf', 2.6, 'w');
    shelf2.obj.position.set(4.2, 0, -6.2);
    g.add(shelf2.obj);
    const lamp = fit('lamp', 1.5, 'h');
    lamp.obj.position.set(-4.6, 0, -5.4);
    g.add(lamp.obj);

    const desk = fit('table', 2.6, 'w');
    desk.obj.position.set(0, 0, -1.9);
    g.add(desk.obj);
    const chair = fit('armchair', 1.7, 'w');
    chair.obj.position.set(0, DAIS, -3.5);
    box(3, DAIS, 2.2, 0, DAIS / 2, -3.5, 0x2a1c14);
    g.add(chair.obj);

    boss = makeGnome(g, BOSS_LOOK);
    boss.object.scale.setScalar(1.6);
    guards = [GUARD_LOOK, GUARD_LOOK].map((look) => {
      const m = makeGnome(g, look);
      m.object.scale.setScalar(1.15);
      const held = buildHeld('gta-pistol');
      held.position.set(0, -0.32, 0.02);
      held.rotation.x = Math.PI;
      m.arms.right.add(held);
      return m;
    });

    posters = req.targets.map((t, i) => {
      const n = req.targets.length;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.65),
        new THREE.MeshBasicMaterial({ map: posterTexture(t.look, t.name), side: THREE.DoubleSide, transparent: true }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      const x = (i - (n - 1) / 2) * 0.62;
      const rest = new THREE.Vector3(x, desk.top + 0.02, -1.8 + (i % 2) * 0.05);
      mesh.position.copy(rest);
      g.add(mesh);
      return { mesh, rest, at: 0.6 + i * 1.2 };
    });

    scene.add(g);
    stage = g;
    seatY = DAIS + chair.top * 0.32;
  }

  function buildBodegaCorner(parent: THREE.Group): void {
    const corner = new THREE.Group();
    corner.position.copy(BODEGA_OFFSET);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number, emissive = 0): void => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, emissive }),
      );
      m.position.set(x, y, z);
      corner.add(m);
    };
    box(9, 0.1, 8, 0, -0.05, 0, 0x26292e);
    box(9, 3.6, 0.2, 0, 1.8, -3.5, 0x1b2b34);
    // Warm neon Bodega & Sons window frame
    box(3.4, 0.14, 0.18, 0, 2.7, -3.35, 0xff5a36, 0x7a220c);
    box(2.8, 0.85, 0.9, 0, 0.42, -1.3, 0x6b4a2e);

    const bodegaLight = new THREE.PointLight(0xffb86c, 16, 14, 1.4);
    bodegaLight.position.set(0, 2.4, -0.8);
    corner.add(bodegaLight);

    bodegaKeeper = makeGnome(corner, { ...BASE_SPEAKER_LOOK, ...CHARACTER_PRESETS.bodega.look });
    bodegaKeeper.object.scale.setScalar(1.25);

    // Asphalt the clay-dust tabby cat sitting on the counter batting a bottlecap
    const cat = new THREE.Group();
    const catMat = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.42), catMat);
    body.position.set(0, 0.11, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.2), catMat);
    head.position.set(0, 0.26, 0.16);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xd8342c }));
    cap.position.set(0.18, 0.02, 0.28);
    cat.add(body, head, cap);
    cat.position.set(0.8, 0.86, -1.25);
    corner.add(cat);
    asphaltCat = cat;

    parent.add(corner);
  }

  function spawnSpeaker(line: DialogueLine): void {
    if (!stage) return;
    if (speakerModel) {
      stage.remove(speakerModel.object);
      speakerModel = null;
    }
    const { look, held, scale } = speakerLookAndHz(line);
    speakerModel = makeGnome(stage, look);
    speakerModel.object.scale.setScalar(scale);
    if (held) {
      const prop = buildHeld(held);
      prop.position.set(0, -0.32, 0.02);
      prop.rotation.x = Math.PI;
      speakerModel.arms.right.add(prop);
    }
  }

  function applyDialogueLine(idx: number): void {
    const line = dialogueLines[idx];
    if (!line) return;
    lineT = 0;
    subSpeaker.textContent = line.speaker;
    subText.textContent = line.text;
    subBadge.textContent = line.icon ?? (line.bodegaCameo ? '🧹' : '');
    nextBtn.textContent = idx >= dialogueLines.length - 1 ? 'Done ▶' : 'Next ▶';
    spawnSpeaker(line);

    const { hz } = speakerLookAndHz(line);
    voice.stop();
    const spoken = voice.say(line.text, hz);
    lineDur = Math.max(3.5, spoken + 1.6);
  }

  function buildDialogue(req: Extract<CutsceneRequest, { kind: 'dialogue' }>): void {
    const g = new THREE.Group();
    g.position.copy(ORIGIN);
    buildRoomShell(g, req.room);
    buildThemedSet(g, req.room);
    buildBodegaCorner(g);
    scene.add(g);
    stage = g;

    dialogueLines = req.lines.length > 0
      ? req.lines
      : [{ speaker: 'Narrator', text: 'Meanwhile in Turfton...' }];
    lineIdx = 0;
    if (req.titleCard) {
      titleEl.textContent = req.titleCard;
      titleEl.style.display = 'block';
    } else {
      titleEl.style.display = 'none';
    }
    applyDialogueLine(0);
  }

  /** Pose and animate everyone for this frame. */
  function animateContract(dt: number, shot: Shot, t: number): void {
    if (!boss) return;
    clock += dt;
    boss.update(gnomeState(0, seatY, -3.5, 0, 0, true), dt);
    guards.forEach((m, i) => m.update(gnomeState(i === 0 ? -2.4 : 2.4, 0, -3.1, i === 0 ? 0.6 : -0.6, 0), dt));
    if (shot.act === 'lean') {
      boss.arms.right.rotation.set(-0.7 - Math.sin(clock * 4) * 0.05, 0, 0.3);
    } else if (shot.act === 'posters') {
      boss.arms.right.rotation.set(-1.2, 0, 0.25 + Math.sin(clock * 3) * 0.03);
    } else if (shot.act === 'point') {
      boss.arms.right.rotation.set(-1.55 - Math.max(0, Math.sin(clock * 5)) * 0.15, 0, 0);
      guards[0].arms.left.rotation.set(-0.3, 0, 0);
    }
    for (const p of posters) {
      const show = shot.act === 'posters' ? t >= p.at : shotIdx > 2;
      p.mesh.visible = show;
      if (!show) continue;
      const u = shot.act === 'posters' ? Math.min(1, (t - p.at) / 0.35) : 1;
      p.mesh.position.set(p.rest.x, p.rest.y + (1 - u * u) * 1.2, p.rest.z);
      p.mesh.rotation.z = (1 - u) * 0.9 + (p.rest.x * 0.15);
    }
  }

  function animateDialogue(dt: number): void {
    clock += dt;
    if (speakerModel) {
      speakerModel.update(gnomeState(0, 0, -2.5, 0, 0, false), dt);
      speakerModel.arms.right.rotation.set(-0.55 - Math.abs(Math.sin(clock * 5.5)) * 0.35, 0, 0.15);
    }
    if (bodegaKeeper) {
      const sweep = Math.sin(clock * 2.2) * 0.35;
      bodegaKeeper.update(gnomeState(-0.7 + sweep, 0, -2.1, 0.2, 0, false), dt);
      bodegaKeeper.arms.left.rotation.set(-0.7, 0, -0.2);
      bodegaKeeper.arms.right.rotation.set(-0.7 + Math.sin(clock * 4.4) * 0.2, 0, 0.2);
    }
    if (asphaltCat) {
      asphaltCat.rotation.y = Math.sin(clock * 2.6) * 0.25;
    }
  }

  function setLights(dim: boolean): void {
    if (dim) {
      scene.traverse((o) => {
        const l = o as THREE.Light;
        if (l.isLight && !stage?.getObjectById(l.id)) { lightsSaved.push({ l, i: l.intensity }); l.intensity *= 0.3; }
      });
    } else {
      for (const s of lightsSaved) s.l.intensity = s.i;
      lightsSaved.length = 0;
    }
  }

  function begin(req: CutsceneRequest): void {
    savedBg = scene.background;
    savedFog = scene.fog;
    const bgHex = ROOM_THEMES[req.room]?.bg ?? DARK;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.Fog(bgHex, 14, 40);

    if (req.kind === 'dialogue') {
      mode = 'dialogue';
      buildDialogue(req);
      subBox.style.display = 'block';
      contractSkipBtn.style.display = 'none';
    } else {
      mode = 'contract';
      buildContract(req);
      shots = contractShots(req.targets.length);
      shotIdx = 0;
      shotT = 0;
      subBox.style.display = 'none';
      titleEl.style.display = 'none';
      contractSkipBtn.style.display = 'block';
    }
    setLights(true);
    clock = 0;
  }

  function cleanup(): void {
    voice.stop();
    if (stage) {
      scene.remove(stage);
      stage = null;
    }
    boss = null;
    guards = [];
    speakerModel = null;
    bodegaKeeper = null;
    asphaltCat = null;
    posters = [];
    subBox.style.display = 'none';
    titleEl.style.display = 'none';
    contractSkipBtn.style.display = 'none';
    setLights(false);
    scene.background = savedBg;
    scene.fog = savedFog;
  }

  function advanceDialogue(): void {
    if (mode !== 'dialogue' || !cs.active || phase !== 'play') return;
    lineIdx++;
    if (lineIdx >= dialogueLines.length) {
      phase = 'out';
      phaseT = 0;
      voice.stop();
    } else {
      applyDialogueLine(lineIdx);
    }
  }

  nextBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); advanceDialogue(); });
  skipBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); cs.skip(); });
  contractSkipBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); cs.skip(); });

  window.addEventListener('keydown', (e) => {
    if (!cs.active) return;
    if (e.code === 'Escape') cs.skip();
    else if (mode === 'dialogue' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      advanceDialogue();
    }
  });

  const cs: Cutscene = {
    active: false,
    get mode() { return mode; },

    play(req, done) {
      if (cs.active || phase !== 'off') return;
      if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
      cs.active = true;
      onDone = done;
      hooks.setUiVisible(false);
      overlay.style.display = 'block';
      fade.style.opacity = '1';
      icon.style.display = 'none';
      begin(req);
      phase = 'in';
      phaseT = 0;
    },

    skip() {
      if (cs.active && (phase === 'in' || phase === 'play')) {
        voice.stop();
        phase = 'out';
        phaseT = 0;
        icon.style.display = 'none';
      }
    },

    update(dt, camera) {
      if (phase === 'off') return;
      phaseT += dt;
      if (phase === 'in') {
        fade.style.opacity = String(Math.max(0, 1 - phaseT / FADE));
        if (phaseT >= FADE) { phase = 'play'; phaseT = 0; savedFov = camera.fov; }
      }
      if (phase === 'in' || phase === 'play') {
        camera.fov = 52;
        camera.updateProjectionMatrix();
        if (mode === 'contract') {
          const shot = shots[shotIdx];
          if (phase === 'play') shotT += dt;
          else shotT = 0;
          const u = Math.min(1, shotT / shot.dur);
          lerp3(shot.from, shot.to, smooth(u), tmpPos);
          tmpLook.set(shot.look[0], shot.look[1], shot.look[2]).add(ORIGIN);
          camera.position.copy(tmpPos);
          camera.lookAt(tmpLook);
          animateContract(dt, shot, shotT);
          if (shot.icon && phase === 'play') {
            icon.textContent = shot.icon;
            icon.style.display = 'block';
            icon.style.transform = `translateX(-50%) scale(${0.6 + 0.4 * smooth(Math.min(1, shotT / 0.4))})`;
          } else icon.style.display = 'none';
          if (phase === 'play' && shotT >= shot.dur) {
            shotIdx++;
            shotT = 0;
            if (shotIdx >= shots.length) { phase = 'out'; phaseT = 0; icon.style.display = 'none'; shotIdx = shots.length - 1; }
          }
        } else {
          if (phase === 'play') lineT += dt;
          const line = dialogueLines[Math.min(lineIdx, dialogueLines.length - 1)];
          if (line?.bodegaCameo) {
            tmpPos.set(0.4 + Math.sin(clock * 0.4) * 0.2, 1.5, 1.5).add(ORIGIN).add(BODEGA_OFFSET);
            tmpLook.set(0, 1.1, -1.6).add(ORIGIN).add(BODEGA_OFFSET);
          } else {
            const sway = Math.sin(clock * 0.5) * 0.35;
            tmpPos.set(sway, 1.45, 0.7).add(ORIGIN);
            tmpLook.set(0, 1.1, -2.5).add(ORIGIN);
          }
          camera.position.copy(tmpPos);
          camera.lookAt(tmpLook);
          animateDialogue(dt);
          if (phase === 'play' && lineT >= lineDur) advanceDialogue();
        }
      } else if (phase === 'out') {
        if (mode === 'contract' && shots.length > 0) {
          const shot = shots[Math.min(shotIdx, shots.length - 1)];
          animateContract(dt, shot, shot.dur);
        } else {
          animateDialogue(dt);
        }
        fade.style.opacity = String(Math.min(1, phaseT / FADE));
        if (phaseT >= FADE) {
          cleanup();
          camera.fov = savedFov;
          camera.updateProjectionMatrix();
          const d = onDone;
          onDone = null;
          d?.();
          phase = 'after';
          phaseT = 0;
          cs.active = false;
          hooks.setUiVisible(true);
        }
      } else if (phase === 'after') {
        fade.style.opacity = String(Math.max(0, 1 - phaseT / FADE));
        if (phaseT >= FADE) {
          overlay.style.display = 'none';
          phase = 'off';
        }
      }
    },
  };
  return cs;
}
