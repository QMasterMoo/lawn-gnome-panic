import * as THREE from 'three';
import {
  COLORS, OBSTACLES, PLAYER_RADIUS, PEDESTAL_HEIGHT, MOWER_TIERS, TUNING, WAVES,
  type GamePhase, type InputState, type MowerTier, type RunSummary, type UpgradeChoice,
  type Weapon, type WeaponContext, type WeaponId, type MetaUpgradeId, type VisualMode, type ItemKind,
  ITEM_DEFS, CHICKEN_HEAL,
} from './config';
import { createInput } from './input';
import { createCameraRig } from './camera';
import { createPlayerState, updatePlayer } from './player';
import { createGnome } from './gnome';
import { buildWorld } from './world';
import { createMowerSystem } from './mowers';
import { createPickupSystem } from './pickups';
import { createDropSystem } from './drops';
import { createLobbyStage } from './lobbyStage';
import { createLobbyUI } from './ui/lobby';
import { createHud } from './ui/hud';
import { createLevelUpUI } from './ui/levelup';
import { createResultsUI } from './ui/results';
import { loadSave, writeSave, tryBuy } from './save';
import { computeStats } from './stats';
import { createRun, addXp, rollChoices, applyChoice } from './run';
import { WEAPON_FACTORIES } from './weapons';
import { playSfx, setEngineLevel } from './audio';
import { loadFlags, saveFlags } from './flags';
import { createPostFX } from './postfx';
import { buildProp } from './props';
import { buildHouse } from './house';
import { buildScenery } from './scenery';
import { createItemSystem } from './items';
import { createJuice } from './juice';

// ---------- renderer, scene, camera ----------
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.sky, 60, 380);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2600);
const postfx = createPostFX(renderer, scene, camera);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  postfx.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- systems ----------
const uiRoot = document.getElementById('ui') as HTMLElement;
const input = createInput(canvas);
const rig = createCameraRig(camera);
const world = buildWorld(scene);
const props = OBSTACLES.map((o) => {
  const obj = buildProp(o);
  scene.add(obj);
  return { o, obj };
});
let cullTimer = 0;
/** Hides props far from the player; the fog hides the pop-in. */
function cullProps(dt: number, focus: THREE.Vector3): void {
  cullTimer -= dt;
  if (cullTimer > 0) return;
  cullTimer = 0.25;
  for (const p of props) {
    const d = Math.hypot(p.o.x - focus.x, p.o.z - focus.z);
    p.obj.visible = d < TUNING.propCullDist + p.o.height * 2;
  }
}
buildHouse(scene);
const scenery = buildScenery(scene);
const gnome = createGnome();
scene.add(gnome.object);
const mowers = createMowerSystem(scene);
const pickups = createPickupSystem(scene);
const drops = createDropSystem(scene);
const items = createItemSystem(scene);
const juice = createJuice(uiRoot);
const lobbyStage = createLobbyStage(scene);
const hud = createHud(uiRoot);
const levelUp = createLevelUpUI(uiRoot);
const results = createResultsUI(uiRoot);
const lobbyUI = createLobbyUI(uiRoot, {
  onPlay: () => { if (phase === 'lobby') startRun(); },
  onBuy: (id: MetaUpgradeId) => {
    if (tryBuy(save, id)) {
      playSfx('buy');
      lobbyUI.refresh(save);
    }
  },
  onVisualMode: (mode: VisualMode) => {
    flags.visualMode = mode;
    saveFlags(flags);
    postfx.setMode(mode);
    lobbyUI.setVisualMode(mode);
    playSfx('buy');
  },
});

// ---------- state ----------
const save = loadSave();
const flags = loadFlags();
postfx.setMode(flags.visualMode);
lobbyUI.setVisualMode(flags.visualMode);
let phase: GamePhase = 'lobby';
let run = createRun(save);
let stats = computeStats(save, null);
let player = createPlayerState(stats);
const weapons = new Map<WeaponId, Weapon>();
let pendingLevelUps = 0;
let choices: UpgradeChoice[] = [];
let waveIndex = -1;
let victoryTimer = -1;
let killedBy: MowerTier | null = null;
let espressoS = 0;
let celebrateS = 0;
let bestToastDone = false;

