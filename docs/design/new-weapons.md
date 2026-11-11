# New Weapons: Six Campy Garden Arms

Six auto-attacking weapons in the spirit of the Battle Sprinkler. Each is played completely straight. Each mechanic uses only WeaponContext (player, facing, enemies, stats, damage, slow, playSfx, dt). No knockback, no new sounds, no changes to other systems.

## 1. Storm of Daggers
- id: `stormOfDaggers`
- blurb: Hurls a cloud of tiny hand trowels that shreds whatever stands in it, arcane but with dirt.
- levelText: ["Hurls a cloud of trowels that shreds mowers inside it.", "Bigger cloud, more trowels, more damage.", "Cloud lasts longer and hits harder.", "Bigger cloud, faster hits, more trowels.", "Trowel blizzard. Huge cloud. MAX."]
- Mechanic: Every cooldownS × cooldownMult, cast a cloud centred 4 units in front of ctx.player along ctx.facing (forward = (sin facing, 0, cos facing)), but only if some enemy is within 12 units of ctx.player; otherwise retry in 0.2 s. At most 2 clouds live at once, and a cast blocked by that limit also retries in 0.2 s. A cloud lasts durationS and does not move; every tickS it deals damage × ctx.stats.damageMult to each enemy with dist2D(cloud centre, e.pos) < radius + e.radius. Each cast calls ctx.playSfx('shoot') once.
- Visuals: Per cloud, two InstancedMesh of trowelCount instances: silver blades (BoxGeometry 0.12 x 0.02 x 0.22, MeshStandardMaterial 0xb8c0c8) and green handles (BoxGeometry 0.05 x 0.03 x 0.10, 0x3e7d3a), plus one flat RingGeometry on the ground (0x9ad0ff, opacity 0.3). Instances orbit the centre at 0.3 to 1.0 of the radius at 4 rad/s and bob between y 0.4 and 1.2; matrices are rewritten each frame. Three meshes per cloud, six at most with two clouds.
- Level table:
  ```ts
  export interface StormOfDaggersLevel {
    cooldownS: number;   // seconds between casts
    radius: number;      // cloud radius, units
    durationS: number;   // seconds the cloud lasts
    tickS: number;       // seconds between damage ticks
    damage: number;      // per tick, per enemy inside
    trowelCount: number; // visual only: trowel instances per cloud
  }
  export const STORM_OF_DAGGERS_LEVELS: readonly StormOfDaggersLevel[] = [
    { cooldownS: 4.0, radius: 2.2, durationS: 3.0, tickS: 0.5, damage: 6, trowelCount: 12 },
    { cooldownS: 3.7, radius: 2.4, durationS: 3.2, tickS: 0.5, damage: 8, trowelCount: 14 },
    { cooldownS: 3.3, radius: 2.7, durationS: 3.5, tickS: 0.4, damage: 10, trowelCount: 16 },
    { cooldownS: 2.8, radius: 3.0, durationS: 4.0, tickS: 0.4, damage: 13, trowelCount: 18 },
    { cooldownS: 2.2, radius: 3.6, durationS: 4.5, tickS: 0.3, damage: 16, trowelCount: 20 },
  ];
  ```
- Balance note: Each mower inside the cloud takes 12 DPS at L1 (slingshot 10 DPS) and 53 DPS at L5 (slingshot 94 DPS), but every mower in the cloud is hit at once, so it outpaces the slingshot in crowds and trails it against a single target.

