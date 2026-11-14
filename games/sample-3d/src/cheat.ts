// src/cheat.ts
/** Calls onCode when the last letters typed spell `code`. Typing in a text box does not count. */
export function listenForCheat(code: string, onCode: () => void): void {
  let typed = '';
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-code.length);
    if (typed === code) {
      typed = '';
      onCode();
    }
  });
}
