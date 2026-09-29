"use strict";
/* P.I.P.'s brain in a sandbox (docs/coach/BRAIN_PLAN.md): the real
   js/01-poker-math.js, js/coach-brain.js and js/coach-lines.js in a vm,
   plus a hand-built table and the engine's bookkeeping for public actions.
   Used by validation/coach-brain-checks.js. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
/* seeded, so every run of the checks is the same run (equity is sampled) */
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
const SandMath = Object.create(Math);
SandMath.random = seeded(+process.env.PIP_SEED || 20260929);   // PIP_SEED=n tries another run
const ctx = { console, Math:SandMath };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/01-poker-math.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'js/coach-brain.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'js/coach-lines.js'), 'utf8') +
  // the game's own pot split (js/05-game-engine.js), for settling a showdown
  '\n' + (() => { const e = fs.readFileSync(path.join(ROOT, 'js/05-game-engine.js'), 'utf8'); const i = e.indexOf('function computePots('); return e.slice(i, e.indexOf('\n}\n', i) + 3); })() +
  '\nglobalThis.CoachLines = CoachLines; globalThis.CoachBrain = CoachBrain; globalThis.makeCard = (r, s) => ({ rank:r, suit:s, value:RANK_VALUES[r] });', ctx);
const B = ctx.CoachBrain;
const C = (code) => {   // 'As', 'Td', '9h' -> a game card
  const r = code[0] === 'T' ? '10' : code[0], s = { s:'♠', h:'♥', d:'♦', c:'♣' }[code[1]];
  return ctx.makeCard(r, s);
};


/* A table: n seats, you at seat `you`, the dealer button at `dealer`,
   blinds posted, preflop, nothing else done yet. */
function table(n, dealer, you, opts){
  opts = opts || {};
  const bb = opts.bb || 20, stack = opts.stack || 2000;
  const players = Array.from({ length:n }, (_, i) => ({
    id: i === you ? 'you' : 'p' + i, name: i === you ? 'You' : 'Opp' + i, isHuman: i === you,
    chips: stack, hand: i === you ? (opts.hole || [C('As'), C('Kd')]) : [C('2c'), C('7h')],
    inHand: true, folded: false, allIn: false, eliminated: false, betThisRound: 0, totalBetHand: 0, mayRaise: true
  }));
  const sb = n === 2 ? dealer : (dealer + 1) % n, bbi = n === 2 ? (dealer + 1) % n : (dealer + 2) % n;
  const g = { players, board:[], pot:0, currentBet:bb, minRaise:bb, bigBlind:bb, smallBlind:bb / 2,
    dealerIndex:dealer, sbIndex:sb, bbIndex:bbi, phase:'preflop', handNumber:opts.handNumber || 1,
    handActions:[], streetRaises:0, pfRaises:0, pfAggressorId:null, mode:'cash', reads:{} };
  const post = (i, amt) => { const p = players[i]; p.chips -= amt; p.betThisRound += amt; p.totalBetHand += amt; g.pot += amt; };
  post(sb, bb / 2); post(bbi, bb);
  return g;
}
/* the engine's own bookkeeping for a public action (applyAction, simplified) */
function act(g, i, action, to){
  const p = g.players[i];
  const toCall = g.currentBet - p.betThisRound;
  if (action === 'fold') p.folded = true;
  else if (action === 'call' && g.currentBet <= p.betThisRound) action = 'check';   // (the engine's own: a free call is a check)
  else if (action === 'call'){ const need = Math.min(p.chips, g.currentBet - p.betThisRound); p.chips -= need; p.betThisRound += need; p.totalBetHand += need; g.pot += need; if (!p.chips) p.allIn = true; }
  else if (action === 'raise' || action === 'bet'){
    const need = to - p.betThisRound; p.chips -= need; p.betThisRound += need; p.totalBetHand += need; g.pot += need;
    if (!p.chips) p.allIn = true;
    g.minRaise = Math.max(g.minRaise, to - g.currentBet); g.currentBet = to;
    g.streetRaises++; g.streetAggressorId = p.id;
    if (g.phase === 'preflop'){ g.pfAggressorId = p.id; g.pfRaises = g.streetRaises; }
    action = g.streetRaises > 1 || g.phase === 'preflop' ? 'raise' : 'bet';
  }
  g.handActions.push({ id:p.id, name:p.name, street:g.phase, action, amount:p.betThisRound });
  // the engine's public log after the flop (aiObserveAction): b bet, r raise, c call, k check
  if (g.phase !== 'preflop'){
    const code = action === 'bet' || action === 'raise' ? (toCall > 0 ? 'r' : 'b') : action === 'call' ? 'c' : action === 'check' ? 'k' : null;
    if (code) (g.handLog || (g.handLog = [])).push({ id:p.id, n:g.board.length, a:code });
  }
}
function street(g, phase, cards){
  g.phase = phase; g.board.push(...cards); g.currentBet = 0; g.minRaise = g.bigBlind; g.streetRaises = 0;
  g.players.forEach(p => { p.betThisRound = 0; });
}
const you = g => g.players.find(p => p.isHuman);


/* play one decision: the spot before it, the action, and the judgement */
function judge(g, i, action, to){
  const me = g.players[i], sp = B.spot(g, me);
  act(g, i, action, to);
  return B.judge(sp, B.choice(sp, g, me));
}
const H = (a, b) => [C(a), C(b)];
module.exports = { B, C, H, ctx, table, act, street, you, judge, LINES: () => ctx.CoachLines.lines };
