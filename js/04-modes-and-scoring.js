"use strict";

/* ============================================================
   BLIND STRUCTURE
   ============================================================ */
const BLIND_LEVELS = [
  [10,20],[15,30],[25,50],[50,100],[75,150],
  [100,200],[150,300],[250,500],[400,800],[600,1200]
];
const TOURNAMENT_HANDS_PER_LEVEL = 10;

/* Configuration-only Hold'em variants. They all use the same deck, betting,
   showdown and freezeout lifecycle; only field size, stack and blind cadence
   differ. */
const TOURNAMENT_FORMATS = Object.freeze({
  turbo:Object.freeze({id:'turbo',name:'Turbo Freezeout',opponentCount:3,playerCount:4,
    stack:600,initialBlindLevel:0,handsPerBlindLevel:6}),
  deep:Object.freeze({id:'deep',name:'Deep Stack Freezeout',opponentCount:3,playerCount:4,
    stack:1500,initialBlindLevel:0,handsPerBlindLevel:12}),
  headsup:Object.freeze({id:'headsup',name:'Heads-Up Freezeout',opponentCount:1,playerCount:2,
    stack:600,initialBlindLevel:0,handsPerBlindLevel:8})
});
function tournamentFormatById(id){ return typeof id === 'string' ? (TOURNAMENT_FORMATS[id] || null) : null; }

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

   PAYOUTS. `payouts` is the canonical reward table: index 0 is first place,
   index 1 second, and so on. `prize` is kept alongside it as a permanent
   mirror of payouts[0] — every save, table snapshot and migration path
   already reads it, and isValidCareerEventSnapshot() enforces the two
   staying equal. A Top-3 event later is simply payouts:[a,b,c]; nothing
   else in the schema has to move.
   ============================================================ */
const CAREER_START_BANKROLL = 500;
const CAREER_EVENT_LIST = Object.freeze([
  Object.freeze({
    id:'back-room-freezeout',
    venue:'BACK ROOM',
    name:'BACK ROOM 3-HAND',
    title:'3-HAND',
    format:'Freezeout',
    playerCount:3,
    opponentCount:2,
    buyIn:100,
    prize:300,
    payouts:Object.freeze([300]),
    stack:500,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'medium',
    unlockRequirement:null
  }),
  Object.freeze({
    id:'back-room-heads-up',
    venue:'BACK ROOM',
    name:'BACK ROOM HEADS-UP',
    title:'HEADS-UP',
    format:'Heads-Up Freezeout',
    playerCount:2,
    opponentCount:1,
    buyIn:100,
    prize:200,
    payouts:Object.freeze([200]),
    stack:600,
    initialBlindLevel:0,
    handsPerBlindLevel:8,
    difficulty:'medium',
    unlockRequirement:null
  }),
  Object.freeze({
    id:'pub-freezeout',
    venue:'PUB CIRCUIT',
    name:'PUB CIRCUIT 4-HAND',
    title:'4-HAND',
    format:'Freezeout',
    playerCount:4,
    opponentCount:3,
    buyIn:300,
    prize:1200,
    payouts:Object.freeze([1200]),
    stack:750,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'hard',
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'BACK ROOM' })
  }),
  /* The first multi-place event. Same venue and buy-in as the 4-HAND
     above, deliberately: the choice between them is a choice of RISK SHAPE
     (bigger top prize vs. a paid second place), not of stake. Only first
     place is a progression win — second place is money and nothing else. */
  Object.freeze({
    id:'pub-open',
    venue:'PUB CIRCUIT',
    name:'PUB CIRCUIT 5-HAND',
    title:'5-HAND',
    format:'Freezeout',
    playerCount:5,
    opponentCount:4,
    buyIn:300,
    prize:1050,
    payouts:Object.freeze([1050,450]),
    stack:750,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'hard',
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'BACK ROOM' })
  }),
  Object.freeze({
    id:'pub-turbo',
    venue:'PUB CIRCUIT',
    name:'PUB CIRCUIT TURBO',
    title:'TURBO',
    format:'Turbo Freezeout',
    playerCount:4,
    opponentCount:3,
    buyIn:300,
    prize:1200,
    payouts:Object.freeze([1200]),
    stack:600,
    initialBlindLevel:0,
    handsPerBlindLevel:6,
    difficulty:'hard',
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'BACK ROOM' })
  }),
  Object.freeze({
    id:'card-club-deep',
    venue:'CARD CLUB',
    name:'CARD CLUB DEEP STACK',
    title:'DEEP STACK',
    format:'Deep Stack Freezeout',
    playerCount:4,
    opponentCount:3,
    buyIn:1000,
    prize:4000,
    payouts:Object.freeze([4000]),
    stack:1500,
    initialBlindLevel:0,
    handsPerBlindLevel:12,
    difficulty:'hard',
    rosterKeys:Object.freeze(['shark','professor','grinder']),
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'PUB CIRCUIT' })
  }),
  Object.freeze({
    id:'card-club-six',
    venue:'CARD CLUB',
    name:'CARD CLUB CLUB SIX',
    title:'CLUB SIX',
    format:'Six-Hand Top-2 Freezeout',
    playerCount:6,
    opponentCount:5,
    buyIn:1000,
    prize:3600,
    payouts:Object.freeze([3600,2400]),
    stack:1000,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'hard',
    rosterKeys:Object.freeze(['shark','professor','grinder','hammer','wildcard']),
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'PUB CIRCUIT' })
  }),
  Object.freeze({
    id:'casino-main',
    venue:'CASINO FLOOR',
    name:'CASINO FLOOR MAIN EVENT',
    title:'MAIN EVENT',
    format:'Six-Hand Top-3 Freezeout',
    playerCount:6,
    opponentCount:5,
    buyIn:3000,
    prize:9000,
    payouts:Object.freeze([9000,6000,3000]),
    stack:1200,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'expert',
    rosterKeys:Object.freeze(['shark','professor','grinder','hammer','wildcard']),
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'CARD CLUB' })
  }),
  Object.freeze({
    id:'casino-turbo',
    venue:'CASINO FLOOR',
    name:'CASINO FLOOR MIDNIGHT TURBO',
    title:'MIDNIGHT TURBO',
    format:'Turbo Freezeout',
    playerCount:4,
    opponentCount:3,
    buyIn:3000,
    prize:12000,
    payouts:Object.freeze([12000]),
    stack:600,
    initialBlindLevel:0,
    handsPerBlindLevel:6,
    difficulty:'expert',
    rosterKeys:Object.freeze(['maniac','hammer','wildcard']),
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'CARD CLUB' })
  }),
  Object.freeze({
    id:'high-roller-feature',
    venue:'HIGH ROLLER ROOM',
    name:'HIGH ROLLER FEATURE TABLE',
    title:'FEATURE TABLE',
    format:'Deep Stack Freezeout',
    playerCount:4,
    opponentCount:3,
    buyIn:10000,
    prize:40000,
    payouts:Object.freeze([40000]),
    stack:2000,
    initialBlindLevel:0,
    handsPerBlindLevel:12,
    difficulty:'elite',
    rosterKeys:Object.freeze(['shark','professor','grinder']),
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'CASINO FLOOR' })
  }),
  Object.freeze({
    id:'high-roller-pressure',
    venue:'HIGH ROLLER ROOM',
    name:'HIGH ROLLER PRESSURE FIVE',
    title:'PRESSURE FIVE',
    format:'Five-Hand Top-2 Freezeout',
    playerCount:5,
    opponentCount:4,
    buyIn:10000,
    prize:35000,
    payouts:Object.freeze([35000,15000]),
    stack:1000,
    initialBlindLevel:0,
    handsPerBlindLevel:8,
    difficulty:'elite',
    rosterKeys:Object.freeze(['shark','professor','hammer','rock']),
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'CASINO FLOOR' })
  }),
  Object.freeze({
    id:'invitational-final',
    venue:'INVITATIONAL CHAMPIONSHIP',
    name:'INVITATIONAL CHAMPIONSHIP THE FINAL',
    title:'THE FINAL',
    format:'Six-Hand Top-3 Championship',
    playerCount:6,
    opponentCount:5,
    buyIn:30000,
    prize:100000,
    payouts:Object.freeze([100000,50000,30000]),
    stack:2400,
    initialBlindLevel:0,
    handsPerBlindLevel:12,
    difficulty:'elite',
    rosterKeys:Object.freeze(['shark','professor','grinder','hammer','wildcard']),
    unlockRequirement:Object.freeze({ type:'venue-win', venue:'HIGH ROLLER ROOM' })
  }),
  /* The free recovery event. Its visibility/enterability is NOT the
     unlockRequirement mechanism above — it is governed entirely by the
     live-bankroll predicate below (isSecondChanceEligible), which is the
     single source of truth every caller (this screen today, the Board's
     Special Opportunity slot later) must consult instead of restating the
     $100 rule. unlockRequirement stays null forever: Second Chance never
     participates in venue-unlock progression, in either direction. */
  Object.freeze({
    id:'second-chance',
    venue:'BACK ROOM',
    name:'SECOND CHANCE',
    title:'SECOND CHANCE',
    format:'Freezeout',
    playerCount:3,
    opponentCount:2,
    buyIn:0,
    prize:150,
    payouts:Object.freeze([150]),
    stack:500,
    initialBlindLevel:0,
    handsPerBlindLevel:10,
    difficulty:'medium',
    unlockRequirement:null
  })
]);
const CAREER_EVENTS = Object.freeze(CAREER_EVENT_LIST.reduce((registry,event)=>{
  registry[event.id] = event;
  return registry;
}, {}));

