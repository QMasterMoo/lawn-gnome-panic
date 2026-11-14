import type { TrackInfo } from '../music';

/**
 * A small "Now playing" card that slides in at the bottom right when a run's track starts,
 * then slides away after a few seconds. Display only: it never takes input.
 */
export function createNowPlaying(parent: HTMLElement): { show(info: TrackInfo): void; hide(): void } {
  if (!document.getElementById('np-style')) {
    const style = document.createElement('style');
    style.id = 'np-style';
    style.textContent = `
.np-card {
  position: absolute; right: 24px; bottom: 60px; max-width: min(320px, calc(100vw - 48px));
  padding: 8px 14px 9px 12px; box-sizing: border-box; pointer-events: none; z-index: 4;
  background: linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.5)); border-left: 3px solid #ffd54f;
  border-radius: 4px; color: #fff; font-family: system-ui, sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,.6);
  opacity: 0; transform: translateX(30px); transition: opacity .35s ease, transform .35s ease;
}
.np-card.on { opacity: 1; transform: translateX(0); }
.np-head { font: 900 9px 'Arial Black', Impact, system-ui, sans-serif; letter-spacing: 2px; color: #ffd54f; opacity: .9; }
.np-title { font-size: 15px; font-weight: 800; line-height: 1.25; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-artist { font-size: 13px; opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.np-label { font-size: 10px; opacity: .55; letter-spacing: .5px; margin-top: 1px; }
@media (max-width: 760px) { .np-card { bottom: 56px; right: 12px; } .np-title { font-size: 13px; } .np-artist { font-size: 12px; } }
`;
    document.head.appendChild(style);
  }
  const card = document.createElement('div');
  card.className = 'np-card';
  card.innerHTML = '<div class="np-head">♪ NOW PLAYING</div><div class="np-title"></div><div class="np-artist"></div><div class="np-label"></div>';
  const title = card.querySelector('.np-title') as HTMLElement;
  const artist = card.querySelector('.np-artist') as HTMLElement;
  const label = card.querySelector('.np-label') as HTMLElement;
  parent.appendChild(card);

  let timer: number | undefined;
  return {
    show(info) {
      title.textContent = info.title;
      artist.textContent = info.artist;
      label.textContent = `${info.label} · ${info.year}`;
      card.classList.remove('on');
      window.clearTimeout(timer);
      // Small delay so it lands after the run's start banner, then hold for a few seconds.
      timer = window.setTimeout(() => {
        card.classList.add('on');
        timer = window.setTimeout(() => card.classList.remove('on'), 6000);
      }, 1200);
    },
    hide() {
      window.clearTimeout(timer);
      card.classList.remove('on');
    },
  };
}
