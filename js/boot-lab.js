"use strict";

/* ============================================================
   HOME BOOT LAB

   Runs the REAL game (index.html, every production script and stylesheet,
   including js/home-boot.js) inside a same-origin iframe so the cold-launch
   boot can be replayed, slowed down and heard on a phone. The live boot
   only plays on a real page load, and on iOS that load has no user
   gesture, so it is silent; REPLAY here is started by a tap, so it is not.

   ISOLATION. Same scheme as the Table Intro lab: the copy is built as
   srcdoc with a shim that runs before any game script and replaces
   Storage.prototype with an in-memory map in the frame's own realm, and
   the service-worker block is stripped. If either step can't be applied
   the frame is never loaded. This page itself never touches localStorage.
   ============================================================ */
(() => {
  const frame = document.getElementById('il-frame');
  const panel = document.getElementById('il-panel');
  const tab = document.getElementById('il-tab');
  const status = document.getElementById('il-status');
  const GAME = 'index.html';
  const state = { speed:'1', sound:'on' };

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
    try{ if (parent && parent.__bootLabAudio){
      var Shared = function(){ return parent.__bootLabAudio(); };
      window.AudioContext = Shared; window.webkitAudioContext = Shared;
    } }catch(e){}
    try{ if (parent && parent.__bootLabSpeed) window.__bootLabSpeed = parent.__bootLabSpeed; }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('boot lab')); }; }catch(e){} }
    window.__bootLabIsolated = (function(){ try{ localStorage.setItem('__bl','1'); return mem.__bl === '1'; }catch(e){ return false; } })();
  })();`;

  // Applies the speed before the boot's DOMContentLoaded start on a cold
  // load, and exposes the few globals the lab drives.
  const BRIDGE = `(function(){
    if (typeof HOME_BOOT_CONFIG !== 'undefined' && window.__bootLabSpeed) HOME_BOOT_CONFIG.timeScale = window.__bootLabSpeed;
    window.__bootLab = {
      boot: typeof HomeBoot === 'undefined' ? null : HomeBoot,
      closeOverlays: typeof closeOverlays === 'function' ? closeOverlays : null,
      reconstructMainMenu: typeof reconstructMainMenu === 'function' ? reconstructMainMenu : null,
      get settings(){ return typeof settings === 'undefined' ? null : settings; }
    };
  })();`;

  let source = null, audio = null;
  window.__bootLabAudio = () => {
    if (!audio){
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = AC ? new AC() : null;
    }
    return audio;
  };
  const unlockAudio = () => {
    if (state.sound !== 'on') return;
    const c = window.__bootLabAudio();
    if (c && c.state === 'suspended'){ try{ c.resume(); }catch(e){} }
  };
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('touchend', unlockAudio, true);
  const bridge = () => { try{ return frame.contentWindow.__bootLab || null; }catch(e){ return null; } };
  const setStatus = text => { status.textContent = text; };

  async function buildDoc(){
    if (!source){
      const res = await fetch(GAME, { cache:'no-store' });
      source = await res.text();
    }
    const swBlock = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    if (!swBlock.test(source) || !/<head>/i.test(source) || !/<\/body>/i.test(source) || !/js\/home-boot\.js/.test(source)){
      throw new Error('game page shape changed; refusing to build an unisolated copy');
    }
    const base = new URL('.', location.href).href;
    return source
      .replace(swBlock, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/(<script src="js\/home-boot\.js[^"]*"><\/script>)/, '$1<script>' + BRIDGE + '<\/script>');
  }

  async function loadFrame(){
    setStatus('LOADING…');
    try{
      window.__bootLabSpeed = Number(state.speed);
      const doc = await buildDoc();
      await new Promise(resolve => { frame.onload = () => resolve(); frame.srcdoc = doc; });
      if (!frame.contentWindow.__bootLabIsolated){
        frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>';
        throw new Error('storage isolation failed');
      }
      applyConfig();
      setStatus('READY');
    } catch(err){ console.error(err); setStatus('ERROR — ' + err.message); }
  }

  function applyConfig(){
    const b = bridge();
    if (b && b.boot) b.boot.config.timeScale = Number(state.speed);
    if (b && b.settings) b.settings.sound = state.sound === 'on';
  }
  function paintSegs(){
    document.querySelectorAll('.il-seg').forEach(seg => {
      seg.querySelectorAll('button').forEach(btn => btn.classList.toggle('is-on', state[seg.dataset.key] === btn.dataset.v));
    });
  }
  document.querySelectorAll('.il-seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state[seg.dataset.key] = btn.dataset.v;
      paintSegs();
      applyConfig();
    });
  });

  function showHome(){
    const w = frame.contentWindow, d = w && w.document;
    if (!d) return;
    // Back to the menu from wherever the sandbox was left.
    const b = bridge();
    if (b && b.closeOverlays) b.closeOverlays();
    d.querySelectorAll('#app > .screen').forEach(s => s.classList.toggle('hidden', s.id !== 'home'));
    if (b && b.reconstructMainMenu) b.reconstructMainMenu();
  }

  document.querySelector('[data-run="replay"]').addEventListener('click', () => {
    const b = bridge();
    if (!b || !b.boot) return;
    applyConfig();
    showHome();
    b.boot.replay();
    if (matchMedia('(max-width:759px)').matches) toggle(false);
  });
  document.querySelector('[data-run="cold"]').addEventListener('click', () => {
    loadFrame();
    if (matchMedia('(max-width:759px)').matches) toggle(false);
  });

  function toggle(open){
    panel.hidden = !open;
    tab.setAttribute('aria-expanded', String(open));
  }
  tab.addEventListener('click', () => toggle(panel.hidden));

  paintSegs();
  loadFrame();
})();
