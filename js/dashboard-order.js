"use strict";

/* ============================================================
   DASHBOARD V2 — ORDER FORM BEHAVIOURS
   Injected by dashboard-order-lab.html into a sandboxed copy of the real
   game, after every production script. NOT loaded by the game.

   It sets the order's attributes on <html> (css/dashboard-order.css reads
   them), moves dashboard elements into rows for the layout options, adds
   the few extra parts the options need (shutter, lamps, all-in key), and
   runs the behaviours through the game's own functions: humanAct() for
   every action, setWagerAmount() for chip dragging, rollStageTransition()
   is wrapped to play the bust before the RUN OVER roll. Poker rules and
   state are only ever changed by those real functions.
   ============================================================ */
(function(){
  const order = {};
  const $id = id => document.getElementById(id);
  const on = (k, v) => v === undefined ? (order[k] && order[k] !== '0') : order[k] === v;
  const human = () => (typeof game !== 'undefined' && game) ? game.players.find(p => p.isHuman) : null;
  const inHand = () => typeof game !== 'undefined' && game && ['preflop','flop','turn','river'].includes(game.phase);
  const myTurn = () => typeof pendingHumanPlayer !== 'undefined' && !!pendingHumanPlayer && !$id('actions-row').classList.contains('disabled');
  const toCall = () => myTurn() ? Math.max(0, game.currentBet - pendingHumanPlayer.betThisRound) : 0;
  const quiet = () => typeof motionOff === 'function' && motionOff();

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
    heart(){ tone(58, 0.12, 'sine', 0.45); tone(52, 0.14, 'sine', 0.34, 0.19); },
    tick(n){ tone(300 + n * 70, 0.05, 'square', 0.025); },
    bell(){ tone(1568, 0.8, 'triangle', 0.045); tone(2093, 0.6, 'sine', 0.025, 0.02); },
    spark(){ for (let i = 0; i < 5; i++){ tone(4000 + Math.random() * 3000, 0.02, 'square', 0.015, i * 0.04); } }
  };
  let hum = null;
  function humOn(level){
    if (!on('allinfx') || typeof Sound === 'undefined') return;
    if (!hum) hum = Sound.wheelMotor();
    hum.set(level);
  }
  function humOff(){ if (hum){ hum.stop(); hum = null; } }

  /* ---------- extra parts ---------- */
  function ensureParts(){
    const dock = $id('your-seat-dock');
    if (dock && !dock.querySelector('.do-pilot')){
      dock.insertAdjacentHTML('beforeend',
        '<i class="do-pilot do-pilot-l"></i><i class="do-pilot do-pilot-r"></i>' +
        '<i class="do-beacon do-beacon-l"></i><i class="do-beacon do-beacon-r"></i>' +
        '<div class="do-chase">' + Array.from({ length:30 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</div>');
    }
    const felt = $id('felt');
    if (felt && !felt.querySelector('.do-dim')) felt.insertAdjacentHTML('afterbegin', '<i class="do-dim"></i>');
    const face = document.querySelector('.actions-face-play');
    if (face && !face.querySelector('.do-shutter')){
      face.style.position = 'relative';
      face.insertAdjacentHTML('beforeend', '<div class="do-shutter"><span>WAITING</span></div>');
    }
    const panel = $id('raise-panel');
    if (panel && !panel.querySelector('.do-allin-wrap')){
      panel.insertAdjacentHTML('beforeend', '<div class="do-allin-wrap"><button type="button" class="do-allin-key"><i></i><span>HOLD FOR ALL IN</span></button><button type="button" class="do-cover" aria-label="Lift the all-in cover"></button></div>');
      wireAllIn(panel.querySelector('.do-allin-wrap'));
    }
  }
  function layChase(){
    const dock = $id('your-seat-dock'), host = dock && dock.querySelector('.do-chase'), frame = $id('hud-frame');
    if (!host || !frame) return;
    const r = frame.getBoundingClientRect(), d = dock.getBoundingClientRect();
    const x0 = r.left - d.left + 4, y0 = r.top - d.top + 4, w = r.width - 8, h = r.height - 8, per = 2 * (w + h);
    host.querySelectorAll('i').forEach((lamp, i, all) => {
      let t = i / all.length * per, x, y;
      if (t < w){ x = t; y = 0; } else if ((t -= w) < h){ x = w; y = t; } else if ((t -= h) < w){ x = w - t; y = h; } else { t -= w; x = 0; y = h - t; }
      lamp.style.left = (x0 + x) + 'px'; lamp.style.top = (y0 + y) + 'px';
    });
  }

  /* ---------- layout: move elements into rows, and back ---------- */
  const homes = new Map();
  function remember(el){ if (el && !homes.has(el)) homes.set(el, { parent:el.parentNode, next:el.nextSibling }); }
  function restore(el){
    const h = homes.get(el); if (!h) return;
    if (h.next && h.next.parentNode === h.parent) h.parent.insertBefore(el, h.next); else h.parent.appendChild(el);
  }
  function row(cls){
    const frame = $id('hud-frame');
    let r = frame.querySelector('.' + cls);
    if (!r){ r = document.createElement('div'); r.className = 'do-row ' + cls; frame.appendChild(r); }
    return r;
  }
  function applyLayout(){
    const frame = $id('hud-frame'); if (!frame) return;
    const stack = frame.querySelector('.stack-readout'), bet = frame.querySelector('.bet-this-hand');
    const hand = $id('hand-strength'), banner = $id('banner');
    [stack, bet, hand, banner].forEach(remember);
    [hand, banner, stack, bet].forEach(restore);
    frame.querySelectorAll('.do-row').forEach(r => r.remove());
    const L = order.layout;
    if (L === 'hub'){
      const rs = row('do-row-screens'); rs.appendChild(hand); rs.appendChild(banner);
    }
    if (L === 'rows' || L === 'hub'){
      const rk = row('do-row-stack'); rk.appendChild(stack); rk.appendChild(bet);
    }
    requestAnimationFrame(layChase);
  }

  /* ---------- the order ---------- */
  function apply(next){
    Object.assign(order, next || {});
    const root = document.documentElement;
    Object.keys(order).forEach(k => {
      if (order[k] && order[k] !== '0') root.setAttribute('data-do-' + k, order[k]);
      else root.removeAttribute('data-do-' + k);
    });
    ensureParts();
    applyLayout();
    const key = document.querySelector('.do-allin-key span');
    if (key) key.textContent = order.allin === 'cover' ? 'ALL IN' : 'HOLD FOR ALL IN';
    tick(true);
  }

  /* ---------- the watch loop: turns table state into dashboard state ---------- */
  let last = { handKey:'', board:0, allIn:false, win:false, turn:false };
  function tick(force){
    const dock = $id('your-seat-dock'); if (!dock) return;
    const h = human();
    const turn = myTurn();
    dock.classList.toggle('do-myturn', turn);
    const face = document.querySelector('.actions-face-play');
    if (face) face.classList.toggle('do-waiting', !turn && inHand() && !!h && !h.folded);
    if (turn !== last.turn && on('turn') && typeof Sound !== 'undefined' && !force){
      if (order.turn === 'shutter' || order.turn === 'rise') Sound.consoleShift();
    }
    last.turn = turn;

    // New hand: cards rise, peek resets.
    const handKey = h && h.hand && h.hand.length ? h.hand.map(c => c.rank + c.suit).join() + ':' + (game.handNumber || game.handNum || '') : '';
    if (handKey !== last.handKey){
      last.handKey = handKey;
      if (handKey){
        $id('hud-frame').classList.add('do-unpeeked');
        const seat = document.querySelector('.seat.you');
        if (seat && order.tray === 'rise' && !quiet()){ seat.classList.remove('do-rise'); void seat.offsetWidth; seat.classList.add('do-rise'); setTimeout(() => seat.classList.remove('do-rise'), 900); }
      }
    }

    // All in: yours, or one you're facing.
    const mine = !!(h && h.allIn && inHand() && !h.folded);
    const facing = turn && game.players.some(p => !p.isHuman && p.allIn && !p.folded) && toCall() > 0;
    dock.classList.toggle('do-allin', mine);
    dock.classList.toggle('do-facing', facing);
    $id('table-screen').classList.toggle('do-allin-table', mine && on('allinfx', 'full'));
    if (mine && !last.allIn){
      if (on('allinfx')){
        dock.classList.add('do-allin-hit'); setTimeout(() => dock.classList.remove('do-allin-hit'), 900);
        if (typeof Sound !== 'undefined') Sound.allIn(true);
        humOn(0.45);
      }
    }
    if (!mine && last.allIn) humOff();
    if (mine && on('allinfx', 'full') && game.board.length > last.board){
      voice.heart(); const ts = $id('table-screen'); ts.classList.remove('do-beat'); void ts.offsetWidth; ts.classList.add('do-beat');
      humOn(0.3 + game.board.length * 0.08);
    }
    last.allIn = mine;
    last.board = game && game.board ? game.board.length : 0;

    // Win: lamps chase round the case.
    const win = $id('hud-frame').classList.contains('hud-frame-win-flash');
    if (win && !last.win && on('win')){ dock.classList.add('do-winning'); voice.bell(); layChase(); setTimeout(() => dock.classList.remove('do-winning'), 2600); }
    last.win = win;

    // A fresh run after a bust: the machine is whole again.
    if (h && h.chips > 0){ dock.classList.remove('do-bust-1', 'do-bust-2'); $id('action-area').classList.remove('do-bust-2'); }
  }
  setInterval(tick, 120);

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
    if (typeof Sound !== 'undefined') Sound.cardFlip(false);
    const up = () => { f.classList.remove('do-peeking'); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }, true);

  /* ---------- all in: hold to charge, or lift the cover ---------- */
  function wireAllIn(wrap){
    const key = wrap.querySelector('.do-allin-key'), cover = wrap.querySelector('.do-cover');
    let raf = 0, t0 = 0, ticks = 0, closeTimer = 0;
    const stop = () => { cancelAnimationFrame(raf); key.classList.remove('charging'); key.style.setProperty('--charge', 0); humOffIfIdle(); };
    const commit = () => { stop(); wrap.classList.remove('open'); if (myTurn()) humanAct('allin'); };
    key.addEventListener('pointerdown', e => {
      if (!myTurn()) return;
      if (order.allin === 'cover'){ return; }
      e.preventDefault(); t0 = performance.now(); ticks = 0; key.classList.add('charging');
      if (on('allinfx')) humOn(0.2);
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
    key.addEventListener('click', () => { if (order.allin === 'cover' && wrap.classList.contains('open')) commit(); });
    cover.addEventListener('click', () => {
      if (!myTurn()) return;
      wrap.classList.toggle('open');
      if (typeof Sound !== 'undefined') Sound.buttonPress('key');
      clearTimeout(closeTimer);
      if (wrap.classList.contains('open')){ const d = $id('your-seat-dock'); d.classList.add('do-facing'); closeTimer = setTimeout(() => wrap.classList.remove('open'), 4000); }
    });
  }
  function humOffIfIdle(){ const h = human(); if (!(h && h.allIn)) humOff(); }

  /* ---------- drag chips from the bank to size a bet ---------- */
  document.addEventListener('pointerdown', e => {
    if (!on('drag') || !myTurn()) return;
    const bank = e.target.closest('#hud-left'); if (!bank) return;
    e.preventDefault(); e.stopPropagation();
    const colours = ['d-white', 'd-red', 'd-blue', 'd-black', 'd-green'];
    const chip = document.createElement('i');
    chip.className = 'chip-disc ' + colours[Math.floor(Math.random() * colours.length)] + ' v-' + (1 + Math.floor(Math.random() * 3));
    Object.assign(chip.style, { position:'fixed', zIndex:300, width:'30px', height:'30px', margin:0, pointerEvents:'none', filter:'drop-shadow(0 5px 0 rgba(0,0,0,.4))' });
    document.body.appendChild(chip);
    const move = ev => { chip.style.left = (ev.clientX - 15) + 'px'; chip.style.top = (ev.clientY - 15) + 'px'; };
    move(e);
    if (typeof Sound !== 'undefined') Sound.buttonPress('key');
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      chip.remove();
      const dockTop = $id('your-seat-dock').getBoundingClientRect().top;
      if (ev.clientY >= dockTop || !myTurn()) return;
      const panel = $id('raise-panel');
      if (!panel.classList.contains('show')) $id('btn-raise').click();
      else if (typeof setWagerAmount === 'function'){
        const s = $id('raise-slider');
        setWagerAmount(Number(s.value) + (game.bigBlind || 20));
        if (typeof updateActionControls === 'function') updateActionControls();
      }
      if (typeof Sound !== 'undefined') Sound.chipLand();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }, true);

  /* ---------- bust: before the RUN OVER roll ---------- */
  const sleep = ms => new Promise(r => setTimeout(r, quiet() ? 0 : ms));
  if (typeof rollStageTransition === 'function'){
    const realRoll = rollStageTransition;
    rollStageTransition = async function(){
      const h = human();
      if (h && h.chips <= 0 && on('bust')) await bustSequence();
      return realRoll.apply(this, arguments);
    };
  }
  async function bustSequence(){
    const dock = $id('your-seat-dock'), area = $id('action-area');
    humOff();
    if (typeof Sound !== 'undefined') Sound.busted(true);
    dock.classList.add('do-bust-1');
    sparks($id('jackpot'), 10); voice.spark();
    await sleep(900);
    if (order.bust === 'break'){
      dock.classList.add('do-bust-2'); area.classList.add('do-bust-2');
      if (typeof Sound !== 'undefined'){ Sound.koThunk(1); setTimeout(() => Sound.koThunk(0.7), 220); }
      sparks($id('hud-frame'), 14); smoke($id('hud-frame'));
      await sleep(1500);
    }
  }
  function sparks(el, n){
    if (!el || quiet()) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++){
      const s = document.createElement('i'); s.className = 'do-spark'; s.style.left = cx + 'px'; s.style.top = cy + 'px';
      document.body.appendChild(s);
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 60;
      s.animate([{ transform:'translate(0,0)', opacity:1 }, { transform:'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d + 30) + 'px)', opacity:0 }],
        { duration:450 + Math.random() * 300, easing:'steps(6,end)', fill:'forwards' }).onfinish = () => s.remove();
    }
  }
  function smoke(el){
    if (!el || quiet()) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 6; i++){
      const s = document.createElement('i'); s.className = 'do-smoke';
      s.style.left = (r.left + 20 + Math.random() * (r.width - 40)) + 'px'; s.style.top = (r.top + 10) + 'px';
      document.body.appendChild(s);
      s.animate([{ transform:'translateY(0) scale(.6)', opacity:0 }, { opacity:.9, offset:.2 }, { transform:'translate(14px,-110px) scale(2.2)', opacity:0 }],
        { duration:2200, delay:i * 180, easing:'steps(10,end)', fill:'forwards' }).onfinish = () => s.remove();
    }
  }

  window.addEventListener('resize', () => requestAnimationFrame(layChase));
  window.DashOrder = { apply, get order(){ return Object.assign({}, order); } };
})();
