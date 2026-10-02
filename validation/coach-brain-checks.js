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

const { B, C, H, ctx, table, act, street, you, judge, LINES } = require('./tools/coach-sandbox');

let passed = 0;
function check(name, fn){ fn(); passed++; process.stdout.write('PASS  ' + name + '\n'); }

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

/* ================= step 2: judge 1, before the flop ================= */
const is = (j, verdict, confidence, tag) => {
  assert.ok(j, 'a judgement');
  assert.strictEqual(j.verdict, verdict, 'verdict ' + JSON.stringify(j));
  if (confidence) assert.strictEqual(j.confidence, confidence, 'confidence ' + JSON.stringify(j));
  if (tag) assert.strictEqual(j.tag, tag, 'tag ' + JSON.stringify(j));
};
const folds = (seats, g) => seats.forEach(i => act(g, i, 'fold'));

check('Opening: aces raised is good; seven-deuce raised under the gun is a clear mistake', () => {
  is(judge(table(6, 0, 3, { hole:H('As','Ah') }), 3, 'raise', 60), 'good', 'clear', 'open.good.premium');
  is(judge(table(6, 0, 3, { hole:H('7s','2h') }), 3, 'raise', 60), 'mistake', 'clear', 'open.loose');
});
check('Position: the same hand is a fold early and a raise on the button', () => {
  // King-Eight offsuit: top ~30%
  is(judge(table(6, 0, 3, { hole:H('Ks','8h') }), 3, 'raise', 60), 'mistake', null, 'open.loose');
  const g = table(6, 0, 0, { hole:H('Ks','8h') }); folds([3, 4, 5], g);
  is(judge(g, 0, 'raise', 60), 'good', 'clear', 'open.good.steal');
});
check('Folding: Ace-King folded first in is a clear mistake; Ace-Five offsuit folded under the gun is disciplined', () => {
  is(judge(table(6, 0, 3, { hole:H('As','Kh') }), 3, 'fold'), 'mistake', 'clear', 'open.fold.strong');
  is(judge(table(6, 0, 3, { hole:H('As','5h') }), 3, 'fold'), 'good', 'clear', 'open.fold.disciplined');
  is(judge(table(6, 0, 3, { hole:H('9d','4c') }), 3, 'fold'), 'good', 'clear', 'open.fold.good');
});
check('Limping: queens limped is a clear mistake; a weak limp is a mistake', () => {
  is(judge(table(6, 0, 3, { hole:H('Qs','Qh') }), 3, 'call'), 'mistake', 'clear', 'limp.strong');
  is(judge(table(6, 0, 3, { hole:H('Js','4h') }), 3, 'call'), 'mistake', 'clear', 'limp.weak');
});
check('A raise too big is noted, not condemned', () => {
  is(judge(table(6, 0, 3, { hole:H('As','Ah') }), 3, 'raise', 160), 'fine', 'leans', 'open.big');
});
check('All in for 100 big blinds, first in, is a clear mistake (bar aces or kings)', () => {
  is(judge(table(6, 0, 5, { hole:H('As','Kd') }), 5, 'raise', 2000), 'mistake', 'clear', 'open.shove');
});
check('Limpers in front: Ace-Queen raises them (good); Nine-Four offsuit raises them (mistake)', () => {
  let g = table(6, 0, 5, { hole:H('As','Qd') }); act(g, 3, 'call'); act(g, 4, 'fold');
  is(judge(g, 5, 'raise', 80), 'good', 'clear', 'iso.good');
  g = table(6, 0, 5, { hole:H('9s','4d') }); act(g, 3, 'call'); act(g, 4, 'fold');
  is(judge(g, 5, 'raise', 80), 'mistake', null, 'iso.loose');
});
check('The big blind: a free check is good, folding it is a clear mistake', () => {
  let g = table(6, 0, 2, { hole:H('8s','3d') }); act(g, 3, 'call'); folds([4, 5, 0], g); act(g, 1, 'call');
  is(judge(g, 2, 'check'), 'good', 'clear', 'bb.check');
  g = table(6, 0, 2, { hole:H('8s','3d') }); act(g, 3, 'call'); folds([4, 5, 0], g); act(g, 1, 'call');
  is(judge(g, 2, 'fold'), 'mistake', 'clear', 'bb.fold.free');
});
check('Facing a raise: King-Nine offsuit calling an early raise is a clear mistake; queens re-raising is good', () => {
  let g = table(6, 0, 5, { hole:H('Ks','9h') }); act(g, 3, 'raise', 60); act(g, 4, 'fold');
  const j = judge(g, 5, 'call');
  is(j, 'mistake', 'clear', 'vsraise.call.weak');
  assert.strictEqual(j.n.raiserSeat, 'UTG', 'the raiser\'s seat, for "a raise from under the gun"');
  assert.ok(j.n.eq < j.n.need, 'the numbers say why: ' + j.n.eq + '% against ' + j.n.need + '% needed');
  g = table(6, 0, 5, { hole:H('Qs','Qh') }); act(g, 3, 'raise', 60); act(g, 4, 'fold');
  is(judge(g, 5, 'raise', 180), 'good', 'clear', 'vsraise.raise.value');
  g = table(6, 0, 5, { hole:H('Qs','Qh') }); act(g, 3, 'raise', 60); act(g, 4, 'fold');
  is(judge(g, 5, 'call'), 'fine', 'leans', 'vsraise.call.value');
});
check('The big blind defends a button raise with a suited connector, and folds seven-deuce', () => {
  let g = table(6, 0, 2, { hole:H('9s','7s') }); folds([3, 4, 5], g); act(g, 0, 'raise', 50); act(g, 1, 'fold');
  is(judge(g, 2, 'call'), 'good', null, 'bb.defend.good');
  g = table(6, 0, 2, { hole:H('7s','2d') }); folds([3, 4, 5], g); act(g, 0, 'raise', 50); act(g, 1, 'fold');
  is(judge(g, 2, 'fold'), 'good', null, 'vsraise.fold.good');
  g = table(6, 0, 2, { hole:H('Ks','Td') }); folds([3, 4, 5], g); act(g, 0, 'raise', 50); act(g, 1, 'fold');
  is(judge(g, 2, 'fold'), 'mistake', null, 'vsraise.fold.priced');
});
check('Short stacks: Ace-Nine on the button with 8 big blinds is a shove; folding it is a clear mistake', () => {
  let g = table(6, 0, 0, { hole:H('As','9d'), stack:160 }); folds([3, 4, 5], g);
  is(judge(g, 0, 'raise', 160), 'good', 'clear', 'short.push.good');
  g = table(6, 0, 0, { hole:H('As','9d'), stack:160 }); folds([3, 4, 5], g);
  is(judge(g, 0, 'fold'), 'mistake', 'clear', 'short.fold.missed');
  g = table(6, 0, 0, { hole:H('As','9d'), stack:160 }); folds([3, 4, 5], g);
  is(judge(g, 0, 'call'), 'mistake', null, 'short.limp');
});
check('After the flop, checked to you, he judges betting (step 3b)', () => {
  const g = table(3, 0, 1, { hole:H('Ks','Qd') }); act(g, 0, 'call'); act(g, 1, 'call'); act(g, 2, 'check');
  street(g, 'flop', [C('Kh'), C('7c'), C('2d')]);
  const j = judge(g, 1, 'check');
  assert.ok(j && j.kind === 'bet', 'a betting judgement');
});
check('A recorded decision carries its judgement', () => {
  B.reset();
  const g = table(6, 0, 3, { hole:H('7s','2h') }); B.handStart(g, {});
  const s = B.spot(g, you(g)); act(g, 3, 'raise', 60);
  const d = B.record(s, g, you(g));
  assert.strictEqual(d.judgement.tag, 'open.loose');
});

