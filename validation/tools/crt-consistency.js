"use strict";
/* CRT consistency check — the rendered-style guard for the Pattern Book CRT.

   Opens the real game (Home, Career, the table, TABLE CLEARED and RUN OVER)
   and compares every CRT part against its twins, as the browser actually
   draws them:

     glass    every .crt: background, border, radius, shadow, overlays
     line     text with no role: size, weight, spacing, family, glow
     figure   .crt-figure (and --lg): the same
     caption  .crt-caption: the same, plus its dimmer ink
     ink      each meaning renders one colour everywhere

   Any difference fails, naming both screens. Mechanical-number reels,
   playing cards and lamps are their own parts and are skipped.

   Run with the local server up (see README):
     node validation/tools/crt-consistency.js [width] [height] [theme]
*/
const { withPage } = require('./touch-harness');

const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844), THEME = process.argv[4] || 'midnight';
const BASE = 'http://localhost:8765/index.html';

function collect(tag){
  const skip = el => el.closest('.crt-ghost, .card, .amt-readout, .jp-cell, .pc-lamp, .crt-lamp, .crt-cursor, .stage-ko-lamps');
  const out = { glass:[], text:[] };
  document.querySelectorAll('.crt').forEach(crt => {
    const r = crt.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    const s = getComputedStyle(crt), a = getComputedStyle(crt, '::after'), b = getComputedStyle(crt, '::before');
    const name = tag + ' · ' + (crt.id || [...crt.classList].find(c => c !== 'crt' && c !== 'pc-display' && c !== 'crt-screen'));
    out.glass.push({ name, v:[s.backgroundImage, s.backgroundColor, s.borderTopWidth, s.borderTopColor, s.borderTopLeftRadius, s.boxShadow, a.animationName, b.animationName, b.opacity].join(' | ') });
    crt.querySelectorAll('*').forEach(el => {
      if (skip(el)) return;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
      if (!own) return;
      const roleEl = el.closest('.crt-figure, .crt-caption') ;
      const role = roleEl && crt.contains(roleEl)
        ? (roleEl.classList.contains('crt-caption') ? 'caption' : roleEl.classList.contains('crt-figure--lg') ? 'figure-lg' : 'figure')
        : 'line';
      const c = getComputedStyle(el);
      out.text.push({ name, role, text:el.textContent.trim().slice(0, 18),
        type:[c.fontFamily.split(',')[0], c.fontSize, c.fontWeight, c.letterSpacing, c.textTransform, c.textShadow.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, 'C')].join(' | '),
        ink:c.color, meaning:(el.closest('[data-ink]') && crt.contains(el.closest('[data-ink]')) ? el.closest('[data-ink]').dataset.ink : (crt.dataset.ink || 'info')) + (role === 'caption' ? '/caption' : '') });
    });
  });
  return out;
}

(async () => {
  const all = { glass:[], text:[] };
  let errors = [];
  await withPage({ width:W, height:H }, async page => {
    const home = async dev => {
      await page.goto(BASE + (dev ? '?dev' : ''));
      await page.evaluate(t => { localStorage.clear(); localStorage.setItem('felt.settings', JSON.stringify({ theme:t })); }, THEME);
      await page.reload(); await page.waitForTimeout(2800); await page.mouse.click(200, 5); await page.waitForTimeout(600);
    };
    const grab = async tag => { const r = await page.evaluate(collect, tag); all.glass.push(...r.glass); all.text.push(...r.text); };
    await home(); await grab('Home');
    await page.evaluate(() => enterCareerFromHome()); await page.waitForTimeout(4500); await grab('Career');
    await home(true); await page.evaluate(() => startSinglePlayerRun());
    for (let i = 0; i < 40; i++){ await page.waitForTimeout(1000); if (await page.evaluate(() => !document.getElementById('actions-row').classList.contains('disabled'))) break; }
    await page.waitForTimeout(600); await grab('Table');
    for (const k of ['table-cleared', 'run-over']){
      await page.evaluate(k => devTestResultStage(k), k); await page.waitForTimeout(9500); await grab(k === 'run-over' ? 'Run over' : 'Table cleared');
    }
    errors = page._errors;
  });

  const fails = [];
  const compare = (label, list, key, group) => {
    const groups = {};
    list.forEach(x => (groups[group ? group(x) : 'all'] = groups[group ? group(x) : 'all'] || []).push(x));
    Object.entries(groups).forEach(([g, items]) => {
      const first = items[0];
      items.forEach(x => { if (x[key] !== first[key]) fails.push(label + (g !== 'all' ? ' [' + g + ']' : '') + ': "' + x.text + '" on ' + x.name + ' differs from "' + first.text + '" on ' + first.name + '\n      ' + x[key] + '\n   vs ' + first[key]); });
    });
  };
  // Glass ignores the results stage's own tone ink on the halo only via tokens, so all must match.
  all.glass.forEach(g => g.text = 'glass');
  compare('Glass', all.glass, 'v');
  compare('Type', all.text, 'type', x => x.role);
  // The negative results tone deliberately inks the score in danger.
  compare('Ink', all.text.filter(x => !/Run over · stage-score-hero/.test(x.name)), 'ink', x => x.meaning + ' ' + x.role);

  const roles = {};
  all.text.forEach(x => roles[x.role] = (roles[x.role] || 0) + 1);
  console.log('CRT screens checked:', all.glass.length, '| text parts:', JSON.stringify(roles), '| theme', THEME, W + 'x' + H);
  if (errors.length) console.log('Page errors:', errors);
  if (fails.length){ console.log('\nFAIL ' + fails.length + ' difference(s):\n  ' + fails.slice(0, 25).join('\n  ')); process.exit(1); }
  console.log('PASS  every CRT part matches its twins');
})();
