import type { CameraView } from '../config';

const LABELS: Record<CameraView, string> = { third: '3RD', first: '1ST', top: 'TOP' };

export interface ViewButton {
  show(): void;
  hide(): void;
  setView(view: CameraView): void;
}

/** Top-right button that cycles third person, first person and top-down (P on the keyboard does the same). */
export function createViewButton(parent: HTMLElement, onCycle: () => void): ViewButton {
  if (!document.getElementById('vb-style')) {
    const style = document.createElement('style');
    style.id = 'vb-style';
    style.textContent = `
.vb-btn {
  position: absolute; top: 14px; right: 16px; width: 58px; height: 58px; display: none;
  flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  border-radius: 14px; border: 2px solid rgba(255,255,255,.7); background: rgba(0,0,0,.45);
  color: #fff; font-family: 'Arial Black', Impact, system-ui, sans-serif; cursor: pointer;
  pointer-events: auto; touch-action: manipulation; user-select: none; -webkit-user-select: none;
  text-shadow: 0 2px 4px rgba(0,0,0,.6); transition: transform .1s, background .1s;
}
.vb-btn:hover { background: rgba(0,0,0,.6); }
.vb-btn:active { transform: scale(.92); }
.vb-icon { font-size: 22px; line-height: 1; }
.vb-label { font-size: 12px; letter-spacing: 1px; color: #ffd54f; }
.vb-key { position: absolute; bottom: -16px; font-size: 10px; opacity: .7; }
@media (max-width: 760px) { .vb-btn { width: 50px; height: 50px; } .vb-key { display: none; } }
`;
    document.head.appendChild(style);
  }
  const btn = document.createElement('button');
  btn.className = 'vb-btn';
  btn.title = 'Change view (P)';
  btn.innerHTML = '<span class="vb-icon">🎥</span><span class="vb-label"></span><span class="vb-key">P</span>';
  const label = btn.querySelector('.vb-label') as HTMLElement;
  // pointerdown + preventDefault so a tap does not also fall through to the canvas or the touch look-drag.
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCycle();
  });
  btn.addEventListener('click', (e) => e.stopPropagation());
  parent.appendChild(btn);
  return {
    show() { btn.style.display = 'flex'; },
    hide() { btn.style.display = 'none'; },
    setView(view: CameraView) { label.textContent = LABELS[view]; },
  };
}
