"use strict";

/* ============================================================
   PACK LAB — the sounds (lab only, never loaded by the game)

   Procedural, like every sound in the game: short filtered noise for
   paper, metal and mechanism, small tones for lamps and chimes. It runs
   on its own AudioContext, gated by the game's sound setting and the
   lab's SOUND switch. If the packs reach the game, these move into
   Sound (js/02-support-systems.js) and share its context.
   ============================================================ */
const PackSound = (() => {
  let ctx = null, master = null, muted = false;
  function ac(){
    if (muted || (typeof settings !== 'undefined' && !settings.sound)) return null;
    if (!ctx){
      try{
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = AC ? new AC() : null;
        if (ctx){ master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination); }
      }catch(e){ ctx = null; }
    }
    if (ctx && ctx.state === 'suspended'){ try{ ctx.resume(); }catch(e){} }
    return ctx;
  }
  function tone(freq, dur, type, vol, when, slideTo){
    const c = ac(); if (!c) return;
    try{
      const t = c.currentTime + (when || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || .05, t + .008);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + .03);
    }catch(e){}
  }
  function noise(dur, vol, o){
    const c = ac(); if (!c) return;
    try{
      o = o || {};
      const n = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      const pow = o.decay == null ? 2.5 : o.decay;
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, pow) * (o.grit && Math.random() < .3 ? 2 : 1);
      const s = c.createBufferSource(); s.buffer = buf;
      const f = c.createBiquadFilter(); f.type = o.type || 'bandpass';
      const t = c.currentTime + (o.when || 0);
      f.frequency.setValueAtTime(o.freq || 1800, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t + dur);
      if (o.q != null) f.Q.value = o.q;
      const g = c.createGain(); g.gain.value = vol || .05;
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + .02);
    }catch(e){}
  }
  /* A held sound with a level the caller drives every frame (the tear,
     the coil motor, the rare-card hum). Returns { set(level), stop() }. */
  function held(build){
    const c = ac();
    if (!c) return { set(){}, stop(){} };
    try{
      const g = c.createGain(); g.gain.value = .0001; g.connect(master);
      const parts = build(c, g);
      let stopped = false;
      return {
        set(v, extra){ if (!stopped) parts.set(Math.max(0, Math.min(1, v)), c.currentTime, extra); },
        stop(fade){
          if (stopped) return; stopped = true;
          const t = c.currentTime;
          try{ g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(.0001, t, fade || .04); parts.nodes.forEach(n => n.stop(t + .4)); }catch(e){}
        },
        gain:g
      };
    }catch(e){ return { set(){}, stop(){} }; }
  }
  const loopNoise = c => {
    const len = Math.floor(c.sampleRate * .6), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true; return s;
  };

  return {
    unlock(){ ac(); },
    setMuted(m){ muted = !!m; if (muted && ctx){ try{ ctx.suspend(); }catch(e){} } else if (!muted && ctx){ try{ ctx.resume(); }catch(e){} } },
    /* the panel */
    key(){ noise(.018, .07, { type:'highpass', freq:2600, decay:3 }); tone(160, .05, 'square', .018, .004); },
    beep(hi){ tone(hi ? 1320 : 990, .06, 'square', .022); },
    deny(){ tone(220, .09, 'square', .03); tone(180, .14, 'square', .03, .1); },
    /* a chip into the slot: the clink on the lip, then the run down the chute */
    coin(){
      tone(2400 + Math.random() * 500, .09, 'triangle', .03);
      tone(3600 + Math.random() * 600, .06, 'sine', .02, .004);
      noise(.03, .06, { freq:4200, q:3, decay:3 });
      for (let k = 0; k < 4; k++) noise(.02, .03 - k * .005, { freq:2600 - k * 300, q:4, decay:3, when:.07 + k * .045 + Math.random() * .02 });
    },
    coinDrop(){ noise(.08, .05, { freq:900, q:2, when:.02 }); tone(140, .08, 'sine', .04, .02); },
    /* the coil motor: a hum with a ratchet the caller ticks */
    motor(){
      return held((c, g) => {
        const n = loopNoise(c);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 1.6;
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52;
        const og = c.createGain(); og.gain.value = .22;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        n.connect(f); f.connect(g); o.connect(og); og.connect(lp); lp.connect(g);
        const t = c.currentTime; n.start(t); o.start(t);
        return { nodes:[n, o], set(v, now){ g.gain.setTargetAtTime(.0001 + v * .07, now, .03); o.frequency.setTargetAtTime(40 + v * 26, now, .05); f.frequency.setTargetAtTime(160 + v * 180, now, .05); } };
      });
    },
    ratchet(s){ noise(.014, .05 * (s || 1), { type:'highpass', freq:3000, decay:3 }); tone(90, .03, 'square', .012 * (s || 1)); },
    /* the pack: scraping forward off the coil, the tip, the fall, the thunk */
    slide(){ noise(.22, .035, { freq:1400, to:700, q:.8, decay:1.2 }); },
    tip(){ noise(.05, .04, { freq:900, q:1.5 }); },
    thunk(heavy){
      tone(heavy ? 64 : 82, .22, 'sine', .14, 0, 38);
      noise(.09, .12, { type:'lowpass', freq:600, decay:2 });
      noise(.05, .05, { freq:2800, q:1.5, when:.03 });
      // the flap rattling after
      [0.09, .16, .21].forEach((w, i) => noise(.02, .04 - i * .01, { freq:1600, q:3, when:w }));
    },
    flap(open){ noise(.06, .05, { freq:open ? 1200 : 800, q:2 }); tone(open ? 620 : 480, .07, 'triangle', .02, .01, open ? 760 : 380); },
    lift(){ noise(.16, .03, { freq:2200, to:3800, q:.7, decay:1.5 }); },
    /* the tear: foil and paper, louder and brighter the faster the finger */
    tear(tierId){
      const foil = tierId === 'gold' || tierId === 'high' || tierId === 'casino';
      return held((c, g) => {
        const n = loopNoise(c);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = foil ? 3800 : 2400; f.Q.value = .9;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
        n.connect(hp); hp.connect(f); f.connect(g);
        n.start(c.currentTime);
        return { nodes:[n], set(v, now){ g.gain.setTargetAtTime(.0001 + v * (foil ? .16 : .2), now, .012); f.frequency.setTargetAtTime((foil ? 2800 : 1600) + v * 3600, now, .02); } };
      });
    },
    crinkle(){ noise(.012, .05 + Math.random() * .04, { freq:3000 + Math.random() * 4000, q:4, decay:3, grit:true }); },
    rip(){ noise(.16, .22, { freq:5200, to:1800, q:.8, decay:1.6, grit:true }); noise(.05, .1, { type:'highpass', freq:6000, when:.02 }); },
    whoosh(){ noise(.3, .05, { freq:600, to:2400, q:.6, decay:1 }); },
    /* the cards */
    cardOut(i){ noise(.09, .035, { freq:2400 + (i || 0) * 120, to:3600, q:.9, decay:1.4, when:(i || 0) * .05 }); },
    flick(){ noise(.08, .07, { freq:2600, to:5200, q:.8, decay:1.6 }); },
    land(){ noise(.03, .05, { freq:1600, q:1.2, decay:3 }); tone(220, .03, 'sine', .015); },
    flip(){ noise(.05, .05, { freq:3200, q:1.4 }); noise(.03, .04, { freq:1800, q:1.4, when:.05 }); },
    /* rarities */
    hum(){
      return held((c, g) => {
        const a = c.createOscillator(), b = c.createOscillator();
        a.type = 'sawtooth'; b.type = 'sine'; a.frequency.value = 55; b.frequency.value = 110.6;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        const trem = c.createOscillator(), tg = c.createGain(); trem.frequency.value = 7; tg.gain.value = .3;
        trem.connect(tg); tg.connect(g.gain);
        a.connect(lp); b.connect(lp); lp.connect(g);
        const t = c.currentTime; a.start(t); b.start(t); trem.start(t);
        return { nodes:[a, b, trem], set(v, now){ g.gain.setTargetAtTime(.0001 + v * .09, now, .08); lp.frequency.setTargetAtTime(220 + v * 900, now, .1); a.frequency.setTargetAtTime(55 + v * 22, now, .2); b.frequency.setTargetAtTime(110.6 + v * 44, now, .2); } };
      });
    },
    relay(){ noise(.012, .06, { type:'highpass', freq:3000, decay:3 }); tone(60, .06, 'square', .02, .006); },
    reveal(rarity){
      if (rarity === 'uncommon'){ tone(660, .12, 'triangle', .04); tone(990, .16, 'triangle', .035, .07); return; }
      if (rarity === 'rare'){ [523, 659, 784, 1047].forEach((f, i) => tone(f, .32, 'triangle', .045, i * .07)); noise(.3, .03, { freq:6000, q:.5, when:.1 }); return; }
      if (rarity === 'foil'){
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, .5, 'triangle', .04, i * .06); tone(f * 2, .3, 'sine', .015, i * .06 + .02); });
        for (let k = 0; k < 10; k++) tone(2600 + Math.random() * 2600, .08, 'sine', .015, .3 + k * .05);
        return;
      }
      tone(880, .06, 'triangle', .02);
    },
    glitch(){
      for (let k = 0; k < 9; k++){
        const w = k * .045 + Math.random() * .02;
        tone(80 + Math.random() * 1600, .04, 'square', .03, w);
        noise(.03, .05, { freq:400 + Math.random() * 6000, q:6, when:w });
      }
      tone(1200, .5, 'sawtooth', .02, .42, 60);
    },
    jinx(){ [392, 370, 311, 233].forEach((f, i) => tone(f, .4, 'triangle', .04, i * .14)); tone(58, 1.1, 'sawtooth', .03, .1, 40); },
    chip(){ tone(2600 + Math.random() * 900, .05, 'triangle', .02); noise(.015, .04, { freq:4800, q:3, decay:3 }); },
    chipLand(s){ noise(.02, .04 * (s || 1), { freq:3000 + Math.random() * 1500, q:3, decay:3 }); tone(1800 + Math.random() * 1400, .035, 'triangle', .015 * (s || 1)); },
    count(){ tone(1500, .025, 'square', .012); },
    /* the case */
    caseOpen(){ noise(.12, .05, { freq:500, q:1.2 }); tone(140, .12, 'sine', .05, .02, 90); },
    caseShut(){ tone(110, .16, 'sine', .1, 0, 60); noise(.05, .08, { type:'lowpass', freq:700 }); },
    file(){ noise(.05, .04, { freq:2200, to:1200, q:1 }); tone(300, .04, 'square', .012, .03); },
    stamp(){ tone(70, .18, 'sine', .14, 0, 45); noise(.06, .1, { type:'lowpass', freq:900 }); }
  };
})();
