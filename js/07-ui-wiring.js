"use strict";

/* ============================================================
   HAND REVIEW — explains what happened and why
   ============================================================ */
function hideReview(){ const r=$('review'); if (r) r.classList.add('hidden'); }

const STREET_NAME = { preflop:'pre-flop', flop:'the flop', turn:'the turn', river:'the river' };

/* If the human folded this hand and the board ran out fully, offer a neutral
   "for reference" comparison — never framed as a verdict on the decision. */
function foldSnapshotNote(winnerPlayer){
  const g = game;
  const snap = g.humanFoldSnapshot;
  if (!snap || g.board.length !== 5 || !winnerPlayer) return null;
  const mineIfContinued = evaluate7([...snap.holeCards, ...g.board]);
  const winnerHand = evaluate7([...winnerPlayer.hand, ...g.board]);
  const cmp = compareHands(mineIfContinued, winnerHand);
  const mineDesc = describeMade(mineIfContinued);
  const winnerDesc = describeMade(winnerHand);
  const streetPhrase = snap.street === 'preflop' ? 'before the flop' : 'on ' + STREET_NAME[snap.street];
  const holeDesc = describeHole(snap.holeCards);

  if (cmp > 0){
    return 'You folded ' + esc(holeDesc) + ' ' + streetPhrase + '. For reference, that hand would have made ' +
      esc(mineDesc) + ' by the river — ahead of ' + esc(winnerPlayer.name) + '\u2019s ' + esc(winnerDesc) +
      '. Folds like this happen; a single result doesn\u2019t say much about whether the fold itself was reasonable.';
  } else if (cmp === 0){
    return 'You folded ' + esc(holeDesc) + ' ' + streetPhrase + '. For reference, that hand would have tied ' +
      esc(winnerPlayer.name) + '\u2019s ' + esc(winnerDesc) + ' by the river.';
  }
  return 'You folded ' + esc(holeDesc) + ' ' + streetPhrase + '. For reference, the eventual hand was ' +
    esc(winnerDesc) + ', which yours would not have beaten — a reasonable lay-down.';
}

/* Turns one player's recorded actions into a readable line. */
function describeLine(playerId){
  const acts = (game.handActions||[]).filter(a=>a.id===playerId);
  if (!acts.length) return '';
  const byStreet = {};
  acts.forEach(a=>{ (byStreet[a.street] = byStreet[a.street] || []).push(a); });
  const parts = [];
  ['preflop','flop','turn','river'].forEach(s=>{
    if (!byStreet[s]) return;
    const last = byStreet[s][byStreet[s].length-1];
    let verb;
    if (last.action==='fold') verb = 'folded';
    else if (last.action==='check') verb = 'checked';
    else if (last.action==='call') verb = 'called';
    else if (last.action==='bet') verb = 'bet';
    else if (last.action==='raise') verb = 'raised';
    else verb = last.action;
    parts.push(verb + ' ' + STREET_NAME[s]);
  });
  return parts.join(', ');
}

