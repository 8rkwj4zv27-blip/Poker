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
// Preferred VISITOR roster: the four archetypes an overflow seat is
// filled from first. Since the Enemy Personality pass, PERSONALITIES_ALL
// no longer seats the main field — the five residents in 03-residents.js
// do — so everything below serves the seats a table has LEFT OVER once
// the cast is seated. This is a gameplay choice, not an art constraint:
// illustrated face art is fully decoupled from persona (see FACE_ART in
// 02-support-systems.js) and works for any entry in PERSONALITIES_ALL.
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

/* ============================================================
   SEATING THE CAST — residents first, then visitors

   THE RULE: the five residents fill a table before anybody else, in a
   shuffled order, never duplicated. Only the seats left over after all
   five are seated draw a visitor from PERSONALITIES_ALL.

   That matters because the supported table sizes do not all fit five:
     Career events      1-5 opponents  -> residents only
     Single Player run  4, 5 or 6      -> one visitor at 6
     Custom Game        1-8 opponents  -> up to three visitors
   Capping the game at five opponents would have deleted working table
   sizes, and inventing three more permanent characters was not on the
   table, so the overflow seat keeps EXACTLY the behaviour it had before
   this pass: an ordinary archetype under the ordinary name setting, with
   a neutral tendency profile (RESIDENT_NEUTRAL_POKER) so its play is
   bit-identical to the pre-pass AI. A visitor is a real person for one
   session and is presented as one — public style label, no biography,
   no id, no continuity, nothing that could be mistaken for a sixth
   member of the cast.

   Colour distinctness falls out for free: the residents own indices
   0/1/3/4/5 permanently, assignFaceColors() only ever backfills seats
   that have none, and FACE_COLORS has exactly 8 entries — so the three
   possible visitors take 2/6/7 and no table can ever repeat a colour. */
function pickTableCast(n){
  const seats = Math.max(0, n|0);
  if (!seats) return [];
  const residents = RESIDENT_PERSONAS.slice();
  for (let i=residents.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1)); const t=residents[i]; residents[i]=residents[j]; residents[j]=t;
  }
  const cast = residents.slice(0, Math.min(seats, residents.length));
  if (seats > cast.length) cast.push(...pickPersonalities(seats - cast.length));
  return cast.slice(0, seats);
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
/* How many live opponents still have to act behind this seat — the raw
   material for "am I in position?".

   `!p.acted` is what makes this a position read at all. Without it the
   loop wrapped the whole table and counted every live opponent, which is
   the same number aiDecide already has in `numOpp` — so the positional
   term `dp.positionWeight * (1 - seatsAfter/numOpp)` evaluated to zero in
   every ordinary hand, and the whole position axis (including the
   difficulty ladder's positionWeight, which rises easy -> elite) was
   silently doing nothing. `acted` is existing, maintained state: cleared
   at the start of each betting round (startNewHand/openBettingRound) and
   re-cleared for everyone by a full raise, then set in applyAction. The
   acting player is excluded by the id test regardless. */
