"use strict";

/* ============================================================
   MACHINE WHEEL V2 LAB

   Runs the REAL game (index.html, every production script and stylesheet)
   inside a same-origin iframe, with js/machine-wheel.js injected, so V1 and
   V2 can be auditioned on the actual screens at actual cost on a phone.

   ISOLATION. The copy is built as srcdoc with a shim that runs before any
   game script: Storage.prototype is replaced with an in-memory map in the
   frame's own realm, so every Store read/write stays inside the frame and
   disappears on reset. The service-worker block is stripped. If either
   step cannot be applied, the frame is never loaded. This page itself
   never touches localStorage.
   ============================================================ */
(() => {
  const frame = document.getElementById('wl-frame');
  const panel = document.getElementById('wl-panel');
  const tab = document.getElementById('wl-tab');
  const status = document.getElementById('wl-status');
  const V = '1';

  const state = {
    engine: 'v2', machinery: 'full', bolts: 'off', grain: '3',
    weight: '1', overshoot: '1.6', hum: 'on', sound: 'on', speed: '1'
  };

  // Seeded in-memory settings: sound on (the game defaults it off) and the
  // first-run intro already seen, so every reset lands on the Home screen.
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
    // Audio comes from the lab page's one context, unlocked by the lab's
    // own taps, so a freshly reset copy is never silent on iOS.
    try{ if (parent && parent.__wheelLabAudio){
      var Shared = function(){ return parent.__wheelLabAudio(); };
      window.AudioContext = Shared; window.webkitAudioContext = Shared;
    } }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('wheel lab')); }; }catch(e){} }
    window.__wheelLabIsolated = (function(){ try{ localStorage.setItem('__wl','1'); return mem.__wl === '1'; }catch(e){ return false; } })();
  })();`;

  let source = null, loading = null, busy = false, audio = null;
  window.__wheelLabAudio = () => {
    if (!audio){
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = AC ? new AC() : null;
    }
    return audio;
  };
  const unlockAudio = () => {
    const c = window.__wheelLabAudio();
    if (c && c.state === 'suspended'){ try{ c.resume(); }catch(e){} }
  };
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('touchend', unlockAudio, true);
  const win = () => frame.contentWindow;
  // The game's top-level const/let bindings (game, settings, MachineWheel…)
  // are not window properties; BRIDGE (injected after the game's scripts)
  // exposes the few the lab needs, without eval.
  const BRIDGE = `window.__wheelLab = {
    wheel: typeof MachineWheel === 'undefined' ? null : MachineWheel,
    get game(){ return typeof game === 'undefined' ? null : game; },
    get settings(){ return typeof settings === 'undefined' ? null : settings; },
    tableCleared(){ DEV_MODE = true; devTestResultStage('table-cleared'); }
  };`;
  const bridge = () => { try{ return win().__wheelLab || null; }catch(e){ return null; } };
  const g = name => { const b = bridge(); return b ? (name === 'MachineWheel' ? b.wheel : b[name]) : undefined; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function setStatus(text){ status.textContent = text; }

  async function buildDoc(){
    if (!source){
      const res = await fetch('index.html', { cache: 'no-store' });
      source = await res.text();
    }
    const swBlock = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    if (!swBlock.test(source) || !/<head>/i.test(source) || !/<\/body>/i.test(source)){
      throw new Error('index.html shape changed; refusing to build an unisolated copy');
    }
    const base = new URL('.', location.href).href;
    return source
      .replace(swBlock, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      // The game loads the wheel itself now; inject it only into an older
      // copy that doesn't (a second load would redeclare its consts).
      .replace(/<\/body>/i,
        (/js\/machine-wheel\.js/.test(source) ? '' :
          '<link rel="stylesheet" href="css/machine-wheel.css?v=' + V + '">' +
          '<script src="js/machine-wheel.js?v=' + V + '"><\/script>') +
        '<script>' + BRIDGE + '<\/script></body>');
  }

  function loadFrame(){
    loading = (async () => {
      setStatus('LOADING…');
      const doc = await buildDoc();
      await new Promise(resolve => {
        frame.onload = () => resolve();
        frame.srcdoc = doc;
      });
      const w = win();
      if (!w.__wheelLabIsolated){
        frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>';
        throw new Error('storage isolation failed');
      }
      applyConfig();
      await sleep(250);
      setStatus('READY');
    })().catch(err => { console.error(err); setStatus('ERROR — SEE CONSOLE'); throw err; });
    return loading;
  }

  function applyConfig(){
    const w = win();
    const wheel = w && g('MachineWheel');
    if (!wheel) return;
    const c = wheel.config;
    c.machinery = state.machinery;
    c.bolts = state.bolts === 'on';
    c.grain = +state.grain;
    c.durationScale = +state.weight;
    c.overshootScale = +state.overshoot;
    c.hum = state.hum === 'on';
    c.timeScale = +state.speed;
    if (state.engine === 'v2') wheel.install(); else wheel.uninstall();
    const settings = g('settings');
    if (settings) settings.sound = state.sound === 'on';
  }

  function renderControls(){
    document.querySelectorAll('.wl-seg').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', state[seg.dataset.key] === b.dataset.v));
    });
    document.querySelectorAll('[data-v2]').forEach(row => row.classList.toggle('is-off', state.engine !== 'v2'));
  }

  document.querySelectorAll('.wl-seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      state[seg.dataset.key] = b.dataset.v;
      renderControls();
      applyConfig();
    });
  });

  function isPhone(){ return !matchMedia('(min-width:760px)').matches; }
  function setPanel(open){
    panel.hidden = !open;
    tab.setAttribute('aria-expanded', String(open));
  }
  tab.addEventListener('click', () => setPanel(panel.hidden));

  async function waitFor(test, timeoutMs){
    const end = performance.now() + timeoutMs;
    while (performance.now() < end){
      try{ if (test()) return true; }catch(e){}
      await sleep(60);
    }
    return false;
  }
  const hidden = id => { const el = win().document.getElementById(id); return !el || el.classList.contains('hidden'); };
  const settled = () => {
    const d = win().document;
    const game = g('game');
    return !d.querySelector('.mw-front,.stage-machinery') && !(game && game._transitioning);
  };

  const RUNS = {
    async career(){
      await loadFrame();
      win().document.getElementById('open-career').click();
    },
    async table(){
      await loadFrame();
      const w = win();
      w.showCareerScreen();
      await sleep(450);
      const key = w.document.getElementById('ch2-primary');
      if (!key) throw new Error('Career buy-in key not found');
      key.click();
    },
    async results(){
      await loadFrame();
      const w = win();
      bridge().tableCleared();
    },
    async next(){
      const w = win();
      const atResults = () => { const game = g('game'); return game && game.over && game.run && w.document.querySelector('#felt.results-mode') && settled(); };
      if (!atResults()){
        await RUNS.results();
        setStatus('ROLLING TO RESULTS…');
        const ok = await waitFor(() => atResults(), 15000);
        if (!ok) throw new Error('results stage never settled');
        await sleep(900);
      }
      setStatus('RUNNING RESULTS → NEXT');
      win().beginNextRunTable();
    }
  };

  document.querySelectorAll('[data-run]').forEach(b => {
    b.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      document.querySelectorAll('[data-run]').forEach(x => x.disabled = true);
      unlockAudio();
      if (isPhone()) setPanel(false);
      try{
        setStatus('RUNNING ' + b.textContent);
        await RUNS[b.dataset.run]();
        setStatus(state.engine.toUpperCase() + ' · ' + b.textContent);
      } catch(err){
        console.error(err);
        setStatus('ERROR — ' + err.message);
      } finally{
        busy = false;
        document.querySelectorAll('[data-run]').forEach(x => x.disabled = false);
      }
    });
  });
  document.getElementById('wl-reset').addEventListener('click', () => { loadFrame(); });

  renderControls();
  setPanel(!isPhone());
  loadFrame();
})();