## 2. Leaf Pile Fireball
- id: `leafPileFireball`
- blurb: Lobs a bag of damp leaves at the nearest mower; it is not a fireball, and please stop calling it one.
- levelText: ["Lobs a leaf bag at the nearest mower. Splash.", "Bigger splash, more damage, slows survivors.", "Bigger splash, more damage, slows longer.", "Faster lobs, harder slow.", "Leaf bag of legend, huge splash. MAX."]
- Mechanic: Every cooldownS × cooldownMult, target the nearest enemy within range of ctx.player and fix the impact point at that enemy's position at the moment of the throw; if none is in range, retry in 0.2 s. The bag then flies for 0.35 s as a visual only, so the impact point does not track the target, and a target that dies in flight does not cancel the blast. On impact, each enemy with dist2D(impact, e.pos) < blastRadius + e.radius takes damage × ctx.stats.damageMult, and if slowS > 0 it is slowed with ctx.slow(id, slowFactor, slowS). ctx.playSfx('boom') fires once on impact; the 0.35 s flight is shorter than every cooldown, so bags never overlap.
- Visuals: One leaf bag at a time: SphereGeometry(0.35, 8, 6) in brown 0x7a4f22 (MeshStandardMaterial), moved along a parabola (height 2.0 × sin(π t)). On impact: a CircleGeometry scorch disc of radius blastRadius (0x3b2a14, opacity 0.6) and 8 puff spheres (SphereGeometry 0.15, 0xd9822b) that expand and fade over 0.5 s, all removed afterwards. Ten meshes at most.
- Level table:
  ```ts
  export interface LeafPileFireballLevel {
    cooldownS: number;   // seconds between throws
    range: number;       // units; target must be within this distance of the gnome
    blastRadius: number; // units, from the impact point
    damage: number;      // per enemy in the blast
    slowFactor: number;  // speed multiplier for survivors (0.5 = half speed)
    slowS: number;       // seconds the slow lasts; 0 = no slow
  }
  export const LEAF_PILE_FIREBALL_LEVELS: readonly LeafPileFireballLevel[] = [
    { cooldownS: 3.5, range: 12, blastRadius: 2.0, damage: 24, slowFactor: 1.0, slowS: 0.0 },
    { cooldownS: 3.3, range: 13, blastRadius: 2.3, damage: 32, slowFactor: 0.75, slowS: 1.2 },
    { cooldownS: 3.0, range: 14, blastRadius: 2.6, damage: 42, slowFactor: 0.7, slowS: 1.5 },
    { cooldownS: 2.7, range: 15, blastRadius: 2.9, damage: 56, slowFactor: 0.6, slowS: 1.8 },
    { cooldownS: 2.2, range: 16, blastRadius: 3.3, damage: 75, slowFactor: 0.5, slowS: 2.0 },
  ];
  ```
- Balance note: Against one mower the bag does 6.9 DPS at L1 and 34 DPS at L5 (slingshot 10 and 94 DPS), but the blast hits everything inside its radius, so it wins in crowds.

## 3. Garden Hose Magic Missile
- id: `hoseMissile`
- blurb: Fires hose jets that always find their target, Magic Missile with a rubber smell.
- levelText: ["Fires 2 hose jets, each at a different mower.", "+1 jet, more damage.", "Longer reach, more damage.", "+1 jet, fires faster.", "5 jets, maximum hose pressure. MAX."]
- Mechanic: Every cooldownS × cooldownMult, if any enemy is within range of ctx.player, sort the enemies in range by dist2D to ctx.player (ties by id) and give one jet to each of the first `jets` of them; a jet with no enemy left is wasted into the hedge. Each jet deals damage × ctx.stats.damageMult to its target at the moment of the cast, so it cannot miss and has no travel time. Each cast calls ctx.playSfx('shoot') once; if no enemy is in range, retry in 0.2 s.
- Visuals: Five beams created in the factory and kept for the weapon's life: CylinderGeometry(0.03, 0.03, 1, 6) with one shared MeshBasicMaterial (0x4fc3f7, transparent). On cast, each beam is placed from (player, y 1.0) to its target (y 0.8), scaled to length, then shrinks its radius to 0 over 0.15 s and hides. Five meshes, always.
- Level table:
  ```ts
  export interface HoseMissileLevel {
    cooldownS: number; // seconds between casts
    jets: number;      // jets per cast, each to a different enemy
    range: number;     // units from the gnome
    damage: number;    // per jet hit
  }
  export const HOSE_MISSILE_LEVELS: readonly HoseMissileLevel[] = [
    { cooldownS: 1.6, jets: 2, range: 10, damage: 7 },
    { cooldownS: 1.5, jets: 3, range: 10, damage: 9 },
    { cooldownS: 1.5, jets: 3, range: 12, damage: 11 },
    { cooldownS: 1.2, jets: 4, range: 12, damage: 13 },
    { cooldownS: 1.0, jets: 5, range: 14, damage: 17 },
  ];
  ```
- Balance note: Per target a jet does 4.4 DPS at L1 and 17 DPS at L5 (slingshot 10 and 94 DPS), but it sprays up to 2 targets at L1 and 5 at L5, so total output is about 8.8 DPS at L1 and 85 DPS at L5 when enough mowers are in range.