function buildReview(outcome){
  const g = game;
  const human = g.players.find(p=>p.id==='you');
  const rows = [];
  let lesson = null;

  if (outcome.type === 'foldwin'){
    const w = outcome.winner;
    const line = describeLine(w.id);
    rows.push('<b>' + esc(w.name) + '</b> won ' + outcome.amount.toLocaleString() +
              ' without a showdown — everyone else folded, so their cards were never shown.');
    if (line) rows.push('Their line: ' + esc(line) + '.');
    const foldNote = foldSnapshotNote(w);
    if (foldNote) rows.push(foldNote);
    if (w.isHuman){
      lesson = ['Winning without showdown','Taking a pot uncontested is a legitimate way to win. ' +
        'You never have to reveal what you held, so opponents learn nothing about how you play.'];
    } else {
      lesson = ['Fold equity','Every pot won this way is won by betting, not by cards. ' +
        'This is why aggression matters — a hand that would lose at showdown can still win if everyone folds first.'];
    }
    return { rows, lesson };
  }

  // showdown
  const results = outcome.potResults;
  const humanWon = outcome.winnerIds.has('you');
  const humanShowed = outcome.contenders.some(p=>p.isHuman);

  results.forEach(r=>{
    const phrase = /^Side/.test(r.label) ? r.label.toLowerCase() : 'the ' + r.label.toLowerCase();
    rows.push('<b>' + esc(r.winners.join(' & ')) + '</b> took ' + phrase +
              ' (' + r.amount.toLocaleString() + ') with ' + esc(r.hand) + '.');
  });

  if (humanShowed){
    const mine = describeMade(evaluate7([...human.hand, ...g.board]));
    rows.push(humanWon
      ? 'You showed <b>' + esc(mine) + '</b>, and it held up.'
      : 'You showed <b>' + esc(mine) + '</b>, which came second here.');
  } else {
    rows.push('You had folded, so this pot was settled without you.');
  }

  const topWinnerId = results[0].winnerIds[0];
  const topWinner = g.players.find(p=>p.id===topWinnerId);
  if (topWinner && !topWinner.isHuman){
    const line = describeLine(topWinnerId);
    if (line) rows.push('How they played it: ' + esc(line) + '.');
  }
  const foldNote = foldSnapshotNote(topWinner);
  if (foldNote) rows.push(foldNote);

  // pick a lesson from what actually happened
  const threats = boardThreats(g.board);
  const winCat = results[0].hand;
  if (results.length > 1){
    lesson = ['Side pots','When a short stack is all-in, the money splits into separate pots. ' +
      'They can only win what they matched — everything above that is contested by the players who kept betting.'];
  } else if (/Flush/.test(winCat) && threats.some(t=>/flush/.test(t))){
    lesson = ['Reading the board','Three cards of one suit on the board is the most common way a strong pair ' +
      'gets beaten. When that pattern appears, big bets start to mean something specific.'];
  } else if (/Straight/.test(winCat)){
    lesson = ['Connected boards','Boards with cards close in rank let straights get there. ' +
      'A hand that looked strong on the flop can quietly become second-best by the river.'];
  } else if (/Full House|Four of a Kind/.test(winCat)){
    lesson = ['Paired boards','Once the board pairs, full houses become live. ' +
      'A flush or straight is no longer the top of the range.'];
  } else if (/Two Pair|Three of a Kind/.test(winCat)){
    lesson = ['Hand values','Two pair and trips win a large share of pots at a full table. ' +
      'You rarely need a monster — you need to be ahead of the hands that keep calling.'];
  } else if (/Pair of|high$/.test(winCat)){
    lesson = ['Showdown value','Plenty of pots are won with modest hands. ' +
      'When nobody commits chips, a single pair is often enough to take it down.'];
  }
  return { rows, lesson };
}

function showReview(outcome){
  if (!settings.review || !outcome) return;
  let data;
  try{ data = buildReview(outcome); }
  catch(e){ return; }
  if (!data || !data.rows.length) return;
  let html = data.rows.map(r=>'<div class="review-row">' + r + '</div>').join('');
  if (data.lesson){
    html += '<div class="review-lesson"><span class="rl-tag">' + esc(data.lesson[0]) + '</span>' +
            esc(data.lesson[1]) + '</div>';
  }
  $('review-body').innerHTML = html;
  $('review').classList.remove('hidden');
}

function renderStats(){
  const cells = [
    {k:'Hands', v: stats.hands.toLocaleString()},
    {k:'Won', v: stats.hands ? Math.round(stats.won/stats.hands*100)+'%' : '—'},
    {k:'Best pot', v: stats.biggestPot ? stats.biggestPot.toLocaleString() : '—'}
  ];
  const html = cells.map(c=>'<div class="stat-cell"><div class="v tabular">'+c.v+'</div><div class="k">'+c.k+'</div></div>').join('');
  const a = $('stat-strip'), b = $('settings-stats');
  if (a) a.innerHTML = html;
  if (b) b.innerHTML = html;
}

/* ============================================================
   UI WIRING
   ============================================================ */
function applyTheme(){
  document.body.setAttribute('data-theme', settings.theme);
  document.body.setAttribute('data-deck', settings.fourColour ? 'four' : 'classic');
  document.body.setAttribute('data-motion', settings.reduceMotion ? 'off' : 'on');
  document.body.setAttribute('data-cardback', settings.cardBack);
  document.body.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal');
  document.body.setAttribute('data-textsize', settings.largeText ? 'large' : 'normal');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta){
    const bg = getComputedStyle(document.body).getPropertyValue('--bg-deep').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}
function setSwitch(el, on){ el.setAttribute('aria-checked', on ? 'true' : 'false'); }
function bindSwitch(id, key, after){
  const el = $(id);
  setSwitch(el, !!settings[key]);
  el.onclick = ()=>{
    settings[key] = !settings[key];
    setSwitch(el, settings[key]);
    saveSettings();
    if (after) after();
  };
}
function setSegment(containerId, attr, value){
  document.querySelectorAll('#'+containerId+' button').forEach(b=>{
    b.classList.toggle('active', b.dataset[attr] === String(value));
  });
}

