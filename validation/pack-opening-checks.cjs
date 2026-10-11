/* Pack Opening V3 lab: touch checks, separate from `npm test`.
   Start a server at the repo root (python3 -m http.server 8768), then:
     node validation/pack-opening-checks.cjs
   PACK_OPENING_URL overrides the page. Uses real emulated touch through
   validation/tools/touch-harness.js. Slice 1: deal, pick, hold to buy
   (and cancel), tear by hand, draw by hand, the key-only path, tap to
   fast-forward, reduced motion, a small phone, and no game storage writes.
   Also: a packet picked up and thrown lands somewhere new. Slice 2:
   tap, flick and squeeze the deck to turn the cards, the key-only
   reveal, and a whole pack ending in the hand. Slice 3: pick a card
   out of the hand and spin it, flick the wrapper so its chips spill,
   KEEP (the hand into the collection, the chips into the bank).
   Slice 4: the hand is read as a poker hand. */
'use strict';
const assert = require('node:assert/strict');
const { withPage } = require('./tools/touch-harness');
const url = process.env.PACK_OPENING_URL || 'http://127.0.0.1:8768/pack-opening-lab.html';

async function run(width, height, reducedMotion){
  const errors = await withPage({ width, height, reducedMotion }, async (page, touch) => {
    await page.goto(url);
    const g = page.locator('#pk-game').contentFrame();
    await g.locator('#po').waitFor();
    const fr = page.frames()[1];
    const state = () => fr.evaluate(() => PackOpening.state);
    const phase = p => fr.waitForFunction(v => PackOpening.state.phase === v && !PackOpening.state.lock, p, { timeout:15000 }).catch(async e => { throw new Error('waiting for ' + p + ', state ' + JSON.stringify(await state())); });
    const box = async sel => { const r = await g.locator(sel).boundingBox(); assert.ok(r, sel + ' visible'); return r; };
    const centre = r => [r.x + r.width / 2, r.y + r.height / 2];
    const tap = async (x, y) => { await touch.start(x, y); await page.waitForTimeout(30); await touch.end(); };
    const hold = async (x, y, ms) => { await touch.start(x, y); await page.waitForTimeout(ms); await touch.end(); };
    // the felt's own storage is the in-memory shim; the page's stays untouched
    await page.evaluate(() => localStorage.setItem('pack-opening-qa', 'untouched'));

    // a tap during the deal fast-forwards it
    await page.waitForTimeout(150);
    const felt = await box('#po-stage');
    await tap(felt.x + 10, felt.y + 10);
    await phase('choose');
    assert.equal((await state()).packets, 3, 'three packets dealt');

    // pick a packet up and throw it: it lands somewhere new, still a packet to buy
    const h0 = (await state()).homes[0];
    const hp = centre(await box('.po-packet[data-series=house] .po-pk-front'));
    await touch.drag(hp[0], hp[1], hp[0] + 40, hp[1] + 90, 8, 16); await touch.end();
    await fr.waitForFunction(h => { const n = PackOpening.state.homes[0]; return n && (n[0] !== h[0] || n[1] !== h[1]); }, h0, { timeout:5000 });
    await phase('choose');

    for (let round = 0; round < 2; round++){
      const series = round ? 'reserve' : 'club';
      const before = (await state()).wallet;
      await tap(...centre(await box(`.po-packet[data-series=${series}] .po-pk-front`)));
      await phase('selected');
      assert.equal((await state()).chosen, series);

      // let go early: nothing is bought
      const pk = centre(await box(`.po-packet[data-series=${series}] .po-pk-front`));
      await hold(pk[0], pk[1] + 20, reducedMotion ? 150 : 300);
      await phase('selected');
      assert.equal((await state()).wallet, before, 'an early release buys nothing');

      if (round === 0){
        // hold to buy, by hand
        await hold(pk[0], pk[1] + 20, 1000);
        await phase('sealed');
        const s = await state();
        assert.equal(s.wallet, before - 300, 'the price came out of the bank');
        assert.equal(s.packets, 1, 'the other packets went back to the house');
        // tear by hand along the seam: art y 17 of 156, canvas offset 40 of 200
        const f = await box('.po-packet .po-pk-front');
        const y = f.y + f.height * (40 + 17) / 200, x0 = f.x + f.width * (12 + 5) / 120;
        await touch.drag(x0, y, x0 + f.width * .35, y + 2, 10, 16);
        await touch.end();
        await page.waitForTimeout(350);
        const half = await state();
        assert.ok(half.tear > .1 && half.tear < 1 && half.phase === 'sealed', 'a part tear holds: ' + half.tear);
        await touch.drag(x0 + f.width * .35, y, x0 + f.width * .95, y + 1, 12, 16);
        await touch.end();
        await phase('open');
        // a short pull springs back
        const m = await box('.po-packet .po-pk-front');
        const mx = m.x + m.width / 2, my = m.y + m.height * (40 + 30) / 200;
        await touch.drag(mx, my, mx, my - 14, 4, 16); await touch.end();
        await page.waitForTimeout(400);
        assert.equal((await state()).phase, 'open', 'a small pull returns the cards');
        await touch.drag(mx, my, mx, my - 120, 12, 16); await touch.end();
        await phase('deck');
      } else {
        // the key does everything: hold it to buy, then OPEN, DRAW
        const k = centre(await box('#po-key'));
        await hold(k[0], k[1], 1000);
        await phase('sealed');
        assert.equal((await state()).wallet, before - 1000);
        await tap(k[0], k[1]); await phase('open');
        await tap(k[0], k[1]); await phase('deck');
      }
      const end = await state();
      assert.ok(end.deck && end.pull > 40, 'the deck is on the felt');
      assert.equal(end.contents.length, 4, 'four cards inside');
      const d = await box('.po-deck');
      assert.ok(d.y > felt.y - 4 && d.y + d.height < felt.y + felt.height + 4, 'the deck lands on the felt');
      const k = centre(await box('#po-key'));
      if (round === 0){
        // 1: tap the deck
        await tap(...centre(await box('.po-deck'))); await phase('shown');
        assert.equal((await state()).shown, end.contents[0]);
        // 2: hold it, peel the corner a little, let go: still face down
        let dk = centre(await box('.po-deck'));
        await touch.start(dk[0], dk[1]); await page.waitForTimeout(500);
        assert.equal((await state()).phase, 'squeeze', 'a hold squeezes');
        for (let i = 1; i <= 4; i++){ await touch.move(dk[0] - i * 4, dk[1] + i * 4); await page.waitForTimeout(30); }
        assert.ok((await state()).fold > 0, 'the corner lifts');
        await touch.end(); await phase('peek');
        await tap(felt.x + felt.width / 2, felt.y + 20); await phase('shown');
        // 3: flick the deck
        dk = centre(await box('.po-deck'));
        await touch.drag(dk[0], dk[1], dk[0] - 20, dk[1] - 80, 5, 16); await touch.end();
        await phase('shown');
        // 4: squeeze it all the way over
        dk = centre(await box('.po-deck'));
        await touch.start(dk[0], dk[1]); await page.waitForTimeout(500);
        for (let i = 1; i <= 12; i++){ await touch.move(dk[0] - i * 9, dk[1] + i * 9); await page.waitForTimeout(25); }
        await touch.end(); await phase('shown');
        await tap(felt.x + 10, felt.y + 10);
        await phase('haul');
        // the machine reads the four cards as a poker hand
        assert.match(await g.locator('#po-title').textContent(), /PAIR|THREE|FOUR OF A KIND|RAINBOW/, 'the hand is named');
        // pick a card out of the hand: the shared inspect screen opens with
        // the real opponents seated; spin the card, swipe to the next, put it back
        await tap(...centre(await g.locator('.po-objects .ec-card').nth(1).boundingBox()));
        await fr.waitForFunction(() => PackOpening.state.inspecting && document.querySelectorAll('#ci .ci-seat').length > 0, null, { timeout:5000 });
        assert.equal(await g.locator('#ci .ci-seat:not(.is-empty)').count(), await g.locator('#ci .ci-seat').count(), 'every seat has a face');
        const ic = centre(await g.locator('#ci .ec-card').boundingBox());
        await touch.drag(ic[0], ic[1], ic[0] + 90, ic[1], 6, 16); await touch.end();
        await page.waitForTimeout(400);
        const cr = centre(await g.locator('#ci .ci-crt').boundingBox());
        await touch.drag(cr[0] + 60, cr[1], cr[0] - 80, cr[1], 6, 16); await touch.end();
        await fr.waitForFunction(() => CardInspect.index === 2, null, { timeout:5000 });
        await page.waitForTimeout(500);
        await tap(felt.x + 10, felt.y + 10); await phase('haul');
        assert.equal(await g.locator('#ci').isHidden(), true, 'the inspect screen closed');
        // flick the wrapper away: its chips spill onto the felt
        const w = centre(await box('.po-packet .po-pk-front'));
        await touch.drag(w[0], w[1], w[0] - 30, w[1] - 110, 5, 16); await touch.end();
        await fr.waitForFunction(() => !PackOpening.state.wrapper && PackOpening.state.chips > 0, null, { timeout:5000 });
      } else {
        // the key turns each one over, then puts the last into the hand
        await tap(k[0], k[1]);
        for (let i = 0; i < 4; i++){ await phase('shown'); await tap(k[0], k[1]); }
      }
      await phase('haul');
      const fin = await state();
      assert.equal(fin.revealed, 4); assert.equal(fin.fan, 4, 'all four in the hand');
      // KEEP: the hand into the collection, the chips into the bank, deal again
      await tap(k[0], k[1]);
      await phase('choose');
      const kept = await state();
      assert.equal(kept.collection, 4 * (round + 1), 'the hand went into the collection');
      assert.ok(kept.wallet > fin.wallet, 'the chips counted into the bank');
      await tap(felt.x + 10, felt.y + 10); // fast-forward a fresh deal (no-op if done)
      await phase('choose');
    }
    // the same inspect screen from the hub desk: BUY IN uses the card up
    await fr.evaluate(() => document.querySelector('[data-door=hub]').click());
    const before = (await state()).held;
    assert.ok(before >= 1, 'kept cards are in the case');
    await tap(...centre(await g.locator('.po-hub-card').first().boundingBox()));
    await fr.waitForFunction(() => PackOpening.state.inspecting, null, { timeout:5000 });
    await page.waitForTimeout(700);
    await tap(...centre(await g.locator('#ci .ci-key').boundingBox()));
    await fr.waitForFunction(h => PackOpening.state.held === h - 1 && !PackOpening.state.inspecting, before, { timeout:6000 });
    // and from the album, where every kept design is found
    await fr.evaluate(() => document.querySelector('[data-door=album]').click());
    assert.ok((await state()).found >= 1, 'the album records what you pulled');
    await tap(...centre(await g.locator('.po-album .po-mini:not(.is-unfound)').first().boundingBox()));
    await fr.waitForFunction(() => PackOpening.state.inspecting, null, { timeout:5000 });
    await page.waitForTimeout(700);
    await fr.evaluate(() => CardInspect.close());
    await fr.waitForFunction(() => !PackOpening.state.inspecting, null, { timeout:5000 });
    assert.equal(await page.evaluate(() => localStorage.getItem('pack-opening-qa')), 'untouched');
  });
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`ok ${width}x${height}${reducedMotion ? ' reduced motion' : ''}`);
}

(async () => {
  if (!process.env.ONLY_REDUCED){ await run(390, 844, false); await run(375, 667, false); }
  await run(390, 844, true);
  console.log('Pack Opening checks passed (slices 1-4 and the shared inspect screen).');
})().catch(e => { console.error(e); process.exit(1); });
