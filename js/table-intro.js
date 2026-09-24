"use strict";

/* ============================================================
   TABLE INTRO — "the machine powers up"

   The beat between arriving at a table and its first deal. The table is
   already built (seats, stacks, deck) when this runs; it only switches the
   parts on, one after another:

     1. LIGHTS   the felt comes up in stepped relay clunks, console lamps
                 flicker on left to right
     2. MARQUEE  the table's name types out on a lamp strip, a details line
                 under it, then the strip docks into the top bar
     3. ROLL     opponents' seats light one by one, clockwise; each gets a
                 short style tag and its stack reels count up. Your console
                 lights last.
     4. BANK     the bank hatch opens, your chips stack in, the hatch shuts
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

   STATUS: Lab prototype (intro-lab.html injects this file). Not loaded by
   index.html / sw.js yet.
   ============================================================ */

const TABLE_INTRO_CONFIG = {
  enabled: true,
  timeScale: 1,            // 0.5 = half speed (Lab only)
  lights: { steps: [.32, .62, 1], stepMs: 150 },
  marquee: { typeMs: 42, holdMs: 420, prestigeHoldMs: 700, dockMs: 320 },
  roll: { seatMs: 240, youMs: 340 },
  bank: { hatchMs: 140, chipsMs: 520, settleMs: 160 },
  pot: { trayMs: 240, deckMs: 300 },
  resume: { seatSweepMs: 60 }
};

/* One short style readout per archetype. Personalities are already named
   on the seat plate (ROCK, SHARK...), so the tag says HOW they play, not
   who they are — the kind of note a machine would print on a tape. Two
   short lines, printed over the seat's own (still empty) action readout so
   it fits the narrowest 6-seat plate and never spills onto a neighbour. */
