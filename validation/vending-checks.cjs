/* The Career hub (the wooden table) and the packet machine: touch checks,
   separate from `npm test`.
   Start a server at the repo root (python3 -m http.server 8765), then:
     node validation/vending-checks.cjs
   VENDING_URL overrides the page. Real emulated touch through
   validation/tools/touch-harness.js. The hub: three cards on the tray;
   one dragged off is on the felt, and a double tap on empty felt sends
   the felt's cards to the collection and leaves the tray; REDEAL deals
   three onto the felt; one dragged up goes half into the feeder (PLAY), a
   tap brings it out; one thrown upwards flies off into the collection,
   never into the feeder; a tray card dragged up and PLAYed is used up and
   off the tray. The shop: SHOP rolls the machine down; TUNE changes while
   it's down leave it where it is; a sold-out key does nothing; a key twice
   puts two in, a packet's first tap only looks at it and its second puts
   one in; CLEAR empties them, chosen again; HOLD TO BUY pays (the bankroll
   drops by the total) and they drop into the tray; one sticks and two
   knocks free it; TAKE takes one out; a flick down sends it; LEAVE takes
   the rest. Back on the hub the packets lie on the felt (OPEN); one is torn
   open: its four cards go face down into a deck, the wrapper and the strip
   stay, its chips count in; the other's cards join the same deck. Tapping
   the deck turns the top card over; tapping it again puts that one down and
   turns the next; tapping elsewhere puts it down and leaves the deck; one
   put down and thrown off goes into the collection; ADD TO COLLECTION files
   the rest; a double tap on empty felt clears the rubbish, the deck stays. At three sizes (one
   with reduced motion), with no errors and no game storage writes. */
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
    await fr.waitForFunction(() => window.VendingLab && window.CareerMain && CareerMain.state.tray.length === 3 && !CareerMain.state.busy, null, { timeout:20000 });
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

    // THE HUB: three cards on the wooden table
    const hub = () => fr.evaluate(() => CareerMain.state);
    // where a thing is, on the page (the frame's own coordinates, offset)
    const where = async (k, i) => { const q = await fr.evaluate(([k, i]) => CareerMain.where(k, i), [k, i]); return { ...q, x:q.x + ifr.x, y:q.y + ifr.y }; };
    const hubUntil = async (fn, what, ms = 20000) => {
      const t = Date.now();
      while (Date.now() - t < ms){ const h = await hub(); if (fn(h)) return h; await page.waitForTimeout(60); }
      throw new Error('waiting for ' + what + ', hub ' + JSON.stringify(await hub()) + ' errors ' + page._errors.join(' · '));
    };
    const [mx, my] = await centre('[data-key="play"]');
    const keyLabels = () => fr.evaluate(() => ['shop', 'play', 'cards'].map(k => document.querySelector(`[data-key="${k}"]`).textContent.replace(/\n/g, ' ')).join(' · '));
    // the tray (owner, 13 Oct 2026: yours to curate): the lab's three lie on it
    const onWood = await fr.evaluate(() => { const w = document.querySelector('.cm-wood').getBoundingClientRect(); return [0, 1, 2].map(i => CareerMain.where('tray', i)).every(p => p && p.x > w.left && p.x < w.right && p.y > w.top && p.y < w.bottom); });
    assert.ok(onWood, 'the three cards lie on the table');
    assert.equal(await keyLabels(), 'SHOP · REDEAL · CARDS');
    // dragged off the tray down the felt: it's on the felt now, not the tray;
    // a double tap on empty felt sends the felt's cards to the collection and
    // leaves the tray alone
    let w0 = await where('tray', 0);
    await touch.drag(w0.x, w0.y, w0.x + 40, w0.y + 260, 12, 16); await touch.end();
    await page.waitForTimeout(600);
    let h = await hub();
    assert.ok(h.tray.length === 2 && h.cards === 1, 'a card dragged off the tray is on the felt');
    const fe = await fr.evaluate(() => { const r = CareerMain.felt.getBoundingClientRect(); return [r.left + r.width * .85, r.bottom - 40]; });
    await tap(ifr.x + fe[0], ifr.y + fe[1]); await page.waitForTimeout(40); await tap(ifr.x + fe[0] + 2, ifr.y + fe[1] + 1);
    h = await hubUntil(q => !q.busy && q.cards === 0, 'the felt cleared');
    assert.equal(h.tray.length, 2, 'a double tap leaves the tray alone');
    // REDEAL: three others onto the felt
    await tap(mx, my);
    h = await hubUntil(q => !q.busy && q.dealt.length === 3, 'the redeal');
    assert.equal(h.tray.length, 2, 'REDEAL leaves the tray alone');
    // where to drag a card to feed it: the feeder's mouth
    const [fx, fy] = await centre('.cm-mouth');
    // dragged up: half into the feeder, PLAY; a tap and it comes back out
    w0 = await where('dealt', 1);
    await touch.drag(w0.x, w0.y, fx, fy + 20, 14, 16); await page.waitForTimeout(120); await touch.end();
    h = await hubUntil(q => q.fed === 'card' && !q.busy, 'a card in the feeder');
    assert.equal(await keyLabels(), 'SHOP · PLAY · CARDS');
    assert.notEqual(await g.locator('.cm-plate').textContent(), 'INSERT CARD', 'the plate reads the card');
    await page.waitForTimeout(500);
    const fedAt = await fr.evaluate(() => { const r = CareerMain.mouthEl.getBoundingClientRect(); return [r.left + r.width / 2, r.bottom + 30]; });
    await tap(ifr.x + fedAt[0], ifr.y + fedAt[1]);
    h = await hubUntil(q => q.fed === null && !q.busy, 'the card back out');
    assert.equal(await keyLabels(), 'SHOP · REDEAL · CARDS');
    // thrown upwards: it flies off into the collection, not into the feeder
    w0 = await where('dealt', 0);
    await touch.flick(w0.x, w0.y, w0.x + 10, w0.y - 420, 5, 8);
    h = await hubUntil(q => !q.busy && q.cards === 2 && q.fed === null, 'the thrown card gone');
    // a tray card dragged up and PLAYed: it's used up, and off the tray
    await page.waitForTimeout(500);
    const pool0 = h.pool;
    w0 = await where('tray', 1);
    await touch.drag(w0.x, w0.y, fx, fy + 20, 14, 16); await page.waitForTimeout(120); await touch.end();
    await hubUntil(q => q.fed === 'tray' && !q.busy, 'a card in the feeder');
    // (a tap straight after a flick only stops the fling in Chrome's touch emulation)
    await page.waitForTimeout(500);
    await tap(mx, my);
    h = await hubUntil(q => !q.busy && q.fed === null && q.tray.length === 1, 'the card played', 20000);
    assert.equal(h.pool, pool0 - 1, 'the card played is used up');

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
    // LEAVE: the rest come too; on the hub they lie on the felt
    // (a tap straight after a flick only stops the fling in Chrome's touch emulation)
    await page.waitForTimeout(500);
    await tap(...await centre('[data-key="shop"]'));
    s = await until(q => q.mode === 'hub' && q.hub.packets === 2 && !q.hub.busy, 'the hub and the packets');
    await page.waitForTimeout(200);
    assert.equal(s.hub.tray.length, 1, 'the tray\'s cards stay on the tray');
    assert.equal(await keyLabels(), 'SHOP · OPEN · CARDS', 'and the hub\'s keys again');

    // (REDEAL's cards still lie on the felt: a double tap sends them back)
    await tap(ifr.x + fe[0], ifr.y + fe[1]); await page.waitForTimeout(40); await tap(ifr.x + fe[0] + 2, ifr.y + fe[1] + 1);
    s = await until(q => q.hub.cards === 0 && !q.hub.busy, 'the felt cleared');
    // a packet tapped is torn open on the felt; the key runs the tear and the pull
    const pool1 = s.hub.pool, wallet0 = s.wallet;
    const tear = async () => {
      await tap(mx, my);   // OPEN: the last one down
      await until(q => q.open === 'sealed', 'the packet torn open');
      for (let k = 0; k < 30; k++){
        if ((await st()).mode === 'hub') break;
        if (!(await fr.evaluate(() => PackOpeningEmbed.state.lock))) await tap(kx, ky);
        await page.waitForTimeout(300);
      }
      await until(q => q.mode === 'hub' && !q.hub.busy, 'the cards out');
      await page.waitForTimeout(700);
    };
    await tear();
    s = await st();
    assert.equal(s.hub.deck, 4, 'four cards face down in a deck');
    assert.equal(s.hub.cards, 0);
    assert.equal(s.hub.junk, 2, 'the wrapper and the strip stay');
    // the other, before turning any over: its cards join the deck
    await tear();
    s = await until(q => q.hub.deck === 8 && !q.hub.busy, 'one deck of eight');
    assert.equal(s.hub.packets, 0);
    await page.waitForTimeout(200);
    assert.equal(await keyLabels(), 'SHOP · REDEAL · CARDS');
    // tap the deck: the top card turns over; tap it again: that one goes down, the next turns
    const deckAt = async () => { const d = await where('deck', 0); return [d.x, d.y]; };
    await tap(...await deckAt());
    await until(q => q.open === 'shown' && !q.hub.busy, 'the first card turned');
    await fr.waitForFunction(() => !PackOpeningEmbed.state.lock, null, { timeout:10000 });
    const [dx, dy] = await centre('.vm-open .po-deck');
    await tap(dx, dy);
    await until(q => q.open === 'shown' && q.hub.cards === 1, 'the next turned, the first put down');
    await fr.waitForFunction(() => !PackOpeningEmbed.state.lock, null, { timeout:10000 });
    // tap anywhere else: it's put down and the deck waits
    await tap(ifr.x + 40, ifr.y + 140);
    s = await until(q => q.mode === 'hub' && q.hub.cards === 2 && q.hub.deck === 6 && !q.hub.busy, 'both put down, the deck back');
    await page.waitForTimeout(600);
    // the top card, wherever it lies
    const topCard = () => fr.evaluate(() => {
      for (let i = 0; i < 40; i++){
        const q = CareerMain.where('card', i); if (!q) break;
        const e = document.elementFromPoint(q.x, q.y)?.closest('.cm-card');
        if (e){ const r = e.getBoundingClientRect(); if (Math.abs(r.x + r.width / 2 - q.x) < 2 && Math.abs(r.y + r.height / 2 - q.y) < 2) return q; }
      }
      return null;
    });
    // thrown off the felt: into the collection
    const c = await topCard();
    assert.ok(c, 'a card on top');
    await touch.flick(ifr.x + c.x, ifr.y + c.y, ifr.x + c.x - 220, ifr.y + c.y + 20, 5, 8);
    s = await until(q => q.hub.cards === 1 && q.hub.pool === pool1 + 1 && !q.hub.busy, 'the card thrown off, into your collection');
    // ADD TO COLLECTION: the rest
    // (a tap straight after a flick only stops the fling in Chrome's touch emulation)
    await page.waitForTimeout(500);
    await tap(mx, my);
    s = await until(q => q.hub.cards === 0 && !q.hub.busy, 'the rest added');
    assert.equal(s.hub.pool, pool1 + 2);
    assert.equal(s.hub.junk, 4, 'the rubbish is still lying there');
    await page.waitForTimeout(200);   // (the label flips over)
    assert.equal(await keyLabels(), 'SHOP · REDEAL · CARDS');
    // a double tap on empty felt clears it
    const ef = await fr.evaluate(() => {
      const r = CareerMain.felt.getBoundingClientRect();
      for (const [fx, fy] of [[.06, .97], [.94, .97], [.06, .5], [.94, .5], [.5, .97]]){ const x = r.left + r.width * fx, y = r.top + r.height * fy; if (!document.elementFromPoint(x, y)?.closest('.po-body')) return [x, y]; }
      return [r.left + 8, r.bottom - 8];
    });
    await tap(ifr.x + ef[0], ifr.y + ef[1]); await page.waitForTimeout(40); await tap(ifr.x + ef[0] + 2, ifr.y + ef[1]);
    s = await until(q => q.hub.junk === 0 && !q.hub.busy, 'the felt cleared');
    assert.equal(s.hub.deck, 6, 'the deck stays');
    assert.ok(s.wallet > wallet0, 'the packets\' chips counted into the bankroll');

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
