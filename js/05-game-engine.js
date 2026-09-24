"use strict";

/* ============================================================
   GAME STATE
   ============================================================ */
let game = null;
let pendingHumanPlayer = null;
let seatEls = {};
let bannerOverride = null;
let coachToken = 0;
let logDirty = true;
let pendingNewTableAction = null;
/* Chip-transfer ownership state. bankPending/potPending count chip-
   events still in flight for that pile — while a pile's pending>0,
   render()'s bootstrap check leaves it alone (it's owned by the in-
   flight transferChips() call). There's no separate "shown" counter to
   keep in sync: each pile container's own `_chipCount` (see
   takeChipFromPile/flyChip) IS the visible state — a decorative
   approximation of p.chips/game.pot (see visualChipCount), never
   required to sum to it exactly. */
let bankPending = 0, potPending = 0;
/* Pot-smash bank-display freeze (see runHumanPotSmashCeremony in
   06-presentation.js) — while non-null, render()'s human stack reel shows
   this frozen pre-win value instead of the player's real (already
   correct) chips, so the visual bankroll only ever catches up once the
   physical chips finish being collected into the bank, never before. */
let humanBankDisplayFreeze = null;

/* Bounded local pacing evidence. This records only format, durations and
   public hand/session outcomes; no cards or action history are stored. */
const GAMEPLAY_METRICS_KEY = 'felt.gameplay.metrics.v1';
const GAMEPLAY_METRICS_HAND_LIMIT = 100;
const GAMEPLAY_METRICS_SESSION_LIMIT = 30;
function gameplayMetricFormat(g){
  if (!g) return 'unknown';
  if (g.mode==='career' && g.event) return g.event.id;
  if (g.mode==='career-cash') return CAREER_CASH_CONFIG.id;
  return g.formatId || g.mode || 'unknown';
}
function gameplayMetricsStore(){
  const raw=Store.get(GAMEPLAY_METRICS_KEY,{v:1,formats:{}});
  return raw && raw.v===1 && raw.formats && typeof raw.formats==='object'
    ? raw : {v:1,formats:{}};
}
function recordGameplayHandMetric(g){
  if (!g || !Number.isFinite(g._handStartedAt)) return null;
  const durationMs=Math.max(0,Date.now()-g._handStartedAt);
  const humanDecisionMs=Math.max(0,Math.min(durationMs,g._humanDecisionMs||0));
  const item={durationMs,humanDecisionMs,nonDecisionMs:durationMs-humanDecisionMs,
    flopSeen:Array.isArray(g.board)&&g.board.length>=3};
  const store=gameplayMetricsStore(), id=gameplayMetricFormat(g);
  const format=store.formats[id] || {hands:[],sessions:[]};
  format.hands=(Array.isArray(format.hands)?format.hands:[]).concat(item).slice(-GAMEPLAY_METRICS_HAND_LIMIT);
  if (!Array.isArray(format.sessions)) format.sessions=[];
  store.formats[id]=format; Store.set(GAMEPLAY_METRICS_KEY,store);
  return item;
}
function recordGameplayConclusion(g,result){
  if (!g || g._metricsConcluded) return false;
  g._metricsConcluded=true;
  const store=gameplayMetricsStore(), id=gameplayMetricFormat(g);
  const format=store.formats[id] || {hands:[],sessions:[]};
  if (!Array.isArray(format.hands)) format.hands=[];
  if (!Array.isArray(format.sessions)) format.sessions=[];
  format.sessions.push({hands:g.handNumber,durationMs:Math.max(0,Date.now()-(g.metricsStartedAt||Date.now())),result:String(result||'ended')});
  format.sessions=format.sessions.slice(-GAMEPLAY_METRICS_SESSION_LIMIT);
  store.formats[id]=format; Store.set(GAMEPLAY_METRICS_KEY,store);
  return true;
}
function gameplayMetricSummary(formatId){
  const format=gameplayMetricsStore().formats[formatId];
  const hands=format&&Array.isArray(format.hands)?format.hands:[];
  if (!hands.length) return {hands:0,medianHandMs:0,nonDecisionPct:0,flopSeenPct:0};
  const durations=hands.map(h=>h.durationMs).sort((a,b)=>a-b);
  const mid=Math.floor(durations.length/2);
  const median=durations.length%2?durations[mid]:Math.round((durations[mid-1]+durations[mid])/2);
  const elapsed=hands.reduce((n,h)=>n+h.durationMs,0);
  return {hands:hands.length,medianHandMs:median,
    nonDecisionPct:elapsed?Math.round(hands.reduce((n,h)=>n+h.nonDecisionMs,0)*100/elapsed):0,
    flopSeenPct:Math.round(hands.filter(h=>h.flopSeen).length*100/hands.length)};
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

/* ---------------- QUICK RESOLVE ----------------
   Once the human folds and two or more AI players are still contesting the
   pot, the rest of the hand is pure waiting — the player has no stake in it
   and no decision left to make. QUICK RESOLVE shortens those waits only.

   It is emphatically NOT a fast-forward to a precomputed result: the same
   aiDecide() calls run, the same applyAction() state changes happen, the
   same deck plays out, nothing hidden is revealed. The only thing that
   changes is how long the machine pauses between beats.

   It rides the two timing chokepoints FAST_DEV already uses — pacedSleep()
   below and speedMult() (03-opponents.js) — which is what makes it small.
   Everything in the payoff (playElimination, the pot-smash/K.O. physics,
   the stage-roll transitions) deliberately calls plain sleep() with its own
   config timings and never touches either chokepoint, so the reward
   presentation is structurally out of reach of this multiplier. On top of
   that, endQuickResolve() runs at the top of both outcome handlers, so the
   flag is already off before a single frame of result presentation plays.

   Deliberately NOT inherited from FAST_DEV: the AWARD POT auto-click (see
   waitForAwardPot, 06-presentation.js). That tap is player-paced input, not
   waiting, and it gates the whole chip payoff — it stays dev-only. */
const QUICK_RESOLVE_TIME_MULT = 0.25;
let quickResolveOn = false;
// The handNumber the flag belongs to. Binding it this way makes a stale
// flag surviving into the next hand structurally impossible rather than
// merely avoided by remembering to clear it — the same defence the long
// await chains already use with their `game !== g` identity guards.
let quickResolveHand = -1;
let quickResolveWaker = null;

function quickResolveActive(){
  return quickResolveOn && !!game && game.handNumber === quickResolveHand;
}

/* Availability. False before the human folds or commits all-in, false the instant only one
   contender is left (the hand is already ending), and false once phase has
   reached showdown/foldwin. Two all-in AIs with no decisions left still
   qualify — the street dealing between them is still waiting, which is
   exactly what this removes. */
function canQuickResolve(){
  const g = game;
  if (!g || g.over || pendingHumanPlayer) return false;
  if (!['preflop','flop','turn','river'].includes(g.phase)) return false;
  const human = g.players[0];
  if (!human || !human.inHand || (!human.folded && !human.allIn)) return false;
  return g.players.filter(p=>p.inHand && !p.folded).length >= 2;
}

// FAST DEV / QUICK RESOLVE-aware sleep for the handful of fixed showdown/
// action pacing beats that don't already run through speedMult() (see
// there) — never used inside playElimination, which always calls plain
// sleep() with its real config timings so K.O./ELIMINATED speed is never
// affected. FAST_DEV is checked first so the dev harness still wins.
function pacedSleep(ms){
  if (DEV_MODE && FAST_DEV) return sleep(Math.round(ms * FAST_DEV_TIME_MULT));
  if (quickResolveActive()) return sleep(Math.round(ms * QUICK_RESOLVE_TIME_MULT));
  return sleep(ms);
}

/* The AI think pause is the one wait long enough (up to ~3s) that pressing
   QUICK RESOLVE during it would look like the button did nothing, so this
   variant can be cut short. Each wait owns its own identity, which matters
   because a wait can outlive the game that started it — leaveTable() can
   fire while continueAction() is sitting in one. Without the identity
   check that abandoned timeout would fire later and null out the waker
   belonging to a hand that has since started on a new table, silently
   breaking press-to-truncate there. */
function aiWait(ms){
  return new Promise(resolve=>{
    let settled = false;
    const finish = ()=>{
      if (settled) return;      // expiry and an explicit release can race
      settled = true;
      clearTimeout(t);
      // Only disown the global waker if this wait is still the current one.
      if (quickResolveWaker === finish) quickResolveWaker = null;
      resolve();
    };
    const t = setTimeout(finish, ms);
    quickResolveWaker = finish;
  });
}

/* Teardown: cancel the pending wait's timer and let its awaiter resume, so
   no stale callback survives into a later game. This deliberately does not
   try to stop the abandoned action chain itself — that is still the job of
   continueAction()'s own `game !== g` / game.over guards, which the
   resumed awaiter runs straight into. */
function releaseQuickResolveWait(){
  const w = quickResolveWaker;
  quickResolveWaker = null;
  if (w) w();
}

function startQuickResolve(){
  // The anti-double-press guard. The button is also disabled the moment it
  // fires and the un-flipped face is pointer-events:none, but this is the
  // one that actually matters — it makes a second press a no-op rather
  // than something that re-arms state or starts a duplicate timer. Nothing
  // here schedules a timer at all, so there is nothing to duplicate.
  if (quickResolveActive() || !canQuickResolve()) return;
  quickResolveOn = true;
  quickResolveHand = game.handNumber;
  const btn = $('btn-quick-resolve');
  if (btn){
    btn.textContent = 'Resolving…';
    btn.classList.add('is-resolving');
    btn.disabled = true;
  }
  haptic(18);
  // Land the press immediately rather than at the end of the pause the AI
  // is already sitting in.
  releaseQuickResolveWait();
}

/* Restores normal speed and puts the console back on its action face.
   Called at the top of both outcome handlers — before any result
   presentation runs — and defensively from startNewHand()/concludeGame()/
   leaveTable(). */
function endQuickResolve(){
  quickResolveOn = false;
  quickResolveHand = -1;
  releaseQuickResolveWait();
  const flip = $('actions-flip');
  if (flip) flip.classList.remove('flipped');
  const btn = $('btn-quick-resolve');
  if (btn){
    btn.textContent = 'Quick Resolve';
    btn.classList.remove('is-resolving');
    btn.disabled = true;
  }
}
function $(id){ return document.getElementById(id); }

function makePlayer(id, name, isHuman, chips, personality){
  // moodState = gameplay mood (read by aiDecide). faceMood = presentation
  // mood (portraits only, never read by aiDecide). Two separate objects on
  // purpose — see the PRESENTATION MOOD block in 03-opponents.js.
  return { id, name, isHuman, chips, personality, lives:3, moodState:null,
    faceMood:{ family:'neutral', intensity:0 },
    faceColorIdx:null,
    hand:[], folded:false, allIn:false, betThisRound:0, totalBetHand:0,
    acted:false, mayRaise:true, inHand:false, eliminated:false };
}

/* Accepts a supplied roster only if it seats exactly this table and every
   seat names a personality that still exists. Anything else returns null
   and the table falls back to the ordinary random draw — a partial roster
   must never build a table with an undefined persona in a seat. */
function careerLaunchRoster(roster, numOpponents){
  if (!Array.isArray(roster) || roster.length !== numOpponents) return null;
  const ok = roster.every(seat=>seat && typeof seat.personalityKey === 'string'
    && PERSONALITIES_ALL.some(p=>p.key === seat.personalityKey)
    && Number.isInteger(seat.faceColorIdx));
  return ok ? roster : null;
}

function newGame(opts){
  const elim = opts.mode==='elimination';
  // Elimination mode is config-driven for stakes (fixed starting stack/
  // blinds, no rebuy) — see ELIMINATION_CONFIG — and never reads
  // opts.stack/opts.blindLevel. Table SIZE is the one thing the caller
  // owns: Single Player lets the player pick 4/5/6 opponents at the start
  // of a run. It's put through normalizeOpponentCount() rather than
  // trusted, so a missing or nonsense value lands on the safe 4-opponent
  // table instead of building an unsupported one.
  const stack = elim ? ELIMINATION_CONFIG.startingStack : opts.stack;
  const numOpponents = elim ? normalizeOpponentCount(opts.opponents) : opts.opponents;

  const players = [];
  players.push(makePlayer('you', settings.playerName || 'You', true, stack, null));
  // opts.roster is Career's AUTHORITATIVE field for this event — the same
  // personalities and face colours the event directory advertised (see the
  // roster book in 07-ui-wiring.js). When one is supplied the table is
  // built from it instead of drawing fresh randoms, which is what makes
  // the played table the advertised table. Every other caller passes none
  // and keeps the original random draw, unchanged.
  const roster = careerLaunchRoster(opts.roster, numOpponents);
  const personas = roster
    ? roster.map(seat=>PERSONALITIES_ALL.find(p=>p.key===seat.personalityKey))
    : pickPersonalities(numOpponents);
  const usedNames = new Set();
  for (let i=0;i<numOpponents;i++){
    // Display names are still resolved live from the current setting, as
    // before: the directory advertises faces, not names, so a roster fixes
    // WHO is at the table without freezing what the name setting shows.
    const displayName = settings.opponentNames === 'random' ? randomOpponentName(usedNames) : personas[i].name;
    const player = makePlayer('ai'+i, displayName, false, stack, personas[i]);
    if (roster) player.faceColorIdx = roster[i].faceColorIdx;
    players.push(player);
  }
  // Only ever backfills a seat still without a colour, so a roster's
  // colours are never shuffled out from under it.
  assignFaceColors(players);
  const lvl = opts.mode==='tournament' ? (opts.initialBlindLevel||0) : (opts.blindLevel||0);
  const explicitBlinds = Number.isFinite(opts.smallBlind) && Number.isFinite(opts.bigBlind)
    && opts.smallBlind > 0 && opts.bigBlind > opts.smallBlind;
  const smallBlind = elim ? ELIMINATION_CONFIG.smallBlind
    : explicitBlinds ? opts.smallBlind : BLIND_LEVELS[lvl][0];
  const bigBlind = elim ? ELIMINATION_CONFIG.bigBlind
    : explicitBlinds ? opts.bigBlind : BLIND_LEVELS[lvl][1];
  if (opts.mode === 'career-cash'){
    players.forEach(p=>{ if (!p.isHuman) p.cashReserve = CAREER_CASH_CONFIG.residentReserve; });
  }
  game = {
    players, difficulty:opts.difficulty, mode:opts.mode,
    startingStack:stack, blindLevel:lvl,
    smallBlind, bigBlind,
    board:[], deck:[], pot:0, currentBet:0, minRaise:bigBlind,
    dealerIndex:-1, sbIndex:-1, bbIndex:-1, currentIndex:-1, turnPointer:0,
    phase:'setup', handNumber:0, log:[], over:false,
    buyIns:stack, netStart:stack,
    livesEnabled: opts.mode==='cash' && !!settings.lives,
    formatId:opts.formatId || null,
    handsPerBlindLevel:Number.isInteger(opts.handsPerBlindLevel) ? opts.handsPerBlindLevel : TOURNAMENT_HANDS_PER_LEVEL,
    cashSessionId:typeof opts.cashSessionId === 'string' ? opts.cashSessionId : null,
    championshipFinalTableReached:false,
    metricsStartedAt:Date.now(),
    sess:{ bestWin:0, worstLoss:0 }
  };
}

/* ---------------- table save/resume ----------------
   Saved only at safe between-hand points (see finishHand). No deck, hole
   cards, board, phase, or unfinished bets are ever persisted — a restored
   table always resumes at the pre-deal moment. */
function serializeTable(g){
  const snapshot = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    namesMode: settings.opponentNames,
    mode:g.mode, difficulty:g.difficulty, startingStack:g.startingStack,
    formatId:g.formatId || null,
    handsPerBlindLevel:g.handsPerBlindLevel,
    metricsStartedAt:Number.isFinite(g.metricsStartedAt)?g.metricsStartedAt:Date.now(),
    blindLevel:Number.isFinite(g.blindLevel)?g.blindLevel:0, smallBlind:g.smallBlind, bigBlind:g.bigBlind,
    buyIns:g.buyIns, netStart:g.netStart, livesEnabled:g.livesEnabled,
    dealerIndex:g.dealerIndex, handNumber:g.handNumber,
    sess:{ bestWin:g.sess.bestWin, worstLoss:g.sess.worstLoss },
    players: g.players.map(p=>({
      id:p.id, name:p.name, isHuman:p.isHuman, chips:p.chips,
      lives:p.lives, eliminated:p.eliminated,
      personalityKey: p.personality ? p.personality.key : null,
      moodState: p.moodState || null,
      faceMood: p.faceMood || null,
      faceColorIdx: Number.isInteger(p.faceColorIdx) ? p.faceColorIdx : null,
      cashReserve:Number.isSafeInteger(p.cashReserve) && p.cashReserve >= 0 ? p.cashReserve : null
    }))
  };
  if (g.mode==='career-cash'){
    snapshot.cashSessionId = g.cashSessionId;
    snapshot.formatId = CAREER_CASH_CONFIG.id;
  }
  if (g.mode==='elimination' && g.run) snapshot.run=JSON.parse(JSON.stringify(g.run));
  // Career carries its event the same way an elimination run carries g.run.
  // The reward state rides along deliberately: the event TOTAL is ephemeral
  // in the sense that it dies when the event settles, NOT in the sense that
  // it resets on every refresh — a player fifteen hands in must not come
  // back to a zeroed score. equityPromise-bearing decisionSnapshots are
  // dropped, since a snapshot is only ever taken between hands.
  if (g.mode==='career' && g.event){
    snapshot.championshipFinalTableReached = g.championshipFinalTableReached === true;
    snapshot.event = Object.assign(careerEventSnapshot(g.event), {
      reward: g.event.reward
        ? Object.assign({}, g.event.reward, { decisionSnapshots:[] })
        : null
    });
  }
  return snapshot;
}

function isValidTableSave(save){
  if (!save || typeof save !== 'object') return false;
  if (save.version !== SAVE_VERSION) return false;
  if (!Array.isArray(save.players) || save.players.length < 2) return false;
  if (!save.players.some(p=>p && p.isHuman)) return false;
  if (save.mode !== 'cash' && save.mode !== 'tournament' && save.mode !== 'elimination') return false;
  if (save.mode==='elimination' && (!save.run || typeof save.run.tableNumber!=='number' || !save.run.arcade)) return false;
  if (!DIFFICULTY_PARAMS[save.difficulty]) return false;
  const numFields = ['startingStack','blindLevel','smallBlind','bigBlind','buyIns','netStart','dealerIndex','handNumber'];
  for (const f of numFields){ if (typeof save[f] !== 'number' || Number.isNaN(save[f])) return false; }
  if (save.dealerIndex < -1 || save.dealerIndex >= save.players.length) return false;
  for (const p of save.players){
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return false;
    if (typeof p.chips !== 'number' || Number.isNaN(p.chips)) return false;
    if (typeof p.lives !== 'number' || Number.isNaN(p.lives)) return false;
    if (p.personalityKey && !PERSONALITIES_ALL.some(pp=>pp.key===p.personalityKey)) return false;
  }
  return true;
}

function saveTable(){
  if (!game || game.over) return;
  const snapshot=serializeTable(game);
  game._safeSave=snapshot;
  Store.set('felt.table', snapshot);
  return true;
}
function saveProgress(){
  if (!game || (game.over && !(game.run && game.run.active))) return false;
  // The shared SAVE button must respect Career's dedicated checkpoint key
  // just as finishHand()/leaveTable() do. It must never overwrite the
  // player's independent Classic/Arcade resume slot.
  if (game.mode === 'career') return saveCareerTable();
  if (game.mode === 'career-cash') return checkpointCareerCash(game._safeSave || serializeTable(game));
  const snapshot=game._safeSave || serializeTable(game);
  Store.set('felt.table', snapshot);
  return true;
}
function loadTableSave(){
  const raw = Store.get('felt.table', null);
  if (!isValidTableSave(raw)){
    if (raw) clearTableSave();
    return null;
  }
  return raw;
}
function clearTableSave(){ Store.remove('felt.table'); }

/* ---------------- Career table persistence ----------------
   A Career event's table lives under its OWN key. It deliberately never
   goes near 'felt.table':
     - writing there would silently destroy the player's Single Player save,
       since there is only one slot and no per-mode namespacing;
     - and a Career table that happened to validate would make the menu
       offer "Continue", restoring a Career event as a Single Player run.
   isValidTableSave()'s mode whitelist is also left without 'career' as
   defence in depth, so even a misrouted Career blob could never load there.

   This is a between-hand checkpoint, exactly like the Single Player save
   (see the note above serializeTable): no deck, board, hole cards or live
   betting state. Resuming re-deals the current hand. Exact current-hand
   resume is deferred work, not solved here. */
const CAREER_TABLE_KEY = 'felt.career.table';

function isValidCareerTableSave(save){
  if (!save || typeof save !== 'object') return false;
  if (save.version !== SAVE_VERSION) return false;
  if (save.mode !== 'career') return false;
  if (!Array.isArray(save.players) || save.players.length < 2) return false;
  if (!save.players.some(p=>p && p.isHuman)) return false;
  if (!DIFFICULTY_PARAMS[save.difficulty]) return false;
  const numFields = ['startingStack','blindLevel','smallBlind','bigBlind','buyIns','netStart','dealerIndex','handNumber'];
  for (const f of numFields){ if (typeof save[f] !== 'number' || Number.isNaN(save[f])) return false; }
  if (save.dealerIndex < -1 || save.dealerIndex >= save.players.length) return false;
  for (const p of save.players){
    if (typeof p.id !== 'string' || typeof p.chips !== 'number' || Number.isNaN(p.chips)) return false;
    if (p.personalityKey && !PERSONALITIES_ALL.some(pp=>pp.key===p.personalityKey)) return false;
  }
  return isValidCareerEventSnapshot(save.event);
}

