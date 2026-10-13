"use strict";

/* ============================================================
   NEW CAREER (preview) — the host page (career-preview-lab.html)

   Loads the real game into one full-screen frame with the preview's parts
   injected (listed in #lab-inject). The copy keeps its own save: its
   storage is written through to this page's localStorage under the
   inject's `persist` prefix, so a reload carries on where you were.

   LOCAL (a dev server): the game page is fetched and rebuilt as srcdoc
   with the injections, the in-memory storage shim and no service worker.
   LINK (published as an Artifact): validation/tools/lab-bundle.js has
   baked the same copy as game.html and set window.LAB_STATIC.
   ============================================================ */
(() => {
  const frame = document.getElementById('ncp-game');
  const inject = JSON.parse(document.getElementById('lab-inject').textContent);
  const lab = window.__lab = {
    state:{},
    set(patch){ Object.assign(lab.state, patch); }
  };
  const pre = JSON.stringify(inject.persist || 'ncp:');
  const SHIM = `(function(){
    var P = Storage.prototype, g = P.getItem, st = P.setItem, rm = P.removeItem, kf = P.key, pre = ${pre};
    var mem = Object.create(null);
    try{ var n = localStorage.length; for (var i = 0; i < n; i++){ var k = kf.call(localStorage, i); if (k && k.indexOf(pre) === 0) mem[k.slice(pre.length)] = g.call(localStorage, k); } }catch(e){}
    if (!('felt.settings' in mem)) mem['felt.settings'] = JSON.stringify({ sound:true, seenIntro:true, seenTour:true });
    var put = function(k, v){ try{ st.call(localStorage, pre + k, v); }catch(e){} };
    var del = function(k){ try{ rm.call(localStorage, pre + k); }catch(e){} };
    P.getItem = function(k){ k = String(k); return k in mem ? mem[k] : null; };
    P.setItem = function(k, v){ k = String(k); v = String(v); mem[k] = v; put(k, v); };
    P.removeItem = function(k){ k = String(k); delete mem[k]; del(k); };
    P.clear = function(){ Object.keys(mem).forEach(del); mem = Object.create(null); };
    P.key = function(i){ var k = Object.keys(mem)[i]; return k === undefined ? null : k; };
    try{ Object.defineProperty(P, 'length', { configurable:true, get:function(){ return Object.keys(mem).length; } }); }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('lab')); }; }catch(e){} }
  })();`;
  async function localDoc(){
    const source = await (await fetch('index.html', { cache:'no-store' })).text();
    const sw = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    const base = new URL('.', location.href).href;
    const tail = inject.css.map(f => '<link rel="stylesheet" href="' + f + '?v=' + inject.v + '">').join('') +
      inject.js.map(f => '<script src="' + f + '?v=' + inject.v + '"><\/script>').join('');
    const stripped=(inject.strip||[]).reduce((doc,f)=>doc.replace(new RegExp('<script src="'+f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^"]*"><\\/script>\\s*','g'),''),source);
    return stripped.replace(sw, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/<\/body>/i, tail + '</body>');
  }
  async function load(){
    if (window.LAB_STATIC){ frame.src = 'game.html?t=' + Date.now(); return; }
    frame.srcdoc = (await localDoc()) + '<!-- ' + Date.now() + ' -->';
  }
  load().catch(err => {
    document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;inset:auto 16px 16px;color:#F3E6C4;font:14px monospace">The game copy didn\'t load: ' + String(err.message || err) + '</p>');
  });
})();
