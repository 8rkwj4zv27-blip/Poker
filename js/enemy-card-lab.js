"use strict";

/* ============================================================
   ENEMY CARDS ORDER FORM, ROUND 2 (Lab)

   The real game (index.html, every production script and stylesheet) runs
   in a same-origin sandboxed frame at the owner's phone (iPhone 15 Pro
   Max, installed app: 430 x 932, the game's env(safe-area-*) rewritten to
   59px top / 34px bottom, as table-space-lab.html does), with
   css/enemy-card.css and js/enemy-card.js injected. The form is the
   order: one row per job on the opponents' seats and their places on the
   felt. Each change goes to the game with EnemyCard.apply().

   Enemy Cards V2 is live (v0.41.0: css/enemy-cards.css, js/enemy-cards.js,
   the owner's round-3 order). The copy strips those two files and runs
   the candidate on V1 cards instead, so every option can still be
   compared; the candidate answers the coin table's EnemyCards questions
   (coinSource, spot, rowKey) itself.

   ISOLATION: the same scheme as the other order-form Labs. The copy is
   built as srcdoc with a shim that replaces Storage in the frame with an
   in-memory map before any game script runs, and the service-worker block
   is stripped; if either fails the game is not started. This page never
   touches localStorage.
   ============================================================ */
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const frame = $('#sl-frame');
  const status = t => { $('#sl-status').textContent = t; };
  // A hosted copy may publish the game under another name (index.html is
  // reserved there); it says so before this script runs.
  const GAME = window.EC_LAB_GAME || 'index.html';
  const V = '4';

  /* The form. The first option of every row is V1 (value '0'), except
     REACTS, which only matters with a rim light. */
  const SECTIONS = [
    { title:'THE CARD', jobs:[
      { key:'cabinet', name:'CABINET', hint:'the case', opts:[
        ['0','V1', 'Every card the same grey-green box.'],
        ['painted','PAINTED', 'Your pick from round 1: the case takes a wash of the face\'s colour, with a stripe under the name and coloured rivets.']] },
      { key:'name', name:'NAME', hint:'on the plate', opts:[
        ['0','STYLE', 'Today: their playing style as a name (SHARK, PROF, MANIAC).'],
        ['cast','CHARACTER', 'A character name (NIGEL, LUCY, TONY…). Flag: shipping this is a game change, not just the card: the log, banner and results use the name too.', 'flag']] },
      { key:'readout', name:'READOUT', hint:'what they just did', opts:[
        ['0','V1', 'Today\'s one-line slot: long labels shrink or get cut, and a bet prints dark on dark.'],
        ['two','TWO LINE', 'A small CRT: the action on top, the amount under it. Money gold for bets and calls, red for all in.'],
        ['roll','TWO LINE + COUNT', 'The same, and the amount counts up like a till when it changes.']] },
      { key:'cards', name:'HOLE CARDS', hint:'where their cards sit', opts:[
        ['0','IN THE BOX', 'Today: a row inside the card, hanging out of the bottom.'],
        ['under','TUCKED UNDER', 'Out of the box, behind the cabinet: a strip shows under the bottom edge. They\'re dealt to just below the card and slide up under it; at showdown they slide right out, a size up.'],
        ['fan','TUCKED + FANNED', 'The same, the pair splayed a little as it peeks out.']] },
      { key:'slot', name:'COIN SLOT', hint:'where coins leave and come home', opts:[
        ['0','NONE', 'Today: coins appear from under their cards and vanish there.'],
        ['slit','SLIT', 'A coin slit in the base of the card. It glows while coins go out or come in, and the coins leave from it.'],
        ['hatch','HATCH', 'Two little doors over the slot that part when coins pass, like your bank hatch.'],
        ['cup','CUP', 'A coin-return cup sunk into the base.']] },
      { key:'face', name:'FACE SIZE', hint:'the portrait', opts:[
        ['0','TODAY', 'The shipped size.'],
        ['95','95%', 'A touch smaller (the open item from the spacing pass).'],
        ['90','90%', 'Smaller again.']] }
    ]},
    { title:'THE LIGHT', jobs:[
      { key:'rim', name:'RIM LIGHT', hint:'a lamp round the cabinet', opts:[
        ['0','NONE', 'Today: the border turns gold on their turn.'],
        ['amber','AMBER', 'A lamp tube in the cabinet\'s own border, dark at rest, amber on their turn, red when all in: the dashboard\'s language.'],
        ['own','OWN + AMBER', 'The tube glows faintly in their colour at rest; amber on their turn.'],
        ['ownall','OWN COLOUR', 'Their colour at rest and on their turn; still red for all in, warm for a win.']] },
      { key:'react', name:'RIM REACTS TO', hint:'with a rim light', opts:[
        ['turn','TURN', 'Their turn, all in, a win, going out.'],
        ['full','EVERYTHING', 'Also: breathes while they think, one flash when they bet, call or raise, goes dark when they fold, flickers out when they\'re knocked out.']] },
      { key:'next', name:'NEXT TO ACT', hint:'who\'s up after this', opts:[
        ['0','NONE', 'Today: nothing.'],
        ['rim','RIM PRE-LIGHT', 'The next seat\'s rim lights dimly (needs a rim light).'],
        ['pip','PIP', 'A small blinking lamp on the next seat\'s name plate.']] },
      { key:'gauge', name:'STACK GAUGE', hint:'under the stack', opts:[
        ['0','NONE', 'Today: just the number.'],
        ['tube','GAUGE', 'A thin bar under the stack: how big it is against the table\'s biggest stack.'],
        ['short','GAUGE + SHORT', 'The same, and it turns red and blinks under 10 big blinds.']] }
    ]},
    { title:'ON THE FELT', jobs:[
      { key:'squares', name:'BET SQUARE', hint:'where their coins land (yours too)', opts:[
        ['0','NONE', 'Today: the coins land on plain felt.'],
        ['faint','FAINT', 'A square of slightly darker felt right under each seat, and one above your cards; the coins land in it.'],
        ['pressed','PRESSED', 'Darker, and pressed a little into the table.'],
        ['stitched','STITCHED', 'Darker, with a faint stitched edge like the rail.']] },
      { key:'blinds', name:'BLINDS', hint:'SB and BB', opts:[
        ['0','ON THE FACE', 'Today: a little red puck on the portrait\'s corner.'],
        ['slide','PUCKS · SLIDE', 'Wide, flat pucks on the felt beside the bet square; each hand the dealer pushes them on to the next seats.'],
        ['toss','PUCKS · TOSS', 'The same pucks, tossed to the next seats: a flat arc, a turn over, a heavy landing.']] }
    ]},
    { title:'BEHAVIOUR', jobs:[
      { key:'moves', name:'CABINET MOVES', hint:'on a check / all in', opts:[
        ['0','NONE', 'Today: the card doesn\'t move.'],
        ['knock','KNOCK', 'A check: the cabinet taps the table twice, with a knock.'],
        ['both','KNOCK + SHUDDER', 'And an all in: the whole cabinet shudders once.']] },
      { key:'fold', name:'FOLD', hint:'their cards', opts:[
        ['0','V1', 'Today: the card and cards dim.'],
        ['in','CARDS GO IN', 'The cards slide back into the cabinet and are gone; the card dims.']] }
    ]}
  ];
  const JOBS = SECTIONS.flatMap(s => s.jobs);
  const V1 = Object.fromEntries(JOBS.map(j => [j.key, j.opts[0][0]]));
  // The owner's final (round-3) order, now live in the game (v0.41.0).
  const SUGGESTED = { cabinet:'painted', name:'cast', readout:'roll', cards:'under', slot:'cup', face:'0',
    rim:'ownall', react:'full', next:'rim', gauge:'0', squares:'faint', blinds:'0', moves:'both', fold:'in' };
  let order = Object.assign({}, SUGGESTED);
  const view = { opp:'4', theme:'emerald', sound:'on', motion:'on' };
  let comparing = false;

  function readHash(){
    const q = new URLSearchParams(location.hash.slice(1));
    JOBS.forEach(j => { const v = q.get(j.key); if (v && j.opts.some(o => o[0] === v)) order[j.key] = v; });
    Object.keys(view).forEach(k => { const v = q.get(k); if (v) view[k] = v; });
  }
  function writeHash(){ try{ history.replaceState(null, '', '#' + new URLSearchParams(Object.assign({}, order, view)).toString()); }catch(e){} }

  /* ---- the form ---- */
  function buildForm(){
    $('#sl-rows').innerHTML = SECTIONS.map(s => '<h3 class="sl-sec">' + s.title + '</h3>' + s.jobs.map(j =>
      '<div class="sl-job" data-job="' + j.key + '"><div class="sl-job-head"><b>' + j.name + '</b><small>' + j.hint + '</small></div>' +
      '<div class="sl-seg">' + j.opts.map(o => '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>' +
      '<div class="sl-job-note"></div></div>').join('')).join('');
    $('#sl-rows').addEventListener('click', e => {
      const b = e.target.closest('button'), job = b && b.closest('[data-job]');
      if (!job) return;
      order[job.dataset.job] = b.dataset.v;
      sync(); send();
    });
  }
  function sync(){
    JOBS.forEach(j => {
      const row = $('[data-job="' + j.key + '"]');
      $$('button', row).forEach(b => b.classList.toggle('is-on', b.dataset.v === order[j.key]));
      const o = j.opts.find(x => x[0] === order[j.key]);
      const note = $('.sl-job-note', row);
      note.textContent = o ? o[2] : '';
      note.classList.toggle('is-flag', !!(o && o[3] === 'flag'));
    });
    $$('[data-view]').forEach(seg => $$('button', seg).forEach(b => b.classList.toggle('is-on', view[seg.dataset.view] === b.dataset.v)));
    $('#sl-summary').innerHTML = JOBS.map(j => {
      const o = j.opts.find(x => x[0] === order[j.key]);
      return '<li class="' + (order[j.key] === j.opts[0][0] ? 'is-today' : '') + '">' + j.name.charAt(0) + j.name.slice(1).toLowerCase() + ': <b>' + o[1] + '</b></li>';
    }).join('');
    writeHash();
  }
  const win = () => frame.contentWindow;
  const bridge = () => { try{ return win().__ecLab || null; }catch(e){ return null; } };
  function send(){
    const w = win();
    if (!bridge() || !w.EnemyCard) return;
    w.EnemyCard.apply(comparing ? V1 : order);
    setTimeout(measure, 450);
  }
  function applyView(){
    const b = bridge(); if (!b || !b.settings) return;
    b.settings.theme = view.theme; b.settings.sound = view.sound === 'on'; b.settings.reduceMotion = view.motion === 'off';
    try{ win().applyTheme(); }catch(e){}
    try{ win().document.body.setAttribute('data-motion', view.motion === 'off' ? 'off' : 'on'); }catch(e){}
  }

  /* ---- how much room a card takes: now, against V1 ---- */
  let v1Size = null;
  function footprint(){
    try{
      const d = win().document, seat = d.querySelector('#felt .seat:not(.you):not(.seat-vacated)');
      if (!seat) return null;
      const rs = [seat.querySelector('.seat-card'), ...seat.querySelectorAll('.seat-cards .card')].map(el => el.getBoundingClientRect()).filter(r => r.width);
      const T = Math.min(...rs.map(r => r.top)), B = Math.max(...rs.map(r => r.bottom));
      const c = rs[0];
      return { w:Math.round(c.width), h:Math.round(B - T), card:Math.round(c.height) };
    }catch(e){ return null; }
  }
  function measure(){
    const f = footprint(), el = $('#ec-size');
    if (!f){ el.textContent = ''; return; }
    if (!v1Size){ el.innerHTML = 'CARD ' + f.w + ' × ' + f.h + 'px'; return; }
    const dh = f.h - v1Size.h, dw = f.w - v1Size.w;
    const tag = (d, u) => d === 0 ? '' : ' <span class="' + (d > 0 ? 'is-up' : 'is-down') + '">' + (d > 0 ? '+' : '') + d + u + '</span>';
    el.innerHTML = 'CARD + ITS CARDS ' + f.w + ' × ' + f.h + 'px' + tag(dh, 'px tall') + tag(dw, 'px wide') + '<br><i>V1 AT THIS TABLE ' + v1Size.w + ' × ' + v1Size.h + 'px</i>';
  }

  /* ---- the sandboxed real game ---- */
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
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('enemy card lab')); }; }catch(e){} }
    window.__ecLabIsolated = (function(){ try{ localStorage.setItem('__ec','1'); return mem.__ec === '1'; }catch(e){ return false; } })();
  })();`;
  // Runs after every production script: the phone's safe areas (as
  // js/table-space-lab-frame.js does), and the handle the lab drives.
  const BRIDGE = `(function(){
    var SAFE = { top:59, bottom:34, left:0, right:0 };
    var re = /env\\(\\s*safe-area-inset-(top|bottom|left|right)\\s*(?:,[^()]*(?:\\([^()]*\\)[^()]*)*)?\\)/g;
    var fix = function(v){ return v.replace(re, function(m, side){ return SAFE[side] + 'px'; }); };
    var walk = function(rules){
      for (var i = 0; i < rules.length; i++){
        var r = rules[i];
        if (r.style){
          for (var j = 0; j < r.style.length; j++){
            var p = r.style[j], v = r.style.getPropertyValue(p);
            if (v && v.indexOf('safe-area-inset') !== -1) r.style.setProperty(p, fix(v), r.style.getPropertyPriority(p));
          }
        }
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (var k = 0; k < document.styleSheets.length; k++){ try{ walk(document.styleSheets[k].cssRules); }catch(e){} }
  })();
  window.__ecLab = {
    get game(){ return typeof game === 'undefined' ? null : game; },
    get pending(){ return typeof pendingHumanPlayer === 'undefined' ? null : pendingHumanPlayer; },
    get settings(){ return typeof settings === 'undefined' ? null : settings; },
    setDev(on, fast){ DEV_MODE = !!on; FAST_DEV = !!(on && fast); },
    intro: typeof TableIntro === 'undefined' ? null : TableIntro
  };`;
  let source = null;
  async function buildDoc(){
    if (!source){ source = await (await fetch(GAME, { cache:'no-store' })).text(); }
    const sw = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    // the shipped Enemy Cards V2 parts come out of the copy: the candidate
    // (V1 cards plus the order) stands in for them, answering the same
    // EnemyCards questions the coin table asks
    const liveJs = /<script src="js\/enemy-cards\.js[^"]*"><\/script>/, liveCss = /<link rel="stylesheet" href="css\/enemy-cards\.css[^"]*">/;
    if (!sw.test(source) || !liveJs.test(source) || !liveCss.test(source) || !/<head>/i.test(source) || !/<\/body>/i.test(source))
      throw new Error('game page shape changed; refusing to build an unisolated copy');
    const base = new URL('.', location.href).href;
    return source.replace(sw, '').replace(liveJs, '').replace(liveCss, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/<\/body>/i, '<link rel="stylesheet" href="css/enemy-card.css?v=' + V + '"><script src="js/enemy-card.js?v=' + V + '"><\/script><script>' + BRIDGE + '<\/script></body>');
  }
  async function loadFrame(){
    status('LOADING…');
    const doc = await buildDoc();
    await new Promise(r => { frame.onload = () => r(); frame.srcdoc = doc + '<!-- ' + Date.now() + ' -->'; });
    if (!win().__ecLabIsolated){ frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>'; throw new Error('storage isolation failed'); }
    const b = bridge();
    if (b && b.intro) b.intro.uninstall();   // the table intro has its own lab; here it only slows each moment down
    applyView();
  }

  /* ---- moments: each plays the real game to that point ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }
  const doc = () => win().document;
  const myTurn = () => { const b = bridge(); return !!(b && b.game && !b.game.over && b.pending && !doc().getElementById('actions-row').classList.contains('disabled') && !doc().getElementById('console-flip').classList.contains('flipped')); };
  async function freshTable(){
    await loadFrame();
    status('DEALING…');
    win().startSinglePlayerRun({ opponentCount:Number(view.opp) });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    // the size against V1 at this table, then the order
    win().EnemyCard.apply(V1);
    await sleep(350);
    v1Size = footprint();
    send();
    await sleep(500);
  }
  // Carry on at this table when a hand is just finishing; a fresh table
  // only when there's no game (or it's over).
  async function ensureTurn(){
    if (!myTurn() && bridge() && g() && !g().over) await waitFor(() => { award(); nextHandKey(); return myTurn() || g().over; }, 15000);
    if (!myTurn()) await freshTable();
    const p = doc().getElementById('raise-panel'); if (p && p.classList.contains('show')) doc().getElementById('raise-cancel').click();
  }
  const g = () => bridge().game;
  const human = () => g().players.find(p => p.isHuman);
  const live = () => g().players.filter(p => !p.isHuman && p.inHand && !p.folded && !p.eliminated);
  const passive = () => { const call = g().currentBet - bridge().pending.betThisRound; win().humanAct(call > 0 ? 'call' : 'check'); };
  // Tap AWARD POT whenever the result waits for it, so moments carry on.
  function award(){
    const a = doc().getElementById('btn-award-pot-console');
    if (doc().getElementById('console-flip').classList.contains('flipped') && a && !a.disabled) a.click();
  }
  function nextHandKey(){
    const n = doc().getElementById('btn-next-hand');
    if (n && !n.classList.contains('hidden')) n.click();
  }
  // Order the rest of the real deck so `a` beats `b` (dealCommunity pops from the end, no burns).
  function rig(a, b){
    const w = win(), gg = g(), need = 5 - gg.board.length;
    if (need <= 0) return;
    for (let t = 0; t < 800; t++){
      const run = w.shuffle(gg.deck.slice()).slice(0, need);
      const board = gg.board.concat(run);
      if (w.compareHands(w.evaluate7(a.hand.concat(board)), w.evaluate7(b.hand.concat(board))) > 0){
        const keys = new Set(run.map(w.cardKey));
        gg.deck = gg.deck.filter(c => !keys.has(w.cardKey(c))).concat(run.slice().reverse());
        return;
      }
    }
  }
  // Heads-up to the river against one rival (who checks and calls), you
  // calling too; `rivalWins` decides the board.
  async function toShowdown(rivalWins){
    await ensureTurn();
    const [rival, ...rest] = live();
    if (!rival) return null;
    rest.forEach(p => { if (!p.allIn) win().applyAction(p, { action:'fold' }); });
    win().render();
    const me = human();
    if (rivalWins) rig(rival, me); else rig(me, rival);
    const b = bridge(); b.setDev(true, false);
    const ok = await waitFor(() => {
      if (!rival.folded && !rival.allIn) rival._devAutoCall = true;
      if (myTurn()) passive();
      return g().phase === 'showdown' && rival._reveal;
    }, 45000);
    b.setDev(false);
    return ok ? rival : null;
  }
  const MOMENTS = {
    async deal(){ await freshTable(); },
    async play(){
      await ensureTurn();
      const n = g().handNumber;
      passive();
      await waitFor(() => { award(); return myTurn() || g().handNumber !== n; }, 40000);
    },
    // A still: one of each action, painted through the real streetAction/render() path.
    async labels(){
      await ensureTurn();
      const L = [['raise','Raise to 1,240'],['call','Call 12,480'],['allin','All-In'],['bet','Bet 120'],['check','Check'],['fold','Fold']];
      g().players.filter(p => !p.isHuman && !p.eliminated).forEach((p, i) => { const [t, l] = L[i % L.length]; p.streetAction = { type:t, label:l, amount:1 }; });
      win().render();
    },
    async shove(){
      await ensureTurn();
      for (let tries = 0; tries < 3; tries++){
        const b = bridge(); b.setDev(true, false);
        const t = live().find(p => !p.allIn); if (t) t._devForceAllIn = true;
        passive();
        const ok = await waitFor(() => myTurn() && live().some(p => p.allIn), 20000);
        b.setDev(false);
        if (ok) return;
        if (!myTurn()) await freshTable();
      }
    },
    async showdown(){
      const r = await toShowdown(Math.random() < .5);
      if (r) await sleep(1200);
    },
    async oppwin(){
      const r = await toShowdown(true);
      if (!r) return;
      await sleep(900);
      await waitFor(() => { award(); return !doc().getElementById('btn-next-hand').classList.contains('hidden') || g().over; }, 30000);
    },
    async ko(){
      for (let tries = 0; tries < 3; tries++){
        await ensureTurn();
        const me = human(), b = bridge();
        const target = live().find(p => !p.allIn && p.chips + p.betThisRound <= me.chips + me.betThisRound);
        if (!target){ await freshTable(); continue; }
        live().forEach(p => { if (p !== target && !p.allIn) win().applyAction(p, { action:'fold' }); });
        b.setDev(true, false);
        target._devForceAllIn = true;
        if (!target.allIn) passive();
        const shoved = await waitFor(() => (myTurn() && target.allIn) || g().over || !target.inHand, 20000);
        if (shoved && myTurn() && target.allIn){
          win().humanAct('call');
          await sleep(60);
          rig(me, target);
          const done = await waitFor(() => { award(); return target.eliminated; }, 30000);
          b.setDev(false);
          if (done) return;
        }
        b.setDev(false);
      }
    },
    // Hurries the rest of this hand, then lets the new deal play at its
    // real speed so the cards can be watched going under the cabinets.
    async nexthand(){
      await ensureTurn();
      const n = g().handNumber, b = bridge();
      b.setDev(true, true);
      await waitFor(() => {
        award(); nextHandKey();
        if (myTurn() && g().handNumber === n) win().humanAct('fold');
        return g().handNumber > n;
      }, 40000);
      b.setDev(false);
      await waitFor(() => { award(); nextHandKey(); return myTurn(); }, 30000);
    },
  };
  let busy = false;
  const lock = on => { busy = on; $$('[data-moment]').forEach(x => x.disabled = on); };
  $$('[data-moment]').forEach(b => b.addEventListener('click', async () => {
    if (busy) return; lock(true);
    try{ status('PLAYING…'); await MOMENTS[b.dataset.moment](); status(b.textContent); }
    catch(err){ console.error(err); status('ERROR — ' + err.message); }
    finally{ lock(false); measure(); }
  }));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => { order = Object.assign({}, b.dataset.preset === 'v1' ? V1 : SUGGESTED); sync(); send(); }));
  const cmp = $('#sl-compare');
  const hold = on => { comparing = on; cmp.classList.toggle('is-held', on); send(); };
  cmp.addEventListener('pointerdown', e => { e.preventDefault(); hold(true); });
  ['pointerup','pointercancel','pointerleave'].forEach(t => cmp.addEventListener(t, () => { if (comparing) hold(false); }));
  $$('[data-view]').forEach(seg => seg.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const was = view[seg.dataset.view];
    view[seg.dataset.view] = b.dataset.v; sync(); applyView();
    if (seg.dataset.view === 'opp' && was !== b.dataset.v && !busy){
      lock(true);
      try{ await freshTable(); status('YOUR TURN'); }catch(err){ console.error(err); status('ERROR — ' + err.message); } finally{ lock(false); measure(); }
    }
  }));
  $('#sl-copy').addEventListener('click', async () => {
    const text = 'Enemy cards order (round 3):\n' + JOBS.map(j => '- ' + j.name + ': ' + j.opts.find(o => o[0] === order[j.key])[1]).join('\n');
    try{ await navigator.clipboard.writeText(text); $('#sl-copied').textContent = 'Copied. Paste it into the chat.'; }
    catch(e){ $('#sl-copied').textContent = 'Copy blocked here; the list above is your order.'; }
  });

  /* ---- the phone frame fits the stage (and a phone's whole screen) ---- */
  const phone = () => window.matchMedia('(max-width:760px)').matches;
  function fit(){
    const st = $('.sl-stage');
    const k = phone()
      ? Math.min(st.clientWidth / 430, st.clientHeight / 932)
      : Math.min(1, (st.clientHeight - 50) / 950, (st.clientWidth - 30) / 460);
    $('#sl-phone').style.setProperty('--fit', Math.max(.3, k).toFixed(3));
  }
  window.addEventListener('resize', fit);

  /* ---- phone: the form and the moments come up as sheets ---- */
  function sheet(v){
    document.body.dataset.sheet = v || '';
    $$('[data-sheet-key]').forEach(k => k.classList.toggle('is-on', k.dataset.sheetKey === v));
  }
  $$('[data-sheet-key]').forEach(k => k.addEventListener('click', () => sheet(document.body.dataset.sheet === k.dataset.sheetKey ? '' : k.dataset.sheetKey)));
  // A moment plays in the game, so the sheet gets out of the way first.
  $$('[data-moment]').forEach(b => b.addEventListener('click', () => { if (phone()) sheet(''); }, true));

  window.__ecForm = { MOMENTS, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); sync(); send(); }, get busy(){ return busy; }, view, measure };

  readHash(); buildForm(); sync(); fit();
  (async () => { lock(true); try{ await freshTable(); status('YOUR TURN'); }catch(err){ console.error(err); status('ERROR — ' + err.message); } finally{ lock(false); measure(); } })();
})();
