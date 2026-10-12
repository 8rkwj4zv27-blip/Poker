#!/usr/bin/env node
"use strict";
/* The Stage 1 invitation event, played for real in an emulated iPhone
   (docs/career/INVITATIONS_PLAN.md). Not part of `npm test` (it needs
   Playwright and Chromium, like the play-test).

   1. LIMIT: starts the Back Room invitation from the DEV key, plays every
      hand with real taps (check/call), reloads the page mid-event and
      continues from the DEV key, then checks the hand count, the HAND n/10
      readout, the final placing against the chips, and that the prize was
      credited exactly once (also after another reload).
   2. BUST: knocked out early (DEV BUST ME): settles at once, at a paid place.
   3. CLEAR: every opponent out early (DEV CLEAR TABLE): first place, $60.

     node validation/tools/invitation-scenario.js [--shots DIR]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { withPage } = require('./touch-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const SHOTS = arg('shots', null);
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.PNG':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const PAYOUTS = [60, 30, 15];

function serve(){
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type':TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// the key a player would press next (the play-test's rule), or null
function nextKey(){
  const vis = e => e && !e.classList.contains('hidden') && e.offsetParent !== null && !e.disabled;
  const skip = document.querySelector('.tour-skip');
  if (skip && skip.offsetParent) return '.tour-skip';
  const nextHand = document.getElementById('btn-next-hand');
  if (vis(nextHand)) return '#btn-next-hand';
  const flipped = document.getElementById('console-flip').classList.contains('flipped');
  const award = document.getElementById('btn-award-pot-console');
  if (flipped) return vis(award) && /award/i.test(award.textContent) ? '#btn-award-pot-console' : null;
  const row = document.getElementById('actions-row');
  if (row && !row.classList.contains('disabled') && vis(document.getElementById('btn-checkcall'))) return '#btn-checkcall';
  return null;
}
const readState = () => ({
  hand: game ? game.handNumber : null,
  phase: game ? game.phase : null,
  readout: (document.querySelector('#hand-limit .hand-limit-screen') || {}).textContent || null,
  active: career.active ? career.active.eventId : null,
  bankroll: career.bankroll,
  saved: (() => { try { return JSON.parse(localStorage.getItem('felt.career.table')); } catch (e) { return null; } })()
});

async function boot(page, base, fresh){
  await page.goto(base + '/index.html?dev');
  if (fresh){ await page.evaluate(() => localStorage.clear()); await page.reload(); }
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const s = document.querySelector('.tour-skip'); if (s) s.click(); });
}
// presses the real DEV key (start or continue)
async function devKey(page){
  await page.evaluate(() => { const p = document.getElementById('dev-panel'); if (p) p.classList.remove('collapsed'); });
  await page.waitForSelector('#dev-career-invite-play:not([disabled])', { timeout:5000 });
  await page.$eval('#dev-career-invite-play', b => b.scrollIntoView());
  await page.tap('#dev-career-invite-play');
  await page.waitForFunction(() => game && game.mode === 'career' && game.handNumber >= 1, null, { timeout:30000 });
  await page.evaluate(() => { const p = document.getElementById('dev-panel'); if (p) p.classList.add('collapsed'); });
}
// plays (tapping keys) until `done` holds in the page
async function playUntil(page, done, log, limitMs = 15 * 60000){
  const t0 = Date.now();
  while (!(await page.evaluate(done))){
    const s = await page.evaluate(readState);
    if (s.hand && s.phase !== 'setup' && s.active) log.push(s);
    const key = await page.evaluate(nextKey);
    if (key) await page.tap(key, { timeout:2000 }).catch(() => {});
    if (Date.now() - t0 > limitMs) throw new Error('timed out: ' + JSON.stringify(s));
    await page.waitForTimeout(200);
  }
}
const expectedPrize = (place, tie) => {
  let t = 0; for (let k = 0; k < tie; k++) t += PAYOUTS[place - 1 + k] || 0;
  return Math.floor(t / tie);
};

async function limitScenario(base){
  const out = {};
  out.errors = await withPage({ width:430, height:932 }, async page => {
    await boot(page, base, true);
    await devKey(page);
    const log = [];
    // play into hand 5, then reload with the table at its checkpoint
    await playUntil(page, () => !career.active || game.handNumber >= 5, log);
    const before = await page.evaluate(readState);
    if (before.active){
      out.reloadAt = { live: before.hand, saved: before.saved && before.saved.handNumber, savedEvent: before.saved && before.saved.event };
      await boot(page, base, false);
      out.afterReloadActive = await page.evaluate(() => career.active && JSON.parse(JSON.stringify(career.active.snapshot)));
      await devKey(page);
      out.resumedHand = await page.evaluate(() => game.handNumber);
      out.resumedEvent = await page.evaluate(() => ({ handLimit:game.event.handLimit, payouts:game.event.payouts, funding:game.event.funding }));
    }
    // play to the end, recording the table the moment it settles
    await playUntil(page, () => !career.active, log);
    out.final = await page.evaluate(() => ({
      hand: game.handNumber, bankroll: career.bankroll, result: career.lastResult,
      players: game.players.map(p => ({ you:p.isHuman, chips:p.chips, out:!!p.eliminated })),
      tableSave: localStorage.getItem('felt.career.table')
    }));
    out.readouts = [...new Set(log.map(s => s.hand + '=' + s.readout))];
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'invite-end.png') });
    await boot(page, base, false);
    out.afterFinalReload = await page.evaluate(() => ({ bankroll:career.bankroll, active:career.active }));
  });
  return out;
}

async function earlyScenario(base, devFn){
  const out = {};
  out.errors = await withPage({ width:390, height:844 }, async page => {
    await boot(page, base, true);
    await devKey(page);
    await page.waitForFunction(() => document.getElementById('actions-row') && !document.getElementById('actions-row').classList.contains('disabled'), null, { timeout:60000 }).catch(() => {});
    await page.evaluate(fn => window[fn](), devFn);
    await playUntil(page, () => !career.active, []);
    out.final = await page.evaluate(() => ({ hand:game.handNumber, bankroll:career.bankroll, result:career.lastResult }));
    await boot(page, base, false);
    out.afterReload = await page.evaluate(() => career.bankroll);
  });
  return out;
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive:true });
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const results = [];
  const report = (name, fn) => { try { fn(); results.push('ok    ' + name); } catch (e) { results.push('FAIL  ' + name + '\n      ' + e.message); } };
  try {
    const L = await limitScenario(base);
    console.log(JSON.stringify(L, null, 1));
    report('no JavaScript errors (limit run)', () => assert.deepStrictEqual(L.errors, []));
    report('reload: the checkpoint holds the completed hands; the same hand is dealt again', () => {
      assert.ok(L.reloadAt, 'the event ended before hand 5');
      assert.strictEqual(L.reloadAt.saved, L.reloadAt.live - 1);
      assert.strictEqual(L.resumedHand, L.reloadAt.live);
    });
    report('reload: the event keeps its terms', () => {
      assert.strictEqual(L.afterReloadActive.handLimit, 10);
      assert.deepStrictEqual(L.resumedEvent, { handLimit:10, payouts:PAYOUTS, funding:'house' });
    });
    report('the HAND readout shows the hand being played', () => {
      L.readouts.forEach(r => { const [h, text] = r.split('='); assert.strictEqual(text, h + '/10', r); });
    });
    report('never more than ten hands; ten when nobody was knocked out', () => {
      assert.ok(L.final.hand <= 10);
      const youOut = L.final.players.find(p => p.you).chips <= 0;
      const allOut = L.final.players.filter(p => !p.you).every(p => p.chips <= 0);
      if (!youOut && !allOut) assert.strictEqual(L.final.hand, 10);
    });
    report('the placing matches the chips, and the prize matches the placing', () => {
      const me = L.final.players.find(p => p.you);
      const r = L.final.result;
      if (me.chips > 0){
        const alive = L.final.players.filter(p => !p.you && p.chips > 0);
        assert.strictEqual(r.place, alive.filter(p => p.chips > me.chips).length + 1);
        assert.strictEqual(r.tie || 1, alive.filter(p => p.chips === me.chips).length + 1);
      }
      assert.strictEqual(r.prize, expectedPrize(r.place, r.tie || 1));
    });
    report('credited exactly once, and nothing more after a reload', () => {
      assert.strictEqual(L.final.bankroll, 500 + L.final.result.prize);
      assert.strictEqual(L.afterFinalReload.bankroll, L.final.bankroll);
      assert.strictEqual(L.afterFinalReload.active, null);
      assert.strictEqual(L.final.tableSave, null);
    });
    for (const [name, fn] of [['BUST', 'devBustMe'], ['CLEAR', 'devClearTable']]){
      const E = await earlyScenario(base, fn);
      console.log(name, JSON.stringify(E));
      report(name + ': no JavaScript errors', () => assert.deepStrictEqual(E.errors, []));
      report(name + ': settles early, paid once', () => {
        assert.ok(E.final.hand < 10);
        if (name === 'CLEAR') assert.deepStrictEqual([E.final.result.place, E.final.result.prize], [1, 60]);
        else assert.ok([2, 3].includes(E.final.result.place));
        assert.strictEqual(E.final.result.prize, expectedPrize(E.final.result.place, E.final.result.tie || 1));
        assert.strictEqual(E.final.bankroll, 500 + E.final.result.prize);
        assert.strictEqual(E.afterReload, E.final.bankroll);
      });
    }
  } finally { server.close(); }
  console.log('\n' + results.join('\n'));
  const ok = results.every(r => r.startsWith('ok'));
  console.log(ok ? '\nInvitation scenario passed.' : '\nInvitation scenario FAILED.');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
