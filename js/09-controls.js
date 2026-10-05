"use strict";

/* ============================================================
   CONTROLS: wireUI() builds the main menu and wires every button in the
   game (Fold, Check/Call, Raise, the raise slider, Next Hand, Settings,
   overlays, the rotate hint). Live in every build: without this file the
   game's buttons do nothing.

   Moved out of js/08-dev-mode.js unchanged (5 Oct 2026, audit finding F2),
   so that file is only the DEV panel and its name no longer hides the
   game's controls. Loaded straight after 08-dev-mode.js, so wireUI()'s
   DOMContentLoaded listener is queued at exactly the same point as before
   (js/home-boot.js and js/home-cast.js rely on it running first).
   ============================================================ */

function mq(query){
  try{ return !!(window.matchMedia && window.matchMedia(query).matches); }
  catch(e){ return false; }
}
function checkOrientation(){
  // The game is built for a phone held upright. iOS ignores the manifest's
  // portrait lock in an installed web app, so a phone turned sideways gets
  // a full cover until it's turned back. Only phone-sized screens: a
  // landscape desktop or tablet window is tall enough to show the game.
  const landscape = mq('(orientation:landscape)') || window.innerWidth > window.innerHeight;
  const phone = Math.min(window.innerWidth, window.innerHeight) < 540;
  const hint = $('rotate-hint');
  if (!hint) return;
  // straight under <body>, so no flying card or chip layer can sit above it
  if (hint.parentNode !== document.body) document.body.appendChild(hint);
  hint.style.display = (landscape && phone) ? 'flex' : 'none';
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
  $('opp-plus').onclick  = ()=>{ settings.tournamentPreset=null; settings.opponents = Math.min(MAX_OPPONENTS, settings.opponents+1); setSegment('tournament-preset-seg','preset',null); syncOpp(); };
  function syncOpp(){
    $('opp-count').textContent = settings.opponents;
    $('opp-label').textContent = settings.opponents;
    $('opp-minus').disabled = settings.opponents<=1;
    $('opp-plus').disabled = settings.opponents>=MAX_OPPONENTS;
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
  $('home-continue').onclick = ()=>{ if (loadTableSave()) continueTable(); };
  $('open-career').onclick = ()=>{ enterCareerFromHome(); };
  // Back to the menu turns the same drum the other way (machine-wheel.js).
  $('career-back').onclick = ()=>{
    rollBackTo($('career'), $('home'),
      ()=>{ $('home').classList.remove('hidden'); reconstructMainMenu(); },
      ()=>{ $('career').classList.add('hidden'); });
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
  $('btn-new-table').onclick = leaveTable;

  // overlays
  $('close-log').onclick = closeOverlays;
  $('open-settings').onclick = ()=>openOverlay('settings');
  $('close-settings').onclick = closeOverlays;
  $('settings-back').onclick = closeOverlays;
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

  document.querySelectorAll('#coin-sound-seg button').forEach(b=>b.onclick=()=>{
    settings.coinSound = b.dataset.coin;
    setSegment('coin-sound-seg','coin',settings.coinSound);
    saveSettings();
    if (typeof CoinTable!=='undefined') CoinTable.preview();
  });
  setSegment('coin-sound-seg','coin',settings.coinSound);

  // Settings → Bank (js/coin-bank.js via CoinTable)
  [['bank-style-seg','bank','bankStyle'],['bank-tags-seg','tags','bankTags'],['bank-change-seg','change','bankChange']].forEach(([id,key,prop])=>{
    document.querySelectorAll('#'+id+' button').forEach(b=>b.onclick=()=>{
      settings[prop] = b.dataset[key];
      setSegment(id,key,settings[prop]);
      saveSettings();
      if (typeof CoinTable!=='undefined' && CoinTable.restyleBank) CoinTable.restyleBank();
    });
    setSegment(id,key,settings[prop]);
  });

  $('open-scoring-guide').onclick = ()=>{
    buildScoringGuide();
    $('settings-sheet').classList.remove('open');
    $('scoring-guide-sheet').classList.add('open');
  };
  $('close-scoring-guide').onclick = ()=>{
    $('scoring-guide-sheet').classList.remove('open');
    $('settings-sheet').classList.add('open');
  };
  $('scoring-guide-back').onclick = ()=>$('close-scoring-guide').click();

  $('reset-run').onclick = ()=>{
    showConfirmDialog({
      title:'Reset Current Run?',
      body:'Deletes your current run progress and starts fresh.',
      confirmLabel:'Reset Current Run',
      danger:true,
      onConfirm:resetCurrentRun
    });
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
    seatPosition, aiThinkTime, speedMult, skullSVG,
    nudgeMood, decayMoods, buildRankings, scheduleAutoDeal, finishHand, aiDecide,
    saveTable, loadTableSave, clearTableSave, restoreTable, continueTable,
    normalizeOpponentCount, runOpponentCount, startSinglePlayerRun,
    Sound, chipStaggerGap, chipStaggerGapAt
  };
}
