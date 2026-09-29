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
  function led(c, x, y, on){ px(c, INK, x - 1, y - 1, 4, 3); px(c, on ? '#8CF0A8' : '#1D3A28', x, y, 2, 1); }
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
  // the boot's frames on the tube: a dot, a line, static
  function drawBoot(c, W, H, kind, t, ink){
    c.clearRect(0, 0, W, H);
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
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
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .34);
      const n = noise(ctx, .09), f = ctx.createBiquadFilter(), ng = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 600; ng.gain.setValueAtTime(.35 * w, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .09);
      n.connect(f).connect(ng).connect(ctx.destination); n.start(t);
      // the set's own rattle, a hair later
      const r = noise(ctx, .05), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
      rf.type = 'bandpass'; rf.frequency.value = 2400; rf.Q.value = 3; rg.gain.setValueAtTime(.08 * w, t + .03); rg.gain.exponentialRampToValueAtTime(.0001, t + .09);
      r.connect(rf).connect(rg).connect(ctx.destination); r.start(t + .03);
    },
    clack(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      [0, .045].forEach((d, i) => {
        const n = noise(ctx, .025), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = i ? 1800 : 3200; f.Q.value = 4;
        g.gain.setValueAtTime(.3, t + d); g.gain.exponentialRampToValueAtTime(.0001, t + d + .025);
        n.connect(f).connect(g).connect(ctx.destination); n.start(t + d);
      });
    },
    whine(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(3400, t + .5);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.035, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + .6);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .62);
    },
    hiss(dur){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const n = noise(ctx, dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'highpass'; f.frequency.value = 1500; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      n.connect(f).connect(g).connect(ctx.destination); n.start(t);
    },
    blip(up){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      (up ? [660, 990] : [880, 520]).forEach((hz, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * .07;
        o.type = 'square'; o.frequency.value = hz;
        g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.05, s + .005); g.gain.exponentialRampToValueAtTime(.0001, s + .06);
        o.connect(g).connect(ctx.destination); o.start(s); o.stop(s + .07);
      });
    },
    scrape(){
      const ctx = ac(); if (!ctx) return; const t = ctx.currentTime;
      const n = noise(ctx, .22), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(260, t + .2); f.Q.value = 1.4;
      g.gain.setValueAtTime(.16, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      n.connect(f).connect(g).connect(ctx.destination); n.start(t);
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
    speed:[['1', 'NORMAL'], ['4', 'SLOW x4'], ['10', 'SLOW x10']]
  };
  // The owner's picks (round 3, 29 Sep 2026): CUBE, DASHBOARD, CLEAN lines,
  // from UNDER the table, turning A up and B down or the reverse at random.
  const DEFAULTS = { set:'cube', finish:'dashboard', ink:'machine', glasses:'off', from:'under', weight:'heavy', jolt:'on', dust:'on', boot:'full', cable:'rope', turn:'random', lines:'clean', speed:'1', mood:'calm' };
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
    setOf().draw(c, palOf(O.finish), on && !busyBooting);
  }

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

  let busyBooting = false;
  function paintFace(){
    if (!face) return;
    const c = face.getContext('2d'), S = setOf();
    if (!on && !bootFrame){ c.clearRect(0, 0, S.screen.w, S.screen.h); return; }
    if (bootFrame){ drawBoot(c, S.screen.w, S.screen.h, bootFrame.kind, bootFrame.t, INKS[O.ink]); return; }
    drawFace(c, S.screen.w, S.screen.h, Object.assign({}, st, { glasses:O.glasses === 'on' }), INKS[O.ink]);
  }

  /* ---------------- the cable: an aux lead ----------------
     A short lead from the back of the set to a jack on the top edge of the
     dashboard, just below him. It's a little rope (verlet): the set end is
     fixed to the set, the plug end is free until it's pushed into the jack
     after he lands, and pulled out before he's swiped off. Slack lies on
     the dashboard's top edge rather than hanging over its screens. */
  let rope = null, ropeRAF = 0, ropeLen = 0, plugged = false, plugTo = null, jack = null;
  function jackAt(){
    const dock = $id('your-seat-dock'), tr = tv && tv.getBoundingClientRect();
    if (!dock || !tr) return null;
    const dr = dock.getBoundingClientRect();
    // on the dashboard's top edge, a little towards the middle from the set
    const S = setOf(), port = portAt();
    const x = port ? port[0] + (home.left ? 16 : -16) : tr.left + tr.width / 2;
    return [Math.round(x), Math.round(dr.top + 5)];
  }
  function ensureJack(){
    const dock = $id('your-seat-dock'); if (!dock) return;
    if (!jack || !jack.isConnected){ jack = document.createElement('i'); jack.className = 'cs-jack'; document.body.appendChild(jack); }
    const j = jackAt(); if (!j) return;
    jack.style.transform = 'translate(' + (j[0] - 5) + 'px,' + (j[1] - 4) + 'px)';
    jack.classList.toggle('is-live', plugged);
  }
  function portAt(){
    if (!tv || !tv.isConnected) return null;
    const tr = tv.getBoundingClientRect(), felt = $id('felt').getBoundingClientRect(), S = setOf();
    const sxScale = tr.width / (S.w * P) || 1;
    const bx = home.left ? tr.left + (S.w - S.port.x) * P * sxScale : tr.left + S.port.x * P * sxScale;
    let by = tr.top + S.port.y * P * (tr.height / (S.h * P) || 1);
    // while he's under the table, the lead goes over the table's edge to him
    return [bx, Math.min(by, felt.bottom - 4)];
  }
  function ropeStart(){
    const b = portAt(); if (!b) return;
    const N = 14;
    ropeLen = O.cable === 'tight' ? 46 : 64;
    rope = [];
    // hanging from the back of the set
    for (let i = 0; i <= N; i++){ const t = 1 - i / N; rope.push({ x:b[0] + (home.left ? -1 : 1) * t * 6, y:b[1] + t * ropeLen * .8, px:0, py:0 }); }
    rope.forEach(p => { p.px = p.x; p.py = p.y; });
    plugged = false; plugTo = null;
    cancelAnimationFrame(ropeRAF); let last = performance.now();
    const step = now => {
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      tickRope(dt); drawRope(); ensureJack();
      ropeRAF = requestAnimationFrame(step);
    };
    ropeRAF = requestAnimationFrame(step);
  }
  function ropeStop(){ cancelAnimationFrame(ropeRAF); ropeRAF = 0; rope = null; plugged = false; ensureJack(); if (cableC){ const c = cableC.getContext('2d'); c.clearRect(0, 0, cableC.width, cableC.height); } }
  function tickRope(dt){
    const b = portAt(); if (!b || !rope) return;
    const N = rope.length - 1, seg = ropeLen / N, g = 1500;
    const dock = $id('your-seat-dock'), floor = dock ? dock.getBoundingClientRect().top + 7 : Infinity;
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
  /* push the plug into the jack (stepped, like everything else) */
  async function plugIn(){
    const j = jackAt(); if (!rope || !j) return;
    const from = [rope[0].x, rope[0].y];
    for (let i = 1; i <= 4; i++){
      const t = i / 4, lift = Math.sin(t * Math.PI) * 10;
      plugTo = [from[0] + (j[0] - from[0]) * t, from[1] + (j[1] - from[1]) * t - lift];
      await sleep(FRAME);
    }
    plugTo = null; plugged = true; SFX.clack(); ensureJack();
  }
  function pullOut(){
    if (!rope) return;
    plugged = false; plugTo = null; ensureJack();
    rope[0].py = rope[0].y + 5; rope[0].px = rope[0].x + (home.left ? -2 : 2);   // a little flick as it comes out
    SFX.clack();
  }
  let pulse = -1;   // power running along the lead (0 at the jack, 1 at the set)
  function drawRope(){
    if (!cableC || !rope) return;
    const W = Math.ceil(innerWidth / P), H = Math.ceil(innerHeight / P);
    if (cableC.width !== W || cableC.height !== H){ cableC.width = W; cableC.height = H; cableC.style.width = W * P + 'px'; cableC.style.height = H * P + 'px'; }
    const c = cableC.getContext('2d'); c.clearRect(0, 0, W, H);
    const pts = []; rope.forEach(p => pts.push([p.x / P, p.y / P]));
    const dots = [];
    for (let i = 0; i < pts.length - 1; i++){
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
      for (let j = 0; j < n; j++){ const t = j / n; dots.push([Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t)]); }
    }
    // a thin lead: one art pixel of rubber in an ink outline, a lit pixel on top
    c.fillStyle = INK; dots.forEach(d => c.fillRect(d[0] - 1, d[1] - 1, 2, 3));
    c.fillStyle = '#3A3A40'; dots.forEach(d => c.fillRect(d[0], d[1], 1, 1));
    c.fillStyle = '#6A6A74'; dots.forEach(d => c.fillRect(d[0], d[1] - 1, 1, 1));
    if (pulse >= 0 && pulse <= 1){
      const i = Math.floor(pulse * (dots.length - 1)), d = dots[i];
      if (d){ c.fillStyle = '#FFF4C8'; c.fillRect(d[0] - 1, d[1] - 1, 3, 3); }
    }
    // the plug: a gold barrel on a black grip
    const a = dots[0], nx = dots[Math.min(4, dots.length - 1)];
    if (a && nx){
      const up = !plugged && !plugTo;
      c.fillStyle = INK; c.fillRect(a[0] - 2, a[1] - (plugged ? 5 : 3), 5, plugged ? 5 : 6);
      c.fillStyle = '#2A2A30'; c.fillRect(a[0] - 1, a[1] - (plugged ? 4 : 2), 3, plugged ? 3 : 4);
      if (up){ c.fillStyle = '#E8B83A'; c.fillRect(a[0], a[1] + 3, 1, 2); }
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
      if (!landed && t >= hit){ landed = true; SFX.thud(W.thud); if (O.jolt === 'on') jolt(W.jolt); dust(); }
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

  /* the boot on the tube */
  async function boot(){
    busyBooting = true; paintBody();
    const quick = O.boot === 'quick';
    // power up the cable
    for (let i = 0; i <= 8; i++){ pulse = i / 8; await sleep(quick ? 22 : 40); }
    pulse = -1;
    SFX.clack(); busyBooting = false; paintBody();
    await sleep(quick ? 60 : 160);
    SFX.whine();
    bootFrame = { kind:'dot' }; paintFace(); await sleep(quick ? 60 : 140);
    for (let i = 1; i <= 4; i++){ bootFrame = { kind:'line', t:i / 4 }; paintFace(); await sleep(FRAME); }
    SFX.hiss(quick ? .12 : .26);
    for (let i = 0; i < (quick ? 2 : 4); i++){ bootFrame = { kind:'static' }; paintFace(); await sleep(FRAME); }
    bootFrame = { kind:'dark' }; paintFace(); await sleep(quick ? 60 : 180);
    bootFrame = null;
    // the blink boot: eyes open, two blinks, a look round, settle
    st.blink = true; st.noMouth = true; paintFace(); await sleep(quick ? 80 : 220);
    st.blink = false; paintFace(); await sleep(quick ? 70 : 160);
    if (!quick){
      st.blink = true; paintFace(); await sleep(90); st.blink = false; paintFace(); await sleep(120);
      st.blink = true; paintFace(); await sleep(90); st.blink = false; paintFace(); await sleep(200);
      st.gaze = [-2, 0]; paintFace(); await sleep(260);
      st.gaze = [2, 0]; paintFace(); await sleep(260);
      st.gaze = [0, 1]; paintFace(); await sleep(200);
    }
    st.gaze = null; st.noMouth = false; paintFace();
    SFX.blip(true);
  }
  async function unboot(){
    SFX.blip(false);
    st.blink = true; paintFace(); await sleep(120);
    for (let i = 4; i >= 1; i--){ bootFrame = { kind:'line', t:i / 4 }; paintFace(); await sleep(FRAME); }
    bootFrame = { kind:'dot' }; paintFace(); await sleep(160);
    bootFrame = null; st.blink = false;
    on = false; paintFace(); paintBody();
    for (let i = 8; i >= 0; i--){ pulse = i / 8; await sleep(30); }
    pulse = -1;
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
          ropeStart(); plugged = true; paintBody(); paintFace();
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
          pullOut(); await sleep(FRAME * 3);
          await leave();
          await sleep(120);
        } else { on = false; }
        on = false; render(); ropeStop();
        key.classList.remove('is-on'); key.setAttribute('aria-pressed', 'false');
      }
    } finally { busy = false; render(); }
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

  function apply(order){
    const was = O;
    O = Object.assign({}, DEFAULTS, order || {});
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

  return { apply, power, setMood, look, talk, still, sheetFrames, drawTile, MOODS, OPTIONS, DEFAULTS, SETS,
    get on(){ return on; }, get busy(){ return busy; }, get order(){ return Object.assign({}, O); } };
})();
