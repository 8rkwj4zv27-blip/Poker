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
const mathSource = fs.readFileSync(path.join(root, 'js/01-poker-math.js'), 'utf8');
const supportSource = fs.readFileSync(path.join(root, 'js/02-support-systems.js'), 'utf8');
const opponentSource = fs.readFileSync(path.join(root, 'js/03-opponents.js'), 'utf8');
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
/* The REAL opponent systems, so a roster drawn in these checks is drawn by
   the same pickPersonalities()/assignFaceColors() a real table uses rather
   than by a stub that could drift from them. */
const shuffleCode = sliceBetween(mathSource, 'function shuffle(deck){', 'function cardKey');
const faceColorCode = sliceBetween(supportSource, 'const FACE_COLORS = [', '/* One entry per art batch');
const assignColorCode = sliceBetween(supportSource, 'function assignFaceColors(players){', 'function faceHue');
const personalityCode = sliceBetween(opponentSource, 'const PERSONALITIES_ALL = [', 'const RANDOM_FIRST_NAMES');
const randomNameCode = sliceBetween(opponentSource, 'const RANDOM_FIRST_NAMES', 'const DIFFICULTY_PARAMS');
const opponentCode = shuffleCode + '\n' + faceColorCode + '\n' + assignColorCode + '\n' + personalityCode;
/* The REAL table builder, so the other half of the roster guarantee — that
   newGame() actually seats the field it is handed — is tested against
   production rather than against the stub the Career checks use. */
const newGameCode = sliceBetween(engineSource, 'function makePlayer(', '/* ---------------- table save/resume ----------------');
function makeTableContext(playerName){
  const context = {
    console,
    BLIND_LEVELS:[[10,20],[15,30],[25,50],[50,100]],
    ELIMINATION_CONFIG:{ startingStack:1000, smallBlind:10, bigBlind:20 },
    normalizeOpponentCount:n=>n,
    settings:{ playerName:playerName || 'You', opponentNames:'persona', lives:false }
  };
  vm.createContext(context);
  vm.runInContext('var game=null;\n' + opponentCode + '\n' + randomNameCode + '\n' + newGameCode +
    '\nglobalThis.__tableTest={ newGame, launchRoster:careerLaunchRoster, getGame:()=>game };', context);
  return context.__tableTest;
}
const careerCode = sliceBetween(wiringSource, "const CAREER_KEY = 'felt.career';", 'function startSinglePlayerRun');
const devCareerBankrollCode = sliceBetween(devSource, 'function normalizeDevCareerBankroll', 'function initDevPanel');

function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
/* The launch terms newGame() is handed, minus the roster. The roster is
   asserted separately and by identity of CONTENT (see the roster-integrity
   checks) rather than being restated inside every terms fixture. */
