"use strict";

/* ============================================================
   BLIND STRUCTURE
   ============================================================ */
const BLIND_LEVELS = [
  [10,20],[15,30],[25,50],[50,100],[75,150],
  [100,200],[150,300],[250,500],[400,800],[600,1200]
];
const TOURNAMENT_HANDS_PER_LEVEL = 10;

/* ============================================================
   ELIMINATION MODE — Phase 1 single-table elimination. One fixed-blind
   5-player (1 human + 4 AI) table; busting to $0 is permanent for this
   table. Every gameplay/animation tunable for this mode lives here so it
   can be retuned after playtesting without hunting through call sites.
   ============================================================ */
const ELIMINATION_CONFIG = {
  opponents: 4,
  startingStack: 500,
  smallBlind: 10, bigBlind: 20,

  // short-stack AI widening (see aiDecide's preflop branch)
  shortStackBB: 8,        // existing shortStack threshold, now centralised/named
  criticalStackBB: 5,     // below this: push/fold framing instead of sized raises
  foldGateWidenPerBB: 0.018,

  // playElimination() stage durations, ms — ejector-seat pass: a
  // concentrated "settle -> nasty shake -> smaller second shake -> stamp
  // -> internal THUNK (hardware fails + unlatch glitch) -> COMPLETE
  // STILLNESS -> anticipation -> BLAM -> aftermath" rhythm (item 14).
  // anticipateMs is the held, dead-calm pause immediately before the
  // portrait fires — deliberately 100-160ms, nothing animates during it.
  // The eject stage itself has no fixed duration here — it's however
  // long ejectPortrait()'s own physics take to land 3-6 ricochets and
  // clear the screen (see KO_PORTRAIT_PHYSICS_CONFIG in
  // 06-presentation.js), typically ~1-2s. Target total sequence runtime
  // (everything below, including that variable eject) is roughly
  // 2.5-4s for a K.O., a touch less for a plain elimination.
  koTimings:   { settleMs:190, hitMs:150, hitHoldMs:60, hitGapMs:90, thunkGapMs:70, failMs:220, glitchMs:90, anticipateMs:150, aftermathMs:170 },
  elimTimings: { settleMs:150, hitMs:130, hitHoldMs:45, hitGapMs:75, thunkGapMs:55, failMs:170, glitchMs:70, anticipateMs:120, aftermathMs:140 },

  // relative intensity the blocky horizontal hit keyframe scales against
  shakeIntensity: { ko:1.7, elim:1.1 },

  // multi-KO batching (pop-emphasis pass) — see playEliminationGroup,
  // 05-game-engine.js: how far apart consecutive portrait launches fire
  // within one grouped build-up, e.g. "shake together -> POP -> POP ->
  // POP -> POP".
  multiKoPopGapMin: 80, multiKoPopGapMax: 140,

  // brief hold between the final K.O.'s defeated card settling and the
  // TABLE CLEARED banner appearing — never cut away mid-payoff
  clearedBeatMs: 900,
};

/* Endless single-player run progression. Gameplay values remain in
   ELIMINATION_CONFIG; this object only owns round presentation/progression. */
const ELIMINATION_RUN_CONFIG = {
  seatStaggerMs: 90,
  seatExitMs: 620,
  deckExitMs: 420,
  themeSwapMs: 1100,
  seatArrivalMs: 680,
  announcementMs: 1200,
  readyBeatMs: 220,
};

/* ============================================================
   ARCADE RUN SCORING — data, conservative evaluator and presenter

   This observes completed elimination hands only. It never mutates cards,
   chips, betting order or AI choices. Subjective skill awards are based on
   range equity captured before the player's action; exact hidden cards are
   consulted only after resolution for bluff/luck classification.
   ============================================================ */
