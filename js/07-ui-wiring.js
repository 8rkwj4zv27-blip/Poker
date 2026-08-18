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
  if (home) home.classList.remove('menu-launching','menu-over-table','menu-clearing');
  if (button){ button.disabled=false; button.classList.remove('pc-launch-clunk'); }
  refreshMenuPrimaryButton();
}

// Single primary slot: SINGLE PLAYER when there's nothing to resume, or
// CONTINUE (same button, same cartridge animation) when a save exists —
// avoids ever stacking two giant primary buttons on the menu.
function refreshMenuPrimaryButton(){
  const hasResumable = !!loadTableSave();
  const label = $('single-player-label'), sub = $('single-player-sub');
  if (label) label.textContent = hasResumable ? 'Continue' : 'Single Player';
  if (sub) sub.textContent = hasResumable ? 'Resume saved game' : 'Start elimination run';
  const newGameBtn = $('new-game-btn');
  if (newGameBtn) newGameBtn.classList.toggle('hidden', !hasResumable);
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

async function launchSinglePlayerFromMenu(){
  if (menuLaunchInFlight) return;
  const home=$('home'), button=$('single-player');
  if (!home || home.classList.contains('hidden')){ startSinglePlayerRun(); return; }
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
  const g=startSinglePlayerRun({keepMenuVisible:true,deferHand:true});
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

function startSinglePlayerRun(options){
  const keepMenuVisible=!!(options && options.keepMenuVisible===true);
  const deferHand=!!(options && options.deferHand===true);
  Sound.unlock();
  clearTableSave();
  hideResultCard();
  newGame({ mode:'elimination', difficulty:settings.difficulty });
  game.run = makeEliminationRun();
  applyRunTheme();
  updateArcadeHUD();
  if (!keepMenuVisible) $('home').classList.add('hidden');
  $('setup').classList.add('hidden');
  $('rankings').classList.add('hidden');
  $('awards').classList.add('hidden');
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
  $('table-screen').classList.remove('hidden');
  if (game.mode==='elimination'){
    applyRunTheme();
    updateArcadeHUD();
  }
  initSeats();
  startNewHand();
}

function leaveTable(){
  clearTimeout(autoDealT);
  closeOverlays();
  hideResultCard();
  if (game){
    game.over = true;
    if (game.run) game.run.active = false;
  }
  pendingHumanPlayer = null;
  coachToken++;
  setArcadeMode(false);
  $('table-screen').classList.add('hidden');
  $('home').classList.remove('hidden');
  reconstructMainMenu();
  applyTheme();
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

