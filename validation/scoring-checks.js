#!/usr/bin/env node
"use strict";

/* ============================================================
   PHASE 4 — SCORING CORRECTION CHECKS
   ============================================================

   The ASSERTING counterpart to validation/scoring-audit.js. Both consume
   the same fixtures in validation/fixtures/ and both drive the real
   evaluator through the same shared harness; the difference is that this
   file fails.

     scoring-audit.js  reports  current vs required, exit 0 with divergences
     scoring-checks.js asserts  required, exit 1 on any failure

   Checks land GATE BY GATE, alongside the corrections that make them
   pass (docs/scoring/SCORING_SPEC.md 6). A check is only added once the
   behaviour it asserts is required to be correct, so no committed check
   ever fails and no passing assertion preserves a defect.

     4A  pot attribution, K.O. in Career, EVENT WON, lifetime statistics,
         player-facing labels
     4B  decision awards removed from scoring and presentation
     4C  terminal-hand calculation and presentation ordering
     4D  objective commentary and the hidden-information rule

   Run:  node validation/scoring-checks.js  [--gate 4A]
   ============================================================ */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const F = require('./fixtures/scoring-fixtures.js');
const FIXTURES = F.FIXTURES;
const H = F.helpers;
const HARNESS = require('./fixtures/scoring-harness.js');
const { root, buildContext, apiFor, runOne, layersWithContributors } = HARNESS;

const ARGS = process.argv.slice(2);
const gateArg = ARGS.indexOf('--gate') >= 0 ? ARGS[ARGS.indexOf('--gate') + 1] : null;

const ctx = buildContext();
const api = apiFor(ctx);
const byId = new Map(FIXTURES.map(f => [f.id, f]));

let passed = 0;
const failures = [];
const pending = [];

function check(gate, name, fn){
  if (gateArg && gate !== gateArg) return;
  pending.push({ gate, name, fn });
}

/* Builds a fixture FRESH every time. Fixtures mutate their own table
   (chips are paid, players are eliminated, run counters move), so a
   cached build would let one check's side effects reach the next. */
function build(id){
  const fx = byId.get(id);
  assert.ok(fx, 'unknown fixture ' + id);
  const source = fx.reuse ? byId.get(fx.reuse) : fx;
  assert.ok(source && source.build, id + ': no build() and no usable reuse target');
  const built = source.build(api, H);
  built.__potsAtBuild = api.computePots(built.g.players);
  const problems = [];
  HARNESS.validateBuilt(fx, built, '', m => problems.push(m));
  assert.deepStrictEqual(problems, [], id + ': malformed fixture');
  return built;
}

function run(id){ return runOne(ctx, byId.get(id), build(id)); }

/* Award ids are compared as a MULTISET. docs/scoring/SCORING_SPEC.md 2
   specifies each award's presentation TIMING (POT WINNINGS first in the
   breakdown; K.O. as a late stinger), not one global id sequence, and the
   early/late split means the earned set legitimately arrives in two
   pieces. Ordering is asserted separately, against the rules the
   specification actually states. */
/* The harness already hands back host arrays; slice() keeps this from
   sorting a caller's array in place. */
function sortedIds(list){ return Array.from(list || []).sort(); }

const WIN_AWARDS = ['bigWin', 'massiveWin'];
const EVENT_AWARDS = ['bigWin', 'massiveWin', 'doubleUp', 'monsterHand', 'ko', 'tableClear', 'eventWon'];
/* Every id the specification removes or renames. None may survive
   anywhere in the catalogue, in any emitted award list, or in the DEV
   panel that drives the same presentation path. */
const REMOVED_IDS = [
  'bigPot', 'massivePot',
  'heroCall', 'punish',
  'monsterBluff', 'greatBluff', 'goodBluff',
  'goodFold', 'greatFold', 'hugeFold',
  'goodCall', 'greatCall',
  'goodPressure', 'goodValue', 'maxValue', 'trapWorked',
  'goodShove', 'greatShove'
];
const REMOVED_NEGATIVE_IDS = [
  'looseCall', 'badCall', 'paidThemOff', 'badFold', 'tooTight',
  'badBluff', 'reckless', 'badShove', 'overplayed', 'missedValue', 'tooPassive'
];

/* Only the event awards a gate owns are compared while decision awards
   are still in the catalogue; from 4B the full set is compared. */
function eventIdsOf(ids){ return sortedIds(Array.from(ids || []).filter(i => EVENT_AWARDS.includes(i))); }
function expectedEventIds(fx){ return eventIdsOf(fx.expected.awardIds); }

/* ============================================================
   GATE 4A — pot attribution and lifetime statistics
   ============================================================ */

/* The renamed, net-profit win awards fire exactly where net profit says
   they should, and the old contested-pot ids are gone. */
