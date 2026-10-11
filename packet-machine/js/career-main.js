/* ============================================================
   CAREER MAIN — the simplified Career hub, moving (lab only).

   The owner's brief (11 Oct): the bankroll reel full width across the top
   of the cabinet; the plain card slot in the middle, exactly a card wide,
   a CRT either side, slim and level; the SHOP · PLAY · CARDS keys in a
   console like the dashboard's. On the felt, only cards:
   - The table's own dealer deck, bottom left (DealerDeck). Tap it and a
     card comes off with the table's deal, lands somewhere on the felt,
     on top of whatever's there, and turns over. Nothing else moves; you
     arrange them yourself. The deck is your case: it thins as you deal.
     The first three after a shuffle are chosen for a reason (the safe
     one, the step up, the stretch), never labelled.
   - The clean-up spot opposite the deck: a printed outline on the felt.
     Tap it and every card on the felt slides into it and squares up,
     then goes back into the deck, and the deck is shuffled by hand.
     (The shop's things on the felt are cleared with them.)
   Drag a card up into the slot, or tap it to inspect it and press PLAY:
   the card feeds in; PLAY pays the entry and the game would seat you.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, ease, tween, wait, glide, squash, jolt, S, Foil, Haptic } = PO;
  const CW = 82, CH = 120;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const rr = (a, b) => a + Math.random() * (b - a);

  // the two screens, three ways (TUNE): they share one grid either way
  const SCREENS = { pair:'LABEL + FIGURE', big:'BIG FIGURE', lamp:'ONE LINE' };
  const BANKS = [620, 12650, 186400];
  const look = { screens:SCREENS[state.screens] ? state.screens : 'pair', bank:+state.bank || BANKS[1] };
  let wallet = look.bank, played = 14;

  let root, felt, stage, station, slotEl, mouthEl, padEl;
  let s = 1;                     // the cards' scale on the felt
  const hand = [];               // the cards on the felt: { card, c }
  let pool = [], next = [];      // your case; the order the deck deals it in
  let busy = false, fed = null;  // a card in the slot, waiting for PLAY
  const $ = q => root.querySelector(q);

  /* ---------------- the cabinet ---------------- */
  function reel(n){
    const digits = String(Math.max(0, Math.round(n))).padStart(7, '0');
    let lead = true;
    return '<span class="jp-cell jp-sym">$</span>' + [...digits].map(d => {
      lead = lead && d === '0';
      return `<span class="jp-cell jp-digit${lead ? ' is-leading' : ''}"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${d}</span><span>${d}</span></span></span></span>`;
    }).join('');
  }
  // a screen: [caption, figure], drawn the way the TUNE sheet says
  function screen(side, [cap, fig], ink){
    const k = look.screens, f = `<span class="crt-figure${fig.length <= 5 ? ' crt-figure--lg' : ''}">${fig}</span>`;
    const html = k === 'pair' ? `<span class="crt-caption">${cap}</span>${f}`
      : k === 'big' ? `${f}<span class="crt-caption">${cap}</span>`
      : `<span class="crt-row"><i class="crt-lamp"></i><span class="crt-line">${fig} ${cap}</span></span>`;
    $('.cm-crt-' + side).innerHTML = `<div class="crt cm-crt is-${k}"${ink ? ` data-ink="${ink}"` : ''}>${html}</div>`;
  }
  function screens(){
    if (window.CareerShop?.screens()) return;   // the shop has the screens
    if (fed){ screen('l', ['ENTRY', money(EventCards.describe(fed.card).entry)], 'money'); screen('r', ['READY', 'PLAY'], 'live'); return; }
    screen('l', ['IN HAND', String(hand.length)]); screen('r', ['PLAYED', String(played)]);
  }
  function say(l, r, ms = 1100){
    screen('l', l); screen('r', r);
    clearTimeout(say.t); say.t = setTimeout(screens, ms);
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

  /* ---------------- build ---------------- */
  const seg = (key, opts) => `<div class="cm-seg" data-key="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;
  function build(){
    root = document.createElement('main');
    root.id = 'cm'; root.className = 'lobby-card pc-housing';
    root.innerHTML = `
      <header class="cm-rail"><button class="icon-btn cm-icon" type="button" aria-label="Back"><i class="ci-arrow is-left"></i></button><span class="cm-title">CAREER</span><button class="icon-btn cm-icon" id="cm-tune" type="button" aria-label="Tune">TUNE</button></header>
      <div class="cm-cabinet">
        <div class="ch2-bankroll-housing cm-bank"><div class="ch2-bankroll-reel" id="cm-reel"></div></div>
        <div class="cm-row"><div class="cm-crt-l"></div><div class="cm-slot"><div class="cm-mouth"><i class="cm-throat"></i></div><b class="cm-slot-label">INSERT CARD</b></div><div class="cm-crt-r"></div></div>
      </div>
      <section class="cm-felt" data-theme="emerald"><div class="felt"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div></section>
      <footer class="cm-console"><div class="cm-console-case"><div class="ec-bay"><div class="actions-row cm-keys"><button class="btn-check" type="button" data-key="shop">SHOP</button><button class="btn-raise" type="button" data-key="play">PLAY</button><button class="btn-check" type="button" data-key="cards">CARDS</button></div></div></div></footer>
      <section class="po-sheet cm-sheet" id="cm-sheet" hidden aria-label="Tune">
        <h2>CAREER · MAIN</h2>
        <p>Tap the deck for a card; tap the outline opposite to clear them all back into the deck. Drag a card into the slot, or tap it to look.</p>
        <h3>SCREENS</h3>${seg('screens', SCREENS)}
        <h3>BANKROLL</h3>${seg('bank', Object.fromEntries(BANKS.map(b => [b, money(b)])))}
        <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cm-done">DONE</button></div>
      </section>`;
    document.body.classList.add('cm-lab');
    const home = document.getElementById('home');
    home.classList.add('cm-home'); home.classList.remove('hidden');
    [...home.classList].filter(c => c.startsWith('hb-')).forEach(c => home.classList.remove(c));
    // the felt and the deck are the table's own: the hub takes the deck
    // and wears the felt's id (the deck and P.I.P. find their felt by it)
    const tableFelt = document.getElementById('felt');
    station = tableFelt.querySelector('.dealer-station');
    tableFelt.id = 'cm-parked-felt';
    home.append(root);
    felt = $('.cm-felt > .felt');
    felt.id = 'felt';
    felt.append(station);
    station.classList.add('cm-station');
    station.setAttribute('aria-hidden', 'false'); station.setAttribute('aria-label', 'The deck: tap for a card');
    padEl = Object.assign(document.createElement('div'), { className:'cm-pad' });
    padEl.setAttribute('aria-label', 'Clear the felt'); padEl.setAttribute('role', 'button');
    felt.prepend(padEl);
    stage = { el:felt, objects:felt.querySelector('.po-objects'), shadows:felt.querySelector('.po-shadows'), fx:felt.querySelector('.po-fx') };
    slotEl = $('.cm-slot'); mouthEl = $('.cm-mouth');
    $('#cm-tune').onclick = () => { $('#cm-sheet').hidden = !$('#cm-sheet').hidden; };
    $('#cm-done').onclick = () => { $('#cm-sheet').hidden = true; };
    root.querySelectorAll('.cm-seg[data-key] button').forEach(b => b.onclick = () => {
      const key = b.parentNode.dataset.key;
      look[key] = key === 'bank' ? +b.dataset.v : b.dataset.v;
      if (host) host.set({ [key]:look[key] });
      marks();
      if (key === 'screens') screens();
      if (key === 'bank'){ wallet = look.bank; $('#cm-reel').innerHTML = reel(wallet); }
    });
    root.querySelectorAll('.cm-keys button').forEach(b => b.onclick = () => key(b));
    felt.addEventListener('pointerdown', down);
    felt.addEventListener('pointermove', move);
    felt.addEventListener('pointerup', up);
    felt.addEventListener('pointercancel', e => up(e, true));
    // iOS lets sound start only inside a finished touch
    ['pointerup', 'touchend', 'click'].forEach(t => document.addEventListener(t, () => Foil.unlock(), { passive:true }));
  }
  function marks(){ root.querySelectorAll('.cm-seg[data-key] button').forEach(b => b.setAttribute('aria-pressed', String(String(look[b.parentNode.dataset.key]) === b.dataset.v))); }
  function measure(){
    s = Math.min(1.1, felt.clientWidth / (CW * 3.7));
    root.style.setProperty('--cm-card', Math.round(CW * s) + 'px');
    Object.assign(padEl.style, { width:Math.round(CW * s + 10) + 'px', height:Math.round(CH * s + 10) + 'px' });
  }
  function padPoint(){ return { x:padEl.offsetLeft + padEl.offsetWidth / 2, y:padEl.offsetTop + padEl.offsetHeight / 2 }; }

  /* ---------------- your case ---------------- */
  // placeholder cards across the venues (the lab's own)
  function fillPool(){
    const ids = [['table', 'common', 'back-room-five'], ['freezeout', 'common', 'back-room-freezeout'], ['table', 'uncommon', 'pub-open'],
      ['bomb', 'uncommon', 'pub-turbo'], ['freezeout', 'rare', 'pub-freezeout'], ['table', 'rare', 'card-club-six'],
      ['bomb', 'common', 'card-club-deep'], ['table', 'legendary', 'casino-main'], ['freezeout', 'uncommon', 'back-room-heads-up'],
      ['table', 'common', 'back-room-heads-up'], ['bomb', 'rare', 'pub-open'], ['freezeout', 'common', 'card-club-six']];
    pool = ids.map(a => EventCards.make(...a));
  }
  const info = c => EventCards.describe(c);
  const top = c => info(c).payouts[0] || 0;
  // the shuffle's order: three for a reason first (the safe one, the step
  // up: the best prize for its entry you can afford, the stretch: the
  // biggest you can afford), then the rest of the case at random
  function shuffleOrder(){
    const can = pool.filter(c => info(c).entry <= wallet), from = can.length >= 3 ? can : pool.slice().sort((a, b) => info(a).entry - info(b).entry);
    const first = [];
    const take = c => { if (c && !first.includes(c)) first.push(c); };
    take(from.slice().sort((a, b) => info(a).entry - info(b).entry)[0]);
    take(from.filter(c => !first.includes(c)).sort((a, b) => top(b) / info(b).entry - top(a) / info(a).entry)[0]);
    take(from.filter(c => !first.includes(c)).sort((a, b) => top(b) - top(a))[0]);
    const rest = pool.filter(c => !first.includes(c)).sort(() => Math.random() - .5);
    next = first.concat(rest);
  }
  // the deck's thickness is what's left of your case
  function deckCount(){ DealerDeck.setCount(next.length ? Math.max(1, Math.round(next.length / pool.length * 52)) : 0); }

  /* ---------------- the cards ---------------- */
  // somewhere on the felt, clear of the deck's corner and the clean-up spot
  function landing(){
    const W = felt.clientWidth, H = felt.clientHeight, hw = CW * s / 2, hh = CH * s / 2;
    const f = felt.getBoundingClientRect(), d = station.getBoundingClientRect(), pad = padEl.getBoundingClientRect();
    const keepOff = [{ L:d.left - f.left - 10, R:d.right - f.left + 10, T:d.top - f.top - 10, B:H }, { L:pad.left - f.left - 10, R:W, T:pad.top - f.top - 10, B:H }];
    // the shop's things on the felt: packets waiting, a bag of chips
    (window.CareerShop?.keepOff?.() || []).forEach(k => { if (k.width) keepOff.push({ L:k.left - f.left - 10, R:k.right - f.left + 10, T:k.top - f.top - 10, B:k.bottom - f.top + 10 }); });
    // the first clear place found, or failing that the least covered
    let p = null, least = 1e9;
    for (let i = 0; i < 40; i++){
      const x = rr(hw + 10, W - hw - 10), y = rr(hh + 10, H - hh - 14);
      const over = keepOff.reduce((a, k) => a + Math.max(0, Math.min(x + hw * .7, k.R) - Math.max(x - hw * .7, k.L)) * Math.max(0, Math.min(y + hh * .7, k.B) - Math.max(y - hh * .7, k.T)), 0);
      if (over < least){ least = over; p = { x, y, r:rr(-22, 22) }; }
      if (!over) break;
    }
    return p;
  }
  // whatever was put down or picked up last is on top (cards, and the
  // shop's things on the felt, share one count)
  let zTop = 60;
  const raise = el => { el.style.zIndex = String(++zTop); };
  function order(){ raise(hand[hand.length - 1].c.el); }
  // one off the top with the table's deal; it lands where it lands, on top
  // of whatever's there, and turns over
  async function dealOne(){
    const card = next.shift(); if (!card) return false;
    const p = landing(), w = CW * s, h = CH * s;
    const spot = document.createElement('div');
    spot.className = 'cm-landing';
    Object.assign(spot.style, { left:Math.round(p.x - w / 2) + 'px', top:Math.round(p.y - h / 2) + 'px', width:Math.round(w) + 'px', height:Math.round(h) + 'px' });
    felt.append(spot);
    await DealerDeck.dealTo(spot);
    deckCount();
    spot.remove();
    const c = CardInspect.make(stage, card, { side:'back' });
    c.el.classList.add('cm-card');
    CardInspect.setBank(c, 180);
    c.body.set({ x:p.x, y:p.y, r:p.r, s, z:0, sx:1, sy:1, alpha:1 });
    const it = { card, c };
    hand.push(it); order();
    S.cardLanded(); DealerDeck.puff(c.el); Haptic.tick(6);
    squash(c.body, .05, 160);
    screens();
    await wait(60);
    await CardInspect.faceUp(c);
    return true;
  }
  async function deal(n){
    for (let i = 0; i < n; i++){ if (!next.length) break; dealOne(); await wait(DEAL_TIMING.dealStaggerMs || 160); }
    await wait((DEAL_TIMING.dealMs || 300) + 300);
  }
  // tap: one more, or a shrug when the case is all out
  async function drawOne(){
    if (busy) return;
    if (!next.length){ Foil.thud(.3); Haptic.tick(6); say(['THE CASE', 'EMPTY'], ['CLEAR', 'FELT']); return; }
    busy = true;
    await dealOne();
    busy = false;
  }
  // the clean-up spot: every card on the felt slides into it, one on
  // another, squares up, and goes back into the deck; the deck is shuffled
  // by hand. The shop clears its own things (wrappers, chips) alongside.
  async function cleanUp(){
    if (busy) return;
    busy = true;
    padEl.classList.add('is-pressed'); setTimeout(() => padEl.classList.remove('is-pressed'), 140);
    Haptic.tick(12, 0); S.wheelRelay(.5);
    const out = hand.splice(0), pc = padPoint();
    const shop = window.CareerShop?.sweep?.(pc) || Promise.resolve();
    await Promise.all(out.map((h, i) => wait(i * 60).then(() => {
      raise(h.c.el);
      S.cardReturn();
      return glide(h.c.body, { x:pc.x + rr(-4, 4), y:pc.y + rr(-4, 4) - i * .5, r:rr(-7, 7), s, z:0 }, 260, { arc:16, easing:ease.out });
    }).then(() => { S.cardLanded(); squash(h.c.body, .05, 120); })));
    if (out.length){
      // squared up: two taps, like the dealer's deck
      await wait(120);
      await Promise.all(out.map((h, i) => glide(h.c.body, { x:pc.x, y:pc.y - i * .5, r:0 }, 90)));
      S.deckSettle(); jolt(padEl, 1); Haptic.tick(10, 0);
      await wait(160);
      const gap = DEAL_TIMING.collectStaggerMaxMs || 260;
      await Promise.all(out.slice().reverse().map((h, i) => { h.c.body.sh?.remove(); return DealerDeck.collect(h.c.el, Math.min(gap, i * 45)).then(() => h.c.body.remove()); }));
    }
    await shop;
    screens();
    if (out.length){
      await DealerDeck.squareUp();
      shuffleOrder();
      await DealerDeck.shuffle('full');
      deckCount();
    } else Foil.thud(.25);
    busy = false;
  }

  /* ---------------- the slot ---------------- */
  function slotPoint(){
    const m = mouthEl.getBoundingClientRect(), f = felt.getBoundingClientRect();
    return { x:m.left + m.width / 2 - f.left, y:m.top + m.height / 2 - f.top };
  }
  function overSlot(cx, cy){
    const m = slotEl.getBoundingClientRect();
    return cx > m.left - 16 && cx < m.right + 16 && cy < m.bottom + 34;
  }
  // feed a card in: it squares up under the mouth, then the rollers take it
  // in four ratchet teeth, the cabinet shuddering at each
  async function feed(h){
    if (fed || busy) return;
    busy = true;
    const i = hand.indexOf(h); if (i >= 0) hand.splice(i, 1);
    const p = slotPoint(), c = h.c;
    c.el.style.zIndex = '90';
    await CardInspect.faceUp(c);
    S.cardDeal();
    await glide(c.body, { x:p.x, y:p.y + CH * s / 2 + 6, r:0, s, z:0 }, 220, { easing:ease.out });
    // the card's top edge disappears into the mouth as it goes in
    const clipAt = () => Math.max(0, p.y - (c.body.y - CH * s / 2)) / s;
    for (let t = 1; t <= 4; t++){
      const y = p.y + CH * s / 2 + 6 - (CH * s + 12) * t / 4, y0 = c.body.y;
      await tween(70, e => { c.body.set({ y:mix(y0, y, e) }); c.el.style.clipPath = `inset(${clipAt().toFixed(1)}px 0 0 0)`; }, ease.out);
      S.wheelTooth(); Haptic.tick(8, 30); jolt(slotEl, 2);
      await wait(60);
    }
    S.wheelLock(); Haptic.tick(16, 0); jolt($('.cm-cabinet'), 3);
    c.body.remove();
    fed = h;
    slotEl.classList.add('is-fed');
    $('[data-key="play"]').classList.add('is-ready');
    screens();
    busy = false;
  }
  // PLAY with a card in: the entry is paid, the reel counts it off
  async function play(){
    if (busy) return;
    if (!fed){
      // no card in yet: the top card on the felt goes in
      if (hand.length) feed(hand[hand.length - 1]); else { Foil.thud(.3); say(['NO CARDS', '0'], ['TAP', 'DECK']); }
      return;
    }
    const d = info(fed.card);
    if (d.entry > wallet){ Foil.thud(.4); Haptic.tick(20, 0); say(['ENTRY', money(d.entry)], ['SHORT', money(d.entry - wallet)]); return; }
    busy = true;
    S.wheelCatch(); jolt(slotEl, 3);
    await countTo(wallet - d.entry);
    played++;
    pool = pool.filter(c => c !== fed.card);
    say(['SEATED', 'GO'], ['TABLE', 'NEXT'], 2200);
    Foil.chord([523, 659, 784], .6);
    fed = null;
    slotEl.classList.remove('is-fed');
    $('[data-key="play"]').classList.remove('is-ready');
    if (!pool.length){ fillPool(); shuffleOrder(); }
    deckCount();
    busy = false;
  }
  function key(b){
    const k = b.dataset.key;
    if (window.CareerShop?.key(k, b)) return;   // the shop's keys while it's out
    jolt(b, 2); Haptic.tick(8);
    if (k === 'play') return play();
    say([k === 'shop' ? 'SHOP' : 'CARDS', 'SOON'], ['ROLLS', k === 'shop' ? 'DOWN' : 'UP']);
  }

  /* ---------------- for the shop (js/vending-machine.js) ----------------
     Lab only: what the shop needs from the hub. */
  // an opened packet's cards, laid down among the others: they join your
  // case, at the table's size, where they land
  async function layDown(cards){
    await Promise.all(cards.map((c, i) => wait(i * 110).then(async () => {
      const a = c.body.stage.el.getBoundingClientRect(), b = felt.getBoundingClientRect();
      c.body.set({ x:c.body.x + a.left - b.left, y:c.body.y + a.top - b.top });
      stage.objects.append(c.el); if (c.body.sh) stage.shadows.append(c.body.sh);
      c.body.stage = stage;
      c.el.classList.add('cm-card');
      const h = { card:c.card, c };
      hand.push(h); pool.push(c.card); order();
      const p = landing();
      S.cardDeal(); Foil.flutter();
      await glide(c.body, { x:p.x, y:p.y, r:p.r, s, z:0, sx:1, sy:1 }, 300, { arc:20, easing:ease.out });
      S.cardLanded(); DealerDeck.puff(c.el); Haptic.tick(6);
      squash(c.body, .05, 160);
      screens();
    })));
    deckCount();
  }
  window.CareerMain = {
    get root(){ return root; }, get felt(){ return felt; }, get station(){ return station; },
    get wallet(){ return wallet; },
    set wallet(v){ wallet = v; $('#cm-reel').innerHTML = reel(v); },
    showBank(v){ $('#cm-reel').innerHTML = reel(v); },
    get reelEl(){ return $('#cm-reel'); },
    get busy(){ return busy; }, set busy(v){ busy = !!v; },
    get cards(){ return hand.length; }, get deck(){ return next.length; }, get pool(){ return pool.length; },
    keyEl:k => $(`[data-key="${k}"]`),
    get scale(){ return s; }, get pad(){ return padEl; }, raise,
    screens, layDown,
    // chips home: the reel counts them in
    countIn:v => countTo(wallet + v)
  };

  /* ---------------- input ---------------- */
  let ptr = null;
  // the spot is printed on the felt, under everything on it
  const inside = (el, e) => { const r = el.getBoundingClientRect(); return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; };
  const local = e => { const f = felt.getBoundingClientRect(); return { x:e.clientX - f.left, y:e.clientY - f.top }; };
  function down(e){
    if (ptr || e.button > 0 || CardInspect.isOpen || window.CareerShop?.out) return;
    const p = local(e), now = performance.now();
    ptr = { id:e.pointerId, x0:p.x, y0:p.y, x:p.x, y:p.y, t:now, hist:[{ x:p.x, y:p.y, t:now }] };
    const onDeck = e.target.closest('.cm-station'), onCard = e.target.closest('.cm-card'), onPad = inside(padEl, e);
    if (onDeck){
      ptr.mode = 'deck';
      station.classList.add('is-pressed'); Haptic.tick(5);
    } else if (onPad && !onCard && !e.target.closest('.vm-loose')){
      ptr.mode = 'pad'; padEl.classList.add('is-pressed'); Haptic.tick(5);
    } else if (onCard){
      const h = hand.find(q => q.c.el === onCard);
      if (!h || busy){ ptr = null; return; }
      ptr.mode = 'card'; ptr.h = h; ptr.dx = h.c.body.x - p.x; ptr.dy = h.c.body.y - p.y;
      // picked up: it comes to the top of the pile
      hand.splice(hand.indexOf(h), 1); hand.push(h); order();
      felt.classList.add('is-carrying');
      h.c.body.set({ live:true });
    } else { ptr = null; return; }
    try { felt.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function move(e){
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = local(e), now = performance.now();
    ptr.x = p.x; ptr.y = p.y;
    ptr.hist.push({ x:p.x, y:p.y, t:now }); while (ptr.hist.length > 2 && now - ptr.hist[0].t > 90) ptr.hist.shift();
    const far = Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > 8;
    if (ptr.mode === 'deck' && far){ station.classList.remove('is-pressed'); ptr.mode = 'off'; }
    if (ptr.mode === 'pad' && far){ padEl.classList.remove('is-pressed'); ptr.mode = 'off'; }
    if (ptr.mode === 'card'){
      const h = ptr.h, v = vel(ptr);
      h.c.body.set({ x:p.x + ptr.dx, y:p.y + ptr.dy, z:8, r:clamp(v.x / 90, -14, 14), s:s * 1.04 });
      slotEl.classList.toggle('is-near', overSlot(e.clientX, e.clientY));
    }
  }
  function vel(q){
    const h = q.hist, a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000);
    return { x:(b.x - a.x) / dt, y:(b.y - a.y) / dt };
  }
  function up(e, cancel){
    if (!ptr || e.pointerId !== ptr.id) return;
    const q = ptr; ptr = null;
    const moved = Math.hypot(q.x - q.x0, q.y - q.y0) > 8, quick = performance.now() - q.t < 300;
    if (q.mode === 'deck'){ station.classList.remove('is-pressed'); if (!cancel) drawOne(); return; }
    if (q.mode === 'pad'){ padEl.classList.remove('is-pressed'); if (!cancel) cleanUp(); return; }
    if (q.mode !== 'card') return;
    const h = q.h;
    felt.classList.remove('is-carrying'); slotEl.classList.remove('is-near');
    h.c.body.set({ live:false });
    if (!moved && quick && !cancel){ h.c.body.set({ s, z:0 }); inspect(h); return; }
    if (!cancel && overSlot(e.clientX, e.clientY)){ feed(h); return; }
    // let go: it slides on a little and settles where you left it
    const v = vel(q), W = felt.clientWidth, H = felt.clientHeight, hw = CW * s / 2, hh = CH * s / 2;
    const x = clamp(h.c.body.x + v.x * .08, hw * .6, W - hw * .6), y = clamp(h.c.body.y + v.y * .08, hh * .5, H - hh * .5);
    const r = clamp(h.c.body.r + v.x / 200, -24, 24);
    glide(h.c.body, { x, y, r, s, z:0 }, 200, { easing:ease.out }).then(() => { squash(h.c.body, .05, 160); S.cardLanded(); });
  }
  function inspect(h){
    CardInspect.open({
      host:document.getElementById('home'),
      items:hand.slice().reverse().map(q => ({ card:q.card, source:() => q.c.el })),
      index:hand.length - 1 - hand.indexOf(h),
      key:{ label:'PLAY', press:async (item, idx, api) => { await api.close(); const t = hand.find(q => q.card === item.card); if (t) feed(t); } }
    });
  }

  /* ---------------- start ---------------- */
  async function setup(){
    build();
    marks();
    $('#cm-reel').innerHTML = reel(wallet);
    measure();
    fillPool();
    shuffleOrder(); deckCount();
    screens();
    await wait(500);
    busy = true; await deal(3); busy = false;
    new ResizeObserver(() => measure()).observe(felt);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