function isValidCareerCashTableSave(save){
  if (!save || typeof save !== 'object' || save.version !== SAVE_VERSION) return false;
  if (save.mode !== 'career-cash' || save.formatId !== CAREER_CASH_CONFIG.id) return false;
  if (typeof save.cashSessionId !== 'string' || !save.cashSessionId) return false;
  if (!Array.isArray(save.players) || save.players.length !== CAREER_CASH_CONFIG.playerCount) return false;
  if (save.smallBlind !== CAREER_CASH_CONFIG.smallBlind || save.bigBlind !== CAREER_CASH_CONFIG.bigBlind) return false;
  if (save.startingStack !== CAREER_CASH_CONFIG.stack) return false;
  const numbers = ['dealerIndex','handNumber','smallBlind','bigBlind','startingStack'];
  if (numbers.some(key=>!Number.isSafeInteger(save[key]))) return false;
  if (save.dealerIndex < -1 || save.dealerIndex >= save.players.length) return false;
  let humans = 0;
  let sessionFunds = 0;
  for (const p of save.players){
    if (!p || typeof p.id !== 'string' || !Number.isSafeInteger(p.chips) || p.chips < 0) return false;
    if (p.isHuman) humans++;
    else if (!Number.isSafeInteger(p.cashReserve) || p.cashReserve < 0
      || p.cashReserve % CAREER_CASH_CONFIG.stack !== 0) return false;
    sessionFunds += p.chips + (p.isHuman ? 0 : p.cashReserve);
    if (p.personalityKey && !PERSONALITIES_ALL.some(pp=>pp.key===p.personalityKey)) return false;
  }
  const initialFunds = CAREER_CASH_CONFIG.stack
    + CAREER_CASH_CONFIG.opponentCount * (CAREER_CASH_CONFIG.stack + CAREER_CASH_CONFIG.residentReserve);
  return humans === 1 && sessionFunds === initialFunds;
}

/* Career table saves written before a schema change carry only part of a
   snapshot — version 1 had id/buyIn/prize, version 2 gained the launch
   fields but not `payouts`. Enrich those from the matching descriptor while
   retaining the paid terms through applyPaidCareerTerms(), the same rule
   the career save itself uses. Full snapshots are already the authority and
   are never overwritten from the live registry. */
function normalizeCareerSavedEvent(saved){
  if (isValidCareerEventSnapshot(saved)) return Object.assign({}, saved);
  const descriptor = careerEventById(saved && saved.id);
  if (!descriptor) return null;
  const event = applyPaidCareerTerms(careerEventSnapshot(descriptor), saved);
  if (saved.reward) event.reward = saved.reward;
  return event;
}
function normalizeCareerTableSave(raw){
  if (!raw || typeof raw !== 'object') return null;
  const event = normalizeCareerSavedEvent(raw.event);
  if (!event) return null;
  return Object.assign({}, raw, { event });
}

/* Prefers _safeSave (the clean pre-deal checkpoint startNewHand records) so
   a mid-hand write rewinds to the start of the current hand rather than
   persisting a half-played one — same rule as saveProgress(). */
function saveCareerTable(){
  if (!game || game.mode !== 'career') return false;
  Store.set(CAREER_TABLE_KEY, game._safeSave || serializeTable(game));
  return true;
}
function loadCareerTable(){
  const raw = Store.get(CAREER_TABLE_KEY, null);
  const normalized = normalizeCareerTableSave(raw);
  if (!isValidCareerTableSave(normalized)){
    if (raw) clearCareerTable();
    return null;
  }
  if (!isValidCareerEventSnapshot(raw.event)) Store.set(CAREER_TABLE_KEY, normalized);
  return normalized;
}
function clearCareerTable(){ Store.remove(CAREER_TABLE_KEY); }

function restoreTable(save){
  const players = save.players.map(sp=>{
    const personality = sp.personalityKey ? PERSONALITIES_ALL.find(p=>p.key===sp.personalityKey) : null;
    // Persona display names are derived live from PERSONALITIES_ALL rather than
    // trusted from the saved snapshot, so a table saved under an older persona
    // naming scheme picks up current names on resume instead of freezing them.
    // Random-mode names have no live source, so those are always kept as saved.
    const usesLiveName = !sp.isHuman && personality && save.namesMode !== 'random';
    const name = usesLiveName ? personality.name : sp.name;
    const p = makePlayer(sp.id, name, sp.isHuman, sp.chips, personality);
    p.lives = sp.lives;
    p.eliminated = !!sp.eliminated;
    p.moodState = sp.moodState || null;
    // Saves written before faceMood existed simply have no field here, and
    // a hand-edited/corrupt one may name a family that no longer exists —
    // both land on neutral rather than failing the whole Continue restore.
    p.faceMood = (sp.faceMood && FACE_MOOD_POOLS[sp.faceMood.family])
      ? { family: sp.faceMood.family, intensity: clamp01(sp.faceMood.intensity) }
      : { family:'neutral', intensity:0 };
    p.faceColorIdx = Number.isInteger(sp.faceColorIdx) ? sp.faceColorIdx : null;
    if (Number.isSafeInteger(sp.cashReserve) && sp.cashReserve >= 0) p.cashReserve = sp.cashReserve;
    return p;
  });
  // Backfills anyone missing a colour (a save from before this system
  // existed) without disturbing players who already have one.
  assignFaceColors(players);
  game = {
    players, difficulty:save.difficulty, mode:save.mode,
    startingStack:save.startingStack, blindLevel:save.blindLevel,
    smallBlind:save.smallBlind, bigBlind:save.bigBlind,
    board:[], deck:[], pot:0, currentBet:0, minRaise:save.bigBlind,
    dealerIndex:save.dealerIndex, sbIndex:-1, bbIndex:-1, currentIndex:-1, turnPointer:0,
    phase:'setup', handNumber:save.handNumber, log:[], over:false,
    buyIns:save.buyIns, netStart:save.netStart,
    livesEnabled:save.livesEnabled,
    formatId:save.formatId || null,
    handsPerBlindLevel:Number.isInteger(save.handsPerBlindLevel) ? save.handsPerBlindLevel : TOURNAMENT_HANDS_PER_LEVEL,
    cashSessionId:typeof save.cashSessionId === 'string' ? save.cashSessionId : null,
    championshipFinalTableReached:save.championshipFinalTableReached === true,
    metricsStartedAt:Number.isFinite(save.metricsStartedAt) ? save.metricsStartedAt : Date.now(),
    sess:{ bestWin:(save.sess&&save.sess.bestWin)||0, worstLoss:(save.sess&&save.sess.worstLoss)||0 }
  };
  if (save.mode==='elimination'){
    game.run=JSON.parse(JSON.stringify(save.run));
    // Opponent count is a run property, so it has to survive save/reload/
    // Continue exactly as chosen. A save written before this existed has
    // no field at all — fall back to the seat count the save itself
    // carries (eliminated players stay in the array, so that IS the
    // original table size), which resolves an old 4-opponent save to 4.
    // Anything not on the supported list normalises to 4.
    const storedCount = game.run.opponentCount;
    game.run.opponentCount = isOpponentChoice(storedCount)
      ? storedCount
      : normalizeOpponentCount(save.players.filter(p=>!p.isHuman).length);
  }
  if (save.mode==='career'){
    const ev = normalizeCareerSavedEvent(save.event);
    if (ev) game.event = Object.assign({}, ev, {
      // Restore the accumulated TOTAL when the save carries a usable one;
      // build a fresh state only when it is absent or malformed.
      reward: isValidEventReward(ev.reward) ? ev.reward : makeEventRewardState()
    });
    if (game.event && !Array.isArray(game.event.reward.decisionSnapshots)) game.event.reward.decisionSnapshots = [];
  }
}

function isValidEventReward(r){
  return !!r && typeof r === 'object'
    && typeof r.score === 'number' && !Number.isNaN(r.score)
    && !!r.awardCounts && typeof r.awardCounts === 'object';
}

/* The authoritative opponent count for a live elimination run — run state
   first, then the table's own AI seat count (which stays constant for the
   table's whole life: eliminated players are never spliced out of
   g.players), then the config default. Everything that used to read the
   fixed ELIMINATION_CONFIG.opponents goes through here. */
function runOpponentCount(g){
  if (g && g.run && isOpponentChoice(g.run.opponentCount)) return g.run.opponentCount;
  if (g && Array.isArray(g.players)){
    const seats = g.players.filter(p=>!p.isHuman).length;
    if (seats > 0) return seats;
  }
  return ELIMINATION_CONFIG.opponents;
}

function nextActiveIndex(fromIndex){
  const n = game.players.length;
  let i = fromIndex;
  for (let c=0;c<n;c++){ i=(i+1)%n; if (game.players[i].inHand) return i; }
  return -1;
}
function findNextActor(startIndex){
  const n = game.players.length;
  for (let c=0;c<n;c++){
    const idx = (startIndex+c)%n;
    const p = game.players[idx];
    if (p.inHand && !p.folded && !p.allIn && p.chips>0) return idx;
  }
  return -1;
}

function logMsg(text, isMarker){
  game.log.push({t:text, m:!!isMarker});
  if (game.log.length > 250) game.log.splice(0, game.log.length-250);
  logDirty = true;
  if ($('log-drawer').classList.contains('open')) renderLog();
}
function paintCRT(el, html, thinking){
  if (!el) return;
  const key = String(html||'');
  el.classList.toggle('is-thinking',!!thinking);
  if (el.dataset.crtText === key) return;
  el.dataset.crtText = key;
  el.innerHTML = key;
  // The change effect is the CRT component's own: js/crt.js watches every
  // .crt and plays it (and the ghost of the old text) on a real change.
}
function paintBanner(html){
  const plain = String(html||'').replace(/<[^>]*>/g,'').toLowerCase();
  paintCRT($('banner'),html,plain.includes('thinking'));
}
function setBanner(html){ bannerOverride = html; paintBanner(html); }
function actionRowsHTML(primary, secondary, thinking){
  return '<span class="crt-line-primary">'+esc(primary||'')+'</span>'+
    '<span class="crt-line-secondary">'+esc(secondary||'')+(thinking?'<span class="crt-cursor" aria-hidden="true">■</span>':'')+'</span>';
}
function paintActionRows(primary, secondary, thinking){
  paintCRT($('banner'),actionRowsHTML(primary,secondary,thinking),!!thinking);
}
function setActionRows(primary, secondary, thinking){
  bannerOverride=actionRowsHTML(primary,secondary,thinking);
  paintCRT($('banner'),bannerOverride,!!thinking);
}

function handSignalTier(player){
  if (!player || !player.hand || player.hand.length<2) return 0;
  if (!game.board.length) return player.hand[0].value===player.hand[1].value ? 1 : 0;
  if (game.board.length<3) return 0;
  const cat=evaluate7([...player.hand,...game.board]).cat;
  if (cat>=6) return 3;       // full house, quads, straight flush
  if (cat>=3) return 2;       // trips, straight, flush
  if (cat>=1) return 1;       // pair or two pair
  return 0;
}

function updateHandInstrument(){
  const el=$('hand-strength');
  const p=game && game.players.find(x=>x.isHuman);
  if (!el) return;
  el.classList.remove('hand-tier-0','hand-tier-1','hand-tier-2','hand-tier-3');
  if (!settings.strength){ el.classList.add('hand-tier-0'); paintCRT(el,'<b>Hand readout off</b>',false); return; }
  if (game && game._humanCardsVisible===false){
    el.classList.add('hand-tier-0'); paintCRT(el,'<b>Hand scanner ready</b>',false); return;
  }
  if (!p || !p.hand || p.hand.length<2){ el.classList.add('hand-tier-0'); paintCRT(el,'<b>Hand scanner ready</b>',false); return; }
  // During the three-card flop animation the board briefly contains only
  // one or two cards, which is not yet a valid five-card evaluation.
  const description = game.board.length>0 && game.board.length<3
    ? describeHole(p.hand) : describePlayerHand(p.hand,game.board);
  el.classList.add('hand-tier-'+handSignalTier(p));
  paintCRT(el,'<b>'+esc(description)+'</b>',false);
}

/* ---------------- hand lifecycle ---------------- */
async function startNewHand(){
  const g = game;
  // Every hand begins at normal speed, whatever the last one did.
  endQuickResolve();
  // A manual save during this hand resumes from this clean checkpoint,
  // never from a half-settled pot or partially completed betting round.
  g._safeSave=serializeTable(g);
  g._handStartedAt=Date.now();
  g._humanDecisionMs=0;
  g._humanDecisionStartedAt=null;
  bannerOverride = null;
  g._humanCardsVisible = false;
  hideResultCard();
  hideHudResultConsole();
  clearAllCardDOM();
  updateHandInstrument();

  // tournament/career: blinds climb; cash: AI top up so the table stays alive
  // NOTE: this runs BEFORE g.handNumber++ below, so handNumber reads as
  // hands *completed*. floor(9/10)=0 keeps hand #10 at 10/20 and
  // floor(10/10)=1 raises hand #11 to 15/30 — the intended boundary. The
  // arithmetic is correct as-is; only the mode test was widened for Career.
  if (g.mode === 'tournament' || g.mode === 'career'){
    const firstLevel = g.mode === 'career' && g.event
      ? g.event.initialBlindLevel : 0;
    const handsPerLevel = g.mode === 'career' && g.event
      ? g.event.handsPerBlindLevel : g.handsPerBlindLevel;
    const target = Math.min(BLIND_LEVELS.length-1,
      firstLevel + Math.floor(g.handNumber / handsPerLevel));
    if (target !== g.blindLevel){
      g.blindLevel = target;
      g.smallBlind = BLIND_LEVELS[target][0];
      g.bigBlind = BLIND_LEVELS[target][1];
      logMsg('Blinds up — ' + g.smallBlind + ' / ' + g.bigBlind, true);
    }
    g.players.forEach(p=>{ if (p.chips<=0) p.eliminated = true; });
  } else if (g.mode === 'career-cash'){
    // Cash attrition is resolved and checkpointed at the END of each hand.
    // This branch is defensive only: no busted seat can be dealt back in.
    g.players.forEach(p=>{ if (p.chips<=0) p.eliminated = true; });
  } else if (g.mode === 'elimination'){
    // No rebuys, ever — $0 is permanent for this table. finishHand's
    // resolveEliminations() already marks a busted player eliminated the
    // moment they hit $0 (and plays their K.O./ELIMINATED presentation
    // then), so this is just the same defensive safety-net tournament
    // mode already applies above, not the primary mechanism.
    g.players.forEach(p=>{ if (p.chips<=0) p.eliminated = true; });
  } else if (g.livesEnabled){
    g.players.forEach(p=>{
      if (p.isHuman || p.eliminated) return;
      if (p._pendingRebuy || p.chips<=0){
        p._pendingRebuy = false;
        p.chips = g.startingStack;
        logMsg(p.name + ' rebuys for ' + g.startingStack.toLocaleString() + ' \u2014 ' + p.lives + (p.lives===1?' life':' lives') + ' left');
      }
    });
  } else {
    g.players.forEach(p=>{
      if (!p.isHuman && p.chips<=0){ p.chips = g.startingStack; logMsg(p.name + ' rebuys for ' + g.startingStack.toLocaleString()); }
    });
  }

  g.players.forEach(p=>{
    p.hand=[]; p.folded=false; p.allIn=false; p.betThisRound=0; p.totalBetHand=0;
    p.acted=false; p.mayRaise=true;
    // The stack each player BROUGHT to this hand, captured before blinds are
    // posted. Career placement needs it to rank players who bust on the same
    // hand (see careerFinishPlace); harmless and mode-blind everywhere else.
    // A player eliminated on an earlier hand carries 0 here, which is exactly
    // what distinguishes them from this hand's busts.
    p._handStartChips = p.chips;
    // K.O.!/ELIMINATED! (see playElimination) is a permanent-for-the-table
    // label, not a per-hand one — every other streetAction resets fresh
    // each hand, this is the one exception.
    if (!p.streetAction || (p.streetAction.type!=='ko' && p.streetAction.type!=='eliminated')) p.streetAction = null;
    // EMERGENCY invariant only — NOT the normal elimination mechanism.
    // resolveEliminations() and its recoverMissedEliminations() safety
    // net (both in finishHand(), while the hand's outcome/potResults are
    // still available) are supposed to be the only place a genuine bust
    // ever gets marked eliminated, with real KO attribution, run KO
    // stats, arcade reward and the death ceremony. If a non-human AI
    // still reaches the START of the NEXT hand at stack<=0 and not
    // eliminated despite that, every earlier check already failed — none
    // of that bookkeeping can be recovered this late (there's no hand
    // outcome left to attribute a KO to), so this only corrects the flag
    // for correct display/aiRemaining counting and logs loudly. It can
    // never let them be dealt in regardless of whether this fires: the
    // inHand assignment right below already requires chips>0 on its own.
    if (!p.isHuman && !p.eliminated && p.chips<=0){
      console.error('[elimination] EMERGENCY: '+p.name+' reached the next hand at stack<=0 and still not eliminated — this should be impossible after finishHand()\'s recovery pass. KO stats/reward/ceremony for this bust cannot be recovered here.');
      logMsg('[EMERGENCY] '+p.name+' force-eliminated at deal time — this indicates a missed invariant upstream, please report', true);
      p.eliminated = true;
    }
    p.inHand = p.chips>0 && !p.eliminated;
    delete p._reveal; delete p._award; delete p._handRes;
    // Card ownership (p.hand, assigned below) and visual reveal are
    // deliberately separate: p._holeRevealed tracks, per hole-card index,
    // whether THIS hand's deal animation has actually flipped that card
    // face-up yet. render() (see syncCardRow's `mine` mask) treats any
    // index missing from this array as still face-down, no matter how
    // early or how often render() fires before revealHoleCardsAnimated
    // gets to run — a stray render() can never paint a real face early.
    p._holeRevealed = [];
  });
  g.board=[]; g.pot=0; g.currentBet=0; g.minRaise=g.bigBlind;
  g.deck = shuffle(createDeck());
  g.handNumber++;
  g.handActions = [];
  g.humanFoldSnapshot = null;
  const _reward = rewardState(g); if (_reward) _reward.decisionSnapshots=[];
  hideReview();
  // Order matters. A reaction chain from the previous hand may still be
  // mid-flight (they are fire-and-forget), and while it holds a seat's
  // lock every ordinary setMood() call for that seat is suppressed. So
  // the locks are released FIRST — before any new-hand portrait update —
  // or applyLingeringFaces() below would be silently swallowed and the
  // stale expression would freeze into the new hand. The abandoned chain
  // stops on its own at its next step (its token no longer owns the seat).
  //   clear locks -> decay moods -> paint lingering faces -> turn flow
  g.players.forEach(p=>{ if (!p.isHuman) clearFaceLock(p.id); });
  decayMoods();
  decayFaceMoods();
  applyLingeringFaces();

  if (g.players.filter(p=>p.inHand).length < 2){ concludeGame(); return; }

  g.dealerIndex = g.dealerIndex===-1
    ? (g.players[0].inHand ? 0 : nextActiveIndex(0))
    : nextActiveIndex(g.dealerIndex);

  for (const p of g.players) if (p.inHand) p.hand = [g.deck.pop(), g.deck.pop()];

  g._humanStart = g.players[0].chips;   // session best/worst tracking baseline
  g._humanAllIn = false;

  assignBlinds();
  postBlind(g.players[g.sbIndex], g.smallBlind);
  postBlind(g.players[g.bbIndex], g.bigBlind);
  if (g.players[0].allIn) g._humanAllIn = true;
  g.currentBet = g.bigBlind;
  g.minRaise = g.bigBlind;
  g.positions = computePositions();

  logMsg('Hand ' + g.handNumber, true);
  logMsg(g.players[g.sbIndex].name + ' posts small blind (' + g.smallBlind + ')');
  logMsg(g.players[g.bbIndex].name + ' posts big blind (' + g.bigBlind + ')');

  $('btn-next-hand').classList.add('hidden');
  $('btn-rebuy').classList.add('hidden');
  $('btn-new-table').classList.add('hidden');
  // Persistent controls: visible (dimmed) from the moment the hand starts,
  // not hidden — only finishHand()/concludeGame() hide the row entirely,
  // once the hand has actually ended.
  $('actions-row').classList.remove('hidden');
  $('actions-row').classList.add('disabled');

  await playShuffle();   // the ritual: deck riffles before every deal
  if (g.over) return;
  // SFX V1 — no blanket "dealing begins" cue here any more; each hole
  // card's own real FWIP (see dealCardFlight) fires moments later and
  // would otherwise double up against it.
  // beginBettingRound flips g.phase off 'setup' *before* the animated reveal
  // renders anything — render() no-ops entirely while phase is still
  // 'setup' (see its guard clause), which otherwise makes the very first
  // hand of a new/resumed table skip the deal animation and pop straight
  // to its final state. Pure phase/turn-order bookkeeping, doesn't touch
  // cards, so reordering it here changes no game state or outcome.
  beginBettingRound('preflop');
  await revealHoleCardsAnimated();   // hands are already fully dealt above; this only animates their reveal
  render();
  continueAction();
}

/* Animates the reveal of hole cards already assigned above, in standard
   round-robin order (one card per active player starting left of the
   dealer, then the second round) — a purely visual reveal sequence layered
   over the real deal, which never changes who holds which card. */
