import type { ChatUI } from '../config';
import { CHAT_MAX, tidyText } from '../net/textFilter';
import { stylePlayerName } from './nameStyle';

/** Text chat overlay: a log bottom-left, a CHAT button, and a text box opened with Enter or T. */

const LOG_MAX = 50;
const FADE_MS = 10000;

const CSS = `
.ch-root { position: absolute; left: 16px; bottom: 84px; width: min(420px, calc(100vw - 32px)); display: flex; flex-direction: column; gap: 4px; pointer-events: none; font: bold 15px sans-serif; z-index: 5; }
.ch-log { display: flex; flex-direction: column; gap: 3px; max-height: 40vh; overflow: hidden; justify-content: flex-end; }
.ch-line { color: #fff; text-shadow: 0 1px 2px #000; word-break: break-word; overflow-wrap: break-word; line-height: 1.35; transition: opacity 0.6s; }
.ch-line.ch-old { opacity: 0; }
.ch-open .ch-old { opacity: 1; }
.ch-sys { color: #b0b0b0; font-style: italic; background: rgba(0,0,0,0.5); padding: 0 4px; border-radius: 3px; }
.ch-btn { pointer-events: auto; align-self: flex-start; font: inherit; font-size: 13px; color: #fff; background: rgba(0,0,0,.55); border: 2px solid rgba(255,255,255,.6); border-radius: 10px; padding: 6px 10px; cursor: pointer; }
.ch-input { pointer-events: auto; width: 100%; box-sizing: border-box; font: inherit; padding: 8px 10px; border-radius: 8px; color: #fff; background: rgba(10,4,30,.85); border: 2px solid #ffd54f; outline: none; }
`;

export function createChat(parent: HTMLElement, onSend: (text: string) => void): ChatUI {
  const doc = parent.ownerDocument;

  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  let enabled = false;
  let open = false;
  const listeners: Array<(open: boolean) => void> = [];

  const root = doc.createElement('div');
  root.className = 'ch-root';
  root.style.display = 'none';

  const log = doc.createElement('div');
  log.className = 'ch-log';

  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'ch-btn';
  btn.textContent = '💬 CHAT [ENTER]';

  const input = doc.createElement('input');
  input.type = 'text';
  input.className = 'ch-input';
  input.maxLength = CHAT_MAX;
  input.placeholder = 'Say something nice... (Enter to send, Esc to close)';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.style.display = 'none';

  root.append(log, btn, input);
  parent.appendChild(root);

  function fire(value: boolean): void {
    for (const fn of listeners) fn(value);
  }

  function openBox(): void {
    if (!enabled || open) return;
    open = true;
    input.style.display = '';
    btn.style.display = 'none';
    root.classList.add('ch-open');
    setTimeout(() => {
      if (open) input.focus();
    }, 0);
    fire(true);
  }

  function closeBox(): void {
    if (!open) return;
    open = false;
    input.style.display = 'none';
    btn.style.display = '';
    input.blur();
    root.classList.remove('ch-open');
    fire(false);
  }

  function pushLine(line: HTMLElement): void {
    log.appendChild(line);
    while (log.children.length > LOG_MAX) {
      const oldest = log.firstElementChild;
      if (!oldest) break;
      log.removeChild(oldest);
    }
    setTimeout(() => {
      if (line.isConnected) line.classList.add('ch-old');
    }, FADE_MS);
  }

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (open) closeBox();
    else openBox();
  });
  btn.addEventListener('click', (e) => e.stopPropagation());

  input.addEventListener('keydown', (e) => {
    // Typing never reaches game keys, the lobby's Enter-to-play or Esc-to-pause.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = tidyText(input.value);
      if (t !== '') onSend(t);
      input.value = '';
      closeBox();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeBox();
    }
  });
  input.addEventListener('blur', () => closeBox());

  // Capture phase, so this runs before the lobby's Enter-to-play handler.
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (!enabled || open || e.repeat) return;
      if (!(e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyT')) return;
      const tag = (e.target as Element | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openBox();
    },
    { capture: true },
  );

  const api: ChatUI = {
    setEnabled(on: boolean) {
      enabled = on;
      root.style.display = on ? 'flex' : 'none';
      if (!on) {
        closeBox();
        log.textContent = '';
      }
    },
    get enabled() {
      return enabled;
    },
    get isOpen() {
      return open;
    },
    open() {
      openBox();
    },
    close() {
      closeBox();
    },
    add(name: string, color: number, text: string) {
      const line = doc.createElement('div');
      line.className = 'ch-line';
      const nameEl = doc.createElement('span');
      nameEl.textContent = name;
      stylePlayerName(nameEl, color);
      const textEl = doc.createElement('span');
      textEl.textContent = ' ' + text;
      stylePlayerName(textEl, color);
      line.append(nameEl, textEl);
      pushLine(line);
    },
    system(text: string) {
      const line = doc.createElement('div');
      line.className = 'ch-line';
      const span = doc.createElement('span');
      span.className = 'ch-sys';
      span.textContent = text;
      line.appendChild(span);
      pushLine(line);
    },
    onOpenChange(fn: (open: boolean) => void) {
      listeners.push(fn);
    },
  };
  return api;
}