const ARCADE_AWARDS = {
  scrappyWin:    { name:'SCRAPPY WIN',       base:75,   type:'result',      order:10, tier:'small',  description:'Win a weak, genuinely scrappy hand at showdown.' },
  takeItDown:    { name:'TAKE IT DOWN',      base:75,   type:'result',      order:10, tier:'small',  description:'Collect a normal pot when every opponent folds.' },
  steal:         { name:'STEAL!',            base:100,  type:'skill',       order:10, tier:'small',  description:'Take a small pre-flop pot with late-position pressure.' },
  pressure:      { name:'PRESSURE!',         base:125,  type:'skill',       order:10, tier:'small',  description:'Meaningful aggression forces the remaining opponents out.' },
  bigTake:       { name:'BIG TAKE!',         base:250,  type:'result',      order:10, tier:'medium', description:'Take down a substantial developed pot without showdown.' },
  pair:          { name:'PAIR',              base:100,  type:'result',      order:10, tier:'small',  description:'Win at showdown with one pair.' },
  twoPair:       { name:'TWO PAIR!',         base:175,  type:'result',      order:10, tier:'small',  description:'Win at showdown with two pair.' },
  trips:         { name:'THREE OF A KIND!',  base:275,  type:'result',      order:10, tier:'medium', description:'Win at showdown with three of a kind.' },
  straight:      { name:'STRAIGHT!',         base:400,  type:'result',      order:10, tier:'medium', description:'Win at showdown with a straight.' },
  flush:         { name:'FLUSH!',            base:500,  type:'result',      order:10, tier:'medium', description:'Win at showdown with a flush.' },
  fullHouse:     { name:'FULL HOUSE!!',      base:750,  type:'result',      order:10, tier:'large',  description:'Win at showdown with a full house.' },
  quads:         { name:'FOUR OF A KIND!!!',base:1250, type:'result',      order:10, tier:'large',  description:'Win at showdown with four of a kind.' },
  straightFlush: { name:'STRAIGHT FLUSH!!!',base:3000, type:'result',      order:10, tier:'large',  description:'Win at showdown with a straight flush.' },
  royalFlush:    { name:'ROYAL FLUSH!!!',   base:5000, type:'result',      order:10, tier:'large',  description:'Win at showdown with a royal flush.' },
  goodFold:      { name:'GOOD FOLD',         base:125,  type:'skill',       order:20, tier:'small',  description:'A disciplined fold in a meaningful, clearly unprofitable spot.' },
  greatFold:     { name:'GREAT FOLD!',       base:250,  type:'skill',       order:20, tier:'medium', description:'Escape a large, clearly losing decision.' },
  rightCall:     { name:'RIGHT CALL',        base:175,  type:'skill',       order:20, tier:'small',  description:'Make a non-obvious profitable call in a meaningful pot.' },
  heroCall:      { name:'HERO CALL!!',       base:400,  type:'skill',       order:20, tier:'large',  description:'Call a large bluff with a hand that could reasonably fold.' },
  bluff:         { name:'BLUFF!',            base:225,  type:'skill',       order:20, tier:'medium', description:'Force a better hand out with credible pressure.' },
  greatBluff:    { name:'GREAT BLUFF!!',     base:425,  type:'skill',       order:20, tier:'large',  description:'Risk a large amount to force a materially better hand out.' },
  value:         { name:'VALUE',             base:125,  type:'skill',       order:20, tier:'small',  description:'Make a well-sized value bet that gets called.' },
  greatValue:    { name:'GREAT VALUE!',      base:225,  type:'skill',       order:20, tier:'medium', description:'Extract a large call while well ahead.' },
  maxValue:      { name:'MAX VALUE!',        base:350,  type:'skill',       order:20, tier:'medium', description:'Extract a major river call with a very strong hand.' },
  trap:          { name:'TRAP!',             base:250,  type:'skill',       order:20, tier:'medium', description:'Underplay a strong hand before extracting a meaningful later call.' },
  bigPot:        { name:'BIG POT!',          base:250,  type:'achievement', order:30, tier:'medium', description:'Win a pot worth at least 20 big blinds.' },
  massivePot:    { name:'MASSIVE POT!!',     base:500,  type:'achievement', order:30, tier:'large',  description:'Win a pot worth at least 45 big blinds.' },
  doubleUp:      { name:'DOUBLE UP!!',       base:500,  type:'achievement', order:31, tier:'large',  description:'Roughly double the stack held at the start of the hand.' },
  ko:            { name:'K.O.!',             base:750,  type:'achievement', order:32, tier:'large',  description:'Personally eliminate an opponent through the decisive pot.' },
  tableClear:    { name:'TABLE CLEAR!!!',   base:1500, type:'achievement', order:33, tier:'large',  description:'Eliminate the final opponent and clear the table.' }
};
const ARCADE_LUCK = {
  lucky:      { name:'LUCKY',       kind:'good', min:.25, max:.40, description:'Win after a major commitment with roughly 25–40% equity.' },
  veryLucky:  { name:'VERY LUCKY',  kind:'good', min:.10, max:.25, description:'Win after a major commitment with roughly 10–25% equity.' },
  gotAway:    { name:'GOT AWAY WITH IT',kind:'good',min:0,max:.10, description:'Survive a major commitment with less than roughly 10% equity.' },
  unlucky:    { name:'UNLUCKY',     kind:'bad',  min:.70, max:.80, description:'Lose after a major commitment with roughly 70–80% equity.' },
  brutal:     { name:'BRUTAL',      kind:'bad',  min:.90, max:.97, description:'Lose after a major commitment with roughly 90–97% equity.' },
  badBeat:    { name:'BAD BEAT',    kind:'rare', min:.80, max:1.01,description:'Lose after a major commitment as a very large favourite.' }
};
const ARCADE_COMMENTARY = {
  badCall:     { name:'BAD CALL',     kind:'negative', description:'Call a meaningful bet with equity clearly below the offered price.' },
  missedValue: { name:'MISSED VALUE', kind:'negative', description:'Check back the river with a very strong hand against live opponents.' },
  tooLoose:    { name:'TOO LOOSE',    kind:'negative', description:'Make more than one clearly loose, meaningful call in the same hand.' },
  punt:        { name:'PUNT!',        kind:'negative', description:'Lose after a very large call with equity far below the price.' },
  risky:       { name:'RISKY...',     kind:'negative', description:'Win despite a clearly questionable major call.' }
};
const ARCADE_PROFILE_DEFAULT = { highScore:0, discovered:{}, counts:{}, bestByEvent:{} };
let arcadeProfile = Object.assign({}, ARCADE_PROFILE_DEFAULT, Store.get('felt.arcade', {}));
arcadeProfile.discovered = Object.assign({}, arcadeProfile.discovered||{});
arcadeProfile.counts = Object.assign({}, arcadeProfile.counts||{});
arcadeProfile.bestByEvent = Object.assign({}, arcadeProfile.bestByEvent||{});
let arcadePresentationQueue = Promise.resolve();

function saveArcadeProfile(){ Store.set('felt.arcade',arcadeProfile); }
function makeArcadeRunState(){
  return {
    score:0, comboStep:0, highestComboStep:0, biggestReward:0,
    awardCounts:{}, decisionSnapshots:[], displayedScore:0, newHighScore:false
  };
}
function formatArcadeScore(n){ return Math.max(0,Math.round(n||0)).toString().padStart(7,'0'); }
function setArcadeMode(active){
  const screen=$('table-screen'), machine=$('arcade-score-machine');
  if (screen) screen.classList.toggle('arcade-active',!!active);
  if (machine) machine.classList.toggle('hidden',!active);
  if (!active){ const layer=$('arcade-reward-layer'); if (layer) layer.classList.add('hidden'); }
}
function renderArcadeDigits(el,text){
  if (!el) return;
  const chars=[...text];
  el.style.setProperty('--score-digits',chars.length);
  if (el.children.length!==chars.length) el.innerHTML=chars.map(c=>'<span>'+c+'</span>').join('');
  const firstLive=chars.findIndex(c=>c!=='0');
  const liveStart=firstLive<0?chars.length-1:firstLive;
  chars.forEach((char,i)=>{
    const cell=el.children[i];
    if (cell) cell.classList.toggle('digit-unused',i<liveStart);
    if (!cell||cell.dataset.digit===char) return;
    cell.dataset.digit=char; cell.textContent=char;
    if (!motionOff()){
      cell.classList.remove('digit-tick'); void cell.offsetWidth; cell.classList.add('digit-tick');
      clearTimeout(cell._digitT); cell._digitT=setTimeout(()=>cell.classList.remove('digit-tick'),190);
    }
  });
}
function updateArcadeHUD(){
  const active=!!(game&&game.mode==='elimination'&&game.run&&game.run.arcade);
  setArcadeMode(active);
  if (!active) return;
  const a=game.run.arcade;
  if ($('arcade-score-value')){
    const scoreText=formatArcadeScore(a.displayedScore==null?a.score:a.displayedScore), scoreEl=$('arcade-score-value');
    renderArcadeDigits(scoreEl,scoreText);
  }
  if ($('arcade-score-machine')) $('arcade-score-machine').setAttribute('aria-label','Score '+a.score.toLocaleString());
}
function noteArcadeDiscovery(id,count,bestScore){
  const n=Math.max(1,count||1);
  arcadeProfile.discovered[id]=true;
  arcadeProfile.counts[id]=(arcadeProfile.counts[id]||0)+n;
  if (bestScore!=null) arcadeProfile.bestByEvent[id]=Math.max(arcadeProfile.bestByEvent[id]||0,Math.round(bestScore));
  saveArcadeProfile();
}

