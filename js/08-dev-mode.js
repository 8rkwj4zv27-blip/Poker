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

function devWinHand(){
  if (!handInProgress() || game.mode!=='elimination') return;
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
  if (!handInProgress() || game.mode!=='elimination') return;
  const target = game.players.find(p=>!p.isHuman && p.inHand && !p.folded && !p.allIn && !p.eliminated && !p._devForceAllIn);
  if (!target) return;
  devForceAllIn(target);
  logMsg('[DEV] ' + target.name + ' armed for a forced all-in', true);
  refreshDevPanel();
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
  if (!DEV_MODE || !game || game.mode!=='elimination') return;
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
  e.avatar.innerHTML = renderFace(target.personality && target.personality.key, 'idle', aiHue(game.players.indexOf(target)));
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
  if (!DEV_MODE || !game || game.mode!=='elimination') return;
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
    e.avatar.innerHTML = renderFace(target.personality && target.personality.key, 'idle', aiHue(game.players.indexOf(target)));
  });
  render();
  logMsg('[DEV] Previewing '+targets.length+'-way grouped K.O. ejection on '+targets.map(t=>t.name).join(', '), true);
  playEliminationGroup(targets.map(p=>({ p, ko:true })));
}
function devBustMe(){
  if (!handInProgress() || game.mode!=='elimination') return;
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
  if (!betweenHands() || game.mode!=='elimination') return;
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
  if (!game || game.mode!=='elimination' || !game.run || !game.run.active || game.over) return;
  const g = game;
  clearTimeout(autoDealT);
  pendingHumanPlayer = null;
  coachToken++;
  closeRaisePanel();
  clearHumanReadouts();
  hideReview();
  g.currentIndex = -1;
  document.querySelectorAll('.ko-physics-layer').forEach(l=>l.remove());
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
      e.avatar.innerHTML=renderFace(p.personality&&p.personality.key,'dead',aiHue(g.players.indexOf(p)));
    }
  });
  logMsg('[DEV] Current table ended through production results flow',true);
  showTableCleared(g);
}