[
  ['F7',  'a genuine +20bb fold-win'],
  ['F9',  'a -35bb hand that won a contested side pot'],
  ['F10', 'a genuine +25bb win'],
  ['F11', 'an exact chop, net 0'],
  ['F14', 'a Career first place, +25bb'],
  ['F19', '+6bb behind an 880 uncalled return'],
  ['F20', 'a net-positive +20bb side-pot win'],
  ['F21', 'a -18bb side-pot win at smaller scale'],
  ['F22', '+1.5bb behind a 1,980 uncalled return']
].forEach(([id, what]) => {
  check('4A', 'F' + id.slice(1) + ' win award follows net profit — ' + what, async () => {
    const fx = byId.get(id);
    const r = await run(id);
    const gotWin = Array.from(r.awardIds).filter(i => WIN_AWARDS.includes(i));
    const wantWin = Array.from(fx.expected.awardIds || []).filter(i => WIN_AWARDS.includes(i));
    assert.deepStrictEqual(sortedIds(gotWin), sortedIds(wantWin),
      id + ': net ' + r.netProfit + ' (' + (r.netProfit / build(id).g.bigBlind).toFixed(1) + 'bb)');
  });
});

/* The whole event-award set, which is what net-profit attribution
   actually governs: MONSTER HAND and DOUBLE UP are gated on the same
   quantity and must go silent on a losing hand alongside the win award. */
['F7', 'F9', 'F10', 'F11', 'F14', 'F19', 'F20', 'F21', 'F22'].forEach(id => {
  check('4A', id + ' emits exactly the required event awards', async () => {
    const r = await run(id);
    assert.deepStrictEqual(eventIdsOf(r.awardIds), expectedEventIds(byId.get(id)));
  });
});

check('4A', 'No hand that finished net-negative or level earns any event award', async () => {
  for (const id of ['F9', 'F11', 'F21']){
    const r = await run(id);
    assert.ok(r.netProfit <= 0, id + ' should be a losing or level hand');
    assert.deepStrictEqual(eventIdsOf(r.awardIds), [],
      id + ' awarded ' + eventIdsOf(r.awardIds).join(', ') + ' on a net ' + r.netProfit + ' hand');
  }
});

check('4A', 'F9 no longer scores 800 points and a ceremony for a $700 loss', async () => {
  const r = await run('F9');
  assert.strictEqual(r.netProfit, -700);
  assert.deepStrictEqual(eventIdsOf(r.awardIds), []);
  assert.strictEqual(r.awardIds.includes('massivePot'), false);
  assert.strictEqual(r.awardIds.includes('monsterHand'), false);
});

check('4A', 'F7 a fold-win can score at all — the pot award is no longer structurally dead', async () => {
  const r = await run('F7');
  assert.strictEqual(r.netProfit, 400);
  assert.ok(r.awardIds.includes('potWinnings'), 'POT WINNINGS must fire on a fold-win');
  assert.ok(r.awardIds.includes('bigWin'), 'BIG WIN must fire on a +20bb fold-win');
});

check('4A', 'BIG WIN and MASSIVE WIN are mutually exclusive', () => {
  const A = ctx.__audit.ARCADE_AWARDS;
  assert.strictEqual(A.bigWin.family, A.massiveWin.family);
  assert.ok(A.bigWin.family, 'the win awards must share a family so only one can be kept');
});

check('4A', 'The frozen thresholds are the ones the fixture matrix was derived against', () => {
  assert.strictEqual(ctx.__audit.ARCADE_BIG_WIN_BB, F.BIG_WIN_BB);
  assert.strictEqual(ctx.__audit.ARCADE_MASSIVE_WIN_BB, F.MASSIVE_WIN_BB);
});

check('4A', 'The contested-pot measure is gone from production', () => {
  assert.strictEqual(typeof ctx.arcadeContestedPot, 'undefined',
    'arcadeContestedPot() must not survive — it is the quantity F9 fired on');
  assert.strictEqual(typeof ctx.arcadeNetProfit, 'function');
});

check('4A', 'BIG POT and MASSIVE POT no longer exist as awards', () => {
  const A = ctx.__audit.ARCADE_AWARDS;
  assert.strictEqual(A.bigPot, undefined);
  assert.strictEqual(A.massivePot, undefined);
  assert.strictEqual(A.bigWin.name, 'BIG WIN');
  assert.strictEqual(A.massiveWin.name, 'MASSIVE WIN');
});

/* ---- D5 / D6: Career's terminal hand ---- */

check('4A', 'F14 K.O. fires in Career — resolveEliminations attributes it for real', async () => {
  const r = await run('F14');
  assert.strictEqual(r.measuredKO, 1, 'Career has no g.run; the K.O. must be attributed anyway');
  assert.ok(r.awardIds.includes('ko'));
});

check('4A', 'F14 Career awards EVENT WON, never the literal name TABLE CLEARED', async () => {
  const r = await run('F14');
  assert.ok(r.awardIds.includes('eventWon'), 'Career first place must award eventWon');
  assert.strictEqual(r.awardIds.includes('tableClear'), false,
    'a Career event must never print TABLE CLEARED');
  assert.strictEqual(ctx.__audit.ARCADE_AWARDS.eventWon.name, 'EVENT WON');
  assert.strictEqual(ctx.__audit.ARCADE_AWARDS.eventWon.base,
                     ctx.__audit.ARCADE_AWARDS.tableClear.base,
                     'the same condition is worth the same in both modes');
});

check('4A', 'F13 Single Player still awards TABLE CLEARED, not EVENT WON', async () => {
  const r = await run('F13');
  assert.ok(r.awardIds.includes('tableClear'));
  assert.strictEqual(r.awardIds.includes('eventWon'), false);
});