/* Capture only information available at decision time. Equity is against
   random/tendency-adjusted ranges, never the opponents' hidden cards. The
   worker promise resolves while ordinary poker animation continues. */
function captureArcadeDecision(player,requestedAction,amount){
  const g=game;
  if (!g||g.mode!=='elimination'||!g.run||!g.run.arcade||!player||!player.isHuman) return;
  const toCall=Math.max(0,g.currentBet-player.betThisRound);
  let action=requestedAction;
  if (action==='call'&&toCall===0) action='check';
  const stackBefore=player.chips, startStack=g._humanStart!=null?g._humanStart:(player.chips+player.totalBetHand);
  let commit=action==='call'?Math.min(toCall,stackBefore):0;
  if (action==='raise') commit=Math.max(0,Math.min(stackBefore,(amount||0)-player.betThisRound));
  const opponents=g.players.filter(p=>p.inHand&&!p.folded&&!p.isHuman);
  const lastAggressor=(g.handActions||[]).slice().reverse().find(a=>a.street===g.phase&&a.id!=='you'&&(a.action==='bet'||a.action==='raise'));
  const snap={
    action, street:g.phase, board:g.board.map(c=>Object.assign({},c)), hole:player.hand.map(c=>Object.assign({},c)),
    opponentIds:opponents.map(p=>p.id), lastAggressorId:lastAggressor?lastAggressor.id:null,
    pot:g.pot, toCall, potOdds:toCall>0?toCall/(g.pot+toCall):0, commit,
    stackBefore,startStack, totalCommittedBefore:player.totalBetHand, bigBlind:g.bigBlind,
    allIn:commit>=stackBefore, handActionIndex:(g.handActions||[]).length
  };
  snap.equityPromise=EquityService.get(snap.hole,snap.board,Math.max(1,opponents.length),260)
    .then(v=>typeof v==='number'?v:null).catch(()=>null);
  g.run.arcade.decisionSnapshots.push(snap);
}
async function settleArcadeSnapshots(g){
  const snaps=(g.run&&g.run.arcade&&g.run.arcade.decisionSnapshots)||[];
  await Promise.all(snaps.map(async s=>{ if (s.equity==null) s.equity=await s.equityPromise; delete s.equityPromise; }));
  return snaps;
}
function resolvedEquityShare(heroHole,opponentHoles,board){
  const hero=evaluate7([...heroHole,...board]);
  const hands=opponentHoles.map(h=>evaluate7([...h,...board]));
  let best=hero, winners=1, heroBest=true;
  for (const hand of hands){
    const cmp=compareHands(hand,best);
    if (cmp>0){ best=hand; winners=1; heroBest=false; }
    else if (cmp===0){ winners++; }
  }
  return heroBest?1/winners:0;
}
function resolvedEquityAtSnapshot(s,g){
  if (!s||!s.opponentIds||!s.opponentIds.length) return null;
  const opponentHoles=s.opponentIds.map(id=>g.players.find(p=>p.id===id)).filter(Boolean).map(p=>p.hand);
  if (!opponentHoles.length||opponentHoles.some(h=>!h||h.length<2)) return null;
  const used=new Set([...s.hole,...s.board,...opponentHoles.flat()].map(cardKey));
  const deck=createDeck().filter(c=>!used.has(cardKey(c))), need=5-s.board.length;
  let total=0, share=0;
  if (need===0) return resolvedEquityShare(s.hole,opponentHoles,s.board);
  if (need===1){
    deck.forEach(c=>{ share+=resolvedEquityShare(s.hole,opponentHoles,[...s.board,c]); total++; });
  } else if (need===2){
    for (let i=0;i<deck.length-1;i++) for (let j=i+1;j<deck.length;j++){
      share+=resolvedEquityShare(s.hole,opponentHoles,[...s.board,deck[i],deck[j]]); total++;
    }
  } else {
    const iterations=520;
    for (let n=0;n<iterations;n++){
      const sample=shuffle(deck.slice()).slice(0,need);
      share+=resolvedEquityShare(s.hole,opponentHoles,[...s.board,...sample]); total++;
    }
  }
  return total?share/total:null;
}
function classifyArcadeLuck(g,outcome,snapshots){
  const won=humanWonOutcome(outcome);
  const meaningful=snapshots.filter(s=>s.action!=='fold'&&s.action!=='check'&&(
    s.allIn||s.commit>=Math.max(6*s.bigBlind,s.startStack*.22)||s.totalCommittedBefore+s.commit>=s.startStack*.45
  )).sort((a,b)=>(b.commit/b.startStack)-(a.commit/a.startStack))[0];
  if (!meaningful) return null;
  const equity=resolvedEquityAtSnapshot(meaningful,g);
  if (equity==null) return null;
  if (won){
    if (equity<.10) return {id:'gotAway',equity};
    if (equity<.25) return {id:'veryLucky',equity};
    if (equity<.40) return {id:'lucky',equity};
  } else {
    if (equity>=.90) return {id:'brutal',equity};
    if (equity>=.80) return {id:'badBeat',equity};
    if (equity>=.70) return {id:'unlucky',equity};
  }
  return null;
}
function addArcadeAward(list,id,count){
  const def=ARCADE_AWARDS[id]; if (!def) return;
  const existing=list.find(a=>a.id===id);
  if (existing) existing.count+=count||1; else list.push({id,count:count||1,def});
}
function actualHandAtResolution(player,g){
  if (!player||!player.hand||player.hand.length<2||player.hand.length+g.board.length<5) return null;
  return evaluate7([...player.hand,...g.board]);
}
const ARCADE_HAND_AWARD_IDS=['scrappyWin','pair','twoPair','trips','straight','flush','fullHouse','quads','straightFlush','royalFlush'];
function findArcadeFoldBluff(g,outcome,snapshots){
  if (!humanWonOutcome(outcome)||outcome.type!=='foldwin') return null;
  const human=g.players.find(p=>p.isHuman);
  return snapshots.filter(s=>s.action==='raise'&&s.street!=='preflop'&&s.commit>=Math.max(4*s.bigBlind,s.startStack*.12)&&s.pot>=6*s.bigBlind&&s.equity<=.40)
    .reverse().find(s=>{
      const heroNow=actualHandAtResolution(human,g); if (!heroNow) return false;
      return g.players.some(p=>!p.isHuman&&p.folded&&s.opponentIds.includes(p.id)&&actualHandAtResolution(p,g)&&compareHands(actualHandAtResolution(p,g),heroNow)>0);
    })||null;
}
function evaluateArcadeResult(g,outcome,snapshots,awards){
  if (!humanWonOutcome(outcome)) return;
  if (outcome.type==='foldwin'){
    if ((outcome.amount||0)<2*g.bigBlind) return;
    const bluff=findArcadeFoldBluff(g,outcome,snapshots);
    if (bluff){
      addArcadeAward(awards,bluff.commit>=Math.max(bluff.pot*.8,bluff.startStack*.25)?'greatBluff':'bluff');
      return;
    }
    const aggression=snapshots.filter(s=>s.action==='raise').slice(-1)[0];
    const position=g.positions&&g.positions.you;
    if ((outcome.amount||0)>=20*g.bigBlind) addArcadeAward(awards,'bigTake');
    else if (aggression&&aggression.street==='preflop'&&['BTN','CO','SB'].includes(position)&&(outcome.amount||0)<=8*g.bigBlind) addArcadeAward(awards,'steal');
    else if (aggression&&aggression.commit>=Math.max(3*g.bigBlind,aggression.pot*.35)) addArcadeAward(awards,'pressure');
    else addArcadeAward(awards,'takeItDown');
    return;
  }
  const human=g.players.find(p=>p.isHuman), hand=actualHandAtResolution(human,g);
  if (hand&&ARCADE_HAND_AWARD_IDS[hand.cat]) addArcadeAward(awards,ARCADE_HAND_AWARD_IDS[hand.cat]);
}
function actionWasCalled(g,snapshot){
  return (g.handActions||[]).slice(snapshot.handActionIndex+1).some(a=>
    a.street===snapshot.street&&a.id!=='you'&&a.action==='call'
  );
}
function evaluateArcadeSkill(g,outcome,snapshots){
  const awards=[], human=g.players.find(p=>p.isHuman), won=humanWonOutcome(outcome);
  const calls=snapshots.filter(s=>s.action==='call'&&s.toCall>0&&s.equity!=null);
  const bets=snapshots.filter(s=>s.action==='raise'&&s.commit>0&&s.equity!=null);
  const folds=snapshots.filter(s=>s.action==='fold'&&s.toCall>0&&s.equity!=null);

  const heroCall=calls.slice().reverse().find(s=>{
    if (!won||outcome.type!=='showdown'||!s.lastAggressorId||s.commit<Math.max(5*s.bigBlind,s.startStack*.15)) return false;
    const villain=g.players.find(p=>p.id===s.lastAggressorId), vh=actualHandAtResolution(villain,g), hh=actualHandAtResolution(human,g);
    return vh&&hh&&compareHands(hh,vh)>0&&vh.cat<=1&&hh.cat<=2&&s.equity<=.58;
  });
  if (heroCall) addArcadeAward(awards,'heroCall');
  else if (calls.some(s=>s.commit>=Math.max(3*s.bigBlind,s.startStack*.10)&&s.equity>=s.potOdds+.12&&s.equity<=.72)) addArcadeAward(awards,'rightCall');

  const bestFold=folds.filter(s=>s.street!=='preflop'&&s.toCall>=Math.max(3*s.bigBlind,s.startStack*.10)&&s.pot>=6*s.bigBlind&&s.equity<=s.potOdds-.11)
    .sort((a,b)=>(b.potOdds-b.equity)-(a.potOdds-a.equity))[0];
  if (bestFold) addArcadeAward(awards,(bestFold.potOdds-bestFold.equity>=.24&&bestFold.toCall>=bestFold.startStack*.2)?'greatFold':'goodFold');

  if (won&&outcome.type==='showdown'){
    const valueBet=bets.filter(s=>s.street!=='preflop'&&actionWasCalled(g,s)&&s.equity>=.67&&s.commit>=Math.max(2*s.bigBlind,s.pot*.28))
      .sort((a,b)=>(b.street==='river')-(a.street==='river')||b.commit-a.commit)[0];
    if (valueBet){
      if (valueBet.street==='river'&&valueBet.equity>=.84&&valueBet.commit>=Math.max(6*valueBet.bigBlind,valueBet.pot*.6)) addArcadeAward(awards,'maxValue');
      else if (valueBet.equity>=.76&&valueBet.commit>=Math.max(4*valueBet.bigBlind,valueBet.pot*.45)) addArcadeAward(awards,'greatValue');
      else addArcadeAward(awards,'value');
      const earlierTrap=snapshots.some(s=>s.action==='check'&&s.street!=='river'&&s.equity>=.72&&s.handActionIndex<valueBet.handActionIndex);
      if (earlierTrap&&valueBet.commit>=4*valueBet.bigBlind) addArcadeAward(awards,'trap');
    }
  }
  return awards;
}
/* Pot-size/stack achievements — knowable immediately once the real money
   mutation has happened, no elimination context required. Split out of
   the old evaluateArcadeAchievements so the pot-smash early phase (see
   evaluateArcadeAwardsEarly below) can compute these before
   resolveEliminations() has even run. */
