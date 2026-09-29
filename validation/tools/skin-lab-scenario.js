"use strict";
/* Skin Lab, played with real touch in an emulated iPhone (the card pilot,
   docs/ui/SKIN_PLAN.md). Run a local server first (python3 -m http.server
   8765), then:
     NODE_PATH=$(npm root -g) node validation/tools/skin-lab-scenario.js [outDir]

   It opens skin-lab.html, taps SKIN, walks the three tabs, loads a test
   drawing (the templates at 2x, recoloured) into slots through the
   phone's file picker, deals to the showdown and spreads the deck, and
   checks along the way that:
     - the templates (SHOW: TEMPLATES) leave every card looking as it does
       in the game (a screenshot of the table matches GAME'S OWN)
     - a loaded drawing is dressed onto every kind of card on the table
     - no page errors come from the lab or the skin
   Screenshots go to outDir (default: the OS temp folder).
*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const { withPage } = require('./touch-harness');

const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'skin-lab-shots'));
const URL = process.env.SKIN_LAB_URL || 'http://localhost:8765/skin-lab.html';
fs.mkdirSync(OUT, { recursive:true });
const fails = [];
const missing = [];   // files that failed to load
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };

(async () => {
  const errors = await withPage({ width:390, height:844, deviceScaleFactor:3 }, async (page, touch) => {
    page.on('response', r => { if (r.status() >= 400){ missing.push(r.url()); console.log('     ' + r.status() + ': ' + r.url()); } });
    await page.goto(URL);
    const frameEl = await page.waitForSelector('#skl-game');
    let g = null;
    for (let i = 0; i < 100 && !g; i++){ g = page.frames().find(f => f !== page.mainFrame()); if (!g) await page.waitForTimeout(100); }
    await g.waitForFunction(() => window.__skinLab && window.__skinLab.ready, null, { timeout:30000 });
    await g.waitForFunction(() => typeof pendingHumanPlayer !== 'undefined' && pendingHumanPlayer, null, { timeout:40000 });
    await page.waitForTimeout(1200);
    const box = await frameEl.boundingBox();
    // a tap on an element inside the game copy
    const tap = async sel => {
      const r = await g.evaluate(s => { const e = typeof s === 'string' ? document.querySelector(s) : null; if (!e) return null; e.scrollIntoView({ block:'center' }); const b = e.getBoundingClientRect(); return { x:b.left + b.width / 2, y:b.top + b.height / 2, w:b.width, h:b.height }; }, sel);
      if (!r) throw new Error('nothing to tap: ' + sel);
      await touch.start(box.x + r.x, box.y + r.y); await page.waitForTimeout(40); await touch.end();
      await page.waitForTimeout(250);
      return r;
    };
    const shot = name => page.screenshot({ path:path.join(OUT, name + '.png') });
    const tableClip = { x:box.x, y:box.y, width:box.width, height:Math.min(box.height, 760) };

    // 1. templates vs the game's own: the table must not change
    await g.evaluate(() => { __skinLab.state.show = 'off'; __skinLab.apply(); });
    await page.waitForTimeout(300);
    const own = await page.screenshot({ clip:tableClip });
    await g.evaluate(() => { __skinLab.state.show = 'templates'; __skinLab.apply(); });
    await page.waitForTimeout(300);
    const tpl = await page.screenshot({ clip:tableClip });
    fs.writeFileSync(path.join(OUT, '01-own.png'), own); fs.writeFileSync(path.join(OUT, '02-templates.png'), tpl);
    const diff = await g.evaluate(async ([a, b]) => {
      const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
      const [A, B] = await Promise.all([load(a), load(b)]);
      const px = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const da = px(A), db = px(B); let n = 0, cards = 0;
      // only where a card sits (the rest of the table animates on its own)
      const rects = [...document.querySelectorAll('.card.skin-on')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
      const dpr = A.width / innerWidth;
      for (const r of rects){
        cards++;
        for (let y = Math.max(0, Math.floor(r.top * dpr)); y < Math.min(A.height, Math.ceil(r.bottom * dpr)); y++)
          for (let x = Math.max(0, Math.floor(r.left * dpr)); x < Math.min(A.width, Math.ceil(r.right * dpr)); x++){
            const i = (y * A.width + x) * 4;
            if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 160) n++;
          }
      }
      return { n, cards, area:rects.reduce((s, r) => s + r.width * r.height * dpr * dpr, 0) | 0 };
    }, [own.toString('base64'), tpl.toString('base64')]);
    console.log('     templates vs own, over ' + diff.cards + ' cards: ' + diff.n + ' of ' + diff.area + ' screen pixels differ strongly');
    check(diff.cards >= 5 && diff.n / diff.area < 0.03, 'SHOW: TEMPLATES looks like the game\'s own cards');

    // 2. the sheet, by touch
    await tap('.skl-key');
    await page.waitForTimeout(400);
    await shot('03-templates-tab');
    check(await g.evaluate(() => document.querySelectorAll('.skl-thumb').length === 12), 'TEMPLATES shows 12 templates');
    await tap('.skl-tabs [data-tab="art"]');
    await shot('04-your-art-tab');
    check(await g.evaluate(() => document.querySelectorAll('.skl-slot').length === 9), 'YOUR ART shows 9 slots');

    // 3. load a test drawing into the L back and the M face + index
    const drawing = async (key, k) => {
      const b64 = await g.evaluate(async ([key, k]) => {
        const [t, p] = key.split('-');
        const im = new Image(); im.src = 'assets/skin/templates/cards/cards-' + t + '-' + p + '.png'; await im.decode();
        const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4){ const r = d.data[i]; d.data[i] = d.data[i + 1]; d.data[i + 1] = d.data[i + 2]; d.data[i + 2] = r; }
        x.putImageData(d, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      }, [key, k]);
      const f = path.join(OUT, 'test-' + key + '.png'); fs.writeFileSync(f, Buffer.from(b64, 'base64'));
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap('[data-act="load:' + key + '"]')]);
      await chooser.setFiles(f);
      await g.waitForFunction(key => __skinLab.state.art && __skinLab.state.art[key], key, { timeout:5000 });
      await page.waitForTimeout(300);
    };
    await drawing('L-back', 2);
    await drawing('M-face', 1);
    await drawing('M-index', 1);
    await shot('05-art-loaded');
    check(await g.evaluate(() => [...document.querySelectorAll('.skl-st.is-ok')].length === 3), 'all three drawings read as the right size (one at 2x)');

    // 4. showdown: every card on the table dressed
    await tap('.skl-tabs [data-tab="look"]');
    await tap('[data-act="play:showdown"]');
    await g.waitForFunction(() => game.phase === 'showdown' || game.over, null, { timeout:60000 });
    await page.waitForTimeout(2500);
    await shot('06-showdown');
    const dressed = await g.evaluate(() => {
      const all = [...document.querySelectorAll('#felt .card, #hud-mid .card')].filter(e => e.offsetWidth && !e.classList.contains('card-turning') && !e.classList.contains('ds-under') && getComputedStyle(e).display !== 'none');
      return { all:all.length, on:all.filter(e => e.classList.contains('skin-on')).length, faces:all.filter(e => !e.classList.contains('back') && e.classList.contains('skin-on')).length };
    });
    console.log('     showdown: ' + dressed.on + ' of ' + dressed.all + ' cards dressed, ' + dressed.faces + ' faces');
    check(dressed.all > 6 && dressed.on === dressed.all, 'every card on the table wears the skin at the showdown');

    // 5. the whole deck
    await tap('.skl-key');
    await page.waitForTimeout(400);   // the sheet slides up
    await tap('[data-act="spread"]');
    await page.waitForTimeout(400);
    await shot('07-deck');
    check(await g.evaluate(() => document.querySelectorAll('#skl-spread .card.skin-on').length === 53), 'the whole deck (52 and a back) is dressed');
    await tap('#skl-spread');
    check(await g.evaluate(() => !document.getElementById('skl-spread')), 'a tap puts the deck away');

    // 6. clearing goes back to the templates
    await tap('.skl-key');
    await page.waitForTimeout(400);
    await tap('.skl-tabs [data-tab="art"]');
    await tap('[data-act="clear:L-back"]');
    check(await g.evaluate(() => !__skinLab.state.art['L-back']), 'CLEAR removes a drawing');
  });
  // the game logs one error of its own on every load (coin-bank.js, via
  // coin-table.js), with or without the lab: not the lab's to count
  const own = (errors || []).filter(e => !/coin-bank\.js|coin-table\.js/.test(e));
  check(missing.length === 0, 'every file the lab asks for is there' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''));
  check(own.length === 0, 'no page errors from the lab or the skin' + (own.length ? ': ' + own.join(' | ') : ''));
  console.log('\nScreenshots: ' + OUT);
  if (fails.length){ console.log(fails.length + ' FAILED'); process.exit(1); }
  console.log('All checks passed.');
})().catch(e => { console.error(e); process.exit(1); });
