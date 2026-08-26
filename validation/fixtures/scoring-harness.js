#!/usr/bin/env node
"use strict";

/* ============================================================
   SHARED SCORING HARNESS
   ============================================================

   The ONE way both scoring harnesses drive the real evaluator:

     - validation/scoring-audit.js   (Phase 3) REPORTS current behaviour
       against the specification and counts divergences. It asserts
       nothing and exits 0 even when it finds divergences.
     - validation/scoring-checks.js  (Phase 4) ASSERTS the same fixtures'
       `expected` blocks, gate by gate.

   Extracted from scoring-audit.js at Phase 4A. Both files previously
   would have needed their own VM setup, and two copies of "how the
   evaluator is invoked" can disagree — at which point the report and the
   test suite are measuring different things. There is now one copy.

   Nothing here reimplements scoring. It builds a DOM-less context, runs
   the real production sources in it, and calls the real entry points in
   the order finishHand() calls them.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');

function stubEl(){
  return {
    classList:{ add(){}, remove(){}, toggle(){}, contains:()=>false },
    style:{ setProperty(){}, removeProperty(){} }, dataset:{}, children:[],
    innerHTML:'', textContent:'', scrollWidth:0, clientWidth:100,
    parentElement:null, offsetWidth:0,
    appendChild(){}, remove(){}, setAttribute(){}, getAttribute:()=>null,
    querySelector:()=>null, querySelectorAll:()=>[], addEventListener(){},
    getBoundingClientRect:()=>({ left:0, top:0, width:0, height:0 }),
    animate:()=>({ finished:Promise.resolve(), cancel(){}, commitStyles(){} })
  };
}

function buildContext(){
  const store = new Map();
  const ctx = {
    console,
    __store:store,
    location:{ search:'' },
    URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval,
    Promise, Math, JSON, Date,
    performance:{ now:()=>0 },
    requestAnimationFrame:fn=>fn(0),
    document:{
      querySelector:()=>null, querySelectorAll:()=>[], createElement:stubEl,
      body:stubEl(), addEventListener(){}, documentElement:stubEl(),
      /* $() is defined in 02-support-systems.js and resolves through
         document.getElementById, so the one element logMsg() dereferences
         is stubbed here rather than by shadowing $ itself. Everything else
         stays null, which keeps every presentation path inert. */
      getElementById:id=>id === 'log-drawer' ? stubEl() : null
    },
    window:{ matchMedia:()=>({ matches:false }), addEventListener(){} },
    navigator:{ vibrate(){} },
    /* esc() lives in 06-presentation.js, which these harnesses do not load
       (it is all DOM). foldSnapshotNote() is the one audited function
       that calls it, and only to build display text. */
    esc:t=>String(t).replace(/[&<>"']/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
    /* 02-support-systems.js defines the real `Store` over localStorage,
       which shadows any stub declared here — so persistence is exercised
       through a genuine in-memory backing store rather than a fake Store. */
    localStorage:{
      getItem:k=>store.has(k) ? store.get(k) : null,
      setItem:(k,v)=>store.set(k, String(v)),
      removeItem:k=>store.delete(k)
    },
    $:()=>null
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const files = [
    'js/01-poker-math.js', 'js/02-support-systems.js', 'js/03-opponents.js',
    'js/04-modes-and-scoring.js', 'js/05-game-engine.js', 'js/07-ui-wiring.js'
  ];
  for (const f of files){
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename:f });
  }
  /* const/let bindings are lexical and never become context properties,
     so the ones these harnesses need are exported explicitly - the same
     technique the existing career-*-checks.js harnesses use. */
  vm.runInContext(
    'globalThis.__audit={ARCADE_AWARDS,ARCADE_LUCK,ARCADE_COMMENTARY,RANK_VALUES,' +
      'ARCADE_PROFILE_DEFAULT,ARCADE_BIG_WIN_BB,ARCADE_MASSIVE_WIN_BB,ARCADE_COMMENTARY_CADENCE};' +
    /* `game` is a top-level `let` in 05-game-engine.js, so it lives in the
       context's global LEXICAL environment and never becomes a property of
       the context object. logMsg(), foldSnapshotNote() and rewardState()'s
       default all read it, so the harness needs a setter compiled in that
       same scope. `stats` is the same shape of binding. */
    'globalThis.__setGame=function(v){ game = v; };' +
    'globalThis.__stats=function(){ return stats; };' +
    'globalThis.__resetStats=function(){ stats = Object.assign({}, DEFAULT_STATS); };' +
    'globalThis.__Store=Store;',
    ctx, { filename:'scoring-harness-exports' });

  /* Presentation boundary. Recording rather than rendering is what lets
     the real late path run with no DOM. */
  ctx.__presented = [];
  ctx.presentArcadeResolution = function(g, r){ ctx.__presented.push(r); return Promise.resolve(); };
  /* resolveEliminations() awaits the K.O. ceremony, which lives in
     06-presentation.js. The harness needs its BOOKKEEPING (ko attribution
     and the mode gate), not its animation. */
  ctx.playEliminationGroup = function(){ return Promise.resolve(); };
  if (typeof ctx.logMsg !== 'function') ctx.logMsg = function(){};
  return ctx;
}

