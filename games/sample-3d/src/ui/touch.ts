import { TUNING, type TouchControls } from '../config';

/** Virtual joystick, look-drag and JUMP/SPRINT buttons for touch screens. */

const JOY_BASE_PX = 120;
const JOY_KNOB_PX = 56;
const JOY_RADIUS = 60;     // knob travel from the base centre, px
const JOY_DEADZONE = 0.12;
const LOOK_GAIN = 1.6;
const NARROW_PX = 700;
const NARROW_SCALE = 0.85;

const CSS = `
.tc-root { position: fixed; inset: 0; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; pointer-events: none; }
.tc-base, .tc-knob, .tc-btn { position: absolute; display: none; box-sizing: border-box; touch-action: none; user-select: none; -webkit-user-select: none; }
.tc-base { width: ${JOY_BASE_PX}px; height: ${JOY_BASE_PX}px; border-radius: 50%; background: rgba(255,255,255,.15); border: 2px solid #fff; transform: translate(-50%, -50%); }
.tc-knob { width: ${JOY_KNOB_PX}px; height: ${JOY_KNOB_PX}px; border-radius: 50%; background: rgba(255,255,255,.6); transform: translate(-50%, -50%); }
.tc-btn { align-items: center; justify-content: center; border-radius: 50%; font-family: sans-serif; font-weight: 700; transition: transform .05s, filter .05s; }
.tc-jump { bottom: 90px; right: 40px; background: #ffd54f; color: #222; border: 2px solid #ffecb3; }
.tc-sprint { bottom: 200px; right: 70px; background: rgba(255,255,255,.35); color: #fff; border: 2px solid rgba(255,255,255,.6); }
.tc-pressed { transform: scale(.92); filter: brightness(1.35); }
.tc-root.tc-on .tc-btn { display: flex; }
.tc-root.tc-on .tc-base.tc-show, .tc-root.tc-on .tc-knob.tc-show { display: block; }
`;

function injectStyle(): void {
  if (document.getElementById('tc-style')) return;
  const style = document.createElement('style');
  style.id = 'tc-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function makeEl(cls: string, text = ''): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  return d;
}

