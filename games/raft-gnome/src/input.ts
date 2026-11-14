// Keyboard + mouse state, sampled per frame. Call endFrame() once at the end of every frame.

export interface Input {
  /** Key held (KeyboardEvent.code, e.g. 'KeyW'). */
  down(code: string): boolean;
  /** Key went down this frame. */
  pressed(code: string): boolean;
  /** Mouse button held (0 = left, 2 = right). */
  mouseDown(button: number): boolean;
  mousePressed(button: number): boolean;
  mouseReleased(button: number): boolean;
  /** Mouse movement since last frame, in pixels (works with pointer lock). */
  look(): { dx: number; dy: number };
  locked(): boolean;
  requestLock(): void;
  exitLock(): void;
  endFrame(): void;
}

export function createInput(canvas: HTMLCanvasElement): Input {
  const keys = new Set<string>();
  const keysPressed = new Set<string>();
  const buttons = new Set<number>();
  const btnPressed = new Set<number>();
  const btnReleased = new Set<number>();
  let dx = 0;
  let dy = 0;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (!keys.has(e.code)) keysPressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); buttons.clear(); });
  canvas.addEventListener('mousedown', (e) => { buttons.add(e.button); btnPressed.add(e.button); });
  window.addEventListener('mouseup', (e) => {
    if (buttons.delete(e.button)) btnReleased.add(e.button);
  });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      dx += e.movementX;
      dy += e.movementY;
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    down: (c) => keys.has(c),
    pressed: (c) => keysPressed.has(c),
    mouseDown: (b) => buttons.has(b),
    mousePressed: (b) => btnPressed.has(b),
    mouseReleased: (b) => btnReleased.has(b),
    look: () => ({ dx, dy }),
    locked: () => document.pointerLockElement === canvas,
    requestLock: () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    },
    exitLock: () => {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    endFrame: () => {
      keysPressed.clear();
      btnPressed.clear();
      btnReleased.clear();
      dx = 0;
      dy = 0;
    },
  };
}
