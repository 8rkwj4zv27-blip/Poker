#!/usr/bin/env node
'use strict';

/* ============================================================
   RESIDENTS — identity, persistence, dossier and UI wiring

   The companion to resident-behaviour-checks.js. That file proves the
   five play differently; this one proves they are the SAME five people
   every time, that saving and resuming does not lose or swap them, that
   nothing private leaks into what the player is shown, and that the two
   new surfaces are wired into the machine rather than bolted beside it.
   ============================================================ */

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const clean=url=>url.split('?')[0];

/* Values crossing back from a vm context carry that realm's prototypes,
   so deepStrictEqual would reject two identical arrays. Everything
   compared structurally goes through this first. */
function plain(v){ return v==null ? v : JSON.parse(JSON.stringify(v)); }

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }
function slice(source,start,end){
  const a=source.indexOf(start), b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,'source slice '+start);
  return source.slice(a,b);
}

const residentsSrc=read('js/03-residents.js');
const opponentsSrc=read('js/03-opponents.js');
const engineSrc=read('js/05-game-engine.js');
const modesSrc=read('js/04-modes-and-scoring.js');
const wiringSrc=read('js/07-ui-wiring.js');
const presentationSrc=read('js/06-presentation.js');
const devSrc=read('js/08-dev-mode.js');
const html=read('index.html');

/* ---- the registry, loaded on its own -------------------------------- */
function loadRegistry(){
  const ctx={console,JSON,Math};
  ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(residentsSrc,ctx,{filename:'js/03-residents.js'});
  vm.runInContext('globalThis.reg={RESIDENTS,RESIDENT_PERSONAS,residentById,residentPersonaById,'+
    'residentOf,personalityByKey,isKnownPersonalityKey,personaPoker,personaTemperament,'+
    'dossierModel,DOSSIER_MODEL_KEYS,RESIDENT_NEUTRAL_POKER};',ctx);
  return ctx.reg;
}
const reg=loadRegistry();
const IDS=['harry','tony','lucy','nigel','steve'];

/* ---- a table that can be built, saved and restored ------------------ */
/* The REAL newGame/serializeTable/restoreTable, so persistence is tested
   against production rather than a re-implementation of it. */
function makeTable(opts){
  const ctx={console,JSON,Math,Date};
  ctx.globalThis=ctx;
  ctx.BLIND_LEVELS=[[10,20],[15,30],[25,50],[50,100]];
  ctx.TOURNAMENT_HANDS_PER_LEVEL=10;
  ctx.ELIMINATION_CONFIG={startingStack:1000,smallBlind:10,bigBlind:20,
    shortStackBB:8,criticalStackBB:5,foldGateWidenPerBB:0.018};
  ctx.CAREER_CASH_CONFIG={id:'back-room-cash',stack:50,residentReserve:100,opponentCount:3};
  ctx.SAVE_VERSION=1;
  ctx.DIFFICULTY_PARAMS={easy:1,medium:1,hard:1,expert:1,elite:1};
  ctx.FACE_MOOD_POOLS={neutral:1,positive:1,confident:1,irritated:1,nervous:1,uncertain:1,shock:1};
  ctx.normalizeOpponentCount=n=>n;
  ctx.settings=Object.assign({playerName:'You',opponentNames:'persona',lives:false},opts&&opts.settings);
  vm.createContext(ctx);
  vm.runInContext('var game=null;',ctx);
  vm.runInContext(slice(read('js/01-poker-math.js'),'function shuffle(deck){','function cardKey'),ctx);
  vm.runInContext(slice(read('js/02-support-systems.js'),'const FACE_COLORS = [','/* One entry per art batch'),ctx);
  vm.runInContext(slice(read('js/02-support-systems.js'),'function assignFaceColors(players){','function faceHue'),ctx);
  vm.runInContext(residentsSrc,ctx,{filename:'js/03-residents.js'});
  vm.runInContext(slice(opponentsSrc,'const PERSONALITIES_ALL = [','const RANDOM_FIRST_NAMES'),ctx);
  vm.runInContext(slice(opponentsSrc,'const RANDOM_FIRST_NAMES','const DIFFICULTY_PARAMS'),ctx);
  vm.runInContext('function clamp01(x){ return Math.max(0, Math.min(1, x)); }',ctx);
  vm.runInContext(slice(engineSrc,'function makePlayer(','/* ---------------- table save/resume ----------------'),ctx);
  vm.runInContext(slice(engineSrc,'function serializeTable(g){','function isValidTableSave'),ctx);
  vm.runInContext(slice(engineSrc,'function restoreTable(save){','function isValidEventReward('),ctx);
  vm.runInContext(slice(modesSrc,'function careerRosterSeats(event){','/* Second Chance'),ctx);
  vm.runInContext('globalThis.t={newGame,serializeTable,restoreTable,FACE_COLORS,'+
    'personalityByKey,isKnownPersonalityKey,PERSONALITIES_ALL,'+
    'generateCareerRoster,normalizeCareerRoster,careerSeatName,getGame:()=>game,setGame:g=>{game=g;}};',ctx);
  return ctx.t;
}

/* ============================================================
   IDENTITY
   ============================================================ */

