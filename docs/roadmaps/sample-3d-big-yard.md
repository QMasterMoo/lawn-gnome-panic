# Roadmap: sample-3d phase 3, the big yard, visual modes and new weapons

## Goal

- **A much bigger, gnome-scale world.** The lawn grows from 40x40 to 500x500 units, with fog so it feels endless until you finally hit a fence. 1 m is ~4.7 units, so a real house is a 55-unit giant looming over the north edge, fence pickets are taller than the gnome, and the yard is full of giant clutter (kiddie pool, flowerpots, gnome statues, giant flowers, trees, a watering can). Mowers and acorns spawn in a ring around the player and get pulled back if they fall far behind.
- **Visual modes as feature flags**, toggled in the lobby's character select: OFF, RTX ON (deliberately over-the-top bloom and blur, like the meme) and CRT (curved screen, scanlines, RGB mask, colour fringing).
- **New weapons**: a designer worker proposes six campy weapons (including Storm of Daggers, which throws hand trowels); the planner picks the best and a final epic implements them.

## Shape

| Epic | Done when | Issues |
|---|---|---|
| 1. Foundation (planner, direct) | Config has the big arena, new obstacle kinds, spawn-ring tuning, VisualMode/FeatureFlags/PostFX/Scenery types; flags.ts; main.ts wires postfx, props, house, scenery and the lobby toggle; stubs for postfx, props, house, scenery; tsc passes. | written directly |
| 2. Yard, visuals, items, juice, weapon design | Each piece below is done; the game builds. | 11, parallel |
| 3. New weapons | The chosen weapons from the design doc are implemented. | written after epic 2 |

---

## Epic 2