/* ---------------- his lines ---------------- */
const SLOTS = new Set(['hole','pct','range','seatOn','seatFrom','SeatFrom','behindP','bb','size','call','odds','eq','need','raiser','limpersP',
  'raiserFrom','bettor','betSize','DrawName','handWords','rangeWords','opp','Opp','won','sizeWords','fold','foldNeed','players','Bettor','Raiser','BehindP','LimpersP','to','toBB','lean','alt','Lean','Alt','handName','drawName','outs','hitPct','byWhen','hitNext','threat','pot','shortOpp','ShortOpp']);
const JARGON = /\b(limp(s|ed|ing|ers?)?|cutoff|hijack|lojack|under the gun|pot odds|outs|three-bet|3-bet|semi-bluff|value bet|kicker|shove[ds]?|bluff catcher|pot control|equity|range|overpair|c-bet|in position|out of position|isolate|dominated)\b/i;
const BANNED = /\b(kid|buddy|pal|mate|champ|sport|chief|boss|friend|damn|hell|shit|crap)\b/i;
check('His lines: flat, clean, fit his bubble, and only use blanks the game fills', () => {
  const L = LINES();
  let n = 0;
  Object.entries(L).forEach(([k, pool]) => {
    assert.ok(pool.length >= 1, k + ' has lines');
    pool.forEach(([notch, mood, text]) => {
      n++;
      assert.ok([1, 2, 3, 4].includes(notch), k + ': notch');
      assert.ok(['calm','pleased','impressed','surprised','wince','unlucky','thinking'].includes(mood), k + ': mood ' + mood);
      assert.ok(!BANNED.test(text), k + ': not his voice: ' + text);
      assert.ok(!/!{2,}|\?\?|:\)|;\)/.test(text), k + ': flat, no fuss: ' + text);
      assert.ok(text.length <= 200, k + ': too long for his bubble (' + text.length + '): ' + text);
      (text.match(/\{(\w+)\}/g) || []).forEach(m => assert.ok(SLOTS.has(m.slice(1, -1)), k + ': unknown blank ' + m));
      (text.match(/\{t:(\w+)\}/g) || []).forEach(m => assert.ok(ctx.CoachLines.terms[m.slice(3, -1)], k + ': unknown term ' + m));
      // plain English: a poker word only where it's taught (lessons), or as
      // a {t:term} that reads in plain words until then
      if (!/^(lesson|explain)\./.test(k)){
        const bare = text.replace(/\{[\w:]+\}/g, '');
        assert.ok(!JARGON.test(bare), k + ': poker jargon outside a lesson: ' + text);
      }
    });
  });
  assert.ok(n >= 250, 'the library has grown: ' + n + ' lines');
});
check('5,000 random decisions before the flop: every judgement is sane and has something to say', () => {
  let seed = 777;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ri = k => Math.floor(rnd() * k);
  const L = LINES();
  const tags = new Set();
  for (let t = 0; t < 5000; t++){
    const n = 2 + ri(6), dealer = ri(n), me = ri(n);
    const deck = ctx.shuffle(ctx.createDeck());
    const stack = rnd() < .25 ? 60 + ri(300) : 400 + ri(4000);
    const g = table(n, dealer, me, { stack, hole:[deck.pop(), deck.pop()] });
    const order = []; for (let k = 1; k <= n; k++) order.push((g.bbIndex + k) % n);
    for (const i of order){
      if (i === me) break;
      const p = g.players[i], x = rnd();
      if (x < .5) act(g, i, 'fold');
      else if (x < .8 || p.chips <= g.currentBet * 3) act(g, i, 'call');
      else act(g, i, 'raise', Math.min(p.betThisRound + p.chips, g.currentBet * (2 + ri(3))));
    }
    const mine = g.players[me];
    if (mine.folded || mine.allIn || mine.chips <= 0) continue;
    const toCall = g.currentBet - mine.betThisRound;
    const opts = toCall > 0 ? ['fold', 'call', 'raise'] : ['check', 'raise', 'fold'];
    const a = opts[ri(3)];
    const to = a === 'raise' ? Math.min(mine.betThisRound + mine.chips, g.currentBet * 3 + (rnd() < .2 ? mine.chips : 0)) : 0;
    const pct = B.spot(g, mine).holeFacts.pct;
    const j = judge(g, me, a, to);
    if (!j) continue;
    tags.add(j.tag);
    assert.ok(['good','fine','mistake'].includes(j.verdict) && ['clear','leans','close'].includes(j.confidence), JSON.stringify(j));
    // nonsense he must never say
    if (pct < 0.012 && (a === 'raise')) assert.ok(j.verdict !== 'mistake' || j.tag === 'open.shove' || j.tag === 'reraise.shove.loose' || j.confidence !== 'clear',
      'a clear mistake for raising aces/kings? ' + JSON.stringify(j));
    // folding junk is never a mistake, unless it's free, or the price makes the call right (a short big blind)
    if (pct > 0.8 && a === 'fold' && j.tag !== 'bb.fold.free') assert.ok(j.verdict !== 'mistake' || j.kind === 'short' || (/fold\.priced$/.test(j.tag) && j.n.eq >= j.n.need - 1),
      'a mistake for folding junk? ' + JSON.stringify(j));
    const did = mine.allIn ? 'allin' : a;
    if (j.verdict === 'mistake' && j.confidence === 'clear') assert.ok(j.best !== did || j.tag === 'bb.fold.free', 'a clear mistake that was the best move? ' + JSON.stringify(j));
    // something to say about it after the hand, whenever it's worth talking about
    if (j.verdict === 'mistake' || j.notable || j.confidence === 'close')
      assert.ok(L[j.tag + '.why'] || L[j.tag + '.why.leans'], 'no reason lines for ' + j.tag);
    if ((j.verdict === 'mistake' && j.confidence !== 'close') || j.notable)
      assert.ok(L[j.tag + '.now'] || L[j.tag + '.now.leans'] || j.confidence === 'close', 'no word for ' + j.tag);
    // the numbers he quotes agree with what he says (to rounding)
    if (/call\.weak$/.test(j.tag)) assert.ok(j.n.eq <= j.n.need + 1, 'a weak call, but the numbers say call: ' + JSON.stringify(j.n));
    if (/fold\.priced$/.test(j.tag)) assert.ok(j.n.eq + 1 >= j.n.need, 'a priced fold, but the numbers say fold: ' + JSON.stringify(j.n));
    if (j.lesson) assert.ok(L['lesson.' + j.lesson] && L['again.' + j.lesson], 'no lesson or reminder lines for ' + j.lesson);
  }
  assert.ok(tags.size >= 30, 'the fuzz reached most kinds of spot: ' + tags.size);
});

