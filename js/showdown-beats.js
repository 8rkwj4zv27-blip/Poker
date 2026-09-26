"use strict";

/* ============================================================
   SHOWDOWN BEATS — candidate for the showdown pass (Lab only)
   docs/ui/SHOWDOWN_PLAN.md · chosen in showdown-lab.html

   The end of a hand as beats, each with parts the owner picks from:
     lock      betting closes: a relay, the lights dip, the console flips
     runout    all in before the river: hands up, named, win chance, the
               river squeezed
     reveal    who shows first, each hand named on its seat, the lead
               changing hands, losing hands left readable
     verdict   the winning five (the rail), the duel with the best losing
               five, or in place; KICKER and SPLIT plates
     pots      side pots as their own stacks and plates, paid pot by pot
               (the last side pot first, the main pot last)
     payout    by pot size, the smash (THE COOK: hold to heat the pot),
               their shove and gloat, the chop, your loss, the numbers
     fold win  a SHOW key for your cards

   Every option reads a data-sd-* attribute on <html> (set by apply());
   every row's first value is today's game, and with all of them at today
   the game plays exactly as it ships.

   Presentation only. It replaces handleShowdown() and
   runShowdownAwardSequence() with copies whose pot, award and settlement
   code is the production code verbatim (computePots, the share split,
   projectedSettlement, finishHand), and wraps advancePhase(),
   dealCommunity(), updateHandInstrument(), EnemyCards.paint() and
   startNewHand() for the runout and the clean-up. The money every player
   ends with is exactly what the shipped game pays; only the order and
   the look of handing it over change. Not loaded by the game.
   ============================================================ */
