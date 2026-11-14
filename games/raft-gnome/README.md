# Raft Gnome

A gnome adrift on a little patch of floating grass. Fish junk out of the sea, grow and mow your lawn-boat to
expand it, and use a telescope to find islands with better mower tech.

Run: `npm run dev -w games/raft-gnome` (http://localhost:5182). Build: `npm run build -w games/raft-gnome`.

## Controls

| Key | Action |
|---|---|
| WASD / mouse | Move / look (click to capture the mouse) |
| Space | Jump (twice for a flip) |
| Shift / mouse wheel | Sprint / zoom |
| F | Bonk the lawn shark or a seagull |
| M | Music on/off |
| Left mouse | Hold to charge, release to throw the hook; hold again to reel in |
| E | Cut the grass tile under you by hand; open crates on islands |
| Q | Cycle owned mowers |
| B | Build mode (left click places; R cycles turf / seeded dirt / sprinkler / lawn flamingo) |
| Tab | Craft menu |
| T | Telescope (once crafted): aim at the horizon to spot islands |
| C | In the telescope: chart a course to the aimed island. Docked: cast off |

## Progression

Grass clumps → turf tiles → (after 3 tiles) dirt + seed → telescope → Scrapyard Isle (scrap: push mower) →
Fuel Depot Key (fuel: gas mower) → Mower Graveyard (parts: riding mower).

## Also in the game

- Day/night cycle with stars, moon and moonlight; mower headlights at night.
- Rain showers double grass growth (rain streaks, rain sound, thunder flashes).
- Sprinklers double growth around them; lawn flamingos are just pretty.
- Seagulls land and eat your tallest grass: walk at them or press F (they drop a seed).
- The lawn shark circles and chews edge tiles: get to the red ring and press F, or lose the tile.
- Messages in bottles reveal an island. Mowing sometimes turns up a grass seed.
- Minimap (top right) with island markers, a 12-step goal tracker and a victory screen.
- Generative sea-shanty music (minor key in the rain, quieter at night).
- Autosave to localStorage every 10 s; Continue or New raft on the title screen.
- Mowing stripes on fresh-cut tiles, daisies on fully grown ones, foam at the raft edges, grass puffs when running.

## Debug

- `http://localhost:5182/#selftest`: scripted playthrough; logs `SELFTEST OK` (check with `bash tools/smoke.sh "http://localhost:5182/#selftest" rg-selftest-ok`).
- `bash games/raft-gnome/snap.sh <scenario> out.png`: headless screenshot (scenarios: raft, island, mower, build, telescope, big, props, night, rain).
- `window.raft` in the console is the live game state.
