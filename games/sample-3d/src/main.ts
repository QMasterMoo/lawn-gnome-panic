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
    gnomesLeft: mode === 'royale' ? bots.aliveCount() + 1 : null,
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
  world.reset();
}

// ---------- phases ----------
function goLobby(): void {
  phase = 'lobby';
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
  if (mode === 'royale') {
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
    placement: mode === 'royale' ? { rank: run.hearts > 0 ? 1 : bots.aliveCount() + 1, total: TUNING.royaleBots + 1 } : null,
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

  // Day and night: banners at the turns, bonus XP in the dark.
  const dn = dayNight.update(dt);
  if (dn.phase !== lastDayPhase) {
    if (dn.phase === 'night') hud.banner('NIGHT FALLS', 'The mowers turned their headlights on. +25% XP until dawn.', 3.5);
    else if (dn.phase === 'dawn' && lastDayPhase === 'night') hud.banner('A NEW DAY DAWNS', 'You survived the night. The lawn is unimpressed.', 3.5);
    lastDayPhase = dn.phase;
  }
  const nightXp = dn.night01 > 0.5 ? TUNING.nightXpMult : 1;

  const { jumped } = updatePlayer(player, inp, rig.yaw, OBSTACLES, stats, dt);
  if (jumped) playSfx('jump');

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
  if (!levelBossSpawned && !bossDone && levelTime >= (L ? L.bossAtS : TUNING.bossAtS)) {
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
  for (const c of bots.contestants()) if (c.alive) targets.push(c.pos);
  const kills = mowers.update(dt, levelTime, targets, OBSTACLES, (x, z) => world.markMowed(x, z));
  for (const k of kills) {
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
  // Battle royale: the zone, the bots, the kill feed.
  if (mode === 'royale') {
    const zs = zone.update(dt, run.elapsedS);
    const outside = zone.isOutside(player.position.x, player.position.z);
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
    const deaths = bots.update(dt, {
      elapsedS: run.elapsedS,
      enemies: mowers.enemies(),
      damageEnemy: (id, amount) => mowers.damage(id, amount),
      zone,
      obstacles: OBSTACLES,
    });
    for (const d of deaths) royaleHud.feed(d);
    royaleHud.update({ alive: bots.aliveCount() + (run.hearts > 0 ? 1 : 0), total: TUNING.royaleBots + 1, zone: zs, playerOutside: outside });
    if (run.hearts > 0 && bots.aliveCount() === 0) {
      hud.banner('#1 LAST GNOME STANDING', 'Winner winner, chicken dinner. Legally distinct.', 3);
      endRun(true);
      return;
    }
  }
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

// Test hooks for headless smoke tests and screenshots: ?autostart=solo|royale skips the lobby; &pause pauses after 1.5 s.
{
  const params = new URLSearchParams(location.search);
  // &character=gnancy picks a character (also works on the lobby screen).
  const ch = params.get('character');
  if (ch && ch in CHARACTERS && ch !== save.character) lobbyCallbacks.onSelectCharacter(ch as CharacterId);
  const auto = params.get('autostart');
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
