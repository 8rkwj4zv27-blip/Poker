"use strict";

/* ============================================================
   THE RESIDENTS — the house's five recurring characters

   This file is the ONE canonical source of resident identity. Harry,
   Tony, Lucy, Nigel and Steve are the same people every time they
   appear: same name, same portrait colour, same resting face, same
   expression vocabulary, same biography, same voice, same poker
   tendencies. Nothing else in the codebase may declare a resident's
   name, colour, bio or expression map — if you need one, read it from
   here.

   Deliberately dependency-free and DOM-free. It loads BEFORE
   03-opponents.js and touches no game state, no save, no localStorage
   and no rendering, which is what lets the paused chatter prototype
   consume the same record (js/chatter/01-residents.js is now a thin
   adapter over this file) without any production coupling travelling
   the other way.

   Portrait contract: `faceColorIdx` is a FACE_COLORS index
   (02-support-systems.js) and every mood value is a FACE_ART key. A
   resident is a NAME plus a selection from art that already ships —
   nothing is authored here.

   SPLIT OF CONCERNS, which the whole pass depends on:

     public/*   name, colour, style, blurb, tendencies — everything the
                player is allowed to see. This is what dossierModel()
                surfaces.
     rest/moods the expression vocabulary. Presentation only.
     poker/*    PRIVATE tendency dials read only by aiDecide(). Never
                rendered, never described numerically to the player.
     temperament how far public-table events move this resident's
                gameplay mood, and how fast it fades.

   Personality is NOT difficulty. DIFFICULTY_PARAMS (03-opponents.js)
   still owns simulation quality, decision noise and positional
   ACCURACY; a resident owns preferences. The one place they meet is
   `positionSensitivity`, which multiplies the difficulty's position
   weight rather than replacing it, so a resident stays recognisable at
   every difficulty and every difficulty still improves the decision.
   ============================================================ */

/* ---- The private poker dials ----------------------------------------
   Every value is a PREFERENCE, never a rule. A resident must never be
   predictable from a single action, so each dial biases an existing
   probabilistic gate inside aiDecide() rather than short-circuiting it.

   entryBias           + = folds more preflop, - = enters wider.
                         Added to the preflop foldGate.
   raiseDrive          multiplies the two "do I actually raise" rolls.
                         1 = today's behaviour.
   callTolerance       + = continues wider facing a bet.
                         Subtracted from callThreshold.
   pressureRespect     multiplies how much a large bet raises
                         callThreshold. >1 = respects big bets more.
   drawPersistence     multiplies the equity credit a real, PUBLIC draw
                         earns (own two cards + the board only).
   trapChance          probability of checking a very strong hand in an
                         unopened pot instead of betting it.
   positionSensitivity multiplies DIFFICULTY_PARAMS.positionWeight.
   shortStackDrive     multiplies the freezeout short-stack fold-gate
                         widening and the critical-stack jam threshold.
   gearRange           per-hand "gear" amplitude, seeded from PUBLIC
                         state only. 0 for everyone but Steve.

   The neutral profile below is what a visitor (an ordinary archetype
   from PERSONALITIES_ALL) gets, and it reproduces the pre-pass
   behaviour exactly: every multiplier 1, every offset 0. That is the
   guarantee that this pass changed the residents and nobody else. */
const RESIDENT_NEUTRAL_POKER = Object.freeze({
  entryBias:0, raiseDrive:1, callTolerance:0, pressureRespect:1,
  drawPersistence:1, trapChance:0, positionSensitivity:1,
  shortStackDrive:1, gearRange:0
});
const RESIDENT_NEUTRAL_TEMPERAMENT = Object.freeze({ moodGain:1, moodDecay:0.75 });

/* Plain-language tendency copy. The player gets a useful impression, never
   the source code: no percentages, no equity thresholds, no weights. */
