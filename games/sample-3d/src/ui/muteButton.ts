/** The music on/off button beside the pause button (reuses the .vb-btn style). M toggles too. */
export function createMuteButton(parent: HTMLElement, isMuted: () => boolean, onToggle: () => void): { show(): void; hide(): void } {
  const btn = document.createElement('button');
  btn.className = 'vb-btn';
  btn.style.right = '152px';
  btn.title = 'Music on/off (M)';
  const render = (): void => {
    const off = isMuted();
    btn.innerHTML = `<span class="vb-icon">${off ? '🔇' : '🎵'}</span><span class="vb-label">${off ? 'OFF' : 'MUSIC'}</span><span class="vb-key">M</span>`;
  };
  const toggle = (): void => { onToggle(); render(); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });
  btn.addEventListener('click', (e) => e.stopPropagation());
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM' || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return; // typing in chat or name box
    toggle();
  });
  render();
  parent.appendChild(btn);
  return {
    show() { btn.style.display = 'flex'; },
    hide() { btn.style.display = 'none'; },
  };
}
