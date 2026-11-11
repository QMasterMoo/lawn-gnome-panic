import * as THREE from 'three';
import { ITEM_DEFS, TUNING } from './config';
import type { ItemKind, ItemMarker, Juice } from './config';

/** Game-feel overlay: floating numbers, combo, celebrations, toasts, shake, edge arrows. */

const FONT = "'Arial Black', Impact, system-ui, sans-serif";
const DN_POOL = 80;
const DN_LIFE = 0.7;
const DN_RISE = 1.2;
const DN_JITTER = 0.4;
const CONF_N = 140;
const CONF_LIFE = 1.4;
const LVL_TEXT_S = 1.2;
const FLASH_S = 0.15;
const HURT_S = 0.45;
const SHOUT_S = 1.2;
const POP_S = 0.12;
const TOAST_MAX = 3;
const TOAST_LIFE = 2.6;
const EDGE_INSET = 40;
const UNITS_PER_M = 4.7;

const CONF_COLORS = ['#ff5252', '#ffd54f', '#69f0ae', '#40c4ff', '#e040fb', '#ffffff'];
const MILESTONES = new Map<number, string>([
  [10, 'MOW-TASTIC!'],
  [25, 'LAWNSLAUGHTER!'],
  [50, 'UNMOWABLE!'],
  [100, 'GNOMESTRADAMUS!'],
  [200, 'TOUCH GRASS? NO. DESTROY GRASS.'],
  [500, 'PLEASE CONSIDER A BREAK.'],
]);
const ICONS: Record<ItemKind, string> = {
  chicken: '\u{1F357}',
  shopVac: '\u{1F300}',
  weedKiller: '☠️',
  espresso: '☕',
  compostBin: '\u{1F381}',
};

const CSS = `
.jc-root{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;overflow:hidden;z-index:20;font-family:${FONT};color:#fff}
.jc-flash,.jc-vig,.jc-num,.jc-combo,.jc-shout,.jc-lvl,.jc-sun,.jc-lvl-txt,.jc-conf,.jc-toasts,.jc-mk,.jc-arrow,.jc-lbl{position:absolute;pointer-events:none}
.jc-flash{left:0;top:0;right:0;bottom:0;background:#fff;opacity:0}
.jc-vig{left:0;top:0;right:0;bottom:0;box-shadow:inset 0 0 160px 60px rgba(255,0,0,.55);opacity:0}
.jc-num{left:0;top:0;display:none;white-space:nowrap;font-weight:900;text-shadow:0 3px 0 #000,0 0 8px rgba(0,0,0,.6)}
.jc-combo{right:4vw;top:38vh;display:none;text-align:right;transform-origin:100% 50%;font-weight:900}
.jc-combo-n{font-size:40px;line-height:1;color:#fff;text-shadow:0 3px 0 #000,0 0 10px rgba(0,0,0,.5)}
.jc-combo-l{font-size:14px;letter-spacing:.2em;text-shadow:0 2px 0 #000}
.jc-combo-bar{margin:6px 0 0 auto;width:140px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);overflow:hidden}
.jc-combo-fill{height:100%;width:100%;background:#fff}
.jc-combo-end{margin-top:4px;font-size:14px;text-shadow:0 2px 0 #000;display:none}
.jc-shout{left:50%;top:20vh;display:none;white-space:nowrap;font-size:clamp(28px,6vw,64px);font-weight:900;text-shadow:0 4px 0 #000,0 0 18px rgba(255,213,79,.7);opacity:1}
.jc-lvl{left:0;top:0;right:0;bottom:0;display:none}
.jc-sun{left:50%;top:50%;width:140vmin;height:140vmin;margin:-70vmin 0 0 -70vmin;border-radius:50%;background:repeating-conic-gradient(rgba(255,213,79,.35) 0 10deg,transparent 10deg 20deg)}
.jc-lvl-txt{left:50%;top:50%;text-align:center;white-space:nowrap;transform:translate(-50%,-50%)}
.jc-lvl-t{font-size:96px;font-weight:900;line-height:1;color:#ffd54f;text-shadow:-3px 0 #fff,3px 0 #fff,0 -3px #fff,0 3px #fff,0 6px 0 rgba(0,0,0,.35)}
.jc-lvl-s{font-size:48px;font-weight:900;color:#fff;text-shadow:0 3px 0 #000}
.jc-conf{left:0;top:0;width:8px;height:14px;display:none}
.jc-toasts{left:0;right:0;top:92px;display:flex;flex-direction:column;align-items:center;gap:6px}
.jc-toast{text-align:center;white-space:nowrap;opacity:0}
.jc-toast-t{font-size:30px;font-weight:900;line-height:1.1}
.jc-toast-s{font-size:16px;color:#fff;text-shadow:0 2px 0 #000}
.jc-mk{left:0;top:0;width:0;height:0;display:none}
.jc-arrow{left:-18px;top:-15px;width:36px;height:30px;clip-path:polygon(0 0,100% 50%,0 100%);display:none}
.jc-lbl{left:0;top:0;white-space:nowrap;font-size:18px;font-weight:900;color:#fff;text-shadow:0 2px 0 #000}
`;

