#!/usr/bin/env node
"use strict";
/* AI tier checks (docs/ai/AI_PLAN.md, Step 6) — the slow suite, ~2 min.

   Plays each Career tier (medium / hard / expert / elite) at the measuring
   table (validation/tools/ai-sim.js: the real aiDecide, seeded, so the
   result is deterministic for a given code version) and asserts:
   - each tier's table averages sit inside its TIER_TARGETS bands;
   - the tiers form a ladder: looser, stickier and leakier at the bottom;
   - a solid regular (YARDSTICK.seat, the game's own AI at skill 80) beats
     the Back Room clearly, wins less as rooms get stronger, and loses at
     Elite.
   Fast behaviour checks live in validation/ai-behaviour-checks.js. */

const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');
const { TIER_TARGETS, YARDSTICK } = require('./tools/ai-harness');

const HANDS = 1600, SEED = +(process.env.AI_TIER_SEED || 1);   // AI_TIER_SEED=n re-checks on another seed
const AI = ['maniac','professor','wildcard','shark'];
const sim = path.join(__dirname, 'tools', 'ai-sim.js');
let passed = 0;
function check(name, fn){ fn(); passed++; process.stdout.write('PASS  ' + name + '\n'); }

const tiers = Object.keys(TIER_TARGETS);
const res = {};
for (const d of tiers){
  const out = execFileSync('node', [sim, '--hands', String(HANDS), '--difficulty', d, '--seed', String(SEED), '--json',
    '--seats', AI.concat(YARDSTICK.seat).join(',')], { encoding:'utf8', maxBuffer: 1 << 24 });
  const s = JSON.parse(out)[d];
  const avg = f => AI.reduce((a, k) => a + s[k][f], 0) / AI.length;
  res[d] = { vpip:avg('vpip'), pfr:avg('pfr'), af:avg('af'), wtsd:avg('wtsd'), foldToBet:avg('foldToBet'),
    sizeTell:avg('sizeTell'), yard:s[YARDSTICK.seat].bb100 };
}
const fmt = v => (Math.round(v*100)/100).toFixed(2);
for (const d of tiers){
  const t = TIER_TARGETS[d], r = res[d];
  check(d + ' (' + t.label + ') sits inside its bands', () => {
    for (const f of ['vpip','pfr','af','wtsd','foldToBet','sizeTell']){
      assert.ok(r[f] >= t[f][0] && r[f] <= t[f][1], d + ' ' + f + ' ' + fmt(r[f]) + ' outside ' + t[f].join('-'));
    }
  });
}
check('The tiers form a ladder: tighter, less sticky, fewer tells as skill rises', () => {
  const [m, h, e, x] = tiers.map(d => res[d]);
  assert.ok(m.vpip > h.vpip && h.vpip > e.vpip && e.vpip >= x.vpip - 0.01, 'VPIP ' + tiers.map(d=>fmt(res[d].vpip)));
  assert.ok(m.wtsd > h.wtsd && h.wtsd > e.wtsd, 'WTSD ' + tiers.map(d=>fmt(res[d].wtsd)));
  assert.ok(m.sizeTell > h.sizeTell && h.sizeTell > e.sizeTell, 'size tell ' + tiers.map(d=>fmt(res[d].sizeTell)));
  assert.ok(x.af > m.af, 'AF ' + tiers.map(d=>fmt(res[d].af)));
});
check('A solid regular beats the Back Room clearly and loses at Elite', () => {
  const y = tiers.map(d => Math.round(res[d].yard));
  assert.ok(y[0] >= YARDSTICK.backRoomAtLeast, 'Back Room ' + y[0] + ' bb/100');
  assert.ok(y[3] <= YARDSTICK.eliteAtMost, 'Elite ' + y[3] + ' bb/100');
  assert.ok(y[0] > y[3] + 40, 'ladder ' + y.join(' / '));
});
process.stdout.write('\n' + tiers.map(d => d + ': VPIP ' + fmt(res[d].vpip) + ' PFR ' + fmt(res[d].pfr) + ' AF ' + fmt(res[d].af) +
  ' WTSD ' + fmt(res[d].wtsd) + ' F2B ' + fmt(res[d].foldToBet) + ' tell ' + fmt(res[d].sizeTell) + ' regular ' + Math.round(res[d].yard)).join('\n') + '\n');
process.stdout.write('\n' + passed + ' AI tier checks passed\n');
