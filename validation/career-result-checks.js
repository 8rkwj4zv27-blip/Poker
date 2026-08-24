#!/usr/bin/env node
"use strict";

/* Focused, dependency-free regression checks for the functional Career
   result slice. The app is intentionally framework-free, so this harness
   evaluates the real plain-script helpers in isolated VM contexts and uses
   tiny DOM stubs only for the result-console binding. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const engineSource = fs.readFileSync(path.join(root, 'js/05-game-engine.js'), 'utf8');
const presentationSource = fs.readFileSync(path.join(root, 'js/06-presentation.js'), 'utf8');

let passed = 0;
function check(name, fn){
  fn();
  passed++;
  process.stdout.write('PASS  ' + name + '\n');
}
function esc(s){
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

const engineContext = {
  console,
  esc,
  careerBankroll:()=>600
};
vm.createContext(engineContext);
vm.runInContext(engineSource +
  ';globalThis.__careerChecks={careerResultHTML,buildCareerResultModel,showdownPotVerb,careerFinishPlace};', engineContext);
const { careerResultHTML, buildCareerResultModel, showdownPotVerb, careerFinishPlace } = engineContext.__careerChecks;

const winGame = {
  event:{ name:'BACK ROOM FREEZEOUT', buyIn:100, prize:300, payouts:[300], reward:{score:5575} },
  handNumber:7
};
const winModel = buildCareerResultModel(winGame,
  { outcome:'win', place:1, prize:300, delta:300, bankroll:600 });
const winHTML = careerResultHTML(winModel);
const lossModel = {
  outcome:'loss', won:false, cashed:false, place:3, eventName:'BACK ROOM FREEZEOUT', prize:0,
  buyIn:100, bankroll:400, eventScore:1275, hands:4
};
const lossHTML = careerResultHTML(lossModel);
const pubModel = buildCareerResultModel({
  event:{ name:'PUB CIRCUIT FREEZEOUT', buyIn:300, prize:1200, payouts:[1200], reward:{score:8640} },
  handNumber:12
}, { outcome:'win', place:1, prize:1200, delta:1200, bankroll:600 });
const pubHTML = careerResultHTML(pubModel);
const cashModel = buildCareerResultModel({
  event:{ name:'PUB CIRCUIT OPEN', buyIn:300, prize:1050, payouts:[1050,450], reward:{score:4120} },
  handNumber:23
}, { outcome:'cash', place:2, prize:450, delta:450, bankroll:1150 });
const cashHTML = careerResultHTML(cashModel);
const forfeitModel = buildCareerResultModel({
  event:{ name:'PUB CIRCUIT OPEN', buyIn:300, prize:1050, payouts:[1050,450], reward:{score:80} },
  handNumber:2
}, { outcome:'forfeit', place:null, prize:0, delta:-300, bankroll:200 });
const forfeitHTML = careerResultHTML(forfeitModel);

check('Career result model captures the settled display values once', ()=>{
  assert.deepStrictEqual(JSON.parse(JSON.stringify(winModel)), {
    outcome:'win', won:true, cashed:false, place:1, eventName:'BACK ROOM FREEZEOUT', prize:300,
    buyIn:100, bankroll:600, eventScore:5575, hands:7
  });
});

check('A non-winning cash models the credited prize, not the headline first prize', ()=>{
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cashModel)), {
    outcome:'cash', won:false, cashed:true, place:2, eventName:'PUB CIRCUIT OPEN', prize:450,
    buyIn:300, bankroll:600, eventScore:4120, hands:23
  });
  // The event's own first-place figure must never leak into a second place.
  assert.ok(!cashHTML.includes('1,050'));
});

check('A cash result reads as positive, placed and clearly not a win', ()=>{
  ['EVENT CASHED','PUB CIRCUIT OPEN','2ND','+$450','4,120','23'].forEach(value=>
    assert.ok(cashHTML.includes(value), value));
  assert.ok(cashHTML.includes('career-result-panel is-cash'));
  assert.ok(!cashHTML.includes('EVENT WON'));
  assert.ok(!cashHTML.includes('EVENT LOST'));
  assert.ok(!cashHTML.includes('BUY-IN LOST'));
});

check('A settled record with no placement renders no FINISH row', ()=>{
  assert.ok(!forfeitHTML.includes('FINISH'));
  assert.ok(forfeitHTML.includes('BUY-IN LOST'));
  assert.ok(forfeitHTML.includes('EVENT LOST'));
  assert.ok(!forfeitHTML.includes('is-cash'));
  assert.strictEqual(forfeitModel.place, null);
});

check('Only a cash carries the restrained cash treatment', ()=>{
  [winHTML, lossHTML, pubHTML, forfeitHTML].forEach(html=>assert.ok(!html.includes('is-cash')));
  assert.ok(winHTML.includes('<section class="career-result-panel" '));
});

check('Every finish with a known place reports it', ()=>{
  assert.ok(winHTML.includes('FINISH') && winHTML.includes('1ST'));
  assert.ok(lossHTML.includes('FINISH') && lossHTML.includes('3RD'));
  assert.ok(cashHTML.includes('FINISH') && cashHTML.includes('2ND'));
});
check('Career win contains complete atomic formatted strings', ()=>{
  ['EVENT WON','BACK ROOM FREEZEOUT','+$300','5,575','7','$600'].forEach(value=>assert.ok(winHTML.includes(value), value));
  assert.ok(winHTML.includes('<span class="career-res-v tabular">+$300</span>'));
  assert.ok(winHTML.includes('<span class="career-res-v tabular">5,575</span>'));
  assert.ok(winHTML.includes('<span class="career-res-v tabular">$600</span>'));
});
check('Career loss contains lost buy-in, score, hands and remaining bankroll', ()=>{
  ['EVENT LOST','BACK ROOM FREEZEOUT','-$100','1,275','4','$400'].forEach(value=>assert.ok(lossHTML.includes(value), value));
});
check('Career result reads its dynamic active-event snapshot', ()=>{
  ['PUB CIRCUIT FREEZEOUT','+$1,200','8,640','12','$600'].forEach(value=>assert.ok(pubHTML.includes(value), value));
  assert.ok(!pubHTML.includes('BACK ROOM FREEZEOUT'));
});
check('Career result uses no fragmented mechanical amount markup', ()=>{
  assert.ok(!/(jp-cell|reel-strip|amt-readout|stage-results-stack|stage-results-score)/.test(winHTML + lossHTML));
});
check('Career result markup contains no NEXT TABLE copy', ()=>{
  assert.ok(!/NEXT TABLE/.test(winHTML + lossHTML));
});
/* Table fixtures for careerFinishPlace. `start` is the stack each player
   brought to the final hand (_handStartChips); `chips` is what they have
   after it. An opponent with start 0 was already eliminated on an earlier
   hand and must never be treated as a same-hand bust. */
