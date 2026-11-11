// src/ui.ts
import type { GameOverData, UI } from './config';

const CSS = `
.hud{position:absolute;top:12px;left:16px;font-size:22px;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,.5);pointer-events:none}
.panel{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(10,30,10,.45);text-align:center;text-shadow:0 2px 6px rgba(0,0,0,.6);pointer-events:none}
.title{font-size:64px;font-weight:900;color:#ffd54f;letter-spacing:2px}
.big{font-size:32px}
.small{font-size:18px;opacity:.9}
.blink{animation:blink 1.2s infinite alternate}
@keyframes blink{from{opacity:1}to{opacity:.35}}
.pop{color:#ffd54f;font-size:28px;animation:pop .5s infinite alternate}
@keyframes pop{from{transform:scale(1)}to{transform:scale(1.12)}}
`;

function el(tag: string, className: string, text = ''): HTMLDivElement {
  const node = document.createElement(tag) as HTMLDivElement;
  node.className = className;
  node.textContent = text;
  return node;
}

export function createUI(root: HTMLElement): UI {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const hud = el('div', 'hud');
  hud.style.display = 'none';
  let lastHudText = '';

  // Title panel
  const titlePanel = el('div', 'panel');
  titlePanel.style.display = 'none';
  const titleHeading = el('div', 'title', 'LAWN GNOME PANIC');
  const titleTagline = el('div', 'small', 'Dodge the lawn mowers. Grab the golden acorns.');
  const titleControls = el(
    'div',
    'small',
    'WASD / arrows to run · Space to jump (press again in the air to double jump) · Mouse or Q/E to look',
  );
  const titleGamepad = el('div', 'small', 'Gamepad works too.');
  const titleHighScore = el('div', 'small', '');
  const titlePrompt = el('div', 'big blink', 'Click or press Space to start');
  titlePanel.append(titleHeading, titleTagline, titleControls, titleGamepad, titleHighScore, titlePrompt);

  // Game-over panel
  const overPanel = el('div', 'panel');
  overPanel.style.display = 'none';
  const overHeading = el('div', 'title', 'MOWED!');
  overHeading.style.color = '#ff6b5a';
  const overScore = el('div', 'big', '');
  const overSurvived = el('div', 'small', '');
  const overHighLine = el('div', 'small', '');
  const overPrompt = el('div', 'big blink', 'Click or press Space to play again');
  overPanel.append(overHeading, overScore, overSurvived, overHighLine, overPrompt);

  root.append(hud, titlePanel, overPanel);

  function showOnly(which: 'hud' | 'title' | 'over' | 'none'): void {
    hud.style.display = which === 'hud' ? 'block' : 'none';
    titlePanel.style.display = which === 'title' ? 'flex' : 'none';
    overPanel.style.display = which === 'over' ? 'flex' : 'none';
  }

  return {
    showTitle(highScore: number) {
      titleHighScore.textContent = `High score: ${highScore}`;
      showOnly('title');
    },
    showHud(score: number, seconds: number, acorns: number) {
      const text = `Score ${score}   ·   ${seconds.toFixed(1)}s   ·   Acorns ${acorns}`;
      if (text !== lastHudText) {
        hud.textContent = text;
        lastHudText = text;
      }
      showOnly('hud');
    },
    showGameOver(data: GameOverData, isNewHigh: boolean, highScore: number) {
      overScore.textContent = `Score ${data.score}`;
      overSurvived.textContent = `Survived ${data.secondsSurvived}s · ${data.acorns} acorns`;
      if (isNewHigh) {
        overHighLine.className = 'pop';
        overHighLine.textContent = 'NEW HIGH SCORE!';
      } else {
        overHighLine.className = 'small';
        overHighLine.textContent = `High score: ${highScore}`;
      }
      showOnly('over');
    },
  };
}
