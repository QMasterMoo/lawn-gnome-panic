# Roadmap: sample-3d phase 2, the roguelike

## Goal

Turn Lawn Gnome Panic into a self-aware, campy roguelike(-lite):

- **Outer loop (meta):** a lobby styled after battle-royale lobbies: the gnome on a lit pedestal, a character select with one real gnome and "COMING SOON" slots, and a "Primitive Powers" shop where banked golden acorns buy permanent stat upgrades (sprint duration, sprint recharge, jump, speed, hearts, pickup magnet, XP gain, rerolls). PLAY starts a run.
- **Inner loop (run):** a horde-survival run. Auto-firing weapons (slingshot, orbiting trowels, sprinkler, mushroom mines) destroy mowers, which drop XP clippings. Levelling up pauses the game for a pick-one-of-three card (new weapon, weapon level, passive). Mower tiers escalate on a timer (push reel mower, then green, yellow and red mowers), and a combine harvester boss arrives at 4:00. Dying or beating the boss ends the run, banks the acorns, and returns to the lobby.
- Also fixes the mower handles, which pointed down into the ground.

## Shape

| Epic | Done when | Issues |
|---|---|---|
| 1. Foundation (done by the planner) | `config.ts` has every type, table and tuning value; `main.ts` runs the full lobby → run → level-up → results loop; player/input support stats, sprint and stamina; every new module exists as a stub; tsc passes. | written directly |
| 2. Systems | Each module below is implemented; the game builds and plays the full loop. | 9, parallel |

Epic 1 was written directly by the planner rather than as an issue, because it is almost entirely verbatim contract code (copying it through a worker would cost more, not less).

---

## Epic 2: Systems