function table(human, opponents){
  const seat = (id, spec) => ({
    id, isHuman:id === 'you', chips:spec.chips,
    _handStartChips: spec.start
  });
  const players = [seat('you', human)].concat(opponents.map((o,i)=>seat('ai'+i, o)));
  return { players, human:players[0] };
}
function placeIn(human, opponents){
  const t = table(human, opponents);
  return careerFinishPlace(t, t.human);
}

check('Placement is 1 whenever the human clears the table', ()=>{
  assert.strictEqual(placeIn({start:900,chips:2250}, [{start:750,chips:0},{start:600,chips:0}]), 1);
  // The corrected case: the human survives the final hand against an
  // opponent who BROUGHT A BIGGER STACK to it. Winning is winning.
  assert.strictEqual(placeIn({start:100,chips:1500}, [{start:1400,chips:0}]), 1);
  assert.strictEqual(placeIn({start:100,chips:3750}, [{start:1400,chips:0},{start:900,chips:0},{start:800,chips:0},{start:550,chips:0}]), 1);
});

check('A lone bust places the human directly behind the survivors', ()=>{
  assert.strictEqual(placeIn({start:200,chips:0}, [{start:1300,chips:1500}]), 2);
  assert.strictEqual(placeIn({start:200,chips:0}, [{start:800,chips:900},{start:700,chips:600}]), 3);
  assert.strictEqual(placeIn({start:200,chips:0},
    [{start:800,chips:900},{start:700,chips:600},{start:400,chips:250},{start:300,chips:0}]), 5);
});

