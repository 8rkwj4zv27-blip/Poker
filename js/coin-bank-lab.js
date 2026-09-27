"use strict";

/* ============================================================
   COIN BANK LAB — the controls, inside the game (Lab 2 of the coin
   economy pass)

   Runs in the game copy the host page (coin-bank-lab.html, on
   js/showdown-lab-host.js) builds, with Lab 1's pieces
   (js/coin-denom-world.js, js/coin-denom-table.js, the owner's settled
   picks) and the candidate bank (js/coin-bank.js + css/coin-bank.css).
   A TUNE key opens a bottom sheet: MOMENTS (deal straight to a bet, a win
   or a loss, deep or short) and THE BANK (the style, its tags, how change
   plays out). Picks go to CoinWorld.OPT at once and to the host.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, opp:'3', sound:'on', moment:null };
  const $id = id => document.getElementById(id);
  const CW = () => window.CoinWorld;

  /* ---- the picks (first option of each row is my suggestion) ---- */
  const GROUPS_LAB1 = [
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
  const GROUPS = [
    { title:'THE BANK', sub:'Your stack as the felt\'s pieces, at the small blind, in the same housing.', rows:[
      ['bank','INSIDE', [['tubes','TUBES'],['shelves','SHELVES'],['hopper','HOPPER'],['today','TODAY']], 'TUBES: a coin changer; coins stack edge-on like a coin roll, pay out from the bottom and drop in at the top. SHELVES: a lit velvet case, small coins up top, big coins in the middle, bars on the floor. HOPPER: a glass tank of gold that fills with your stack. TODAY: the rack as it ships.'],
      ['bankLabels','TUBE TAGS', [['values','VALUES'],['counts','COUNTS'],['off','OFF']], 'On the brass under each tube: what one piece is worth, or how many are in it.'],
      ['bankChange','MAKING CHANGE', [['3','SHOW 3'],['1','SHOW 1'],['0','AT ONCE']], 'When a bet needs small coins the bank hasn\'t got, a big coin pops into five; when there are too many small coins, five pop into a big one. How many of those play out each time.']
    ]}
  ];
  const ROWS = GROUPS.flatMap(g => g.rows);
  // Lab 1's pieces as the owner settled them (the first of each row)
  const SUGGESTED = Object.assign(Object.fromEntries(GROUPS_LAB1.flatMap(g => g.rows).map(r => [r[0], r[2][0][0]])), Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]])));
  let order = Object.assign({}, SUGGESTED, state.order || {});
  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  function apply(){
    const W = CW(); if (!W) return;
    const O = W.OPT;
    O.bigLook = order.bigLook; O.barLook = order.barLook;
    O.bigScale = +order.bigScale; O.barScale = +order.barScale;
    O.betCap = +order.betCap; O.allinCap = +order.allinCap; O.potCap = +order.potCap;
    O.denom = order.denom; O.mergeShow = order.mergeShow;
    const restyle = O.bank !== order.bank || O.bankLabels !== order.bankLabels;
    O.bank = order.bank; O.bankLabels = order.bankLabels; O.bankChange = order.bankChange;
    if (restyle && typeof game !== 'undefined' && game) try{ CoinTable.reset(); CoinTable.renderBank(); }catch(e){ console.error(e); }
    paintKey(); save();
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
    ['call','CALL + WIN'], ['lose','CALL + LOSE'],
    ['raise','RAISE 3 BB'], ['bigraise','BIG RAISE · CHANGE'],
    ['allinwin','ALL IN · YOU WIN'], ['allinlose','ALL IN · YOU LOSE'],
    ['monster','WIN A MONSTER POT', true],
    ['deep','DEEP STACK 150 BB'], ['short','SHORT STACK 6 BB'],
    ['blindsup','BLINDS GO UP', true]
  ];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], order[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.id = 'sdl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.id = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Coin bank lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="pieces">THE BANK</button><button type="button" data-tab="settings">SETTINGS</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="moments"><p class="sdl-sub">Each one deals a fresh table and plays to the moment. Watch your bank (bottom left): what leaves it when you bet, what drops in when you win, and the change it makes.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<button type="button" class="sdl-again" data-moment="replay">PLAY THE LAST ONE AGAIN</button></section>' +
        '<section data-pane="pieces" hidden>' +
          GROUPS.map(g => '<h3>' + g.title + '<small>' + g.sub + '</small></h3>' + g.rows.map(row).join('')).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="settings" hidden><h3>THE TABLE</h3>' +
          '<div class="sdl-row"><div class="sdl-name">OPPONENTS</div>' + seg('opp', [['2','2'],['3','3'],['4','4'],['5','5']], state.opp) + '</div>' +
          '<div class="sdl-row"><div class="sdl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
          '<p class="sdl-sub">The pieces on the felt are Lab 1\'s, as you settled them: ring big coin, ingot bars, 16 a bet, 24 all in, 60 in the pot.</p></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
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
        const text = 'Coin bank (lab 2):\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === order[r[0]]) || ['', order[r[0]]])[1]).join('\n');
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
  const rankOf = (p, board) => evaluate7(p.hand.concat(board));
  const cmp = (a, b, board) => compareHands(rankOf(a, board), rankOf(b, board));
  // put the undealt cards in an order that gives the wanted result
  function stack(test){
    const need = 5 - game.board.length; if (need <= 0) return false;
    for (let t = 0; t < 6000; t++){
      const run = shuffle(game.deck.slice()).slice(0, need);
      if (!test(game.board.concat(run))) continue;
      const keys = new Set(run.map(cardKey));
      game.deck = game.deck.filter(c => !keys.has(cardKey(c))).concat(run.slice().reverse());
      return true;
    }
    return false;
  }
  const inOrder = list => board => list.every((p, i) => i === 0 || cmp(list[i - 1], p, board) > 0);
  const quiet = () => { try{ settings.sdAwardPot = 'auto'; settings.sdSmash = 'off'; }catch(e){} };
  const PLAYS = {
    async play(){ await deal(); },
    async call(){ const [r] = await seat(1); stack(inOrder([human(), r])); await playOut([r]); },
    async lose(){ const [r] = await seat(1); stack(inOrder([r, human()])); await playOut([r]); },
    async raise(){ const [a, c] = await seat(2); stack(inOrder([human(), a, c])); await playOut([a, c], 3); },
    // a raise big enough that the bank must break big coins into small
    async bigraise(){ const [a] = await seat(1); setStack(a, 150); setStack(human(), 150); stack(inOrder([human(), a])); await playOut([a], 12); },
    async allinwin(){ const [r] = await seat(1); setStack(r, 25); setStack(human(), 25); stack(inOrder([human(), r])); quiet(); await allIn([r]); },
    async allinlose(){ const [r] = await seat(1); setStack(r, 40); setStack(human(), 25); stack(inOrder([r, human()])); await allIn([r]); },
    async monster(){ const [a, c, d] = await seat(3); [a, c, d, human()].forEach(p => setStack(p, 60)); stack(inOrder([human(), a, c, d])); quiet(); await allIn([a, c, d]); },
    async deep(){ const [r] = await seat(1); setStack(r, 150); setStack(human(), 150); stack(inOrder([human(), r])); await playOut([r], 4); },
    async short(){ const [r] = await seat(1); setStack(human(), 6); setStack(r, 30); stack(inOrder([human(), r])); await playOut([r]); },
    // the same stack at twice the blinds: the bank changes up
    async blindsup(){
      const [r] = await seat(1); setStack(human(), 60); await sleep(900);
      game.smallBlind *= 2; game.bigBlind *= 2; try{ CoinTable.rebuildBank(); }catch(e){}
      await sleep(2200);
      stack(inOrder([human(), r])); await playOut([r]);
    }
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
