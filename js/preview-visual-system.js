/* ============================================================
   VISUAL-SYSTEM PREVIEW HARNESS  —  NOT PRODUCTION
   Loaded only by preview.html. It adds a control bar for jumping
   between screens and switching the visual treatment on and off so
   the new work can be compared against the shipped game.

   It never modifies production JavaScript and never reads or writes
   game state. Storage is already sandboxed by preview.html, so
   nothing here can reach real saves, statistics or Career data.
   ============================================================ */
(() => {
  if (!document.body || document.body.dataset.visualPreview !== 'on') return;

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const $id = (id) => document.getElementById(id);

  /* ---------- harness state ---------- */
  const STATE_KEY = 'pv.harness.v5';
  /* The owner's current set: P0 production ink, C0 glass, F0 baseline chassis,
     plus the machine treatment for the four screens that never received it. */
  const APPROVED = { print: 'p0', glass: 'c0', chassis: 'off', screens: 'machine', results: 'machine', felt: 'even-board', crt: true, motion: true };
  const ORIGINAL = { print: 'off', glass: 'off', chassis: 'off', screens: 'off', results: 'off', felt: 'off', crt: false, motion: false };
  const DEFAULTS = { screen: 'home', ...APPROVED, dev: false, open: true };

  const readState = () => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(STATE_KEY) || 'null');
      return stored && typeof stored === 'object' ? { ...DEFAULTS, ...stored } : { ...DEFAULTS };
    } catch (error) { return { ...DEFAULTS }; }
  };

  const writeState = () => {
    try { window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); }
    catch (error) { /* the harness still works for this page view */ }
  };

  const params = new URLSearchParams(location.search);
  const state = readState();
  if (params.has('screen')) state.screen = params.get('screen');

  /* ---------- applying the treatment ---------- */
  const applyTreatment = () => {
    const root = document.documentElement;
    const set = (attr, value) => {
      if (!value || value === 'off') root.removeAttribute(attr);
      else root.setAttribute(attr, value);
    };
    set('data-pv-print', state.print);
    set('data-pv-glass', state.glass);
    set('data-pv-chassis', state.chassis);
    set('data-pv-screens', state.screens);
    set('data-pv-results', state.results);
    set('data-pv-felt', state.felt);
    root.setAttribute('data-pv-crt', state.crt ? 'on' : 'off');
    root.setAttribute('data-pv-motion', state.motion ? 'on' : 'off');
  };

  const isOriginal = () => Object.keys(ORIGINAL).every((k) => state[k] === ORIGINAL[k]);

  /* ---------- C0-G resynchronisation on real content changes ---------- */
  const RESYNC_MS = 580;
  let runId = 0;

  const flash = (el, className, duration) => {
    const token = String(++runId);
    el.dataset.pvRun = token;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(() => {
      if (el.dataset.pvRun === token) el.classList.remove(className);
    }, duration);
  };

  /* A mechanical reel is not a channel change: readouts built from reel drums
     are counted, not broadcast. These two are reel readouts that merely start
     life as plain text, so they are excluded by identity, not by sniffing. */
  const REEL_READOUTS = ['hud-invested', 'raise-amt'];
  const isTextCrt = (el) => !REEL_READOUTS.includes(el.id)
    && !el.querySelector('.jp-cell, .mini-jackpot, .reel-strip');

  const watchCrt = (el) => {
    if (el.dataset.pvWatched === 'on') return;
    el.dataset.pvWatched = 'on';
    let last = el.textContent.trim();
    const observer = new MutationObserver(() => {
      if (!state.crt || !isTextCrt(el)) return;
      const next = el.textContent.trim();
      if (next === last) return;
      last = next;
      if (!next) return;
      /* One resynchronisation at a time. The live banner can change several
         times a second during an AI turn, and restarting the burst on every
         change turns a finite channel change into a strobe. */
      if (el.classList.contains('pv-resync')) return;
      flash(el, 'pv-resync', RESYNC_MS);
    });
    observer.observe(el, { childList: true, characterData: true, subtree: true });
  };

  const scanCrts = () => {
    document.querySelectorAll('.crt-screen').forEach((el) => {
      if (isTextCrt(el)) watchCrt(el);
    });
  };

  document.addEventListener('pointerdown', (event) => {
    if (!state.motion) return;
    const control = event.target.closest('#home .pc-button, #home .home-row .btn-secondary');
    if (control) flash(control, 'pv-press', 700);
  }, { passive: true });

  /* ---------- screen routing ----------
     Each jump reloads first, so every screen is reached from a clean start
     and comparisons are never affected by leftover state. */
  const SCREENS = [
    ['home', 'Main menu'],
    ['setup', 'Classic table setup'],
    ['rankings', 'Hand rankings'],
    ['awards', 'Score / awards'],
    ['settings', 'Settings'],
    ['table', 'Table — live hand'],
    ['career', 'Career — event list'],
    ['cleared', 'TABLE CLEARED'],
    ['runover', 'RUN OVER']
  ];

  const click = (id) => { const el = $id(id); if (el) el.click(); };

  const ROUTES = {
    home: async () => {},
    setup: async () => click('go-to-setup'),
    rankings: async () => click('open-rankings'),
    awards: async () => click('open-awards'),
    settings: async () => click('home-settings'),
    career: async () => click('open-career'),
    table: async () => {
      if (typeof devNewEliminationTable !== 'function') return;
      devNewEliminationTable(4);
      await wait(500);
    },
    cleared: async () => {
      if (typeof devNewEliminationTable !== 'function') return;
      devNewEliminationTable(4);
      await wait(500);
      if (typeof devEndTable === 'function') devEndTable();
      await wait(2600);
    },
    runover: async () => {
      if (typeof devNewEliminationTable !== 'function') return;
      devNewEliminationTable(4);
      await wait(600);
      if (typeof FAST_DEV !== 'undefined') FAST_DEV = true;

      const runIsOver = () => typeof game !== 'undefined' && game && game.over;
      const handLive = () => typeof handInProgress === 'function' && handInProgress();

      /* devBustMe arms a rigged all-in and the engine resolves it on its own —
         clicking anything afterwards only interferes. One attempt rarely busts
         outright because the shove is capped by the winner's stack, so keep
         arming it hand after hand until the run genuinely ends. */
      for (let attempt = 0; attempt < 15 && !runIsOver(); attempt += 1) {
        for (let i = 0; i < 25 && !handLive() && !runIsOver(); i += 1) await wait(200);
        if (runIsOver() || !handLive()) { if (runIsOver()) break; continue; }
        if (typeof devBustMe === 'function') devBustMe();
        for (let i = 0; i < 30 && !runIsOver() && handLive(); i += 1) await wait(250);
      }
      await wait(1400);
    }
  };

  const jump = (screen) => {
    state.screen = screen;
    writeState();
    const next = new URL(location.href);
    next.searchParams.set('screen', screen);
    next.searchParams.set('dev', '');       // the result routes need dev entry points
    location.href = next.toString();
  };

  /* ---------- control bar ---------- */
  const bar = document.createElement('div');
  bar.className = 'pv-bar';
  const tab = document.createElement('button');
  tab.className = 'pv-tab';
  tab.type = 'button';
  tab.textContent = '▾ preview controls';

  const option = (value, label, selected) =>
    `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;

  bar.innerHTML = `
    <button type="button" class="pv-ab" data-pv="ab" data-pv-mode></button>
    <label><span>Screen</span>
      <select data-pv="screen">${SCREENS.map(([v, l]) => option(v, l, state.screen)).join('')}</select>
    </label>
    <label><span>Ink</span>
      <select data-pv="print">${[
        ['off', 'Original'],
        ['p0', 'P0 Production ink'],
        ['p1', 'P1 Struck'],
        ['p2', 'P2 Moulded'],
        ['p3', 'P3 Screen print'],
        ['p4', 'P4 Etched fill']
      ].map(([v, l]) => option(v, l, state.print)).join('')}</select>
    </label>
    <label><span>Glass</span>
      <select data-pv="glass">${[
        ['off', 'Original'],
        ['c0', 'C0 Current Upgrade']
      ].map(([v, l]) => option(v, l, state.glass)).join('')}</select>
    </label>
    <label><span>Chassis</span>
      <select data-pv="chassis">${[
        ['off', 'F0 Original baseline'],
        ['f2', 'F2 Padded leather'],
        ['f3', 'F3 Wood rail'],
        ['f5', 'F5 Layered rim']
      ].map(([v, l]) => option(v, l, state.chassis)).join('')}</select>
    </label>
    <label><span>Screens</span>
      <select data-pv="screens">${[
        ['off', 'Original'],
        ['machine', 'Machine treatment']
      ].map(([v, l]) => option(v, l, state.screens)).join('')}</select>
    </label>
    <label><span>Results</span>
      <select data-pv="results">${[
        ['off', 'Original'],
        ['machine', 'Machine + roll-in']
      ].map(([v, l]) => option(v, l, state.results)).join('')}</select>
    </label>
    <label><span>Board</span>
      <select data-pv="felt">${[
        ['off', 'Original'],
        ['even-board', 'Even gap · tighter board'],
        ['even-frame', 'Even gap · rounder frame'],
        ['none', 'No board']
      ].map(([v, l]) => option(v, l, state.felt)).join('')}</select>
    </label>
    <label><input type="checkbox" data-pv="crt"${state.crt ? ' checked' : ''}><span>CRT fx</span></label>
    <label><input type="checkbox" data-pv="motion"${state.motion ? ' checked' : ''}><span>Spring</span></label>
    <label><span>Theme</span>
      <select data-pv="theme">${['emerald', 'midnight', 'burgundy', 'slate']
        .map((t) => option(t, t[0].toUpperCase() + t.slice(1), document.body.dataset.theme)).join('')}</select>
    </label>
    <label><input type="checkbox" data-pv="dev"${state.dev ? ' checked' : ''}><span>Dev</span></label>
    <span class="pv-spacer"></span>
    <button type="button" data-pv="reload">Reload</button>
    <button type="button" data-pv="collapse">Hide</button>`;

  document.body.appendChild(bar);
  document.body.appendChild(tab);

  const modeReadout = bar.querySelector('[data-pv-mode]');

  const syncChrome = () => {
    const original = isOriginal();
    modeReadout.textContent = original ? 'SHOWING: ORIGINAL' : 'SHOWING: NEW';
    modeReadout.classList.toggle('is-original', original);
    ['print', 'glass', 'chassis', 'screens', 'results', 'felt'].forEach((key) => {
      const el = bar.querySelector(`[data-pv="${key}"]`);
      if (el) el.value = state[key];
    });
    ['crt', 'motion'].forEach((key) => {
      const el = bar.querySelector(`[data-pv="${key}"]`);
      if (el) el.checked = state[key];
    });
    bar.hidden = !state.open;
    tab.hidden = state.open;
    document.body.classList.toggle('pv-bar-open', state.open);
    if (state.open) {
      document.body.style.setProperty('--pv-bar-h', `${bar.offsetHeight}px`);
    } else {
      document.body.style.removeProperty('--pv-bar-h');
    }
    const panel = $id('dev-panel');
    if (panel) panel.style.display = state.dev ? '' : 'none';
  };

  bar.addEventListener('change', (event) => {
    const key = event.target.dataset.pv;
    if (!key) return;
    if (key === 'screen') { jump(event.target.value); return; }
    if (key === 'theme') {
      document.body.setAttribute('data-theme', event.target.value);
      return;
    }
    if (event.target.type === 'checkbox') state[key] = event.target.checked;
    else state[key] = event.target.value;
    writeState();
    applyTreatment();
    syncChrome();
  });

  bar.addEventListener('click', (event) => {
    const key = event.target.dataset.pv;
    if (key === 'collapse') { state.open = false; writeState(); syncChrome(); }
    if (key === 'reload') jump(state.screen);
    if (key === 'ab') {
      /* Flip every layer at once. Going to Original remembers the set you were
         looking at, so coming back restores exactly that, not the defaults. */
      if (isOriginal()) Object.assign(state, state.lastNew || APPROVED);
      else { state.lastNew = { print: state.print, glass: state.glass, chassis: state.chassis, screens: state.screens, results: state.results, felt: state.felt, crt: state.crt, motion: state.motion };
             Object.assign(state, ORIGINAL); }
      writeState();
      applyTreatment();
      syncChrome();
    }
  });

  tab.addEventListener('click', () => { state.open = true; writeState(); syncChrome(); });

  /* ---------- boot ---------- */
  applyTreatment();
  scanCrts();
  new MutationObserver(scanCrts).observe(document.body, { childList: true, subtree: true });

  const boot = async () => {
    syncChrome();
    const route = ROUTES[state.screen];
    if (route && state.screen !== 'home') {
      await wait(250);
      try { await route(); } catch (error) { console.warn('[preview] route failed', state.screen, error); }
    }
    syncChrome();
  };

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
