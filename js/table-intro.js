"use strict";

/* ============================================================
   TABLE INTRO — "the machine powers up"

   The beat between arriving at a table and its first deal. The table is
   already built (seats, stacks, deck) when this runs; it only switches the
   parts on, one after another:

     1. LIGHTS   the felt comes up in stepped relay clunks, console lamps
                 flicker on left to right
     2. TICKET   the event's own ticket (the same one fed into the Career
                 machine, same venue styling) slides in from the right,
                 sits centred to be read, and slides out to the left
     3. ROLL     opponents' seats light one by one, clockwise, their stack
                 reels counting up. Your console lights last.
     4. BANK     the bank hatch opens and your chips drop in as whole
                 stacks, back row first, left to right; the hatch shuts
     5. POT      the pot tray opens, the deck drops onto the station

   Then the real startNewHand() runs unchanged (blinds, riffle, deal).

   PRESENTATION ONLY. Reads `game`, never writes poker state, never touches
   storage. It works by wrapping the table entry points (startCareerEvent,
   continueCareerEvent, startCareerCashSession, startSinglePlayerRun,
   continueTable, startGame) to ARM the intro, and startNewHand() to PLAY
   it before the first deal. Every caller looks these globals up by name,
   so wrapping them is enough — the same technique MachineWheel.install()
   uses. The Machine Wheel's own capture/restore of startNewHand during the
   Career roll resolves to the wrapper, so the intro plays after the wheel
   locks, not under it.

   A tap anywhere jumps straight to the finished state. Reduced Motion
   skips the intro entirely.

   Live: loaded by index.html (and precached by sw.js) after
   machine-wheel.js. intro-lab.html can switch it off to compare.
   ============================================================ */

const TABLE_INTRO_CONFIG = {
  enabled: true,
  timeScale: 1,            // 0.5 = half speed (Lab only)
  lights: { steps: [.32, .62, 1], stepMs: 150 },
  ticket: { inMs: 420, holdMs: 1500, prestigeHoldMs: 1900, outMs: 340 },
  roll: { seatMs: 240, youMs: 340 },
  bank: { hatchMs: 150, stackGapMs: 95, dropMs: 260, settleMs: 140 },
  pot: { trayMs: 240, deckMs: 300 },
  resume: { seatSweepMs: 60 }
};

