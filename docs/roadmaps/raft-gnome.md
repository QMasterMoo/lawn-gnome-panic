# Roadmap: raft-gnome

Goal: a 3D Raft-like prototype. A gnome adrift on a little patch of floating grass fishes junk out of the sea, grows and mows grass to expand the raft, crafts a telescope to find islands, and sails to them for better mowers (scrap metal → push mower, fuel → gas mower, parts → riding mower).

| Epic | Done when | Issues |
|---|---|---|
| 1. Foundation (written directly) | `config.ts` (types, tuning, tables), `rules.ts` (pure rules), `input.ts`, `main.ts` loop, stubs for every system, copied `gnome.ts` / `mowerModels.ts`; game builds | 0 |
| 2. Systems | Ocean, raft tiles, player, mowing, fishing, building, navigation, HUD, audio all real; game builds and smoke test passes | 9 |
| 3+. Feature rounds | Extra features on top of v1, one file per worker | see below |

Epic 2 issues are in `docs/roadmaps/raft-gnome/epic2-*.md`, each one being `_common.md` (environment and world conventions) plus the issue body.