function devNewEliminationTable(){
  startSinglePlayerRun();
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
        '<button id="dev-clear-table" type="button">CLEAR TABLE</button>' +
        '<button id="dev-end-table" type="button">END TABLE</button>' +
        '<button id="dev-ko-eject" type="button">TEST KO EJECT</button>' +
        '<button id="dev-ko-eject-2" type="button">TEST DOUBLE KO</button>' +
        '<button id="dev-ko-eject-4" type="button">TEST QUAD KO</button>' +
      '</div>' +
        '<div id="dev-arcade-controls">' +
        '<div class="dev-section-title">ARCADE TEST</div>' +
        '<div class="dev-subtitle">INDIVIDUAL AWARDS</div>' +
        '<button data-arcade-award="pair" type="button">PAIR +100</button>' +
        '<button data-arcade-award="straight" type="button">STRAIGHT +400</button>' +
        '<button data-arcade-award="quads" type="button">QUADS +1,250</button>' +
        '<button data-arcade-award="goodFold" type="button">GOOD FOLD</button>' +
        '<button data-arcade-award="heroCall" type="button">HERO CALL</button>' +
        '<button data-arcade-award="greatBluff" type="button">GREAT BLUFF</button>' +
        '<button data-arcade-award="maxValue" type="button">MAX VALUE</button>' +
        '<button data-arcade-award="bigPot" type="button">BIG POT</button>' +
        '<button data-arcade-award="doubleUp" type="button">DOUBLE UP</button>' +
        '<div class="dev-subtitle">LUCK LABELS</div>' +
        '<button data-arcade-luck="lucky" type="button">LUCKY</button>' +
        '<button data-arcade-luck="veryLucky" type="button">VERY LUCKY</button>' +
        '<button data-arcade-luck="gotAway" type="button">GOT AWAY</button>' +
        '<button data-arcade-luck="unlucky" type="button">UNLUCKY</button>' +
        '<button data-arcade-luck="brutal" type="button">BRUTAL</button>' +
        '<button data-arcade-luck="badBeat" type="button">BAD BEAT</button>' +
        '<div class="dev-subtitle">ZERO-POINT COMMENTARY</div>' +
        '<button data-arcade-comment="badCall" type="button">BAD CALL</button>' +
        '<button data-arcade-comment="missedValue" type="button">MISSED VALUE</button>' +
        '<button data-arcade-comment="punt" type="button">PUNT!</button>' +
        '<div class="dev-subtitle">STACKED SCENARIOS</div>' +
        '<button data-arcade-scenario="small" type="button">SMALL REWARD</button>' +
        '<button data-arcade-scenario="medium" type="button">MEDIUM REWARD</button>' +
        '<button data-arcade-scenario="huge" type="button">HUGE REWARD</button>' +
        '<button data-arcade-scenario="stacked" type="button">3-EVENT QUEUE</button>' +
        '<button data-arcade-scenario="luckyWin" type="button">REWARD + LUCK</button>' +
        '<button data-arcade-scenario="badBeat" type="button">REWARD + BAD BEAT</button>' +
        '<button data-arcade-scenario="badCall" type="button">NEGATIVE ONLY</button>' +
        '<button id="dev-test-jackpot" type="button">ROYAL FLUSH +5,000</button>' +
        '<div class="dev-subtitle">COUNTER</div>' +
        '<button data-arcade-score="100" type="button">+100 SCORE</button>' +
        '<button data-arcade-score="1000" type="button">+1,000 SCORE</button>' +
        '<button data-arcade-score="10000" type="button">+10,000 SCORE</button>' +
        '<button id="dev-reset-score" type="button">RESET SCORE</button>' +
        '<div class="dev-subtitle">TEST POT SMASH</div>' +
        '<button data-pot-smash="small" type="button">TEST SMALL POT</button>' +
        '<button data-pot-smash="medium" type="button">TEST MEDIUM POT</button>' +
        '<button data-pot-smash="huge" type="button">TEST HUGE POT</button>' +
        '<div class="dev-subtitle">STATE</div>' +
        '<button id="dev-reset-arcade" type="button">RESET ARCADE</button>' +
      '</div>' +
      '<div id="dev-status"></div>' +
    '</div>';
  document.body.appendChild(panel);

  $('dev-new-elim').onclick = devNewEliminationTable;
  $('dev-win-hand').onclick = devWinHand;
  $('dev-ko-next').onclick = devKoNext;
  $('dev-bust-me').onclick = devBustMe;
  $('dev-clear-table').onclick = devClearTable;
  $('dev-ko-eject').onclick = devTestKoEject;
  $('dev-ko-eject-2').onclick = ()=>devTestKoEjectGroup(2);
  $('dev-ko-eject-4').onclick = ()=>devTestKoEjectGroup(4);
  $('dev-end-table').onclick = devEndTable;
  const runArcadeDevTest=fn=>()=>{
    fn();
    panel.classList.add('collapsed');
    $('dev-collapse').textContent='+';
  };
  panel.querySelectorAll('[data-arcade-award]').forEach(b=>b.onclick=runArcadeDevTest(()=>devArcadeAward(b.dataset.arcadeAward)));
  panel.querySelectorAll('[data-arcade-luck]').forEach(b=>b.onclick=runArcadeDevTest(()=>devArcadeLuck(b.dataset.arcadeLuck)));
  panel.querySelectorAll('[data-arcade-comment]').forEach(b=>b.onclick=runArcadeDevTest(()=>devArcadeCommentary(b.dataset.arcadeComment)));
  panel.querySelectorAll('[data-arcade-scenario]').forEach(b=>b.onclick=runArcadeDevTest(()=>devArcadeScenario(b.dataset.arcadeScenario)));
  panel.querySelectorAll('[data-arcade-score]').forEach(b=>b.onclick=()=>devArcadeAddScore(b.dataset.arcadeScore));
  panel.querySelectorAll('[data-pot-smash]').forEach(b=>b.onclick=runArcadeDevTest(()=>devTestPotSmash(b.dataset.potSmash)));
  $('dev-test-jackpot').onclick=devArcadeJackpot;
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
  $('dev-new-elim').classList.toggle('hidden', inElim && !game.over);
  $('dev-controls').classList.toggle('hidden', !inElim || game.over);
  $('dev-arcade-controls').classList.toggle('hidden', !inElim);
  const hip = handInProgress(), bh = betweenHands();
  $('dev-win-hand').disabled = !(inElim && hip);
  $('dev-ko-next').disabled = !(inElim && hip);
  $('dev-bust-me').disabled = !(inElim && hip);
  $('dev-clear-table').disabled = !(inElim && bh);
  $('dev-ko-eject').disabled = !(inElim && bh);
  $('dev-ko-eject-2').disabled = !(inElim && bh);
  $('dev-ko-eject-4').disabled = !(inElim && bh);
  $('dev-end-table').disabled = !(inElim && game.run && !game.over && !game._transitioning);
  const status = $('dev-status');
  if (status) status.textContent = (FAST_DEV ? '[FAST] ' : '') + (game ? ('mode:' + game.mode +
    (game.run ? '  table:'+game.run.tableNumber+(game.run.arcade?' score:'+game.run.arcade.score:'') : '') +
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
  buildSwatches();

  $('player-name').value = settings.playerName === 'You' ? '' : settings.playerName;
  updateIdentityPreview();
  $('player-name').oninput = ()=>{
    settings.playerName = ($('player-name').value || 'You').trim() || 'You';
    saveSettings(); updateIdentityPreview();
  };

  // lobby selections
  setSegment('diff-seg','diff',settings.difficulty);
  setSegment('mode-seg','mode',settings.mode);
  setSegment('stack-seg','stack',settings.stack);
  setSegment('blind-seg','blind',settings.blindLevel);
  $('diff-hint').textContent = DIFF_COPY[settings.difficulty];
  $('mode-hint').textContent = MODE_COPY[settings.mode];
  $('opp-count').textContent = settings.opponents;
  $('opp-label').textContent = settings.opponents;
  $('stack-label').textContent = settings.stack.toLocaleString();
  $('blind-field').classList.toggle('hidden', settings.mode==='tournament');

  $('opp-minus').onclick = ()=>{ settings.opponents = Math.max(1, settings.opponents-1); syncOpp(); };
  $('opp-plus').onclick  = ()=>{ settings.opponents = Math.min(8, settings.opponents+1); syncOpp(); };
  function syncOpp(){
    $('opp-count').textContent = settings.opponents;
    $('opp-label').textContent = settings.opponents;
    $('opp-minus').disabled = settings.opponents<=1;
    $('opp-plus').disabled = settings.opponents>=8;
    saveSettings(); updateSetupSummary();
  }
  syncOpp();

  document.querySelectorAll('#diff-seg button').forEach(b=>b.onclick=()=>{
    settings.difficulty = b.dataset.diff; setSegment('diff-seg','diff',settings.difficulty);
    $('diff-hint').textContent = DIFF_COPY[settings.difficulty]; saveSettings(); updateSetupSummary();
  });
  document.querySelectorAll('#mode-seg button').forEach(b=>b.onclick=()=>{
    settings.mode = b.dataset.mode; setSegment('mode-seg','mode',settings.mode);
    $('mode-hint').textContent = MODE_COPY[settings.mode];
    $('blind-field').classList.toggle('hidden', settings.mode==='tournament');
    saveSettings(); updateSetupSummary();
  });
  document.querySelectorAll('#stack-seg button').forEach(b=>b.onclick=()=>{
    settings.stack = parseInt(b.dataset.stack,10); setSegment('stack-seg','stack',settings.stack);
    $('stack-label').textContent = settings.stack.toLocaleString(); saveSettings(); updateSetupSummary();
  });
  document.querySelectorAll('#blind-seg button').forEach(b=>b.onclick=()=>{
    settings.blindLevel = parseInt(b.dataset.blind,10); setSegment('blind-seg','blind',settings.blindLevel); saveSettings(); updateSetupSummary();
  });

  updateSetupSummary();
  $('deal-me-in').onclick = startGame;
  $('single-player').onclick = ()=>{ if (loadTableSave()) continueTable(); else withNewTableConfirm(launchSinglePlayerFromMenu); };
  $('new-game-btn').onclick = ()=>withNewTableConfirm(launchSinglePlayerFromMenu);
  $('quick-play').onclick = ()=>withNewTableConfirm(startGame);
  $('open-rankings').onclick = ()=>{ buildRankings(); $('home').classList.add('hidden'); $('rankings').classList.remove('hidden'); };
  $('rankings-back').onclick = ()=>{ $('rankings').classList.add('hidden'); $('home').classList.remove('hidden'); reconstructMainMenu(); };
  $('open-awards').onclick = ()=>{ buildAwardsGlossary(); $('home').classList.add('hidden'); $('awards').classList.remove('hidden'); };
  $('awards-back').onclick = ()=>{ $('awards').classList.add('hidden'); $('home').classList.remove('hidden'); reconstructMainMenu(); };
  $('home-settings').onclick = ()=>openOverlay('settings');
  $('go-to-setup').onclick = ()=>withNewTableConfirm(()=>{ $('home').classList.add('hidden'); $('setup').classList.remove('hidden'); });
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
  ['btn-fold','btn-checkcall','btn-raise','btn-award-pot-console'].forEach(id=>pressFeedback($(id)));

  // table actions
  $('btn-fold').onclick = ()=>{
    if (!pendingHumanPlayer) return;
    Sound.buttonRelease('fold');
    humanAct('fold');
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
    // Display only — the underlying slider.value is left exactly as the
    // browser set it (see the step-must-stay-1 note on updateActionControls'
    // slider.step), clamped to the slider's own legal range so it never
    // reads a hair outside min/max.
    const slider = $('raise-slider');
    const shown = Math.max(parseInt(slider.min,10)||0, Math.min(parseInt(e.target.value,10)||0, parseInt(slider.max,10)||0));
    queueRaiseReel(shown,false);
    syncSliderFill();
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
  bindSwitch('sw-coach','coach', ()=>{ updateCoachQuick(); if (pendingHumanPlayer) updateCoach(); else hideCoach(); });
  updateCoachQuick();
  bindSwitch('sw-strength','strength', ()=>{ if (pendingHumanPlayer) updateCoach(); });
  bindSwitch('sw-review','review', ()=>{ if (!settings.review) hideReview(); });
  bindSwitch('sw-faces','faces', ()=>{
    if (!game) return;
    game.players.forEach((p,i)=>{
      const e = seatEls[p.id];
      if (!e || p.isHuman) return;
      e._mood = null;
      if (p.eliminated){
        e.avatar.classList.add('has-face');
        e.avatar.innerHTML = renderFace(p.personality && p.personality.key, 'dead', aiHue(i));
        return;
      }
      if (settings.faces){
        e.avatar.classList.add('has-face');
        e.avatar.innerHTML = renderFace(p.personality && p.personality.key, 'idle', aiHue(i));
      } else {
        e.avatar.classList.remove('has-face');
        e.avatar.innerHTML = esc(p.name.split(' ').filter(w=>w!=='The').map(w=>w[0]).slice(0,2).join(''));
      }
    });
  });
  bindSwitch('sw-deck','fourColour', applyTheme);
  bindSwitch('sw-talk','tableTalk');
  bindSwitch('sw-sound','sound', ()=>{ if (settings.sound){ Sound.unlock(); Sound.check(); } });
  bindSwitch('sw-haptics','haptics', ()=>haptic(15));
  bindSwitch('sw-motion','reduceMotion', applyTheme);
  bindSwitch('sw-contrast','highContrast', applyTheme);
  bindSwitch('sw-textsize','largeText', applyTheme);
  bindSwitch('sw-autodeal','autoDeal', ()=>{ if (!settings.autoDeal) clearTimeout(autoDealT); });
  bindSwitch('sw-lives','lives');
  bindSwitch('sw-devmode','devMode', ()=>setDevMode(settings.devMode));
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

  document.querySelectorAll('#cardback-seg button').forEach(b=>b.onclick=()=>{
    settings.cardBack = b.dataset.cardback;
    setSegment('cardback-seg','cardback',settings.cardBack);
    applyTheme(); saveSettings();
  });
  setSegment('cardback-seg','cardback',settings.cardBack);

  document.querySelectorAll('#names-seg button').forEach(b=>b.onclick=()=>{
    settings.opponentNames = b.dataset.names;
    setSegment('names-seg','names',settings.opponentNames);
    saveSettings();
  });
  setSegment('names-seg','names',settings.opponentNames);

  $('reset-stats').onclick = ()=>{
    stats = Object.assign({}, DEFAULT_STATS);
    saveStats(); renderStats();
  };

  $('fr-dismiss').onclick = ()=>{
    $('first-run').classList.add('hidden');
    settings.seenIntro = true; saveSettings();
  };

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

/* Title-screen cast: the four illustrated characters above the POKER brand,
   flicking between moods one at a time — steps() pop, no smooth easing, in
   keeping with the pixel language. Does nothing when the home screen is
   hidden or the tab is backgrounded; stays a static idle row under
   reduced-motion. */
function initHeroFaces(){
  const wrap = $('hero-faces');
  if (!wrap || typeof CUSTOM_FACES === 'undefined') return;
  const keys = ['maniac','professor','wildcard','shark'].filter(k=>CUSTOM_FACES[k]);
  const MOODS = ['idle','smug','happy','think','shock'];
  const faces = keys.map(k=>{
    const cell = document.createElement('div');
    cell.className = 'hf';
    const img = document.createElement('img');
    img.className = 'face-img';
    img.src = CUSTOM_FACES[k].idle;
    img.alt = '';
    img.draggable = false;
    cell.appendChild(img);
    wrap.appendChild(cell);
    return {img, key:k, mood:'idle'};
  });
  if (!faces.length || motionOff()) return;
  setInterval(()=>{
    if (document.hidden) return;
    const home = $('home');
    if (!home || home.classList.contains('hidden')) return;
    const f = faces[Math.floor(Math.random()*faces.length)];
    let next = MOODS[Math.floor(Math.random()*MOODS.length)];
    if (next === f.mood) next = (f.mood === 'idle') ? 'smug' : 'idle';
    f.mood = next;
    f.img.src = CUSTOM_FACES[f.key][next] || CUSTOM_FACES[f.key].idle;
    f.img.classList.remove('face-pop'); void f.img.offsetWidth; f.img.classList.add('face-pop');
  }, 1400);
}

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
    Sound, chipStaggerGap, chipStaggerGapAt
  };
}