function openOverlay(which){
  clearTimeout(autoDealT);   // overlays pause the between-hand clock
  $('scrim').classList.add('open');
  if (which==='log'){ logDirty = true; renderLog(); $('log-drawer').classList.add('open'); }
  if (which==='settings'){ $('settings-sheet').classList.add('open'); }
  if (which==='newtable'){ $('confirm-newtable').classList.add('open'); }
}
function closeOverlays(){
  $('scrim').classList.remove('open');
  $('log-drawer').classList.remove('open');
  $('settings-sheet').classList.remove('open');
  $('scoring-guide-sheet').classList.remove('open');
  $('confirm-newtable').classList.remove('open');
  pendingNewTableAction = null;
  if (game && !game.over && !$('btn-next-hand').classList.contains('hidden')) scheduleAutoDeal();
}
// Gates a "start a new table" action behind a discard-confirmation whenever
// a resumable save exists, so Play/Quick Deal can't silently blow it away.
function withNewTableConfirm(action){
  if (loadTableSave()){ pendingNewTableAction = action; openOverlay('newtable'); }
  else action();
}

const HAND_EXAMPLES = [
  ['Royal Flush','Ten to Ace, all one suit', ['A\u2660','K\u2660','Q\u2660','J\u2660','10\u2660']],
  ['Straight Flush','Five in a row, one suit', ['9\u2665','8\u2665','7\u2665','6\u2665','5\u2665']],
  ['Four of a Kind','All four of one rank', ['Q\u2666','Q\u2660','Q\u2665','Q\u2663','7\u2660']],
  ['Full House','Three of a kind plus a pair', ['J\u2663','J\u2666','J\u2660','4\u2665','4\u2660']],
  ['Flush','Any five of one suit', ['A\u2663','J\u2663','8\u2663','6\u2663','2\u2663']],
  ['Straight','Five in a row, mixed suits', ['10\u2666','9\u2660','8\u2665','7\u2663','6\u2666']],
  ['Three of a Kind','Three of one rank', ['8\u2660','8\u2666','8\u2665','K\u2663','3\u2666']],
  ['Two Pair','Two different pairs', ['A\u2666','A\u2663','9\u2660','9\u2665','5\u2663']],
  ['Pair','Two of one rank', ['K\u2665','K\u2666','10\u2660','6\u2663','2\u2665']],
  ['High Card','None of the above', ['A\u2660','J\u2666','9\u2663','6\u2665','3\u2660']],
];
let rankingsBuilt = false;
function buildRankings(){
  if (rankingsBuilt) return;
  rankingsBuilt = true;
  const wrap = $('rankings-list');
  if (!wrap) return;
  wrap.innerHTML = HAND_EXAMPLES.map((h,i)=>{
    const cards = h[2].map(str=>{
      const suit = str.slice(-1), rank = str.slice(0,-1);
      return '<div class="card small '+SUIT_CLASS[suit]+'">'+cardInner({rank, suit})+'</div>';
    }).join('');
    return '<div class="rank-row">' +
      '<div class="rank-no">'+(i+1)+'</div>' +
      '<div class="rank-info"><div class="rank-name">'+h[0]+'</div><div class="rank-desc">'+h[1]+'</div></div>' +
      '<div class="rank-cards">'+cards+'</div>' +
    '</div>';
  }).join('');
}

const DIFF_COPY = {
  easy:'Loose and forgiving — calls too often, rarely bluffs. Good for learning the ropes.',
  medium:'Solid and sensible — decent pot-odds sense, occasional bluffs.',
  hard:'Sharp and calculating — reads the maths well and is hard to push around, but still beatable.'
};
const MODE_COPY = {
  cash:'Blinds stay fixed. Busted opponents buy back in, so the table stays full.',
  tournament:'Blinds rise every 10 hands. No rebuys — play until one player has everything.'
};

/* Plain-language recap of the current setup, shown above "Deal Me In". */
function updateSetupSummary(){
  const el = $('setup-summary');
  if (!el) return;
  const n = settings.opponents;
  const mode = settings.mode === 'tournament' ? 'Tournament' : 'Cash game';
  const blinds = settings.mode === 'tournament'
    ? 'blinds rising from ' + BLIND_LEVELS[0][0] + '/' + BLIND_LEVELS[0][1]
    : 'blinds ' + BLIND_LEVELS[settings.blindLevel][0] + '/' + BLIND_LEVELS[settings.blindLevel][1];
  el.innerHTML = '<b>' + mode + '</b> against <b>' + n + '</b> ' +
    (n === 1 ? 'opponent' : 'opponents') + ' &middot; ' +
    settings.stack.toLocaleString() + ' stack &middot; ' + blinds + '.';
}

