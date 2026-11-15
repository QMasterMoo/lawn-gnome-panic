# Gnomes of Gnomomia

An old-school, click-to-move 3D RPG with gnomes: Elder Scrolls rules (skills that grow when you use them, ten skill-ups to a level) with a RuneScape feel (click to walk, right-click menus, hitsplats, a 28-slot inventory).

The question it answers: is a small, quest-driven gnome RPG fun to click around in?

## Run

```
npm install
npm run dev -w games/gnomes-of-gnomomia   # http://localhost:5291
```

## Play

- **Left-click** the ground to walk; click an enemy to attack, an NPC to talk, a loot pile to take it.
- **Right-click** anything for its menu (Attack, Talk-to, Take, Examine, Walk here).
- **Arrow keys** or **middle-drag** turn the camera; the **wheel** zooms.
- **1-8** use the hotbar: Flare and Mend on 1-2, class abilities after your Calling in Thatchford (right-click a slot to assign).
- The side panel has tabs for the inventory, worn gear, stats, quests, spells and talents (key T).

Start by talking to Elder Fernwick by the well in Mossbottom.

## The world (Fescue)

Seven zones plus the three-wing Drainpipe Deeps, levels 1-30: Mossbottom Vale, Thatchford Downs, Birdbath Keep, Cloverfield, Hedgewood, the Rockery and the Verge. Eight story chapters end in the Battle of the Verge against the Mower; 14 side storylines change who stands with you there. The design lives in `docs/design/gnomomia/`.

## Rules (src/rules.ts, src/combat.ts, src/progression.ts)

The formulas are in `docs/design/gnomomia/combat.md`. In short: XP from kills and quests raises your level (cap 30); skills still grow by use but are capped at 5 + 4 × level; to-hit is a d20 against the target's level and defense; armor is percentage mitigation; damage types meet creature families (Crush cracks shells, Sun burns plants); three classes (Warden, Slinger, Hedge-Mage) each have 3 talent branches.

## Files

- `config.ts`: types and tuning only.
- `src/data/`: all content. `packs/*.ts` (one per chapter or storyline) and `zones/*.ts`, merged by `content.ts`; `data/README.md` lists the canonical ids and zone layouts.
- One system per file (`combat.ts`, `zones.ts`, `quests.ts`, `talents.ts`, `mower.ts`, ...); `main.ts` only wires them.

## Checking content

- `npm run lint:content -w games/gnomes-of-gnomomia` (or `node games/gnomes-of-gnomomia/scripts/lint-content.mjs [packId]`): ids nobody defines, broken dialogue links, quests nothing starts, NPCs or objects placed inside houses or lakes, exits that bounce you straight back.
- In `npm run dev`, `?zone=<id>` (e.g. `http://localhost:5291/?zone=verge`) skips the title and drops a fresh character into that zone without touching your save. `bash tools/smoke.sh "http://localhost:5291/?zone=verge" game ui` checks a zone builds without errors.
