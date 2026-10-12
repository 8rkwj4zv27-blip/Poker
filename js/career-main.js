/* ============================================================
   CAREER MAIN — the Career hub: a wooden table on the felt (lab only).

   The owner's design (12 Oct, docs/career/CAREER_HUB_BRIEF.md, round 6):
   the cabinet is the bankroll reel and the card feeder, nothing else. On
   the felt, in its top third, a small wooden table with a soft bevel;
   three cards lie on it (tonight's choice: the regular one, a step up,
   the big one; never labelled). The console: SHOP · the middle key ·
   CARDS. The middle key says what it will do:
   - REDEAL: the three are swept off the felt and three more are tossed in.
   - PLAY: a card is in the feeder (dragged or flicked up into it, or
     swiped up out of the inspect screen): it hangs half in; PLAY takes it
     the rest of the way (the game would seat you: not wired). Tap the
     card in the feeder and it comes back out.
   - OPEN: back from the shop, the packets you sent lie on the table in a
     row, each on the one before; tap one (or OPEN for the top one) and
     it's opened on the felt (js/pack-opening.js, run by the shop).
   - ADD: an opened packet's cards lie in a pile on the felt; ADD squares
     them up and files them into your collection (the CARDS key).
   Everything on the felt can be picked up and moved about (press and
   drag: it lifts, its shadow drifts); a double tap anywhere on the felt
   puts everything back where it was. Tap a card to inspect it.
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
  let wallet = BANKS.includes(+state.bank) ? +state.bank : BANKS[1];

  let root, felt, stage, woodEl, slotEl, mouthEl, plateEl;
  let s = 1;                 // the cards' scale on the felt
  let phase = 'hand';        // hand · packets · opening · opened
  let busy = false;
  let pool = [];             // your case: every card you can play
  const hand = [];           // the cards on the table: { kind:'hand', card, c, place, home }
  const packets = [];        // the packets waiting: { kind:'pk', p, home }
  const heap = [];           // an opened packet's cards: { kind:'heap', card, c, home }
  let fed = null;            // the hand card in the feeder
  let zTop = 60;
  const $ = q => root.querySelector(q);
  const raise = el => { el.style.zIndex = String(++zTop); };

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
  // a key: its label, lit (it'll do something) or unlit (its label goes
  // dark, like a lamp that's off); a new label flips over
  function setKey(b, label, on = true){
    b.disabled = !on;
    b.classList.toggle('cm-unlit', !on);
    if (b.dataset.label === label) return;
    b.dataset.label = label;
    const put = () => { b.textContent = label; b.classList.toggle('cm-long', label.length > 9); };
    if (PO.reduced || !b.textContent){ put(); return; }
    b.classList.add('cm-flip');
    setTimeout(() => { put(); b.classList.remove('cm-flip'); }, 60);
  }
  const keyEl = k => $(`[data-key="${k}"]`);
  // what the middle key does now (the shop has the keys while it's out,
  // and while a packet is being opened)
  function keys(){
    if (window.CareerShop?.out) return;
    setKey(keyEl('shop'), 'SHOP'); setKey(keyEl('cards'), 'CARDS');
    const mid = phase === 'opened' ? 'ADD' : phase === 'packets' ? 'OPEN' : fed ? 'PLAY' : 'REDEAL';
    setKey(keyEl('play'), mid, phase !== 'opening');
    keyEl('play').classList.toggle('is-ready', !!fed);
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
        <div class="cm-row"><div class="cm-slot"><b class="cm-plate">INSERT CARD</b><div class="cm-mouth"><i class="cm-throat"></i></div></div></div>
      </div>
      <section class="cm-felt" data-theme="emerald"><div class="felt">
        <div class="cm-table"><div class="cm-wood">${[0, 1, 2].map(i => `<i class="cm-place" data-i="${i}"></i>`).join('')}</div></div>
        <div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>
      </div></section>
      <footer class="cm-console"><div class="cm-console-case"><div class="ec-bay"><div class="actions-row cm-keys"><button class="btn-check" type="button" data-key="shop">SHOP</button><button class="btn-raise" type="button" data-key="play">REDEAL</button><button class="btn-check" type="button" data-key="cards">CARDS</button></div></div></div></footer>
      <section class="po-sheet cm-sheet" id="cm-sheet" hidden aria-label="Tune">
        <h2>CAREER</h2>
        <p>REDEAL for three more. Drag a card about, or up into the feeder; tap it to look (swipe it up from there to feed it); PLAY takes it. Double tap the felt to put everything back.</p>
        <h3>BANKROLL</h3>${seg('bank', Object.fromEntries(BANKS.map(b => [b, money(b)])))}
        <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cm-done">DONE</button></div>
      </section>`;
    document.body.classList.add('cm-lab');
    const home = document.getElementById('home');
    home.classList.add('cm-home'); home.classList.remove('hidden');
    [...home.classList].filter(c => c.startsWith('hb-')).forEach(c => home.classList.remove(c));
    home.append(root);
    felt = $('.cm-felt > .felt');
    stage = { el:felt, objects:felt.querySelector('.po-objects'), shadows:felt.querySelector('.po-shadows'), fx:felt.querySelector('.po-fx') };
    woodEl = $('.cm-wood'); slotEl = $('.cm-slot'); mouthEl = $('.cm-mouth'); plateEl = $('.cm-plate');
    $('#cm-tune').onclick = () => { $('#cm-sheet').hidden = !$('#cm-sheet').hidden; };
    $('#cm-done').onclick = () => { $('#cm-sheet').hidden = true; };
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
  // three cards across the table, as big as the felt allows
  function measure(){
    s = Math.min(1.3, (felt.clientWidth - 64) / (CW * 3 + 28));
    root.style.setProperty('--cm-card', Math.round(CW * s) + 'px');
    root.style.setProperty('--cm-card-h', Math.round(CH * s) + 'px');
  }
  const local = r => { const f = felt.getBoundingClientRect(); return { x:r.left + r.width / 2 - f.left, y:r.top + r.height / 2 - f.top }; };
  const SKEW = [-2, 1, -1];
  function placeAt(i){ return { ...local($(`.cm-place[data-i="${i}"]`).getBoundingClientRect()), r:SKEW[i] }; }
  // the packets: one to a place, or more in a row, each lying on the one before
  const pkScale = () => CH * s / POPacket.AH;
  function rowAt(i, n){
    const a = placeAt(0), b = placeAt(2), gap = (b.x - a.x) / 2;
    const step = n > 1 ? Math.min(gap, (b.x - a.x) / (n - 1)) : 0;
    return { x:(a.x + b.x) / 2 + (i - (n - 1) / 2) * step, y:a.y };
  }
  // an opened packet's cards: a loose heap on the open felt
  const HEAP = [[-34, 10, -14], [-8, -6, -4], [20, 4, 9], [40, -2, 18], [-20, 22, 6], [8, 18, -10]];
  function heapAt(i){
    const t = woodEl.getBoundingClientRect(), f = felt.getBoundingClientRect(), top = t.bottom - f.top;
    const [dx, dy, r] = HEAP[i % HEAP.length];
    return { x:felt.clientWidth / 2 + dx * s, y:top + (felt.clientHeight - top) * .48 + dy * s, r };
  }
  function homes(){
    hand.forEach(h => { h.home = placeAt(h.place); });
    packets.forEach((k, i) => { k.home = { ...rowAt(i, packets.length), r:k.tilt }; });
    heap.forEach((h, i) => { h.home = heapAt(i); });
  }
  // the feeder's lower lip, where a card comes out, in the felt's coordinates
  function lip(){ const r = mouthEl.getBoundingClientRect(), f = felt.getBoundingClientRect(); return { x:r.left + r.width / 2 - f.left, y:r.bottom - 4 - f.top }; }

  /* ---------------- your case ---------------- */
  // placeholder cards across the venues (the lab's own)
  function fillPool(){
    const ids = [['table', 'common', 'back-room-five'], ['freezeout', 'common', 'back-room-freezeout'], ['table', 'uncommon', 'pub-open'],
      ['bomb', 'uncommon', 'pub-turbo'], ['freezeout', 'rare', 'pub-freezeout'], ['table', 'rare', 'card-club-six'],
      ['bomb', 'common', 'card-club-deep'], ['table', 'legendary', 'casino-main'], ['freezeout', 'uncommon', 'back-room-heads-up'],
      ['table', 'common', 'back-room-heads-up'], ['bomb', 'rare', 'pub-open'], ['freezeout', 'common', 'card-club-six']];
    pool = ids.map(a => EventCards.make(...a));
  }
  // the three for the table: one from the bottom third of your case by
  // prize (the regular one), one from the middle (a step up), one from the
  // top (the big one); not the ones just swept away, if there's a choice
  function chooseThree(not = []){
    const by = pool.slice().sort((a, b) => a.prize - b.prize), n = by.length, out = [];
    [[0, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 1]].forEach(([a, b]) => {
      const band = by.slice(Math.floor(a * n), Math.max(Math.floor(a * n) + 1, Math.ceil(b * n))).filter(c => !out.includes(c));
      const fresh = band.filter(c => !not.includes(c));
      const c = pick(fresh.length ? fresh : band.length ? band : by.filter(q => !out.includes(q)));
      if (c) out.push(c);
    });
    return out;
  }

  /* ---------------- cards on the table ---------------- */
  function cardBody(card, pose){
    const c = CardInspect.make(stage, card, { side:'face' });
    c.el.classList.add('cm-card');
    c.body.set({ z:0, sx:1, sy:1, alpha:1, s, ...pose });
    c.body.render(performance.now());
    raise(c.el);
    return c;
  }
  // tossed in from off the left of the felt, one after another, onto the table
  async function tossIn(cards, places = [0, 1, 2]){
    await Promise.all(cards.map((card, k) => wait(PO.reduced ? 0 : k * 110).then(async () => {
      const place = places[k], to = placeAt(place);
      const c = cardBody(card, { x:-CW * s, y:to.y + rr(30, 70), r:rr(-40, -20), z:30 });
      const h = { kind:'hand', card, c, place, home:to };
      hand.push(h);
      S.cardDeal(); Foil.flutter();
      await glide(c.body, { ...to, z:0 }, 380, { arc:26, easing:ease.out });
      S.cardLanded(); Haptic.tick(6);
      puff(stage, to.x, to.y + CH * s * .45, CW * s, { n:4, colour:'#3a2414' });
      squash(c.body, .05, 160);
    })));
  }
  // swept off the right of the felt, back into your case
  async function sweepOff(list){
    const W = felt.clientWidth;
    await Promise.all(list.map((h, k) => wait(PO.reduced ? 0 : k * 70).then(async () => {
      raise(h.c.el); Foil.flutter();
      await glide(h.c.body, { x:W + CW * s, y:h.c.body.y + rr(-24, 24), r:h.c.body.r + rr(20, 40), z:6 }, 280, { easing:ease.in });
      h.c.body.remove();
    })));
  }
  async function redeal(){
    if (busy || phase !== 'hand' || fed) return;
    busy = true;
    S.cardReturn(); Haptic.tick(10);
    const was = hand.map(h => h.card);
    await sweepOff(hand.splice(0));
    await wait(PO.reduced ? 0 : 80);
    await tossIn(chooseThree(was));
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
  async function feed(h, { placed = false } = {}){
    if (fed || busy || phase !== 'hand') return;
    busy = true;
    const m = lip(), c = h.c, below = m.y + CH * s / 2 + 2;
    fed = h; keys();
    c.el.style.zIndex = '90';
    c.body.sh?.style.setProperty('visibility', 'hidden');
    if (!placed){ S.cardDeal(); await glide(c.body, { x:m.x, y:below, r:0, s, z:0 }, 240, { easing:ease.out }); }
    await teeth(c, m.y, 2);
    S.wheelLock(); Haptic.tick(14, 0); jolt($('.cm-cabinet'), 2);
    const d = EventCards.describe(h.card);
    plate((d.venue + ' · ' + d.title).toUpperCase());
    slotEl.classList.add('is-fed');
    busy = false;
  }
  // tap the card in the feeder: it comes back out and goes home
  async function unfeed(){
    if (!fed || busy) return;
    busy = true;
    const h = fed, c = h.c, m = lip();
    await teeth(c, m.y + CH * s / 2 + 2, 2);
    c.el.style.clipPath = '';
    c.body.sh?.style.removeProperty('visibility');
    fed = null; slotEl.classList.remove('is-fed'); plate('INSERT CARD'); keys();
    S.cardReturn();
    await glide(c.body, { ...h.home, z:0, s }, 300, { arc:18, easing:ease.out });
    raise(c.el); S.cardLanded(); squash(c.body, .05, 140);
    busy = false;
  }
  // PLAY: the rest of the way in. The game would seat you at its table
  // here (not wired); the card is used up and another takes its place.
  async function play(){
    if (!fed || busy) return;
    busy = true;
    const h = fed, c = h.c;
    S.wheelCatch(); jolt(slotEl, 3);
    await teeth(c, lip().y - CH * s / 2 - 4, 3);
    S.wheelLock(); Haptic.tick(18, 0); jolt($('.cm-cabinet'), 3);
    c.body.remove();
    hand.splice(hand.indexOf(h), 1);
    pool = pool.filter(q => q !== h.card);
    if (pool.length < 4) fillPool();
    fed = null; slotEl.classList.remove('is-fed'); keys();
    await wait(PO.reduced ? 0 : 700);
    plate('INSERT CARD');
    const others = hand.map(q => q.card), fresh = chooseThree(others).filter(q => !others.includes(q));
    await tossIn([fresh[h.place] || fresh[0] || pick(pool)], [h.place]);
    busy = false;
  }

  /* ---------------- packets on the table ---------------- */
  // back from the shop: the cards are swept away and the packets you sent
  // drop onto the table, in a row, each on the one before
  async function addPackets(series){
    if (!series.length) return;
    busy = true;
    if (fed){ fed.c.el.style.clipPath = ''; fed = null; slotEl.classList.remove('is-fed'); plate('INSERT CARD'); }
    if (hand.length){ S.cardReturn(); await sweepOff(hand.splice(0)); }
    if (phase === 'hand') phase = 'packets';
    keys();
    const n = packets.length + series.length;
    packets.forEach((k, i) => { k.home = { ...rowAt(i, n), r:k.tilt }; glide(k.p.body, { ...k.home, z:0 }, 220, { easing:ease.out }); });
    for (const id of series){
      const p = new POPacket.Packet(stage, id, 0);
      p.tagEl.hidden = true; p.el.classList.add('cm-pk');
      const k = { kind:'pk', p, tilt:rr(-4, 4) };
      k.home = { ...rowAt(packets.length, n), r:k.tilt };
      packets.push(k);
      p.body.set({ x:k.home.x, y:-POPacket.AH * pkScale(), s:pkScale(), r:k.tilt - 30, z:30, sx:1, sy:1, alpha:1 });
      p.body.render(performance.now());
      raise(p.el);
      await p.ready;
      S.cardDeal(); Foil.flutter();
      await glide(p.body, { ...k.home, z:0 }, 300, { easing:ease.in });
      S.cardLanded(); Foil.thud(.4); Haptic.tick(8);
      puff(stage, k.home.x, k.home.y + CH * s * .45, CW * s, { n:4, colour:'#3a2414' });
      squash(p.body, .08, 180);
      await wait(PO.reduced ? 0 : 70);
    }
    busy = false;
  }
  // tap a packet (or OPEN for the one on top): it's opened on the felt
  function open(k){
    if (busy || phase !== 'packets' || !window.CareerShop) return;
    k = k || packets[packets.length - 1];
    if (!k) return;
    packets.splice(packets.indexOf(k), 1);
    phase = 'opening'; keys();
    homes();
    packets.forEach(q => glide(q.p.body, { ...q.home, z:0 }, 220, { easing:ease.out }));
    window.CareerShop.open(k.p);
  }
  // the opened packet's cards: laid down in a heap on the open felt
  async function layDown(cards){
    heap.length = 0;
    await Promise.all(cards.map((c, i) => wait(PO.reduced ? 0 : i * 110).then(async () => {
      const a = c.body.stage.el.getBoundingClientRect(), b = felt.getBoundingClientRect();
      c.body.set({ x:c.body.x + a.left - b.left, y:c.body.y + a.top - b.top });
      stage.objects.append(c.el); if (c.body.sh) stage.shadows.append(c.body.sh);
      c.body.stage = stage;
      c.el.classList.add('cm-card');
      const h = { kind:'heap', card:c.card, c, home:heapAt(i) };
      heap.push(h); raise(c.el);
      S.cardDeal(); Foil.flutter();
      await glide(c.body, { ...h.home, s, z:0, sx:1, sy:1 }, 300, { arc:20, easing:ease.out });
      S.cardLanded(); Haptic.tick(6);
      squash(c.body, .05, 160);
    })));
  }
  // the opening is over: the empty wrapper and the torn strip fall away off
  // the felt, and the heap waits for ADD
  function opened(rubbish){
    const H = felt.clientHeight;
    rubbish.filter(Boolean).forEach((b, i) => wait(PO.reduced ? 0 : i * 60).then(() => {
      Foil.crinkle();
      return glide(b, { y:b.y + H * .8, r:b.r + rr(-120, 120), z:10, alpha:0 }, 520, { easing:ease.in, arc:20 });
    }).then(() => b.remove()));
    phase = heap.length ? 'opened' : packets.length ? 'packets' : 'hand';
    keys();
    if (phase === 'hand') dealFresh();
  }
  // ADD: the heap squares up and goes into your collection (the CARDS key)
  async function add(){
    if (busy || phase !== 'opened') return;
    busy = true;
    const list = heap.splice(0), mid = heapAt(1);
    S.cardReturn();
    await Promise.all(list.map((h, i) => { raise(h.c.el); return glide(h.c.body, { x:mid.x, y:mid.y - i, r:i % 2 ? 2 : -2, z:0, s }, 220); }));
    S.deckSettle(); Haptic.tick(10, 0);
    await wait(PO.reduced ? 0 : 140);
    const k = keyEl('cards'), to = local(k.getBoundingClientRect());
    await Promise.all(list.map((h, i) => wait(PO.reduced ? 0 : i * 70).then(async () => {
      S.cardDeal();
      await glide(h.c.body, { x:to.x, y:to.y, s:s * .4, r:0, z:12, alpha:.4 }, 300, { arc:30, easing:ease.in });
      h.c.body.remove();
      pool.push(h.card);
      jolt(k, 2); S.counterTick(true); Haptic.tick(8, 0);
    })));
    S.stageLock();
    phase = packets.length ? 'packets' : 'hand';
    keys();
    busy = false;
    if (phase === 'hand') dealFresh();
  }
  async function dealFresh(){
    if (hand.length) return;
    busy = true;
    await wait(PO.reduced ? 0 : 200);
    await tossIn(chooseThree());
    busy = false;
  }

  /* ---------------- the keys ---------------- */
  function key(b){
    const k = b.dataset.key;
    if (window.CareerShop?.key(k, b)) return;   // the shop's keys while it's out
    jolt(b, 2); Haptic.tick(8);
    if (k === 'play'){
      if (phase === 'opened') return add();
      if (phase === 'packets') return open();
      if (fed) return play();
      return redeal();
    }
    // CARDS (the collection rolls up from below): not built yet
    Foil.thud(.3);
  }

  /* ---------------- moving things about ---------------- */
  // everything back where it was: the cards to their places, the packets
  // to their row, the heap to its heap
  async function tidy(){
    const all = [...hand.filter(h => h !== fed), ...packets, ...heap];
    if (!all.length) return;
    S.cardReturn(); Haptic.tick(10);
    await Promise.all(all.map((t, i) => {
      const b = t.c ? t.c.body : t.p.body;
      return wait(PO.reduced ? 0 : i * 30).then(() => glide(b, { ...t.home, z:0 }, 260, { arc:10, easing:ease.out })).then(() => squash(b, .04, 120));
    }));
    S.cardLanded();
  }
  const bodyOf = t => t.c ? t.c.body : t.p.body;
  function thingAt(e){
    const el = e.target.closest('.cm-card, .cm-pk');
    if (!el) return null;
    return [...hand, ...packets, ...heap].find(t => (t.c ? t.c.el : t.p.el) === el) || null;
  }
  function overFeeder(cx, cy){
    const m = slotEl.getBoundingClientRect();
    return cx > m.left - 16 && cx < m.right + 16 && cy < m.bottom + 34;
  }
  let ptr = null, lastTap = null, tapT = 0;
  const at = e => { const f = felt.getBoundingClientRect(); return { x:e.clientX - f.left, y:e.clientY - f.top }; };
  function down(e){
    if (ptr || e.button > 0 || CardInspect.isOpen || window.CareerShop?.out) return;
    const p = at(e), now = performance.now();
    const t = thingAt(e);
    ptr = { id:e.pointerId, t, x0:p.x, y0:p.y, x:p.x, y:p.y, at:now, hist:[{ ...p, t:now }], mode:'press' };
    if (t && !busy){
      const b = bodyOf(t);
      ptr.dx = b.x - p.x; ptr.dy = b.y - p.y;
      Haptic.tick(4);
    }
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
      glide(b, { z:10, s:b.s * 1.05 }, 90, { easing:ease.out });
      S.cardReturn(); Foil.scrape?.();
      felt.classList.add('is-carrying');
    }
    if (q.mode === 'drag'){
      const b = bodyOf(q.t), v = vel(q);
      b.set({ x:p.x + q.dx, y:p.y + q.dy, r:clamp((q.t.home?.r || 0) + v.x / 120, -16, 16) });
      if (q.t.kind === 'hand') slotEl.classList.toggle('is-near', overFeeder(e.clientX, e.clientY));
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
    const t = q.t, b = bodyOf(t), v = vel(q);
    b.set({ live:false });
    // carried up to the feeder, or flicked up at it: it goes in
    if (t.kind === 'hand' && phase === 'hand' && !fed && (overFeeder(e.clientX, e.clientY) || (v.fresh && v.y < -900 && q.y0 - q.y > 40))){
      b.set({ s });
      feed(t);
      return;
    }
    // let go: it slides on a little and settles where it lands
    const W = felt.clientWidth, H = felt.clientHeight, hw = CW * s / 2, hh = CH * s / 2;
    const vx = v.fresh ? v.x : 0, vy = v.fresh ? v.y : 0;
    const x = clamp(b.x + vx * .08, hw * .6, W - hw * .6), y = clamp(b.y + vy * .08, hh * .5, H - hh * .5);
    glide(b, { x, y, r:clamp(b.r + vx / 200, -24, 24), s:t.kind === 'pk' ? pkScale() : s, z:0 }, 220, { easing:ease.out })
      .then(() => { squash(b, .05, 160); S.cardLanded(); Haptic.tick(5); });
  }
  // a tap; two quick taps on the felt put everything back
  function tap(q){
    const now = performance.now();
    if (lastTap && now - lastTap.at < 300 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 40){
      clearTimeout(tapT); lastTap = null;
      if (!busy) tidy();
      return;
    }
    lastTap = { at:now, x:q.x, y:q.y };
    clearTimeout(tapT);
    const t = q.t;
    if (!t) return;
    tapT = setTimeout(() => {
      lastTap = null;
      if (busy) return;
      if (t === fed) return unfeed();
      if (t.kind === 'pk') return open(t);
      inspect(t);
    }, 280);
  }
  // the shared inspect screen; swipe a hand card up out of it into the feeder
  function inspect(t){
    const list = t.kind === 'hand' ? hand.filter(h => h !== fed).sort((a, b) => a.place - b.place) : heap.slice();
    const canFeed = t.kind === 'hand' && phase === 'hand' && !fed;
    CardInspect.open({
      host:document.getElementById('home'),
      items:list.map(h => ({ card:h.card, source:() => h.c.el })),
      index:list.indexOf(t),
      swipeUp:canFeed ? async (item, idx, api) => {
        const h = list[idx], m = lip(), f = felt.getBoundingClientRect();
        // it's on its way up: the card on the felt waits under the feeder for it
        h.c.body.set({ x:m.x, y:m.y + CH * s / 2 + 2, r:0, z:0, s });
        h.c.body.render(performance.now());
        await api.sendTo({ x:f.left + m.x, y:f.top + m.y + CH * s / 2 + 2, s, r:0, z:0 });
        feed(h, { placed:true });
      } : null
    });
  }

  /* ---------------- for the shop (js/vending-machine.js) ---------------- */
  window.CareerMain = {
    get root(){ return root; }, get felt(){ return felt; },
    get wallet(){ return wallet; },
    set wallet(v){ wallet = v; $('#cm-reel').innerHTML = reel(v); },
    showBank(v){ $('#cm-reel').innerHTML = reel(v); },
    get reelEl(){ return $('#cm-reel'); },
    get busy(){ return busy; },
    get scale(){ return s; },
    keyEl, setKey, keys,
    addPackets, layDown, opened,
    // chips home: the reel counts them in
    countIn:v => countTo(wallet + v),
    // read-only, for the lab's checks
    get state(){ return { phase, busy, fed:fed ? fed.place : null, hand:hand.map(h => h.place + ':' + h.card.uid), packets:packets.length, heap:heap.length, pool:pool.length }; },
    where(kind, i){ const t = (kind === 'hand' ? hand.slice().sort((a, b) => a.place - b.place) : kind === 'pk' ? packets : heap)[i]; if (!t) return null; const r = (t.c ? t.c.el : t.p.el).getBoundingClientRect(), b = bodyOf(t); return { x:r.left + r.width / 2, y:r.top + r.height / 2, bx:b.x, by:b.y, home:t.home }; }
  };

  /* ---------------- start ---------------- */
  async function setup(){
    build();
    marks();
    $('#cm-reel').innerHTML = reel(wallet);
    measure();
    fillPool();
    keys();
    await wait(400);
    busy = true; await tossIn(chooseThree()); busy = false;
    // the felt can change size (the TUNE sheet, the phone turning): things
    // keep to their places
    new ResizeObserver(() => {
      measure(); homes();
      if (busy) return;
      [...hand.filter(h => h !== fed), ...packets, ...heap].forEach(t => bodyOf(t).set({ ...t.home, s:t.kind === 'pk' ? pkScale() : s }));
    }).observe(felt);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