async function revealHoleCardsAnimated(){
  const g = game;
  // Guards the per-card completion callbacks below against a stale
  // continuation from an interrupted/superseded hand (e.g. a rapid-fire
  // forced next-hand mid-flight) marking the WRONG hand's card revealed.
  const handAtDeal = g.handNumber;

  if (motionOff()){
    // No animation to wait for — reveal the human's own cards immediately,
    // same end state as before, just via the explicit reveal flag rather
    // than a hardcoded "always face up" mask.
    g.players.forEach(p=>{ if (p.isHuman && p.inHand) p._holeRevealed = p.hand.map(()=>true); });
    render();
    g._humanCardsVisible=true;
    return;
  }

  render();

  g.players.forEach(p=>{
    if (!p.inHand) return;
    const e = seatEls[p.id];
    if (!e) return;
    Array.from(e.cardsContainer.children).forEach(el=>{ el.style.opacity = '0'; });
  });

  const order = [];
  let idx = nextActiveIndex(g.dealerIndex);
  const first = idx;
  do { order.push(idx); idx = nextActiveIndex(idx); } while (idx !== first);

  // Each card keeps its exact existing flick (DEAL_TIMING.dealMs) — only
  // the RELEASE GAP between cards tightens a little once more than five
  // players are being dealt in, so a 7-handed deal (14 cards) doesn't run
  // ~1.7s longer than the 5-handed one the player already knows. Keyed to
  // how many seats are actually being dealt THIS hand, not the original
  // table size, so a 6-opponent table drifts back to the familiar rhythm
  // as opponents are knocked out. 5-handed and smaller are untouched.
  const dealtSeats = order.length;
  const staggerScale = dealtSeats<=5 ? 1 : dealtSeats===6 ? 0.9 : 0.8;
  const STAGGER = Math.round(DEAL_TIMING.dealStaggerMs * staggerScale * speedMult());
  const pending = [];
  for (let round=0; round<2; round++){
    for (const pIdx of order){
      const p = g.players[pIdx];
      if (!p.inHand || !p.hand[round]) continue;
      const e = seatEls[p.id];
      const el = e && e.cardsContainer.children[round];
      if (el){
        const isHuman = p.isHuman, card = p.hand[round];
        // The human's own cards are dealt genuinely face-down (see the
        // render() mask) and must be told to flip up once they land —
        // opponents/board cards keep relying on dealCardFlight's own
        // wasFaceUp check, unchanged.
        const flight = dealCardFlight(el, card, isHuman ? {revealAfter:true} : undefined).then(()=>{
          if (!isHuman || game!==g || g.handNumber!==handAtDeal) return;
          // Marks the true state immediately (even though turnCard's visual
          // landing completes a beat later on its own timeline) so
          // any render() firing in that gap sees a consistent target and
          // safely no-ops instead of re-triggering a duplicate flip.
          p._holeRevealed[round] = true;
          el.dataset.state = card.rank + card.suit;
        });
        pending.push(flight);
      }
      await sleep(STAGGER);
    }
  }
  await Promise.all(pending);
  g._humanCardsVisible=true;
}

const POSITION_LADDER = ['UTG','UTG+1','MP1','MP2','HJ','CO','BTN'];
function computePositions(){
  const g = game;
  const active = g.players.filter(p=>p.inHand);
  const n = active.length;
  const pos = {};
  if (n < 2) return pos;
  if (n === 2){
    pos[g.players[g.dealerIndex].id] = 'BTN';
    pos[g.players[g.bbIndex].id] = 'BB';
    return pos;
  }
  pos[g.players[g.sbIndex].id] = 'SB';
  pos[g.players[g.bbIndex].id] = 'BB';
  const m = n - 2; // non-blind seats, including the button itself
  const labels = POSITION_LADDER.slice(POSITION_LADDER.length - m);
  let idx = nextActiveIndex(g.bbIndex);
  for (let i=0; i<m; i++){
    pos[g.players[idx].id] = labels[i];
    idx = nextActiveIndex(idx);
  }
  return pos;
}

function assignBlinds(){
  const g = game;
  const n = g.players.filter(p=>p.inHand).length;
  if (n===2){ g.sbIndex = g.dealerIndex; g.bbIndex = nextActiveIndex(g.dealerIndex); }
  else { g.sbIndex = nextActiveIndex(g.dealerIndex); g.bbIndex = nextActiveIndex(g.sbIndex); }
}
function postBlind(p, amount){
  const actual = Math.min(amount, p.chips);
  p.chips -= actual; p.betThisRound += actual; p.totalBetHand += actual; game.pot += actual;
  if (p.chips===0) p.allIn = true;
  // Blinds are posted instantly with no chip-flight animation (unlike a
  // bet — the hand hasn't visually started yet). The pot side is fine:
  // it starts every hand freshly emptied, so render()'s empty-pile-only
  // bootstrap check pops it to match g.pot the moment it next runs. The
  // bank side has no such reset (the pile persists across hands), so
  // without this it would silently keep showing its pre-blind visual
  // chip count for the rest of the hand whenever the human posts one —
  // trim it straight to the new target count instantly instead (no
  // flight, matching how blinds have never animated).
  if (p.isHuman && actual>0){
    const container = $('hud-tower'), pile = bankPile();
    const target = visualChipCount(p.chips);
    while ((container._chipCount||0) > target){ if (!takeChipFromPile(container, pile)) break; }
  }
}

function beginBettingRound(phase){
  const g = game;
  g.phase = phase;
  g.players.forEach(p=>{
    p.acted=false; p.mayRaise=true;
    // Fold/All-In are persistent player states, not street-scoped actions —
    // their action-slot label should keep reading "Fold"/"All-In" for the
    // rest of the hand. Check/Call/Bet/Raise are this-street-only and clear
    // so a new street starts with every active seat back at .act-empty.
    if (p.streetAction && !['fold','allin','ko','eliminated'].includes(p.streetAction.type)) p.streetAction = null;
  });
  if (phase!=='preflop'){ g.currentBet=0; g.minRaise=g.bigBlind; }
  const n = g.players.filter(p=>p.inHand).length;
  g.turnPointer = (phase==='preflop')
    ? (n===2 ? g.dealerIndex : nextActiveIndex(g.bbIndex))
    : (n===2 ? g.bbIndex : nextActiveIndex(g.dealerIndex));
}

function isBettingRoundComplete(){
  const g = game;
  const contenders = g.players.filter(p=>p.inHand && !p.folded);
  if (contenders.length<=1) return true;
  const needToAct = contenders.filter(p=>!p.allIn);
  if (needToAct.length===0) return true;
  return needToAct.every(p=> p.acted && p.betThisRound===g.currentBet);
}

async function dealCommunity(n){
  const g = game;
  const cards = [];
  const pending = [];
  const batch = n > 1;   // flop: deal all three as backs, then flip together
  for (let i=0;i<n;i++){
    const card = g.deck.pop();
    g.board.push(card);
    cards.push(card);
    // SFX V1 — the per-card FWIP/PAP/FWAP family now lives inside
    // dealCardFlight()/turnCard() themselves (real deal/land/flip
    // events), so there's no separate blanket deal cue needed here any
    // more — the old Sound.deal() call that used to sit here would just
    // double up against the very next thing that happens.
    render();
    const el = $('board').lastElementChild;
    if (el) pending.push(dealCardFlight(el, card, { deferFlip: batch, board: true }));
    if (motionOff()) await sleep(60);
    else if (i < n-1) await sleep(Math.round(DEAL_TIMING.flopStaggerMs * speedMult()));
  }
  await Promise.all(pending);
  if (batch && !motionOff()){
    const boardEls = Array.from($('board').children).slice(-n);
    const turns=[];
    for (let i=0;i<boardEls.length;i++){
      turns.push(turnCard(boardEls[i], false, cards[i], false, 'board'));
      if (i < boardEls.length-1) await sleep(Math.round(50 * speedMult()));
    }
    await Promise.all(turns);
  }
}

async function playShuffle(){
  // Visual shuffle ritual disabled — it doesn't connect to the physical
  // dealer-deck dealing system yet. Actual deck randomisation is unrelated
  // and happens elsewhere in startNewHand(); this only skips the old
  // #shuffle-anim riffle animation. A physical shuffle using the visible
  // deck can replace this later.
  return;
}

/* Between-hand breathing room: results stay on screen for a beat, then the
   next hand deals itself. The Next Hand button remains as a skip. Suspended
   while an overlay is open, and off entirely when hand review is on (that
   text deserves reading time). */
let autoDealT = null;
function scheduleAutoDeal(){
  clearTimeout(autoDealT);
  if (!settings.autoDeal || settings.review) return;
  if (!game || game.over) return;
  const delay = motionOff() ? 500 : Math.round(1800 * speedMult());
  autoDealT = setTimeout(async ()=>{
    if (!game || game.over) return;
    const nh = $('btn-next-hand');
    if (nh.classList.contains('hidden')) return;
    if ($('settings-sheet').classList.contains('open') || $('log-drawer').classList.contains('open')) return;
    nh.classList.add('hidden');
    await muckCards();
    startNewHand();
  }, delay);
}

async function advancePhase(){
  const g = game;
  // Money already flew straight to the pot the instant each bet/call/raise
  // happened (the transferChips call in applyAction) — there is no resting
  // pile to sweep here any more, just the street-scoped bookkeeping reset.
  g.players.forEach(p=>{ p.betThisRound=0; });
  if (g.players.filter(p=>p.inHand && !p.folded).length<=1){ g.phase='foldwin'; return; }

  if (g.phase==='preflop'){ logMsg('Flop', true); await dealCommunity(3); beginBettingRound('flop'); }
  else if (g.phase==='flop'){ logMsg('Turn', true); await dealCommunity(1); beginBettingRound('turn'); }
  else if (g.phase==='turn'){ logMsg('River', true); await dealCommunity(1); beginBettingRound('river'); }
  else if (g.phase==='river'){ g.phase='showdown'; }
}

/* Comma-grouped like every other money readout in the UI (pot-val,
   seat-chips) up to 99,999; past that, abbreviated to "120k" rather than
   producing a label no font tier below could fit without truncating a
   digit — see .action-slot.txt-sz2/.txt-sz3 for the tiers this feeds. */
function fmtActionAmount(n){
  n = Math.round(n);
  if (n < 100000) return n.toLocaleString();
  return Math.round(n/1000).toLocaleString() + 'k';
}

/* QUICK BETS -------------------------------------------------
   Presets select a total wager in the ordinary raise reel; they never act.
   Keeping the definitions and arithmetic here makes the UI a thin caller of
   the same legal min/max model used by the slider and Confirm button. */
const QUICK_BET_PRESET_DEFINITIONS = Object.freeze({
  preflopOpen:Object.freeze([
    Object.freeze({id:'two-bb',label:'2 BB',kind:'wager-multiple',value:2}),
    Object.freeze({id:'two-five-bb',label:'2.5 BB',kind:'wager-multiple',value:2.5}),
    Object.freeze({id:'three-bb',label:'3 BB',kind:'wager-multiple',value:3}),
    Object.freeze({id:'all-in',label:'All-in',kind:'all-in',priority:30})
  ]),
  preflopFacing:Object.freeze([
    Object.freeze({id:'min',label:'Min',kind:'minimum',priority:20}),
    Object.freeze({id:'two-five-x',label:'2.5×',kind:'wager-multiple',value:2.5}),
    Object.freeze({id:'three-x',label:'3×',kind:'wager-multiple',value:3}),
    Object.freeze({id:'all-in',label:'All-in',kind:'all-in',priority:30})
  ]),
  postflopOpen:Object.freeze([
    Object.freeze({id:'third-pot',label:'⅓ Pot',kind:'pot-open',value:1/3}),
    Object.freeze({id:'half-pot',label:'½ Pot',kind:'pot-open',value:1/2}),
    Object.freeze({id:'three-quarter-pot',label:'¾ Pot',kind:'pot-open',value:3/4}),
    Object.freeze({id:'pot',label:'Pot',kind:'pot-open',value:1})
  ]),
  postflopFacing:Object.freeze([
    Object.freeze({id:'min',label:'Min',kind:'minimum',priority:20}),
    Object.freeze({id:'half-pot',label:'½ Pot',kind:'pot-after-call',value:1/2}),
    Object.freeze({id:'pot',label:'Pot',kind:'pot-after-call',value:1}),
    Object.freeze({id:'all-in',label:'All-in',kind:'all-in',priority:30})
  ])
});

function wagerBounds(g,player){
  if (!g || !player) return null;
  const currentBet=Math.max(0,Math.round(Number(g.currentBet)||0));
  const playerBet=Math.max(0,Math.round(Number(player.betThisRound)||0));
  const stack=Math.max(0,Math.round(Number(player.chips)||0));
  const maxTotal=playerBet+stack;
  const fullRaise=Math.max(
    currentBet+Math.max(0,Math.round(Number(g.minRaise)||0)),
    playerBet+Math.max(0,Math.round(Number(g.bigBlind)||0))
  );
  const minTotal=Math.min(maxTotal,fullRaise);
  return {min:minTotal,max:maxTotal,currentBet,playerBet,stack};
}

function quickBetContext(g){
  if (!g || !['preflop','flop','turn','river'].includes(g.phase)) return null;
  const preflop=g.phase==='preflop';
  if (preflop) return g.currentBet>g.bigBlind ? 'preflopFacing' : 'preflopOpen';
  return g.currentBet>0 ? 'postflopFacing' : 'postflopOpen';
}

function quickBetPresetAmount(def,g,bounds){
  const toCall=Math.max(0,bounds.currentBet-bounds.playerBet);
  const pot=Math.max(0,Math.round(Number(g.pot)||0));
  let raw=bounds.min;
  if (def.kind==='all-in') raw=bounds.max;
  else if (def.kind==='wager-multiple') raw=bounds.currentBet*def.value;
  else if (def.kind==='pot-open') raw=bounds.playerBet+pot*def.value;
  else if (def.kind==='pot-after-call') raw=bounds.playerBet+toCall+(pot+toCall)*def.value;
  const rounded=Math.round(raw);
  return Math.max(bounds.min,Math.min(bounds.max,rounded));
}

function quickBetPresets(g,player){
  const bounds=wagerBounds(g,player), context=quickBetContext(g);
  if (!bounds || !context || player.mayRaise===false || player.allIn || player.chips<=0
      || bounds.max<=bounds.currentBet) return [];
  const unique=[];
  QUICK_BET_PRESET_DEFINITIONS[context].forEach(def=>{
    const amount=quickBetPresetAmount(def,g,bounds);
    const existing=unique.findIndex(p=>p.amount===amount);
    const item={id:def.id,label:def.label,amount,context,_priority:def.priority||10};
    if (existing<0) unique.push(item);
    else if (item._priority>unique[existing]._priority) unique[existing]=item;
  });
  if (unique.length===1 && unique[0].amount===bounds.max && bounds.min===bounds.max){
    unique[0]={id:'all-in',label:'All-in',amount:bounds.max,context,_priority:30};
  }
  return unique.map(({id,label,amount,context})=>({id,label,amount,context}));
}
function actionLabel(action, player, amt){
  if (player.allIn) return 'All-In';
  if (action==='fold') return 'Fold';
  if (action==='check') return 'Check';
  if (action==='call') return amt>0 ? 'Call ' + fmtActionAmount(amt) : 'Check';
  if (action==='bet') return 'Bet ' + fmtActionAmount(amt);
  if (action==='raise') return 'Raise to ' + fmtActionAmount(amt);
  return '';
}

function applyAction(player, decision){
  const g = game;
  const toCall = g.currentBet - player.betThisRound;
  let text='', shortAmt=0, action=decision.action;

  function commitTo(targetTotal){
    let need = targetTotal - player.betThisRound;
    if (need >= player.chips) need = player.chips;
    player.chips -= need; player.betThisRound += need; player.totalBetHand += need; g.pot += need;
    if (player.chips===0) player.allIn = true;
    return need;
  }

  /* A raise only reopens the betting when it is a FULL raise. An all-in for
     less than a full raise increases the amount owed but does not give players
     who have already acted the right to re-raise. */
  function settleAggression(prevBet){
    const increment = player.betThisRound - prevBet;
    if (increment <= 0) return;
    const isFullRaise = increment >= g.minRaise;
    g.currentBet = player.betThisRound;
    g.players.forEach(p=>{
      if (p===player || !p.inHand || p.folded || p.allIn) return;
      if (isFullRaise){ p.acted = false; p.mayRaise = true; }
      else if (p.acted){ p.mayRaise = false; }
    });
    if (isFullRaise) g.minRaise = increment;
  }

  if (action==='fold'){
    player.folded = true;
    text = player.name + ' folds';
    // SFX V1 — the human's own fold now sounds via the physical button
    // release (see resolveButtonKind/pressFeedback), not here; AI
    // opponents keep this exact same sound they always had.
    if (!player.isHuman) Sound.fold();
    if (player.isHuman){
      g.humanFoldSnapshot = {
        street: g.phase,
        holeCards: player.hand.slice(),
        opponentsAtFold: g.players.filter(p=>p.inHand && !p.folded && p.id!==player.id).length
      };
    }
  } else if (action==='check'){
    text = player.name + ' checks';
    if (!player.isHuman) Sound.check();
  } else if (action==='call'){
    const amt = commitTo(g.currentBet);
    shortAmt = amt;
    if (amt>0){ text = player.name + ' calls ' + amt; if (!player.isHuman) Sound.chip(); }
    else { action='check'; text = player.name + ' checks'; if (!player.isHuman) Sound.check(); }
  } else if (action==='bet' || action==='raise' || action==='allin'){
    const prevBet = g.currentBet;
    let target;
    if (action==='allin') target = player.betThisRound + player.chips;
    else if (prevBet<=0) target = Math.max(decision.amount, player.betThisRound + g.bigBlind);
    else target = Math.max(decision.amount, prevBet + g.minRaise);
    if (target > player.betThisRound + player.chips) target = player.betThisRound + player.chips;
    commitTo(target);
    settleAggression(prevBet);
    shortAmt = prevBet<=0 ? player.betThisRound : player.betThisRound;
    action = prevBet<=0 ? 'bet' : 'raise';
    const verb = prevBet<=0 ? 'bets' : 'raises to';
    text = player.name + ' ' + verb + ' ' + player.betThisRound + (player.allIn ? ' (all-in)' : '');
    if (!player.isHuman) Sound.chip();
    // SFX V1 — all-in drama. The human's own all-in is already fully
    // covered by the button-release sound above (kind resolves to
    // 'allin' there); this specifically covers AI opponents shoving,
    // which never touches a button at all.
    if (player.allIn && !player.isHuman) Sound.allIn(false);
  }

  player.acted = true;
  if (player.isHuman && player.allIn) g._humanAllIn = true;
  logMsg(text);
  // The banner no longer narrates every action ("Sasha raises to 60") —
  // each seat's fixed action-slot (see render()) now shows that reliably
  // in the same place every time, so the banner stays on short phase/turn
  // framing (updateActionControls()/describeCurrentTurn()) instead of
  // growing to fit a full sentence every time someone acts.
  if (g.handActions){
    g.handActions.push({ id:player.id, name:player.name, street:g.phase, action, amount:player.betThisRound });
  }
  // Facial reaction is driven by visible pot outcomes elsewhere (see
  // reactToWin/reactToLoss at handleFoldWin/handleShowdown), never by
  // the action just taken — a fold/raise/all-in -> fixed-expression
  // mapping here would read as a predictable tell. restingMood() below
  // reads only the player's public-history faceMood, not this action.
  if (!player.isHuman){
    // A fold is public, so it gets its own public-safe reaction (chosen
    // from personality + chance only — see reactToFold). Everything else
    // still resolves to the resting/public-mood face, deliberately with no
    // action -> expression mapping that could read as a hand-strength tell.
    if (action==='fold') reactToFold(player);
    else setMood(player.id, restingMood(player));
    if (player.allIn) maybeTableTalk(player, 'allin');
    else if (action==='raise' || action==='bet') maybeTableTalk(player, 'raise');
  }
  const streetLabel = actionLabel(action, player, shortAmt);
  player.streetAction = { type: player.allIn ? 'allin' : action, label: streetLabel, amount: shortAmt };
  setActionRows(player.name,streetLabel,false);
  flashAction(player.id, streetLabel);
  if (action!=='fold' && action!=='check'){
    if (player.isHuman){
      // Real chips physically leave the bank pile and fly to the pot —
      // the number moved is just the drop in the bank's own approximate
      // visual-chip-count target, never a value-accurate denomination
      // selection. Going to exactly 0 (all-in) naturally drains the
      // whole pile, since the target for a zero bankroll is 0 chips.
      const container = $('hud-tower'), pile = bankPile();
      const n = Math.max(1, (container._chipCount||0) - visualChipCount(player.chips));
      transferChips(n, { container, pile }, { container: $('pot-stacks'), pile: potPile() },
        (s,d)=>{ bankPending+=s; potPending+=d; });
    } else {
      // Opponents have no visible bank pile to draw a real chip from —
      // only the pot side keeps a persistent pile, so a fresh chip is
      // created and flies in from the opponent's seat (see flyChip's
      // srcEl mode). The number flying in is just the pot's own
      // visual-chip-count target growing.
      const potContainer = $('pot-stacks'), pPile = potPile();
      const n = Math.max(1, visualChipCount(g.pot) - (potContainer._chipCount||0));
      const e = seatEls[player.id];
      transferChips(n, { el: (e && e.chips) || (e && e.root) }, { container: potContainer, pile: pPile },
        (s,d)=>{ potPending+=d; });
    }
  }
}

function checkHandEndedByFold(){
  return game.players.filter(p=>p.inHand && !p.folded).length<=1;
}

/* `contributors` is additive and changes nothing about how pots are built
   or awarded — `eligible` is untouched, and every existing caller reads
   only `amount` and `eligible`.

   It exists because the number was already being computed here and then
   thrown away, and without it two completely different facts are
   indistinguishable downstream: a $40 side pot paid into by three players
   and won is OPPONENTS' money genuinely won, while a $1,980 layer only one
   player paid into is that player's OWN unmatched bet coming back. Both
   expose `eligible.length === 1` once everyone else has folded (see
   SCORING_SPEC.md 7.4), so post-hand commentary could not tell them apart
   and had to stay silent about both. */
function computePots(players){
  const contributors = players.filter(p=>p.totalBetHand>0);
  const levels = [...new Set(contributors.map(p=>p.totalBetHand))].sort((a,b)=>a-b);
  const pots = [];
  let prev = 0;
  for (const level of levels){
    const layer = level - prev;
    const payers = contributors.filter(p=>p.totalBetHand >= level);
    const amount = layer * payers.length;
    if (amount>0) pots.push({
      amount,
      contributors: payers.length,
      eligible: payers.filter(p=>!p.folded).map(p=>p.id)
    });
    prev = level;
  }
  return pots;
}

