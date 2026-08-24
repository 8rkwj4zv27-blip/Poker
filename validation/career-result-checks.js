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

/* Stubs for the few cross-file helpers the shared result-stage models
   reach for. Declared on the context BEFORE the engine source runs, so
   anything the engine defines itself still wins. */
const engineContext = {
  console,
  esc,
  careerBankroll:()=>600,
  arcadeProfile:{ highScore:4200 },
  makeArcadeRunState:()=>({ score:0, biggestReward:0, awardCounts:{}, newHighScore:false }),
  isOpponentChoice:v=>v===4||v===5||v===6,
  ELIMINATION_CONFIG:{ opponents:4, startingStack:1000, smallBlind:10, bigBlind:20 },
  formatArcadeScore:n=>Math.max(0,Math.round(n||0)).toString().padStart(7,'0'),
  splitHandText:(cat,name)=>({ category:'FULL HOUSE', descriptor:'Sixes over Eights' }),
  arrangeHandForDisplay:(cat,cards)=>cards,
  cardClass:()=>'card small spade',
  cardInner:()=>'<div class="ci"></div>',
  cardLabel:()=>'Six of Spades'
};
vm.createContext(engineContext);
vm.runInContext(engineSource +
  ';globalThis.__careerChecks={careerResultHTML,buildCareerResultModel,showdownPotVerb,careerFinishPlace,' +
  'careerStageModel,tableClearedModel,runOverModel,resultStageHTML};', engineContext);
const { careerResultHTML, buildCareerResultModel, showdownPotVerb, careerFinishPlace,
        careerStageModel, tableClearedModel, runOverModel, resultStageHTML } = engineContext.__careerChecks;

const winGame = {
  event:{ name:'BACK ROOM FREEZEOUT', playerCount:3, buyIn:100, prize:300, payouts:[300], reward:{score:5575} },
  handNumber:7
};
const winModel = buildCareerResultModel(winGame,
  { outcome:'win', place:1, prize:300, delta:300, bankroll:600 });
const winHTML = careerResultHTML(winModel);
const lossModel = {
  outcome:'loss', won:false, cashed:false, place:3, eventName:'BACK ROOM FREEZEOUT', prize:0,
  buyIn:100, bankroll:400, eventScore:1275, hands:4, field:3
};
const lossHTML = careerResultHTML(lossModel);
const pubModel = buildCareerResultModel({
  event:{ name:'PUB CIRCUIT FREEZEOUT', playerCount:4, buyIn:300, prize:1200, payouts:[1200], reward:{score:8640} },
  handNumber:12
}, { outcome:'win', place:1, prize:1200, delta:1200, bankroll:600 });
const pubHTML = careerResultHTML(pubModel);
const cashModel = buildCareerResultModel({
  event:{ name:'PUB CIRCUIT OPEN', playerCount:5, buyIn:300, prize:1050, payouts:[1050,450], reward:{score:4120} },
  handNumber:23
}, { outcome:'cash', place:2, prize:450, delta:450, bankroll:1150 });
const cashHTML = careerResultHTML(cashModel);
const forfeitModel = buildCareerResultModel({
  event:{ name:'PUB CIRCUIT OPEN', playerCount:5, buyIn:300, prize:1050, payouts:[1050,450], reward:{score:80} },
  handNumber:2
}, { outcome:'forfeit', place:null, prize:0, delta:-300, bankroll:200 });
const forfeitHTML = careerResultHTML(forfeitModel);

check('Career result model captures the settled display values once', ()=>{
  assert.deepStrictEqual(JSON.parse(JSON.stringify(winModel)), {
    outcome:'win', won:true, cashed:false, place:1, eventName:'BACK ROOM FREEZEOUT', prize:300,
    buyIn:100, bankroll:600, eventScore:5575, hands:7, field:3
  });
});

