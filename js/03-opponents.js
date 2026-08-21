"use strict";

/* ============================================================
   AI
   ============================================================ */
/* sizing scales every bet the archetype makes (small-ball vs sledgehammer);
   thinkSpeed scales decision time (tight players deliberate, loose players snap) */
const PERSONALITIES_ALL = [
  {key:'rock',      name:'Rock',      aggression:.20, tightness:.80, bluffFreq:.03, sizing:.55, thinkSpeed:1.35},
  {key:'shark',     name:'Shark',     aggression:.55, tightness:.55, bluffFreq:.13, sizing:.75, thinkSpeed:1.00},
  {key:'maniac',    name:'Maniac',    aggression:.88, tightness:.20, bluffFreq:.30, sizing:1.00, thinkSpeed:.70},
  {key:'station',   name:'Station',   aggression:.15, tightness:.15, bluffFreq:.02, sizing:.60, thinkSpeed:.85},
  {key:'grinder',   name:'Grinder',   aggression:.42, tightness:.62, bluffFreq:.09, sizing:.65, thinkSpeed:1.15},
  {key:'wildcard',  name:'Wildcard',  aggression:.68, tightness:.35, bluffFreq:.24, sizing:.90, thinkSpeed:.75},
  {key:'professor', name:'Prof',      aggression:.50, tightness:.58, bluffFreq:.11, sizing:.70, thinkSpeed:1.30},
  {key:'hammer',    name:'Hammer',    aggression:.75, tightness:.45, bluffFreq:.16, sizing:.95, thinkSpeed:.90},
];
// Preferred roster: the four archetypes a normal table is built from
// first. This is a gameplay choice, not an art constraint — illustrated
// face art is fully decoupled from persona (see FACE_ART in
// 02-support-systems.js) and works for any entry in PERSONALITIES_ALL.
// A 5- or 6-opponent Single Player table simply draws its extra seats
// from the rest of PERSONALITIES_ALL below (rock/station/grinder/hammer),
// so every seat is a real, distinct AI character — no duplicates, and
// nothing about their faces depends on which persona they got.
const PERSONALITIES = PERSONALITIES_ALL.filter(p => ['maniac','professor','wildcard','shark'].includes(p.key));
function pickPersonalities(n){
  const pool = PERSONALITIES.slice();
  for (let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=pool[i]; pool[i]=pool[j]; pool[j]=t; }
  if (n <= pool.length) return pool.slice(0,n);
  // more opponents requested than the preferred roster holds — top up from
  // the full roster (shuffled) so every extra seat still gets its own
  // distinct personality rather than repeating one. PERSONALITIES_ALL has
  // 8 entries, comfortably covering the largest supported table (6).
  const extra = PERSONALITIES_ALL.filter(p => !pool.includes(p));
  for (let i=extra.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=extra[i]; extra[i]=extra[j]; extra[j]=t; }
  return pool.concat(extra).slice(0,n);
}

const RANDOM_FIRST_NAMES = ['Alex','Jordan','Sam','Casey','Riley','Morgan','Taylor','Jamie','Avery','Quinn',
  'Drew','Reese','Sasha','Dana','Robin','Charlie','Frankie','Rowan','Skyler','Emerson','Blair','Elliot',
  'Marlowe','Devon','Kai','Noor','Priya','Mateo','Yusuf','Leilani','Santiago','Amara','Niko','Talia','Idris','Wren'];
const RANDOM_LAST_NAMES = ['Reyes','Chen','Novak','Okafor','Bianchi','Muller','Park','Silva','Kowalski','Haddad',
  'Petrov','Nakamura','Larsen','Costa','Singh','Fischer','Moreau','Alvarez','Kim','Andersson','Rossi','Yilmaz',
  'Dubois','Schmidt','Ferreira','Nilsson','Ivanov','Wojcik','Osei','Hassan'];
function randomOpponentName(used){
  let name, tries = 0;
  do{
    name = RANDOM_FIRST_NAMES[Math.floor(Math.random()*RANDOM_FIRST_NAMES.length)];
    tries++;
  } while (used.has(name) && tries < 40);
  used.add(name);
  return name;
}

const DIFFICULTY_PARAMS = {
  easy:   {iterations:120, noise:.34, positionWeight:.00},
  medium: {iterations:260, noise:.15, positionWeight:.04},
  hard:   {iterations:500, noise:.05, positionWeight:.08},
};