Shared Environment text for every issue in this epic (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming (Git Bash /c/Users/cstab/Documents/gaming). Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0. Import three as `import * as THREE from 'three';`. Dependencies are installed; do not add any.
- Conventions: Y is up, ground at y = 0, the lawn spans -ARENA_HALF..ARENA_HALF (20) on x and z. A yaw `a` means forward `(sin a, 0, cos a)`; yaw 0 faces +z; `object.rotation.y = a` turns a model built facing +z to face yaw a; yaw from a direction is `Math.atan2(dx, dz)`. Models are built facing +z with their base at y = 0. "dist2D" means `Math.hypot(a.x - b.x, a.z - b.z)`.
- The game compiles right now with stubs. Every module's exported names and signatures are final: they are used by src/main.ts. Keep them exactly.
- src/config.ts and src/main.ts are read-only: import from config, never edit either. Read the parts of config.ts your issue names; it is long.
- Eight other workers are editing other files in games/sample-3d at the same time. Edit only the files your issue names.
- Check with `npx tsc --noEmit -p games/sample-3d`. Do not run vite build or npm run build, and do not start a dev server. If tsc reports an error only in a file you do not own, another worker is mid-edit: wait a little and re-run; if it persists, report it and do not edit that file.
- Tone: the game is deliberately campy and self-aware about being a roguelike. Use the exact strings given; where you must invent text, keep it short, dry and tongue-in-cheek.

### 2.1 Implement stats, the save file and run progression logic

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Pure logic: combine base stats, meta upgrades and in-run passives; persist the meta save in localStorage; run XP, levelling and the level-up card pool.

## Read first
- games/sample-3d/src/config.ts: PlayerStats, BASE_STATS, MetaUpgradeId, META_UPGRADES, upgradeCost, MetaSave, SAVE_KEY, WeaponId, WEAPON_DEFS, PassiveId, PASSIVE_DEFS, UpgradeChoice, RunState.
- games/sample-3d/src/stats.ts, src/save.ts, src/run.ts: the stubs you replace.

## Change
- src/stats.ts, computeStats(save, run): start from a copy of BASE_STATS. Let up(id) = save.upgrades[id] * (META_UPGRADES entry with that id).perLevel, and pas(id) = (run?.passives[id] ?? 0) * PASSIVE_DEFS[id].perLevel. Then:
  - moveSpeed = base + up('moveSpeed'), then multiplied by (1 + pas('comfyBoots'))
  - staminaMax = base + up('sprintDuration')
  - staminaRegenPerSec = base + up('sprintRecharge')
  - staminaRegenDelayS = max(0.2, base - 0.15 * save.upgrades.sprintRecharge)
  - jumpSpeed = base + up('jumpHeight')
  - maxHearts = base + up('hearts')
  - magnetRadius = base + up('magnet')
  - xpMultiplier = base + up('wisdom')
  - rerolls = base + up('luck')
  - damageMult = base + pas('fertilizer')
  - cooldownMult = max(0.5, base - pas('compost'))
  - the rest unchanged.
- src/save.ts:
  - defaultSave(): the object the stub returns (all upgrades 0).
  - loadSave(): JSON.parse(localStorage.getItem(SAVE_KEY)) inside try/catch; start from defaultSave() and copy over each numeric field that is a finite number; for upgrades, copy each MetaUpgradeId that is a finite number, clamped to 0..maxLevel and floored. On any error return defaultSave().
  - writeSave(save): localStorage.setItem(SAVE_KEY, JSON.stringify(save)) in try/catch.
  - tryBuy(save, id): def = META_UPGRADES entry; level = save.upgrades[id]; if level >= def.maxLevel return false; cost = upgradeCost(def, level); if save.acorns < cost return false; save.acorns -= cost; save.upgrades[id] = level + 1; writeSave(save); return true.
- src/run.ts (keep createRun as it is):
  - xpToNext(level) = Math.round(5 + 4 * level * Math.sqrt(level)).
  - addXp(run, amount): run.xp += amount; count = 0; while (run.xp >= run.xpToNext) { run.xp -= run.xpToNext; run.level += 1; run.xpToNext = xpToNext(run.level); count++ } return count.
  - rollChoices(run, count): build a pool:
    - For each WeaponId key of WEAPON_DEFS: lvl = run.weapons[id] ?? 0; max = def.levelText.length; if lvl < max push { kind: 'weapon', id, nextLevel: lvl + 1, title: def.name, description: def.levelText[lvl], isNew: lvl === 0 }.
    - For each PassiveId key of PASSIVE_DEFS: lvl = run.passives[id] ?? 0; if lvl < def.maxLevel push { kind: 'passive', id, nextLevel: lvl + 1, title: def.name, description: `${def.effect}. ${def.blurb}`, isNew: lvl === 0 }.
    - Shuffle with Fisher-Yates (Math.random) and return the first `count`.
    - If the pool is empty return [{ kind: 'heal', id: 'heal', nextLevel: 0, title: 'Mulch Sandwich', description: 'Restore 1 heart. Delicious. Mostly mulch.', isNew: false }].
  - applyChoice(run, choice, stats): weapon -> run.weapons[id as WeaponId] = choice.nextLevel; passive -> run.passives[id as PassiveId] = choice.nextLevel; heal -> run.hearts = Math.min(stats.maxHearts, run.hearts + 1).

## Contract
Exactly the stub signatures: computeStats(save: MetaSave, run: RunState | null): PlayerStats; loadSave(): MetaSave; writeSave(save: MetaSave): void; tryBuy(save: MetaSave, id: MetaUpgradeId): boolean; createRun(save: MetaSave): RunState; xpToNext(level: number): number; addXp(run: RunState, amount: number): number; rollChoices(run: RunState, count: number): UpgradeChoice[]; applyChoice(run: RunState, choice: UpgradeChoice, stats: PlayerStats): void.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in stats.ts, save.ts or run.ts.

## Out of scope
Every other file.
~~~~

### 2.2 Build the mower models for every tier, including the combine boss

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
createMowerModel(tier) builds a distinct procedural model for each mower tier: an engineless push reel mower, green/yellow/red powered mowers with correct handles, and a combine harvester boss, each with a white hit flash and animated wheels.

## Read first
- games/sample-3d/src/config.ts: MowerTier, MowerModel, COLORS, MOWER_TIERS (radius gives the footprint size).
- games/sample-3d/src/mowerModels.ts: the stub you replace.

## Change
- src/mowerModels.ts:
  - Geometries may be module-level and shared. Materials must be created per model (so the flash affects only that mower): a local helper `mat(color, extra?)` creates `new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra })` and pushes it into the model's `mats` array. setFlash(on): for each m in mats, m.emissive.setHex(on ? 0xffffff : 0x000000), m.emissiveIntensity = on ? 0.7 : 0.
  - Every mesh castShadow = true.
  - Helper `bar(a: THREE.Vector3, b: THREE.Vector3, radius: number, material): THREE.Mesh`: a CylinderGeometry(radius, radius, a.distanceTo(b), 8) placed at the midpoint and oriented with `mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())`. Use it for every handle and tube. (The old handles were boxes with a wrong rotation and pointed into the ground; this is the fix.)
  - Keep `t` (time) per model for vibration. animate(dt, speed) spins wheels: wheel.rotation.x += speed * dt / wheelRadius.
  - Wheels: CylinderGeometry(r, r, width, 16) with geometry.rotateZ(Math.PI / 2), so the axle is along x.
  - 'reel' (push reel mower, no engine):
    - Two wheels r 0.32, width 0.08 (COLORS.mowerDark) at (±0.38, 0.32, 0).
    - A reel Group at (0, 0.3, 0.05) holding: an axle Cylinder r 0.05 length 0.7 (rotateZ PI/2, COLORS.reelMetal) and 5 blades, each a Box 0.7 x 0.03 x 0.06 (COLORS.reelMetal) at (0, cos(a)*0.17, sin(a)*0.17) with rotation.x = a, for a = i * 2PI/5.
    - A back roller Cylinder r 0.07 length 0.7 (rotateZ PI/2, COLORS.reelWood) at (0, 0.08, -0.35).
    - Handle: bar((±0.3, 0.32, -0.05), (±0.2, 1.05, -0.85), 0.03, COLORS.reelWood) on each side; grip bar((-0.24, 1.05, -0.85), (0.24, 1.05, -0.85), 0.035, COLORS.mowerDark).
    - animate: wheels spin (radius 0.32); reel.rotation.x += speed * dt * 3.
  - 'green' | 'yellow' | 'red' (deck colour COLORS.mowerGreen / mowerYellow / mowerRed):
    - Deck Box 1.4 x 0.3 x 1.3 at y 0.35. Engine Cylinder 0.3/0.32 height 0.3 (COLORS.mowerDark) at (0, 0.65, 0.1); a cap Box 0.2 x 0.1 x 0.2 in the deck colour at (0, 0.85, 0.1) as a child of the engine group so it moves with it.
    - Four wheels r 0.18 width 0.12 (COLORS.mowerDark) at (±0.72, 0.18, ±0.45).
    - Handle: bar((±0.45, 0.5, -0.6), (±0.45, 1.15, -1.35), 0.03, COLORS.mowerDark) each side; crossbar bar((-0.45, 1.15, -1.35), (0.45, 1.15, -1.35), 0.035, COLORS.mowerDark).
    - 'red' only: a white racing stripe Box 0.25 x 0.01 x 1.31 on top of the deck at y 0.505.
    - 'yellow' only: a black band Box 1.41 x 0.06 x 1.31 at y 0.25.
    - animate: wheels spin (radius 0.18); engine group y offset sin(t*60)*0.012; group.rotation.z = sin(t*45)*0.01.
  - 'combine' (boss; footprint radius 2.6; tall):
    - Body Box 2.6 x 1.8 x 3.4 (COLORS.combineBody) at (0, 1.5, -0.6).
    - Cab Box 1.3 x 1.0 x 1.2 (COLORS.combineBody) at (0, 2.9, 0.3); windshield Box 1.2 x 0.7 x 0.05 (COLORS.combineGlass, transparent, opacity 0.7) at (0, 3.0, 0.92); roof Box 1.5 x 0.1 x 1.4 (COLORS.combineAccent) at (0, 3.45, 0.3).
    - Front wheels r 0.9 width 0.5 (COLORS.mowerDark) at (±1.45, 0.9, 0.2); rear wheels r 0.55 width 0.4 at (±1.25, 0.55, -1.8).
    - Header (cutting platform): Box 5.0 x 0.4 x 0.9 (COLORS.combineAccent) at (0, 0.45, 2.0). Two divider Cones r 0.25 height 0.7 (COLORS.combineAccent) at (±2.5, 0.45, 2.55) with rotation.x = PI/2 (pointing forward).
    - Header reel Group at (0, 0.95, 2.1): axle Cylinder r 0.08 length 4.8 (rotateZ PI/2, COLORS.mowerDark) and 6 bats Box 4.8 x 0.06 x 0.12 (COLORS.combineBody) at (0, cos(a)*0.45, sin(a)*0.45), rotation.x = a.
    - Unloader tube bar((1.1, 2.3, -1.5), (2.6, 2.8, 0.5), 0.15, COLORS.combineBody). Exhaust Cylinder r 0.08 height 0.8 (COLORS.mowerDark) at (-0.8, 2.8, -1.6).
    - animate: reel.rotation.x += dt * 4; wheels spin with their own radii; group.rotation.z = sin(t*20)*0.006.

## Contract
`export function createMowerModel(tier: MowerTier): MowerModel` returning { group, setFlash, animate }. Do not set group.position or group.rotation.y (the mower system sets those every frame); rotation.z is yours.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowerModels.ts.

## Out of scope
Every other file, including mowers.ts (another worker writes the AI that uses your models).
~~~~

### 2.3 Implement the mower enemy system with tiers, waves, damage and the boss

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The enemy system: spawns mowers by the WAVES table, steers them at the player with each tier's speed and turn rate, keeps them apart and out of obstacles, takes damage with a hit flash and a death shrink, supports slows, and spawns the combine boss.

## Read first
- games/sample-3d/src/config.ts: MowerTier, MOWER_TIERS, RegularTier, WAVES, WavePhase, EnemyView, MowerKill, MowerSystem, MowerModel, Obstacle, ARENA_HALF.
- games/sample-3d/src/mowers.ts: the stub you replace.
- games/sample-3d/src/mowerModels.ts: `createMowerModel(tier: MowerTier): MowerModel` (another worker is implementing its body; call it, do not edit it). The model's `group` must be added to the scene, positioned with group.position.set(x, 0, z) and group.rotation.y = heading each frame; call model.animate(dt, currentSpeed) and model.setFlash(bool).

## Change
- src/mowers.ts, createMowerSystem(scene):
  - Internal `interface Mower { id: number; tier: MowerTier; pos: THREE.Vector3; radius: number; hp: number; maxHp: number; heading: number; model: MowerModel; slowFactor: number; slowS: number; flashS: number; dyingS: number }` (dyingS < 0 means alive). The Mower object satisfies EnemyView, so enemies() can return the mower objects themselves.
  - State: `mowers: Mower[]`, `pendingKills: MowerKill[]`, `nextId = 1`, `spawnTimer = 1`.
  - spawn(tier, x?, z?, heading?): def = MOWER_TIERS[tier]. Default position: random side; along it a random coordinate in ±(ARENA_HALF - 2); across it ±(ARENA_HALF - 1.2); heading toward the centre, Math.atan2(-x, -z). Create the model, add model.group to the scene, push the mower with hp = maxHp = def.hp, radius = def.radius, slowFactor 1, slowS 0, flashS 0, dyingS -1.
  - pickTier(mix): weighted random over the entries of a WavePhase.mix.
  - update(dt, elapsedS, target, obstacles, onMow):
    1. wave = the last WAVES entry with fromS <= elapsedS. spawnTimer -= dt; if spawnTimer <= 0: spawnTimer = wave.spawnEveryS; if the number of alive mowers < wave.maxAlive, spawn(pickTier(wave.mix)).
    2. For each alive mower: def = MOWER_TIERS[tier]. slowS -= dt; mul = slowS > 0 ? slowFactor : 1; speed = def.speed * mul. Steer: desired = atan2(target.x - pos.x, target.z - pos.z); diff = shortest signed angle (wrap to -PI..PI); heading += clamp(diff, -def.turnRate*dt, def.turnRate*dt). Move pos by (sin heading, cos heading) * speed * dt.
    3. Obstacles (skip for the combine, it plows through): for each o, if dist2D < o.radius + radius push pos out to exactly that distance (direction (1,0) if d < 1e-4).
    4. Separation between alive mowers: for each pair closer than ra + rb, resolve the overlap: if one is the combine, move only the other by the full overlap; otherwise move each by half.
    5. Clamp pos.x and pos.z to ±(ARENA_HALF - radius).
    6. Visuals: flashS -= dt; model.setFlash(flashS > 0); group.position.set(pos.x, 0, pos.z); group.rotation.y = heading; model.animate(dt, speed).
    7. Mowing: onMow(pos.x, pos.z). For the combine also call onMow at pos + forward*2 ± right*1.6 (right = (-cos h, 0, sin h)), so it cuts a wide swath.
    8. Dying mowers: dyingS -= dt; group.scale.setScalar(max(0.01, dyingS / 0.25)); group.rotation.y += 15*dt; when dyingS <= 0 remove group from the scene and the mower from the array.
    9. Return pendingKills.splice(0) (all kills since the last call).
  - enemies(): the alive mowers (dyingS < 0).
  - damage(id, amount): find the alive mower; hp -= amount; flashS = 0.08; if hp <= 0: hp = 0, dyingS = 0.25, push { id, tier, x: pos.x, z: pos.z } to pendingKills.
  - slow(id, factor, seconds): on the alive mower: slowFactor = factor; slowS = max(slowS, seconds).
  - spawnBoss(): spawn('combine', 0, -(ARENA_HALF - 3), 0).
  - bossHp(): the alive combine's { hp, max: maxHp }, else null.
  - reset(): remove every group from the scene, clear mowers and pendingKills, spawnTimer = 1.

## Contract
`export function createMowerSystem(scene: THREE.Scene): MowerSystem` with exactly the methods of MowerSystem. Kills are reported once each, through update's return value. enemies() never includes dying mowers.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowers.ts.

## Out of scope
Every other file, including mowerModels.ts and main.ts (contact damage to the player is done in main.ts).
~~~~

### 2.4 Implement the slingshot and orbiting trowels weapons

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Two auto-attacking weapons: a slingshot that fires pebbles at the nearest mowers, and garden trowels that orbit the gnome and cut what they touch.

## Read first
- games/sample-3d/src/config.ts: Weapon, WeaponContext, EnemyView, PlayerStats (damageMult, cooldownMult), SLINGSHOT_LEVELS, SlingshotLevel, TROWEL_LEVELS, TrowelLevel, COLORS (pebble, trowel, reelWood).
- games/sample-3d/src/weapons/slingshot.ts and weapons/trowels.ts: the stubs you replace.

## Change
Both: `level` (1..5) set by setLevel; the current level stats are LEVELS[level - 1], read at use time. Final damage = L.damage * ctx.stats.damageMult. Cooldowns = L.cooldownS * ctx.stats.cooldownMult. Shared module-level geometries/materials. dispose() removes every mesh it added from the scene and clears its lists.
- weapons/slingshot.ts, createSlingshot(scene):
  - timer = 0. Pebbles: { mesh, x, y, z, vx, vz, life, pierceLeft, hit: Set<number> }. Mesh: Sphere r 0.12, COLORS.pebble.
  - update(ctx): timer -= dt. If timer <= 0: candidates = ctx.enemies within L.range (dist2D from ctx.player), sorted nearest first. If none, timer = 0.1. Else fire L.projectiles pebbles: pebble i aims at candidates[i % candidates.length]; direction = normalised horizontal vector from the player to that enemy; start at (player.x, player.y + 0.6, player.z); velocity = direction * L.speed; life = L.range / L.speed + 0.2; pierceLeft = L.pierce. ctx.playSfx('shoot') once per volley. timer = cooldown.
  - Move every pebble; life -= dt. For each enemy not in pebble.hit with dist2D(pebble, e.pos) < e.radius + 0.2: ctx.damage(e.id, damage); hit.add(e.id); if pierceLeft === 0 remove the pebble (stop checking it), else pierceLeft -= 1. Remove pebbles whose life <= 0.
- weapons/trowels.ts, createTrowels(scene):
  - angle = 0; `meshes: THREE.Group[]`; cooldowns: Map<number, number> (enemy id -> seconds until it can be hit again).
  - Trowel mesh (a Group, pointing outward along its local +x): blade Box 0.45 x 0.03 x 0.14 (COLORS.trowel, metalness 0.8, roughness 0.3) at local x 0.35; handle Cylinder r 0.04 height 0.25 (COLORS.reelWood) rotated z = PI/2 at local x 0.05.
  - update(ctx): add or remove meshes so there are exactly L.count. angle += 2*PI*L.revPerSec*dt. Trowel i: a = angle + i*2*PI/count; group.position = (player.x + cos(a)*L.radius, player.y + 0.55, player.z + sin(a)*L.radius); group.rotation.y = -a (so the blade points outward).
  - Decrease each cooldown by dt and delete entries <= 0. For each trowel and each enemy with dist2D(trowel, e.pos) < e.radius + 0.35 and no cooldown entry: ctx.damage(e.id, damage); cooldowns.set(e.id, L.hitCooldownS).

## Contract
- `export function createSlingshot(scene: THREE.Scene): Weapon` with id 'slingshot'.
- `export function createTrowels(scene: THREE.Scene): Weapon` with id 'trowels'.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in weapons/slingshot.ts or weapons/trowels.ts.

## Out of scope
Every other file, including weapons/index.ts, weapons/sprinkler.ts and weapons/mushrooms.ts.
~~~~

### 2.5 Implement the battle sprinkler and mushroom mines weapons

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Two area weapons: a sprinkler pulse that damages and slows nearby mowers, and mushroom mines that the gnome drops and that explode when mowers come close.

## Read first
- games/sample-3d/src/config.ts: Weapon, WeaponContext, EnemyView, PlayerStats (damageMult, cooldownMult), SPRINKLER_LEVELS, SprinklerLevel, MUSHROOM_LEVELS, MushroomLevel, COLORS (water, mushroomCap, mushroomStem).
- games/sample-3d/src/weapons/sprinkler.ts and weapons/mushrooms.ts: the stubs you replace.

## Change
Both: `level` (1..5) set by setLevel; current stats L = LEVELS[level - 1] read at use time. Damage = L.damage * ctx.stats.damageMult; cooldown = L.cooldownS * ctx.stats.cooldownMult. Visual effects that fade need their own material clone (so opacity is independent); dispose those materials when the effect ends. dispose() removes everything from the scene.
- weapons/sprinkler.ts, createSprinkler(scene):
  - timer = 1. update(ctx): timer -= dt. If timer <= 0: targets = enemies with dist2D(player, e.pos) < L.radius + e.radius. If none, timer = 0.2. Else: for each target ctx.damage(e.id, damage) and ctx.slow(e.id, L.slowFactor, L.slowS); ctx.playSfx('splash'); start a pulse effect; timer = cooldown.
  - Pulse effect: a RingGeometry(0.85, 1, 48) mesh, rotation.x = -PI/2, at (player.x, 0.06, player.z), MeshBasicMaterial COLORS.water, transparent, opacity 0.8, depthWrite false, side DoubleSide. Over 0.4 s: scale from 0.2 to L.radius (x and y of the ring), opacity to 0. Plus 10 droplets: Sphere r 0.06 (COLORS.water) starting at (player.x, 0.4, player.z) with horizontal speed 5..8 in evenly spread directions and vy 3; gravity 15; removed after 0.5 s.
- weapons/mushrooms.ts, createMushrooms(scene):
  - mines: { group, x, z, armS, phase }. timer = 1.
  - Mine mesh (Group at (x, 0, z)): stem Cylinder 0.08/0.1 height 0.18 (COLORS.mushroomStem) at y 0.09; cap Sphere r 0.2 with thetaLength PI/2 (dome, COLORS.mushroomCap) at y 0.15; four white spots Sphere r 0.035 on the cap surface at y ~0.3. castShadow.
  - update(ctx): timer -= dt. If timer <= 0: timer = cooldown; if mines.length < L.maxMines, drop a mine at the player's feet (x, z) with armS = L.armS.
  - For each mine: if armS > 0, armS -= dt and cap scale pulses 0.6..1.0 (sin(t*20)); else gentle bob (group.position.y = 0.02 + sin(t*3 + phase)*0.02). An armed mine explodes when any enemy has dist2D(mine, e.pos) < L.triggerRadius + e.radius: damage every enemy with dist2D(mine, e.pos) - e.radius < L.blastRadius; ctx.playSfx('boom'); remove the mine; start a blast effect.
  - Blast effect: Sphere r 1 (MeshBasicMaterial 0xff9800, transparent, opacity 0.8, depthWrite false) at (x, 0.3, z), scaling 0.2 -> L.blastRadius over 0.3 s while opacity -> 0.

## Contract
- `export function createSprinkler(scene: THREE.Scene): Weapon` with id 'sprinkler'.
- `export function createMushrooms(scene: THREE.Scene): Weapon` with id 'mushrooms'.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in weapons/sprinkler.ts or weapons/mushrooms.ts.

## Out of scope
Every other file, including weapons/index.ts, weapons/slingshot.ts and weapons/trowels.ts.
~~~~

### 2.6 Implement XP and acorn drops, and the new sound effects

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Dropped XP "grass clippings" and acorns that pop out of destroyed mowers, fly to the gnome when he is within magnet range, and are collected; plus synth sounds for every new SfxName.

## Read first
- games/sample-3d/src/config.ts: DropSystem, COLORS (xp, acorn, acornCap), SfxName.
- games/sample-3d/src/drops.ts: the stub you replace.
- games/sample-3d/src/audio.ts: the existing implementation you extend (it has tone(), a noise burst helper, playSfx and setEngineLevel).

## Change
- src/drops.ts, createDropSystem(scene):
  - Drop: { kind: 'xp' | 'acorn'; mesh; value; x, y, z; vy; magnet: boolean; magnetT: number; phase }.
  - XP mesh: Octahedron r 0.15, MeshStandardMaterial COLORS.xp with emissive 0x2f7a00; scale 1 + min(value, 20) * 0.04. Acorn mesh: a Group with a nut Sphere r 0.13 (COLORS.acorn, metalness 0.3, roughness 0.4, emissive 0x553300) scaled y 1.25 and a cap half-sphere r 0.14 (thetaLength PI/2, COLORS.acornCap) at y 0.08. Shared geometries/materials.
  - spawnXp(x, z, amount): if amount > 10, spawn ceil(amount/10) gems of value 10 (the last gets the remainder) scattered within 2 m; otherwise one gem at (x ± 0.3 random, z ± 0.3 random). Each starts at y 0.3 with vy = 3. If more than 300 drops exist, add the value to the oldest XP drop instead of creating a mesh.
  - spawnAcorns(x, z, count): count acorns scattered within min(2.5, 0.3 + count * 0.08) m, each with vy = 4..6.
  - update(dt, playerFeet, magnetRadius): for each drop: pop physics (y += vy*dt; vy -= 20*dt; when y <= 0.3, y = 0.3 and vy = 0); spin rotation.y += 3*dt; bob +sin(t*4+phase)*0.05 when resting. Target = (playerFeet.x, playerFeet.y + 0.5, playerFeet.z). If not magnet and 3D distance to target < magnetRadius, magnet = true. Magnet drops move toward the target at speed 6 + 20*magnetT (magnetT += dt). Collect when the distance < 0.5: remove the mesh and add value to the returned xp (kind 'xp') or 1 to acorns (kind 'acorn').
  - reset(): remove all.
- src/audio.ts: add a case to playSfx for every SfxName not yet handled, keeping the existing ones. Add a per-name rate limit: skip a sound if the same name played less than this many ms ago: enemyHit 60, xp 40, enemyDie 30, shoot 50. Sounds (tone(f0, f1, dur, type, vol, delay)):
  - hurt: tone(400, 150, 0.25, 'square', 0.12)
  - shoot: tone(700, 300, 0.06, 'triangle', 0.05)
  - enemyHit: tone(220, 160, 0.05, 'square', 0.04)
  - enemyDie: tone(300, 60, 0.18, 'sawtooth', 0.08) plus a quiet noise burst (give the noise helper an optional volume, default unchanged; use 0.08 here)
  - xp: tone(1200 + Math.random()*200, 1600, 0.05, 'sine', 0.04)
  - levelUp: square tones 523, 659, 784, 1047 Hz (each f0 = f1 * 0.98 -> f1), 0.12 s, vol 0.07, delays 0, 0.08, 0.16, 0.24
  - bossWarning: a siren: tone(300, 600, 0.4, 'sawtooth', 0.1) at delays 0 and 0.8, tone(600, 300, 0.4, 'sawtooth', 0.1) at delays 0.4 and 1.2
  - buy: tone(660, 990, 0.08, 'square', 0.07) and tone(990, 1320, 0.1, 'square', 0.06, 0.07)
  - splash: tone(900, 200, 0.2, 'sine', 0.06) plus noise burst volume 0.06
  - boom: tone(120, 30, 0.5, 'sawtooth', 0.2) plus noise burst volume 0.2
  - victory: square 523, 659, 784 at 0, 0.12, 0.24 (0.12 s, vol 0.07) then 1047 at 0.36 for 0.5 s

## Contract
- `export function createDropSystem(scene: THREE.Scene): DropSystem`.
- audio.ts keeps `playSfx(name: SfxName): void` and `setEngineLevel(level: number): void` unchanged.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in drops.ts or audio.ts.

## Out of scope
Every other file, including pickups.ts (field acorns stay as they are) and main.ts.
~~~~

### 2.7 Build the battle-royale-style lobby and its 3D pedestal stage

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The lobby the player returns to after every run: the gnome on a glowing pedestal with spotlights (3D), and an HTML overlay in the style of a battle-royale lobby with a fake top nav, a character select (one gnome, the rest "COMING SOON"), the Primitive Powers upgrade shop, run stats, rotating campy tips, and a big PLAY button.

## Read first
- games/sample-3d/src/config.ts: LobbyStage, LobbyUI, LobbyCallbacks, MetaSave, META_UPGRADES, MetaUpgradeDef, upgradeCost, PEDESTAL_HEIGHT.
- games/sample-3d/src/lobbyStage.ts and src/ui/lobby.ts: the stubs you replace.
- games/sample-3d/index.html: #ui is `position:fixed; inset:0; pointer-events:none`. Set `pointer-events:auto` only on the elements that must be clickable (buttons, cards, the shop list), so the rest of the screen stays transparent.
- Facts from main.ts: in the lobby the gnome stands at the origin on the pedestal, slowly turning; the camera is at (0.9, 1.25, 4.2) looking at (0.9, 0.85, 0), so the gnome appears a little left of centre. Keep the centre-left of the screen clear for him.

## Change
- src/lobbyStage.ts, createLobbyStage(scene): one Group added to the scene containing:
  - Pedestal Cylinder r 0.9/1.0 height PEDESTAL_HEIGHT (colour 0x3a2a6a, roughness 0.4) at y PEDESTAL_HEIGHT/2, receiveShadow, castShadow.
  - Glow ring Torus(0.95, 0.04, 12, 64), MeshStandardMaterial colour and emissive 0x9c6bff, emissiveIntensity 2, rotation.x = PI/2, at y PEDESTAL_HEIGHT. A wider ground ring Torus(1.6, 0.025, 8, 64) same material at y 0.03, slowly rotating.
  - Lights: SpotLight(0xffffff, 60, 14, 0.45, 0.5) at (2, 5, 4) with its target at (0, 0.8, 0) (add the target to the group), castShadow; PointLight(0x9c6bff, 6, 6) at (-1.5, 1.5, -1); PointLight(0x4dd0e1, 6, 6) at (1.5, 1.2, -1).
  - 30 sparkles: Octahedron r 0.03, MeshBasicMaterial white, placed at random angle, radius 1.2..2.2, y 0.3..2.2; each drifts up 0.3 m/s and wraps from 2.2 back to 0.3.
  - update(dt): rotate the ground ring and drift sparkles. setVisible(v): group.visible = v.
- src/ui/lobby.ts, createLobbyUI(root, cb). Inject one <style> (class prefix `lb-`). Fonts: `'Arial Black', Impact, system-ui, sans-serif`, uppercase, italic headings, heavy text-shadow. Build the DOM once; show/hide toggles the root's display. Layout (all absolutely positioned inside an `lb-root` that fills the screen, with a subtle left and right purple gradient: `linear-gradient(90deg, rgba(40,10,90,.65), transparent 30%, transparent 62%, rgba(40,10,90,.75))`):
  - Top bar (`lb-top`, full width, 56px, dark translucent): left, the logo "LAWN GNOME PANIC" (gold, 26px) with a small tag "SEASON 1: THE LAWN REMEMBERS". Centre, nav tabs PLAY (active, underlined), LOCKER, ITEM SHOP, BATTLE PASS, CAREER; clicking anything but PLAY shows a toast "Coming soon. Probably.". Right, an acorn pill "🌰 {save.acorns}".
  - Left column (`lb-chars`, top 80px, left 24px, width 230px): heading "CHOOSE YOUR GNOME". Card 1 selected: gold gradient border, name "GNORMAN", rarity line "LEGENDARY (ALLEGEDLY)", flavour "Pointy hat. Strong beard. Weak to mowers.". Then three locked cards, greyed with a big "?" silhouette and "COMING SOON": "GNOAH", "GNANCY", "SIR GNOMESALOT". Clicking a locked card shows a toast "COMING SOON™. This is a roguelike, not a promise.".
  - Right column (`lb-shop`, top 80px, right 24px, width 360px, max-height calc(100vh - 220px), overflow-y auto): heading "PRIMITIVE POWERS" and sub "Spend acorns. Get stronger. Die anyway.". One row per META_UPGRADES entry: name (bold), blurb (small, italic), effect, level pips (maxLevel boxes, filled for owned levels), and a buy button showing "🌰 {upgradeCost(def, level)}" or "MAXED". The button is disabled (greyed, not clickable) when maxed or save.acorns < cost; clicking calls cb.onBuy(def.id). Briefly flash the row gold after a purchase (refresh() is called after a successful buy; compare levels to detect which row changed).
  - Bottom left (`lb-stats`, left 24px, bottom 24px): "RUNS {runs} · BEST {m:ss of bestTimeS} · COMBINES DEFEATED {bossKills} · LIFETIME ACORNS {totalAcornsEarned}", and below it a tip line that rotates every 6 s through: "Tip: Dying is part of the gameplay loop. Embrace it.", "Tip: Permadeath means your gnome dies. Permanently. Until the next run.", "Tip: Upgrades persist between runs. That makes it a roguelite. Please do not email us.", "Tip: Hold Shift to sprint. Gnomes can sprint. Briefly.", "Tip: The combine arrives at 4:00. It is not here to help.", "Tip: Push reel mowers have no engine. They run on spite.", "Tip: You can jump over mowers. You cannot jump over a combine. Combines are tall.", "Tip: Every run is randomly generated. We call it procedural for marketing.".
  - Bottom right: the PLAY button (`lb-play`): 300 x 96px, yellow gradient (#ffe14d -> #ffb300), dark text "PLAY" 54px italic, skewed -8deg, with a sub line "RUN #{runs + 1} · SOLO · BACKYARD"; hover scales 1.05. Click calls cb.onPlay(). Enter key also calls cb.onPlay() while the lobby is visible.
  - Toast: centred near the top, fades out after 1.8 s.
  - show(save): render with save, display. refresh(save): re-render the acorn pill, shop rows, stats and play sub line. hide(): display none, and stop the Enter key and tip timer from acting.

## Contract
- `export function createLobbyStage(scene: THREE.Scene): LobbyStage`.
- `export function createLobbyUI(root: HTMLElement, cb: LobbyCallbacks): LobbyUI`.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in lobbyStage.ts or ui/lobby.ts.

## Out of scope
Every other file, including the other ui/ files and main.ts.
~~~~

### 2.8 Build the in-run HUD

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The in-run HUD: hearts, stamina bar, XP bar and level, timer, kills, acorns, a boss health bar, and big announcement banners.

## Read first
- games/sample-3d/src/config.ts: HudUI, HudData.
- games/sample-3d/src/ui/hud.ts: the stub you replace.
- games/sample-3d/index.html: #ui is fixed, full screen, pointer-events none. The HUD must stay pointer-events none.

## Change
- src/ui/hud.ts, createHud(root): inject one <style> (prefix `hud-`), build the DOM once inside an `hud-root` (display none until show()). Fonts `'Arial Black', Impact, system-ui, sans-serif`, white with text-shadow 0 2px 4px rgba(0,0,0,.6).
  - XP bar: across the full top edge, 10px tall, dark background, fill #9cff57 width = xp01 * 100%. A level badge "LV {level}" at top 16px, left 16px (gold, 20px).
  - Hearts: top 44px, left 16px: maxHearts heart glyphs "♥" at 30px; the first `hearts` are #ff4d4d, the rest rgba(255,255,255,.25).
  - Stamina: below the hearts, a 170 x 10px bar with label "SPRINT" (11px) above it; fill #ffd54f width = stamina01; when exhausted the fill is #ff6b5a and the bar blinks (CSS animation).
  - Timer: top 18px, centred: m:ss of elapsedS (34px); below it "RUN #{runNumber}" (13px, opacity .8).
  - Top right (top 18px, right 20px), right-aligned: "☠ {kills}" and "🌰 {acorns}" (22px each, one per line).
  - Boss bar: when boss is not null, centred at bottom 40px, 60vw wide, 20px tall, with a label "THE COMBINE" above it (22px, #ff6b5a); dark background, red (#e53935) fill width hp/max; hidden when boss is null.
  - banner(title, sub, seconds): a centred block at top 26vh: title 44px heavy gold (#ffd54f), sub 20px white. It fades in over 0.2 s, stays, and fades out over 0.5 s ending `seconds` after the call. A new banner replaces the current one immediately (clear its timers).
  - update(d): write each element only when its displayed value changes (cache the last strings/widths), so it is cheap every frame.
  - show()/hide(): toggle the root's display. hide() also hides any banner.

## Contract
`export function createHud(root: HTMLElement): HudUI`.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in ui/hud.ts.

## Out of scope
Every other file, including the other ui/ files and main.ts.
~~~~

### 2.9 Build the level-up card picker and the end-of-run results screen

~~~~text
Epic: 2 Systems
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The level-up screen (pick one of three cards, optional reroll) and the end-of-run screen (death or victory, stats, acorns banked), both played straight-faced as roguelike rituals.

## Read first
- games/sample-3d/src/config.ts: LevelUpUI, UpgradeChoice, WEAPON_DEFS, ResultsUI, RunSummary, MOWER_TIERS (name, for "Killed by").
- games/sample-3d/src/ui/levelup.ts and ui/results.ts: the stubs you replace.
- games/sample-3d/index.html: #ui is fixed, full screen, pointer-events none. Your overlays must set pointer-events:auto on their root so they receive clicks.

## Change
Both: inject one <style> each (prefixes `lv-` and `rs-`); fonts `'Arial Black', Impact, system-ui, sans-serif`; build the root once (display none), fill it on show(). Keyboard listeners are added on show() and removed on hide(); ignore key presses during the first 250 ms after show() (levelup) or 800 ms (results).
- src/ui/levelup.ts, createLevelUpUI(root):
  - Root `lv-root`: full screen, background rgba(10,10,30,.6), flex column centred, pointer-events auto.
  - Heading "LEVEL UP!" (56px, gold #ffd54f, italic) and a sub line picked at random from: "Choose one. This is the roguelike part.", "The sacred ritual of picking a card.", "Synergies! Probably!", "Choose wisely. Or don't. You will die anyway.".
  - A row of cards, one per choice: 220 x 300px, rounded, dark gradient background, 3px border (weapon #ffd54f, passive #4dd0e1, heal #ff8fb1). Top: a tag "NEW!" if isNew, else "LV {nextLevel}" (heal: no tag). A big icon (56px): slingshot "🪨", trowels "🔱", sprinkler "💦", mushrooms "🍄", fertilizer "🌱", compost "♻️", comfyBoots "👢", heal "🥪". Title (22px), description (15px). For a new weapon, also WEAPON_DEFS[id].blurb in italics (13px, opacity .8). Bottom: key hint "[1]", "[2]", ... Cards pop in with a staggered scale animation and lift on hover. Clicking a card calls onPick(index).
  - Keys: Digit1..Digit4 and Numpad1..Numpad4 call onPick(index) when that card exists.
  - Below the cards a button "REROLL (R) · {rerollsLeft} LEFT", disabled when rerollsLeft is 0; clicking it or pressing R calls onReroll() (only when rerollsLeft > 0).
  - show() may be called again while open (after a reroll): just re-render.
- src/ui/results.ts, createResultsUI(root):
  - Root `rs-root`: full screen, background linear-gradient(180deg, rgba(20,0,0,.75), rgba(0,0,0,.85)) on death, linear-gradient(180deg, rgba(40,30,0,.7), rgba(0,0,0,.85)) on victory; flex column centred; pointer-events auto.
  - Death: title "YOU DIED" (80px, #ff4d4d) with "(permanently*)" beside it (22px); then "Killed by: {MOWER_TIERS[killedBy].name}" or "Killed by: hubris" if killedBy is null; footnote at the bottom "*until you click the button below".
  - Victory: title "COMBINE DEFEATED" (64px, gold) and "The lawn always grows back. That is the roguelike promise."
  - Stats block: "Run #{runNumber}", "Time survived {m:ss}" plus a "NEW BEST!" badge if newBestTime, "Mowers destroyed {kills}", "Level reached {level}".
  - Acorn breakdown: "Collected +{acornsCollected}", "Survival bonus +{survivalBonus}", "Boss bonus +{bossBonus}" (only if > 0), then "BANKED: {totalEarned} 🌰" (36px, gold) counting up from 0 over 1 s.
  - A random flavour line: "Your gnome is gone. Your acorns are not. The cycle continues.", "Death is just a loading screen with extra steps.", "Somewhere, a lawn is slightly shorter because of you.", "Spend your acorns. Become stronger. Die again, but better.".
  - Button "RETURN TO THE GARDEN" (big, gold); clicking it or pressing Space/Enter (after the 800 ms guard) calls onContinue() once.

## Contract
- `export function createLevelUpUI(root: HTMLElement): LevelUpUI`.
- `export function createResultsUI(root: HTMLElement): ResultsUI`.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in ui/levelup.ts or ui/results.ts.

## Out of scope
Every other file, including ui/lobby.ts, ui/hud.ts and main.ts.
~~~~
