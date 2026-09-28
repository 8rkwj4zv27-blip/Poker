"use strict";

/* ============================================================
   DEALER DECK (live, v0.45.0) — the owner's order from the Deck Lab
   (deck-lab.html, round 4; docs/ui/DEALER_PLAN.md)

   A plain deck, beautifully handled. The deck on the felt is made of the
   same card as the ones dealt off it; it sits bottom left or bottom right
   (Settings → The deck) and gets thinner as the cards go out. Between
   hands it is shuffled by hand: split, riffle, the bridge, squared up
   with two taps. Cards slide off the top and fly (the approved Dealer
   Flick); a burn card slides off and tucks under the deck before the
   flop, turn and river; the turn and river get three taps first; the flop
   lands stacked, fans out and turns as it fans; at the end of the hand
   the cards come back onto the deck and it is squared up. Ten card backs
   (Settings → The deck). Styled by css/dealer-deck.css.

   Presentation only. Like js/showdown.js it wraps the shipped functions
   (dealCardFlight, dealCommunity, muckCards, playShuffle,
   keepPotClearOfDeck, clearAllCardDOM) and hands straight back to them
   when motion is off (or the dealer is set to TODAY, which only the Lab
   does). The one function it stands in for with game state in reach is
   the flop: dealCommunity(3) takes the same three cards off the same deck
   in the same order as the shipped one (g.deck.pop() x3 onto g.board).
   Burn cards are drawn, not taken: the engine's deck is never touched for
   them, so no hand, board or outcome can differ from the shipped game.
   validation/dealer-deck-checks.js holds it to that.

   It installs itself at load from the player's settings (deckBack,
   deckSide). DealerDeck.apply(order) takes a whole order (the Lab uses it).
   ============================================================ */
