import { heightAt } from './terrain';
import * as THREE from 'three';
import {
  COLORS, OBSTACLES, PLAYER_RADIUS, PEDESTAL_HEIGHT, MOWER_TIERS, TUNING, WAVES,
  type GamePhase, type InputState, type MowerTier, type RunSummary, type UpgradeChoice,
  type Weapon, type WeaponContext, type WeaponId, type MetaUpgradeId, type VisualMode, type ItemKind, type GameMode,
  ITEM_DEFS, CHICKEN_HEAL, CAMERA_VIEWS, SOLO_LEVELS, CHARACTERS, type CharacterId, type LobbyCallbacks,
} from './config';
import { createInput } from './input';
import { createTouchControls } from './ui/touch';
import { createCameraRig } from './camera';
import { createPlayerState, updatePlayer } from './player';
import { createGnomeModel } from './gnome';
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
import { createDayNight } from './daynight';
import { buildScenery } from './scenery';
import { createItemSystem } from './items';
import { createJuice } from './juice';
import { createBotSystem } from './br/bots';
import { createZone } from './br/zone';
import { createRoyaleHud } from './ui/royaleHud';
import { createViewButton } from './ui/viewButton';
import { createPauseButton } from './ui/pauseButton';
import { createPauseUI } from './ui/pause';
import { createNetClient, serverUrl } from './net/client';
import { createPuppetSystem } from './net/puppets';
import { generateGamertags } from './br/names';
import { MAX_PLAYERS, NET_SEND_HZ, type GameMsg, type KillSnap, type PlayerInfo, type ServerMsg } from './net/protocol';
import type { KillEvent, MowerKill, NetClient } from './config';

// ---------- no browser zoom on phones ----------
// CSS touch-action handles most browsers; iOS Safari ignores user-scalable=no, so also cancel its
// pinch gestures, multi-finger scaling moves and double-tap-to-zoom.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 && (e as TouchEvent & { scale?: number }).scale !== 1) e.preventDefault();
}, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// ---------- renderer, scene, camera ----------
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.sky, 60, 380);
// near 0.3 (not 0.1): far better depth precision, which stops overlays flickering when seen from high above.
const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2600);
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
const touch = createTouchControls(uiRoot);
const input = createInput(canvas, touch);
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
    p.obj.visible = flags.visualMode === 'lite'
      ? d < TUNING.liteCullDist + Math.min(p.o.height, 10) * 2
      : d < TUNING.propCullDist + p.o.height * 2;
  }
}
const houseLights = buildHouse(scene);
const dayNight = createDayNight();
let lastDayPhase = dayNight.state().phase;
const scenery = buildScenery(scene);
let gnome = createGnomeModel(CHARACTERS.gnorman.look);

/** Swaps the player's model to a character's look (lobby selection). */
function setPlayerCharacter(id: CharacterId): void {
  scene.remove(gnome.object);
  gnome.object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m.dispose();
    }
  });
  gnome = createGnomeModel(CHARACTERS[id].look);
  scene.add(gnome.object);
}
scene.add(gnome.object);
const mowers = createMowerSystem(scene);
const pickups = createPickupSystem(scene);
const drops = createDropSystem(scene);
const items = createItemSystem(scene);
const juice = createJuice(uiRoot);
const bots = createBotSystem(scene);
const zone = createZone(scene);
const royaleHud = createRoyaleHud(uiRoot);
const viewBtn = createViewButton(uiRoot, cycleView);
const pauseBtn = createPauseButton(uiRoot, () => pauseGame());
const pauseUI = createPauseUI(uiRoot);
const puppets = createPuppetSystem(scene);

let pausedAt = 0;
function pauseGame(): void {
  if (phase !== 'playing') return;
  phase = 'paused';
  pausedAt = performance.now();
  input.setPointerLockAllowed(false);
  touch.setVisible(false);
  viewBtn.hide();
  pauseBtn.hide();
  setEngineLevel(0);
  pauseUI.show({
    mode,
    runNumber: save.runs + 1,
    elapsedS: run.elapsedS,
    level: run.level,
    xp01: run.xp / run.xpToNext,
    hearts: run.hearts,
    maxHearts: stats.maxHearts,
    kills: run.kills,
    acorns: run.acorns,
    gnomesLeft: online ? online.alive : mode === 'royale' ? bots.aliveCount() + 1 : null,
    weapons: run.weapons,
    passives: run.passives,
    stats,
    meta: save.upgrades,
  }, resumeGame, quitRun);
}

function resumeGame(): void {
  if (phase !== 'paused') return;
  pauseUI.hide();
  phase = 'playing';
  input.setPointerLockAllowed(true);
  touch.setVisible(true);
  viewBtn.show();
  pauseBtn.show();
}

