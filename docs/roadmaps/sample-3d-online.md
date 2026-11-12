# Roadmap: sample-3d online battle royale with matchmaking

## Goal

- **ONLINE** mode in the lobby: press PLAY, get matched with up to 19 other people (or type a room code to play with friends), bots fill the empty slots.
- A small **matchmaking + relay server** (Node, `ws`) in one Docker image, hosted as cheaply as possible with rolling updates (Fly.io by default; any Docker or Kubernetes host works).
- The server does not simulate the game. One player's browser per match is the **host** and runs the world (mowers, bots, zone clock); everyone runs their own gnome and weapons and sends hits on mowers to the host. See `games/sample-3d/src/net/protocol.ts`.

## Shape

| Epic | Done when | Issues |
|---|---|---|
| 1. Foundation (planner, direct) | protocol.ts, interfaces in config.ts, stubs, net client, seeded zone, main.ts wiring, server workspace, Dockerfile, fly.toml, deploy workflow; tsc passes. | direct |
| 2. Online pieces | The four issues below are done; game and server build; server test passes; two browsers can play a match. | 4, parallel |

---

## Epic 2

Shared Environment text for every issue in this epic:

- Repository root: /home/user/lawn-gnome-panic (Linux, bash). Run commands from the root. Node 22 and npm are installed; `npm install` has already been run.
- Game: games/sample-3d, Vite + TypeScript (strict) + three 0.187.0 (`import * as THREE from 'three';`). No new dependencies.
- Conventions: Y up; ground height at (x, z) is `heightAt(x, z)` from games/sample-3d/src/terrain.ts. Forward for yaw a is (sin a, 0, cos a), so the yaw of a direction (vx, vz) is Math.atan2(vx, vz). dist2D = Math.hypot(dx, dz).
- games/sample-3d/src/config.ts, src/main.ts and src/net/protocol.ts are read-only. Exported names and signatures of your files are final (main.ts uses them).
- Three other workers are editing other files at the same time. Edit only the files your issue names.
- Check with `npx tsc --noEmit -p games/sample-3d`. Do not start a dev server. If tsc reports errors only in files you do not own, another worker is mid-edit: wait a minute and re-run; do not edit those files.
- Do not run `git commit`.

### 2.1 Matchmaking and relay server

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text above). This issue's check is the server's own build and test, not the game's tsc.

## Goal
A Node WebSocket server that matches players into rooms of up to 20 (public queue or private room code), picks a host, relays game messages between players of a room, and drains gracefully on SIGTERM so rolling updates do not cut matches short.

## Read first
- games/sample-3d/src/net/protocol.ts: every message type and constant. Import from it with `import { ... } from '../../src/net/protocol';`
- games/sample-3d/server/package.json and tsconfig.json: scripts (build bundles src/index.ts with esbuild to dist/server.mjs; test runs `node --test test/`). Do not edit them.