function startGame(){
  Sound.unlock();
  clearTableSave();
  newGame({
    opponents: settings.opponents,
    difficulty: settings.difficulty,
    mode: settings.mode,
    stack: settings.stack,
    blindLevel: settings.blindLevel
  });
  $('home').classList.add('hidden');
  $('setup').classList.add('hidden');
  $('rankings').classList.add('hidden');
  $('awards').classList.add('hidden');
  $('career').classList.add('hidden');
  $('table-screen').classList.remove('hidden');
  initSeats();
  if (!settings.seenIntro){
    $('first-run').classList.remove('hidden');
  }
  startNewHand();
}

let menuLaunchInFlight = false;

function reconstructMainMenu(){
  const home=$('home'), button=$('single-player');
  menuLaunchInFlight=false;
  closeOpponentPicker();
  if (home) home.classList.remove('menu-launching','menu-over-table','menu-clearing');
  if (button){ button.disabled=false; button.classList.remove('pc-launch-clunk'); }
  refreshMenuPrimaryButton();
  refreshCareerMenuButton();
}

// Single primary slot: SINGLE PLAYER when there's nothing to resume, or
// CONTINUE (same button, same cartridge animation) when a save exists —
// avoids ever stacking two giant primary buttons on the menu.
/* The main menu must advertise a paused event, since leaving the table no
   longer forfeits it and the player needs to know it is still waiting. */
function refreshCareerMenuButton(){
  const btn = $('open-career');
  if (!btn) return;
  const active = careerHasActiveEvent();
  btn.textContent = active ? 'Career \u00b7 Event in Progress' : 'Career';
  btn.classList.toggle('career-active', active);
}

function refreshMenuPrimaryButton(){
  const hasResumable = !!loadTableSave();
  const label = $('single-player-label'), sub = $('single-player-sub');
  if (label) label.textContent = hasResumable ? 'Continue' : 'Single Player';
  if (sub) sub.textContent = hasResumable ? 'Resume saved game' : 'Start elimination run';
  const newGameBtn = $('new-game-btn');
  if (newGameBtn) newGameBtn.classList.toggle('hidden', !hasResumable);
}

/* ---- OPPONENTS 4/5/6 picker ----
   Not a new setup screen: the existing control bay simply swaps its
   contents for one labelled OPPONENTS panel plus a BACK control, using the
   same pc-* physical primitives as the rest of the menu. Deliberately
   non-destructive — nothing about the existing run is touched until a size
   is actually chosen, so BACK out of it (even from NEW GAME) still leaves
   a resumable save intact. */
function openOpponentPicker(){
  const bay=document.querySelector('#home .pc-control-bay');
  const picker=$('opponent-picker');
  if (!bay || !picker) { launchSinglePlayerFromMenu(); return; }
  picker.classList.remove('hidden');
  bay.classList.add('picking-opponents');
  Sound.buttonPress('check');
  haptic(12);
}
function closeOpponentPicker(){
  const bay=document.querySelector('#home .pc-control-bay');
  const picker=$('opponent-picker');
  if (bay) bay.classList.remove('picking-opponents');
  if (picker) picker.classList.add('hidden');
}
function cancelOpponentPicker(){
  closeOpponentPicker();
  refreshMenuPrimaryButton();
  Sound.buttonRelease('fold');
  haptic(10);
}

function stageInitialRunArrival(g){
  if (!g || game!==g) return Promise.resolve();
  resetRunSeatDOM(g);
  const arriving=[];
  g.players.filter(p=>!p.isHuman).forEach((p,i)=>{
    const e=seatEls[p.id];
    if (!e) return;
    e.root.style.setProperty('--run-stagger',(i*ELIMINATION_RUN_CONFIG.seatStaggerMs)+'ms');
    e.root.classList.add('run-drop-in');
    arriving.push(e.root);
  });
  const station=document.querySelector('.dealer-station');
  if (station) station.classList.add('run-deck-in');
  return waitForRunAnimations([...arriving,station],ELIMINATION_RUN_CONFIG.seatArrivalMs+
    Math.max(0,arriving.length-1)*ELIMINATION_RUN_CONFIG.seatStaggerMs).then(()=>settleRunModules(g,station));
}

