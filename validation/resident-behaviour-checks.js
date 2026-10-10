#!/usr/bin/env node
'use strict';

/* ============================================================
   RESIDENT BEHAVIOUR — seeded, paired simulation

   The Enemy Personality pass is only real if the five residents make
   MEASURABLY different decisions. This file is the evidence.

   METHOD, and why it is fair:

   1. Every trial deals one hole/board from a seeded shuffle, so the
      whole run is reproducible.
   2. The trial's equity is computed ONCE and lands in EquityService's
      own cache before any resident is asked to act.
   3. Each resident then decides the SAME hand, in the SAME spot, with
      the random stream reset to the SAME seed. The cached equity means
      nobody consumes randomness computing it, so all five draw the same
      noise, the same bluff roll and the same raise roll.

   That makes this a paired comparison: any difference in the tallies is
   caused by the tendency dials and by nothing else. It also means the
   assertions can be honest inequalities with real margins rather than
   brittle percentages.

   No Worker exists in node, so EquityService falls through to its own
   inline estimateEquity path — the production code, not a stub.
   ============================================================ */

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

let passed=0;
function check(name,fn){ fn(); passed++; process.stdout.write('PASS  '+name+'\n'); }

/* ---- the sandbox -------------------------------------------------- */
const ctx={console,JSON,Math:Object.create(Math),setTimeout,clearTimeout,Promise};
ctx.globalThis=ctx; ctx.window=ctx;
// The real published values (js/04-modes-and-scoring.js), restated here
// rather than sliced: this file exercises the AI, not the format table.
ctx.ELIMINATION_CONFIG={startingStack:500,smallBlind:10,bigBlind:20,
  shortStackBB:8,criticalStackBB:5,foldGateWidenPerBB:0.018};
ctx.settings={tableTalk:false,speed:'normal'};
ctx.DEV_MODE=false; ctx.FAST_DEV=false; ctx.FAST_DEV_TIME_MULT=1; ctx.QUICK_RESOLVE_TIME_MULT=1;
ctx.quickResolveActive=()=>false; ctx.motionOff=()=>true;
vm.createContext(ctx);
vm.runInContext('var game=null;',ctx);
['js/01-poker-math.js','js/03-residents.js','js/03-opponents.js']
  .forEach(f=>vm.runInContext(read(f),ctx,{filename:f}));
vm.runInContext('globalThis.api={aiDecide,RESIDENTS,RESIDENT_PERSONAS,residentPersonaById,' +
  'pickTableCast,publicDrawStrength,nudgeMood,residentGear,createDeck,shuffle,estimateEquity,' +
  'EquityService,DIFFICULTY_PARAMS,RANK_VALUES,setGame:g=>{game=g;}};',ctx);
const api=ctx.api;

/* A small, explicit LCG. Reset before each resident's decision so all
   five face an identical random stream. */
let seed=1;
function reseed(n){ seed=(n>>>0)||1; }
ctx.Math.random=function(){ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };

const IDS=['harry','tony','lucy','nigel','steve'];
const persona=id=>api.residentPersonaById(id);

/* ---- table construction ------------------------------------------- */
/* Position is modelled the way the production read actually works:
   seatsAfter() counts live opponents who have NOT yet acted this round,
   so `actedAhead` marks that many opponents as already having acted.
   Everyone stays in the hand either way, which keeps numOpp — and
   therefore the equity — identical between the two position fixtures.
   The only thing that changes is how many players are still to come. */
function buildTable(opts){
  const players=[];
  const n=opts.players||4;
  for (let i=0;i<n;i++){
    players.push({ id:'p'+i, isHuman:i===0, chips:opts.stack, hand:[],
      inHand:true, folded:false, allIn:false, eliminated:false, acted:false,
      betThisRound:0, totalBetHand:0, mayRaise:true, personality:null, moodState:null });
  }
  const g={ players, board:opts.board, pot:opts.pot, currentBet:opts.currentBet,
    minRaise:opts.bigBlind, bigBlind:opts.bigBlind, difficulty:opts.difficulty,
    mode:opts.mode||'cash', handNumber:opts.handNumber||0, event:null };
  return g;
}

/* One battery: every resident decides every trial's hand, in the same
   spot, from the same random stream. Returns a tally per resident. */
