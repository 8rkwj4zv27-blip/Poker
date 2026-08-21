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

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
// FAST DEV-aware sleep for the handful of fixed showdown/action pacing
// beats that don't already run through speedMult() (see there) — never
// used inside playElimination, which always calls plain sleep() with its
// real config timings so K.O./ELIMINATED speed is never affected.
function pacedSleep(ms){ return sleep((DEV_MODE && FAST_DEV) ? Math.round(ms * FAST_DEV_TIME_MULT) : ms); }
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
  const personas = pickPersonalities(numOpponents);
  const usedNames = new Set();
  for (let i=0;i<numOpponents;i++){
    const displayName = settings.opponentNames === 'random' ? randomOpponentName(usedNames) : personas[i].name;
    players.push(makePlayer('ai'+i, displayName, false, stack, personas[i]));
  }
  assignFaceColors(players);
  const lvl = opts.mode==='tournament' ? 0 : opts.blindLevel;
  const smallBlind = elim ? ELIMINATION_CONFIG.smallBlind : BLIND_LEVELS[lvl][0];
  const bigBlind = elim ? ELIMINATION_CONFIG.bigBlind : BLIND_LEVELS[lvl][1];
  game = {
    players, difficulty:opts.difficulty, mode:opts.mode,
    startingStack:stack, blindLevel:lvl,
    smallBlind, bigBlind,
    board:[], deck:[], pot:0, currentBet:0, minRaise:bigBlind,
    dealerIndex:-1, sbIndex:-1, bbIndex:-1, currentIndex:-1, turnPointer:0,
    phase:'setup', handNumber:0, log:[], over:false,
    buyIns:stack, netStart:stack,
    livesEnabled: opts.mode==='cash' && !!settings.lives,
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
      faceColorIdx: Number.isInteger(p.faceColorIdx) ? p.faceColorIdx : null
    }))
  };
  if (g.mode==='elimination' && g.run) snapshot.run=JSON.parse(JSON.stringify(g.run));
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
  if (!motionOff()){
    el.classList.remove('crt-refresh'); void el.offsetWidth; el.classList.add('crt-refresh');
    clearTimeout(el._crtRefreshT);
    el._crtRefreshT=setTimeout(()=>el.classList.remove('crt-refresh'),250);
  }
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
  // A manual save during this hand resumes from this clean checkpoint,
  // never from a half-settled pot or partially completed betting round.
  g._safeSave=serializeTable(g);
  bannerOverride = null;
  g._humanCardsVisible = false;
  hideResultCard();
  hideHudResultConsole();
  clearAllCardDOM();
  updateHandInstrument();

  // tournament: blinds climb; cash: AI top up so the table stays alive
  if (g.mode === 'tournament'){
    const target = Math.min(BLIND_LEVELS.length-1, Math.floor(g.handNumber / TOURNAMENT_HANDS_PER_LEVEL));
    if (target !== g.blindLevel){
      g.blindLevel = target;
      g.smallBlind = BLIND_LEVELS[target][0];
      g.bigBlind = BLIND_LEVELS[target][1];
      logMsg('Blinds up — ' + g.smallBlind + ' / ' + g.bigBlind, true);
    }
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
  if (g.run&&g.run.arcade) g.run.arcade.decisionSnapshots=[];
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
          // Marks the true state immediately (even though flipCard's own
          // visual swap lands a beat later via its internal timeout) so
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
    // dealCardFlight()/flipCard() themselves (real deal/land/flip
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
    for (let i=0;i<boardEls.length;i++){
      flipCard(boardEls[i], false, cards[i], false, 'board');
      if (i < boardEls.length-1) await sleep(Math.round(50 * speedMult()));
    }
    await sleep(Math.round(90 * speedMult()));
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
  const delay = motionOff() ? 700 : Math.round(2600 * speedMult());
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
    setMood(player.id, restingMood(player));
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

function computePots(players){
  const contributors = players.filter(p=>p.totalBetHand>0);
  const levels = [...new Set(contributors.map(p=>p.totalBetHand))].sort((a,b)=>a-b);
  const pots = [];
  let prev = 0;
  for (const level of levels){
    const layer = level - prev;
    const payers = contributors.filter(p=>p.totalBetHand >= level);
    const amount = layer * payers.length;
    if (amount>0) pots.push({ amount, eligible: payers.filter(p=>!p.folded).map(p=>p.id) });
    prev = level;
  }
  return pots;
}

async function handleFoldWin(){
  const g = game;
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
  recordPot(amt);
  setBanner('<b>' + esc(winner.name) + '</b> takes the pot…');
  render();
  await sleep(motionOff() ? 80 : 250);
  if (winner.isHuman){ stats.won++; Sound.resultSting('humanWin'); haptic(30); }
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
  const potResults = [{
    label:'Pot', amount:amt, winners:[winner.name], winnerIds:[winner.id],
    eligible:[winner.id],
    winnerShares:[{name:winner.name, id:winner.id, amount:amt}],
    hand:null, cat:null, cards:null, contested:1, split:false
  }];
  await runShowdownAwardSequence(potResults, []);
}

async function handleShowdown(){
  const g = game;
  // Defensive: inHand/folded should already exclude an eliminated player
  // from ever reaching here (see resolveEliminations/startNewHand), but
  // showdown eligibility is the one place a missed elimination would do
  // real damage (an eliminated seat winning a pot) — the explicit
  // !p.eliminated guard costs nothing and makes that impossible.
  const contenders = g.players.filter(p=>p.inHand && !p.folded && !p.eliminated);
  const pots = computePots(g.players);
  recordPot(pots.reduce((s,p)=>s+p.amount,0));

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
      // syncCardRow → flipCard for each of this player's real cards,
      // which now plays its own FWAP exactly at the true reveal moment
      // (see flipCard). That naturally reproduces "FWAP … beat … FWAP"
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
  setBanner('<b>' + esc(mainResult.winners.join(' & ')) + '</b> ' + (mainResult.split ? 'split' : 'wins') + ' the pot.');

  // faces react to the result — and big swings leave a lingering mood
  const bbv = g.bigBlind;
  contenders.forEach(p=>{
    if (p.isHuman) return;
    const won = winnerIds.has(p.id);
    if (won){
      const swing = p._award || 0;
      if (swing > 12*bbv) nudgeMood(p, 'up', Math.min(1, swing/(30*bbv) + 0.4));
      reactToWin(p, swing / bbv);
    } else {
      const lost = p.totalBetHand || 0;
      const strong = p._handRes && p._handRes.result.cat >= 2;   // two pair or better, and it still lost — public by now, showdown reveals hands
      const stung = lost > 10*bbv || lost > (p.chips + lost)*0.3;
      if (stung) nudgeMood(p, strong ? 'steamed' : 'down', strong ? 0.8 : 0.6);
      // Visible reaction takes only public quantities (loss in BB, and
      // whether it stung relative to their own stack). Whether this is a
      // genuine repeat — and so deserves a deepening beat — is decided
      // inside reactToLoss from faceMood, not from `strong` above: `strong`
      // is a hand-strength read and must never steer a portrait, even
      // though the cards are already face-up by this point.
      reactToLoss(p, lost / bbv, stung);
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
    stats.won++; stats.showdownsWon++;
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
function trackEliminationHand(g,outcome,human){
  const run=g.run;
  if (!run || !run.active) return;
  const won=humanWonOutcome(outcome);
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
  const award=humanAwardFromOutcome(outcome);
  run.biggestPotWon=Math.max(run.biggestPotWon,award);
  run.tableBiggestPotWon=Math.max(run.tableBiggestPotWon,award);
  run.highestStack=Math.max(run.highestStack,human.chips);
  run.tableHighestStack=Math.max(run.tableHighestStack,human.chips);
  if (human.chips<=0) captureHumanBuster(g,outcome);
}

function recordPot(amount){
  if (amount > stats.biggestPot) stats.biggestPot = amount;
}

async function finishHand(outcome){
  const g = game;
  // In a Single Player run the physical controls remain in their bay and
  // visibly lose power while the payout/K.O. sequence resolves. Other
  // modes keep their existing between-hand behaviour.
  if (g.mode==='elimination' && g.run && g.run.active){
    $('actions-row').classList.remove('hidden');
    $('actions-row').classList.add('disabled');
  } else $('actions-row').classList.add('hidden');
  closeRaisePanel();
  clearHumanReadouts();
  showReview(outcome);

  stats.hands++;
  const human = g.players.find(p=>p.id==='you');
  if (g.mode==='elimination') trackEliminationHand(g,outcome,human);
  stats.net = human.chips - g.buyIns;
  saveStats();
  renderStats();

  const delta = human.chips - (g._humanStart != null ? g._humanStart : human.chips);
  if (delta > g.sess.bestWin) g.sess.bestWin = delta;
  if (delta < g.sess.worstLoss) g.sess.worstLoss = delta;

  if (g.mode === 'tournament'){
    const alive = g.players.filter(p=>p.chips>0 && !p.eliminated);
    g.players.forEach(p=>{ if (p.chips<=0) p.eliminated = true; });
    if (human.chips<=0){
      const place = alive.length + 1;
      setBanner('Knocked out in <b>' + ordinal(place) + '</b> place.');
      Sound.busted(true);
      $('btn-new-table').classList.remove('hidden');
      g.over = true; clearTableSave(); render(); return;
    }
    if (alive.length<=1){
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
    await resolveArcadeHandLate(g,outcome,{
      koCount,
      tableClear:human.chips>0&&aiRemaining.length===0
    });
    if (human.chips<=0){ showBusted(g, human); return; }
    if (aiRemaining.length===0){
      await sleep(motionOff() ? 0 : ELIMINATION_CONFIG.clearedBeatMs);
      concludeGame();
      return;
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
  setBanner('Hand complete.');
  render();
  saveTable();
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

function concludeGame(){
  if (game.mode==='elimination' && game.run && game.run.active){
    showTableCleared(game);
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
function resultStat(label,value,cls){
  return '<div class="result-stat '+(cls||'')+'"><span class="result-stat-label">'+esc(label)+'</span>'+
    '<strong class="result-stat-value tabular">'+esc(String(value))+'</strong></div>';
}
function bestHandResultHTML(best){
  if (!best){
    return '<section class="result-best empty"><div class="result-section-label">BEST HAND</div>'+
      '<div class="result-best-empty">NO SHOWDOWN HAND RECORDED</div></section>';
  }
  const split=splitHandText(best.result.cat,best.name);
  const displayCards=arrangeHandForDisplay(best.result.cat,best.cards);
  const cards=displayCards.map(c=>'<div class="'+cardClass(false,c,true)+'" aria-label="'+esc(cardLabel(false,c))+'">'+cardInner(c)+'</div>').join('');
  return '<section class="result-best"><div class="result-section-label">BEST HAND</div>'+
    '<div class="result-best-name">'+esc(split.category.toUpperCase())+'</div>'+
    (split.descriptor?'<div class="result-best-desc">'+esc(split.descriptor)+'</div>':'')+
    '<div class="result-best-cards">'+cards+'</div></section>';
}
/* BEST HAND trophy case for the results stage — deliberately NOT
   bestHandResultHTML()/.result-best (that markup is shared with
   runOverHTML's dense run-report grid and stays untouched). Pure normal
   flow, no absolute positioning: label, then the five cards, then the
   hand name, then its subtype, stacked and centred — nothing can overlap
   because nothing is pulled out of flow. */
function tableBestHandTrophyHTML(best){
  if (!best){
    return '<div class="stage-trophy pc-display" data-result-beat="trophy">'+
      '<div class="stage-trophy-label">Best hand</div>'+
      '<div class="stage-trophy-empty">No showdown hand recorded</div></div>';
  }
  const split=splitHandText(best.result.cat,best.name);
  const displayCards=arrangeHandForDisplay(best.result.cat,best.cards);
  const cards=displayCards.map(c=>'<div class="'+cardClass(false,c,true)+'" aria-label="'+esc(cardLabel(false,c))+'">'+cardInner(c)+'</div>').join('');
  return '<div class="stage-trophy pc-display" data-result-beat="trophy">'+
    '<div class="stage-trophy-label">Best hand</div>'+
    '<div class="stage-trophy-cards">'+cards+'</div>'+
    '<div class="stage-trophy-name">'+esc(split.category.toUpperCase())+'</div>'+
    (split.descriptor?'<div class="stage-trophy-desc">'+esc(split.descriptor)+'</div>':'')+
  '</div>';
}
function tableReportStatPages(r){
  const hands=Math.max(0,r.tableHands||0);
  const won=Math.max(0,r.tableHandsWon||0);
  const core=[
    {label:'Hands won',value:ratioResult(won,hands)},
    {label:'Showdowns won',value:ratioResult(r.tableShowdownsWon,r.tableShowdownsPlayed)},
    {label:'Biggest pot',value:moneyResult(r.tableBiggestPotWon)}
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
function tableReportStatBankHTML(r){
  return tableReportStatPages(r)[0].map((stat,i)=>
    '<div class="stage-recap-cell" data-stage-stat="'+i+'"><span class="stage-instrument-label">'+esc(stat.label)+'</span>'+
      '<strong class="stage-recap-value tabular">'+esc(stat.value)+'</strong></div>'
  ).join('');
}
/* The results stage itself — not a card floating over the felt, not a
   cleared poker table with stats on it. See .felt.results-mode /
   rollStageTransition() in 06-presentation.js, which places this into the
   real #felt (reskinned but keeping the felt's own curved-corner
   silhouette) as the incoming stage. Built from the .pc-* physical-cabinet
   primitives shared with the main menu, using that screen's fixed leather,
   cream-plastic, green-display and amber-lamp palette so a table theme can
   never make the intermission feel like a different game. RUN SCORE is
   deliberately NOT repeated here — the fixed
   SCORE cabinet directly above the bay already shows it. BANKROLL is the
   one persistent, forward-carrying number, so it gets the strongest
   instrument treatment (the same digit-cell readout as the live stack
   readout); its '$' placeholder digits are filled for real by
   buildResultAmount() right after this HTML is inserted (see
   showTableCleared()) — string-built zeros here would otherwise flash
   before being replaced. Returns the INNER content only — the caller's own
   element carries class="stage-results" id="result-card" directly, so this
   never nests a second .stage-results/.result-card box inside itself. */
function tableClearedHTML(g){
  const r=g.run;
  const a=r.arcade||makeArcadeRunState();
  const opponents = runOpponentCount(g);
  const trackedStart=Number.isFinite(r.tableScoreStart) ? r.tableScoreStart : null;
  const scoreLabel=trackedStart==null ? 'Run score' : 'Table score';
  const koLamps = Array.from({length:opponents}, (_,i)=>
    '<span class="stage-ko-slot'+(i<r.tableKOs?' lit':'')+'"></span>').join('');
  const perfect = r.tableKOs===opponents && r.tableShowdownsPlayed>0 && r.tableShowdownsWon===r.tableShowdownsPlayed;
  return '<div class="stage-results-machine pc-material-leather">'+
    '<header class="stage-results-head pc-raised pc-material-plastic">'+
      '<span>TABLE '+r.tableNumber+'</span><strong>CLEARED</strong><i aria-hidden="true"></i></header>'+
    '<div class="stage-score-hero pc-display">'+
      '<span class="stage-instrument-label">'+scoreLabel+'</span>'+
      '<div class="amt-readout stage-score-readout" id="stage-results-score"></div>'+
      '<span class="stage-score-carry"><span>RUN TOTAL</span><strong class="tabular">'+formatArcadeScore(a.score)+'</strong></span></div>'+
    '<div class="stage-results-deck pc-raised pc-material-plastic">'+
      '<div class="stage-results-instruments" data-result-beat="instruments">'+
        '<div class="stage-instrument pc-display"><span class="stage-instrument-label">Finish stack</span>'+
          '<div class="amt-readout" id="stage-results-stack"></div></div>'+
        '<div class="stage-instrument pc-display"><span class="stage-instrument-label">K.O.s</span>'+
          '<div class="stage-ko-lamps">'+koLamps+'</div>'+
          '<div class="stage-ko-readout tabular">'+r.tableKOs+' / '+opponents+'</div></div>'+
      '</div>'+
      '<div class="stage-results-recap pc-display" id="stage-stat-bank" data-result-beat="recap">'+
        tableReportStatBankHTML(r)+'</div>'+
      (perfect ? '<div class="stage-recap-lamp"><span class="pc-lamp is-amber"></span>'+
        '<span class="stage-recap-lamp-text">FLAWLESS SHOWDOWNS</span></div>' : '')+
    '</div>'+
    tableBestHandTrophyHTML(r.tableBestHand)+
    '<div class="stage-run-progress pc-display" data-result-beat="progress">'+
      '<span>TABLES CLEARED</span><strong class="tabular">'+r.tablesCleared+'</strong>'+
      '<em>NEXT: TABLE '+(r.tableNumber+1)+'</em></div>'+
  '</div>';
}
async function wakeTableResults(g){
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
  revealResultAmount($('stage-results-score'),true);
  await sleep(180);
  if (game!==g || !el.isConnected) return false;
  if (!await beat('wake-instruments',170)) return false;
  revealResultAmount($('stage-results-stack'),false);
  if (!await beat('wake-recap',150)) return false;
  if (!await beat('wake-trophy',140)) return false;
  if (!await beat('wake-progress',110)) return false;
  startTableStatCycle(g,el);
  return true;
}
function startTableStatCycle(g,el){
  const bank=el && el.querySelector('#stage-stat-bank');
  const pages=g && g.run ? tableReportStatPages(g.run) : [];
  if (!bank || pages.length<2 || motionOff()) return;
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
function runOverHTML(g){
  const r=g.run;
  const buster=r.bustedBy;
  const a=r.arcade||makeArcadeRunState();
  return '<div class="result-bezel result-bezel-loss">' +
    '<div class="result-eyebrow danger-eye">RUN TERMINATED <i></i> NO REBUY</div>'+
    '<header class="result-head result-head-loss"><strong>RUN OVER</strong><span>BUSTED ON TABLE '+r.tableNumber+'</span></header>'+
    '<div class="final-score-panel"><span>FINAL SCORE</span><strong class="tabular" id="final-score-value">0000000</strong>'+
      (a.newHighScore?'<span class="new-high-score">NEW HIGH SCORE</span>':'')+'</div>'+
    '<div class="run-progress-hero"><div><span>TABLE</span><strong class="tabular">'+r.highestTableReached+'</strong><em>REACHED</em></div>'+
      '<div><strong class="tabular">'+r.tablesCleared+'</strong><span>TABLES<br>CLEARED</span></div></div>'+
    '<div class="run-report-grid">'+
      resultStat('Hands won',ratioResult(r.totalHandsWon,r.totalHands),'')+
      resultStat('Scoring events',Object.values(a.awardCounts||{}).reduce((sum,n)=>sum+(n||0),0),'')+
      resultStat('Total hands',r.totalHands,'')+
      resultStat('K.O.s',r.totalKOs,'ko-stat')+
    '</div>'+
    '<div class="run-highlight-row">'+
      resultStat('Biggest pot won',moneyResult(r.biggestPotWon),'accent-stat')+
      resultStat('Biggest reward','+'+a.biggestReward.toLocaleString(),'')+
    '</div>'+
    bestHandResultHTML(r.bestHand)+
    (buster?'<div class="run-epitaph"><span>BUSTED BY</span><strong>'+esc(buster.names.join(' & ').toUpperCase())+'</strong>'+
      (buster.hand?'<em>'+esc(buster.hand)+'</em>':'')+'</div>':'')+
    '<div class="run-result-actions"><button class="btn-primary result-primary" id="run-new" type="button">NEW RUN</button>'+
      '<button class="btn-secondary result-secondary" id="run-menu" type="button">MAIN MENU</button></div>'+
  '</div>';
}

async function showTableCleared(g){
  if (g._tableClearedShown) return;
  g._tableClearedShown = true;
  g.over = true;
  clearTableSave();
  clearTimeout(autoDealT);
  hideResultCard();
  g.run.tablesCleared = Math.max(g.run.tablesCleared, g.run.tableNumber);
  setBanner('<b>Table cleared.</b> Every opponent is eliminated.');
  $('actions-row').classList.remove('hidden');
  $('actions-row').classList.add('disabled');
  if ($('action-console')) $('action-console').classList.add('results-pending');
  $('btn-next-hand').classList.add('hidden');
  $('btn-new-table').classList.add('hidden');

  // Clean the felt before the mechanical beats start — no cards travelling
  // mid-roll. muckCards() flicks every remaining board/hole card (the
  // human's own included, even though it lives in the fixed HUD dock, not
  // on the stage) back into the deck and fully resolves before we move on.
  await muckCards();
  // Dashboard begins powering down (hand-strength/bet/blind lamps go dark
  // in place; BANKROLL stays lit) while the felt still has its breathing
  // beat — one pause serves both "let the dormant transition settle" and
  // "brief clean-machine beat before the latch clicks".
  powerDownDashboard(g);
  await sleep(motionOff() ? 0 : STAGE_ROLL_CONFIG.breatheMs);

  const human = g.players.find(p=>p.isHuman);
  await rollStageTransition(felt=>{
    clearAllCardDOM();
    felt.querySelectorAll('.seat').forEach(s=>s.remove());
    const potArea = felt.querySelector('#pot-area');
    if (potArea) potArea.classList.add('hidden');
    if ($('pot-val')) $('pot-val').textContent = '0';
    g.board = []; g.pot = 0;
    felt.classList.add('results-mode');
    const el = document.createElement('div');
    el.className = 'stage-results'; el.id = 'result-card';
    el.innerHTML = tableClearedHTML(g);
    felt.appendChild(el);
    buildResultAmount(document.getElementById('stage-results-stack'), human ? human.chips : 0);
    const scoreStart=Number.isFinite(g.run.tableScoreStart) ? g.run.tableScoreStart : null;
    const tableScore=scoreStart==null ? g.run.arcade.score : Math.max(0,g.run.arcade.score-scoreStart);
    buildResultCounter(document.getElementById('stage-results-score'),tableScore,'+');
  });

  render();
  await wakeTableResults(g);

  // Only once the stage has genuinely locked does the action console
  // change mode — never expose NEXT TABLE (or leave FOLD/CHECK/RAISE
  // reachable) while anything is still moving.
  await sleep(motionOff() ? 0 : STAGE_ROLL_CONFIG.consoleFlipBeatMs);
  enterResultsConsole(beginNextRunTable);
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
    if (ko && g.run && g.run.active){ g.run.totalKOs++; g.run.tableKOs++; humanKOs++; }
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

async function showRunOver(g){
  g.over = true;
  finalizeArcadeRun(g);
  clearTableSave();
  clearTimeout(autoDealT);
  hideResultCard();
  setBanner('<b>Run over.</b> Out of chips.');
  Sound.busted(true);
  $('table-screen').classList.add('run-dead');
  await sleep(motionOff()?0:320);
  if (game!==g) return;
  const el = document.createElement('div');
  el.className = 'result-card run-results gameover run-over-report'; el.id = 'result-card';
  el.innerHTML = runOverHTML(g);
  $('table-screen').appendChild(el);
  $('actions-row').classList.add('hidden');
  $('btn-next-hand').classList.add('hidden');
  $('btn-rebuy').classList.add('hidden');
  $('btn-new-table').classList.add('hidden');
  // A fresh run straight off RUN OVER keeps the table size the player was
  // already playing — it's a retry, not a trip back through the picker.
  const sameSizeAgain = runOpponentCount(g);
  $('run-new').onclick = ()=>startSinglePlayerRun({opponentCount:sameSizeAgain});
  $('run-menu').onclick = leaveTable;
  render();
  animateFinalArcadeScore(g);
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
    await sleep(aiThinkTime(player, decision, game));
    if (seatEl) seatEl.root.classList.remove('thinking');
    if (game.over) return;
    applyAction(player, decision);
    game.turnPointer = idx+1;
    render();
    await pacedSleep(600);
    bannerOverride = null;
  }
}

async function humanAct(action, amount){
  if (!pendingHumanPlayer) return;
  const p = pendingHumanPlayer;
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
  await pacedSleep(600);
  bannerOverride = null;
  continueAction();
}
