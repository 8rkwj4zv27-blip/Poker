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
  const SPOTS = new WeakMap(), ADVICE = new WeakMap(), PRE_EQ = new WeakMap();
  let decisionSerial = 0;
  const freeze = o => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)){
      Object.values(o).forEach(freeze); Object.freeze(o);
    }
    return o;
  };
  // Use the controls' rules, including an exact short-stack endpoint. The
  // fallback lets the isolated brain run without loading the UI/engine.
  function legalTo(sp, amount){
    const b = sp.wager;
    const snapped = call('snapWager', amount, b);
    if (snapped != null) return snapped;
    if (amount <= b.min) return b.min;
    if (amount >= b.max) return b.max;
    return Math.max(b.min, Math.min(b.max, Math.round(amount / b.step) * b.step));
  }

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
  // Completion cards are not winning outs. Count each visible-card-safe
  // flush/straight completion once, and explicitly flag domination risks.
  function drawQuality(hole, board, cls){
    const out = { cards:[], outs:0, uncertain:0, next:0, runout:0, warning:'' };
    if (!cls || board.length < 3 || board.length >= 5) return out;
    const d = cls.draws;
    if (!d.flush && !d.oesd && !d.gutshot) return out;
    const h = hole.map(c => call('cardCode', c)), b = board.map(c => call('cardCode', c));
    const used = new Set(h.concat(b));
    const cat = codes => Math.floor(call('fastScore7', codes) / Math.pow(16, 5));
    for (let c = 0; c < 52; c++){
      if (used.has(c)) continue;
      const nextBoard = b.concat(c), all = h.concat(nextBoard), category = cat(all);
      const flush = d.flush && (category === 5 || category >= 8);
      const straight = (d.oesd || d.gutshot) && (category === 4 || category >= 8);
      if (!flush && !straight) continue;
      // A river straight/flush belonging wholly to the board is no help.
      if (nextBoard.length === 5 && call('fastScore7', nextBoard) === call('fastScore7', all)) continue;
      let uncertain = !!cls.texture.paired;
      if (flush && category < 8){
        const suit = c & 3, mine = h.filter(x => (x & 3) === suit).map(x => x >> 2);
        const high = Math.max(...mine);
        uncertain = uncertain || Array.from({ length:12 - high }, (_, i) => (high + 1 + i) * 4 + suit).some(x => !used.has(x) && x !== c);
      }
      if (straight && !flush){
        const suits = [0,0,0,0]; nextBoard.forEach(x => suits[x & 3]++);
        // A flush can beat a straight; the low end of a run can also lose
        // to a higher straight. These are cautions, not exact dirty-outs.
        let mask = 0; all.forEach(x => { mask |= 1 << (x >> 2); });
        const high = call('straightHighOf', mask);
        const boardRanks = new Set(nextBoard.map(x => x >> 2));
        let higher = false;
        for (let top = high + 1; top <= 12; top++){
          let missing = 0; for (let r = top - 4; r <= top; r++) if (!boardRanks.has(r)) missing++;
          if (missing <= 2) higher = true;
        }
        uncertain = uncertain || Math.max(...suits) >= 3 || higher;
      }
      out.cards.push(c); if (uncertain) out.uncertain++;
    }
    out.outs = out.cards.length;
    const unseen = 52 - used.size;
    out.next = out.outs / unseen;
    // Chance of seeing one of today's completion cards, not final equity:
    // runner-runner improvements and redraws are separate.
    out.runout = board.length === 3 ? 1 - (1 - out.next) * (1 - out.outs / (unseen - 1)) : out.next;
    out.warning = out.uncertain ? 'Some completion cards can still leave you beaten.' : 'Completing the draw is not a guaranteed win.';
    return out;
  }
  function boardFacts(hole, board){
    if (board.length < 3) return null;
    const cls = call('classifyPostflop', hole, board);
    const draws = call('detectDraws', hole, board) || [];
    const outs = call('computeOuts', hole, board);
    const quality = drawQuality(hole, board, cls);
    return {
      handName: call('describePlayerHand', hole, board) || '',
      made: cls ? cls.made : null,
      kicker: cls ? cls.kicker : -1,
      boardPlays: cls ? !!cls.boardPlays : false,
      draws: cls ? Object.assign({}, cls.draws) : {},
      drawList: draws.map(d => ({ kind:d.kind, outs:d.outs })),
      drawOuts: quality.outs,
      drawQuality:quality,
      strengthNote: cls && cls.made === 'top-pair' && cls.kicker >= 0 && cls.kicker <= 7 ? 'Your side card is small: the same pair with a bigger side card beats you.'
        : cls && cls.boardPlays ? 'The shared cards make your best hand too; holding a big-looking hand does not mean you are ahead.' : '',
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
    /* THE PRICE OF A CALL (the audit, 30 Sep 2026): you can only win from
       each player as much as you put in yourself; the rest of a bigger
       stack's all in goes back to them. What a call can win is every chip
       in the pot up to your own total once you've called (the game's
       computePots, the pots you'd be eligible for). */
    const myIn = (me.totalBetHand || 0) + toCall;
    const potWin = g.players.reduce((s, p) => s + Math.min((p.totalBetHand || 0) + (p === me ? toCall : 0), myIn), 0);
    // someone left who could still call a bet or raise of yours
    const othersCanCall = opps.some(p => !p.allIn && p.chips > 0);
    const acts = actionsThisHand(g);
    const seat = seatLabel(g, idx);
    const preflop = g.phase === 'preflop';
    const pf = preflopSituation(g, me, acts);
    const pfAgg = g.pfAggressorId ? g.players.find(p => p.id === g.pfAggressorId) : null;
    const board = (g.board || []).map(card);
    const hole = me.hand.map(card);
    const fullRaise = Math.max((g.currentBet || 0) + (g.minRaise || bb), (me.betThisRound || 0) + bb);
    const maxTo = Math.min(myTotal, biggestOpp <= (g.currentBet || 0) ? (g.currentBet || 0) : Math.max(biggestOpp, fullRaise));
    const wager = call('wagerBounds', g, me) || { min:Math.min(maxTo, fullRaise), max:maxTo, step:bb <= 100 ? 5 : bb <= 500 ? 25 : 50 };
    const prior = handGame === g && hand && hand.n === g.handNumber && hand.decisions.length ? hand.decisions[hand.decisions.length - 1] : null;
    const snapshot = {
      handNumber: g.handNumber,
      street: g.phase,
      mode: g.mode || null,
      heroId:me.id,
      contributions:g.players.map(p => ({ id:p.id, totalBetHand:p.totalBetHand || 0, folded:!!p.folded })),
      previousPlan:prior && prior.recommendation ? { street:prior.spot.street, board:prior.spot.board,
        move:prior.recommendation.move, purpose:prior.recommendation.plan && prior.recommendation.plan.purpose } : null,
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
      // The largest total amount any live opponent can match on this
      // street. Advice uses this as its action cap: covering a short player
      // must never turn "put them all in" into "risk every chip you own".
      effectiveTo: effective,
      // when the stack that makes this hand short is theirs, not yours
      // (you cover them): who, so he says "Lucy only has 7 big blinds"
      // rather than "you're short" to a player with 140
      shortBy: biggestOpp < myTotal && opps.length ? (opps.length === 1 ? opps[0].name : (opps.find(p => p.chips + (p.betThisRound || 0) === biggestOpp) || opps[0]).name) : null,
      shortByOne: opps.length === 1,
      pot, potBB: r1(pot / bb),
      toCall, toCallBB: r1(toCall / bb),
      potWin, potToWin: Math.max(0, potWin - toCall), othersCanCall,
      potOdds: toCall > 0 ? toCall / Math.max(toCall, potWin) : 0,
      spr: pot > 0 ? r1(Math.max(0, effective - (me.betThisRound || 0)) / pot) : null,
      currentBet: g.currentBet || 0,
      minRaise: g.minRaise || bb,
      // (a raise nobody can call is just a call; the engine's own bounds too)
      mayRaise: me.mayRaise !== false && me.chips > toCall && othersCanCall && wager.max > (g.currentBet || 0),
      wager,
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
    const key = JSON.stringify(snapshot), previous = SPOTS.get(g);
    if (previous && previous.key === key) return previous.sp;
    snapshot.decisionId = ++decisionSerial;
    const sp = freeze(snapshot);
    SPOTS.set(g, { key, sp });
    return sp;
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
    // (all in for a lot of big blinds is a strong hand, not a normal raise)
    else if (agg && agg.allIn) r = 0.15;
    else if (raises >= 2) r = RERAISE[Math.min(raises, RERAISE.length - 1)];
    else r = sp.playersDealt === 2 ? OPEN_HEADS_UP * 0.9 : (OPEN_BY_SEAT[agg && agg.seat] || 0.2) * 0.9;
    if (raises <= 1 && sp.currentBet / sp.bigBlind > 4.5 && !(agg && agg.allIn)) r *= 0.75;
    r *= Math.pow(widthOf(agg && agg.read, 'pfr', 0.18), raises <= 1 ? 1 : 0.7);
    return Math.max(0.01, Math.min(1, r));
  }
  // (one estimate per decision and set of ranges: his advice and his verdict
  // on the same decision must agree, even on a borderline hand)
  function equityVs(sp, ranges){
    let memo = PRE_EQ.get(sp);
    if (!memo){ memo = new Map(); PRE_EQ.set(sp, memo); }
    const key = JSON.stringify(ranges);
    if (memo.has(key)) return memo.get(key);
    const eq = call('estimateEquityVsRanges', sp.hole, [], ranges, 1200);
    const result = typeof eq === 'number' ? eq : null;
    memo.set(key, result);
    return result;
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
    const pct = playablePct(sp), f = sp.holeFacts;
    // Covering their entire stack is the same effective commitment as a
    // shove, even though the player's own chips are not all at risk.
    const a = ['raise', 'bet'].includes(ch.action) && ch.amount >= sp.effectiveTo && sp.effectiveTo > sp.currentBet
      ? 'allin' : ch.action;
    const raises = sp.preflop.raises, limpers = sp.preflop.limpers;
    const deepShove = a === 'allin' && sp.effectiveBB > 25;
    const n = { pct:pct100(sp.holeFacts.pct), bb:Math.round(sp.effectiveBB), size:ch.toBB, call:sp.toCall, odds:Math.round(sp.potOdds * 100),
      behind:sp.actingAfter, seat:sp.seat, raiser:sp.pfAggressor ? sp.pfAggressor.name : null, limpers,
      // (short because of them, not you: his lines name them)
      shortOpp: sp.effectiveBB <= 15 && sp.shortBy ? sp.shortBy : null, shortOne: sp.shortByOne };

    /* ---- calling an all in: nothing to raise (the audit, 30 Sep 2026) ----
       Either the call is all your chips, or they're all in and nobody left
       could call a raise. Fold or call is the whole decision (a raise, an
       all in, is only a call), and it's the price against your chance:
       what you put in against what you can win (only what you match). */
    if (sp.toCall > 0 && (sp.toCall >= sp.stack || !sp.othersCanCall)){
      const Rr = raises ? raiserRange(sp) : 1;
      const ranges = raises ? [Rr].concat(Array.from({ length:sp.preflop.callers }, () => Math.min(1, Rr * 1.6))) : [1];
      const eq = equityVs(sp, ranges);
      if (eq == null) return null;
      // nearly out: fold, and the blinds take the rest soon anyway
      const nearlyOut = sp.toCall >= sp.stack && sp.stackBB <= 3;
      const need = sp.potOdds - (nearlyOut ? 0.04 : 0);
      const margin = eq - need;
      Object.assign(n, { eq:pct100(eq), need:pct100(Math.max(0.01, need)), call:sp.toCall, win:sp.potWin, margin:Math.round(margin * 100),
        lastChips: sp.toCall >= sp.stack, nearlyOut, raiser: n.raiser || (sp.opponents.find(o => o.allIn) || {}).name || null });
      const base = { kind:'allcall', best: margin >= 0 ? 'call' : 'fold', lesson:'pot-odds', n };
      if (a === 'fold'){
        // (his chance of winning is an estimate against what an all in usually
        // means: within 5 points either way, it's close, and he says so)
        if (margin <= -0.05) return J(Object.assign(base, { verdict:'good', confidence: margin < -0.10 ? 'clear' : 'leans', tag:'allcall.fold.good' }));
        if (margin < 0.05) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'allcall.fold.close' }));
        return J(Object.assign(base, { verdict:'mistake', confidence: margin > 0.12 ? 'clear' : 'leans', tag:'allcall.fold.missed', notable:true }));
      }
      if (a === 'call' || a === 'allin' || a === 'raise'){
        if (margin >= 0.03) return J(Object.assign(base, { verdict:'good', confidence: margin > 0.08 ? 'clear' : 'leans', tag:'allcall.call.good', notable: margin > 0.08 }));
        if (margin > -0.05) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'allcall.call.close' }));
        return J(Object.assign(base, { verdict:'mistake', confidence: margin < -0.12 ? 'clear' : 'leans', tag:'allcall.call.bad', notable:true }));
      }
      return null;
    }

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
      // (all in, when his own raise would have been most of your chips
      // anyway, is just that raise)
      if (a === 'allin' && !short && sp.stack + sp.yourBet > raiseSize(sp) * 1.35){
        if (eq >= 0.65) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'reraise.shove.big', lesson:'three-bet', notable:true }));
        return J(Object.assign(base, { verdict:'mistake', confidence: eq < 0.5 ? 'clear' : 'leans', tag:'reraise.shove.loose', lesson:'three-bet', notable:true }));
      }
      if (short){
        if (eq >= 0.48) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'short.reshove.good', lesson:'short-stack', notable:true }));
        if (eq >= 0.42) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'short.reshove.close', lesson:'short-stack' }));
        return J(Object.assign(base, { verdict:'mistake', confidence: eq < 0.35 ? 'clear' : 'leans', tag:'short.reshove.loose', lesson:'short-stack', notable:true }));
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
  const VALUE_RANGES = new WeakMap(), VALUE_CALLS = new WeakMap(), POT_READS = new WeakMap(), CONTINUATIONS = new WeakMap();
  function potAssessment(sp){
    if (POT_READS.has(sp)) return POT_READS.get(sp);
    // Use the engine's own contribution layers, including folded money.
    // A short caller cannot win unmatched chips or other players' side pots.
    const accounted = sp.contributions.reduce((s, p) => s + p.totalBetHand, 0);
    if (Math.abs(accounted - sp.pot) > 0.01) return null; // synthetic/incomplete state
    const projected = sp.contributions.map(p => Object.assign({}, p, { totalBetHand:p.totalBetHand + (p.id === sp.heroId ? sp.toCall : 0) }));
    const layers = call('computePots', projected);
    if (!layers) return null;
    const eligible = layers.filter(p => p.eligible.includes(sp.heroId));
    let total = 0, value = 0;
    const cache = new Map();
    const reads = eligible.map(p => {
      const rivals = sp.opponents.filter(o => p.eligible.includes(o.id));
      const key = rivals.map(o => o.id).sort().join('|');
      let eq = cache.get(key);
      if (eq == null){ eq = rivals.length ? call('estimateEquityVsRanges', sp.hole, sp.board, rivals.map(o => oppRange(sp, o)), 1500) : 1; cache.set(key, eq); }
      total += p.amount; value += p.amount * eq;
      return { amount:p.amount, opponentIds:rivals.map(o => o.id), equity:eq, committed:rivals.filter(o => o.allIn).map(o => o.id) };
    });
    const out = { layers:reads, available:total, excluded:sp.pot + sp.toCall - total, equity:total ? value / total : 0,
      odds:total ? sp.toCall / total : 1, callValue:value - sp.toCall,
      complex:eligible.length > 1 || sp.pot + sp.toCall - total > 0,
      note:eligible.length > 1 || sp.pot + sp.toCall - total > 0 ? 'Only pots you can win count toward the price; each has its own opponents.' : '' };
    POT_READS.set(sp, out); return out;
  }
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
    const cap = Math.min(allin, sp.effectiveTo || allin);
    const legal = Math.max(to, sp.currentBet + sp.minRaise);
    // Commit only when the amount that can actually be matched is already
    // small beside the pot after calling. The old 45%-of-stack shortcut
    // produced theatrical shoves without asking whether a smaller raise
    // could be paid by worse hands.
    const potAfterCall = sp.pot + sp.toCall;
    if (cap > sp.currentBet && cap - sp.yourBet <= potAfterCall * 0.85) return legalTo(sp, cap);
    return legalTo(sp, Math.min(cap, legal));
  }
  function drawPrice(sp, eq){
    const bf = sp.boardFacts, q = bf && bf.drawQuality;
    const runout = sp.toCall >= sp.stack || sp.opponents.every(o => o.allIn || o.chips <= 0);
    const deep = sp.stack - sp.toCall > 1.5 * (sp.pot + sp.toCall);
    const nut = bf && bf.draws.nutFlush && q && !q.uncertain;
    // Potential future payment is a capped assumption, never free equity.
    // Discount vulnerable completions; an overcard is only half an out
    // because pairing it need not beat the bettor.
    const implied = !runout && deep && q && q.outs >= 8 ? (nut ? 0.05 : 0.02) : 0;
    const over = bf && bf.made === 'nothing' ? sp.hole.filter(c => c.value > Math.max(...sp.board.map(b => b.value))).length : 0;
    const oneCard = q ? Math.max(0, q.next - q.uncertain / (52 - 2 - sp.board.length) * 0.25) + over * 1.5 / (52 - 2 - sp.board.length) : 0;
    const usable = runout ? eq : Math.min(eq * (sp.actingAfter === 0 ? 0.97 : 0.9), oneCard);
    return { runout, implied, usable, next:q ? q.next : 0, runoutHit:q ? q.runout : 0,
      text:runout ? 'This call commits the matched chips, so the remaining cards are included in the price.'
        : 'This call buys the next card, not a free ride to the river.' + (implied ? ' Some later payment is assumed, not promised.' : '') };
  }
  function judgePostflop(sp, ch){
    if (!sp || !ch || sp.street === 'preflop' || !ch.action || !sp.boardFacts) return null;
    if (sp.toCall <= 0) return null;   // betting when checked to: step 3b
    let a = ch.action;
    if (a === 'allin') a = sp.toCall >= sp.stack ? 'call' : 'raise';
    if (a === 'raise' && !sp.othersCanCall) a = 'call';   // (nobody left could call a raise)
    if (a === 'check') a = 'call';
    const bf = sp.boardFacts, left = 5 - sp.board.length;
    // (one sample per decision: advice judges every move on the same spot)
    let eq = postEquity(sp);
    if (typeof eq !== 'number') return null;
    const strongDraw = left > 0 && (bf.draws.flush || bf.draws.oesd);
    const anyDraw = left > 0 && (strongDraw || bf.draws.gutshot);
    const madeWeak = !MADE_OK[bf.made];
    const ip = sp.actingAfter === 0;
    const realise = left === 0 ? 1 : (ip ? 0.97 : 0.9) - (madeWeak && !anyDraw ? 0.05 : 0);
    const behind = Math.max(0, sp.stack - sp.toCall);
    const deep = behind > 1.5 * (sp.pot + sp.toCall);
    const price = drawPrice(sp, eq);
    const implied = anyDraw && madeWeak ? price.implied : !deep ? 0 : strongDraw ? (left === 1 ? 0.05 : 0.03) : anyDraw ? 0.02 : 0;
    const pots = potAssessment(sp), odds = pots ? pots.odds : sp.potOdds;
    const need = odds + (sp.playersIn > 2 && sp.actingAfter > 0 ? 0.03 : 0) - implied;
    const usable = anyDraw && madeWeak ? price.usable : eq * realise;
    const margin = usable - need;
    const multi = sp.playersIn > 2;
    // raising for value needs a hand that's ahead of the hands that CALL a
    // raise, not just of the betting range: two pair or better. Top pair and
    // overpairs are ahead of a bet but behind most calls of a raise: they
    // call (a raise is fine, to protect, but close).
    const strongMade = STRONG_MADE[bf.made] && !bf.boardPlays;
    const ahead = eq >= (multi ? 0.55 : 0.70) && !(anyDraw && madeWeak);
    const raisePlan = strongMade && ahead ? valueRaiseAssessment(sp) : null;
    const value = strongMade && ahead && (!raisePlan.supported || raisePlan.value);
    const bettorAct = sp.actions.filter(x => x.street === sp.street && (x.action === 'bet' || x.action === 'raise')).pop();
    const betFrac = sp.toCall / Math.max(1, sp.pot - sp.toCall);
    const unseen = 52 - 2 - sp.board.length;
    const drawName = bf.draws.flush && (bf.draws.oesd || bf.draws.gutshot) ? 'a flush and straight draw' : bf.draws.flush ? 'a flush draw' : bf.draws.oesd ? 'an open-ended straight draw' : bf.draws.gutshot ? 'an inside straight draw' : '';
    const n = { street:sp.street, eq:pct100(anyDraw && madeWeak ? usable : eq), runoutEq:pct100(eq),
      need:pct100(Math.max(0.01, need) / (anyDraw && madeWeak ? 1 : realise)), odds:Math.round(odds * 100), call:sp.toCall, pot:sp.potToWin,
      pots, potNote:pots ? pots.note : '', raisePlan,
      valueTargets:raisePlan && raisePlan.continuation ? raisePlan.continuation.targetText : 'weaker made hands',
      handName:bf.handName, made:bf.made, drawName, outs:bf.drawOuts, hitNext: bf.drawOuts ? Math.round(bf.drawOuts / unseen * 100) : 0,
      drawPriceText:price.text, drawWarning:bf.drawQuality.warning, drawPrice:price,
      bettor: bettorAct ? bettorAct.name : 'they', betSize:BET_WORD(betFrac), margin:Math.round(margin * 100), players:sp.playersIn - 1,
      implied:Math.round(implied * 100), seat:sp.seat, pct:pct100(sp.holeFacts.pct) };
    const river = left === 0;
    const lesson = river ? 'river-bets' : anyDraw && madeWeak ? 'drawing-odds' : 'pot-odds';
    const best = value ? 'raise' : margin >= 0 ? 'call' : 'fold';
    const base = { kind:'post', best, lesson, n };
    if (a === 'fold'){
      if (value || ahead) return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:'post.fold.strong', lesson:'hand-strength', notable:true }));
      if (margin <= 0) return J(Object.assign(base, { verdict:'good', confidence: margin < -0.05 ? 'clear' : 'close', tag:anyDraw && madeWeak ? 'post.fold.draw.good' : 'post.fold.good',
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
      if (value){
        const target = postRaiseSize(sp), invested = Math.max(0, ch.amount - sp.yourBet);
        Object.assign(n, { to:target, sizeWords:sizeWords(Math.max(0, target - sp.yourBet) / Math.max(1, sp.pot)) });
        if (ch.amount > target && invested > Math.max(1, target - sp.yourBet) * 1.6)
          return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'post.raise.value.large', lesson:'raising-for-value', notable:true }));
        return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'post.raise.value', lesson:'raising-for-value', notable:true }));
      }
      if (ahead) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'post.raise.protect', lesson:'hand-strength' }));
      // (a raise that's all your chips, with a draw: only when it pays)
      const allIn = ch.action === 'allin' || (ch.amount != null && ch.amount >= sp.stack + sp.yourBet);
      const heavy = Math.max(0, ch.amount - sp.yourBet) >= Math.max(1, effectiveActionCap(sp) - sp.yourBet) * 0.4;
      if (strongDraw && (allIn || heavy)){
        const bluff = bluffAssessment(sp, ch.amount, true);
        const sh = multi ? { ok:false, close:false } : drawShove(sp, eq, bluff.folds);
        n.bluffPlan = bluff;
        Object.assign(n, { whole:sh.whole, risk:sh.risk });
        if (!sh.ok && !sh.close) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:allIn ? 'post.raise.semi.shove' : 'post.raise.semi.heavy', lesson:'draw-shove', notable:true }));
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
  const sizeWords = f => f < 0.12 ? 'a small part of the pot' : f < 0.27 ? 'about a quarter of the pot'
    : f < 0.43 ? 'about a third of the pot' : f < 0.58 ? 'about half the pot'
    : f < 0.78 ? 'about two-thirds of the pot' : f < 1.08 ? 'about the size of the pot' : 'more than the pot';
  const roundBet = (sp, amount) => {
    const step = Math.max(1, sp.bigBlind / 2);
    return Math.max(sp.bigBlind, Math.round(amount / step) * step);
  };
  function effectiveActionCap(sp){
    return Math.max(sp.yourBet, Math.min(sp.stack + sp.yourBet, sp.effectiveTo || (sp.stack + sp.yourBet)));
  }
  function postEquity(sp){
    let eq = EQ.get(sp);
    if (eq == null){ const pots = potAssessment(sp); eq = pots ? pots.equity : call('estimateEquityVsRanges', sp.hole, sp.board, sp.opponents.map(o => oppRange(sp, o)), 1500); EQ.set(sp, eq); }
    return eq;
  }

  // Public, blocker-aware combinations, not an opponent's actual cards.
  // Current made strength is exact; future runout equity is NOT inferred
  // from it. Only river, last-to-act estimates below select a new size.
  function valueRange(sp){
    if (VALUE_RANGES.has(sp)) return VALUE_RANGES.get(sp);
    if (sp.opponents.length !== 1 || sp.opponents[0].allIn || sp.opponents[0].chips <= 0) return null;
    const o = sp.opponents[0], raw = oppRange(sp, o), spec = typeof raw === 'number' ? { pct:raw } : raw;
    const combos = call('comboOrder'), hole = sp.hole.map(c => call('cardCode', c)), board = sp.board.map(c => call('cardCode', c));
    if (!combos || board.length < 3) return null;
    const dead = new Set(hole.concat(board)), mine = call('fastScore7', hole.concat(board));
    const count = Math.max(1, Math.min(combos.length, Math.round(combos.length * spec.pct)));
    const rows = [];
    for (let i = 0; i < count; i++){
      const combo = combos[i]; if (dead.has(combo[0]) || dead.has(combo[1])) continue;
      const codes = [combo[0], combo[1]], cls = call('classifyCodes', codes, board);
      if (!cls) continue;
      const weight = spec.hist && spec.hist.length ? call('narrowWeight', codes, board, spec.hist, spec.bluff || 1, spec.k || 0) : 1;
      if (!(weight > 0)) continue;
      const score = call('fastScore7', codes.concat(board));
      const draw = board.length < 5 && (cls.draws.flush || cls.draws.oesd || cls.draws.gutshot);
      const bucket = STRONG_MADE[cls.made] ? 'strong' : cls.made === 'overpair' || cls.made === 'top-pair' ? 'top'
        : cls.made === 'second-pair' ? 'middle' : cls.made === 'weak-pair' ? 'weak' : draw ? 'draw' : 'air';
      const target = draw ? (cls.made !== 'nothing' ? 'pairs with draws' : cls.draws.flush ? 'flush draws' : 'straight draws') : bucket === 'strong' ? 'weaker made hands'
        : bucket === 'top' ? 'weaker top pairs' : bucket === 'middle' || bucket === 'weak' ? 'smaller pairs' : 'unpaired hands';
      rows.push({ codes, weight, share:score < mine ? 1 : score === mine ? 0.5 : 0, bucket, draw:!!draw, target });
    }
    const result = { rows, opponent:o, habit:storyOf(sp, o).habit, total:rows.reduce((s, row) => s + row.weight, 0) };
    VALUE_RANGES.set(sp, result);
    return result;
  }
  function continuationRate(row, frac, habit, raising){
    const base = { strong:.94, top:.8, middle:.6, weak:.4, draw:.6, air:.1 }, sensitivity = { strong:.12, top:.55, middle:1.35, weak:1.8, draw:.95, air:2.8 };
    const caller = habit === 'caller', tight = habit === 'tight';
    const start = Math.min(.98, base[row.bucket] + (caller && row.bucket !== 'strong' ? .18 : 0));
    return clampR(start * Math.exp(-sensitivity[row.bucket] * Math.max(0, frac - .25) * (caller ? .45 : tight ? 1.35 : 1))
      * (raising && row.bucket !== 'strong' ? (row.bucket === 'top' || row.draw ? .65 : .4) : 1), 0, .98);
  }
  function valueContinuation(sp, to, raising){
    let memo = VALUE_CALLS.get(sp);
    if (!memo){ memo = new Map(); VALUE_CALLS.set(sp, memo); }
    const key = to + (raising ? ':raise' : ':bet');
    if (memo.has(key)) return memo.get(key);
    const range = valueRange(sp); if (!range || !range.total) return null;
    const risk = Math.max(0, Math.min(to, effectiveActionCap(sp)) - sp.yourBet);
    const frac = risk / Math.max(1, sp.pot);
    // Explicit teaching heuristic, not fitted solver probabilities. Larger
    // bets retain stronger hands and lose more marginal calls. Observed
    // callers are less size-sensitive; sparse reads use the neutral prior.
    let calls = 0, shares = 0, worse = 0, checkShare = 0, result = 0;
    const targets = {};
    range.rows.forEach(row => {
      const rate = continuationRate(row, frac, range.habit, raising);
      const paid = row.weight * rate;
      calls += paid; shares += paid * row.share; checkShare += row.weight * row.share;
      if (row.share === 1){ worse += paid; targets[row.target] = (targets[row.target] || 0) + paid; }
      const theirRisk = Math.min(range.opponent.chips, Math.max(0, to - range.opponent.bet));
      result += row.weight * ((1 - rate) * sp.pot + rate * (row.share * (sp.pot + risk + theirRisk) - risk));
    });
    const names = Object.keys(targets).filter(k => k !== 'unpaired hands' && targets[k] >= worse * 0.12)
      .sort((a, b) => targets[b] - targets[a]).slice(0, 2);
    const river = sp.board.length === 5;
    const out = { to, risk, estimatedCallRate:calls / range.total, worseCallShare:calls ? worse / calls : 0,
      calledMadeShare:calls ? shares / calls : 0, targets:names, targetText:names.join(' and ') || 'a few weaker hands',
      // On earlier streets this is made strength, never a draw's win chance.
      estimatedRiverValue:river ? result / range.total : null,
      checkToShowdownValue:river ? checkShare / range.total * sp.pot : null,
      confidence:'leans', model:'public-range/heuristic-calls', combos:range.rows.length };
    memo.set(key, out); return out;
  }
  // Sample future cards against the hands estimated to continue. This is
  // runout equity, NOT a promise that today's bet buys those cards for free.
  function continuationEquity(sp, to, raising){
    let memo = CONTINUATIONS.get(sp); if (!memo){ memo = new Map(); CONTINUATIONS.set(sp, memo); }
    const key = to + (raising ? ':raise' : ':bet'); if (memo.has(key)) return memo.get(key);
    const range = valueRange(sp), current = valueContinuation(sp, to, raising);
    if (!range || !current) return null;
    if (sp.board.length === 5) return { equity:current.calledMadeShare, samples:0, horizon:'showdown' };
    const h = sp.hole.map(c => call('cardCode', c)), b = sp.board.map(c => call('cardCode', c));
    const frac = current.risk / Math.max(1, sp.pot);
    let total = 0;
    const rows = range.rows.map(r => {
      total += r.weight * continuationRate(r, frac, range.habit, raising);
      return { codes:r.codes, ceiling:total }; });
    let wins = 0;
    for (let n = 0; n < 400; n++){
      const target = Math.random() * total; let lo = 0, hi = rows.length - 1;
      while (lo < hi){ const mid = (lo + hi) >> 1; if (rows[mid].ceiling < target) lo = mid + 1; else hi = mid; }
      const rival = rows[lo].codes, used = new Set(h.concat(b, rival)), run = b.slice();
      while (run.length < 5){ const c = Math.floor(Math.random() * 52); if (!used.has(c)){ used.add(c); run.push(c); } }
      const mine = call('fastScore7', h.concat(run)), theirs = call('fastScore7', rival.concat(run));
      wins += mine > theirs ? 1 : mine === theirs ? .5 : 0;
    }
    const out = { equity:wins / 400, samples:400, horizon:'runout', futurePrice:'Further bets and redraws can change the value of continuing.' };
    memo.set(key, out); return out;
  }
  function valueRaiseAssessment(sp){
    const to = postRaiseSize(sp), continuation = valueContinuation(sp, to, true), runout = continuationEquity(sp, to, true);
    return { to, continuation, runout, supported:!!runout, value:!!runout && runout.equity >= 0.55,
      note:'A value raise needs to beat the hands that call the raise, not just the hands that bet.' };
  }

  /* A value plan, rather than one stock amount. It distinguishes quiet
     boards (keep weaker hands in), draw-heavy boards (charge the next card),
     habitual callers (ask for more), and shallow pots (there may only be one
     meaningful bet left). The alternatives are kept on the advice record for
     the coming hand breakdown; no extra UI is introduced here. */
  function valueBetPlan(sp, eq){
    const bf = sp.boardFacts || {}, tex = bf.texture || {}, river = sp.board.length === 5;
    const multi = sp.opponents.length > 1, made = bf.made;
    const monster = !!STRONG_MADE[made] && !bf.boardPlays;
    const onePair = (made === 'overpair' || made === 'top-pair') && !bf.boardPlays;
    const caller = sp.opponents.some(o => storyOf(sp, o).habit === 'caller');
    const tight = sp.opponents.length === 1 && storyOf(sp, sp.opponents[0]).habit === 'tight';
    const wet = (tex.wet || 0) >= 0.45;
    let frac = 0.5, purpose = 'get-paid', next = 'If they call, reassess their range on the next card.';

    if (!river && monster && !wet && !multi){
      frac = 0.38; purpose = 'keep-worse-in';
      next = 'If they call, keep building unless the next card completes an obvious draw.';
    } else if (!river && wet){
      frac = caller ? 0.75 : 0.66; purpose = 'charge-draws';
      next = 'If a likely draw completes, slow down; otherwise keep betting for value.';
    } else if (river){
      frac = caller ? 0.8 : tight ? 0.45 : monster ? 0.66 : 0.6;
      purpose = caller ? 'ask-caller-more' : 'get-paid';
      next = 'This is the last card: choose the largest amount worse hands will still call.';
    } else if (onePair){
      frac = caller ? 0.66 : 0.5; purpose = caller ? 'ask-caller-more' : 'get-paid';
      next = 'If they call, keep weaker pairs and draws in mind before betting again.';
    } else if (monster){
      frac = caller ? 0.72 : 0.55;
    }
    if (multi) frac = Math.min(0.75, frac + (wet ? 0.08 : 0.05));

    const cap = effectiveActionCap(sp);
    const risk = Math.max(0, cap - sp.yourBet);
    const shallow = risk <= sp.pot * 0.9;
    const strongEnough = monster || (onePair && eq >= (multi ? 0.72 : 0.68));
    const shove = shallow && strongEnough;
    // A capped ordinary bet must not silently become a commitment which
    // this very plan considers too large. Leave a genuine smaller option
    // where the legal minimum allows it.
    let target = shove ? cap : Math.min(cap, roundBet(sp, sp.pot * frac));
    if (!shove && target >= cap && sp.wager.min < cap) target = Math.max(sp.wager.min, roundBet(sp, risk * 0.5) + sp.yourBet);
    let to = legalTo(sp, target);
    if (shove){
      purpose = 'commit-shallow';
      next = 'The pot is already large beside the chips left, so there is no useful smaller street plan.';
    }
    const alternatives = [0.33, 0.5, 0.66, 0.85].map(f => ({ frac:f, to:legalTo(sp, Math.min(cap, roundBet(sp, sp.pot * f))) }))
      .filter((x, i, a) => x.to > sp.yourBet && a.findIndex(y => y.to === x.to) === i);
    if (!alternatives.some(x => x.to === legalTo(sp, cap))) alternatives.push({ frac:sp.pot ? risk / sp.pot : 0, to:legalTo(sp, cap), allin:true });
    alternatives.forEach(x => { x.continuation = valueContinuation(sp, x.to); });
    // Last to act on the river: no later card or later street has to be
    // invented. Deep all-in tails remain diagnostic, not recommendations.
    if (river && sp.actingAfter === 0 && !multi && !shove){
      const ordinary = alternatives.filter(x => !x.allin && x.to < cap && x.continuation && x.continuation.worseCallShare > 0.5);
      const current = valueContinuation(sp, to);
      const best = ordinary.slice().sort((a, b) => b.continuation.estimatedRiverValue - a.continuation.estimatedRiverValue)[0];
      if (best && current && (current.calledMadeShare <= 0.5 || best.continuation.estimatedRiverValue > current.estimatedRiverValue + sp.pot * 0.03)) to = best.to;
    }
    const continuation = valueContinuation(sp, to);
    const runout = continuationEquity(sp, to, false);
    const actualFrac = sp.pot > 0 ? Math.max(0, to - sp.yourBet) / sp.pot : 0;
    return { to, frac:actualFrac, targetFrac:frac, cap, shove, purpose, next, alternatives, continuation, runout, words:sizeWords(actualFrac) };
  }
  function betSize(sp){
    const bf = sp.boardFacts || {}, eq = postEquity(sp);
    const strongMade = STRONG_MADE[bf.made] && !bf.boardPlays;
    const goodMade = MADE_OK[bf.made] && !bf.boardPlays;
    const multi = sp.opponents.length > 1;
    const valueHand = typeof eq === 'number' && ((strongMade && eq >= 0.55) || (goodMade && eq >= (multi ? 0.60 : 0.55)));
    if (valueHand){ const plan = valueBetPlan(sp, eq); return { to:plan.to, frac:plan.frac, plan }; }
    const frac = sp.board.length === 5 || (bf.texture && bf.texture.wet >= 0.45) ? 0.66 : 0.5;
    const cap = effectiveActionCap(sp);
    const to = legalTo(sp, Math.min(cap, roundBet(sp, sp.pot * frac)));
    return { to, frac:sp.pot ? Math.max(0, to - sp.yourBet) / sp.pot : frac, plan:null };
  }
  function foldChance(sp){
    // each opponent: their habit of folding to bets (smoothed toward 45%),
    // more likely after checking this hand; everyone has to fold
    return sp.opponents.reduce((acc, o) => {
      if (o.allIn || o.chips <= 0) return 0; // committed chips cannot fold
      const r = o.read || {};
      const base = ((r.foldedToBet || 0) + 0.45 * 6) / ((r.facedBet || 0) + 6);
      const checked = sp.handLog.some(h => h.id === o.id && h.a === 'k') && !sp.handLog.some(h => h.id === o.id && (h.a === 'b' || h.a === 'r' || h.a === 'c'));
      return acc * clampR(base * (checked ? 1.15 : 1), 0.05, 0.85);
    }, 1);
  }
  function bluffAssessment(sp, to, raising){
    const risk = Math.max(0, to - sp.yourBet), frac = risk / Math.max(1, sp.pot);
    const st = stories(sp), range = valueContinuation(sp, to);
    let folds = foldChance(sp);
    // A larger amount does not earn unlimited credibility. Range evidence
    // can lower the behavioural estimate, but never turn it into certainty.
    folds *= clampR(1 + (frac - 0.5) * 0.25, 0.85, 1.15);
    if (range) folds = Math.min(folds, 1 - range.estimatedCallRate);
    if (raising) folds *= 0.6;
    if (st.list.some(o => o.kind === 'strong' || o.kind === 'turned')) folds *= 0.8;
    let blocker = '';
    if (sp.board.length === 5){
      const suits = {}; sp.board.forEach(c => { suits[c.suit] = (suits[c.suit] || 0) + 1; });
      const nutSuit = Object.keys(suits).find(s => suits[s] >= 3 && sp.hole.some(c => c.suit === s && c.value === 14));
      const missedSuit = Object.keys(suits).find(s => suits[s] === 2 && sp.hole.every(c => c.suit === s));
      if (nutSuit){ folds += 0.04; blocker = 'Your ace removes some of their strongest flushes, but does not prove they will fold.'; }
      else if (missedSuit){ folds -= 0.04; blocker = 'Your missed draw removes some missed draws they might otherwise fold.'; }
    }
    if (sp.opponents.some(o => o.allIn || o.chips <= 0)) folds = 0;
    folds = clampR(folds, 0, 0.85);
    const pots = potAssessment(sp);
    const stealablePot = pots && sp.toCall === 0 ? pots.layers.filter(p => !p.committed.length && p.opponentIds.length).reduce((s, p) => s + p.amount, 0)
      : sp.opponents.some(o => o.allIn) ? 0 : sp.pot;
    return { risk, breakEven:risk / Math.max(1, sp.pot + risk), folds, blocker, stealablePot,
      model:'public-story/size-sensitive-heuristic', raising:!!raising };
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
    const other = sp.toCall > 0 ? Math.max(0, eq * 0.9 * (sp.potWin || sp.pot + sp.toCall) - sp.toCall) : eq * 0.9 * sp.pot;
    const whole = risk >= sp.stack;
    const edge = shove - other - (whole ? (sp.mode === 'cash' ? 0.1 : 0.15) * sp.pot : 0);
    return { ok: edge >= 0, close: Math.abs(edge) < 0.1 * sp.pot, whole, risk };
  }
  function judgeBet(sp, ch){
    if (!sp || !ch || sp.street === 'preflop' || !sp.boardFacts || sp.toCall > 0) return null;
    let a = ch.action;
    if (a === 'allin' || a === 'raise') a = 'bet';
    if (a === 'call') a = 'check';
    const bf = sp.boardFacts, left = 5 - sp.board.length;
    let eq = postEquity(sp);
    if (typeof eq !== 'number') return null;
    const opps = sp.opponents.length, multi = opps > 1;
    const strongMade = STRONG_MADE[bf.made] && !bf.boardPlays;
    const goodMade = MADE_OK[bf.made] && !bf.boardPlays;
    const valueHand = (strongMade && eq >= 0.55) || (goodMade && eq >= (multi ? 0.60 : 0.55));
    const strongDraw = left > 0 && (bf.draws.flush || bf.draws.oesd) && !goodMade;
    const medium = !valueHand && !strongDraw && (goodMade || bf.made === 'second-pair' || bf.made === 'weak-pair' || eq >= 0.45);
    const size = betSize(sp);
    const investment = Math.max(0, (a === 'bet' ? ch.amount : size.to) - sp.yourBet);
    const bluffNeed = investment / Math.max(1, sp.pot + investment);
    const bluff = bluffAssessment(sp, a === 'bet' ? ch.amount : size.to, false), fe = bluff.folds;
    const st = stories(sp);
    const station = sp.opponents.some(o => storyOf(sp, o).habit === 'caller');
    const river = left === 0;
    const drawName = bf.draws.flush && (bf.draws.oesd || bf.draws.gutshot) ? 'a flush and straight draw' : bf.draws.flush ? 'a flush draw' : bf.draws.oesd ? 'an open-ended straight draw' : bf.draws.gutshot ? 'an inside straight draw' : '';
    const n = { street:sp.street, eq:pct100(eq), handName:bf.handName, made:bf.made, drawName, outs:bf.drawOuts,
      players:opps, opp: st.one ? st.one.name : null, story:st.all, habit: st.one ? st.one.habit : null,
      fold:Math.round(fe * 100), foldNeed:Math.round(bluffNeed * 100), to:size.to, sizeWords:sizeWords(size.frac),
      bluffPlan:bluff, blockerNote:bluff.blocker,
      betSize: ch.potFraction == null ? '' : BET_WORD(ch.potFraction), pot:sp.pot, seat:sp.seat, pct:pct100(sp.holeFacts.pct) };
    const pots = potAssessment(sp);
    n.pots = pots; n.potNote = pots ? pots.note : '';
    if (sp.opponents.some(o => o.allIn)) n.potNote += ' A committed player cannot fold; a bet cannot steal their pot.';
    if (size.plan) Object.assign(n, { purpose:size.plan.purpose, planTo:size.plan.to, next:size.plan.next, targetFrac:Math.round(size.plan.targetFrac * 100),
      valueTargets:size.plan.continuation ? size.plan.continuation.targetText : 'weaker hands' });
    // (how often they fold is an estimate, so a bluff is never clear-cut:
    // it needs a real margin to be good, and even then it leans)
    const bluffGood = !multi && !station && fe >= bluffNeed + 0.08;
    const bluffClose = !multi && !station && fe >= bluffNeed - 0.04;
    // a draw, where the bet is all your chips (his own size, or yours)
    const allinTo = sp.stack + sp.yourBet;
    const allIn = ch.action === 'allin' || (ch.amount != null && ch.amount >= allinTo);
    const shove = strongDraw ? drawShove(sp, eq, fe) : null;
    // A nominally "smaller" draw bet can still consume most of what is
    // left and leave an automatic river call. Keep the conservative shove
    // check when the suggested bet uses 40%+ of the effective chips.
    const capLeft = Math.max(1, effectiveActionCap(sp) - sp.yourBet);
    const heavyDrawBet = Math.max(0, size.to - sp.yourBet) >= capLeft * 0.4;
    const drawBet = strongDraw && !multi && !station && (fe >= bluffNeed || eq >= 0.5) && (!heavyDrawBet || shove.ok);
    if (shove) Object.assign(n, { whole:shove.whole, risk:shove.risk });
    const best = valueHand && size.plan && size.plan.shove ? 'allin'
      : valueHand || drawBet || (!medium && !strongDraw && bluffGood) ? 'bet' : 'check';
    const base = { kind:'bet', best, n };
    if (a === 'fold') return J(Object.assign(base, { verdict:'mistake', confidence:'clear', tag:'bet.fold.free', lesson:'the-basics', notable:true }));
    if (a === 'check'){
      if (valueHand){
        const clear = river && (strongMade || eq >= 0.8);
        return J(Object.assign(base, { verdict:'mistake', confidence: clear ? 'clear' : 'leans', tag:'bet.missed', lesson:'value-betting', notable:true }));
      }
      if (medium) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'bet.check.medium', lesson:'pot-control' }));
      // (his bet would have been all your chips, and that doesn't pay: checking's right)
      if (strongDraw && !multi && !drawBet) return J(Object.assign(base, { verdict:'good', confidence: shove.close ? 'close' : 'leans', tag:heavyDrawBet ? 'bet.check.draw.deep' : 'bet.check.draw', lesson:'semi-bluff' }));
      if (strongDraw) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'bet.check.draw', lesson:'semi-bluff', notable:!multi }));
      if (bluffGood) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'bet.bluff.chance', lesson:'bluffing', notable:true }));
      return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'bet.check.weak', lesson:'bluffing' }));
    }
    // a bet
    if (valueHand){
      const plan = size.plan || valueBetPlan(sp, eq);
      const actual = ch.potFraction == null ? 0 : ch.potFraction;
      const effectiveShove = ch.amount != null && ch.amount >= plan.cap - 0.001;
      const forcedMinimum = sp.wager.min >= plan.cap && ch.amount <= sp.wager.min;
      if (effectiveShove && (plan.shove || forcedMinimum)) return J(Object.assign(base, { verdict:'good', confidence:'clear', tag:'bet.value.commit', lesson:'value-betting', notable:true }));
      if (effectiveShove && !plan.shove){
        // With one pair an unnecessary shove is usually losing calls from
        // exactly the hands value wants. Monsters retain enough equity that
        // the idea is fine, but the amount is still worth correcting.
        return J(Object.assign(base, { verdict:goodMade && !strongMade ? 'mistake' : 'fine', confidence:'leans', tag:'bet.value.shove', lesson:'value-betting', notable:true }));
      }
      if (ch.amount !== plan.to && actual < Math.max(0.18, plan.frac - 0.2)) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'bet.value.small', lesson:'value-betting', notable:true }));
      if (!plan.shove && actual > plan.frac + 0.28) return J(Object.assign(base, { verdict:'fine', confidence:'leans', tag:'bet.value.large', lesson:'value-betting', notable:true }));
      // Keep a planned shallow commitment distinct from an ordinary value
      // bet. Its result line must not suggest a smaller bet after the brain
      // deliberately decided the pot was already large beside the chips left.
      const tag = plan.shove && effectiveShove ? 'bet.value.commit' : 'bet.value';
      return J(Object.assign(base, { verdict:'good', confidence:'clear', tag, lesson:'value-betting', notable:true }));
    }
    if (medium) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:'bet.thin', lesson:'pot-control' }));
    // all in with a draw: only when it pays (never clear-cut: how often they
    // fold is an estimate)
    const actualHeavy = investment >= capLeft * 0.4;
    if (strongDraw && (allIn || actualHeavy) && !multi && !shove.ok && shove.close) return J(Object.assign(base, { verdict:'fine', confidence:'close', tag:allIn ? 'bet.semi.shove.close' : 'bet.semi.heavy.close', lesson:'draw-shove' }));
    if (strongDraw && (allIn || actualHeavy) && (multi || !shove.ok)) return J(Object.assign(base, { verdict:'mistake', confidence:'leans', tag:allIn ? 'bet.semi.shove' : 'bet.semi.heavy', lesson:'draw-shove', notable:true }));
    if (strongDraw && allIn) return J(Object.assign(base, { verdict:'good', confidence: shove.close ? 'close' : 'leans', tag:'bet.semi', lesson:'semi-bluff', notable:true }));
    if (strongDraw) return J(Object.assign(base, !multi ? { verdict:drawBet ? 'good' : 'fine', confidence:'leans', tag:'bet.semi', lesson:'semi-bluff', notable:true }
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
    if (sp.effectiveBB <= PUSH_FOLD_BB + 5 && raises >= 1 || sp.effectiveBB <= PUSH_FOLD_BB){
      // If they are the short stack, raise only to the amount they can
      // match. The engine would return unmatched chips from a full shove,
      // but the advice should state the real commitment in the first place.
      return legalTo(sp, sp.effectiveTo);
    }
    let to;
    if (raises === 0) to = (sp.playersDealt === 2 ? 2.5 : 2.5) * bb + sp.preflop.limpers * bb + (sp.seat === 'BB' && sp.preflop.limpers ? bb : 0);
    else to = sp.currentBet * (raises >= 2 ? 2.3 : sp.seatGroup === 'blinds' ? 3.8 : 3) + sp.preflop.callers * sp.currentBet;
    to = Math.round(to / bb * 2) / 2 * bb;   // to the half big blind
    return legalTo(sp, to);
  }
  function advise(sp){
    if (!sp) return null;
    if (ADVICE.has(sp)) return ADVICE.get(sp);
    const advice = freeze(buildAdvice(sp));
    ADVICE.set(sp, advice);
    return advice;
  }
  function buildAdvice(sp){
    const pre = sp.street === 'preflop';
    const betting = !pre && sp.toCall <= 0;
    const sizing = betting ? betSize(sp) : null;
    const to = pre ? raiseSize(sp) : betting ? sizing.to : postRaiseSize(sp), allinTo = sp.stack + sp.yourBet;
    const moves = [];
    moves.push(sp.toCall > 0 ? 'fold' : 'check');
    if (sp.toCall > 0) moves.push('call');
    // A nominal raise is not a real option when every opponent is already
    // all in at the current wager. The table normally closes mayRaise too,
    // but the brain keeps its own public-state guard.
    if (sp.mayRaise && to > sp.currentBet) moves.push(to >= allinTo ? 'allin' : 'raise');
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
    if (pick.j.verdict === 'mistake') pick = judged.slice().sort((a, b) => rank(b) - rank(a))[0];
    if (want === 'check' && sp.toCall > 0) pick = judged.find(x => x.move === 'fold') || pick;
    const others = judged.filter(x => x !== pick);
    const alt = others.slice().sort((a, b) => rank(b) - rank(a))[0] || null;
    const altRank = alt ? rank(alt) : 0;
    let sure = altRank >= 2 ? 'close' : altRank >= 1.5 ? 'leans' : 'clear';
    if (sure === 'clear' && betting && sp.board.length === 5 && sizing.plan && sizing.plan.continuation && !sizing.plan.shove) sure = 'leans';
    const j = pick.j;
    const actionPlan = tacticalPlan(sp, pick.ch, sizing && sizing.plan);
    // (checked to you, a raise is a bet)
    const word = m => betting && m === 'raise' ? 'bet' : m;
    return { decisionId:sp.decisionId, move:word(pick.move), to: pick.move === 'raise' || pick.move === 'allin' ? pick.ch.amount : null, toBB: pick.ch.toBB,
      sure, alt: alt && altRank >= 1.5 ? word(alt.move) : null, kind:j.kind, lesson:j.lesson, n:j.n, tag:j.tag, judgement:j,
      stories: pre ? null : stories(sp), plan:betting && sizing ? sizing.plan : null, actionPlan };
  }
  function tacticalPlan(sp, ch, valuePlan){
    const previous = sp.previousPlan, bf = sp.boardFacts;
    let change = '';
    if (previous && previous.street !== sp.street && bf){
      const before = call('classifyPostflop', sp.hole, previous.board);
      if (before && before.made !== bf.made) change = 'The new card changed your made hand; reassess rather than repeat the last bet.';
      else if (before && bf.texture.wet > before.texture.wet + 0.15) change = 'The new card added threats. The earlier value plan needs a fresh check.';
      else if (sp.toCall > 0) change = 'They are betting now. The earlier plan assumed a different response.';
    } else if (previous && sp.streetRaises > 1) change = 'The re-raise changes the price and likely hands; the earlier advice no longer applies.';
    const aggressive = ['raise','bet','allin'].includes(ch.action);
    const commitment = Math.max(0, ch.amount - sp.yourBet) >= sp.stack * 0.4;
    return { position:sp.actingAfter === 0 ? 'last-to-act' : 'players-behind', initiative:sp.youArePfAggressor ? 'you-raised-preflop' : 'opponent-or-unclaimed',
      change, next:valuePlan ? valuePlan.next : sp.board.length === 5 ? 'There is no next card; weigh the hands that pay or beat you.'
        : aggressive ? 'If called, reassess the new card and their response; do not commit automatically.' : 'Seeing one more card does not promise a cheap showdown.',
      futureRisk:sp.board.length < 5 ? 'Further bets and redraws remain possible.' : '',
      format:sp.mode === 'cash' ? 'cash' : 'elimination',
      formatNote:sp.mode !== 'cash' && commitment ? 'This risks a large part of your tournament stack. Survival matters; payout pressure is not calculated here.' : '' };
  }

  /* ---------------- a read of the hand as it stands (tap him) ----------------
     Facts only after the flop until the judge learns it (step 3): what you
     have, what you're drawing to and your chance of hitting it, the price. */
  function readNow(sp){
    if (!sp) return null;
    const out = { street:sp.street, toCall:sp.toCall, pot: sp.toCall > 0 ? sp.potToWin : sp.pot, odds:Math.round(sp.potOdds * 100), hole:sp.holeFacts.name, seat:sp.seat };
    if (sp.street === 'preflop' || !sp.boardFacts) return out;
    const bf = sp.boardFacts, left = sp.board.length === 3 ? 2 : sp.board.length === 4 ? 1 : 0;
    const drawOuts = bf.drawOuts, q = bf.drawQuality;
    Object.assign(out, { made:bf.made, handName:bf.handName, boardPlays:bf.boardPlays, draws:bf.draws, drawOuts, left,
      hitPct: drawOuts && left ? Math.round(q.runout * 100) : 0, drawWarning:q.warning, strengthNote:bf.strengthNote,
      hitNext:Math.round(q.next * 100), threats:bf.threats, texture:bf.texture });
    return out;
  }

  /* ---------------- the hand record ---------------- */
  let hand = null, handGame = null;
  const history = [];
  const emit = (type, detail) => { try{ if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(type, { detail })); }catch(e){} };

  function handStart(g, start){
    handGame = g;
    if (!(g.handNumber >= 1)){ hand = null; return null; }   // the table before its first deal
    const me = g.players.find(p => p.isHuman);
    hand = { n:g.handNumber, mode:g.mode || null, bigBlind:g.bigBlind || null, startStack:me && start ? start[me.id] : null,
      seat:null, hole:null, decisions:[], end:null };
    return hand;
  }
  function record(sp, g, me, context){
    if (!sp) return null;
    if (!hand || hand.n !== sp.handNumber) handStart(g, null);
    if (!hand) return null;
    const d = { spot:sp, choice:choice(sp, g, me) };
    d.adviceShown = !!(context && context.adviceShown);
    d.recommendation = advise(sp);
    const rec = d.recommendation, actual = d.choice;
    const canonical = a => a === 'allin' && sp.toCall >= sp.stack ? 'call' : ['bet', 'raise', 'allin'].includes(a) ? 'aggressive' : a;
    d.followedAdvice = !!rec && canonical(rec.move) === canonical(actual.action)
      && (rec.to == null || actual.amount === rec.to);
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
      // (the odd chip of a split goes to the first winners in seat order, as the game pays it)
      const k = winners.indexOf(me.id), share = Math.floor(pot.amount / winners.length);
      if (k >= 0) won += share + (k < pot.amount - share * winners.length ? 1 : 0);
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
      out: me.chips <= 0,
      // everyone still against you at the end was all in: win it, and you
      // won everything they had (nothing more to win)
      rivalsAllIn: (() => { const r = g.players.filter(p => p !== me && p.inHand && !p.folded); return r.length > 0 && r.every(p => p.allIn || p.chips <= 0); })()
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
    hand.end.tookAll = !!(net > 0 && v.rivalsAllIn);
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

  return { spot, choice, settle, judge, judgeBet, stories, foldChance, bluffAssessment, drawPrice, potAssessment, continuationEquity, valueRaiseAssessment, tacticalPlan, betSize, valueBetPlan, valueContinuation, judgePreflop, judgePostflop, advise, advisePreflop:advise, oppRange, readNow, raiseSize, openRange, pushRange, raiserRange, record, handStart, observe, handEnd, closeMissed, shownAtShowdown, seatLabel, actingAfter,
    get hand(){ return hand; }, get history(){ return history.slice(); }, reset(){ hand = null; history.length = 0; } };
})();
if (typeof window !== 'undefined') window.CoachBrain = CoachBrain;
