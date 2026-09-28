"use strict";

/* ============================================================
   AI
   ============================================================ */
/* sizing scales every bet the archetype makes (small-ball vs sledgehammer);
   thinkSpeed scales decision time (tight players deliberate, loose players snap);
   adapt is how quickly they pick up on your habits (see READS; Mavis
   barely notices anything), and tilt is how hard a big loss knocks them
   off their game (the Professor shrugs, Tony boils) */
// `name` is the character (the table, log, banner and results use it);
// `style` is how they play, the name they had before Enemy Cards V2.
const PERSONALITIES_ALL = [
  {key:'rock',      name:'Nigel', style:'Rock',     aggression:.20, tightness:.80, bluffFreq:.03, sizing:.55, thinkSpeed:1.35, adapt:0.7, tilt:0.4},
  {key:'shark',     name:'Lucy',  style:'Shark',    aggression:.55, tightness:.55, bluffFreq:.13, sizing:.75, thinkSpeed:1.00, adapt:1.1, tilt:0.3},
  {key:'maniac',    name:'Tony',  style:'Maniac',   aggression:.88, tightness:.20, bluffFreq:.30, sizing:1.00, thinkSpeed:.70, adapt:0.5, tilt:0.9},
  {key:'station',   name:'Mavis', style:'Station',  aggression:.15, tightness:.15, bluffFreq:.02, sizing:.60, thinkSpeed:.85, adapt:0.05, tilt:0.5},
  {key:'grinder',   name:'Steve', style:'Grinder',  aggression:.42, tightness:.62, bluffFreq:.09, sizing:.65, thinkSpeed:1.15, adapt:0.9, tilt:0.3},
  {key:'wildcard',  name:'Roxy',  style:'Wildcard', aggression:.68, tightness:.35, bluffFreq:.24, sizing:.90, thinkSpeed:.75, adapt:0.6, tilt:0.8},
  {key:'professor', name:'Harry', style:'Prof',     aggression:.50, tightness:.58, bluffFreq:.11, sizing:.70, thinkSpeed:1.30, adapt:1.3, tilt:0.15},
  {key:'hammer',    name:'Bruno', style:'Hammer',   aggression:.75, tightness:.45, bluffFreq:.16, sizing:.95, thinkSpeed:.90, adapt:0.6, tilt:0.7},
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
  expert: {iterations:700, noise:.025, positionWeight:.11},
  elite:  {iterations:900, noise:.01, positionWeight:.14},
};

/* SKILL DIAL (docs/ai/AI_PLAN.md, "Skill is a dial"). Skill is one number,
   0-100. The named difficulties are anchor points on it, and every
   skill-dependent AI setting is defined at the anchors and blended between
   them, so any room or custom table can sit anywhere: below easy, between
   medium and hard, a notch under elite. A named difficulty gives exactly
   its DIFFICULTY_PARAMS entry, so existing rooms and saves play unchanged. */
const SKILL_ANCHORS = { easy:15, medium:30, hard:50, expert:70, elite:90 };

/* Skill for this seat: a per-seat override (a regular sitting in a soft
   room), else the table's number, else the table's named difficulty. */
function aiSkillOf(player, g){
  const n = v => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, v)) : null;
  const own = n(player && player.skill);
  if (own !== null) return own;
  const table = n(g && g.skill);
  if (table !== null) return table;
  return SKILL_ANCHORS[g && g.difficulty] != null ? SKILL_ANCHORS[g.difficulty] : SKILL_ANCHORS.medium;
}

/* Blend a table of per-anchor settings to any skill value. Below the lowest
   anchor or above the highest it holds the end value. */
