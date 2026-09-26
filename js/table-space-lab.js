"use strict";

/* ============================================================
   TABLE SPACE LAB (Lab)

   How much room can the table gain on the owner's phone (iPhone 15 Pro
   Max, installed app) without making anything harder to see, read or
   play? Every control resizes or moves one part of the real table live;
   the meters measure what that buys.

   The real game (index.html, every production script and stylesheet) runs
   in a same-origin sandboxed frame, full screen at 430 x 932, with
   js/table-space-lab-frame.js injected (safe areas, the generated
   stylesheet, the coin world's tray and bet spots, measuring).

   ISOLATION: same scheme as dashboard-order-lab.html. The copy is built as
   srcdoc with a shim that replaces Storage in the frame with an in-memory
   map before any game script runs, and the service-worker block is
   stripped; if either fails the game is not started. This page never
   touches localStorage: the settings live in the URL hash.
   ============================================================ */
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const frame = $('#sl-frame');
  const status = t => { $('#sl-status').textContent = t; };
  const GAME = 'index.html';
  const V = '1';

  /* The controls. `today` is the game as it ships; `when` hides a row that
     only matters with another choice. Ranges: [min, max, step, unit]. */
  const SECTIONS = [
    { title:'TOP OF THE SCREEN', rows:[
      { k:'top', name:'TOP BAR', hint:'POKER · hand · blinds', today:'gone', seg:[
        ['gone','GONE','Today (v0.40.7): no bar. The settings key is in the dashboard, SAVE in the settings menu.'],
        ['trim','TRIM','The bar back, shorter (title, hand and blinds only).'],
        ['full','FULL','The bar back at its old size (title, hand and blinds only).']] },
      { k:'topGap', name:'GAP UNDER STATUS BAR', today:0, range:[0,14,1,'px'], when:s => s.top !== 'full', note:'Space between the phone\'s clock row and the game.' },
      { k:'topH', name:'BAR HEIGHT', today:38, range:[26,38,1,'px'], when:s => s.top === 'trim' },
      { k:'gear', name:'SETTINGS KEY', today:'dash', when:s => s.top === 'gone', seg:[
        ['dash','DASHBOARD','In the right-hand bay, where the speaker grille is.'],
        ['felt','FELT CORNER','A small key on the bottom-right corner of the table.']] },
      { k:'print', name:'HAND · BLINDS PRINT', today:'off', when:s => s.top === 'gone', seg:[['off','OFF','Today: nothing printed on the felt.'],['on','ON','Printed faintly on the felt, like a casino table.']] },
      { k:'printY', name:'PRINT HEIGHT', today:66, range:[50,96,1,'%'], when:s => s.top === 'gone' && s.print === 'on' }
    ]},
    { title:'OPPONENTS', rows:[
      { k:'face', name:'FACE SIZE', today:100, range:[70,100,1,'%'] },
      { k:'hole', name:'THEIR CARDS', today:95, range:[70,100,1,'%'], note:'The two cards under each opponent.' },
      { k:'rows', name:'NAME / STACK / ACTION ROWS', today:'today', seg:[['today','TODAY','Today\'s padding.'],['slim','SLIM','The same three rows with less padding.']] },
      { k:'action', name:'ACTION (CALL 40, FOLD…)', today:'row', seg:[
        ['row','OWN ROW','Today: its own row under the stack.'],
        ['name','IN NAME STRIP','Shows in the name strip while there is one; the name comes back on the next street. Saves a row.']] },
      { k:'podY', name:'OPPONENT ROW HEIGHT', today:2, range:[-24,16,1,'px'], note:'Moves the opponents up (−) or down (+).' },
      { k:'oppDrop', name:'THEIR BET SPOTS', today:0, range:[-20,30,1,'px'], note:'Where their coins land, further from their cards (+); 0 is today\'s spot.' }
    ]},
    { title:'MIDDLE OF THE TABLE', rows:[
      { k:'boardY', name:'SHARED CARDS HEIGHT', today:53, range:[40,66,.5,'%'], note:'The five cards in the middle. Height on the table.' },
      { k:'potY', name:'POT COUNTER HEIGHT', today:77.5, range:[60,92,.5,'%'], note:'The POT box. Height on the table.' },
      { k:'trayAt', name:'POT COINS', today:'above', seg:[
        ['above','ABOVE COUNTER','Today: the coins sit between the shared cards and the POT box.'],
        ['below','BELOW COUNTER','The POT box sits between the shared cards and the coins.']] },
      { k:'tray', name:'POT COIN AREA', today:'well', seg:[['well','ROUNDED','Today\'s rounded dark well.'],['box','RECTANGLE','A square-cornered printed box, matching the bet boxes.']] },
      { k:'trayW', name:'POT COIN AREA WIDTH', today:210, range:[120,240,2,'px'] },
      { k:'trayH', name:'POT COIN AREA DEPTH', today:62, range:[36,70,1,'px'] },
      { k:'deckX', name:'DECK: ACROSS', today:16, range:[8,50,.5,'%'] },
      { k:'deckY', name:'DECK: DOWN', today:88.5, range:[60,95,.5,'%'] },
      { k:'deckS', name:'DECK SIZE', today:100, range:[60,100,1,'%'] }
    ]},
    { title:'BET SPOTS', rows:[
      { k:'boxes', name:'BET BOXES', today:'off', seg:[['off','OFF','Today: coins land on bare felt.'],['on','RECTANGLES','A printed rectangle where each player\'s bet lands.']] },
      { k:'boxW', name:'BOX WIDTH', today:46, range:[28,80,1,'px'], when:s => s.boxes === 'on' },
      { k:'boxH', name:'BOX HEIGHT', today:34, range:[22,56,1,'px'], when:s => s.boxes === 'on' },
      { k:'you', name:'YOUR BET SPOT', today:'centre', seg:[
        ['centre','ABOVE YOUR CARDS','Today: straight above your two cards.'],
        ['right','RIGHT OF CARDS','Beside your cards, on the right.'],
        ['old','LOW RIGHT','Where it was before v0.40.7: right of the deck, low on the felt.']] }
    ]},
    { title:'DASHBOARD', rows:[
      { k:'readouts', name:'DASHBOARD READOUTS', today:'today', seg:[
        ['today','TODAY','Today\'s screens and spacing.'],
        ['compact','COMPACT','The same screens with less air around them, and no STACK label (as picked for Dashboard V2). Lets the dashboard get shorter without cutting anything off.']] },
      { k:'dockH', name:'DASHBOARD HEIGHT', today:181, range:[130,181,1,'px'], note:'Bank, hand name, messages, stack, bet this hand.' },
      { k:'rise', name:'YOUR CARDS POKE UP', today:55, range:[30,70,1,'px'], note:'How far your two cards rise out of the dashboard into the table.' },
      { k:'actH', name:'BUTTON BAY HEIGHT', today:98, range:[66,100,1,'px'], note:'FOLD / CALL / RAISE and the space around them, down to the bottom of the screen.' },
      { k:'btnH', name:'BUTTON HEIGHT', today:51, range:[42,54,1,'px'], note:'FOLD / CALL / RAISE.' },
      { k:'foot', name:'GAP ABOVE HOME BAR', today:21, range:[8,24,1,'px'], note:'Under the buttons. Below ~16px your thumb meets the swipe-home bar.' }
    ]}
  ];
  const ROWS = SECTIONS.flatMap(s => s.rows);
  const TODAY = Object.fromEntries(ROWS.map(r => [r.k, r.today]));

  // TODAY is the game (v0.40.7, the owner's picks from this lab). BEFORE
  // is the table as it was before the spacing pass, to compare against.
  const PRESETS = [
    { id:'today', name:'TODAY', note:'The game as it ships (v0.40.7).', s:{} },
    { id:'before', name:'BEFORE', note:'The table before the spacing pass (top bar back; score bar not shown: the XP is shelved).',
      s:{ top:'full', hole:100, podY:0, oppDrop:10, boardY:57, potY:79, trayW:200, trayH:58, deckX:27, deckY:89,
        you:'old', rise:58, actH:91, btnH:54, foot:24 } }
  ];

  let S = Object.assign({}, TODAY);
  let opp = '4';
  let comparing = false;

  function readHash(){
    const q = new URLSearchParams(location.hash.slice(1));
    ROWS.forEach(r => {
      const v = q.get(r.k); if (v == null) return;
      if (r.range){ const n = parseFloat(v); if (Number.isFinite(n)) S[r.k] = Math.min(r.range[1], Math.max(r.range[0], n)); }
      else if (r.seg.some(o => o[0] === v)) S[r.k] = v;
    });
    if (['4','5','6'].includes(q.get('opp'))) opp = q.get('opp');
  }
  function writeHash(){ try{ history.replaceState(null, '', '#' + new URLSearchParams(Object.assign({}, S, { opp })).toString()); }catch(e){} }

  /* ---- the controls ---- */
  const fmt = (r, v) => (Number.isInteger(r.range[2]) ? v : v.toFixed(1)) + r.range[3];
  function buildForm(){
    $('#sl-presets').innerHTML = PRESETS.map(p => '<button type="button" data-preset="' + p.id + '">' + p.name + '</button>').join('') + '<div class="sl-preset-note" id="sl-preset-note"></div>';
    $('#sl-rows').innerHTML = SECTIONS.map(sec => '<h3 class="sl-sec">' + sec.title + '</h3>' + sec.rows.map(r =>
      '<div class="sl-job" data-row="' + r.k + '"><div class="sl-job-head"><b>' + r.name + '</b>' +
      (r.range ? '<span class="sl-val"></span>' : (r.hint ? '<small>' + r.hint + '</small>' : '')) + '</div>' +
      (r.range
        ? '<div class="sl-range"><input type="range" min="' + r.range[0] + '" max="' + r.range[1] + '" step="' + r.range[2] + '"><button type="button" class="sl-today">TODAY</button></div>'
        : '<div class="sl-seg">' + r.seg.map(o => '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>') +
      '<div class="sl-job-note"></div></div>').join('')).join('');
    $('#sl-rows').addEventListener('click', e => {
      const row = e.target.closest('[data-row]'); if (!row) return;
      const r = ROWS.find(x => x.k === row.dataset.row);
      const b = e.target.closest('button'); if (!b) return;
      S[r.k] = b.classList.contains('sl-today') ? r.today : b.dataset.v;
      changed();
    });
    $('#sl-rows').addEventListener('input', e => {
      const row = e.target.closest('[data-row]'); if (!row || e.target.type !== 'range') return;
      S[row.dataset.row] = parseFloat(e.target.value);
      changed(true);
    });
    $('#sl-presets').addEventListener('click', e => {
      const b = e.target.closest('[data-preset]'); if (!b) return;
      const p = PRESETS.find(x => x.id === b.dataset.preset);
      S = Object.assign({}, TODAY, p.s);
      changed();
    });
  }
  function presetMatch(){ return PRESETS.find(p => ROWS.every(r => S[r.k] === (r.k in p.s ? p.s[r.k] : r.today))); }
  function sync(){
    ROWS.forEach(r => {
      const row = $('[data-row="' + r.k + '"]');
      row.classList.toggle('is-off', !!r.when && !r.when(S));
      const isToday = S[r.k] === r.today;
      if (r.range){
        const input = $('input', row); if (parseFloat(input.value) !== S[r.k]) input.value = S[r.k];
        const val = $('.sl-val', row); val.textContent = fmt(r, S[r.k]) + (isToday ? ' · today' : ' · today ' + fmt(r, r.today)); val.classList.toggle('is-today', isToday);
        $('.sl-today', row).disabled = isToday;
        $('.sl-job-note', row).textContent = r.note || '';
      } else {
        $$('.sl-seg button', row).forEach(b => { b.classList.toggle('is-on', b.dataset.v === S[r.k]); b.classList.toggle('is-today', b.dataset.v === r.today); });
        const o = r.seg.find(x => x[0] === S[r.k]);
        $('.sl-job-note', row).textContent = o ? o[2] : '';
      }
    });
    const pm = presetMatch();
    $$('[data-preset]').forEach(b => b.classList.toggle('is-on', !!pm && pm.id === b.dataset.preset));
    $('#sl-preset-note').textContent = pm ? pm.note : 'Your own mix.';
    $$('#sl-opp button').forEach(b => b.classList.toggle('is-on', b.dataset.v === opp));
    const changedRows = ROWS.filter(r => S[r.k] !== r.today && (!r.when || r.when(S)));
    $('#sl-summary').innerHTML = changedRows.length
      ? changedRows.map(r => '<li>' + label(r) + ': <b>' + value(r) + '</b></li>').join('')
      : '<li class="is-today">Everything as today.</li>';
    writeHash();
  }
  const label = r => r.name.toLowerCase().replace(/^./, c => c.toUpperCase());
  const value = r => r.range ? fmt(r, S[r.k]) + ' (today ' + fmt(r, r.today) + ')' : r.seg.find(o => o[0] === S[r.k])[1];

  let sendT = 0;
  function changed(live){
    sync();
    // sliders: apply at most every ~60ms while dragging
    clearTimeout(sendT);
    if (live) sendT = setTimeout(send, 60); else send();
  }

  /* ---- the game ---- */
  const win = () => frame.contentWindow;
  const lab = () => { try{ return win().SpaceLab || null; }catch(e){ return null; } };
  const bridge = () => { try{ return win().__spaceLab || null; }catch(e){ return null; } };
  let baseline = null;
  function send(){
    const L = lab(); if (!L) return;
    L.apply(comparing ? TODAY : S, TODAY);
    setTimeout(meters, 80);
  }
  function measureToday(){
    const L = lab(); if (!L) return;
    L.apply(TODAY, TODAY); baseline = L.measure();
    L.apply(comparing ? TODAY : S, TODAY);
  }
  function meters(){
    const L = lab(); if (!L) return;
    const m = L.measure(); if (!m) return;
    const b = baseline || m;
    const d = (v, w, unit, lowerBetter) => {
      if (v == null || w == null) return '';
      const x = v - w; if (!x) return '<i>= today</i>';
      const good = lowerBetter ? x < 0 : x > 0;
      return '<i class="' + (good ? 'is-up' : 'is-down') + '">' + (x > 0 ? '+' : '−') + Math.abs(x) + unit + '</i>';
    };
    const row = (name, v, w, unit, opts) => {
      opts = opts || {};
      const warn = opts.warnBelow != null && v != null && v < opts.warnBelow;
      return '<div class="sl-meter' + (warn ? ' is-warn' : '') + (opts.big ? ' is-big' : '') + '"><span>' + name + '</span><b>' +
        (v == null ? '—' : v + unit) + d(v, w, unit, opts.lowerBetter) + '</b>' + (opts.bar != null ? '<div class="sl-bar"><i style="width:' + opts.bar + '%"></i></div>' : '') + '</div>';
    };
    $('#sl-meters').innerHTML = [
      row('Table (felt) height', m.felt, b.felt, 'px', { big:true }),
      row('Open felt', m.openPct, b.openPct, '%', { big:true, bar:m.openPct }),
      row('Opponents → shared cards', m.podsToBoard, b.podsToBoard, 'px', { warnBelow:14 }),
      row('Shared cards → pot', m.boardToPot, b.boardToPot, 'px', { warnBelow:4 }),
      row('Pot → your cards', m.potToHand, b.potToHand, 'px', { warnBelow:14 }),
      row('Room for pot coin stacks', m.potRoom, b.potRoom, 'px', { warnBelow:24 }),
      row('Room for their bet stacks', m.spotRoom, b.spotRoom, 'px', { warnBelow:24 }),
      row('Opponent face', m.faces, b.faces, 'px'),
      row('Dashboard', m.dock, b.dock, 'px', { lowerBetter:true }),
      row('Buttons + home bar', m.keys, b.keys, 'px', { lowerBetter:true })
    ].join('');
  }

  const SHIM = `(function(){
    var mem = Object.create(null);
    mem['felt.settings'] = JSON.stringify({ sound:true, seenIntro:true });
    var P = Storage.prototype;
    P.getItem = function(k){ k = String(k); return k in mem ? mem[k] : null; };
    P.setItem = function(k, v){ mem[String(k)] = String(v); };
    P.removeItem = function(k){ delete mem[String(k)]; };
    P.clear = function(){ mem = Object.create(null); };
    P.key = function(i){ var k = Object.keys(mem)[i]; return k === undefined ? null : k; };
    try{ Object.defineProperty(P, 'length', { configurable:true, get:function(){ return Object.keys(mem).length; } }); }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('space lab')); }; }catch(e){} }
    window.__spaceLabIsolated = (function(){ try{ localStorage.setItem('__sl','1'); return mem.__sl === '1'; }catch(e){ return false; } })();
  })();`;
  const BRIDGE = `window.__spaceLab = {
    get game(){ return typeof game === 'undefined' ? null : game; },
    get pending(){ return typeof pendingHumanPlayer === 'undefined' ? null : pendingHumanPlayer; },
    intro: typeof TableIntro === 'undefined' ? null : TableIntro
  };`;
  let source = null;
  async function buildDoc(){
    if (!source){ source = await (await fetch(GAME, { cache:'no-store' })).text(); }
    const sw = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    if (!sw.test(source) || !/<head>/i.test(source) || !/<\/body>/i.test(source)) throw new Error('game page shape changed; refusing to build an unisolated copy');
    const base = new URL('.', location.href).href;
    return source.replace(sw, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/<\/body>/i, '<script src="js/table-space-lab-frame.js?v=' + V + '"><\/script><script>' + BRIDGE + '<\/script></body>');
  }
  async function loadFrame(){
    status('LOADING…');
    const doc = await buildDoc();
    await new Promise(r => { frame.onload = () => r(); frame.srcdoc = doc + '<!-- ' + Date.now() + ' -->'; });
    if (!win().__spaceLabIsolated){ frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>'; throw new Error('storage isolation failed'); }
    const b = bridge();
    if (b && b.intro) b.intro.uninstall();   // the table intro has its own lab; here it only slows each moment down
    send();
  }

  /* ---- moments: each plays the real game to that point ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }
  const doc = () => win().document;
  const myTurn = () => { const b = bridge(); return !!(b && b.game && !b.game.over && b.pending && !doc().getElementById('actions-row').classList.contains('disabled') && !doc().getElementById('console-flip').classList.contains('flipped')); };
  const human = () => bridge().game.players.find(p => p.isHuman);
  async function freshTable(){
    await loadFrame();
    status('DEALING…');
    win().startSinglePlayerRun({ opponentCount:+opp });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    await sleep(300);
    measureToday(); meters();
  }
  async function ensureTurn(){ if (!myTurn()) await freshTable(); }
  // call (or check) until the shared cards reach `n`, or the hand ends
  async function callTo(n){
    await ensureTurn();
    for (let i = 0; i < 30; i++){
      const g = bridge().game;
      if (g.board.length >= n) return;
      const call = g.currentBet - bridge().pending.betThisRound;
      win().humanAct(call > 0 ? 'call' : 'check');
      const ok = await waitFor(() => myTurn() || bridge().game.board.length >= n || !bridge().game.players.some(p => !p.isHuman && p.inHand && !p.folded), 20000);
      if (!ok || !myTurn()) { if (bridge().game.board.length >= n) return; await freshTable(); }
    }
  }
  const MOMENTS = {
    async deal(){ await freshTable(); },
    async flop(){ await callTo(3); },
    async river(){ await callTo(5); },
    async win(){
      await ensureTurn();
      win().devRigForWinner(human());
      await callTo(5);
      for (let i = 0; i < 6 && myTurn(); i++){
        const g = bridge().game, call = g.currentBet - bridge().pending.betThisRound;
        win().humanAct(call > 0 ? 'call' : 'check');
        await waitFor(() => myTurn() || doc().getElementById('console-flip').classList.contains('flipped'), 15000);
      }
      // tap AWARD POT when the result waits for it
      await waitFor(() => {
        const award = doc().getElementById('btn-award-pot-console');
        if (doc().getElementById('console-flip').classList.contains('flipped') && award && !award.disabled){ award.click(); return true; }
        return false;
      }, 15000);
    }
  };
  let busy = false;
  $$('[data-moment]').forEach(b => b.addEventListener('click', async () => {
    if (busy) return; busy = true;
    $$('[data-moment]').forEach(x => x.disabled = true);
    try{ status('PLAYING…'); await MOMENTS[b.dataset.moment](); status(b.textContent); }
    catch(err){ console.error(err); status('ERROR — ' + err.message); }
    finally{ busy = false; $$('[data-moment]').forEach(x => x.disabled = false); setTimeout(meters, 400); }
  }));
  $('#sl-opp').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || busy) return; opp = b.dataset.v; sync(); $('[data-moment="deal"]').click(); });

  const cmp = $('#sl-compare');
  const hold = on => { comparing = on; cmp.classList.toggle('is-held', on); send(); };
  cmp.addEventListener('pointerdown', e => { e.preventDefault(); hold(true); });
  ['pointerup','pointercancel','pointerleave'].forEach(t => cmp.addEventListener(t, () => { if (comparing) hold(false); }));

  $('#sl-copy').addEventListener('click', async () => {
    const lines = ROWS.filter(r => !r.when || r.when(S)).map(r => '- ' + label(r) + ': ' + value(r) + (S[r.k] === r.today ? '' : '  *'));
    const text = 'Table space settings (iPhone 15 Pro Max; * = changed from today):\n' + lines.join('\n') + '\nLink: ' + location.href;
    try{ await navigator.clipboard.writeText(text); $('#sl-copied').textContent = 'Copied. Paste it into the chat.'; }
    catch(e){ $('#sl-copied').textContent = 'Copy blocked here; the list above and this page\'s address hold your settings.'; }
  });

  function fit(){
    const st = $('.sl-stage'), k = Math.min(1, (st.clientHeight - (innerWidth > 980 ? 60 : 20)) / 964, (st.clientWidth - 30) / 462);
    $('#sl-phone').style.setProperty('--fit', k.toFixed(3));
  }
  window.addEventListener('resize', fit);

  window.__spaceLabPage = { MOMENTS, get settings(){ return Object.assign({}, S); }, set(o){ Object.assign(S, o); changed(); }, get busy(){ return busy; }, meters, PRESETS, TODAY };

  readHash(); buildForm(); sync(); fit();
  (async () => { busy = true; try{ await freshTable(); status('YOUR TURN'); }catch(err){ console.error(err); status('ERROR — ' + err.message); } finally{ busy = false; } })();
})();