async function announceInitialRunTable(g){
  if (!g || game!==g) return;
  const callout=document.createElement('div');
  callout.className='table-round-callout';
  callout.textContent='TABLE '+g.run.tableNumber;
  const announceMs=900;
  callout.style.setProperty('--run-announce-ms',announceMs+'ms');
  $('felt').appendChild(callout);
  await waitForRunAnimations([callout],announceMs);
  callout.remove();
}

function prepareDeferredRunPresentation(g){
  if (!g || game!==g) return;
  pendingHumanPlayer=null;
  coachToken++;
  bannerOverride=null;
  clearAllCardDOM();
  resetPile($('hud-tower'), bankPile());
  bankPending=0;
  const potArea=$('pot-area');
  if (potArea) potArea.classList.add('hidden');
  if ($('pot-val')) $('pot-val').textContent='0';
  hideHudResultConsole();
  hideReview();
  clearHumanReadouts();
  closeRaisePanel();
  $('actions-row').classList.add('hidden');
  $('btn-next-hand').classList.add('hidden');
  $('btn-rebuy').classList.add('hidden');
  $('btn-new-table').classList.add('hidden');
  if ($('banner')) $('banner').textContent='';
  if ($('table-meta')) $('table-meta').textContent='Table '+g.run.tableNumber;
}

async function launchSinglePlayerFromMenu(opponentCount){
  if (menuLaunchInFlight) return;
  const opponents=normalizeOpponentCount(opponentCount);
  const home=$('home'), button=$('single-player');
  if (!home || home.classList.contains('hidden')){ startSinglePlayerRun({opponentCount:opponents}); return; }
  closeOpponentPicker();
  menuLaunchInFlight=true;
  button.disabled=true;
  // Optimistic: a fresh run is starting, so drop any stale CONTINUE label
  // immediately rather than waiting on startSinglePlayerRun()'s clearTableSave().
  const label=$('single-player-label'), sub=$('single-player-sub');
  if (label) label.textContent='Single Player';
  if (sub) sub.textContent='Start elimination run';
  const newGameBtn=$('new-game-btn'); if (newGameBtn) newGameBtn.classList.add('hidden');
  home.classList.add('menu-launching');
  button.classList.add('pc-launch-clunk');
  Sound.buttonPress('allin');
  haptic([28,22,46]);
  await sleep(motionOff()?0:730);
  Sound.buttonRelease('award');
  home.classList.add('menu-over-table');
  const g=startSinglePlayerRun({keepMenuVisible:true,deferHand:true,opponentCount:opponents});
  const arrival=stageInitialRunArrival(g);
  home.classList.add('menu-clearing');
  await Promise.all([arrival,sleep(motionOff()?0:1450)]);
  if (game!==g) return;
  home.classList.add('hidden');
  await announceInitialRunTable(g);
  if (game!==g || !g.run || !g.run.active) return;
  g._transitioning=false;
  g.over=false;
  menuLaunchInFlight=false;
  startNewHand();
}

/* ============================================================
   CAREER — bankroll, event transactions, launch/resume.

   Money rules, all enforced here and nowhere else:
     - the buy-in is deducted AND persisted before the table exists, so a
       refresh can never un-pay it;
     - settlement happens exactly once, guarded by career.active;
     - the bankroll credit and active:null land in the SAME Store.set, and
       that write happens BEFORE the table key is cleared — if anything
       interrupts between the two, an active:null Career with a stale
       (ignored) table is recoverable, whereas an active event whose table
       was already deleted is not.
   Table chips never touch the bankroll: chips are g.players[].chips, the
   bankroll is off-table money in 'felt.career'.
   ============================================================ */
const CAREER_KEY = 'felt.career';
const CAREER_SAVE_VERSION = 1;   // independent of SAVE_VERSION — never bump that one

function defaultCareer(){
  return { v:CAREER_SAVE_VERSION, bankroll:CAREER_START_BANKROLL, active:null, lastResult:null };
}
function isValidCareer(c){
  return !!c && typeof c === 'object'
    && c.v === CAREER_SAVE_VERSION
    && typeof c.bankroll === 'number' && !Number.isNaN(c.bankroll) && c.bankroll >= 0
    && (c.active === null || (!!c.active && typeof c.active === 'object'
        && typeof c.active.buyIn === 'number' && typeof c.active.prize === 'number'));
}
let career = (function(){
  const raw = Store.get(CAREER_KEY, null);
  if (raw && !isValidCareer(raw)) Store.remove(CAREER_KEY);   // Store has no corrupt-value recovery of its own
  return isValidCareer(raw) ? raw : defaultCareer();
})();
function saveCareer(){ Store.set(CAREER_KEY, career); }
function careerBankroll(){ return career.bankroll; }
function careerHasActiveEvent(){ return !!career.active; }