check('4A', 'A Single Player run still counts its own K.O.s', async () => {
  const built = build('F13');
  const r = await runOne(ctx, byId.get('F13'), built);
  assert.strictEqual(r.measuredKO, 1);
  assert.strictEqual(built.g.run.totalKOs, 1, 'the run counters stay gated on g.run and still move');
  assert.strictEqual(built.g.run.tableKOs, 1);
});

check('4A', 'A Career K.O. writes no Single Player run counter', async () => {
  const built = build('F14');
  await runOne(ctx, byId.get('F14'), built);
  assert.strictEqual(built.g.run, undefined, 'a Career event must have no run state at all');
});

/* ---- 5.1: lifetime statistics, through the real writers ---- */

/* F24 names the five settled hands the statistic predicates are checked
   against. Each is replayed through the REAL production writers rather
   than through a restatement of their rules. */
const STATS_CASES = byId.get('F24').statsAudit;

STATS_CASES.forEach(id => {
  check('4A', 'F24 · ' + id + ' counts as a hand won only when the player finished ahead', async () => {
    const built = build(id);
    const r = await runOne(ctx, byId.get(id), built);
    ctx.__resetStats();
    ctx.recordHandStatistics(built.g, built.outcome, r.netProfit);
    const s = ctx.__stats();
    assert.strictEqual(s.won, r.netProfit > 0 ? 1 : 0,
      id + ': net ' + r.netProfit + ' recorded won=' + s.won);
  });

  check('4A', 'F24 · ' + id + ' biggestPot records net profit, not the table pot', async () => {
    const built = build(id);
    const potTotal = built.__potsAtBuild.reduce((s, p) => s + p.amount, 0);
    const r = await runOne(ctx, byId.get(id), built);
    ctx.__resetStats();
    ctx.recordHandStatistics(built.g, built.outcome, r.netProfit);
    const s = ctx.__stats();
    assert.strictEqual(s.biggestPot, r.netProfit > 0 ? r.netProfit : 0,
      id + ': table pot was ' + potTotal + ', net was ' + r.netProfit);
    if (potTotal !== r.netProfit){
      assert.notStrictEqual(s.biggestPot, potTotal, id + ': the whole table pot must not be recorded');
    }
  });

  check('4A', 'F24 · ' + id + ' run.biggestPotWon records net profit, not the gross share', async () => {
    const built = build(id);
    if (!built.g.run) return;                      // Career keeps no run statistics
    const r = await runOne(ctx, byId.get(id), built);
    built.g.run.biggestPotWon = 0;
    built.g.run.tableBiggestPotWon = 0;
    ctx.trackEliminationHand(built.g, built.outcome, built.g.players.find(p => p.isHuman), r.netProfit);
    assert.strictEqual(built.g.run.biggestPotWon, Math.max(0, r.netProfit),
      id + ': gross share was ' + r.grossShare + ', net was ' + r.netProfit);
    assert.strictEqual(built.g.run.tableBiggestPotWon, Math.max(0, r.netProfit));
  });
});

check('4A', 'F24 · an exact split is not a hand won', async () => {
  const built = build('F11');
  const r = await runOne(ctx, byId.get('F11'), built);
  assert.strictEqual(r.netProfit, 0, 'F11 must be an exact chop');
  ctx.__resetStats();
  ctx.recordHandStatistics(built.g, built.outcome, r.netProfit);
  assert.strictEqual(ctx.__stats().won, 0);
  assert.strictEqual(ctx.__stats().showdownsWon, 0);
});

check('4A', 'F24 · a net-negative side-pot share is not a hand won', async () => {
  for (const id of ['F9', 'F21']){
    const built = build(id);
    const r = await runOne(ctx, byId.get(id), built);
    assert.ok(r.grossShare > 0, id + ': the player must genuinely have been paid a layer');
    ctx.__resetStats();
    ctx.recordHandStatistics(built.g, built.outcome, r.netProfit);
    assert.strictEqual(ctx.__stats().won, 0, id);
    assert.strictEqual(ctx.__stats().showdownsWon, 0, id);
  }
});

check('4A', 'F24 · a genuine net win is still recorded', async () => {
  const built = build('F20');
  const r = await runOne(ctx, byId.get('F20'), built);
  ctx.__resetStats();
  ctx.recordHandStatistics(built.g, built.outcome, r.netProfit);
  const s = ctx.__stats();
  assert.strictEqual(s.won, 1);
  assert.strictEqual(s.showdownsWon, 1, 'the human was a contender and finished ahead');
  assert.strictEqual(s.biggestPot, 400);
});

check('4A', 'DEFAULT_STATS keeps its shape — no ties field, no schema change', () => {
  ctx.__resetStats();
  assert.deepStrictEqual(Object.keys(ctx.__stats()).sort(),
    ['biggestPot', 'hands', 'net', 'showdownsWon', 'won']);
});

