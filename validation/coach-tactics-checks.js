"use strict";
// Phase 2, slice 1: public value targets, not a claim of solver accuracy.
const assert = require('assert');
const { B, H, C, table, street, you, act } = require('./tools/coach-sandbox');
let passed = 0;
function check(name, fn){ fn(); passed++; console.log('PASS  ' + name); }
function spot(hole, board, opts = {}){
  const g = table(opts.seats || 2, opts.dealer == null ? 0 : opts.dealer, 0, { hole:H(...hole), stack:opts.stack || 2000 });
  street(g, board.length === 5 ? 'river' : 'flop', board.map(C)); g.pot = 110;
  if (opts.read) g.reads = { p1:opts.read };
  return { g, sp:B.spot(g, you(g)) };
}
const dry = () => spot(['Qs','Qh'], ['Qd','7c','2s']);
const river = () => spot(['As','2c'], ['Ah','5d','2s','6d','3d']);
check('Public combinations exclude all seven visible cards, never read hidden cards', () => {
  const { g } = spot(['As','2c'], ['Ah','5d','2s','6d','3d']);
  Object.defineProperty(g.players[1], 'hand', { get(){ throw Error('hidden cards read'); } });
  const sp = B.spot(g, you(g));
  assert.strictEqual(B.oppRange(sp, sp.opponents[0]), 1);
  assert.strictEqual(B.valueContinuation(sp, 40).combos, 990);
});
check('Earlier-street targets are made strength, not predicted runout value', () => {
  const { sp } = dry(), p = B.valueContinuation(sp, 40);
  assert.strictEqual(p.estimatedRiverValue, null);
  assert.strictEqual(p.checkToShowdownValue, null);
  assert.ok(p.targets.includes('smaller pairs'));
  assert.strictEqual(p.model, 'public-range/heuristic-calls');
});
check('A larger river bet loses marginal calls and retains a stronger calling range', () => {
  const { sp } = river(), small = B.valueContinuation(sp, 40), large = B.valueContinuation(sp, 90);
  assert.ok(small.estimatedCallRate > large.estimatedCallRate);
  assert.ok(small.worseCallShare > large.worseCallShare);
  assert.ok(small.estimatedRiverValue > large.estimatedRiverValue);
});
check('Observed callers are less sensitive to a large bet; sparse reads stay neutral', () => {
  const board = ['Qd','7c','2s'], hole = ['Qs','Qh'];
  const neutral = spot(hole, board).sp;
  const caller = spot(hole, board, { read:{ hands:30, facedBet:30, foldedToBet:0 } }).sp;
  const sparse = spot(hole, board, { read:{ hands:2, facedBet:2, foldedToBet:0 } }).sp;
  assert.ok(B.valueContinuation(caller, 90).estimatedCallRate > B.valueContinuation(neutral, 90).estimatedCallRate);
  assert.strictEqual(B.valueContinuation(sparse, 90).estimatedCallRate, B.valueContinuation(neutral, 90).estimatedCallRate);
});
check('River sizing shrinks when the stock amount mostly gets stronger calls', () => {
  const { sp } = river(), p = B.valueBetPlan(sp, 0.7);
  assert.strictEqual(sp.actingAfter, 0);
  assert.strictEqual(p.to, 40);
  assert.ok(p.continuation.worseCallShare > 0.5);
  assert.ok(p.alternatives.every(x => x.to >= sp.wager.min && x.to <= sp.wager.max));
});
check('Out-of-position river keeps its prior size rather than inventing a check-through', () => {
  const { sp } = spot(['As','2c'], ['Ah','5d','2s','6d','3d'], { dealer:1 });
  assert.ok(sp.actingAfter > 0);
  assert.strictEqual(B.valueBetPlan(sp, 0.7).to, 70);
});
check('Multiway and committed opponents do not acquire a false single-caller model', () => {
  const { sp } = spot(['Qs','Qh'], ['Qd','7c','2s'], { seats:3 });
  assert.strictEqual(B.valueContinuation(sp, 40), null);
  const { g } = dry(); g.players[1].allIn = true; g.players[1].chips = 0;
  assert.strictEqual(B.valueContinuation(B.spot(g, you(g)), 40), null);
});
check('Shallow strong value still commits; quiet deep value still builds gently', () => {
  const shallow = spot(['Qs','Qh'], ['Qd','7c','2s'], { stack:80 }).sp;
  const p = B.valueBetPlan(shallow, 0.95);
  assert.strictEqual(p.shove, true); assert.strictEqual(p.to, p.cap);
  const deep = B.valueBetPlan(dry().sp, 0.95);
  assert.strictEqual(deep.shove, false); assert.strictEqual(deep.to, 40);
});
check('Immutable spots reuse their continuation estimates', () => {
  const { sp } = river();
  assert.strictEqual(B.valueContinuation(sp, 40), B.valueContinuation(sp, 40));
  assert.strictEqual(B.advise(sp), B.advise(sp));
});
check('Advice supplies plain value targets and does not claim a certain river model', () => {
  const a = B.advise(dry().sp);
  assert.ok(a.n.valueTargets.includes('pairs'));
  const r = B.advise(river().sp);
  if (r.plan && !r.plan.shove) assert.notStrictEqual(r.sure, 'clear');
});
check('Flush plus open-ended draw has 15 unique completion cards, not 17', () => {
  const { sp } = spot(['Jh','Th'], ['Qh','9h','2c']);
  const q = sp.boardFacts.drawQuality;
  assert.strictEqual(q.outs, 15); assert.strictEqual(new Set(q.cards).size, 15);
  assert.ok(Math.abs(q.next - 15 / 47) < 1e-10);
  assert.strictEqual(B.readNow(sp).drawOuts, 15);
});
check('Low flush, paired-board flush and low straight completions carry warnings', () => {
  for (const [h, b] of [[['5h','4h'],['Kh','9h','2c']], [['Ah','5h'],['Kh','9h','9c']], [['6s','7d'],['8h','9c','2d']]]){
    const q = spot(h, b).sp.boardFacts.drawQuality;
    assert.ok(q.uncertain > 0); assert.match(q.warning, /still.*beaten/);
  }
});
check('Nut flush completions on an unpaired board are not falsely guaranteed wins', () => {
  const q = spot(['Ah','5h'], ['Kh','9h','2c']).sp.boardFacts.drawQuality;
  assert.strictEqual(q.uncertain, 0); assert.strictEqual(q.outs, 9);
  assert.match(q.warning, /not a guaranteed win/);
});
check('Backdoor draws are not counted as next-card completion outs', () => {
  const q = spot(['Ah','5h'], ['Kh','9d','2c']).sp.boardFacts.drawQuality;
  assert.strictEqual(q.outs, 0); assert.strictEqual(q.next, 0);
});
check('Draw call with chips behind uses one-card price; all-in uses runout equity', () => {
  const { g } = spot(['5h','4h'], ['Kh','9h','2c']);
  act(g, 1, 'bet', 55);
  let sp = B.spot(g, you(g)), p = B.drawPrice(sp, 0.35);
  assert.strictEqual(p.runout, false); assert.ok(p.usable < p.runoutHit);
  assert.match(p.text, /next card/);
  g.players[0].chips = 55;
  sp = B.spot(g, you(g)); p = B.drawPrice(sp, 0.35);
  assert.strictEqual(p.runout, true); assert.strictEqual(p.usable, 0.35);
  assert.strictEqual(p.implied, 0);
});
check('A covered opponent all-in also closes further betting', () => {
  const { g } = spot(['Ah','5h'], ['Kh','9h','2c']);
  g.players[1].chips = 55; act(g, 1, 'bet', 55);
  assert.strictEqual(B.drawPrice(B.spot(g, you(g)), 0.4).runout, true);
});
check('A vulnerable flush draw cannot justify an expensive flop chase with two-card odds', () => {
  const { g } = spot(['5h','4h'], ['Kh','9h','2c']); act(g, 1, 'bet', 110);
  const sp = B.spot(g, you(g)), a = B.advise(sp);
  assert.strictEqual(a.move, 'fold');
  const j = B.judge(sp, { action:'call', amount:110 });
  assert.strictEqual(j.verdict, 'mistake'); assert.ok(j.n.eq < j.n.need);
});
check('Draw implied-payment allowance is capped, absent when shallow, lower when vulnerable', () => {
  const nut = spot(['Ah','5h'], ['Kh','9h','2c']).sp;
  const weak = spot(['5h','4h'], ['Kh','9h','2c']).sp;
  const shallow = spot(['Ah','5h'], ['Kh','9h','2c'], { stack:100 }).sp;
  assert.ok(B.drawPrice(nut, 0.4).implied <= 0.05);
  assert.ok(B.drawPrice(nut, 0.4).implied > B.drawPrice(weak, 0.4).implied);
  assert.strictEqual(B.drawPrice(shallow, 0.4).implied, 0);
});
check('Bluff break-even uses actual chips; a raise has less fold credit than a bet', () => {
  const { sp } = dry(), b = B.bluffAssessment(sp, 90, false), r = B.bluffAssessment(sp, 90, true);
  assert.strictEqual(b.breakEven, 90 / 200); assert.ok(r.folds < b.folds);
  assert.ok(B.bluffAssessment(sp, 550, false).breakEven > b.breakEven);
});
check('Bluff plan reads the public betting story and never folds an all-in opponent', () => {
  const { g, sp } = dry(), quiet = B.bluffAssessment(sp, 40, false);
  act(g, 1, 'bet', 40);
  const strong = B.bluffAssessment(B.spot(g, you(g)), 40, false);
  assert.ok(strong.folds < quiet.folds);
  g.players[1].allIn = true; g.players[1].chips = 0;
  assert.strictEqual(B.bluffAssessment(B.spot(g, you(g)), 40, false).folds, 0);
});
check('River blocker explanations distinguish an ace from a missed draw', () => {
  const ace = spot(['Ah','4c'], ['Kh','Jh','2h','8s','9d']).sp;
  const missed = spot(['Ah','4h'], ['Kh','Jh','2c','8s','9d']).sp;
  assert.match(B.bluffAssessment(ace, 70, false).blocker, /strongest flushes/);
  assert.match(B.bluffAssessment(missed, 70, false).blocker, /missed draws/);
});
check('Drawing against a known caller can check rather than automatically semi-bluff', () => {
  const { sp } = spot(['5h','4h'], ['Kh','9h','2c'], { read:{ hands:30, facedBet:30, foldedToBet:0 } });
  assert.strictEqual(B.advise(sp).move, 'check');
});
check('Small kicker warning is board-relative and only used when applicable', () => {
  assert.match(spot(['Kh','4c'], ['Ks','9h','2c']).sp.boardFacts.strengthNote, /side card is small/);
  assert.strictEqual(spot(['Kh','Ac'], ['Ks','9h','2c']).sp.boardFacts.strengthNote, '');
});
function layered(stack = 50){
  const g = table(3, 0, 0, { hole:H('Ah','9d'), stack:1000 });
  street(g, 'river', ['Kh','Qh','Jh','Th','2c'].map(C));
  g.players.forEach((p, i) => { p.totalBetHand = [100,100,300][i]; p.betThisRound = [0,0,200][i]; });
  g.players[0].chips = stack; g.players[1].chips = 0; g.players[1].allIn = true;
  g.currentBet = 200; g.pot = 500;
  return g;
}
check('Short caller excludes inaccessible side-pot and unmatched money', () => {
  const g = layered(), sp = B.spot(g, you(g)), p = B.potAssessment(sp);
  assert.strictEqual(p.available, 400); assert.strictEqual(p.excluded, 150);
  assert.strictEqual(p.odds, 50 / 400);
  assert.deepStrictEqual(Array.from(p.layers, x => x.amount), [300,100]);
  assert.deepStrictEqual(Array.from(p.layers, x => x.opponentIds.length), [2,1]);
  assert.strictEqual(p.equity, 1); assert.strictEqual(p.callValue, 350);
  assert.strictEqual(B.advise(sp).n.odds, 13);
});
check('Covering caller assesses each pot against its own eligible opponents', () => {
  const g = layered(500), p = B.potAssessment(B.spot(g, you(g)));
  assert.strictEqual(p.available, 700); assert.strictEqual(p.excluded, 0);
  assert.deepStrictEqual(Array.from(p.layers, x => x.amount), [300,400]);
  assert.deepStrictEqual(Array.from(p.layers, x => x.opponentIds.length), [2,1]);
  assert.strictEqual(p.odds, 200 / 700);
});
check('Folded money remains in the pot but a folded player is not an equity opponent', () => {
  const g = layered(); g.players[1].folded = true;
  const p = B.potAssessment(B.spot(g, you(g)));
  assert.strictEqual(p.available, 400);
  assert.ok(p.layers.every(x => x.opponentIds.length === 1));
});
check('Side-pot equity is cached and never inspects hidden cards', () => {
  const g = layered();
  g.players.slice(1).forEach(p => Object.defineProperty(p, 'hand', { get(){ throw Error('hidden cards'); } }));
  const sp = B.spot(g, you(g)); assert.strictEqual(B.potAssessment(sp), B.potAssessment(sp));
});
check('Raise continuations are stronger than ordinary bet continuations', () => {
  const { sp } = river();
  assert.ok(B.valueContinuation(sp, 70, true).calledMadeShare < B.valueContinuation(sp, 70).calledMadeShare);
});
check('Future continuation equity is sampled and carries an explicit future-price caveat', () => {
  const { sp } = dry(), p = B.continuationEquity(sp, 40);
  assert.ok(p.equity >= 0 && p.equity <= 1); assert.strictEqual(p.samples, 400);
  assert.strictEqual(p.horizon, 'runout'); assert.match(p.futurePrice, /Further bets/);
  assert.strictEqual(p, B.continuationEquity(sp, 40));
  assert.strictEqual(B.valueBetPlan(sp, .95).runout, p);
});
check('River continuation uses current showdown strength without invented future cards', () => {
  const { sp } = river(), p = B.continuationEquity(sp, 40);
  assert.strictEqual(p.samples, 0); assert.strictEqual(p.horizon, 'showdown');
  assert.strictEqual(p.equity, B.valueContinuation(sp, 40).calledMadeShare);
});
check('A new threatening card revises the same-hand plan, not persistent player memory', () => {
  const { g, sp } = dry(); B.handStart(g); act(g, 0, 'bet', 40); B.record(sp, g, you(g));
  street(g, 'turn', [C('Tc')]); act(g, 1, 'bet', 60);
  const a = B.advise(B.spot(g, you(g)));
  assert.match(a.actionPlan.change, /new card|betting now/);
  assert.strictEqual(a.actionPlan.position, 'last-to-act');
  assert.match(a.actionPlan.futureRisk, /Further bets/);
  const other = dry().sp; assert.strictEqual(other.previousPlan, null);
});
check('Tournament commitment carries survival context without claiming payout maths', () => {
  const { g } = dry(); g.mode = 'tournament';
  let sp = B.spot(g, you(g)), p = B.tacticalPlan(sp, { action:'raise', amount:sp.stack }, null);
  assert.strictEqual(p.format, 'elimination'); assert.match(p.formatNote, /payout pressure is not calculated/);
  g.mode = 'cash'; sp = B.spot(g, you(g)); p = B.tacticalPlan(sp, { action:'raise', amount:sp.stack }, null);
  assert.strictEqual(p.formatNote, '');
});
console.log('\n' + passed + ' Phase 2 tactical checks passed.');
