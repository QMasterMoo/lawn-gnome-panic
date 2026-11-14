# Browser tests

`npm test` runs `games/<name>/tests/*.test.mjs` in headless Edge. No build, no dev server to start, nothing to download.

```
npm test                                   # every game that has a tests/ folder
npm test -- gnome-golf                     # one game
npm test -- --grep hole                    # tests whose name contains "hole"
npm test -- sample-dodge --url http://localhost:5173/   # reuse a dev server you already run
npm test -- --headed --bail                # watch it, stop at the first failure
```

Exit code 1 if any test fails. Failure screenshots land in `test-results/<game>/` (git-ignored).

## Writing a test

```js
// games/<name>/tests/<topic>.test.mjs
import { test } from '../../../tools/testkit.mjs';

test('a scripted shot comes to rest', async (t) => {
  await t.open('#hole=1&norender');                 // appended to the game's URL
  await t.waitFor(() => window.golf && window.golfDebug);
  await t.eval(() => golfDebug.takeShot(golf, { club: golf.club, power: 0.8, accuracy: 0, yaw: golf.aimYaw }));
  await t.waitFor(() => golf.phase !== 'flight', { timeout: 20000 });
});
```

What `t` gives you (see `tools/testkit.mjs`):

| | |
|---|---|
| `open(suffix)` | load the game, with an optional `#hash` / `?query` |
| `waitFor(fn, { timeout })` | poll a page-side function until truthy, returns its value |
| `eval(fn, ...args)` | run a function in the page, return its JSON-able result |
| `has(selector)` | does the DOM contain it |
| `press(code, holdMs)`, `click(selector or {x, y})` | input (`KeyboardEvent.code`: `Space`, `KeyW`, `ArrowLeft`) |
| `ok`, `equal`, `deepEqual` | `node:assert/strict` |
| `allowErrors(/regex/)` | ignore expected console errors |
| `page` | the raw puppeteer-core page, for anything else |

Any console error or uncaught exception fails the test, so a test that only opens the page is already a smoke test.

## Make games testable, cheaply

Tests are fast and reliable when they read state instead of pixels and skip what they do not need:

- **Expose a debug handle**: `window.<game> = state` in `main.ts`. Tests read and poke it with `t.eval`.
- **Add URL flags to jump to a moment**: `#hole=3`, `?autostart=solo`. That beats clicking through menus.
- **Add a no-draw flag**: gnome-golf's `#norender` skips the renderer. Software WebGL is the slowest part of a headless run.

A game with none of these (sample-dodge) can still have boot and no-error tests.

## Why it is cheap

- One Edge process for the whole run, using the browser that is already installed. Each test gets a fresh context, so localStorage and cookies do not leak between tests.
- Each game is served by Vite inside the runner process, with no file watcher and no HMR. A game's server starts only if one of its tests is selected, and stops before the next game starts.
- Tests run one at a time. The only extra output is a screenshot when a test fails.

`tools/smoke.sh` still works for a quick check of a page that is already running; new checks should be tests.
