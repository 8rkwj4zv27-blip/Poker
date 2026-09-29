"use strict";

/* ============================================================
   COACH SET (Coach Face Lab, round 3: candidate, lab only)

   The owner, round 3: he's the little Poker Machine's soul, plugged into
   an old TV. Two small dots for eyes and a mouth. Pixel art, 2.5D like
   the chips and cards, never a fade: weight. The player pulls him out
   from under the table by the dashboard and puts him down with a heavy
   thud; switching him off swipes him back off the same way. He is
   visibly plugged in: a cable from the back of the set to a COACH key
   next to the table's ⚙.

   - The set and its face are drawn as pixel sprites on canvases at two
     screen pixels per art pixel (P), like the rest of the table.
   - Motion is stepped at 14 frames a second like the 2.5D card; the
     shadow on the felt shrinks and fades in steps as he lifts.
   - The landing: a squash, a rock onto his front edge, the table jolts,
     the chips shake (CoinWorld.shake), dust, and a low thud.
   - The cable is a little rope (verlet), pinned at the COACH key and the
     back of the set, drawn in pixels.
   - Booting: power runs up the cable, a relay clicks, a dot, a line,
     static, then his eyes blink on and look round before settling.

   Presentation only: nothing here reads a hand or game state. Not loaded
   by the game; coach-face-lab.html injects it into its copy.
   CoachSet.apply(order), CoachSet.power(on), CoachSet.setMood(m),
   CoachSet.look(target), CoachSet.talk(ms).
   ============================================================ */
