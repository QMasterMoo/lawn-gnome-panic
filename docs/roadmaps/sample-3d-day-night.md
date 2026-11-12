# Roadmap: day and night cycle

One epic, five parallel issues. Planner did directly: DayPhase/DayNightState/DayNight/HouseLights types and TUNING (dayLengthS 300, dayStartT 0.1, lobbyTimeT 0.04, nightXpMult 1.25) in config.ts; stubs for every new method; main.ts drives the clock during runs (frozen at golden hour in the lobby), applies the state every frame (fog and background colour, world.setLighting, scenery.setSky, houseLights.setNight, mowers.setNight), shows NIGHT FALLS / A NEW DAY DAWNS banners and gives +25% XP at night.

Shared Environment text for every issue (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming. Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0 (`import * as THREE from 'three';`). No new dependencies.
- Conventions: Y up, ground y = 0, lawn ±ARENA_HALF (250). Scene has Fog (main.ts sets its colour every frame) and a sky dome from scenery.ts. Gnome ~1.4 units tall.
- src/config.ts and src/main.ts are read-only. Keep exported names and signatures exactly.
- Four other workers are editing other files right now. Edit only the files your issue names.
- Check: `npx tsc --noEmit -p games/sample-3d`. No vite build, no dev server. If tsc errors only in files you do not own, wait and re-run; do not edit them.
- Performance matters (older phones play this): no new real-time lights except where stated; prefer emissive materials and additive transparent meshes for glows.

### N.1 Implement the day/night clock and palette

~~~~text
## Environment
(shared text)

## Goal
createDayNight() runs a clock through a full day and night and computes, for any time, the light direction, colours and intensities that the rest of the game applies.

## Read first
- games/sample-3d/src/config.ts: DayNight, DayNightState, DayPhase, TUNING.dayLengthS, TUNING.dayStartT, COLORS.sky.
- games/sample-3d/src/daynight.ts: the stub you replace (its fixed values are the current daytime look; full day must match them).

## Change
- games/sample-3d/src/daynight.ts, createDayNight():
  - One state object, mutated in place (the Color and Vector3 instances are reused; never allocate per frame). t starts at TUNING.dayStartT.
  - update(dt): t = (t + dt / TUNING.dayLengthS) % 1, then recompute; return the state. setTime(t): set and recompute. state(): return it.
  - recompute: s = sin(2π t) (sun height: +1 noon, -1 midnight).
    - night01 = 1 - smoothstep(-0.12, 0.1, s).
    - phase: s >= 0.25 'day'; s <= -0.15 'night'; else t < 0.25 || t > 0.75 ? 'dawn' : 'dusk'.
    - lightDir: sun = normalize(cos(2π t) * 0.8, s, 0.45). If s >= 0 use the sun; else use the moon = normalize(-cos(2π t) * 0.8, -s, -0.45) (opposite side, up at night). Keep its y at least 0.15 (normalise after clamping) so shadows never go flat.
    - Three palettes (hex colours):
      - DAY: lightColor 0xfff2d6, lightIntensity 2.8, hemiSky 0xffffff, hemiGround 0x446644, hemiIntensity 1.2, skyZenith 0x5aa9ff, skyHorizon 0xcfe9ff, fogColor COLORS.sky.
      - GOLDEN: lightColor 0xffa45c, lightIntensity 1.7, hemiSky 0xffd2a0, hemiGround 0x3a4a2a, hemiIntensity 0.8, skyZenith 0x4f6fb8, skyHorizon 0xffa070, fogColor 0xe8a27a.
      - NIGHT: lightColor 0x9fb4ff (moonlight), lightIntensity 0.45, hemiSky 0x2a3a70, hemiGround 0x0d1a12, hemiIntensity 0.35, skyZenith 0x070b22, skyHorizon 0x1b2550, fogColor 0x141c3a.
    - If s >= 0.05: k = smoothstep(0.05, 0.4, s), mix GOLDEN -> DAY by k. Else: k = smoothstep(0.05, -0.15, s), mix GOLDEN -> NIGHT by k. Mix colours with Color.lerpColors and numbers linearly.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in daynight.ts.

## Out of scope
Every other file.
~~~~

### N.2 Apply day/night lighting in the world

~~~~text
## Environment
(shared text)

## Goal
world.setLighting(s) drives the sun (which is the moon at night) and the hemisphere light from the day/night state, keeping the shadow camera following the player.

## Read first
- games/sample-3d/src/config.ts: World.setLighting, DayNightState.
- games/sample-3d/src/world.ts: the HemisphereLight, the `sun` DirectionalLight, update(dt, focus) which places the sun at focus + (40, 70, 25), and the placeholder `setLighting(_s: DayNightState) {}` in the returned object.

## Change
- games/sample-3d/src/world.ts:
  - Keep a reference to the HemisphereLight (it is currently created inline).
  - setLighting(s): sun.color.copy(s.lightColor); sun.intensity = s.lightIntensity; hemi.color.copy(s.hemiSky); hemi.groundColor.copy(s.hemiGround); hemi.intensity = s.hemiIntensity; store s.lightDir (copy into a module Vector3).
  - update(dt, focus): place the sun at focus + storedDir * 85 instead of the fixed (40, 70, 25) offset; target stays at the focus. Before setLighting has ever been called, use the old offset direction normalised.
  - Replace the placeholder; change nothing else.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in world.ts.

## Out of scope
Every other file.
~~~~

### N.3 Make the sky follow the time of day, with stars and a moon

~~~~text
## Environment
(shared text)

## Goal
scenery.setSky(s) recolours the sky dome, moves its sun glow, fades in a starfield and a moon at night, and dims the clouds.

## Read first
- games/sample-3d/src/config.ts: Scenery.setSky, DayNightState.
- games/sample-3d/src/scenery.ts: the sky dome ShaderMaterial (its uniforms or hard-coded colours and sun direction), the clouds, update(dt, focus) which centres the dome on the focus, and the placeholder `setSky(_s: DayNightState) {},`.

## Change
- games/sample-3d/src/scenery.ts:
  - Sky dome shader: make the zenith colour, horizon colour, sun direction and a night01 value uniforms (keep the existing look as their initial values). setSky copies s.skyZenith, s.skyHorizon, s.lightDir and s.night01 into them. At night (night01) scale the warm sun glow down to 0 and add a faint cool glow around lightDir (the moon side): colour vec3(0.6, 0.7, 1.0) * pow(dot, 200) * night01 (a small bright moon disc) plus 0.15 * pow(dot, 8) * night01 (halo).
  - Stars: 900 points on the upper hemisphere of a sphere of radius 1800 (random directions with y > 0.05), a PointsMaterial (size 3, sizeAttenuation false, white, transparent, depthWrite false, fog false) whose opacity = night01 * 0.9 (hidden entirely when night01 < 0.02). Add them to the same group or position as the dome so they follow the focus in x/z.
  - Clouds: lerp their material colour from white to 0x2a3350 by night01.
  - Replace the placeholder; keep everything else as it is.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in scenery.ts.

## Out of scope
Every other file.
~~~~

### N.4 Light up the giant house's windows at night

~~~~text
## Environment
(shared text)

## Goal
At night the giant house glows: windows lit warm (a few rooms dark, one flickering blue like a TV), a porch lamp by the door with a pool of light on the steps.

## Read first
- games/sample-3d/src/config.ts: HouseLights.
- games/sample-3d/src/house.ts: the window glass (InstancedMesh or meshes with a glass material), the front door and steps, and the placeholder `return { setNight(_night01: number) {} };` at the end of buildHouse.

## Change
- games/sample-3d/src/house.ts:
  - Window glass: at night it must glow. Give the glass a separate emissive material (or, if instanced, use per-instance colour plus an emissive material) and in setNight set emissive to 0xffc46b with emissiveIntensity = night01 * 1.4. Leave about 2 of the 9 windows dark (no glow) so it looks lived in. Make one upper window a "TV": its emissive colour alternates between 0x6fa8ff and 0x9fc8ff every 0.15-0.4 s (random), intensity night01 * 1.2; drive the flicker with a timer inside setNight (it is called every frame; use performance.now() for time).
  - Porch lamp: a small lantern (Box body 0x222222, emissive Sphere 0xffd27a) on the wall beside the door at about door height; its emissiveIntensity = night01 * 2. A pool of light on the steps: a CircleGeometry (radius 10) flat just above the top step, MeshBasicMaterial 0xffc46b, transparent, additive blending, depthWrite false, opacity = night01 * 0.35.
  - Replace the placeholder with the real setNight. No real-time lights.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in house.ts.

## Out of scope
Every other file.
~~~~

### N.5 Give the mowers headlights at night

~~~~text
## Environment
(shared text)

## Goal
At night every mower switches on headlights: two glowing lamps on its front and a soft additive light cone on the grass ahead, so players see them coming in the dark. The combine gets a row of big work lights.

## Read first
- games/sample-3d/src/config.ts: MowerModel.setNight, MowerSystem.setNight, MowerTier.
- games/sample-3d/src/mowerModels.ts: how each tier is built (facing +z, travel direction; front of the deck for powered mowers is around z +0.65, the reel mower's front around z +0.35, the combine's header around z +2.0 to +2.5), the per-model `mats` list, and the placeholder `setNight(_night01: number) {},`.
- games/sample-3d/src/mowers.ts: the Mower list, spawn(), and the placeholder `setNight(_night01: number) {},` in the returned object.

## Change
- games/sample-3d/src/mowerModels.ts, for every tier:
  - Two headlamps: small Spheres (r 0.07; combine r 0.25, four of them across the cab roof front) with their own MeshBasicMaterial 0xfff3c4 (not in `mats`, so the hit flash does not affect them), placed at the front, about 0.15 above the deck.
  - A light cone on the ground ahead: a flat triangle-ish shape (CircleGeometry(radius, 16, -0.35, 0.7) rotated flat, pointing along +z; radius 5, combine 12) at y 0.06, MeshBasicMaterial 0xfff0b0, transparent, additive blending, depthWrite false.
  - setNight(n): lamps visible when n > 0.05 (scale or opacity up with n); cone material opacity = n * 0.28, cone hidden when n < 0.02. Share geometries across models; the cone and lamp materials may be per model.
- games/sample-3d/src/mowers.ts: store the latest night01 (default 0); setNight(n) stores it and calls model.setNight(n) on every current mower; spawn() calls model.setNight(current value) on the new model.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowerModels.ts or mowers.ts.

## Out of scope
Every other file.
~~~~
