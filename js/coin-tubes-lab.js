"use strict";

/* ============================================================
   BANK TUBES LAB — the controls, inside the game (the bank's look, round 2)

   Owner on the shipped TUBES (v0.44.0): it works and the change-making is
   good, but it "doesn't read so good"; keep it simple. The candidate
   (js/coin-bank-tubes2.js + css/coin-bank-tubes2.css) adds one style to
   the live CoinBank, NEW TUBES: coins tipped toward you so a stack reads
   as coins, warm light, clearer glass, and the bars on a low shelf under
   two tubes (no empty tube). TODAY'S TUBES is the shipped one. Runs on the
   real game's coin files (nothing stripped), on the Showdown Lab's host.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, opp:'3', sound:'on', moment:null };
  const $id = id => document.getElementById(id);
  const CW = () => window.CoinWorld;

  /* ---- the picks (first option of each row is my suggestion) ---- */
  const GROUPS = [
    { title:'THE BANK', sub:'Same money, same change-making. Just the look.', rows:[
      ['bank','INSIDE', [['tubes2','NEW TUBES'],['tubes','TODAY\'S TUBES']], 'NEW TUBES: coins tipped toward you so each stack reads as coins, warm light from the lamp, clearer glass, and the bars stacked on a low shelf under two tubes. TODAY\'S TUBES: as it ships.'],
      ['bankChange','MAKING CHANGE', [['3','SHOW 3'],['1','SHOW 1'],['0','AT ONCE']]]
    ]}
  ];
  const ROWS = GROUPS.flatMap(g => g.rows);
  // Lab 1's pieces as the owner settled them (the first of each row)
  const SUGGESTED = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  let order = Object.assign({}, SUGGESTED, state.order || {});
  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  // the game's own Settings → Bank carries the pick (CoinTable.sync reads it)
  function apply(){
    try{ settings.bankStyle = order.bank; settings.bankChange = order.bankChange; settings.bankTags = 'off'; }catch(e){}
    if (typeof game !== 'undefined' && game) try{ CoinTable.restyleBank(); }catch(e){ console.error(e); }
    save();
  }
  function paintKey(){}

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
    sheet.className = 'sdl-sheet'; sheet.id = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Bank tubes lab');
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
          '<p class="sdl-sub">Everything else is the game as it ships (v0.44.0).</p></section>' +
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
        const text = 'Bank tubes (round 2):\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === order[r[0]]) || ['', order[r[0]]])[1]).join('\n');
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