/* Where a contender will actually stand once runShowdownAwardSequence pays
   out — derived ENTIRELY from the awards already resolved above
   (potResults + p._award). It recomputes no pot maths and mutates nothing;
   it only reads what the payout is going to do.

   This exists because `p.chips <= 0` at winner-declaration time is NOT
   evidence of elimination. Committed chips have been deducted by then, but
   nothing has been paid back yet — including the single-eligible pot layer
   computePots() builds for an uncalled all-in. A player can sit at $0,
   lose the contested pot, and still be handed their unmatched bet straight
   back, surviving the hand.

   `contested` distinguishes the two: a layer contested by 2+ players is a
   real win, a layer with one eligible player is that player's own money
   being returned. Winning only the latter is a LOSS that happens to come
   with change. */
function projectedSettlement(p, potResults){
  const rows = Array.isArray(potResults)
    ? potResults.filter(r=>Array.isArray(r.winnerIds) && r.winnerIds.includes(p.id))
    : [];
  const shareOf = r=>{
    const s = (r.winnerShares||[]).find(w=>w.id===p.id);
    return s ? (s.amount||0) : 0;
  };
  const contestedRows = rows.filter(r=>r.contested > 1);
  const contestedAward = contestedRows.reduce((sum,r)=>sum+shareOf(r), 0);
  const uncalledReturn = rows.filter(r=>r.contested <= 1).reduce((sum,r)=>sum+shareOf(r), 0);
  const projected = (p.chips||0) + (p._award||0);
  // Without usable award data we cannot prove elimination, so we decline to
  // claim it: the caller falls back to a strong all-in loss and lets
  // resolveEliminations() confirm the real outcome after settlement.
  const resolvable = Array.isArray(potResults) && potResults.length > 0;
  return {
    wonContested: contestedRows.length > 0,
    contestedAward, uncalledReturn, projected, resolvable,
    busted: resolvable && projected <= 0
  };
}

/* Result-banner grammar is a tiny rule, but keeping it named makes both
   branches independently testable: the human is second person (YOU WIN),
   while named opponents remain third person (WILDCARD WINS). */
function showdownPotVerb(result){
  if (result && result.split) return 'split';
  const ids = result && Array.isArray(result.winnerIds) ? result.winnerIds : [];
  return ids.length === 1 && ids[0] === 'you' ? 'win' : 'wins';
}

async function handleFoldWin(){
  const g = game;
  // Back to normal speed before a single frame of result presentation —
  // the banner, sting, award console, chip payout and everything after it
  // run at their real production timing. See QUICK RESOLVE above.
  endQuickResolve();
  const winner = g.players.find(p=>p.inHand && !p.folded);
  const amt = g.pot;
  // most fold-wins reach here directly (checkHandEndedByFold in the main
  // loop), bypassing advancePhase() entirely — betThisRound still needs
  // its street-scoped reset here even though there's no pile to sweep.
  g.players.forEach(p=>{ p.betThisRound=0; });
  // Showdown cleanup, pass 2 — see the matching block in handleShowdown();
  // same rule, so the winner's own last Call/Bet/Raise label doesn't
  // linger through the pot-taking beat below. Fold labels (the reason the
  // hand ended) are exactly what should stay visible here.
  g.players.forEach(p=>{
    if (p.streetAction && !['fold','allin','ko','eliminated'].includes(p.streetAction.type)) p.streetAction = null;
  });
  // recordPot() used to bank the whole table pot into stats.biggestPot
  // from here (D13). Lifetime statistics are now written once, in
  // finishHand(), from the settled net result — see recordHandStatistics().
  // Same person agreement as the showdown banner below: "You take", not
  // "You takes"; named opponents keep "takes".
  setBanner('<b>' + esc(winner.name) + '</b> ' + (winner.isHuman ? 'take' : 'takes') + ' the pot…');
  render();
  await sleep(motionOff() ? 80 : 250);
  if (winner.isHuman){ Sound.resultSting('humanWin'); haptic(30); }
  else {
    reactToWin(winner, amt / g.bigBlind);
    if (amt > 10*g.bigBlind) nudgeMood(winner, 'up', 0.5);
    maybeTableTalk(winner, 'win');
    // A fold-win is still a genuine "an opponent won" moment — short and
    // restrained; the human wasn't beaten at showdown here (they may not
    // even have been in the pot), so this is never the humanLose flavor.
    Sound.resultSting('opponentWin');
  }
  logMsg(winner.name + ' wins ' + amt + ' (everyone else folded)');

  // No showdown occurred, so there's no evaluated hand/winning-five to show
  // or highlight — hand/cat/cards stay null and runShowdownAwardSequence's
  // plaque skips those parts of the display accordingly. Money mutation
  // and the visual payout both now happen inside that shared sequence,
  // gated behind the player's own AWARD POT press.
  // A fold-win collapses every layer into one row, so this row's own
  // `contributors` would be meaningless. Post-hand commentary reads the
  // real layering from computePots() directly in this case (the winner
  // takes every layer by definition), which is why it is left null here
  // rather than guessed at.
  const potResults = [{
    label:'Pot', amount:amt, winners:[winner.name], winnerIds:[winner.id],
    eligible:[winner.id],
    winnerShares:[{name:winner.name, id:winner.id, amount:amt}],
    hand:null, cat:null, cards:null, contested:1, contributors:null, split:false
  }];
  await runShowdownAwardSequence(potResults, []);
}

async function handleShowdown(){
  const g = game;
  // Normal speed from here on: the staged reveal below IS the payoff.
  endQuickResolve();
  // Defensive: inHand/folded should already exclude an eliminated player
  // from ever reaching here (see resolveEliminations/startNewHand), but
  // showdown eligibility is the one place a missed elimination would do
  // real damage (an eliminated seat winning a pot) — the explicit
  // !p.eliminated guard costs nothing and makes that impossible.
  const contenders = g.players.filter(p=>p.inHand && !p.folded && !p.eliminated);
  const pots = computePots(g.players);

  // Showdown cleanup, pass 2 — this street's Check/Call/Bet/Raise labels
  // are done informing anything once betting has ended; leaving them up
  // through the reveal/plaque/payout sequence made the table look like
  // betting was still happening. Fold/All-In are real persistent state,
  // not street-scoped, so they're deliberately left alone here — same
  // rule beginBettingRound() already applies at the start of every new
  // street (see there), just run here too since showdown never starts one.
  g.players.forEach(p=>{
    if (p.streetAction && !['fold','allin','ko','eliminated'].includes(p.streetAction.type)) p.streetAction = null;
  });

  // evaluate everyone's final hand up front so the reveal order can build
  // suspense — evaluate7WithCards (not the cardless evaluate7) so the exact
  // 5-of-7 winning combo is available everywhere _handRes is, for every
  // pot's highlighting/panel, not just recomputed ad hoc for the top pot.
  contenders.forEach(p=>{ p._handRes = evaluate7WithCards([...p.hand, ...g.board]); });

  if (contenders.length>1){
    setBanner('Revealing hands…');
    Sound.showdownBegin(); // "pay attention — we're showing the hands." Then the per-card FWAP flips (below) take over.
    render();
    await (motionOff() ? sleep(70) : pacedSleep(220));
    const revealOrder = contenders.filter(p=>!p.isHuman)
      .sort((a,b)=>compareHands(a._handRes.result, b._handRes.result)); // weakest first, winner lands last
    for (const p of revealOrder){
      p._reveal = true;
      // SFX V1 — no separate cue here any more: render() below drives
      // syncCardRow → turnCard for each of this player's real cards,
      // which now plays its own FWAP exactly at the true reveal moment
      // (see turnCard). That naturally reproduces "FWAP … beat … FWAP"
      // across this loop's own existing per-player sleep, with no new
      // timing sequence invented for sound.
      render();
      await (motionOff() ? sleep(110) : pacedSleep(560));
    }
    // the dramatic beat between the last reveal and the winner being
    // announced/highlighted — long enough to actually register who showed
    // what before the result lands.
    await (motionOff() ? sleep(90) : pacedSleep(520));
  }

  const potResults = [];
  const winnerIds = new Set();
  pots.forEach((pot, i)=>{
    const eligible = pot.eligible.map(id=>g.players.find(p=>p.id===id));
    if (!eligible.length) return;
    let best=null, winners=[];
    for (const p of eligible){
      const res = p._handRes || evaluate7WithCards([...p.hand, ...g.board]);
      p._handRes = res;
      if (!best || compareHands(res.result,best.result)>0){ best=res; winners=[p]; }
      else if (compareHands(res.result,best.result)===0) winners.push(p);
    }
    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share*winners.length;
    const winnerShares = winners.map((w,k)=>{
      const amt = share + (k<remainder?1:0);
      w._award = (w._award||0) + amt; // read by the mood-swing check below; actual chip mutation happens in runShowdownAwardSequence
      winnerIds.add(w.id);
      return { name:w.name, id:w.id, amount:amt };
    });
    potResults.push({
      label: pots.length===1 ? 'Pot' : (i===0 ? 'Main pot' : 'Side pot ' + i),
      amount: pot.amount,
      winners: winners.map(w=>w.name),
      winnerIds: winners.map(w=>w.id),
      // Every contender id this specific pot layer was contested among —
      // preserved (not just its .length, kept separately as `contested`
      // below) so elimination mode can find, per busted player, the exact
      // pot layer built from their own final committed chips (see
      // resolveEliminations). Plain id array, not a Set — small and JSON-safe.
      eligible: pot.eligible,
      winnerShares,
      hand: describeMade(best.result),
      cat: best.result.cat,
      cards: best.cards,
      contested: eligible.length,
      // The count of players who PAID INTO this layer, from computePots().
      // Distinct from `contested`/`eligible`, which count who could still
      // WIN it — see computePots() for why the difference matters.
      contributors: pot.contributors,
      split: winners.length > 1
    });
  });

  // Showdown result console, pass 4 — the seat-emphasis class-add that
  // used to happen right here now happens inside runShowdownAwardSequence
  // (see celebrateWinnerSeat), timed AFTER highlightWinningCards rather
  // than immediately after potResults is built — so cards react first,
  // then the seat, matching the intended rhythm.

  // Showdown cleanup, pass 2 — 'Revealing hands…' has done its job; once
  // the winner is actually known, the banner should say so instead of
  // sitting stale through the whole plaque/AWARD POT/payout sequence.
  const mainResult = potResults[0];
  // "You wins the pot" — the human's seat name is second person, so it
  // needs the second-person verb. Named opponents are third person and
  // keep "wins" ("Wildcard wins the pot"). A split reads the same either
  // way, so only the singular verb is person-dependent.
  const winnerNames = mainResult.winners.join(' & ');
  const winVerb = showdownPotVerb(mainResult);
  setBanner('<b>' + esc(winnerNames) + '</b> ' + winVerb + ' the pot.');

  // faces react to the result — and big swings leave a lingering mood
  const bbv = g.bigBlind;
  contenders.forEach(p=>{
    if (p.isHuman) return;
    const won = winnerIds.has(p.id);
    const swing = p._award || 0;
    const lost = p.totalBetHand || 0;
    const strong = p._handRes && p._handRes.result.cat >= 2;   // two pair or better, and it still lost — public by now, showdown reveals hands
    const stung = lost > 10*bbv || lost > (p.chips + lost)*0.3;

    // GAMEPLAY mood (moodState — read by aiDecide) is deliberately left
    // exactly as it was, still keyed on plain `won`. The settlement
    // projection below steers the PORTRAIT only, so nothing here can shift
    // an AI's aggression or tightness.
    if (won){
      if (swing > 12*bbv) nudgeMood(p, 'up', Math.min(1, swing/(30*bbv) + 0.4));
    } else if (stung){
      nudgeMood(p, strong ? 'steamed' : 'down', strong ? 0.8 : 0.6);
    }

    // PRESENTATION reaction, from the projected post-settlement position.
    const settle = projectedSettlement(p, potResults);
    if (settle.wonContested){
      reactToWin(p, settle.contestedAward / bbv);
    } else {
      // Visible reaction takes only public quantities (loss in BB, and
      // whether it stung relative to their own stack). Whether this is a
      // genuine repeat — and so deserves a deepening beat — is decided
      // inside reactToLoss from faceMood, not from `strong` above: `strong`
      // is a hand-strength read and must never steer a portrait, even
      // though the cards are already face-up by this point.
      reactToLoss(p, lost / bbv, stung, {
        busted: settle.busted,
        // Shoved and lost the contested pot. Still a strong beat even when
        // an uncalled return keeps them alive — and the honest reaction
        // when award data is missing and elimination cannot be proven.
        allInLoss: settle.uncalledReturn > 0 || (p.chips <= 0 && !settle.resolvable)
      });
    }
    maybeTableTalk(p, won ? 'win' : 'lose');
  });

  // Hand-history log entries are pure record-keeping — write them now,
  // rather than deferring them into the player-paced award loop below.
  potResults.forEach(r=>{
    if (r.split){
      logMsg(r.winnerShares.map(s=>s.name+' '+s.amount).join(' / ') + ' split ' + r.label.toLowerCase() + ' (' + r.amount.toLocaleString() + ') with ' + r.hand);
    } else {
      logMsg(r.winners.join(' & ') + ' win ' + r.label.toLowerCase() + ' ' + r.amount.toLocaleString() + ' with ' + r.hand);
    }
  });
  if (winnerIds.has('you')){
    // Presentation only. Winning A LAYER is not the same as finishing the
    // hand ahead, so stats.won/showdownsWon are no longer written here —
    // see recordHandStatistics() in finishHand(). The sting is correct
    // either way: the player did just take a pot on screen.
    Sound.resultSting('humanWin');
    haptic(30);
  } else if (contenders.length>1){
    // ONE coordinated sting for "an opponent won this showdown" — never
    // a separate opponent-win sound stacked on top of a separate human-
    // loss sound. humanLose only when the human was actually a
    // contender who lost (not just an onlooker who folded earlier).
    const humanLost = contenders.some(p=>p.isHuman);
    Sound.resultSting(humanLost ? 'humanLose' : 'opponentWin');
  }

  // Pass 1 showdown revamp: reveal → per-pot highlight → winner panel →
  // player-controlled AWARD POT → existing payout animation, sequenced
  // once per pot (main pot first, side pots after). See
  // runShowdownAwardSequence — chip mutation, the visual payout, and the
  // finishHand()/busted-state call all now live there instead of here.
  await runShowdownAwardSequence(potResults, contenders);
}

/* Presentation-only: within an already-determined winning five (cards,
   the exact combo evaluate7WithCards picked), which of those five FORM
   the named made hand versus which are plain kickers — and, for a full
   house specifically, whether the trips should read as slightly more
   load-bearing than the pair. Driven entirely by the existing cat/
   tiebreak data (see evaluate5's tiebreak shapes — t[0]/t[1] are rank
   VALUES for the grouped categories) and card.value; no new evaluation,
   no re-deriving the winning five. Returns two Sets of cardKeys: `strong`
   (the made-hand cards — everything for a straight/flush/straight
   flush/full house, just the matching-rank group for pair/two pair/
   trips/quads, just the single highest card for high card) and `hero`
   (full house's trips only, a strict subset of `strong`, empty
   otherwise). Cards in `cards` not present in `strong` are kickers and
   stay at the base .win-card tier — still part of the winning five, just
   not what's being called out as "why you won." */
function strongWinningCardKeys(cat, tiebreak, cards){
  const strong = new Set(), hero = new Set();
  if (cat===4 || cat===5 || cat===8 || cat===9){
    // straight / flush / straight flush / royal flush: read together, no kicker
    cards.forEach(c=>strong.add(cardKey(c)));
  } else if (cat===6){
    // full house: all five strong; trips allowed a touch more emphasis
    const tripsVal = tiebreak[0], pairVal = tiebreak[1];
    cards.forEach(c=>{
      strong.add(cardKey(c));
      if (c.value===tripsVal) hero.add(cardKey(c));
    });
  } else if (cat===7 || cat===3 || cat===1){
    // quads / trips / pair: the matching-rank group is strong, kickers stay base
    const groupVal = tiebreak[0];
    cards.forEach(c=>{ if (c.value===groupVal) strong.add(cardKey(c)); });
  } else if (cat===2){
    // two pair: both pairs strong, the single kicker stays base
    const p1 = tiebreak[0], p2 = tiebreak[1];
    cards.forEach(c=>{ if (c.value===p1 || c.value===p2) strong.add(cardKey(c)); });
  } else {
    // high card (cat 0): just the single highest card
    let top = null;
    cards.forEach(c=>{ if (!top || c.value>top.value) top = c; });
    if (top) strong.add(cardKey(top));
  }
  return { strong, hero };
}

/* Marks the cards that actually made the winning hand(s) of ONE pot with a
   gold glow, and dims every card that didn't contribute — including the
   losers'. Showdown revamp, pass 3: called exactly ONCE per hand by
   runShowdownAwardSequence, against the MAIN pot only — a side-pot winner
   who differs from the main pot's winner is deliberately left dimmed here
   like everyone else (they're a "loser" of the highlight's own pot) and
   communicated instead via the award plaque's muted secondary line plus
   the existing .seat.winner seat-level accent, so there's never more than
   one hero five-card glow competing for attention on the table at once.
   Reuses each player's own p._handRes.cards (already the exact
   best-5-of-7 combo, computed once up front in handleShowdown) rather
   than re-deriving it here — one evaluation path, not two. Within that
   winning five, a second tier (see strongWinningCardKeys) calls out
   specifically the cards forming the named made hand — pure presentation
   layered on top, same source data. */
function highlightWinningCards(pot, contenders){
  const g = game;
  const boardUsed = new Set(), boardStrong = new Set(), boardHero = new Set();
  const holeUsedByPlayer = {}, holeStrongByPlayer = {}, holeHeroByPlayer = {};
  pot.winnerIds.forEach(id=>{
    const p = g.players.find(x=>x.id===id);
    if (!p || !p._handRes) return;
    const usedKeys = new Set(p._handRes.cards.map(cardKey));
    holeUsedByPlayer[id] = p.hand.filter(c=>usedKeys.has(cardKey(c))).map(cardKey);
    g.board.forEach(c=>{ if (usedKeys.has(cardKey(c))) boardUsed.add(cardKey(c)); });

    const { strong, hero } = strongWinningCardKeys(p._handRes.result.cat, p._handRes.result.tiebreak, p._handRes.cards);
    holeStrongByPlayer[id] = p.hand.filter(c=>strong.has(cardKey(c))).map(cardKey);
    holeHeroByPlayer[id] = p.hand.filter(c=>hero.has(cardKey(c))).map(cardKey);
    g.board.forEach(c=>{
      const key = cardKey(c);
      if (strong.has(key)) boardStrong.add(key);
      if (hero.has(key)) boardHero.add(key);
    });
  });

  const boardEls = $('board') ? $('board').children : [];
  Array.from(boardEls).forEach((el,i)=>{
    const c = g.board[i];
    if (!c) return;
    const key = cardKey(c);
    const used = boardUsed.has(key);
    el.classList.toggle('win-card', used);
    el.classList.toggle('dim-card', !used);
    el.classList.toggle('win-card-strong', used && boardStrong.has(key));
    el.classList.toggle('win-card-hero', used && boardHero.has(key));
  });

  contenders.forEach(p=>{
    const e = seatEls[p.id];
    if (!e) return;
    const isWinner = pot.winnerIds.indexOf(p.id) !== -1;
    Array.from(e.cardsContainer.children).forEach((el,i)=>{
      const c = p.hand[i];
      if (!c) return;
      if (isWinner){
        const key = cardKey(c);
        const used = (holeUsedByPlayer[p.id]||[]).indexOf(key) !== -1;
        el.classList.toggle('win-card', used);
        el.classList.toggle('dim-card', !used);
        el.classList.toggle('win-card-strong', used && (holeStrongByPlayer[p.id]||[]).indexOf(key)!==-1);
        el.classList.toggle('win-card-hero', used && (holeHeroByPlayer[p.id]||[]).indexOf(key)!==-1);
      } else {
        el.classList.add('dim-card');
        el.classList.remove('win-card-strong', 'win-card-hero');
      }
    });
  });
}

/* Showdown result console — the winning SEAT is the "who won" signal, not
   a duplicated portrait. Called once per pot winner, right after
   highlightWinningCards() so the eye lands on the cards first, then the
   seat reacts — see runShowdownAwardSequence. Opponents get a brief
   punch/pop plus a finite rim-pulse layered on their existing static
   .seat.winner glow (their seat IS their celebration). The human is
   deliberately bigger: .seat.you has no visible .seat-card/.avatar to
   glow, and per explicit approval a win at the player's own table should
   feel noticeably better than watching an opponent win — so instead the
   existing #hud-frame housing itself gets a short mechanical shake plus a
   stepped rim-flash (see .hud-frame-win/.hud-frame-win-flash), right
   before it transforms into the result console. No new element/portrait
   either way — only classes on DOM that already exists. */
function celebrateWinnerSeat(id){
  const e = seatEls[id];
  if (!e) return;
  e.root.classList.add('winner');

  if (id === 'you'){
    const frame = $('hud-frame');
    if (frame && !motionOff()){
      frame.classList.remove('hud-frame-win', 'hud-frame-win-flash');
      void frame.offsetWidth;
      frame.classList.add('hud-frame-win', 'hud-frame-win-flash');
    }
    return;
  }

  const box = e.root.querySelector('.seat-card') || e.root;
  box.classList.remove('winner-pop'); void box.offsetWidth; box.classList.add('winner-pop');
  e.root.classList.remove('winner-pulse'); void e.root.offsetWidth; e.root.classList.add('winner-pulse');
}