interface Num { el: HTMLDivElement; active: boolean; age: number; x: number; y: number; z: number; jx: number }
interface Conf { el: HTMLDivElement; on: boolean; x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number }
interface Toast { el: HTMLDivElement; age: number }
interface Mk { wrap: HTMLDivElement; arrow: HTMLDivElement; label: HTMLDivElement; text: string; color: string }

// Scratch vector for projections (avoids a clone per call).
const _v = new THREE.Vector3();

function addEl(cls: string, parent: HTMLElement): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  parent.appendChild(d);
  return d;
}

function injectStyle(): void {
  if (document.getElementById('jc-style')) return;
  const s = document.createElement('style');
  s.id = 'jc-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const q = p - 1;
  return 1 + c3 * q * q * q + c1 * q * q;
}

/** Colour for the combo counter; '' means the animated rainbow (set per frame). */
function comboColor(c: number): string {
  if (c < 10) return '#ffffff';
  if (c < 25) return '#ffd54f';
  if (c < 50) return '#ff9100';
  if (c < 100) return '#e040fb';
  return '';
}

export function createJuice(root: HTMLElement): Juice {
  injectStyle();

  const layer = addEl('jc-root', root);
  const flash = addEl('jc-flash', layer);
  const vig = addEl('jc-vig', layer);

  // Floating damage numbers (pooled).
  const nums: Num[] = [];
  for (let i = 0; i < DN_POOL; i++) {
    nums.push({ el: addEl('jc-num', layer), active: false, age: 0, x: 0, y: 0, z: 0, jx: 0 });
  }

  // Combo counter.
  const combo$ = addEl('jc-combo', layer);
  const comboN = addEl('jc-combo-n', combo$);
  addEl('jc-combo-l', combo$).textContent = 'COMBO';
  const barFill = addEl('jc-combo-fill', addEl('jc-combo-bar', combo$));
  const comboEnd = addEl('jc-combo-end', combo$);

  // Milestone shout.
  const shout = addEl('jc-shout', layer);

  // Level-up celebration.
  const lvl = addEl('jc-lvl', layer);
  const sun = addEl('jc-sun', lvl);
  const lvlTxt = addEl('jc-lvl-txt', lvl);
  addEl('jc-lvl-t', lvlTxt).textContent = 'LEVEL UP!';
  const lvlSub = addEl('jc-lvl-s', lvlTxt);
  const confs: Conf[] = [];
  for (let i = 0; i < CONF_N; i++) {
    confs.push({ el: addEl('jc-conf', lvl), on: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, life: 0 });
  }

  // Toasts.
  const toastBox = addEl('jc-toasts', layer);
  const toasts: Toast[] = [];

  // Off-screen item arrows (pooled by index).
  const mks: Mk[] = [];
  function makeMk(): Mk {
    const wrap = addEl('jc-mk', layer);
    const arrow = addEl('jc-arrow', wrap);
    const label = addEl('jc-lbl', wrap);
    const mk: Mk = { wrap, arrow, label, text: '', color: '' };
    mks.push(mk);
    return mk;
  }

  // State.
  let now = 0;
  let combo = 0;
  let comboTimer = 0;
  let comboEnded = false;
  let endedT = 0;
  let popT = -1;
  let comboDirty = true;
  let shoutT = -1;
  let hurtT = 0;
  let flashT = 0;
  let lvlAge = -1;
  let trauma = 0;
  const lastOffset = new THREE.Vector3();

  function pickNum(): Num {
    let best = nums[0];
    for (const n of nums) {
      if (!n.active) return n;
      if (n.age > best.age) best = n;
    }
    return best;
  }

  function renderCombo(): void {
    comboDirty = false;
    comboN.textContent = `x${combo}`;
    comboN.style.fontSize = `${Math.min(110, 40 + 18 * Math.log2(Math.max(combo, 1)))}px`;
    comboN.style.color = comboColor(combo) || 'hsl(0,100%,60%)';
    comboEnd.textContent = `COMBO ENDED · x${combo}`;
  }

  function showShout(text: string): void {
    shout.textContent = text;
    shout.style.display = 'block';
    shoutT = 0;
  }

  function spawnConfetti(): void {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (const c of confs) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 300 + Math.random() * 600;
      c.on = true;
      c.life = 0;
      c.x = cx;
      c.y = cy;
      c.vx = Math.cos(ang) * sp;
      c.vy = Math.sin(ang) * sp;
      c.rot = Math.random() * 360;
      c.vr = (Math.random() * 2 - 1) * 720;
      c.el.style.background = CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)];
      c.el.style.transform = `translate(${cx - 4}px,${cy - 7}px)`;
      c.el.style.opacity = '1';
      c.el.style.display = 'block';
    }
  }

  return {
    damageNumber(x: number, y: number, z: number, amount: number) {
      const n = pickNum();
      n.active = true;
      n.age = 0;
      n.x = x;
      n.y = y;
      n.z = z;
      n.jx = (Math.random() * 2 - 1) * DN_JITTER;
      const size = (16 + 6 * Math.log10(amount + 1)) * (amount >= 500 ? 1.3 : 1);
      const color = amount < 30 ? '#ffffff' : amount < 100 ? '#ffd54f' : amount < 500 ? '#ff7043' : '#ff1744';
      n.el.textContent = String(Math.round(amount));
      n.el.style.fontSize = `${size}px`;
      n.el.style.color = color;
      n.el.style.display = 'block';
    },

    kill(_x: number, _z: number) {
      combo += 1;
      comboTimer = TUNING.comboWindowS;
      comboEnded = false; // a kill inside the 1 s "ended" window keeps the combo going
      popT = 0;
      comboDirty = true;
      const milestone = MILESTONES.get(combo);
      if (milestone) showShout(milestone);
    },

    hurt() {
      hurtT = HURT_S;
    },

    levelUp(level: number) {
      lvlSub.textContent = `LV ${level}`;
      lvl.style.display = 'block';
      lvlAge = 0;
      flashT = FLASH_S;
      spawnConfetti();
    },

    toast(title: string, sub: string, color: string) {
      if (toasts.length >= TOAST_MAX) {
        const old = toasts.shift();
        if (old) old.el.remove();
      }
      const box = document.createElement('div');
      box.className = 'jc-toast';
      const t = document.createElement('div');
      t.className = 'jc-toast-t';
      t.textContent = title;
      t.style.color = color;
      t.style.textShadow = `0 0 16px ${color}, 0 2px 0 #000`;
      const s = document.createElement('div');
      s.className = 'jc-toast-s';
      s.textContent = sub;
      box.append(t, s);
      toastBox.appendChild(box);
      toasts.push({ el: box, age: 0 });
    },

    shake(strength: number) {
      trauma = Math.min(1.5, trauma + strength);
    },

    update(dt: number, camera: THREE.PerspectiveCamera, markers: readonly ItemMarker[]) {
      now += dt;

      // Camera shake: remove last frame's offset, add this frame's.
      camera.position.sub(lastOffset);
      if (trauma > 0) {
        const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        lastOffset.copy(d.normalize().multiplyScalar(trauma * trauma * 0.5));
      } else {
        lastOffset.set(0, 0, 0);
      }
      camera.position.add(lastOffset);
      trauma = Math.max(0, trauma - 1.8 * dt);

      camera.updateMatrixWorld();
      const W = window.innerWidth;
      const H = window.innerHeight;

      // Damage numbers.
      for (const n of nums) {
        if (!n.active) continue;
        n.age += dt;
        if (n.age >= DN_LIFE) {
          n.active = false;
          n.el.style.display = 'none';
          continue;
        }
        _v.set(n.x + n.jx, n.y + DN_RISE * (n.age / DN_LIFE), n.z).project(camera);
        if (_v.z > 1) {
          n.el.style.display = 'none';
          continue;
        }
        const s = n.age < 0.1 ? 1.4 - 0.4 * (n.age / 0.1) : 1;
        const alpha = n.age > DN_LIFE - 0.3 ? (DN_LIFE - n.age) / 0.3 : 1;
        n.el.style.left = `${(_v.x * 0.5 + 0.5) * W}px`;
        n.el.style.top = `${(-_v.y * 0.5 + 0.5) * H}px`;
        n.el.style.transform = `translate(-50%,-50%) scale(${s})`;
        n.el.style.opacity = `${alpha}`;
      }

      // Combo timer and state.
      if (popT >= 0) {
        popT += dt;
        if (popT >= POP_S) popT = -1;
      }
      if (comboEnded) {
        endedT -= dt;
        if (endedT <= 0) {
          comboEnded = false;
          combo = 0;
          comboDirty = true;
        }
      } else if (combo > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) {
          comboTimer = 0;
          if (combo >= 3) {
            comboEnded = true;
            endedT = 1;
          } else {
            combo = 0;
          }
          comboDirty = true;
        }
      }
      if (comboDirty) renderCombo();

      const comboVisible = combo >= 3;
      combo$.style.display = comboVisible ? 'block' : 'none';
      if (comboVisible) {
        barFill.style.width = `${(comboTimer / TUNING.comboWindowS) * 100}%`;
        if (combo >= 100) comboN.style.color = `hsl(${(now * 240) % 360},100%,60%)`;
        const sc = popT >= 0 ? 1.35 - 0.35 * (popT / POP_S) : 1;
        combo$.style.transform = `scale(${sc})`;
      }
      comboEnd.style.display = comboEnded && comboVisible ? 'block' : 'none';

      // Milestone shout.
      if (shoutT >= 0) {
        shoutT += dt;
        if (shoutT >= SHOUT_S) {
          shoutT = -1;
          shout.style.display = 'none';
        } else {
          const sc = easeOutBack(clamp01(shoutT / 0.3));
          const a = shoutT > SHOUT_S - 0.3 ? (SHOUT_S - shoutT) / 0.3 : 1;
          shout.style.transform = `translate(-50%,-50%) scale(${sc})`;
          shout.style.opacity = `${a}`;
        }
      }

      // Hurt vignette and level-up flash.
      if (hurtT > 0) hurtT = Math.max(0, hurtT - dt);
      vig.style.opacity = `${hurtT / HURT_S}`;
      if (flashT > 0) flashT = Math.max(0, flashT - dt);
      flash.style.opacity = `${flashT / FLASH_S}`;

      // Level-up celebration.
      if (lvlAge >= 0) {
        lvlAge += dt;
        if (lvlAge >= CONF_LIFE) {
          lvlAge = -1;
          lvl.style.display = 'none';
        } else {
          const t = lvlAge;
          sun.style.transform = `rotate(${t * 90}deg) scale(${easeOutBack(clamp01(t / 0.3))})`;
          lvlTxt.style.transform = `translate(-50%,-50%) scale(${easeOutBack(clamp01(t / 0.35))})`;
          const textA = t > LVL_TEXT_S - 0.3 ? clamp01((LVL_TEXT_S - t) / 0.3) : 1;
          sun.style.opacity = `${textA}`;
          lvlTxt.style.opacity = `${textA}`;
        }
      }
      for (const c of confs) {
        if (!c.on) continue;
        c.life += dt;
        if (c.life >= CONF_LIFE) {
          c.on = false;
          c.el.style.display = 'none';
          continue;
        }
        c.vy += 1400 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
        const a = c.life > CONF_LIFE - 0.4 ? (CONF_LIFE - c.life) / 0.4 : 1;
        c.el.style.transform = `translate(${c.x - 4}px,${c.y - 7}px) rotate(${c.rot}deg)`;
        c.el.style.opacity = `${a}`;
      }

      // Toasts: slide in, hold, fade out, expire.
      for (let i = toasts.length - 1; i >= 0; i--) {
        const t = toasts[i];
        t.age += dt;
        if (t.age >= TOAST_LIFE) {
          t.el.remove();
          toasts.splice(i, 1);
          continue;
        }
        const inP = clamp01(t.age / 0.2);
        const outA = t.age > TOAST_LIFE - 0.4 ? (TOAST_LIFE - t.age) / 0.4 : 1;
        t.el.style.opacity = `${Math.min(inP, outA)}`;
        t.el.style.transform = `translateY(${(1 - inP) * -14}px)`;
      }

      // Item arrows and floating icons.
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const mk = i < mks.length ? mks[i] : makeMk();
        const def = ITEM_DEFS[m.kind];
        const hex = `#${def.color.toString(16).padStart(6, '0')}`;
        const dist = Math.round(Math.hypot(m.pos.x - camera.position.x, m.pos.z - camera.position.z) / UNITS_PER_M);
        const text = `${ICONS[m.kind]} ${dist}m`;
        if (mk.text !== text) {
          mk.label.textContent = text;
          mk.text = text;
        }
        if (mk.color !== hex) {
          mk.arrow.style.background = hex;
          mk.label.style.textShadow = `0 0 10px ${hex}, 0 2px 0 #000`;
          mk.color = hex;
        }
        mk.wrap.style.display = 'block';

        _v.set(m.pos.x, m.pos.y + 2, m.pos.z).project(camera);
        let nx = _v.x;
        let ny = _v.y;
        const onScreen = Math.abs(nx) < 0.9 && Math.abs(ny) < 0.85 && _v.z < 1;
        if (onScreen) {
          mk.arrow.style.display = 'none';
          mk.wrap.style.left = `${(nx * 0.5 + 0.5) * W}px`;
          mk.wrap.style.top = `${(-ny * 0.5 + 0.5) * H}px`;
          mk.label.style.transform = 'translate(-50%,calc(-100% - 8px))';
        } else {
          if (_v.z > 1) {
            nx = -nx;
            ny = -ny;
          }
          let dx = nx * (W / 2);
          let dy = -ny * (H / 2); // screen space, y down
          if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = -1;
          // Scale the direction until it hits the inset edge rectangle.
          const hx = W / 2 - EDGE_INSET;
          const hy = H / 2 - EDGE_INSET;
          const sx = Math.abs(dx) > 1e-6 ? hx / Math.abs(dx) : Infinity;
          const sy = Math.abs(dy) > 1e-6 ? hy / Math.abs(dy) : Infinity;
          const s = Math.min(sx, sy);
          const ang = Math.atan2(dy, dx);
          mk.wrap.style.left = `${cx + dx * s}px`;
          mk.wrap.style.top = `${cy + dy * s}px`;
          mk.arrow.style.display = 'block';
          mk.arrow.style.transform = `rotate(${(ang * 180) / Math.PI}deg)`;
          const lx = -Math.cos(ang) * 44;
          const ly = -Math.sin(ang) * 44;
          mk.label.style.transform = `translate(calc(-50% + ${lx}px),calc(-50% + ${ly}px))`;
        }
      }
      for (let i = markers.length; i < mks.length; i++) mks[i].wrap.style.display = 'none';
    },

    reset() {
      for (const n of nums) {
        n.active = false;
        n.el.style.display = 'none';
      }
      combo = 0;
      comboTimer = 0;
      comboEnded = false;
      endedT = 0;
      popT = -1;
      comboDirty = true;
      combo$.style.display = 'none';
      comboEnd.style.display = 'none';
      shoutT = -1;
      shout.style.display = 'none';
      hurtT = 0;
      flashT = 0;
      lvlAge = -1;
      lvl.style.display = 'none';
      for (const c of confs) {
        c.on = false;
        c.el.style.display = 'none';
      }
      for (const t of toasts) t.el.remove();
      toasts.length = 0;
      for (const mk of mks) mk.wrap.style.display = 'none';
      trauma = 0;
      lastOffset.set(0, 0, 0);
    },
  };
}
