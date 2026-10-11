/* ============================================================
   PACK OPENING V3 — motion core (lab only)

   The game's 2.5D language, as a small toolkit:
   - Bodies glide every frame but hold a POSE (rotation, squash, flip)
     that steps at 14 a second, like the dealer deck's sprite cards.
   - Tweens are skippable: a tap during an animation finishes it
     (PO.finishAll), so a veteran never waits.
   - A pixel shadow sits on the felt and drifts away as a body rises.
   - Felt puffs, box jolts and stepped sparks for contact.
   ============================================================ */
(() => {
  'use strict';
  const FPS = 14;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snap = (v, step) => Math.round(v / step) * step;
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = {
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t,
    inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    lin: t => t
  };

  let gen = 0, speed = 1, reduced = false, raf = 0, last = 0;
  const tweens = new Set(), tickers = new Set(), bodies = new Set();

  let inFrame = false;
  // one frame at a time: wake() during a frame is ignored, the frame
  // reschedules itself at its end if anything is still moving
  function wake(){ if (!raf && !inFrame) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now){
    raf = 0; inFrame = true;
    const dt = clamp((now - last) / 1000, 0, .05); last = now;
    for (const t of [...tweens]){
      if (t.gen !== gen){ tweens.delete(t); t.resolve(false); continue; }
      const p = t.ms <= 0 ? 1 : clamp((now - t.at) / t.ms, 0, 1);
      try { t.step(t.ease(p), p); } catch (e) { console.error(e); }
      if (p >= 1){ tweens.delete(t); t.resolve(true); }
    }
    for (const fn of [...tickers]) { try { if (fn(dt, now) === false) tickers.delete(fn); } catch (e) { console.error(e); tickers.delete(fn); } }
    for (const b of bodies) b.render(now);
    inFrame = false;
    if (tweens.size || tickers.size || [...bodies].some(b => b.dirty)) raf = requestAnimationFrame(frame);
  }

  /* A skippable animation: step(easedP, rawP). Resolves true when it
     ran to the end, false when a reset cancelled it. */
  function tween(ms, step, easing = ease.out){
    return new Promise(resolve => {
      tweens.add({ at:performance.now(), ms:reduced ? Math.min(ms, 1) : ms / speed, step, ease:easing, resolve, gen });
      wake();
    });
  }
  function wait(ms){ return tween(ms, () => {}); }
  function finishAll(){
    for (const t of [...tweens]){ tweens.delete(t); try { t.step(t.ease(1), 1); } catch (e) {} t.resolve(true); }
    wake();
  }
  function every(fn){ tickers.add(fn); wake(); return () => tickers.delete(fn); }
  function reset(){ gen++; for (const t of tweens) t.resolve(false); tweens.clear(); tickers.clear(); }

  /* ---------------- a body on the felt ----------------
     el: the object; its layout box is w×h, anchored at (ax, ay) inside
     it. Pose (r, sx, sy, flip) steps at 14 fps; position glides. */
  class Body {
    constructor(stage, el, { w, h, ax = w / 2, ay = h / 2, shadow = true, shadowW = w, shadowH = h, shadowY = 0 } = {}){
      Object.assign(this, { stage, el, w, h, ax, ay, x:0, y:0, z:0, r:0, s:1, sx:1, sy:1, shx:1, alpha:1, live:false, dirty:true, poseAt:-1 });
      el.classList.add('po-body');
      el.style.width = w + 'px'; el.style.height = h + 'px';
      el.style.transformOrigin = ax + 'px ' + ay + 'px';
      this.shadowY = shadowY;
      if (shadow){
        this.sh = document.createElement('i');
        this.sh.className = 'po-shadow';
        this.sh.style.width = shadowW + 'px'; this.sh.style.height = shadowH + 'px';
        this.shW = shadowW; this.shH = shadowH;
        stage.shadows.append(this.sh);
      }
      stage.objects.append(el);
      bodies.add(this);
    }
    set(v){ Object.assign(this, v); this.dirty = true; wake(); return this; }
    remove(){ bodies.delete(this); this.el.remove(); this.sh?.remove(); }
    render(now){
      if (!this.dirty) return;
      this.dirty = false;
      // the pose steps; held objects (live) follow the finger every frame
      if (this.live || reduced || now - this.poseAt >= 1000 / FPS || this.poseAt < 0){
        this.poseAt = now;
        this.pr = this.live ? this.r : snap(this.r, 3);
        this.psx = snap(this.sx, .04); this.psy = snap(this.sy, .04);
      } else this.dirty = true; // come back for the next stepped frame
      const s = this.s, tx = this.x - this.ax, ty = this.y - this.z - this.ay;
      this.el.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) rotate(${this.pr}deg) scale(${(s * this.psx).toFixed(3)},${(s * this.psy).toFixed(3)})`;
      this.el.style.opacity = this.alpha < 1 ? this.alpha.toFixed(3) : '';
      if (this.sh){
        const z = Math.max(0, this.z), grow = 1 + z / 700;
        // centred under the body; it drifts down-right and spreads as the body rises
        const sw = this.shW, shh = this.shH;
        this.sh.style.transform = `translate(${(this.x - sw / 2 + 3 + z * .35).toFixed(1)}px,${(this.y - shh / 2 + this.shadowY * s + 5 + z * .6).toFixed(1)}px) rotate(${this.pr}deg) scale(${(s * this.psx * this.shx * grow).toFixed(3)},${(s * Math.abs(this.psy) * grow).toFixed(3)})`;
        this.sh.style.opacity = (Math.max(.06, .3 - z / 300) * this.alpha).toFixed(2);
      }
    }
  }

  /* Glide a body between poses. `arc` lifts it in the middle. */
  function glide(b, to, ms, { arc = 0, easing = ease.out, spin = 0 } = {}){
    const from = { x:b.x, y:b.y, z:b.z, r:b.r, s:b.s, sx:b.sx, sy:b.sy, alpha:b.alpha };
    return tween(ms, (e, p) => {
      const v = {};
      for (const k of Object.keys(to)) v[k] = mix(from[k], to[k], e);
      if (arc) v.z = mix(from.z, to.z ?? from.z, e) + Math.sin(p * Math.PI) * arc;
      if (spin) v.r = mix(from.r, to.r ?? from.r, e) + Math.sin(p * Math.PI) * spin;
      b.set(v);
    }, easing);
  }

  /* Contact: a squash on landing that rings out over two stepped frames. */
  function squash(b, amount = .1, ms = 220){
    return tween(ms, (e, p) => {
      const k = Math.sin(p * Math.PI * 2.2) * Math.exp(-p * 4) * amount;
      b.set({ sx:1 + k, sy:1 - k });
    }, ease.lin).then(r => { b.set({ sx:1, sy:1 }); return r; });
  }

  /* A puff of felt where something lands: square pixels, stepped. */
  function puff(stage, x, y, w, { n = 8, colour = '#9DC08A' } = {}){
    if (reduced) return;
    const bits = [];
    for (let i = 0; i < n; i++){
      const el = document.createElement('i');
      el.className = 'po-bit';
      el.style.background = colour;
      stage.fx.append(el);
      const side = i % 2 ? 1 : -1;
      bits.push({ el, x:x + side * (w / 2 - 4 + Math.random() * 8), y:y - Math.random() * 4, vx:side * (30 + Math.random() * 50), vy:-(20 + Math.random() * 40), s:2 + (i % 3) });
    }
    let t = 0, step = -1;
    every(dt => {
      t += dt * speed;
      const f = Math.floor(t * FPS);
      if (f !== step){
        step = f;
        for (const b of bits){
          const tt = f / FPS;
          b.el.style.transform = `translate(${Math.round(b.x + b.vx * tt)}px,${Math.round(b.y + b.vy * tt + 60 * tt * tt)}px)`;
          b.el.style.width = b.el.style.height = Math.max(1, b.s - Math.floor(f / 2)) + 'px';
        }
      }
      if (t > .36){ bits.forEach(b => b.el.remove()); return false; }
    });
  }

  /* Sparks, embers, chips: square pixels thrown out, stepped at 14 fps.
     o: { n, colours[], vx:[min,max], vy:[min,max], g (gravity px/s²), life s, size, spread } */
  function burst(stage, x, y, o = {}){
    if (reduced) return;
    const { n = 10, colours = ['#F3E6C4'], vx = [-80, 80], vy = [-160, -40], g = 260, life = .7, size = 3, spread = 10, w = 0, h = 0, layer = stage.fx } = o;
    const bits = [];
    for (let i = 0; i < n; i++){
      const el = document.createElement('i');
      el.className = 'po-bit';
      el.style.background = colours[i % colours.length];
      el.style.width = el.style.height = size + (i % 2) + 'px';
      layer.append(el);
      bits.push({ el, x:x + (Math.random() - .5) * (spread + w), y:y + (Math.random() - .5) * (spread + h), vx:mix(vx[0], vx[1], Math.random()), vy:mix(vy[0], vy[1], Math.random()), l:life * (.6 + Math.random() * .4) });
    }
    let t = 0, step = -1;
    every(dt => {
      t += dt * speed;
      const f = Math.floor(t * FPS);
      if (f !== step){
        step = f;
        const tt = f / FPS;
        for (const b of bits){
          b.el.style.transform = `translate(${Math.round(b.x + b.vx * tt)}px,${Math.round(b.y + b.vy * tt + g * tt * tt / 2)}px)`;
          b.el.style.opacity = tt > b.l ? '0' : tt > b.l * .7 ? '.5' : '1';
        }
      }
      if (t > life + .1){ bits.forEach(b => b.el.remove()); return false; }
    });
  }

  /* The box takes the hit: a 2px drop for one frame, then back. */
  function jolt(el, px = 2){
    if (reduced) return;
    el.style.translate = `0 ${px}px`;
    setTimeout(() => { el.style.translate = `0 ${-Math.round(px / 2)}px`; }, 50);
    setTimeout(() => { el.style.translate = ''; }, 100);
  }

  /* Short procedural sounds the game doesn't have: foil and paper. The
     game's own Sound palette does everything else. */
  const Foil = (() => {
    let ctx;
    function c(){
      // the game declares settings (and Sound) with let/const: they're
      // globals, but not properties of window
      if (typeof settings === 'undefined' || !settings.sound) return null;
      try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { return null; }
      return ctx;
    }
    function noise(ms, vol, hp, lp, crackle = 0){
      const a = c(); if (!a) return;
      const len = Math.ceil(a.sampleRate * ms / 1000), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++){
        const env = Math.pow(1 - i / len, 1.6);
        d[i] = (Math.random() * 2 - 1) * env * (crackle && Math.random() < crackle ? 2.4 : 1);
      }
      const s = a.createBufferSource(), h = a.createBiquadFilter(), l = a.createBiquadFilter(), g = a.createGain();
      s.buffer = buf; h.type = 'highpass'; h.frequency.value = hp; l.type = 'lowpass'; l.frequency.value = lp; g.gain.value = vol;
      s.connect(h); h.connect(l); l.connect(g); g.connect(a.destination); s.start();
    }
    return {
      // iOS only lets audio start inside a finished tap; a silent buffer
      // played there keeps the context running
      unlock(){
        const a = c(); if (!a || a._po) return;
        try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); a._po = a.state === 'running'; } catch (e) {}
      },
      // rise 0..1 lifts the pitch: a tear climbs as it goes
      crackle(power = 1, rise = 0){ noise(18 + Math.random() * 18, .09 * power, (1800 + Math.random() * 1600) * (1 + rise * .8), 9000 + rise * 3000, .08); },
      rip(){ noise(240, .22, 900, 7000, .05); setTimeout(() => noise(90, .12, 2400, 9000), 70); },
      crinkle(){ noise(60, .07, 1400, 6000, .12); },
      rustle(power = 1){ noise(120, .06 * power, 600, 3200); },
      scrape(){ noise(26, .07, 1200, 4200); },
      thud(power = 1){ noise(90, .25 * power, 40, 420); },
      flutter(){ noise(50, .08, 2200, 8000, .2); },
      // a plucked note that climbs through the pack, a step per card
      note(step = 0, power = 1){
        const a = c(); if (!a) return;
        const f = 392 * Math.pow(2, step * 2 / 12), o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
        o.type = 'square'; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.045 * power, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + .2);
      },
      // a brass desk bell: a bright strike and a long ring with a slow beat
      bell(power = 1){
        const a = c(); if (!a) return;
        const t = a.currentTime;
        [[1760, .07, 1.4], [1765, .05, 1.4], [3520, .025, .5], [5280, .012, .25]].forEach(([f, v, d]) => {
          const o = a.createOscillator(), g = a.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * power, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + d);
          o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .05);
        });
        noise(14, .06 * power, 3000, 12000);
      },
      chord(fs, power = 1){
        const a = c(); if (!a) return;
        fs.forEach((f, i) => {
          const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * .05;
          o.type = i % 2 ? 'square' : 'triangle'; o.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.04 * power, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
          o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + .55);
        });
      }
    };
  })();

  /* A tap you can feel. Android vibrates; iPhone Safari has no vibrate,
     but toggling a hidden switch control through its label gives a
     system haptic tick (Safari 18+). Both quietly do nothing elsewhere. */
  const Haptic = (() => {
    let label = null, last = 0;
    function ios(){
      if (!label){
        const id = 'po-haptic-' + Math.random().toString(36).slice(2, 7);
        const input = document.createElement('input');
        input.type = 'checkbox'; input.setAttribute('switch', ''); input.id = id;
        input.setAttribute('aria-hidden', 'true'); input.tabIndex = -1;
        input.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0;pointer-events:none;';
        label = document.createElement('label');
        label.htmlFor = id; label.setAttribute('aria-hidden', 'true');
        label.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0;pointer-events:none;';
        document.body.append(input, label);
      }
      label.click();
    }
    return {
      on:true,
      // ms: how long on Android; gap: the shortest time between two ticks
      tick(ms = 10, gap = 45){
        const now = performance.now();
        if (!this.on || now - last < gap) return;
        last = now;
        try { if (navigator.vibrate) navigator.vibrate(ms); else ios(); } catch (e) {}
      }
    };
  })();

  // Safe calls into the game's Sound palette.
  const S = new Proxy({}, { get:(o, k) => (...a) => { try { if (typeof Sound !== 'undefined' && typeof Sound[k] === 'function') return Sound[k](...a); } catch (e) {} } });
  // every finished tap anywhere unlocks both: the game's sounds and the foil's
  ['pointerup', 'touchend', 'click'].forEach(t => document.addEventListener(t, () => { Foil.unlock(); S.unlock(); }, { capture:true, passive:true }));

  window.PO = {
    FPS, clamp, snap, mix, ease, tween, wait, glide, squash, puff, burst, jolt, every, finishAll, reset, wake, Body, Foil, S, Haptic,
    get busy(){ return tweens.size > 0; },
    get speed(){ return speed; }, set speed(v){ speed = v; },
    get reduced(){ return reduced; }, set reduced(v){ reduced = !!v; },
    get gen(){ return gen; }
  };
})();
