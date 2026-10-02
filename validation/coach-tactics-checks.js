"use strict";
// Phase 2, slice 1: public value targets, not a claim of solver accuracy.
const assert = require('assert');
const { B, H, C, table, street, you } = require('./tools/coach-sandbox');
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
console.log('\n' + passed + ' Phase 2 value-target checks passed.');
