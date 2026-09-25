"use strict";

/* ============================================================
   DEV MODE — Phase 1 rapid elimination-mode test panel (see the Phase 1
   plan §14). Entirely absent from the DOM/UI when DEV_MODE is false.
   Every control mutates real `game` state and drives it through the
   actual production resolution functions (applyAction, continueAction,
   handleShowdown/handleFoldWin, finishHand, resolveEliminations) — never
   a parallel fake-presentation path. Two shared primitives do the work:
     - devForceAllIn(player): arms a REAL forced all-in for that player's
       very next action (applied immediately via the same applyAction()/
       humanAct() calls a real decision would use, if it's already their
       turn; otherwise queued as a one-shot flag consumed by
       continueAction() the moment it genuinely becomes their turn).
     - devRigForWinner(player): rigs the still-undealt deck (and, pre-deal,
       that player's hole cards) so their eventual best hand is
       overwhelmingly likely to win — a deterministic starting position,
       not a fabricated result; evaluate7WithCards/handleShowdown/
       finishHand still run for real afterward.
   WIN HAND / KO NEXT / BUST ME only ever fold (real applyAction('fold'))
   or force-all-in remaining players, which is always safe mid-hand — pot
   bookkeeping stays correct either way. CLEAR TABLE instead removes
   players from the table entirely, which is only safe BETWEEN hands (no
   live pot to corrupt), so it's gated separately from the other three. */
function handInProgress(){
  return !!game && !game.over && ['preflop','flop','turn','river'].includes(game.phase);
}
function betweenHands(){
  return !!game && !game.over && !handInProgress();
}

function devAutoResolveTurn(player, action){
  if (!game || !player || player.folded || player.allIn) return;
  if (player.isHuman && pendingHumanPlayer === player){
    if (action==='allin') humanAct('allin');
    else humanAct(Math.max(0, game.currentBet-player.betThisRound) > 0 ? 'call' : 'check');
  } else {
    if (action==='allin') player._devForceAllIn = true;
    else player._devAutoCall = true;
  }
}
function devForceAllIn(player){ devAutoResolveTurn(player, 'allin'); }

function devRigForWinner(targetPlayer){
  if (!game || !targetPlayer) return;
  const g = game;
  const used = new Set();
  g.players.forEach(p=>{ if (p.inHand) (p.hand||[]).forEach(c=>used.add(cardKey(c))); });
  g.board.forEach(c=>used.add(cardKey(c)));
  if (!targetPlayer.hand || targetPlayer.hand.length===0){
    for (let i=RANKS.length-1; i>=0; i--){
      const r = RANKS[i];
      const avail = SUITS.filter(s=>!used.has(r+s));
      if (avail.length>=2){
        targetPlayer.hand = avail.slice(0,2).map(s=>({rank:r, suit:s, value:RANK_VALUES[r]}));
        targetPlayer.hand.forEach(c=>used.add(cardKey(c)));
        break;
      }
    }
  }
  const targetRanks = new Set(targetPlayer.hand.map(c=>c.rank));
  // g.deck is dealt via .pop() (see dealCommunity/startNewHand), so cards
  // that favour the target need to sort toward the END of the array.
  g.deck.sort((a,b)=>{
    const av = targetRanks.has(a.rank) ? 1 : 0, bv = targetRanks.has(b.rank) ? 1 : 0;
    return av - bv;
  });
}

/* Which modes the TABLE-testing controls may drive. These controls work by
   playing the real game — rigging the deck, folding opponents, forcing a
   real all-in — so they are safe anywhere the ordinary table lifecycle
   runs. They never create or mutate an Arcade run and never write to
   felt.arcade; Career settlement stays behind endCareerEvent()'s guards.
   Controls that genuinely depend on Arcade RUN state (devRapidHands' run
   loop) or the Arcade PROFILE keep their own narrower checks. */
function devTableTestable(g){
  g = g || game;
  return !!g && (g.mode === 'elimination' || g.mode === 'career');
}

function devWinHand(){
  if (!handInProgress() || !devTableTestable()) return;
  const g = game, human = g.players.find(p=>p.isHuman);
  devRigForWinner(human);
  g.players.forEach(p=>{
    if (p.isHuman || !p.inHand || p.folded || p.allIn || p._devForceAllIn) return;
    applyAction(p, {action:'fold'});
  });
  logMsg('[DEV] WIN HAND armed', true);
  devAutoResolveTurn(human, 'call');
  refreshDevPanel();
}
function devKoNext(){
  if (!handInProgress() || !devTableTestable()) return;
  const target = game.players.find(p=>!p.isHuman && p.inHand && !p.folded && !p.allIn && !p.eliminated && !p._devForceAllIn);
  if (!target) return;
  devForceAllIn(target);
  logMsg('[DEV] ' + target.name + ' armed for a forced all-in', true);
  refreshDevPanel();
}
/* Real gameplay test (section 20/21) — a genuine preflop all-in that only
   steals the blinds, for verifying the scoring regression case directly:
   the shove itself must contribute zero score, only the real net profit
   (arcadePotWinningsScore in js/04-modes-and-scoring.js) should. Folds
   every other live opponent for real via applyAction, same pattern as
   devWinHand/devBustMe above, then forces the human's own pending
   preflop action to a genuine all-in instead of a call. */
function devShoveSteal(){
  if (!handInProgress() || !devTableTestable() || game.phase!=='preflop') return;
  const g = game, human = g.players.find(p=>p.isHuman);
  if (!human.inHand || human.folded || human.allIn) return;
  g.players.forEach(p=>{
    if (p.isHuman || !p.inHand || p.folded || p.allIn || p._devForceAllIn) return;
    applyAction(p, {action:'fold'});
  });
  logMsg('[DEV] SHOVE STEAL armed — human shoves preflop, table folds', true);
  devAutoResolveTurn(human, 'allin');
  refreshDevPanel();
}
/* Real gameplay test (section 20/21) — stress-tests the pre-deal
   hole-card fix (see startNewHand/revealHoleCardsAnimated in
   js/05-game-engine.js) by cycling several real hands back to back as
   fast as the production flow allows, via the exact same WIN HAND path
   above on every hand where the human still has a live decision. Enables
   FAST DEV for the duration so hands turn over quickly; leaves it on
   afterward (matching the existing FAST DEV checkbox behaviour) rather
   than silently reverting a setting the user may have already chosen. */
/* Arcade-only: the loop below is bounded by run.active, and a Career event
   is a single freezeout that ends rather than rolling into another table. */