const NO_INPUT: InputState = { moveX: 0, moveY: 0, jump: false, sprint: false, start: false, lookX: 0, lookY: 0 };

function waveIndexAt(t: number): number {
  let i = 0;
  while (i + 1 < WAVES.length && WAVES[i + 1].fromS <= t) i++;
  return i;
}

function syncWeapons(): void {
  for (const [id, level] of Object.entries(run.weapons) as [WeaponId, number][]) {
    let w = weapons.get(id);
    if (!w) {
      w = WEAPON_FACTORIES[id](scene);
      weapons.set(id, w);
    }
    w.setLevel(level);
  }
}

function clearWeapons(): void {
  for (const w of weapons.values()) w.dispose();
  weapons.clear();
}

function clearField(): void {
  clearWeapons();
  mowers.reset();
  drops.reset();
  pickups.reset();
  items.reset();
  juice.reset();
  world.reset();
}

// ---------- phases ----------
function goLobby(): void {
  phase = 'lobby';
  clearField();
  stats = computeStats(save, null);
  player = createPlayerState(stats);
  player.position.y = PEDESTAL_HEIGHT;
  gnome.setDead(false);
  gnome.object.visible = true;
  lobbyStage.setVisible(true);
  hud.hide();
  levelUp.hide();
  results.hide();
  lobbyUI.show(save);
  input.setPointerLockAllowed(false);
  setEngineLevel(0);
}

function startRun(): void {
  lobbyUI.hide();
  lobbyStage.setVisible(false);
  clearField();
  run = createRun(save);
  stats = computeStats(save, run);
  player = createPlayerState(stats);
  pendingLevelUps = 0;
  waveIndex = -1;
  victoryTimer = -1;
  killedBy = null;
  espressoS = 0;
  celebrateS = 0;
  bestToastDone = save.bestTimeS <= 0;
  syncWeapons();
  rig.reset(0);
  hud.show();
  hud.banner(`RUN #${save.runs + 1} BEGINS`, 'Death is permanent. Your upgrades are not. Very roguelike.', 3);
  phase = 'playing';
  input.setPointerLockAllowed(true);
  playSfx('start');
}

function openLevelUp(): void {
  phase = 'levelup';
  input.setPointerLockAllowed(false);
  setEngineLevel(0);
  choices = rollChoices(run, stats.choiceCount);
  levelUp.show(choices, run.rerollsLeft, onPick, onReroll);
}

function onPick(index: number): void {
  const c = choices[index];
  if (!c || phase !== 'levelup') return;
  applyChoice(run, c, stats);
  stats = computeStats(save, run);
  syncWeapons();
  pendingLevelUps--;
  levelUp.hide();
  if (pendingLevelUps > 0) {
    openLevelUp();
  } else {
    phase = 'playing';
    input.setPointerLockAllowed(true);
  }
}

function onReroll(): void {
  if (run.rerollsLeft <= 0 || phase !== 'levelup') return;
  run.rerollsLeft--;
  choices = rollChoices(run, stats.choiceCount);
  levelUp.show(choices, run.rerollsLeft, onPick, onReroll);
}