check('Exactly one canonical identity exists per resident',()=>{
  assert.deepStrictEqual(plain(reg.RESIDENTS.map(r=>r.name)),['Harry','Tony','Lucy','Nigel','Steve']);
  assert.strictEqual(new Set(reg.RESIDENTS.map(r=>r.id)).size,5);
  reg.RESIDENTS.forEach(r=>{
    ['id','name','style','blurb','voice','rest'].forEach(f=>
      assert.ok(typeof r[f]==='string'&&r[f],r.id+' is missing '+f));
    assert.ok(Number.isInteger(r.faceColorIdx),r.id+' has no permanent colour');
    assert.ok(Array.isArray(r.tendencies)&&r.tendencies.length>=3,r.id+' needs tendency copy');
    assert.ok(r.moods&&Object.keys(r.moods).length>=5,r.id+' needs an expression vocabulary');
    assert.ok(r.poker&&r.temperament,r.id+' needs a poker profile');
  });
  /* No second cast anywhere. The chatter prototype used to hold its own
     copy; nothing may hold one again. This is a whole-repo grep, not a
     spot check, so a new duplicate is caught wherever it is written. */
  const files=['js/02-support-systems.js','js/03-opponents.js','js/04-modes-and-scoring.js',
    'js/05-game-engine.js','js/06-presentation.js','js/07-ui-wiring.js','js/08-dev-mode.js',
    'js/chatter/01-residents.js','index.html'];
  files.forEach(f=>{
    const src=read(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
    IDS.forEach(id=>{
      const name=id[0].toUpperCase()+id.slice(1);
      assert.ok(!src.includes("'"+name+"'")&&!src.includes('"'+name+'"'),
        f+' must not author the name '+name+' — the registry owns it');
    });
  });
});

check('Portrait colours are permanent, unique, and real palette entries',()=>{
  const t=makeTable();
  const colours=reg.RESIDENTS.map(r=>r.faceColorIdx);
  assert.strictEqual(new Set(colours).size,5,'two residents share a colour');
  colours.forEach(idx=>assert.ok(idx>=0&&idx<t.FACE_COLORS.length,'colour out of palette: '+idx));
  // The persona carries the same colour the record does, so seating can
  // never introduce a second opinion about who is what colour.
  reg.RESIDENT_PERSONAS.forEach(p=>
    assert.strictEqual(p.faceColorIdx,reg.residentById(p.residentId).faceColorIdx));
  // Documented permanent assignment. If one of these ever has to change,
  // it is a deliberate act that breaks this check first.
  assert.deepStrictEqual(plain(reg.RESIDENTS.map(r=>r.id+':'+r.faceColorIdx)),
    ['harry:0','tony:5','lucy:3','nigel:1','steve:4']);
});

check('Every resident expression resolves to art that actually ships',()=>{
  /* A resident is a name plus a selection from art that already ships.
     A typo in a mood key would silently fall back to a generic face and
     quietly cost that character their expression vocabulary, so every
     key is resolved to a real FACE_ART entry AND a real file on disk. */
  const ctx={console,JSON,Math};
  vm.createContext(ctx);
  const support=read('js/02-support-systems.js');
  const a=support.indexOf('const FACE_ART = {'), b=support.indexOf('};',a)+2;
  vm.runInContext(support.slice(a,b)+'\nglobalThis.ART=FACE_ART;',ctx);
  const ART=ctx.ART;
  let checked=0;
  reg.RESIDENTS.forEach(r=>{
    const keys=[r.rest].concat(Object.keys(r.moods).map(k=>r.moods[k]));
    keys.forEach(key=>{
      assert.ok(ART[key],r.id+' names an expression that does not exist: '+key);
      assert.ok(fs.existsSync(path.join(root,ART[key])),
        r.id+"'s "+key+' art is missing from disk: '+ART[key]);
      checked++;
    });
  });
  assert.ok(checked>=40,'expected a full expression vocabulary per resident, saw '+checked);
  // Their resting faces are distinct: five characters, five neutrals.
  assert.strictEqual(new Set(reg.RESIDENTS.map(r=>r.rest)).size,5,
    'the five must not share one neutral face');
  // And the dossier portrait wears it rather than the generic idle art.
  assert.ok(wiringSrc.includes("renderFace(seat, model.rest || 'idle')"),
    'a dossier portrait must wear the resident\'s own resting face');
});

check('A resident key never collides with a legacy archetype key',()=>{
  // Resolved in the full context, where both the registry and the legacy
  // archetype list exist — the lookup is deliberately late-bound because
  // PERSONALITIES_ALL loads after the registry does.
  const t=makeTable();
  reg.RESIDENT_PERSONAS.forEach(p=>{
    assert.ok(p.key.indexOf('res:')===0,'resident keys must be namespaced: '+p.key);
    assert.strictEqual(t.personalityByKey(p.key).residentId,p.residentId);
  });
  t.PERSONALITIES_ALL.forEach(a=>{
    assert.ok(a.key.indexOf('res:')!==0,'an archetype key must never look like a resident');
    assert.strictEqual(t.personalityByKey(a.key).key,a.key,'legacy keys must still resolve');
  });
  assert.strictEqual(t.personalityByKey('nobody'),null);
  assert.strictEqual(t.personalityByKey('res:nobody'),null);
  assert.ok(t.isKnownPersonalityKey('res:harry')&&t.isKnownPersonalityKey('rock'));
  assert.ok(!t.isKnownPersonalityKey('res:nobody'));
});

check('A visitor keeps exactly the pre-pass archetype behaviour',()=>{
  // Every dial neutral is what guarantees this pass changed the five
  // residents and nobody else.
  const n=reg.RESIDENT_NEUTRAL_POKER;
  assert.deepStrictEqual(plain(n),{entryBias:0,raiseDrive:1,callTolerance:0,pressureRespect:1,
    drawPersistence:1,trapChance:0,positionSensitivity:1,shortStackDrive:1,gearRange:0});
  const t=makeTable();
  t.PERSONALITIES_ALL.forEach(a=>{
    assert.deepStrictEqual(plain(reg.personaPoker(a)),plain(n),
      a.key+' must fall through to the neutral profile');
    assert.strictEqual(reg.personaTemperament(a).moodGain,1);
    assert.strictEqual(reg.personaTemperament(a).moodDecay,0.75);
  });
});

/* ============================================================
   SEATING AND PERSISTENCE
   ============================================================ */

check('Every supported table size seats unique residents first',()=>{
  const t=makeTable();
  // Custom Game 1-8, the elimination run's 4/5/6 and every Career field
  // are all covered by this range.
  for (let n=1;n<=8;n++){
    for (let trial=0;trial<25;trial++){
      t.newGame({mode:'cash',opponents:n,difficulty:'medium',stack:1000,blindLevel:0});
      const g=t.getGame();
      const ai=g.players.filter(p=>!p.isHuman);
      assert.strictEqual(ai.length,n,'wrong field size at '+n);
      const residents=ai.filter(p=>p.personality.residentId);
      assert.strictEqual(residents.length,Math.min(n,5),'cast must seat first at '+n);
      assert.strictEqual(new Set(residents.map(p=>p.personality.residentId)).size,residents.length,
        'a resident was seated twice at '+n);
      assert.strictEqual(new Set(ai.map(p=>p.faceColorIdx)).size,n,'colour clash at '+n);
      residents.forEach(p=>assert.strictEqual(p.faceColorIdx,
        reg.residentById(p.personality.residentId).faceColorIdx,'a resident was recoloured'));
    }
  }
});

check('A resident is never shown under an alias, whatever the name setting',()=>{
  const t=makeTable({settings:{opponentNames:'random'}});
  t.newGame({mode:'cash',opponents:6,difficulty:'medium',stack:1000,blindLevel:0});
  const ai=t.getGame().players.filter(p=>!p.isHuman);
  ai.forEach(p=>{
    const res=reg.residentById(p.personality.residentId);
    if (res) assert.strictEqual(p.name,res.name,'a resident was aliased: '+p.name);
  });
  // ...and the visitor seats DO still honour the setting, unchanged.
  const visitors=ai.filter(p=>!p.personality.residentId);
  assert.strictEqual(visitors.length,1);
  assert.notStrictEqual(visitors[0].name,visitors[0].personality.name,
    'random names must still apply to a visitor');
});

check('A saved table restores exactly the same residents',()=>{
  const t=makeTable();
  t.newGame({mode:'cash',opponents:5,difficulty:'hard',stack:1000,blindLevel:0});
  const before=t.getGame().players.map(p=>({name:p.name,colour:p.faceColorIdx,
    resident:p.personality?p.personality.residentId:null,key:p.personality?p.personality.key:null}));
  const save=JSON.parse(JSON.stringify(t.serializeTable(t.getGame())));
  save.players.filter(p=>!p.isHuman).forEach(p=>assert.ok(p.residentId,'residentId must be persisted'));
  t.restoreTable(save);
  const after=t.getGame().players.map(p=>({name:p.name,colour:p.faceColorIdx,
    resident:p.personality?p.personality.residentId:null,key:p.personality?p.personality.key:null}));
  assert.deepStrictEqual(plain(after),plain(before),'resume seated a different table');
  // A hand-edited or stale colour cannot recolour a resident on resume.
  const tampered=JSON.parse(JSON.stringify(save));
  tampered.players.filter(p=>p.residentId).forEach(p=>{ p.faceColorIdx=7; });
  t.restoreTable(tampered);
  t.getGame().players.filter(p=>!p.isHuman&&p.personality.residentId).forEach(p=>
    assert.strictEqual(p.faceColorIdx,reg.residentById(p.personality.residentId).faceColorIdx));
});

check('A legacy save loads safely and keeps its legacy opponents',()=>{
  const t=makeTable();
  t.newGame({mode:'cash',opponents:3,difficulty:'hard',stack:1000,blindLevel:0});
  const save=JSON.parse(JSON.stringify(t.serializeTable(t.getGame())));
  // Exactly what a table saved before this pass looks like: archetype
  // keys, no residentId, names as they were written.
  save.namesMode='persona';
  const legacyKeys=['shark','professor','grinder'];
  save.players.filter(p=>!p.isHuman).forEach((p,i)=>{
    delete p.residentId;
    p.personalityKey=legacyKeys[i];
    p.name=t.personalityByKey(legacyKeys[i]).name;
  });
  t.restoreTable(save);
  const ai=t.getGame().players.filter(p=>!p.isHuman);
  assert.strictEqual(ai.length,3,'a legacy save must still load');
  ai.forEach((p,i)=>{
    assert.strictEqual(p.personality.key,legacyKeys[i],'a legacy table was re-cast');
    assert.strictEqual(p.personality.residentId,undefined,'a legacy seat must not become a resident');
    assert.ok(Number.isInteger(p.faceColorIdx),'a legacy seat lost its colour');
  });
  // A save naming nobody at all still produces a playable table.
  const empty=JSON.parse(JSON.stringify(save));
  empty.players.forEach(p=>{ delete p.residentId; p.personalityKey=null; });
  t.restoreTable(empty);
  assert.strictEqual(t.getGame().players.length,4);
});

check('A Career roster is a resident field, and a legacy one is left alone',()=>{
  const t=makeTable();
  const event={id:'pub-open',opponentCount:4,playerCount:5,
    rosterResidents:['harry','tony','lucy','nigel']};
  const roster=t.generateCareerRoster(event);
  assert.deepStrictEqual(plain(roster.map(s=>s.residentId)),['harry','tony','lucy','nigel']);
  roster.forEach(s=>assert.strictEqual(s.faceColorIdx,reg.residentById(s.residentId).faceColorIdx));
  assert.deepStrictEqual(plain(t.normalizeCareerRoster(roster,event)),plain(roster),'a valid field must survive');
  assert.deepStrictEqual(plain(roster.map(s=>t.careerSeatName(s))),['Harry','Tony','Lucy','Nigel']);
  // An uncurated field still draws the cast, never a duplicate.
  const open={id:'x',opponentCount:3,playerCount:4};
  for (let i=0;i<40;i++){
    const drawn=t.generateCareerRoster(open);
    assert.strictEqual(new Set(drawn.map(s=>s.residentId)).size,3);
    assert.strictEqual(new Set(drawn.map(s=>s.faceColorIdx)).size,3);
  }
  // Two of the same person is refused outright.
  assert.strictEqual(t.normalizeCareerRoster([
    {residentId:'harry',personalityKey:'res:harry',faceColorIdx:0},
    {residentId:'harry',personalityKey:'res:harry',faceColorIdx:2},
    {residentId:'lucy', personalityKey:'res:lucy', faceColorIdx:3}
  ],open),null,'a duplicated resident must be rejected');
  // A pre-residents advertised field is still valid and is NOT re-cast:
  // an event already entered is a paid term.
  const legacy=[{personalityKey:'shark',faceColorIdx:2},
                {personalityKey:'grinder',faceColorIdx:6},
                {personalityKey:'rock',faceColorIdx:7}];
  const normalized=t.normalizeCareerRoster(legacy,open);
  assert.deepStrictEqual(plain(normalized.map(s=>s.personalityKey)),['shark','grinder','rock']);
  assert.deepStrictEqual(plain(normalized.map(s=>s.residentId)),[null,null,null]);
});

check('The unpaid preview book refreshes, and the paid field never does',()=>{
  const migrate=slice(wiringSrc,'  if (raw.rosters && typeof raw.rosters','  if (raw.unlocks');
  assert.ok(migrate.includes('roster.some(seat=>!seat.residentId)'),
    'the preview book must drop pre-residents fields');
  // normalizeActiveCareerEvent (which owns career.active.roster) must NOT
  // carry that rule: the seated field is a paid term.
  const active=slice(wiringSrc,'function withCareerRoster(','function normalizeCareerLastResult');
  assert.ok(!active.includes('residentId'),
    'the seated, paid roster must never be re-cast on load');
  // ...and nothing in the migration touches money or progression.
  ['bankroll +=','unlocks[','eventsWon','eventsPlayed','champion'].forEach(token=>
    assert.ok(!migrate.includes(token),'the roster migration must not touch '+token));
  // The save schema does not move for any of this.
  assert.ok(read('js/02-support-systems.js').includes('const SAVE_VERSION = 1;'),
    'bumping SAVE_VERSION would delete every table in progress');
  assert.ok(wiringSrc.includes('const CAREER_SAVE_VERSION = 6;'),
    'the Career schema needs no bump for an optional roster field');
});

/* ============================================================
   THE DOSSIER — one model, nothing private in it
   ============================================================ */

check('The dossier model is shared, complete, and public-only',()=>{
  const keys=plain(reg.DOSSIER_MODEL_KEYS).sort();
  reg.RESIDENTS.forEach(r=>{
    const m=reg.dossierModel(r);
    assert.deepStrictEqual(plain(Object.keys(m).sort()),keys,'unexpected dossier shape for '+r.id);
    assert.strictEqual(m.residentId,r.id);
    assert.strictEqual(m.name,r.name);
    assert.strictEqual(m.faceColorIdx,r.faceColorIdx);
    assert.strictEqual(m.visitor,false);
    assert.ok(m.blurb.length>20&&m.tendencies.length>=3);
    // Plain language only: no numbers, no percentages, no weights.
    m.tendencies.concat([m.style]).forEach(line=>
      assert.ok(!/\d/.test(line),'tendency copy must print no numbers: '+line));
  });
  /* THE ANTI-TELL CHECK. Nothing about the hand, the odds, the AI's
     intent or its dials may appear in what the player is shown. */
  const forbidden=['hand','cards','equity','bluff','aggression','tightness','poker',
    'moodState','perceived','decision','trapChance','raiseDrive','entryBias'];
  reg.RESIDENTS.forEach(r=>{
    const json=JSON.stringify(reg.dossierModel(r)).toLowerCase();
    forbidden.forEach(f=>assert.ok(!json.includes('"'+f+'"'),
      'the dossier must not expose '+f));
  });
  // Comments stripped first: this is about what the code READS, and a
  // prose mention of "mid-hand" is not a hidden-information leak.
  const model=slice(residentsSrc,'function dossierModel(subject){','/* The one public-mood word')
    .replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  ['.hand','.cards','equity','bluff','_handRes','moodState','.poker','.temperament',
   '.aggression','.tightness'].forEach(t=>
    assert.ok(!model.includes(t),'dossierModel must not read '+t));
});

check('The menu and the live table print the same dossier for the same person',()=>{
  const t=makeTable();
  t.newGame({mode:'cash',opponents:5,difficulty:'hard',stack:1000,blindLevel:0});
  t.getGame().players.filter(p=>!p.isHuman).forEach(p=>{
    const res=reg.residentById(p.personality.residentId);
    if (!res) return;
    const fromTable=reg.dossierModel(p);
    const fromMenu=reg.dossierModel(res);
    // Everything except the live public-mood line must be identical.
    delete fromTable.mood; delete fromMenu.mood;
    assert.deepStrictEqual(plain(fromTable),plain(fromMenu),'the two surfaces disagree about '+res.id);
  });
  // ...and there is exactly one renderer behind both.
  const renderers=(wiringSrc.match(/function dossierCardHTML\(/g)||[]).length;
  assert.strictEqual(renderers,1,'there must be one dossier renderer, not two');
  assert.ok(wiringSrc.includes('detail.innerHTML = dossierCardHTML(')&&
            wiringSrc.includes('body.innerHTML = dossierCardHTML('),
    'both surfaces must render through it');
});

check('A visitor gets a public label and no borrowed continuity',()=>{
  const visitor=reg.dossierModel({key:'grinder',name:'Grinder'});
  assert.strictEqual(visitor.residentId,null);
  assert.strictEqual(visitor.visitor,true);
  assert.ok(visitor.style&&visitor.style!=='Visitor'||visitor.style==='Visitor');
  assert.ok(/passing through/i.test(visitor.blurb),'a visitor must be marked as passing through');
  assert.ok(visitor.tendencies.length>0,'a visitor still gets a public impression');
  reg.RESIDENTS.forEach(r=>assert.notStrictEqual(visitor.blurb,r.blurb,
    'a visitor must never borrow a resident biography'));
});

check('Visible mood is read from faceMood alone, never from gameplay mood',()=>{
  const moodFn=slice(residentsSrc,'function dossierMood(player){','if (typeof globalThis');
  assert.ok(moodFn.includes('player.faceMood'),'the dossier mood must come from faceMood');
  assert.ok(!moodFn.includes('moodState')&&!moodFn.includes('hand')&&!moodFn.includes('equity'),
    'the dossier mood must read nothing else');
  const fake={isHuman:false,personality:reg.RESIDENT_PERSONAS[0],faceColorIdx:0,
    faceMood:{family:'nervous',intensity:0.8},moodState:{kind:'steamed',intensity:1},hand:['A','K']};
  const m=reg.dossierModel(fake);
  assert.strictEqual(m.mood,'Uneasy');
  fake.faceMood={family:'neutral',intensity:0};
  assert.strictEqual(reg.dossierModel(fake).mood,'Settled');
  // The two mood systems keep their deliberately different field names.
  assert.ok(opponentsSrc.includes('p.moodState = { kind, intensity: amount }'));
  assert.ok(opponentsSrc.includes('p.faceMood = { family: fam, intensity: clamp01(intensity) }'));
  // No path from the visible face into the decision.
  const decide=slice(opponentsSrc,'async function aiDecide(player, g){','/* How long an AI');
  ['faceMood','faceMoodOf','_faceKey','setMood'].forEach(t=>
    assert.ok(!decide.includes(t),'aiDecide must never read '+t));
});

/* ============================================================
   PERSONALITY VS DIFFICULTY
   ============================================================ */

check('Difficulty and personality remain separate axes',()=>{
  // Difficulty still owns exactly its three knobs, unchanged.
  const dp=slice(opponentsSrc,'const DIFFICULTY_PARAMS = {','/* ============================================================\n   TABLE TALK');
  ['easy','medium','hard','expert','elite'].forEach(d=>assert.ok(dp.includes(d+':')));
  assert.strictEqual((dp.match(/iterations:/g)||[]).length,5);
  assert.strictEqual((dp.match(/noise:/g)||[]).length,5);
  assert.strictEqual((dp.match(/positionWeight:/g)||[]).length,5);
  const decide=slice(opponentsSrc,'async function aiDecide(player, g){','/* How long an AI');
  // Personality never touches simulation quality or decision noise.
  assert.ok(/dp\.iterations/.test(decide)&&!/dp\.iterations\s*\*/.test(decide),
    'personality must not scale simulation quality');
  assert.ok(/dp\.noise/.test(decide)&&!/dp\.noise\s*\*/.test(decide),
    'personality must not scale decision noise');
  // The one legitimate meeting point, and it multiplies rather than replaces.
  assert.ok(decide.includes('dp.positionWeight * prof.positionSensitivity'),
    'position must be difficulty accuracy times personality sensitivity');
  // The dials are applied at the decision points, not as one cosmetic
  // multiplier at the end: each appears next to the gate it belongs to.
  ['prof.entryBias','prof.raiseDrive','prof.callTolerance','prof.pressureRespect',
   'prof.drawPersistence','prof.trapChance','prof.shortStackDrive']
    .forEach(t=>assert.ok(decide.includes(t),'a dial is not wired in: '+t));
  const tail=decide.slice(decide.lastIndexOf("return {action:'call'};"));
  assert.ok(!/prof\./.test(tail),'no dial may be applied after the decision is made');
});

check('Position weighting actually functions',()=>{
  // seatsAfter must exclude players who have already acted, or the
  // positional term is identically zero in every ordinary hand and the
  // whole difficulty position ladder does nothing.
  const fn=slice(opponentsSrc,'function seatsAfter(playerIdx){','function clamp01');
  assert.ok(fn.includes('!p.acted'),'seatsAfter must count only players still to act');
  assert.ok(fn.includes('p.inHand')&&fn.includes('!p.folded')&&fn.includes('!p.allIn'));
  // `acted` is existing maintained state, not a new field.
  assert.ok(engineSrc.includes('player.acted = true;'));
  assert.ok(engineSrc.includes('p.acted=false; p.mayRaise=true;'));
});

/* ============================================================
   THE TWO NEW SURFACES
   ============================================================ */

check('The House Faces screen is wired in like every other screen',()=>{
  assert.ok(html.includes('<div id="opponents" class="screen hidden">'));
  assert.ok(html.includes('id="opponents-back"')&&html.includes('id="cast-rail"')&&
            html.includes('id="cast-detail"'));
  /* Present in EVERY screen-switch block, or it lingers on top of the
     table. There is no central showScreen() in this codebase — each
     handler hides the other screens by hand — so this walks every block
     that hides #rankings and requires the same block to say something
     about #opponents: hide it, or (in showOpponentsScreen) reveal it. */
  const lines=wiringSrc.split('\n');
  let blocks=0;
  lines.forEach((line,i)=>{
    if (!/\$\('rankings'\)\.classList\.add\('hidden'\);/.test(line)) return;
    blocks++;
    const near=lines.slice(Math.max(0,i-8),i+9).join('\n');
    assert.ok(/\$\('opponents'\)\.classList\.(add|remove)\('hidden'\);/.test(near),
      'a screen-switch block near line '+(i+1)+' does not handle #opponents');
  });
  assert.ok(blocks>=5,'expected every screen-switch block to be found, saw '+blocks);
  assert.ok(wiringSrc.includes("$('opponents').classList.remove('hidden')"));
  assert.ok(devSrc.includes("$('opponents-back').onclick")&&devSrc.includes('reconstructMainMenu()'));
  // Its own scroll shell — there is no shared one to join.
  const screens=read('css/02-screens.css');
  assert.ok(/#opponents\{[^}]*overflow-y:auto/.test(screens),'#opponents needs its own scroll shell');
  assert.ok(/#opponents\{[^}]*env\(safe-area-inset-bottom\)/.test(screens));
});

check('Both new surfaces join the machine visual system rather than inventing one',()=>{
  const machine=read('css/06-machine-system.css');
  /* The physical-cabinet treatment for secondary screens is a set of
     hand-enumerated selector lists. A screen that clones #awards markup
     but is missing from these lists renders in the older, flatter
     language — which is exactly how a "helpful" new panel quietly
     becomes a second design system. */
  [['#opponents,','the machine token block'],
   ['#opponents .lobby-card,','the cabinet'],
   ['#opponents .setup-head,','the printed top rail'],
   ['#opponents .setup-title,','the rail title'],
   ['#opponents .panel-card,','the recessed plates'],
   ['#opponents .card-label,','the printed headings'],
   ['#opponents .card-label::after,','the heading seam rule'],
   ['#opponents .hint,','body copy'],
   ['#opponents .icon-btn,','the back key']].forEach(([sel,what])=>
    assert.ok(machine.includes(sel),'#opponents is missing from '+what));
  [['#dossier-sheet .sheet-body,','the sheet cabinet'],
   ['#dossier-sheet .sheet-section,','the sheet plates'],
   ['#dossier-sheet .card-label,','the printed headings'],
   ['#dossier-sheet .btn-secondary,','the close key']].forEach(([sel,what])=>
    assert.ok(machine.includes(sel),'#dossier-sheet is missing from '+what));
  // The cast drawer joins the approved menu press family, at its travel.
  assert.ok(machine.includes('#home .pc-cast-drawer{')&&
            machine.includes('#home .pc-cast-drawer:active{'));
  assert.ok(/#home \.pc-cast-drawer:active\{[^}]*translateY\(3px\)/.test(machine),
    'the drawer press must stay inside the approved four pixels');
  /* And the Career printed-TICKET roster stays on the ticket: .cdir-hf is
     painted in paper colours that must not travel to a machine panel. */
  const screens=read('css/02-screens.css');
  const screenRules=screens.replace(/\/\*[\s\S]*?\*\//g,'');   // rules, not prose
  ['cdir-hf','cdir-seat','cdir-faces'].forEach(cls=>
    assert.ok(!screenRules.includes(cls)&&!html.includes('class="'+cls),
      'the printed-ticket roster class '+cls+' must not leave the Career ticket'));
  // The new tiles restate the House Faces drawer's own construction.
  assert.ok(screens.includes('.cast-chip-face{')&&screens.includes('.dossier-portrait{'));
  assert.ok((screens.match(/background:#13281C; border:3px solid #090806/g)||[]).length>=2,
    'the new portrait tiles must use the cast drawer construction');
});

check('The cast drawer is the way in, and no new menu button was added',()=>{
  assert.ok(html.includes('class="pc-cast-drawer" id="open-opponents" role="button" tabindex="0"'),
    'the existing House Faces drawer must be the affordance');
  assert.ok(html.includes('aria-label="House Faces'),'the drawer needs an accessible name');
  assert.ok(!/<button[^>]*id="open-opponents"/.test(html),
    'the drawer must stay a div — a real button drags UA styling into a hand-built component');
  assert.ok(html.includes('id="hero-faces" aria-hidden="true"'),
    'the decorative face row must stay decorative');
  // The main menu's control bay is untouched.
  const bay=slice(html,'<div class="pc-control-bay pc-recess">','<!-- ============================ HAND RANKINGS');
  ['open-career','go-to-setup','quick-play','open-rankings','open-awards']
    .forEach(id=>assert.ok(bay.includes('id="'+id+'"'),'the menu lost '+id));
  assert.ok(!bay.includes('opponents'),'no new button may be added to the control bay');
  assert.ok(devSrc.includes("const castDrawer = $('open-opponents')")&&
            devSrc.includes('Spacebar'),'a role=button div needs its own key handling');
});

check('A live opponent seat is an accessible target that changes nothing',()=>{
  assert.ok(presentationSrc.includes('class="seat-card seat-dossier-target" role="button" tabindex="0"'),
    'the full seat must provide a dependable interactive target');
  assert.ok(presentationSrc.includes('opponent dossier'),'the target needs an accessible name');
  // Only opponents, and only opening a sheet.
  const seat=slice(presentationSrc,'    if (!p.isHuman){\n      const target',
    "    const avatar = root.querySelector('.avatar');");
  assert.ok(seat.includes('openDossier(p.id, target)'));
  assert.ok(seat.includes("addEventListener('click'")&&seat.includes("addEventListener('keydown'"),
    'the seat needs both pointer and keyboard activation');
  assert.ok(seat.includes("e.key === 'Enter'")&&seat.includes("e.preventDefault()"),
    'Space must activate without scrolling the page');
  ['humanAct','applyAction','currentIndex','pendingHumanPlayer','saveTable','nextHand']
    .forEach(t=>assert.ok(!seat.includes(t),'opening a dossier must not touch '+t));
  // The seat's visible markup and geometry are untouched apart from the hook.
  ['<div class="turn-ring"></div>','<div class="pos-btn hidden"></div>','<span class="seat-name">']
    .forEach(t=>assert.ok(presentationSrc.includes(t),'the seat markup changed: '+t));
  assert.ok(presentationSrc.includes("const avatarW = Math.round(78*scale);"),
    'seat and portrait sizing must be untouched');
  /* The focus ring is drawn ON the avatar rather than as the global
     outline, which sits outside the element and would collide with a
     six-opponent seat frame whose interior padding is only 1px. */
  const screens=read('css/02-screens.css');
  assert.ok(screens.includes('.seat .seat-dossier-target:focus-visible .avatar{'));
  assert.ok(screens.includes('.seat .seat-dossier-target:focus-visible{ outline:none; }'));
  assert.ok(read('css/05-responsive-and-arcade.css').includes('.felt.opponents-6 .seat-card{ padding:1px'),
    'the tight six-opponent seat padding this avoids must still exist');
});

check('The dossier opens and closes through the established overlay contract',()=>{
  assert.ok(html.includes('id="dossier-sheet" role="dialog" aria-modal="true"')&&
            html.includes('aria-label="Opponent dossier" aria-hidden="true" inert'));
  assert.ok(html.includes('id="dossier-body"')&&html.includes('id="close-dossier"'));
  // Both branches, or it opens and never closes.
  assert.ok(wiringSrc.includes("if (which==='dossier'){")&&
            wiringSrc.includes("sheet.removeAttribute('inert')"));
  assert.ok(wiringSrc.includes("$('dossier-sheet').classList.remove('open');"));
  assert.ok(wiringSrc.includes("$('dossier-sheet').setAttribute('inert','')")&&
            wiringSrc.includes("$('dossier-sheet').setAttribute('aria-hidden','true')"),
    'the closed dossier must leave the accessibility tree');
  assert.ok(devSrc.includes("$('close-dossier').onclick = closeOverlays;"));
  assert.ok(devSrc.includes("$('scrim').onclick = closeOverlays;"),'backdrop dismissal must remain');
  // Escape, and focus returning to the portrait that opened it.
  assert.ok(devSrc.includes("e.key === 'Escape' && anyOverlayOpen()"));
  assert.ok(wiringSrc.includes('function releaseDossierFocus()')&&
            wiringSrc.includes('dossierReturnFocus'));
  // Opening writes nothing to the player and submits no action.
  const open=slice(wiringSrc,'function openDossier(playerId, returnFocusEl){','// Gates a "start a new table"');
  ['humanAct','applyAction','p.chips','saveTable','nextHand','currentIndex']
    .forEach(t=>assert.ok(!open.includes(t),'openDossier must not touch '+t));
  assert.ok(open.includes('player.isHuman) return;'),'the human seat has no dossier');
  assert.ok(open.includes('dossierReadingMoment()')&&open.includes('dossierPresentationBusy()'),
    'the dossier must wait for a stable, player-owned reading moment');
  assert.ok(wiringSrc.includes('DealFX.activeCount()')&&
            wiringSrc.includes('activeChipFlightCount()')&&
            wiringSrc.includes('showdownRailAnimations.size'),
    'card, chip and showdown ownership must all gate the sheet');
});

check('Resident face vocabularies drive the live table, with visitors unchanged',()=>{
  assert.ok(opponentsSrc.includes('const res = residentOf(p);')&&
            opponentsSrc.includes("residentFace(p, role, res.rest)"),
    'baseline public mood must resolve through the resident face map');
  ['pleased','smug','sly','cross','wound','rattled','wild'].forEach(role=>
    assert.ok(opponentsSrc.includes("'"+role+"'"),'production never requests resident role '+role));
  assert.ok(opponentsSrc.includes('const pool = faceMoodPool(m.family, m.intensity);'),
    'visitors must retain the existing generic mood pool');
});

check('House Faces updates selection in place and retains focus',()=>{
  const select=slice(wiringSrc,'function selectCastResident(id){','function showOpponentsScreen');
  assert.ok(select.includes("chip.classList.toggle('active',on)")&&
            select.includes("chip.setAttribute('aria-pressed'"));
  assert.ok(!select.includes('renderOpponentsScreen()'),
    'rebuilding the rail destroys the selected control and keyboard focus');
});

check('An open menu can no longer submit a poker action',()=>{
  /* Required by the dossier — it is opened mid-hand by design — and it
     closes a pre-existing hole: with Settings open, typing "f" folded. */
  const keys=slice(devSrc,'  // keyboard shortcuts','  window.addEventListener');
  assert.ok(keys.includes('if (anyOverlayOpen()) return;'),'the shortcut guard is missing');
  assert.ok(keys.indexOf('if (anyOverlayOpen()) return;')<keys.indexOf("e.key==='f'"),
    'the guard must precede every action shortcut');
  const pred=slice(wiringSrc,'function anyOverlayOpen(){','function closeOverlays()');
  ["scrim","confirm-dialog","first-run"].forEach(t=>
    assert.ok(pred.includes(t),'the overlay predicate must cover '+t));
});

/* ---- the two surfaces, actually rendered ----------------------------
   Grepping the wiring proves it is connected; running it proves it does
   not throw and produces the markup the CSS is written against. The real
   renderFace() is used, so a portrait that could not be built here could
   not be built on the phone either. */
function makeRenderer(){
  const ctx={console,JSON,Math};
  ctx.globalThis=ctx;
  ctx.settings={faces:true,theme:'emerald'};
  ctx.DEV_MODE=false;
  vm.createContext(ctx);
  const support=read('js/02-support-systems.js');
  // The production portrait pipeline, in its own order: the art tables,
  // the palette and both tint tables, then the colour resolvers and
  // renderFace itself. No stubs — a portrait that cannot be built here
  // could not be built on the phone either.
  vm.runInContext(slice(support,'const FACE_ART = {','const FACE_JOLT_MOODS'),ctx);
  vm.runInContext(slice(support,'const FACE_COLORS = [','function installFaceTintFilters'),ctx);
  vm.runInContext(slice(support,'function faceHue(p){','function faceImgFallback'),ctx);
  vm.runInContext(slice(read('js/06-presentation.js'),'function esc(s){','function cardInner'),ctx);
  vm.runInContext(residentsSrc,ctx,{filename:'js/03-residents.js'});
  // The renderer block owns its own `castSelectedId`, so it is loaded as
  // written rather than pre-declared.
  vm.runInContext(slice(wiringSrc,'function dossierPortraitHTML(model, cls){',
    '/* ---- In-game portrait dossier ----'),ctx);
  vm.runInContext('globalThis.r={dossierCardHTML,dossierModel,RESIDENTS};',ctx);
  return ctx.r;
}

check('Every resident renders a complete dossier card',()=>{
  const r=makeRenderer();
  r.RESIDENTS.forEach(res=>{
    const model=r.dossierModel(res);
    const cardHtml=r.dossierCardHTML(model);
    assert.ok(cardHtml.includes('class="dossier"'),res.id+' produced no card');
    assert.ok(cardHtml.includes('class="dossier-portrait"'),res.id+' produced no portrait');
    assert.ok(cardHtml.includes('<img'),res.id+' produced no face image');
    assert.ok(cardHtml.includes('>'+res.name+'<'),res.id+' is unnamed on its own card');
    assert.ok(cardHtml.includes(res.style),res.id+' has no public style line');
    res.tendencies.forEach(t=>assert.ok(cardHtml.includes(t),res.id+' dropped a tendency: '+t));
    assert.ok((cardHtml.match(/<li>/g)||[]).length===res.tendencies.length);
    // A menu card has no live mood line — there is no table to read.
    assert.ok(!cardHtml.includes('dossier-mood'),'a menu card must show no table mood');
    /* Nothing PRIVATE reaches the markup. Deliberately field names and
       internals, not English words: "Bluffs more often than the rest of
       them" is exactly the plain-language impression the player is meant
       to get, while `bluffFreq` is the number they must never see. */
    ['bluffFreq','aggression','tightness','entryBias','raiseDrive','trapChance',
     'pressureRespect','drawPersistence','positionSensitivity','gearRange',
     'equity','perceived','moodState','faceMood']
      .forEach(t=>assert.ok(!cardHtml.includes(t),res.id+' leaked '+t));
    assert.ok(!/\d+(\.\d+)?%/.test(cardHtml),res.id+' printed a percentage');
    // Balanced markup: as many opening divs as closing ones.
    assert.strictEqual((cardHtml.match(/<div/g)||[]).length,(cardHtml.match(/<\/div>/g)||[]).length,
      res.id+' produced unbalanced markup');
  });
});

check('A live seat and a visitor both render, and the mood line is public',()=>{
  const r=makeRenderer();
  const seat={ isHuman:false, name:'Lucy', faceColorIdx:3,
    personality:{key:'res:lucy',residentId:'lucy',name:'Lucy'},
    faceMood:{family:'irritated',intensity:0.7},
    moodState:{kind:'steamed',intensity:1}, hand:[{rank:'A'},{rank:'K'}] };
  const live=r.dossierCardHTML(r.dossierModel(seat));
  assert.ok(live.includes('dossier-mood')&&live.includes('Irritated'),
    'a live seat must show its public mood');
  ['steamed','equity','moodState','bluffFreq','aggression'].forEach(t=>
    assert.ok(!live.includes(t),'the live card leaked '+t));
  assert.ok(!live.includes('faceMood'),'the live card must print no internal state');
  const visitor={ isHuman:false, name:'Reese', faceColorIdx:2,
    personality:{key:'grinder',name:'Grinder'}, faceMood:{family:'neutral',intensity:0} };
  const card=r.dossierCardHTML(r.dossierModel(visitor));
  assert.ok(card.includes('Reese'),'a visitor is shown under the name at the table');
  assert.ok(/passing through/i.test(card),'a visitor must be marked as passing through');
  assert.ok(card.includes('class="dossier-portrait"')&&card.includes('<img'));
  r.RESIDENTS.forEach(res=>assert.ok(!card.includes(res.blurb),
    'a visitor must not borrow a resident biography'));
});

check('The build and offline cache markers identify this pass',()=>{
  assert.ok(read('js/02-support-systems.js')
    .includes("const BUILD_VERSION = 'v0.33.1-dev · Enemy Personalities'"));
  assert.ok(read('sw.js').includes("const CACHE_NAME = 'poker-v33-1'"));
  // The registry must be both loaded and cached, in the right order.
  const scripts=(html.match(/<script src="([^"]+)"/g)||[]).map(x=>clean(x.match(/src="([^"]+)/)[1]));
  assert.deepStrictEqual(plain(scripts),[
    'js/01-poker-math.js','js/02-support-systems.js','js/03-residents.js','js/03-opponents.js',
    'js/04-modes-and-scoring.js','js/05-game-engine.js','js/06-presentation.js',
    'js/07-ui-wiring.js','js/08-dev-mode.js'
  ]);
  assert.ok(read('sw.js').includes("'./js/03-residents.js'"),'the registry must be cached offline');
});

process.stdout.write('\n'+passed+' resident identity and surface checks passed.\n');