/* ================= advice before you act (step 4, preflop) ================= */
const advise = (g, i) => B.advisePreflop(B.spot(g, g.players[i]));
check('His advice on familiar spots', () => {
  let a = advise(table(6, 0, 3, { hole:H('As','Ah') }), 3);
  assert.strictEqual(a.move, 'raise'); assert.strictEqual(a.sure, 'clear'); assert.strictEqual(a.to, 50, 'a standard open: 2.5 big blinds');
  a = advise(table(6, 0, 3, { hole:H('7s','2h') }), 3);
  assert.strictEqual(a.move, 'fold'); assert.strictEqual(a.sure, 'clear');
  let g = table(6, 0, 5, { hole:H('Ks','9h') }); act(g, 3, 'raise', 60); act(g, 4, 'fold');
  assert.strictEqual(advise(g, 5).move, 'fold');
  g = table(6, 0, 5, { hole:H('Qs','Qh') }); act(g, 3, 'raise', 60); act(g, 4, 'fold');
  a = advise(g, 5); assert.strictEqual(a.move, 'raise'); assert.strictEqual(a.to, 180, 'a three-bet in position: three times');
  g = table(6, 0, 2, { hole:H('9s','7s') }); [3, 4, 5].forEach(i => act(g, i, 'fold')); act(g, 0, 'raise', 50); act(g, 1, 'fold');
  assert.strictEqual(advise(g, 2).move, 'call');
  g = table(6, 0, 2, { hole:H('8s','3d') }); act(g, 3, 'call'); [4, 5, 0].forEach(i => act(g, i, 'fold')); act(g, 1, 'call');
  assert.strictEqual(advise(g, 2).move, 'check', 'free in the big blind: check');
  g = table(6, 0, 0, { hole:H('As','9d'), stack:160 }); [3, 4, 5].forEach(i => act(g, i, 'fold'));
  a = advise(g, 0); assert.strictEqual(a.move, 'allin'); assert.strictEqual(a.to, 160);
  g = table(6, 0, 5, { hole:H('As','Qd') }); act(g, 3, 'call'); act(g, 4, 'fold');
  a = advise(g, 5); assert.strictEqual(a.move, 'raise'); assert.strictEqual(a.to, 70, 'raise a limper: 2.5 big blinds plus one per limper');
});
check('After the flop: his read has your hand, your draw and your chance of hitting it', () => {
  const g = table(3, 0, 1, { hole:H('Ah','5h') }); act(g, 0, 'call'); act(g, 1, 'call'); act(g, 2, 'check');
  street(g, 'flop', [C('Kh'), C('9h'), C('2c')]);
  const r = B.readNow(B.spot(g, you(g)));
  assert.strictEqual(r.made, 'nothing'); assert.strictEqual(r.draws.flush, true);
  assert.strictEqual(r.drawOuts, 9); assert.strictEqual(r.hitPct, 35, 'nine outs, two cards: 35%');
});
check('5,000 random decisions: his advice is always a move you have, never one his judge calls a clear mistake, and always has lines', () => {
  let seed = 4242;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ri = k => Math.floor(rnd() * k);
  const L = LINES();
  for (let t = 0; t < 5000; t++){
    const n = 2 + ri(6), dealer = ri(n), me = ri(n);
    const deck = ctx.shuffle(ctx.createDeck());
    const stack = rnd() < .25 ? 60 + ri(300) : 400 + ri(4000);
    const g = table(n, dealer, me, { stack, hole:[deck.pop(), deck.pop()] });
    const order = []; for (let k = 1; k <= n; k++) order.push((g.bbIndex + k) % n);
    for (const i of order){
      if (i === me) break;
      const p = g.players[i], x = rnd();
      if (x < .5) act(g, i, 'fold');
      else if (x < .8 || p.chips <= g.currentBet * 3) act(g, i, 'call');
      else act(g, i, 'raise', Math.min(p.betThisRound + p.chips, g.currentBet * (2 + ri(3))));
    }
    const mine = g.players[me];
    if (mine.folded || mine.allIn || mine.chips <= 0) continue;
    const sp = B.spot(g, mine), a = B.advisePreflop(sp);
    if (!a) continue;
    const moves = [sp.toCall > 0 ? 'fold' : 'check'].concat(sp.toCall > 0 ? ['call'] : [], sp.mayRaise ? ['raise', 'allin'] : []);
    assert.ok(moves.includes(a.move), 'advice you can take: ' + a.move + ' of ' + moves);
    assert.ok(!(a.judgement.verdict === 'mistake' && a.judgement.confidence === 'clear'), 'advice his own judge calls a clear mistake: ' + JSON.stringify(a));
    assert.ok(['clear','leans','close'].includes(a.sure));
    if (a.to) assert.ok(a.to > sp.currentBet && a.to <= sp.stack + sp.yourBet, 'a raise size you can make: ' + a.to);
    assert.ok(L['advise.' + a.kind + '.' + a.move], 'no advice lines for ' + a.kind + '.' + a.move);
    assert.ok(L['hint.' + a.kind], 'no hint lines for ' + a.kind);
  }
});

