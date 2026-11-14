// The tiny API that game tests import. See docs/testing.md.
//
//   import { test } from '../../../tools/testkit.mjs';
//   test('title shows', async (t) => {
//     await t.open();                       // the game's index page (optional '#hash' or '?query')
//     await t.waitFor(() => window.golf?.phase === 'aim');
//     t.ok(await t.has('#hud'), 'hud rendered');
//   });
//
// Every test gets a fresh browser context (clean localStorage) in one shared headless Edge.
// A test fails on a thrown error, a failed assertion, or any page console error / uncaught exception
// (unless matched by t.allowErrors).
import assert from 'node:assert/strict';

/** Tests registered by the file currently being imported. The runner drains this after each import. */
export const registry = [];

/**
 * Register a test. `opts.timeout` in ms (default 30000). `opts.skip` skips it.
 * @param {string} name
 * @param {(t: TestContext) => Promise<void>} fn
 * @param {{ timeout?: number, skip?: boolean }} [opts]
 */
export function test(name, fn, opts = {}) {
  registry.push({ name, fn, timeout: opts.timeout ?? 30000, skip: !!opts.skip });
}

/** What a test function receives. Built by the runner for each test. */
export class TestContext {
  constructor(page, baseUrl) {
    /** The raw puppeteer-core Page, for anything the helpers do not cover. */
    this.page = page;
    this.baseUrl = baseUrl;
    this.errors = [];
    this.allowed = [/favicon\.ico/];
    page.on('pageerror', (e) => this.errors.push('uncaught: ' + (e?.message ?? e)));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const where = m.location()?.url;
      this.errors.push('console: ' + m.text() + (where && !m.text().includes(where) ? ` (${where})` : ''));
    });
  }

  /** Load the game page. `suffix` is appended to the base URL, e.g. '#hole=1&norender' or '?autostart=solo'. */
  async open(suffix = '') {
    await this.page.goto(this.baseUrl + suffix, { waitUntil: 'load' });
  }

  /** Run a function (or expression string) in the page and return its JSON-able result. */
  eval(fn, ...args) { return this.page.evaluate(fn, ...args); }

  /** Poll a page-side predicate until it returns truthy. Returns its value. */
  async waitFor(fn, { timeout = 10000, args = [] } = {}) {
    const h = await this.page.waitForFunction(fn, { timeout, polling: 100 }, ...args);
    const v = await h.jsonValue().catch(() => true);
    await h.dispose();
    return v;
  }

  /** True if a CSS selector matches something in the page. */
  async has(selector) { return (await this.page.$(selector)) !== null; }

  /** Tap a key (KeyboardEvent.code, e.g. 'Space', 'KeyW'), optionally holding it for `holdMs`. */
  async press(code, holdMs = 50) {
    await this.page.keyboard.down(code);
    await this.sleep(holdMs);
    await this.page.keyboard.up(code);
  }

  /** Click at page coordinates, or the centre of the first element matching a selector. */
  async click(target) {
    if (typeof target === 'string') return this.page.click(target);
    return this.page.mouse.click(target.x, target.y);
  }

  sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  /** Ignore page errors matching this regex (e.g. a known missing favicon or a server that is not running). */
  allowErrors(re) { this.allowed.push(re); }

  /** Errors seen so far that are not allowed. */
  unexpectedErrors() { return this.errors.filter((e) => !this.allowed.some((re) => re.test(e))); }

  // Assertions (node:assert/strict underneath).
  ok(v, msg) { assert.ok(v, msg); }
  equal(a, b, msg) { assert.equal(a, b, msg); }
  deepEqual(a, b, msg) { assert.deepEqual(a, b, msg); }
}