function devRapidHands(n){
  if (!DEV_MODE || !game || game.mode!=='elimination') return;
  const targetCount = Math.max(1, n||8);
  let done = 0;
  FAST_DEV = true;
  refreshDevPanel();
  logMsg('[DEV] RAPID HANDS x' + targetCount + ' — stress-testing hole-card reveal timing', true);
  const tick = ()=>{
    if (!DEV_MODE || !game || game.mode!=='elimination' || game.over || !game.run || !game.run.active || done>=targetCount) return;
    const human = game.players.find(p=>p.isHuman);
    if (handInProgress() && human && human.inHand && !human.folded && !human.allIn){
      devWinHand();
      done++;
    }
    if (done<targetCount) setTimeout(tick, 140);
  };
  setTimeout(tick, 140);
}
/* Presentation-only preview of the redesigned opponent-ejection sequence
   (physical-polish pass) — calls the exact real playElimination() a live
   hand uses, on a live (non-eliminated) opponent, WITHOUT touching
   p.eliminated/p.chips or going through resolveEliminations() at all, so
   it can never corrupt real elimination state. Resets that seat's own
   presentation state (hit/fail/eject classes, face, streetAction, .dead)
   right before each run so the same seat can be previewed repeatedly
   without a table reset in between. */
function devTestKoEject(){
  if (!DEV_MODE || !devTableTestable()) return;
  const target = game.players.find(p=>!p.isHuman && !p.eliminated);
  if (!target) return;
  const e = seatEls[target.id];
  if (!e || !e.card || !e.root || !e.avatar) return;
  // Strip any physics layer left over from an interrupted previous
  // preview so repeated TEST KO EJECT presses never stack ejected
  // portraits on top of each other.
  document.querySelectorAll('.ko-physics-layer').forEach(l=>l.remove());
  e.card.classList.remove('elim-hit','elim-critical','elim-fail','elim-recoil');
  e.card.style.cssText = '';
  e.root.classList.remove('dead');
  e.avatar.classList.remove('socket-dead');
  const wrap = e.avatar.closest('.avatar-wrap');
  if (wrap) wrap.classList.remove('socket-spark', 'pressure-build');
  target.streetAction = null;
  e.avatar.classList.add('has-face');
  e.avatar.innerHTML = renderFace(target, 'idle');
  render();
  logMsg('[DEV] Previewing K.O. portrait ejection on ' + target.name, true);
  playElimination(target, { ko:true });
}
/* Multi-KO batching preview (pop-emphasis pass) — same "presentation-only,
   never touches real p.eliminated/p.chips/resolveEliminations" contract
   as devTestKoEject above, just for N seats at once so the grouped
   shake-together/staggered-POP/shared-physics-arena behaviour can be
   judged directly without needing a genuine multi-way all-in. `n` is
   clamped to however many live (non-eliminated) opponents actually exist
   (2 or 3 opponents at the table can only ever preview a double, not a
   quad) — repeatable without a table reset, same reset-then-run pattern
   as the single-target preview. */
function devTestKoEjectGroup(n){
  if (!DEV_MODE || !devTableTestable()) return;
  const targets = game.players.filter(p=>!p.isHuman && !p.eliminated).slice(0, n);
  if (targets.length < 2) { logMsg('[DEV] Not enough live opponents for a '+n+'-KO preview', true); return; }
  document.querySelectorAll('.ko-physics-layer').forEach(l=>l.remove());
  targets.forEach(target=>{
    const e = seatEls[target.id];
    if (!e || !e.card || !e.root || !e.avatar) return;
    e.card.classList.remove('elim-hit','elim-critical','elim-fail','elim-recoil');
    e.card.style.cssText = '';
    e.root.classList.remove('dead');
    e.avatar.classList.remove('socket-dead');
    const wrap = e.avatar.closest('.avatar-wrap');
    if (wrap) wrap.classList.remove('socket-spark', 'pressure-build');
    target.streetAction = null;
    e.avatar.classList.add('has-face');
    e.avatar.innerHTML = renderFace(target, 'idle');
  });
  render();
  logMsg('[DEV] Previewing '+targets.length+'-way grouped K.O. ejection on '+targets.map(t=>t.name).join(', '), true);
  playEliminationGroup(targets.map(p=>({ p, ko:true })));
}
function devBustMe(){
  if (!handInProgress() || !devTableTestable()) return;
  const g = game, human = g.players.find(p=>p.isHuman);
  const target = g.players.find(p=>!p.isHuman && p.inHand && !p.folded && !p.eliminated);
  if (!target) return;
  devRigForWinner(target);
  g.players.forEach(p=>{
    if (p.isHuman || p===target || !p.inHand || p.folded || p.allIn || p._devForceAllIn) return;
    applyAction(p, {action:'fold'});
  });
  logMsg('[DEV] BUST ME armed against ' + target.name, true);
  devAutoResolveTurn(human, 'allin');
  refreshDevPanel();
}
function devClearTable(){
  if (!betweenHands() || !devTableTestable()) return;
  const g = game;
  const ais = g.players.filter(p=>!p.isHuman && !p.eliminated);
  if (ais.length <= 1) return;
  // Direct state mutation, not the real elimination pipeline — deliberate
  // and safe here (see the file header above): these AI aren't part of any
  // live pot right now (between hands), and we're not testing THEIR
  // individual elimination, only the final opponent's real K.O./TABLE
  // CLEARED sequence once play resumes.
  ais.slice(1).forEach(p=>{ p.chips=0; p.eliminated=true; p.inHand=false; p.folded=true; p.allIn=false; p._devForceAllIn=false; });
  logMsg('[DEV] Table trimmed to a final opponent', true);
  render();
  refreshDevPanel();
}

/* Visual-progression shortcut: it skips poker prerequisites, then hands off
   to the exact production cleared/results/NEXT TABLE path. It does not own
   or duplicate any transition/result presentation. */
function devEndTable(){
  if (!game || game.over) return;
  // Arcade needs a live run to have somewhere to go next; Career just needs
  // to be a Career table.
  if (game.mode === 'elimination'){ if (!game.run || !game.run.active) return; }
  else if (!devTableTestable()) return;
  const g = game;
  clearTimeout(autoDealT);
  pendingHumanPlayer = null;
  coachToken++;
  closeRaisePanel();
  clearHumanReadouts();
  hideReview();
  g.currentIndex = -1;
  document.querySelectorAll('.ko-physics-layer, .chip-physics-layer, .score-smash-layer').forEach(l=>l.remove());
  g.players.filter(p=>!p.isHuman).forEach((p,idx)=>{
    p.chips=0; p.eliminated=true; p.inHand=false; p.folded=false; p.allIn=false;
    p.betThisRound=0; p.totalBetHand=0; p.acted=true; p.mayRaise=false;
    p.hand=[]; p.streetAction={type:'eliminated',label:'ELIMINATED!',amount:0};
    delete p._devForceAllIn; delete p._devAutoCall;
    const e=seatEls[p.id];
    if (e && e.avatar){
      e._mood=null;
      e.avatar.classList.remove('socket-dead');
      e.avatar.classList.add('has-face');
      e.avatar.innerHTML=renderFace(p,pickDeadMood());
    }
  });
  logMsg('[DEV] Current table ended through production results flow',true);
  // Hands off to whichever production ending owns this mode. For Career
  // that is endCareerEvent(), so DEV wins go through the exact same
  // settle-once guards a real win does — pressing this twice cannot credit
  // the prize twice.
  if (g.mode === 'career') endCareerEvent(g, {place:1});
  else showTableCleared(g);
}