## 4. Wind Chime Lullaby
- id: `windChimeLullaby`
- blurb: Rings a wind chime that puts the weakest nearby mowers to sleep, dealing no damage and getting results.
- levelText: ["Wind chime puts the weakest nearby mowers to sleep.", "Bigger pool, wider radius, sleepers crawl slower.", "Bigger pool and radius. Sleep lasts longer.", "Faster chimes, bigger pool, deeper sleep.", "Deep lullaby, nearly stationary sleepers. MAX."]
- Mechanic: Every cooldownS × cooldownMult, collect the enemies with dist2D(ctx.player, e.pos) < radius + e.radius and sort them by hp ascending (ties by id). Walk that list taking each enemy while the running sum of hp stays at or below poolHp, and stop at the first enemy that would overflow the pool, so one tough mower blocks the rest. Each enemy taken is slowed with ctx.slow(id, slowFactor, slowS), and no damage is dealt; if the list is empty, retry in 0.2 s. Each cast calls ctx.playSfx('pickup') once.
- Visuals: A brass bar (BoxGeometry 0.4 x 0.02 x 0.02, 0xd4af37) at ctx.player + (0, 1.6, 0), with four tubes hanging from it (CylinderGeometry 0.015 x 0.5, same brass). The tubes sway with rotation.z = 0.1 × sin(3t). On cast, one RingGeometry (0xcfe8ff, opacity 0.5) expands from radius 0.2 to the level radius and fades over 0.8 s. Six meshes at most (the ring is shared between casts).
- Level table:
  ```ts
  export interface WindChimeLullabyLevel {
    cooldownS: number;  // seconds between casts
    radius: number;     // units from the gnome, to the enemy edge
    poolHp: number;     // total hp of enemies that can fall asleep per cast
    slowFactor: number; // speed multiplier for sleepers (0.1 = a tenth of normal speed)
    slowS: number;      // seconds the sleep lasts
  }
  export const WIND_CHIME_LULLABY_LEVELS: readonly WindChimeLullabyLevel[] = [
    { cooldownS: 6.0, radius: 3.5, poolHp: 40, slowFactor: 0.3, slowS: 2.5 },
    { cooldownS: 5.5, radius: 3.8, poolHp: 60, slowFactor: 0.25, slowS: 3.0 },
    { cooldownS: 5.0, radius: 4.2, poolHp: 90, slowFactor: 0.2, slowS: 3.5 },
    { cooldownS: 4.5, radius: 4.6, poolHp: 130, slowFactor: 0.1, slowS: 4.0 },
    { cooldownS: 4.0, radius: 5.0, poolHp: 200, slowFactor: 0.05, slowS: 5.0 },
  ];
  ```
- Balance note: It does 0 DPS at both L1 and L5 (slingshot 10 and 94 DPS), so it is pure crowd control, and its L5 pool of 200 hp puts two red mowers (100 hp each) to sleep per cast.

## 5. Leaf Blower of Endless Gale
- id: `leafBlower`
- blurb: Blows leaves in a cone along with anything else in it; the mowers have no say in the matter.
- levelText: ["Blows a cone of damage and slows mowers in it.", "Longer cone, more damage.", "Wider cone, more damage, slows harder.", "Longer reach, faster ticks, harder slow.", "Gale of legend, wide cone, long reach. MAX."]
- Mechanic: Always on, with no cooldown. Every tickS × cooldownMult, check each enemy: with d = e.pos − ctx.player and f = (sin facing, 0, cos facing), the enemy is inside if dist2D(ctx.player, e.pos) < range + e.radius and d·f ≥ |d| × cos(halfAngleRad). Each enemy inside takes damage × ctx.stats.damageMult and is slowed with ctx.slow(id, slowFactor, slowS). The blower plays no sound, since a sound every tick would be unbearable.
- Visuals: A flat sector fan, CircleGeometry of radius range and angle 2 × halfAngleRad, aimed along facing, in 0xbfe8a0 at opacity 0.18; rebuilt in setLevel. About 12 leaves are one InstancedMesh of PlaneGeometry(0.2, 0.12) in greens and browns, drifting forward along facing at 6 units/s and wrapping back to the gnome at range. One small BoxGeometry handle (0x3b3b3b) marks the blower at the player's hip. Three meshes total, always.
- Level table:
  ```ts
  export interface LeafBlowerLevel {
    range: number;        // units from the gnome, to the enemy edge
    halfAngleRad: number; // half the cone's angle, radians
    damage: number;       // per tick, per enemy inside
    tickS: number;        // seconds between ticks
    slowFactor: number;   // speed multiplier (0.7 = 70% speed)
    slowS: number;        // seconds the slow lasts after each tick
  }
  export const LEAF_BLOWER_LEVELS: readonly LeafBlowerLevel[] = [
    { range: 5.0, halfAngleRad: 0.5, damage: 4, tickS: 0.5, slowFactor: 0.7, slowS: 1.0 },
    { range: 5.5, halfAngleRad: 0.5, damage: 5, tickS: 0.5, slowFactor: 0.65, slowS: 1.0 },
    { range: 6.0, halfAngleRad: 0.6, damage: 6, tickS: 0.4, slowFactor: 0.6, slowS: 1.0 },
    { range: 6.5, halfAngleRad: 0.6, damage: 8, tickS: 0.35, slowFactor: 0.5, slowS: 1.2 },
    { range: 7.5, halfAngleRad: 0.7, damage: 10, tickS: 0.3, slowFactor: 0.4, slowS: 1.2 },
  ];
  ```
