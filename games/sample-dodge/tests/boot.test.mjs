// Smoke-level checks for the reference game. sample-dodge exposes no debug handle, so these only
// look at the DOM and page errors; see games/gnome-golf/tests for state-driven tests.
import { test } from '../../../tools/testkit.mjs';

test('boots to a canvas without errors', async (t) => {
  await t.open();
  await t.waitFor(() => document.querySelector('#game canvas'));
});

test('space starts a run without errors', async (t) => {
  await t.open();
  await t.waitFor(() => document.querySelector('#game canvas'));
  await t.sleep(500); // boot -> title
  await t.press('Space');
  await t.press('ArrowLeft', 400); // move a little in the game scene
});