## Change
- games/sample-3d/server/src/matchmaker.ts (new): the logic, with no socket or timer code, so it is testable. Export exactly:
    export interface Conn { readonly id: number; send(msg: ServerMsg): void; close(): void }
    export interface MatchmakerOptions { publicWaitS: number; privateWaitS: number; now: () => number /* ms */; random: () => number }
    export class Matchmaker {
      constructor(opts: MatchmakerOptions);
      connect(conn: Conn): void;            // a socket opened
      handle(conn: Conn, msg: unknown): void; // one parsed JSON message from it
      disconnect(conn: Conn): void;         // the socket closed
      tick(): void;                         // called once a second
      drain(): void;                        // server is shutting down
      stats(): { players: number; queued: number; matches: number; draining: boolean };
    }
  Rules:
  - Validate every incoming message by hand (it is untrusted): it must be an object with a string `t`. Ignore anything malformed. Ignore everything except 'hello' until a valid hello arrived.
  - hello: if v !== PROTOCOL_VERSION, send { t: 'error', message: 'Your game is out of date. Refresh the page.' } and close(). Else store name (string; remove control characters with /[\u0000-\u001f\u007f]/g, trim, cut to 18 chars; empty -> `Gnome${id}`) and character (string, cut to 16 chars; not a string -> 'gnorman'), and send { t: 'welcome', id: conn.id }.
  - queue: update character from the message (same rule). If draining, send { t: 'error', message: 'The server is restarting for an update. Try again in a few seconds.' } and stop. code must be null or a string matching ROOM_CODE_RE, else send { t: 'error', message: 'Room codes are 4-8 letters or digits.' }. If the player is already queued or in a match, remove them from it first (same as leave). Groups are keyed by code ('' for public). Add the player to that key's waiting group (create it with firstAt = now()). If the group now has MAX_PLAYERS players, start it; otherwise send every member of the group { t: 'queued', code, players, startsInS } where startsInS = max(0, ceil(wait - (now() - firstAt) / 1000)) and wait = publicWaitS for public, privateWaitS for a code.
  - tick: every group whose wait has run out starts (even with a single player); every other group gets the 'queued' message again. Also delete matches older than 30 minutes, sending their members { t: 'ended', reason: 'This match ran for 30 minutes. That is enough lawn.' }.
  - Starting a group: matchId = 8 random hex characters from opts.random, seed = Math.floor(opts.random() * 4294967296), hostId = id of the first player who joined the group, players = PlayerInfo[] { id, name, character } in join order. Send each member { t: 'match', matchId, seed, hostId, you: theirId, players }. Remove the group.
  - relay: only from a player in a match. Validate: `to` is null or a number, `d` is an object. to null: send { t: 'relay', from: sender id, d } to every other member. to = id: send it only to that member if they are in the same match; else drop.
  - leave and disconnect: if queued, remove from the group (delete the group if empty; else send the remaining members a fresh 'queued'). If in a match: remove them; if they were the host send every remaining member { t: 'ended', reason: 'THE HOST LEFT (rude)' } and delete the match; else send remaining members { t: 'left', id }. Delete a match that has no members. disconnect also forgets the connection entirely.
  - drain: set draining; every queued player gets { t: 'ended', reason: 'The server is restarting for an update. Press PLAY again.' } and all groups are cleared. Running matches continue.
  - stats: players = connections that sent hello, queued = players in groups, matches = running matches.
- games/sample-3d/server/src/index.ts (replace the stub): the socket shell.
  - `import { createServer } from 'node:http'; import { WebSocketServer, WebSocket } from 'ws';`
  - PORT = Number(process.env.PORT) || 8787. Matchmaker options: publicWaitS = Number(process.env.MM_PUBLIC_WAIT_S) || PUBLIC_FILL_WAIT_S, privateWaitS = Number(process.env.MM_PRIVATE_WAIT_S) || PRIVATE_FILL_WAIT_S, now = Date.now, random = Math.random.
  - HTTP: GET /healthz -> 200, content-type application/json, body JSON.stringify(mm.stats()). GET / -> 200 text/plain 'Lawn Gnome Panic matchmaking. Connect a WebSocket to /ws.'. Anything else 404. Add header Access-Control-Allow-Origin: * on all responses.
  - `const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });` server.on('upgrade'): only path '/ws' (compare `new URL(req.url ?? '/', 'http://x').pathname`), else socket.destroy(). On connection: id from a counter starting at 1; conn.send = JSON.stringify and ws.send only if ws.readyState === WebSocket.OPEN; conn.close = ws.close(). ws.on('message', (data, isBinary)): ignore binary; JSON.parse in try/catch; mm.handle(conn, parsed). ws.on('close') -> mm.disconnect(conn). ws.on('error') -> ignore (close follows).
  - Keepalive: every 20 s ping every client; a client that did not answer the previous ping (track with an `alive` flag set on 'pong') is ws.terminate()d.
  - setInterval(() => mm.tick(), 1000).
  - On SIGTERM and SIGINT: log 'draining', mm.drain(), then every second check mm.stats().matches; when it is 0, close the server and process.exit(0). A second signal exits immediately.
  - Log one line on listen: `matchmaking on :${PORT}`.