async function battery(spec){
  const deck=api.createDeck();
  const tally={};
  IDS.forEach(id=>{ tally[id]={ n:0, fold:0, call:0, check:0, aggro:0,
    bluff:0, aggroEquity:0, foldEquity:0, contEquity:0, cont:0, sizes:[],
    hi:{n:0,aggro:0}, lo:{n:0,aggro:0} }; });
  reseed(spec.seed||7);
  for (let t=0; t<spec.trials; t++){
    const d=api.shuffle(deck);
    const deal=spec.deal ? spec.deal(d,t) : { hole:[d[0],d[1]], board:d.slice(2,2+spec.boardSize) };
    if (!deal) continue;
    // handNumber varies per trial: a gear seeded from a frozen hand number
    // would never change, which would hide exactly the variation this file
    // exists to measure.
    const g=buildTable(Object.assign({board:deal.board,handNumber:t},spec.table));
    const seatIdx=g.players.length-1;
    for (let i=1;i<g.players.length;i++){
      if (i!==seatIdx) g.players[i].acted = i <= (spec.actedAhead||0);
    }
    api.setGame(g);
    const numOpp=g.players.length-1;
    const iters=api.DIFFICULTY_PARAMS[spec.table.difficulty].iterations;
    // Warm the cache BEFORE anyone acts, so the decision itself consumes
    // no randomness on equity and every resident is paired.
    const equity=await api.EquityService.get(deal.hole,deal.board,Math.max(1,numOpp),iters);
    for (const id of IDS){
      const p=g.players[seatIdx];
      p.personality=persona(id);
      p.hand=deal.hole;
      p.chips=spec.table.stack;
      p.betThisRound=spec.table.betThisRound||0;
      p.totalBetHand=spec.table.totalBetHand||0;
      p.mayRaise=true;
      p.moodState=null;
      // Routed through the production nudgeMood so each resident's own
      // temperament decides how far a public event actually moves them.
      if (spec.mood) api.nudgeMood(p, spec.mood.kind, spec.mood.intensity);
      delete p._gear; delete p._gearHand;
      reseed(100000+t);
      const decision=await api.aiDecide(p,g);
      const toCall=Math.max(0,g.currentBet-p.betThisRound);
      assertLegal(decision,p,g,toCall,id);
      const s=tally[id];
      s.n++;
      // Split by the hand's gear so a gear-driven change in aggression can
      // be seen directly. Everyone but Steve has gear 0 and lands in `lo`,
      // which is exactly the point: their two halves are identical.
      const half=(p._gear||0)>0 ? s.hi : s.lo;
      half.n++;
      if (decision.action==='bet'||decision.action==='raise') half.aggro++;
      if (decision.action==='fold'){ s.fold++; s.foldEquity+=equity; }
      else if (decision.action==='call'){ s.call++; s.cont++; s.contEquity+=equity; }
      else if (decision.action==='check') s.check++;
      else {
        s.aggro++; s.aggroEquity+=equity; s.cont++; s.contEquity+=equity;
        if (equity<0.35) s.bluff++;
        s.sizes.push((decision.amount-p.betThisRound)/Math.max(1,g.pot));
      }
    }
  }
  return tally;
}

/* Every returned action must be one a dealer would accept. Checked on
   EVERY decision in every battery, not sampled. */
function assertLegal(decision,p,g,toCall,id){
  assert.ok(decision&&typeof decision.action==='string','no decision from '+id);
  const allInTotal=p.betThisRound+p.chips;
  if (decision.action==='check') assert.strictEqual(toCall,0,id+' checked facing a bet');
  if (decision.action==='bet'||decision.action==='raise'){
    assert.ok(Number.isFinite(decision.amount),id+' wagered a non-number');
    assert.ok(decision.amount>p.betThisRound,id+' wagered nothing');
    assert.ok(decision.amount<=allInTotal,id+' wagered more than its stack');
    const minLegal=g.currentBet+g.minRaise;
    assert.ok(decision.amount>=minLegal||decision.amount===allInTotal,
      id+' made an under-minimum raise that was not an all-in');
    assert.strictEqual(decision.action, toCall>0?'raise':'bet', id+' mislabelled its wager');
  }
  if (decision.action==='call') assert.ok(p.chips>0,id+' called with no chips');
}

const rate=(s,k)=>s.n?s[k]/s.n:0;
/* How much of a resident's playing range a harder spot removes.

   Raw fold-rate gaps are useless for comparing five players with five
   different baselines: Tony folds almost nothing to a third-pot bet, so
   ANY tightening looks enormous for him, and Nigel folds so much already
   that he has little left to give up. The contraction ratio — what
   fraction of the hands he kept in the easy spot he still keeps in the
   hard one — is scale-free and compares them fairly. 0 means unmoved,
   1 means he gave the whole range up. */
