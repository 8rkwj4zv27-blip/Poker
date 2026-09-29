#!/usr/bin/env node
"use strict";
/* P.I.P.'s brain, step 1: watching (docs/coach/BRAIN_PLAN.md).

   Hand-built spots with known answers (seats, the situation before you,
   the price, pot odds, stacks, what you chose, how the hand ended), plus a
   run over thousands of random tables that checks nothing comes out as
   nonsense and that no opponent's hidden card ever reaches the record.

   Runs the real js/01-poker-math.js and js/coach-brain.js in a sandbox:
     node validation/coach-brain-checks.js */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/01-poker-math.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'js/coach-brain.js'), 'utf8') +
  '\nglobalThis.CoachBrain = CoachBrain; globalThis.makeCard = (r, s) => ({ rank:r, suit:s, value:RANK_VALUES[r] });', ctx);
const B = ctx.CoachBrain;
const C = (code) => {   // 'As', 'Td', '9h' -> a game card
  const r = code[0] === 'T' ? '10' : code[0], s = { s:'♠', h:'♥', d:'♦', c:'♣' }[code[1]];
  return ctx.makeCard(r, s);
};

let passed = 0;
function check(name, fn){ fn(); passed++; process.stdout.write('PASS  ' + name + '\n'); }

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
  if (action === 'fold') p.folded = true;
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
}
function street(g, phase, cards){
  g.phase = phase; g.board.push(...cards); g.currentBet = 0; g.minRaise = g.bigBlind; g.streetRaises = 0;
  g.players.forEach(p => { p.betThisRound = 0; });
}
const you = g => g.players.find(p => p.isHuman);

/* ---------------- seats ---------------- */
check('Six-handed seats: UTG, HJ, CO, BTN, SB, BB from the button', () => {
  const g = table(6, 0, 3);
  assert.deepStrictEqual([0,1,2,3,4,5].map(i => B.seatLabel(g, i)), ['BTN','SB','BB','UTG','HJ','CO']);
});
check('Seven-handed adds the lojack; five-handed starts at the hijack', () => {
  const g7 = table(7, 2, 0);
  assert.deepStrictEqual([5,6,0,1,2].map(i => B.seatLabel(g7, i)), ['UTG','LJ','HJ','CO','BTN']);
  const g5 = table(5, 4, 0);
  assert.deepStrictEqual([2,3,4].map(i => B.seatLabel(g5, i)), ['HJ','CO','BTN']);
});
check('Heads-up: the button (also the small blind) and the big blind', () => {
  const g = table(2, 1, 0);
  assert.strictEqual(B.seatLabel(g, 1), 'BTN');
  assert.strictEqual(B.seatLabel(g, 0), 'BB');
});
check('Seats skip players who were not dealt in', () => {
  const g = table(6, 0, 3);
  g.players[4].inHand = false;   // knocked out
  assert.strictEqual(B.seatLabel(g, 3), 'HJ');
  assert.strictEqual(B.seatLabel(g, 5), 'CO');
});

