"use strict";

/* ============================================================
   DASHBOARD V2 — production behaviours (css/dashboard.css)
   Release 1: the rim light, the machine's one state light.

   DashRim reads the table and sets data-rim on the .dash-frame:
     bust  > win > allin > turn > dark
   - turn   your turn (amber, steady)
   - allin  you are all in, or facing an opponent's all-in bet (red pulse)
   - win    you just won a pot (warm, brief); celebrateWinnerSeat() calls
            DashRim.win()
   - bust   you are out of chips at the end of the table (flickers out and
            stays dark until the next table)
   Every switch-on steps in with a relay click (Sound.wheelRelay).

   Presentation only: it reads game state and never writes it. The turn
   changes in many places, so a light watch (paused while the page is
   hidden) keeps the rim in step rather than a hook in each of them.
   ============================================================ */
const DashRim = (function(){
  const WIN_MS = 1700;
  const $id = id => document.getElementById(id);
  let shown = '', winUntil = 0, relayT = 0, shakeT = 0;

  const frame = () => document.querySelector('.dash-frame');
  const human = () => (typeof game !== 'undefined' && game && game.players) ? game.players.find(p => p.isHuman) : null;
  const inHand = () => ['preflop','flop','turn','river'].includes(game.phase);
  function myTurn(){
    if (typeof pendingHumanPlayer === 'undefined' || !pendingHumanPlayer) return false;
    const row = $id('actions-row'), flip = $id('console-flip');
    return !!row && !row.classList.contains('disabled') && !(flip && flip.classList.contains('flipped'));
  }

  function state(){
    const h = human();
    if (!h) return '';
    if (h.chips <= 0 && (game.over || h.eliminated) && !(h.allIn && inHand())) return 'bust';
    if (performance.now() < winUntil) return 'win';
    const turn = myTurn();
    if (h.allIn && !h.folded && inHand()) return 'allin';
    if (turn && game.players.some(p => !p.isHuman && p.allIn && !p.folded) && game.currentBet - pendingHumanPlayer.betThisRound > 0) return 'allin';
    return turn ? 'turn' : '';
  }

  function show(next){
    const el = frame();
    if (!el || next === shown) return;
    shown = next;
    if (next) el.setAttribute('data-rim', next); else el.removeAttribute('data-rim');
    if (!next || next === 'bust'){
      if (next === 'bust' && typeof Sound !== 'undefined' && Sound.wheelRelay) Sound.wheelRelay(.35);
      return;
    }
    if (typeof Sound !== 'undefined' && Sound.wheelRelay) Sound.wheelRelay(.4);
    if (typeof motionOff === 'function' && motionOff()) return;
    clearTimeout(relayT);
    el.classList.remove('dash-relay'); void el.offsetWidth; el.classList.add('dash-relay');
    relayT = setTimeout(() => el.classList.remove('dash-relay'), 340);
  }

  function sync(){ try{ show(state()); }catch(e){} }

  /* A win at your seat: the warm flash, and the existing win shake moved
     onto the whole machine (the case alone would lift under the rim). */
  function win(){
    winUntil = performance.now() + WIN_MS;
    sync();
    setTimeout(sync, WIN_MS + 20);
    const el = frame();
    if (!el || (typeof motionOff === 'function' && motionOff())) return;
    clearTimeout(shakeT);
    el.classList.remove('dash-shake'); void el.offsetWidth; el.classList.add('dash-shake');
    shakeT = setTimeout(() => el.classList.remove('dash-shake'), 480);
  }

  setInterval(() => { if (!document.hidden) sync(); }, 120);

  return { sync, win, get state(){ return shown; } };
})();
