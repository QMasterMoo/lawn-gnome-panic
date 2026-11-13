# sample-3d: humans-only online, player names and colours

Goal: online matches are humans only (no bots) and need at least 2 players; every player picks a display name (saved locally, checked by a profanity filter on client and server) and gets a random per-match colour, shown on their gnome's hat, their name tag and the kill feed. Names and future chat text are always drawn on a dark chip with a dim outline in the player's colour so they stay readable.

## Foundation (done by the planner, before epic 1)

- `obscenity@0.4.6` (MIT) added to `games/sample-3d` and `games/sample-3d/server`.
- `src/net/textFilter.ts` (new): `tidyText`, `isClean`, `censorText` (for chat later), `checkName(raw): { ok: true; name } | { ok: false; reason }`, `NAME_MIN = 2`, `NAME_MAX = 18`, `CHAT_MAX = 120`.
- `src/net/protocol.ts`: `PROTOCOL_VERSION = 2`, `MIN_PLAYERS = 2`, `PLAYER_COLORS` (20 light colours), `PlayerInfo.color`, `queue` message carries `name`, `error` has optional `code: 'bad-name'`, snap feed entries have optional `color`.
- `src/config.ts`: `MetaSave.name`, `KillEvent.color?`, `PuppetState.color: number | null`, `LobbyCallbacks.onSetName(name)`, `NetClient.queue(code, character, name)`.
- `src/save.ts`: default name is a generated gamertag; a saved name is kept if it passes `checkName`.
- `src/net/client.ts`, server `tsconfig.json`, `Dockerfile`: follow the above.
- Stubs so the build passes: main.ts passes `color: null` to puppets and handles `onSetName`; matchmaker gives every player `color: 0xffffff`.

## Shape

| Epic | Done when | Issues |
|---|---|---|
| 1. Names, colours, humans-only | `npm run build -w games/sample-3d` and `npm test -w games/sample-3d/server` pass; smoke test clean | 4 (parallel) |

## Epic 1 issues

Issue texts are the prompts sent to the workers (see the conversation); summary:

- 1a server: `server/src/matchmaker.ts`, `server/test/server.test.mjs`: name check on queue, random unique colours, MIN_PLAYERS.
- 1b lobby: `src/ui/lobby.ts`: name field in ONLINE mode.
- 1c visuals: `src/ui/nameStyle.ts` (new), `src/br/bots.ts` (createNameTag colour), `src/net/puppets.ts`, `src/ui/royaleHud.ts`.
- 1d game: `src/main.ts`: no bots online, own hat colour, names, colours in feed, waiting status, bad-name handling.
