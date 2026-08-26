#!/usr/bin/env node
"use strict";

/* ============================================================
   PHASE 3 — SCORING DIAGNOSTIC AUDIT
   ============================================================

   Runs every fixture in validation/fixtures/ through the REAL, CURRENT
   evaluator and reports what it does against what
   docs/scoring/SCORING_SPEC.md requires.

   THIS HARNESS ASSERTS NO CORRECTNESS. It is a report, not a test
   suite, so no committed check ever fails and no passing assertion can
   preserve a known defect. Phase 4 adds validation/scoring-checks.js,
   which consumes the same fixture data and asserts the `expected`
   blocks for real.

   EXIT CODE
     0  the harness ran cleanly and every fixture produced a comparable
        result - INCLUDING when behavioural divergences were found.
        Divergences are this report's output, not a failure.
     1  broken harness, missing fixture id, malformed fixture, or any
        error thrown while evaluating a fixture.

   The evaluator is exercised through its own two entry points in the
   order finishHand() uses them:
     evaluateArcadeAwardsEarly()  - the pot-smash path, won hands only
     resolveArcadeHandLate()      - the late path, every hand
   Presentation is intercepted at presentArcadeResolution() so nothing
   needs a DOM; the interception records what WOULD have been shown.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const F = require('./fixtures/scoring-fixtures.js');
const FIXTURES = F.FIXTURES;
const H = F.helpers;

/* The VM context, the fixture validator and the evaluator invocation all
   live in the SHARED harness, so this report and validation/scoring-checks.js
   can never drive the evaluator differently. See its header. */
const HARNESS = require('./fixtures/scoring-harness.js');
const { root, buildContext, apiFor, runOne, layersWithContributors } = HARNESS;

const ARGS = new Set(process.argv.slice(2));
const QUIET = ARGS.has('--quiet');

let harnessError = null;
const problems = [];   // malformed fixture / missing id -> exit 1
function fail(msg){ problems.push(msg); }
function validateBuilt(fx, built, where){ return HARNESS.validateBuilt(fx, built, where, fail); }

/* ---------------- reporting ---------------- */