const RESIDENTS = [
  {
    id:'harry', name:'Harry', faceColorIdx:0,
    style:'Wind-up merchant',
    blurb:'Matey, cheeky, always mid-needle. Talks the most, means the least. ' +
          'Treats a quiet table as a personal insult.',
    tendencies:[
      'Enters plenty of pots',
      'Applies pressure when checked to',
      'Raises again rather than settle for a call',
      'Bluffs more often than the rest of them'
    ],
    voice:'harry', chattiness:0.95,
    rest:'neutral2',
    moods:{
      smug:'smug1', sly:'sly1', pleased:'gloating1', wound:'cocky1',
      rattled:'baffled1', cross:'displeased1', wild:'manic1'
    },
    /* Loose-aggressive pressure. High raiseDrive plus the widest entry is
       what makes him the one who keeps putting people to a decision; the
       low pressureRespect is why a big bet does not slow him down much.
       He is NOT a maniac: entryBias is only mildly negative and the fold
       branch is untouched, so he folds his genuine rubbish. */
    aggression:.82, tightness:.30, bluffFreq:.27, sizing:.95, thinkSpeed:.78,
    poker:{
      entryBias:-0.055, raiseDrive:1.42, callTolerance:0.015, pressureRespect:0.80,
      drawPersistence:1.05, trapChance:0.06, positionSensitivity:0.75,
      shortStackDrive:1.15, gearRange:0
    },
    temperament:{ moodGain:1.15, moodDecay:0.72 }
  },
  {
    id:'tony', name:'Tony', faceColorIdx:5,
    style:'Enthusiast',
    blurb:'Loves the occasion more than the cards. Loud, warm, delighted by ' +
          'everything, and constitutionally unable to pass on a hand that ' +
          'might turn into something.',
    tendencies:[
      'Sees more flops than anybody',
      'Calls readily with draws',
      'Rarely tries to buy a pot',
      'Can talk himself into a playable-looking hand'
    ],
    voice:'tony', chattiness:0.85,
    rest:'neutral4',
    moods:{
      smug:'happy2', sly:'happyConfused1', pleased:'ecstatic1', wound:'joyful1',
      rattled:'shocked1', cross:'worried1', wild:'happy1'
    },
    /* Loose, curious caller. The widest entry and the widest continuing
       range, but the LOWEST raiseDrive and bluffFreq — he arrives in pots
       by calling, not by raising, and he does not fire at anybody. The
       high drawPersistence is the "legitimate draws" half of the brief;
       the small positive callTolerance is the overvaluing half, bounded
       so it can never call off a stack on nothing. */
    aggression:.34, tightness:.24, bluffFreq:.045, sizing:.62, thinkSpeed:.88,
    poker:{
      entryBias:-0.062, raiseDrive:0.66, callTolerance:0.055, pressureRespect:0.92,
      drawPersistence:1.70, trapChance:0.04, positionSensitivity:0.70,
      shortStackDrive:0.95, gearRange:0
    },
    temperament:{ moodGain:0.95, moodDecay:0.78 }
  },
  {
    id:'lucy', name:'Lucy', faceColorIdx:3,
    style:'Dry operator',
    blurb:'Says one thing per orbit and it lands. Minimal face, maximum ' +
          'damage. Waits, and then charges you for the wait.',
    tendencies:[
      'Patient until the price is right',
      'Slows down with her best hands',
      'Bets accurately when she is ahead',
      'Picks her moments to attack'
    ],
    voice:'lucy', chattiness:0.45,
    rest:'neutral1',
    moods:{
      smug:'smug1', sly:'scheming1', pleased:'neutral3', wound:'neutral1',
      rattled:'suspicious1', cross:'displeased1', wild:'sly1'
    },
    /* Patient and selective. Tight entry and a NEGATIVE callTolerance, so
       she folds the marginal continues Tony makes — but raiseDrive stays
       above 1, because "selective" means her aggression is rarer AND
       stronger, not absent. trapChance is the highest in the cast: the
       check-back with a monster is her signature, and because the trap
       only fires above the value-bet threshold it costs her nothing. */
    aggression:.56, tightness:.44, bluffFreq:.115, sizing:.78, thinkSpeed:1.12,
    poker:{
      entryBias:-0.005, raiseDrive:1.12, callTolerance:-0.040, pressureRespect:1.05,
      drawPersistence:0.95, trapChance:0.42, positionSensitivity:1.35,
      shortStackDrive:1.0, gearRange:0
    },
    temperament:{ moodGain:0.60, moodDecay:0.68 }
  },
  {
    id:'nigel', name:'Nigel', faceColorIdx:1,
    style:'The sensible one',
    blurb:'Fussy, pompous, permanently one small irritation from a lecture. ' +
          'Has a considered opinion about your bet sizing and intends to ' +
          'share it.',
    tendencies:[
      'Prefers position and controlled pots',
      'Respects a big bet',
      'Avoids large pots without a real hand',
      'Commits properly when the spot is genuinely his'
    ],
    voice:'nigel', chattiness:0.7,
    rest:'neutral5',
    moods:{
      smug:'cocky2', sly:'scheming1', pleased:'happy2', wound:'displeased1',
      rattled:'confused1', cross:'angry1', wild:'nervous2'
    },
    /* Tight, positional, risk-conscious. The highest entryBias and the
       highest pressureRespect — a pot-sized bet moves his continuing
       threshold further than anyone's — plus the highest
       positionSensitivity, which is what makes him visibly a different
       player in and out of position. Controlled sizing, low bluffs. He
       is not passive: raiseDrive below 1 with a solid raiseGate means he
       raises less OFTEN but still commits hard when his range supports
       it, and shortStackDrive above 1 keeps him from blinding out. */
    aggression:.44, tightness:.50, bluffFreq:.055, sizing:.60, thinkSpeed:1.32,
    poker:{
      entryBias:0.012, raiseDrive:0.80, callTolerance:-0.062, pressureRespect:1.60,
      drawPersistence:0.85, trapChance:0.18, positionSensitivity:2.10,
      shortStackDrive:1.10, gearRange:0
    },
    temperament:{ moodGain:0.75, moodDecay:0.70 }
  },
  {
    id:'steve', name:'Steve', faceColorIdx:4,
    style:'Reads the vibes',
    blurb:'Suspicious of the deck, the chairs and the moon. Occasionally, ' +
          'infuriatingly, correct. Plays whatever he has decided the table ' +
          'is doing to him this hand.',
    tendencies:[
      'Changes gears without warning',
      'Finds bluffs nobody else looks for',
      'Sizes bets all over the place',
      'Reacts to how the table has been going'
    ],
    voice:'steve', chattiness:0.55,
    rest:'neutral3',
    moods:{
      smug:'suspicious2', sly:'scheming1', pleased:'happyConfused1', wound:'baffled1',
      rattled:'confused2', cross:'suspicious1', wild:'manic1'
    },
    /* Intuitive wildcard. His baseline sits near the middle of the cast
       on purpose — his identity is the SPREAD, not the average. gearRange
       is the only non-zero one: once per hand he picks a gear from public
       state alone (see residentGear in 03-opponents.js) and that gear
       swings aggression, sizing and bluff frequency together, so a hand
       where he is running hot is coherently aggressive rather than
       randomly so. The highest moodGain means public table events move
       him further than anyone. Still bounded: the gear scales existing
       gates, so every action he takes remains a legal, sane poker play. */
    aggression:.60, tightness:.42, bluffFreq:.215, sizing:.82, thinkSpeed:.92,
    poker:{
      entryBias:-0.022, raiseDrive:1.05, callTolerance:0.01, pressureRespect:0.95,
      drawPersistence:1.20, trapChance:0.24, positionSensitivity:1.0,
      shortStackDrive:1.05, gearRange:0.55
    },
    temperament:{ moodGain:1.35, moodDecay:0.80 }
  }
];