/* ---------------- before the flop ---------------- */
check('Unopened from UTG: the price is the big blind, five act after you', () => {
  const g = table(6, 0, 3);
  const s = B.spot(g, you(g));
  assert.strictEqual(s.seat, 'UTG'); assert.strictEqual(s.seatGroup, 'early');
  assert.strictEqual(s.situation, 'unopened');
  assert.strictEqual(s.actingAfter, 5);
  assert.strictEqual(s.toCall, 20); assert.strictEqual(s.pot, 30);
  assert.strictEqual(+s.potOdds.toFixed(3), +(20 / 50).toFixed(3));
  assert.strictEqual(s.stackBB, 100); assert.strictEqual(s.effectiveBB, 100);
  assert.strictEqual(s.holeFacts.name, 'Ace-King offsuit');
  assert.ok(s.holeFacts.pct > 0.04 && s.holeFacts.pct < 0.08, 'Ace-King offsuit is about a top-6% hand');
  assert.strictEqual(s.boardFacts, null);
});
check('A limper before you makes it limped; a raise makes it raised; a re-raise, reraised', () => {
  let g = table(6, 0, 5);
  act(g, 3, 'call'); act(g, 4, 'fold');
  let s = B.spot(g, you(g));
  assert.strictEqual(s.situation, 'limped'); assert.strictEqual(s.preflop.limpers, 1);
  assert.strictEqual(s.seat, 'CO'); assert.strictEqual(s.seatGroup, 'late');

  g = table(6, 0, 5);
  act(g, 3, 'raise', 60); act(g, 4, 'call');
  s = B.spot(g, you(g));
  assert.strictEqual(s.situation, 'raised'); assert.strictEqual(s.preflop.callers, 1);
  assert.strictEqual(s.pfAggressor.name, 'Opp3'); assert.strictEqual(s.youArePfAggressor, false);
  assert.strictEqual(s.toCall, 60); assert.strictEqual(s.pot, 150);
  assert.strictEqual(+s.potOdds.toFixed(4), +(60 / 210).toFixed(4));

  g = table(6, 0, 5);
  act(g, 3, 'raise', 60); act(g, 4, 'raise', 180);
  s = B.spot(g, you(g));
  assert.strictEqual(s.situation, 'reraised'); assert.strictEqual(s.preflop.raises, 2);
});
check('The big blind with only limpers checks for free', () => {
  const g = table(4, 0, 2);   // you are the BB
  act(g, 3, 'call'); act(g, 0, 'call'); act(g, 1, 'call');
  const s = B.spot(g, you(g));
  assert.strictEqual(s.seat, 'BB'); assert.strictEqual(s.toCall, 0); assert.strictEqual(s.potOdds, 0);
  assert.strictEqual(s.situation, 'limped'); assert.strictEqual(s.actingAfter, 0);
});
check('Short stacks: your stack and the effective stack in big blinds', () => {
  const g = table(3, 0, 1, { stack:2000 });
  g.players[1].chips = 230 - 10;   // 11.5 BB less the small blind
  g.players[2].chips = 500 - 20; g.players[0].chips = 4000;
  const s = B.spot(g, you(g));
  assert.strictEqual(s.stackBB, 11); assert.strictEqual(s.effectiveBB, 11.5);
});
check('A call bigger than your stack is priced at your stack', () => {
  const g = table(3, 0, 1);
  g.players[1].chips = 90;
  act(g, 0, 'raise', 400);
  const s = B.spot(g, you(g));
  assert.strictEqual(s.toCall, 90); assert.strictEqual(s.mayRaise, false);
});

/* ---------------- after the flop ---------------- */
check('Facing a half-pot bet on the flop: 25% pot odds, top pair read from your cards', () => {
  const g = table(3, 0, 1, { hole:[C('Ks'), C('Qd')] });
  act(g, 0, 'call'); act(g, 1, 'call'); act(g, 2, 'call');   // the button calls, you complete, the BB checks
  street(g, 'flop', [C('Kh'), C('7c'), C('2d')]);
  act(g, 2, 'bet', g.pot / 2);   // the big blind bets half the pot (30 into 60)
  const s = B.spot(g, you(g));
  assert.strictEqual(s.street, 'flop'); assert.strictEqual(s.situation, 'facing-bet');
  assert.strictEqual(+s.potOdds.toFixed(4), 0.25);
  assert.strictEqual(s.boardFacts.made, 'top-pair');
  assert.strictEqual(s.boardFacts.handName, 'Pair of Kings');
  assert.ok(s.spr > 0);
});
check('Checked to you on the flop with a flush draw: outs and draws counted', () => {
  const g = table(3, 0, 0, { hole:[C('Ah'), C('5h')] });
  act(g, 0, 'raise', 60); act(g, 1, 'call'); act(g, 2, 'fold');
  street(g, 'flop', [C('Kh'), C('9h'), C('2c')]);
  act(g, 1, 'check');
  const s = B.spot(g, you(g));
  assert.strictEqual(s.situation, 'checked-to'); assert.strictEqual(s.toCall, 0);
  assert.strictEqual(s.youArePfAggressor, true);
  assert.strictEqual(s.boardFacts.draws.flush, true); assert.strictEqual(s.boardFacts.draws.nutFlush, true);
  assert.strictEqual(s.boardFacts.drawOuts, 9);
  assert.ok(s.boardFacts.threats.length === 0 || Array.isArray(s.boardFacts.threats));
});

/* ---------------- what you chose ---------------- */
check('A raise is recorded with its size against the pot', () => {
  const g = table(6, 0, 3);
  const s = B.spot(g, you(g));
  act(g, 3, 'raise', 60);
  const c = B.choice(s, g, you(g));
  assert.strictEqual(c.action, 'raise'); assert.strictEqual(c.amount, 60); assert.strictEqual(c.added, 60);
  assert.strictEqual(c.toBB, 3); assert.strictEqual(c.potFraction, 2);
});
check('A fold, a call and an all in are each recorded as what they were', () => {
  let g = table(6, 0, 3); let s = B.spot(g, you(g)); act(g, 3, 'fold');
  assert.strictEqual(B.choice(s, g, you(g)).action, 'fold');
  g = table(6, 0, 3); s = B.spot(g, you(g)); act(g, 3, 'call');
  let c = B.choice(s, g, you(g)); assert.strictEqual(c.action, 'call'); assert.strictEqual(c.added, 20);
  g = table(6, 0, 3); s = B.spot(g, you(g)); act(g, 3, 'raise', 2000);
  c = B.choice(s, g, you(g)); assert.strictEqual(c.action, 'allin'); assert.strictEqual(c.toBB, 100);
});

