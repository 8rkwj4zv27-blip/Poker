#!/usr/bin/env node
"use strict";
/* The table sweep: every Career invitation event seated at each phone
   size, in the game itself (index.html), checked for parts of the table
   lying on top of each other. The owner found the hand counter sitting
   on a face (13 Oct 2026) because only some tables had ever been looked
   at; this looks at all of them.

   For each event × size: a fresh new Career, the card played, the first
   hand dealt with the table powered up; then every pair of the parts that
   must never overlap is measured (the event clock against the seats and
   their bet squares, the board's tray, the deck and P.I.P.; the seats
   against each other). With --shots, a screenshot of each and one contact
   sheet of them all (contact-sheet.js) to look over by eye. Then the
   clock is handled with real touch: dropped on a seat, flicked, tapped,
   and its place kept across a reload.

     node validation/tools/table-sweep.js [--sizes 390x844,375x667,430x932] [--events id,id] [--shots DIR]
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
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
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// measured in the page: every pair that must stay apart
function measure(){
  const box = n => { const r = n.getBoundingClientRect(); return { x:r.left, y:r.top, w:r.width, h:r.height }; };
  const meet = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const name = n => n.id ? '#' + n.id : '.' + [...n.classList].slice(0, 2).join('.');
  const vis = n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden'; };
  const felt = document.getElementById('felt');
  const parts = sel => [...felt.querySelectorAll(sel)].filter(vis);
  const clock = document.getElementById('event-clock');
  const out = [];
  if (!clock || !vis(clock)) out.push('no event clock on the felt');
  else {
    const c = box(clock);
    parts('.seat, .ec-square, .ct-tray, .dealer-station, #coach-station, .pot-area:not(.hidden)')
      .forEach(n => { if (meet(c, box(n))) out.push('the event clock covers ' + name(n)); });
    const f = box(felt);
    if (c.x < f.x - 1 || c.y < f.y - 1 || c.x + c.w > f.x + f.w + 1 || c.y + c.h > f.y + f.h + 1) out.push('the event clock is off the felt');
  }
  const seats = parts('.seat');
  seats.forEach((a, i) => seats.slice(i + 1).forEach(b => { if (meet(box(a), box(b))) out.push('two seats overlap'); }));
  // every face-up card's rank and suit in its top-left corner: the album's
  // inspect screen once took the same class name (.ci) and spread the
  // corner across the whole card, centring the rank (v0.71.0)
  [...document.querySelectorAll('.card:not(.back) .ci')].filter(vis).forEach(n => {
    const c = box(n.closest('.card')), r = box(n);
    if (r.x < c.x - 1 || r.y < c.y - 1 || r.h > c.h * .7) out.push('a card\'s rank and suit are out of its corner');
  });
  return { problems:out, clock:clock ? clock.textContent : null };
}

async function sweep(base, width, height, ids){
  const found = [];
  const errors = await withPage({ width, height }, async page => {
    for (const id of ids){
      await page.goto(base + '/index.html');
      await page.evaluate(ev => {
        localStorage.clear();
        localStorage.setItem('felt.settings', JSON.stringify({ seenIntro:true, seenTour:true }));
      }, id);
      await page.reload();
      await page.waitForFunction(() => window.CareerLink && typeof careerEventById === 'function', null, { timeout:30000 });
      await page.evaluate(ev => {
        career.invitations = [{ id:'inv-sweep', eventId:ev, rarity:careerEventById(ev).rarity, roster:null }];
        career.packets = []; career.starterGiven = true; saveCareer();
        CareerLink.play(CareerLink.pool()[0]);
      }, id);
      // the first hand dealt, the table powered up (the intro holds the deal)
      await page.waitForFunction(() => game && game.mode === 'career' && game.handNumber >= 1 && game.phase !== 'setup'
        && !document.getElementById('table-screen').classList.contains('hidden')
        && !document.getElementById('table-screen').classList.contains('ti-primed'), null, { timeout:60000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const m = await page.evaluate(measure);
      found.push({ id, size:width + 'x' + height, ...m });
      if (SHOTS) await page.screenshot({ path:path.join(SHOTS, 'sweep-' + width + 'x' + height + '-' + id + '.png') });
    }
  });
  return { found, errors };
}

// Picking it up, with real touch: dropped on a seat it's nudged clear;
// flicked, it slides and stays on the felt; its place is kept, and is
// still there after a reload
async function handle(base){
  const out = [];
  const errors = await withPage({ width:390, height:844 }, async (page, touch) => {
    const seat = async id => {
      await page.evaluate(ev => {
        career.invitations = [{ id:'inv-sweep', eventId:ev, rarity:'common', roster:null }];
        career.packets = []; career.starterGiven = true; saveCareer();
        CareerLink.play(CareerLink.pool()[0]);
      }, id);
      await page.waitForFunction(() => game && game.phase !== 'setup' && document.getElementById('event-clock')
        && !document.getElementById('table-screen').classList.contains('ti-primed'), null, { timeout:60000 });
      await page.waitForTimeout(1500);
    };
    await page.goto(base + '/index.html');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('felt.settings', JSON.stringify({ seenIntro:true, seenTour:true })); });
    await page.reload();
    await page.waitForFunction(() => window.CareerLink, null, { timeout:30000 });
    await seat('back-room-invite');
    const centre = async sel => { const r = await page.locator(sel).first().boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const ok = () => page.evaluate(measure);
    // carried slowly onto a seat and let go
    const [cx, cy] = await centre('#event-clock'), [sx, sy] = await centre('#felt .seat');
    await touch.drag(cx, cy, sx, sy, 20, 30); await page.waitForTimeout(150); await touch.end();
    await page.waitForTimeout(700);
    let m = await ok();
    out.push(['dropped on a seat, it moves clear of it', !m.problems.length, m.problems.join('; ')]);
    // flicked hard across the felt
    const [fx, fy] = await centre('#event-clock');
    await touch.drag(fx, fy, fx + 160, fy + 120, 3, 8); await touch.end();
    await page.waitForTimeout(2500);
    m = await ok();
    out.push(['flicked, it slides, knocks off the rails and stays on the felt', !m.problems.length, m.problems.join('; ')]);
    // a tap on it is not a touch on the table
    const before = await page.evaluate(() => [game.phase, game.handNumber, pendingHumanPlayer && pendingHumanPlayer.id]);
    const [tx, ty] = await centre('#event-clock');
    await touch.start(tx, ty); await page.waitForTimeout(40); await touch.end(); await page.waitForTimeout(400);
    const after = await page.evaluate(() => [game.phase, game.handNumber, pendingHumanPlayer && pendingHumanPlayer.id]);
    out.push(['a tap on it does nothing at the table', JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after)]);
    // its place is kept, and is where it comes back after a reload
    const kept = await page.evaluate(() => ({ s:settings.eventClock, p:EventClock.pos }));
    await page.reload();
    await page.waitForFunction(() => window.CareerLink && careerHasActiveEvent(), null, { timeout:30000 });
    await page.evaluate(() => CareerLink.resume());
    await page.waitForFunction(() => game && game.phase !== 'setup' && document.getElementById('event-clock')
      && !document.getElementById('table-screen').classList.contains('ti-primed'), null, { timeout:60000 });
    await page.waitForTimeout(1500);
    const back = await page.evaluate(() => EventClock.pos);
    out.push(['its place is kept across a reload', !!kept.s && Math.abs(back.x - kept.p.x) < 2 && Math.abs(back.y - kept.p.y) < 2,
      JSON.stringify(kept.s) + ' ' + JSON.stringify(back)]);
  });
  const errs = errors.filter(e => !/vibrate|favicon|status of 404/.test(e));
  out.push(['no JavaScript errors while handled', !errs.length, errs.join(' · ')]);
  return out;
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive:true });
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const src = fs.readFileSync(path.join(ROOT, 'js/04-modes-and-scoring.js'), 'utf8');
  const all = [...src.slice(src.indexOf('const CAREER_INVITATION_EVENTS'), src.indexOf('const CAREER_INVITATIONS_LIMIT')).matchAll(/id:'([a-z0-9-]+)'/g)].map(m => m[1]);
  const ids = arg('events', null) ? arg('events').split(',') : all;
  let bad = 0;
  try {
    for (const [w, h] of SIZES){
      const { found, errors } = await sweep(base, w, h, ids);
      for (const f of found){
        const ok = !f.problems.length;
        if (!ok) bad++;
        console.log((ok ? 'ok    ' : 'FAIL  ') + f.size.padEnd(8) + ' ' + f.id.padEnd(18) + ' clock ' + String(f.clock).padEnd(12) + (ok ? '' : f.problems.join('; ')));
      }
      const errs = errors.filter(e => !/vibrate|favicon|status of 404/.test(e));
      if (errs.length){ bad++; console.log('FAIL  ' + w + 'x' + h + ' JavaScript errors: ' + errs.join(' · ')); }
    }
    for (const [name, pass, detail] of await handle(base)){
      if (!pass) bad++;
      console.log((pass ? 'ok    ' : 'FAIL  ') + name + (pass || !detail ? '' : '  (' + detail + ')'));
    }
  } finally { server.close(); }
  if (SHOTS){
    try { execFileSync(process.execPath, [path.join(__dirname, 'contact-sheet.js'), SHOTS, path.join(SHOTS, 'sweep-sheet.png'), 'sweep-', '5']); console.log('contact sheet: ' + path.join(SHOTS, 'sweep-sheet.png')); }
    catch (e) { console.log('(no contact sheet: ' + e.message.split('\n')[0] + ')'); }
  }
  console.log(bad ? '\nTable sweep FAILED.' : '\nTable sweep passed: every invitation, every size, nothing on top of anything.');
  process.exit(bad ? 1 : 0);
})();
