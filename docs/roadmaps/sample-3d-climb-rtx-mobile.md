# Roadmap: climbing mowers, RTX rework, mobile controls

One epic, four parallel issues. Planner did directly: TouchControls and climb tuning in config.ts; main.ts contact check now uses the mower's y (`player.y < e.pos.y + height && player.y > e.pos.y - 0.6`); input.ts merges touch input; ui/touch.ts stub; touch controls shown only during play.

Shared Environment text for every issue (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming. Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0 (`import * as THREE from 'three';`; addons as `three/addons/...`). No new dependencies.
- Conventions: Y up, ground y = 0, lawn ±ARENA_HALF (250). Forward for yaw a = (sin a, 0, cos a). dist2D = Math.hypot(dx, dz). The gnome is ~1.4 units tall.
- src/config.ts and src/main.ts are read-only. Exported names and signatures are final.
- UI modules get the shared `#ui` element as a parent: append your own container; never restyle or hide the parent. #ui is pointer-events none.
- Four other workers are editing other files right now (one of them br/bots.ts). Edit only the files your issue names.
- Check with `npx tsc --noEmit -p games/sample-3d`. No vite build, no dev server. If tsc errors only in files you do not own, wait and re-run; do not edit them.

### C.1 Mowers crawl up and over obstacles

~~~~text
## Environment
(shared text)

## Goal
Standing on a stump must no longer make you safe: mowers crawl up the sides of low obstacles (pitched nose-up, comically, like a beetle on a wall), drive across the top, and tip back down. Tall things (statues, trees, flowers, birdbaths, buckets: height > TUNING.mowerClimbMaxHeight) still block them as now.

## Read first
- games/sample-3d/src/config.ts: TUNING.mowerClimbMaxHeight, TUNING.mowerClimbSpeed, TUNING.gravity, Obstacle, EnemyView (pos is read by others: pos.y must be the mower's base height), MOWER_TIERS (radius, height).
- games/sample-3d/src/mowers.ts: the obstacle push-out step, the visuals step (group.position.set(pos.x, 0, pos.z), group.rotation.y = heading), and the Mower interface.

## Change
- games/sample-3d/src/mowers.ts:
  - Mower gets `vy: number` and `pitch: number` (start 0). pos.y is now the mower's base height (0 on the lawn).
  - Obstacle step (still skipped entirely for the combine, which keeps plowing through at y = 0):
    - For an obstacle o with o.height > mowerClimbMaxHeight: push out as now.
    - For a climbable obstacle: do not push out. Instead compute support: if dist2D(pos, o) < o.radius (centre over the top), the surface under the mower is o.height. If dist2D < o.radius + radius but not over the top (touching the side) and pos.y < o.height - 0.05, the mower is climbing: pos.y = min(o.height, pos.y + mowerClimbSpeed * dt), vy = 0, and while climbing it only moves at 40% speed (scale the movement you applied this frame, or apply the speed factor before moving next frame; either is fine).
    - surface = the highest support among obstacles (0 for the lawn). If not climbing: if pos.y > surface + 0.01, fall: vy -= TUNING.gravity * dt; pos.y = max(surface, pos.y + vy * dt); else pos.y = surface, vy = 0.
  - Pitch (visual): target pitch = -1.2 (nose up) while climbing, +0.5 (nose down) while falling, 0 otherwise; pitch approaches it with factor 1 - exp(-10 * dt).
  - Visuals: set `group.rotation.order = 'YXZ'` once at spawn; each frame group.position.set(pos.x, pos.y, pos.z), rotation.y = heading, rotation.x = pitch. Keep rotation.z (the model's vibration) untouched.
  - The leash and spawn code: spawned mowers start at y 0; a leashed mower resets y and vy to 0.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowers.ts.

## Out of scope
Every other file (main.ts already uses e.pos.y for contact; br/bots.ts is another worker's).
~~~~

### C.2 Rework RTX ON into a glossy, oversaturated, silly-shadowed parody

~~~~text
## Environment
(shared text)

## Goal
RTX ON should not just be blinding bloom. Make it a loving parody of "RTX ON" screenshots: everything glossy and reflective, colours cranked, shadows comically stylised, puddle reflections everywhere, lens flares. Still playable.

## Read first
- games/sample-3d/src/config.ts: PostFX, VisualMode.
- games/sample-3d/src/postfx.ts: the current implementation (keep 'off' and 'crt' as they are; keep the RTX ON watermark; rework 'rtx').
- node_modules/three/examples/jsm/environments/RoomEnvironment.js and node_modules/three/src/extras/PMREMGenerator.js: how to make an environment map (`new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture`).

## Change
- games/sample-3d/src/postfx.ts, the 'rtx' mode:
  - Scene changes, applied when entering 'rtx' and undone when leaving it:
    - scene.environment = a PMREM texture of RoomEnvironment (create once, lazily).
    - Every MeshStandardMaterial in the scene (traverse; materials may be shared or arrays): remember the original roughness and metalness in a Map, then set roughness = original * 0.25 and metalness = min(1, original + 0.35), envMapIntensity = 1.6. On leaving 'rtx', restore from the Map. New objects created later (mowers, drops) will not be converted; re-run the conversion every 2 s while in 'rtx' for materials not yet in the Map.
    - renderer.toneMapping = THREE.ACESFilmicToneMapping, toneMappingExposure = 1.15 in 'rtx'; restore the previous values on leaving.
  - Composer: RenderPass; UnrealBloomPass with strength 0.9, radius 0.5, threshold 0.6 (much less than now); the RTX ShaderPass; OutputPass.
  - RTX shader (uniforms tDiffuse, resolution, time, sunUv vec2(0.78, 0.8)), in this order:
    1. Fake puddle reflections: for uv.y < 0.45 (the lower screen, mostly lawn), sample a mirrored uv (uv.x + 0.004 * sin(uv.y * 120.0 + time * 2.0), 0.9 - uv.y) and mix it in at 0.22 * smoothstep(0.45, 0.15, uv.y).
    2. Saturation x2.0 and a vibrance boost (push less-saturated colours more).
    3. Silly shadows: luma = dot(c, vec3(0.299, 0.587, 0.114)). Where luma < 0.32, tint toward electric purple vec3(0.42, 0.0, 1.0) (mix by smoothstep(0.32, 0.05, luma) * 0.55) and overlay a comic halftone dot pattern (dots on a 6 px grid, dot radius growing as luma falls; darken inside dots by 35%). Where luma > 0.75, tint highlights warm gold vec3(1.0, 0.85, 0.4) at 20%.
    4. Anamorphic streak: add a horizontal blur of only the bright parts (sample ±1..8 px * 3 in x, keep max(c - 0.75, 0)) at 0.5 strength, tinted cyan vec3(0.4, 0.8, 1.0).
    5. Lens flare: from sunUv toward the screen centre, 4 soft ghost circles at positions sunUv + (0.5 - sunUv) * k for k in {0.6, 1.1, 1.5, 1.9}, radii 0.03-0.08, colours magenta/cyan/gold/green at 0.15-0.25 alpha, plus a soft glow around sunUv.
    6. Subtle chromatic shimmer: offset r and b by 0.0015 * sin(time * 1.3).
  - Keep the watermark as is. 'off' and 'crt' behave exactly as before.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in postfx.ts.

## Out of scope
Every other file.
~~~~

### C.3 Build the touch controls: floating joystick, look drag, JUMP and SPRINT

~~~~text
## Environment
(shared text)

## Goal
Phones and tablets can play: a floating virtual joystick under the left thumb, drag on the right half to look around, and big JUMP and SPRINT buttons on the right, all multi-touch (Pointer Events, each pointer tracked by pointerId).

## Read first
- games/sample-3d/src/config.ts: TouchControls, InputState (conventions: moveY +1 = forward, moveX +1 = right, lookX + = turn view right, lookY + = raise camera), TUNING.cameraLookSensitivity.
- games/sample-3d/src/ui/touch.ts: the stub you replace.
- Facts: input.ts adds touch.read() into the frame's input every frame; main.ts calls setVisible(true) during play and false otherwise.

## Change
- games/sample-3d/src/ui/touch.ts, createTouchControls(parent): one injected <style> (prefix `tc-`), its own full-screen container appended to parent with `touch-action: none; user-select: none; -webkit-user-select: none`, pointer-events auto ONLY while visible and active (otherwise none, so desktop clicks and the lobby are unaffected).
  - active: becomes true on the first `pointerdown` with pointerType 'touch' anywhere on window (listen on window), or initially if matchMedia('(pointer: coarse)').matches. The controls render only when visible && active.
  - Left half (x < innerWidth * 0.5), excluding the buttons: a pointerdown starts the joystick at that point: draw a base circle (120px, rgba(255,255,255,.15), 2px white border) and a knob (56px, rgba(255,255,255,.6)) there; pointermove moves the knob, clamped to 60px from the base centre; move = (dx/60, -dy/60) clamped to length 1, with a 0.12 deadzone. Output moveX = move.x, moveY = move.y. Release resets to 0 and hides the joystick. Only the pointer that started it controls it.
  - Right half, excluding the buttons: a drag rotates the camera: accumulate (dx, dy) of that pointer since the last read() and output lookX = dx * cameraLookSensitivity * 1.6, lookY = dy * cameraLookSensitivity * 1.6.
  - Buttons on the right, bottom: JUMP (96px circle, bottom 90px, right 40px, gold #ffd54f, dark bold "JUMP") and SPRINT (76px circle, bottom 200px, right 70px, translucent white, "SPRINT"). JUMP pointerdown sets a jump edge (consumed by read()); SPRINT is held while its pointer is down. Pressed buttons scale 0.92 and brighten. Buttons call stopPropagation so they do not start a look drag.
  - Call preventDefault on pointer events you handle (prevents scrolling and zoom); set `touch-action: none` on the container and the buttons.
  - read(): returns the current values, then clears the jump edge and the accumulated look deltas.
  - setVisible(v): when false, also release all tracked pointers and reset move/sprint.
  - On screens narrower than 700px, scale the buttons to 85%.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in ui/touch.ts.

## Out of scope
Every other file, including input.ts and main.ts (already wired).
~~~~

### C.4 Make the lobby, HUD and overlays fit a phone screen

~~~~text
## Environment
(shared text)

## Goal
On a phone (portrait ~390x844 and landscape ~844x390), the lobby, HUD, royale HUD, level-up cards and results screen are readable and tappable, with nothing important off-screen. Desktop layout is unchanged.

## Read first
- games/sample-3d/src/ui/lobby.ts, ui/hud.ts, ui/royaleHud.ts, ui/levelup.ts, ui/results.ts: each injects one <style> block. Read the layout rules (positions, widths, font sizes).

## Change
Add CSS media queries at the end of each file's injected style (do not change the desktop rules or any logic, except where noted):
- ui/lobby.ts: `@media (max-width: 760px)`: the top nav tabs hidden (keep the logo and acorn pill); the character column becomes a horizontal scrolling strip at the top (top 64px, left 8px, right 8px, height auto, cards 140px wide in a row, the VISUAL MODE panel after them); the shop becomes a bottom sheet (left 8px, right 8px, bottom 150px, max-height 34vh, overflow-y auto); the party/mode block and the PLAY button sit at the bottom, full width minus 16px (PLAY 72px tall, 40px text); stats/tips hidden. `@media (max-height: 480px)` (phone landscape): hide the character column cards (keep VISUAL MODE), shop max-height 55vh on the right, PLAY 64px tall.
- ui/hud.ts: `@media (max-width: 760px)`: health bar 200px wide and 22px tall, stamina 200px, timer 24px, kills/acorns chips 16px, XP bar left 70px and height 18px, the level badge 48px. Also leave room at the bottom right for the touch buttons: the XP bar right 24px is fine (buttons are above it).
- ui/royaleHud.ts: `@media (max-width: 760px)`: remaining number 30px; kill feed font 12px, max width 60vw, top 150px; the zone warning 16px.
- ui/levelup.ts: `@media (max-width: 760px)`: cards in a vertical column (flex-direction column), each 88vw wide and auto height (min 120px) with the icon left of the text; heading 36px; the container scrolls (overflow-y auto) if needed.
- ui/results.ts: `@media (max-width: 760px)`: title 44px, rank 48px, everything fits with overflow-y auto on the root, the button full width.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in those five files.

## Out of scope
Every other file, including ui/touch.ts (another worker) and juice.ts.
~~~~
