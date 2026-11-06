#!/usr/bin/env node
"use strict";
/* The moments library: every screen and moment a player sees, photographed
   in the game itself (index.html) in an emulated iPhone, for the owner to
   go through one by one (the moments lab, moments-lab.html).

   Each flow starts from its own fresh save and drives the game the way
   the other tools do: real taps on the real keys, and the DEV helpers
   (js/08-dev-mode.js) only where a moment can't be dealt on demand (a
   won hand, a K.O., a bust, the result stages). A flow that stops early
   keeps what it already took and the run carries on with the next one.

   Writes <out>/<id>.jpg for every moment, <out>/moments.json (id, group,
   title, what the player is looking at) and <out>/moments.html, the
   gallery (moments-page.html with the list baked in), which is what gets
   published as the owner's Artifact link: file_path <out>/moments.html,
   root <out>, files every .jpg. Not part of `npm test`.

     node validation/tools/moments.js [--out DIR] [--size 390x844] [--only flow,flow]
     node validation/tools/moments.js --out DIR --page-only    (rebuild the gallery)
     node validation/tools/moments.js --out DIR --video        (the motion clips)

   --video plays the same flows again while Playwright records them (no
   stills, so nothing stalls the motion), notes when each moment would have
   been shot, and cuts the CLIPS below out of the recording with ffmpeg
   (H.264 .mp4, which plays on an iPhone). Each clip joins the gallery in
   its moment's group, after a stills run (moments.json) exists.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { withPage } = require('./touch-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = path.resolve(arg('out', 'moments'));
const [W, H] = arg('size', '390x844').split('x').map(Number);
const ONLY = arg('only', null);
const PAGE_ONLY = process.argv.includes('--page-only');
const VIDEO = process.argv.includes('--video');
/* The motion clips: from one moment to another, with a little either side
   (seconds). Each clip's poster is its first moment's still. */
const CLIPS = [
  { id:'clip-boot', group:'Main menu', title:'The cabinet switching on', from:'menu-boot', pre:1.2, to:'menu', post:0.3 },
  { id:'clip-tour', group:'First run', title:'The first-run tour, tapped through', from:'tour-1', pre:2.5, to:'tour-7', post:1 },
  { id:'clip-to-table', group:'Table arrival', title:'Menu → Quick Deal table → the deal', from:'qd-roll', pre:1, to:'hand-preflop', post:0.5 },
  { id:'clip-streets', group:'A hand', title:'Checking through flop, turn and river', from:'hand-flop', pre:0.5, to:'win-showdown', post:0.3 },
  { id:'clip-award', group:'Hand won', title:'Showdown won, AWARD POT, into the bank', from:'win-showdown', pre:0.5, to:'win-next', post:0.8 },
  { id:'clip-fold', group:'Folding', title:'Folding, and the hand going on without you', from:'fold', pre:1, to:'fold-end', post:0.8 },
  { id:'clip-allin', group:'All in', title:'All in: the runout and the pot paid', from:'allin-confirm', pre:0.3, to:'ko-4', post:0.8 },
  { id:'clip-ko', group:'K.O.', title:'K.O. ejection', from:'ko-eject-1', pre:0.6, to:'ko-eject-5', post:1.5 },
  { id:'clip-cleared', group:'Table cleared', title:'Table cleared → NEXT TABLE → table 2', from:'cleared-1', pre:0.8, to:'next-table-2', post:1.5 },
  { id:'clip-runover', group:'Run over', title:'Busted → run over', from:'bust-showdown', pre:0.5, to:'runover-console', post:1 },
  { id:'clip-pip', group:'P.I.P.', title:'P.I.P.\'s report playing through', from:'pip-keys', pre:0.3, to:'pip-report-2', post:1.5 },
  { id:'clip-to-career', group:'Career', title:'Menu → Career hub', from:'nc-roll', pre:1, to:'nc-hub-first', post:0.5 },
  { id:'clip-packet', group:'Packets', title:'Opening the starter packet', from:'nc-packet-sealed', pre:0.8, to:'nc-deck', post:0.5 },
  { id:'clip-cards', group:'Packets', title:'Turning the cards and adding them', from:'nc-deck', pre:0.2, to:'nc-redeal', post:0.5 },
  { id:'clip-play', group:'Career event', title:'Drag to the feeder, PLAY, to the table', from:'nc-dealt', pre:0.3, to:'nc-event-table', post:0.5 },
  { id:'clip-event-won', group:'Career result', title:'Event won → back at the hub', from:'nc-won-1', pre:0.8, to:'nc-back-2', post:0.5 },
  { id:'clip-album', group:'Album', title:'The album coming up', from:'nc-album', pre:1.5, to:'nc-album-card', post:0.8 },
  { id:'clip-shop', group:'Shop', title:'The packet machine: choose, buy, the drop', from:'nc-shop', pre:1, to:'nc-hub-packet', post:0.5 }
];
const ffmpeg = () => ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(f => fs.existsSync(f));
// what the owner should know about a whole part of the game
const GROUP_NOTES = {
  'A hand':'Quick Deal with Auto-Continue off, so every hand stops on NEXT HAND. Opponents\' table talk is switched off in the code right now (bubblesAllowed), so no talk bubbles appear anywhere.',
  'K.O.':'The ejection is the game\'s own K.O. animation (playElimination), started with the DEV preview. In a Quick Deal run an opponent whose stack hits $0 came back next hand with a new stack.',
  'Career result':'Wins and losses were forced with the DEV helpers (END TABLE, BUST ME), through the real result screens.',
};
const ORDER = ['Main menu', 'Settings', 'Workshop', 'First run', 'Table arrival', 'Table sizes', 'A hand', 'Hand won', 'Hand lost', 'Folding', 'All in', 'K.O.',
  'At the table', 'Table cleared', 'Run over', 'P.I.P.', 'Career', 'Packets', 'Career event', 'Career result', 'Album', 'Shop', 'Custom Game', 'Stopped'];

