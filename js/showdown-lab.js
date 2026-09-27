"use strict";

/* ============================================================
   SHOWDOWN LAB — the controls, inside the game (round 4, phone-first)

   Runs in the game copy the host page (showdown-lab.html,
   js/showdown-lab-host.js) builds: a small TUNE key in the corner opens a
   bottom sheet with three tabs — MOMENTS (deal straight to a moment),
   THE COOK (every part of the smash) and SETTINGS (the player's settings
   and the table). Picks go to the candidate (ShowdownBeats.apply) at once
   and to the host, so they survive the reload every moment starts with.

   The owner's round-1 order is locked in (with the round-2 fixes). The
   smash is THE COOK (round 3), with the round-4 changes: a shiver instead
   of the jumping while it cooks, and a physical explosion (the coins
   flown with gravity down the screen, bouncing off its edges, the cards
   and each other's paths, rolling out and lying flat) before they flip
   into the bank.

   Moments play the real game: DEV hooks force the all-ins and calls, and
   the undealt deck is put in an order that gives the wanted winner. The
   engine settles every hand for real.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, opp:'3', sound:'on', moment:null };
  const $id = id => document.getElementById(id);

  /* ---- the order ---- */
  const LOCKED = { lock:'console', runout:'called', river:'sweat', order:'casino', callout:'leader', losers:'lit', cards:'clear',
    verdict:'duel', stamp:'rail', kicker:'plate', split:'stamp', pots:'stacks', award:'each',
    tiers:'on', smash:'cook', smashon:'monster', opp:'gloat', chop:'chop', loss:'dim', meters:'count', show:'key' };
  const LOCKED_LIST = ['Lock: console', 'Hands: face up + named', 'River: squeeze + sweat', 'Order: casino', 'Readouts: leader board',
    'Losing hands: stay readable', 'Their cards: clear of the rim', 'Winning five: rail + duel', 'Hand name: on the rail', 'Kicker: plate',
    'Split: stamp', 'Side pots: own stacks', 'Handed over: pot by pot', 'By size: tiered', 'Smash: the cook (monster pots)',
    'Their win: shove + gloat', 'Split payout: chop', 'Your loss: dim', 'The numbers: count', 'Show a bluff: show key'];
  // Every row's first option is my suggestion.
  const COOK = [
    { title:'THE HEAT', sub:'A tap on AWARD POT flares the pot and fires. Holding it keeps cooking, and the longer you hold, the wilder the bang.', rows:[
      ['cheat','HEAT COLOUR', [['ember','EMBER TO HOT'],['allin','ALL-IN RED'],['white','RED TO WHITE']]],
      ['ctime','TIME TO FULL', [['1000','1 S'],['700','0.7 S'],['1500','1.5 S'],['2200','2.2 S']]],
      ['csteps','HEAT STEPS', [['9','NINE'],['5','FIVE'],['smooth','SMOOTH']]],
      ['ccoins','THE COINS', [['glow','RED HOT + GLOW'],['tint','TINT ONLY'],['none','STAY GOLD']]],
      ['crattle','WHILE COOKING', [['shiver','SHIVER + ODD HOP'],['shiveronly','SHIVER ONLY'],['none','STILL']], 'A shiver: they tremble in place, harder as it heats. Odd hop: when it\'s really hot, now and then one coin hops and lands.'],
      ['csparks','EMBERS', [['embers','EMBERS RISE'],['none','NONE']]],
      ['csound','SOUND', [['sizzle','SIZZLE + TICKS'],['ticks','TICKS'],['quiet','HUM ONLY']]],
      ['cfull','HELD AT FULL HEAT', [['hold','WAITS FOR YOU'],['overheat','OVERHEATS']]]
    ]},
    { title:'THE BANG', sub:'The coins arc up out of the tray, bounce on the felt and off the rails, cabinets, cards and dashboard, and settle in a mess on the table. Real time, always.', rows:[
      ['cforce','FORCE', [['huge','HUGE'],['big','BIG'],['max','MAX']]],
      ['cbounce','BOUNCES', [['lots','LOTS'],['few','FEW'],['endless','ENDLESS']], 'Bounces on the felt: LOTS is up to 5 a coin, each lower than the last.'],
      ['cwalls','TOP FRAME', [['frame','BOUNCE OFF IT'],['rails','RAILS ONLY']], 'Coins that fly high enough hit the top of the table and come back down.'],
      ['croll','ROLL OUT', [['on','SOME ROLL'],['off','ALL SLIDE']], 'After the bounces, some coins roll off on their edge before they wobble and lie flat.'],
      ['cdir','WHICH WAY', [['out','UP AND OUT'],['up','STRAIGHT UP'],['you','AT YOU']]],
      ['cstop','HIT-STOP', [['90','SHORT'],['170','LONG'],['0','NONE']]],
      ['cjolt','TABLE JOLT', [['small','SMALL'],['big','BIG'],['none','NONE']]],
      ['ccool','COOLING', [['flight','AS THEY FLY'],['land','WHEN THEY LAND'],['instant','AT ONCE']]]
    ]},
    { title:'INTO YOUR BANK', sub:'Once everything has stopped.', rows:[
      ['csettle','SETTLE', [['450','SHORT BEAT'],['900','LONG BEAT'],['0','NONE']]],
      ['cbank','THE PICK-UP', [['flip','ONE BY ONE'],['ripple','QUICK RIPPLE'],['all','ALL AT ONCE']], 'How the coins pick themselves up off the felt and flip into your bank, nearest the bank first.'],
      ['cpace','PACE', [['faster','SPEEDS UP'],['steady','STEADY']]],
      ['cfinish','FINISH', [['clack','THUNK + CLACK'],['run','THUNK + WIN RUN'],['none','NONE']]]
    ]}
  ];
  const PLAYER = [
    ['equity','WIN CHANCE', [['meter','ON'],['off','OFF']], 'When everyone is all in, a meter under the pot shows each hand\'s chance.'],
    ['press','AWARD POT', [['always','EVERY HAND'],['mine','YOURS + BIG'],['auto','NEVER']]]
  ];
  const ROWS = COOK.flatMap(s => s.rows).concat(PLAYER);
  const SUGGESTED = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  let order = Object.assign({}, LOCKED, SUGGESTED, state.order || {});
  // the player's own Settings (⚙ → Showdown) can change these too
  new MutationObserver(() => {
    const r = document.documentElement;
    let changed = false;
    ['equity','press'].forEach(k => { const v = r.getAttribute('data-sd-' + k); if (v && order[k] !== v){ order[k] = v; changed = true; } });
    if (changed){ save(); paint(); }
  }).observe(document.documentElement, { attributes:true, attributeFilter:['data-sd-equity','data-sd-press'] });
  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  function applyOrder(){ try{ ShowdownBeats.apply(order); }catch(e){} save(); }

  /* ---- the key and the sheet ---- */
  const MOMENTS = [
    ['again','SMASH AGAIN', true],
    ['cook','A MONSTER POT · FULL HAND', true],
    ['win','YOU WIN'], ['lose','YOU LOSE'], ['threeway','3-WAY'], ['kicker','ON THE KICKER'],
    ['big','BIG POT'], ['suckout','ALL IN · SUCK OUT'], ['badbeat','ALL IN · BAD BEAT'], ['multi','3-WAY ALL IN'],
    ['split','SPLIT POT'], ['side','SIDE POT'], ['threepots','THREE POTS'], ['oppsmall','THEM · SMALL'], ['oppbig','THEM · BIG'],
    ['foldwin','EVERYONE FOLDS', true]
  ];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], order[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.id = 'sdl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.id = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Showdown lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="cook">THE COOK</button><button type="button" data-tab="settings">SETTINGS</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="moments"><p class="sdl-sub">SMASH AGAIN fills the pot and cuts straight to AWARD POT, as often as you like (the AGAIN key does the same). The rest deal a fresh table and play to the moment.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<button type="button" class="sdl-again" data-moment="replay">PLAY THE LAST ONE AGAIN</button></section>' +
        '<section data-pane="cook" hidden>' + COOK.map(s => '<h3>' + s.title + '<small>' + s.sub + '</small></h3>' + s.rows.map(row).join('')).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="settings" hidden><h3>PLAYER SETTINGS<small>Also in the game: ⚙ on the table, then Showdown.</small></h3>' + PLAYER.map(row).join('') +
          '<h3>THE TABLE</h3>' +
          '<div class="sdl-row"><div class="sdl-name">OPPONENTS</div>' + seg('opp', [['2','2'],['3','3'],['4','4'],['5','5']], state.opp) + '</div>' +
          '<div class="sdl-row"><div class="sdl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
          '<h3>LOCKED IN<small>Your round-1 order, with the round-2 fixes.</small></h3><ul class="sdl-locked">' + LOCKED_LIST.map(t => '<li>' + t + '</li>').join('') + '</ul></section>' +
      '</div>';
    const again = document.createElement('button');
    again.type = 'button'; again.className = 'sdl-key sdl-again-key'; again.textContent = 'AGAIN';
    again.addEventListener('click', () => { open(false); smashAgain(); });
    document.body.appendChild(key); document.body.appendChild(again); document.body.appendChild(sheet);
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
        const m = t.dataset.moment === 'replay' ? (state.last || 'again') : t.dataset.moment;
        open(false);
        if (m === 'again'){ smashAgain(); return; }
        if (host){ host.set({ last:m }); host.play(m); } else run(m);
        return;
      }
      const s = t.closest('.sdl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        if (k === 'opp' || k === 'sound'){
          state[k] = v; if (host) host.set({ [k]:v });
          if (k === 'sound') try{ settings.sound = v === 'on'; }catch(err){}
        } else { order[k] = v; applyOrder(); }
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        return;
      }
      if (t.dataset.act === 'reset'){ order = Object.assign({}, LOCKED, SUGGESTED); applyOrder(); paint(); return; }
      if (t.dataset.act === 'copy'){
        const text = 'The cook (round 5):\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === order[r[0]]) || ['', order[r[0]]])[1]).join('\n');
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
    await sleep(200);
  }
  function foldAllBut(keep){
    opps().forEach(p => { if (!keep.includes(p) && p.inHand && !p.folded && !p.allIn) applyAction(p, { action:'fold' }); });
    render();
  }
  // n rivals still in the hand at your first turn (re-deals if some folded first)
  async function seat(n){
    for (let tries = 0; tries < 6; tries++){
      await deal(n + (tries > 1 ? 1 : 0));
      const ins = opps().filter(p => p.inHand && !p.folded && !p.allIn);
      if (ins.length >= n){ const pick = ins.slice(0, n); foldAllBut(pick); return pick; }
    }
    throw new Error('could not seat ' + n + ' rivals');
  }
  const setStack = (p, bb) => { p.chips = Math.max(1, Math.round(bb * game.bigBlind) - p.betThisRound); render(); };
  const rankOf = (p, board) => evaluate7(p.hand.concat(board));
  const cmp = (a, b, board) => compareHands(rankOf(a, board), rankOf(b, board));
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
  async function playOut(rivals, betBB){
    setDev(true, false);
    await waitFor(() => {
      rivals.forEach(p => { if (!p.folded && !p.allIn) p._devAutoCall = true; });
      if (myTurn()){
        if (betBB && game.currentBet === 0){
          const b = wagerBounds(game, pendingHumanPlayer);
          humanAct('raise', Math.max(b.min, Math.min(b.max, Math.round(betBB * game.bigBlind))));
        } else passive();
      }
      return game.phase === 'showdown' || game.phase === 'foldwin' || game.over;
    }, 60000);
    setDev(false);
  }
  async function allIn(rivals, fast){
    setDev(true, !!fast);
    rivals.forEach(p => { p._devForceAllIn = true; });
    if (myTurn()) humanAct('allin');
    await waitFor(() => { if (myTurn()) passive(); return game.phase === 'showdown' || game.over || (!fast && game.board.length > 0); }, 60000);
    setDev(false);
  }
  async function watch(a, c, shove){
    setDev(true, false);
    if (shove) a._devForceAllIn = true;
    if (myTurn()) humanAct('fold');
    await waitFor(() => { [a, c].forEach(p => { if (!p.folded && !p.allIn && !p._devForceAllIn) p._devAutoCall = true; }); return game.phase === 'showdown' || game.over; }, 60000);
    setDev(false);
  }
  const PLAYS = {
    // straight to a monster pot's AWARD POT: the runout plays fast
    async cook(){ const [r] = await seat(1); setStack(human(), 40); setStack(r, 40); stack(inOrder([human(), r])); await allIn([r], true); },
    async win(){ const [r] = await seat(1); stack(inOrder([human(), r])); await playOut([r]); },
    async lose(){ const [r] = await seat(1); stack(inOrder([r, human()])); await playOut([r]); },
    async threeway(){ const [a, c] = await seat(2); const me = human(); stack(inOrder(Math.random() < .5 ? [me, a, c] : [c, me, a])); await playOut([a, c]); },
    async kicker(){
      const [r] = await seat(1); const me = human(), first = Math.random() < .5 ? me : r, second = first === me ? r : me;
      stack(b => rankOf(me, b).cat === rankOf(r, b).cat && rankOf(me, b).cat <= 2 && cmp(first, second, b) > 0); await playOut([r]);
    },
    async big(){ const [r] = await seat(1); stack(inOrder([human(), r])); await playOut([r], 2); },
    async suckout(){ const [r] = await seat(1); const me = human(); stack(b => cmp(r, me, b.slice(0, 4)) > 0 && cmp(me, r, b) > 0 && rankOf(r, b.slice(0, 4)).cat >= 1); await allIn([r]); },
    async badbeat(){ const [r] = await seat(1); const me = human(); stack(b => cmp(me, r, b.slice(0, 4)) > 0 && cmp(r, me, b) > 0 && rankOf(me, b.slice(0, 4)).cat >= 1); await allIn([r]); },
    async multi(){ const [a, c] = await seat(2); setStack(a, 25); setStack(c, 25); setStack(human(), 25); stack(inOrder([human(), a, c].sort(() => Math.random() - .5))); await allIn([a, c]); },
    async split(){
      const [r] = await seat(1); const me = human();
      if (!stack(b => cmp(me, r, b) === 0)){
        const taken = new Set(game.players.flatMap(p => p.hand).map(cardKey));
        const alt = me.hand.map(c => game.deck.find(d => d.rank === c.rank && !taken.has(cardKey(d))));
        if (alt.every(Boolean)){ game.deck = game.deck.filter(d => !alt.includes(d)).concat(r.hand); r.hand = alt; render(); stack(b => cmp(me, r, b) === 0); }
      }
      await playOut([r]);
    },
    async side(){ const [a, c] = await seat(2); setStack(a, 6); setStack(c, 14); setStack(human(), 30); stack(inOrder([a, human(), c])); await allIn([a, c]); },
    async threepots(){ const [a, c, d] = await seat(3); setStack(a, 5); setStack(c, 12); setStack(d, 20); setStack(human(), 30); stack(inOrder([a, c, human(), d])); await allIn([a, c, d]); },
    async oppsmall(){ const [a, c] = await seat(2); stack(inOrder([a, c])); await watch(a, c, false); },
    async oppbig(){ const [a, c] = await seat(2); setStack(a, 30); setStack(c, 30); stack(inOrder([c, a])); await watch(a, c, true); },
    async foldwin(){ await deal(); foldAllBut([]); await sleep(200); if (myTurn()) passive(); }
  };
  let busy = false;
  async function run(m){
    if (busy || !PLAYS[m]) return;
    busy = true;
    try{ await PLAYS[m](); }catch(err){ console.error(err); }
    finally{ busy = false; }
  }
  window.__sdLab = { run, smashAgain, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); applyOrder(); paint(); }, get busy(){ return busy; } };

  // straight to a monster pot's AWARD POT, on whatever table is up
  let againBusy = false;
  async function smashAgain(){
    if (againBusy || busy) return;
    againBusy = true;
    try{
      if (!game || game.over) await deal();
      const nh = $id('btn-next-hand'); const nhShown = nh && !nh.classList.contains('hidden');
      if (nh) nh.classList.add('hidden');
      // the hand underneath waits: your turn is set aside (the row dims and
      // ignores taps), so the finger lifting off AWARD POT can't press CHECK
      // on the row that flips back under it
      const held = pendingHumanPlayer; pendingHumanPlayer = null;
      try{ updateActionControls(); }catch(e){}
      try{ await ShowdownBeats.stage(1640); }
      finally{
        setTimeout(() => {
          if (held && game && !game.over){ pendingHumanPlayer = held; try{ updateActionControls(); render(); }catch(e){} }
        }, 450);
      }
      if (nh && nhShown) nh.classList.remove('hidden');
    }catch(err){ console.error(err); }
    finally{ againBusy = false; }
  }

  /* ---- start ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}   // it has its own lab; here it only slows each moment down
    try{ settings.sound = state.sound !== 'off'; }catch(e){}
    applyOrder();
    build();
    const m = state.moment;
    if (host) host.set({ moment:null });
    if (m === 'again' || !m) deal().then(() => smashAgain()).catch(err => console.error(err));
    else run(m);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
