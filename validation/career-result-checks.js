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
  ';globalThis.__careerChecks={careerResultHTML,buildCareerResultModel,showdownPotVerb};', engineContext);
const { careerResultHTML, buildCareerResultModel, showdownPotVerb } = engineContext.__careerChecks;

const winGame = {
  event:{ name:'BACK ROOM FREEZEOUT', buyIn:100, prize:300, reward:{score:5575} },
  handNumber:7
};
const winModel = buildCareerResultModel(winGame, 'win');
const winHTML = careerResultHTML(winModel);
const lossModel = {
  outcome:'loss', won:false, eventName:'BACK ROOM FREEZEOUT', prize:300,
  buyIn:100, bankroll:400, eventScore:1275, hands:4
};
const lossHTML = careerResultHTML(lossModel);
const pubModel = buildCareerResultModel({
  event:{ name:'PUB CIRCUIT FREEZEOUT', buyIn:300, prize:1200, reward:{score:8640} },
  handNumber:12
}, 'win');
const pubHTML = careerResultHTML(pubModel);

check('Career result model captures the settled display values once', ()=>{
  assert.deepStrictEqual(JSON.parse(JSON.stringify(winModel)), {
    outcome:'win', won:true, eventName:'BACK ROOM FREEZEOUT', prize:300,
    buyIn:100, bankroll:600, eventScore:5575, hands:7
  });
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
