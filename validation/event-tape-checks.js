#!/usr/bin/env node
"use strict";

/* Focused checks for the event tape (js/event-tape.js): the recorder that
   feeds EVENT WON / EVENT LOST (chip tape, bust-out order, best hand, luck
   meter), its save sanitising, and the well it renders. The real file runs
   in a VM with the real poker maths; the few presentation helpers it
   borrows are stubbed.
   Run: node validation/event-tape-checks.js */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
function check(name, fn){ fn(); passed++; process.stdout.write('PASS  ' + name + '\n'); }

const ctx = {
  console, Math, JSON, Number, String, Array, Set, Map, Object, performance:{ now:()=>0 },
  advancePhaseCalls:0,
  motionOff:()=>true,
  esc:s=>String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
  ordinal:n=>{ const s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); },
  renderFace:(p,mood)=>'<img class="face" data-fc="'+p.faceColorIdx+'" data-mood="'+mood+'">',
  splitHandText:(cat,name)=>({ category:String(name).split(',')[0], descriptor:String(name).split(',').slice(1).join(',').trim() }),
  arrangeHandForDisplay:(cat,cards)=>cards,
  cardClass:()=>'card small',
  cardInner:c=>'<i>'+c.rank+'</i>',
  cardLabel:()=>'card',
  describeMade:r=>'cat '+r.cat
};
vm.createContext(ctx);
vm.runInContext(read('js/01-poker-math.js'), ctx);
// the engine's own best-hand helpers, lifted verbatim
const engine = read('js/05-game-engine.js');
const grab = name => { const i = engine.indexOf('function ' + name + '('); const j = engine.indexOf('\n}\n', i); return engine.slice(i, j + 3); };
vm.runInContext(grab('copyTrackedHand') + grab('updateTrackedBest'), ctx);
vm.runInContext('var advancePhase = function(){ advancePhaseCalls++; };', ctx);
vm.runInContext(read('js/event-tape.js') + ';globalThis.ET = EventTape;', ctx);
const ET = ctx.ET;

// A three-handed Career table.
function table(){
  const mk = (id, name, chips, human, fc) => ({ id, name, chips, isHuman:human, eliminated:false, inHand:true, folded:false, allIn:false, faceColorIdx:fc, _handStartChips:chips, totalBetHand:0 });
  return {
    mode:'career', event:{ id:'x' }, startingStack:500, handNumber:1, blindLevel:0, phase:'preflop', board:[],
    players:[ mk('you','You',500,true,null), mk('ai0','Tony',500,false,1), mk('ai1','Lucy',500,false,3) ]
  };
}
const hand = (g, fn) => { g.players.forEach(p => { p._handStartChips = p.chips; }); fn(); };

check('The tape starts at the starting stack and notes one point per settled hand', ()=>{
  const g = table();
  g._humanStart = 500;
  hand(g, () => { g.players[0].chips = 620; g.players[1].chips = 380; });
  ET.afterHand(g, { type:'foldwin' }, 120);
  ET.afterHand(g, { type:'foldwin' }, 120);         // the same hand twice is noted once
  g.handNumber = 2;
  hand(g, () => { g.players[0].chips = 540; g.players[1].chips = 460; g.blindLevel = 1; });
  ET.afterHand(g, { type:'foldwin' }, -80);
  same(g.tape.pts.map(p => [p[0], p[1], p[2]]), [[0,500,0],[1,620,0],[2,540,1]]);
  assert.strictEqual(g.tape.start, 500);
  assert.strictEqual(g.tape.total, 1500);
});

check('Only a Career event is recorded', ()=>{
  const g = table(); g.mode = 'elimination';
  ET.afterHand(g, { type:'foldwin' }, 0);
  assert.strictEqual(g.tape, undefined);
});

check('Your K.O. is credited from the pot the busted player was last in', ()=>{
  const g = table();
  hand(g, () => { g.players[1].chips = 0; g.players[1].eliminated = true; g.players[0].chips = 1000; });
  ET.afterHand(g, { type:'showdown', contenders:[], potResults:[
    { amount:1000, eligible:['you','ai0'], winnerIds:['you'], winnerShares:[{ id:'you', amount:1000 }], hand:'Full House', contested:2 }
  ] }, 500);
  const o = g.tape.out[0];
  assert.strictEqual(o.name, 'Tony'); assert.strictEqual(o.ko, true); assert.strictEqual(o.place, 3);
  same(o.by, ['You']); assert.strictEqual(o.fc, 1);
});

check('Someone else\'s knockout is not yours', ()=>{
  const g = table();
  hand(g, () => { g.players[1].chips = 0; g.players[1].eliminated = true; });
  ET.afterHand(g, { type:'showdown', contenders:[], potResults:[
    { amount:1000, eligible:['ai0','ai1'], winnerIds:['ai1'], winnerShares:[{ id:'ai1', amount:1000 }], hand:'Flush', contested:2 }
  ] }, 0);
  assert.strictEqual(g.tape.out[0].ko, false);
  same(g.tape.out[0].by, ['Lucy']);
});

