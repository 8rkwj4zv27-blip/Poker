"use strict";

/* ============================================================
   DEALER SHOE — candidate (Lab only: deck-lab.html)

   The dealer's deck (round 2): the deck seen from above in a tray, on its
   own or in a shoe. Cards slide off it, a CRT plaque counts what's left
   (and calls RIFFLE / BURN / FLOP / TURN / RIVER / READY), a lamp works
   while it deals, it shuffles between hands, burns a card before each
   street, spreads the flop, and the cards come back to it at the end of
   the hand. Styled by css/dealer-shoe.css.

   Presentation only. Like js/showdown.js it wraps the shipped functions
   (dealCardFlight, dealCommunity, muckCards, playShuffle,
   keepPotClearOfDeck, clearAllCardDOM) and hands straight back to them
   when the dealer is set to TODAY or motion is off. The one function it
   stands in for with game state in reach is the flop: dealCommunity(3)
   takes the same three cards off the same deck in the same order as the
   shipped one (g.deck.pop() x3 onto g.board). Burn cards are drawn, not
   taken: the engine's deck is never touched for them, so no hand, board
   or outcome can differ from the shipped game.

   DealerShoe.apply(order) takes the Lab's picks (see DEFAULTS).
   ============================================================ */
const DealerShoe = (() => {
  // Every first value is my suggestion; dealer:'today' is the shipped game.
  const DEFAULTS = {
    dealer:'new', hold:'tray', finish:'brass', size:'std', where:'left', counter:'below', says:'words', stack:'down', cut:'on', idle:'rare',
    back:'crest', shuffle:'riffle', when:'every', slen:'short',
    eject:'kick', recoil:'on', flight:'flick', pace:'today', land:'puff', yours:'land',
    burn:'on', flop:'spread', flopflip:'wave', beat:'off',
    muck:'stack', sweep:'scatter', sound:'mech'
  };
  let O = Object.assign({}, DEFAULTS);
  const root = document.documentElement;
  const $el = id => document.getElementById(id);
  const on = () => O.dealer === 'new';
  const live = () => on() && !motionOff();
  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, Math.round(ms))));
  const mech = () => O.sound === 'mech';
  const PACE = { today:1, brisk:.78, relaxed:1.25 };
  const BASE_TIMING = Object.assign({}, DEAL_TIMING);

  /* ---------------- the shoe's parts ---------------- */
  let count = 52;
  const deck = () => $el('dealer-deck');
  const layers = () => deck() ? Array.from(deck().querySelectorAll('.card:not(.ds-exit):not(.ds-riff)')) : [];
  function build(){
    const d = deck(); if (!d || d.querySelector('.ds-plaque')) return;
    const ls = layers();
    // above the stack: the tray's thumb notch, the shoe's lid and lip, the counter plaque
    const add = (cls, html) => { const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html; d.appendChild(e); return e; };
    add('ds-notch'); add('ds-lid'); add('ds-lip');
    add('ds-plaque', '<i class="ds-lamp"></i><div class="crt ds-crt"><span class="crt-figure ds-fig">52</span></div>');
    const cut = document.createElement('div');
    cut.className = 'ds-cut';
    d.insertBefore(cut, ls[5] || d.querySelector('.ds-notch'));
    const burn = document.createElement('div');
    burn.className = 'ds-burn';
    d.parentNode.appendChild(burn);
  }
  const lamp = () => deck() && deck().querySelector('.ds-lamp');
  const crt = () => deck() && deck().querySelector('.ds-crt');
  let wordT = null, word = null;
  function paint(){
    const d = deck(); if (!d) return;
    const ls = layers();
    const n = count <= 0 ? 0 : Math.max(1, Math.ceil(count / 52 * ls.length));
    ls.forEach((c, i) => c.classList.toggle('ds-gone', on() && O.stack === 'down' && i >= n));
    const topN = O.stack === 'down' ? n : ls.length;
    ls.forEach((c, i) => c.classList.toggle('ds-top', i === Math.max(0, topN - 1)));
    d.setAttribute('data-ds-layers', O.stack === 'down' ? n : ls.length);
    if (!word) showCount();
  }
  function showCount(){
    const c = crt(); if (!c) return;
    const html = '<span class="crt-figure ds-fig">' + Math.max(0, count) + '</span>';
    if (c.innerHTML !== html) c.innerHTML = html;
  }
  function setWord(w, ms){
    if (O.says !== 'words' || O.counter === 'off' || !crt()) return;
    clearTimeout(wordT);
    word = w;
    crt().innerHTML = '<span class="crt-line">' + w + '</span>';
    if (ms) wordT = setTimeout(() => { word = null; showCount(); }, ms);
  }
  function clearWord(){ clearTimeout(wordT); word = null; showCount(); }
  function setCount(n){ count = n; paint(); }

  // the lamp works while anything is dealing
  let busy = 0, liveT = null;
  function working(delta){
    busy = Math.max(0, busy + delta);
    const d = deck(), l = lamp();
    clearTimeout(liveT);
    if (busy){ if (l) l.classList.add('is-on'); if (d) d.classList.add('ds-live'); }
    else liveT = setTimeout(() => { if (l) l.classList.remove('is-on'); if (d) d.classList.remove('ds-live'); }, 260);
  }
  function restart(el, cls){ if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function kick(){ if (O.recoil === 'on') restart(deck(), 'ds-kick'); }
  function clunk(s){ if (mech()) try{ Sound.wheelRelay(s); }catch(e){} }

  // now and then, while nothing is happening, the lamp blinks
  let idleT = null;
  function idle(){
    clearTimeout(idleT);
    idleT = setTimeout(() => {
      if (live() && O.idle === 'rare' && !busy && !document.hidden){
        const d = deck(), l = lamp();
        if (l) restart(l, 'is-blink');
        if (d) restart(d, 'ds-blink');
      }
      idle();
    }, 7000 + Math.random() * 9000);
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
      .filter(n => n && !/^(fly-card|return|ds-exit|ds-gone|ds-riff|ds-burned)$/.test(n)).join(' ') + ' fly-card' + (o.ret ? ' return' : '');
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
  // The top card of the stack, as a card of its own, slid out past the
  // front plate (KICK) or lifted straight off the top.
  async function eject(){
    const d = deck(); if (!d) return null;
    const ls = layers().filter(c => !c.classList.contains('ds-gone'));
    const top = ls[ls.length - 1] || layers()[0];
    const ex = document.createElement('div');
    ex.className = 'card back small ds-exit';
    ex.style.setProperty('--deck-layer', top ? top.style.getPropertyValue('--deck-layer') || '9' : '9');
    d.insertBefore(ex, d.querySelector('.ds-notch'));
    setCount(count - 1);
    working(1);
    try{
      if (O.eject === 'kick'){
        // off the top of the deck, over the tray's rim, or out of the shoe's mouth
        const lift = O.hold === 'shoe' ? ex.offsetHeight - 12 : O.hold === 'tray' ? 16 : 10;
        kick(); clunk(.28);
        await ex.animate([{ transform:'translateY(0)' }, { transform:'translateY(-' + lift + 'px)' }],
          { duration:Math.round(120 * speedMult()), easing:'steps(4,end)', fill:'forwards' }).finished.catch(() => {});
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
  async function burnOne(){
    const pile = document.querySelector('.ds-burn'); if (!pile) return;
    const n = pile.children.length;
    const b = document.createElement('div');
    b.className = 'card back small ds-burned';
    b.style.setProperty('--bx', (n * 2) + 'px'); b.style.setProperty('--by', (-n * 2) + 'px');
    b.style.setProperty('--br', ((Math.random() * 12 - 6) + (n - 1) * 5).toFixed(1) + 'deg');
    b.style.visibility = 'hidden';
    pile.appendChild(b);
    setWord('BURN', 700);
    const ok = await fromShoe(b, { duration:DEAL_TIMING.dealMs * .62 });
    if (b.isConnected){ b.style.visibility = ''; if (ok) Sound.cardLanded(); }
    await wait(90 * speedMult());
  }
  async function lampBeat(){
    const l = lamp();
    for (let i = 0; i < 3; i++){
      if (l) l.classList.add('is-on');
      try{ Sound.counterTick(false); }catch(e){}
      await wait(90 * speedMult());
      if (l && !busy) l.classList.remove('is-on');
      await wait(60 * speedMult());
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
    const street = n === 3 ? 'FLOP' : g.board.length === 3 ? 'TURN' : 'RIVER';
    if (O.burn === 'on') await burnOne();
    if (game !== g) return;
    setWord(street, 1100);
    if (n === 1 && O.beat === 'beat') await lampBeat();
    if (n === 3) return flop(g);
    return orig.dealCommunity.apply(this, arguments);
  }

  /* ---------------- the muck ---------------- */
  function collect(el, delay){
    return wait(delay).then(() => {
      if (!el.isConnected || el.style.opacity === '0') return;
      const ls = layers().filter(c => !c.classList.contains('ds-gone'));
      const top = ls[ls.length - 1] || layers()[0];
      if (!top) return;
      el.style.opacity = '0';
      Sound.cardReturn();
      return fly(el, top, { ret:true, into:O.muck === 'slot', path:'ret', duration:DEAL_TIMING.collectMs });
    });
  }
  async function muckCards2(){
    if (!live() || !deck()) return orig.muckCards.apply(this, arguments);
    const g = game;
    const board = Array.from(($el('board') || { children:[] }).children);
    const burns = Array.from(document.querySelectorAll('.ds-burn .card'));
    const seats = [];
    if (g){
      const n = g.players.length;
      for (let k = 1; k <= n; k++){
        const p = g.players[(g.dealerIndex + k) % n], e = p && seatEls[p.id];
        if (e) seats.push(...e.cardsContainer.children);
      }
    }
    const all = seats.concat(board, burns);
    if (!all.length) return;
    const gap = 42 * speedMult();
    await Promise.all(all.map((el, i) => collect(el, O.sweep === 'round' ? i * gap : Math.random() * DEAL_TIMING.collectStaggerMaxMs * speedMult())));
    burns.forEach(b => b.remove());
    if (O.muck === 'slot'){ restart(deck(), 'ds-gulp'); clunk(.5); }
    Sound.deckSettle();
  }

  /* ---------------- the shuffle ---------------- */
  const SLEN = { short:1, long:1.8 };
  async function machineShuffle(){
    const d = deck(), l = lamp(), c = crt();
    const total = 720 * SLEN[O.slen] * speedMult();
    clunk(.8);
    d.classList.add('ds-shuffling'); working(1);
    if (l) l.classList.add('is-flick');
    if (c) c.setAttribute('data-crt-quiet', '');
    word = 'spin';
    const end = performance.now() + total;
    let i = 0;
    while (performance.now() < end && d.isConnected){
      if (i % 2 === 0) try{ Sound.cardReturn(); }catch(e){}
      if (i % 2 === 1 && c && O.counter !== 'off'){
        c.innerHTML = '<span class="crt-figure ds-fig">' + (10 + Math.floor(Math.random() * 90)) + '</span>';
        try{ Sound.counterTick(false); }catch(e){}
      }
      i++;
      await wait(45);
    }
    d.classList.remove('ds-shuffling'); working(-1);
    if (l) l.classList.remove('is-flick');
    if (c) c.removeAttribute('data-crt-quiet');
    word = null;
    setCount(52);
    try{ Sound.counterLock(false); }catch(e){}
    clunk(.6); restart(d, 'ds-kick');
    setWord('READY', 700);
    await wait(200 * speedMult());
  }
  async function riffle(){
    const d = deck(), front = d.querySelector('.ds-notch');
    const top = layers()[layers().length - 1];
    const layer = top ? top.style.getPropertyValue('--deck-layer') || '9' : '9';
    const N = 12, cards = [];
    for (let i = 0; i < N; i++){
      const c = document.createElement('div');
      c.className = 'card back small ds-riff';
      c.style.setProperty('--deck-layer', layer);
      d.insertBefore(c, front);
      cards.push(c);
    }
    working(1); setWord('RIFFLE');
    const sp = speedMult();
    const half = (c, i) => { const left = i % 2 === 0, k = i >> 1; return 'translate(' + (left ? -17 : 17) + 'px,' + (-40 - k) + 'px) rotate(' + (left ? -7 : 7) + 'deg)'; };
    const passes = O.slen === 'long' ? 2 : 1;
    for (let pass = 0; pass < passes; pass++){
      try{ Sound.cardDeal(); }catch(e){}
      await Promise.all(cards.map((c, i) => c.animate([{ transform:pass ? 'translate(0,-38px)' : 'translate(0,0)' }, { transform:half(c, i) }],
        { duration:170 * sp, easing:'steps(4,end)', fill:'forwards' }).finished.catch(() => {})));
      for (let i = 0; i < N; i++){
        cards[i].style.zIndex = String(31 + i);
        cards[i].animate([{ transform:half(cards[i], i) }, { transform:'translate(0,' + (-34 - i * .5) + 'px)' }],
          { duration:90 * sp, easing:'steps(2,end)', fill:'forwards' });
        try{ Sound.cardReturn(); }catch(e){}
        await wait(38 * sp);
      }
      await wait(110 * sp);
    }
    await Promise.all(cards.map(c => c.animate([{ transform:'translate(0,-34px)' }, { transform:'translate(0,0)' }],
      { duration:170 * sp, easing:'steps(3,end)', fill:'forwards' }).finished.catch(() => {})));
    cards.forEach(c => c.remove());
    working(-1);
    Sound.deckSettle(); clunk(.6); restart(d, 'ds-kick');
    setCount(52); setWord('READY', 700);
    await wait(160 * sp);
  }
  async function playShuffle2(){
    if (!on() || !deck()) return orig.playShuffle.apply(this, arguments);
    document.querySelectorAll('.ds-burn .card').forEach(b => b.remove());
    const g = game;
    const due = O.shuffle !== 'off' && (O.when === 'every' || (g && g.handNumber <= 1));
    if (motionOff() || !due){ clearWord(); setCount(52); return; }
    if (O.shuffle === 'riffle') await riffle(); else await machineShuffle();
  }

  /* ---------------- the pot plate keeps clear of a shoe on the right ---------------- */
  function keepPotClear2(){
    if (!on() || O.where !== 'right') return orig.keepPotClearOfDeck.apply(this, arguments);
    const area = $el('pot-area'), plate = area && area.querySelector('.pot-chip'), d = deck();
    if (!area || !plate || !d || area.classList.contains('hidden')){ if ($el('pot-val')) $el('pot-val')._clearKey = null; return; }
    const cur = parseFloat(area.style.marginLeft) || 0;
    const overlap = (plate.getBoundingClientRect().right - cur) - (d.getBoundingClientRect().left - 6);
    const nudge = overlap > 0 ? -Math.ceil(overlap) : 0;
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
      document.querySelectorAll('.ds-exit,.ds-riff,.ds-puff,.ds-burn .card').forEach(e => e.remove());
      const d = deck(); if (d) d.classList.remove('ds-shuffling');
      return orig.clearAllCardDOM.apply(this, arguments);
    };
    const cancel = DealFX.cancelAll;
    DealFX.cancelAll = function(){ cancelAll(); return cancel.apply(this, arguments); };
    build(); paint(); idle();
  }
  function apply(order){
    O = Object.assign({}, DEFAULTS, order || {});
    install();
    const set = (k, v) => { if (v == null) root.removeAttribute(k); else root.setAttribute(k, v); };
    set('data-ds-on', on() ? '' : null);
    set('data-ds-hold', O.hold); set('data-ds-finish', O.finish); set('data-ds-size', O.size); set('data-ds-where', O.where);
    set('data-ds-counter', O.counter); set('data-ds-cut', O.cut); set('data-ds-back', O.back);
    const k = on() ? PACE[O.pace] || 1 : 1;
    DEAL_TIMING.dealMs = Math.round(BASE_TIMING.dealMs * k);
    DEAL_TIMING.dealStaggerMs = Math.round(BASE_TIMING.dealStaggerMs * k);
    DEAL_TIMING.flopStaggerMs = Math.round(BASE_TIMING.flopStaggerMs * k);
    DEAL_TIMING.collectMs = Math.round(BASE_TIMING.collectMs * k);
    word = null; paint();
    if (!on()) layers().forEach(c => c.classList.remove('ds-gone'));
    // the pot plate and the coins' walls measure the deck: re-measure
    if ($el('pot-val')) $el('pot-val')._clearKey = null;
    const area = $el('pot-area'); if (area) area.style.marginLeft = '';
    try{ keepPotClearOfDeck(); }catch(e){}
    try{ if (typeof CoinTable !== 'undefined') CoinTable.layout(); }catch(e){}
  }
  return { DEFAULTS, apply, install, get order(){ return Object.assign({}, O); }, get count(){ return count; } };
})();
