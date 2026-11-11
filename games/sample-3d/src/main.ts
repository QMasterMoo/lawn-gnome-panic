import * as THREE from 'three';
import { COLORS, OBSTACLES, PLAYER_RADIUS, MOWER_RADIUS, MOWER_HEIGHT, TUNING, type GamePhase, type GameOverData } from './config';
import { createInput } from './input';
import { createCameraRig } from './camera';
import { createPlayerState, updatePlayer } from './player';
import { createGnome } from './gnome';
import { buildWorld } from './world';
import { createMowerSystem } from './mowers';
import { createPickupSystem } from './pickups';
import { createUI } from './ui';
import { getHighScore, submitScore } from './storage';
import { playSfx, setEngineLevel } from './audio';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.sky, 35, 80);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas);
const rig = createCameraRig(camera);
const world = buildWorld(scene);
const gnome = createGnome();
scene.add(gnome.object);
const mowers = createMowerSystem(scene);
const pickups = createPickupSystem(scene);
const ui = createUI(document.getElementById('ui') as HTMLElement);

let phase: GamePhase = 'title';
let player = createPlayerState();
let score = 0;
let elapsed = 0;
let acorns = 0;
let deadTimer = 0;

function startRound(): void {
  player = createPlayerState();
  score = 0;
  elapsed = 0;
  acorns = 0;
  mowers.reset();
  pickups.reset();
  world.reset();
  rig.reset(0);
  gnome.setDead(false);
  phase = 'playing';
  playSfx('start');
}

function endRound(): void {
  phase = 'gameover';
  deadTimer = 0;
  gnome.setDead(true);
  playSfx('hit');
  setEngineLevel(0);
  const data: GameOverData = { score: Math.floor(score), secondsSurvived: Math.floor(elapsed), acorns };
  const isNewHigh = submitScore(data.score);
  ui.showGameOver(data, isNewHigh, getHighScore());
}

ui.showTitle(getHighScore());

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const inp = input.read(dt);

  if (phase === 'playing') {
    elapsed += dt;
    const { jumped } = updatePlayer(player, inp, rig.yaw, OBSTACLES, dt);
    if (jumped) playSfx('jump');
    if (player.position.y < 0.05) score += TUNING.survivalScorePerSec * dt;

    mowers.update(dt, elapsed, player.position, OBSTACLES, (x, z) => world.markMowed(x, z));

    const got = pickups.update(dt, player.position);
    if (got > 0) {
      acorns += got;
      score += got * TUNING.pickupScore;
      playSfx('pickup');
    }

    setEngineLevel(Math.max(0, 1 - mowers.nearestDistance(player.position) / 15));

    for (const m of mowers.positions()) {
      const d = Math.hypot(m.x - player.position.x, m.z - player.position.z);
      if (d < PLAYER_RADIUS + MOWER_RADIUS && player.position.y < MOWER_HEIGHT) {
        endRound();
        break;
      }
    }
    if (phase === 'playing') ui.showHud(Math.floor(score), elapsed, acorns);
  } else {
    if (phase === 'gameover') deadTimer += dt;
    if (inp.start && (phase === 'title' || deadTimer > 0.6)) startRound();
  }

  gnome.update(player, dt);
  rig.update(player.position, inp, dt);
  world.update(dt);
  renderer.render(scene, camera);
});
