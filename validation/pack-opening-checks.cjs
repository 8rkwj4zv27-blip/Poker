/* Pack Opening V3 lab: touch checks, separate from `npm test`.
   Start a server at the repo root (python3 -m http.server 8768), then:
     node validation/pack-opening-checks.cjs
   PACK_OPENING_URL overrides the page. Uses real emulated touch through
   validation/tools/touch-harness.js. Slice 1: deal, pick, hold to buy
   (and cancel), tear by hand, draw by hand, the key-only path, tap to
   fast-forward, reduced motion, a small phone, and no game storage writes. */
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
      const d = await box('.po-deck');
      assert.ok(d.y > felt.y - 4 && d.y + d.height < felt.y + felt.height + 4, 'the deck lands on the felt');
      // next packet
      const k = centre(await box('#po-key'));
      await tap(k[0], k[1]);
      await page.waitForTimeout(200);
      await tap(felt.x + 10, felt.y + 10); // fast-forward the deal
      await phase('choose');
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('pack-opening-qa')), 'untouched');
  });
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`ok ${width}x${height}${reducedMotion ? ' reduced motion' : ''}`);
}

(async () => {
  if (!process.env.ONLY_REDUCED){ await run(390, 844, false); await run(375, 667, false); }
  await run(390, 844, true);
  console.log('Pack Opening slice 1 checks passed.');
})().catch(e => { console.error(e); process.exit(1); });
