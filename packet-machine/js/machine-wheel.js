"use strict";

/* ============================================================
   MACHINE WHEEL V2 — candidate replacement for the three screen-change
   rolls (table <-> results stage, Home -> Career, Career -> table).

   STATUS: live. index.html loads this right after career-motion-live.js
   and the last line installs V2 over the three V1 functions, which stay
   in place only so wheel-v2-lab.html can still switch back to compare.
   The defaults below are the owner's picks from that lab (2026-09-24):
   FULL machinery, bolts off, 3px grain, standard weight, high overshoot,
   hum on. Nothing here
   reads or writes poker, Career or save state — every V2 function keeps
   its V1 counterpart's contract, guards and call order exactly, and only
   the presentation between those calls differs.

   WHAT CHANGED FROM V1
   - One engine. V1 was three hand-tuned copies (CSS keyframes, CSS
     transitions, fixed sleeps) that had drifted apart. V2 drives a single
     drum position per frame; faces, hinges, rails, pawl, shading, ratchet
     audio and bearing hum are all read from that one number, so the
     sound can never run ahead of or behind the picture.
   - Weight. Latch release, a short wind-up against the pawl, spin-up,
     long braking, coasting past the last tooth, the pawl catching it,
     a damped settle back into the detent, then the lock.
   - Visible ratchet. The drum dwells on every tooth in proportion to how
     slowly it's turning, and the click fires on that dwell.
   - Pixel-honest. No scaling and no CSS filter. Every moving part snaps
     to a pixel grid, shading moves in fixed steps and is an opacity
     layer — cheap on iOS, and no re-rasterised shimmer (see the
     2026-09-24 ticket-shimmer fix in docs/career/HISTORY.md).
   ============================================================ */

const MACHINE_WHEEL_CONFIG = {
  machinery: 'full',  // 'clean' | 'rim' | 'full' — how much mechanism shows
  bolts: false,       // latch bolts shoot in at the lock
  grain: 3,           // px; every moving part snaps to this grid
  shadeSteps: 6,      // shading quantisation
  hum: true,          // bearing hum under the ratchet
  timeScale: 1,       // lab slow-motion only (0.25 = quarter speed)
  durationScale: 1,   // lab tuning: stretches wind-up, roll and settle
  overshootScale: 1.6, // how far the drum coasts past its tooth (lab 'HIGH')
  stutter: .72,       // 0..<1: how hard the drum catches on each tooth at low speed
  ease: [.5, 0, .2, 1], // spin-up then a long brake to a dead stop at the overshoot peak
  gap: { clean: 22, rim: 22, full: 40 },
  profiles: {
    // live table -> TABLE CLEARED / RUN OVER / EVENT result
    stage:      { releaseMs: 250, windupMs: 170, windup: .02,  rollMs: 1200, overshoot: .036, settleMs: 380, teeth: 14, flicker: 'soft',  lights: false },
    // results -> next table: same mechanism, a little brisker (player asked for it)
    stageBrisk: { releaseMs: 210, windupMs: 150, windup: .018, rollMs: 1060, overshoot: .032, settleMs: 340, teeth: 14, flicker: 'soft',  lights: false },
    // Home -> Career
    career:     { releaseMs: 300, windupMs: 190, windup: .018, rollMs: 1420, overshoot: .03,  settleMs: 400, teeth: 16, flicker: 'power', lights: true },
    // Career -> table
    table:      { releaseMs: 280, windupMs: 180, windup: .018, rollMs: 1300, overshoot: .03,  settleMs: 380, teeth: 14, flicker: 'power', lights: true },
    // Going back (Career -> Home, results -> Career, Leave table): the same
    // drum turned the other way, brisker, since the player is leaving
    back:       { releaseMs: 150, windupMs: 120, windup: .014, rollMs: 620,  overshoot: .026, settleMs: 260, teeth: 10, flicker: 'soft',  lights: false }
  }
};