function quitRun(): void {
  if (phase !== 'paused') return;
  if (online) {
    finishOnline('GIVING UP (it happens)');
    return;
  }
  pauseUI.hide();
  phase = 'playing';
  killedBy = null;
  killedByText = 'GIVING UP (it happens)';
  run.hearts = 0;
  endRun(false);
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (phase === 'playing') pauseGame();
  // Esc that just released the mouse lock (and so paused) must not also un-pause.
  else if (phase === 'paused' && performance.now() - pausedAt > 300) resumeGame();
});
// Desktop: losing the mouse lock mid-run (Esc, alt-tab) pauses. Our own unlocks happen after phase changes, so they never trigger this.
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && phase === 'playing') pauseGame();
});
const VIEW_NAMES = { third: 'THIRD PERSON', first: 'FIRST PERSON', top: 'TOP-DOWN' } as const;

/** P or the top-right button: third person -> first person -> top-down. */
function cycleView(): void {
  if (phase !== 'playing') return;
  const next = CAMERA_VIEWS[(CAMERA_VIEWS.indexOf(rig.view) + 1) % CAMERA_VIEWS.length];
  rig.view = next;
  flags.view = next;
  saveFlags(flags);
  viewBtn.setView(next);
  juice.toast(`VIEW: ${VIEW_NAMES[next]}`, 'Press P or tap the camera button to switch.', '#ffffff');
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && !e.repeat) cycleView();
});
const lobbyStage = createLobbyStage(scene);
const hud = createHud(uiRoot);
const levelUp = createLevelUpUI(uiRoot);
const results = createResultsUI(uiRoot);
const lobbyCallbacks: LobbyCallbacks = {
  onPlay: (mode: GameMode, level: number) => { if (phase === 'lobby') startRun(mode, level); },
  onBuy: (id: MetaUpgradeId) => {
    if (tryBuy(save, id)) {
      playSfx('buy');
      lobbyUI.refresh(save);
    }
  },
  onSelectCharacter: (id: CharacterId) => {
    if (phase !== 'lobby' || save.character === id) return;
    save.character = id;
    writeSave(save);
    setPlayerCharacter(id);
    lobbyUI.setCharacter(id);
    lobbyUI.refresh(save);
    playSfx('buy');
  },
  onVisualMode: (mode: VisualMode) => {
    flags.visualMode = mode;
    saveFlags(flags);
    postfx.setMode(mode);
    lobbyUI.setVisualMode(mode);
    playSfx('buy');
  },
  onFindMatch: (code: string | null) => { void findMatch(code); },
  onLeaveMatch: () => {
    net?.leave();
    lobbyUI.setMatchStatus(null);
  },
};
const lobbyUI = createLobbyUI(uiRoot, lobbyCallbacks);

// ---------- state ----------
const save = loadSave();
const flags = loadFlags();
postfx.setMode(flags.visualMode);
lobbyUI.setVisualMode(flags.visualMode);
setPlayerCharacter(save.character);
lobbyUI.setCharacter(save.character);
let phase: GamePhase = 'lobby';
let run = createRun(save);
let stats = computeStats(save, null);
let player = createPlayerState(stats);
const weapons = new Map<WeaponId, Weapon>();
let pendingLevelUps = 0;
let choices: UpgradeChoice[] = [];
let waveIndex = -1;
let victoryTimer = -1;
// Solo levels: the waves replay each level with harder mowers, ending in a boss fight.
let levelIdx = 0;
let levelStartS = 0;        // run time when the current level's wave clock started
let levelBossSpawned = false;
let bossDone = false;       // royale: its single boss is finished
let levelsCleared = 0;
let levelBannerAt = -1;     // run time to announce the next level
let killedBy: MowerTier | null = null;
let espressoS = 0;
let mode: GameMode = 'solo';
let zoneDmgTimer = 0;
let killedByText: string | null = null;
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
  bots.reset();
  zone.reset();
  zone.setVisible(false);
  royaleHud.hide();
  puppets.reset();
  world.reset();
}