check('4A', 'The gross-pot writers are gone from the settlement paths', () => {
  const src = fs.readFileSync(path.join(root, 'js/05-game-engine.js'), 'utf8');
  assert.strictEqual(/function recordPot\(/.test(src), false,
    'recordPot() banked the whole table pot into stats.biggestPot');
  assert.ok(/function recordHandStatistics\(/.test(src));
  const settlement = src.slice(src.indexOf('async function handleFoldWin'), src.indexOf('function humanWonOutcome'));
  assert.strictEqual(/stats\.won\+\+/.test(settlement), false,
    'handleFoldWin/handleShowdown must not write stats.won before the hand has settled');
  assert.strictEqual(/stats\.showdownsWon\+\+/.test(settlement), false);
});

/* ---- 5.2: the copy ships in the same gate as the meaning ---- */

byId.get('F25').labelAudit.forEach(l => {
  check('4A', 'F25 · ' + l.what + ' reads the corrected copy (' + l.file + ')', () => {
    const src = fs.readFileSync(path.join(root, l.file), 'utf8');
    assert.ok(src.includes(l.required), 'missing required copy ' + l.required);
    assert.strictEqual(src.includes(l.legacy), false, 'stale gross-pot copy still present: ' + l.legacy);
  });
});

/* ============================================================
   GATE 4B — decision awards removed from scoring and presentation
   ============================================================ */

check('4B', 'The award catalogue contains ONLY the objective awards', () => {
  const ids = Object.keys(ctx.__audit.ARCADE_AWARDS).sort();
  assert.deepStrictEqual(ids,
    ['bigWin', 'doubleUp', 'eventWon', 'ko', 'massiveWin', 'monsterHand', 'tableClear']);
});

check('4B', 'Nothing in the catalogue is a skill/decision award any more', () => {
  Object.entries(ctx.__audit.ARCADE_AWARDS).forEach(([id, def]) => {
    assert.strictEqual(def.type, 'event', id + ' has type "' + def.type + '"');
  });
});

check('4B', 'Every removed decision award is gone from the catalogue', () => {
  REMOVED_IDS.forEach(id =>
    assert.strictEqual(ctx.__audit.ARCADE_AWARDS[id], undefined, id + ' still exists'));
});

check('4B', 'The negative catalogue is deleted, not disabled', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  assert.strictEqual(/const ARCADE_NEGATIVE\s*=/.test(src), false);
  assert.strictEqual(/function evaluateArcadeNegative\(/.test(src), false);
  REMOVED_NEGATIVE_IDS.forEach(id =>
    assert.strictEqual(new RegExp("\\b" + id + "\\s*:").test(src), false, id + ' still defined'));
});

check('4B', 'The decision evaluator and its hidden-card helpers are deleted', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  ['evaluateArcadeSkill', 'findArcadeFoldBluff', 'isMonsterBluff', 'findCallerOf', 'heroCatAtSnapshot']
    .forEach(fn => assert.strictEqual(new RegExp("function " + fn + "\\(").test(src), false,
      fn + '() must be deleted, not left unreferenced'));
});

check('4B', 'No removed id survives anywhere in production, including the DEV panel', () => {
  ['js/04-modes-and-scoring.js', 'js/05-game-engine.js', 'js/06-presentation.js',
   'js/07-ui-wiring.js', 'js/08-dev-mode.js'].forEach(file => {
    const src = fs.readFileSync(path.join(root, file), 'utf8')
      /* Strip block and line comments: the deleted awards are named in the
         comments that record WHY they were removed, and that record is the
         point. Only live code is searched. */
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    REMOVED_IDS.concat(REMOVED_NEGATIVE_IDS).forEach(id => {
      assert.strictEqual(src.includes("'" + id + "'"), false, file + ' still references ' + id);
      assert.strictEqual(src.includes('"' + id + '"'), false, file + ' still references ' + id);
    });
  });
});

/* Every fixture with a required award set now has its FULL set compared,
   not just the event subset: with the decision catalogue gone there is
   nothing else that can legitimately appear. */
FIXTURES.filter(fx => fx.expected && Array.isArray(fx.expected.awardIds) && (fx.build || fx.reuse))
  .forEach(fx => {
    check('4B', fx.id + ' emits exactly the required awards, and nothing else', async () => {
      const r = await run(fx.id);
      assert.deepStrictEqual(sortedIds(r.awardIds), sortedIds(fx.expected.awardIds));
    });
    check('4B', fx.id + ' scores exactly the required total', async () => {
      const r = await run(fx.id);
      assert.strictEqual(r.score, fx.expected.score);
    });
  });

check('4B', 'F2 a sound call that lost scores nothing', async () => {
  const r = await run('F2');
  assert.ok(r.netProfit < 0);
  assert.strictEqual(r.score, 0);
  assert.deepStrictEqual(sortedIds(r.awardIds), []);
});

check('4B', 'F5 a fold the player took no part in winning scores nothing', async () => {
  const r = await run('F5');
  assert.strictEqual(r.score, 0);
  assert.deepStrictEqual(sortedIds(r.awardIds), []);
});

check('4B', 'POT WINNINGS is still the first line of the breakdown when it fires', async () => {
  for (const id of ['F1', 'F7', 'F10', 'F20']){
    const r = await run(id);
    assert.strictEqual(r.earlyAwardIds[0], 'potWinnings', id);
  }
});

check('4B', 'K.O. is a late stinger, never part of the early breakdown', async () => {
  const r = await run('F20');
  assert.strictEqual(Array.from(r.earlyAwardIds).includes('ko'), false);
  assert.ok(Array.from(r.lateAwardIds).includes('ko'));
});

check('4B', 'Decision-time equity is no longer requested from the live game', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  const capture = src.slice(src.indexOf('function captureArcadeDecision('),
                            src.indexOf('async function settleArcadeSnapshots('));
  assert.strictEqual(/EquityService/.test(capture), false,
    'captureArcadeDecision() must not call the uniformly-random equity model');
  assert.strictEqual(/equityPromise/.test(capture), false);
});

