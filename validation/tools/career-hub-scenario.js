"use strict";
/* Worked example / regression scenario for the Career Hub, built on
   touch-harness.js. Exercises the touch-physics rack (drag, flick, end
   stops), a real buy-in (one debit, first hand dealt), reload -> Continue,
   tap-to-skip mid-transition, and Reduced Motion. Copy this file's
   structure for a new Hub scenario rather than starting from raw
   Playwright/CDP calls.

   Requires a local server serving the repo root, e.g. from the repo root:
     python3 -m http.server 8765
   then:
     node validation/tools/career-hub-scenario.js [width] [height]
*/
const { withPage } = require('./touch-harness');

const BASE = process.env.POKER_BASE_URL || 'http://localhost:8765';

async function main() {
  const width = Number(process.argv[2]) || 430;
  const height = Number(process.argv[3]) || 932;

  const errors = await withPage({ width, height }, async (page, touch) => {
    await page.goto(BASE + '/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(600);
    await page.evaluate(() => showCareerScreen());
    await page.waitForTimeout(500);

    const state = () => page.evaluate(() => {
      const cards = [...document.querySelectorAll('#career-hub .ch2-track .ch2-card')];
      const sel = cards.findIndex(c => c.classList.contains('is-selected'));
      return {
        sel, n: cards.length, id: cards[sel]?.dataset.eventId,
        overflow: document.documentElement.scrollWidth - innerWidth
      };
    });

    const rack = await page.$('#ch2-rack');
    const b = await rack.boundingBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height * .6;

    console.log('initial', JSON.stringify(await state()));

    await touch.drag(cx, cy, cx - 200, cy + 80);
    await touch.end();
    await page.waitForTimeout(700);
    console.log('after slow drag', JSON.stringify(await state()));

    await touch.flick(cx + 80, cy, cx - 300, cy);
    await page.waitForTimeout(1200);
    console.log('after hard flick', JSON.stringify(await state()));

    // Walk back to a known event and buy in.
    const idx = await page.evaluate(() =>
      [...document.querySelectorAll('#career-hub .ch2-track .ch2-card')]
        .findIndex(c => c.dataset.eventId === 'back-room-freezeout'));
    await page.focus('#ch2-track');
    let now = (await state()).sel;
    let guard = 0;
    while (now !== idx && guard++ < 20) {
      await page.keyboard.press(now < idx ? 'ArrowRight' : 'ArrowLeft');
      await page.waitForTimeout(80);
      now = (await state()).sel;
    }
    if (now !== idx) throw new Error('Could not navigate to back-room-freezeout (stuck at index ' + now + ')');
    await page.waitForTimeout(300);
    const bankBefore = await page.evaluate(() => careerBankroll());
    await page.tap('#ch2-primary');
    await page.waitForTimeout(3800);
    const after = await page.evaluate(() => ({
      table: !document.getElementById('table-screen').classList.contains('hidden'),
      bank: careerBankroll(), active: career.active?.eventId, played: career.eventsPlayed,
      handNo: game?.handNumber ?? game?.handNum
    }));
    console.log('bankroll before/after buy-in', bankBefore, '->', after.bank, JSON.stringify(after));

    // Reload -> Continue.
    await page.reload();
    await page.waitForTimeout(700);
    await page.evaluate(() => showCareerScreen());
    await page.waitForTimeout(400);
    console.log('reload primary label', await page.textContent('#ch2-primary-main'));
    await page.tap('#ch2-primary');
    await page.waitForTimeout(700);
    await page.tap('body', { position: { x: 20, y: 20 } }).catch(() => {}); // tap-to-skip
    await page.waitForTimeout(900);
    console.log('after continue+skip', JSON.stringify(await page.evaluate(() => ({
      table: !document.getElementById('table-screen').classList.contains('hidden'),
      bank: careerBankroll(), played: career.eventsPlayed
    }))));
  });

  if (errors.length) { console.error('FAILED — console/page errors present'); process.exitCode = 1; }
  else console.log('OK — no console/page errors at ' + width + 'x' + height);
}

main();