// ---------- phases ----------
function goLobby(): void {
  phase = 'lobby';
  if (online) {
    net?.leave();
    online = null;
  }
  dayNight.setTime(TUNING.lobbyTimeT);
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

function startRun(m: GameMode = 'solo', level = 1): void {
  mode = m;
  dayNight.setTime(TUNING.dayStartT);
  lastDayPhase = dayNight.state().phase;
  lobbyUI.hide();
  lobbyStage.setVisible(false);
  clearField();
  run = createRun(save);
  stats = computeStats(save, run);
  player = createPlayerState(stats);
  pendingLevelUps = 0;
  waveIndex = -1;
  victoryTimer = -1;
  levelIdx = Math.min(SOLO_LEVELS.length, Math.max(1, Math.min(level, save.levelsUnlocked))) - 1;
  levelStartS = 0;
  levelBossSpawned = false;
  bossDone = false;
  levelsCleared = 0;
  levelBannerAt = -1;
  mowers.setDifficulty(mode === 'solo' ? SOLO_LEVELS[levelIdx] : { speedMult: 1, hpMult: 1, spawnMult: 1, maxAliveMult: 1 });
  killedBy = null;
  killedByText = null;
  zoneDmgTimer = 0;
  espressoS = 0;
  celebrateS = 0;
  bestToastDone = save.bestTimeS <= 0;
  syncWeapons();
  rig.view = flags.view;
  rig.reset(0);
  viewBtn.setView(flags.view);
  viewBtn.show();
  pauseBtn.show();
  hud.show();
  if (mode === 'royale' && online) {
    // Players stand on a ring in join order; the host fills the rest of the 20 with bots.
    const idx = Math.max(0, online.order.indexOf(online.me));
    const a = (idx / online.order.length) * Math.PI * 2;
    const sx = Math.sin(a) * TUNING.onlineSpawnRing;
    const sz = Math.cos(a) * TUNING.onlineSpawnRing;
    player.position.set(sx, heightAt(sx, sz), sz);
    player.facing = a + Math.PI;
    rig.reset(player.facing);
    zone.reset(online.seed);
    const botCount = Math.max(0, MAX_PLAYERS - online.order.length);
    if (online.isHost) bots.spawn(botCount, new THREE.Vector3(0, 0, 0), player.position);
    else mowers.setPuppet(true);
    zone.setVisible(true);
    royaleHud.show();
    const humans = online.order.length;
    hud.banner(`ONLINE ROYALE · ${humans} HUMAN${humans === 1 ? '' : 'S'} + ${botCount} BOTS`, online.isHost ? 'You are hosting. Please do not close the tab.' : 'Last gnome standing wins. Some of these gnomes are people.', 4);
  } else if (mode === 'royale') {
    bots.spawn(TUNING.royaleBots, new THREE.Vector3(0, 0, 0), player.position);
    zone.setVisible(true);
    royaleHud.show();
    hud.banner(`BATTLE ROYALE · ${TUNING.royaleBots + 1} GNOMES`, 'Last gnome standing wins. The bots have names. Respect them.', 3.5);
  } else {
    hud.banner(`RUN #${save.runs + 1} · ${SOLO_LEVELS[levelIdx].name}`, SOLO_LEVELS[levelIdx].sub, 4);
  }
  phase = 'playing';
  input.setPointerLockAllowed(true);
  touch.setVisible(true);
  playSfx('start');
}

function openLevelUp(): void {
  phase = 'levelup';
  viewBtn.hide();
  pauseBtn.hide();
  touch.setVisible(false);
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
  if (c.id === 'thickBeard') run.hearts = Math.min(stats.maxHearts, run.hearts + 1); // more beard heals too
  syncWeapons();
  pendingLevelUps--;
  levelUp.hide();
  if (pendingLevelUps > 0) {
    openLevelUp();
  } else {
    phase = 'playing';
    input.setPointerLockAllowed(true);
    touch.setVisible(true);
    viewBtn.show();
    pauseBtn.show();
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
  levelUp.hide();
  pauseUI.hide();
  viewBtn.hide();
  pauseBtn.hide();
  rig.view = 'third'; // see your gnome's fate on the results screen
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
  const bossBonus = levelsCleared * TUNING.bossAcornBonus;
  const totalEarned = run.acorns + survivalBonus + bossBonus;
  const newBestTime = Math.floor(run.elapsedS) > save.bestTimeS;
  save.runs += 1;
  save.acorns += totalEarned;
  save.totalAcornsEarned += totalEarned;
  if (newBestTime) save.bestTimeS = Math.floor(run.elapsedS);
  save.bossKills += levelsCleared;
  // Solo victory unlocks the next level (picked in the lobby).
  let unlockedLevel: number | null = null;
  if (victory && mode === 'solo' && levelIdx + 2 <= SOLO_LEVELS.length && save.levelsUnlocked < levelIdx + 2) {
    save.levelsUnlocked = levelIdx + 2;
    unlockedLevel = save.levelsUnlocked;
  }
  writeSave(save);

  const summary: RunSummary = {
    runNumber: save.runs, victory, elapsedS: run.elapsedS, kills: run.kills, level: run.level,
    acornsCollected: run.acorns, survivalBonus, bossBonus, totalEarned, newBestTime,
    killedBy: victory ? null : killedBy,
    killedByText: victory ? null : killedByText,
    levelsCleared,
    soloLevel: mode === 'solo' ? levelIdx + 1 : null,
    unlockedLevel,
    placement: online ? { rank: victory ? 1 : online.placement || online.alive, total: online.total } : mode === 'royale' ? { rank: run.hearts > 0 ? 1 : bots.aliveCount() + 1, total: TUNING.royaleBots + 1 } : null,
  };
  hud.hide();
  touch.setVisible(false);
  results.show(summary, goLobby);
}

// ---------- the run ----------
/** All combines of the current boss fight are down. */
function clearLevel(): void {
  levelsCleared += 1;
  levelBossSpawned = false;
  bossDone = true;
  if (mode !== 'solo') {
    hud.banner('COMBINE DEFEATED', 'The lawn is safe. For now. (It is never safe.)', 3);
    return;
  }
  // Solo: beating the level's boss fight wins the run.
  run.bossDefeated = true;
  victoryTimer = TUNING.victoryDelayS;
  const last = levelIdx >= SOLO_LEVELS.length - 1;
  hud.banner(
    last ? 'THE COMBINES ARE DEFEATED' : `LEVEL ${levelIdx + 1} CLEAR!`,
    last ? 'Three combines. One gnome. The lawn is yours (until it grows back).' : `Level ${levelIdx + 2} is now unlocked in the lobby.`,
    3,
  );
}

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
          damageMower(e.id, e.tier === 'combine' ? TUNING.nukeBossDamage : 1e6);
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
  // Online: sim = this browser runs the world (host); sp = my gnome is dead and I am watching.
  const sim = !online || online.isHost;
  const sp = online?.spectating ?? false;

  // Day and night: banners at the turns, bonus XP in the dark.
  const dn = dayNight.update(dt);
  if (dn.phase !== lastDayPhase) {
    if (dn.phase === 'night') hud.banner('NIGHT FALLS', 'The mowers turned their headlights on. +25% XP until dawn.', 3.5);
    else if (dn.phase === 'dawn' && lastDayPhase === 'night') hud.banner('A NEW DAY DAWNS', 'You survived the night. The lawn is unimpressed.', 3.5);
    lastDayPhase = dn.phase;
  }
  const nightXp = dn.night01 > 0.5 ? TUNING.nightXpMult : 1;

  if (!sp) {
    const { jumped } = updatePlayer(player, inp, rig.yaw, OBSTACLES, stats, dt);
    if (jumped) playSfx('jump');
  }

  // Waves and bosses. Solo replays the waves each level with harder mowers; royale is a single level.
  const L = mode === 'solo' ? SOLO_LEVELS[levelIdx] : null;
  const levelTime = Math.max(0, run.elapsedS - levelStartS);
  const wi = waveIndexAt(levelTime);
  if (wi !== waveIndex) {
    waveIndex = wi;
    const b = WAVES[wi].banner;
    if (b && levelIdx === 0) hud.banner(b.title, b.sub, 3.5); // tier banners only the first time through
  }
  if (L && levelBannerAt > 0 && run.elapsedS >= levelBannerAt) {
    levelBannerAt = -1;
    hud.banner(L.name, L.sub, 4);
  }
  if (sim && !levelBossSpawned && !bossDone && levelTime >= (L ? L.bossAtS : TUNING.bossAtS)) {
    levelBossSpawned = true;
    run.bossSpawned = true;
    const count = L ? L.bossCount : 1;
    mowers.spawnBoss(count, L ? L.bossHpMult : 1);
    playSfx('bossWarning');
    if (count === 1) hud.banner('A COMBINE APPROACHES', 'Of course there is a boss fight. This is a roguelike.', 4);
    else if (count === 2) hud.banner('TWO COMBINES APPROACH', 'It brought a friend. Rude.', 4);
    else hud.banner(`${count} COMBINES APPROACH`, 'Just triple it. Absolutely unfair. Good luck.', 4);
  }

  // Mowers.
  const targets: THREE.Vector3[] = [player.position];
  if (online?.isHost) {
    const others = puppets.living('p');
    if (sp && others.length > 0) targets[0] = others[0]; // nobody chases a dead host
    targets.push(...others);
  }
  for (const c of bots.contestants()) if (c.alive) targets.push(c.pos);
  let kills: MowerKill[] = mowers.update(dt, levelTime, targets, OBSTACLES, (x, z) => world.markMowed(x, z));
  if (online) {
    if (online.isHost) for (const k of kills) online.kills.push([r2(k.x), r2(k.z), k.tier, k.by ?? -1]);
    else kills = online.netKills.splice(0);
  }
  for (const k of kills) {
    // Online, drops go only to the gnome that landed the killing blow.
    if (online && k.by !== online.me) {
      juice.kill(k.x, k.z);
      continue;
    }
    run.kills += 1;
    const def = MOWER_TIERS[k.tier];
    drops.spawnXp(k.x, k.z, def.xp);
    if (k.tier === 'combine') {
      drops.spawnAcorns(k.x, k.z, TUNING.bossAcornDrop);
      juice.shake(1.5);
    } else if (Math.random() < def.acornChance * stats.acornLuck) {
      drops.spawnAcorns(k.x, k.z, 1);
    }
    juice.kill(k.x, k.z);
    playSfx('enemyDie');
  }
  // Every combine of this boss fight is down: the level is cleared.
  if (levelBossSpawned && victoryTimer < 0 && mowers.bossHp() === null) clearLevel();

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
      if (e && e.hp > 0) juice.damageNumber(e.pos.x, e.pos.y + 1.3, e.pos.z, amount);
      damageMower(id, amount);
      playSfx('enemyHit');
    },
    slow: (id, factor, seconds) => slowMower(id, factor, seconds),
    playSfx,
  };
  if (!sp) for (const w of weapons.values()) w.update(ctx);
  if (sp) {
    tickRoyale(dt, sim, sp);
    return;
  }

  // Pickups.
  const got = drops.update(dt, player.position, stats.magnetRadius);
  if (got.xp > 0) {
    pendingLevelUps += addXp(run, got.xp * stats.xpMultiplier * nightXp);
    playSfx('xp');
  }
  const acornGain = got.acorns + pickups.update(dt, player.position);
  if (acornGain > 0) {
    run.acorns += acornGain;
    pendingLevelUps += addXp(run, acornGain * TUNING.acornXp * stats.xpMultiplier * nightXp);
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
      // A mower may be up on an obstacle (e.pos.y > 0): you clear it only by being above its top.
      if (d < PLAYER_RADIUS + e.radius && player.position.y < e.pos.y + def.height && player.position.y > e.pos.y - 0.6) {
        run.hearts -= def.contactDamage;
        run.invulnS = TUNING.invulnS + stats.invulnBonusS;
        killedBy = e.tier;
        killedByText = null;
        juice.hurt();
        juice.shake(0.5 * def.contactDamage);
        if (run.hearts > 0) playSfx('hurt');
        break;
      }
    }
  }
  if (mode === 'royale' && tickRoyale(dt, sim, sp)) return;
  // In first person you are the camera, so your own gnome is hidden.
  gnome.object.visible = rig.view !== 'first' && (run.invulnS <= 0 || Math.floor(run.invulnS * 12) % 2 === 0);

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
    levelLabel: mode === 'solo' ? `LEVEL ${levelIdx + 1}` : '',
    buffs: espressoS > 0 ? [{ label: 'TRIPLE ESPRESSO', remaining01: espressoS / TUNING.espressoS }] : [],
  });

  if (run.hearts <= 0) {
    if (online) becomeSpectator();
    else endRun(false);
    return;
  }
  if (victoryTimer > 0) {
    victoryTimer -= dt;
    if (victoryTimer <= 0) {
      endRun(true);
      return;
    }
  }
  if (pendingLevelUps > 0 && celebrateS <= 0 && !sp) {
    celebrateS = TUNING.levelUpCelebrateS;
    juice.levelUp(run.level);
    playSfx('levelUp');
  }
}