/* The entry rule, enforced at Career-state level rather than in the UI, so
   that when the event board grows past one event every choice is disabled
   by the same test. While career.active is set, NO event may be entered or
   paid for — the player must continue or abandon the one they are in. */
function careerCanEnterEvent(ev){
  if (career.active) return false;
  return career.bankroll >= ((ev || CAREER_EVENT).buyIn);
}

/* Deduct and persist BEFORE the table is built. Returns false when the
   event is unaffordable or one is already live — the two states that must
   never produce a second charge. */
function enterCareerEvent(){
  if (!careerCanEnterEvent(CAREER_EVENT)) return false;
  career.bankroll -= CAREER_EVENT.buyIn;
  career.active = { eventId:CAREER_EVENT.id, buyIn:CAREER_EVENT.buyIn, prize:CAREER_EVENT.prize };
  career.lastResult = null;
  saveCareer();
  return true;
}

/* Returns true ONLY if this call performed the settlement. endCareerEvent()
   in 05-game-engine.js relies on that to decide who owns the ceremony. */
function settleCareerEvent(outcome){
  if (!career.active) return false;
  const stake = career.active;
  if (outcome === 'win') career.bankroll += stake.prize;
  career.lastResult = {
    outcome,
    delta: outcome === 'win' ? stake.prize : -stake.buyIn,
    bankroll: career.bankroll
  };
  career.active = null;
  saveCareer();        // credit + active:null in one write, and it lands first
  clearCareerTable();  // only once settlement is durable
  return true;
}

function startCareerEvent(){
  Sound.unlock();
  hideResultCard();
  // Deliberately NO clearTableSave() — a Career event must never disturb the
  // player's Single Player save.
  newGame({
    mode:'career', difficulty:CAREER_EVENT.difficulty,
    opponents:CAREER_EVENT.seats - 1, stack:CAREER_EVENT.stack,
    blindLevel:CAREER_EVENT.blindLevel
  });
  game.event = {
    id:CAREER_EVENT.id, buyIn:CAREER_EVENT.buyIn, prize:CAREER_EVENT.prize,
    reward: makeEventRewardState()
  };
  // The first checkpoint. saveTable() only fires at the END of a hand, so
  // without this a refresh during hand 1 would find career.active set with
  // no table to resume — stranding the player behind a dead RESUME button.
  saveCareerTable();
  updateArcadeHUD();
  showTableScreen();
  initSeats();
  startNewHand();
  return game;
}

/* Resume an in-progress event. Never touches the bankroll: the buy-in was
   taken at entry. This is a between-hand checkpoint resume — the current
   hand is re-dealt (see the note above serializeTable). */
function continueCareerEvent(){
  if (!career.active) return;
  const save = loadCareerTable();
  if (!save){
    // career.active set but no usable table. After the entry checkpoint
    // above, the only window that produces this is the few milliseconds
    // between the buy-in write and that checkpoint — during which zero
    // hands have been played, so rebuilding loses and gains nothing. It
    // never credits money and never charges again, which also makes it the
    // conservative branch for the (vanishingly rare) corrupt-save case.
    startCareerEvent();
    return;
  }
  Sound.unlock();
  hideResultCard();
  restoreTable(save);
  if (!game.event) game.event = { id:CAREER_EVENT.id, buyIn:CAREER_EVENT.buyIn, prize:CAREER_EVENT.prize, reward:makeEventRewardState() };
  if (!game.event.reward) game.event.reward = makeEventRewardState();
  updateArcadeHUD();
  showTableScreen();
  initSeats();
  startNewHand();
}

function showTableScreen(){
  $('home').classList.add('hidden');
  $('setup').classList.add('hidden');
  $('rankings').classList.add('hidden');
  $('awards').classList.add('hidden');
  $('career').classList.add('hidden');
  $('table-screen').classList.remove('hidden');
  $('btn-new-table').classList.add('hidden');
}

