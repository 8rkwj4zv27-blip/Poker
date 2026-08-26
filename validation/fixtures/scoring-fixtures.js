#!/usr/bin/env node
"use strict";

/* ============================================================
   PHASE 3 — SCORING AUDIT FIXTURES
   ============================================================

   Deterministic, reproducible table states for the scoring and
   post-hand-feedback audit. Written once here and consumed by TWO
   harnesses:

     - validation/scoring-audit.js   (Phase 3) reports CURRENT behaviour
       against the `expected` block below and counts divergences. It
       asserts no correctness, so it can never encode a defect as
       expected behaviour.
     - validation/scoring-checks.js  (Phase 4) asserts `expected` and
       must pass. It does not exist yet and is not created by Phase 3.

   `expected` is the behaviour REQUIRED by docs/scoring/SCORING_SPEC.md.
   It is the specification expressed as data, not a record of what the
   code does today.

   ---- DETERMINISM (SCORING_SPEC.md, "Fixture determinism") ----

   Two random paths exist in the evaluator and both are closed here:

   1. snap.equityPromise -> EquityService.get() -> estimateEquity(),
      which is unseeded Monte Carlo. CLOSED BY INJECTION: every snapshot
      below carries an explicit numeric `equity`, and
      settleArcadeSnapshots() awaits equityPromise only when
      `s.equity == null`, so the sampler is never entered.

   2. classifyArcadeLuck() -> resolvedEquityAtSnapshot(), which samples
      520 random runouts when THREE OR MORE board cards are unknown
      (js/04-modes-and-scoring.js, the `need > 2` branch). CLOSED BY
      CONSTRUCTION: every snapshot whose action is not 'fold' or 'check'
      is taken with a board of at least three cards, so `need <= 2` and
      the function enumerates exhaustively.

   Injecting `snap.equity` alone is NOT sufficient — it does not reach
   path 2 — which is why the board-length rule is a hard property of
   every fixture and is enforced by the harness. A fixture that cannot
   satisfy it must declare `luckStubbed: true` and supply
   `resolvedLuckEquity`; the harness then substitutes a deterministic
   resolvedEquityAtSnapshot in its own scope. No production seam and no
   production change is involved either way. No fixture below currently
   needs the stub.

   ---- PROVISIONAL CONSTANTS ----

   BIG_WIN_BB / MASSIVE_WIN_BB are carried forward from the current
   bigPot/massivePot thresholds as a STARTING POINT only. SCORING_SPEC.md
   records that they were tuned against a quantity 2-5x larger than net
   profit and must be re-derived at Phase 4B before they are frozen.
   ============================================================ */

const BIG_WIN_BB = 12;        // provisional - owned by Phase 4B
const MASSIVE_WIN_BB = 30;    // provisional - owned by Phase 4B

/* POT WINNINGS, per SCORING_SPEC.md 2.2 - identical arithmetic to the
   existing arcadePotWinningsScore(), restated here so `expected` is
   independently derivable rather than copied from the code under audit. */
function expectedPotWinnings(netProfit, bigBlind, tableMultiplier){
  if (!(netProfit > 0)) return 0;
  const raw = netProfit / Math.max(1, bigBlind) * 25 * (tableMultiplier == null ? 1 : tableMultiplier);
  return Math.round(raw / 5) * 5;
}
function expectedWinAward(netProfit, bigBlind){
  const bb = netProfit / Math.max(1, bigBlind);
  if (!(netProfit > 0)) return null;
  if (bb >= MASSIVE_WIN_BB) return { id:'massiveWin', points:500 };
  if (bb >= BIG_WIN_BB)     return { id:'bigWin',     points:150 };
  return null;
}

/* ---------------- table construction helpers ----------------
   `api` carries the REAL production primitives from the harness's VM
   context (card values, computePots, evaluate7WithCards, compareHands),
   so nothing about card ranking or pot layering is reimplemented. */

function makeCards(api, spec){
  return spec.map(s=>{
    const suit = s.slice(-1);
    const rank = s.slice(0, -1);
    return api.card(rank, suit);
  });
}

