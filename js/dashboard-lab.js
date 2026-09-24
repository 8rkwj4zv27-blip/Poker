"use strict";

/* ============================================================
   DASHBOARD V2 LAB

   Runs the REAL game (index.html, every production script and stylesheet)
   inside a same-origin iframe with css/dashboard-v2.css injected, so every
   dashboard candidate is judged on the real dashboard, with real cards,
   chips, reels and screens, in every table state.

   Options are attributes on the game's <html> (data-dv-<part>="<option>").
   No attribute = V1, so V1 here is the live game, not a copy of it.
   The recipe (direction, parts, theme, size) lives in the page address,
   so a combination can be sent and reopened as a link.

   ISOLATION. Same scheme as the Table Intro and Machine Wheel labs: the
   copy is built as srcdoc with a shim that runs before any game script
   and replaces Storage.prototype with an in-memory map in the frame's own
   realm, and the service-worker block is stripped. If either step can't be
   applied the frame is never loaded. This page never touches localStorage.
   ============================================================ */
(() => {
  const frame = document.getElementById('dl-frame');
  const panel = document.getElementById('dl-panel');
  const tab = document.getElementById('dl-tab');
  const status = document.getElementById('dl-status');
  const V = '1';
  const gameHost = document.querySelector('[data-game]');
  const GAME = (gameHost && gameHost.dataset.game) || 'index.html';

  /* The parts, in dashboard order. The first option of each is V1 (no
     attribute). Labels are what the owner sees. */
  const PARTS = [
    { key:'case',  name:'CASE',        hint:'housing and side bays',
      opts:[['0','V1'],['tidy','TIDY'],['cabinet','CABINET'],['bolted','BOLTED']] },
    { key:'bank',  name:'CHIP BANK',   hint:'left bay',
      opts:[['0','V1'],['tray','FELT TRAY'],['vault','VAULT']] },
    { key:'slot',  name:'CARD SLOT',   hint:'where your cards stand',
      opts:[['0','V1'],['deep','DEEP SLOT'],['clamp','BRASS CLAMP']] },
    { key:'read',  name:'SCREENS',     hint:'hand name + turn',
      opts:[['0','V1'],['plate','ONE PLATE']] },
    { key:'stack', name:'STACK',       hint:'your chip counter',
      opts:[['0','V1'],['plate','PLATE'],['window','WINDOW']] },
    { key:'right', name:'RIGHT BAY',   hint:'blinds, bet, speaker',
      opts:[['0','V1'],['lamps','LAMPS'],['grille','LAMPS+GRILLE']] },
    { key:'bay',   name:'BUTTON BAY',  hint:'buttons unchanged',
      opts:[['0','V1'],['cradle','CRADLE'],['hinge','CRADLE+HINGE']] },
    { key:'raise', name:'RAISE DRAWER',hint:'tap RAISE OPEN',
      opts:[['0','V1'],['drawer','DRAWER'],['tiles','DARK KEYS']] },
    { key:'turn',  name:'YOUR TURN',   hint:'waiting-for-you signal',
      opts:[['0','NONE'],['edge','EDGE LAMP'],['pilots','PILOTS']] }
  ];
  const DIRECTIONS = {
    v1:{ case:'0', bank:'0', slot:'0', read:'0', stack:'0', right:'0', bay:'0', raise:'0', turn:'0' },
    a: { case:'tidy', bank:'tray', slot:'deep', read:'0', stack:'plate', right:'lamps', bay:'0', raise:'drawer', turn:'0' },
    b: { case:'cabinet', bank:'tray', slot:'deep', read:'plate', stack:'plate', right:'lamps', bay:'cradle', raise:'drawer', turn:'edge' },
    c: { case:'bolted', bank:'vault', slot:'clamp', read:'plate', stack:'window', right:'grille', bay:'hinge', raise:'tiles', turn:'pilots' }
  };
  const view = { theme:'emerald', size:'393x852', motion:'on', sound:'off' };
  let parts = Object.assign({}, DIRECTIONS.b);
  let comparing = false;

  /* ---- recipe in the address ---- */
  function readHash(){
    const q = new URLSearchParams(location.hash.slice(1));
    PARTS.forEach(p => { const v = q.get(p.key); if (v && p.opts.some(o => o[0] === v)) parts[p.key] = v; });
    Object.keys(view).forEach(k => { const v = q.get(k); if (v) view[k] = v; });
  }
  function writeHash(){
    const q = new URLSearchParams();
    PARTS.forEach(p => q.set(p.key, parts[p.key]));
    Object.keys(view).forEach(k => q.set(k, view[k]));
    history.replaceState(null, '', '#' + q.toString());
  }

  const SHIM = `(function(){
    var mem = Object.create(null);
    mem['felt.settings'] = JSON.stringify({ sound:false, seenIntro:true });
    var P = Storage.prototype;
    P.getItem = function(k){ k = String(k); return k in mem ? mem[k] : null; };
    P.setItem = function(k, v){ mem[String(k)] = String(v); };
    P.removeItem = function(k){ delete mem[String(k)]; };
    P.clear = function(){ mem = Object.create(null); };
    P.key = function(i){ var k = Object.keys(mem)[i]; return k === undefined ? null : k; };
    try{ Object.defineProperty(P, 'length', { configurable:true, get:function(){ return Object.keys(mem).length; } }); }catch(e){}
    try{ if (parent && parent.__dashLabAudio){
      var Shared = function(){ return parent.__dashLabAudio(); };
      window.AudioContext = Shared; window.webkitAudioContext = Shared;
    } }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('dashboard lab')); }; }catch(e){} }
    window.__dashLabIsolated = (function(){ try{ localStorage.setItem('__dl','1'); return mem.__dl === '1'; }catch(e){ return false; } })();
  })();`;

  // Top-level let/const bindings aren't window properties; expose the few
  // the lab reads.
  const BRIDGE = `window.__dashLab = {
    intro: typeof TableIntro === 'undefined' ? null : TableIntro,
    get game(){ return typeof game === 'undefined' ? null : game; },
    get pending(){ return typeof pendingHumanPlayer === 'undefined' ? null : pendingHumanPlayer; },
    get settings(){ return typeof settings === 'undefined' ? null : settings; }
  };`;

  let source = null, busy = false, audio = null;
  window.__dashLabAudio = () => {
    if (!audio){
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = AC ? new AC() : null;
    }
    return audio;
  };
  const unlockAudio = () => {
    const c = window.__dashLabAudio();
    if (c && c.state === 'suspended'){ try{ c.resume(); }catch(e){} }
  };
  document.addEventListener('pointerdown', unlockAudio, true);
  const win = () => frame.contentWindow;
  const bridge = () => { try{ return win().__dashLab || null; }catch(e){ return null; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const setStatus = text => { status.textContent = text; };

  async function buildDoc(){
    if (!source){
      const res = await fetch(GAME, { cache:'no-store' });
      source = await res.text();
    }
    const swBlock = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    if (!swBlock.test(source) || !/<head>/i.test(source) || !/<\/body>/i.test(source)){
      throw new Error('game page shape changed; refusing to build an unisolated copy');
    }
    const base = new URL('.', location.href).href;
    return source
      .replace(swBlock, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/<\/body>/i,
        '<link rel="stylesheet" href="css/dashboard-v2.css?v=' + V + '">' +
        '<script>' + BRIDGE + '<\/script></body>');
  }

  async function loadFrame(){
    setStatus('LOADING…');
    const doc = await buildDoc();
    await new Promise(resolve => { frame.onload = () => resolve(); frame.srcdoc = doc; });
    if (!win().__dashLabIsolated){
      frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>';
      throw new Error('storage isolation failed');
    }
    // The Table Intro is judged in its own lab; here it only slows every
    // state button down.
    const b = bridge();
    if (b && b.intro) b.intro.uninstall();
    applyParts();
    applyView();
  }

  /* ---- options onto the game ---- */
  function applyParts(){
    let root;
    try{ root = win().document.documentElement; }catch(e){ return; }
    PARTS.forEach(p => {
      const v = comparing ? '0' : parts[p.key];
      if (v === '0') root.removeAttribute('data-dv-' + p.key);
      else root.setAttribute('data-dv-' + p.key, v);
    });
  }
  function applyView(){
    const [w, h] = view.size.split('x');
    document.documentElement.style.setProperty('--dl-w', w + 'px');
    document.documentElement.style.setProperty('--dl-h', h + 'px');
    const b = bridge();
    if (!b || !b.settings) return;
    b.settings.theme = view.theme;
    b.settings.reduceMotion = view.motion === 'off';
    b.settings.sound = view.sound === 'on';
    try{ win().applyTheme(); }catch(e){}
  }

  function currentDirection(){
    return Object.keys(DIRECTIONS).find(d => PARTS.every(p => DIRECTIONS[d][p.key] === parts[p.key])) || null;
  }

  /* ---- controls ---- */
  const partsHost = document.getElementById('dl-parts');
  PARTS.forEach(p => {
    const row = document.createElement('div');
    row.className = 'dl-part';
    row.innerHTML = '<div class="dl-part-head"><b>' + p.name + '</b><span>' + p.hint + '</span></div>' +
      '<div class="dl-seg" data-part="' + p.key + '">' +
      p.opts.map(o => '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
    partsHost.appendChild(row);
  });

  function renderControls(){
    document.querySelectorAll('[data-part]').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', parts[seg.dataset.part] === b.dataset.v));
    });
    document.querySelectorAll('[data-view]').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', view[seg.dataset.view] === b.dataset.v));
    });
    const dir = currentDirection();
    document.querySelectorAll('[data-dir]').forEach(b => b.classList.toggle('is-on', b.dataset.dir === dir));
  }
  function changed(){ renderControls(); applyParts(); writeHash(); }

  document.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => {
    parts = Object.assign({}, DIRECTIONS[b.dataset.dir]);
    changed();
  }));
  partsHost.addEventListener('click', e => {
    const b = e.target.closest('button'), seg = b && b.closest('[data-part]');
    if (!seg) return;
    parts[seg.dataset.part] = b.dataset.v;
    changed();
  });
  document.querySelectorAll('[data-view]').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    view[seg.dataset.view] = b.dataset.v;
    renderControls(); applyView(); writeHash();
  }));

  // Hold to see V1: press and hold swaps back to the live look.
  const compare = document.getElementById('dl-compare');
  const hold = on => { comparing = on; compare.classList.toggle('is-held', on); applyParts(); };
  compare.addEventListener('pointerdown', e => { e.preventDefault(); hold(true); });
  ['pointerup','pointercancel','pointerleave'].forEach(t => compare.addEventListener(t, () => { if (comparing) hold(false); }));

  const isPhone = () => !matchMedia('(min-width:760px)').matches;
  function setPanel(open){ panel.hidden = !open; tab.setAttribute('aria-expanded', String(open)); }
  tab.addEventListener('click', () => setPanel(panel.hidden));

  /* ---- table states: each plays the real game to that moment ---- */
  async function waitFor(test, timeoutMs){
    const end = performance.now() + timeoutMs;
    while (performance.now() < end){
      try{ if (test()) return true; }catch(e){}
      await sleep(80);
    }
    return false;
  }
  const $ = id => win().document.getElementById(id);
  const myTurn = () => {
    const b = bridge();
    return !!(b && b.game && !b.game.over && b.pending && b.game._humanCardsVisible &&
      !$('actions-row').classList.contains('disabled') &&
      !$('console-flip').classList.contains('flipped') &&
      !$('hud-frame').classList.contains('result-mode'));
  };

  async function freshTable(){
    win().startSinglePlayerRun({ opponentCount:4 });
    if (!await waitFor(myTurn, 30000)) throw new Error('the deal never reached your turn');
    await sleep(300);
  }
  // Brings the table to "your turn": uses the hand in play when it's
  // already your turn, otherwise reloads the sandbox and deals a new table
  // (a clean copy, so no half-finished result or award is left over).
  async function ensureTurn(){
    const panelOpen = $('raise-panel') && $('raise-panel').classList.contains('show');
    if (panelOpen) { $('raise-cancel').click(); await sleep(300); }
    if (!myTurn()){ await loadFrame(); await freshTable(); }
  }

  const RUNS = {
    async turn(){ await ensureTurn(); },
    async raise(){ await ensureTurn(); $('btn-raise').click(); await sleep(400); },
    async waiting(){ await ensureTurn(); $('btn-checkcall').click(); await sleep(350); },
    async folded(){ await ensureTurn(); $('btn-fold').click(); await sleep(350); },
    async allin(){ await ensureTurn(); win().humanAct('allin'); await sleep(500); },
    async won(){
      await ensureTurn();
      win().devWinHand();
      await waitFor(() => $('hud-frame').classList.contains('result-mode'), 15000);
      await sleep(600);
    }
  };

  document.querySelectorAll('[data-run]').forEach(b => {
    b.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      document.querySelectorAll('[data-run]').forEach(x => x.disabled = true);
      if (isPhone()) setPanel(false);
      const label = b.textContent;
      try{
        setStatus('DEALING…');
        await RUNS[b.dataset.run]();
        setStatus(label);
      } catch(err){
        console.error(err);
        setStatus('ERROR — ' + err.message);
      } finally{
        busy = false;
        document.querySelectorAll('[data-run]').forEach(x => x.disabled = false);
      }
    });
  });
  document.getElementById('dl-reset').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    try{ await loadFrame(); setStatus('DEALING…'); await freshTable(); setStatus('YOUR TURN'); }
    catch(err){ console.error(err); setStatus('ERROR — ' + err.message); }
    finally{ busy = false; }
  });

  // For scripted screenshots (validation/tools): set a recipe and a state.
  window.__dashLabDrive = {
    parts:() => Object.assign({}, parts),
    set(next){ Object.assign(parts, next); changed(); },
    direction(d){ parts = Object.assign({}, DIRECTIONS[d]); changed(); },
    view(next){ Object.assign(view, next); renderControls(); applyView(); writeHash(); },
    run:name => RUNS[name](),
    get ready(){ return !busy && !!bridge(); }
  };

  readHash();
  renderControls();
  writeHash();
  setPanel(!isPhone());
  (async () => {
    busy = true;
    try{ await loadFrame(); setStatus('DEALING…'); await freshTable(); setStatus('YOUR TURN'); }
    catch(err){ console.error(err); setStatus('ERROR — ' + err.message); }
    finally{ busy = false; }
  })();
})();
