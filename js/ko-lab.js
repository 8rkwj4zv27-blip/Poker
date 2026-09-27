"use strict";

/* ============================================================
   K.O. ORDER FORM, ROUND 1 (Lab)

   The real game (index.html, every production script and stylesheet) runs
   in a same-origin sandboxed frame at the owner's phone (iPhone 15 Pro
   Max, installed app: 430 x 932, safe areas rewritten to 59px / 34px, as
   enemy-card-lab.html does), with the candidate css/ko-fx.css and
   js/ko-fx.js injected. The form is the order: one row per job in an
   opponent's K.O. and in your own game over. Each change goes to the game
   with KoFx.apply().

   K.O. / DOUBLE / TRIPLE / OUT / YOU BUST replay the moment on the table
   in view (presentation only, through KoFx.lab) and put it back, so they
   can be pressed over and over. REAL K.O. and REAL BUST play an actual
   hand through the game's own path.

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
  const GAME = window.KO_LAB_GAME || 'index.html';
  const V = '4';

  /* The form. The first option of every row is today's game. */
  const SECTIONS = [
    { title:'THE K.O. · THE BEAT', jobs:[
      { key:'len', name:'LENGTH', hint:'the whole K.O.', opts:[
        ['today','TODAY', 'The shipped timing.'],
        ['short','SHORT', 'About a quarter quicker all through.'],
        ['long','LONG', 'About a third longer, with a held, dead-still beat before the blast.'],
        ['epic','EPIC', 'Two thirds longer: the longest holds, longer slow motion, the face stays on the glass longer.']] },
      { key:'build', name:'BUILD-UP', hint:'before the stamp', opts:[
        ['today','TODAY', 'Two thunks, the card shakes harder each time.'],
        ['count','REF COUNT', 'Their readout counts 3 · 2 · 1 with a boxing bell on each number; the rim goes red and the face gets more scared each count. The bell rings out three times on the K.O.'],
        ['both','THUNKS + COUNT', 'The two thunks, then the count.']] },
      { key:'spot', name:'SPOTLIGHT', hint:'the rest of the table', opts:[
        ['0','NONE', 'Today: the table stays lit.'],
        ['soft','SOFT', 'New: a round pool of light on the doomed seat with a long soft edge; the rest dims gently. Fades in and out.'],
        ['rings','PIXEL RINGS', 'New: the same pool drawn as four stepped rings, like pixel-art lighting.'],
        ['beam','BEAM', 'New: a soft cone of light coming down from the top of the screen onto the seat.']] },
      { key:'stamp', name:'STAMP', hint:'the K.O. itself', opts:[
        ['0','READOUT', 'Today: K.O.! on their readout.'],
        ['big','BIG K.O.!', 'Also a big pixel K.O.! slams onto the felt; the blast knocks it away. DOUBLE K.O.! / TRIPLE K.O.! for a multi. Someone else\'s knockout gets a quieter grey OUT!.']] }
    ]},
    { title:'THE K.O. · THE BLAM', jobs:[
      { key:'blam', name:'BLAM', hint:'the moment it fires', opts:[
        ['0','TODAY', 'The sound, a spark and the card\'s recoil.'],
        ['shake','SHAKE + FLASH', 'The whole screen jolts and flashes for a frame.'],
        ['debris','+ DEBRIS', 'And bits of the socket blow out of the bottom, in their colour.']] },
      { key:'multi', name:'MULTI K.O.', hint:'two or three at once', opts:[
        ['today','TODAY', 'They all fire almost together, a tenth of a second apart.'],
        ['stagger','ONE BY ONE', 'New: they fire one after another, about half a second apart, each with its own blast, the last the biggest. The ones still waiting rattle in their sockets.'],
        ['slow','SLOW', 'The same, nearly a second apart.']] },
      { key:'react', name:'THE OTHERS', hint:'the players still in', opts:[
        ['0','NONE', 'Today: they don\'t react.'],
        ['flinch','FLINCH', 'Every other opponent flinches and pulls a scared face at the blast.'],
        ['quip','FLINCH + QUIP', 'And afterwards, most of the time, one of them says something short on their readout.']] }
    ]},
    { title:'THE K.O. · THE FLIGHT', jobs:[
      { key:'trail', name:'TRAIL', hint:'behind the face', opts:[
        ['0','NONE', 'Today.'],
        ['faint','FAINT', 'One or two faint afterimages.'],
        ['light','LIGHT', 'About three, a little stronger.'],
        ['ghosts','HEAVY', 'Round 1\'s: about six strong afterimages.']] },
      { key:'face', name:'FACE', hint:'while it flies', opts:[
        ['0','FIXED', 'Today: the dead face all the way.'],
        ['reacts','REACTS', 'A new face on every hit: shocked, dazed, dead, baffled…']] },
      { key:'sparks', name:'HITS', hint:'every bounce', opts:[
        ['0','TODAY', 'The clonk and a squash.'],
        ['sparks','SPARKS', 'Sparks fly off every contact point; the last hit jolts the screen.']] },
      { key:'seats', name:'OTHER SEATS', hint:'in its way', opts:[
        ['0','FLIES OVER', 'Today: it passes over the other cards.'],
        ['solid','SOLID', 'The other cabinets are solid: it bounces off them, and a seat it hits rattles and pulls a face.']] },
      { key:'slow', name:'SLOW MOTION', hint:'bullet time', opts:[
        ['0','NONE', 'Today.'],
        ['first','FIRST HIT', 'The first bounce drops to quarter speed for a moment.'],
        ['last','LAST HIT', 'The exit plays slow (with THE GLASS, the flight at you).'],
        ['both','BOTH', 'First and last.']] }
    ]},
    { title:'THE K.O. · THE EXIT', jobs:[
      { key:'exit', name:'EXIT', hint:'how it leaves', opts:[
        ['0','OFF SCREEN', 'Today: it ricochets out through the frame.'],
        ['glass','THE GLASS', 'Its last bounce sends it at you: it grows, smacks into the screen, slides down the glass and drops away.'],
        ['mix','EITHER', 'A coin toss each time.']] },
      { key:'socket', name:'EMPTY SOCKET', hint:'what\'s left behind', opts:[
        ['0','DARK', 'Today: a dark hole.'],
        ['smoke','SMOKE', 'Smoke curls up out of it for a few seconds, with the odd spark.'],
        ['static','NO SIGNAL', 'The socket fills with CRT snow and NO SIGNAL.'],
        ['both','SMOKE + SIGNAL', 'Both.']] }
    ]},
    { title:'YOUR GAME OVER', sub:'Your dashboard dies before the RUN OVER / EVENT LOST stage rolls in.', jobs:[
      { key:'killer', name:'THE KILLER', hint:'who busted you', opts:[
        ['0','NONE', 'Today: straight on.'],
        ['gloat','GLOATS', 'A spotlight on the opponent who took your last chip: rim lit, smug face, a two-word gloat on their readout.']] },
      { key:'hit', name:'THE HIT', hint:'your dashboard', opts:[
        ['0','NONE', 'Today.'],
        ['thunks','THUNKS', 'Your dashboard takes two thunks from below, like an opponent\'s socket; the screens glitch.']] },
      { key:'damage', name:'DAMAGE', hint:'what breaks', opts:[
        ['buttons','BUTTONS ONLY', 'Round 1: just the buttons (and your cards, if they pop).'],
        ['chain','CHAIN REACTION', 'A random handful of the parts below give out one after another, crackling and popping, as well as the buttons. Different every time.'],
        ['wreck','TOTAL WRECK', 'Every part below goes, fast.']] },
      { key:'amount', name:'HOW MUCH', hint:'with CHAIN REACTION', opts:[
        ['random','RANDOM', 'Anything from one part to four, at random.'],
        ['loss','BY THE LOSS', 'The bigger the hand that busted you, the more breaks. (Replays pick a random loss.)']] },
      { key:'fuse', name:'BUTTONS', hint:'shot off', opts:[
        ['0','NONE', 'The buttons stay put.'],
        ['one','ONE', 'One button is shot off and pinballs round the table. Its hole smokes.'],
        ['three','ALL THREE', 'All three go, one after another.'],
        ['random','1 OR 3', 'Round 1\'s: a coin toss, one or all three.'],
        ['any','1, 2 OR 3', 'Any number from one to three.']] },
      { key:'cards', name:'YOUR CARDS', hint:'the losing hand', opts:[
        ['0','STAY', 'Today.'],
        ['pop','POP OUT', 'Your two cards pop out of the tray and fly too.']] },
      { key:'lights', name:'LIGHTS OUT', hint:'the ending', opts:[
        ['0','TODAY', 'The dashboard dims and the stage rolls in.'],
        ['tilt','TILT', 'Every screen on your dashboard flashes TILT with a buzzer, then goes dark.'],
        ['crt','CRT OFF', 'The whole screen switches off like an old TV: down to a line, a dot, black. The result stage switches back on out of the black.'],
        ['rubble','RUBBLE', 'No switch-off: what\'s left flickers, sputters and dies where it stands, smoke still curling out. Then the stage rolls in.'],
        ['mix','CRT OR RUBBLE', 'A coin toss each time.']] },
      { key:'gopace', name:'PACE', hint:'your game over', opts:[
        ['quick','QUICK', 'Tight beats.'],
        ['long','LONG', 'Every beat held longer.']] }
    ]},
    { title:'YOUR GAME OVER · THE PARTS', sub:'What CHAIN REACTION and TOTAL WRECK can break. Switch off any you don\'t want.', jobs:[
      { key:'pScreens', name:'SCREENS', hint:'hand, banner, bet', opts:[['on','ON', 'A screen floods with static, switches itself off, or its glass pops out and flies. (No more cracks.)'],['off','OFF', 'The screens never break.']] },
      { key:'pNumbers', name:'NUMBERS', hint:'your stack drums', opts:[['on','ON', 'The drums go haywire: each spins its own way at its own speed, overshoots, lurches back and jams on red nonsense. One to three of them (the $ too) spit out and fly.'],['off','OFF', 'Left alone.']] },
      { key:'pLamps', name:'LAMPS', hint:'SB / BB', opts:[['on','ON', 'The bulbs pop with a flash and go dark; sometimes one shoots out.'],['off','OFF', 'Left alone.']] },
      { key:'pRim', name:'RIM LIGHT', hint:'round the dashboard', opts:[['on','ON', 'It shorts: sparks crawl along it, it stutters red, then it dies.'],['off','OFF', 'Left alone.']] },
      { key:'pKey', name:'SETTINGS KEY', hint:'the cog', opts:[['on','ON', 'The key pops off and flies.'],['off','OFF', 'Left alone.']] },
      { key:'pBracket', name:'BRACKET', hint:'the whole console', opts:[['on','ON', 'A bracket snaps: the console lurches and hangs a little crooked.'],['off','OFF', 'Left alone.']] }
    ]}
  ];
  const JOBS = SECTIONS.flatMap(s => s.jobs);
  const TODAY = Object.fromEntries(JOBS.map(j => [j.key, j.opts[0][0]]));
  // YOUR ORDER: the owner's round-3 order, live in the game since v0.43.0.
  const PICK = { len:'today', build:'count', spot:'0', stamp:'big', blam:'debris', react:'flinch', trail:'light', face:'reacts',
    sparks:'sparks', seats:'solid', slow:'0', exit:'0', socket:'smoke', multi:'stagger',
    killer:'gloat', hit:'thunks', damage:'chain', amount:'random', fuse:'any', cards:'pop', lights:'mix', gopace:'long',
    pScreens:'on', pNumbers:'on', pLamps:'on', pRim:'on', pKey:'on', pBracket:'on' };
  const MAX = Object.assign({}, PICK, { len:'epic', build:'both', spot:'soft', react:'quip', slow:'both', exit:'glass', socket:'both', killer:'gloat',
    damage:'wreck', fuse:'three', cards:'pop', trail:'ghosts' });
  let order = Object.assign({}, PICK);
  const view = { opp:'4', theme:'emerald', sound:'on', motion:'on', loop:'off' };

  function readHash(){
    const q = new URLSearchParams(location.hash.slice(1));
    JOBS.forEach(j => { const v = q.get(j.key); if (v && j.opts.some(o => o[0] === v)) order[j.key] = v; });
    Object.keys(view).forEach(k => { const v = q.get(k); if (v && k !== 'loop') view[k] = v; });
  }
  function writeHash(){ try{ history.replaceState(null, '', '#' + new URLSearchParams(Object.assign({}, order, view, { loop:'off' })).toString()); }catch(e){} }

  /* ---- the form ---- */
  function buildForm(){
    $('#sl-rows').innerHTML = SECTIONS.map(s => '<h3 class="sl-sec">' + s.title + (s.sub ? '<small>' + s.sub + '</small>' : '') + '</h3>' + s.jobs.map(j =>
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
      $$('button', row).forEach(b => {
        b.classList.toggle('is-on', b.dataset.v === order[j.key]);
        b.classList.toggle('is-today', b.dataset.v === j.opts[0][0]);
      });
      const o = j.opts.find(x => x[0] === order[j.key]);
      $('.sl-job-note', row).textContent = o ? o[2] : '';
    });
    $$('[data-view]').forEach(seg => $$('button', seg).forEach(b => b.classList.toggle('is-on', view[seg.dataset.view] === b.dataset.v)));
    $('#sl-summary').innerHTML = SECTIONS.map(s => '<li class="is-sec">' + s.title.replace('THE K.O. · ', 'K.O. · ') + '</li>' + s.jobs.map(j => {
      const o = j.opts.find(x => x[0] === order[j.key]);
      return '<li class="' + (order[j.key] === j.opts[0][0] ? 'is-today' : '') + '">' + j.name.charAt(0) + j.name.slice(1).toLowerCase() + ': <b>' + o[1] + '</b></li>';
    }).join('')).join('');
    writeHash();
  }
  const win = () => frame.contentWindow;
  const bridge = () => { try{ return win().__koLab || null; }catch(e){ return null; } };
  const fx = () => { const b = bridge(); return b && b.fx; };
  function send(){ const k = fx(); if (k) k.apply(order); }
  function applyView(){
    const b = bridge(); if (!b || !b.settings) return;
    b.settings.theme = view.theme; b.settings.sound = view.sound === 'on'; b.settings.reduceMotion = view.motion === 'off';
    try{ win().applyTheme(); }catch(e){}
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
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('ko lab')); }; }catch(e){} }
    window.__koLabIsolated = (function(){ try{ localStorage.setItem('__ko','1'); return mem.__ko === '1'; }catch(e){ return false; } })();
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
  window.__koLab = {
    get game(){ return typeof game === 'undefined' ? null : game; },
    get pending(){ return typeof pendingHumanPlayer === 'undefined' ? null : pendingHumanPlayer; },
    get settings(){ return typeof settings === 'undefined' ? null : settings; },
    setDev(on, fast){ DEV_MODE = !!on; FAST_DEV = !!(on && fast); },
    intro: typeof TableIntro === 'undefined' ? null : TableIntro,
    fx: typeof KoFx === 'undefined' ? null : KoFx,
    sound: typeof Sound === 'undefined' ? null : Sound
  };`;
  let source = null;
  async function buildDoc(){
    if (!source){ source = await (await fetch(GAME, { cache:'no-store' })).text(); }
    const sw = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    // the shipped K.O. (v0.43.0: css/knockout.css, js/knockout.js) comes out
    // of the copy: the candidate, with every option, stands in for it
    const liveJs = /<script src="js\/knockout\.js[^"]*"><\/script>/, liveCss = /<link rel="stylesheet" href="css\/knockout\.css[^"]*">/;
    if (!sw.test(source) || !liveJs.test(source) || !liveCss.test(source) || !/<head>/i.test(source) || !/<\/body>/i.test(source))
      throw new Error('game page shape changed; refusing to build an unisolated copy');
    const base = new URL('.', location.href).href;
    return source.replace(sw, '').replace(liveJs, '').replace(liveCss, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/<\/body>/i, '<link rel="stylesheet" href="css/ko-fx.css?v=' + V + '"><script src="js/ko-fx.js?v=' + V + '"><\/script><script>' + BRIDGE + '<\/script></body>');
  }
  async function loadFrame(){
    status('LOADING…');
    const doc = await buildDoc();
    await new Promise(r => { frame.onload = () => r(); frame.srcdoc = doc + '<!-- ' + Date.now() + ' -->'; });
    if (!win().__koLabIsolated){ frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>'; throw new Error('storage isolation failed'); }
    const b = bridge();
    if (b && b.intro) b.intro.uninstall();   // the table intro has its own lab; here it only slows each moment down
    applyView();
    send();
  }

  /* ---- moments ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }
  const doc = () => win().document;
  const g = () => bridge().game;
  const myTurn = () => { const b = bridge(); return !!(b && b.game && !b.game.over && b.pending && !doc().getElementById('actions-row').classList.contains('disabled') && !doc().getElementById('console-flip').classList.contains('flipped')); };
  async function freshTable(){
    await loadFrame();
    status('DEALING…');
    win().startSinglePlayerRun({ opponentCount:Number(view.opp) });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    await sleep(400);
  }
  function award(){
    const a = doc().getElementById('btn-award-pot-console');
    if (doc().getElementById('console-flip').classList.contains('flipped') && a && !a.disabled && !a.classList.contains('next-table-mode')) a.click();
  }
  function nextHandKey(){ const n = doc().getElementById('btn-next-hand'); if (n && !n.classList.contains('hidden')) n.click(); }
  // A table to replay on: this one while it's live, a fresh one after a
  // real bust / cleared table, or when too few opponents are left.
  async function ensureTable(need){
    const b = bridge();
    const alive = () => g().players.filter(p => !p.isHuman && !p.eliminated).length;
    if (!b || !g() || g().over || g().phase === 'setup' || alive() < (need || 1)) await freshTable();
  }
  async function ensureTurn(){
    if (!myTurn() && bridge() && g() && !g().over) await waitFor(() => { award(); nextHandKey(); return myTurn() || g().over; }, 15000);
    if (!myTurn()) await freshTable();
    const p = doc().getElementById('raise-panel'); if (p && p.classList.contains('show')) doc().getElementById('raise-cancel').click();
  }
  const human = () => g().players.find(p => p.isHuman);
  const live = () => g().players.filter(p => !p.isHuman && p.inHand && !p.folded && !p.eliminated);
  const passive = () => { const call = g().currentBet - bridge().pending.betThisRound; win().humanAct(call > 0 ? 'call' : 'check'); };
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
  const replay = n => async ko => {
    await ensureTable(n);
    send();
    await fx().lab.ko(n, ko);
  };
  const MOMENTS = {
    async ko(){ await replay(1)(true); },
    async ko2(){ await replay(2)(true); },
    async ko3(){ await replay(3)(true); },
    async elim(){ await replay(1)(false); },
    async bust(){ await ensureTable(1); send(); await fx().lab.bust(); },
    async reset(){ if (fx()) fx().lab.reset(); },
    async deal(){ await freshTable(); },
    async realko(){
      if (fx()) fx().lab.reset();
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
          if (done){ await waitFor(() => { award(); return myTurn() || !doc().getElementById('btn-next-hand').classList.contains('hidden') || g().over; }, 30000); return; }
        }
        b.setDev(false);
      }
    },
    async realbust(){
      if (fx()) fx().lab.reset();
      for (let tries = 0; tries < 3; tries++){
        await ensureTurn();
        const me = human(), b = bridge();
        const rival = live().find(p => p.chips + p.betThisRound >= me.chips + me.betThisRound);
        if (!rival){ await freshTable(); continue; }
        live().forEach(p => { if (p !== rival && !p.allIn) win().applyAction(p, { action:'fold' }); });
        win().render();
        b.setDev(true, false);
        rival._devAutoCall = true;
        win().humanAct('allin');
        await sleep(60);
        rig(rival, me);
        const ok = await waitFor(() => { if (!rival.folded && !rival.allIn) rival._devAutoCall = true; award(); return g().over; }, 45000);
        b.setDev(false);
        if (ok){ await waitFor(() => doc().getElementById('felt').classList.contains('results-mode'), 30000); await sleep(1500); return; }
      }
    }
  };
  let busy = false;
  const lock = on => { busy = on; $$('[data-moment]').forEach(x => x.disabled = on); };
  async function play(name){
    if (busy) return; lock(true);
    try{
      status('PLAYING…');
      await MOMENTS[name]();
      status(name === 'reset' ? 'SEATS RESET' : name.startsWith('real') ? 'DONE' : 'REPLAYED · PRESS AGAIN');
    }
    catch(err){ console.error(err); status('ERROR — ' + err.message); }
    finally{ lock(false); }
    if (view.loop === 'on' && /^(ko|ko2|ko3|elim)$/.test(name)){ await sleep(1400); if (view.loop === 'on') play(name); }
  }
  $$('[data-moment]').forEach(b => b.addEventListener('click', () => play(b.dataset.moment)));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
    order = Object.assign({}, b.dataset.preset === 'today' ? TODAY : b.dataset.preset === 'max' ? MAX : PICK);
    sync(); send();
  }));
  $$('[data-view]').forEach(seg => seg.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const was = view[seg.dataset.view];
    view[seg.dataset.view] = b.dataset.v; sync(); applyView();
    if (seg.dataset.view === 'opp' && was !== b.dataset.v && !busy){
      lock(true);
      try{ await freshTable(); status('YOUR TURN'); }catch(err){ console.error(err); status('ERROR — ' + err.message); } finally{ lock(false); }
    }
  }));
  $('#sl-copy').addEventListener('click', async () => {
    const text = 'K.O. order (round 4):\n' + SECTIONS.map(s => s.title + '\n' + s.jobs.map(j => '- ' + j.name + ': ' + j.opts.find(o => o[0] === order[j.key])[1]).join('\n')).join('\n');
    try{ await navigator.clipboard.writeText(text); $('#sl-copied').textContent = 'Copied. Paste it into the chat.'; }
    catch(e){ $('#sl-copied').textContent = 'Copy blocked here; the list above is your order.'; }
  });

  /* ---- the phone frame fits the stage (and a phone's whole screen) ---- */
  const PHONE = '(max-width:760px), (pointer:coarse) and (max-width:1100px)';
  const phone = () => window.matchMedia(PHONE).matches;
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
  $$('[data-sheet-close]').forEach(k => k.addEventListener('click', () => sheet('')));

  /* iPhone plays sound only after a tap, and the taps land here, not in
     the game. Every tap wakes the game's audio (and the K.O. sounds) while
     it's still a tap. */
  document.addEventListener('pointerdown', () => {
    const b = bridge();
    try{ if (b && b.sound) b.sound.unlock(); }catch(e){}
    try{ if (b && b.fx && b.fx.unlock) b.fx.unlock(); }catch(e){}
  }, true);
  $$('[data-moment]').forEach(b => b.addEventListener('click', () => { if (phone()) sheet(''); }, true));

  window.__koForm = { MOMENTS, play, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); sync(); send(); }, get busy(){ return busy; }, view };

  readHash(); buildForm(); sync(); fit();
  (async () => { lock(true); try{ await freshTable(); status('YOUR TURN'); }catch(err){ console.error(err); status('ERROR — ' + err.message); } finally{ lock(false); } })();
})();