function player(api, o){
  return {
    id:o.id, name:o.name || o.id.toUpperCase(), isHuman:!!o.isHuman,
    chips:o.chips, totalBetHand:o.totalBetHand || 0, betThisRound:0,
    folded:!!o.folded, inHand:o.inHand !== false, allIn:!!o.allIn,
    eliminated:!!o.eliminated,
    hand:o.hand ? makeCards(api, o.hand) : [],
    _handStartChips:o.startStack,
    personality:{ key:o.personalityKey || 'steady', tightness:o.tightness == null ? 0.5 : o.tightness },
    lives:0, moodState:null, faceMood:null
  };
}

/* Mirrors the pot-resolution loop in handleShowdown() (js/05-game-engine.js).
   Only the loop shape is mirrored: the pot layering (computePots), the hand
   evaluation (evaluate7WithCards) and the comparison (compareHands) are the
   real production functions. The harness independently verifies that every
   row's winnerShares sum to that row's amount and that the rows sum to the
   whole pot, so a divergence from production arithmetic cannot pass silently. */
function settleShowdown(api, g){
  const contenders = g.players.filter(p=>p.inHand && !p.folded && !p.eliminated);
  const pots = api.computePots(g.players);
  contenders.forEach(p=>{ p._handRes = api.evaluate7WithCards([...p.hand, ...g.board]); });
  const potResults = [];
  const winnerIds = new Set();
  pots.forEach((pot, i)=>{
    const eligible = pot.eligible.map(id=>g.players.find(p=>p.id===id));
    if (!eligible.length) return;
    let best = null, winners = [];
    for (const p of eligible){
      const res = p._handRes || api.evaluate7WithCards([...p.hand, ...g.board]);
      p._handRes = res;
      if (!best || api.compareHands(res.result, best.result) > 0){ best = res; winners = [p]; }
      else if (api.compareHands(res.result, best.result) === 0) winners.push(p);
    }
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;
    const winnerShares = winners.map((w,k)=>{
      const amt = share + (k < remainder ? 1 : 0);
      w._award = (w._award || 0) + amt;
      winnerIds.add(w.id);
      return { name:w.name, id:w.id, amount:amt };
    });
    potResults.push({
      label: pots.length === 1 ? 'Pot' : (i === 0 ? 'Main pot' : 'Side pot ' + i),
      amount: pot.amount,
      winners: winners.map(w=>w.name),
      winnerIds: winners.map(w=>w.id),
      eligible: pot.eligible,
      winnerShares,
      hand: api.describeMade(best.result),
      cat: best.result.cat,
      cards: best.cards,
      contested: eligible.length,
      // The count of players who PAID INTO this layer, from computePots().
      // Distinct from `contested`/`eligible`, which count who could still
      // WIN it — see computePots() for why the difference matters.
      contributors: pot.contributors,
      split: winners.length > 1
    });
  });
  return { type:'showdown', potResults, contenders, winnerIds };
}

/* Mirrors handleFoldWin()'s hand-built single row verbatim
   (js/05-game-engine.js) - including `contested: 1`, which is the field
   the audit is examining. */
function settleFoldWin(api, g, winnerId){
  const winner = g.players.find(p=>p.id === winnerId);
  const amt = g.pot;
  const potResults = [{
    label:'Pot', amount:amt, winners:[winner.name], winnerIds:[winner.id],
    eligible:[winner.id],
    winnerShares:[{ name:winner.name, id:winner.id, amount:amt }],
    hand:null, cat:null, cards:null, contested:1, contributors:null, split:false
  }];
  return { type:'foldwin', winner, amount:amt, potResults };
}

/* `board` and `hole` MUST be real card objects: heroCatAtSnapshot(),
   resolvedEquityAtSnapshot() and the deck-exclusion set all run through
   cardKey()/evaluate7(), which read .rank/.suit/.value. Passing the
   shorthand strings through would silently produce nonsense equities
   rather than throwing. */