function skillBlend(table, skill){
  const pts = Object.keys(SKILL_ANCHORS).filter(k => table[k])
    .map(k => [SKILL_ANCHORS[k], table[k]]).sort((a,b) => a[0]-b[0]);
  if (skill <= pts[0][0]) return Object.assign({}, pts[0][1]);
  const last = pts[pts.length-1];
  if (skill >= last[0]) return Object.assign({}, last[1]);
  const exact = pts.find(pt => pt[0] === skill);      // an anchor is its own values, exactly
  if (exact) return Object.assign({}, exact[1]);
  let i = 0; while (pts[i+1][0] < skill) i++;
  const [s0, a] = pts[i], [s1, b] = pts[i+1];
  const t = (skill - s0) / (s1 - s0);
  const out = {};
  for (const k of Object.keys(a)) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

function aiDifficultyParams(player, g){
  const p = skillBlend(DIFFICULTY_PARAMS, aiSkillOf(player, g));
  p.iterations = Math.round(p.iterations);
  return p;
}

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

/* Live opponents who act AFTER this player on the postflop streets
   (0 = on the button / last to act). Position is measured from the dealer
   button, which is what makes a seat good or bad for the whole hand.
   Before v0.53 this counted every live opponent, so the position term in
   aiDecide() — and the difficulty positionWeight ladder — was always zero. */
function seatsAfter(playerIdx){
  const g = game;
  const n = g.players.length;
  const dealer = g.dealerIndex >= 0 ? g.dealerIndex : n - 1;
  const order = i => (i - dealer - 1 + n) % n;   // 0 = first to act postflop
  const mine = order(playerIdx);
  let count = 0;
  for (let i=0;i<n;i++){
    if (i === playerIdx) continue;
    const p = g.players[i];
    if (p.inHand && !p.folded && !p.allIn && order(i) > mine) count++;
  }
  return count;
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

/* Mood machinery: a state on each AI that biases decisions and fades.
   Kinds:
     'up'      — riding a big win: plays looser and a touch more aggressive
     'down'    — stung by a loss/missed draw: calls a little wider
     'steamed' — lost a big pot with a real hand: TILT — looser, pushier and
                 bluffier, by temperament (personality.tilt) and less so the
                 more skilled they are (see aiDecide)
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
function nudgeFaceMood(p, family, amount, opts){
  if (!p || p.isHuman) return;
  const cur = faceMoodOf(p);
  if (cur.family === family) setFaceMood(p, family, cur.intensity + amount*0.6);
  else if (amount >= cur.intensity) setFaceMood(p, family, amount);
  // A publicly visible reversal must land even against a stronger stale
  // mood in another family. Without this, an opponent who won a big pot
  // earlier (confident 0.55) kept smiling through a later showdown loss,
  // because an ordinary loss only nudges 0.18 and lost the comparison
  // above. `override` is only ever passed for real, publicly observed
  // reversals (see reactToLoss), never for routine drift.
  else if (opts && opts.override) setFaceMood(p, family, Math.max(amount, cur.intensity * 0.75));
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

/* ---- fold reactions ----------------------------------------------------
   A fold is fully public, so reacting to it leaks nothing about the cards
   — but the reaction MUST be chosen from public information only
   (personality + chance), never from hole cards, equity or why the AI
   folded. That is the distinction the original "no reaction on action"
   rule was protecting, and it is preserved here.

   Deliberately does NOT write faceMood: this paints the fold beat only,
   leaving the persistent mood system driven by pot outcomes exactly as
   before. That also means a later showdown or elimination reaction always
   wins, since those go through playReactionSequence/swapFace. */
const FOLD_FACE_POOLS = {
  annoyed:  ['displeased1','angry1'],
  resigned: ['neutral1','neutral3','think','thinking2'],
  relieved: ['relieved1','neutral2']
};
function pickFromPool(pool){ return pool[Math.floor(Math.random()*pool.length)]; }
function foldFaceExpression(p){
  const pers = p.personality || {};
  const aggro = typeof pers.aggression === 'number' ? pers.aggression : 0.5;
  const r = Math.random();
  // Aggressive characters hate folding; passive ones shrug it off.
  if (r < aggro * 0.55) return pickFromPool(FOLD_FACE_POOLS.annoyed);
  if (r > 0.82) return pickFromPool(FOLD_FACE_POOLS.relieved);
  return pickFromPool(FOLD_FACE_POOLS.resigned);
}
function reactToFold(p){
  if (!p || p.isHuman || p.eliminated) return;
  setMood(p.id, foldFaceExpression(p));
}

/* How long a busted opponent holds their defeated face. The AWARD POT gate
   is player-paced and unbounded, so this deliberately outlasts any
   plausible wait; it is cut short by startNewHand's clearFaceLock sweep,
   and playElimination paints through it via swapFace (which bypasses the
   lock), so the K.O. ceremony still owns the seat at its normal moment. */
const BUSTED_FACE_HOLD_MS = 45000;

function reactToLoss(p, lostBB, stung, opts){
  if (!p || p.isHuman) return;
  const before = faceMoodOf(p);
  const family = negativeFaceFamily(p);

  // Busted: lost everything on this pot and sits at $0. This is the
  // strongest publicly-visible reversal there is, so it overrides any
  // lingering positive mood outright and holds through the winner
  // announcement and the AWARD POT wait.
  if (opts && opts.busted){
    nudgeFaceMood(p, family, 1, {override:true});
    playReactionSequence(p.id, [
      { mood:'shocked1', ms: REACTION_TIMING.beat },
      { mood: family==='irritated' ? 'angry1' : 'terrified1', ms: REACTION_TIMING.mid },
      { mood: family==='irritated' ? 'angry1' : 'veryNervous1', ms: BUSTED_FACE_HOLD_MS }
    ]);
    return;
  }

  // A lost all-in is always a strong beat, whatever the raw BB figure says
  // — a short stack shoving 12 BB and losing it all reads as bigger than
  // the number. Folded in here rather than given its own chain so the
  // "survived on an uncalled return" case looks like the real reversal it
  // is, without claiming the finality of the busted branch above.
  if ((opts && opts.allInLoss) || lostBB > 20){
    nudgeFaceMood(p, family, 0.75, {override:true});
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
    nudgeFaceMood(p, family, 0.45, {override:true});
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
  // Even a small loss must not leave a victory face on a revealed loser —
  // override drops a stale positive/confident mood into the negative
  // family so the baseline expression below is actually a losing one.
  nudgeFaceMood(p, family, 0.18, {override:true});
  setMood(p.id, baselineFaceExpression(p));
}
/* The three new dead-0X variants plus the original dead pose are treated
   as pure visual variety, not different meanings — see ELIMINATION docs. */
function pickDeadMood(){
  const pool = ['dead','dead1','dead2','dead3'];
  return pool[Math.floor(Math.random()*pool.length)];
}

/* Public-state-only format adjustments. This helper deliberately receives no
   hole cards, deck or equity: heads-up width, short-stack pressure and a
   paid-place bubble are properties visible to everyone at the table. */
function aiFormatAdjustments(g, player, numOpp, bbLeft){
  const freezeout = g && (g.mode==='tournament' || g.mode==='career' || g.mode==='elimination');
  const headsUp = numOpp===1;
  const paidPlaces = g && g.mode==='career' && g.event && Array.isArray(g.event.payouts)
    ? g.event.payouts.length : 0;
  const alive = g && Array.isArray(g.players)
    ? g.players.filter(p=>p.chips>0 && !p.eliminated).length : 0;
  const bubble = paidPlaces>1 && alive===paidPlaces+1;
  return {
    aggression:headsUp?0.08:(bubble&&bbLeft<=10?0.06:0),
    tightness:headsUp?-0.08:(bubble?0.04:0),
    bluffFreq:headsUp?0.04:0,
    foldGateWiden:freezeout&&bbLeft<ELIMINATION_CONFIG.shortStackBB
      ? (ELIMINATION_CONFIG.shortStackBB-bbLeft)*ELIMINATION_CONFIG.foldGateWidenPerBB : 0,
    callOffFloor:headsUp?0.48:0.56,
    headsUp,bubble,freezeout
  };
}

/* ============================================================
   READS: WHAT THE TABLE HAS SEEN (docs/ai/AI_PLAN.md, Step 5)
   ============================================================
   One shared notebook per table, g.reads[playerId], of every player's
   PUBLIC habits: how often they play and raise preflop, how aggressive
   they are after the flop, how often they fold to a bet or c-bet, and what
   they turned out to hold when cards were shown down. Nothing a player
   hides goes in: folded cards are never seen, and hands are only read at
   a showdown, where they are face up for everyone.

   Each AI reads the notebook through its own eyes (aiReadOf): it starts
   from what a normal player does (READ_PRIOR) and trusts the notebook more
   as the hands pile up, as fast as its skill (POSTFLOP_SKILL.adapt) and
   temperament (personality.adapt) allow. A Back Room regular never
   notices you raise every hand; an Elite one has you figured in a dozen.

   The notebook rides along in the table save (serializeTable), so a
   Career event remembers you across a reload. */
const READ_PRIOR = { vpip:0.30, pfr:0.18, agg:0.30, ftb:0.45, cbet:0.60, bluff:0.30 };
const READ_FIELDS = ['hands','vpip','pfr','postAgg','postPassive','facedBet','foldedToBet','cbetOpp','cbet','riverBetsShown','bluffsShown'];

function readsFor(g, id){
  if (!g.reads) g.reads = {};
  if (!g.reads[id]){ g.reads[id] = {}; READ_FIELDS.forEach(f=>{ g.reads[id][f] = 0; }); }
  return g.reads[id];
}
/* A new hand: count it for everyone dealt in. */
function aiObserveHandStart(g){
  g._readHand = {};
  g.handLog = [];   // this hand's postflop actions, for reading hands (Step 4)
  g.players.forEach(p=>{ if (p.inHand && !p.eliminated){ readsFor(g, p.id).hands++; g._readHand[p.id] = { vpip:false, pfr:false }; } });
}
/* A public action. info: { toCall, raisesBefore, phase } as they were
   BEFORE the action. `action` is the action as applied (check/call/bet/
   raise/fold). */
function aiObserveAction(g, p, action, info){
  const r = readsFor(g, p.id);
  const h = (g._readHand || (g._readHand = {}))[p.id] || (g._readHand[p.id] = { vpip:false, pfr:false });
  const aggressive = action === 'bet' || action === 'raise' || action === 'allin';
  if (info.phase === 'preflop'){
    if ((action === 'call' || aggressive) && !h.vpip){ h.vpip = true; r.vpip++; }
    if (aggressive && !h.pfr){ h.pfr = true; r.pfr++; }
    return;
  }
  if (aggressive) r.postAgg++;
  else if (action === 'call' || action === 'check') r.postPassive++;
  const code = aggressive ? (info.toCall > 0 ? 'r' : 'b') : action === 'call' ? 'c' : action === 'check' ? 'k' : null;
  if (code) (g.handLog || (g.handLog = [])).push({ id:p.id, n:g.board.length, a:code });
  if (info.toCall > 0){ r.facedBet++; if (action === 'fold') r.foldedToBet++; }
  if (info.phase === 'flop' && g.pfAggressorId === p.id && info.raisesBefore === 0){
    r.cbetOpp++; if (aggressive) r.cbet++;
  }
}
/* Cards shown down: did the last river bettor turn out to be bluffing? */
function aiObserveShowdown(g, shown){
  if (g.board.length < 5 || !g.streetAggressorId) return;
  const bettor = shown.find(p=>p.id === g.streetAggressorId);
  if (!bettor || !bettor.hand || bettor.hand.length < 2) return;
  const r = readsFor(g, bettor.id);
  r.riverBetsShown++;
  const made = classifyPostflop(bettor.hand, g.board).made;
  if (made === 'nothing' || made === 'weak-pair') r.bluffsShown++;
}

/* What `observer` believes about `target`'s habits. Each rate is the
   prior, pulled toward what was seen by weight w = trust × n/(n + 20),
   where trust = the observer's skill-adapt × temperament. */
function aiReadOf(observer, target, g){
  const out = Object.assign({ trust:0, hands:0 }, READ_PRIOR);
  const r = g && g.reads && target && g.reads[target.id];
  if (!r || !observer) return out;
  const sk = skillBlend(POSTFLOP_SKILL, aiSkillOf(observer, g));
  const temper = observer.personality && typeof observer.personality.adapt === 'number' ? observer.personality.adapt : 1;
  const trust = Math.max(0, Math.min(1, sk.adapt * temper));
  const pull = (prior, hits, n, k) => n > 0 ? prior + (hits/n - prior) * trust * n / (n + (k || 20)) : prior;
  out.trust = trust; out.hands = r.hands;
  out.vpip = pull(READ_PRIOR.vpip, r.vpip, r.hands);
  out.pfr = pull(READ_PRIOR.pfr, r.pfr, r.hands);
  out.agg = pull(READ_PRIOR.agg, r.postAgg, r.postAgg + r.postPassive);
  out.ftb = pull(READ_PRIOR.ftb, r.foldedToBet, r.facedBet, 12);
  out.cbet = pull(READ_PRIOR.cbet, r.cbet, r.cbetOpp, 8);
  out.bluff = pull(READ_PRIOR.bluff, r.bluffsShown, r.riverBetsShown, 4);
  return out;
}

/* Save / restore: counts only, sanitised. */
function aiReadsSnapshot(g){
  if (!g || !g.reads) return null;
  const out = {};
  Object.keys(g.reads).forEach(id=>{ out[id] = {}; READ_FIELDS.forEach(f=>{ out[id][f] = g.reads[id][f] || 0; }); });
  return out;
}
function aiReadsRestore(saved, players){
  const reads = {};
  if (!saved || typeof saved !== 'object') return reads;
  const ids = new Set((players || []).map(p=>p.id));
  Object.keys(saved).forEach(id=>{
    if (!ids.has(id) || !saved[id] || typeof saved[id] !== 'object') return;
    reads[id] = {};
    READ_FIELDS.forEach(f=>{ const v = saved[id][f]; reads[id][f] = Number.isSafeInteger(v) && v >= 0 ? v : 0; });
  });
  return reads;
}

/* ============================================================
   PREFLOP FROM RANGES (docs/ai/AI_PLAN.md, Step 2)
   ============================================================
   Every opponent thinks in hand RANGES, the way people do: "from this
   seat I open my best 21%", "he raised from early position, so he has
   a strong 15%". A hand's strength is its percentile among all 1326
   starting hands (preflopPercentile: 0 = aces, 1 = seven-deuce).

   Personality moves the ranges (looser/tighter, raise or limp). SKILL moves
   the leaks, through PREFLOP_SKILL on the skill dial:
     posAware  — how much the seat changes the opening range (0: the same
                 range from every seat)
     read      — how well they narrow a raiser's range (0: "he could have
                 anything"), so how much a raise from a rock scares them
     limpExtra — extra hands limped in on top of the opening range
     limpShare — share of their raising hands they limp instead
     sticky    — equity they'll call short of the price (calling-station leak)
     bluff3    — how often a suited near-miss becomes a 3-bet bluff
     sizeTell  — how much bigger they raise with big hands (a readable tell)
     mix       — how blurred their thresholds are (low: crisp, disciplined)
     push      — how close to correct their short-stack shoving range is
   Nothing here sees another player's cards: only the AI's own two cards,
   seats, stacks and the public betting. */
const PREFLOP_SKILL = {
  easy:   { posAware:0.00, read:0.00, limpExtra:0.55, limpShare:0.60, sticky:0.12,  bluff3:0.00, sizeTell:0.8, mix:0.060, push:0.60 },
  medium: { posAware:0.25, read:0.20, limpExtra:0.35, limpShare:0.45, sticky:0.08,  bluff3:0.02, sizeTell:0.6, mix:0.050, push:0.70 },
  hard:   { posAware:0.60, read:0.50, limpExtra:0.10, limpShare:0.18, sticky:0.035, bluff3:0.10, sizeTell:0.3, mix:0.035, push:0.85 },
  expert: { posAware:0.90, read:0.80, limpExtra:0.03, limpShare:0.05, sticky:0.00,  bluff3:0.25, sizeTell:0.1, mix:0.025, push:0.95 },
  elite:  { posAware:1.00, read:0.95, limpExtra:0.00, limpShare:0.02, sticky:-0.01, bluff3:0.35, sizeTell:0.0, mix:0.018, push:1.00 },
};

/* A sound player's opening range by how many players are still to act
   behind them (1 = small blind vs the big blind). Heads-up has its own. */
const OPEN_RANGE_BY_BEHIND = [0.45, 0.42, 0.44, 0.28, 0.21, 0.17, 0.14, 0.12, 0.11, 0.10];
const OPEN_RANGE_HEADS_UP = 0.80;
/* Ranges people typically raise with at each level of re-raising. */
const RERAISE_RANGE = [null, null, 0.07, 0.03, 0.018];
/* Short-stack shove range at 10 big blinds, by players behind (heads-up
   separate); widens as the stack shrinks. */
const PUSH_RANGE_BY_BEHIND = [0.55, 0.45, 0.32, 0.20, 0.15, 0.12, 0.10, 0.09, 0.08, 0.08];
const PUSH_RANGE_HEADS_UP = 0.62;
const PUSH_FOLD_BB = 10;

function bbIndexOf(g){
  if (typeof g.bbIndex === 'number' && g.bbIndex >= 0) return g.bbIndex;
  const n = g.players.length, d = g.dealerIndex >= 0 ? g.dealerIndex : 0;
  return n === 2 ? (d + 1) % n : (d + 2) % n;
}
/* 0 = first to act preflop ... the big blind acts last. */
function preflopOrder(g, i){
  const n = g.players.length;
  return (i - bbIndexOf(g) - 1 + 2*n) % n;
}
/* Players dealt in who act after seat i preflop (folded ones excluded). */
function playersBehindPreflop(g, i){
  let c = 0;
  const mine = preflopOrder(g, i);
  g.players.forEach((p, j)=>{
    if (j !== i && p.inHand && !p.folded && preflopOrder(g, j) > mine) c++;
  });
  return c;
}
function dealtCount(g){ return g.players.filter(p=>p.inHand).length; }

function standardOpenRange(g, i){
  if (dealtCount(g) === 2) return OPEN_RANGE_HEADS_UP;
  const behind = playersBehindPreflop(g, i);
  return OPEN_RANGE_BY_BEHIND[Math.min(behind, OPEN_RANGE_BY_BEHIND.length-1)];
}
function standardPushRange(g, i, bbLeft){
  const base = dealtCount(g) === 2 ? PUSH_RANGE_HEADS_UP
    : PUSH_RANGE_BY_BEHIND[Math.min(playersBehindPreflop(g, i), PUSH_RANGE_BY_BEHIND.length-1)];
  return Math.min(1, base * Math.pow(PUSH_FOLD_BB / Math.max(1.5, bbLeft), 0.6));
}

/* Smooth yes/no around a threshold: x > 0 leans yes. `width` is how
   blurry the edge is — this is what makes play mixed rather than robotic. */
function edge(x, width){ return 1 / (1 + Math.exp(-x / Math.max(1e-6, width))); }
function leanYes(x, width){ return Math.random() < edge(x, width); }

/* What the AI believes an aggressor's range to be, from public facts only:
   the aggressor's seat, how many raises there have been, whether they're
   all-in short. Low `read` skill blends toward "could be anything". */
/* How much wider (or tighter) than a normal player `target` has shown
   themselves to be, as `observer` sees it (1 = normal). */
function readWidth(observer, target, g, stat){
  if (!observer || !target) return 1;
  const rd = aiReadOf(observer, target, g);
  return Math.max(0.35, Math.min(4, rd[stat] / READ_PRIOR[stat]));
}
function estimateRaiserRange(g, raiser, level, read, observer){
  const bb = g.bigBlind;
  const ri = g.players.indexOf(raiser);
  let model;
  const raiserBB = (raiser.chips + raiser.betThisRound) / bb;
  if (raiser.allIn && raiserBB <= 15) model = standardPushRange(g, ri, raiserBB);
  else if (level <= 1) model = standardOpenRange(g, ri) * 0.9;
  else model = RERAISE_RANGE[Math.min(level, RERAISE_RANGE.length-1)];
  // a big raise from a sound player is a stronger range
  const sizeBB = g.currentBet / bb;
  if (level <= 1 && sizeBB > 4.5 && !raiser.allIn) model *= 0.75;
  // someone who has been raising every hand has a much wider range
  model = Math.min(1, model * Math.pow(readWidth(observer, raiser, g, 'pfr'), level <= 1 ? 1 : 0.7));
  return model * read + 0.45 * (1 - read);
}

async function aiPreflop(player, g, c){
  const { dp, pers, mood, formatAdj, toCall, stack, bb, bbLeft } = c;
  let { aggression, tightness } = c;
  const sk = skillBlend(PREFLOP_SKILL, aiSkillOf(player, g));
  const idx = g.players.indexOf(player);
  const pct = preflopPercentile(player.hand);
  const cls = holeClass(player.hand[0], player.hand[1]);
  const suited = cls.length === 3 && cls[2] === 's';
  const headsUp = dealtCount(g) === 2;
  const isBB = idx === bbIndexOf(g);
  const inPosition = seatsAfter(idx) === 0;
  const raises = typeof g.streetRaises === 'number' ? g.streetRaises
    : (g.currentBet > bb ? 1 : 0);
  const allInTotal = player.betThisRound + stack;
  const minRaiseTo = g.currentBet + g.minRaise;

  // personality: tight players shrink every range, loose ones stretch it
  let loose = Math.exp((0.5 - tightness) * 1.2);
  if (mood.kind === 'up') loose *= 1 + 0.25*mood.intensity;
  if (mood.kind === 'steamed') aggression = Math.min(1, aggression + 0.1*mood.intensity);
  const callBonus = mood.kind === 'down' ? 0.03*mood.intensity : 0;
  if (formatAdj.bubble) loose *= 0.85;

  const call = () => toCall > 0 ? { action:'call' } : { action:'check' };
  const fold = () => toCall > 0 ? { action:'fold' } : { action:'check' };
  const shove = () => player.mayRaise && stack > toCall ? { action:'raise', amount: allInTotal } : { action:'call' };
  /* Raise to `total`; if that commits most of the stack, go all-in when
     the hand is good enough to (valueOK), otherwise just call. */
  function raiseTo(total, valueOK){
    if (!player.mayRaise || stack <= toCall) return call();
    total = Math.max(Math.round(total), minRaiseTo);
    if (total >= allInTotal * 0.45) return valueOK ? shove() : call();
    return { action:'raise', amount: Math.min(total, allInTotal) };
  }
  // raise-size tell: weak players raise bigger with their best hands
  const tellBump = 1 + sk.sizeTell * Math.max(0, 0.08 - pct) * 8 * (0.5 + Math.random()*0.5);

  // ---- short stack: push or fold ----
  const others = g.players.filter(p=>p !== player && p.inHand && !p.folded);
  const effBB = Math.min(bbLeft + player.betThisRound/bb,
    Math.max(0, ...others.map(p=>(p.chips + p.betThisRound)/bb)));
  if (effBB <= PUSH_FOLD_BB && raises === 0){
    const range = standardPushRange(g, idx, effBB) * loose * sk.push;
    if (leanYes(range - pct, sk.mix * 0.6)) return shove();
    if (isBB) return { action:'check' };
    // cheap small-blind complete with something playable
    if (toCall <= bb*0.5 && leanYes(range*1.6 - pct, sk.mix)) return call();
    return fold();
  }

  // ---- nobody has raised yet ----
  if (raises === 0){
    const limpers = others.filter(p=>p.betThisRound >= bb && preflopOrder(g, g.players.indexOf(p)) < preflopOrder(g, idx)
      && g.players.indexOf(p) !== bbIndexOf(g)).length;
    const positional = standardOpenRange(g, idx);
    // position-blind players open about the same 22% from every seat
    const openRange = Math.min(0.95, (positional * sk.posAware + 0.22 * (1 - sk.posAware)) * loose);
    // sound players use one steady size; weak ones raise bigger and all over the place
    const raiseSize = () => (headsUp ? 2.2 : 2.3) * bb
      * (1 + (1 - sk.posAware) * (0.3 + Math.random()*0.5)) * tellBump + limpers * bb;
    if (isBB){
      // the big blind's option: raise the limpers with strength, else check
      if (leanYes(openRange * 0.25 * (0.5 + aggression) - pct, sk.mix * 0.5)) return raiseTo(bb*3.5 + limpers*bb, pct < 0.05);
      return { action:'check' };
    }
    const raiseLine = limpers > 0 ? openRange * 0.65 : openRange;
    const limpLine = Math.min(0.9, openRange * (1 + sk.limpExtra) + (limpers > 0 ? 0.08 * (1 - sk.posAware) : 0));
    // one roll decides raise / limp / fold, so a hand on the edge of the
    // raising range doesn't get a second chance as a limp
    const pRaise = edge(raiseLine - pct, sk.mix);
    const pEnter = Math.max(pRaise, edge(limpLine - pct, sk.mix));
    const u = Math.random();
    if (u < pRaise){
      // weak players limp some of their raising hands; aggressive ones rarely
      const limpIt = Math.random() < sk.limpShare * (1.2 - aggression);
      if (!limpIt) return raiseTo(raiseSize(), pct < 0.04);
      return call();
    }
    if (u < pEnter) return call();
    return fold();
  }

  // ---- facing a raise (or several) ----
  const aggressor = g.players.find(p=>p.id === g.pfAggressorId) ||
    others.reduce((a, p)=> p.betThisRound > (a ? a.betThisRound : -1) ? p : a, null);
  const callers = others.filter(p=>p !== aggressor && p.betThisRound >= g.currentBet && p.betThisRound > bb);
  const R = estimateRaiserRange(g, aggressor, raises, sk.read, player);
  const ranges = [R].concat(callers.map(()=>Math.min(1, R * 1.6)));
  const iters = Math.min(dp.iterations, 600);
  const eq = await EquityService.get(player.hand, [], ranges.length, iters, ranges);

  const potOdds = toCall / (g.pot + toCall);
  const deep = (stack - toCall) / Math.max(1, toCall) > 12;
  const implied = deep && (cls[0] === cls[1] || (suited && '23456789TJQKA'.indexOf(cls[0]) - '23456789TJQKA'.indexOf(cls[1]) <= 2)) ? 0.06 : 0;
  // equity a hand actually gets to use: less out of position and for weak
  // hands (they fold before showdown more), less still with players behind
  // who may re-raise; skilled players account for all of it
  const behind = playersBehindPreflop(g, idx);
  const realize = (inPosition ? 0.95 : 0.82) - 0.12 * pct;
  const realized = eq * (realize * sk.read + 1 * (1 - sk.read));
  // cold-calling a raise (not from the big blind) needs a margin skilled
  // players respect: you're often dominated and rarely close the action
  const coldCall = !isBB && raises === 1 ? 0.03 * sk.read : 0;
  const required = potOdds + behind * 0.02 + coldCall - implied - sk.sticky - callBonus - (loose - 1) * 0.04;

  // re-raise for value, or (skilled players) as a bluff with a suited near-miss
  const valueRaise = eq > 0.60 + (1 - aggression) * 0.06 && leanYes(eq - (0.60 + (1 - aggression) * 0.06), sk.mix);
  const bluffRaise = !valueRaise && raises <= 2 && suited && pct < 0.40 && eq < required + 0.08 && eq > required - 0.12
    && Math.random() < sk.bluff3 * (0.4 + aggression);
  if ((valueRaise || bluffRaise) && player.mayRaise){
    const mult = raises >= 2 ? 2.3 : (inPosition ? 3 : 3.8);
    const total = g.currentBet * mult + callers.length * g.currentBet;
    const r = raiseTo(total, valueRaise && eq > 0.55);
    if (r.action === 'raise' || !bluffRaise) return r;
  }
  // short stacks don't flat big raises: they shove or fold
  if (bbLeft <= 15 && toCall > stack * 0.3){
    return leanYes(realized - required, sk.mix * 0.6) ? shove() : fold();
  }
  if (leanYes(realized - required, sk.mix * 0.8)) return call();
  return fold();
}

/* ============================================================
   POSTFLOP: LINES, SIZING AND DEFENCE (docs/ai/AI_PLAN.md, Step 3)
   ============================================================
   A thinking player judges a hand against the RANGE they'd have here
   (rangeRelStrength: 0 = the top of it), bets the top of that range for
   value and a matching share of bluffs (fewer for small bets, more for
   big ones), checks the middle, and when bet into defends enough of their
   range that bluffing them isn't free. They pick a bet size from the board
   and the street, the same for value and bluffs, so the size tells you
   nothing. And a bet starts a PLAN that carries across streets: a bluff
   keeps going when a scare card lands and gives up when it doesn't.

   A weak player judges the hand in absolutes ("I've got top pair!"),
   calls with any pair, bluffs at random, and bets bigger when strong.

   POSTFLOP_SKILL, on the skill dial:
     rangeThink — range-relative (1) vs absolute (0) judgement
     read       — how well they picture the opponents' ranges
     bluffPlan  — bluffs chosen by a plan (draws, blockers of the story,
                  scare cards) vs random stabs
     trap       — how often a monster checks to spring a trap
     sizeTell   — how much the bet size follows hand strength
     mix        — how blurred the thresholds are
     sticky     — how far they call past the right price
     timingTell — how much their think time gives away (think time)
     adapt      — how much they trust what they've seen of a player (READS) */
const POSTFLOP_SKILL = {
  easy:   { rangeThink:0.00, read:0.00, bluffPlan:0.00, trap:0.04, sizeTell:0.90, mix:0.080, sticky:0.26, timingTell:0.8, adapt:0.00 },
  medium: { rangeThink:0.20, read:0.10, bluffPlan:0.15, trap:0.07, sizeTell:0.70, mix:0.060, sticky:0.22, timingTell:0.6, adapt:0.00 },
  hard:   { rangeThink:0.55, read:0.50, bluffPlan:0.50, trap:0.11, sizeTell:0.35, mix:0.045, sticky:0.05, timingTell:0.3, adapt:0.45 },
  expert: { rangeThink:0.85, read:0.80, bluffPlan:0.85, trap:0.14, sizeTell:0.10, mix:0.030, sticky:0.01, timingTell:0.1, adapt:0.80 },
  elite:  { rangeThink:1.00, read:0.95, bluffPlan:1.00, trap:0.17, sizeTell:0.00, mix:0.020, sticky:0.00, timingTell:0.0, adapt:1.00 },
};

/* How a player who thinks in absolutes rates a made hand (0 = unbeatable,
   ~1 = nothing). Kicker nudges top pair. */
const MADE_ABS = { 'straight-flush':0.003, quads:0.006, 'full-house':0.02, flush:0.04, straight:0.06,
  set:0.07, trips:0.10, 'two-pair':0.13, overpair:0.20, 'top-pair':0.32, 'second-pair':0.50, 'weak-pair':0.62, nothing:0.90 };

/* A player's likely preflop range as a fraction, from public facts only:
   who raised, how many raises, whether they were the big blind in a limped
   pot. `read` blends toward "could be anything" for weak readers. */
function preflopRangeOf(g, p, read, loose, observer){
  const i = g.players.indexOf(p);
  const raises = typeof g.pfRaises === 'number' ? g.pfRaises : (g.pfAggressorId ? 1 : 0);
  let model;
  if (g.pfAggressorId === p.id) model = raises >= 2 ? RERAISE_RANGE[Math.min(raises, RERAISE_RANGE.length-1)] : standardOpenRange(g, i);
  else if (raises >= 2) model = 0.08;                       // called a 3-bet
  else if (raises === 1) model = i === bbIndexOf(g) ? 0.45 : 0.20;   // defended / cold-called a raise
  else model = i === bbIndexOf(g) ? 1 : 0.45;             // limped pot
  model = Math.min(1, model * (loose || 1));
  if (observer) model = Math.min(1, model * readWidth(observer, p, g, g.pfAggressorId === p.id ? 'pfr' : 'vpip'));
  return model * read + 0.6 * (1 - read);
}

/* A card that changes the story: an overcard to the board, the third of a
   suit, or one that makes a straight possible. Bluffs keep firing on these. */
function isScareCard(board){
  if (board.length < 4) return false;
  const prev = board.slice(0, -1), card = board[board.length-1];
  if (card.value > Math.max(...prev.map(c=>c.value))) return true;
  if (prev.filter(c=>c.suit === card.suit).length === 2) return true;
  return straightPossible(board) && !straightPossible(prev);
}
/* Three board ranks inside any five-rank window (ace plays low too). */
function straightPossible(board){
  const vals = new Set(board.map(c=>c.value));
  if (vals.has(14)) vals.add(1);
  for (let lo=1; lo<=10; lo++){
    let n = 0;
    for (let v=lo; v<lo+5; v++) if (vals.has(v)) n++;
    if (n >= 3) return true;
  }
  return false;
}

async function aiPostflop(player, g, c){
  const { dp, pers, mood, bluffFreq, callLoosen, toCall, stack, bb } = c;
  let { aggression, tightness } = c;
  const sk = skillBlend(POSTFLOP_SKILL, aiSkillOf(player, g));
  const idx = g.players.indexOf(player);
  const street = g.board.length;               // 3 flop, 4 turn, 5 river
  const opps = g.players.filter(p=>p !== player && p.inHand && !p.folded);
  const canBetInto = opps.filter(p=>!p.allIn).length;
  const multi = Math.max(0, opps.length - 1);
  const pot = g.pot;
  const inPosition = seatsAfter(idx) === 0;
  const allInTotal = player.betThisRound + stack;
  const sizeMul = 0.85 + (pers.sizing || 0.7) * 0.30;   // archetype size fingerprint: the same for every hand
  const loose = Math.exp((0.5 - tightness) * 1.2);
  if (mood.kind === 'steamed') aggression = Math.min(1, aggression + 0.1*mood.intensity);

  // ---- what do I have? ----
  const hc = classifyPostflop(player.hand, g.board);
  const myRange = preflopRangeOf(g, player, 1, loose);
  const relFull = rangeRelStrength(player.hand, g.board, myRange);
  // ---- the plan for this hand (carried across streets) ----
  const handKey = player.hand.map(cardKey).join('');
  if (!player.aiPlan || player.aiPlan.key !== handKey) player.aiPlan = { key: handKey, line: null, scale: 1 };
  const plan = player.aiPlan;
  // after calling a bet, my range is only the part I continue with, so a
  // hand ranks lower within it on the next street
  const rel = Math.min(1, relFull / Math.max(0.15, plan.scale));
  const absPct = Math.min(0.95, MADE_ABS[hc.made] + (hc.made === 'top-pair' ? (9 - Math.max(0, hc.kicker - 3)) * 0.012 : 0));
  // the strength this player actually acts on: range-relative for thinkers
  const str = rel * sk.rangeThink + absPct * (1 - sk.rangeThink);
  const strongDraw = street < 5 && (hc.draws.flush || hc.draws.oesd);
  const weakDraw = street < 5 && !strongDraw && (hc.draws.gutshot || hc.draws.backdoorFlush || hc.draws.overcards);

  // equity against the opponents' likely ranges, with a weak reader's misjudgement
  // what this player has seen of the others: do they fold? do they bluff?
  const reads = opps.map(o=>aiReadOf(player, o, g));
  // each opponent's range: their preflop range, narrowed by what they've
  // done since the flop this hand, as well as this player reads hands
  const ranges = opps.map((o, i)=>{
    const pct = preflopRangeOf(g, o, sk.read, 1, player);
    const hist = (g.handLog || []).filter(h=>h.id === o.id).map(h=>({ n:h.n, a:h.a }));
    if (!hist.length || sk.read <= 0) return pct;
    const bluff = Math.max(0.4, Math.min(3, (reads[i].agg / READ_PRIOR.agg) * Math.pow(reads[i].bluff / READ_PRIOR.bluff, 0.5)));
    return { pct, hist, bluff: +bluff.toFixed(2), k: +sk.read.toFixed(2) };
  });
  const foldiness = reads.reduce((a, r)=>a * r.ftb, 1) / Math.pow(READ_PRIOR.ftb, reads.length);
  let eq = await EquityService.get(player.hand, g.board, ranges.length, Math.min(dp.iterations, 700), ranges);
  eq = clamp01(eq + (Math.random() - 0.5) * dp.noise);

  const iWasAggressor = g.prevAggressorId === player.id;   // I bet/raised the last street
  const scare = isScareCard(g.board);

  // ---- sizing: from the board and street for thinkers; from strength for the rest ----
  function betFraction(){
    const t = hc.texture;
    let solid = street === 3 ? (t.wet < 0.35 && !multi ? 0.33 : 0.62) : street === 4 ? 0.66 : 0.75;
    if (street === 5 && sk.rangeThink > 0.9 && (str < 0.04 || plan.line === 'bluff') && Math.random() < 0.2) solid = 1.2;  // polar overbet
    const tell = 0.45 + (0.55 - str) * 0.9 + (Math.random() - 0.5) * 0.2;
    const f = solid * (1 - sk.sizeTell) + tell * sk.sizeTell;
    return Math.max(0.25, Math.min(1.3, f)) * sizeMul;
  }
  /* commit only strong hands: how much of the range may play for the whole
     stack depends on stack-to-pot ratio (short stacks commit lighter) */
  const spr = stack / Math.max(1, pot);
  const commitLine = spr < 1.5 ? 0.45 : spr < 3 ? 0.25 : spr < 6 ? 0.12 : 0.06;
  const canCommit = str < commitLine || eq > 0.72;
  function betOrRaiseTo(total, isValue){
    if (!player.mayRaise || canBetInto === 0) return toCall > 0 ? { action:'call' } : { action:'check' };
    total = Math.round(total);
    const minTo = toCall > 0 ? g.currentBet + g.minRaise : player.betThisRound + bb;
    total = Math.max(total, minTo);
    // a bet that leaves a sliver behind is an all-in
    if (allInTotal - total < pot * 0.25) total = allInTotal;
    if (total >= allInTotal){
      if (!(isValue && canCommit)) return toCall > 0 ? { action:'call' } : { action:'check' };
      total = allInTotal;
    }
    return { action: toCall > 0 ? 'raise' : 'bet', amount: total };
  }

  // ======== nothing to call: bet or check ========
  if (toCall <= 0){
    if (canBetInto === 0) return { action:'check' };
    const frac = betFraction();
    const betTotal = player.betThisRound + Math.max(bb, pot * frac);
    // how much of my range bets for value here
    let vWidth = street === 3 ? 0.34 : street === 4 ? 0.26 : 0.18;
    if (iWasAggressor) vWidth *= 1.25;
    if (inPosition) vWidth *= 1 + dp.positionWeight * 2;
    vWidth *= Math.pow(0.72, multi) * (0.8 + 0.4 * aggression) * Math.sqrt(loose);
    // thin value against people who don't fold
    const minFtb = Math.min(...reads.map(r=>r.ftb));
    vWidth *= Math.max(0.8, Math.min(1.45, 1 + (READ_PRIOR.ftb - minFtb) * 1.0));

    // a monster sometimes checks to trap (dry boards, not the river last to act)
    if (str < 0.08 && !(street === 5 && inPosition) && plan.line !== 'value'
        && Math.random() < sk.trap * (1.2 - aggression) * (hc.texture.wet < 0.4 ? 1 : 0.4)){
      plan.line = 'trap';
      return { action:'check' };
    }
    // a good reader also bets when the opponents' narrowed ranges say
    // this hand is ahead (they've shown weakness), whatever the range says
    const aheadOfThem = eq > 0.6 + 0.05 * multi && Math.random() < sk.read * 0.8;
    if (leanYes(vWidth - str, sk.mix) || aheadOfThem){
      plan.line = 'value';
      return betOrRaiseTo(betTotal, true);
    }
    // bluffs: planned (a share that matches the bet size, draws first,
    // scare cards keep a story going) or, for weak players, random stabs
    const ratio = frac / (1 + 2 * frac);
    let planned = vWidth * ratio / (1 - ratio) / 0.45;
    planned *= strongDraw ? 1.7 : weakDraw ? 1.1 : street === 5 ? 1.0 : 0.55;
    if (iWasAggressor) planned *= 1.3;
    if (plan.line === 'bluff' || plan.line === 'semibluff') planned *= scare ? 1.5 : 0.55;
    const random = bluffFreq * 0.6;
    let bluffRate = (planned * sk.bluffPlan + random * (1 - sk.bluffPlan)) * (0.6 + 0.8 * aggression);
    bluffRate *= Math.pow(0.35, multi);
    // don't bluff people who never fold; lean on people who fold too much
    bluffRate *= Math.max(0, Math.min(2.2, Math.pow(foldiness, 1.5)));
    if (str > 0.5 && Math.random() < bluffRate){
      plan.line = strongDraw || weakDraw ? 'semibluff' : 'bluff';
      return betOrRaiseTo(betTotal, false);
    }
    return { action:'check' };
  }

  // ======== facing a bet ========
  const potBefore = Math.max(1, pot - toCall);
  const b = toCall / potBefore;                         // bet size as a share of the pot
  const potOdds = toCall / (pot + toCall);
  // share of range to defend so a bluff doesn't auto-profit; with other
  // players also facing the bet the defence is shared, so each needs less
  const alpha = b / (1 + b);
  const defenders = Math.max(1, opps.filter(p=>p.id !== g.streetAggressorId).length + 1);
  const mdf = 1 - Math.pow(alpha, 1 / defenders);
  // absolute players: any pair (and draws) continue, tight ones fold more to big bets
  const absLine = 0.55 + sk.sticky + callLoosen + (0.5 - tightness) * 0.3 - b * 0.15;
  let contLine = mdf * sk.rangeThink + absLine * (1 - sk.rangeThink);
  const bettor = opps.find(p=>p.id === g.streetAggressorId);
  if (bettor){
    const r = aiReadOf(player, bettor, g);
    const lean = Math.pow(r.agg / READ_PRIOR.agg, 0.5) * Math.pow(r.bluff / READ_PRIOR.bluff, 0.3);
    contLine = Math.min(0.95, contLine * Math.max(0.7, Math.min(1.6, lean)));
  }
  const drawOK = (strongDraw || weakDraw) && eq + (strongDraw ? 0.08 : 0.03) * (street === 3 ? 1 : 0.6) > potOdds;

  // raise: for value from the top of the continuing range, or a semi-bluff with a big draw
  // (a hand reader only value-raises when it's also ahead of what their betting says they have)
  const valueRaise = str < contLine * 0.22 && Math.random() < 0.35 + aggression * 0.5 + (plan.line === 'trap' ? 0.3 : 0)
    && (eq > 0.55 || Math.random() > sk.read);
  const semiRaise = !valueRaise && strongDraw && street < 5 && multi === 0
    && Math.random() < 0.25 * sk.bluffPlan * (0.4 + aggression) + bluffFreq * 0.2 * (1 - sk.bluffPlan);
  if ((valueRaise || semiRaise) && player.mayRaise && stack > toCall){
    const total = g.currentBet + (pot + toCall) * 0.8 * sizeMul;
    const r = betOrRaiseTo(total, valueRaise);
    if (r.action === 'raise'){ plan.line = valueRaise ? 'value' : 'semibluff'; return r; }
  }
  // hopeless: no pair, no draw, equity far off the price
  if (!drawOK && eq < potOdds * 0.6 && str > 0.7) return { action:'fold' };
  // players who think in absolutes chase any draw ("it could come!")
  const chase = (strongDraw || weakDraw) && Math.random() < (1 - sk.rangeThink) * 0.8;
  let continues = leanYes(contLine - str, sk.mix) || drawOK || chase;
  // what their actions say overrides range balance, as far as this
  // player can read hands: fold when clearly beaten, call when clearly not
  // (a smooth lean, not a cut-off, so reading skill grades evenly)
  if (continues && !drawOK && Math.random() < sk.read * edge(potOdds - 0.02 - eq, 0.04)) continues = false;
  else if (!continues && Math.random() < sk.read * edge(eq - potOdds - 0.12, 0.04)) continues = true;
  if (!continues) return { action:'fold' };
  // calling off most of the stack needs a hand that can commit
  const wouldCommit = (player.totalBetHand + toCall) / Math.max(1, player.chips + player.totalBetHand);
  if (wouldCommit > 0.5 && !canCommit && eq < potOdds + 0.12) return { action:'fold' };
  plan.scale *= Math.max(0.35, Math.pow(Math.min(1, contLine), 0.7));
  return { action:'call' };
}

async function aiDecide(player, g){
  const idx = g.players.indexOf(player);
  const numOpp = g.players.filter(p=>p.inHand && !p.folded && p.id!==player.id).length;
  const dp = aiDifficultyParams(player, g);

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
    // real tilt: a big loss with a real hand makes them looser, pushier and
    // bluffier for a few hands. How hard it hits is temperament (the
    // Professor shrugs, Tony boils); skilled players hold it together better.
    const skill01 = aiSkillOf(player, g) / 100;
    const hit = mood.intensity * (typeof pers.tilt === 'number' ? pers.tilt : 0.5) * (1 - 0.6*skill01);
    tightness  = Math.max(0, tightness  - 0.25*hit);
    aggression = Math.min(1, aggression + 0.30*hit);
    bluffFreq  = Math.min(1, bluffFreq  + 0.12*hit);
  }

  const toCall = Math.max(0, g.currentBet - player.betThisRound);
  const stack = player.chips;
  const bb = g.bigBlind;
  const bbLeft = stack / bb;
  const formatAdj = aiFormatAdjustments(g,player,numOpp,bbLeft);
  aggression = clamp01(aggression + formatAdj.aggression);
  tightness = clamp01(tightness + formatAdj.tightness);
  bluffFreq = clamp01(bluffFreq + formatAdj.bluffFreq);

  // Preflop is played from ranges (docs/ai/AI_PLAN.md, Step 2)
  if (g.board.length===0){
    return aiPreflop(player, g, { dp, pers, mood, aggression, tightness, formatAdj, toCall, stack, bb, bbLeft });
  }

  // Postflop: range-aware lines, sizing and defence (docs/ai/AI_PLAN.md, Step 3)
  return aiPostflop(player, g, { dp, pers, mood, aggression, tightness, bluffFreq, callLoosen, toCall, stack, bb });
}

/* How long an AI 'thinks'. Scaled by the archetype's thinkSpeed and the
   player's chosen game speed.

   The pause is built from the SPOT, not the choice: a big pot, a big bet
   to face or a late street takes longer whatever they then do. How much
   the chosen action leaks into it is the skill dial's timingTell: Back
   Room players really do pause before a big raise (a tell worth learning);
   Elite players take the same time to fold as to shove. */
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
  const stackStart = Math.max(1, player.chips + player.totalBetHand);
  // the spot: how much is at stake for this player right now
  const stakes = Math.min(1, (g.pot + toCall) / stackStart);
  const facing = Math.min(1, toCall / Math.max(1, g.pot));
  const lateStreet = g.board.length >= 4 ? 1 : 0;
  const spotMs = 600 + stakes*900 + facing*500 + lateStreet*200 + Math.random()*650;
  // the choice (only as loud as this player's tell)
  const allIn = decision.amount != null && decision.amount >= player.betThisRound + player.chips;
  const big = allIn || decision.action==='raise' || decision.action==='bet'
    || (decision.action==='fold' && toCall > g.pot*0.5)
    || (decision.action==='call' && toCall > player.chips*0.3);
  const choiceMs = (big ? 1350 + Math.random()*1050 : 550 + Math.random()*500) + (allIn ? 500 : 0);
  const tell = skillBlend(POSTFLOP_SKILL, aiSkillOf(player, g)).timingTell;
  const ms = spotMs * (1 - tell) + choiceMs * tell;
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