const TABLE_INTRO_TAGS = {
  rock: 'TIGHT\nQUIET',
  shark: 'SHARP\nSOLID',
  maniac: 'LOOSE\nWILD',
  station: 'CALLS\nLIGHT',
  grinder: 'STEADY\nPATIENT',
  wildcard: 'HARD TO\nREAD',
  professor: 'THINKS\nIT OVER',
  hammer: 'BETS\nHEAVY'
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

  function tableInfo(intro){
    const g = game;
    const seats = g.players.filter(p => !p.eliminated).length;
    const blinds = (g.smallBlind != null && g.bigBlind != null) ? g.smallBlind + '/' + g.bigBlind : '';
    const money = g.mode === 'career' || g.mode === 'career-cash';
    const blindText = blinds ? (money ? '$' + g.smallBlind + '/$' + g.bigBlind : 'BLINDS ' + blinds) : '';
    const join = parts => parts.filter(Boolean).join(' · ');
    const ev = g.event || null;
    // Two short lines under the title: what kind of game, then the stakes.
    const stakes = join([blindText, seats + ' SEATS']);
    let pre = '', title = intro.title || '', sub = [], prestige = false;
    if (g.mode === 'career-cash'){
      pre = (typeof CAREER_CASH_CONFIG !== 'undefined' && CAREER_CASH_CONFIG.venue) || 'BACK ROOM';
      title = title || 'CASH TABLE';
      sub = ['SEATS OPEN', stakes];
    } else if (g.mode === 'career' && ev){
      pre = ev.venue || '';
      title = title || (typeof careerEventTitle === 'function' ? careerEventTitle(ev) : ev.name) || 'EVENT';
      prestige = PRESTIGE_VENUES.includes(ev.venue);
      sub = [String(ev.format || '').toUpperCase(), stakes];
    } else if (g.mode === 'elimination' && g.run){
      pre = 'SINGLE PLAYER';
      title = title || 'TABLE ' + g.run.tableNumber;
      sub = ['ELIMINATION', stakes];
    } else {
      pre = g.mode === 'tournament' ? 'TOURNAMENT' : 'HOUSE GAME';
      title = title || 'TABLE';
      sub = [stakes];
    }
    if (intro.kind === 'resume'){
      pre = 'RESUMING';
      sub = ['HAND ' + ((g.handNumber || 0) + 1), stakes];
    }
    sub = sub.filter(Boolean);
    return { pre, title:String(title).toUpperCase(), sub, prestige };
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
    const fx = { marquee:null, tags:[] };
    try{
      await lights(run, wait, alive);
      if (alive()) await marquee(run, wait, alive, info, fx);
      if (alive()){
        if (quickSeats) await sweepSeats(run, wait, alive);
        else await rollCall(run, wait, alive, fx);
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

  /* 2. MARQUEE — types on, holds, docks into the top bar's table line. */
  async function marquee(run, wait, alive, info, fx){
    const felt = $('felt');
    if (!felt) return;
    const m = document.createElement('div');
    m.className = 'ti-marquee' + (info.prestige ? ' is-prestige' : '');
    m.setAttribute('aria-hidden','true');
    m.innerHTML =
      '<span class="ti-bulbs" aria-hidden="true"></span>' +
      (info.pre ? '<span class="ti-pre">' + esc(info.pre) + '</span>' : '') +
      '<span class="ti-title"></span>' +
      (info.sub.length ? '<span class="ti-sub">' + info.sub.map(line => '<span>' + esc(line) + '</span>').join('') + '</span>' : '');
    felt.appendChild(m);
    fx.marquee = m;
    const titleEl = m.querySelector('.ti-title');
    // Font size from the felt's real width, like careerTableCallout.
    const room = felt.clientWidth * .78;
    titleEl.style.fontSize = Math.max(13, Math.min(24, Math.floor(room / (info.title.length * 1.2)))) + 'px';
    titleEl.innerHTML = [...info.title].map(ch => '<i>' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</i>').join('');
    const letters = [...titleEl.children];
    m.getBoundingClientRect();
    m.classList.add('is-on');
    Sound.consoleShift();
    await wait(90);
    for (let i = 0; i < letters.length; i++){
      if (!alive()) return;
      letters[i].classList.add('on');
      if (info.title[i] !== ' ' && i % 2 === 0) Sound.counterTick(i === letters.length - 1);
      await wait(cfg.marquee.typeMs);
    }
    if (!alive()) return;
    m.classList.add('is-sub');
    Sound.counterLock(true);
    await wait(info.prestige ? cfg.marquee.prestigeHoldMs : cfg.marquee.holdMs);
    if (!alive()) return;
    // Dock: fly the strip into #table-meta (FLIP), where the title stays
    // until the first hand's own readout replaces it.
    const meta = $('table-meta');
    const from = m.getBoundingClientRect();
    const to = meta && meta.getBoundingClientRect();
    if (to && to.width !== undefined){
      const dx = (to.left + 30) - (from.left + from.width / 2);
      const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      m.style.setProperty('--ti-dx', dx + 'px');
      m.style.setProperty('--ti-dy', dy + 'px');
      m.style.setProperty('--ti-dock-ms', (cfg.marquee.dockMs / Math.max(.05, cfg.timeScale || 1)) + 'ms');
      m.classList.add('is-docking');
    }
    await wait(cfg.marquee.dockMs);
    dockTitle(info);
    m.remove();
    fx.marquee = null;
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
  async function rollCall(run, wait, alive, fx){
    for (const p of seatOrder()){
      if (!alive()) return;
      const e = seatEls[p.id];
      e.root.classList.remove('ti-unlit');
      if (p.eliminated){ e.root.classList.add('ti-lit-dead'); continue; }
      e.root.classList.add('ti-lit');
      // Stack reels first: they give the plate its final height, which the
      // tag below is measured against.
      if (e.chips) updateSeatReels(e.chips, p.chips);
      const key = p.personality && p.personality.key;
      const tagText = key && TABLE_INTRO_TAGS[key];
      if (tagText){
        const tag = document.createElement('span');
        tag.className = 'ti-tag';
        tag.setAttribute('aria-hidden','true');
        tag.textContent = tagText;
        // Laid over the action readout, measured against the seat itself
        // (already the positioned box) so no seat styling has to change.
        const slot = e.actionSlot || e.chips;
        if (slot){
          const r = slot.getBoundingClientRect(), base = e.root.getBoundingClientRect();
          tag.style.top = Math.round(r.top - base.top - 2) + 'px';
          tag.style.left = Math.round(r.left - base.left) + 'px';
          tag.style.width = Math.round(r.width) + 'px';
        }
        e.root.appendChild(tag);
        fx.tags.push(tag);
      }
      Sound.wheelTooth(.6, false);
      await wait(cfg.roll.seatMs);
    }
  }

  /* Cash and resume: the room is already live — every seat in one quick
     sweep, no tags. */
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

  /* 4. BANK — hatch opens, chips stack in, hatch shuts. */
  async function loadBank(run, wait, alive){
    const human = game.players.find(p => p.isHuman);
    const tower = $('hud-tower');
    if (!human || !tower) return;
    openHatch();
    Sound.hatchOpen();
    await wait(cfg.bank.hatchMs);
    resetPile(tower, bankPile());
    const n = visualChipCount(human.chips);
    updateJackpot(human.chips);
    const gap = n ? Math.max(9, Math.min(34, cfg.bank.chipsMs / n)) : 0;
    for (let i = 0; i < n; i++){
      if (!alive()) return;
      createRestingChip(tower, bankPile());
      if (i % 2 === 0 || i === n - 1) Sound.chipLand();
      await wait(gap);
    }
    await wait(cfg.bank.settleMs);
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
      const want = visualChipCount(human.chips);
      while ((tower._chipCount || 0) < want) createRestingChip(tower, bankPile());
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
    if (fx && fx.marquee) fx.marquee.remove();
    if (fx) fx.tags.forEach(tag => {
      tag.classList.add('is-out');
      window.setTimeout(() => tag.remove(), 260);
    });
    if (fx){ fx.marquee = null; fx.tags = []; }
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
      // shows it on the marquee instead of the old one-second flash.
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
    tags: TABLE_INTRO_TAGS,
    install, uninstall,
    get installed(){ return installed; },
    get playing(){ return !!playing; },
    hurry(){ if (playing){ playing.skipped = true; playing.wakers.forEach(w => w()); } }
  };
})();

TableIntro.install();
