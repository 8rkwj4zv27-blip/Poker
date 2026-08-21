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
   CAREER EVENTS — data only. A Career event is a real freezeout played on
   the ordinary table with the ordinary AI. Table chips and the off-table
   bankroll remain deliberately separate ideas: the bankroll lives under
   'felt.career' and is only touched by the transaction functions in
   07-ui-wiring.js.

   The registry is the live catalogue. enterCareerEvent() copies a plain
   immutable-in-practice snapshot of its selected descriptor into the
   active save; table launch, resume and settlement then use that snapshot,
   not mutable catalogue values. This is what makes an already-paid event
   safe if a later build retunes its buy-in or prize.
   ============================================================ */
const CAREER_START_BANKROLL = 500;
const CAREER_EVENT_LIST = Object.freeze([
  Object.freeze({
    id:'back-room-freezeout',
    venue:'BACK ROOM',
    name:'BACK ROOM FREEZEOUT',
    format:'Freezeout',
    playerCount:3,
    opponentCount:2,
    buyIn:100,
    prize:300,
    stack:500,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'medium',
    unlockRequirement:null
  }),
  Object.freeze({
    id:'pub-freezeout',
    venue:'PUB CIRCUIT',
    name:'PUB CIRCUIT FREEZEOUT',
    format:'Freezeout',
    playerCount:4,
    opponentCount:3,
    buyIn:300,
    prize:1200,
    stack:750,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'hard',
    unlockRequirement:Object.freeze({ type:'event-win', eventId:'back-room-freezeout' })
  })
]);
const CAREER_EVENTS = Object.freeze(CAREER_EVENT_LIST.reduce((registry,event)=>{
  registry[event.id] = event;
  return registry;
}, {}));

function careerEventById(id){
  return typeof id === 'string' ? (CAREER_EVENTS[id] || null) : null;
}
function careerEventSnapshot(event){
  if (!event) return null;
  return {
    id:event.id,
    venue:event.venue,
    name:event.name,
    format:event.format,
    playerCount:event.playerCount,
    opponentCount:event.opponentCount,
    buyIn:event.buyIn,
    prize:event.prize,
    stack:event.stack,
    initialBlindLevel:event.initialBlindLevel,
    handsPerBlindLevel:event.handsPerBlindLevel,
    difficulty:event.difficulty,
    unlockRequirement:event.unlockRequirement
      ? { type:event.unlockRequirement.type, eventId:event.unlockRequirement.eventId }
      : null
  };
}
function isValidCareerEventSnapshot(event){
  if (!event || typeof event !== 'object') return false;
  const strings = ['id','venue','name','format','difficulty'];
  if (strings.some(key=>typeof event[key] !== 'string' || !event[key])) return false;
  const nonNegative = ['buyIn','prize','stack','initialBlindLevel','handsPerBlindLevel','playerCount','opponentCount'];
  if (nonNegative.some(key=>!Number.isFinite(event[key]) || event[key] < 0)) return false;
  if (!Number.isInteger(event.playerCount) || !Number.isInteger(event.opponentCount)) return false;
  if (event.playerCount !== event.opponentCount + 1 || event.opponentCount < 1) return false;
  if (!Number.isInteger(event.initialBlindLevel) || event.initialBlindLevel >= BLIND_LEVELS.length) return false;
  if (!Number.isInteger(event.handsPerBlindLevel) || event.handsPerBlindLevel < 1) return false;
  return true;
}

/* ============================================================
   ELIMINATION MODE — Phase 1 single-table elimination. One fixed-blind
   5-player (1 human + 4 AI) table; busting to $0 is permanent for this
   table. Every gameplay/animation tunable for this mode lives here so it
   can be retuned after playtesting without hunting through call sites.
   ============================================================ */
const ELIMINATION_CONFIG = {
  // Safe default/fallback opponent count. The live count for a run is
  // carried on the run itself (g.run.opponentCount — see makeEliminationRun
  // and normalizeOpponentCount below); this value is only ever the answer
  // to "nobody told us, or told us something impossible".
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
  // TABLE CLEARED machinery engaging — long enough to register the clear,
  // but short enough that the already-complete reward sequence does not
  // acquire a second, sluggish pause of its own.
  clearedBeatMs: 460,
};

/* ---- Single Player table size ----
   The only opponent counts Single Player supports. These are OPPONENTS,
   not seats: 4 -> 5-handed, 5 -> 6-handed, 6 -> 7-handed (the human is
   always the extra seat). Anything else — a missing field on an old save,
   a corrupted value, a stray truthy string — must resolve to the safe
   4-opponent table rather than building an unsupported elimination
   table, so this is a whitelist check, never a truthiness fallback. */
const ELIMINATION_OPPONENT_CHOICES = [4,5,6];
function isOpponentChoice(n){ return ELIMINATION_OPPONENT_CHOICES.indexOf(n) !== -1; }
function normalizeOpponentCount(n){
  // Numbers and numeric strings only — an object/array/boolean that
  // happens to stringify into a digit is still garbage, not a choice.
  const v = typeof n === 'number' ? n
          : typeof n === 'string' ? parseInt(n, 10)
          : NaN;
  return (Number.isFinite(v) && isOpponentChoice(v)) ? v : ELIMINATION_CONFIG.opponents;
}

/* Endless single-player run progression. Gameplay values remain in
   ELIMINATION_CONFIG; this object only owns round presentation/progression. */
const ELIMINATION_RUN_CONFIG = {
  seatStaggerMs: 55,
  seatArrivalMs: 500,
  announcementMs: 760,
  readyBeatMs: 110,
};

/* Mechanical stage-roll transition (table-cleared <-> results <-> next
   table) — the current face drops away while the next joined face descends
   from above, reading as upward progress around a hidden vertical wheel.
   See rollStageTransition() in 06-presentation.js. */
const STAGE_ROLL_CONFIG = {
  breatheMs: 300,   // clean-table acknowledgement after cards return, before the latch releases
  unlockMs: 220,    // face retracts smoothly into the wheel before it is free to turn
  mechanicalPauseMs: 55, // tiny latch-clearance beat, not a visible dead stop
  rollMs: 980,      // main table -> results: smooth, heavy deceleration from above
  nextRollMs: 900,  // player-triggered results -> next table: same mechanism, slightly brisker
  lockMs: 210,      // aligned hold followed by the face pushing forward into the frame
  lockImpactMs: 172,// CLUNK lands as the face reaches the foreground stop
  consoleFlipBeatMs: 120, // final breath before the local action panel changes mode
};

/* ============================================================
   ARCADE RUN SCORING — data, conservative evaluator and presenter

   This observes completed elimination hands only. It never mutates cards,
   chips, betting order or AI choices. Subjective skill awards are based on
   range equity captured before the player's action; exact hidden cards are
   consulted only after resolution for bluff/luck classification.
   ============================================================ */