function apiFor(ctx){
  const RV = ctx.__audit.RANK_VALUES;
  return {
    card:(rank, suit)=>({ rank, suit, value:RV[rank] }),
    computePots:ctx.computePots,
    evaluate7WithCards:ctx.evaluate7WithCards,
    evaluate7:ctx.evaluate7,
    compareHands:ctx.compareHands,
    describeMade:ctx.describeMade
  };
}

/* Malformed-fixture validation. `fail` is supplied by the caller so the
   audit can collect problems for its exit code and the check suite can
   turn them into assertion failures. */
function validateBuilt(fx, built, where, fail){
  const { g, outcome } = built;
  if (!g || !outcome) return fail(fx.id + ': build() returned no ' + (!g ? 'g' : 'outcome') + ' ' + where);

  /* DETERMINISM RULE (scoring-fixtures.js): any snapshot that can reach
     classifyArcadeLuck's meaningful filter must have at least three board
     cards, or resolvedEquityAtSnapshot() samples 520 random runouts. */
  const snaps = (g.run ? g.run.arcade : g.event.reward).decisionSnapshots || [];
  snaps.forEach((s, i)=>{
    if (s.action === 'fold' || s.action === 'check') return;
    if (!fx.luckStubbed && (!s.board || s.board.length < 3)){
      fail(fx.id + ': snapshot ' + i + ' has action "' + s.action + '" with board length ' +
           ((s.board && s.board.length) || 0) + '; needs >= 3 or luckStubbed:true ' + where);
    }
    if (typeof s.equity !== 'number'){
      fail(fx.id + ': snapshot ' + i + ' has no injected numeric equity ' + where);
    }
  });
  if (fx.luckStubbed && typeof fx.resolvedLuckEquity !== 'number'){
    fail(fx.id + ': declares luckStubbed but supplies no resolvedLuckEquity ' + where);
  }

  /* The settleShowdown helper mirrors handleShowdown()'s resolution loop.
     Verify its arithmetic against the real computePots() so a divergence
     from production cannot pass silently. */
  if (outcome.type === 'showdown'){
    const pots = built.__potsAtBuild;
    const layered = pots.reduce((s,p)=>s+p.amount, 0);
    const rows = outcome.potResults.reduce((s,r)=>s+r.amount, 0);
    if (layered !== rows){
      fail(fx.id + ': potResults total ' + rows + ' != computePots total ' + layered + ' ' + where);
    }
    outcome.potResults.forEach(r=>{
      const shares = r.winnerShares.reduce((s,w)=>s+w.amount, 0);
      if (shares !== r.amount){
        fail(fx.id + ': "' + r.label + '" shares ' + shares + ' != amount ' + r.amount + ' ' + where);
      }
    });
  }
}

/* Mirrors runShowdownAwardSequence() (js/06-presentation.js): every
   winner's share is credited BEFORE the reward evaluators run, which is
   why netProfit is readable at evaluation time. */
function applyPayout(g, outcome){
  (outcome.potResults || []).forEach(pot=>{
    pot.winnerShares.forEach(s=>{
      const w = g.players.find(p=>p.id === s.id);
      if (w) w.chips += s.amount;
    });
    g.pot = Math.max(0, g.pot - pot.amount);
  });
}

/* Array.from rather than .map(): the award list is built inside the VM
   realm, and a VM array is never deepStrictEqual to a host array however
   identical its contents. Copying it into a HOST array here means every
   consumer gets something it can compare directly. */
function awardIdsOf(list){ return Array.from(list || [], a=>a.id); }

/* The one canonical rendering of "what single line did this hand emit".
   A luck tag is namespaced because `lucky` is a category of statement,
   not a message id; an objective commentary id stands for itself, which
   is the form docs/scoring/SCORING_SPEC.md 3.3 and the fixtures use. */
function commentaryOf(res){
  if (!res) return null;
  if (res.luck) return 'luck:' + res.luck.id;
  if (res.commentary) return res.commentary.id;
  return null;
}