function evaluateArcadePotAchievements(g,outcome,awards){
  const human=g.players.find(p=>p.isHuman), won=humanWonOutcome(outcome), potWon=humanAwardFromOutcome(outcome);
  if (won&&potWon>=45*g.bigBlind) addArcadeAward(awards,'massivePot');
  else if (won&&potWon>=20*g.bigBlind) addArcadeAward(awards,'bigPot');
  const start=g._humanStart==null?human.chips:g._humanStart, gain=human.chips-start;
  if (human.chips>=start*1.9&&gain>=10*g.bigBlind) addArcadeAward(awards,'doubleUp');
}
/* K.O./TABLE CLEAR — the other half of the old evaluateArcadeAchievements.
   These genuinely need resolveEliminations()'s output (context.koCount/
   tableClear), which only exists inside finishHand(), structurally after
   the pot-smash sequence has already run — so they always stay a late,
   separate stinger (see resolveArcadeHandLate) rather than folding into
   the pre-smash TOTAL. */
function evaluateArcadeMilestoneAchievements(context,awards){
  if (context&&context.koCount) addArcadeAward(awards,'ko',context.koCount);
  if (context&&context.tableClear) addArcadeAward(awards,'tableClear');
}
function normalizeArcadeAwards(awards){
  const ids=new Set(awards.map(a=>a.id));
  if (ids.has('heroCall')) awards=awards.filter(a=>a.id!=='rightCall');
  if (ids.has('greatBluff')) awards=awards.filter(a=>a.id!=='bluff');
  if (ids.has('greatFold')) awards=awards.filter(a=>a.id!=='goodFold');
  if (ids.has('maxValue')) awards=awards.filter(a=>!['greatValue','value'].includes(a.id));
  else if (ids.has('greatValue')) awards=awards.filter(a=>a.id!=='value');
  if (ids.has('massivePot')) awards=awards.filter(a=>a.id!=='bigPot');
  // No item cap — every earned award is shown; the pot-smash reward
  // breakdown (see presentRewardBreakdown in 06-presentation.js) budgets
  // TIME instead, compressing per-item pacing for a long list rather than
  // truncating it.
  return awards.sort((a,b)=>a.def.order-b.def.order||b.def.base-a.def.base);
}
function evaluateArcadeCommentary(g,outcome,snapshots,luck){
  if (luck&&['unlucky','badBeat','brutal'].includes(luck.id)) return null;
  const won=humanWonOutcome(outcome);
  const loose=snapshots.filter(s=>s.action==='call'&&s.toCall>0&&s.equity!=null&&s.commit>=4*s.bigBlind&&s.potOdds-s.equity>=.14);
  const worst=loose.sort((a,b)=>(b.potOdds-b.equity)-(a.potOdds-a.equity))[0];
  if (worst){
    const invested=(worst.totalCommittedBefore+worst.commit)/Math.max(1,worst.startStack);
    if (!won&&invested>=.42&&worst.potOdds-worst.equity>=.25) return {id:'punt'};
    if (!won&&loose.length>=2) return {id:'tooLoose'};
    if (won&&invested>=.30&&worst.potOdds-worst.equity>=.20) return {id:'risky'};
    if (!won) return {id:'badCall'};
  }
  const missed=snapshots.find(s=>s.action==='check'&&s.street==='river'&&s.equity!=null&&s.equity>=.84&&s.opponentIds.length>0);
  return missed?{id:'missedValue'}:null;
}
function potWinningsTier(amount){ return amount>=1000?'large':amount>=250?'medium':'small'; }
/* Early phase — human-pot-win only. Called from runShowdownAwardSequence
   (js/06-presentation.js) right after the real money mutation, well
   before resolveEliminations() runs, so it deliberately never touches
   ko/tableClear (see evaluateArcadeMilestoneAchievements). Prepends a
   synthetic POT WINNINGS line (the actual $ the human won this hand,
   1:1 into score) ahead of the normal bonus-award catalog so the smash's
   reward breakdown reads as one coherent list. Records awardCounts/
   discovery exactly like the old unified resolveArcadeHand did, but never
   touches a.score itself — folding points into the permanent SCORE HUD
   is the smash sequence's own job (see runPotSmashSequence), timed to the
   impact moment rather than to this evaluation. */
