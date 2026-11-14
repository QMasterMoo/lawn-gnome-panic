#!/usr/bin/env node
// Browser test runner for games/<name>/tests/*.test.mjs. See docs/testing.md.
//
// Usage: npm test [-- [game ...] [--grep text] [--url http://localhost:5174/] [--headed] [--bail]]
//   npm test                         every game that has tests
//   npm test -- gnome-golf           one game
//   npm test -- --grep hole          only tests whose name contains "hole"
//   npm test -- sample-dodge --url http://localhost:5173/   reuse a dev server you already run
//
// Kept cheap on purpose:
//   - one headless Edge for the whole run (the installed browser, nothing downloaded); one context per test
//   - each game is served by Vite in this process (no build, no file watcher, no HMR), started only if
//     that game has a selected test, and stopped before the next game starts
//   - tests run one at a time; a screenshot is written only when a test fails (test-results/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { registry, TestContext } from './testkit.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// ---- args
const argv = process.argv.slice(2);
const opt = { games: [], grep: null, url: null, headed: false, bail: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--grep') opt.grep = argv[++i];
  else if (a === '--url') opt.url = argv[++i];
  else if (a === '--headed') opt.headed = true;
  else if (a === '--bail') opt.bail = true;
  else opt.games.push(a.replace(/^games[\\/]/, '').replace(/[\\/]$/, ''));
}

// ---- collect tests (importing a file only registers tests; nothing runs yet)
const allGames = fs.readdirSync(path.join(root, 'games')).filter((g) => fs.existsSync(path.join(root, 'games', g, 'tests')));
const games = opt.games.length ? opt.games : allGames;
if (opt.url && games.length !== 1) { console.error('--url needs exactly one game'); process.exit(2); }

const plan = [];
for (const game of games) {
  const dir = path.join(root, 'games', game, 'tests');
  if (!fs.existsSync(dir)) { console.error(`no tests folder: games/${game}/tests`); process.exit(2); }
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort()) {
    registry.length = 0;
    await import(pathToFileURL(path.join(dir, f)).href);
    for (const t of registry) if (!opt.grep || t.name.includes(opt.grep)) plan.push({ game, file: f, ...t });
  }
}
if (!plan.length) { console.log('no tests matched'); process.exit(0); }

// ---- run
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: !opt.headed,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', '--no-first-run',
    '--disable-extensions', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 960, height: 600 },
});

const results = { pass: 0, fail: 0, skip: 0 };
const failures = [];
const started = Date.now();
try {
  for (const game of [...new Set(plan.map((p) => p.game))]) {
    const tests = plan.filter((p) => p.game === game);
    const server = opt.url ? null : await serve(game);
    const baseUrl = opt.url ?? server.url;
    console.log(`\n${game}  (${baseUrl})`);
    try {
      for (const t of tests) {
        if (t.skip) { results.skip++; console.log(`  -    ${t.name} (skipped)`); continue; }
        const r = await runOne(t, baseUrl);
        if (r.ok) { results.pass++; console.log(`  ok   ${t.name}  ${r.ms}ms`); }
        else {
          results.fail++;
          failures.push({ ...t, ...r });
          console.log(`  FAIL ${t.name}  ${r.ms}ms\n       ${r.error.split('\n').join('\n       ')}`);
          if (r.shot) console.log(`       screenshot: ${path.relative(root, r.shot)}`);
          if (opt.bail) break;
        }
      }
    } finally {
      await server?.close();
    }
    if (opt.bail && failures.length) break;
  }
} finally {
  await browser.close();
}

console.log(`\n${results.pass} passed, ${results.fail} failed, ${results.skip} skipped in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(results.fail ? 1 : 0);

// ---- helpers

async function runOne(t, baseUrl) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const tc = new TestContext(page, baseUrl);
  const t0 = Date.now();
  let error = null;
  let timer;
  try {
    await Promise.race([
      t.fn(tc),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`timed out after ${t.timeout}ms`)), t.timeout); }),
    ]);
    const errs = tc.unexpectedErrors();
    if (errs.length) error = 'page errors:\n' + errs.join('\n');
  } catch (e) {
    error = (e?.message ?? String(e)).split('\n').slice(0, 6).join('\n');
    const errs = tc.unexpectedErrors();
    if (errs.length) error += '\npage errors:\n' + errs.join('\n');
  } finally {
    clearTimeout(timer);
  }
  let shot = null;
  if (error) {
    const dir = path.join(root, 'test-results', t.game);
    fs.mkdirSync(dir, { recursive: true });
    shot = path.join(dir, t.name.replace(/[^\w-]+/g, '_') + '.png');
    await page.screenshot({ path: shot }).catch(() => { shot = null; });
  }
  await ctx.close();
  return { ok: !error, error, shot, ms: Date.now() - t0 };
}

/** Serve one game with Vite in-process: its own vite.config, any free port, no watcher, no HMR. */
async function serve(game) {
  const { createServer } = await import('vite');
  const gameRoot = path.join(root, 'games', game);
  const server = await createServer({
    root: gameRoot,
    configFile: fs.existsSync(path.join(gameRoot, 'vite.config.ts')) ? path.join(gameRoot, 'vite.config.ts') : false,
    logLevel: 'warn',
    clearScreen: false,
    server: { port: 0, strictPort: false, hmr: false, watch: null, open: false, forwardConsole: false },
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  return { url, close: () => server.close() };
}