/* ================= step 3a: after the flop, facing a bet ================= */
/* a heads-up pot: the button raised, you called in the big blind; on the
   last street you check and the button bets `frac` of the pot */
function postSpot(hole, board, frac){
  const g = table(6, 0, 2, { hole:H(...hole) });
  [3, 4, 5].forEach(i => act(g, i, 'fold')); act(g, 0, 'raise', 50); act(g, 1, 'fold'); act(g, 2, 'call');
  street(g, 'flop', board.slice(0, 3).map(C));
  if (board.length > 3){ act(g, 2, 'check'); act(g, 0, 'check'); street(g, 'turn', [C(board[3])]); }
  if (board.length > 4){ act(g, 2, 'check'); act(g, 0, 'check'); street(g, 'river', [C(board[4])]); }
  act(g, 2, 'check'); act(g, 0, 'bet', Math.round(g.pot * frac));
  return g;
}
const post = (hole, board, frac, action, to) => judge(postSpot(hole, board, frac), 2, action, to);
check('After the flop: draws at the right price and the wrong one', () => {
  is(post(['Ah','5h'], ['Kh','9h','2c'], 0.5, 'call'), 'good', null, 'post.call.draw.good');
  is(post(['7s','5d'], ['Kh','9h','8c'], 1.0, 'call'), 'mistake', 'clear', 'post.call.draw.bad');
  const j = post(['Ah','5h'], ['Kh','9h','2c'], 0.5, 'fold');
  is(j, 'mistake', null, 'post.fold.draw');
  assert.strictEqual(j.n.outs, 9); assert.strictEqual(j.n.drawName, 'a flush draw');
});
check('After the flop: calling with nothing is a clear mistake; top pair calls; a set raises', () => {
  is(post(['Qs','3d'], ['Kh','9h','2c'], 0.5, 'call'), 'mistake', 'clear', 'post.call.weak');
  is(post(['Ks','Qd'], ['Kh','9c','2d'], 0.5, 'call'), 'good', null, 'post.call.good');
  is(post(['Ks','Qd'], ['Kh','9c','2d'], 0.5, 'fold'), 'mistake', 'clear', 'post.fold.strong');
  is(post(['Ks','Qd'], ['Kh','9c','2d'], 0.5, 'raise', 300), 'fine', 'close', 'post.raise.protect');
  is(post(['9s','9d'], ['Kh','9c','2d'], 0.5, 'raise', 300), 'good', 'clear', 'post.raise.value');
  is(post(['9s','9d'], ['Kh','9c','2d'], 0.5, 'call'), 'fine', 'leans', 'post.call.value');
});
check('The river: bottom pair folds to a pot-sized bet; a missed draw folds; the nuts raises', () => {
  is(post(['2s','3d'], ['Kh','9c','2d','Js','5h'], 1.0, 'fold'), 'good', null, 'post.fold.good');
  is(post(['2s','3d'], ['Kh','9c','2d','Js','5h'], 1.0, 'call'), 'mistake', 'clear', 'post.call.weak');
  is(post(['Ah','5h'], ['Kh','9h','2c','3s','Jd'], 0.7, 'fold'), 'good', null, 'post.fold.good');
  const j = post(['Ah','5h'], ['Kh','9h','2c','3h','Jd'], 0.7, 'call');
  is(j, 'fine', 'leans', 'post.call.value'); assert.strictEqual(j.lesson, 'raising-for-value');
});
check('After the flop, his advice: call the draw, fold nothing, call top pair, raise the set (3x the bet)', () => {
  const adv = g => B.advise(B.spot(g, you(g)));
  assert.strictEqual(adv(postSpot(['Ah','5h'], ['Kh','9h','2c'], 0.5)).move, 'call');
  assert.strictEqual(adv(postSpot(['Qs','3d'], ['Kh','9h','2c'], 0.5)).move, 'fold');
  assert.strictEqual(adv(postSpot(['Ks','Qd'], ['Kh','9c','2d'], 0.5)).move, 'call');
  const g = postSpot(['9s','9d'], ['Kh','9c','2d'], 0.5), a = adv(g);
  assert.strictEqual(a.move, 'raise'); assert.strictEqual(a.to, Math.round(g.currentBet * 3 / 20) * 20, 'three times the bet, to the big blind');
});
check('He reads a bettor from the betting: their bet goes into his picture of their hands', () => {
  const g = postSpot(['Ks','Qd'], ['Kh','9c','2d'], 0.5);
  const one = B.oppRange(B.spot(g, you(g)), B.spot(g, you(g)).opponents[0]);
  assert.ok(one.hist && one.hist.length === 1 && one.hist[0].a === 'b', 'the bet is in their history');
  assert.strictEqual(one.pct, 0.44, 'a button raiser: the top 44%');
});
check('1,500 random spots after the flop: sane verdicts, numbers that agree, advice you can take, and lines for all of it', () => {
  let seed = 31337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ri = k => Math.floor(rnd() * k);
  const L = LINES();
  let judged = 0;
  const tags = new Set();
  for (let t = 0; t < 1500; t++){
    const n = 2 + ri(4), dealer = ri(n), me = ri(n);
    const deck = ctx.shuffle(ctx.createDeck());
    const g = table(n, dealer, me, { stack:600 + ri(3000), hole:[deck.pop(), deck.pop()] });
    // everyone limps or calls a raise to the flop
    const order = []; for (let k = 1; k <= n; k++) order.push((g.bbIndex + k) % n);
    if (rnd() < .6) act(g, order[0], 'raise', 60);
    for (const i of order.slice(rnd() < .6 ? 1 : 0)) if (!g.players[i].folded) act(g, i, 'call');
    const streets = 1 + ri(3);
    street(g, 'flop', [deck.pop(), deck.pop(), deck.pop()]);
    if (streets >= 2) street(g, 'turn', [deck.pop()]);
    if (streets >= 3) street(g, 'river', [deck.pop()]);
    // someone else bets into you
    const bettor = g.players.find((p, i) => i !== me && !p.folded && p.chips > 20);
    if (!bettor) continue;
    act(g, g.players.indexOf(bettor), 'bet', Math.max(20, Math.min(bettor.chips, Math.round(g.pot * (.25 + rnd())))));
    const mine = g.players[me];
    if (mine.chips <= 0) continue;
    const sp = B.spot(g, mine), a = B.advise(sp);
    const moves = ['fold', 'call'].concat(sp.mayRaise ? ['raise', 'allin'] : []);
    assert.ok(a && moves.includes(a.move), 'advice you can take: ' + (a && a.move));
    assert.ok(!(a.judgement.verdict === 'mistake' && a.judgement.confidence === 'clear'), 'advice his judge calls a clear mistake: ' + JSON.stringify(a.judgement));
    assert.ok(L['advise.post.' + a.move], 'no advice lines for ' + a.move);
    const x = ['fold', 'call', 'raise'][ri(3)];
    const j = judge(g, me, x, x === 'raise' ? Math.min(mine.betThisRound + mine.chips, sp.currentBet * 3) : 0);
    if (!j) continue;
    judged++; tags.add(j.tag);
    assert.ok(['good','fine','mistake'].includes(j.verdict) && ['clear','leans','close'].includes(j.confidence), JSON.stringify(j));
    if (/call\.(weak|draw\.bad)$/.test(j.tag)) assert.ok(j.n.eq <= j.n.need + 1, 'a bad call, but the numbers say call: ' + JSON.stringify(j.n));
    if (/fold\.(priced|draw)$/.test(j.tag)) assert.ok(j.n.eq + 1 >= j.n.need, 'a bad fold, but the numbers say fold: ' + JSON.stringify(j.n));
    if (j.n.eq >= 90 && x === 'fold') assert.strictEqual(j.verdict, 'mistake', 'folding a near-certain winner must be a mistake');
    if (j.verdict === 'mistake' || j.notable || j.confidence === 'close') assert.ok(L[j.tag + '.why'], 'no reason lines for ' + j.tag);
    if (j.verdict === 'mistake' && j.confidence !== 'close') assert.ok(L[j.tag + '.now'], 'no word for ' + j.tag);
    if (j.lesson) assert.ok(L['lesson.' + j.lesson] && L['again.' + j.lesson], 'no lesson or reminder lines for ' + j.lesson);
  }
  assert.ok(judged > 1000, 'most spots judged: ' + judged);
  assert.ok(tags.size >= 12, 'most kinds of spot reached: ' + [...tags].join(' '));
});