const DealerDeck = (() => {
  // The owner's order (Deck Lab, round 4). dealer:'today' (Lab only) is
  // the old deck; back and where come from the player's settings.
  const DEFAULTS = {
    dealer:'new', where:'left', size:'std', back:'crest',
    shuffle:'full', when:'every', burn:'tuck',
    eject:'kick', recoil:'on', flight:'flick', pace:'today', land:'puff', yours:'land',
    flop:'spread', flopflip:'wave', beat:'beat',
    sweep:'scatter', sound:'mech'
  };
  const BACKS = ['crest','lattice','classic','velvet','midnight','emerald','check','sunburst','ivory','harlequin','table'];
  let O = Object.assign({}, DEFAULTS);
  const root = document.documentElement;
  const $el = id => document.getElementById(id);
  const on = () => O.dealer === 'new';
  const live = () => on() && !motionOff();
  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, Math.round(ms))));
  const mech = () => O.sound === 'mech';
  const PACE = { today:1, brisk:.78, relaxed:1.25 };
  const BASE_TIMING = Object.assign({}, DEAL_TIMING);

  /* ---------------- the deck ---------------- */
  let count = 52;
  const deck = () => $el('dealer-deck');
  const layers = () => deck() ? Array.from(deck().querySelectorAll('.card:not(.ds-exit):not(.ds-riff)')) : [];
  // Up to seven of the ten cards show: the top one and, under it, one more
  // for about every eight cards left, each two pixels lower.
  const SHOW = 7;
  function paint(){
    const d = deck(); if (!d) return;
    const ls = layers();
    if (!on()){ ls.forEach(c => { c.classList.remove('ds-gone', 'ds-under', 'ds-bottom'); c.style.removeProperty('--ds-i'); }); return; }
    const n = count <= 0 ? 0 : Math.max(1, Math.ceil(count / 52 * SHOW));
    ls.forEach((c, k) => {
      const shown = k < n;
      c.classList.toggle('ds-gone', !shown);
      c.classList.toggle('ds-under', shown && k < n - 1);
      c.classList.toggle('ds-bottom', shown && k === 0);
      if (shown) c.style.setProperty('--ds-i', String(n - 1 - k));
    });
  }
  function setCount(n){ count = n; paint(); }

  let busy = 0;
  function working(delta){ busy = Math.max(0, busy + delta); }
  function restart(el, cls){ if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function kick(){ if (O.recoil === 'on') restart(deck(), 'ds-kick'); }
  function clunk(s){ if (mech()) try{ Sound.wheelRelay(s); }catch(e){} }
  function remeasure(){
    if ($el('pot-val')) $el('pot-val')._clearKey = null;
    try{ keepPotClearOfDeck(); }catch(e){}
    try{ if (typeof CoinTable !== 'undefined') CoinTable.layout(); }catch(e){}
  }
  // a new card on top of the deck, at the top card's place
  function topCard(cls){
    const c = document.createElement('div');
    c.className = 'card back small ' + cls;
    c.style.setProperty('--ds-i', '0');
    deck().appendChild(c);
    return c;
  }

  /* ---------------- flights ---------------- */
  // offset, travel, lift, turn, pitch, extraScale, easing, lateralCurve
  // FLICK is the shipped Dealer Flick and RETURN the shipped House Sweep
  // (js/06-presentation.js, DealFX), point for point.
  const POINTS = {
    flick:[
      [0,0,0,0,0,1,'cubic-bezier(.38,0,.62,1)',0],
      [.10,.025,8,-7,5,1.012,'cubic-bezier(.25,0,.48,.38)',-2],
      [.24,.16,23,-12,7,1.018,'cubic-bezier(.16,.05,.28,.74)',-8],
      [.68,.78,27,4,3,1.01,'cubic-bezier(.24,.58,.3,1)',-5],
      [.90,1,4,-2,0,1.004,'cubic-bezier(.18,.78,.22,1)',0],
      [.96,1,-2,1,0,1.008,'cubic-bezier(.3,0,.7,1)',0],
      [1,1,0,0,0,1,null,0]
    ],
    // a full turn in the air, landing square
    spin:[
      [0,0,0,0,0,1,'cubic-bezier(.38,0,.62,1)',0],
      [.10,.03,8,-50,5,1.012,'cubic-bezier(.25,0,.48,.38)',-2],
      [.24,.17,22,-150,7,1.02,'cubic-bezier(.16,.05,.28,.74)',-8],
      [.68,.8,24,-318,3,1.01,'cubic-bezier(.24,.58,.3,1)',-5],
      [.90,1,4,-362,0,1.004,'cubic-bezier(.18,.78,.22,1)',0],
      [.96,1,-2,-359,0,1.008,'cubic-bezier(.3,0,.7,1)',0],
      [1,1,0,-360,0,1,null,0]
    ],
    // low across the felt, like a card pushed by a finger
    slide:[
      [0,0,0,0,0,1,'cubic-bezier(.3,0,.5,.4)',0],
      [.14,.08,3,-4,2,1.006,'cubic-bezier(.2,.4,.3,.9)',-1],
      [.62,.84,3,3,1,1.004,'cubic-bezier(.2,.7,.3,1)',-1],
      [.88,1,0,-1,0,1,'cubic-bezier(.3,0,.7,1)',0],
      [.95,1,0,.6,0,1,'cubic-bezier(.3,0,.7,1)',0],
      [1,1,0,0,0,1,null,0]
    ],
    ret:[
      [0,0,0,0,0,1,'cubic-bezier(.38,0,.62,1)',0],
      [.10,.025,9,6,6,1.014,'cubic-bezier(.24,0,.46,.35)',3],
      [.26,.18,25,11,7,1.018,'cubic-bezier(.14,.04,.25,.76)',10],
      [.70,.80,24,-4,3,1.01,'cubic-bezier(.25,.56,.3,1)',7],
      [.91,1,4,2,0,1.004,'cubic-bezier(.16,.8,.22,1)',0],
      [.97,1,-2,-1,0,1.008,'cubic-bezier(.3,0,.7,1)',0],
      [1,1,0,0,0,1,null,0]
    ]
  };
  const flights = new Set();
  function settle(run, ok){
    if (!run || run.done) return;
    run.done = true; flights.delete(run);
    run.ghost.remove();
    if (run.from) run.from.style.visibility = run.fromVis;
    working(-1);
    run.resolve(!!ok);
  }
  function cancelAll(){
    Array.from(flights).forEach(run => { settle(run, false); try{ run.anim.cancel(); }catch(e){} });
  }
  /* A card ghost from one element to another (the shipped flyGhost, with a
     choice of path). ret: the ghost wears the shoe's card back and lands
     on the stack; into: it then slides down into the shoe's mouth. */
  function fly(fromEl, toEl, o){
    o = o || {};
    if (!fromEl || !toEl) return Promise.resolve(true);
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve(true);
    const felt = o.ret ? $el('felt') : null;
    const ghost = document.createElement('div');
    const skin = o.ret ? toEl : fromEl;
    ghost.className = String(skin.className || 'card back small').split(/\s+/)
      .filter(n => n && !/^(fly-card|return|ds-exit|ds-gone|ds-riff|ds-under|ds-bottom|ds-tuck)$/.test(n)).join(' ') + ' fly-card' + (o.ret ? ' return' : '');
    const c = felt ? felt.getBoundingClientRect() : { left:0, top:0 };
    const cl = c.left + (felt ? felt.clientLeft : 0), ct = c.top + (felt ? felt.clientTop : 0);
    ghost.style.left = (b.left - cl) + 'px'; ghost.style.top = (b.top - ct) + 'px';
    ghost.style.width = b.width + 'px'; ghost.style.height = b.height + 'px';
    (felt || document.body).appendChild(ghost);
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2, dx = b.left + b.width / 2, dy = b.top + b.height / 2;
    const rx = dx - sx, ry = dy - sy, dist = Math.hypot(rx, ry) || 1, nx = -ry / dist, ny = rx / dist;
    const ssx = a.width / b.width, ssy = a.height / b.height;
    const pts = POINTS[o.path] || POINTS.flick;
    const tf = p => {
      const [, t, lift, turn, pitch, extra] = p, curve = p[7] || 0;
      const x = sx + rx * t + nx * curve, y = sy + ry * t + ny * curve - lift;
      return 'perspective(800px) translate3d(' + (x - dx) + 'px,' + (y - dy) + 'px,' + (lift * .55) + 'px) rotateZ(' + turn + 'deg) rotateX(' + pitch + 'deg) scale(' +
        ((ssx + (1 - ssx) * t) * extra) + ',' + ((ssy + (1 - ssy) * t) * extra) + ')';
    };
    const squeeze = o.into ? .82 : 1;
    const frames = pts.map(p => { const f = { transform:tf(p), offset:p[0] * squeeze }; if (p[6]) f.easing = p[6]; return f; });
    if (o.into){
      frames[frames.length - 1].easing = 'steps(3,end)';
      frames.push({ transform:'translateY(' + (b.height * .42) + 'px) scale(.94,.08)', offset:1 });
    }
    const dur = Math.max(1, Math.round((o.duration || DEAL_TIMING.dealMs) * speedMult()));
    ghost.style.willChange = 'transform';
    const fromVis = fromEl.style.visibility || '';
    if (!o.ret) fromEl.style.visibility = 'hidden';
    const anim = ghost.animate(frames, { duration:dur, easing:'linear', fill:'both' });
    let resolve; const promise = new Promise(r => { resolve = r; });
    const run = { ghost, anim, resolve, from:o.ret ? null : fromEl, fromVis, done:false };
    flights.add(run); working(1);
    anim.finished.then(() => settle(run, true), () => settle(run, false));
    return promise;
  }
  function puff(el){
    if (O.land !== 'puff' || !el || !el.isConnected) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const p = document.createElement('div');
    p.className = 'ds-puff';
    p.style.left = (r.left + r.width / 2) + 'px'; p.style.top = (r.bottom - 2) + 'px';
    p.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 420);
  }

  /* ---------------- out of the shoe ---------------- */
  // The top card, as a card of its own, slid off the top of the deck with
  // a little drag (SLIDES OFF FIRST) or flown straight off it.
  async function eject(){
    const d = deck(); if (!d) return null;
    const ex = topCard('ds-exit');
    setCount(count - 1);
    working(1);
    try{
      if (O.eject === 'kick'){
        // it slides off the top of the deck before it flies
        const lift = 12;
        kick(); clunk(.28);
        const tilt = O.where === 'right' ? 2 : -2;
        await ex.animate([{ transform:'translate(0,0)' }, { transform:'translate(' + (-tilt) + 'px,-' + lift + 'px) rotate(' + tilt + 'deg)' }],
          { duration:Math.round(130 * speedMult()), easing:'steps(4,end)', fill:'forwards' }).finished.catch(() => {});
      } else kick();
    } finally { working(-1); }
    return ex;
  }
  const dealMs = () => DEAL_TIMING.dealMs * (O.flight === 'slide' ? 1.08 : 1);
  async function fromShoe(target, o){
    const ex = await eject();
    if (!ex) return false;
    Sound.cardDeal();
    const ok = await fly(ex, target, { path:O.flight, duration:(o && o.duration) || dealMs() });
    ex.remove();
    return ok;
  }

  /* ---------------- the deal ---------------- */
  // your two cards, when they turn over together
  let pair = null;
  function pairFor(){
    const g = game, me = g && g.players.find(p => p.isHuman);
    if (!pair || pair.hand !== (g && g.handNumber)){
      let release; const gate = new Promise(r => { release = r; });
      pair = { hand:g && g.handNumber, need:me ? me.hand.length : 2, seen:0, gate, release };
      setTimeout(release, 6000);
    }
    return pair;
  }
  const orig = {};
  async function dealCardFlight2(el, card, opts){
    if (!live() || !deck()) return orig.dealCardFlight.apply(this, arguments);
    opts = opts || {};
    if (!el) return;
    const small = el.classList.contains('small');
    const wasFaceUp = !el.classList.contains('back');
    if (wasFaceUp){ el.className = cardClass(true, card, small); el.innerHTML = ''; }
    el.classList.remove('deal-anim');   // its fade-in would override the hide below
    el.style.opacity = '0';
    const pr = opts.revealAfter && O.yours === 'together' ? pairFor() : null;
    const landed = await fromShoe(el);
    el.style.opacity = '';
    if (!landed || !el.isConnected){ if (pr){ pr.seen++; if (pr.seen >= pr.need) pr.release(); } return; }
    Sound.cardLanded(); puff(el);
    if (pr){
      pr.seen++;
      if (pr.seen >= pr.need){ await wait(DEAL_TIMING.settleBeforeFlipMs * speedMult() + 120); pr.release(); }
      await pr.gate;
      if (el.isConnected) await turnCard(el, false, card, small, 'hole');
      return;
    }
    if ((wasFaceUp || opts.revealAfter) && !opts.deferFlip){
      await wait(DEAL_TIMING.settleBeforeFlipMs * speedMult());
      await turnCard(el, false, card, small, opts.board ? 'board' : 'hole');
    }
  }

  /* ---------------- burn, flop, turn, river ---------------- */
  // The burn: the top card slides off to the side and tucks back in under
  // the bottom of the deck, the way a dealer does it. Nothing is left out.
  async function burnOne(){
    const d = deck(); if (!d) return;
    const b = topCard('ds-exit');
    const sp = speedMult(), side = O.where === 'right' ? -1 : 1;
    working(1);
    try{
      try{ Sound.cardReturn(); }catch(e){}
      await b.animate([{ transform:'translate(0,0)' }, { transform:'translate(' + (side * 30) + 'px,-4px) rotate(' + (side * 4) + 'deg)' }],
        { duration:140 * sp, easing:'steps(4,end)', fill:'forwards' }).finished.catch(() => {});
      b.classList.add('ds-tuck');
      const n = layers().filter(c => !c.classList.contains('ds-gone')).length;
      await b.animate([{ transform:'translate(' + (side * 30) + 'px,-4px) rotate(' + (side * 4) + 'deg)' }, { transform:'translate(0,' + Math.max(0, n - 1) * 2 + 'px)' }],
        { duration:150 * sp, easing:'steps(4,end)', fill:'forwards' }).finished.catch(() => {});
      restart(d, 'ds-tap');
      try{ Sound.cardLanded(); }catch(e){}
    } finally { b.remove(); working(-1); }
    await wait(80 * sp);
  }
  // three taps on the deck before the card comes off
  async function lampBeat(){
    for (let i = 0; i < 3; i++){
      restart(deck(), 'ds-kick');
      try{ Sound.counterTick(false); }catch(e){}
      await wait(150 * speedMult());
    }
  }
  async function flipAll(els, cards, gap){
    const turns = [];
    for (let i = 0; i < els.length; i++){
      if (els[i].isConnected) turns.push(turnCard(els[i], false, cards[i], false, 'board'));
      if (i < els.length - 1 && gap) await wait(gap * speedMult());
    }
    await Promise.all(turns);
  }
  const FLIP_GAP = { wave:90, together:0, one:300 };
  // The flop: the same three cards off the same deck in the same order as
  // the shipped dealCommunity(3). SPREAD lands all three on the first spot,
  // then fans them out; otherwise each flies to its own spot.
  async function flop(g){
    const cards = [];
    for (let i = 0; i < 3; i++){ const c = g.deck.pop(); g.board.push(c); cards.push(c); }
    render();
    const els = Array.from($el('board').children).slice(-3);
    els.forEach((el, i) => { el.className = cardClass(true, cards[i], false); el.innerHTML = ''; el.style.opacity = '0'; });
    const spread = O.flop === 'spread';
    const home = els[0], hx = home.getBoundingClientRect().left;
    const pending = [];
    for (let i = 0; i < 3; i++){
      const el = els[i];
      pending.push((async () => {
        const ok = await fromShoe(spread ? home : el);
        if (!el.isConnected) return;
        if (spread) el.style.transform = 'translate(' + (hx - el.getBoundingClientRect().left + i) + 'px,' + (-i) + 'px)';
        el.style.opacity = '';
        if (ok){ Sound.cardLanded(); if (i === 0 || !spread) puff(el); }
      })());
      if (i < 2) await wait(DEAL_TIMING.flopStaggerMs * (spread ? .62 : 1) * speedMult());
    }
    await Promise.all(pending);
    if (game !== g) return;
    if (spread){
      await wait(140 * speedMult());
      try{ Sound.cardReturn(); }catch(e){}
      const dur = Math.round(260 * speedMult());
      const slides = els.map((el, i) => {
        if (!el.isConnected || !i) return Promise.resolve();
        const from = el.style.transform;
        el.style.transform = '';
        return el.animate([{ transform:from }, { transform:'none' }], { duration:dur, delay:(i - 1) * 40, easing:'cubic-bezier(.2,.8,.25,1)' }).finished.catch(() => {});
      });
      if (O.flopflip === 'wave'){
        await wait(dur * .45);
        await flipAll(els, cards, FLIP_GAP.wave);
        await Promise.all(slides);
        return;
      }
      await Promise.all(slides);
      await wait(90 * speedMult());
    } else await wait(DEAL_TIMING.settleBeforeFlipMs * speedMult());
    await flipAll(els, cards, FLIP_GAP[O.flopflip]);
  }
  async function dealCommunity2(n){
    if (!live() || !deck()) return orig.dealCommunity.apply(this, arguments);
    const g = game;
    if (O.burn === 'tuck') await burnOne();
    if (game !== g) return;
    if (n === 1 && O.beat === 'beat') await lampBeat();
    if (n === 3) return flop(g);
    return orig.dealCommunity.apply(this, arguments);
  }

  /* ---------------- the muck ---------------- */
  // Every card comes back to the top of the deck (the deck thickens as they
  // land), then the deck is squared up with two taps.
  function collect(el, delay){
    return wait(delay).then(() => {
      if (!el.isConnected || el.style.opacity === '0') return;
      const top = topCard('ds-exit');
      top.style.visibility = 'hidden';
      el.style.opacity = '0';
      Sound.cardReturn();
      return fly(el, top, { ret:true, path:'ret', duration:DEAL_TIMING.collectMs }).then(() => {
        top.remove();
        setCount(Math.min(52, count + 1));
      });
    });
  }
  async function squareUp(){
    const d = deck();
    for (let i = 0; i < 2; i++){
      restart(d, 'ds-tap');
      try{ i ? Sound.deckSettle() : Sound.cardLanded(); }catch(e){}
      await wait(130 * speedMult());
    }
  }
  async function muckCards2(){
    if (!live() || !deck()) return orig.muckCards.apply(this, arguments);
    const g = game;
    const board = Array.from(($el('board') || { children:[] }).children);
    const seats = [];
    if (g){
      const n = g.players.length;
      for (let k = 1; k <= n; k++){
        const p = g.players[(g.dealerIndex + k) % n], e = p && seatEls[p.id];
        if (e) seats.push(...e.cardsContainer.children);
      }
    }
    const all = seats.concat(board);
    if (!all.length) return;
    const gap = 42 * speedMult();
    await Promise.all(all.map((el, i) => collect(el, O.sweep === 'round' ? i * gap : Math.random() * DEAL_TIMING.collectStaggerMaxMs * speedMult())));
    await squareUp();
  }

  /* ---------------- the shuffle ----------------
     By hand, with a dozen of the deck's own cards: the deck splits into two
     halves that slide apart, riffles back together a card at a time from
     alternate halves, arches in the bridge and cascades down, and is
     squared up. FULL + CUT then lifts the top half off and puts it under.
     QUICK is split, riffle and square. */
  const N = 12;
  async function handShuffle(kind){
    const d = deck(), sp = speedMult();
    const cards = [];
    for (let i = 0; i < N; i++){ const c = topCard('ds-riff'); c.style.zIndex = String(30 + i); cards.push(c); }
    d.classList.add('ds-in-hands'); working(1);
    const at = (c, x, y, r, ms, ease) => c.animate([{ transform:c._t || 'translate(0,0)' }, { transform:(c._t = 'translate(' + x + 'px,' + y + 'px) rotate(' + (r || 0) + 'deg)') }],
      { duration:Math.max(1, ms * sp), easing:ease || 'steps(3,end)', fill:'forwards' }).finished.catch(() => {});
    try{
      // split: two halves slide apart
      try{ Sound.cardDeal(); }catch(e){}
      await Promise.all(cards.map((c, i) => { const left = i < N / 2, k = left ? i : i - N / 2; return at(c, left ? -27 : 27, -k, left ? -5 : 5, 150); }));
      await wait(50 * sp);
      // riffle: one at a time from alternate halves into the middle
      const order = [];
      for (let k = N / 2 - 1; k >= 0; k--){ order.push(cards[k], cards[k + N / 2]); }
      for (let i = 0; i < order.length; i++){
        const c = order[i]; c.style.zIndex = String(60 + i);
        at(c, 0, -i * .5 - 2, 0, 70, 'steps(2,end)');
        try{ Sound.cardReturn(); }catch(e){}
        await wait(32 * sp);
      }
      await wait(90 * sp);
      if (kind !== 'quick'){
        // the bridge: the cards arch up, then cascade down one after another
        try{ Sound.cardDeal(); }catch(e){}
        await Promise.all(order.map((c, i) => at(c, 0, -10 - i * .6, i % 2 ? 1.5 : -1.5, 120)));
        for (let i = order.length - 1; i >= 0; i--){
          at(order[i], 0, 0, 0, 80, 'steps(2,end)');
          if (i % 2 === 0) try{ Sound.cardReturn(); }catch(e){}
          await wait(18 * sp);
        }
        await wait(100 * sp);
      } else {
        await Promise.all(order.map(c => at(c, 0, 0, 0, 90)));
      }
      if (kind === 'cut'){
        // the cut: the top half lifts off, the bottom half goes on top
        const top = order.slice(N / 2), bottom = order.slice(0, N / 2);
        await Promise.all(top.map(c => at(c, O.where === 'right' ? -32 : 32, -4, 0, 130)));
        bottom.forEach((c, i) => { c.style.zIndex = String(90 + i); });
        try{ Sound.cardReturn(); }catch(e){}
        await Promise.all(top.map(c => at(c, 0, 0, 0, 130)));
        await wait(60 * sp);
      }
      setCount(52);
      d.classList.remove('ds-in-hands');
      await squareUp();
    } finally {
      cards.forEach(c => c.remove());
      d.classList.remove('ds-in-hands');
      working(-1);
    }
  }
  async function playShuffle2(){
    if (!on() || !deck()) return orig.playShuffle.apply(this, arguments);
    const g = game;
    const due = O.shuffle !== 'off' && (O.when === 'every' || (g && g.handNumber <= 1));
    if (motionOff() || !due){ setCount(52); return; }
    await handShuffle(O.shuffle);
  }

  /* ---------------- the pot plate keeps clear of the deck, wherever it is ---------------- */
  function keepPotClear2(){
    if (!on()) return orig.keepPotClearOfDeck.apply(this, arguments);
    const area = $el('pot-area'), plate = area && area.querySelector('.pot-chip'), d = deck();
    if (!area || !plate || !d || area.classList.contains('hidden')){ if ($el('pot-val')) $el('pot-val')._clearKey = null; return; }
    const cur = parseFloat(area.style.marginLeft) || 0;
    const p = plate.getBoundingClientRect(), k = d.getBoundingClientRect();
    const pl = p.left - cur, pr = p.right - cur;
    let nudge = 0;
    if (p.bottom > k.top - 4 && p.top < k.bottom + 4 && pr > k.left - 6 && pl < k.right + 6){
      // slide the plate off whichever side of the deck it is mostly on
      nudge = (pl + pr) / 2 >= (k.left + k.right) / 2 ? Math.ceil(k.right + 6 - pl) : -Math.ceil(pr - (k.left - 6));
    }
    if (nudge !== cur) area.style.marginLeft = nudge ? nudge + 'px' : '';
  }

  /* ---------------- install / apply ---------------- */
  function install(){
    if (orig.installed) return;
    orig.installed = true;
    orig.dealCardFlight = dealCardFlight; dealCardFlight = dealCardFlight2;
    orig.dealCommunity = dealCommunity; dealCommunity = dealCommunity2;
    orig.muckCards = muckCards; muckCards = muckCards2;
    orig.playShuffle = playShuffle; playShuffle = playShuffle2;
    orig.keepPotClearOfDeck = keepPotClearOfDeck; keepPotClearOfDeck = keepPotClear2;
    orig.clearAllCardDOM = clearAllCardDOM;
    clearAllCardDOM = function(){
      cancelAll();
      document.querySelectorAll('.ds-exit,.ds-riff,.ds-puff').forEach(e => e.remove());
      const d = deck(); if (d) d.classList.remove('ds-in-hands');
      return orig.clearAllCardDOM.apply(this, arguments);
    };
    const cancel = DealFX.cancelAll;
    DealFX.cancelAll = function(){ cancelAll(); return cancel.apply(this, arguments); };
    paint();
  }
  function apply(order){
    O = Object.assign({}, DEFAULTS, order || {});
    install();
    const set = (k, v) => { if (v == null) root.removeAttribute(k); else root.setAttribute(k, v); };
    set('data-ds-on', on() ? '' : null);
    set('data-ds-size', O.size); set('data-ds-where', O.where); set('data-ds-back', O.back);
    const k = on() ? PACE[O.pace] || 1 : 1;
    DEAL_TIMING.dealMs = Math.round(BASE_TIMING.dealMs * k);
    DEAL_TIMING.dealStaggerMs = Math.round(BASE_TIMING.dealStaggerMs * k);
    DEAL_TIMING.flopStaggerMs = Math.round(BASE_TIMING.flopStaggerMs * k);
    DEAL_TIMING.collectMs = Math.round(BASE_TIMING.collectMs * k);
    paint();
    if (!on()) layers().forEach(c => c.classList.remove('ds-gone'));
    // the pot plate and the coins' walls measure the deck: re-measure
    if ($el('pot-val')) $el('pot-val')._clearKey = null;
    const area = $el('pot-area'); if (area) area.style.marginLeft = '';
    remeasure();
    paintSettings();
  }
  /* ---------------- player settings ----------------
     Settings → The deck (index.html): the back (a row of real cards) and
     the side, saved with the rest of settings. */
  function fromSettings(){
    const back = BACKS.includes(settings.deckBack) ? settings.deckBack : DEFAULTS.back;
    const where = settings.deckSide === 'right' ? 'right' : 'left';
    return { back, where };
  }
  function paintSettings(){
    document.querySelectorAll('#deck-back-seg button').forEach(b => b.classList.toggle('active', b.dataset.v === O.back));
    document.querySelectorAll('#deck-side-seg button').forEach(b => b.classList.toggle('active', b.dataset.v === O.where));
  }
  function wireSettings(){
    const pick = (key, v) => { settings[key] = v; saveSettings(); apply(Object.assign({}, O, fromSettings())); };
    document.querySelectorAll('#deck-back-seg button').forEach(b => { b.onclick = () => pick('deckBack', b.dataset.v); });
    document.querySelectorAll('#deck-side-seg button').forEach(b => { b.onclick = () => pick('deckSide', b.dataset.v); });
    paintSettings();
  }
  function start(){
    apply(Object.assign({}, DEFAULTS, fromSettings()));
    wireSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  const api = { DEFAULTS, BACKS, apply, install, get order(){ return Object.assign({}, O); }, get count(){ return count; } };
  return api;
})();
