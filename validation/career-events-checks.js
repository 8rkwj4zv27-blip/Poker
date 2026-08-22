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
      unlocked:careerEventUnlocked,
      lastResult:careerLastResult,
      payouts:careerPayouts,
      prizeForPlace:careerPrizeForPlace,
      payoutSummary:careerPayoutSummary,
      payoutNote:careerPayoutNote
    };`, context);
  return { api:context.__careerTest, context, calls, storage };
}

/* A current-version career with the Back Room already won, which is what
   makes both Pub events reachable. */
function openCareer(unlocks){
  return {
    v:3, bankroll:500, active:null,
    unlocks: unlocks || {'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true},
    lastResult:null
  };
}

let passed = 0;
function check(name, fn){
  fn();
  passed++;
  process.stdout.write('PASS  ' + name + '\n');
}

check('Career registry contains complete Back Room and Pub descriptors', ()=>{
  const { api } = makeContext();
  assert.strictEqual(api.events.length, 3);
  assert.deepStrictEqual(clone(api.eventById('back-room-freezeout')), {
    id:'back-room-freezeout', venue:'BACK ROOM', name:'BACK ROOM FREEZEOUT', format:'Freezeout',
    playerCount:3, opponentCount:2, buyIn:100, prize:300, payouts:[300], stack:500,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'medium', unlockRequirement:null
  });
  assert.deepStrictEqual(clone(api.eventById('pub-freezeout')), {
    id:'pub-freezeout', venue:'PUB CIRCUIT', name:'PUB CIRCUIT FREEZEOUT', format:'Freezeout',
    playerCount:4, opponentCount:3, buyIn:300, prize:1200, payouts:[1200], stack:750,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'hard',
    unlockRequirement:{type:'event-win',eventId:'back-room-freezeout'}
  });
});

check('Pub Circuit Open descriptor carries the approved Top-2 configuration', ()=>{
  const { api } = makeContext();
  assert.deepStrictEqual(clone(api.eventById('pub-open')), {
    id:'pub-open', venue:'PUB CIRCUIT', name:'PUB CIRCUIT OPEN', format:'Freezeout',
    playerCount:5, opponentCount:4, buyIn:300, prize:1050, payouts:[1050,450], stack:750,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'hard',
    unlockRequirement:{type:'event-win',eventId:'back-room-freezeout'}
  });
  // The snapshot must be a real copy, never an alias of the frozen descriptor.
  const snapshot = api.snapshot(api.eventById('pub-open'));
  snapshot.payouts.push(999);
  assert.deepStrictEqual(clone(api.eventById('pub-open')).payouts, [1050,450]);
  assert.strictEqual(api.payoutSummary(api.eventById('pub-open')), '$1,050 / $450');
  assert.strictEqual(api.payoutSummary(api.eventById('pub-freezeout')), '$1,200');
  assert.ok(/Top two places are paid/.test(api.payoutNote(api.eventById('pub-open'))));
  assert.ok(/Only a win unlocks progression/.test(api.payoutNote(api.eventById('pub-open'))));
  assert.strictEqual(api.payoutNote(api.eventById('pub-freezeout')), 'Winner takes the full prize pool.');
});

check('Pub Circuit Open launches a five-player field and charges $300 once', ()=>{
  const { api, calls } = makeContext(openCareer());
  assert.strictEqual(api.state('pub-open'), 'available');
  assert.strictEqual(api.enter('pub-open'), true);
  assert.strictEqual(api.getCareer().bankroll, 200);
  api.start();
  assert.deepStrictEqual(calls.launches[0], {
    mode:'career', difficulty:'hard', opponents:4, stack:750, blindLevel:0
  });
  const snapshot = api.getCareer().active.snapshot;
  assert.strictEqual(snapshot.playerCount, 5);
  assert.strictEqual(snapshot.opponentCount, 4);
  assert.deepStrictEqual(clone(snapshot.payouts), [1050,450]);
  // A second entry attempt while active must not charge again.
  assert.strictEqual(api.enter('pub-open'), false);
  assert.strictEqual(api.enter('back-room-freezeout'), false);
  assert.strictEqual(api.getCareer().bankroll, 200);
});

check('Pub Circuit Open resume rebuilds the five-player table without recharging', ()=>{
  const { api, calls } = makeContext(openCareer());
  api.enter('pub-open');
  const paid = api.getCareer().bankroll;
  api.resume();
  assert.strictEqual(api.getCareer().bankroll, paid);
  assert.deepStrictEqual(calls.launches[0], {
    mode:'career', difficulty:'hard', opponents:4, stack:750, blindLevel:0
  });
});

check('First place credits $1,050 and is the only placement that unlocks', ()=>{
  const { api } = makeContext(openCareer());
  api.enter('pub-open');
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().bankroll, 1250);   // 500 - 300 + 1050
  const result = api.lastResult();
  assert.strictEqual(result.outcome, 'win');
  assert.strictEqual(result.place, 1);
  assert.strictEqual(result.prize, 1050);
  assert.strictEqual(result.delta, 1050);
});

check('Second place credits $450 as a cash and unlocks nothing', ()=>{
  const { api } = makeContext(openCareer({'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true}));
  const before = clone(api.getCareer().unlocks);
  api.enter('pub-open');
  assert.strictEqual(api.settle({place:2}), true);
  assert.strictEqual(api.getCareer().bankroll, 650);    // 500 - 300 + 450
  const result = api.lastResult();
  assert.strictEqual(result.outcome, 'cash');
  assert.strictEqual(result.place, 2);
  assert.strictEqual(result.prize, 450);
  assert.strictEqual(result.delta, 450);
  assert.deepStrictEqual(clone(api.getCareer().unlocks), before);
});

check('Third through fifth place credit nothing', ()=>{
  [3,4,5].forEach(place=>{
    const { api } = makeContext(openCareer());
    const before = clone(api.getCareer().unlocks);
    api.enter('pub-open');
    assert.strictEqual(api.settle({place}), true);
    assert.strictEqual(api.getCareer().bankroll, 200, 'place ' + place);
    assert.strictEqual(api.lastResult().outcome, 'loss');
    assert.strictEqual(api.lastResult().place, place);
    assert.strictEqual(api.lastResult().prize, 0);
    assert.strictEqual(api.lastResult().delta, -300);
    assert.deepStrictEqual(clone(api.getCareer().unlocks), before);
  });
});

check('Malformed placements never award money or unlock progression', ()=>{
  const malformed = [
    {place:0}, {place:-1}, {place:6}, {place:99}, {place:2.5}, {place:'2'},
    {place:NaN}, {place:Infinity}, {place:null}, {place:[2]}, {}, null, undefined, 'cash', 42
  ];
  malformed.forEach(input=>{
    // A locked start, so an accidental unlock would be unmistakable.
    const { api } = makeContext(openCareer({'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true}));
    const before = clone(api.getCareer().unlocks);
    api.enter('pub-open');
    const label = String(JSON.stringify(input));
    assert.strictEqual(api.settle(input), true, label);
    assert.strictEqual(api.getCareer().bankroll, 200, label);
    assert.strictEqual(api.lastResult().outcome, 'loss', label);
    assert.strictEqual(api.lastResult().place, null, label);
    assert.strictEqual(api.lastResult().prize, 0, label);
    assert.strictEqual(api.lastResult().delta, -300, label);
    assert.deepStrictEqual(clone(api.getCareer().unlocks), before, label);
  });
  // The same inputs against an event that DOES gate progression: a Back Room
  // settlement is the one that can hand out access, so prove none of them do.
  malformed.forEach(input=>{
    const { api } = makeContext();
    api.enter('back-room-freezeout');
    const label = String(JSON.stringify(input));
    assert.strictEqual(api.settle(input), true, label);
    assert.strictEqual(api.getCareer().bankroll, 400, label);
    assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], false, label);
    assert.strictEqual(api.getCareer().unlocks['pub-open'], false, label);
  });
});

check('Pub Circuit Open bust, abandonment and repeated settlement pay nothing', ()=>{
  const bust = makeContext(openCareer());
  bust.api.enter('pub-open');
  bust.api.settle({place:5});
  assert.strictEqual(bust.api.getCareer().bankroll, 200);

  const forfeit = makeContext(openCareer());
  forfeit.api.enter('pub-open');
  assert.strictEqual(forfeit.api.settle('forfeit'), true);
  assert.strictEqual(forfeit.api.getCareer().bankroll, 200);
  assert.strictEqual(forfeit.api.lastResult().outcome, 'forfeit');
  assert.strictEqual(forfeit.api.lastResult().place, null);
  assert.strictEqual(forfeit.api.lastResult().prize, 0);
  assert.strictEqual(forfeit.api.lastResult().delta, -300);

  const twice = makeContext(openCareer());
  twice.api.enter('pub-open');
  assert.strictEqual(twice.api.settle({place:1}), true);
  assert.strictEqual(twice.api.getCareer().bankroll, 1250);
  assert.strictEqual(twice.api.settle({place:1}), false);
  assert.strictEqual(twice.api.settle({place:2}), false);
  assert.strictEqual(twice.api.getCareer().bankroll, 1250);
  assert.strictEqual(twice.calls.clears, 1);
});

check('An active event settles on its captured payout terms, not the catalogue', ()=>{
  const retuned = openCareer();
  retuned.active = {
    eventId:'pub-open',
    snapshot:Object.assign(makeContext().api.snapshot(makeContext().api.eventById('pub-open')), {
      buyIn:250, prize:900, payouts:[900,300]
    })
  };
  const first = makeContext(retuned);
  assert.deepStrictEqual(clone(first.api.getCareer().active.snapshot.payouts), [900,300]);
  assert.strictEqual(first.api.settle({place:2}), true);
  assert.strictEqual(first.api.getCareer().bankroll, 800);   // 500 + 300
  assert.strictEqual(first.api.lastResult().prize, 300);

  const second = makeContext(retuned);
  assert.strictEqual(second.api.settle({place:1}), true);
  assert.strictEqual(second.api.getCareer().bankroll, 1400); // 500 + 900
  assert.strictEqual(second.api.lastResult().prize, 900);
});

check('Winner-take-all events are unchanged by placement settlement', ()=>{
  const base = {v:3,bankroll:500,active:null,unlocks:{'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true},lastResult:null};
  const second = makeContext(base);
  second.api.enter('pub-freezeout');
  assert.strictEqual(second.api.settle({place:2}), true);
  assert.strictEqual(second.api.getCareer().bankroll, 200);
  assert.strictEqual(second.api.lastResult().outcome, 'loss');
  assert.strictEqual(second.api.lastResult().prize, 0);
  assert.strictEqual(second.api.lastResult().delta, -300);

  const backRoom = makeContext();
  backRoom.api.enter('back-room-freezeout');
  assert.strictEqual(backRoom.api.settle({place:2}), true);
  assert.strictEqual(backRoom.api.getCareer().bankroll, 400);
  assert.strictEqual(backRoom.api.getCareer().unlocks['pub-freezeout'], false);
});

check('careerPrizeForPlace rejects every non-place value', ()=>{
  const { api } = makeContext();
  const event = api.eventById('pub-open');
  [0,-1,-5,1.5,2.5,6,99,NaN,Infinity,null,undefined,'1','2',[1],{}].forEach(place=>{
    assert.strictEqual(api.prizeForPlace(event, place), 0, String(place));
  });
  assert.strictEqual(api.prizeForPlace(event, 1), 1050);
  assert.strictEqual(api.prizeForPlace(event, 2), 450);
  // A snapshot that somehow lost its payouts still reads as winner-take-all.
  assert.deepStrictEqual(clone(api.payouts({prize:300})), [300]);
  assert.strictEqual(api.prizeForPlace({prize:300}, 1), 300);
  assert.strictEqual(api.prizeForPlace({prize:300}, 2), 0);
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
  const { api, calls } = makeContext(openCareer());
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
  assert.strictEqual(api.getCareer().unlocks['pub-open'], true);
  assert.strictEqual(api.settle('win'), false);
  assert.strictEqual(api.getCareer().bankroll, 700);
  assert.strictEqual(calls.clears, 1);
  const reloaded = makeContext(storage.get('felt.career'));
  assert.strictEqual(reloaded.api.getCareer().unlocks['pub-freezeout'], true);
  assert.strictEqual(reloaded.api.getCareer().unlocks['pub-open'], true);
  assert.strictEqual(reloaded.api.state('pub-freezeout'), 'available');
  assert.strictEqual(reloaded.api.state('pub-open'), 'available');
});

check('Loss and abandonment do not unlock or credit prizes', ()=>{
  const loss = makeContext();
  loss.api.enter('back-room-freezeout');
  assert.strictEqual(loss.api.settle('loss'), true);
  assert.strictEqual(loss.api.getCareer().bankroll, 400);
  assert.strictEqual(loss.api.getCareer().unlocks['pub-freezeout'], false);
  assert.strictEqual(loss.api.getCareer().unlocks['pub-open'], false);
  const forfeit = makeContext();
  forfeit.api.enter('back-room-freezeout');
  assert.strictEqual(forfeit.api.settle('forfeit'), true);
  assert.strictEqual(forfeit.api.getCareer().bankroll, 400);
  assert.strictEqual(forfeit.api.getCareer().unlocks['pub-freezeout'], false);
});

check('Pub loss and win use its captured buy-in and prize', ()=>{
  const base = openCareer();
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
  const poor = makeContext(Object.assign(openCareer(), {bankroll:250}));
  assert.strictEqual(poor.api.state('back-room-freezeout'), 'available');
  assert.strictEqual(poor.api.state('pub-freezeout'), 'unaffordable');
  poor.api.enter('back-room-freezeout');
  assert.strictEqual(poor.api.state('back-room-freezeout'), 'active');
  assert.strictEqual(poor.api.state('pub-freezeout'), 'blocked');
  assert.strictEqual(poor.api.enter('pub-freezeout'), false);
});

check('Resume rebuilds the correct active event without charging again', ()=>{
  const { api, calls } = makeContext(openCareer());
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
  assert.strictEqual(migrated.v, 3);
  assert.strictEqual(migrated.bankroll, 417);
  assert.strictEqual(migrated.active.eventId, 'back-room-freezeout');
  assert.strictEqual(migrated.active.snapshot.stack, 500);
  assert.strictEqual(migrated.active.snapshot.buyIn, 100);
  // A winner-take-all save reconstructs as exactly that, never as the
  // catalogue's current (possibly multi-place) table.
  assert.deepStrictEqual(migrated.active.snapshot.payouts, [300]);
  assert.strictEqual(migrated.active.snapshot.prize, 300);
  assert.strictEqual(storage.get('felt.career').v, 3);
});

check('Version-1 recorded Back Room win preserves the Pub unlock', ()=>{
  const { api } = makeContext({v:1,bankroll:650,active:null,lastResult:{outcome:'win',delta:300,bankroll:650}});
  assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], true);
  assert.strictEqual(api.getCareer().unlocks['pub-open'], true);
  assert.strictEqual(api.state('pub-freezeout'), 'available');
  assert.strictEqual(api.state('pub-open'), 'available');
});

check('Version-2 inactive careers migrate to version 3 intact', ()=>{
  const { api, storage } = makeContext({
    v:2, bankroll:825, active:null,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':false},
    lastResult:{outcome:'loss',eventId:'pub-freezeout',eventName:'PUB CIRCUIT FREEZEOUT',venue:'PUB CIRCUIT',delta:-300,bankroll:825}
  });
  const migrated = clone(api.getCareer());
  assert.strictEqual(migrated.v, 3);
  assert.strictEqual(migrated.bankroll, 825);
  assert.strictEqual(migrated.active, null);
  assert.strictEqual(migrated.unlocks['back-room-freezeout'], true);
  assert.strictEqual(migrated.unlocks['pub-freezeout'], false);
  assert.strictEqual(migrated.unlocks['pub-open'], false);
  assert.strictEqual(storage.get('felt.career').v, 3);
});

check('A version-2 active snapshot without payouts keeps its paid terms', ()=>{
  // Terms deliberately different from the live catalogue: if migration were
  // to rebuild from the descriptor instead of honouring what was paid, these
  // numbers are what would change.
  const { api } = makeContext({
    v:2, bankroll:200, lastResult:null,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':true},
    active:{
      eventId:'pub-freezeout',
      snapshot:{
        id:'pub-freezeout', venue:'PUB CIRCUIT', name:'PUB CIRCUIT FREEZEOUT', format:'Freezeout',
        playerCount:4, opponentCount:3, buyIn:250, prize:1000, stack:750,
        initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'hard',
        unlockRequirement:{type:'event-win',eventId:'back-room-freezeout'}
      }
    }
  });
  const snapshot = clone(api.getCareer().active.snapshot);
  assert.strictEqual(api.getCareer().v, 3);
  assert.strictEqual(snapshot.buyIn, 250);
  assert.strictEqual(snapshot.prize, 1000);
  assert.deepStrictEqual(snapshot.payouts, [1000]);
  assert.strictEqual(snapshot.stack, 750);
  assert.strictEqual(snapshot.playerCount, 4);
  // And it settles on those terms.
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().bankroll, 1200);
});

check('A version-2 Back Room winner also receives the new Pub Circuit Open', ()=>{
  const { api, storage } = makeContext({
    v:2, bankroll:900, active:null,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':true}, lastResult:null
  });
  assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], true);
  assert.strictEqual(api.getCareer().unlocks['pub-open'], true);
  assert.strictEqual(api.state('pub-open'), 'available');
  assert.strictEqual(storage.get('felt.career').unlocks['pub-open'], true);

  // The equivalence must not invent access nobody earned.
  const fresh = makeContext({v:2,bankroll:900,active:null,unlocks:{'back-room-freezeout':true,'pub-freezeout':false},lastResult:null});
  assert.strictEqual(fresh.api.getCareer().unlocks['pub-open'], false);
  assert.strictEqual(fresh.api.state('pub-open'), 'locked');
});

check('Old lastResult records without place or prize normalise safely', ()=>{
  const { api } = makeContext({
    v:2, bankroll:700, active:null,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':true},
    lastResult:{outcome:'win',eventId:'back-room-freezeout',eventName:'BACK ROOM FREEZEOUT',venue:'BACK ROOM',delta:300,bankroll:700}
  });
  const result = clone(api.lastResult());
  assert.strictEqual(result.place, null);        // never reconstructed from delta
  assert.strictEqual(result.prize, 0);
  assert.strictEqual(result.outcome, 'win');     // everything else verbatim
  assert.strictEqual(result.delta, 300);
  assert.strictEqual(result.bankroll, 700);
  assert.strictEqual(result.eventName, 'BACK ROOM FREEZEOUT');
});

check('Career table persistence and DEV completion stay descriptor-driven', ()=>{
  assert.ok(engineSource.includes('careerEventSnapshot(g.event)'));
  assert.ok(engineSource.includes('normalizeCareerSavedEvent(save.event)'));
  assert.ok(engineSource.includes('isValidCareerEventSnapshot(save.event)'));
  assert.ok(engineSource.includes('g.event.handsPerBlindLevel'));
  assert.ok(engineSource.includes("if (game.mode === 'career') return saveCareerTable()"));
  ['data-career-enter','data-career-continue','data-career-abandon','AVAILABLE · UNAFFORDABLE','BLOCKED · EVENT ACTIVE']
    .forEach(copy=>assert.ok(wiringSource.includes(copy), copy));
  assert.ok(devSource.includes("if (g.mode === 'career') endCareerEvent(g, {place:1})"));
  // Placement must reach settlement from the table, not from a win/loss value.
  assert.ok(engineSource.includes('endCareerEvent(g,{place:careerFinishPlace(g,human)})'));
  assert.ok(!/endCareerEvent\((g|game), *'(win|loss)'\)/.test(engineSource + devSource));
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
