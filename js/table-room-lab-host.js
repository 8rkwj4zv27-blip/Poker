"use strict";

/* ============================================================
   TABLE ROOM LAB — the host page (phone-first)

   Loads the real game into one frame the size of the owner's iPhone 15
   Pro Max screen (430 x 932 CSS px) and scales it to fit the window, so
   the table is laid out exactly as on the phone whatever shows the link.
   Keeps the owner's picks across a re-deal: each moment reloads the
   copy. The controls run inside the game (js/table-room-lab.js), which
   reaches this page as parent.__lab.

   Two ways to build the copy (as js/showdown-lab-host.js):
   - LOCAL (a dev server): index.html fetched and rebuilt as srcdoc with
     the injections, the in-memory storage shim and no service worker.
   - LINK (published as an Artifact): validation/tools/lab-bundle.js has
     baked that copy as game.html and set window.LAB_STATIC.
   ============================================================ */
(() => {
  const frame = document.getElementById('trl-game');
  const inject = JSON.parse(document.getElementById('lab-inject').textContent);
  const lab = window.__lab = {
    state:{ picks:null, opp:'3', sound:'on', moment:null, sheet:false },
    set(patch){ Object.assign(lab.state, patch); },
    play(moment){ lab.state.moment = moment || null; load(); }
  };

  // a phone lays the page out at its own width (the Artifact wrapper
  // brings its own head; make sure the viewport tag is there)
  if (!document.querySelector('meta[name="viewport"]')){
    const m = document.createElement('meta');
    m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1,viewport-fit=cover';
    document.head.appendChild(m);
  }
  // the whole phone screen in view: never bigger than life
  function fit(){
    const k = Math.min(1, window.innerWidth / 430, window.innerHeight / 932);
    document.documentElement.style.setProperty('--trl-fit', String(k));
  }
  fit();
  window.addEventListener('resize', fit);

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