function copyTrackedHand(handRes){
  if (!handRes || !handRes.result || !Array.isArray(handRes.cards)) return null;
  return {
    result:{ cat:handRes.result.cat, tiebreak:handRes.result.tiebreak.slice() },
    name:describeMade(handRes.result),
    cards:handRes.cards.map(c=>({rank:c.rank,suit:c.suit,value:c.value}))
  };
}
function updateTrackedBest(run,key,handRes){
  const candidate = copyTrackedHand(handRes);
  if (!candidate) return;
  const current = run[key];
  if (!current || compareHands(candidate.result,current.result)>0) run[key]=candidate;
}
function humanWonOutcome(outcome){
  if (!outcome) return false;
  if (outcome.type==='showdown') return !!(outcome.winnerIds && outcome.winnerIds.has('you'));
  return !!(outcome.type==='foldwin' && outcome.winner && outcome.winner.id==='you');
}
function humanAwardFromOutcome(outcome){
  if (!outcome || outcome.type!=='showdown' || !Array.isArray(outcome.potResults)){
    return outcome && outcome.type==='foldwin' && outcome.winner && outcome.winner.id==='you' ? (outcome.amount||0) : 0;
  }
  return outcome.potResults.reduce((sum,pot)=>sum + (pot.winnerShares||[])
    .filter(s=>s.id==='you').reduce((n,s)=>n+s.amount,0),0);
}
function captureHumanBuster(g,outcome){
  if (!outcome || outcome.type!=='showdown' || !Array.isArray(outcome.potResults)) return;
  let decisivePot=null;
  outcome.potResults.forEach(pot=>{ if (pot.eligible && pot.eligible.includes('you')) decisivePot=pot; });
  if (!decisivePot) return;
  const ids=decisivePot.winnerIds.filter(id=>id!=='you');
  if (!ids.length) return;
  const names=ids.map(id=>{ const p=g.players.find(x=>x.id===id); return p ? p.name : id; });
  g.run.bustedBy={ names, hand:decisivePot.hand||'' };
}
/* `netProfit` is the SETTLED result of the hand (human.chips - g._humanStart),
   passed in by finishHand() rather than recomputed, so every "won" counter
   below means the same thing the lifetime statistics mean (SCORING_SPEC.md
   5.1): the player finished the hand AHEAD. Winning a pot layer is not
   enough — an exact chop nets zero and a net-losing side-pot share nets
   below zero, and neither is a win. */
function trackEliminationHand(g,outcome,human,netProfit){
  const run=g.run;
  if (!run || !run.active) return;
  const won=netProfit>0;
  run.totalHands++; run.tableHands++;
  if (won){ run.totalHandsWon++; run.tableHandsWon++; }

  const humanContender=outcome && outcome.type==='showdown' && Array.isArray(outcome.contenders) &&
    outcome.contenders.some(p=>p.id==='you');
  if (humanContender){
    run.showdownsPlayed++; run.tableShowdownsPlayed++;
    if (won){ run.showdownsWon++; run.tableShowdownsWon++; }
    const handRes=human._handRes;
    updateTrackedBest(run,'bestHand',handRes);
    updateTrackedBest(run,'tableBestHand',handRes);
  }
  if (g._humanAllIn){
    run.allInsPlayed++; run.tableAllInsPlayed++;
    if (won){ run.allInsWon++; run.tableAllInsWon++; }
  }
  // BIGGEST NET WIN, not the gross share (defect D14). humanAwardFromOutcome()
  // counts every layer paid to the player INCLUDING an uncalled bet coming
  // straight back, so fixture F19 recorded 1,120 for a hand that made 120.
  run.biggestPotWon=Math.max(run.biggestPotWon,netProfit);
  run.tableBiggestPotWon=Math.max(run.tableBiggestPotWon,netProfit);
  run.highestStack=Math.max(run.highestStack,human.chips);
  run.tableHighestStack=Math.max(run.tableHighestStack,human.chips);
  if (human.chips<=0) captureHumanBuster(g,outcome);
}

/* The ONE writer of the settled lifetime statistics (SCORING_SPEC.md 5.1),
   called once per hand from finishHand() after the payout has landed.

   It replaced recordPot(), which banked the WHOLE TABLE POT into
   stats.biggestPot from inside handleShowdown()/handleFoldWin() (defect
   D13: 2,030 recorded on a hand that netted 30), alongside two
   stats.won/showdownsWon increments that fired on winning any pot layer
   at all — including an exact chop and a net-losing side-pot share.

   `won` is net-ahead, so stats.biggestPot now means "the player's largest
   NET PROFIT on a single hand". No stored value is rewritten: the rule
   applies from here forward only, exactly as SCORING_SPEC.md 8 records. */
function recordHandStatistics(g,outcome,netProfit){
  if (netProfit>0){
    stats.won++;
    const humanContended = outcome && outcome.type==='showdown' &&
      Array.isArray(outcome.contenders) && outcome.contenders.some(p=>p.isHuman);
    if (humanContended) stats.showdownsWon++;
    if (netProfit > stats.biggestPot) stats.biggestPot = netProfit;
  }
}

async function finishHand(outcome){
  const g = game;
  recordGameplayHandMetric(g);
  // In a Single Player run the physical controls remain in their bay and
  // visibly lose power while the payout/K.O. sequence resolves. Other
  // modes keep their existing between-hand behaviour.
  if ((g.mode==='elimination' && g.run && g.run.active) || g.mode==='career' || g.mode==='career-cash'){
    $('actions-row').classList.remove('hidden');
    $('actions-row').classList.add('disabled');
  } else $('actions-row').classList.add('hidden');
  closeRaisePanel();
  clearHumanReadouts();
  showReview(outcome);

  stats.hands++;
  const human = g.players.find(p=>p.id==='you');
  // The settled result of this hand, read once, after the payout has been
  // credited. Everything below that says "won" means this being positive.
  const netProfit = human.chips - (g._humanStart != null ? g._humanStart : human.chips);
  recordHandStatistics(g,outcome,netProfit);
  if (g.mode==='elimination') trackEliminationHand(g,outcome,human,netProfit);
  // Career table chips are not a Single Player session net, and this is an
  // assignment rather than an accumulation — letting a Career hand through
  // would overwrite the player's real figure. The lifetime counters above
  // stay mode-blind: a Career hand genuinely is a hand played.
  if (g.mode !== 'career' && g.mode !== 'career-cash') stats.net = human.chips - g.buyIns;
  saveStats();
  renderStats();

  // The one post-hand commentary line, if this hand earned one. Set by the
  // late scoring pass below and painted at the "Hand complete." beat —
  // the CRT action line is the default commentary surface
  // (SCORING_SPEC.md 3.5). Every terminal branch returns before that beat,
  // so terminal suppression is structural rather than a second check.
  let handCommentary = null;

  const delta = netProfit;
  if (delta > g.sess.bestWin) g.sess.bestWin = delta;
  if (delta < g.sess.worstLoss) g.sess.worstLoss = delta;

  if (g.mode === 'career-cash'){
    // Residents have finite table-session funds. A rebuy is always one full
    // $50 stack, debited from that resident's own reserve; a short or unknown
    // reserve is never rounded up or inferred.
    g.players.forEach(p=>{
      if (p.isHuman || p.eliminated || p.chips>0) return;
      if (Number.isSafeInteger(p.cashReserve) && p.cashReserve >= CAREER_CASH_CONFIG.stack){
        p.cashReserve -= CAREER_CASH_CONFIG.stack;
        p.chips = CAREER_CASH_CONFIG.stack;
        p.inHand = true;
        logMsg(p.name + ' rebuys for $' + CAREER_CASH_CONFIG.stack, true);
      } else {
        p.eliminated = true;
        p.inHand = false;
        logMsg(p.name + ' leaves the cash table', true);
      }
    });
    if (human.chips<=0){ endCareerCashSession(g,'bust'); return; }
    const seated = g.players.filter(p=>p.chips>0 && !p.eliminated).length;
    if (seated < 3){ endCareerCashSession(g,'table-close'); return; }
  } else if (g.mode === 'tournament'){
    const alive = g.players.filter(p=>p.chips>0 && !p.eliminated);
    g.players.forEach(p=>{ if (p.chips<=0) p.eliminated = true; });
    if (human.chips<=0){
      recordGameplayConclusion(g,'bust');
      const place = alive.length + 1;
      setBanner('Knocked out in <b>' + ordinal(place) + '</b> place.');
      Sound.busted(true);
      $('btn-new-table').classList.remove('hidden');
      g.over = true; clearTableSave(); render(); return;
    }
    if (alive.length<=1){
      recordGameplayConclusion(g,'win');
      setBanner('<b>Tournament won.</b> Every opponent is out.');
      $('btn-new-table').classList.remove('hidden');
      g.over = true; clearTableSave(); render(); return;
    }
  } else if (g.mode === 'elimination'){
    // No rebuys: resolveEliminations() marks anyone at $0 permanently
    // eliminated and plays their K.O.!/ELIMINATED! sequence for real,
    // in full, before we check either end condition below — so the
    // final human K.O. always gets to finish its whole payoff before
    // TABLE CLEARED can appear (see the Phase 1 plan §13).
    const eliminationResult=await resolveEliminations(g, outcome);
    // Post-elimination invariant/recovery pass — see
    // recoverMissedEliminations() below. Runs immediately after the
    // primary pass, still within this same hand's finishHand() call, so
    // `outcome` (potResults/winnerIds) is still available for correct KO
    // attribution if it ever actually finds anyone. Every downstream
    // read of `eliminated` this hand (aiRemaining right below, the
    // table-clear check, next hand's dealing) sees the fully-corrected
    // state either way.
    const recoveredResult = await recoverMissedEliminations(g, outcome);
    const koCount = (eliminationResult?eliminationResult.koCount:0) + (recoveredResult?recoveredResult.koCount:0);
    const aiRemaining = g.players.filter(p=>!p.isHuman && !p.eliminated);
    // TERMINALITY IS DECIDED BEFORE ANYTHING IS PRESENTED (SCORING_SPEC.md 4).
    // This used to be read AFTER the award carousel had already been
    // awaited, which is how a hand that busted the player could present a
    // full-screen celebratory award, with sound and a score roll, in the
    // gap before RUN OVER. The points are still detected and still banked
    // — resolveArcadeHandLate() mutates the score either way — only the
    // ceremony is suppressed.
    const terminal = human.chips<=0 || aiRemaining.length===0;
    const resolved = await resolveArcadeHandLate(g,outcome,{
      koCount,
      tableClear:human.chips>0&&aiRemaining.length===0
    },terminal);
    // PRIORITY 1 (SCORING_SPEC.md 3.4). arcadeCommentaryText() owns the
    // rule; every terminal branch below also returns before the
    // "Hand complete." beat, so suppression is structural as well as stated.
    handCommentary = arcadeCommentaryText(resolved, g, { terminal, terminalBust:human.chips<=0 });
    if (human.chips<=0){ showBusted(g, human); return; }
    if (aiRemaining.length===0){
      await sleep(motionOff() ? 0 : ELIMINATION_CONFIG.clearedBeatMs);
      concludeGame();
      return;
    }
  } else if (g.mode === 'career'){
    // A Career event is a freezeout, so it uses the same no-rebuy K.O.
    // lifecycle as elimination — the ceremony is reached through
    // resolveEliminations() exactly as it is there. What it does NOT reuse
    // is the run: no g.run, no table counters, no arcade persistence.
    const eliminationResult = await resolveEliminations(g, outcome);
    const recoveredResult = await recoverMissedEliminations(g, outcome);
    const koCount = (eliminationResult?eliminationResult.koCount:0) + (recoveredResult?recoveredResult.koCount:0);
    const aiRemaining = g.players.filter(p=>!p.isHuman && !p.eliminated);
    // Same rule as elimination above: a hand that ends the event banks its
    // points and presents nothing, so EVENT WON / EVENT LOST is never
    // preceded by a carousel.
    const terminal = human.chips<=0 || aiRemaining.length===0;
    const resolved = await resolveArcadeHandLate(g,outcome,{
      koCount,
      tableClear: human.chips>0 && aiRemaining.length===0
    },terminal);
    handCommentary = arcadeCommentaryText(resolved, g, { terminal, terminalBust:human.chips<=0 });
    // finishHand owns terminal settlement. endCareerEvent() is guarded and
    // is the ONLY function permitted to start result presentation. The
    // placement is measured from the table (careerFinishPlace), never
    // inferred from a win/loss value — a paid second place depends on it.
    if (human.chips<=0){ endCareerEvent(g,{place:careerFinishPlace(g,human)}); return; }
    if (aiRemaining.length===0){
      await sleep(motionOff() ? 0 : ELIMINATION_CONFIG.clearedBeatMs);
      endCareerEvent(g,{place:careerFinishPlace(g,human)});
      return;
    }
    if (shouldPresentChampionshipFinalTable(g, aiRemaining.length + 1)){
      g.championshipFinalTableReached = true;
      g._safeSave = serializeTable(g);
      saveCareerTable();
      setBanner('<b>Final table.</b> ' + (aiRemaining.length + 1) + ' players remain.');
      Sound.consoleShift();
      haptic([24,42,24]);
      render();
      await sleep(motionOff() ? 0 : 1000);
    }
  } else {
    if (g.livesEnabled) processLives(g);
    if (human.chips<=0){
      if (g.livesEnabled && human.lives<=0){ showGameOver(g, human); return; }
      setBanner("You're out of chips.");
      Sound.busted(true);
      $('btn-rebuy').textContent = 'Rebuy ' + g.startingStack.toLocaleString() + (g.livesEnabled ? ' \u00b7 costs 1 \u2665' : '');
      $('btn-rebuy').classList.remove('hidden');
      $('btn-new-table').classList.remove('hidden');
      render(); return;
    }
    if (g.players.filter(p=>p.inHand || (p.chips>0 && !p.eliminated)).length < 2){ concludeGame(); return; }
  }

  $('btn-next-hand').classList.remove('hidden');
  setBanner(handCommentary ? esc(handCommentary) : 'Hand complete.');
  render();
  if (g.mode==='career') saveCareerTable();
  else if (g.mode==='career-cash') checkpointCareerCash(serializeTable(g));
  else saveTable();
  scheduleAutoDeal();
}

/* Lives bookkeeping at the end of a cash hand. Busted AIs spend a heart and
   queue a rebuy for the next deal; with no hearts left, they bust out for
   good — the death plays during the between-hand pause. */
function processLives(g){
  g.players.forEach(p=>{
    if (p.isHuman || p.eliminated || p.chips>0) return;
    if (p.lives > 0){
      p.lives--;
      p._pendingRebuy = true;
      const e = seatEls[p.id];
      if (e && e.hearts) e.hearts.classList.add('heart-hit');
      logMsg(p.name + ' is felted \u2014 spends a life to rebuy');
    } else {
      p.eliminated = true;
      p.inHand = false;
      logMsg(p.name + ' busted out!', true);
      playDeath(p);
    }
  });
}

function skullSVG(){
  return '<svg class="face skull" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect x="8" y="6" width="24" height="21" rx="7" fill="#E8E0CC"/>' +
    '<rect x="13" y="25" width="14" height="9" rx="2" fill="#E8E0CC"/>' +
    '<circle cx="15.5" cy="17.5" r="3.4" fill="#20302c"/><circle cx="24.5" cy="17.5" r="3.4" fill="#20302c"/>' +
    '<rect x="18.8" y="21.5" width="2.4" height="3.2" fill="#20302c"/>' +
    '<rect x="14.4" y="28" width="2.2" height="6" fill="#20302c"/>' +
    '<rect x="18.9" y="28" width="2.2" height="6" fill="#20302c"/>' +
    '<rect x="23.4" y="28" width="2.2" height="6" fill="#20302c"/>' +
    '</svg>';
}

async function playDeath(p){
  const e = seatEls[p.id];
  if (!e) return;
  flashAction(p.id, 'Busted!');
  Sound.busted(false);
  if (!motionOff()){
    e.avatar.classList.add('dying');
    await sleep(950);
    e.avatar.classList.remove('dying');
  }
  e._mood = null;
  e.avatar.classList.add('has-face');
  swapFace(e, p, pickDeadMood(), false);
  e.root.classList.add('dead');
  render();
}

function showGameOver(g, human){
  g.over = true;
  clearTableSave();
  clearTimeout(autoDealT);
  hideResultCard();
  setBanner('<b>Game over</b> \u2014 out of lives.');
  Sound.busted(true);
  const el = document.createElement('div');
  el.className = 'result-card gameover'; el.id = 'result-card';
  const net = human.chips - g.buyIns;
  el.innerHTML =
    '<div class="rc-title">Game Over</div>' +
    '<div class="go-skull">' + skullSVG() + '</div>' +
    '<div class="pot-line"><span class="pl-tag">Hands</span><span class="pl-body">played this session</span><span class="pl-amt tabular">' + g.handNumber + '</span></div>' +
    '<div class="pot-line"><span class="pl-tag">Best</span><span class="pl-body">biggest hand won</span><span class="pl-amt tabular">+' + (g.sess.bestWin||0).toLocaleString() + '</span></div>' +
    '<div class="pot-line"><span class="pl-tag">Net</span><span class="pl-body">against your buy-ins</span><span class="pl-amt tabular">' + (net>=0?'+':'') + net.toLocaleString() + '</span></div>' +
    '<div class="rc-explain">All three lives spent. New Table starts a fresh run.</div>';
  $('felt').appendChild(el);
  $('btn-next-hand').classList.add('hidden');
  $('btn-rebuy').classList.add('hidden');
  $('btn-new-table').classList.remove('hidden');
  render();
}

/* ---------------- Career event ending ----------------
   ONE authoritative terminal path. Two independent guards:
     - the money guard lives inside settleCareerEvent(), which returns true
       only if it actually performed the settlement;
     - the presentation guard is _careerResultShown on the game object,
       mirroring showTableCleared's own _tableClearedShown.
   Either alone would prevent a double credit; together they also cover the
   case where settlement succeeded but presentation was interrupted. A second
   call can never credit the prize, clear state, start a second drum, show a
   second result card, or rebind the return button. */
/* ---------------- Career placement ----------------
   The human's finishing place, read from live table state — never derived
   from a win/loss value.

     place = surviving opponents
           + same-hand busted opponents who STARTED THE HAND WITH MORE CHIPS
           + 1

   Both terms count players who finish AHEAD of the human. Survivors are
   unambiguous. Simultaneous busts are the case that actually needs a rule:
   when the human and an opponent both hit $0 on one hand, the standard
   tournament rule ranks the LARGER stack at the start of that hand higher.
   Without it, a short-stacked human busting alongside a bigger stack with
   one player left would read as second place and collect a paid place they
   did not finish in.

   An exactly equal starting stack does not count as ahead, so the human
   takes the better place: deterministic, player-favourable, and vanishingly
   rare. The win case returns early rather than relying on the arithmetic —
   a human who survives the final hand has won outright, even if the
   opponent they just eliminated brought a bigger stack to it. */
function careerFinishPlace(g, human){
  if (!g || !human || !Array.isArray(g.players) || !g.players.length) return null;
  const opponents = g.players.filter(p => p !== human);
  if (human.chips > 0 && opponents.every(p => p.chips <= 0)) return 1;
  const startOf = p => Number.isFinite(p._handStartChips) ? p._handStartChips : p.chips;
  const survivors = opponents.filter(p => p.chips > 0).length;
  const sameHandAhead = opponents.filter(p =>
    p.chips <= 0 && startOf(p) > 0 && startOf(p) > startOf(human)).length;
  // Clamped so no arithmetic slip can hand settlement an impossible place.
  return Math.min(g.players.length, Math.max(1, survivors + sameHandAhead + 1));
}

/* The Invitational stays one continuous six-player freezeout. Crossing to
   three (or, after a multi-K.O. hand, two) remaining earns one theatrical
   beat only; no stacks, seats, blinds, cards or payouts are reset. The bit
   is checkpointed with the table so a reload cannot replay the moment. */
function shouldPresentChampionshipFinalTable(g, remaining){
  return !!g && g.mode === 'career' && !!g.event
    && g.event.id === 'invitational-final'
    && g.championshipFinalTableReached !== true
    && Number.isInteger(remaining) && remaining >= 2 && remaining <= 3;
}

function endCareerEvent(g, result){
  if (!g || g.mode !== 'career') return;
  if (g._careerResultShown) return;
  if (!settleCareerEvent(result)) return;   // someone else already owns this ending
  recordGameplayConclusion(g, result && result.place===1 ? 'win' : 'loss');
  g._careerResultShown = true;
  g.over = true;
  // Snapshot every displayed value ONCE, immediately after settlement and
  // before any presentation begins. The result animation must never read
  // live Career state: settlement has already cleared career.active, and a
  // multi-second drum transition is exactly the window in which live reads
  // go stale or throw. This object is display data only — it recalculates
  // nothing and can alter no settlement.
  const model = buildCareerResultModel(g, careerLastResult());
  showCareerEventResult(g, model);
}

/* `settled` is the record settleCareerEvent() just wrote. Outcome, placement
   and prize all come from there rather than being recomputed: the prize
   shown is the amount ACTUALLY CREDITED for the place actually finished, not
   the event's headline first-place figure. */
function buildCareerResultModel(g, settled){
  const ev = g.event || {};
  const reward = g.event && g.event.reward;
  const record = settled || {};
  const outcome = record.outcome || 'loss';
  const championship = outcome === 'win' && (ev.id === 'invitational-final'
    || record.eventId === 'invitational-final');
  return {
    outcome,
    won: outcome === 'win',
    cashed: outcome === 'cash',
    championship,
    firstChampionship: championship && record.firstChampionship === true,
    place: Number.isInteger(record.place) && record.place >= 1 ? record.place : null,
    eventName: ev.name || 'CAREER EVENT',
    prize: Number.isFinite(record.prize) && record.prize > 0 ? record.prize : 0,
    buyIn: ev.buyIn || 0,
    bankroll: careerBankroll(),                                  // read once, post-settlement
    eventScore: reward ? Math.max(0, Math.round(reward.score||0)) : 0,
    hands: g.handNumber || 0,
    // The field the player actually entered, from the event's own
    // immutable snapshot. Never g.players.length, which by the time a
    // result exists is the field MINUS everyone eliminated.
    field: Number.isInteger(ev.playerCount) && ev.playerCount > 0 ? ev.playerCount : null
  };
}

/* Plain, atomic strings. Every amount is ONE text node with its currency
   symbol and thousands separators attached, so nothing can wrap or
   fragment mid-number. Deliberately NOT the mechanical per-digit reel
   builders (buildResultAmount/buildResultCounter): those emit a separate
   element per glyph, which is what split TOTAL into loose +, digits and
   commas across several lines. Those builders remain untouched for the
   Arcade results they were designed for. */