/* The gallery: moments-page.html with the moments (in the game's order) baked in. */
function writePage(){
  const list = JSON.parse(fs.readFileSync(path.join(OUT, 'moments.json'), 'utf8'));
  const rank = g => { const i = ORDER.indexOf(g); return i < 0 ? 99 : i; };
  const ms = list.moments.map((m, i) => [m, i]).sort((a, b) => rank(a[0].group) - rank(b[0].group) || a[1] - b[1]).map(x => x[0]);
  const build = (fs.readFileSync(path.join(ROOT, 'js', '02-support-systems.js'), 'utf8').match(/BUILD_VERSION = '([^']+)'/) || [])[1] || '';
  const clipFile = path.join(OUT, 'clips.json');
  const clips = fs.existsSync(clipFile) ? JSON.parse(fs.readFileSync(clipFile, 'utf8')) : [];
  clips.forEach(c => { // after the group's last still
    let at = -1; ms.forEach((m, i) => { if (m.group === c.group) at = i; });
    ms.splice(at + 1, 0, c);
  });
  const data = JSON.stringify({ build:build.split(' ·')[0], size:list.size, taken:list.taken, groupNotes:GROUP_NOTES, moments:ms }).replace(/</g, '\\u003c');
  const page = fs.readFileSync(path.join(__dirname, 'moments-page.html'), 'utf8').replace('__DATA__', () => data);
  fs.writeFileSync(path.join(OUT, 'moments.html'), page);
  console.log('gallery → ' + path.join(OUT, 'moments.html') + ' (' + ms.length + ' moments)');
}
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.PNG':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

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

const moments = [];
const log = [];
const clipsMade = [];

/* Cut every clip whose two moments this flow's recording holds. */
function cutClips(webm, marks){
  const { execFileSync } = require('child_process');
  const bin = ffmpeg();
  if (!bin){ log.push('no ffmpeg: clips not cut'); return; }
  CLIPS.filter(c => marks[c.from] != null && marks[c.to] != null).forEach(c => {
    const from = Math.max(0, marks[c.from] - c.pre), to = marks[c.to] + c.post;
    const file = c.id + '.mp4';
    try {
      execFileSync(bin, ['-y', '-loglevel', 'error', '-ss', from.toFixed(2), '-to', to.toFixed(2), '-i', webm,
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, file)]);
      clipsMade.push({ id:c.id, group:c.group, title:c.title, note:'Motion: ' + (to - from).toFixed(1) + 's.', file, poster:c.from + '.jpg', video:true });
      console.log('  clip ' + c.id + ' (' + (to - from).toFixed(1) + 's)');
    } catch (e){ log.push('clip ' + c.id + ': ' + String(e.message).split('\n')[0]); }
  });
}

/* The page helpers every flow shares. */
function kit(page, touch, flow){
  const k = {
    t0:Date.now(), marks:{},
    wait: ms => page.waitForTimeout(ms),
    js: (fn, a) => page.evaluate(fn, a),
    async until(fn, what, ms = 30000, a){
      const t = Date.now();
      while (Date.now() - t < ms){ if (await page.evaluate(fn, a).catch(() => false)) return true; await page.waitForTimeout(120); }
      throw new Error('waiting for ' + what);
    },
    async soft(fn, what, ms, a){ try { return await k.until(fn, what, ms, a); } catch (e){ log.push(flow + ': gave up ' + what); return false; } },
    async box(sel){ const r = await page.locator(sel).first().boundingBox(); if (!r) throw new Error(sel + ' not visible'); return r; },
    async tap(sel){ const r = await k.box(sel); const x = r.x + r.width / 2, y = r.y + r.height / 2;
      await touch.start(x, y); await page.waitForTimeout(40); await touch.end(); await page.waitForTimeout(120); },
    async tapXY(x, y){ await touch.start(x, y); await page.waitForTimeout(40); await touch.end(); await page.waitForTimeout(120); },
    async shot(id, group, title, note, opts){
      if (VIDEO){ k.marks[id] = (Date.now() - k.t0) / 1000; return; }
      const file = id + '.jpg';
      await page.screenshot(Object.assign({ path:path.join(OUT, file), type:'jpeg', quality:82 }, opts || {}));
      moments.push({ id, group, title, note, file, flow });
      console.log('  shot ' + id);
    },
    async boot(settings, extra){
      await page.goto(k.base + '/index.html');
      await page.evaluate(([s, x]) => {
        localStorage.clear();
        localStorage.setItem('felt.settings', JSON.stringify(s));
        Object.entries(x || {}).forEach(([key, v]) => localStorage.setItem(key, v));
      }, [settings, extra]);
      await page.reload();
      await page.waitForFunction(() => typeof game !== 'undefined' && document.getElementById('home'), null, { timeout:30000 });
    }
  };
  return k;
}

// The key a player would press next at the table (the play-test's rule).
function nextKey(){
  const vis = e => e && !e.classList.contains('hidden') && e.offsetParent !== null && !e.disabled;
  const nextHand = document.getElementById('btn-next-hand');
  if (vis(nextHand)) return '#btn-next-hand';
  const award = document.getElementById('btn-award-pot-console');
  if (vis(award) && /showdown/i.test(award.textContent)) return '#btn-award-pot-console';
  if (document.getElementById('console-flip').classList.contains('flipped')) return vis(award) ? '#btn-award-pot-console' : null;
  const row = document.getElementById('actions-row');
  if (row && !row.classList.contains('disabled') && vis(document.getElementById('btn-checkcall'))) return '#btn-checkcall';
  return null;
}
const yourTurn = () => { const row = document.getElementById('actions-row'); const b = document.getElementById('btn-checkcall');
  return !!(row && !row.classList.contains('disabled') && b && b.offsetParent && !b.disabled && typeof pendingHumanPlayer !== 'undefined' && pendingHumanPlayer); };
const awardUp = () => { const b = document.getElementById('btn-award-pot-console'); return !!(b && b.offsetParent && !b.disabled && document.getElementById('console-flip').classList.contains('flipped')); };
const nextUp = () => { const b = document.getElementById('btn-next-hand'); return !!(b && b.offsetParent && !b.disabled && !b.classList.contains('hidden')); };

/* ---------------- the flows ---------------- */

