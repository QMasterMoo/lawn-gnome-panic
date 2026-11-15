// Melee, spells, enemy attacks, regen and death: the fight rules that tie rules.ts to the world.
import * as THREE from 'three';
import { PLAYER_ID, SPAWN, TUNING, UI, type DamageType, type Entity, type SkillId, type SpellId, type StatusId } from './config';
import { ENEMIES } from './content';
import { SPELLS } from './data/core';
import { allEntities, getEntity, killEntity } from './entities';
import { bus, say } from './events';
import { player, teleportPlayer } from './player';
import { useSkill } from './progression';
import { attackRoll, attributeMod, enemyStats, rollDice, skillBonus, weaponRange } from './rules';
import { equippedArmor, equippedWeapon, maxHp, maxMp, state } from './state';

/** Spell dice: the spell records hold no dice, so the casts keep them here. */
const FLARE_DICE: readonly [number, number] = [2, 6];
const MEND_DICE: readonly [number, number] = [2, 8];

/** A short visual effect: runs for `duration` seconds, then the mesh is removed. */
interface Effect {
  mesh: THREE.Mesh;
  age: number;
  duration: number;
  /** Called every frame with progress 0..1. */
  step: (t: number) => void;
}

const RESPAWN_SECONDS = 3;
let scene: THREE.Scene | null = null;
const effects: Effect[] = [];
let deadTimer = 0;
let hpAcc = 0;
let mpAcc = 0;
/** Seconds until the player may swing again. */
let swingTimer = 0;
/** Seconds until the player may cast again. */
let cooldown = 0;

/** Keeps the scene for spell effects (fireball, heal sparkle). Call once. */
export function initCombat(s: THREE.Scene): void {
  scene = s;
}

export function updateCombat(dt: number): void {
  updateEffects(dt);

  // Dead: wait for the respawn, then wake up at the well. Nothing else happens meanwhile.
  if (player.dead) {
    deadTimer += dt;
    if (deadTimer >= RESPAWN_SECONDS) {
      deadTimer = 0;
      player.dead = false;
      teleportPlayer(SPAWN.x, SPAWN.z);
      state.hp = maxHp();
      state.mp = maxMp();
      say('You wake up by the well in Mossbottom.', UI.quest);
      bus.emit('changed', {});
    }
    return;
  }

  regen(dt);

  swingTimer = Math.max(0, swingTimer - dt);
  cooldown = Math.max(0, cooldown - dt);

  // Auto-attack: swing at the target when it is in reach and the swing timer is ready.
  const act = player.action;
  if (act?.type === 'attack' && swingTimer <= 0) {
    const e = getEntity(act.target);
    if (e && e.kind === 'enemy' && !e.dead && distanceTo(e) <= TUNING.meleeRange + 0.3) swing(e);
  }
}

/** Hit points and mana come back slowly, one point per regen interval. */
function regen(dt: number): void {
  let changed = false;
  if (state.hp < maxHp()) {
    hpAcc += dt;
    while (hpAcc >= TUNING.hpRegenSeconds && state.hp < maxHp()) {
      hpAcc -= TUNING.hpRegenSeconds;
      state.hp++;
      changed = true;
    }
    if (state.hp >= maxHp()) hpAcc = 0;
  } else {
    hpAcc = 0;
  }
  if (state.mp < maxMp()) {
    mpAcc += dt;
    while (mpAcc >= TUNING.mpRegenSeconds && state.mp < maxMp()) {
      mpAcc -= TUNING.mpRegenSeconds;
      state.mp++;
      changed = true;
    }
    if (state.mp >= maxMp()) mpAcc = 0;
  } else {
    mpAcc = 0;
  }
  if (changed) bus.emit('changed', {});
}

