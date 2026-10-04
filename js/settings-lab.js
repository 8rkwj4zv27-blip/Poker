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

  // the service plate: build + Developer Mode, quiet
  if (service){ service.classList.add('st-service'); const ts = service.querySelector('.tl'); if (ts) ts.textContent = 'Developer mode'; }

  // assemble MAIN (round 2: no Workshop key here; it lives on the home screen)
  oldSections.forEach(s => { if (s !== tableSec && s !== service && s !== done) attic.appendChild(s); });
  mainBody.innerHTML = '';
  mainBody.appendChild(head);
  mainBody.appendChild(tabs);
  mainBody.appendChild(tableSec);
  [play, help, sound, display].forEach(p => mainBody.appendChild(p));
  if (service) mainBody.appendChild(service);
  if (done) mainBody.appendChild(done);
  mainBody.appendChild(attic);
  sheet.dataset.stPage = 'main';

  /* ---- THE WORKSHOP (round 4): one menu under a pinned preview ----
     Its own screen (Hand Rankings' cabinet). At the top, a slice of felt
     that stays in view: the dealer's deck (borrowed from the table while
     the Workshop is open, so the game's own code deals into it), your
     two cards in their holder, a few chips, and a one-line screen saying
     what's showing. Under it, the menu: every cosmetic in sections, the
     same rows and keys as Settings. Tap a pick and it plays above.
     TUNE: ONE PANEL (every section, one scroll) or CHOICE ROW (a row of
     keys under the preview picks the section). */
  const SECTIONS = [
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

  const wsScreen = el('div', 'screen hidden');
  wsScreen.id = 'workshop';
  const wsCard = el('div', 'lobby-card');
  wsScreen.appendChild(wsCard);
  const rankings = $id('rankings');
  rankings.parentNode.insertBefore(wsScreen, rankings.nextSibling);
  wsCard.appendChild(pageHead('Workshop', 'home'));

  // the preview window
  const face = (rank, suit, cls, i) => '<div class="card ' + cls + '" data-wsb-card="' + i + '">' + cardInner({ rank, suit }) + '</div>';
  let layersHTML = '';
  for (let i = 0; i < 6; i++) layersHTML += '<div class="card back small" style="--deck-layer:' + i + ';--ds-i:' + (5 - i) + '"></div>';
  const bench = el('div', 'ws-bench');
  bench.innerHTML =
    '<div class="wsb-felt">' +
      '<div class="wsb-station"><div class="dealer-deck" data-wsb-deck>' + layersHTML + '</div></div>' +
      '<div class="wsb-chips" aria-hidden="true"></div>' +
      '<div class="wsb-seat"><i class="wsb-slot"></i><div class="wsb-cards">' + face('K', '♦', 'diamond', 0) + face('Q', '♣', 'club', 1) + '</div><i class="wsb-lip"></i></div>' +
    '</div>' +
    '<div class="crt wsb-caption"><span class="crt-line" data-wsb-say>Tap any pick to see it here</span></div>';
  wsCard.appendChild(bench);

  // CHOICE ROW layout: one key per section
  const nav = el('div', 'segmented compact ws-nav');
  SECTIONS.forEach(([k, t], i) => { const b = el('button', i === 0 ? 'active' : '', t.replace(' & sound', '')); b.type = 'button'; b.dataset.wsSec = k; nav.appendChild(b); });
  wsCard.appendChild(nav);

  SECTIONS.forEach(([k, t, ids], i) => {
    const box = el('div', 'sheet-section st-plate ws-sec' + (i === 0 ? ' is-on' : ''));
    box.dataset.wsSec = k;
    box.appendChild(el('h3', null, t));
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
    if (k === 'showdown') box.appendChild(el('div', 'st-note', 'The smash needs a real pot, so its preview plays at a table: that comes next round.'));
    if (k === 'cabinet'){
      // Finishes still lives in the Settings sheet (it's styled there): this
      // key opens the sheet straight onto it. In the game it moves here.
      const f = el('div', 'field');
      f.innerHTML = '<div class="field-label">Finishes</div><div class="sheet-keys"><button class="btn-secondary" type="button" data-ws-finishes>Finishes</button></div>' +
        '<div class="hint">Other looks for the screens and buttons.</div>';
      box.appendChild(f);
    }
    wsCard.appendChild(box);
  });

  /* ---- the preview: what each pick plays ---- */
  const say = t => { const s = bench.querySelector('[data-wsb-say]'); if (s) s.textContent = t; };
  const benchDeck = bench.querySelector('[data-wsb-deck]');
  // while the Workshop is open the deck code's #dealer-deck is the bench's
  function borrowDeck(on){
    const real = document.querySelector('#felt .dealer-deck');
    if (on){ if (real) real.id = 'dealer-deck-parked'; benchDeck.id = 'dealer-deck'; }
    else { benchDeck.removeAttribute('id'); if (real) real.id = 'dealer-deck'; }
  }
  let busy = false, nextCard = 0;
  async function dealPreview(styleId){
    if (busy || motionOff()) return;
    busy = true;
    try{
      const target = bench.querySelector('[data-wsb-card="' + nextCard + '"]');
      nextCard = 1 - nextCard;
      const st = typeof DealStyles !== 'undefined' ? DealStyles.make(styleId || 'flick') : null;
      await DealerDeck.preview(target, st);
    }catch(e){}
    busy = false;
  }
  const chipD = () => { const b = document.querySelector('#tr-coins button.active'); return +(b ? b.dataset.v : 13) || 13; };
  function chipEl(colour, d){
    const c = CoinWorld.makeChip(colour);
    CoinWorld.setFrame(c, d, 0, false);
    const e = c.el;
    e.style.position = 'absolute'; e.style.width = d + 'px'; e.style.height = Math.round(d * 16 / 13) + 'px';
    e.style.backgroundSize = '100% 100%';
    return e;
  }
  const STACKS = [['t0', 6], ['t1', 4], ['t2', 3]];
  function paintChips(){
    const box = bench.querySelector('.wsb-chips'); box.innerHTML = '';
    const d = chipD();
    try{
      STACKS.forEach(([col, n], si) => {
        for (let i = 0; i < n; i++){
          const e = chipEl(col, d);
          e.style.left = (si * (d + 5)) + 'px'; e.style.bottom = (i * 3) + 'px'; e.style.zIndex = String(i);
          box.appendChild(e);
        }
      });
    }catch(err){}
    box.style.width = (STACKS.length * (d + 5)) + 'px';
  }
  function dropChip(){
    const box = bench.querySelector('.wsb-chips'), d = chipD();
    try{
      const si = Math.floor(Math.random() * STACKS.length), n = box.querySelectorAll('[data-s="' + si + '"]').length;
      const e = chipEl(STACKS[si][0], d);
      const h = STACKS[si][1] + n;
      e.dataset.s = String(si);
      e.style.left = (si * (d + 5)) + 'px'; e.style.bottom = (h * 3) + 'px'; e.style.zIndex = String(h);
      box.appendChild(e);
      if (!motionOff()) e.animate([{ transform:'translateY(-46px)' }, { transform:'translateY(0)', offset:.8 }, { transform:'translateY(-3px)' }, { transform:'none' }],
        { duration:320, easing:'steps(6,end)' });
      // keep the stacks short: an old top chip leaves
      const extra = box.querySelectorAll('[data-s]');
      if (extra.length > 4) extra[0].remove();
    }catch(err){}
  }
  const label = b => (b.querySelector('b') ? b.querySelector('b').textContent : b.textContent).trim();
  function react(b){
    const g = b.closest('.segmented'), id = g && g.id;
    const row = b.closest('[data-style]');
    if (b.classList.contains('wsb-play') && row){
      const name = (row.querySelector('.tl') || {}).textContent || row.dataset.style;
      say('Dealing: ' + name); dealPreview(row.dataset.style); return;
    }
    if (row && b.classList.contains('switch')){
      const on = b.getAttribute('aria-checked') === 'true';
      const name = (row.querySelector('.tl') || {}).textContent || row.dataset.style;
      say(name + (on ? ' is in the mix' : ' is out of the mix'));
      if (on) dealPreview(row.dataset.style);
      return;
    }
    if (row && g){ say(((row.querySelector('.tl') || {}).textContent || '') + ': ' + label(b)); return; }
    if (id === 'deck-back-seg'){ say('Card back: ' + label(b)); dealPreview('flick'); return; }
    if (id === 'holder-seg'){ say('Card holder: ' + label(b)); bench.classList.remove('wsb-flash'); void bench.offsetWidth; bench.classList.add('wsb-flash'); return; }
    if (id === 'deck-side-seg'){ say('The deck: ' + label(b)); setTimeout(() => dealPreview('flick'), 200); return; }
    if (id === 'deal-quick-seg' || id === 'deal-scope-seg'){ say('Dealing: ' + label(b)); return; }
    if (id && id.startsWith('sd-')){ say('Showdown: ' + label(b) + ' (preview at a table next round)'); return; }
    if (id === 'tr-coins'){ paintChips(); say('Chip size: ' + label(b)); return; }
    if (id === 'coin-sound-seg'){ dropChip(); say('Coin sound: ' + label(b)); return; }
    if (id === 'theme-seg'){ say('Colour: ' + label(b)); return; }
  }
  function setSec(k){
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.wsSec === k));
    wsCard.querySelectorAll('.ws-sec').forEach(s => s.classList.toggle('is-on', s.dataset.wsSec === k));
  }
  wsScreen.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go === 'home'){ closeWorkshop(); return; }
    if (b.hasAttribute('data-ws-finishes')){
      openOverlay('settings');
      const f = $id('open-finishes'); if (f) f.click();
      return;
    }
    if (b.dataset.wsSec){ setSec(b.dataset.wsSec); wsScreen.scrollTop = 0; return; }
    setTimeout(() => react(b), 0);   // after the control's own handler
  });
  // a play key on every deal style: deals one card that way, above (the
  // list is built after this script runs, so the keys go in on opening)
  function addPlayKeys(){
    document.querySelectorAll('#workshop .dst-row').forEach(r => {
      if (r.querySelector('.wsb-play')) return;
      const pb = el('button', 'wsb-play', '&#9654;'); pb.type = 'button'; pb.setAttribute('aria-label', 'Preview ' + r.dataset.style);
      const tr = r.querySelector('.toggle-row'); tr.insertBefore(pb, tr.querySelector('.switch'));
    });
  }
  function openWorkshop(){
    addPlayKeys();
    $id('home').classList.add('hidden');
    wsScreen.classList.remove('hidden');
    borrowDeck(true);
    paintChips();
    say('Tap any pick to see it here');
    wsScreen.scrollTop = 0;
  }
  function closeWorkshop(){
    wsScreen.classList.add('hidden');
    borrowDeck(false);
    $id('home').classList.remove('hidden');
    try{ reconstructMainMenu(); }catch(e){}
  }

  /* ---- THE HOME KEY: Custom Game's slab, with a trim (TUNE picks) ----
     LINE   a gold line set inside the edge, a gold stud each side
     STUDS  just the two gold studs
     EDGE   a thin gold ring round the slab
     LAMP   an amber lamp each side, like Career's */
  const homeKey = el('button', 'pc-button pc-button-secondary wk-trim',
    '<span class="pc-lamp is-amber wk-lamp" aria-hidden="true"></span><span class="wk-stud" aria-hidden="true"></span>Workshop' +
    '<span class="wk-stud" aria-hidden="true"></span><span class="pc-lamp is-amber wk-lamp" aria-hidden="true"></span>');
  homeKey.type = 'button'; homeKey.id = 'open-workshop';
  homeKey.addEventListener('click', openWorkshop);
  function placeKey(){
    const bay = document.querySelector('#menu-contraption .pc-control-bay');
    const row = bay.querySelector('.home-row');
    if (state.wplace === 'above') bay.insertBefore(homeKey, row); else bay.appendChild(homeKey);
  }

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
  // round 1's picks, locked in: one panel, the fader, hints shown
  function applyLook(){
    html.dataset.stLayout = 'panel';
    html.dataset.stVolume = 'fader';
    html.dataset.stHints = 'on';
    html.dataset.wbtn = state.wbtn || 'line';
    html.dataset.wsLayout = state.wlayout || 'panel';
    html.dataset.wsBench = state.bench || 'large';
    placeKey();
  }
  applyLook();
  html.dataset.stLab = 'after';

  buildTune();

  /* ---- TUNE: the lab's own sheet ---- */
  function buildTune(){
    const ROWS = [
      ['wbtn', 'WORKSHOP BUTTON', [['line','GOLD LINE'],['studs','STUDS'],['edge','GOLD EDGE'],['lamp','LAMPS']], 'Custom Game\'s button with a trim. GOLD LINE: a line inside the edge and a stud each side. STUDS: just the studs. GOLD EDGE: a thin gold ring. LAMPS: an amber lamp each side, like Career.'],
      ['wplace', 'WHERE IT SITS', [['under','UNDER THE ROW'],['above','ABOVE THE ROW']], 'Under Quick Deal and Hand Rankings, or between them and Custom Game.'],
      ['wlayout', 'WORKSHOP LAYOUT', [['panel','ONE PANEL'],['row','CHOICE ROW']], 'One scroll with every section, or a row of keys under the preview that picks the section.'],
      ['bench', 'PREVIEW WINDOW', [['large','LARGE'],['small','SMALL']], 'How tall the felt at the top of the Workshop is.'],
      ['view', 'SETTINGS', [['after','NEW'],['before','TODAY\'S']], 'Today\'s is the sheet as it is in the game now, for comparison.']
    ];
    const NAMES = Object.fromEntries(ROWS.map(r => [r[0], Object.fromEntries(r[2])]));
    const DEF = { wbtn:'line', wplace:'under', wlayout:'panel', bench:'large', view:'after' };
    const seg = (k, opts) => '<div class="sdl-seg" data-key="' + k + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + ((state[k] || DEF[k]) === o[0] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
    const key = el('button', 'sdl-key', 'TUNE'); key.type = 'button';
    const tune = el('div', 'sdl-sheet stl-sheet');
    tune.setAttribute('role', 'dialog'); tune.setAttribute('aria-label', 'Settings lab');
    tune.innerHTML =
      '<div class="sdl-tabs"><button type="button" class="is-on" tabindex="-1">SETTINGS + WORKSHOP · ROUND 4</button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<h3>JUMP TO<small>The keys in the game work too.</small></h3>' +
        '<div class="sdl-moments"><button type="button" data-open="workshop" class="is-wide">THE WORKSHOP</button><button type="button" data-open="home">SETTINGS AT HOME</button><button type="button" data-open="table">SETTINGS AT A TABLE</button></div>' +
        ROWS.map(r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + '<p class="sdl-note">' + r[3] + '</p></div>').join('') +
        '<div class="sdl-actions"><button type="button" data-act="copy" class="stl-copy">COPY MY PICKS</button></div>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>' +
        '<h3>WHAT MOVED<small>Nothing is lost: every saved pick keeps its value.</small></h3>' +
        '<ul class="stl-list">' +
          '<li>Round 4: the Workshop is one menu with a preview window pinned at the top. Tap a card back, a deal style (its play key), a chip size or a coin sound and it plays there.</li>' +
          '<li>The Workshop is opened from the home screen only. Settings no longer links to it.</li>' +
          '<li>Settings keeps your round-1 picks: one panel, the fader, hints shown.</li>' +
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
      if (t.dataset.act === 'copy'){
        const text = 'Settings + Workshop lab, round 4:\n' + ROWS.filter(r => r[0] !== 'view').map(r => '- ' + r[1].charAt(0) + r[1].slice(1).toLowerCase() + ': ' + NAMES[r[0]][state[r[0]] || DEF[r[0]]]).join('\n');
        const ta = tune.querySelector('.sdl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED: PASTE IT IN THE CHAT' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2600); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
        return;
      }
      const s = t.closest('.sdl-seg'); if (!s) return;
      const k = s.dataset.key, v = t.dataset.v;
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
      state[k] = v; if (host) host.set({ [k]:v });
      if (k === 'view'){ if (host){ host.set({ open:'home' }); host.reload(); } return; }
      applyLook();
      if (k === 'wbtn' || k === 'wplace'){ open(false); openAt('homescreen'); }
      if (k === 'wlayout' || k === 'bench'){ open(false); openAt('workshop'); }
    });
    // a reload carries "open Settings" across
    if (state.open){ const o = state.open; if (host) host.set({ open:null }); setTimeout(() => openAt(o), 600); }
  }
  async function openAt(where){
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const visible = id => { const e = $id(id); return e && !e.classList.contains('hidden'); };
    closeOverlays();
    if (where === 'homescreen' || where === 'workshop'){
      const ws = $id('workshop');
      if (ws && !ws.classList.contains('hidden')){ if (where === 'workshop') return; $id('workshop').querySelector('[data-go="home"]').click(); }
      if (visible('table-screen')){ try{ leaveTable(); }catch(e){} await sleep(600); }
      $id('home').classList.remove('hidden');
      if (where === 'workshop'){ const k = $id('open-workshop'); if (k) k.click(); }
      else { const k = $id('open-workshop'); if (k) setTimeout(() => k.scrollIntoView({ block:'center' }), 50); }
      return;
    }
    if (where === 'table' && !visible('table-screen')){
      $id('quick-play').click();
      for (let i = 0; i < 80 && !visible('table-screen'); i++) await sleep(100);
      await sleep(2600);
    }
    if (where === 'home'){ const ws = $id('workshop'); if (ws && !ws.classList.contains('hidden')) ws.querySelector('[data-go="home"]').click(); }
    openOverlay('settings');
  }
})();