function snap(api, o){
  return {
    action:o.action, street:o.street,
    board:makeCards(api, o.board || []), hole:makeCards(api, o.hole || []),
    opponentIds:o.opponentIds || [],
    lastAggressorId:o.lastAggressorId || null,
    pot:o.pot, toCall:o.toCall || 0,
    potOdds:o.toCall > 0 ? o.toCall / (o.pot + o.toCall) : 0,
    commit:o.commit || 0,
    stackBefore:o.stackBefore, startStack:o.startStack,
    totalCommittedBefore:o.totalCommittedBefore || 0,
    bigBlind:o.bigBlind,
    allIn:!!o.allIn,
    handActionIndex:o.handActionIndex == null ? 0 : o.handActionIndex,
    equity:o.equity                       // INJECTED - closes random path 1
  };
}

/* Builds a table plus its reward state. `mode` selects which reward
   container the evaluator will find through rewardState(). */
function table(api, o){
  const g = {
    mode:o.mode || 'elimination',
    players:o.players.map(p=>player(api, p)),
    board:makeCards(api, o.board || []),
    pot:o.pot || 0,
    bigBlind:o.bigBlind,
    smallBlind:Math.round(o.bigBlind / 2),
    phase:o.phase || 'river',
    handNumber:o.handNumber || 6,
    handActions:o.handActions || [],
    log:[],
    buyIns:0,
    sess:{ bestWin:0, worstLoss:0 },
    humanFoldSnapshot:o.humanFoldSnapshot || null,
    over:false
  };
  const human = g.players.find(p=>p.isHuman);
  g._humanStart = human.chips + human.totalBetHand;
  g._humanAllIn = !!human.allIn;

  const reward = {
    score:0, comboStep:0, highestComboStep:0, biggestReward:0,
    awardCounts:{}, decisionSnapshots:(o.snapshots || []).map(x=>snap(api, x)), displayedScore:0
  };
  if (g.mode === 'career'){
    g.event = {
      id:o.eventId || 'back-room', name:o.eventName || 'BACK ROOM FREEZEOUT',
      venue:'BACK ROOM', buyIn:o.buyIn == null ? 100 : o.buyIn,
      playerCount:o.playerCount || g.players.length,
      payouts:o.payouts || [300], prize:(o.payouts || [300])[0],
      stack:o.stack || 500, difficulty:'medium', opponentCount:g.players.length - 1,
      initialBlindLevel:0, unlockRequirement:null,
      reward
    };
  } else {
    reward.newHighScore = false;
    g.run = {
      active:true, tableNumber:o.tableNumber || 1, highestTableReached:o.tableNumber || 1,
      tablesCleared:0, opponentCount:g.players.length - 1,
      totalKOs:0, totalHands:5, totalHandsWon:2,
      showdownsPlayed:3, showdownsWon:1, allInsPlayed:1, allInsWon:0,
      biggestPotWon:0, highestStack:o.stack || 2000, bestHand:null, bustedBy:null,
      tableKOs:0, tableHands:5, tableHandsWon:2,
      tableShowdownsPlayed:3, tableShowdownsWon:1, tableAllInsPlayed:1, tableAllInsWon:0,
      tableBiggestPotWon:0, tableHighestStack:o.stack || 2000, tableBestHand:null,
      tableScoreStart:0,
      arcade:reward
    };
  }
  return g;
}

/* Common board / hole-card sets, named so each fixture reads as a hand
   rather than as card noise. */
const BOARD_TWO_PAIR   = ['K♠','9♦','4♣','J♥','2♠'];
const BOARD_FLOP_ONLY  = ['K♠','9♦','4♣'];
const BOARD_TURN_ONLY  = ['K♠','9♦','4♣','J♥'];

module.exports = {
  BIG_WIN_BB, MASSIVE_WIN_BB,
  expectedPotWinnings, expectedWinAward,
  helpers:{ makeCards, player, settleShowdown, settleFoldWin, snap, table },
  BOARD_TWO_PAIR, BOARD_FLOP_ONLY, BOARD_TURN_ONLY,
  /* Lazy: the cases module requires this one for its constants and
     helpers, so the require must not run until these exports exist. */
  get FIXTURES(){ return require('./scoring-fixtures-cases.js'); }
};
