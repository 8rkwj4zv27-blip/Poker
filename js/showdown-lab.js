"use strict";

/* ============================================================
   SHOWDOWN ORDER FORM, ROUND 1 (Lab)

   The end of a hand as a set of beats, each with parts to pick from:
   the lock (betting closes), the all-in sweat (the runout), the reveal,
   the verdict, the pots, the payout, and the fold-win. The plan is
   docs/ui/SHOWDOWN_PLAN.md.

   The real game (index.html, every production script and stylesheet) runs
   in a same-origin sandboxed frame at the owner's phone (iPhone 15 Pro
   Max, installed app: 430 x 932, the game's env(safe-area-*) rewritten to
   59px top / 34px bottom), with the candidate css/showdown-beats.css and
   js/showdown-beats.js injected. The form is the order: each change goes
   to the game as data-sd-* attributes on its <html>
   (ShowdownBeats.apply()). Every row's first option is TODAY, the game as
   it ships.

   Moments deal a fresh table and play it to the moment with the DEV
   hooks (forced all-ins, auto-calls) and a stacked deck: the undealt
   cards are put in an order that gives the wanted winner. Nothing is
   faked after the deal; the real engine settles every hand.

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
  const GAME = window.SD_LAB_GAME || 'index.html';
  const V = '3';

  /* The form. Every row's first option is TODAY (the game as it ships). */
  /* Round 3. The owner's round-1 order is locked in (with the round-2
     fixes: the hand name on the rail, their cards clear of the rim). The
     one smash is THE COOK, and the form is its parts. Every row's first
     option is my suggestion. */
  const LOCKED = { lock:'console', runout:'called', river:'sweat', order:'casino', callout:'leader', losers:'lit', cards:'clear',
    verdict:'duel', stamp:'rail', kicker:'plate', split:'stamp', pots:'stacks', award:'each',
    tiers:'on', smash:'cook', smashon:'monster', opp:'gloat', chop:'chop', loss:'dim', meters:'count', show:'key' };
  const LOCKED_LIST = ['Lock: console', 'Hands: face up + named', 'River: squeeze + sweat', 'Order: casino', 'Readouts: leader board',
    'Losing hands: stay readable', 'Their cards: clear of the rim', 'Winning five: rail + duel', 'Hand name: on the rail', 'Kicker: plate', 'Split: stamp',
    'Side pots: own stacks', 'Handed over: pot by pot', 'By size: tiered', 'Smash: the cook, monster pots', 'Their win: shove + gloat',
    'Split payout: chop', 'Your loss: dim', 'The numbers: count', 'Show a bluff: show key'];
  const SECTIONS = [
    { title:'1 · THE HEAT', sub:'While you hold AWARD POT on a monster pot, the pot\'s well cooks the coins.', jobs:[
      { key:'cheat', name:'HEAT COLOUR', hint:'the well as it heats', opts:[
        ['ember','EMBER TO HOT', 'Dull ember red, through orange, to a hot yellow at full heat.'],
        ['allin','ALL-IN RED', 'The game\'s all-in red, getting brighter and paler as it heats.'],
        ['white','RED TO WHITE', 'Red through orange to white hot.']] },
      { key:'ctime', name:'TIME TO FULL', hint:'how long a full charge takes', opts:[
        ['1000','1 SECOND', 'Quick and punchy.'], ['700','0.7 S', 'Snappier.'], ['1500','1.5 S', 'A longer cook.'], ['2200','2.2 S', 'A real wind-up.']] },
      { key:'csteps', name:'HEAT STEPS', hint:'how the heat climbs', opts:[
        ['9','NINE NOTCHES', 'Nine clear steps, each with its click; the key\'s gauge fills notch by notch.'],
        ['5','FIVE NOTCHES', 'Five bigger steps.'],
        ['smooth','SMOOTH', 'Many small steps, so it reads as a continuous glow.']] },
      { key:'ccoins', name:'THE COINS', hint:'as they cook', opts:[
        ['glow','RED HOT + GLOW', 'The coins turn red-orange with the heat and give off a glow.'],
        ['tint','TINT ONLY', 'They turn red-orange, no glow.'],
        ['none','STAY GOLD', 'Only the well glows.']] },
      { key:'crattle', name:'RATTLE', hint:'the coins jumping in the heat', opts:[
        ['build','BUILDS UP', 'A gentle shiver at first, jumping hard at full heat.'],
        ['steady','STEADY', 'The same jitter all the way.'],
        ['none','STILL', 'They sit still.']] },
      { key:'csparks', name:'EMBERS', hint:'sparks off the well', opts:[
        ['embers','EMBERS RISE', 'A few pixel sparks rise off the pot as it heats, more when it\'s hot.'],
        ['none','NONE', 'No sparks.']] },
      { key:'csound', name:'SOUND', hint:'while it heats', opts:[
        ['sizzle','SIZZLE + TICKS', 'A ticking click per step, climbing, with a crackle that thickens as it heats.'],
        ['ticks','TICKS ONLY', 'Just the climbing clicks.'],
        ['quiet','HUM ONLY', 'Only your dashboard\'s hum.']] },
      { key:'cearly', name:'LET GO EARLY', hint:'before it\'s fully hot', opts:[
        ['weaker','WEAKER BANG', 'It fires anyway, as hard as it got hot. A quick tap is a small pop.'],
        ['full','MUST BE RED HOT', 'It won\'t fire until it\'s full: let go early and it cools off, and you try again.']] },
      { key:'cfull', name:'AT FULL HEAT', hint:'once it\'s full', opts:[
        ['hold','WAITS FOR YOU', 'It holds at full heat, rattling and sparking, until you let go.'],
        ['overheat','OVERHEATS', 'Hold it a second too long at full and it goes off by itself.']] }
    ]},
    { title:'2 · THE BANG', sub:'When you let go.', jobs:[
      { key:'cforce', name:'FORCE', hint:'how hard, at full heat', opts:[
        ['big','BIG', 'The coins clear the cards and a good few reach the top frame.'],
        ['medium','MEDIUM', 'A strong pop, mostly staying low.'],
        ['huge','HUGE', 'Everything goes, hard.']] },
      { key:'cdir', name:'WHICH WAY', hint:'the coins fly', opts:[
        ['out','UP AND OUT', 'Burst outwards from the pot in every direction, like popcorn.'],
        ['up','STRAIGHT UP', 'A column up to the top frame and back down.'],
        ['you','AT YOU', 'Fired down the felt towards your dashboard.']] },
      { key:'cceil', name:'TOP FRAME', hint:'coins reaching the top', opts:[
        ['bounce','BOUNCE OFF IT', 'They hit the table\'s top frame with a clack and are thrown back down, sideways.'],
        ['none','NO FRAME', 'They fly up past it and fall back.']] },
      { key:'cstop', name:'HIT-STOP', hint:'the moment of the bang', opts:[
        ['90','SHORT', 'The coins freeze for a few frames as it goes off.'], ['170','LONG', 'A longer freeze.'], ['0','NONE', 'No freeze.']] },
      { key:'cjolt', name:'TABLE JOLT', hint:'the machine feels it', opts:[
        ['small','SMALL', 'A small knock through the table.'], ['big','BIG', 'A hard double shake.'], ['none','NONE', 'The table stays still.']] },
      { key:'ccool', name:'COOLING', hint:'back to gold', opts:[
        ['flight','AS THEY FLY', 'They cool back to gold as they fly.'],
        ['land','WHEN THEY LAND', 'They stay red hot in the air and cool once they\'ve landed.'],
        ['instant','AT ONCE', 'They\'re gold again the moment it goes off.']] }
    ]},
    { title:'3 · INTO YOUR BANK', sub:'Once they\'ve settled.', jobs:[
      { key:'csettle', name:'SETTLE', hint:'a beat before they go', opts:[
        ['450','SHORT BEAT', 'A short pause with them scattered on the felt.'], ['900','LONG BEAT', 'Time to take in the mess.'], ['0','NONE', 'Straight in.']] },
      { key:'cbank', name:'THE FLIP', hint:'how they go into the bank', opts:[
        ['flip','ONE BY ONE', 'Nearest first, each coin flips up off the felt and arcs into your hatch.'],
        ['ripple','RIPPLE', 'The same, overlapping quickly.'],
        ['all','ALL TOGETHER', 'Everything goes at once.']] },
      { key:'cpace', name:'PACE', hint:'of the flips', opts:[
        ['faster','SPEEDS UP', 'Starts slow and speeds up, like a payout counter.'], ['steady','STEADY', 'An even rhythm.']] },
      { key:'cfinish', name:'FINISH', hint:'the last coin in', opts:[
        ['clack','THUNK + CLACK', 'A heavy thunk and your stack clacks shut.'],
        ['run','THUNK + WIN RUN', 'A thunk and a short rising run in the coin voice.'],
        ['none','NONE', 'Just the coins.']] }
    ]},
    { title:'4 · PLAYER SETTINGS', sub:'The player picks these in the game: tap ⚙ on the table, then Showdown. Changing them there changes them here.', jobs:[
      { key:'equity', name:'WIN CHANCE', hint:'all-in meter', opts:[
        ['meter','ON', 'When everyone is all in, a meter under the pot shows each hand\'s chance to win.'],
        ['off','OFF', 'No numbers.']] },
      { key:'press', name:'AWARD POT', hint:'when it waits for you', opts:[
        ['always','EVERY HAND', 'Every hand waits for your press.'],
        ['mine','YOURS + BIG', 'Waits when you were in the hand or the pot is big; a small pot between two of them pays itself.'],
        ['auto','NEVER', 'Every pot pays itself after a read (a monster cooks itself).']] }
    ]}
  ];
  const JOBS = SECTIONS.flatMap(s => s.jobs);
  const TODAY = Object.fromEntries(JOBS.map(j => [j.key, j.opts[0][0]]));
  const PRESETS = { suggested:{ order:TODAY, note:'My suggestion for every part of the cook.' } };
  let order = Object.assign({}, LOCKED, TODAY);
  const view = { opp:'3', sound:'on', motion:'on' };

  function readHash(){
    const q = new URLSearchParams(location.hash.slice(1));
    JOBS.forEach(j => { const v = q.get(j.key); if (v && j.opts.some(o => o[0] === v)) order[j.key] = v; });
    Object.keys(view).forEach(k => { const v = q.get(k); if (v) view[k] = v; });
  }
  function writeHash(){ try{ history.replaceState(null, '', '#' + new URLSearchParams(Object.assign({}, order, view)).toString()); }catch(e){} }

  /* ---- the form ---- */
  function buildForm(){
    $('#sl-rows').innerHTML = '<h3 class="sl-sec">LOCKED IN<small>Your round-1 order, with the round-2 fixes. Not changing for now.</small></h3><ul class="sd-locked">' + LOCKED_LIST.map(t => '<li>' + t + '</li>').join('') + '</ul>' + SECTIONS.map(s => '<h3 class="sl-sec">' + s.title + '<small>' + s.sub + '</small></h3>' + s.jobs.map(j =>
      '<div class="sl-job" data-job="' + j.key + '"><div class="sl-job-head"><b>' + j.name + '</b><small>' + j.hint + '</small></div>' +
      '<div class="sl-seg">' + j.opts.map((o, i) => '<button type="button" data-v="' + o[0] + '"' + (i === 0 ? ' data-today' : '') + '>' + o[1] + '</button>').join('') + '</div>' +
      '<div class="sl-job-note"></div></div>').join('')).join('');
    $('#sl-rows').addEventListener('click', e => {
      const b = e.target.closest('button'), job = b && b.closest('[data-job]');
      if (!job) return;
      order[job.dataset.job] = b.dataset.v;
      sync(); send();
    });
  }
  function presetOf(){
    return Object.keys(PRESETS).find(k => JOBS.every(j => (PRESETS[k].order[j.key] || TODAY[j.key]) === order[j.key])) || '';
  }
  function sync(){
    JOBS.forEach(j => {
      const row = $('[data-job="' + j.key + '"]');
      $$('button', row).forEach(b => {
        b.classList.toggle('is-on', b.dataset.v === order[j.key]);
        b.classList.toggle('is-today', b.hasAttribute('data-today'));
      });
      const o = j.opts.find(x => x[0] === order[j.key]);
      const note = $('.sl-job-note', row);
      note.textContent = o ? o[2] : '';
      note.classList.toggle('is-new', !!o && o[0] !== j.opts[0][0]);
    });
    const p = presetOf();
    $$('[data-preset]').forEach(b => b.classList.toggle('is-on', b.dataset.preset === p));
    $('#sd-preset-note').textContent = p ? PRESETS[p].note : 'Your own mix.';
    $$('[data-view]').forEach(seg => $$('button', seg).forEach(b => b.classList.toggle('is-on', view[seg.dataset.view] === b.dataset.v)));
    $('#sl-summary').innerHTML = JOBS.map(j => {
      const o = j.opts.find(x => x[0] === order[j.key]);
      return '<li class="' + (order[j.key] === j.opts[0][0] ? 'is-today' : '') + '">' + j.name.charAt(0) + j.name.slice(1).toLowerCase() + ': <b>' + o[1] + '</b></li>';
    }).join('');
    writeHash();
  }
  const win = () => frame.contentWindow;
  const bridge = () => { try{ return win().__sdLab || null; }catch(e){ return null; } };
  function send(){
    const w = win();
    try{ if (bridge() && w.ShowdownBeats) w.ShowdownBeats.apply(order); }catch(e){}
  }
  // the player settings can change inside the game (Settings → Showdown)
  setInterval(() => {
    try{
      const r = win().document.documentElement; let changed = false;
      ['equity','press'].forEach(k => { const v = r.getAttribute('data-sd-' + k); if (v && order[k] !== v){ order[k] = v; changed = true; } });
      if (changed) sync();
    }catch(e){}
  }, 700);
  function applyView(){
    const b = bridge(); if (!b || !b.settings) return;
    b.settings.sound = view.sound === 'on'; b.settings.reduceMotion = view.motion === 'off';
    try{ win().document.body.setAttribute('data-motion', view.motion === 'off' ? 'off' : 'on'); }catch(e){}
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
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('showdown lab')); }; }catch(e){} }
    window.__sdLabIsolated = (function(){ try{ localStorage.setItem('__sd','1'); return mem.__sd === '1'; }catch(e){ return false; } })();
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
  window.__sdLab = {
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
    if (!sw.test(source) || !/<head>/i.test(source) || !/<\/body>/i.test(source))
      throw new Error('game page shape changed; refusing to build an unisolated copy');
    const base = new URL('.', location.href).href;
    const start = Object.entries(order).map(([k, v]) => 'data-sd-' + k + '="' + v + '"').join(' ');
    return source.replace(sw, '')
      .replace(/<html([^>]*)>/i, (m, a) => '<html' + a + ' ' + start + '>')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/<\/body>/i, '<link rel="stylesheet" href="css/showdown-beats.css?v=' + V + '"><script src="js/showdown-beats.js?v=' + V + '"><\/script><script>' + BRIDGE + '<\/script></body>');
  }
  async function loadFrame(){
    status('LOADING…');
    const doc = await buildDoc();
    await new Promise(r => { frame.onload = () => r(); frame.srcdoc = doc + '<!-- ' + Date.now() + ' -->'; });
    if (!win().__sdLabIsolated){ frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>'; throw new Error('storage isolation failed'); }
    const b = bridge();
    if (b && b.intro) b.intro.uninstall();   // the table intro has its own lab; here it only slows each moment down
    applyView();
    send();
  }

  /* ---- moments: each deals a fresh table and plays the real game there ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  const doc = () => win().document;
  const g = () => bridge().game;
  const human = () => g().players.find(p => p.isHuman);
  const opps = () => g().players.filter(p => !p.isHuman && !p.eliminated);
  const myTurn = () => { const b = bridge(); return !!(b && b.game && !b.game.over && b.pending && !doc().getElementById('actions-row').classList.contains('disabled') && !doc().getElementById('console-flip').classList.contains('flipped')); };
  const passive = () => { const call = g().currentBet - bridge().pending.betThisRound; win().humanAct(call > 0 ? 'call' : 'check'); };
  async function freshTable(need){
    await loadFrame();
    status('DEALING…');
    win().startSinglePlayerRun({ opponentCount:Math.max(Number(view.opp), need || 1) });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    await sleep(250);
  }
  // A fresh table where at least `n` opponents are still in the hand at
  // your first turn (someone may fold before it's yours): those are the
  // rivals, and everyone else folds.
  async function seat(n){
    for (let tries = 0; tries < 6; tries++){
      await freshTable(n + (tries > 1 ? 1 : 0));
      const ins = opps().filter(p => p.inHand && !p.folded && !p.allIn);
      if (ins.length >= n){ const pick = ins.slice(0, n); foldAllBut(pick); return pick; }
    }
    throw new Error('could not seat ' + n + ' rivals');
  }
  // Everyone but `keep` folds (a real fold, as a DEV control would).
  function foldAllBut(keep){
    opps().forEach(p => { if (!keep.includes(p) && p.inHand && !p.folded && !p.allIn) win().applyAction(p, { action:'fold' }); });
    win().render();
  }
  // A stack for this hand: what's already in front of them stays in.
  const setStack = (p, bb) => { p.chips = Math.max(1, Math.round(bb * g().bigBlind) - p.betThisRound); win().render(); };
  const rankOf = (p, board) => win().evaluate7(p.hand.concat(board));
  const cmp = (a, b, board) => win().compareHands(rankOf(a, board), rankOf(b, board));
  // Put the rest of the real deck in an order whose runout passes `test`
  // (dealCommunity pops from the end; there are no burns).
  function stack(test){
    const w = win(), gg = g(), need = 5 - gg.board.length;
    if (need <= 0) return false;
    for (let t = 0; t < 6000; t++){
      const run = w.shuffle(gg.deck.slice()).slice(0, need);
      if (!test(gg.board.concat(run), gg.board.slice(), run)) continue;
      const keys = new Set(run.map(w.cardKey));
      gg.deck = gg.deck.filter(c => !keys.has(w.cardKey(c))).concat(run.slice().reverse());
      return true;
    }
    return false;
  }
  // players in finishing order, best first (strictly)
  const inOrder = list => board => list.every((p, i) => i === 0 || cmp(list[i - 1], p, board) > 0);
  // the hands are the same kind, so it comes down to the side cards
  const sameKind = (a, b) => board => rankOf(a, board).cat === rankOf(b, board).cat;
  // Play the hand out: rivals check/call, you check/call (or bet `betBB`
  // big blinds each street), until the showdown starts.
  async function playOut(rivals, betBB){
    const b = bridge(); b.setDev(true, false);
    const ok = await waitFor(() => {
      rivals.forEach(p => { if (!p.folded && !p.allIn) p._devAutoCall = true; });
      if (myTurn()){
        const me = bridge().pending, gg = g();
        if (betBB && gg.currentBet === 0){
          const bounds = win().wagerBounds(gg, me);
          win().humanAct('raise', Math.max(bounds.min, Math.min(bounds.max, Math.round(betBB * gg.bigBlind))));
        } else passive();
      }
      return g().phase === 'showdown' || g().phase === 'foldwin' || g().over;
    }, 60000);
    b.setDev(false);
    return ok;
  }
  // You all in; each listed rival calls (all in for less if short) or shoves.
  async function allIn(rivals){
    const b = bridge(); b.setDev(true, false);
    rivals.forEach(p => { p._devForceAllIn = true; });
    if (myTurn()) win().humanAct('allin');
    const ok = await waitFor(() => {
      if (myTurn()) passive();
      return g().phase === 'showdown' || g().over || g().board.length > 0;
    }, 60000);
    b.setDev(false);
    return ok;
  }
  // Two opponents play it out between them (you fold).
  async function watch(a, bb, shove){
    const b = bridge(); b.setDev(true, false);
    if (shove) a._devForceAllIn = true;
    if (myTurn()) win().humanAct('fold');
    const ok = await waitFor(() => {
      [a, bb].forEach(p => { if (!p.folded && !p.allIn && !p._devForceAllIn) p._devAutoCall = true; });
      return g().phase === 'showdown' || g().over;
    }, 60000);
    b.setDev(false);
    return ok;
  }
  const MOMENTS = {
    // straight to a monster pot's AWARD POT: the runout plays fast
    async cook(){
      const [r] = await seat(1);
      setStack(human(), 40); setStack(r, 40);
      stack(inOrder([human(), r]));
      const b = bridge(); b.setDev(true, true);
      r._devForceAllIn = true;
      if (myTurn()) win().humanAct('allin');
      await waitFor(() => { if (myTurn()) passive(); return g().phase === 'showdown' || g().over; }, 60000);
      b.setDev(false);
    },
    async win(){
      const [r] = await seat(1);
      stack(inOrder([human(), r]));
      await playOut([r]);
    },
    async lose(){
      const [r] = await seat(1);
      stack(inOrder([r, human()]));
      await playOut([r]);
    },
    async threeway(){
      const [a, c] = await seat(2);
      const me = human();
      stack(inOrder(Math.random() < .5 ? [me, a, c] : [c, me, a]));
      await playOut([a, c]);
    },
    async kicker(){
      const [r] = await seat(1);
      const me = human(), first = Math.random() < .5 ? me : r, second = first === me ? r : me;
      stack(board => sameKind(me, r)(board) && rankOf(me, board).cat <= 2 && cmp(first, second, board) > 0);
      await playOut([r]);
    },
    async big(){
      const [r] = await seat(1);
      stack(inOrder([human(), r]));
      await playOut([r], 2);
    },
    async monster(){
      const [r] = await seat(1);
      setStack(human(), 40); setStack(r, 40);
      stack(inOrder([human(), r]));
      await allIn([r]);
    },
    async suckout(){
      const [r] = await seat(1);
      const me = human();
      stack(board => cmp(r, me, board.slice(0, 4).concat([])) > 0 && cmp(me, r, board) > 0 && rankOf(r, board.slice(0, 4)).cat >= 1);
      await allIn([r]);
    },
    async badbeat(){
      const [r] = await seat(1);
      const me = human();
      stack(board => cmp(me, r, board.slice(0, 4)) > 0 && cmp(r, me, board) > 0 && rankOf(me, board.slice(0, 4)).cat >= 1);
      await allIn([r]);
    },
    async multi(){
      const [a, c] = await seat(2);
      setStack(a, 25); setStack(c, 25); setStack(human(), 25);
      stack(inOrder([human(), a, c].sort(() => Math.random() - .5)));
      await allIn([a, c]);
    },
    async split(){
      const [r] = await seat(1);
      const me = human();
      if (!stack(board => cmp(me, r, board) === 0)){
        // no tie in this deck: give them your ranks in other suits, then look again
        const w = win(), gg = g(), taken = new Set(gg.players.flatMap(p => p.hand).map(w.cardKey));
        const alt = me.hand.map(c => gg.deck.find(d => d.rank === c.rank && !taken.has(w.cardKey(d))));
        if (alt.every(Boolean)){
          gg.deck = gg.deck.filter(d => !alt.includes(d)).concat(r.hand);
          r.hand = alt; w.render();
          stack(board => cmp(me, r, board) === 0);
        }
      }
      await playOut([r]);
    },
    async side(){
      const [a, c] = await seat(2);
      setStack(a, 6); setStack(c, 14); setStack(human(), 30);
      stack(inOrder([a, human(), c]));
      await allIn([a, c]);
    },
    async threepots(){
      const [a, c, d] = await seat(3);
      setStack(a, 5); setStack(c, 12); setStack(d, 20); setStack(human(), 30);
      stack(inOrder([a, c, human(), d]));
      await allIn([a, c, d]);
    },
    async oppsmall(){
      const [a, c] = await seat(2);
      stack(inOrder([a, c]));
      await watch(a, c, false);
    },
    async oppbig(){
      const [a, c] = await seat(2);
      setStack(a, 30); setStack(c, 30);
      stack(inOrder([c, a]));
      await watch(a, c, true);
    },
    async foldwin(){
      await freshTable();
      foldAllBut([]);
      await sleep(200);
      if (myTurn()) passive();
    }
  };
  let busy = false, last = null;
  const lock = on => { busy = on; $$('[data-moment]').forEach(x => x.disabled = on); };
  async function play(name){
    if (busy || !MOMENTS[name]) return;
    lock(true); last = name;
    $$('[data-moment]').forEach(b => b.classList.toggle('is-last', b.dataset.moment === name));
    try{ status('PLAYING…'); await MOMENTS[name](); status($('[data-moment="' + name + '"]').textContent); }
    catch(err){ console.error(err); status('ERROR — ' + err.message); }
    finally{ lock(false); }
  }
  $$('[data-moment]').forEach(b => b.addEventListener('click', () => play(b.dataset.moment === 'replay' ? (last || 'cook') : b.dataset.moment)));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => { order = Object.assign({}, LOCKED, PRESETS[b.dataset.preset].order); sync(); send(); }));
  $$('[data-view]').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    view[seg.dataset.view] = b.dataset.v; sync(); applyView();
  }));
  $('#sl-copy').addEventListener('click', async () => {
    const text = 'The cook (round 3):\n' + JOBS.map(j => '- ' + j.name + ': ' + j.opts.find(o => o[0] === order[j.key])[1]).join('\n');
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

  window.__sdForm = { MOMENTS, play, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); sync(); send(); }, preset(k){ order = Object.assign({}, LOCKED, PRESETS[k].order); sync(); send(); }, get busy(){ return busy; }, view };

  readHash(); buildForm(); sync(); fit();
  (async () => { lock(true); try{ await freshTable(); status('YOUR TURN'); }catch(err){ console.error(err); status('ERROR — ' + err.message); } finally{ lock(false); } })();
})();
