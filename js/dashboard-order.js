"use strict";

/* ============================================================
   DASHBOARD V2 — ORDER FORM BEHAVIOURS (round 2)
   Injected by dashboard-order-lab.html into a sandboxed copy of the real
   game, after every production script. NOT loaded by the game.

   It sets the order's attributes on <html> (css/dashboard-order.css reads
   them), moves dashboard elements into the bankroll row and the one
   screen, adds the few extra parts the options need (bet readouts, key
   seats, sizing controls, the all-in key), and runs the behaviours
   through the game's own functions: humanAct() for every action,
   setWagerAmount() for every sizing change, updateFixedReel() for every
   reel, and rollStageTransition() is wrapped so the rim can go dark before
   the RUN OVER roll. Poker rules and state are only ever changed by those
   real functions.
   ============================================================ */
(function(){
  const order = {};
  const $id = id => document.getElementById(id);
  const on = (k, v) => v === undefined ? (order[k] && order[k] !== '0') : order[k] === v;
  const root = document.documentElement;
  const human = () => (typeof game !== 'undefined' && game) ? game.players.find(p => p.isHuman) : null;
  const inHand = () => typeof game !== 'undefined' && game && ['preflop','flop','turn','river'].includes(game.phase);
  const myTurn = () => typeof pendingHumanPlayer !== 'undefined' && !!pendingHumanPlayer && !$id('actions-row').classList.contains('disabled');
  const toCall = () => myTurn() ? Math.max(0, game.currentBet - pendingHumanPlayer.betThisRound) : 0;
  const quiet = () => typeof motionOff === 'function' && motionOff();
  const snd = (name, ...a) => { try{ if (typeof Sound !== 'undefined' && Sound[name]) return Sound[name](...a); }catch(e){} };

  /* ---------- small lab-only voices (the game's Sound covers the rest) ---------- */
  let ctx = null;
  function ac(){
    if (typeof settings === 'undefined' || !settings.sound) return null;
    if (!ctx){ try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, d, type, v, when){
    const c = ac(); if (!c) return;
    const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function thud(v, when){
    const c = ac(); if (!c) return;
    const t = c.currentTime + (when || 0), len = Math.floor(c.sampleRate * 0.06), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = 280; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
    tone(90, 0.1, 'sine', v * 0.6, when);
  }
  const voice = {
    knock(){ thud(0.5); thud(0.45, 0.15); },
    buzz(){ tone(150, 0.12, 'square', 0.04); tone(110, 0.16, 'square', 0.04, 0.1); },
    tick(n){ tone(300 + n * 70, 0.05, 'square', 0.025); },
    detent(){ tone(1900, 0.018, 'square', 0.02); tone(700, 0.03, 'triangle', 0.02); },
    relay(){ tone(2400, 0.012, 'square', 0.03); tone(180, 0.04, 'square', 0.03, 0.012); },
    print(){ for (let i = 0; i < 3; i++) tone(900 + i * 140, 0.025, 'square', 0.018, i * 0.045); },
    tear(){ const c = ac(); if (!c) return; thud(0.12); tone(3200, 0.06, 'sawtooth', 0.012); }
  };

  /* ---------- structure: moved elements go home before every rebuild ---------- */
  const homes = new Map();
  function remember(el){ if (el && !homes.has(el)) homes.set(el, { parent:el.parentNode, next:el.nextSibling }); }
  function restore(el){
    const h = homes.get(el); if (!h) return;
    if (h.next && h.next.parentNode === h.parent) h.parent.insertBefore(el, h.next); else h.parent.appendChild(el);
  }
  const made = [];   // elements this file created for the current order
  function make(html){ const t = document.createElement('div'); t.innerHTML = html.trim(); const el = t.firstChild; made.push(el); return el; }

  function teardown(){
    const frame = $id('hud-frame'); if (!frame) return;
    const hand = $id('hand-strength'), banner = $id('banner'), stack = frame.querySelector('.stack-readout'),
      bet = frame.querySelector('.bet-this-hand'), jackpot = $id('jackpot');
    [jackpot, hand, banner, stack, bet].forEach(restore);
    made.splice(0).forEach(el => el.remove());
    document.querySelectorAll('.do-seat').forEach(s => { while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s); s.remove(); });
  }

  function build(){
    const frame = $id('hud-frame'); if (!frame) return;
    const hand = $id('hand-strength'), banner = $id('banner'), stack = frame.querySelector('.stack-readout'),
      bet = frame.querySelector('.bet-this-hand'), jackpot = $id('jackpot');
    [jackpot, hand, banner, stack, bet].forEach(remember);
    teardown();

    if (order.layout === 'rows'){
      // One screen: the hand line (and, for the CRT bet, a money cell) on top, the turn below.
      const screen = make('<div class="do-screen"><div class="do-screen-top"></div></div>');
      hand.parentNode.insertBefore(screen, hand);
      screen.firstChild.appendChild(hand);
      screen.firstChild.appendChild(make('<div class="do-crtbet crt-screen machine-crt" data-ink="money" data-crt-blink="off"><small>BET</small><b>$0</b></div>'));
      screen.appendChild(banner);

      // The bankroll row.
      const row = make('<div class="do-row do-row-stack"></div>');
      frame.appendChild(row);
      row.appendChild(stack); row.appendChild(bet);
      if (order.bet === 'window'){
        const wrap = make('<div class="do-winwrap"></div>');
        stack.appendChild(wrap); wrap.appendChild(jackpot);
        wrap.appendChild(make('<i class="do-windiv"></i>'));
        const side = make('<div class="do-winside"><span class="do-bet-print">THIS HAND</span><div class="do-winreels mini-jackpot"><span class="jp-cell jp-sym">$</span></div></div>');
        wrap.appendChild(side);
      }
      const house = make('<div class="do-bethouse"><span class="do-bet-print">THIS HAND</span><div class="do-betdrum mini-jackpot"><span class="jp-cell jp-sym">$</span></div><div class="do-tape"><div class="do-tape-paper"></div></div></div>');
      if (order.bet === 'tape') house.querySelector('.do-bet-print').remove();
      row.appendChild(house);
    }

    // Key seats (layout-neutral unless a bay option styles them).
    const keys = $id('actions-row');
    if (keys) keys.querySelectorAll(':scope > button').forEach(b => {
      const seat = document.createElement('span'); seat.className = 'do-seat';
      b.parentNode.insertBefore(seat, b); seat.appendChild(b);
    });

    // The sizing face's extra parts.
    const panel = $id('raise-panel');
    if (panel){
      panel.appendChild(make('<div class="do-barrel" aria-hidden="true"><span>DASHBOARD</span><span>DASHBOARD</span></div>'));
      const rowEl = panel.querySelector('.raise-row');
      if (rowEl){
        rowEl.appendChild(make('<i class="do-scale" aria-hidden="true"></i>'));
        const wheel = make('<div class="do-wheel" role="slider" aria-label="Roll to set the raise"><i></i><b></b></div>');
        rowEl.appendChild(wheel); wireWheel(wheel);
      }
      const combo = make('<div class="do-combo" aria-label="Set each digit"></div>');
      panel.appendChild(combo); buildCombo(combo);
      if (!panel.querySelector('.do-allin-wrap')){
        panel.insertAdjacentHTML('beforeend', '<div class="do-allin-wrap"><button type="button" class="do-allin-key"><i></i><span>HOLD<br>ALL IN</span></button></div>');
        wireAllIn(panel.querySelector('.do-allin-wrap'));
      }
    }
    betShown = null; syncBet(true);
  }

  /* ---------- the order ---------- */
  function apply(next){
    Object.assign(order, next || {});
    Object.keys(order).forEach(k => {
      if (order[k] && order[k] !== '0') root.setAttribute('data-do-' + k, order[k]);
      else root.removeAttribute('data-do-' + k);
    });
    build();
    litState = ''; tick(true);
  }

  /* ---------- bet this hand: every readout follows the game's own number ---------- */
  let betShown = null, tapeLines = [], tapeHand = '';
  const betValue = () => { const el = $id('hud-invested'); const m = el && /([\d,]+)\s*$/.exec(el.getAttribute('aria-label') || ''); return m ? Number(m[1].replace(/,/g, '')) : 0; };
  function syncBet(immediate){
    const v = betValue();
    if (v === betShown) return;
    const prev = betShown; betShown = v;
    const opts = { digits:4, label:'Bet this hand', cascade:18 };
    if (typeof updateFixedReel === 'function'){
      document.querySelectorAll('.do-betdrum,.do-winreels').forEach(el => updateFixedReel(el, v, opts));
    }
    document.querySelectorAll('.do-crtbet b').forEach(b => { b.textContent = '$' + v.toLocaleString(); });
    // The tape: a new hand tears it off; each rise prints the new total.
    const tape = document.querySelector('.do-tape');
    const h = human(), key = h && h.hand && h.hand.length ? h.hand.map(c => c.rank + c.suit).join() : '';
    if (key !== tapeHand){ tapeHand = key; if (tapeLines.some(n => n > 0) && !immediate) tearTape(tape); tapeLines = []; }
    if (!tapeLines.length || v > tapeLines[tapeLines.length - 1]) tapeLines.push(v);
    tapeLines = tapeLines.filter((n, i) => n > 0 || i === tapeLines.length - 1).slice(-4);
    if (tape){
      const paper = tape.querySelector('.do-tape-paper');
      paper.innerHTML = tapeLines.map(n => '<span>$' + n.toLocaleString() + '</span>').join('');
      if (!immediate && prev !== null && v > prev && on('bet', 'tape') && !quiet()){ tape.classList.remove('feed'); void tape.offsetWidth; tape.classList.add('feed'); voice.print(); }
    }
  }
  function tearTape(tape){
    if (!tape || !on('bet', 'tape') || quiet()) return;
    tape.classList.remove('tear'); void tape.offsetWidth; tape.classList.add('tear'); voice.tear();
    setTimeout(() => tape.classList.remove('tear'), 450);
  }

  /* ---------- the rim light ---------- */
  let litState = '', winUntil = 0, bustLit = false, lastWinFlash = false;
  function setLit(state, force){
    if (state === litState && !force) return;
    litState = state;
    if (state) root.setAttribute('data-do-lit', state); else root.removeAttribute('data-do-lit');
    if (on('rim') && state && state !== 'bust'){
      root.classList.remove('do-relay'); void root.offsetWidth; root.classList.add('do-relay');
      setTimeout(() => root.classList.remove('do-relay'), 340);
      voice.relay();
    }
  }

  /* ---------- the watch loop: turns table state into dashboard state ---------- */
  let last = { handKey:'' };
  function tick(force){
    const dock = $id('your-seat-dock'); if (!dock) return;
    const h = human();
    const turn = myTurn();

    // The raise face covers the instrument panel exactly.
    const frame = $id('hud-frame'), ad = document.querySelector('.actions-dock');
    if (frame && ad){ const hTop = frame.getBoundingClientRect().top, aTop = ad.getBoundingClientRect().top; if (aTop > hTop) ad.style.setProperty('--do-hud-h', Math.round(aTop - hTop) + 'px'); }

    // New hand: cards rise, peek resets.
    const handKey = h && h.hand && h.hand.length ? h.hand.map(c => c.rank + c.suit).join() + ':' + (game.handNumber || game.handNum || '') : '';
    if (handKey !== last.handKey){
      last.handKey = handKey;
      if (handKey){
        frame.classList.add('do-unpeeked');
        const seat = document.querySelector('.seat.you');
        if (seat && order.tray === 'rise' && !quiet()){ seat.classList.remove('do-rise'); void seat.offsetWidth; seat.classList.add('do-rise'); setTimeout(() => seat.classList.remove('do-rise'), 950); }
      }
    }

    syncBet(!!force);

    // Rim light: bust > win > all in > your turn > dark.
    const win = frame.classList.contains('hud-frame-win-flash');
    if (win && !lastWinFlash) winUntil = performance.now() + 1700;
    lastWinFlash = win;
    if (h && h.chips > 0) bustLit = false;
    const mine = !!(h && h.allIn && inHand() && !h.folded);
    const facing = turn && game.players.some(p => !p.isHuman && p.allIn && !p.folded) && toCall() > 0;
    let state = '';
    if (bustLit) state = 'bust';
    else if (performance.now() < winUntil) state = 'win';
    else if (mine || facing) state = 'allin';
    else if (turn) state = 'turn';
    setLit(state, force);
  }
  setInterval(tick, 120);

  /* ---------- the raise mechanism: sound, closing roll, instruments roll away ---------- */
  (function watchRaise(){
    const panel = $id('raise-panel'); if (!panel) return;
    let open = panel.classList.contains('show'), closeT = 0;
    new MutationObserver(() => {
      const now = panel.classList.contains('show');
      if (now === open) return;
      open = now;
      const frame = $id('hud-frame');
      if (!on('raise')){ frame.classList.remove('do-rolled'); return; }
      clearTimeout(closeT);
      if (now){
        panel.classList.remove('do-closing');
        frame.classList.add('do-rolled');
        if (!quiet()){ snd('consoleShift'); snd('stageRollClick', 1, false); setTimeout(() => snd('stageRollClick', 1, false), 140); setTimeout(() => snd('stageLock'), order.raise === 'slide' ? 360 : 400); }
      } else {
        frame.classList.remove('do-rolled');
        if (quiet()) return;
        panel.classList.add('do-closing'); snd('consoleShift');
        closeT = setTimeout(() => { panel.classList.remove('do-closing'); snd('counterLock', true); }, 400);
      }
    }).observe(panel, { attributes:true, attributeFilter:['class'] });
  })();

  /* ---------- sizing: every change clicks and rolls the drum ---------- */
  const slider = () => $id('raise-slider');
  const bounds = () => { const s = slider(); return s ? { min:Number(s.min), max:Number(s.max), v:Number(s.value) } : null; };
  const stepSize = () => Math.max(1, Math.round(((game && game.bigBlind) || 20) / 2));
  function setAmount(v){
    if (!myTurn() || typeof setWagerAmount !== 'function') return null;
    const before = Number(slider().value);
    const got = setWagerAmount(v, { immediate:true });
    if (got !== null && got !== before) voice.detent();
    return got;
  }
  // Fader: a detent click whenever the value crosses a notch (a tenth of the travel).
  (function wireFader(){
    const s = slider(); if (!s) return;
    let lastNotch = null;
    s.addEventListener('input', () => {
      if (!on('sizing', 'fader')) return;
      const b = bounds(), n = b.max > b.min ? Math.round((b.v - b.min) / (b.max - b.min) * 10) : 0;
      if (lastNotch !== null && n !== lastNotch){ voice.detent(); if (typeof navigator.vibrate === 'function') try{ navigator.vibrate(4); }catch(e){} }
      lastNotch = n;
    });
  })();
  // Thumbwheel: drag to roll, one step per 7px of ridge; a flick keeps it spinning.
  function wireWheel(wheel){
    const ridges = wheel.querySelector('i');
    let x0 = 0, acc = 0, pos = 0, vel = 0, lastX = 0, lastT = 0, raf = 0;
    const PX = 7;
    const nudge = dx => {
      pos += dx; ridges.style.setProperty('--wx', pos + 'px');
      acc += dx;
      while (Math.abs(acc) >= PX){
        const dir = acc > 0 ? 1 : -1; acc -= dir * PX;
        const b = bounds(); if (!b) return false;
        const got = setAmount(b.v + dir * stepSize());
        if (got === b.v) return false;   // hit the end stop
      }
      return true;
    };
    wheel.addEventListener('pointerdown', e => {
      if (!myTurn()) return;
      e.preventDefault(); cancelAnimationFrame(raf); wheel.setPointerCapture(e.pointerId);
      x0 = lastX = e.clientX; lastT = performance.now(); vel = 0;
    });
    wheel.addEventListener('pointermove', e => {
      if (!wheel.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - lastX, t = performance.now();
      vel = dx / Math.max(1, t - lastT) * 16; lastX = e.clientX; lastT = t;
      nudge(dx);
    });
    const release = e => {
      if (!wheel.hasPointerCapture(e.pointerId)) return;
      wheel.releasePointerCapture(e.pointerId);
      if (quiet() || Math.abs(vel) < 2) return;
      const spin = () => { vel *= 0.9; if (Math.abs(vel) < 0.8 || !nudge(vel)) return; raf = requestAnimationFrame(spin); };
      raf = requestAnimationFrame(spin);
    };
    wheel.addEventListener('pointerup', release); wheel.addEventListener('pointercancel', release);
  }
  // Combination: an up and a down key under every digit; drag a digit too.
  function buildCombo(combo){
    const keys = d => [5,4,3,2,1,0].map(p => '<button type="button" data-p="' + p + '" data-d="' + d + '" aria-label="' + (d > 0 ? 'Up' : 'Down') + '">' + (d > 0 ? '\u25B2' : '\u25BC') + '</button>').join('');
    combo.innerHTML = '<div class="do-crow do-cup">' + keys(1) + '</div><div class="do-crow do-cdown">' + keys(-1) + '</div>';
    combo.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const bd = bounds(); if (!bd) return;
      setAmount(bd.v + Number(b.dataset.d) * Math.pow(10, Number(b.dataset.p)));
    });
  }
  document.addEventListener('pointerdown', e => {
    if (!on('sizing', 'combo') || !myTurn()) return;
    const cell = e.target.closest('#raise-amt .reel-digit'); if (!cell) return;
    const cells = [...document.querySelectorAll('#raise-amt .reel-digit')];
    const p = cells.length - 1 - cells.indexOf(cell);
    e.preventDefault();
    let y0 = e.clientY;
    const move = ev => {
      const dy = y0 - ev.clientY;
      if (Math.abs(dy) >= 14){ const bd = bounds(); setAmount(bd.v + Math.sign(dy) * Math.pow(10, p)); y0 = ev.clientY; }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }, true);

  /* ---------- knock to check ---------- */
  let lastTap = 0, lx = 0, ly = 0;
  document.addEventListener('pointerdown', e => {
    if (!on('knock')) return;
    const dock = $id('your-seat-dock');
    if (!dock || !dock.contains(e.target) || e.target.closest('button,.seat.you .seat-cards,#hud-left')) return;
    const now = performance.now();
    if (now - lastTap < 340 && Math.hypot(e.clientX - lx, e.clientY - ly) < 50){ lastTap = 0; knock(e, dock); }
    else { lastTap = now; lx = e.clientX; ly = e.clientY; }
  }, true);
  function knock(e, dock){
    const r = dock.getBoundingClientRect();
    [0, 150].forEach(t => setTimeout(() => {
      const ring = document.createElement('i'); ring.className = 'do-knock-ring';
      ring.style.left = (e.clientX - r.left) + 'px'; ring.style.top = (e.clientY - r.top) + 'px';
      dock.appendChild(ring); setTimeout(() => ring.remove(), 500);
      dock.classList.remove('do-knocked'); void dock.offsetWidth; dock.classList.add('do-knocked');
    }, t));
    voice.knock();
    if (!myTurn()) return;
    if (toCall() > 0){
      setTimeout(() => {
        voice.buzz();
        const f = $id('hud-frame'); f.classList.remove('do-deny'); void f.offsetWidth; f.classList.add('do-deny');
        if (typeof paintActionRows === 'function') paintActionRows('CAN\'T KNOCK', toCall() + ' TO CALL', false);
        setTimeout(() => { f.classList.remove('do-deny'); if (typeof updateActionControls === 'function') updateActionControls(); }, 1300);
      }, 320);
      return;
    }
    setTimeout(() => { if (myTurn() && toCall() === 0) humanAct('check'); }, 330);
  }

  /* ---------- card peek ---------- */
  document.addEventListener('pointerdown', e => {
    if (!on('peek')) return;
    const cards = e.target.closest('.seat.you .seat-cards');
    if (!cards) return;
    e.preventDefault();
    const f = $id('hud-frame');
    f.classList.add('do-peeking'); f.classList.remove('do-unpeeked');
    snd('cardFlip', false);
    const up = () => { f.classList.remove('do-peeking'); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }, true);

  /* ---------- all in: hold to charge ---------- */
  let hum = null;
  function wireAllIn(wrap){
    const key = wrap.querySelector('.do-allin-key');
    let raf = 0, t0 = 0, ticks = 0;
    const stop = () => { cancelAnimationFrame(raf); key.classList.remove('charging'); key.style.setProperty('--charge', 0); if (hum){ hum.stop(); hum = null; } };
    const commit = () => { stop(); if (myTurn()) humanAct('allin'); };
    key.addEventListener('pointerdown', e => {
      if (!myTurn()) return;
      e.preventDefault(); t0 = performance.now(); ticks = 0; key.classList.add('charging');
      if (typeof Sound !== 'undefined'){ hum = Sound.wheelMotor(); hum.set(0.2); }
      const step = now => {
        const k = (now - t0) / 1150;
        key.style.setProperty('--charge', Math.min(1, k));
        if (Math.floor(k * 8) > ticks){ ticks++; voice.tick(ticks); if (hum) hum.set(0.2 + k * 0.4); }
        if (k >= 1){ commit(); return; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      const up = () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (key.classList.contains('charging')) stop(); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }

  /* ---------- bust: the rim flickers out before the RUN OVER roll ---------- */
  const sleep = ms => new Promise(r => setTimeout(r, quiet() ? 0 : ms));
  if (typeof rollStageTransition === 'function'){
    const realRoll = rollStageTransition;
    rollStageTransition = async function(){
      const h = human();
      if (h && h.chips <= 0 && on('rim')){
        bustLit = true; setLit('bust');
        snd('busted', true); voice.relay();
        await sleep(1150);
      }
      return realRoll.apply(this, arguments);
    };
  }

  window.DashOrder = { apply, get order(){ return Object.assign({}, order); } };
})();