/* ============================================================
   TABLE TALK — short personality-flavoured lines, occasional not constant
   ============================================================ */
const TABLE_TALK = {
  rock:      { raise:['Time to commit.','Feeling good about this one.'],
               allin:["This one's for real.",'All the marbles.'],
               win:['Patience pays.',"Told you I don't fold much."],
               lose:['Hm.','Noted.'] },
  shark:     { raise:["Let's build this pot.",'Following the numbers here.'],
               allin:['The maths says go.','Calculated risk.'],
               win:['Just running good.','The edges add up.'],
               lose:['Variance.','Ran fine, ran bad.'] },
  maniac:    { raise:['More! More!',"Let's find out."],
               allin:['Why not.','Send it.'],
               win:['Easy.','Never doubted it.'],
               lose:['Ha! Worth it.','Again!'] },
  station:   { raise:["I'll see it through.",'Sure, why not.'],
               allin:["Might as well.","I've got a feeling."],
               win:['Called it. Eventually.','See, it works out.'],
               lose:["I'll get there next time.",'Just unlucky.'] },
  grinder:   { raise:['Small ball, big picture.','Chipping away.'],
               allin:['Spot looked right.','Committed now.'],
               win:['That adds up over time.','Steady does it.'],
               lose:["Won't change the plan.",'On to the next.'] },
  wildcard:  { raise:['Feeling spicy.',"Let's shake things up."],
               allin:['YOLO.','No half measures.'],
               win:['Told you!','That felt great.'],
               lose:['Worth the story.','No regrets.'] },
  professor: { raise:['The odds favour this.','A reasoned escalation.'],
               allin:['The expected value is there.','Logic dictates I push.'],
               win:['As calculated.','The model held up.'],
               lose:['An outlier result.','The model was sound, the card wasn\u2019t.'] },
  hammer:    { raise:["Bringing the pressure.","Let's turn up the heat."],
               allin:["No half swings.",'Full send.'],
               win:['That\u2019s how you hit.','Blunt force works.'],
               lose:['Swung and missed.',"I'll hit the next one."] },
};
// Single reversible gate for both ordinary action bubbles and personality
// table-talk — both are pure DOM/presentation (no game/AI/mood state lives
// inside either function), so silencing rendering here touches nothing else.
// Every seat now has a fixed, reliably-placed .action-slot showing exactly
// what it just did, which is what the old floating bubbles were compensating
// for; personality lines have no such replacement yet, so they're silenced
// too, on purpose, until a dedicated "speech as a rare event" pass revisits
// this. Threading `trigger` through here (rather than a flat boolean at each
// call site) is what lets that future pass allow-list specific moments
// (e.g. 'allin', 'showdown-win', a big pot) without touching any call site.
function bubblesAllowed(trigger){
  return false;
}
function maybeTableTalk(player, trigger){
  if (!settings.tableTalk || !player || player.isHuman) return;
  if (!bubblesAllowed(trigger)) return;
  const key = player.personality && player.personality.key;
  const lines = key && TABLE_TALK[key] && TABLE_TALK[key][trigger];
  if (!lines || !lines.length) return;
  if (Math.random() > 0.55) return; // was 0.28 — too rare to ever notice in real play
  const line = lines[Math.floor(Math.random()*lines.length)];
  const e = seatEls[player.id];
  if (!e) return;
  clearTimeout(e._talkT);
  e._talkT = setTimeout(()=>{
    if (!e.bubble) return;
    e.bubble.textContent = line;
    e.bubble.classList.remove('is-fold');
    e.bubble.classList.add('talk', 'show');
    clearTimeout(e._t);
    e._t = setTimeout(()=>{ e.bubble.classList.remove('show'); e.bubble.classList.remove('talk'); }, motionOff() ? 400 : 2400);
  }, motionOff() ? 0 : 1100);
}