function careerEventById(id){
  return typeof id === 'string' ? (CAREER_EVENTS[id] || null) : null;
}

/* NAMES. A descriptor carries two, for two different contexts:

     `name`  — the full, venue-qualified record name. It is what a save
               snapshot, a settled result and any copy WITHOUT a venue
               heading above it must use, because on its own "4-HAND"
               does not say where it was played.
     `title` — the short label the event directory prints on the cassette,
               where the venue marker is already directly above it.

   The ids are untouched: 'back-room-freezeout', 'pub-freezeout' and
   'pub-open' remain the save identifiers they have always been. This is a
   presentation cleanup, not a schema change. `format` likewise still reads
   'Freezeout' for all four, because all four ARE freezeouts — that is
   exactly why the old "Freezeout vs Open" titles had to go. */
function careerEventTitle(event){
  if (!event) return '';
  return typeof event.title === 'string' && event.title ? event.title : String(event.name || '');
}

/* ============================================================
   EVENT ROSTER — the authoritative field for one event instance.

   The rule this exists to enforce: THE ADVERTISED TABLE AND THE PLAYED
   TABLE ARE THE SAME TABLE. Before this, the directory preview invented
   its own portraits from a seat-index formula while newGame() separately
   drew random personalities and random face colours at launch, so the
   faces a player inspected were never the faces they sat down with.

   A roster is drawn ONCE per event instance and then owned by Career
   state: it drives the preview, the launch, the active save and the
   resume. It is deliberately minimal — a personality key and a face
   colour index per seat. No name, no dialogue, no familiarity, no
   history: named residents are Phase 7 and nothing here anticipates them.

   Both generators below are the PRODUCTION paths (pickPersonalities and
   assignFaceColors), not copies of them, so a Career field is drawn from
   exactly the same distribution a Single Player table is.
   ============================================================ */
function careerRosterSeats(event){
  return event && Number.isInteger(event.opponentCount) && event.opponentCount > 0
    ? event.opponentCount : 0;
}

/* Returns null rather than a partial field if the opponent systems are not
   present (the isolated check harnesses load Career without them). Callers
   treat null as "no authoritative field", never as an empty table. */
function generateCareerRoster(event){
  const seats = careerRosterSeats(event);
  if (!seats) return null;
  if (typeof pickPersonalities !== 'function' || typeof assignFaceColors !== 'function') return null;
  const curated = event && Array.isArray(event.rosterKeys) && event.rosterKeys.length === seats
    ? event.rosterKeys.map(key=>PERSONALITIES_ALL.find(p=>p.key===key)) : null;
  const personas = curated && curated.every(Boolean) && new Set(curated.map(p=>p.key)).size===seats
    ? curated : pickPersonalities(seats);
  if (!Array.isArray(personas) || personas.length < seats) return null;
  // A throwaway seat list run through the real colour assigner, so the
  // distinctness rule and the shuffle are the table's own, not a second
  // implementation of them.
  const seatList = [{ isHuman:true, faceColorIdx:null }];
  for (let i = 0; i < seats; i++) seatList.push({ isHuman:false, faceColorIdx:null });
  assignFaceColors(seatList);
  const roster = [];
  for (let i = 0; i < seats; i++){
    const persona = personas[i];
    const idx = seatList[i+1].faceColorIdx;
    if (!persona || typeof persona.key !== 'string' || !Number.isInteger(idx)) return null;
    roster.push({ personalityKey:persona.key, faceColorIdx:idx });
  }
  return roster;
}

