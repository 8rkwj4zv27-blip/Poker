"use strict";

/* ============================================================
   TICKET FEED — the Career buy-in, fed through the intake

   Replaces the buy-in animation in career-hub-live.js through its
   careerTicketFeed hook. The hook hands over the SAME charge() and
   depart() steps the old feed used, so every money rule stays in
   career-hub-live.js / 07-ui-wiring.js; this file only moves pictures.

     1. LIFT     the selected ticket lifts off the rack and narrows to the
                 width of the intake's mouth, lined up over it; the mouth
                 lights
     2. FEED     the intake ratchets the ticket down in even bites. The
                 ticket passes IN FRONT of the intake plate's top lip and
                 disappears into the dark mouth (a clip box ending at the
                 mouth, not the plate), shading as it goes in
     3. SHRED    the cabinet shudders and grinds, scraps of the ticket spit
                 out of the mouth, the mouth goes green and the bankroll
                 counts down
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
  bites: 6,
  biteMs: 80,
  biteGapMs: 150,
  shredMs: 560,
  shreds: 16,
  acceptMs: 700,
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

  // The feed window ends inside the intake's dark mouth, and sits above
  // the intake plate: the ticket covers the plate's top lip on its way in
  // and whatever passes the mouth line is inside the machine.
  const mouth = intake.querySelector('.ch2-intake-mouth') || intake;
  const rootRect = root.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const mouthRect = mouth.getBoundingClientRect();
  const slotY = mouthRect.top - rootRect.top + Math.round(mouthRect.height * .45);
  const win = document.createElement('div');
  win.className = 'tf-window';
  win.style.height = slotY + 'px';
  win.style.setProperty('--tf-mouth-l', mouthRect.left - rootRect.left + 3 + 'px');
  win.style.setProperty('--tf-mouth-w', mouthRect.width - 6 + 'px');
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

  // A real ticket has to fit the slot: it narrows to the mouth's width
  // (scaled about its bottom centre, lined up over the mouth's centre).
  const fit = Math.min(1, (mouthRect.width - 10) / cardRect.width);
  const dx = (mouthRect.left + mouthRect.width / 2) - (cardRect.left + cardRect.width / 2);
  // Fully in once the (narrowed) ticket's top edge passes the mouth line.
  const cardBottom = cardRect.bottom - rootRect.top;
  const travel = slotY - (cardBottom - cardRect.height * fit) + 8;
  let jog = 0;
  const move = (y, ms, ease, lift = 0) => {
    ticket.style.transition = 'transform ' + (ms / scale) + 'ms ' + ease;
    ticket.style.transform = 'translate(' + (dx + jog) + 'px,' + (y - lift) + 'px) scale(' + fit + ')';
  };

  // 1. LIFT — up off the rack, narrowed and aimed at the mouth.
  ticket.style.transformOrigin = '50% 100%';
  ticket.getBoundingClientRect();
  move(0, cfg.liftMs, 'cubic-bezier(.2,.8,.3,1)', 10);

  // 2. FEED — even bites, each with a click and a shudder of the intake.
  const firstBite = cfg.liftMs + 40;
  for (let i = 1; i <= cfg.bites; i++){
    const at = firstBite + (i - 1) * cfg.biteGapMs;
    later(() => {
      jog = i === cfg.bites ? 0 : (i % 2 ? 1 : -1);
      move(travel * i / cfg.bites, cfg.biteMs, 'cubic-bezier(.5,0,.7,1)');
      intake.classList.remove('tf-bite'); void intake.offsetWidth; intake.classList.add('tf-bite');
      Sound.stageRollClick(.3 + i * .14, i === cfg.bites);
      haptic(6);
    }, at);
  }
  const swallowed = firstBite + (cfg.bites - 1) * cfg.biteGapMs + cfg.biteMs + 30;

  let skippable = false, finished = false, shredBox = null;
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
    if (shredBox) shredBox.remove();
    root.classList.remove('tf-feeding','tf-accepted','tf-shredding','is-stamped');
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

  /* The shredder: the cabinet shudders, the motor grinds, and scraps of
     the ticket's own paper spit out of the mouth and fall away. */
  function shred(){
    root.classList.remove('tf-shredding'); void root.offsetWidth;
    root.classList.add('tf-shredding');
    root.style.setProperty('--tf-shred-ms', (cfg.shredMs / scale) + 'ms');
    haptic([8, 6, 8, 6, 8, 6, 20]);
    Sound.hatchClose();
    const grind = Math.round(cfg.shredMs / 34);
    for (let i = 0; i < grind; i++) later(() => Sound.wheelTooth(.9 - i / grind * .4, false), i * 34);
    const paperStyle = getComputedStyle(card.querySelector('.ch2-paper') || card);
    const paper = paperStyle.backgroundColor || '#e9ddb3';
    const ink = paperStyle.color || '#171714';
    const box = document.createElement('div');
    box.className = 'tf-shreds';
    box.style.left = mouthRect.left - rootRect.left + 'px';
    box.style.top = mouthRect.top - rootRect.top + 'px';
    box.style.width = mouthRect.width + 'px';
    for (let i = 0; i < cfg.shreds; i++){
      const bit = document.createElement('i');
      const side = Math.random() < .5 ? -1 : 1;
      bit.style.left = (10 + Math.random() * 80) + '%';
      bit.style.background = i % 4 === 0 ? ink : paper;
      bit.style.setProperty('--x', side * (18 + Math.random() * 60) + 'px');
      bit.style.setProperty('--y', -(22 + Math.random() * 46) + 'px');
      bit.style.setProperty('--fall', (60 + Math.random() * 70) + 'px');
      bit.style.setProperty('--r', side * (120 + Math.random() * 300) + 'deg');
      bit.style.setProperty('--d', (Math.random() * cfg.shredMs * .6 / scale) + 'ms');
      bit.style.setProperty('--t', ((520 + Math.random() * 260) / scale) + 'ms');
      box.appendChild(bit);
    }
    root.appendChild(box);
    shredBox = box;
    later(() => {
      root.classList.remove('tf-shredding');
      root.classList.add('tf-accepted');
      Sound.koThunk(.8);
      haptic(18);
    }, cfg.shredMs);
  }

  // 3. SHRED + ACCEPT
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
    shred();
    const end = careerBankroll();
    const change = Math.max(0, startBankroll - end);
    const reel = root.querySelector('#ch2-bankroll');
    if (reel) reel.setAttribute('aria-live','off');
    const housing = root.querySelector('.ch2-bankroll-housing');
    if (housing){ housing.classList.remove('is-payment'); void housing.offsetWidth; housing.classList.add('is-payment'); }
    const step = change <= 100 ? 10 : change <= 300 ? 20 : Math.max(50, Math.ceil(change / 12 / 10) * 10);
    const ticks = Math.max(1, Math.ceil(change / step));
    const tickMs = Math.max(30, Math.min(60, 420 / ticks));
    // The bill is settled as the shredder finishes.
    const settleAt = cfg.shredMs * .55;
    for (let n = 1; n <= ticks; n++) later(() => {
      paintBankroll(Math.max(end, startBankroll - n * step));
      Sound.counterTick(true);
    }, settleAt + n * tickMs);
    later(() => { paintBankroll(end); Sound.counterLock(true); }, settleAt + ticks * tickMs + 40);
  }, swallowed);

  // 4. DEPART
  later(() => { Sound.buttonRelease('award'); haptic(20); finish(false); },
    swallowed + cfg.shredMs + cfg.acceptMs + cfg.departMs);
}
