#!/usr/bin/env node
"use strict";
/* The curated tray (owner, 13 Oct 2026), played with real touch in an
   emulated iPhone, in the game itself (index.html): REDEAL deals three of
   your cards onto the felt; a card let go half or more over the tray is
   kept there (and saved), less and it's on the felt; REDEAL takes back
   only the three it dealt; the tray survives a reload; a double tap
   clears the felt but not the tray; a card carried out of the album past
   the book's edge lands on the felt, and onto the tray; the album says
   when every card of an event is out; PLAYing a kept card takes it off
   the tray. Every step is checked against the save.

     node validation/tools/tray-scenario.js [--size 390x844]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { withPage } = require('./touch-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const [W, H] = arg('size', '390x844').split('x').map(Number);
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.PNG':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

function serve(){
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type':TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const steps = [];
  const step = (name, ok, detail) => { const l = (ok ? 'ok    ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''); steps.push(l); console.log(l); };
  let errors = [];
  try {
    errors = await withPage({ width:W, height:H }, async (page, touch) => {
      const hub = () => page.evaluate(() => CareerMain.state);
      const saved = () => page.evaluate(() => (career.tray || []).map(t => t.id));
      const until = async (fn, what, ms = 30000) => {
        const t = Date.now();
        while (Date.now() - t < ms){ if (await fn()) return; await page.waitForTimeout(80); }
        throw new Error('waiting for ' + what + ': ' + JSON.stringify(await hub().catch(() => null)));
      };
      const settle = () => until(async () => !(await hub()).busy, 'the hub settled');
      const centre = async sel => { const r = await page.locator(sel).first().boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
      const tap = async (x, y) => { await touch.start(x, y); await page.waitForTimeout(30); await touch.end(); await page.waitForTimeout(80); };
      const where = (k, i) => page.evaluate(([k, i]) => CareerMain.where(k, i), [k, i]);
      const tray = () => page.evaluate(() => { const r = document.querySelector('.cm-wood').getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; });
      const mid = async () => tap(...await centre('[data-key="play"]'));
      const label = () => page.evaluate(() => document.querySelector('[data-key="play"]').textContent.replace(/\n/g, ' '));
      const boot = async fresh => {
        await page.goto(base + '/index.html');
        if (fresh){
          await page.evaluate(() => { localStorage.clear(); localStorage.setItem('felt.settings', JSON.stringify({ seenIntro:true, seenTour:true })); });
          await page.reload();
          // eight cards of yours across the catalogue, no packets
          await page.waitForFunction(() => window.CareerLink, null, { timeout:30000 });
          await page.evaluate(() => {
            const ids = ['back-room-invite', 'full-house', 'closing-time', 'face-to-face', 'deep-pockets', 'sponsored-night', 'private-game', 'back-room-invite'];
            career.invitations = ids.map((ev, i) => ({ id:'inv-t' + i, eventId:ev, rarity:careerEventById(ev).rarity, roster:null, addedAt:i }));
            career.packets = []; career.starterGiven = true; saveCareer();
          });
          await page.reload();
        }
        await page.waitForFunction(() => window.CareerHub && !document.getElementById('home').classList.contains('hidden'), null, { timeout:30000 });
        await page.waitForTimeout(2500);
        await tap(...await centre('#open-career'));
        await page.waitForFunction(() => window.CareerMain && CareerMain.ready && !CareerMain.state.busy && CareerHub.open && !CareerHub.screen.inert, null, { timeout:30000 });
        await page.waitForTimeout(400);
      };

      await boot(true);
      let h = await hub();
      step('a fresh hub: the tray empty, nothing dealt, REDEAL', h.tray.length === 0 && h.cards === 0 && (await label()) === 'REDEAL', JSON.stringify(h.tray));

      // REDEAL: three of yours onto the felt under the tray
      await mid(); await settle();
      h = await hub();
      step('REDEAL deals three of yours onto the felt, not the tray', h.dealt.length === 3 && h.tray.length === 0, h.dealt.join(' '));
      const firstDeal = h.dealt.slice();

      // one carried up and let go over the middle of the tray: kept, and saved
      let w = await where('dealt', 0), t = await tray();
      await touch.drag(w.x, w.y, t.x + t.w * .5, t.y + t.h * .5, 14, 16); await page.waitForTimeout(100); await touch.end();
      await page.waitForTimeout(500); await settle();
      h = await hub();
      step('let go over the tray: kept there, and saved', h.tray.length === 1 && (await saved()).length === 1 && h.dealt.length === 2, h.tray.join() + ' / ' + (await saved()).join());
      const kept = h.tray[0];

      // just under half over the tray: it stays on the felt
      w = await where('dealt', 0); t = await tray();
      const ch = await page.evaluate(() => 120 * CareerMain.scale);
      await touch.drag(w.x, w.y, t.x + t.w * .3, t.y + t.h + ch * .5 - t.h * .35, 14, 16); await page.waitForTimeout(100); await touch.end();
      await page.waitForTimeout(500); await settle();
      h = await hub();
      step('less than half over the tray: it stays on the felt', h.tray.length === 1 && h.cards === 2, h.tray.length + ' kept, ' + h.cards + ' loose');

      // REDEAL again: only the one it dealt and nobody touched goes back
      await mid(); await settle();
      h = await hub();
      const redealOk = h.dealt.length === 3 && h.cards === 4 && h.tray.length === 1 && !h.dealt.includes(kept) && !h.dealt.some(id => h.tray.includes(id));
      step('REDEAL takes back only its untouched card, deals three new, never a kept one', redealOk, h.dealt.join(' ') + ' (was ' + firstDeal.join(' ') + ')');

      // a second card onto the right of the tray, then a reload
      w = await where('dealt', 0); t = await tray();
      await touch.drag(w.x, w.y, t.x + t.w * .85, t.y + t.h * .5, 14, 16); await page.waitForTimeout(100); await touch.end();
      await page.waitForTimeout(500); await settle();
      const before = await saved();
      await boot(false);
      h = await hub();
      step('the tray comes back after a reload; the felt starts clean', before.length === 2 && JSON.stringify(h.tray.slice().sort()) === JSON.stringify(before.slice().sort()) && h.cards === 0,
        before.join() + ' -> ' + h.tray.join());

      // REDEAL, then a double tap on empty felt: the felt cleared, the tray kept
      await mid(); await settle();
      t = await tray();
      const ex = t.x + t.w * .5, ey = H * .78;
      await tap(ex, ey); await page.waitForTimeout(60); await tap(ex, ey);
      await page.waitForTimeout(900); await settle();
      h = await hub();
      step('a double tap clears the felt and keeps the tray', h.cards === 0 && h.tray.length === 2, h.cards + ' loose, ' + h.tray.length + ' kept');

      // a kept card dragged off the tray onto the felt: off the tray, out of the save
      w = await where('tray', 0);
      await touch.drag(w.x, w.y, w.x, H * .7, 14, 16); await page.waitForTimeout(100); await touch.end();
      await page.waitForTimeout(500); await settle();
      h = await hub();
      step('dragged off the tray: on the felt, out of the save', h.tray.length === 1 && h.cards === 1 && (await saved()).length === 1, h.tray.join());

      // the album: a card carried out past the book's edge lands on the felt, then onto the tray
      await tap(...await centre('[data-key="cards"]'));
      await page.waitForFunction(() => CareerAlbum.out && CareerAlbum.state.mode !== 'moving', null, { timeout:15000 });
      await page.waitForTimeout(900);
      if (await page.evaluate(() => CareerAlbum.state.mode === 'closed')){
        await tap(...await centre('.cb-cover')); await page.waitForTimeout(900);
      }
      const free = await page.evaluate(() => { const s = [...document.querySelectorAll('.cb-page:not([hidden]) .cb-slot.is-have:not(.is-table)')][0]; if (!s) return null; const r = s.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      const loose0 = (await hub()).cards;
      t = await tray();
      if (free){
        await touch.start(free[0], free[1]); await page.waitForTimeout(700);
        // out past the book's edge (down below it), then up onto the tray
        const book = await page.evaluate(() => { const r = document.querySelector('.cb-book').getBoundingClientRect(); return { b:r.bottom, x:r.x + r.width / 2 }; });
        for (let k = 1; k <= 12; k++){ await touch.move(free[0], free[1] + (book.b + 70 - free[1]) * k / 12); await page.waitForTimeout(16); }
        await page.waitForTimeout(700);
        const out = await page.evaluate(() => !CareerAlbum.out || CareerAlbum.state.mode === 'moving');
        const loose1 = (await hub()).cards;
        for (let k = 1; k <= 12; k++){ await touch.move(free[0] + (t.x + t.w * .2 - free[0]) * k / 12, (book.b + 70) + (t.y + t.h * .5 - book.b - 70) * k / 12); await page.waitForTimeout(16); }
        await page.waitForTimeout(100); await touch.end();
        await page.waitForTimeout(900); await settle();
        h = await hub();
        step('a card carried out of the album past the book: onto the felt, the book away', out && loose1 === loose0 + 1, loose0 + ' -> ' + loose1);
        step('... and let go over the tray: kept there', h.tray.length === 2 && (await saved()).length === 2, h.tray.join());
      } else step('a card in the album to carry out', false, 'none found');

      // the album says when every card of an event is out on the table
      await tap(...await centre('[data-key="cards"]'));
      await page.waitForFunction(() => CareerAlbum.out && CareerAlbum.state.mode !== 'moving', null, { timeout:15000 });
      await page.waitForTimeout(900);
      const marked = await page.evaluate(() => document.querySelectorAll('.cb-slot.is-table').length);
      step('the album marks events with every card out on the table', marked >= 1, marked + ' marked');
      await tap(...await centre('[data-key="cards"]'));
      await page.waitForFunction(() => !CareerAlbum.out, null, { timeout:15000 });
      await settle();

      // a kept card fed and PLAYed: used up, and off the tray in the save
      const playId = (await hub()).tray[0];
      w = await where('tray', 0);
      const [fx, fy] = await centre('.cm-mouth');
      await touch.drag(w.x, w.y, fx, fy + 20, 14, 16); await page.waitForTimeout(150); await touch.end();
      await until(async () => (await hub()).fed && !(await hub()).busy, 'a card in the feeder');
      await until(async () => (await label()) === 'PLAY', 'PLAY');
      await mid();
      await until(async () => page.evaluate(() => !!career.active), 'the event started');
      const after = await saved();
      step('a kept card PLAYed: used up, and off the tray', !after.includes(playId) && after.length === 1 && !(await page.evaluate(id => careerInvitations().some(c => c.id === id), playId)), after.join());
    });
  } catch (e){ step('stopped: ' + e.message.split('\n')[0], false); }
  finally { server.close(); }
  const errs = errors.filter(e => !/vibrate|favicon|status of 404/.test(e));
  step('no JavaScript errors', !errs.length, errs.join(' · '));
  const failed = steps.filter(l => l.startsWith('FAIL')).length;
  console.log(failed ? '\nTray scenario FAILED.' : '\nTray scenario passed.');
  process.exit(failed ? 1 : 0);
})();