function careerResultRow(label, value){
  return '<div class="career-res-row"><span class="career-res-k">' + esc(label) +
         '</span><span class="career-res-v tabular">' + esc(value) + '</span></div>';
}
/* EVENT CASHED only. A win and a bust are outcomes of the event and go to
   the shared result stage (careerStageModel/resultStageHTML); a non-winning
   paid place deliberately stays below both in presentation weight and keeps
   this restrained plain card, unchanged. See CAREER_DESIGN.md, Presentation.

   Values stay atomic text nodes in .career-res-v — a cash is a settled
   figure being reported, not a quantity being counted, so it takes no
   mechanical reel cells. The three-outcome branching below is retained
   intact: it is what makes this renderer readable against the model it is
   given, and the win/loss branches remain covered by the focused checks. */
function careerResultHTML(model){
  const money = n => '$' + Math.abs(Math.round(n)).toLocaleString();
  const v = value => '<span class="career-res-v tabular crt-figure">' + esc(value) + '</span>';
  const cell = (label, value) =>
    '<div class="stage-instrument pc-display crt" data-crt-quiet><span class="stage-instrument-label crt-caption">' +
    esc(label) + '</span>' + v(value) + '</div>';
  // Any credited prize reads as a prize, so a non-winning cash reports what it
  // actually earned rather than what it failed to win.
  const moneyLabel = model.prize > 0 ? 'PRIZE' : 'BUY-IN LOST';
  const moneyValue = model.prize > 0 ? '+' + money(model.prize) : '-' + money(model.buyIn);
  // Shown for every finish with a known place — neutral after a bust rather
  // than punitive. A forfeit, and any record migrated from before placement
  // existed, has no place and no cell.
  const finishCell = model.place ? cell('FINISH', ordinal(model.place).toUpperCase()) : '';
  const title = model.won ? 'EVENT WON' : model.cashed ? 'EVENT CASHED' : 'EVENT LOST';
  return '<section class="career-result-panel' + (model.cashed ? ' is-cash' : '') +
      '" aria-label="Career event result">' +
    '<header class="stage-results-head pc-raised pc-material-plastic">' +
      '<span class="career-res-event">' + esc(model.eventName) + '</span>' +
      '<strong class="career-res-title">' + title + '</strong>' +
      '<i aria-hidden="true"></i></header>' +
    '<div class="stage-score-hero pc-display crt" data-crt-quiet>' +
      '<span class="stage-instrument-label crt-caption">' + moneyLabel + '</span>' + v(moneyValue) +
      '<span class="stage-score-carry"><span class="crt-caption">BANKROLL</span><span class="career-res-v tabular">' + esc(money(model.bankroll)) + '</span>' +
      '</span></div>' +
    '<div class="stage-results-deck pc-raised pc-material-plastic">' +
      '<div class="stage-results-instruments">' + finishCell +
        cell('EVENT SCORE', model.eventScore.toLocaleString()) + '</div>' +
      '<div class="stage-results-recap pc-display crt">' +
        '<div class="stage-recap-cell crt-cell"><span class="stage-instrument-label crt-caption">HANDS</span>' +
          v(String(model.hands)) + '</div>' +
      '</div>' +
    '</div>' +
    '</section>';
}

/* Reuses the stage machinery rather than showTableCleared() itself, which is
   welded to g.run (tablesCleared/tableNumber/run.arcade.score). A win earns
   the full drum; a loss reports plainly on the existing .result-card path,
   the same way showBusted does — real ceremony for the K.O., plain report
   after it. */
async function showCareerEventResult(g, model){
  if (model.cashed){
    // A non-winning cash keeps its restrained plain card and does not turn
    // the stage. It is a paid place, not an outcome of the event, so it
    // stays deliberately below both a win and a bust in presentation
    // weight, and is deliberately NOT routed through the shared result
    // stage. See docs/career/CAREER_DESIGN.md, Presentation.
    clearTimeout(autoDealT);
    endQuickResolve();          // no table action may survive into the result
    hideResultCard();
    closeRaisePanel();
    clearHumanReadouts();
    hideReview();
    pendingHumanPlayer = null;
    coachToken++;
    bannerOverride = null;
    $('btn-next-hand').classList.add('hidden');
    $('btn-rebuy').classList.add('hidden');
    $('btn-new-table').classList.add('hidden');
    // Row stays in its bay but fully inert: .disabled is pointer-events:none,
    // so Fold/Check/Raise cannot be pressed while a result is up.
    $('actions-row').classList.remove('hidden');
    $('actions-row').classList.add('disabled');
    if ($('action-console')) $('action-console').classList.add('results-pending');
    powerDownCompletedEvent(g);
    setBanner('<b>Event cashed.</b> You finished ' + ordinal(model.place || 2) + '.');
    clearCompletedEventTable(g);
    const el = document.createElement('div');
    el.className = 'result-card career-cash career-event-result';
    el.id = 'result-card';
    el.innerHTML = careerResultHTML(model);
    $('felt').appendChild(el);
    render();
    enterCareerResultsConsole(returnToCareer);
    return;
  }

  // A win and a bust are the two outcomes of the event itself, so both turn
  // the stage — the same stage, the same travel and the same lock TABLE
  // CLEARED and RUN OVER use. Only a win mucks first; a bust has already
  // had its K.O. ceremony and rolls straight into its report.
  setBanner(model.won
    ? '<b>Event won.</b> Every opponent is out.'
    : '<b>Event over.</b> You were eliminated.');
  await presentResultStage(g, careerStageModel(model), {
    // A finished event's instruments are hidden outright rather than
    // dimmed, before anything else moves: the tournament is over.
    prepare: ()=>{ clearHumanReadouts(); powerDownCompletedEvent(g); },
    muck: model.won,
    console: ()=>enterCareerResultsConsole(returnToCareer)
  });
}

function concludeGame(){
  endQuickResolve();
  if (game.mode==='elimination' && game.run && game.run.active){
    showTableCleared(game);
    return;
  }
  // Career should never reach here — finishHand sets g.over before
  // startNewHand could re-enter — but if it ever does, it routes through the
  // same guarded owner rather than becoming a second presentation site.
  // endCareerEvent() no-ops unless it genuinely owns the settlement.
  if (game.mode==='career'){
    const human = game.players.find(p=>p.id==='you');
    endCareerEvent(game, {place:careerFinishPlace(game, human)});
    return;
  }
  game.over = true;
  clearTableSave();
  clearTimeout(autoDealT);
  const human = game.players.find(p=>p.id==='you');
  const humanAlive = human && human.chips>0 && !human.eliminated;
  const clearedCopy = game.mode==='elimination'
    ? 'Every opponent is eliminated.'
    : 'Every opponent is out of lives.';
  setBanner(humanAlive ? '<b>Table cleared.</b> ' + clearedCopy : 'Not enough players to continue.');
  $('actions-row').classList.add('hidden');
  $('btn-next-hand').classList.add('hidden');
  $('btn-new-table').classList.remove('hidden');
  render();
}

function moneyResult(n){ return '$'+Math.max(0,n||0).toLocaleString(); }
function ratioResult(won,played){ return (won||0)+' / '+(played||0); }
/* BEST HAND trophy case — region four of the shared result stage. Pure
   normal flow, no absolute positioning: label, then the five cards, then
   the hand name, then its subtype, stacked and centred — nothing can
   overlap because nothing is pulled out of flow. Both stage results that
   HAVE a best hand (TABLE CLEARED, RUN OVER) use this; the two Career
   results have no best hand to show and fill the same well with
   stageStatementHTML() instead. */
function tableBestHandTrophyHTML(best){
  if (!best){
    return '<div class="stage-trophy pc-display crt" data-result-beat="trophy">'+
      '<div class="stage-trophy-label crt-caption">Best hand</div>'+
      '<div class="stage-trophy-empty">No showdown hand recorded</div></div>';
  }
  const split=splitHandText(best.result.cat,best.name);
  const displayCards=arrangeHandForDisplay(best.result.cat,best.cards);
  const cards=displayCards.map(c=>'<div class="'+cardClass(false,c,true)+'" aria-label="'+esc(cardLabel(false,c))+'">'+cardInner(c)+'</div>').join('');
  return '<div class="stage-trophy pc-display crt" data-result-beat="trophy">'+
    '<div class="stage-trophy-label crt-caption">Best hand</div>'+
    '<div class="stage-trophy-cards">'+cards+'</div>'+
    '<div class="stage-trophy-name crt-figure">'+esc(split.category.toUpperCase())+'</div>'+
    (split.descriptor?'<div class="stage-trophy-desc">'+esc(split.descriptor)+'</div>':'')+
  '</div>';
}
function tableReportStatPages(r){
  const hands=Math.max(0,r.tableHands||0);
  const won=Math.max(0,r.tableHandsWon||0);
  const core=[
    {label:'Hands won',value:ratioResult(won,hands)},
    {label:'Showdowns won',value:ratioResult(r.tableShowdownsWon,r.tableShowdownsPlayed)},
    {label:'Biggest net win',value:moneyResult(r.tableBiggestPotWon)}
  ];
  const context=[];
  if ((r.tableAllInsPlayed||0)>0){
    context.push({label:'All-ins won',value:ratioResult(r.tableAllInsWon,r.tableAllInsPlayed)});
  }
  context.push({label:'High water',value:moneyResult(r.tableHighestStack)});
  context.push({label:'Win rate',value:hands ? Math.round((won/hands)*100)+'%' : '—'});
  if (context.length<3) context.push({label:'Table length',value:hands+' HAND'+(hands===1?'':'S')});
  return [core,context.slice(0,3)];
}
/* ============================================================
   THE SHARED RESULT STAGE

   ONE physical chassis presents all four major outcomes: TABLE CLEARED,
   RUN OVER, EVENT WON and EVENT LOST. They are semantic states of the
   same hardware, not four screens — see docs/ui/handover/CURRENT_STATE.md
   and result-stage-lab.html, the approved visual source of truth.

   Not a card floating over the felt, and not a cleared poker table with
   stats on it. See .felt.results-mode / rollStageTransition() in
   06-presentation.js, which places this into the real #felt (reskinned
   but keeping the felt's own curved-corner silhouette) as the incoming
   stage. Built from the .pc-* physical-cabinet primitives shared with the
   main menu, using that screen's fixed leather, cream-plastic,
   green-display and amber-lamp palette so a table theme can never make a
   result feel like a different game.

   FIVE REGIONS, in this order, for every outcome:

     1. head        context eyebrow, result word, machine lamp
     2. hero        the ONE headline quantity, on mechanical reels, with
                    the persistent carry-forward legend beneath it
     3. deck        two framed instruments + the three-slot CRT memory
                    bank (+ an optional lamp strip)
     4. detail      best hand, or — where no hand is tracked — the
                    outcome statement the game already produces
     5. progress    where the player now stands and what comes next

   A model describes WHAT to show; resultStageHTML() decides how. Nothing
   here calculates a result, settles money, or reads live mode state: a
   model is built once by its owner, immediately after that owner's own
   calculation, and is display data from then on.

   Mechanical reels are reserved for the headline quantity and for a
   framed instrument that genuinely counts something. Their digits are
   filled by fillResultStageReels() right after the HTML is inserted —
   string-built zeros here would otherwise flash before being replaced.
   Every other settled statistic is ordinary CRT text.

   Returns the INNER content only — the caller's own element carries
   class="stage-results" id="result-card" directly, so this never nests a
   second .stage-results/.result-card box inside itself.
   ============================================================ */

/* The two reel slots. Both ids are the production ones the wake sequence
   (wakeResultStage) and revealResultAmount() already address, so no
   outcome needs a reveal path of its own. */
const RESULT_HERO_REEL_ID = 'stage-results-score';
const RESULT_INSTRUMENT_REEL_ID = 'stage-results-stack';

function stageHeadHTML(eyebrow, title){
  return '<header class="stage-results-head pc-raised pc-material-plastic">'+
    '<span>'+esc(eyebrow)+'</span><strong>'+esc(title)+'</strong>'+
    '<i aria-hidden="true"></i></header>';
}
function stageHeroHTML(hero){
  return '<div class="stage-score-hero pc-display crt" data-crt-quiet>'+
    '<span class="stage-instrument-label crt-caption">'+esc(hero.label)+'</span>'+
    '<div class="amt-readout stage-score-readout'+(stageReelIsLong(hero.reel)?' is-long':'')+
      '" id="'+RESULT_HERO_REEL_ID+'"></div>'+
    '<span class="stage-score-carry"><span class="crt-caption">'+esc(hero.carryLabel)+'</span>'+
    '<strong class="tabular">'+esc(hero.carryValue)+'</strong></span></div>';
}
/* Six or more cells is where a reel stops fitting its instrument at
   393px, so it takes the one-size-down variant rather than spilling. */
function stageReelIsLong(reel){
  if (!reel) return false;
  return (String(reel.prefix||'').length + stageReelText(reel).length) >= 6;
}
function stageReelText(reel){
  return reel && typeof reel.text === 'string'
    ? reel.text
    : Math.max(0, (reel && reel.amount) | 0).toLocaleString();
}
function stageInstrumentHTML(instrument){
  let body;
  if (instrument.kind === 'reel'){
    body = '<div class="amt-readout'+(stageReelIsLong(instrument.reel)?' is-long':'')+
      '" id="'+RESULT_INSTRUMENT_REEL_ID+'"></div>';
  } else if (instrument.kind === 'lamps'){
    const lamps = Array.from({length:instrument.total}, (_,i)=>
      '<span class="stage-ko-slot'+(i<instrument.lit?' lit':'')+'"></span>').join('');
    body = '<div class="stage-ko-lamps">'+lamps+'</div>'+
      '<div class="stage-ko-readout tabular crt-figure">'+esc(instrument.readout)+'</div>';
  } else {
    // A single settled figure that is neither money nor a bounded count —
    // a finishing place, an unbounded K.O. total, an event score. Same
    // readout family as the K.O. count, one size up.
    body = '<div class="stage-ko-readout stage-big-readout tabular crt-figure crt-figure--lg">'+esc(instrument.value)+'</div>';
  }
  return '<div class="stage-instrument pc-display crt" data-crt-quiet><span class="stage-instrument-label crt-caption">'+
    esc(instrument.label)+'</span>'+body+'</div>';
}
/* Three-slot CRT memory bank. Core facts appear first; where a model
   supplies a second page it flickers in after the stage wakes, using
   only statistics the mode already tracks. */
function stageRecapHTML(pages){
  return '<div class="stage-results-recap pc-display crt" id="stage-stat-bank" data-result-beat="recap">'+
    pages[0].map((stat,i)=>
      '<div class="stage-recap-cell crt-cell" data-stage-stat="'+i+'"><span class="stage-instrument-label crt-caption">'+esc(stat.label)+'</span>'+
        '<strong class="stage-recap-value tabular crt-figure">'+esc(stat.value)+'</strong></div>'
    ).join('')+'</div>';
}
/* One extra fact about this outcome. Positive: FLAWLESS SHOWDOWNS.
   Negative: who ended the run. Same physical strip either way. */
function stageLampHTML(lamp){
  if (!lamp) return '';
  const negative = lamp.tone === 'negative';
  return '<div class="stage-recap-lamp'+(negative?' is-negative':'')+'">'+
    '<span class="pc-lamp '+(negative?'is-danger':'is-amber')+'"></span>'+
    '<span class="stage-recap-lamp-text'+(negative?' crt-danger':'')+'">'+esc(lamp.text)+'</span></div>';
}
/* Region four when no best hand is tracked. The line is the outcome
   message the game already produces for the banner; the sub-line states
   what the settlement already did. Nothing here is calculated. */
function stageStatementHTML(detail){
  return '<div class="stage-trophy stage-trophy--statement pc-display crt" data-result-beat="trophy">'+
    '<div class="stage-trophy-label crt-caption">'+esc(detail.label)+'</div>'+
    // Line and sub-line are ONE block so they stay together in the middle
    // of the well rather than drifting apart as the stage grows.
    '<div class="stage-statement-block">'+
      '<div class="stage-statement crt-figure">'+esc(detail.line)+'</div>'+
      (detail.sub?'<div class="stage-statement-sub">'+esc(detail.sub)+'</div>':'')+
    '</div>'+
  '</div>';
}
function stageDetailHTML(detail){
  return detail.kind === 'statement'
    ? stageStatementHTML(detail)
    : tableBestHandTrophyHTML(detail.best);
}
/* Where the player stands and what comes next. Career has no counted
   progression left once BANKROLL sits in the hero carry, so it takes the
   deliberate two-part layout rather than an empty centre value. */
function stageProgressHTML(progress){
  const twoPart = !progress.value;
  return '<div class="stage-run-progress pc-display'+(twoPart?' is-two-part':'')+
    ' crt" data-result-beat="progress">'+
    '<span class="crt-caption">'+esc(progress.label)+'</span>'+
    (twoPart?'':'<strong class="tabular crt-figure">'+esc(progress.value)+'</strong>')+
    '<em class="crt-caption">'+esc(progress.next)+'</em></div>';
}
function resultStageHTML(model){
  return '<div class="stage-results-machine pc-material-leather">'+
    stageHeadHTML(model.eyebrow, model.title)+
    stageHeroHTML(model.hero)+
    '<div class="stage-results-deck pc-raised pc-material-plastic">'+
      '<div class="stage-results-instruments" data-result-beat="instruments">'+
        model.instruments.map(stageInstrumentHTML).join('')+'</div>'+
      stageRecapHTML(model.recapPages)+
      stageLampHTML(model.lamp)+
    '</div>'+
    stageDetailHTML(model.detail)+
    stageProgressHTML(model.progress)+
  '</div>';
}
/* Reels are built, never string-rendered — see the section header. Runs
   inside the stage-swap callback, immediately after the HTML lands. */
function fillResultStageReels(model){
  const hero = model.hero.reel;
  if (hero) buildResultDigits(document.getElementById(RESULT_HERO_REEL_ID), stageReelText(hero), hero.prefix||'');
  const counted = model.instruments.find(i=>i.kind === 'reel');
  if (counted) buildResultDigits(document.getElementById(RESULT_INSTRUMENT_REEL_ID), stageReelText(counted.reel), counted.reel.prefix||'');
}

/* ---------------- the four models ----------------
   Each is built ONCE by the owner of its outcome, from values that owner
   has already finished calculating. */

function tableClearedModel(g){
  const r=g.run;
  const a=r.arcade||makeArcadeRunState();
  const human=g.players.find(p=>p.isHuman);
  const opponents=runOpponentCount(g);
  const trackedStart=Number.isFinite(r.tableScoreStart) ? r.tableScoreStart : null;
  const tableScore=trackedStart==null ? a.score : Math.max(0,a.score-trackedStart);
  const perfect=r.tableKOs===opponents && r.tableShowdownsPlayed>0 && r.tableShowdownsWon===r.tableShowdownsPlayed;
  return {
    tone:'positive',
    eyebrow:'TABLE '+r.tableNumber,
    title:'CLEARED',
    // RUN SCORE is deliberately not the headline — the fixed SCORE cabinet
    // directly above the bay already shows it, so the carry legend does.
    hero:{
      label: trackedStart==null ? 'Run score' : 'Table score',
      reel:{ amount:tableScore, prefix:'+' },
      carryLabel:'RUN TOTAL',
      carryValue:formatArcadeScore(a.score)
    },
    instruments:[
      { kind:'reel', label:'Finish stack', reel:{ amount:human?human.chips:0, prefix:'$' } },
      { kind:'lamps', label:'K.O.s', lit:r.tableKOs, total:opponents, readout:r.tableKOs+' / '+opponents }
    ],
    recapPages:tableReportStatPages(r),
    lamp: perfect ? { tone:'positive', text:'FLAWLESS SHOWDOWNS' } : null,
    detail:{ kind:'hand', best:r.tableBestHand },
    progress:{ label:'TABLES CLEARED', value:String(r.tablesCleared), next:'NEXT: TABLE '+(r.tableNumber+1) }
  };
}

/* The negative sibling of TABLE CLEARED: identical chassis, coral where
   that one carries the positive rim. Every figure already exists on the
   run — finalizeArcadeRun() has completed by the time this is built, so
   arcadeProfile.highScore is either this run's new record or the standing
   personal best to report against. */
function runOverModel(g){
  const r=g.run;
  const a=r.arcade||makeArcadeRunState();
  const buster=r.bustedBy;
  const hands=Math.max(0,r.totalHands||0);
  const won=Math.max(0,r.totalHandsWon||0);
  const scoringEvents=Object.values(a.awardCounts||{}).reduce((sum,n)=>sum+(n||0),0);
  return {
    tone:'negative',
    eyebrow:'BUSTED ON TABLE '+r.tableNumber,
    title:'RUN OVER',
    hero:{
      label:'Final score',
      // The padded seven-digit form the SCORE cabinet itself uses.
      reel:{ text:formatArcadeScore(a.score), prefix:'' },
      carryLabel:'RUN RECORD',
      carryValue: a.newHighScore ? 'NEW HIGH SCORE' : 'BEST '+formatArcadeScore(arcadeProfile.highScore||0)
    },
    instruments:[
      { kind:'reel', label:'Table reached', reel:{ amount:r.highestTableReached, prefix:'' } },
      { kind:'big', label:'K.O.s', value:String(r.totalKOs) }
    ],
    recapPages:[
      [ {label:'Hands won',value:ratioResult(won,hands)},
        {label:'Scoring events',value:String(scoringEvents)},
        {label:'Biggest net win',value:moneyResult(r.biggestPotWon)} ],
      [ {label:'Total hands',value:String(hands)},
        {label:'Biggest reward',value:'+'+a.biggestReward.toLocaleString()},
        {label:'Win rate',value:hands ? Math.round((won/hands)*100)+'%' : '—'} ]
    ],
    lamp: buster ? {
      tone:'negative',
      text:'BUSTED BY '+buster.names.join(' & ').toUpperCase()+(buster.hand?' · '+buster.hand.toUpperCase():'')
    } : null,
    detail:{ kind:'hand', best:r.bestHand },
    progress:{ label:'TABLES CLEARED', value:String(r.tablesCleared), next:'NO REBUY' }
  };
}