check('A non-winning cash models the credited prize, not the headline first prize', ()=>{
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cashModel)), {
    outcome:'cash', won:false, cashed:true, place:2, eventName:'PUB CIRCUIT OPEN', prize:450,
    buyIn:300, bankroll:600, eventScore:4120, hands:23, field:5
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
/* careerResultHTML() is now the EVENT CASHED renderer. A win and a bust
   are outcomes of the event and go to the shared result stage instead;
   the approved presentation gives THEM a mechanical hero reel, while a
   paid non-winning place keeps its restrained atomic card unchanged.
   Both halves of that decision are asserted: here for the cash card, and
   in the shared-stage section below for the four stage results. */
check('EVENT CASHED uses no fragmented mechanical amount markup', ()=>{
  assert.ok(!/(jp-cell|reel-strip|amt-readout|stage-results-stack|stage-results-score)/.test(cashHTML));
});
check('EVENT CASHED markup contains no NEXT TABLE copy', ()=>{
  assert.ok(!/NEXT TABLE/.test(cashHTML));
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
check('Only a non-winning cash skips the shared result stage', ()=>{
  const resultBlock = engineSource.match(/async function showCareerEventResult\(g, model\)\{[\s\S]*?\n\}\n/);
  assert.ok(resultBlock);
  const body = resultBlock[0];
  // A win and a bust are the two outcomes of the event and both turn the
  // stage. Only a paid non-winning place keeps the restrained plain card, so
  // the early return is guarded on model.cashed rather than on !model.won.
  const branch = body.indexOf('if (model.cashed){');
  const earlyReturn = body.indexOf('return;', branch);
  const present = body.indexOf('presentResultStage');
  assert.ok(branch > 0 && earlyReturn > branch && present > earlyReturn);
  assert.ok(!body.includes('if (!model.won){'));
  assert.ok(body.includes("'result-card career-cash career-event-result'"));
  assert.ok(body.includes('Event cashed.'));
  // The cash card must not turn the stage at all.
  assert.ok(!body.slice(branch, earlyReturn).includes('presentResultStage'));
  // A bust must reach the stage and must not muck: its K.O. ceremony has
  // already played. A win mucks first.
  assert.ok(body.includes('muck: model.won'));
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
  // The cash card still owns its own placement; the stage-mounted panel
  // selector went with the panel, since a win and a bust are now the stage
  // rather than something sitting on it.
  assert.ok(css.includes('.result-card.career-event-result{'));
  assert.ok(!css.includes('.stage-results.career-event-result{'));
  assert.ok(!css.includes('\n.career-result{'));
});

/* ============================================================
   THE SHARED RESULT STAGE

   TABLE CLEARED, RUN OVER, EVENT WON and EVENT LOST are one chassis in
   four semantic states. These checks exist to catch the two ways that
   can silently stop being true: an outcome growing a presentation of its
   own, and the canonical TABLE CLEARED baseline drifting.
   ============================================================ */

const clearedRun = {
  active:true, opponentCount:5, tableNumber:1, tablesCleared:1, highestTableReached:1,
  tableKOs:5, tableHands:4, tableHandsWon:3,
  tableShowdownsPlayed:2, tableShowdownsWon:2,
  tableAllInsPlayed:1, tableAllInsWon:1,
  tableBiggestPotWon:530, tableHighestStack:1200, tableBestHand:null,
  tableScoreStart:740,
  totalHands:4, totalHandsWon:3, totalKOs:5, biggestPotWon:530, bestHand:null, bustedBy:null,
  arcade:{ score:780, biggestReward:400, awardCounts:{goodFold:1, ko:1}, newHighScore:false }
};
const clearedGame = { run:clearedRun, players:[{isHuman:true, chips:530}] };
const clearedModel = tableClearedModel(clearedGame);
const clearedStage = resultStageHTML(clearedModel);

const bustRun = Object.assign({}, clearedRun, {
  tablesCleared:0,
  bustedBy:{ names:['Maniac'], hand:'Four of a Kind, Sixes' },
  arcade:{ score:780, biggestReward:400, awardCounts:{goodFold:1, ko:1}, newHighScore:true }
});
const bustGame = { run:bustRun, players:[{isHuman:true, chips:0}] };
const bustModel = runOverModel(bustGame);
const bustStage = resultStageHTML(bustModel);

const wonStage = resultStageHTML(careerStageModel(winModel));
const lostStage = resultStageHTML(careerStageModel(lossModel));
const allStages = [clearedStage, bustStage, wonStage, lostStage];

check('All four outcomes render the same five-region chassis', ()=>{
  allStages.forEach(html=>{
    ['stage-results-machine','stage-results-head','stage-score-hero',
     'stage-results-deck','stage-results-instruments','stage-results-recap',
     'stage-run-progress'].forEach(part=>assert.ok(html.includes(part), part));
    // Exactly two framed instruments and exactly three memory-bank slots.
    assert.strictEqual((html.match(/class="stage-instrument /g)||[]).length, 2);
    assert.strictEqual((html.match(/data-stage-stat=/g)||[]).length, 3);
    // The detail well is always present, as a trophy or as a statement.
    assert.ok(html.includes('data-result-beat="trophy"'));
    // Nothing may nest a second stage or result card inside itself.
    assert.ok(!html.includes('class="stage-results"'));
    assert.ok(!html.includes('result-card'));
  });
});

check('Every outcome has exactly one mechanical hero reel', ()=>{
  allStages.forEach(html=>{
    assert.strictEqual((html.match(/id="stage-results-score"/g)||[]).length, 1);
    assert.ok(html.includes('amt-readout stage-score-readout'));
    // The reel is built after insertion, never string-rendered, so the
    // container must ship empty.
    assert.ok(/id="stage-results-score"><\/div>/.test(html));
  });
  // A counted instrument reel is Arcade-only: Career has nothing there
  // that is being counted rather than reported.
  [clearedStage, bustStage].forEach(html=>
    assert.ok(html.includes('id="stage-results-stack"')));
  [wonStage, lostStage].forEach(html=>
    assert.ok(!html.includes('id="stage-results-stack"')));
});

check('Tone is carried by the model, not by four separate treatments', ()=>{
  assert.strictEqual(clearedModel.tone, 'positive');
  assert.strictEqual(careerStageModel(winModel).tone, 'positive');
  assert.strictEqual(bustModel.tone, 'negative');
  assert.strictEqual(careerStageModel(lossModel).tone, 'negative');
  // The tone reaches the DOM through one class on the felt, applied in
  // the one shared presentation path — never baked into the markup.
  allStages.forEach(html=>assert.ok(!/tone-(positive|negative)/.test(html)));
  assert.ok(engineSource.includes("felt.classList.toggle('tone-negative', model.tone === 'negative')"));
});

check('TABLE CLEARED baseline is unchanged', ()=>{
  assert.ok(clearedStage.includes('<span>TABLE 1</span><strong>CLEARED</strong>'));
  assert.ok(clearedStage.includes('Table score'));
  assert.ok(clearedStage.includes('<span>RUN TOTAL</span><strong class="tabular">0000780</strong>'));
  assert.ok(clearedStage.includes('Finish stack'));
  assert.ok(clearedStage.includes('K.O.s') && clearedStage.includes('5 / 5'));
  assert.strictEqual((clearedStage.match(/stage-ko-slot/g)||[]).length, 5);
  ['Hands won','Showdowns won','Biggest pot'].forEach(label=>
    assert.ok(clearedStage.includes(label), label));
  assert.ok(clearedStage.includes('No showdown hand recorded'));
  assert.ok(clearedStage.includes('<span>TABLES CLEARED</span><strong class="tabular">1</strong><em>NEXT: TABLE 2</em>'));
  // A flawless table still lights its lamp strip.
  assert.ok(clearedStage.includes('FLAWLESS SHOWDOWNS'));
  // The hero reel still shows the TABLE score, not the run total.
  assert.strictEqual(clearedModel.hero.reel.amount, 40);
  assert.strictEqual(clearedModel.hero.reel.prefix, '+');
});

check('RUN OVER reports the run through the shared hierarchy', ()=>{
  assert.ok(bustStage.includes('<span>BUSTED ON TABLE 1</span><strong>RUN OVER</strong>'));
  assert.ok(bustStage.includes('Final score'));
  // The padded seven-digit form, as a reel rather than a string.
  assert.strictEqual(bustModel.hero.reel.text, '0000780');
  assert.ok(bustStage.includes('NEW HIGH SCORE'));
  ['Table reached','K.O.s','Hands won','Scoring events','Biggest pot'].forEach(label=>
    assert.ok(bustStage.includes(label), label));
  // Joined rather than deep-compared: arrays crossing out of the VM
  // realm are not deepStrictEqual to plain host arrays.
  const pageTwo = bustModel.recapPages[1].map(s=>s.label).join(' | ');
  assert.strictEqual(pageTwo, 'Total hands | Biggest reward | Win rate');
  assert.strictEqual(bustModel.recapPages[1][2].value, '75%');
  assert.ok(bustStage.includes('BUSTED BY MANIAC · FOUR OF A KIND, SIXES'));
  assert.ok(bustStage.includes('<em>NO REBUY</em>'));
});

check('RUN OVER without a record reports the standing personal best', ()=>{
  const notARecord = runOverModel({
    run:Object.assign({}, bustRun, {
      arcade:Object.assign({}, bustRun.arcade, { newHighScore:false })
    }),
    players:[{isHuman:true, chips:0}]
  });
  // arcadeProfile.highScore, which finalizeArcadeRun() has already
  // settled by the time this model is built. No new statistic is stored.
  assert.strictEqual(notARecord.hero.carryValue, 'BEST 0004200');
});

check('Career FIELD comes from the event snapshot, never the survivors', ()=>{
  assert.strictEqual(winModel.field, 3);           // Back Room Freezeout
  assert.strictEqual(cashModel.field, 5);          // Pub Circuit Open
  assert.ok(wonStage.includes('Field'));
  assert.ok(/Field<\/span><strong class="stage-recap-value tabular">3<\/strong>/.test(wonStage));
  // A snapshot written before playerCount existed reports no field rather
  // than a fabricated one.
  assert.strictEqual(buildCareerResultModel({ event:{ name:'X' }, handNumber:1 },
    { outcome:'loss', place:null, prize:0, bankroll:0 }).field, null);
  assert.ok(engineSource.includes('field: Number.isInteger(ev.playerCount)'));
});

check('EVENT LOST never states the same buy-in twice', ()=>{
  // The hero owns the financial result; the recap slot the win gives to
  // the stake goes to the payout that did not arrive.
  assert.ok(lostStage.includes('Buy-in lost'));
  assert.strictEqual((lostStage.match(/Buy-in/g)||[]).length, 1);
  assert.ok(/Prize<\/span><strong class="stage-recap-value tabular">\$0<\/strong>/.test(lostStage));
  // The win does show its stake, once, and never a redundant prize cell.
  assert.ok(/Buy-in<\/span><strong class="stage-recap-value tabular">\$100<\/strong>/.test(wonStage));
  assert.ok(!/Prize<\/span><strong class="stage-recap-value/.test(wonStage));
});

check('Career progression strip is a deliberate two-part layout', ()=>{
  [wonStage, lostStage].forEach(html=>{
    assert.ok(html.includes('stage-run-progress pc-display is-two-part'));
    assert.ok(html.includes('<em>NEXT: EVENTS BOARD</em>'));
    // No empty centre value.
    assert.ok(!/<strong class="tabular"><\/strong>/.test(html));
  });
  assert.ok(wonStage.includes('<span>EVENT COMPLETE</span>'));
  assert.ok(lostStage.includes('<span>EVENT ENDED</span>'));
  // Arcade keeps its three-slot strip with a real count.
  [clearedStage, bustStage].forEach(html=>assert.ok(!html.includes('is-two-part')));
});

check('There is exactly one result transition, and all four use it', ()=>{
  // One stage-swap call site for results, inside the one shared path.
  const path_ = engineSource.match(/async function presentResultStage\(g, model, opts\)\{[\s\S]*?\n\}\n/);
  assert.ok(path_, 'presentResultStage exists');
  assert.ok(path_[0].includes('rollStageTransition'));
  assert.ok(path_[0].includes('resultStageHTML(model)'));
  assert.ok(path_[0].includes('fillResultStageReels(model)'));
  // Actions are exposed only after the lock, behind the console beat.
  const lock = path_[0].indexOf('await rollStageTransition');
  const beat = path_[0].indexOf('STAGE_ROLL_CONFIG.consoleFlipBeatMs');
  const act  = path_[0].indexOf('o.console()');
  assert.ok(lock > 0 && beat > lock && act > beat);
  // The three owners hand off to it and own no transition of their own.
  /* Brace-counted so a nested callback's own closing brace cannot end the
     slice early — these functions all contain one. */
  const bodyOf = fn => {
    const at = engineSource.indexOf('async function ' + fn + '(');
    assert.ok(at > 0, fn + ' exists');
    let depth = 0, i = engineSource.indexOf('{', at);
    assert.ok(i > at, fn + ' body');
    for (let j = i; j < engineSource.length; j++){
      if (engineSource[j] === '{') depth++;
      else if (engineSource[j] === '}' && --depth === 0) return engineSource.slice(at, j + 1);
    }
    assert.fail(fn + ' body is unterminated');
  };
  ['showTableCleared','showRunOver','showCareerEventResult'].forEach(fn=>{
    const body = bodyOf(fn);
    assert.ok(body.includes('presentResultStage('), fn + ' uses the shared path');
    assert.ok(!body.includes('rollStageTransition'), fn + ' owns no transition');
  });
  // The engine turns the wheel in exactly two places: presenting a major
  // result (here, for all four) and rolling a settled result away into the
  // next table. Anything else means an outcome grew a transition again.
  assert.strictEqual((engineSource.match(/await rollStageTransition\(/g)||[]).length, 2);
  assert.ok(bodyOf('beginNextRunTable').includes('await rollStageTransition('));
  // And exactly one place renders the shared chassis into the stage.
  assert.strictEqual(
    (engineSource.match(/el\.innerHTML = resultStageHTML\(model\);/g)||[]).length, 1);
  // No outcome may reintroduce a CSS entrance of its own. Comments are
  // stripped first: the section header still explains what was removed.
  const machineCss = fs.readFileSync(path.join(root, 'css/06-machine-system.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!machineCss.includes('runOverReportIn'));
  assert.ok(!machineCss.includes('.run-over-report'));
  // And RUN OVER no longer builds a report over the table, or greys the
  // world behind one.
  assert.ok(!engineSource.includes('run-over-report'));
  assert.ok(!engineSource.includes("classList.add('run-dead')"));
});

check('Each result finalises exactly once', ()=>{
  // Every terminal path carries a presentation guard, so a second entry
  // can neither re-settle nor re-present.
  assert.ok(engineSource.includes('if (g._tableClearedShown) return;'));
  assert.ok(engineSource.includes('if (g._runOverShown) return;'));
  assert.ok(engineSource.includes('if (g._careerResultShown) return;'));
  // RUN OVER's guard sits BEFORE finalizeArcadeRun(), which is the one
  // call on that path that writes anything: a second run would compare
  // the score against the record it had just set and clear newHighScore.
  const block = engineSource.match(/async function showRunOver\(g\)\{[\s\S]*?\n\}\n/);
  assert.ok(block);
  assert.ok(block[0].indexOf('_runOverShown') < block[0].indexOf('finalizeArcadeRun'));
});

check('The DEV transition tester settles nothing and persists nothing', ()=>{
  const dev = fs.readFileSync(path.join(root, 'js/08-dev-mode.js'), 'utf8');
  // The section's CODE only: its own header names the calls it must
  // avoid, so the slice starts after the header and comments are stripped.
  const header = dev.indexOf('DEV: MAJOR-RESULT TRANSITION TESTER');
  assert.ok(header > 0, 'tester section exists');
  const block = dev.slice(dev.indexOf('*/', header) + 2,
                          dev.indexOf('/* DEV-only fast entry into a Single Player run'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(block.includes('presentResultStage('), 'drives the real path');
  ['settleCareerEvent','enterCareerEvent','endCareerEvent','finalizeArcadeRun',
   'saveCareer','saveTable','clearTableSave','saveArcadeProfile','startSinglePlayerRun',
   'startCareerEvent'].forEach(banned=>
    assert.ok(!block.includes(banned), 'tester must not call ' + banned));
  // All four outcomes are reachable from it.
  ['table-cleared','run-over','event-won','event-lost'].forEach(kind=>
    assert.ok(dev.includes('data-result-test="' + kind + '"'), kind));
  assert.ok(dev.includes('if (!DEV_MODE) return;'));
});

process.stdout.write('\n' + passed + ' focused Career result and result-stage checks passed.\n');
