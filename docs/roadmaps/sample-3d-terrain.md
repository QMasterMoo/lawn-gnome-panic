# Roadmap: terrain (rolling hills)

One epic, four parallel issues. Planner did directly: src/terrain.ts with `heightAt(x, z)` and `normalAt(x, z, out?)` (deterministic rolling hills plus landmark mounds and a dip, flat within ~30 of the origin and near the fences and house: 0 there, roughly -4..+16 elsewhere); player.ts stands on the terrain (obstacle tops = heightAt(o.x, o.z) + o.height) and snaps down slopes; camera.ts never goes inside a hill; main.ts damage numbers use the mower's y.

Shared Environment text for every issue (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming. Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0 (`import * as THREE from 'three';`). No new dependencies.
- The lawn now has hills. `import { heightAt, normalAt } from './terrain';` (or '../terrain' from a subfolder). heightAt(x, z) is the ground height at a point; it is cheap but not free: call it once per object per frame at most, never in an inner per-vertex loop that runs every frame. Things that used to sit at y = 0 (or a fixed small y like 0.05) must now sit at heightAt(x, z) (+ the same small offset).
- Conventions: Y up, lawn ±ARENA_HALF (250), gnome ~1.4 units tall. The player's feet position (ctx.player / playerFeet) and enemies' pos already include terrain height.
- src/config.ts, src/main.ts, src/terrain.ts, src/player.ts and src/camera.ts are read-only. Keep exported names and signatures exactly.
- Three other workers are editing other files right now. Edit only the files your issue names.
- Check: `npx tsc --noEmit -p games/sample-3d`. No vite build, no dev server. If tsc errors only in files you do not own, wait and re-run; do not edit them.

### T.1 Shape the lawn mesh, stripes, mowed trails and fences to the terrain

~~~~text
## Environment
(shared text)

## Goal
The visible ground follows the hills: the lawn and stripe planes are displaced by heightAt, mowed-grass decals lie on the slope, and fence pickets stand on the ground.

## Read first
- games/sample-3d/src/terrain.ts: heightAt, normalAt.
- games/sample-3d/src/world.ts: the lawn plane, the stripes plane (y 0.02), the mowed InstancedMesh (y 0.04, markMowed writes instance matrices), the fence InstancedMeshes (pickets, tips, rails) and the north brick edging.

## Change
- games/sample-3d/src/world.ts:
  - Lawn: PlaneGeometry(size, size, 200, 200) (instead of 1x1). After creating it and before rotating, displace each vertex: for the plane in its local XY (it is later rotated -PI/2 about X, so local (x, y) maps to world (x, -y)), set local z = heightAt(x, -y). Then computeVertexNormals(). Keep the material and UV repeat.
  - Stripes: give the stripe plane the same treatment (its own PlaneGeometry(size, size, 200, 200) displaced the same way) and keep its small offset above the lawn (+0.02 in local z, i.e. add 0.02 to each displaced height).
  - Mowed decals: in markMowed, place each instance at y = heightAt(cx, cz) + 0.04 and orient it to the slope: the decal is a flat circle facing +Y; build its quaternion as setFromUnitVectors((0,1,0), normalAt(cx, cz)) multiplied by the existing random spin about Y. Keep scale and the ring-buffer logic.
  - Fences and rails: each picket and tip instance at y = heightAt(its x, its z) + its current y offset. Rails are long single boxes: replace each rail with per-picket-gap segments (an InstancedMesh of short rail pieces, one per gap, positioned at the average ground height of the two pickets + the rail's current height). North brick edging: each brick at heightAt + its current y.
  - Leave lights, the outer ground, update() and the shadow range logic as they are.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in world.ts.

## Out of scope
Every other file.
~~~~

### T.2 Make mowers drive over the hills

~~~~text
## Environment
(shared text)

## Goal
Mowers follow the ground: their base height is the terrain, they tilt with the slope they are driving on, and climbing obstacles works relative to the ground under the obstacle.

## Read first
- games/sample-3d/src/terrain.ts: heightAt.
- games/sample-3d/src/mowers.ts: spawn() (pos y 0), the climb/support logic (surface, climbTop, vy, pitch, `climbing`), the leash (resets y to 0), and the visuals step (group.position.set(pos.x, pos.y, pos.z), rotation.x = pitch).

## Change
- games/sample-3d/src/mowers.ts:
  - The surface under a mower defaults to heightAt(pos.x, pos.z) instead of 0. An obstacle's top is heightAt(o.x, o.z) + o.height (use this everywhere o.height is compared with pos.y: support, climbing, the "touching the side while below the top" test). The combine also follows the terrain (it still ignores obstacles).
  - spawn() and the leash set pos.y = heightAt(x, z) (and vy = 0).
  - Ground pitch: when not climbing and not falling, the target pitch is the slope along the heading: dh = heightAt(pos + forward * 1) - heightAt(pos - forward * 1); target = -Math.atan2(dh, 2). (Climbing and falling keep their existing target pitches.) Keep the existing easing toward the target.
  - Falling: when the mower is above its surface by more than 0.6 (e.g. it drove off an obstacle top), fall under gravity as now; when within 0.6 above the surface and not climbing, snap to it (so driving downhill does not bounce).

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowers.ts.

## Out of scope
Every other file.
~~~~

### T.3 Put props, field acorns, drops and world items on the terrain

~~~~text
## Environment
(shared text)

## Goal
Everything placed in the yard sits on the hills instead of floating or sinking: obstacle props, field acorns (including the ones on obstacle tops), XP/acorn drops, and rare world items with their beacons.

## Read first
- games/sample-3d/src/terrain.ts: heightAt.
- games/sample-3d/src/props.ts: buildProp returns a Group at (o.x, 0, o.z).
- games/sample-3d/src/pickups.ts: acorn spawn y (0.5, or o.height + 0.5 on obstacles) and the bob around baseY.
- games/sample-3d/src/drops.ts: the resting height 0.3 used by the pop physics, and spawn positions.
- games/sample-3d/src/items.ts: each item's group at (x, 0, z) (beacon, ground ring, model).

## Change
- games/sample-3d/src/props.ts: position the returned group at y = heightAt(o.x, o.z) - 0.15 (sunk slightly so slopes do not show a gap under one side).
- games/sample-3d/src/pickups.ts: lawn acorns: baseY = heightAt(x, z) + 0.5; acorns on an obstacle: baseY = heightAt(o.x, o.z) + o.height + 0.5.
- games/sample-3d/src/drops.ts: replace the fixed resting height 0.3 with heightAt(drop.x, drop.z) + 0.3 (computed per drop each frame it is resting or falling; magnetised drops fly freely as now). Spawned drops start at heightAt + 0.3.
- games/sample-3d/src/items.ts: each item group at y = heightAt(x, z); collection uses the item's y: require |playerFeet.y - item.y| < 3 instead of playerFeet.y < 3.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in props.ts, pickups.ts, drops.ts or items.ts.

## Out of scope
Every other file.
~~~~

### T.4 Make weapon effects and the zone ring follow the terrain

~~~~text
## Environment
(shared text)

## Goal
Ground-level weapon effects (rings, mines, clouds, fans, scorch marks) appear on the hills where they happen instead of at y = 0, and the battle royale's next-circle ring is not hidden inside hills.

## Read first
- games/sample-3d/src/terrain.ts: heightAt.
- games/sample-3d/src/weapons/sprinkler.ts (pulse ring at y 0.06 and droplets), weapons/mushrooms.ts (mines placed at the player's feet x/z with y 0, blast sphere at y 0.3), weapons/stormOfDaggers.ts (cloud centre and trowels bobbing between y 0.4 and 1.2, ground ring), weapons/leafBlower.ts (fan and leaves at a fixed low y), weapons/leafPileFireball.ts (bag start/landing heights, scorch disc and puffs), br/zone.ts (the next-circle RingGeometry at y 0.06).

## Change
- In each weapon file, replace fixed ground heights with the terrain at that point: an effect created at the player uses ctx.player.y as its ground; an effect at an enemy or impact point uses heightAt(x, z) there (or the enemy's pos.y). Keep the same offsets above the ground (e.g. ring at ground + 0.06, trowels between ground + 0.4 and ground + 1.2). Mines store their ground height when dropped. The fireball lands at heightAt(impact) + 0.35.
- br/zone.ts: the next-circle ring is a flat ring over a hilly area; set its material depthTest: false and renderOrder 5 so it stays visible over hills (keep it at y 0.06).
- Change nothing else in these files.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in the six files.

## Out of scope
Every other file, including the other weapon files (slingshot, trowels, hoseMissile, windChimeLullaby, pitchfork already use the player's or enemy's y).
~~~~