function showCareerScreen(){
  renderCareerScreen();
  $('home').classList.add('hidden');
  $('setup').classList.add('hidden');
  $('rankings').classList.add('hidden');
  $('awards').classList.add('hidden');
  $('table-screen').classList.add('hidden');
  $('career').classList.remove('hidden');
}

/* Returning from a finished event. The event is already settled by then
   (endCareerEvent owns that), so this only tears the table down. */
/* BACK TO EVENTS. One-shot: the button stays bound while the console
   animates out, so a second press must be inert. It performs no money
   operation of any kind — settlement completed before the result was ever
   shown (endCareerEvent), so this cannot re-credit or re-settle even if it
   somehow ran twice. */
let careerReturnInFlight = false;
function returnToCareer(){
  if (careerReturnInFlight || (game && game._careerReturnDone)) return;
  careerReturnInFlight = true;
  clearTimeout(autoDealT);
  endQuickResolve();
  closeOverlays();
  hideResultCard();
  exitResultsConsole();
  clearCompletedEventConsole();
  if (game){ game.over = true; game._careerReturnDone = true; }
  pendingHumanPlayer = null;
  coachToken++;
  setArcadeMode(false);
  const felt = $('felt');
  if (felt) felt.classList.remove('results-mode');
  $('btn-new-table').textContent = 'New Table';
  $('btn-new-table').classList.add('hidden');
  applyTheme();
  showCareerScreen();
  careerReturnInFlight = false;
}

function renderCareerScreen(){
  const bank = $('career-bankroll');
  if (bank) buildResultAmount(bank, career.bankroll);

  const active = careerHasActiveEvent();
  const canEnter = careerCanEnterEvent(CAREER_EVENT);
  const affordable = career.bankroll >= CAREER_EVENT.buyIn;
  const enterBtn = $('career-enter'), newBtn = $('career-new'), note = $('career-note');
  const abandonBtn = $('career-abandon'), statusEl = $('career-event-status');
  const resultEl = $('career-last-result');

  if (statusEl) statusEl.classList.toggle('hidden', !active);
  // ABANDON exists only while an event is live — it is the single
  // deliberate route to forfeiting a buy-in.
  if (abandonBtn) abandonBtn.classList.toggle('hidden', !active);

  if (enterBtn){
    enterBtn.classList.toggle('hidden', !active && !canEnter);
    enterBtn.textContent = active ? 'Continue Event' : 'Enter Event';
  }
  if (newBtn) newBtn.classList.toggle('hidden', active || affordable);

  if (note){
    note.textContent = active
      ? 'Your $' + CAREER_EVENT.buyIn + ' buy-in is staked. Continue where you left off.'
      : affordable
        ? 'Winner takes the full $' + CAREER_EVENT.prize + ' pool.'
        : 'Not enough for the buy-in. Start a fresh career to keep playing.';
  }

  if (resultEl){
    const r = career.lastResult;
    resultEl.classList.toggle('hidden', !r);
    if (r){
      const sign = r.delta >= 0 ? '+' : '-';
      resultEl.innerHTML = '<span class="cr-tag">' + (r.outcome === 'win' ? 'Event won' : 'Event lost') + '</span>' +
        '<span class="cr-amt tabular">' + sign + '$' + Math.abs(r.delta).toLocaleString() + '</span>';
    }
  }
}

function careerEnterPressed(){
  if (careerHasActiveEvent()){ continueCareerEvent(); return; }
  if (!enterCareerEvent()){ renderCareerScreen(); return; }
  renderCareerScreen();       // bankroll visibly drops before the table appears
  startCareerEvent();
}

/* The ONLY path that forfeits a buy-in. Confirmation is mandatory and the
   consequence is stated plainly. */
function careerAbandonPressed(){
  if (!careerHasActiveEvent()) return;
  showConfirmDialog({
    title:'Abandon event?',
    body:'Your $' + CAREER_EVENT.buyIn + ' buy-in is lost and the event ends immediately. This cannot be undone.',
    confirmLabel:'Abandon', danger:true,
    onConfirm:()=>{
      settleCareerEvent('forfeit');   // clears active + the table save
      renderCareerScreen();
    }
  });
}

function startFreshCareer(){
  career = defaultCareer();
  saveCareer();
  clearCareerTable();
  renderCareerScreen();
}