/* ================= step 3b: checked to you, bet or check ================= */
/* you raised on the button; the big blind called; it's checked to you on the last street */
function betSpot(hole, board, opts){
  opts = opts || {};
  const g = table(6, 0, 0, { hole:H(...hole) });
  [3, 4, 5].forEach(i => act(g, i, 'fold'));
  act(g, 0, 'raise', 50); act(g, 1, opts.two ? 'call' : 'fold'); act(g, 2, 'call');
  street(g, 'flop', board.slice(0, 3).map(C));
  const round = () => { if (opts.two) act(g, 1, 'check'); act(g, 2, 'check'); act(g, 0, 'check'); };
  if (board.length > 3){ round(); street(g, 'turn', [C(board[3])]); }
  if (board.length > 4){ round(); street(g, 'river', [C(board[4])]); }
  if (opts.two) act(g, 1, 'check');
  act(g, 2, 'check');
  return g;
}
const bet = (hole, board, action, opts) => { const g = betSpot(hole, board, opts); return judge(g, 0, action, action === 'raise' ? Math.round(g.pot * 0.6) : 0); };
check('Checked to you: two pair on the river bets (checking it is a clear mistake); a middling pair checks', () => {
  is(bet(['As','2c'], ['Ah','5d','2s','6d','3d'], 'check'), 'mistake', 'clear', 'bet.missed');
  is(bet(['As','2c'], ['Ah','5d','2s','6d','3d'], 'raise'), 'good', 'clear', 'bet.value');
  is(bet(['7s','8d'], ['Kh','7c','2d'], 'check'), 'good', null, 'bet.check.medium');
  is(bet(['7s','8d'], ['Kh','7c','2d'], 'raise'), 'fine', 'close', 'bet.thin');
});
check('Checked to you: a draw bets against one player; bluffing two players is a mistake; a bluff is never clear-cut', () => {
  is(bet(['Ah','5h'], ['Kh','9h','2c'], 'raise'), 'good', null, 'bet.semi');
  is(bet(['Qs','Jd'], ['8h','4c','2d'], 'raise', { two:true }), 'mistake', null, 'bet.bluff.multi');
  const j = bet(['Qs','Jd'], ['8h','4c','2d','3s','7h'], 'raise');
  assert.ok(/^bet\.bluff/.test(j.tag) && j.confidence !== 'clear', 'a bluff, and not clear-cut: ' + j.tag + ' ' + j.confidence);
});
check('Checked to you: his advice bets two pair (about two-thirds of the pot on the river) and checks a middling pair', () => {
  let g = betSpot(['As','2c'], ['Ah','5d','2s','6d','3d']);
  let a = B.advise(B.spot(g, you(g)));
  assert.strictEqual(a.move, 'bet'); assert.ok(a.to >= g.pot * 0.58 && a.to <= g.pot * 0.72, 'about two-thirds of the pot: ' + a.to + ' into ' + g.pot);
  g = betSpot(['7s','8d'], ['Kh','7c','2d']);
  assert.strictEqual(B.advise(B.spot(g, you(g))).move, 'check');
});
check('Brain V2 value plans: keep monsters in on quiet boards, charge draws on wet ones', () => {
  let g = betSpot(['Qs','Qd'], ['Qh','7c','2d']);
  let a = B.advise(B.spot(g, you(g)));
  assert.strictEqual(a.move, 'bet'); assert.ok(a.plan, 'a structured value plan');
  assert.strictEqual(a.plan.purpose, 'keep-worse-in');
  assert.ok(a.to >= g.pot * 0.30 && a.to <= g.pot * 0.45, 'small enough to keep weaker hands in: ' + a.to + ' into ' + g.pot);
  assert.ok(a.plan.alternatives.length >= 4 && a.plan.next, 'several sizes and a next-street plan');

  g = betSpot(['Qs','Qd'], ['Jh','Th','9c']);
  a = B.advise(B.spot(g, you(g)));
  assert.strictEqual(a.move, 'bet'); assert.strictEqual(a.plan.purpose, 'charge-draws');
  assert.ok(a.to >= g.pot * 0.60, 'the wet board gets a larger bet: ' + a.to + ' into ' + g.pot);
});
check('Brain V2 value plans: commit only when the pot is already large beside the effective stack', () => {
  const g = betSpot(['Qs','Qd'], ['Jh','7c','2d']);
  g.players[0].chips = 70;
  const a = B.advise(B.spot(g, you(g)));
  assert.strictEqual(a.move, 'allin'); assert.strictEqual(a.plan.purpose, 'commit-shallow');
  assert.strictEqual(a.to, 70, 'only the chips that can be matched');
  const j = judge(g, 0, 'raise', 70);
  is(j, 'good', 'clear', 'bet.value.commit');
  assert.strictEqual(j.best, 'allin', 'the judgement agrees with the all-in advice');
  const foldLine = LINES()['bet.value.commit.why.foldwin'];
  assert.ok(foldLine && foldLine.length, 'a dedicated fold result for the recommended commitment');
  assert.ok(foldLine.every(line => !/smaller|lower/i.test(line[2])), 'never contradict the recommended all in afterwards');
});
check('Brain V2 judges the amount as well as the idea of value betting', () => {
  let g = betSpot(['Qs','Qd'], ['Qh','7c','2d']);
  let j = judge(g, 0, 'raise', Math.round(g.pot * 1.1));
  is(j, 'fine', 'leans', 'bet.value.large');
  g = betSpot(['Qs','Qd'], ['Jh','7c','2d']);
  j = judge(g, 0, 'raise', g.players[0].chips);
  is(j, 'mistake', 'leans', 'bet.value.shove');
});
check('What their betting says: checks read weak, bets read strong', () => {
  const g = betSpot(['As','2c'], ['Ah','5d','2s','6d','3d']);
  const st = B.stories(B.spot(g, you(g)));
  assert.strictEqual(st.one.kind, 'weak'); assert.strictEqual(st.one.name, 'Opp2');
  const g2 = postSpot(['Ks','Qd'], ['Kh','9c','2d'], 0.5);
  assert.strictEqual(B.stories(B.spot(g2, you(g2))).one.kind, 'strong');
});
check('Every poker term has plain words and a lesson that teaches it', () => {
  const L = LINES(), T = ctx.CoachLines.terms;
  Object.entries(T).forEach(([k, t]) => {
    assert.ok(t.plain && t.term && L['lesson.' + t.via], k + ': plain words, the term, and its lesson');
    assert.ok(!JARGON.test(t.plain), k + ': its plain words are plain');
  });
  // every lesson has a tip (the third tap), and there's a "that's all"
  Object.keys(L).filter(k => /^lesson\./.test(k)).forEach(k => assert.ok(L['tip.' + k.slice(7)], 'no tip for ' + k));
  assert.ok(L['tap.done'] && L['tip.bigHands'], 'tap.done and tip.bigHands');
});