/* Play on with the player's own keys until `stop` is true (or `ms` runs out). */
async function playUntil(k, stop, ms = 60000, act){
  const t = Date.now();
  while (Date.now() - t < ms){
    if (await k.js(stop).catch(() => false)) return true;
    if (act) await k.js(act).catch(() => {});
    const key = await k.js(nextKey).catch(() => null);
    if (key) await k.tap(key).catch(() => {});
    await k.wait(220);
  }
  return false;
}
/* Shoot a scrolling screen a page at a time (its own scroller, found inside `sel`). */
async function pages(k, sel, id, group, title, note, max = 6){
  const n = await k.js(([s]) => {
    const root = document.querySelector(s);
    const all = [root, ...root.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    const el = all.sort((a, b) => b.clientHeight - a.clientHeight)[0];
    if (!el) return 1;
    window.__scroller = el; el.scrollTop = 0;
    return Math.ceil((el.scrollHeight - el.clientHeight) / (el.clientHeight * 0.8)) + 1;
  }, [sel]);
  for (let i = 0; i < Math.min(n, max); i++){
    if (i) { await k.js(i => { const e = window.__scroller; e.scrollTop = Math.round(e.clientHeight * 0.8 * i); }, i); await k.wait(450); }
    await k.shot(id + (n > 1 ? '-' + (i + 1) : ''), group, title + (n > 1 ? ' (' + (i + 1) + '/' + Math.min(n, max) + ')' : ''), i ? 'Scrolled further down.' : note);
  }
  await k.js(() => { if (window.__scroller) window.__scroller.scrollTop = 0; });
}
const SEEN = { seenIntro:true, seenTour:true };
// DEV BUST ME, with its opponent made to call your shove (evaluated in the page)
function bust(){ DEV_MODE = true; const t = game.players.find(p => !p.isHuman && p.inHand && !p.folded && !p.eliminated);
  devBustMe(); if (t && !t.allIn) t._devForceAllIn = true; }
// rig the deck for you, or for an opponent still in (evaluated in the page)
function rig(who){ DEV_MODE = true; const t = who === 'you' ? game.players.find(p => p.isHuman)
  : game.players.find(p => !p.isHuman && p.inHand && !p.folded); devRigForWinner(t); }

const FLOWS = {
  // The menu and everything reached from it.
  async front(k){
    await k.boot(Object.assign({}, SEEN));
    await k.wait(700);
    await k.shot('menu-boot', 'Main menu', 'Switching on', 'The cabinet powering up when the app opens (part way through).');
    await k.wait(3400);
    await k.shot('menu', 'Main menu', 'Main menu', 'The lit menu: Career, Custom Game, Quick Deal, Hand Rankings, Save Data, Workshop.');
    await k.tap('#open-rankings'); await k.wait(1200);
    await pages(k, '#rankings', 'rankings', 'Main menu', 'Hand Rankings', 'From the menu.');
    await k.tap('#rankings-back'); await k.wait(1500);
    await k.tap('#go-to-setup'); await k.wait(1500);
    await pages(k, '#setup', 'setup', 'Main menu', 'Custom Game', 'Setting up your own table: game type, table size, difficulty, stakes.');
    await k.tap('#setup-back'); await k.wait(1500);
    await k.tap('#home-settings'); await k.wait(1000);
    await pages(k, '#settings-sheet', 'settings', 'Settings', 'Settings', 'Opened from the menu\'s ⚙.', 12);
    await k.tap('#settings-back'); await k.wait(1200);
    await k.tap('#open-save'); await k.wait(1200);
    await k.shot('save-data', 'Settings', 'Save Data', 'The menu\'s Save Data key: Settings opened on its plate.');
    await k.js(() => closeOverlays()); await k.wait(1200);
    await k.js(() => document.getElementById('open-workshop').click());
    await k.until(() => { const w = document.getElementById('workshop'); return w && !w.classList.contains('hidden'); }, 'the Workshop', 15000);
    await k.wait(1500);
    const tabs = await k.js(() => [...document.querySelectorAll('#workshop [data-ws-tab]')].filter(b => b.tagName === 'BUTTON').map(b => [b.dataset.wsTab, b.textContent.trim()]));
    for (const [tab, name] of tabs){
      await k.js(t => document.querySelector('#workshop button[data-ws-tab="' + t + '"]').click(), tab); await k.wait(1600);
      await pages(k, '#workshop', 'workshop-' + tab, 'Workshop', 'Workshop: ' + name, 'The Workshop (skins), from the menu.', 3);
    }
  },

  // The first launch: the tour.
  async firstrun(k){
    await k.boot({});
    await k.wait(4500);
    await k.tap('#quick-play');
    await k.soft(() => { const c = document.querySelector('.tour-card'); return c && c.offsetParent && !c.closest('.hidden'); }, 'the tour', 20000);
    await k.wait(900);
    for (let i = 1; i <= 10; i++){
      await k.shot('tour-' + i, 'First run', 'First-run tour: step ' + i, i === 1 ? 'A brand-new player\'s first Quick Deal: the tour over the table.' : '');
      const label = await k.js(() => { const n = document.querySelector('.tour-next'); return n && n.offsetParent ? n.textContent : null; });
      if (!label || /play/i.test(label)) break;
      await k.tap('.tour-next'); await k.wait(1100);
    }
  },

  // Quick Deal: one table, hand by hand, every way a hand can end.
  async quickdeal(k){
    await k.boot(Object.assign({}, SEEN, { autoDeal:false }));
    await k.wait(3800);
    await k.tap('#quick-play');
    await k.wait(700);
    await k.shot('qd-roll', 'Table arrival', 'Menu → table', 'The screen change from the menu to a Quick Deal table (part way).');
    await k.wait(1100);
    await k.shot('qd-powerup', 'Table arrival', 'Table intro card', 'The table powering up: the card naming the table, blinds, seats.');
    await k.wait(1500);
    await k.shot('qd-deal', 'Table arrival', 'The deal', 'Cards flying out for the first hand.');
    await k.until(yourTurn, 'your first turn', 40000);
    await k.js(rig, 'you');
    await k.wait(500);
    await k.shot('hand-preflop', 'A hand', 'Your turn: pre-flop', 'Your two cards, the console live: FOLD / CALL / RAISE.');
    await k.tap('#btn-raise'); await k.wait(800);
    await k.shot('hand-raise', 'A hand', 'Raise panel', 'RAISE pressed: sizes, the wheel, CONFIRM.');
    await k.tap('#raise-cancel'); await k.wait(500);
    const seen = new Set(['preflop']);
    for (let t = 0; t < 400; t++){
      const s = await k.js(() => ({ phase:game.phase, turn:!!pendingHumanPlayer }));
      if (s.turn && !seen.has(s.phase)){ seen.add(s.phase); await k.wait(500);
        await k.shot('hand-' + s.phase, 'A hand', 'Your turn: the ' + s.phase, ''); }
      if (await k.js(awardUp) || await k.js(nextUp)) break;
      const key = await k.js(nextKey);
      if (key === '#btn-checkcall') await k.tap(key);
      await k.wait(220);
    }
    // a showdown you win
    await k.shot('win-showdown', 'Hand won', 'Showdown: you win', 'The cards shown, your hand named, the AWARD POT key.');
    await k.wait(1500);
    await k.shot('win-showdown-held', 'Hand won', 'Showdown: waiting for AWARD POT', 'A moment later, nothing pressed.');
    if (await k.js(awardUp)){
      await k.tap('#btn-award-pot-console');
      await k.wait(500);  await k.shot('win-award-1', 'Hand won', 'AWARD POT: the pot goes off', 'Just after pressing AWARD POT.');
      await k.wait(900);  await k.shot('win-award-2', 'Hand won', 'AWARD POT: chips flying', '');
      await k.wait(1400); await k.shot('win-award-3', 'Hand won', 'AWARD POT: into the bank', '');
    }
    await k.soft(nextUp, 'NEXT HAND', 20000);
    await k.wait(600);
    await k.shot('win-next', 'Hand won', 'Hand over: NEXT HAND', 'Between hands, the console waiting for NEXT HAND.');
    await k.tap('#btn-next-hand');

    // a showdown you lose
    await k.until(yourTurn, 'your turn', 40000);
    await k.js(rig, 'them');
    await playUntil(k, awardUp, 60000);
    await k.wait(300);
    const split = await k.js(() => /split/i.test(document.getElementById('console-flip').textContent));
    if (split) await k.shot('split-showdown', 'Hand won', 'Showdown: a split pot', 'The board played for more than one of you: SPLIT.');
    else await k.shot('lose-showdown', 'Hand lost', 'Showdown: you lose', 'Their cards win; the key pays them.');
    await k.tap('#btn-award-pot-console').catch(() => {});
    await k.wait(900); await k.shot(split ? 'split-pay' : 'lose-pay', split ? 'Hand won' : 'Hand lost', split ? 'Split pot: paying out' : 'Paying the winner', split ? '' : 'The pot going to their seat.');
    await playUntil(k, nextUp, 30000); await k.wait(500);
    await k.shot(split ? 'split-next' : 'lose-next', split ? 'Hand won' : 'Hand lost', split ? 'After a split pot' : 'After a lost hand', '');
    await k.tap('#btn-next-hand');

    // you fold
    await k.until(yourTurn, 'your turn', 40000);
    await k.tap('#btn-fold'); await k.wait(900);
    await k.shot('fold', 'Folding', 'You fold', 'Your cards gone; the others play on.');
    await playUntil(k, () => awardUp() || nextUp(), 60000);
    await k.wait(400);
    await k.shot('fold-end', 'Folding', 'The hand ends without you', '');
    await playUntil(k, () => !!(typeof pendingHumanPlayer !== 'undefined' && pendingHumanPlayer), 40000);

    // everyone folds to you
    await k.until(yourTurn, 'your turn', 40000);
    await k.js(() => { DEV_MODE = true; const h = game.players.find(p => p.isHuman);
      game.players.forEach(p => { if (!p.isHuman && p.inHand && !p.folded && !p.allIn) applyAction(p, { action:'fold' }); });
      devAutoResolveTurn(h, 'call'); });
    await k.soft(() => awardUp() || nextUp(), 'the fold win', 20000);
    await k.wait(300);
    await k.shot('foldwin', 'Hand won', 'Everyone folds: you win', 'No showdown: the table folds to you.');
    await playUntil(k, nextUp, 20000); await k.wait(500);
    await k.shot('foldwin-next', 'Hand won', 'After a fold win', '');
    // between hands: one opponent short-stacked, so the all-in below knocks them out
    await k.js(() => { const t = game.players.filter(p => !p.isHuman && !p.eliminated).sort((a, b) => a.chips - b.chips)[0]; t.chips = Math.min(t.chips, game.bigBlind * 4); window.__koId = t.id; render(); });
    await k.tap('#btn-next-hand');

    // all in and a K.O.
    await k.until(yourTurn, 'your turn', 40000);
    await k.js(() => { DEV_MODE = true; const t = game.players.find(p => p.id === window.__koId && p.inHand && !p.folded && !p.allIn) || game.players.find(p => !p.isHuman && p.inHand && !p.folded && !p.allIn);
      game.players.forEach(p => { if (!p.isHuman && p !== t && p.inHand && !p.folded && !p.allIn) applyAction(p, { action:'fold' }); });
      devForceAllIn(t); devRigForWinner(game.players.find(p => p.isHuman)); });
    await k.tap('#btn-raise'); await k.wait(600);
    await k.tap('#raise-panel [data-q="allin"], #raise-panel button:has-text("ALL-IN")').catch(() => {});
    await k.wait(500);
    await k.shot('allin-confirm', 'All in', 'Going all in', 'ALL-IN chosen in the raise panel.');
    await k.tap('#raise-cancel').catch(() => {}); await k.wait(400);
    await k.until(() => { if (pendingHumanPlayer) humanAct('allin'); return game.players.find(p => p.isHuman).allIn || !handInProgress(); }, 'you all in', 20000);
    for (let i = 0; i < 4; i++){ await k.wait(1500); await k.shot('allin-run-' + (i + 1), 'All in', 'All in: running it out (' + (i + 1) + ')', 'Both all in, the board dealt out.'); if (await k.js(awardUp)) break; }
    await k.soft(awardUp, 'AWARD', 30000);
    await k.shot('ko-award', 'All in', 'All in won: COLLECT', 'You won the all-in: their whole stack is in the pot.');
    await k.tap('#btn-award-pot-console').catch(() => {});
    for (let i = 1; i <= 4; i++){ await k.wait(800); await k.shot('ko-' + i, 'All in', 'All in won: the pot paid (' + i + ')', i === 1 ? 'COLLECT pressed: the chips fly to your bank.' : ''); }
    await k.soft(nextUp, 'NEXT HAND', 20000); await k.wait(500);
    await k.shot('ko-after', 'K.O.', 'Hand over, their stack at $0', 'You won their whole stack; they sit at $0 until the next hand.');
    await k.tap('#btn-next-hand');
    for (const [ms, n] of [[400, 1], [700, 2], [900, 3], [1500, 4]]){ await k.wait(ms);
      await k.shot('ko-next-' + n, 'K.O.', 'The next hand after busting them (' + n + ')', n === 1 ? 'NEXT HAND after their stack hit $0: in a Quick Deal run they are back at the table with a new stack.' : ''); }
    await k.until(yourTurn, 'your turn', 40000).catch(() => {});

    // between hands: settings at the table, leaving
    await k.tap('#open-settings'); await k.wait(1000);
    await k.shot('table-settings', 'At the table', 'Settings from the table', 'The ⚙ on the table: SAVE, LEAVE TABLE, RESET CURRENT RUN on top.');
    await k.js(() => closeOverlays()); await k.wait(600);
  },

  // Table cleared → the results → NEXT TABLE; then a bust → run over.
  async endings(k){
    await k.boot(Object.assign({}, SEEN));
    await k.wait(3800);
    await k.js(() => startSinglePlayerRun());
    await k.until(yourTurn, 'your turn', 40000);
    await k.js(() => { DEV_MODE = true; devTestKoEject(); });
    for (const [ms, n] of [[250, 1], [350, 2], [500, 3], [800, 4], [1200, 5]]){
      await k.wait(ms); await k.shot('ko-eject-' + n, 'K.O.', 'K.O. ejection (' + n + ')', n === 1 ? 'An opponent eliminated: the portrait knocked out of its seat (the game\'s own K.O. animation, played with the DEV preview).' : '');
    }
    await k.wait(1500);
    await k.js(() => { devEndTable(); });
    for (const [ms, n] of [[600, 1], [1400, 2], [2000, 3], [2500, 4], [3000, 5]]){
      await k.wait(ms); await k.shot('cleared-' + n, 'Table cleared', 'Table cleared (' + n + ')', n === 1 ? 'Every opponent out: the result stage arriving.' : '');
    }
    await k.soft(() => { const b = document.getElementById('btn-award-pot-console'); return b && b.offsetParent && /next table/i.test(b.textContent); }, 'NEXT TABLE', 30000);
    await k.wait(800);
    await k.shot('cleared-console', 'Table cleared', 'Table cleared: NEXT TABLE', 'The result settled, NEXT TABLE waiting.');
    await k.tap('#btn-award-pot-console');
    await k.wait(900);  await k.shot('next-table-1', 'Table cleared', 'On to table 2', 'The change to the next table.');
    await k.wait(1500); await k.shot('next-table-2', 'Table cleared', 'Table 2 intro', '');
    // bust
    await k.until(yourTurn, 'your turn', 40000);
    // BUST ME (on your turn) until a showdown takes your last chip
    for (let tries = 0; tries < 5; tries++){
      await k.until(yourTurn, 'your turn', 60000);
      await k.js(bust);
      await k.soft(awardUp, 'the showdown', 40000);
      if (await k.js(() => game.players.find(p => p.isHuman).chips === 0)) break;
      await playUntil(k, yourTurn, 60000);
    }
    await k.shot('bust-showdown', 'Run over', 'Busted: the losing all-in', 'Your last chips lost at a showdown.');
    await k.tap('#btn-award-pot-console').catch(() => {});
    for (const [ms, n] of [[1000, 1], [1500, 2], [2000, 3], [2500, 4], [3000, 5]]){
      await k.wait(ms); await k.shot('runover-' + n, 'Run over', 'Run over (' + n + ')', n === 1 ? 'Out of chips: the run-over stage arriving.' : '');
    }
    await k.soft(() => { const b = document.getElementById('btn-award-pot-console'); return b && b.offsetParent && /new run/i.test(b.textContent); }, 'NEW RUN', 30000);
    await k.wait(800);
    await k.shot('runover-console', 'Run over', 'Run over: NEW RUN', 'The result settled; NEW RUN / the menu.');
  },

  // P.I.P. on, with the report: talking at your turn, the report after the hand.
  async pip(k){
    await k.boot(Object.assign({}, SEEN, { coachBot:true, review:true, autoDeal:false }));
    await k.wait(3800);
    await k.js(() => startSinglePlayerRun());
    await k.until(yourTurn, 'your turn', 40000);
    await k.wait(2500);
    await k.shot('pip-table', 'P.I.P.', 'P.I.P. at the table', 'The coach switched on (COACH key by the ⚙): his TV on the felt.');
    await k.tap('#coach-station').catch(() => {});
    await k.wait(1500);
    await k.shot('pip-tap', 'P.I.P.', 'Tapping P.I.P.', 'What he says when tapped on your turn.');
    await playUntil(k, () => { const r = document.querySelector('.prp-key-report'); return !!(r && r.offsetParent); }, 90000);
    await k.wait(700);
    await k.shot('pip-keys', 'P.I.P.', 'REPORT / DEAL', 'With the report on, the hand ends on REPORT and DEAL.');
    await k.tap('.prp-key-report'); await k.wait(1500);
    await k.shot('pip-report-1', 'P.I.P.', 'P.I.P. report', 'The end-of-hand report arriving.');
    await k.wait(3500);
    await k.shot('pip-report-2', 'P.I.P.', 'P.I.P. report (played through)', '');
  },

  // The new Career: the hub, packets, the album, the shop, an invitation, its results.
  async career(k, page, touch){
    await k.boot(Object.assign({}, SEEN));
    await k.wait(3800);
    await k.tap('#open-career');
    await k.wait(900);
    await k.shot('nc-roll', 'Career', 'Menu → Career', 'The change from the menu into Career (part way).');
    await k.until(() => window.CareerMain && CareerMain.ready && !CareerMain.state.busy && CareerHub.open && !CareerHub.screen.inert, 'the hub', 30000);
    await k.wait(800);
    await k.shot('nc-hub-first', 'Career', 'Hub: a fresh Career', '$500 and the starter packet on the felt.');
    const shop = () => k.js(() => VendingLab.state);
    const hub = () => k.js(() => CareerMain.state);
    const label = () => k.js(() => document.querySelector('[data-key="play"]').textContent.replace(/\n/g, ' '));
    const mid = () => k.tap('[data-key="play"]');
    await mid();
    await k.until(() => VendingLab.state.open === 'sealed', 'the sealed packet', 20000);
    await k.wait(600);
    await k.shot('nc-packet-sealed', 'Packets', 'Packet: ready to tear', 'The starter packet up close.');
    let torn = 0;
    for (let i = 0; i < 40; i++){
      if ((await shop()).mode === 'hub') break;
      if (!(await k.js(() => PackOpeningEmbed.state.lock))){ await mid(); torn++;
        if (torn <= 4){ await k.wait(500); await k.shot('nc-packet-open-' + torn, 'Packets', 'Packet: opening (' + torn + ')', ''); } }
      await k.wait(300);
    }
    await k.until(() => VendingLab.state.mode === 'hub' && !CareerMain.state.busy && CareerMain.state.deck === 4, 'four cards face down', 30000);
    await k.wait(500);
    await k.shot('nc-deck', 'Packets', 'Your new cards, face down', 'Back on the hub with the packet\'s cards in a pile.');
    for (let c = 0; c < 4; c++){
      const d = await k.js(() => CareerMain.where('deck', 0));
      if (!d) break;
      let turned = false;
      for (let tries = 0; tries < 4 && !turned; tries++){
        const q = await k.js(() => CareerMain.where('deck', 0));
        if (q) await k.tapXY(q.x, q.y);
        turned = await k.soft(() => VendingLab.state.open === 'shown', 'a card turned', 5000);
      }
      if (!turned) throw new Error('a card would not turn: ' + JSON.stringify(await k.js(() => { const q = CareerMain.where('deck', 0); const e = q && document.elementFromPoint(q.x, q.y);
        return [VendingLab.state.mode, VendingLab.state.open, CareerMain.state, q, e && e.outerHTML.slice(0, 100), document.querySelector('[data-key="play"]').textContent]; })));
      await k.until(() => !PackOpeningEmbed.state.lock, 'the turn', 10000);
      await k.wait(400);
      if (c < 2) await k.shot('nc-card-' + (c + 1), 'Packets', 'A card turned over (' + (c + 1) + ')', c ? '' : 'Tapping the pile turns a card up close.');
      await k.tapXY(30, 150);
      await k.until(() => VendingLab.state.mode === 'hub' && !CareerMain.state.busy, 'the card put down', 20000);
      await k.wait(300);
    }
    await k.until(() => document.querySelector('[data-key="play"]').textContent.replace(/\n/g, ' ') === 'ADD TO COLLECTION', 'ADD TO COLLECTION', 20000);
    await k.shot('nc-add', 'Career', 'Hub: ADD TO COLLECTION', 'All four turned, waiting to be added.');
    await mid();
    await k.until(() => CareerMain.state.cards === 0 && !CareerMain.state.busy, 'added', 20000);
    await k.until(() => document.querySelector('[data-key="play"]').textContent.replace(/\n/g, ' ') === 'REDEAL', 'REDEAL', 20000);
    await k.wait(400);
    await k.shot('nc-redeal', 'Career', 'Hub: REDEAL', 'Cards in the collection; the felt empty.');
    await mid();
    await k.until(() => CareerMain.state.dealt.length === 3 && !CareerMain.state.busy, 'three dealt', 20000);
    await k.wait(500);
    await k.shot('nc-dealt', 'Career', 'Hub: three invitations dealt', 'Three of your cards on the felt to choose from.');
    // inspect a card: hold it
    const w0 = await k.js(() => CareerMain.where('dealt', 0));
    const m = await k.box('.cm-mouth');
    await touch.drag(w0.x, w0.y, m.x + m.width / 2, m.y + m.height / 2 + 20, 14, 16); await k.wait(150);
    await k.shot('nc-drag', 'Career', 'Dragging a card to the feeder', 'Mid-drag.');
    await touch.end();
    await k.until(() => CareerMain.state.fed && !CareerMain.state.busy, 'fed', 20000);
    await k.until(() => document.querySelector('[data-key="play"]').textContent.replace(/\n/g, ' ') === 'PLAY', 'PLAY', 20000);
    await k.wait(500);
    await k.shot('nc-fed', 'Career', 'Hub: card in the feeder, PLAY', 'The invitation read; PLAY lit.');
    await mid();
    await k.wait(900);  await k.shot('nc-to-table-1', 'Career event', 'Hub → the event table', 'The change from the hub to the table.');
    await k.wait(1400); await k.shot('nc-to-table-2', 'Career event', 'Event table intro', '');
    await k.until(() => game && game.mode === 'career' && game.handNumber >= 1, 'the event table', 40000);
    await k.until(yourTurn, 'your turn', 40000);
    await k.wait(600);
    await k.shot('nc-event-table', 'Career event', 'At an invitation\'s table', 'The event clock on the felt.');
    // leave mid-way: CONTINUE / ABANDON
    await k.js(() => leaveTable());
    await k.until(() => CareerHub.open && document.getElementById('table-screen').classList.contains('hidden') && !CareerMain.state.busy, 'the hub after leaving', 20000);
    await k.wait(900);
    await k.shot('nc-continue', 'Career', 'Hub: an event left mid-way', 'CONTINUE on the key.');
    await k.tap('#cm-tune'); await k.wait(600);
    await k.shot('nc-tune', 'Career', 'Hub: the TUNE / ABANDON panel', '');
    await k.tap('#cm-abandon'); await k.wait(600);
    await k.shot('nc-abandon', 'Career', 'Abandon? (confirm)', '');
    await k.tap('#confirm-dialog-no').catch(() => {}); await k.wait(500);
    await k.js(() => { const d = [...document.querySelectorAll('button')].find(b => b.offsetParent && /^done$/i.test(b.textContent.trim())); if (d) d.click(); });
    await k.wait(800);
    // back in (CONTINUE): win it
    let back = false;
    for (let i = 0; i < 4 && !back; i++){
      await k.until(() => !CareerMain.state.busy, 'the hub settled', 20000);
      await mid();
      back = await k.soft(() => game && game.mode === 'career' && !document.getElementById('table-screen').classList.contains('hidden'), 'back at the table', 12000);
    }
    if (!back) throw new Error('CONTINUE did not reopen the table');
    await k.until(yourTurn, 'your turn', 40000);
    await k.js(() => { DEV_MODE = true; devEndTable(); });
    for (const [ms, n] of [[700, 1], [1500, 2], [2000, 3], [2500, 4]]){
      await k.wait(ms); await k.shot('nc-won-' + n, 'Career result', 'Event won (' + n + ')', n === 1 ? 'Winning an invitation: the result stage.' : '');
    }
    await k.soft(() => { const b = document.getElementById('btn-award-pot-console'); return b && b.offsetParent && /hub/i.test(b.textContent); }, 'BACK TO THE HUB', 40000);
    await k.wait(800);
    await k.shot('nc-won-console', 'Career result', 'Event won: BACK TO THE HUB', '');
    await k.tap('#btn-award-pot-console');
    await k.until(() => CareerHub.open && document.getElementById('table-screen').classList.contains('hidden'), 'the hub again', 40000);
    await k.wait(1200); await k.shot('nc-back-1', 'Career', 'Back at the hub: the prize', 'The plate says how it went; the prize counted in.');
    await k.wait(2000); await k.shot('nc-back-2', 'Career', 'Back at the hub (settled)', '');
    // the album
    await k.until(() => !CareerMain.state.busy, 'hub settled', 20000);
    await k.tap('[data-key="cards"]');
    await k.soft(() => window.CareerAlbum && CareerAlbum.out, 'the album', 20000);
    await k.wait(1400);
    await k.shot('nc-album', 'Album', 'The album', 'CARDS: the collection book over the hub.');
    const slot = await k.js(() => { const s = document.querySelector('.cb-slot.is-have'); if (!s) return null; const r = s.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    if (slot){ await k.tapXY(...slot); await k.wait(1200); await k.shot('nc-album-card', 'Album', 'Album: a card lit', 'Tapping a card you hold.'); }
    await k.tap('[data-key="cards"]').catch(() => {});
    await k.soft(() => !CareerAlbum.out, 'album away', 10000);
    await k.wait(800);
    // the shop
    await k.tap('[data-key="shop"]');
    await k.soft(() => VendingLab.state.mode === 'idle', 'the shop', 20000);
    await k.wait(900);
    await k.shot('nc-shop', 'Shop', 'The packet machine', 'SHOP: the vending machine rolls in.');
    const s = await k.js(() => VendingLab.slots().find(q => q.id === 'house'));
    if (s){
      const key = await k.js(i => { const r = document.querySelector(`.vm-key[data-i="${i}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, s.i);
      await k.tapXY(...key); await k.wait(700);
      await k.shot('nc-shop-chosen', 'Shop', 'A packet chosen', '');
      const b = await k.box('[data-key="play"]');
      await touch.start(b.x + b.width / 2, b.y + b.height / 2); await k.wait(600); await touch.end();
      for (let i = 1; i <= 3; i++){ await k.wait(900); await k.shot('nc-shop-buy-' + i, 'Shop', 'Buying (' + i + ')', i === 1 ? 'Paying in chips; the packet drops.' : ''); }
      await k.soft(() => { const q = VendingLab.state; return q.mode === 'idle' && q.tray >= 1; }, 'dropped', 40000);
      await k.wait(600);
      await k.shot('nc-shop-bought', 'Shop', 'Bought: in the tray', '');
    }
    await k.tap('[data-key="shop"]');
    await k.soft(() => VendingLab.state.mode === 'hub' && !CareerMain.state.busy, 'back to the hub', 20000);
    await k.wait(800);
    await k.shot('nc-hub-packet', 'Career', 'Hub with a bought packet', '');
    // lose one
    await k.js(() => CareerLink.play(CareerLink.pool()[0]));
    await k.until(() => game && game.mode === 'career' && game.handNumber >= 1 && !document.getElementById('table-screen').classList.contains('hidden'), 'an event', 40000);
    await k.until(yourTurn, 'your turn', 40000);
    await k.js(bust);
    await playUntil(k, () => { const b = document.getElementById('btn-award-pot-console'); return !!(b && b.offsetParent && /hub/i.test(b.textContent)); }, 120000,
      () => { if (handInProgress() && pendingHumanPlayer && window.__bustHand !== game.handNumber && game.players.find(p => p.isHuman).chips > 0){ window.__bustHand = game.handNumber; DEV_MODE = true;
          const t = game.players.find(p => !p.isHuman && p.inHand && !p.folded && !p.eliminated); devBustMe(); if (t && !t.allIn) t._devForceAllIn = true; } });
    await k.wait(600);
    await k.shot('nc-lost', 'Career result', 'Event lost', 'Knocked out of an invitation: the result settled.');
    // out to the menu
    await k.tap('#btn-award-pot-console');
    await k.soft(() => CareerHub.open && !CareerMain.state.busy, 'hub', 40000);
    await k.wait(1500);
    await k.shot('nc-after-loss', 'Career', 'Back at the hub after a loss', '');
  },

  // The rest: a played-in menu, the new-table warning, each table size, the pity packet.
  async extras(k){
    const veteran = { hands:212, won:61, showdownsWon:30, biggestPot:4210, net:3150 };
    await k.boot(Object.assign({}, SEEN), { 'felt.stats':JSON.stringify(veteran) });
    await k.wait(4200);
    await k.shot('menu-veteran', 'Main menu', 'Main menu, played in', 'The same menu after 212 hands (stats filled; example figures).');
    // a table left mid-run: CONTINUE on the menu, and the warning on a new one
    await k.js(() => startSinglePlayerRun());
    await k.until(yourTurn, 'your turn', 40000);
    await k.js(() => { saveTable(); leaveTable(); });
    await k.soft(() => !document.getElementById('home').classList.contains('hidden'), 'the menu', 20000);
    await k.wait(2500);
    await k.shot('menu-continue', 'Main menu', 'Main menu with a saved table', 'CONTINUE shows while a Quick Deal table is saved.');
    await k.tap('#quick-play'); await k.wait(900);
    await k.shot('confirm-newtable', 'Main menu', 'Start a new table? (warning)', 'Quick Deal while a table is saved.');
    await k.js(() => closeOverlays()); await k.wait(600);
    for (const n of [1, 2, 3, 6]){
      await k.js(c => startSinglePlayerRun({ opponentCount:c }), n);
      await k.until(yourTurn, 'your turn', 40000);
      await k.wait(700);
      await k.shot('size-' + n, 'Table sizes', n === 1 ? 'Heads-up (1 opponent)' : n + ' opponents', 'Your turn, first hand.');
      await k.js(() => leaveTable());
      await k.soft(() => !document.getElementById('home').classList.contains('hidden'), 'the menu', 20000);
      await k.wait(1200);
    }
  },

  // The new Career at rock bottom: broke and cardless, the pity packet.
  async pity(k){
    await k.boot(Object.assign({}, SEEN));
    await k.wait(3800);
    await k.tap('#open-career');
    await k.until(() => window.CareerMain && CareerMain.ready && !CareerMain.state.busy && CareerHub.open, 'the hub', 30000);
    await k.js(() => { career.invitations = []; career.packets = []; career.bankroll = 20; career.starterGiven = true; saveCareer(); });
    await k.js(() => location.reload());
    await k.wait(4000);
    await k.tap('#open-career');
    await k.until(() => window.CareerMain && CareerMain.ready && !CareerMain.state.busy && CareerHub.open, 'the hub', 30000);
    await k.wait(2500);
    await k.shot('nc-pity', 'Career', 'Hub: broke, with the pity packet', '$20 and no cards: one free packet on the felt.');
  },

  // Custom Game: cash and tournament tables, and going broke in each.
  async custom(k){
    for (const type of ['cash', 'tournament']){
      await k.boot(Object.assign({}, SEEN, { gameType:type, mode:type, lives:false }));
      await k.wait(3800);
      await k.tap('#go-to-setup'); await k.wait(1200);
      await k.js(() => document.getElementById('deal-me-in').click()); await k.wait(800);
      await k.js(() => { const y = document.getElementById('confirm-newtable-yes'); if (y && y.offsetParent) y.click(); });
      await k.until(yourTurn, 'your turn', 40000);
      await k.wait(500);
      await k.shot('custom-' + type, 'Custom Game', 'Custom Game: ' + type + ' table', '');
      await k.js(bust);
      const sdKey = () => { const b = document.getElementById('btn-award-pot-console'); return !!(b && b.offsetParent && /showdown/i.test(b.textContent)); };
      if (await k.soft(sdKey, 'the SHOWDOWN key', 60000)){
        await k.wait(400);
        await k.shot('custom-' + type + '-showdown-key', 'All in', 'All in: the SHOWDOWN key (' + type + ')', 'Everyone all in, nothing left to bet: SHOWDOWN turns the cards.');
      }

    }
  }
};

(async () => {
  fs.mkdirSync(OUT, { recursive:true });
  if (PAGE_ONLY){ writePage(); return; }
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const names = ONLY ? ONLY.split(',') : Object.keys(FLOWS);
  try {
    for (const name of names){
      console.log('flow ' + name);
      let rec = null;
      const errors = await withPage({ width:W, height:H, recordVideo:VIDEO ? { dir:path.join(OUT, '.video'), size:{ width:W, height:H } } : null }, async (page, touch) => {
        const k = kit(page, touch, name); k.base = base;
        if (VIDEO) rec = { k, video:page.video() };
        try { await FLOWS[name](k, page, touch); }
        catch (e){ log.push(name + ': stopped: ' + String(e.message || e).split('\n')[0]); await k.shot(name + '-stopped', 'Stopped', name + ' stopped here', String(e.message)).catch(() => {}); }
      });
      if (rec) cutClips(await rec.video.path(), rec.k.marks);
      errors.filter(e => !/vibrate|favicon|404/.test(e)).forEach(e => log.push(name + ': ' + e));
    }
  } finally { server.close(); }
  if (VIDEO){
    const file = path.join(OUT, 'clips.json');
    const keep = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).filter(c => !clipsMade.some(n => n.id === c.id)) : [];
    fs.writeFileSync(file, JSON.stringify(keep.concat(clipsMade), null, 1));
    fs.rmSync(path.join(OUT, '.video'), { recursive:true, force:true });
    console.log('\n' + clipsMade.length + ' clips → ' + OUT);
    if (fs.existsSync(path.join(OUT, 'moments.json'))) writePage();
    if (log.length) console.log('notes:\n  ' + log.join('\n  '));
    return;
  }
  // a re-run of some flows keeps the others' moments
  const file = path.join(OUT, 'moments.json');
  const old = ONLY && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).moments.filter(m => !names.includes(m.flow)) : [];
  fs.writeFileSync(file, JSON.stringify({ size:W + 'x' + H, taken:new Date().toISOString(), moments:old.concat(moments) }, null, 1));
  console.log('\n' + moments.length + ' moments → ' + OUT);
  writePage();
  if (log.length) console.log('notes:\n  ' + log.join('\n  '));
})().catch(e => { console.error(e); process.exit(1); });