check('4B', 'Snapshots are still captured, because the luck tag needs their sizing', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  assert.ok(/a\.decisionSnapshots\.push\(snap\)/.test(src));
  assert.ok(/function classifyArcadeLuck\(/.test(src));
});

check('4B', 'The score counter itself is intact — it is not XP and it is not removed', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  assert.ok(/function updateArcadeHUD\(/.test(src), 'the SCORE readout must survive');
  assert.ok(/function rollArcadeCounter\(/.test(src));
  assert.ok(/function formatArcadeScore\(/.test(src));
  /* The counter is kept and is NOT XP. Every mention of XP in the source
     must be a denial of it — the canonical description's own wording —
     never a field, a level, or anything the score is spent on. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  code.split('\n').filter(l => /\bXP\b/.test(l)).forEach(l => {
    assert.ok(l.includes('It is not profit, skill, XP or Career progression.'),
      'unexpected XP reference: ' + l.trim());
  });
  ['xpEarned', 'xpTotal', '.xp', 'level:', 'perk'].forEach(t =>
    assert.strictEqual(code.includes(t), false, 'progression concept leaked in: ' + t));
});

check('4B', 'Career still persists no score', async () => {
  const before = JSON.stringify(ctx.__Store.get('felt.arcade', null));
  await run('F14');
  assert.strictEqual(JSON.stringify(ctx.__Store.get('felt.arcade', null)), before,
    'a Career evaluation must leave felt.arcade byte-identical');
});

check('4B', 'The Scoring Guide states what the counter is, and grades no decision', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  const guide = src.slice(src.indexOf('function buildScoringGuide('),
                          src.indexOf('function makeEliminationRun('));
  assert.ok(guide.includes('It is not profit, skill, XP or Career progression.'),
    'the canonical description (SCORING_SPEC.md 1) must appear verbatim');
  assert.strictEqual(/negative feedback/.test(guide), false);
});

/* ============================================================
   GATE 4C — terminal-hand calculation and presentation ordering
   ============================================================ */

/* SCORING_SPEC.md 4: a terminal hand still DETECTS and still MUTATES.
   Only the celebration is suppressed. */
function rewardStateOf(g){ return g.run ? g.run.arcade : g.event.reward; }

['F3', 'F12', 'F13', 'F14', 'F19'].forEach(id => {
  check('4C', id + ' is terminal — no late award carousel precedes the result stage', async () => {
    const built = build(id);
    assert.strictEqual(built.terminal, true, id + ' must be a terminal fixture');
    const r = await runOne(ctx, byId.get(id), built);
    assert.strictEqual(r.latePresented, false,
      'presented ' + Array.from(r.lateAwardIds).join(', ') + ' before the result stage');
  });

  check('4C', id + ' still earns every objective point it detected', async () => {
    const built = build(id);
    const r = await runOne(ctx, byId.get(id), built);
    assert.strictEqual(r.score, byId.get(id).expected.score,
      'detection and mutation must run even when presentation does not');
  });
});

check('4C', 'F13/F14/F19 bank their terminal points into the live score, once', async () => {
  for (const id of ['F13', 'F14', 'F19']){
    const built = build(id);
    const a = rewardStateOf(built.g);
    a.score = 0; a.displayedScore = 0;
    const r = await runOne(ctx, byId.get(id), built);
    assert.ok(r.lateTotal > 0, id + ': a terminal winning hand must earn late points');
    assert.strictEqual(a.score, r.lateTotal, id + ': banked exactly once');
    assert.strictEqual(a.displayedScore, a.score,
      id + ': the counter is set equal, not left mid-roll behind the result stage');
  }
});

check('4C', 'F12 the reported defeat sequence — nothing at all is presented', async () => {
  const built = build('F12');
  assert.strictEqual(built.terminalKind, 'bust');
  const r = await runOne(ctx, byId.get('F12'), built);
  assert.strictEqual(r.earlyPresented, false, 'no reward breakdown or pot smash on a busting hand');
  assert.strictEqual(r.latePresented, false, 'no award carousel between the bust and RUN OVER');
  assert.strictEqual(r.score, 0);
  assert.deepStrictEqual(sortedIds(r.awardIds), []);
});

check('4C', 'F15 no point from the bust hand reaches the permanent high score', async () => {
  const built = build('F15');
  const a = built.g.run.arcade;
  a.score = 0; a.displayedScore = 0;
  const r = await runOne(ctx, byId.get('F15'), built);
  a.score += r.earlyTotal;
  ctx.__Store.set('felt.arcade', Object.assign({}, ctx.__audit.ARCADE_PROFILE_DEFAULT));
  ctx.finalizeArcadeRun(built.g);
  const stored = ctx.__Store.get('felt.arcade', {});
  assert.strictEqual(stored.highScore || 0, byId.get('F15').expected.score);
});

check('4C', 'F13 a terminal WINNING hand keeps the pot smash for its own payout', async () => {
  const r = await run('F13');
  assert.ok(r.netProfit > 0);
  assert.strictEqual(r.earlyPresented, true,
    'the early ceremony for the hand the player actually won is retained');
  assert.strictEqual(r.latePresented, false,
    'only the late K.O./TABLE CLEARED carousel is suppressed');
});

check('4C', 'A non-terminal K.O. still gets its late stinger', async () => {
  const built = build('F20');
  assert.strictEqual(!!built.terminal, false);
  const r = await runOne(ctx, byId.get('F20'), built);
  assert.ok(Array.from(r.lateAwardIds).includes('ko'));
  assert.strictEqual(r.latePresented, true, 'a non-terminal hand is unchanged');
});

check('4C', 'Nothing is presented for a hand that earned nothing', async () => {
  for (const id of ['F9', 'F11', 'F21']){
    const built = build(id);
    const r = await runOne(ctx, byId.get(id), built);
    assert.strictEqual(r.score, 0, id);
    assert.strictEqual(r.latePresented, false, id + ': no award carousel');
  }
});

check('4C', 'Detection and mutation are separated from presentation in the source', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  assert.ok(/async function resolveArcadeHandScore\(/.test(src));
  assert.ok(/function bankArcadeResolution\(/.test(src));
  const scoreFn = src.slice(src.indexOf('async function resolveArcadeHandScore('),
                            src.indexOf('function bankArcadeResolution('));
  assert.strictEqual(/present[A-Z]/.test(scoreFn), false,
    'the detection pass must present nothing');
  assert.strictEqual(/queueArcadePresentation/.test(scoreFn), false);
});

check('4C', 'finishHand decides terminality BEFORE it presents', () => {
  const src = fs.readFileSync(path.join(root, 'js/05-game-engine.js'), 'utf8');
  const body = src.slice(src.indexOf('async function finishHand('), src.indexOf('function processLives('));
  ['elimination', 'career'].forEach(() => {});
  const terminalAt = body.indexOf('const terminal =');
  const resolveAt = body.indexOf('await resolveArcadeHandLate(');
  assert.ok(terminalAt > -1, 'terminality must be computed explicitly');
  assert.ok(terminalAt < resolveAt, 'terminality must be known before the late path runs');
  assert.strictEqual((body.match(/const terminal =/g) || []).length, 2,
    'both elimination and Career must decide it');
  assert.strictEqual((body.match(/resolveArcadeHandLate\(g,outcome,\{[\s\S]*?\},terminal\)/g) || []).length, 2,
    'both call sites must pass it');
});

check('4C', 'The four major result transitions are still reachable and unchanged', () => {
  const src = fs.readFileSync(path.join(root, 'js/05-game-engine.js'), 'utf8');
  ['function tableClearedModel(', 'function runOverModel(', 'function careerStageModel(',
   'function presentResultStage(', 'function resultStageHTML(']
    .forEach(fn => assert.ok(src.includes(fn), fn + ' must still exist'));
  const body = src.slice(src.indexOf('async function finishHand('), src.indexOf('function processLives('));
  assert.ok(/showBusted\(g, human\)/.test(body));
  assert.ok(/concludeGame\(\)/.test(body));
  assert.strictEqual((body.match(/endCareerEvent\(g,\{place:careerFinishPlace\(g,human\)\}\)/g) || []).length, 2);
});

/* ============================================================
   GATE 4D — objective commentary and the hidden-information rule
   ============================================================ */

/* Every fixture that states a required line now has it asserted. This is
   the DELIVERED line — what the player was shown — because detection is
   deliberately never suppressed (SCORING_SPEC.md 4). */
FIXTURES.filter(fx => fx.expected && 'commentary' in fx.expected && (fx.build || fx.reuse) && !fx.leakPair)
  .forEach(fx => {
    check('4D', fx.id + ' delivers exactly the required commentary line', async () => {
      const r = await run(fx.id);
      assert.strictEqual(r.commentary, fx.expected.commentary || null);
    });
  });

check('4D', 'At most ONE commentary line per hand, ever', async () => {
  for (const fx of FIXTURES.filter(f => (f.build || f.reuse) && !f.leakPair)){
    const built = build(fx.id);
    const r = await runOne(ctx, fx, built);
    const emitted = [r.commentary].filter(Boolean);
    assert.ok(emitted.length <= 1, fx.id + ' emitted ' + emitted.length + ' lines');
  }
});

/* ---- 3.2: the hidden-information rule ---- */

check('4D', 'F23 hidden cards changed, every visible fact identical — output is identical', async () => {
  const fx = byId.get('F23');
  const pair = fx.build(api, H);
  const seen = {};
  for (const k of ['variantA', 'variantB']){
    pair[k].__potsAtBuild = api.computePots(pair[k].g.players);
    const problems = [];
    HARNESS.validateBuilt(fx, pair[k], '(' + k + ')', m => problems.push(m));
    assert.deepStrictEqual(problems, [], 'F23 ' + k + ': malformed fixture');
    const r = await runOne(ctx, fx, pair[k]);
    seen[k] = {
      score: r.score,
      awardIds: sortedIds(r.awardIds),
      commentary: r.commentary,
      commentaryDetected: r.commentaryDetected,
      commentaryText: r.commentaryText,
      latePresented: r.latePresented
    };
  }
  assert.deepStrictEqual(seen.variantA, seen.variantB,
    'folded opponents holding nothing vs holding monsters must be indistinguishable');
});

check('4D', 'F23 the absence of a line is identical too, not just its wording', async () => {
  const fx = byId.get('F23');
  const pair = fx.build(api, H);
  const a = await runOne(ctx, fx, pair.variantA);
  const b = await runOne(ctx, fx, pair.variantB);
  assert.strictEqual(a.commentary === null, b.commentary === null,
    'whether a message appears at all is itself information');
});

check('4D', 'A luck tag never fires on a fold-win, whatever the folded hands held', async () => {
  for (const id of ['F7', 'F22']){
    const r = await run(id);
    assert.strictEqual(String(r.commentaryDetected || '').startsWith('luck:'), false,
      id + ': a fold-win reveals nothing, so no luck tag may be derived from it');
  }
});

check('4D', 'A luck tag still fires when the cards were genuinely shown down', async () => {
  const r = await run('F3');
  assert.strictEqual(r.commentary, 'luck:filthy',
    'a 0%-equity suck-out at a showdown is a public fact');
});

check('4D', 'F17 the review panel never describes a never-shown winning hand', async () => {
  const built = build('F17');
  ctx.__setGame(built.g);
  const winner = built.g.players.find(p => p.id === built.outcome.winner.id);
  assert.strictEqual(ctx.foldSnapshotNote(winner, false), null,
    'an unshown winner must produce no note');
  const review = ctx.buildReview(built.outcome);
  const text = Array.from(review.rows).join(' ');
  [/would have made/, /the eventual hand was/, /would have tied/].forEach(re =>
    assert.strictEqual(re.test(text), false, 'review leaked the winner\'s hand: ' + text));
});

check('4D', 'F17 the fold-win review still states the one public fact', async () => {
  const built = build('F17');
  ctx.__setGame(built.g);
  const review = ctx.buildReview(built.outcome);
  const text = Array.from(review.rows).join(' ');
  assert.ok(/their cards were never shown/.test(text),
    'the honest statement replaces the leak, rather than leaving silence');
});

check('4D', 'The hidden-card triggers are gone from the source entirely', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.strictEqual(/confirmedGoodRead/.test(src), false,
    'hidden cards must not decide whether a message appears');
  assert.strictEqual(/personality\.tightness/.test(src), false,
    'commentary must not read the AI\'s hidden personality');
  assert.ok(/function luckOpponentsWereRevealed\(/.test(src),
    'the luck tag needs an explicit showdown-revealed gate');
});

/* ---- 3.3: the settlement facts, and the count that makes them possible ---- */

check('4D', 'F26 computePots() exposes each layer\'s contributor count', () => {
  for (const id of byId.get('F26').distinguishPair){
    const built = build(id);
    const truth = layersWithContributors(built.g);
    const actual = api.computePots(built.g.players);
    assert.strictEqual(actual.length, truth.length, id);
    truth.forEach((l, i) => assert.strictEqual(actual[i].contributors, l.contributors,
      id + ' layer ' + i + ' ($' + l.amount + ')'));
    /* The additive field must not have disturbed what was already there. */
    truth.forEach((l, i) => assert.strictEqual(actual[i].eligible.length, l.eligible, id));
  }
});

check('4D', 'F26 the two facts F9 and F22 represent are now distinguishable', async () => {
  const nine = await run('F9');
  const twentyTwo = await run('F22');
  assert.strictEqual(nine.commentary, 'sidePotWonNetLoss',
    'opponents\' money genuinely won, on a hand finished behind');
  assert.strictEqual(twentyTwo.commentary, 'uncalledBetReturned',
    'the player\'s own unmatched stake coming back');
  assert.notStrictEqual(nine.commentary, twentyTwo.commentary);
});

check('4D', 'A contested side-pot win and an uncalled return never share wording', () => {
  const a = ctx.commentaryLine('sidePotWonNetLoss', {});
  const b = ctx.commentaryLine('uncalledBetReturned', {});
  assert.ok(a && b);
  assert.notStrictEqual(a, b);
});

check('4D', 'Every commentary id resolves to real text through the one lookup', () => {
  Object.keys(ctx.__audit.ARCADE_COMMENTARY).forEach(id => {
    const line = ctx.commentaryLine(id, {});
    assert.ok(line && line.length, id + ' has no text');
  });
  Object.keys(ctx.__audit.ARCADE_LUCK).forEach(id => {
    assert.ok(ctx.commentaryLine(id, {}), id + ' has no text');
  });
});

/* ---- 3.4: priority and cadence ---- */

check('4D', 'F18 soft lines are rate limited to one every four hands', async () => {
  const fx = byId.get('F18');
  const source = byId.get(fx.repeatOf);
  let lines = 0, carried;
  for (let i = 0; i < fx.repeatCount; i++){
    const built = source.build(api, H);
    built.__potsAtBuild = api.computePots(built.g.players);
    const reward = built.g.run ? built.g.run.arcade : built.g.event.reward;
    reward._lastSoftCommentaryHand = carried;
    built.g.handNumber = (built.g.handNumber || 0) + i;
    const r = await runOne(ctx, fx, built);
    carried = reward._lastSoftCommentaryHand;
    if (r.commentary) lines++;
  }
  assert.ok(lines <= fx.expected.maxCommentaryLines,
    lines + ' lines over ' + fx.repeatCount + ' eligible hands, limit ' + fx.expected.maxCommentaryLines);
  assert.ok(lines >= 1, 'the limiter must not silence the line entirely');
});

check('4D', 'Hard settlement facts are exempt from the cadence limiter', async () => {
  /* Three consecutive hands, each with a soft line notionally just fired,
     so the limiter is fully closed every time. A hard settlement fact must
     still speak on all three: they are rare by construction and always
     worth stating. */
  for (let i = 0; i < 3; i++){
    const built = build('F9');
    built.g.handNumber = 10 + i;
    built.g.run.arcade._lastSoftCommentaryHand = built.g.handNumber;
    const r = await runOne(ctx, byId.get('F9'), built);
    assert.strictEqual(r.commentary, 'sidePotWonNetLoss', 'hand ' + built.g.handNumber);
  }
});

check('4D', 'The limiter really does close on a soft line', async () => {
  const built = build('F7');
  built.g.handNumber = 20;
  built.g.run.arcade._lastSoftCommentaryHand = 19;        // one hand ago
  const r = await runOne(ctx, byId.get('F7'), built);
  assert.strictEqual(r.commentary, null,
    'a soft line one hand after the last one must stay silent');
});

check('4D', 'The cadence counter is per reward state, so modes cannot leak into each other', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  assert.ok(/a\._lastSoftCommentaryHand/.test(src),
    'the counter must live on the mode\'s own reward state');
  assert.strictEqual(/^let _lastSoftCommentaryHand/m.test(src), false,
    'a module-level counter would leak between a Career event and a run');
});

/* ---- 3.5: delivery surface ---- */

check('4D', 'Commentary never uses the reward layer', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  assert.strictEqual(/function presentArcadeCommentary\(/.test(src), false,
    'the reward layer is scoring awards only');
  const present = src.slice(src.indexOf('async function presentArcadeResolution('),
                            src.indexOf('function finalizeArcadeRun('));
  assert.strictEqual(/r\.luck/.test(present), false);
  assert.strictEqual(/r\.commentary/.test(present), false);
});

check('4D', 'The CRT action line is the delivery surface, at the Hand complete beat', () => {
  const src = fs.readFileSync(path.join(root, 'js/05-game-engine.js'), 'utf8');
  const body = src.slice(src.indexOf('async function finishHand('), src.indexOf('function processLives('));
  assert.ok(/setBanner\(handCommentary \? esc\(handCommentary\) : 'Hand complete\.'\)/.test(body),
    'the line must replace the existing Hand complete. beat on #banner');
  assert.ok(/arcadeCommentaryText\(resolved, g, \{ terminal, terminalBust:human\.chips<=0 \}\)/.test(body));
});

check('4D', 'A terminal busting hand delivers nothing at all', async () => {
  const r = await run('F12');
  assert.strictEqual(r.commentary, null);
  assert.strictEqual(r.commentaryText, null);
  assert.strictEqual(r.earlyPresented, false);
  assert.strictEqual(r.latePresented, false);
});

check('4D', 'A terminal winning hand states no settlement line over its result stage', async () => {
  const r = await run('F19');
  assert.strictEqual(r.commentaryDetected, 'uncalledBetReturned',
    'detection still runs on a terminal hand');
  assert.strictEqual(r.commentary, null,
    'but the result stage is about to state the settlement itself');
});

/* ---- 3.6: no solver certainty ---- */

check('4D', 'No commentary line grades a decision, quotes a number, or claims a correct play', () => {
  const forbidden = [
    /should have/i, /correct play/i, /you were right/i, /%/, /\bEV\b/,
    /\bgood\b/i, /\bbad\b/i, /\bgreat\b/i, /\bmistake\b/i, /\bwrong\b/i,
    /\bequity\b/i, /\bodds\b/i
  ];
  const ids = Object.keys(ctx.__audit.ARCADE_COMMENTARY);
  ids.forEach(id => {
    const line = ctx.commentaryLine(id, {});
    forbidden.forEach(re => assert.strictEqual(re.test(line), false,
      id + ' — "' + line + '" violates SCORING_SPEC.md 3.6 (' + re + ')'));
  });
});

check('4D', 'No range model or decision advice was built', () => {
  const src = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
  ['rightPrice', 'RIGHT PRICE', 'valueLeftBehind', 'decisionQuality', 'rangeModel',
   'conditionedRange', 'toughResult'].forEach(t =>
    assert.strictEqual(src.includes(t), false, 'decision analysis leaked in: ' + t));
});

/* ============================================================
   REPORT
   ============================================================ */

(async function main(){
  for (const c of pending){
    try {
      await c.fn();
      passed++;
      process.stdout.write('PASS  [' + c.gate + '] ' + c.name + '\n');
    } catch (e){
      failures.push({ c, e });
      process.stdout.write('FAIL  [' + c.gate + '] ' + c.name + '\n');
      process.stdout.write('        ' + (e && e.message ? String(e.message).split('\n')[0] : e) + '\n');
    }
  }
  process.stdout.write('\n');
  if (failures.length){
    process.stdout.write(failures.length + ' of ' + pending.length + ' scoring checks FAILED.\n');
    failures.forEach(f => {
      process.stderr.write('\n[' + f.c.gate + '] ' + f.c.name + '\n' + (f.e && f.e.stack ? f.e.stack : f.e) + '\n');
    });
    process.exit(1);
  }
  process.stdout.write(passed + ' Phase 4 scoring checks passed.\n');
  process.exit(0);
})().catch(e => {
  process.stderr.write('\nHARNESS ERROR\n' + (e && e.stack) + '\n');
  process.exit(1);
});