/* ---- Presentation tiers — STANDARD < STRONG < ELITE < JACKPOT. Purely
   a visual/pacing weight; the id's own `base` is always the real point
   value (see arcadeTierTiming/CSS tier-* classes for the actual
   escalation). Rank order alone (never combined arithmetically with
   base) is what lets normalizeArcadeAwards produce every ordering case
   the spec calls out — e.g. MASSIVE POT (jackpot, 500) still lands
   after HERO CALL (elite, 700) because tier is compared first. */
const ARCADE_TIERS = ['standard','strong','elite','jackpot'];
function arcadeTierRank(tier){ const i=ARCADE_TIERS.indexOf(tier); return i<0?0:i; }
const ARCADE_TIER_TIMING = {
  standard: { revealMs:240, totalMs:250, counterMs:400, flightMs:440, holdMs:90,  haptic:[18] },
  strong:   { revealMs:330, totalMs:330, counterMs:560, flightMs:560, holdMs:110, haptic:[32] },
  elite:    { revealMs:400, totalMs:400, counterMs:660, flightMs:640, holdMs:140, haptic:[40,20] },
  jackpot:  { revealMs:460, totalMs:460, counterMs:780, flightMs:700, holdMs:170, haptic:[46,24,55] }
};
function arcadeTierTiming(tier){ return ARCADE_TIER_TIMING[tier]||ARCADE_TIER_TIMING.standard; }

/* ---- Base chip-to-score conversion (section 4) — isolated here so the
   curve/multiplier can be retuned later without touching detection
   logic. Only ever applied to the POT WINNINGS line; achievement bonuses
   are always fixed regardless of table. */
function arcadeTableMultiplier(tableNumber){
  const t=Math.max(1,tableNumber||1);
  const FIXED={1:1.00,2:1.10,3:1.20,4:1.35,5:1.50,6:1.70};
  if (FIXED[t]!=null) return FIXED[t];
  return Math.min(2.50,1.70+(t-6)*0.20);
}
/* netProfit = bankrollAfterHand - bankrollAtStartOfHand (g._humanStart,
   captured before blinds are even posted — see startNewHand). Losing/
   break-even hands score 0, never negative; the gross pot/amount
   awarded is deliberately never used here (a shove that only nets the
   blinds back must only score that net amount, not the whole shove). */
function arcadePotWinningsScore(g,netProfit){
  if (!(netProfit>0)) return 0;
  const raw=netProfit/Math.max(1,g.bigBlind)*25*arcadeTableMultiplier(g.run&&g.run.tableNumber);
  return Math.round(raw/5)*5;
}
/* Genuinely contested/matched money only (sections 9/21) — re-derives
   pot layers via the existing computePots() so an uncalled/returned
   excess bet (a raise nobody called) never counts toward BIG POT/
   MASSIVE POT. Safe to call any time before the next hand resets
   totalBetHand, for both a showdown and a fold-win outcome — a fold-win
   never deals another card after the winning bet, so g.board/
   totalBetHand are still exactly as they stood at that moment. */
function arcadeContestedPot(g){
  return computePots(g.players).filter(p=>p.eligible.length>=2).reduce((s,p)=>s+p.amount,0);
}

/* ---- Award catalogue — every id fires purely off its own deterministic
   condition (see evaluateArcadeSkill/evaluateArcadeEvents below); there
   is no rarity roll, percentage chance or frequency limiter anywhere in
   this file. `family`: ids sharing a family are mutually exclusive —
   normalizeArcadeAwards keeps only the highest-base one actually earned
   (e.g. goodFold/greatFold/hugeFold never stack). Award ids with no
   family may always stack freely alongside anything else genuinely
   earned. */
const ARCADE_AWARDS = {
  // STANDARD
  goodFold:     { name:'GOOD FOLD',     base:100,  tier:'standard', type:'skill', family:'fold',    description:'A clearly sensible fold in a meaningful spot where continuing was confidently -EV.' },
  goodCall:     { name:'GOOD CALL',     base:100,  tier:'standard', type:'skill', family:'call',    description:'A correct, non-trivial call where continuing was meaningfully justified.' },
  goodPressure: { name:'GOOD PRESSURE', base:100,  tier:'standard', type:'skill', family:null,      description:'Appropriately sized aggression wins a worthwhile pot without showdown.' },
  goodValue:    { name:'GOOD VALUE',    base:125,  tier:'standard', type:'skill', family:'value',   description:'A genuine value bet gets called by a worse hand.' },
  punish:       { name:'PUNISH',        base:150,  tier:'standard', type:'skill', family:null,      description:"Correctly exploits an opponent's clear weakness or passivity for meaningful value." },
  // STRONG
  greatFold:    { name:'GREAT FOLD',    base:250,  tier:'strong',   type:'skill', family:'fold',    description:'Gets away from a reasonably strong holding in a genuinely dangerous spot.' },
  greatCall:    { name:'GREAT CALL',    base:250,  tier:'strong',   type:'skill', family:'call',    description:'A difficult but well-justified call against significant pressure.' },
  trapWorked:   { name:'TRAP WORKED',   base:250,  tier:'strong',   type:'skill', family:null,      description:'A deliberately passive line with strong value induces meaningful extra action.' },
  goodShove:    { name:'GOOD SHOVE',    base:250,  tier:'strong',   type:'skill', family:'shove',   description:'A strategically justified all-in given stack, equity and pressure.' },
  goodBluff:    { name:'GOOD BLUFF',    base:300,  tier:'strong',   type:'skill', family:'bluff',   description:'Meaningful pressure with poor showdown value forces out a worthwhile holding.' },
  // ELITE
  hugeFold:     { name:'HUGE FOLD',     base:600,  tier:'elite',    type:'skill', family:'fold',    description:'An exceptional laydown of a very strong-looking hand under real pressure.' },
  greatShove:   { name:'GREAT SHOVE',   base:600,  tier:'elite',    type:'skill', family:'shove',   description:'An exceptional, high-leverage all-in with very strong strategic justification.' },
  maxValue:     { name:'MAX VALUE',     base:650,  tier:'elite',    type:'skill', family:'value',   description:'Extracts close to the maximum realistic value from a dominated opponent.' },
  heroCall:     { name:'HERO CALL',     base:700,  tier:'elite',    type:'skill', family:'call',    description:'A major, marginal bluff-catching call that genuinely nails a bluff.' },
  greatBluff:   { name:'GREAT BLUFF',   base:700,  tier:'elite',    type:'skill', family:'bluff',   description:'A high-pressure bluff forces off a genuinely strong or hard-to-fold holding.' },
  // JACKPOT
  monsterBluff: { name:'MONSTER BLUFF', base:1500, tier:'jackpot',  type:'skill', family:'bluff',   description:'An extremely demanding, fully-earned river bluff through a genuine strong hand.' },

  // EVENTS — describe what happened; may stack freely with skill awards
  bigPot:       { name:'BIG POT',       base:150,  tier:'strong',   type:'event', family:'potSize', description:'A genuinely large contested pot relative to current blinds.' },
  monsterHand:  { name:'MONSTER HAND',  base:200,  tier:'strong',   type:'event', family:null,      description:'A genuinely exceptional made hand — full house or better.' },
  doubleUp:     { name:'DOUBLE UP',     base:300,  tier:'elite',    type:'event', family:null,      description:'Roughly doubles the stack held at the start of the hand.' },
  ko:           { name:'K.O.!',         base:400,  tier:'elite',    type:'event', family:null,      description:'Directly eliminates an opponent through the decisive pot.' },
  massivePot:   { name:'MASSIVE POT',   base:500,  tier:'jackpot',  type:'event', family:'potSize', description:'A truly exceptional contested pot relative to current stakes.' },
  tableClear:   { name:'TABLE CLEARED', base:1000, tier:'jackpot',  type:'event', family:null,      description:'Eliminates the final opponent and clears the table.' }
};
/* Zero-point — never touch the score. Luck (this run) is separate from
   skill: a good/bad decision keeps its own label no matter how the cards
   fell. Winning-side tags use range equity at the biggest genuine
   commitment; losing-side tags mirror that on the other side. */