function startSinglePlayerRun(options){
  const opts = (options && typeof options === 'object' && !(options instanceof Event)) ? options : null;
  const keepMenuVisible=!!(opts && opts.keepMenuVisible===true);
  const deferHand=!!(opts && opts.deferHand===true);
  // One validated number feeds both halves of the run: the table that gets
  // built (newGame) and the run state that outlives it (makeEliminationRun,
  // which normalises again on its own so no caller can smuggle a bad value
  // into a save).
  const opponentCount=normalizeOpponentCount(opts && opts.opponentCount);
  Sound.unlock();
  clearTableSave();
  hideResultCard();
  newGame({ mode:'elimination', difficulty:settings.difficulty, opponents:opponentCount });
  game.run = makeEliminationRun(opponentCount);
  applyRunTheme();
  updateArcadeHUD();
  if (!keepMenuVisible) $('home').classList.add('hidden');
  $('setup').classList.add('hidden');
  $('rankings').classList.add('hidden');
  $('awards').classList.add('hidden');
  $('career').classList.add('hidden');
  $('table-screen').classList.remove('hidden');
  $('btn-new-table').classList.add('hidden');
  initSeats();
  if (deferHand){
    game.over=true;
    game._transitioning=true;
    prepareDeferredRunPresentation(game);
  }
  else startNewHand();
  return game;
}

function continueTable(){
  const save = loadTableSave();
  if (!save) return;
  Sound.unlock();
  restoreTable(save);
  $('home').classList.add('hidden');
  $('setup').classList.add('hidden');
  $('rankings').classList.add('hidden');
  $('awards').classList.add('hidden');
  $('career').classList.add('hidden');
  $('table-screen').classList.remove('hidden');
  if (game.mode==='elimination'){
    applyRunTheme();
    updateArcadeHUD();
  }
  initSeats();
  startNewHand();
}

/* Leaving a live Career event PAUSES it. This is a resumable single-player
   Career, not a one-sitting run: the checkpoint is written, career.active
   and the already-deducted buy-in are both retained, and nothing settles.
   Quitting for good is a separate, explicit act — ABANDON EVENT on the
   Career screen (see careerAbandonPressed), which is the only caller that
   ever passes 'forfeit' to settleCareerEvent(). */
function leaveTable(){
  if (game && game.mode==='career' && careerHasActiveEvent() && !game._careerResultShown){
    saveCareerTable();
  }
  doLeaveTable();
}

function doLeaveTable(){
  clearTimeout(autoDealT);
  endQuickResolve();   // also releases any AI think wait still pending
  closeOverlays();
  hideResultCard();
  if (game){
    game.over = true;
    if (game.run) game.run.active = false;
  }
  pendingHumanPlayer = null;
  coachToken++;
  setArcadeMode(false);
  // A *finished* Career event returns to the Career screen (its result is
  // waiting there). A *paused* one goes to the main menu, which advertises
  // the event as still active — see refreshCareerMenuButton().
  const careerFinished = !!(game && game.mode==='career') && !careerHasActiveEvent();
  const felt = $('felt');
  if (felt) felt.classList.remove('results-mode');
  clearCompletedEventConsole();
  $('btn-new-table').textContent = 'New Table';
  $('table-screen').classList.add('hidden');
  applyTheme();
  if (careerFinished){ showCareerScreen(); renderStats(); return; }
  $('home').classList.remove('hidden');
  reconstructMainMenu();
  renderStats();
}

/* Settings > Reset Current Run — unlike Leave Table, also discards the
   resumable save so there's nothing left to continue. Lifetime stats
   (js/02-support-systems.js DEFAULT_STATS) are a separate store and are
   never touched here. */
function resetCurrentRun(){
  clearTableSave();
  leaveTable();
}

/* Generic centered confirmation dialog (see #confirm-dialog) — sits above
   everything via its own backdrop/z-index, so it works whether it's
   triggered from inside the Settings sheet (Reset Current Run) or from a
   live hand (Confirm All-In). Only one instance is ever shown at a time. */
function showConfirmDialog(opts){
  const dlg = $('confirm-dialog');
  $('confirm-dialog-title').textContent = opts.title;
  $('confirm-dialog-body').textContent = opts.body;
  const yes = $('confirm-dialog-yes');
  yes.textContent = opts.confirmLabel;
  yes.classList.toggle('btn-danger', !!opts.danger);
  const cleanup = ()=>{
    dlg.classList.add('hidden');
    yes.onclick = null;
    $('confirm-dialog-no').onclick = null;
  };
  yes.onclick = ()=>{ cleanup(); opts.onConfirm(); };
  $('confirm-dialog-no').onclick = ()=>{ cleanup(); if (opts.onCancel) opts.onCancel(); };
  dlg.classList.remove('hidden');
}
