import type { SpectateBar, SpectateCallbacks } from '../config';
import { stylePlayerName } from './nameStyle';

/** Spectator bar for online players whose gnome died: who you are watching (in their colour),
 *  prev/next buttons, a free-camera toggle and key hints. Sits above the bottom HUD. */

const CSS = `
.sp-root { position: absolute; left: 50%; bottom: 56px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; font: bold 15px sans-serif; color: #fff; text-shadow: 0 2px 0 #000; z-index: 5; white-space: nowrap; }
@media (max-width: 760px), (max-height: 480px) { .sp-root { top: 92px; bottom: auto; font-size: 13px; } }
.sp-count { font-size: 12px; letter-spacing: 2px; color: #ffd54f; }
.sp-row { display: flex; flex-direction: row; align-items: center; gap: 8px; }
.sp-btn { pointer-events: auto; font: inherit; color: #fff; background: rgba(0,0,0,.55); border: 2px solid rgba(255,255,255,.6); border-radius: 10px; padding: 4px 10px; cursor: pointer; min-width: 40px; min-height: 34px; }
.sp-name { font-size: 20px; }
.sp-hint { font-size: 11px; color: #ccc; letter-spacing: 1px; }
`;

export function createSpectateBar(parent: HTMLElement, cb: SpectateCallbacks): SpectateBar {
  const doc = parent.ownerDocument;

  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  function makeButton(text: string, onAct: () => void): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'sp-btn';
    b.textContent = text;
    // Clicks on the bar must not reach the game (no camera drag, no shooting).
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAct();
    });
    b.addEventListener('click', (e) => e.stopPropagation());
    return b;
  }

  const root = doc.createElement('div');
  root.className = 'sp-root';
  root.style.display = 'none';

  const label = doc.createElement('div');
  label.className = 'sp-label';

  const row = doc.createElement('div');
  row.className = 'sp-row';

  const prev = makeButton('◀', () => cb.onPrev());
  const name = doc.createElement('span');
  name.className = 'sp-name';
  const next = makeButton('▶', () => cb.onNext());
  const free = makeButton('', () => cb.onToggleFree());
  free.classList.add('sp-free');
  row.append(prev, name, next, free);

  const hint = doc.createElement('div');
  hint.className = 'sp-hint';

  root.append(label, row, hint);
  parent.appendChild(root);

  let lastKey: string | null = null;

  function redraw(target: { name: string; color: number } | null, alive: number): void {
    const isFree = target === null;

    label.textContent = isFree ? '🎥 FREE CAMERA' : '👁 SPECTATING';
    const count = doc.createElement('span');
    count.className = 'sp-count';
    count.textContent = ` · ${alive} LEFT`;
    label.appendChild(count);

    if (target) {
      name.textContent = target.name;
      stylePlayerName(name, target.color);
      name.style.padding = '2px 10px';
    } else {
      name.removeAttribute('style');
      name.textContent = 'WASD to fly';
    }

    prev.style.display = isFree ? 'none' : '';
    next.style.display = isFree ? 'none' : '';
    free.textContent = isFree ? '👁 FOLLOW' : '🎥 FREE CAM';
    hint.textContent = isFree
      ? 'WASD MOVE · SHIFT FASTER · F FOLLOW · ESC MENU'
      : 'A/D or ←/→ SWITCH · F FREE CAM · ESC MENU';
  }

  return {
    show() {
      root.style.display = 'flex';
    },
    hide() {
      root.style.display = 'none';
      lastKey = null;
    },
    set(target, alive) {
      const key = `${target ? target.name + '|' + target.color : 'free'}|${alive}`;
      if (key === lastKey) return;
      lastKey = key;
      redraw(target, alive);
    },
  };
}