/* Runs ONE built fixture through the real evaluator, in the order
   finishHand() uses:
     evaluateArcadeAwardsEarly()  - the pot-smash path, won hands only
     resolveArcadeHandLate()      - the late path, every hand
   and returns everything either harness compares. */
async function runOne(ctx, fx, built){
  const { g, outcome } = built;
  ctx.__setGame(g);
  ctx.__presented.length = 0;

  const human = g.players.find(p=>p.isHuman);
  const grossShare = ctx.humanAwardFromOutcome(outcome);
  applyPayout(g, outcome);
  const netProfit = human.chips - g._humanStart;

  /* Career K.O. attribution (D5) is MEASURED, not assumed: the real
     resolveEliminations() decides. */
  let context = built.context;
  let measuredKO = null;
  if (built.resolveEliminations){
    const primary = await ctx.resolveEliminations(g, outcome);
    measuredKO = primary ? primary.koCount : 0;
    const aiRemaining = g.players.filter(p=>!p.isHuman && !p.eliminated);
    context = { koCount:measuredKO, tableClear:human.chips > 0 && aiRemaining.length === 0 };
  }

  let early = null;
  if (ctx.humanWonOutcome(outcome)){
    early = await ctx.evaluateArcadeAwardsEarly(g, outcome);
  }
  /* SCORE comes from what the late path RETURNS; PRESENTATION comes from
     what it pushed through the intercepted presenter. Those are two
     different questions from Phase 4C onward — a terminal hand banks
     every point it earned and shows nothing — so reading the score off
     the presentation, as this used to, would report a suppressed
     ceremony as a suppressed award. */
  const late = await ctx.resolveArcadeHandLate(g, outcome, context, !!built.terminal);
  const presentedLate = ctx.__presented.length ? ctx.__presented[ctx.__presented.length - 1] : null;

  const ids = awardIdsOf(early && early.awards).concat(awardIdsOf(late && late.awards));

  /* DELIVERED commentary, not merely detected. Detection is never
     suppressed (SCORING_SPEC.md 4), so a terminal hand's resolution can
     legitimately carry a line that the player is never shown. The
     production delivery rule lives in arcadeCommentaryText(), and asking
     it is what keeps this harness from restating that rule and drifting
     from it. */
  const delivery = { terminal:!!built.terminal, terminalBust:built.terminalKind === 'bust' };
  const deliveredText = late ? ctx.arcadeCommentaryText(late, g, delivery) : null;
  const detected = commentaryOf(late);
  const delivered = deliveredText == null ? null : detected;

  return {
    netProfit, grossShare, context, measuredKO,
    score:(early ? early.total : 0) + (late ? late.total : 0),
    /* Split out because the two totals reach a.score by different routes in
       production: the early total is banked by runPotSmashSequence's score
       roll (which these harnesses stub), the late total by either
       presentArcadeAward or bankArcadeResolution (which the real function
       does for itself). A harness topping up a.score must add only the
       early half, or it double-counts the late one. */
    earlyTotal:early ? early.total : 0,
    lateTotal:late ? late.total : 0,
    awardIds:ids,
    earlyAwardIds:awardIdsOf(early && early.awards),
    lateAwardIds:awardIdsOf(late && late.awards),
    commentary:delivered,             // what the player was actually shown
    commentaryDetected:detected,      // what the evaluator found, shown or not
    commentaryText:deliveredText,
    earlyPresented:!!early,           // runHumanPotSmashCeremony shows the breakdown + smash
    latePresented:!!presentedLate,    // the late award/commentary carousel
    lateBanked:!!late && !presentedLate && (late.total > 0 || late.awards.length > 0),
    netProfitUsed:ctx.arcadeNetProfit(g),
    potsAtEval:ctx.computePots(g.players)
  };
}

/* Mirrors computePots()'s own layering while KEEPING payers.length, so a
   harness can show what production does or does not expose. Used by F26. */
function layersWithContributors(g){
  const contributors = g.players.filter(p=>p.totalBetHand > 0);
  const levels = [...new Set(contributors.map(p=>p.totalBetHand))].sort((a,b)=>a-b);
  const out = []; let prev = 0;
  for (const level of levels){
    const layer = level - prev;
    const payers = contributors.filter(p=>p.totalBetHand >= level);
    const amount = layer * payers.length;
    if (amount > 0) out.push({
      amount,
      contributors:payers.length,
      eligible:payers.filter(p=>!p.folded).length
    });
    prev = level;
  }
  return out;
}

module.exports = {
  root, stubEl, buildContext, apiFor, validateBuilt,
  applyPayout, awardIdsOf, commentaryOf, runOne, layersWithContributors
};