/* EVENT WON / EVENT LOST. Built from the settled display model
   (buildCareerResultModel), never from live Career state — see
   endCareerEvent(). EVENT CASHED does not come through here: a
   non-winning paid place keeps its restrained plain card
   (careerResultHTML) and does not turn the stage. */
function careerStageModel(m){
  const money=n=>'$'+Math.abs(Math.round(n)).toLocaleString();
  const won=m.won;
  // A loss whose captured buy-in is exactly zero (a free event, e.g. Second
  // Chance) forfeited nothing — "Buy-in lost"/"BUY-IN FORFEITED" would be
  // false. Report the truthful, signless zero instead. Never reachable on a
  // win: a win's hero is always the prize, whatever the buy-in was.
  const freeLoss = !won && m.buyIn === 0;
  const champion = won && m.firstChampionship === true;
  return {
    tone: won ? 'positive' : 'negative',
    eyebrow:m.eventName,
    title: champion ? 'CHAMPION' : won ? 'EVENT WON' : 'EVENT LOST',
    hero:{
      label: won ? 'Prize' : freeLoss ? 'BANKROLL CHANGE' : 'Buy-in lost',
      reel: freeLoss
        ? { text:'$0', prefix:'' }
        : { text:money(won ? m.prize : m.buyIn), prefix: won ? '+' : '-' },
      // The one persistent, forward-carrying Career number.
      carryLabel:'BANKROLL',
      carryValue:money(m.bankroll)
    },
    instruments:[
      { kind:'big', label:'Finish', value:m.place ? ordinal(m.place).toUpperCase() : '—' },
      { kind:'big', label:'Event score', value:m.eventScore.toLocaleString() }
    ],
    // The stake is the useful third fact after a win (what was risked for
    // the prize); after a loss the hero already reports the forfeited
    // buy-in, so the payout that did not arrive takes the slot instead.
    recapPages:[[
      { label:'Hands', value:String(m.hands) },
      { label:'Field', value:m.field ? String(m.field) : '—' },
      won ? { label:'Buy-in', value:money(m.buyIn) }
          : { label:'Prize', value:'$0' }
    ]],
    lamp:null,
    detail:{
      kind:'statement', label:'Result',
      line: champion ? 'THE INVITATIONAL IS YOURS' : won ? 'EVERY OPPONENT IS OUT' : 'YOU WERE ELIMINATED',
      sub: champion ? 'CHAMPION STATUS RECORDED' : won ? 'PRIZE CREDITED TO BANKROLL' : freeLoss ? 'NO BUY-IN LOST' : 'BUY-IN FORFEITED'
    },
    progress: champion
      ? { label:'CAREER CHAMPION', value:'', next:'NEXT: DEFEND THE TITLE' }
      : { label: won ? 'EVENT COMPLETE' : 'EVENT ENDED', value:'', next:'NEXT: EVENTS BOARD' }
  };
}

/* ---------------- the shared wake ----------------
   The stage stays electrically dormant while the face itself is
   travelling; these beats run only once the heavy lock has completed.
   Identical for all four outcomes. */
async function wakeResultStage(g, model){
  const el=$('result-card');
  if (!el || game!==g) return false;
  if (motionOff()){
    el.classList.add('wake-head','wake-score','wake-instruments','wake-recap','wake-trophy','wake-progress');
    return true;
  }
  const beat=async (cls,ms)=>{
    if (game!==g || !el.isConnected) return false;
    el.classList.add(cls);
    await sleep(ms);
    return game===g && el.isConnected;
  };
  if (!await beat('wake-head',110)) return false;
  el.classList.add('wake-score');
  revealResultAmount($(RESULT_HERO_REEL_ID),true);
  await sleep(180);
  if (game!==g || !el.isConnected) return false;
  if (!await beat('wake-instruments',170)) return false;
  revealResultAmount($(RESULT_INSTRUMENT_REEL_ID),false);
  if (!await beat('wake-recap',150)) return false;
  if (!await beat('wake-trophy',140)) return false;
  if (!await beat('wake-progress',110)) return false;
  startResultStatCycle(g,el,model.recapPages);
  return true;
}
function startResultStatCycle(g,el,pages){
  const bank=el && el.querySelector('#stage-stat-bank');
  if (!bank || !Array.isArray(pages) || pages.length<2 || motionOff()) return;
  let page=0;
  const swap=()=>{
    if (game!==g || !el.isConnected || !bank.isConnected) return;
    bank.classList.add('is-switching');
    Sound.counterTick(false);
    el._stageStatsSwapT=setTimeout(()=>{
      if (game!==g || !el.isConnected || !bank.isConnected) return;
      page=(page+1)%pages.length;
      bank.querySelectorAll('[data-stage-stat]').forEach((cell,i)=>{
        const stat=pages[page][i];
        if (!stat) return;
        const label=cell.querySelector('.stage-instrument-label');
        const value=cell.querySelector('.stage-recap-value');
        if (label) label.textContent=stat.label;
        if (value) value.textContent=stat.value;
      });
      Sound.counterLock(false);
      el._stageStatsClearT=setTimeout(()=>bank.classList.remove('is-switching'),150);
      el._stageStatsCycleT=setTimeout(swap,3900);
    },140);
  };
  el._stageStatsCycleT=setTimeout(swap,2700);
}

/* ---------------- the shared presentation path ----------------
   The ONE production route from "this outcome has been calculated" to
   "the machine is showing it and its actions are live". All four major
   results run through here, so there is exactly one stage, one travel,
   one lock and one console change — never four similar animations.

   Callers own steps 1 and 3 (their own calculation, and the ordering of
   their own card/table cleanup, which differs: a cleared table mucks
   before it powers down, a bust has already had its ceremony). This owns
   everything else, in this fixed order:

     2. ordinary table controls go inert for the whole presentation;
     4. the existing stage-wheel transition is entered;
     5. the felt content is replaced inside its stage-swap callback;
     6. the shared chassis is rendered in the appropriate variant;
     7. it settles in exactly the position TABLE CLEARED settles in;
     8. result actions are exposed only once the stage has locked.

   opts.prepare   runs before the outcome's own cleanup (Career powers a
                  finished event's instruments down before anything else)
   opts.muck      return the cards to the deck first (a cleared table
                  does; a bust has already lost its hand)
   opts.settle    runs after the cleanup, before the breathing beat
                  (Arcade dims the dashboard here)
   opts.console   activates the result console; called once, after the
                  lock, and never while anything is still moving */
async function presentResultStage(g, model, opts){
  const o = opts || {};
  clearTimeout(autoDealT);
  endQuickResolve();          // no table action may survive into the result
  hideResultCard();
  closeRaisePanel();
  hideReview();
  pendingHumanPlayer = null;
  coachToken++;
  bannerOverride = null;

  // 2. Ordinary controls: hidden or inert, for the whole presentation.
  // The row stays in its bay but .disabled is pointer-events:none, so
  // Fold/Check/Raise cannot be pressed while a result is up.
  $('btn-next-hand').classList.add('hidden');
  $('btn-rebuy').classList.add('hidden');
  $('btn-new-table').classList.add('hidden');
  $('actions-row').classList.remove('hidden');
  $('actions-row').classList.add('disabled');
  if ($('action-console')) $('action-console').classList.add('results-pending');
  if (o.prepare) o.prepare();

  // 3. The outcome's own cleanup, in its own order. muckCards() flicks
  // every remaining board/hole card (the human's own included, even
  // though it lives in the fixed HUD dock) back into the deck and fully
  // resolves before anything mechanical starts — no cards travelling
  // mid-roll.
  if (o.muck) await muckCards();
  if (o.settle) o.settle();
  // One pause serves both "let the dormant transition settle" and "brief
  // clean-machine beat before the latch clicks".
  await sleep(motionOff() ? 0 : STAGE_ROLL_CONFIG.breatheMs);
  if (game !== g) return;

  // 4-7. One stage-wheel transition, shared by all four outcomes.
  await rollStageTransition(felt=>{
    clearAllCardDOM();
    felt.querySelectorAll('.seat').forEach(s=>s.remove());
    const potArea = felt.querySelector('#pot-area');
    if (potArea) potArea.classList.add('hidden');
    if ($('pot-val')) $('pot-val').textContent = '0';
    g.board = []; g.pot = 0;
    felt.classList.add('results-mode');
    // The one semantic switch: same machine, different state.
    felt.classList.toggle('tone-negative', model.tone === 'negative');
    const el = document.createElement('div');
    el.className = 'stage-results'; el.id = 'result-card';
    el.innerHTML = resultStageHTML(model);
    felt.appendChild(el);
    fillResultStageReels(model);
  });

  render();
  await wakeResultStage(g, model);

  // 8. Only once the stage has genuinely locked does the action console
  // change mode — never expose a result action (or leave FOLD/CHECK/RAISE
  // reachable) while anything is still moving.
  await sleep(motionOff() ? 0 : STAGE_ROLL_CONFIG.consoleFlipBeatMs);
  if (game !== g) return;
  if (o.console) o.console();
}

/* Arcade's positive result. Owns its own calculation and its own
   cleanup order, then hands the whole presentation to the shared stage
   path — this function has no transition of its own. */