/* ---------------- the hand record ---------------- */
check('A hand: start, decisions, and the showdown with the cards that were shown', () => {
  B.reset();
  const g = table(3, 0, 1, { hole:[C('Qs'), C('Qd')], handNumber:7 });
  g.players[0].hand = [C('Jc'), C('Jh')]; g.players[2].hand = [C('3s'), C('8d')];
  B.handStart(g, { you:2000, p0:2000, p2:2000 });
  act(g, 0, 'raise', 60);
  const s = B.spot(g, you(g)); act(g, 1, 'raise', 180); B.record(s, g, you(g));
  act(g, 2, 'fold'); act(g, 0, 'call');
  street(g, 'flop', [C('2c'), C('5d'), C('9s')]); street(g, 'turn', [C('Kd')]); street(g, 'river', [C('4h')]);
  g.phase = 'showdown';
  const h = B.handEnd(g, you(g), 190);
  assert.strictEqual(h.n, 7); assert.strictEqual(h.seat, 'SB'); assert.strictEqual(h.startStack, 2000);
  assert.strictEqual(h.decisions.length, 1); assert.strictEqual(h.decisions[0].choice.action, 'raise');
  assert.strictEqual(h.end.result, 'won'); assert.strictEqual(h.end.showdown, true);
  assert.strictEqual(h.end.shown.length, 1, 'only the player who reached the showdown is shown');
  assert.strictEqual(h.end.shown[0].name, 'Opp0'); assert.strictEqual(h.end.shown[0].handName, 'Pair of Jacks');
  assert.strictEqual(h.end.yourHand, 'Pair of Queens');
  assert.strictEqual(B.history.length, 1); assert.strictEqual(B.hand, null);
});
check('Everyone folds: nobody\'s cards are shown', () => {
  B.reset();
  const g = table(3, 0, 1);
  B.handStart(g, {});
  act(g, 0, 'fold'); const s = B.spot(g, you(g)); act(g, 1, 'raise', 60); B.record(s, g, you(g)); act(g, 2, 'fold');
  g.phase = 'foldwin';
  const h = B.handEnd(g, you(g), 20);
  assert.deepStrictEqual(Array.from(h.end.shown), []); assert.strictEqual(h.end.showdown, false);
});
check('You fold, they show down: their cards are shown (public), your fold is noted', () => {
  B.reset();
  const g = table(3, 0, 1);
  g.players[0].hand = [C('Ac'), C('Ah')]; g.players[2].hand = [C('Kc'), C('Kh')];
  B.handStart(g, {});
  act(g, 0, 'raise', 60); const s = B.spot(g, you(g)); act(g, 1, 'fold'); B.record(s, g, you(g)); act(g, 2, 'call');
  street(g, 'flop', [C('2c'), C('5d'), C('9s')]); street(g, 'turn', [C('Td')]); street(g, 'river', [C('4h')]);
  g.phase = 'showdown';
  const h = B.handEnd(g, you(g), -10);
  assert.strictEqual(h.end.folded, true); assert.strictEqual(h.end.foldedOn, 'preflop');
  assert.strictEqual(h.end.shown.length, 2); assert.strictEqual(h.end.yourHand, null);
});
check('A hand that finishes between looks is closed from what was last seen', () => {
  B.reset();
  const g = table(3, 0, 1, { handNumber:4 });
  g.players[0].hand = [C('Ac'), C('Ah')]; g.players[2].hand = [C('Kc'), C('Kh')];
  B.handStart(g, { you:2000 });
  act(g, 0, 'raise', 60); act(g, 1, 'call'); act(g, 2, 'call');
  street(g, 'flop', [C('2c'), C('5d'), C('9s')]); street(g, 'turn', [C('Td')]); street(g, 'river', [C('4h')]);
  g.phase = 'showdown';
  B.observe(g, you(g));                 // seen at the showdown...
  g.phase = 'handover';                 // ...then the table moves on before the ending is read
  B.observe(g, you(g));
  const h = B.closeMissed(-60);
  assert.strictEqual(h.n, 4); assert.strictEqual(h.end.result, 'lost'); assert.strictEqual(h.end.net, -60);
  assert.strictEqual(h.end.shown.length, 2, 'the showdown\'s cards are kept once seen');
  assert.strictEqual(h.end.showdown, true);
  assert.strictEqual(B.closeMissed(0), null, 'nothing left to close');
});
check('The table before its first deal is not a hand', () => {
  B.reset();
  const g = table(3, 0, 1); g.handNumber = 0; g.phase = 'setup';
  assert.strictEqual(B.handStart(g, { you:2000 }), null);
  assert.strictEqual(B.closeMissed(0), null);
  assert.strictEqual(B.history.length, 0);
});
check('History keeps the last 50 hands', () => {
  B.reset();
  for (let n = 1; n <= 60; n++){ const g = table(2, 0, 1, { handNumber:n }); B.handStart(g, {}); g.phase = 'foldwin'; B.handEnd(g, you(g), 0); }
  assert.strictEqual(B.history.length, 50); assert.strictEqual(B.history[0].n, 11);
});

