// Raft Gnome: scene setup and the main loop. Systems live one per file; this file only wires them.
import * as THREE from 'three';
import { COLORS, SEA, TELESCOPE, type Ctx, type System } from './config';
import { createInput } from './input';
import { newState, tickWorld } from './rules';
import { createOcean } from './ocean';
import { createRaft } from './raft';
import { createPlayer } from './player';
import { createMowing } from './mowing';
import { createFishing } from './fishing';
import { createBuilding } from './building';
import { createNavigation } from './navigation';
import { createHud } from './hud';
import { createDayNight } from './daynight';
import { createWeather } from './weather';
import { createSeagull } from './seagull';
import { createShark } from './shark';
import { createMinimap } from './minimap';
import { createObjectives } from './objectives';
import { createMusic } from './music';
import { createSave, loadGame } from './save';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: location.hash.startsWith('#snap') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.sky, SEA.fogNear, SEA.fogFar);

const camera = new THREE.PerspectiveCamera(TELESCOPE.normalFov, 1, 0.1, SEA.cameraFar);

const hemi = new THREE.HemisphereLight(0xdff3ff, 0x2a5d7a, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 150;
scene.add(sun);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const state = newState();
if (!location.hash) loadGame(state);
const input = createInput(canvas);
const ctx: Ctx = { scene, camera, renderer, state, input, ui, lights: { sun, hemi } };
(window as unknown as { raft: unknown }).raft = state; // debug handle

canvas.addEventListener('click', () => {
  if (state.mode === 'play' || state.mode === 'build' || state.mode === 'telescope') input.requestLock();
});

// Update order matters: the player sets the camera, then the telescope may override it.
const systems: System[] = [
  createOcean(ctx),
  createDayNight(ctx),
  createWeather(ctx),
  createRaft(ctx),
  createPlayer(ctx),
  createMowing(ctx),
  createFishing(ctx),
  createBuilding(ctx),
  createSeagull(ctx),
  createShark(ctx),
  createNavigation(ctx),
  createMinimap(ctx),
  createObjectives(ctx),
  createMusic(ctx),
  createSave(ctx),
  createHud(ctx),
];

let last = performance.now();
function step(): void {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (state.mode !== 'title') tickWorld(state, dt);
  for (const s of systems) s.update(dt);
  input.endFrame();
  renderer.render(scene, camera);
}

const debugHash = location.hash;
if (debugHash === '#selftest' || debugHash.startsWith('#snap')) {
  // Headless browsers may not fire requestAnimationFrame, so debug runs tick on a timer.
  document.getElementById('rg-title')?.remove();
  setInterval(step, 16);
  void import('./selftest').then((m) =>
    debugHash === '#selftest' ? m.runSelfTest(state, ui) : m.runSnap(state, ui, canvas, debugHash.split('=')[1] ?? 'raft'),
  );
} else {
  const frame = (): void => {
    step();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
