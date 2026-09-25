"use strict";

/* ============================================================
   DASHBOARD 2.0 LAB

   A standalone prototype of the player's dashboard, so layouts can move
   freely and every interaction and big moment can be tried quickly before
   anything is wired into the real game.

   What is real: cards and chip art (css/02-screens.css), fonts and theme
   tokens (css/01-foundation.css), opponent faces (renderFace), the deck
   and hand evaluation (js/01-poker-math.js), and the game's own sounds
   (Sound in js/02-support-systems.js).
   What is the lab's: a small no-limit hold'em driver (blinds, betting
   rounds, side pots, showdown) and simple opponents, so the table keeps
   playing real hands. It is a test harness, not the game engine; the
   engine is untouched and gets wired to the chosen design later.

   Isolation: never writes localStorage. `settings` from 02 is changed in
   memory only (sound on/off) and saveSettings() is never called.
   ============================================================ */
(() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const screen = $('#screen');

  /* ------------------------------------------------------------
     Options
     ------------------------------------------------------------ */
  const opts = {
    dir:'console', size:'standard', theatre:'1.5', theme:'emerald', sound:'on', motion:'on',
    rig:'random', raise:'auto', allin:'auto', keys:'shutter', peek:'on', knock:'on', drag:'on', life:'on'
  };
  const DIR_NOTES = {
    tidy:'Today\'s layout, tidied and brought to life: lamps, gears, shutter, card tray, drawer.',
    console:'An instrument panel: hand gauge, big stack drum, a dial to size raises, a covered ALL-IN switch.',
    slot:'A fruit machine: pull the lever to bet, a paytable that lights your hand, a coin tray bank.',
    cockpit:'A flight deck: warning tiles, a throttle to size raises, twin gauges, a covered ALL-IN switch.'
  };
  const SIZES = { compact:{ h:262, note:'About today\'s height. The felt stays as big as it is now.' },
                  standard:{ h:316, note:'54px taller than today. Room for the instruments to breathe.' },
                  tall:{ h:372, note:'110px taller. The machine takes the bottom 40% of the screen.' } };
  function readHash(){
    const q = new URLSearchParams(location.hash.slice(1));
    Object.keys(opts).forEach(k => { const v = q.get(k); if (v) opts[k] = v; });
  }
  function writeHash(){
    const q = new URLSearchParams(opts);
    history.replaceState(null, '', '#' + q.toString());
  }

  const T = () => (reduced() ? 0.35 : Number(opts.theatre));      // theatre scale
  const reduced = () => opts.motion === 'off';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Inside a hand every pause checks for an abort, so a lab moment can
  // stop the hand in play cleanly at its next beat.
  class Abort extends Error{}
  const wait = async ms => { await sleep(ms * T()); if (g.abort) throw new Abort(); };

  /* ------------------------------------------------------------
     Sound: the game's own voices, plus a few lab-only ones
     ------------------------------------------------------------ */
  settings.sound = opts.sound === 'on';
  let xctx = null;
  function ax(){
    if (opts.sound !== 'on') return null;
    if (!xctx){ try{ xctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; } }
    if (xctx.state === 'suspended') xctx.resume();
    return xctx;
  }
  function tone(freq, dur, type, vol, when, glideTo){
    const c = ax(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function hiss(dur, vol, freq, type, when, sweepTo){
    const c = ax(); if (!c) return;
    const t = c.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq || 1200, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  }
  const SFX = {
    knock(){ hiss(0.06, 0.35, 260, 'lowpass'); tone(95, 0.09, 'sine', 0.25); },
    deny(){ tone(150, 0.12, 'square', 0.05); tone(110, 0.16, 'square', 0.05, 0.1); },
    relay(){ hiss(0.02, 0.12, 3200, 'highpass'); tone(1400, 0.02, 'square', 0.02); },
    shutter(){ for (let i = 0; i < 6; i++) hiss(0.025, 0.09, 1800 - i * 120, 'bandpass', i * 0.035); },
    siren(sec){ for (let i = 0; i < sec * 2.2; i++) tone(i % 2 ? 620 : 880, 0.42, 'square', 0.025, i * 0.45); },
    heart(){ tone(58, 0.12, 'sine', 0.5); tone(52, 0.14, 'sine', 0.38, 0.19); },
    bell(){ tone(1568, 0.9, 'triangle', 0.05); tone(2093, 0.7, 'sine', 0.03, 0.02); },
    spark(){ for (let i = 0; i < 5; i++) hiss(0.015 + Math.random() * 0.02, 0.2, 5000 + Math.random() * 3000, 'highpass', i * 0.03 + Math.random() * 0.03); },
    grind(){ hiss(1.2, 0.18, 700, 'bandpass', 0, 90); tone(90, 1.2, 'sawtooth', 0.03, 0, 30); },
    pop(){ hiss(0.05, 0.5, 900, 'lowpass'); tone(300, 0.08, 'square', 0.05, 0, 60); },
    clunk(){ hiss(0.05, 0.3, 400, 'lowpass'); tone(70, 0.12, 'sine', 0.3); },
    cover(){ hiss(0.03, 0.2, 2400, 'bandpass'); tone(520, 0.05, 'square', 0.03); },
    ratchet(){ hiss(0.015, 0.14, 2600, 'highpass'); },
    whirr(){ tone(180, 0.5, 'sawtooth', 0.015, 0, 420); hiss(0.5, 0.05, 900, 'bandpass', 0, 2200); }
  };
  let motor = null;
  function motorSpeed(v){
    if (opts.sound !== 'on' || opts.life !== 'on'){ if (motor){ motor.stop(); motor = null; } return; }
    if (!motor && v > 0) motor = Sound.wheelMotor();
    if (motor) motor.set(v);
    if (motor && v === 0){ const m = motor; setTimeout(() => { if (motor === m){ m.stop(); motor = null; } }, 400); }
  }
  document.addEventListener('pointerdown', () => { Sound.unlock(); ax(); }, { capture:true });

  /* ------------------------------------------------------------
     Poker driver
     ------------------------------------------------------------ */
  const SB = 10, BB = 20, START = 1000;
  const SEATS = [
    { id:'you', name:'YOU', human:true },
    { id:'o1', name:'SHARK', style:'tight' },
    { id:'o2', name:'MANIAC', style:'loose' },
    { id:'o3', name:'PROF', style:'calm' }
  ];
  const g = {
    players: SEATS.map((s, i) => Object.assign({ seat:i, stack:START, bet:0, total:0, folded:false, allIn:false, hand:[], mood:'idle', out:false }, s)),
    board:[], deck:[], dealer:3, currentBet:0, minRaise:BB, toAct:[], street:'idle',
    handNo:0, pot:0, running:false, broken:false, forced:null, script:null
  };
  if (typeof assignFaceColors === 'function') assignFaceColors(g.players.map(p => Object.assign(p, { isHuman:!!p.human })));
  const you = () => g.players[0];
  const live = () => g.players.filter(p => !p.folded && !p.out);
  const canAct = p => !p.folded && !p.allIn && !p.out;
  const toCall = p => Math.max(0, g.currentBet - p.bet);
  const potTotal = () => g.pot + g.players.reduce((s, p) => s + p.bet, 0);
  const nextSeat = i => { let j = i; do { j = (j + 1) % 4; } while (g.players[j].out); return j; };
  const minRaiseTo = () => g.currentBet === 0 ? BB : g.currentBet + g.minRaise;

  function draw(){ return g.forced && g.forced.length ? g.forced.shift() : g.deck.pop(); }
  function takeFromDeck(card){
    const k = cardKey(card);
    g.deck = g.deck.filter(c => cardKey(c) !== k);
    return g.deck.length ? card : card;
  }
  const C = s => { const r = s.slice(0, -1), su = { s:'♠', h:'♥', d:'♦', c:'♣' }[s.slice(-1)]; return { rank:r, suit:su, value:RANK_VALUES[r] }; };

  function commit(p, amount){
    const a = Math.min(amount, p.stack);
    p.stack -= a; p.bet += a; p.total += a;
    if (p.stack === 0) p.allIn = true;
    return a;
  }
  function apply(p, act, to){
    let label = '';
    if (act === 'fold'){ p.folded = true; label = 'FOLD'; }
    else if (act === 'check'){ label = 'CHECK'; }
    else if (act === 'call'){ const a = commit(p, toCall(p)); label = p.allIn ? 'ALL IN' : 'CALL ' + a; }
    else if (act === 'raise' || act === 'allin'){
      const target = act === 'allin' ? p.bet + p.stack : Math.min(to, p.bet + p.stack);
      const was = g.currentBet;
      commit(p, target - p.bet);
      if (p.bet > was){
        if (p.bet - was >= g.minRaise) g.minRaise = p.bet - was;
        g.currentBet = p.bet;
        g.toAct = orderFrom(p.seat).filter(q => q !== p && canAct(q));
      }
      label = p.allIn ? 'ALL IN' : (was === 0 ? 'BET ' : 'RAISE ') + p.bet;
    }
    g.toAct = g.toAct.filter(q => q !== p);
    return label;
  }
  function orderFrom(seat){ const out = []; let j = seat; for (let k = 0; k < 4; k++){ j = (j + 1) % 4; out.push(g.players[j]); } return out; }

  function strength(p){
    const h = p.hand; if (h.length < 2) return 0;
    if (!g.board.length){
      const [a, b] = h, hi = Math.max(a.value, b.value), lo = Math.min(a.value, b.value);
      if (a.value === b.value) return 0.35 + a.value / 14 * 0.3;
      return 0.04 + (hi + lo) / 28 * 0.34 + (a.suit === b.suit ? 0.04 : 0) + (hi - lo === 1 ? 0.03 : 0);
    }
    const cat = evaluate7([...h, ...g.board]).cat;
    const base = [0.12, 0.34, 0.5, 0.62, 0.7, 0.77, 0.86, 0.93, 0.97, 1][cat];
    const draws = detectDraws(h, g.board).filter(d => d.kind !== 'overcards').length;
    return Math.min(1, base + (cat < 2 ? draws * 0.08 : 0));
  }
  function aiDecide(p){
    const s = strength(p) + (Math.random() - 0.5) * 0.18 + (p.style === 'loose' ? 0.08 : p.style === 'tight' ? -0.05 : 0);
    const call = toCall(p), pot = potTotal();
    if (g.script && g.script.decide){ const d = g.script.decide(p, call); if (d) return d; }
    if (call === 0){
      if (s > 0.6 && Math.random() < 0.45) return { act:'raise', to:Math.max(BB, Math.round(pot * (0.5 + Math.random() * 0.3) / 10) * 10) };
      return { act:'check' };
    }
    const price = call / (pot + call);
    if (call >= p.stack) return s > 0.62 ? { act:'call' } : { act:'fold' };
    if (s < price * 1.1 && Math.random() > 0.12) return { act:'fold' };
    if (s > 0.82 && Math.random() < 0.3) return { act:'raise', to:Math.round(g.currentBet * 2.6 / 10) * 10 };
    return { act:'call' };
  }

  /* One hand, start to finish. */
  async function runHand(setup){
    if (g.running || g.broken) return;
    g.running = true;
    let next = false;
    try{ next = await playHand(setup); }
    catch(e){ if (!(e instanceof Abort)) console.error(e); }
    finally{ g.running = false; }
    if (next && !g.broken && !g.abort) setTimeout(() => runHand(), 0);
  }
  async function playHand(setup){
    g.handNo++;
    g.script = setup && setup.script || null;
    g.forced = setup && setup.board ? setup.board.slice() : null;
    g.players.forEach(p => { if (p.stack <= 0 && !p.human) p.stack = START; Object.assign(p, { bet:0, total:0, folded:false, allIn:false, hand:[], mood:'idle', out:false, reveal:false }); });
    g.board = []; g.pot = 0; g.currentBet = 0; g.minRaise = BB; g.street = 'preflop';
    g.dealer = setup && setup.dealer != null ? setup.dealer : nextSeat(g.dealer);
    g.deck = shuffle(createDeck());
    if (setup && setup.hands) setup.hands.forEach((h, i) => { if (h) g.players[i].hand = h.map(takeFromDeck); });
    if (g.forced) g.forced.forEach(takeFromDeck);
    const sbSeat = nextSeat(g.dealer), bbSeat = nextSeat(sbSeat);
    ui.peeked = opts.peek !== 'on';
    renderAll();
    await powerUp();
    await dealHoles();
    const sbP = g.players[sbSeat], bbP = g.players[bbSeat];
    commit(sbP, SB); commit(bbP, BB); g.currentBet = BB;
    sbP.say = 'SB'; bbP.say = 'BB';
    renderAll(); betChipsFly(sbP); betChipsFly(bbP);
    g.toAct = orderFrom(bbSeat).filter(canAct);
    const streets = ['preflop', 'flop', 'turn', 'river'];
    for (let si = 0; si < 4; si++){
      g.street = streets[si];
      if (si > 0){
        await collectBets();
        const n = si === 1 ? 3 : 1;
        await dealBoard(n);
        g.currentBet = 0; g.minRaise = BB;
        g.toAct = orderFrom(g.dealer).filter(canAct);
      }
      await bettingRound();
      if (live().length === 1) break;
    }
    await collectBets();
    if (live().length > 1){
      const outstanding = 5 - g.board.length;
      if (outstanding > 0){ await revealHands(); await runOut(outstanding); }
      await showdown();
    } else {
      const w = live()[0];
      await payout([{ amount:g.pot, winners:[w] }]);
    }
    g.street = 'done';
    if (you().stack <= 0){ await bust(); return false; }
    renderAll();
    setStatus('NEXT HAND…', 'info');
    await wait(1100);
    return true;
  }

  async function bettingRound(){
    while (g.toAct.length){
      if (live().length === 1) return;
      const actors = live().filter(canAct);
      if (actors.length === 0) return;
      if (actors.length === 1 && toCall(actors[0]) === 0 && live().length > 1){ g.toAct = []; return; }
      const p = g.toAct[0];
      if (!canAct(p)){ g.toAct.shift(); continue; }
      if (p.human){
        const d = await humanTurn();
        if (d.act === 'abort') throw new Abort();
        const label = apply(p, d.act, d.to);
        p.say = label;
        afterAction(p, d.act, label);
        if (d.act === 'allin' || (p.allIn && d.act !== 'fold')) await allInCeremony();
      } else {
        p.mood = 'think'; renderSeats();
        await wait(420 + Math.random() * 380);
        const d = aiDecide(p);
        const label = apply(p, d.act, d.to);
        p.say = label; p.mood = d.act === 'fold' ? 'sad' : (d.act === 'raise' ? 'smug' : 'idle');
        if (p.allIn){ p.mood = 'angry'; }
        afterAction(p, d.act, label);
        if (p.allIn && canAct(you()) && !you().folded) await facingAllIn(p);
      }
      renderAll();
    }
  }
  function afterAction(p, act, label){
    if (!p.human){
      if (act === 'fold') Sound.fold(); else if (act === 'check') Sound.check(); else Sound.chip();
    }
    if (p.bet > 0 && act !== 'fold' && act !== 'check') betChipsFly(p);
    renderAll();
  }

  async function collectBets(){
    const had = g.players.filter(p => p.bet > 0);
    if (!had.length) return;
    had.forEach(p => flyChips(betSpot(p), potSpot(), Math.min(6, 1 + Math.floor(p.bet / 40)), { stagger:30 }));
    await wait(380);
    g.players.forEach(p => { g.pot += p.bet; p.bet = 0; p.say = p.folded ? 'FOLD' : (p.allIn ? 'ALL IN' : ''); });
    renderAll();
  }
  async function dealBoard(n){
    setGears('busy');
    for (let i = 0; i < n; i++){
      const c = draw(); g.board.push(c);
      renderBoard(true);
      Sound.cardDeal();
      await wait(n === 3 ? 170 : 240);
      Sound.cardFlip(false);
    }
    setGears('idle');
    updateHand();
    await wait(260);
  }
  async function revealHands(){
    live().forEach(p => { if (!p.human) p.reveal = true; });
    renderSeats(); Sound.cardFlip(true);
    ui.peeked = true; renderHole();
    await wait(700);
  }
  /* All-in run-out: one card at a time, with the heartbeat. */
  async function runOut(n){
    screen.classList.add('suspense');
    for (let i = 0; i < n; i++){
      const beats = 2 + Math.round(T());
      for (let b = 0; b < beats; b++){ SFX.heart(); pulseDash(); await wait(430); }
      const c = draw(); g.board.push(c);
      renderBoard(true, true);
      Sound.cardFlip(true);
      updateHand();
      await wait(650);
    }
    screen.classList.remove('suspense');
  }
  function buildPots(){
    const contrib = g.players.map(p => ({ p, amt:p.total }));
    const pots = [];
    while (contrib.some(c => c.amt > 0)){
      const m = Math.min(...contrib.filter(c => c.amt > 0).map(c => c.amt));
      let amount = 0; const elig = [];
      contrib.forEach(c => { if (c.amt > 0){ amount += m; c.amt -= m; if (!c.p.folded) elig.push(c.p); } });
      const last = pots[pots.length - 1];
      if (last && last.elig.length === elig.length && last.elig.every(x => elig.includes(x))) last.amount += amount;
      else pots.push({ amount, elig });
    }
    return pots;
  }
  async function showdown(){
    live().forEach(p => { if (!p.human) p.reveal = true; });
    ui.peeked = true; renderAll();
    await wait(500);
    const pots = buildPots().map(pt => {
      let best = null, winners = [];
      pt.elig.forEach(p => {
        const r = evaluate7([...p.hand, ...g.board]);
        const cmp = best ? compareHands(r, best) : 1;
        if (cmp > 0){ best = r; winners = [p]; } else if (cmp === 0) winners.push(p);
      });
      return { amount:pt.amount, winners, best };
    });
    // Pots were collected into g.pot already; payout splits the same total.
    await payout(pots);
  }
  async function payout(pots){
    const mine = pots.reduce((s, pt) => s + (pt.winners.includes(you()) ? Math.floor(pt.amount / pt.winners.length) : 0), 0);
    const total = pots.reduce((s, pt) => s + pt.amount, 0);
    pots.forEach(pt => {
      const share = Math.floor(pt.amount / pt.winners.length);
      let rem = pt.amount - share * pt.winners.length;
      pt.winners.forEach(w => { w.stack += share + (rem-- > 0 ? 1 : 0); });
    });
    g.pot = 0;
    g.players.forEach(p => { p.total = 0; });
    g.players.forEach(p => { if (!p.human) p.mood = pots.some(pt => pt.winners.includes(p)) ? 'happy' : (p.folded ? p.mood : 'sad'); });
    const hand = pots[0] && pots[0].best ? describeMade(pots[0].best) : '';
    if (mine > 0) await winCeremony(mine, total, hand);
    else {
      const w = pots[0].winners[0];
      pots.forEach(pt => pt.winners.forEach(wn => flyChips(potSpot(), seatSpot(wn), 6, { stagger:40 })));
      clearAlarms();
      setStatus(w.name + ' WINS<br><b>$' + total + '</b>', 'info');
      Sound.resultSting(you().folded ? 'neutral' : 'humanLose');
      renderAll();
      await wait(1100);
    }
    renderAll();
  }

  /* ------------------------------------------------------------
     The human's turn
     ------------------------------------------------------------ */
  const ui = { resolve:null, raiseTo:0, sizing:false, pending:0, podOpen:false, peeked:false, coverOpen:false, pausedByMoment:false };
  function humanTurn(){
    return new Promise(resolve => {
      ui.resolve = d => { ui.resolve = null; setTurn(false); closePod(); ui.pending = 0; ui.sizing = false; renderPending(); resolve(d); };
      ui.raiseTo = Math.min(minRaiseTo(), you().bet + you().stack);
      ui.sizing = false;
      setTurn(true);
      if (ui.autoAllIn){ const fn = ui.autoAllIn; ui.autoAllIn = null; setTimeout(fn, 700 * T()); }
    });
  }
  function act(kind, to){
    if (!ui.resolve) return;
    const p = you(), call = toCall(p);
    if (kind === 'check' && call > 0) kind = 'call';
    if (kind === 'raise' && to >= p.bet + p.stack) kind = 'allin';
    if (kind === 'call' && call >= p.stack) kind = 'allin';
    if (kind === 'fold'){ foldIntoMachine(); }
    ui.resolve({ act:kind, to });
  }

  /* ------------------------------------------------------------
     Rendering: phone screen
     ------------------------------------------------------------ */
  function cardHTML(c, faceDown, extra){
    if (faceDown || !c) return '<div class="card back ' + (extra || '') + '"></div>';
    return '<div class="card ' + SUIT_CLASS[c.suit] + ' ' + (extra || '') + '"><div class="ci"><span class="r">' + c.rank +
      '</span><span class="s">' + c.suit + '</span></div><div class="pip">' + c.suit + '</div></div>';
  }
  function buildScreen(){
    screen.innerHTML =
      '<div class="ph-status"><span>9:41</span><i class="ph-island"></i><span>▮▮▮ ◔</span></div>' +
      '<div class="ph-top"><div><b>POKER FACES</b><small id="ph-meta">Hand 1 · 10/20</small></div>' +
        '<div class="ph-keys"><span>SAVE</span><span>⚙</span></div></div>' +
      '<div class="lb-felt-area"><div class="lb-felt" id="lb-felt">' +
        '<div class="lb-seats" id="lb-seats"></div>' +
        '<div class="lb-pot" id="lb-pot"><span>POT</span><b id="lb-pot-val">0</b></div>' +
        '<div class="lb-board" id="lb-board"></div>' +
        '<div class="lb-my-bet" id="lb-my-bet"><div class="lb-stack-slot" id="lb-my-bet-chips"></div><b id="lb-my-bet-val"></b></div>' +
        '<div class="lb-pending" id="lb-pending"><div class="lb-stack-slot" id="lb-pending-chips"></div><b id="lb-pending-val"></b><small>TAP TO TAKE BACK</small></div>' +
        '<div class="lb-stamp" id="lb-stamp"></div>' +
      '</div></div>' +
      '<div class="dash-wrap"><div class="dash" id="dash"></div></div>' +
      '<div class="ph-home"></div>' +
      '<div class="fx" id="fx"></div>';
    $('#lb-pending').addEventListener('click', () => { if (ui.pending){ flyChips(pendingSpot(), bankSpot(), 3); ui.pending = 0; renderPending(); updateKeys(); SFX.ratchet(); } });
  }
  function renderSeats(){
    const host = $('#lb-seats');
    host.innerHTML = g.players.slice(1).map(p => {
      const showCards = p.reveal && !p.folded;
      return '<div class="lb-seat' + (p.folded ? ' folded' : '') + (g.toAct[0] === p && g.running ? ' acting' : '') + '" data-seat="' + p.seat + '">' +
        '<div class="lb-seat-name">' + p.name + (g.dealer === p.seat ? '<i class="lb-dbtn">D</i>' : '') + '</div>' +
        '<div class="lb-avatar">' + renderFace(p, p.folded ? 'sad' : p.mood) + '</div>' +
        '<div class="lb-seat-stack">$' + p.stack + '</div>' +
        '<div class="lb-seat-cards">' + (p.hand.length && !p.folded ? cardHTML(p.hand[0], !showCards, 'small') + cardHTML(p.hand[1], !showCards, 'small') : '') + '</div>' +
        '<div class="lb-seat-say">' + (p.say || '') + '</div>' +
        '<div class="lb-seat-bet">' + (p.bet ? '<i class="chip-disc d-red v-1"></i><b>' + p.bet + '</b>' : '') + '</div>' +
      '</div>';
    }).join('');
  }
  function renderBoard(animLast, big){
    const b = $('#lb-board');
    const html = [];
    for (let i = 0; i < 5; i++){
      const c = g.board[i];
      html.push(c ? cardHTML(c, false, (animLast && i === g.board.length - 1 ? 'deal-in' + (big ? ' big-reveal' : '') : '')) : '<div class="lb-card-slot"></div>');
    }
    b.innerHTML = html.join('');
  }
  function renderPot(){
    $('#lb-pot-val').textContent = potTotal();
    $('#lb-pot').classList.toggle('empty', potTotal() === 0);
    const p = you();
    $('#lb-my-bet').classList.toggle('show', p.bet > 0);
    $('#lb-my-bet-val').textContent = p.bet || '';
    $('#lb-my-bet-chips').innerHTML = p.bet ? chipPile(p.bet, 5) : '';
    $('#ph-meta').textContent = 'Hand ' + Math.max(1, g.handNo) + ' · ' + SB + '/' + BB + ' · ' + g.street.toUpperCase();
  }
  function chipPile(amount, max){
    const n = Math.max(1, Math.min(max, Math.ceil(amount / 40)));
    const colours = ['d-red', 'd-blue', 'd-black', 'd-green', 'd-white', 'd-purple'];
    let s = '';
    for (let i = 0; i < n; i++) s += '<i class="chip-disc ' + colours[i % colours.length] + ' v-' + (1 + i % 3) + '"></i>';
    return s;
  }
  function renderAll(){ renderSeats(); renderBoard(false); renderPot(); renderDash(); }

  /* ------------------------------------------------------------
     Dashboards: four directions from shared parts
     ------------------------------------------------------------ */
  const part = {
    tray:() => '<div class="p-tray" data-r="tray"><div class="tray-well"><div class="hole" data-r="hole"></div></div><div class="tray-lip"><i></i></div></div>',
    crt:(r, ink, cls) => '<div class="crt ' + (cls || '') + '" data-r="' + r + '" data-ink="' + ink + '"><span></span></div>',
    drum:(label, cls) => '<div class="p-drum ' + (cls || '') + '" data-r="drum"><span class="plate">' + label + '</span><div class="reels" data-r="reels"></div><i class="drum-jam"></i></div>',
    bank:(cls) => '<div class="p-bank ' + (cls || '') + '" data-r="bank"><span class="plate">BANK</span><div class="towers" data-r="towers"></div><i class="bank-glass"></i></div>',
    lamps:(list) => '<div class="p-lamps">' + list.map(l => '<span class="lamp" data-r="lamp-' + l + '"><i></i>' + l.toUpperCase() + '</span>').join('') + '</div>',
    gauge:(label, r) => '<div class="p-gauge" data-r="' + (r || 'gauge') + '"><svg viewBox="0 0 100 62" aria-hidden="true">' +
      '<path class="g-arc" d="M10 54 A40 40 0 0 1 90 54"/>' + gaugeTicks() +
      '<path class="g-hot" d="M78 26 A40 40 0 0 1 90 54"/>' +
      '<g class="g-needle"><g class="g-jitter"><rect x="49" y="18" width="2" height="36"/></g></g><rect class="g-hub" x="46" y="50" width="8" height="8"/></svg>' +
      '<span class="g-label">' + label + '</span><span class="g-read" data-r="' + (r || 'gauge') + '-read">—</span></div>',
    gears:(n) => '<div class="p-gears">' + Array.from({ length:n || 3 }, (_, i) => gearSVG(i)).join('') + '<i class="gears-glass"></i></div>',
    keys:() => '<div class="p-keys" data-r="keys"><div class="key-row">' +
      '<button type="button" class="key k-fold" data-act="fold"><span>FOLD</span></button>' +
      '<button type="button" class="key k-call" data-act="call"><span>CHECK</span></button>' +
      '<button type="button" class="key k-raise" data-act="raise"><span>RAISE</span></button></div>' +
      '<div class="shutter" data-r="shutter"><span>WAITING</span></div>' +
      '<button type="button" class="key k-rebuy" data-act="rebuild"><span>REBUILD THE MACHINE</span></button></div>',
    cover:() => '<div class="p-cover" data-r="cover"><span class="plate">ALL IN</span><div class="cover-well">' +
      '<button type="button" class="cover-btn" data-act="allin-press">PUSH</button>' +
      '<button type="button" class="cover-flap" data-act="cover" aria-label="Lift the all-in cover"><i></i></button></div></div>',
    lever:() => '<div class="p-lever" data-r="lever"><div class="lever-scale"><i data-at="min">MIN</i><i data-at="half">½</i><i data-at="pot">POT</i><i data-at="max">ALL</i></div>' +
      '<div class="lever-slot"></div><div class="lever-arm" data-r="lever-arm"><div class="lever-rod"></div><div class="lever-knob"></div></div>' +
      '<div class="lever-read" data-r="lever-read">PULL</div></div>',
    paytable:() => '<div class="p-pay" data-r="pay">' + [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(c =>
      '<span data-cat="' + c + '">' + ['HIGH CARD', 'PAIR', 'TWO PAIR', 'TRIPS', 'STRAIGHT', 'FLUSH', 'FULL HOUSE', 'QUADS', 'STR FLUSH', 'ROYAL'][c] + '</span>').join('') + '</div>',
    ann:() => '<div class="p-ann" data-r="ann">' + [['turn', 'YOUR TURN'], ['call', 'TO CALL'], ['draw', 'DRAWING'], ['dealer', 'DEALER'], ['blind', 'BLIND'], ['short', 'SHORT STACK'], ['allin', 'ALL IN'], ['made', 'MADE HAND']]
      .map(a => '<span class="tile" data-tile="' + a[0] + '">' + a[1] + '</span>').join('') + '</div>',
    throttle:() => '<div class="p-throttle" data-r="throttle"><span class="plate">RAISE</span><div class="thr-track"><i data-at="max">ALL</i><i data-at="pot">POT</i><i data-at="half">½</i><i data-at="min">MIN</i>' +
      '<div class="thr-handle" data-r="thr-handle"></div></div><div class="thr-read" data-r="thr-read">—</div></div>',
    dial:() => '<div class="p-dial" data-r="dial"><span class="plate">RAISE</span><div class="dial-face"><i class="dt dt-min">MIN</i><i class="dt dt-half">½</i><i class="dt dt-pot">POT</i><i class="dt dt-max">ALL</i>' +
      '<div class="dial-knob" data-r="dial-knob"><i></i></div></div><div class="dial-read" data-r="dial-read">—</div></div>',
    marquee:() => '<div class="p-marquee" data-r="marquee"><span data-r="marquee-text">POKER FACES</span></div>',
    beacons:() => '<i class="beacon b-l"></i><i class="beacon b-r"></i>',
    chase:() => '<div class="chase" data-r="chase"></div>',
    pod:() => '<div class="p-pod" data-r="pod"></div>',
    cracks:() => '<svg class="cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M8 0 L14 18 L10 30 L19 44 L15 58"/><path d="M70 100 L74 84 L68 72 L77 60 L73 50 L82 40"/><path d="M100 22 L88 28 L90 36 L80 42"/></svg><div class="smoke" data-r="smoke"></div>'
  };
  function gaugeTicks(){
    let s = '';
    for (let i = 0; i <= 10; i++){
      const a = Math.PI * (1 - i / 10), x1 = 50 + Math.cos(a) * 40, y1 = 54 - Math.sin(a) * 40, x2 = 50 + Math.cos(a) * (i % 5 ? 34 : 30), y2 = 54 - Math.sin(a) * (i % 5 ? 34 : 30);
      s += '<line class="g-tick" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    return s;
  }
  function gearSVG(i){
    const teeth = [10, 8, 12][i % 3], r = 13, R = 17;
    let pts = '';
    for (let t = 0; t < teeth * 2; t++){
      const a = t / (teeth * 2) * Math.PI * 2, rr = t % 2 ? r : R;
      pts += (20 + Math.cos(a) * rr).toFixed(1) + ',' + (20 + Math.sin(a) * rr).toFixed(1) + ' ';
    }
    return '<svg class="gear gear-' + i + '" viewBox="0 0 40 40" shape-rendering="crispEdges" aria-hidden="true"><polygon points="' + pts + '"/><rect x="16" y="16" width="8" height="8"/><rect class="gear-mark" x="19" y="5" width="2" height="6"/></svg>';
  }

  const LAYOUTS = {
    tidy:() =>
      part.beacons() + part.chase() +
      '<div class="d-body">' +
        '<div class="a-bank">' + part.bank() + '</div>' +
        '<div class="a-mid">' + part.tray() + part.crt('hand', 'live', 'crt-hand') + part.crt('status', 'live', 'crt-status') + part.drum('STACK') + '</div>' +
        '<div class="a-side">' + part.lamps(['d', 'sb', 'bb']) + '<div class="bet-box"><span class="plate">BET THIS HAND</span>' + part.crt('bet', 'money', 'crt-bet') + '</div>' + part.gears(2) + part.lamps(['short']) + '</div>' +
      '</div>' + part.keys() + part.pod() + part.cracks(),
    console:() =>
      part.beacons() + part.chase() +
      '<div class="d-body">' +
        '<div class="a-left">' + part.gauge('HAND') + part.lamps(['d', 'sb', 'bb', 'short']) + part.gears(3) + '</div>' +
        '<div class="a-mid">' + part.tray() + part.crt('hand', 'live', 'crt-hand') + part.crt('status', 'live', 'crt-status') + '</div>' +
        '<div class="a-right">' + part.bank() + part.dial() + '</div>' +
        '<div class="a-drum">' + part.drum('STACK', 'drum-wide') + '<div class="bet-box"><span class="plate">IN</span>' + part.crt('bet', 'money', 'crt-bet') + '</div></div>' +
      '</div>' +
      '<div class="d-foot">' + part.keys() + part.cover() + '</div>' + part.pod() + part.cracks(),
    slot:() =>
      part.beacons() + part.chase() +
      '<div class="d-body">' +
        '<div class="a-main">' + part.marquee() +
          '<div class="slot-mid">' + part.paytable() + '<div class="payline">' + part.tray() + part.crt('hand', 'live', 'crt-hand') + '</div></div>' +
          '<div class="slot-row">' + part.drum('CREDITS', 'drum-wide') + '<div class="bet-box"><span class="plate">BET</span>' + part.crt('bet', 'money', 'crt-bet') + '</div></div>' +
          part.crt('status', 'live', 'crt-status') +
        '</div>' +
        '<div class="a-lever">' + part.lever() + '</div>' +
      '</div>' +
      '<div class="d-foot">' + part.keys() + '</div>' +
      '<div class="d-tray">' + part.bank('coin-tray') + '</div>' + part.pod() + part.cracks(),
    cockpit:() =>
      part.beacons() + part.chase() +
      '<div class="d-body">' +
        '<div class="a-ann">' + part.ann() + '</div>' +
        '<div class="a-thr">' + part.throttle() + '</div>' +
        '<div class="a-mid">' + part.tray() + part.crt('hand', 'live', 'crt-hand') + '</div>' +
        '<div class="a-right">' + part.gauge('HAND') + part.gauge('RISK', 'risk') + '</div>' +
        '<div class="a-drum">' + part.drum('STACK', 'drum-wide') + part.crt('status', 'live', 'crt-status') + part.bank('fuel') + '</div>' +
      '</div>' +
      '<div class="d-foot">' + part.keys() + part.cover() + '</div>' + part.pod() + part.cracks()
  };
  const dash = () => $('#dash');
  const R = r => dash().querySelector('[data-r="' + r + '"]');

  function raiseMode(){
    if (opts.raise !== 'auto') return opts.raise;
    return { tidy:'slider', console:'dial', slot:'lever', cockpit:'throttle' }[opts.dir];
  }
  function allinMode(){
    if (opts.allin !== 'auto') return opts.allin;
    return { tidy:'hold', console:'cover', slot:'hold', cockpit:'cover' }[opts.dir];
  }
  // Where the raise control lives: the direction's own fixture, or the drawer.
  const fixtureFor = { console:'dial', slot:'lever', cockpit:'throttle' };
  const usesPod = () => fixtureFor[opts.dir] !== raiseMode();

  function buildDash(){
    const d = dash();
    d.className = 'dash dir-' + opts.dir;
    d.dataset.keys = opts.keys;
    d.dataset.allin = allinMode();
    d.dataset.raise = raiseMode();
    d.dataset.pod = usesPod() ? 'on' : 'off';
    screen.dataset.size = opts.size;
    screen.style.setProperty('--dash-h', SIZES[opts.size].h + 'px');
    d.innerHTML = LAYOUTS[opts.dir]();
    buildReels();
    buildChase();
    buildPod();
    wireDash();
    renderDash();
    setTurn(!!ui.resolve, true);
  }

  /* Stack drum: one strip of 0-9 per digit, rolled through every value. */
  const DIGITS = 6;
  function buildReels(){
    const el = R('reels'); if (!el) return;
    el.innerHTML = '<i class="reel reel-sym">$</i>' + Array.from({ length:DIGITS }, () => '<i class="reel"><b>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => '<em>' + n + '</em>').join('') + '</b></i>').join('');
    setReels(drumShown, true);
  }
  let drumShown = START, drumTarget = START, drumRAF = 0;
  function setReels(v, instant){
    const el = R('reels'); if (!el) return;
    const s = String(Math.max(0, Math.round(v))).padStart(DIGITS, '0');
    const lead = s.search(/[1-9]/);
    $$('.reel:not(.reel-sym) b', el).forEach((b, i) => {
      const dgt = Number(s[i]);
      b.style.transition = instant ? 'none' : '';
      b.style.transform = 'translateY(' + (-dgt * 10) + '%)';
      b.parentNode.classList.toggle('dim', lead === -1 ? i < DIGITS - 1 : i < lead);
    });
  }
  function rollDrum(to, ms){
    drumTarget = to;
    cancelAnimationFrame(drumRAF);
    const from = drumShown, t0 = performance.now(), dur = (ms || 700) * (reduced() ? 0.2 : 1);
    let lastTick = 0;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = k < 1 ? 1 - Math.pow(1 - k, 3) : 1;
      drumShown = Math.round(from + (to - from) * e);
      setReels(drumShown);
      if (now - lastTick > 55 && k < 1){ lastTick = now; Sound.counterTick(true); }
      if (k < 1) drumRAF = requestAnimationFrame(step);
      else { Sound.counterLock(true); }
    };
    drumRAF = requestAnimationFrame(step);
  }

  function buildChase(){
    const el = R('chase'); if (!el) return;
    const n = 34;
    el.innerHTML = Array.from({ length:n }, (_, i) => '<i style="--i:' + i + ';--p:' + (i / n) + '"></i>').join('');
    // Lay the lamps around the perimeter of the dashboard.
    requestAnimationFrame(() => {
      const w = el.clientWidth, h = el.clientHeight, per = 2 * (w + h);
      $$('i', el).forEach((lamp, i) => {
        let d = i / n * per, x, y;
        if (d < w){ x = d; y = 0; } else if ((d -= w) < h){ x = w; y = d; } else if ((d -= h) < w){ x = w - d; y = h; } else { d -= w; x = 0; y = h - d; }
        lamp.style.left = x + 'px'; lamp.style.top = y + 'px';
      });
    });
  }

  function renderDash(){
    if (!dash().firstChild) return;
    const p = you();
    // Bank towers
    const towers = R('towers');
    if (towers){
      // Three towers, heights by stack; each tower is also a chip size to
      // drag onto the felt (1 BB, 5 BB, 25 BB).
      const units = [{ c:'d-white', v:BB, k:100 }, { c:'d-red', v:BB * 5, k:200 }, { c:'d-black', v:BB * 25, k:250 }];
      const cap = opts.dir === 'slot' ? 7 : opts.dir === 'cockpit' ? 5 : 12;
      towers.innerHTML = units.map((u, i) => '<div class="tower' + (p.stack < u.v ? ' empty' : '') + '" data-den="' + u.v + '" title="' + u.v + '">' +
        Array.from({ length:Math.min(cap, Math.max(p.stack >= u.v ? 1 : 0, Math.round(p.stack / u.k))) }, (_, k) => '<i class="chip-disc ' + u.c + ' v-' + (1 + (k + i) % 3) + '"></i>').join('') +
        '<b>' + u.v + '</b></div>').join('');
    }
    if (drumTarget !== p.stack && !ui.holdDrum) rollDrum(p.stack, 600);
    // Bet this hand
    crt('bet', '$' + String(p.total).padStart(3, '0'));
    // Lamps
    const sbSeat = nextSeat(g.dealer), bbSeat = nextSeat(sbSeat);
    lamp('d', g.dealer === 0); lamp('sb', sbSeat === 0 && g.running); lamp('bb', bbSeat === 0 && g.running);
    lamp('short', p.stack > 0 && p.stack < BB * 10, true);
    updateHand();
    updateAnn();
    renderHole();
    updateKeys();
  }
  function lamp(k, on, warn){
    const el = R('lamp-' + k); if (!el) return;
    el.classList.toggle('on', !!on); el.classList.toggle('warn', !!(on && warn));
  }
  function crt(r, text, ink){
    const el = R(r); if (!el) return;
    const span = el.firstChild;
    if (span.innerHTML !== text){ span.innerHTML = text; el.classList.remove('blink'); void el.offsetWidth; el.classList.add('blink'); }
    if (ink) el.dataset.ink = ink;
  }
  let statusText = '', statusInk = 'live';
  function setStatus(text, ink){ statusText = text; statusInk = ink || 'live'; crt('status', text, statusInk); const m = R('marquee-text'); if (m) m.textContent = text.replace(/<[^>]+>/g, ' ') || 'POKER FACES'; }

  function handInfo(){
    const p = you();
    if (p.hand.length < 2) return { name:'', cat:-1, v:0 };
    if (!ui.peeked) return { name:'HOLD TO PEEK', cat:-1, v:0, hidden:true };
    const name = describePlayerHand(p.hand, g.board);
    const cat = g.board.length ? evaluate7([...p.hand, ...g.board]).cat : (p.hand[0].value === p.hand[1].value ? 1 : 0);
    return { name, cat, v:strength(p), draws:g.board.length ? detectDraws(p.hand, g.board).filter(d => d.kind !== 'overcards') : [] };
  }
  let lastCat = -1;
  function updateHand(){
    const h = handInfo();
    crt('hand', h.name ? h.name.toUpperCase() : '—', h.cat >= 2 ? 'money' : 'live');
    setGauge('gauge', h.v, h.hidden ? '???' : (h.cat >= 0 ? ['HIGH', 'PAIR', '2 PAIR', 'TRIPS', 'STRT', 'FLUSH', 'FULL', 'QUADS', 'SF', 'ROYAL'][h.cat] : '—'));
    const call = toCall(you()), risk = you().stack ? Math.min(1, (call + you().bet) / (you().stack + you().bet)) : 0;
    setGauge('risk', risk, call ? Math.round(risk * 100) + '%' : '0%');
    const pay = R('pay');
    if (pay) $$('span', pay).forEach(s => s.classList.toggle('lit', Number(s.dataset.cat) === (h.hidden ? -9 : Math.max(h.cat, g.board.length ? h.cat : -9))));
    if (h.cat >= 2 && h.cat > lastCat && g.board.length){ madeHandFlash(h.cat); }
    lastCat = h.cat;
  }
  function setGauge(r, v, read){
    const el = R(r); if (!el) return;
    const needle = $('.g-needle', el);
    needle.style.transform = 'rotate(' + (-80 + v * 160).toFixed(1) + 'deg)';
    el.classList.toggle('hot', v > 0.8);
    const rd = R(r + '-read'); if (rd) rd.textContent = read;
  }
  function madeHandFlash(cat){
    const d = dash();
    d.classList.remove('made'); void d.offsetWidth; d.classList.add('made');
    if (cat >= 4){ SFX.bell(); kick(2); }
    setTimeout(() => d.classList.remove('made'), 1400);
  }
  function updateAnn(){
    const a = R('ann'); if (!a) return;
    const p = you(), h = handInfo();
    const set = (k, on, cls) => { const t = $('[data-tile="' + k + '"]', a); t.classList.toggle('on', !!on); t.dataset.tone = cls || ''; };
    set('turn', !!ui.resolve, 'go');
    set('call', !!ui.resolve && toCall(p) > 0, 'warn');
    set('draw', h.draws && h.draws.length, 'info');
    set('dealer', g.dealer === 0, 'info');
    const sbSeat = nextSeat(g.dealer), bbSeat = nextSeat(sbSeat);
    set('blind', g.running && (sbSeat === 0 || bbSeat === 0), 'info');
    set('short', p.stack > 0 && p.stack < BB * 10, 'warn');
    set('allin', p.allIn || g.players.some(q => q.allIn && !q.folded), 'danger');
    set('made', h.cat >= 2 && g.board.length, 'go');
  }

  /* Hole cards: rise out of the tray; peek by pressing and holding. */
  function renderHole(){
    const hole = R('hole'); if (!hole) return;
    const p = you();
    const want = p.hand.length && !p.folded ? p.hand.map(c => cardKey(c)).join() + (ui.peeked ? 'u' : 'd') : '';
    if (hole.dataset.key === want) return;
    const rising = hole.dataset.rise === '1';
    hole.dataset.key = want;
    hole.innerHTML = p.hand.length && !p.folded ? p.hand.map((c, i) => cardHTML(c, !ui.peeked, 'hole-card hc-' + i + (rising ? ' rise' : ''))).join('') : '';
    hole.dataset.rise = '';
  }
  async function dealHoles(){
    setGears('busy');
    const hole = R('hole');
    g.players.forEach(p => { if (!p.hand.length) p.hand = [draw(), draw()]; });
    if (hole){ hole.dataset.rise = '1'; hole.dataset.key = ''; }
    renderSeats();
    renderHole();
    Sound.cardDeal(); await wait(160); Sound.cardDeal();
    await wait(380);
    Sound.cardLanded();
    if (!ui.peeked){ R('tray') && R('tray').classList.add('peekable'); }
    setGears('idle');
    updateHand();
  }

  /* ------------------------------------------------------------
     Machine life: power-up, gears, turn wake, pulses
     ------------------------------------------------------------ */
  function setGears(state){
    const d = dash(); if (!d) return;
    d.dataset.gears = opts.life === 'on' ? state : 'still';
    motorSpeed(state === 'busy' ? 0.35 : state === 'fast' ? 0.8 : 0);
    if (state === 'busy' && opts.life === 'on') SFX.whirr();
  }
  async function powerUp(){
    const d = dash();
    d.classList.remove('powered'); d.classList.add('powering');
    SFX.relay();
    await sleep(reduced() ? 0 : 140); SFX.relay();
    d.classList.add('powered');
    await sleep(reduced() ? 0 : 320);
    d.classList.remove('powering');
  }
  function setTurn(on, silent){
    const d = dash(); if (!d) return;
    const was = d.dataset.turn === 'on';
    d.dataset.turn = on ? 'on' : 'off';
    if (on){
      const call = toCall(you());
      setStatus(call ? 'YOUR TURN<br><b>' + call + ' TO CALL</b>' : 'YOUR TURN<br><b>CHECK OR BET</b>', 'live');
      if (!was && !silent){ opts.keys === 'shutter' ? SFX.shutter() : Sound.consoleShift(); }
    } else if (g.running && !g.broken){
      const actor = g.toAct[0];
      setStatus(actor && !actor.human ? actor.name + '<br>IS THINKING' : 'DEALING…', 'info');
      if (was && !silent) opts.keys === 'shutter' ? SFX.shutter() : Sound.consoleShift();
    }
    updateKeys(); updateAnn();
  }
  function updateKeys(){
    const d = dash(); if (!d || !d.firstChild) return;
    const p = you(), call = toCall(p);
    const kc = $('.k-call span', d), kr = $('.k-raise span', d), kf = $('.k-fold', d);
    if (!kc) return;
    kc.textContent = call === 0 ? 'CHECK' : call >= p.stack ? 'CALL ALL-IN' : 'CALL ' + call;
    $('.k-call', d).classList.toggle('danger-print', call >= p.stack && call > 0);
    const target = p.bet + ui.pending;
    if (ui.pending){
      const minTo = minRaiseTo();
      if (target >= p.bet + p.stack) kr.textContent = 'PUSH ALL IN';
      else if (target === g.currentBet) kr.textContent = 'PUSH · CALL';
      else if (target < g.currentBet) kr.textContent = 'ADD ' + (g.currentBet - target);
      else if (target < minTo) kr.textContent = 'MIN ' + minTo;
      else kr.textContent = 'PUSH ' + target;
    } else if (ui.sizing || ui.podOpen){
      kr.textContent = (ui.raiseTo >= p.bet + p.stack ? 'ALL IN ' : (g.currentBet ? 'RAISE ' : 'BET ')) + ui.raiseTo;
    } else kr.textContent = g.currentBet ? 'RAISE' : 'BET';
    kf.disabled = false;
    d.classList.toggle('sizing', !!(ui.sizing || ui.podOpen || ui.pending));
  }
  function pulseDash(){ const d = dash(); d.classList.remove('pulse'); void d.offsetWidth; d.classList.add('pulse'); }
  function kick(n){ const d = dash(); d.classList.remove('kick' + n); void d.offsetWidth; d.classList.add('kick' + n); setTimeout(() => d.classList.remove('kick' + n), 600); }

  /* ------------------------------------------------------------
     Chips in flight
     ------------------------------------------------------------ */
  // The phone is zoomed to fit the window; convert page pixels back to
  // the screen's own 430 x 932 coordinates.
  const zoomK = () => screen.getBoundingClientRect().width / screen.offsetWidth || 1;
  function rectIn(el){
    const s = screen.getBoundingClientRect(), r = el.getBoundingClientRect(), k = zoomK();
    return { x:(r.left - s.left + r.width / 2) / k, y:(r.top - s.top + r.height / 2) / k };
  }
  function pointIn(e){ const s = screen.getBoundingClientRect(), k = zoomK(); return { x:(e.clientX - s.left) / k, y:(e.clientY - s.top) / k }; }
  const potSpot = () => rectIn($('#lb-pot'));
  const bankSpot = () => rectIn(R('bank') || R('drum'));
  const betSpot = p => p.human ? rectIn($('#lb-my-bet')) : rectIn($('.lb-seat[data-seat="' + p.seat + '"] .lb-seat-bet'));
  const seatSpot = p => p.human ? bankSpot() : rectIn($('.lb-seat[data-seat="' + p.seat + '"] .lb-avatar'));
  const pendingSpot = () => rectIn($('#lb-pending'));
  function flyChips(from, to, n, o){
    o = o || {};
    const colours = ['d-red', 'd-blue', 'd-black', 'd-green', 'd-white', 'd-purple', 'd-yellow'];
    for (let i = 0; i < n; i++){
      const c = document.createElement('i');
      c.className = 'chip-disc fly ' + colours[(i + (o.seed || 0)) % colours.length] + ' v-' + (1 + i % 3);
      $('#fx').appendChild(c);
      const jx = (Math.random() - 0.5) * (o.spread || 18), jy = (Math.random() - 0.5) * (o.spread || 18);
      const lift = o.lift != null ? o.lift : 40 + Math.random() * 30;
      const dur = (o.dur || 420) * (reduced() ? 0.3 : 1);
      const delay = i * (o.stagger || 45);
      const a = c.animate([
        { transform:'translate(' + (from.x - 13) + 'px,' + (from.y - 13) + 'px) scale(' + (o.scale || 1) + ')', opacity:1 },
        { transform:'translate(' + ((from.x + to.x) / 2 - 13 + jx) + 'px,' + (Math.min(from.y, to.y) - lift - 13) + 'px) scale(' + ((o.scale || 1) * 1.15) + ')', opacity:1, offset:0.5 },
        { transform:'translate(' + (to.x - 13 + jx * 0.3) + 'px,' + (to.y - 13 + jy * 0.3) + 'px) scale(1)', opacity:1 }
      ], { duration:dur, delay, easing:'steps(' + (reduced() ? 2 : 12) + ',end)', fill:'both' });
      a.onfinish = () => { c.remove(); if (i % 2 === 0) Sound.chipLand(); };
    }
  }
  function betChipsFly(p){ flyChips(p.human ? bankSpot() : seatSpot(p), betSpot(p), p.human ? 3 : 2, { stagger:50, lift:20 }); }

  /* ------------------------------------------------------------
     Interactions
     ------------------------------------------------------------ */
  function wireDash(){
    const d = dash();
    // Keys
    $$('[data-act]', d).forEach(b => {
      b.addEventListener('pointerdown', e => { if (b.dataset.act === 'allin-press' && allinMode() === 'hold') startHold(e, b); });
      b.addEventListener('click', e => onAct(b.dataset.act, b, e));
    });
    // Knock: a double tap on the case, not on a control.
    let lastTap = 0, lx = 0, ly = 0;
    d.addEventListener('pointerdown', e => {
      if (opts.knock !== 'on' || e.target.closest('button,[data-r="tray"],[data-r="towers"],[data-r="dial"],[data-r="throttle"],[data-r="lever"],.p-pod,input')) return;
      const now = performance.now();
      if (now - lastTap < 340 && Math.hypot(e.clientX - lx, e.clientY - ly) < 50){ lastTap = 0; knock(e); }
      else { lastTap = now; lx = e.clientX; ly = e.clientY; }
    });
    // Peek
    const tray = R('tray');
    if (tray){
      const up = () => { if (tray.classList.contains('peeking')){ tray.classList.remove('peeking'); ui.peeking = false; renderPeek(false); } };
      tray.addEventListener('pointerdown', e => {
        if (opts.peek !== 'on' || !you().hand.length || you().folded) return;
        e.preventDefault(); tray.setPointerCapture(e.pointerId);
        tray.classList.add('peeking'); ui.peeking = true; renderPeek(true); Sound.cardFlip(false);
        if (!ui.peeked){ ui.firstPeek = true; }
      });
      tray.addEventListener('pointerup', up); tray.addEventListener('pointercancel', up);
    }
    // Chip dragging
    const towers = R('towers');
    if (towers) towers.addEventListener('pointerdown', e => startChipDrag(e));
    // Raise fixtures
    if (R('dial')) wireDial(R('dial'));
    if (R('throttle')) wireThrottle(R('throttle'));
    if (R('lever')) wireLever(R('lever'));
  }
  function renderPeek(show){
    const hole = R('hole'); if (!hole || ui.peeked) return;
    $$('.hole-card', hole).forEach((el, i) => {
      const c = you().hand[i];
      el.className = show ? 'card ' + SUIT_CLASS[c.suit] + ' hole-card hc-' + i + ' lifted' : 'card back hole-card hc-' + i;
      el.innerHTML = show ? '<div class="ci"><span class="r">' + c.rank + '</span><span class="s">' + c.suit + '</span></div><div class="pip">' + c.suit + '</div>' : '';
    });
    if (show && ui.firstPeek){ ui.firstPeek = false; ui.handSeen = true; crtHandSeen(); }
  }
  function crtHandSeen(){
    // Once you've looked, the hand readout and gauge know what you hold,
    // but the cards stay face-down on the tray.
    const keep = ui.peeked; ui.peeked = true; updateHand(); updateAnn(); ui.peeked = keep;
  }

  function onAct(a, btn, e){
    if (g.broken && a !== 'rebuild') return;
    const p = you();
    if (a === 'rebuild'){ rebuild(); return; }
    if (!ui.resolve) { denyTap(btn); return; }
    if (a === 'fold'){ press(btn, 'fold'); act('fold'); return; }
    if (a === 'call'){
      press(btn, toCall(p) ? 'call' : 'check');
      if (ui.pending){ ui.pending = 0; renderPending(); }
      act(toCall(p) ? 'call' : 'check'); return;
    }
    if (a === 'raise'){
      press(btn, 'raise');
      if (ui.pending){ const target = p.bet + ui.pending; if (target === g.currentBet){ act('call'); return; } if (target >= minRaiseTo() || target >= p.bet + p.stack){ act('raise', target); return; } denyTap(btn); return; }
      if (raiseMode() === 'lever' && !usesPod()){ nudgeLever(); return; }
      if (usesPod()){
        if (!ui.podOpen){ openPod(); return; }
        act('raise', ui.raiseTo); return;
      }
      if (!ui.sizing){ ui.sizing = true; ui.raiseTo = Math.min(minRaiseTo(), p.bet + p.stack); syncFixtures(); updateKeys(); flashFixture(); return; }
      act('raise', ui.raiseTo); return;
    }
    if (a === 'cover'){ toggleCover(); return; }
    if (a === 'allin-press'){
      if (allinMode() === 'cover' && !ui.coverOpen){ toggleCover(); return; }
      if (allinMode() === 'cover') commitAllIn();
      return;
    }
    if (a === 'pod-close'){ closePod(); return; }
    if (a === 'quick'){ ui.raiseTo = Number(btn.dataset.to); syncFixtures(); updateKeys(); SFX.ratchet(); return; }
  }
  function press(btn, kind){ Sound.buttonPress(kind); setTimeout(() => Sound.buttonRelease(kind), 90); if (btn){ btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 160); } }
  function denyTap(btn){ SFX.deny(); if (btn){ btn.classList.remove('deny'); void btn.offsetWidth; btn.classList.add('deny'); } }

  function knock(e){
    const d = dash(), r = d.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = 0; i < 2; i++){
      setTimeout(() => {
        const ring = document.createElement('i'); ring.className = 'knock-ring'; ring.style.left = x + 'px'; ring.style.top = y + 'px';
        d.appendChild(ring); setTimeout(() => ring.remove(), 500);
        SFX.knock(); kick(1);
      }, i * 150);
    }
    if (!ui.resolve){ setTimeout(() => flashStatus('NOT YOUR TURN', 'danger'), 300); return; }
    if (toCall(you()) > 0){ setTimeout(() => { SFX.deny(); flashStatus('CAN\'T KNOCK<br><b>' + toCall(you()) + ' TO CALL</b>', 'danger'); }, 320); return; }
    setTimeout(() => { you().say = 'KNOCK'; act('check'); }, 340);
  }
  function flashStatus(text, ink){
    const before = statusText, beforeInk = statusInk;
    setStatus(text, ink);
    setTimeout(() => { if (statusText === text) setStatus(before, beforeInk); }, 1300);
  }

  /* Fold: the cards are pulled back down into the machine. */
  function foldIntoMachine(){
    const hole = R('hole'); if (!hole) return;
    hole.classList.add('sucked');
    SFX.grind(); setGears('fast');
    setTimeout(() => { hole.classList.remove('sucked'); setGears('idle'); renderHole(); }, 700 * Math.max(1, T() * 0.8));
  }

  /* Drag chips from the bank onto the felt. */
  function startChipDrag(e){
    const tower = e.target.closest('.tower');
    if (opts.drag !== 'on' || !tower || !ui.resolve) return;
    e.preventDefault();
    const den = Number(tower.dataset.den);
    const p = you();
    if (ui.pending + den > p.stack){ denyTap(); return; }
    const s = screen.getBoundingClientRect();
    const chip = document.createElement('i');
    chip.className = 'chip-disc drag ' + ($('.chip-disc:last-of-type', tower) ? $('.chip-disc:last-of-type', tower).className.replace('chip-disc', '') : 'd-white v-1');
    $('#fx').appendChild(chip);
    const move = ev => { const q = pointIn(ev); chip.style.transform = 'translate(' + (q.x - 16) + 'px,' + (q.y - 16) + 'px) scale(1.25)'; };
    move(e);
    SFX.ratchet();
    const startY = e.clientY;
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const dashTop = dash().getBoundingClientRect().top;
      const tapped = Math.abs(ev.clientY - startY) < 6;
      chip.remove();
      if (ev.clientY < dashTop || tapped){
        ui.pending += den;
        flyChips(pointIn(ev), pendingSpot(), 1, { lift:6, dur:200 });
        renderPending(); updateKeys(); Sound.chipLand();
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function renderPending(){
    const el = $('#lb-pending');
    el.classList.toggle('show', ui.pending > 0);
    $('#lb-pending-val').textContent = ui.pending ? '+' + ui.pending : '';
    $('#lb-pending-chips').innerHTML = ui.pending ? chipPile(ui.pending, 8) : '';
  }

  /* Raise fixtures: dial, throttle, lever, and the drawer. */
  function raiseRange(){
    const p = you();
    const min = Math.min(minRaiseTo(), p.bet + p.stack), max = p.bet + p.stack;
    const pot = potTotal() + toCall(p);
    const half = Math.min(max, Math.max(min, g.currentBet + Math.round(pot / 2 / 10) * 10));
    const full = Math.min(max, Math.max(min, g.currentBet + Math.round(pot / 10) * 10));
    return { min, max, half, pot:full };
  }
  const toFrac = v => { const r = raiseRange(); return r.max === r.min ? 1 : (v - r.min) / (r.max - r.min); };
  function fromFrac(f){
    const r = raiseRange();
    f = Math.max(0, Math.min(1, f));
    // Detents: snap near MIN, ½ POT, POT and ALL.
    const snaps = [r.min, r.half, r.pot, r.max];
    let v = r.min + f * (r.max - r.min);
    for (const s of snaps){ if (Math.abs(toFrac(s) - f) < 0.035){ v = s; break; } }
    return Math.round(v / 10) * 10 >= r.max ? r.max : Math.max(r.min, Math.round(v / 10) * 10);
  }
  function setRaise(v){
    if (!ui.resolve) return;
    if (v !== ui.raiseTo){ ui.raiseTo = v; SFX.ratchet(); }
    ui.sizing = true; syncFixtures(); updateKeys();
  }
  function syncFixtures(){
    const f = toFrac(ui.raiseTo), txt = '$' + ui.raiseTo;
    const knob = R('dial-knob'); if (knob) knob.style.transform = 'rotate(' + (-135 + f * 270) + 'deg)';
    const th = R('thr-handle'); if (th) th.style.bottom = 'calc(' + (f * 100) + '% - ' + (f * 18) + 'px)';
    ['dial-read', 'thr-read'].forEach(r => { const el = R(r); if (el) el.textContent = ui.sizing || ui.podOpen ? txt : '—'; });
    const sl = $('.pod-slider', dash()); if (sl){ sl.value = Math.round(f * 1000); sl.style.setProperty('--fill', (f * 100) + '%'); }
    const pr = $('.pod-read', dash()); if (pr) pr.textContent = txt;
    const r = raiseRange();
    [['min', r.min], ['half', r.half], ['pot', r.pot], ['max', r.max]].forEach(([k, v]) => $$('[data-at="' + k + '"],.dt-' + k, dash()).forEach(el => el.classList.toggle('at', ui.raiseTo === v && (ui.sizing || ui.podOpen))));
  }
  function flashFixture(){ const f = R(raiseMode()); if (f){ f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash'); } }
  function wireDial(el){
    const face = $('.dial-face', el);
    let active = false;
    const angleTo = e => {
      const r = face.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let a = Math.atan2(e.clientX - cx, cy - e.clientY) * 180 / Math.PI; // 0 = up
      a = Math.max(-135, Math.min(135, a));
      return (a + 135) / 270;
    };
    face.addEventListener('pointerdown', e => { if (!ui.resolve) return; active = true; face.setPointerCapture(e.pointerId); setRaise(fromFrac(angleTo(e))); });
    face.addEventListener('pointermove', e => { if (active) setRaise(fromFrac(angleTo(e))); });
    face.addEventListener('pointerup', () => { active = false; });
  }
  function wireThrottle(el){
    const track = $('.thr-track', el);
    let active = false;
    const fracOf = e => { const r = track.getBoundingClientRect(); return 1 - (e.clientY - r.top) / r.height; };
    track.addEventListener('pointerdown', e => { if (!ui.resolve) return; active = true; track.setPointerCapture(e.pointerId); setRaise(fromFrac(fracOf(e))); });
    track.addEventListener('pointermove', e => { if (active) setRaise(fromFrac(fracOf(e))); });
    track.addEventListener('pointerup', () => { active = false; });
  }
  /* The lever: pull down to size, let go to bet. Pulled all the way it's
     an all-in, and the whole ceremony runs. */
  function wireLever(el){
    const arm = R('lever-arm'), read = R('lever-read');
    let active = false, startY = 0, frac = 0, travel = 1;
    const set = f => {
      frac = Math.max(0, Math.min(1, f));
      arm.style.setProperty('--pull', frac);
      const r = raiseRange();
      const v = frac < 0.12 ? 0 : fromFrac((frac - 0.12) / 0.88);
      read.textContent = frac < 0.12 ? 'PULL' : (v >= r.max ? 'ALL IN' : '$' + v);
      el.classList.toggle('armed', frac >= 0.12);
      el.classList.toggle('maxed', v >= r.max && frac >= 0.12);
      if (v !== ui.raiseTo && frac >= 0.12){ ui.raiseTo = v; SFX.ratchet(); }
    };
    $('.lever-knob', el).addEventListener('pointerdown', e => {
      if (!ui.resolve){ denyTap(); return; }
      active = true; startY = e.clientY; travel = $('.lever-slot', el).getBoundingClientRect().height * 0.8;
      e.target.setPointerCapture(e.pointerId); el.classList.add('pulling');
    });
    $('.lever-knob', el).addEventListener('pointermove', e => { if (active) set((e.clientY - startY) / travel); });
    const release = () => {
      if (!active) return;
      active = false; el.classList.remove('pulling', 'armed', 'maxed');
      const pulled = frac >= 0.12, v = ui.raiseTo;
      arm.style.setProperty('--pull', 0); arm.classList.add('spring'); setTimeout(() => arm.classList.remove('spring'), 500);
      SFX.clunk(); read.textContent = 'PULL';
      frac = 0;
      if (pulled && ui.resolve){
        const r = raiseRange();
        if (v >= r.max){ commitAllIn(); return; }
        act('raise', v);
      }
    };
    $('.lever-knob', el).addEventListener('pointerup', release);
    $('.lever-knob', el).addEventListener('pointercancel', release);
  }
  function nudgeLever(){ const l = R('lever'); if (l){ l.classList.remove('flash'); void l.offsetWidth; l.classList.add('flash'); } flashStatus('PULL THE LEVER<br><b>TO BET</b>', 'live'); }

  function buildPod(){
    const pod = R('pod'); if (!pod) return;
    const mode = raiseMode();
    let control = '';
    if (mode === 'dial') control = part.dial();
    else if (mode === 'throttle') control = part.throttle();
    else control = '<div class="pod-fader"><input type="range" class="pod-slider" min="0" max="1000" value="0" aria-label="Raise amount"></div>';
    pod.innerHTML = '<div class="pod-head"><span>RAISE TO</span><b class="pod-read">—</b><button type="button" class="pod-x" data-act="pod-close" aria-label="Close">✕</button></div>' +
      '<div class="pod-body pod-' + mode + '">' + control + '<div class="pod-quick"></div></div>' +
      '<div class="pod-allin">' + (allinMode() === 'hold' ? '<button type="button" class="hold-key" data-act="allin-press"><i></i><span>HOLD FOR ALL IN</span></button>' : part.cover()) + '</div>';
    const sl = $('.pod-slider', pod);
    if (sl) sl.addEventListener('input', () => setRaise(fromFrac(sl.value / 1000)));
    if (mode === 'dial') wireDial($('.p-dial', pod));
    if (mode === 'throttle') wireThrottle($('.p-throttle', pod));
    // Fixture directions with a hold-style all-in get the key in their foot.
    if (!usesPod() && allinMode() === 'hold' && !R('cover')){
      const foot = $('.d-foot', dash()) || $('.p-keys', dash()).parentNode;
      const k = document.createElement('div'); k.className = 'p-holdwrap';
      k.innerHTML = '<button type="button" class="hold-key" data-act="allin-press"><i></i><span>HOLD<br>ALL IN</span></button>';
      foot.appendChild(k);
    }
  }
  function openPod(){
    const pod = R('pod'); if (!pod) return;
    ui.podOpen = true; ui.raiseTo = Math.min(minRaiseTo(), you().bet + you().stack);
    const r = raiseRange();
    $('.pod-quick', pod).innerHTML = [['MIN', r.min], ['½ POT', r.half], ['POT', r.pot]].map(q => '<button type="button" class="qk" data-act="quick" data-to="' + q[1] + '">' + q[0] + '</button>').join('');
    $$('.qk', pod).forEach(b => b.addEventListener('click', () => onAct('quick', b)));
    $$('[data-act]', pod).forEach(b => { if (!b._wired){ b._wired = true; if (!b.classList.contains('qk')){ b.addEventListener('pointerdown', e => { if (b.dataset.act === 'allin-press' && allinMode() === 'hold') startHold(e, b); }); b.addEventListener('click', e => onAct(b.dataset.act, b, e)); } } });
    pod.classList.add('open'); SFX.shutter();
    syncFixtures(); updateKeys();
  }
  function closePod(){
    const pod = R('pod'); if (!pod || !ui.podOpen) return;
    ui.podOpen = false; pod.classList.remove('open'); updateKeys();
  }

  /* All-in triggers: a flip-up cover, or a key you hold. */
  function toggleCover(){
    const c = dash().querySelector('.p-pod.open [data-r="cover"]') || R('cover'); if (!c) return;
    if (!ui.resolve){ denyTap(); return; }
    ui.coverOpen = !ui.coverOpen;
    $$('[data-r="cover"]', dash()).forEach(x => x.classList.toggle('open', ui.coverOpen));
    SFX.cover();
    dash().classList.toggle('armed', ui.coverOpen);
    clearTimeout(ui.coverTimer);
    if (ui.coverOpen) ui.coverTimer = setTimeout(() => { if (ui.coverOpen) toggleCover(); }, 4000);
  }
  function startHold(e, btn){
    if (!ui.resolve){ denyTap(btn); return; }
    e.preventDefault();
    const need = 1100;
    btn.classList.add('charging'); dash().classList.add('armed');
    const t0 = performance.now();
    let raf, ticks = 0;
    const tick = now => {
      const k = (now - t0) / need;
      btn.style.setProperty('--charge', Math.min(1, k));
      if (Math.floor(k * 8) > ticks){ ticks++; tone(300 + ticks * 80, 0.05, 'square', 0.03); }
      if (k >= 1){ cleanup(); commitAllIn(); return; }
      raf = requestAnimationFrame(tick);
    };
    const cleanup = () => { cancelAnimationFrame(raf); btn.classList.remove('charging'); btn.style.setProperty('--charge', 0); dash().classList.remove('armed'); window.removeEventListener('pointerup', cleanup); window.removeEventListener('pointercancel', cleanup); };
    window.addEventListener('pointerup', cleanup); window.addEventListener('pointercancel', cleanup);
    raf = requestAnimationFrame(tick);
  }
  function commitAllIn(){
    if (!ui.resolve) return;
    ui.coverOpen = false; clearTimeout(ui.coverTimer);
    $$('[data-r="cover"]', dash()).forEach(x => x.classList.add('slammed'));
    Sound.buttonPress('allin'); setTimeout(() => Sound.buttonRelease('allin'), 120);
    if (opts.rig !== 'random') rigRunout(opts.rig === 'win');
    act('allin');
  }

  /* ------------------------------------------------------------
     The big moments
     ------------------------------------------------------------ */
  async function allInCeremony(){
    const d = dash(), T0 = T();
    screen.classList.add('allin-mode'); d.classList.add('alarm');
    d.classList.remove('armed');
    Sound.allIn(true); SFX.siren(2 * T0);
    setGears('fast');
    stamp('ALL IN');
    ui.holdDrum = true;
    const stackBefore = drumShown;
    flyChips(bankSpot(), betSpot(you()), Math.min(18, 6 + Math.round(stackBefore / 80)), { stagger:35, spread:40, lift:70 });
    rollDrum(0, 1400 * T0);
    kick(3);
    g.players.forEach(p => { if (!p.human && !p.folded) p.mood = 'shock'; });
    renderSeats();
    setStatus('ALL IN<br><b>NO WAY BACK</b>', 'danger');
    await wait(1600);
    ui.holdDrum = false;
    d.classList.remove('alarm'); d.classList.add('alarm-low');
    setGears('busy');
    await wait(300);
    $$('[data-r="cover"]', d).forEach(x => x.classList.remove('slammed', 'open'));
  }
  async function facingAllIn(p){
    const d = dash();
    d.classList.add('alarm-low', 'facing');
    SFX.siren(0.9);
    stamp(p.name + ' ALL IN', 'small');
    await wait(900);
  }
  function stamp(text, cls){
    const s = $('#lb-stamp');
    s.className = 'lb-stamp ' + (cls || ''); s.textContent = text; void s.offsetWidth; s.classList.add('go');
    setTimeout(() => s.classList.remove('go'), 1800 * T());
  }
  function clearAlarms(){ const d = dash(); d.classList.remove('alarm', 'alarm-low', 'facing', 'armed'); screen.classList.remove('allin-mode', 'suspense'); }

  async function winCeremony(mine, total, hand){
    const d = dash(), big = mine >= 400 || screen.classList.contains('allin-mode');
    clearAlarms();
    setStatus('YOU WIN<br><b>$' + mine + '</b>', 'money');
    Sound.resultSting('humanWin');
    d.classList.add('payout'); if (big) d.classList.add('jackpot');
    if (big){ stamp('WIN $' + mine, 'win'); SFX.bell(); kick(2); }
    setGears('fast');
    const n = Math.min(big ? 26 : 10, 4 + Math.round(mine / 60));
    flyChips(potSpot(), bankSpot(), n, { stagger:big ? 55 : 60, spread:30, lift:big ? 90 : 50, dur:520 });
    await wait(300);
    rollDrum(you().stack, (big ? 1800 : 900) * T());
    renderSeats(); renderPot();
    await wait(big ? 2400 : 1300);
    d.classList.remove('payout', 'jackpot');
    setGears('idle');
    if (hand) setStatus('WON WITH<br><b>' + hand.toUpperCase() + '</b>', 'money');
  }

  /* Bust: the machine breaks. */
  async function bust(){
    const d = dash();
    g.broken = true;
    clearAlarms();
    setTurn(false, true);
    setStatus('OUT OF<br><b>CHIPS</b>', 'danger');
    d.classList.add('breaking');
    SFX.grind(); Sound.busted(true);
    setGears('fast');
    await wait(500);
    d.classList.add('jammed'); SFX.spark(); sparks(R('drum'), 14);
    await wait(500);
    d.classList.add('static'); SFX.spark(); sparks(R('hand'), 8);
    await wait(450);
    d.classList.add('popped'); SFX.pop(); kick(3);
    await wait(400);
    d.classList.add('shed'); SFX.clunk(); setTimeout(SFX.clunk, 180);
    await wait(500);
    d.classList.add('dead'); setGears('still'); motorSpeed(0);
    smoke();
    await wait(600);
    d.classList.add('broken-rest');
  }
  function sparks(el, n){
    if (!el) return;
    const p = rectIn(el);
    for (let i = 0; i < n; i++){
      const s = document.createElement('i'); s.className = 'spark';
      $('#fx').appendChild(s);
      const a = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 60;
      s.animate([
        { transform:'translate(' + p.x + 'px,' + p.y + 'px)', opacity:1 },
        { transform:'translate(' + (p.x + Math.cos(a) * dist) + 'px,' + (p.y + Math.sin(a) * dist + 30) + 'px)', opacity:0 }
      ], { duration:400 + Math.random() * 300, easing:'steps(6,end)', fill:'forwards' }).onfinish = () => s.remove();
    }
  }
  function smoke(){
    const host = R('smoke'); if (!host) return;
    host.innerHTML = Array.from({ length:7 }, (_, i) => '<i style="--i:' + i + ';left:' + (15 + Math.random() * 70) + '%"></i>').join('');
  }
  async function rebuild(){
    if (!g.broken) return;
    const d = dash();
    SFX.whirr(); setGears('fast');
    d.classList.add('repairing');
    d.classList.remove('broken-rest', 'dead', 'shed', 'popped', 'static', 'jammed', 'breaking');
    you().stack = START;
    drumShown = 0; rollDrum(START, 1200);
    await wait(900);
    SFX.relay(); await sleep(120); SFX.relay();
    d.classList.remove('repairing');
    R('smoke') && (R('smoke').innerHTML = '');
    g.broken = false;
    setGears('idle');
    renderAll();
    await wait(400);
    runHand();
  }

  /* Rig the rest of the board so an all-in is won or lost. */
  function rigRunout(win){
    const me = you();
    const rivals = () => live().filter(p => !p.human);
    const need = 5 - g.board.length;
    if (need <= 0) return;
    // Make sure at least one opponent calls.
    g.script = Object.assign({}, g.script, {
      decide(p, call){
        if (!rivals().length) return null;
        const caller = rivals()[0];
        if (p === caller) return { act:'call' };
        return { act:'fold' };
      }
    });
    const pool = g.deck.slice();
    for (let tries = 0; tries < 800; tries++){
      const run = shuffle(pool).slice(0, need);
      const board = [...g.board, ...run];
      const mine = evaluate7([...me.hand, ...board]);
      const caller = rivals()[0];
      if (!caller) return;
      const theirs = evaluate7([...caller.hand, ...board]);
      const c = compareHands(mine, theirs);
      if ((win && c > 0) || (!win && c < 0)){ g.forced = run; run.forEach(takeFromDeck); return; }
    }
  }

  /* ------------------------------------------------------------
     Lab moments
     ------------------------------------------------------------ */
  async function stopHand(){
    if (g.running){
      g.abort = true;
      if (ui.resolve) ui.resolve({ act:'abort' });
      let guard = 0;
      while (g.running && guard++ < 100) await sleep(40);
      g.abort = false;
    }
    // Money in the abandoned hand goes back to whoever put it in.
    g.players.forEach(p => { p.stack += p.total; p.bet = 0; p.total = 0; });
    g.pot = 0;
    ui.holdDrum = false;
    clearAlarms();
    const d = dash(); d.classList.remove('payout', 'jackpot', 'made', 'sizing');
    $('#fx').innerHTML = '';
  }
  const MOMENTS = {
    async deal(){ await stopHand(); if (g.broken) await rebuildQuiet(); runHand(); },
    async monster(){
      await stopHand(); if (g.broken) await rebuildQuiet();
      runHand({ hands:[[C('Ah'), C('As')]], board:[C('Ad'), C('Kc'), C('Kh'), C('7s'), C('2d')], script:{ decide:(p, call) => call ? { act:'call' } : { act:'check' } } });
    },
    async shove(){
      await stopHand(); if (g.broken) await rebuildQuiet();
      runHand({ dealer:2, script:{ decide:(p, call) => p.seat === 1 && g.street === 'preflop' ? { act:'allin' } : (g.players[1].allIn ? { act:'fold' } : null) } });
    },
    async allinwin(){ await allinMoment('win'); },
    async allinlose(){ await allinMoment('lose'); },
    async bigwin(){
      await stopHand(); if (g.broken) await rebuildQuiet();
      runHand({ hands:[[C('Kh'), C('Kd')]], board:[C('Ks'), C('9c'), C('4h'), C('9d'), C('2s')],
        script:{ decide:(p, call) => call ? { act:'call' } : (g.street === 'flop' ? { act:'raise', to:Math.min(p.stack + p.bet, 160) } : { act:'check' }) } });
    },
    async rebuild(){ if (g.broken) rebuild(); else { await stopHand(); you().stack = START; renderAll(); runHand(); } }
  };
  async function allinMoment(kind){
    await stopHand(); if (g.broken) await rebuildQuiet();
    opts.rig = kind; syncControls();
    if (kind === 'lose') you().stack = Math.min(you().stack, START);
    ui.autoAllIn = () => { if (ui.resolve){ if (allinMode() === 'cover'){ toggleCover(); setTimeout(commitAllIn, 650 * T()); } else commitAllIn(); } };
    runHand();
  }
  async function rebuildQuiet(){
    const d = dash();
    d.classList.remove('broken-rest', 'dead', 'shed', 'popped', 'static', 'jammed', 'breaking');
    R('smoke') && (R('smoke').innerHTML = '');
    g.broken = false; you().stack = START; drumShown = START; setReels(START, true);
  }

  /* ------------------------------------------------------------
     Lab chrome
     ------------------------------------------------------------ */
  function syncControls(){
    $$('[data-set]').forEach(seg => $$('button', seg).forEach(b => b.classList.toggle('is-on', opts[seg.dataset.set] === b.dataset.v)));
    $('#lab-dir-note').textContent = DIR_NOTES[opts.dir];
    $('#lab-size-note').textContent = SIZES[opts.size].note;
    screen.dataset.theme = opts.theme;
    screen.dataset.motion = opts.motion;
    screen.dataset.life = opts.life;
    settings.sound = opts.sound === 'on';
    writeHash();
  }
  $$('[data-set]').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = seg.dataset.set; opts[k] = b.dataset.v;
    syncControls();
    if (['dir', 'size', 'raise', 'allin', 'keys'].includes(k)){ const turn = !!ui.resolve; ui.podOpen = false; ui.sizing = false; buildDash(); if (turn) setTurn(true, true); if (g.broken) dash().classList.add('breaking', 'jammed', 'static', 'popped', 'shed', 'dead', 'broken-rest'); }
    if (k === 'life') setGears('idle');
    if (k === 'peek'){ ui.peeked = opts.peek !== 'on' || ui.peeked; renderHole(); updateHand(); }
  }));
  $$('[data-moment]').forEach(b => b.addEventListener('click', () => MOMENTS[b.dataset.moment]()));

  // Fit the phone to the window height.
  function fit(){
    const stage = $('.lab-stage'), ph = $('#phone');
    const k = Math.min(1, (stage.clientHeight - 40) / 960, (stage.clientWidth - 20) / 450);
    ph.style.setProperty('--fit', k.toFixed(3));
  }
  window.addEventListener('resize', fit);

  window.__dashLab = { g, ui, opts, MOMENTS, act, runHand };

  readHash();
  if (typeof installFaceTintFilters === 'function') installFaceTintFilters();
  buildScreen();
  syncControls();
  buildDash();
  renderAll();
  fit();
  setTimeout(() => runHand(), 400);
})();