function launchTerms(options){
  const terms = Object.assign({}, options);
  delete terms.roster;
  return terms;
}
function makeContext(initialCareer){
  const storage = new Map();
  if (initialCareer !== undefined) storage.set('felt.career', clone(initialCareer));
  const calls = { sets:0, clears:0, launches:[], hands:0 };
  const elements = new Map();
  const element = id=>{
    if (!elements.has(id)) elements.set(id, {
      textContent:'', innerHTML:'', dataset:{},
      classList:{ add(){}, remove(){}, toggle(){} },
      querySelectorAll(){ return []; },
      querySelector(){ return null; },
      appendChild(){},
      setAttribute(){}
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
    motionOff(){ return true; },
    document:{ createElement(){ return { className:'', textContent:'', dataset:{} }; } },
    $:element,
    showConfirmDialog(){},
    /* Stands in for the production portrait path and records exactly which
       face colour and mood the directory asked for, so a preview roster can
       be compared against the roster the table is launched with. */
    renderFace(p, mood){ return '<i data-c="' + p.faceColorIdx + '" data-m="' + mood + '"></i>'; },
    setTimeout, clearTimeout
  };
  context.newGame = options=>{
    calls.launches.push(clone(options));
    context.game = { mode:options.mode };
  };
  vm.createContext(context);
  vm.runInContext('var game=null; var DEV_MODE=true; function refreshDevPanel(){}\n' + opponentCode + '\n' + registryCode + '\n' + careerCode + '\n' + devCareerBankrollCode + `
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
      requirementText:careerRequirementText,
      entryLabel:careerEntryLabel,
      highestAccess:careerHighestAccess,
      threatOf:careerThreatOf,
      roomEvents:careerRoomEvents,
      rooms:CAREER_ROOMS,
      normalizeCounter:normalizeCareerCounter,
      saveVersion:CAREER_SAVE_VERSION,
      secondChanceEligible:isSecondChanceEligible,
      secondChanceThreshold:SECOND_CHANCE_BANKROLL_THRESHOLD,
      secondChanceEventId:SECOND_CHANCE_EVENT_ID,
      render:renderCareerScreen,
      showScreen:showCareerScreen,
      title:careerEventTitle,
      trayHTML:careerTrayHTML,
      cassetteHTML:careerCassetteHTML,
      rosterFor:careerRosterFor,
      activeRoster:careerActiveRoster,
      releaseRoster:releaseCareerRoster,
      materializeRosters:materializeCareerRosters,
      generateRoster:generateCareerRoster,
      normalizeRoster:normalizeCareerRoster,
      setDevMode:value=>{ DEV_MODE=value; },
      setDevBankroll:devSetCareerBankroll
    };`, context);
  return { api:context.__careerTest, context, calls, storage };
}

/* A current-version career with the Back Room already won, which is what
   makes both Pub events reachable. */
function openCareer(unlocks){
  return {
    v:4, bankroll:500, active:null, eventsPlayed:0, eventsWon:0,
    unlocks: unlocks || {'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true},
    lastResult:null
  };
}

/* A current-version career at a given bankroll, otherwise at the default
   locked-Pub baseline, for exercising Second Chance's boundary set. */
function recoveryCareer(bankroll){
  return {
    v:4, bankroll, active:null, eventsPlayed:0, eventsWon:0,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':false,'pub-open':false,'second-chance':true},
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
  assert.strictEqual(api.events.length, 4);
  assert.deepStrictEqual(clone(api.eventById('back-room-freezeout')), {
    id:'back-room-freezeout', venue:'BACK ROOM', name:'BACK ROOM 3-HAND', title:'3-HAND',
    format:'Freezeout',
    playerCount:3, opponentCount:2, buyIn:100, prize:300, payouts:[300], stack:500,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'medium', unlockRequirement:null
  });
  assert.deepStrictEqual(clone(api.eventById('pub-freezeout')), {
    id:'pub-freezeout', venue:'PUB CIRCUIT', name:'PUB CIRCUIT 4-HAND', title:'4-HAND',
    format:'Freezeout',
    playerCount:4, opponentCount:3, buyIn:300, prize:1200, payouts:[1200], stack:750,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'hard',
    unlockRequirement:{type:'event-win',eventId:'back-room-freezeout'}
  });
});

check('Pub Circuit Open descriptor carries the approved Top-2 configuration', ()=>{
  const { api } = makeContext();
  assert.deepStrictEqual(clone(api.eventById('pub-open')), {
    id:'pub-open', venue:'PUB CIRCUIT', name:'PUB CIRCUIT 5-HAND', title:'5-HAND',
    format:'Freezeout',
    playerCount:5, opponentCount:4, buyIn:300, prize:1050, payouts:[1050,450], stack:750,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'hard',
    unlockRequirement:{type:'event-win',eventId:'back-room-freezeout'}
  });
  // The snapshot must be a real copy, never an alias of the frozen descriptor.
  const snapshot = api.snapshot(api.eventById('pub-open'));
  snapshot.payouts.push(999);
  assert.deepStrictEqual(clone(api.eventById('pub-open')).payouts, [1050,450]);
  // The directory names the place each figure pays, so a Top-2 payout can
  // never read as one prize split by an unexplained slash.
  assert.strictEqual(api.payoutSummary(api.eventById('pub-open')), '$1,050 TO 1ST · $450 TO 2ND');
  assert.strictEqual(api.payoutSummary(api.eventById('pub-freezeout')), '$1,200 TO 1ST');
});

check('Pub Circuit Open launches a five-player field and charges $300 once', ()=>{
  const { api, calls } = makeContext(openCareer());
  assert.strictEqual(api.state('pub-open'), 'available');
  assert.strictEqual(api.enter('pub-open'), true);
  assert.strictEqual(api.getCareer().bankroll, 200);
  api.start();
  assert.deepStrictEqual(launchTerms(calls.launches[0]), {
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
  assert.deepStrictEqual(launchTerms(calls.launches[0]), {
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
  const base = {v:4,bankroll:500,active:null,eventsPlayed:0,eventsWon:0,unlocks:{'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true},lastResult:null};
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
  assert.deepStrictEqual(launchTerms(calls.launches[0]), {
    mode:'career', difficulty:'medium', opponents:2, stack:500, blindLevel:0
  });
  assert.strictEqual(calls.hands, 1);
});

check('Pub starts four-handed with its own stack and financial terms', ()=>{
  const { api, calls } = makeContext(openCareer());
  assert.strictEqual(api.enter('pub-freezeout'), true);
  assert.strictEqual(api.getCareer().bankroll, 200);
  api.start();
  assert.deepStrictEqual(launchTerms(calls.launches[0]), {
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
  assert.deepStrictEqual(launchTerms(calls.launches[0]), {
    mode:'career', difficulty:'hard', opponents:3, stack:750, blindLevel:0
  });
  assert.strictEqual(api.enter('back-room-freezeout'), false);
  assert.strictEqual(api.getCareer().bankroll, paidBankroll);
});

check('Version-1 bankroll and active Back Room event migrate safely', ()=>{
  const old = {v:1,bankroll:417,active:{eventId:'back-room-freezeout',buyIn:100,prize:300},lastResult:null};
  const { api, storage } = makeContext(old);
  const migrated = clone(api.getCareer());
  assert.strictEqual(migrated.v, api.saveVersion);
  assert.strictEqual(migrated.bankroll, 417);
  assert.strictEqual(migrated.active.eventId, 'back-room-freezeout');
  assert.strictEqual(migrated.active.snapshot.stack, 500);
  assert.strictEqual(migrated.active.snapshot.buyIn, 100);
  // A winner-take-all save reconstructs as exactly that, never as the
  // catalogue's current (possibly multi-place) table.
  assert.deepStrictEqual(migrated.active.snapshot.payouts, [300]);
  assert.strictEqual(migrated.active.snapshot.prize, 300);
  assert.strictEqual(storage.get('felt.career').v, api.saveVersion);
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
  assert.strictEqual(migrated.v, api.saveVersion);
  assert.strictEqual(migrated.bankroll, 825);
  assert.strictEqual(migrated.active, null);
  assert.strictEqual(migrated.unlocks['back-room-freezeout'], true);
  assert.strictEqual(migrated.unlocks['pub-freezeout'], false);
  assert.strictEqual(migrated.unlocks['pub-open'], false);
  assert.strictEqual(storage.get('felt.career').v, api.saveVersion);
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
  assert.strictEqual(api.getCareer().v, api.saveVersion);
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

check('An existing valid version-3 career save from before Second Chance existed migrates safely', ()=>{
  // A real version-3 save, exactly as Phase 1 wrote it: everything about its
  // shape is otherwise current, it simply predates the fourth catalogue
  // entry and so has no unlocks['second-chance'] key at all. isValidCareer()
  // must reject that (every event needs a boolean unlocks entry) and route
  // it through the same migrateCareer() path a version-1 or version-2 save
  // takes — never crash, never silently accept a hole in the unlocks map.
  // A real save can never have pub-freezeout unlocked without pub-open —
  // settleCareerEvent() grants both in the same commit, since they share one
  // unlockRequirement — so both are true here, exactly as production would
  // have written them.
  const pubSnapshot = clone(makeContext().api.snapshot(makeContext().api.eventById('pub-freezeout')));
  const preExisting = {
    v:4, eventsPlayed:0, eventsWon:0, bankroll:275,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true},
    active:{ eventId:'pub-freezeout', snapshot:pubSnapshot },
    lastResult:{
      outcome:'win', place:1, prize:1200, eventId:'back-room-freezeout',
      eventName:'BACK ROOM FREEZEOUT', venue:'BACK ROOM', delta:1200, bankroll:275
    }
  };
  const { api, calls, storage } = makeContext(preExisting);
  const migrated = clone(api.getCareer());

  // Bankroll, active state, existing unlocks and the last result all survive
  // verbatim — this save was already valid in every dimension Second Chance
  // does not touch.
  assert.strictEqual(migrated.v, api.saveVersion);
  assert.strictEqual(migrated.bankroll, 275);
  assert.deepStrictEqual(migrated.active, { eventId:'pub-freezeout', snapshot:pubSnapshot });
  assert.strictEqual(migrated.unlocks['back-room-freezeout'], true);
  assert.strictEqual(migrated.unlocks['pub-freezeout'], true);
  assert.strictEqual(migrated.unlocks['pub-open'], true);
  assert.deepStrictEqual(migrated.lastResult, preExisting.lastResult);

  // The required Second Chance catalogue state is added safely: it is
  // unconditionally true, exactly like any other unlockRequirement:null
  // event's default, never something inferred from the old save's contents.
  assert.strictEqual(migrated.unlocks['second-chance'], true);

  // The migrated save is persisted, not just held in memory.
  assert.strictEqual(calls.sets, 1);
  assert.strictEqual(storage.get('felt.career').unlocks['second-chance'], true);
  assert.strictEqual(storage.get('felt.career').bankroll, 275);

  // Second Chance stays governed solely by LIVE bankroll eligibility, never
  // by anything read from the old save. With an event already active it is
  // 'blocked' like every other event, exactly as if the save had always
  // known about it — the missing key never leaks into eligibility.
  assert.strictEqual(api.state('second-chance'), 'blocked');

  // A second, inactive save from the same pre-Second-Chance shape proves the
  // point cleanly: identical missing key, opposite live eligibility purely
  // from bankroll.
  const poor = makeContext({
    v:4, eventsPlayed:0, eventsWon:0, bankroll:40,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':false,'pub-open':false},
    active:null, lastResult:null
  });
  assert.strictEqual(poor.api.getCareer().unlocks['second-chance'], true);
  assert.strictEqual(poor.api.state('second-chance'), 'available');

  const flush = makeContext({
    v:4, eventsPlayed:0, eventsWon:0, bankroll:500,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':false,'pub-open':false},
    active:null, lastResult:null
  });
  assert.strictEqual(flush.api.getCareer().unlocks['second-chance'], true);
  assert.strictEqual(flush.api.state('second-chance'), 'hidden');
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
  ['data-career-enter','data-career-continue','data-career-abandon','data-career-toggle',
   'OPEN TO YOU NOW','UNAVAILABLE WHILE AN EVENT IS ACTIVE','LOCKED &middot; COMING SOON']
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

check('Second Chance descriptor is free, three-handed and pays $150 to first only', ()=>{
  const { api } = makeContext();
  assert.strictEqual(api.events.length, 4);
  assert.deepStrictEqual(clone(api.eventById('second-chance')), {
    id:'second-chance', venue:'BACK ROOM', name:'SECOND CHANCE', title:'SECOND CHANCE',
    format:'Freezeout',
    playerCount:3, opponentCount:2, buyIn:0, prize:150, payouts:[150], stack:500,
    initialBlindLevel:0, handsPerBlindLevel:10, difficulty:'medium', unlockRequirement:null
  });
  assert.strictEqual(api.secondChanceEventId, 'second-chance');
  assert.strictEqual(api.secondChanceThreshold, 100);
});

check('Second Chance eligibility predicate holds the fixed $100 threshold at every boundary', ()=>{
  const { api } = makeContext();
  [0,49,50,99].forEach(bankroll=>{
    assert.strictEqual(api.secondChanceEligible(bankroll), true, String(bankroll));
  });
  [100,101].forEach(bankroll=>{
    assert.strictEqual(api.secondChanceEligible(bankroll), false, String(bankroll));
  });
  // Never derived from anything else — a bare boolean of live bankroll only.
  [NaN,Infinity,-Infinity,null,undefined,'50',[50]].forEach(bad=>{
    assert.strictEqual(api.secondChanceEligible(bad), false, String(bad));
  });
});

check('Second Chance is visible and available at $0, $49, $50 and $99', ()=>{
  [0,49,50,99].forEach(bankroll=>{
    const { api, context } = makeContext(recoveryCareer(bankroll));
    assert.strictEqual(api.state('second-chance'), 'available', String(bankroll));
    api.render();
    const board = context.$('career-events');
    assert.ok(board.innerHTML.indexOf('data-career-toggle="second-chance"') !== -1, String(bankroll));
  });
});

check('Second Chance is hidden and its entry is rejected at $100 and $101', ()=>{
  [100,101].forEach(bankroll=>{
    const { api, context } = makeContext(recoveryCareer(bankroll));
    assert.strictEqual(api.state('second-chance'), 'hidden', String(bankroll));
    api.render();
    const board = context.$('career-events');
    assert.ok(board.innerHTML.indexOf('data-career-toggle="second-chance"') === -1, String(bankroll));
    // A stale or manually triggered entry attempt must fail cleanly: no
    // charge, no active event, no save write.
    assert.strictEqual(api.canEnter('second-chance'), false, String(bankroll));
    assert.strictEqual(api.enter('second-chance'), false, String(bankroll));
    assert.strictEqual(api.getCareer().bankroll, bankroll, String(bankroll));
    assert.strictEqual(api.getCareer().active, null, String(bankroll));
  });
});

check('Second Chance entry is free and does not debit bankroll', ()=>{
  const { api } = makeContext(recoveryCareer(50));
  assert.strictEqual(api.enter('second-chance'), true);
  assert.strictEqual(api.getCareer().bankroll, 50);
  assert.strictEqual(api.getCareer().active.snapshot.buyIn, 0);
  assert.strictEqual(api.getCareer().active.snapshot.playerCount, 3);
  assert.strictEqual(api.getCareer().active.snapshot.stack, 500);
});

check('Second Chance win credits $150 additively, from $0 and from $99', ()=>{
  const fromZero = makeContext(recoveryCareer(0));
  fromZero.api.enter('second-chance');
  assert.strictEqual(fromZero.api.settle({place:1}), true);
  assert.strictEqual(fromZero.api.getCareer().bankroll, 150);
  assert.strictEqual(fromZero.api.lastResult().outcome, 'win');
  assert.strictEqual(fromZero.api.lastResult().prize, 150);

  const fromNinetyNine = makeContext(recoveryCareer(99));
  fromNinetyNine.api.enter('second-chance');
  assert.strictEqual(fromNinetyNine.api.settle({place:1}), true);
  assert.strictEqual(fromNinetyNine.api.getCareer().bankroll, 249);
});

check('Second Chance duplicate settlement cannot credit twice', ()=>{
  const { api } = makeContext(recoveryCareer(0));
  api.enter('second-chance');
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().bankroll, 150);
  assert.strictEqual(api.settle({place:1}), false);
  assert.strictEqual(api.getCareer().bankroll, 150);
});

check('Second place and third place pay $0', ()=>{
  [2,3].forEach(place=>{
    const { api } = makeContext(recoveryCareer(0));
    api.enter('second-chance');
    assert.strictEqual(api.settle({place}), true, String(place));
    assert.strictEqual(api.getCareer().bankroll, 0, String(place));
    assert.strictEqual(api.lastResult().outcome, 'loss', String(place));
    assert.strictEqual(api.lastResult().prize, 0, String(place));
  });
});

check('Second Chance defeat and abandonment change no unlock and no bankroll', ()=>{
  const bust = makeContext(recoveryCareer(0));
  bust.api.enter('second-chance');
  const beforeBust = clone(bust.api.getCareer().unlocks);
  bust.api.settle({place:3});
  assert.strictEqual(bust.api.getCareer().bankroll, 0);
  assert.deepStrictEqual(clone(bust.api.getCareer().unlocks), beforeBust);

  const forfeit = makeContext(recoveryCareer(0));
  forfeit.api.enter('second-chance');
  const beforeForfeit = clone(forfeit.api.getCareer().unlocks);
  assert.strictEqual(forfeit.api.settle('forfeit'), true);
  assert.strictEqual(forfeit.api.getCareer().bankroll, 0);
  assert.strictEqual(forfeit.api.lastResult().outcome, 'forfeit');
  assert.strictEqual(forfeit.api.lastResult().prize, 0);
  assert.deepStrictEqual(clone(forfeit.api.getCareer().unlocks), beforeForfeit);
});

check('Second Chance first place never unlocks Pub Circuit or any other venue', ()=>{
  const { api } = makeContext(recoveryCareer(0));
  api.enter('second-chance');
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], false);
  assert.strictEqual(api.getCareer().unlocks['pub-open'], false);
  assert.strictEqual(api.getCareer().unlocks['back-room-freezeout'], true); // unchanged, not re-granted
  assert.strictEqual(api.state('pub-freezeout'), 'locked');
});

check('An already-active Second Chance stays resumable even if live eligibility later differs', ()=>{
  const { api } = makeContext(recoveryCareer(50));
  api.enter('second-chance');
  assert.strictEqual(api.state('second-chance'), 'active');
  // Bankroll cannot actually move while an event is active (no other route
  // touches it), but the active-first ordering must hold regardless: the
  // snapshot is never invalidated by a live bankroll read.
  api.getCareer().bankroll = 150;
  assert.strictEqual(api.state('second-chance'), 'active');
  const paidBankroll = api.getCareer().bankroll;
  api.resume();
  assert.strictEqual(api.getCareer().bankroll, paidBankroll); // no recharge on resume
});

check('Second Chance does not disturb Back Room or Pub Circuit event states', ()=>{
  const { api } = makeContext(recoveryCareer(50));
  assert.strictEqual(api.state('second-chance'), 'available');
  assert.strictEqual(api.state('back-room-freezeout'), 'unaffordable');
  assert.strictEqual(api.state('pub-freezeout'), 'locked');
  // And the reverse: once bankroll clears the recovery band, Back Room and
  // Pub read exactly as they did before Second Chance existed.
  const flush = makeContext(openCareer());
  assert.strictEqual(flush.api.state('second-chance'), 'hidden');
  assert.strictEqual(flush.api.state('back-room-freezeout'), 'available');
  assert.strictEqual(flush.api.state('pub-freezeout'), 'available');
});

check('The compact Career result summary renders a zero delta as $0, never +$0 or -$0', ()=>{
  const career = recoveryCareer(0);
  career.lastResult = {
    outcome:'loss', place:2, prize:0, eventId:'second-chance', eventName:'SECOND CHANCE',
    venue:'BACK ROOM', delta:0, bankroll:0
  };
  const { api, context } = makeContext(career);
  api.render();
  const html = context.$('career-last-result').innerHTML;
  assert.ok(html.includes('>$0<'), html);
  assert.ok(!html.includes('+$0'), html);
  assert.ok(!html.includes('-$0'), html);
  // A real gain and a real loss still carry their sign — this is a zero-only
  // exception, not a change to signed amounts.
  const gain = makeContext(Object.assign(recoveryCareer(150), {
    lastResult:{ outcome:'win', place:1, prize:150, eventId:'second-chance', eventName:'SECOND CHANCE', venue:'BACK ROOM', delta:150, bankroll:150 }
  }));
  gain.api.render();
  assert.ok(gain.context.$('career-last-result').innerHTML.includes('+$150'));
  const loss = makeContext(Object.assign(openCareer(), {
    lastResult:{ outcome:'loss', place:3, prize:0, eventId:'pub-freezeout', eventName:'PUB CIRCUIT FREEZEOUT', venue:'PUB CIRCUIT', delta:-300, bankroll:200 }
  }));
  loss.api.render();
  assert.ok(loss.context.$('career-last-result').innerHTML.includes('-$300'));
});

check('DEV bankroll control safely drives Second Chance boundaries without touching other Career state', ()=>{
  const initial = recoveryCareer(500);
  initial.lastResult = {
    outcome:'win', place:1, prize:300, eventId:'back-room-freezeout',
    eventName:'BACK ROOM FREEZEOUT', venue:'BACK ROOM', delta:300, bankroll:500
  };
  const { api, storage } = makeContext(initial);
  const unlocks = clone(api.getCareer().unlocks);
  const lastResult = clone(api.getCareer().lastResult);

  assert.strictEqual(api.setDevBankroll('99'), true);
  assert.strictEqual(api.getCareer().bankroll, 99);
  assert.strictEqual(storage.get('felt.career').bankroll, 99);
  assert.strictEqual(api.state('second-chance'), 'available');
  assert.deepStrictEqual(clone(api.getCareer().unlocks), unlocks);
  assert.deepStrictEqual(clone(api.getCareer().lastResult), lastResult);

  assert.strictEqual(api.setDevBankroll(100), true);
  assert.strictEqual(api.state('second-chance'), 'hidden');
  [99.5,-1,'',Infinity,Number.MAX_SAFE_INTEGER + 1].forEach(value=>{
    assert.strictEqual(api.setDevBankroll(value), false, String(value));
    assert.strictEqual(api.getCareer().bankroll, 100, String(value));
  });

  api.setDevMode(false);
  assert.strictEqual(api.setDevBankroll(0), false);
  assert.strictEqual(api.getCareer().bankroll, 100);
  api.setDevMode(true);
  api.setDevBankroll(50);
  api.enter('second-chance');
  assert.strictEqual(api.setDevBankroll(0), false);
  assert.strictEqual(api.getCareer().bankroll, 50);
});


/* ============================================================
   CAREER DIRECTORY — save schema v4 and the two aggregate counters.
   These are the ONLY records added: no event history, venue record,
   rival record, dossier or title (all Phase 13).
   ============================================================ */

check('Career save is version 4 and a fresh career starts both counters at zero', ()=>{
  const { api } = makeContext();
  assert.strictEqual(api.saveVersion, 4);
  const fresh = clone(api.getCareer());
  assert.strictEqual(fresh.v, 4);
  assert.strictEqual(fresh.eventsPlayed, 0);
  assert.strictEqual(fresh.eventsWon, 0);
  assert.strictEqual(fresh.bankroll, 500);
});

check('A version-3 save migrates to v4 with counters at zero and everything else verbatim', ()=>{
  const v3 = {
    v:3, bankroll:275,
    active:null,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':true,'pub-open':true,'second-chance':true},
    lastResult:{outcome:'cash',place:2,prize:450,eventId:'pub-open',eventName:'PUB CIRCUIT OPEN',venue:'PUB CIRCUIT',delta:450,bankroll:275}
  };
  const { api, storage } = makeContext(v3);
  const migrated = clone(api.getCareer());
  assert.strictEqual(migrated.v, 4);
  assert.strictEqual(migrated.eventsPlayed, 0);
  assert.strictEqual(migrated.eventsWon, 0);
  // Totals are NEVER inferred from lastResult, unlocks or lifetime stats.
  assert.strictEqual(migrated.bankroll, 275);
  assert.deepStrictEqual(clone(migrated.unlocks), v3.unlocks);
  assert.deepStrictEqual(clone(migrated.lastResult), v3.lastResult);
  // The migration persists exactly once, through the normal save path.
  assert.strictEqual(storage.get('felt.career').v, 4);
  assert.strictEqual(storage.get('felt.career').eventsPlayed, 0);
});

check('A version-3 active event stays resumable across the v4 migration', ()=>{
  const paid = makeContext(openCareer());
  paid.api.enter('pub-open');
  const carried = clone(paid.api.getCareer());
  const stale = Object.assign({}, carried, { v:3 });
  delete stale.eventsPlayed;
  delete stale.eventsWon;

  const { api, calls } = makeContext(stale);
  const migrated = clone(api.getCareer());
  assert.strictEqual(migrated.v, 4);
  assert.strictEqual(migrated.active.eventId, 'pub-open');
  assert.strictEqual(migrated.active.snapshot.buyIn, 300);
  assert.deepStrictEqual(migrated.active.snapshot.payouts, [1050,450]);
  assert.strictEqual(migrated.bankroll, carried.bankroll);   // never recharged
  api.resume();
  assert.strictEqual(calls.launches.length, 1);
  assert.strictEqual(api.getCareer().bankroll, carried.bankroll);
  // Resuming is not a new entry.
  assert.strictEqual(api.getCareer().eventsPlayed, 0);
});

check('Version-1 and version-2 saves migrate through to v4 intact', ()=>{
  const v1 = makeContext({v:1,bankroll:417,active:{eventId:'back-room-freezeout',buyIn:100,prize:300},lastResult:null});
  const one = clone(v1.api.getCareer());
  assert.strictEqual(one.v, 4);
  assert.strictEqual(one.bankroll, 417);
  assert.strictEqual(one.active.snapshot.buyIn, 100);
  assert.deepStrictEqual(one.active.snapshot.payouts, [300]);
  assert.strictEqual(one.eventsPlayed, 0);
  assert.strictEqual(one.eventsWon, 0);

  const v2 = makeContext({
    v:2, bankroll:650, active:null,
    unlocks:{'back-room-freezeout':true,'pub-freezeout':true},
    lastResult:{outcome:'win',delta:300,bankroll:650}
  });
  const two = clone(v2.api.getCareer());
  assert.strictEqual(two.v, 4);
  assert.strictEqual(two.bankroll, 650);
  assert.strictEqual(two.unlocks['pub-open'], true);   // equivalent-unlock rule survives
  assert.strictEqual(two.eventsPlayed, 0);
  assert.strictEqual(two.eventsWon, 0);
});

check('Counter normalisation rejects every unsafe stored value', ()=>{
  const { api } = makeContext();
  [0,1,7,1000].forEach(good=>assert.strictEqual(api.normalizeCounter(good), good, String(good)));
  [-1,-0.5,2.5,NaN,Infinity,-Infinity,'3',null,undefined,{},[],true,
   Number.MAX_SAFE_INTEGER + 1].forEach(bad=>{
    assert.strictEqual(api.normalizeCounter(bad), 0, String(bad));
  });
  // ...and a save carrying them is repaired rather than trusted.
  const dirty = makeContext({
    v:3, bankroll:500, active:null, eventsPlayed:-4, eventsWon:2.5,
    unlocks:{'back-room-freezeout':true}, lastResult:null
  });
  assert.strictEqual(dirty.api.getCareer().eventsPlayed, 0);
  assert.strictEqual(dirty.api.getCareer().eventsWon, 0);
});

check('A successful paid entry increments eventsPlayed exactly once', ()=>{
  const { api, storage } = makeContext(openCareer());
  assert.strictEqual(api.getCareer().eventsPlayed, 0);
  assert.strictEqual(api.enter('back-room-freezeout'), true);
  assert.strictEqual(api.getCareer().eventsPlayed, 1);
  assert.strictEqual(api.getCareer().eventsWon, 0);
  // The increment lands in the SAME persisted mutation as the debit and
  // the active event, so it can never desynchronise from either.
  const saved = storage.get('felt.career');
  assert.strictEqual(saved.eventsPlayed, 1);
  assert.strictEqual(saved.bankroll, 400);
  assert.strictEqual(saved.active.eventId, 'back-room-freezeout');
});

check('A free Second Chance entry also counts as played', ()=>{
  const { api } = makeContext(recoveryCareer(40));
  assert.strictEqual(api.enter('second-chance'), true);
  assert.strictEqual(api.getCareer().eventsPlayed, 1);
  assert.strictEqual(api.getCareer().bankroll, 40);   // free entry moves no money
});

check('Rejected entries never increment eventsPlayed', ()=>{
  // Unaffordable.
  const poor = makeContext(openCareer());
  poor.api.getCareer().bankroll = 10;
  assert.strictEqual(poor.api.enter('back-room-freezeout'), false);
  assert.strictEqual(poor.api.getCareer().eventsPlayed, 0);

  // Locked.
  const locked = makeContext(recoveryCareer(500));
  assert.strictEqual(locked.api.state('pub-open'), 'locked');
  assert.strictEqual(locked.api.enter('pub-open'), false);
  assert.strictEqual(locked.api.getCareer().eventsPlayed, 0);

  // Ineligible recovery.
  const rich = makeContext(recoveryCareer(500));
  assert.strictEqual(rich.api.enter('second-chance'), false);
  assert.strictEqual(rich.api.getCareer().eventsPlayed, 0);

  // Blocked by an event already active — the second entry adds nothing.
  const busy = makeContext(openCareer());
  busy.api.enter('back-room-freezeout');
  assert.strictEqual(busy.api.getCareer().eventsPlayed, 1);
  assert.strictEqual(busy.api.enter('pub-open'), false);
  assert.strictEqual(busy.api.getCareer().eventsPlayed, 1);

  // Unknown id.
  const missing = makeContext(openCareer());
  assert.strictEqual(missing.api.enter('no-such-event'), false);
  assert.strictEqual(missing.api.getCareer().eventsPlayed, 0);
});

check('Reloading an active event does not count it again', ()=>{
  const first = makeContext(openCareer());
  first.api.enter('back-room-freezeout');
  const persisted = clone(first.storage.get('felt.career'));
  assert.strictEqual(persisted.eventsPlayed, 1);

  const reloaded = makeContext(persisted);
  assert.strictEqual(reloaded.api.getCareer().eventsPlayed, 1);
  reloaded.api.resume();
  assert.strictEqual(reloaded.api.getCareer().eventsPlayed, 1);
});

check('A first-place settlement increments eventsWon exactly once', ()=>{
  const { api } = makeContext(openCareer());
  api.enter('back-room-freezeout');
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().eventsWon, 1);
  assert.strictEqual(api.getCareer().eventsPlayed, 1);
  // Repeated settlement is refused by the active guard, so it cannot
  // increment a second time.
  assert.strictEqual(api.settle({place:1}), false);
  assert.strictEqual(api.getCareer().eventsWon, 1);
});

check('Second Chance first place counts as a win', ()=>{
  const { api } = makeContext(recoveryCareer(40));
  api.enter('second-chance');
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().eventsWon, 1);
  assert.strictEqual(api.getCareer().bankroll, 190);
  // ...and still unlocks nothing.
  assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], false);
});

check('A cash, a bust and a forfeit never increment eventsWon', ()=>{
  const cash = makeContext(openCareer());
  cash.api.enter('pub-open');
  assert.strictEqual(cash.api.settle({place:2}), true);
  assert.strictEqual(cash.api.getCareer().lastResult.outcome, 'cash');
  assert.strictEqual(cash.api.getCareer().eventsWon, 0);
  assert.strictEqual(cash.api.getCareer().eventsPlayed, 1);

  const bust = makeContext(openCareer());
  bust.api.enter('back-room-freezeout');
  assert.strictEqual(bust.api.settle({place:3}), true);
  assert.strictEqual(bust.api.getCareer().eventsWon, 0);

  const quit = makeContext(openCareer());
  quit.api.enter('back-room-freezeout');
  assert.strictEqual(quit.api.settle('forfeit'), true);
  assert.strictEqual(quit.api.getCareer().lastResult.outcome, 'forfeit');
  assert.strictEqual(quit.api.getCareer().eventsWon, 0);
  assert.strictEqual(quit.api.getCareer().eventsPlayed, 1);   // it was still entered
});

check('Counters survive a full entry/settle cycle without disturbing money or unlocks', ()=>{
  const { api } = makeContext(recoveryCareer(500));
  assert.strictEqual(api.enter('back-room-freezeout'), true);
  assert.strictEqual(api.getCareer().bankroll, 400);
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().bankroll, 700);
  assert.strictEqual(api.getCareer().unlocks['pub-freezeout'], true);
  assert.strictEqual(api.getCareer().unlocks['pub-open'], true);
  assert.strictEqual(api.getCareer().eventsPlayed, 1);
  assert.strictEqual(api.getCareer().eventsWon, 1);
  assert.strictEqual(api.getCareer().active, null);
});

/* ---- the directory's presentation reads real state ---- */

check('Highest access is derived from live unlocks and never reads "none"', ()=>{
  assert.strictEqual(makeContext().api.highestAccess(), 'BACK ROOM');
  assert.strictEqual(makeContext(recoveryCareer(40)).api.highestAccess(), 'BACK ROOM');
  assert.strictEqual(makeContext(openCareer()).api.highestAccess(), 'PUB CIRCUIT');
});

check('The directory lists the six approved rooms and invents no catalogue entry', ()=>{
  const { api } = makeContext(openCareer());
  assert.strictEqual(api.rooms.map(room=>room.venue).join('|'),
    'BACK ROOM|PUB CIRCUIT|CARD CLUB|CASINO FLOOR|HIGH ROLLER ROOM|INVITATIONAL CHAMPIONSHIP');
  // The four unimplemented rooms are presentation only: no descriptor
  // exists for any of them, and the catalogue is still exactly four events.
  assert.strictEqual(api.events.length, 4);
  ['CARD CLUB','CASINO FLOOR','HIGH ROLLER ROOM','INVITATIONAL CHAMPIONSHIP'].forEach(venue=>{
    assert.strictEqual(api.roomEvents(venue).length, 0, venue);
    assert.ok(!api.events.some(event=>event.venue === venue), venue);
  });
  assert.strictEqual(api.roomEvents('PUB CIRCUIT').map(e=>e.id).join('|'), 'pub-freezeout|pub-open');
});

check('Within a room the free recovery event sorts above the paid one', ()=>{
  const { api } = makeContext(recoveryCareer(40));
  // Cheapest first, so Second Chance leads the Back Room.
  assert.strictEqual(api.roomEvents('BACK ROOM').map(e=>e.id).join('|'),
    'second-chance|back-room-freezeout');
  assert.strictEqual(api.entryLabel(api.eventById('second-chance')), 'FREE ENTRY');
  assert.strictEqual(api.entryLabel(api.eventById('back-room-freezeout')), '$100 ENTRY');
  assert.strictEqual(api.entryLabel(api.eventById('pub-open')), '$300 ENTRY');
});

check('Threat wording follows the real event difficulty', ()=>{
  const { api } = makeContext();
  assert.strictEqual(api.threatOf(api.eventById('back-room-freezeout')), 'MODERATE');
  assert.strictEqual(api.threatOf(api.eventById('second-chance')), 'MODERATE');
  assert.strictEqual(api.threatOf(api.eventById('pub-freezeout')), 'SERIOUS');
  assert.strictEqual(api.threatOf(api.eventById('pub-open')), 'SERIOUS');
});

check('Requirement copy states the real unlock and the real shortfall', ()=>{
  const locked = makeContext(recoveryCareer(500));
  assert.strictEqual(locked.api.requirementText(locked.api.eventById('pub-open'), 'locked'),
    'UNLOCKS BY WINNING BACK ROOM 3-HAND');

  const short = makeContext(openCareer());
  short.api.getCareer().bankroll = 80;
  assert.strictEqual(short.api.state('pub-open'), 'unaffordable');
  assert.strictEqual(short.api.requirementText(short.api.eventById('pub-open'), 'unaffordable'),
    'NEEDS $220 MORE THAN YOU HOLD');

  const open = makeContext(openCareer());
  assert.strictEqual(open.api.requirementText(open.api.eventById('back-room-freezeout'), 'available'),
    'OPEN TO YOU NOW');
  assert.strictEqual(open.api.requirementText(open.api.eventById('second-chance'), 'available'),
    'OPEN WHILE YOUR BANKROLL IS UNDER $100');

  const busy = makeContext(openCareer());
  busy.api.enter('back-room-freezeout');
  assert.strictEqual(busy.api.requirementText(busy.api.eventById('back-room-freezeout'), 'active'),
    'BUY-IN OF $100 IS STAKED');
  assert.strictEqual(busy.api.requirementText(busy.api.eventById('pub-open'), 'blocked'),
    'UNAVAILABLE WHILE AN EVENT IS ACTIVE');

  const free = makeContext(recoveryCareer(40));
  free.api.enter('second-chance');
  assert.strictEqual(free.api.requirementText(free.api.eventById('second-chance'), 'active'),
    'NO BUY-IN TAKEN');
});

check('The renderer reads live Career values rather than fixtures', ()=>{
  const { api, context, calls } = makeContext(openCareer());
  api.getCareer().eventsPlayed = 14;
  api.getCareer().eventsWon = 3;
  const setsBefore = calls.sets;
  api.render();
  assert.strictEqual(context.$('career-played').textContent, '14');
  assert.strictEqual(context.$('career-won').textContent, '3');
  assert.strictEqual(context.$('career-access').textContent, 'PUB CIRCUIT');
  // Rendering the board is pure presentation: it writes no save.
  assert.strictEqual(calls.sets, setsBefore);
  const board = context.$('career-events');
  ['BACK ROOM','PUB CIRCUIT','CARD CLUB','CASINO FLOOR','HIGH ROLLER ROOM','INVITATIONAL CHAMPIONSHIP']
    .forEach(venue=>assert.ok(board.innerHTML.indexOf(venue) !== -1, venue));
  assert.ok(board.innerHTML.indexOf('LOCKED &middot; COMING SOON') !== -1);
});

/* ---- event display names ---- */

check('Event titles are the short venue-relative labels, ids unchanged', ()=>{
  const { api } = makeContext();
  // The venue marker sits directly above the plaque, so the plaque prints
  // the short title. The Freezeout/Open distinction is gone: all four ARE
  // freezeouts, which is exactly why "Open" could not stay a title.
  assert.strictEqual(api.title(api.eventById('back-room-freezeout')), '3-HAND');
  assert.strictEqual(api.title(api.eventById('pub-freezeout')), '4-HAND');
  assert.strictEqual(api.title(api.eventById('pub-open')), '5-HAND');
  assert.strictEqual(api.title(api.eventById('second-chance')), 'SECOND CHANCE');
  // The save identifiers are untouched by the rename.
  assert.strictEqual(api.events.map(e=>e.id).sort().join('|'),
    'back-room-freezeout|pub-freezeout|pub-open|second-chance');
  // The venue-qualified record name is what a save and a settled result
  // still carry, because on its own "4-HAND" does not say where.
  assert.strictEqual(api.eventById('pub-freezeout').name, 'PUB CIRCUIT 4-HAND');
  assert.strictEqual(api.eventById('pub-open').name, 'PUB CIRCUIT 5-HAND');
  // Every event remains a freezeout and still says so.
  api.events.forEach(event=>assert.strictEqual(event.format, 'Freezeout'));
});

check('The closed plaque prints the title and the tray still states FREEZEOUT', ()=>{
  const { api } = makeContext(openCareer());
  const plaque = api.cassetteHTML(api.eventById('pub-open'), 'available');
  assert.ok(plaque.includes('>5-HAND<'), plaque);
  assert.ok(!plaque.includes('PUB CIRCUIT 5-HAND'), 'the venue is already above the plaque');
  assert.ok(plaque.includes('$300 ENTRY'));
  ['pub-freezeout','pub-open'].forEach(id=>{
    const tray = api.trayHTML(api.eventById(id), 'available');
    assert.ok(tray.includes('Format'), id);
    assert.ok(tray.includes('FREEZEOUT'), id);
  });
});

/* ---- roster integrity: the advertised table IS the played table ---- */

check('A drawn roster is a real, distinct field of the right size', ()=>{
  const { api } = makeContext(openCareer());
  const event = api.eventById('pub-open');
  const roster = api.rosterFor('pub-open');
  assert.strictEqual(roster.length, event.opponentCount);
  assert.strictEqual(new Set(roster.map(s=>s.personalityKey)).size, roster.length);
  assert.strictEqual(new Set(roster.map(s=>s.faceColorIdx)).size, roster.length);
  roster.forEach(seat=>{
    assert.ok(api.normalizeRoster([seat], {opponentCount:1}), 'seat must normalise');
  });
});

check('Re-rendering the directory never rerolls the advertised opponents', ()=>{
  const { api, calls } = makeContext(openCareer());
  const first = clone(api.rosterFor('pub-open'));
  const setsBefore = calls.sets;
  // Every way the directory can be repainted: a full render, an opened
  // tray, a closed tray, and a second look at the same event.
  api.render();
  const opened = api.trayHTML(api.eventById('pub-open'), 'available');
  api.render();
  api.trayHTML(api.eventById('pub-open'), 'available');
  api.render();
  assert.deepStrictEqual(clone(api.rosterFor('pub-open')), first);
  // ...and none of it wrote a save.
  assert.strictEqual(calls.sets, setsBefore);
  // The portraits the tray asked for are that same field, in seat order.
  const advertised = Array.from(opened.matchAll(/data-c="(\d+)"/g)).map(m=>Number(m[1]));
  assert.deepStrictEqual(advertised, first.map(seat=>seat.faceColorIdx));
});

check('Entering an event launches exactly the advertised opponents', ()=>{
  const { api, calls } = makeContext(openCareer());
  const advertisedHTML = api.trayHTML(api.eventById('pub-open'), 'available');
  const advertised = clone(api.rosterFor('pub-open'));
  assert.strictEqual(api.enter('pub-open'), true);
  api.start();
  // This is the guarantee the whole roster book exists for.
  assert.deepStrictEqual(clone(calls.launches[0].roster), advertised);
  assert.deepStrictEqual(clone(api.activeRoster()), advertised);
  const faces = Array.from(advertisedHTML.matchAll(/data-c="(\d+)"/g)).map(m=>Number(m[1]));
  assert.deepStrictEqual(faces, calls.launches[0].roster.map(seat=>seat.faceColorIdx));
});

check('A seated roster survives save, reload and resume', ()=>{
  const { api, storage } = makeContext(openCareer());
  const advertised = clone(api.rosterFor('pub-freezeout'));
  api.enter('pub-freezeout');
  // Durable, not merely in memory.
  assert.deepStrictEqual(clone(storage.get('felt.career').active.roster), advertised);
  // Reload: a fresh context over the stored save resumes the same field.
  const reloaded = makeContext(storage.get('felt.career'));
  assert.deepStrictEqual(clone(reloaded.api.activeRoster()), advertised);
  reloaded.api.resume();
  assert.deepStrictEqual(clone(reloaded.calls.launches[0].roster), advertised);
  assert.strictEqual(reloaded.api.getCareer().bankroll, api.getCareer().bankroll);
});

check('The seated field is retired with its event and a fresh one is drawn', ()=>{
  const { api } = makeContext(openCareer());
  const played = clone(api.rosterFor('back-room-freezeout'));
  api.enter('back-room-freezeout');
  // Seating it removes it from the book, so the directory is not still
  // advertising a field that is already at a table.
  assert.strictEqual(api.getCareer().rosters['back-room-freezeout'], undefined);
  assert.strictEqual(api.settle({place:1}), true);
  assert.strictEqual(api.getCareer().rosters['back-room-freezeout'], undefined);
  const next = clone(api.rosterFor('back-room-freezeout'));
  assert.strictEqual(next.length, played.length);
  // A new instance is a new field; it is not required to differ (the draw
  // is random), but it must be a valid, freshly stored one.
  assert.ok(api.normalizeRoster(api.getCareer().rosters['back-room-freezeout'],
    api.eventById('back-room-freezeout')));
});

check('Opening the Career screen persists fields; rendering it does not', ()=>{
  const { api, calls, storage } = makeContext(openCareer());
  const before = calls.sets;
  api.showScreen();
  // One write, for the fields drawn on this first visit.
  assert.strictEqual(calls.sets, before + 1);
  const stored = clone(storage.get('felt.career').rosters);
  assert.ok(Object.keys(stored).length >= 3, 'every visible event has a field');
  // A second visit has nothing new to draw and writes nothing.
  api.showScreen();
  assert.strictEqual(calls.sets, before + 1);
  // Neither does any number of renders or tray openings.
  api.render(); api.render();
  assert.strictEqual(calls.sets, before + 1);
  assert.deepStrictEqual(clone(storage.get('felt.career').rosters), stored);
});

check('A stored field survives a reload and is still what is advertised', ()=>{
  const { api, storage } = makeContext(openCareer());
  api.showScreen();
  const stored = clone(storage.get('felt.career').rosters);
  const reloaded = makeContext(storage.get('felt.career'));
  reloaded.api.showScreen();
  assert.deepStrictEqual(clone(reloaded.api.getCareer().rosters), stored);
  assert.deepStrictEqual(clone(reloaded.api.rosterFor('pub-open')), stored['pub-open']);
});

check('A malformed or stale field is rejected and redrawn, never trusted', ()=>{
  const { api } = makeContext(openCareer());
  const event = api.eventById('pub-open');   // four seats
  const good = api.rosterFor('pub-open');
  [
    null, undefined, {}, [], 'roster',
    good.slice(0,2),                                                  // wrong size
    good.concat([{personalityKey:'rock',faceColorIdx:1}]),            // too many
    [{personalityKey:'nobody',faceColorIdx:0},{personalityKey:'rock',faceColorIdx:1},
     {personalityKey:'shark',faceColorIdx:2},{personalityKey:'maniac',faceColorIdx:3}],
    [{personalityKey:'rock',faceColorIdx:0},{personalityKey:'rock',faceColorIdx:1},
     {personalityKey:'shark',faceColorIdx:2},{personalityKey:'maniac',faceColorIdx:3}],
    [{personalityKey:'rock',faceColorIdx:0},{personalityKey:'grinder',faceColorIdx:0},
     {personalityKey:'shark',faceColorIdx:2},{personalityKey:'maniac',faceColorIdx:3}],
    [{personalityKey:'rock',faceColorIdx:0},{personalityKey:'grinder',faceColorIdx:1},
     {personalityKey:'shark',faceColorIdx:2},{personalityKey:'maniac',faceColorIdx:999}],
    [{personalityKey:'rock',faceColorIdx:0},{personalityKey:'grinder',faceColorIdx:1},
     {personalityKey:'shark',faceColorIdx:2},{personalityKey:'maniac',faceColorIdx:1.5}]
  ].forEach((bad,i)=>assert.strictEqual(api.normalizeRoster(bad, event), null, 'case ' + i));

  // A stale entry in the book is discarded and a valid field drawn.
  api.getCareer().rosters['pub-open'] = [{personalityKey:'rock',faceColorIdx:0}];
  const redrawn = api.rosterFor('pub-open');
  assert.strictEqual(redrawn.length, 4);
  assert.ok(api.normalizeRoster(redrawn, event));
  // A field belonging to no catalogue event is swept up on the next visit.
  api.getCareer().rosters['a-room-that-never-shipped'] = redrawn;
  api.materializeRosters();
  assert.strictEqual(api.getCareer().rosters['a-room-that-never-shipped'], undefined);
});

check('Rosters are additive: a stored career without them is still valid', ()=>{
  // A real, fully valid v4 save written before this pass. It has no
  // rosters key at all and must NOT be routed through migration — this
  // was an additive field, not a version bump. (openCareer() deliberately
  // omits the second-chance unlock and so is NOT valid; it is a migration
  // fixture. This one carries every catalogue key.)
  const preRoster = openCareer({'back-room-freezeout':true,'pub-freezeout':true,
    'pub-open':true,'second-chance':true});
  const { api, calls } = makeContext(preRoster);
  assert.strictEqual(calls.sets, 0, 'a valid v4 save is not rewritten on load');
  assert.strictEqual(api.getCareer().rosters, undefined, 'nothing is invented at load');
  assert.strictEqual(api.getCareer().v, api.saveVersion);
  assert.strictEqual(api.getCareer().bankroll, 500);
  // The field is simply drawn on the next visit.
  assert.ok(api.rosterFor('back-room-freezeout'));
  // And a stored book of malformed fields never invalidates the save.
  const junk = makeContext(Object.assign(openCareer(), { rosters:{ 'pub-open':'nonsense' } }));
  assert.strictEqual(junk.api.getCareer().bankroll, 500);
  assert.strictEqual(junk.api.rosterFor('pub-open').length, 4);
});

/* ---- machine theme vs venue identity ---- */

check('No venue material can follow the player machine theme', ()=>{
  const css = fs.readFileSync(path.join(root, 'css/06-machine-system.css'), 'utf8');
  const from = css.indexOf('/* ---- 2. HOUSE DIRECTORY');
  assert.ok(from > 0, 'the house directory block must exist');
  const block = css.slice(from);
  // Every palette token that follows the selected machine theme. A venue's
  // authored identity must not resolve through any of them — the separation
  // is asserted here rather than left to whichever theme happens to be
  // active while someone is looking at the screen.
  const themed = ['--theme-','--pc-','--accent','--felt','--panel','--bg-','--ink-','--card-','--danger'];
  Array.from(block.matchAll(/var\((--[a-z0-9-]+)/g)).forEach(match=>{
    const token = match[1];
    assert.ok(!themed.some(prefix=>token.startsWith(prefix)),
      'the venue directory must not read the themed token ' + token);
    assert.ok(token.startsWith('--h-') || token === '--font-hdr' || token === '--radius',
      'unexpected token in the venue directory: ' + token);
  });
  // And the player instrument must still be theme-derived, so switching
  // theme visibly changes something.
  const cpi = css.slice(css.indexOf('/* ---- 1. PLAYER INSTRUMENT'), from);
  assert.ok(cpi.includes('var(--pc-plastic)'));
  assert.ok(cpi.includes('var(--theme-rim)'));
  // The Career screen must not sit inside the shared themed cabinet, which
  // is what used to tint every venue with the player's palette.
  const cabinet = css.slice(css.indexOf('/* ---- The cabinet ----'), css.indexOf('/* ---- Cabinet top rail'));
  assert.ok(!cabinet.includes('#career .lobby-card'), '#career must own its own construction');
});

check('newGame seats exactly the roster it is handed', ()=>{
  const { api } = makeContext(openCareer());
  const advertised = clone(api.rosterFor('pub-open'));
  const table = makeTableContext('Tester');
  table.newGame({ mode:'career', difficulty:'hard', opponents:4, stack:750,
    blindLevel:0, roster:advertised });
  const opponents = table.getGame().players.filter(p=>!p.isHuman);
  assert.strictEqual(opponents.length, 4);
  // Joined rather than deep-compared: these arrays are built inside the
  // table's own VM realm, so deepStrictEqual would fail on prototype
  // identity alone even when every value matches.
  assert.strictEqual(opponents.map(p=>p.personality.key).join('|'),
    advertised.map(s=>s.personalityKey).join('|'));
  assert.strictEqual(opponents.map(p=>p.faceColorIdx).join('|'),
    advertised.map(s=>s.faceColorIdx).join('|'));
  // Same roster, built again: still the same table. Without a roster the
  // two draws are independent, which is the defect this pass removes.
  table.newGame({ mode:'career', difficulty:'hard', opponents:4, stack:750,
    blindLevel:0, roster:advertised });
  const again = table.getGame().players.filter(p=>!p.isHuman);
  assert.strictEqual(again.map(p=>p.personality.key).join('|'),
    advertised.map(s=>s.personalityKey).join('|'));
  assert.strictEqual(again.map(p=>p.faceColorIdx).join('|'),
    advertised.map(s=>s.faceColorIdx).join('|'));
  // Table stakes are untouched by the roster.
  assert.strictEqual(table.getGame().startingStack, 750);
  assert.strictEqual(table.getGame().players.length, 5);
});

check('A table with no roster keeps the original random draw', ()=>{
  const table = makeTableContext();
  // Every non-Career caller passes no roster and must be unaffected.
  [null, undefined, [], [{personalityKey:'rock',faceColorIdx:0}],
   [{personalityKey:'nobody',faceColorIdx:0},{personalityKey:'rock',faceColorIdx:1},
    {personalityKey:'shark',faceColorIdx:2}],
   [{personalityKey:'rock',faceColorIdx:null},{personalityKey:'shark',faceColorIdx:1},
    {personalityKey:'maniac',faceColorIdx:2}]
  ].forEach((roster,i)=>{
    assert.strictEqual(table.launchRoster(roster, 3), null, 'case ' + i);
    table.newGame({ mode:'tournament', difficulty:'medium', opponents:3, stack:500,
      blindLevel:0, roster });
    const opponents = table.getGame().players.filter(p=>!p.isHuman);
    // A rejected roster must never leave a seat without a persona or a
    // colour — it falls back to the ordinary draw in full.
    assert.strictEqual(opponents.length, 3, 'case ' + i);
    opponents.forEach(p=>{
      assert.ok(p.personality && typeof p.personality.key === 'string', 'case ' + i);
      assert.ok(Number.isInteger(p.faceColorIdx), 'case ' + i);
    });
    assert.strictEqual(new Set(opponents.map(p=>p.faceColorIdx)).size, 3, 'case ' + i);
  });
});

check('Production never loads the Career Lab', ()=>{
  const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ['career-lab.css','career-lab.js','career-lab.html'].forEach(file=>{
    assert.ok(!indexSource.includes(file), 'index.html must not load ' + file);
    assert.ok(!swSource.includes(file), 'the app shell must not cache ' + file);
  });
  // The directory's own construction ships in the production stylesheet.
  const machineSource = fs.readFileSync(path.join(root, 'css/06-machine-system.css'), 'utf8');
  ['.cdir{','.cdir-cassette{','.cdir-tray{','.cpi{'].forEach(rule=>
    assert.ok(machineSource.includes(rule), rule));
});

process.stdout.write('\n' + passed + ' focused Career event checks passed.\n');
