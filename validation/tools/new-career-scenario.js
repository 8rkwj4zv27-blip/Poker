#!/usr/bin/env node
"use strict";
/* The new Career, the whole loop, played with real touch in an emulated
   iPhone, in the game itself (index.html; docs/career/INVITATIONS_PLAN.md,
   Stage 5). Not part of `npm test` (needs Playwright and Chromium).

   A classic Career save is planted first and must come out untouched.
   The menu's Career key opens the hub on a fresh new Career: the starter packet on the felt → torn open → its four
   cards turned and added → REDEAL deals three of yours → one dragged into
   the feeder and PLAYed → the real table (knocked out with DEV BUST ME, to
   keep it short; the full ten hands are invitation-scenario.js's job) →
   BACK TO THE HUB → the prize counted in → the shop: a House Packet bought
   with the bankroll → a reload: everything where it was → the album shows
   what you hold → broke and cardless: one pity packet, not two (a second
   visit, a reload) → the hub's back key: the menu again → the classic
   Career save as it was. Every step is checked against the save itself.

     node validation/tools/new-career-scenario.js [--sizes 390x844,375x667] [--shots DIR]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { withPage } = require('./touch-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const SIZES = arg('sizes', '390x844,375x667,430x932').split(',').map(s => s.split('x').map(Number));
const SHOTS = arg('shots', null);
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
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// the key a player would press next at the table (the play-test's rule)
function nextKey(){
  const vis = e => e && !e.classList.contains('hidden') && e.offsetParent !== null && !e.disabled;
  const nextHand = document.getElementById('btn-next-hand');
  if (vis(nextHand)) return '#btn-next-hand';
  const award = document.getElementById('btn-award-pot-console');
  if (vis(award) && !/hub|new run|events/i.test(award.textContent)) return '#btn-award-pot-console';
  const row = document.getElementById('actions-row');
  if (row && !row.classList.contains('disabled') && vis(document.getElementById('btn-checkcall'))) return '#btn-checkcall';
  return null;
}

async function run(base, width, height, reducedMotion){
  const steps = [];
  const step = (name, ok, detail) => { const l = (ok ? 'ok    ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''); steps.push(l); if (process.env.SCENARIO_LIVE) console.log(l); };
  const errors = await withPage({ width, height, reducedMotion }, async (page, touch) => {
    const fr = page.mainFrame(), ifr = { x:0, y:0 };
    // a classic Career that must never be touched
    const CLASSIC = JSON.stringify({ planted:true });
    const classic = () => page.evaluate(() => [localStorage.getItem('felt.career'), localStorage.getItem('felt.career.table')]);
    // the game, then Career from the menu: the hub over it
    const boot = async fresh => {
      await page.goto(base + '/index.html');
      if (fresh){
        await page.evaluate(c => {
          localStorage.clear();
          localStorage.setItem('felt.settings', JSON.stringify({ seenIntro:true, seenTour:true }));
          localStorage.setItem('felt.career', c);
        }, CLASSIC);
        await page.reload();
      }
      await page.waitForFunction(() => window.CareerHub && !document.getElementById('home').classList.contains('hidden'), null, { timeout:30000 });
      // every turn of the game's drum, counted (machine-wheel.js)
      await page.evaluate(() => { window.rolls = 0; const rig = machineWheelRig; machineWheelRig = (...a) => { window.rolls++; return rig(...a); }; });
      await page.waitForTimeout(2500);   // the menu's boot
      await tap(...await centre('#open-career'));
      await fr.waitForFunction(() => window.CareerMain && CareerMain.ready && !CareerMain.state.busy && CareerHub.open && !CareerHub.screen.inert, null, { timeout:30000 });
      await page.waitForTimeout(400);
    };
    const save = () => fr.evaluate(() => ({ bank:careerBankroll(), cards:careerInvitations().map(c => c.eventId), packets:careerPackets().map(p => p.kind),
      active:career.active && career.active.eventId, starter:career.starterGiven === true }));
    const hub = () => fr.evaluate(() => CareerMain.state);
    const shop = () => fr.evaluate(() => VendingLab.state);
    const until = async (fn, what, ms = 40000) => {
      const t = Date.now();
      while (Date.now() - t < ms){ if (await fn()) return; await page.waitForTimeout(80); }
      throw new Error('waiting for ' + what + ': hub ' + JSON.stringify(await hub().catch(() => null)) + ' save ' + JSON.stringify(await save().catch(() => null)));
    };
    const centre = async sel => { const r = await page.locator(sel).first().boundingBox(); assert.ok(r, sel + ' visible'); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const tap = async (x, y) => { await touch.start(x, y); await page.waitForTimeout(30); await touch.end(); await page.waitForTimeout(80); };
    const where = async (k, i) => { const q = await fr.evaluate(([k, i]) => CareerMain.where(k, i), [k, i]); return q && { ...q, x:q.x + ifr.x, y:q.y + ifr.y }; };
    const mid = async () => tap(...await centre('[data-key="play"]'));
    const label = () => fr.evaluate(() => document.querySelector('[data-key="play"]').textContent.replace(/\n/g, ' '));

    // 1. a fresh Career: $500 and the starter packet on the felt
    await boot(true);
    const rolls = {};
    const rolled = async name => { rolls[name] = await page.evaluate(() => { const n = window.rolls; window.rolls = 0; return n; }); };
    await rolled('menu → hub');
    let s = await save();
    step('a fresh Career: $500, the starter packet given once', s.bank === 500 && s.starter && s.packets.join() === 'starter' && (await hub()).packets === 1, JSON.stringify(s));

    // 2. OPEN: torn open on the felt; its four cards are yours (saved) and lie face down in a deck
    await mid();
    await until(async () => (await shop()).open === 'sealed', 'the packet ready to tear');
    for (let k = 0; k < 40; k++){
      if ((await shop()).mode === 'hub') break;
      if (!(await fr.evaluate(() => PackOpeningEmbed.state.lock))) await mid();
      await page.waitForTimeout(300);
    }
    await until(async () => { const h = await hub(); return (await shop()).mode === 'hub' && !h.busy && h.deck === 4; }, 'four cards face down');
    s = await save();
    step('the starter torn open: its four cards saved as yours, the packet gone', s.cards.length === 4 && s.packets.length === 0
      && s.cards.slice(0, 3).join() === 'back-room-invite,face-to-face,closing-time', JSON.stringify(s.cards));

    // 3. turn them all over and add them to the collection
    for (let k = 0; k < 4; k++){
      const d = await where('deck', 0);
      if (!d) break;
      await tap(d.x, d.y);
      await until(async () => (await shop()).open === 'shown', 'a card turned');
      await fr.waitForFunction(() => !PackOpeningEmbed.state.lock, null, { timeout:10000 });
      await tap(ifr.x + 30, ifr.y + 150);
      await until(async () => { const h = await hub(); return (await shop()).mode === 'hub' && !h.busy; }, 'the card put down');
      await page.waitForTimeout(300);
    }
    await until(async () => (await label()) === 'ADD TO COLLECTION', 'ADD TO COLLECTION');
    await mid();
    await until(async () => { const h = await hub(); return h.cards === 0 && !h.busy; }, 'the cards added');
    await page.waitForTimeout(300);
    // REDEAL: three of your cards in the tray
    await until(async () => (await label()) === 'REDEAL', 'REDEAL');
    await mid();
    await until(async () => { const h = await hub(); return h.house.length === 3 && !h.busy; }, 'three of yours in the tray');
    const tray = (await hub()).house.map(h => h.split(':')[1]);
    const ids = await fr.evaluate(() => careerInvitations().map(c => c.id));
    step('REDEAL deals only cards you own', tray.length === 3 && tray.every(id => ids.includes(id)), tray.join(' '));

    // 4. one dragged into the feeder and PLAYed: the card is used up, the table opens
    const w0 = await where('house', 0);
    const [fx, fy] = await centre('.cm-mouth');
    await touch.drag(w0.x, w0.y, fx, fy + 20, 14, 16); await page.waitForTimeout(150); await touch.end();
    await until(async () => (await hub()).fed && !(await hub()).busy, 'a card in the feeder');
    await until(async () => (await label()) === 'PLAY', 'PLAY');
    await page.evaluate(() => { window.rolls = 0; });
    await mid();
    await until(async () => (await save()).active, 'the event started');
    s = await save();
    step('PLAY: the card used up as its event starts', s.cards.length === 3 && !!s.active, s.active);
    await fr.waitForFunction(() => game && game.mode === 'career' && game.handNumber >= 1 && !document.getElementById('table-screen').classList.contains('hidden'), null, { timeout:40000 });
    const event = await fr.evaluate(() => ({ id:game.event.id, seats:game.players.length, roster:career.active.roster && career.active.roster.length }));
    step('the real table, seated for the card\'s event', event.seats >= 2 && event.id === s.active, JSON.stringify(event));
    await rolled('hub → table');
    if (SHOTS) await page.screenshot({ path:path.join(SHOTS, width + 'x' + height + '-table.png') });

    // 5. knocked out (DEV BUST ME, between actions), then BACK TO THE HUB: the prize counted in once
    const bank0 = (await save()).bank;
    await fr.evaluate(() => { DEV_MODE = true; });
    // BUST ME acts on your turn: armed whenever it's yours and you still have chips
    await until(async () => {
      await fr.evaluate(() => { if (handInProgress() && pendingHumanPlayer && game.players.find(p => p.isHuman).chips > 0) devBustMe(); });
      const key = await fr.evaluate(nextKey);
      if (key){ const [x, y] = await centre(key); await tap(x, y); }
      return !(await save()).active;
    }, 'the event settled', 400000);
    const result = await fr.evaluate(() => career.lastResult);
    await until(async () => fr.evaluate(() => { const b = document.getElementById('btn-award-pot-console'); return b && b.offsetParent && /hub/i.test(b.textContent); }), 'BACK TO THE HUB', 90000);
    // every finish of an invitation on the full stage, in its own words
    const card = await fr.evaluate(() => { const c = document.getElementById('result-card'); return { stage:document.getElementById('felt').classList.contains('results-mode'), text:c ? c.textContent.toUpperCase() : '' }; });
    step('the result on the full stage: no buy-in, no events board', card.stage && /EVENT WON|CASHED|EVENT LOST/.test(card.text) && !/BUY-IN|EVENTS BOARD/.test(card.text),
      result.outcome + ' ' + result.place + ': ' + card.text.replace(/\s+/g, ' ').slice(0, 90));
    await page.evaluate(() => { window.rolls = 0; });
    // (the key takes a press only once the result has finished showing)
    let pressed = 0;
    await until(async () => {
      if (await fr.evaluate(() => CareerHub.open && document.getElementById('table-screen').classList.contains('hidden'))) return true;
      if (Date.now() - pressed > 2500 && await fr.evaluate(() => /hub/i.test(document.getElementById('btn-award-pot-console').textContent))){
        pressed = Date.now(); await tap(...await centre('#btn-award-pot-console'));
      }
      return false;
    }, 'the hub again', 60000);
    await rolled('table → hub');
    // the hub says how it went, on the feeder's plate
    let plate = '';
    await until(async () => { plate = await fr.evaluate(() => document.querySelector('.cm-plate').textContent); return plate !== 'INSERT CARD'; }, 'the result on the plate', 8000).catch(() => {});
    step('the hub shows how the event went', /^(WON|=?\d+(ST|ND|RD|TH)|OUT) · /.test(plate), plate);
    await until(async () => !(await hub()).busy, 'the hub settled');
    await page.waitForTimeout(1500);
    s = await save();
    const reel = await fr.evaluate(() => CareerMain.wallet);
    step('back at the hub: the prize credited once, the reel agrees', s.bank === bank0 + result.prize && reel === s.bank, 'prize ' + result.prize + ', bank ' + s.bank + ', reel ' + reel);
    if (SHOTS) await page.screenshot({ path:path.join(SHOTS, width + 'x' + height + '-back.png') });

    // 6. the shop: a House Packet bought with the bankroll, dropped, taken, laid on the felt
    await page.evaluate(() => { window.rolls = 0; });
    await tap(...await centre('[data-key="shop"]'));
    await until(async () => (await shop()).mode === 'idle', 'the shop open');
    await rolled('hub → shop');
    const slot = await fr.evaluate(() => VendingLab.slots().find(q => q.id === 'house'));
    const k = await fr.evaluate(i => { const r = document.querySelector(`.vm-key[data-i="${i}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, slot.i);
    await tap(ifr.x + k[0], ifr.y + k[1]);
    await until(async () => (await shop()).order.length === 1, 'one chosen');
    const bank1 = (await save()).bank;
    const [kx, ky] = await centre('[data-key="play"]');
    await touch.start(kx, ky); await page.waitForTimeout(600); await touch.end();
    await until(async () => { const q = await shop(); if (q.stuck){ const [wx, wy] = await centre('.vm-window'); await tap(wx, wy); } return q.mode === 'idle' && q.tray >= 1; }, 'the packet dropped', 60000);
    s = await save();
    step('bought: $150 and one House Packet, saved together', s.bank === bank1 - 150 && s.packets.join() === 'house', 'bank ' + bank1 + ' -> ' + s.bank);
    await tap(...await centre('[data-key="shop"]'));   // LEAVE: the packet comes to the felt
    await until(async () => { const q = await shop(); return q.mode === 'hub' && q.hub.packets === 1 && !q.hub.busy; }, 'the packet on the felt');
    await rolled('shop → hub');

    // 7. a reload: the same bankroll, the same cards, the packet still sealed on the felt
    const before = await save();
    await boot(false);
    s = await save();
    const h = await hub();
    step('a reload keeps everything (its own save)', JSON.stringify(s) === JSON.stringify(before) && h.packets === 1, JSON.stringify(s));

    // 8. the album: one place per event; what you hold is bright
    await tap(...await centre('[data-key="cards"]'));
    await until(async () => fr.evaluate(() => window.CareerAlbum && CareerAlbum.out), 'the album up');
    await page.waitForTimeout(1200);
    const lit = await fr.evaluate(() => document.querySelectorAll('.cb-slot.is-have').length);
    const held = new Set((await save()).cards).size;
    step('the album shows what you hold', lit === held, lit + ' bright, ' + held + ' events held');
    if (SHOTS) await page.screenshot({ path:path.join(SHOTS, width + 'x' + height + '-album.png') });
    await tap(...await centre('[data-key="cards"]'));
    await until(async () => fr.evaluate(() => !CareerAlbum.out), 'the album away');

    // 8b. an event left mid-way comes back to the hub (CONTINUE), and
    // ABANDON gives it up: the card stays spent, no prize, the plate says so
    const cards0 = (await save()).cards.length;
    await fr.evaluate(() => CareerLink.play(CareerLink.pool()[0]));
    await fr.waitForFunction(() => game && game.mode === 'career' && game.handNumber >= 1 && !document.getElementById('table-screen').classList.contains('hidden'), null, { timeout:40000 });
    await page.waitForTimeout(800);
    await fr.evaluate(() => leaveTable());
    await until(async () => fr.evaluate(() => CareerHub.open && document.getElementById('table-screen').classList.contains('hidden') && !CareerMain.state.busy), 'the hub after leaving', 20000);
    await until(async () => (await label()) === 'CONTINUE', 'CONTINUE', 10000).catch(() => {});
    const cont = await label();
    await tap(...await centre('#cm-tune'));
    await page.waitForTimeout(300);
    await tap(...await centre('#cm-abandon'));
    await tap(...await centre('#confirm-dialog-yes'));
    await until(async () => !(await save()).active, 'the event abandoned', 10000);
    plate = '';
    await until(async () => { plate = await fr.evaluate(() => document.querySelector('.cm-plate').textContent); return plate === 'EVENT ABANDONED'; }, 'ABANDONED on the plate', 8000).catch(() => {});
    s = await save();
    const bank2 = s.bank;
    await until(async () => (await label()) !== 'CONTINUE', 'CONTINUE gone', 8000).catch(() => {});
    step('left mid-event: back to the hub (CONTINUE); ABANDON gives it up', cont === 'CONTINUE' && !s.active && s.cards.length === cards0 - 1
      && plate === 'EVENT ABANDONED' && (await label()) !== 'CONTINUE', cont + ' → ' + plate + ', bank ' + bank2);

    // 9. broke and cardless: one pity packet, not two (another visit, a reload)
    await fr.evaluate(() => { career.invitations = []; career.packets = []; career.bankroll = 20; saveCareer(); });
    await boot(false);
    const p1 = (await save()).packets;
    await fr.evaluate(() => CareerMain.refresh());
    await page.waitForTimeout(1500);
    await boot(false);
    const p2 = (await save()).packets;
    step('stuck: one pity packet, never two', p1.join() === 'pity' && p2.join() === 'pity' && (await hub()).packets === 1, p1.join() + ' / ' + p2.join());
    // the rock-bottom packet: its own wrapper, and three cards inside
    const wrapper = await fr.evaluate(() => CareerMain.where('pk', 0) && document.querySelector('.cm-pk') && careerPackets()[0].kind);
    await mid();
    await until(async () => (await shop()).open === 'sealed', 'the pity packet ready to tear');
    for (let k = 0; k < 40; k++){
      if ((await shop()).mode === 'hub') break;
      if (!(await fr.evaluate(() => PackOpeningEmbed.state.lock))) await mid();
      await page.waitForTimeout(300);
    }
    await until(async () => { const h = await hub(); return (await shop()).mode === 'hub' && !h.busy && h.deck > 0; }, 'its cards face down');
    s = await save();
    step('the pity packet opened: three Commons', wrapper === 'pity' && (await hub()).deck === 3 && s.cards.length === 3, (await hub()).deck + ' face down, ' + s.cards.join());

    // 10. the back key: the menu again, Career still there to open
    await until(async () => !(await hub()).busy, 'the hub settled');
    await page.evaluate(() => { window.rolls = 0; });
    await tap(...await centre('#cm-back'));
    await until(async () => page.evaluate(() => !CareerHub.open), 'the menu', 10000).catch(() => {});
    await page.waitForTimeout(600);
    await rolled('hub → menu');
    step('every screen change turned the game\'s drum', Object.values(rolls).every(n => n >= 1), JSON.stringify(rolls));
    const menu = await page.evaluate(() => ({ hub:CareerHub.open, key:!!document.getElementById('open-career').offsetParent, cm:!!document.getElementById('cm').offsetParent }));
    step('BACK: the menu again', !menu.hub && menu.key && !menu.cm, JSON.stringify(menu));
    const [c, t] = await classic();
    step('the classic Career save untouched', c === CLASSIC && t === null, String(c));
  });
  step('no JavaScript errors', !errors.filter(e => !/vibrate|favicon|status of 404/.test(e)).length, errors.join(' · '));
  return steps;
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive:true });
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const lines = [];
  try {
    for (const [i, [w, h]] of SIZES.entries()){
      lines.push('— ' + w + 'x' + h + (i ? ' (reduced motion)' : ''));
      try { lines.push(...await run(base, w, h, i > 0)); }
      catch (e){ lines.push('FAIL  stopped: ' + String(e.message || e).split('\n')[0].slice(0, 400)); }
    }
  } finally { server.close(); }
  console.log(lines.join('\n'));
  const ok = lines.every(l => !l.startsWith('FAIL'));
  console.log(ok ? '\nNew Career scenario passed.' : '\nNew Career scenario FAILED.');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