export function createTouchControls(parent: HTMLElement): TouchControls {
  injectStyle();

  const root = makeEl('tc-root');
  const base = makeEl('tc-base');
  const knob = makeEl('tc-knob');
  const jumpBtn = makeEl('tc-btn tc-jump', 'JUMP');
  const sprintBtn = makeEl('tc-btn tc-sprint', 'SPRINT');
  root.append(base, knob, jumpBtn, sprintBtn);
  parent.appendChild(root);

  let active = window.matchMedia('(pointer: coarse)').matches;
  let visible = false;

  // Joystick: one pointer at a time, floating base at the touch-down point.
  let joyPid: number | null = null;
  let joyX = 0;
  let joyY = 0;
  let joyOffX = 0; // clamped knob offset from base centre, px
  let joyOffY = 0;
  let moveX = 0;
  let moveY = 0;

  // Buttons.
  let jumpPid: number | null = null;
  let jumpEdge = false;
  let sprintPid: number | null = null;
  let sprintHeld = false;

  // Look drag: every pointer that started on the right half, with its last position.
  const lookPtrs = new Map<number, { x: number; y: number }>();
  let lookDx = 0;
  let lookDy = 0;

  function placeJoy(): void {
    base.style.left = `${joyX}px`;
    base.style.top = `${joyY}px`;
    knob.style.left = `${joyX + joyOffX}px`;
    knob.style.top = `${joyY + joyOffY}px`;
  }

  function layout(): void {
    const s = window.innerWidth < NARROW_PX ? NARROW_SCALE : 1;
    jumpBtn.style.width = jumpBtn.style.height = `${96 * s}px`;
    jumpBtn.style.fontSize = `${22 * s}px`;
    sprintBtn.style.width = sprintBtn.style.height = `${76 * s}px`;
    sprintBtn.style.fontSize = `${14 * s}px`;
  }

  function render(): void {
    const on = visible && active;
    root.style.pointerEvents = on ? 'auto' : 'none';
    root.classList.toggle('tc-on', on);
    jumpBtn.classList.toggle('tc-pressed', jumpPid !== null);
    sprintBtn.classList.toggle('tc-pressed', sprintPid !== null);
    const joyShown = on && joyPid !== null;
    base.classList.toggle('tc-show', joyShown);
    knob.classList.toggle('tc-show', joyShown);
  }

  function onRootDown(e: PointerEvent): void {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    if (x < window.innerWidth * 0.5) {
      if (joyPid !== null) return; // joystick already owned by another finger
      joyPid = e.pointerId;
      joyX = x;
      joyY = y;
      joyOffX = 0;
      joyOffY = 0;
      moveX = 0;
      moveY = 0;
      placeJoy();
    } else {
      lookPtrs.set(e.pointerId, { x, y });
    }
    render();
  }

  function onButtonDown(kind: 'jump' | 'sprint') {
    return (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation(); // do not start a look drag or joystick
      if (kind === 'jump') {
        jumpPid = e.pointerId;
        jumpEdge = true;
      } else {
        sprintPid = e.pointerId;
        sprintHeld = true;
      }
      render();
    };
  }

  function onWindowMove(e: PointerEvent): void {
    if (e.pointerId === joyPid) {
      e.preventDefault();
      let ox = e.clientX - joyX;
      let oy = e.clientY - joyY;
      const len = Math.hypot(ox, oy);
      if (len > JOY_RADIUS) {
        ox *= JOY_RADIUS / len;
        oy *= JOY_RADIUS / len;
      }
      joyOffX = ox;
      joyOffY = oy;
      let mx = ox / JOY_RADIUS;
      let my = -oy / JOY_RADIUS;
      const mag = Math.hypot(mx, my);
      if (mag < JOY_DEADZONE) {
        mx = 0;
        my = 0;
      } else if (mag > 1) {
        mx /= mag;
        my /= mag;
      }
      moveX = mx;
      moveY = my;
      placeJoy();
    }
    const look = lookPtrs.get(e.pointerId);
    if (look) {
      e.preventDefault();
      lookDx += e.clientX - look.x;
      lookDy += e.clientY - look.y;
      look.x = e.clientX;
      look.y = e.clientY;
    }
  }

  function onWindowUp(e: PointerEvent): void {
    if (e.pointerId === joyPid) {
      joyPid = null;
      moveX = 0;
      moveY = 0;
    }
    lookPtrs.delete(e.pointerId);
    if (e.pointerId === jumpPid) jumpPid = null;
    if (e.pointerId === sprintPid) {
      sprintPid = null;
      sprintHeld = false;
    }
    render();
  }

  function onWindowDown(e: PointerEvent): void {
    if (e.pointerType === 'touch' && !active) {
      active = true;
      render();
    }
  }

  root.addEventListener('pointerdown', onRootDown);
  jumpBtn.addEventListener('pointerdown', onButtonDown('jump'));
  sprintBtn.addEventListener('pointerdown', onButtonDown('sprint'));
  window.addEventListener('pointerdown', onWindowDown);
  window.addEventListener('pointermove', onWindowMove);
  window.addEventListener('pointerup', onWindowUp);
  window.addEventListener('pointercancel', onWindowUp);
  window.addEventListener('resize', layout);

  layout();
  render();

  return {
    get active(): boolean {
      return active;
    },
    read() {
      const out = {
        moveX,
        moveY,
        jump: jumpEdge,
        sprint: sprintHeld,
        lookX: lookDx * TUNING.cameraLookSensitivity * LOOK_GAIN,
        lookY: lookDy * TUNING.cameraLookSensitivity * LOOK_GAIN,
      };
      jumpEdge = false;
      lookDx = 0;
      lookDy = 0;
      return out;
    },
    setVisible(v: boolean) {
      visible = v;
      if (!v) {
        joyPid = null;
        moveX = 0;
        moveY = 0;
        jumpPid = null;
        jumpEdge = false;
        sprintPid = null;
        sprintHeld = false;
        lookPtrs.clear();
        lookDx = 0;
        lookDy = 0;
      }
      render();
    },
  };
}
