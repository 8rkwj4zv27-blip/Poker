#!/usr/bin/env node
"use strict";
// Focused Phase 1 regressions. Real poker maths, wager bounds, brain and
// speech routing; a deterministic clock instead of browser race timing.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { B, H, C, ctx, table, act, street, you, LINES } = require('./tools/coach-sandbox');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS  ' + name); };
function flop(hole = H('Qs', 'Qd'), board = ['Qh', '7c', '2d']){
  const g = table(2, 1, 0, { hole });
  street(g, 'flop', board.map(C)); g.pot = 110;
  return g;
}
const spOf = g => B.spot(g, you(g));
function follow(g){
  const sp = spOf(g), a = B.advise(sp);
  act(g, 0, a.move === 'allin' ? 'raise' : a.move, a.to);
  return B.record(sp, g, you(g));
}
check('Unchanged preflop decisions reuse immutable analysis and advice', () => {
  const g = table(2, 1, 0, { hole:H('Qs', '6c') }); act(g, 1, 'raise', 50);
  const sp = spOf(g), a = B.advise(sp);
  for (let i = 0; i < 12; i++){
    assert.strictEqual(spOf(g), sp); assert.strictEqual(B.advise(spOf(g)), a);
    assert.strictEqual(B.judge(sp, { action:a.move, amount:a.to }).n.eq, a.n.eq);
  }
  assert.ok(Object.isFrozen(sp.hole[0]) && Object.isFrozen(a.n));
  act(g, 1, 'raise', 100);
  assert.notStrictEqual(spOf(g).decisionId, sp.decisionId);
});
check('Short matched raise obeys the engine minimum, not an illegal cap', () => {
  const g = flop(); g.currentBet = 100; g.minRaise = 80;
  g.players[1].betThisRound = 100; g.players[1].chips = 70;
  const sp = spOf(g), a = B.advise(sp), bounds = ctx.wagerBounds(g, you(g));
  assert.strictEqual(bounds.min, 180); assert.strictEqual(a.to, 180);
  assert.ok(a.to >= bounds.min && a.to <= bounds.max);
  assert.strictEqual(ctx.snapWager(a.to, bounds), a.to);
});
check('A covering raise is an effective commitment, not an undersized shove', () => {
  const g = table(2, 1, 0, { hole:H('Ks', 'Th') });
  you(g).chips = 1400; g.players[1].chips = 70;
  const d = follow(g);
  assert.ok(d.recommendation.to < 1400); assert.strictEqual(d.followedAdvice, true);
  assert.notStrictEqual(d.judgement.tag, 'short.raise.small');
  assert.notStrictEqual(d.judgement.verdict, 'mistake');
});
check('A tiny planned commitment is not mislabelled a small value bet', () => {
  const g = flop(); you(g).chips = 70; g.pot = 1000;
  const d = follow(g);
  assert.strictEqual(d.recommendation.to, 70);
  assert.strictEqual(d.judgement.tag, 'bet.value.commit');
  assert.strictEqual(d.followedAdvice, true);
});
check('A capped one-pair bet is legal and does not criticise its own advice', () => {
  const g = flop(H('Ac', 'Tc'), ['9c', '7c', 'Th']); g.players[1].chips = 50;
  const d = follow(g);
  assert.notStrictEqual(d.judgement.verdict, 'mistake');
  assert.notStrictEqual(d.judgement.tag, 'bet.value.shove');
  assert.strictEqual(d.judgement.verdict, 'good');
});
check('Exact amount is remembered; following a different amount is not compliance', () => {
  const g = flop(), sp = spOf(g), a = B.advise(sp);
  act(g, 0, 'bet', a.to + 100);
  const d = B.record(sp, g, you(g));
  assert.strictEqual(d.recommendation, a); assert.strictEqual(d.followedAdvice, false);
  assert.strictEqual(d.recommendation.plan.purpose, 'keep-worse-in');
});
check('A 550 bluff into 110 needs 83% folds, not the suggested smaller bet price', () => {
  const g = flop(H('Qs', 'Jd'), ['8h', '4c', '2d']);
  act(g, 1, 'check'); const sp = spOf(g);
  const j = B.judge(sp, { action:'bet', amount:550, potFraction:5 });
  assert.strictEqual(j.n.foldNeed, 83); assert.strictEqual(j.verdict, 'mistake');
});
check('A large partial draw bet is assessed as heavy even without being all in', () => {
  const g = flop(H('Ah', '5h'), ['Kh', '9h', '2c']);
  g.reads.p1 = { hands:50, facedBet:50, foldedToBet:0 };
  const j = B.judge(spOf(g), { action:'bet', amount:1500, potFraction:1500 / 110 });
  assert.strictEqual(j.verdict, 'mistake'); assert.strictEqual(j.tag, 'bet.semi.heavy');
});
check('Free folds are mistakes, not good checks', () => {
  const g = flop(H('9s', '8d'), ['Kh', '9c', '2d']);
  const j = B.judge(spOf(g), { action:'fold' });
  assert.strictEqual(j.tag, 'bet.fold.free'); assert.strictEqual(j.verdict, 'mistake');
});
check('An all-in opponent contributes zero fold probability', () => {
  const g = flop(); g.players[1].allIn = true; g.players[1].chips = 0;
  assert.strictEqual(B.foldChance(spOf(g)), 0);
});
check('An oversized value raise is not automatically praised', () => {
  const g = flop(); act(g, 1, 'bet', 50);
  const j = B.judge(spOf(g), { action:'raise', amount:1000 });
  assert.strictEqual(j.tag, 'post.raise.value.large'); assert.strictEqual(j.verdict, 'fine');
});
check('Raise rights and short under-raise endpoints follow the table', () => {
  const g = flop(); act(g, 1, 'bet', 100);
  you(g).chips = 150; g.minRaise = 100;
  let a = B.advise(spOf(g)); assert.strictEqual(a.to, 150);
  you(g).mayRaise = false; a = B.advise(spOf(g));
  assert.ok(!['raise', 'allin', 'bet'].includes(a.move));
});
check('An all-in call is still recognised as following call advice', () => {
  const g = flop(H('Ks', 'Qd'), ['Kh', '9c', '2d']);
  act(g, 1, 'bet', 100); you(g).chips = 100;
  const d = follow(g);
  assert.strictEqual(d.recommendation.move, 'call'); assert.strictEqual(d.choice.action, 'allin');
  assert.strictEqual(d.followedAdvice, true);
});
check('Partial draw raises use the actual commitment, not just the all-in flag', () => {
  const g = flop(H('Qs', 'Jh'), ['Ts', '9d', '2c']); street(g, 'turn', [C('6h')]);
  you(g).chips = 400; g.reads.p1 = { hands:50, facedBet:50, foldedToBet:0 };
  act(g, 1, 'bet', 40);
  const j = B.judge(spOf(g), { action:'raise', amount:300 });
  assert.strictEqual(j.tag, 'post.raise.semi.heavy'); assert.strictEqual(j.verdict, 'mistake');
});

