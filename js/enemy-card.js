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
     file     0 | flip | drawer | index    tap a face: their file
     moves    0 | knock | both  knock on a check (| shudder on an all in)
     fold     0 | in            the cards slide into the cabinet
     gauge    0 | tube | short  stack gauge (| red under 10 big blinds)
     face     0 | 95 | 90       portrait size

   Presentation only. It wraps render(), applyAction(), finishHand() and
   CoinTable.bet/payout to READ state after the real code has run; poker
   state and money are never written. Two exceptions, both sandbox-only
   and both undone when the option goes back to V1: p.name takes the
   character name while NAME is CAST (so the turn banner agrees with the
   card), and window.EC_SOURCE tells the coin table (patched in the lab
   copy only) where a seat's coins leave from and go home to.
   ============================================================ */
(function(){
  const JOBS = ['cabinet','name','readout','cards','slot','rim','react','next','squares','blinds','file','moves','fold','gauge','face'];
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
      card.insertAdjacentHTML('beforeend', '<div class="ec-back" aria-hidden="true"></div>');
      e.root.insertAdjacentHTML('beforeend', '<button type="button" class="ec-tab" aria-label="Open file">FILE</button>');
      e.root.querySelector('.ec-tab').addEventListener('click', ev => { ev.stopPropagation(); toggleFile(p.id); });
      e._ec = { read:null, flash:0, win:0, shudder:0, amt:0 };
    }
    e.root.style.setProperty('--ec-own', own(p));
    // the name plate
    const plate = card.querySelector('.seat-name');
    const want = order.name === 'cast' ? castName(p) : (p._ecName || p.name);
    if (plate && plate.textContent !== want) plate.textContent = want;
    // the hole cards: in the box (V1) or out under its bottom edge
    const out = has('cards');
    if (out && e.cardsContainer.parentNode !== e.root){ e.root.insertBefore(e.cardsContainer, e.root.firstChild); e.cardsContainer.classList.add('ec-out'); }
    if (!out && e.cardsContainer.parentNode === e.root){ card.insertBefore(e.cardsContainer, card.querySelector('.ec-back')); e.cardsContainer.classList.remove('ec-out'); }
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
  function squareSize(){
    const c = CW(), d = c ? c.D() : 15, n = opps().length;
    return Math.round(d * (n >= 6 ? 2.5 : n === 5 ? 2.7 : 3.2) + 6);
  }
  const spots = {};                 // id -> { x, y, s } in felt px, the square's centre
  function placeFelt(){
    const f = felt(), c = CW(), g = G();
    if (!f || !c || !g || !c.zones) return;
    const S = squareSize();
    const seen = new Set();
    g.players.forEach(p => {
      const z = c.zones['spot:' + p.id];
      if (!z || p.eliminated) return;
      const q = feltXY(z.cx, z.cy), d = c.D();
      // the pile builds up from the zone's base: centre the square a
      // little above it so a small pile sits in the middle of the patch
      const sp = { x:Math.round(q.x), y:Math.round(q.y - d * .35), s:S, you:p.isHuman };
      spots[p.id] = sp; seen.add(p.id);
      let el = f.querySelector('.ec-square[data-id="' + p.id + '"]');
      if (!el){ el = document.createElement('div'); el.className = 'ec-square'; el.dataset.id = p.id; el.setAttribute('aria-hidden', 'true'); f.insertBefore(el, f.firstChild); }
      el.style.left = (sp.x - S / 2) + 'px'; el.style.top = (sp.y - S / 2) + 'px'; el.style.width = S + 'px'; el.style.height = S + 'px';
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

  /* ================= the file ================= */
  const stats = {};                  // id -> { hands, vp, pfr, aggr, calls, best, shown, _vp, _pfr }
  const S = id => stats[id] || (stats[id] = { hands:0, vp:0, pfr:0, aggr:0, calls:0, best:0, shown:null, _vp:false, _pfr:false });
  function record(p, action, phase){
    if (!p || p.isHuman) return;
    const s = S(p.id);
    if (['call','bet','raise','allin'].includes(action) && phase === 'preflop') s._vp = true;
    if (['bet','raise','allin'].includes(action) && phase === 'preflop') s._pfr = true;
    if (['bet','raise','allin'].includes(action)) s.aggr++;
    if (action === 'call') s.calls++;
  }
  function handDone(outcome){
    const g = G(); if (!g) return;
    const winners = outcome && outcome.winnerIds instanceof Set ? outcome.winnerIds : new Set(outcome && outcome.winner ? [outcome.winner.id] : []);
    g.players.forEach(p => {
      if (p.isHuman) return;
      const s = S(p.id);
      const dealt = Number.isFinite(p._handStartChips) ? p._handStartChips > 0 : p.hand && p.hand.length;
      if (dealt){ s.hands++; if (s._vp) s.vp++; if (s._pfr) s.pfr++; }
      s._vp = s._pfr = false;
      const won = Number.isFinite(p._handStartChips) ? p.chips - p._handStartChips : 0;
      if (won > s.best) s.best = won;
      if (outcome && outcome.type === 'showdown' && p._reveal && p._handRes && p.hand && p.hand.length === 2)
        s.shown = { cards:p.hand.slice(), cat:p._handRes.result.cat, won:winners.has(p.id), hand:g.handNumber };
    });
    refreshFiles();
  }
  // needle: -60deg (left) .. +60deg (right); null while still reading
  function reads(s){
    if (s.hands < 5) return { loose:null, aggr:null };
    const vpip = s.vp / s.hands;                       // 0.15 tight .. 0.55 loose
    const af = s.calls ? s.aggr / s.calls : (s.aggr ? 3 : 1);   // 0.5 passive .. 3 aggressive
    const l = Math.max(-1, Math.min(1, (vpip - .35) / .2));
    const a = Math.max(-1, Math.min(1, (Math.log2(Math.max(.25, af)) - .58) / 1.3));
    return { loose:l, aggr:a };
  }
  function gauge(label, left, right, v){
    const ang = v === null ? 0 : Math.round(v * 60);
    const ticks = [-60,-30,0,30,60].map(t => { const r = t * Math.PI / 180; return '<line x1="' + (20 + Math.sin(r) * 13).toFixed(1) + '" y1="' + (20 - Math.cos(r) * 13).toFixed(1) + '" x2="' + (20 + Math.sin(r) * 16).toFixed(1) + '" y2="' + (20 - Math.cos(r) * 16).toFixed(1) + '"/>'; }).join('');
    return '<div class="ec-gauge-dial' + (v === null ? ' is-reading' : '') + '" style="--a:' + ang + 'deg">' +
      '<svg viewBox="0 0 40 23" shape-rendering="crispEdges" aria-hidden="true"><path class="ec-arc" d="M4 20 A16 16 0 0 1 36 20"/><g class="ec-ticks">' + ticks + '</g>' +
      '<g class="ec-needle"><line x1="20" y1="20" x2="20" y2="6"/></g><rect class="ec-hub" x="18" y="18" width="4" height="4"/></svg>' +
      '<span class="ec-dial-l">' + left + '</span><span class="ec-dial-r">' + right + '</span></div>';
  }
  function tally(n){
    const shown = Math.min(n, 20);
    let out = '';
    for (let i = 0; i < shown; i += 5){
      const k = Math.min(5, shown - i);
      out += '<i class="ec-tally">' + '<b></b>'.repeat(Math.min(4, k)) + (k === 5 ? '<s></s>' : '') + '</i>';
    }
    return out + (n > 20 ? '<em>+' + (n - 20) + '</em>' : '') + (n === 0 ? '<em>NONE YET</em>' : '');
  }
  const SHORT = ['HIGH CARD','PAIR','TWO PAIR','TRIPS','STRAIGHT','FLUSH','FULL HOUSE','QUADS','STR FLUSH','ROYAL'];
  function miniCard(c){
    const red = c.suit === '♥' || c.suit === '♦';
    return '<span class="ec-mini' + (red ? ' is-red' : '') + '"><b>' + esc(c.rank) + '</b><i>' + esc(c.suit) + '</i></span>';
  }
  function fileHTML(p, paper){
    const s = S(p.id), r = reads(s);
    const shown = s.shown
      ? '<div class="ec-shown">' + s.shown.cards.map(miniCard).join('') + '<span>' + SHORT[s.shown.cat] + '<br>' + (s.shown.won ? 'WON' : 'LOST') + '</span></div>'
      : '<div class="ec-shown is-none"><span>NOT SHOWN</span></div>';
    return '<div class="ec-file-head"><b>' + esc(order.name === 'cast' ? castName(p) : String(p._ecName || p.name).toUpperCase()) + '</b><small>FILE</small></div>' +
      '<div class="' + (paper ? 'ec-paper' : 'crt') + ' ec-file-glass"' + (paper ? '' : ' data-crt-quiet') + '>' +
        gauge('PLAYS', 'TIGHT', 'LOOSE', r.loose) +
        gauge('BETS', 'MEEK', 'WILD', r.aggr) +
        '<div class="ec-file-row"><span class="crt-caption">HANDS</span><div class="ec-tallies">' + tally(s.hands) + '</div></div>' +
        '<div class="ec-file-row"><span class="crt-caption">LAST SHOWN</span>' + shown + '</div>' +
        '<div class="ec-file-row"><span class="crt-caption">BEST WIN</span><b class="crt-figure ec-best">' + (s.best ? '+' + fmt(s.best) : '—') + '</b></div>' +
      '</div>';
  }
  let openId = null;
  function toggleFile(id){
    if (!has('file')) return;
    const was = openId;
    if (openId) closeFile();
    if (was !== id) openFile(id);
  }
  // The drawer and the index card float in their own layer above the
  // coin world (whose coins are drawn over the whole felt), clipped at the
  // card's bottom edge so they still come out from under the cabinet.
  function floatHost(){
    const ts = document.getElementById('table-screen');
    let h = document.getElementById('ec-files');
    if (!h && ts){ h = document.createElement('div'); h.id = 'ec-files'; h.setAttribute('aria-hidden', 'true'); ts.appendChild(h); }
    return h;
  }
  function holder(e){
    return order.file === 'flip' ? e.card.querySelector('.ec-back') : document.querySelector('#ec-files .ec-file-body');
  }
  function openFile(id){
    const g = G(), p = g && g.players.find(x => x.id === id), e = p && seatEls[id];
    if (!e || p.eliminated) return;
    openId = id;
    e.root.classList.add('ec-file-open');
    if (order.file === 'flip'){ holder(e).innerHTML = fileHTML(p); turn(e, true); }
    else {
      const host = floatHost(); if (!host) return;
      host.querySelectorAll('.ec-clip').forEach(c => c.remove());
      const r = e.card.getBoundingClientRect(), hr = host.getBoundingClientRect();
      const clip = document.createElement('div');
      clip.className = 'ec-clip ec-clip-' + order.file;
      clip.style.setProperty('--ec-own', own(p));
      let W, L;
      if (order.file === 'drawer'){ W = r.width - 6; L = r.left - hr.left + 3; }
      else { W = 148; L = Math.max(6, Math.min(hr.width - W - 6, r.left - hr.left + r.width / 2 - W / 2)); }
      Object.assign(clip.style, { left:L + 'px', top:(r.bottom - hr.top - 1) + 'px', width:W + 'px' });
      clip.innerHTML = order.file === 'drawer'
        ? '<div class="ec-drawer"><div class="ec-drawer-in ec-file-body">' + fileHTML(p) + '</div></div>'
        : '<div class="ec-index ec-file-body">' + fileHTML(p, true) + '</div>';
      host.appendChild(clip);
      void clip.offsetWidth;
      clip.classList.add('is-open');
    }
    sfx('stack', .5, 1.4);
  }
  function closeFile(){
    const e = openId && seatEls[openId];
    openId = null;
    const host = document.getElementById('ec-files');
    if (host) host.querySelectorAll('.ec-clip').forEach(c => { c.classList.remove('is-open'); setTimeout(() => c.remove(), quiet() ? 0 : 320); });
    if (!e) return;
    if (order.file === 'flip') turn(e, false); else e.root.classList.remove('ec-file-open');
    sfx('stack', .4, 1.2);
  }
  // the card turns over like a playing card: squeezed to its edge, the
  // other face, back out (one physical turn, no 3D glass)
  function turn(e, toBack){
    const card = e.card;
    const swap = () => { e.root.classList.toggle('ec-file-open', toBack); card.classList.toggle('ec-flipped', toBack); };
    if (quiet()){ swap(); return; }
    card.getAnimations().filter(a => a.id === 'ec-turn').forEach(a => a.cancel());
    const a = card.animate([{ transform:'scaleX(1)' }, { transform:'scaleX(.04) translateY(-3px)' }], { duration:130, easing:'cubic-bezier(.5,0,.9,.5)' });
    a.id = 'ec-turn';
    a.onfinish = () => {
      swap();
      const b = card.animate([{ transform:'scaleX(.04) translateY(-3px)' }, { transform:'scaleX(1.04)', offset:.8 }, { transform:'scaleX(1)' }], { duration:170, easing:'cubic-bezier(.2,.6,.3,1)' });
      b.id = 'ec-turn';
    };
  }
  function refreshFiles(){
    if (!openId) return;
    const g = G(), p = g && g.players.find(x => x.id === openId), e = p && seatEls[openId];
    if (e) holder(e).innerHTML = fileHTML(p);
  }
  // Tap a face (or the card) to open its file; tap anywhere else to shut it.
  document.addEventListener('click', ev => {
    if (!has('file')) return;
    const seat = ev.target.closest && ev.target.closest('.seat:not(.you)');
    if (seat){
      const id = Object.keys(seatEls).find(k => seatEls[k].root === seat);
      if (id){ ev.stopPropagation(); toggleFile(id); return; }
    }
    if (openId) closeFile();
  }, true);

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
      e.root.classList.toggle('ec-shown', !!p._reveal && g.phase === 'showdown' || (!!p._reveal && !!g.over));
      if (e.root.classList.contains('winner') && !e._ec.won){ e._ec.won = true; e._ec.win = now() + 1400; }
      if (!e.root.classList.contains('winner')) e._ec.won = false;
    });
    if (g.handNumber !== lastHand){
      lastHand = g.handNumber;
      // a new hand: a file flipped open shuts, tucked cards go back in
      if (openId && order.file === 'flip') closeFile();
    }
    // a flipped file turns back when that player has to act
    if (openId && order.file === 'flip'){ const e = seatEls[openId]; if (e && e.root.classList.contains('active')) closeFile(); }
    placeFelt();
  }
  setInterval(() => { try{ opps().forEach(({ p, e }) => { if (e.card._ec){ paintRim(p, e); paintPip(p, e); } }); }catch(e){} }, 120);

  /* ================= wrapping the game (read-only) ================= */
  function wrap(){
    const R = window.render;
    if (typeof R === 'function' && !R._ec){
      window.render = function(){ const r = R.apply(this, arguments); try{ paint(); }catch(e){ console.error(e); } return r; };
      window.render._ec = true;
    }
    const A = window.applyAction;
    if (typeof A === 'function' && !A._ec){
      window.applyAction = function(player, decision){
        const phase = G() && G().phase;
        const r = A.apply(this, arguments);
        try{ record(player, decision && decision.action, phase); }catch(e){}
        return r;
      };
      window.applyAction._ec = true;
    }
    const F = window.finishHand;
    if (typeof F === 'function' && !F._ec){
      window.finishHand = function(outcome){ try{ handDone(outcome); }catch(e){ console.error(e); } return F.apply(this, arguments); };
      window.finishHand._ec = true;
    }
    const I = window.initSeats;
    if (typeof I === 'function' && !I._ec){
      window.initSeats = function(){ const r = I.apply(this, arguments); openId = null; try{ paint(); }catch(e){} return r; };
      window.initSeats._ec = true;
    }
    wrapCoinTable();
  }
  wrap();

  function apply(next){
    Object.assign(order, next || {});
    JOBS.forEach(k => { if (has(k)) root.setAttribute('data-ec-' + k, order[k]); else root.removeAttribute('data-ec-' + k); });
    root.setAttribute('data-ec-react', order.react === 'full' ? 'full' : 'turn');
    if (openId){ const e = seatEls[openId]; openId = null; if (e){ e.root.classList.remove('ec-file-open'); e.card.classList.remove('ec-flipped'); } }
    const host = document.getElementById('ec-files'); if (host) host.innerHTML = '';
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

  window.EnemyCard = { apply, get order(){ return Object.assign({}, order); }, stats, open:id => { if (openId !== id) toggleFile(id); }, close:closeFile, get spots(){ return spots; } };
})();
