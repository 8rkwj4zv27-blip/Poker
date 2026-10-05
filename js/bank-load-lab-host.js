"use strict";

/* ============================================================
   BANK LOAD LAB — the host page (round 1, phone-first)

   Loads the real game into one full-screen frame with the Lab's parts
   injected (listed in #lab-inject), and keeps the owner's picks across a
   re-deal: each moment reloads the copy, so the table is always fresh.
   The controls themselves run inside the game (js/bank-load-lab.js), which
   reaches this page as parent.__lab.

   Two ways to build the copy:
   - LOCAL (a dev server): the game page is fetched and rebuilt as srcdoc
     with the injections, the in-memory storage shim, and no service worker.
   - LINK (published as an Artifact): validation/tools/lab-bundle.js has
     already baked that same copy as game.html and set window.LAB_STATIC,
     so the frame just loads game.html.
   ============================================================ */
(() => {
  const frame = document.getElementById('bll-game');
  const inject = JSON.parse(document.getElementById('lab-inject').textContent);
  const lab = window.__lab = {
    state:{ order:null, stack:'1000', sound:'on', moment:null },
    set(patch){ Object.assign(lab.state, patch); },
    play(moment){ lab.state.moment = moment || null; load(); }
  };

  // the storage shim: the copy never reads or writes a real save
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
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('lab')); }; }catch(e){} }
  })();`;
  // the shipped parts the candidate stands in for come out of the copy
  const stripTags = (html, list) => (list || []).reduce((h, f) => {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return h.replace(new RegExp('<link rel="stylesheet" href="' + esc + '[^"]*">\\s*', 'g'), '')
            .replace(new RegExp('<script src="' + esc + '[^"]*"><\\/script>\\s*', 'g'), '');
  }, html);
  let source = null;
  async function localDoc(){
    if (!source) source = await (await fetch('index.html', { cache:'no-store' })).text();
    const sw = /<script id="pwa-service-worker">[\s\S]*?<\/script>/;
    const base = new URL('.', location.href).href;
    const tail = inject.css.map(f => '<link rel="stylesheet" href="' + f + '?v=' + inject.v + '">').join('') +
      inject.js.map(f => '<script src="' + f + '?v=' + inject.v + '"><\/script>').join('');
    return stripTags(source, inject.strip).replace(sw, '')
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