async function evaluateArcadeAwardsEarly(g,outcome){
  if (!g||g.mode!=='elimination'||!g.run||!g.run.arcade||!humanWonOutcome(outcome)) return null;
  const a=g.run.arcade, snapshots=await settleArcadeSnapshots(g), awards=[];
  evaluateArcadeResult(g,outcome,snapshots,awards);
  evaluateArcadeSkill(g,outcome,snapshots).forEach(x=>addArcadeAward(awards,x.id,x.count));
  evaluateArcadePotAchievements(g,outcome,awards);
  const finalAwards=normalizeArcadeAwards(awards);
  const luck=classifyArcadeLuck(g,outcome,snapshots);
  const commentary=evaluateArcadeCommentary(g,outcome,snapshots,luck);
  const potWon=humanAwardFromOutcome(outcome);
  const bonusTotal=finalAwards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  const potWinnings={id:'potWinnings',count:1,def:{name:'POT WINNINGS',base:potWon,tier:potWinningsTier(potWon),type:'pot'}};
  finalAwards.forEach(x=>{
    a.awardCounts[x.id]=(a.awardCounts[x.id]||0)+x.count;
    noteArcadeDiscovery(x.id,x.count,x.def.base*x.count);
  });
  if (luck) noteArcadeDiscovery(luck.id,1,null);
  if (commentary) noteArcadeDiscovery(commentary.id,1,null);
  return { awards:[potWinnings,...finalAwards], luck, commentary, total:potWon+bonusTotal };
}
/* Late phase — always runs from finishHand(), same call site/timing the
   original resolveArcadeHand used, after resolveEliminations(). If the
   human already won this hand's pot, evaluateArcadeAwardsEarly() above
   has already evaluated+presented everything except K.O./TABLE CLEAR, so
   this only adds those as a late stinger on top (still through the
   unchanged presentArcadeAward/rollArcadeCounter per-item flow). If the
   human did NOT win this hand's pot (a loss, or no pot awarded to them),
   nothing ran early, so this computes and presents the full picture in
   one pass — identical behaviour/timing to the original resolveArcadeHand
   for every non-win hand. */
