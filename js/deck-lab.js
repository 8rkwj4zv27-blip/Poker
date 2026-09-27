"use strict";

/* ============================================================
   DECK LAB — the controls, inside the game (phone-first)

   Runs in the game copy that deck-lab.html builds (with the Showdown
   Lab's host, js/showdown-lab-host.js): a TUNE key opens a bottom sheet
   with MOMENTS, THE SHOE and THE DEAL. Picks go to the candidate
   (DealerShoe.apply, js/dealer-shoe.js) at once and to the host, so they
   survive the reload a moment starts with. NEXT HAND plays the hand out
   and deals the next one on the same table; AUTO keeps doing that.
   The sheet borrows the Showdown Lab's styles (css/showdown-lab.css).
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, opp:'3', sound:'on', moment:null };
  const $id = id => document.getElementById(id);

  /* ---- the order: every row's first option is my suggestion ---- */
  const SHOE = [
    { title:'THE SHOE', sub:'The deck is a machine built into the felt. The cards come out of it and go back into it.', rows:[
      ['look','LOOK', [['brass','BRASS SHOE'],['velvet','VELVET BOX'],['marquee','MARQUEE BULBS']], 'Brass: burgundy body, brass front. Velvet: padded and stitched. Marquee: black and gold, with a row of bulbs that chase while it works.'],
      ['size','SIZE', [['std','STANDARD'],['compact','COMPACT'],['big','BIG']]],
      ['where','WHERE', [['left','LEFT'],['right','RIGHT']]],
      ['readout','ITS SCREEN', [['words','CARDS LEFT + WORDS'],['count','CARDS LEFT'],['off','OFF']], 'Counts down from 52 as the cards go out. With words, it also calls BURN, FLOP, TURN, RIVER, RIFFLE and READY.'],
      ['stack','THE STACK', [['down','GOES DOWN'],['full','STAYS FULL']], 'The cards showing at the top of the shoe get fewer as the deck runs down.'],
      ['cut','CUT CARD', [['on','ON'],['off','OFF']], 'A red plastic sliver in the stack, like a casino shoe. It goes when the deck runs low.'],
      ['idle','IDLE LIFE', [['rare','BLINKS NOW AND THEN'],['off','STILL']], 'Between hands the lamp (or the bulbs) blinks every so often.']
    ]},
    { title:'CARD BACK', sub:'Every face-down card in the game: the shoe, their cards, yours before they turn.', rows:[
      ['back','BACK', [['crest','HOUSE CREST'],['diamond','GOLD LATTICE'],['classic','CLASSIC RED'],['table','TABLE GREEN (TODAY)']]]
    ]},
    { title:'THE SHUFFLE', sub:'Between hands, after the cards go back in.', rows:[
      ['shuffle','SHUFFLE', [['machine','MACHINE'],['riffle','RIFFLE'],['off','NONE']], 'Machine: it rattles and shakes inside, the screen spins, then clunks to 52 and READY. Riffle: two halves pop up out of the shoe and riffle together.'],
      ['when','WHEN', [['every','EVERY HAND'],['first','NEW TABLE ONLY']]],
      ['slen','LENGTH', [['short','SHORT'],['long','LONG']]]
    ]}
  ];
  const DEAL = [
    { title:'OUT OF THE SHOE', sub:'Every card: hole cards, burns and the board.', rows:[
      ['eject','THE CARD COMES OUT', [['kick','KICKED OUT'],['top','OFF THE TOP']], 'Kicked: it slides out past the front of the shoe, then flies. Off the top: it flies straight away.'],
      ['recoil','THE SHOE KNOCKS', [['on','ON'],['off','OFF']], 'The shoe jolts a pixel as each card leaves.'],
      ['flight','FLIGHT', [['flick','FLICK (TODAY)'],['spin','SPIN'],['slide','SLIDE']], 'Flick: today\'s arc. Spin: a full turn in the air. Slide: low along the felt.'],
      ['pace','PACE', [['today','TODAY'],['brisk','BRISK'],['relaxed','RELAXED']]],
      ['land','LANDING', [['puff','FELT PUFF'],['none','NONE']], 'A few specks of dust where a card lands.'],
      ['yours','YOUR CARDS', [['land','TURN AS THEY LAND'],['together','BOTH TOGETHER']], 'Both together: your two cards land face down, then turn over at once.']
    ]},
    { title:'THE BOARD', rows:[
      ['burn','BURN CARDS', [['on','ON'],['off','OFF']], 'One card face down onto a burn pile before the flop, turn and river, like a real dealer. Drawn only: the game\'s deck is untouched.'],
      ['flop','FLOP', [['spread','STACK + SPREAD'],['one','ONE BY ONE']], 'Stack + spread: all three land on one spot, then fan out into place.'],
      ['flopflip','FLOP TURNS', [['wave','AS THEY FAN'],['together','ALL AT ONCE'],['one','ONE BY ONE']]],
      ['beat','TURN + RIVER', [['off','STRAIGHT IN'],['beat','LAMP BEAT']], 'Lamp beat: the lamp ticks three times before the card comes out.']
    ]},
    { title:'THE MUCK', sub:'The end of a hand.', rows:[
      ['muck','CARDS GO', [['slot','INTO THE SHOE'],['stack','ONTO THE STACK']], 'Into the shoe: each card slides down into it and the shoe gulps.'],
      ['sweep','ORDER', [['scatter','ALL AT ONCE'],['round','ROUND THE TABLE']], 'Round the table: seat by seat from the dealer, then the board, then the burns.']
    ]},
    { title:'SOUND', rows:[
      ['sound','SHOE SOUNDS', [['mech','MECHANICAL'],['paper','CARDS ONLY']], 'Mechanical adds relay clunks to the kick, the shuffle and the gulp.']
    ]}
  ];
  const ROWS = SHOE.concat(DEAL).flatMap(s => s.rows);
  const SUGGESTED = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  let order = Object.assign({ dealer:'new' }, SUGGESTED, state.order || {});
  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  function applyOrder(){ try{ DealerShoe.apply(order); }catch(e){ console.error(e); } save(); }

  /* ---- the key and the sheet ---- */
  const MOMENTS = [
    ['deal','DEAL A HAND', true], ['flop','TO THE FLOP'], ['river','TO THE RIVER'],
    ['hand','A HAND + THE NEXT'], ['table','NEW TABLE (INTRO)']
  ];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], order[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  const pane = secs => secs.map(s => '<h3>' + s.title + (s.sub ? '<small>' + s.sub + '</small>' : '') + '</h3>' + s.rows.map(row).join('')).join('');
  const actions = '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div><textarea class="sdl-copytext" readonly hidden></textarea>';
  let auto = false;
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    const next = document.createElement('button');
    next.type = 'button'; next.className = 'sdl-key sdl-again-key'; next.textContent = 'NEXT HAND';
    next.style.minWidth = '86px';
    const autoKey = document.createElement('button');
    autoKey.type = 'button'; autoKey.className = 'sdl-key'; autoKey.textContent = 'AUTO';
    autoKey.style.left = '168px';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Deck lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="shoe">THE SHOE</button><button type="button" data-tab="deal">THE DEAL</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="moments">' +
          '<div class="sdl-row"><div class="sdl-name">THE DEALER</div>' + seg('dealer', [['new','NEW SHOE'],['today','TODAY']], order.dealer) +
          '<p class="sdl-note">TODAY puts the shipped deck back, to compare.</p></div>' +
          '<p class="sdl-sub">Each moment deals a fresh table and plays to it. NEXT HAND (top of the screen) plays out the hand you\'re in and deals the next one on the same table, so you see the muck and the shuffle. AUTO keeps dealing hands by itself.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<h3>THE TABLE</h3>' +
          '<div class="sdl-row"><div class="sdl-name">OPPONENTS</div>' + seg('opp', [['2','2'],['3','3'],['4','4'],['5','5']], state.opp) + '</div>' +
          '<div class="sdl-row"><div class="sdl-name">SOUND</div>' + seg('snd', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
        '</section>' +
        '<section data-pane="shoe" hidden>' + pane(SHOE) + actions + '</section>' +
        '<section data-pane="deal" hidden>' + pane(DEAL) + actions + '</section>' +
      '</div>';
    document.body.append(key, next, autoKey, sheet);
    const open = v => { sheet.classList.toggle('is-open', v); key.classList.toggle('is-on', v); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    next.addEventListener('click', () => { open(false); nextHand(); });
    autoKey.addEventListener('click', () => { auto = !auto; autoKey.classList.toggle('is-on', auto); if (auto) autoLoop(); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.moment){
        open(false);
        if (host) host.play(t.dataset.moment); else run(t.dataset.moment);
        return;
      }
      const s = t.closest('.sdl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        if (k === 'opp'){ state.opp = v; if (host) host.set({ opp:v }); }
        else if (k === 'snd'){ state.sound = v; if (host) host.set({ sound:v }); try{ settings.sound = v === 'on'; }catch(err){} }
        else { order[k] = v; applyOrder(); }
        sheet.querySelectorAll('.sdl-seg[data-key="' + k + '"] button').forEach(b => b.classList.toggle('is-on', b.dataset.v === v));
        return;
      }
      if (t.dataset.act === 'reset'){ order = Object.assign({ dealer:'new' }, SUGGESTED); applyOrder(); paint(sheet); return; }
      if (t.dataset.act === 'copy'){
        const text = 'Dealer shoe (round 1):\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === order[r[0]]) || ['', order[r[0]]])[1]).join('\n');
        const ta = t.closest('section').querySelector('.sdl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }
  function paint(sheet){
    sheet.querySelectorAll('.sdl-seg').forEach(s => {
      const k = s.dataset.key, cur = k === 'opp' ? state.opp : k === 'snd' ? state.sound : order[k];
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === cur));
    });
  }

  /* ---- moments: the real game ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !$id('actions-row').classList.contains('disabled') && !$id('console-flip').classList.contains('flipped'));
  const passive = () => { const call = game.currentBet - pendingHumanPlayer.betThisRound; humanAct(call > 0 ? 'call' : 'check'); };
  const nextShown = () => { const nh = $id('btn-next-hand'); return nh && !nh.classList.contains('hidden'); };
  // everyone stays in: the whole board gets dealt
  const keepIn = () => { DEV_MODE = true; FAST_DEV = false; game.players.forEach(p => { if (!p.isHuman && p.inHand && !p.folded && !p.allIn) p._devAutoCall = true; }); };
  async function deal(){
    startSinglePlayerRun({ opponentCount:Number(state.opp) || 3 });
    if (!await waitFor(myTurn, 45000)) throw new Error('the deal never reached your turn');
  }
  async function playTo(boardLen){
    await waitFor(() => {
      keepIn();
      if (game.board.length >= boardLen && (myTurn() || game.phase === 'showdown')) return true;
      if (myTurn()) passive();
      return nextShown() || game.over;
    }, 60000);
    DEV_MODE = false;
  }
  let busy = false;
  async function nextHand(){
    if (busy) return;
    busy = true;
    try{
      if (!game || game.over){ await deal(); return; }
      await waitFor(() => { keepIn(); if (myTurn()) passive(); return nextShown() || game.over; }, 60000);
      DEV_MODE = false;
      const nh = $id('btn-next-hand');
      if (nextShown()) nh.click();
      await waitFor(myTurn, 45000);
    }catch(err){ console.error(err); }
    finally{ DEV_MODE = false; busy = false; }
  }
  async function autoLoop(){
    while (auto){
      await nextHand();
      await sleep(900);
    }
  }
  const PLAYS = {
    async deal(){ await deal(); },
    async flop(){ await deal(); await playTo(3); },
    async river(){ await deal(); await playTo(5); },
    async hand(){ await deal(); busy = false; await nextHand(); },
    async table(){ await deal(); }
  };
  async function run(m){
    if (busy || !PLAYS[m]) return;
    busy = true;
    try{ await PLAYS[m](); }catch(err){ console.error(err); }
    finally{ busy = false; DEV_MODE = false; }
  }
  window.__deckLab = { run, nextHand, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); applyOrder(); } };

  /* ---- start ---- */
  function start(){
    const m = state.moment || 'deal';
    // the Table Intro has its own lab; here it plays only for NEW TABLE
    try{ if (m !== 'table' && typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = state.sound !== 'off'; settings.sdAwardPot = 'auto'; }catch(e){}
    applyOrder();
    build();
    if (host) host.set({ moment:null });
    run(m);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