const CoachSet = (() => {
  const P = 2;                        // screen pixels per art pixel
  const FPS = 14, FRAME = 1000 / FPS; // the 2.5D step
  const $id = id => document.getElementById(id);
  const motionOffSafe = () => { try{ return typeof motionOff === 'function' && motionOff(); }catch(e){ return false; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------------- palettes ---------------- */
  const INK = '#080405';
  const FINISHES = {
    machine:  { base:'#5A2328', hi:'#83404A', lo:'#34141A', trim:'#E8B83A', trimLo:'#9C7420' },
    cream:    { base:'#D6C7A0', hi:'#F2E8CB', lo:'#9A8A64', trim:'#7A3A2A', trimLo:'#4A2016' },
    gunmetal: { base:'#40454C', hi:'#6B727B', lo:'#24272C', trim:'#E8B83A', trimLo:'#9C7420' }
  };
  // DASHBOARD: the console's own case, read from the live theme (so it
  // follows Settings → theme), with the gold of its trim
  function palOf(id){
    if (id === 'dashboard'){
      const cs = getComputedStyle(document.body);
      const v = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
      const mix = (a, b, t) => { const h = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); const A = h(a), B = h(b); return '#' + A.map((c, i) => Math.round(c + (B[i] - c) * t).toString(16).padStart(2, '0')).join(''); };
      const base = v('--theme-case-raised', '#3E7457'), hi = v('--theme-case-hi', '#69A880');
      return { base:mix(base, '#000000', .18), hi:mix(base, hi, .6), lo:mix(base, '#000000', .54), trim:'#E8B83A', trimLo:'#9C7420' };
    }
    return FINISHES[id] || FINISHES.machine;
  }
  const INKS = { machine:'#C3C8AD', green:'#7CF29A', amber:'#F6C257' };
  const GLASS = '#0A120F', GLASS_RIM = '#050807';

  /* ---------------- the sets (pixel art, drawn in code) ----------------
     Each returns { w, h, screen:{x,y,w,h}, port:{x,y}, draw(ctx, pal, led) }.
     Coordinates are art pixels. */
  function px(c, col, x, y, w, h){ c.fillStyle = col; c.fillRect(x, y, w || 1, h || 1); }
  // a box with 1px cut corners, a lit top-left and a shaded bottom-right
  function box(c, pal, x, y, w, h, cut){
    cut = cut == null ? 2 : cut;
    px(c, INK, x + cut, y, w - cut * 2, h); px(c, INK, x, y + cut, w, h - cut * 2);
    if (cut > 1){ px(c, INK, x + 1, y + 1, w - 2, h - 2); }
    px(c, pal.base, x + cut, y + 1, w - cut * 2, h - 2); px(c, pal.base, x + 1, y + cut, w - 2, h - cut * 2);
    px(c, pal.hi, x + cut, y + 1, w - cut * 2, 2);           // lit top edge (the lamp)
    px(c, pal.hi, x + 1, y + cut, 1, h - cut * 2 - 2);        // lit left
    px(c, pal.lo, x + cut, y + h - 3, w - cut * 2, 2);        // shaded bottom
    px(c, pal.lo, x + w - 2, y + cut, 1, h - cut * 2);        // shaded right
  }
  function screenWell(c, x, y, w, h){
    px(c, INK, x, y, w, h);
    px(c, GLASS_RIM, x + 1, y + 1, w - 2, h - 2);
    px(c, GLASS, x + 2, y + 2, w - 4, h - 4);
    // the corners of a tube
    [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]].forEach(p => px(c, INK, p[0], p[1]));
  }
  function knob(c, cx, cy, r){
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++){
      const d = xx * xx + yy * yy;
      if (d <= r * r + r * .6) px(c, d > (r - 1) * (r - 1) + (r - 1) * .6 ? INK : (xx + yy < 0 ? '#B8A988' : '#6A5D48'), cx + xx, cy + yy);
    }
  }
  // the lamp: off, booting (the LED option's colour) or on (green)
  const LED_BOOT = { amber:'#F2B431', red:'#E0503C', green:'#8CF0A8' };
  let ledBoot = 'amber';
  function led(c, x, y, st){
    const col = st === 'boot' ? (LED_BOOT[ledBoot] || LED_BOOT.amber) : st ? '#8CF0A8' : '#1D3A28';
    px(c, INK, x - 1, y - 1, 4, 3); px(c, col, x, y, 2, 1);
  }
  function feet(c, x1, x2, y){ px(c, INK, x1, y, 6, 2); px(c, INK, x2, y, 6, 2); }

  const SETS = {
    portable:{ name:'PORTABLE', w:48, h:42, box:{ x:0, y:5, w:48, h:35 }, depth:26, screen:{ x:6, y:11, w:26, h:20 }, port:{ x:46, y:34 },
      draw(c, pal, on){
        // carry handle
        px(c, INK, 13, 0, 22, 3); px(c, pal.trim, 14, 1, 20, 1); px(c, INK, 13, 0, 3, 7); px(c, INK, 32, 0, 3, 7);
        px(c, pal.trim, 14, 1, 1, 5); px(c, pal.trimLo, 33, 1, 1, 5);
        box(c, pal, 0, 5, 48, 35);
        screenWell(c, 4, 9, 30, 24);
        // side panel: two knobs and a speaker
        knob(c, 40, 14, 3); knob(c, 40, 22, 2);
        for (let yy = 26; yy <= 31; yy += 2) px(c, INK, 37, yy, 7, 1);
        // gold trim under the screen, the lamp
        px(c, pal.trim, 3, 35, 42, 1); px(c, pal.trimLo, 3, 36, 42, 1);
        led(c, 40, 33, on);
        feet(c, 4, 38, 40);
      } },
    cube:{ name:'CUBE', w:40, h:42, box:{ x:0, y:0, w:40, h:40 }, depth:34, screen:{ x:6, y:6, w:28, h:21 }, port:{ x:38, y:34 },
      draw(c, pal, on){
        box(c, pal, 0, 0, 40, 40, 3);
        screenWell(c, 4, 4, 32, 25);
        // a brass plate and the lamp
        px(c, INK, 9, 31, 20, 5); px(c, pal.trim, 10, 32, 18, 3); px(c, pal.trimLo, 10, 34, 18, 1);
        for (let xx = 12; xx < 26; xx += 3) px(c, pal.trimLo, xx, 33, 2, 1);
        led(c, 32, 33, on);
        feet(c, 4, 30, 40);
      } },
    monitor:{ name:'MONITOR', w:50, h:42, box:{ x:0, y:0, w:50, h:33 }, depth:36, screen:{ x:5, y:5, w:40, h:22 }, port:{ x:44, y:38 },
      draw(c, pal, on){
        box(c, pal, 0, 0, 50, 33);
        screenWell(c, 3, 3, 44, 26);
        led(c, 43, 30, on); px(c, INK, 6, 30, 3, 1); px(c, INK, 10, 30, 3, 1);
        // neck and foot
        px(c, INK, 19, 33, 12, 4); px(c, pal.lo, 20, 33, 10, 3);
        px(c, INK, 10, 36, 30, 6); px(c, pal.base, 11, 37, 28, 4); px(c, pal.hi, 11, 37, 28, 1); px(c, pal.lo, 11, 40, 28, 1);
      } }
  };

  /* ---------------- the face: two dots and a mouth ---------------- */
  const EYE = {
    dot:[[0,0],[1,0],[0,1],[1,1]],
    tall:[[0,-1],[1,-1],[0,0],[1,0],[0,1],[1,1]],
    half:[[0,1],[1,1]],
    blink:[[0,1],[1,1]],
    squintL:[[0,-1],[1,0],[0,1]],
    squintR:[[1,-1],[0,0],[1,1]]
  };
  const MOUTH = {
    flat:[[-2,0],[-1,0],[0,0],[1,0]],
    smile:[[-3,-1],[-2,0],[-1,0],[0,0],[1,0],[2,-1]],
    grin:[[-3,-1],[-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],[-2,0],[-1,0],[0,0],[1,0]],
    o:[[-1,0],[0,0],[-1,1],[0,1]],
    wavy:[[-3,0],[-2,-1],[-1,0],[0,-1],[1,0],[2,-1]],
    frown:[[-3,1],[-2,0],[-1,0],[0,0],[1,0],[2,1]],
    short:[[-1,0],[0,0],[1,0]],
    talk:[[-2,-1],[-1,-1],[0,-1],[1,-1],[-2,0],[-1,0],[0,0],[1,0]]
  };
  const MOODS = [
    ['calm', 'CALM', { eyes:'dot', mouth:'flat' }],
    ['pleased', 'PLEASED', { eyes:'dot', mouth:'smile' }],
    ['impressed', 'IMPRESSED', { eyes:'tall', mouth:'grin' }],
    ['surprised', 'SURPRISED', { eyes:'tall', mouth:'o', lift:-1 }],
    ['wince', 'WINCE', { eyes:'squint', mouth:'wavy' }],
    ['unlucky', 'UNLUCKY', { eyes:'half', mouth:'frown' }],
    ['thinking', 'THINKING', { eyes:'dot', mouth:'short', gaze:[2,-2], mx:1 }]
  ];
  const moodOf = id => (MOODS.find(m => m[0] === id) || MOODS[0])[2];

  function drawFace(c, W, H, st, ink){
    c.clearRect(0, 0, W, H);
    c.fillStyle = ink;
    const m = moodOf(st.mood);
    const g = st.gaze || m.gaze || [0, 0];
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    const ey = cy - 3 + (m.lift || 0) + g[1], ex = g[0];
    const eyeL = st.blink ? EYE.blink : m.eyes === 'squint' ? EYE.squintL : EYE[m.eyes];
    const eyeR = st.blink ? EYE.blink : m.eyes === 'squint' ? EYE.squintR : EYE[m.eyes];
    eyeL.forEach(p => c.fillRect(cx - 5 + ex + p[0], ey + p[1], 1, 1));
    eyeR.forEach(p => c.fillRect(cx + 3 + ex + p[0], ey + p[1], 1, 1));
    if (!st.noMouth){
      const mouth = st.talk ? MOUTH.talk : MOUTH[m.mouth];
      const mx = cx + (m.mx || 0) + Math.round(g[0] / 2), my = cy + 3 + (g[1] > 0 ? 1 : 0);
      mouth.forEach(p => c.fillRect(mx + p[0], my + p[1], 1, 1));
    }
    if (st.glasses){
      c.globalAlpha = .5;
      [[cx - 5 + ex, ey], [cx + 3 + ex, ey]].forEach(([x, y]) => {
        c.fillRect(x - 2, y - 2, 6, 1); c.fillRect(x - 2, y + 3, 6, 1); c.fillRect(x - 2, y - 1, 1, 4); c.fillRect(x + 3, y - 1, 1, 4);
      });
      c.fillRect(cx - 1 + ex, ey - 1, 2, 1);
      c.globalAlpha = 1;
    }
  }
  /* a 3x5 pixel font for the tube's boot text */
  const GLYPHS = {
    A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110', E:'111100110100111', F:'111100110100100',
    G:'011100101101011', H:'101101111101101', I:'111010010010111', K:'101110100110101', L:'100100100100111', M:'101111111101101',
    N:'110101101101101', O:'010101101101010', P:'110101110100100', R:'110101110101101', S:'011100010001110', T:'111010010010010',
    U:'101101101101111', V:'101101101101010', W:'101101111111101', Y:'101101010010010',
    '0':'111101101101111', '1':'010110010010111', '2':'110001010100111', '3':'110001010001110', '4':'101101111001001',
    '5':'111100110001110', '6':'011100111101111', '7':'111001010010010', '8':'111101111101111', '9':'111101111001110',
    '.':'000000000000010', '-':'000000111000000', ':':'000010000010000', '?':'110001010000010', '!':'010010010000010', ' ':'000000000000000'
  };
  function drawText(c, str, x, y, col){
    c.fillStyle = col;
    String(str).toUpperCase().split('').forEach((ch, i) => {
      const g = GLYPHS[ch] || GLYPHS['?'];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') c.fillRect(x + i * 4 + q, y + r, 1, 1);
    });
  }
  // the boot's frames on the tube: a dot, a line, static, typed text
  function drawBoot(c, W, H, kind, t, ink, extra){
    c.clearRect(0, 0, W, H);
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    if (kind === 'text'){
      const lines = (extra && extra.lines) || [];
      lines.forEach((l, i) => drawText(c, l, 2, 2 + i * 6, ink));
      if (extra && extra.cursor){ const last = lines[lines.length - 1] || '', row = Math.max(0, lines.length - 1); c.fillStyle = ink; c.fillRect(2 + last.length * 4, 2 + row * 6, 3, 5); }
      return;
    }
    if (kind === 'dot'){ c.fillStyle = '#fff'; c.fillRect(cx - 1, cy, 2, 1); }
    else if (kind === 'line'){ const w = Math.max(2, Math.round(W * t)); c.fillStyle = '#fff'; c.fillRect(cx - (w >> 1), cy, w, 1); c.fillStyle = ink; c.fillRect(cx - (w >> 1), cy - 1, w, 1); }
    else if (kind === 'static'){
      c.fillStyle = ink;
      for (let i = 0; i < W * H * .28; i++) c.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
    }
  }

  /* ---------------- sound (its own context, gated by the game's) ---------------- */
  let actx = null;
  const soundOn = () => { try{ return !!settings.sound; }catch(e){ return true; } };
  function ac(){
    if (!soundOn()) return null;
    if (!actx){ try{ const AC = window.AudioContext || window.webkitAudioContext; actx = AC ? new AC() : null; }catch(e){ actx = null; } }
    if (actx && actx.state === 'suspended'){ try{ actx.resume(); }catch(e){} }
    return actx;
  }
  ['touchend', 'click'].forEach(ev => addEventListener(ev, () => ac(), { passive:true }));
  let master = null, masterLevel = 1;
  function out(ctx){
    if (!master || master.context !== ctx){ master = ctx.createGain(); master.connect(out(ctx)); }
    master.gain.value = masterLevel;
    return master;
  }
  function noise(ctx, dur){
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  const SFX = {
    thud(weight){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime, w = weight || 1;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + .22);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55 * w, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + .32);
      o.connect(g).connect(out(ctx)); o.start(t); o.stop(t + .34);
      const n = noise(ctx, .09), f = ctx.createBiquadFilter(), ng = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 600; ng.gain.setValueAtTime(.35 * w, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .09);
      n.connect(f).connect(ng).connect(out(ctx)); n.start(t);
      // the set's own rattle, a hair later
      const r = noise(ctx, .05), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
      rf.type = 'bandpass'; rf.frequency.value = 2400; rf.Q.value = 3; rg.gain.setValueAtTime(.08 * w, t + .03); rg.gain.exponentialRampToValueAtTime(.0001, t + .09);
      r.connect(rf).connect(rg).connect(out(ctx)); r.start(t + .03);
    },
    clack(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      [0, .045].forEach((d, i) => {
        const n = noise(ctx, .025), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = i ? 1800 : 3200; f.Q.value = 4;
        g.gain.setValueAtTime(.3, t + d); g.gain.exponentialRampToValueAtTime(.0001, t + d + .025);
        n.connect(f).connect(g).connect(out(ctx)); n.start(t + d);
      });
    },
    whine(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(3400, t + .5);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.035, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + .6);
      o.connect(g).connect(out(ctx)); o.start(t); o.stop(t + .62);
    },
    hiss(dur){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const n = noise(ctx, dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'highpass'; f.frequency.value = 1500; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      n.connect(f).connect(g).connect(out(ctx)); n.start(t);
    },
    blip(up){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      (up ? [660, 990] : [880, 520]).forEach((hz, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * .07;
        o.type = 'square'; o.frequency.value = hz;
        g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.05, s + .005); g.gain.exponentialRampToValueAtTime(.0001, s + .06);
        o.connect(g).connect(out(ctx)); o.start(s); o.stop(s + .07);
      });
    },
    relay(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      [0, .018].forEach(d => {
        const n = noise(ctx, .012), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'highpass'; f.frequency.value = 2500; g.gain.setValueAtTime(.22, t + d); g.gain.exponentialRampToValueAtTime(.0001, t + d + .012);
        n.connect(f).connect(g).connect(out(ctx)); n.start(t + d);
      });
    },
    tick(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 1320 + Math.random() * 120;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.025, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .03);
      o.connect(g).connect(out(ctx)); o.start(t); o.stop(t + .035);
    },
    zap(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const n = noise(ctx, .08), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 2; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08);
      n.connect(f).connect(g).connect(out(ctx)); n.start(t);
    },
    scrape(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const n = noise(ctx, .22), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(260, t + .2); f.Q.value = 1.4;
      g.gain.setValueAtTime(.16, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      n.connect(f).connect(g).connect(out(ctx)); n.start(t);
    }
  };

  /* ---------------- the order ---------------- */
  const OPTIONS = {
    set:[['cube', 'CUBE'], ['portable', 'PORTABLE'], ['monitor', 'MONITOR']],
    finish:[['dashboard', 'DASHBOARD'], ['machine', 'BURGUNDY'], ['cream', 'CREAM'], ['gunmetal', 'GUNMETAL']],
    ink:[['machine', 'MACHINE'], ['green', 'GREEN'], ['amber', 'AMBER']],
    glasses:[['off', 'OFF'], ['on', 'ON']],
    from:[['under', 'FROM UNDER THE TABLE'], ['side', 'SLID IN FROM THE SIDE']],
    weight:[['heavy', 'HEAVY'], ['brick', 'VERY HEAVY'], ['light', 'LIGHTER']],
    jolt:[['on', 'TABLE JOLTS'], ['off', 'NO JOLT']],
    dust:[['on', 'DUST'], ['off', 'NONE']],
    boot:[['full', 'FULL BOOT'], ['quick', 'QUICK']],
    cable:[['rope', 'LOOSE'], ['tight', 'SHORTER']],
    turn:[['random', 'A UP + B DOWN, OR REVERSED'], ['in', 'ALWAYS A'], ['out', 'ALWAYS B']],
    lines:[['clean', 'CLEAN'], ['full', 'FULL INK'], ['soft', 'SOFT']],
    speed:[['1', 'NORMAL'], ['4', 'SLOW x4'], ['10', 'SLOW x10']],
    /* the Rig Lab (round 4): the lead and the boot. First of each is my suggestion. */
    lead:[['thick', 'THICK'], ['thin', 'THIN (ROUND 3)'], ['coiled', 'COILED'], ['braided', 'BRAIDED']],
    leadCol:[['black', 'BLACK'], ['grey', 'GREY'], ['cream', 'CREAM'], ['dash', 'DASHBOARD']],
    length:[['medium', 'MEDIUM'], ['short', 'SHORT'], ['long', 'LONG']],
    exit:[['back', 'BACK CORNER'], ['side', 'SIDE'], ['bottom', 'UNDERNEATH']],
    plug:[['jack', 'JACK'], ['block', 'BLOCK'], ['rca', 'RED RCA']],
    jack:[['none', 'STRAIGHT INTO THE DASHBOARD'], ['lamp', 'PLATE + LAMP'], ['plate', 'PLATE'], ['ring', 'RING (ROUND 3)']],
    plugIn:[['push', 'LIFTED IN'], ['slide', 'SLID ALONG'], ['snap', 'SNAPS IN']],
    unplug:[['yank', 'YANKED'], ['pop', 'POPS (ROUND 3)'], ['slide', 'SLID OUT']],
    spark:[['on', 'SPARK'], ['off', 'NONE']],
    leadJolt:[['bounce', 'JUMPS ON THE THUD'], ['none', 'STAYS PUT']],
    leadStep:[['stepped', '14 A SECOND'], ['smooth', 'SMOOTH']],
    power:[['fill', 'LEAD LIGHTS UP'], ['pulse', 'ONE PULSE (ROUND 3)'], ['none', 'NOTHING']],
    tube:[['crt', 'DOT, LINE, STATIC'], ['text', 'TYPES A LINE'], ['bios', 'SYSTEM CHECK'], ['scan', 'SCANS DOWN'], ['flicker', 'FLICKERS ON']],
    says:[['coach', 'COACH / ONLINE'], ['hello', 'HELLO'], ['ready', 'READY'], ['none', 'JUST A CURSOR']],
    wake:[['look', 'BLINKS + LOOKS ROUND'], ['blinks', 'TWO BLINKS'], ['wide', 'WIDE EYES'], ['none', 'STRAIGHT ON']],
    led:[['amber', 'AMBER THEN GREEN'], ['red', 'RED THEN GREEN'], ['green', 'GREEN']],
    coachSound:[['full', 'FULL'], ['soft', 'SOFT'], ['off', 'OFF']],
    bootLen:[['full', 'FULL'], ['quick', 'QUICK (MID-GAME)']],
    shutdown:[['crt', 'LINE TO A DOT'], ['blink', 'SHUTS HIS EYES'], ['text', 'TYPES BYE']]
  };
  // The owner's picks (round 3, 29 Sep 2026): CUBE, DASHBOARD, CLEAN lines,
  // from UNDER the table, turning A up and B down or the reverse at random.
  // Rig Lab round 1 (29 Sep 2026): a COILED BLACK lead, MEDIUM, from the
  // BACK CORNER, jumping on the thud, stepped; a BLOCK plug straight into
  // the dashboard (no socket), LIFTED IN, YANKED out, a SPARK; the lead
  // LIGHTS UP, DOT-LINE-STATIC, JUST A CURSOR, BLINKS + LOOKS ROUND, AMBER
  // then green, FULL, sounds FULL, off LINE TO A DOT.
  const DEFAULTS = { set:'cube', finish:'dashboard', ink:'machine', glasses:'off', from:'under', weight:'heavy', jolt:'on', dust:'on', boot:'full', cable:'rope', turn:'random', lines:'clean', speed:'1', mood:'calm',
    lead:'coiled', leadCol:'black', length:'medium', exit:'back', plug:'block', jack:'none', plugIn:'push', unplug:'yank', spark:'on', leadJolt:'bounce', leadStep:'stepped',
    power:'fill', tube:'crt', says:'none', wake:'look', led:'amber', coachSound:'full', bootLen:'full', shutdown:'crt' };
  const WEIGHT = { heavy:{ g:1, squash:.16, jolt:2, thud:1 }, brick:{ g:1.35, squash:.22, jolt:3, thud:1.25 }, light:{ g:.75, squash:.1, jolt:1, thud:.7 } };
  let O = Object.assign({}, DEFAULTS);

  /* ---------------- DOM ---------------- */
  let layer = null, tv = null, body = null, face = null, shadow = null, cableC = null, key = null;
  let on = false, busy = false, st = { mood:'calm', gaze:null, blink:false, talk:false };
  let pose = { x:0, y:0, lift:0, sx:1, sy:1, bank:0, lean:0, yaw:0, pitch:0, roll:0 }, home = { x:0, y:0 };
  let bootFrame = null;   // while booting, the tube shows these instead of the face
  const setOf = () => SETS[O.set] || SETS.portable;

  function ensureLayer(){
    const felt = $id('felt'); if (!felt) return false;
    if (!layer || !layer.isConnected){
      layer = document.createElement('div'); layer.className = 'cs-layer'; felt.appendChild(layer);
      shadow = document.createElement('i'); shadow.className = 'cs-shadow'; layer.appendChild(shadow);
      tv = document.createElement('div'); tv.className = 'cs-tv'; tv.id = 'coach-station'; tv.setAttribute('aria-label', 'Coach'); layer.appendChild(tv);
    }
    if (!cableC || !cableC.isConnected){
      cableC = document.createElement('canvas'); cableC.className = 'cs-cable'; document.body.appendChild(cableC);
    }
    return true;
  }
  function ensureKey(){
    if (key && key.isConnected) return key;
    const gear = $id('open-settings'); if (!gear) return null;
    key = document.createElement('button');
    key.type = 'button'; key.id = 'coach-key'; key.className = 'icon-btn table-settings coach-key';
    key.setAttribute('aria-label', 'Coach'); key.setAttribute('aria-pressed', 'false');
    // a little TV with two dots: the coach
    key.innerHTML = '<svg class="ck-icon" viewBox="0 0 12 10" shape-rendering="crispEdges" aria-hidden="true">' +
      '<path d="M1 1h10v7H1z" fill="none" stroke="currentColor" stroke-width="1"/><rect x="4" y="4" width="1" height="1" fill="currentColor"/><rect x="7" y="4" width="1" height="1" fill="currentColor"/>' +
      '<rect x="3" y="9" width="2" height="1" fill="currentColor"/><rect x="7" y="9" width="2" height="1" fill="currentColor"/></svg><span class="ck-lamp"></span>';
    // the two small keys side by side where ⚙ sat alone
    const row = document.createElement('div'); row.className = 'ck-row';
    gear.parentNode.insertBefore(row, gear); row.append(gear, key);
    key.addEventListener('click', () => power(!on));
    return key;
  }
  function build(){
    if (!ensureLayer()) return;
    const S = setOf();
    tv.style.width = S.w * P + 'px'; tv.style.height = S.h * P + 'px';
    tv.innerHTML = '';
    body = document.createElement('canvas'); body.className = 'cs-body'; body.width = S.w; body.height = S.h;
    Object.assign(body.style, { width:S.w * P + 'px', height:S.h * P + 'px' });
    face = document.createElement('canvas'); face.className = 'cs-face'; face.width = S.screen.w; face.height = S.screen.h;
    Object.assign(face.style, { left:S.screen.x * P + 'px', top:S.screen.y * P + 'px', width:S.screen.w * P + 'px', height:S.screen.h * P + 'px', color:INKS[O.ink] });
    const scan = document.createElement('i'); scan.className = 'cs-scan';
    Object.assign(scan.style, { left:S.screen.x * P + 'px', top:S.screen.y * P + 'px', width:S.screen.w * P + 'px', height:S.screen.h * P + 'px' });
    // the set in the round, for the lift: drawn fresh every step
    c3 = document.createElement('canvas'); c3.className = 'cs-3d'; c3.width = C3; c3.height = C3;
    const bcx = S.box.x + S.box.w / 2, bcy = S.box.y + S.box.h / 2;
    Object.assign(c3.style, { left:Math.round(bcx - C3 / 2) * P + 'px', top:Math.round(bcy - C3 / 2) * P + 'px', width:C3 * P + 'px', height:C3 * P + 'px' });
    tv.append(body, face, scan, c3);
    buildSolid();
    paintBody(); paintFace();
    shadow.style.width = Math.round(S.w * P * .92) + 'px';
    measureHome(); render();
  }
  function paintBody(){
    if (!body) return;
    const c = body.getContext('2d');
    c.clearRect(0, 0, body.width, body.height);
    setOf().draw(c, palOf(O.finish), ledState);
  }
  let ledState = false;

  /* ---------------- the set in the round ----------------
     For the lift on and off the table the set is a real box: its front is
     the sprite's own front, and its top, sides, back and bottom are drawn
     here (vents, the seam of the back cover, a panel and screws on the
     back). Every step it's rendered afresh at art-pixel size by casting
     one ray per pixel (orthographic, so face-on it is exactly the flat
     sprite), each face lit in hard steps from the table lamp, then inked:
     a one-pixel outline round the whole shape and along every crease. */
  const C3 = 84;
  let c3 = null, solid = null;
  const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixRGB = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
  function buildSolid(){
    const S = setOf(), b = S.box, pal = palOf(O.finish);
    const cv = document.createElement('canvas'); cv.width = S.w; cv.height = S.h;
    const c = cv.getContext('2d'); S.draw(c, pal, false);
    const lo = hexRGB(pal.lo), base = hexRGB(pal.base), hi = hexRGB(pal.hi);
    solid = {
      w:b.w, h:b.h, d:S.depth || 30,
      front:c.getImageData(b.x, b.y, b.w, b.h).data,
      // ink, deep shade, shade, case, lit, lamp glint
      ramp:[hexRGB(INK), mixRGB(lo, [0, 0, 0], .45), lo, base, hi, mixRGB(hi, [255, 244, 220], .35)],
      trim:hexRGB(pal.trim), trimLo:hexRGB(pal.trimLo)
    };
  }
  // world light: up (-y), a little left, towards the player (-z)
  const LIGHT = (() => { const v = [-.35, -.78, -.52], n = Math.hypot(...v); return v.map(x => x / n); })();
  function rotMatrix(yaw, pitch, roll){
    const r = Math.PI / 180, cy = Math.cos(yaw * r), sy = Math.sin(yaw * r), cp = Math.cos(pitch * r), sp = Math.sin(pitch * r), cr = Math.cos(roll * r), sr = Math.sin(roll * r);
    // R = Rz(roll) * Ry(yaw) * Rx(pitch): object to world
    const Rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]], Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
    const mul = (A, B) => A.map((row, i) => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
    return mul(Rz, mul(Ry, Rx));
  }
  const NORMALS = { front:[0, 0, -1], back:[0, 0, 1], top:[0, -1, 0], bottom:[0, 1, 0], left:[-1, 0, 0], right:[1, 0, 0] };
  const FACE_ID = { front:1, back:2, top:3, bottom:4, left:5, right:6 };
  // the case's detail on each face: a step up or down the ramp (0 = plain)
  function detail(faceName, u, v, W, H){
    const rv = Math.floor(v), ru = Math.floor(u);
    if (faceName === 'top'){
      if (rv === 0) return 1;                                          // lit front lip
      if (rv === Math.round(H * .3)) return -1;                        // seam of the back cover
      if (rv > H * .45 && rv < H * .85 && ru > 4 && ru < W - 5 && ru % 4 < 2) return -2;   // vents
      return 0;
    }
    if (faceName === 'left' || faceName === 'right'){
      if (ru === Math.round(W * .3)) return -1;
      if (ru > W * .45 && ru < W * .85 && rv > 5 && rv < H - 6 && rv % 4 < 2) return -2;
      if (rv >= H - 1) return -1;
      return 0;
    }
    if (faceName === 'back'){
      if (ru < 2 || ru >= W - 2 || rv < 2 || rv >= H - 2) return 0;
      if (ru === 3 || ru === W - 4 || rv === 3 || rv === H - 4) return -1;   // the panel
      if ((ru === 5 || ru === W - 6) && (rv === 5 || rv === H - 6)) return 2; // screws
      if (ru > W - 12 && ru < W - 7 && rv > H - 11 && rv < H - 7) return -3;  // the port
      return 0;
    }
    if (faceName === 'bottom') return -1;
    return 0;
  }
  function level(b){ return b > .62 ? 1 : b > .2 ? 0 : b > -.25 ? -1 : -2; }
  function render3D(target, pz){
    target = target || c3; pz = pz || pose;
    if (!target || !solid) return;
    const cx = target.getContext('2d'), img = cx.createImageData(C3, C3), out = img.data;
    const ids = new Uint8Array(C3 * C3);
    const R = rotMatrix(pz.yaw || 0, pz.pitch || 0, pz.roll || 0);
    const hx = solid.w / 2, hy = solid.h / 2, hz = solid.d / 2, hs = [hx, hy, hz];
    const sc = 1 + Math.max(0, pz.lift) / 320;       // a touch bigger as he's lifted towards you
    const d = [R[2][0], R[2][1], R[2][2]];              // the view ray (0,0,1) in the box's space
    const lit = {};
    Object.keys(NORMALS).forEach(k => { const n = NORMALS[k], w = [0, 1, 2].map(i => R[i][0] * n[0] + R[i][1] * n[1] + R[i][2] * n[2]); lit[k] = level(w[0] * LIGHT[0] + w[1] * LIGHT[1] + w[2] * LIGHT[2]); });
    const frontRest = level(-LIGHT[2]);
    for (let py = 0; py < C3; py++) for (let px = 0; px < C3; px++){
      const wx = (px + .5 - C3 / 2) / sc, wy = (py + .5 - C3 / 2) / sc, wz = -400;
      const o = [R[0][0] * wx + R[1][0] * wy + R[2][0] * wz, R[0][1] * wx + R[1][1] * wy + R[2][1] * wz, R[0][2] * wx + R[1][2] * wy + R[2][2] * wz];
      let tn = -Infinity, tf = Infinity, ax = -1;
      for (let i = 0; i < 3; i++){
        if (Math.abs(d[i]) < 1e-9){ if (o[i] < -hs[i] || o[i] > hs[i]){ tn = Infinity; break; } continue; }
        let t1 = (-hs[i] - o[i]) / d[i], t2 = (hs[i] - o[i]) / d[i];
        if (t1 > t2){ const t = t1; t1 = t2; t2 = t; }
        if (t1 > tn){ tn = t1; ax = i; }
        if (t2 < tf) tf = t2;
      }
      if (!(tn < tf) || ax < 0) continue;
      const p = [o[0] + d[0] * tn, o[1] + d[1] * tn, o[2] + d[2] * tn], neg = d[ax] > 0;
      const name = ax === 0 ? (neg ? 'left' : 'right') : ax === 1 ? (neg ? 'top' : 'bottom') : (neg ? 'front' : 'back');
      const k = (py * C3 + px) * 4;
      let rgb;
      if (name === 'front'){
        const u = Math.min(solid.w - 1, Math.max(0, Math.floor(p[0] + hx))), v = Math.min(solid.h - 1, Math.max(0, Math.floor(p[1] + hy))), t = (v * solid.w + u) * 4;
        rgb = [solid.front[t], solid.front[t + 1], solid.front[t + 2]];
        const dl = lit.front - frontRest;
        if (dl < 0) rgb = mixRGB(rgb, [0, 0, 0], Math.min(.6, -dl * .26));
        else if (dl > 0) rgb = mixRGB(rgb, [255, 244, 220], .12);
      } else {
        let u, v, W, H;
        if (name === 'top' || name === 'bottom'){ u = p[0] + hx; v = p[2] + hz; W = solid.w; H = solid.d; }
        else if (name === 'left' || name === 'right'){ u = p[2] + hz; v = p[1] + hy; W = solid.d; H = solid.h; }
        else { u = hx - p[0]; v = p[1] + hy; W = solid.w; H = solid.h; }
        const idx = Math.max(0, Math.min(5, 3 + lit[name] + detail(name, u, v, W, H)));
        rgb = solid.ramp[idx];
      }
      out[k] = rgb[0]; out[k + 1] = rgb[1]; out[k + 2] = rgb[2]; out[k + 3] = 255;
      ids[py * C3 + px] = FACE_ID[name];
    }
    /* lines. FULL: ink round the shape and along every crease (round 3c).
       CLEAN: ink round the shape except where the front's own drawn border
       already is, creases only between two case faces (so no doubled black
       next to the front). SOFT: the outline in deep shade, no creases. */
    const mode = O.lines || 'clean', F = FACE_ID.front;
    const ink = mode === 'soft' ? solid.ramp[1] : solid.ramp[0];
    const put = (i) => { const k = i * 4; out[k] = ink[0]; out[k + 1] = ink[1]; out[k + 2] = ink[2]; out[k + 3] = 255; };
    const marks = [];
    for (let y = 0; y < C3; y++) for (let x = 0; x < C3; x++){
      const i = y * C3 + x, id = ids[i];
      if (!id){
        const nb = [x > 0 ? ids[i - 1] : 0, x < C3 - 1 ? ids[i + 1] : 0, y > 0 ? ids[i - C3] : 0, y < C3 - 1 ? ids[i + C3] : 0].filter(Boolean);
        if (!nb.length) continue;
        if (mode !== 'full' && nb.every(n => n === F)) continue;
        marks.push(i);
      } else if (mode !== 'soft'){
        const r = x < C3 - 1 ? ids[i + 1] : 0, d2 = y < C3 - 1 ? ids[i + C3] : 0;
        const crease = (r && r !== id) || (d2 && d2 !== id);
        if (!crease) continue;
        if (mode === 'full'){ if (id !== F) marks.push(i); else marks.push(r && r !== id ? i + 1 : i + C3); }
        else if (id !== F && (!r || r === id || r !== F) && (!d2 || d2 === id || d2 !== F)) marks.push(i);
      }
    }
    marks.forEach(put);
    cx.putImageData(img, 0, 0);
  }

  /* where he sits: the deck's mirror, bottoms level */
  function measureHome(){
    const felt = $id('felt'), stn = felt && felt.querySelector('.dealer-station');
    if (!felt || !stn || !tv) return;
    const fr = felt.getBoundingClientRect(), dr = stn.getBoundingClientRect();
    if (!fr.width || !dr.width) return;
    const x0 = fr.left + felt.clientLeft, y0 = fr.top + felt.clientTop, w = felt.clientWidth;
    const deckX = dr.left + dr.width / 2 - x0;
    const S = setOf();
    home.x = Math.round((w - deckX) - S.w * P / 2);
    home.y = Math.round((dr.bottom - y0) - S.h * P);
    home.left = deckX > w / 2;          // he's on the left when the deck is on the right
    home.edge = felt.clientHeight;      // the table's near edge, in the layer
    home.w = w;
  }
  function render(){
    if (!tv) return;
    const S = setOf();
    const x = Math.round((home.x + pose.x) / P) * P, y = Math.round((home.y + pose.y - pose.lift) / P) * P;
    // in the air he's the box in the round; down on the felt, the flat sprite
    const air = pose.lift > .5 || pose.y > .5 || Math.abs(pose.yaw || 0) + Math.abs(pose.pitch || 0) + Math.abs(pose.roll || 0) > .5;
    tv.classList.toggle('is-air', air);
    if (air) render3D();
    tv.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + pose.sx.toFixed(3) + ',' + pose.sy.toFixed(3) + ')';
    // the shadow stays on the felt under him, smaller and fainter as he lifts
    const h = Math.max(0, pose.lift), k = Math.max(.35, 1 - h / 140);
    const sw = Math.round(S.w * P * .92 * k / P) * P;
    shadow.style.width = sw + 'px';
    shadow.style.transform = 'translate(' + (Math.round((home.x + pose.x + S.w * P / 2 - sw / 2) / P) * P) + 'px,' + (Math.round((home.y + pose.y + S.h * P - 5) / P) * P) + 'px)';
    shadow.style.opacity = (Math.round(k * 4) / 4 * .55).toFixed(2);
    const below = home.y + pose.y - pose.lift > home.edge;
    shadow.style.visibility = (!on && !busy) || below || pose.hideShadow ? 'hidden' : 'visible';
    tv.style.visibility = (!on && !busy) ? 'hidden' : 'visible';
  }

  function paintFace(){
    if (!face) return;
    const c = face.getContext('2d'), S = setOf();
    if (!on && !bootFrame){ c.clearRect(0, 0, S.screen.w, S.screen.h); return; }
    if (bootFrame && bootFrame.kind === 'scan'){
      // the face drawn down to the scanning bar, the bar bright
      drawFace(c, S.screen.w, S.screen.h, Object.assign({}, st, { glasses:O.glasses === 'on' }), INKS[O.ink]);
      c.clearRect(0, bootFrame.row + 1, S.screen.w, S.screen.h);
      c.fillStyle = '#fff'; c.fillRect(0, bootFrame.row, S.screen.w, 1);
      return;
    }
    if (bootFrame){ drawBoot(c, S.screen.w, S.screen.h, bootFrame.kind, bootFrame.t, INKS[O.ink], bootFrame.extra); return; }
    drawFace(c, S.screen.w, S.screen.h, Object.assign({}, st, { glasses:O.glasses === 'on' }), INKS[O.ink]);
  }

  /* ---------------- the cable: an aux lead ----------------
     A short lead from the set to a jack on the top edge of the dashboard,
     just below him. It's a little rope (verlet): the set end is fixed to
     the set, the plug end is free until it's put into the jack after he
     lands, and taken out before he's swiped off. Slack lies on the
     dashboard's top edge rather than hanging over its screens. The Rig
     Lab's rows choose its look (lead, colour, length, where it leaves the
     set, the plug, the jack) and its moves (in, out, spark, the jump on
     the landing, 14-a-second or smooth). */
  let rope = null, ropeRAF = 0, ropeLen = 0, plugged = false, plugTo = null, jack = null;
  let spark = 0, fillAmt = 0, fillGlow = 0, pulse = -1, lastDrawStep = -1;
  const LEADS = { black:['#3A3A40', '#6A6A74'], grey:['#7A7E86', '#A8ACB4'], cream:['#CDBF9B', '#F2E8CB'] };
  function leadCols(){ if (O.leadCol === 'dash'){ const p = palOf('dashboard'); return [p.base, p.hi]; } return LEADS[O.leadCol] || LEADS.black; }
  function jackAt(){
    const dock = $id('your-seat-dock'), tr = tv && tv.getBoundingClientRect();
    if (!dock || !tr) return null;
    const dr = dock.getBoundingClientRect(), felt = $id('felt'), fr = felt && felt.getBoundingClientRect();
    if (!fr) return null;
    // a fixed point on the dashboard's top edge, a little towards the middle
    // from where he sits: worked out from his place on the table, never from
    // the set itself, so it doesn't move while he's lifted or lands
    const cxHome = fr.left + felt.clientLeft + home.x + setOf().w * P / 2;
    return [Math.round(cxHome + (home.left ? 22 : -22)), Math.round(dr.top + 5)];
  }
  function ensureJack(){
    const dock = $id('your-seat-dock'); if (!dock) return;
    if (!jack || !jack.isConnected){ jack = document.createElement('i'); document.body.appendChild(jack); }
    jack.className = 'cs-jack cs-jack--' + (O.jack || 'none');
    const j = jackAt(); if (!j) return;
    const w = O.jack === 'ring' ? 10 : 18;
    jack.style.transform = 'translate(' + (j[0] - w / 2) + 'px,' + (j[1] - 4) + 'px)';
    jack.classList.toggle('is-live', plugged && ledState === true);
    jack.classList.toggle('is-in', plugged);
  }
  function exitPoint(S){
    if (O.exit === 'side') return { x:1, y:Math.round(S.box.y + S.box.h * .62) };
    if (O.exit === 'bottom') return { x:Math.round(S.w / 2), y:S.h - 1 };
    return S.port;
  }
  function portAt(){
    if (!tv || !tv.isConnected) return null;
    const tr = tv.getBoundingClientRect(), felt = $id('felt').getBoundingClientRect(), S = setOf(), pt = exitPoint(S);
    const sxScale = tr.width / (S.w * P) || 1;
    // the port sits on the side of the set towards the jack
    const bx = home.left ? tr.left + (S.w - pt.x) * P * sxScale : tr.left + pt.x * P * sxScale;
    let by = tr.top + pt.y * P * (tr.height / (S.h * P) || 1);
    // while he's under the table, the lead goes over the table's edge to him
    return [bx, Math.min(by, felt.bottom - 4)];
  }
  function leadLength(){ return ({ short:46, medium:64, long:88 })[O.length] || (O.cable === 'tight' ? 46 : 64); }
  function ropeStart(){
    const b = portAt(); if (!b) return;
    const N = 16;
    ropeLen = leadLength();
    rope = [];
    // hanging from the set
    for (let i = 0; i <= N; i++){ const t = 1 - i / N; rope.push({ x:b[0] + (home.left ? -1 : 1) * t * 6, y:b[1] + t * ropeLen * .8, px:0, py:0 }); }
    rope.forEach(p => { p.px = p.x; p.py = p.y; });
    plugged = false; plugTo = null; lastDrawStep = -1;
    cancelAnimationFrame(ropeRAF); let last = performance.now();
    const step = now => {
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      tickRope(dt);
      const stepN = Math.floor(now / FRAME);
      if (O.leadStep !== 'stepped' || stepN !== lastDrawStep){ lastDrawStep = stepN; drawRope(); ensureJack(); }
      ropeRAF = requestAnimationFrame(step);
    };
    ropeRAF = requestAnimationFrame(step);
  }
  function ropeStop(){ cancelAnimationFrame(ropeRAF); ropeRAF = 0; rope = null; plugged = false; ensureJack(); if (cableC){ const c = cableC.getContext('2d'); c.clearRect(0, 0, cableC.width, cableC.height); } }
  const floorY = () => { const dock = $id('your-seat-dock'); return dock ? dock.getBoundingClientRect().top + 7 : Infinity; };
  function tickRope(dt){
    const b = portAt(); if (!b || !rope) return;
    const N = rope.length - 1, seg = ropeLen / N, g = 1500, floor = floorY();
    for (let i = 0; i < N; i++){
      if (i === 0 && (plugged || plugTo)) continue;
      const p = rope[i], vx = (p.x - p.px) * .95, vy = (p.y - p.py) * .95;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + g * dt * dt;
    }
    const j = jackAt();
    if (plugTo){ rope[0].x = plugTo[0]; rope[0].y = plugTo[1]; }
    else if (plugged && j){ rope[0].x = j[0]; rope[0].y = j[1]; }
    rope[N].x = b[0]; rope[N].y = b[1];
    for (let k = 0; k < 14; k++){
      for (let i = 0; i < N; i++){
        const a = rope[i], c = rope[i + 1], dx = c.x - a.x, dy = c.y - a.y, dd = Math.hypot(dx, dy) || .001, diff = (dd - seg) / dd * .5;
        const aFixed = i === 0 && (plugged || plugTo), cFixed = i + 1 === N;
        if (!aFixed){ a.x += dx * diff * (cFixed ? 2 : 1); a.y += dy * diff * (cFixed ? 2 : 1); }
        if (!cFixed){ c.x -= dx * diff * (aFixed ? 2 : 1); c.y -= dy * diff * (aFixed ? 2 : 1); }
      }
      // the slack lies on the dashboard's top edge
      for (let i = 1; i < N; i++) if (rope[i].y > floor){ rope[i].y = floor; rope[i].py = floor + (rope[i].py - floor) * .3; rope[i].px = rope[i].x - (rope[i].x - rope[i].px) * .6; }
      if (!plugged && !plugTo && rope[0].y > floor){ rope[0].y = floor; rope[0].py = floor; }
    }
  }
  // the landing thud throws the lead up a little
  function bumpRope(){
    if (!rope || O.leadJolt !== 'bounce') return;
    rope.forEach((p, i) => { if (i > 0 && i < rope.length - 1){ p.py = p.y + 3 + Math.random() * 4; p.px = p.x + (Math.random() - .5) * 2; } });
    if (!plugged) { rope[0].py = rope[0].y + 5; }
  }
  /* the plug goes into the jack, stepped like everything else */
  async function plugIn(){
    const j = jackAt(); if (!rope || !j) return;
    const from = [rope[0].x, rope[0].y], floor = floorY();
    if (O.plugIn === 'slide'){
      // dragged along the dashboard's edge to the jack, then down into it
      const n = 5;
      for (let i = 1; i <= n; i++){ const t = i / n; plugTo = [from[0] + (j[0] - from[0]) * t, Math.min(floor, from[1] + (floor - from[1]) * Math.min(1, t * 2)) - 2]; await sleep(FRAME); }
      plugTo = [j[0], j[1] - 3]; await sleep(FRAME);
    } else if (O.plugIn === 'snap'){
      plugTo = [from[0] + (j[0] - from[0]) * .6, from[1] + (j[1] - from[1]) * .6 - 6]; await sleep(FRAME);
    } else {
      for (let i = 1; i <= 4; i++){
        const t = i / 4, lift = Math.sin(t * Math.PI) * 10;
        plugTo = [from[0] + (j[0] - from[0]) * t, from[1] + (j[1] - from[1]) * t - lift];
        await sleep(FRAME);
      }
    }
    plugTo = null; plugged = true; SFX.clack(); ensureJack();
    if (O.spark === 'on'){ SFX.zap(); for (let i = 3; i >= 1; i--){ spark = i; drawRope(); await sleep(FRAME); } spark = 0; }
  }
  async function pullOut(){
    if (!rope) return;
    const j = jackAt();
    if (O.unplug === 'slide' && j){
      plugged = false;
      for (let i = 1; i <= 3; i++){ plugTo = [j[0] + (home.left ? 1 : -1) * i * 5, j[1] - 3]; await sleep(FRAME); }
      plugTo = null;
    } else {
      plugged = false; plugTo = null;
      const kick = O.unplug === 'yank' ? 13 : 5;
      rope[0].py = rope[0].y + kick; rope[0].px = rope[0].x + (home.left ? -2 : 2) * (O.unplug === 'yank' ? 2 : 1);
      if (O.unplug === 'yank') rope.forEach((p, i) => { if (i > 0 && i < 5) p.py = p.y + kick * (1 - i / 5); });
    }
    ensureJack(); SFX.clack();
  }
  function drawRope(){
    if (!cableC || !rope) return;
    const W = Math.ceil(innerWidth / P), H = Math.ceil(innerHeight / P);
    if (cableC.width !== W || cableC.height !== H){ cableC.width = W; cableC.height = H; cableC.style.width = W * P + 'px'; cableC.style.height = H * P + 'px'; }
    const c = cableC.getContext('2d'); c.clearRect(0, 0, W, H);
    const pts = rope.map(p => [p.x / P, p.y / P]);
    // walk the lead in half-pixel steps, keeping the distance along it
    const dots = []; let len = 0;
    for (let i = 0; i < pts.length - 1; i++){
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], dist = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(dist * 2));
      for (let j = 0; j < n; j++){ const t = j / n; dots.push({ x:x1 + (x2 - x1) * t, y:y1 + (y2 - y1) * t, s:len + dist * t, tx:(x2 - x1) / (dist || 1), ty:(y2 - y1) / (dist || 1) }); }
      len += dist;
    }
    const [core, hi] = leadCols(), lit = '#FFF4C8';
    const thick = O.lead === 'thick' || O.lead === 'braided';
    const litUpTo = fillAmt > 0 ? fillAmt * len : -1;
    // coiled: the lead wound in little loops, offset across its length
    const at = d => {
      if (O.lead !== 'coiled') return [Math.round(d.x), Math.round(d.y)];
      const o = Math.sin(d.s * 1.35) * 1.7;
      return [Math.round(d.x - d.ty * o), Math.round(d.y + d.tx * o)];
    };
    const P2 = dots.map(at);
    c.fillStyle = INK; P2.forEach(q => c.fillRect(q[0] - 1, q[1] - 1, thick ? 4 : 3, thick ? 4 : 3));
    dots.forEach((d, i) => {
      const q = P2[i];
      let col = core;
      if (O.lead === 'braided') col = Math.floor(d.s / 1.5) % 2 ? core : hi;
      if (litUpTo >= 0 && d.s <= litUpTo) col = lit;
      c.fillStyle = col; c.fillRect(q[0], q[1], thick ? 2 : 1, thick ? 2 : 1);
      if (O.lead === 'coiled' && Math.sin(d.s * 1.35) > .8){ c.fillStyle = hi; c.fillRect(q[0], q[1] - 1, 1, 1); }
    });
    if (O.lead !== 'coiled'){ c.fillStyle = litUpTo >= 0 ? lit : hi; P2.forEach((q, i) => { if (litUpTo < 0 || dots[i].s <= litUpTo) c.fillRect(q[0], q[1] - 1, 1, 1); }); }
    if (fillGlow > 0 && litUpTo < 0){ c.globalAlpha = fillGlow; c.fillStyle = lit; P2.forEach(q => c.fillRect(q[0], q[1], thick ? 2 : 1, thick ? 2 : 1)); c.globalAlpha = 1; }
    if (pulse >= 0 && pulse <= 1){
      const q = P2[Math.floor(pulse * (P2.length - 1))];
      if (q){ c.fillStyle = lit; c.fillRect(q[0] - 1, q[1] - 1, 3, 3); }
    }
    // the lead goes in behind the set: nothing of it is drawn over his
    // sprite while he's on the felt (the port is on his back)
    if (tv && tv.isConnected && !tv.classList.contains('is-air')){
      const S = setOf(), tr = tv.getBoundingClientRect(), k = tr.width / (S.w * P) || 1;
      const bx = Math.floor((tr.left + S.box.x * P * k) / P), by = Math.floor((tr.top + S.box.y * P * k) / P);
      c.clearRect(bx, by, Math.ceil(S.box.w * k) + 1, Math.ceil(S.box.h * k));
    }
    // the plug, upright at the free end
    const a = P2[0]; if (!a) return;
    const loose = !plugged && !plugTo, sunk = plugged ? 2 : 0;
    // straight into the dashboard: a dark slot the plug sits down into
    if (plugged && (O.jack || 'none') === 'none'){ c.fillStyle = INK; c.fillRect(a[0] - 4, a[1] - 1, 9, 2); }
    if (O.plug === 'block'){
      c.fillStyle = INK; c.fillRect(a[0] - 3, a[1] - 5 + sunk, 7, 6 - sunk);
      c.fillStyle = '#2A2A30'; c.fillRect(a[0] - 2, a[1] - 4 + sunk, 5, 4 - sunk);
      c.fillStyle = '#55555E'; c.fillRect(a[0] - 2, a[1] - 4 + sunk, 5, 1);
      if (loose){ c.fillStyle = '#E8B83A'; c.fillRect(a[0] - 2, a[1] + 1, 1, 2); c.fillRect(a[0] + 2, a[1] + 1, 1, 2); }
    } else if (O.plug === 'rca'){
      c.fillStyle = INK; c.fillRect(a[0] - 2, a[1] - 6 + sunk, 5, 7 - sunk);
      c.fillStyle = '#B8322A'; c.fillRect(a[0] - 1, a[1] - 5 + sunk, 3, 4 - sunk);
      c.fillStyle = '#E06050'; c.fillRect(a[0] - 1, a[1] - 5 + sunk, 1, 3 - sunk);
      c.fillStyle = '#C8C8D0'; c.fillRect(a[0] - 1, a[1] - 1, 3, 1);
      if (loose){ c.fillStyle = '#E8B83A'; c.fillRect(a[0], a[1] + 1, 1, 2); }
    } else {
      c.fillStyle = INK; c.fillRect(a[0] - 2, a[1] - 5 + sunk, 5, 6 - sunk);
      c.fillStyle = '#2A2A30'; c.fillRect(a[0] - 1, a[1] - 4 + sunk, 3, 4 - sunk);
      c.fillStyle = '#55555E'; c.fillRect(a[0] - 1, a[1] - 4 + sunk, 1, 3 - sunk);
      if (loose){ c.fillStyle = '#E8B83A'; c.fillRect(a[0], a[1] + 1, 1, 3); }
    }
    // a spark as it goes in
    if (spark > 0){
      const j = jackAt(); if (j){
        const x = Math.round(j[0] / P), y = Math.round(j[1] / P), r = 4 - spark;
        c.fillStyle = spark === 3 ? '#FFFFFF' : '#FFE380';
        [[-1, -1], [1, -1], [-1, 0], [1, 0], [0, -1]].forEach(([dx, dy]) => c.fillRect(x + dx * (r + 1), y - 2 + dy * r, 1, 1));
      }
    }
  }

  /* ---------------- motion ---------------- */
  // plays a list of keyframes { t (ms), x, y, lift, sx, sy, bank, lean } in 14fps steps
  const PROPS = ['x', 'y', 'lift', 'sx', 'sy', 'bank', 'lean', 'yaw', 'pitch', 'roll'];
  function poseAt(frames, tq){
    let i = 0; while (i < frames.length - 2 && frames[i + 1].t < tq) i++;
    const a = frames[i], b = frames[i + 1] || a, span = (b.t - a.t) || 1, k = Math.max(0, Math.min(1, (tq - a.t) / span));
    const e = b.ease === 'in' ? k * k : b.ease === 'out' ? 1 - (1 - k) * (1 - k) : k;
    const out = {};
    PROPS.forEach(p => {
      const va = a[p] == null ? (p === 'sx' || p === 'sy' ? 1 : 0) : a[p], vb = b[p] == null ? (p === 'sx' || p === 'sy' ? 1 : 0) : b[p];
      out[p] = va + (vb - va) * e;
    });
    return out;
  }
  function play(frames, onFrame){
    const slow = Math.max(1, +O.speed || 1);   // the lab's slow motion
    return new Promise(res => {
      const total = frames[frames.length - 1].t, t0 = performance.now();
      let lastStep = -1;
      const tick = now => {
        const t = Math.min(total, (now - t0) / slow), stepN = Math.floor(t / FRAME);
        if (stepN !== lastStep || t >= total){
          lastStep = stepN;
          const tq = t >= total ? total : stepN * FRAME;
          Object.assign(pose, poseAt(frames, tq));
          render();
          if (onFrame) onFrame(tq);
        }
        if (t < total) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }
  function jolt(px){
    if (!px) return;
    const ts = $id('table-screen') || document.body;
    ts.animate([{ transform:'translate(0,0)' }, { transform:'translate(0,' + px + 'px)' }, { transform:'translate(0,' + (-Math.ceil(px / 2)) + 'px)' }, { transform:'translate(0,0)' }],
      { duration:220, easing:'steps(3,end)' });
    try{ if (window.CoinWorld && CoinWorld.shake) CoinWorld.shake(); }catch(e){}
  }
  function dust(){
    if (O.dust !== 'on' || !layer) return;
    const S = setOf(), bx = home.x, by = home.y + S.h * P - 2;
    [[-1, 0], [-1, -1], [1, 0], [1, -1], [-1, -2], [1, -2]].forEach(([dir, dy], i) => {
      const d = document.createElement('i'); d.className = 'cs-dust';
      const x0 = dir < 0 ? bx + 4 : bx + S.w * P - 6, y0 = by + dy * 2;
      d.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px)';
      layer.appendChild(d);
      const far = 8 + (i % 3) * 5;
      d.animate([{ transform:'translate(' + x0 + 'px,' + y0 + 'px)', opacity:1 },
        { transform:'translate(' + (x0 + dir * far) + 'px,' + (y0 - 4 - (i % 2) * 2) + 'px)', opacity:1 },
        { transform:'translate(' + (x0 + dir * (far + 4)) + 'px,' + (y0 - 2) + 'px)', opacity:0 }], { duration:300, easing:'steps(4,end)' });
      setTimeout(() => d.remove(), 320);
    });
  }

  /* on: pulled out from under the table by the dashboard and put down */
  /* which way he turns: A (1) or B (-1). RANDOM (the owner's pick): each
     time he's switched on it's decided afresh whether he comes up turning
     A and goes down turning B, or the other way round. */
  let cycleTurn = Math.random() < .5 ? 1 : -1;
  function turnFor(way){
    if (O.turn === 'in') return 1;
    if (O.turn === 'out') return -1;
    return way === 'up' ? cycleTurn : -cycleTurn;
  }
  function arriveKeys(){
    const W = WEIGHT[O.weight] || WEIGHT.heavy, S = setOf();
    const out = home.left ? -1 : 1;                      // the side nearest the dashboard corner
    const tw = turnFor('up');                           // which way he turns
    const below = home.edge - home.y + 10;               // far enough down to be under the table
    const g = W.g;
    let frames;
    // he turns as he comes: showing his top and his inner side on the way
    // up, squaring up to face you just before he's set down
    const settle = land => [
      { t:land + FRAME, sx:1 + W.squash, sy:1 - W.squash },
      { t:land + FRAME * 2, sx:1 - W.squash * .3, sy:1 + W.squash * .3 },
      { t:land + FRAME * 3, sx:1 + W.squash * .15, sy:1 - W.squash * .15 },
      { t:land + FRAME * 4 }
    ];
    if (O.from === 'side'){
      const off = (home.left ? home.x + S.w * P + 20 : home.w - home.x + 20) * out, land = 520 / g;
      frames = [
        { t:0, x:off, lift:24, yaw:-out * 70, pitch:18, roll:0 },
        { t:300 / g, x:out * 14, lift:32, yaw:-out * 26, pitch:14, roll:-out * 3, ease:'out' },
        { t:430 / g, x:out * 3, lift:26, yaw:-out * 6, pitch:5, ease:'in' },
        { t:land, x:0, lift:0, ease:'in' }
      ].concat(settle(land));
    } else {
      // up from below the near edge, over the rail, held a moment, then down
      const land = 660 / g;
      frames = [
        { t:0, x:out * 8, y:below, lift:0, yaw:-out * 58, pitch:40, roll:out * 10 },
        { t:260 / g, x:out * 6, y:0, lift:30, yaw:-out * 40, pitch:28, roll:out * 7, ease:'out' },
        { t:420 / g, x:out * 3, y:0, lift:40, yaw:-out * 18, pitch:14, roll:out * 3 },
        { t:540 / g, x:out * 1, y:0, lift:34, yaw:-out * 5, pitch:5, roll:0 },
        { t:land, x:0, y:0, lift:0, ease:'in' }
      ].concat(settle(land));
    }
    frames.forEach(f => { if (f.yaw) f.yaw *= tw; if (f.roll) f.roll *= tw; });
    return frames;
  }
  async function arrive(){
    const W = WEIGHT[O.weight] || WEIGHT.heavy, frames = arriveKeys();
    let landed = false;
    const hit = frames.find((f, i) => i > 0 && (frames[i - 1].lift || 0) > 0 && !f.lift).t;
    await play(frames, t => {
      if (!landed && t >= hit){ landed = true; SFX.thud(W.thud); if (O.jolt === 'on') jolt(W.jolt); dust(); bumpRope(); }
    });
  }
  /* off: swiped back off the way he came */
  function leaveKeys(){
    const W = WEIGHT[O.weight] || WEIGHT.heavy, S = setOf();
    const out = home.left ? -1 : 1, below = home.edge - home.y + 10, tw = turnFor('down');
    const frames = O.from === 'side'
      ? [{ t:0 }, { t:FRAME, lift:4, pitch:4 }, { t:280, x:out * (home.left ? home.x + S.w * P + 30 : home.w - home.x + 30), lift:16, yaw:-out * 70, pitch:18, ease:'in' }]
      : [{ t:0 }, { t:FRAME, lift:4, yaw:-out * 4, pitch:4 }, { t:200, x:out * 5, lift:16, yaw:-out * 28, pitch:22, roll:out * 5, ease:'out' },
         { t:200 + 280 / W.g, x:out * 8, y:below, lift:0, yaw:-out * 60, pitch:42, roll:out * 10, ease:'in' }];
    frames.forEach(f => { if (f.yaw) f.yaw *= tw; if (f.roll) f.roll *= tw; });
    return frames;
  }
  async function leave(){
    SFX.scrape();
    await play(leaveKeys());
  }

  /* ---------------- the frame sheet (lab) ----------------
     Every 14fps step of the entry or exit, as the tile it would be on the
     table: the felt, the table's near edge (the dashboard in front of it),
     his shadow, and him, flat or in the round. Art pixels; the lab scales
     them up. */
  function sheetFrames(kind){
    if (!solid) buildSolid();
    measureHome();
    const keys = kind === 'exit' ? leaveKeys() : arriveKeys();
    const total = keys[keys.length - 1].t, out = [];
    for (let t = 0; ; t += FRAME){ const tq = Math.min(t, total); out.push(Object.assign(poseAt(keys, tq), { t:Math.round(tq) })); if (tq >= total) break; }
    return out;
  }
  const TILE = { w:76, h:118, edge:92 };
  function drawTile(canvas, pz){
    if (!solid) buildSolid();
    const S = setOf(), pal = palOf(O.finish), c = canvas.getContext('2d');
    canvas.width = TILE.w; canvas.height = TILE.h;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#1E4431'; c.fillRect(0, 0, TILE.w, TILE.edge);
    const restBottom = TILE.edge - 6, left = Math.round(TILE.w / 2 - S.w / 2 + pz.x / P), top = Math.round(restBottom - S.h + (pz.y - pz.lift) / P);
    const air = pz.lift > .5 || pz.y > .5 || Math.abs(pz.yaw) + Math.abs(pz.pitch) + Math.abs(pz.roll) > .5;
    if (top + S.h <= TILE.edge + 1){
      const k = Math.max(.35, 1 - Math.max(0, pz.lift) / 140), sw = Math.round(S.w * .92 * k);
      c.fillStyle = 'rgba(0,0,0,' + (.5 * k).toFixed(2) + ')'; c.fillRect(Math.round(TILE.w / 2 + pz.x / P - sw / 2), restBottom - 2, sw, 3);
    }
    if (air){
      const t = document.createElement('canvas'); t.width = C3; t.height = C3; render3D(t, pz);
      const bcx = S.box.x + S.box.w / 2, bcy = S.box.y + S.box.h / 2;
      c.drawImage(t, Math.round(left + bcx - C3 / 2), Math.round(top + bcy - C3 / 2));
    } else {
      const f = document.createElement('canvas'); f.width = S.w; f.height = S.h; S.draw(f.getContext('2d'), pal, false);
      const w = Math.round(S.w * pz.sx), h = Math.round(S.h * pz.sy);
      c.drawImage(f, Math.round(left + S.w / 2 - w / 2), top + S.h - h, w, h);
    }
    // the dashboard in front: he's hidden under the table's edge
    c.fillStyle = '#12261C'; c.fillRect(0, TILE.edge, TILE.w, TILE.h - TILE.edge);
    c.fillStyle = '#E8B83A'; c.fillRect(0, TILE.edge + 2, TILE.w, 1);
    c.fillStyle = '#080405'; c.fillRect(0, TILE.edge, TILE.w, 2);
  }

  /* ---------------- the boot on the tube ----------------
     POWER up the lead (it lights along its length, or one pulse runs up
     it), the relay clicks, then the TUBE: dot, line, static (round 3) · a
     line typed · a system check · a bar scanning down · flickering on.
     Then he WAKES: blinks and looks round · two blinks · wide eyes ·
     straight on. The lamp shows the LED colour while it boots, then
     green. QUICK is the same at about half the time, for mid-game. */
  const sayLines = () => ({ coach:['COACH', 'ONLINE'], hello:['HELLO'], ready:['READY'], none:[] })[O.says] || ['COACH', 'ONLINE'];
  async function powerLead(up){
    const T = ms => sleep(O.bootLen === 'quick' ? ms * .5 : ms);
    if (O.power === 'fill'){
      if (up){ for (let i = 1; i <= 8; i++){ fillAmt = i / 8; drawRope(); await T(34); } fillAmt = 0; for (const g of [1, .6, .3, 0]){ fillGlow = g; drawRope(); await T(FRAME); } }
      else { for (const g of [.8, .4, 0]){ fillGlow = g; drawRope(); await T(FRAME); } }
    } else if (O.power === 'pulse'){
      for (let i = 0; i <= 8; i++){ pulse = up ? i / 8 : 1 - i / 8; drawRope(); await T(40); }
      pulse = -1; drawRope();
    }
  }
  async function boot(){
    const quick = O.bootLen === 'quick', T = ms => sleep(quick ? ms * .5 : ms);
    ledState = 'boot'; paintBody(); ensureJack();
    await powerLead(true);
    SFX.relay(); await T(160);
    const ink = INKS[O.ink];
    if (O.tube === 'text' || O.tube === 'bios'){
      SFX.whine();
      bootFrame = { kind:'dark' }; paintFace(); await T(120);
      const lines = O.tube === 'bios' ? ['SYS OK', 'MEM OK', 'CAM OK'].concat(sayLines()) : sayLines();
      const shown = [];
      for (const line of lines){
        if (O.tube === 'bios'){
          shown.push(line); while (shown.length > 3) shown.shift();
          bootFrame = { kind:'text', extra:{ lines:shown.slice(), cursor:false } }; paintFace(); SFX.tick(); await T(FRAME * 1.4);
        } else {
          shown.push('');
          for (const ch of line){ shown[shown.length - 1] += ch; bootFrame = { kind:'text', extra:{ lines:shown.slice(), cursor:true } }; paintFace(); SFX.tick(); await T(55); }
          await T(90);
        }
      }
      for (let i = 0; i < (quick ? 2 : 4); i++){ bootFrame = { kind:'text', extra:{ lines:shown.slice(), cursor:i % 2 === 0 } }; paintFace(); await T(130); }
      bootFrame = { kind:'dark' }; paintFace(); await T(120);
    } else if (O.tube === 'scan'){
      SFX.whine();
      const S = setOf();
      for (let r = 0; r <= S.screen.h; r += 2){ bootFrame = { kind:'scan', row:r }; paintFace(); await T(FRAME * .8); }
      bootFrame = null;
    } else if (O.tube === 'flicker'){
      SFX.whine();
      const seq = [1, 0, 1, 0, 0, 1, 0, 1];
      for (const f of seq){ bootFrame = f ? null : { kind:'dark' }; st.noMouth = false; paintFace(); if (f) SFX.tick(); await T(FRAME); }
      bootFrame = null;
    } else {
      SFX.whine();
      bootFrame = { kind:'dot' }; paintFace(); await T(140);
      for (let i = 1; i <= 4; i++){ bootFrame = { kind:'line', t:i / 4 }; paintFace(); await T(FRAME); }
      SFX.hiss(quick ? .12 : .26);
      for (let i = 0; i < (quick ? 2 : 4); i++){ bootFrame = { kind:'static' }; paintFace(); await T(FRAME); }
      bootFrame = { kind:'dark' }; paintFace(); await T(180);
    }
    bootFrame = null;
    // he wakes
    if (O.wake === 'look' || O.wake === 'blinks'){
      st.blink = true; st.noMouth = true; paintFace(); await T(220);
      st.blink = false; paintFace(); await T(160);
      st.blink = true; paintFace(); await T(90); st.blink = false; paintFace(); await T(120);
      if (!quick){ st.blink = true; paintFace(); await T(90); st.blink = false; paintFace(); await T(200); }
      if (O.wake === 'look' && !quick){
        st.gaze = [-2, 0]; paintFace(); await T(260);
        st.gaze = [2, 0]; paintFace(); await T(260);
        st.gaze = [0, 1]; paintFace(); await T(200);
      }
    } else if (O.wake === 'wide'){
      const was = st.mood; st.mood = 'surprised'; st.noMouth = true; paintFace(); await T(300);
      st.blink = true; paintFace(); await T(100); st.blink = false; st.mood = was; paintFace(); await T(160);
    }
    st.gaze = null; st.noMouth = false; st.blink = false; paintFace();
    ledState = true; paintBody(); ensureJack();
    SFX.blip(true);
  }
  async function unboot(){
    const T = ms => sleep(O.bootLen === 'quick' ? ms * .5 : ms);
    SFX.blip(false);
    if (O.shutdown === 'blink'){
      st.blink = true; paintFace(); await T(240);
      st.noMouth = true; paintFace(); await T(140);
    } else if (O.shutdown === 'text'){
      let t = ''; for (const ch of 'BYE'){ t += ch; bootFrame = { kind:'text', extra:{ lines:[t], cursor:true } }; paintFace(); SFX.tick(); await T(90); }
      await T(300);
      for (let i = 4; i >= 1; i--){ bootFrame = { kind:'line', t:i / 4 }; paintFace(); await T(FRAME); }
      bootFrame = { kind:'dot' }; paintFace(); await T(140);
    } else {
      st.blink = true; paintFace(); await T(120);
      for (let i = 4; i >= 1; i--){ bootFrame = { kind:'line', t:i / 4 }; paintFace(); await T(FRAME); }
      bootFrame = { kind:'dot' }; paintFace(); await T(160);
    }
    bootFrame = null; st.blink = false; st.noMouth = false;
    on = false; ledState = false; paintFace(); paintBody(); ensureJack();
    await powerLead(false);
  }

  async function power(want){
    if (busy || want === on) return;
    busy = true;
    ensureKey(); if (!ensureLayer()) { busy = false; return; }
    try{
      if (want){
        cycleTurn = Math.random() < .5 ? 1 : -1;
        build(); measureHome();
        if (motionOffSafe()){
          on = true; Object.assign(pose, { x:0, y:0, lift:0, sx:1, sy:1, bank:0, lean:0, yaw:0, pitch:0, roll:0 }); render();
          ropeStart(); plugged = true; ledState = true; paintBody(); paintFace();
        } else {
          // start under the table, the cable already coming out of the key
          Object.assign(pose, { x:0, y:home.edge - home.y + 10, lift:0, sx:1, sy:1, bank:0, lean:0, yaw:0, pitch:0, roll:0 });
          render(); ropeStart();
          await arrive();
          on = true; render();
          await sleep(FRAME * 2);
          await plugIn();
          await boot();
        }
        key.classList.add('is-on'); key.setAttribute('aria-pressed', 'true');
        idle();
      } else {
        clearTimeout(idleT);
        if (!motionOffSafe()){
          await unboot();
          key.classList.remove('is-on');
          await pullOut(); await sleep(FRAME * 3);
          await leave();
          await sleep(120);
        } else { on = false; }
        on = false; render(); ropeStop();
        key.classList.remove('is-on'); key.setAttribute('aria-pressed', 'false');
      }
    } finally { busy = false; render(); }
  }

  /* the lab's REPLUG and REBOOT: the lead out and back in; the tube off and booted again */
  async function replug(){
    if (!on || busy) return; busy = true;
    try{ await unboot(); await pullOut(); await sleep(700); await plugIn(); on = true; await boot(); } finally { busy = false; }
  }
  async function reboot(){
    if (!on || busy) return; busy = true;
    try{ await unboot(); await sleep(400); on = true; await boot(); } finally { busy = false; }
  }

  /* ---------------- life ---------------- */
  let idleT = null;
  function idle(){
    clearTimeout(idleT);
    if (!on || motionOffSafe()) return;
    idleT = setTimeout(async () => {
      if (on && !busy && !talking){
        if (Math.random() < .3) await glance(); else { st.blink = true; paintFace(); await sleep(110); st.blink = false; paintFace(); }
      }
      idle();
    }, 2400 + Math.random() * 2800);
  }
  // looks at something on the table: the pot, a seat, your cards
  function gazeAt(el){
    if (!el || !face) return null;
    const a = face.getBoundingClientRect(), b = el.getBoundingClientRect();
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2), d = Math.hypot(dx, dy) || 1;
    return [Math.round(dx / d * 2), Math.round(dy / d * 2)];
  }
  function targetEl(what){
    if (what === 'pot') return document.querySelector('#pot, .pot, #board');
    if (what === 'you') return document.querySelector('#hole-cards, .card-holder, #my-cards') || document.querySelector('.console, #console');
    if (what === 'player'){ const s = [...document.querySelectorAll('.seat')].filter(x => x.offsetParent); return s[Math.floor(Math.random() * s.length)]; }
    return null;
  }
  async function glance(){
    const t = ['pot', 'player', 'player', 'you'][Math.floor(Math.random() * 4)];
    await look(t, 1300);
  }
  async function look(what, ms){
    if (!on) return;
    st.gaze = what === 'ahead' ? null : gazeAt(targetEl(what)) || null; paintFace();
    if (ms){ await sleep(ms); st.gaze = null; paintFace(); }
  }
  let talking = null;
  function talk(ms){
    if (!on) return;
    clearInterval(talking);
    let open = false;
    talking = setInterval(() => { open = !open; st.talk = open; paintFace(); }, 110);
    setTimeout(() => { clearInterval(talking); talking = null; st.talk = false; paintFace(); }, ms || 1600);
  }
  function setMood(m){ st.mood = m; O.mood = m; paintFace(); }
  // his mouth, for speech: open or shut, one frame at a time
  function mouth(open){ if (!on) return; st.talk = !!open; paintFace(); }

  function apply(order){
    const was = O;
    O = Object.assign({}, DEFAULTS, order || {});
    ledBoot = O.led; masterLevel = O.coachSound === 'off' ? 0 : O.coachSound === 'soft' ? .45 : 1;
    if (body) paintBody();
    st.mood = O.mood;
    if (!layer) return;
    const rebuild = ['set', 'finish', 'ink', 'glasses'].some(k => was[k] !== O[k]);
    if (rebuild && (on || busy)) build();
  }
  // tiles in the lab's sheet: a still of any set/face
  function still(o, canvasHolder){
    const S = SETS[o.set] || SETS.portable, pal = palOf(o.finish);
    const c = document.createElement('canvas'); c.width = S.w; c.height = S.h; c.className = 'cs-still';
    const x = c.getContext('2d'); S.draw(x, pal, true);
    const f = document.createElement('canvas'); f.width = S.screen.w; f.height = S.screen.h;
    drawFace(f.getContext('2d'), S.screen.w, S.screen.h, { mood:o.mood || 'calm', glasses:o.glasses === 'on' }, INKS[o.ink] || INKS.machine);
    x.drawImage(f, S.screen.x, S.screen.y);
    c.style.aspectRatio = S.w + ' / ' + S.h;
    canvasHolder.appendChild(c);
  }

  function start(){
    ensureKey(); ensureLayer();
    window.addEventListener('resize', () => { measureHome(); render(); });
    new MutationObserver(() => setTimeout(() => { measureHome(); render(); }, 40)).observe(document.documentElement, { attributes:true, attributeFilter:['data-ds-where', 'data-ds-size'] });
    setInterval(() => { ensureKey(); if (!layer || !layer.isConnected){ layer = null; ensureLayer(); if (on) build(); } else if (!busy){ measureHome(); render(); } }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);

  return { apply, power, replug, reboot, setMood, mouth, look, talk, still, sheetFrames, drawTile, MOODS, OPTIONS, DEFAULTS, SETS,
    get on(){ return on; }, get busy(){ return busy; }, get order(){ return Object.assign({}, O); } };
})();