async function showTableCleared(g){
  if (g._tableClearedShown) return;
  g._tableClearedShown = true;
  g.over = true;
  clearTableSave();
  g.run.tablesCleared = Math.max(g.run.tablesCleared, g.run.tableNumber);
  setBanner('<b>Table cleared.</b> Every opponent is eliminated.');
  await presentResultStage(g, tableClearedModel(g), {
    muck: true,
    // The dashboard begins powering down (hand-strength/bet/blind lamps go
    // dark in place; BANKROLL stays lit) while the felt still has its
    // breathing beat.
    settle: ()=>powerDownDashboard(g),
    console: ()=>enterResultsConsole(beginNextRunTable)
  });
}
function ordinal(n){
  const s=['th','st','nd','rd'], v=n%100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

/* ---------------- elimination mode: bust resolution ----------------
   A player can only reach exactly $0 by losing every pot layer they were
   eligible for this hand — folding never drains a stack below what it had
   already committed, and a blind that consumes a whole stack makes that
   player allIn immediately (postBlind), so they can never fold afterward.
   That means a newly-busted player was always a genuine contender, never
   a fold-win bystander, and never won any pot layer they qualified for.

   computePots()/handleShowdown() build pots smallest-level-first, and a
   player is `eligible` for every pot layer up to their own totalBetHand —
   so their eligible pots form a contiguous PREFIX of potResults, and the
   LAST entry in that prefix is, by construction, the pot layer built from
   their own final committed chips. Whoever won THAT specific pot is who
   actually beat them — not just "the human, if the human won anything
   this hand" (which could credit a K.O. for an unrelated side pot the
   busted player was never part of). See the Phase 1 plan §5 for the full
   reasoning. */
/* KO-attribution/elimination-state logic is entirely unchanged here — the
   only thing this pass touches is HOW the resulting group is presented
   (see playEliminationGroup, 06-presentation.js). All bookkeeping (ko
   attribution, p.eliminated/p.inHand, run KO counters, logMsg) still
   happens per player, up front, exactly as before — only the awaited
   presentation call moved from "one full sequence per player, serially"
   to "one batched call for the whole group" (a single-player hand still
   produces a group of one, and playEliminationGroup's own single-entry
   path is presentation-identical to the old per-player call). */
async function resolveEliminations(g, outcome){
  const busted = g.players.filter(p=>!p.isHuman && !p.eliminated && p.chips<=0);
  let humanKOs=0;
  const entries = [];
  for (const p of busted){
    let ko = false;
    if (outcome.type === 'showdown' && Array.isArray(outcome.potResults)){
      let decisivePot = null;
      outcome.potResults.forEach(pot=>{
        if (pot.eligible && pot.eligible.includes(p.id)) decisivePot = pot;
      });
      ko = !!(decisivePot && decisivePot.winnerIds.includes('you'));
    } else if (outcome.type === 'foldwin'){
      // A fold-win can't actually bust anyone (see the argument above) —
      // kept only as a defensive fallback, not expected to fire.
      ko = !!(outcome.winner && outcome.winner.id === 'you');
    }
    p.eliminated = true;
    p.inHand = false;
    // K.O. ATTRIBUTION IS MODE-BLIND (defect D5, corrected Phase 4A).
    // humanKOs used to increment only inside the `g.run` branch, so a
    // Career event — which deliberately has no g.run — could knock every
    // opponent out and still report koCount 0, and the K.O. award never
    // fired there. The RUN COUNTERS stay gated on g.run, because those
    // belong to a Single Player run and Career has none; only the
    // per-hand attribution returned to finishHand() is shared.
    if (ko){
      humanKOs++;
      if (g.run && g.run.active){ g.run.totalKOs++; g.run.tableKOs++; }
    }
    logMsg(p.name + (ko ? ' is knocked out!' : ' is eliminated!'), true);
    entries.push({ p, ko });
  }
  await playEliminationGroup(entries);
  return {koCount:humanKOs};
}
/* Post-elimination invariant/recovery pass — the safety net for finishHand
   asking "did resolveEliminations() above actually catch everyone busted
   this hand?" rather than a second, competing elimination system. Its own
   check IS resolveEliminations()'s own `busted` filter
   (!isHuman && !eliminated && chips<=0) — anyone the primary pass already
   caught is inherently excluded (it just set eliminated=true on them), so
   calling resolveEliminations() again here is naturally idempotent: a
   normal hand where nothing was missed finds zero busted players, does
   nothing, and returns null — no duplicate KO/ceremony/reward is possible.
   The point of running this as an explicit, separately-logged pass (Bug 1
   hardening rework — the previous version of this fix wrongly tried to
   patch the symptom at deal time in startNewHand(), a hand later, with no
   outcome left to attribute a KO to; see that function's own comment)
   is that IF the primary pass ever does miss someone, this still runs
   while `outcome` (this hand's potResults/winnerIds) is in scope, so a
   recovered bust still gets genuine human-KO attribution, real
   g.run.totalKOs/tableKOs credit, the actual K.O./ELIMINATED! ceremony,
   and correctly-timed hand-history logging — everything a deal-time-only
   fix could never recover. Distinct from resolveEliminations()'s own
   per-player log lines so a real recurrence is unmistakable in the log. */
async function recoverMissedEliminations(g, outcome){
  const missed = g.players.filter(p=>!p.isHuman && !p.eliminated && p.chips<=0);
  if (!missed.length) return null;
  const names = missed.map(p=>p.name).join(', ');
  console.error('[elimination] invariant violation: '+names+' had stack<=0 but resolveEliminations() did not mark them eliminated — running recovery now, still within the same hand, before it closes out.');
  logMsg('[SAFETY] recovering missed elimination(s): '+names, true);
  return resolveEliminations(g, outcome);
}

/* Shared K.O.!/ELIMINATED! presentation (see resolveEliminations above for
   how `ko` is decided). Physical-polish redesign: a failed portrait MODULE
   getting violently ejected from the machine — the opponent panel itself
   is the socket/housing and never moves. Stage sequence: brief settle ->
   defeated expression -> 2-3 short brutal THUNKs -> K.O./ELIMINATED stamp
   (established action-bar slot, never over the face) -> hardware powers
   down (flicker, dim) -> a short "unlatching" glitch (reuses the existing
   stroboscopic .elim-critical jitter) -> a brief anticipation beat -> the
   portrait is blasted out through the bottom of its socket and becomes a
   free-physics object that ricochets 3-6 times before a guaranteed forced
   exit off-screen (see ejectPortrait, 06-presentation.js) — the socket
   itself is left behind in a dark/dead `.socket-dead` state. All non-eject
   timings/intensities come from ELIMINATION_CONFIG; the eject stage's own
   duration is physics-driven (see KO_PORTRAIT_PHYSICS_CONFIG), not fixed.
   This always runs strictly after the pot-smash payout ceremony has fully
   resolved (resolveEliminations is only ever called once
   runShowdownAwardSequence's payout has completed — untouched by this
   pass) and TABLE CLEARED still can't appear until every busted player's
   full sequence here, including the portrait's exit, has resolved
   (resolveEliminations awaits this function in a loop — also untouched). */
async function playElimination(p, opts){
  const ko = !!(opts && opts.ko);
  const e = seatEls[p.id];
  if (!e || !e.card) return;
  const idx = game.players.indexOf(p);
  const cfg = ko ? ELIMINATION_CONFIG.koTimings : ELIMINATION_CONFIG.elimTimings;
  const shake = ko ? ELIMINATION_CONFIG.shakeIntensity.ko : ELIMINATION_CONFIG.shakeIntensity.elim;
  const card = e.card;

  const showFace = mood => {
    e._mood = null;
    e.avatar.classList.add('has-face');
    swapFace(e, p, mood, false);
  };
  // Lives in the seat's existing action/status bar, not over the face —
  // the shocked/dead expression is the payoff and stays fully visible.
  // Driven through the real streetAction/render() pipeline (like every
  // other action label) so it persists correctly across future
  // re-renders instead of a one-off DOM write render() would overwrite.
  const stampActionBar = ()=>{
    p.streetAction = { type: ko ? 'ko' : 'eliminated', label: ko ? 'K.O.!' : 'ELIMINATED!', amount:0 };
    render();
    if (e.actionSlot){
      e.actionSlot.classList.remove('elim-slam');
      void e.actionSlot.offsetWidth;
      e.actionSlot.classList.add('elim-slam');
    }
  };
  const hit = mult=>{
    const dir = Math.random()<0.5 ? -1 : 1;
    card.style.setProperty('--hit-dx', Math.round(dir*(9+4*mult)*shake) + 'px');
    card.style.setProperty('--hit-dy', Math.round((Math.random()<0.4 ? -1 : 0)*(1+mult)) + 'px');
    card.style.setProperty('--hit-ms', cfg.hitMs + 'ms');
    card.classList.remove('elim-hit'); void card.offsetWidth; card.classList.add('elim-hit');
    Sound.koThunk(1+mult*0.35);
    haptic(18+Math.round(mult*10));
  };
  const clearHit = ()=> card.classList.remove('elim-hit');

  if (motionOff()){
    // Same accessibility contract as the rest of the game (see playDeath's
    // own motionOff() guard): jump straight to the settled end state
    // rather than skipping the reaction entirely. The panel stays put; the
    // portrait/socket just jumps straight to its dead/empty end state —
    // no violent motion is ever forced on a reduced-motion user.
    if (e.avatar){ e.avatar.classList.remove('has-face'); e.avatar.innerHTML=''; e.avatar.classList.add('socket-dead'); }
    e.root.classList.add('dead');
    stampActionBar();
    Sound.busted(false);
    if (ko){ Sound.humanKO(); haptic(40); }
    render();
    return;
  }

  // SETTLE — a brief beat right as the payout ceremony has just finished.
  await sleep(cfg.settleMs);

  // DEFEATED EXPRESSION
  showFace(Math.random()<0.5 ? 'shock' : 'shocked');

  // RATTLE -> stronger shake — escalating magnitude (pop-emphasis pass:
  // reads more like genuine building tension than a decaying hit ladder).
  hit(1.0);
  await sleep(cfg.hitMs + cfg.hitHoldMs);
  clearHit();
  await sleep(cfg.hitGapMs);
  hit(1.8);
  await sleep(cfg.hitMs + cfg.hitHoldMs);
  clearHit();

  // K.O./ELIMINATED stamp — same established action-bar slot as before.
  // No crossfade: the face swap is a straight innerHTML replace (see
  // showFace), so it genuinely changes in one frame.
  showFace(pickDeadMood());
  stampActionBar();
  Sound.busted(false);
  if (ko){ Sound.humanKO(); haptic(40); }

  await sleep(cfg.thunkGapMs);

  // INTERNAL THUNK — hardware dies (flicker -> dim) paired with one
  // heavier, distinct thump, then a brief unlatch glitch. This is its own
  // beat, separate from the two shakes above.
  card.style.setProperty('--fail-ms', cfg.failMs + 'ms');
  card.classList.add('elim-fail');
  Sound.koThunk(2.4);
  haptic(ko ? 50 : 34);
  await sleep(cfg.failMs);
  card.classList.add('elim-critical');
  Sound.koFailClick();
  await sleep(cfg.glitchMs);
  card.classList.remove('elim-critical');

  // PRELOAD/COMPRESSION -> COMPLETE STILLNESS -> anticipation -> BLAM. A
  // clearly readable squash on the socket itself — "something's being
  // compressed in there, about to let go" — grows in over this same beat
  // and then HOLDS (forwards fill), which is the "complete stillness":
  // nothing else animates during this pause, it's a held, dead-calm beat
  // right before the portrait fires. ejectPortrait() removes the class in
  // the same synchronous instant the BLAM fires — an immediate snap back,
  // never an eased return — and resolves once the portrait has genuinely
  // ricocheted its way off-screen, so TABLE CLEAR (resolveEliminations
  // awaits this whole function) can never appear while it's still
  // bouncing.
  if (e.avatar){
    const wrap = e.avatar.closest('.avatar-wrap');
    if (wrap){
      wrap.style.setProperty('--pressure-ms', cfg.anticipateMs + 'ms');
      wrap.classList.remove('pressure-build'); void wrap.offsetWidth; wrap.classList.add('pressure-build');
    }
  }
  await sleep(cfg.anticipateMs);
  await ejectPortrait(e, ko);

  e.root.classList.add('dead');
  await sleep(cfg.aftermathMs);
  render();
}

/* Multi-KO batching (pop-emphasis pass): when a single hand eliminates
   several opponents at once, they no longer each run the full sequence
   above serially, one after another. Instead every eliminated seat's
   build-up (shake -> rattle -> stronger shake -> stamp -> internal THUNK
   -> preload squash -> shared stillness) runs TOGETHER, then their
   portraits POP in rapid succession (ELIMINATION_CONFIG.multiKoPopGapMin
   -Max apart) into ONE shared physics arena where they can ricochet off
   the environment AND off each other (see launchPortrait/
   runPortraitGroupPhysics, 06-presentation.js). A single-entry group is
   presentation-identical to playElimination() above (same beats, same
   timings) — this exists purely for genuine multi-KO hands. */
async function playEliminationGroup(entries){
  if (!entries.length) return;
  if (entries.length === 1){ await playElimination(entries[0].p, {ko:entries[0].ko}); return; }

  const anyKo = entries.some(x=>x.ko);
  const cfg = anyKo ? ELIMINATION_CONFIG.koTimings : ELIMINATION_CONFIG.elimTimings;
  const shake = anyKo ? ELIMINATION_CONFIG.shakeIntensity.ko : ELIMINATION_CONFIG.shakeIntensity.elim;

  const live = entries.map(({p,ko})=>{
    const e = seatEls[p.id];
    return (e && e.card) ? { p, ko, e, idx: game.players.indexOf(p) } : null;
  }).filter(Boolean);
  if (!live.length) return;

  if (motionOff()){
    live.forEach(le=>{
      le.e._mood = null;
      if (le.e.avatar){ le.e.avatar.classList.remove('has-face'); le.e.avatar.innerHTML=''; le.e.avatar.classList.add('socket-dead'); }
      le.e.root.classList.add('dead');
      le.p.streetAction = { type: le.ko?'ko':'eliminated', label: le.ko?'K.O.!':'ELIMINATED!', amount:0 };
    });
    Sound.busted(false);
    if (anyKo){ Sound.humanKO(); haptic(40); }
    render();
    return;
  }

  const showFace = (le, mood)=>{
    le.e._mood = null;
    le.e.avatar.classList.add('has-face');
    swapFace(le.e, le.p, mood, false);
  };
  const hitAll = mult=>{
    live.forEach(le=>{
      const dir = Math.random()<0.5 ? -1 : 1;
      const card = le.e.card;
      card.style.setProperty('--hit-dx', Math.round(dir*(9+4*mult)*shake) + 'px');
      card.style.setProperty('--hit-dy', Math.round((Math.random()<0.4 ? -1 : 0)*(1+mult)) + 'px');
      card.style.setProperty('--hit-ms', cfg.hitMs + 'ms');
      card.classList.remove('elim-hit'); void card.offsetWidth; card.classList.add('elim-hit');
    });
    Sound.koThunk(1+mult*0.35);
    haptic(18+Math.round(mult*10));
  };
  const clearHitAll = ()=>live.forEach(le=>le.e.card.classList.remove('elim-hit'));

  // SETTLE -> DEFEATED EXPRESSION, together.
  await sleep(cfg.settleMs);
  live.forEach(le=>showFace(le, Math.random()<0.5 ? 'shock' : 'shocked'));

  // RATTLE -> stronger shake, together (same escalating rhythm as the
  // single-elimination path above).
  hitAll(1.0);
  await sleep(cfg.hitMs + cfg.hitHoldMs);
  clearHitAll();
  await sleep(cfg.hitGapMs);
  hitAll(1.8);
  await sleep(cfg.hitMs + cfg.hitHoldMs);
  clearHitAll();

  // K.O./ELIMINATED stamp, together — one render() covers every seat.
  live.forEach(le=>{
    showFace(le, pickDeadMood());
    le.p.streetAction = { type: le.ko?'ko':'eliminated', label: le.ko?'K.O.!':'ELIMINATED!', amount:0 };
    if (le.e.actionSlot){ le.e.actionSlot.classList.remove('elim-slam'); void le.e.actionSlot.offsetWidth; le.e.actionSlot.classList.add('elim-slam'); }
  });
  render();
  Sound.busted(false);
  if (anyKo){ Sound.humanKO(); haptic(40); }

  await sleep(cfg.thunkGapMs);

  // INTERNAL THUNK, together.
  live.forEach(le=>{
    le.e.card.style.setProperty('--fail-ms', cfg.failMs + 'ms');
    le.e.card.classList.add('elim-fail');
  });
  Sound.koThunk(2.4);
  haptic(anyKo ? 50 : 34);
  await sleep(cfg.failMs);
  live.forEach(le=>le.e.card.classList.add('elim-critical'));
  Sound.koFailClick();
  await sleep(cfg.glitchMs);
  live.forEach(le=>le.e.card.classList.remove('elim-critical'));

  // PRELOAD/COMPRESSION -> shared COMPLETE STILLNESS -> anticipation,
  // together — every socket compresses and holds at once.
  live.forEach(le=>{
    if (!le.e.avatar) return;
    const wrap = le.e.avatar.closest('.avatar-wrap');
    if (wrap){
      wrap.style.setProperty('--pressure-ms', cfg.anticipateMs + 'ms');
      wrap.classList.remove('pressure-build'); void wrap.offsetWidth; wrap.classList.add('pressure-build');
    }
  });
  await sleep(cfg.anticipateMs);

  // Staggered POPs — every launch shares ONE physics layer/arena so the
  // ejected portraits can pinball off each other, but each still gets its
  // own BLAM/spark/recoil at the instant it fires (see launchPortrait).
  const layer = document.createElement('div');
  layer.className = 'ko-physics-layer';
  document.body.appendChild(layer);
  const cs = [];
  for (let i=0;i<live.length;i++){
    const c = launchPortrait(live[i].e, live[i].ko, layer);
    if (c) cs.push(c);
    if (i < live.length-1){
      const gap = ELIMINATION_CONFIG.multiKoPopGapMin + Math.random()*(ELIMINATION_CONFIG.multiKoPopGapMax-ELIMINATION_CONFIG.multiKoPopGapMin);
      await sleep(gap);
    }
  }
  if (cs.length) await runPortraitGroupPhysics(cs, koObstacles());
  layer.remove();

  live.forEach(le=>le.e.root.classList.add('dead'));
  await sleep(cfg.aftermathMs);
  render();
}

/* Human defeat state for elimination mode — modeled on showGameOver()
   but without any lives/hearts framing (hearts are bypassed entirely in
   this mode, not spent down to zero). */
function showBusted(g, human){
  if (g.run && g.run.active){ showRunOver(g); return; }
  g.over = true;
  clearTableSave();
  clearTimeout(autoDealT);
  hideResultCard();
  setBanner('<b>Busted.</b> Out of chips.');
  Sound.busted(true);
  const el = document.createElement('div');
  el.className = 'result-card gameover'; el.id = 'result-card';
  el.innerHTML =
    '<div class="rc-title">Busted</div>' +
    '<div class="go-skull">' + skullSVG() + '</div>' +
    '<div class="pot-line"><span class="pl-tag">Hands</span><span class="pl-body">played this table</span><span class="pl-amt tabular">' + g.handNumber + '</span></div>' +
    '<div class="pot-line"><span class="pl-tag">Best</span><span class="pl-body">biggest hand won</span><span class="pl-amt tabular">+' + (g.sess.bestWin||0).toLocaleString() + '</span></div>' +
    '<div class="rc-explain">Out of chips — eliminated from this table. New Table starts fresh.</div>';
  $('felt').appendChild(el);
  $('btn-next-hand').classList.add('hidden');
  $('btn-rebuy').classList.add('hidden');
  $('btn-new-table').classList.remove('hidden');
  render();
}

/* Arcade's negative result — the same machine as TABLE CLEARED reporting
   a different state, not a separate report card. It no longer builds its
   own element over the table, no longer greys the world behind itself and
   no longer has an entrance animation of its own: it enters on the real
   stage wheel, exactly as a cleared table does.

   Guarded like showTableCleared. finalizeArcadeRun() is the one call here
   that writes anything — a second entry would compare this run's score
   against the high score it had just set and wrongly clear newHighScore,
   so the guard protects the record as well as the presentation. */
async function showRunOver(g){
  if (g._runOverShown) return;
  g._runOverShown = true;
  g.over = true;
  finalizeArcadeRun(g);
  clearTableSave();
  setBanner('<b>Run over.</b> Out of chips.');
  // A fresh run straight off RUN OVER keeps the table size the player was
  // already playing — it's a retry, not a trip back through the picker.
  const sameSizeAgain = runOpponentCount(g);
  await presentResultStage(g, runOverModel(g), {
    prepare: ()=>Sound.busted(true),
    // No muck: the human's hand is already gone with the stack that lost
    // it, exactly as a Career bust does not muck either.
    settle: ()=>powerDownDashboard(g),
    console: ()=>enterRunOverConsole(
      ()=>startSinglePlayerRun({opponentCount:sameSizeAgain}),
      leaveTable)
  });
}

function resetForNextRunTable(g){
  g.run.tableNumber++;
  g.run.highestTableReached=Math.max(g.run.highestTableReached,g.run.tableNumber);
  g.run.tableKOs = 0;
  g.run.tableHands = 0;
  g.run.tableHandsWon = 0;
  g.run.tableShowdownsPlayed = 0;
  g.run.tableShowdownsWon = 0;
  g.run.tableAllInsPlayed = 0;
  g.run.tableAllInsWon = 0;
  g.run.tableBiggestPotWon = 0;
  g.run.tableHighestStack = ELIMINATION_CONFIG.startingStack;
  g.run.tableBestHand = null;
  g.run.tableScoreStart = g.run.arcade ? g.run.arcade.score : 0;
  g.startingStack = ELIMINATION_CONFIG.startingStack;
  g.smallBlind = ELIMINATION_CONFIG.smallBlind;
  g.bigBlind = ELIMINATION_CONFIG.bigBlind;
  g.blindLevel = 0;
  g.board=[]; g.deck=[]; g.pot=0; g.currentBet=0; g.minRaise=g.bigBlind;
  g.dealerIndex=-1; g.sbIndex=-1; g.bbIndex=-1; g.currentIndex=-1; g.turnPointer=0;
  // Keep the game logically stopped for the entire presentation. This also
  // guarantees an AI decision that was already awaiting when DEV END TABLE
  // fired sees `over` and exits instead of waking inside the new-table swap.
  g.phase='setup'; g.handNumber=0; g.log=[]; g.over=true;
  g._transitioning = true;
  delete g._tableClearedShown;
  g.buyIns=g.startingStack; g.netStart=g.startingStack;
  g.sess={bestWin:0,worstLoss:0};
  g.players.forEach(p=>{
    p.chips=g.startingStack; p.hand=[]; p.folded=false; p.allIn=false;
    p.betThisRound=0; p.totalBetHand=0; p.acted=false; p.mayRaise=true;
    p.inHand=false; p.eliminated=false; p.streetAction=null; p.moodState=null;
    p.faceMood={ family:'neutral', intensity:0 };
    delete p._faceKey; delete p._faceSig;
    delete p._reveal; delete p._award; delete p._handRes;
    delete p._devForceAllIn; delete p._devAutoCall; delete p._pendingRebuy;
  });
}

/* The one canonical DOM reset for a revived run table. initSeats() creates
   fresh modules, then this deliberately scrubs every state channel that can
   otherwise outlive a hand: classes, animations, inline motion, expressions,
   labels, cards and timer-backed seat effects. */
function resetRunSeatDOM(g){
  // A run/table reset can land mid-K.O. (e.g. DEV END TABLE fired while a
  // portrait was still ricocheting) — strip any in-flight ejection layer
  // so a stale free-physics portrait never survives into the next table.
  // Same risk applies to an in-flight pot-smash chip burst/score plate
  // (runPotBreakPhysics/runPotSmashSequence, 06-presentation.js) — those
  // already carry their own burstMaxMs recovery valve that finalizes and
  // removes every chip even if interrupted, but stripping any surviving
  // layer here too closes the same class of gap defensively, exactly like
  // the K.O. layer above, instead of relying solely on that valve.
  document.querySelectorAll('.ko-physics-layer, .chip-physics-layer, .score-smash-layer').forEach(l=>l.remove());
  g.players.forEach((p,idx)=>{
    const e = seatEls[p.id];
    if (!e) return;
    clearTimeout(e._t); clearTimeout(e._heartT);
    e._mood = null;
    e.root.getAnimations().forEach(a=>a.cancel());
    e.root.classList.remove('folded','out','active','dead','winner','winner-pulse','thinking','run-pull-out','run-drop-in');
    ['transform','opacity','visibility','animation','transition','pointer-events','will-change','--run-stagger'].forEach(k=>e.root.style.removeProperty(k));
    if (!p.isHuman){
      const pos = seatPosition(idx,g.players.length);
      e.root.style.left = pos.left;
      e.root.style.top = pos.top;
    }
    if (e.card){
      e.card.getAnimations().forEach(a=>a.cancel());
      e.card.classList.remove('elim-hit','elim-critical','elim-freeze','elim-pop','elim-fail','elim-eject','elim-recoil','winner-pop');
      ['transform','opacity','visibility','filter','animation','transition','--elim-cur-scale','--hit-dx','--hit-dy','--hit-ms','--fail-ms','--eject-dir','--eject-ms'].forEach(k=>e.card.style.removeProperty(k));
    }
    if (e.cardsContainer) e.cardsContainer.innerHTML = '';
    if (e.bubble){ e.bubble.textContent=''; e.bubble.className='action-bubble'; }
    if (e.actionSlot){ e.actionSlot.textContent='–'; e.actionSlot.className='action-slot act-empty'; }
    if (!p.isHuman && e.avatar){
      e.avatar.getAnimations().forEach(a=>a.cancel());
      e.avatar.className = 'avatar has-face';
      e.avatar.removeAttribute('style');
      // A table reset can land mid-reaction-chain. Releasing the lock here
      // (the seat is being repainted to idle unconditionally) stops the
      // abandoned chain at its next step and re-opens ordinary mood
      // updates for the new table.
      e._faceLock = null;
      e._mood = null;
      swapFace(e, p, 'idle', false);
      const wrap = e.avatar.closest('.avatar-wrap');
      if (wrap){ wrap.classList.remove('socket-spark', 'pressure-build'); wrap.style.removeProperty('--pressure-ms'); }
    }
  });
}

function waitForRunAnimations(elements, expectedMs){
  const els = elements.filter(Boolean);
  if (!els.length || motionOff()) return Promise.resolve();
  const waits = els.map(el=>new Promise(resolve=>{
    let settled = false;
    const finish = ()=>{
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.removeEventListener('animationend',onEnd);
      el.removeEventListener('animationcancel',onEnd);
      resolve();
    };
    const onEnd = ev=>{ if (ev.target===el) finish(); };
    el.addEventListener('animationend',onEnd);
    el.addEventListener('animationcancel',onEnd);
    const timer = setTimeout(finish,Math.max(1,expectedMs||1000)+250);
  }));
  els.forEach(el=>void el.offsetWidth);
  return Promise.all(waits);
}

function settleRunModules(g,station){
  resetRunSeatDOM(g);
  if (station){
    station.getAnimations().forEach(a=>a.cancel());
    station.classList.remove('run-deck-out','run-deck-in');
    ['opacity','visibility','animation','will-change'].forEach(k=>station.style.removeProperty(k));
    station.style.transform = '';
  }
}

async function beginNextRunTable(){
  const g = game;
  if (!g || !g.run || !g.run.active || !g.over || g._transitioning) return;
  g._transitioning = true;
  // NEXT TABLE depresses -> the action console becomes unavailable
  // immediately: hideAwardConsole() (inside exitResultsConsole) drops the
  // console-face-award's pointer-events the instant the class is removed,
  // well before the flip's own visual transition finishes, so a second
  // tap can't land — combined with the _transitioning guard above, this
  // can't re-enter mid-transition either way.
  exitResultsConsole();
  await sleep(motionOff() ? 0 : 120);

  // Defensive no-op in the normal path — everything was already mucked
  // before the results stage rolled in (see showTableCleared). Kept so any
  // future/dev entry point that reaches here directly still starts clean.
  await muckCards();

  // The results face drops away while a fresh, empty table face descends
  // from above — same direction, same joined-wheel mechanism as
  // live-table -> TABLE CLEARED (see rollStageTransition, 06-presentation.js).
  // Opponents are NOT part of this move: they populate onto the
  // already-static stage afterward, below.
  await rollStageTransition(felt=>{
    // orchestrator already reset felt to its bare 'felt' class (no
    // results-mode) before calling this — just tear down its content.
    const rc = felt.querySelector('#result-card');
    if (rc) rc.remove();
    resetForNextRunTable(g);
    pendingHumanPlayer = null;
    coachToken++;
    clearAllCardDOM();
    const potArea = felt.querySelector('#pot-area');
    if (potArea) potArea.classList.add('hidden');
    if ($('pot-val')) $('pot-val').textContent = '0';
    applyRunTheme();
    hideHudResultConsole();
    hideReview();
    setBanner('Preparing Table '+g.run.tableNumber+'…');
    if ($('table-meta')) $('table-meta').textContent = 'Preparing Table '+g.run.tableNumber;
  },{brisk:true});

  // The dashboard only wakes once the fresh stage has actually locked in —
  // never while it's still moving. Actual poker controls (FOLD/CHECK/RAISE
  // becoming pressable) come later still, via the normal continueAction()/
  // updateActionControls() path once startNewHand() genuinely deals in.
  powerUpDashboard();

  const station = document.querySelector('.dealer-station');
  initSeats();
  resetRunSeatDOM(g);
  const arriving = [];
  g.players.filter(p=>!p.isHuman).forEach((p,i)=>{
    const e = seatEls[p.id];
    if (!e) return;
    e.root.style.setProperty('--run-stagger',(i*ELIMINATION_RUN_CONFIG.seatStaggerMs)+'ms');
    e.root.classList.add('run-drop-in');
    arriving.push(e.root);
  });
  if (station) station.classList.add('run-deck-in');
  await waitForRunAnimations([...arriving,station],ELIMINATION_RUN_CONFIG.seatArrivalMs +
    (arriving.length-1)*ELIMINATION_RUN_CONFIG.seatStaggerMs);
  settleRunModules(g,station);

  const callout = document.createElement('div');
  callout.className = 'table-round-callout';
  callout.textContent = 'TABLE '+g.run.tableNumber;
  callout.style.setProperty('--run-announce-ms',ELIMINATION_RUN_CONFIG.announcementMs+'ms');
  $('felt').appendChild(callout);
  await waitForRunAnimations([callout],ELIMINATION_RUN_CONFIG.announcementMs);
  callout.remove();
  await sleep(motionOff() ? 0 : ELIMINATION_RUN_CONFIG.readyBeatMs);
  if (game!==g || !g.run.active) return;
  settleRunModules(g,station);
  g._transitioning = false;
  g.over = false;
  startNewHand();
}

/* ---------------- main loop ---------------- */
async function continueAction(){
  while (true){
    if (game.over) return;
    if (checkHandEndedByFold()){ await handleFoldWin(); return; }
    if (isBettingRoundComplete()){
      await advancePhase();
      if (game.phase==='showdown'){ await handleShowdown(); return; }
      if (game.phase==='foldwin'){ await handleFoldWin(); return; }
      continue;
    }
    const idx = findNextActor(game.turnPointer);
    if (idx===-1){ await advancePhase(); continue; }
    game.currentIndex = idx;
    const player = game.players[idx];
    render();

    // DEV MODE — a control (KO NEXT / WIN HAND / BUST ME) armed this
    // player's next action ahead of time; consume it here with the exact
    // same production applyAction() call a real decision would use, for
    // whichever player's turn it now genuinely is (human or AI). See
    // devForceAllIn()/devAutoResolveTurn(). No-ops entirely when unset.
    if (DEV_MODE && (player._devForceAllIn || player._devAutoCall)){
      const forcedAllIn = !!player._devForceAllIn;
      player._devForceAllIn = false; player._devAutoCall = false;
      const toCall = Math.max(0, game.currentBet - player.betThisRound);
      applyAction(player, { action: forcedAllIn ? 'allin' : (toCall>0 ? 'call' : 'check') });
      game.turnPointer = idx+1;
      render();
      await pacedSleep(600);
      bannerOverride = null;
      continue;
    }

    if (player.isHuman){
      pendingHumanPlayer = player;
      game._humanDecisionStartedAt=Date.now();
      $('actions-row').classList.remove('hidden');
      Sound.turn(); haptic(18);
      updateActionControls();
      updateCoach();
      return;
    }

    const seatEl = seatEls[player.id];
    if (seatEl) seatEl.root.classList.add('thinking');
    setMood(player.id, pickThinkMood(player));
    setActionRows(player.name,'IS THINKING…',true);
    const decision = await aiDecide(player, game);   // off the main thread
    await aiWait(aiThinkTime(player, decision, game));   // QUICK RESOLVE can cut this short
    if (seatEl) seatEl.root.classList.remove('thinking');
    if (game.over) return;
    applyAction(player, decision);
    game.turnPointer = idx+1;
    render();
    await pacedSleep(380);
    bannerOverride = null;
  }
}

async function humanAct(action, amount){
  if (!pendingHumanPlayer) return;
  const p = pendingHumanPlayer;
  if (game && Number.isFinite(game._humanDecisionStartedAt)){
    game._humanDecisionMs += Math.max(0,Date.now()-game._humanDecisionStartedAt);
    game._humanDecisionStartedAt=null;
  }
  captureArcadeDecision(p,action,amount);
  pendingHumanPlayer = null;
  coachToken++;                 // cancel any in-flight coach calculation
  clearHumanReadouts();
  closeRaisePanel();
  // Row stays visible — the render() below calls updateActionControls(),
  // which dims it automatically now that pendingHumanPlayer is null.
  applyAction(p, {action, amount});
  game.turnPointer = game.players.indexOf(p)+1;
  render();
  // Pass 3D: a real yield here, before advancing to the next actor — the
  // same breather continueAction()'s own AI loop already takes between
  // turns (render(); await sleep(...)). Without it, a human bet/call/raise
  // that doesn't end the betting round runs straight into continueAction()
  // synchronously finding the next actor and rendering AGAIN, all in the
  // same tick as the chip flight this action just launched (see
  // applyAction/transferChips) — two renders back to back with no yield,
  // right on top of the freshly-launched flight's own paint-guarantee
  // window. Every other path that launches a flight (AI turns, payouts)
  // already has a real yield immediately after its own render() call; this
  // was the one place that didn't, and it's the one path users reported as
  // visually unreliable.
  await pacedSleep(420);
  bannerOverride = null;
  continueAction();
}