/* Namespaced so a resident key can never collide with one of the eight
   legacy archetype keys in PERSONALITIES_ALL. Saves written by this build
   carry these; saves written before it carry archetype keys, and both
   still resolve — see personalityByKey below. */
const RESIDENT_KEY_PREFIX = 'res:';
function residentKey(id){ return RESIDENT_KEY_PREFIX + id; }
function isResidentKey(key){
  return typeof key === 'string' && key.indexOf(RESIDENT_KEY_PREFIX) === 0;
}

/* The persona object aiDecide() and makePlayer() already consume — the
   same five dials every archetype has, plus the resident's id and private
   profile riding along. Built once and frozen, so a table can never
   mutate a resident's identity for the next table. */
const RESIDENT_PERSONAS = RESIDENTS.map(res=>Object.freeze({
  key:residentKey(res.id),
  name:res.name,
  aggression:res.aggression,
  tightness:res.tightness,
  bluffFreq:res.bluffFreq,
  sizing:res.sizing,
  thinkSpeed:res.thinkSpeed,
  residentId:res.id,
  faceColorIdx:res.faceColorIdx,
  poker:Object.freeze(Object.assign({}, RESIDENT_NEUTRAL_POKER, res.poker || {})),
  temperament:Object.freeze(Object.assign({}, RESIDENT_NEUTRAL_TEMPERAMENT, res.temperament || {}))
}));