/** Battle royale: the zone, the bots, the kill feed, the alive count. Returns true if the run ended. */
function tickRoyale(dt: number, sim: boolean, sp: boolean): boolean {
  const zs = zone.update(dt, run.elapsedS);
  const outside = !sp && zone.isOutside(player.position.x, player.position.z);
  if (outside) {
    zoneDmgTimer -= dt;
    if (zoneDmgTimer <= 0) {
      zoneDmgTimer = TUNING.zoneDamageEveryS * (zs.radius < TUNING.zoneLateRadius ? 0.5 : 1);
      run.hearts -= 1;
      killedBy = null;
      killedByText = 'THE MOW ZONE';
      juice.hurt();
      juice.shake(0.4);
      if (run.hearts > 0) playSfx('hurt');
    }
  } else {
    zoneDmgTimer = Math.min(zoneDmgTimer, 0.5);
  }
  if (sim) {
    const deaths = bots.update(dt, {
      elapsedS: run.elapsedS,
      enemies: mowers.enemies(),
      damageEnemy: (id, amount) => mowers.damage(id, amount, online ? -1 : undefined),
      zone,
      obstacles: OBSTACLES,
    });
    for (const d of deaths) {
      royaleHud.feed(d);
      online?.feed.push(d);
    }
  }
  if (!online) {
    royaleHud.update({ alive: bots.aliveCount() + (run.hearts > 0 ? 1 : 0), total: TUNING.royaleBots + 1, zone: zs, playerOutside: outside });
    if (run.hearts > 0 && bots.aliveCount() === 0) {
      hud.banner('#1 LAST GNOME STANDING', 'Winner winner, chicken dinner. Legally distinct.', 3);
      endRun(true);
      return true;
    }
    return false;
  }
  if (online.isHost) {
    let humans = run.hearts > 0 && !sp ? 1 : 0;
    for (const a of online.humansAlive.values()) if (a) humans++;
    online.alive = bots.aliveCount() + humans;
  }
  royaleHud.update({ alive: online.alive, total: online.total, zone: zs, playerOutside: outside });
  if (online.isHost && online.alive <= 1) {
    hostEndMatch();
    return true;
  }
  return false;
}