const TableIntro = (() => {
  const cfg = TABLE_INTRO_CONFIG;
  const PRESTIGE_VENUES = ['HIGH ROLLER ROOM','INVITATIONAL CHAMPIONSHIP'];
  let armed = null;          // { kind, title } between entry and first deal
  let armDepth = 0;
  let playing = null;        // the live run, so a tap can hurry it
  let installed = false;
  const originals = {};

  const screen = () => $('table-screen');
  const active = () => cfg.enabled && !motionOff();

  /* ---------- arming ---------- */

  function arm(kind){
    if (armDepth++ === 0 && !armed) armed = { kind, title:null, primed:false };
  }
  function disarmIfNoTable(){
    if (--armDepth > 0) return;
    armDepth = 0;
    const t = screen();
    if (!armed) return;
    if (!active() || !t || t.classList.contains('hidden') || !game){ armed = null; return; }
    prime(armed);
  }

  /* The dark, unpowered table the wheel rolls in. Only classes: removing
     them all (finish()) always restores the ordinary table. */
  function prime(intro){
    if (!intro || intro.primed) return;
    intro.primed = true;
    const t = screen();
    if (!t) return;
    t.classList.add('ti-primed');
    t.dataset.tiLight = '0';
    const meta = $('table-meta');
    if (meta) meta.textContent = '';
    document.querySelectorAll('#felt .seat').forEach(s => s.classList.add('ti-unlit'));
    const pot = $('pot-area');
    if (pot) pot.classList.add('hidden');
  }

  /* ---------- the sequence ---------- */

  const money = n => '$' + Number(n || 0).toLocaleString('en-US');
  function venueKey(venue){
    const room = typeof CAREER_ROOMS !== 'undefined' && CAREER_ROOMS.find(r => r.venue === venue);
    return (room && room.key) || 'backroom';
  }
  const shortVenue = v => String(v || '').replace(' CHAMPIONSHIP','').replace('HIGH ROLLER ROOM','HIGH ROLLER');

  /* What the ticket says. Career tickets match their Career Hub card:
     venue, title, the same headline, then the table's live numbers. */
  function tableInfo(intro){
    const g = game;
    const seats = g.players.filter(p => !p.eliminated).length;
    const cashLike = g.mode === 'career' || g.mode === 'career-cash';
    const blinds = g.smallBlind != null && g.bigBlind != null
      ? (cashLike ? money(g.smallBlind) + '/' + money(g.bigBlind) : g.smallBlind + '/' + g.bigBlind) : '—';
    const ev = g.event || null;
    let venue = '', key = 'backroom', title = intro.title || '', headline = '', stamp = '', prestige = false;
    if (g.mode === 'career-cash'){
      venue = (typeof CAREER_CASH_CONFIG !== 'undefined' && CAREER_CASH_CONFIG.venue) || 'BACK ROOM';
      key = venueKey(venue);
      title = title || 'CASH TABLE';
      headline = money(g.smallBlind) + ' / ' + money(g.bigBlind) + ' CASH';
      stamp = 'ENTRY PAID';
    } else if (g.mode === 'career' && ev){
      venue = ev.venue || '';
      key = venueKey(venue);
      title = title || (typeof careerEventTitle === 'function' ? careerEventTitle(ev) : ev.name) || 'EVENT';
      prestige = PRESTIGE_VENUES.includes(ev.venue);
      const payouts = typeof careerPayouts === 'function' ? careerPayouts(ev) : [ev.prize];
      headline = money(payouts[0]) + (payouts.length > 1 ? ' TOP PRIZE' : ' PRIZE');
      stamp = 'ENTRY PAID';
    } else if (g.mode === 'elimination' && g.run){
      venue = 'SINGLE PLAYER';
      title = title || 'TABLE ' + g.run.tableNumber;
      headline = 'LAST ONE STANDING';
    } else {
      venue = g.mode === 'tournament' ? 'TOURNAMENT' : 'HOUSE GAME';
      title = title || 'TABLE';
      headline = 'NO LIMIT HOLD\'EM';
    }
    if (intro.kind === 'resume') stamp = 'RESUMED · HAND ' + ((g.handNumber || 0) + 1);
    return { venue:shortVenue(venue), key, title:String(title).toUpperCase(), headline, blinds, seats, stamp, prestige };
  }

  async function play(intro){
    const g = game;
    const t = screen();
    if (!g || !t) return;
    prime(intro);
    const run = { skipped:false, wakers:new Set(), intro, g };
    playing = run;
    const scale = () => Math.max(.05, cfg.timeScale || 1);
    const wait = ms => run.skipped ? Promise.resolve() : new Promise(resolve => {
      let done = false;
      const fin = () => { if (done) return; done = true; run.wakers.delete(fin); resolve(); };
      run.wakers.add(fin);
      window.setTimeout(fin, ms / scale());
    });
    const alive = () => !run.skipped && game === g && !t.classList.contains('hidden');
    const app = $('app') || document;
    const onTap = event => {
      if (run.skipped) return;
      event.preventDefault();
      run.skipped = true;
      if (typeof swallowNextClick === 'function') swallowNextClick();
      run.wakers.forEach(w => w());
    };
    app.addEventListener('pointerdown', onTap, true);
    t.classList.add('ti-running');
    const info = tableInfo(intro);
    const full = intro.kind !== 'resume';
    const quickSeats = intro.kind === 'resume' || g.mode === 'career-cash';
    const fx = { ticket:null };
    try{
      await lights(run, wait, alive);
      // The ticket's exit overlaps the roll call: the seats start lighting
      // as it clears the felt.
      if (alive()) await ticket(run, wait, alive, info, fx);
      if (alive()){
        if (quickSeats) await sweepSeats(run, wait, alive);
        else await rollCall(run, wait, alive);
      }
      if (alive()) await youLight(run, wait);
      if (alive() && full) await loadBank(run, wait, alive);
      if (alive() && full) await potAndDeck(run, wait);
      if (alive()) await wait(180);
    } catch (error){
      console.error('Table intro failed; finishing it directly.', error);
    } finally{
      app.removeEventListener('pointerdown', onTap, true);
      if (game === g) finish(info, fx);
      else cleanup(fx);
      playing = null;
    }
  }

  /* 1. LIGHTS — stepped, never a smooth fade: a relay closes per step. */
  async function lights(run, wait, alive){
    const t = screen();
    const steps = cfg.lights.steps;
    for (let i = 0; i < steps.length; i++){
      if (!alive()) return;
      t.dataset.tiLight = String(i + 1);
      Sound.wheelRelay(.45 + i * .3);
      if (i === 0) t.classList.add('ti-console-on');
      await wait(cfg.lights.stepMs);
    }
  }

  /* 2. TICKET — in from the right, held centre stage, out to the left. */
  async function ticket(run, wait, alive, info, fx){
    const felt = $('felt');
    if (!felt) return;
    const lane = document.createElement('div');
    lane.className = 'ti-ticket-lane';
    lane.setAttribute('aria-hidden','true');
    lane.innerHTML =
      '<article class="ch2-card ti-ticket' + (info.prestige ? ' is-prestige' : '') + '" data-venue="' + esc(info.key) + '">' +
        '<div class="ch2-card-inner"><section class="ch2-card-face ch2-card-front ch2-paper">' +
          '<header class="ch2-card-venue">' + esc(info.venue) + '</header>' +
          '<h2>' + esc(info.title) + '</h2>' +
          '<div class="ch2-headline">' + esc(info.headline) + '</div>' +
          '<div class="ch2-card-stats"><span><small>BLINDS</small><strong>' + esc(info.blinds) + '</strong></span>' +
          '<span><small>SEATS</small><strong>' + info.seats + '</strong></span></div>' +
        '</section></div>' +
        // Outside the paper (which clips), so it can overhang the corner.
        (info.stamp ? '<div class="ch2-stamp ch2-stamp-paid ti-ticket-stamp">' + esc(info.stamp) + '</div>' : '') +
      '</article>';
    felt.appendChild(lane);
    fx.ticket = lane;
    const t = lane.firstElementChild;
    const scale = Math.max(.05, cfg.timeScale || 1);
    t.style.setProperty('--ti-in-ms', (cfg.ticket.inMs / scale) + 'ms');
    t.style.setProperty('--ti-out-ms', (cfg.ticket.outMs / scale) + 'ms');
    t.getBoundingClientRect();
    t.classList.add('is-in');
    Sound.cardDeal();
    await wait(cfg.ticket.inMs * .8);
    if (!alive()) return;
    Sound.deckSettle();
    if (info.stamp){
      await wait(260);
      if (!alive()) return;
      t.classList.add('is-stamped');
      Sound.koThunk(.8);
    }
    await wait(info.prestige ? cfg.ticket.prestigeHoldMs : cfg.ticket.holdMs);
    if (!alive()) return;
    t.classList.add('is-out');
    Sound.cardReturn();
    dockTitle(info);
    // Let it clear before the seats light, but only just.
    await wait(cfg.ticket.outMs * .6);
    window.setTimeout(() => { lane.remove(); if (fx.ticket === lane) fx.ticket = null; }, cfg.ticket.outMs / scale + 60);
  }

  function dockTitle(info){
    const meta = $('table-meta');
    if (!meta) return;
    meta.textContent = info.title;
    meta.classList.remove('ti-meta-flash'); void meta.offsetWidth; meta.classList.add('ti-meta-flash');
  }

  function seatOrder(){
    // Seat index order runs left → over the top → right: clockwise from
    // the player's chair.
    return game.players.filter(p => !p.isHuman && seatEls[p.id]);
  }

  /* 3. ROLL CALL — one seat at a time. */
  async function rollCall(run, wait, alive){
    for (const p of seatOrder()){
      if (!alive()) return;
      const e = seatEls[p.id];
      e.root.classList.remove('ti-unlit');
      if (p.eliminated){ e.root.classList.add('ti-lit-dead'); continue; }
      e.root.classList.add('ti-lit');
      if (e.chips) updateSeatReels(e.chips, p.chips);
      Sound.wheelTooth(.6, false);
      await wait(cfg.roll.seatMs);
    }
  }

  /* Cash and resume: the room is already live — every seat in one quick
     sweep. */
  async function sweepSeats(run, wait, alive){
    for (const p of seatOrder()){
      if (!alive()) return;
      const e = seatEls[p.id];
      e.root.classList.remove('ti-unlit');
      e.root.classList.add(p.eliminated ? 'ti-lit-dead' : 'ti-lit');
      if (!p.eliminated && e.chips) updateSeatReels(e.chips, p.chips);
      await wait(cfg.resume.seatSweepMs);
    }
    Sound.wheelTooth(.5, true);
    await wait(160);
  }

  /* The player's console answers last, and loudest. */
  async function youLight(run, wait){
    const frame = $('hud-frame');
    if (frame){ frame.classList.remove('ti-you'); void frame.offsetWidth; frame.classList.add('ti-you'); }
    Sound.wheelCatch();
    await wait(cfg.roll.youMs);
  }

  /* 4. BANK — the finished pile is built first (the game's own pile
     layout, exactly what the table would show), then each stack drops in
     whole through the hatch in a fixed order: back row first, left to
     right. CSS runs the motion, so it never stutters on timers; the few
     sounds are scheduled to the landings. */
  function buildBankStacks(){
    const human = game.players.find(p => p.isHuman);
    const tower = $('hud-tower');
    if (!human || !tower) return [];
    // the gold-coin rack (js/coin-table.js) fills itself through the hatch
    if (coinTableOn()){ CoinTable.loadBank(); return []; }
    resetPile(tower, bankPile());
    const n = visualChipCount(human.chips);
    for (let i = 0; i < n; i++) createRestingChip(tower, bankPile());
    tower.querySelectorAll('.disc-in').forEach(c => c.classList.remove('disc-in'));
    return Object.values(tower._towers || {}).sort((a, b) =>
      (+a.style.zIndex || 0) - (+b.style.zIndex || 0) || parseFloat(a.style.left) - parseFloat(b.style.left));
  }
  async function loadBank(run, wait, alive){
    const human = game.players.find(p => p.isHuman);
    if (!human) return;
    openHatch();
    Sound.hatchOpen();
    await wait(cfg.bank.hatchMs);
    if (!alive()) return;
    const stacks = buildBankStacks();
    const scale = Math.max(.05, cfg.timeScale || 1);
    const gap = cfg.bank.stackGapMs, drop = cfg.bank.dropMs;
    stacks.forEach((stack, i) => {
      stack.style.setProperty('--ti-delay', (i * gap / scale) + 'ms');
      stack.style.setProperty('--ti-drop-ms', (drop / scale) + 'ms');
      stack.classList.add('ti-stack-drop');
      window.setTimeout(() => { if (!run.skipped) Sound.chipCollect(1 + Math.min(.4, stack.children.length / 40)); },
        (i * gap + drop * .72) / scale);
    });
    updateJackpot(human.chips);
    await wait(stacks.length * gap + drop + cfg.bank.settleMs);
    closeHatch();
    Sound.hatchClose();
  }

  /* 5. POT + DECK — the tray the blinds will land in, and the deck. */
  async function potAndDeck(run, wait){
    const pot = $('pot-area');
    if (pot){
      if ($('pot-val')) $('pot-val').textContent = '0';
      pot.classList.remove('hidden');
      pot.classList.add('ti-pot-open');
    }
    Sound.counterLock(false);
    await wait(cfg.pot.trayMs);
    const station = document.querySelector('.dealer-station');
    if (station) station.classList.add('ti-deck-drop');
    screen().classList.add('ti-deck-in');
    await wait(cfg.pot.deckMs * .55);
    Sound.deckSettle();
    await wait(cfg.pot.deckMs * .45);
  }

  /* The finished state, reached either by playing through or by a tap.
     Idempotent: completes whatever a hurried run left undone. */
  function finish(info, fx){
    const t = screen();
    const g = game;
    cleanup(fx);
    if (!t || !g) return;
    seatOrder().forEach(p => {
      const e = seatEls[p.id];
      if (!e.root.classList.contains('ti-unlit')) return;
      e.root.classList.remove('ti-unlit');
      if (!p.eliminated && e.chips) updateSeatReels(e.chips, p.chips);
    });
    const human = g.players.find(p => p.isHuman);
    const tower = $('hud-tower');
    if (human && tower){
      if (coinTableOn()) CoinTable.renderBank();
      else if ((tower._chipCount || 0) !== visualChipCount(human.chips)) buildBankStacks();
      tower.querySelectorAll('.ti-stack-drop').forEach(el => el.classList.remove('ti-stack-drop'));
      updateJackpot(human.chips);
    }
    const hatch = $('bank-hatch');
    if (hatch && hatch.classList.contains('is-open')) closeHatch();
    if (info) dockTitle(info);
    const pot = $('pot-area');
    if (pot && !(g.pot > 0)) pot.classList.add('hidden');
    t.classList.remove('ti-primed','ti-running','ti-console-on','ti-deck-in');
    delete t.dataset.tiLight;
    document.querySelectorAll('#felt .seat').forEach(s => s.classList.remove('ti-unlit','ti-lit','ti-lit-dead'));
    // Let the one-shot seat/console flashes finish, then drop their hooks.
    window.setTimeout(() => {
      document.querySelectorAll('.ti-pot-open,.ti-deck-drop').forEach(el => el.classList.remove('ti-pot-open','ti-deck-drop'));
      const frame = $('hud-frame');
      if (frame) frame.classList.remove('ti-you');
    }, 700);
  }
  function cleanup(fx){
    if (fx && fx.ticket){ fx.ticket.remove(); fx.ticket = null; }
  }

  /* ---------- install ---------- */

  function wrapEntry(name, kind){
    const orig = window[name];
    if (typeof orig !== 'function') return;
    originals[name] = orig;
    window[name] = function(...args){
      const opts = args[0];
      // The menu-launch path (deferHand) stages its own seat drop-in.
      const skip = name === 'startSinglePlayerRun' && opts && opts.deferHand === true;
      if (!skip) arm(kind);
      try { return orig.apply(this, args); }
      finally { if (!skip) disarmIfNoTable(); }
    };
  }

  function install(){
    if (installed) return;
    installed = true;
    wrapEntry('startCareerEvent','event');
    wrapEntry('continueCareerEvent','resume');
    wrapEntry('startCareerCashSession','cash');
    wrapEntry('startSinglePlayerRun','single');
    wrapEntry('continueTable','resume');
    wrapEntry('startGame','house');

    originals.careerTableCallout = window.careerTableCallout;
    window.careerTableCallout = function(text){
      // The wheel hands the table's name over after it locks; the intro
      // shows it on the ticket instead of the old one-second flash.
      if (armed && active()){ armed.title = text || armed.title; return; }
      return originals.careerTableCallout.apply(this, arguments);
    };

    originals.startNewHand = window.startNewHand;
    window.startNewHand = async function(...args){
      const intro = armed;
      armed = null;
      if (intro && active() && game){
        const g = game;
        await play(intro);
        if (game !== g) return;
      } else if (intro){
        const t = screen();
        if (t) t.classList.remove('ti-primed');
        document.querySelectorAll('#felt .seat.ti-unlit').forEach(s => s.classList.remove('ti-unlit'));
      }
      return originals.startNewHand.apply(this, args);
    };
  }

  function uninstall(){
    if (!installed) return;
    Object.keys(originals).forEach(name => { window[name] = originals[name]; delete originals[name]; });
    installed = false;
    armed = null;
  }

  return {
    config: cfg,
    install, uninstall,
    get installed(){ return installed; },
    get playing(){ return !!playing; },
    hurry(){ if (playing){ playing.skipped = true; playing.wakers.forEach(w => w()); } }
  };
})();

TableIntro.install();
