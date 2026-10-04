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

  /* ---- THE WORKSHOP (round 5): tabs, each with its own preview ----
     Its own screen (Hand Rankings' cabinet). A row of tabs: CARDS,
     DEALING, SHOWDOWN, CHIPS, CABINET, SCREENS. A tab is a stage built
     for that thing, a rack to browse with (js/workshop-rack.js: swiping
     previews, USE THIS chooses) and at most a couple of plain options.
     Round 5 builds CARDS and DEALING; the other tabs keep their plain
     controls until their rounds. SCREENS holds what was Finishes.

     Each stage has its own dealer's deck. The deck code works on
     #dealer-deck, so the stage on show borrows that id while the
     Workshop is open (the table's own deck gets it back on the way out). */
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

  const TABS = [['cards','Cards'],['dealing','Dealing'],['showdown','Showdown'],['chips','Chips'],['cabinet','Cabinet'],['screens','Screens']];
  const tabRow = el('div', 'segmented compact ws-tabs');
  TABS.forEach(([k, t], i) => { const b = el('button', i === 0 ? 'active' : '', t); b.type = 'button'; b.dataset.wsTab = k; tabRow.appendChild(b); });
  wsCard.appendChild(tabRow);
  const pages = {};
  TABS.forEach(([k]) => { const p = el('div', 'ws-tab'); p.dataset.wsTab = k; wsCard.appendChild(p); pages[k] = p; });

  /* ---- the stages ----
     CARDS: the deck on the felt and your hand standing in its holder on
     a strip of dashboard, as at the table.
     DEALING: just felt, the deck at one side and a card's place at the
     other (the side the deck isn't on): each style deals one card across. */
  const face = (rank, suit, cls) => '<div class="card ' + cls + '">' + cardInner({ rank, suit }) + '</div>';
  function stage(kind){
    let layersHTML = '';
    for (let i = 0; i < 6; i++) layersHTML += '<div class="card back small" style="--deck-layer:' + i + ';--ds-i:' + (5 - i) + '"></div>';
    const deckHTML = '<div class="wss-station"><div class="dealer-deck" data-wss-deck>' + layersHTML + '</div></div>';
    const s = el('div', 'ws-stage ws-stage--' + kind);
    s.innerHTML = kind === 'cards'
      ? '<div class="wss-box"><div class="wss-felt">' + deckHTML + '</div><div class="wss-dash"></div>' +
          // the holder spans the join: your cards stand up out of the dashboard
          '<div class="wss-seat"><i class="wss-slot"></i><div class="wss-cards">' + face('K', '♦', 'diamond') + face('Q', '♣', 'club') + '</div><i class="wss-lip"></i></div></div>' +
        '<div class="crt wss-caption"><span class="crt-line" data-wss-say></span></div>'
      : '<div class="wss-box"><div class="wss-felt">' + deckHTML + '<div class="wss-spot"><div class="card back small" data-st-spot></div></div></div></div>' +
        '<div class="crt wss-caption"><span class="crt-line" data-wss-say></span></div>';
    return s;
  }
  const sayOn = (st, t) => { const c = st.querySelector('[data-wss-say]'); if (c) c.textContent = t; };
  function borrowDeck(st){
    const real = document.querySelector('#felt .dealer-deck');
    document.querySelectorAll('[data-wss-deck]').forEach(d => d.removeAttribute('id'));
    if (st){ if (real) real.id = 'dealer-deck-parked'; st.querySelector('[data-wss-deck]').id = 'dealer-deck'; }
    else if (real) real.id = 'dealer-deck';
  }
  // one deal at a time; a newer request replaces one still waiting
  let busy = false, waiting = null;
  async function deal(target, styleId){
    if (motionOff() || !target) return;
    if (busy){ waiting = [target, styleId]; return; }
    busy = true;
    try{
      target.classList.add('is-dealt');   // the flight hides it until it lands
      await DealerDeck.preview(target, typeof DealStyles !== 'undefined' ? DealStyles.make(styleId || 'flick') : null);
    }catch(e){}
    busy = false;
    if (waiting){ const w = waiting; waiting = null; deal(w[0], w[1]); }
  }
  const keyRow = (label) => { const w = el('div', 'ws-use'); const b = el('button', 'btn-secondary ws-use-key', label); b.type = 'button'; const n = el('div', 'ws-use-note'); w.appendChild(b); w.appendChild(n); return { w, b, n }; };
  const optField = (title, node, hint) => { const f = el('div', 'field ws-opt'); f.innerHTML = '<div class="field-label">' + title + '</div>'; f.appendChild(node); if (hint) f.appendChild(el('div', 'hint', hint)); return f; };

  /* ---- CARDS: flick through the backs themselves ---- */
  const BACKS = [...document.querySelectorAll('#deck-back-seg button')].map(b => ({ id:b.dataset.v, name:(b.querySelector('b') || b).textContent.trim() }));
  const equippedBack = () => { try{ return DealerDeck.order.back; }catch(e){ return 'crest'; } };
  const cardsStage = stage('cards');
  pages.cards.appendChild(cardsStage);
  const backRack = WorkshopRack.create({
    items:BACKS.map(b => '<span class="ds-swatch wr-back" data-cb="' + b.id + '"><span class="card back"></span></span>'),
    index:Math.max(0, BACKS.findIndex(b => b.id === equippedBack())),
    onLand:i => showBack(i)
  });
  pages.cards.appendChild(backRack.el);
  const backUse = keyRow('Use this back');
  pages.cards.appendChild(backUse.w);
  function showBack(i){
    const b = BACKS[i]; if (!b) return;
    // browsing: the deck wears the back (put back on the way out unless used)
    document.documentElement.setAttribute('data-ds-back', b.id);
    const deckEl = cardsStage.querySelector('[data-wss-deck]');
    deckEl.classList.remove('ds-tap'); void deckEl.offsetWidth; deckEl.classList.add('ds-tap');
    const on = b.id === equippedBack();
    sayOn(cardsStage, b.name + (on ? '  ·  in use' : ''));
    backUse.b.textContent = on ? 'In use' : 'Use ' + b.name;
    backUse.b.classList.toggle('is-on', on);
    backUse.n.textContent = on ? 'This back is on every face-down card.' : 'Flick through them. Nothing changes until you tap Use.';
  }
  backUse.b.addEventListener('click', () => {
    const b = BACKS[backRack.index]; if (!b) return;
    const real = document.querySelector('#deck-back-seg [data-v="' + b.id + '"]');
    if (real) real.click();
    showBack(backRack.index);
  });
  const holderField = fieldOf('holder-seg'), sideField = fieldOf('deck-side-seg');
  const cardsOpts = el('div', 'sheet-section st-plate ws-opts');
  cardsOpts.appendChild(optField('Card holder', $id('holder-seg')));
  cardsOpts.appendChild(optField('The deck', $id('deck-side-seg')));
  pages.cards.appendChild(cardsOpts);
  if (holderField) holderField.remove();
  if (sideField) sideField.remove();

  /* ---- DEALING: each style deals one card across the felt ---- */
  const STY = typeof DealStyles !== 'undefined' ? DealStyles.STYLES : [];
  const TIER = { common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic', legendary:'Legendary' };
  // the owner's call (round 5): a style's rarity is its own, never set
  try{ DealStyles.apply({ rarity:Object.fromEntries(STY.map(s => [s.id, s.tier])) }); }catch(e){}
  const inMix = id => { try{ return !!DealStyles.order.on[id]; }catch(e){ return id === 'flick'; } };
  const styleHTML = s => '<div class="wr-style" data-tier="' + s.tier + '"><span class="wr-tier">' + TIER[s.tier] + '</span>' +
    '<b>' + s.name + '</b><span class="wr-note">' + s.note + '</span><span class="wr-mix">' + (inMix(s.id) ? '● In the mix' : '○ Not in the mix') + '</span></div>';
  const dealStage = stage('dealing');
  pages.dealing.appendChild(dealStage);
  const spot = dealStage.querySelector('[data-st-spot]');
  const styleRack = WorkshopRack.create({ items:STY.map(styleHTML), index:0, onLand:i => showStyle(i, true) });
  pages.dealing.appendChild(styleRack.el);
  const mixUse = keyRow('Add to the mix');
  const replay = el('button', 'btn-secondary ws-replay', '&#9654; Again'); replay.type = 'button';
  mixUse.w.insertBefore(replay, mixUse.n);
  pages.dealing.appendChild(mixUse.w);
  function showStyle(i, dealIt){
    const s = STY[i]; if (!s) return;
    const on = inMix(s.id);
    sayOn(dealStage, s.name + '  ·  ' + TIER[s.tier]);
    mixUse.b.textContent = on ? 'In the mix' : 'Add to the mix';
    mixUse.b.classList.toggle('is-on', on);
    const n = STY.filter(x => inMix(x.id)).length;
    mixUse.n.textContent = n + ' of ' + STY.length + ' styles in the mix. ' + (on ? 'Tap to take it out.' : 'Tap to deal with it in your games.');
    if (dealIt) deal(spot, s.id);
  }
  mixUse.b.addEventListener('click', () => {
    const s = STY[styleRack.index]; if (!s) return;
    const sw = document.querySelector('#deal-style-list [data-style="' + s.id + '"] .switch');
    if (sw) sw.click();
    styleRack.refresh(styleRack.index, styleHTML(s));
    showStyle(styleRack.index, false);
  });
  replay.addEventListener('click', () => { const s = STY[styleRack.index]; if (s) deal(spot, s.id); });
  const dealOpts = el('div', 'sheet-section st-plate ws-opts');
  const quick = $id('deal-quick-seg'), scope = $id('deal-scope-seg');
  dealOpts.appendChild(optField('Pick a style', scope, 'Once per hand: one style deals the whole hand. Every card: each card picks its own.'));
  dealOpts.appendChild(optField('Quick', quick));
  pages.dealing.appendChild(dealOpts);
  // the full list (switches and rarities) stays wired but out of sight
  const dealSec = $id('settings-dealing');
  if (dealSec) attic.appendChild(dealSec);
  quick.addEventListener('click', () => setTimeout(() => { STY.forEach((s, i) => styleRack.refresh(i, styleHTML(s))); showStyle(styleRack.index, false); }, 0));

  /* ---- SHOWDOWN, CHIPS, CABINET: plain controls until their rounds ---- */
  function plainTab(k, ids, note){
    const box = el('div', 'sheet-section st-plate ws-opts');
    box.appendChild(el('div', 'ws-soon', note));
    ids.forEach(id => { const f = typeof id === 'string' ? fieldOf(id) : id; if (f) box.appendChild(f); });
    pages[k].appendChild(box);
  }
  plainTab('showdown', ['sd-smash-seg', 'sd-force-seg', 'sd-bounce-seg', 'sd-heat-seg', 'sd-pickup-seg'],
    'Next: a pot that cooks and goes off up here, and these five rows become two (when it smashes, and a smash style).');
  let chipField = null;
  if (trSec){
    const cf = fieldOf('tr-coins');
    Array.from(trSec.children).forEach(n => { if (n !== cf) n.classList.add('st-gone'); });
    trSec.classList.add('st-bare');
    chipField = trSec;
  }
  plainTab('chips', [chipField, 'coin-sound-seg'].filter(Boolean), 'Next: a pile of chips and your bank up here, and the coin sounds in a rack.');
  plainTab('cabinet', ['theme-seg'], 'Next: a small piece of the machine up here in each colour, and the themes in a rack (with room for new ones).');

  /* ---- SCREENS: what was Finishes, out of Settings ---- */
  const fl = $id('finishes-list');
  const scr = el('div', 'sheet-section st-plate ws-opts ws-finishes');
  scr.appendChild(el('div', 'ws-soon', 'What was Settings → Finishes. Next: a live screen and a button up here, and the looks in a rack.'));
  if (fl) scr.appendChild(fl);
  const rf = $id('reset-finishes'); if (rf) scr.appendChild(rf);
  pages.screens.appendChild(scr);
  const fe = $id('finishes-entry'); if (fe) attic.appendChild(fe);

  /* ---- tabs, opening, closing ---- */
  let tab = 'cards';
  function setTab(k){
    tab = k;
    tabRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.wsTab === k));
    Object.keys(pages).forEach(p => pages[p].classList.toggle('is-on', p === k));
    document.documentElement.setAttribute('data-ds-back', equippedBack());
    if (k === 'cards'){ borrowDeck(cardsStage); showBack(backRack.index); }
    else if (k === 'dealing'){ borrowDeck(dealStage); setTimeout(() => showStyle(styleRack.index, true), 250); }
    else borrowDeck(null);
    if (k === 'screens'){
      // finishes.js renders its list when its page opens: open it once,
      // here, then put the sheet's page switch back
      const o = $id('open-finishes'); if (o && !fl.children.length) o.click();
      const sh = $id('settings-sheet'); if (sh) sh.classList.remove('show-finishes');
    }
  }
  wsScreen.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go === 'home'){ closeWorkshop(); return; }
    if (b.dataset.wsTab){ setTab(b.dataset.wsTab); wsScreen.scrollTop = 0; return; }
    if (b.closest('#holder-seg')) setTimeout(() => { sayOn(cardsStage, 'Card holder: ' + (b.querySelector('b') || b).textContent.trim()); cardsStage.classList.remove('wss-flash'); void cardsStage.offsetWidth; cardsStage.classList.add('wss-flash'); }, 0);
    if (b.closest('#deck-side-seg')) setTimeout(() => { sayOn(cardsStage, 'The deck: ' + b.textContent.trim()); }, 0);
  });
  function openWorkshop(){
    $id('home').classList.add('hidden');
    wsScreen.classList.remove('hidden');
    setTab(tab);
    wsScreen.scrollTop = 0;
  }
  function closeWorkshop(){
    wsScreen.classList.add('hidden');
    borrowDeck(null);
    document.documentElement.setAttribute('data-ds-back', equippedBack());
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
      ['view', 'SETTINGS', [['after','NEW'],['before','TODAY\'S']], 'Today\'s is the sheet as it is in the game now, for comparison.']
    ];
    const NAMES = Object.fromEntries(ROWS.map(r => [r[0], Object.fromEntries(r[2])]));
    const DEF = { wbtn:'line', wplace:'under', view:'after' };
    const seg = (k, opts) => '<div class="sdl-seg" data-key="' + k + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + ((state[k] || DEF[k]) === o[0] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
    const key = el('button', 'sdl-key', 'TUNE'); key.type = 'button';
    const tune = el('div', 'sdl-sheet stl-sheet');
    tune.setAttribute('role', 'dialog'); tune.setAttribute('aria-label', 'Settings lab');
    tune.innerHTML =
      '<div class="sdl-tabs"><button type="button" class="is-on" tabindex="-1">SETTINGS + WORKSHOP · ROUND 6</button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<h3>JUMP TO<small>The keys in the game work too.</small></h3>' +
        '<div class="sdl-moments"><button type="button" data-open="workshop" class="is-wide">THE WORKSHOP</button><button type="button" data-open="home">SETTINGS AT HOME</button><button type="button" data-open="table">SETTINGS AT A TABLE</button></div>' +
        ROWS.map(r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + '<p class="sdl-note">' + r[3] + '</p></div>').join('') +
        '<div class="sdl-actions"><button type="button" data-act="copy" class="stl-copy">COPY MY PICKS</button></div>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>' +
        '<h3>WHAT MOVED<small>Nothing is lost: every saved pick keeps its value.</small></h3>' +
        '<ul class="stl-list">' +
          '<li>Round 6: CARDS flicks through the card backs themselves, DEALING deals one card across the felt, both racks move exactly like the event cards.</li>' +
          '<li>Round 5: the Workshop is tabs, each with its own preview. CARDS and DEALING are built: swipe the rack to preview, tap Use (or Add to the mix) to choose. A style\'s rarity is now its own. Finishes moved to SCREENS.</li>' +
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
        const text = 'Settings + Workshop lab, round 6:\n' + ROWS.filter(r => r[0] !== 'view').map(r => '- ' + r[1].charAt(0) + r[1].slice(1).toLowerCase() + ': ' + NAMES[r[0]][state[r[0]] || DEF[r[0]]]).join('\n');
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
