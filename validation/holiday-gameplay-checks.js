#!/usr/bin/env node
"use strict";

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modes = fs.readFileSync(path.join(root,'js/04-modes-and-scoring.js'),'utf8');
const engine = fs.readFileSync(path.join(root,'js/05-game-engine.js'),'utf8');
const wiring = fs.readFileSync(path.join(root,'js/07-ui-wiring.js'),'utf8');
const dev = fs.readFileSync(path.join(root,'js/08-dev-mode.js'),'utf8');
const opponents = fs.readFileSync(path.join(root,'js/03-opponents.js'),'utf8');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');

function slice(source,start,end){
  const a=source.indexOf(start), b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,start);
  return source.slice(a,b);
}
let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

const formatCode=slice(modes,'const TOURNAMENT_FORMATS','/* ============================================================\n   CAREER EVENTS');
const formatContext={}; vm.createContext(formatContext);
vm.runInContext(formatCode+'\nglobalThis.api={formats:TOURNAMENT_FORMATS,byId:tournamentFormatById};',formatContext);
const formats=JSON.parse(JSON.stringify(formatContext.api.formats));

check('Turbo is a four-handed 600-stack freezeout with a six-hand cadence',()=>{
  assert.deepStrictEqual(formats.turbo,{id:'turbo',name:'Turbo Freezeout',opponentCount:3,playerCount:4,
    stack:600,initialBlindLevel:0,handsPerBlindLevel:6});
});
check('Deep Stack is four-handed with 1,500 chips and a twelve-hand cadence',()=>{
  assert.deepStrictEqual(formats.deep,{id:'deep',name:'Deep Stack Freezeout',opponentCount:3,playerCount:4,
    stack:1500,initialBlindLevel:0,handsPerBlindLevel:12});
});
check('Heads-Up is one opponent with a mobile-length eight-hand cadence',()=>{
  assert.deepStrictEqual(formats.headsup,{id:'headsup',name:'Heads-Up Freezeout',opponentCount:1,playerCount:2,
    stack:600,initialBlindLevel:0,handsPerBlindLevel:8});
});
check('Unknown tournament presets are rejected rather than guessed',()=>{
  assert.strictEqual(formatContext.api.byId('mystery'),null);
});

const nextActive=slice(engine,'function nextActiveIndex','function findNextActor');
const orderCode=slice(engine,"const POSITION_LADDER",'function isBettingRoundComplete');
const orderContext={game:null,$:()=>null,bankPile:()=>null,visualChipCount:()=>0,takeChipFromPile:()=>false};
vm.createContext(orderContext);
vm.runInContext(nextActive+'\n'+orderCode+`\n globalThis.api={
  set:g=>game=g, blinds:assignBlinds, round:beginBettingRound, positions:computePositions
};`,orderContext);

function headsUp(dealer){
  const players=[0,1].map(i=>({id:i?'villain':'you',inHand:true,folded:false,allIn:false,
    acted:false,mayRaise:true,betThisRound:0,streetAction:null}));
  return {players,dealerIndex:dealer,sbIndex:-1,bbIndex:-1,bigBlind:20,currentBet:20,minRaise:20};
}
check('Heads-up dealer posts the small blind and the other seat posts the big blind',()=>{
  const g=headsUp(0); orderContext.api.set(g); orderContext.api.blinds();
  assert.strictEqual(g.sbIndex,0); assert.strictEqual(g.bbIndex,1);
});
check('Heads-up dealer acts first preflop',()=>{
  const g=headsUp(0); orderContext.api.set(g); orderContext.api.blinds(); orderContext.api.round('preflop');
  assert.strictEqual(g.turnPointer,0);
});
check('Heads-up big blind acts first after the flop',()=>{
  const g=headsUp(0); orderContext.api.set(g); orderContext.api.blinds(); orderContext.api.round('flop');
  assert.strictEqual(g.turnPointer,1);
});
check('Heads-up button and blinds rotate together',()=>{
  const g=headsUp(1); orderContext.api.set(g); orderContext.api.blinds();
  assert.strictEqual(g.sbIndex,1); assert.strictEqual(g.bbIndex,0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(orderContext.api.positions())),{villain:'BTN',you:'BB'});
});

check('Custom Game exposes all three descriptor presets',()=>{
  ['turbo','deep','headsup'].forEach(id=>assert.ok(html.includes('data-preset="'+id+'"'),id));
  assert.ok(wiring.includes('tournamentFormatById(settings.tournamentPreset)'));
  assert.ok(dev.includes("settings.tournamentPreset = preset.id"));
});
check('The shared table save carries format id and blind cadence',()=>{
  assert.ok(engine.includes('formatId:g.formatId || null'));
  assert.ok(engine.includes('handsPerBlindLevel:g.handsPerBlindLevel'));
  assert.ok(engine.includes("? g.event.handsPerBlindLevel : g.handsPerBlindLevel"));
});

