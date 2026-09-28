"use strict";

/* ============================================================
   DEAL STYLES (candidate, Deal Style Lab) — how a card flies off the deck

   Round 4. Every card the dealer deck deals (yours, theirs, the board)
   flies along a PATH (js/dealer-deck.js fly(): points [offset, travel,
   lift, turn, pitch, extraScale, easing, lateralCurve]) and, in the deck's
   SPRITE mode (2.5D, like the chips), holds a POSE that steps while it
   glides: { bank, pitch, spin, light, alpha, show }. Bank and pitch stay
   gentle: the card leans and tips like a thrown card reacting to the air,
   never far enough to show its thickness, never over.

   Tiers, weights in the mix: COMMON 10 · UNCOMMON 4 · RARE 1 · EPIC .4 ·
   LEGENDARY .12. EACH HAND: one common/uncommon style for the whole
   hand; EVERY CARD: each card rolls. Rare, epic and legendary styles are
   never a whole hand: any single card can roll one, as a surprise.

   Presentation only: nothing in the game changes; the cards land where
   they always do. The specials' light and smoke are pixel bits (css/
   deal-styles.css); their sounds are made here with Web Audio (no files).
   Only the Lab loads this (deal-style-lab.html).
   ============================================================ */
const DealStyles = (() => {
  const P = (o, t, l, z, x, s, e, c) => [o, t, l, z || 0, x || 0, s || 1, e || null, c || 0];
  const IN = 'cubic-bezier(.5,0,.9,.6)', OUT = 'cubic-bezier(.2,.7,.3,1)', SOFT = 'cubic-bezier(.3,0,.7,1)';
  const WEIGHT = { common:10, uncommon:4, rare:1, epic:.4, legendary:.12 };
  const SOLO = { rare:true, epic:true, legendary:true };
  const TIERS = ['common','uncommon','rare','epic','legendary'];
  const S = Math.sin, C = Math.cos, PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const bell = (t, a, b) => t <= a || t >= b ? 0 : S(PI * (t - a) / (b - a));
  const ramp = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  /* ---------------- sound: small Web Audio voices ---------------- */
  const Sfx = (() => {
    let ctx = null;
    const on = () => { try{ return settings.sound !== false; }catch(e){ return true; } };
    function ac(){
      if (!on()) return null;
      if (!ctx){ try{ const A = window.AudioContext || window.webkitAudioContext; ctx = A ? new A() : null; }catch(e){ ctx = null; } }
      if (ctx && ctx.state === 'suspended') try{ ctx.resume(); }catch(e){}
      return ctx;
    }
    function tone(f0, f1, dur, type, vol, when){
      const c = ac(); if (!c) return;
      const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .05, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
    }
    function noise(dur, vol, f0, f1, when, q){
      const c = ac(); if (!c) return;
      const t = c.currentTime + (when || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.Q.value = q || 1.2;
      f.frequency.setValueAtTime(f0 || 1200, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1 || f0 || 1200), t + dur);
      g.gain.setValueAtTime(vol || .05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + .02);
    }
    return {
      unlock: ac,
      whoosh(ms){ noise(ms / 1000, .045, 500, 2600, 0, .8); },
      thunk(){ tone(140, 55, .16, 'square', .06); noise(.08, .05, 900, 300); },
      poof(){ noise(.35, .05, 2200, 400, 0, .6); tone(900, 1500, .12, 'sine', .02, .05); },
      chirp(){ for (let i = 0; i < 4; i++) tone(600 + Math.random() * 1400, 300 + Math.random() * 900, .04, 'square', .025, i * .05); },
      shimmer(ms){ const n = Math.max(4, Math.round(ms / 70)); for (let i = 0; i < n; i++) tone(1200 + i * 90, 1400 + i * 110, .09, 'sine', .018, i * .06); },
      fire(ms){ noise(ms / 1000, .04, 300, 900, 0, .5); },
      charge(ms){ tone(180, 2400, ms / 1000, 'sawtooth', .03); },
      crack(){ noise(.25, .09, 5000, 200, 0, .4); tone(90, 40, .3, 'sine', .08); },
      fanfare(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .22, 'triangle', .04, i * .09)); },
      chime(){ [1568, 2093, 2637].forEach((f, i) => tone(f, f * .99, .5, 'sine', .03, i * .07)); }
    };
  })();

  /* ---------------- pixel bits ---------------- */
  function bit(cls, x, y, css){
    const s = document.createElement('i');
    s.className = 'dsx ' + cls;
    s.style.left = Math.round(x) + 'px'; s.style.top = Math.round(y) + 'px';
    if (css) Object.keys(css).forEach(k => s.style.setProperty(k, css[k]));
    document.body.appendChild(s);
    return s;
  }
  function burst(cls, x, y, n, life, spread){
    for (let i = 0; i < n; i++){
      const s = bit(cls, x, y, { '--dx':((Math.random() - .5) * (spread || 30)).toFixed(1) + 'px', '--dy':((Math.random() - .7) * (spread || 30)).toFixed(1) + 'px' });
      setTimeout(() => s.remove(), life || 600);
    }
  }
  const center = r => [r.left + r.width / 2, r.top + r.height / 2];
  // run fn(k, rect) about every `every` ms between k=a and k=b of the flight
  function during(ctx, dur, a, b, every, fn){
    const t0 = performance.now();
    const tick = () => {
      if (!ctx.ghost.isConnected) return;
      const k = (performance.now() - t0) / dur;
      if (k >= a && k <= b) fn(k, ctx.ghost.getBoundingClientRect());
      if (k < b) setTimeout(tick, every);
    };
    tick();
  }
  const at = (dur, k, fn) => setTimeout(fn, dur * k);
  function shake(el, cls){ if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 420); }
  function jolt(ctx){
    const t = ctx.toEl;
    const seat = t && t.closest && (t.closest('.seat.ec-seat') || t.closest('#your-seat-dock'));
    shake(seat ? (seat.querySelector('.seat-card') || seat) : document.getElementById('felt'), 'dsx-jolt');
  }

  /* ---------------- the specials' dressing ---------------- */
  const FX = {
    shuriken(skin, anim, dur, ctx){
      Sfx.whoosh(dur * .9);
      during(ctx, dur, .05, .9, 30, (k, r) => {
        const [x, y] = center(r);
        const s = bit('dsx-speed', x, y, { '--a':(Math.atan2(ctx.to.top - ctx.from.top, ctx.to.left - ctx.from.left) * 180 / PI).toFixed(0) + 'deg' });
        setTimeout(() => s.remove(), 220);
      });
      at(dur, .96, () => { Sfx.thunk(); jolt(ctx); });
    },
    magician(skin, anim, dur, ctx){
      at(dur, .08, () => { const [x, y] = center(ctx.from); burst('dsx-smoke', x, y, 9, 700, 34); Sfx.poof(); });
      at(dur, .76, () => { const [x, y] = center(ctx.to); burst('dsx-smoke', x, y, 11, 700, 40); burst('dsx-star', x, y - 6, 5, 600, 44); Sfx.poof(); });
    },
    glitch(skin, anim, dur, ctx){
      ctx.ghost.classList.add('dsx-glitching');
      [0, .22, .44, .66, .86].forEach(k => at(dur, k, () => { Sfx.chirp(); const r = ctx.ghost.getBoundingClientRect(); const s = bit('dsx-tear', r.left - 6, r.top + r.height * Math.random(), { width:(r.width + 12) + 'px' }); setTimeout(() => s.remove(), 120); }));
    },
    transporter(skin, anim, dur, ctx){
      ctx.ghost.classList.add('dsx-beamed');
      const column = (r, k0, k1) => during(ctx, dur, k0, k1, 40, () => {
        const s = bit('dsx-shimmer', r.left + Math.random() * r.width, r.top + r.height * (.2 + Math.random() * .9));
        setTimeout(() => s.remove(), 520);
      });
      const pillar = (r, k0, k1) => at(dur, k0, () => {
        const p = bit('dsx-pillar', r.left + r.width / 2, r.top + r.height / 2, { width:(r.width + 10) + 'px', height:(r.height + 26) + 'px', '--life':Math.round(dur * (k1 - k0)) + 'ms' });
        setTimeout(() => p.remove(), dur * (k1 - k0) + 60);
      });
      pillar(ctx.from, 0, .34); column(ctx.from, .02, .32);
      pillar(ctx.to, .5, .96); column(ctx.to, .52, .92);
      Sfx.shimmer(dur * .35); at(dur, .5, () => Sfx.shimmer(dur * .4));
    },
    comet(skin, anim, dur, ctx){
      ctx.ghost.classList.add('dsx-burning');
      Sfx.fire(dur);
      during(ctx, dur, .04, .94, 26, (k, r) => {
        const [x, y] = center(r);
        const s = bit(Math.random() < .5 ? 'dsx-fire' : 'dsx-ember', x + (Math.random() - .5) * r.width * .7, y + (Math.random() - .5) * r.height * .6, { '--dx':((Math.random() - .5) * 10).toFixed(1) + 'px', '--dy':(-8 - Math.random() * 14).toFixed(1) + 'px' });
        setTimeout(() => s.remove(), 460);
      });
      at(dur, .97, () => { const [x, y] = center(ctx.to); burst('dsx-smoke', x, y + ctx.to.height * .3, 8, 650, 30); Sfx.poof(); });
    },
    railgun(skin, anim, dur, ctx){
      ctx.ghost.classList.add('dsx-charging');
      Sfx.charge(dur * .48);
      // the charge: the card shivers and whitens at the deck
      during(ctx, dur, .05, .46, 50, (k, r) => { const [x, y] = center(r); const s = bit('dsx-spark-w', x + (Math.random() - .5) * r.width * 1.4, y + (Math.random() - .5) * r.height * 1.4); setTimeout(() => s.remove(), 260); });
      at(dur, .5, () => {
        ctx.ghost.classList.remove('dsx-charging');
        const [x0, y0] = center(ctx.from), [x1, y1] = center(ctx.to);
        const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0) * 180 / PI;
        const s = bit('dsx-rail', x0, y0, { width:len.toFixed(0) + 'px', '--a':ang.toFixed(1) + 'deg' });
        setTimeout(() => s.remove(), 520);
        const f = bit('dsx-hot', x1, y1); setTimeout(() => f.remove(), 480);
        Sfx.crack(); jolt(ctx);
      });
    },
    royal(skin, anim, dur, ctx){
      ctx.ghost.classList.add('dsx-gold');
      const [x0, y0] = center(ctx.from);
      const p = bit('dsx-pillar gold', x0, y0 - 40, { width:(ctx.from.width + 14) + 'px', height:'150px', '--life':Math.round(dur * .4) + 'ms' });
      setTimeout(() => p.remove(), dur * .4 + 60);
      Sfx.fanfare();
      // after-images while it spins and dives
      during(ctx, dur, .1, .9, 55, (k, r) => {
        const g = ctx.ghost.cloneNode(true);
        g.className = 'dsx-after'; g.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
        document.body.appendChild(g); setTimeout(() => g.remove(), 360);
      });
      during(ctx, dur, .55, .92, 40, (k, r) => { const [x, y] = center(r); const s = bit('dsx-spark', x + (Math.random() - .5) * r.width, y + (Math.random() - .5) * r.height, { '--dx':((Math.random() - .5) * 20) + 'px', '--dy':(10 + Math.random() * 20) + 'px' }); setTimeout(() => s.remove(), 640); });
      at(dur, .93, () => { const [x, y] = center(ctx.to); burst('dsx-spark burst', x, y, 16, 700, 70); const f = bit('dsx-hot gold', x, y); setTimeout(() => f.remove(), 480); Sfx.chime(); });
    }
  };

  /* ---------------- the styles ---------------- */
  // pose(t, m): m is +1 or -1 (which side a mirrored style came round)
  const STYLES = [
    // COMMON
    { id:'flick', tier:'common', name:'FLICK', note:'Today\'s deal: a shallow, hand-thrown arc.', pace:1,
      points:() => DealerDeck.POINTS.flick,
      pose:t => ({ bank:-.35 * bell(t, 0, .9), pitch:-.4 * bell(t, .05, .85), spin:-10 * bell(t, 0, .7) + 4 * bell(t, .6, .95) }) },
    { id:'frisbee', tier:'common', name:'FRISBEE', note:'Thrown with a curve: it leans into the turn, rides the air with a little wobble and settles flat.', pace:1.25, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.5,.6)'),
      P(.22, .2, 16, -6, 0, 1.04, 'cubic-bezier(.3,.3,.6,1)', -34),
      P(.55, .62, 24, 4, 0, 1.06, 'ease-in-out', -40),
      P(.86, .97, 7, 0, 0, 1.01, OUT, -12),
      P(.95, 1, 0, 0, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)],
      pose:(t, m) => ({ bank:m * (-.85 * bell(t, 0, .9) + .22 * S(t * 30) * (1 - t)), pitch:-.55 * bell(t, .05, .9), spin:m * -360 * (1 - Math.pow(1 - t, 2)), light:.12 * bell(t, .1, .9) }) },
    { id:'lob', tier:'common', name:'LOB', note:'Tossed high: it tips toward you at the top, drops into place and bounces once.', pace:1.3, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.5)'),
      P(.22, .2, 44, -8, 10, 1.06, 'cubic-bezier(.2,.5,.4,1)', -4),
      P(.5, .56, 72, -4, 12, 1.1, IN, -6),
      P(.8, 1, 0, 2, 0, 1, OUT),
      P(.88, 1, 7, -1, 0, 1.01, IN),
      P(.95, 1, 0, 0, 0, 1, OUT),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => ({ pitch:-.8 * bell(t, .05, .78) + .45 * bell(t, .78, .9), bank:.25 * S(t * 14) * bell(t, 0, .8), spin:-8 * bell(t, 0, .8), light:.12 * bell(t, .2, .7) }) },
    { id:'slide', tier:'common', name:'SLIDE', note:'Pushed low across the felt under a finger, lying almost flat.', pace:1.08,
      points:() => DealerDeck.POINTS.slide,
      pose:t => ({ pitch:.5 * (1 - ramp(t, .75, .95)), bank:.15 * S(t * 12) * (1 - t), spin:-4 * bell(t, 0, .6) }) },
    { id:'whip', tier:'common', name:'WHIP', note:'Fast and flat: snaps past its spot, twists back and settles.', pace:.72, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.6,0,.9,.5)'),
      P(.62, 1.07, 2, -10, 0, 1.01, OUT),
      P(.78, .98, 0, 5, 0, 1, SOFT),
      P(.9, 1.01, 0, -2, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)],
      pose:(t, m) => ({ bank:m * (.7 * bell(t, 0, .62) - .45 * bell(t, .62, .9)), pitch:.3 * bell(t, 0, .6), spin:m * (-14 * bell(t, 0, .7) + 6 * bell(t, .7, .95)) }) },
    // UNCOMMON
    { id:'swoop', tier:'uncommon', name:'SWOOP', note:'Swings wide round one side, banking hard into the turn.', pace:1.15, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.5)'),
      P(.25, .2, 12, -18, 4, 1.03, 'cubic-bezier(.3,.2,.5,1)', -55),
      P(.55, .6, 16, -10, 4, 1.05, 'cubic-bezier(.4,0,.6,1)', -60),
      P(.85, .97, 4, 6, 0, 1.005, OUT, -12),
      P(.94, 1, 0, -1, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)],
      pose:(t, m) => ({ bank:m * -1 * bell(t, .05, .92), pitch:-.3 * bell(t, .1, .8), spin:m * -24 * bell(t, 0, .9), light:.1 * bell(t, .2, .8) }) },
    { id:'skip', tier:'uncommon', name:'SKIP', note:'Skims the felt and skips twice, like a flat stone.', pace:1.15, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.6)'),
      P(.22, .3, 14, -4, 6, 1.03, IN, -3),
      P(.4, .55, 0, 2, 0, 1, 'cubic-bezier(.1,.6,.4,1)', -2),
      P(.55, .72, 9, -3, 4, 1.02, IN, -1),
      P(.7, .88, 0, 2, 0, 1, 'cubic-bezier(.1,.6,.4,1)'),
      P(.8, .96, 4, -1, 2, 1, IN),
      P(.9, 1, 0, 0, 0, 1, OUT),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => { const touch = Math.max(bell(t, .34, .46), bell(t, .64, .76), bell(t, .85, .95)); return { pitch:.6 * touch - .3 * (1 - touch) * bell(t, 0, .9), bank:.2 * S(t * 20) * (1 - t), spin:-18 * t + 18 * ramp(t, .9, 1), light:.14 * touch }; } },
    { id:'spin', tier:'uncommon', name:'SPIN', note:'Spins flat like a record all the way, and stops square.', pace:1,
      points:() => DealerDeck.POINTS.spin,
      pose:t => ({ spin:-360 * (1 - Math.pow(1 - t, 2.2)), pitch:.35 * bell(t, 0, .9), bank:.12 * S(t * 18) }) },
    { id:'flutter', tier:'uncommon', name:'FLUTTER', note:'Floats up, then rocks on every axis down to its spot, like a falling leaf.', pace:1.45, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.2,0,.4,1)'),
      P(.2, .25, 46, -6, 8, 1.06, 'ease-in-out', -6),
      P(.36, .42, 40, 14, 4, 1.06, 'ease-in-out', 6),
      P(.52, .6, 30, -12, 6, 1.05, 'ease-in-out', -5),
      P(.68, .78, 20, 10, 3, 1.03, 'ease-in-out', 4),
      P(.84, .94, 8, -6, 2, 1.01, 'ease-in-out', -2),
      P(.94, 1, 0, 2, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)],
      pose:(t, m) => { const k = bell(t, 0, .96); return { bank:m * .9 * S(t * 4 * PI) * k, pitch:.55 * C(t * 4 * PI + .6) * k, spin:m * 16 * S(t * 4 * PI) * k, light:.12 * S(t * 4 * PI + 1) * k }; } },
    { id:'knuckle', tier:'uncommon', name:'KNUCKLEBALL', note:'No spin at all, so the air throws it about: it wobbles every way on the way over.', pace:1.1, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.5)'),
      P(.3, .3, 20, 0, 0, 1.04, 'linear', -6),
      P(.5, .52, 24, 0, 0, 1.05, 'linear', 7),
      P(.72, .78, 16, 0, 0, 1.03, 'linear', -5),
      P(.9, 1, 2, 0, 0, 1, OUT, 2),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => { const k = bell(t, .05, .92); return { bank:(S(t * 23) * .6 + S(t * 41) * .35) * k, pitch:(C(t * 29) * .5 + S(t * 53) * .3) * k, spin:(S(t * 17) * 12) * k, light:S(t * 31) * .1 * k }; } },
    // RARE
    { id:'boomerang', tier:'rare', name:'BOOMERANG', note:'Rare. Flies past its spot spinning, curves round and comes back in.', pace:1.55, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.5,.7)'),
      P(.35, .9, 22, 0, 0, 1.05, 'ease-in-out', -70),
      P(.6, 1.24, 20, 0, 0, 1.06, 'ease-in-out', -18),
      P(.84, 1.05, 7, 0, 0, 1.02, OUT, 14),
      P(.94, 1, 0, 0, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)],
      pose:(t, m) => ({ spin:m * -720 * (1 - Math.pow(1 - t, 1.6)), bank:m * .6 * S(t * PI * 2) * bell(t, 0, .95), pitch:-.35 * bell(t, .1, .9), light:.12 * S(t * 12) }) },
    { id:'shuriken', tier:'rare', name:'SHURIKEN', note:'Rare. Thrown flat and spinning like a throwing star, with speed lines, and lands with a thunk that jolts the seat.', pace:.85, fx:'shuriken', points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.5,0,.8,.6)'),
      P(.9, 1, 4, 0, 0, 1.02, 'linear'),
      P(.96, 1, 0, 0, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => ({ spin:t < .9 ? -1440 * t / .9 : -1440, pitch:.55 * (1 - ramp(t, .88, .96)), light:.1 * S(t * 40) }) },
    { id:'magician', tier:'rare', name:'MAGICIAN', note:'Rare. Vanishes from the deck in a puff of smoke and pops out of one at its seat.', pace:1.35, fx:'magician', points:() => [
      P(0, 0, 0, 0, 0, 1, 'linear'),
      P(.12, 0, 6, 0, 0, 1.05, 'linear'),
      P(.7, 1, 6, 0, 0, 1.05, 'linear'),
      P(.86, 1, 10, 0, 0, 1.08, OUT),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => ({ alpha:t < .12 ? 1 : t < .76 ? 0 : 1, pitch:-.4 * bell(t, .76, 1), spin:t > .76 ? -20 * (1 - ramp(t, .76, 1)) : 0, light:.2 * bell(t, .76, 1) }) },
    { id:'glitch', tier:'rare', name:'GLITCH', note:'Rare. The machine glitches it across: it hops in torn, colour-split jumps and snaps into place.', pace:1.2, fx:'glitch', points:() => [
      P(0, 0, 0, 0, 0, 1, 'steps(1,end)'),
      P(.22, .22, 8, 0, 0, 1.04, 'steps(1,end)', 18),
      P(.44, .46, 14, 0, 0, .96, 'steps(1,end)', -14),
      P(.66, .72, 6, 0, 0, 1.06, 'steps(1,end)', 10),
      P(.86, .94, 2, 0, 0, 1, 'steps(1,end)', -4),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => { const f = Math.floor(t * 9); return { bank:[0, .5, -.25, .75, -.5, .25, 0, -.25, 0][f] || 0, pitch:[0, -.5, .25, 0, .5, -.25, 0, .25, 0][f] || 0, light:(f % 2 ? .25 : -.1) * (1 - ramp(t, .86, 1)) }; } },
    // EPIC
    { id:'transporter', tier:'epic', name:'TRANSPORTER', note:'Epic. It dissolves into a shimmering column at the deck, and materialises in one at its seat, bottom up.', pace:1.9, fx:'transporter', points:() => [
      P(0, 0, 0, 0, 0, 1, 'linear'),
      P(.36, 0, 0, 0, 0, 1, 'steps(1,end)'),
      P(.48, 1, 0, 0, 0, 1, 'linear'),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => ({ show:t < .36 ? 1 - ramp(t, .06, .34) : t < .5 ? 0 : ramp(t, .54, .92), light:.35 * (bell(t, 0, .36) + bell(t, .5, .95)) }) },
    { id:'comet', tier:'epic', name:'COMET', note:'Epic. Catches fire and arcs over the table on a trail of flame, landing in a puff of smoke.', pace:1.5, mirror:true, fx:'comet', points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.5)'),
      P(.3, .28, 60, 0, 0, 1.1, 'cubic-bezier(.2,.5,.4,1)', -30),
      P(.62, .7, 70, 0, 0, 1.12, IN, -26),
      P(.92, 1, 0, 0, 0, 1, OUT),
      P(1, 1, 0, 0, 0, 1)],
      pose:(t, m) => ({ bank:m * -.6 * bell(t, 0, .92), pitch:-.6 * bell(t, .05, .9), spin:m * -40 * bell(t, 0, .95), light:.28 * bell(t, 0, .95) }) },
    // LEGENDARY
    { id:'railgun', tier:'legendary', name:'RAILGUN', note:'Legendary. The card charges white-hot at the deck, then fires: a white streak across the table and it is simply there.', pace:1.9, fx:'railgun', points:() => [
      P(0, 0, 0, 0, 0, 1, 'linear'),
      P(.48, 0, 4, 0, 0, 1.08, 'steps(1,end)'),
      P(.52, 1, 0, 0, 0, 1.06, 'linear'),
      P(.7, 1, 0, 0, 0, 1, OUT),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => ({ light:t < .5 ? .6 * ramp(t, .05, .48) : .5 * (1 - ramp(t, .5, .8)), bank:t < .5 ? (Math.random() - .5) * .5 * ramp(t, .2, .48) : 0, pitch:t < .5 ? -.3 * ramp(t, .1, .48) : 0 }) },
    { id:'royal', tier:'legendary', name:'ROYAL FLOURISH', note:'Legendary. Lifted out of the deck on a gold light, it spins with after-images, hangs at the top to a fanfare, and dives in with a shower of gold.', pace:2.4, fx:'royal', points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.2,0,.3,1)'),
      P(.22, .08, 110, 0, 0, 1.35, 'linear'),
      P(.38, .1, 118, 0, 0, 1.4, OUT),
      P(.52, .1, 120, 0, 0, 1.4, 'cubic-bezier(.7,0,.9,.4)'),
      P(.84, 1, 6, 0, 0, 1.02, 'cubic-bezier(.2,.8,.3,1)'),
      P(.92, 1, 0, 0, 0, 1.06, SOFT),
      P(1, 1, 0, 0, 0, 1)],
      pose:t => ({ spin:-720 * (1 - Math.pow(1 - ramp(t, 0, .5), 2)), bank:.5 * S(t * 18) * bell(t, .38, .56), pitch:-.6 * bell(t, .1, .55) + .3 * bell(t, .84, .96), light:.3 * bell(t, .05, .95) }) }
  ];
  const byId = id => STYLES.find(s => s.id === id);

  let O = { on:{}, rarity:{}, scope:'hand' };
  STYLES.forEach(s => { O.on[s.id] = true; O.rarity[s.id] = s.tier; });

  // a style, ready to fly (mirrored at random if it can be)
  function make(s){
    const m = s.mirror && Math.random() < .5 ? -1 : 1;
    let pts = s.points();
    if (m < 0) pts = pts.map(p => { const q = p.slice(); q[3] = -q[3]; q[7] = -(q[7] || 0); return q; });
    const fx = s.fx && FX[s.fx];
    return { id:s.id, points:pts, pace:s.pace, pose:s.pose ? t => s.pose(t, m) : null, decorate:fx || null };
  }
  function roll(list){
    const total = list.reduce((t, s) => t + WEIGHT[O.rarity[s.id]], 0);
    let r = Math.random() * total;
    for (const s of list){ r -= WEIGHT[O.rarity[s.id]]; if (r <= 0) return s; }
    return list[list.length - 1];
  }
  let handKey = null, handStyle = null;
  function pick(){
    const on = STYLES.filter(s => O.on[s.id]);
    if (!on.length) return null;
    const plain = on.filter(s => !SOLO[O.rarity[s.id]]);
    const r = roll(on);
    if (SOLO[O.rarity[r.id]] || !plain.length) return r;
    if (O.scope === 'card') return r;
    const key = typeof game !== 'undefined' && game ? game.handNumber : 0;
    if (key !== handKey || !handStyle || !O.on[handStyle.id]){ handKey = key; handStyle = roll(plain); }
    return handStyle;
  }
  function apply(order){
    if (order){
      if (order.on) Object.assign(O.on, order.on);
      if (order.rarity) Object.keys(order.rarity).forEach(k => { if (WEIGHT[order.rarity[k]] != null) O.rarity[k] = order.rarity[k]; });
      if (order.scope) O.scope = order.scope;
    }
    handStyle = null;
    DealerDeck.flightFor = () => { const s = pick(); return s ? make(s) : null; };
  }
  apply();
  return { STYLES, TIERS, WEIGHT, SOLO, Sfx, apply, make:id => make(byId(id)), get order(){ return JSON.parse(JSON.stringify(O)); } };
})();