const RESIDENTS_BY_ID = {};
RESIDENTS.forEach(res=>{ RESIDENTS_BY_ID[res.id] = res; });
const RESIDENT_PERSONA_BY_ID = {};
RESIDENT_PERSONAS.forEach(p=>{ RESIDENT_PERSONA_BY_ID[p.residentId] = p; });

function residentById(id){
  return (typeof id === 'string' && RESIDENTS_BY_ID[id]) || null;
}
function residentPersonaById(id){
  return (typeof id === 'string' && RESIDENT_PERSONA_BY_ID[id]) || null;
}
/* The resident behind a persona/player, or null for a visitor. One helper
   so no caller has to know that the link is `personality.residentId`. */
function residentOf(subject){
  if (!subject) return null;
  if (typeof subject === 'string') return residentById(subject);
  if (subject.residentId) return residentById(subject.residentId);          // a persona
  if (subject.personality && subject.personality.residentId){               // a live player
    return residentById(subject.personality.residentId);
  }
  // A resident record handed straight back in. The House Faces screen does
  // exactly this, so leaving it out made every menu dossier render as a
  // visitor. Identity-checked rather than looked up by id alone, so a
  // player whose seat id happened to read 'harry' could never match.
  if (subject.id && RESIDENTS_BY_ID[subject.id] === subject) return subject;
  return null;
}

/* Resolve a semantic expression role for a resident. Production face mood
   remains driven exclusively by public table events; this helper only chooses
   which piece of that resident's authored art represents the public mood. A
   visitor returns the supplied fallback and therefore keeps the existing
   shared FACE_MOOD_POOLS behaviour unchanged. */
function residentFace(subject, role, fallback){
  const res = residentOf(subject);
  const fallbackFace = ()=>typeof fallback === 'function' ? fallback() : (fallback || 'idle');
  if (!res) return fallbackFace();
  if (role === 'rest') return res.rest;
  return (res.moods && res.moods[role]) || res.rest || fallbackFace();
}

/* THE resolution point for a stored personality key. Residents first,
   then the legacy archetypes, so:
     - a save written by this build resolves to a resident;
     - a save written before it resolves to the archetype it always did,
       and that table keeps the opponents it was dealt until it ends.
   PERSONALITIES_ALL lives in 03-opponents.js, which loads after this
   file, so the lookup is deliberately late-bound rather than captured. */
function personalityByKey(key){
  if (typeof key !== 'string' || !key) return null;
  if (isResidentKey(key)) return RESIDENT_PERSONA_BY_ID[key.slice(RESIDENT_KEY_PREFIX.length)] || null;
  if (typeof PERSONALITIES_ALL === 'undefined' || !Array.isArray(PERSONALITIES_ALL)) return null;
  return PERSONALITIES_ALL.find(p=>p.key === key) || null;
}
/* Is this key one the current build can seat? Replaces the scattered
   `PERSONALITIES_ALL.some(p=>p.key===k)` save-validation predicates so
   both resident and legacy keys pass. */
function isKnownPersonalityKey(key){ return !!personalityByKey(key); }

/* The private dials for any persona, defaulting to neutral. A visitor
   archetype has no `poker` block, so it lands on RESIDENT_NEUTRAL_POKER
   and behaves exactly as it did before this pass. */
function personaPoker(persona){
  return (persona && persona.poker) || RESIDENT_NEUTRAL_POKER;
}
function personaTemperament(persona){
  return (persona && persona.temperament) || RESIDENT_NEUTRAL_TEMPERAMENT;
}

/* ============================================================
   THE SHARED DOSSIER MODEL

   ONE model behind both player-visible surfaces: the Opponents screen
   and the in-game portrait dossier. They must never drift apart, and a
   check asserts the two produce identical objects for the same subject.

   ANTI-TELL CONTRACT — the reason this function is small and boring:
   the returned object may contain NOTHING that is not already visible
   to the player. No hole cards, no equity, no bluff state, no pending
   decision, no `poker` dials, no moodState. `mood` is read from
   faceMood alone, which is itself driven only by public table events
   (see the PRESENTATION MOOD block in 03-opponents.js), and it is
   omitted entirely unless a live seat was passed in.

   DOSSIER_MODEL_KEYS is the exact, checked shape. Adding a field here
   is a deliberate act that has to survive the no-hidden-information
   check in validation/resident-personality-checks.js. */