/* The canonical catalogue name for a seat's personality — 'Shark', 'Prof',
   'Maniac' and so on. Read straight from PERSONALITIES_ALL, which is the
   same list newGame() seats the table from, so a name on a Career ticket
   and the personality that turns up are the same character. No new name is
   invented here and no second roster exists.

   NOTE on the "random names" setting: with Opponent Names set to Random the
   TABLE labels each seat with a random first name generated at launch, which
   by definition cannot be advertised in advance. The ticket therefore always
   shows the canonical personality, which remains truthful about who is
   seated even when the table is showing them under an alias. */
function careerSeatName(seat){
  if (!seat || typeof seat.personalityKey !== 'string') return '';
  if (typeof PERSONALITIES_ALL === 'undefined' || !Array.isArray(PERSONALITIES_ALL)) return '';
  const persona = PERSONALITIES_ALL.find(p=>p.key === seat.personalityKey);
  return persona && persona.name ? persona.name : '';
}

/* A stored roster is trusted only if it still describes THIS event exactly:
   the right number of seats, every personality key still in the roster of
   archetypes, every face colour a real index, and no seat duplicating
   another's persona or colour. Anything else returns null and is redrawn —
   a malformed field must never reach a table half-built. */
function normalizeCareerRoster(roster, event){
  const seats = careerRosterSeats(event);
  if (!seats || !Array.isArray(roster) || roster.length !== seats) return null;
  const colours = typeof FACE_COLORS !== 'undefined' && Array.isArray(FACE_COLORS)
    ? FACE_COLORS.length : 0;
  const known = typeof PERSONALITIES_ALL !== 'undefined' && Array.isArray(PERSONALITIES_ALL)
    ? PERSONALITIES_ALL : null;
  const keys = new Set();
  const used = new Set();
  const normalized = [];
  for (let i = 0; i < seats; i++){
    const seat = roster[i];
    if (!seat || typeof seat !== 'object') return null;
    const key = seat.personalityKey;
    if (typeof key !== 'string' || !key || keys.has(key)) return null;
    if (known && !known.some(p=>p.key === key)) return null;
    const idx = seat.faceColorIdx;
    if (!Number.isInteger(idx) || idx < 0 || used.has(idx)) return null;
    if (colours && idx >= colours) return null;
    keys.add(key);
    used.add(idx);
    normalized.push({ personalityKey:key, faceColorIdx:idx });
  }
  return normalized;
}

/* Second Chance's recovery threshold is a FIXED approved value — never
   derived from the cash table or from any tournament buy-in (see
   CAREER_DESIGN.md, "The ordering invariant"). This is the one pure,
   shared predicate for eligibility; every caller reads it rather than
   re-encoding "< 100" for itself. */
const SECOND_CHANCE_EVENT_ID = 'second-chance';
const INVITATIONAL_EVENT_ID = 'invitational-final';
const SECOND_CHANCE_BANKROLL_THRESHOLD = 100;
function isSecondChanceEligible(bankroll){
  return Number.isFinite(bankroll) && bankroll < SECOND_CHANCE_BANKROLL_THRESHOLD;
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
    payouts:careerPayouts(event).slice(),
    stack:event.stack,
    initialBlindLevel:event.initialBlindLevel,
    handsPerBlindLevel:event.handsPerBlindLevel,
    difficulty:event.difficulty,
    unlockRequirement:event.unlockRequirement
      ? { type:event.unlockRequirement.type, eventId:event.unlockRequirement.eventId,
          venue:event.unlockRequirement.venue }
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
  // The payouts/prize invariant. A snapshot written before multi-place
  // payouts existed has no `payouts` at all and is deliberately rejected
  // here, which is exactly what routes it through the migration path.
  const payouts = normalizeCareerPayouts(event.payouts);
  if (!payouts) return false;
  if (event.prize !== payouts[0]) return false;
  if (event.buyIn > 0 && payouts.reduce((sum,amount)=>sum+amount,0) !== event.buyIn * event.playerCount) return false;
  return true;
}

/* A valid payout table: a non-empty array of finite, non-negative numbers
   whose first place actually pays something. Returns a fresh copy so a
   frozen descriptor array can never be aliased into a mutable snapshot;
   returns null for anything malformed. */
function normalizeCareerPayouts(value){
  if (!Array.isArray(value) || !value.length) return null;
  if (value.some(amount=>!Number.isFinite(amount) || amount < 0)) return null;
  if (!(value[0] > 0)) return null;
  return value.slice();
}

/* The reward table for a descriptor OR a snapshot. The [prize] fallback is
   defence in depth for any snapshot that somehow reached settlement without
   going through normalisation — a pre-payouts event was winner-take-all, so
   [prize] is its faithful reading. */
function careerPayouts(event){
  if (!event) return [];
  const payouts = normalizeCareerPayouts(event.payouts);
  if (payouts) return payouts;
  return Number.isFinite(event.prize) && event.prize > 0 ? [event.prize] : [];
}

/* Money for a finishing place, 1-based. Every unpaid place — beyond the
   table, zero, negative, fractional, or simply not a number — is 0. This is
   the single arithmetic that turns a placement into a credit. */
