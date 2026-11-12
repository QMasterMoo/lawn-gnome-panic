/** The ⏸ button beside the camera button (reuses its .vb-btn style). */
export function createPauseButton(parent: HTMLElement, onPress: () => void): { show(): void; hide(): void } {
  const btn = document.createElement('button');
  btn.className = 'vb-btn';
  btn.style.right = '84px';
  btn.title = 'Pause (Esc)';
  btn.innerHTML = '<span class="vb-icon">⏸</span><span class="vb-label">PAUSE</span><span class="vb-key">ESC</span>';
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPress();
  });
  btn.addEventListener('click', (e) => e.stopPropagation());
  parent.appendChild(btn);
  return {
    show() { btn.style.display = 'flex'; },
    hide() { btn.style.display = 'none'; },
  };
}
