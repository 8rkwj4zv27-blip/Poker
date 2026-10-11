/* ============================================================
   CAREER MAIN — the simplified Career hub, moving (lab only).

   The owner's brief (11 Oct): the bankroll reel full width across the top
   of the cabinet; the plain card slot in the middle, exactly a card wide,
   a CRT either side, slim and level. On the felt: three cards thrown well
   apart (picked for reasons, never labelled: the next step up, the safe
   one, the stretch); the deck in the corner (tap: another card, and the
   hand shuffles up to make room; hold: the cards fly back and three fresh
   are dealt); the chips in the other corner, CoinWorld's own chips piled
   as the table piles its pot, sized by the bankroll, to play with (pick
   one up and throw it, it bounces and knocks towers over; double tap
   tidies them). Drag a card up into the slot, or tap it to inspect it
   (the shared inspect screen) and press PLAY: the card feeds in, the
   entry is paid in chips through the slot, and the game would seat you.
   The key bay: SHOP · PLAY · CARDS.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, ease, tween, wait, glide, squash, puff, jolt, S, Foil, Haptic } = PO;
  const CW = 82, CH = 120;
  const CWd = window.CoinWorld;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const rr = (a, b) => a + Math.random() * (b - a);

  // the two screens, three ways (TUNE): they share one grid either way
  const SCREENS = { pair:'LABEL + FIGURE', big:'BIG FIGURE', lamp:'ONE LINE' };
  const BANKS = [620, 12650, 186400];
  const SHAPES = { pyramid:'PYRAMID', heap:'HEAP', rows:'ROWS' };
  const look = { screens:SCREENS[state.screens] ? state.screens : 'pair', bank:+state.bank || BANKS[1], shape:SHAPES[state.shape] ? state.shape : 'pyramid' };
  let wallet = look.bank, played = 14;

  // where each card lands, as fractions of the spread (x, y, tilt): a new
  // card shuffles the hand up into the next layout
  const PLACES = {
    1:[[.5, .48, 2]],
    2:[[.3, .46, -6], [.7, .52, 5]],
    3:[[.17, .4, -7], [.5, .56, 3], [.83, .38, 9]],
    4:[[.24, .28, -6], [.74, .25, 5], [.3, .74, 4], [.76, .72, -8]],
    5:[[.18, .27, -8], [.5, .22, 2], [.82, .29, 9], [.33, .74, 5], [.69, .76, -6]]
  };
  const MAX_OUT = 5, HOLD_MS = 480;

  let root, felt, stage, deckEl, slotEl, mouthEl;
  let geo = null;                // the felt's measures (spread, card scale, deck)
  const hand = [];               // the cards on the felt: { card, c, x, y, r }
  let pool = [];                 // the cards in your case (the deck deals from these)
  let busy = false, fed = null;  // a card in the slot, waiting for PLAY
  const $ = s => root.querySelector(s);

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
    const el = $('.cm-crt-' + side), k = look.screens;
    const html = k === 'pair' ? `<span class="crt-caption">${cap}</span><span class="crt-figure crt-figure--lg">${fig}</span>`
      : k === 'big' ? `<span class="crt-figure crt-figure--lg">${fig}</span><span class="crt-caption">${cap}</span>`
      : `<span class="crt-row"><i class="crt-lamp"></i><span class="crt-line">${fig} ${cap}</span></span>`;
    el.innerHTML = `<div class="crt cm-crt is-${k}"${ink ? ` data-ink="${ink}"` : ''}>${html}</div>`;
  }
  function screens(){
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
    return tween(Math.min(900, 300 + Math.abs(to - from) / 40), e => {
      const v = Math.round(mix(from, to, e));
      if (v !== countTo.last){ countTo.last = v; $('#cm-reel').innerHTML = reel(v); }
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
      <section class="cm-felt" data-theme="emerald"><div class="felt"></div><i class="cm-spread"></i>
        <div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>
        <div class="cm-deck" aria-label="The deck: tap for a card, hold to gather them up">${'<div class="cm-deck-card ds-swatch" data-cb="crest"><div class="card back"></div></div>'.repeat(5)}</div></section>
      <footer class="cm-console"><div class="ec-bay"><div class="actions-row cm-keys"><button class="btn-check" type="button" data-key="shop">SHOP</button><button class="btn-raise" type="button" data-key="play">PLAY</button><button class="btn-check" type="button" data-key="cards">CARDS</button></div></div></footer>
      <section class="po-sheet cm-sheet" id="cm-sheet" hidden aria-label="Tune">
        <h2>CAREER · MAIN</h2>
        <p>Tap the deck for a card, hold it to gather them up. Drag a card into the slot, or tap it to look. Throw the chips about; double tap to tidy.</p>
        <h3>SCREENS</h3>${seg('screens', SCREENS)}
        <h3>CHIPS TIDY INTO</h3>${seg('shape', SHAPES)}
        <h3>BANKROLL</h3>${seg('bank', Object.fromEntries(BANKS.map(b => [b, money(b)])))}
        <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cm-done">DONE</button></div>
      </section>`;
    document.body.classList.add('cm-lab');
    const home = document.getElementById('home');
    home.classList.add('cm-home'); home.classList.remove('hidden');
    [...home.classList].filter(c => c.startsWith('hb-')).forEach(c => home.classList.remove(c));
    const oldFelt = document.getElementById('felt'); if (oldFelt) oldFelt.id = 'cm-parked-felt';
    home.append(root);
    felt = $('.cm-felt');
    felt.querySelector('.felt').id = 'felt';
    stage = { el:felt, objects:felt.querySelector('.po-objects'), shadows:felt.querySelector('.po-shadows'), fx:felt.querySelector('.po-fx') };
    deckEl = $('.cm-deck'); slotEl = $('.cm-slot'); mouthEl = $('.cm-mouth');
    $('#cm-tune').onclick = () => { $('#cm-sheet').hidden = !$('#cm-sheet').hidden; };
    $('#cm-done').onclick = () => { $('#cm-sheet').hidden = true; };
    root.querySelectorAll('.cm-seg[data-key] button').forEach(b => b.onclick = () => {
      const key = b.parentNode.dataset.key;
      look[key] = key === 'bank' ? +b.dataset.v : b.dataset.v;
      if (host) host.set({ [key]:look[key] });
      marks();
      if (key === 'screens') screens();
      if (key === 'shape' && bank){ bank.shape = look.shape; bank.neat = false; CWd.tidyZone(bank); }
      if (key === 'bank'){ wallet = look.bank; $('#cm-reel').innerHTML = reel(wallet); chips(); }
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

  /* ---------------- measures ---------------- */
  // the spread is fixed (it never moves with the chips); the cards take one
  // scale for every layout, and the slot's mouth is exactly that wide
  function measure(){
    const W = felt.clientWidth, H = felt.clientHeight;
    const sx = 12, sy = 12, sw = W - 24, sh = Math.round(H * .62);
    const s = Math.min(1.25, (sw - 24) / (CW * 3.3), (sh - 16) / (CH * 2.1));
    const ds = s * .62;
    geo = { W, H, sx, sy, sw, sh, s, ds, deck:{ x:16 + CW * ds / 2, y:H - 18 - CH * ds / 2 } };
    Object.assign($('.cm-spread').style, { left:sx + 'px', top:sy + 'px', width:sw + 'px', height:sh + 'px' });
    deckEl.style.setProperty('--s', ds.toFixed(3));
    root.style.setProperty('--cm-card', Math.round(CW * s) + 'px');
  }
  const place = (n, i, jit) => {
    const [fx, fy, r] = PLACES[n][i];
    return { x:geo.sx + fx * geo.sw + (jit ? rr(-5, 5) : 0), y:geo.sy + fy * geo.sh + (jit ? rr(-4, 4) : 0), r:r + (jit ? rr(-3, 3) : 0) };
  };

  /* ---------------- the cards ---------------- */
  // your case: placeholder cards across the venues (the lab's own)
  function fillPool(){
    const ids = [['table', 'common', 'back-room-five'], ['freezeout', 'common', 'back-room-freezeout'], ['table', 'uncommon', 'pub-open'],
      ['bomb', 'uncommon', 'pub-turbo'], ['freezeout', 'rare', 'pub-freezeout'], ['table', 'rare', 'card-club-six'],
      ['bomb', 'common', 'card-club-deep'], ['table', 'legendary', 'casino-main'], ['freezeout', 'uncommon', 'back-room-heads-up']];
    pool = ids.map(a => EventCards.make(...a));
  }
  // three for a reason, never labelled: the safe one (cheapest entry), the
  // next step (the best prize for its entry you can afford), the stretch
  // (the biggest prize you can afford); the rest of the case is the deck
  function chooseThree(){
    const d = c => EventCards.describe(c), top = c => d(c).payouts[0] || 0;
    const can = pool.filter(c => d(c).entry <= wallet), from = can.length >= 3 ? can : pool.slice().sort((a, b) => d(a).entry - d(b).entry);
    const out = [];
    const take = c => { if (c && !out.includes(c)) out.push(c); };
    take(from.slice().sort((a, b) => d(a).entry - d(b).entry)[0]);
    take(from.filter(c => !out.includes(c)).sort((a, b) => top(b) / d(b).entry - top(a) / d(a).entry)[0]);
    take(from.filter(c => !out.includes(c)).sort((a, b) => top(b) - top(a))[0]);
    pool.forEach(c => { if (out.length < 3) take(c); });
    return out;
  }
  function deckPose(){ return { x:geo.deck.x, y:geo.deck.y - 4, z:0, s:geo.ds, r:0 }; }
  // one card off the top of the deck, flipped face up on the way
  async function deal(card, i, n){
    const c = CardInspect.make(stage, card, { side:'back' });
    c.el.classList.add('cm-card');
    CardInspect.setBank(c, 180);
    c.body.set({ ...deckPose(), sx:1, sy:1, alpha:1 });
    const h = { card, c, ...place(n, i, true) };
    hand.push(h);
    order();
    S.cardDeal(); Foil.flutter(); Haptic.tick(6);
    jolt(deckEl, 2);
    const flip = wait(90).then(() => CardInspect.faceUp(c));
    await glide(c.body, { x:h.x, y:h.y, r:h.r, s:geo.s, z:0 }, 300, { arc:34, easing:ease.out, spin:8 });
    await flip;
    squash(c.body, .07, 200); S.cardLanded(); puff(stage, h.x, h.y + CH * geo.s / 2 - 4, CW * geo.s * .6, { n:6 });
    screens();
  }
  // the hand shuffles into the layout for n cards (its own size by default)
  function relay(n = hand.length){
    return Promise.all(hand.map((h, i) => {
      Object.assign(h, place(n, i, true));
      return glide(h.c.body, { x:h.x, y:h.y, r:h.r, z:0 }, 260, { arc:10, easing:ease.inOut });
    }));
  }
  function order(){ hand.forEach((h, i) => { h.c.el.style.zIndex = String(60 + i); }); }
  async function drawOne(){
    if (busy) return;
    const left = pool.filter(c => !hand.some(h => h.card === c));
    if (hand.length >= MAX_OUT || !left.length){ Foil.thud(.3); Haptic.tick(6); jolt(deckEl, 3); say(['FELT', 'FULL'], ['HOLD', 'DECK']); return; }
    busy = true;
    const card = left[Math.floor(Math.random() * left.length)];
    const n = hand.length + 1;
    // the others shuffle up to make room while the new one flies
    relay(n);
    await deal(card, hand.length, n);
    busy = false;
  }
  // hold the deck: every card flies home, the deck riffles, three fresh
  async function gather(){
    if (busy) return;
    busy = true;
    S.wheelRelease(); Haptic.tick(12, 0);
    const home = deckPose();
    await Promise.all(hand.splice(0).map((h, i) => wait(i * 55).then(async () => {
      Foil.flutter();
      await CardInspect.faceUp(h.c);
      CardInspect.setBank(h.c, 180);
      await glide(h.c.body, { ...home, z:0 }, 240, { arc:22, easing:ease.in });
      S.cardReturn(); h.c.body.remove(); jolt(deckEl, 2);
    })));
    screens();
    // the riffle: the deck shudders a few times with the shuffle's ticks
    for (let i = 0; i < 4; i++){ jolt(deckEl, 3); S.wheelTooth(); Haptic.tick(5, 40); await wait(70); }
    S.wheelCatch();
    const three = chooseThree();
    for (let i = 0; i < three.length; i++){ deal(three[i], i, 3); await wait(140); }
    await wait(320);
    busy = false;
  }

  /* ---------------- the slot ---------------- */
  function slotPoint(){
    const m = mouthEl.getBoundingClientRect(), f = felt.getBoundingClientRect();
    return { x:m.left + m.width / 2 - f.left, y:m.top + m.height / 2 - f.top, w:m.width };
  }
  function overSlot(cx, cy){
    const m = slotEl.getBoundingClientRect();
    return cx > m.left - 16 && cx < m.right + 16 && cy < m.bottom + 34;
  }
  // feed a card in: it squares up under the mouth, then the rollers take it
  // in four ratchet teeth, the cabinet shuddering at each
  async function feed(h){
    if (fed) return;
    busy = true;
    const i = hand.indexOf(h); if (i >= 0) hand.splice(i, 1);
    const p = slotPoint(), s = geo.s, c = h.c;
    c.el.style.zIndex = '90';
    await CardInspect.faceUp(c);
    S.cardDeal();
    await glide(c.body, { x:p.x, y:p.y + CH * s / 2 + 6, r:0, s, z:0 }, 220, { easing:ease.out });
    // the card's top edge disappears into the mouth as it goes in
    const clipAt = () => Math.max(0, p.y - (c.body.y - CH * s / 2)) / s;
    for (let t = 1; t <= 4; t++){
      const y = p.y + CH * s / 2 + 6 - (CH * s + 12) * t / 4;
      await tween(70, e => { c.body.set({ y:mix(c.body.y, y, e) }); c.el.style.clipPath = `inset(${clipAt().toFixed(1)}px 0 0 0)`; }, ease.out);
      S.wheelTooth(); Haptic.tick(8, 30); jolt(slotEl, 2);
      await wait(60);
    }
    S.wheelLock(); Haptic.tick(16, 0); jolt(root.querySelector('.cm-cabinet'), 3);
    c.body.remove();
    fed = h;
    slotEl.classList.add('is-fed');
    $('[data-key="play"]').classList.add('is-ready');
    screens();
    await relay();
    busy = false;
  }
  // PLAY with a card in: the entry goes in as chips, the reel counts it off
  async function play(){
    if (busy) return;
    if (!fed){
      // no card in yet: the first card on the felt goes in
      if (hand.length) feed(hand[0]); else { Foil.thud(.3); say(['NO CARDS', '0'], ['TAP', 'DECK']); }
      return;
    }
    const d = EventCards.describe(fed.card);
    if (d.entry > wallet){ Foil.thud(.4); Haptic.tick(20, 0); say(['ENTRY', money(d.entry)], ['SHORT', money(d.entry - wallet)]); return; }
    busy = true;
    await Promise.all([pay(wallet - d.entry), countTo(wallet - d.entry)]);
    played++;
    pool = pool.filter(c => c !== fed.card);
    say(['SEATED', 'GO'], ['TABLE', 'NEXT'], 2200);
    Foil.chord([523, 659, 784], .6);
    fed = null;
    slotEl.classList.remove('is-fed');
    $('[data-key="play"]').classList.remove('is-ready');
    if (!pool.length) fillPool();
    busy = false;
  }
  function key(b){
    jolt(b, 2); Haptic.tick(8);
    const k = b.dataset.key;
    if (k === 'play') return play();
    say([k === 'shop' ? 'SHOP' : 'CARDS', 'SOON'], ['ROLLS', k === 'shop' ? 'DOWN' : 'UP']);
  }

  /* ---------------- the chips ---------------- */
  // CoinWorld's own chips, piled as the table piles its pot (potSlots:
  // pyramid, heap or rows), the count from the bankroll on the table's
  // bank curve, the colours by the game's change-making
  let bank = null;
  const cap = 120;
  const chipCount = b => b > 0 ? Math.max(3, Math.min(cap, Math.round(4 + 38 * Math.log10(1 + b / 20 / 8)))) : 0;
  const mixFor = b => CWd.composeTiers(Math.round(b / 10), chipCount(b)).counts;
  function chipsHost(){
    CWd.OPT.size = 'l';
    CWd.setHost(felt, [1, 3]);
    CWd.ensureLayers();
    CWd.alignLayers();
    const r = deckEl.getBoundingClientRect();
    CWd.setExtraBlocks([{ L:r.left, T:r.top, R:r.right, B:r.bottom }]);
    CWd.buildWalls();
  }
  function pileBox(){
    const f = felt.getBoundingClientRect(), w = Math.min(170, f.width * .46);
    return { L:f.right - 18 - w, R:f.right - 18, T:f.bottom - 24 - 64, B:f.bottom - 24 };
  }
  function chips(){
    chipsHost();
    if (bank) bank.list.slice().forEach(b => { CWd.removeBody(b); b.el.remove(); });
    const k = pileBox();
    bank = CWd.zone('cm-bank', (k.L + k.R) / 2, k.B, cap, 40, 600);
    bank.pile = k; bank.room = 84; bank.shape = look.shape;
    const cols = [];
    mixFor(wallet).forEach((n, t) => { for (let i = 0; i < n; i++) cols.push('t' + t); });
    const { extras } = CWd.planZone(bank, cols);
    cols.forEach((col, i) => {
      const p = extras[i], b = CWd.body(CWd.makeChip(col), p.x, p.y, p.z, CWd.D());
      b.zone = bank; bank.list.push(b);
      CWd.toRest(b);
    });
    bank.neat = true;
    CWd.kick();
  }
  const tiersOf = () => { const c = CWd.TIERS().map(() => 0); bank.list.forEach(b => { c[+b.colour.slice(1)]++; }); return c; };
  const topOf = col => bank.list.filter(b => b.colour === col && b.state === 'rest').sort((a, b) => b.z - a.z)[0];
  // pay to a new total: the chips it no longer has fly up into the slot;
  // change it's owed drops onto the pile
  async function pay(to){
    const want = mixFor(to), have = tiersOf(), f = felt.getBoundingClientRect(), p = slotPoint();
    const flights = [], adds = [];
    want.forEach((n, t) => {
      for (let k = have[t]; k > n; k--){
        const b = topOf('t' + t); if (!b) break;
        CWd.removeFromZone(b);
        flights.push(CWd.launch(b, { x:f.left + p.x, y:f.top + p.y, z:0, vanish:true }, { T:.42, wait:flights.length * 45, flips:2 }));
      }
      for (let k = have[t]; k < n; k++) adds.push('t' + t);
    });
    if (flights.length) S.chipBounce(.7);
    await Promise.all(flights);
    if (adds.length){
      CWd.pileAdd(bank, adds).forEach((at, i) => {
        const b = CWd.body(CWd.makeChip(adds[i]), at.x, at.y, at.z + 70, CWd.D());
        b.zone = bank; bank.list.push(b);
        drop(b, 0, 0, 0, i * 40);
      });
      await wait(700);
    }
    // the pile squares itself up after paying
    bank.neat = false;
    CWd.tidyZone(bank);
  }
  // put a chip in the air with a velocity; CoinWorld lands it, bounces it,
  // knocks what it hits, slides it and seats it on the pile's grid
  function drop(b, vx, vy, vz, delay = 0){
    Object.assign(b, { target:{}, opts:{}, bounces:0, maxB:2, e:.3, knocked:false, inFelt:true, edge:false,
      vx, vy, vz, phi:0, t:.1, T:0, d0:b.d, d1:b.d, rx:0 });
    const speed = Math.hypot(vx, vy);
    b.fr = speed > 160 || vz > 120 ? Math.PI * 2 * (1 + Math.floor(Math.random() * 2)) / .4 : 0;
    b.wait = delay; b.state = 'wait'; b.next = 'fall';
    bank.neat = false;
    CWd.active.add(b); CWd.kick();
  }
  // the chip under a point (felt-relative), the topmost one drawn there
  function chipAt(x, y){
    const f = felt.getBoundingClientRect(), px = x + f.left, py = y + f.top;
    let best = null, bz = -1;
    if (!bank) return null;
    bank.list.forEach(b => {
      const d = b.d, H = d * 1.2, L = b.x - d / 2 - 4, T = b.y - b.z - H - 4;
      if (px < L || px > L + d + 8 || py < T || py > T + H + 8) return;
      const z = b.y * 4 + b.z;
      if (z > bz){ bz = z; best = b; }
    });
    return best;
  }

  /* ---------------- input ---------------- */
  let ptr = null, lastTap = { t:0, x:0, y:0 }, holdT = 0;
  const local = e => { const f = felt.getBoundingClientRect(); return { x:e.clientX - f.left, y:e.clientY - f.top }; };
  function down(e){
    if (ptr || e.button > 0 || CardInspect.isOpen) return;
    const p = local(e), now = performance.now();
    if (busy){ PO.finishAll(); return; }
    ptr = { id:e.pointerId, x0:p.x, y0:p.y, x:p.x, y:p.y, t:now, hist:[{ x:p.x, y:p.y, t:now }] };
    const onDeck = e.target.closest('.cm-deck'), onCard = e.target.closest('.cm-card'), chip = !onCard && !onDeck && chipAt(p.x, p.y);
    if (onDeck){
      ptr.mode = 'deck';
      deckEl.classList.add('is-pressed'); Haptic.tick(5);
      holdT = setTimeout(() => { if (ptr?.mode === 'deck'){ ptr.mode = 'held'; deckEl.classList.remove('is-pressed'); gather(); } }, HOLD_MS);
    } else if (onCard){
      const h = hand.find(q => q.c.el === onCard);
      if (!h){ ptr = null; return; }
      ptr.mode = 'card'; ptr.h = h; ptr.dx = h.c.body.x - p.x; ptr.dy = h.c.body.y - p.y;
      h.c.el.style.zIndex = '90'; felt.classList.add('is-carrying');
      h.c.body.set({ live:true });
    } else if (chip){
      const top = chip.state === 'rest' ? CWd.stackAt(chip)[0] || chip : chip;
      ptr.mode = 'chip'; ptr.b = top;
      CWd.active.delete(top);
      top.state = 'held'; top.tilt = 1; top.rx = 0;
      grabChip(top, p);
      S.chipBounce(.7); Haptic.tick(6);
    } else ptr.mode = 'felt';
    try { felt.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function grabChip(b, p){
    const f = felt.getBoundingClientRect();
    b.x = p.x + f.left; b.y = p.y + f.top + 10; b.z = 16;
    CWd.dirty.add(b); CWd.kick();
  }
  function move(e){
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = local(e), now = performance.now();
    ptr.x = p.x; ptr.y = p.y;
    ptr.hist.push({ x:p.x, y:p.y, t:now }); while (ptr.hist.length > 2 && now - ptr.hist[0].t > 90) ptr.hist.shift();
    const far = Math.hypot(p.x - ptr.x0, p.y - ptr.y0) > 8;
    if (ptr.mode === 'deck' && far){ clearTimeout(holdT); deckEl.classList.remove('is-pressed'); ptr.mode = 'felt'; }
    if (ptr.mode === 'card'){
      const h = ptr.h, v = vel();
      h.c.body.set({ x:p.x + ptr.dx, y:p.y + ptr.dy, z:8, r:clamp(v.x / 90, -14, 14), s:geo.s * 1.04 });
      slotEl.classList.toggle('is-near', overSlot(e.clientX, e.clientY));
    }
    if (ptr.mode === 'chip') grabChip(ptr.b, p);
  }
  function vel(q = ptr){
    const h = q.hist, a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000);
    return { x:(b.x - a.x) / dt, y:(b.y - a.y) / dt };
  }
  function up(e, cancel){
    if (!ptr || e.pointerId !== ptr.id) return;
    const q = ptr; ptr = null;
    clearTimeout(holdT);
    const moved = Math.hypot(q.x - q.x0, q.y - q.y0) > 8, quick = performance.now() - q.t < 300;
    if (q.mode === 'deck'){ deckEl.classList.remove('is-pressed'); if (!cancel) drawOne(); return; }
    if (q.mode === 'card'){
      const h = q.h; felt.classList.remove('is-carrying'); slotEl.classList.remove('is-near');
      h.c.body.set({ live:false });
      if (!moved && quick && !cancel){ order(); inspect(h); h.c.body.set({ s:geo.s, z:0 }); return; }
      if (!cancel && overSlot(e.clientX, e.clientY)){ feed(h); return; }
      // let go: it slides on a little and settles where you left it, inside the spread
      const v = vel(q), s = geo.s, hw = CW * s / 2, hh = CH * s / 2;
      h.x = clamp(h.c.body.x + v.x * .08, geo.sx + hw * .6, geo.sx + geo.sw - hw * .6);
      h.y = clamp(h.c.body.y + v.y * .08, geo.sy + hh * .5, geo.H - hh * .6);
      h.r = clamp(h.c.body.r + v.x / 200, -16, 16);
      hand.splice(hand.indexOf(h), 1); hand.push(h); order();
      glide(h.c.body, { x:h.x, y:h.y, r:h.r, s, z:0 }, 200, { easing:ease.out }).then(() => { squash(h.c.body, .05, 160); S.cardLanded(); });
      return;
    }
    if (q.mode === 'chip'){
      const b = q.b, v = vel(q);
      if (!moved && quick){
        // a tap: the chip hops and clacks back down; two taps tidy the pile
        drop(b, rr(-15, 15), 0, 150);
        tapped(q);
        return;
      }
      const sp = Math.min(1400, Math.hypot(v.x, v.y)), k = sp > 0 ? sp / Math.max(1, Math.hypot(v.x, v.y)) : 0;
      drop(b, v.x * k, v.y * k * .8, 90 + sp * .22);
      return;
    }
    if (q.mode === 'felt' && !moved && quick) tapped(q);
  }
  // two taps near the pile, close together: it tidies
  function tapped(q){
    const now = performance.now();
    if (now - lastTap.t < 340 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 60 && bank){
      lastTap.t = 0;
      setTimeout(() => { bank.neat = false; CWd.tidyZone(bank); Haptic.tick(10, 0); }, 260);
      return;
    }
    lastTap = { t:now, x:q.x, y:q.y };
  }
  function inspect(h){
    const i = hand.indexOf(h);
    CardInspect.open({
      host:document.getElementById('home'),
      items:hand.map(q => ({ card:q.card, source:() => q.c.el })),
      index:i,
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
    screens();
    chips();
    await wait(300);
    const three = chooseThree();
    for (let i = 0; i < three.length; i++){ deal(three[i], i, 3); await wait(150); }
    let tm = 0, size = felt.clientWidth + 'x' + felt.clientHeight;
    new ResizeObserver(() => {
      const now = felt.clientWidth + 'x' + felt.clientHeight;
      if (now === size) return;
      size = now; clearTimeout(tm); tm = setTimeout(() => { measure(); relay(); chips(); }, 120);
    }).observe(felt);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