/* ============================================================
   DEV: MAJOR-RESULT TRANSITION TESTER

   Four actions that drive the REAL production presentation — the same
   presentResultStage() path, the same rollStageTransition(), the same
   shared renderer and the same results console every real outcome uses.
   Nothing here animates, styles or lays anything out itself.

   ISOLATION. The fixture is built with newGame(), which is pure: it
   allocates a game object and touches no storage. Nothing in this section
   calls clearTableSave(), saveTable(), saveCareer(), saveArcadeProfile()
   or finalizeArcadeRun(), so no save, no lifetime statistic and no
   persisted high score can move. The two Career fixtures never call
   enterCareerEvent() or settleCareerEvent(): no buy-in is taken, no prize
   is paid, no unlock is granted, and career.bankroll is only ever READ
   for display.

   REPEATABILITY. Each fixture's result console keeps its real label,
   class and physical behaviour, but its action re-arms the tester rather
   than navigating, so a transition can be watched as many times as
   needed. Real destinations (NEXT TABLE, NEW RUN, MAIN MENU, BACK TO
   EVENTS) are exercised by real play, not from here.
   ============================================================ */
const DEV_RESULT_TEST_OPPONENTS = 5;
const DEV_RESULT_TEST_EVENT = 'back-room-freezeout';

function devFixtureCard(rank, suit){
  return { rank, suit, value:RANKS.indexOf(rank) + 2 };
}
/* A genuine evaluated hand rather than a hand-written record: the fixture
   cards go through the real evaluator and the real tracked-hand copier,
   so the trophy case renders exactly what a played hand would produce. */
function devFixtureBestHand(){
  const cards = [
    devFixtureCard('6','♠'), devFixtureCard('6','♦'), devFixtureCard('6','♣'),
    devFixtureCard('8','♦'), devFixtureCard('8','♠')
  ];
  return copyTrackedHand({ result:evaluate5(cards), cards });
}

/* A throwaway table, so the stage has a real outgoing face to roll away
   from. Deliberately built through newGame()/initSeats() rather than
   startSinglePlayerRun() or startCareerEvent(), both of which persist. */
function devBuildResultFixture(kind){
  const career = kind === 'event-won' || kind === 'event-lost';
  if (career){
    const event = careerEventSnapshot(careerEventById(DEV_RESULT_TEST_EVENT));
    newGame({ mode:'career', difficulty:event.difficulty,
      opponents:event.opponentCount, stack:event.stack, blindLevel:event.initialBlindLevel });
    game.event = Object.assign({}, event, { reward:makeEventRewardState() });
  } else {
    newGame({ mode:'elimination', difficulty:settings.difficulty, opponents:DEV_RESULT_TEST_OPPONENTS });
    game.run = makeEliminationRun(DEV_RESULT_TEST_OPPONENTS);
  }
  game._devResultFixture = kind;
  game.handNumber = 4;
  applyRunTheme();
  setArcadeMode(true);
  updateArcadeHUD();
  showTableScreen();
  const felt = $('felt');
  if (felt) felt.classList.remove('results-mode','tone-negative');
  exitResultsConsole();
  clearCompletedEventConsole();
  powerUpDashboard();
  initSeats();
  render();
  return game;
}

/* Arcade fixture figures, chosen to exercise every slot the stage has:
   a padded seven-digit score, a two-page memory bank, a lamp strip and a
   real evaluated best hand. */
function devArcadeResultFixture(g, kind){
  const r = g.run, a = r.arcade;
  a.score = 780; a.displayedScore = 780; a.biggestReward = 400;
  a.awardCounts = { bigWin:1, ko:1 };
  a.newHighScore = kind === 'run-over';
  r.tableNumber = 1; r.highestTableReached = 1;
  r.totalHands = 4; r.totalHandsWon = 3;
  r.totalKOs = kind === 'table-cleared' ? DEV_RESULT_TEST_OPPONENTS : 2;
  r.biggestPotWon = 530;
  r.tableHands = 4; r.tableHandsWon = 3;
  r.tableShowdownsPlayed = 2; r.tableShowdownsWon = 2;
  r.tableAllInsPlayed = 1; r.tableAllInsWon = 1;
  r.tableBiggestPotWon = 530; r.tableHighestStack = 1200;
  r.tableScoreStart = 740;
  r.bestHand = devFixtureBestHand();
  r.tableBestHand = kind === 'table-cleared' ? null : devFixtureBestHand();
  if (kind === 'run-over'){
    r.tablesCleared = 0;
    r.bustedBy = { names:['Maniac'], hand:'Four of a Kind, Sixes' };
    const human = g.players.find(p=>p.isHuman);
    if (human) human.chips = 0;
  } else {
    r.tablesCleared = 1;
    const human = g.players.find(p=>p.isHuman);
    if (human) human.chips = 530;
  }
}

/* The Career display model is built by the REAL builder from a fixture
   settled record — the same object shape settleCareerEvent() writes —
   so the tester exercises buildCareerResultModel() rather than
   bypassing it. Only the bankroll is overridden afterwards, so a test
   never reports the player's real Career balance as if it had moved. */
function devCareerResultModel(g, won){
  const ev = g.event;
  const model = buildCareerResultModel(g, {
    outcome: won ? 'win' : 'loss',
    place: won ? 1 : ev.playerCount,
    prize: won ? ev.prize : 0,
    delta: won ? ev.prize : -ev.buyIn,
    bankroll: 0
  });
  model.bankroll = won ? 600 : 500;   // fixture only; nothing was credited
  return model;
}

function devTestResultStage(kind){
  if (!DEV_MODE) return;
  const g = devBuildResultFixture(kind);
  const rearm = ()=>devTestResultStage(kind);
  logMsg('[DEV] ' + kind.toUpperCase().replace('-', ' ') +
    ' — production transition, fixture state, no settlement', true);
  if (kind === 'table-cleared' || kind === 'run-over'){
    devArcadeResultFixture(g, kind);
    updateArcadeHUD();
    render();                 // let the dashboard settle on the fixture stack first
    g.over = true;
    const negative = kind === 'run-over';
    setBanner(negative
      ? '<b>Run over.</b> Out of chips.'
      : '<b>Table cleared.</b> Every opponent is eliminated.');
    presentResultStage(g, negative ? runOverModel(g) : tableClearedModel(g), {
      prepare: negative ? ()=>Sound.busted(true) : null,
      muck: !negative,
      settle: ()=>powerDownDashboard(g),
      console: negative
        ? ()=>enterRunOverConsole(rearm, rearm)
        : ()=>enterResultsConsole(rearm)
    });
    return;
  }
  const won = kind === 'event-won';
  const model = devCareerResultModel(g, won);
  g.over = true;
  setBanner(won
    ? '<b>Event won.</b> Every opponent is out.'
    : '<b>Event over.</b> You were eliminated.');
  presentResultStage(g, careerStageModel(model), {
    prepare: ()=>{ clearHumanReadouts(); powerDownCompletedEvent(g); },
    muck: won,
    console: ()=>enterCareerResultsConsole(rearm)
  });
}