function careerPrizeForPlace(event, place){
  if (!Number.isInteger(place) || place < 1) return 0;
  const amount = careerPayouts(event)[place-1];
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/* Already-paid financial terms always beat the live catalogue. A save
   written before multi-place payouts recorded only `prize`, which MEANS
   winner-take-all — reconstruct exactly that, never the descriptor's
   current (possibly retuned, possibly multi-place) table. Shared by the
   career save (normalizeActiveCareerEvent) and the career table save
   (normalizeCareerSavedEvent) so both honour one rule. */
function applyPaidCareerTerms(snapshot, saved){
  if (!snapshot || !saved || typeof saved !== 'object') return snapshot;
  if (Number.isFinite(saved.buyIn) && saved.buyIn >= 0) snapshot.buyIn = saved.buyIn;
  const payouts = normalizeCareerPayouts(saved.payouts);
  if (payouts){
    snapshot.payouts = payouts;
    snapshot.prize = payouts[0];
  } else if (Number.isFinite(saved.prize) && saved.prize > 0){
    snapshot.payouts = [saved.prize];
    snapshot.prize = saved.prize;
  }
  return snapshot;
}

/* Back Room cash is deliberately a descriptor consumed by the same table
   builder as every other Hold'em game. It changes stakes and lifecycle, not
   cards or betting rules. Resident reserves are table-session funding only;
   they never enter the player's Career ledger. */
const CAREER_CASH_CONFIG = Object.freeze({
  id:'back-room-cash',
  venue:'BACK ROOM',
  name:'BACK ROOM CASH',
  title:'CASH TABLE',
  format:'Cash',
  playerCount:4,
  opponentCount:3,
  buyIn:50,
  stack:50,
  smallBlind:1,
  bigBlind:2,
  residentReserve:100,
  difficulty:'medium'
});

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
/* The ONE quantity every win-size award is measured against
   (SCORING_SPEC.md 2.1). It replaces the old arcadeContestedPot(), which
   summed the WHOLE TABLE's matched money and so fired MASSIVE POT on a
   hand the player finished $700 down (defect D7's mirror, fixture F9).

   Net profit is a difference of two stack readings, so it cannot count
   the player's own returned money (F22: 1,980 of a 2,030 collection came
   straight back), and it does not care whether the hand ended in a
   showdown or a fold-win — which is what makes a genuine fold-win
   scorable at all (D7, fixture F7). Identical to the quantity
   arcadePotWinningsScore() already converts, deliberately: the two must
   never disagree about how big a win was.

   Safe to call any time before the next hand resets chips/_humanStart. */
function arcadeNetProfit(g){
  const human=g.players.find(p=>p.isHuman);
  if (!human) return 0;
  const start=g._humanStart==null?human.chips:g._humanStart;
  return human.chips-start;
}
/* Frozen 2026-08-26 (SCORING_SPEC.md 9, decision 2) after re-derivation
   against the fixture matrix on net profit. Silent at +6bb (F19) and
   +1.5bb (F22); BIG WIN at 20-25bb (F7/F10/F13/F14/F20); MASSIVE WIN
   reserved for +40bb (F1). */
const ARCADE_BIG_WIN_BB = 12;
const ARCADE_MASSIVE_WIN_BB = 30;

/* THE AUTHORITATIVE AWARD TABLE (SCORING_SPEC.md 2). Anything not listed
   here does not score, and nothing here is subjective.

   Phase 4B removed the ENTIRE decision-award catalogue — GOOD/GREAT/HUGE
   FOLD, GOOD/GREAT CALL, HERO CALL, GOOD/GREAT/MONSTER BLUFF, GOOD
   PRESSURE, GOOD/MAX VALUE, TRAP WORKED, PUNISH, GOOD/GREAT SHOVE — from
   scoring AND from presentation. Every one of them graded the player's
   decision against estimateEquity(), which deals opponents UNIFORMLY
   RANDOM hole cards with no action conditioning (js/01-poker-math.js). A
   player facing a pot-sized river shove is not facing a random hand, and
   the evaluator has no representation of that fact. Widening a threshold
   only reduces sampling noise; it does not correct the modelling error.

   These are NOT disabled, flagged or scaffolded, on purpose: a
   permanently-disabled feature is code and tests to maintain for no
   shipping behaviour. Decision analysis belongs to a separate, separately
   approved workstream (action-conditioned range model), which this file
   does not schedule.

   `family`: ids sharing a family are mutually exclusive — normalizeArcadeAwards
   keeps only the highest-base one actually earned. `tier` is presentation
   weight only (see arcadeTierTiming / the CSS tier-* classes); the id's own
   `base` is always the real point value. */
const ARCADE_AWARDS = {
  bigWin:       { name:'BIG WIN',       base:150,  tier:'strong',   type:'event', family:'winSize', description:'A genuinely large net profit on one hand, relative to current blinds.' },
  monsterHand:  { name:'MONSTER HAND',  base:200,  tier:'strong',   type:'event', family:null,      description:'A genuinely exceptional made hand — full house or better — shown down.' },
  doubleUp:     { name:'DOUBLE UP',     base:300,  tier:'elite',    type:'event', family:null,      description:'Roughly doubles the stack held at the start of the hand.' },
  ko:           { name:'K.O.!',         base:400,  tier:'elite',    type:'event', family:null,      description:'Directly eliminates an opponent through the decisive pot.' },
  massiveWin:   { name:'MASSIVE WIN',   base:500,  tier:'jackpot',  type:'event', family:'winSize', description:'A truly exceptional net profit on one hand, relative to current stakes.' },
  tableClear:   { name:'TABLE CLEARED', base:1000, tier:'jackpot',  type:'event', family:null,      description:'Eliminates the final opponent and clears the table.' },
  // Career's own name for the same condition. TABLE CLEARED is Single
  // Player only and EVENT WON is Career only (SCORING_SPEC.md 2, D6) —
  // a Career event never prints "TABLE CLEARED".
  eventWon:     { name:'EVENT WON',     base:1000, tier:'jackpot',  type:'event', family:null,      description:'Takes first place in a Career event.' }
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
/* The negative catalogue (LOOSE CALL, BAD CALL, PAID THEM OFF, BAD FOLD,
   TOO TIGHT, BAD BLUFF, RECKLESS, BAD SHOVE, OVERPLAYED, MISSED VALUE,
   TOO PASSIVE) was deleted at Phase 4B along with the positive one. It
   graded decisions against the same invalid opponent model, and its
   suppression rule read hidden cards to decide whether a message appeared
   at all (defect D11) — which the hidden-information rule forbids
   outright, because the ABSENCE of a message is itself information. */
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

/* Capture only information available at decision time.

   Phase 4B removed the decision-time equity request. Nothing that ships
   reads snap.equity any more (SCORING_SPEC.md 3.1) — the only surviving
   consumer of these snapshots is classifyArcadeLuck(), which reads their
   SIZING and COMMITMENT fields to pick which commitment the hand turned
   on and then resolves that spot against cards the player actually saw.
   Dropping the request also takes the invalid uniformly-random model's
   per-decision worker traffic out of the live game. The in-hand #coach
   instrument makes its own independent EquityService call and is
   unaffected. */
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
  a.decisionSnapshots.push(snap);
}
/* Kept as the one place snapshots are made ready for the evaluators. It
   no longer awaits anything in the live game, because captureArcadeDecision()
   no longer attaches an equity promise; the await survives only so a
   snapshot carrying one — a fixture, or a saved event from before this
   change — still settles rather than being read half-resolved. */
async function settleArcadeSnapshots(g){
  const a=rewardState(g);
  const snaps=(a&&a.decisionSnapshots)||[];
  await Promise.all(snaps.map(async s=>{
    if (s.equity==null&&s.equityPromise) s.equity=await s.equityPromise;
    delete s.equityPromise;
  }));
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
/* THE HIDDEN-INFORMATION GATE (SCORING_SPEC.md 3.2, defect D10).

   resolvedEquityAtSnapshot() below reads every listed opponent's actual
   hole cards. At a showdown those cards were turned face up and the
   player saw them, so the resulting tag states something public. On a
   fold-win — or against an opponent who folded before a showdown that
   others reached — they were NEVER SHOWN, and a tag derived from them
   tells the player something they could not know.

   The measured symptom was two hands identical in everything visible
   (same board, same hole cards, same actions, same settlement) emitting
   LUCKY in one and FILTHY in the other, purely because the folded
   opponents held different cards (fixture F23).

   The gate is deliberately strict: EVERY opponent the calculation would
   use must be a revealed showdown contender. A partial reveal is not
   enough, because the absence of a tag is itself information. */
function luckOpponentsWereRevealed(g,outcome,snapshot){
  if (!outcome||outcome.type!=='showdown'||!Array.isArray(outcome.contenders)) return false;
  const revealed=new Set(outcome.contenders.filter(p=>!p.folded).map(p=>p.id));
  return (snapshot.opponentIds||[]).every(id=>revealed.has(id));
}
function classifyArcadeLuck(g,outcome,snapshots){
  const won=humanWonOutcome(outcome);
  const meaningful=snapshots.filter(s=>s.action!=='fold'&&s.action!=='check'&&(
    s.allIn||s.commit>=Math.max(6*s.bigBlind,s.startStack*.22)||s.totalCommittedBefore+s.commit>=s.startStack*.45
  )).sort((a,b)=>(b.commit/b.startStack)-(a.commit/a.startStack))[0];
  if (!meaningful) return null;
  if (!luckOpponentsWereRevealed(g,outcome,meaningful)) return null;
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
/* ============================================================
   OBJECTIVE POST-HAND COMMENTARY (SCORING_SPEC.md 3)

   At most ONE line per hand, chosen by a fixed priority ladder, stating a
   PUBLIC FACT about how the hand settled. Nothing here grades a decision,
   claims a correct play, quotes a percentage or an EV figure, or names a
   counterfactual result. Every line must stay true even when the player's
   read was better than the machine's.

   Two rules govern eligibility absolutely:

   1. HIDDEN INFORMATION. Cards the player was not shown may not affect a
      line's wording, its eligibility, which candidate wins priority, or
      WHETHER A LINE APPEARS AT ALL. The absence of a message is itself
      information.
   2. NO DECISION QUALITY. The evaluator's opponent model deals uniformly
      random hole cards, so it cannot support any verdict about whether an
      action was right. Those belong to a separate range-model workstream.

   Text lives in ONE lookup, commentaryLine(), and detection never
   consults it — so a future Coach character can supply different wording
   for the same id without touching detection, priority or cadence.
   ============================================================ */
const ARCADE_COMMENTARY = {
  /* HARD settlement facts. Rare by construction and always worth stating,
     so they are exempt from the cadence limiter below. */
  sidePotWonNetLoss:   { name:'SIDE POT WON · NET LOSS',      kind:'settlement' },
  potChopped:          { name:'POT CHOPPED · STAKE RETURNED', kind:'settlement' },
  uncalledBetReturned: { name:'UNCALLED BET RETURNED',        kind:'settlement' },
  /* SOFT lines. True, but common enough to become wallpaper if they fired
     every time they were eligible. */
  shownDownLight:      { name:'SHOWN DOWN LIGHT',             kind:'soft' },
  pressureSucceeded:   { name:'NO SHOWDOWN · POT TAKEN',      kind:'soft' }
};
/* The one text source. `context` carries only public quantities; nothing
   in it is derived from a card the player did not see. */
function commentaryLine(id,context){
  const c=context||{};
  switch (id){
    case 'sidePotWonNetLoss':   return 'Side pot won. Down on the hand.';
    case 'potChopped':          return 'Pot chopped. Stake returned.';
    case 'uncalledBetReturned': return 'Uncalled bet returned.';
    case 'shownDownLight':      return 'Shown down light.';
    case 'pressureSucceeded':   return 'No showdown. Pot taken.';
    default: {
      const luck=ARCADE_LUCK[id];
      return luck ? luck.name : null;
    }
  }
}
/* How the hand actually settled, in public quantities only. A fold-win
   collapses every layer into one row, so its layering is read from
   computePots() directly — the winner takes every layer by definition.
   A showdown reads the rows, which now carry their own contributor count. */
function arcadeSettlementFacts(g,outcome,netProfit){
  const won=humanWonOutcome(outcome);
  const facts={ won, netProfit, wonContestedLayer:false, uncalledWon:0, chopped:false };
  if (!won) return facts;
  if (outcome.type==='foldwin'){
    computePots(g.players).forEach(layer=>{
      if (layer.contributors>=2) facts.wonContestedLayer=true;
      else facts.uncalledWon+=layer.amount;
    });
    return facts;
  }
  (outcome.potResults||[]).forEach(row=>{
    if (!row.winnerIds||!row.winnerIds.includes('you')) return;
    const share=(row.winnerShares||[]).filter(w=>w.id==='you').reduce((n,w)=>n+w.amount,0);
    if (row.contributors!=null&&row.contributors<2) facts.uncalledWon+=share;
    else facts.wonContestedLayer=true;
    if (row.split) facts.chopped=true;
  });
  return facts;
}
/* The human's own holding, shown down. Reading their own cards is always
   legitimate; this additionally requires that they REACHED a showdown, so
   the opponents saw the same thing the line describes. */
function humanShowedDownLight(g,outcome,snapshots){
  if (!outcome||outcome.type!=='showdown') return false;
  if (!Array.isArray(outcome.contenders)||!outcome.contenders.some(p=>p.isHuman)) return false;
  const human=g.players.find(p=>p.isHuman);
  const made=actualHandAtResolution(human,g);
  if (!made||made.cat>0) return false;                 // better than high card is not "light"
  return snapshots.some(s=>s.action==='raise'&&s.commit>=Math.max(4*s.bigBlind,s.pot*.5));
}
/* Public aggression on a hand that ended without a showdown. This claims
   nothing about what was folded — only that the pot came without cards
   being shown, which is exactly what the player watched happen. */
function humanTookItWithoutShowdown(g,outcome,snapshots){
  if (!outcome||outcome.type!=='foldwin'||!humanWonOutcome(outcome)) return false;
  if ((outcome.amount||0)<2*g.bigBlind) return false;
  const last=snapshots.filter(s=>s.action==='raise').slice(-1)[0];
  return !!last&&last.commit>=Math.max(3*g.bigBlind,last.pot*.35);
}
/* Soft lines fire at most once every ARCADE_COMMENTARY_CADENCE hands. The
   counter lives on the mode's own reward state, which is the same object
   for every hand of a run or a Career event and is discarded with it — so
   a Career event never inherits a Single Player run's cadence, and neither
   leaks into the other. */
const ARCADE_COMMENTARY_CADENCE = 4;
function softCommentaryAllowed(a,handNumber){
  const last=a._lastSoftCommentaryHand;
  return last==null||(handNumber-last)>=ARCADE_COMMENTARY_CADENCE;
}
/* THE PRIORITY LADDER (SCORING_SPEC.md 3.4), first match wins:
     1. terminal condition            -> nothing
     2. hard settlement facts         -> always, no cadence limit
     3. showdown luck tag             -> always, no cadence limit
     4. own holding shown down light  -> soft
     5. pot taken without a showdown  -> soft
   Returns { id, luck } where exactly one of the two is set, or null. */
function evaluateArcadeCommentary(g,outcome,snapshots,luck,netProfit){
  const a=rewardState(g);
  if (!a) return null;
  // Priority 1 — "a terminal hand says nothing" — is enforced at DELIVERY,
  // in finishHand(), not here. SCORING_SPEC.md 4 is explicit that the
  // terminal rule suppresses contradictory CELEBRATION and never
  // detection, mutation or persistence: a public luck tag earned on the
  // hand that cleared the table is still a true, discovered signal and is
  // still recorded, it simply must not be printed between the last card
  // and the result stage.
  const facts=arcadeSettlementFacts(g,outcome,netProfit);

  // 2. Settlement facts. Mutually exclusive in practice, but ordered so
  //    the reading is fixed rather than incidental.
  if (facts.won&&facts.wonContestedLayer&&netProfit<0) return { id:'sidePotWonNetLoss' };
  if (facts.won&&facts.chopped&&netProfit===0)         return { id:'potChopped' };
  // "More of what came back was your own stake than you actually gained."
  // This is the distinction computePots()' contributor count exists for:
  // a contested layer is opponents' money genuinely won, an unmatched
  // layer is the player's own bet returned. Comparing the returned
  // portion against NET PROFIT is what separates fixture F22 (+1.5bb
  // behind a 1,980 return) from fixture F7 (+20bb genuinely won, with a
  // small unmatched remainder).
  if (facts.won&&facts.uncalledWon>0&&facts.uncalledWon>netProfit) return { id:'uncalledBetReturned' };

  // 3. The luck tag, already gated to showdown-revealed opponents.
  if (luck) return { luck };

  // 4-5. Soft lines, rate limited together.
  if (!softCommentaryAllowed(a,g.handNumber||0)) return null;
  if (humanShowedDownLight(g,outcome,snapshots)){
    a._lastSoftCommentaryHand=g.handNumber||0;
    return { id:'shownDownLight' };
  }
  if (humanTookItWithoutShowdown(g,outcome,snapshots)){
    a._lastSoftCommentaryHand=g.handNumber||0;
    return { id:'pressureSucceeded' };
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
/* ---- WHAT WAS HERE, AND WHY IT IS NOT ----

   heroCatAtSnapshot(), actionWasCalled(), findArcadeFoldBluff(),
   isMonsterBluff() and evaluateArcadeSkill() were deleted at Phase 4B
   (SCORING_SPEC.md 2.2, 3.1). Together they were the decision-quality
   evaluator: the FOLD/CALL/VALUE/SHOVE/PRESSURE families graded against
   estimateEquity()'s uniformly-random opponent model, and the BLUFF tiers
   plus HERO CALL confirmed their verdict against opponents' HIDDEN cards
   on hands that never reached a showdown.

   They are deleted rather than disabled. Nothing here is retained behind
   a flag, and no scaffolding is left for a future range model to slot
   into — that workstream will bring its own detection, calibration, copy
   and tests, and an unused half-implementation would only mislead it.

   What survives is what a shipping feature genuinely needs:
   captureArcadeDecision()'s snapshots, because classifyArcadeLuck() reads
   their sizing and commitment fields to decide which commitment this hand
   turned on. Nothing that ships reads snap.equity any more.

*/

/* Event awards (SCORING_SPEC.md 2). Winning A POT LAYER is no longer
   sufficient for any of them: every award here is gated on the player
   finishing the hand NET AHEAD, measured by arcadeNetProfit().

   That single gate is what stops fixture F9 — quads nines takes a $40
   side pot while quads kings takes the $2,160 main pot, leaving the
   player $700 down — from firing MASSIVE POT, MONSTER HAND and a full
   victory ceremony on a losing hand. It is also what lets a genuine
   fold-win score at all: the old contested-pot measure excluded every
   folded contributor, so a +20bb fold-win measured as zero (D7). */
function evaluateArcadeEvents(g,outcome,awards){
  const human=g.players.find(p=>p.isHuman);
  if (!humanWonOutcome(outcome)) return;
  const netProfit=arcadeNetProfit(g);
  // Won a layer, still down on the hand (or exactly even, e.g. a chop):
  // nothing about that is a win, so nothing here fires.
  if (!(netProfit>0)) return;
  const netBB=netProfit/Math.max(1,g.bigBlind);
  if (netBB>=ARCADE_MASSIVE_WIN_BB) addArcadeAward(awards,'massiveWin');
  else if (netBB>=ARCADE_BIG_WIN_BB) addArcadeAward(awards,'bigWin');

  // MONSTER HAND keeps both of its gates: full house or better, and
  // REVEALED at showdown. A fold-win reveals nothing, so it never
  // qualifies however strong the holding actually was.
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
function evaluateArcadeMilestoneAchievements(g,context,awards){
  if (context&&context.koCount) addArcadeAward(awards,'ko',context.koCount);
  // Same condition, two names (D6). Career must never print the literal
  // award name TABLE CLEARED — it took first place in an EVENT.
  if (context&&context.tableClear) addArcadeAward(awards,g&&g.mode==='career'?'eventWon':'tableClear');
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
  await settleArcadeSnapshots(g);
  const awards=[];
  evaluateArcadeEvents(g,outcome,awards);
  const finalAwards=normalizeArcadeAwards(awards);
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
  }
  const awardsOut=potScore>0?[potWinnings,...finalAwards]:finalAwards;
  // NOTHING EARNED, NOTHING SHOWN. A hand can reach here having won a pot
  // LAYER and still be worth zero — an exact chop, or a side pot won on a
  // hand finished net down (fixtures F9, F11, F21). Returning null sends
  // runHumanPotSmashCeremony() down its existing plain-payout branch, so
  // the chips are still paid on screen and only the reward layer, the
  // TOTAL and the pot smash stay silent. Celebrating a loss is exactly the
  // dishonesty this correction exists to remove.
  if (!awardsOut.length) return null;
  // Commentary is NOT decided here. It is one line per hand, chosen by a
  // priority ladder that needs the terminal condition — which only exists
  // in finishHand(), after this has already run — so it is decided once,
  // on the late pass, and delivered to the CRT line rather than to this
  // reward layer (SCORING_SPEC.md 3.4, 3.5).
  return { awards:awardsOut, luck:null, commentary:null, total:potScore+bonusTotal };
}
/* Late phase — always runs from finishHand(), after resolveEliminations().

   SPLIT AT PHASE 4C into the four responsibilities SCORING_SPEC.md 4
   separates, because they used to be two:

     resolveArcadeHandScore()  detect + record, SILENT and side-effect-free
                               on the visible score
     bankArcadeResolution()    mutate the score with no ceremony
     presentArcadeResolution() the existing award carousel, which mutates
                               the score as part of showing it

   Before the split, score mutation lived INSIDE presentation on both
   paths (presentArcadeAward moved a.score; runPotSmashSequence's
   rollScore moved it), so suppressing the celebration on a terminal hand
   would also have suppressed the points. A terminal hand must still earn
   everything it objectively earned — it simply must not be congratulated
   between the bust and RUN OVER, or between the last K.O. and
   TABLE CLEARED / EVENT WON.

   If the human already won this hand's pot, evaluateArcadeAwardsEarly()
   has evaluated and presented everything except the milestones, so this
   adds only those. If they did not, nothing ran early and this computes
   the whole picture in one pass. */
async function resolveArcadeHandScore(g,outcome,context){
  const a=rewardState(g);
  if (!a) return null;
  const human=g.players.find(p=>p.isHuman);
  const netProfit=human?human.chips-(g._humanStart==null?human.chips:g._humanStart):0;
  const awards=[];
  // Nothing the player DID is graded any more. A hand they did not win can
  // still carry an objective milestone — a K.O. is possible on a pot layer
  // they lost — and both paths reach the same commentary decision.
  const snapshots=await settleArcadeSnapshots(g);
  evaluateArcadeMilestoneAchievements(g,context,awards);
  const luck=classifyArcadeLuck(g,outcome,snapshots);
  // ONE line for the hand, decided once, here — not once per path. This is
  // the only place that knows both the settlement and the terminal
  // condition, which is what the priority ladder needs.
  const chosen=evaluateArcadeCommentary(g,outcome,snapshots,luck,netProfit);
  const finalAwards=normalizeArcadeAwards(awards);
  const total=finalAwards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  // Recording and persistence happen HERE, unconditionally, whether or not
  // anything is ever shown — that is the whole point of the split.
  finalAwards.forEach(x=>{ a.awardCounts[x.id]=(a.awardCounts[x.id]||0)+x.count; });
  if (arcadePersists(g)){
    finalAwards.forEach(x=>noteArcadeDiscovery(x.id,x.count,x.def.base*x.count));
    // Luck tags are discoverable signals and appear in the awards glossary.
    // The objective settlement lines are not: they are statements of fact
    // about one hand, not something to collect, and a count for an id the
    // glossary cannot display would be permanent junk in the profile.
    if (chosen&&chosen.luck) noteArcadeDiscovery(chosen.luck.id,1,null);
  }
  return {
    awards:finalAwards, total, dev:false,
    luck:chosen&&chosen.luck?chosen.luck:null,
    commentary:chosen&&chosen.id?{id:chosen.id}:null
  };
}
/* Terminal-hand banking: every earned point added exactly once, with the
   displayed counter set EQUAL rather than rolled, so the result stage
   opens on the true final figure and no counter is left mid-animation
   behind it. */
function bankArcadeResolution(g,resolution){
  const a=rewardState(g);
  if (!a||!resolution) return;
  a.biggestReward=Math.max(a.biggestReward,resolution.total||0);
  a.score+=resolution.total||0;
  a.displayedScore=a.score;
  updateArcadeHUD();
}
/* `terminal` is decided by finishHand() BEFORE this is called — the hand
   ended the run or the event — and is what selects banking over
   celebration. Returns the resolution either way, so a caller can see
   what was earned without inferring it from what was shown. */
async function resolveArcadeHandLate(g,outcome,context,terminal){
  const resolution=await resolveArcadeHandScore(g,outcome,context);
  if (!resolution) return null;
  if (terminal){
    bankArcadeResolution(g,resolution);
    return resolution;
  }
  // The reward layer is for SCORING AWARDS only. Commentary — including a
  // luck tag — is delivered to the CRT line by finishHand() at the
  // "Hand complete." beat, and never through this carousel.
  if (resolution.awards.length){
    await queueArcadePresentation(()=>presentArcadeResolution(g,resolution));
  }
  return resolution;
}
/* The one line this hand DELIVERS, as text, or null. Read by finishHand()
   at the "Hand complete." beat.

   Detection has already happened and is never suppressed (SCORING_SPEC.md
   4: the terminal rule suppresses contradictory celebration, never
   detection, mutation or persistence). This is where priority 1 —
   "a terminal hand says nothing" — is actually applied, and it is applied
   with one distinction the fixture matrix forced into the open:

     terminal BUSTING hand  nothing at all, without exception. Straight to
                            RUN OVER / EVENT LOST.
     terminal WINNING hand  the SETTLEMENT and SOFT lines are suppressed,
                            because the result stage is about to state the
                            settlement itself and a line narrating it first
                            both duplicates and pre-empts it (fixture F19,
                            an uncalled return on the table-clearing hand).
                            A showdown LUCK TAG still speaks: it says
                            something the result stage never says, about
                            cards the player genuinely saw (fixture F3, a
                            0%-equity suck-out that cleared the table).
     ordinary hand          whatever won the priority ladder.

   `terminalBust` is passed rather than derived so this cannot disagree
   with the branch finishHand() is about to take. */
function arcadeCommentaryText(resolution,g,delivery){
  if (!resolution) return null;
  const d=delivery||{};
  if (d.terminalBust) return null;
  const luckId=resolution.luck?resolution.luck.id:null;
  const id=luckId||(resolution.commentary?resolution.commentary.id:null);
  if (!id) return null;
  if (d.terminal&&!luckId) return null;
  return commentaryLine(id,{
    netProfit:resolution.netProfit,
    bigBlind:g?g.bigBlind:null
  });
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
/* presentArcadeCommentary() was deleted at Phase 4D. Commentary — luck
   tags included — no longer uses #arcade-reward-layer at all; that layer
   is scoring awards only (SCORING_SPEC.md 3.5). The single line a hand
   earns is painted on the CRT action line by finishHand().

*/
async function presentArcadeResolution(g,r){
  const a=rewardState(g);
  if (!g||game!==g||!a) return;
  a.biggestReward=Math.max(a.biggestReward,r.total||0);
  for (const award of r.awards) await presentArcadeAward(g,award);
}
function finalizeArcadeRun(g){
  // Arcade persistence only — never reached for a Career event. Explicit
  // rather than incidental: see arcadePersists().
  if (!arcadePersists(g)) return;
  const score=g.run.arcade.score, prior=arcadeProfile.highScore||0;
  g.run.arcade.newHighScore=score>prior;
  if (score>prior){ arcadeProfile.highScore=score; saveArcadeProfile(); }
}
/* RUN OVER's final score is now a mechanical hero reel on the shared
   result stage (runOverModel/fillResultStageReels, 05-game-engine.js),
   filled and revealed by the same buildResultDigits/revealResultAmount
   pair every other headline quantity uses. The old #final-score-value
   ease-out counter that belonged to the standalone run report went with
   the report itself. finalizeArcadeRun() above is unchanged: it remains
   the single writer of the persisted high score. */
/* Explicit DEV display tests (section 20) — these preview the visual
   tiers directly and never falsify real gameplay scoring; genuine
   trigger logic is verified separately by playing rigged hands (see the
   REAL GAMEPLAY TEST controls in js/08-dev-mode.js). */
const DEV_ARCADE_SCENARIOS = {
  strong:      {awards:['bigWin']},
  elite:       {awards:['doubleUp']},
  jackpot:     {awards:['massiveWin']},
  // Deliberately out of order here — normalizeArcadeAwards' own tier/base
  // sort is what actually builds the escalating reveal.
  escalating:  {awards:['bigWin','monsterHand','doubleUp','ko','massiveWin']},
  massiveWin:  {awards:['massiveWin']},
  monsterHand: {awards:['monsterHand']},
  ko:          {awards:['ko']},
  luckyWin:    {awards:['bigWin'],luck:'lucky'},
  badBeat:     {awards:[],luck:'brutal'}
};
/* Reward-PRESENTATION dev tools. These drive the same breakdown/TOTAL/pot
   smash path a real hand does and never touch the felt.arcade profile
   (noteArcadeDiscovery is only reached from the two real evaluators, both
   gated on arcadePersists), so they run wherever rewardState() does —
   Arcade runs and Career events alike. */
function devArcadePresent(ids){
  if (!DEV_MODE||!rewardState(game)) return;
  const g=game;
  let awards=(ids||[]).map(id=>ARCADE_AWARDS[id]?{id,count:1,def:ARCADE_AWARDS[id]}:null).filter(Boolean);
  awards=normalizeArcadeAwards(awards);
  const total=awards.reduce((sum,x)=>sum+x.def.base*x.count,0);
  queueArcadePresentation(()=>presentArcadeResolution(g,{
    awards,luck:null,commentary:null,total,dev:true
  }));
}
function devArcadeAward(id){ devArcadePresent([id]); }
/* Commentary previews now paint the real surface — the CRT action line —
   through the same commentaryLine() lookup a real hand uses, rather than
   the reward layer they used to borrow. */
function devArcadeCommentary(id){
  if (!DEV_MODE||!rewardState(game)) return;
  const text=commentaryLine(id,{});
  if (text) setBanner(esc(text));
}
function devArcadeLuck(id){ devArcadeCommentary(id); }
function devArcadeScenario(id){
  const scenario=DEV_ARCADE_SCENARIOS[id];
  if (!scenario) return;
  devArcadePresent(scenario.awards);
  if (scenario.luck) devArcadeCommentary(scenario.luck);
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
  small:  { amount:180,  awardIds:[] },
  medium: { amount:900,  awardIds:['bigWin'] },
  huge:   { amount:2600, awardIds:['monsterHand','massiveWin','doubleUp'] }
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
  const entries=[...Object.entries(ARCADE_AWARDS),...Object.entries(ARCADE_LUCK)];
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
  // The canonical description of what the counter is (SCORING_SPEC.md 1),
  // used verbatim wherever the counter is explained. It is stated first,
  // before any point value, so nothing here can read as profit or XP.
  let html = '<div class="hint" style="margin-bottom:12px;">' +
    'An ephemeral machine tally generated by positive chip results and objective milestones. ' +
    'It is not profit, skill, XP or Career progression.</div>';
  html += SCORING_GUIDE_TIERS.filter(t=>byTier[t].length).map(t=>
    '<div class="sg-tier sg-tier-'+t+'"><div class="sg-tier-label">'+SCORING_GUIDE_TIER_LABEL[t]+'</div>'+byTier[t].map(row).join('')+'</div>'
  ).join('');
  html += '<div class="sg-section-label">Event rewards</div>' + events.map(row).join('');
  html += '<div class="sg-section-label">Pot winnings</div>' +
    '<div class="hint">POT WINNINGS — score generated from your actual net profit on the hand, adjusted for current table stakes. A hand you finish level or behind scores nothing.</div>';
  html += '<div class="sg-section-label">Luck</div>' +
    '<div class="hint">'+Object.values(ARCADE_LUCK).map(l=>esc(l.name)).join(' &middot; ')+' — these award 0 points.</div>';
  html += '<div class="hint" style="margin-top:10px;">Nothing here grades a decision, and nothing ever deducts score.</div>';
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
