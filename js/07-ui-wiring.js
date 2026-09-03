"use strict";

/* ============================================================
   HAND REVIEW — explains what happened and why
   ============================================================ */
function hideReview(){ const r=$('review'); if (r) r.classList.add('hidden'); }

const STREET_NAME = { preflop:'pre-flop', flop:'the flop', turn:'the turn', river:'the river' };

/* If the human folded this hand and the board ran out fully, offer a neutral
   "for reference" comparison — never framed as a verdict on the decision.

   HIDDEN-INFORMATION GUARD (defect D9, SCORING_SPEC.md 3.2). Every branch
   below describes the WINNER'S hand, so this may only ever run when that
   hand was genuinely turned face up. On a fold-win nobody shows anything,
   and the old unguarded call leaked the winner's never-seen hole cards
   straight into the review panel. `shown` is passed by the caller from the
   real outcome rather than inferred here, so the guard cannot drift from
   what actually happened at the table. */
function foldSnapshotNote(winnerPlayer, shown){
  const g = game;
  const snap = g.humanFoldSnapshot;
  if (!shown) return null;
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
    // Deliberately NOT called on a fold-win: the winner's cards were never
    // shown, so there is nothing truthful to compare against. The row above
    // already states the only fact available — the pot came without a
    // showdown.

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
  // A showdown genuinely reveals the winner's cards, so the comparison is
  // public here — provided this particular winner was a contender who
  // showed, rather than someone who folded earlier and is only named in a
  // side-pot row.
  const winnerShowed = Array.isArray(outcome.contenders) &&
    outcome.contenders.some(p=>p.id===topWinnerId && !p.folded);
  const foldNote = foldSnapshotNote(topWinner, winnerShowed);
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
    {k:'Best hand win', v: stats.biggestPot ? stats.biggestPot.toLocaleString() : '—'}
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
  tournament:'Blinds rise every 10 hands. No rebuys — play until one player has everything.',
  elimination:'An endless run. Clear the table, then a fresh one arrives with a bigger field waiting.'
};
/* The size choices a run can actually build, in the run's own words. */
const RUN_SIZE_COPY = 'Four, five or six opponents. The run fixes its own stakes: '
  + ELIMINATION_CONFIG.startingStack.toLocaleString() + ' stacks at '
  + ELIMINATION_CONFIG.smallBlind + ' / ' + ELIMINATION_CONFIG.bigBlind + '.';

/* Plain-language recap of the current setup, shown above "Deal Me In". */
function updateSetupSummary(){
  const el = $('setup-summary');
  if (!el) return;
  // An Elimination run reads its stakes off ELIMINATION_CONFIG rather than
  // the stack/blind controls, which is exactly why those controls are
  // withdrawn for it — the summary must not claim settings it will ignore.
  if (settings.gameType === 'elimination'){
    const r = normalizeOpponentCount(settings.runOpponents);
    el.innerHTML = '<b>Elimination run</b> against <b>' + r + '</b> opponents &middot; ' +
      ELIMINATION_CONFIG.startingStack.toLocaleString() + ' stack &middot; blinds ' +
      ELIMINATION_CONFIG.smallBlind + '/' + ELIMINATION_CONFIG.bigBlind + '.';
    return;
  }
  const preset = settings.mode === 'tournament' ? tournamentFormatById(settings.tournamentPreset) : null;
  const n = preset ? preset.opponentCount : settings.opponents;
  const mode = settings.mode === 'tournament' ? 'Tournament' : 'Cash game';
  const blinds = settings.mode === 'tournament'
    ? 'blinds rising from ' + BLIND_LEVELS[0][0] + '/' + BLIND_LEVELS[0][1]
    : 'blinds ' + BLIND_LEVELS[settings.blindLevel][0] + '/' + BLIND_LEVELS[settings.blindLevel][1];
  const stack = preset ? preset.stack : settings.stack;
  el.innerHTML = '<b>' + mode + '</b> against <b>' + n + '</b> ' +
    (n === 1 ? 'opponent' : 'opponents') + ' &middot; ' +
    stack.toLocaleString() + ' stack &middot; ' + blinds +
    (preset ? ' &middot; ' + preset.name + '.' : '.');
}

/* Shows only the controls the selected game type actually uses. */
function applyGameTypeToSetup(){
  const run = settings.gameType === 'elimination';
  const stepper = $('opp-stepper'), runField = $('run-size-field');
  const stakes = $('stakes-panel'), blindField = $('blind-field');
  const presetField = $('tournament-preset-field');
  if (stepper) stepper.classList.toggle('hidden', run);
  if (runField) runField.classList.toggle('hidden', !run);
  if (stakes) stakes.classList.toggle('hidden', run);
  if (presetField) presetField.classList.toggle('hidden', run || settings.mode !== 'tournament');
  // Tournament owns its own rising structure, so a fixed blind choice is
  // meaningless there — unchanged behaviour, just stated in one place now.
  if (blindField) blindField.classList.toggle('hidden', settings.mode === 'tournament');
  const label = $('opp-label');
  if (label) label.textContent = run ? normalizeOpponentCount(settings.runOpponents) : settings.opponents;
  const hint = $('type-hint');
  if (hint) hint.textContent = MODE_COPY[settings.gameType] || '';
  const runHint = $('run-size-hint');
  if (runHint) runHint.textContent = RUN_SIZE_COPY;
  updateSetupSummary();
}

/* The one dispatch between the two launch paths. Both already clear the
   table save themselves; neither is modified by this consolidation. */
function dealMeIn(){
  if (settings.gameType === 'elimination'){
    launchSinglePlayerFromMenu(normalizeOpponentCount(settings.runOpponents));
    return;
  }
  startGame();
}

