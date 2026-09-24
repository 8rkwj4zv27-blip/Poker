"use strict";

/* ============================================================
   TABLE INTRO LAB

   Runs the REAL game (index.html, every production script and stylesheet)
   inside a same-origin iframe with js/table-intro.js + css/table-intro.css
   injected, so the new table arrival can be judged on the real table, at
   real cost, on a phone — and switched back to the current one-second
   title flash (OLD) to compare.

   ISOLATION. Same scheme as the Machine Wheel lab: the copy is built as
   srcdoc with a shim that runs before any game script and replaces
   Storage.prototype with an in-memory map in the frame's own realm, and
   the service-worker block is stripped. If either step can't be applied
   the frame is never loaded. This page itself never touches localStorage.
   Career money in here (buy-ins, unlocks) is the sandbox's own copy.
   ============================================================ */
(() => {
  const frame = document.getElementById('il-frame');
  const panel = document.getElementById('il-panel');
  const tab = document.getElementById('il-tab');
  const status = document.getElementById('il-status');
  const V = '3';
  // Where the game's page lives. A hosted copy of this lab can point this
  // at a renamed file with a data-game="..." attribute on any element.
  const gameHost = document.querySelector('[data-game]');
  const GAME = (gameHost && gameHost.dataset.game) || 'index.html';

  const state = { event:'back-room-freezeout', opponents:'4', intro:'on', feed:'on', speed:'1', sound:'on' };

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
    try{ if (parent && parent.__introLabAudio){
      var Shared = function(){ return parent.__introLabAudio(); };
      window.AudioContext = Shared; window.webkitAudioContext = Shared;
    } }catch(e){}
    if (navigator.serviceWorker){ try{ navigator.serviceWorker.register = function(){ return Promise.reject(new Error('intro lab')); }; }catch(e){} }
    window.__introLabIsolated = (function(){ try{ localStorage.setItem('__il','1'); return mem.__il === '1'; }catch(e){ return false; } })();
  })();`;

  // Top-level const/let bindings (game, career, settings, TableIntro…)
  // aren't window properties; this exposes the few the lab reads.
  const BRIDGE = `window.__introLab = {
    intro: typeof TableIntro === 'undefined' ? null : TableIntro,
    wheel: typeof MachineWheel === 'undefined' ? null : MachineWheel,
    get game(){ return typeof game === 'undefined' ? null : game; },
    get settings(){ return typeof settings === 'undefined' ? null : settings; },
    get career(){ return typeof career === 'undefined' ? null : career; },
    cashId: typeof CAREER_CASH_CONFIG === 'undefined' ? null : CAREER_CASH_CONFIG.id,
    feed: typeof careerTicketFeed === 'function' ? careerTicketFeed : null,
    feedConfig: typeof TICKET_FEED_CONFIG === 'undefined' ? null : TICKET_FEED_CONFIG
  };`;

  let source = null, busy = false, audio = null;
  window.__introLabAudio = () => {
    if (!audio){
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = AC ? new AC() : null;
    }
    return audio;
  };
  const unlockAudio = () => {
    const c = window.__introLabAudio();
    if (c && c.state === 'suspended'){ try{ c.resume(); }catch(e){} }
  };
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('touchend', unlockAudio, true);
  const win = () => frame.contentWindow;
  const bridge = () => { try{ return win().__introLab || null; }catch(e){ return null; } };
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
    // Inject the intro only into a copy that doesn't already ship it.
    const ships = /js\/table-intro\.js/.test(source);
    const shipsFeed = /js\/ticket-feed\.js/.test(source);
    return source
      .replace(swBlock, '')
      .replace(/<head>/i, '<head><base href="' + base + '"><script>' + SHIM + '<\/script>')
      .replace(/<\/body>/i,
        (ships ? '' :
          '<link rel="stylesheet" href="css/table-intro.css?v=' + V + '">' +
          '<script src="js/table-intro.js?v=' + V + '"><\/script>') +
        (shipsFeed ? '' :
          '<link rel="stylesheet" href="css/ticket-feed.css?v=' + V + '">' +
          '<script src="js/ticket-feed.js?v=' + V + '"><\/script>') +
        '<script>' + BRIDGE + '<\/script></body>');
  }

  async function loadFrame(){
    setStatus('LOADING…');
    try{
      const doc = await buildDoc();
      await new Promise(resolve => { frame.onload = () => resolve(); frame.srcdoc = doc; });
      if (!win().__introLabIsolated){
        frame.srcdoc = '<p style="font:14px monospace;color:#f3e6c4;padding:20px">Storage isolation failed; the game was not started.</p>';
        throw new Error('storage isolation failed');
      }
      applyConfig();
      await sleep(250);
      setStatus('READY');
    } catch(err){ console.error(err); setStatus('ERROR — ' + err.message); throw err; }
  }

  function applyConfig(){
    const b = bridge();
    if (!b) return;
    const speed = +state.speed;
    if (b.intro){
      b.intro.config.timeScale = speed;
      if (state.intro === 'on') b.intro.install(); else b.intro.uninstall();
    }
    if (b.wheel) b.wheel.config.timeScale = speed;
    if (b.feedConfig) b.feedConfig.timeScale = speed;
    // OLD feed: hide the hook, so career-hub-live.js runs its own feed.
    try{ win().careerTicketFeed = state.feed === 'on' ? b.feed : undefined; }catch(e){}
    if (b.settings) b.settings.sound = state.sound === 'on';
  }

  function renderControls(){
    document.querySelectorAll('.il-seg').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', state[seg.dataset.key] === b.dataset.v));
    });
    const ev = document.querySelector('[data-run="event"]');
    const pick = document.querySelector('.il-seg[data-key="event"] .is-on');
    if (ev && pick) ev.textContent = 'CAREER EVENT · ' + pick.textContent;
  }
  document.querySelectorAll('.il-seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      state[seg.dataset.key] = b.dataset.v;
      renderControls();
      applyConfig();
    });
  });

  const isPhone = () => !matchMedia('(min-width:760px)').matches;
  function setPanel(open){ panel.hidden = !open; tab.setAttribute('aria-expanded', String(open)); }
  tab.addEventListener('click', () => setPanel(panel.hidden));

  async function waitFor(test, timeoutMs){
    const end = performance.now() + timeoutMs;
    while (performance.now() < end){
      try{ if (test()) return true; }catch(e){}
      await sleep(80);
    }
    return false;
  }

  /* Sandbox-only Career setup: make the chosen event affordable and
     unlocked in the frame's in-memory Career, so the real Hub can sell it. */
  function openEvent(id){
    const w = win(), c = bridge().career;
    const ev = w.careerEventById(id);
    if (!ev) throw new Error('unknown event ' + id);
    c.unlocks = c.unlocks || {};
    c.unlocks[id] = true;
    c.bankroll = Math.max(c.bankroll, (ev.buyIn || 0) * 20 + 1000);
    return ev;
  }
  async function toCareer(){
    win().showCareerScreen();
    await sleep(500);
  }
  /* Walks the real rack to a ticket with the arrow keys, then presses the
     real BUY IN key: the whole Hub path runs, feed and all. */
  async function buyThroughHub(id){
    const d = win().document;
    const track = d.getElementById('ch2-track');
    if (!track) throw new Error('Career rack not found');
    const index = () => [...d.querySelectorAll('#career-hub .ch2-track .ch2-card')].findIndex(c => c.dataset.eventId === id);
    const selected = () => [...d.querySelectorAll('#career-hub .ch2-track .ch2-card')].findIndex(c => c.classList.contains('is-selected'));
    if (index() < 0) throw new Error(id + ' is not on the rack');
    for (let guard = 0; selected() !== index() && guard < 30; guard++){
      track.dispatchEvent(new (win().KeyboardEvent)('keydown', { key: selected() < index() ? 'ArrowRight' : 'ArrowLeft', bubbles:true }));
      await sleep(300);
    }
    await sleep(450);
    d.getElementById('ch2-primary').click();
  }

  const RUNS = {
    async event(){
      await loadFrame();
      openEvent(state.event);
      await toCareer();
      await buyThroughHub(state.event);
    },
    async cash(){
      await loadFrame();
      const c = bridge().career;
      c.bankroll = Math.max(c.bankroll, 5000);
      await toCareer();
      await buyThroughHub(bridge().cashId);
    },
    async resume(){
      await RUNS.event();
      const w = win();
      setStatus('PLAYING A MOMENT…');
      const b = bridge();
      // Leave only once the first deal has fully landed: leaving mid-deal
      // and resuming at once trips an existing, unrelated race in the
      // abandoned hand's deal (not part of this intro).
      await waitFor(() => b.game && b.game.phase !== 'setup' && b.game._humanCardsVisible, 30000);
      await sleep(1500);
      w.leaveTable();
      await sleep(300);
      await toCareer();
      setStatus('RESUMING');
      await buyThroughHub(state.event);
    },
    async single(){
      await loadFrame();
      win().startSinglePlayerRun({ opponentCount:+state.opponents });
    }
  };

  document.querySelectorAll('[data-run]').forEach(b => {
    b.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      document.querySelectorAll('[data-run]').forEach(x => x.disabled = true);
      unlockAudio();
      if (isPhone()) setPanel(false);
      const label = b.textContent;
      try{
        setStatus('RUNNING ' + label);
        await RUNS[b.dataset.run]();
        setStatus((state.intro === 'on' ? 'NEW' : 'OLD') + ' · ' + label);
      } catch(err){
        console.error(err);
        setStatus('ERROR — ' + err.message);
      } finally{
        busy = false;
        document.querySelectorAll('[data-run]').forEach(x => x.disabled = false);
      }
    });
  });
  document.getElementById('il-reset').addEventListener('click', () => { loadFrame(); });

  renderControls();
  setPanel(!isPhone());
  loadFrame();
})();