// ---------- online ----------
interface OnlineMatch {
  me: number;
  hostId: number;
  isHost: boolean;
  seed: number;
  order: number[];                      // player ids in join order (spawn ring slots)
  players: Map<number, PlayerInfo>;
  humansAlive: Map<number, boolean>;    // other players; the host counts these
  total: number;
  alive: number;                        // host: computed each tick; clients: from the last snap
  sendTimer: number;
  kills: KillSnap[];                    // host: queued for the next snap
  feed: KillEvent[];                    // host: queued for the next snap
  hits: [number, number, number, number][]; // client: queued for the host
  netKills: MowerKill[];                // client: kills from snaps, consumed by tickRun
  spectating: boolean;
  placement: number;
  over: boolean;
}

let net: NetClient | null = null;
let online: OnlineMatch | null = null;
const myTag = generateGamertags(1)[0];
const r2 = (v: number): number => Math.round(v * 100) / 100;

async function findMatch(code: string | null): Promise<void> {
  if (phase !== 'lobby') return;
  const url = serverUrl();
  if (!url) {
    lobbyUI.setMatchStatus(null);
    juice.toast('ONLINE IS OFF', 'This build has no matchmaking server (VITE_MP_URL).', '#ff8a80');
    return;
  }
  lobbyUI.setMatchStatus('CONNECTING TO THE LAWN...');
  try {
    if (!net) {
      net = createNetClient(url, { name: myTag, character: save.character });
      net.onMessage(onServerMsg);
      net.onClose(onNetClose);
    }
    await net.connect();
    net.queue(code, save.character);
  } catch {
    lobbyUI.setMatchStatus(null);
    juice.toast('NO SERVER', 'The matchmaking server did not answer. It may be waking up: try again.', '#ff8a80');
  }
}