check('800 random checked-to spots: sane verdicts, advice you can take, and lines for all of it', () => {
  let seed = 90210;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ri = k => Math.floor(rnd() * k);
  const L = LINES();
  let judged = 0; const tags = new Set();
  for (let t = 0; t < 800; t++){
    const n = 2 + ri(4), dealer = ri(n), me = ri(n);
    const deck = ctx.shuffle(ctx.createDeck());
    const g = table(n, dealer, me, { stack:600 + ri(3000), hole:[deck.pop(), deck.pop()] });
    const order = []; for (let k = 1; k <= n; k++) order.push((g.bbIndex + k) % n);
    for (const i of order) if (rnd() < .35 && i !== me && i !== g.bbIndex) act(g, i, 'fold'); else act(g, i, 'call');
    street(g, 'flop', [deck.pop(), deck.pop(), deck.pop()]);
    if (rnd() < .5) street(g, 'turn', [deck.pop()]);
    if (g.board.length === 4 && rnd() < .5) street(g, 'river', [deck.pop()]);
    // everyone before you checks
    g.players.forEach((p, i) => { if (i !== me && !p.folded && rnd() < .7) act(g, i, 'check'); });
    const mine = g.players[me];
    if (mine.folded) continue;
    const sp = B.spot(g, mine);
    if (sp.toCall > 0 || sp.playersIn < 2) continue;
    const a = B.advise(sp);
    assert.ok(a && ['check', 'bet', 'allin'].includes(a.move), 'advice you can take: ' + (a && a.move));
    assert.ok(!(a.judgement.verdict === 'mistake' && a.judgement.confidence === 'clear'), 'advice his judge calls a clear mistake: ' + JSON.stringify(a.judgement));
    const x = rnd() < .5 ? 'check' : 'raise';
    const j = judge(g, me, x, x === 'raise' ? Math.min(mine.chips, Math.max(20, Math.round(g.pot * (.3 + rnd())))) : 0);
    if (!j) continue;
    judged++; tags.add(j.tag);
    if (j.verdict === 'mistake' || j.notable) assert.ok(L[j.tag + '.why'], 'no reason lines for ' + j.tag);
    if (j.verdict === 'mistake' && j.confidence !== 'close') assert.ok(L[j.tag + '.now'], 'no word for ' + j.tag);
    // (except bluffing three or more players at once: that one is clear)
    if (/^bet\.bluff/.test(j.tag) && !(j.tag === 'bet.bluff.multi' && j.n.players >= 3)) assert.notStrictEqual(j.confidence, 'clear', 'a bluff is never clear-cut, good or bad (' + j.tag + ')');
    if (j.lesson) assert.ok(L['lesson.' + j.lesson] && L['again.' + j.lesson], 'no lesson or reminder lines for ' + j.lesson);
  }
  assert.ok(judged > 400, 'most spots judged: ' + judged);
  assert.ok(tags.size >= 8, 'most kinds of spot reached: ' + [...tags].join(' '));
});

