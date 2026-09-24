"use strict";

/* ============================================================
   TICKET FEED — the Career buy-in, fed through the intake

   Replaces the buy-in animation in career-hub-live.js through its
   careerTicketFeed hook. The hook hands over the SAME charge() and
   depart() steps the old feed used, so every money rule stays in
   career-hub-live.js / 07-ui-wiring.js; this file only moves pictures.

     1. LIFT     the selected ticket lifts off the rack; the intake lamp
                 comes on
     2. FEED     the intake ratchets the ticket down in even bites, and the
                 ticket disappears exactly at the slot line (a clip box,
                 not a guessed clip-path)
     3. ACCEPT   the intake bites once more and flashes green, the cabinet
                 thumps, the bankroll counts down
     4. DEPART   the ticket does NOT come back: its rack slot stays empty and
                 the table rolls in. The ticket reappears on the felt as the
                 table intro (js/table-intro.js), stamped ENTRY PAID.

   A tap once the money has moved goes straight to the table.

   STATUS: Lab prototype (intro-lab.html injects this file). Not loaded by
   index.html / sw.js yet.
   ============================================================ */

const TICKET_FEED_CONFIG = {
  timeScale: 1,
  liftMs: 150,
  bites: 5,
  biteMs: 80,
  biteGapMs: 125,
  acceptMs: 620,
  departMs: 280
};

function careerTicketFeed(ctx){
  const cfg = TICKET_FEED_CONFIG;
  const { root, card, charge, startBankroll, paintBankroll, depart } = ctx;
  const intake = root.querySelector('#ch2-intake');
  if (!card || !intake){
    if (charge()) depart(false);
    return;
  }
  const scale = Math.max(.05, cfg.timeScale || 1);
  const timers = [];
  const later = (fn, ms) => { timers.push(window.setTimeout(fn, ms / scale)); };

  // The feed window ends exactly at the intake's top edge: whatever the
  // ticket pushes past that line is inside the machine.
  const rootRect = root.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const slotY = intake.getBoundingClientRect().top - rootRect.top;
  const win = document.createElement('div');
  win.className = 'tf-window';
  win.style.height = slotY + 'px';
  const ticket = card.cloneNode(true);
  ticket.classList.add('tf-ticket');
  ticket.classList.remove('is-feeding','is-selected');
  ticket.setAttribute('aria-hidden','true');
  ticket.querySelectorAll('button').forEach(b => b.tabIndex = -1);
  ticket.style.left = cardRect.left - rootRect.left + 'px';
  ticket.style.top = cardRect.top - rootRect.top + 'px';
  ticket.style.width = cardRect.width + 'px';
  ticket.style.height = cardRect.height + 'px';
  win.appendChild(ticket);
  root.appendChild(win);
  card.classList.add('is-feeding');
  root.classList.add('tf-feeding');

  const travel = slotY - (cardRect.top - rootRect.top) + 6;
  const move = (y, ms, ease, extra = '') => {
    ticket.style.transition = 'transform ' + (ms / scale) + 'ms ' + ease;
    ticket.style.transform = 'translateY(' + y + 'px)' + extra;
  };

  // 1. LIFT
  ticket.getBoundingClientRect();
  move(-8, cfg.liftMs, 'cubic-bezier(.2,.8,.3,1)', ' scale(1.015)');

  // 2. FEED — even bites, each with a click and a shudder of the intake.
  const firstBite = cfg.liftMs + 40;
  for (let i = 1; i <= cfg.bites; i++){
    const at = firstBite + (i - 1) * cfg.biteGapMs;
    later(() => {
      move(travel * i / cfg.bites, cfg.biteMs, 'cubic-bezier(.5,0,.7,1)');
      intake.classList.remove('tf-bite'); void intake.offsetWidth; intake.classList.add('tf-bite');
      Sound.stageRollClick(.3 + i * .14, i === cfg.bites);
      haptic(6);
    }, at);
  }
  const swallowed = firstBite + (cfg.bites - 1) * cfg.biteGapMs + cfg.biteMs + 30;

  let skippable = false, finished = false;
  const skip = event => {
    if (!skippable) return;
    event.preventDefault();
    event.stopPropagation();
    swallowNextClick();
    finish(true);
  };
  root.addEventListener('pointerdown', skip, true);
  const tidy = () => {
    win.remove();
    root.classList.remove('tf-feeding','tf-accepted','is-stamped');
    intake.classList.remove('tf-bite');
    const reel = root.querySelector('#ch2-bankroll');
    if (reel) reel.setAttribute('aria-live','polite');
  };
  function finish(instant){
    if (finished) return;
    finished = true;
    root.removeEventListener('pointerdown', skip, true);
    timers.forEach(t => window.clearTimeout(t));
    tidy();
    // The ticket stays gone from the rack: it is on its way to the table.
    depart(instant);
  }

  // 3. ACCEPT
  later(() => {
    if (!charge()){
      finished = true;
      root.removeEventListener('pointerdown', skip, true);
      timers.forEach(t => window.clearTimeout(t));
      tidy();
      card.classList.remove('is-feeding');
      return;
    }
    skippable = true;
    root.classList.add('tf-accepted');
    root.classList.remove('is-stamped'); void root.offsetWidth; root.classList.add('is-stamped');
    Sound.hatchClose();
    Sound.koThunk(.9);
    haptic([10, 8, 24]);
    const end = careerBankroll();
    const change = Math.max(0, startBankroll - end);
    const reel = root.querySelector('#ch2-bankroll');
    if (reel) reel.setAttribute('aria-live','off');
    const housing = root.querySelector('.ch2-bankroll-housing');
    if (housing){ housing.classList.remove('is-payment'); void housing.offsetWidth; housing.classList.add('is-payment'); }
    const step = change <= 100 ? 10 : change <= 300 ? 20 : Math.max(50, Math.ceil(change / 12 / 10) * 10);
    const ticks = Math.max(1, Math.ceil(change / step));
    const tickMs = Math.max(30, Math.min(60, 420 / ticks));
    for (let n = 1; n <= ticks; n++) later(() => {
      paintBankroll(Math.max(end, startBankroll - n * step));
      Sound.counterTick(true);
    }, 80 + n * tickMs);
    later(() => { paintBankroll(end); Sound.counterLock(true); }, 80 + ticks * tickMs + 40);
  }, swallowed);

  // 4. DEPART
  later(() => { Sound.buttonRelease('award'); haptic(20); finish(false); },
    swallowed + cfg.acceptMs + cfg.departMs);
}
