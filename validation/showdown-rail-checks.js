#!/usr/bin/env node
"use strict";

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const poker=fs.readFileSync(path.join(root,'js/01-poker-math.js'),'utf8');
const modelSource=fs.readFileSync(path.join(root,'js/showdown-rail-model.js'),'utf8');
const labSource=fs.readFileSync(path.join(root,'js/showdown-rail-lab.js'),'utf8');
const html=fs.readFileSync(path.join(root,'showdown-rail-lab.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/showdown-rail-lab.css'),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

const context={console,setTimeout,clearTimeout};
vm.createContext(context);
vm.runInContext(poker+'\n'+modelSource+`\nglobalThis.railApi={
  fixtures:SHOWDOWN_RAIL_FIXTURES,byId:showdownRailFixtureById,build:buildShowdownRailModel,
  order:showdownRailOrder,treatments:showdownRailTreatments,evaluate5:evaluate5,compare:compareHands,cardKey:cardKey
};`,context);
const api=context.railApi;
const plain=value=>JSON.parse(JSON.stringify(value));
const fixture=id=>api.byId(id);
const model=(id,award)=>plain(api.build(fixture(id),award));
const values=id=>model(id).cards.map(c=>c.value);
const strongCount=id=>model(id).cards.filter(c=>c.treatment==='strong').length;

check('The harness contains every required deterministic fixture',()=>{
  const ids=plain(api.fixtures).map(f=>f.id);
  ['human-pair','opponent-two-pair','trips','mixed-straight','wheel','flush','full-house','quads',
   'board-split','split-hole-sources','side-pot-winner','hidden-opponent'].forEach(id=>assert.ok(ids.includes(id),id));
  assert.ok(ids.length>=12);
});

check('Every rail uses the production evaluator exact five-card result',()=>{
  api.fixtures.forEach(f=>{
    const m=api.build(f);
    assert.strictEqual(m.cards.length,5,f.id);
    const evaluated=api.evaluate5(m.cards);
    assert.strictEqual(api.compare(evaluated,m.winnerHands[0].result),0,f.id);
    const available=new Set(f.board.concat(f.players.find(p=>p.id===m.winnerIds[0]).hole).map(api.cardKey));
    m.cards.forEach(card=>assert.ok(available.has(card.key),f.id+' '+card.key));
  });
});

check('High card is descending with the leading card first',()=>{
  assert.deepStrictEqual(values('high-card'),[14,13,12,9,7]);
  assert.strictEqual(strongCount('high-card'),1);
});

check('Pair is grouped first with descending kickers',()=>{
  assert.deepStrictEqual(values('human-pair'),[14,14,12,9,7]);
  assert.strictEqual(strongCount('human-pair'),2);
});

check('Two pair is higher pair, lower pair, then kicker',()=>{
  assert.deepStrictEqual(values('opponent-two-pair'),[13,13,9,9,14]);
  assert.strictEqual(strongCount('opponent-two-pair'),4);
});

check('Three of a kind is grouped before descending kickers',()=>{
  assert.deepStrictEqual(values('trips'),[8,8,8,14,13]);
  assert.strictEqual(strongCount('trips'),3);
});

check('Mixed-source straight is a descending readable sequence',()=>{
  assert.deepStrictEqual(values('mixed-straight'),[12,11,10,9,8]);
  assert.strictEqual(strongCount('mixed-straight'),5);
  assert.ok(new Set(model('mixed-straight').cards.map(c=>c.source)).size>1);
});

check('Wheel straight is visually 5-4-3-2-A',()=>{
  const m=model('wheel');
  assert.deepStrictEqual(m.cards.map(c=>c.rank),['5','4','3','2','A']);
  assert.strictEqual(m.handName,'Straight, Five high');
});

check('Flush is descending and all five cards are strong',()=>{
  assert.deepStrictEqual(values('flush'),[14,12,9,7,2]);
  assert.strictEqual(strongCount('flush'),5);
});

check('Full house puts the trips before the pair and marks all five strong',()=>{
  assert.deepStrictEqual(values('full-house'),[6,6,6,8,8]);
  assert.strictEqual(strongCount('full-house'),5);
});

check('Four of a kind puts four matching cards before the kicker',()=>{
  assert.deepStrictEqual(values('quads'),[11,11,11,11,14]);
  assert.strictEqual(strongCount('quads'),4);
});

check('Straight flush is ordered and treats all five as the made hand',()=>{
  assert.deepStrictEqual(values('straight-flush'),[10,9,8,7,6]);
  assert.strictEqual(strongCount('straight-flush'),5);
});

check('Board-play split data names both winners and shares one exact five',()=>{
  const m=model('board-split');
  assert.strictEqual(m.split,true);
  assert.strictEqual(m.sharedBestFive,true);
  assert.deepStrictEqual(m.winnerIds,['you','mara']);
  assert.ok(m.cards.every(c=>c.source==='board'));
  assert.strictEqual(m.winnerLabel,'YOU + MARA SPLIT');
});

check('Different-source split data retains both exact winner hands',()=>{
  const m=model('split-hole-sources');
  assert.strictEqual(m.split,true);
  assert.strictEqual(m.sharedBestFive,false);
  assert.strictEqual(m.winnerHands.length,2);
  assert.ok(m.winnerHands[0].cards.some(c=>c.source==='you'));
  assert.ok(m.winnerHands[1].cards.some(c=>c.source==='mara'));
});

check('Main and side pots can be modelled independently with different winners',()=>{
  const main=model('side-pot-winner','main'), side=model('side-pot-winner','side');
  assert.deepStrictEqual(main.winnerIds,['you']);
  assert.deepStrictEqual(side.winnerIds,['mara']);
  assert.strictEqual(main.award.text,'Main Pot · 900');
  assert.strictEqual(side.award.text,'Side Pot · 760');
});

check('Hidden opponent fixture requires hole-card reveal from the winning seat',()=>{
  const f=fixture('hidden-opponent'), m=model('hidden-opponent');
  assert.strictEqual(f.players.find(p=>p.id==='mara').hidden,true);
  assert.ok(m.cards.some(c=>c.source==='mara'));
  assert.strictEqual(m.winnerLabel,'MARA WINS');
});

check('Replay cleanup removes clones, source suppression and stale result state',()=>{
  const reset=labSource.slice(labSource.indexOf('function resetPresentation'),labSource.indexOf('function sourceFor'));
  assert.ok(reset.includes("$('sdr-rail-cards').replaceChildren()"));
  assert.ok(reset.includes(".sdr-winning-source,.sdr-source-lifted,.is-award-winner"));
  assert.ok(reset.includes("classList.remove('is-settling','is-result','is-reduced')"));
  assert.ok(reset.includes("rail.classList.remove('is-armed','is-settled')"));
});

check('Reduced motion reveals in place without flight or stagger choreography',()=>{
  assert.ok(labSource.includes("if (reduced) $('sdr-table').classList.add('is-reduced')"));
  assert.ok(labSource.includes("shell.classList.add('is-reduced-ready')"));
  assert.ok(css.includes('[data-motion="off"] .sdr-connection{ display:none; }'));
  assert.ok(css.includes('transition:none!important; animation:none!important;'));
});

check('The isolated page loads production evaluator and card renderer but no live engine',()=>{
  assert.ok(html.includes('<script src="js/01-poker-math.js"></script>'));
  assert.ok(html.includes('<script src="js/06-presentation.js"></script>'));
  assert.ok(!html.includes('js/05-game-engine.js'));
  assert.ok(!html.includes('js/07-ui-wiring.js'));
  assert.ok(!html.includes('js/08-dev-mode.js'));
  assert.ok(labSource.includes('cardClass(faceDown,card,small)'));
  assert.ok(labSource.includes('cardInner(card)'));
});

check('Rail markup and layout reserve exactly five responsive card positions',()=>{
  assert.ok(html.includes('id="sdr-rail-cards"'));
  assert.ok(css.includes('grid-template-columns:repeat(5,44px)'));
  assert.ok(css.includes('grid-template-columns:repeat(5,42px)'));
  assert.ok(!css.includes('overflow-x:auto'));
});

process.stdout.write('\n'+passed+' focused Showdown Rail checks passed.\n');