function endRun(victory: boolean): void {
  phase = 'results';
  input.setPointerLockAllowed(false);
  setEngineLevel(0);
  gnome.object.visible = true;
  if (victory) {
    playSfx('victory');
  } else {
    gnome.setDead(true);
    playSfx('hit');
  }
  const survivalBonus = Math.floor(run.elapsedS / 10) * TUNING.survivalAcornsPer10s;
  const bossBonus = run.bossDefeated ? TUNING.bossAcornBonus : 0;
  const totalEarned = run.acorns + survivalBonus + bossBonus;
  const newBestTime = Math.floor(run.elapsedS) > save.bestTimeS;
  save.runs += 1;
  save.acorns += totalEarned;
  save.totalAcornsEarned += totalEarned;
  if (newBestTime) save.bestTimeS = Math.floor(run.elapsedS);
  if (run.bossDefeated) save.bossKills += 1;
  writeSave(save);

  const summary: RunSummary = {
    runNumber: save.runs, victory, elapsedS: run.elapsedS, kills: run.kills, level: run.level,
    acornsCollected: run.acorns, survivalBonus, bossBonus, totalEarned, newBestTime,
    killedBy: victory ? null : killedBy,
  };
  hud.hide();
  results.show(summary, goLobby);
}

// ---------- the run ----------
function applyItem(kind: ItemKind): void {
  const def = ITEM_DEFS[kind];
  juice.toast(def.name, def.toast, '#' + def.color.toString(16).padStart(6, '0'));
  playSfx('buy');
  switch (kind) {
    case 'chicken':
      run.hearts = Math.min(stats.maxHearts, run.hearts + CHICKEN_HEAL);
      break;
    case 'shopVac':
      drops.vacuum();
      break;
    case 'weedKiller':
      for (const e of mowers.enemies()) {
        if (Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z) < TUNING.nukeRadius) {
          mowers.damage(e.id, e.tier === 'combine' ? TUNING.nukeBossDamage : 1e6);
        }
      }
      juice.shake(1.2);
      playSfx('boom');
      break;
    case 'espresso':
      espressoS = TUNING.espressoS;
      break;
    case 'compostBin':
      pendingLevelUps += 1;
      break;
  }
}

