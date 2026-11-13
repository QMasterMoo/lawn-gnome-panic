/** '#rrggbb' for a 0xRRGGBB colour. */
export function colorCss(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** 'rgba(r,g,b,a)' for a 0xRRGGBB colour. */
export function colorRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Styles an inline element as a player name (or chat text): the player's colour on a dark chip
 *  with a dim outline in that colour, readable over anything. Sets inline styles only. */
export function stylePlayerName(el: HTMLElement, color: number): void {
  el.style.color = colorCss(color);
  el.style.background = 'rgba(0,0,0,0.6)';
  el.style.boxShadow = `inset 0 0 0 1px ${colorRgba(color, 0.45)}`;
  el.style.borderRadius = '3px';
  el.style.padding = '0 4px';
  el.style.textShadow = 'none';
}
