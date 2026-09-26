"use strict";

/* ============================================================
   ENEMY CARDS V2 — the opponents' seat cards (live)
   The owner's order from the Enemy Cards order form (enemy-card-lab.html,
   round 3, 27 Sep 2026); the finish is recorded in docs/ui/PATTERN_BOOK.md
   (Enemy Cards V2). Styles: css/enemy-cards.css.

     cabinet   painted in the face's colour (css only)
     readout   a two-line CRT (the action, the amount), which counts up
     cards     the hole cards tucked under the card's bottom edge: dealt
               to just below it, then slid up under; out and a size up at
               showdown; slid back in on a fold
     cup       a coin cup in the base: their coins leave from it and come
               home to it (the coin table asks coinSource())
     rim       a lamp in the cabinet's border, in their colour, reacting to
               the table (turn, thinking, a bet, all in, a win, a fold, out)
               and pre-lighting whoever acts next
     squares   a square of darker felt under each seat and above your cards
               where the bets land (the coin table asks spot()/rowKey())
     moves     a knock on a check, a shudder on an all in

   Presentation only: it reads `game` and never changes poker state or
   money. render() calls EnemyCards.paint(); js/coin-table.js asks
   coinSource(), spot(), rowKey() and calls slot().
   ============================================================ */
const EnemyCards = (function(){
  const quiet = () => typeof motionOff === 'function' && motionOff();
  const CW = () => window.CoinWorld;
  const now = () => performance.now();
  const G = () => (typeof game !== 'undefined' ? game : null);
  const live = g => g && ['preflop','flop','turn','river'].includes(g.phase) && !g.over;
  const own = p => (typeof FACE_COLORS !== 'undefined' && Number.isInteger(p.faceColorIdx) && FACE_COLORS[p.faceColorIdx]) ? FACE_COLORS[p.faceColorIdx].fill : '#B69A7A';
  const sfx = (k, v, p) => { try{ const c = CW(); if (c && typeof settings !== 'undefined' && settings.sound) c.sfx(k, v, p); }catch(e){} };
  const felt = () => document.getElementById('felt');
  const opps = () => {
    const g = G();
    return g && typeof seatEls !== 'undefined'
      ? g.players.filter(p => !p.isHuman).map(p => ({ p, e:seatEls[p.id] })).filter(x => x.e && x.e.card)
      : [];
  };

  /* ---------------- dressing a seat ---------------- */
  function dress(p, e){
    const card = e.card;
    if (!e._ec){
      e.actionSlot.insertAdjacentHTML('afterend',
        '<div class="ec-read" aria-hidden="true"><div class="crt ec-glass" data-crt-quiet><span class="crt-line ec-v">–</span><span class="crt-line ec-a"></span></div></div>');
      e.chips.insertAdjacentHTML('afterend', '<div class="ec-cup" aria-hidden="true"><i></i></div>');
      // the hole cards leave the box: they sit behind the cabinet
      e.root.insertBefore(e.cardsContainer, e.root.firstChild);
      e.cardsContainer.classList.add('ec-out');
      e.root.classList.add('ec-seat');
      e._ec = { read:null, flash:0, win:0, won:false, amt:0, dealtHand:null, dealing:false };
    }
    e.root.style.setProperty('--ec-own', own(p));
  }

  /* ---------------- the readout ---------------- */
  const VERB = { check:'CHECK', call:'CALL', bet:'BET', raise:'RAISE', allin:'ALL IN', fold:'FOLD', ko:'K.O.!', eliminated:'OUT' };
  const fmt = n => (typeof fmtActionAmount === 'function' ? fmtActionAmount(n) : Number(n).toLocaleString()).toUpperCase();
  function reading(p){
    const sa = p.streetAction;
    if (!sa) return { type:'empty', v:'–', n:0 };
    let n = 0;
    const m = String(sa.label || '').match(/([\d,.]+)(k?)\s*$/i);
    if (m) n = Math.round(Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1));
    if (sa.type === 'allin') n = Math.max(n, p.betThisRound || 0);
    return { type:sa.type, v:VERB[sa.type] || String(sa.label || '').toUpperCase(), n };
  }
  function paintRead(p, e){
    const box = e.card.querySelector('.ec-read'); if (!box) return;
    const r = reading(p), key = r.type + '|' + r.n, st = e._ec;
    if (st.read === key) return;
    const fresh = st.read !== null;
    st.read = key;
    box.dataset.act = r.type;
    const glass = box.firstChild;
    // ink is the CRT component's own (data-ink): money for chips going in,
    // danger for all in and out
    const ink = (r.type === 'allin' || r.type === 'eliminated') ? 'danger' : (['bet','raise','call','ko'].includes(r.type) ? 'money' : '');
    if (ink) glass.dataset.ink = ink; else delete glass.dataset.ink;
    glass.querySelector('.ec-v').textContent = r.v;
    const a = glass.querySelector('.ec-a');
    clearInterval(st.rollT);
    if (!r.n){ a.textContent = ''; st.amt = 0; }
    else if (fresh && !quiet()){
      // the amount counts up from the last one, like a till
      const from = st.amt < r.n ? st.amt : 0, to = r.n, t0 = now(), T = 360;
      st.rollT = setInterval(() => {
        const k = Math.min(1, (now() - t0) / T);
        a.textContent = fmt(Math.round(from + (to - from) * k));
        if (k >= 1) clearInterval(st.rollT);
      }, 40);
      st.amt = to;
    } else { a.textContent = fmt(r.n); st.amt = r.n; }
    if (fresh && ['bet','raise','allin','call'].includes(r.type)) st.flash = now() + 520;
    if (fresh && r.type === 'check') knock(e);
    if (fresh && r.type === 'allin') shudder(e);
    if (fresh && r.type !== 'empty' && !quiet()){ glass.classList.remove('ec-blip'); void glass.offsetWidth; glass.classList.add('ec-blip'); }
  }

  /* ---------------- cabinet moves ---------------- */
  function knock(e){
    if (quiet()) return;
    e.card.classList.remove('ec-knock'); void e.card.offsetWidth; e.card.classList.add('ec-knock');
    sfx('knock', .9, .78); setTimeout(() => sfx('knock', .8, .74), 150);
    setTimeout(() => e.card.classList.remove('ec-knock'), 420);
  }
  function shudder(e){
    if (quiet()) return;
    e.card.classList.remove('ec-shudder'); void e.card.offsetWidth; e.card.classList.add('ec-shudder');
    sfx('thump', 1, .7);
    setTimeout(() => e.card.classList.remove('ec-shudder'), 520);
  }

  /* ---------------- the rim light ----------------
     The dashboard's order of precedence (js/dashboard.js): out > all in >
     win > turn, then this card's quieter states. */
  function isNext(p){
    const g = G();
    if (!live(g) || g.currentIndex < 0 || typeof findNextActor !== 'function') return false;
    const i = findNextActor((g.currentIndex + 1) % g.players.length);
    return i >= 0 && i !== g.currentIndex && g.players[i] === p;
  }
  function rimState(p, e){
    const g = G();
    if (p.eliminated) return 'out';
    if (p.allIn && !p.folded && live(g)) return 'allin';
    if (e.root.classList.contains('winner') || now() < e._ec.win) return 'win';
    if (e.root.classList.contains('active')) return e.root.classList.contains('thinking') ? 'think' : 'turn';
    if (now() < e._ec.flash) return 'flash';
    if (p.folded && live(g)) return 'fold';
    if (isNext(p)) return 'next';
    return '';
  }
  function paintRim(p, e){
    const s = rimState(p, e);
    if ((e.card.dataset.rim || '') === s) return;
    const was = e.card.dataset.rim;
    if (s) e.card.dataset.rim = s; else delete e.card.dataset.rim;
    if (s && s !== 'fold' && s !== 'out' && !quiet()){
      e.card.classList.remove('ec-relay'); void e.card.offsetWidth; e.card.classList.add('ec-relay');
      setTimeout(() => e.card.classList.remove('ec-relay'), 340);
    }
    if (s === 'out' && was !== 'out' && typeof Sound !== 'undefined' && Sound.wheelRelay) Sound.wheelRelay(.3);
  }

  /* ---------------- the tucked cards ----------------
     A new hand's cards are dealt to just below the card, in plain sight,
     and each seat's pair slides up and tucks in once both have landed. */
  function dealIn(p, e){
    const g = G();
    if (!g || e._ec.dealtHand === g.handNumber) return;
    if (g.phase !== 'preflop' || !p.hand || p.hand.length < 2 || p._reveal) return;
    e._ec.dealtHand = g.handNumber;
    e._ec.dealing = true;
    e.root.classList.add('ec-dealing');
  }
  function tuckCheck(p, e){
    if (!e._ec || !e._ec.dealing) return;
    const cards = [...e.cardsContainer.children];
    if (p.folded || !cards.length){ e._ec.dealing = false; e.root.classList.remove('ec-dealing'); return; }
    if (cards.length < 2 || cards.some(c => c.style.opacity === '0')) return;
    e._ec.dealing = false;
    setTimeout(() => { e.root.classList.remove('ec-dealing'); if (!quiet()) sfx('roll', .35, 1.35); }, quiet() ? 0 : 160);
  }

  /* ---------------- the coin cup ---------------- */
  function coinSource(p){
    const e = typeof seatEls !== 'undefined' && seatEls[p.id];
    if (!e || p.isHuman || !e._ec) return null;
    const m = e.card.querySelector('.ec-cup i'), r = m && m.getBoundingClientRect();
    if (!r || !r.width) return null;
    return { x:r.left + r.width / 2 + (Math.random() * 8 - 4), y:r.top + r.height / 2 + 2, z:2 };
  }
  function slot(p, ms){
    const e = p && !p.isHuman && typeof seatEls !== 'undefined' && seatEls[p.id];
    const s = e && e.card.querySelector('.ec-cup'); if (!s) return;
    clearTimeout(s._t);
    s.classList.add('is-open');
    s._t = setTimeout(() => s.classList.remove('is-open'), ms);
  }

  /* ---------------- bet squares ----------------
     Right under each seat (centred on the card, a fixed gap below its
     tucked cards), yours centred a clear gap above your cards. Measured
     from layout offsets, not live rects, so a knock, a deal or a showdown
     moving the cards never moves a square or the coins on it. */
  function geom(p){
    const f = felt(), c = CW();
    if (!f || !c || typeof seatEls === 'undefined') return null;
    const e = seatEls[p.id]; if (!e) return null;
    const fr = f.getBoundingClientRect(), ox = fr.left + f.clientLeft, oy = fr.top + f.clientTop, d = c.D();
    if (p.isHuman){
      const cards = document.querySelector('#hud-mid .seat.you .seat-cards');
      const r = cards && cards.getBoundingClientRect();
      if (!r || !r.width) return null;
      const S = Math.round(d * 3.2 + 6), top = r.top - 10 - S;
      return { x:r.left + r.width / 2 - ox, y:top + S / 2 - oy, s:S };
    }
    const card = e.card; if (!card || !card.offsetWidth || !e._ec) return null;
    const n = opps().length;
    const bottom = e.root.offsetTop + card.offsetTop + card.offsetHeight;
    const S = Math.round(Math.min(d * 3.4 + 6, card.offsetWidth * .7)), top = bottom + (n >= 5 ? 18 : 22) + 12;
    return { x:e.root.offsetLeft + e.root.offsetWidth / 2, y:top + S / 2, s:S };
  }
  // where this seat's coins land, felt-relative to `fr` (the coin table's
  // felt rect), with the room its pile may grow into
  function spot(p, fr){
    const q = geom(p), c = CW(), f = felt(); if (!q || !c || !f) return null;
    const r = f.getBoundingClientRect();
    return { x:q.x + r.left + f.clientLeft - fr.left, y:q.y + c.D() * .45 + r.top + f.clientTop - fr.top - 2, room:q.s - 4 };
  }
  // what, on a seat, should make the coin table lay the spots again
  function rowKey(p){
    const e = typeof seatEls !== 'undefined' && seatEls[p.id];
    return e && e._ec ? 'ec' + (e.root.offsetTop + e.card.offsetTop + e.card.offsetHeight) + ':' + e.root.offsetLeft : null;
  }
  function paintSquares(){
    const f = felt(), g = G(); if (!f || !g) return;
    const seen = new Set();
    g.players.forEach(p => {
      if (p.eliminated) return;
      const q = geom(p); if (!q) return;
      seen.add(p.id);
      let el = f.querySelector('.ec-square[data-id="' + p.id + '"]');
      if (!el){ el = document.createElement('div'); el.className = 'ec-square'; el.dataset.id = p.id; el.setAttribute('aria-hidden', 'true'); f.insertBefore(el, f.firstChild); }
      const L = Math.round(q.x - q.s / 2) + 'px', T = Math.round(q.y - q.s / 2) + 'px', W = q.s + 'px';
      if (el.style.left !== L || el.style.top !== T || el.style.width !== W){ el.style.left = L; el.style.top = T; el.style.width = W; el.style.height = W; }
    });
    f.querySelectorAll('.ec-square').forEach(el => { if (!seen.has(el.dataset.id)) el.remove(); });
  }

  /* ---------------- every repaint (render) ---------------- */
  function paint(){
    const g = G(); if (!g) return;
    opps().forEach(({ p, e }) => {
      dress(p, e);
      paintRead(p, e);
      paintRim(p, e);
      e.root.classList.toggle('ec-shown', !!p._reveal && (g.phase === 'showdown' || !!g.over));
      dealIn(p, e);
      if (e.root.classList.contains('winner') && !e._ec.won){ e._ec.won = true; e._ec.win = now() + 1400; }
      if (!e.root.classList.contains('winner')) e._ec.won = false;
    });
    paintSquares();
  }
  // the rim's timed states (a bet's flash, the next seat) and the tuck
  setInterval(() => {
    if (document.hidden) return;
    try{ opps().forEach(({ p, e }) => { if (e._ec){ paintRim(p, e); tuckCheck(p, e); } }); }catch(err){}
  }, 90);

  return { paint, coinSource, spot, rowKey, slot };
})();
