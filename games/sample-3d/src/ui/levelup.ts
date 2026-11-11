import type { LevelUpUI, UpgradeChoice, WeaponId } from '../config';
import { WEAPON_DEFS } from '../config';

const SUB_LINES = [
  'Choose one. This is the roguelike part.',
  'The sacred ritual of picking a card.',
  'Synergies! Probably!',
  "Choose wisely. Or don't. You will die anyway.",
];

const ICONS: Record<string, string> = {
  slingshot: '🪨', trowels: '🔱', sprinkler: '💦', mushrooms: '🍄',
  stormOfDaggers: '🗡️', leafPileFireball: '🍂', hoseMissile: '🚿', windChimeLullaby: '🎐', leafBlower: '🌬️', pitchfork: '🔱',
  fertilizer: '🌱', compost: '♻️', comfyBoots: '👢', heal: '🥪',
};

const BORDER: Record<UpgradeChoice['kind'], string> = {
  weapon: '#ffd54f',
  passive: '#4dd0e1',
  heal: '#ff8fb1',
};

const GUARD_MS = 250;

const CSS = `
.lv-root {
  width: 100%; height: 100%; box-sizing: border-box; padding: 24px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
  background: rgba(10, 10, 30, .6); pointer-events: auto;
  font-family: 'Arial Black', Impact, system-ui, sans-serif; color: #fff;
}
.lv-title { margin: 0; font-size: 56px; color: #ffd54f; font-style: italic; text-align: center; }
.lv-sub { margin: 0; font-size: 18px; opacity: .9; font-family: system-ui, sans-serif; text-align: center; }
.lv-cards { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
.lv-card {
  position: relative; width: 220px; height: 300px; box-sizing: border-box; padding: 14px;
  border-radius: 18px; border: 3px solid var(--lv-c);
  background: linear-gradient(160deg, #2b2b4f, #101028);
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer; user-select: none; transition: transform .15s ease;
  animation: lv-pop .35s cubic-bezier(.2, 1.4, .4, 1) backwards;
}
.lv-card:hover { transform: translateY(-10px) scale(1.04); }
.lv-tag:empty { display: none; }
.lv-tag { font-size: 12px; padding: 3px 8px; border-radius: 10px; background: var(--lv-c); color: #111; }
.lv-icon { font-size: 56px; line-height: 1; margin: 14px 0 10px; }
.lv-card-title { font-size: 22px; line-height: 1.15; text-align: center; }
.lv-desc { margin-top: 8px; font-size: 15px; line-height: 1.3; text-align: center; font-family: system-ui, sans-serif; }
.lv-blurb { margin-top: 8px; font-size: 13px; font-style: italic; opacity: .8; text-align: center; font-family: system-ui, sans-serif; }
.lv-hint { margin-top: auto; font-size: 14px; opacity: .7; }
.lv-reroll {
  font-family: inherit; font-size: 18px; padding: 12px 22px; cursor: pointer;
  border-radius: 12px; border: 2px solid #ffd54f; background: #1d1d3a; color: #ffd54f;
}
.lv-reroll:disabled { opacity: .4; cursor: not-allowed; }
@keyframes lv-pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
`;

function injectStyle(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

interface LevelUpState {
  choices: readonly UpgradeChoice[];
  rerollsLeft: number;
  onPick: (index: number) => void;
  onReroll: () => void;
}

export function createLevelUpUI(parent: HTMLElement): LevelUpUI {
  // Own container: never restyle the shared #ui root (that hid the lobby).
  const root = document.createElement('div');
  parent.appendChild(root);
  injectStyle('lv-style', CSS);
  root.classList.add('lv-root');
  root.style.display = 'none';

  let current: LevelUpState | null = null;
  let subText = SUB_LINES[0];
  let shownAt = 0;
  let listening = false;

  const onKey = (e: KeyboardEvent): void => {
    if (!current) return;
    if (performance.now() - shownAt < GUARD_MS) return;
    const digit = /^(Digit|Numpad)([1-4])$/.exec(e.code);
    if (digit) {
      const index = Number(digit[2]) - 1;
      if (index < current.choices.length) {
        e.preventDefault();
        current.onPick(index);
      }
      return;
    }
    if (e.code === 'KeyR' && current.rerollsLeft > 0) {
      e.preventDefault();
      current.onReroll();
    }
  };

  function render(): void {
    if (!current) return;
    const { choices, rerollsLeft, onPick, onReroll } = current;

    const title = el('h1', 'lv-title', 'LEVEL UP!');
    const sub = el('p', 'lv-sub', subText);

    const row = el('div', 'lv-cards');
    choices.forEach((c, i) => {
      const card = el('div', 'lv-card');
      card.style.setProperty('--lv-c', BORDER[c.kind]);
      card.style.animationDelay = `${i * 80}ms`;

      const tag = el('div', 'lv-tag');
      if (c.kind !== 'heal') tag.textContent = c.isNew ? 'NEW!' : `LV ${c.nextLevel}`;

      const icon = el('div', 'lv-icon', ICONS[c.id] ?? '');
      const cardTitle = el('div', 'lv-card-title', c.title);
      const desc = el('div', 'lv-desc', c.description);
      card.append(tag, icon, cardTitle, desc);

      if (c.kind === 'weapon' && c.isNew) {
        card.append(el('div', 'lv-blurb', WEAPON_DEFS[c.id as WeaponId].blurb));
      }
      card.append(el('div', 'lv-hint', `[${i + 1}]`));
      card.addEventListener('click', () => onPick(i));
      row.append(card);
    });

    const reroll = el('button', 'lv-reroll', `REROLL (R) · ${rerollsLeft} LEFT`);
    reroll.type = 'button';
    reroll.disabled = rerollsLeft <= 0;
    reroll.addEventListener('click', () => {
      if (rerollsLeft > 0) onReroll();
    });

    root.replaceChildren(title, sub, row, reroll);
  }

  return {
    show(choices: readonly UpgradeChoice[], rerollsLeft: number, onPick: (index: number) => void, onReroll: () => void): void {
      current = { choices, rerollsLeft, onPick, onReroll };
      shownAt = performance.now();
      subText = SUB_LINES[Math.floor(Math.random() * SUB_LINES.length)];
      root.style.display = '';
      render();
      if (!listening) {
        window.addEventListener('keydown', onKey);
        listening = true;
      }
    },
    hide(): void {
      root.style.display = 'none';
      current = null;
      if (listening) {
        window.removeEventListener('keydown', onKey);
        listening = false;
      }
      root.replaceChildren();
    },
  };
}