check('Your bust names who got you and with what; a same-hand tie places you higher', ()=>{
  const g = table();
  hand(g, () => {
    g.players[0].chips = 0; g.players[1].chips = 0; g.players[1].eliminated = true; g.players[2].chips = 1500;
  });
  ET.afterHand(g, { type:'showdown', contenders:[], potResults:[
    { amount:1500, eligible:['you','ai0','ai1'], winnerIds:['ai1'], winnerShares:[{ id:'ai1', amount:1500 }], hand:'Two Pair', contested:3 }
  ] }, -500);
  const you = g.tape.out.find(o => o.you), tony = g.tape.out.find(o => o.name === 'Tony');
  same(you.by, ['Lucy']); assert.strictEqual(you.hand, 'Two Pair');
  assert.strictEqual(you.place, 2); assert.strictEqual(tony.place, 3);
  assert.strictEqual(g.tape.pts[g.tape.pts.length - 1][1], 0);
});

check('A runout notes your odds; the result is your share of the pots you were in', ()=>{
  const g = table();
  const me = g.players[0];
  // everyone all in preflop: a runout
  g.players.forEach(p => { p.allIn = true; p.hand = []; });
  me.hand = [{ rank:'A', suit:'♠', value:14 }, { rank:'A', suit:'♥', value:14 }];
  g.players[1].hand = [{ rank:'7', suit:'♣', value:7 }, { rank:'2', suit:'♦', value:2 }];
  g.players[2].hand = [{ rank:'K', suit:'♣', value:13 }, { rank:'K', suit:'♦', value:13 }];
  ctx.Showdown = { equities:()=>new Map([['you',62],['ai0',8],['ai1',30]]) };
  assert.strictEqual(ET.isRunout(g), true);
  ET.noteRunout(g);
  // you win the main pot (900) and lose the side pot (400)
  ET.afterHand(g, { type:'showdown', contenders:[], potResults:[
    { amount:900, eligible:['you','ai0','ai1'], winnerIds:['you'], winnerShares:[{ id:'you', amount:900 }], contested:3 },
    { amount:400, eligible:['you','ai1'], winnerIds:['ai1'], winnerShares:[{ id:'ai1', amount:400 }], contested:2 }
  ] }, -100);
  const a = g.tape.allins[0];
  assert.strictEqual(a.eq, .62);
  assert.ok(Math.abs(a.won - 900 / 1300) < 1e-9, String(a.won));
  delete ctx.Showdown;
});

check('Not a runout while you still have a decision to make', ()=>{
  const g = table();
  g.players[1].allIn = true; g.players[2].folded = true;
  assert.strictEqual(ET.isRunout(g), false);
});

check('The best hand is the best one you showed down', ()=>{
  const g = table();
  const me = g.players[0];
  const cards = s => s.split(' ').map(x => ({ rank:x[0], suit:x[1], value:'23456789TJQKA'.indexOf(x[0]) + 2 }));
  const pair = ctx.evaluate7WithCards(cards('A♠ A♥ K♦ 7♣ 2♠ 9♦ 4♥'));
  const high = ctx.evaluate7WithCards(cards('3♠ 5♥ K♦ 7♣ Q♠ 9♦ J♥'));
  const trips = ctx.evaluate7WithCards(cards('7♠ 7♥ K♦ 7♣ 2♠ 9♦ 4♥'));
  me._handRes = pair; ET.afterHand(g, { type:'showdown', contenders:[me], potResults:[] }, 0);
  g.handNumber = 2; me._handRes = high; ET.afterHand(g, { type:'showdown', contenders:[me], potResults:[] }, 0);
  assert.strictEqual(g.tape.best.result.cat, pair.result.cat, 'a worse hand does not replace it');
  g.handNumber = 3; me._handRes = trips; ET.afterHand(g, { type:'foldwin', contenders:[me] }, 0);
  assert.strictEqual(g.tape.best.result.cat, pair.result.cat, 'a hand nobody saw does not count');
  g.handNumber = 4; ET.afterHand(g, { type:'showdown', contenders:[me], potResults:[] }, 0);
  assert.strictEqual(g.tape.best.result.cat, trips.result.cat, 'a better one shown down does');
});