// A minimal DOM and clock run the actual coach-talk lifecycle, including
// its hooks, queue and watch interval. No test-only production exports.
let now = 1, timerId = 0;
const timers = new Map(), listeners = {}, storage = new Map(), presented = [];
function schedule(fn, delay, interval){ const id = ++timerId; timers.set(id, { fn, at:now + delay, interval }); return id; }
function advance(ms){
  const end = now + ms;
  while (true){
    const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    const [id, t] = next; now = t.at;
    if (t.interval) t.at += t.interval; else timers.delete(id);
    t.fn();
  }
  now = end;
}
function element(){
  const children = {}, classes = new Set();
  return { dataset:{}, style:{ setProperty(){} }, innerHTML:'', textContent:'',
    classList:{ add:k => classes.add(k), contains:k => classes.has(k), toggle(){} },
    setAttribute(){}, addEventListener(){}, remove(){ this.removed = true; },
    querySelector:k => children[k] || (children[k] = element()),
    querySelectorAll:() => [] };
}
Object.assign(ctx, {
  game:flop(), pendingHumanPlayer:null, settings:{ sound:false },
  document:{ readyState:'loading', getElementById:() => null, createElement:element,
    body:{ appendChild:el => presented.push(el) },
    addEventListener:(name, fn) => { listeners[name] = fn; }, dispatchEvent(){} },
  CustomEvent:function(type, options){ this.type = type; this.detail = options.detail; },
  localStorage:{ getItem:k => storage.get(k) || null, setItem:(k, v) => storage.set(k, v) },
  addEventListener(){}, performance:{ now:() => now }, motionOff:() => true,
  setTimeout:(fn, delay = 0) => schedule(fn, delay, 0), clearTimeout:id => timers.delete(id),
  setInterval:(fn, delay) => schedule(fn, delay, delay), requestAnimationFrame:fn => fn(),
  CoachSet:{ on:true, busy:false, mouth(){}, setMood(){}, look(){} },
  updateCoach(){}, applyAction:(p, d) => act(ctx.game, ctx.game.players.indexOf(p), d.action, d.amount)
});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/coach-talk.js'), 'utf8') + '\nglobalThis.CT = CoachTalk;', ctx);
listeners.DOMContentLoaded();
const CT = ctx.CT;
CT.apply({ volume:'silent', textIn:'all', mouth:'still' });
const moments = start => presented.slice(start).map(el => el.dataset.moment);
const resetSpeech = g => { CT.clear(); ctx.game = g; ctx.game._humanCardsVisible = true; ctx.pendingHumanPlayer = you(g); advance(200); };

