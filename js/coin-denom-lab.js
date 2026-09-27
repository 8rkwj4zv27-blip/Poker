"use strict";

/* ============================================================
   COIN DENOMINATIONS LAB — the controls, inside the game (Lab 1)

   Runs in the game copy the host page (coin-denom-lab.html, reusing
   js/showdown-lab-host.js) builds, where js/coin-denom-world.js and
   js/coin-denom-table.js stand in for the shipped coin files. A TUNE key
   opens a bottom sheet: MOMENTS (deal straight to a bet size or a pot),
   THE PIECES (the big coin, the bar, the limits, the change-up) and
   SETTINGS. Picks go to CoinWorld.OPT at once and to the host, so they
   survive the reload each moment starts with.

   Moments play the real game (the showdown lab's DEV hooks: forced
   all-ins and calls); the engine settles every hand for real. Nothing here
   changes a rule or a chip: only how the money looks on the felt.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, opp:'3', sound:'on', moment:null };
  const $id = id => document.getElementById(id);
  const CW = () => window.CoinWorld;

  /* ---- the picks (first option of each row is my suggestion) ---- */
  const GROUPS = [
    { title:'THE PIECES', sub:'All gold. A small coin is the small blind; a big coin is five small; a bar is five big.', rows:[
      ['bigLook','BIG COIN', [['ring','RING'],['deep','DEEP GOLD'],['plain','PLAIN']], 'RING: a raised ring inside the rim. DEEP GOLD: the ring, in a richer, redder gold. PLAIN: just bigger.'],
      ['bigScale','BIG COIN SIZE', [['1.4','1.4×'],['1.3','1.3×'],['1.55','1.55×']]],
      ['barLook','BAR', [['stamped','STAMPED'],['bullion','BULLION'],['treasure','TREASURE'],['ingot','LAB 1']], 'STAMPED: a cast ingot, sloped sides lit and shaded, a stamped panel and a glint. BULLION: the three-quarter vault bar, its end face showing, heavy. TREASURE: the arcade bar, bright with a star sparkle and rivets. LAB 1: the first ingot, to compare.'],
      ['barScale','BAR LENGTH', [['1.75','1.75×'],['1.6','1.6×'],['1.9','1.9×']]]
    ]},
    { title:'HOW MANY', sub:'A bet throws one small coin per small blind, up to its limit. Past the limit, five small coins become a big one (five big a bar) until it fits.', rows:[
      ['betCap','PER BET', [['16','16'],['12','12'],['20','20'],['24','24']]],
      ['allinCap','ALL IN', [['24','24'],['20','20'],['30','30']]],
      ['potCap','THE POT', [['60','60'],['50','50'],['80','80']], 'After each street the pot changes up to stay under this many pieces.'],
      ['denom','COUNTING', [['on','NEW'],['off','TODAY']], 'TODAY is the game as it ships (small coins only, your bets from the rack), to compare.']
    ]},
    { title:'THE CHANGE-UP', sub:'When the pot passes its limit.', rows:[
      ['mergeShow','SHOW IT', [['some','FIRST 3'],['all','EVERY ONE'],['none','AT ONCE']], 'Five pieces hop up off the pile, clink together, pop into the next piece up and drop back. The rest change at once, then the pile tidies.'],
      ['key','RATE KEY', [['one','SMALL COIN'],['all','ALL THREE'],['off','OFF']], 'A key on the pot plate: what a small coin is worth at these blinds.']
    ]}
  ];
  const ROWS = GROUPS.flatMap(g => g.rows);
  const SUGGESTED = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  let order = Object.assign({}, SUGGESTED, state.order || {});
  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  function apply(){
    const W = CW(); if (!W) return;
    const O = W.OPT;
    O.bigLook = order.bigLook; O.barLook = order.barLook;
    O.bigScale = +order.bigScale; O.barScale = +order.barScale;
    O.betCap = +order.betCap; O.allinCap = +order.allinCap; O.potCap = +order.potCap;
    O.denom = order.denom; O.mergeShow = order.mergeShow;
    paintKey(); paintLineup(); save();
  }

  /* ---- the rate key on the pot plate ---- */
  const sprite = (col, scale) => {
    const W = CW(), d = W.pieceD(col), url = W.frames(col, d).front[1], h = W.pieceH(col);
    return '<i class="cdl-px" style="width:' + Math.round(d * scale) + 'px;height:' + Math.round(h * scale) + 'px;background-image:' + url + '"></i>';
  };
  function paintKey(){
    const plate = document.querySelector('#pot-area .pot-chip'); if (!plate || !CW()) return;
    let k = plate.querySelector('.cdl-key');
    if (order.key === 'off' || order.denom === 'off'){ if (k) k.remove(); return; }
    const u = typeof game !== 'undefined' && game ? Math.max(1, game.smallBlind || 1) : 10;
    const html = order.key === 'all'
      ? CW().KINDS.map(c => sprite(c, .8) + '<b>' + (u * CW().valueOf(c)).toLocaleString() + '</b>').join('')
      : sprite('gold', .8) + '<b>=' + u.toLocaleString() + '</b>';
    if (!k){ k = document.createElement('span'); k.className = 'cdl-key'; plate.appendChild(k); }
    if (k._html !== html){ k._html = html; k.innerHTML = html; }
  }
  function paintLineup(){
    const el = document.querySelector('.cdl-lineup'); if (!el || !CW()) return;
    const u = typeof game !== 'undefined' && game ? Math.max(1, game.smallBlind || 1) : 10;
    el.innerHTML = CW().KINDS.map(c => '<figure>' + sprite(c, 3) + '<figcaption>' + CW().PIECES[c].name.toUpperCase() + '<b>' + (u * CW().valueOf(c)).toLocaleString() + '</b>' +
      (c === 'gold' ? '' : '<small>= ' + CW().valueOf(c) + ' SMALL</small>') + '</figcaption></figure>').join('');
  }

  /* ---- the key and the sheet ---- */
  const MOMENTS = [
    ['play','PLAY A HAND', true],
    ['blinds','BLINDS + A CALL'], ['raise','RAISE 3 BB'],
    ['bigraise','BIG RAISE 10 BB'], ['shove','THEY SHOVE'],
    ['allin','ALL IN · HEADS-UP'], ['threeway','3-WAY ALL IN'],
    ['monster','MONSTER POT · 4 ALL IN', true],
    ['late','LATE BLINDS 300/600 · ALL IN', true]
  ];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], order[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.id = 'sdl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.id = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Coin denominations lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="pieces">THE PIECES</button><button type="button" data-tab="settings">SETTINGS</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="moments"><p class="sdl-sub">Each one deals a fresh table and plays to the moment. Watch the bet spots and the pot tray. The big all-ins change up in the pot after the sweep.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<button type="button" class="sdl-again" data-moment="replay">PLAY THE LAST ONE AGAIN</button></section>' +
        '<section data-pane="pieces" hidden><div class="cdl-lineup" aria-label="The three pieces at these blinds"></div>' +
          GROUPS.map(g => '<h3>' + g.title + '<small>' + g.sub + '</small></h3>' + g.rows.map(row).join('')).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="settings" hidden><h3>THE TABLE</h3>' +
          '<div class="sdl-row"><div class="sdl-name">OPPONENTS</div>' + seg('opp', [['2','2'],['3','3'],['4','4'],['5','5']], state.opp) + '</div>' +
          '<div class="sdl-row"><div class="sdl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
          '<p class="sdl-sub">Not in this lab yet: your bank. It still shows small coins; bigger pieces you win melt in at the hatch. The bank gets its own lab.</p></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); if (on) paintLineup(); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.moment){
        const m = t.dataset.moment === 'replay' ? (state.last || 'play') : t.dataset.moment;
        open(false);
        if (host){ host.set({ last:m }); host.play(m); } else run(m);
        return;
      }
      const s = t.closest('.sdl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        if (k === 'opp' || k === 'sound'){
          state[k] = v; if (host) host.set({ [k]:v });
          if (k === 'sound') try{ settings.sound = v === 'on'; }catch(err){}
        } else { order[k] = v; apply(); }
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        return;
      }
      if (t.dataset.act === 'reset'){ order = Object.assign({}, SUGGESTED); apply(); paint(); return; }
      if (t.dataset.act === 'copy'){
        const text = 'Coin denominations (lab 1):\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === order[r[0]]) || ['', order[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('.sdl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }
  function paint(){
    document.querySelectorAll('.sdl-seg').forEach(s => {
      const k = s.dataset.key, cur = k === 'opp' || k === 'sound' ? state[k] : order[k];
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === cur));
    });
  }

  /* ---- moments: the real game, played to the moment ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  const setDev = (on, fast) => { DEV_MODE = !!on; FAST_DEV = !!(on && fast); };
  const human = () => game.players.find(p => p.isHuman);
  const opps = () => game.players.filter(p => !p.isHuman && !p.eliminated);
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !$id('actions-row').classList.contains('disabled') && !$id('console-flip').classList.contains('flipped'));
  const passive = () => { const call = game.currentBet - pendingHumanPlayer.betThisRound; humanAct(call > 0 ? 'call' : 'check'); };
  async function deal(need){
    startSinglePlayerRun({ opponentCount:Math.max(Number(state.opp) || 3, need || 1) });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    await sleep(250);
  }
  function foldAllBut(keep){
    opps().forEach(p => { if (!keep.includes(p) && p.inHand && !p.folded && !p.allIn) applyAction(p, { action:'fold' }); });
    render();
  }
  async function seat(n){
    for (let tries = 0; tries < 6; tries++){
      await deal(n + (tries > 1 ? 1 : 0));
      const ins = opps().filter(p => p.inHand && !p.folded && !p.allIn);
      if (ins.length >= n){ const pick = ins.slice(0, n); foldAllBut(pick); return pick; }
    }
    throw new Error('could not seat ' + n + ' rivals');
  }
  const setStack = (p, bb) => { p.chips = Math.max(1, Math.round(bb * game.bigBlind) - p.betThisRound); render(); try{ CoinTable.rebuildBank(); }catch(e){} };
  async function playOut(rivals, betBB){
    setDev(true, false);
    await waitFor(() => {
      rivals.forEach(p => { if (!p.folded && !p.allIn) p._devAutoCall = true; });
      if (myTurn()){
        if (betBB && game.phase === 'preflop' && !playOut.bet){
          playOut.bet = true;
          const b = wagerBounds(game, pendingHumanPlayer);
          humanAct('raise', Math.max(b.min, Math.min(b.max, Math.round(betBB * game.bigBlind))));
        } else passive();
      }
      return game.phase === 'showdown' || game.phase === 'foldwin' || game.over;
    }, 90000);
    setDev(false);
  }
  async function allIn(rivals){
    setDev(true, false);
    rivals.forEach(p => { p._devForceAllIn = true; });
    if (myTurn()) humanAct('allin');
    await waitFor(() => { if (myTurn()) passive(); return game.phase === 'showdown' || game.over; }, 90000);
    setDev(false);
  }
  async function watch(a, c){
    setDev(true, false);
    a._devForceAllIn = true;
    if (myTurn()) humanAct('fold');
    await waitFor(() => { if (!c.folded && !c.allIn) c._devAutoCall = true; return game.phase === 'showdown' || game.over; }, 90000);
    setDev(false);
  }
  const PLAYS = {
    async play(){ await deal(); },
    async blinds(){ const [r] = await seat(1); await playOut([r]); },
    async raise(){ const [a, c] = await seat(2); await playOut([a, c], 3); },
    async bigraise(){ const [a, c] = await seat(2); setStack(a, 60); setStack(c, 60); setStack(human(), 60); await playOut([a, c], 10); },
    async shove(){ const [a, c] = await seat(2); setStack(a, 40); setStack(c, 40); await watch(a, c); },
    async allin(){ const [r] = await seat(1); setStack(r, 25); setStack(human(), 25); await allIn([r]); },
    async threeway(){ const [a, c] = await seat(2); [a, c, human()].forEach(p => setStack(p, 60)); await allIn([a, c]); },
    async monster(){ const [a, c, d] = await seat(3); [a, c, d, human()].forEach(p => setStack(p, 100)); await allIn([a, c, d]); },
    async late(){ const [r] = await seat(1); setStack(r, 25); setStack(human(), 25); await allIn([r]); }
  };
  let busy = false;
  async function run(m){
    if (busy || !PLAYS[m]) return;
    busy = true;
    try{ await PLAYS[m](); }catch(err){ console.error(err); }
    finally{ busy = false; }
  }
  window.__cdLab = { run, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); apply(); paint(); }, get busy(){ return busy; } };

  /* ---- start ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = state.sound !== 'off'; }catch(e){}
    const m = state.moment;
    // LATE BLINDS: the table is dealt at 300/600, deep enough to play
    if (m === 'late'){ ELIMINATION_CONFIG.smallBlind = 300; ELIMINATION_CONFIG.bigBlind = 600; ELIMINATION_CONFIG.startingStack = 15000; }
    apply();
    build();
    setInterval(paintKey, 400);
    if (host) host.set({ moment:null });
    run(m || 'play');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