// seats still to act after this player in the current round (0 = last to act)
function seatsAfter(playerIdx){
  const g = game;
  let count = 0;
  const n = g.players.length;
  for (let c=1;c<n;c++){
    const p = g.players[(playerIdx+c)%n];
    if (p.inHand && !p.folded && !p.allIn && p.id !== g.players[playerIdx].id) count++;
  }
  return count;
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

/* Mood machinery: a lightweight state on each AI that biases decisions a
   little and fades quickly. Kinds:
     'up'      — riding a big win: plays looser and a touch more aggressive
     'down'    — stung by a loss/missed draw: calls a little wider
     'steamed' — lost a big pot with a real hand: tightens up, but hits harder
   Intensity decays ~45% per hand and evaporates below 0.15. */
function nudgeMood(p, kind, intensity){
  if (!p || p.isHuman) return;
  const cur = p.moodState;
  if (cur && cur.kind===kind) cur.intensity = Math.min(1, cur.intensity + intensity*0.6);
  else p.moodState = { kind, intensity: Math.min(1, intensity) };
}
function decayMoods(){
  if (!game) return;
  game.players.forEach(p=>{
    const m = p.moodState;
    if (!m) return;
    // slower decay than before: a hot or cold run should read as a
    // multi-hand streak, not a one-hand blip
    m.intensity *= 0.75;
    if (m.intensity < 0.15) p.moodState = null;
  });
}
/* ============================================================
   PRESENTATION MOOD (faceMood) — deliberately SEPARATE from moodState
   ============================================================
   moodState above is gameplay state: aiDecide() reads it and it biases
   aggression/tightness. faceMood below is presentation state: it decides
   which portrait an opponent wears and NOTHING ELSE. The two are fed by
   the same public events but are never the same object, and there is no
   path from faceMood into aiDecide().

   The field names differ on purpose (`family`/`intensity` here vs
   `kind`/`intensity` there): if a future refactor ever tries to merge or
   copy one into the other, the mismatch fails loudly instead of quietly
   coupling the visible face to the AI's decisions — which is exactly the
   poker tell this whole system exists to prevent.

   Families are the keys of FACE_MOOD_POOLS (02-support-systems.js);
   intensity 0-1 selects the band WITHIN a family, so an opponent deep in
   a bad run can't randomly flash their mildest worried face. */

const FACE_NEGATIVE_FAMILIES = ['irritated','nervous'];

function faceMoodOf(p){
  const m = p && p.faceMood;
  if (!m || !FACE_MOOD_POOLS[m.family]) return { family:'neutral', intensity:0 };
  return m;
}
/* Unknown families are rejected at the WRITE site, not tolerated at the
   read site — a typo'd family name lands on neutral immediately rather
   than silently persisting into a save. */
function setFaceMood(p, family, intensity){
  if (!p || p.isHuman) return;
  const fam = FACE_MOOD_POOLS[family] ? family : 'neutral';
  p.faceMood = { family: fam, intensity: clamp01(intensity) };
}
function nudgeFaceMood(p, family, amount){
  if (!p || p.isHuman) return;
  const cur = faceMoodOf(p);
  if (cur.family === family) setFaceMood(p, family, cur.intensity + amount*0.6);
  else if (amount >= cur.intensity) setFaceMood(p, family, amount);
  // otherwise a stronger existing mood in another family simply holds
}
/* Which way a publicly-visible loss pushes this opponent. Once a negative
   direction has formed, further losses DEEPEN it rather than flip-flopping
   — someone who has gone sour stays sour, someone rattled stays rattled.
   From neutral (or from a positive mood) the branch is a coin flip, which
   is purely cosmetic: it is chosen from faceMood alone and can never
   correlate with cards, equity, bluff state or the AI's intent. */
function negativeFaceFamily(p){
  const cur = faceMoodOf(p);
  if (FACE_NEGATIVE_FAMILIES.includes(cur.family)) return cur.family;
  return Math.random()<0.5 ? 'irritated' : 'nervous';
}
/* Mirrors decayMoods()'s cadence (once per hand) on the presentation
   side, so a mood fades over a few hands instead of resetting instantly. */
function decayFaceMoods(){
  if (!game) return;
  game.players.forEach(p=>{
    if (p.isHuman) return;
    const m = p.faceMood;
    if (!m) return;
    m.intensity *= 0.75;
    if (m.intensity < 0.12) p.faceMood = { family:'neutral', intensity:0 };
  });
}

/* The expression a player currently "wears" for their baseline mood.
   The cosmetic variant is re-rolled ONLY when the mood signature (family
   + which intensity band) actually changes — otherwise the same drawing
   is held. That's what stops the portrait flickering between neutral
   variants on every single action while still letting repeated events
   land on a different face later. */
function baselineFaceExpression(p){
  const m = faceMoodOf(p);
  const pool = faceMoodPool(m.family, m.intensity);
  const sig = m.family + '|' + pool.join(',');
  if (p._faceSig !== sig || !p._faceKey){
    p._faceSig = sig;
    p._faceKey = pickFaceExpression(m.family, m.intensity, p._faceKey);
  }
  return p._faceKey;
}
/* A player's "neutral" face once any immediate reaction has passed —
   reflects recent public form rather than always snapping back to idle. */
function restingMood(p){
  return baselineFaceExpression(p);
}
/* Between hands, faces carry whatever mood lingers instead of snapping to
   idle — the baseline expression plus an occasional, non-deterministic
   short-stack flicker of nerves. Stack depth is public, and this only
   runs once per hand gap (applyLingeringFaces below), never per action. */
function betweenHandsMood(p, g){
  const base = baselineFaceExpression(p);
  if (p.isHuman || p.eliminated) return base;
  const shortStacked = g && g.bigBlind && p.chips < g.bigBlind*8;
  if (shortStacked && Math.random()<0.18){
    return pickFaceExpression('nervous', Math.max(0.45, faceMoodOf(p).intensity), p._faceKey);
  }
  return base;
}
/* Between hands, faces carry whatever mood lingers instead of snapping to idle. */
function applyLingeringFaces(){
  if (!game) return;
  game.players.forEach(p=>{
    if (p.isHuman) return;
    setMood(p.id, betweenHandsMood(p, game));
  });
}

/* ---- illustrated-face reaction pools ----------------------------------
   Every pick here is driven only by information the human player can
   already see (visible chip amounts, public pot outcomes, whose turn it
   visibly is) — never hole cards, equity, bluff status or intended
   action. See the call sites in 05-game-engine.js for exactly when each
   of these fires. */

/* Turn-start "thinking" portrait. "Thinking" is not an emotion here — an
   opponent on their turn wears whatever their CURRENT PUBLIC MOOD would
   have them wear while deliberating. A nervous-looking think face means
   "this player has been losing", never "this player has a weak hand".

   Still chosen before aiDecide() computes anything (05-game-engine.js
   :2221 vs :2223), and it reads only faceMood, so there is nothing
   private in scope for it to correlate with even by accident. */
const FACE_THINK_POOLS = {
  neutral:   ['think','thinking1','thinking2','suspicious1','suspicious2','neutral1','neutral3'],
  positive:  ['thinking1','neutral2','suspicious1','happy1'],
  confident: ['smug1','scheming1','sly1','cocky1'],
  irritated: ['displeased1','suspicious2','thinking2'],
  nervous:   ['worried1','nervous1','baffled1','thinking2'],
  uncertain: ['confused1','confused2','baffled1','suspicious1'],
  shock:     ['shocked1','baffled1','thinking2']
};
function pickThinkMood(p){
  const m = faceMoodOf(p);
  // deep moods think in their own register rather than the mild pool
  if (m.family==='nervous' && m.intensity>0.6) return Math.random()<0.6 ? 'veryNervous1' : 'nervous2';
  if (m.family==='confident' && m.intensity>0.7) return Math.random()<0.5 ? 'gloating1' : 'scheming1';
  const pool = FACE_THINK_POOLS[m.family] || FACE_THINK_POOLS.neutral;
  return pool[Math.floor(Math.random()*pool.length)];
}

/* ---- public-event reactions -------------------------------------------
   The only entry points that change a visible mood from a hand result.
   Every argument is public — the swing/loss in big blinds, which the
   player watched happen. Hole cards, equity, bluff state and the AI's
   decision are not passed in and are not in scope, so no amount of later
   editing here can leak them without someone deliberately adding a new
   parameter.

   Landing expressions are BASELINE-DERIVED, not hardcoded: each chain's
   final step is computed AFTER the mood nudge, so the sequence and the
   baseline system agree on what the seat looks like once it ends. */
const REACTION_TIMING = { beat: 380, mid: 500, hold: 900 };

function reactToWin(p, swingBB){
  if (!p || p.isHuman) return;
  const before = faceMoodOf(p);
  const wasNegative = FACE_NEGATIVE_FAMILIES.includes(before.family) && before.intensity > 0.4;

  // a real win after a rough run — relief, then settling back
  if (wasNegative && swingBB > 6){
    setFaceMood(p, 'positive', 0.45);
    playReactionSequence(p.id, [
      { mood:'relieved1', ms: REACTION_TIMING.beat },
      { mood: pickFaceExpression('positive', 0.5, 'relieved1'), ms: REACTION_TIMING.mid },
      { mood: baselineFaceExpression(p), ms: REACTION_TIMING.hold }
    ]);
    return;
  }
  if (swingBB > 20){
    nudgeFaceMood(p, 'confident', 0.55);
    playReactionSequence(p.id, [
      { mood: pickFaceExpression('positive', 0.8, null), ms: REACTION_TIMING.beat },
      { mood: baselineFaceExpression(p), ms: REACTION_TIMING.hold }
    ]);
    return;
  }
  // ordinary pots get a mood nudge only — no chain, or faces get twitchy
  nudgeFaceMood(p, swingBB > 6 ? 'confident' : 'positive', swingBB > 6 ? 0.30 : 0.18);
  setMood(p.id, baselineFaceExpression(p));
}

function reactToLoss(p, lostBB, stung){
  if (!p || p.isHuman) return;
  const before = faceMoodOf(p);
  const family = negativeFaceFamily(p);

  if (lostBB > 20){
    nudgeFaceMood(p, family, 0.75);
    playReactionSequence(p.id, [
      { mood:'shocked1', ms: REACTION_TIMING.beat },
      { mood: family==='irritated' ? 'angry1' : 'veryNervous1', ms: REACTION_TIMING.mid },
      { mood: baselineFaceExpression(p), ms: REACTION_TIMING.hold }
    ]);
    return;
  }
  if (stung){
    // already sour and it happened AGAIN — a short deepening beat
    const deepening = before.family === family && before.intensity > 0.45;
    nudgeFaceMood(p, family, 0.45);
    if (deepening){
      playReactionSequence(p.id, [
        { mood: pickFaceExpression(family, Math.min(1, before.intensity + 0.2), null), ms: REACTION_TIMING.beat },
        { mood: baselineFaceExpression(p), ms: REACTION_TIMING.hold }
      ]);
    } else {
      setMood(p.id, baselineFaceExpression(p));
    }
    return;
  }
  nudgeFaceMood(p, family, 0.18);
  setMood(p.id, baselineFaceExpression(p));
}
/* The three new dead-0X variants plus the original dead pose are treated
   as pure visual variety, not different meanings — see ELIMINATION docs. */
function pickDeadMood(){
  const pool = ['dead','dead1','dead2','dead3'];
  return pool[Math.floor(Math.random()*pool.length)];
}

async function aiDecide(player, g){
  const idx = g.players.indexOf(player);
  const numOpp = g.players.filter(p=>p.inHand && !p.folded && p.id!==player.id).length;
  const dp = DIFFICULTY_PARAMS[g.difficulty];
  const rawEquity = await EquityService.get(player.hand, g.board, Math.max(1,numOpp), dp.iterations);

  const pers = player.personality;
  const mood = player.moodState || { kind:null, intensity:0 };

  // mood biases are deliberately small — noticeable over a session, not per hand
  let aggression = pers.aggression, tightness = pers.tightness, bluffFreq = pers.bluffFreq;
  let callLoosen = 0;
  if (mood.kind==='up'){
    aggression = Math.min(1, aggression + 0.10*mood.intensity);
    tightness  = Math.max(0, tightness  - 0.08*mood.intensity);
  } else if (mood.kind==='down'){
    callLoosen = 0.035*mood.intensity;
  } else if (mood.kind==='steamed'){
    tightness  = Math.min(1, tightness  + 0.10*mood.intensity);
    aggression = Math.min(1, aggression + 0.05*mood.intensity);
  }

  const noise = (Math.random()-0.5) * dp.noise;
  const tightAdj = (tightness - 0.5) * -0.10;
  // late position (few players left to act) nudges confidence up slightly
  const posAdj = dp.positionWeight * (1 - Math.min(1, seatsAfter(idx) / Math.max(1, numOpp)));
  const perceived = clamp01(rawEquity + noise + tightAdj + posAdj);

  const toCall = Math.max(0, g.currentBet - player.betThisRound);
  const potOdds = toCall>0 ? toCall/(g.pot + toCall) : 0;
  const stack = player.chips;
  const bb = g.bigBlind;
  const bbLeft = stack / bb;
  const shortStack = bbLeft <= ELIMINATION_CONFIG.shortStackBB;   // shoving territory — caps don't apply
  const preflop = g.board.length===0;
  const bluffRoll = Math.random() < bluffFreq * (preflop ? 0.5 : 1);
  const sizeMul = 0.85 + pers.sizing*0.30;       // archetype bet-size fingerprint

  /* Stack discipline, measured across the WHOLE hand: total commitment may
     not pass ~28% of the hand-start stack on a merely decent hand, ~45% on a
     good one. Per-action caps let escalation compound street by street; a
     hand-level budget is what actually keeps stacks alive. Only genuinely
     strong holdings (or short stacks, where shoving is simply correct) play
     for everything. */
  const handStart = player.chips + player.totalBetHand;      // stack at start of hand
  function cappedTotal(desiredTotal, strength){
    const already = player.betThisRound;
    const committedBefore = player.totalBetHand - already;   // spent on earlier streets
    const capFrac = strength>0.80 ? 1 : strength>0.70 ? 0.45 : 0.28;
    const budget = Math.max(bb*3, Math.round(handStart * capFrac)) - committedBefore;
    let total = Math.min(desiredTotal, Math.max(already + toCall, budget));
    if (already + stack - total < bb*1.5) total = already + stack;  // no meaningless slivers
    return total;
  }
  function raiseOrSettle(total){
    const allInTotal = player.betThisRound + stack;
    total = Math.min(total, allInTotal);
    const minLegal = g.currentBet + g.minRaise;
    // a capped "raise" that no longer clears the minimum isn't worth making
    if (total < minLegal && total < allInTotal) return toCall>0 ? {action:'call'} : {action:'check'};
    // avoid needless all-ins on non-premium hands
    if (total >= allInTotal && !shortStack && perceived < 0.82) return toCall>0 ? {action:'call'} : {action:'check'};
    return {action: toCall>0 ? 'raise' : 'bet', amount: total};
  }

  // ---------------- preflop: fold weak, raise strong, keep sizes honest ----------------
  if (preflop){
    const facingRaise = g.currentBet > bb;
    let foldGate = 0.30 + tightness*0.14
      + (facingRaise ? 0.10 + Math.min(0.10, (toCall/Math.max(1,stack))*0.5) : 0);
    // Elimination mode only — a short stack there is permanently short (no
    // rebuy), so it needs to progressively widen rather than fold forever;
    // cash/tournament AI stack-depth behaviour is deliberately left exactly
    // as it was (cash rebuys almost immediately, tournament already has its
    // own escalating-blind pressure — see the Phase 1 plan §9/§12).
    if (g.mode === 'elimination'){
      const widen = Math.max(0, ELIMINATION_CONFIG.shortStackBB - bbLeft) * ELIMINATION_CONFIG.foldGateWidenPerBB;
      foldGate = Math.max(0, foldGate - widen);
    }
    if (toCall>0 && perceived < foldGate && !bluffRoll){
      // cheap completes from the small blind still happen with playable stuff
      if (toCall <= bb*0.5 && perceived > foldGate-0.10 && Math.random()<0.6) return {action:'call'};
      return {action:'fold'};
    }
    const raiseGate = facingRaise ? 0.62 + tightness*0.06 : 0.52 + (1-aggression)*0.10;
    const wantsRaise = player.mayRaise && stack > toCall &&
      (perceived > raiseGate || (bluffRoll && !facingRaise && Math.random()<0.5)) &&
      Math.random() < 0.30 + aggression*0.45;
    if (wantsRaise){
      // Critical stack (elimination mode, < ~5BB): cappedTotal()'s 28%/45%
      // hand-start budget caps make no sense once the whole stack IS only
      // a few BB — jam it. Push/fold framing instead of a sized raise.
      if (g.mode === 'elimination' && bbLeft < ELIMINATION_CONFIG.criticalStackBB){
        return raiseOrSettle(player.betThisRound + stack);
      }
      const mult = (facingRaise ? 2.6 + aggression*0.8 : 2.2 + aggression*0.9) * sizeMul;
      let total = Math.max(Math.round(g.currentBet * mult), g.currentBet + g.minRaise);
      return raiseOrSettle(cappedTotal(total, perceived));
    }
    return toCall>0 ? {action:'call'} : {action:'check'};
  }

  // ---------------- postflop, nothing to call ----------------
  if (toCall <= 0){
    // probe: small information bet with a medium hand in an unopened pot
    const probe = perceived > 0.38 && perceived <= 0.58 && Math.random() < 0.30 + aggression*0.25;
    const valueBet = perceived > (0.58 + (1-aggression)*0.10);
    if ((valueBet || probe || bluffRoll) && stack > bb){
      let frac = probe && !valueBet ? (0.30 + Math.random()*0.10)
               : (!valueBet && bluffRoll) ? (0.40 + aggression*0.15)
               : (0.35 + aggression*0.30 + Math.max(0, perceived-0.58)*0.5);
      let total = potSizedTotal(player, Math.min(frac*sizeMul, 0.85));
      return raiseOrSettle(cappedTotal(total, perceived));
    }
    return {action:'check'};
  }

  // ---------------- facing a bet ----------------
  const betPressure = Math.min(1, toCall / Math.max(1, g.pot));   // 1 = pot-sized or more
  const callThreshold = potOdds - 0.03
      + (tightness-0.5)*0.08
      + betPressure*0.10          // big bets demand a real hand to continue
      - callLoosen;
  if (perceived < callThreshold && !bluffRoll){
    const cheap = toCall <= Math.max(bb, stack*0.02) && perceived > callThreshold-0.12;
    return cheap ? {action:'call'} : {action:'fold'};
  }
  const wantsRaise = player.mayRaise && stack > toCall
    && (perceived > 0.74 || (bluffRoll && betPressure < 0.5 && Math.random()<0.35))
    && Math.random() < (0.25 + aggression*0.45);
  if (wantsRaise){
    let frac = (0.45 + aggression*0.30) * sizeMul;
    let total = potSizedTotal(player, Math.min(frac, 0.8));
    return raiseOrSettle(cappedTotal(total, perceived));
  }
  // calling off a big chunk — judged against the whole hand's commitment —
  // still needs genuine strength
  const wouldCommit = (player.totalBetHand + toCall) / Math.max(1, player.chips + player.totalBetHand);
  if (!shortStack && wouldCommit > 0.5 && perceived < 0.66) return {action:'fold'};
  if (!shortStack && toCall > stack*0.45 && perceived < 0.62) return {action:'fold'};
  return {action:'call'};
}

/* How long an AI 'thinks'. Big decisions — big folds, raises, calling off a
   chunk of stack, anything all-in — get visibly longer pauses. Scaled by the
   archetype's thinkSpeed and by the player's chosen game speed. */
function speedMult(){
  // FAST DEV short-circuits the player's own speed setting entirely — see
  // the FAST_DEV declaration above. Every one of this function's existing
  // call sites (AI think time, deal/flip stagger, chip flight duration,
  // auto-deal delay, …) benefits automatically; playElimination never
  // calls speedMult(), so K.O./ELIMINATED timing is untouched either way.
  if (DEV_MODE && FAST_DEV) return FAST_DEV_TIME_MULT;
  // QUICK RESOLVE (see 05-game-engine.js) overrides the player's own speed
  // setting rather than compounding with it, so the accelerated stretch is
  // one predictable speed regardless of Normal/Fast. Every existing call
  // site benefits automatically, exactly as FAST_DEV's does; the payoff
  // sequences never call this function, and the flag is cleared before
  // they run anyway.
  if (quickResolveActive()) return QUICK_RESOLVE_TIME_MULT;
  return settings.speed==='fast' ? 0.55 : settings.speed==='relaxed' ? 1.35 : 1;
}
function aiThinkTime(player, decision, g){
  if (motionOff()) return 260;
  const toCall = Math.max(0, g.currentBet - player.betThisRound);
  const allIn = decision.amount != null && decision.amount >= player.betThisRound + player.chips;
  const big = allIn
    || decision.action==='raise' || decision.action==='bet'
    || (decision.action==='fold' && toCall > g.pot*0.5)
    || (decision.action==='call' && toCall > player.chips*0.3);
  let ms = big ? 1700 + Math.random()*1500 : 900 + Math.random()*900;
  if (allIn) ms += 900;
  return Math.round(ms * (player.personality.thinkSpeed || 1) * speedMult());
}

/* Correct pot-sized bet/raise total for a player.
   Facing a bet: call first, then bet a fraction of the resulting pot. */
function potSizedTotal(player, fraction){
  const g = game;
  const toCall = Math.max(0, g.currentBet - player.betThisRound);
  const potAfterCall = g.pot + toCall;
  const raiseBy = Math.max(g.bigBlind, Math.round(fraction * potAfterCall));
  return player.betThisRound + toCall + raiseBy;
}

