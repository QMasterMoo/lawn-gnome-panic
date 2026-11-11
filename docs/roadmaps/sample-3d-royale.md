# Roadmap: sample-3d phase 4, battle royale with bots, and hosting

## Goal

- A **Battle Royale** mode with 19 bot gnomes with campy gamertags, a shrinking MOW ZONE, a kill feed, a gnomes-remaining counter, and a placement result, built on the seams a networked version would use (see docs/design/multiplayer-royale.md).
- Static **hosting**: a GitHub Pages workflow that builds every game into one site, plus a doc of free alternatives.
- (Done directly by the planner: acorns give XP; contracts in config.ts; main.ts wiring; stubs.)

## Shape

| Epic | Done when | Issues |
|---|---|---|
| 1. Foundation (planner, direct) | Royale types, tuning, stubs, main wiring, mowers multi-target signature; tsc passes. | direct |
| 2. Royale and hosting | Each piece below is done; the game builds; the site builds. | 6, parallel |

---

## Epic 2

Shared Environment text for every issue in this epic (pasted into each):

- Repository root: C:/Users/cstab/Documents/gaming (Git Bash /c/Users/cstab/Documents/gaming). Run commands from the root. If node/npm is not found: export PATH="/c/Program Files/nodejs:$PATH"
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0 (`import * as THREE from 'three';`). No new dependencies.
- Conventions: Y up, ground y = 0, lawn spans ±ARENA_HALF (250). Forward for yaw a is (sin a, 0, cos a); right is (-cos a, 0, sin a). dist2D = Math.hypot(dx, dz). Gnome scale: ~1.4 units tall.
- src/config.ts and src/main.ts are read-only. Exported names and signatures of your files are final (main.ts uses them).
- UI modules receive the shared `#ui` element as a parent: append your own container to it; never restyle or hide the parent. #ui is pointer-events none; only clickable elements set pointer-events auto.
- Five other workers are editing other files at the same time. Edit only the files your issue names.
- Check with `npx tsc --noEmit -p games/sample-3d`. Do not start a dev server. If tsc reports errors only in files you do not own, another worker is mid-edit: wait and re-run; do not edit those files.
- Tone: campy, deadpan, self-aware about being a battle royale.

### 2.1 Generate gamertags and build the battle royale HUD

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
Bots get Xbox-style auto-generated gamertags, and the battle royale gets its overlay: gnomes remaining, the zone timer, an "in the zone" warning, and a kill feed.

## Read first
- games/sample-3d/src/config.ts: RoyaleHud, RoyaleHudData, ZoneState, KillEvent.
- games/sample-3d/src/br/names.ts and src/ui/royaleHud.ts: the stubs you replace.
- games/sample-3d/src/ui/hud.ts: only to see where the main HUD sits (health panel top-left to ~150px, timer top centre, kills/acorns chips top right at ~18-80px, XP bar at the bottom). Do not edit it.

## Change
- src/br/names.ts, generateGamertags(count, rng): return `count` distinct names, each at most 18 characters, built from these parts with rng:
  - adjectives: Mulch, Turf, Lawn, Gnome, Sod, Hedge, Compost, Weed, Sprinkler, Grass, Acorn, Shrub, Topiary, Clover, Moss, Pebble, Trowel, Garden
  - nouns: Lord, Slayer, Sniper, Goblin, Wizard, Destroyer, Ninja, Gamer, Bandit, Overlord, Gremlin, Legend, Muncher, Whisperer, Viking, Goose, Boi
  - number: a year 1998-2012, or 2-3 random digits, or none
  - patterns (pick at random): `${Adj}${Noun}${num}`, `xX_${Adj}${Noun}_Xx`, `The${Adj}${Noun}`, `${Adj}_${Noun}${num}`, `x${Adj}${Noun}x`, `Pro${Adj}${Noun}`
  - plus these specials, each used at most once, with 25% chance per name: "Sir Mows-a-Lot", "LawnRanger", "TurfBurger", "GnomeChompsky", "Gnometallica", "HoeDown2009", "MowMentum", "Weedward", "Gnome Alone 2", "ShrubShrubShrub".
  - If a generated name is longer than 18 characters or already used, try again.