- games/sample-3d/server/test/server.test.mjs (new): an integration test with `node:test` and `node:assert/strict`, using `import WebSocket from 'ws'` and `import { spawn } from 'node:child_process'`.
  - before: spawn `node games/sample-3d/server/dist/server.mjs` with cwd = the repo root (resolve it from import.meta.url: new URL('../../../../', import.meta.url)), env PORT=8799, MM_PUBLIC_WAIT_S=1, MM_PRIVATE_WAIT_S=1; wait until GET http://127.0.0.1:8799/healthz answers 200 (poll every 100 ms, give up after 5 s). after: kill it.
  - A helper that opens ws://127.0.0.1:8799/ws and collects parsed messages, with `next(t)` resolving with the next message of that type (time out after 4 s).
  - Test 1: /healthz returns JSON with numeric players.
  - Test 2: clients A and B send hello { t: 'hello', v: PROTOCOL_VERSION (write 1), name: 'A', character: 'gnorman' } and get welcome; both send queue { code: 'TEST1', character: 'gnancy' }; both get 'match' with the same matchId, hostId = A's id, players of length 2. B relays { t: 'relay', to: null, d: { k: 'died', cause: 'x' } }; A receives relay with from = B's id and d.k === 'died'. B closes; A gets { t: 'left', id: B's id }.
  - Test 3: hello with v: 999 gets an 'error' message.
  - Close all sockets at the end of each test.

## Contract
protocol.ts is the wire contract; do not change it. Exports of matchmaker.ts exactly as above.

## Done when
- `npm run build -w games/sample-3d/server` succeeds (it type-checks first).
- `npm test -w games/sample-3d/server` passes (it uses port 8799 only).
- No server process is left running afterwards.

## Out of scope
Everything under games/sample-3d/src, the server's package.json and tsconfig.json, Dockerfile, fly.toml.
~~~~

### 2.2 Puppet gnomes for other players and remote bots

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text above)

## Goal
Gnomes driven by the network (other players, and the host's bots as seen by other clients) appear in the yard with a name tag, move smoothly between network updates, walk while moving and fall over when dead.

## Read first
- games/sample-3d/src/config.ts: interfaces PuppetState, PuppetSystem (near the end of the file), GnomeModel, PlayerState, CHARACTERS, CharacterId.
- games/sample-3d/src/net/puppets.ts: the stub you replace. Keep its exported signature: `export function createPuppetSystem(scene: THREE.Scene): PuppetSystem`.
- games/sample-3d/src/gnome.ts: createGnomeModel(look) and createGnome(hatColor, shirtColor), and which PlayerState fields update() reads (position, facing, velocity, grounded, ...).
- games/sample-3d/src/br/bots.ts: `export function createNameTag(name: string): THREE.Sprite`, and HAT_COLORS / SHIRT_COLORS at the top (copy the two arrays into your file; do not import them, they are not exported). See how a bot places its tag (TAG_OFFSET_Y = 2.1 above the feet).

## Change
- games/sample-3d/src/net/puppets.ts: implement the system. Per key keep: the target state (last PuppetState), a GnomeModel, a name tag sprite, a PlayerState built with createPlayerState-like literal fields (position, velocity: new THREE.Vector3(), facing, grounded true, jumpsUsed 0, stamina 1, staminaDelay 0, sprinting false, exhausted false), and the last alive flag.
  - set(s): first sight of a key: model = s.character ? createGnomeModel(CHARACTERS[s.character].look) : createGnome(HAT_COLORS[h % HAT_COLORS.length], SHIRT_COLORS[(h >>> 4) % SHIRT_COLORS.length]) where h is a simple unsigned string hash of s.name (for example h = Math.imul(h ^ charCode, 16777619) >>> 0 over each char, starting at 2166136261). tag = createNameTag(s.name). scene.add both. Start the position exactly at (s.x, s.y, s.z) and facing at s.facing ?? 0. Later calls only replace the target.
  - update(dt): if dt <= 0 return. For each puppet: k = 1 - Math.exp(-12 * dt); remember the old position; ease position toward the target by k (if the target is more than 15 units away, jump straight to it); velocity = (new - old) / dt on x and z, y 0; grounded = position.y - heightAt(position.x, position.z) < 0.15. Facing: if target.facing !== null ease toward it, else if horizontal speed > 0.3 ease toward Math.atan2(velocity.x, velocity.z); ease angles along the shortest way: facing += Math.atan2(Math.sin(d - facing), Math.cos(d - facing)) * k. When alive changes call model.setDead(!alive). Then model.update(state, dt). Tag: position = feet + (0, 2.1, 0); visible only while alive.
  - living(prefix): the position vectors of puppets that are alive and whose key starts with prefix (return the live Vector3 objects, a new array each call).
  - keys(): all keys.
  - remove(key): scene.remove the model's object and the tag; dispose the tag's material map and material; traverse the model and dispose each mesh's geometry and material(s) (as setPlayerCharacter in src/main.ts does). Unknown key: do nothing.
  - reset(): remove every puppet.

## Contract
`export function createPuppetSystem(scene: THREE.Scene): PuppetSystem` with PuppetSystem exactly as in config.ts:
    set(s: PuppetState): void; remove(key: string): void; keys(): string[]; update(dt: number): void;
    living(prefix: string): THREE.Vector3[]; reset(): void;

## Done when
- `npx tsc --noEmit -p games/sample-3d` passes (or fails only in files other workers own).

## Out of scope
src/br/bots.ts, src/gnome.ts, src/main.ts, src/config.ts, src/mowers.ts, src/ui/lobby.ts.
~~~~

### 2.3 Mower puppet mode and kill attribution

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text above)