async function resolveArcadeHandLate(g,outcome,context){
  if (!g||g.mode!=='elimination'||!g.run||!g.run.arcade) return;
  const a=g.run.arcade, awards=[];
  let luck=null, commentary=null;
  if (humanWonOutcome(outcome)){
    evaluateArcadeMilestoneAchievements(context,awards);
  } else {
    const snapshots=await settleArcadeSnapshots(g);
    evaluateArcadeResult(g,outcome,snapshots,awards);
    evaluateArcadeSkill(g,outcome,snapshots).forEach(x=>addArcadeAward(awards,x.id,x.count));
    evaluateArcadePotAchievements(g,outcome,awards);
    evaluateArcadeMilestoneAchievements(context,awards);
    luck=classifyArcadeLuck(g,outcome,snapshots);
    commentary=evaluateArcadeCommentary(g,outcome,snapshots,luck);
  }
  const finalAwards=normalizeArcadeAwards(awards);
  const total=finalAwards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  const resolution={awards:finalAwards,luck,commentary,total,dev:false};
  finalAwards.forEach(x=>{
    a.awardCounts[x.id]=(a.awardCounts[x.id]||0)+x.count;
    noteArcadeDiscovery(x.id,x.count,x.def.base*x.count);
  });
  if (luck) noteArcadeDiscovery(luck.id,1,null);
  if (commentary) noteArcadeDiscovery(commentary.id,1,null);
  if (!finalAwards.length&&!luck&&!commentary) return;
  await queueArcadePresentation(()=>presentArcadeResolution(g,resolution));
}
function queueArcadePresentation(fn){
  arcadePresentationQueue=arcadePresentationQueue.catch(()=>{}).then(fn);
  return arcadePresentationQueue;
}
function arcadeDelay(ms){ return sleep(motionOff()?Math.min(30,ms):ms); }
function clearArcadeLayer(){
  const layer=$('arcade-reward-layer'); if (!layer) return;
  layer.className='arcade-reward-layer hidden';
  ['arcade-luck','arcade-hero','arcade-secondaries','arcade-total'].forEach(id=>{ if ($(id)) $(id).innerHTML=''; });
}
async function rollArcadeCounter(a,target,tier){
  const from=a.displayedScore||0, duration=motionOff()?0:(tier==='large'?760:tier==='medium'?560:400);
  if (!duration){ a.displayedScore=target; updateArcadeHUD(); return; }
  const start=performance.now(); let lastTick=0;
  await new Promise(resolve=>{
    function frame(now){
      const t=Math.min(1,(now-start)/duration), eased=1-Math.pow(1-t,3);
      a.displayedScore=Math.round(from+(target-from)*eased);
      if (now-lastTick>55){ Sound.arcadeBankTick(); lastTick=now; }
      updateArcadeHUD();
      if (t<1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
  a.displayedScore=target; updateArcadeHUD(); Sound.arcadeBankLock();
}
async function flyArcadeScore(total,tier){
  const source=$('arcade-total'), target=$('arcade-score-machine');
  if (!source||!target||motionOff()) return;
  const sr=source.getBoundingClientRect(), tr=target.getBoundingClientRect(), flight=document.createElement('div');
  flight.className='arcade-bank-flight'; flight.textContent='+'+total.toLocaleString();
  flight.style.left=sr.left+'px'; flight.style.top=sr.top+'px'; document.body.appendChild(flight);
  const dx=(tr.left+tr.width/2)-(sr.left+sr.width/2), dy=(tr.top+tr.height/2)-(sr.top+sr.height/2);
  const dur=tier==='large'?680:tier==='medium'?560:440;
  const anim=flight.animate([
    {transform:'translate(0,0) scale(1)',opacity:1},
    {transform:'translate('+(dx*.3)+'px,'+(dy*.18-22)+'px) scale(1.12)',opacity:1,offset:.32},
    {transform:'translate('+dx+'px,'+dy+'px) scale(.34)',opacity:.25}
  ],{duration:dur,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});
  try{ await anim.finished; }catch(e){}
  flight.remove();
}
async function presentArcadeAward(g,award){
  if (!g||game!==g||!g.run||!g.run.arcade) return;
  const a=g.run.arcade, layer=$('arcade-reward-layer'), tier=award.def.tier||'small';
  if (!layer) return;
  const points=award.def.base*award.count;
  clearArcadeLayer();
  layer.className='arcade-reward-layer tier-'+tier+' cat-'+award.def.type;
  layer.classList.remove('hidden');
  $('arcade-hero').textContent=award.def.name;
  void layer.offsetWidth; layer.classList.add('is-live');
  Sound.arcadeReward(tier,award.id); haptic(tier==='large'?[42,24,55]:tier==='medium'?32:18);
  await arcadeDelay(tier==='large'?430:tier==='medium'?330:240);
  $('arcade-total').textContent='+'+points.toLocaleString();
  $('arcade-total').classList.add('is-ready');
  await arcadeDelay(tier==='large'?440:tier==='medium'?330:250);
  await flyArcadeScore(points,tier);
  const target=a.score+points; a.score=target;
  const machine=$('arcade-score-machine');
  if (machine){
    machine.classList.remove('score-impact','score-jackpot'); void machine.offsetWidth;
    machine.classList.add(tier==='large'?'score-jackpot':'score-impact');
  }
  clearArcadeLayer();
  await rollArcadeCounter(a,target,tier);
  await arcadeDelay(tier==='large'?150:90);
}
async function presentArcadeCommentary(g,item,isLuck){
  if (!item||!g||game!==g) return;
  const def=isLuck?ARCADE_LUCK[item.id]:ARCADE_COMMENTARY[item.id];
  if (!def) return;
  const layer=$('arcade-reward-layer'); if (!layer) return;
  clearArcadeLayer();
  layer.className='arcade-reward-layer commentary-only '+(isLuck?'luck-'+def.kind:'comment-negative');
  layer.classList.remove('hidden');
  $('arcade-hero').textContent=def.name;
  void layer.offsetWidth; layer.classList.add('is-live');
  Sound.arcadeLuck(isLuck?def.kind:'bad');
  await arcadeDelay(isLuck&&def.kind==='rare'?700:520);
  clearArcadeLayer();
  await arcadeDelay(80);
}
async function presentArcadeResolution(g,r){
  if (!g||game!==g||!g.run||!g.run.arcade) return;
  const a=g.run.arcade;
  a.biggestReward=Math.max(a.biggestReward,r.total||0);
  for (const award of r.awards) await presentArcadeAward(g,award);
  if (r.luck) await presentArcadeCommentary(g,r.luck,true);
  else if (r.commentary) await presentArcadeCommentary(g,r.commentary,false);
}
function finalizeArcadeRun(g){
  if (!g||!g.run||!g.run.arcade) return;
  const score=g.run.arcade.score, prior=arcadeProfile.highScore||0;
  g.run.arcade.newHighScore=score>prior;
  if (score>prior){ arcadeProfile.highScore=score; saveArcadeProfile(); }
}
function animateFinalArcadeScore(g){
  const el=$('final-score-value'); if (!el||!g||!g.run||!g.run.arcade) return;
  const target=g.run.arcade.score;
  if (motionOff()){ el.textContent=formatArcadeScore(target); return; }
  const start=performance.now(), duration=1050;
  function frame(now){
    const t=Math.min(1,(now-start)/duration), v=Math.round(target*(1-Math.pow(1-t,3)));
    el.textContent=formatArcadeScore(v);
    if (t<1) requestAnimationFrame(frame); else Sound.arcadeBankLock();
  }
  requestAnimationFrame(frame);
}
const DEV_ARCADE_SCENARIOS = {
  small:       {awards:['pair']},
  medium:      {awards:['straight']},
  huge:        {awards:['quads']},
  stacked:     {awards:['flush','maxValue','bigPot']},
  luckyWin:    {awards:['twoPair'],luck:'gotAway'},
  badBeat:     {awards:['rightCall'],luck:'badBeat'},
  badCall:     {awards:[],commentary:'badCall'}
};
function devArcadePresent(ids,luckId,commentaryId){
  if (!DEV_MODE||!game||game.mode!=='elimination'||!game.run||!game.run.arcade) return;
  const g=game;
  let awards=(ids||[]).map(id=>ARCADE_AWARDS[id]?{id,count:1,def:ARCADE_AWARDS[id]}:null).filter(Boolean);
  awards=normalizeArcadeAwards(awards);
  const total=awards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  queueArcadePresentation(()=>presentArcadeResolution(g,{
    awards,luck:luckId&&ARCADE_LUCK[luckId]?{id:luckId,equity:0}:null,
    commentary:commentaryId&&ARCADE_COMMENTARY[commentaryId]?{id:commentaryId}:null,
    total,dev:true
  }));
}
function devArcadeAward(id){ devArcadePresent([id],null); }
function devArcadeLuck(id){ devArcadePresent([],id); }
function devArcadeCommentary(id){ devArcadePresent([],null,id); }
function devArcadeScenario(id){
  const scenario=DEV_ARCADE_SCENARIOS[id];
  if (scenario) devArcadePresent(scenario.awards,scenario.luck||null,scenario.commentary||null);
}
function devArcadeJackpot(){
  devArcadePresent(['royalFlush'],null);
}
function devArcadeAddScore(amount){
  if (!DEV_MODE||!game||game.mode!=='elimination'||!game.run||!game.run.arcade) return;
  const g=game, a=g.run.arcade, increment=Math.max(0,Math.round(amount||0));
  queueArcadePresentation(async()=>{
    if (game!==g||!g.run||!g.run.arcade) return;
    const target=a.score+increment; a.score=target; a.biggestReward=Math.max(a.biggestReward,increment);
    const machine=$('arcade-score-machine');
    if (machine){ machine.classList.remove('score-impact'); void machine.offsetWidth; machine.classList.add('score-impact'); }
    await rollArcadeCounter(a,target,increment>=1000?'large':increment>=250?'medium':'small');
    refreshDevPanel();
  });
}
function devArcadeResetScore(){
  if (!DEV_MODE||!game||game.mode!=='elimination'||!game.run||!game.run.arcade) return;
  const g=game;
  queueArcadePresentation(async()=>{
    if (game!==g||!g.run||!g.run.arcade) return;
    const a=g.run.arcade; a.score=0; a.displayedScore=0; a.biggestReward=0;
    updateArcadeHUD(); refreshDevPanel();
  });
}
function devArcadeReset(){
  if (!DEV_MODE||!game||game.mode!=='elimination') return;
  game.run.arcade=makeArcadeRunState(); clearArcadeLayer(); updateArcadeHUD(); refreshDevPanel();
}
/* POT SMASH DEV TEST — PHYSICAL POT SCALE presets, replacing the old
   score-only SMALL +180/MEDIUM +750/LARGE +2,200 buttons (see
   js/08-dev-mode.js). Each preset is a representative pot dollar amount
   plus a representative bonus-award list; devTestPotSmash builds (or
   reuses) a genuinely intact pot via the normal pot-rendering system
   (bootstrapPile/potPile — the same primitives cold-start/rebuy use),
   only if the pot pile happens to already be empty, then runs the exact
   real building blocks a live hand uses (presentRewardBreakdown ->
   runPotSmashSequence, both in 06-presentation.js) with a synthetic
   breakdown shaped exactly like evaluateArcadeAwardsEarly's real return
   value. No real hand/pot/outcome is involved, so this deliberately calls
   those two building blocks directly rather than
   runHumanPotSmashCeremony (which expects a real `outcome` to evaluate).
   Never touches game.pot/player.chips; explicitly resets both decorative
   piles back to empty afterward so the next real render() idle-
   bootstraps them correctly from real state instead of being left
   holding this test's decorative amount. */
const DEV_POT_SMASH_SCALES = {
  small:  { amount:180,  awardIds:['pair'] },
  medium: { amount:900,  awardIds:['flush','pressure'] },
  huge:   { amount:2600, awardIds:['fullHouse','bigPot','heroCall'] }
};
function devTestPotSmash(scale){
  if (!DEV_MODE||!game||game.mode!=='elimination'||!game.run||!game.run.arcade||!betweenHands()) return;
  const g=game, cfg=DEV_POT_SMASH_SCALES[scale]; if (!cfg) return;
  const potContainer=$('pot-stacks'), pPile=potPile();
  if ((potContainer._chipCount||0)===0) bootstrapPile(potContainer, pPile, cfg.amount);
  const potN=potContainer._chipCount||0;
  if (!potN) return;
  let awards=cfg.awardIds.map(id=>ARCADE_AWARDS[id]?{id,count:1,def:ARCADE_AWARDS[id]}:null).filter(Boolean);
  awards=normalizeArcadeAwards(awards);
  const bonusTotal=awards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  const potWinnings={id:'potWinnings',count:1,def:{name:'POT WINNINGS',base:cfg.amount,tier:potWinningsTier(cfg.amount),type:'pot'}};
  const early={awards:[potWinnings,...awards],luck:null,commentary:null,total:cfg.amount+bonusTotal};
  queueArcadePresentation(async()=>{
    if (game!==g||!g.run||!g.run.arcade) return;
    await presentRewardBreakdown(early);
    await runPotSmashSequence({ potN, scoreTotal:early.total, human:g.players.find(p=>p.isHuman) });
    resetPile($('hud-tower'), bankPile());
    resetPile($('pot-stacks'), potPile());
    render();
    refreshDevPanel();
  });
}
function buildAwardsGlossary(){
  const list=$('awards-list'), summary=$('awards-summary'); if (!list||!summary) return;
  const entries=[...Object.entries(ARCADE_AWARDS),...Object.entries(ARCADE_LUCK),...Object.entries(ARCADE_COMMENTARY)];
  const unlocked=entries.filter(([id])=>arcadeProfile.discovered[id]).length;
  summary.innerHTML='<b>HIGH SCORE '+formatArcadeScore(arcadeProfile.highScore||0)+'</b><br>'+unlocked+' / '+entries.length+' signals discovered';
  list.innerHTML=entries.map(([id,def])=>{
    const seen=!!arcadeProfile.discovered[id], commentary=!('base' in def), count=arcadeProfile.counts[id]||0, best=arcadeProfile.bestByEvent[id]||0;
    return '<div class="award-glossary-row '+(seen?'':'locked')+'"><div class="award-glossary-name">'+(seen?esc(def.name):'???')+'</div>'+
      '<div class="award-glossary-points">'+(seen?(commentary?'NO POINTS':def.base.toLocaleString()+' PTS'):'LOCKED')+'</div>'+
      '<div class="award-glossary-desc">'+(seen?esc(def.description):'Discover this signal during an elimination run.')+'</div>'+
      (seen?'<div class="award-glossary-meta">TRIGGERED '+count+(best?' · BEST '+best.toLocaleString():'')+(commentary?' · COMMENTARY ONLY':'')+'</div>':'')+'</div>';
  }).join('');
}

function makeEliminationRun(){
  return {
    active:true, tableNumber:1, highestTableReached:1, tablesCleared:0,
    totalKOs:0, totalHands:0, totalHandsWon:0,
    showdownsPlayed:0, showdownsWon:0, allInsPlayed:0, allInsWon:0,
    biggestPotWon:0, highestStack:ELIMINATION_CONFIG.startingStack, bestHand:null, bustedBy:null,
    tableKOs:0, tableHands:0, tableHandsWon:0,
    tableShowdownsPlayed:0, tableShowdownsWon:0, tableAllInsPlayed:0, tableAllInsWon:0,
    tableBiggestPotWon:0, tableHighestStack:ELIMINATION_CONFIG.startingStack, tableBestHand:null,
    arcade:makeArcadeRunState()
  };
}
function applyRunTheme(){
  // The player's saved palette is authoritative in every mode. Elimination
  // progression used to rotate palettes by table number, which made the
  // Settings control appear broken as soon as a run began.
  document.body.setAttribute('data-theme', settings.theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta){
    const bg = getComputedStyle(document.body).getPropertyValue('--bg-deep').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}

// DEV-only test panel — flip to true locally to reach elimination mode and
// its rapid-test controls without going through Setup (out of scope this
// pass; see Phase 1 plan). Fully absent from the DOM/UI when false.
// Development-only arcade harness. Normal launches never render it; append
// ?dev to the local URL when deliberately testing scoring presentations.
// Also reachable at runtime via Settings > DEV MODE (persisted in
// settings.devMode) — see bindSwitch('sw-devmode', ...) below.
let DEV_MODE = new URLSearchParams(location.search).has('dev') || !!settings.devMode;

// FAST DEV — a runtime toggle inside the DEV panel (not a build flag like
// DEV_MODE above) that blitzes through the "boring setup" between real
// hands — dealing, AI thinking, ordinary betting waits, showdown reveal
// pacing, chip flights, auto-deal transitions — via speedMult()/
// pacedSleep() (see below). It deliberately never touches playElimination
// itself: the K.O./ELIMINATED sequence always runs at its real production
// timing, regardless of this flag. Only meaningful when DEV_MODE is true.
let FAST_DEV = false;
const FAST_DEV_TIME_MULT = 0.08;

