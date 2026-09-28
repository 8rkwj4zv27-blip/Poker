"use strict";

/* ============================================================
   CHIP LAB — the controls, inside the game (the coin economy, round 4)

   Owner: poker-chip coins. The same gold coin (size, weight, spin,
   bounce, sound) with its value in its colour, on a x5 ladder; the bank a
   pot of them; coins in and out of the bank through a slot. THE CHIPS:
   eight designs from simple to detailed (a gallery to tap through), two
   palettes, three ladders. THE BANK: the slot, the pile's shapes, how big
   it gets, the gleam. The chips are the game's own now (js/coin-world.js, js/coin-table.js, v0.45.0)
   stand in for the shipped coin files in the copy; css/coin-hoard.css is
   the bank's box, css/chip-lab.css the gallery.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, opp:'3', sound:'on', moment:null };
  const $id = id => document.getElementById(id);
  const CW = () => window.CoinWorld;

  /* ---- the picks (first option of each row is my suggestion) ---- */
  // round 2: TINT (the owner's pick) and eight new ones
  const DESIGNS = [['tint','TINT'],['flat','FLAT'],['duo','DUO'],['hollow','HOLLOW'],['star','STAR'],['dash','DASH'],['candy','CANDY'],['stripe','STRIPE'],['target','TARGET']];
  const GROUPS = [
    { title:'THE CHIPS', sub:'Every piece is the same gold coin; its colour is its value, five times the one before.', rows:[
      ['chipDesign','DESIGN', DESIGNS, 'Or tap one in the gallery above. TINT: the whole coin in its colour. FLAT: an arcade token, flat colour, a thick ring and one shine. DUO: two-tone, the centre lighter. HOLLOW: a token with a hole through it. STAR: TINT with a light star. DASH: a classic chip, cream dashes round the rim. CANDY: glossy, lit from above. STRIPE: one cream band across it. TARGET: rings, a bullseye.'],
      ['chipPalette','COLOURS', [['casino','CASINO'],['muted','MUTED']], 'CASINO is bright; MUTED sits with the velvet and brass.'],
      ['ladder','LADDER', [['silver','SILVER UP TO GOLD'],['ivory','IVORY UP TO GOLD'],['gold','GOLD LOWEST']], 'Lowest to highest, five times each: silver, red, green, black, purple, then gold (the top prize).']
    ]},
    { title:'THE BANK', sub:'A pot of your own: one colour per stack, the richest in the middle.', rows:[
      ['bankIn','IN AND OUT', [['slot','THROUGH A SLOT'],['arc','OVER THE TOP']], 'THROUGH A SLOT: wins go to the slot on top of your bank, click through and drop onto their own stack; bets hop up out of it and on to the felt.'],
      ['winStyle','WINNINGS', [['stream','ONE BY ONE'],['handfuls','HANDFULS']], 'ONE BY ONE: a stream through the slot, like a payout hopper. HANDFULS: in quick bursts.'],
      ['hoardSize','HOW BIG IT GETS', [['.65','BIG'],['.45','MEDIUM'],['.3','SMALL']], 'The bank is a pyramid of stacks in rows, four rows of four when full. It fills up as your stack grows; when it holds all it can, the coins turn richer instead (the money has no limit, the bank\'s space does).'],
      ['hoardGleam','GLEAM', [['rich','WHEN RICH'],['always','ALWAYS'],['off','OFF']]]
    ]}
  ];
  const ROWS = GROUPS.flatMap(g => g.rows);
  // Lab 1's pieces as the owner settled them (the first of each row)
  const SUGGESTED = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  let order = Object.assign({}, SUGGESTED, state.order || {});
  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  // the game's own Settings → Bank carries the pick (CoinTable.sync reads it)
  function apply(){
    try{ settings.bankStyle = 'hoard'; settings.bankTags = 'off'; }catch(e){}
    const W = CW(), O = W && W.OPT;
    if (O){
      const look = O.chipDesign !== order.chipDesign || O.chipPalette !== order.chipPalette || O.ladder !== order.ladder;
      O.hoardSize = order.hoardSize; O.hoardRest = order.hoardRest; O.hoardTidy = order.hoardTidy; O.hoardGleam = order.hoardGleam;
      O.chipDesign = order.chipDesign; O.chipPalette = order.chipPalette; O.ladder = order.ladder; O.bankIn = order.bankIn; O.winStyle = order.winStyle;
      O.mergeShow = 'none'; O.hoardRest = 'pyramid'; O.hoardTidy = 'pyramid';
      // a new look: every coin on the table redrawn at once
      if (look){ Object.values(W.zones || {}).forEach(z => z.list.forEach(b => { b.chip.frame = ''; W.dirty.add(b); })); W.kick(); }
      paintGallery();
    }
    if (typeof game !== 'undefined' && game) try{ CoinTable.restyleBank(); }catch(e){ console.error(e); }
    save();
  }
  function paintKey(){}
  // THE GALLERY: every design's ladder, lowest to highest, big; tap one
  function paintGallery(){
    const el = document.querySelector('.chl-gallery'), W = CW(); if (!el || !W) return;
    const keep = W.OPT.chipDesign;
    el.innerHTML = DESIGNS.map(([k, name]) => {
      W.OPT.chipDesign = k;
      const coins = W.TIERS().map(t => '<i class="cdl-px" style="width:30px;height:36px;background-image:' + W.frames(t, 15).front[1] + '"></i>').join('');
      return '<button type="button" data-design="' + k + '"' + (k === keep ? ' class="is-on"' : '') + '><span>' + name + '</span><b>' + coins + '</b></button>';
    }).join('');
    W.OPT.chipDesign = keep;
  }

  /* ---- the key and the sheet ---- */
  const MOMENTS = [
    ['play','PLAY A HAND', true],
    ['call','CALL + WIN'], ['lose','CALL + LOSE'],
    ['raise','RAISE 3 BB'], ['bigraise','BIG RAISE · CHANGE'],
    ['allinwin','ALL IN · YOU WIN'], ['allinlose','ALL IN · YOU LOSE'],
    ['monster','WIN A MONSTER POT', true],
    ['deep','DEEP STACK 150 BB'], ['short','SHORT STACK 6 BB'],
    ['blindsup','BLINDS GO UP', true],
    ['huge','HUGE POT · 5-WAY ALL IN, 150 BB', true],
    ['stress','POT STRESS · BETS UNTIL IT\'S HUGE', true]
  ];
  // YOUR BANK: set your stack and watch the bank settle (full = every
  // coin the rack holds, all gold)
  const BANKS = [['500','$500'],['5000','$5K'],['50000','$50K'],['500000','$500K'],['full','FULL']];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], order[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.id = 'sdl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.id = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Chip lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="pieces">THE CHIPS</button><button type="button" data-tab="settings">SETTINGS</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="moments"><p class="sdl-sub">Each one deals a fresh table and plays to the moment. Watch your bank (bottom left): bets come off the top, wins land on it, and tap it to tidy.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<button type="button" class="sdl-again" data-moment="replay">PLAY THE LAST ONE AGAIN</button>' +
          '<h3>YOUR BANK<small>Set your stack (on whatever table is up) and watch the bank settle. FULL: every coin it holds, all gold.</small></h3>' +
          '<div class="sdl-moments">' + BANKS.map(b => '<button type="button" data-bankset="' + b[0] + '">' + b[1] + '</button>').join('') + '</div></section>' +
        '<section data-pane="pieces" hidden><div class="chl-gallery" aria-label="The eight designs"></div>' +
          GROUPS.map(g => '<h3>' + g.title + '<small>' + g.sub + '</small></h3>' + g.rows.map(row).join('')).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="settings" hidden><h3>THE TABLE</h3>' +
          '<div class="sdl-row"><div class="sdl-name">OPPONENTS</div>' + seg('opp', [['2','2'],['3','3'],['4','4'],['5','5']], state.opp) + '</div>' +
          '<div class="sdl-row"><div class="sdl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
          '<p class="sdl-sub">Everything else is the game as it ships (v0.45.0).</p></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); if (on) paintGallery(); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.design){ order.chipDesign = t.dataset.design; apply(); paint(); return; }
      if (t.dataset.bankset){ open(false); setBank(t.dataset.bankset); return; }
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
        const text = 'Chip coins (round 4):\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === order[r[0]]) || ['', order[r[0]]])[1]).join('\n');
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
  function setBank(v){
    const h = human(); if (!h) return;
    const W = CW(), z = W.zones.bank;
    const top = W.TIERS().length - 1, cap = z ? W.rackCapacity(z) : 60;
    h.chips = v === 'full' ? cap * Math.pow(5, top) * game.smallBlind : +v;
    render(); try{ CoinTable.rebuildBank(); }catch(e){ console.error(e); }
  }
  // presentation only: big bets thrown and swept, again and again
  async function stressPot(){
    await deal();
    for (let r = 0; r < 5; r++){
      // (the opponents only: your bank shows your real stack)
      opps().forEach(p => CoinTable.bet(p, game.bigBlind * (20 + Math.floor(Math.random()*60)), false));
      await sleep(1800);
      await CoinTable.sweep();
      await sleep(900);
    }
  }
  const PLAYS = {
    async huge(){ const rs = await seat(4).catch(() => seat(3)); rs.concat([human()]).forEach(p => setStack(p, 150)); await allIn(rs); },
    async stress(){ await stressPot(); },
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
