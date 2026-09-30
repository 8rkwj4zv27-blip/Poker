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
vm.runInContext(logic+'\nglobalThis.api={definitions:QUICK_BET_PRESET_DEFINITIONS,bounds:wagerBounds,presets:quickBetPresets,snap:snapWager,step:wagerStep};',context);
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

check('Odd pot sizes round up to the table\'s step',()=>{
  assert.deepStrictEqual(amounts(game('flop',0,1,1,101),player()),[35,55,80,105]);
  assert.deepStrictEqual(amounts(game('flop',0,20,20,141),player()),[50,75,110,145]);
});

check('The step grows with the blinds: 5s, then 25s, then 50s',()=>{
  const step=bb=>api.step({bigBlind:bb});
  assert.deepStrictEqual([20,30,50,100].map(step),[5,5,5,5]);
  assert.deepStrictEqual([150,200,300,500].map(step),[25,25,25,25]);
  assert.deepStrictEqual([800,1200].map(step),[50,50]);
  assert.deepStrictEqual(amounts(game('flop',0,200,200,1130),player(20000)),[400,575,850,1150]);
});

check('Slider values snap to the step but keep the exact minimum and maximum',()=>{
  const b={min:137,max:1983,step:5};
  assert.strictEqual(api.snap(137,b),137);
  assert.strictEqual(api.snap(138,b),140);
  assert.strictEqual(api.snap(212,b),210);
  assert.strictEqual(api.snap(1982,b),1980);
  assert.strictEqual(api.snap(1983,b),1983);
  assert.strictEqual(api.snap(1983,b),1983);
  assert.strictEqual(api.snap(5000,b),1983);
  assert.strictEqual(api.snap(0,b),137);
  assert.strictEqual(api.snap(NaN,b),137);
});

const seat=(chips,bet,extra={})=>Object.assign({chips,betThisRound:bet,inHand:true,folded:false,allIn:chips===0},extra);
const table=(phase,currentBet,minRaise,bigBlind,pot,you,others)=>
  Object.assign(game(phase,currentBet,minRaise,bigBlind,pot),{players:[you].concat(others)});

check('Wagers stop at the most anyone can call, and All-in becomes MATCH',()=>{
  const you=player(2000);
  const g=table('flop',0,20,20,200,you,[seat(300,0),seat(0,0,{folded:true,chips:5000})]);
  const b=plain(api.bounds(g,you));
  assert.strictEqual(b.max,300);
  assert.strictEqual(b.matched,true);
  const pre=table('preflop',20,20,20,30,you,[seat(300,0),seat(980,20)]);
  assert.deepStrictEqual(labels(pre,you),['2 BB','2.5 BB','3 BB','Match']);
  assert.deepStrictEqual(amounts(pre,you),[40,50,60,1000]);
  const turn=table('turn',100,100,20,300,you,[seat(237,100)]);
  assert.deepStrictEqual(plain(api.presets(turn,you)).slice(-1)[0],{id:'match',label:'Match',amount:337,context:'postflopFacing'});
});

check('A bigger stack across the table keeps All-in as All-in',()=>{
  const you=player(1000);
  const g=table('preflop',20,20,20,30,you,[seat(300,0),seat(4000,20)]);
  assert.strictEqual(plain(api.bounds(g,you)).matched,false);
  assert.deepStrictEqual(labels(g,you).slice(-1),['All-in']);
});

check('A cap under a full raise still allows the minimum raise, as MATCH',()=>{
  const you=player(2000);
  const g=table('flop',100,100,20,300,you,[seat(50,100)]);
  const b=plain(api.bounds(g,you));
  assert.strictEqual(b.min,200); assert.strictEqual(b.max,200);
  assert.deepStrictEqual(labels(g,you),['Match']);
});

check('Nobody left who can call a raise: no raise offered',()=>{
  const you=player(2000);
  const g=table('turn',300,300,20,700,you,[seat(0,300),seat(0,0,{folded:true,chips:900})]);
  const b=plain(api.bounds(g,you));
  assert.strictEqual(b.max,300);
  assert.deepStrictEqual(amounts(g,you),[]);
});

check('Minimum legal bets and raises clamp every calculated amount',()=>{
  assert.deepStrictEqual(amounts(game('flop',0,20,20,15),player()),[20]);
  assert.deepStrictEqual(amounts(game('turn',70,90,20,80),player()),[160,220,1000]);
  assert.deepStrictEqual(labels(game('turn',70,90,20,80),player()),['Min','Pot','All-in']);
});

check('A short-stack legal under-raise collapses to one all-in choice',()=>{
  const g=game('preflop',100,100,20,170), p=player(150);
  assert.deepStrictEqual(plain(api.bounds(g,p)),{min:150,max:150,currentBet:100,playerBet:0,stack:150,matched:false,step:5});
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
