#!/usr/bin/env node
"use strict";

/* Focused regression checks for the data-driven Career foundation. These
   run the real registry and Career transaction functions in isolated VM
   contexts, with only the table-launch and storage edges stubbed. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modesSource = fs.readFileSync(path.join(root, 'js/04-modes-and-scoring.js'), 'utf8');
const engineSource = fs.readFileSync(path.join(root, 'js/05-game-engine.js'), 'utf8');
const wiringSource = fs.readFileSync(path.join(root, 'js/07-ui-wiring.js'), 'utf8');
const devSource = fs.readFileSync(path.join(root, 'js/08-dev-mode.js'), 'utf8');

function sliceBetween(source, start, end){
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'source slice ' + start);
  return source.slice(from, to);
}

const registryCode = sliceBetween(modesSource, 'const CAREER_START_BANKROLL', '/* ============================================================\n   ELIMINATION MODE');
const careerCode = sliceBetween(wiringSource, "const CAREER_KEY = 'felt.career';", 'function startSinglePlayerRun');

function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
function makeContext(initialCareer){
  const storage = new Map();
  if (initialCareer !== undefined) storage.set('felt.career', clone(initialCareer));
  const calls = { sets:0, clears:0, launches:[], hands:0 };
  const elements = new Map();
  const element = id=>{
    if (!elements.has(id)) elements.set(id, {
      textContent:'', innerHTML:'',
      classList:{ add(){}, remove(){}, toggle(){} },
      querySelectorAll(){ return []; }
    });
    return elements.get(id);
  };
  const context = {
    console,
    BLIND_LEVELS:[[10,20],[15,30],[25,50],[50,100]],
    Store:{
      get(key, fallback){ return storage.has(key) ? clone(storage.get(key)) : fallback; },
      set(key, value){ calls.sets++; storage.set(key, clone(value)); },
      remove(key){ storage.delete(key); }
    },
    Sound:{ unlock(){}, buttonRelease(){} },
    hideResultCard(){},
    makeEventRewardState(){ return { score:0, awardCounts:{}, decisionSnapshots:[] }; },
    saveCareerTable(){ calls.savedTable = true; return true; },
    clearCareerTable(){ calls.clears++; },
    updateArcadeHUD(){}, showTableScreen(){}, initSeats(){},
    startNewHand(){ calls.hands++; },
    loadCareerTable(){ return null; },
    restoreTable(){},
    esc:value=>String(value),
    buildResultAmount(){},
    $:element,
    showConfirmDialog(){},
    setTimeout, clearTimeout
  };
  context.newGame = options=>{
    calls.launches.push(clone(options));
    context.game = { mode:options.mode };
  };
  vm.createContext(context);
  vm.runInContext('var game=null;\n' + registryCode + '\n' + careerCode + `
    globalThis.__careerTest={
      events:CAREER_EVENT_LIST,
      eventById:careerEventById,
      snapshot:careerEventSnapshot,
      getCareer:()=>career,
      setCareer:value=>{ career=value; },
      migrate:migrateCareer,
      state:careerEventState,
      canEnter:careerCanEnterEvent,
      enter:enterCareerEvent,
      settle:settleCareerEvent,
      start:startCareerEvent,
      resume:continueCareerEvent,
      unlocked:careerEventUnlocked
    };`, context);
  return { api:context.__careerTest, context, calls, storage };
}

let passed = 0;
function check(name, fn){
  fn();
  passed++;
  process.stdout.write('PASS  ' + name + '\n');
}

check('Career registry contains complete Back Room and Pub descriptors', ()=>{
  const { api } = makeContext();
  assert.strictEqual(api.events.length, 2);
  assert.deepStrictEqual(clone(api.eventById('back-room-freezeout')), {
    id:'back-room-freezeout', venue:'BACK ROOM', name:'BACK ROOM FREEZEOUT', format:'Freezeout',
    playerCount:3, opponentCount:2, buyIn:100, prize:300, stack:500,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'medium', unlockRequirement:null
  });
  assert.deepStrictEqual(clone(api.eventById('pub-freezeout')), {
    id:'pub-freezeout', venue:'PUB CIRCUIT', name:'PUB CIRCUIT FREEZEOUT', format:'Freezeout',
    playerCount:4, opponentCount:3, buyIn:300, prize:1200, stack:750,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'hard',
    unlockRequirement:{type:'event-win',eventId:'back-room-freezeout'}
  });
});

check('Back Room entry and launch retain the approved original configuration', ()=>{
  const { api, calls } = makeContext();
  assert.strictEqual(api.state('back-room-freezeout'), 'available');
  assert.strictEqual(api.enter('back-room-freezeout'), true);
  assert.strictEqual(api.getCareer().bankroll, 400);
  assert.ok(api.start());
  assert.deepStrictEqual(calls.launches[0], {
    mode:'career', difficulty:'medium', opponents:2, stack:500, blindLevel:0
  });
  assert.strictEqual(calls.hands, 1);
});

check('Pub starts four-handed with its own stack and financial terms', ()=>{
  const { api, calls } = makeContext({
    v:2, bankroll:500, active:null,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':true}, lastResult:null
  });
  assert.strictEqual(api.enter('pub-freezeout'), true);
  assert.strictEqual(api.getCareer().bankroll, 200);
  api.start();
  assert.deepStrictEqual(calls.launches[0], {
    mode:'career', difficulty:'hard', opponents:3, stack:750, blindLevel:0
  });
  assert.strictEqual(api.getCareer().active.snapshot.prize, 1200);
});

check('Back Room win unlocks Pub once and repeated settlement cannot re-credit', ()=>{
  const { api, calls, storage } = makeContext();
  api.enter('back-room-freezeout');
  assert.strictEqual(api.settle('win'), true);
  assert.strictEqual(api.getCareer().bankroll, 700);
  assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], true);
  assert.strictEqual(api.settle('win'), false);
  assert.strictEqual(api.getCareer().bankroll, 700);
  assert.strictEqual(calls.clears, 1);
  const reloaded = makeContext(storage.get('felt.career'));
  assert.strictEqual(reloaded.api.getCareer().unlocks['pub-freezeout'], true);
  assert.strictEqual(reloaded.api.state('pub-freezeout'), 'available');
});

check('Loss and abandonment do not unlock or credit prizes', ()=>{
  const loss = makeContext();
  loss.api.enter('back-room-freezeout');
  assert.strictEqual(loss.api.settle('loss'), true);
  assert.strictEqual(loss.api.getCareer().bankroll, 400);
  assert.strictEqual(loss.api.getCareer().unlocks['pub-freezeout'], false);
  const forfeit = makeContext();
  forfeit.api.enter('back-room-freezeout');
  assert.strictEqual(forfeit.api.settle('forfeit'), true);
  assert.strictEqual(forfeit.api.getCareer().bankroll, 400);
  assert.strictEqual(forfeit.api.getCareer().unlocks['pub-freezeout'], false);
});

check('Pub loss and win use its captured buy-in and prize', ()=>{
  const base = {v:2,bankroll:500,active:null,unlocks:{'back-room-freezeout':true,'pub-freezeout':true},lastResult:null};
  const loss = makeContext(base);
  loss.api.enter('pub-freezeout');
  loss.api.settle('loss');
  assert.strictEqual(loss.api.getCareer().bankroll, 200);
  assert.strictEqual(loss.api.getCareer().lastResult.delta, -300);
  const win = makeContext(base);
  win.api.enter('pub-freezeout');
  win.api.settle('win');
  assert.strictEqual(win.api.getCareer().bankroll, 1400);
  assert.strictEqual(win.api.getCareer().lastResult.delta, 1200);
});

check('Locked, unaffordable, active and blocked are distinct event states', ()=>{
  const locked = makeContext();
  assert.strictEqual(locked.api.state('pub-freezeout'), 'locked');
  const poor = makeContext({v:2,bankroll:250,active:null,unlocks:{'back-room-freezeout':true,'pub-freezeout':true},lastResult:null});
  assert.strictEqual(poor.api.state('back-room-freezeout'), 'available');
  assert.strictEqual(poor.api.state('pub-freezeout'), 'unaffordable');
  poor.api.enter('back-room-freezeout');
  assert.strictEqual(poor.api.state('back-room-freezeout'), 'active');
  assert.strictEqual(poor.api.state('pub-freezeout'), 'blocked');
  assert.strictEqual(poor.api.enter('pub-freezeout'), false);
});

check('Resume rebuilds the correct active event without charging again', ()=>{
  const { api, calls } = makeContext({v:2,bankroll:500,active:null,unlocks:{'back-room-freezeout':true,'pub-freezeout':true},lastResult:null});
  api.enter('pub-freezeout');
  const paidBankroll = api.getCareer().bankroll;
  api.resume(); // no table checkpoint branch intentionally rebuilds hand zero
  assert.strictEqual(api.getCareer().bankroll, paidBankroll);
  assert.deepStrictEqual(calls.launches[0], {
    mode:'career', difficulty:'hard', opponents:3, stack:750, blindLevel:0
  });
  assert.strictEqual(api.enter('back-room-freezeout'), false);
  assert.strictEqual(api.getCareer().bankroll, paidBankroll);
});

check('Version-1 bankroll and active Back Room event migrate safely', ()=>{
  const old = {v:1,bankroll:417,active:{eventId:'back-room-freezeout',buyIn:100,prize:300},lastResult:null};
  const { api, storage } = makeContext(old);
  const migrated = clone(api.getCareer());
  assert.strictEqual(migrated.v, 2);
  assert.strictEqual(migrated.bankroll, 417);
  assert.strictEqual(migrated.active.eventId, 'back-room-freezeout');
  assert.strictEqual(migrated.active.snapshot.stack, 500);
  assert.strictEqual(migrated.active.snapshot.buyIn, 100);
  assert.strictEqual(storage.get('felt.career').v, 2);
});

check('Version-1 recorded Back Room win preserves the Pub unlock', ()=>{
  const { api } = makeContext({v:1,bankroll:650,active:null,lastResult:{outcome:'win',delta:300,bankroll:650}});
  assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], true);
  assert.strictEqual(api.state('pub-freezeout'), 'available');
});

check('Career table persistence and DEV completion stay descriptor-driven', ()=>{
  assert.ok(engineSource.includes('careerEventSnapshot(g.event)'));
  assert.ok(engineSource.includes('normalizeCareerSavedEvent(save.event)'));
  assert.ok(engineSource.includes('isValidCareerEventSnapshot(save.event)'));
  assert.ok(engineSource.includes('g.event.handsPerBlindLevel'));
  assert.ok(engineSource.includes("if (game.mode === 'career') return saveCareerTable()"));
  ['data-career-enter','data-career-continue','data-career-abandon','AVAILABLE · UNAFFORDABLE','BLOCKED · EVENT ACTIVE']
    .forEach(copy=>assert.ok(wiringSource.includes(copy), copy));
  assert.ok(devSource.includes("if (g.mode === 'career') endCareerEvent(g, 'win')"));
  assert.ok(!/CAREER_EVENT\b/.test(engineSource + wiringSource + devSource));
});

check('Classic and Arcade remain on their established non-Career boundaries', ()=>{
  const standardSaveValidator = sliceBetween(engineSource, 'function isValidTableSave(save)', 'function saveTable()');
  assert.ok(standardSaveValidator.includes("save.mode !== 'cash'"));
  assert.ok(standardSaveValidator.includes("save.mode !== 'tournament'"));
  assert.ok(standardSaveValidator.includes("save.mode !== 'elimination'"));
  assert.ok(!standardSaveValidator.includes("save.mode !== 'career'"));
  assert.ok(engineSource.includes('enterResultsConsole(beginNextRunTable)'));
});

process.stdout.write('\n' + passed + ' focused Career event checks passed.\n');
