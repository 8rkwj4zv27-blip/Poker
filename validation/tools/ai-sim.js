#!/usr/bin/env node
"use strict";
/* AI behaviour report — the measuring stick from docs/ai/AI_PLAN.md.

   node validation/tools/ai-sim.js [options]
     --hands N        hands per table (default 400; win rates need thousands)
     --difficulty D   medium | hard | expert | elite, or "all" (default all)
     --skill N        a point on the 0-100 skill dial instead (e.g. 40 sits
                      between medium and hard); "sweep" runs 10, 20 ... 100
     --seats a,b,c    personality keys; add probe:bully / probe:station /
                      probe:abc for a test seat (default: the four preferred
                      archetypes + probe:abc)
     --seed N         repeatable run (default 1)
     --json           machine-readable output

   Prints each seat's play stats beside the provisional tier targets. Slow
   by design: it runs the real Monte-Carlo equity the game does. */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { simulate, summarize, TIER_TARGETS } = require('./ai-harness');

/* Each table is split across worker threads (different seeds, same seats)
   and the raw counts merged: the real equity maths is slow in Node. */
if (!isMainThread){
  simulate(workerData).then(r => parentPort.postMessage(r));
  return;
}
function runParallel(o){
  const W = Math.max(1, Math.min(os.cpus().length, Math.ceil(o.hands / 50)));
  const per = Math.ceil(o.hands / W);
  return Promise.all(Array.from({length:W}, (_, i) => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { ...o, hands: per, seed: o.seed*1000 + i } });
    w.once('message', res); w.once('error', rej);
  }))).then(parts => {
    const merged = { ...parts[0], hands: per*W, chipsError: Math.max(...parts.map(p => p.chipsError)) };
    merged.stats = {};
    parts.forEach(p => Object.entries(p.stats).forEach(([k, s]) => {
      const m = merged.stats[k];
      if (!m){ merged.stats[k] = { ...s, sizing: s.sizing.slice() }; return; }
      Object.keys(s).forEach(f => { if (typeof s[f] === 'number') m[f] += s[f]; });
      m.sizing = m.sizing.concat(s.sizing);
    }));
    return merged;
  });
}

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i+1] : def; };
const hands = +opt('hands', 400);
const seed = +opt('seed', 1);
const seats = opt('seats', 'maniac,professor,wildcard,shark,probe:abc').split(',');
const diffArg = opt('difficulty', 'all');
const skillArg = opt('skill', null);
// each run is [label, difficulty, skill]
const runs = skillArg === 'sweep' ? [10,20,30,40,50,60,70,80,90,100].map(k => ['skill ' + k, 'hard', k])
  : skillArg != null ? [['skill ' + skillArg, 'hard', +skillArg]]
  : (diffArg === 'all' ? Object.keys(TIER_TARGETS) : [diffArg]).map(d => [d, d, undefined]);
const json = args.includes('--json');

const pct = v => v == null ? '   -' : (Math.round(v*100) + '%').padStart(4);
const num = (v, d=1) => v == null ? '-' : v.toFixed(d);

(async () => {
  const all = {};
  for (const [label, difficulty, skill] of runs){
    const res = await runParallel({ seats, hands, difficulty, skill, seed });
    const sum = summarize(res);
    all[label] = sum;
    if (json) continue;
    const t = skill === undefined ? TIER_TARGETS[difficulty] : null;
    const band = k => t && t[k] ? `${t[k][0]}-${t[k][1]}` : '';
    console.log(`\n== ${label.toUpperCase()}${t ? ' · ' + t.label : ''} · ${res.hands} hands · seed ${seed}`);
    console.log('seat              VPIP  PFR   AF  WTSD F2Bet CBet Bluff RivBl ChkR AllIn SizeTell  bb/100');
    for (const [k, s] of Object.entries(sum)){
      console.log(k.padEnd(16), pct(s.vpip), pct(s.pfr), num(s.af).padStart(4), pct(s.wtsd), ' ' + pct(s.foldToBet),
        pct(s.cbet), ' ' + pct(s.bluffShare), ' ' + pct(s.riverBluffShare), String(s.checkRaises).padStart(4),
        String(s.allins).padStart(5), num(s.sizeTell, 2).padStart(8), num(s.bb100).padStart(8));
    }
    if (t){
      console.log('target (AI avg)  ', [band('vpip'), band('pfr'), band('af'), band('wtsd'), band('foldToBet')].join(' | '),
        '| size tell <=', t.sizeTell[1]);
    }
    if (res.chipsError > 0.001) console.log('!! chip conservation error', res.chipsError);
  }
  if (json) console.log(JSON.stringify(all, null, 2));
})();
