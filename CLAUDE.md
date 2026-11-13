# Working in this repo

Read [SOUL.md](SOUL.md) first. It sets the priorities: playable over polished, code over clicking, free assets only.

## Layout

- `games/<name>/`: one prototype per folder, each its own npm workspace (Vite + TypeScript + Phaser by default). `games/sample-dodge` is the reference example.
- `packages/`: shared code, only once two games need it.
- `tools/`: repo scripts, for example `tools/new-game.mjs`.
- `docs/stack.md`: which engine or library to reach for. `docs/assets.md`: where free assets come from and the license rules.
- `docs/roadmaps/`: plans written by the decompose skill.
- `docs/demos.md`: recording scripted MP4/GIF demos of a game for PRs (`npm run demo`).
- `unity/`: Unity projects, if any. Driven from code and the command line, never by hand in the editor (see docs/stack.md).

## Toolchain (Windows)

- Node.js LTS is at `C:\Program Files\nodejs`. In Git Bash, if `node` is not found: `export PATH="/c/Program Files/nodejs:$PATH"`.
- Install once from the repo root: `npm install` (workspaces share one `node_modules`).
- Run a game: `npm run dev -w games/<name>`. Type-check and build: `npm run build -w games/<name>`.
- New game from the sample: `npm run new -- <name>`.

## Rules

- `npm run build -w games/<name>` must pass before a change to that game is done.
- tsc does not catch runtime breakage (a module that hides the whole UI passed every type-check). With the dev server running, `bash tools/smoke.sh <url> <dom-marker>...` loads the page in headless Edge and reports console errors and missing elements. Run it at the end of every epic.
- UI modules get the shared `#ui` element as a parent: append your own container to it, never restyle or hide `#ui` itself.
- Do not edit a game other than the one you were asked to work on.
- Assets: CC0 or self-generated only. Every external file gets a line in that game's `CREDITS.md` (source URL, author, license).
- Do not run `git commit` unless asked.

## Delegating work

This user's plan is small, so default to delegation: plan with the decompose skill, then run each issue with the `haiku-worker` agent, issues of one epic in parallel. Do small fixes yourself only when writing the issue would cost more than the fix.