/** Mower damage from my weapons: applied here when I run the world, else sent to the host (puppets only flash). */
function damageMower(id: number, amount: number): void {
  if (online && !online.isHost) {
    online.hits.push([id, amount, 1, 0]);
    mowers.damage(id, amount);
  } else {
    mowers.damage(id, amount, online ? online.me : undefined);
  }
}

function slowMower(id: number, factor: number, seconds: number): void {
  if (online && !online.isHost) online.hits.push([id, 0, factor, seconds]);
  else mowers.slow(id, factor, seconds);
}

function startOnline(m: Extract<ServerMsg, { t: 'match' }>): void {
  const players = new Map<number, PlayerInfo>();
  const humansAlive = new Map<number, boolean>();
  for (const p of m.players) {
    players.set(p.id, p);
    if (p.id !== m.you) humansAlive.set(p.id, true);
  }
  online = {
    me: m.you, hostId: m.hostId, isHost: m.hostId === m.you, seed: m.seed,
    order: m.players.map((p) => p.id), players, humansAlive,
    total: MAX_PLAYERS, alive: MAX_PLAYERS, sendTimer: 0,
    kills: [], feed: [], hits: [], netKills: [],
    spectating: false, placement: 0, over: false,
  };
  startRun('royale', 1);
}

function onServerMsg(m: ServerMsg): void {
  switch (m.t) {
    case 'queued':
      if (phase === 'lobby') {
        const n = m.players;
        lobbyUI.setMatchStatus(`${n} GNOME${n === 1 ? '' : 'S'} FOUND · STARTS IN ${m.startsInS}s${m.code ? ` · CODE ${m.code}` : ''}`);
      }
      break;
    case 'match':
      if (phase !== 'lobby') {
        net?.leave();
        break;
      }
      lobbyUI.setMatchStatus(null);
      startOnline(m);
      break;
    case 'relay':
      onGameMsg(m.from, m.d);
      break;
    case 'left':
      if (online) {
        puppets.remove('p' + m.id);
        if (online.humansAlive.get(m.id)) {
          online.humansAlive.set(m.id, false);
          const ev = { victim: online.players.get(m.id)?.name ?? '???', cause: 'THE EXIT BUTTON' };
          if (online.isHost) online.feed.push(ev);
          royaleHud.feed(ev);
        }
      }
      break;
    case 'ended':
      if (online) finishOnline(m.reason);
      else if (phase === 'lobby') {
        lobbyUI.setMatchStatus(null);
        juice.toast('MATCHMAKING STOPPED', m.reason, '#ff8a80');
      }
      break;
    case 'error':
      juice.toast('THE SERVER SAYS NO', m.message, '#ff8a80');
      if (phase === 'lobby') lobbyUI.setMatchStatus(null);
      break;
    default:
      break;
  }
}

