"use strict";

/* ============================================================
   CARD FACES LAB — the controls, inside the game (card-faces-lab.html)

   The owner asked for choices for the playing cards' fronts. The copy
   deals a quick game at once; a FACES key on the right edge opens a
   sheet with each candidate (css/card-faces-lab.css) on real cards at
   the game's sizes (your two, the board's, the seats' small ones). A tap
   puts it on the live table and closes the sheet to show it. NEW HAND
   and PLAY TO THE RIVER fill the board; FOUR COLOUR is the player's own
   setting, to see each design with it on.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__cardFacesLab ? parent.__cardFacesLab : null; }catch(e){ return null; } })();
  const app = document.getElementById('app');
  const FACES = [
    ['classic', 'CLASSIC', 'NOW', 'Today\'s card: the blocky rank and a small suit in the corner, a bigger suit bottom right.'],
    ['jumbo', 'JUMBO', '', 'A tall, rounder rank, half again as big: reads from across the table and when the cards overlap. "10" no wider than the rest.'],
    ['tab', 'TAB', '', 'The rank and suit stamped in cream on a tab of the suit\'s colour, like a label on the machine. Red or black before you read a thing.'],
    ['printed', 'PRINTED', '', 'Closest to a real deck: a printed frame line and one big suit in the middle, the rank in the corner.'],
    ['tinted', 'TINTED', '', 'Today\'s layout, the face washed with its suit\'s colour (rosy for red, cool for black; four tints with FOUR COLOUR).'],
    ['bevel', 'BEVEL', '', 'Today\'s layout on a chunkier pixel tile: lit top-left, shaded bottom-right, dithered card stock, a drop shadow on the ink.']
  ];
  let face = (host && host.face) || 'classic';
  const card = (rank, suit, extra) => {
    const c = { rank, suit };
    return '<div class="' + cardClass(false, c, extra === 'small') + (extra === 'hole' ? ' is-hole' : '') + '">' + cardInner(c) + '</div>';
  };
  const spec = id => '<div class="cfl-spec" data-face="' + id + '">' +
    card('A', '♠', 'hole') + card('10', '♥', 'hole') + '<i class="cfl-gap"></i>' +
    card('K', '♦') + card('10', '♣') + '<i class="cfl-gap"></i>' +
    card('J', '♠', 'small') + card('10', '♦', 'small') + '</div>';

  const key = document.createElement('button');
  key.type = 'button'; key.className = 'cfl-key'; key.textContent = 'FACES';
  const sheet = document.createElement('section');
  sheet.className = 'cfl-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Card faces');
  sheet.innerHTML =
    '<div class="cfl-head"><h2>CARD FACES</h2><button type="button" data-do="close" aria-label="Close">✕</button></div>' +
    '<div class="cfl-body">' +
      '<p class="cfl-sub">Six fronts for the playing cards. Each is shown at your two cards\' size, the board\'s and the seats\'. Tap one to see it on the table.</p>' +
      FACES.map(f => '<button type="button" class="cfl-pick" data-face-pick="' + f[0] + '">' +
        '<span class="cfl-name">' + f[1] + (f[2] ? '<em>' + f[2] + '</em>' : '') + '</span>' + spec(f[0]) +
        '<span class="cfl-note">' + f[3] + '</span></button>').join('') +
      '<div class="cfl-row"><button type="button" data-do="deal">NEW HAND</button><button type="button" data-do="river">PLAY TO THE RIVER</button></div>' +
      '<div class="cfl-row"><button type="button" data-do="four">FOUR COLOUR</button><button type="button" data-do="close">DONE</button></div>' +
    '</div>';
  document.body.append(key, sheet);

  function paint(){
    app.setAttribute('data-face', face);
    sheet.querySelectorAll('[data-face-pick]').forEach(b => b.classList.toggle('is-on', b.dataset.facePick === face));
    sheet.querySelector('[data-do="four"]').classList.toggle('is-off', !settings.fourColour);
    if (host) host.face = face;
  }
  const open = on => { sheet.hidden = !on; };
  key.addEventListener('click', () => open(sheet.hidden));
  sheet.addEventListener('click', e => {
    const pick = e.target.closest('[data-face-pick]');
    if (pick){ face = pick.dataset.facePick; paint(); setTimeout(() => open(false), 220); return; }
    const act = e.target.closest('[data-do]')?.dataset.do;
    if (act === 'close') open(false);
    if (act === 'deal'){ open(false); deal(); }
    if (act === 'river'){ open(false); river(); }
    if (act === 'four'){
      settings.fourColour = !settings.fourColour;
      document.body.setAttribute('data-deck', settings.fourColour ? 'four' : 'classic');
      paint();
    }
  });

  /* ---- the table: a quick game, and the board filled on request ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !document.getElementById('actions-row').classList.contains('disabled'));
  function deal(){ startSinglePlayerRun({ opponentCount:3 }); }
  async function river(){
    if (!game || game.over) { deal(); }
    for (let i = 0; i < 12 && !(game.board && game.board.length >= 5); i++){
      if (!await waitFor(myTurn, 20000)) return;
      const owe = game.currentBet - pendingHumanPlayer.betThisRound;
      humanAct(owe > 0 ? 'call' : 'check');
      await sleep(300);
    }
  }

  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    paint();
    deal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
