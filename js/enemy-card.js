"use strict";

/* ============================================================
   ENEMY CARDS, ROUND 2 — ORDER FORM CANDIDATES
   Injected by enemy-card-lab.html into a sandboxed copy of the real game,
   after every production script. NOT loaded by the game.

   EnemyCard.apply(order) sets the order as data-ec-* attributes on
   <html> (css/enemy-card.css reads them) and dresses each opponent's seat
   with the parts the options need. The jobs:

     cabinet  0 | painted       the case takes a wash of the face's colour
     name     0 | cast          style label (V1) | a character name
     readout  0 | two | roll    V1 slot | two-line CRT | the same, the
                                amount counting up
     cards    0 | under | fan   hole cards in the box (V1) | tucked under
                                the bottom edge (| fanned); out at showdown
     slot     0 | slit | hatch | cup   where their coins leave and come home
     rim      0 | amber | own | ownall the rim light's colours
     react    turn | full       what the rim reacts to
     next     0 | rim | pip     who acts next
     squares  0 | faint | pressed | stitched   the bet square on the felt
     blinds   0 | slide | toss  SB/BB pucks on the felt beside the square
     moves    0 | knock | both  knock on a check (| shudder on an all in)
     fold     0 | in            the cards slide into the cabinet
     gauge    0 | tube | short  stack gauge (| red under 10 big blinds)
     face     0 | 95 | 90       portrait size

   Presentation only. It wraps render() and initSeats() and
   CoinTable.bet/payout/layout to READ state after the real code has run;
   poker state and money are never written. Exceptions, sandbox-only and
   undone when the option goes back to V1: p.name takes the character
   name while NAME is CAST (so the turn banner agrees with the card), and
   three answers for the coin table (patched in the lab copy only):
   window.EC_SOURCE(p) where a seat's coins leave from and go home to,
   window.EC_SPOT(p, fr) where they land (the bet square), and
   window.EC_ROWKEY(p) what, on a seat, re-lays the spots.
   ============================================================ */
