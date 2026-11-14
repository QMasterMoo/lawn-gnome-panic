// Drives the round through the debug handles in src/main.ts (window.golf, window.golfDebug).
// '#norender' skips drawing, so these run fast even on the software renderer.
import { test } from '../../../tools/testkit.mjs';

test('title screen loads', async (t) => {
  await t.open('#norender');
  t.equal(await t.waitFor(() => window.golf?.phase), 'title');
});

test('#hole=3 starts on hole 3 with no strokes', async (t) => {
  await t.open('#hole=3&norender');
  await t.waitFor(() => window.golf);
  const s = await t.eval(() => ({ hole: golf.holeIndex, strokes: golf.strokes, phase: golf.phase }));
  t.equal(s.hole, 2);
  t.equal(s.strokes, 0);
  t.ok(['intro', 'aim'].includes(s.phase), 'phase was ' + s.phase);
});

test('a scripted shot flies and comes to rest', async (t) => {
  await t.open('#hole=1&norender');
  await t.waitFor(() => window.golf && window.golfDebug);
  const before = await t.eval(() => {
    golfDebug.takeShot(golf, { club: golf.club, power: 0.8, accuracy: 0, yaw: golf.aimYaw });
    return { x: golf.ball.x, z: golf.ball.z, phase: golf.phase, strokes: golf.strokes };
  });
  t.equal(before.phase, 'flight');
  t.equal(before.strokes, 1);
  await t.waitFor(() => golf.phase !== 'flight', { timeout: 20000 });
  const moved = await t.eval(([x, z]) => Math.hypot(golf.ball.x - x, golf.ball.z - z), [before.x, before.z]);
  t.ok(moved > 10, `ball moved ${moved.toFixed(1)} yards`);
});
