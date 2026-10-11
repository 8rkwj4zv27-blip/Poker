"use strict";

/* ============================================================
   KNOCK TO CHECK (live v0.48.0, shipped with the action drum; tried in
   action-drum-lab.html round 3)

   The owner's Dashboard V2 order (docs/ui/PATTERN_BOOK.md, Dashboard V2 →
   Behaviours; DASHBOARD_V2_HANDOVER.md, "What the owner liked" 1): double-
   tap the dashboard case to check, like knocking on a real table. Two
   thuds, a ring where you knocked, and the whole machine (dashboard and
   key bay together, never the case alone) jolts. Facing a bet it refuses
   with a buzz and CAN'T KNOCK on the screen. The keys still work as ever.

   Ported from the order form's knock (js/dashboard-order.js). The check
   itself is the game's own humanAct('check'); nothing else is touched.
   The bank (tap to tidy), your cards and any key are not the case.
   ============================================================ */
(() => {
  const $id = id => document.getElementById(id);
  const myTurn = () => typeof pendingHumanPlayer !== 'undefined' && !!pendingHumanPlayer &&
    !!$id('actions-row') && !$id('actions-row').classList.contains('disabled') &&
    !($id('console-flip') && $id('console-flip').classList.contains('flipped'));
  const toCall = () => myTurn() ? Math.max(0, game.currentBet - pendingHumanPlayer.betThisRound) : 0;
  const still = () => typeof motionOff === 'function' && motionOff();

  /* ---- its two voices: the knock and the refusal ---- */
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
  const knockSound = () => { thud(0.5); thud(0.45, 0.15); };
  const buzz = () => { tone(150, 0.12, 'square', 0.04); tone(110, 0.16, 'square', 0.04, 0.1); };

  /* ---- the double tap ---- */
  let lastTap = 0, lx = 0, ly = 0;
  document.addEventListener('pointerdown', e => {
    const dock = $id('your-seat-dock');
    if (!dock || !dock.contains(e.target) || e.target.closest('button,.seat.you .seat-cards,#hud-left')) return;
    const now = performance.now();
    if (now - lastTap < 340 && Math.hypot(e.clientX - lx, e.clientY - ly) < 50){ lastTap = 0; knock(e, dock); }
    else { lastTap = now; lx = e.clientX; ly = e.clientY; }
  }, true);

  function jolt(){
    if (still()) return;
    ['your-seat-dock', 'action-area'].forEach(id => {
      const el = $id(id); if (!el) return;
      el.classList.remove('kc-jolt'); void el.offsetWidth; el.classList.add('kc-jolt');
    });
  }
  function knock(e, dock){
    const r = dock.getBoundingClientRect();
    [0, 150].forEach(t => setTimeout(() => {
      if (!still()){
        const ring = document.createElement('i'); ring.className = 'kc-ring';
        ring.style.left = (e.clientX - r.left) + 'px'; ring.style.top = (e.clientY - r.top) + 'px';
        dock.appendChild(ring); setTimeout(() => ring.remove(), 500);
      }
      jolt();
    }, t));
    knockSound();
    if (!myTurn()) return;
    if (toCall() > 0){
      setTimeout(() => {
        buzz();
        const f = $id('hud-frame');
        if (f){ f.classList.remove('kc-deny'); void f.offsetWidth; f.classList.add('kc-deny'); }
        if (typeof paintActionRows === 'function') paintActionRows('CAN\'T KNOCK', toCall() + ' TO CALL', false);
        setTimeout(() => { if (f) f.classList.remove('kc-deny'); if (typeof updateActionControls === 'function') updateActionControls(); }, 1300);
      }, 320);
      return;
    }
    setTimeout(() => { if (myTurn() && toCall() === 0) humanAct('check'); }, 330);
  }
})();