/* ================= the result, the moment the winner is shown ================= */
check('He works out your result from the showdown before the pot is paid (the COLLECT key)', () => {
  // you (seat 1) and seat 0 all the way to the river; seat 2 folded
  const g = table(3, 0, 1, { hole:H('As','2c') });
  g.players[0].hand = H('Ks','2h'); g.players[2].hand = H('7d','Tc');
  act(g, 0, 'call'); act(g, 1, 'call'); act(g, 2, 'fold');
  street(g, 'flop', ['Ah','5d','2s'].map(C)); street(g, 'turn', [C('6d')]); street(g, 'river', [C('3d')]);
  g.phase = 'showdown';
  const net = B.settle(g, you(g));
  assert.strictEqual(net, g.pot - you(g).totalBetHand, 'you win the whole pot: ' + net);
  // they win
  g.players[0].hand = H('4c','7h');   // a straight, 3-4-5-6-7
  assert.strictEqual(B.settle(g, you(g)), -you(g).totalBetHand, 'you lose what you put in');
  // you folded
  const g2 = table(3, 0, 1); act(g2, 0, 'raise', 60); act(g2, 1, 'fold'); act(g2, 2, 'fold'); g2.phase = 'foldwin';
  assert.strictEqual(B.settle(g2, you(g2)), -10, 'the small blind you posted');
});

