"use strict";
/* AI measuring stick (docs/ai/AI_PLAN.md, Step 1).

   Runs the REAL aiDecide() from js/03-opponents.js (and the real hand
   evaluator from js/01-poker-math.js) through a small, rules-correct
   no-limit hold'em betting loop, and records how each opponent actually
   plays: VPIP, PFR, aggression, showdown rate, fold-to-bet, c-bets,
   bluffs, sizing tells and win rate.

   It is a measuring table, not the game engine. Simplifications, on
   purpose: every seat starts every hand with the same stack (so one pot is
   always correct: no side pots are possible), there is no presentation, no
   Career state and no mood. Numbers are statistics, so read them as
   direction: a few hundred hands is noisy, especially win rates.

   Used by validation/ai-behaviour-checks.js (small seeded smoke runs) and
   validation/tools/ai-sim.js (full reports). */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

/* mulberry32: small seeded RNG so a run can be repeated exactly */
function seeded(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Load the production AI into a sandbox. The worker-backed EquityService is
   swapped for the same estimateEquity() run inline (the worker only moves it
   off the main thread; the maths is identical). */
function loadAI(seed){
  const math = fs.readFileSync(path.join(ROOT, 'js/01-poker-math.js'), 'utf8');
  const opp = fs.readFileSync(path.join(ROOT, 'js/03-opponents.js'), 'utf8');
  const modes = fs.readFileSync(path.join(ROOT, 'js/04-modes-and-scoring.js'), 'utf8');
  const elim = modes.slice(modes.indexOf('const ELIMINATION_CONFIG'));
  const elimEnd = elim.indexOf('\n};') + 3;
  const SandMath = Object.create(Math);
  SandMath.random = seeded(seed == null ? 1 : seed);
  const ctx = { console, Math: SandMath, setTimeout, clearTimeout,
    settings: { tableTalk:false, speed:'normal' }, seatEls: {}, FACE_MOOD_POOLS: {},
    DEV_MODE:false, FAST_DEV:false, quickResolveActive: () => false,
    // presentation timing is off unless a check turns it on (aiThinkTime)
    motionOff: () => ctx.__motion !== true };
  vm.createContext(ctx);
  const inlineEquity = math.replace(/const EquityService = \(function\(\)\{[\s\S]*?\n\}\)\(\);/,
    'const EquityService = { get: async (h,b,n,i,r) => r ? estimateEquityVsRanges(h,b,r,i) : estimateEquity(h,b,n,i) };');
  if (inlineEquity === math) throw new Error('ai-harness: EquityService block not found in 01-poker-math.js');
  vm.runInContext('var game = null;\n' + inlineEquity + '\n' + elim.slice(0, elimEnd) + '\n' + opp +
    '\nglobalThis.API = { aiDecide, seatsAfter, PERSONALITIES_ALL, DIFFICULTY_PARAMS, createDeck, shuffle,' +
    ' evaluate7, evaluate5, compareHands, estimateEquity, estimateEquityVsRanges, fastScore7, cardCode,' +
    ' holeClass, comboOrder, preflopPercentile, PREFLOP_ORDER, classifyPostflop, aiPreflop, aiPostflop, rangeRelStrength, aiThinkTime, isScareCard, SKILL_ANCHORS, aiSkillOf, skillBlend, aiDifficultyParams,' +
    ' setGame: g => { game = g; } };', ctx);
  ctx.API.setMotion = on => { ctx.__motion = !!on; };
  return ctx.API;
}

/* ---- test seats: fixed strategies used to probe the AI ------------------
   bully   — raises every hand preflop, bets 75% pot whenever checked to,
             only continues facing a bet with real equity. Finds AIs that
             fold too much.
   station — never folds, never raises. Finds AIs that bluff people who
             can't be bluffed.
   abc     — the reference "decent player": tight preflop, bets its good
             hands, calls with the right price, folds the rest. The tier
             yardstick: it should beat Back Room tables clearly and lose at
             the Invitational. */
const PROBES = {
  bully(p, g, A){
    const toCall = g.currentBet - p.betThisRound;
    if (g.board.length === 0){
      if (g.currentBet <= g.bigBlind) return { action:'raise', amount: g.bigBlind*3 };
      const eq = A.estimateEquity(p.hand, g.board, 1, 150);
      return eq > 0.55 ? { action:'call' } : { action:'fold' };
    }
    if (toCall <= 0) return { action:'bet', amount: p.betThisRound + Math.round(g.pot*0.75) };
    const eq = A.estimateEquity(p.hand, g.board, 1, 150);
    return eq > 0.5 ? { action:'call' } : { action:'fold' };
  },
  station(p, g){
    return g.currentBet - p.betThisRound > 0 ? { action:'call' } : { action:'check' };
  },
  abc(p, g, A){
    const toCall = g.currentBet - p.betThisRound;
    const opps = g.players.filter(q => !q.folded && q !== p).length;
    const eq = A.estimateEquity(p.hand, g.board, Math.max(1, opps), 200);
    const potOdds = toCall > 0 ? toCall / (g.pot + toCall) : 0;
    if (g.board.length === 0){
      const eqHU = A.estimateEquity(p.hand, [], 1, 200);
      if (eqHU > 0.62) return g.currentBet <= g.bigBlind
        ? { action:'raise', amount: g.bigBlind*3 }
        : { action:'raise', amount: g.currentBet*3 };
      if (eqHU > 0.55 && toCall <= g.bigBlind*3) return toCall > 0 ? { action:'call' } : { action:'check' };
      return toCall > 0 ? { action:'fold' } : { action:'check' };
    }
    const strong = eq > 0.62 + 0.04*(opps-1);
    if (toCall <= 0) return strong ? { action:'bet', amount: p.betThisRound + Math.round(g.pot*0.66) } : { action:'check' };
    if (strong && eq > 0.75) return { action:'raise', amount: g.currentBet*3 };
    return eq > potOdds + 0.05 ? { action:'call' } : { action:'fold' };
  },
};

function newStats(){
  return { hands:0, vpip:0, pfr:0, bets:0, raises:0, calls:0, folds:0, checks:0,
    sawFlop:0, wtsd:0, net:0, facedBet:0, foldToBet:0, cbetOpp:0, cbet:0,
    postBets:0, bluffBets:0, riverBets:0, riverBluffs:0, checkRaises:0, allins:0,
    sizing:[] };
}

/* opts: { seats:[personalityKey|'probe:<name>'], hands, difficulty, skill,
           seed, stack, bigBlind, labelIters }. `skill` (0-100) overrides the
           named difficulty, exactly as a table's g.skill does in the game. */
async function simulate(opts){
  const A = loadAI(opts.seed);
  const R = A.PERSONALITIES_ALL;
  const bb = opts.bigBlind || 20;
  const stackStart = opts.stack || 1500;
  const labelIters = opts.labelIters || 60;
  const stats = {};
  const players = opts.seats.map((key, i) => {
    const probe = key.startsWith('probe:') ? key.slice(6) : null;
    const pers = probe ? { key, aggression:.5, tightness:.5, bluffFreq:0, sizing:.7, thinkSpeed:1 }
                       : R.find(p => p.key === key);
    if (!pers) throw new Error('ai-harness: unknown seat ' + key);
    stats[key] = newStats();
    return { id:'s'+i, name:key, key, probe, isHuman:!!probe, personality:pers, chips:stackStart,
      hand:[], inHand:true, folded:false, allIn:false, eliminated:false, betThisRound:0,
      totalBetHand:0, acted:false, mayRaise:true, moodState:null };
  });
  const n = players.length;
  let chipsCheck = 0;

  for (let h = 0; h < opts.hands; h++){
    const dealer = h % n;
    const g = { players, board:[], pot:0, currentBet:0, minRaise:bb, bigBlind:bb,
      dealerIndex:dealer, difficulty:opts.difficulty || 'hard', mode:opts.mode || 'cash' };
    if (typeof opts.skill === 'number') g.skill = opts.skill;
    A.setGame(g);
    const deck = A.shuffle(A.createDeck()); let di = 0;
    players.forEach(p => Object.assign(p, { chips:stackStart, hand:[deck[di++], deck[di++]], inHand:true,
      folded:false, allIn:false, betThisRound:0, totalBetHand:0, acted:false, mayRaise:true,
      _vpip:false, _pfr:false, _pfAgg:false }));
    const sbI = n === 2 ? dealer : (dealer+1) % n;
    const bbI = n === 2 ? (dealer+1) % n : (dealer+2) % n;
    const commit = (p, amt) => { amt = Math.min(amt, p.chips); p.chips -= amt; p.betThisRound += amt;
      p.totalBetHand += amt; g.pot += amt; if (p.chips === 0) p.allIn = true; return amt; };
    commit(players[sbI], bb/2); commit(players[bbI], bb); g.currentBet = bb;
    g.sbIndex = sbI; g.bbIndex = bbI;
    const live = () => players.filter(p => !p.folded);

    for (const street of ['preflop','flop','turn','river']){
      // the engine's public betting history (beginBettingRound / settleAggression)
      g.prevAggressorId = street === 'preflop' ? null : (g.streetAggressorId || null);
      g.phase = street; g.streetRaises = 0; g.streetAggressorId = null;
      if (street === 'preflop'){ g.pfAggressorId = null; g.pfRaises = 0; }
      if (street === 'flop') g.board.push(deck[di++], deck[di++], deck[di++]);
      else if (street !== 'preflop') g.board.push(deck[di++]);
      if (street !== 'preflop'){
        players.forEach(p => { p.betThisRound = 0; p.acted = false; p.mayRaise = true; });
        g.currentBet = 0; g.minRaise = bb;
        if (street === 'flop') live().forEach(p => stats[p.key].sawFlop++);
      }
      let ptr = street === 'preflop' ? (bbI+1) % n : (dealer+1) % n;
      let aggressed = false;
      const checked = new Set();
      for (let guard = 0; guard < 500; guard++){
        if (live().length <= 1) break;
        const actors = players.filter(p => !p.folded && !p.allIn);
        const needs = p => !p.acted || p.betThisRound < g.currentBet;
        if (!actors.some(needs)) break;
        if (actors.length === 1 && actors[0].betThisRound >= g.currentBet) break;
        const p = players[ptr]; ptr = (ptr+1) % n;
        if (p.folded || p.allIn || !needs(p)) continue;

        const st = stats[p.key];
        const toCall = g.currentBet - p.betThisRound;
        const potBefore = g.pot;
        let d = p.probe ? PROBES[p.probe](p, g, A) : await A.aiDecide(p, g);
        if (!p.probe && toCall > 0 && street !== 'preflop'){ st.facedBet++; if (d.action === 'fold') st.foldToBet++; }
        if (!p.probe && street === 'flop' && p._pfAgg && !aggressed){
          st.cbetOpp++; if (d.action === 'bet' || d.action === 'raise') st.cbet++;
        }
        if ((d.action === 'raise' || d.action === 'bet') && (!p.mayRaise || p.chips <= toCall)) d = { action:'call' };

        if (d.action === 'fold'){ p.folded = true; st.folds++; }
        else if (d.action === 'check' || (d.action === 'call' && toCall <= 0)){ st.checks++; checked.add(p); }
        else if (d.action === 'call'){ commit(p, toCall); st.calls++; if (street === 'preflop') p._vpip = true; }
        else {
          const prev = g.currentBet;
          let target = prev <= 0 ? Math.max(d.amount, p.betThisRound + bb) : Math.max(d.amount, prev + g.minRaise);
          target = Math.min(target, p.betThisRound + p.chips);
          const added = commit(p, target - p.betThisRound);
          if (p.allIn) st.allins++;
          const inc = p.betThisRound - prev;
          if (inc > 0){
            const full = inc >= g.minRaise;
            g.currentBet = p.betThisRound;
            g.streetRaises++; g.streetAggressorId = p.id;
            if (street === 'preflop'){ g.pfAggressorId = p.id; g.pfRaises = g.streetRaises; }
            players.forEach(q => { if (q === p || q.folded || q.allIn) return;
              if (full){ q.acted = false; q.mayRaise = true; } else if (q.acted) q.mayRaise = false; });
            if (full) g.minRaise = inc;
          }
          if (prev > 0) st.raises++; else st.bets++;
          if (street === 'preflop'){ p._vpip = true; p._pfr = true; players.forEach(q => q._pfAgg = false); p._pfAgg = true; }
          else if (!p.probe){
            st.postBets++;
            const opps = live().length - 1;
            const eqNow = A.estimateEquity(p.hand, g.board, Math.max(1, opps), labelIters);
            const eqHU = A.estimateEquity(p.hand, g.board, 1, labelIters);
            st.sizing.push([eqNow, added / Math.max(1, potBefore)]);
            if (eqHU < 0.40) st.bluffBets++;
            if (street === 'river'){ st.riverBets++; if (eqHU < 0.35) st.riverBluffs++; }
            if (checked.has(p) && prev > 0) st.checkRaises++;
          }
          aggressed = true;
        }
        p.acted = true;
      }
      if (live().length <= 1) break;
    }

    const L = live();
    let winners = L;
    if (L.length > 1){
      while (g.board.length < 5) g.board.push(deck[di++]);
      L.forEach(p => stats[p.key].wtsd++);
      const ev = L.map(p => [p, A.evaluate7([...p.hand, ...g.board])]);
      let best = ev[0][1];
      ev.forEach(e => { if (A.compareHands(e[1], best) > 0) best = e[1]; });
      winners = ev.filter(e => A.compareHands(e[1], best) === 0).map(e => e[0]);
    }
    let paid = 0;
    players.forEach(p => {
      const st = stats[p.key];
      const won = winners.includes(p) ? g.pot / winners.length : 0;
      paid += won;
      st.hands++; if (p._vpip) st.vpip++; if (p._pfr) st.pfr++;
      st.net += won - p.totalBetHand;
    });
    chipsCheck = Math.max(chipsCheck, Math.abs(paid - g.pot));
  }
  return { stats, bigBlind:bb, hands:opts.hands, difficulty:opts.difficulty || 'hard', skill:opts.skill, chipsError:chipsCheck };
}

function correlation(pts){
  if (pts.length < 3) return 0;
  const mx = pts.reduce((a,p)=>a+p[0],0)/pts.length, my = pts.reduce((a,p)=>a+p[1],0)/pts.length;
  let c = 0, vx = 0, vy = 0;
  pts.forEach(([x,y]) => { c += (x-mx)*(y-my); vx += (x-mx)**2; vy += (y-my)**2; });
  return vx && vy ? c / Math.sqrt(vx*vy) : 0;
}

/* Rates as fractions (0-1), plus AF and bb/100. */
function summarize(result){
  const out = {};
  for (const [key, s] of Object.entries(result.stats)){
    const r = (a, b) => b ? a / b : null;
    out[key] = {
      hands: s.hands,
      vpip: r(s.vpip, s.hands), pfr: r(s.pfr, s.hands),
      af: (s.bets + s.raises) / Math.max(1, s.calls),
      wtsd: r(s.wtsd, s.sawFlop), foldToBet: r(s.foldToBet, s.facedBet),
      cbet: r(s.cbet, s.cbetOpp), bluffShare: r(s.bluffBets, s.postBets),
      riverBluffShare: r(s.riverBluffs, s.riverBets), checkRaises: s.checkRaises,
      allins: s.allins, sizeTell: correlation(s.sizing),
      bb100: s.net / result.bigBlind / Math.max(1, s.hands) * 100,
    };
  }
  return out;
}

/* Provisional tier targets (table-average, AI seats only). The
   difficulty key IS the tier: Career events already carry these values.
   Step 6 of the plan tunes the AI into these bands; until then the report
   shows them for comparison and nothing asserts them. */
const TIER_TARGETS = {
  medium: { label:'Back Room: recreational',   vpip:[.35,.55], pfr:[.05,.15], af:[0.8,1.6], wtsd:[.35,.50], foldToBet:[.25,.40], sizeTell:[0,.60] },
  hard:   { label:'Pub / Card Club: amateurs', vpip:[.25,.40], pfr:[.12,.25], af:[1.5,2.5], wtsd:[.28,.38], foldToBet:[.35,.50], sizeTell:[0,.35] },
  expert: { label:'Casino Floor: good regs',   vpip:[.20,.32], pfr:[.16,.26], af:[2.0,3.5], wtsd:[.25,.33], foldToBet:[.40,.55], sizeTell:[0,.20] },
  elite:  { label:'High Roller+: strong',      vpip:[.20,.30], pfr:[.17,.26], af:[2.2,3.5], wtsd:[.25,.32], foldToBet:[.42,.55], sizeTell:[0,.15] },
};

module.exports = { simulate, summarize, loadAI, seeded, PROBES, TIER_TARGETS };
