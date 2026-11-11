import type { KillEvent, RoyaleHud, RoyaleHudData, ZoneState } from '../config';

/** Battle royale overlay: gnomes remaining, zone timer, kill feed. */

const FEED_MAX = 6;
const FEED_LIFE_MS = 7000;
const FEED_FADE_MS = 600;
const VERBS = [
  'got mowed by',
  'was mulched by',
  'became lawn clippings thanks to',
  'was tidied up by',
  'got trimmed by',
];

const CSS = `
.br-root { position: absolute; inset: 0; pointer-events: none; font-family: 'Arial Black', Impact, system-ui, sans-serif; color: #fff; text-shadow: 0 2px 0 #000, 0 0 8px rgba(0, 0, 0, 0.8); }
.br-remaining { position: absolute; top: 96px; right: 20px; text-align: right; }
.br-num { display: inline-block; font-size: 44px; line-height: 1; transform-origin: 50% 50%; }
.br-num.br-pop { animation: br-pop 0.4s ease-out; }
.br-label { font-size: 12px; letter-spacing: 2px; }
.br-zone { font-size: 16px; margin-top: 4px; white-space: nowrap; }
.br-zone.br-blink { color: #ff6b5a; animation: br-blink 0.6s steps(2, start) infinite; }
.br-warn { position: absolute; left: 0; right: 0; bottom: 80px; text-align: center; font-size: 26px; color: #ff5252; animation: br-pulse 1s ease-in-out infinite; }
.br-feed { position: absolute; left: 16px; top: 190px; width: min(420px, 70vw); display: flex; flex-direction: column; gap: 4px; font-size: 15px; }
.br-line { transition: opacity ${FEED_FADE_MS}ms linear; animation: br-slide 0.3s ease-out; }
.br-line.br-out { opacity: 0; }
.br-victim { color: #ffd54f; font-weight: 900; }
@keyframes br-pop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }
@keyframes br-blink { 50% { opacity: 0.3; } }
@keyframes br-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes br-slide { from { transform: translateX(-30px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (max-width: 760px) {
  .br-num { font-size: 30px; }
  .br-feed { top: 150px; font-size: 12px; max-width: 60vw; }
  .br-warn { font-size: 16px; }
}
`;

interface FeedLine {
  el: HTMLElement;
  timers: ReturnType<typeof setTimeout>[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function zoneLine(z: ZoneState): { text: string; blink: boolean } {
  if (z.phase === 'shrinking') return { text: 'ZONE SHRINKING!', blink: true };
  if (z.phase === 'final') return { text: 'FINAL CIRCLE', blink: false };
  const s = Math.max(0, Math.ceil(z.secondsToNext));
  return { text: `ZONE SHRINKS IN ${Math.floor(s / 60)}:${pad2(s % 60)}`, blink: false };
}

export function createRoyaleHud(parent: HTMLElement): RoyaleHud {
  const doc = parent.ownerDocument;

  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  const root = doc.createElement('div');
  root.className = 'br-root';
  root.style.display = 'none';

  const remaining = doc.createElement('div');
  remaining.className = 'br-remaining';
  const num = doc.createElement('div');
  num.className = 'br-num';
  const label = doc.createElement('div');
  label.className = 'br-label';
  label.textContent = 'GNOMES LEFT';
  const zoneEl = doc.createElement('div');
  zoneEl.className = 'br-zone';
  remaining.append(num, label, zoneEl);

  const warn = doc.createElement('div');
  warn.className = 'br-warn';
  warn.textContent = 'YOU ARE IN THE MOW ZONE · GET TO THE CIRCLE';
  warn.style.display = 'none';

  const feedEl = doc.createElement('div');
  feedEl.className = 'br-feed';

  root.append(remaining, warn, feedEl);
  parent.appendChild(root);

  let lastAlive = -1;
  let lastZone = '';
  let lastBlink = false;
  let lastOutside: boolean | null = null;
  const lines: FeedLine[] = [];

  function popNumber(): void {
    num.classList.remove('br-pop');
    void num.offsetWidth; // restart the animation
    num.classList.add('br-pop');
  }

  function removeLine(line: FeedLine): void {
    line.timers.forEach((t) => clearTimeout(t));
    line.el.remove();
    const i = lines.indexOf(line);
    if (i >= 0) lines.splice(i, 1);
  }

  function clearFeed(): void {
    lines.slice().forEach(removeLine);
  }

  return {
    show() {
      root.style.display = '';
    },

    hide() {
      root.style.display = 'none';
      clearFeed();
    },

    update(d: RoyaleHudData) {
      if (d.alive !== lastAlive) {
        if (d.alive < lastAlive) popNumber();
        lastAlive = d.alive;
        num.textContent = String(d.alive);
      }

      const z = zoneLine(d.zone);
      if (z.text !== lastZone) {
        zoneEl.textContent = z.text;
        lastZone = z.text;
      }
      if (z.blink !== lastBlink) {
        zoneEl.classList.toggle('br-blink', z.blink);
        lastBlink = z.blink;
      }

      if (d.playerOutside !== lastOutside) {
        warn.style.display = d.playerOutside ? '' : 'none';
        lastOutside = d.playerOutside;
      }
    },

    feed(e: KillEvent) {
      const el = doc.createElement('div');
      el.className = 'br-line';

      const skull = doc.createElement('span');
      skull.textContent = '☠ ';
      const victim = doc.createElement('span');
      victim.className = 'br-victim';
      victim.textContent = e.victim;
      el.append(skull, victim);

      const rest =
        e.cause === 'THE MOW ZONE'
          ? ' wandered into THE MOW ZONE'
          : ` ${VERBS[Math.floor(Math.random() * VERBS.length)]} ${e.cause}`;
      el.appendChild(doc.createTextNode(rest));

      feedEl.appendChild(el);

      const line: FeedLine = { el, timers: [] };
      lines.push(line);
      line.timers.push(setTimeout(() => el.classList.add('br-out'), FEED_LIFE_MS));
      line.timers.push(setTimeout(() => removeLine(line), FEED_LIFE_MS + FEED_FADE_MS));

      while (lines.length > FEED_MAX) removeLine(lines[0]);
    },
  };
}