/* DEV-only fast entry into a Single Player run at an explicit table size.
   Bypasses the menu picker entirely; `opponentCount` is still normalised
   downstream by startSinglePlayerRun, so a bad value can't build an
   unsupported table even from here. */
function devNewEliminationTable(opponentCount){
  startSinglePlayerRun({opponentCount:normalizeOpponentCount(opponentCount)});
  refreshDevPanel();
}

function teardownDevPanel(){
  const panel = $('dev-panel');
  if (panel) panel.remove();
}
function setDevMode(on){
  DEV_MODE = on;
  if (on) initDevPanel(); else teardownDevPanel();
}
/* Settings' own DEVELOPER section — kept out of the normal player-facing
   rows entirely (see #settings-dev-section), only ever shown once
   Developer Mode is switched on via the quiet toggle above it. */
function syncDevSection(){
  const section = $('settings-dev-section');
  if (!section) return;
  section.classList.toggle('hidden', !settings.devMode);
  const readout = $('dev-build-readout');
  if (readout) readout.textContent = 'Build ' + BUILD_VERSION;
}

/* DEV-only Career testing control. This changes only the off-table bankroll
   field in the existing Career record: unlocks, result history and table saves
   are deliberately left alone. Refuse an active event because its buy-in has
   already been staked and changing the ledger mid-event would create a test
   state production can never reach. */