check('A correctly followed ordinary value bet does not get a smaller-bet fold lecture', () => {
  const g = flop(), d = follow(g);
  const v = CT.verdictOf({ n:g.handNumber, decisions:[d], end:{ net:110, showdown:false } });
  assert.strictEqual(v.foldWin, true);
  assert.ok(LINES()[v.keys[0]].every(line => !/smaller bet|lower bet/.test(line[2])));
});
check('A fold-result explanation is attributed only to the terminal aggressive decision', () => {
  const g = flop(), earlier = follow(g);
  const later = { spot:earlier.spot, choice:{ action:'check' }, judgement:{ verdict:'fine', confidence:'close', tag:'bet.check.medium', n:{} } };
  const v = CT.verdictOf({ decisions:[earlier, later], end:{ net:110, showdown:false } });
  assert.strictEqual(v.top, earlier); assert.strictEqual(v.foldWin, false);
});
check('Planned commitments never add a generic smaller-raise tip', () => {
  const g = flop(); you(g).chips = 70; const d = follow(g);
  const v = CT.verdictOf({ decisions:[d], end:{ net:110, showdown:false } });
  assert.strictEqual(v.extraTip, null);
});
check('Covered postflop commitment advice names the matched amount, not the whole stack', () => {
  const g = flop(); g.players[1].chips = 70; resetSpeech(g); CT.clear();
  CT.sayAdvice(B.advise(spOf(g)), spOf(g), 4, 1);
  assert.strictEqual(presented.at(-1).dataset.moment, 'advise.bet.bet.commit.match');
  const text = presented.at(-1).querySelector('.ctk-said').innerHTML;
  assert.ok(text.includes('70') && text.includes('you need not put your whole stack in'));
});
check('Actual-size correction fills the recommended raise amount in result speech', () => {
  const g = flop(); act(g, 1, 'bet', 50); const sp = spOf(g);
  const j = B.judge(sp, { action:'raise', amount:1000 });
  resetSpeech(g); CT.clear(); CT.sayAt([j.tag + '.why'], CT.slots(sp, j), 1);
  assert.ok(!presented.at(-1).querySelector('.ctk-said').innerHTML.includes('{to}'));
});
check('Rapid action cancels deferred turn advice', () => {
  const g = flop(); resetSpeech(g); const start = presented.length;
  ctx.updateCoach(); ctx.pendingHumanPlayer = null; act(g, 0, 'check'); advance(1000);
  assert.ok(!moments(start).some(m => /^advise\.|yourPrice|yourFree/.test(m)));
});
check('A changed price cancels deferred advice even for the same player', () => {
  const g = flop(); resetSpeech(g); const start = presented.length;
  ctx.updateCoach(); act(g, 1, 'bet', 100); advance(1000);
  assert.ok(!moments(start).some(m => /^advise\.|yourPrice|yourFree/.test(m)));
});
check('A queued line cannot spill into a new hand', () => {
  const g = flop(); resetSpeech(g); CT.clear();
  CT.sayAny('yourFree'); CT.sayAt(['yourPrice'], { call:10, pot:110, odds:8 }, 1);
  const start = presented.length; g.handNumber++; advance(8000);
  assert.ok(!moments(start).includes('yourPrice'));
});
check('Tapping after a re-raise rebuilds the read at the new price', () => {
  const g = flop(); act(g, 1, 'bet', 50); resetSpeech(g); CT.clear();
  CT.onTap(); const first = presented.at(-1).querySelector('.ctk-said').innerHTML;
  act(g, 1, 'raise', 120); CT.onTap();
  assert.strictEqual(presented.at(-1).dataset.moment, 'tap.read');
  assert.notStrictEqual(presented.at(-1).querySelector('.ctk-said').innerHTML, first);
});
check('Interrupted lessons do not unlock vocabulary', () => {
  resetSpeech(flop()); CT.clear(); CT.apply({ volume:'silent', textIn:'type', mouth:'still' });
  ctx.motionOff = () => false;
  CT.sayAny('lesson.draw-shove'); advance(10); CT.clear(); advance(1000);
  assert.ok(!storage.has('pip.coach'));
  CT.sayAny('lesson.draw-shove'); advance(14000);
  assert.ok(JSON.parse(storage.get('pip.coach')).terms['draw-shove']);
  ctx.motionOff = () => true;
});
check('An ended-hand lesson is cancelled by the next deal', () => {
  const g = flop(); resetSpeech(g); CT.clear();
  const d = follow(g), h = { n:g.handNumber, startStack:2000, decisions:[d], end:{ net:110, showdown:false } };
  CT.labDebrief(h); const start = presented.length; g.handNumber++;
  advance(14000);
  assert.ok(!moments(start).includes('lesson.value-betting'));
});
check('Lab explanations retain their floor when the live game updates', () => {
  const g = flop(), d = follow(g); resetSpeech(flop()); CT.clear();
  CT.apply({ volume:'silent', textIn:'all', mouth:'still' });
  CT.explain(d, d.recommendation); const start = presented.length;
  ctx.updateCoach(); act(ctx.game, 1, 'bet', 100); advance(20000);
  assert.ok(moments(start).includes('bet.value.why'));
  assert.ok(!moments(start).some(m => /^advise\.post|yourPrice/.test(m)));
});
check('Routine value turns are quiet, without a generic price fallback', () => {
  const g = flop(); resetSpeech(g); CT.clear(); const start = presented.length;
  ctx.updateCoach(); advance(1100);
  assert.ok(!moments(start).some(m => /^advise\.|yourPrice|yourFree/.test(m)));
});
check('Quieter turns still allow a full read by tapping PIP', () => {
  const g = flop(); resetSpeech(g); CT.clear(); const start = presented.length;
  CT.onTap();
  assert.ok(presented.length > start);
  assert.ok(presented.at(-1).querySelector('.ctk-said').innerHTML);
});
check('Tell me remains explicit full guidance, deduplicated per decision', () => {
  const g = flop(); resetSpeech(g); CT.clear();
  CT.apply({ help:'4', volume:'silent', textIn:'all', mouth:'still' });
  assert.strictEqual(CT.yourTurn(you(g)), true);
  const start = presented.length;
  assert.strictEqual(CT.yourTurn(you(g)), false); assert.strictEqual(presented.length, start);
  CT.apply({ volume:'silent', textIn:'all', mouth:'still' });
});
check('Commitments still prompt automatically in the quieter default', () => {
  const g = flop(); you(g).chips = 70; resetSpeech(g); CT.clear();
  assert.strictEqual(CT.yourTurn(you(g)), true);
  assert.match(presented.at(-1).dataset.moment, /^advise\./);
});
check('Automatic policy distinguishes routine, expensive draws and re-raises', () => {
  const g = flop(), sp = spOf(g), a = B.advise(sp);
  assert.strictEqual(CT.automaticReason(a, sp), null);
  const draw = flop(H('5h','4h'), ['Kh','9h','2c']); act(draw, 1, 'bet', 110);
  const ds = spOf(draw); assert.strictEqual(CT.automaticReason(B.advise(ds), ds).key, 'expensive-draw');
  assert.strictEqual(CT.automaticReason(a, Object.assign({}, sp, { streetRaises:2 })).critical, true);
});
check('Soft intervention budget resets per hand; critical changes can bypass it', () => {
  const g = flop(); resetSpeech(g); CT.clear();
  const originalSpot = B.spot, originalAdvice = B.advise, base = spOf(g), advice = B.advise(base);
  let serial = 900000, phase = 'flop', raises = 0, handNo = g.handNumber;
  B.spot = () => Object.assign({}, base, { decisionId:serial, street:phase, streetRaises:raises, handNumber:handNo });
  B.advise = () => Object.assign({}, advice, { actionPlan:{ change:'New betting pressure.' } });
  try{
    assert.strictEqual(CT.yourTurn(you(g)), true); CT.clear(); serial++;
    assert.strictEqual(CT.yourTurn(you(g)), false); // same street
    phase = 'turn'; serial++; assert.strictEqual(CT.yourTurn(you(g)), true); CT.clear();
    phase = 'river'; serial++; assert.strictEqual(CT.yourTurn(you(g)), false); // two per hand
    raises = 2; serial++; assert.strictEqual(CT.yourTurn(you(g)), true); CT.clear();
    raises = 0; handNo++; serial++; assert.strictEqual(CT.yourTurn(you(g)), true);
  } finally { B.spot = originalSpot; B.advise = originalAdvice; CT.clear(); }
});
console.log('\n' + passed + ' P.I.P. reliability checks passed.');
