/* The packet machine lab: touch checks, separate from `npm test`.
   Start a server at the repo root (python3 -m http.server 8765), then:
     node validation/vending-checks.cjs
   VENDING_URL overrides the page. Real emulated touch through
   validation/tools/touch-harness.js: SHOP rolls the machine down; a
   sold-out key does nothing; two packets chosen (a key twice, a packet
   once), CLEAR empties them, chosen again; HOLD TO BUY pays (the bankroll
   drops by the total) and they drop into the tray; one sticks and two
   knocks free it; PUSH takes one out; a flick down sends it; SHOP takes
   the rest; on the hub they wait in a pile; one is opened there and KEEP
   puts four cards in the deck. At three sizes (one with reduced motion),
   with no errors and no game storage writes. */
'use strict';
const assert = require('node:assert/strict');
const { withPage } = require('./tools/touch-harness');
const url = process.env.VENDING_URL || 'http://127.0.0.1:8765/vending-lab.html';

async function run(width, height, reducedMotion){
  return withPage({ width, height, reducedMotion }, async (page, touch) => {
    await page.goto(url);
    const g = page.locator('#pk-game').contentFrame();
    await g.locator('#cm').waitFor();
    const fr = page.frames()[1];
    await fr.waitForFunction(() => window.VendingLab && window.CareerMain && CareerMain.cards === 3, null, { timeout:20000 });
    await page.evaluate(() => localStorage.setItem('vending-qa', 'untouched'));
    const st = () => fr.evaluate(() => VendingLab.state);
    const until = async (fn, what, ms = 30000) => {
      const t = Date.now();
      while (Date.now() - t < ms){ const s = await st(); if (fn(s)) return s; await page.waitForTimeout(60); }
      throw new Error('waiting for ' + what + ', state ' + JSON.stringify(await st()));
    };
    const centre = async sel => { const r = await g.locator(sel).first().boundingBox(); assert.ok(r, sel + ' visible'); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const tap = async (x, y) => { await touch.start(x, y); await page.waitForTimeout(30); await touch.end(); await page.waitForTimeout(60); };
    const tune = (k, v) => fr.evaluate(([k, v]) => document.querySelector(`[data-vm="${k}"] [data-v="${v}"]`).click(), [k, v]);

    // SHOP: the machine rolls down and boots
    await tune('stuck', 'next');
    await tap(...await centre('[data-key="shop"]'));
    let s = await until(q => q.mode === 'idle', 'the machine');
    assert.ok(s.k > .3, 'packets a readable size (' + s.k + ')');
    const slots = await fr.evaluate(() => VendingLab.slots());
    const out = slots.find(q => !q.id), club = slots.find(q => q.id === 'club'), house = slots.find(q => q.id === 'house');
    const key = i => centre(`.vm-key[data-i="${i}"]`);

    // a sold-out key does nothing
    if (out){ await tap(...await key(out.i)); assert.equal((await st()).order.length, 0, 'sold out: nothing chosen'); }
    // a key twice and a packet once; CLEAR; again
    await tap(...await key(club.i)); await tap(...await key(club.i));
    const pk = await g.locator(`.vm-show .vm-packet[data-i="${house.i}"]`).boundingBox();
    await tap(pk.x + pk.width / 2, pk.y + pk.height / 2);
    s = await st();
    assert.deepEqual(s.order, ['club', 'club', 'house'], 'chosen: a key twice, a packet once');
    assert.equal(s.total, 700);
    await tap(...await centre('.vm-clear'));
    assert.equal((await st()).order.length, 0, 'CLEAR empties it');
    await tap(...await key(club.i)); await tap(...await key(house.i));
    s = await st();
    assert.equal(s.total, 400);
    const before = s.wallet;

    // HOLD TO BUY: the chips go in, the packets drop; the first one sticks
    const [kx, ky] = await centre('[data-key="play"]');
    await touch.start(kx, ky); await page.waitForTimeout(560); await touch.end();
    await until(q => q.stuck, 'a stuck packet');
    const [wx, wy] = await centre('.vm-window');
    await tap(wx, wy);
    assert.ok((await st()).stuck, 'one knock is not enough');
    await tap(wx, wy);
    s = await until(q => q.mode === 'idle', 'the drop');
    assert.equal(s.wallet, before - 400, 'the bankroll paid the total');
    assert.equal(s.tray, 2, 'both packets in the tray');

    // PUSH: one comes out; flicked down, it's sent and the next comes out
    await tap(...await centre('.vm-flap'));
    await until(q => q.inHand, 'a packet in hand');
    await page.waitForTimeout(500);
    const hb = await g.locator('.vm-hand .vm-packet').first().boundingBox();
    const px = hb.x + hb.width / 2, py = hb.y + hb.height * .6;
    await touch.start(px, py);
    for (let i = 1; i <= 6; i++){ await touch.move(px, py + i * 22); await page.waitForTimeout(12); }
    await touch.end();
    s = await until(q => q.inHand && q.tray === 0, 'the next one out');
    // SHOP: the rest come too; on the hub they wait in a pile
    await tap(...await centre('[data-key="shop"]'));
    s = await until(q => q.mode === 'hub' && q.pile === 2, 'the hub and the pile');
    await page.waitForTimeout(900);
    assert.match(await g.locator('.cm-crt-r').textContent(), /WAITING\s*2/, 'the screen counts them');

    // tap the pile: it's opened on the felt; the key runs it to KEEP
    const deck = s.deck;
    await tap(...await centre('.vm-pile .vm-packet:last-child'));
    await until(q => q.open === 'sealed', 'the packet on the felt');
    for (let i = 0; i < 40; i++){
      const q = await st();
      if (q.mode === 'hub') break;
      if (!(await fr.evaluate(() => PackOpeningEmbed.state.lock))) await tap(kx, ky);
      await page.waitForTimeout(q.open === 'haul' ? 200 : 350);
    }
    s = await until(q => q.mode === 'hub', 'KEEP', 40000);
    assert.equal(s.deck, deck + 4, 'four cards into the deck');
    assert.equal(s.pile, 1, 'one still waiting');

    assert.equal(await page.evaluate(() => localStorage.getItem('vending-qa')), 'untouched', 'no game storage writes');
  });
}

(async () => {
  for (const [w, h, rm] of [[430, 932, false], [390, 844, false], [375, 667, true]]){
    const errors = await run(w, h, rm);
    const real = (errors || []).filter(e => !/vibrate/.test(e));
    assert.deepEqual(real, [], 'no errors at ' + w + 'x' + h);
    console.log('ok', w + 'x' + h + (rm ? ' reduced motion' : ''));
  }
})().catch(e => { console.error(e); process.exit(1); });