check('A save brings back only clean numbers and short strings', ()=>{
  assert.strictEqual(ET.clean(null), null);
  assert.strictEqual(ET.clean({ v:2, pts:[] }), null);
  const c = ET.clean({ v:1, start:'x', total:900, field:3, pts:[[0,500,0],'junk',[1,-5,0]],
    out:[{ id:1, name:'<b>'.repeat(20), place:2, by:'nope', ko:1 }], best:{ nope:true }, allins:[{ h:1, eq:4, won:-1 }] });
  same(c.pts, [[0,500,0],[1,0,0]]);
  assert.strictEqual(c.start, 0);
  assert.strictEqual(c.out[0].name.length, 24);
  same(c.out[0].by, []);
  assert.strictEqual(c.best, null);
  same(c.allins[0], { h:1, eq:1, won:0 });
});

check('The luck meter reads what happened against what the odds said', ()=>{
  assert.strictEqual(ET.luckOf([]).word, 'NO ALL-INS');
  assert.strictEqual(ET.luckOf([{ eq:.8, won:0 }, { eq:.7, won:0 }]).word, 'RAN BAD');
  assert.strictEqual(ET.luckOf([{ eq:.5, won:0 }]).word, 'BIT UNLUCKY');
  assert.strictEqual(ET.luckOf([{ eq:.5, won:.5 }]).word, 'FAIR');
  assert.strictEqual(ET.luckOf([{ eq:.3, won:1 }, { eq:.2, won:1 }]).word, 'RAN HOT');
});

check('The well: the tape, the verdict, the bust-out order, best hand and luck', ()=>{
  const g = table();
  const tape = ET.fixture(g, false, { place:2 });
  const html = ET.html({ tape, won:false, place:2, line:'YOU WERE ELIMINATED', sub:'BUY-IN FORFEITED', alive:[{ name:'Lucy', fc:3 }] });
  assert.ok(html.includes('data-result-beat="trophy"'));
  assert.ok(html.includes('YOU WERE ELIMINATED') && html.includes('BUY-IN FORFEITED'));
  assert.ok(html.includes('class="et-canvas"'));
  assert.ok(html.includes('BUST-OUT ORDER') && html.includes('BEST HAND') && html.includes('>LUCK<'));
  // a cabinet: one raised plastic panel, its labels printed on the casing,
  // the screens set into it
  assert.ok(/class="et-well pc-raised pc-material-plastic"/.test(html));
  ['CHIP TAPE', 'BUST-OUT ORDER', 'BEST HAND', 'LUCK'].forEach(l => assert.ok(new RegExp('<span class="pc-label">' + l).test(html), l + ' is printed on the casing'));
  assert.ok(html.includes('class="et-gauge"'), 'the luck strip');
  assert.ok(html.includes('STILL IN') || html.includes('GOT YOU'));
  assert.ok(/class="et-seat is-you is-dead"/.test(html));
  // every CRT screen here is built on the shared .crt
  (html.match(/class="[^"]*pc-display[^"]*"/g) || []).forEach(c => assert.ok(/\bcrt\b/.test(c), c));
  const bare = ET.html({ tape:ET.fixture(g, true, { noBest:true, noAllins:true }), won:true, place:1, line:'EVERY OPPONENT IS OUT', sub:'PRIZE CREDITED TO BANKROLL', alive:[] });
  assert.ok(bare.includes('NO SHOWDOWN') && bare.includes('NO ALL-INS') && bare.includes('WINNER'));
});

check('Text from a save is escaped in the well', ()=>{
  const g = table();
  const tape = ET.fixture(g, false, {});
  tape.out[0].name = '<script>';
  const html = ET.html({ tape, won:false, place:2, line:'X', sub:'Y', alive:[] });
  assert.ok(!html.includes('<script>'));
});

check('The recorder wraps advancePhase once and still calls through', ()=>{
  const before = ctx.advancePhaseCalls;
  vm.runInContext('advancePhase()', ctx);
  assert.strictEqual(ctx.advancePhaseCalls, before + 1);
});

check('The game wires it in: recorded after eliminations, saved, restored, shown and woken', ()=>{
  assert.ok(/EventTape\.afterHand\(g, outcome, netProfit\)/.test(engine));
  assert.ok(engine.indexOf('EventTape.afterHand') > engine.indexOf("} else if (g.mode === 'career'){"));
  assert.ok(/snapshot\.tape = tape/.test(engine));
  assert.ok(/game\.tape = EventTape\.clean\(save\.tape\)/.test(engine));
  assert.ok(/kind: m\.tape \? 'tape' : 'statement'/.test(engine));
  assert.ok(/EventTape\.wake\(el, model\.detail\)/.test(engine));
  const index = read('index.html'), sw = read('sw.js');
  ['css/event-tape.css', 'js/event-tape.js'].forEach(f => {
    assert.ok(index.includes(f), 'index.html loads ' + f);
    assert.ok(sw.includes('./' + f), 'sw.js caches ' + f);
  });
  assert.ok(index.indexOf('js/event-tape.js') > index.indexOf('js/showdown.js'), 'after showdown.js (it wraps its advancePhase)');
});

console.log('\n' + passed + ' focused Event Tape checks passed.');