check('Simultaneous busts are ranked by the stack brought to the hand', ()=>{
  // One survivor; the human and one opponent both bust on the same hand.
  // Human started SMALLER -> the opponent finishes ahead -> human is 3rd.
  assert.strictEqual(placeIn({start:100,chips:0}, [{start:1400,chips:2250},{start:200,chips:0}]), 3);
  // Human started LARGER -> the human finishes ahead -> human is 2nd.
  assert.strictEqual(placeIn({start:200,chips:0}, [{start:1400,chips:2250},{start:100,chips:0}]), 2);
  // Equal starting stacks -> documented tie policy gives the human the
  // better place.
  assert.strictEqual(placeIn({start:200,chips:0}, [{start:1400,chips:2250},{start:200,chips:0}]), 2);
  // Two opponents bust alongside the human, one ahead and one behind.
  assert.strictEqual(placeIn({start:300,chips:0},
    [{start:2000,chips:3750},{start:900,chips:0},{start:150,chips:0}]), 3);
});

check('Players eliminated on earlier hands never count as same-hand busts', ()=>{
  // start:0 means they arrived at this hand already broke. Even though 0 is
  // not greater than the human's stack, the explicit start>0 guard is what
  // keeps them out of the ranking entirely.
  assert.strictEqual(placeIn({start:400,chips:0}, [{start:2100,chips:2500},{start:0,chips:0},{start:0,chips:0}]), 2);
  // And a previously-eliminated player cannot displace a genuine same-hand
  // bust that really did start ahead.
  assert.strictEqual(placeIn({start:400,chips:0},
    [{start:1600,chips:2000},{start:900,chips:0},{start:0,chips:0}]), 3);
});

check('Placement is always an integer within the field', ()=>{
  const sizes = [2,3,4,5,6];
  sizes.forEach(size=>{
    for (let survivors=0; survivors<size; survivors++){
      const opponents = [];
      for (let i=0;i<size-1;i++){
        opponents.push(i < survivors ? {start:1000,chips:800} : {start:500,chips:0});
      }
      const human = survivors === size-1 ? {start:300,chips:0} : {start:300,chips:600};
      const place = placeIn(human, opponents);
      assert.ok(Number.isInteger(place), 'integer');
      assert.ok(place >= 1 && place <= size, 'in range: ' + place + ' of ' + size);
    }
  });
  // Defensive inputs never throw or produce a usable place.
  assert.strictEqual(careerFinishPlace(null, {chips:0}), null);
  assert.strictEqual(careerFinishPlace({players:[]}, {chips:0}), null);
  assert.strictEqual(careerFinishPlace({players:[{id:'you'}]}, null), null);
});

check('Showdown banner grammar is YOU WIN and named-opponent WINS', ()=>{
  assert.strictEqual(showdownPotVerb({winnerIds:['you'],split:false}), 'win');
  assert.strictEqual(showdownPotVerb({winnerIds:['wildcard'],split:false}), 'wins');
  assert.strictEqual(showdownPotVerb({winnerIds:['you','wildcard'],split:true}), 'split');
  assert.ok(presentationSource.includes("showdownPotVerb(main).toUpperCase()"));
  assert.ok(presentationSource.includes("showdownPotVerb(pot)"));
});

class FakeClassList {
  constructor(){ this.values = new Set(); }
  add(...names){ names.forEach(n=>this.values.add(n)); }
  remove(...names){ names.forEach(n=>this.values.delete(n)); }
  contains(name){ return this.values.has(name); }
}
function fakeElement(){
  return {
    classList:new FakeClassList(), textContent:'', disabled:false, onclick:null,
    attributes:{}, setAttribute(name,value){ this.attributes[name]=String(value); }
  };
}
const consoleEls = {
  'btn-award-pot-console':fakeElement(), 'actions-row':fakeElement(),
  'action-console':fakeElement(), 'console-flip':fakeElement()
};
const presentationContext = {
  console,
  $:id=>consoleEls[id] || null,
  Sound:{buttonRelease(){},consoleShift(){}},
  setTimeout:fn=>{ fn(); return 1; }, clearTimeout(){},
  showAwardConsole(label){
    consoleEls['btn-award-pot-console'].textContent=label;
    consoleEls['console-flip'].classList.add('flipped');
  }
};
vm.createContext(presentationContext);
vm.runInContext(presentationSource +
  ';globalThis.__consoleChecks={enterResultsConsole,enterCareerResultsConsole};', presentationContext);
