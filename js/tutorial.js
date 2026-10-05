"use strict";
/* ============================================================
   THE TOUR — a first-play walk round the machine.

   It runs once, at the player's first turn ever (any mode: Quick Deal,
   Custom Game or Career), because that is the moment every part it
   points at is on screen: the opponents, your two cards, the readouts
   and the three keys. The game is already waiting for the player, so
   nothing is paused or held. A dimmed sheet with a lit window shows
   each part in turn with a short card (the old first-run card's style).

   Settings → Help → HOW TO PLAY runs it again at the next turn (or now,
   if it's already your turn). Saved as settings.seenTour.
   Presentation only: nothing here touches the game.
   ============================================================ */
const Tour = (() => {
  const $ = id => document.getElementById(id);
  const STEPS = [
    { title:'Welcome to Poker Faces',
      text:'No-limit Texas Hold’em against a table of characters. Win chips by holding the best five-card hand when the cards are shown, or by betting until everyone else folds.' },
    { title:'The opponents',
      targets:['#felt .seat:not(.you) .seat-card'],
      text:'Each cabinet shows a player’s name, chips and last move. A lit frame shows whose turn it is. Watch their faces.' },
    { title:'Your cards',
      targets:['.seat.you .seat-cards', '#hand-strength'],
      text:'Your two cards, for your eyes only. Five shared cards come out in the middle; the screen underneath names your best hand as they do.' },
    { title:'The readouts',
      targets:['#banner', '#hud-mid .stack-readout', '#hud-left'],
      text:'The screen tells you what just happened and what it costs you to stay in. STACK is your chips, and the bank on the left holds them.' },
    { title:'Your three keys',
      targets:['#actions-row'],
      text:'FOLD gives up the hand. CHECK or CALL stays in. RAISE (or BET) puts more in: tap it once to open the slider, pick an amount, then tap CONFIRM.' },
    { title:'The right-hand bay',
      targets:['#hud-right'],
      text:'SB and BB light up when you pay a blind. BET THIS HAND counts what you’ve put in. ⚙ opens settings: game speed, Leave Table and more. The little screen next to it is P.I.P., a coach you can switch on.' },
    { title:'End of a hand',
      text:'When the betting is done the keys turn over: press SHOWDOWN to see the cards, then AWARD POT to pay the winner. Hand Rankings on the main menu shows what beats what. Good luck.' }
  ];

  let el = null, ring = null, step = 0;

  function build(){
    if (el) return;
    el = document.createElement('div');
    el.id = 'tour'; el.className = 'hidden';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'How to play');
    el.innerHTML =
      '<div class="tour-ring" aria-hidden="true"></div>' +
      '<div class="fr-card tour-card">' +
        '<div class="tour-count"></div>' +
        '<h4 class="tour-title"></h4>' +
        '<p class="tour-text"></p>' +
        '<div class="tour-keys">' +
          '<button class="tour-skip" type="button">Skip</button>' +
          '<button class="btn-primary tour-next" type="button">Next</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    ring = el.querySelector('.tour-ring');
    el.querySelector('.tour-next').onclick = () => { press(); go(step + 1); };
    el.querySelector('.tour-skip').onclick = () => { press(); close(); };
    addEventListener('resize', () => { if (open()) place(); });
  }
  function press(){ try{ Sound.buttonPress('check'); }catch(e){} }
  function open(){ return !!el && !el.classList.contains('hidden'); }

  // one window round every target that is on screen
  function box(sel){
    const rs = [];
    sel.forEach(s => document.querySelectorAll(s).forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.width && r.height) rs.push(r);
    }));
    if (!rs.length) return null;
    return {
      left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)),
      right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom))
    };
  }

  function place(){
    const s = STEPS[step];
    const b = s.targets ? box(s.targets) : null;
    el.classList.toggle('tour-plain', !b);
    if (b){
      const pad = 6;
      ring.style.left = (b.left - pad) + 'px';
      ring.style.top = (b.top - pad) + 'px';
      ring.style.width = (b.right - b.left + pad * 2) + 'px';
      ring.style.height = (b.bottom - b.top + pad * 2) + 'px';
      // the card goes on whichever side of the window has more room
      const above = b.top, below = innerHeight - b.bottom;
      el.classList.toggle('tour-card-top', below < above);
    } else el.classList.remove('tour-card-top');
  }

  function go(i){
    if (i >= STEPS.length){ close(); return; }
    step = i;
    const s = STEPS[i];
    el.querySelector('.tour-count').textContent = (i + 1) + ' / ' + STEPS.length;
    el.querySelector('.tour-title').textContent = s.title;
    el.querySelector('.tour-text').textContent = s.text;
    el.querySelector('.tour-next').textContent = i === STEPS.length - 1 ? 'Play' : 'Next';
    el.querySelector('.tour-skip').classList.toggle('hidden', i === STEPS.length - 1);
    place();
  }

  function start(){
    build();
    el.classList.remove('hidden');
    go(0);
    el.querySelector('.tour-next').focus({ preventScroll:true });
  }
  function close(){
    if (!el) return;
    el.classList.add('hidden');
    settings.seenTour = true; saveSettings();
  }

  /* Called by the engine when the player's turn starts. */
  function maybeStart(){
    if (open()) return;
    if (settings.seenTour) return;
    // on the table and actually waiting on the player
    if (typeof pendingHumanPlayer === 'undefined' || !pendingHumanPlayer) return;
    if ($('table-screen') && $('table-screen').classList.contains('hidden')) return;
    // let the cards land and the keys light first
    setTimeout(() => {
      if (!open() && pendingHumanPlayer && !settings.seenTour) start();
    }, motionOff() ? 0 : 700);
  }

  /* Settings → Help → HOW TO PLAY: now if it's your turn, else at the next. */
  function replay(){
    settings.seenTour = false; saveSettings();
    maybeStart();
  }

  return { maybeStart, replay, start, close, isOpen:open };
})();
