"use strict";

/* ============================================================
   NEW CAREER LAB — the host page (new-career-lab.html, phone-first)

   Loads the real game into one full-screen frame with the lab's controls
   injected (listed in #lab-inject). NEW_CAREER_LAB on this page lets the
   copy run the new Career in its frame (js/career-link.js). The controls
   run inside the game (js/new-career-lab.js) and reach this page as
   parent.__newCareerLab.

   Two ways to build the copy, as the Showdown Lab:
   - LOCAL (a dev server): the game page fetched and rebuilt as srcdoc with
     the injections, the in-memory storage shim, and no service worker.
   - LINK (published as an Artifact): validation/tools/lab-bundle.js has
     baked that same copy as game.html and set window.LAB_STATIC.
   ============================================================ */
(() => {
  window.NEW_CAREER_LAB = true;
  const frame = document.getElementById('ncl-game');
  const inject = JSON.parse(document.getElementById('lab-inject').textContent);
  // (not __lab: the hub, shop and album read that as their own labs' host)
  window.__newCareerLab = { reload:() => load() };

  // the storage shim: the copy never reads or writes a real save
  const SHIM = `(function(){
    var mem = Object.create(null);
    mem['felt.settings'] = JSON.stringify({ sound:true, seenIntro:true, seenTour:true });
    var P = Storage.prototype;
    P.getItem = function(k){ k = String(k); return k in mem ? mem[k] : null; };
    P.setItem = function(k, v){ mem[String(k)] = String(v); };
    P.removeItem = function(k){ delete mem[String(k)]; };
    P.clear = function(){ mem = Object.create(null); };
    P.key = function(i){ var k = Object.keys(mem)[i]; return k === undefined ? null : k; };
    try{ Object.defineProperty(P, 'length', { configurable:true, get:function(){ return Object.keys(mem).length; } }); }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('lab')); }; }catch(e){} }
  })();`;
  let source = null;
  async function localDoc(){
    if (!source) source = await (await fetch('index.html', { cache:'no-store' })).text();
    const sw = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    const base = new URL('.', location.href).href;
    const tail = inject.css.map(f => '<link rel="stylesheet" href="' + f + '?v=' + inject.v + '">').join('') +
      inject.js.map(f => '<script src="' + f + '?v=' + inject.v + '"><\/script>').join('');
    return source.replace(sw, '')
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