/* Cubic-bezier timing function: Newton steps with a bisection fallback. */
function mwBezier(x1, y1, x2, y2){
  const cx = 3*x1, bx = 3*(x2-x1) - cx, ax = 1 - cx - bx;
  const cy = 3*y1, by = 3*(y2-y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax*t + bx)*t + cx)*t;
  const Y = t => ((ay*t + by)*t + cy)*t;
  const dX = t => (3*ax*t + 2*bx)*t + cx;
  return s => {
    if (s <= 0) return 0;
    if (s >= 1) return 1;
    let t = s;
    for (let i = 0; i < 8; i++){
      const e = X(t) - s, d = dX(t);
      if (Math.abs(e) < 1e-6) return Y(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = s;
    for (let i = 0; i < 24; i++){
      const v = X(t);
      if (Math.abs(v - s) < 1e-6) break;
      if (v < s) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return Y(t);
  };
}

/* The rig: everything the wheel adds to a host for one roll, plus the
   motion. `host` must be positioned and exactly contain the faces
   (#stage-bay around #felt, or #app around its screens). */
function machineWheelRig(host, options){
  const cfg = MACHINE_WHEEL_CONFIG;
  const opts = options || {};
  const z = opts.z || { back: 1, face: 3, front: 30 };
  const mode = ['clean','rim','full'].includes(cfg.machinery) ? cfg.machinery : 'rim';
  const gap = cfg.gap[mode] || 22;
  const snap = px => { const g = Math.max(1, cfg.grain|0); return Math.round(px / g) * g; };
  const quant = v => { const s = Math.max(2, cfg.shadeSteps|0); return Math.round(Math.max(0, Math.min(1, v)) * s) / s; };
  const sound = typeof Sound !== 'undefined' ? Sound : null;
  const buzz = p => { if (typeof haptic === 'function') haptic(p); };

  let hurried = false, destroyed = false, raf = 0, motor = null, lastRailY = 0;
  const timers = new Set();
  const claimed = new Map();   // face -> { shade, power, y, saved }

  host.classList.add('mw-host');
  const H = host.clientHeight;
  const T = H + gap;

  const back = document.createElement('div');
  back.className = 'mw-back is-' + mode;
  back.setAttribute('aria-hidden', 'true');
  back.style.zIndex = z.back;
  host.appendChild(back);

  const front = document.createElement('div');
  front.className = 'mw-front is-' + mode + (cfg.bolts ? ' has-bolts' : '');
  front.setAttribute('aria-hidden', 'true');
  front.style.zIndex = z.front;
  front.style.setProperty('--mw-gap', gap + 'px');
  const jointHTML = mode === 'full'
    ? '<div class="mw-joint is-open"><i class="mw-joint-rail"></i><span class="mw-gear"><span class="mw-gear-teeth"></span><b></b><b></b></span><i class="mw-joint-rail"></i></div>'
    : '<div class="mw-joint"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  front.innerHTML =
    '<div class="mw-shades"></div>' +
    jointHTML + jointHTML + jointHTML +
    '<div class="mw-bands"></div><div class="mw-glint"></div>' +
    (mode !== 'clean' ? '<div class="mw-rail is-left"><span></span></div><div class="mw-rail is-right"><span></span></div>' : '') +
    '<div class="mw-lip is-top">' + (mode !== 'clean' ? '<span class="mw-pawl"></span>' : '') + '</div>' +
    '<div class="mw-lip is-bottom"></div>' +
    '<div class="mw-bolt is-left"><span></span></div><div class="mw-bolt is-right"><span></span></div>';
  host.appendChild(front);
  const shadeBox = front.querySelector('.mw-shades');
  const joints = Array.from(front.querySelectorAll('.mw-joint'));
  const gears = Array.from(front.querySelectorAll('.mw-gear-teeth'));
  const rails = Array.from(front.querySelectorAll('.mw-rail span'));
  const glint = front.querySelector('.mw-glint');
  const pawl = front.querySelector('.mw-pawl');

  function later(fn, ms){
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }
  function wait(ms){
    const scale = Math.max(.05, cfg.timeScale || 1) * (hurried ? 4 : 1);
    return new Promise(resolve => later(resolve, Math.max(0, ms / scale)));
  }

  function paint(face){
    const c = claimed.get(face);
    if (!c) return;
    const t = 'translate3d(0,' + c.y + 'px,0)';
    face.style.transform = t;
    c.shade.style.transform = t;
    // A face turned away from the viewer is darker; power is its lamp state.
    const turned = Math.min(1, Math.abs(c.y) / T) * .5;
    c.shade.style.opacity = quant(c.power + turned);
  }
  function claim(face, power){
    if (claimed.has(face)) { setPower(face, power); return; }
    const shade = document.createElement('div');
    shade.className = 'mw-shade';
    shade.style.borderRadius = getComputedStyle(face).borderRadius;
    shadeBox.appendChild(shade);
    claimed.set(face, {
      shade, power: power || 0, y: 0,
      saved: { transform: face.style.transform, zIndex: face.style.zIndex, willChange: face.style.willChange }
    });
    face.style.zIndex = z.face;
    face.style.willChange = 'transform';
    paint(face);
  }
  function place(face, y){
    const c = claimed.get(face);
    if (!c) return;
    c.y = y;
    paint(face);
  }
  function setPower(face, power){
    const c = claimed.get(face);
    if (!c) return;
    c.power = power;
    paint(face);
  }
  function powerOf(face){
    const c = claimed.get(face);
    return c ? c.power : 0;
  }
  function kickPawl(){
    if (!pawl) return;
    pawl.classList.add('is-kick');
    later(() => pawl.classList.remove('is-kick'), 55);
  }
  function thump(){
    try{
      host.animate([
        { translate: '0 0', easing: 'steps(1,end)' },
        { translate: '0 3px', easing: 'steps(1,end)' },
        { translate: '0 -1px', easing: 'steps(1,end)' },
        { translate: '0 0' }
      ], { duration: 150 / Math.max(.05, cfg.timeScale || 1) });
    } catch(e){}
  }
  function flash(){
    front.classList.add('is-flash');
    later(() => front.classList.remove('is-flash'), 110 / Math.max(.05, cfg.timeScale || 1));
  }
  function drawMachinery(yOut, yIn){
    // Three hinges: above the upper face, between the two, below the lower
    // one (the incoming face is above when rolling down, below going back).
    const top = Math.min(yOut, yIn), bottom = Math.max(yOut, yIn);
    const ys = [top - gap, bottom - gap, bottom + H];
    joints.forEach((j, i) => { j.style.transform = 'translate3d(0,' + ys[i] + 'px,0)'; });
    // Knurled side rails turn with the drum; the gear inside an open hinge
    // sits nearer the axle, so it travels slower (parallax).
    const railY = ((yOut % 12) + 12) % 12;
    if (railY !== lastRailY){
      rails.forEach(r => { r.style.transform = 'translate3d(0,' + railY + 'px,0)'; });
      lastRailY = railY;
    }
    const gearY = snap((((yOut * .6) % 10) + 10) % 10);
    gears.forEach(g => { g.style.transform = 'translate3d(0,' + gearY + 'px,0)'; });
  }

  return {
    get travel(){ return T; },
    claim, place, setPower, powerOf,
    hurry(){ hurried = true; },
    get hurried(){ return hurried; },
    wait,

    /* Parks a face one position up the drum (down it, for dir -1), ready
       to be revealed. Call before the face becomes visible so it never
       flashes in place. */
    park(face, power, dir = 1){
      claim(face, power);
      place(face, -dir * T);
      drawMachinery(0, -dir * T);
    },

    /* The face powers down, the cabinet lips close over its edges and the
       latch lets go. */
    async release(face, profile, dir = 1){
      claim(face, powerOf(face));
      drawMachinery(0, -dir * T);
      if (sound) sound.wheelRelease();
      buzz([18, 12, 26]);
      front.classList.add('is-engaged');
      const steps = profile.flicker === 'power' ? [.5, .12, .62, .2, .55, .42] : [.16, .06, .26, .22];
      const per = profile.releaseMs / steps.length;
      for (const s of steps){
        if (destroyed) return;
        setPower(face, s);
        await wait(per);
      }
    },

    /* Wind-up, drive, coast, catch, settle. Resolves once the incoming
       face sits exactly in its detent. dir 1 turns the drum down (the new
       face arrives from above); -1 turns it back up. */
    roll(outgoing, incoming, profile, dir = 1){
      const p = profile;
      const ds = Math.max(.25, cfg.durationScale || 1);
      const os = Math.max(0, cfg.overshootScale == null ? 1 : cfg.overshootScale);
      const W = p.windupMs * ds, R = p.rollMs * ds, S = p.settleMs * ds;
      const w = p.windup, o = p.overshoot * os, N = Math.max(2, p.teeth|0);
      const ease = mwBezier.apply(null, cfg.ease);
      let peakSlope = 0;
      for (let i = 1; i <= 240; i++) peakSlope = Math.max(peakSlope, (ease(i/240) - ease((i-1)/240)) * 240);
      claim(outgoing, powerOf(outgoing));
      claim(incoming, powerOf(incoming));
      front.classList.add('is-rolling');
      motor = cfg.hum && sound ? sound.wheelMotor() : null;
      return new Promise(resolve => {
        let t = 0, last = 0, tooth = 0, caught = false, above = true;
        const finish = () => {
          raf = 0;
          if (motor){ motor.stop(); motor = null; }
          place(outgoing, dir * snap(T));
          place(incoming, 0);
          drawMachinery(dir * snap(T), 0);
          glint.style.opacity = 0;
          resolve();
        };
        const frame = now => {
          if (destroyed){ resolve(); return; }
          const dt = last ? Math.min(50, now - last) : 16;
          last = now;
          t += dt * Math.max(.05, cfg.timeScale || 1) * (hurried ? 4 : 1);
          let x, speed = 0;
          if (t < W){
            // Wind-up: the drum rocks back against the pawl before it goes.
            const s = t / W;
            x = -w * (1 - (1 - s) * (1 - s));
          } else if (t < W + R){
            const s = (t - W) / R;
            const e = ease(s);
            x = -w + (1 + o + w) * e;
            speed = Math.min(1, ((ease(Math.min(1, s + .004)) - e) / .004) / peakSlope);
            const u = x * N;
            while (tooth < N && u >= tooth + 1){
              tooth++;
              if (sound) sound.wheelTooth(speed, tooth === N);
              kickPawl();
              if (tooth === N) buzz(10);
            }
            // The drum dwells on each tooth in proportion to how slowly
            // it's turning; the click above fires on that dwell. Monotonic
            // for any stutter < 1.
            if (u > 0 && u < N){
              const k = cfg.stutter * Math.pow(1 - speed, 1.2);
              const fl = Math.floor(u), fr = u - fl;
              x = (fl + fr - k * Math.sin(2 * Math.PI * fr) / (2 * Math.PI)) / N;
            }
          } else if (t < W + R + S){
            // Coasted past the last tooth: the pawl catches and the drum
            // settles back into the detent with a damped bounce.
            if (!caught){ caught = true; if (sound) sound.wheelCatch(); }
            const s = (t - W - R) / S;
            x = 1 + o * Math.exp(-3.6 * s) * Math.cos(Math.PI * 3 * s);
            const nowAbove = x > 1;
            if (above && !nowAbove && sound) sound.wheelBackTick();
            above = nowAbove;
          } else {
            finish();
            return;
          }
          if (motor) motor.set(speed);
          const yOut = dir * snap(x * T);
          place(outgoing, yOut);
          place(incoming, yOut - dir * T);
          drawMachinery(yOut, yOut - dir * T);
          glint.style.opacity = quant(speed * .55);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      });
    },

    /* Bolts, CLUNK, then the face comes up to full power — in stepped
       house lights for a whole-screen arrival, in two quick steps for the
       table stage. */
    async lock(face, profile){
      front.classList.remove('is-rolling');
      if (cfg.bolts){
        front.classList.add('is-bolted');
        if (sound) sound.wheelBolt();
        await wait(80);
      }
      if (destroyed) return;
      if (sound) sound.wheelLock();
      buzz([12, 22, 38]);
      thump();
      flash();
      await wait(130);
      const steps = profile.lights
        ? [[.36, 1], [.58, 0], [.22, .8], [.12, 0], [0, .6]]
        : [[powerOf(face) * .5, 0], [0, 0]];
      for (const [power, relay] of steps){
        if (destroyed) return;
        setPower(face, power);
        if (relay && sound) sound.wheelRelay(relay);
        await wait(profile.lights ? 72 : 55);
      }
      front.classList.remove('is-engaged', 'is-bolted');
      await wait(130);
    },

    /* Removes everything the rig added and hands every face back exactly
       as it found it. Safe to call more than once. */
    destroy(){
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (motor){ motor.stop(); motor = null; }
      timers.forEach(id => clearTimeout(id));
      timers.clear();
      claimed.forEach((c, face) => {
        face.style.transform = c.saved.transform;
        face.style.zIndex = c.saved.zIndex;
        face.style.willChange = c.saved.willChange;
      });
      claimed.clear();
      back.remove();
      front.remove();
      try{ host.getAnimations().forEach(a => a.cancel()); } catch(e){}
      host.classList.remove('mw-host');
    }
  };
}

/* ---- V2 of rollStageTransition() (06-presentation.js) ----
   Same contract: the outgoing content is a disposable id-stripped clone,
   populateFn mutates the real #felt in place (after its class is reset to
   bare 'felt'), and nothing is left in control of the table afterwards. */
async function rollStageTransitionV2(populateFn, options){
  const felt = $('felt'), bay = $('stage-bay');
  if (!felt || !bay){ populateFn(felt); return; }
  const opts = options || {};
  if (motionOff()){
    felt.className = 'felt';
    populateFn(felt);
    return;
  }
  const profile = opts.brisk ? MACHINE_WHEEL_CONFIG.profiles.stageBrisk : MACHINE_WHEEL_CONFIG.profiles.stage;
  // Clear anything a background-interrupted V1 or V2 roll might have left.
  bay.querySelectorAll('.stage-outgoing,.mw-back,.mw-front').forEach(el => el.remove());
  const rig = machineWheelRig(bay, { z: { back: 1, face: 3, front: 30 } });
  let clone = null;
  try{
    rig.claim(felt, 0);
    await rig.release(felt, profile);

    clone = felt.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.add('stage-outgoing');
    bay.insertBefore(clone, felt);
    rig.claim(clone, rig.powerOf(felt));
    rig.park(felt, .24);

    felt.className = 'felt';
    populateFn(felt);

    await rig.roll(clone, felt, profile);
    clone.remove(); clone = null;
    await rig.lock(felt, profile);
  } finally {
    if (clone) clone.remove();
    rig.destroy();
  }
}

/* ---- V2 of enterCareerFromHome() (career-motion-live.js) ----
   Shares V1's in-flight flag and reset so the two can never overlap. */
async function enterCareerFromHomeV2(){
  const app = $('app'), home = $('home'), career = $('career'), key = $('open-career');
  if (!app || !home || !career || !key || home.classList.contains('hidden')) { showCareerScreen(); return; }
  if (careerEntranceInFlight) return;
  if (motionOff()){ showCareerScreen(); return; }
  careerEntranceInFlight = true;
  key.disabled = true;
  home.inert = true;
  key.classList.add('career-entry-pressed');
  // press-feel.js plays the clunk on finger-down; only a key/programmatic
  // press still needs it here.
  if (typeof pressFeelSounded !== 'function' || !pressFeelSounded(key)) Sound.buttonPress('allin');
  haptic([25, 18, 42]);
  const profile = MACHINE_WHEEL_CONFIG.profiles.career;
  let rig = null;
  try{
    rig = machineWheelRig(app, { z: { back: 47, face: 50, front: 56 } });
    rig.claim(home, 0);
    await rig.release(home, profile);

    // Mount the real Career screen, parked above and dark, before it can
    // paint. No snapshot of money or event state stands in for the reader.
    rig.park(career, .72);
    showCareerScreen({ keepHomeVisible: true });
    career.inert = true;
    career.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    await rig.roll(home, career, profile);
    await rig.lock(career, profile);
    home.classList.add('hidden');
  } catch (error){
    console.error('Career entrance failed; opening the Career screen directly.', error);
    showCareerScreen();
  } finally{
    if (rig) rig.destroy();
    resetCareerEntrance();
  }
}

/* ---- V2 of careerDepartToTable() (career-motion-live.js) ----
   Identical build/deal choreography to V1: launch() builds the table under
   cover of the roll with its first deal held until the lights are up. A
   tap no longer jumps; it throws the drum round hard to its stop. */
async function careerDepartToTableV2(launch, options = {}){
  const app = $('app'), careerScreen = $('career'), table = $('table-screen');
  if (!app || !careerScreen || !table || motionOff() || careerScreen.classList.contains('hidden')){
    launch();
    return;
  }
  if (tableEntranceInFlight) return;
  tableEntranceInFlight = true;
  const profile = MACHINE_WHEEL_CONFIG.profiles.table;
  let built = false, dealArgs = null, dealt = false, rig = null, skipped = false;
  const realStartNewHand = startNewHand;
  const skip = event => {
    if (skipped || !built || !rig) return;
    event.preventDefault();
    skipped = true;
    rig.hurry();
    swallowNextClick();
  };
  const build = () => {
    if (built) return;
    built = true;
    startNewHand = (...args) => { dealArgs = args; };
    try { launch(); } finally { startNewHand = realStartNewHand; }
    if (!dealArgs) dealt = true;
  };
  const deal = () => {
    if (dealt) return;
    dealt = true;
    realStartNewHand(...dealArgs);
  };
  app.addEventListener('pointerdown', skip, true);
  try{
    careerScreen.inert = true;
    Sound.buttonPress('allin');
    haptic([22, 16, 34]);
    rig = machineWheelRig(app, { z: { back: 47, face: 50, front: 56 } });
    rig.claim(careerScreen, 0);
    await rig.release(careerScreen, profile);

    rig.park(table, .72);
    build();
    if (table.classList.contains('hidden')){
      // The launch refused (stale state). Nothing was seated; stay put.
      return;
    }
    // showTableScreen() hid the reader; it rides the wheel out regardless.
    careerScreen.classList.remove('hidden');
    table.inert = true;
    table.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    await rig.roll(careerScreen, table, profile);
    careerScreen.classList.add('hidden');
    await rig.lock(table, profile);
    if (!skipped){ Sound.consoleShift(); careerTableCallout(options.callout); }
  } catch (error){
    console.error('Table entrance failed; opening the table directly.', error);
    build();
  } finally{
    if (rig) rig.destroy();
    app.removeEventListener('pointerdown', skip, true);
    careerScreen.inert = false;
    table.inert = false;
    if (built && !table.classList.contains('hidden')) careerScreen.classList.add('hidden');
    tableEntranceInFlight = false;
    if (built) deal();
  }
}

/* ---- Going back: the drum turned the other way ----
   reveal() makes the destination visible and current WITHOUT hiding the
   screen being left; settle() is the real state change (it hides what is
   left, tears the table down, etc.) and runs once the drum has turned, so
   the outgoing face rides away exactly as the player left it. A tap
   throws the drum round to its stop. Reduced Motion, a missing screen or
   a roll already in flight just runs both at once. */
let machineWheelBackInFlight = false;
async function machineWheelBack(fromEl, toEl, reveal, settle){
  const app = $('app');
  const plain = () => { reveal(); settle(); };
  if (!app || !fromEl || !toEl || motionOff() || fromEl.classList.contains('hidden')){ plain(); return; }
  if (machineWheelBackInFlight || careerEntranceInFlight || tableEntranceInFlight){ plain(); return; }
  machineWheelBackInFlight = true;
  const profile = MACHINE_WHEEL_CONFIG.profiles.back;
  let rig = null, revealed = false, settled = false;
  const skip = event => { if (!rig) return; event.preventDefault(); rig.hurry(); swallowNextClick(); };
  app.addEventListener('pointerdown', skip, true);
  try{
    fromEl.inert = true;
    rig = machineWheelRig(app, { z: { back: 47, face: 50, front: 56 } });
    rig.claim(fromEl, 0);
    await rig.release(fromEl, profile, -1);
    rig.park(toEl, .6, -1);
    reveal(); revealed = true;
    fromEl.classList.remove('hidden');
    toEl.inert = true;
    toEl.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await rig.roll(fromEl, toEl, profile, -1);
    settled = true; settle();
    fromEl.classList.add('hidden');
    await rig.lock(toEl, profile);
  } catch (error){
    console.error('Back roll failed; changing screens directly.', error);
  } finally{
    if (rig) rig.destroy();
    app.removeEventListener('pointerdown', skip, true);
    fromEl.inert = false;
    toEl.inert = false;
    if (!revealed) reveal();
    if (!settled){ settled = true; settle(); }
    machineWheelBackInFlight = false;
  }
}

/* Swaps the three live transitions between V1 and V2. Every caller looks
   these globals up by name at call time, so reassigning them is enough. */
const MachineWheel = (() => {
  const v1 = {
    rollStageTransition: typeof rollStageTransition === 'function' ? rollStageTransition : null,
    enterCareerFromHome: typeof enterCareerFromHome === 'function' ? enterCareerFromHome : null,
    careerDepartToTable: typeof careerDepartToTable === 'function' ? careerDepartToTable : null
  };
  let installed = false;
  return {
    config: MACHINE_WHEEL_CONFIG,
    rig: machineWheelRig,
    get installed(){ return installed; },
    install(){
      rollStageTransition = rollStageTransitionV2;
      enterCareerFromHome = enterCareerFromHomeV2;
      careerDepartToTable = careerDepartToTableV2;
      installed = true;
    },
    uninstall(){
      if (v1.rollStageTransition) rollStageTransition = v1.rollStageTransition;
      if (v1.enterCareerFromHome) enterCareerFromHome = v1.enterCareerFromHome;
      if (v1.careerDepartToTable) careerDepartToTable = v1.careerDepartToTable;
      installed = false;
    }
  };
})();

MachineWheel.install();
