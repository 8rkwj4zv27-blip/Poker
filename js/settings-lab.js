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

  const TABS = [['cards','Cards'],['dealing','Dealing'],['showdown','Showdown'],['chips','Chips'],['cabinet','Cabinet'],['screens','Screens'],['buttons','Buttons']];
  const tabRow = el('div', 'segmented compact ws-tabs');
  TABS.forEach(([k, t], i) => { const b = el('button', i === 0 ? 'active' : '', t); b.type = 'button'; b.dataset.wsTab = k; tabRow.appendChild(b); });
  wsCard.appendChild(tabRow);
  const pages = {};
  TABS.forEach(([k]) => { const p = el('div', 'ws-tab'); p.dataset.wsTab = k; wsCard.appendChild(p); pages[k] = p; });

  /* ---- the stages ----
     CARDS: the game's deck on the felt, and nothing else.
     DEALING: just felt, the deck at one side and a card's place at the
     other (the side the deck isn't on): each style deals one card across. */
  const face = (rank, suit, cls) => '<div class="card ' + cls + '">' + cardInner({ rank, suit }) + '</div>';
  function stage(kind){
    let layersHTML = '';
    for (let i = 0; i < 6; i++) layersHTML += '<div class="card back small" style="--deck-layer:' + i + ';--ds-i:' + (5 - i) + '"></div>';
    const deckHTML = '<div class="wss-station"><div class="dealer-deck" data-wss-deck>' + layersHTML + '</div></div>';
    const s = el('div', 'ws-stage ws-stage--' + kind);
    s.innerHTML = kind === 'cards'
      ? '<div class="wss-box"><div class="wss-felt">' + deckHTML + '</div></div>' +
        '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>'
      : '<div class="wss-box"><div class="wss-felt">' + deckHTML + '<div class="wss-spot"><div class="card back small" data-st-spot></div></div></div></div>' +
        '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>';
    return s;
  }
  function captionOnly(){ const c = el('div', 'ws-stage ws-stage--caption'); c.innerHTML = '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>'; return c; }
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
  // the rack is the preview (owner, round 7): above it, only the name
  const cardsStage = captionOnly();
  pages.cards.appendChild(cardsStage);
  const backRack = WorkshopRack.create({
    // the deck's own card (card back small), drawn at its real size and
    // enlarged exactly x3 as one layer, so the pattern is the deck's and
    // it never redraws while it moves
    items:BACKS.map(b => '<span class="ds-swatch wr-back" data-cb="' + b.id + '"><span class="card back small"></span></span>'),
    index:Math.max(0, BACKS.findIndex(b => b.id === equippedBack())),
    onNotch:i => nameBack(i),
    onLand:i => showBack(i)
  });
  pages.cards.appendChild(backRack.el);
  const backUse = keyRow('Use this back');
  pages.cards.appendChild(backUse.w);
  // the name and the key follow the card in the middle as it moves
  function nameBack(i){
    const b = BACKS[i]; if (!b) return;
    const on = b.id === equippedBack();
    sayOn(cardsStage, b.name + (on ? '  \u00b7  in use' : ''));
    backUse.b.textContent = on ? 'In use' : 'Use ' + b.name;
    backUse.b.classList.toggle('is-on', on);
  }
  function showBack(i){
    const b = BACKS[i]; if (!b) return;
    // browsing: the deck wears the back (put back on the way out unless used)
    document.documentElement.setAttribute('data-ds-back', b.id);
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
  // the card holder is out of the Workshop for now (owner, round 6): its
  // row stays wired, unseen. The deck's side goes to DEALING, where it shows.
  if (holderField) attic.appendChild(holderField);
  const sideSeg = $id('deck-side-seg');
  if (sideField) sideField.remove();

  /* ---- DEALING: each style deals one card across the felt ---- */
  const STY = typeof DealStyles !== 'undefined' ? DealStyles.STYLES : [];
  const TIER = { common:'Common', uncommon:'Uncommon', rare:'Rare', epic:'Epic', legendary:'Legendary' };
  // the owner's call (round 5): a style's rarity is its own, never set
  try{ DealStyles.apply({ rarity:Object.fromEntries(STY.map(s => [s.id, s.tier])) }); }catch(e){}
  const inMix = id => { try{ return !!DealStyles.order.on[id]; }catch(e){ return id === 'flick'; } };
  // a style's ticket: coloured by its rarity, with its pips and odds, the
  // name big, and a lamp lit when it's in the mix (the CRT carries the rest)
  // Press Start's letters are 1em wide (+ its .04em spacing): size the
  // name so its longest word fits the ticket's 104px with room to spare
  const fitName = n => Math.min(13, Math.floor(104 / (Math.max(...n.split(/\s+/).map(w => w.length)) * 1.04) * 2) / 2);
  const PIPS = { common:1, uncommon:2, rare:3, epic:4, legendary:5 };
  const ODDS = { common:'Common', uncommon:'Uncommon', rare:'Rare \u00b7 1 in 50', epic:'Epic \u00b7 1 in 80', legendary:'Legendary \u00b7 1 in 300' };
  const styleHTML = s => '<div class="wr-style" data-tier="' + s.tier + '">' +
    '<span class="wr-mixlamp' + (inMix(s.id) ? ' is-on' : '') + '" aria-hidden="true"></span>' +
    '<span class="wr-pips">' + [1,2,3,4,5].map(n => '<i' + (n <= PIPS[s.tier] ? ' class="on"' : '') + '></i>').join('') + '</span>' +
    '<b style="font-size:' + fitName(s.name) + 'px">' + s.name + '</b>' +
    '<span class="wr-tier">' + ODDS[s.tier] + '</span></div>';
  const dealStage = stage('dealing');
  pages.dealing.appendChild(dealStage);
  const spot = dealStage.querySelector('[data-st-spot]');
  const styleRack = WorkshopRack.create({ items:STY.map(styleHTML), index:0, onNotch:i => showStyle(i, false), onLand:i => showStyle(i, true) });
  pages.dealing.appendChild(styleRack.el);
  const mixUse = keyRow('Add to the mix');
  const replay = el('button', 'btn-secondary ws-replay', '&#9654; Again'); replay.type = 'button';
  mixUse.w.insertBefore(replay, mixUse.n);
  pages.dealing.appendChild(mixUse.w);
  function showStyle(i, dealIt){
    const s = STY[i]; if (!s) return;
    const on = inMix(s.id);
    sayOn(dealStage, s.note);   // the ticket has the name and rarity; the screen says how it flies
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
  if (sideSeg) dealOpts.appendChild(optField('The deck', sideSeg, 'Which side of the table the dealer\'s deck sits.'));
  pages.dealing.appendChild(dealOpts);
  // the full list (switches and rarities) stays wired but out of sight
  const dealSec = $id('settings-dealing');
  if (dealSec) attic.appendChild(dealSec);
  quick.addEventListener('click', () => setTimeout(() => { STY.forEach((s, i) => styleRack.refresh(i, styleHTML(s))); showStyle(styleRack.index, false); }, 0));

  /* ---- a rack tab: the name/notes screen, the rack, the Use key ----
     browse(i) shows a pick without keeping it; use(i) keeps it; current()
     says which is kept. Leaving the tab (or the Workshop) puts back what's
     kept. */
  function rackTab(o){
    const cap = o.stage || captionOnly();
    o.page.appendChild(cap);
    const rack = WorkshopRack.create({
      items:o.items.map(o.card), index:Math.max(0, o.items.findIndex(x => x.id === o.current())),
      onNotch:i => name(i), onLand:i => { name(i); if (o.browse) o.browse(o.items[i], cap); }
    });
    o.page.appendChild(rack.el);
    const key = keyRow('Use');
    o.page.appendChild(key.w);
    function name(i){
      const it = o.items[i]; if (!it) return;
      const on = it.id === o.current();
      sayOn(cap, it.name + (it.note ? '  ·  ' + it.note : '') + (on ? '  ·  in use' : ''));
      key.b.textContent = on ? 'In use' : 'Use ' + it.name;
      key.b.classList.toggle('is-on', on);
      key.n.textContent = on ? (o.inUse || 'This is the one in use.') : 'Flick through them. Nothing changes until you tap Use.';
    }
    key.b.addEventListener('click', () => { const it = o.items[rack.index]; if (it){ o.use(it); name(rack.index); } });
    return { rack, cap, show:() => { name(rack.index); if (o.browse) o.browse(o.items[rack.index], cap); }, name };
  }

  /* ---- SHOWDOWN: plain controls until its round ---- */
  const sdBox = el('div', 'sheet-section st-plate ws-opts');
  sdBox.appendChild(el('div', 'ws-soon', 'Next: a pot that cooks and goes off up here, and these five rows become two (when it smashes, and a smash style).'));
  ['sd-smash-seg', 'sd-force-seg', 'sd-bounce-seg', 'sd-heat-seg', 'sd-pickup-seg'].forEach(id => { const f = fieldOf(id); if (f) sdBox.appendChild(f); });
  pages.showdown.appendChild(sdBox);

  /* ---- CHIPS: coin sounds in a rack over a pile of chips ----
     The stage is felt with three stacks; landing on a sound drops chips
     onto them with that sound. Chip size redraws them. */
  const SOUNDS = [...document.querySelectorAll('#coin-sound-seg button')].map(b => ({ id:b.dataset.coin, name:b.textContent.trim() }));
  const chipD = () => { const b = document.querySelector('#tr-coins button.active'); return +(b ? b.dataset.v : 13) || 13; };
  function chipEl(colour, d){
    const c = CoinWorld.makeChip(colour);
    CoinWorld.setFrame(c, d, 0, false);
    const e = c.el;
    e.style.position = 'absolute'; e.style.width = d + 'px'; e.style.height = Math.round(d * 16 / 13) + 'px';
    e.style.backgroundSize = '100% 100%';
    return e;
  }
  const chipStage = el('div', 'ws-stage ws-stage--chips');
  chipStage.innerHTML = '<div class="wss-box"><div class="wss-felt"><div class="wss-chips"></div></div></div><div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>';
  const STACKS = [['t0', 7], ['t1', 5], ['t2', 6], ['t3', 3]];
  function paintChips(){
    const box = chipStage.querySelector('.wss-chips'); box.innerHTML = '';
    const d = chipD(), gap = d + 7;
    try{
      STACKS.forEach(([col, n], si) => {
        for (let i = 0; i < n; i++){
          const e = chipEl(col, d);
          e.style.left = (si * gap) + 'px'; e.style.bottom = (i * 3) + 'px'; e.style.zIndex = String(i);
          box.appendChild(e);
        }
      });
    }catch(err){}
    box.style.width = (STACKS.length * gap - 7) + 'px';
  }
  function dropChips(){
    const box = chipStage.querySelector('.wss-chips'), d = chipD(), gap = d + 7;
    box.querySelectorAll('.is-dropped').forEach(e => e.remove());
    [0, 70, 150].forEach((t, k) => setTimeout(() => {
      try{
        const si = (k * 2 + 1) % STACKS.length, h = STACKS[si][1] + box.querySelectorAll('[data-s="' + si + '"]').length;
        const e = chipEl(STACKS[si][0], d);
        e.classList.add('is-dropped'); e.dataset.s = String(si);
        e.style.left = (si * gap) + 'px'; e.style.bottom = (h * 3) + 'px'; e.style.zIndex = String(h);
        box.appendChild(e);
        if (!motionOff()) e.animate([{ transform:'translateY(-60px)' }, { transform:'translateY(0)', offset:.8 }, { transform:'translateY(-3px)' }, { transform:'none' }], { duration:300, easing:'steps(6,end)' });
      }catch(err){}
    }, t));
  }
  // a sound plays as itself without being kept: the coin world reads
  // settings.coinSound when it plays, so it's swapped in for the moment
  function playSound(id){
    const was = settings.coinSound;
    settings.coinSound = id;
    try{ Sound.unlock(); if (typeof CoinTable !== 'undefined') CoinTable.preview(); }catch(e){}
    settings.coinSound = was;
  }
  const soundTab = rackTab({
    page:pages.chips, stage:chipStage, items:SOUNDS,
    card:it => '<div class="wr-ticket wr-sound"><span class="wr-chip" data-chip></span><b>' + it.name + '</b><span class="wr-band">Coin sound</span></div>',
    current:() => settings.coinSound,
    browse:it => { dropChips(); playSound(it.id); },
    use:it => { const b = document.querySelector('#coin-sound-seg [data-coin="' + it.id + '"]'); if (b) b.click(); },
    inUse:'Every chip lands, stacks and pays out with this sound.'
  });
  // each ticket wears a big chip in the game's art
  soundTab.rack.el.querySelectorAll('[data-chip]').forEach((slot, i) => {
    try{ const e = chipEl(['t1','t0','t2','t3','t4','t5'][i % 6], 30); e.style.position = 'relative'; slot.appendChild(e); }catch(err){}
  });
  const chipOpts = el('div', 'sheet-section st-plate ws-opts');
  if (trSec){
    const sizeSeg = $id('tr-coins');
    chipOpts.appendChild(optField('Chip size', sizeSeg, 'Every chip, on the table and in your bank.'));
    sizeSeg.addEventListener('click', () => setTimeout(() => { paintChips(); sayOn(chipStage, 'Chip size: ' + ((sizeSeg.querySelector('.active') || {}).textContent || '')); }, 0));
  }
  pages.chips.appendChild(chipOpts);

  /* ---- CABINET: the colour themes, each a little machine ----
     Each card is drawn in its own theme (the theme tokens are set on any
     element with data-theme). Landing on one dresses the whole Workshop in
     it; Use keeps it. */
  const THEMES = [...document.querySelectorAll('#theme-seg button')].map(b => ({ id:b.dataset.theme, name:b.textContent.trim() }));
  const themeTab = rackTab({
    page:pages.cabinet, items:THEMES,
    card:it => '<div class="wr-ticket wr-theme" data-theme="' + it.id + '"><span class="wr-mini"><i class="wr-mini-felt"><i></i><i></i></i>' +
      '<i class="wr-mini-dash"><i class="wr-mini-crt"></i><i class="wr-mini-keys"><i></i><i></i><i></i></i></i></span><b>' + it.name + '</b><span class="wr-band">Cabinet</span></div>',
    current:() => settings.theme,
    browse:it => { document.body.setAttribute('data-theme', it.id); },
    use:it => { const b = document.querySelector('#theme-seg [data-theme="' + it.id + '"]'); if (b) b.click(); },
    inUse:'The whole machine wears these colours.'
  });

  /* ---- SCREENS (CRT looks) and BUTTONS (press feel): what was Finishes ---- */
  const SETS = (typeof Finishes !== 'undefined' && Finishes.sets) || [];
  const crtSet = SETS.find(x => x.attr === 'finishCrt'), pressSet = SETS.find(x => x.attr === 'finishPress');
  const finishNow = attr => document.documentElement.dataset[attr] || '';
  const camel = k => 'crt' + k[0].toUpperCase() + k.slice(1);
  const dash = k => 'data-crt-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  // a look's dials as attributes, so one card can wear its own look
  function crtAttrs(id){
    const pr = id && typeof CRT !== 'undefined' && CRT.PRESETS.find(x => x.id === id);
    const d = pr ? Object.fromEntries(Object.entries(pr.dials).map(([k, v]) => [camel(k), String(v)])) : Object.assign({}, window.CRT_RECIPE || {});
    return Object.entries(d).map(([k, v]) => dash(k.replace(/^crt/, '').replace(/^./, c => c.toLowerCase())) + '="' + v + '"').join(' ');
  }
  if (crtSet){
    const items = crtSet.options.map(x => ({ id:x.id, name:x.name, note:'' }));
    rackTab({
      page:pages.screens, items,
      card:it => '<div class="wr-ticket wr-crtcard"><span class="wr-crtwrap" ' + crtAttrs(it.id) + '><span class="crt wr-crt-a" data-ink="live">Dealer ready</span><span class="crt wr-crt-b" data-ink="money"><span class="crt-figure">$1,250</span></span></span><b>' + it.name + '</b><span class="wr-band">Screens</span></div>',
      current:() => finishNow('finishCrt'),
      browse:(it, cap) => { const o = crtSet.options.find(x => x.id === it.id); sayOn(cap, it.name + '  ·  ' + (o ? o.note : '')); },
      use:it => Finishes.choose('finishCrt', it.id),
      inUse:'Every screen in the machine wears this look.'
    });
  }
  if (pressSet){
    const pressStage = el('div', 'ws-stage ws-stage--keys');
    pressStage.innerHTML = '<div class="wss-keys"><button class="icon-btn" type="button" aria-label="Try the small key">⚙</button><button class="btn-secondary" type="button">Try me</button><button class="btn-primary" type="button">Big key</button></div>' +
      '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>';
    const items = pressSet.options.map(x => ({ id:x.id, name:x.name, note:'' }));
    rackTab({
      page:pages.buttons, stage:pressStage, items,
      card:it => '<div class="wr-ticket wr-press"><span class="wr-presskey"><i></i></span><b>' + it.name + '</b><span class="wr-band">Buttons</span></div>',
      current:() => finishNow('finishPress'),
      // the press feel is the whole page's: browsing wears it, leaving puts it back
      browse:(it, cap) => {
        if (it.id) document.documentElement.dataset.finishPress = it.id; else delete document.documentElement.dataset.finishPress;
        const o = pressSet.options.find(x => x.id === it.id); sayOn(cap, it.name + '  ·  ' + (o ? o.note : '') + '  Press the keys above.');
      },
      use:it => Finishes.choose('finishPress', it.id),
      inUse:'Every button in the machine presses like this.'
    });
  }
  // put back what's kept: back, theme, press feel
  function restoreKept(){
    document.documentElement.setAttribute('data-ds-back', equippedBack());
    document.body.setAttribute('data-theme', settings.theme);
    let kept = {}; try{ kept = JSON.parse(localStorage.getItem('felt.finishes')) || {}; }catch(e){}
    if (kept.finishPress) document.documentElement.dataset.finishPress = kept.finishPress; else delete document.documentElement.dataset.finishPress;
  }
  const fe = $id('finishes-entry'); if (fe) attic.appendChild(fe);

  /* ---- tabs, opening, closing ---- */
  let tab = 'cards';
  function setTab(k){
    tab = k;
    tabRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.wsTab === k));
    Object.keys(pages).forEach(p => pages[p].classList.toggle('is-on', p === k));
    restoreKept();
    borrowDeck(k === 'dealing' ? dealStage : null);
    if (k === 'cards') showBack(backRack.index);
    else if (k === 'dealing') setTimeout(() => showStyle(styleRack.index, true), 250);
    else if (k === 'chips'){ paintChips(); soundTab.name(soundTab.rack.index); }
    else if (k === 'cabinet') themeTab.show();
    else { const r = pages[k].querySelector('.wr-reader'); if (r) r.querySelector('.wr-rack').focus({ preventScroll:true }); }
    if (k === 'screens' || k === 'buttons'){ const c = pages[k]; const cap = c.querySelector('.ws-stage'); if (cap && !cap.querySelector('[data-wss-say]').textContent) cap.querySelector('[data-wss-say]').textContent = 'Flick through the looks below.'; }
  }
  wsScreen.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go === 'home'){ closeWorkshop(); return; }
    if (b.dataset.wsTab){ setTab(b.dataset.wsTab); wsScreen.scrollTop = 0; return; }
    if (b.closest('#deck-side-seg')) setTimeout(() => { const st = STY[styleRack.index]; if (st) deal(spot, st.id); }, 200);
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
    restoreKept();
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
      '<div class="sdl-tabs"><button type="button" class="is-on" tabindex="-1">SETTINGS + WORKSHOP · ROUND 8</button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<h3>JUMP TO<small>The keys in the game work too.</small></h3>' +
        '<div class="sdl-moments"><button type="button" data-open="workshop" class="is-wide">THE WORKSHOP</button><button type="button" data-open="home">SETTINGS AT HOME</button><button type="button" data-open="table">SETTINGS AT A TABLE</button></div>' +
        ROWS.map(r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + '<p class="sdl-note">' + r[3] + '</p></div>').join('') +
        '<div class="sdl-actions"><button type="button" data-act="copy" class="stl-copy">COPY MY PICKS</button></div>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>' +
        '<h3>WHAT MOVED<small>Nothing is lost: every saved pick keeps its value.</small></h3>' +
        '<ul class="stl-list">' +
          '<li>Round 8: CHIPS (coin sounds over a pile of chips), CABINET (colour themes as little machines), SCREENS (CRT looks, each card wearing its own) and BUTTONS (press feel, with keys to press).</li>' +
          '<li>Round 7: the backs are the deck\'s own cards enlarged x3; the holder is out; CARDS shows just the deck; style tickets show rarity, not text.</li>' +
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
        const text = 'Settings + Workshop lab, round 8:\n' + ROWS.filter(r => r[0] !== 'view').map(r => '- ' + r[1].charAt(0) + r[1].slice(1).toLowerCase() + ': ' + NAMES[r[0]][state[r[0]] || DEF[r[0]]]).join('\n');
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