const ARCADE_LUCK = {
  lucky:      { name:'LUCKY',      kind:'good',        min:.25, max:.40,  description:'Wins after a meaningful commitment with roughly 25–40% equity.' },
  veryLucky:  { name:'VERY LUCKY', kind:'good',         min:.10, max:.25,  description:'Wins after a meaningful commitment with roughly 10–25% equity.' },
  filthy:     { name:'FILTHY',     kind:'extreme-good', min:0,   max:.10,  description:'An extremely improbable suck-out or escape.' },
  unlucky:    { name:'UNLUCKY',    kind:'bad',          min:.65, max:.90,  description:'Loses after a meaningful commitment as a real favourite.' },
  brutal:     { name:'BRUTAL',     kind:'extreme-bad',  min:.90, max:1.01, description:'A severe bad beat — loses as an overwhelming favourite.' }
};
/* Zero-point, never subtracts, never enters the TOTAL. Only ever the
   single most severe candidate found this hand (see
   evaluateArcadeNegative) — deliberately much quieter/rarer than the
   positive catalogue above. */
const ARCADE_NEGATIVE = {
  looseCall:    { name:'LOOSE CALL',    family:'calling',    description:'Clearly too loose for the price offered, though not catastrophic.' },
  badCall:      { name:'BAD CALL',      family:'calling',    description:'A substantial -EV call with strong evidence continuing was poor.' },
  paidThemOff:  { name:'PAID THEM OFF', family:'calling',    description:'A major late-street call that significantly overpays a clear value line.' },
  badFold:      { name:'BAD FOLD',      family:'folding',    description:'Gives up a hand in a spot where continuing was clearly profitable.' },
  tooTight:     { name:'TOO TIGHT',     family:'folding',    description:'An especially conservative fold where the price strongly supported continuing.' },
  badBluff:     { name:'BAD BLUFF',     family:'aggression', description:'A substantial bluff with very poor justification gets called.' },
  reckless:     { name:'RECKLESS',      family:'aggression', description:'Exposes an excessive share of the stack with very weak strategic justification.' },
  badShove:     { name:'BAD SHOVE',     family:'aggression', description:'A clearly poor all-in decision.' },
  overplayed:   { name:'OVERPLAYED',    family:'aggression', description:'A decent, non-premium hand pushed far beyond a reasonable value threshold.' },
  missedValue:  { name:'MISSED VALUE',  family:'missed',     description:'A clear, high-confidence value spot is passed up or drastically underbet.' },
  tooPassive:   { name:'TOO PASSIVE',   family:'missed',     description:'An especially obvious missed aggression/value spot.' }
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
/* ---------------- REWARD CAPABILITY vs ARCADE PERSISTENCE ----------------
   These two used to be the same expression — g.mode==='elimination' && g.run
   && g.run.arcade — doing three unrelated jobs at once: "show the reward
   spectacle", "write to the felt.arcade profile", and "this is a multi-table
   run". Career events need the first and must never touch the second, so the
   ideas are now named separately. Widening the wrong one is how Career would
   silently corrupt the Arcade high score, so read the distinction before
   adding any new call site. */

/* PRESENTATION capability — reward breakdown, TOTAL, pot smash, SCORE
   readout. True for Arcade elimination runs AND Career events. Returns the
   mode's own reward-state object (never a shared or faked one), or null. */
function rewardState(g){
  g = g || game;
  if (!g) return null;
  if (g.mode === 'elimination') return (g.run && g.run.arcade) || null;
  if (g.mode === 'career')      return (g.event && g.event.reward) || null;
  return null;
}

/* PERSISTENCE capability — the felt.arcade profile: high score, discoveries,
   per-award bests. Strictly narrower than rewardState(). Only the existing
   elimination run may ever write there; a Career event shows the identical
   spectacle and persists none of it.

   Note on AI: Career deliberately does NOT opt into aiDecide's
   elimination-only short-stack push/fold widening (03-opponents.js) — a
   Career event uses standard AI. Career is not "elimination mode with a
   different name". */
function arcadePersists(g){
  g = g || game;
  return !!(g && g.mode === 'elimination' && g.run && g.run.arcade);
}

/* Career's own ephemeral reward state. Separate factory from
   makeArcadeRunState() on purpose — it carries only what the presentation
   path reads, and omits newHighScore, which exists solely to serve Arcade
   persistence. It is serialised with the event so a resumed event keeps its
   accumulated TOTAL, and is discarded when the event settles. */
function makeEventRewardState(){
  return {
    score:0, comboStep:0, highestComboStep:0, biggestReward:0,
    awardCounts:{}, decisionSnapshots:[], displayedScore:0
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
  const a=rewardState(game);
  setArcadeMode(!!a);
  if (!a) return;
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
  const a=rewardState(g);
  if (!a||!player||!player.isHuman) return;
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
  a.decisionSnapshots.push(snap);
}
async function settleArcadeSnapshots(g){
  const a=rewardState(g);
  const snaps=(a&&a.decisionSnapshots)||[];
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
    if (equity<.10) return {id:'filthy',equity};
    if (equity<.25) return {id:'veryLucky',equity};
    if (equity<.40) return {id:'lucky',equity};
  } else {
    if (equity>=.90) return {id:'brutal',equity};
    if (equity>=.65) return {id:'unlucky',equity};
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
/* The player's own hand strength using only what they had in front of
   them at that exact snapshot (their two hole cards + the board as it
   stood then) — legitimate prospective information, not a peek at
   anything hidden. Used by the HUGE FOLD gate below to confirm "a very
   strong-looking hand" was actually being laid down. */
function heroCatAtSnapshot(s){
  if (!s.hole||s.hole.length<2||s.hole.length+s.board.length<5) return -1;
  return evaluate7([...s.hole,...s.board]).cat;
}
function actionWasCalled(g,snapshot){
  return (g.handActions||[]).slice(snapshot.handActionIndex+1).some(a=>
    a.street===snapshot.street&&a.id!=='you'&&a.action==='call'
  );
}
/* Who called this particular value bet — for PUNISH's "exploited a
   clearly loose/passive opponent" check, reusing the AI's own existing
   personality.tightness rather than inventing a new tendency model. */
function findCallerOf(g,snapshot){
  const call=(g.handActions||[]).slice(snapshot.handActionIndex+1).find(a=>
    a.street===snapshot.street&&a.id!=='you'&&a.action==='call'
  );
  return call ? g.players.find(p=>p.id===call.id) : null;
}
/* Retrospective-only: confirms a fold-win aggression really did fold a
   worthwhile/better made hand, using the actual opponent hole cards —
   never used to grade the decision itself, only to confirm the fact
   happened (section 12). Board is frozen at exactly the street the
   winning aggression happened on (a fold-win deals no further community
   cards), so this evaluates opponents' hands exactly as they stood. */
function findArcadeFoldBluff(g,outcome,snapshots){
  if (!humanWonOutcome(outcome)||outcome.type!=='foldwin') return null;
  const human=g.players.find(p=>p.isHuman);
  return snapshots.filter(s=>s.action==='raise'&&s.street!=='preflop'&&s.commit>=Math.max(4*s.bigBlind,s.startStack*.12)&&s.pot>=6*s.bigBlind&&s.equity<=.35)
    .reverse().find(s=>{
      const heroNow=actualHandAtResolution(human,g); if (!heroNow) return false;
      return g.players.some(p=>!p.isHuman&&p.folded&&s.opponentIds.includes(p.id)&&actualHandAtResolution(p,g)&&compareHands(actualHandAtResolution(p,g),heroNow)>0);
    })||null;
}
/* MONSTER BLUFF's own, much stricter gate on top of findArcadeFoldBluff's
   base qualification (section 8): river only, essentially no showdown
   value, a major bet relative to both pot and stack, a meaningful pot
   already built, and — retrospectively — at least one folded opponent
   genuinely held two pair or better. */
function isMonsterBluff(g,bluff){
  if (!bluff||bluff.street!=='river'||bluff.equity>.15) return false;
  if (bluff.commit<Math.max(bluff.pot*.9,bluff.startStack*.4)) return false;
  if (bluff.pot<8*bluff.bigBlind) return false;
  return bluff.opponentIds.some(id=>{
    const v=g.players.find(p=>p.id===id);
    if (!v||!v.folded) return false;
    const h=actualHandAtResolution(v,g);
    return h&&h.cat>=2;
  });
}
/* The whole positive skill/decision catalogue (sections 5-8, 12). FOLD
   and CALL families are graded purely from decision-time snapshot data
   (equity vs. random ranges, pot odds, sizing) and fire regardless of
   this hand's eventual winner — a good fold/call stays good even on a
   hand the human goes on to lose. The aggression side (bluff/pressure/
   shove/value/trap/punish) only makes sense on a hand the human actually
   won, so it's gated on `won` internally. HERO CALL/bluff tiers use
   opponents' real cards ONLY to retrospectively confirm the read, never
   to grade a sensible call/fold as wrong. */
function evaluateArcadeSkill(g,outcome,snapshots){
  const awards=[], human=g.players.find(p=>p.isHuman), won=humanWonOutcome(outcome);
  const claimedActionIdx=new Set();

  // FOLD family
  const foldCandidates=snapshots.filter(s=>s.action==='fold'&&s.street!=='preflop'&&s.toCall>0&&s.equity!=null)
    .map(s=>({ s, edge:s.potOdds-s.equity }))
    .filter(x=>x.edge>=.11&&x.s.toCall>=Math.max(3*x.s.bigBlind,x.s.startStack*.10)&&x.s.pot>=6*x.s.bigBlind)
    .sort((a,b)=>b.edge-a.edge);
  if (foldCandidates.length){
    const {s,edge}=foldCandidates[0];
    if (edge>=.30&&s.toCall>=s.startStack*.35&&heroCatAtSnapshot(s)>=2) addArcadeAward(awards,'hugeFold');
    else if (edge>=.24&&s.toCall>=s.startStack*.20) addArcadeAward(awards,'greatFold');
    else addArcadeAward(awards,'goodFold');
  }

  // CALL family — HERO CALL requires a won showdown and retrospective bluff confirmation
  const calls=snapshots.filter(s=>s.action==='call'&&s.toCall>0&&s.equity!=null);
  const heroCall=calls.slice().reverse().find(s=>{
    if (!won||outcome.type!=='showdown'||!s.lastAggressorId||s.commit<Math.max(5*s.bigBlind,s.startStack*.15)) return false;
    const heroCat=heroCatAtSnapshot(s);
    if (heroCat<0||heroCat>2||s.equity>.55) return false;
    const villain=g.players.find(p=>p.id===s.lastAggressorId), vh=actualHandAtResolution(villain,g), hh=actualHandAtResolution(human,g);
    return vh&&hh&&compareHands(hh,vh)>0&&vh.cat<=1;
  });
  if (heroCall){ addArcadeAward(awards,'heroCall'); claimedActionIdx.add(heroCall.handActionIndex); }
  else {
    const callCandidates=calls.map(s=>({s,edge:s.equity-s.potOdds}))
      .filter(x=>x.s.commit>=Math.max(3*x.s.bigBlind,x.s.startStack*.08)&&x.edge>=.05&&x.s.equity<=.75)
      .sort((a,b)=>b.edge-a.edge);
    if (callCandidates.length){
      const {s,edge}=callCandidates[0];
      if (edge>=.05&&s.equity<=.60&&s.commit>=Math.max(5*s.bigBlind,s.startStack*.18)&&s.street!=='preflop') addArcadeAward(awards,'greatCall');
      else if (edge>=.10&&s.equity<=.72) addArcadeAward(awards,'goodCall');
    }
  }

  if (won){
    if (outcome.type==='foldwin'){
      const aggression=snapshots.filter(s=>s.action==='raise').slice(-1)[0];
      if (aggression&&(outcome.amount||0)>=2*g.bigBlind){
        const bluff=findArcadeFoldBluff(g,outcome,snapshots);
        if (bluff){
          claimedActionIdx.add(bluff.handActionIndex);
          if (isMonsterBluff(g,bluff)) addArcadeAward(awards,'monsterBluff');
          else if (bluff.street==='river'&&bluff.commit>=Math.max(bluff.pot*.75,bluff.startStack*.3)) addArcadeAward(awards,'greatBluff');
          else addArcadeAward(awards,'goodBluff');
        } else if (aggression.commit>=Math.max(3*g.bigBlind,aggression.pot*.35)){
          addArcadeAward(awards,'goodPressure');
        }
      }
    } else if (outcome.type==='showdown'){
      const bets=snapshots.filter(s=>s.action==='raise'&&s.commit>0&&s.equity!=null);
      const valueBet=bets.filter(s=>s.street!=='preflop'&&actionWasCalled(g,s)&&s.equity>=.67&&s.commit>=Math.max(2*s.bigBlind,s.pot*.28))
        .sort((a,b)=>(b.street==='river')-(a.street==='river')||b.commit-a.commit)[0];
      if (valueBet){
        claimedActionIdx.add(valueBet.handActionIndex);
        if (valueBet.street==='river'&&valueBet.equity>=.84&&valueBet.commit>=Math.max(6*valueBet.bigBlind,valueBet.pot*.6)) addArcadeAward(awards,'maxValue');
        else addArcadeAward(awards,'goodValue');
        const earlierTrap=snapshots.some(s=>s.action==='check'&&s.street!=='river'&&s.equity>=.72&&s.handActionIndex<valueBet.handActionIndex);
        if (earlierTrap&&valueBet.commit>=4*valueBet.bigBlind) addArcadeAward(awards,'trapWorked');
        const caller=findCallerOf(g,valueBet);
        if (caller&&caller.personality&&caller.personality.tightness<.32) addArcadeAward(awards,'punish');
      }
    }
    // GOOD/GREAT SHOVE — only the human's own stood all-in, and only if it
    // isn't already the specific action a bluff/value award above claimed
    // (section 6: "prefer the more specific bluff/value classification
    // rather than double-counting the same action"). Excludes routine
    // short-stack push/fold shoves (startStack<=12bb) entirely.
    const shove=snapshots.filter(s=>s.action==='raise'&&s.allIn&&s.equity!=null&&!claimedActionIdx.has(s.handActionIndex)&&s.startStack>12*s.bigBlind).slice(-1)[0];
    if (shove){
      if (shove.equity>=.60&&shove.commit>=15*shove.bigBlind&&shove.commit>=shove.startStack*.5) addArcadeAward(awards,'greatShove');
      else if (shove.equity>=.42&&shove.commit>=8*shove.bigBlind) addArcadeAward(awards,'goodShove');
    }
  }
  return awards;
}
/* Event awards (section 9) — all gated on the human having actually won
   this hand's pot. Pot size uses arcadeContestedPot(), never the gross/
   uncalled amount, so an unopposed shove can't manufacture a BIG POT. */
function evaluateArcadeEvents(g,outcome,awards){
  const human=g.players.find(p=>p.isHuman);
  if (!humanWonOutcome(outcome)) return;
  const contested=arcadeContestedPot(g);
  if (contested>=30*g.bigBlind) addArcadeAward(awards,'massivePot');
  else if (contested>=12*g.bigBlind) addArcadeAward(awards,'bigPot');

  if (outcome.type==='showdown'){
    const hand=actualHandAtResolution(human,g);
    if (hand&&hand.cat>=6) addArcadeAward(awards,'monsterHand');
  }

  const start=g._humanStart==null?human.chips:g._humanStart, gain=human.chips-start;
  if (start>0&&human.chips>=start*1.9&&gain>=10*g.bigBlind) addArcadeAward(awards,'doubleUp');
}
/* K.O./TABLE CLEAR — these genuinely need resolveEliminations()'s output
   (context.koCount/tableClear), which only exists inside finishHand(),
   structurally after the pot-smash sequence has already run — so they
   always stay a late, separate stinger (see resolveArcadeHandLate)
   rather than folding into the pre-smash TOTAL. TABLE CLEARED's own
   full-screen ceremony (showTableCleared, js/05-game-engine.js) is a
   separate, unrelated flow — this only ever awards its point value. */
function evaluateArcadeMilestoneAchievements(context,awards){
  if (context&&context.koCount) addArcadeAward(awards,'ko',context.koCount);
  if (context&&context.tableClear) addArcadeAward(awards,'tableClear');
}
/* Family exclusivity + presentation ordering (sections 13-14) in one
   pass: within a family, keep only the highest-base award actually
   earned; then sort ascending by tier rank and, within a tier, by base
   score — which alone reproduces every ordering example in the spec
   (MASSIVE POT before MONSTER BLUFF; HERO CALL before MASSIVE POT). */
function normalizeArcadeAwards(awards){
  const bestByFamily=new Map();
  awards.forEach(a=>{
    if (!a.def.family) return;
    const cur=bestByFamily.get(a.def.family);
    if (!cur||a.def.base>cur.def.base) bestByFamily.set(a.def.family,a);
  });
  const kept=awards.filter(a=>!a.def.family||bestByFamily.get(a.def.family)===a);
  // No item cap — every earned award is shown; the pot-smash reward
  // breakdown (see presentRewardBreakdown in 06-presentation.js) budgets
  // TIME instead, compressing per-item pacing for a long list rather than
  // truncating it.
  return kept.sort((a,b)=>arcadeTierRank(a.def.tier)-arcadeTierRank(b.def.tier)||a.def.base-b.def.base);
}
/* The negative catalogue (section 11) — at most ONE shown per hand, the
   single most severe candidate found across every category, never
   picked by chance. Suppressed entirely when the hand already carries a
   strong bad-luck tag, so a decision that was actually fine doesn't get
   relabeled just because the result was ugly (section 12/21). */
function evaluateArcadeNegative(g,outcome,snapshots,luck){
  if (luck&&(luck.id==='unlucky'||luck.id==='brutal')) return null;
  const human=g.players.find(p=>p.isHuman);
  const candidates=[];
  const push=(id,severity)=>candidates.push({id,severity});
  snapshots.forEach(s=>{
    if (s.equity==null) return;
    if (s.action==='call'&&s.toCall>0){
      const gap=s.potOdds-s.equity;
      // A call whose read is retrospectively confirmed right (it actually
      // beat the specific aggressor being called) is never a calling
      // mistake, no matter how marginal the raw pre-decision equity
      // looked — this is exactly what stops a genuine HERO CALL from also
      // showing up as BAD CALL/LOOSE CALL/PAID THEM OFF on the same call.
      const villain=s.lastAggressorId&&g.players.find(p=>p.id===s.lastAggressorId);
      const villainHand=villain&&actualHandAtResolution(villain,g), heroHand=actualHandAtResolution(human,g);
      const confirmedGoodRead=!!(villainHand&&heroHand&&compareHands(heroHand,villainHand)>0);
      if (!confirmedGoodRead){
        if (s.street==='river'&&s.lastAggressorId&&s.commit>=Math.max(6*s.bigBlind,s.pot*.5)&&s.equity<=.30&&gap>=.20) push('paidThemOff',80+(.30-s.equity)*40);
        if (s.commit>=3*s.bigBlind&&gap>=.16) push('badCall',40+gap*100);
        else if (s.commit>=2*s.bigBlind&&gap>=.08) push('looseCall',15+gap*80);
      }
    }
    if (s.action==='fold'&&s.toCall>0){
      const edge=s.equity-s.potOdds;
      if (edge>=.15&&s.toCall>=2*s.bigBlind) push('badFold',45+edge*100);
      else if (edge>=.10&&s.toCall<=s.startStack*.05) push('tooTight',25+edge*80);
    }
    if (s.action==='raise'&&s.commit>0){
      if (s.allIn&&s.startStack>=15*s.bigBlind&&s.equity<=.32&&s.commit>=s.startStack*.6) push('badShove',90+(.32-s.equity)*100);
      else if (!s.allIn&&s.commit>=s.startStack*.45&&s.equity<=.35) push('reckless',70+(.35-s.equity)*80);
      else if (s.equity<=.25&&s.commit>=Math.max(4*s.bigBlind,s.pot*.5)&&actionWasCalled(g,s)) push('badBluff',65);
      // Capped below .67 (GOOD VALUE's own floor) so a hand good enough to
      // register as genuine value can never also be flagged OVERPLAYED.
      else if (s.equity>=.55&&s.equity<.67&&s.commit>=s.startStack*.5&&s.street!=='preflop') push('overplayed',50);
    }
    if (s.action==='check'&&s.street==='river'&&s.equity>=.85&&s.opponentIds.length>0) push('missedValue',55);
    if (s.action==='call'&&s.equity>=.80&&s.potOdds<=.25&&s.street!=='river'&&s.commit>=2*s.bigBlind) push('tooPassive',35);
  });
  if (!candidates.length) return null;
  candidates.sort((a,b)=>b.severity-a.severity);
  return {id:candidates[0].id};
}
/* Early phase — human-pot-win only. Called from runShowdownAwardSequence
   (js/06-presentation.js) right after the real money mutation, well
   before resolveEliminations() runs, so it deliberately never touches
   ko/tableClear (see evaluateArcadeMilestoneAchievements). Prepends a
   synthetic POT WINNINGS line — the player's real net profit for the
   hand (bankrollAfterHand - bankrollAtStartOfHand), converted at 1 big
   blind = 25 score and scaled by the current table multiplier (section
   4), never the gross/uncalled pot — ahead of the normal award catalog
   so the smash's reward breakdown reads as one coherent list. Records
   awardCounts/discovery exactly like before, but never touches a.score
   itself — folding points into the permanent SCORE HUD is the smash
   sequence's own job (see runPotSmashSequence), timed to the impact
   moment rather than to this evaluation. */
async function evaluateArcadeAwardsEarly(g,outcome){
  const a=rewardState(g);
  if (!a||!humanWonOutcome(outcome)) return null;
  const snapshots=await settleArcadeSnapshots(g), awards=[];
  evaluateArcadeSkill(g,outcome,snapshots).forEach(x=>addArcadeAward(awards,x.id,x.count));
  evaluateArcadeEvents(g,outcome,awards);
  const finalAwards=normalizeArcadeAwards(awards);
  const luck=classifyArcadeLuck(g,outcome,snapshots);
  const negative=evaluateArcadeNegative(g,outcome,snapshots,luck);
  const human=g.players.find(p=>p.isHuman);
  const netProfit=human.chips-(g._humanStart==null?human.chips:g._humanStart);
  const potScore=arcadePotWinningsScore(g,netProfit);
  const bonusTotal=finalAwards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  const potWinnings={id:'potWinnings',count:1,def:{name:'POT WINNINGS',base:potScore,tier:'standard',type:'pot'}};
  // awardCounts lives on the mode's own reward state, so it tracks for
  // Career too. The discovery/profile writes below are Arcade-only — see
  // arcadePersists(): a Career event must never touch felt.arcade.
  finalAwards.forEach(x=>{ a.awardCounts[x.id]=(a.awardCounts[x.id]||0)+x.count; });
  if (arcadePersists(g)){
    finalAwards.forEach(x=>noteArcadeDiscovery(x.id,x.count,x.def.base*x.count));
    if (luck) noteArcadeDiscovery(luck.id,1,null);
    if (negative) noteArcadeDiscovery(negative.id,1,null);
  }
  const awardsOut=potScore>0?[potWinnings,...finalAwards]:finalAwards;
  return { awards:awardsOut, luck, commentary:negative, total:potScore+bonusTotal };
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
  const a=rewardState(g);
  if (!a) return;
  const awards=[];
  let luck=null, commentary=null;
  if (humanWonOutcome(outcome)){
    evaluateArcadeMilestoneAchievements(context,awards);
  } else {
    const snapshots=await settleArcadeSnapshots(g);
    evaluateArcadeSkill(g,outcome,snapshots).forEach(x=>addArcadeAward(awards,x.id,x.count));
    evaluateArcadeMilestoneAchievements(context,awards);
    luck=classifyArcadeLuck(g,outcome,snapshots);
    commentary=evaluateArcadeNegative(g,outcome,snapshots,luck);
  }
  const finalAwards=normalizeArcadeAwards(awards);
  const total=finalAwards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  const resolution={awards:finalAwards,luck,commentary,total,dev:false};
  finalAwards.forEach(x=>{ a.awardCounts[x.id]=(a.awardCounts[x.id]||0)+x.count; });
  if (arcadePersists(g)){
    finalAwards.forEach(x=>noteArcadeDiscovery(x.id,x.count,x.def.base*x.count));
    if (luck) noteArcadeDiscovery(luck.id,1,null);
    if (commentary) noteArcadeDiscovery(commentary.id,1,null);
  }
  if (!finalAwards.length&&!luck&&!commentary) return;
  await queueArcadePresentation(()=>presentArcadeResolution(g,resolution));
}
function queueArcadePresentation(fn){
  arcadePresentationQueue=arcadePresentationQueue.catch(()=>{}).then(fn);
  return arcadePresentationQueue;
}
function arcadeDelay(ms){ return sleep(motionOff()?Math.min(30,ms):ms); }
/* Reward headlines must never wrap on a narrow phone screen (section 18)
   — CSS alone (clamp()+vw) scales with viewport width but not with the
   message's own length, so a long label like MONSTER BLUFF/MASSIVE POT
   at a short-label font size would overflow rather than wrap. Called
   right after every place that sets #arcade-hero's text: nudges its
   font-size down in 1px steps (a plain inline style, so it always loses
   to the next reveal's clean clearArcadeLayer() reset) until it actually
   fits the layer's own width, capped so it can't shrink into
   unreadability. */
function fitArcadeHeroText(el){
  if (!el) return;
  el.style.fontSize = '';
  const maxWidth = el.parentElement ? el.parentElement.clientWidth : el.clientWidth;
  if (!maxWidth) return;
  let guard = 0;
  while (el.scrollWidth > maxWidth && guard < 40){
    const current = parseFloat(getComputedStyle(el).fontSize);
    if (!current || current <= 11) break;
    el.style.fontSize = (current-1) + 'px';
    guard++;
  }
}
function clearArcadeLayer(){
  const layer=$('arcade-reward-layer'); if (!layer) return;
  layer.className='arcade-reward-layer hidden';
  ['arcade-luck','arcade-hero','arcade-secondaries','arcade-total'].forEach(id=>{ if ($(id)) $(id).innerHTML=''; });
}
async function rollArcadeCounter(a,target,tier){
  const from=a.displayedScore||0, duration=motionOff()?0:arcadeTierTiming(tier).counterMs;
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
  const dur=arcadeTierTiming(tier).flightMs;
  const anim=flight.animate([
    {transform:'translate(0,0) scale(1)',opacity:1},
    {transform:'translate('+(dx*.3)+'px,'+(dy*.18-22)+'px) scale(1.12)',opacity:1,offset:.32},
    {transform:'translate('+dx+'px,'+dy+'px) scale(.34)',opacity:.25}
  ],{duration:dur,easing:'cubic-bezier(.2,.75,.25,1)',fill:'forwards'});
  try{ await anim.finished; }catch(e){}
  flight.remove();
}
async function presentArcadeAward(g,award){
  const a=rewardState(g);
  if (!g||game!==g||!a) return;
  const layer=$('arcade-reward-layer'), tier=award.def.tier||'standard';
  if (!layer) return;
  const timing=arcadeTierTiming(tier);
  const points=award.def.base*award.count;
  clearArcadeLayer();
  layer.className='arcade-reward-layer tier-'+tier+' cat-'+award.def.type;
  layer.classList.remove('hidden');
  $('arcade-hero').textContent=award.def.name;
  fitArcadeHeroText($('arcade-hero'));
  void layer.offsetWidth; layer.classList.add('is-live');
  Sound.arcadeReward(tier,award.id); haptic(timing.haptic);
  await arcadeDelay(timing.revealMs);
  $('arcade-total').textContent='+'+points.toLocaleString();
  $('arcade-total').classList.add('is-ready');
  await arcadeDelay(timing.totalMs);
  await flyArcadeScore(points,tier);
  const target=a.score+points; a.score=target;
  const machine=$('arcade-score-machine');
  if (machine){
    machine.classList.remove('score-impact','score-jackpot'); void machine.offsetWidth;
    machine.classList.add(tier==='jackpot'?'score-jackpot':'score-impact');
  }
  clearArcadeLayer();
  await rollArcadeCounter(a,target,tier);
  await arcadeDelay(timing.holdMs);
}
async function presentArcadeCommentary(g,item,isLuck){
  if (!item||!g||game!==g) return;
  const def=isLuck?ARCADE_LUCK[item.id]:ARCADE_NEGATIVE[item.id];
  if (!def) return;
  const layer=$('arcade-reward-layer'); if (!layer) return;
  const extreme=isLuck&&def.kind.indexOf('extreme')===0;
  clearArcadeLayer();
  layer.className='arcade-reward-layer commentary-only '+(isLuck?'luck-'+def.kind:'comment-negative');
  layer.classList.remove('hidden');
  $('arcade-hero').textContent=def.name;
  fitArcadeHeroText($('arcade-hero'));
  void layer.offsetWidth; layer.classList.add('is-live');
  Sound.arcadeLuck(isLuck?def.kind:'negative');
  await arcadeDelay(extreme?700:520);
  clearArcadeLayer();
  await arcadeDelay(80);
}
async function presentArcadeResolution(g,r){
  const a=rewardState(g);
  if (!g||game!==g||!a) return;
  a.biggestReward=Math.max(a.biggestReward,r.total||0);
  for (const award of r.awards) await presentArcadeAward(g,award);
  if (r.luck) await presentArcadeCommentary(g,r.luck,true);
  else if (r.commentary) await presentArcadeCommentary(g,r.commentary,false);
}
function finalizeArcadeRun(g){
  // Arcade persistence only — never reached for a Career event. Explicit
  // rather than incidental: see arcadePersists().
  if (!arcadePersists(g)) return;
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
/* Explicit DEV display tests (section 20) — these preview the visual
   tiers directly and never falsify real gameplay scoring; genuine
   trigger logic is verified separately by playing rigged hands (see the
   REAL GAMEPLAY TEST controls in js/08-dev-mode.js). */
const DEV_ARCADE_SCENARIOS = {
  standard:    {awards:['goodFold']},
  strong:      {awards:['goodBluff']},
  elite:       {awards:['heroCall']},
  jackpot:     {awards:['monsterBluff']},
  // Seven independent (no shared family) awards, deliberately out of
  // order here — normalizeArcadeAwards' own tier/base sort is what
  // actually builds the escalating nice->nice->bigger->OH->OH SHIT reveal.
  escalating:  {awards:['goodPressure','punish','trapWorked','maxValue','ko','massivePot','monsterBluff']},
  massivePot:  {awards:['massivePot']},
  heroCall:    {awards:['heroCall']},
  monsterBluff:{awards:['monsterBluff']},
  ko:          {awards:['ko']},
  luckyWin:    {awards:['goodCall'],luck:'lucky'},
  badBeat:     {awards:['greatCall'],luck:'brutal'},
  negative:    {awards:[],commentary:'badCall'}
};
/* Reward-PRESENTATION dev tools. These drive the same breakdown/TOTAL/pot
   smash path a real hand does and never touch the felt.arcade profile
   (noteArcadeDiscovery is only reached from the two real evaluators, both
   gated on arcadePersists), so they run wherever rewardState() does —
   Arcade runs and Career events alike. */
function devArcadePresent(ids,luckId,negativeId){
  if (!DEV_MODE||!rewardState(game)) return;
  const g=game;
  let awards=(ids||[]).map(id=>ARCADE_AWARDS[id]?{id,count:1,def:ARCADE_AWARDS[id]}:null).filter(Boolean);
  awards=normalizeArcadeAwards(awards);
  const total=awards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  queueArcadePresentation(()=>presentArcadeResolution(g,{
    awards,luck:luckId&&ARCADE_LUCK[luckId]?{id:luckId,equity:0}:null,
    commentary:negativeId&&ARCADE_NEGATIVE[negativeId]?{id:negativeId}:null,
    total,dev:true
  }));
}
function devArcadeAward(id){ devArcadePresent([id],null); }
function devArcadeLuck(id){ devArcadePresent([],id); }
function devArcadeNegative(id){ devArcadePresent([],null,id); }
function devArcadeScenario(id){
  const scenario=DEV_ARCADE_SCENARIOS[id];
  if (scenario) devArcadePresent(scenario.awards,scenario.luck||null,scenario.commentary||null);
}
function devArcadeAddScore(amount){
  const a0=rewardState(game);
  if (!DEV_MODE||!a0) return;
  const g=game, a=a0, increment=Math.max(0,Math.round(amount||0));
  queueArcadePresentation(async()=>{
    if (game!==g||rewardState(g)!==a) return;
    const target=a.score+increment; a.score=target; a.biggestReward=Math.max(a.biggestReward,increment);
    const machine=$('arcade-score-machine');
    if (machine){ machine.classList.remove('score-impact'); void machine.offsetWidth; machine.classList.add('score-impact'); }
    await rollArcadeCounter(a,target,increment>=1000?'jackpot':increment>=400?'elite':increment>=100?'strong':'standard');
    refreshDevPanel();
  });
}
function devArcadeResetScore(){
  if (!DEV_MODE||!rewardState(game)) return;
  const g=game;
  queueArcadePresentation(async()=>{
    const a=rewardState(g);
    if (game!==g||!a) return;
    a.score=0; a.displayedScore=0; a.biggestReward=0;
    updateArcadeHUD(); refreshDevPanel();
  });
}
function devArcadeReset(){
  if (!DEV_MODE||!game) return;
  // Rebuilds whichever reward state the mode owns — an Arcade run's, or a
  // Career event's ephemeral one. Never crosses between them.
  if (game.mode==='elimination'){ if (!game.run) return; game.run.arcade=makeArcadeRunState(); }
  else if (game.mode==='career'){ if (!game.event) return; game.event.reward=makeEventRewardState(); }
  else return;
  clearArcadeLayer(); updateArcadeHUD(); refreshDevPanel();
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
  small:  { amount:180,  awardIds:['goodFold'] },
  medium: { amount:900,  awardIds:['goodPressure','bigPot'] },
  huge:   { amount:2600, awardIds:['monsterHand','bigPot','heroCall'] }
};
function devTestPotSmash(scale){
  if (!DEV_MODE||!rewardState(game)||!betweenHands()) return;
  const g=game, cfg=DEV_POT_SMASH_SCALES[scale]; if (!cfg) return;
  const potContainer=$('pot-stacks'), pPile=potPile();
  if ((potContainer._chipCount||0)===0) bootstrapPile(potContainer, pPile, cfg.amount);
  const potN=potContainer._chipCount||0;
  if (!potN) return;
  let awards=cfg.awardIds.map(id=>ARCADE_AWARDS[id]?{id,count:1,def:ARCADE_AWARDS[id]}:null).filter(Boolean);
  awards=normalizeArcadeAwards(awards);
  const bonusTotal=awards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  const potWinnings={id:'potWinnings',count:1,def:{name:'POT WINNINGS',base:cfg.amount,tier:'standard',type:'pot'}};
  const early={awards:[potWinnings,...awards],luck:null,commentary:null,total:cfg.amount+bonusTotal};
  queueArcadePresentation(async()=>{
    if (game!==g||!rewardState(g)) return;
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
  const entries=[...Object.entries(ARCADE_AWARDS),...Object.entries(ARCADE_LUCK),...Object.entries(ARCADE_NEGATIVE)];
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

/* Settings > Help > Scoring Guide — a plain always-visible explainer (see
   #scoring-guide-sheet), distinct from the Score/Awards discovery glossary
   above: no locked/undiscovered state, just what each signal is worth.
   Built straight off ARCADE_AWARDS/ARCADE_LUCK so it can never drift from
   the real point values. */
const SCORING_GUIDE_TIERS = ['standard','strong','elite','jackpot'];
const SCORING_GUIDE_TIER_LABEL = { standard:'Standard', strong:'Strong', elite:'Elite', jackpot:'Jackpot' };
let scoringGuideBuilt = false;
function buildScoringGuide(){
  if (scoringGuideBuilt) return;
  scoringGuideBuilt = true;
  const list = $('scoring-guide-list');
  if (!list) return;
  const row = def => '<div class="sg-row"><div class="sg-name">'+esc(def.name)+'</div><div class="sg-pts">+'+def.base.toLocaleString()+'</div></div>';
  const byTier = {};
  SCORING_GUIDE_TIERS.forEach(t=>byTier[t]=[]);
  Object.values(ARCADE_AWARDS).forEach(def=>{ if (def.type==='skill') byTier[def.tier].push(def); });
  const events = Object.values(ARCADE_AWARDS).filter(def=>def.type==='event').sort((a,b)=>a.base-b.base);
  let html = SCORING_GUIDE_TIERS.filter(t=>byTier[t].length).map(t=>
    '<div class="sg-tier sg-tier-'+t+'"><div class="sg-tier-label">'+SCORING_GUIDE_TIER_LABEL[t]+'</div>'+byTier[t].map(row).join('')+'</div>'
  ).join('');
  html += '<div class="sg-section-label">Event rewards</div>' + events.map(row).join('');
  html += '<div class="sg-section-label">Pot winnings</div>' +
    '<div class="hint">POT WINNINGS — score generated from actual net chips won, adjusted for current table stakes.</div>';
  html += '<div class="sg-section-label">Luck</div>' +
    '<div class="hint">'+Object.values(ARCADE_LUCK).map(l=>esc(l.name)).join(' &middot; ')+' — these award 0 points.</div>';
  html += '<div class="hint" style="margin-top:10px;">Occasional negative feedback points out a clear mistake, but it never deducts score.</div>';
  list.innerHTML = html;
}

function makeEliminationRun(opponentCount){
  return {
    active:true, tableNumber:1, highestTableReached:1, tablesCleared:0,
    // Belongs to the RUN, not the table: every table in this run is dealt
    // with the same number of opponents the player picked at the start.
    opponentCount:normalizeOpponentCount(opponentCount),
    totalKOs:0, totalHands:0, totalHandsWon:0,
    showdownsPlayed:0, showdownsWon:0, allInsPlayed:0, allInsWon:0,
    biggestPotWon:0, highestStack:ELIMINATION_CONFIG.startingStack, bestHand:null, bustedBy:null,
    tableKOs:0, tableHands:0, tableHandsWon:0,
    tableShowdownsPlayed:0, tableShowdownsWon:0, tableAllInsPlayed:0, tableAllInsWon:0,
    tableBiggestPotWon:0, tableHighestStack:ELIMINATION_CONFIG.startingStack, tableBestHand:null,
    tableScoreStart:0,
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