const ShowdownBeats = (function(){
  const DEF = { lock:'0', runout:'0', equity:'off', river:'0', order:'0', callout:'0', losers:'0',
    verdict:'0', kicker:'off', split:'0', pots:'0', award:'0', press:'always',
    tiers:'off', smash:'0', smashon:'monster', stamp:'0', cards:'0', opp:'0',
    cheat:'ember', ctime:'1000', csteps:'9', ccoins:'glow', crattle:'build', csparks:'embers', csound:'sizzle', cearly:'weaker', cfull:'hold',
    cforce:'big', cdir:'out', cceil:'bounce', cstop:'90', cjolt:'small', ccool:'flight', csettle:'450', cbank:'flip', cpace:'faster', cfinish:'clack', chop:'0', loss:'0', meters:'0', show:'off' };
  const root = () => document.documentElement;
  const opt = k => root().getAttribute('data-sd-' + k) || DEF[k];
  function apply(order){ Object.keys(DEF).forEach(k => root().setAttribute('data-sd-' + k, order && order[k] != null ? order[k] : DEF[k])); }

  const CW = () => window.CoinWorld;
  const coinsOn = () => typeof coinTableOn === 'function' && coinTableOn() && !!CW() && !!CW().zones.pot;
  const quiet = () => motionOff();
  // pacing beats follow the game speed (and QUICK RESOLVE); payoff beats don't
  const beat = ms => quiet() ? sleep(Math.min(ms, 90)) : pacedSleep(ms);
  const hold = ms => sleep(quiet() ? Math.min(ms, 120) : ms);
  const sfx = (k, v, p) => { try{ if (settings.sound) CW().sfx(k, v, p); }catch(e){} };
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const within = (p, ms) => Promise.race([p, sleep(ms)]);
  const byId = id => game.players.find(p => p.id === id);
  const BIG_BB = 10, MONSTER_BB = 30;
  const tierOf = amount => { const bb = amount / Math.max(1, game.bigBlind); return bb >= MONSTER_BB ? 'monster' : bb >= BIG_BB ? 'big' : 'small'; };

  /* ---------------- an overlay over the whole table ----------------
     Plates, stamps and the duel sit above the coin layers (which the coin
     table hosts in #table-screen at z 35/36). Placed in client coords. */
  function layer(){
    const ts = $('table-screen'); if (!ts) return null;
    let l = ts.querySelector(':scope > .sd-layer');
    if (!l){ l = document.createElement('div'); l.className = 'sd-layer'; l.setAttribute('aria-hidden', 'true'); ts.appendChild(l); }
    return l;
  }
  function place(el, x, y){
    const ts = $('table-screen').getBoundingClientRect();
    el.style.left = Math.round(x - ts.left) + 'px'; el.style.top = Math.round(y - ts.top) + 'px';
  }
  function put(cls, html, x, y){
    const l = layer(); if (!l) return null;
    const el = document.createElement('div'); el.className = cls; el.innerHTML = html;
    l.appendChild(el); place(el, x, y);
    return el;
  }

  // a panel exactly over the felt
  function overFelt(cls){
    const f = $('felt'), l = layer(); if (!f || !l) return null;
    const r = f.getBoundingClientRect(), el = document.createElement('div');
    el.className = cls; l.appendChild(el);
    place(el, r.left, r.top); el.style.width = Math.round(r.width) + 'px'; el.style.height = Math.round(r.height) + 'px';
    return el;
  }

  /* ---------------- hand names, short enough for a seat ---------------- */
  const RK = v => ({ 14:'A', 13:'K', 12:'Q', 11:'J', 10:'T' })[v] || String(v);
  const CAT = ['HIGH CARD','PAIR','TWO PAIR','TRIPS','STRAIGHT','FLUSH','FULL HOUSE','QUADS','STR FLUSH','ROYAL'];
  function short(res){
    const t = res.tiebreak, r = RK;
    switch(res.cat){
      case 1: return [CAT[1], r(t[0]) + r(t[0])];
      case 2: return [CAT[2], r(t[0]) + r(t[0]) + ' ' + r(t[1]) + r(t[1])];
      case 3: return [CAT[3], r(t[0]).repeat(3)];
      case 4: case 8: return [CAT[res.cat], 'TO ' + r(t[0])];
      case 5: return [CAT[5], r(t[0]) + ' HIGH'];
      case 6: return [CAT[6], r(t[0]).repeat(3) + ' ' + r(t[1]).repeat(2)];
      case 7: return [CAT[7], r(t[0]).repeat(4)];
      case 9: return [CAT[9], 'FLUSH'];
      default: return [CAT[0], r(t[0]) + ' HIGH'];
    }
  }
  function holeShort(hand){
    const [a, b] = hand.slice().sort((x, y) => y.value - x.value);
    if (a.value === b.value) return ['PAIR', RK(a.value) + RK(b.value)];
    return [RK(a.value) + ' ' + RK(b.value), a.suit === b.suit ? 'SUITED' : 'OFFSUIT'];
  }
  const readOf = (p, board) => board.length >= 3 ? short(evaluate7(p.hand.concat(board))) : holeShort(p.hand);

  /* ---------------- seat readouts ----------------
     An opponent's two-line CRT (Enemy Cards V2) says what they hold; yours
     is your hand screen. `state`: '' | 'lead' | 'beaten' | 'win'. */
  const said = new Map();
  function say(p, top, sub, state){
    said.set(p.id, { top, sub, state });
    if (p.isHuman){
      const dock = $('your-seat-dock');
      if (dock) dock.dataset.sdState = state || '';
      paintHuman();
      return;
    }
    const e = seatEls[p.id]; if (!e || !e._ec) return;
    const box = e.card.querySelector('.ec-read'); if (!box) return;
    const glass = box.firstChild;
    glass.querySelector('.ec-v').textContent = top;
    glass.querySelector('.ec-a').textContent = sub || '';
    glass.dataset.ink = state === 'beaten' ? 'danger' : (state === 'lead' || state === 'win') ? 'money' : 'live';
    box.dataset.act = 'sd';
    e._ec.read = '__sd';            // repaint the action on the next hand
    e.root.dataset.sdState = state || '';
  }
  function unsayAll(){
    said.clear();
    Object.values(seatEls || {}).forEach(e => { if (e && e.root) delete e.root.dataset.sdState; });
    const dock = $('your-seat-dock'); if (dock) delete dock.dataset.sdState;
  }
  // your hand screen: the hand, with the lead/beaten tag and the win chance
  let eqShown = null;
  function paintHuman(){
    const el = $('hand-strength'), g = game; if (!el || !g) return false;
    const me = g.players.find(p => p.isHuman);
    const s = said.get('you'), eq = eqShown && eqShown.hand === g.handNumber ? eqShown.map.get('you') : null;
    if (!s && eq == null) return false;
    if (!me || !me.hand || me.hand.length < 2) return false;
    let text = s ? s.top + (s.sub ? ' ' + s.sub : '') : describePlayerHand(me.hand, g.board.length >= 3 ? g.board : []).toUpperCase();
    let tag = '';
    if (s && s.state === 'lead') tag = '<span class="sd-tag is-lead">LEADS</span>';
    if (s && s.state === 'beaten') tag = '<span class="sd-tag is-beaten">BEATEN</span>';
    if (eq != null) tag += '<span class="sd-tag is-eq">' + eq + '%</span>';
    paintCRT(el, '<b>' + esc(text) + '</b>' + tag, false);
    return true;
  }

  /* ---------------- win chance ----------------
     Every hand still in is face up by now, so this is honest arithmetic:
     every way the rest of the board can fall (sampled before the flop). */
  function equities(g){
    const live = g.players.filter(p => p.inHand && !p.folded && !p.eliminated);
    const used = new Set(live.flatMap(p => p.hand).concat(g.board).map(cardKey));
    const deck = createDeck().filter(c => !used.has(cardKey(c)));
    const need = 5 - g.board.length, win = new Map(live.map(p => [p.id, 0]));
    let n = 0;
    const score = run => {
      const board = g.board.concat(run);
      let best = null, top = [];
      live.forEach(p => {
        const r = evaluate7(p.hand.concat(board));
        const c = best ? compareHands(r, best) : 1;
        if (c > 0){ best = r; top = [p]; } else if (c === 0) top.push(p);
      });
      top.forEach(p => win.set(p.id, win.get(p.id) + 1 / top.length)); n++;
    };
    if (need === 0) score([]);
    else if (need === 1) deck.forEach(c => score([c]));
    else if (need === 2){ for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) score([deck[i], deck[j]]); }
    else for (let k = 0; k < 900; k++) score(shuffle(deck).slice(0, need));
    const out = new Map();
    win.forEach((w, id) => out.set(id, Math.round(w / Math.max(1, n) * 100)));
    return out;
  }
  function paintMeter(g, map){
    const felt = $('felt'), plate = document.querySelector('#pot-area .pot-chip');
    let m = layer() && layer().querySelector('.sd-meter');
    if (!map){ if (m) m.remove(); return; }
    const live = g.players.filter(p => map.has(p.id));
    if (!m){
      m = document.createElement('div');
      m.className = 'sd-meter crt'; m.dataset.crtQuiet = ''; m.dataset.ink = 'live';
      m.innerHTML = '<div class="sd-meter-bar"></div><div class="sd-meter-keys"></div>';
      layer().appendChild(m);
    }
    const pr = (plate && plate.getBoundingClientRect().width ? plate : felt).getBoundingClientRect();
    place(m, pr.left + pr.width / 2, pr.bottom + 12);
    const col = p => p.isHuman ? 'var(--pc-lamp-amber)' : (typeof FACE_COLORS !== 'undefined' && FACE_COLORS[p.faceColorIdx] ? FACE_COLORS[p.faceColorIdx].fill : '#B69A7A');
    const bar = m.querySelector('.sd-meter-bar'), keys = m.querySelector('.sd-meter-keys');
    if (bar.children.length !== live.length){
      bar.innerHTML = live.map(p => '<i data-id="' + p.id + '" style="--c:' + col(p) + '"></i>').join('');
      keys.innerHTML = live.map(p => '<span data-id="' + p.id + '" style="--c:' + col(p) + '"><b>' + esc(p.isHuman ? 'YOU' : p.name).toUpperCase() + '</b> <em></em></span>').join('');
    }
    live.forEach(p => {
      const v = map.get(p.id);
      const seg = bar.querySelector('[data-id="' + p.id + '"]'); if (seg) seg.style.flexGrow = String(Math.max(.001, v));
      const k = keys.querySelector('[data-id="' + p.id + '"] em'); if (k) k.textContent = v + '%';
    });
  }
  function showEquity(g){
    const mode = opt('equity'); if (mode === 'off') return;
    const map = equities(g);
    eqShown = { hand:g.handNumber, map };
    if (mode === 'seats' || mode === 'both'){
      g.players.forEach(p => {
        if (!map.has(p.id) || p.isHuman) return;
        const s = said.get(p.id), read = s && s.top !== 'ALL IN' ? s : null;
        say(p, read ? read.top : (p.allIn ? 'ALL IN' : 'IN'), map.get(p.id) + '%', map.get(p.id) >= 50 ? 'lead' : '');
      });
      paintHuman();
    }
    if (mode === 'meter' || mode === 'both') paintMeter(g, map);
    return map;
  }

  /* ---------------- 1 · the lock ---------------- */
  async function lockBeat(g){
    const mode = opt('lock');
    if (mode === '0' || g._sdLock === g.handNumber) return;
    g._sdLock = g.handNumber;
    try{ if (Sound.wheelRelay) Sound.wheelRelay(.8); }catch(e){}
    sfx('thump', 1, .62);
    if (!quiet()){ const d = overFelt('sd-dipper'); if (d) setTimeout(() => d.remove(), 700); }
    setBanner('<span class="crt-line-primary">SHOWDOWN</span><span class="crt-line-secondary">THE CARDS WILL SPEAK</span>');
    if (mode === 'console') consoleFace('Showdown');
    await hold(620);
  }
  // the award face as a lit, locked SHOWDOWN face (or back to a live key)
  function consoleFace(label){
    const btn = $('btn-award-pot-console'), face = $('console-face-award');
    if (!btn) return;
    if (label){
      btn.disabled = true; btn.onclick = null;
      face.classList.add('sd-lit');
      showAwardConsole(label);
      Sound.consoleShift && Sound.consoleShift();
    } else {
      btn.disabled = false;
      face.classList.remove('sd-lit');
    }
  }

  /* ---------------- 2 · the all-in sweat ---------------- */
  const live = g => g.players.filter(p => p.inHand && !p.folded && !p.eliminated);
  const isRunout = g => ['preflop','flop','turn'].includes(g.phase) && live(g).length >= 2 && live(g).filter(p => !p.allIn).length <= 1;
  const inRunout = g => !!g && g._sdRunout === g.handNumber;
  async function runoutBegin(g){
    g._sdRunout = g.handNumber;
    if (coinsOn()) await CoinTable.sweep();
    g.players.forEach(p => { p.betThisRound = 0; });
    await lockBeat(g);
    setBanner('<span class="crt-line-primary">ALL IN</span><span class="crt-line-secondary">RUNNING IT OUT</span>');
    // one seat at a time, as a dealer would call for them
    for (const p of live(g).filter(p => !p.isHuman)){
      p._reveal = true; render();
      await beat(430);
      if (opt('runout') === 'called') say(p, ...readOf(p, g.board));
    }
    const me = live(g).find(p => p.isHuman);
    if (opt('runout') === 'called' && me) say(me, ...readOf(me, g.board));
    showEquity(g);
    await beat(500);
  }
  function runoutStreet(g){
    if (!inRunout(g)) return;
    if (opt('runout') === 'called') live(g).forEach(p => say(p, ...readOf(p, g.board)));
    showEquity(g);
    // the faces read the board like everyone else: whoever's behind sweats
    if (eqShown && opt('river') === 'sweat' && g.board.length === 4){
      live(g).forEach(p => { if (!p.isHuman){ const v = eqShown.map.get(p.id); setMood(p.id, v < 30 ? 'veryNervous1' : v < 50 ? 'nervous1' : 'smug1'); } });
    }
  }
  // the river: face down, a wait (a heartbeat), a peek, then over it goes
  async function squeezeRiver(g){
    const card = g.deck.pop();
    g.board.push(card);
    render();
    const el = $('board').lastElementChild;
    if (el) await dealCardFlight(el, card, { deferFlip:true, board:true });
    if (!el || quiet()){ if (el) await turnCard(el, false, card, false, 'board'); return; }
    const sweat = opt('river') === 'sweat';
    setBanner('<span class="crt-line-primary">THE RIVER</span><span class="crt-line-secondary">' + (sweat ? '…' : '') + '</span>');
    if (sweat){
      for (let i = 0; i < 3; i++){ sfx('thump', .9, .42); await hold(150); sfx('thump', .6, .38); await hold(430); }
    } else await hold(650);
    el.classList.add('sd-peek');
    await hold(520);
    el.classList.remove('sd-peek');
    await turnCard(el, false, card, false, 'showdown');
  }

  /* ---------------- 3 · the reveal ---------------- */
  function aggressorOf(g, contenders){
    const acts = (g.handActions || []).filter(a => ['bet','raise','allin'].includes(a.action));
    const last = acts.length ? acts[acts.length - 1] : null;
    if (last && contenders.some(p => p.id === last.id)) return byId(last.id);
    const n = g.players.length;
    for (let k = 1; k <= n; k++){ const p = g.players[(g.dealerIndex + k) % n]; if (contenders.includes(p)) return p; }
    return contenders[0];
  }
  function clockwiseFrom(g, first, list){
    const n = g.players.length, i0 = g.players.indexOf(first), out = [];
    for (let k = 0; k < n; k++){ const p = g.players[(i0 + k) % n]; if (list.includes(p)) out.push(p); }
    return out;
  }
  async function revealHands(g, contenders, aggressor){
    const mode = opt('order'), callout = opt('callout');
    const named = callout !== '0' || opt('runout') === 'called';
    const inShow = (callout === 'leader' || mode === 'casino') ? contenders : contenders.filter(p => !p.isHuman);
    let order = mode === 'casino' ? clockwiseFrom(g, aggressor, inShow)
      : inShow.slice().sort((a, b) => compareHands(a._handRes.result, b._handRes.result));
    setBanner('Revealing hands…');
    Sound.showdownBegin();
    render();
    await beat(220);
    if (mode === 'together'){
      for (let i = 0; i < 7; i++){ sfx('bounce', .5, 1 + i * .08); await hold(70); }
      order.forEach(p => { p._reveal = true; });
      render();
      await beat(700);
      if (named) order.forEach(p => say(p, ...short(p._handRes.result)));
      if (callout === 'leader') markLeader(order, order);
      await beat(500);
      return;
    }
    const shown = [];
    for (const p of order){
      const was = !!p._reveal || p.isHuman;
      p._reveal = true;
      render();
      if (p.isHuman && !quiet()){
        const cards = document.querySelector('#hud-mid .seat.you .seat-cards');
        if (cards){ cards.classList.remove('sd-lift'); void cards.offsetWidth; cards.classList.add('sd-lift'); }
      }
      shown.push(p);
      if (named) say(p, ...short(p._handRes.result));
      if (callout === 'leader') markLeader(shown, contenders);
      await beat(was ? 420 : 620);
    }
    await beat(420);
  }
  // the best hand so far LEADS; everything it has beaten says BEATEN
  function markLeader(shown){
    let best = null;
    shown.forEach(p => { if (!best || compareHands(p._handRes.result, best._handRes.result) > 0) best = p; });
    shown.forEach(p => {
      const s = short(p._handRes.result);
      const tie = compareHands(p._handRes.result, best._handRes.result) === 0;
      const before = said.get(p.id) && said.get(p.id).state;
      const state = tie ? 'lead' : 'beaten';
      say(p, s[0], state === 'beaten' ? 'BEATEN' : s[1], state);
      if (state === 'beaten' && before === 'lead'){
        sfx('knock', .9, .6);
        if (!p.isHuman) setMood(p.id, pick(['shocked1','displeased1','worried1']));
      }
    });
  }

  /* ---------------- 4 · the verdict ---------------- */
  function losersLit(contenders, pot){
    if (opt('losers') !== 'lit') return;
    contenders.forEach(p => {
      if (pot.winnerIds.includes(p.id)) return;
      const e = seatEls[p.id]; if (!e) return;
      e.root.classList.add('sd-loser');
      Array.from(e.cardsContainer.children).forEach(el => el.classList.remove('showdown-source-unused', 'dim-card'));
    });
  }
  function bestLoser(pot){
    let best = null;
    pot.eligible.forEach(id => {
      if (pot.winnerIds.includes(id)) return;
      const p = byId(id); if (!p || !p._handRes) return;
      if (!best || compareHands(p._handRes.result, best._handRes.result) > 0) best = p;
    });
    return best;
  }
  function laneRect(){
    const lane = $('showdown-inspection-lane');
    if (lane) return lane.getBoundingClientRect();
    const b = $('board'); return b ? b.getBoundingClientRect() : null;
  }
  function duelRow(pot){
    const loser = bestLoser(pot), r = laneRect();
    if (!loser || !r) return;
    const cards = arrangeHandForDisplay(loser._handRes.result.cat, loser._handRes.cards);
    const [cat] = short(loser._handRes.result);
    const html = '<div class="sd-duel-cards">' + cards.map(c => '<div class="' + cardClass(false, c, true) + ' sd-duel-card">' + cardInner(c) + '</div>').join('') + '</div>' +
      '<div class="sd-duel-cap">BEATS ' + esc(loser.isHuman ? 'YOUR' : loser.name.toUpperCase() + '\'S') + ' ' + cat + '</div>';
    // under the pot plate, in the open felt (the rail's stamp and the tray sit between)
    const plateEl = document.querySelector('#pot-area .pot-chip'), pr = plateEl && plateEl.getBoundingClientRect();
    const y = pr && pr.height ? pr.bottom + 8 : r.bottom + 60;
    const el = put('sd-duel', html, r.left + r.width / 2, y);
    if (el && !quiet()) el.animate([{ transform:'translate(-50%,-8px)', opacity:0 }, { transform:'translate(-50%,0)', opacity:1 }], { duration:260, easing:'steps(4,end)', fill:'backwards' });
  }
  function plate(cls, text, x, y, delay){
    const el = put('sd-plate ' + cls, text, x, y);
    if (el && !quiet()) el.animate([{ transform:'translate(-50%,-50%) scale(1.5) rotate(-6deg)', opacity:0 }, { transform:'translate(-50%,-50%) scale(.95) rotate(-3deg)', opacity:1, offset:.7 }, { transform:'translate(-50%,-50%) scale(1) rotate(-3deg)', opacity:1 }],
      { duration:300, delay:delay || 0, easing:'cubic-bezier(.2,.7,.3,1)', fill:'backwards' });
    return el;
  }
  async function verdict(pot, contenders){
    if (!pot.cards) return;
    const mode = opt('verdict');
    const r0 = laneRect();
    if (mode === 'stamp'){
      highlightWinningCards(pot, contenders);
      const b = $('board').getBoundingClientRect();
      plate('sd-hand', esc((splitHandText(pot.cat, pot.hand).category || pot.hand).toUpperCase()), b.left + b.width / 2, b.bottom + 4);
      sfx('thump', .8, 1.1);
      showShowdownRailResult(pot);
    } else {
      const ok = await presentShowdownRail(pot);
      if (ok) showShowdownRailResult(pot);
      if (mode === 'duel') duelRow(pot);
    }
    losersLit(contenders, pot);
    const r = laneRect() || r0;
    if (opt('split') === 'stamp' && pot.split && r){
      plate('sd-split', 'SPLIT<small>' + esc(pot.winners.join(' + ').toUpperCase()) + '</small>', r.left + r.width / 2, r.top + r.height / 2 - 4, 120);
      sfx('knock', 1, .9);
    }
    const loser = bestLoser(pot);
    if (opt('kicker') === 'plate' && loser && !pot.split && r && loser._handRes.result.cat === pot.cat){
      // beside the hand's nameplate (on the rail with it, or under the rail)
      const onRail = opt('stamp') === 'rail';
      plate('sd-kicker', 'KICKER', r.left + r.width / 2 + 74, onRail ? r.top - 20 : r.bottom + 8, 260);
      sfx('stack', .7, 1.5);
    }
  }
  function clearVerdict(){
    const l = layer(); if (!l) return;
    l.querySelectorAll('.sd-duel,.sd-plate').forEach(el => el.remove());
    ['board'].forEach(id => { const b = $(id); if (b) Array.from(b.children).forEach(el => el.classList.remove('win-card','dim-card','win-card-strong','win-card-hero')); });
  }

  /* ---------------- 5 · the pots ---------------- */
  // Coins for each display pot, taken off the tray by share of the money.
  function coinsFor(shown){
    const pot = CW().zones.pot, list = pot.list.slice().sort((a, c) => c.z - a.z);
    const total = shown.reduce((s, r) => s + r.amount, 0), out = [];
    let left = list.length;
    shown.forEach((r, i) => {
      const n = i === shown.length - 1 ? left : Math.min(left, Math.max(left > shown.length - i - 1 ? 1 : 0, Math.round(list.length * r.amount / Math.max(1, total))));
      out.push(list.splice(0, n)); left -= n;
    });
    return out;
  }
  // STACKS: the tray splits into a stack per pot, each with a plate where
  // the pot plate was (the pot plate's own finish: same job, same finish)
  async function stackPots(shown, groups){
    const W = CW(), T = W.tray(), pot = W.zones.pot; if (!T) return;
    const k = shown.length, felt = $('felt'), area = $('pot-area');
    const plateEl = area && area.querySelector('.pot-chip');
    const py = plateEl ? plateEl.getBoundingClientRect() : null;
    const items = [];
    // plates need ~76px each: spread wider than the tray when they must
    const span = Math.max(T.R - T.L, k * 76), x0 = (T.L + T.R) / 2 - span / 2;
    shown.forEach((r, i) => {
      const x = Math.max(T.L + 10, Math.min(T.R - 10, T.L + (T.R - T.L) * (i + .5) / k)), px = x0 + span * (i + .5) / k, y = pot.cy;
      const z = W.zone('sd:' + i, x, y, 7, 5, 14);
      groups[i].forEach(b => items.push({ b, to:{ x:x + rr(-4, 4), y:y + rr(-2, 2), z:0, zone:z, d:W.D() } }));
      const label = r.contested <= 1 ? 'BACK' : r.label === 'Pot' || /^Main/.test(r.label) ? 'MAIN' : r.label.replace(/^Side pot /i, 'SIDE ');
      if (py){
        const el = put('sd-potplate pot-chip', '<span class="pot-word">' + label + '</span><span class="v tabular">' + r.amount.toLocaleString() + '</span>', px, py.top + py.height / 2);
        if (el){ el.dataset.i = i; if (!quiet()) el.animate([{ transform:'translate(-50%,-50%) translateY(-6px)', opacity:0 }, { transform:'translate(-50%,-50%)', opacity:1 }], { duration:220, delay:i * 90, easing:'steps(3,end)', fill:'backwards' }); }
      }
    });
    if (felt) felt.classList.add('sd-stacked');
    sfx('collect', .8);
    groups.forEach(gp => gp.forEach(b => { if (b.zone) W.removeFromZone(b); }));
    await within(W.throwAll(items, 'hop'), 2400);
    await hold(260);
  }
  function potPlateOff(i){
    const el = layer() && layer().querySelector('.sd-potplate[data-i="' + i + '"]');
    if (!el) return;
    if (quiet()){ el.remove(); return; }
    el.animate([{ opacity:1 }, { opacity:0, transform:'translate(-50%,-50%) translateY(4px)' }], { duration:200, easing:'steps(3,end)', fill:'forwards' }).onfinish = () => el.remove();
  }

  /* ---------------- 6 · the payout ---------------- */
  // Hand `bodies` (coins anywhere on the felt) to CoinTable.payout, whose
  // throw, hatch and rack are the game's: it pays whatever is in the pot
  // zone's list, so the list holds just these coins for the call.
  function payWith(w, bodies, opts){
    if (!bodies.length || !coinsOn()) return Promise.resolve();
    CoinTable.layout();
    const W = CW(), pot = W.zones.pot;
    const others = pot.list.filter(b => !bodies.includes(b));
    bodies.forEach(b => { if (b.zone && b.zone !== pot) W.removeFromZone(b); b.zone = pot; });
    pot.list.length = 0; bodies.forEach(b => pot.list.push(b));
    const pr = CoinTable.payout(w, bodies.length, opts);
    others.forEach(b => pot.list.push(b));
    return pr;
  }
  // THE NUMBERS: your stack counts up coin by coin as they drop in
  const counters = new Set();
  let countBase = null, countT = 0;
  function countStart(){
    const me = game.players.find(p => p.isHuman);
    if (opt('meters') !== 'count' || !me) return;
    countBase = me.chips;
    humanBankDisplayFreeze = countBase;
  }
  function countOn(bodies, amount){
    if (countBase == null) return;
    const c = { bodies, amount }; counters.add(c);
    if (!bodies.length) c.done = true;
    if (!countT) countT = setInterval(countTick, 45);
    return c;
  }
  function countTick(){
    if (countBase == null){ clearInterval(countT); countT = 0; return; }
    let v = countBase;
    counters.forEach(c => { const n = c.bodies.length; const landed = c.done ? n : c.bodies.filter(b => !b.sh).length; v += n ? Math.round(c.amount * landed / n) : c.amount; });
    if (humanBankDisplayFreeze !== v){ humanBankDisplayFreeze = v; updateJackpot(v); }
  }
  function countEnd(){
    if (countBase == null) return;
    countTick();
    clearInterval(countT); countT = 0; counters.clear(); countBase = null;
    humanBankDisplayFreeze = null; render();
  }

  /* ---------------- THE SMASH ----------------
     Earned, and done by you: on a monster pot AWARD POT becomes HOLD TO
     COOK (see THE COOK below). */
  const smashFor = amount => {
    const tier = tierOf(amount), on = opt('smashon');
    return opt('smash') !== '0' && (on === 'every' || tier === 'monster' || (on === 'big' && tier === 'big'));
  };
  let firePower = null;       // how hard the last charge was let go (.25–1)

  async function payHuman(h, bodies, amount){
    const tier = tierOf(amount);
    const c = countOn(bodies, amount);
    try{
      if (smashFor(amount)) await smashPay(h, bodies, firePower == null ? .6 : firePower);
      else if (opt('tiers') === 'on') await payWith(h, bodies, { jackpot:tier !== 'small', fanfare:tier !== 'small' });
      else await payWith(h, bodies);
    } finally { if (c) c.done = true; }
  }

  // the table takes the hit (production's feltImpactBump() turns the felt
  // brown for a frame, so the bump is done here instead)
  function bump(k){
    const el = $('stage-bay'); if (!el || quiet()) return;
    const a = 2 + 3 * (k || .5);
    // translate only: a scale on the table turns the felt brown for a frame
    el.animate([{ transform:'none' }, { transform:'translateY(' + a + 'px)', offset:.2 }, { transform:'translateY(' + (-a / 3) + 'px)', offset:.46 }, { transform:'none' }], { duration:320, easing:'steps(6,end)' });
  }
  // a hit-stop: the whole coin world holds its breath for a few frames
  function hitStop(ms){
    const W = CW(); if (quiet()) return;
    const sp = W.OPT.speed; W.OPT.speed = .0001;
    setTimeout(() => { W.OPT.speed = sp; W.kick(); }, ms);
  }
  function impact(p){
    bump(p); CW().shake(); if (p > .55) setTimeout(() => CW().shake(), 90);
    if (typeof DashRim !== 'undefined') DashRim.win();
    sfx('thump', 1, .55 + .15 * p); sfx('knock', 1, .7); setTimeout(() => sfx('thump', .8, .45), 70);
  }
  // a coin let loose with a velocity (the physics does the rest)
  function loose(q, vx, vy, vz){
    Object.assign(q, { target:{}, opts:{}, bounces:0, maxB:2, e:.34, knocked:true, inFelt:true, edge:false,
      vx, vy, vz, fr:Math.PI * 2 * 3 / .5, phi:0, t:.1, T:0, d0:q.d, d1:q.d, moving:0,
      state:'air', axis:'toss', spinA:rr(0, 6), spinDir:Math.random() < .5 ? -1 : 1, spinRate:rr(3, 7) });
    CW().active.add(q); CW().kick();
  }
  const resting = bodies => bodies.every(b => b.state === 'rest' || !CW().active.has(b));
  async function settled(bodies, ms){ const end = performance.now() + ms; while (performance.now() < end && !resting(bodies)) await sleep(60); }
  // THE TOP FRAME: coins that reach the table's top rail hit it and are
  // thrown back down, hard and sideways, instead of leaving the screen
  function ceiling(bodies, p, onHit){
    const f = $('felt'); if (!f || quiet()) return () => {};
    const top = f.getBoundingClientRect().top + 6;
    let run = true, hits = 0, shookAt = 0;
    const tickFn = () => {
      if (!run) return;
      bodies.forEach(b => {
        if (b.state !== 'air' || b.vz <= 0) return;
        const coinTop = b.y - b.z - b.d * 1.2;
        if (coinTop > top) return;
        b.z = b.y - top - b.d * 1.2;
        b.vz = -Math.abs(b.vz) * rr(.45, .72);
        b.vx += rr(-1, 1) * (180 + 220 * p); b.vy += rr(10, 110);
        b.spinRate = (b.spinRate || 4) * 1.6; b.bounces = 0; b.maxB = 2;
        hits++;
        sfx('knock', 1, rr(.95, 1.35)); if (hits % 3 === 1) sfx('stack', .9, rr(1.2, 1.6));
        CW().glintAt(b.x, top + 4);
        const now = performance.now();
        if (now - shookAt > 160){ shookAt = now; CW().shake(); }
        if (onHit) onHit(b);
      });
      requestAnimationFrame(tickFn);
    };
    requestAnimationFrame(tickFn);
    return () => { run = false; };
  }

  /* ---------------- THE COOK (round 3) ----------------
     The one smash. Hold AWARD POT and the pot's recessed well heats up in
     steps, from ember red to hot, cooking the coins in it: they redden,
     rattle and throw off embers. Let go and they go BANG off the tray,
     spin, bounce off the cards and the table's top frame and cool back to
     gold; once they've settled they flip one by one into your bank. No
     machinery: the well glows and the coins do the rest. Every part is an
     option (data-sd-c*), chosen in the lab. */
  function trayEl(){ return document.querySelector('#felt .ct-tray'); }
  function trayCoins(){ const W = CW(); return Object.values(W.zones).filter(z => z.id === 'pot' || String(z.id).startsWith('sd:')).flatMap(z => z.list); }
  function rattle(k, scale){
    trayCoins().forEach(b => {
      if (b.state !== 'rest' || Math.random() > .25 + .5 * k) return;
      Object.assign(b, { target:{ zone:b.zone }, opts:{}, bounces:1, maxB:0, e:.2, knocked:true, inFelt:true, vx:rr(-12, 12) * k, vy:rr(-6, 6) * k,
        vz:(40 + 160 * k) * (scale || 1) * rr(.6, 1.1), fr:0, phi:0, t:.1, T:0, state:'air', moving:0 });
      CW().active.add(b);
    });
    CW().kick();
  }
  // the heat, as the well's colour at each step of the charge
  const HEAT = {
    ember:['#2A0A06','#5E1208','#921D0B','#C42F0E','#E24A12','#F46F18','#FF9A26','#FFC447','#FFE38A'],
    allin:['#2A0707','#4F0D0E','#761416','#9C1C1E','#C02627','#D9534A','#E8745F','#F29A82','#FFC2AE'],
    white:['#2A0A06','#6B1509','#A8260D','#DB4513','#F47C2B','#FFAA5C','#FFD097','#FFEBCF','#FFFFFF']
  };
  const heatColour = k => { const pal = HEAT[opt('cheat')] || HEAT.ember; return pal[Math.max(0, Math.min(pal.length - 1, Math.round(k * (pal.length - 1))))]; };
  let heatNow = 0;
  function heat(k){
    heatNow = k;
    const t = trayEl(); if (!t) return;
    let bed = t.querySelector('.sd-heatbed');
    if (!bed){ bed = document.createElement('i'); bed.className = 'sd-heatbed'; t.appendChild(bed); }
    const c = heatColour(k);
    t.style.setProperty('--hc', c); t.style.setProperty('--hk', k.toFixed(2));
    t.classList.toggle('sd-hot', k > 0);
    coinsHeat(k);
  }
  // the coins take the heat (their layer is tinted; nothing else is on it
  // at this moment)
  function coinsHeat(k){
    const air = CW().airLayer && CW().airLayer(); if (!air) return;
    const mode = opt('ccoins');
    if (mode === 'none' || k <= 0){ air.style.filter = ''; return; }
    air.style.transition = 'none';
    air.style.filter = 'sepia(' + (.8 * k).toFixed(2) + ') saturate(' + (1 + 2.6 * k).toFixed(2) + ') hue-rotate(' + (-28 * k).toFixed(0) + 'deg) brightness(' + (1 + .12 * k).toFixed(2) + ')' +
      (mode === 'glow' ? ' drop-shadow(0 0 ' + (1 + 4 * k).toFixed(1) + 'px ' + heatColour(k) + ')' : '');
  }
  function coolCoins(ms){
    const air = CW().airLayer && CW().airLayer(); if (!air) return;
    air.style.transition = ms && !quiet() ? 'filter ' + ms + 'ms steps(6,end)' : 'none';
    air.style.filter = '';
    setTimeout(() => { air.style.transition = ''; }, (ms || 0) + 60);
  }
  function ember(k){
    const T = CW().tray(); if (!T || quiet() || opt('csparks') !== 'embers') return;
    const n = k > .7 ? 2 : 1;
    for (let i = 0; i < n; i++){
      const e = put('sd-ember', '', rr(T.L + 10, T.R - 10), rr(T.T + 8, T.B - 4));
      if (!e) continue;
      e.style.setProperty('--hc', heatColour(Math.min(1, k + .2)));
      e.animate([{ transform:'translate(0,0)', opacity:1 }, { transform:'translate(' + rr(-8, 8).toFixed(0) + 'px,' + (-rr(26, 60)).toFixed(0) + 'px)', opacity:0 }],
        { duration:rr(500, 800), easing:'steps(6,end)' }).onfinish = () => e.remove();
    }
  }
  function sizzle(k, n, i){
    const s = opt('csound');
    if (s === 'quiet') return;
    // smooth steps are many: only every third one clicks
    if (n > 9 && i % 3) return;
    sfx('knock', .45 + .05 * k * 9, .8 + k * .8);
    if (s === 'sizzle') for (let j = 0; j < 2 + Math.round(3 * k); j++) setTimeout(() => sfx('bounce', .25 + .3 * k, rr(1.8, 2.8)), rr(0, 110));
  }

  // BANG: the well flashes and snaps cold; the coins fire off it
  async function bang(bodies, p){
    const W = CW(), T = W.tray();
    const t = trayEl(), bed = t && t.querySelector('.sd-heatbed');
    if (bed && !quiet()){ bed.classList.remove('sd-flash'); void bed.offsetWidth; bed.classList.add('sd-flash'); }
    heat(0);
    const air = W.airLayer && W.airLayer();
    // the coins keep their heat until the cooling option lets it go
    if (air && opt('ccoins') !== 'none') air.style.filter = 'sepia(.8) saturate(3.6) hue-rotate(-28deg) brightness(1.12)' + (opt('ccoins') === 'glow' ? ' drop-shadow(0 0 5px ' + heatColour(p) + ')' : '');
    const stop = +opt('cstop') || 0; if (stop) hitStop(stop);
    const jolt = opt('cjolt');
    if (jolt !== 'none'){ bump(jolt === 'big' ? 1 : .35); W.shake(); if (jolt === 'big') setTimeout(() => W.shake(), 90); }
    if (typeof DashRim !== 'undefined') DashRim.win();
    sfx('thump', 1, .5 + .15 * p); sfx('knock', 1, .7); setTimeout(() => sfx('thump', .8, .4), 60);
    for (let j = 0; j < 6; j++) setTimeout(() => sfx('stack', .9, rr(1, 1.6)), 20 + j * 25);
    const f = { medium:1, big:1.25, huge:1.6 }[opt('cforce')] || 1.25, dir = opt('cdir');
    const cx = T ? (T.L + T.R) / 2 : 0, cy = T ? (T.T + T.B) / 2 : 0, pw = .45 + .75 * p;
    bodies.forEach(b => { if (b.zone) W.removeFromZone(b); });   // off the tray's lip
    bodies.forEach(b => {
      let vx, vy, vz;
      if (dir === 'up'){ vx = rr(-70, 70) * f; vy = rr(-25, 25); vz = rr(720, 1000) * f * pw; }
      else if (dir === 'you'){ vx = rr(-130, 130) * f; vy = rr(190, 330) * f * pw; vz = rr(340, 520) * f * pw; }
      else {
        const dx = b.x - cx + rr(-4, 4), dy = b.y - cy + rr(-3, 3), L = Math.max(1, Math.hypot(dx, dy));
        vx = dx / L * rr(130, 280) * f * pw + rr(-40, 40); vy = dy / L * rr(50, 130) * f + rr(-30, 40); vz = rr(430, 650) * f * pw;
      }
      loose(b, vx, vy, vz);
    });
    const stopCeil = opt('cceil') === 'bounce' ? ceiling(bodies, p) : () => {};
    const cool = opt('ccool');
    if (cool === 'flight') coolCoins(650); else if (cool === 'instant') coolCoins(0);
    await settled(bodies, 3200);
    stopCeil();
    if (cool === 'land') coolCoins(300);
    const pause = +opt('csettle') || 0;
    if (pause) await hold(pause);
  }
  // INTO THE BANK: each coin flips up off the felt and arcs into your hatch
  function intoBank(items){
    const W = CW(), combo = { n:0 }, mode = opt('cbank'), faster = opt('cpace') === 'faster';
    const n = items.length;
    const order = items.slice().sort((a, c) => Math.hypot(a.b.x - a.to.x, a.b.y - a.to.y) - Math.hypot(c.b.x - c.to.x, c.b.y - c.to.y));
    const base = mode === 'all' ? 0 : mode === 'ripple' ? Math.max(18, Math.min(40, 700 / Math.max(1, n))) : Math.max(45, Math.min(110, 1500 / Math.max(1, n)));
    let at = 0;
    return Promise.all(order.map((it, i) => {
      const wait = mode === 'all' ? rr(0, 140) : at;
      at += base * (faster ? 1.5 - 1.1 * i / Math.max(1, n - 1) : 1);
      const flip = mode === 'flip';
      if (flip && !quiet()) setTimeout(() => sfx('bounce', .6, 1.4), wait / W.OPT.speed);
      return W.launch(it.b, it.to, { wait, T:flip ? rr(.5, .62) : rr(.36, .48), flips:flip ? 4 : 2, combo });
    }));
  }
  function finale(){
    const f = opt('cfinish'); if (f === 'none') return;
    sfx('thump', 1, .5);
    setTimeout(() => {
      if (f === 'run') sfx('win', 1);
      else try{ Sound.counterLock && Sound.counterLock(true); }catch(e){ sfx('stack', 1, .7); }
    }, 120);
  }
  function mouthOf(it){ return it.to && it.to.rim ? it.to.then : it.to; }

  async function smashPay(h, bodies, p){
    const W = CW(); if (!bodies.length) return;
    await bang(bodies, p);
    const orig = W.throwAll;
    // take over only the throw into your hatch; anyone else's throw passes
    W.throwAll = function(items, kind, extra){
      if (items.length && items.every(it => it.to && (it.to.mouth || it.to.rim))){
        W.throwAll = orig;
        return intoBank(items.map(it => ({ b:it.b, to:mouthOf(it) })));
      }
      return orig.apply(this, arguments);
    };
    try{ await payWith(h, bodies, { jackpot:true, fanfare:false }); }
    finally{ if (W.throwAll !== orig) W.throwAll = orig; coolCoins(0); }
    finale();
  }

  /* HOLD TO COOK: the AWARD POT key heats the well while held */
  function hum(on){ const f = $('hud-frame'); if (f) f.classList.toggle('sd-hum', !!on && !quiet()); }
  function chargeGate(label, press){
    consoleFace(null);
    const N = opt('csteps') === 'smooth' ? 24 : (+opt('csteps') || 9);
    const time = +opt('ctime') || 1000, every = time / N;
    const rat = opt('crattle');
    let armed = false;
    // the rail stays up to be read until you take hold of the key
    const arm = () => { if (armed) return; armed = true; clearShowdownRailPresentation(); clearVerdict(); };
    const step = (n) => {
      const k = n / N;
      heat(k);
      if (rat === 'build') rattle(k, 1); else if (rat === 'steady') rattle(.45, 1);
      if (n % Math.max(1, Math.round(N / 9)) === 0) ember(k);
      sizzle(k, N, n);
    };
    if (!press){
      // nobody to press it: it cooks itself, then fires
      arm();
      hideAwardConsole();
      return new Promise(res => { let n = 0; const iv = setInterval(() => { n++; step(n); if (n >= N){ clearInterval(iv); setTimeout(() => res(.8), 300); } }, every); });
    }
    return new Promise(resolve => {
      const btn = $('btn-award-pot-console');
      if (!btn){ resolve(.6); return; }
      let t0 = null, n = 0, timer = 0, keep = 0, over = 0, done = false, lastDown = 0;
      const mustFull = opt('cearly') === 'full';
      btn.classList.add('sd-charge'); btn.style.setProperty('--c', '0');
      showAwardConsole('Hold to cook · ' + label.replace(/^Award (Pot|Main|Side \d+) · /, ''));
      const tick = () => {
        if (n >= N) return;
        n++;
        btn.style.setProperty('--c', (n / N).toFixed(3));
        step(n);
        if (n === N){
          btn.classList.add('is-full'); sfx('stack', 1, 2.1);
          // full heat: it keeps cooking in your hand
          keep = setInterval(() => { if (rat !== 'none') rattle(1, 1.1); ember(1); sizzle(1, 9, 0); }, 170);
          if (opt('cfull') === 'overheat') over = setTimeout(() => finish(1), 1000);
        }
      };
      const stopTimers = () => { clearTimeout(timer); clearInterval(timer); clearInterval(keep); clearTimeout(over); };
      const finish = pw => {
        if (done) return; done = true;
        stopTimers(); hum(false); arm();
        window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        btn.removeEventListener('pointerdown', down);
        btn.onclick = null; btn.classList.remove('sd-charge', 'is-full'); btn.style.removeProperty('--c');
        try{ Sound.buttonRelease && Sound.buttonRelease('award'); }catch(e){}
        hideAwardConsole();
        resolve(pw);
      };
      // let go before it's red hot (MUST BE RED HOT): it cools off again
      const coolOff = () => {
        stopTimers(); hum(false);
        const from = n; t0 = null; n = 0;
        btn.style.setProperty('--c', '0'); btn.classList.remove('is-full');
        sfx('roll', .5, .7);
        for (let i = 1; i <= from; i++) setTimeout(() => heat(Math.max(0, (from - i) / N)), i * 35);
      };
      const down = () => {
        if (done || t0 != null) return;
        lastDown = performance.now();
        arm(); t0 = lastDown; hum(true);
        timer = setTimeout(() => { tick(); timer = setInterval(tick, every); }, 160);
      };
      const up = () => {
        if (t0 == null || done) return;
        if (n < N && mustFull){ coolOff(); return; }
        finish(Math.max(.2, n / N));
      };
      btn.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      // a click with no hold behind it (a keyboard): a medium bang
      btn.onclick = () => { if (t0 == null && performance.now() - lastDown > 1500) finish(.6); };
    });
  }

  // THEIR WIN: shoved across to their square, a beat, then home to the cup
  async function payOpp(p, bodies){
    const mode = opt('opp'), W = CW();
    const z = W.zones['spot:' + p.id];
    if (mode === '0' || !z || !bodies.length) return payWith(p, bodies);
    if (typeof EnemyCards !== 'undefined') EnemyCards.slot(p, 8000);
    sfx('collect', .9);
    const items = bodies.map(b => ({ b, to:{ x:z.cx + rr(-5, 5), y:z.cy + rr(-3, 3), z:0, zone:z, d:W.D() } }));
    bodies.forEach(b => { if (b.zone) W.removeFromZone(b); });
    await within(W.throwAll(items, 'shove'), 2600);
    if (mode === 'gloat') gloat(p);
    await hold(mode === 'gloat' ? 900 : 420);
    const src = (typeof EnemyCards !== 'undefined' && EnemyCards.coinSource(p)) || { x:z.cx, y:z.cy - 40, z:4 };
    const back = bodies.slice().sort((a, c) => c.z - a.z);
    back.forEach(b => { if (b.zone) W.removeFromZone(b); });
    await within(W.throwAll(back.map(b => ({ b, to:{ x:src.x + rr(-3, 3), y:src.y, z:src.z || 2, vanish:true, d:W.D() - 4 } })), 'lob'), 7000);
    if (typeof EnemyCards !== 'undefined') EnemyCards.slot(p, 380);
  }
  function gloat(p){
    const e = seatEls[p.id];
    if (e && e._ec) e._ec.win = performance.now() + 4200;
    try{ playReactionSequence(p.id, [{ mood:'gloating1', ms:700 }, { mood:pick(['smug1','cocky1']), ms:3200 }]); }catch(err){}
    const me = p.id, x0 = e ? e.root.getBoundingClientRect().left : 0;
    game.players.forEach(o => {
      if (o.id === me || o.isHuman || o.eliminated) return;
      const oe = seatEls[o.id]; if (!oe) return;
      setMood(o.id, pick(['suspicious1','displeased1','neutral3']));
      oe.root.dataset.sdGlance = oe.root.getBoundingClientRect().left < x0 ? 'r' : 'l';
      setTimeout(() => { delete oe.root.dataset.sdGlance; }, 1800);
    });
  }

  // CHOP: a blade of light through the pile, the halves slide apart
  async function chop(bodies, shares){
    const W = CW(), T = W.tray();
    const people = shares.map(s => ({ s, x:(seatEls[s.id] ? (s.id === 'you' ? W.zones.pot.cx : seatEls[s.id].root.getBoundingClientRect().left) : 0) }));
    const order = people.slice().sort((a, c) => a.x - c.x);
    const sorted = bodies.slice().sort((a, c) => a.x - c.x);
    const total = shares.reduce((s, x) => s + x.amount, 0);
    const groups = new Map(); let at = 0;
    order.forEach((o, i) => {
      const n = i === order.length - 1 ? sorted.length - at : Math.round(sorted.length * o.s.amount / Math.max(1, total));
      groups.set(o.s.id, sorted.slice(at, at + n)); at += n;
    });
    if (T){
      const cx = (T.L + T.R) / 2, cy = (T.T + T.B) / 2;
      const blade = put('sd-blade', '', cx, cy);
      if (blade){ blade.style.height = Math.round(T.B - T.T + 30) + 'px'; setTimeout(() => blade.remove(), 520); }
      sfx('knock', 1, 1.9); sfx('stack', .9, 1.6);
      await hold(200);
      const items = [];
      order.forEach((o, i) => {
        const dx = (i - (order.length - 1) / 2) * 30;
        groups.get(o.s.id).forEach(b => items.push({ b, to:{ x:Math.max(T.L + 8, Math.min(T.R - 8, b.x + dx)), y:b.y, z:0, zone:W.zones.pot, d:W.D() } }));
      });
      if (items.length) await within(W.throwAll(items, 'hop'), 1800);
      await hold(300);
    }
    return shares.map(s => groups.get(s.id) || []);
  }

  // YOUR LOSS: the dashboard dims with a low thunk
  function lossBeat(){
    if (opt('loss') !== 'dim') return;
    const dock = $('your-seat-dock'); if (!dock) return;
    dock.classList.add('sd-lost');
    sfx('thump', 1, .42); setTimeout(() => sfx('thump', .7, .36), 180);
  }

  // one display pot, handed to its winner(s)
  async function payPot(r, bodies){
    const shares = r.winnerShares.filter(s => s.amount > 0);
    const groups = shares.length > 1 && opt('chop') === 'chop' && bodies.length >= 2 ? await chop(bodies, shares) : splitCoins(bodies, shares);
    await Promise.all(shares.map((s, i) => {
      const w = byId(s.id); if (!w) return null;
      return w.isHuman ? payHuman(w, groups[i], s.amount) : payOpp(w, groups[i]);
    }));
  }
  function splitCoins(bodies, shares){
    const total = shares.reduce((s, x) => s + x.amount, 0), list = bodies.slice(), out = [];
    shares.forEach((s, i) => { const n = i === shares.length - 1 ? list.length : Math.round(bodies.length * s.amount / Math.max(1, total)); out.push(list.splice(0, n)); });
    return out;
  }

  /* ---------------- AWARD POT ---------------- */
  function pressWanted(shown, contenders){
    const mode = opt('press');
    if (mode === 'always') return true;
    if (mode === 'auto') return false;
    const total = shown.reduce((s, r) => s + r.amount, 0);
    return contenders.some(p => p.isHuman) || shown.some(r => r.winnerIds.includes('you')) || tierOf(total) !== 'small';
  }
  // `smash`: the style when this press pays you a smash (HOLD TO SMASH)
  async function awardGate(label, press, smash){
    firePower = null;
    if (smash){ firePower = await chargeGate(label, press); return; }
    consoleFace(null);
    if (press){ showAwardConsole(label); await waitForAwardPot(); }
    else { hideAwardConsole(); await hold(1500); }
  }
  const smashIn = pots => pots.some(r => r.winnerShares.some(s => s.id === 'you' && s.amount > 0 && smashFor(s.amount))) ? opt('smash') : null;

  /* ---------------- the award sequence ----------------
     The production sequence (06-presentation.js) with the beats above;
     the money settled is the same: every share added, the pot emptied,
     then finishHand(outcome). */
  async function awardSequence(potResults, contenders){
    const g = game;
    const winnerIds = new Set();
    potResults.forEach(pot => pot.winnerIds.forEach(id => winnerIds.add(id)));
    const main = potResults[0];
    const shown = mergePotResultsForDisplay(potResults);
    const totalAmount = potResults.reduce((s, r) => s + r.amount, 0);
    const foldWin = !(potResults.length !== 1 || potResults[0].hand !== null);
    const human = g.players.find(p => p.isHuman);
    const humanIn = contenders.some(p => p.isHuman);
    const humanWonContested = potResults.some(r => r.contested > 1 && r.winnerIds.includes('you'));
    const press = pressWanted(shown, contenders);

    // the pots on the felt: a stack each (when there's more than one)
    let groups = coinsOn() ? coinsFor(shown) : shown.map(() => []);
    if (coinsOn() && opt('pots') === 'stacks' && shown.length > 1) await stackPots(shown, groups);

    const felt = $('felt');
    const settle = r => {
      r.winnerShares.forEach(s => { const w = byId(s.id); if (w) w.chips += s.amount; });
      g.pot = Math.max(0, g.pot - r.amount);
    };
    countStart();

    if (opt('award') === 'each' && shown.length > 1){
      // the last side pot first, the main pot last
      for (let i = shown.length - 1; i >= 0; i--){
        const r = shown[i];
        if (r.contested <= 1){
          const w = byId(r.winnerIds[0]);
          setBanner('<span class="crt-line-primary">NOT CALLED</span><span class="crt-line-secondary">' + r.amount.toLocaleString() + ' BACK TO ' + esc((w ? (w.isHuman ? 'YOU' : w.name) : '').toUpperCase()) + '</span>');
          settle(r); render();
          await payPot(r, groups[i]); potPlateOff(i);
          await beat(260);
          continue;
        }
        await verdict(r, contenders);
        r.winnerIds.forEach(id => celebrateWinnerSeat(id));
        if (felt) felt.classList.add('showdown-winner-locked');
        if (i === 0 && humanIn && !humanWonContested) lossBeat();
        setBanner('<span class="crt-line-primary">' + esc(r.label === 'Pot' ? 'THE POT' : r.label.toUpperCase()) + '</span><span class="crt-line-secondary">' +
          esc(r.winners.join(' & ').toUpperCase()) + ' ' + showdownPotVerb(r).toUpperCase() + ' · ' + r.amount.toLocaleString() + '</span>');
        await hold(quiet() ? 0 : SHOWDOWN_RAIL_TIMING.readableHoldMs);
        showHudResultConsole([r]);
        await awardGate((i === 0 ? 'Award Main' : 'Award ' + r.label.replace(/^Side pot /i, 'Side ')) + ' · ' + r.amount.toLocaleString(), press, smashIn([r]));
        hideHudResultConsole();
        await clearShowdownRailPresentation(); clearVerdict();
        settle(r); render();
        await payPot(r, groups[i]); potPlateOff(i);
        await beat(300);
      }
    } else {
      if (main.cards) await verdict(main, contenders);
      winnerIds.forEach(id => celebrateWinnerSeat(id));
      if (felt) felt.classList.add('showdown-winner-locked');
      if (humanIn && !humanWonContested && !foldWin) lossBeat();
      if (main.cards) await hold(quiet() ? 0 : SHOWDOWN_RAIL_TIMING.readableHoldMs);
      showHudResultConsole(potResults);
      if (foldWin && opt('show') === 'key' && main.winnerIds[0] === 'you') offerShow();
      await awardGate('Award Pot · ' + totalAmount.toLocaleString(), press, smashIn(shown));
      closeShow();
      hideHudResultConsole();
      await clearShowdownRailPresentation(); clearVerdict();
      shown.forEach(settle);
      render();
      await Promise.all(shown.map((r, i) => payPot(r, groups[i]).then(() => potPlateOff(i))));
    }
    // anything left on the felt (a coin that missed its group) goes to the main winner
    if (coinsOn() && CW().zones.pot.list.length){
      const w = byId(main.winnerIds[0]); if (w) await payWith(w, CW().zones.pot.list.slice());
    }
    countEnd();
    if (felt) felt.classList.remove('sd-stacked');

    const outcome = !foldWin
      ? { type:'showdown', potResults, contenders, winnerIds }
      : { type:'foldwin', winner:g.players.find(p => p.id === potResults[0].winnerIds[0]), amount:potResults[0].amount };
    await finishHand(outcome);
  }

  /* ---------------- 7 · SHOW (a fold win) ---------------- */
  function offerShow(){
    const second = $('btn-result-secondary'), face = $('console-face-award');
    if (!second || !face) return;
    face.classList.add('has-secondary');
    second.classList.remove('hidden'); second.disabled = false;
    second.textContent = 'Show';
    second.onclick = () => { second.disabled = true; showCards(); };
  }
  function closeShow(){
    const second = $('btn-result-secondary'), face = $('console-face-award');
    if (face) face.classList.remove('has-secondary');
    if (second){ second.onclick = null; second.classList.add('hidden'); second.disabled = false; second.textContent = 'Main Menu'; }
  }
  function showCards(){
    const g = game, me = g.players.find(p => p.isHuman); if (!me) return;
    Sound.buttonRelease && Sound.buttonRelease('award');
    const cards = document.querySelector('#hud-mid .seat.you .seat-cards');
    if (cards) cards.classList.add('sd-shown');
    const res = g.board.length >= 3 ? evaluate7(me.hand.concat(g.board)) : null;
    const pair = me.hand[0].value === me.hand[1].value;
    const real = res ? (res.cat >= 2 || (res.cat === 1 && me.hand.some(c => c.value === res.tiebreak[0]) && res.tiebreak[0] >= 10))
                     : (pair || Math.min(me.hand[0].value, me.hand[1].value) >= 11);
    const txt = me.hand.map(c => RK(c.value) + c.suit).join(' ');
    setBanner('<span class="crt-line-primary">YOU SHOW ' + esc(txt) + '</span><span class="crt-line-secondary">' + (real ? 'THE REAL THING' : 'A BLUFF!') + '</span>');
    logMsg('You show ' + txt);
    Sound.cardFlip && Sound.cardFlip(false);
    g.players.forEach(p => {
      if (p.isHuman || p.eliminated || !p.folded) return;
      try{
        playReactionSequence(p.id, real
          ? [{ mood:pick(['relieved1','neutral2']), ms:500 }, { mood:'neutral1', ms:1600 }]
          : [{ mood:'shocked1', ms:420 }, { mood:pick(['angry1','displeased1','furious']), ms:2200 }]);
      }catch(err){}
    });
  }

  /* ---------------- handleShowdown (production copy + the beats) ---------------- */
  async function handleShowdownSD(){
    const g = game;
    endQuickResolve();
    if (coinTableOn()) await CoinTable.sweep();
    const contenders = g.players.filter(p => p.inHand && !p.folded && !p.eliminated);
    const pots = computePots(g.players);
    const aggressor = aggressorOf(g, contenders);
    g.players.forEach(p => {
      if (p.streetAction && !['fold','allin','ko','eliminated'].includes(p.streetAction.type)) p.streetAction = null;
    });
    contenders.forEach(p => { p._handRes = evaluate7WithCards([...p.hand, ...g.board]); });
    paintMeter(g, null);
    eqShown = null;

    if (contenders.length > 1){
      await lockBeat(g);
      await revealHands(g, contenders, aggressor);
    }

    const potResults = [];
    const winnerIds = new Set();
    const potGroup = [];
    let potGroups = 0, prevEligibleKey = null;
    pots.forEach((pot, i) => {
      if (!pot.eligible.length) return;
      const key = pot.eligible.slice().sort().join(',');
      if (key !== prevEligibleKey) potGroups++;
      prevEligibleKey = key;
      potGroup[i] = potGroups - 1;
    });
    pots.forEach((pot, i) => {
      const eligible = pot.eligible.map(id => g.players.find(p => p.id === id));
      if (!eligible.length) return;
      let best = null, winners = [];
      for (const p of eligible){
        const res = p._handRes || evaluate7WithCards([...p.hand, ...g.board]);
        p._handRes = res;
        if (!best || compareHands(res.result, best.result) > 0){ best = res; winners = [p]; }
        else if (compareHands(res.result, best.result) === 0) winners.push(p);
      }
      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount - share * winners.length;
      const winnerShares = winners.map((w, k) => {
        const amt = share + (k < remainder ? 1 : 0);
        w._award = (w._award || 0) + amt;
        winnerIds.add(w.id);
        return { name:w.name, id:w.id, amount:amt };
      });
      potResults.push({
        label: potGroups === 1 ? 'Pot' : (potGroup[i] === 0 ? 'Main pot' : 'Side pot ' + potGroup[i]),
        group: potGroup[i],
        amount: pot.amount,
        winners: winners.map(w => w.name),
        winnerIds: winners.map(w => w.id),
        eligible: pot.eligible,
        winnerShares,
        hand: describeMade(best.result),
        cat: best.result.cat,
        cards: best.cards,
        contested: eligible.length,
        contributors: pot.contributors,
        split: winners.length > 1
      });
    });

    const mainResult = potResults[0];
    const winnerNames = mainResult.winners.join(' & ');
    const winVerb = showdownPotVerb(mainResult);
    setBanner('<b>' + esc(winnerNames) + '</b> ' + winVerb + ' the pot.');
    if (opt('callout') === 'leader' || opt('runout') === 'called' || opt('callout') === 'name'){
      contenders.forEach(p => { if (winnerIds.has(p.id)) say(p, ...short(p._handRes.result).slice(0, 1), 'WINS', 'win'); });
    }

    const bbv = g.bigBlind;
    contenders.forEach(p => {
      if (p.isHuman) return;
      const won = winnerIds.has(p.id);
      const swing = p._award || 0;
      const lost = p.totalBetHand || 0;
      const strong = p._handRes && p._handRes.result.cat >= 2;
      const stung = lost > 10 * bbv || lost > (p.chips + lost) * 0.3;
      if (won){
        if (swing > 12 * bbv) nudgeMood(p, 'up', Math.min(1, swing / (30 * bbv) + 0.4));
      } else if (stung){
        nudgeMood(p, strong ? 'steamed' : 'down', strong ? 0.8 : 0.6);
      }
      const settle = projectedSettlement(p, potResults);
      if (settle.wonContested){
        reactToWin(p, settle.contestedAward / bbv);
      } else {
        reactToLoss(p, lost / bbv, stung, {
          busted: settle.busted,
          allInLoss: settle.uncalledReturn > 0 || (p.chips <= 0 && !settle.resolvable)
        });
      }
      maybeTableTalk(p, won ? 'win' : 'lose');
    });

    mergePotResultsForDisplay(potResults).forEach(r => {
      const name = r.label === 'Pot' ? 'the pot' : /^Main/.test(r.label) ? 'the main pot' : r.label.toLowerCase();
      if (r.split){
        logMsg(r.winnerShares.map(s => s.name + ' ' + s.amount.toLocaleString()).join(' / ') + ' split ' + name + ' (' + r.amount.toLocaleString() + ') with ' + r.hand);
      } else {
        logMsg(r.winners.join(' & ') + ' ' + showdownPotVerb(r) + ' ' + name + ' (' + r.amount.toLocaleString() + ') with ' + r.hand);
      }
    });
    if (winnerIds.has('you')){
      Sound.resultSting('humanWin');
      haptic(30);
    } else if (contenders.length > 1){
      const humanLost = contenders.some(p => p.isHuman);
      Sound.resultSting(humanLost ? 'humanLose' : 'opponentWin');
    }

    await runShowdownAwardSequence(potResults, contenders);
  }

  /* ---------------- clean-up between hands ---------------- */
  function cleanup(){
    unsayAll();
    eqShown = null;
    const l = layer(); if (l) l.innerHTML = '';
    const felt = $('felt'); if (felt) felt.classList.remove('sd-stacked');
    hum(false);
    const t = trayEl(); if (t){ t.style.transform = ''; t.classList.remove('sd-hot'); const bed = t.querySelector('.sd-heatbed'); if (bed) bed.remove(); }
    try{ coolCoins(0); }catch(e){}
    const dock = $('your-seat-dock'); if (dock) dock.classList.remove('sd-lost');
    document.querySelectorAll('.sd-loser').forEach(el => el.classList.remove('sd-loser'));
    document.querySelectorAll('.sd-shown,.sd-lift').forEach(el => el.classList.remove('sd-shown', 'sd-lift'));
    const face = $('console-face-award'); if (face) face.classList.remove('sd-lit');
    const btn = $('btn-award-pot-console'); if (btn) btn.disabled = false;
    if (CW()) Object.keys(CW().zones).forEach(k => { if (k.startsWith('sd:')) delete CW().zones[k]; });
    if (countBase != null) countEnd();
  }

  // A new hand clears the beats' leftovers. Keyed off the hand number, not
  // only startNewHand(): another wrapper (the table intro's uninstall) can
  // put the original startNewHand back over this one.
  let cleanHand = null;
  function fresh(){
    const g = typeof game !== 'undefined' ? game : null;
    const key = g ? g.handNumber + ':' + (g.players ? g.players.length : 0) : null;
    if (key !== cleanHand){ cleanHand = key; cleanup(); }
  }

  /* ---------------- PLAYER SETTINGS ----------------
     Three of the beats are the player's to pick, in Settings → Showdown:
     the smash, the win chance meter and when AWARD POT waits. Built from
     the sheet's own parts (segmented keys, a switch); in the lab they set
     the same data-sd-* options the order form does. */
  function settingsSection(){
    const sheet = $('settings-sheet'); if (!sheet || $('sd-settings')) return;
    const first = sheet.querySelector('.sheet-section'); if (!first) return;
    const seg = (id, key, label, opts, hint) => '<div class="field"><div class="field-label">' + label + '</div>' +
      '<div class="segmented compact wrap" id="' + id + '" role="group" aria-label="' + label + '">' +
      opts.map(o => '<button type="button" data-sd-set="' + key + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
      '</div><div class="hint">' + hint + '</div></div>';
    const sec = document.createElement('div');
    sec.className = 'sheet-section'; sec.id = 'sd-settings';
    sec.innerHTML = '<h3>Showdown</h3>' +
      '<div class="toggle-row"><div><div class="tl">Win chance</div><div class="ts">When everyone is all in, a meter under the pot shows each hand\'s chance to win.</div></div>' +
      '<button class="switch" id="sd-sw-equity" role="switch" aria-checked="false" aria-label="Win chance"></button></div>' +
      seg('sd-press-seg', 'press', 'Award pot', [['always','Every hand'],['mine','Mine + big'],['auto','Never']],
        'When the machine waits for your AWARD POT press before paying out.');
    first.after(sec);
    const sync = () => {
      sec.querySelectorAll('[data-sd-set]').forEach(b => b.classList.toggle('active', opt(b.dataset.sdSet) === b.dataset.v));
      $('sd-sw-equity').setAttribute('aria-checked', opt('equity') !== 'off' ? 'true' : 'false');
    };
    sec.addEventListener('click', e => {
      const b = e.target.closest('[data-sd-set]');
      if (b){ root().setAttribute('data-sd-' + b.dataset.sdSet, b.dataset.v); sync(); try{ Sound.buttonRelease && Sound.buttonRelease('small'); }catch(err){} return; }
      if (e.target.closest('#sd-sw-equity')){ root().setAttribute('data-sd-equity', opt('equity') !== 'off' ? 'off' : 'meter'); sync(); }
    });
    sync();
    new MutationObserver(sync).observe(root(), { attributes:true, attributeFilter:['data-sd-press','data-sd-equity'] });
  }

  /* ---------------- install ---------------- */
  const orig = {};
  function install(){
    if (orig.installed) return;
    orig.installed = true;
    orig.handleShowdown = handleShowdown;
    orig.award = runShowdownAwardSequence;
    orig.advancePhase = advancePhase;
    orig.dealCommunity = dealCommunity;
    orig.updateHandInstrument = updateHandInstrument;
    orig.startNewHand = startNewHand;
    const today = () => Object.keys(DEF).every(k => opt(k) === DEF[k]);

    handleShowdown = function(){ return today() ? orig.handleShowdown.apply(this, arguments) : handleShowdownSD(); };
    runShowdownAwardSequence = function(potResults, contenders){
      return today() || !coinsOn() ? orig.award.apply(this, arguments) : awardSequence(potResults, contenders);
    };
    advancePhase = async function(){
      const g = game;
      const want = opt('runout') !== '0' || opt('equity') !== 'off';
      if (want && g && !inRunout(g) && isRunout(g)) await runoutBegin(g);
      const r = await orig.advancePhase.apply(this, arguments);
      if (game === g && inRunout(g) && ['flop','turn','river'].includes(g.phase)) runoutStreet(g);
      return r;
    };
    dealCommunity = async function(n){
      const g = game;
      if (inRunout(g) && n === 1 && opt('river') !== '0'){
        if (g.board.length === 4) return squeezeRiver(g);
        if (g.board.length === 3 && opt('river') === 'sweat') await hold(520);
      }
      return orig.dealCommunity.apply(this, arguments);
    };
    updateHandInstrument = function(){
      fresh();
      if (game && paintHuman()) return;
      return orig.updateHandInstrument.apply(this, arguments);
    };
    startNewHand = function(){
      cleanup();
      return orig.startNewHand.apply(this, arguments);
    };
    // their cards stay out through a runout (the shipped card keeps them
    // tucked until the showdown)
    if (typeof EnemyCards !== 'undefined'){
      const paint = EnemyCards.paint;
      EnemyCards.paint = function(){
        fresh();
        paint.apply(this, arguments);
        const g = game;
        if (inRunout(g)) g.players.forEach(p => { const e = seatEls[p.id]; if (e && e._ec && p._reveal) e.root.classList.add('ec-shown'); });
      };
    }
  }
  install();
  settingsSection();
  return { apply, install, opt, DEF };
})();
// the lab reaches the candidate through the frame's window
window.ShowdownBeats = ShowdownBeats;
