// STUB: chat log, orbs, hitsplats, overhead HP bars, hover text, context menu. Replaced in epic 2.
import type * as THREE from 'three';

export interface MenuOption {
  /** e.g. "Attack Feral gnome (level 3)". The first option is the left-click default. */
  label: string;
  onSelect: () => void;
}

export function createHud(_root: HTMLElement): void {}
export function updateHud(_dt: number, _camera: THREE.Camera): void {}
/** Top-left mouse-over text (RuneScape style); null hides it. */
export function setHoverText(_text: string | null): void {}
/** Opens a right-click menu at screen (x, y) in CSS pixels. */
export function showContextMenu(_x: number, _y: number, _options: MenuOption[]): void {}
export function hideContextMenu(): void {}