function normalizeDevCareerBankroll(value){
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}
function devSetCareerBankroll(value){
  if (!DEV_MODE || careerHasActiveEvent() || careerHasOpenCashSession()) return false;
  const amount = normalizeDevCareerBankroll(value);
  if (amount === null) return false;
  career.bankroll = amount;
  saveCareer();
  renderCareerScreen();
  return true;
}
function initDevPanel(){
  if (!DEV_MODE) return;
  if ($('dev-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'dev-panel';
  panel.innerHTML =
    '<div id="dev-panel-head">DEV<button id="dev-collapse" type="button">_</button></div>' +
    '<div id="dev-panel-body">' +
      '<label id="dev-fast-row"><input type="checkbox" id="dev-fast-dev"> FAST DEV (skip setup, not K.O.)</label>' +
      '<button id="dev-new-elim" type="button">New Elimination Table</button>' +
      '<div id="dev-controls">' +
        '<button id="dev-win-hand" type="button">WIN HAND</button>' +
        '<button id="dev-ko-next" type="button">KO NEXT</button>' +
        '<button id="dev-bust-me" type="button">BUST ME</button>' +
        '<button id="dev-shove-steal" type="button">SHOVE STEAL (preflop)</button>' +
        '<button id="dev-rapid-hands" type="button">RAPID HANDS x8 (card-flash test)</button>' +
        '<button id="dev-clear-table" type="button">CLEAR TABLE</button>' +
        '<button id="dev-end-table" type="button">END TABLE</button>' +
        '<button id="dev-ko-eject" type="button">TEST KO EJECT</button>' +
        '<button id="dev-ko-eject-2" type="button">TEST DOUBLE KO</button>' +
        '<button id="dev-ko-eject-4" type="button">TEST MULTI KO x4</button>' +
      '</div>' +
      '<div id="dev-result-stage">' +
        '<div class="dev-section-title">MAJOR RESULT TRANSITIONS</div>' +
        '<div class="dev-subtitle">REAL STAGE ROLL · FIXTURE STATE · NO SETTLEMENT</div>' +
        '<button data-result-test="table-cleared" type="button">TEST TABLE CLEARED</button>' +
        '<button data-result-test="run-over" type="button">TEST RUN OVER</button>' +
        '<button data-result-test="event-won" type="button">TEST EVENT WON</button>' +
        '<button data-result-test="event-lost" type="button">TEST EVENT LOST</button>' +
        '<button id="dev-result-reset" type="button">RESET TESTER (BACK TO MENU)</button>' +
      '</div>' +
      '<div id="dev-table-size">' +
        '<div class="dev-section-title">TABLE SIZE</div>' +
        '<div class="dev-subtitle">START A SINGLE PLAYER RUN</div>' +
        '<div id="dev-table-size-row">' +
          '<button data-dev-opponents="4" type="button">4 OPP</button>' +
          '<button data-dev-opponents="5" type="button">5 OPP</button>' +
          '<button data-dev-opponents="6" type="button">6 OPP</button>' +
        '</div>' +
      '</div>' +
      '<div id="dev-career-bankroll">' +
        '<div class="dev-section-title">CAREER BANKROLL</div>' +
        '<div class="dev-subtitle">WHOLE-DOLLAR TEST VALUE · SAVES TO THIS CAREER</div>' +
        '<div id="dev-bankroll-row">' +
          '<input id="dev-bankroll-input" type="number" min="0" step="1" inputmode="numeric" aria-label="Career bankroll" />' +
          '<button id="dev-bankroll-apply" type="button">APPLY</button>' +
        '</div>' +
        '<div id="dev-bankroll-presets">' +
          '<button data-dev-bankroll="0" type="button">$0</button>' +
          '<button data-dev-bankroll="99" type="button">$99</button>' +
          '<button data-dev-bankroll="100" type="button">$100</button>' +
          '<button data-dev-bankroll="500" type="button">$500</button>' +
        '</div>' +
        '<div id="dev-bankroll-status"></div>' +
      '</div>' +
        '<div id="dev-arcade-controls">' +
        '<div class="dev-section-title">ARCADE TEST</div>' +
        '<div class="dev-subtitle">PRESENTATION TIERS (visual only)</div>' +
        '<button data-arcade-scenario="strong" type="button">STRONG — BIG WIN</button>' +
        '<button data-arcade-scenario="elite" type="button">ELITE — DOUBLE UP</button>' +
        '<button data-arcade-scenario="jackpot" type="button">JACKPOT — MASSIVE WIN</button>' +
        '<div class="dev-subtitle">INDIVIDUAL AWARDS</div>' +
        '<button data-arcade-award="bigWin" type="button">BIG WIN +150</button>' +
        '<button data-arcade-award="monsterHand" type="button">MONSTER HAND +200</button>' +
        '<button data-arcade-award="doubleUp" type="button">DOUBLE UP +300</button>' +
        '<button data-arcade-award="ko" type="button">K.O.! +400</button>' +
        '<button data-arcade-award="massiveWin" type="button">MASSIVE WIN +500</button>' +
        '<button data-arcade-award="tableClear" type="button">TABLE CLEARED +1,000</button>' +
        '<button data-arcade-award="eventWon" type="button">EVENT WON +1,000</button>' +
        '<div class="dev-subtitle">COMMENTARY — CRT LINE (zero points)</div>' +
        '<button data-arcade-commentary="lucky" type="button">LUCKY</button>' +
        '<button data-arcade-commentary="veryLucky" type="button">VERY LUCKY</button>' +
        '<button data-arcade-commentary="filthy" type="button">FILTHY</button>' +
        '<button data-arcade-commentary="unlucky" type="button">UNLUCKY</button>' +
        '<button data-arcade-commentary="brutal" type="button">BRUTAL</button>' +
        '<button data-arcade-commentary="sidePotWonNetLoss" type="button">SIDE POT · NET LOSS</button>' +
        '<button data-arcade-commentary="potChopped" type="button">POT CHOPPED</button>' +
        '<button data-arcade-commentary="uncalledBetReturned" type="button">UNCALLED BET RETURNED</button>' +
        '<button data-arcade-commentary="shownDownLight" type="button">SHOWN DOWN LIGHT</button>' +
        '<button data-arcade-commentary="pressureSucceeded" type="button">NO SHOWDOWN · POT TAKEN</button>' +
        '<div class="dev-subtitle">STACKED SCENARIOS</div>' +
        '<button data-arcade-scenario="escalating" type="button">ESCALATING PAYOUT (5 rewards)</button>' +
        '<button data-arcade-scenario="massiveWin" type="button">MASSIVE WIN</button>' +
        '<button data-arcade-scenario="monsterHand" type="button">MONSTER HAND</button>' +
        '<button data-arcade-scenario="ko" type="button">K.O.!</button>' +
        '<button data-arcade-scenario="luckyWin" type="button">REWARD + LUCKY</button>' +
        '<button data-arcade-scenario="badBeat" type="button">BRUTAL ONLY</button>' +
        '<div class="dev-subtitle">COUNTER</div>' +
        '<button data-arcade-score="100" type="button">+100 SCORE</button>' +
        '<button data-arcade-score="1000" type="button">+1,000 SCORE</button>' +
        '<button data-arcade-score="10000" type="button">+10,000 SCORE</button>' +
        '<button id="dev-reset-score" type="button">RESET SCORE</button>' +
        '<div class="dev-subtitle">TEST POT SMASH</div>' +
        '<button data-pot-smash="small" type="button">TEST SMALL POT (normal)</button>' +
        '<button data-pot-smash="medium" type="button">TEST MEDIUM POT</button>' +
        '<button data-pot-smash="huge" type="button">TEST HUGE POT</button>' +
        '<div class="dev-subtitle">STATE</div>' +
        '<button id="dev-reset-arcade" type="button">RESET ARCADE</button>' +
      '</div>' +
      '<div id="dev-status"></div>' +
    '</div>';
  document.body.appendChild(panel);

  $('dev-new-elim').onclick = ()=>devNewEliminationTable(game && game.run ? runOpponentCount(game) : 4);
  $('dev-win-hand').onclick = devWinHand;
  $('dev-ko-next').onclick = devKoNext;
  $('dev-bust-me').onclick = devBustMe;
  $('dev-shove-steal').onclick = devShoveSteal;
  $('dev-rapid-hands').onclick = ()=>devRapidHands(8);
  $('dev-clear-table').onclick = devClearTable;
  $('dev-ko-eject').onclick = devTestKoEject;
  $('dev-ko-eject-2').onclick = ()=>devTestKoEjectGroup(2);
  $('dev-ko-eject-4').onclick = ()=>devTestKoEjectGroup(4);
  panel.querySelectorAll('[data-result-test]').forEach(b=>{
    b.onclick = ()=>{
      devTestResultStage(b.dataset.resultTest);
      panel.classList.add('collapsed');
      $('dev-collapse').textContent = '+';
    };
  });
  $('dev-result-reset').onclick = ()=>{
    exitResultsConsole();
    clearCompletedEventConsole();
    leaveTable();
  };
  document.querySelectorAll('#dev-table-size-row button').forEach(b=>{
    b.onclick = ()=>devNewEliminationTable(parseInt(b.dataset.devOpponents,10));
  });
  const applyDevBankroll = value=>{
    const input = $('dev-bankroll-input');
    const status = $('dev-bankroll-status');
    if (devSetCareerBankroll(value)){
      if (input) input.value = String(careerBankroll());
      if (status) status.textContent = 'SET TO $' + careerBankroll().toLocaleString();
    } else if (status){
      status.textContent = careerHasActiveEvent() || careerHasOpenCashSession()
        ? 'SETTLE THE OPEN CAREER TABLE FIRST'
        : 'ENTER A WHOLE-DOLLAR VALUE OF $0 OR MORE';
    }
  };
  $('dev-bankroll-apply').onclick = ()=>applyDevBankroll($('dev-bankroll-input').value);
  $('dev-bankroll-input').onkeydown = event=>{
    if (event.key === 'Enter'){
      event.preventDefault();
      applyDevBankroll(event.currentTarget.value);
    }
  };
  panel.querySelectorAll('[data-dev-bankroll]').forEach(button=>{
    button.onclick = ()=>applyDevBankroll(button.dataset.devBankroll);
  });
  $('dev-end-table').onclick = devEndTable;
  const runArcadeDevTest=fn=>()=>{
    fn();
    panel.classList.add('collapsed');
    $('dev-collapse').textContent='+';
  };
  panel.querySelectorAll('[data-arcade-award]').forEach(b=>b.onclick=runArcadeDevTest(()=>devArcadeAward(b.dataset.arcadeAward)));
  panel.querySelectorAll('[data-arcade-commentary]').forEach(b=>b.onclick=runArcadeDevTest(()=>devArcadeCommentary(b.dataset.arcadeCommentary)));
  panel.querySelectorAll('[data-arcade-scenario]').forEach(b=>b.onclick=runArcadeDevTest(()=>devArcadeScenario(b.dataset.arcadeScenario)));
  panel.querySelectorAll('[data-arcade-score]').forEach(b=>b.onclick=()=>devArcadeAddScore(b.dataset.arcadeScore));
  panel.querySelectorAll('[data-pot-smash]').forEach(b=>b.onclick=runArcadeDevTest(()=>devTestPotSmash(b.dataset.potSmash)));
  $('dev-reset-score').onclick=devArcadeResetScore;
  $('dev-reset-arcade').onclick=devArcadeReset;
  $('dev-fast-dev').onchange = e=>{ FAST_DEV = e.target.checked; refreshDevPanel(); };
  $('dev-collapse').onclick = ()=>{
    panel.classList.toggle('collapsed');
    $('dev-collapse').textContent = panel.classList.contains('collapsed') ? '+' : '_';
  };

  refreshDevPanel();
}

function refreshDevPanel(){
  if (!DEV_MODE) return;
  const panel = $('dev-panel');
  if (!panel) return;
  const inElim = !!game && game.mode==='elimination';
  const onTable = devTableTestable();                 // Arcade run OR Career event
  const rewardable = !!rewardState(game);             // reward presentation available
  $('dev-new-elim').classList.toggle('hidden', onTable && !game.over);
  $('dev-controls').classList.toggle('hidden', !onTable || game.over);
  $('dev-arcade-controls').classList.toggle('hidden', !rewardable);
  const careerActive = careerHasActiveEvent() || careerHasOpenCashSession();
  const bankrollInput = $('dev-bankroll-input');
  const bankrollApply = $('dev-bankroll-apply');
  if (bankrollInput){
    bankrollInput.disabled = careerActive;
    if (document.activeElement !== bankrollInput) bankrollInput.value = String(careerBankroll());
  }
  if (bankrollApply) bankrollApply.disabled = careerActive;
  document.querySelectorAll('#dev-bankroll-presets button').forEach(button=>{
    button.disabled = careerActive;
  });
  const bankrollStatus = $('dev-bankroll-status');
  if (bankrollStatus) bankrollStatus.textContent = careerActive
    ? 'SETTLE THE OPEN CAREER TABLE FIRST'
    : 'CURRENT: $' + careerBankroll().toLocaleString();
  const hip = handInProgress(), bh = betweenHands();
  $('dev-win-hand').disabled = !(onTable && hip);
  $('dev-ko-next').disabled = !(onTable && hip);
  $('dev-bust-me').disabled = !(onTable && hip);
  $('dev-shove-steal').disabled = !(onTable && hip && game.phase==='preflop');
  $('dev-rapid-hands').disabled = !inElim;            // Arcade-only, see devRapidHands
  $('dev-clear-table').disabled = !(onTable && bh);
  $('dev-ko-eject').disabled = !(onTable && bh);
  $('dev-ko-eject-2').disabled = !(onTable && bh);
  $('dev-ko-eject-4').disabled = !(onTable && bh);
  $('dev-end-table').disabled = !(onTable && !game.over && !game._transitioning
    && (game.mode!=='elimination' || !!game.run));
  const status = $('dev-status');
  const rs = rewardState(game);
  if (status) status.textContent = (FAST_DEV ? '[FAST] ' : '') + (game ? ('mode:' + game.mode +
    (game.run ? '  table:'+game.run.tableNumber : '') +
    (rs ? '  score:'+rs.score : '') +
    '  phase:' + game.phase + '  hand:' + game.handNumber) : 'no game');
}

function mq(query){
  try{ return !!(window.matchMedia && window.matchMedia(query).matches); }
  catch(e){ return false; }
}
function checkOrientation(){
  // The table supports both orientations; the hint only appears if the viewport
  // is too small in the current orientation to lay the table out sensibly.
  const landscape = mq('(orientation:landscape)') || window.innerWidth > window.innerHeight;
  const tooShort = landscape && window.innerHeight < 300;
  const tooNarrow = !landscape && window.innerWidth < 280;
  const hint = $('rotate-hint');
  if (hint) hint.style.display = (tooShort || tooNarrow) ? 'flex' : 'none';
}

function wireUI(){
  EquityService.init();
  applyTheme();
  renderStats();

  // lobby selections
  setSegment('diff-seg','diff',settings.difficulty);
  setSegment('type-seg','type',settings.gameType);
  setSegment('run-size-seg','runOpponents',normalizeOpponentCount(settings.runOpponents));
  setSegment('tournament-preset-seg','preset',settings.tournamentPreset);
  setSegment('stack-seg','stack',settings.stack);
  setSegment('blind-seg','blind',settings.blindLevel);
  $('diff-hint').textContent = DIFF_COPY[settings.difficulty];
  $('opp-count').textContent = settings.opponents;
  $('stack-label').textContent = settings.stack.toLocaleString();
  applyGameTypeToSetup();

  $('opp-minus').onclick = ()=>{ settings.tournamentPreset=null; settings.opponents = Math.max(1, settings.opponents-1); setSegment('tournament-preset-seg','preset',null); syncOpp(); };
  $('opp-plus').onclick  = ()=>{ settings.tournamentPreset=null; settings.opponents = Math.min(8, settings.opponents+1); setSegment('tournament-preset-seg','preset',null); syncOpp(); };
  function syncOpp(){
    $('opp-count').textContent = settings.opponents;
    $('opp-label').textContent = settings.opponents;
    $('opp-minus').disabled = settings.opponents<=1;
    $('opp-plus').disabled = settings.opponents>=8;
    saveSettings(); updateSetupSummary();
  }
  document.querySelectorAll('#run-size-seg button').forEach(b=>{
    b.onclick = ()=>{
      // Stored separately from settings.opponents, so choosing a run size
      // never rewrites the cash/tournament table size and vice versa.
      settings.runOpponents = normalizeOpponentCount(b.dataset.runOpponents);
      setSegment('run-size-seg','runOpponents',settings.runOpponents);
      saveSettings(); applyGameTypeToSetup();
    };
  });
  syncOpp();

  document.querySelectorAll('#diff-seg button').forEach(b=>b.onclick=()=>{
    settings.difficulty = b.dataset.diff; setSegment('diff-seg','diff',settings.difficulty);
    $('diff-hint').textContent = DIFF_COPY[settings.difficulty]; saveSettings(); updateSetupSummary();
  });
  document.querySelectorAll('#type-seg button').forEach(b=>b.onclick=()=>{
    settings.gameType = b.dataset.type;
    // settings.mode stays a value newGame() can build. Elimination is
    // dispatched by gameType alone (see dealMeIn), so an existing caller
    // like Quick Deal can never be handed a mode it cannot start.
    if (settings.gameType === 'cash' || settings.gameType === 'tournament'){
      settings.mode = settings.gameType;
    }
    setSegment('type-seg','type',settings.gameType);
    saveSettings(); applyGameTypeToSetup();
  });
  document.querySelectorAll('#tournament-preset-seg button').forEach(b=>b.onclick=()=>{
    const preset = tournamentFormatById(b.dataset.preset);
    if (!preset) return;
    settings.tournamentPreset = preset.id;
    settings.opponents = preset.opponentCount;
    settings.stack = preset.stack;
    setSegment('tournament-preset-seg','preset',settings.tournamentPreset);
    $('opp-count').textContent = settings.opponents;
    $('opp-label').textContent = settings.opponents;
    $('stack-label').textContent = settings.stack.toLocaleString();
    saveSettings(); applyGameTypeToSetup();
  });
  document.querySelectorAll('#stack-seg button').forEach(b=>b.onclick=()=>{
    settings.tournamentPreset = null;
    settings.stack = parseInt(b.dataset.stack,10); setSegment('stack-seg','stack',settings.stack);
    setSegment('tournament-preset-seg','preset',null);
    $('stack-label').textContent = settings.stack.toLocaleString(); saveSettings(); updateSetupSummary();
  });
  document.querySelectorAll('#blind-seg button').forEach(b=>b.onclick=()=>{
    settings.blindLevel = parseInt(b.dataset.blind,10); setSegment('blind-seg','blind',settings.blindLevel); saveSettings(); updateSetupSummary();
  });

  updateSetupSummary();
  // DEAL ME IN discards a saved table, so it keeps the existing warning.
  // CONTINUE TABLE resumes the save exactly as the old menu button did —
  // same continueTable(), same save, at its own size and game type.
  $('deal-me-in').onclick = ()=>withNewTableConfirm(dealMeIn);
  $('setup-continue').onclick = ()=>{ if (loadTableSave()) continueTable(); };
  $('quick-play').onclick = ()=>withNewTableConfirm(startGame);
  $('open-career').onclick = ()=>{ enterCareerFromHome(); };
  $('career-back').onclick = ()=>{
    $('career').classList.add('hidden');
    $('home').classList.remove('hidden');
    reconstructMainMenu();
  };
  $('career-new').onclick = ()=>{
    showConfirmDialog({
      title:'Start a new career?',
      body:'Your bankroll resets to $' + CAREER_START_BANKROLL + '.',
      confirmLabel:'Start New', danger:false,
      onConfirm:startFreshCareer
    });
  };
  $('open-rankings').onclick = ()=>{ buildRankings(); $('home').classList.add('hidden'); $('rankings').classList.remove('hidden'); };
  $('rankings-back').onclick = ()=>{ $('rankings').classList.add('hidden'); $('home').classList.remove('hidden'); reconstructMainMenu(); };
  $('open-awards').onclick = ()=>{ buildAwardsGlossary(); $('home').classList.add('hidden'); $('awards').classList.remove('hidden'); };
  $('awards-back').onclick = ()=>{ $('awards').classList.add('hidden'); $('home').classList.remove('hidden'); reconstructMainMenu(); };
  $('home-settings').onclick = ()=>openOverlay('settings');
  // No confirm here any more: Custom Game now SHOWS the saved table and
  // offers to continue it, so opening the screen must not threaten it.
  $('go-to-setup').onclick = ()=>{
    refreshCustomGameResume();
    applyGameTypeToSetup();
    $('home').classList.add('hidden');
    $('setup').classList.remove('hidden');
  };
  $('setup-back').onclick = ()=>{ $('setup').classList.add('hidden'); $('home').classList.remove('hidden'); reconstructMainMenu(); };
  $('confirm-newtable-yes').onclick = ()=>{
    const action = pendingNewTableAction;
    closeOverlays();
    if (action) action();
  };
  $('confirm-newtable-no').onclick = closeOverlays;

  // SFX V1 — physical button press/release. Kind is resolved from the
  // button's OWN current live state (className/textContent), the exact
  // same signal updateActionControls() already set for the player to
  // read — never recomputed from betting logic, so it can't drift from
  // what's actually on screen. btn-checkcall/btn-raise are one physical
  // button playing multiple roles (see updateActionControls' own
  // comment on reassigning btn-checkcall's className), so their kind is
  // only knowable at the moment of the press, not from the element id
  // alone.
  function resolveButtonKind(el){
    if (!el) return null;
    if (el.id === 'btn-fold') return 'fold';
    if (el.id === 'btn-award-pot-console') return 'award';
    // Reuses the AWARD POT cue rather than introducing a new one — it's the
    // same physical console face committing to a machine mode change.
    if (el.id === 'btn-quick-resolve') return 'award';
    if (el.id === 'btn-checkcall') return el.classList.contains('btn-call') ? 'call' : 'check';
    if (el.id === 'btn-raise'){
      const label = el.textContent;
      if (label === 'Bet') return 'bet';
      if (label === 'Raise') return 'raise';
      // 'Confirm' — resolve all-in from the live slider against the
      // player's full stack, the same maxTotal math updateActionControls
      // already used to size the slider.
      const slider = $('raise-slider'), p = pendingHumanPlayer;
      if (slider && p){
        const committed = parseInt(slider.value,10) || 0;
        if (committed >= p.chips + p.betThisRound) return 'allin';
      }
      return 'raise';
    }
    return null;
  }
  // Tactile press feedback shared by all four arcade buttons — see the
  // .is-pressed CSS on .btn-fold/.btn-check/.btn-call/.btn-raise/
  // .btn-award-console. Pointer events (not :active) so touch and mouse
  // behave identically and iOS Safari reliably shows the depressed state
  // for as long as the finger is held. Purely visual: no preventDefault,
  // so each button's own onclick below still fires exactly as before.
  // pointerup/pointercancel/pointerleave all clear the class, so a finger
  // that drags off or a cancelled gesture can never leave a button stuck
  // looking pressed. SFX V1 hooks the PRESS-DOWN sound here too — it's
  // purely a "the finger pushed a physical button" sensation, so it fires
  // on every genuine pointerdown regardless of whether the gesture later
  // completes into a click; the RELEASE/activate sound is deliberately
  // NOT here (see each button's own onclick below instead) — that one
  // only makes sense tied to an action actually committing, and onclick
  // is the single place that already happens, so there's no risk of it
  // double-firing through overlapping pointer/click events.
  function pressFeedback(el){
    if (!el) return;
    const press = ()=>{ el.classList.add('is-pressed'); Sound.buttonPress(resolveButtonKind(el)); };
    const release = ()=>el.classList.remove('is-pressed');
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }
  ['btn-fold','btn-checkcall','btn-raise','btn-award-pot-console','btn-quick-resolve'].forEach(id=>pressFeedback($(id)));

  // table actions
  $('btn-fold').onclick = ()=>{
    if (!pendingHumanPlayer) return;
    Sound.buttonRelease('fold');
    humanAct('fold');
  };
  // QUICK RESOLVE — accelerates the remaining AI-vs-AI action for this hand
  // only. startQuickResolve() does its own availability/double-press
  // guarding (see there); the render() repaints the console face.
  $('btn-quick-resolve').onclick = ()=>{
    if (!canQuickResolve()) return;
    Sound.buttonRelease('award');
    startQuickResolve();
    render();
  };
  $('btn-checkcall').onclick = ()=>{
    if (!pendingHumanPlayer) return;
    Sound.buttonRelease(resolveButtonKind($('btn-checkcall')));
    humanAct('call');
  };
  $('btn-raise').onclick = ()=>{
    if (!pendingHumanPlayer) return;
    if (!$('raise-panel').classList.contains('show')){
      Sound.buttonRelease(resolveButtonKind($('btn-raise')));
      openRaisePanel();
      updateActionControls();
      return;
    }
    const slider = $('raise-slider');
    const raw = parseInt(slider.value,10);
    const committed = Math.max(parseInt(slider.min,10), Math.min(raw, parseInt(slider.max,10)));
    Sound.buttonRelease(resolveButtonKind($('btn-raise')));
    const p = pendingHumanPlayer;
    if (settings.confirmAllIn && committed >= p.chips + p.betThisRound){
      showConfirmDialog({
        title:'Go all-in?',
        body:'You are about to commit your entire stack.',
        confirmLabel:'Confirm All-In',
        danger:true,
        onConfirm:()=>humanAct('raise', committed)
      });
      return;
    }
    humanAct('raise', committed);
  };
  $('raise-cancel').onclick = ()=>{
    // Genuine cancel: closes the tray and restores the dashboard, no
    // poker action, stack/pot/bets/game state entirely untouched. The
    // player's turn simply continues as if Raise had never been tapped.
    closeRaisePanel();
    updateActionControls();
  };
  $('raise-slider').oninput = e=>{
    // Display only. Manual movement and quick buttons share the canonical
    // setter; neither path commits chips until the existing Confirm action.
    setWagerAmount(e.target.value,{immediate:false});
  };
  $('btn-next-hand').onclick = async ()=>{
    clearTimeout(autoDealT);
    $('btn-next-hand').classList.add('hidden');
    await muckCards();
    startNewHand();
  };
  $('btn-rebuy').onclick = async ()=>{
    Sound.rebuy();
    const human = game.players.find(p=>p.id==='you');
    if (game.livesEnabled && human.lives>0) human.lives--;
    human.chips = game.startingStack;
    game.buyIns += game.startingStack;
    $('btn-rebuy').classList.add('hidden');
    $('btn-new-table').classList.add('hidden');
    await muckCards();
    startNewHand();
  };
  $('btn-new-table').onclick = leaveTable;

  // overlays
  $('close-log').onclick = closeOverlays;
  $('open-settings').onclick = ()=>openOverlay('settings');
  $('close-settings').onclick = closeOverlays;
  $('scrim').onclick = closeOverlays;
  $('leave-table').onclick = leaveTable;
  $('save-progress').onclick = ()=>{
    if (saveProgress()){
      Sound.buttonRelease('check');
      haptic(18);
      const button=$('save-progress');
      button.textContent='Saved';
      clearTimeout(button._savedT);
      button._savedT=setTimeout(()=>{ button.textContent='Save'; },1200);
    }
  };

  // settings switches
  bindSwitch('sw-review','review', ()=>{ if (!settings.review) hideReview(); });
  bindSwitch('sw-sound','sound', ()=>{ if (settings.sound){ Sound.unlock(); Sound.check(); } });
  bindSwitch('sw-motion','reduceMotion', applyTheme);
  bindSwitch('sw-autodeal','autoDeal', ()=>{ if (!settings.autoDeal) clearTimeout(autoDealT); });
  bindSwitch('sw-confirm-allin','confirmAllIn');
  bindSwitch('sw-devmode','devMode', ()=>{ setDevMode(settings.devMode); syncDevSection(); });
  syncDevSection();
  document.querySelectorAll('#speed-seg button').forEach(b=>b.onclick=()=>{
    settings.speed = b.dataset.speed;
    setSegment('speed-seg','speed',settings.speed);
    saveSettings();
  });
  setSegment('speed-seg','speed',settings.speed);

  document.querySelectorAll('#theme-seg button').forEach(b=>b.onclick=()=>{
    settings.theme = b.dataset.theme;
    setSegment('theme-seg','theme',settings.theme);
    applyTheme(); saveSettings();
    if (game && seatEls['you'] && seatEls['you'].avatar) seatEls['you'].avatar.style.background = settings.avatarColour;
  });
  setSegment('theme-seg','theme',settings.theme);

  $('open-scoring-guide').onclick = ()=>{
    buildScoringGuide();
    $('settings-sheet').classList.remove('open');
    $('scoring-guide-sheet').classList.add('open');
  };
  $('close-scoring-guide').onclick = ()=>{
    $('scoring-guide-sheet').classList.remove('open');
    $('settings-sheet').classList.add('open');
  };

  $('reset-run').onclick = ()=>{
    showConfirmDialog({
      title:'Reset Current Run?',
      body:'Deletes your current run progress and starts fresh.',
      confirmLabel:'Reset Current Run',
      danger:true,
      onConfirm:resetCurrentRun
    });
  };

  $('fr-dismiss').onclick = dismissFirstRun;

  // keyboard shortcuts
  document.addEventListener('keydown', e=>{
    if (!pendingHumanPlayer) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key==='f' || e.key==='F'){ humanAct('fold'); }
    else if (e.key==='c' || e.key==='C'){ humanAct('call'); }
    else if (e.key==='r' || e.key==='R'){ $('btn-raise').click(); }
  });

  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', ()=>setTimeout(checkOrientation, 120));
  checkOrientation();

  // first user gesture unlocks audio on iOS
  document.addEventListener('pointerdown', function once(){
    Sound.unlock();
    document.removeEventListener('pointerdown', once);
  });

  reconstructMainMenu();
  initHeroFaces();
  initDevPanel();
  $('pc-version-mark').textContent = BUILD_VERSION;
}

/* The title-screen cast (initHeroFaces) lives in js/home-cast.js. */

if (typeof window !== 'undefined'){
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireUI);
  else wireUI();
  window.__pokerDebug = {
    getGame: ()=>game,
    getPending: ()=>pendingHumanPlayer,
    getSettings: ()=>settings,
    applyAction, isBettingRoundComplete, computePots, evaluate7, compareHands,
    estimateEquity, potSizedTotal, describeMade, equityAvailable: ()=>EquityService.available(),
    detectDraws, computeOuts, boardThreats, faceSVG, describeLine, buildReview,
    computePositions, evaluate7WithCards, render, handleShowdown, handleFoldWin, clearAllCardDOM,
    highlightWinningCards, strongWinningCardKeys, foldSnapshotNote, describeHole, cardKey,
    arrangeHandForDisplay, showHudResultConsole, hideHudResultConsole, hideResultCard, waitForAwardPot,
    runShowdownAwardSequence, celebrateWinnerSeat, splitHandText,
    randomOpponentName, maybeTableTalk, TABLE_TALK, PERSONALITIES, newGame,
    seatPosition, aiThinkTime, speedMult, processLives, skullSVG, playDeath,
    nudgeMood, decayMoods, buildRankings, scheduleAutoDeal, finishHand, aiDecide,
    saveTable, loadTableSave, clearTableSave, restoreTable, continueTable,
    normalizeOpponentCount, runOpponentCount, startSinglePlayerRun,
    Sound, chipStaggerGap, chipStaggerGapAt
  };
}
