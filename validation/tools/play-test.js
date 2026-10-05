#!/usr/bin/env node
"use strict";
/* iPhone play-test: the real game, played through with real touch taps.

   Serves the repo itself (a tiny built-in static server, nothing to start
   first), opens index.html in an emulated iPhone (touch-harness.js), and
   at each screen size plays full hands the way a player would: skip the
   tour, Check/Call, Award Pot, Next Hand, and NEW RUN after a bust. Any
   JavaScript error fails the run. On the first error it records the
   table's state and the last taps, so an intermittent bug (audit finding
   F1, docs/audit/PHASE0_BASELINE.md) arrives with its cause attached.

   Needs the `playwright` package and a Chromium (present in the Claude Code
   cloud environment; see validation/tools/README.md). Not part of
   `npm test`, which needs nothing but Node.

     npm run play-test
     node validation/tools/play-test.js --hands 3 --sizes 390x844 --shots /tmp/shots
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { withPage } = require('./touch-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const HANDS = Number(arg('hands', 2));
const SIZES = arg('sizes', '320x700,390x844,430x932').split(',').map(s => s.split('x').map(Number));
const SHOTS = arg('shots', null);
const HAND_TIMEOUT_MS = 90000;   // one hand with every animation is ~40s

const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.PNG':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Which key a player would press next, or null while the machine is busy.
function nextKey() {
  const vis = e => e && !e.classList.contains('hidden') && e.offsetParent !== null && !e.disabled;
  const skip = document.querySelector('.tour-skip');
  if (skip && skip.offsetParent) return '.tour-skip';
  const nextHand = document.getElementById('btn-next-hand');
  if (vis(nextHand)) return '#btn-next-hand';
  const flipped = document.getElementById('console-flip').classList.contains('flipped');
  const award = document.getElementById('btn-award-pot-console');
  if (flipped) return vis(award) ? '#btn-award-pot-console' : null;   // Award Pot, or NEW RUN after a bust
  const row = document.getElementById('actions-row');
  if (row && !row.classList.contains('disabled') && vis(document.getElementById('btn-checkcall'))) return '#btn-checkcall';
  return null;
}

function tableState() {
  const g = typeof game !== 'undefined' ? game : null;
  if (!g) return null;
  return { hand: g.handNumber, phase: g.phase, over: !!g.over, players: g.players.length,
    seats: g.players.map(p => (p.isHuman ? 'you' : p.name) + ':' + p.chips + (p.inHand ? '' : ' out') + (p.folded ? ' folded' : '')),
    dealer: g.dealerIndex, current: g.currentIndex, pot: g.pot,
    banner: (document.getElementById('banner') || {}).textContent };
}

async function playAt(base, width, height) {
  const r = { size: width + 'x' + height, hands: 0, busts: 0, taps: [], firstError: null };
  const errors = await withPage({ width, height }, async page => {
    page.on('pageerror', async e => {
      if (r.firstError) return;
      r.firstError = { message: e.message, stack: (e.stack || '').split('\n').slice(0, 6).map(s => s.trim()), lastTaps: r.taps.slice(-15) };
      try { r.firstError.state = await page.evaluate(tableState); } catch (_) {}
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, r.size + '-error.png') }).catch(() => {});
    });
    await page.goto(base + '/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(3500);
    await page.evaluate(() => startSinglePlayerRun());
    let lastProgress = Date.now();
    while (r.hands < HANDS) {
      const key = await page.evaluate(nextKey);
      if (key) {
        const label = key === '#btn-award-pot-console' ? await page.$eval(key, b => b.textContent.trim()) : key;
        r.taps.push(label);
        await page.tap(key, { timeout: 2000 }).catch(() => {});
        if (key === '#btn-next-hand') r.hands++;
        if (/new run/i.test(label)) { r.busts++; r.hands++; }
        lastProgress = Date.now();
      } else if (Date.now() - lastProgress > HAND_TIMEOUT_MS) {
        r.stuck = await page.evaluate(tableState);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, r.size + '-stuck.png') }).catch(() => {});
        break;
      }
      await page.waitForTimeout(250);
    }
    r.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, r.size + '-end.png') });
  });
  r.errors = errors;
  return r;
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  let ok = true;
  try {
    for (const [w, h] of SIZES) {
      const r = await playAt(base, w, h);
      const pass = !r.errors.length && !r.stuck && r.overflowX <= 0;
      ok = ok && pass;
      console.log((pass ? 'ok    ' : 'FAIL  ') + r.size + '  hands ' + r.hands + (r.busts ? ' (' + r.busts + ' bust)' : '') +
        '  errors ' + r.errors.length + '  sideways scroll ' + Math.max(0, r.overflowX) + 'px' + (r.stuck ? '  STUCK' : ''));
      if (r.stuck) console.log('      stuck at: ' + JSON.stringify(r.stuck));
      if (r.firstError) console.log('      first error: ' + JSON.stringify(r.firstError, null, 2).replace(/\n/g, '\n      '));
    }
  } finally { server.close(); }
  console.log(ok ? '\nPlay-test passed.' : '\nPlay-test FAILED.');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
