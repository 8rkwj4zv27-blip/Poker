#!/usr/bin/env node
"use strict";

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const engine=fs.readFileSync(path.join(root,'js/05-game-engine.js'),'utf8');
const presentation=fs.readFileSync(path.join(root,'js/06-presentation.js'),'utf8');
const wiring=fs.readFileSync(path.join(root,'js/08-dev-mode.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/03-action-console.css'),'utf8');

function slice(source,start,end){
  const a=source.indexOf(start), b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,start);
  return source.slice(a,b);
}
let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

const logic=slice(engine,'const QUICK_BET_PRESET_DEFINITIONS','function actionLabel');
const context={};
vm.createContext(context);
vm.runInContext(logic+'\nglobalThis.api={definitions:QUICK_BET_PRESET_DEFINITIONS,bounds:wagerBounds,presets:quickBetPresets};',context);
const api=context.api;
const plain=value=>JSON.parse(JSON.stringify(value));
const player=(chips=1000,bet=0,extra={})=>Object.assign({chips,betThisRound:bet,mayRaise:true,allIn:false},extra);
const game=(phase,currentBet,minRaise,bigBlind,pot)=>({phase,currentBet,minRaise,bigBlind,pot});
const amounts=(g,p)=>plain(api.presets(g,p)).map(item=>item.amount);
const labels=(g,p)=>plain(api.presets(g,p)).map(item=>item.label);

check('Preset definitions are centralized for all four betting contexts',()=>{
  assert.deepStrictEqual(Object.keys(plain(api.definitions)),
    ['preflopOpen','preflopFacing','postflopOpen','postflopFacing']);
  Object.values(plain(api.definitions)).forEach(defs=>assert.strictEqual(defs.length,4));
});

check('Opening pre-flop presets track the current blind level',()=>{
  assert.deepStrictEqual(amounts(game('preflop',20,20,20,30),player()),[40,50,60,1000]);
  assert.deepStrictEqual(amounts(game('preflop',100,100,100,150),player(3000)),[200,250,300,3000]);
  assert.deepStrictEqual(labels(game('preflop',20,20,20,30),player()),['2 BB','2.5 BB','3 BB','All-in']);
});

check('Facing a pre-flop raise uses minimum and raise-to multiples',()=>{
  const g=game('preflop',60,40,20,110), p=player(980,20);
  assert.deepStrictEqual(amounts(g,p),[100,150,180,1000]);
  assert.deepStrictEqual(labels(g,p),['Min','2.5×','3×','All-in']);
});

check('Opening post-flop sizes use the wager-relevant pot',()=>{
  const g=game('flop',0,20,20,120), p=player();
  assert.deepStrictEqual(amounts(g,p),[40,60,90,120]);
  assert.deepStrictEqual(labels(g,p),['⅓ Pot','½ Pot','¾ Pot','Pot']);
});

check('Facing a post-flop bet uses conventional pot-after-call sizing',()=>{
  const g=game('turn',60,60,20,180), p=player();
  assert.deepStrictEqual(amounts(g,p),[120,180,300,1000]);
  assert.deepStrictEqual(labels(g,p),['Min','½ Pot','Pot','All-in']);
});

check('Pot-after-call sizing includes an existing player street wager',()=>{
  const g=game('river',60,40,20,180), p=player(980,20);
  assert.deepStrictEqual(amounts(g,p),[100,170,280,1000]);
});

check('Odd pot sizes use whole-chip rounding',()=>{
  assert.deepStrictEqual(amounts(game('flop',0,1,1,101),player()),[34,51,76,101]);
});

check('Minimum legal bets and raises clamp every calculated amount',()=>{
  assert.deepStrictEqual(amounts(game('flop',0,20,20,15),player()),[20]);
  assert.deepStrictEqual(amounts(game('turn',70,90,20,80),player()),[160,220,1000]);
  assert.deepStrictEqual(labels(game('turn',70,90,20,80),player()),['Min','Pot','All-in']);
});

check('A short-stack legal under-raise collapses to one all-in choice',()=>{
  const g=game('preflop',100,100,20,170), p=player(150);
  assert.deepStrictEqual(plain(api.bounds(g,p)),{min:150,max:150,currentBet:100,playerBet:0,stack:150});
  assert.deepStrictEqual(amounts(g,p),[150]);
  assert.deepStrictEqual(labels(g,p),['All-in']);
  assert.deepStrictEqual(labels(game('flop',0,20,20,80),player(15)),['All-in']);
});

check('Stacks unable to exceed the current wager get no raise presets',()=>{
  assert.deepStrictEqual(amounts(game('preflop',100,40,20,170),player(100)),[]);
  assert.deepStrictEqual(amounts(game('preflop',100,40,20,170),player(80)),[]);
});

check('Duplicate clamped values are removed while useful labels win',()=>{
  const presets=plain(api.presets(game('preflop',20,20,20,30),player(45)));
  assert.deepStrictEqual(presets.map(p=>[p.label,p.amount]),[['2 BB',40],['All-in',45]]);
  assert.strictEqual(new Set(presets.map(p=>p.amount)).size,presets.length);
});

check('Presets recalculate when pot, street, stack or action state changes',()=>{
  const p=player(1000);
  const open=amounts(game('flop',0,20,20,120),p);
  const larger=amounts(game('flop',0,20,20,240),p);
  const facing=amounts(game('flop',60,60,20,180),p);
  const short=amounts(game('flop',60,60,20,180),player(150));
  assert.notDeepStrictEqual(open,larger);
  assert.notDeepStrictEqual(larger,facing);
  assert.notDeepStrictEqual(facing,short);
  assert.deepStrictEqual(amounts(game('flop',60,60,20,180),player(1000,0,{mayRaise:false})),[]);
});

check('Preset and slider paths share the amount setter without submitting',()=>{
  const setter=slice(presentation,'function setWagerAmount','function syncQuickBetSelection');
  const renderer=slice(presentation,'function renderQuickBetPresets','/* Drives the console');
  assert.ok(renderer.includes("button.onclick=()=>setWagerAmount(preset.amount,{immediate:true})"));
  assert.ok(wiring.includes("setWagerAmount(e.target.value,{immediate:false})"));
  assert.ok(!setter.includes('humanAct('));
  assert.ok(!renderer.includes('humanAct('));
});

check('The compact row is accessible, four-up and reduced-motion safe',()=>{
  assert.ok(html.includes('id="quick-bets" role="group" aria-label="Quick bet amounts"'));
  assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
  assert.ok(css.includes('[data-motion="off"] .quick-bet{ transition:none; }'));
  assert.ok(presentation.includes("button.setAttribute('aria-pressed','false')"));
});

process.stdout.write('\n'+passed+' contextual quick-bet checks passed.\n');