function onNetClose(): void {
  if (online) finishOnline('LOST CONNECTION TO THE LAWN');
  else if (phase === 'lobby') lobbyUI.setMatchStatus(null);
}

function onGameMsg(from: number, d: GameMsg): void {
  if (!online || online.over) return;
  switch (d.k) {
    case 'me': {
      const p = online.players.get(from);
      if (!p) return;
      puppets.set({
        key: 'p' + from, name: p.name, x: d.x, y: d.y, z: d.z, facing: d.facing, alive: d.alive,
        character: Object.prototype.hasOwnProperty.call(CHARACTERS, p.character) ? (p.character as CharacterId) : 'gnorman',
      });
      if (!d.alive && online.humansAlive.get(from)) online.humansAlive.set(from, false);
      break;
    }
    case 'hits':
      if (!online.isHost) return;
      for (const [id, amount, factor, seconds] of d.list) {
        if (amount > 0) mowers.damage(id, amount, from);
        if (seconds > 0) mowers.slow(id, factor, seconds);
      }
      break;
    case 'died': {
      if (!online.isHost || online.humansAlive.get(from) === undefined) return;
      online.humansAlive.set(from, false);
      const ev = { victim: online.players.get(from)?.name ?? '???', cause: d.cause };
      royaleHud.feed(ev);
      online.feed.push(ev);
      break;
    }
    case 'snap': {
      if (online.isHost) return;
      run.elapsedS = d.t;
      mowers.applySnapshot(d.mowers);
      const seen = new Set<string>();
      for (const [id, name, x, y, z, alive] of d.bots) {
        const key = 'b' + id;
        seen.add(key);
        puppets.set({ key, name, x, y, z, facing: null, alive: alive === 1, character: null });
      }
      for (const key of puppets.keys()) if (key.startsWith('b') && !seen.has(key)) puppets.remove(key);
      for (const [x, z, tier, by] of d.kills) {
        if (Object.prototype.hasOwnProperty.call(MOWER_TIERS, tier)) online.netKills.push({ id: 0, tier: tier as MowerTier, x, z, by });
      }
      for (const f of d.feed) royaleHud.feed(f);
      online.alive = d.alive;
      online.total = d.total;
      break;
    }
    case 'over':
      onOver(d.winner, d.winnerName);
      break;
    default:
      break;
  }
}

/** My gnome died online: the match goes on, so watch instead of ending the run. */
function becomeSpectator(): void {
  if (!online || online.spectating) return;
  online.spectating = true;
  // Host: alive was just counted without me. Client: the last snap still counted me.
  online.placement = online.isHost ? online.alive + 1 : online.alive;
  const cause = killedByText ?? (killedBy ? MOWER_TIERS[killedBy].name : 'a lawn mower');
  if (online.isHost) {
    const ev = { victim: myTag, cause };
    royaleHud.feed(ev);
    online.feed.push(ev);
  } else {
    net?.send(online.hostId, { k: 'died', cause });
  }
  gnome.setDead(true);
  playSfx('hit');
  hud.banner(`YOU PLACED #${online.placement}`, 'Spectating. The match goes on without you, as matches do. (Esc to leave.)', 4);
}

/** Host: one gnome (or none) left. */
function hostEndMatch(): void {
  if (!online || online.over) return;
  let winner = -1;
  let winnerName = 'NOBODY (the mowers win)';
  if (run.hearts > 0 && !online.spectating) {
    winner = online.me;
    winnerName = myTag;
  } else {
    for (const [id, a] of online.humansAlive) {
      if (a) {
        winner = id;
        winnerName = online.players.get(id)?.name ?? '???';
      }
    }
    if (winner === -1) {
      const bot = bots.contestants().find((c) => c.alive);
      if (bot) winnerName = bot.name;
    }
  }
  net?.send(null, { k: 'over', winner, winnerName });
  onOver(winner, winnerName);
}