/* ================= the owner's notes, 29 Sep 2026 (tidy-ups) ================= */
check('Short because of them: you cover Lucy\'s 70 chips; his lines name her, not you', () => {
  // heads-up, you on the button (small blind) with 1,400; the big blind has 70 behind
  let g = table(2, 0, 0, { hole:H('6d','2d'), stack:1400, bb:20 });
  g.players[1].chips = 70; g.players[1].name = 'Lucy';
  const s = B.spot(g, you(g));
  assert.ok(s.stackBB > 60 && s.effectiveBB <= 5, 'deep for you, short for the hand: ' + s.stackBB + ' / ' + s.effectiveBB);
  assert.strictEqual(s.shortBy, 'Lucy');
  const a = B.advise(s);
  assert.strictEqual(a.move, 'raise', 'put Lucy all in without calling your whole stack all in');
  assert.strictEqual(a.to, 90, 'her 70 behind plus the 20 already posted');
  assert.ok(a.to < s.stack, 'the unmatched 1,310 is never presented as at risk');
  const j = judge(g, 0, 'fold');
  assert.strictEqual(j.kind, 'short'); assert.strictEqual(j.n.shortOpp, 'Lucy');
  const L = LINES();
  ['lesson.short-stack', 'tip.short-stack', 'again.short-stack', 'advise.short.fold', 'advise.short.allin', 'advise.short.raise', 'hint.short', j.tag + '.why']
    .forEach(k => assert.ok(L[k + '.opp'], 'her wording for ' + k));
  // your own short stack: no "her"
  g = table(6, 0, 0, { hole:H('As','9d'), stack:160 }); folds([3, 4, 5], g);
  assert.strictEqual(judge(g, 0, 'raise', 160).n.shortOpp, null);
});
// a turn, checked to you, heads-up, with an open-ended straight draw; your stack set to `stack`
function drawSpot(stack, turnBet){
  const g = table(6, 0, 0, { hole:H('9s','8s') });
  [3, 4, 5].forEach(i => act(g, i, 'fold'));
  act(g, 0, 'raise', 50); act(g, 1, 'fold'); act(g, 2, 'call');
  street(g, 'flop', ['7h','6c','2d'].map(C)); act(g, 2, 'check'); act(g, 0, 'check');
  street(g, 'turn', [C('Kd')]); if (turnBet) act(g, 2, 'bet', turnBet); else act(g, 2, 'check');
  g.players[0].chips = stack;
  return g;
}
check('A draw, all in: all your chips on a draw is a mistake (never clear-cut); his advice checks instead of betting it all', () => {
  let g = drawSpot(400);   // a proper bet would be most of your chips
  let j = judge(g, 0, 'raise', 400);
  assert.ok(j.verdict !== 'good' && /^bet\.semi\.shove/.test(j.tag) && j.confidence !== 'clear', 'all in on the draw: ' + j.tag + ' ' + j.verdict + ' ' + j.confidence);
  // his own bet: half the pot is most of your chips, against a player who
  // hardly ever folds: all in doesn't pay, so he checks
  g = drawSpot(120); g.reads = { p2:{ hands:30, facedBet:12, foldedToBet:1 } };
  const a = B.advise(B.spot(g, you(g)));
  assert.strictEqual(a.move, 'check', 'he checks it: ' + JSON.stringify({ move:a.move, tag:a.tag }));
  assert.strictEqual(a.tag, 'bet.check.draw.deep');
  // a normal-sized bet with the same draw, deep: still good
  g = drawSpot(2000);
  j = judge(g, 0, 'raise', Math.round(g.pot * 0.5));
  assert.strictEqual(j.tag, 'bet.semi'); assert.strictEqual(j.verdict, 'good');
  // all in for less than the pot: that's just a bet, and fine
  g = drawSpot(60);
  j = judge(g, 0, 'raise', 60);
  assert.ok(j.verdict !== 'mistake', 'a small all in with a draw: ' + j.tag + ' ' + j.verdict);
});
check('A draw, all in over a bet: a mistake; calling at the right price is still fine', () => {
  // the turn: they bet half the pot into you, and you have 400 behind
  let j = judge(drawSpot(400, 55), 0, 'raise', 400);
  is(j, 'mistake', 'leans', 'post.raise.semi.shove');
  j = judge(drawSpot(400, 30), 0, 'call');
  assert.notStrictEqual(j.verdict, 'mistake', 'calling a small bet with the draw: ' + j.tag);
});
check('What their betting says follows the hand: a check then a bet has turned; "keeps" only after two', () => {
  // they checked the flop, and bet the turn
  let g = drawSpot(2000); act(g, 0, 'check'); street(g, 'river', [C('3s')]); act(g, 2, 'bet', 100);
  let st = B.stories(B.spot(g, you(g))).one;
  assert.strictEqual(st.kind, 'turned'); assert.strictEqual(st.again, false);
  // bet the flop and bet again: a pattern
  g = table(6, 0, 0, { hole:H('9s','8s') }); [3, 4, 5].forEach(i => act(g, i, 'fold'));
  act(g, 0, 'raise', 50); act(g, 1, 'fold'); act(g, 2, 'call');
  street(g, 'flop', ['7h','6c','2d'].map(C)); act(g, 2, 'bet', 50); act(g, 0, 'call');
  st = B.stories(B.spot(g, you(g))).one; assert.strictEqual(st.kind, 'strong'); assert.strictEqual(st.again, false);
  street(g, 'turn', [C('Kd')]); act(g, 2, 'bet', 100);
  st = B.stories(B.spot(g, you(g))).one; assert.strictEqual(st.kind, 'strong'); assert.strictEqual(st.again, true);
  // one bet never says "keeps"; two do
  const L = LINES();
  L['story.strong.one'].concat(L['story.calling.one'], L['story.turned.one']).forEach(l => assert.ok(!/\bkeeps?\b/i.test(l[2]), 'one action, not a pattern: ' + l[2]));
  assert.ok(L['story.strong.again.one'] && L['story.calling.again.one'] && L['story.turned.one'], 'lines for a pattern and a turn');
});
check('A hand that hurt: short comfort lines, no lesson in them', () => {
  const L = LINES();
  ['comfort.out', 'comfort.out.fine', 'comfort.hurt', 'comfort.fine'].forEach(k => {
    assert.ok(L[k] && L[k].length >= 2, k);
    L[k].forEach(l => { assert.strictEqual(l[0], 1, k + ' plays at every notch'); assert.ok(l[2].length <= 90, k + ' is short: ' + l[2]); });
  });
});

process.stdout.write('\n' + passed + ' coach brain checks passed.\n');
