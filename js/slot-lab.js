"use strict";

/* ============================================================
   TICKET SLOT LAB

   Four candidate designs for the Career Hub's ticket slot, shown on the
   REAL game (index.html, every production script and stylesheet) in a
   sandboxed same-origin iframe, with css/slot-lab.css injected after the
   production CSS. Switching option rewrites the slot's inner parts and
   sets data-slot on #career-hub; LIVE removes both, showing production.

   The buy-in is the real one (through the sandbox's own Career), so the
   ticket feed and shred are judged exactly as a player will see them.

   ISOLATION. Same scheme as the other labs: srcdoc with a shim that
   replaces Storage.prototype with an in-memory map before any game script
   runs, and the service-worker block stripped. If either fails, the frame
   is never loaded. This page never touches localStorage.
   ============================================================ */
(() => {
  const frame = document.getElementById('il-frame');
  const panel = document.getElementById('il-panel');
  const tab = document.getElementById('il-tab');
  const status = document.getElementById('il-status');
  const desc = document.getElementById('sl-desc');
  const GAME = 'index.html';
  const state = { slot:'b', mount:'now', theme:'emerald', speed:'1', sound:'on' };

  const OPTIONS = {
    a: 'A · CRADLE — the cream casing the main button sits in, with the black cartridge hole as the mouth and two standard lamps. Reads as one console with the button below.',
    b: 'B · READOUT — dark plastic like the menu top bar. A small screen under the mouth says what the slot is doing: INSERT TICKET, READING, SHREDDING, ACCEPTED, ENTRY PAID.',
    c: 'C · FLUSH — no plate. A recessed strip cut into the bottom of the ticket reader, two lamps, nothing else. The quietest option.',
    d: 'D · DOOR — A, plus the same dark door the menu’s Career slot drops. Shut until you buy in; opens for the ticket, drops shut once it is accepted.',
    live: 'LIVE — what is in the game now, for comparison.'
  };
  const MOUNTS = {
    now: '1 · AS NOW — a separate plate between the reader and the button.',
    stack: '2 · STACKED — the slot plate sits right on the button\u2019s cradle, same width: two tiers of one unit.',
    housing: '3 · HOUSING — one dark console panel holds the slot at the top and the button (and Abandon) below.',
    cradle: '4 · CRADLE — no dark plate: the cream cradle grows upward and the slot + readout are set into it above the button.',
    reader: '5 · READER — the slot hangs from the bottom of the ticket reader as part of its frame; the button stands alone.'
  };

  // Each option's slot parts. .ch2-intake-mouth is the one the ticket feed
  // measures, so every option keeps it.
  const PARTS = {
    a: '<span class="pc-lamp sl-lamp"></span><span class="ch2-intake-mouth"></span><span class="pc-lamp sl-lamp"></span><span class="pc-label sl-label">Ticket in</span>',
    b: '<span class="ch2-intake-mouth"></span><span class="pc-display sl-readout"><span class="pc-lamp sl-lamp"></span><span class="sl-text"></span></span>',
    c: '<span class="pc-lamp sl-lamp"></span><span class="ch2-intake-mouth"></span><span class="pc-lamp sl-lamp"></span>',
    d: '<span class="pc-lamp sl-lamp"></span><span class="ch2-intake-mouth"><span class="sl-door"></span></span><span class="pc-lamp sl-lamp"></span><span class="pc-label sl-label">Ticket in</span>'
  };

  const SHIM = `(function(){
    var mem = Object.create(null);
    mem['felt.settings'] = JSON.stringify({ sound:true, seenIntro:true, reduceMotion:false });
    var P = Storage.prototype;
    P.getItem = function(k){ k = String(k); return k in mem ? mem[k] : null; };
    P.setItem = function(k, v){ mem[String(k)] = String(v); };
    P.removeItem = function(k){ delete mem[String(k)]; };
    P.clear = function(){ mem = Object.create(null); };
    P.key = function(i){ var k = Object.keys(mem)[i]; return k === undefined ? null : k; };
    try{ Object.defineProperty(P, 'length', { configurable:true, get:function(){ return Object.keys(mem).length; } }); }catch(e){}
    try{ if (parent && parent.__slotLabAudio){
      var Shared = function(){ return parent.__slotLabAudio(); };
      window.AudioContext = Shared; window.webkitAudioContext = Shared;
    } }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('slot lab')); }; }catch(e){} }
    window.__slotLabIsolated = (function(){ try{ localStorage.setItem('__sl','1'); return mem.__sl === '1'; }catch(e){ return false; } })();
  })();`;

  const BRIDGE = `window.__slotLab = {
    get settings(){ return typeof settings === 'undefined' ? null : settings; },
    applyTheme: typeof applyTheme === 'function' ? applyTheme : null,
    showCareerScreen: typeof showCareerScreen === 'function' ? showCareerScreen : null,
    closeOverlays: typeof closeOverlays === 'function' ? closeOverlays : null,
    boot: typeof HomeBoot === 'undefined' ? null : HomeBoot,
    feedConfig: typeof TICKET_FEED_CONFIG === 'undefined' ? null : TICKET_FEED_CONFIG
  };`;

  let source = null, audio = null, observer = null;
  window.__slotLabAudio = () => {
    if (!audio){
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = AC ? new AC() : null;
    }
    return audio;
  };
  const unlockAudio = () => {
    const c = window.__slotLabAudio();
    if (c && c.state === 'suspended'){ try{ c.resume(); }catch(e){} }
  };
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('touchend', unlockAudio, true);
  const win = () => frame.contentWindow;
  const doc = () => { try{ return win().document; }catch(e){ return null; } };
  const bridge = () => { try{ return win().__slotLab || null; }catch(e){ return null; } };
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
      .replace(/<\/body>/i, '<link rel="stylesheet" href="css/slot-lab.css?v=2"><script>' + BRIDGE + '<\/script></body>');
  }

  /* B's readout says what the slot is doing, from the same state the
     lamps read. */
  const READOUT = { available:'INSERT TICKET', active:'ENTRY PAID', locked:'LOCKED', unaffordable:'FUNDS LOW', blocked:'TABLE IN PLAY' };
  function readoutText(hub){
    if (hub.classList.contains('tf-accepted')) return 'ACCEPTED';
    if (hub.classList.contains('tf-shredding')) return 'SHREDDING';
    if (hub.classList.contains('tf-feeding')) return 'READING';
    return READOUT[hub.dataset.entry] || 'READY';
  }

  function applySlot(){
    const d = doc();
    const hub = d && d.getElementById('career-hub');
    if (!hub) return;
    const intake = hub.querySelector('#ch2-intake');
    if (!intake) return;
    if (state.slot === 'live'){
      if (hub.dataset.slot){ delete hub.dataset.slot; delete intake.dataset.slotBuilt; if (intake.dataset.original) intake.innerHTML = intake.dataset.original; }
      placeMount(hub, intake);
      return;
    }
    if (!intake.dataset.original) intake.dataset.original = intake.innerHTML;
    if (hub.dataset.slot !== state.slot || intake.dataset.slotBuilt !== state.slot){
      hub.dataset.slot = state.slot;
      intake.dataset.slotBuilt = state.slot;
      intake.innerHTML = PARTS[state.slot];
    }
    const text = intake.querySelector('.sl-text');
    placeMount(hub, intake);
    const next = readoutText(hub);
    // Only write on a change: the observer watching the hub would
    // otherwise see this write and call back in forever.
    if (text && text.textContent !== next) text.textContent = next;
  }

  /* Mounts 2–4 move the slot into the console or the cradle; the others
     put it back between the reader and the console. Only moves when it is
     in the wrong place, so the observer that calls this settles. */
  function placeMount(hub, intake){
    const mount = state.slot === 'b' ? state.mount : 'now';
    if (hub.dataset.mount !== mount) hub.dataset.mount = mount;
    const consoleEl = hub.querySelector('.ch2-console');
    const cradle = hub.querySelector('.ch2-action-cradle');
    if (!consoleEl || !cradle) return;
    if (mount === 'cradle'){
      if (cradle.firstChild !== intake) cradle.insertBefore(intake, cradle.firstChild);
      return;
    }
    const inConsole = mount === 'stack' || mount === 'housing';
    const parent = inConsole ? consoleEl : hub;
    const before = inConsole ? cradle : consoleEl;
    if (intake.parentNode !== parent || intake.nextSibling !== before) parent.insertBefore(intake, before);
  }

  function watch(){
    if (observer) observer.disconnect();
    const d = doc();
    if (!d) return;
    // The hub re-mounts on every Career render; re-apply the option then,
    // and keep B's readout in step with the feed's classes.
    observer = new (win().MutationObserver)(() => applySlot());
    observer.observe(d.getElementById('career'), { subtree:true, childList:true, attributes:true, attributeFilter:['class','data-entry'] });
  }

  function applyConfig(){
    const b = bridge();
    if (!b) return;
    if (b.settings){
      b.settings.sound = state.sound === 'on';
      b.settings.theme = state.theme;
    }
    if (b.applyTheme) b.applyTheme();
    if (b.feedConfig) b.feedConfig.timeScale = Number(state.speed);
    applySlot();
  }

  function showHub(){
    const b = bridge();
    if (!b) return;
    if (b.boot) b.boot.finish();
    if (b.closeOverlays) b.closeOverlays();
    if (b.showCareerScreen) b.showCareerScreen();
    applySlot();
  }

  async function loadFrame(){
    setStatus('LOADING…');
    try{
      const html = await buildDoc();
      await new Promise(resolve => { frame.onload = () => resolve(); frame.srcdoc = html; });
      if (!win().__slotLabIsolated){
        frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>';
        throw new Error('storage isolation failed');
      }
      applyConfig();
      showHub();
      watch();
      setStatus('READY');
    } catch(err){ console.error(err); setStatus('ERROR — ' + err.message); }
  }

  function paint(){
    document.querySelectorAll('.il-seg').forEach(seg => {
      seg.querySelectorAll('button').forEach(btn => btn.classList.toggle('is-on', state[seg.dataset.key] === btn.dataset.v));
    });
    desc.textContent = OPTIONS[state.slot] + (state.slot === 'b' ? '  ' + MOUNTS[state.mount] : '');
    document.querySelector('.il-seg[data-key="mount"]').closest('.il-row').classList.toggle('is-off', state.slot !== 'b');
  }
  document.querySelectorAll('.il-seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state[seg.dataset.key] = btn.dataset.v;
      paint();
      applyConfig();
    });
  });

  const closeOnPhone = () => { if (matchMedia('(max-width:759px)').matches) toggle(false); };
  document.querySelector('[data-run="buy"]').addEventListener('click', () => {
    const d = doc();
    if (!d) return;
    showHub();
    const primary = d.getElementById('ch2-primary');
    if (primary && !primary.disabled) { closeOnPhone(); setTimeout(() => primary.click(), 250); }
    else setStatus('THIS TICKET CAN’T BE BOUGHT — SWIPE TO ONE THAT CAN, OR RESET');
  });
  document.querySelector('[data-run="hub"]').addEventListener('click', () => { showHub(); closeOnPhone(); });
  document.querySelector('[data-run="reset"]').addEventListener('click', () => { loadFrame(); });

  function toggle(open){
    panel.hidden = !open;
    tab.setAttribute('aria-expanded', String(open));
  }
  tab.addEventListener('click', () => toggle(panel.hidden));

  paint();
  loadFrame();
})();
