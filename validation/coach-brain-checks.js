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
check('After the flop he doesn\'t judge yet (that\'s step 3)', () => {
  const g = table(3, 0, 1, { hole:H('Ks','Qd') }); act(g, 0, 'call'); act(g, 1, 'call'); act(g, 2, 'check');
  street(g, 'flop', [C('Kh'), C('7c'), C('2d')]);
  assert.strictEqual(judge(g, 1, 'check'), null);
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
  'raiserFrom','to','toBB','lean','alt','Lean','Alt','handName','drawName','outs','hitPct','byWhen','hitNext','threat','pot']);
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

process.stdout.write('\n' + passed + ' coach brain checks passed.\n');