Shared Environment text for every issue in this epic (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming (Git Bash /c/Users/cstab/Documents/gaming). Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0. Import three as `import * as THREE from 'three';`. Addons resolve as `three/addons/...` (for example `import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';`). Dependencies are installed; do not add any.
- Conventions: Y is up, ground at y = 0. The lawn spans -ARENA_HALF..ARENA_HALF (250) on x and z: a 500x500 yard. OBSTACLES has ~270 entries (a hand-placed core near the origin plus a seeded scatter). North of the lawn (z < -250) is the patio and the house (front wall at HOUSE_FRONT_Z = -256). The scene has Fog(sky, 60, 380) and camera far 2600; main.ts hides props beyond ~200 units. Scale: the gnome is ~1.4 units tall (~30 cm), so 1 m ~ 4.7 units; build real-world objects at that scale. A yaw `a` means forward `(sin a, 0, cos a)`; yaw 0 faces +z. "dist2D" means `Math.hypot(a.x - b.x, a.z - b.z)`.
- The game compiles right now. Every module's exported names and signatures are final (main.ts uses them). Keep them exactly.
- src/config.ts and src/main.ts are read-only: import from config, never edit either.
- Ten other workers are editing other files in games/sample-3d at the same time. Edit only the files your issue names.
- Check with `npx tsc --noEmit -p games/sample-3d`. Do not run vite build or npm run build, and do not start a dev server. If tsc reports an error only in a file you do not own, another worker is mid-edit: wait a little and re-run; if it persists, report it and do not edit that file.
- Performance: the scene must stay smooth on a laptop. Share geometries and materials, use THREE.InstancedMesh for anything repeated more than ~20 times, and keep shadow casting to objects near the lawn.
- Tone: campy and self-aware. Where you invent text, keep it short and dry.

### 2.1 Rebuild the world for the 500x500 lawn

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
world.ts builds the huge lawn: a tiled grass texture with mowed trails drawn as instanced decals, a sun whose shadow follows the player, gnome-scale picket fences on the east, west and south sides, and a brick edging along the north side. It no longer builds obstacle meshes (props.ts does) or the outer hedges (scenery.ts does).

## Read first
- games/sample-3d/src/world.ts: the current implementation you rewrite (keep its CanvasTexture lawn approach, markMowed/update/reset).
- games/sample-3d/src/config.ts: World (note update(dt, focus)), ARENA_HALF, COLORS.

## Change
- games/sample-3d/src/world.ts, buildWorld(scene):
  - Remove the obstacle meshes, the outer 200x200 ground plane, the hedges and the corner flowers.
  - Lights: HemisphereLight(0xffffff, 0x446644, 1.2). Sun: DirectionalLight(0xfff2d6, 2.8), castShadow, shadow.mapSize 2048, shadow camera left/bottom -35, right/top 35, near 1, far 160, bias -0.0005. Add sun and sun.target to the scene. update(dt, focus): sun.target.position.set(focus.x, 0, focus.z); sun.position.set(focus.x + 40, 70, focus.z + 25) (so shadows always cover the player's surroundings).
  - Lawn (500x500 is too big for one mowing canvas, so mowing uses decals):
    - Grass tile: a 256x256 canvas: fill COLORS.grass, 3000 random 2x2 speckles in darker (x0.9) and lighter (x1.1) shades. CanvasTexture, wrapS/wrapT RepeatWrapping, repeat (ARENA_HALF*2/8, ARENA_HALF*2/8), colorSpace SRGB, anisotropy 8. Plane ARENA_HALF*2 square, MeshStandardMaterial({ map, roughness: 1 }), rotation.x = -PI/2, receiveShadow.
    - Classic lawn stripes: a second plane just above (y 0.005) with a 1x64 canvas texture of alternating transparent and white (alpha 0.05) bands, repeated so each stripe is 10 units wide along z; transparent, depthWrite false.
    - Mowed decals: one InstancedMesh of CircleGeometry(1, 12) rotated flat, MeshStandardMaterial COLORS.grassMowed (transparent, opacity 0.55, depthWrite false, polygonOffset), capacity 6000, at y 0.01. markMowed(x, z): snap to a 0.8-unit grid cell; if that cell key is already in a Set, return; else write the next ring-buffer slot (scale 0.75, small random rotation), add the cell to the Set (when a slot is overwritten, delete its old cell key), set instanceMatrix.needsUpdate and mesh.count = min(written, capacity).
    - reset(): clear the Set, count = 0.
  - Ground beyond the lawn: a 6000x6000 plane at y = -0.02, colour 0x3f7f2b, receiveShadow.
  - Fences (gnome scale: a 1.2 m fence is ~5.6 units): on the west (x = -ARENA_HALF - 0.5), east (x = +ARENA_HALF + 0.5) and south (z = +ARENA_HALF + 0.5) sides, full length (500 units), pickets every 2.2 units. Each picket: Box 1.1 wide x 5.6 tall x 0.25 deep (COLORS.fence), plus a pointed top: a 4-sided Cone radius 0.78, height 0.8 rotated so a flat face points out. Use two InstancedMeshes (bodies, tips) with per-instance matrices; castShadow on both. Two horizontal rails per side at y 1.4 and 4.2 (Box along the side, 0.35 tall, 0.3 deep).
  - North edging: along z = -ARENA_HALF - 0.6 for the full width, a row of bricks (Box 2.2 x 1.1 x 1.0, colour 0xa0522d with every third brick 0x8b4513), as one InstancedMesh, castShadow.

## Contract
`export function buildWorld(scene: THREE.Scene): World` with markMowed(x, z), update(dt, focus) and reset() as in config.ts.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in world.ts.

## Out of scope
Every other file, including props.ts, scenery.ts and house.ts.
~~~~

### 2.2 Build meshes for every obstacle kind

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
buildProp(o) returns a good-looking, gnome-scale mesh for each ObstacleKind that fills the obstacle's collision cylinder (radius o.radius, height o.height).

## Read first
- games/sample-3d/src/config.ts: Obstacle, ObstacleKind, OBSTACLES (see the sizes in use), COLORS.
- games/sample-3d/src/props.ts: the stub you replace.
- games/sample-3d/src/world.ts: lines that build 'stump', 'rock', 'bush', 'birdbath' meshes (port and scale those; another worker is removing them from world.ts).

## Change
- games/sample-3d/src/props.ts, buildProp(o): return a Group positioned at (o.x, 0, o.z). There are ~270 props, so keep each to at most ~8 meshes and share geometries and materials at module level (cache by colour and by size where possible). castShadow and receiveShadow on every mesh. Build each so its top is at o.height (things the player can stand on need a flat top at exactly o.height):
  - stump: bark Cylinder(o.radius, o.radius*1.15, o.height, 20) COLORS.stump; top disc 0xc9a46a with 3 darker growth rings (thin Torus 0x9c7a48) at y o.height + 0.01.
  - rock: Dodecahedron(o.radius) 0x9e9e9e flatShading, scale.y = o.height / o.radius, y = o.height/2; a smaller second rock leaning on it.
  - bush: 4-5 overlapping Spheres (COLORS.bush, and a lighter 0x3d8f3d) filling the cylinder, top around o.height; a few tiny flower dots (pink/white Spheres r 0.12) on the surface.
  - birdbath: stone pedestal, wide shallow bowl at the top, water disc 0x5ec8f2 (all scaled to o.radius and o.height), and a little bird (2 Spheres + Cone beak, 0x6d4c41) sitting on the rim.
  - brick: a stack of 3 bricks (Box 2*o.radius x o.height/3 x o.radius, 0xa0522d), alternately rotated 15 degrees.
  - flowerpot: terracotta (0xc8643b) tapered Cylinder(o.radius, o.radius*0.8, o.height*0.92), a rim Torus at the top, dark soil disc 0x3e2723 just below o.height, and a little plant (3 green Cones) sticking out.
  - bucket: galvanised metal (0xa8b2b8, metalness 0.7, roughness 0.35) Cylinder(o.radius, o.radius*0.85, o.height, 24, 1, true) with a bottom disc, a rim Torus, and a handle (TorusGeometry half-arc, thin) over the top.
  - pool (kiddie pool): a blue (0x2f8fe0) Torus ring of tube radius 0.6 around the edge, sitting on a pale blue Cylinder wall of height o.height; water surface Cylinder 0x7fd6ff (transparent, opacity 0.85) at y o.height - 0.2; a floating yellow rubber duck (2 Spheres + orange Cone beak) and a striped beach ball (Sphere with 3 coloured bands; use 3 Sphere segments or a CanvasTexture).
  - statue: a stone grey (0xb0b0b0) gnome statue made of primitives (cone hat, sphere head, cone beard, cylinder body) scaled so its total height is o.height, on a square plinth; a small plaque Box on the plinth front with a CanvasTexture reading "COMING SOON".
  - flower: a thin green stem Cylinder(o.radius, o.radius, o.height) 0x3c8d2f with two leaves (flattened Spheres), and a big bloom at the top: 8 petals (flattened Spheres, radius ~1.2) around a yellow centre Sphere, tilted slightly. Choose the petal colour from [0xff5d8f, 0xffd54f, 0xffffff, 0xb388ff] by a hash of (o.x, o.z) so it is stable.
  - tree: trunk Cylinder(o.radius*0.8, o.radius, o.height*0.55) 0x6d4c41 with 3 root bulges; canopy of 5-7 large Spheres (radius ~ o.radius*3.5) 0x2e7d32 / 0x388e3c clustered between 0.5 and 1.0 of o.height. Canopy castShadow true.
  - wateringCan: green (0x43a047) Cylinder body, a long thin spout (Cylinder) angled up at 35 degrees ending in a rose (flattened Cylinder), and a top handle (half Torus).

## Contract
`export function buildProp(o: Obstacle): THREE.Object3D` (main.ts adds the result to the scene). Do not change Obstacle or OBSTACLES.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in props.ts.

## Out of scope
Every other file, including world.ts.
~~~~

### 2.3 Build the giant house and patio

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
A giant suburban house north of the lawn, at gnome scale, with enough detail to give the yard personality: patio, steps, door, windows, roof, chimney, gutters and a few silly touches.

## Read first
- games/sample-3d/src/config.ts: ARENA_HALF, HOUSE_FRONT_Z, COLORS.
- games/sample-3d/src/house.ts: the stub you replace.

## Change
- games/sample-3d/src/house.ts, buildHouse(scene): add one Group. All sizes are gnome scale (1 m ~ 4.7 units). Let F = HOUSE_FRONT_Z (-256). The house is centred on x = 0, front wall facing +z (toward the lawn).
  - Patio between the lawn and the house: z from -ARENA_HALF - 1.2 to F, x from -70 to 70: a grid of square stone slabs (2.6 units, colour 0xbdb5a6 with slight random variation, small gaps) as one InstancedMesh at y 0.05, receiveShadow.
  - Walls: a Box 96 wide x 38 tall x 60 deep, back face at F - 60, front face at F; siding colour 0xf4e8d0. Horizontal siding lines: thin darker Boxes every 2.5 units up the front wall (InstancedMesh).
  - Foundation band: Box 97 x 2.5 x 61, 0x8d8d8d, at the bottom.
  - Roof: a gable roof running along x: two sloped Boxes (or an extruded triangle) from the wall top (y 38) to a ridge at y 60, overhanging the walls by 3 units, colour 0x6d4c41 with ridge cap 0x5d4037. Gable ends filled (triangular prism or ExtrudeGeometry of a triangle Shape).
  - Chimney: Box 7 x 26 x 7 brick red 0xa0522d at x 28, rising through the roof to y ~68, with a darker cap.
  - Front door at x 0: frame, door Box 10 wide x 21 tall (0x7b1f1f) slightly recessed, a brass knob Sphere (metalness 0.8), a small window in the door, and a doormat on the top step: a CanvasTexture plane reading "GO AWAY, GNOMES".
  - Steps: 3 concrete steps (0xbfbfbf) in front of the door, each 0.85 tall, 18 wide, 2.2 deep, descending toward the lawn.
  - Windows: ground floor 4 and upper floor 5 across the front, each 11 wide x 13 tall: white frame Boxes, a cross mullion, glass Box 0x9fd8ff (metalness 0.2, roughness 0.1, slightly emissive 0x223344); upper windows have blue shutters (0x1e88e5). One upper window has a CanvasTexture curtain with a cat silhouette.
  - Gutters along the eaves (thin Box, 0xe0e0e0) and a downpipe at x -46.
  - Silly touches: a giant garden hose reel on the wall at x -38 near the ground (Cylinder reel + green Torus coils 0x2e7d32), an air-conditioner unit Box at x 40 with a grille, and a house number plaque "404" (CanvasTexture) next to the door.
  - castShadow on the walls, roof, chimney and steps; receiveShadow on everything.

## Contract
`export function buildHouse(scene: THREE.Scene): void`.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in house.ts.

## Out of scope
Every other file.
~~~~

### 2.4 Build the sky, clouds, trees and neighbouring yards

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Everything outside the lawn except the house: a gradient sky dome with a sun disc, drifting clouds, tall trees and hedges beyond the fences, distant neighbour fences and roofs, and floating dandelion fluff near the player for atmosphere.

## Read first
- games/sample-3d/src/config.ts: Scenery, ARENA_HALF, HOUSE_FRONT_Z, COLORS.
- games/sample-3d/src/scenery.ts: the stub you replace.
- games/sample-3d/src/main.ts: the scene has Fog(COLORS.sky, 60, 380) and the camera far plane is 2600. The fog hides most distant geometry, so the sky dome and clouds must use fog: false.

## Change
- games/sample-3d/src/scenery.ts, buildScenery(scene):
  - Sky dome: SphereGeometry(2000, 32, 16), ShaderMaterial with side BackSide, depthWrite false, fog false: vertical gradient from horizon 0xcfe9ff to zenith 0x5aa9ff (mix by normalized y of the world position), plus a soft sun glow toward direction (0.5, 0.6, 0.3) normalised (add a warm 0xfff2c0 term with pow(dot, 64) and a wider pow(dot, 6) halo). update(dt, focus): keep the dome centred on the focus in x and z, so its horizon never comes close.
  - Clouds: 14 clouds, each a Group of 4-7 white Spheres (MeshStandardMaterial 0xffffff, roughness 1, flatShading false), radius 12-28, at heights 180-260, spread over ±900 around the origin. They drift +x at 2-4 units/s and wrap from x 1000 to -1000. fog false on their material so they stay white.
  - Trees beyond the fences: ~40 trees (trunk Cylinder radius 3-4.5, height 30-45, 0x5d4037; canopy 3-4 Spheres radius 14-22, greens 0x2e7d32/0x33691e/0x388e3c) scattered in a band from ARENA_HALF + 25 to ARENA_HALF + 110 beyond the west, east and south fences (not north of the lawn, the house is there; behind the house at z < HOUSE_FRONT_Z - 80 is fine). Use ~80 trees. Use InstancedMesh for trunks and canopy spheres. castShadow false (too far).
  - Hedges right outside the fences: on the west, east and south, a row of hedge Boxes (height 9, depth 6, colour 0x2f7a2f) at distance ARENA_HALF + 6 from the centre, with rounded tops made of instanced Spheres.
  - Neighbours: beyond the east and west hedges, two neighbour houses at x ±(ARENA_HALF + 180), z -40: simple Box body (90 x 36 x 70, colours 0xd7ccc8 and 0xb3e5fc) with a gable roof, two windows each. Behind the south hedge at z ARENA_HALF + 80, a neighbour's wooden fence (InstancedMesh planks, 0x8d6e63, height 9).
  - Dandelion fluff: 60 tiny white Sprites or Points (size ~0.15 units, soft round texture from a small CanvasTexture) in a 30x10x30 box around the focus, drifting slowly with a sine wobble; when a mote leaves the box relative to focus, re-place it on the opposite side. update(dt, focus) moves them and the clouds.

## Contract
`export function buildScenery(scene: THREE.Scene): Scenery` with update(dt, focus).

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in scenery.ts.

## Out of scope
Every other file, including house.ts and world.ts.
~~~~

### 2.5 Spawn mowers and field acorns around the player

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
With a 120x120 lawn, enemies and acorns must appear near the player: mowers spawn in a ring around the player and are pulled back if they fall far behind; the boss spawns near the player; field acorns spawn near the player and despawn when left far behind.

## Read first
- games/sample-3d/src/config.ts: TUNING (spawnRingMin, spawnRingMax, mowerLeashDist, bossSpawnDist, pickupRingMin, pickupRingMax, pickupLeashDist, maxClimbableHeight, pickupMax, pickupSpawnS, pickupOnObstacleChance), MOWER_TIERS, OBSTACLES, ARENA_HALF.
- games/sample-3d/src/mowers.ts: spawn(), update() and spawnBoss() (you change spawning only).
- games/sample-3d/src/pickups.ts: its spawn logic and update().

## Change
- games/sample-3d/src/mowers.ts:
  - Helper ringPoint(target, minR, maxR, clearance): up to 12 tries: angle random, r random in [minR, maxR], p = target + (cos angle, sin angle) * r; clamp p.x, p.z to ±(ARENA_HALF - clearance - 1); accept if dist2D(p, o) > o.radius + clearance + 0.5 for every obstacle in OBSTACLES. Return the last candidate if none is accepted.
  - spawn() without coordinates now uses ringPoint(target, TUNING.spawnRingMin, TUNING.spawnRingMax, def.radius), with heading toward the target (atan2(target.x - x, target.z - z)). update() has the target; pass it to spawn.
  - Leash: in update, any alive non-combine mower with dist2D(pos, target) > TUNING.mowerLeashDist is moved to a new ringPoint (same ring) with its heading reset toward the target.
  - spawnBoss(): it has no target parameter, so remember the last target seen by update() (a module-level Vector3, default origin) and place the combine at ringPoint(lastTarget, TUNING.bossSpawnDist, TUNING.bossSpawnDist + 3, combine radius), heading toward lastTarget.
- games/sample-3d/src/pickups.ts:
  - Lawn spawns: a random point at distance [TUNING.pickupRingMin, TUNING.pickupRingMax] from playerFeet, clamped to ±(ARENA_HALF - 2), farther than o.radius + 1 from every obstacle, and at least 1.5 from other acorns (same retry approach as now).
  - On-obstacle spawns: only choose obstacles with height <= TUNING.maxClimbableHeight and within TUNING.pickupRingMax + 5 of the player; if there is none, fall back to a lawn spawn.
  - Leash: remove acorns farther than TUNING.pickupLeashDist from the player (dist2D), so new ones can spawn nearby.

## Contract
Signatures unchanged: createMowerSystem(scene): MowerSystem; createPickupSystem(scene): PickupSystem.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowers.ts or pickups.ts.

## Out of scope
Every other file, including mowerModels.ts and main.ts.
~~~~

### 2.6 Implement post-processing for the OFF, RTX ON and CRT visual modes

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
createPostFX renders the scene in one of three visual modes: OFF (plain), RTX ON (a deliberate parody: absurd bloom, soft blur, oversaturated, glowing, with an "RTX ON" watermark) and CRT (an old curved tube TV).

## Read first
- games/sample-3d/src/config.ts: PostFX, VisualMode.
- games/sample-3d/src/postfx.ts: the stub you replace.
- games/sample-3d/src/main.ts: postfx is created once; resize() calls postfx.setSize(w, h) with CSS pixels; the loop calls postfx.render(dt) every frame instead of renderer.render; the lobby calls postfx.setMode(mode) at any time.
- node_modules/three/examples/jsm/postprocessing/EffectComposer.js, RenderPass.js, UnrealBloomPass.js, ShaderPass.js, OutputPass.js: constructor signatures (imports are `three/addons/postprocessing/<Name>.js`).

## Change
- games/sample-3d/src/postfx.ts, createPostFX(renderer, scene, camera):
  - Keep width/height from setSize (default window size). Build both composers lazily the first time their mode is selected; on setSize resize any built composer (composer.setSize(w, h) and bloom resolution).
  - 'off': renderer.render(scene, camera). Hide the watermark.
  - 'rtx': EffectComposer(renderer) with: RenderPass(scene, camera); UnrealBloomPass(new THREE.Vector2(w, h), 2.2 /* strength */, 0.9 /* radius */, 0.12 /* threshold */); a ShaderPass with a custom "RTX" shader; OutputPass. The RTX shader (uniforms tDiffuse, resolution, time):
    - 13-tap blur (a cross of samples at 1, 2, 3 px multiplied by a blurPx uniform of 2.5 in x and y, plus 4 diagonals) averaged with weights, mixed 70/30 with the original sample (so it is blurry but readable).
    - Radial "god ray" blur toward a light position uniform (0.78, 0.82) in uv: 12 samples along the vector to the light, decaying, added at 0.35 strength.
    - Saturation x1.55, contrast x1.12, a warm tint (multiply by vec3(1.06, 1.0, 0.92)), and a soft bright vignette (brighten the centre slightly rather than darken edges).
    - Very subtle shimmer: brightness * (1.0 + 0.02 * sin(time * 3.0)).
    - Watermark: a DOM element appended to document.body: text "RTX ON", position fixed, bottom 18px, right 24px, font 'Arial Black' 44px italic, white with text-shadow 0 0 12px #fff, 0 0 30px #9cff57, pointer-events none, z-index 50. Shown only in 'rtx'.
  - 'crt': EffectComposer with RenderPass, a ShaderPass with a custom "CRT" shader, OutputPass. Call composer.setPixelRatio(0.6) for that chunky low-res look. The CRT shader (uniforms tDiffuse, resolution, time):
    - Barrel distortion: uv centred at 0.5, uv' = uv + c * dot(c, c) * 0.18 where c = uv - 0.5; outside [0,1] -> black, with a 0.01-wide soft dark edge (rounded corners).
    - Chromatic aberration: sample r at uv' + offset, g at uv', b at uv' - offset, offset = c * 0.004.
    - Scanlines: multiply by 0.78 + 0.22 * sin(uv'.y * resolution.y * 3.14159).
    - Aperture grille: based on mod(gl_FragCoord.x, 3.0), multiply by vec3(1.1,0.9,0.9) / vec3(0.9,1.1,0.9) / vec3(0.9,0.9,1.1).
    - Vignette (darken edges, smoothstep), flicker * (0.97 + 0.03 * sin(time * 60.0)), slight noise (hash of uv and time, ±0.03), and a little glow: color += color * color * 0.25.
  - render(dt): accumulate time; set the shader time uniforms; render with the current mode's composer (composer.render(dt)) or renderer.render for 'off'.

## Contract
`export function createPostFX(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): PostFX` with setMode, setSize and render exactly as in config.ts.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in postfx.ts.

## Out of scope
Every other file.
~~~~

### 2.7 Add the visual mode feature-flag toggle to the lobby's character select

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The lobby's character-select column gets a "VISUAL MODE" toggle with three options (OFF, RTX ON, CRT) that calls back into the game and shows which is active.

## Read first
- games/sample-3d/src/config.ts: LobbyCallbacks (onVisualMode), LobbyUI (setVisualMode), VisualMode.
- games/sample-3d/src/ui/lobby.ts: the existing lobby. Find the character column (`lb-chars`), the style block, and the placeholder `setVisualMode(_mode: VisualMode) {}` that you replace.

## Change
- games/sample-3d/src/ui/lobby.ts:
  - Below the character cards in the left column, add a panel: heading "VISUAL MODE" with a small sub "(feature flags)", then a segmented control of three buttons in one row: "OFF", "RTX ON", "CRT". pointer-events auto. The active one is filled gold (#ffd54f, dark text); the others are dark translucent with a light border. Hover brightens.
  - Under the buttons a caption that changes with the active mode:
    - off: "As the gnome intended."
    - rtx: "Ray-traced* (*not ray-traced). Now 400% blurrier."
    - crt: "Like grandma's TV. Scanlines at no extra charge."
  - Clicking a button calls cb.onVisualMode(mode) with 'off' | 'rtx' | 'crt'. Do not change the highlight on click; setVisualMode(mode) (called by the game right after) updates the highlight and caption.
  - Keep everything else in the lobby as it is. If the left column gets too tall for small screens, make it scroll (max-height and overflow-y auto).

## Contract
`createLobbyUI(root, cb)` signature unchanged; the returned object implements setVisualMode(mode: VisualMode).

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in ui/lobby.ts.

## Out of scope
Every other file.
~~~~

### 2.8 Design six new campy weapons, including Storm of Daggers

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)
This issue writes a design document only. Do not edit any .ts file.

## Goal
A design doc proposing six new auto-attacking weapons in the spirit of the existing ones, especially the Battle Sprinkler: mundane garden items played completely straight as epic, deadpan weapons, with some Dungeons & Dragons spell parodies. Another worker will implement them later from this doc alone, so every mechanic must be concrete and buildable.

## Read first
- games/sample-3d/src/config.ts: WEAPON_DEFS (the tone of names, blurbs and levelText), SprinklerLevel/SPRINKLER_LEVELS and the other *_LEVELS tables (balance reference), WeaponContext and EnemyView (what a weapon can see and do), SfxName (sounds that exist), MOWER_TIERS (enemy hp: 15 to 100, the boss 2500).
- games/sample-3d/src/weapons/sprinkler.ts: a full implementation, to see what is practical.

## Change
- Create docs/design/new-weapons.md containing exactly six weapons. Weapon 1 must be **Storm of Daggers** (a parody of the D&D spell Cloud of Daggers): the gnome hurls a flurry of tiny hand trowels (little single-hand shovels). At least two others should be D&D spell parodies (for example a fireball or magic-missile parody using garden things); the rest garden-shed items treated as legendary gear.
- For each weapon, use this exact format:

  ## <n>. <Name>
  - id: `<camelCase id, unique, not slingshot/trowels/sprinkler/mushrooms>`
  - blurb: <one deadpan sentence, at most 110 characters>
  - levelText: ["<L1>", "<L2>", "<L3>", "<L4>", "<L5 ending in MAX.>"]
  - Mechanic: <2-5 sentences: what it does each update, in terms of WeaponContext only: ctx.player (feet position), ctx.facing, ctx.enemies (id, pos, radius, hp), ctx.damage(id, amount), ctx.slow(id, factor, seconds), ctx.playSfx(existing SfxName), ctx.stats.damageMult / cooldownMult, ctx.dt. No knockback, no new sounds, no changes to other systems.>
  - Visuals: <the three.js primitives and colours to build it from, and how they move. Must be cheap: under ~60 meshes alive at once.>
  - Level table:
    ```ts
    export interface <Name>Level { <fields with units in comments> }
    export const <NAME>_LEVELS: readonly <Name>Level[] = [ <5 rows> ];
    ```
  - Balance note: <one sentence comparing its damage per second at level 1 and 5 to the slingshot (10 dmg / 1.0 s at L1, 3 x 22 dmg / 0.7 s at L5).>

- End the doc with a short "## Recommended first four" section listing four ids and one sentence each on why.

## Done when
- docs/design/new-weapons.md exists with six weapons in the exact format, each with a complete 5-row level table, and the recommended-four section.
- `npx tsc --noEmit -p games/sample-3d` still passes (you changed no code).

## Out of scope
All code files.
~~~~

### 2.9 Build the rare world items with beacons, and the Shop-Vac vacuum

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Rare power-up items that spawn near the player every ~25 s, each marked by a tall glowing beacon visible through the fog, collected by walking into them. main.ts applies their effects. Also DropSystem.vacuum(), which pulls every dropped pellet to the player.

## Read first
- games/sample-3d/src/config.ts: ItemKind, ItemDef, ITEM_DEFS, ItemMarker, ItemSystem, TUNING (itemSpawnS, itemMax, itemRingMin, itemRingMax, itemLeashDist), OBSTACLES, ARENA_HALF.
- games/sample-3d/src/items.ts: the stub you replace.
- games/sample-3d/src/drops.ts: find the placeholder `vacuum() {},` and the per-drop `magnet` / `magnetT` fields used in update().

## Change
- games/sample-3d/src/items.ts, createItemSystem(scene):
  - Item: { kind, group, pos: THREE.Vector3, t }. spawnTimer starts at 15, then TUNING.itemSpawnS after each spawn.
  - update(dt, playerFeet): spawnTimer -= dt; when <= 0 and count < TUNING.itemMax, spawn one: kind by weighted random over ITEM_DEFS[*].weight; position: up to 12 tries of a random angle and radius in [itemRingMin, itemRingMax] around the player, clamped to ±(ARENA_HALF - 3), farther than o.radius + 2 from every obstacle.
  - Each item's group at (x, 0, z) contains:
    - Beacon: CylinderGeometry(0.6, 0.6, 60, 16, 1, true) at y 30, MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }). Opacity pulses 0.15..0.3.
    - Ground ring: TorusGeometry(1.4, 0.08, 8, 40) flat at y 0.05, MeshBasicMaterial def.color; scale pulses 1..1.25.
    - The item model at y 1.2 (bobbing ±0.2, spinning 1.5 rad/s), made of primitives at roughly 1 unit across:
      - chicken: white plate (flattened Cylinder r 0.7), a roast chicken (Sphere r 0.45 colour 0xb5651d scaled (1.3, 0.9, 1)) and two drumsticks (short Cylinders 0xc97a3a with white bone Spheres).
      - shopVac: red (0xd32f2f) Cylinder canister r 0.4 h 0.7 with a black lid, a black hose (TorusGeometry(0.35, 0.06, 8, 20, PI)) and a grey nozzle.
      - weedKiller: a spray bottle: green (0x76ff03, slightly emissive) Cylinder body, white neck and trigger head (Boxes), and a yellow-and-black hazard band.
      - espresso: white cup (open Cylinder with a bottom disc) on a saucer, a dark coffee disc 0x3e2723 inside, and 3 small white transparent spheres rising and fading in a loop (steam).
      - compostBin: a dark green (0x2e7d32) Box bin with a slightly larger lid, and emissive purple (0xe040fb) edge strips (thin Boxes) like a treasure chest glow.
  - Collect: if dist2D(item, player) < 1.6 and playerFeet.y < 3: remove it from the scene and add its kind to the returned array.
  - Leash: remove items farther than TUNING.itemLeashDist from the player.
  - active(): the items as ItemMarker objects ({ kind, pos }).
  - reset(): remove all, spawnTimer = 15.
- games/sample-3d/src/drops.ts: implement vacuum(): set magnet = true on every drop (keep magnetT as is), so they all fly to the player from anywhere. Change nothing else in drops.ts.

## Contract
- `export function createItemSystem(scene: THREE.Scene): ItemSystem` with update, active and reset.
- DropSystem.vacuum(): void.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in items.ts or drops.ts.

## Out of scope
Every other file. main.ts already applies the effects (heal, vacuum, weed killer, espresso, free level-up).
~~~~

### 2.10 Build the juice layer: damage numbers, combo, level-up celebration, toasts, shake and item arrows

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The game-feel layer that makes it compulsive: floating damage numbers, an escalating kill-combo counter with milestone shouts, a red flash when hurt, a confetti-and-sunburst level-up celebration, big pickup toasts, camera shake, and arrows at the screen edge pointing to off-screen items.

## Read first
- games/sample-3d/src/config.ts: Juice, ItemMarker, ItemKind, ITEM_DEFS (color), TUNING.comboWindowS.
- games/sample-3d/src/juice.ts: the stub you replace.
- Facts from main.ts: juice.update(dt, camera, markers) is called every frame with real (not slowed) dt, after the camera has been placed for the frame. damageNumber is called for every hit (can be dozens per second). levelUp(level) is called at the start of a 1-second slow-motion moment, after which the level-up card screen opens. kill() is called for every mower destroyed.
- games/sample-3d/index.html: #ui is fixed, full screen, pointer-events none. Everything you add stays pointer-events none.

## Change
- games/sample-3d/src/juice.ts, createJuice(root). One injected <style> (prefix `jc-`), DOM built once inside a full-screen `jc-root`. Fonts `'Arial Black', Impact, system-ui, sans-serif`, heavy text-shadow. Animate in update() using dt where positions depend on the 3D world.
  - damageNumber(x, y, z, amount): a pool of 80 absolutely positioned divs (reuse the oldest when full). Text Math.round(amount). Font size 16px + 6 * log10(amount + 1); colour white below 30, #ffd54f below 100, #ff7043 below 500, else #ff1744 at 1.3x size. Random horizontal jitter ±0.4 world units. Lifetime 0.7 s: it rises 1.2 world units, scales from 1.4 to 1 in the first 0.1 s, fades out over the last 0.3 s. Each frame project the world point with `v.clone().project(camera)`; hide it when v.z > 1; else left = (v.x * 0.5 + 0.5) * innerWidth, top = (-v.y * 0.5 + 0.5) * innerHeight.
  - kill(x, z): combo += 1; comboTimer = TUNING.comboWindowS. Combo display at right 4vw, top 38vh: "x{combo}" (font size 40px + 18 * log2(combo), capped at 110px) over a small "COMBO" label, plus a thin bar under it showing comboTimer / comboWindowS. Colour by combo: < 10 white, < 25 #ffd54f, < 50 #ff9100, < 100 #e040fb, >= 100 an animated rainbow (hue rotates with time). On each kill restart a quick pop animation (scale 1.35 -> 1). Hidden while combo < 3. Milestones at 10, 25, 50, 100, 200, 500 show a shout centred at top 20vh for 1.2 s with a bounce-in: 10 "MOW-TASTIC!", 25 "LAWNSLAUGHTER!", 50 "UNMOWABLE!", 100 "GNOMESTRADAMUS!", 200 "TOUCH GRASS? NO. DESTROY GRASS.", 500 "PLEASE CONSIDER A BREAK.". When comboTimer runs out with combo >= 3, show "COMBO ENDED · x{combo}" small under the counter for 1 s; then combo = 0.
  - hurt(): a full-screen red vignette (box-shadow inset 0 0 160px 60px rgba(255,0,0,.55)) that fades over 0.45 s.
  - levelUp(level): the celebration, lasting ~1.2 s of real time:
    - A white full-screen flash fading over 0.15 s.
    - A spinning sunburst behind the text: a 140vmin square div with `background: repeating-conic-gradient(rgba(255,213,79,.35) 0 10deg, transparent 10deg 20deg)`, border-radius 50%, rotating 90 deg/s, scaling in from 0.
    - Centre text "LEVEL UP!" (96px, gold #ffd54f, white outline via text-shadow) with an overshooting scale bounce, and under it "LV {level}" (48px white).
    - 140 confetti pieces (small divs 8x14px, random colours from [#ff5252, #ffd54f, #69f0ae, #40c4ff, #e040fb, #ffffff]) bursting from the screen centre with random velocity 300..900 px/s in all directions, gravity 1400 px/s^2, random spin; faded out by 1.4 s. Simulate them in update(dt).
    - Then everything fades out. A new levelUp() while one is playing restarts it.
  - toast(title, sub, color): a stack at top 92px, centred: each toast shows title (30px, the given colour, glow text-shadow 0 0 16px color) and sub (16px white). Slides down and fades in over 0.2 s, holds, fades out by 2.6 s. At most 3 visible; the oldest is removed early.
  - shake(strength): trauma = min(1.5, trauma + strength). In update: first camera.position.sub(lastOffset); then offset = random unit vector * trauma^2 * 0.5; camera.position.add(offset); lastOffset = offset; trauma = max(0, trauma - 1.8 * dt).
  - Item arrows: for each marker (reuse pooled elements by index; hide unused ones), project (pos.x, pos.y + 2, pos.z). If it is on screen (|x| < 0.9, |y| < 0.85, z < 1), show a small floating icon above the item with its distance in metres (Math.round(dist / 4.7) + "m", dist = dist2D from camera.position). Otherwise show an arrow pinned to the screen edge (inset 40px), rotated to point toward the item, in the item colour (ITEM_DEFS[kind].color as a CSS hex string), with the icon and distance beside it. If z > 1 (behind the camera), negate the projected x and y before clamping. Icons: chicken "🍗", shopVac "🌀", weedKiller "☠️", espresso "☕", compostBin "🎁".
  - reset(): clear numbers, combo, shouts, confetti, toasts, arrows; set trauma and lastOffset to zero.

## Contract
`export function createJuice(root: HTMLElement): Juice` with exactly the methods of Juice.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in juice.ts.

## Out of scope
Every other file, including ui/hud.ts (another worker is rebuilding the HUD at the same time; keep your elements away from the top-left health panel, the top-right counters and the bottom XP bar).
~~~~

### 2.11 Rebuild the HUD with a bold health bar, a big XP bar and buffs

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Players could not tell their health or how close they were to the next level: the XP bar was a 10px strip and the hearts were small. Rebuild the HUD so health and XP are big, obvious, animated bars, and show active buffs.

## Read first
- games/sample-3d/src/config.ts: HudUI, HudData (note the new `buffs` field).
- games/sample-3d/src/ui/hud.ts: the current HUD you rework (keep its caching approach and the banner behaviour).
- games/sample-3d/index.html: #ui is fixed, full screen, pointer-events none. Keep the HUD pointer-events none.

## Change
- games/sample-3d/src/ui/hud.ts (same exports), reworked layout. Fonts `'Arial Black', Impact, system-ui, sans-serif`, white with heavy text-shadow:
  - Health panel, top-left (top 16px, left 16px): a heart icon "♥" (34px, #ff5252) beside a 320 x 28px rounded bar: dark background (rgba(0,0,0,.55)), 2px light border; red gradient fill (#ff8a80 -> #ff1744) at width hearts/maxHearts with `transition: width .25s`; behind it a pale yellow "damage ghost" bar that follows the fill late (transition: width .4s .35s), so a hit shows a shrinking chunk; thin dividers splitting the bar into maxHearts segments; centred text "{hearts} / {maxHearts}". When hearts <= 1, the panel pulses (heartbeat scale animation) and the border glows red.
  - Stamina under it: 320 x 10px, label "SPRINT" at the left (11px). Fill #ffd54f; when exhausted, #ff6b5a and blinking.
  - Buffs under stamina: one chip per entry of d.buffs: label (13px) and a small bar showing remaining01; rebuild chips only when the list of labels changes; update widths every frame.
  - XP bar across the bottom: left 90px, right 24px, bottom 20px, height 24px, rounded, dark background, 2px border. Fill: gradient #76ff03 -> #00e5ff with a moving shimmer highlight (an animated background-position on a light diagonal gradient overlay), width xp01 with transition .25s. Centred text "LV {level}  ▸  {level + 1}     {Math.floor(xp01*100)}%". On the left, a 64px gold circle badge (left 16px, bottom 8px) with the level number (30px, dark text). When level increases between update() calls: set the fill width to 0 with no transition (re-enable the transition on the next frame), flash the bar white for 0.3 s, and pop the badge (scale 1.5 -> 1).
  - Timer top centre (34px) with "RUN #{runNumber}" under it (13px), as now.
  - Top right: two chips "☠ {kills}" and "🌰 {acorns}" (22px), each doing a small scale pop when its value increases.
  - Boss bar: when boss is not null, top 76px, centred, 50vw wide, 18px tall, label "THE COMBINE" above it; red fill.
  - banner(): keep the current behaviour (top 26vh, gold title, white sub, fade in and out).
  - update(d): only touch the DOM when a displayed value changes.

## Contract
`export function createHud(root: HTMLElement): HudUI`, same methods.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in ui/hud.ts.

## Out of scope
Every other file, including juice.ts (another worker; it owns the combo counter at the right-middle of the screen, toasts under the timer, and floating numbers).
~~~~
