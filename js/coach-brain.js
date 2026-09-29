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
      opponents: opps.map(p => ({ id:p.id, name:p.name, stackBB:r1(p.chips / bb), bet:p.betThisRound || 0,
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

  return { spot, choice, record, handStart, observe, handEnd, closeMissed, shownAtShowdown, seatLabel, actingAfter,
    get hand(){ return hand; }, get history(){ return history.slice(); }, reset(){ hand = null; history.length = 0; } };
})();
if (typeof window !== 'undefined') window.CoachBrain = CoachBrain;
