#!/usr/bin/env node
"use strict";
/* AI behaviour checks (docs/ai/AI_PLAN.md).

   Step 1 scope: the position fix and the measuring table itself. The
   tier stat bands in validation/tools/ai-harness.js are NOT asserted yet —
   the current AI doesn't meet them; later steps tune it in and then
   promote those bands into checks here. Full reports:
   node validation/tools/ai-sim.js */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { simulate, summarize, loadAI, PROBES, TIER_TARGETS } = require('./tools/ai-harness');

let passed = 0;
async function check(name, fn){ await fn(); passed++; process.stdout.write('PASS  ' + name + '\n'); }

function table(n, dealer, overrides){
  const players = Array.from({length:n}, (_, i) => Object.assign({ id:'p'+i, inHand:true, folded:false, allIn:false }, (overrides||{})[i]));
  return { players, dealerIndex:dealer };
}

(async () => {
  const A = loadAI(7);

  await check('Button is last to act: nobody sits after it', () => {
    A.setGame(table(6, 2));
    assert.strictEqual(A.seatsAfter(2), 0);
  });
  await check('Small blind has every live opponent after it', () => {
    A.setGame(table(6, 2));
    assert.strictEqual(A.seatsAfter(3), 5);
    assert.strictEqual(A.seatsAfter(4), 4);
    assert.strictEqual(A.seatsAfter(1), 1);   // cutoff: only the button behind
  });
  await check('Folded and all-in opponents do not count as acting after', () => {
    A.setGame(table(6, 2, { 1:{ folded:true }, 2:{ allIn:true }, 5:{ inHand:false } }));
    assert.strictEqual(A.seatsAfter(3), 2);   // seats 4 and 0 remain behind the SB
  });
  await check('Heads-up: the dealer acts last postflop, the big blind first', () => {
    A.setGame(table(2, 0));
    assert.strictEqual(A.seatsAfter(0), 0);
    assert.strictEqual(A.seatsAfter(1), 1);
  });
  await check('Position now reaches the AI: seats differ unless everyone is behind', () => {
    // the aiDecide term is positionWeight * (1 - seatsAfter/numOpp); before
    // the fix seatsAfter always equalled numOpp, so it was zero everywhere
    A.setGame(table(4, 0));
    const numOpp = 3;
    const terms = [0,1,2,3].map(i => 1 - A.seatsAfter(i)/numOpp);
    assert.deepStrictEqual(terms.map(t => +t.toFixed(3)), [1, 0, 0.333, 0.667]);
    Object.values(A.DIFFICULTY_PARAMS).forEach(dp => assert.ok(dp.positionWeight >= 0));
  });

  await check('Every Career event difficulty has a tier target', () => {
    const modes = fs.readFileSync(path.join(__dirname, '..', 'js/04-modes-and-scoring.js'), 'utf8');
    const used = new Set([...modes.matchAll(/difficulty:'(\w+)'/g)].map(m => m[1]));
    used.forEach(d => {
      assert.ok(TIER_TARGETS[d], 'no tier target for ' + d);
      assert.ok(A.DIFFICULTY_PARAMS[d], 'no DIFFICULTY_PARAMS for ' + d);
    });
  });

  await check('Test seats only ever choose legal action names', () => {
    A.setGame(null);
    const deck = A.shuffle(A.createDeck());
    const p = { hand:[deck[0], deck[1]], betThisRound:0 };
    const g = { board:[deck[2], deck[3], deck[4]], pot:120, currentBet:40, bigBlind:20, players:[p, { folded:false }] };
    Object.values(PROBES).forEach(fn => {
      const d = fn(p, g, A);
      assert.ok(['fold','check','call','bet','raise'].includes(d.action), d.action);
    });
  });

  const opts = { seats:['maniac','professor','probe:abc'], hands:10, difficulty:'medium', seed:42 };
  const run1 = await simulate(opts);
  await check('Measuring table conserves chips and counts sanely', () => {
    assert.ok(run1.chipsError < 1e-9, 'chips error ' + run1.chipsError);
    Object.values(run1.stats).forEach(s => {
      assert.strictEqual(s.hands, 10);
      assert.ok(s.pfr <= s.vpip && s.vpip <= s.hands);
      assert.ok(s.wtsd <= s.sawFlop && s.foldToBet <= s.facedBet && s.cbet <= s.cbetOpp);
    });
    const net = Object.values(run1.stats).reduce((a, s) => a + s.net, 0);
    assert.ok(Math.abs(net) < 1e-6, 'net chips across seats ' + net);
  });
  await check('Measuring table is repeatable from a seed', async () => {
    const run2 = await simulate(opts);
    assert.deepStrictEqual(summarize(run2), summarize(run1));
  });

  process.stdout.write('\n' + passed + ' AI behaviour checks passed\n');
})().catch(e => { console.error(e); process.exit(1); });