## Goal
The host can send every mower's state over the network, and other clients can show the host's mowers as puppets that move smoothly to each snapshot. Kills remember which online player landed the final hit.

## Read first
- games/sample-3d/src/config.ts: MowerSystem (the new methods snapshot, setPuppet, applySnapshot and the `by` parameter of damage), MowerKill (new optional `by`), EnemyView.
- games/sample-3d/src/net/protocol.ts: `MowerSnap = [id, tier, x, y, z, heading, hp, maxHp]` (tier is a MowerTier string).
- games/sample-3d/src/mowers.ts: the whole file; you edit only this one. The three methods at the bottom marked STUB are yours to replace.

## Change
- games/sample-3d/src/mowers.ts:
  - Kill attribution: damage(id, amount, by?) pushes `{ id, tier, x, z, by }` into pendingKills when the hit kills.
  - snapshot(): alive() mapped to [m.id, m.tier, r2(m.pos.x), r2(m.pos.y), r2(m.pos.z), r2(m.heading), r2(m.hp), r2(m.maxHp)] with r2 = (v) => Math.round(v * 100) / 100.
  - A `puppet` flag (default false). setPuppet(on) sets it. reset() sets it back to false (in addition to what it does now).
  - Give the Mower interface target fields tx, ty, tz, th (numbers; for non-puppets they are unused, set them to the spawn position/heading).
  - applySnapshot(list): if not puppet, return. For each entry: the living mower with that id gets tx/ty/tz/th, hp and maxHp from the entry. An id not alive locally is created at exactly that position and heading with that hp/maxHp, using the same model setup as spawn() (createMowerModel(tier), model.setNight(night01), rotation order 'YXZ', scene.add, radius from MOWER_TIERS[tier].radius); do not use or advance nextId for it. Skip entries whose tier is not a key of MOWER_TIERS. Every living mower whose id is not in the list starts dying: m.dyingS = 0.25 (no pendingKills entry).
  - update() in puppet mode: do none of steps 1-5 (no spawning, leash, steering, obstacles, separation) and report no kills. For each living mower: k = 1 - Math.exp(-12 * dt); old = pos copy; pos eases toward (tx, ty, tz) by k (if more than 20 units away, jump to it); heading eases toward th along the shortest way (heading += Math.atan2(Math.sin(th - heading), Math.cos(th - heading)) * k); pitch eases toward the ground pitch along the heading exactly as the existing ground-pitch code in step 3 computes it; speed = horizontal distance moved / dt (0 if dt is 0). Then the same visuals and mowing as step 6-7 (setFlash, position, rotation, model.animate(dt, speed), onMow, the combine's two extra onMow calls) and the same dying step 8. Move step 8 into a local function so both paths call it rather than copying it. Clear pendingKills and return [].
  - damage() in puppet mode: only the hit flash (m.flashS = 0.08); hp stays as the host says. slow() and spawnBoss() in puppet mode: do nothing.
  - Offline behaviour (puppet false) must stay exactly as it is now.

## Contract
MowerSystem exactly as in config.ts. In particular:
    damage(id: number, amount: number, by?: number): void;
    snapshot(): MowerSnap[];
    setPuppet(on: boolean): void;
    applySnapshot(list: readonly MowerSnap[]): void;

## Done when
- `npx tsc --noEmit -p games/sample-3d` passes (or fails only in files other workers own).

## Out of scope
Every file except src/mowers.ts.
~~~~

### 2.4 ONLINE mode in the lobby

~~~~text
Epic: 2
Depends on: none

## Environment
(the shared Epic 2 environment text above). UI modules receive the shared `#ui` element as a parent: append your own elements; never restyle or hide the parent. #ui is pointer-events none; only clickable elements set pointer-events auto.

## Goal
The lobby gets a third mode, ONLINE, next to SOLO and BATTLE ROYALE. In ONLINE the play button starts matchmaking (optionally with a private room code), and while searching the lobby shows the status line from the game with a CANCEL button.

## Read first
- games/sample-3d/src/config.ts: LobbyCallbacks (new onFindMatch(code), onLeaveMatch()) and LobbyUI (new setMatchStatus(text)). ROOM_CODE_RE in src/net/protocol.ts (4-8 of A-Z0-9).
- games/sample-3d/src/ui/lobby.ts: the whole file; you edit only this one. Look at MODE_OPTIONS and setMode, the play button (`play.onclick = () => cb.onPlay(mode, level)`), updatePlaySub, the Enter key handler, the injected <style> and its `lb-` class names, and the STUB setMatchStatus at the bottom.

## Change
- games/sample-3d/src/ui/lobby.ts:
  - Lobby modes: add a local `type LobbyMode = GameMode | 'online';` and use it for `mode`, MODE_OPTIONS, modeBtns and setMode. Add `{ mode: 'online', label: 'ONLINE', caption: 'up to 20 humans' }` as the third option. The solo level picker stays SOLO only.
  - Room code: a row shown only in ONLINE mode, placed with the level picker (inside `side`, above the mode row): a text input (class lb-code, placeholder 'ROOM CODE (optional)', maxLength 8, autocomplete off, spellcheck false, pointer-events auto). On input, upper-case it and strip anything not A-Z or 0-9. Keydown inside the input must call e.stopPropagation() so typing does not trigger game keys.
  - Play: in ONLINE mode the play button and the Enter key call `cb.onFindMatch(code.length > 0 ? code : null)` instead of cb.onPlay; if a code is typed but shorter than 4 characters, call showToast('Room codes are 4-8 letters or digits.') instead. Other modes unchanged.
  - updatePlaySub: ONLINE shows `RUN #${runCount + 1} · ONLINE ROYALE · ${code ? 'ROOM ' + code : 'PUBLIC MATCHMAKING'}`.
  - setMatchStatus(text): text !== null: show a status box near the play button (class lb-match: dark translucent pill, bold 15px text, a small pulsing dot) with the text and a CANCEL button (class lb-match-cancel, pointer-events auto) that calls cb.onLeaveMatch(); disable the play button and the mode buttons while searching, and ignore Enter. text === null: hide the box and re-enable everything. Calling it again with new text just updates the text. hide() also hides the box.
  - Style the new elements in the existing injected <style> with lb- prefixed classes, matching the existing look (same fonts and colours as the mode buttons). On phones (the existing @media rules for small widths) the code input and the status box must fit within the screen width.

## Contract
LobbyUI and LobbyCallbacks exactly as in config.ts; `createLobbyUI(root: HTMLElement, cb: LobbyCallbacks): LobbyUI` keeps its signature.

## Done when
- `npx tsc --noEmit -p games/sample-3d` passes (or fails only in files other workers own).

## Out of scope
Every file except src/ui/lobby.ts.
~~~~
