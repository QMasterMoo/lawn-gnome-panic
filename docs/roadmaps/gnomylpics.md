# Gnomylpics (POC)

Goal: a gnome olympics party game in `games/gnomylpics`. Up to 4 players on one keyboard (two keys each), CPUs fill the
empty lanes, everyone competes at once in 4 horizontal lanes. Three events: 60m dash (alternate keys, same key twice =
stumble), triple jump, mower toss. Places give 5/3/2/1 points; most points after three events wins.

| Epic | Done when | Issues |
|---|---|---|
| 1. Foundation (written by the planner) | `npm run build -w games/gnomylpics` passes; title → three stub events → results → podium | 0 (written directly) |
| 2. Events | each event is playable with humans and CPUs; build passes; smoke test clean | 3 in parallel |

Epic 1 delivered: `src/config.ts` (all contracts and tuning), `src/meet.ts` (scoring, scene flow), `src/input.ts`
(`listenTaps`, `BothKeysDetector`), `src/runner.ts` (`AlternatingRunner`, `CpuTapper`), `src/lanes.ts` (lane drawing,
countdown, floating messages), `src/audio.ts`, Boot/Title/Results/Final scenes and a stub per event scene.

Epic 2 issues, one file each:

- [2.1 60m Gnome Dash](gnomylpics/2-1-dash.md): `src/scenes/DashScene.ts`
- [2.2 Triple Jump](gnomylpics/2-2-triple-jump.md): `src/scenes/TripleJumpScene.ts`
- [2.3 Mower Toss](gnomylpics/2-3-mower-toss.md): `src/scenes/MowerTossScene.ts`

Later (not in this POC): online play through `@lawn/mp`, touch controls, pulling other games in as events, a board-game
meta layer on top.