function tickRun(dt: number, inp: InputState): void {
  run.elapsedS += dt;

  const { jumped } = updatePlayer(player, inp, rig.yaw, OBSTACLES, stats, dt);
  if (jumped) playSfx('jump');

  // Waves and boss.
  const wi = waveIndexAt(run.elapsedS);
  if (wi !== waveIndex) {
    waveIndex = wi;
    const b = WAVES[wi].banner;
    if (b) hud.banner(b.title, b.sub, 3.5);
  }
  if (!run.bossSpawned && run.elapsedS >= TUNING.bossAtS) {
    run.bossSpawned = true;
    mowers.spawnBoss();
    playSfx('bossWarning');
    hud.banner('A COMBINE APPROACHES', 'Of course there is a boss fight. This is a roguelike.', 4);
  }

  // Mowers.
  const kills = mowers.update(dt, run.elapsedS, player.position, OBSTACLES, (x, z) => world.markMowed(x, z));
  for (const k of kills) {
    run.kills += 1;
    const def = MOWER_TIERS[k.tier];
    drops.spawnXp(k.x, k.z, def.xp);
    if (k.tier === 'combine') {
      drops.spawnAcorns(k.x, k.z, TUNING.bossAcornDrop);
      run.bossDefeated = true;
      victoryTimer = TUNING.victoryDelayS;
      hud.banner('COMBINE DEFEATED', 'The lawn is safe. For now. (It is never safe.)', 3);
      juice.shake(1.5);
    } else if (Math.random() < def.acornChance) {
      drops.spawnAcorns(k.x, k.z, 1);
    }
    juice.kill(k.x, k.z);
    playSfx('enemyDie');
  }

  // Weapons.
  const enemiesNow = mowers.enemies();
  const ctx: WeaponContext = {
    dt,
    player: player.position,
    facing: player.facing,
    enemies: enemiesNow,
    stats,
    damage: (id, amount) => {
      const e = enemiesNow.find((m) => m.id === id);
      if (e && e.hp > 0) juice.damageNumber(e.pos.x, 1.3, e.pos.z, amount);
      mowers.damage(id, amount);
      playSfx('enemyHit');
    },
    slow: (id, factor, seconds) => mowers.slow(id, factor, seconds),
    playSfx,
  };
  for (const w of weapons.values()) w.update(ctx);

  // Pickups.
  const got = drops.update(dt, player.position, stats.magnetRadius);
  if (got.xp > 0) {
    pendingLevelUps += addXp(run, got.xp * stats.xpMultiplier);
    playSfx('xp');
  }
  const acornGain = got.acorns + pickups.update(dt, player.position);
  if (acornGain > 0) {
    run.acorns += acornGain;
    playSfx('pickup');
  }
  for (const kind of items.update(dt, player.position)) applyItem(kind);

  if (espressoS > 0) {
    espressoS -= dt;
    player.stamina = stats.staminaMax;
    player.exhausted = false;
  }
  if (!bestToastDone && run.elapsedS > save.bestTimeS) {
    bestToastDone = true;
    juice.toast('NEW PERSONAL BEST', 'Every second from here is a record.', '#ffd54f');
  }

  // Contact damage.
  if (run.invulnS > 0) {
    run.invulnS -= dt;
  } else {
    for (const e of mowers.enemies()) {
      const def = MOWER_TIERS[e.tier];
      const d = Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z);
      if (d < PLAYER_RADIUS + e.radius && player.position.y < def.height) {
        run.hearts -= def.contactDamage;
        run.invulnS = TUNING.invulnS;
        killedBy = e.tier;
        juice.hurt();
        juice.shake(0.5 * def.contactDamage);
        if (run.hearts > 0) playSfx('hurt');
        break;
      }
    }
  }
  gnome.object.visible = run.invulnS <= 0 || Math.floor(run.invulnS * 12) % 2 === 0;

  // Engine drone from the nearest mower.
  let nearest = Infinity;
  for (const e of mowers.enemies()) {
    nearest = Math.min(nearest, Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z));
  }
  setEngineLevel(Math.max(0, 1 - nearest / 15));

  hud.update({
    hearts: run.hearts,
    maxHearts: stats.maxHearts,
    stamina01: player.stamina / stats.staminaMax,
    exhausted: player.exhausted,
    xp01: run.xp / run.xpToNext,
    level: run.level,
    elapsedS: run.elapsedS,
    kills: run.kills,
    acorns: run.acorns,
    boss: mowers.bossHp(),
    runNumber: save.runs + 1,
    buffs: espressoS > 0 ? [{ label: 'TRIPLE ESPRESSO', remaining01: espressoS / TUNING.espressoS }] : [],
  });

  if (run.hearts <= 0) {
    endRun(false);
    return;
  }
  if (victoryTimer > 0) {
    victoryTimer -= dt;
    if (victoryTimer <= 0) {
      endRun(true);
      return;
    }
  }
  if (pendingLevelUps > 0 && celebrateS <= 0) {
    celebrateS = TUNING.levelUpCelebrateS;
    juice.levelUp(run.level);
    playSfx('levelUp');
  }
}

// ---------- loop ----------
goLobby();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const inp = input.read(dt);

  if (phase === 'playing') {
    tickRun(dt * (celebrateS > 0 ? TUNING.levelUpTimeScale : 1), inp);
    if (celebrateS > 0) {
      celebrateS -= dt;
      if (celebrateS <= 0 && phase === 'playing') openLevelUp();
    }
  }

  if (phase === 'lobby') {
    player.facing += dt * 0.5;
    lobbyStage.update(dt);
    camera.position.set(0.9, 1.25, 4.2);
    camera.lookAt(0.9, 0.85, 0);
  } else {
    rig.update(player.position, phase === 'playing' ? inp : NO_INPUT, dt);
  }

  juice.update(dt, camera, phase === 'playing' ? items.active() : []);
  cullProps(dt, player.position);
  gnome.update(player, dt);
  world.update(dt, player.position);
  scenery.update(dt, player.position);
  postfx.render(dt);
});
