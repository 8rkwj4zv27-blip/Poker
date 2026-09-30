"use strict";

/* ============================================================
   COACH BRAIN (P.I.P.), step 1: WATCHING  (docs/coach/BRAIN_PLAN.md)

   A record of every decision the player makes and how each hand ends,
   for the judges (steps 2-3) to mark and the lines to talk about. It says
   nothing yet and draws nothing.

   Only what the player can see: their own two cards, the board, stacks,
   bets, the pot, the table's public actions and notebook of habits, and
   an opponent's cards only once they've been shown at a showdown
   (shownAtShowdown, the one place an opponent's hand is read). It never
   reads the deck and never writes to the game.

   Pure functions over a game state, so validation/coach-brain-checks.js
   runs them in Node. coach-talk.js feeds it:
     CoachBrain.handStart(g, startStacks)   a new hand is dealt
     CoachBrain.spot(g, me)                 the decision, BEFORE it's applied
     CoachBrain.record(spot, g, me)         what you chose, AFTER it's applied
     CoachBrain.observe(g, me)              every beat, so a hand that ends
                                            between looks is still closed
     CoachBrain.handEnd(g, me, net)         the pot's been paid
     CoachBrain.closeMissed(net)            a new deal came first
   and it tells whoever's listening: 'coachdecision', 'coachhand'.
   ============================================================ */