const DOSSIER_MODEL_KEYS = Object.freeze([
  'residentId','name','faceColorIdx','style','blurb','tendencies','visitor','mood','rest'
]);

/* Public style labels for the eight legacy archetypes. A visitor is a
   real person at the table for one session, so they get a truthful
   public description — but no biography, no id and no continuity, which
   is exactly what stops them reading as a sixth cast member. */
const VISITOR_STYLES = {
  rock:      'Cautious regular',
  shark:     'Steady technician',
  maniac:    'All gas, no brakes',
  station:   'Hard to shake off',
  grinder:   'Small-ball grinder',
  wildcard:  'Unpredictable',
  professor: 'Thinks it through',
  hammer:    'Swings heavy'
};
const VISITOR_TENDENCIES = {
  rock:      ['Waits for a real hand','Hard to bluff'],
  shark:     ['Plays a solid, ordinary game','Bets when it is right'],
  maniac:    ['Enters almost everything','Raises constantly'],
  station:   ['Calls far more than folds','Rarely raises'],
  grinder:   ['Keeps pots small','Chips away'],
  wildcard:  ['Hard to predict','Mixes up sizing'],
  professor: ['Deliberate and patient','Bets with the odds'],
  hammer:    ['Large bets','Comfortable with big pots']
};
const VISITOR_BLURB = 'Passing through. Not one of the house regulars — ' +
  'here for this table only.';

/* Accepts a resident, a resident id, a persona, or a live player object. */
function dossierModel(subject){
  const res = residentOf(subject);
  const player = (subject && typeof subject === 'object' && 'isHuman' in subject) ? subject : null;
  const persona = player ? player.personality
    : (subject && typeof subject === 'object' && subject.key) ? subject : null;

  if (res){
    return {
      residentId: res.id,
      name: res.name,
      // A live seat's colour is authoritative only because it IS the
      // resident's permanent colour; falling back to the registry keeps
      // the menu and a mid-hand seat identical.
      faceColorIdx: Number.isInteger(player && player.faceColorIdx) ? player.faceColorIdx : res.faceColorIdx,
      style: res.style,
      blurb: res.blurb,
      tendencies: res.tendencies.slice(),
      visitor: false,
      // A resident's neutral is part of who they are — Harry does not rest
      // on the same face Lucy does — so a dossier portrait wears their own
      // resting expression rather than the generic idle art.
      rest: res.rest,
      mood: player ? dossierMood(player) : null
    };
  }

  const key = persona && typeof persona.key === 'string' ? persona.key : null;
  return {
    residentId: null,
    name: (player && player.name) || (persona && persona.name) || 'Visitor',
    faceColorIdx: Number.isInteger(player && player.faceColorIdx) ? player.faceColorIdx : null,
    style: (key && VISITOR_STYLES[key]) || 'Visitor',
    blurb: VISITOR_BLURB,
    tendencies: ((key && VISITOR_TENDENCIES[key]) || ['Here for one session']).slice(),
    visitor: true,
    // A visitor has no authored resting face, so they get the shared idle.
    rest: 'idle',
    mood: player ? dossierMood(player) : null
  };
}

/* The one public-mood word a dossier may print. Read from faceMood and
   nothing else — the SAME state that already decides which portrait the
   player can see on the felt, so this reveals strictly nothing new. The
   families are FACE_MOOD_POOLS'; an unknown one lands on 'Settled'. */
const DOSSIER_MOOD_WORDS = {
  neutral:'Settled', positive:'Enjoying it', confident:'Confident',
  irritated:'Irritated', nervous:'Uneasy', uncertain:'Unsure', shock:'Rattled'
};
function dossierMood(player){
  const m = player && player.faceMood;
  const family = m && typeof m.family === 'string' ? m.family : 'neutral';
  return DOSSIER_MOOD_WORDS[family] || DOSSIER_MOOD_WORDS.neutral;
}

/* Node's check harnesses load this file in a bare vm context; the browser
   loads it as a plain script. Neither needs an export, but exposing the
   registry on the global makes the chatter adapter's dependency explicit
   rather than relying on script-scope leakage. */
if (typeof globalThis !== 'undefined'){
  globalThis.TheResidents = {
    all: RESIDENTS,
    byId: residentById,
    personas: RESIDENT_PERSONAS,
    personaById: residentPersonaById,
    face: residentFace,
    dossierModel: dossierModel,
    MODEL_KEYS: DOSSIER_MODEL_KEYS
  };
}