const resultConsoles = presentationContext.__consoleChecks;

check('Career result console shows BACK TO EVENTS and no Arcade mode class', ()=>{
  let returns=0;
  resultConsoles.enterCareerResultsConsole(()=>{ returns++; });
  const button=consoleEls['btn-award-pot-console'];
  assert.strictEqual(button.textContent, 'BACK TO EVENTS');
  assert.ok(button.classList.contains('career-return-mode'));
  assert.ok(!button.classList.contains('next-table-mode'));
  const handler=button.onclick;
  handler(); handler();
  assert.strictEqual(returns, 1);
  assert.strictEqual(button.disabled, true);
  assert.strictEqual(button.onclick, null);
});
check('Arcade result console retains its existing NEXT TABLE flow', ()=>{
  resultConsoles.enterResultsConsole(()=>{});
  const button=consoleEls['btn-award-pot-console'];
  assert.strictEqual(button.textContent, 'NEXT TABLE');
  assert.ok(button.classList.contains('next-table-mode'));
  assert.ok(!button.classList.contains('career-return-mode'));
});

check('Completed-event shutdown natively disables ordinary table controls', ()=>{
  const block = presentationSource.match(/function setCompletedEventActions\(disabled\)\{[\s\S]*?\n\}/);
  assert.ok(block);
  ['btn-fold','btn-checkcall','btn-raise','raise-cancel','raise-slider','save-progress','btn-quick-resolve']
    .forEach(id=>assert.ok(block[0].includes(id), id));
  assert.ok(presentationSource.includes("row.classList.add('disabled')"));
  assert.ok(presentationSource.includes("frame.classList.add('event-complete')"));
});
check('Only a non-winning cash skips the stage roll', ()=>{
  const resultBlock = engineSource.match(/async function showCareerEventResult\(g, model\)\{[\s\S]*?\n\}/);
  assert.ok(resultBlock);
  const body = resultBlock[0];
  // A win and a bust are the two outcomes of the event and both turn the
  // stage. Only a paid non-winning place keeps the restrained plain card, so
  // the early return is now guarded on model.cashed rather than on !model.won.
  const branch = body.indexOf('if (model.cashed){');
  const earlyReturn = body.indexOf('return;', branch);
  const roll = body.indexOf('rollStageTransition');
  assert.ok(branch > 0 && earlyReturn > branch && roll > earlyReturn);
  assert.ok(!body.includes('if (!model.won){'));
  assert.ok(body.includes("'result-card career-cash career-event-result'"));
  assert.ok(body.includes('Event cashed.'));
  // The bust must reach the roll rather than the card, and must not muck:
  // its K.O. ceremony has already played.
  assert.ok(body.includes('if (model.won) await muckCards();'));
  assert.ok(body.includes('You were eliminated.'));
});

check('The cash treatment is defined and distinct in the Career result CSS', ()=>{
  const css = fs.readFileSync(path.join(root, 'css/02-screens.css'), 'utf8');
  assert.ok(css.includes('.career-result-panel.is-cash{'));
  assert.ok(css.includes('.career-result-panel.is-cash .career-res-title{'));
  assert.ok(css.includes('.career-last-result.is-cash .cr-tag{'));
});

check('Career result path never calls Arcade result-console progression', ()=>{
  const resultBlock = engineSource.match(/async function showCareerEventResult\(g, model\)\{[\s\S]*?\n\}/);
  assert.ok(resultBlock);
  assert.ok(resultBlock[0].includes('enterCareerResultsConsole(returnToCareer)'));
  assert.ok(!resultBlock[0].includes('enterResultsConsole('));
  assert.ok(engineSource.includes('enterResultsConsole(beginNextRunTable)'));
});
check('Career result classes are isolated from the compact Career summary', ()=>{
  const css = fs.readFileSync(path.join(root, 'css/02-screens.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('class="career-last-result hidden" id="career-last-result"'));
  assert.ok(css.includes('.career-last-result{'));
  assert.ok(css.includes('.stage-results.career-event-result{'));
  assert.ok(!css.includes('\n.career-result{'));
});

process.stdout.write('\n' + passed + ' focused Career result checks passed.\n');
