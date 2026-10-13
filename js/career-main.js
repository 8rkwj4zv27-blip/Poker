/* ============================================================
   CAREER MAIN — the Career hub: a wooden table on the felt (lab only).

   The owner's design (12 Oct, docs/career/CAREER_HUB_BRIEF.md, round 6):
   the cabinet is the bankroll reel and the card feeder, nothing else.
   The rule: the tray is the house's, the felt is yours.
   - The tray (a small wooden table in the felt's top third) holds the
     house's three cards, dealt from your case: the regular one, a step
     up, the big one (never labelled). REDEAL deals three others.
   - The felt is yours: whatever you put there stays. Packets back from
     the shop lie in a row; tap one and it's torn open: its cards go face
     down into your deck (every packet's cards in one), the wrapper and
     the strip left lying about. Open as many as you like. Tap the deck
     whenever you like and the top card turns over (the pack opening's
     own reveal: hold to squeeze, rares glint, a legendary slams); tap the
     deck again and that card goes down and the next turns, tap anywhere
     else and it just goes down: in the next place of a neat arrangement,
     each card a little over the last. Tap a card to inspect it.
   - Anything can be picked up, slid about and thrown. A card thrown off
     the felt goes into your collection (the CARDS key, with a chime); a
     wrapper or strip thrown off is gone; a sealed packet bounces back
     off the rail. A double tap on empty felt tidies the lot: the loose
     cards into the collection, the rubbish away, the packets lined up,
     the house's cards back in the tray.
   - A card dragged up to the feeder (or swiped up out of the inspect
     screen) goes half in; PLAY takes it the rest of
     the way (the game would seat you: not wired); tap it to take it out.
   The middle key: PLAY (a card in the feeder) · ADD TO COLLECTION (cards
   lying loose) · OPEN (packets waiting) · REDEAL.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, ease, tween, wait, glide, squash, puff, jolt, S, Foil, Haptic } = PO;
  const CW = 82, CH = 120;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const BANKS = [620, 12650, 186400];
  // in the New Career preview (js/career-link.js) the real Career stands
  // in for the lab's placeholders: the bankroll, your cards, your packets
  const LINK = window.CareerLink || null;
  let wallet = LINK ? LINK.bank() : BANKS.includes(+state.bank) ? +state.bank : BANKS[1];

  let root, felt, stage, woodEl, slotEl, mouthEl, plateEl;
  let s = 1;                 // the cards' scale on the felt
  let busy = false;
  let pool = [];             // your case: the cards the house deals you from
  // everything on the felt: house (the tray's cards), card (yours,
  // turned over), pk (a sealed packet), deck (the face-down cards from the
  // packets opened), junk (a wrapper, a strip)
  const things = [];
  let fed = null, fedFrom = null;   // the card in the feeder, and where it came from
  let zTop = 60;
  const $ = q => root.querySelector(q);
  const raise = el => { el.style.zIndex = String(++zTop); };
  const bodyOf = t => t.c ? t.c.body : t.p ? t.p.body : t.body;
  const elOf = t => t.c ? t.c.el : t.p ? t.p.el : t.body.el;
  const of = kind => things.filter(t => t.kind === kind);
  const isCard = t => t.kind === 'house' || t.kind === 'card';

  /* ---------------- the cabinet ---------------- */
  function reel(n){
    const digits = String(Math.max(0, Math.round(n))).padStart(7, '0');
    let lead = true;
    return '<span class="jp-cell jp-sym">$</span>' + [...digits].map(d => {
      lead = lead && d === '0';
      return `<span class="jp-cell jp-digit${lead ? ' is-leading' : ''}"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${d}</span><span>${d}</span></span></span></span>`;
    }).join('');
  }
  // the reel counts to a new total, a tick a step
  function countTo(to){
    const from = wallet; wallet = to;
    let last = from;
    return tween(Math.min(900, 300 + Math.abs(to - from) / 40), e => {
      const v = Math.round(mix(from, to, e));
      if (v !== last){ last = v; $('#cm-reel').innerHTML = reel(v); S.counterTick(false); }
    }, ease.out).then(() => { $('#cm-reel').innerHTML = reel(to); S.counterLock(); });
  }
  const plate = text => { plateEl.textContent = text; };

  /* ---------------- the keys ---------------- */
  // a key: its label (a line break for two lines), lit (it'll do
  // something) or unlit (its label goes dark); a new label flips over
  function setKey(b, label, on = true){
    b.disabled = !on;
    b.classList.toggle('cm-unlit', !on);
    if (b.dataset.label === label) return;
    b.dataset.label = label;
    const put = () => { b.textContent = label; b.classList.toggle('cm-two', label.includes('\n')); b.classList.toggle('cm-long', !label.includes('\n') && label.length > 9); };
    if (PO.reduced || !b.textContent){ put(); return; }
    b.classList.add('cm-flip');
    setTimeout(() => { put(); b.classList.remove('cm-flip'); }, 60);
  }
  const keyEl = k => $(`[data-key="${k}"]`);
  const MID = { play:'PLAY', add:'ADD TO\nCOLLECTION', open:'OPEN', redeal:'REDEAL', resume:'CONTINUE' };
  const mid = () => LINK?.active ? 'resume' : fed ? 'play' : of('card').length ? 'add' : of('pk').length ? 'open' : 'redeal';
  // (the shop has the keys while it's out, and while a packet is torn open;
  // the album darkens them while it's out)
  function keys(){
    if (window.CareerShop?.out || window.CareerAlbum?.out) return;
    setKey(keyEl('shop'), 'SHOP'); setKey(keyEl('cards'), 'CARDS');
    setKey(keyEl('play'), MID[mid()]);
    keyEl('play').classList.toggle('is-ready', !!fed);
  }

  /* ---------------- build ---------------- */
  const seg = (key, opts) => `<div class="cm-seg" data-key="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;
  function build(){
    root = document.createElement('main');
    root.id = 'cm'; root.className = 'lobby-card pc-housing';
    root.innerHTML = `
      <header class="cm-rail"><button class="icon-btn cm-icon" id="cm-back" type="button" aria-label="Back"><i class="ci-arrow is-left"></i></button><span class="cm-title">CAREER</span><button class="icon-btn cm-icon" id="cm-tune" type="button" aria-label="${LINK ? 'More' : 'Tune'}">${LINK ? 'MORE' : 'TUNE'}</button></header>
      <div class="cm-cabinet">
        <div class="ch2-bankroll-housing cm-bank"><div class="ch2-bankroll-reel" id="cm-reel"></div></div>
        <div class="cm-row"><div class="cm-slot"><b class="cm-plate">INSERT CARD</b><div class="cm-mouth"><i class="cm-throat"></i></div></div></div>
      </div>
      <section class="cm-felt" data-theme="emerald"><div class="felt">
        <div class="cm-table"><div class="cm-wood">${[0, 1, 2].map(i => `<i class="cm-place" data-i="${i}"></i>`).join('')}</div></div>
        <div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>
      </div></section>
      <footer class="cm-console"><div class="cm-console-case"><div class="ec-bay"><div class="actions-row cm-keys"><button class="btn-check" type="button" data-key="shop">SHOP</button><button class="btn-raise" type="button" data-key="play">REDEAL</button><button class="btn-check" type="button" data-key="cards">CARDS</button></div></div></div></footer>
      <section class="po-sheet cm-sheet" id="cm-sheet" hidden aria-label="${LINK ? 'More' : 'Tune'}">
        <h2>CAREER</h2>
        ${LINK ? `<p>Your invitations are the cards. REDEAL lays three of them in the tray. Drag one up into INSERT CARD, then PLAY: the card is spent and you're seated. Tap a card to look at it. SHOP buys packets of more; CARDS opens your album. Packets on the felt: tap one, or OPEN.</p>
        <h3>THE NEW CAREER</h3><div class="cm-seg"><button class="pc-button pc-button-secondary" id="cm-abandon" hidden>ABANDON EVENT</button><button class="pc-button pc-button-secondary" id="cm-restart">START OVER</button></div>`
          : `<p>The tray is the house's, the felt is yours. REDEAL for three more. Tap the deck to turn a card over; tap it again for the next, or anywhere else to put the card down. Pick anything up and move it, or throw it: cards thrown off go into your collection. Drag a card up into the feeder, PLAY. Double tap empty felt to tidy up.</p>
        <h3>BANKROLL</h3>${seg('bank', Object.fromEntries(BANKS.map(b => [b, money(b)])))}`}
        <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cm-done">DONE</button></div>
      </section>`;
    // in the game the hub has a screen of its own (js/career-link.js);
    // alone in its lab it takes over the menu's
    const home = document.getElementById(LINK ? 'hub' : 'home');
    if (!LINK){
      document.body.classList.add('cm-lab');
      home.classList.add('cm-home'); home.classList.remove('hidden');
      [...home.classList].filter(c => c.startsWith('hb-')).forEach(c => home.classList.remove(c));
    }
    home.append(root);
    felt = $('.cm-felt > .felt');
    stage = { el:felt, objects:felt.querySelector('.po-objects'), shadows:felt.querySelector('.po-shadows'), fx:felt.querySelector('.po-fx') };
    woodEl = $('.cm-wood'); slotEl = $('.cm-slot'); mouthEl = $('.cm-mouth'); plateEl = $('.cm-plate');
    $('#cm-tune').onclick = () => {
      $('#cm-sheet').hidden = !$('#cm-sheet').hidden;
      if (LINK) $('#cm-abandon').hidden = !LINK.active;
    };
    $('#cm-done').onclick = () => { $('#cm-sheet').hidden = true; };
    // the new Career's own save, wiped on a second tap (the classic
    // Career, settings and stats are left alone)
    if (LINK) $('#cm-restart').onclick = e => {
      const b = e.currentTarget;
      if (b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = 'TAP AGAIN TO WIPE IT'; return; }
      LINK.wipe();
      location.reload();
    };
    // the event in progress given up (the game asks first), and the hub
    // catches up: CONTINUE goes, the plate says so
    if (LINK) $('#cm-abandon').onclick = () => { $('#cm-sheet').hidden = true; LINK.abandon(refresh); };
    // back to the menu, once nothing is moving and the shop and album are away
    $('#cm-back').onclick = () => {
      if (!LINK || busy || window.CareerShop?.out || window.CareerAlbum?.out) return;
      $('#cm-sheet').hidden = true;
      window.CareerHub.back();
    };
    root.querySelectorAll('.cm-seg[data-key] button').forEach(b => b.onclick = () => {
      wallet = +b.dataset.v;
      if (host) host.set({ bank:wallet });
      $('#cm-reel').innerHTML = reel(wallet);
      marks();
    });
    root.querySelectorAll('.cm-keys button').forEach(b => b.onclick = () => key(b));
    felt.addEventListener('pointerdown', down);
    felt.addEventListener('pointermove', move);
    felt.addEventListener('pointerup', up);
    felt.addEventListener('pointercancel', e => up(e, true));
    // iOS lets sound start only inside a finished touch
    ['pointerup', 'touchend', 'click'].forEach(t => document.addEventListener(t, () => Foil.unlock(), { passive:true }));
  }
  function marks(){ root.querySelectorAll('.cm-seg[data-key] button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === wallet))); }

  /* ---------------- where things go ---------------- */
  // three cards across the tray, as big as the felt allows
  function measure(){
    s = Math.min(1.3, (felt.clientWidth - 64) / (CW * 3 + 28));
    root.style.setProperty('--cm-card', Math.round(CW * s) + 'px');
    root.style.setProperty('--cm-card-h', Math.round(CH * s) + 'px');
  }
  const local = r => { const f = felt.getBoundingClientRect(); return { x:r.left + r.width / 2 - f.left, y:r.top + r.height / 2 - f.top }; };
  const SKEW = [-2, 1, -1];
  const placeAt = i => ({ ...local($(`.cm-place[data-i="${i}"]`).getBoundingClientRect()), r:SKEW[i] });
  const below = () => { const t = woodEl.getBoundingClientRect(), f = felt.getBoundingClientRect(); return t.bottom - f.top; };
  // packets: a row on the felt under the tray, each on the one before
  const pkScale = () => CH * s / POPacket.AH;
  function rowAt(i, n){
    const W = felt.clientWidth, w = POPacket.AW * pkScale(), y = below() + CH * s / 2 + 14;
    const span = W - w - 24, step = n > 1 ? Math.min(w * 1.1, span / (n - 1)) : 0;
    return { x:W / 2 + (i - (n - 1) / 2) * step, y };
  }
  // cards turned over go down in rows under the packets, each a little
  // over the last, clear of where the deck lands (on the right); when the
  // rows are full they start again, a step along
  const DECK_X = .84;
  function neatAt(i){
    const W = felt.clientWidth, H = felt.clientHeight, w = CW * s, h = CH * s;
    const top = below() + h + 34, sx = w * .55, sy = h * .34, right = W * DECK_X - w * .6;
    const cols = Math.max(1, Math.floor((right - 10 - w) / sx) + 1), rows = Math.max(1, Math.floor((H - 10 - top - h) / sy) + 1);
    const k = i % (cols * rows), lap = Math.floor(i / (cols * rows));
    return { x:10 + w / 2 + (k % cols) * sx + lap * 8, y:Math.min(H - h / 2 - 4, top + h / 2 + Math.floor(k / cols) * sy) + lap * 6, r:((i * 7) % 5 - 2) * .6 };
  }
  // the feeder's lower lip, where a card comes out, in the felt's coordinates
  function lip(){ const r = mouthEl.getBoundingClientRect(), f = felt.getBoundingClientRect(); return { x:r.left + r.width / 2 - f.left, y:r.bottom - 4 - f.top }; }

  /* ---------------- your case ---------------- */
  // placeholder cards across the venues (the lab's own)
  function fillPool(){
    if (LINK){ pool = LINK.pool(); return; }
    const ids = [['table', 'common', 'back-room-five'], ['freezeout', 'common', 'back-room-freezeout'], ['table', 'uncommon', 'pub-open'],
      ['bomb', 'uncommon', 'pub-turbo'], ['freezeout', 'rare', 'pub-freezeout'], ['table', 'rare', 'card-club-six'],
      ['bomb', 'common', 'card-club-deep'], ['table', 'legendary', 'casino-main'], ['freezeout', 'uncommon', 'back-room-heads-up'],
      ['table', 'common', 'back-room-heads-up'], ['bomb', 'rare', 'pub-open'], ['freezeout', 'common', 'card-club-six']];
    pool = ids.map(a => EventCards.make(...a));
  }
  // one from each third of your case by prize (the regular one, a step up,
  // the big one), never one already out, and not one just swept away if
  // there's a choice
  function chooseFor(places, not = []){
    if (LINK) fillPool();   // your cards as the save has them now
    // never a card already out on the felt (the tray's, or one of yours lying loose)
    const loose = new Set(of('card').map(t => t.card.uid));
    const out = of('house').map(h => h.card), by = pool.filter(c => !loose.has(c.uid)).sort((a, b) => a.prize - b.prize), n = by.length;
    const has = (list, c) => list.some(q => q.uid === c.uid);
    const nots = not.filter(Boolean);
    return places.map(i => {
      const a = Math.floor(i / 3 * n), band = by.slice(a, Math.max(a + 1, Math.ceil((i + 1) / 3 * n))).filter(c => !has(out, c));
      const fresh = band.filter(c => !has(nots, c));
      const c = pick(fresh.length ? fresh : band.length ? band : by.filter(q => !has(out, q)));
      if (c) out.push(c);
      return c;
    });
  }

  /* ---------------- cards ---------------- */
  function cardBody(card, pose){
    const c = CardInspect.make(stage, card, { side:'face' });
    c.el.classList.add('cm-card');
    c.body.set({ z:0, sx:1, sy:1, alpha:1, s, ...pose });
    c.body.render(performance.now());
    raise(c.el);
    return c;
  }
  // the house's cards, tossed in from off the left onto the tray
  async function tossIn(places, not){
    const cards = chooseFor(places, not);
    await Promise.all(places.map((place, k) => wait(PO.reduced ? 0 : k * 110).then(async () => {
      const card = cards[k]; if (!card) return;
      const to = placeAt(place);
      const c = cardBody(card, { x:-CW * s, y:to.y + rr(30, 70), r:rr(-40, -20), z:30 });
      things.push({ kind:'house', card, c, place });
      S.cardDeal(); Foil.flutter();
      await glide(c.body, { ...to, z:0 }, 380, { arc:26, easing:ease.out });
      S.cardLanded(); Haptic.tick(6);
      puff(stage, to.x, to.y + CH * s * .45, CW * s, { n:4, colour:'#3a2414' });
      squash(c.body, .05, 160);
    })));
  }
  // the places in the tray with no house card in them
  const emptyPlaces = () => [0, 1, 2].filter(i => !of('house').some(h => h.place === i));
  async function refill(){ const e = emptyPlaces(); if (e.length) await tossIn(e); }
  function drop(t){ const i = things.indexOf(t); if (i >= 0) things.splice(i, 1); }
  async function redeal(){
    if (busy || fed) return;
    busy = true;
    S.cardReturn(); Haptic.tick(10);
    const out = of('house'), was = out.map(h => h.card), W = felt.clientWidth;
    out.forEach(drop);
    await Promise.all(out.map((h, k) => wait(PO.reduced ? 0 : k * 70).then(async () => {
      raise(h.c.el); Foil.flutter();
      await glide(h.c.body, { x:W + CW * s, y:h.c.body.y + rr(-24, 24), r:h.c.body.r + rr(20, 40), z:6 }, 280, { easing:ease.in });
      h.c.body.remove();
    })));
    await wait(PO.reduced ? 0 : 80);
    await tossIn([0, 1, 2], was);
    keys();
    busy = false;
  }

  /* ---------------- into the collection ---------------- */
  // the chime of a card going into the collection: the CARDS key takes it
  function filed(){
    const k = keyEl('cards');
    jolt(k, 2); Haptic.tick(8, 0);
    S.cardReturn(); Foil.note(9, .35);
    setTimeout(() => Foil.note(13, .3), PO.reduced ? 0 : 80);
  }
  // a card goes into your collection: yours join your case; the house's
  // were in it already, and another is tossed into the tray
  function collect(t){
    drop(t);
    if (t.kind === 'card' && !LINK) pool.push(t.card);   // (the preview's pool is your saved cards already)
    filed();
  }
  // ADD TO COLLECTION: every loose card squares up and goes in through the
  // CARDS key, one after another
  async function addAll(){
    if (busy) return;
    const list = of('card');
    if (!list.length) return;
    busy = true;
    const k = keyEl('cards'), to = local(k.getBoundingClientRect());
    await Promise.all(list.map((t, i) => wait(PO.reduced ? 0 : i * 70).then(async () => {
      raise(t.c.el); S.cardDeal();
      await glide(t.c.body, { x:to.x, y:to.y, s:s * .4, r:0, z:12, alpha:.4 }, 300, { arc:30, easing:ease.in });
      t.c.body.remove();
      collect(t);
    })));
    keys();
    busy = false;
  }

  /* ---------------- the feeder ---------------- */
  // how much of the card has gone up into the mouth (in the card's own pixels)
  function clipCard(c){
    const top = c.body.y - CH * s / 2, gone = Math.max(0, lip().y - top) / s;
    c.el.style.clipPath = gone > 0 ? `inset(${gone.toFixed(1)}px 0 0 0)` : '';
  }
  // the rollers take it in, a tooth at a time, the cabinet shuddering
  async function teeth(c, toY, n){
    for (let t = 1; t <= n; t++){
      const y0 = c.body.y, y = mix(y0, toY, 1 / (n - t + 1));
      await tween(70, e => { c.body.set({ y:mix(y0, y, e) }); clipCard(c); }, ease.out);
      S.wheelTooth(); Haptic.tick(8, 30); jolt(slotEl, 2);
      await wait(PO.reduced ? 0 : 50);
    }
  }
  // a card goes up to the feeder and is taken half in
  async function feed(t, { placed = false, from = null } = {}){
    if (fed || busy || !isCard(t)) return;
    busy = true;
    const m = lip(), c = t.c, b = c.body;
    fed = t; fedFrom = from || { x:b.x, y:b.y, r:b.r };
    keys();
    c.el.style.zIndex = '900';
    c.body.sh?.style.setProperty('visibility', 'hidden');
    if (!placed){ S.cardDeal(); await glide(b, { x:m.x, y:m.y + CH * s / 2 + 2, r:0, s, z:0 }, 240, { easing:ease.out }); }
    await teeth(c, m.y, 2);
    S.wheelLock(); Haptic.tick(14, 0); jolt($('.cm-cabinet'), 2);
    const d = EventCards.describe(t.card);
    plate((d.plate || d.venue + ' · ' + d.title).toUpperCase());
    slotEl.classList.add('is-fed');
    busy = false;
  }
  // tap the card in the feeder: it comes back out, to where it was
  async function unfeed(){
    if (!fed || busy) return;
    busy = true;
    const t = fed, c = t.c, m = lip();
    await teeth(c, m.y + CH * s / 2 + 2, 2);
    c.el.style.clipPath = '';
    c.body.sh?.style.removeProperty('visibility');
    fed = null; slotEl.classList.remove('is-fed'); plate('INSERT CARD'); keys();
    // a card from elsewhere (the album) goes back where it came from
    if (t.back){ drop(t); busy = false; return t.back(t); }
    S.cardReturn();
    const home = t.kind === 'house' ? placeAt(t.place) : fedFrom;
    await glide(c.body, { ...home, z:0, s }, 300, { arc:18, easing:ease.out });
    raise(c.el); S.cardLanded(); squash(c.body, .05, 140);
    busy = false;
  }
  // PLAY: the rest of the way in. The game would seat you at its table
  // here (not wired); the card is used up. A house card is replaced.
  async function play(){
    if (!fed || busy) return;
    busy = true;
    const t = fed, c = t.c;
    // the preview plays only a card you own, and only when no table is open
    if (LINK && !(t.card.invId && careerCanPlayInvitation(t.card.invId))){
      busy = false; plate('TABLE BUSY'); jolt(slotEl, 2);
      return setTimeout(() => { plate((EventCards.describe(t.card).plate || 'INSERT CARD').toUpperCase()); }, 1200);
    }
    if (t.beforePlay) await t.beforePlay();
    S.wheelCatch(); jolt(slotEl, 3);
    await teeth(c, lip().y - CH * s / 2 - 4, 3);
    S.wheelLock(); Haptic.tick(18, 0); jolt($('.cm-cabinet'), 3);
    c.body.remove(); drop(t);
    pool = pool.filter(q => q.uid !== t.card.uid);
    if (LINK){
      fed = null; slotEl.classList.remove('is-fed'); plate('INSERT CARD'); keys();
      busy = false;
      t.linkPlayed?.();
      // (refused after all: the card is still yours, and comes back)
      if (!LINK.play(t.card)){ plate('TABLE BUSY'); refresh(); }
      return;
    }
    if (pool.length < 4) fillPool();
    fed = null; slotEl.classList.remove('is-fed'); keys();
    if (t.afterPlay){ plate('INSERT CARD'); busy = false; return t.afterPlay(t); }
    await wait(PO.reduced ? 0 : 700);
    plate('INSERT CARD');
    if (t.kind === 'house') await tossIn([t.place]);
    keys();
    busy = false;
  }

  // a card brought from elsewhere (the album): its body already on a stage
  // laid exactly over the felt, so the feeder's own moves work on it.
  // hooks: back(t) when it's taken out again, beforePlay/afterPlay(t)
  function feedOther(c, card, hooks = {}, { placed = false } = {}){
    const t = { kind:'card', card, c, ...hooks };
    things.push(t);
    return feed(t, { placed, from:{ x:c.body.x, y:c.body.y, r:c.body.r } });
  }

  /* ---------------- packets ---------------- */
  // back from the shop: the packets you sent drop onto the felt in a row
  async function addPackets(series){
    if (!series.length) return;
    busy = true;
    const n0 = of('pk').length, n = n0 + series.length;
    for (const [k, given] of series.entries()){
      // the saved packet this one is (in the game): the first not yet on
      // the felt, drawn as its own kind (the starter, the house's, the pity)
      const pktId = LINK ? LINK.packetIds().find(pid => !of('pk').some(q => q.p.pktId === pid)) || null : null;
      const id = (pktId && LINK.kindOf(pktId)) || given;
      const p = new POPacket.Packet(stage, id, 0);
      p.tagEl.hidden = true; p.el.classList.add('cm-pk');
      if (LINK) p.pktId = pktId;
      const to = { ...rowAt(n0 + k, n), r:rr(-4, 4) };
      things.push({ kind:'pk', p, series:id });
      p.body.set({ x:to.x, y:-POPacket.AH * pkScale(), s:pkScale(), r:to.r - 30, z:30, sx:1, sy:1, alpha:1 });
      p.body.render(performance.now());
      raise(p.el);
      await p.ready;
      S.cardDeal(); Foil.flutter();
      await glide(p.body, { ...to, z:0 }, 300, { easing:ease.in });
      S.cardLanded(); Foil.thud(.4); Haptic.tick(8);
      puff(stage, to.x, to.y + CH * s * .45, CW * s, { n:4 });
      squash(p.body, .08, 180);
      keys();
      await wait(PO.reduced ? 0 : 70);
    }
    busy = false;
  }
  // a sealed packet, tapped (or OPEN: the last one down): torn open on the felt
  function open(t){
    if (busy || !window.CareerShop) return;
    t = t || of('pk').at(-1);
    if (!t) return;
    // the preview: a packet whose cards wouldn't fit stays where it is
    if (LINK && !LINK.canOpen(t.p.pktId)){ plate('COLLECTION FULL'); jolt(slotEl, 2); Foil.thud(.3); setTimeout(() => plate('INSERT CARD'), 1400); return; }
    drop(t);
    window.CareerShop.open(t.p);
  }
  // a body from another stage onto the felt, where it is on the screen
  function onto(b){
    const a = b.stage.el.getBoundingClientRect(), f = felt.getBoundingClientRect();
    b.set({ x:b.x + a.left - f.left, y:b.y + a.top - f.top });
    stage.objects.append(b.el); if (b.sh) stage.shadows.append(b.sh);
    b.stage = stage; raise(b.el);
  }
  // the deck's thickness: the cards stepped down under the top one
  function stackDeck(d){
    const kids = [...d.body.el.children], n = kids.length;
    kids.forEach((k, i) => { k.style.transform = `translate(0px,${Math.round(Math.min((n - 1 - i) * .6, 12))}px)`; });
  }
  // the cards are out, face down in a little deck, with the wrapper and
  // the strip: they're yours, on the felt. The deck joins yours (its
  // cards under the ones already there).
  function handOver({ cards, deck, wrapper, flap }){
    if (flap){ onto(flap); things.push({ kind:'junk', body:flap }); }
    if (wrapper){ onto(wrapper.body); things.push({ kind:'junk', body:wrapper.body, p:wrapper }); }
    if (!deck) return keys();
    onto(deck);
    const mine = of('deck')[0];
    if (!mine){
      const d = { kind:'deck', body:deck, cards:cards.slice(), home:{ x:deck.x, y:deck.y, r:deck.r } };
      things.push(d); stackDeck(d); keys();
      return;
    }
    // onto your deck: it squares up into it
    busy = true;
    raise(mine.body.el);
    glide(deck, { x:mine.body.x, y:mine.body.y + 4, r:mine.body.r, z:0 }, 260, { arc:12, easing:ease.out }).then(() => {
      mine.body.el.prepend(...deck.el.children);
      deck.remove();
      mine.cards.push(...cards);
      stackDeck(mine);
      S.deckSettle(); squash(mine.body, .06, 140); Haptic.tick(10);
      busy = false; keys();
    });
  }
  // a card turned over at the deck: you put it down, in the next place
  function place(card){
    onto(card.body);
    card.el.classList.add('cm-card');
    const t = { kind:'card', card:card.card, c:card };
    things.push(t);
    const to = neatAt(of('card').length - 1);
    S.cardReturn();
    glide(card.body, { ...to, s, z:0, sx:1, sy:1 }, 300, { arc:16, easing:ease.out }).then(() => { S.cardLanded(); squash(card.body, .05, 140); Haptic.tick(6); });
    keys();
  }
  // the reveal's over: the deck comes back with what's left in it
  function deckBack({ deck, cards }){
    if (deck && cards.length){
      onto(deck);
      const d = { kind:'deck', body:deck, cards, home:{ x:deck.x, y:deck.y, r:deck.r } };
      things.push(d);
    }
    keys();
  }

  /* ---------------- looking at cards ---------------- */
  // the shared inspect screen, through every card on the felt (the tapped
  // one first); swipe one up out of it into the feeder
  function inspect(t){
    const list = [t, ...things.filter(q => isCard(q) && q !== t && q !== fed).sort((a, b) => +elOf(b).style.zIndex - +elOf(a).style.zIndex)];
    CardInspect.open({
      host:root.parentNode,
      items:list.map(q => ({ card:q.card, source:() => q.c.el, thing:q })),
      index:0,
      swipeUp:async (item, idx, api) => {
        const q = item.thing, m = lip(), f = felt.getBoundingClientRect(), b = q.c.body;
        if (fed || busy) return api.close();
        const from = { x:b.x, y:b.y, r:b.r };
        // on its way up: the card on the felt waits under the feeder for it
        b.set({ x:m.x, y:m.y + CH * s / 2 + 2, r:0, z:0, s });
        b.render(performance.now());
        await api.sendTo({ x:f.left + m.x, y:f.top + m.y + CH * s / 2 + 2, s, r:0, z:0 });
        feed(q, { placed:true, from });
      }
    });
  }

  /* ---------------- tidying up ---------------- */
  // a double tap on empty felt: the loose cards into the collection, the
  // rubbish off the felt, the packets back in a row, the deck back where it
  // was, the house's cards to the tray (and any empty place filled)
  async function tidy(){
    if (busy) return;
    busy = true;
    S.cardReturn(); Haptic.tick(10);
    const H = felt.clientHeight, cards = of('card'), junk = of('junk'), pks = of('pk');
    const k = keyEl('cards'), to = local(k.getBoundingClientRect());
    await Promise.all([
      ...cards.map((t, i) => wait(PO.reduced ? 0 : i * 60).then(async () => {
        raise(t.c.el);
        await glide(t.c.body, { x:to.x, y:to.y, s:s * .4, r:0, z:12, alpha:.4 }, 300, { arc:30, easing:ease.in });
        t.c.body.remove(); collect(t);
      })),
      ...junk.map((t, i) => wait(PO.reduced ? 0 : i * 50).then(async () => {
        drop(t); Foil.crinkle();
        await glide(t.body, { y:H + 120, r:t.body.r + rr(-90, 90), z:10, alpha:0 }, 420, { easing:ease.in });
        t.body.remove();
      })),
      ...pks.map((t, i) => glide(t.p.body, { ...rowAt(i, pks.length), r:rr(-4, 4), z:0 }, 280, { arc:10, easing:ease.out }).then(() => squash(t.p.body, .05, 120))),
      ...of('deck').map(d => glide(d.body, { ...d.home, z:0 }, 280, { arc:10, easing:ease.out })),
      ...of('house').filter(h => h !== fed).map(h => glide(h.c.body, { ...placeAt(h.place), z:0 }, 260, { arc:10, easing:ease.out }).then(() => squash(h.c.body, .04, 120)))
    ]);
    S.cardLanded();
    await refill();
    keys();
    busy = false;
  }

  /* ---------------- the keys ---------------- */
  function key(b){
    const k = b.dataset.key;
    if (window.CareerShop?.key(k, b)) return;   // the shop's keys while it's out
    jolt(b, 2); Haptic.tick(8);
    if (k === 'play') return { play, add:addAll, open:() => open(), redeal, resume:() => LINK.resume() }[mid()]();
    // CARDS: the album comes up (collection-book-lab.html); elsewhere not built yet
    if (k === 'cards' && window.CareerAlbum) return CareerAlbum.toggle();
    Foil.thud(.3);
  }

  /* ---------------- touch: pick up, slide, throw ---------------- */
  function thingAt(e){
    const el = e.target.closest('.cm-card, .cm-pk, .po-packet, .po-deck, .po-flap, .po-body');
    return el ? things.find(t => elOf(t) === el) || null : null;
  }
  function overFeeder(cx, cy){
    const m = slotEl.getBoundingClientRect();
    return cx > m.left - 16 && cx < m.right + 16 && cy < m.bottom + 34;
  }
  let ptr = null, lastTap = null;
  const at = e => { const f = felt.getBoundingClientRect(); return { x:e.clientX - f.left, y:e.clientY - f.top }; };
  function down(e){
    if (ptr || e.button > 0 || CardInspect.isOpen || window.CareerShop?.out) return;
    const p = at(e), now = performance.now(), t = thingAt(e);
    // the deck: the reveal takes the touch from here (tap: turn one over;
    // hold: squeeze the corner)
    if (t && t.kind === 'deck'){
      if (busy || fed || !window.CareerShop) return;
      drop(t); lastTap = null;
      if (!window.CareerShop.reveal(t.body, t.cards, e)) things.push(t);
      return;
    }
    ptr = { id:e.pointerId, t, x0:p.x, y0:p.y, x:p.x, y:p.y, at:now, hist:[{ ...p, t:now }], mode:'press' };
    if (t && !busy){ const b = bodyOf(t); ptr.dx = b.x - p.x; ptr.dy = b.y - p.y; Haptic.tick(4); }
    try { felt.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function move(e){
    const q = ptr;
    if (!q || e.pointerId !== q.id) return;
    const p = at(e), now = performance.now();
    q.x = p.x; q.y = p.y;
    q.hist.push({ ...p, t:now }); while (q.hist.length > 2 && now - q.hist[0].t > 90) q.hist.shift();
    const far = Math.hypot(p.x - q.x0, p.y - q.y0) > 8;
    // picked up: it comes off the felt, its shadow drifts out from under it
    if (q.mode === 'press' && far && q.t && q.t !== fed && !busy){
      q.mode = 'drag';
      const b = bodyOf(q.t);
      raise(b.el); b.set({ live:true });
      q.r0 = b.r; q.s0 = b.s;
      glide(b, { z:10, s:b.s * 1.05 }, 90, { easing:ease.out });
      if (q.t.kind === 'junk') Foil.crinkle(); else S.cardReturn();
      felt.classList.add('is-carrying');
    }
    if (q.mode === 'drag'){
      const b = bodyOf(q.t), v = vel(q);
      b.set({ x:p.x + q.dx, y:p.y + q.dy, r:clamp(q.r0 + v.x / 120, q.r0 - 16, q.r0 + 16) });
      if (isCard(q.t)) slotEl.classList.toggle('is-near', !fed && overFeeder(e.clientX, e.clientY));
    }
  }
  function vel(q){
    const h = q.hist, a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000);
    return { x:(b.x - a.x) / dt, y:(b.y - a.y) / dt, fresh:performance.now() - b.t < 70 };
  }
  function up(e, cancel){
    const q = ptr;
    if (!q || e.pointerId !== q.id) return;
    ptr = null;
    felt.classList.remove('is-carrying'); slotEl.classList.remove('is-near');
    if (cancel) return;
    if (q.mode === 'press') return tap(q);
    const t = q.t, b = bodyOf(t), v = vel(q), W = felt.clientWidth, H = felt.clientHeight;
    b.set({ live:false });
    const vx = v.fresh ? v.x : 0, vy = v.fresh ? v.y : 0, fast = Math.hypot(vx, vy) > 800;
    const rest = t.kind === 'pk' ? pkScale() : t.kind === 'junk' ? q.s0 : s;
    // carried up to the feeder and let go there (a card thrown past it flies on): it goes in
    if (isCard(t) && !fed && !fast && overFeeder(e.clientX, e.clientY)){
      b.set({ s });
      feed(t, { from:{ x:q.x0 + q.dx, y:q.y0 + q.dy, r:q.r0 } });
      return;
    }
    // thrown off the felt: a card into your collection, the rubbish gone;
    // a sealed packet hits the rail and comes back
    const tx = b.x + vx * .25, ty = b.y + vy * .25;
    if (fast && (tx < -20 || tx > W + 20 || ty < -20 || ty > H + 20)){
      const T = 360, x0 = b.x, y0 = b.y, r0 = b.r, spin = Math.sign(vx || 1);
      if (t.kind === 'pk'){
        const x = clamp(tx, 30, W - 30), y = clamp(ty, 30, H - 30);
        glide(b, { x:clamp(b.x + vx * .12, 10, W - 10), y:clamp(b.y + vy * .12, 10, H - 10), z:4 }, 120, { easing:ease.out })
          .then(() => { Foil.thud(.6); Haptic.tick(14); jolt(felt, 2); return glide(b, { x:mix(x, W / 2, .2), y:mix(y, H / 2, .2), r:b.r + spin * 30, z:0, s:rest }, 300, { easing:ease.out }); })
          .then(() => { squash(b, .08, 160); S.cardLanded(); });
        return;
      }
      drop(t);
      Foil.flutter(); Haptic.tick(8);
      tween(T, (e2, k) => b.set({ x:x0 + vx * k * T / 1000, y:y0 + vy * k * T / 1000, z:6 + Math.sin(k * Math.PI) * 20, r:r0 + spin * 220 * k, alpha:1 - Math.max(0, k - .5) * 2 }), ease.lin).then(() => {
        b.remove();
        if (isCard(t)){
          collect(t);
          if (t.kind === 'house') refill().then(keys);
        } else Foil.crinkle();
        keys();
      });
      keys();
      return;
    }
    // let go: it slides on a little and settles where it lands
    const hw = CW * s / 2, hh = CH * s / 2;
    const x = clamp(b.x + vx * .08, hw * .6, W - hw * .6), y = clamp(b.y + vy * .08, hh * .5, H - hh * .5);
    glide(b, { x, y, r:clamp(b.r + vx / 200, b.r - 24, b.r + 24), s:rest, z:0 }, 220, { easing:ease.out })
      .then(() => { squash(b, .05, 160); if (t.kind === 'junk') Foil.crinkle(); else S.cardLanded(); Haptic.tick(5); });
  }
  // a tap on something does its thing at once; two quick taps on empty
  // felt tidy everything up
  function tap(q){
    const t = q.t;
    if (!t){
      const now = performance.now();
      if (lastTap && now - lastTap.at < 320 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 40){ lastTap = null; tidy(); return; }
      lastTap = { at:now, x:q.x, y:q.y };
      return;
    }
    lastTap = null;
    if (busy) return;
    if (t === fed) return unfeed();
    if (t.kind === 'pk') return open(t);
    if (t.kind === 'junk'){
      // it hops on the felt, rustling
      const b = t.body;
      Foil.crinkle(); Haptic.tick(5);
      glide(b, { z:8 }, 70, { easing:ease.out }).then(() => glide(b, { z:0 }, 110, { easing:ease.in })).then(() => squash(b, .08, 140));
      return;
    }
    inspect(t);
  }

  /* ---------------- for the shop (js/vending-machine.js) ---------------- */
  window.CareerMain = {
    get root(){ return root; }, get felt(){ return felt; },
    get wallet(){ return wallet; },
    set wallet(v){ wallet = v; $('#cm-reel').innerHTML = reel(v); },
    showBank(v){ $('#cm-reel').innerHTML = reel(v); },
    get reelEl(){ return $('#cm-reel'); },
    get busy(){ return busy; },
    get ready(){ return ready; },
    get scale(){ return s; },
    keyEl, setKey, keys,
    // the feeder, for the album: lip() in the felt's coordinates
    feedOther, unfeed, play, lip:() => lip(), get fed(){ return fed; },
    get feltEl(){ return felt; }, get mouthEl(){ return mouthEl; }, get slotEl(){ return slotEl; },
    addPackets, handOver, place, deckBack,
    // chips home: the reel counts them in
    countIn:v => countTo(wallet + v),
    refresh,
    // read-only, for the lab's checks
    get state(){
      return { busy, fed:fed ? fed.kind : null, house:of('house').map(h => h.place + ':' + h.card.uid), cards:of('card').length,
        deck:of('deck')[0]?.cards.length || 0, packets:of('pk').length, junk:of('junk').length, pool:pool.length, mid:mid() };
    },
    where(kind, i){
      const list = kind === 'house' ? of('house').sort((a, b) => a.place - b.place) : of(kind);
      const t = list[i]; if (!t) return null;
      const r = elOf(t).getBoundingClientRect(), b = bodyOf(t);
      return { x:r.left + r.width / 2, y:r.top + r.height / 2, bx:b.x, by:b.y, home:t.kind === 'house' ? placeAt(t.place) : t.home || null };
    }
  };

  /* ---------------- the preview: back from the table ---------------- */
  // the bankroll counts to what the Career holds; the tray deals again from
  // the cards you own now; packets you hold but haven't got on the felt
  // (the starter, the pity packet, any bought) come down onto it
  let refreshing = false;
  // (in the game, nothing moves on the hub while the drum is still turning
  // it in: machine-wheel.js keeps the arriving screen inert until it locks)
  async function settled(){ while (root.parentNode.inert) await wait(80); }
  async function refresh(){
    if (!LINK || !root || refreshing) return;
    refreshing = true;
    try {
      await wait(PO.reduced ? 0 : 300);
      await settled();
      while (busy) await wait(100);
      if (LINK.bank() !== wallet) await countTo(LINK.bank());
      result();
      fillPool();
      const ids = pool.map(c => c.uid);
      of('house').filter(h => !ids.includes(h.card.uid)).forEach(h => { h.c.body.remove(); drop(h); });
      of('card').filter(t => !ids.includes(t.card.uid)).forEach(t => { t.c.body.remove(); drop(t); });
      busy = true; await tossIn(emptyPlaces()); busy = false;
      await layPackets();
      keys();
    } finally { refreshing = false; }
  }
  // how the last event went, on the plate for a moment once you're back
  // (only one finished since the hub was built)
  let seen = null;
  const ord = n => n + (n % 100 - n % 10 === 10 ? 'TH' : { 1:'ST', 2:'ND', 3:'RD' }[n % 10] || 'TH');
  function result(){
    const r = LINK.lastResult;
    if (!r || r === seen) return;
    seen = r;
    const place = r.outcome === 'win' ? 'WON' : r.place ? (r.tie > 1 ? '=' : '') + ord(r.place) : 'OUT';
    const text = r.outcome === 'forfeit' ? 'EVENT ABANDONED' : place + ' · ' + (r.prize > 0 ? '+' + money(r.prize) : 'NO PRIZE');
    if (fed) return;
    plate(text); slotEl.classList.add('is-result');
    setTimeout(() => { slotEl.classList.remove('is-result'); if (!fed) plate('INSERT CARD'); }, 4000);
  }
  async function layPackets(){
    LINK.arrivals();
    const missing = LINK.packetIds().filter(pid => !of('pk').some(q => q.p.pktId === pid));
    if (missing.length) await addPackets(missing.map(() => 'house'));
  }

  /* ---------------- start ---------------- */
  let ready = false;          // set up, the first deal and any packets down
  async function setup(){
    build();
    marks();
    $('#cm-reel').innerHTML = reel(wallet);
    measure();
    fillPool();
    keys();
    if (LINK) seen = LINK.lastResult;
    // the shop and the album build onto the hub (in the game, only now)
    document.dispatchEvent(new Event('career-hub-built'));
    await wait(400);
    await settled();
    busy = true; await tossIn([0, 1, 2]); busy = false;
    if (LINK){ await layPackets(); keys(); }
    ready = true;
    // the felt can change size (the TUNE sheet, the phone turning): the
    // house's cards keep to the tray, everything else stays on the felt
    new ResizeObserver(() => {
      if (!felt.clientWidth) return;   // the hub's screen hidden
      measure();
      if (busy) return;
      const W = felt.clientWidth, H = felt.clientHeight;
      things.forEach(t => {
        if (t === fed) return;
        const b = bodyOf(t);
        if (t.kind === 'house') b.set({ ...placeAt(t.place), s });
        else b.set({ x:clamp(b.x, 10, W - 10), y:clamp(b.y, 10, H - 10), s:t.kind === 'pk' ? pkScale() : t.kind === 'junk' ? b.s : s });
      });
    }).observe(felt);
  }
  // in the game the hub builds the first time Career is opened
  // (js/career-link.js); alone in its lab, as soon as the page is up
  let started = false;
  window.CareerMain.start = () => { if (!started){ started = true; setup(); } };
  if (!LINK){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.CareerMain.start); else window.CareerMain.start();
  } else if (window.CareerHub?.pending){
    // Career was pressed before this arrived
    const go = () => window.CareerHub.show();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else setTimeout(go, 0);
  }
})();
