"use strict";

/* ============================================================
   SKIN LAB — the host page (the card pilot, phone-first)

   Loads the real game into one full-screen frame with the card skin and
   the lab's controls injected (listed in #lab-inject). The controls run
   inside the game (js/skin-lab.js) and reach this page as parent.__lab
   for what only this page can do:

   - keep the owner's drawings (data URLs) across visits, in this
     browser's storage (per viewer; never shared)
   - save a file to the phone: the Artifact `downloads` capability when
     this is a published link, a plain download link otherwise
   - hand drawings in to Claude: the `assets` capability stores each PNG
     with the artifact and a `db` row (handin/<slot>) says which slot it
     is, so a later session can fetch the exact pixels

   Two ways to build the copy, as in the Showdown Lab: LOCAL (a dev
   server) rebuilds index.html as srcdoc with the injections, the
   in-memory storage shim and no service worker; LINK (published)
   loads game.html, which validation/tools/lab-bundle.js baked the same way.
   ============================================================ */
(() => {
  const frame = document.getElementById('skl-game');
  const inject = JSON.parse(document.getElementById('lab-inject').textContent);
  const KEY = 'skin-lab.v1';
  const load0 = () => { try{ return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; }catch(e){ return {}; } };
  const saved = load0();
  const caps = { downloads:null, assets:null, db:null, ready:null };

  const lab = window.__lab = {
    state:Object.assign({ art:{}, show:'yours', opp:'3', tab:'templates' }, saved),
    set(patch){
      Object.assign(lab.state, patch);
      try{ localStorage.setItem(KEY, JSON.stringify(lab.state)); }catch(e){ /* storage full or blocked: this visit only */ }
    },
    // what this view can do (resolves once the viewer has answered, or in 10 s)
    caps(){ return caps.ready.then(() => ({ downloads:!!caps.downloads, handin:!!(caps.assets && caps.db) })); },
    async save(filename, blob){
      await caps.ready;
      if (caps.downloads){
        try{ await caps.downloads.save({ filename, data:blob }); return 'saved'; }
        catch(err){ return err && err.code === 'declined' ? 'declined' : 'failed:' + ((err && (err.code || err.message)) || err); }
      }
      // a plain page (local preview): an ordinary download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return 'saved';
    },
    // items: [{ key:'L-back', blob, w, h, note }]
    async handIn(items){
      await caps.ready;
      if (!caps.assets || !caps.db) return { ok:false, why:'unavailable' };
      const done = [];
      for (const it of items){
        try{
          const up = await caps.assets.upload(it.blob, { type:'image/png' });
          await caps.db.doc('handin/' + it.key).set({ slot:it.key, asset:up.id, w:it.w, h:it.h, note:it.note || '', at:new Date().toISOString() });
          done.push(it.key);
        }catch(err){
          return { ok:false, why:(err && (err.code || err.message)) || String(err), done };
        }
      }
      return { ok:true, done };
    }
  };

  // capabilities: light up when (and if) the viewer grants them
  const use = name => (window.claude && typeof window.claude.use === 'function') ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
  caps.ready = Promise.all([use('downloads'), use('assets'), use('db')]).then(([d, a, b]) => { caps.downloads = d; caps.assets = a; caps.db = b; });

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
  async function localDoc(){
    const source = await (await fetch('index.html', { cache:'no-store' })).text();
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
