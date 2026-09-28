#!/usr/bin/env node
"use strict";
/* Generates PREFLOP_ORDER for js/01-poker-math.js: the 169 starting-hand
   classes, strongest first.

   node validation/tools/preflop-order.js [iterations]   (default 40000)

   Strength is a blend: equity heads-up against a random hand (big cards
   matter) and against three random hands (suited, connected and paired
   hands that make big hands matter). Each is turned into a rank, and the
   two ranks blended (55/45), then small pairs and suited connectors are
   nudged up for implied odds. Seeded, so re-running
   gives the same order. Paste the printed line over PREFLOP_ORDER. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { seeded } = require('./ai-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const iters = +process.argv[2] || 40000;
const src = fs.readFileSync(path.join(ROOT, 'js/01-poker-math.js'), 'utf8');
const SandMath = Object.create(Math); SandMath.random = seeded(169);
const ctx = { Math: SandMath }; vm.createContext(ctx);
vm.runInContext(src.replace(/const EquityService = \(function\(\)\{[\s\S]*?\n\}\)\(\);/, '') +
  '\nglobalThis.API = { fastScore7, RANK_CHARS };', ctx);
const { fastScore7, RANK_CHARS } = ctx.API;
const rnd = SandMath.random;

function equity(a, b, opps){
  let win = 0;
  const deck = [];
  for (let it=0; it<iters; it++){
    deck.length = 0;
    for (let c=0;c<52;c++) if (c!==a && c!==b) deck.push(c);
    // partial shuffle: 2 per opponent + 5 board
    const need = opps*2 + 5;
    for (let i=0;i<need;i++){ const j = i + Math.floor(rnd()*(deck.length-i)); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    const board = deck.slice(opps*2, opps*2+5);
    const mine = fastScore7([a, b, ...board]);
    let winners = 1, beaten = false;
    for (let o=0;o<opps;o++){
      const s = fastScore7([deck[o*2], deck[o*2+1], ...board]);
      if (s > mine){ beaten = true; break; }
      if (s === mine) winners++;
    }
    if (!beaten) win += 1/winners;
  }
  return win/iters;
}

const classes = [];
for (let hi=12; hi>=0; hi--) for (let lo=hi; lo>=0; lo--){
  if (hi === lo) classes.push({ k: RANK_CHARS[hi]+RANK_CHARS[lo], a: hi*4, b: lo*4+1 });
  else {
    classes.push({ k: RANK_CHARS[hi]+RANK_CHARS[lo]+'s', a: hi*4, b: lo*4 });
    classes.push({ k: RANK_CHARS[hi]+RANK_CHARS[lo]+'o', a: hi*4, b: lo*4+1 });
  }
}
classes.forEach(c => { c.hu = equity(c.a, c.b, 1); c.m3 = equity(c.a, c.b, 3); });
const rankBy = key => { const s = classes.slice().sort((x,y)=>y[key]-x[key]); s.forEach((c,i)=>{ c[key+'R'] = i; }); };
rankBy('hu'); rankBy('m3');
// Implied-odds nudge: small pairs (sets) and suited connectors win big
// pots when they hit, which raw all-in equity undercounts. Measured in
// places up the list; kept small so the equity order still leads.
const implied = c => {
  const hi = c.a >> 2, lo = c.b >> 2, gap = hi - lo;
  if (hi === lo) return 16;
  if (c.k.endsWith('s') && gap === 1 && lo >= 2) return 8;
  if (c.k.endsWith('s') && gap === 2 && lo >= 2) return 4;
  return 0;
};
classes.forEach(c => { c.score = 0.55*c.huR + 0.45*c.m3R - implied(c); });
classes.sort((x,y)=> x.score - y.score || y.hu - x.hu);
if (process.argv.includes('--table')){
  classes.forEach((c,i)=>console.log(String(i+1).padStart(3), c.k.padEnd(4), c.hu.toFixed(3), c.m3.toFixed(3)));
}
console.log(classes.map(c=>c.k).join(' '));