const aiAdjustCode=slice(opponents,'function aiFormatAdjustments','async function aiDecide');
const aiContext={ELIMINATION_CONFIG:{shortStackBB:8,foldGateWidenPerBB:.018}};
vm.createContext(aiContext);
vm.runInContext(aiAdjustCode+'\nglobalThis.adjust=aiFormatAdjustments;',aiContext);
check('Heads-up widens opening and aggression ranges using public table state only',()=>{
  const g={mode:'career',event:{payouts:[200]},players:[{chips:300},{chips:300}]};
  const a=JSON.parse(JSON.stringify(aiContext.adjust(g,g.players[1],1,12)));
  assert.strictEqual(a.headsUp,true); assert.strictEqual(a.aggression,.08);
  assert.strictEqual(a.tightness,-.08); assert.strictEqual(a.bluffFreq,.04);
  assert.strictEqual(a.callOffFloor,.48);
});
check('All freezeout short stacks widen gradually, while cash does not',()=>{
  const player={chips:120,eliminated:false};
  const freeze=aiContext.adjust({mode:'career',event:{payouts:[300]},players:[player,{chips:500}]},player,1,4);
  const cash=aiContext.adjust({mode:'cash',players:[player,{chips:500}]},player,1,4);
  assert.ok(freeze.foldGateWiden>0); assert.strictEqual(cash.foldGateWiden,0);
});
check('Top-2 bubble pressure is based only on public survivors and payout places',()=>{
  const players=[{chips:100},{chips:200},{chips:300},{chips:0,eliminated:true}];
  const a=aiContext.adjust({mode:'career',event:{payouts:[1050,450]},players},players[0],2,6);
  assert.strictEqual(a.bubble,true); assert.strictEqual(a.tightness,.04); assert.strictEqual(a.aggression,.06);
  assert.deepStrictEqual(['g','player','numOpp','bbLeft'],aiAdjustCode.match(/function aiFormatAdjustments\(([^)]+)\)/)[1].split(/,\s*/));
});
const difficultyCode=slice(opponents,'const DIFFICULTY_PARAMS','/* ============================================================\n   TABLE TALK');
const difficultyContext={}; vm.createContext(difficultyContext);
vm.runInContext(difficultyCode+'\nglobalThis.params=DIFFICULTY_PARAMS;',difficultyContext);
const difficulty=JSON.parse(JSON.stringify(difficultyContext.params));
check('Expert and Elite extend the honest AI ladder with less noise and stronger position play',()=>{
  assert.deepStrictEqual(difficulty.expert,{iterations:700,noise:.025,positionWeight:.11});
  assert.deepStrictEqual(difficulty.elite,{iterations:900,noise:.01,positionWeight:.14});
  assert.ok(difficulty.expert.iterations>difficulty.hard.iterations);
  assert.ok(difficulty.elite.iterations>difficulty.expert.iterations);
  assert.ok(difficulty.elite.noise<difficulty.expert.noise);
});
check('Upper AI equity reads only its own cards, the board and public opponent count',()=>{
  const decision=opponents.slice(opponents.indexOf('async function aiDecide'));
  assert.ok(decision.includes('EquityService.get(player.hand, g.board, Math.max(1,numOpp), dp.iterations)'));
  assert.ok(!decision.includes('g.players.map(p=>p.hand)'));
  assert.ok(!decision.includes('g.deck'));
});
check('Routine waits are shorter and consequential decisions retain the long tier',()=>{
  assert.ok(opponents.includes('big ? 1350 + Math.random()*1050 : 550 + Math.random()*500'));
  assert.ok(engine.includes('await pacedSleep(380)'));
  assert.ok(engine.includes('await pacedSleep(420)'));
  assert.ok(engine.includes('Math.round(1800 * speedMult())'));
  assert.ok(engine.includes('game._humanDecisionStartedAt=Date.now()'));
});
check('Quick Resolve is available after either a fold or an all-in',()=>{
  assert.ok(engine.includes("(!human.folded && !human.allIn)"));
});
check('Automatic cash-table close banks the final completed-hand stack before settlement',()=>{
  assert.ok(wiring.includes("if (reason==='table-close' && !checkpointCareerCash(serializeTable(g))) return false;"));
});

const metricsCode=slice(engine,"const GAMEPLAY_METRICS_KEY",'function sleep(ms)');
const metricMemory=new Map();
const metricContext={
  CAREER_CASH_CONFIG:{id:'back-room-cash'},
  Store:{get:(k,f)=>metricMemory.has(k)?JSON.parse(JSON.stringify(metricMemory.get(k))):f,
    set:(k,v)=>metricMemory.set(k,JSON.parse(JSON.stringify(v)))},
  Date
};
vm.createContext(metricContext);
vm.runInContext(metricsCode+`\nglobalThis.metrics={hand:recordGameplayHandMetric,
 conclusion:recordGameplayConclusion,summary:gameplayMetricSummary};`,metricContext);
check('Pacing metrics record median duration, non-decision time and flop rate',()=>{
  const now=Date.now();
  const g={mode:'tournament',formatId:'turbo',board:[1,2,3],_handStartedAt:now-1000,_humanDecisionMs:300,handNumber:1,metricsStartedAt:now-5000};
  metricContext.metrics.hand(g);
  g.board=[]; g._handStartedAt=Date.now()-2000; g._humanDecisionMs=0; g.handNumber=2;
  metricContext.metrics.hand(g);
  const s=JSON.parse(JSON.stringify(metricContext.metrics.summary('turbo')));
  assert.strictEqual(s.hands,2);
  assert.ok(s.medianHandMs>=1490&&s.medianHandMs<=1520,String(s.medianHandMs));
  assert.ok(s.nonDecisionPct>=89&&s.nonDecisionPct<=91,String(s.nonDecisionPct));
  assert.strictEqual(s.flopSeenPct,50);
});
check('Hands-to-conclusion is recorded once per session',()=>{
  const g={mode:'tournament',formatId:'headsup',handNumber:17,metricsStartedAt:Date.now()-10000};
  assert.strictEqual(metricContext.metrics.conclusion(g,'win'),true);
  assert.strictEqual(metricContext.metrics.conclusion(g,'win'),false);
  assert.strictEqual(metricMemory.get('felt.gameplay.metrics.v1').formats.headsup.sessions[0].hands,17);
});

process.stdout.write('\n'+passed+' Holiday gameplay format checks passed.\n');