(function(){
  const JOBS = ['cabinet','name','readout','cards','slot','rim','react','next','squares','blinds','moves','fold','gauge','face'];
  const order = Object.fromEntries(JOBS.map(k => [k, '0']));
  const root = document.documentElement;
  const has = k => order[k] && order[k] !== '0';
  const quiet = () => typeof motionOff === 'function' && motionOff();
  const CW = () => window.CoinWorld;
  const G = () => (typeof game !== 'undefined' ? game : null);
  const now = () => performance.now();

  /* ---------- the cast (a proposal; the names are the owner's call) ---------- */
  const CAST = { rock:'NIGEL', shark:'LUCY', maniac:'TONY', station:'MAVIS', grinder:'STEVE', wildcard:'ROXY', professor:'HARRY', hammer:'BRUNO' };
  const castName = p => CAST[p.personality && p.personality.key] || String(p._ecName || p.name || '').toUpperCase();
  const own = p => (typeof FACE_COLORS !== 'undefined' && Number.isInteger(p.faceColorIdx) && FACE_COLORS[p.faceColorIdx]) ? FACE_COLORS[p.faceColorIdx].fill : '#B69A7A';
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
  const sfx = (k, v, p) => { try{ const c = CW(); if (c && typeof settings !== 'undefined' && settings.sound) c.sfx(k, v, p); }catch(e){} };

  const opps = () => { const g = G(); return g && typeof seatEls !== 'undefined' ? g.players.filter(p => !p.isHuman).map(p => ({ p, e:seatEls[p.id] })).filter(x => x.e && x.e.card) : []; };

  /* ================= dressing each seat ================= */
  function dress(p, e){
    const card = e.card;
    if (!card._ec){
      card._ec = true;
      e.actionSlot.insertAdjacentHTML('afterend',
        '<div class="ec-read" aria-hidden="true"><div class="crt ec-glass" data-crt-quiet><span class="crt-line ec-v">–</span><span class="crt-line ec-a"></span></div></div>');
      e.chips.insertAdjacentHTML('beforeend', '<i class="ec-gauge" aria-hidden="true"><b></b></i>');
      e.chips.insertAdjacentHTML('afterend', '<div class="ec-slot" aria-hidden="true"><i class="ec-mouth"></i><i class="ec-door ec-l"></i><i class="ec-door ec-r"></i></div>');
      e._ec = { read:null, flash:0, win:0, amt:0, dealtHand:null, dealing:false };
    }
    e.root.style.setProperty('--ec-own', own(p));
    // the name plate
    const plate = card.querySelector('.seat-name');
    const want = order.name === 'cast' ? castName(p) : (p._ecName || p.name);
    if (plate && plate.textContent !== want) plate.textContent = want;
    // the hole cards: in the box (V1) or out under its bottom edge
    const out = has('cards');
    if (out && e.cardsContainer.parentNode !== e.root){ e.root.insertBefore(e.cardsContainer, e.root.firstChild); e.cardsContainer.classList.add('ec-out'); }
    if (!out && e.cardsContainer.parentNode === e.root){ card.appendChild(e.cardsContainer); e.cardsContainer.classList.remove('ec-out'); }
  }

  /* character names: the game's own name while NAME is CAST */
  function names(){
    const g = G(); if (!g) return;
    g.players.forEach(p => {
      if (p.isHuman) return;
      if (order.name === 'cast'){ if (p._ecName === undefined) p._ecName = p.name; p.name = castName(p).charAt(0) + castName(p).slice(1).toLowerCase(); }
      else if (p._ecName !== undefined){ p.name = p._ecName; delete p._ecName; }
    });
  }

  /* ================= the readout ================= */
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
    glass.dataset.ink = (r.type === 'allin' || r.type === 'eliminated') ? 'danger' : (['bet','raise','call','ko'].includes(r.type) ? 'money' : '');
    glass.querySelector('.ec-v').textContent = r.v;
    const a = glass.querySelector('.ec-a');
    clearInterval(st.rollT);
    if (!r.n){ a.textContent = ''; st.amt = 0; }
    else if (order.readout === 'roll' && fresh && !quiet()){
      // the amount counts up from the last one, like a till
      const from = st.amt < r.n ? st.amt : 0, to = r.n, t0 = now(), T = 360;
      st.rollT = setInterval(() => {
        const k = Math.min(1, (now() - t0) / T), v = Math.round(from + (to - from) * k);
        a.textContent = fmt(v);
        if (k >= 1) clearInterval(st.rollT);
      }, 40);
      st.amt = to;
    } else { a.textContent = fmt(r.n); st.amt = r.n; }
    if (fresh && ['bet','raise','allin','call'].includes(r.type)) st.flash = now() + 520;
    if (fresh && r.type === 'check' && order.moves !== '0') knock(e);
    if (fresh && r.type === 'allin' && order.moves === 'both') shudder(e);
    if (fresh && r.type !== 'empty'){ glass.classList.remove('ec-blip'); void glass.offsetWidth; glass.classList.add('ec-blip'); }
  }

  /* ================= cabinet moves ================= */
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

  /* ================= the rim light ================= */
  // Same order of precedence as the dashboard's (js/dashboard.js):
  // out > all in > win > turn, then this card's own quieter states.
  function rimState(p, e){
    const g = G(), live = g && ['preflop','flop','turn','river'].includes(g.phase) && !g.over;
    const full = order.react === 'full';
    if (p.eliminated) return 'out';
    if (p.allIn && !p.folded && live) return 'allin';
    if (e.root.classList.contains('winner') || now() < e._ec.win) return 'win';
    if (e.root.classList.contains('active')) return (full && e.root.classList.contains('thinking')) ? 'think' : 'turn';
    if (full && now() < e._ec.flash) return 'flash';
    if (p.folded && live) return full ? 'fold' : '';
    if (order.next === 'rim' && isNext(p)) return 'next';
    return '';
  }
  function isNext(p){
    const g = G();
    if (!g || g.over || !['preflop','flop','turn','river'].includes(g.phase) || g.currentIndex < 0 || typeof findNextActor !== 'function') return false;
    const i = findNextActor((g.currentIndex + 1) % g.players.length);
    return i >= 0 && i !== g.currentIndex && g.players[i] === p;
  }
  function paintRim(p, e){
    const s = has('rim') ? rimState(p, e) : '';
    if (e.card.dataset.rim === s) return;
    const was = e.card.dataset.rim;
    if (s) e.card.dataset.rim = s; else delete e.card.dataset.rim;
    if (s && s !== 'fold' && s !== 'out' && !quiet()){
      e.card.classList.remove('ec-relay'); void e.card.offsetWidth; e.card.classList.add('ec-relay');
      setTimeout(() => e.card.classList.remove('ec-relay'), 340);
    }
    if (s === 'out' && was !== 'out' && typeof Sound !== 'undefined' && Sound.wheelRelay) Sound.wheelRelay(.3);
  }

  /* ================= next-to-act pip ================= */
  function paintPip(p, e){
    e.card.classList.toggle('ec-is-next', order.next === 'pip' && isNext(p));
  }

  /* ================= stack gauge ================= */
  function paintGauge(p, e){
    const gEl = e.chips.querySelector('.ec-gauge'); if (!gEl) return;
    if (!gEl.isConnected || gEl.parentNode !== e.chips) e.chips.appendChild(gEl);
    const g = G(); if (!g) return;
    const top = Math.max(1, ...g.players.filter(x => !x.eliminated).map(x => x.chips + (x.totalBetHand || 0)));
    const mine = p.chips + (p.totalBetHand || 0);
    gEl.style.setProperty('--v', Math.round(Math.max(0, Math.min(1, mine / top)) * 100) + '%');
    const short = order.gauge === 'short' && !p.eliminated && p.chips > 0 && p.chips < 10 * (g.bigBlind || 1);
    gEl.classList.toggle('is-short', short);
  }

  /* ================= the coin slot ================= */
  // Where a seat's coins leave from and go home to: the slot's mouth when
  // there is one, otherwise the peek of their tucked cards; V1 otherwise.
  window.EC_SOURCE = function(p){
    const e = typeof seatEls !== 'undefined' && seatEls[p.id];
    if (!e || p.isHuman) return null;
    if (has('slot')){
      const m = e.card.querySelector('.ec-mouth'), r = m && m.getBoundingClientRect();
      if (r && r.width) return { x:r.left + r.width / 2 + (Math.random() * 8 - 4), y:r.top + r.height / 2 + 2, z:2 };
    }
    if (has('cards')){
      const r = e.card.getBoundingClientRect();
      return { x:r.left + r.width / 2 + (Math.random() * 12 - 6), y:r.bottom + 6, z:4 };
    }
    return null;
  };
  function slotGo(p, ms){
    const e = seatEls[p.id]; if (!e || !has('slot')) return;
    const s = e.card.querySelector('.ec-slot'); if (!s) return;
    clearTimeout(s._t);
    s.classList.add('is-open');
    if (order.slot === 'hatch') sfx('knock', .5, 1.6);
    s._t = setTimeout(() => { s.classList.remove('is-open'); if (order.slot === 'hatch') sfx('knock', .45, 1.3); }, ms);
  }
  function wrapCoinTable(){
    if (typeof CoinTable === 'undefined' || CoinTable._ec) return;
    CoinTable._ec = true;
    const bet = CoinTable.bet, pay = CoinTable.payout, lay = CoinTable.layout;
    CoinTable.bet = function(p, amount){
      if (p && !p.isHuman) slotGo(p, 700);
      const r = bet.apply(this, arguments);
      if (p && !p.isHuman) Promise.resolve(r).then(() => slotGo(p, 260));
      return r;
    };
    CoinTable.payout = function(winner){
      if (winner && !winner.isHuman) slotGo(winner, 30000);
      const r = pay.apply(this, arguments);
      if (winner && !winner.isHuman) Promise.resolve(r).then(() => slotGo(winner, 380));
      return r;
    };
    CoinTable.layout = function(){ const r = lay.apply(this, arguments); placeFelt(); return r; };
  }

  /* ================= bet squares + blind pucks on the felt ================= */
  const felt = () => document.getElementById('felt');
  function feltXY(x, y){
    const f = felt(), r = f.getBoundingClientRect();
    return { x:x - r.left - f.clientLeft, y:y - r.top - f.clientTop };
  }
  /* Where a seat's bet square goes, and so where its coins land: right
     under the seat (centred on the card, a fixed gap below its tucked
     cards), yours centred a clear gap above your cards. Measured from
     layout offsets, not live rects, so a knock, a deal or a showdown
     moving the cards never moves the square (or the coins on it). */
  const oppCount = () => opps().length;
  function spotGeom(p){
    const f = felt(), c = CW(), g = G();
    if (!f || !c || !g || typeof seatEls === 'undefined') return null;
    const e = seatEls[p.id]; if (!e) return null;
    const fr = f.getBoundingClientRect(), ox = fr.left + f.clientLeft, oy = fr.top + f.clientTop, d = c.D();
    const n = oppCount();
    if (p.isHuman){
      const cards = document.querySelector('#hud-mid .seat.you .seat-cards');
      const r = cards && cards.getBoundingClientRect();
      if (!r || !r.width) return null;
      const S = Math.round(d * 3.2 + 6), top = r.top - 10 - S;
      return { x:r.left + r.width / 2 - ox, y:top + S / 2 - oy, s:S, you:true };
    }
    const card = e.card; if (!card || !card.offsetWidth) return null;
    const cw = card.offsetWidth, bottom = e.root.offsetTop + card.offsetTop + card.offsetHeight;
    const hang = has('cards') ? (n >= 5 ? 18 : 22) : Math.max(0, e.cardsContainer.offsetTop + e.cardsContainer.offsetHeight - card.offsetHeight) + 6;
    const S = Math.round(Math.min(d * 3.4 + 6, cw * .7)), top = bottom + hang + 12;
    return { x:e.root.offsetLeft + e.root.offsetWidth / 2, y:top + S / 2, s:S, you:false };
  }
  // the coin table asks (lab seam, see js/enemy-card-lab.js): where this
  // seat's coins land (fr: the felt's rect; the answer is felt-relative)
  window.EC_SPOT = function(p, fr){
    if (!has('squares')) return null;
    const q = spotGeom(p), c = CW(); if (!q || !c) return null;
    const f = felt(), dx = f.getBoundingClientRect().left + f.clientLeft - fr.left, dy = f.getBoundingClientRect().top + f.clientTop - fr.top;
    const base = q.y + c.D() * .45;
    return { x:q.x + dx, y:base + dy - 2, room:q.s - 4 };
  };
  // and what, on a seat, should make it lay the spots again
  window.EC_ROWKEY = function(p){
    if (!has('squares')) return null;
    const e = typeof seatEls !== 'undefined' && seatEls[p.id];
    return e && e.card ? 'ec' + (e.root.offsetTop + e.card.offsetTop + e.card.offsetHeight) + ':' + e.root.offsetLeft : null;
  };
  const spots = {};                 // id -> { x, y, s } in felt px, the square's centre
  function placeFelt(){
    const f = felt(), g = G();
    if (!f || !g) return;
    const seen = new Set();
    g.players.forEach(p => {
      if (p.eliminated) return;
      const sp = spotGeom(p); if (!sp) return;
      spots[p.id] = sp; seen.add(p.id);
      let el = f.querySelector('.ec-square[data-id="' + p.id + '"]');
      if (!el){ el = document.createElement('div'); el.className = 'ec-square'; el.dataset.id = p.id; el.setAttribute('aria-hidden', 'true'); f.insertBefore(el, f.firstChild); }
      el.style.left = Math.round(sp.x - sp.s / 2) + 'px'; el.style.top = Math.round(sp.y - sp.s / 2) + 'px'; el.style.width = sp.s + 'px'; el.style.height = sp.s + 'px';
    });
    f.querySelectorAll('.ec-square').forEach(el => { if (!seen.has(el.dataset.id)) el.remove(); });
    Object.keys(spots).forEach(k => { if (!seen.has(k)) delete spots[k]; });
    pucks();
  }

  /* SB / BB pucks: wider and flatter than a coin; they sit at the corner
     of the seat's square nearest the middle of the table, and when the
     blinds move on they slide (or are tossed) to the next seat. */
  const puckEls = {};
  const shownAt = { SB:null, BB:null };
  function puckHome(id){
    const sp = spots[id]; if (!sp) return null;
    const f = felt(), mid = f ? f.clientWidth / 2 : 200;
    // the square's bottom corner on the rail side, half on the felt: the
    // coins land in the middle of the square and never on the puck
    if (sp.you) return { x:sp.x - sp.s / 2 - 6, y:sp.y + sp.s / 2 - 5 };
    const out = sp.x < mid ? -1 : 1;
    return { x:sp.x + out * (sp.s / 2 - 1), y:sp.y + sp.s / 2 - 3 };
  }
  function deckXY(){
    const d = document.getElementById('dealer-deck'), r = d && d.getBoundingClientRect();
    if (!r || !r.width) return null;
    return feltXY(r.left + r.width / 2, r.top + r.height / 2);
  }
  function pucks(){
    const f = felt(), g = G();
    if (!f || !g) return;
    if (!has('blinds') || !g.positions || g.over){
      Object.values(puckEls).forEach(el => el.remove()); Object.keys(puckEls).forEach(k => delete puckEls[k]);
      shownAt.SB = shownAt.BB = null;
      return;
    }
    ['SB','BB'].forEach(kind => {
      const id = Object.keys(g.positions).find(k => g.positions[k] === kind);
      let home = id && puckHome(id);
      if (home) home = { x:Math.max(18, Math.min(f.clientWidth - 18, home.x)), y:home.y };
      let el = puckEls[kind];
      if (!home){ if (el){ el.remove(); delete puckEls[kind]; shownAt[kind] = null; } return; }
      if (!el || !el.isConnected){
        el = puckEls[kind] = document.createElement('div');
        el.className = 'ec-puck ec-' + kind.toLowerCase(); el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<i></i><b>' + kind + '</b>';
        f.appendChild(el);
        const from = deckXY() || home;
        el._at = from; set(el, from);
        shownAt[kind] = null;
      }
      const key = id + '@' + home.x + ',' + home.y;
      if (shownAt[kind] === key) return;
      const movedSeat = !shownAt[kind] || shownAt[kind].split('@')[0] !== id;
      shownAt[kind] = key;
      if (movedSeat) travel(el, el._at, home, kind === 'BB' ? 90 : 0); else { set(el, home); }
      el._at = home;
    });
  }
  const set = (el, q) => { el.style.left = q.x + 'px'; el.style.top = q.y + 'px'; };
  function travel(el, a, b, delay){
    el.getAnimations().forEach(x => x.cancel());
    set(el, b);
    if (quiet() || !a || (a.x === b.x && a.y === b.y)) return;
    const dx = a.x - b.x, dy = a.y - b.y, L = Math.hypot(dx, dy);
    if (order.blinds === 'slide'){
      // pushed across the felt by the dealer: a firm shove, a little
      // overshoot, and it settles
      const T = 420 + Math.min(260, L * .6);
      el.animate([
        { transform:'translate(' + dx + 'px,' + dy + 'px)' },
        { transform:'translate(' + (-dx * .04) + 'px,' + (-dy * .04) + 'px)', offset:.82 },
        { transform:'translate(0,0)' }
      ], { duration:T, delay, easing:'cubic-bezier(.3,.7,.25,1)', fill:'backwards' });
      setTimeout(() => sfx('roll', .5, .7), delay);
      setTimeout(() => sfx('stack', .55, .72), delay + T * .8);
    } else {
      // tossed: a flat arc with one turn over, a heavy landing, one hop
      const T = 520 + Math.min(300, L * .7), lift = Math.min(70, 26 + L * .18);
      const k = [];
      for (let i = 0; i <= 10; i++){
        const t = i / 10, x = dx * (1 - t), y = dy * (1 - t) - lift * 4 * t * (1 - t);
        const flip = Math.cos(t * Math.PI * 2);
        k.push({ transform:'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scaleY(' + (Math.max(.18, Math.abs(flip))).toFixed(2) + ')', offset:t * .78 });
      }
      k.push({ transform:'translate(0,0) scale(1.14,.72)', offset:.84 });
      k.push({ transform:'translate(0,-5px) scale(.96,1.05)', offset:.92 });
      k.push({ transform:'translate(0,0) scale(1,1)', offset:1 });
      el.animate(k, { duration:T, delay, easing:'linear', fill:'backwards' });
      setTimeout(() => sfx('thump', .75, .62), delay + T * .8);
      setTimeout(() => sfx('land', .45, .66), delay + T * .95);
    }
  }

  /* ================= every repaint ================= */
  let lastHand = -1;
  function paint(){
    const g = G(); if (!g) return;
    opps().forEach(({ p, e }) => {
      dress(p, e);
      paintRead(p, e);
      paintRim(p, e);
      paintPip(p, e);
      paintGauge(p, e);
      e.root.classList.toggle('ec-shown', !!p._reveal && (g.phase === 'showdown' || !!g.over));
      dealIn(p, e);
      if (e.root.classList.contains('winner') && !e._ec.won){ e._ec.won = true; e._ec.win = now() + 1400; }
      if (!e.root.classList.contains('winner')) e._ec.won = false;
    });
    placeFelt();
  }
  /* Dealt under the cabinet: a new hand's cards are dealt to just below
     the card (fully out, where the flight can land in plain sight), and
     each seat's pair slides up and tucks in once both have landed. */
  function dealIn(p, e){
    const g = G();
    if (!has('cards') || !g || e._ec.dealtHand === g.handNumber) return;
    if (g.phase !== 'preflop' || !p.hand || p.hand.length < 2 || p._reveal) return;
    e._ec.dealtHand = g.handNumber;
    e._ec.dealing = true;
    e.root.classList.add('ec-dealing');
  }
  function tuckCheck(p, e){
    if (!e._ec.dealing) return;
    const cards = [...e.cardsContainer.children];
    if (!has('cards') || p.folded || !cards.length){ e._ec.dealing = false; e.root.classList.remove('ec-dealing'); return; }
    if (cards.length < 2 || cards.some(c => c.style.opacity === '0')) return;
    e._ec.dealing = false;
    setTimeout(() => {
      e.root.classList.remove('ec-dealing');
      if (!quiet()) sfx('roll', .35, 1.35);
    }, quiet() ? 0 : 160);
  }
  setInterval(() => { try{ opps().forEach(({ p, e }) => { if (e.card._ec){ paintRim(p, e); paintPip(p, e); tuckCheck(p, e); } }); }catch(e){} }, 90);

  /* ================= wrapping the game (read-only) ================= */
  function wrap(){
    const R = window.render;
    if (typeof R === 'function' && !R._ec){
      window.render = function(){ const r = R.apply(this, arguments); try{ paint(); }catch(e){ console.error(e); } return r; };
      window.render._ec = true;
    }
    const I = window.initSeats;
    if (typeof I === 'function' && !I._ec){
      window.initSeats = function(){ const r = I.apply(this, arguments); try{ paint(); }catch(e){} return r; };
      window.initSeats._ec = true;
    }
    wrapCoinTable();
  }
  wrap();

  function apply(next){
    Object.assign(order, next || {});
    JOBS.forEach(k => { if (has(k)) root.setAttribute('data-ec-' + k, order[k]); else root.removeAttribute('data-ec-' + k); });
    root.setAttribute('data-ec-react', order.react === 'full' ? 'full' : 'turn');
    names();
    opps().forEach(({ e }) => { if (e._ec) e._ec.read = null; });
    Object.values(puckEls).forEach(el => el.remove()); Object.keys(puckEls).forEach(k => delete puckEls[k]);
    shownAt.SB = shownAt.BB = null;
    wrap();
    try{ window.render(); }catch(e){}
    // the bet spots follow the cards (tucked cards move them): re-lay
    try{ if (typeof CoinTable !== 'undefined') CoinTable.layout(); }catch(e){}
    placeFelt();
  }

  window.EnemyCard = { apply, get order(){ return Object.assign({}, order); }, get spots(){ return spots; } };
  // The game asks EnemyCards (js/enemy-cards.js, stripped from the lab's
  // copy) where coins leave from and land; this candidate answers instead.
  window.EnemyCards = { paint(){}, slot(){}, coinSource:p => window.EC_SOURCE(p), spot:(p, fr) => window.EC_SPOT(p, fr), rowKey:p => window.EC_ROWKEY(p) };
})();