/* ---------------- thousands of random tables ---------------- */
check('5,000 random spots: sane numbers, every seat named once, never an opponent\'s hidden card', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ri = n => Math.floor(rnd() * n);
  const labels = new Set(['UTG','UTG+1','UTG+2','LJ','HJ','CO','BTN','SB','BB']);
  for (let t = 0; t < 5000; t++){
    const n = 2 + ri(6), dealer = ri(n), me = ri(n);
    const deck = ctx.shuffle(ctx.createDeck());
    const g = table(n, dealer, me, { stack:200 + ri(4000), hole:[deck.pop(), deck.pop()] });
    g.players.forEach(p => { if (!p.isHuman) p.hand = [deck.pop(), deck.pop()]; });
    // everyone before you does something random
    const order = [];
    for (let k = 1; k <= n; k++) order.push((g.bbIndex + k) % n);
    for (const i of order){
      if (i === me) break;
      const p = g.players[i], x = rnd();
      if (x < .35) act(g, i, 'fold');
      else if (x < .75 || p.chips <= g.currentBet * 2) act(g, i, 'call');
      else act(g, i, 'raise', Math.min(p.betThisRound + p.chips, g.currentBet * (2 + ri(3))));
    }
    const streets = ri(4);
    if (streets >= 1){ street(g, 'flop', [deck.pop(), deck.pop(), deck.pop()]); }
    if (streets >= 2){ street(g, 'turn', [deck.pop()]); }
    if (streets >= 3){ street(g, 'river', [deck.pop()]); }
    if (streets >= 1 && rnd() < .5){
      const bettor = g.players.find(p => !p.isHuman && !p.folded && !p.allIn && p.chips > 0);
      if (bettor) act(g, g.players.indexOf(bettor), 'bet', Math.max(1, Math.min(bettor.chips, Math.round(g.pot * (.3 + rnd())))));
    }
    const all = g.players.map((p, i) => B.seatLabel(g, i));
    assert.strictEqual(new Set(all).size, n, 'every seat has its own name: ' + all.join(','));
    all.forEach(l => assert.ok(labels.has(l), 'unknown seat ' + l));
    const s = B.spot(g, you(g));
    assert.ok(s, 'a spot for every decision');
    assert.ok(s.potOdds >= 0 && s.potOdds < 1, 'pot odds between 0 and 1');
    assert.ok(s.toCall >= 0 && s.toCall <= you(g).chips, 'the price is never more than your stack');
    assert.ok(s.actingAfter >= 0 && s.actingAfter < n, 'players after you');
    assert.ok(s.playersIn >= 1 && s.playersIn <= n);
    assert.ok(s.effectiveBB <= s.stackBB + (you(g).betThisRound / g.bigBlind) + 1e-9, 'effective stack never above yours');
    assert.ok(s.holeFacts.pct >= 0 && s.holeFacts.pct <= 1);
    if (s.board.length) assert.ok(s.boardFacts && s.boardFacts.handName, 'a hand name after the flop');
    // no opponent's card, anywhere in what was read
    const text = JSON.stringify(s);
    const mine = new Set(you(g).hand.concat(g.board).map(c => c.rank + c.suit));
    g.players.forEach(p => { if (!p.isHuman) p.hand.forEach(c => {
      if (mine.has(c.rank + c.suit)) return;
      assert.ok(!text.includes('"rank":"' + c.rank + '","suit":"' + c.suit + '"'), 'an opponent\'s card leaked into the spot');
    }); });
  }
});

process.stdout.write('\n' + passed + ' coach brain checks passed.\n');