function startGame(){
  Sound.unlock();
  clearTableSave();
  const preset = settings.mode === 'tournament' ? tournamentFormatById(settings.tournamentPreset) : null;
  newGame({
    opponents: preset ? preset.opponentCount : settings.opponents,
    difficulty: settings.difficulty,
    mode: settings.mode,
    stack: preset ? preset.stack : settings.stack,
    blindLevel: settings.blindLevel,
    initialBlindLevel:preset ? preset.initialBlindLevel : 0,
    handsPerBlindLevel:preset ? preset.handsPerBlindLevel : TOURNAMENT_HANDS_PER_LEVEL,
    formatId:preset ? preset.id : null
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
  const home=$('home'), button=$('open-career');
  menuLaunchInFlight=false;
  if (home) home.classList.remove('menu-launching','menu-over-table','menu-clearing');
  if (button){ button.disabled=false; button.classList.remove('pc-launch-clunk'); }
  refreshCustomGameResume();
  refreshCareerMenuButton();
}

/* Career is the FEATURED cartridge. Only the sub-line changes with state:
   the menu must advertise a paused event, since leaving the table no longer
   forfeits it and the player needs to know it is still waiting. */
function refreshCareerMenuButton(){
  const btn = $('open-career');
  if (!btn) return;
  const active = careerHasActiveEvent() || careerHasOpenCashSession();
  const label = $('career-btn-label'), sub = $('career-btn-sub');
  if (label) label.textContent = 'Career';
  if (sub) sub.textContent = careerHasOpenCashSession() ? 'Cash session open'
    : active ? 'Event in progress' : 'Build your bankroll';
  btn.classList.toggle('career-active', active);
}

/* A standalone table in progress is reached from Custom Game, not from the
   menu: the featured slot belongs to Career now. This is what stops the
   consolidation from stranding a saved run — the save itself is untouched,
   only the door to it moved. */
const GAME_TYPE_NAMES = { cash:'Cash game', tournament:'Tournament', elimination:'Elimination run' };
function savedTableTypeName(save){
  if (!save) return '';
  if (save.mode === 'elimination') return GAME_TYPE_NAMES.elimination;
  return save.mode === 'tournament' ? GAME_TYPE_NAMES.tournament : GAME_TYPE_NAMES.cash;
}
function refreshCustomGameResume(){
  const panel = $('setup-resume');
  if (!panel) return;
  const save = loadTableSave();
  panel.classList.toggle('hidden', !save);
  if (!save) return;
  const tag = $('setup-resume-tag');
  if (tag) tag.textContent = savedTableTypeName(save);
  const line = $('setup-resume-line');
  if (line){
    const seats = Array.isArray(save.players) ? save.players.length : 0;
    const opponents = Math.max(0, seats - 1);
    const parts = [];
    if (opponents) parts.push(opponents + (opponents === 1 ? ' opponent' : ' opponents'));
    if (save.mode === 'elimination' && save.run && Number.isFinite(save.run.tableNumber)){
      parts.push('table ' + save.run.tableNumber);
    }
    if (Number.isFinite(save.handNumber) && save.handNumber > 0) parts.push('hand ' + save.handNumber);
    line.textContent = parts.length ? parts.join(' \u00b7 ') : 'Saved between hands.';
  }
}

/* The 4/5/6 run-size step used to take over the menu's control bay. Table
   size is now chosen in Custom Game alongside every other table option, so
   the menu-resident picker is gone. The RUN ITSELF is unchanged: it is
   still built by launchSinglePlayerFromMenu() below, through the same
   normalizeOpponentCount() gate. */

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
  const home=$('home'), button=$('open-career');
  // A run is now started from Custom Game, which means the menu is already
  // hidden and this takes the direct path. The cartridge sequence below is
  // retained for any caller that still launches with the menu on screen.
  if (!home || home.classList.contains('hidden') || !button){
    startSinglePlayerRun({opponentCount:opponents});
    return;
  }
  menuLaunchInFlight=true;
  button.disabled=true;
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
/* Independent of the table SAVE_VERSION. Bumped 2 -> 3 for multi-place
   payouts: active snapshots gained `payouts`, the catalogue gained a third
   unlock entry, and lastResult gained place/prize. Two structurally
   different formats must not share a version number — the bump is what
   routes every stored v2 save through migrateCareer() explicitly instead
   of letting it slide past isValidCareer() on a coincidence.

   Bumped 3 -> 4 for the Career directory's player instrument, which needs
   two truthful aggregate counters. They are the ONLY records added: no
   event history, venue record, rival record or dossier (all Phase 13).

   Bumped 5 -> 6 for one durable end-state bit: `champion`. It records the
   first Invitational victory without closing the event, changing its
   economics, or inventing a second progression system. */
const CAREER_SAVE_VERSION = 6;
const CAREER_CASH_CLOSED_LIMIT = 20;

/* A stored counter is trusted only as a non-negative whole number. Anything
   else — negative, fractional, NaN, Infinity, a string, absent — becomes 0.
   A total is never inferred from lastResult, unlocks or lifetime stats:
   guessing history would be exactly the fabricated record this avoids. */
function normalizeCareerCounter(value){
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function defaultCareer(){
  const unlocks = {};
  CAREER_EVENT_LIST.forEach(event=>{ unlocks[event.id] = !event.unlockRequirement; });
  return {
    v:CAREER_SAVE_VERSION,
    bankroll:CAREER_START_BANKROLL,
    active:null,
    unlocks,
    lastResult:null,
    eventsPlayed:0,
    eventsWon:0,
    champion:false,
    cash:null,
    cashClosed:[],
    // Drawn lazily on the first visit to the directory. See THE ROSTER
    // BOOK below: additive, tolerant, and NOT a schema version change.
    rosters:{}
  };
}

function normalizeCashClosed(value){
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(id=>typeof id === 'string' && id && !seen.has(id) && seen.add(id))
    .slice(-CAREER_CASH_CLOSED_LIMIT);
}

function cashCheckpointHumanStack(checkpoint){
  if (!checkpoint || !Array.isArray(checkpoint.players)) return null;
  const humans = checkpoint.players.filter(p=>p && p.isHuman);
  return humans.length === 1 && Number.isSafeInteger(humans[0].chips) && humans[0].chips >= 0
    ? humans[0].chips : null;
}

function isValidCareerCashSession(session){
  if (session === null) return true;
  if (!session || typeof session !== 'object') return false;
  if (typeof session.id !== 'string' || !session.id) return false;
  if (!session.entry || session.entry.transactionId !== session.id
      || session.entry.buyIn !== CAREER_CASH_CONFIG.buyIn
      || session.entry.debitApplied !== true) return false;
  if (!Number.isSafeInteger(session.openedAt) || session.openedAt < 0) return false;
  if (!Number.isSafeInteger(session.stack) || session.stack < 0) return false;
  if (!normalizeCareerRoster(session.roster, CAREER_CASH_CONFIG)) return false;
  if (typeof isValidCareerCashTableSave !== 'function' || !isValidCareerCashTableSave(session.checkpoint)) return false;
  return session.checkpoint.cashSessionId === session.id
    && cashCheckpointHumanStack(session.checkpoint) === session.stack;
}

/* A malformed cash session never gets to invent a stack. Migration either
   keeps a fully valid completed-hand checkpoint, or refunds exactly the
   explicitly recorded entry debit once. */
function migrateCareerCash(raw, migrated){
  migrated.cashClosed = normalizeCashClosed(raw && raw.cashClosed);
  const session = raw && raw.cash;
  if (!session) return;
  if (isValidCareerCashSession(session)){
    migrated.cash = JSON.parse(JSON.stringify(session));
    return;
  }
  const entry = session && session.entry;
  const id = session && session.id;
  const provable = typeof id === 'string' && id
    && entry && entry.transactionId === id
    && entry.buyIn === CAREER_CASH_CONFIG.buyIn
    && entry.debitApplied === true;
  if (provable && !migrated.cashClosed.includes(id)){
    migrated.bankroll += entry.buyIn;
    migrated.cashClosed.push(id);
    migrated.cashClosed = migrated.cashClosed.slice(-CAREER_CASH_CLOSED_LIMIT);
    migrated.lastResult = {
      outcome:'cash-recovery', eventName:CAREER_CASH_CONFIG.name,
      delta:entry.buyIn, bankroll:migrated.bankroll
    };
  }
}
/* Attaches a seated roster only when there genuinely is one, so an active
   event carried over from a save written before rosters existed keeps its
   exact previous shape rather than growing a null key. */
function withCareerRoster(active, roster){
  const seated = normalizeCareerRoster(roster, active.snapshot);
  if (seated) active.roster = seated;
  return active;
}
function normalizeActiveCareerEvent(active){
  if (!active || typeof active !== 'object') return null;
  const full = active.snapshot || active.event;
  if (isValidCareerEventSnapshot(full)){
    const snapshot = Object.assign({}, full);
    return withCareerRoster({ eventId:snapshot.id, snapshot }, active.roster);
  }
  // An incomplete snapshot: either version 1 (which knew only Back Room and
  // stored eventId/buyIn/prize at the TOP level) or a version-2 snapshot
  // written before `payouts` existed. Rebuild the missing launch fields from
  // the descriptor, then re-apply the paid financial terms from whichever
  // of the two shapes actually carries them. Reading `full` first matters:
  // a v2 active keeps its terms inside .snapshot, and taking them from
  // `active` alone would silently adopt the live catalogue's terms instead
  // of the ones the player already paid for.
  const paid = (full && typeof full === 'object') ? full : active;
  const descriptor = careerEventById((full && full.id) || active.eventId || 'back-room-freezeout');
  if (!descriptor) return null;
  const snapshot = applyPaidCareerTerms(careerEventSnapshot(descriptor), paid);
  // A save written before rosters existed simply has none. It is NOT
  // invented here: the table save already holds the real seated players,
  // and continueCareerEvent() restores them.
  return withCareerRoster({ eventId:snapshot.id, snapshot }, active.roster);
}

/* Records written before placement existed have no place and no prize, and
   this deliberately invents neither — reconstructing a placement from
   `delta` would be exactly the faked placement the schema is meant to
   prevent. place:null renders no FINISH row; prize:0 is safe because the
   Career screen renders an old record from `outcome` and `delta` (both kept
   verbatim), and only the new `cash` tag consults prize — a state no
   pre-version-3 record can be in. */
function normalizeCareerLastResult(raw){
  if (!raw || typeof raw !== 'object') return null;
  const result = Object.assign({}, raw);
  result.place = Number.isInteger(raw.place) && raw.place >= 1 ? raw.place : null;
  result.prize = Number.isFinite(raw.prize) && raw.prize >= 0 ? raw.prize : 0;
  if (Object.prototype.hasOwnProperty.call(raw,'firstChampionship')){
    result.firstChampionship = raw.firstChampionship === true;
  }
  return result;
}

/* Venue access is derived purely from event wins, so an unlocked event is
   itself proof that its required win happened. That makes unlocks
   transferable between events sharing one requirement — which is what stops
   a player who already won the Back Room from finding a NEWLY ADDED sibling
   event (Pub Circuit Open) locked after an update, when their save records
   only the unlock ids that existed when it was written. */
function applyEquivalentUnlocks(unlocks){
  const provenRequirements = new Set();
  const keyOf = requirement=>{
    if (!requirement) return '';
    if (requirement.type === 'venue-win') return 'venue:' + requirement.venue;
    if (requirement.type === 'event-win') return 'event:' + requirement.eventId;
    return '';
  };
  CAREER_EVENT_LIST.forEach(event=>{
    const requirement = event.unlockRequirement;
    const key = keyOf(requirement);
    if (key && unlocks[event.id] === true) provenRequirements.add(key);
  });
  CAREER_EVENT_LIST.forEach(event=>{
    if (provenRequirements.has(keyOf(event.unlockRequirement))) unlocks[event.id] = true;
  });
  return unlocks;
}

function careerRequirementMetByWin(requirement, stake){
  if (!requirement || !stake) return false;
  if (stake.id === SECOND_CHANCE_EVENT_ID) return false;
  if (requirement.type === 'event-win') return requirement.eventId === stake.id;
  if (requirement.type === 'venue-win') return requirement.venue === stake.venue;
  return false;
}

function migrateCareer(raw){
  if (!raw || typeof raw !== 'object') return defaultCareer();
  const migrated = defaultCareer();
  if (Number.isFinite(raw.bankroll) && raw.bankroll >= 0) migrated.bankroll = raw.bankroll;
  migrated.active = normalizeActiveCareerEvent(raw.active);
  migrated.lastResult = normalizeCareerLastResult(raw.lastResult);
  // v1/v2/v3 saves have no counters; they start at 0 rather than being
  // reconstructed from anything the save already holds.
  migrated.eventsPlayed = normalizeCareerCounter(raw.eventsPlayed);
  migrated.eventsWon = normalizeCareerCounter(raw.eventsWon);
  migrated.champion = raw.champion === true;
  migrateCareerCash(raw, migrated);
  // Advertised fields carry across verbatim where they still describe a
  // real event; anything else is dropped and redrawn on the next visit.
  if (raw.rosters && typeof raw.rosters === 'object' && !Array.isArray(raw.rosters)){
    migrated.rosters = {};
    Object.keys(raw.rosters).forEach(id=>{
      const roster = normalizeCareerRoster(raw.rosters[id], careerEventById(id));
      if (roster) migrated.rosters[id] = roster;
    });
  }
  if (raw.unlocks && typeof raw.unlocks === 'object'){
    CAREER_EVENT_LIST.forEach(event=>{
      if (raw.unlocks[event.id] === true) migrated.unlocks[event.id] = true;
    });
  }
  // A version-1 lastResult could only have come from Back Room. Preserve
  // the progression implied by a recorded win instead of relocking Pub.
  if (raw.v === 1 && raw.lastResult && raw.lastResult.outcome === 'win'){
    CAREER_EVENT_LIST.forEach(event=>{
      const requirement = event.unlockRequirement;
      if (careerRequirementMetByWin(requirement, {id:'back-room-freezeout',venue:'BACK ROOM'})){
        migrated.unlocks[event.id] = true;
      }
    });
  }
  // A recorded first place is direct proof of the next venue's access.
  // Apply that proof generically so a player updating after any catalogue
  // expansion keeps the progression they demonstrably earned. Merely
  // having access to a venue is never treated as proof that it was won.
  if (raw.lastResult && raw.lastResult.outcome === 'win'){
    const wonEvent = careerEventById(raw.lastResult.eventId);
    const wonStake = wonEvent || (typeof raw.lastResult.venue === 'string'
      ? { id:raw.lastResult.eventId, venue:raw.lastResult.venue } : null);
    CAREER_EVENT_LIST.forEach(event=>{
      if (careerRequirementMetByWin(event.unlockRequirement, wonStake)) migrated.unlocks[event.id] = true;
    });
    if (wonStake && wonStake.id === INVITATIONAL_EVENT_ID) migrated.champion = true;
  }
  applyEquivalentUnlocks(migrated.unlocks);
  return migrated;
}
function isValidCareer(c){
  return !!c && typeof c === 'object'
    && c.v === CAREER_SAVE_VERSION
    && typeof c.bankroll === 'number' && !Number.isNaN(c.bankroll) && c.bankroll >= 0
    && Number.isSafeInteger(c.eventsPlayed) && c.eventsPlayed >= 0
    && Number.isSafeInteger(c.eventsWon) && c.eventsWon >= 0
    && typeof c.champion === 'boolean'
    && isValidCareerCashSession(c.cash === undefined ? null : c.cash)
    && Array.isArray(c.cashClosed) && normalizeCashClosed(c.cashClosed).length === c.cashClosed.length
    && !!c.unlocks && typeof c.unlocks === 'object'
    && CAREER_EVENT_LIST.every(event=>typeof c.unlocks[event.id] === 'boolean'
        && (!!event.unlockRequirement || c.unlocks[event.id] === true))
    && (c.active === null || (!!c.active && typeof c.active === 'object'
        && !!c.active.snapshot
        && c.active.eventId === c.active.snapshot.id
        && isValidCareerEventSnapshot(c.active.snapshot)));
}
let career = (function(){
  const raw = Store.get(CAREER_KEY, null);
  const migrated = isValidCareer(raw) ? raw : migrateCareer(raw);
  if (raw && !isValidCareer(raw)) Store.set(CAREER_KEY, migrated);
  return migrated;
})();
function saveCareer(){ Store.set(CAREER_KEY, career); }

/* ============================================================
   THE ROSTER BOOK — Career's one authority on who is at which table.

   `career.rosters` maps an event id to the field currently ADVERTISED for
   it. `career.active.roster` holds the field actually SEATED in the event
   in progress. Together they are the single source of truth behind the
   preview portraits, the launch, the active save and the resume, so the
   directory can no longer advertise one table and deal another.

   ADDITIVE AND TOLERANT ON PURPOSE. isValidCareer() deliberately does not
   require either field, so this needed NO save-version bump and NO
   migration: a stored v4 career with no rosters is still a valid v4
   career, and simply draws its fields on the next visit. A malformed or
   stale entry is discarded by normalizeCareerRoster() and redrawn rather
   than rejecting the whole save.

   Lifecycle:
     drawn   — lazily, once, per event instance;
     seated  — moved into career.active at entry, and removed from the
               book, so the directory draws a fresh field next time;
     retired — with the active event at settlement or abandonment.
   ============================================================ */
function careerRosterStore(){
  if (!career.rosters || typeof career.rosters !== 'object' || Array.isArray(career.rosters)){
    career.rosters = {};
  }
  return career.rosters;
}

/* The players actually sitting at the live Career table, read back out of
   the table save. This is the last word on who is in an event that is
   already under way — it is the real seat list, not an advertisement — and
   it is what keeps a ticket truthful for an event entered before rosters
   existed, whose career.active carries none. Reads only; writes nothing. */
function careerSeatedRosterFromTable(event){
  if (typeof loadCareerTable !== 'function') return null;
  let save = null;
  try{ save = loadCareerTable(); }catch(e){ return null; }
  if (!save || !Array.isArray(save.players)) return null;
  const seats = save.players
    .filter(p=>p && !p.isHuman)
    .map(p=>({ personalityKey:p.personalityKey, faceColorIdx:p.faceColorIdx }));
  return normalizeCareerRoster(seats, event);
}

/* The authoritative field for an event. An event in progress answers with
   the roster actually seated in it — first from the active event, then
   from the live table itself; anything else answers with the drawn field,
   drawing one only if the book has none. Repeated calls — every directory
   render, every tray open and close — return the SAME field. */
function careerRosterFor(eventId){
  const event = careerEventById(eventId);
  if (!event) return null;
  if (career.active && career.active.eventId === eventId){
    const snapshot = career.active.snapshot || event;
    const seated = normalizeCareerRoster(career.active.roster, snapshot);
    if (seated) return seated;
    const atTable = careerSeatedRosterFromTable(snapshot);
    if (atTable) return atTable;
  }
  const store = careerRosterStore();
  const stored = normalizeCareerRoster(store[eventId], event);
  if (stored) return stored;
  const drawn = generateCareerRoster(event);
  if (!drawn) return null;
  store[eventId] = drawn;
  return drawn;
}
function releaseCareerRoster(eventId){
  const store = careerRosterStore();
  if (store[eventId]){ delete store[eventId]; return true; }
  return false;
}

/* Called once per VISIT to the Career screen — from showCareerScreen(),
   never from renderCareerScreen(). That distinction is deliberate and is
   asserted by the checks: opening and closing a tray re-renders the board
   and must still write NOTHING, while arriving at the screen may persist
   fields drawn for the first time so a reload advertises the same faces.
   It saves only when the book actually changed. */
function materializeCareerRosters(){
  const store = careerRosterStore();
  let changed = false;
  CAREER_EVENT_LIST.forEach(event=>{
    const state = careerEventState(event.id);
    if (state === 'hidden' || state === 'missing') return;
    if (normalizeCareerRoster(store[event.id], event)) return;
    const before = store[event.id];
    if (careerRosterFor(event.id) && store[event.id] !== before) changed = true;
  });
  // A field held for an event the catalogue no longer contains is dead
  // weight, and would be a stale advertisement if the id ever returned.
  Object.keys(store).forEach(id=>{
    if (!careerEventById(id)){ delete store[id]; changed = true; }
  });
  if (changed) saveCareer();
  return changed;
}
function careerBankroll(){ return career.bankroll; }
function careerHasActiveEvent(){ return !!career.active; }
function careerHasOpenCashSession(){ return !!career.cash; }
function careerMoneyCommitted(){ return career.cash ? career.cash.stack : 0; }
function careerTotalOwned(){ return career.bankroll + careerMoneyCommitted(); }
function careerActiveEventSnapshot(){
  return career.active ? career.active.snapshot : null;
}
/* The field actually seated in the event in progress, or null for an event
   entered before rosters existed (whose real players live in the table
   save and are restored by continueCareerEvent). */
function careerActiveRoster(){
  return career.active
    ? normalizeCareerRoster(career.active.roster, career.active.snapshot) : null;
}
/* Read-only view of the settled record. endCareerEvent() builds its display
   model from this immediately after settlement, so the result presentation
   never has to reach into `career` itself. */
function careerLastResult(){ return career.lastResult; }
function careerEventUnlocked(event, state){
  const c = state || career;
  if (!event || !event.unlockRequirement) return true;
  return c.unlocks[event.id] === true;
}
function careerEventState(eventId){
  const event = careerEventById(eventId);
  if (!event) return 'missing';
  if (career.active){
    return career.active.eventId === event.id ? 'active' : 'blocked';
  }
  if (career.cash) return 'blocked';
  // Live eligibility, re-checked every call — never only at render time.
  // An event already active bypassed this above, so an active Second Chance
  // stays resumable even if bankroll (which cannot actually move while an
  // event is active) later reads as ineligible.
  if (event.id === SECOND_CHANCE_EVENT_ID && !isSecondChanceEligible(career.bankroll)) return 'hidden';
  if (!careerEventUnlocked(event)) return 'locked';
  if (career.bankroll < event.buyIn) return 'unaffordable';
  return 'available';
}

/* The entry rule, enforced at Career-state level rather than in the UI, so
   that when the event board grows past one event every choice is disabled
   by the same test. While career.active is set, NO event may be entered or
   paid for — the player must continue or abandon the one they are in. */
function careerCanEnterEvent(eventId){
  return careerEventState(eventId) === 'available';
}

/* Deduct and persist BEFORE the table is built. Returns false when the
   event is unaffordable or one is already live — the two states that must
   never produce a second charge. */
function enterCareerEvent(eventId){
  if (!careerCanEnterEvent(eventId)) return false;
  const event = careerEventById(eventId);
  const snapshot = careerEventSnapshot(event);
  // The field the directory was ADVERTISING becomes the field that is
  // SEATED. It is copied into the active event (so it survives a reload
  // and drives the resume) and released from the book, so the next visit
  // to the directory draws a new field for this event rather than
  // re-advertising the one already played.
  const roster = careerRosterFor(eventId);
  career.bankroll -= snapshot.buyIn;
  career.active = withCareerRoster({ eventId:snapshot.id, snapshot }, roster);
  releaseCareerRoster(eventId);
  career.lastResult = null;
  // Counted here and nowhere else: this is the one place an event becomes
  // active and the buy-in is debited, so the increment cannot desynchronise
  // from either. A rejected entry returned above without reaching this, and
  // a resume never calls this at all.
  career.eventsPlayed = normalizeCareerCounter(career.eventsPlayed) + 1;
  saveCareer();
  return true;
}

function newCareerCashSessionId(){
  return 'cash-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
}

function careerCanOpenCash(){
  return !career.active && !career.cash && career.bankroll >= CAREER_CASH_CONFIG.buyIn;
}

/* Build the initial between-hand snapshot first, then debit bankroll and
   record the entry plus checkpoint in ONE felt.career write. */
function openCareerCashSession(){
  if (!careerCanOpenCash()) return false;
  const id = newCareerCashSessionId();
  const roster = generateCareerRoster(CAREER_CASH_CONFIG);
  if (!roster) return false;
  newGame({
    mode:'career-cash', difficulty:CAREER_CASH_CONFIG.difficulty,
    opponents:CAREER_CASH_CONFIG.opponentCount, stack:CAREER_CASH_CONFIG.stack,
    blindLevel:0, smallBlind:CAREER_CASH_CONFIG.smallBlind,
    bigBlind:CAREER_CASH_CONFIG.bigBlind, roster, cashSessionId:id,
    formatId:CAREER_CASH_CONFIG.id
  });
  const checkpoint = serializeTable(game);
  if (!isValidCareerCashTableSave(checkpoint)) return false;
  career.bankroll -= CAREER_CASH_CONFIG.buyIn;
  career.cash = {
    id,
    openedAt:Date.now(),
    entry:{ transactionId:id, buyIn:CAREER_CASH_CONFIG.buyIn, debitApplied:true },
    stack:CAREER_CASH_CONFIG.stack,
    roster:JSON.parse(JSON.stringify(roster)),
    checkpoint
  };
  career.lastResult = null;
  saveCareer();
  game._safeSave = checkpoint;
  return true;
}

function checkpointCareerCash(checkpoint){
  if (!career.cash || !isValidCareerCashTableSave(checkpoint)) return false;
  if (checkpoint.cashSessionId !== career.cash.id) return false;
  const stack = cashCheckpointHumanStack(checkpoint);
  if (stack === null) return false;
  career.cash.stack = stack;
  career.cash.checkpoint = JSON.parse(JSON.stringify(checkpoint));
  saveCareer();
  if (game && game.mode === 'career-cash') game._safeSave = checkpoint;
  return true;
}

function settleCareerCash(sessionId, reason){
  if (!career.cash || career.cash.id !== sessionId) return false;
  if (career.cashClosed.includes(sessionId)) return false;
  if (!isValidCareerCashSession(career.cash)) return false;
  const returnsStack = reason === 'cash-out' || reason === 'table-close';
  if (!returnsStack && reason !== 'bust') return false;
  const returned = returnsStack ? career.cash.stack : 0;
  const buyIn = career.cash.entry.buyIn;
  career.bankroll += returned;
  career.cashClosed.push(sessionId);
  career.cashClosed = normalizeCashClosed(career.cashClosed);
  career.cash = null;
  career.lastResult = {
    outcome:reason === 'bust' ? 'cash-bust' : 'cash-out',
    eventName:CAREER_CASH_CONFIG.name,
    delta:returned - buyIn,
    returned,
    bankroll:career.bankroll
  };
  saveCareer();
  return true;
}

function startCareerCashSession(){
  if (!career.cash || !isValidCareerCashSession(career.cash)) return false;
  Sound.unlock();
  hideResultCard();
  restoreTable(career.cash.checkpoint);
  if (!game || game.mode !== 'career-cash' || game.cashSessionId !== career.cash.id) return false;
  showTableScreen();
  initSeats();
  startNewHand();
  return true;
}

function endCareerCashSession(g, reason){
  if (!g || g.mode !== 'career-cash') return false;
  const id = g.cashSessionId;
  // A table close happens after a fully settled hand, so bank that exact
  // final stack before the ledger returns it. A bust always returns zero and
  // deliberately needs no inferred or last-second stack value.
  if (reason==='table-close' && !checkpointCareerCash(serializeTable(g))) return false;
  g.over = true;
  recordGameplayConclusion(g, reason);
  endQuickResolve();
  pendingHumanPlayer = null;
  const settled = settleCareerCash(id, reason);
  if (settled) showCareerScreen();
  return settled;
}

/* The gate between "what happened at the table" and "what gets paid". A
   placement is honoured ONLY as an integer within the paid event's own
   field size — anything else (zero, negative, fractional, a numeric string,
   NaN, out of range, or simply absent) becomes place:null, which pays
   nothing and unlocks nothing. Money must never be creatable by a malformed
   value reaching settlement.

   The legacy 'win'/'loss'/'forfeit' strings remain accepted so an older call
   site can never silently mean something new: 'win' is first place, 'loss'
   is a bust with no known placement, and neither can pay a placed prize it
   was not told about. */
function normalizeCareerSettlement(result, snapshot){
  if (result === 'forfeit') return { forfeit:true, place:null };
  const seats = snapshot && Number.isInteger(snapshot.playerCount) ? snapshot.playerCount : 0;
  const valid = place => Number.isInteger(place) && place >= 1 && place <= seats;
  if (result === 'win')  return { forfeit:false, place: valid(1) ? 1 : null };
  if (result === 'loss') return { forfeit:false, place: null };
  const place = (result && typeof result === 'object') ? result.place : null;
  return { forfeit:false, place: valid(place) ? place : null };
}

/* Returns true ONLY if this call performed the settlement. endCareerEvent()
   in 05-game-engine.js relies on that to decide who owns the ceremony.

   Three distinct endings, one arithmetic:
     - first place       -> prize credited AND any progression unlock;
     - a non-winning cash -> prize credited, NO unlock, ever;
     - a bust or forfeit  -> nothing credited, nothing unlocked.
   The prize always comes from the ACTIVE SNAPSHOT's payout table, never the
   live catalogue, so an already-paid event settles on the terms the player
   actually bought. */
function settleCareerEvent(result){
  if (!career.active) return false;
  const stake = career.active.snapshot;
  const settlement = normalizeCareerSettlement(result, stake);
  const prize = settlement.forfeit ? 0 : careerPrizeForPlace(stake, settlement.place);
  const won = !settlement.forfeit && settlement.place === 1;
  const firstChampionship = won && stake.id === INVITATIONAL_EVENT_ID && !career.champion;
  const outcome = settlement.forfeit ? 'forfeit'
    : won ? 'win'
    : prize > 0 ? 'cash'
    : 'loss';
  career.bankroll += prize;
  if (won){
    // Same guard as the unlock above: settleCareerEvent() returns early
    // unless career.active is set, and clears it below, so a repeated
    // settlement call cannot increment this twice. A cash, a bust and a
    // forfeit are all `won === false`.
    career.eventsWon = normalizeCareerCounter(career.eventsWon) + 1;
    CAREER_EVENT_LIST.forEach(event=>{
      const requirement = event.unlockRequirement;
      if (careerRequirementMetByWin(requirement, stake)){
        career.unlocks[event.id] = true; // idempotent; settlement's active guard owns the one write
      }
    });
    if (stake.id === INVITATIONAL_EVENT_ID) career.champion = true;
  }
  career.lastResult = {
    outcome,
    place: settlement.place,
    prize,
    eventId:stake.id,
    eventName:stake.name,
    venue:stake.venue,
    firstChampionship,
    // Unchanged convention: the GROSS prize when one was paid, otherwise the
    // forfeited buy-in. Deliberately not net profit — see CAREER_DESIGN.md,
    // "prize figures mean the total credited after the buy-in has already
    // been deducted".
    delta: prize > 0 ? prize : -stake.buyIn,
    bankroll: career.bankroll
  };
  career.active = null;
  // The seated field dies with the event it was seated in; the directory
  // draws a fresh one for that event on the next visit.
  releaseCareerRoster(stake.id);
  saveCareer();        // credit + active:null in one write, and it lands first
  clearCareerTable();  // only once settlement is durable
  return true;
}

function startCareerEvent(){
  const event = careerActiveEventSnapshot();
  if (!event) return false;
  Sound.unlock();
  hideResultCard();
  // Deliberately NO clearTableSave() — a Career event must never disturb the
  // player's Single Player save.
  newGame({
    mode:'career', difficulty:event.difficulty,
    opponents:event.opponentCount, stack:event.stack,
    blindLevel:event.initialBlindLevel,
    // The advertised field, seated. Without this newGame() would draw its
    // own personalities and colours and the table would not be the table
    // the player inspected.
    roster:careerActiveRoster()
  });
  game.event = Object.assign({}, event, { reward:makeEventRewardState() });
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
  if (!game.event){ startCareerEvent(); return; }
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
  // Once per VISIT, before the first paint: any event without an
  // advertised field draws one and the book is persisted. Tray toggles
  // re-render without coming through here and so still write nothing.
  materializeCareerRosters();
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
  if (felt) felt.classList.remove('results-mode','tone-negative');
  $('btn-new-table').textContent = 'New Table';
  $('btn-new-table').classList.add('hidden');
  applyTheme();
  showCareerScreen();
  careerReturnInFlight = false;
}

/* Board presentation of a payout table. One place reads as a plain amount;
   several read as a paid-places list, so the Pub Circuit's two events are
   distinguishable at a glance without opening anything. */
/* ============================================================
   CAREER DIRECTORY — the approved production presentation.

   Two machines mounted in one cabinet:
     1. the player instrument, which follows the selected palette;
     2. the house event directory, which does not.

   Every value below is read from the existing Career state and the
   existing CAREER_EVENT_LIST. This renderer owns NO catalogue value, NO
   eligibility rule and NO money: it reads careerEventState(), which is
   still the single authority on available / unaffordable / locked /
   active / blocked / hidden, and it calls the existing entry, resume and
   abandon paths. Opening a tray is pure presentation and writes nothing.
   ============================================================ */

/* The six playable rooms of the approved ladder, in progression order. */
const CAREER_ROOMS = Object.freeze([
  Object.freeze({ venue:'BACK ROOM',                 key:'backroom'     }),
  Object.freeze({ venue:'PUB CIRCUIT',               key:'pub'          }),
  Object.freeze({ venue:'CARD CLUB',                 key:'cardclub'     }),
  Object.freeze({ venue:'CASINO FLOOR',              key:'casino'       }),
  Object.freeze({ venue:'HIGH ROLLER ROOM',          key:'highroller'   }),
  Object.freeze({ venue:'INVITATIONAL CHAMPIONSHIP', key:'invitational' })
]);

/* Venue -> its room key and its PRESTIGE TIER. Prestige changes only the
   paper stock and the finishing of the printed ticket: the information
   layout, the terms and the readability are identical at every tier. A
   grander venue is grander in MATERIAL, never in extra content.

     basic    Back Room          cheap off-white stock, rough perforation,
                                 plain ink, minimal border
     standard Pub Circuit        cleaner stock, venue heading stripe,
                                 stronger printed rule, admission stamp
     premium  Card Club          heavier cream stock, double keyline,
                                 pixel seal, cleaner perforation, serial
     luxury   Casino and above   finest stock, restrained metallic accent,
                                 fine double border, seal and serial
   Derived from the venue alone, so it can never disagree with the room a
   ticket was printed in. */
const CAREER_VENUE_TIERS = Object.freeze({
  'BACK ROOM':                 Object.freeze({ key:'backroom',     prestige:'basic'    }),
  'PUB CIRCUIT':               Object.freeze({ key:'pub',          prestige:'standard' }),
  'CARD CLUB':                 Object.freeze({ key:'cardclub',     prestige:'premium'  }),
  'CASINO FLOOR':              Object.freeze({ key:'casino',       prestige:'luxury'   }),
  'HIGH ROLLER ROOM':          Object.freeze({ key:'highroller',   prestige:'luxury'   }),
  'INVITATIONAL CHAMPIONSHIP': Object.freeze({ key:'invitational', prestige:'luxury'   })
});
function careerVenueTier(venue){
  return CAREER_VENUE_TIERS[venue] || { key:'backroom', prestige:'basic' };
}

/* A stable printed serial for the tiers that carry one. Derived from the
   event id, so it is the same on every render and every reload — it is a
   printed mark on a ticket, not a record of anything. */
function careerTicketSerial(eventId){
  let h = 0;
  const id = String(eventId || '');
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000000;
  return String(h).padStart(6, '0');
}

/* One short state word per event, for the drawer's status chip. It never
   relies on colour alone — the word is the state. */
const CAREER_STATUS_WORD = {
  available:'OPEN', active:'ENTRY PAID', locked:'LOCKED',
  unaffordable:'SHORT', blocked:'UNAVAILABLE'
};
function careerStatusWord(state){ return CAREER_STATUS_WORD[state] || 'CLOSED'; }

/* The threat ladder is venue progression made legible on the ticket. It is
   presentation only: the real decision parameters remain `difficulty` on
   the event descriptor and DIFFICULTY_PARAMS in the opponent system. */
const CAREER_THREAT_BY_VENUE = Object.freeze({
  'BACK ROOM':'1/6 · MODERATE',
  'PUB CIRCUIT':'2/6 · SERIOUS',
  'CARD CLUB':'3/6 · SHARP',
  'CASINO FLOOR':'4/6 · EXPERT',
  'HIGH ROLLER ROOM':'5/6 · ELITE',
  'INVITATIONAL CHAMPIONSHIP':'6/6 · CHAMPIONSHIP'
});
function careerThreatOf(event){
  return event ? (CAREER_THREAT_BY_VENUE[event.venue] || '—') : '—';
}

/* Highest permanent access: the deepest room in ladder order holding an
   event the player may enter on status alone. Back Room is always the
   floor, so this never reads "none". Derived from the live unlock set —
   never stored, so it cannot drift from it. */
function careerHighestAccess(){
  let access = CAREER_ROOMS[0].venue;
  CAREER_ROOMS.forEach(room=>{
    const reached = CAREER_EVENT_LIST.some(event=>
      event.venue === room.venue && careerEventUnlocked(event));
    if (reached) access = room.venue;
  });
  return access;
}

function careerEntryLabel(event){
  return event.buyIn === 0 ? 'FREE ENTRY' : '$' + event.buyIn.toLocaleString() + ' ENTRY';
}

/* Free events first: within a room the cheapest opportunity is the one the
   player can always act on, so Second Chance sorts above the Freezeout. */
function careerRoomEvents(venue){
  return CAREER_EVENT_LIST
    .filter(event=>event.venue === venue)
    .sort((a,b)=>a.buyIn - b.buyIn);
}

function careerCashState(){
  if (career.cash) return 'active';
  if (career.active) return 'blocked';
  return career.bankroll >= CAREER_CASH_CONFIG.buyIn ? 'available' : 'unaffordable';
}

function careerCashTrayHTML(){
  const state = careerCashState();
  const shortfall = Math.max(0, CAREER_CASH_CONFIG.buyIn - career.bankroll);
  const note = state === 'active'
    ? '$' + careerMoneyCommitted().toLocaleString() + ' ON TABLE · SAVED BETWEEN HANDS'
    : state === 'unaffordable'
      ? 'NEEDS $' + shortfall.toLocaleString() + ' MORE THAN YOU HOLD'
      : state === 'blocked' ? 'FINISH THE OPEN TOURNAMENT FIRST' : 'FULL-STACK CASH-OUT BETWEEN HANDS';
  let controls;
  if (state === 'active'){
    controls = '<div class="cdir-cradle"><button type="button" class="cdir-primary" data-cash-resume>' +
      '<span class="pc-lamp is-amber"></span><span class="cdir-legend-wrap">' +
      '<span class="cdir-legend">Resume</span><small>Cash Table</small></span>' +
      '<span class="pc-lamp is-amber"></span></button></div>' +
      '<button type="button" class="cdir-abandon" data-cash-out>Cash Out $' +
      careerMoneyCommitted().toLocaleString() + '</button>';
  } else if (state === 'available'){
    controls = '<div class="cdir-cradle"><button type="button" class="cdir-primary" data-cash-open>' +
      '<span class="pc-lamp is-amber"></span><span class="cdir-legend-wrap">' +
      '<span class="cdir-legend">Buy In $' + CAREER_CASH_CONFIG.buyIn + '</span></span>' +
      '<span class="pc-lamp is-amber"></span></button></div>';
  } else {
    controls = '<div class="cdir-locked-strip"><span class="pc-lamp"></span><span>' +
      esc(state === 'unaffordable' ? 'Bankroll short' : 'Finish your active event first') + '</span></div>';
  }
  const paper = '<div class="cdir-paper" data-prestige="basic">' +
    '<div class="cdir-perf" aria-hidden="true"></div><div class="cdir-paperbody">' +
      (state === 'active' ? '<span class="cdir-tk-punch" aria-hidden="true"></span>' : '') +
      '<div class="cdir-tk-venue cdir-tk-venue-backroom">BACK ROOM</div>' +
      '<h3 class="cdir-tk-name">CASH TABLE</h3><div class="cdir-tk-ref">BACK ROOM CASH</div>' +
      '<div class="cdir-tk-stampline"><span class="cdir-tk-stamp is-' + state + '">' +
        esc(careerStatusWord(state)) + '</span><span class="cdir-tk-threat"><b>THREAT</b>1/6 · MODERATE</span></div>' +
      '<div class="cdir-tk-rule" aria-hidden="true"></div>' +
      '<div class="cdir-tk-money"><div class="cdir-tk-payout"><span>Stakes</span><b>$1 / $2</b></div>' +
        '<div class="cdir-tk-entry"><span>Buy-in</span><b>$' + CAREER_CASH_CONFIG.buyIn + '</b></div></div>' +
      '<div class="cdir-tk-rule" aria-hidden="true"></div>' +
      '<div class="cdir-tk-facts">' +
        '<span class="cdir-tk-fact"><span>Players</span><b>' + CAREER_CASH_CONFIG.playerCount + '</b></span>' +
        '<span class="cdir-tk-fact"><span>Stack</span><b>' + CAREER_CASH_CONFIG.stack + '</b></span>' +
        '<span class="cdir-tk-fact"><span>Format</span><b>CASH GAME</b></span></div>' +
      '<p class="cdir-tk-note' + (state === 'blocked' || state === 'unaffordable' ? ' is-requirement' : '') + '">' +
        esc(note) + '</p><div class="cdir-tk-footer"><span class="cdir-tk-footmark">NO RAKE · CASH OUT BETWEEN HANDS</span></div>' +
    '</div></div>';
  return '<div class="cdir-tray"><div class="cdir-tray-inner"><div class="cdir-slot" aria-hidden="true"><i></i></div>' +
    '<div class="cdir-feed">' + paper + '</div><div class="cdir-mount">' + controls + '</div></div></div>';
}

function careerCashCassetteHTML(){
  const state = careerCashState();
  const open = careerOpenEventId === CAREER_CASH_CONFIG.id;
  const flag = state === 'active'
    ? '<span class="cdir-flag is-active">ACTIVE</span>'
    : '<span class="cdir-flag is-cash">CASH</span>';
  const value = state === 'active'
    ? '$' + careerMoneyCommitted().toLocaleString() + ' ON TABLE'
    : '$' + CAREER_CASH_CONFIG.buyIn + ' BUY-IN';
  return '<div class="cdir-hatch is-' + state + ' is-cash' + (open ? ' is-open' : '') + '">' +
    '<div class="cdir-mount"><button type="button" class="cdir-cassette" data-cash-toggle' +
      ' aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="cdir-cassette-name">CASH TABLE</span><span class="cdir-money-value">' +
      esc(value) + '</span>' + flag + '</button></div>' + (open ? careerCashTrayHTML() : '') + '</div>';
}

function careerRiskBand(event){
  if (!event || event.buyIn === 0) return 'comfortable';
  if (career.bankroll < event.buyIn) return 'unaffordable';
  return career.bankroll >= event.buyIn * 3 ? 'comfortable' : 'risky';
}

function careerPayoutSummary(event){
  const places = careerPayouts(event);
  if (!places.length) return '—';
  const suffix = ['TO 1ST','TO 2ND','TO 3RD'];
  return places.map((amount,i)=>
    '$' + amount.toLocaleString() + (suffix[i] ? ' ' + suffix[i] : '')).join(' · ');
}

/* What this event needs, or what it pays. Locked and unaffordable states
   read from the same live values the gate itself uses. */
function careerRequirementText(event, state){
  if (state === 'locked'){
    const requirement = event.unlockRequirement;
    if (requirement && requirement.type === 'venue-win') return 'UNLOCKS WITH A ' + requirement.venue + ' FIRST PLACE';
    const required = requirement ? careerEventById(requirement.eventId) : null;
    return required ? 'UNLOCKS BY WINNING ' + required.name : 'LOCKED';
  }
  if (state === 'unaffordable'){
    return 'NEEDS $' + (event.buyIn - careerBankroll()).toLocaleString() + ' MORE THAN YOU HOLD';
  }
  if (state === 'blocked') return 'UNAVAILABLE WHILE AN EVENT IS ACTIVE';
  if (state === 'active'){
    return event.buyIn === 0
      ? 'NO BUY-IN TAKEN'
      : 'BUY-IN OF $' + event.buyIn.toLocaleString() + ' IS STAKED';
  }
  if (event.id === SECOND_CHANCE_EVENT_ID){
    return 'OPEN WHILE YOUR BANKROLL IS UNDER $' + SECOND_CHANCE_BANKROLL_THRESHOLD;
  }
  return 'OPEN TO YOU NOW';
}

/* One physical '$' cell plus seven mechanical digit cells: fixed-width
   whole dollars, no comma. Leading zeroes stay on their reels but take the
   existing dim treatment. A bankroll wider than seven digits keeps all of
   its digits rather than being truncated into a smaller, wrong number —
   the cells narrow instead. */
const CAREER_BANKROLL_DIGITS = 7;
function buildCareerBankroll(container, amount){
  if (!container) return;
  container.innerHTML = '';
  const sym = document.createElement('span');
  sym.className = 'jp-cell jp-sym';
  sym.textContent = '$';
  container.appendChild(sym);

  const text = String(Math.max(0, Math.floor(amount) || 0));
  const padded = text.length >= CAREER_BANKROLL_DIGITS
    ? text
    : ('0'.repeat(CAREER_BANKROLL_DIGITS - text.length) + text);
  const firstSignificant = padded.length - text.length;
  container.dataset.cells = String(padded.length + 1);

  Array.from(padded).forEach((ch,i)=>{
    const cell = document.createElement('span');
    cell.className = 'jp-cell jp-digit tabular' + (i < firstSignificant ? ' dim' : '');
    cell.textContent = ch;
    container.appendChild(cell);
  });
}

/* Which tray is extended. Presentation only — it is never persisted, and
   changing it never touches career state. */
let careerOpenEventId = null;

/* PRINT ONCE, ON PURPOSE. The directory re-renders for a great many
   reasons that are not the player opening an event — a palette change, a
   save write, a DEV panel refresh, arriving back from Settings, a
   settlement, a resize. None of those may replay the print sequence or
   its sound. This flag is armed ONLY by the explicit tap that opens an
   event, and renderCareerScreen() disarms it as it consumes it. */
let careerPrintArmed = false;

/* Tournament and cash cassettes share the same physical printer. Keeping
   the gesture here means exactly one user action can arm its sound/motion,
   and opening either kind always closes the other. */
function toggleCareerCassette(id){
  const opening = careerOpenEventId !== id;
  careerOpenEventId = opening ? id : null;
  careerPrintArmed = opening;
  if (opening) Sound.unlock();
  renderCareerScreen();
}

/* The opened equipment tray. Built only when a cassette is open, so no
   opponent portrait exists in the document while it is closed.

   The tray is a PRINTER: a slot opens beneath the event row and feeds a
   printed ticket out of it. Extracted from the approved Ticket Lab
   (ticket-lab.html) without reinterpretation — the Lab stays as the
   reference. Ordinary HTML and CSS: no canvas, no SVG animation, no
   paper simulation, no new artwork.

   The paper carries, in this order:
     1. venue and event name
     2. status and table threat
     3. prize and buy-in          <- the decision, high on the ticket
     4. opponent roster
     5. players, stack, format
     6. eligibility or unlock requirement
   and the physical controls are mounted BELOW the paper, never printed
   on it. */
function careerTrayHTML(event, state){
  const threat = careerThreatOf(event);
  const tier = careerVenueTier(event.venue);
  const seats = Math.max(0, event.opponentCount | 0);
  const moods = event.difficulty === 'hard' || event.difficulty === 'expert' || event.difficulty === 'elite'
    ? ['smug','sly','angry','gloating','smug','sly']
    : ['idle','think','idle','think','think','idle'];
  const paid = state === 'active';

  // THE ADVERTISED FIELD IS THE AUTHORITATIVE FIELD. These portraits and
  // the canonical personality printed under each are the roster this
  // event will actually be dealt with — read, never drawn here, so
  // opening and closing the tray cannot change who is shown.
  const roster = careerRosterFor(event.id);
  let faces = '';
  for (let i = 0; i < seats; i++){
    const entry = roster && roster[i] ? roster[i] : null;
    const seat = entry
      ? { faceColorIdx:entry.faceColorIdx }
      : { faceColorIdx:(i * 3 + event.playerCount) % FACE_COLORS.length };
    const name = entry ? careerSeatName(entry) : '';
    faces += '<span class="cdir-seat">' +
      '<span class="cdir-hf">' + renderFace(seat, moods[i % moods.length]) + '</span>' +
      '<span class="cdir-seat-name">' + esc(name || '\u2014') + '</span></span>';
  }

  const facts = [
    ['Players', String(event.playerCount)],
    ['Stack',   event.stack.toLocaleString()],
    ['Format',  String(event.format).toUpperCase()]
  ].map(pair=>
    '<span class="cdir-tk-fact"><span>' + esc(pair[0]) + '</span><b>' +
    esc(pair[1]) + '</b></span>').join('');

  const serial = (tier.prestige === 'premium' || tier.prestige === 'luxury')
    ? '<span class="cdir-tk-serial">NO. ' + careerTicketSerial(event.id) + '</span>' : '';
  const seal = (tier.prestige === 'premium' || tier.prestige === 'luxury')
    ? '<span class="cdir-tk-seal" aria-hidden="true"></span>' : '';

  const paper =
    '<div class="cdir-paper" data-prestige="' + tier.prestige + '">' +
      '<div class="cdir-perf" aria-hidden="true"></div>' +
      '<div class="cdir-paperbody">' +
        (paid ? '<span class="cdir-tk-punch" aria-hidden="true"></span>' : '') +
        /* 1. Venue and event name. */
        '<div class="cdir-tk-venue cdir-tk-venue-' + tier.key + '">' + esc(event.venue) + '</div>' +
        '<h3 class="cdir-tk-name">' + esc(careerEventTitle(event)) + '</h3>' +
        '<div class="cdir-tk-ref">' + esc(event.name) + '</div>' +
        /* 2. Status and table threat. One stamp only. */
        '<div class="cdir-tk-stampline">' +
          '<span class="cdir-tk-stamp is-' + state + '">' + esc(careerStatusWord(state)) + '</span>' +
          '<span class="cdir-tk-threat"><b>THREAT</b>' + threat + '</span>' +
        '</div>' +
        '<div class="cdir-tk-rule" aria-hidden="true"></div>' +
        /* 3. Prize and buy-in. Payout is the largest financial value. */
        '<div class="cdir-tk-money">' +
          '<div class="cdir-tk-payout"><span>Payout</span><b>' +
            esc(careerPayoutSummary(event)) + '</b></div>' +
          '<div class="cdir-tk-entry"><span>Entry</span><b>' +
            esc(event.buyIn === 0 ? 'FREE' : '$' + event.buyIn.toLocaleString()) + '</b></div>' +
        '</div>' +
        '<div class="cdir-tk-rule" aria-hidden="true"></div>' +
        /* 4. Opponent roster, left aligned. */
        '<div class="cdir-tk-rosterhead">Your table</div>' +
        '<div class="cdir-faces">' + faces + '</div>' +
        '<div class="cdir-tk-rule" aria-hidden="true"></div>' +
        /* 5. Players, stack, format. */
        '<div class="cdir-tk-facts">' + facts + '</div>' +
        /* 6. Eligibility or unlock requirement. */
        '<p class="cdir-tk-note' + (state === 'locked' || state === 'unaffordable' ? ' is-requirement' : '') + '">' +
          esc(careerRequirementText(event, state)) + '</p>' +
        '<div class="cdir-tk-footer">' + seal +
          '<span class="cdir-tk-footmark">TICKET ' + esc(event.id.toUpperCase()) + '</span>' +
          serial + '</div>' +
      '</div>' +
    '</div>';

  /* 7. The controls are MACHINE, mounted on the printer housing below the
     paper. A locked or otherwise unenterable event gets a shallow quiet
     status strip instead of an enormous dead key dominating the ticket —
     its requirement is already printed prominently on the paper above. */
  let controls;
  if (state === 'active'){
    controls = '<div class="cdir-cradle">' +
      '<button type="button" class="cdir-primary" data-career-continue="' + esc(event.id) + '">' +
        '<span class="pc-lamp is-amber"></span><span class="cdir-legend-wrap">' +
        '<span class="cdir-legend">Continue</span><small>' + esc(careerEventTitle(event)) + '</small></span>' +
        '<span class="pc-lamp is-amber"></span></button></div>' +
      '<button type="button" class="cdir-abandon" data-career-abandon="' + esc(event.id) + '">Abandon Event</button>';
  } else if (state === 'available'){
    controls = '<div class="cdir-cradle">' +
      '<button type="button" class="cdir-primary" data-career-enter="' + esc(event.id) + '">' +
        '<span class="pc-lamp is-amber"></span><span class="cdir-legend-wrap">' +
        '<span class="cdir-legend">Take Seat</span></span>' +
        '<span class="pc-lamp is-amber"></span></button></div>';
  } else {
    const word = state === 'unaffordable' ? 'Bankroll short'
      : state === 'blocked' ? 'Finish your active event first' : 'Locked';
    controls = '<div class="cdir-locked-strip"><span class="pc-lamp"></span>' +
      '<span>' + esc(word) + '</span></div>';
  }

  return '<div class="cdir-tray"><div class="cdir-tray-inner">' +
    '<div class="cdir-slot" aria-hidden="true"><i></i></div>' +
    '<div class="cdir-feed">' + paper + '</div>' +
    '<div class="cdir-mount">' + controls + '</div>' +
  '</div></div>';
}

/* One closed cassette: the real event name printed on its face, the real
   entry price in its own recessed money window, and a physical flag only
   where the state needs one. */
function careerCassetteHTML(event, state){
  const open = careerOpenEventId === event.id;
  const flag = state === 'active' ? '<span class="cdir-flag is-active">ACTIVE</span>'
    : state === 'locked' ? '<span class="cdir-flag is-locked">LOCKED</span>'
    : '';
  // The venue marker is directly above, so the plaque prints the SHORT
  // title. The entry price is a fixed printed figure on the same plaque
  // rather than a recessed window of its own: it never changes, and
  // recessed glass is reserved for information that does.
  return '<div class="cdir-hatch is-' + state + (open ? ' is-open' : '') + '">' +
    '<div class="cdir-mount">' +
      '<button type="button" class="cdir-cassette" data-career-toggle="' + esc(event.id) + '"' +
        ' aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="cdir-cassette-name">' + esc(careerEventTitle(event)) + '</span>' +
        '<span class="cdir-money-value">' + esc(careerEntryLabel(event)) + '</span>' + flag +
      '</button></div>' +
    (open ? careerTrayHTML(event, state) : '') +
  '</div>';
}

function renderCareerScreen(){
  const bank = $('career-bankroll');
  if (bank) buildCareerBankroll(bank, careerBankroll());

  const nameEl = $('career-player-name');
  if (nameEl){
    const raw = (typeof settings !== 'undefined' && settings && typeof settings.playerName === 'string')
      ? settings.playerName.trim() : '';
    nameEl.textContent = (raw || 'PLAYER').toUpperCase();
  }
  const championEl = $('career-champion');
  if (championEl) championEl.classList.toggle('hidden', career.champion !== true);
  const accessEl = $('career-access');
  if (accessEl) accessEl.textContent = careerHighestAccess();
  const playedEl = $('career-played');
  if (playedEl) playedEl.textContent = String(normalizeCareerCounter(career.eventsPlayed));
  const wonEl = $('career-won');
  if (wonEl) wonEl.textContent = String(normalizeCareerCounter(career.eventsWon));
  const available = $('career-funds-available');
  const committed = $('career-funds-committed');
  const total = $('career-funds-total');
  if (available) available.textContent = '$' + careerBankroll().toLocaleString();
  if (committed) committed.textContent = '$' + careerMoneyCommitted().toLocaleString();
  if (total) total.textContent = '$' + careerTotalOwned().toLocaleString();
  const board = $('career-events');
  if (board){
    // An open tray belonging to an event that is no longer rendered (its
    // eligibility lapsed, or a fresh career replaced it) must not survive.
    if (careerOpenEventId && careerOpenEventId !== CAREER_CASH_CONFIG.id
        && careerEventState(careerOpenEventId) === 'hidden'){
      careerOpenEventId = null;
    }
    board.innerHTML = CAREER_ROOMS.map(room=>{
      const events = careerRoomEvents(room.venue)
        .map(event=>({ event, state:careerEventState(event.id) }))
        .filter(entry=>entry.state !== 'hidden');
      const eventCassettes = events.map(entry=>careerCassetteHTML(entry.event, entry.state)).join('');
      const cassettes = (room.venue === 'BACK ROOM' ? careerCashCassetteHTML() : '') + eventCassettes;
      const body = cassettes || '<div class="cdir-door"><span class="cdir-door-text">LOCKED &middot; COMING SOON</span></div>';
      // Header and events are ONE venue section: the marker is the top
      // band of the venue's own housing, not a label pinned to a separate
      // panel inside it.
      return '<section class="cdir-room cdir-room-' + room.key + '">' +
        '<header class="cdir-room-plate"><span class="cdir-room-name">' + esc(room.venue) + '</span></header>' +
        '<div class="cdir-room-bay">' + body + '</div></section>';
    }).join('');

    board.querySelectorAll('[data-career-toggle]').forEach(button=>{
      // Presentation only: no save, no debit, no unlock, no table state.
      button.onclick = ()=>toggleCareerCassette(button.dataset.careerToggle);
    });
    board.querySelectorAll('[data-cash-toggle]').forEach(button=>{
      button.onclick = ()=>toggleCareerCassette(CAREER_CASH_CONFIG.id);
    });
    board.querySelectorAll('[data-career-enter]').forEach(button=>{
      button.onclick = ()=>{ Sound.buttonRelease('award'); careerEnterPressed(button.dataset.careerEnter); };
    });
    board.querySelectorAll('[data-career-continue]').forEach(button=>{
      button.onclick = ()=>{ Sound.buttonRelease('award'); careerEnterPressed(button.dataset.careerContinue); };
    });
    board.querySelectorAll('[data-career-abandon]').forEach(button=>{
      button.onclick = ()=>careerAbandonPressed(button.dataset.careerAbandon);
    });
    board.querySelectorAll('[data-cash-open]').forEach(button=>{
      button.onclick = ()=>careerCashOpenPressed();
    });
    board.querySelectorAll('[data-cash-resume]').forEach(button=>{
      button.onclick = ()=>startCareerCashSession();
    });
    board.querySelectorAll('[data-cash-out]').forEach(button=>{
      button.onclick = ()=>careerCashOutPressed();
    });

    // The tray's REAL height extends in discrete mechanical beats, so every
    // later cassette and room is genuinely pushed down the directory
    // rather than overlaid.
    const tray = typeof board.querySelector === 'function'
      ? board.querySelector('.cdir-hatch.is-open .cdir-tray') : null;
    const printing = careerPrintArmed;
    careerPrintArmed = false;           // consumed, whatever happens next
    if (tray){
      const inner = tray.firstElementChild;
      const paper = tray.querySelector('.cdir-paper');
      const slot = tray.querySelector('.cdir-slot');
      // Reduced motion reveals the ticket immediately, with no travel at
      // all. A re-render that is not a fresh opening lands here too: the
      // ticket is simply present, exactly as it already was.
      if (motionOff() || !printing){
        tray.style.height = 'auto';
        if (slot) slot.classList.add('is-open');
        if (paper) paper.classList.add('is-settled');
        // Sound is independent of the motion preference: a player who has
        // turned motion off has not turned sound off.
        if (printing) Sound.ticketPrint();
      } else {
        const target = inner.getBoundingClientRect().height;
        tray.style.height = '0px';
        void tray.offsetHeight;
        tray.classList.add('is-extending');
        tray.style.height = target + 'px';
        tray.addEventListener('transitionend', function settle(){
          tray.classList.remove('is-extending');
          tray.style.height = 'auto';
          tray.removeEventListener('transitionend', settle);
        });
        // 1. the mechanism engages and the slot opens, 2-5. the paper
        // feeds down, overshoots and settles. Both are CSS; this only
        // starts them and marks the rest state when they finish.
        if (slot) slot.classList.add('is-open');
        if (paper){
          paper.classList.add('is-printing');
          paper.addEventListener('animationend', function done(){
            paper.classList.remove('is-printing');
            paper.classList.add('is-settled');
            paper.removeEventListener('animationend', done);
          });
        }
        Sound.ticketPrint();
      }
    }
  }

  const hasAffordableUnlocked = CAREER_EVENT_LIST.some(event=>careerEventState(event.id) === 'available');
  const newBtn = $('career-new');
  if (newBtn) newBtn.classList.toggle('hidden', careerHasActiveEvent() || careerHasOpenCashSession() || hasAffordableUnlocked);

  const resultEl = $('career-last-result');
  if (resultEl){
    const r = career.lastResult;
    resultEl.classList.toggle('hidden', !r);
    resultEl.classList.toggle('is-cash', !!r && r.outcome === 'cash');
    if (r){
      // A zero delta — a free event's loss or forfeit — is neither a gain
      // nor a loss, so it carries no sign at all: never '+$0' or '-$0'.
      const sign = r.delta > 0 ? '+' : r.delta < 0 ? '-' : '';
      const tag = r.outcome === 'win' ? 'Event won'
        : r.outcome === 'cash' ? 'Event cashed'
        : r.outcome === 'cash-out' ? 'Cash session closed'
        : r.outcome === 'cash-bust' ? 'Cash session lost'
        : r.outcome === 'cash-recovery' ? 'Cash buy-in recovered'
        : 'Event lost';
      resultEl.innerHTML = '<span class="cr-tag">' + tag + '</span>' +
        '<span class="cr-amt tabular">' + sign + '$' + Math.abs(r.delta).toLocaleString() + '</span>';
    }
  }

  // Career state can change while the DEV panel stays mounted (entry,
  // settlement, abandonment, fresh career). Keep its bankroll control in
  // step with the same render that updates the player-facing Board, so it
  // cannot remain visually locked after an event has ended.
  if (typeof refreshDevPanel === 'function') refreshDevPanel();
}

function careerEnterPressed(eventId){
  if (careerHasActiveEvent()){
    if (career.active.eventId === eventId) continueCareerEvent();
    return;
  }
  const event=careerEventById(eventId);
  const launch=()=>{
    if (!enterCareerEvent(eventId)){ renderCareerScreen(); return; }
    renderCareerScreen();       // bankroll visibly drops before the table appears
    startCareerEvent();
  };
  if (event && event.buyIn>0 && careerRiskBand(event)==='risky'){
    showConfirmDialog({
      title:'Take a bankroll shot?',
      body:'This $'+event.buyIn.toLocaleString()+' entry leaves $'+
        (career.bankroll-event.buyIn).toLocaleString()+' available. Permanent room access is never lost.',
      confirmLabel:'Enter Event',danger:false,onConfirm:launch
    });
    return;
  }
  launch();
}

function careerCashOpenPressed(){
  if (!careerCanOpenCash()){ renderCareerScreen(); return; }
  const launch = ()=>{
    if (!openCareerCashSession()){ renderCareerScreen(); return; }
    renderCareerScreen();
    startCareerCashSession();
  };
  if (career.bankroll < CAREER_CASH_CONFIG.buyIn * 3){
    showConfirmDialog({
      title:'Take a bankroll shot?',
      body:'This $50 buy-in leaves $' + (career.bankroll - CAREER_CASH_CONFIG.buyIn).toLocaleString() +
        ' available. Your full remaining table stack can be cashed out between hands.',
      confirmLabel:'Buy In', danger:false, onConfirm:launch
    });
    return;
  }
  launch();
}

function careerCashOutPressed(){
  if (!career.cash) return;
  settleCareerCash(career.cash.id, 'cash-out');
  renderCareerScreen();
}

/* The ONLY path that forfeits a buy-in. Confirmation is mandatory and the
   consequence is stated plainly. */
function careerAbandonPressed(eventId){
  if (!careerHasActiveEvent() || career.active.eventId !== eventId) return;
  const event = careerActiveEventSnapshot();
  showConfirmDialog({
    title:'Abandon event?',
    body:'Your $' + event.buyIn.toLocaleString() + ' buy-in is lost and the event ends immediately. This cannot be undone.',
    confirmLabel:'Abandon', danger:true,
    onConfirm:()=>{
      settleCareerEvent('forfeit');   // clears active + the table save
      renderCareerScreen();
    }
  });
}

function startFreshCareer(){
  career = defaultCareer();
  careerOpenEventId = null;
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
  // A cash hand is never persisted mid-hand. The ledger already contains
  // the last completed-hand checkpoint, so leaving simply pauses and a
  // later Resume replays from that safe boundary.
  doLeaveTable();
}

function doLeaveTable(){
  clearTimeout(autoDealT);
  DealFX.cancelAll();
  cancelAllCardTurns();
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
  const careerFinished = !!(game && (game.mode==='career' || game.mode==='career-cash'))
    && !careerHasActiveEvent() && !careerHasOpenCashSession();
  const felt = $('felt');
  if (felt) felt.classList.remove('results-mode','tone-negative');
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