function onOver(winner: number, winnerName: string): void {
  if (!online || online.over) return;
  online.over = true;
  const won = winner === online.me;
  if (won) hud.banner('#1 LAST GNOME STANDING', 'Winner winner, chicken dinner. Legally distinct.', 3);
  else if (!online.spectating) {
    killedBy = null;
    killedByText = `${winnerName} WINNING`;
  }
  endRun(won);
}

/** Leave a live match (quit, host gone, connection lost). */
function finishOnline(reason: string): void {
  if (!online || online.over) return;
  online.over = true;
  net?.leave();
  if (!online.spectating) {
    killedBy = null;
    killedByText = reason;
  }
  endRun(false);
}

/** Sends my gnome to everyone, and the world (host) or my hits (client), NET_SEND_HZ times a second. */
function netTick(dt: number): void {
  if (!online || online.over || !net) return;
  online.sendTimer -= dt;
  if (online.sendTimer > 0) return;
  online.sendTimer = 1 / NET_SEND_HZ;
  const p = player.position;
  net.send(null, { k: 'me', x: r2(p.x), y: r2(p.y), z: r2(p.z), facing: r2(player.facing), alive: !online.spectating });
  if (online.isHost) {
    net.send(null, {
      k: 'snap', t: r2(run.elapsedS), mowers: mowers.snapshot(),
      bots: bots.contestants().map((c) => [c.id, c.name, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), c.alive ? 1 : 0]),
      kills: online.kills.splice(0), feed: online.feed.splice(0), alive: online.alive, total: online.total,
    });
  } else if (online.hits.length > 0) {
    net.send(online.hostId, { k: 'hits', list: online.hits.splice(0) });
  }
}

// ---------- loop ----------
goLobby();

// Test hooks for headless smoke tests and screenshots: ?autostart=solo|royale skips the lobby; &pause pauses after 1.5 s.
{
  const params = new URLSearchParams(location.search);
  // &character=gnancy picks a character (also works on the lobby screen).
  const ch = params.get('character');
  if (ch && ch in CHARACTERS && ch !== save.character) lobbyCallbacks.onSelectCharacter(ch as CharacterId);
  const auto = params.get('autostart');
  // ?autostart=online[&code=ABCD] goes straight into matchmaking.
  if (auto === 'online') lobbyCallbacks.onFindMatch(params.get('code')?.toUpperCase() ?? null);
  if (auto === 'solo' || auto === 'royale') {
    startRun(auto);
    // &level=2|3 starts a solo run on that level; &boss brings its boss fight in now.
    const lv = parseInt(params.get('level') ?? '', 10);
    if (auto === 'solo' && lv >= 2 && lv <= SOLO_LEVELS.length) {
      levelIdx = lv - 1;
      mowers.setDifficulty(SOLO_LEVELS[levelIdx]);
    }
    if (auto === 'solo' && params.has('boss')) levelStartS = -SOLO_LEVELS[levelIdx].bossAtS;
    // &at=x,z drops the gnome at that point on the terrain (for looking at hills).
    const at = (params.get('at') ?? '').split(',').map(Number);
    if (at.length === 2 && at.every(Number.isFinite)) player.position.set(at[0], heightAt(at[0], at[1]), at[1]);
    if (params.has('pause')) setTimeout(() => pauseGame(), 1500);
  }
  // &time=0..1 jumps the clock (0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight).
  const time = parseFloat(params.get('time') ?? '');
  if (Number.isFinite(time)) {
    dayNight.setTime(time);
    lastDayPhase = dayNight.state().phase;
  }
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const inp = input.read(dt);

  if (phase === 'playing') {
    // Online, the world cannot slow down for one player's level-up.
    tickRun(dt * (celebrateS > 0 && !online ? TUNING.levelUpTimeScale : 1), inp);
    if (celebrateS > 0) {
      celebrateS -= dt;
      if (celebrateS <= 0 && phase === 'playing') openLevelUp();
    }
  } else if (online && !online.over && (phase === 'levelup' || phase === 'paused')) {
    // Online, menus do not pause the match: your gnome just stands there.
    tickRun(dt, NO_INPUT);
  }
  if (online && !online.over) netTick(dt);
  puppets.update(dt);

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
  // Apply the time of day to everything that is lit or coloured by it.
  const dnState = dayNight.state();
  if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(dnState.fogColor);
  if (scene.background instanceof THREE.Color) scene.background.copy(dnState.fogColor);
  world.setLighting(dnState);
  scenery.setSky(dnState);
  houseLights.setNight(dnState.night01);
  mowers.setNight(dnState.night01);
  world.setShadowRange(phase === 'playing' && rig.view === 'top' ? 80 : 35);
  world.update(dt, player.position);
  scenery.update(dt, player.position);
  postfx.render(dt);
});