- Balance note: Per mower in the cone it does 8 DPS at L1 and 33 DPS at L5 (slingshot 10 and 94 DPS), so it is weaker than the slingshot on one target at L1 and far stronger once a crowd is in the cone.

## 6. Pitchfork of Sovereignty
- id: `pitchfork`
- blurb: Stabs forward in a three-pronged rectangle, and every third stab is declared royal, nobody asked.
- levelText: ["Stabs the area in front of you. Regularly.", "Wider prongs, more damage.", "Longer reach. Royal stabs hit harder.", "Faster stabs, longer reach.", "Royal stabs hit four times as hard. Long reach. MAX."]
- Mechanic: Every cooldownS × cooldownMult, check for a thrust: with d = e.pos − ctx.player, f = (sin facing, 0, cos facing) and p = (cos facing, 0, −sin facing), an enemy is in the rectangle if along = d·f lies in [−e.radius, reach + e.radius] and side = d·p lies within ±(halfWidth + e.radius). If no enemy is in the rectangle, retry in 0.2 s. Thrusts are counted; every royalEvery-th thrust is royal and deals damage × royalMult, and the others deal damage. Every enemy in the rectangle at cast time takes that amount × ctx.stats.damageMult, and ctx.playSfx('hit') fires once per thrust.
- Visuals: A handle, CylinderGeometry(0.03, 0.03, 1.4, 6) in wood 0x8b5a2b; three steel tines, BoxGeometry(0.03, 0.03, 0.5) in 0xaeb4bb, spaced by halfWidth and rebuilt in setLevel; and a gold crown, CylinderGeometry(0.12, 0.1, 0.06, 8) in 0xffd54a, at the handle top. A thrust slides the whole group forward by reach × sin(π t) over 0.25 s, and a royal thrust swaps the tines to a gold material for that thrust. Five meshes, always, sharing geometry and materials.
- Level table:
  ```ts
  export interface PitchforkLevel {
    cooldownS: number;  // seconds between thrusts
    reach: number;      // units forward from the gnome
    halfWidth: number;  // units either side of the centre line
    damage: number;     // per enemy hit by a plain thrust
    royalEvery: number; // every Nth thrust is royal (count)
    royalMult: number;  // royal thrust damage = damage × royalMult
  }
  export const PITCHFORK_LEVELS: readonly PitchforkLevel[] = [
    { cooldownS: 1.8, reach: 3.0, halfWidth: 0.9, damage: 16, royalEvery: 3, royalMult: 2 },
    { cooldownS: 1.7, reach: 3.2, halfWidth: 1.0, damage: 20, royalEvery: 3, royalMult: 2 },
    { cooldownS: 1.5, reach: 3.4, halfWidth: 1.1, damage: 26, royalEvery: 3, royalMult: 3 },
    { cooldownS: 1.4, reach: 3.6, halfWidth: 1.2, damage: 32, royalEvery: 3, royalMult: 3 },
    { cooldownS: 1.2, reach: 4.0, halfWidth: 1.3, damage: 40, royalEvery: 3, royalMult: 4 },
  ];
  ```
- Balance note: Per target a plain stab does 9 DPS at L1 and 33 DPS at L5, and counting the royal stabs the average is 12 DPS at L1 and 67 DPS at L5 (slingshot 10 and 94 DPS).

## Recommended first four
- `stormOfDaggers`: It is the flagship and needs only a timer and a circle test, while its trowel cloud sells the joke at a glance.
- `leafBlower`: It has no cooldown and only a cone test, so it is the simplest weapon that still looks good.
- `pitchfork`: The royal counter is a cheap, legible hook that carries the tone.
- `leafPileFireball`: It adds splash and the first delayed-hit timer, which is the one new pattern worth proving early.
