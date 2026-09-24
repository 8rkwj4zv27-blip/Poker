"use strict";
/* Reusable Playwright touch-emulation harness for manual/scripted QA of the
   real game in a browser, without a physical device. Used for the Career
   Hub touch-physics and buy-in-transition passes (2026-09-24); reuse this
   rather than re-deriving Playwright setup each time.

   Requires the `playwright` package (already present via `npm root -g` in
   this environment) and the pre-installed Chromium under /opt/pw-browsers
   (found automatically below) — do NOT run `playwright install`, see the
   top-level environment notes.

   Usage (see career-hub-scenario.js for a full worked example):

     const { withPage } = require('./touch-harness');
     await withPage({ width: 430, height: 932 }, async (page, touch) => {
       await page.goto('http://localhost:8765/index.html');
       await page.evaluate(() => localStorage.clear());
       await page.reload();
       await touch.start(100, 400);
       await touch.move(50, 400);
       await touch.end();
     });

   Run a local server first (from the repo root):
     python3 -m http.server 8765
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function findChromium() {
  const base = '/opt/pw-browsers';
  const dir = fs.readdirSync(base).find(d => d.startsWith('chromium-'));
  if (!dir) throw new Error('No pre-installed Chromium found under ' + base);
  return path.join(base, dir, 'chrome-linux', 'chrome');
}

/* Wraps a page with a touch-event helper (CDP Input.dispatchTouchEvent) and
   collects console/page errors into `page._errors`. Always emulates a real
   touchscreen device (hasTouch/isMobile) since the game's pointer handling
   branches on that. */
async function withPage(opts, fn) {
  const { width = 430, height = 932, reducedMotion = false } = opts || {};
  const browser = await chromium.launch({ executablePath: findChromium() });
  try {
    const ctx = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      serviceWorkers: 'block', // avoid a stale cached build shadowing local edits
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference'
    });
    const page = await ctx.newPage();
    page._errors = [];
    page.on('pageerror', e => page._errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') page._errors.push('console: ' + m.text()); });
    const cdp = await ctx.newCDPSession(page);
    const touch = {
      start: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }),
      move: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }),
      end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
      // A slow multi-step drag from (x0,y0) to (x1,y1) over `steps` frames.
      drag: async (x0, y0, x1, y1, steps = 12, gapMs = 14) => {
        await touch.start(x0, y0);
        for (let i = 1; i <= steps; i++) {
          await touch.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
          await page.waitForTimeout(gapMs);
        }
      },
      // A short, fast drag meant to register as a flick/throw.
      flick: async (x0, y0, x1, y1, steps = 5, gapMs = 6) => {
        await touch.start(x0, y0);
        for (let i = 1; i <= steps; i++) {
          await touch.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
          await page.waitForTimeout(gapMs);
        }
        await touch.end();
      }
    };
    await fn(page, touch);
    if (page._errors.length) console.error('Console/page errors:', page._errors);
    return page._errors;
  } finally {
    await browser.close();
  }
}

/* Snapshot a batch of screenshots into `outDir` with a shared prefix, e.g.
   snapshots(page, '/tmp/shots', 'buy-in', ['0300','0700',...], marksMs) —
   see career-hub-scenario.js for the timed-sequence pattern this supports. */
async function screenshotSeries(page, outDir, prefix, marksMs) {
  fs.mkdirSync(outDir, { recursive: true });
  let t = 0;
  for (const mark of marksMs) {
    await page.waitForTimeout(mark - t);
    t = mark;
    await page.screenshot({ path: path.join(outDir, `${prefix}-${String(mark).padStart(4, '0')}.png`) });
  }
}

module.exports = { withPage, screenshotSeries, findChromium };