/** One melee swing at an enemy: face it, roll to hit, deal damage, train the weapon skill. */
function swing(e: Entity): void {
  swingTimer = TUNING.playerAttackSeconds;
  player.swing = 0.35;
  player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z);
  e.inCombat = true;
  e.sinceHit = 0;

  const weapon = equippedWeapon();
  const type = weapon?.damageType;
  const skill: SkillId = !weapon || type === 'crush' ? 'blunt' : type === 'pierce' ? 'marksmanship' : 'blade';
  const [lo, hi] = weapon ? weaponRange(weapon) : [1, 2];
  const bonus = skillBonus(state.skills[skill].level) + attributeMod(state.attributes.agility);
  const def = ENEMIES[e.defId];
  const { hit, crit } = attackRoll(bonus, enemyStats(def).defense);

  if (hit) {
    const rolled = lo + Math.floor(Math.random() * (hi - lo + 1));
    const damage = Math.max(1, rolled + attributeMod(state.attributes.strength));
    e.hp -= damage;
    bus.emit('hit', { attacker: PLAYER_ID, target: e.id, damage, at: e.position.clone(), damageType: type ?? 'crush', crit });
    useSkill(skill, 1);
    finishIfDead(e);
  } else {
    bus.emit('miss', { attacker: PLAYER_ID, target: e.id, at: e.position.clone() });
  }
}

/** Kill an enemy whose hp reached zero; the player's attack ends with it. */
function finishIfDead(e: Entity): void {
  if (e.hp > 0) return;
  e.hp = 0;
  killEntity(e.id);
  if (player.action?.target === e.id) player.action = null;
}

/** An enemy strikes the player. Also makes the player fight back and handles death. */
export function enemyAttack(e: Entity): void {
  if (player.dead) return;
  const def = ENEMIES[e.defId];
  const st = enemyStats(def);
  const shield = state.equipment.offhand !== null;
  const armor = equippedArmor() + skillBonus(state.skills.toughness.level) + (shield ? skillBonus(state.skills.block.level) : 0);
  const { hit } = attackRoll(st.accuracy, armor);

  if (hit) {
    const [lo, hi] = st.damage;
    const damage = lo + Math.floor(Math.random() * (hi - lo + 1));
    state.hp -= damage;
    bus.emit('hit', { attacker: e.id, target: PLAYER_ID, damage, at: player.position.clone(), damageType: def.damageType });
    useSkill('toughness', 1);
  } else {
    bus.emit('miss', { attacker: e.id, target: PLAYER_ID, at: player.position.clone() });
    if (shield) useSkill('block', 1);
  }

  // Fight back when the player is idle.
  if (player.action === null && player.path.length === 0) player.action = { type: 'attack', target: e.id };

  checkPlayerDeath();
  bus.emit('changed', {});
}

/** The player dies once hit points run out: the respawn timer starts and the chat says so. */
function checkPlayerDeath(): void {
  if (state.hp > 0) return;
  state.hp = 0;
  player.dead = true;
  deadTimer = 0;
  player.action = null;
  player.path = [];
  bus.emit('player-died', {});
  say('Oh dear, you are dead!', UI.bad);
}

/**
 * Placeholder for the damage pipeline of later epics: deals `base` (rounded, at least 1) damage of `type` to the target.
 * Returns the amount dealt, or 0 when the target is missing or dead.
 */
export function dealDamage(targetId: number, base: number, type: DamageType, opts?: { crit?: boolean; spell?: boolean; noRoll?: boolean }): number {
  const amount = Math.max(1, Math.round(base));
  if (targetId === PLAYER_ID) {
    state.hp -= amount;
    bus.emit('hit', { attacker: PLAYER_ID, target: PLAYER_ID, damage: amount, at: player.position.clone(), damageType: type, crit: opts?.crit, spell: opts?.spell });
    checkPlayerDeath();
    bus.emit('changed', {});
    return amount;
  }
  const e = getEntity(targetId);
  if (!e || e.dead) return 0;
  e.hp -= amount;
  e.sinceHit = 0;
  bus.emit('hit', { attacker: PLAYER_ID, target: e.id, damage: amount, at: e.position.clone(), damageType: type, crit: opts?.crit, spell: opts?.spell });
  finishIfDead(e);
  return amount;
}

/** Placeholder: statuses (poison, slow, stun and the rest) arrive in a later epic. Does nothing yet. */
export function applyStatus(targetId: number, status: StatusId, seconds: number, power?: number): void {
  void targetId;
  void status;
  void seconds;
  void power;
}

/** Heals the player, capped at max hit points. */
export function healPlayer(amount: number): void {
  state.hp = Math.min(maxHp(), state.hp + amount);
  bus.emit('heal', { amount });
  bus.emit('changed', {});
}

/** Placeholder: always false until statuses exist. */
export function hasStatus(targetId: number, status: StatusId): boolean {
  void targetId;
  void status;
  return false;
}