- src/ui/royaleHud.ts, createRoyaleHud(parent): one injected <style> (prefix `br-`), its own container appended to parent, display none until show(). Fonts 'Arial Black', Impact, system-ui; heavy text-shadow.
  - Remaining panel at top 96px, right 20px: a big number (44px) and "GNOMES LEFT" (12px) under it; when alive drops, pop the number (scale 1.4 -> 1).
  - Zone line under it (16px): phase 'waiting': "ZONE SHRINKS IN m:ss"; 'shrinking': "ZONE SHRINKING!" in #ff6b5a blinking; 'final': "FINAL CIRCLE".
  - Warning when playerOutside: centred at bottom 80px (above the XP bar): "YOU ARE IN THE MOW ZONE · GET TO THE CIRCLE" (26px, #ff5252, pulsing). Hidden otherwise.
  - Kill feed at left 16px, top 190px: newest at the bottom, at most 6 lines, each fades out 7 s after it appears. Line text: if cause is 'THE MOW ZONE': "☠ {victim} wandered into THE MOW ZONE"; else "☠ {victim} {verb} {cause}" with verb chosen at random from "got mowed by", "was mulched by", "became lawn clippings thanks to", "was tidied up by", "got trimmed by". Victim name in bold #ffd54f. Each line slides in from the left.
  - update(d): write only on change. hide() also clears the feed.

## Contract
- `export function generateGamertags(count: number, rng?: () => number): string[]`
- `export function createRoyaleHud(parent: HTMLElement): RoyaleHud`

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in br/names.ts or ui/royaleHud.ts.

## Out of scope
Every other file.
~~~~

### 2.2 Build the shrinking MOW ZONE

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The battle royale safe circle: it waits, then shrinks in stages toward a random final spot; outside it is THE MOW ZONE. It is drawn as a tall translucent striped wall plus a ground ring showing where the next circle will be.

## Read first
- games/sample-3d/src/config.ts: ZoneSystem, ZoneState, TUNING (zoneStartRadius, zoneFinalRadius, zoneFirstDelayS, zoneHoldS, zoneShrinkS, zoneShrinkFactor), ARENA_HALF.
- games/sample-3d/src/br/zone.ts: the stub you replace.

## Change
- src/br/zone.ts, createZone(scene):
  - State machine driven by elapsedS (main.ts calls update(dt, elapsedS) every frame of a royale run, from 0):
    - Start: centre (0, 0), radius zoneStartRadius, phase 'waiting', next shrink at zoneFirstDelayS.
    - At each shrink start: nextRadius = max(zoneFinalRadius, radius * zoneShrinkFactor); pick the next centre = current centre + random direction * random(0, radius - nextRadius), then clamp it so the next circle stays inside ±(ARENA_HALF - nextRadius). Phase 'shrinking' for zoneShrinkS: centre and radius lerp (smoothstep) from the old to the new values.
    - After a shrink: if radius <= zoneFinalRadius, phase 'final' forever; else phase 'waiting' for zoneHoldS, then shrink again.
    - secondsToNext: seconds until the current phase ends (0 in 'final'). nextRadius in 'waiting' is the radius the coming shrink will reach (compute and store the next target at the start of each wait so the ground ring can show it).
    - Use a seeded PRNG (mulberry32) whose seed is picked with Math.random in reset(), so a match is consistent within itself.
  - update returns the state; state() returns it; isOutside(x, z) = dist2D to the centre > radius.
  - Visuals (one Group added to the scene, hidden until setVisible(true)):
    - Wall: CylinderGeometry(1, 1, 1, 128, 1, true), scaled (radius, 60, radius), at y 30, centred on the zone. Material: MeshBasicMaterial with a CanvasTexture of diagonal stripes (alternating #ff6d00 at alpha 0.55 and transparent, 64x64, RepeatWrapping, repeat (radius / 4, 12) updated when the radius changes), transparent, side DoubleSide, depthWrite false, fog false. Scroll the texture offset slowly (offset.x += dt * 0.05).
    - Next-circle ring: RingGeometry(0.985, 1, 128) flat, scaled to nextRadius, centred on the next centre, at y 0.06, MeshBasicMaterial white opacity 0.6, transparent, fog false. Visible only in 'waiting'.
  - reset(): back to the start state with a new seed; keep visibility as set by setVisible.

## Contract
`export function createZone(scene: THREE.Scene): ZoneSystem` with update, state, isOutside, setVisible, reset.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in br/zone.ts.

## Out of scope
Every other file.
~~~~

### 2.3 Build the bot gnomes: AI, physics, combat and deaths

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
19 bot gnomes that look like the player but with their own hat and shirt colours and a floating name tag, move with the same physics as the player (by synthesising an InputState for updatePlayer), roam inside the zone, flee and hop over mowers, chip away at nearby mowers, take damage from mowers and the zone, and die with a kill-feed event.

## Read first
- games/sample-3d/src/config.ts: BotSystem, BotContext, Contestant, KillEvent, InputState, PlayerState, PlayerStats, BASE_STATS, EnemyView, MOWER_TIERS (height, contactDamage, name), ZoneSystem, TUNING (royaleSpawnRadius, botHearts, botAttackRange, botDpsStart, botDpsPer10s, zoneDamageEveryS, invulnS), PLAYER_RADIUS, ARENA_HALF.
- games/sample-3d/src/br/bots.ts: the stub you replace.
- games/sample-3d/src/player.ts: `createPlayerState(stats)` and `updatePlayer(p, input, cameraYaw, obstacles, stats, dt)`. Call these; do not edit player.ts.
- games/sample-3d/src/gnome.ts: `createGnome(hatColor?, shirtColor?)` returns a GnomeModel (object, update(p, dt), setDead(dead)). Call it; do not edit it.
- games/sample-3d/src/br/names.ts: `generateGamertags(count, rng?)` (another worker is implementing its body; call it).

## Change
- src/br/bots.ts, createBotSystem(scene):
  - Bot: { id, name, state: PlayerState, stats: PlayerStats (a copy of BASE_STATS), model: GnomeModel, tag: THREE.Sprite, hearts, invulnS, zoneTimer, alive, deadS, lastCause, waypoint {x, z}, rethinkS, jumpCooldown, attackTimer }.
  - spawn(count, center, avoid): names = generateGamertags(count). Each bot: random position within TUNING.royaleSpawnRadius of center, at least 15 from avoid, not inside any obstacle (+1 margin), within ±(ARENA_HALF - 5); random facing. Hat colour from [0xd93636, 0x8e24aa, 0x1e88e5, 0x43a047, 0xfb8c00, 0xfdd835, 0x00acc1, 0xec407a, 0x6d4c41, 0x212121] and shirt colour from a different list [0x2f64c9, 0xc62828, 0x2e7d32, 0x6a1b9a, 0xef6c00, 0x455a64, 0xad1457, 0x00838f], picked by index so neighbours differ. hearts = TUNING.botHearts.
  - Name tag: a Sprite with a CanvasTexture (256x48, rounded dark background rgba(0,0,0,.55), white bold 26px text), scale (2.6, 0.5, 1), at the bot's position + y 2.1; material depthWrite false. Hide tags farther than 45 units from the camera? (you have no camera; instead hide tags of bots farther than 60 from the nearest... just leave them visible; fog hides far ones). Add the model.object and the tag to the scene.
  - AI each frame for each alive bot, producing a desired world direction (dx, dz), sprint and jump flags:
    - Zone: z = ctx.zone.state(). If the bot is outside the zone or within 12 of its edge: desired = toward the zone centre, sprint = true.
    - Threat: else, the nearest enemy within 7: desired = away from it, blended 30% toward the zone centre; sprint = true. If that enemy is within 2.4, the bot is grounded, jumpCooldown <= 0 and Math.random() < 0.5: jump = true; jumpCooldown = 1.2.
    - Hunt: else, if an enemy is within 14: move to keep about 4.5 units from it (toward it if farther, sideways (perpendicular) if within 4.5).
    - Roam: else, walk toward waypoint; pick a new waypoint (a random point within 0.7 * zone radius of the zone centre) when within 3 of it or when rethinkS runs out (4-8 s).
    - Obstacles: if an obstacle centre lies within (o.radius + 1.5) of the point 2 units ahead along desired, rotate desired by +90 degrees.
    - Convert to InputState for cameraYaw = 0 (forward = +z, right = -x): normalise (dx, dz); moveY = dz; moveX = -dx. lookX = lookY = 0, start = false.
    - updatePlayer(bot.state, input, 0, ctx.obstacles, bot.stats, dt).
  - Combat: attackTimer -= dt; when <= 0, attackTimer = 0.25 and, if the nearest enemy is within TUNING.botAttackRange, ctx.damageEnemy(e.id, dps * 0.25) with dps = TUNING.botDpsStart + TUNING.botDpsPer10s * ctx.elapsedS / 10. Show a quick tracer: a pooled THREE.Line (2 points, LineBasicMaterial 0xffffff, opacity 0.7) from the bot (y 1.0) to the enemy (y 0.6), visible for 0.06 s.
  - Damage: invulnS -= dt. If invulnS <= 0 and some enemy has dist2D < PLAYER_RADIUS + e.radius and bot feet y < MOWER_TIERS[e.tier].height: hearts -= contactDamage; invulnS = TUNING.invulnS; lastCause = MOWER_TIERS[e.tier].name. Zone: if outside, zoneTimer -= dt; when <= 0: hearts -= 1, zoneTimer = TUNING.zoneDamageEveryS, lastCause = 'THE MOW ZONE'; when inside, zoneTimer = min(zoneTimer, 0.5).
  - Death: when hearts <= 0: alive = false, model.setDead(true), deadS = 3, push { victim: name, cause: lastCause } to the returned array. After deadS runs out remove the model and tag from the scene.
  - Each frame for every bot still in the scene: model.update(state, dt); while invulnerable, blink model.object.visible; tag.position follows the head.
  - contestants(): the bots as Contestant objects { id, name, pos: state.position, alive }.
  - aliveCount(), reset() (remove everything, clear the list).

## Contract
`export function createBotSystem(scene: THREE.Scene): BotSystem` with spawn, update, contestants, aliveCount, reset.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in br/bots.ts.

## Out of scope
Every other file, including player.ts, gnome.ts, br/names.ts (another worker) and mowers.ts.
~~~~

### 2.4 Make mowers hunt every gnome, not just the player

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
MowerSystem.update now receives a list of targets (targets[0] is the player, the rest are bot gnomes). Each mower steers at its nearest target; spawning, leashing and the boss work with the list.

## Read first
- games/sample-3d/src/config.ts: MowerSystem (note `targets: readonly THREE.Vector3[]`), TUNING (spawnRingMin, spawnRingMax, mowerLeashDist, bossSpawnDist), WAVES.
- games/sample-3d/src/mowers.ts: update() (it currently has a temporary line `const target = targets[0]; // TODO(2.4)...`), the spawn helper ringPoint, the leash, and spawnBoss with its lastTarget.

## Change
- games/sample-3d/src/mowers.ts:
  - Remove the temporary `const target = targets[0]` line.
  - Steering: each alive mower steers at its nearest target (dist2D). If targets is empty, mowers keep their heading.
  - Spawning: wave.maxAlive is multiplied by 2 when targets.length > 1. For each spawn: if targets.length === 1 or Math.random() < 0.5, spawn on the ring around targets[0]; else on the ring around a random other target (targets[1 + floor(random * (length - 1))]). Heading toward the target it spawned around.
  - Leash: a non-combine mower whose nearest target is farther than TUNING.mowerLeashDist is moved back to a ring point around targets[0] (the player), heading toward it.
  - Boss: lastTarget = targets[0] (the player) each update, as now.
  - Behaviour with a single target must stay exactly as before (solo mode).

## Contract
`createMowerSystem(scene): MowerSystem` with update(dt, elapsedS, targets, obstacles, onMow) as declared in config.ts.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in mowers.ts.

## Out of scope
Every other file, including mowerModels.ts.
~~~~

### 2.5 Add the game mode selector to the lobby and placement to the results screen

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)

## Goal
The lobby lets you pick SOLO or BATTLE ROYALE before pressing PLAY, and shows a (fake, coming soon) party panel that foreshadows multiplayer. The results screen shows your placement in battle royale.

## Read first
- games/sample-3d/src/config.ts: LobbyCallbacks (onPlay(mode: GameMode)), GameMode, RunSummary (killedByText, placement), TUNING.royaleBots.
- games/sample-3d/src/ui/lobby.ts: the PLAY button, its sub line "RUN #… · SOLO · BACKYARD", the Enter key handler, and the two temporary calls `cb.onPlay('solo')`.
- games/sample-3d/src/ui/results.ts: the death/victory titles and the "Killed by:" line.

## Change
- games/sample-3d/src/ui/lobby.ts:
  - Keep a `mode: GameMode` (default 'solo'). Just above the PLAY button add a two-button segmented control: "SOLO" and "BATTLE ROYALE", with a small caption under BATTLE ROYALE: `vs ${TUNING.royaleBots} bots`. The selected one is gold (#ffd54f, dark text), the other dark translucent. pointer-events auto.
  - The PLAY sub line becomes `RUN #${runs + 1} · SOLO · BACKYARD` or `RUN #${runs + 1} · BATTLE ROYALE · ${TUNING.royaleBots + 1} GNOMES`.
  - Replace both `cb.onPlay('solo')` calls with `cb.onPlay(mode)`.
  - A party panel just above the mode control (or beside it, whichever fits): "PARTY 1/4" heading, your slot "GNORMAN (you)" and three empty slots showing "+"; clicking an empty slot shows the existing toast with "Inviting friends: COMING SOON. For now, the bots are your friends."
- games/sample-3d/src/ui/results.ts:
  - If summary.killedByText is not null, the "Killed by:" line uses it instead of the MOWER_TIERS name.
  - If summary.placement is not null:
    - rank 1: the title is "#1 LAST GNOME STANDING" (gold, 64px) with the sub "Winner winner, chicken dinner. Legally distinct." (instead of the combine victory text).
    - otherwise (death): keep "YOU DIED" and add a big line `#${rank}` (72px, gold) with `of ${total}` beside it, above the stats.

## Contract
Signatures unchanged: createLobbyUI(root, cb): LobbyUI; createResultsUI(parent): ResultsUI.

## Done when
- `npx tsc --noEmit -p games/sample-3d` reports no errors in ui/lobby.ts or ui/results.ts.

## Out of scope
Every other file.
~~~~

### 2.6 Add GitHub Pages hosting and document the free alternatives

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text)
This issue does not touch games/*/src. The root package.json already has a script "site": "node tools/build-site.mjs"; do not edit package.json.

## Goal
One command builds every game into a static site with an index page, a GitHub Actions workflow deploys that site to GitHub Pages on every push to main, and a doc explains the setup and free alternatives.

## Read first
- package.json (root): workspaces "games/*", script "site".
- games/sample-dodge/package.json, games/sample-3d/package.json: each has a "build" script; vite.config.ts uses base './' so builds work from any sub-path.
- .gitignore: `site/` is already ignored.

## Change
- tools/build-site.mjs (Node ESM, no dependencies; node:fs, node:path, node:child_process, node:url):
  - Resolve the repo root from the script location. Remove and recreate `site/`.
  - For every directory in games/ that has a package.json with scripts.build: run `npm run build -w games/<name>` with execSync (stdio inherit, shell true so it works on Windows and Linux); copy games/<name>/dist recursively to site/<name>/.
  - Write site/index.html: a self-contained dark page titled "Gnome Testbed Arcade" with one card per game linking to `./<name>/`, showing the name and the "description" from its package.json if present (else the first paragraph of its README.md, else nothing). Add a `.nojekyll` file in site/.
  - Exit non-zero if any build fails.
- .github/workflows/pages.yml: on push to main and workflow_dispatch; permissions contents read, pages write, id-token write; concurrency group "pages". Job build: actions/checkout@v4, actions/setup-node@v4 (node-version 22, cache npm), `npm ci`, `npm run site`, actions/configure-pages@v5, actions/upload-pages-artifact@v3 with path site. Job deploy (needs build, environment github-pages with url from the deploy step): actions/deploy-pages@v4.
- docs/hosting.md: how to host the arcade, assuming no backend:
  - GitHub Pages (recommended): free for public repositories (Pages on a private repository needs a paid plan); steps: create the repo on GitHub, add it as `origin`, push main, then Settings → Pages → Source: GitHub Actions; the site appears at https://<user>.github.io/<repo>/ and each game at /<repo>/<game>/. Mention that the workflow is already in .github/workflows/pages.yml.
  - itch.io: free, built for games, good discoverability; zip `site/sample-3d` and upload as an HTML5 project, or use the `butler push` CLI.
  - Cloudflare Pages: free, unlimited bandwidth; `npx wrangler pages deploy site` or connect the GitHub repo.
  - Netlify: free tier; drag the `site` folder onto the dashboard, or connect the repo with build command `npm run site` and publish directory `site`.
  - A short note: the planned multiplayer (WebRTC peer-to-peer, see docs/design/multiplayer-royale.md) also works from static hosting; only a dedicated game server would need more.
  - A table comparing cost, setup effort, custom domain support and best use.

## Done when
- `npm run site` succeeds and creates site/index.html, site/sample-dodge/index.html and site/sample-3d/index.html. (If the sample-3d build fails with TypeScript errors in files you do not own, other workers are mid-edit: wait a minute and retry.)
- Then delete site/ (`rm -rf site`) so nothing is left behind.

## Out of scope
games/*/src, package.json, and every other file not named above.
~~~~
