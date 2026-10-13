/* Career desk lab: touch checks, separate from `npm test`.
   Start a server at the repo root (python3 -m http.server 8768), then:
     node validation/career-hub-checks.cjs
   CAREER_HUB_URL overrides the page. Real emulated touch through
   validation/tools/touch-harness.js: three cards dealt; carry one into
   the slot, PAY, the table plays, the card is used up and replaced;
   PLAY twice; a card's inspect screen and BUY IN; the bell to the shop,
   a packet bought and kept, back to the desk with the new card on it;
   the case to the album and a design's history; the matchbooks, the
   lamp, the chips; a small phone, reduced motion, no game storage writes. */
'use strict';
const assert = require('node:assert/strict');
const { withPage } = require('./tools/touch-harness');
const url = process.env.CAREER_HUB_URL || 'http://127.0.0.1:8768/career-hub-lab.html';

async function run(width, height, reducedMotion){
  const errors = await withPage({ width, height, reducedMotion }, async (page, touch) => {
    await page.goto(url);
    const g = page.locator('#pk-game').contentFrame();
    await g.locator('#po').waitFor();
    const fr = page.frames()[1];
    const state = () => fr.evaluate(() => PackOpening.state);
    // the desk is idle, and a freshly dealt card has had a frame to land
    const desk = () => fr.waitForFunction(() => { const s = PackOpening.state; return s.view === 'hub' && !s.desk.busy && s.desk.cards === 3 && !s.inspecting; }, null, { timeout:20000 })
      .then(() => page.waitForTimeout(250))
      .catch(async () => { throw new Error('waiting for the desk, state ' + JSON.stringify(await state())); });
    const box = async sel => { const r = await g.locator(sel).first().boundingBox(); assert.ok(r, sel + ' visible'); return r; };
    const centre = r => [r.x + r.width / 2, r.y + r.height / 2];
    const tap = async (x, y) => { await touch.start(x, y); await page.waitForTimeout(30); await touch.end(); };
    await page.evaluate(() => localStorage.setItem('career-hub-qa', 'untouched'));

    await desk();
    let s = await state();
    assert.equal(s.desk.cards, 3, 'three cards on the desk');
    assert.equal(new Set(s.desk.why).size, 3, 'each card dealt for its own reason');

    // carry the middle card into the slot: it bites; PAY plays it
    const c = centre(await g.locator('.hd .ec-card').nth(1).boundingBox()), slit = centre(await box('.hd-slit'));
    await touch.drag(c[0], c[1], slit[0], slit[1] + 70, 10, 20); await touch.end();
    await fr.waitForFunction(() => PackOpening.state.desk.bitten && !PackOpening.state.desk.busy, null, { timeout:5000 });
    const before = await state();
    assert.match(await g.locator('#po-play').textContent(), /^PAY \$/, 'the key asks to pay');
    await tap(...centre(await box('#po-play')));
    await desk();
    s = await state();
    assert.equal(s.played, before.played + 1, 'the table was played');
    assert.equal(s.held, before.held - 1, 'the card was used up');

    // PLAY twice: the first puts tonight's best card in the slot, the second pays
    await tap(...centre(await box('#po-play')));
    await fr.waitForFunction(() => PackOpening.state.desk.bitten && !PackOpening.state.desk.busy, null, { timeout:5000 });
    await tap(...centre(await box('#po-play')));
    await desk();
    assert.equal((await state()).played, s.played + 1);

    // a card's inspect screen: BUY IN plays it
    s = await state();
    await tap(...centre(await g.locator('.hd .ec-card').nth(2).boundingBox()));
    await fr.waitForFunction(() => PackOpening.state.inspecting, null, { timeout:5000 });
    await page.waitForTimeout(600);
    assert.equal(await g.locator('#ci .ci-key').textContent(), 'BUY IN');
    await tap(...centre(await box('#ci .ci-key')));
    await desk();
    assert.equal((await state()).played, s.played + 1, 'BUY IN played the card');

    // the matchbooks, the lamp, the chips
    await tap(...centre(await box('.hd-match:not(.is-empty)')));
    await fr.waitForFunction(() => document.querySelector('.hd-match.is-open'), null, { timeout:3000 });
    await tap(...centre(await box('.hd-lamp')));
    assert.equal((await state()).desk.lamp, false, 'the lamp goes off');
    await tap(...centre(await box('.hd-lamp')));
    await tap(...centre(await box('.hd-chips')));

    // the bell: the shop; buy a packet by the key, open it, keep it, back to the desk
    await tap(...centre(await box('.hd-bell')));
    const phase = p => fr.waitForFunction(v => PackOpening.state.view === 'packs' && PackOpening.state.phase === v && !PackOpening.state.lock, p, { timeout:15000 })
      .catch(async () => { throw new Error('waiting for ' + p + ', state ' + JSON.stringify(await state())); });
    await phase('choose');
    const held0 = (await state()).held;
    await tap(...centre(await box('.po-packet[data-series=house] .po-pk-front'))); await phase('selected');
    const k = centre(await box('#po-key'));
    await touch.start(k[0], k[1]); await page.waitForTimeout(1000); await touch.end();
    await phase('sealed');
    await tap(...k); await phase('open'); await tap(...k); await phase('deck');
    await tap(...k);
    for (let i = 0; i < 4; i++){ await phase('shown'); await tap(...k); }
    await phase('haul');
    await tap(...k); await phase('choose');
    assert.equal((await state()).held, held0 + 4, 'four cards went into the case');
    await tap(...centre(await box('#po-back')));
    await desk();
    assert.ok((await state()).desk.why.includes('NEW'), 'a new card is on the desk');

    // the case: the album, and a design's history
    await tap(...centre(await box('.hd-case')));
    await fr.waitForFunction(() => PackOpening.state.view === 'album', null, { timeout:8000 });
    await page.waitForTimeout(400);
    await tap(...centre(await box('.po-album .po-mini:not(.is-unfound)')));
    await fr.waitForFunction(() => PackOpening.state.inspecting && document.querySelectorAll('#ci .ci-line').length >= 2, null, { timeout:5000 });
    assert.match(await g.locator('#ci .ci-crt').textContent(), /PLAYED|NOT PLAYED YET/, 'the album shows your history');
    await page.waitForTimeout(500);
    await fr.evaluate(() => CardInspect.close());
    await fr.waitForFunction(() => !PackOpening.state.inspecting, null, { timeout:5000 });
    await tap(...centre(await box('#po-back')));
    await desk();

    assert.equal(await page.evaluate(() => localStorage.getItem('career-hub-qa')), 'untouched');
  });
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`ok ${width}x${height}${reducedMotion ? ' reduced motion' : ''}`);
}

(async () => {
  if (!process.env.ONLY_REDUCED){ await run(390, 844, false); await run(375, 667, false); }
  await run(390, 844, true);
  console.log('Career desk checks passed.');
})().catch(e => { console.error(e); process.exit(1); });
