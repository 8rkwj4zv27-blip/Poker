"use strict";

/* ============================================================
   SETTINGS + WORKSHOP (docs/ui/SETTINGS_PLAN.md)

   Rebuilds the Settings sheet into one panel (This table, Play, Help,
   Sound, Display) from the game's own controls: every switch and choice
   row is MOVED (never copied), so it keeps its wiring and saves exactly
   as before. New here: Hand readout (settings.strength), Four-colour
   deck (settings.fourColour) and Volume (settings.volume, 0-10).

   Builds the WORKSHOP screen, opened from the home screen's Workshop key:
   seven tabs (Cards, Dealing, Showdown, Chips, Cabinet, Screens,
   Buttons), each with a preview of the real part. What isn't shown any
   more stays wired in an unseen attic, so every saved pick keeps working.
   ============================================================ */
(() => {
  const $id = id => document.getElementById(id);
  const sheet = $id('settings-sheet');
  const mainBody = sheet && sheet.querySelector(':scope > .sheet-body:not(#finishes-body)');
  const html = document.documentElement;

  /* ---- volume: one master gain on every audio context ----
     The game's sounds all connect to ctx.destination; that getter hands
     back a gain node in front of the real speaker. */
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
  if (!sheet || !mainBody) return;

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
  // HOW TO PLAY: the first-play tour (js/tutorial.js) again
  const tourKey = el('button', 'btn-secondary st-tour-key', 'Show');
  tourKey.type = 'button'; tourKey.id = 'replay-tour';
  tourKey.addEventListener('click', () => {
    const atTurn = typeof pendingHumanPlayer !== 'undefined' && !!pendingHumanPlayer
      && !$id('table-screen').classList.contains('hidden');
    if (atTurn) closeOverlays();
    Tour.replay();
    if (!atTurn) tourKey.textContent = 'At your next turn';
  });
  help.appendChild(row('How to play', 'A quick walk round the table and its keys.', tourKey));
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

  const TABS = [['cards','Cards'],['dealing','Dealing'],['showdown','Showdown'],['chips','Chips'],['bank','Bank'],['cabinet','Cabinet'],['screens','Screens'],['buttons','Buttons']];
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
  const keysPlate = (title, seg, hint) => { const box = el('div', 'sheet-section st-plate ws-opts'); box.appendChild(optField(title, seg, hint)); return box; };

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
    sayOn(cardsStage, b.name + (b.id === equippedBack() ? '  \u00b7  in use' : ''));
  }
  // the key's label is a fresh node each time (iOS left old glyphs behind)
  const label = (btn, t) => { btn.replaceChildren(document.createTextNode(t)); };
  function showBack(i){
    const b = BACKS[i]; if (!b) return;
    // browsing: the deck wears the back (put back on the way out unless used)
    document.documentElement.setAttribute('data-ds-back', b.id);
    const on = b.id === equippedBack();
    sayOn(cardsStage, b.name + (on ? '  ·  in use' : ''));
    label(backUse.b, on ? 'In use' : 'Use ' + b.name);
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

  /* ---- CHIPS, CABINET, SCREENS, BUTTONS (round 9): keys, not racks ----
     The owner (round 8): the rack suits CARDS; these four are settings,
     so they are choice keys (the Settings look), and a tap uses the pick
     at once. Each tab's preview is the real part doing its job. */
  const noteOf = (seg) => (seg.querySelector('.active') || {}).textContent || '';

  /* CHIPS: the game's own throw. While this tab is open the stage's felt
     is the coin world's #felt (the table's is parked, as the dealing stage
     borrows the deck), so a handful of real chips is thrown into a pot on
     it: the game's arcs, bounces and settling, its chip art at the chosen
     size, its coin sound. */
  const CW = window.CoinWorld;
  const chipStage = el('div', 'ws-stage ws-stage--chips');
  chipStage.innerHTML = '<div class="wss-box"><div class="wss-felt" data-wss-felt><div class="wss-tray"></div></div></div>' +
    '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>';
  pages.chips.appendChild(chipStage);
  const chipFelt = chipStage.querySelector('[data-wss-felt]');
  const SIZE_KEY = { '15':'m', '14':'ms', '13':'s', '12':'xs' };
  const sizeSeg = $id('tr-coins'), soundSeg = $id('coin-sound-seg');
  if (trSec){ const cf = fieldOf('tr-coins'); if (cf) cf.remove(); attic.appendChild(trSec); }
  const sf = fieldOf('coin-sound-seg');
  /* the skin (js/coin-world.js chip designs): paint on the same coin, so
     a tap repaints every chip where it lies and throws a fresh handful */
  const SKINS = [
    { id:'tint',  name:'Classic',    note:'The machine\u2019s own coloured coins.' },
    { id:'neon',  name:'Neon',       note:'Black coins with a lit tube: a stack glows in bands.' },
    { id:'mint',  name:'Peppermint', note:'Candy swirls on cream, a striped edge.' },
    { id:'dice',  name:'Dice',       note:'Die spots on every coin: one for the cheapest, six for the top.' },
    { id:'grin',  name:'Poker Face', note:'A face on every coin, happier the more it\u2019s worth.' }
  ];
  const skinNow = () => SKINS.some(x => x.id === settings.chipSkin) ? settings.chipSkin : 'tint';
  if (CW) CW.OPT.chipDesign = skinNow();
  const skinSeg = el('div', 'segmented compact ws-finish-seg'); skinSeg.setAttribute('role', 'group');
  SKINS.forEach(k0 => { const k = el('button', '', k0.name); k.type = 'button'; k.dataset.v = k0.id; skinSeg.appendChild(k); });
  const skinBox = keysPlate('Skin', skinSeg, null);
  const skinNote = el('div', 'hint ws-finish-note'); skinBox.querySelector('.field').appendChild(skinNote);
  pages.chips.appendChild(skinBox);
  function paintSkin(){
    const now = skinNow();
    skinSeg.querySelectorAll('button').forEach(k => k.classList.toggle('active', k.dataset.v === now));
    skinNote.textContent = (SKINS.find(x => x.id === now) || SKINS[0]).note;
  }
  skinSeg.addEventListener('click', e => {
    const k = e.target.closest('button'); if (!k) return;
    settings.chipSkin = k.dataset.v; saveSettings();
    if (CW){ CW.OPT.chipDesign = skinNow(); try{ CW.repaint(); }catch(err){} }
    paintSkin();
    setTimeout(() => { sayOn(chipStage, 'Skin: ' + k.textContent.trim()); throwChips(8); }, 0);
  });
  paintSkin();
  pages.chips.appendChild(keysPlate('Chip size', sizeSeg, 'Every chip, on the table and in your bank.'));
  pages.chips.appendChild(keysPlate('Coin sound', soundSeg, 'How the chips sound as they land, stack and pay out.'));
  if (sf) sf.remove();
  // a stage's felt is the coin world's #felt while its tab is open (CHIPS,
  // SHOWDOWN); the table's own is parked and given back on the way out
  let feltBorrowed = null, savedTray = null, throwGen = 0, loose = [];
  function borrowFelt(on, feltEl){
    const real = document.querySelector('#table-screen #felt, #felt:not([data-wss-felt])');
    if (on && !feltBorrowed){
      if (real) real.id = 'felt-parked';
      feltEl = feltEl || chipFelt;
      feltEl.id = 'felt';
      try{ savedTray = CW.tray(); CW.setTray(null); }catch(e){}
      feltBorrowed = feltEl;
    } else if (!on && feltBorrowed){
      clearChips();
      feltBorrowed.removeAttribute('id');
      const parked = $id('felt-parked'); if (parked) parked.id = 'felt';
      try{ CW.setTray(savedTray); CW.buildWalls(); }catch(e){}
      try{ const air = CW.airLayer && CW.airLayer(); if (air) air.style.filter = ''; }catch(e){}
      [CW.airLayer && CW.airLayer(), document.querySelector('.ct-shadows')].forEach(l => { if (l) l.style.transform = ''; });
      try{ if (CoinTable.on()) CoinTable.sync(); }catch(e){}
      feltBorrowed = null;
    }
  }
  function clearChips(){
    const z = CW && CW.zones['ws:pot'];
    if (z){ z.list.slice().forEach(bd => { try{ CW.removeBody(bd); bd.el.remove(); }catch(e){} }); delete CW.zones['ws:pot']; }
    loose.forEach(bd => { try{ CW.removeBody(bd); bd.el.remove(); }catch(e){} }); loose = [];
  }
  // the coin world reads the size and the sound from its options
  function chipOpts(){
    const v = (sizeSeg.querySelector('.active') || {}).dataset;
    CW.OPT.size = SIZE_KEY[(v && v.v) || '13'] || 's';
    CW.OPT.sfx = settings.coinSound || 'clay';
    CW.OPT.sound = settings.sound ? 'on' : 'off';
  }
  async function throwChips(n){
    if (!CW || !feltBorrowed) return;
    const gen = ++throwGen;
    clearChips(); chipOpts(); pinAir();
    try{ CW.Coin.unlock(); }catch(e){}
    CW.buildWalls();
    const w = CW.walls(); w.blocks.length = 0;          // nothing on this felt but the pot
    const r = feltBorrowed.getBoundingClientRect();
    const tray = feltBorrowed.querySelector('.wss-tray').getBoundingClientRect();
    const z = CW.zone('ws:pot', tray.left + tray.width / 2, tray.top + tray.height / 2 + 4, 9, 15, 30);
    const tiers = CW.TIERS();
    const items = [];
    for (let i = 0; i < n; i++){
      const chip = CW.makeChip(tiers[i % Math.min(4, tiers.length)]);
      const bd = CW.body(chip, r.left + r.width / 2 + CW.rr(-14, 14), r.bottom - 8, 0, CW.D());
      bd.fresh = true;
      items.push({ b:bd, to:{ x:z.cx + CW.rr(-6, 6), y:z.cy + CW.rr(-3, 3), z:0, zone:z, d:CW.D() } });
    }
    z.neat = false;
    try{ await CW.throwAll(items, 'lob'); }catch(e){}
    if (gen !== throwGen) return;
  }
  // the coin-sound keys play the game's three-coin preview: here the
  // throw is the preview, so that one is held back while the tab is open
  let coinPreview = null;
  function holdPreview(on){
    if (typeof CoinTable === 'undefined') return;
    if (on && !coinPreview){ coinPreview = CoinTable.preview; CoinTable.preview = () => {}; }
    else if (!on && coinPreview){ CoinTable.preview = coinPreview; coinPreview = null; }
  }
  // the size row was cut off from table-room.js's painter when it moved:
  // its active key is kept here
  sizeSeg.addEventListener('click', e => {
    const k = e.target.closest('button'); if (!k) return;
    sizeSeg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === k));
    setTimeout(() => { sayOn(chipStage, 'Chip size: ' + k.textContent.trim()); throwChips(8); }, 0);
  });
  soundSeg.addEventListener('click', e => {
    const k = e.target.closest('button'); if (!k) return;
    setTimeout(() => { sayOn(chipStage, 'Coin sound: ' + k.textContent.trim()); throwChips(8); }, 0);
  });
  // the size key the table is using now
  try{ const now = TableRoom.opts().coins; sizeSeg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.v === now)); }catch(e){}

  /* BANK (v0.64.0): how your bank fills when you sit down at a table
     (js/bank-load.js). The stage is your bank's own box (.bl-box, the
     table's finish) on a strip of the dashboard, loading a Quick Deal's
     $1,000 the chosen way; the caption counts it in. A tap on the stage
     plays it again. */
  const LOADS = [
    { id:'count', name:'Count in', note:'The chips drop in one by one, back row first, and the stack counts up as they land.' },
    { id:'tray',  name:'Tray in',  note:'The whole rack comes down into the box on its tray and locks in with a clunk.' }
  ];
  const loadNow = () => LOADS.some(x => x.id === settings.bankLoad) ? settings.bankLoad : 'count';
  const bankStage = el('div', 'ws-stage ws-stage--bank');
  bankStage.innerHTML = '<div class="wss-dash wss-bank" data-wss-bank><div class="bl-box"><div class="hoard-well"></div></div></div>' +
    '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>';
  pages.bank.appendChild(bankStage);
  const bankBox = bankStage.querySelector('.bl-box');
  const loadSeg = el('div', 'segmented compact ws-finish-seg'); loadSeg.setAttribute('role', 'group');
  LOADS.forEach(k0 => { const k = el('button', '', k0.name); k.type = 'button'; k.dataset.v = k0.id; loadSeg.appendChild(k); });
  const loadBox = keysPlate('Filling your bank', loadSeg, null);
  const loadNote = el('div', 'hint ws-finish-note'); loadBox.querySelector('.field').appendChild(loadNote);
  pages.bank.appendChild(loadBox);
  function paintLoad(){
    const now = loadNow();
    loadSeg.querySelectorAll('button').forEach(k => k.classList.toggle('active', k.dataset.v === now));
    loadNote.textContent = (LOADS.find(x => x.id === now) || LOADS[0]).note;
  }
  let loadGen = 0;
  function playLoad(){
    if (typeof BankLoad === 'undefined' || !BankLoad) return;
    const gen = ++loadGen, l = LOADS.find(x => x.id === loadNow()) || LOADS[0];
    const money = v => '$' + Math.round(v).toLocaleString('en-US');
    sayOn(bankStage, l.name + '  \u00b7  ' + money(l.id === 'count' ? 0 : 1000));
    try{ CW.Coin.unlock(); }catch(e){}
    BankLoad.preview(bankBox, l.id, { chips:1000, onLand:f => { if (gen === loadGen) sayOn(bankStage, l.name + '  \u00b7  ' + money(1000 * f)); } });
  }
  loadSeg.addEventListener('click', e => {
    const k = e.target.closest('button'); if (!k) return;
    settings.bankLoad = k.dataset.v; saveSettings();
    paintLoad(); setTimeout(playLoad, 0);
  });
  bankStage.querySelector('[data-wss-bank]').addEventListener('click', playLoad);
  paintLoad();

  /* SHOWDOWN (round 10): two controls instead of five.
     WHEN IT SMASHES: the four keys from before (monster pots, big pots,
     every win, off). SMASH STYLE: four named presets, each setting force,
     bounces, heat and pickup together (the four rows stay wired, unseen).
     The preview is a pot on its own felt that cooks and goes off: the coins
     are the coin world's, the heat is the showdown's own palette and tint,
     the bang is the showdown's own explosion (explode() copied from
     js/showdown.js, reading its options through Showdown.opt), and they
     pick up into your bank as you've set. Later, showdown.js could offer
     this as a call, so this copy can go. */
  const STYLES = [
    { id:'gentle', name:'Simmer',    note:'A low heat, a soft pop, a quick settle.', v:{ sdForce:'big',  sdBounce:'few',     sdHeat:'ember', sdPickup:'flip' } },
    { id:'big',    name:'Big bang',  note:'The machine’s own: ember heat, a big bang.', v:{ sdForce:'huge', sdBounce:'lots',    sdHeat:'ember', sdPickup:'flip' } },
    { id:'wild',   name:'Wild',      note:'All-in red, full force, bouncing everywhere.', v:{ sdForce:'max',  sdBounce:'endless', sdHeat:'allin', sdPickup:'ripple' } },
    { id:'white',  name:'White hot', note:'Cooked to white, then all snapped up at once.', v:{ sdForce:'max',  sdBounce:'lots',    sdHeat:'white', sdPickup:'all' } }
  ];
  const SEG_OF = { sdForce:'sd-force-seg', sdBounce:'sd-bounce-seg', sdHeat:'sd-heat-seg', sdPickup:'sd-pickup-seg' };
  const styleNow = () => STYLES.find(st => Object.keys(st.v).every(k => settings[k] === st.v[k]));
  const sdStage = el('div', 'ws-stage ws-stage--showdown');
  sdStage.innerHTML = '<div class="wss-box"><div class="wss-felt" data-wss-felt><div class="wss-tray ct-tray"><i class="sd-heatbed"></i></div></div></div>' +
    '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say></span></div>';
  pages.showdown.appendChild(sdStage);
  const sdFelt = sdStage.querySelector('[data-wss-felt]'), sdTray = sdStage.querySelector('.wss-tray');
  // the key works like AWARD POT at a table: hold it and the pot cooks,
  // let go and it bangs (a tap is a quick flare and a smaller bang)
  const again = el('button', 'btn-secondary ws-replay ws-again'); again.type = 'button';
  const againRow = el('div', 'ws-use'); againRow.appendChild(again); pages.showdown.appendChild(againRow);
  const smashSeg = $id('sd-smash-seg');
  const smf = fieldOf('sd-smash-seg');
  pages.showdown.appendChild(keysPlate('When it smashes', smashSeg, 'Which of your wins cook the pot and go off.'));
  if (smf) smf.remove();
  const styleSeg = el('div', 'segmented compact ws-style-seg'); styleSeg.setAttribute('role', 'group');
  STYLES.forEach(st => { const k = el('button', '', st.name); k.type = 'button'; k.dataset.v = st.id; styleSeg.appendChild(k); });
  const styleBox = keysPlate('Smash style', styleSeg, null);
  const styleNote = el('div', 'hint ws-finish-note'); styleBox.querySelector('.field').appendChild(styleNote);
  pages.showdown.appendChild(styleBox);
  // the four rows the presets set: kept wired (showdown.js saves them), unseen
  ['sd-force-seg', 'sd-bounce-seg', 'sd-heat-seg', 'sd-pickup-seg'].forEach(id => { const f = fieldOf(id); if (f) attic.appendChild(f); });
  function paintStyle(){
    const now = styleNow();
    styleSeg.querySelectorAll('button').forEach(k => k.classList.toggle('active', !!now && k.dataset.v === now.id));
    styleNote.textContent = now ? now.note : 'Your own mix from before. Pick a style to replace it.';
  }
  styleSeg.addEventListener('click', e => {
    const k = e.target.closest('button'); if (!k) return;
    const st = STYLES.find(x => x.id === k.dataset.v); if (!st) return;
    Object.entries(st.v).forEach(([key, v]) => { const b = document.querySelector('#' + SEG_OF[key] + ' [data-v="' + v + '"]'); if (b) b.click(); });
    paintStyle(); setTimeout(potReady, 0);
  });
  smashSeg.addEventListener('click', e => { if (e.target.closest('button')) setTimeout(potReady, 0); });

  // js/showdown.js: the heat palettes and the coins' tint, unchanged
  const HEAT = {
    ember:['#2A0A06','#5E1208','#921D0B','#C42F0E','#E24A12','#F46F18','#FF9A26','#FFC447','#FFE38A'],
    allin:['#2A0707','#4F0D0E','#761416','#9C1C1E','#C02627','#D9534A','#E8745F','#F29A82','#FFC2AE'],
    white:['#2A0A06','#6B1509','#A8260D','#DB4513','#F47C2B','#FFAA5C','#FFD097','#FFEBCF','#FFFFFF']
  };
  const sdOpt = k => { try{ return Showdown.opt(k); }catch(e){ return null; } };
  const heatColour = k => { const pal = HEAT[sdOpt('cheat')] || HEAT.ember; return pal[Math.max(0, Math.min(pal.length - 1, Math.round(k * (pal.length - 1))))]; };
  const tintOf = k => 'sepia(' + (.8 * k).toFixed(2) + ') saturate(' + (1 + 2.6 * k).toFixed(2) + ') hue-rotate(' + (-28 * k).toFixed(0) + 'deg) brightness(' + (1 + .12 * k).toFixed(2) + ')';
  const sdSfx = (k, v, p) => { try{ if (settings.sound) CW.sfx(k, v, p); }catch(e){} };
  const rr = (a, b) => a + Math.random() * (b - a);
  const air = () => CW.airLayer && CW.airLayer();
  function heat(k){
    sdTray.style.setProperty('--hc', heatColour(k)); sdTray.style.setProperty('--hk', k.toFixed(2));
    sdTray.classList.toggle('sd-hot', k > 0);
    const a = air(); if (!a) return;
    a.style.transition = 'none';
    a.style.filter = k > 0 ? tintOf(k) + ' drop-shadow(0 0 ' + (1 + 4 * k).toFixed(1) + 'px ' + heatColour(k) + ')' : '';
  }
  function coolCoins(ms){
    const a = air(); if (!a) return;
    const N = 4; let n = 0;
    const t = setInterval(() => { n++; a.style.filter = n < N ? tintOf(1 - n / N) : ''; if (n >= N) clearInterval(t); }, ms / N);
  }
  // js/showdown.js explode(), copied: the bang. Changes: the ground is this
  // felt (no dashboard dock, no solid cards), the pot's middle is this
  // tray's, and the whole burst is scaled to the felt: every speed by the
  // square root of the felt's size against the table's (TABLE_H), so the
  // coins fly, arc and slide the same share of the felt as at a table.
  const TABLE_H = 560;   // the table's felt on a 393x852 phone, about
  function explode(bodies, p, cx, cy){
    const W = CW, d = W.D(), r = d / 2;
    const F = W.walls().felt;
    const G_L = F.L + r, G_R = F.R - r, G_T = F.T + d, G_B = F.B - 2;
    const screenTop = sdFelt.getBoundingClientRect().top + 4;
    const frame = sdOpt('cwalls') !== 'rails';
    const f = { big:1, huge:1.2, max:1.45 }[sdOpt('cforce')] || 1.2;
    const E = { few:.42, lots:.56, endless:.7 }[sdOpt('cbounce')] || .56;
    const maxB = { few:3, lots:5, endless:9 }[sdOpt('cbounce')] || 5;
    const roll = sdOpt('croll') !== 'off';
    const GRAV = 2300, FRICT = 820, ROLLF = 330;
    const power = Math.max(.5, p);
    const sc = Math.sqrt(Math.min(1, (F.B - F.T) / TABLE_H));
    const coins = bodies.map((b, i) => {
      if (b.zone) W.removeFromZone(b);
      W.active.delete(b);
      const cls = Math.random(), sp = (cls < .2 ? rr(360, 520) : cls < .8 ? rr(200, 360) : rr(90, 200)) * f * power;
      const dx = b.x - cx + rr(-8, 8), dy = b.y - cy + rr(-5, 5), ang = Math.atan2(dy, dx) + rr(-.8, .8);
      const vx = Math.cos(ang) * sp * sc, vy = Math.sin(ang) * sp * .75 * sc;
      const vz = rr(780, 1150) * (.75 + .35 * power) * (f > 1 ? 1 + (f - 1) * .5 : 1) * sc;
      Object.assign(b, { zone:null, target:{}, opts:{}, rx:0, tilt:1, state:'air', axis:'toss', spinRate:rr(3, 6), spinA:rr(0, 6), spinDir:Math.random() < .5 ? -1 : 1 });
      return { b, x:b.x, y:b.y, z:Math.max(2, b.z), vx, vy, vz, phase:'air', bounces:0, t:0, snd:0, rolling:false, wait:i * rr(0, 6) };
    });
    const hit = (c, kind, v) => { const now = performance.now(); if (now - c.snd < 55) return; c.snd = now; sdSfx(kind, Math.min(1, v), rr(.92, 1.15)); };
    const walls = c => {
      let w = false;
      if (c.x < G_L){ c.x = G_L; c.vx = Math.abs(c.vx) * .62; w = true; }
      if (c.x > G_R){ c.x = G_R; c.vx = -Math.abs(c.vx) * .62; w = true; }
      if (c.y < G_T){ c.y = G_T; c.vy = Math.abs(c.vy) * .62; w = true; }
      if (c.y > G_B){ c.y = G_B; c.vy = -Math.abs(c.vy) * .62; w = true; }
      if (w) hit(c, 'wall', Math.hypot(c.vx, c.vy) / 500 + .3);
    };
    const shadow = W.OPT.shadow; W.OPT.shadow = 'on';
    let stopUntil = performance.now() + (+sdOpt('cstop') || 0);
    return new Promise(resolve => {
      const t0 = performance.now(); let last = t0;
      const tick = now => {
        let dt = Math.min(.034, (now - last) / 1000); last = now;
        if (now < stopUntil) dt = 0;
        let live = 0;
        const steps = 2, h = dt / steps;
        coins.forEach(c => {
          const b = c.b;
          if (c.phase === 'rest') return;
          live++;
          if (c.wait > 0){ c.wait -= dt * 1000; W.draw(b); return; }
          for (let s = 0; s < steps && h > 0; s++){
            c.t += h;
            if (c.phase === 'air'){
              c.x += c.vx * h; c.y += c.vy * h; c.vz -= GRAV * h; c.z += c.vz * h;
              if (frame && c.vz > 0 && c.y - c.z - d * 1.1 < screenTop){ c.z = c.y - screenTop - d * 1.1; c.vz = -Math.abs(c.vz) * .55; c.vx += rr(-120, 120); hit(c, 'wall', .8); }
              walls(c);
              b.spinA += (b.spinDir || 1) * b.spinRate * 2 * Math.PI * h;
              if (c.z <= 0){
                c.z = 0;
                const v = -c.vz;
                if (v > 150 * sc && c.bounces < maxB){
                  c.bounces++;
                  c.vz = v * E * rr(.88, 1.08); c.vx *= .8; c.vy *= .8;
                  c.vx += rr(-40, 40); c.vy += rr(-25, 25);
                  b.spinRate = Math.max(1.5, b.spinRate * .82); b.sq = .08;
                  hit(c, c.bounces === 1 ? 'land' : 'bounce', v / 1200 + .2);
                  if (c.bounces === 1 && v > 650 && W.puff) W.puff(c.x, c.y, v);
                } else {
                  c.vz = 0; c.phase = 'slide'; b.sq = .06;
                  c.rolling = roll && Math.hypot(c.vx, c.vy) > 70 * sc && Math.random() < .45;
                  hit(c, 'land', .6);
                }
              }
            } else if (c.phase === 'slide'){
              const sp = Math.hypot(c.vx, c.vy), dec = (c.rolling ? ROLLF : FRICT) * h;
              if (sp <= dec || sp < 10){ c.vx = c.vy = 0; c.phase = 'wobble'; c.t = 0; break; }
              c.vx *= (sp - dec) / sp; c.vy *= (sp - dec) / sp;
              c.x += c.vx * h; c.y += c.vy * h;
              walls(c);
              if (c.rolling){ b.state = 'air'; b.axis = 'side'; b.spinRate = 1; b.spinA += sp * h * .09; if (now - c.snd > 120){ c.snd = now; sdSfx('roll', .45); } }
              else { b.state = 'slide'; b.tilt = 1; }
            } else if (c.phase === 'wobble'){
              const seq = [.55, 1, .78, 1, .92], i = Math.min(seq.length - 1, Math.floor(c.t / .075));
              b.state = 'rock'; b.tilt = seq[i];
              if (c.t >= .075 * seq.length){ c.phase = 'rest'; b.state = 'rest'; b.tilt = 1; sdSfx('rock', .7); }
            }
          }
          b.x = c.x; b.y = c.y; b.z = Math.max(0, c.z); b.vx = b.vy = b.vz = 0;
          if (b.sq > 0){ b.sq -= dt; }
          W.draw(b);
        });
        if (now - t0 > 4800){
          coins.forEach(c => { if (c.phase !== 'rest'){ c.z = 0; c.phase = 'rest'; c.b.x = c.x; c.b.y = c.y; c.b.z = 0; c.b.state = 'rest'; c.b.tilt = 1; W.draw(c.b); } });
          live = 0;
        }
        if (live && !motionOff()) requestAnimationFrame(tick);
        else { W.OPT.shadow = shadow; resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }
  /* The coin world draws on fixed layers over the whole screen, so while
     a felt is borrowed they follow the Workshop's scroll (else the chips
     stay put on the glass as the page moves under them). */
  let airBase = 0;
  const coinLayers = () => [air(), document.querySelector('.ct-shadows')].filter(Boolean);
  function pinAir(){ airBase = wsScreen.scrollTop; coinLayers().forEach(l => { l.style.transform = ''; }); }
  wsScreen.addEventListener('scroll', () => {
    if (!feltBorrowed) return;
    const d = airBase - wsScreen.scrollTop;
    coinLayers().forEach(l => { l.style.transform = d ? 'translateY(' + d + 'px)' : ''; });
  }, { passive:true });
  // before a bang: the coins and the walls move to where the felt is now
  function rebase(){
    const d = airBase - wsScreen.scrollTop;
    if (d){ loose.forEach(b => { b.y += d; CW.draw(b); }); }
    pinAir(); CW.buildWalls(); CW.walls().blocks.length = 0;
  }
  // after they settle, the coins just go: each fades out where it lies
  function vanish(bodies){
    return new Promise(res => {
      if (!bodies.length){ res(); return; }
      const order = bodies.slice().sort(() => Math.random() - .5), step = Math.min(45, 700 / bodies.length);
      order.forEach((b, i) => setTimeout(() => {
        b.el.style.transition = 'opacity 260ms steps(4,end)'; b.el.style.opacity = '0';
        if (b.shadow) b.shadow.style.opacity = '0';
        if (i % 3 === 0) sdSfx('rock', .35, rr(1.2, 1.6));
      }, i * step));
      setTimeout(() => { bodies.forEach(b => { try{ CW.removeBody(b); b.el.remove(); }catch(e){} }); res(); }, order.length * step + 300);
    });
  }
  let smashGen = 0, busy2 = false;
  const sleepMs = ms => new Promise(r => setTimeout(r, ms));
  const live = gen => gen === smashGen && feltBorrowed === sdFelt;
  function paintKey(){
    const on = settings.sdSmash !== 'off';
    again.replaceChildren(document.createTextNode(busy2 ? (on ? 'Going off…' : 'Paying out…') : (on ? 'Hold to smash' : 'Tap to pay out')));
    again.disabled = busy2;
  }
  function sayPot(){
    const st = styleNow();
    sayOn(sdStage, settings.sdSmash !== 'off' ? (st ? st.name : 'Your own mix') + '  ·  ' + noteOf(smashSeg).trim() : 'Off: the pot goes straight into your bank');
  }
  // a fresh pot in the tray, waiting for the key
  function potReady(){
    if (feltBorrowed !== sdFelt) return;
    sayPot();
    if (busy2) return;
    ++smashGen;
    clearChips(); heat(0); chipOpts(); pinAir();
    CW.buildWalls(); CW.walls().blocks.length = 0;
    const tr = sdTray.getBoundingClientRect(), cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2 + 4;
    const tiers = CW.TIERS();
    for (let i = 0; i < 22; i++){
      const chip = CW.makeChip(tiers[i % Math.min(4, tiers.length)]);
      const a = rr(0, Math.PI * 2), rad = Math.sqrt(Math.random());
      const bd = CW.body(chip, cx + Math.cos(a) * rad * (tr.width / 2 - 14), cy + Math.sin(a) * rad * (tr.height / 2 - 10), 0, CW.D());
      bd.state = 'rest'; loose.push(bd); CW.draw(bd);
    }
    paintKey();
  }
  // the cook while the key is held: js/showdown.js chargeGate's steps,
  // heat and shiver; a tap is its flare (a quick cook to half heat)
  const TAP_POWER = .8, FULL_POWER = 1.35;
  let cook = null;
  function shiver(k){ const base = loose.map(b => [b.x, b.y]); return () => loose.forEach((b, i) => { if (!base[i]) return; b.x = base[i][0] + rr(-1, 1) * k() * 1.5; b.y = base[i][1] + rr(-1, 1) * k(); CW.draw(b); }); }
  function cookStart(){
    if (busy2 || cook || feltBorrowed !== sdFelt) return;
    try{ CW.Coin.unlock(); Sound.unlock(); }catch(e){}
    rebase();
    const N = sdOpt('csteps') === 'smooth' ? 24 : (+sdOpt('csteps') || 9), every = (+sdOpt('ctime') || 1000) / N;
    const c = cook = { n:0, N, t0:performance.now(), k:0, timers:[] };
    const shake = shiver(() => c.k);
    c.timers.push(setTimeout(() => {
      if (cook !== c) return;
      c.timers.push(setInterval(() => {
        if (c.n < N){ c.n++; c.k = c.n / N; heat(c.k); sdSfx('stack', .25 + .4 * c.k, 1 + c.n * .05); if (c.n === N) sdSfx('stack', 1, 2.1); }
        else sdSfx('stack', .3, rr(1.8, 2.2));
      }, every));
      c.timers.push(setInterval(shake, 60));
    }, 220));
    c.stop = () => c.timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  }
  async function cookEnd(){
    const c = cook; if (!c) return;
    cook = null; c.stop();
    busy2 = true; paintKey();
    const gen = smashGen;
    const smashOn = settings.sdSmash !== 'off';
    let power = TAP_POWER;
    if (smashOn && !motionOff()){
      if (c.n < 2){
        // a tap: the flare
        const shake = shiver(() => c.k);
        for (let n = 1; n <= 5; n++){ c.k = n / 5 * .55; heat(c.k); shake(); if (n % 2) sdSfx('knock', .5, 1 + n * .1); await sleepMs(60); if (!live(gen)) return; }
        await sleepMs(90);
      } else power = TAP_POWER + (FULL_POWER - TAP_POWER) * c.n / c.N;
      if (!live(gen)) return;
      await bang(power, gen); if (!live(gen)) return;
    }
    const going = loose.slice(); loose = [];
    await vanish(going); if (!live(gen)) return;
    await sleepMs(350); if (!live(gen)) return;
    busy2 = false; potReady();
  }
  async function bang(power, gen){
    const tr = sdTray.getBoundingClientRect(), cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2 + 4;
    const bed = sdTray.querySelector('.sd-heatbed');
    bed.classList.remove('sd-flash'); void bed.offsetWidth; bed.classList.add('sd-flash');
    sdTray.classList.remove('sd-hot');
    const a = air(); if (a) a.style.filter = tintOf(1);
    sdStage.animate([{ transform:'translate(0,0)' }, { transform:'translate(2px,-2px)' }, { transform:'translate(-2px,1px)' }, { transform:'none' }], { duration:220, easing:'steps(4,end)' });
    sdSfx('thump', 1, .65); sdSfx('knock', 1, .7); setTimeout(() => sdSfx('thump', .8, .4), 60);
    for (let j = 0; j < 6; j++) setTimeout(() => sdSfx('stack', .9, rr(1, 1.6)), 20 + j * 25);
    coolCoins(650);
    await explode(loose, power, cx, cy); if (!live(gen)) return;
    await sleepMs(+sdOpt('csettle') || 450);
  }
  again.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); cookStart(); });
  addEventListener('pointerup', () => { if (cook) cookEnd(); });
  addEventListener('pointercancel', () => { if (cook) cookEnd(); });
  again.oncontextmenu = e => { e.preventDefault(); return false; };
  // a keyboard press: a tap
  again.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !cook){ e.preventDefault(); cookStart(); cookEnd(); } });
  // leaving the tab mid-smash: let the next pot start clean
  function sdReset(){ if (cook){ cook.stop(); cook = null; } busy2 = false; ++smashGen; }

  /* CABINET: four keys, each painted in its own theme; a tap recolours the
     whole machine, which is the preview. */
  const themeSeg = $id('theme-seg');
  const tf = fieldOf('theme-seg');
  const cabCap = captionOnly();
  pages.cabinet.appendChild(cabCap);
  pages.cabinet.appendChild(keysPlate('Colour', themeSeg, 'The whole machine: the case, the felt, the rail and the gold.'));
  if (tf) tf.remove();
  themeSeg.addEventListener('click', e => { const k = e.target.closest('button'); if (k) setTimeout(() => sayOn(cabCap, k.textContent.trim() + '  ·  in use'), 0); });

  /* SCREENS: the table's own readouts, cycling real lines; six keys for
     the looks, each applied to every screen at once. */
  const SETS = (typeof Finishes !== 'undefined' && Finishes.sets) || [];
  const crtSet = SETS.find(x => x.attr === 'finishCrt'), pressSet = SETS.find(x => x.attr === 'finishPress');
  const finishNow = attr => document.documentElement.dataset[attr] || '';
  function finishKeys(set, label, hint, after){
    const seg = el('div', 'segmented compact ws-finish-seg');
    seg.setAttribute('role', 'group');
    set.options.forEach(o => { const k = el('button', o.id === finishNow(set.attr) ? 'active' : '', o.name); k.type = 'button'; k.dataset.v = o.id; seg.appendChild(k); });
    const box = keysPlate(label, seg, hint);
    const note = el('div', 'hint ws-finish-note'); box.querySelector('.field').appendChild(note);
    const paintNote = () => { const o = set.options.find(x => x.id === finishNow(set.attr)) || set.options[0]; note.textContent = o.note; };
    seg.addEventListener('click', e => {
      const k = e.target.closest('button'); if (!k) return;
      Finishes.choose(set.attr, k.dataset.v);
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === k));
      paintNote(); if (after) after(k);
    });
    paintNote();
    return box;
  }
  const LINES = [
    ['Dealer ready', 'Hand scanner ready', '$0', '$1,000'],
    ['Your turn · 20 to call', 'Pair of kings', '$20', '$980'],
    ['Shark raises to 60', 'Two pair, kings and fives', '$60', '$940'],
    ['You win $240', 'Full house, kings over fives', '$0', '$1,180']
  ];
  const scrStage = el('div', 'ws-stage ws-stage--screens');
  scrStage.innerHTML =
    '<div class="wss-readouts">' +
      '<div class="crt wss-ro-banner" data-ink="live"></div>' +
      '<div class="crt wss-ro-hand"></div>' +
      '<div class="wss-ro-row"><div class="crt wss-ro-bet" data-ink="money"><span class="crt-caption">Bet</span><span class="crt-figure"></span></div>' +
        '<div class="crt wss-ro-stack" data-ink="money"><span class="crt-caption">Stack</span><span class="crt-figure crt-figure--lg"></span></div></div>' +
    '</div>';
  pages.screens.appendChild(scrStage);
  if (crtSet) pages.screens.appendChild(finishKeys(crtSet, 'Look', null, null));
  let lineAt = 0, lineTimer = 0;
  function paintLines(){
    const L = LINES[lineAt % LINES.length];
    scrStage.querySelector('.wss-ro-banner').textContent = L[0];
    scrStage.querySelector('.wss-ro-hand').textContent = L[1];
    scrStage.querySelector('.wss-ro-bet .crt-figure').textContent = L[2];
    scrStage.querySelector('.wss-ro-stack .crt-figure').textContent = L[3];
  }
  function cycleLines(on){
    clearInterval(lineTimer); lineTimer = 0;
    if (on){ paintLines(); lineTimer = setInterval(() => { lineAt++; paintLines(); }, 2600); }
  }

  /* BUTTONS: the real console keys and a small and a standard key, to
     press; choosing a feel presses them once so it shows straight away. */
  const keyStage = el('div', 'ws-stage ws-stage--keys');
  keyStage.innerHTML =
    '<div class="wss-console"><div class="wss-actions"><button class="btn-fold" type="button">Fold</button><button class="btn-check" type="button">Check</button><button class="btn-raise" type="button">Raise</button></div>' +
    '<div class="wss-keys"><button class="icon-btn" type="button" aria-label="A small key">⚙</button><button class="btn-secondary" type="button">Standard key</button></div></div>' +
    '<div class="crt wss-caption" data-crt-quiet><span class="crt-line" data-wss-say>Press any key to feel it.</span></div>';
  pages.buttons.appendChild(keyStage);
  function demoPress(){
    if (motionOff()) return;
    const ks = [...keyStage.querySelectorAll('.wss-actions button')];
    ks.forEach((k, i) => setTimeout(() => {
      const r = k.getBoundingClientRect(), o = { bubbles:true, cancelable:true, pointerId:9, button:0, clientX:r.left + r.width / 2, clientY:r.top + r.height / 2 };
      k.dispatchEvent(new PointerEvent('pointerdown', o));
      setTimeout(() => k.dispatchEvent(new PointerEvent('pointerup', o)), 150);
    }, 120 + i * 260));
  }
  if (pressSet) pages.buttons.appendChild(finishKeys(pressSet, 'Press', null, k => { sayOn(keyStage, k.textContent.trim() + ': press any key to feel it.'); demoPress(); }));
  const fe = $id('finishes-entry'); if (fe) attic.appendChild(fe);

  /* ---- held space (owner, round 9): nothing moves when text changes ----
     Every line whose text changes while a tab is in use is given the
     height of the longest thing it can ever say, measured on this phone at
     its real width, so swapping options never pushes anything else. */
  const slots = [];
  const hold = (box, texts, write) => slots.push({ box, texts, write:write || ((n, t) => { n.textContent = t; }) });
  const writeSay = (n, t) => { const c = n.querySelector('[data-wss-say]'); if (c) c.textContent = t; };
  function reserve(scope){
    slots.forEach(sl => {
      if (!scope.contains(sl.box)) return;
      const w = sl.box.getBoundingClientRect().width; if (!w) return;
      const probe = sl.box.cloneNode(true);
      probe.removeAttribute('id');
      probe.style.cssText += ';position:absolute;left:-9999px;top:0;visibility:hidden;min-height:0;height:auto;box-sizing:border-box;width:' + w + 'px';
      sl.box.parentNode.appendChild(probe);
      let max = 0;
      (typeof sl.texts === 'function' ? sl.texts() : sl.texts).forEach(t => { sl.write(probe, t); max = Math.max(max, probe.getBoundingClientRect().height); });
      probe.remove();
      sl.box.style.boxSizing = 'border-box';
      sl.box.style.minHeight = Math.ceil(max) + 'px';   // exact, rounded up: a fraction over still pushed
    });
  }
  const dot = '  ·  ';
  hold(cardsStage.querySelector('.wss-caption'), () => BACKS.flatMap(b => [b.name, b.name + dot + 'in use']), writeSay);
  hold(backUse.n, ['This back is on every face-down card.', 'Flick through them. Nothing changes until you tap Use.']);
  hold(dealStage.querySelector('.wss-caption'), () => STY.map(x => x.note), writeSay);
  hold(mixUse.n, () => [STY.length + ' of ' + STY.length + ' styles in the mix. Tap to take it out.', STY.length + ' of ' + STY.length + ' styles in the mix. Tap to deal with it in your games.']);
  const SIZES = [...sizeSeg.querySelectorAll('button')].map(x => x.textContent.trim());
  const SOUNDS = [...soundSeg.querySelectorAll('button')].map(x => x.textContent.trim());
  hold(chipStage.querySelector('.wss-caption'), () => SKINS.flatMap(k => SIZES.flatMap(z => SOUNDS.map(o => 'Skin: ' + k.name + dot + z + dot + o))).concat(SIZES.map(z => 'Chip size: ' + z), SOUNDS.map(o => 'Coin sound: ' + o), SKINS.map(k => 'Skin: ' + k.name)), writeSay);
  hold(skinNote, () => SKINS.map(k => k.note));
  hold(cabCap.querySelector('.wss-caption'), () => [...themeSeg.querySelectorAll('button')].map(x => x.textContent.trim() + dot + 'in use'), writeSay);
  hold(keyStage.querySelector('.wss-caption'), () => (pressSet ? pressSet.options.map(o => o.name + ': press any key to feel it.') : []).concat('Press any key to feel it.'), writeSay);
  pages.screens.querySelectorAll('.ws-finish-note').forEach(n => hold(n, () => crtSet ? crtSet.options.map(o => o.note) : []));
  pages.buttons.querySelectorAll('.ws-finish-note').forEach(n => hold(n, () => pressSet ? pressSet.options.map(o => o.note) : []));
  ['wss-ro-banner', 'wss-ro-hand'].forEach((c, i) => hold(scrStage.querySelector('.' + c), LINES.map(L => L[i])));
  hold(sdStage.querySelector('.wss-caption'), () => STYLES.concat([{ name:'Your own mix' }]).flatMap(st => [...smashSeg.querySelectorAll('button')].map(x => st.name + dot + x.textContent.trim())).concat('Off: the pot goes straight into your bank'), writeSay);
  hold(styleNote, () => STYLES.map(st => st.note).concat('Your own mix from before. Pick a style to replace it.'));
  addEventListener('resize', () => { if (!wsScreen.classList.contains('hidden')) reserve(pages[tab]); });

  /* ---- tabs, opening, closing ---- */
  let tab = 'cards';
  function leaving(){
    sdReset(); borrowDeck(null); borrowFelt(false); holdPreview(false); cycleLines(false);
    document.documentElement.setAttribute('data-ds-back', equippedBack());
  }
  function setTab(k){
    tab = k;
    tabRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.wsTab === k));
    Object.keys(pages).forEach(p => pages[p].classList.toggle('is-on', p === k));
    reserve(pages[k]);
    leaving();
    if (k === 'cards') showBack(backRack.index);
    else if (k === 'dealing'){ borrowDeck(dealStage); setTimeout(() => showStyle(styleRack.index, true), 250); }
    else if (k === 'chips'){ borrowFelt(true); holdPreview(true); sayOn(chipStage, 'Skin: ' + noteOf(skinSeg).trim() + '  ·  ' + noteOf(sizeSeg).trim() + '  ·  ' + noteOf(soundSeg).trim()); setTimeout(() => throwChips(8), 200); }
    else if (k === 'bank') setTimeout(playLoad, 250);
    else if (k === 'showdown'){ borrowFelt(true, sdFelt); holdPreview(true); paintStyle(); paintKey(); setTimeout(potReady, 250); }
    else if (k === 'cabinet') sayOn(cabCap, noteOf(themeSeg).trim() + '  ·  in use');
    else if (k === 'screens') cycleLines(true);
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
    leaving();
    $id('home').classList.remove('hidden');
    try{ reconstructMainMenu(); }catch(e){}
  }

  /* ---- THE HOME KEY: Custom Game's slab with a gold line inside the
     edge and a gold stud each side, under Quick Deal and Hand Rankings */
  const homeKey = el('button', 'pc-button pc-button-secondary wk-trim',
    '<span class="pc-lamp is-amber wk-lamp" aria-hidden="true"></span><span class="wk-stud" aria-hidden="true"></span>Workshop' +
    '<span class="wk-stud" aria-hidden="true"></span><span class="pc-lamp is-amber wk-lamp" aria-hidden="true"></span>');
  homeKey.type = 'button'; homeKey.id = 'open-workshop';
  homeKey.addEventListener('click', openWorkshop);
  function placeKey(){
    const bay = document.querySelector('#menu-contraption .pc-control-bay');
    if (bay) bay.appendChild(homeKey);
  }
  // the key makes the cabinet taller: the hero gives up just what the phone
  // needs (never below its compact 292px), so the cabinet isn't cut off.
  // A phone too short even for that (notch and home bar included) shrinks
  // the whole cabinet to fit: the main menu never scrolls.
  function fitHome(){
    const home = $id('home'), hero = home && home.querySelector('.hero');
    const cab = $id('menu-contraption');
    if (!hero || home.classList.contains('hidden')) return;
    // Reduce Motion gives everything a hair of a transition, which would
    // leave these sizes a frame behind the measuring below
    hero.style.transition = 'none';
    hero.style.flexBasis = hero.style.minHeight = '';
    if (cab) cab.style.scale = '';
    if (!matchMedia('(orientation:portrait) and (max-height:700px)').matches){
      const over = home.scrollHeight - home.clientHeight;
      if (over > 0){
        // With CONTINUE in the bay (07-ui-wiring.js, refreshHomeContinue) the
        // POKER FACES screen gives up more of its empty felt.
        const floor = home.querySelector('#menu-contraption.has-continue') ? 236 : 292;
        const h = Math.max(floor, Math.floor(hero.getBoundingClientRect().height - over));
        hero.style.flexBasis = hero.style.minHeight = h + 'px';
      }
    }
    if (!cab) return;
    const cs = getComputedStyle(home);
    const room = home.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const tall = cab.offsetHeight;
    if (tall > room && room > 0) cab.style.scale = String(Math.floor(room / tall * 1000) / 1000);
    shareCabinet(cab);
  }
  /* Hand Rankings, Custom Game, the Workshop and Settings draw their cabinet
     exactly where this one is drawn (css/workshop.css, ONE CABINET). */
  function shareCabinet(cab){
    // from layout, not the drawn box, so the boot and launch moves (which
    // transform it) never skew it; the fit scale grows from its top centre
    const app = $id('app'), w = cab.offsetWidth, h = cab.offsetHeight;
    if (!w || !h) return;
    const s = parseFloat(cab.style.scale) || 1;
    const px = v => (Math.round(v * 10) / 10) + 'px';
    app.style.setProperty('--cab-x', px(cab.offsetLeft + w * (1 - s) / 2));
    app.style.setProperty('--cab-y', px(cab.offsetTop));
    app.style.setProperty('--cab-w', px(w * s));
    app.style.setProperty('--cab-h', px(h * s));
  }
  addEventListener('resize', fitHome);
  // the pixel fonts arrive after the first fit and change its height
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fitHome);
  addEventListener('load', fitHome);
  new MutationObserver(fitHome).observe($id('home'), { attributes:true, attributeFilter:['class'] });
  if ($id('menu-contraption')) new MutationObserver(fitHome).observe($id('menu-contraption'), { attributes:true, attributeFilter:['class'] });

  /* ---- the volume control: the fader ---- */
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

  /* ---- the looks picked in the lab: one panel, the fader, hints shown,
     the gold-line Workshop key ---- */
  html.dataset.stLayout = 'panel';
  html.dataset.stVolume = 'fader';
  html.dataset.stHints = 'on';
  html.dataset.wbtn = 'line';
  placeKey();
  fitHome(); requestAnimationFrame(fitHome);
})();
