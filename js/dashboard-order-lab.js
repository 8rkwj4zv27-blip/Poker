"use strict";

/* ============================================================
   DASHBOARD ORDER FORM (Lab)

   The real game (index.html, every production script and stylesheet) runs
   in a same-origin sandboxed frame with css/dashboard-order.css and
   js/dashboard-order.js injected. The form is the order: one row per
   dashboard job, one per behaviour. Each change is sent to the game with
   DashOrder.apply(), and the dashboard rebuilds.

   ISOLATION: same scheme as intro-lab.html. The copy is built as srcdoc
   with a shim that replaces Storage in the frame with an in-memory map
   before any game script runs, and the service-worker block is stripped;
   if either fails the game is not started. This page never touches
   localStorage.
   ============================================================ */
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const frame = $('#ol-frame');
  const status = t => { $('#ol-status').textContent = t; };
  const gameHost = document.querySelector('[data-game]');
  const GAME = (gameHost && gameHost.dataset.game) || 'index.html';
  const V = '3';

  /* The form. First option of every row is V1 (value '0'). Round 2: the
     owner's picks from round 1 are fixed (FIXED below) and no longer rows. */
  const SECTIONS = [
    { title:'FRAME', jobs:[
      { key:'build', name:'BUILD', hint:'the dashboard as its own instrument', opts:[
        ['0','V1', 'Today\'s case and thin rim line, sitting on the table.'],
        ['chunky','CHUNKY', 'Lifted off the table: a thick stepped frame all round, a deep lip, a heavy shadow.'],
        ['smooth','SMOOTH', 'A moulded shell: big round corners, soft two-step bevels, rounded bays.'],
        ['rail','PADDED RAIL', 'The rim is a stitched bumper, like a poker table\'s padded rail.'],
        ['whacky','WHACKY', 'Cut corners, a heavy top lip that throws a shadow, a stepped foot.']] },
      { key:'recess', name:'RECESS', hint:'how the bays are sunk', opts:[
        ['0','V1', 'Today\'s bays.'],
        ['sunk','HARD SUNK', 'Near-black, a hard shadow along the top, a lit lip below.'],
        ['ring','RINGED', 'A raised bevelled ring round each bay, then the recess.'],
        ['double','DOUBLE STEP', 'Two steps down, like a trench.']] },
      { key:'rim', name:'RIM LIGHT', hint:'where the light lives', opts:[
        ['0','OFF', 'No light.'],
        ['channel','CHANNEL', 'A groove round the frame with a light strip in it.'],
        ['lamps','LAMP ROW', 'Square lamps set into the top and bottom of the frame. They light together, never chase.'],
        ['under','UNDERGLOW', 'Light spills out from under the machine onto the table.'],
        ['pipe','LIGHT PIPE', 'Only the top edge lights, behind smoked glass.']] },
      { key:'light', name:'LIGHT', hint:'turn amber · all in red · win warm · bust dark', opts:[
        ['0','SUBTLE', 'A soft light.'], ['bold','BOLD', 'Brighter, with more spill.']] }
    ]},
    { title:'PARTS', jobs:[
      { key:'tray', name:'CARD TRAY', hint:'where your cards stand', opts:[
        ['0','V1', 'Today\'s thin lip.'],
        ['slot','SLOT', 'A slot cut into the top edge of the machine; the cards stand down in it behind a chunky lip.'],
        ['rise','SLOT + RISE', 'The slot, and each new hand\'s cards rise up out of it.']] },
      { key:'bet', name:'BET THIS HAND', hint:'right end of the bankroll row', opts:[
        ['0','V1', 'A printed label over a screen.'],
        ['drum','SMALL DRUM', 'A small reel counter, the stack\'s own part, in its own housing.'],
        ['window','WINDOW', 'Small reels inside the stack drum\'s gold frame, after a divider.'],
        ['crt','CRT CELL', 'A money cell on the screen\'s top line; the row is all drum.'],
        ['tape','PAPER TAPE', 'An adding-machine tape: each bet prints the new total, a new hand tears it off.']] },
      { key:'bay', name:'BUTTON BAY', hint:'FOLD / CHECK / RAISE unchanged', opts:[
        ['0','V1', 'Keys in today\'s recess.'],
        ['flush','FLUSH BED', 'Each key sits in its own well in the case, dark seams, no frame over it.'],
        ['plinth','PLINTHS', 'Each key stands on its own raised base.'],
        ['bank','KEY BANK', 'One moulded block with dividers, like a typewriter\'s key row.'],
        ['cradle','CRADLE', 'One shallow cradle; key tops level with its rim, nothing overlaps.']] }
    ]},
    { title:'RAISE', jobs:[
      { key:'raise', name:'MECHANISM', hint:'tap RAISE (or BET)', opts:[
        ['0','V1', 'Today\'s drawer.'],
        ['drumf','DRUM', 'The panel is a drum: it rolls forward, the sizing face comes up, overshoots and locks.'],
        ['drumb','DRUM BACK', 'The same drum, rolling the other way.'],
        ['barrel','BARREL', 'The drum with its edge showing: the next face\'s name printed on the band above.'],
        ['slide','SLIDE', 'The sizing tray slides up out of the seam in steps and locks.']] },
      { key:'sizing', name:'SIZING', hint:'every change rolls the drum', opts:[
        ['0','V1', 'Today\'s slider.'],
        ['fader','FADER', 'A cream cap in a deep slot; it clicks at each notch and lifts while you hold it.'],
        ['wheel','THUMBWHEEL', 'A ridged wheel half-sunk in the case: roll it, or flick it and let it spin down.'],
        ['combo','COMBINATION', 'Up and down keys under every digit of the drum; you can drag the digits too.']] }
    ]},
    { title:'BEHAVIOURS', jobs:[
      { key:'knock', name:'KNOCK TO CHECK', hint:'double-tap the dashboard', opts:[
        ['0','OFF', 'Buttons only.'], ['on','ON', 'Double-tap the case to check. Facing a bet, it refuses with a buzz.']] },
      { key:'peek', name:'CARD PEEK', hint:'a setting, off by default', opts:[
        ['0','OFF', 'Cards face up.'], ['hold','HOLD TO PEEK', 'Cards stay face-down until you hold them. The screen waits for your first peek.']] },
      { key:'allin', name:'ALL IN KEY', hint:'on the sizing face', opts:[
        ['0','V1', 'The ALL-IN quick key, then confirm.'], ['hold','HOLD TO CHARGE', 'A danger key: hold it and it charges, with rising ticks and hum. Let go early to cancel.']] }
    ]}
  ];
  const JOBS = SECTIONS.flatMap(s => s.jobs);
  // Signed off in round 1: the bankroll row (no STACK label, one screen), V1 height, pucks.
  const FIXED = { layout:'rows', blinds:'pucks' };
  const V1 = Object.fromEntries(JOBS.map(j => [j.key, '0']).concat(Object.keys(FIXED).map(k => [k, '0'])));
  // The owner's round-2 order: the Dashboard V2 build spec.
  const SUGGESTED = { build:'smooth', recess:'sunk', rim:'channel', light:'bold', tray:'0', bet:'drum', bay:'cradle',
    raise:'barrel', sizing:'fader', knock:'on', peek:'hold', allin:'hold' };
  let order = Object.assign({}, SUGGESTED);
  const view = { theme:'emerald', sound:'on', motion:'on', size:'430' };
  // Phone sizes the rules ask for: [width, height, top safe area, bottom safe area, name].
  const SIZES = { '430':[430,932,59,34,'iPhone 15 Pro Max'], '390':[390,844,47,34,'iPhone 15'], '320':[320,700,20,0,'small phone'] };
  let comparing = false;

  function readHash(){
    const q = new URLSearchParams(location.hash.slice(1));
    JOBS.forEach(j => { const v = q.get(j.key); if (v && j.opts.some(o => o[0] === v)) order[j.key] = v; });
    Object.keys(view).forEach(k => { const v = q.get(k); if (v) view[k] = v; });
  }
  function writeHash(){ try{ history.replaceState(null, '', '#' + new URLSearchParams(Object.assign({}, order, view)).toString()); }catch(e){} }

  /* ---- the form ---- */
  function buildForm(){
    $('#ol-rows').innerHTML = SECTIONS.map(s => '<h3 class="ol-sec">' + s.title + '</h3>' + s.jobs.map(j =>
      '<div class="ol-job" data-job="' + j.key + '"><div class="ol-job-head"><b>' + j.name + '</b><small>' + j.hint + '</small></div>' +
      '<div class="ol-seg">' + j.opts.map(o => '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>' +
      '<div class="ol-job-note"></div></div>').join('')).join('');
    $('#ol-rows').addEventListener('click', e => {
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
      $('.ol-job-note', row).textContent = o ? o[2] : '';
    });
    $$('[data-view]').forEach(seg => $$('button', seg).forEach(b => b.classList.toggle('is-on', view[seg.dataset.view] === b.dataset.v)));
    $('#ol-summary').innerHTML = JOBS.map(j => {
      const o = j.opts.find(x => x[0] === order[j.key]);
      return '<li class="' + (order[j.key] === '0' ? 'is-v1' : '') + '">' + j.name.toLowerCase().replace(/^./, c => c.toUpperCase()) + ': <b>' + o[1] + '</b></li>';
    }).join('');
    writeHash();
  }
  const win = () => frame.contentWindow;
  const bridge = () => { try{ return win().__orderLab || null; }catch(e){ return null; } };
  function send(){
    const b = bridge(); if (!b || !win().DashOrder) return;
    win().DashOrder.apply(comparing ? V1 : Object.assign({}, order, FIXED));
  }
  function applyView(){
    const b = bridge(); if (!b || !b.settings) return;
    b.settings.theme = view.theme; b.settings.sound = view.sound === 'on'; b.settings.reduceMotion = view.motion === 'off';
    try{ win().applyTheme(); }catch(e){}
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
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('order lab')); }; }catch(e){} }
    window.__orderLabIsolated = (function(){ try{ localStorage.setItem('__ol','1'); return mem.__ol === '1'; }catch(e){ return false; } })();
  })();`;
  const BRIDGE = `window.__orderLab = {
    get game(){ return typeof game === 'undefined' ? null : game; },
    get pending(){ return typeof pendingHumanPlayer === 'undefined' ? null : pendingHumanPlayer; },
    get settings(){ return typeof settings === 'undefined' ? null : settings; },
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
      .replace(/<\/body>/i, '<link rel="stylesheet" href="css/dashboard-order.css?v=' + V + '"><script src="js/dashboard-order.js?v=' + V + '"><\/script><script>' + BRIDGE + '<\/script></body>');
  }
  async function loadFrame(){
    status('LOADING…');
    const doc = await buildDoc();
    await new Promise(r => { frame.onload = () => r(); frame.srcdoc = doc + '<!-- ' + Date.now() + ' -->'; });
    if (!win().__orderLabIsolated){ frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>'; throw new Error('storage isolation failed'); }
    const b = bridge();
    if (b && b.intro) b.intro.uninstall();   // the table intro has its own lab; here it only slows each moment down
    applyView(); send();
  }

  /* ---- moments: each plays the real game to that point ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }
  const doc = () => win().document;
  const myTurn = () => { const b = bridge(); return !!(b && b.game && !b.game.over && b.pending && !doc().getElementById('actions-row').classList.contains('disabled') && !doc().getElementById('console-flip').classList.contains('flipped')); };
  async function freshTable(){
    await loadFrame();
    status('DEALING…');
    win().startSinglePlayerRun({ opponentCount:4 });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    await sleep(300);
  }
  async function ensureTurn(){ if (!myTurn()) await freshTable(); const p = doc().getElementById('raise-panel'); if (p.classList.contains('show')) doc().getElementById('raise-cancel').click(); }
  const human = () => bridge().game.players.find(p => p.isHuman);
  const MOMENTS = {
    async deal(){ await freshTable(); },
    async raise(){ await ensureTurn(); doc().getElementById('btn-raise').click(); },
    async shove(){
      await ensureTurn();
      for (let tries = 0; tries < 3; tries++){
        win().devKoNext();
        const call = bridge().game.currentBet - bridge().pending.betThisRound;
        win().humanAct(call > 0 ? 'call' : 'check');
        const ok = await waitFor(() => myTurn() && bridge().game.players.some(p => !p.isHuman && p.allIn && !p.folded), 20000);
        if (ok) return;
        if (!myTurn()) await freshTable();
      }
    },
    async allin(){ await ensureTurn(); win().devRigForWinner(human()); win().humanAct('allin'); },
    async win(){ await ensureTurn(); win().devWinHand(); },
    // The game's own devBustMe() only leans the deck toward an opponent,
    // so it can still lose. Here the rest of the real deck is ordered so the
    // opponent's hand wins (dealCommunity pops from the end, no burns).
    async bust(){
      for (let tries = 0; tries < 4; tries++){
        await ensureTurn();
        // devBustMe() shoves against the first live opponent; make sure
        // that opponent calls (the game's own dev flag), then rig the board.
        const rival = bridge().game.players.find(p => !p.isHuman && p.inHand && !p.folded && !p.eliminated);
        if (rival) rival._devAutoCall = true;
        win().eval('DEV_MODE = true');   // the dev flags only act in dev mode; sandbox memory only
        win().devBustMe();
        await sleep(120);
        rigAgainstHuman();
        // Tap AWARD POT for you when the result waits for it, so the moment
        // carries on into the bust and the RUN OVER roll.
        const done = await waitFor(() => {
          const award = doc().getElementById('btn-award-pot-console');
          if (doc().getElementById('console-flip').classList.contains('flipped') && award && !award.disabled) award.click();
          return myTurn() || bridge().game.over || (human() && human().eliminated);
        }, 40000);
        win().eval('DEV_MODE = false');
        if (!done || bridge().game.over || human().eliminated) return;
      }
    }
  };
  function rigAgainstHuman(){
    const w = win(), g = bridge().game, me = human();
    const rival = g.players.find(p => !p.isHuman && p.inHand && !p.folded && !p.eliminated);
    const need = 5 - g.board.length;
    if (!rival || need <= 0) return;
    for (let t = 0; t < 600; t++){
      const run = w.shuffle(g.deck).slice(0, need);
      const board = g.board.concat(run);
      if (w.compareHands(w.evaluate7(me.hand.concat(board)), w.evaluate7(rival.hand.concat(board))) < 0){
        const keys = new Set(run.map(w.cardKey));
        g.deck = g.deck.filter(c => !keys.has(w.cardKey(c))).concat(run.slice().reverse());
        return;
      }
    }
  }
  let busy = false;
  $$('[data-moment]').forEach(b => b.addEventListener('click', async () => {
    if (busy) return; busy = true;
    $$('[data-moment]').forEach(x => x.disabled = true);
    try{ status('PLAYING…'); await MOMENTS[b.dataset.moment](); status(b.textContent); }
    catch(err){ console.error(err); status('ERROR — ' + err.message); }
    finally{ busy = false; $$('[data-moment]').forEach(x => x.disabled = false); }
  }));
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => { order = Object.assign({}, b.dataset.preset === 'v1' ? V1 : SUGGESTED); sync(); send(); }));
  const cmp = $('#ol-compare');
  const hold = on => { comparing = on; cmp.classList.toggle('is-held', on); send(); };
  cmp.addEventListener('pointerdown', e => { e.preventDefault(); hold(true); });
  ['pointerup','pointercancel','pointerleave'].forEach(t => cmp.addEventListener(t, () => { if (comparing) hold(false); }));
  $$('[data-view]').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; view[seg.dataset.view] = b.dataset.v; sync(); applyView(); applySize(); }));
  function applySize(){
    const z = SIZES[view.size] || SIZES['430'], ph = $('#ol-phone');
    ph.style.width = z[0] + 'px'; ph.style.height = z[1] + 'px'; ph.style.paddingTop = z[2] + 'px'; ph.style.paddingBottom = z[3] + 'px';
    $('#ol-size').textContent = z[4] + ' · ' + z[0] + ' × ' + z[1];
    fit();
  }
  $('#ol-copy').addEventListener('click', async () => {
    const text = 'Dashboard order:\n' + JOBS.map(j => '- ' + j.name + ': ' + j.opts.find(o => o[0] === order[j.key])[1]).join('\n');
    try{ await navigator.clipboard.writeText(text); $('#ol-copied').textContent = 'Copied. Paste it into the chat.'; }
    catch(e){ $('#ol-copied').textContent = 'Copy blocked here; the list above is your order.'; }
  });

  function fit(){
    const st = $('.ol-stage'), k = Math.min(1, (st.clientHeight - 50) / 960, (st.clientWidth - 30) / 460);
    $('#ol-phone').style.setProperty('--fit', k.toFixed(3));
  }
  window.addEventListener('resize', fit);

  window.__orderForm = { MOMENTS, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); sync(); send(); }, get busy(){ return busy; } };

  readHash(); buildForm(); sync(); applySize();
  (async () => { busy = true; try{ await freshTable(); status('YOUR TURN'); }catch(err){ console.error(err); status('ERROR — ' + err.message); } finally{ busy = false; } })();
})();