export function castSpell(spell: SpellId): void {
  if (player.dead || cooldown > 0) return;
  const sp = SPELLS[spell];
  if (state.mp < sp.cost) {
    say('You do not have enough mana.', UI.bad);
    return;
  }

  let to: THREE.Vector3 | null = null;

  if (spell === 'flare') {
    const e = pickFlareTarget();
    if (!e) {
      say('There is nothing to target.', UI.bad);
      return;
    }
    const damage = rollDice(FLARE_DICE[0], FLARE_DICE[1]) + skillBonus(state.skills.sun.level);
    e.inCombat = true;
    e.sinceHit = 0;
    e.hp -= damage;
    bus.emit('hit', { attacker: PLAYER_ID, target: e.id, damage, at: e.position.clone(), spell: true, damageType: 'sun' });
    useSkill('sun', 1);
    if (e.hp <= 0) {
      finishIfDead(e);
    } else if (!player.action) {
      player.action = { type: 'attack', target: e.id };
    }
    to = e.position.clone();
    spawnFireball(to);
  } else {
    // Mend: heal yourself.
    const amount = rollDice(MEND_DICE[0], MEND_DICE[1]) + 2 * skillBonus(state.skills.bloom.level);
    state.hp = Math.min(maxHp(), state.hp + amount);
    bus.emit('heal', { amount });
    useSkill('bloom', 1);
    spawnHealRing();
  }

  state.mp -= sp.cost;
  cooldown = TUNING.spellCooldownSeconds;
  player.swing = 0.35;
  bus.emit('cast', { spell, from: player.position.clone(), to: to ? to.clone() : null });
  bus.emit('changed', {});
}

/** Seconds until the next spell may be cast (0 = ready). */
export function spellCooldown(): number {
  return Math.max(0, cooldown);
}

function distanceTo(e: Entity): number {
  return Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
}

function isLiveEnemyInRange(e: Entity, range: number): boolean {
  return e.kind === 'enemy' && !e.dead && distanceTo(e) <= range;
}

/** Flare target: the current attack target if it is in range, else the nearest enemy (preferring ones already fighting you). */
function pickFlareTarget(): Entity | undefined {
  const act = player.action;
  if (act?.type === 'attack') {
    const cur = getEntity(act.target);
    if (cur && isLiveEnemyInRange(cur, TUNING.spellRange)) return cur;
  }
  let best: Entity | undefined;
  let bestDist = Infinity;
  for (const e of allEntities()) {
    if (!isLiveEnemyInRange(e, TUNING.spellRange)) continue;
    const d = distanceTo(e);
    const better = !best || (e.inCombat !== best.inCombat ? e.inCombat : d < bestDist);
    if (better) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

/** Orange ball flying from the player's chest to the target over 0.3 s. */
function spawnFireball(target: THREE.Vector3): void {
  if (!scene) return;
  const from = new THREE.Vector3(player.position.x, player.position.y + 1, player.position.z);
  const to = new THREE.Vector3(target.x, target.y + 0.8, target.z);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  mesh.position.copy(from);
  addEffect(mesh, 0.3, (t) => mesh.position.lerpVectors(from, to, t));
}

/** Green ring at the feet that rises to head height while fading, over 0.6 s. */
function spawnHealRing(): void {
  if (!scene) return;
  const material = new THREE.MeshBasicMaterial({ color: 0x6dff8a, transparent: true, opacity: 1 });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 24), material);
  mesh.rotation.x = -Math.PI / 2;
  const baseY = player.position.y + 0.1;
  mesh.position.set(player.position.x, baseY, player.position.z);
  addEffect(mesh, 0.6, (t) => {
    mesh.position.y = baseY + 2 * t;
    material.opacity = 1 - t;
  });
}

function addEffect(mesh: THREE.Mesh, duration: number, step: (t: number) => void): void {
  if (!scene) return;
  scene.add(mesh);
  effects.push({ mesh, age: 0, duration, step });
}

function updateEffects(dt: number): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.age += dt;
    const t = Math.min(1, fx.age / fx.duration);
    fx.step(t);
    if (t >= 1) {
      scene?.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      (fx.mesh.material as THREE.Material).dispose();
      effects.splice(i, 1);
    }
  }
}