const rows = [];
let divergences = 0;
function record(id, channel, current, required, note){
  const same = JSON.stringify(current) === JSON.stringify(required);
  if (!same) divergences++;
  rows.push({ id, channel, current, required, same, note:note || '' });
}
function fmt(v){
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(none)';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

/* ============================================================ */

(async function main(){
  let ctx;
  try { ctx = buildContext(); }
  catch(e){ harnessError = 'context build failed: ' + e.stack; return; }

  const api = apiFor(ctx);
  const byId = new Map(FIXTURES.map(f=>[f.id, f]));
  const builtCache = new Map();

  function buildFixture(fx){
    if (builtCache.has(fx.id)) return builtCache.get(fx.id);
    const source = fx.reuse ? byId.get(fx.reuse) : fx;
    if (fx.reuse && !source){ fail(fx.id + ': reuse target "' + fx.reuse + '" does not exist'); return null; }
    if (!source.build){ fail(fx.id + ': no build() and no usable reuse target'); return null; }
    const built = source.build(api, H);
    if (built && built.g && !built.variantA){
      built.__potsAtBuild = api.computePots(built.g.players);
      validateBuilt(fx, built, '');
    }
    builtCache.set(fx.id, built);
    return built;
  }

  const results = new Map();

  for (const fx of FIXTURES){
    if (!fx.id || !fx.title || !fx.expected){ fail((fx.id || '?') + ': missing id, title or expected'); continue; }

    try {
      /* ---- F23: the leakage pair ---- */
      if (fx.leakPair){
        const pair = fx.build(api, H);
        for (const k of ['variantA','variantB']){
          pair[k].__potsAtBuild = api.computePots(pair[k].g.players);
          validateBuilt(fx, pair[k], '(' + k + ')');
        }
        const a = await runOne(ctx, fx, pair.variantA);
        const b = await runOne(ctx, fx, pair.variantB);
        const visible = r=>({ score:r.score, awardIds:r.awardIds, commentary:r.commentary,
                              latePresented:r.latePresented });
        record(fx.id, 'output identical across variants',
               JSON.stringify(visible(a)) === JSON.stringify(visible(b)), true,
               'A: ' + fmt(a.commentary) + '   B: ' + fmt(b.commentary));
        results.set(fx.id, { a, b });
        continue;
      }

      /* ---- F18: cadence over repeated hands ---- */
      if (fx.repeatOf){
        const source = byId.get(fx.repeatOf);
        if (!source){ fail(fx.id + ': repeatOf target "' + fx.repeatOf + '" does not exist'); continue; }
        /* COMMENTARY lines, not award presentations: a genuine +20bb win
           legitimately shows its score every single hand, and the cadence
           limiter has never governed that. What it governs is how often
           the soft lines speak.

           The fixture builder necessarily makes a fresh table per hand,
           but in a real run all five hands share ONE reward state — that
           is where the cadence counter lives — so it is carried across
           here, and the hand number advances, exactly as a run does. */
        let lines = 0;
        let carriedCadence;
        for (let i = 0; i < fx.repeatCount; i++){
          const built = source.build(api, H);
          built.__potsAtBuild = api.computePots(built.g.players);
          validateBuilt(fx, built, '(repeat ' + (i+1) + ')');
          const reward = built.g.run ? built.g.run.arcade : built.g.event.reward;
          reward._lastSoftCommentaryHand = carriedCadence;
          built.g.handNumber = (built.g.handNumber || 0) + i;
          const r = await runOne(ctx, fx, built);
          carriedCadence = reward._lastSoftCommentaryHand;
          if (r.commentary) lines++;
        }
        record(fx.id, 'commentary lines over ' + fx.repeatCount + ' eligible hands',
               lines, fx.expected.maxCommentaryLines,
               'cadence: one soft line every 4 hands');
        continue;
      }

      /* ---- F24: lifetime statistic predicates ---- */
      if (fx.statsAudit){
        for (const srcId of fx.statsAudit){
          const src = byId.get(srcId);
          if (!src){ fail(fx.id + ': statsAudit target "' + srcId + '" does not exist'); continue; }
          const built = src.build(api, H);
          built.__potsAtBuild = api.computePots(built.g.players);
          const potTotal = built.__potsAtBuild.reduce((s,p)=>s+p.amount, 0);
          const r = await runOne(ctx, fx, built);
          /* Measured through the REAL writers. This used to compare two
             stand-ins for them — humanWonOutcome() and the gross share —
             which was a fair reading of the code while recordPot() and
             trackEliminationHand() genuinely used those quantities, but
             would keep reporting a corrected defect as present once they
             stopped. The production functions now answer for themselves. */
          ctx.__resetStats();
          ctx.recordHandStatistics(built.g, built.outcome, r.netProfit);
          const s = ctx.__stats();
          record(fx.id, srcId + ' · counts as a hand won', s.won === 1, r.netProfit > 0,
                 'net ' + (r.netProfit >= 0 ? '+' : '') + r.netProfit);
          record(fx.id, srcId + ' · biggestPot records', s.biggestPot, r.netProfit > 0 ? r.netProfit : 0,
                 'whole table pot was ' + potTotal + ' (D13)');
          if (built.g.run){
            built.g.run.biggestPotWon = 0;
            built.g.run.tableBiggestPotWon = 0;
            ctx.trackEliminationHand(built.g, built.outcome, built.g.players.find(p=>p.isHuman), r.netProfit);
            record(fx.id, srcId + ' · run.biggestPotWon records',
                   built.g.run.biggestPotWon, r.netProfit > 0 ? r.netProfit : 0,
                   'gross share incl. uncalled returns was ' + r.grossShare + ' (D14)');
          }
        }
        continue;
      }

      /* ---- F25: player-facing label copy ---- */
      if (fx.labelAudit){
        for (const l of fx.labelAudit){
          const src = fs.readFileSync(path.join(root, l.file), 'utf8');
          const hasLegacy = src.includes(l.legacy);
          const hasRequired = src.includes(l.required);
          const strip = t=>t.replace(/[{}']/g, '').replace(/^(k|label):/, '').trim();
          record(fx.id, l.what + ' (' + l.file + ')',
                 hasRequired && !hasLegacy ? strip(l.required)
                   : hasLegacy ? strip(l.legacy) : '(neither found)',
                 strip(l.required),
                 hasLegacy || hasRequired ? '' : 'NEITHER COPY FOUND — fixture may be stale');
          if (!hasLegacy && !hasRequired){
            fail(fx.id + ': neither "' + l.legacy + '" nor "' + l.required + '" found in ' + l.file);
          }
        }
        continue;
      }

      /* ---- F26: contested vs uncalled distinguishability ---- */
      if (fx.distinguishPair){
        let ambiguousExample = null;
        let recoverable = true;
        const lines = [];
        for (const srcId of fx.distinguishPair){
          const src = byId.get(srcId);
          if (!src){ fail(fx.id + ': distinguishPair target "' + srcId + '" does not exist'); continue; }
          const built = src.build(api, H);
          /* `truth` mirrors computePots()'s layering while keeping
             payers.length independently; `actual` is what production really
             returns. Comparing them is the measurement — it used to be
             hard-coded false, which was correct while the field did not
             exist and would have kept reporting a fixed defect afterwards. */
          const truth = layersWithContributors(built.g);
          const actual = api.computePots(built.g.players);
          truth.forEach((l, i)=>{
            if (!actual[i] || actual[i].contributors !== l.contributors) recoverable = false;
          });
          lines.push(srcId + ' → ' + truth.map((l, i)=>
            '$' + l.amount + ' (contributors ' +
            (actual[i] && actual[i].contributors != null ? actual[i].contributors : 'not exposed') +
            ', eligible ' + l.eligible + ')').join('  '));
          /* Two layers in the SAME hand with an identical eligible count but
             a different contributor count are the case that proves the
             point: without the contributor count they are indistinguishable
             through what computePots() returns. */
          for (let i = 0; i < truth.length; i++) for (let j = i + 1; j < truth.length; j++){
            if (truth[i].eligible === truth[j].eligible &&
                truth[i].contributors !== truth[j].contributors && !ambiguousExample){
              const exposed = actual[i] && actual[i].contributors != null &&
                              actual[j] && actual[j].contributors != null &&
                              actual[i].contributors !== actual[j].contributors;
              ambiguousExample = { exposed, text:srcId + ': $' + truth[i].amount + ' and $' + truth[j].amount +
                ' both expose eligible=' + truth[i].eligible + ', and were paid into by ' +
                truth[i].contributors + ' and ' + truth[j].contributors + ' players' };
            }
          }
        }
        record(fx.id, 'a layer\'s contributor count is recoverable from computePots() output',
               recoverable, true, lines.join('\n          '));
        record(fx.id, 'two layers in one hand are distinguishable',
               ambiguousExample ? ambiguousExample.exposed : true, true,
               ambiguousExample ? ambiguousExample.text : 'no ambiguous pair in these fixtures');
        continue;
      }

      /* ---- F17: review-panel hidden-card leak ---- */
      if (fx.reviewLeak){
        const built = buildFixture(fx);
        if (!built) continue;
        ctx.__setGame(built.g);
        const winner = built.g.players.find(p=>p.id === built.outcome.winner.id);
        const note = ctx.foldSnapshotNote(winner);
        const namesWinnerHand = !!note && /would have made|the eventual hand was|would have tied/.test(note);
        record(fx.id, 'review note describes the never-shown winner\'s hand',
               namesWinnerHand, false,
               note ? note.slice(0, 96) + '…' : 'no note produced');
        continue;
      }

      /* ---- ordinary fixtures ---- */
      const built = buildFixture(fx);
      if (!built) continue;
      /* The profile accumulates across fixtures exactly as it would across
         a real session, so the Career boundary is checked as a BEFORE/AFTER
         delta rather than as an emptiness test. */
      const arcadeBefore = fx.assertNoArcadeWrite
        ? JSON.stringify(ctx.__Store.get('felt.arcade', null)) : null;
      const r = await runOne(ctx, fx, built);
      results.set(fx.id, r);

      if (fx.expected.score !== null && fx.expected.score !== undefined){
        record(fx.id, 'score awarded', r.score, fx.expected.score,
               'net ' + (r.netProfit >= 0 ? '+' : '') + r.netProfit +
               ' (' + (r.netProfit / built.g.bigBlind).toFixed(1) + 'bb)');
        /* A MULTISET comparison. SCORING_SPEC.md 2 specifies each award's
           presentation TIMING (POT WINNINGS first in the breakdown, K.O. a
           late stinger), not one global id sequence, and the early/late
           split means an earned set legitimately arrives in two pieces.
           The order actually emitted is reported alongside. */
        const sortIds = a=>Array.from(a || []).sort();
        record(fx.id, 'award ids (multiset)', sortIds(r.awardIds), sortIds(fx.expected.awardIds),
               'emitted in order: ' + (r.awardIds.length ? r.awardIds.join(', ') : '(none)'));
        record(fx.id, 'commentary', r.commentary, fx.expected.commentary || null, '');
        const requiredLate = !built.terminal && (fx.expected.awardIds || []).includes('ko');
        record(fx.id, 'late award carousel runs', r.latePresented, requiredLate,
               built.terminal ? 'TERMINAL HAND — nothing may precede the result stage' : '');
        if (built.terminal){
          record(fx.id, 'anything presented before the result stage',
                 r.earlyPresented || r.latePresented,
                 fx.expected.awardPresentation === 'suppressed' && r.netProfit > 0 ? true : false,
                 r.netProfit > 0 ? 'a winning terminal hand keeps its own payout ceremony' : '');
        } else if (fx.expected.awardPresentation === 'none'){
          record(fx.id, 'reward breakdown / pot smash runs', r.earlyPresented, false,
                 r.netProfit <= 0 ? 'net <= 0: the reward layer must stay silent' : '');
        }
      }

      /* ---- F15 persistence ordering ---- */
      if (fx.finalizeRun){
        const a = built.g.run.arcade;
        // Only the EARLY total: the late path banks its own points now (see
        // bankArcadeResolution), so adding r.score here would count them twice.
        a.score += r.earlyTotal;
        ctx.finalizeArcadeRun(built.g);
        if (process.env.AUDIT_DBG) console.error('DBG persists=',ctx.arcadePersists(built.g),'score=',a.score,'store=',JSON.stringify(ctx.__Store.get('felt.arcade',null)));
        const stored = ctx.__Store.get('felt.arcade', {});
        record(fx.id, 'points from the bust hand reach felt.arcade.highScore',
               (stored.highScore || 0), fx.expected.score,
               'finalizeArcadeRun() runs after mutation, so whatever was awarded is permanent');
      }

      /* ---- F14/F16 persistence boundary ---- */
      if (fx.assertNoArcadeWrite){
        const after = JSON.stringify(ctx.__Store.get('felt.arcade', null));
        const wrote = after !== arcadeBefore;
        record(fx.id, 'Career evaluation changed felt.arcade', wrote, false,
               wrote ? 'boundary VIOLATED' : 'arcadePersists() boundary holds — byte-identical before and after');
      }

    } catch(e){
      harnessError = fx.id + ' threw: ' + e.stack;
      return;
    }
  }

  /* ---------------- output ---------------- */
  if (!QUIET){
    let current = null;
    for (const row of rows){
      if (row.id !== current){
        current = row.id;
        const fx = byId.get(row.id);
        process.stdout.write('\n' + row.id + '  ' + fx.title + '\n');
        if (fx.purpose) process.stdout.write('      ' + fx.purpose + '\n');
      }
      const mark = row.same ? '  ok  ' : ' DIFF ';
      process.stdout.write('   ' + mark + row.channel + '\n');
      process.stdout.write('          current : ' + fmt(row.current) + '\n');
      process.stdout.write('          required: ' + fmt(row.required) + '\n');
      if (row.note) process.stdout.write('          ' + row.note + '\n');
    }
    process.stdout.write('\n' + '-'.repeat(64) + '\n');
    process.stdout.write('fixtures        : ' + FIXTURES.length + '\n');
    process.stdout.write('channels compared: ' + rows.length + '\n');
    process.stdout.write('DIVERGENCES     : ' + divergences + '\n');
    const stubbed = FIXTURES.filter(f=>f.luckStubbed).map(f=>f.id);
    process.stdout.write('luckStubbed     : ' + (stubbed.length ? stubbed.join(', ') : 'none — every fixture is deterministic by construction') + '\n');

    /* Persistence evidence. felt.arcade accumulated across these fixtures
       exactly as it does across a real Single Player session, so its final
       contents show precisely what a run of these hands would leave behind
       in the player's permanent profile. */
    const profile = ctx.__Store.get('felt.arcade', null);
    if (profile){
      const counts = profile.counts || {};
      process.stdout.write('\nfelt.arcade after this run (Single Player fixtures only):\n');
      process.stdout.write('  highScore   : ' + (profile.highScore || 0) + '\n');
      process.stdout.write('  counts      : ' +
        Object.keys(counts).sort().map(k=>k + '=' + counts[k]).join(', ') + '\n');
      process.stdout.write('  These are permanent. A count recorded for an award the specification\n');
      process.stdout.write('  removes cannot be recomputed and is not repaired by Phase 4.\n');
    }
    process.stdout.write('-'.repeat(64) + '\n');
  }
})().then(()=>{
  if (harnessError){
    process.stderr.write('\nHARNESS ERROR\n' + harnessError + '\n');
    process.exit(1);
  }
  if (problems.length){
    process.stderr.write('\nMALFORMED FIXTURES (' + problems.length + ')\n');
    problems.forEach(p=>process.stderr.write('  - ' + p + '\n'));
    process.exit(1);
  }
  process.exit(0);
}).catch(e=>{
  process.stderr.write('\nHARNESS ERROR\n' + (e && e.stack) + '\n');
  process.exit(1);
});
