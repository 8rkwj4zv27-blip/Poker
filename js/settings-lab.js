"use strict";

/* ============================================================
   SETTINGS LAB — inside the game (round 1, phone-first)

   docs/ui/SETTINGS_PLAN.md, Phase 1. Rebuilds the real Settings sheet
   into the new layout from the game's own controls: every switch and
   choice row is MOVED (never copied), so it keeps its wiring and saves
   exactly as it does today. Three controls are new here and wired by the
   lab: Hand readout (settings.strength), Four-colour deck
   (settings.fourColour) and Volume (settings.volume, 0-10).

   Pages inside the sheet: MAIN (Settings), WORKSHOP (the drawer list) and
   one page per drawer. The sheet's data-st-page says which shows. The
   Finishes page keeps its own switch (show-finishes) and returns to the
   Cabinet drawer.

   A TUNE key (top left) opens the lab's sheet: BEFORE/AFTER, layout,
   volume control, hints, and "open Settings at home / at a table".
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { view:'after', layout:'panel', volume:'fader', hints:'on', open:null };
  const $id = id => document.getElementById(id);
  const sheet = $id('settings-sheet');
  const mainBody = sheet && sheet.querySelector(':scope > .sheet-body:not(#finishes-body)');
  const html = document.documentElement;

  /* ---- volume: one master gain on every audio context ----
     The game's sounds all connect to ctx.destination; in the lab that
     getter hands back a gain node in front of the real speaker. (In the
     game this becomes Sound.out(), see the plan.) */
  const curve = v => Math.pow(Math.max(0, Math.min(10, v)) / 10, 1.7);
  (function volumeShim(){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let proto = AC.prototype;
    while (proto && !Object.getOwnPropertyDescriptor(proto, 'destination')) proto = Object.getPrototypeOf(proto);
    if (!proto) return;
    const real = Object.getOwnPropertyDescriptor(proto, 'destination').get;
    Object.defineProperty(proto, 'destination', { configurable:true, get(){
      if (!this.__stMaster){
        const g = this.createGain();
        g.gain.value = curve(settings.volume == null ? 10 : settings.volume);
        g.connect(real.call(this));
        this.__stMaster = g;
        (window.__stMasters = window.__stMasters || []).push(g);
      }
      return this.__stMaster;
    }});
  })();
  function setVolume(v){
    settings.volume = v; saveSettings();
    (window.__stMasters || []).forEach(g => { try{ g.gain.value = curve(v); }catch(e){} });
  }
  if (settings.volume == null) settings.volume = 10;

  /* ---- small builders ---- */
  const el = (tag, cls, inner) => { const e = document.createElement(tag); if (cls) e.className = cls; if (inner != null) e.innerHTML = inner; return e; };
  // controls are looked up once, before any of them moves into a plate
  // that isn't attached yet (getElementById can't see those)
  const found = {};
  const take = id => found[id] || (found[id] = $id(id));
  const fieldOf = id => { const e = $id(id); return e ? e.closest('.field') : null; };
  if (state.view !== 'after' || !sheet || !mainBody){ buildTune(); return; }

  function plate(key, title){
    const p = el('div', 'sheet-section st-plate');
    p.dataset.stPlate = key;
    p.appendChild(el('h3', null, title));
    return p;
  }
  // A setting row: label + one-line hint, the control on the right
  // ('side') or underneath ('below', for three or more choices).
  function row(label, hint, control, where){
    const r = el('div', 'st-row' + (where === 'below' ? ' st-row--below' : ''));
    const t = el('div', 'st-text', '<div class="st-label">' + label + '</div>' + (hint ? '<div class="st-hint">' + hint + '</div>' : ''));
    const c = el('div', 'st-ctl');
    if (control) c.appendChild(control);
    r.appendChild(t); r.appendChild(c);
    return r;
  }
  function newSwitch(id, label, key, after){
    const b = el('button', 'switch');
    b.type = 'button'; b.id = id; b.setAttribute('role', 'switch'); b.setAttribute('aria-label', label);
    b.setAttribute('aria-checked', settings[key] ? 'true' : 'false');
    b.addEventListener('click', () => {
      settings[key] = !settings[key];
      b.setAttribute('aria-checked', settings[key] ? 'true' : 'false');
      saveSettings();
      if (after) after();
    });
    return b;
  }
  // A drawer key: lamp, title, what's picked now, chevron.
  function drawerKey(page, title, sub, extra){
    const b = el('button', 'st-drawer-key' + (extra ? ' ' + extra : ''));
    b.type = 'button'; b.dataset.go = page;
    b.innerHTML = '<span class="st-dk-lamp" aria-hidden="true"></span>' +
      '<span class="st-dk-text"><span class="st-dk-title">' + title + '</span><span class="st-dk-sub" data-sub="' + page + '">' + (sub || '') + '</span></span>' +
      '<span class="st-dk-chev" aria-hidden="true">&#9656;</span>';
    return b;
  }
  function pageHead(title, back){
    const h = el('div', 'setup-head');
    h.innerHTML = '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">&larr;</button>' +
      '<h2 class="setup-title">' + title + '</h2><div class="setup-head-spacer" aria-hidden="true"></div>';
    return h;
  }
  function page(key){
    const b = el('div', 'sheet-body st-page');
    b.dataset.stPage = key;
    sheet.insertBefore(b, $id('finishes-body'));
    return b;
  }

  /* ---- the attic: what's left of the old sheet, kept wired but unseen ---- */
  const attic = el('div', 'st-attic'); attic.hidden = true;

  /* ---- MAIN: Settings ---- */
  mainBody.dataset.stPage = 'main';
  mainBody.classList.add('st-page');
  const head = mainBody.querySelector('.setup-head');
  const oldSections = Array.from(mainBody.querySelectorAll(':scope > .sheet-section'));
  const service = mainBody.querySelector('.sheet-service');
  const done = mainBody.querySelector('.sheet-done');
  const tableSec = $id('settings-table-section');

  ['speed-seg','sw-autodeal','sd-award-seg','sw-confirm-allin','sw-sd-winchance','sw-review','sw-sound','sw-motion'].forEach(take);

  // tabs (TABS layout only)
  const tabs = el('div', 'segmented compact st-tabs');
  tabs.setAttribute('role', 'tablist');
  [['play','PLAY'],['help','HELP'],['sound','SOUND'],['display','VIEW']].forEach(([k, t], i) => {
    const b = el('button', i === 0 ? 'active' : '', t); b.type = 'button'; b.dataset.tab = k; b.setAttribute('role', 'tab'); tabs.appendChild(b);
  });

  // THIS TABLE: the keys first, the danger key under them
  tableSec.classList.add('st-plate', 'st-table');
  tableSec.querySelector('h3').textContent = 'This table';
  const resetHint = tableSec.querySelector('.settings-reset .hint');
  if (resetHint) resetHint.remove();

  // PLAY
  const play = plate('play', 'Play');
  play.appendChild(row('Game speed', 'Pauses between deals and moves.', take('speed-seg')));
  play.appendChild(row('Auto-continue', 'Deals the next hand by itself.', take('sw-autodeal')));
  play.appendChild(row('Award Pot', 'When the machine waits for your AWARD POT press before paying out.', take('sd-award-seg'), 'below'));
  play.appendChild(row('Confirm all-in', 'Asks before you push your whole stack.', take('sw-confirm-allin')));

  // HELP: the machine's instruments
  const help = plate('help', 'Help');
  help.appendChild(row('Hand readout', 'Names your best hand on the dashboard as the cards come.',
    newSwitch('sw-strength', 'Hand readout', 'strength', () => { try{ updateHandInstrument(); }catch(e){} })));
  help.appendChild(row('Win chance', 'When everyone is all in, a meter shows each hand\'s chance.', take('sw-sd-winchance')));
  help.appendChild(row('P.I.P. report', 'A street-by-street grade after each hand. The next hand waits for DEAL.', take('sw-review')));
  help.appendChild(el('div', 'st-note', '<b>P.I.P.</b>, your coach, has his own key beside ⚙ at the table. Tap his screen when you want a read.'));

  // SOUND
  const sound = plate('sound', 'Sound');
  sound.appendChild(row('Sound', null, take('sw-sound')));
  const vol = volumeControl();
  sound.appendChild(row('Volume', null, vol, 'below'));
  const syncVolOn = () => vol.classList.toggle('is-off', !settings.sound);
  take('sw-sound').addEventListener('click', syncVolOn); syncVolOn();

  // DISPLAY
  const display = plate('display', 'Display');
  display.appendChild(row('Four-colour deck', 'Each suit its own colour: <span class="st-suits"><i class="s">&#9824;</i><i class="h">&#9829;</i><i class="d">&#9830;</i><i class="c">&#9827;</i></span>',
    newSwitch('sw-fourcolour', 'Four-colour deck', 'fourColour', applyTheme)));
  display.appendChild(row('Reduced motion', 'Less shake, fewer big arcade effects.', take('sw-motion')));

  // the WORKSHOP key
  const wsWrap = el('div', 'st-workshop-wrap');
  wsWrap.appendChild(drawerKey('workshop', 'Workshop', 'Cards · dealing · showdown · chips · colours', 'st-dk--workshop'));
  wsWrap.appendChild(el('div', 'st-note st-note--center', 'How the machine looks and sounds. Soon on the home screen too.'));

  // the service plate: build + Developer Mode, quiet
  if (service){ service.classList.add('st-service'); const ts = service.querySelector('.tl'); if (ts) ts.textContent = 'Developer mode'; }

  // assemble MAIN
  oldSections.forEach(s => { if (s !== tableSec && s !== service && s !== done) attic.appendChild(s); });
  mainBody.innerHTML = '';
  mainBody.appendChild(head);
  mainBody.appendChild(tabs);
  mainBody.appendChild(tableSec);
  [play, help, sound, display].forEach(p => mainBody.appendChild(p));
  mainBody.appendChild(wsWrap);
  if (service) mainBody.appendChild(service);
  if (done) mainBody.appendChild(done);
  mainBody.appendChild(attic);

  /* ---- WORKSHOP and its drawers ---- */
  const DRAWERS = [
    ['cards', 'Cards', ['deck-back-seg', 'holder-seg', 'deck-side-seg']],
    ['dealing', 'Dealing', null],
    ['showdown', 'Showdown', ['sd-smash-seg', 'sd-force-seg', 'sd-bounce-seg', 'sd-heat-seg', 'sd-pickup-seg']],
    ['chips', 'Chips & sound', ['tr-coins', 'coin-sound-seg']],
    ['cabinet', 'Cabinet', ['theme-seg']]
  ];
  // the chip-size row lives inside #settings-table-room (table-room.js
  // paints it from there), so that section moves whole and shows only it
  const trSec = $id('settings-table-room');
  const coins = trSec && trSec.querySelector('[data-tr="coins"]');
  if (coins) coins.id = 'tr-coins';

  const ws = page('workshop');
  ws.appendChild(pageHead('Workshop', 'main'));
  ws.appendChild(el('div', 'st-note st-intro', 'How the machine looks and sounds. Every change shows at once, on this device.'));
  const wsList = el('div', 'st-drawers');
  DRAWERS.forEach(([k, t]) => wsList.appendChild(drawerKey(k, t, '')));
  ws.appendChild(wsList);

  DRAWERS.forEach(([k, t, ids]) => {
    const p = page(k);
    p.appendChild(pageHead(t, 'workshop'));
    const box = el('div', 'sheet-section st-plate st-drawer');
    if (k === 'dealing'){
      const d = $id('settings-dealing');
      Array.from(d.childNodes).forEach(n => { if (n.nodeName !== 'H3') box.appendChild(n); });
    } else if (k === 'chips'){
      const cf = fieldOf('tr-coins');
      if (trSec && cf){
        Array.from(trSec.children).forEach(n => { if (n !== cf) n.classList.add('st-gone'); });
        trSec.classList.add('st-bare');
        box.appendChild(trSec);
      }
      box.appendChild(fieldOf('coin-sound-seg'));
    } else {
      ids.forEach(id => { const f = fieldOf(id); if (f) box.appendChild(f); });
    }
    if (k === 'cabinet'){
      const fe = $id('finishes-entry');
      const f = el('div', 'field');
      f.innerHTML = '<div class="field-label">Finishes</div>';
      if (fe) f.appendChild(fe);
      f.appendChild(el('div', 'hint', 'Other looks for the screens and buttons.'));
      box.appendChild(f);
    }
    p.appendChild(box);
  });

  /* ---- navigation ---- */
  function summary(k){
    const act = id => { const b = document.querySelector('#' + id + ' button.active'); return b ? b.textContent.trim() : ''; };
    if (k === 'cards') return act('deck-back-seg') + ' · ' + act('holder-seg') + ' holder';
    if (k === 'dealing'){
      const n = document.querySelectorAll('#deal-style-list .switch[aria-checked="true"]').length;
      return n <= 1 ? 'Flick only' : n + ' styles on';
    }
    if (k === 'showdown') return 'Smash: ' + act('sd-smash-seg');
    if (k === 'chips') return act('tr-coins') + ' chips · ' + act('coin-sound-seg') + ' sound';
    if (k === 'cabinet') return act('theme-seg');
    return '';
  }
  function go(to){
    sheet.dataset.stPage = to;
    if (to === 'workshop') DRAWERS.forEach(([k]) => { const s = sheet.querySelector('[data-sub="' + k + '"]'); if (s) s.textContent = summary(k); });
    const b = sheet.querySelector('.st-page[data-st-page="' + to + '"]');
    if (b) b.scrollTop = 0;
  }
  sheet.addEventListener('click', e => {
    const t = e.target.closest('[data-go]');
    if (t && sheet.contains(t)){ go(t.dataset.go); return; }
    const tab = e.target.closest('.st-tabs [data-tab]');
    if (tab){ setTab(tab.dataset.tab); }
  });
  function setTab(k){
    tabs.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === k));
    sheet.dataset.stTab = k;
  }
  setTab('play');
  go('main');
  new MutationObserver(() => { if (!sheet.classList.contains('open')) go('main'); })
    .observe(sheet, { attributes:true, attributeFilter:['class'] });

  /* ---- the volume control: FADER or STEPS (TUNE picks) ---- */
  function volumeControl(){
    const w = el('div', 'st-vol');
    w.setAttribute('role', 'slider'); w.setAttribute('aria-label', 'Volume');
    w.setAttribute('aria-valuemin', '0'); w.setAttribute('aria-valuemax', '10'); w.tabIndex = 0;
    let steps = '';
    let ticks = '';
    for (let i = 1; i <= 10; i++) steps += '<i style="--h:' + (30 + i * 7) + '%"></i>';
    for (let i = 0; i <= 10; i++) ticks += '<b style="--t:' + (i / 10) + '"></b>';
    w.innerHTML =
      '<div class="st-vol-track">' +
        '<div class="st-fader"><span class="st-fader-fill"></span><span class="st-fader-ticks">' + ticks + '</span><span class="st-fader-cap"></span></div>' +
        '<div class="st-steps">' + steps + '</div>' +
      '</div>' +
      '<span class="crt st-vol-readout" data-crt-quiet><span class="crt-figure">10</span></span>';
    const track = w.querySelector('.st-vol-track');
    let last = 0;
    const paint = v => {
      w.style.setProperty('--v', v / 10);
      w.setAttribute('aria-valuenow', String(v));
      w.querySelector('.crt-figure').textContent = v === 0 ? 'OFF' : String(v);
      w.querySelectorAll('.st-steps i').forEach((s, i) => s.classList.toggle('is-lit', i < v));
    };
    const set = v => {
      v = Math.max(0, Math.min(10, v));
      if (v === settings.volume) return;
      setVolume(v); paint(v);
      const now = performance.now();
      if (now - last > 110 && v > 0){ last = now; try{ if (typeof CoinTable !== 'undefined' && CoinTable.preview) CoinTable.preview(); else Sound.check(); }catch(e){} }
    };
    // FADER: the cap's centre follows the finger; STEPS: a tap lights
    // the bar under it and every bar below
    const fromX = x => {
      const r = track.getBoundingClientRect();
      if (html.dataset.stVolume === 'steps'){
        const f = (x - r.left) / r.width;
        return f < 0.04 ? 0 : Math.max(0, Math.min(10, Math.ceil(f * 10)));
      }
      const f = (x - r.left - 12) / (r.width - 24);
      return Math.round(Math.max(0, Math.min(1, f)) * 10);
    };
    let dragging = false;
    track.addEventListener('pointerdown', e => {
      dragging = true; try{ track.setPointerCapture(e.pointerId); }catch(err){}
      try{ Sound.unlock(); }catch(err){}
      set(fromX(e.clientX)); e.preventDefault();
    });
    track.addEventListener('pointermove', e => { if (dragging) set(fromX(e.clientX)); });
    const stop = () => { dragging = false; };
    track.addEventListener('pointerup', stop); track.addEventListener('pointercancel', stop);
    w.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp'){ set(settings.volume + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown'){ set(settings.volume - 1); e.preventDefault(); }
    });
    paint(settings.volume);
    return w;
  }

  /* ---- what TUNE switches ---- */
  function applyLook(){
    html.dataset.stLayout = state.layout;
    html.dataset.stVolume = state.volume;
    html.dataset.stHints = state.hints;
  }
  applyLook();
  html.dataset.stLab = 'after';

  buildTune();

  /* ---- TUNE: the lab's own sheet ---- */
  function buildTune(){
    const ROWS = [
      ['view', 'SETTINGS', [['after','NEW'],['before','TODAY\'S']], 'Today\'s is the sheet as it is in the game now, for comparison.'],
      ['layout', 'LAYOUT', [['panel','ONE PANEL'],['tabs','TABS']], 'One short scroll, or a tab strip under the header.'],
      ['volume', 'VOLUME CONTROL', [['fader','FADER'],['steps','STEPS']], 'Drag or tap. Sound plays as it changes.'],
      ['hints', 'HINTS', [['on','SHOWN'],['off','HIDDEN']], 'The one line of small print under each setting.']
    ];
    const seg = (k, opts) => '<div class="sdl-seg" data-key="' + k + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (state[k] === o[0] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
    const key = el('button', 'sdl-key', 'TUNE'); key.type = 'button';
    const tune = el('div', 'sdl-sheet stl-sheet');
    tune.setAttribute('role', 'dialog'); tune.setAttribute('aria-label', 'Settings lab');
    tune.innerHTML =
      '<div class="sdl-tabs"><button type="button" class="is-on" tabindex="-1">SETTINGS LAB · ROUND 1</button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<h3>OPEN SETTINGS<small>The ⚙ keys in the game work too.</small></h3>' +
        '<div class="sdl-moments"><button type="button" data-open="home">AT HOME</button><button type="button" data-open="table">AT A TABLE</button>' +
        '<button type="button" data-open="workshop" class="is-wide">THE WORKSHOP PAGE</button></div>' +
        ROWS.map(r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + '<p class="sdl-note">' + r[3] + '</p></div>').join('') +
        '<h3>WHAT MOVED<small>Nothing is lost: every saved pick keeps its value.</small></h3>' +
        '<ul class="stl-list">' +
          '<li>Award Pot moved to Play: it changes when you get paid, not how it looks.</li>' +
          '<li>Card backs, dealing, the smash, chips, coin sound, colours and Finishes moved to the Workshop.</li>' +
          '<li>The table-layout knobs are gone. The table looks exactly as it does now.</li>' +
          '<li>New: volume, hand readout on/off, four-colour deck.</li>' +
          '<li>This table (Save, Leave, Reset) sits at the top when you\'re at a table.</li>' +
        '</ul>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(tune);
    const open = on => { tune.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!tune.classList.contains('is-open')));
    tune.querySelector('.sdl-close').addEventListener('click', () => open(false));
    tune.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.open){ open(false); openAt(t.dataset.open); return; }
      const s = t.closest('.sdl-seg'); if (!s) return;
      const k = s.dataset.key, v = t.dataset.v;
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
      state[k] = v; if (host) host.set({ [k]:v });
      if (k === 'view'){ if (host){ host.set({ open:'home' }); host.reload(); } return; }
      applyLook();
    });
    // a reload carries "open Settings" across
    if (state.open){ const o = state.open; if (host) host.set({ open:null }); setTimeout(() => openAt(o), 600); }
  }
  async function openAt(where){
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const visible = id => { const e = $id(id); return e && !e.classList.contains('hidden'); };
    closeOverlays();
    if (where === 'table' && !visible('table-screen')){
      $id('quick-play').click();
      for (let i = 0; i < 80 && !visible('table-screen'); i++) await sleep(100);
      await sleep(2600);
    }
    openOverlay('settings');
    if (where === 'workshop' && sheet && sheet.dataset.stPage){ const k = sheet.querySelector('[data-go="workshop"]'); if (k) k.click(); }
  }
})();