function seatsAfter(playerIdx){
  const g = game;
  let count = 0;
  const n = g.players.length;
  for (let c=1;c<n;c++){
    const p = g.players[(playerIdx+c)%n];
    if (p.inHand && !p.folded && !p.allIn && !p.acted && p.id !== g.players[playerIdx].id) count++;
  }
  return count;
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

/* Mood machinery: a lightweight state on each AI that biases decisions a
   little and fades quickly. Kinds:
     'up'      — riding a big win: plays looser and a touch more aggressive
     'down'    — stung by a loss/missed draw: calls a little wider
     'steamed' — lost a big pot with a real hand: tightens up, but hits harder
   Intensity decays ~45% per hand and evaporates below 0.15.

   TEMPERAMENT (Enemy Personality pass): how far a public event moves a
   given character, and how fast it fades, is now part of who they are —
   Steve rides a run, Lucy barely registers one. It scales the incoming
   intensity and the per-hand decay only; the three kinds, the call sites
   and the small biases aiDecide() applies are untouched, so mood stays
   SUBORDINATE to the resident's underlying poker identity rather than
   becoming a second personality system. Visitors get moodGain 1 /
   moodDecay 0.75, i.e. exactly the previous behaviour. */
function nudgeMood(p, kind, intensity){
  if (!p || p.isHuman) return;
  const temper = personaTemperament(p.personality);
  const amount = Math.min(1, Math.max(0, intensity * temper.moodGain));
  const cur = p.moodState;
  if (cur && cur.kind===kind) cur.intensity = Math.min(1, cur.intensity + amount*0.6);
  else p.moodState = { kind, intensity: amount };
}
function decayMoods(){
  if (!game) return;
  game.players.forEach(p=>{
    const m = p.moodState;
    if (!m) return;
    // slower decay than before: a hot or cold run should read as a
    // multi-hand streak, not a one-hand blip
    m.intensity *= personaTemperament(p.personality).moodDecay;
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
  const res = residentOf(p);
  if (res){
    const role = m.family === 'positive' ? 'pleased'
      : m.family === 'confident' ? (m.intensity > 0.62 ? 'smug' : 'sly')
      : m.family === 'irritated' ? 'cross'
      : m.family === 'nervous' ? (m.intensity > 0.62 ? 'wound' : 'rattled')
      : m.family === 'uncertain' ? 'rattled'
      : m.family === 'shock' ? 'wild'
      : 'rest';
    const key = residentFace(p, role, res.rest);
    const sig = 'resident|' + res.id + '|' + m.family + '|' + role + '|' + key;
    if (p._faceSig !== sig || p._faceKey !== key){
      p._faceSig = sig;
      p._faceKey = key;
    }
    return p._faceKey;
  }
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
    if (residentOf(p)) return residentFace(p, 'rattled', base);
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
  if (residentOf(p)){
    if (m.family === 'confident') return residentFace(p, 'smug', baselineFaceExpression(p));
    if (m.family === 'irritated') return residentFace(p, 'cross', baselineFaceExpression(p));
    if (m.family === 'nervous' || m.family === 'uncertain') return residentFace(p, 'rattled', baselineFaceExpression(p));
    if (m.family === 'shock') return residentFace(p, 'wild', baselineFaceExpression(p));
    return residentFace(p, 'sly', baselineFaceExpression(p));
  }
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
      { mood: residentFace(p, 'pleased', 'relieved1'), ms: REACTION_TIMING.beat },
      { mood: residentFace(p, 'sly', ()=>pickFaceExpression('positive', 0.5, 'relieved1')), ms: REACTION_TIMING.mid },
      { mood: baselineFaceExpression(p), ms: REACTION_TIMING.hold }
    ]);
    return;
  }
  if (swingBB > 20){
    nudgeFaceMood(p, 'confident', 0.55);
    playReactionSequence(p.id, [
      { mood: residentFace(p, 'pleased', ()=>pickFaceExpression('positive', 0.8, null)), ms: REACTION_TIMING.beat },
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
  if (r < aggro * 0.55) return residentFace(p, 'cross', ()=>pickFromPool(FOLD_FACE_POOLS.annoyed));
  if (r > 0.82) return residentFace(p, 'pleased', ()=>pickFromPool(FOLD_FACE_POOLS.relieved));
  return residentFace(p, 'rattled', ()=>pickFromPool(FOLD_FACE_POOLS.resigned));
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
      { mood:residentFace(p, 'wild', 'shocked1'), ms: REACTION_TIMING.beat },
      { mood:residentFace(p, family==='irritated' ? 'cross' : 'wound', family==='irritated' ? 'angry1' : 'terrified1'), ms: REACTION_TIMING.mid },
      { mood:residentFace(p, family==='irritated' ? 'cross' : 'wound', family==='irritated' ? 'angry1' : 'veryNervous1'), ms: BUSTED_FACE_HOLD_MS }
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
      { mood:residentFace(p, 'wild', 'shocked1'), ms: REACTION_TIMING.beat },
      { mood:residentFace(p, family==='irritated' ? 'cross' : 'wound', family==='irritated' ? 'angry1' : 'veryNervous1'), ms: REACTION_TIMING.mid },
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
        { mood: residentFace(p, family==='irritated' ? 'cross' : 'rattled', ()=>pickFaceExpression(family, Math.min(1, before.intensity + 0.2), null)), ms: REACTION_TIMING.beat },
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
/* ============================================================
   PUBLIC DRAW STRENGTH

   How live a drawing hand is, computed from the AI's OWN two cards plus
   the shared board and nothing else. Every input here is either private
   to the player computing it or already face-up on the table, so this
   adds no information path that did not exist — aiDecide has always read
   player.hand and g.board.

   Why it exists: the Monte Carlo equity estimate already prices a draw
   correctly on average, but it cannot express a PREFERENCE about draws,
   and "calls readily with draws" versus "gives up on them" is one of the
   real differences between Tony and Nigel. This returns the shape of the
   draw so personality can weight it; it never replaces the equity.

     1   = eight-plus outs (flush draw, or open-ended straight draw)
     0.5 = four outs (gutshot)
     0   = no draw, or the hand is already made

   Only meaningful on the flop and turn: with a complete board there is
   nothing left to draw to, and preflop there is no board to draw with. */
function publicDrawStrength(hand, board){
  if (!Array.isArray(hand) || !Array.isArray(board)) return 0;
  if (board.length < 3 || board.length > 4) return 0;
  const cards = hand.concat(board);

  // Flush draw: exactly four of a suit. Five is a made flush, not a draw.
  const suits = {};
  cards.forEach(c=>{ suits[c.suit] = (suits[c.suit]||0) + 1; });
  for (const s in suits){ if (suits[s] === 4) return 1; }

  // Straight draw: how many distinct ranks would complete a straight?
  // Two or more completing ranks is eight outs (open-ended); one is four
  // (gutshot). The ace is counted both high and low so A-2-3-4 reads as
  // the wheel draw it is.
  const have = new Set();
  cards.forEach(c=>{ have.add(c.value); if (c.value === 14) have.add(1); });
  const makesStraight = set=>{
    for (let low=1; low<=10; low++){
      let run = 0;
      for (let v=low; v<low+5; v++){ if (set.has(v)) run++; else break; }
      if (run === 5) return true;
    }
    return false;
  };
  if (makesStraight(have)) return 0;          // already made
  let completing = 0;
  for (let r=2; r<=14; r++){
    if (have.has(r)) continue;
    const probe = new Set(have);
    probe.add(r);
    if (r === 14) probe.add(1);
    if (makesStraight(probe)) completing++;
  }
  return completing >= 2 ? 1 : completing === 1 ? 0.5 : 0;
}

/* ============================================================
   THE GEAR — Steve's changing gears, and nobody else's

   Once per hand a resident with a non-zero `gearRange` picks a gear in
   [-1, 1] that scales their aggression, sizing and bluff frequency
   TOGETHER. Coherence is the whole point: a hand where he has decided
   the table is soft is consistently aggressive rather than randomly so,
   which is what separates "changes gears" from "is noisy".

   The seed uses PUBLIC state only — the hand number, the seat's id, and
   the seat's stack in big blinds, all of which the player can see. The
   stack term is what lets a big public swing move him into a different
   gear for the hands that follow, satisfying "can change gears after
   public table events" without reading anything hidden. Cached per hand
   so the gear cannot drift between streets inside one hand.

   Everyone else has gearRange 0 and gets exactly 0 back. */
function residentGear(player, g){
  const range = personaPoker(player && player.personality).gearRange;
  if (!range) return 0;
  const handNo = g && Number.isFinite(g.handNumber) ? g.handNumber : 0;
  if (player._gearHand === handNo && typeof player._gear === 'number') return player._gear;
  const bb = g && g.bigBlind > 0 ? g.bigBlind : 1;
  const stackBB = Math.round((player.chips + (player.totalBetHand||0)) / bb);
  let h = 2166136261;
  const seed = handNo + '|' + String(player.id) + '|' + stackBB;
  for (let i=0;i<seed.length;i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  // >>>0 then a fixed divisor: a stable 0..1 from the hash, mapped to
  // [-1,1] and scaled by how far this character's gears actually travel.
  const unit = ((h >>> 0) % 100000) / 100000;
  player._gearHand = handNo;
  player._gear = (unit * 2 - 1) * range;
  return player._gear;
}

function aiFormatAdjustments(g, player, numOpp, bbLeft){
  const freezeout = g && (g.mode==='tournament' || g.mode==='career' || g.mode==='elimination');
  const headsUp = numOpp===1;
  const paidPlaces = g && g.mode==='career' && g.event && Array.isArray(g.event.payouts)
    ? g.event.payouts.length : 0;
  const alive = g && Array.isArray(g.players)
    ? g.players.filter(p=>p.chips>0 && !p.eliminated).length : 0;
  const bubble = paidPlaces>1 && alive===paidPlaces+1;
  // How hard this character pushes a short stack is part of who they are:
  // Nigel would rather find a spot than blind down, Tony would rather see
  // one more flop. It only scales the EXISTING widening — a visitor's
  // shortStackDrive is 1, so ordinary archetypes are unchanged.
  const shortDrive = personaPoker(player && player.personality).shortStackDrive;
  return {
    aggression:headsUp?0.08:(bubble&&bbLeft<=10?0.06:0),
    tightness:headsUp?-0.08:(bubble?0.04:0),
    bluffFreq:headsUp?0.04:0,
    foldGateWiden:freezeout&&bbLeft<ELIMINATION_CONFIG.shortStackBB
      ? (ELIMINATION_CONFIG.shortStackBB-bbLeft)*ELIMINATION_CONFIG.foldGateWidenPerBB*shortDrive : 0,
    callOffFloor:headsUp?0.48:0.56,
    headsUp,bubble,freezeout
  };
}

async function aiDecide(player, g){
  const idx = g.players.indexOf(player);
  const numOpp = g.players.filter(p=>p.inHand && !p.folded && p.id!==player.id).length;
  const dp = DIFFICULTY_PARAMS[g.difficulty];
  const rawEquity = await EquityService.get(player.hand, g.board, Math.max(1,numOpp), dp.iterations);

  const pers = player.personality;
  const mood = player.moodState || { kind:null, intensity:0 };
  // The character's private tendency dials. A visitor archetype has none
  // and lands on RESIDENT_NEUTRAL_POKER, whose every multiplier is 1 and
  // every offset 0 — so an ordinary archetype takes exactly the decisions
  // it took before the Enemy Personality pass.
  const prof = personaPoker(pers);
  // Steve's per-hand gear (0 for everyone else). Applied to the three
  // dials that read as "what mode is he in" so the hand stays coherent.
  const gear = residentGear(player, g);

  let aggression = clamp01(pers.aggression + gear*0.42);
  let tightness = clamp01(pers.tightness - gear*0.20);
  let bluffFreq = clamp01(pers.bluffFreq + gear*0.20);
  const sizingDial = Math.max(0.30, Math.min(1.25, pers.sizing + gear*0.55));
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

  const toCall = Math.max(0, g.currentBet - player.betThisRound);
  const potOdds = toCall>0 ? toCall/(g.pot + toCall) : 0;
  const stack = player.chips;
  const bb = g.bigBlind;
  const bbLeft = stack / bb;
  const formatAdj = aiFormatAdjustments(g,player,numOpp,bbLeft);
  aggression = clamp01(aggression + formatAdj.aggression);
  tightness = clamp01(tightness + formatAdj.tightness);
  bluffFreq = clamp01(bluffFreq + formatAdj.bluffFreq);
  const noise = (Math.random()-0.5) * dp.noise;
  const tightAdj = (tightness - 0.5) * -0.10;
  /* late position (few players left to act) nudges confidence up slightly.

     PERSONALITY x DIFFICULTY, and the one place they legitimately meet:
     dp.positionWeight is how ACCURATELY this difficulty reads position
     at all, and positionSensitivity is how much this character CARES.
     They multiply rather than one replacing the other, so Nigel is
     recognisably the positional one at every difficulty, and every
     difficulty still improves the underlying read. Personality never
     touches dp.iterations or dp.noise. */
  const posAdj = dp.positionWeight * prof.positionSensitivity
    * (1 - Math.min(1, seatsAfter(idx) / Math.max(1, numOpp)));
  /* Draw weighting. publicDrawStrength reads only this player's own two
     cards and the public board (see its header), and the credit is small
     and capped: it shifts how willingly a character stays with a draw,
     it does not pretend the draw is already made. drawPersistence is 1
     for visitors, so this term is a no-op for them. */
  const drawAdj = 0.055 * publicDrawStrength(player.hand, g.board) * (prof.drawPersistence - 1);
  const perceived = clamp01(rawEquity + noise + tightAdj + posAdj + drawAdj);
  const shortStack = bbLeft <= ELIMINATION_CONFIG.shortStackBB;   // shoving territory — caps don't apply
  const preflop = g.board.length===0;
  const bluffRoll = Math.random() < bluffFreq * (preflop ? 0.5 : 1);
  const sizeMul = 0.85 + sizingDial*0.30;        // character bet-size fingerprint

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
    // entryBias is how wide this character comes in: Tony's is the most
    // negative, Nigel's the most positive. It moves the gate, it does not
    // bypass it, so a genuinely unplayable hand is still folded by all of
    // them.
    let foldGate = 0.30 + tightness*0.14 + prof.entryBias
      + (facingRaise ? 0.10 + Math.min(0.10, (toCall/Math.max(1,stack))*0.5) : 0);
    // Every freezeout short stack widens gradually rather than folding into
    // the blinds. Ordinary cash remains unchanged.
    foldGate = Math.max(0, foldGate - formatAdj.foldGateWiden);
    if (toCall>0 && perceived < foldGate && !bluffRoll){
      // cheap completes from the small blind still happen with playable stuff
      if (toCall <= bb*0.5 && perceived > foldGate-0.10 && Math.random()<0.6) return {action:'call'};
      return {action:'fold'};
    }
    const raiseGate = facingRaise ? 0.62 + tightness*0.06 : 0.52 + (1-aggression)*0.10;
    // raiseDrive is raise/re-raise PROPENSITY, kept separate from the
    // strength gate above: Harry raises the same holdings more often,
    // Nigel and Tony less often, and neither of them starts raising
    // hands the gate rejects. Clamped so a high drive can still miss.
    const wantsRaise = player.mayRaise && stack > toCall &&
      (perceived > raiseGate || (bluffRoll && !facingRaise && Math.random()<0.5)) &&
      Math.random() < Math.min(0.92, (0.30 + aggression*0.45) * prof.raiseDrive);
    if (wantsRaise){
      // Critical freezeout stack (< ~5BB): cappedTotal()'s 28%/45%
      // hand-start budget caps make no sense once the whole stack IS only
      // a few BB — jam it. Push/fold framing instead of a sized raise.
      if (formatAdj.freezeout && bbLeft < ELIMINATION_CONFIG.criticalStackBB * prof.shortStackDrive){
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
    /* THE TRAP. With a hand strong enough that betting is obviously
       right, a trapping character sometimes checks it instead and lets
       somebody else bet. Gated above the value-bet threshold on purpose:
       checking a monster costs almost nothing and can win more, whereas
       "trapping" with a mediocre hand is just passivity. Lucy traps most,
       visitors never (trapChance 0). Because it is a probability and not
       a rule, a check from her is never a reliable read. */
    if (perceived > 0.80 && prof.trapChance && Math.random() < prof.trapChance){
      return {action:'check'};
    }
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
  /* callTolerance is how wide this character continues at all;
     pressureRespect is how much a LARGE bet specifically moves that
     threshold. They are separate because they are separate traits: Tony
     continues wide but is not especially brave against a pot-sized bet,
     while Nigel folds a lot generally AND folds far more to size. Both
     are neutral (0 / 1) for visitors. */
  const callThreshold = potOdds - 0.03
      + (tightness-0.5)*0.08
      + betPressure*0.10*prof.pressureRespect   // big bets demand a real hand to continue
      - prof.callTolerance
      - callLoosen;
  if (perceived < callThreshold && !bluffRoll){
    const cheap = toCall <= Math.max(bb, stack*0.02) && perceived > callThreshold-0.12;
    return cheap ? {action:'call'} : {action:'fold'};
  }
  const wantsRaise = player.mayRaise && stack > toCall
    && (perceived > 0.74 || (bluffRoll && betPressure < 0.5 && Math.random()<0.35))
    && Math.random() < Math.min(0.92, (0.25 + aggression*0.45) * prof.raiseDrive);
  if (wantsRaise){
    let frac = (0.45 + aggression*0.30) * sizeMul;
    let total = potSizedTotal(player, Math.min(frac, 0.8));
    return raiseOrSettle(cappedTotal(total, perceived));
  }
  // calling off a big chunk — judged against the whole hand's commitment —
  // still needs genuine strength
  const wouldCommit = (player.totalBetHand + toCall) / Math.max(1, player.chips + player.totalBetHand);
  if (shortStack && toCall >= stack*0.7 && perceived < formatAdj.callOffFloor) return {action:'fold'};
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
  let ms = big ? 1350 + Math.random()*1050 : 550 + Math.random()*500;
  if (allIn) ms += 500;
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