const CoachBrain = (() => {
  const HISTORY = 50;
  // the game's own maths (js/01-poker-math.js), when it's loaded
  const call = (name, ...a) => { try{ return typeof globalThis[name] === 'function' ? globalThis[name](...a) : null; }catch(e){ return null; } };
  const r1 = x => Math.round(x * 10) / 10;
  const card = c => c ? { rank:c.rank, suit:c.suit, value:c.value } : null;

  /* ---------------- where you sit ----------------
     Named the way coaches name seats, counted back from the button among
     the players dealt in: BTN, CO (cutoff), HJ (hijack), LJ (lojack),
     and from four seats before the blinds up, the first to act is UTG
     (then UTG+1 ...). Heads-up the button is also the small blind. */
  function seatOrder(g){   // from the first to act preflop round to the big blind
    const n = g.players.length, out = [];
    let i = g.bbIndex;
    for (let c = 0; c < n; c++){ i = (i + 1) % n; if (g.players[i].inHand) out.push(i); }
    return out;
  }
  function seatLabel(g, idx){
    const dealt = g.players.filter(p => p.inHand).length;
    if (dealt < 2 || g.dealerIndex < 0) return null;
    if (dealt === 2) return idx === g.dealerIndex ? 'BTN' : 'BB';
    if (idx === g.sbIndex) return 'SB';
    if (idx === g.bbIndex) return 'BB';
    const order = seatOrder(g).filter(i => i !== g.sbIndex && i !== g.bbIndex);
    const k = order.indexOf(idx), m = order.length;
    if (k < 0) return null;
    const fromBtn = m - 1 - k;
    if (k === 0 && m >= 4) return 'UTG';
    return ['BTN', 'CO', 'HJ', 'LJ'][fromBtn] || 'UTG+' + k;
  }
  const SEAT_GROUP = { UTG:'early', 'UTG+1':'early', 'UTG+2':'early', LJ:'middle', HJ:'middle', CO:'late', BTN:'late', SB:'blinds', BB:'blinds' };

  /* players still to act after you on this street, in betting order
     (live, not folded, not all in) */
  function actingAfter(g, idx){
    const n = g.players.length;
    const preflop = g.phase === 'preflop';
    const start = preflop ? (g.players.filter(p => p.inHand).length === 2 ? g.dealerIndex : (g.bbIndex + 1) % n)
                          : (g.dealerIndex + 1) % n;
    const rank = i => (i - start + n) % n;
    const mine = rank(idx);
    return g.players.filter((p, i) => i !== idx && p.inHand && !p.folded && !p.allIn && rank(i) > mine).length;
  }

  /* ---------------- what's happened before you ---------------- */
  function actionsThisHand(g){
    return (g.handActions || []).map(a => ({ id:a.id, name:a.name, street:a.street, action:a.action, amount:a.amount }));
  }
  function preflopSituation(g, me, acts){
    const pre = acts.filter(a => a.street === 'preflop' && a.id !== me.id);
    const raises = typeof g.pfRaises === 'number' ? g.pfRaises : pre.filter(a => a.action === 'raise' || a.action === 'bet').length;
    const firstRaise = acts.findIndex(a => a.street === 'preflop' && (a.action === 'raise' || a.action === 'bet'));
    const limpers = acts.filter((a, i) => a.street === 'preflop' && a.action === 'call' && (firstRaise < 0 || i < firstRaise) && a.id !== me.id).length;
    const callers = firstRaise < 0 ? 0 : acts.filter((a, i) => a.street === 'preflop' && a.action === 'call' && i > firstRaise && a.id !== me.id).length;
    let kind = 'unopened';
    if (raises >= 2) kind = 'reraised';
    else if (raises === 1) kind = 'raised';
    else if (limpers > 0) kind = 'limped';
    return { kind, raises, limpers, callers };
  }
  function streetSituation(g, me, acts, toCall){
    const here = acts.filter(a => a.street === g.phase && a.id !== me.id);
    const raises = g.streetRaises || 0;
    if (toCall > 0) return { kind: raises >= 2 ? 'facing-raise' : 'facing-bet', raises, checks:here.filter(a => a.action === 'check').length };
    const checks = here.filter(a => a.action === 'check').length;
    return { kind: checks ? 'checked-to' : 'first', raises, checks };
  }

  /* ---------------- your cards ---------------- */
  function holeFacts(hole){
    const pct = call('preflopPercentile', hole);
    return {
      name: call('describeHole', hole) || '',
      pct: typeof pct === 'number' ? pct : null,       // 0 = the best starting hand, 1 = the worst
      pair: hole[0].value === hole[1].value,
      suited: hole[0].suit === hole[1].suit,
      gap: Math.abs(hole[0].value - hole[1].value)
    };
  }
  function boardFacts(hole, board){
    if (board.length < 3) return null;
    const cls = call('classifyPostflop', hole, board);
    const draws = call('detectDraws', hole, board) || [];
    const outs = call('computeOuts', hole, board);
    return {
      handName: call('describePlayerHand', hole, board) || '',
      made: cls ? cls.made : null,
      kicker: cls ? cls.kicker : -1,
      boardPlays: cls ? !!cls.boardPlays : false,
      draws: cls ? Object.assign({}, cls.draws) : {},
      drawList: draws.map(d => ({ kind:d.kind, outs:d.outs })),
      drawOuts: draws.filter(d => d.kind !== 'overcards').reduce((m, d) => Math.max(m, d.outs), 0),
      outs: outs ? outs.outs : 0,
      texture: cls ? Object.assign({}, cls.texture) : null,
      threats: call('boardThreats', board) || []
    };
  }

  /* ---------------- the table's notebook (public habits) ---------------- */
  function readOf(g, id){
    const r = g.reads && g.reads[id];
    if (!r) return null;
    return { hands:r.hands || 0, vpip:r.vpip || 0, pfr:r.pfr || 0, postAgg:r.postAgg || 0, postPassive:r.postPassive || 0,
      facedBet:r.facedBet || 0, foldedToBet:r.foldedToBet || 0, cbetOpp:r.cbetOpp || 0, cbet:r.cbet || 0,
      riverBetsShown:r.riverBetsShown || 0, bluffsShown:r.bluffsShown || 0 };
  }

  /* ---------------- the decision in front of you ----------------
     Read BEFORE your action is applied, so the price is the one you faced. */
  function spot(g, me){
    if (!g || !me || !g.players || !me.hand || me.hand.length < 2) return null;
    const idx = g.players.indexOf(me);
    const bb = Math.max(1, g.bigBlind || 1);
    const toCallRaw = Math.max(0, (g.currentBet || 0) - (me.betThisRound || 0));
    const toCall = Math.min(toCallRaw, me.chips);
    const pot = g.pot || 0;
    const live = g.players.filter(p => p.inHand && !p.folded);
    const opps = live.filter(p => p !== me);
    const myTotal = me.chips + (me.betThisRound || 0);
    const biggestOpp = opps.reduce((m, p) => Math.max(m, p.chips + (p.betThisRound || 0)), 0);
    const effective = Math.min(myTotal, biggestOpp);
    const acts = actionsThisHand(g);
    const seat = seatLabel(g, idx);
    const preflop = g.phase === 'preflop';
    const pf = preflopSituation(g, me, acts);
    const pfAgg = g.pfAggressorId ? g.players.find(p => p.id === g.pfAggressorId) : null;
    const board = (g.board || []).map(card);
    const hole = me.hand.map(card);
    return {
      handNumber: g.handNumber,
      street: g.phase,
      mode: g.mode || null,
      hole, board,
      holeFacts: holeFacts(hole),
      boardFacts: boardFacts(hole, board),
      seat, seatGroup: SEAT_GROUP[seat] || null,
      actingAfter: actingAfter(g, idx),
      playersDealt: g.players.filter(p => p.inHand).length,
      playersIn: live.length,
      bigBlind: bb,
      stack: me.chips,
      yourBet: me.betThisRound || 0,
      stackBB: r1(me.chips / bb),
      effectiveBB: r1(effective / bb),
      // when the stack that makes this hand short is theirs, not yours
      // (you cover them): who, so he says "Lucy only has 7 big blinds"
      // rather than "you're short" to a player with 140
      shortBy: biggestOpp < myTotal && opps.length ? (opps.length === 1 ? opps[0].name : (opps.find(p => p.chips + (p.betThisRound || 0) === biggestOpp) || opps[0]).name) : null,
      shortByOne: opps.length === 1,
      pot, potBB: r1(pot / bb),
      toCall, toCallBB: r1(toCall / bb),
      potOdds: toCall > 0 ? toCall / (pot + toCall) : 0,
      spr: pot > 0 ? r1(Math.max(0, effective - (me.betThisRound || 0)) / pot) : null,
      currentBet: g.currentBet || 0,
      minRaise: g.minRaise || bb,
      mayRaise: me.mayRaise !== false && me.chips > toCall,
      preflop: pf,
      situation: preflop ? pf.kind : streetSituation(g, me, acts, toCall).kind,
      streetRaises: g.streetRaises || 0,
      pfAggressor: pfAgg ? { id:pfAgg.id, name:pfAgg.name, you:pfAgg === me } : null,
      youArePfAggressor: !!pfAgg && pfAgg === me,
      actions: acts,
      // this hand's public actions after the flop, in the range-narrowing
      // form (js/01-poker-math.js narrowWeight): n = board size, a = b/r/c/k
      handLog: (g.handLog || []).map(h => ({ id:h.id, n:h.n, a:h.a })),
      opponents: opps.map(p => ({ id:p.id, name:p.name, chips:p.chips, stackBB:r1(p.chips / bb), bet:p.betThisRound || 0,
        allIn:!!p.allIn, seat:seatLabel(g, g.players.indexOf(p)), read:readOf(g, p.id) }))
    };
  }

  /* ---------------- what you chose ----------------
     Read AFTER the action's been applied, from the table's own record of it. */
  function choice(sp, g, me){
    if (!sp) return null;
    const mine = (g.handActions || []).filter(a => a.id === me.id);
    const last = mine[mine.length - 1];
    let action = last ? last.action : null;
    if (me.allIn && action !== 'fold') action = 'allin';
    const total = me.betThisRound || 0;             // your bet on this street, after
    const added = Math.max(0, total - sp.yourBet);
    return {
      action,
      amount: total,
      added,
      addedBB: r1(added / sp.bigBlind),
      toBB: r1(total / sp.bigBlind),
      // a bet or raise against the pot before it (0.5 = half the pot)
      potFraction: sp.pot > 0 && added > 0 ? Math.round(added / sp.pot * 100) / 100 : null
    };
  }

  /* ============================================================
     JUDGE 1: BEFORE THE FLOP  (docs/coach/BRAIN_PLAN.md, step 2)

     Marks a preflop decision the way a coach teaching tight-aggressive
     basics would: which hands to play from which seat, raise or fold (not
     limp), don't call raises with weak hands, shove or fold when short.

     The yardstick is the game's own sound-player ranges (js/03-opponents.js:
     OPEN_RANGE_BY_BEHIND, PUSH_RANGE_BY_BEHIND, RERAISE_RANGE, copied here
     so the brain stands on its own), measured in the game's starting-hand
     ranking (preflopPercentile: 0 = aces). Facing a raise, it's your
     chance of winning against the hands that raise usually means (the
     raiser's seat, the size, and their habits from the table's public
     notebook) against the price, as a thinking player would realise it.

     A judgement: { kind, best, verdict: good | fine | mistake,
       confidence: clear | leans | close, tag (its lines), lesson, notable,
       n: the numbers the lines quote }.
     Confidence is honest: CLEAR only well outside the range; the edges are
     LEANS, and the edge itself is CLOSE (said as close).
     ============================================================ */
  const OPEN_BY_BEHIND = [0.45, 0.42, 0.44, 0.28, 0.21, 0.17, 0.14, 0.12, 0.11, 0.10];
  const OPEN_HEADS_UP = 0.80;
  const PUSH_BY_BEHIND = [0.55, 0.45, 0.32, 0.20, 0.15, 0.12, 0.10, 0.09, 0.08, 0.08];
  const PUSH_HEADS_UP = 0.62;
  const PUSH_FOLD_BB = 10;
  const RERAISE = [null, null, 0.07, 0.03, 0.018];
  // a raiser's opening range by where they sat (the same table, read by seat)
  const OPEN_BY_SEAT = { UTG:0.14, 'UTG+1':0.14, 'UTG+2':0.15, LJ:0.17, HJ:0.21, CO:0.28, BTN:0.44, SB:0.42, BB:0.15 };
  const pct100 = x => Math.max(1, Math.min(99, Math.round(x * 100)));

  function openRange(sp){ return sp.playersDealt === 2 ? OPEN_HEADS_UP : OPEN_BY_BEHIND[Math.min(sp.actingAfter, OPEN_BY_BEHIND.length - 1)]; }
  function pushRange(sp){
    const base = sp.playersDealt === 2 ? PUSH_HEADS_UP : PUSH_BY_BEHIND[Math.min(sp.actingAfter, PUSH_BY_BEHIND.length - 1)];
    return Math.min(1, base * Math.pow(PUSH_FOLD_BB / Math.max(1.5, sp.effectiveBB), 0.6));
  }
  // how much wider than a normal player someone has shown themselves to be
  function widthOf(read, stat, prior){
    if (!read || read.hands < 12) return 1;
    return Math.max(0.35, Math.min(4, (read[stat] / read.hands) / prior));
  }
  /* The hands a raise usually means, from public facts only. */
  function raiserRange(sp){
    const agg = sp.pfAggressor && sp.opponents.find(o => o.id === sp.pfAggressor.id);
    const raises = sp.preflop.raises;
    let r;
    if (agg && agg.allIn && agg.stackBB + agg.bet / sp.bigBlind <= 15) r = 0.30;
    else if (raises >= 2) r = RERAISE[Math.min(raises, RERAISE.length - 1)];
    else r = sp.playersDealt === 2 ? OPEN_HEADS_UP * 0.9 : (OPEN_BY_SEAT[agg && agg.seat] || 0.2) * 0.9;
    if (raises <= 1 && sp.currentBet / sp.bigBlind > 4.5 && !(agg && agg.allIn)) r *= 0.75;
    r *= Math.pow(widthOf(agg && agg.read, 'pfr', 0.18), raises <= 1 ? 1 : 0.7);
    return Math.max(0.01, Math.min(1, r));
  }
  function equityVs(sp, ranges){
    const eq = call('estimateEquityVsRanges', sp.hole, [], ranges, 1200);
    return typeof eq === 'number' ? eq : null;
  }
  const J = (o) => Object.assign({ notable:false }, o);

  /* The starting-hand ranking blends equity against one and three random
     hands, which undervalues small pairs: they rarely win unimproved, but
     make a set one flop in eight and win big when they do. Opening charts
     play them from the middle and late seats, so the judge does too. */
  function playablePct(sp){
    const f = sp.holeFacts, pct = f.pct;
    if (!f.pair) return pct;
    const v = sp.hole[0].value;
    return Math.min(pct, v <= 4 ? 0.20 : v <= 6 ? 0.15 : pct);
  }
  function judgePreflop(sp, ch){
    if (!sp || !ch || sp.street !== 'preflop' || !ch.action || sp.holeFacts.pct == null) return null;
    const pct = playablePct(sp), a = ch.action, f = sp.holeFacts;
    const raises = sp.preflop.raises, limpers = sp.preflop.limpers;
    const deepShove = a === 'allin' && sp.effectiveBB > 25;
    const n = { pct:pct100(sp.holeFacts.pct), bb:Math.round(sp.effectiveBB), size:ch.toBB, call:sp.toCall, odds:Math.round(sp.potOdds * 100),
      behind:sp.actingAfter, seat:sp.seat, raiser:sp.pfAggressor ? sp.pfAggressor.name : null, limpers,
      // (short because of them, not you: his lines name them)
      shortOpp: sp.effectiveBB <= 15 && sp.shortBy ? sp.shortBy : null, shortOne: sp.shortByOne };

    /* ---- short: shove or fold ---- */
    if (raises === 0 && sp.effectiveBB <= PUSH_FOLD_BB && !(sp.seat === 'BB' && sp.toCall === 0)){
      const P = pushRange(sp); n.range = pct100(P);
      const base = { kind:'short', best: pct <= P ? 'allin' : 'fold', lesson:'short-stack', n };
      if (a === 'allin'){
        // (the table's shove ranges are a sound player's, a shade tight of the
        // push/fold charts, so the edge is wide before it's a mistake)
        if (pct <= P) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'short.push.good', notable: pct > 0.08 }));
        if (pct <= P * 1.8) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'short.push.close' }));
        return J(Object.assign(base, { verdict:'mistake', confidence: pct > P * 2.8 + 0.1 ? 'clear' : 'leans', tag:'short.push.loose', notable:true }));
      }
      if (a === 'fold'){
        if (pct <= P * 0.5) return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:'short.fold.missed', notable:true }));
        if (pct <= P * 0.8) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'short.fold.missed', notable:true }));
        if (pct <= P) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'short.fold.close' }));
        return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'short.fold.good' }));
      }
      if (a === 'raise') return J(Object.assign(base, { verdict: pct <= P ? 'fine' : 'mistake', confidence:'leans', tag: pct <= P ? 'short.raise.small' : 'short.push.loose', notable:true }));
      if (a === 'call') return J(Object.assign(base, { verdict:'mistake', confidence: pct <= P * 0.6 ? 'clear' : 'leans', tag:'short.limp', notable:true }));
      return null;
    }

    /* ---- the big blind's free option: nobody raised ---- */
    if (raises === 0 && sp.seat === 'BB' && sp.toCall === 0){
      const base = { kind:'bbOption', best: pct <= 0.12 && limpers ? 'raise' : 'check', lesson:'position', n };
      if (a === 'fold') return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:'bb.fold.free', lesson:'the-basics', notable:true }));
      if (a === 'check') return J(Object.assign(base, pct <= 0.05 && limpers ? { verdict:'fine', confidence:'leans', tag:'bb.check.strong', notable:true } : { verdict:'good', confidence:'clear', tag:'bb.check' }));
      if (deepShove) return J(Object.assign(base, { verdict: pct <= 0.02 ? 'fine' : 'mistake', confidence: pct <= 0.02 ? 'leans' : 'clear', tag:'open.shove', lesson:'raise-or-fold', notable:true }));
      if (pct <= 0.15) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'bb.raise.good', notable:true }));
      return J(Object.assign(base, { verdict: pct <= 0.35 ? 'fine' : 'mistake', confidence: pct <= 0.35 ? 'close' : 'leans', tag:'bb.raise.loose' }));
    }

    /* ---- nobody has raised: open, or raise the limpers ---- */
    if (raises === 0){
      const R = openRange(sp); n.range = pct100(R);
      if (deepShove) return J({ kind:'open', best: pct <= R ? 'raise' : 'fold', verdict: pct <= 0.02 ? 'fine' : 'mistake', confidence: pct <= 0.02 ? 'leans' : 'clear', tag:'open.shove', lesson:'raise-or-fold', notable:true, n });
      if (limpers === 0){
        const sbLimp = sp.seat === 'SB' && sp.playersDealt > 2;
        const base = { kind:'open', best: pct <= R ? 'raise' : 'fold', lesson:'position', n };
        if (a === 'raise' || a === 'allin'){
          const big = a === 'raise' && ch.toBB > 5;
          if (pct <= R) return J(Object.assign(base, big ? { verdict:'fine', confidence:'leans', tag:'open.big', lesson:'raise-or-fold', notable:true }
            : { verdict:'good', confidence:'clear', tag: pct <= 0.06 ? 'open.good.premium' : sp.seatGroup === 'late' && pct > R * 0.5 ? 'open.good.steal' : 'open.good', notable: pct <= 0.06 || (sp.seatGroup === 'late' && pct > R * 0.5) }));
          if (pct <= R * 1.35) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'open.loose.close' }));
          return J(Object.assign(base, { verdict:'mistake', confidence: pct > R * 2 ? 'clear' : 'leans', tag:'open.loose', notable:true }));
        }
        if (a === 'call'){
          // the small blind topping up is a real choice (raise-or-fold and
          // limping strategies both hold up there), so only junk is a mistake
          if (sbLimp) return J(Object.assign(base, pct < 0.65 ? { verdict:'fine', confidence:'close', tag:'sb.complete' } : { verdict:'mistake', confidence:'leans', tag:'limp.weak', lesson:'raise-or-fold', notable:true }));
          if (pct <= R) return J(Object.assign(base, { verdict:'mistake', confidence: pct <= 0.08 ? 'clear' : 'leans', tag:'limp.strong', lesson:'raise-or-fold', notable:true }));
          return J(Object.assign(base, { verdict:'mistake', confidence: pct > R * 1.6 ? 'clear' : 'leans', tag:'limp.weak', lesson:'raise-or-fold', notable:true }));
        }
        if (a === 'fold'){
          if (pct <= R * 0.5) return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:'open.fold.strong', lesson:'starting-hands', notable:true }));
          if (pct <= R * 0.85) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'open.fold.strong', lesson:'starting-hands', notable:true }));
          if (pct <= R) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'open.fold.close' }));
          return J(Object.assign(base, { verdict:'good', confidence:'clear', tag: sp.seatGroup === 'early' && pct <= R * 1.8 ? 'open.fold.disciplined' : 'open.fold.good',
            notable: sp.seatGroup === 'early' && pct <= R * 1.8 }));
        }
        return null;
      }
      // limpers in front: raise them (isolate), sometimes limp along, else fold
      const I = Math.max(0.04, R * 0.7); n.range = pct100(I);
      const overlimp = pct <= R * 1.3 && (f.pair || (f.suited && f.gap <= 2) || sp.seatGroup === 'late');
      const base = { kind:'limped', best: pct <= I ? 'raise' : overlimp ? 'call' : 'fold', lesson:'raise-or-fold', n };
      if (a === 'raise' || a === 'allin'){
        if (pct <= I) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'iso.good', notable: pct <= 0.1 || sp.seatGroup === 'late' }));
        if (pct <= R) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'iso.loose.close' }));
        return J(Object.assign(base, { verdict:'mistake', confidence: pct > R * 2 ? 'clear' : 'leans', tag:'iso.loose', notable:true }));
      }
      if (a === 'call'){
        if (pct <= I * 0.5) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'iso.limp.strong', notable:true }));
        if (overlimp || pct <= R) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'iso.overlimp' }));
        return J(Object.assign(base, { verdict:'mistake', confidence: pct > 0.7 ? 'clear' : 'leans', tag:'limp.weak', notable:true }));
      }
      if (a === 'fold'){
        if (pct <= I * 0.6) return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:'iso.fold.strong', lesson:'starting-hands', notable:true }));
        if (pct <= I) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'iso.fold.strong', lesson:'starting-hands', notable:true }));
        return J(Object.assign(base, { verdict:'good', confidence: overlimp ? 'close' : 'clear', tag:'open.fold.good' }));
      }
      return null;
    }

    /* ---- facing a raise, or a re-raise ---- */
    const Rr = raiserRange(sp);
    const agg = sp.pfAggressor && sp.opponents.find(o => o.id === sp.pfAggressor.id);
    n.raiserSeat = agg ? agg.seat : null;
    const ranges = [Rr].concat(Array.from({ length:sp.preflop.callers }, () => Math.min(1, Rr * 1.6)));
    const eq = equityVs(sp, ranges);
    if (eq == null) return null;
    const isBB = sp.seat === 'BB';
    const ip = sp.seatGroup !== 'blinds';
    const deep = sp.effectiveBB >= 40;
    const implied = deep && (f.pair || (f.suited && f.gap <= 2)) ? 0.06 : 0;
    const need = sp.potOdds + sp.actingAfter * 0.02 + (!isBB && raises === 1 ? 0.03 : 0) - implied;
    // equity you actually get to use: less out of position, less with weak
    // hands (they give up before the showdown more often)
    const realise = (ip ? 0.95 : 0.82) - 0.12 * pct;
    const realised = eq * realise;
    const margin = realised - need;
    const value = eq >= 0.60;
    const short = sp.effectiveBB <= 15;
    // (the lines quote your raw chance of winning against what you needed of
    // it, so the discount is folded into the need: the two compare straight)
    Object.assign(n, { eq:pct100(eq), need:pct100(Math.max(0.01, need) / Math.max(0.3, realise)), range:pct100(Rr), margin:Math.round(margin * 100) });
    const kind = raises >= 2 ? 'vsReraise' : 'vsRaise';
    const lesson = isBB && raises === 1 ? 'bb-defence' : 'calling-raises';
    const best = value || (short && eq >= 0.48) ? (short ? 'allin' : 'raise') : margin >= 0 ? 'call' : 'fold';
    const base = { kind, best, lesson, n };
    const pre = raises >= 2 ? 'vs3bet' : 'vsraise';

    if (a === 'fold'){
      if (value) return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:pre + '.fold.strong', notable:true }));
      if (short && eq >= 0.52) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'short.fold.missed', lesson:'short-stack', notable:true }));
      if (margin <= 0) return J(Object.assign(base, { verdict:'good', confidence: margin < -0.05 ? 'clear' : 'close', tag:pre + '.fold.good', notable: pct <= 0.3 && margin < -0.03 }));
      if (margin <= 0.04) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:pre + '.fold.close' }));
      return J(Object.assign(base, { verdict:'mistake', confidence: margin > 0.10 ? 'clear' : 'leans', tag:pre + '.fold.priced', notable:true }));
    }
    if (a === 'call'){
      if (short && sp.toCall < sp.stack) {
        // short stacks don't flat: shove or fold
        if (eq >= 0.48) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'short.flat', lesson:'short-stack', notable:true }));
      }
      if (margin >= 0) return J(Object.assign(base, value ? { verdict:'fine', confidence:'leans', tag:pre + '.call.value', lesson:'three-bet', notable:true }
        : { verdict:'good', confidence: margin > 0.04 ? 'clear' : 'close', tag: isBB && raises === 1 ? 'bb.defend.good' : pre + '.call.good', notable: margin > 0.04 && (isBB || pct > 0.2) }));
      if (margin >= -0.04) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:pre + '.call.close' }));
      return J(Object.assign(base, { verdict:'mistake', confidence: margin < -0.10 ? 'clear' : 'leans', tag:pre + '.call.weak', notable:true }));
    }
    if (a === 'raise' || a === 'allin'){
      if (a === 'allin' && !short){
        if (eq >= 0.65) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'reraise.shove.big', lesson:'three-bet', notable:true }));
        return J(Object.assign(base, { verdict:'mistake', confidence: eq < 0.5 ? 'clear' : 'leans', tag:'reraise.shove.loose', lesson:'three-bet', notable:true }));
      }
      if (short){
        if (eq >= 0.48) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'short.reshove.good', lesson:'short-stack', notable:true }));
        if (eq >= 0.42) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'short.push.close', lesson:'short-stack' }));
        return J(Object.assign(base, { verdict:'mistake', confidence: eq < 0.35 ? 'clear' : 'leans', tag:'short.push.loose', lesson:'short-stack', notable:true }));
      }
      if (value) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:pre + '.raise.value', lesson:'three-bet', notable:true }));
      if (eq >= 0.52 || (f.suited && pct <= 0.35 && margin > -0.06)) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:pre + '.raise.close', lesson:'three-bet' }));
      return J(Object.assign(base, { verdict:'mistake', confidence: pct > 0.5 ? 'clear' : 'leans', tag:pre + '.raise.loose', lesson:'three-bet', notable:true }));
    }
    return null;
  }

  /* ============================================================
     JUDGE 2a: AFTER THE FLOP, FACING A BET  (step 3a)

     Calling, folding and raising when someone has bet into you: your
     chance of winning against the hands their betting points to, against
     the price. Each opponent's likely hands come from public facts only,
     as the AI reads them (js/03-opponents.js preflopRangeOf, narrowWeight):
     what they did before the flop (raised, called a raise, limped, the big
     blind), narrowed by every bet, raise, call and check since, and by
     their habits in the table's notebook (how often they bet, and bluffs
     seen at showdowns). Then:
       - equity used: on the river all of it; before, a little less out of
         position and with nothing (you'll often have to give up);
       - the price: pot odds, plus a margin with players still to act;
         draws to a strong hand earn a little back when stacks are deep
         (implied odds: you win more when you hit).
     Raise for value with 70%+ against one player (55%+ against more); a
     strong draw may raise as a semi-bluff against one. Checked to you or
     first to act (betting) is step 3b.
     ============================================================ */
  // a bet, as a thing you can make, call or face ("a half-pot bet")
  const BET_WORD = f => f < 0.4 ? 'a small bet' : f < 0.6 ? 'a half-pot bet' : f < 0.85 ? 'a bet of three-quarters of the pot' : f < 1.15 ? 'a pot-sized bet' : 'a bet bigger than the pot';
  const STRONG_MADE = { 'two-pair':1, set:1, trips:1, straight:1, flush:1, 'full-house':1, quads:1, 'straight-flush':1 };
  const MADE_OK = { overpair:1, 'top-pair':1, 'two-pair':1, set:1, trips:1, straight:1, flush:1, 'full-house':1, quads:1, 'straight-flush':1 };
  const clampR = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const EQ = new WeakMap();
  /* An opponent's likely hands, from what they've shown (public). */
  function oppRange(sp, o){
    const raises = sp.preflop.raises;
    let pct;
    const agg = sp.pfAggressor && sp.pfAggressor.id === o.id;
    if (agg) pct = raises >= 2 ? RERAISE[Math.min(raises, RERAISE.length - 1)] : sp.playersDealt === 2 ? OPEN_HEADS_UP : (OPEN_BY_SEAT[o.seat] || 0.2);
    else if (raises >= 2) pct = 0.08;
    else if (raises === 1) pct = o.seat === 'BB' ? 0.45 : 0.20;
    else pct = o.seat === 'BB' ? 1 : 0.45;
    pct = Math.min(1, pct * widthOf(o.read, agg ? 'pfr' : 'vpip', agg ? 0.18 : 0.30));
    const hist = sp.handLog.filter(h => h.id === o.id).map(h => ({ n:h.n, a:h.a }));
    if (!hist.length) return pct;
    // how often they bet, and bluffs seen at showdowns, smoothed toward a normal player
    const r = o.read || {};
    const aggr = ((r.postAgg || 0) + 0.30 * 8) / ((r.postAgg || 0) + (r.postPassive || 0) + 8) / 0.30;
    const bluffs = ((r.bluffsShown || 0) + 0.30 * 3) / ((r.riverBetsShown || 0) + 3) / 0.30;
    return { pct, hist, bluff:+clampR(aggr * Math.sqrt(bluffs), 0.4, 3).toFixed(2), k:1 };
  }
  // a raise after the flop: three times the bet, plus one bet for each
  // player who has called it (rounded to the big blind)
  function postRaiseSize(sp){
    const here = sp.actions.filter(x => x.street === sp.street);
    const lastAgg = here.map(x => x.action).lastIndexOf('bet') > here.map(x => x.action).lastIndexOf('raise') ? here.map(x => x.action).lastIndexOf('bet') : here.map(x => x.action).lastIndexOf('raise');
    const callers = lastAgg < 0 ? 0 : here.slice(lastAgg + 1).filter(x => x.action === 'call').length;
    const to = Math.round((sp.currentBet * 3 + callers * sp.currentBet) / sp.bigBlind) * sp.bigBlind;
    const allin = sp.stack + sp.yourBet;
    if (to >= allin * 0.45) return allin;   // most of your stack: just go all in
    return Math.min(allin, Math.max(to, sp.currentBet + sp.minRaise));
  }
  function judgePostflop(sp, ch){
    if (!sp || !ch || sp.street === 'preflop' || !ch.action || !sp.boardFacts) return null;
    if (sp.toCall <= 0) return null;   // betting when checked to: step 3b
    let a = ch.action;
    if (a === 'allin') a = sp.toCall >= sp.stack ? 'call' : 'raise';
    if (a === 'check') a = 'call';
    const bf = sp.boardFacts, left = 5 - sp.board.length;
    // (one sample per decision: advice judges every move on the same spot)
    let eq = EQ.get(sp);
    if (eq == null){ eq = call('estimateEquityVsRanges', sp.hole, sp.board, sp.opponents.map(o => oppRange(sp, o)), 1500); EQ.set(sp, eq); }
    if (typeof eq !== 'number') return null;
    const strongDraw = left > 0 && (bf.draws.flush || bf.draws.oesd);
    const anyDraw = left > 0 && (strongDraw || bf.draws.gutshot);
    const madeWeak = !MADE_OK[bf.made];
    const ip = sp.actingAfter === 0;
    const realise = left === 0 ? 1 : (ip ? 0.97 : 0.9) - (madeWeak && !anyDraw ? 0.05 : 0);
    const behind = Math.max(0, sp.stack - sp.toCall);
    const deep = behind > 1.5 * (sp.pot + sp.toCall);
    const implied = !deep ? 0 : strongDraw ? (left === 1 ? 0.05 : 0.03) : anyDraw ? 0.02 : 0;
    const need = sp.potOdds + (sp.playersIn > 2 && sp.actingAfter > 0 ? 0.03 : 0) - implied;
    const margin = eq * realise - need;
    const multi = sp.playersIn > 2;
    // raising for value needs a hand that's ahead of the hands that CALL a
    // raise, not just of the betting range: two pair or better. Top pair and
    // overpairs are ahead of a bet but behind most calls of a raise: they
    // call (a raise is fine, to protect, but close).
    const strongMade = STRONG_MADE[bf.made] && !bf.boardPlays;
    const ahead = eq >= (multi ? 0.55 : 0.70);
    const value = strongMade && ahead;
    const bettorAct = sp.actions.filter(x => x.street === sp.street && (x.action === 'bet' || x.action === 'raise')).pop();
    const betFrac = sp.toCall / Math.max(1, sp.pot - sp.toCall);
    const unseen = 52 - 2 - sp.board.length;
    const drawName = bf.draws.flush && (bf.draws.oesd || bf.draws.gutshot) ? 'a flush and straight draw' : bf.draws.flush ? 'a flush draw' : bf.draws.oesd ? 'an open-ended straight draw' : bf.draws.gutshot ? 'an inside straight draw' : '';
    const n = { street:sp.street, eq:pct100(eq), need:pct100(Math.max(0.01, need) / realise), odds:Math.round(sp.potOdds * 100), call:sp.toCall, pot:sp.pot,
      handName:bf.handName, made:bf.made, drawName, outs:bf.drawOuts, hitNext: bf.drawOuts ? Math.round(bf.drawOuts / unseen * 100) : 0,
      bettor: bettorAct ? bettorAct.name : 'they', betSize:BET_WORD(betFrac), margin:Math.round(margin * 100), players:sp.playersIn - 1,
      implied:Math.round(implied * 100), seat:sp.seat, pct:pct100(sp.holeFacts.pct) };
    const river = left === 0;
    const lesson = river ? 'river-bets' : anyDraw && madeWeak ? 'drawing-odds' : 'pot-odds';
    const best = value ? 'raise' : margin >= 0 ? 'call' : 'fold';
    const base = { kind:'post', best, lesson, n };
    if (a === 'fold'){
      if (value || ahead) return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:'post.fold.strong', lesson:'hand-strength', notable:true }));
      if (margin <= 0) return J(Object.assign(base, { verdict:'good', confidence: margin < -0.05 ? 'clear' : 'close', tag:'post.fold.good',
        notable: margin < -0.04 && (MADE_OK[bf.made] || bf.made === 'second-pair') }));
      if (margin <= 0.04) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'post.fold.close' }));
      return J(Object.assign(base, { verdict:'mistake', confidence: margin > 0.10 ? 'clear' : 'leans', tag: anyDraw && madeWeak ? 'post.fold.draw' : 'post.fold.priced', notable:true }));
    }
    if (a === 'call'){
      if (value) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'post.call.value', lesson:'raising-for-value', notable:true }));
      if (margin >= 0) return J(Object.assign(base, { verdict:'good', confidence: margin > 0.04 ? 'clear' : 'close',
        tag: anyDraw && madeWeak ? 'post.call.draw.good' : 'post.call.good',
        notable: margin > 0.04 && ((anyDraw && madeWeak) || (river && madeWeak) || (river && betFrac >= 0.6)) }));
      if (margin >= -0.04) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'post.call.close' }));
      return J(Object.assign(base, { verdict:'mistake', confidence: margin < -0.10 ? 'clear' : 'leans', tag: anyDraw && madeWeak ? 'post.call.draw.bad' : 'post.call.weak', notable:true }));
    }
    if (a === 'raise'){
      if (value) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'post.raise.value', lesson:'raising-for-value', notable:true }));
      if (ahead) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'post.raise.protect', lesson:'hand-strength' }));
      // (a raise that's all your chips, with a draw: only when it pays)
      const allIn = ch.action === 'allin' || (ch.amount != null && ch.amount >= sp.stack + sp.yourBet);
      if (strongDraw && allIn){
        const sh = multi ? { ok:false, close:false } : drawShove(sp, eq, clampR(foldChance(sp) * 0.6, 0.03, 0.6));
        Object.assign(n, { whole:sh.whole, risk:sh.risk });
        if (!sh.ok && !sh.close) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'post.raise.semi.shove', lesson:'draw-shove', notable:true }));
      }
      if (strongDraw && !multi && eq >= 0.30) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'post.raise.semi', lesson:'semi-bluff', notable:true }));
      if (eq >= 0.55) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'post.raise.close', lesson:'raising-for-value' }));
      return J(Object.assign(base, { verdict:'mistake', confidence: eq < 0.4 ? 'clear' : 'leans', tag:'post.raise.loose', lesson:'raising-for-value', notable:true }));
    }
    return null;
  }
  /* ============================================================
     WHAT THEIR BETTING SAYS (a story per opponent, from public actions)
       'strong'   bet or raised after the flop: usually a real hand
       'turned'   checked or called before, and bets now: they may have
                  hit the card they wanted, or be trying to take it
       'calling'  called a bet after the flop: a medium hand or a draw
       'weak'     only checked since the flop: usually not much
       'quiet'    nothing to go on yet (before the flop, or first to act)
     plus their habits from the notebook when there's enough of it:
       'loose' plays lots of hands, 'tight' very few, 'caller' rarely folds
       to a bet, 'bluffer' has been caught bluffing.
     ============================================================ */
  function storyOf(sp, o){
    const post = sp.handLog.filter(h => h.id === o.id);
    const aggr = post.filter(h => h.a === 'b' || h.a === 'r');
    const calls = post.filter(h => h.a === 'c');
    // the story follows the hand (owner 29 Sep 2026: "checking, then
    // suddenly betting"): a player who checked or called on an earlier
    // street and only now bets has TURNED (they may have hit, or be trying
    // to take it); 'again' is a pattern (two bets, or two calls),
    // so he only says "keeps betting" when they have
    let kind = 'quiet', again = false;
    if (aggr.length){
      const first = aggr[0];
      const turned = aggr.every(h => h.a === 'b') && post.some(h => (h.a === 'k' || h.a === 'c') && h.n < first.n);
      again = aggr.length >= 2;
      kind = turned && !again ? 'turned' : 'strong';
    }
    else if (calls.length){ kind = 'calling'; again = calls.length >= 2; }
    else if (post.some(h => h.a === 'k')) kind = 'weak';
    const r = o.read || {};
    let habit = null;
    if ((r.bluffsShown || 0) >= 2) habit = 'bluffer';
    else if ((r.facedBet || 0) >= 6 && (r.foldedToBet || 0) / r.facedBet < 0.2) habit = 'caller';
    else if ((r.hands || 0) >= 15 && (r.vpip || 0) / r.hands > 0.5) habit = 'loose';
    else if ((r.hands || 0) >= 15 && (r.vpip || 0) / r.hands < 0.15) habit = 'tight';
    const pfAgg = sp.pfAggressor && sp.pfAggressor.id === o.id;
    return { id:o.id, name:o.name, kind, again, habit, pfAgg };
  }
  function stories(sp){
    const list = sp.opponents.map(o => storyOf(sp, o));
    const kinds = new Set(list.map(x => x.kind));
    const all = kinds.size === 1 ? list[0] && list[0].kind : 'mixed';
    return { list, all, one: list.length === 1 ? list[0] : null };
  }

  /* ============================================================
     JUDGE 2b: CHECKED TO YOU, OR FIRST TO ACT (step 3b): bet or check

     - Strong hands BET for value: worse hands pay you. Two pair or
       better, or top pair / an overpair when you're ahead (55%+ against
       one player, 60%+ against more). Checking one on the river is money
       left on the table; earlier it can be a trap, so it's a lean.
     - Medium hands (a pair that isn't clearly best) CHECK: a bet mostly
       gets called by better hands. Betting one is thin, and close.
     - Strong draws may BET as a semi-bluff against one player (two ways to
       win); against several, it's close.
     - Nothing: CHECK, or BLUFF when it makes sense: against one player
       only, not a player who calls everything, and when they're likely
       to fold often enough to pay for it: a bet of B into a pot of P needs
       them to fold B / (P + B) of the time. How often they fold comes from
       what they've done this hand (checking says weak) and their habit of
       folding to bets in the table's notebook.
     Sizes: half the pot on quiet boards, two-thirds on boards full of
     draws and on the river; a bluff the same size as a value bet, so the
     size gives nothing away.
     ============================================================ */
  function betSize(sp){
    const bf = sp.boardFacts || {};
    const frac = sp.board.length === 5 || (bf.texture && bf.texture.wet >= 0.45) ? 0.66 : 0.5;
    const half = sp.bigBlind / 2;   // (to the half big blind: a whole one is too coarse on small pots)
    const to = Math.max(sp.bigBlind, Math.round(sp.pot * frac / half) * half);
    return { to: to >= (sp.stack + sp.yourBet) * 0.45 ? sp.stack + sp.yourBet : to, frac };
  }
  function foldChance(sp){
    // each opponent: their habit of folding to bets (smoothed toward 45%),
    // more likely after checking this hand; everyone has to fold
    return sp.opponents.reduce((acc, o) => {
      const r = o.read || {};
      const base = ((r.foldedToBet || 0) + 0.45 * 6) / ((r.facedBet || 0) + 6);
      const checked = sp.handLog.some(h => h.id === o.id && h.a === 'k') && !sp.handLog.some(h => h.id === o.id && (h.a === 'b' || h.a === 'r' || h.a === 'c'));
      return acc * clampR(base * (checked ? 1.15 : 1), 0.05, 0.85);
    }, 1);
  }
  /* A draw, all in (owner 29 Sep 2026, "bad advice which made me go
     bust"): betting a draw is fine, but "bet your draw" must never quietly
     turn into your whole stack. All in pays when they fold often enough,
     or when the stacks are small next to the pot. Measured against the
     other choice: check and see the next card (or, facing a bet, the better
     of calling and folding). Called, you win your share of the whole pot.
     Risking all your chips (they cover you) needs a clear edge: losing it
     ends your game, winning it doesn't double your chances. */
  function drawShove(sp, eq, fe){
    const o = sp.opponents.slice().sort((a, b) => (b.chips + b.bet) - (a.chips + a.bet))[0];
    if (!o) return { ok:true, close:true };
    const theirs = o.chips + o.bet;
    const risk = Math.min(sp.stack, Math.max(0, theirs - sp.yourBet));   // (they can only call what they have)
    const final = sp.pot + risk + Math.max(0, sp.yourBet + risk - o.bet);
    const shove = fe * sp.pot + (1 - fe) * (eq * final - risk);
    const other = sp.toCall > 0 ? Math.max(0, eq * 0.9 * (sp.pot + sp.toCall) - sp.toCall) : eq * 0.9 * sp.pot;
    const whole = risk >= sp.stack;
    const edge = shove - other - (whole ? 0.1 * sp.pot : 0);
    return { ok: edge >= 0, close: Math.abs(edge) < 0.1 * sp.pot, whole, risk };
  }
  function judgeBet(sp, ch){
    if (!sp || !ch || sp.street === 'preflop' || !sp.boardFacts || sp.toCall > 0) return null;
    let a = ch.action;
    if (a === 'allin' || a === 'raise') a = 'bet';
    if (a === 'call' || a === 'fold') a = 'check';   // (folding for free is never right, but it's a check's mistake)
    const bf = sp.boardFacts, left = 5 - sp.board.length;
    let eq = EQ.get(sp);
    if (eq == null){ eq = call('estimateEquityVsRanges', sp.hole, sp.board, sp.opponents.map(o => oppRange(sp, o)), 1500); EQ.set(sp, eq); }
    if (typeof eq !== 'number') return null;
    const opps = sp.opponents.length, multi = opps > 1;
    const strongMade = STRONG_MADE[bf.made] && !bf.boardPlays;
    const goodMade = MADE_OK[bf.made] && !bf.boardPlays;
    const valueHand = (strongMade && eq >= 0.55) || (goodMade && eq >= (multi ? 0.60 : 0.55));
    const strongDraw = left > 0 && (bf.draws.flush || bf.draws.oesd) && !goodMade;
    const medium = !valueHand && !strongDraw && (goodMade || bf.made === 'second-pair' || bf.made === 'weak-pair' || eq >= 0.45);
    const size = betSize(sp);
    const fe = foldChance(sp);
    const bluffNeed = size.to / (sp.pot + size.to);
    const st = stories(sp);
    const station = sp.opponents.some(o => storyOf(sp, o).habit === 'caller');
    const river = left === 0;
    const drawName = bf.draws.flush && (bf.draws.oesd || bf.draws.gutshot) ? 'a flush and straight draw' : bf.draws.flush ? 'a flush draw' : bf.draws.oesd ? 'an open-ended straight draw' : bf.draws.gutshot ? 'an inside straight draw' : '';
    const n = { street:sp.street, eq:pct100(eq), handName:bf.handName, made:bf.made, drawName, outs:bf.drawOuts,
      players:opps, opp: st.one ? st.one.name : null, story:st.all, habit: st.one ? st.one.habit : null,
      fold:Math.round(fe * 100), foldNeed:Math.round(bluffNeed * 100), to:size.to, sizeWords: size.frac >= 0.6 ? 'two-thirds of the pot' : 'half the pot',
      betSize: ch.potFraction == null ? '' : BET_WORD(ch.potFraction), pot:sp.pot, seat:sp.seat, pct:pct100(sp.holeFacts.pct) };
    // (how often they fold is an estimate, so a bluff is never clear-cut:
    // it needs a real margin to be good, and even then it leans)
    const bluffGood = !multi && !station && fe >= bluffNeed + 0.08;
    const bluffClose = !multi && !station && fe >= bluffNeed - 0.04;
    // a draw, where the bet is all your chips (his own size, or yours)
    const allinTo = sp.stack + sp.yourBet;
    const allIn = ch.action === 'allin' || (ch.amount != null && ch.amount >= allinTo);
    const shove = strongDraw ? drawShove(sp, eq, fe) : null;
    const drawBet = strongDraw && !multi && (size.to < allinTo || shove.ok);
    if (shove) Object.assign(n, { whole:shove.whole, risk:shove.risk });
    const best = valueHand || drawBet || (!medium && !strongDraw && bluffGood) ? 'bet' : 'check';
    const base = { kind:'bet', best, n };
    if (a === 'check'){
      if (valueHand){
        const clear = river && (strongMade || eq >= 0.8);
        return J(Object.assign(base, { verdict:'mistake', confidence: clear ? 'clear' : 'leans', tag:'bet.missed', lesson:'value-betting', notable:true }));
      }
      if (medium) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'bet.check.medium', lesson:'pot-control' }));
      // (his bet would have been all your chips, and that doesn't pay: checking's right)
      if (strongDraw && !multi && !drawBet) return J(Object.assign(base, { verdict:'good', confidence: shove.close ? 'close' : 'leans', tag:'bet.check.draw.deep' }));
      if (strongDraw) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'bet.check.draw', lesson:'semi-bluff', notable:!multi }));
      if (bluffGood) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'bet.bluff.chance', lesson:'bluffing', notable:true }));
      return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'bet.check.weak', lesson:'bluffing' }));
    }
    // a bet
    if (valueHand){
      if (ch.potFraction != null && ch.potFraction < 0.3) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'bet.value.small', lesson:'value-betting', notable:true }));
      return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'bet.value', lesson:'value-betting', notable:true }));
    }
    if (medium) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'bet.thin', lesson:'pot-control' }));
    // all in with a draw: only when it pays (never clear-cut: how often they
    // fold is an estimate)
    if (strongDraw && allIn && !multi && !shove.ok && shove.close) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'bet.semi.shove.close', lesson:'draw-shove' }));
    if (strongDraw && allIn && (multi || !shove.ok)) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'bet.semi.shove', lesson:'draw-shove', notable:true }));
    if (strongDraw && allIn) return J(Object.assign(base, { verdict:'good', confidence: shove.close ? 'close' : 'leans', tag:'bet.semi', lesson:'semi-bluff', notable:true }));
    if (strongDraw) return J(Object.assign(base, !multi ? { verdict:'good', confidence:'clear', tag:'bet.semi', lesson:'semi-bluff', notable:true }
      : { verdict:'fine', confidence:'close', tag:'bet.semi.multi', lesson:'semi-bluff' }));
    // a bluff
    if (multi) return J(Object.assign(base, { verdict:'mistake', confidence: opps >= 3 ? 'clear' : 'leans', tag:'bet.bluff.multi', lesson:'bluffing', notable:true }));
    if (station) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'bet.bluff.station', lesson:'bluffing', notable:true }));
    if (bluffGood) return J(Object.assign(base, { verdict:'good', confidence:'leans', tag:'bet.bluff.good', lesson:'bluffing', notable:true }));
    if (bluffClose) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'bet.bluff.close', lesson:'bluffing' }));
    return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:'bet.bluff.bad', lesson:'bluffing', notable:true }));
  }
  const judge = (sp, ch) => !sp ? null : sp.street === 'preflop' ? judgePreflop(sp, ch) : sp.toCall > 0 ? judgePostflop(sp, ch) : judgeBet(sp, ch);

  /* ============================================================
     ADVICE BEFORE YOU ACT (step 4, brought forward for the preflop,
     owner 29 Sep 2026): the judge run on each move you could make, before
     you make one. What he'd do, how sure he is (CLEAR: the only good move;
     LEANS: another move is defensible; CLOSE: another is just as good), the
     size he'd pick, and the same numbers the judge quotes.
     ============================================================ */
  function raiseSize(sp){
    const bb = sp.bigBlind, raises = sp.preflop.raises;
    if (sp.effectiveBB <= PUSH_FOLD_BB + 5 && raises >= 1 || sp.effectiveBB <= PUSH_FOLD_BB) return sp.stack + sp.yourBet;   // all in
    let to;
    if (raises === 0) to = (sp.playersDealt === 2 ? 2.5 : 2.5) * bb + sp.preflop.limpers * bb + (sp.seat === 'BB' && sp.preflop.limpers ? bb : 0);
    else to = sp.currentBet * (raises >= 2 ? 2.3 : sp.seatGroup === 'blinds' ? 3.8 : 3) + sp.preflop.callers * sp.currentBet;
    to = Math.round(to / bb * 2) / 2 * bb;   // to the half big blind
    return Math.min(sp.stack + sp.yourBet, Math.max(to, sp.currentBet + sp.minRaise));
  }
  function advise(sp){
    if (!sp) return null;
    const pre = sp.street === 'preflop';
    const betting = !pre && sp.toCall <= 0;
    const to = pre ? raiseSize(sp) : betting ? betSize(sp).to : postRaiseSize(sp), allinTo = sp.stack + sp.yourBet;
    const moves = [];
    moves.push(sp.toCall > 0 ? 'fold' : 'check');
    if (sp.toCall > 0) moves.push('call');
    if (sp.mayRaise) moves.push(to >= allinTo ? 'allin' : 'raise');
    // what each move would be recorded as, judged
    const judged = moves.map(m => {
      const amount = m === 'raise' ? to : m === 'allin' ? allinTo : m === 'call' ? sp.yourBet + sp.toCall : sp.yourBet;
      const added = Math.max(0, amount - sp.yourBet);
      const ch = { action:m, amount, added, addedBB:r1(added / sp.bigBlind), toBB:r1(amount / sp.bigBlind),
        potFraction: sp.pot > 0 && added > 0 ? Math.round(added / sp.pot * 100) / 100 : null };
      return { move:m, ch, j:judge(sp, ch) };
    }).filter(x => x.j);
    if (!judged.length) return null;
    const rank = x => x.j.verdict === 'good' ? 3 : x.j.verdict === 'fine' ? (x.j.confidence === 'close' ? 2 : 1.5) : 0;
    // the judge's own best move, if it's on offer; otherwise the best-judged one
    let want = judged[0].j.best === 'allin' && !moves.includes('allin') ? 'raise' : judged[0].j.best;
    if (want === 'bet') want = moves.includes('raise') ? 'raise' : 'allin';
    if (want === 'raise' && !moves.includes('raise') && moves.includes('allin')) want = 'allin';
    let pick = judged.find(x => x.move === want) || judged.slice().sort((a, b) => rank(b) - rank(a))[0];
    if (want === 'check' && sp.toCall > 0) pick = judged.find(x => x.move === 'fold') || pick;
    const others = judged.filter(x => x !== pick);
    const alt = others.slice().sort((a, b) => rank(b) - rank(a))[0] || null;
    const altRank = alt ? rank(alt) : 0;
    const sure = altRank >= 2 ? 'close' : altRank >= 1.5 ? 'leans' : 'clear';
    const j = pick.j;
    // (checked to you, a raise is a bet)
    const word = m => betting && m === 'raise' ? 'bet' : m;
    return { move:word(pick.move), to: pick.move === 'raise' || pick.move === 'allin' ? pick.ch.amount : null, toBB: pick.ch.toBB,
      sure, alt: alt && altRank >= 1.5 ? word(alt.move) : null, kind:j.kind, lesson:j.lesson, n:j.n, tag:j.tag, judgement:j,
      stories: pre ? null : stories(sp) };
  }

  /* ---------------- a read of the hand as it stands (tap him) ----------------
     Facts only after the flop until the judge learns it (step 3): what you
     have, what you're drawing to and your chance of hitting it, the price. */
  function readNow(sp){
    if (!sp) return null;
    const out = { street:sp.street, toCall:sp.toCall, pot:sp.pot, odds:Math.round(sp.potOdds * 100), hole:sp.holeFacts.name, seat:sp.seat };
    if (sp.street === 'preflop' || !sp.boardFacts) return out;
    const bf = sp.boardFacts, left = sp.board.length === 3 ? 2 : sp.board.length === 4 ? 1 : 0;
    const unseen = 52 - 2 - sp.board.length;
    const hit = o => left === 2 ? 1 - (1 - o / unseen) * (1 - o / (unseen - 1)) : left === 1 ? o / unseen : 0;
    const drawOuts = bf.drawOuts >= 8 && bf.draws.flush && (bf.draws.oesd || bf.draws.gutshot) ? Math.min(15, bf.drawOuts + (bf.draws.oesd ? 6 : 3)) : bf.drawOuts;
    Object.assign(out, { made:bf.made, handName:bf.handName, boardPlays:bf.boardPlays, draws:bf.draws, drawOuts, left,
      hitPct: drawOuts && left ? Math.round(hit(drawOuts) * 100) : 0, threats:bf.threats, texture:bf.texture });
    return out;
  }

  /* ---------------- the hand record ---------------- */
  let hand = null;
  const history = [];
  const emit = (type, detail) => { try{ if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(type, { detail })); }catch(e){} };

  function handStart(g, start){
    if (!(g.handNumber >= 1)){ hand = null; return null; }   // the table before its first deal
    const me = g.players.find(p => p.isHuman);
    hand = { n:g.handNumber, mode:g.mode || null, bigBlind:g.bigBlind || null, startStack:me && start ? start[me.id] : null,
      seat:null, hole:null, decisions:[], end:null };
    return hand;
  }
  function record(sp, g, me){
    if (!sp) return null;
    if (!hand || hand.n !== sp.handNumber) handStart(g, null);
    if (!hand) return null;
    const d = { spot:sp, choice:choice(sp, g, me) };
    try{ d.judgement = judge(sp, d.choice); }catch(e){ d.judgement = null; }
    if (!hand.seat) hand.seat = sp.seat;
    if (!hand.hole) hand.hole = sp.hole;
    hand.decisions.push(d);
    emit('coachdecision', d);
    return d;
  }

  /* An opponent's cards, only when they've been shown at a showdown the
     player can see (everyone still in shows down at the end of the hand).
     The one place the brain reads a hand that isn't yours. */
  function shownAtShowdown(g, me){
    if (g.phase !== 'showdown') return [];
    const shown = g.players.filter(p => p.inHand && !p.folded && !p.eliminated);
    if (shown.length < 2) return [];
    return shown.filter(p => p !== me && p.hand && p.hand.length === 2).map(p => ({
      id:p.id, name:p.name, hole:p.hand.map(card),
      handName: call('describePlayerHand', p.hand, g.board || []) || ''
    }));
  }
  /* Your result the moment the winner is shown, before the pot is paid
     (the pot is only paid when you press COLLECT): the game's own pot split
     (computePots, every side pot) and the hands that were shown, compared
     by the game's evaluator. Everyone folded: the one left takes it all. */
  function settle(g, me){
    if (!g || !me) return null;
    const pots = call('computePots', g.players);
    if (!Array.isArray(pots)) return null;
    const board = g.board || [];
    const shown = shownAtShowdown(g, me);
    const strength = {};
    if (me.inHand && !me.folded && board.length === 5) strength[me.id] = call('evaluate7', me.hand.concat(board));
    shown.forEach(s => { if (board.length === 5) strength[s.id] = call('evaluate7', s.hole.concat(board)); });
    let won = 0;
    for (const pot of pots){
      const elig = pot.eligible || [];
      if (!elig.includes(me.id)) continue;
      let winners;
      if (elig.length === 1) winners = elig;
      else {
        if (elig.some(id => !strength[id])) return null;   // not everything shown yet
        let best = null;
        elig.forEach(id => { if (!best || call('compareHands', strength[id], strength[best]) > 0) best = id; });
        winners = elig.filter(id => call('compareHands', strength[id], strength[best]) === 0);
      }
      if (winners.includes(me.id)) won += Math.floor(pot.amount / winners.length);
    }
    return won - (me.totalBetHand || 0);
  }

  /* How the hand looks now, for its ending. Watched every beat (observe) as
     well as read at the end, because a hand can finish between two looks:
     after you fold, the game fast-forwards the rest. */
  function view(g, me){
    const showdown = g.phase === 'showdown' && me.inHand && !me.folded;
    return {
      phase: g.phase,
      showdown,
      board: (g.board || []).map(card),
      shown: shownAtShowdown(g, me),
      yourHand: showdown ? (call('describePlayerHand', me.hand, g.board || []) || '') : null,
      out: me.chips <= 0
    };
  }
  function observe(g, me){
    if (!g || !me || !hand || hand.n !== g.handNumber) return;
    const v = view(g, me);
    // keep the fullest picture: a showdown's cards stay once they've been seen
    if (hand.seen && hand.seen.shown.length && !v.shown.length) return;
    hand.seen = v;
  }
  function finish(v, net){
    const foldAt = hand.decisions.find(d => d.choice && d.choice.action === 'fold');
    hand.end = Object.assign({
      net: typeof net === 'number' ? net : null,
      result: net > 0 ? 'won' : net < 0 ? 'lost' : 'even',
      folded: !!foldAt, foldedOn: foldAt ? foldAt.spot.street : null
    }, v);
    delete hand.seen;
    history.push(hand);
    while (history.length > HISTORY) history.shift();
    emit('coachhand', hand);
    const done = hand;
    hand = null;
    return done;
  }
  function handEnd(g, me, net){
    if (!me) return null;
    if (!hand || hand.n !== g.handNumber) handStart(g, null);
    if (!hand) return null;
    return finish(view(g, me), net);
  }
  /* A new hand was dealt before the last one was seen to finish: close it
     from what was last seen. net: your stack now, before the new blinds,
     less your stack when it started (exact, whatever was missed). */
  function closeMissed(net){
    if (!hand || hand.end) return null;
    return finish(hand.seen || { phase:null, showdown:false, board:[], shown:[], yourHand:null, out:false }, net);
  }

  return { spot, choice, settle, judge, judgeBet, stories, foldChance, betSize, judgePreflop, judgePostflop, advise, advisePreflop:advise, oppRange, readNow, raiseSize, openRange, pushRange, raiserRange, record, handStart, observe, handEnd, closeMissed, shownAtShowdown, seatLabel, actingAfter,
    get hand(){ return hand; }, get history(){ return history.slice(); }, reset(){ hand = null; history.length = 0; } };
})();
if (typeof window !== 'undefined') window.CoachBrain = CoachBrain;
