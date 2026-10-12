/* The packet machine lab: touch checks, separate from `npm test`.
   Start a server at the repo root (python3 -m http.server 8765), then:
     node validation/vending-checks.cjs
   VENDING_URL overrides the page. Real emulated touch through
   validation/tools/touch-harness.js: SHOP rolls the machine down; TUNE
   changes while it's down leave it where it is; a sold-out key does
   nothing; a key twice puts two in, a packet's first tap only looks at it
   and its second puts one in; CLEAR empties them, chosen again; HOLD TO
   BUY pays (the bankroll drops by the total) and they drop into the tray;
   one sticks and two knocks free it; PUSH takes one out; a flick down
   sends it; SHOP takes the rest; on the hub they wait in a pile; one is
   opened there: its four cards are laid down on the felt, the wrapper,
   the strip and a bag of chips left there; the bag is snipped and the
   chips spill; the clean-up spot puts every card back in the deck and the
   chips in the bankroll. At three sizes (one with reduced motion), with
   no errors and no game storage writes. */
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
      throw new Error('waiting for ' + what + ', state ' + JSON.stringify(await st()) + ' errors ' + page._errors.join(' · '));
    };
    const centre = async sel => { const r = await g.locator(sel).first().boundingBox(); assert.ok(r, sel + ' visible'); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const tap = async (x, y) => { await touch.start(x, y); await page.waitForTimeout(30); await touch.end(); await page.waitForTimeout(60); };
    const tune = (k, v) => fr.evaluate(([k, v]) => document.querySelector(`[data-vm="${k}"] [data-v="${v}"]`).click(), [k, v]);
    const ifr = await page.locator('#pk-game').boundingBox();

    // SHOP: the machine rolls down and boots
    await tune('stuck', 'next');
    await tap(...await centre('[data-key="shop"]'));
    let s = await until(q => q.mode === 'idle', 'the machine');
    const labels = () => fr.evaluate(() => ['shop', 'play', 'cards'].map(k => { const b = document.querySelector(`[data-key="${k}"]`); return b.textContent + (b.disabled ? ':off' : ''); }).join(' · '));
    await page.waitForTimeout(200);
    assert.equal(await labels(), 'LEAVE · HOLD TO BUY:off · TAKE:off', 'the console is the machine\'s');
    assert.ok(s.k > .3, 'packets a readable size (' + s.k + ')');
    // TUNE while it's down: it stays where it is, and the keys still work
    const spot = async () => fr.evaluate(() => { const v = document.querySelector('.vm').getBoundingClientRect(), r = document.querySelector('.cm-cabinet').getBoundingClientRect(), c = document.querySelector('.cm-console').getBoundingClientRect(); return { top:v.top, bottom:v.bottom, cab:r.bottom, con:c.top }; });
    const at0 = await spot();
    await tap(...await centre('#cm-tune'));
    await tune('rows', '3'); await tune('cols', '5'); await page.waitForTimeout(200);
    await tune('rows', '4'); await tune('cols', '4'); await page.waitForTimeout(200);
    await fr.evaluate(() => document.querySelector('#cm-done').click());
    const at1 = await spot();
    assert.ok(Math.abs(at1.top - at0.top) < 2 && at1.bottom <= at1.con + 2, 'the machine stays put after TUNE (' + JSON.stringify([at0, at1]) + ')');
    const slots = await fr.evaluate(() => VendingLab.slots());
    const out = slots.find(q => !q.id), club = slots.find(q => q.id === 'club'), house = slots.find(q => q.id === 'house');
    const key = i => centre(`.vm-key[data-i="${i}"]`);

    // a sold-out key does nothing
    if (out){ await tap(...await key(out.i)); assert.equal((await st()).order.length, 0, 'sold out: nothing chosen'); }
    // a key twice; a packet: the first tap looks, the second puts one in; CLEAR; again
    await tap(...await key(club.i)); await tap(...await key(club.i));
    const pk = await g.locator(`.vm-show .vm-packet[data-i="${house.i}"]`).boundingBox();
    await tap(pk.x + pk.width / 2, pk.y + pk.height / 2);
    s = await st();
    assert.equal(s.sel, 'house', 'a packet tapped once is looked at');
    assert.deepEqual(s.order, ['club', 'club'], 'and not put in');
    await tap(pk.x + pk.width / 2, pk.y + pk.height / 2);
    s = await st();
    assert.deepEqual(s.order, ['club', 'club', 'house'], 'chosen: a key twice, a packet tapped twice');
    assert.equal(s.total, 700);
    await tap(...await centre('.vm-clear'));
    assert.equal((await st()).order.length, 0, 'CLEAR empties it');
    await tap(...await key(club.i)); await tap(...await key(house.i));
    s = await st();
    assert.equal(s.total, 400);
    const before = s.wallet;

    // HOLD TO BUY: the chips go in, the packets drop; the first one sticks
    const [kx, ky] = await centre('[data-key="play"]');
    // every chip, every frame: none may hang still in the air while it's showing
    await fr.evaluate(() => {
      const seen = new Map(), out = window.__chips = { worst:0, frames:0, n:0 };
      (function look(now){
        document.querySelectorAll('.vm-chip').forEach(el => {
          const t = el.style.transform, s = seen.get(el);
          if (!s){ seen.set(el, { t, at:now }); out.n++; return; }
          if (t !== s.t){ s.t = t; s.at = now; } else out.worst = Math.max(out.worst, now - s.at);
        });
        out.frames++;
        if (out.frames < 1500) requestAnimationFrame(look);
      })(performance.now());
    });
    await touch.start(kx, ky); await page.waitForTimeout(560); await touch.end();
    await until(q => q.stuck, 'a stuck packet');
    const [wx, wy] = await centre('.vm-window');
    await tap(wx, wy);
    assert.ok((await st()).stuck, 'one knock is not enough');
    await tap(wx, wy);
    s = await until(q => q.mode === 'idle', 'the drop');
    assert.equal(s.wallet, before - 400, 'the bankroll paid the total');
    if (!reducedMotion){
      const ch = await fr.evaluate(() => window.__chips);
      assert.ok(ch.n >= 2 && ch.worst < 90, 'no chip hangs still on its way in (' + JSON.stringify(ch) + ')');
    }
    assert.equal(s.tray, 2, 'both packets in the tray');

    // TAKE (as PUSH): one comes out; flicked down, it's sent and the next comes out
    assert.equal(await labels(), 'LEAVE · HOLD TO BUY:off · TAKE', 'TAKE lit with packets in the tray');
    await tap(...await centre('[data-key="cards"]'));
    await until(q => q.inHand, 'a packet in hand');
    await page.waitForTimeout(500);
    const hb = await g.locator('.vm-hand .vm-packet').first().boundingBox();
    const px = hb.x + hb.width / 2, py = hb.y + hb.height * .6;
    await touch.start(px, py);
    for (let i = 1; i <= 6; i++){ await touch.move(px, py + i * 22); await page.waitForTimeout(12); }
    await touch.end();
    s = await until(q => q.inHand && q.tray === 0, 'the next one out');
    // SHOP: the rest come too; on the hub they wait in a pile
    // (a tap straight after a flick only stops the fling in Chrome's touch emulation)
    await page.waitForTimeout(500);
    await tap(...await centre('[data-key="shop"]'));
    s = await until(q => q.mode === 'hub' && q.pile === 2, 'the hub and the pile');
    await page.waitForTimeout(200);
    assert.equal(await labels(), 'SHOP · PLAY · CARDS', 'and the hub\'s again');
    await page.waitForTimeout(900);
    assert.match(await g.locator('.cm-crt-r').textContent(), /WAITING\s*2/, 'the screen counts them');

    // tap the pile: it's opened on the felt; the key runs it to the end
    const { pool, cards } = s, wallet0 = s.wallet;
    await tap(...await centre('.vm-pile .vm-packet:last-child'));
    await until(q => q.open === 'sealed', 'the packet on the felt');
    for (let i = 0; i < 40; i++){
      const q = await st();
      if (q.mode === 'hub') break;
      if (!(await fr.evaluate(() => PackOpeningEmbed.state.lock))) await tap(kx, ky);
      await page.waitForTimeout(q.open === 'haul' ? 200 : 350);
    }
    s = await until(q => q.mode === 'hub' && q.cards === cards + 4 && q.loose.includes('bag'), 'the cards laid down', 40000);
    assert.equal(s.pool, pool + 4, 'four cards into your case');
    assert.equal(s.pile, 1, 'one still waiting');
    assert.ok(s.loose.includes('wrapper') && s.loose.includes('flap'), 'the wrapper and the strip left on the felt: ' + s.loose);

    // snip the bag across its top corner: the chips spill out
    await page.waitForTimeout(400);
    const pt = (lx, ly) => fr.evaluate(([lx, ly]) => VendingLab.bagPoint(lx, ly), [lx, ly]);
    const grip = await fr.evaluate(() => VendingLab.bagGrip());
    assert.ok(grip, 'the bag can be reached');
    const [ax, ay] = await pt(...grip), [bx, by] = await pt(grip[0] + .65, grip[1]);
    await touch.start(ifr.x + ax, ifr.y + ay);
    for (let i = 1; i <= 8; i++){ await touch.move(ifr.x + ax + (bx - ax) * i / 8, ifr.y + ay + (by - ay) * i / 8); await page.waitForTimeout(16); }
    await touch.end();
    s = await until(q => q.loose.includes('bag:open') && q.chips > 0, 'the chips spilled');
    await page.waitForTimeout(900);
    const [cx, cy] = await fr.evaluate(() => VendingLab.chipPoint());
    await tap(ifr.x + cx, ifr.y + cy);
    console.log('after chip', (await st()).mode, cx, cy, JSON.stringify(await fr.evaluate(() => document.querySelector('.vm-pile').getBoundingClientRect())));

    // the clean-up spot: every card back in the deck, the chips in the bankroll
    await until(q => !q.busy, 'the hub still');
    await page.waitForTimeout(600);
    // (somewhere on the spot that nothing's lying on)
    const [qx, qy] = await fr.evaluate(() => {
      const r = document.querySelector('.cm-pad').getBoundingClientRect();
      for (let i = 1; i < 25; i++){ const x = r.left + r.width * ((i * 7) % 10 + .5) / 10, y = r.top + r.height * ((i * 3) % 10 + .5) / 10, e = document.elementFromPoint(x, y); if (!e.closest('.vm-loose, .cm-card, .vm-pile')) return [x, y]; }
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    console.log('pad at', qx, qy, (await st()).mode);
    await tap(ifr.x + qx, ifr.y + qy);
    await page.waitForTimeout(100); console.log('after pad', (await st()).mode);
    s = await until(q => q.cards === 0 && q.chips === 0 && !q.loose.length && !q.busy, 'the felt cleared', 20000);
    assert.equal(s.deck, s.pool, 'every card back in the deck');
    assert.ok(s.wallet > wallet0, 'the chips counted into the bankroll');

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