function contraction(easy,hard){
  const e=easy.n?(easy.n-easy.fold)/easy.n:0;
  const h=hard.n?(hard.n-hard.fold)/hard.n:0;
  return e>0 ? 1-(h/e) : 0;
}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
function stdev(a){ if (a.length<2) return 0; const m=mean(a); return Math.sqrt(mean(a.map(v=>(v-m)*(v-m)))); }
function pct(x){ return (x*100).toFixed(1)+'%'; }

/* ---- the scenario batteries --------------------------------------- */
const BB=20;
const results={};

async function run(){
  /* 1. Unopened preflop, four-handed, facing only the big blind. The
        purest read on entry width and raise propensity. */
  results.preflopOpen=await battery({ trials:190, seed:11, boardSize:0,
    table:{ players:4, stack:1000, pot:30, currentBet:BB, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 2. The same seat facing a raise to three big blinds. */
  results.facingRaise=await battery({ trials:190, seed:23, boardSize:0,
    table:{ players:4, stack:1000, pot:90, currentBet:BB*3, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 3 & 4. The identical preflop spot from the button and from early
        position. The pair is what isolates position sensitivity. */
  /* Three-handed on purpose: the point of this pair is resolution, and
     four- or five-handed unopened equities sit so far below every fold
     gate that the tightest residents have almost no hands left to move.
     Three-handed puts all five in a measurable band, and the two
     fixtures differ ONLY in how many opponents are still to act. */
  results.button=await battery({ trials:170, seed:31, boardSize:0, actedAhead:1,
    table:{ players:3, stack:1000, pot:30, currentBet:BB, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });
  results.early=await battery({ trials:170, seed:31, boardSize:0, actedAhead:0,
    table:{ players:3, stack:1000, pot:30, currentBet:BB, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 5. A dry pair-versus-overcards flop, checked to them. Unopened, so
        this is where trapping and probing show up. */
  const dryBoard=['9h','7d','2s'];
  results.dryFlop=await battery({ trials:170, seed:43, boardSize:3,
    deal:(d)=>{
      const board=cards(dryBoard);
      const hole=d.filter(c=>!board.some(b=>b.rank===c.rank&&b.suit===c.suit)).slice(0,2);
      return { hole, board };
    },
    table:{ players:3, stack:1000, pot:120, currentBet:0, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 6. A genuinely strong made hand in an unopened pot: a set on the same
        dry board. Betting is obviously right, so a check here is a trap. */
  results.strongMade=await battery({ trials:120, seed:57, boardSize:3,
    deal:(d,t)=>{
      const board=cards(dryBoard);
      const setRank=(t%2)?'9':'7';
      const suits=['♠','♥','♦','♣'].filter(s=>!board.some(b=>b.rank===setRank&&b.suit===s));
      const hole=[card(setRank+suitLetter(suits[0])),card(setRank+suitLetter(suits[1]))];
      return { hole, board };
    },
    table:{ players:3, stack:1000, pot:120, currentBet:0, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 7. A live flush draw facing a half-pot bet. */
  results.draw=await battery({ trials:150, seed:61, boardSize:3,
    deal:(d,t)=>{
      const board=[card('K♥'),card('8♥'),card('2♠')];
      const hearts=['A','Q','J','10','9','7','6','5','4','3']
        .map(r=>card(r+'♥')).filter(c=>!board.some(b=>b.rank===c.rank&&b.suit===c.suit));
      const hole=[hearts[t%hearts.length],hearts[(t+3)%hearts.length]];
      if (hole[0].rank===hole[1].rank) return null;
      return { hole, board };
    },
    table:{ players:3, stack:1000, pot:200, currentBet:100, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 8. The same texture completed and missed — a five-card board, so no
        draw remains, facing the same half-pot bet. */
  results.missedDraw=await battery({ trials:150, seed:67, boardSize:5,
    deal:(d,t)=>{
      const board=[card('K♥'),card('8♥'),card('2♠'),card('4♦'),card('J♣')];
      const hearts=['A','Q','10','9','7','6','5','3']
        .map(r=>card(r+'♥')).filter(c=>!board.some(b=>b.rank===c.rank&&b.suit===c.suit));
      const hole=[hearts[t%hearts.length],hearts[(t+3)%hearts.length]];
      if (hole[0].rank===hole[1].rank) return null;
      return { hole, board };
    },
    table:{ players:3, stack:1000, pot:200, currentBet:100, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 9. A critical freezeout stack — four big blinds, unopened pot. Below
        criticalStackBB the hand-budget caps stop making sense and the AI
        switches to push/fold, so this is where short-stack commitment is
        actually visible. Three-handed, because that is what a freezeout
        looks like by the time somebody is this short. */
  results.shortStack=await battery({ trials:150, seed:71, boardSize:0,
    table:{ players:3, stack:BB*4, pot:30, currentBet:BB, bigBlind:BB,
      difficulty:'hard', mode:'elimination' } });

  /* 10a/10b. A small bet and a near-pot bet into the same flop. The
        DIFFERENCE between the two is the read on large-pot risk. */
  const pressureDeal=(d)=>{
    const board=cards(['Q♠','6d','3c']);
    const hole=d.filter(c=>!board.some(b=>b.rank===c.rank&&b.suit===c.suit)).slice(0,2);
    return { hole, board };
  };
  results.smallBet=await battery({ trials:170, seed:83, boardSize:3, deal:pressureDeal,
    table:{ players:3, stack:1000, pot:300, currentBet:45, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });
  results.bigBet=await battery({ trials:170, seed:83, boardSize:3, deal:pressureDeal,
    table:{ players:3, stack:1000, pot:300, currentBet:290, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 11. The same unopened preflop spot after a publicly visible good run.
        Temperament decides how far that moves each of them. */
  results.moodUp=await battery({ trials:150, seed:11, boardSize:0, mood:{kind:'up',intensity:1},
    table:{ players:4, stack:1000, pot:30, currentBet:BB, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });
  results.moodFlat=await battery({ trials:150, seed:11, boardSize:0,
    table:{ players:4, stack:1000, pot:30, currentBet:BB, bigBlind:BB,
      difficulty:'hard', mode:'cash' } });

  /* 11b. The gear, isolated. Every resident decides the SAME hand in the
        SAME spot from the SAME random stream twice — once on a hand
        number whose public seed puts Steve in a high gear, once on one
        that puts him in a low gear. Nothing else differs, so any change
        is the gear and only the gear. For the other four, whose gearRange
        is zero, the two runs must be identical decision for decision. */
  results.gear=await gearBattery(180);

  /* 12. The same battery at every difficulty, to prove difficulty and
        personality are independent axes. */
  results.byDifficulty={};
  for (const d of ['easy','medium','hard','expert','elite']){
    results.byDifficulty[d]=await battery({ trials:110, seed:97, boardSize:0,
      table:{ players:4, stack:1000, pot:30, currentBet:BB, bigBlind:BB,
        difficulty:d, mode:'cash' } });
  }
}

/* Finds a hand number whose PUBLIC seed puts a given resident's gear near
   the requested end of its range. Only used by the harness to construct
   the paired comparison — the game itself never chooses a hand number. */
function gearHandNumber(id,stackBB,wantHigh){
  const probe={ id:'p2', chips:stackBB*BB, totalBetHand:0, personality:persona(id) };
  const g={ bigBlind:BB };
  for (let h=0;h<4000;h++){
    delete probe._gear; delete probe._gearHand;
    g.handNumber=h;
    const gear=api.residentGear(probe,g);
    if (wantHigh ? gear>0.30 : gear<-0.30) return h;
  }
  return null;
}

async function gearBattery(trials){
  const deck=api.createDeck();
  const out={};
  IDS.forEach(id=>{ out[id]={ hi:{n:0,aggro:0,sizes:[]}, lo:{n:0,aggro:0,sizes:[]}, same:0 }; });
  const board=cards(['9h','7d','2s']);
  reseed(1234);
  for (let t=0;t<trials;t++){
    const d=api.shuffle(deck);
    const hole=d.filter(c=>!board.some(b=>b.rank===c.rank&&b.suit===c.suit)).slice(0,2);
    const g=buildTable({ players:3, stack:1000, pot:120, currentBet:0, bigBlind:BB,
      difficulty:'hard', mode:'cash', board });
    api.setGame(g);
    await api.EquityService.get(hole,board,2,api.DIFFICULTY_PARAMS.hard.iterations);
    const seatIdx=g.players.length-1;
    for (const id of IDS){
      const decisions=[];
      for (const wantHigh of [true,false]){
        const hn=gearHandNumber('steve',50,wantHigh);
        assert.ok(hn!==null,'no hand number found for a '+(wantHigh?'high':'low')+' gear');
        g.handNumber=hn;
        const p=g.players[seatIdx];
        p.personality=persona(id); p.hand=hole; p.chips=1000;
        p.betThisRound=0; p.totalBetHand=0; p.mayRaise=true; p.moodState=null;
        delete p._gear; delete p._gearHand;
        reseed(500000+t);
        const decision=await api.aiDecide(p,g);
        assertLegal(decision,p,g,0,id);
        const bucket=wantHigh?out[id].hi:out[id].lo;
        bucket.n++;
        if (decision.action==='bet'){ bucket.aggro++; bucket.sizes.push(decision.amount/g.pot); }
        decisions.push(decision.action+':'+(decision.amount||0));
      }
      if (decisions[0]===decisions[1]) out[id].same++;
    }
  }
  return out;
}

const SUITS_BY_LETTER={s:'♠',h:'♥',d:'♦',c:'♣','♠':'♠','♥':'♥','♦':'♦','♣':'♣'};
function suitLetter(sym){ return sym; }
function card(str){
  const suit=SUITS_BY_LETTER[str.slice(-1)];
  const rank=str.slice(0,-1);
  return { rank, suit, value:api.RANK_VALUES[rank] };
}
function cards(list){ return list.map(card); }

/* Run with RESIDENT_DEBUG=1 to print the raw tallies behind every
   assertion. Kept in because tuning these dials without seeing the
   numbers is guesswork, and the next person to touch a profile will
   need exactly this. */
function dump(){
  Object.keys(results).forEach(name=>{
    const t=results[name];
    if (!t || !t.harry) return;
    process.stdout.write('\n-- '+name+'\n');
    IDS.forEach(id=>{
      const s=t[id];
      process.stdout.write('   '+id.padEnd(6)+
        ' fold '+pct(rate(s,'fold'))+
        ' call '+pct(rate(s,'call'))+
        ' check '+pct(rate(s,'check'))+
        ' aggro '+pct(rate(s,'aggro'))+
        ' bluff '+pct(rate(s,'bluff'))+
        ' aggroEq '+(s.aggro?(s.aggroEquity/s.aggro).toFixed(3):'-')+
        ' foldEq '+(s.fold?(s.foldEquity/s.fold).toFixed(3):'-')+
        ' contEq '+(s.cont?(s.contEquity/s.cont).toFixed(3):'-')+
        ' sizeSd '+stdev(s.sizes).toFixed(4)+'\n');
    });
  });
  process.stdout.write('\n');
}

/* ---- the assertions ------------------------------------------------ */
function report(){
  if (process.env.RESIDENT_DEBUG) dump();
  /* Aggression is a combined read: how often they put chips in when they
     did not have to, preflop and on a later street. A single spot could
     be a quirk of one board; two independent spots is a tendency. */
  const aggroOf=id=>rate(results.preflopOpen[id],'aggro')+rate(results.dryFlop[id],'aggro');
  const bluffOf=id=>rate(results.preflopOpen[id],'bluff')+rate(results.dryFlop[id],'bluff');

  check('Harry raises and bluffs more readily than Nigel',()=>{
    const gap=aggroOf('harry')-aggroOf('nigel');
    assert.ok(gap>0.10,'Harry must be clearly the more aggressive: gap '+gap.toFixed(3));
    const bluffGap=bluffOf('harry')-bluffOf('nigel');
    assert.ok(bluffGap>0.05,'Harry must bluff clearly more often: gap '+bluffGap.toFixed(3));
    // ...and Harry is still a poker player, not a pressure machine.
    assert.ok(rate(results.facingRaise.harry,'fold')>0.15,
      'Harry must still be capable of folding to a raise');
  });

  check('Tony calls and sees flops more readily than Lucy',()=>{
    const tonyIn=1-rate(results.preflopOpen.tony,'fold');
    const lucyIn=1-rate(results.preflopOpen.lucy,'fold');
    assert.ok(tonyIn-lucyIn>0.08,'Tony must enter clearly more pots: '+pct(tonyIn)+' vs '+pct(lucyIn));
    const tonyCall=rate(results.facingRaise.tony,'call');
    const lucyCall=rate(results.facingRaise.lucy,'call');
    assert.ok(tonyCall-lucyCall>0.05,'Tony must call clearly wider: '+pct(tonyCall)+' vs '+pct(lucyCall));
    // The draw is where his loose calling is supposed to be at its most
    // pronounced, and where Nigel's is at its least.
    const tonyDraw=1-rate(results.draw.tony,'fold');
    const nigelDraw=1-rate(results.draw.nigel,'fold');
    assert.ok(tonyDraw-nigelDraw>0.05,'Tony must stay with draws more than Nigel: '+pct(tonyDraw)+' vs '+pct(nigelDraw));
    // ...but he is not a calling station on a bricked board.
    assert.ok(rate(results.missedDraw.tony,'fold')>0.25,'Tony must fold missed draws sometimes');
  });

  check("Lucy's aggressive actions are more selective than Harry's",()=>{
    /* Measured on the flop, not preflop: four-handed preflop equities are
       compressed well below the raise gate, so almost every preflop raise
       in the game comes from the bluff branch and carries no information
       about selectivity. On a real board the value/bluff split is wide
       and this reads what it claims to read. */
    const sel=id=>{ const s=results.dryFlop[id]; return s.aggro? s.aggroEquity/s.aggro : 0; };
    assert.ok(sel('lucy')-sel('harry')>0.01,
      'Lucy must attack with a stronger average holding: '+sel('lucy').toFixed(3)+' vs '+sel('harry').toFixed(3));
    assert.ok(rate(results.dryFlop.lucy,'aggro')<rate(results.dryFlop.harry,'aggro'),
      'Lucy must be aggressive less often than Harry');
    assert.ok(rate(results.dryFlop.lucy,'bluff')<rate(results.dryFlop.harry,'bluff'),
      'Lucy must bluff less often than Harry');
    // She is selective, not passive: she still attacks.
    assert.ok(rate(results.dryFlop.lucy,'aggro')>0.10,'Lucy must still apply pressure');
    // Trapping: with an obvious value bet available she checks it back
    // more than anyone, and more than she checks an ordinary flop.
    const traps=IDS.map(id=>[id,rate(results.strongMade[id],'check')]);
    const lucyTrap=rate(results.strongMade.lucy,'check');
    traps.forEach(([id,v])=>{ if (id!=='lucy') assert.ok(lucyTrap>=v,'Lucy must trap at least as often as '+id); });
    assert.ok(lucyTrap>rate(results.strongMade.harry,'check')+0.10,
      'Lucy must trap clearly more than Harry: '+pct(lucyTrap));
  });

  check('Nigel responds more strongly to position and to large-pot risk',()=>{
    // How much of his in-position range each resident gives up out of
    // position, as a fraction of the range he had.
    const posGap=id=>contraction(results.button[id],results.early[id]);
    IDS.forEach(id=>{ if (id!=='nigel') assert.ok(posGap('nigel')>posGap(id),
      'Nigel must be the most position-sensitive; '+id+' contracted '+posGap(id).toFixed(3)); });
    assert.ok(posGap('nigel')>0.20,'position must clearly move Nigel: '+posGap('nigel').toFixed(3));
    // Same idea for bet size: how much of the range he continued with
    // against a third-pot bet survives a near-pot one.
    const riskGap=id=>contraction(results.smallBet[id],results.bigBet[id]);
    IDS.forEach(id=>{ if (id!=='nigel') assert.ok(riskGap('nigel')>riskGap(id),
      'Nigel must respect large bets most; '+id+' contracted '+riskGap(id).toFixed(3)); });
    assert.ok(riskGap('nigel')>0.60,'a near-pot bet must clearly move Nigel: '+riskGap('nigel').toFixed(3));
    // The standard he demands to continue rises too, not just his folding.
    const std=(t,id)=>{ const s=t[id]; return s.cont?s.contEquity/s.cont:0; };
    assert.ok(std(results.bigBet,'nigel')>std(results.smallBet,'nigel')+0.10,
      'a near-pot bet must raise the hand Nigel needs');
    assert.ok(rate(results.bigBet.nigel,'fold')>rate(results.bigBet.harry,'fold'),
      'Nigel must fold to a near-pot bet more than Harry');
    // And he is tightest overall without being unable to commit.
    assert.ok(rate(results.preflopOpen.nigel,'fold')>rate(results.preflopOpen.tony,'fold'));
    /* And being short genuinely changes him rather than freezing him: at
       four big blinds he both enters and commits considerably more often
       than he does with a full stack. */
    assert.ok(rate(results.shortStack.nigel,'aggro')>rate(results.preflopOpen.nigel,'aggro'),
      'a short stack must make Nigel commit more, not less');
    assert.ok(1-rate(results.shortStack.nigel,'fold')>0.35,
      'Nigel must not blind himself out: '+pct(1-rate(results.shortStack.nigel,'fold')));
    IDS.forEach(id=>assert.ok(rate(results.shortStack[id],'aggro')>0,id+' never commits when short'));
  });

  check('Steve has the widest plausible variation in sizing and aggression',()=>{
    /* Spread is measured WITHIN each spot and then averaged, never pooled
       across spots: a preflop raise is priced in multiples of a 30-chip
       pot and a flop bet in fractions of a 300-chip one, so a pooled
       standard deviation would mostly measure the difference between the
       two boards rather than anything about the player. The near-pot
       battery is left out because its sizes are bimodal (raise or jam)
       for everyone and would drown the signal. */
    const spots=['preflopOpen','dryFlop','strongMade','smallBet'];
    const sizeSpread=id=>mean(spots.map(k=>stdev(results[k][id].sizes)));
    IDS.forEach(id=>{ if (id!=='steve') assert.ok(sizeSpread('steve')>sizeSpread(id)*1.3,
      'Steve must size clearly most variably; '+id+' spread '+sizeSpread(id).toFixed(4)+
      ' vs '+sizeSpread('steve').toFixed(4)); });

    /* Aggression varies too, and coherently: hands where his gear is up
       are consistently more aggressive than hands where it is down. For
       everybody else the gear is fixed at zero, so their two halves are
       the same hands and show no split at all — which is what makes this
       a demonstration of gear-changing rather than of noise. */
    const gearSplit=id=>{
      const s=results.gear[id];
      return (s.hi.aggro/s.hi.n)-(s.lo.aggro/s.lo.n);
    };
    assert.ok(gearSplit('steve')>0.10,
      'Steve must be visibly more aggressive in a high gear: '+pct(gearSplit('steve')));
    const gearSize=id=>{
      const s=results.gear[id];
      return Math.abs(mean(s.hi.sizes)-mean(s.lo.sizes));
    };
    assert.ok(gearSize('steve')>0.02,'Steve must size differently by gear: '+gearSize('steve').toFixed(4));
    IDS.forEach(id=>{ if (id!=='steve'){
      assert.strictEqual(results.gear[id].same,results.gear[id].hi.n,
        id+' must decide identically in both runs — only Steve has a gear');
      assert.strictEqual(gearSplit(id),0,id+' must have no gear at all');
    }});
    // Steve's two runs must genuinely differ, or the split above is vacuous.
    assert.ok(results.gear.steve.same<results.gear.steve.hi.n*0.92,
      'Steve changed nothing between gears');
    // ...and he stays a plausible poker player: he folds, he calls, and he
    // is not simply the most aggressive resident at everything.
    assert.ok(rate(results.preflopOpen.steve,'fold')>0.15,'Steve must fold');
    assert.ok(rate(results.facingRaise.steve,'call')>0.02,'Steve must call');
    assert.ok(rate(results.preflopOpen.steve,'aggro')<rate(results.preflopOpen.harry,'aggro'),
      'Steve is the wildcard, not the table captain');
  });

  check('Every resident stays legal, distinct and strategically coherent',()=>{
    // assertLegal ran on every decision above; this asserts coverage and
    // the sanity properties that make a decision poker-plausible.
    const total=IDS.reduce((n,id)=>n+results.preflopOpen[id].n,0);
    assert.ok(total>=900,'not enough sampled decisions: '+total);
    IDS.forEach(id=>{
      // Nobody is a rock or a maniac: every resident folds, continues and
      // attacks somewhere in the batteries.
      assert.ok(rate(results.preflopOpen[id],'fold')>0.05,id+' never folds');
      assert.ok(rate(results.preflopOpen[id],'fold')<0.95,id+' never plays');
      assert.ok(results.preflopOpen[id].aggro>0,id+' never raises');
      // Aggression tracks strength: the hands they put chips in with are
      // stronger on average than the hands they fold.
      const s=results.preflopOpen[id];
      const aggroEq=s.aggro?s.aggroEquity/s.aggro:0;
      const foldEq=s.fold?s.foldEquity/s.fold:0;
      assert.ok(aggroEq>foldEq,id+' raises weaker hands than it folds');
    });
    // The five are genuinely different, not five names on one AI.
    const entry=IDS.map(id=>1-rate(results.preflopOpen[id],'fold'));
    assert.ok(Math.max(...entry)-Math.min(...entry)>0.12,
      'entry widths are too close to be distinguishable: '+entry.map(pct).join(', '));
  });

  check('Public mood shifts play without overturning the resident underneath',()=>{
    const shift=id=>(1-rate(results.moodUp[id],'fold'))-(1-rate(results.moodFlat[id],'fold'));
    // Steve is the most reactive, Lucy the least — that is temperament.
    assert.ok(shift('steve')>=shift('lucy'),'Steve should ride a run harder than Lucy');
    // ...but mood is subordinate: the running order of the cast survives it.
    const flatOrder=IDS.slice().sort((a,b)=>(1-rate(results.moodFlat[b],'fold'))-(1-rate(results.moodFlat[a],'fold')));
    const upOrder=IDS.slice().sort((a,b)=>(1-rate(results.moodUp[b],'fold'))-(1-rate(results.moodUp[a],'fold')));
    assert.strictEqual(flatOrder[0],upOrder[0],'the widest resident must stay the widest through a mood');
    assert.strictEqual(flatOrder[IDS.length-1],upOrder[IDS.length-1],
      'the tightest resident must stay the tightest through a mood');
  });

  check('Difficulty improves decisions without collapsing the cast into one player',()=>{
    // Quality = how far the hands a resident attacks with outrank the
    // hands it folds. Less noise should widen that separation.
    const quality=d=>{
      const t=results.byDifficulty[d];
      return mean(IDS.map(id=>{
        const s=t[id];
        const a=s.aggro?s.aggroEquity/s.aggro:0;
        const f=s.fold?s.foldEquity/s.fold:0;
        return a-f;
      }));
    };
    assert.ok(quality('elite')>quality('easy'),
      'higher difficulty must read hands better: '+quality('easy').toFixed(3)+' -> '+quality('elite').toFixed(3));
    assert.ok(quality('hard')>quality('easy'),'hard must beat easy');
    // ...and personality survives every rung of that ladder.
    ['easy','medium','hard','expert','elite'].forEach(d=>{
      const t=results.byDifficulty[d];
      const tonyIn=1-rate(t.tony,'fold'), nigelIn=1-rate(t.nigel,'fold');
      assert.ok(tonyIn>nigelIn,'Tony must stay looser than Nigel at '+d+': '+pct(tonyIn)+' vs '+pct(nigelIn));
      assert.ok(rate(t.harry,'aggro')>rate(t.nigel,'aggro'),
        'Harry must stay more aggressive than Nigel at '+d);
    });
  });

  check('The public draw detector reads only its own cards and the board',()=>{
    const src=read('js/03-opponents.js');
    const fn=src.slice(src.indexOf('function publicDrawStrength'),src.indexOf('/* ============================================================\n   THE GEAR'));
    ['game','g.players','moodState','faceMood','personality'].forEach(t=>
      assert.ok(!fn.includes(t),'publicDrawStrength must not reach for '+t));
    const C=s=>card(s);
    assert.strictEqual(api.publicDrawStrength([C('A♥'),C('Q♥')],[C('K♥'),C('8♥'),C('2♠')]),1,'flush draw');
    assert.strictEqual(api.publicDrawStrength([C('9♠'),C('8♦')],[C('7♣'),C('6♥'),C('2♠')]),1,'open-ended');
    assert.strictEqual(api.publicDrawStrength([C('9♠'),C('8♦')],[C('7♣'),C('5♥'),C('2♠')]),0.5,'gutshot');
    assert.strictEqual(api.publicDrawStrength([C('A♠'),C('7♦')],[C('K♣'),C('9♥'),C('2♠')]),0,'no draw');
    assert.strictEqual(api.publicDrawStrength([C('9♠'),C('8♦')],[C('7♣'),C('6♥'),C('5♠')]),0,'already made');
    assert.strictEqual(api.publicDrawStrength([C('A♥'),C('Q♥')],[C('K♥'),C('8♥'),C('2♠'),C('4♦'),C('J♣')]),0,'complete board');
  });

  check('A table seats the cast first and never twice',()=>{
    for (let n=1;n<=8;n++){
      for (let t=0;t<40;t++){
        const cast=api.pickTableCast(n);
        assert.strictEqual(cast.length,n,'wrong seat count at '+n);
        const keys=cast.map(p=>p.key);
        assert.strictEqual(new Set(keys).size,n,'duplicate seat at '+n);
        const residents=cast.filter(p=>p.residentId);
        assert.strictEqual(residents.length,Math.min(n,5),'cast must fill first at '+n);
        assert.strictEqual(new Set(residents.map(p=>p.residentId)).size,residents.length,
          'a resident was seated twice at '+n);
        const colours=residents.map(p=>p.faceColorIdx);
        assert.strictEqual(new Set(colours).size,colours.length,'colour clash at '+n);
      }
    }
  });

  process.stdout.write('\n'+passed+' resident behaviour checks passed.\n');
}

run().then(report).catch(err=>{ console.error(err); process.exit(1); });
