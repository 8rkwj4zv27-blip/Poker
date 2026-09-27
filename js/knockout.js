"use strict";

/* ============================================================
   K.O. + GAME OVER (live, v0.43.0)
   The owner's order from the K.O. order form (ko-lab.html, round 3,
   27 Sep 2026; docs/ui/KO_PLAN.md). Styles: css/knockout.css.

   An opponent's K.O.: a referee count on their readout with a boxing
   bell, a big K.O.! stamp on the felt, the blast with debris, the others
   flinch; the face flies with a light trail, pulls a new face on every
   hit, throws sparks, bounces off the other cabinets, and leaves off
   screen; its socket smokes. Two or three K.O.s fire one by one.

   Your game over: the opponent who busted you gloats, your dashboard takes
   two thunks, then a random chain reaction breaks it (1-3 buttons shot
   off, screens, the stack drums, the SB/BB lamps, the rim light, the
   settings key, a snapped bracket; your cards pop out), and it ends with a
   CRT switch-off or dies in the rubble, then the result stage rolls in.

   How it sits on the game (presentation only):
     playElimination / playEliminationGroup  replaced by one sequence (a
       single K.O. is a group of one). The eject is still the game's own
       launchPortrait() / stepPortrait() with KO_PORTRAIT_PHYSICS_CONFIG;
       this file only drives the loop around them.
     presentResultStage  wrapped: a bust's negative result (RUN OVER,
       EVENT LOST) plays the game-over beat first, then hands over.
   It never touches chips, eliminations, K.O. attribution or saves.
   Reduced Motion goes straight to the game's own instant end state.
   The new sounds are a small synth here (unlocked by the first tap); they
   belong in the Sound module in a later pass.
   ============================================================ */
const Knockout = (function(){
  const ORIG = {
    one: window.playElimination,
    group: window.playEliminationGroup,
    stage: window.presentResultStage
  };
  // The owner's order (round 3). Every option the lab offered is still
  // here, so a later round can retune it in one place.
  const KNOCKOUT_ORDER = {
    len:'today', build:'count', spot:'0', stamp:'big', blam:'debris', multi:'stagger', react:'flinch',
    trail:'light', face:'reacts', sparks:'sparks', seats:'solid', slow:'0', exit:'0', socket:'smoke',
    killer:'gloat', hit:'thunks', damage:'chain', amount:'random', fuse:'any', cards:'pop', lights:'mix', gopace:'long',
    pScreens:'on', pNumbers:'on', pLamps:'on', pRim:'on', pKey:'on', pBracket:'on'
  };
  const O = KNOCKOUT_ORDER;

  const LEN = {
    short:{ k:.75, hold:0,   slow:.8,  count:330 },
    today:{ k:1,   hold:0,   slow:1,   count:430 },
    long: { k:1.3, hold:230, slow:1.3, count:520 },
    epic: { k:1.65,hold:450, slow:1.7, count:620 }
  };
  const PACE = { quick:.8, long:1.3 };
  const L = () => LEN[O.len] || LEN.today;
  const sleepK = ms => sleep(ms * L().k);
  const now = () => performance.now();
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const $id = id => document.getElementById(id);
  const quiet = () => typeof motionOff === 'function' && motionOff();

  /* ---------------- sound (own synth; the shipped build would add
     these to the Sound module) ---------------- */
  const Snd = (function(){
    let ctx = null, master = null, nbuf = null;
    function ac(){
      if (typeof settings === 'undefined' || !settings.sound) return null;
      try{
        if (!ctx){ ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .85; master.connect(ctx.destination); }
        if (ctx.state === 'suspended') ctx.resume();
      }catch(e){ return null; }
      return ctx;
    }
    function tone(f, dur, type, vol, when, to){
      const c = ac(); if (!c) return;
      const t = c.currentTime + (when || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + .006);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .03);
    }
    function noise(dur, vol, o){
      const c = ac(); if (!c) return;
      o = o || {};
      if (!nbuf){ nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const t = c.currentTime + (o.when || 0);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = nbuf; s.loop = true;
      f.type = o.type || 'lowpass'; f.Q.value = o.q || .8;
      f.frequency.setValueAtTime(o.f || 1000, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || .004));
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .03);
    }
    return {
      unlock(){ ac(); },
      // a boxing bell: an inharmonic strike that rings
      bell(pitch, when){
        const b = 760 * (pitch || 1);
        [[1,.13,1.1],[2.76,.07,.7],[5.4,.04,.4],[8.9,.025,.25]].forEach(([m, v, d]) => tone(b * m, d, 'sine', v, when));
        noise(.03, .06, { type:'highpass', f:3000, when });
      },
      finalBell(){ [0, .16, .32].forEach(w => this.bell(1.06, w)); },
      whoosh(dur){ noise(dur, .09, { type:'bandpass', f:300, to:2600, q:1.4, attack:dur * .8 }); },
      glass(v){
        v = v || 1;
        noise(.09, .16 * v, { type:'highpass', f:2200 });
        noise(.35, .07 * v, { type:'bandpass', f:5200, to:2600, q:3 });
        for (let i = 0; i < 6; i++) tone(rand(2800, 6200), rand(.05, .14), 'sine', .03 * v, rand(.02, .26));
        tone(95, .22, 'square', .08 * v, 0, 45);
      },
      hiss(dur){ noise(dur, .045, { type:'highpass', f:3500, attack:.02 }); for (let i = 0; i < 4; i++) noise(.02, .08, { type:'highpass', f:rand(2000, 6000), when:rand(0, dur * .8) }); },
      tick(v){ v = v || 1; tone(rand(1700, 2300), .018, 'square', .018 * v); },
      bulb(){ tone(rand(3200, 4200), .06, 'sine', .05); noise(.05, .1, { type:'highpass', f:5000 }); tone(120, .08, 'square', .04, .02, 60); },
      clank(){ tone(210, .3, 'square', .05, 0, 150); tone(317, .22, 'square', .035, .01, 240); noise(.08, .09, { type:'bandpass', f:900, q:2 }); },
      powerDown(){ tone(420, 1.1, 'sawtooth', .04, 0, 35); tone(60, .5, 'square', .05, .1, 30); },
      slide(dur){ noise(dur, .025, { type:'bandpass', f:1800, to:1100, q:6, attack:.05 }); },
      zap(){
        for (let i = 0; i < 5; i++) noise(.025, .09, { type:'highpass', f:rand(2500, 5000), when:i * rand(.03, .06) });
        tone(190, .22, 'sawtooth', .05, 0, 55);
      },
      pop(){ tone(900, .05, 'square', .06, 0, 300); tone(70, .12, 'square', .08, .01, 40); },
      buzzer(dur){ tone(98, dur, 'square', .06); tone(104, dur, 'square', .05); },
      crtOff(v){ v = v || 1; tone(1400, .32, 'sine', .05 * v, 0, 60); noise(.12, .08 * v, { type:'lowpass', f:400, to:80 }); },
      crtOn(){ tone(70, .3, 'sine', .04, 0, 900); noise(.25, .04, { type:'highpass', f:3000, attack:.1 }); },
      kaching(){ tone(2093, .09, 'square', .035); tone(2637, .22, 'square', .035, .07); noise(.05, .05, { type:'highpass', f:4000, when:.07 }); }
    };
  })();

  /* ---------------- tiny helpers ---------------- */
  const fxLayer = () => {
    let l = document.querySelector('.kofx-fx');
    if (!l){ l = document.createElement('div'); l.className = 'kofx-fx'; document.body.appendChild(l); }
    return l;
  };
  function restart(el, cls, vars){
    if (!el) return;
    if (vars) Object.keys(vars).forEach(k => el.style.setProperty(k, vars[k]));
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    clearTimeout(el['_t_' + cls]);
    el['_t_' + cls] = setTimeout(() => el.classList.remove(cls), 700);
  }
  function shakeScreen(px, ms){ restart($id('table-screen'), 'kofx-shake', { '--kx':px + 'px', '--kx-ms':(ms || 260) + 'ms' }); }
  function flash(ms, alpha){
    const f = document.createElement('div');
    f.className = 'kofx-flash'; f.style.opacity = alpha || .85;
    document.body.appendChild(f);
    setTimeout(() => { f.style.opacity = (alpha || .85) * .35; }, ms * .5);
    setTimeout(() => f.remove(), ms);
  }
  const rectOf = el => el && el.getBoundingClientRect();
  const feltBox = () => rectOf($id('felt')) || { left:0, top:0, width:innerWidth, height:innerHeight };
  const faceColour = p => (typeof FACE_COLORS !== 'undefined' && FACE_COLORS[p.faceColorIdx]) ? FACE_COLORS[p.faceColorIdx].fill : '#B69A7A';

  /* ---------------- particles (sparks, debris, smoke) ---------------- */
  const bits = [];
  let bitsRaf = 0;
  function spawnBits(x, y, o){
    const layer = fxLayer();
    for (let i = 0; i < o.n; i++){
      const a = (o.dir != null ? o.dir : -Math.PI / 2) + rand(-1, 1) * (o.spread != null ? o.spread : Math.PI);
      const sp = rand(o.speed[0], o.speed[1]);
      const el = document.createElement('i');
      el.className = 'kofx-bit';
      const s = Math.round(rand(o.size[0], o.size[1]) / 2) * 2;
      el.style.width = el.style.height = s + 'px';
      el.style.background = pick(o.colors);
      if (o.shadow) el.style.boxShadow = '1px 1px 0 rgba(0,0,0,.5)';
      layer.appendChild(el);
      bits.push({ el, x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, g:o.gravity || 0, life:rand(o.life[0], o.life[1]), t0:now(), grow:o.grow || 0, s, fade:o.fade !== false, drag:o.drag || 0 });
    }
    if (!bitsRaf) bitsRaf = requestAnimationFrame(stepBits);
  }
  let bitsLast = 0;
  function stepBits(t){
    const dt = Math.min(.033, bitsLast ? (t - bitsLast) / 1000 : .016);
    bitsLast = t;
    for (let i = bits.length - 1; i >= 0; i--){
      const b = bits[i], age = (t - b.t0) / b.life;
      if (age >= 1){ b.el.remove(); bits.splice(i, 1); continue; }
      b.vy += b.g * dt;
      if (b.drag){ const d = Math.max(0, 1 - b.drag * dt); b.vx *= d; b.vy *= d; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      const sc = 1 + b.grow * age;
      b.el.style.transform = 'translate(' + (Math.round(b.x / 2) * 2) + 'px,' + (Math.round(b.y / 2) * 2) + 'px) scale(' + sc.toFixed(2) + ')';
      if (b.fade) b.el.style.opacity = age > .6 ? (Math.ceil((1 - age) / .4 * 3) / 3).toFixed(2) : 1;
    }
    if (bits.length) bitsRaf = requestAnimationFrame(stepBits); else { bitsRaf = 0; bitsLast = 0; }
  }
  const sparks = (x, y, dir, n) => spawnBits(x, y, { n:n || 10, dir, spread:1.1, speed:[140, 420], size:[2, 4], colors:['#FFF4C2','#FFD24A','#FF9B2E','#FFFFFF'], gravity:900, life:[180, 380], drag:2 });
  const debris = (x, y, colour) => spawnBits(x, y, { n:18, dir:Math.PI / 2, spread:1.35, speed:[120, 480], size:[2, 6], colors:[colour, colour, '#3A3236', '#1A0D10', '#E8B83A'], gravity:1300, life:[380, 760], shadow:true });

  /* smoke keeps rising from a socket until stopped */
  const smokers = new Set();
  function smoke(el, ms){
    const h = { stop:false };
    smokers.add(h);
    const t0 = now();
    (function puff(){
      if (h.stop || now() - t0 > ms){ smokers.delete(h); return; }
      const r = rectOf(el);
      if (r && r.width){
        const x = r.left + r.width * rand(.25, .75), y = r.top + r.height * rand(.3, .7);
        const fading = (now() - t0) / ms;
        spawnBits(x, y, { n:1, dir:-Math.PI / 2, spread:.35, speed:[26, 52], size:[6, 10], colors:['rgba(160,156,150,.55)','rgba(120,116,112,.5)','rgba(190,186,178,.45)'], gravity:-10, life:[900, 1400], grow:1.6, drag:.4 });
        if (Math.random() < .12 * (1 - fading)) sparks(x, y, -Math.PI / 2, 3);
      }
      setTimeout(puff, 90 + 140 * ((now() - t0) / ms));
    })();
    return h;
  }

  /* ---------------- spotlight ---------------- */
  let spotEl = null;
  /* A pool of light on each seat, the rest of the screen gently dimmed.
     Drawn once on a canvas (dark sheet, light cut out of it) and faded in
     and out in steps. SOFT: a round pool with a long soft edge. RINGS: the
     same pool as four stepped rings, pixel-art lighting. BEAM: a cone from
     the top of the screen down onto the seat. `mode` overrides the order
     (the killer's gloat always uses SOFT). */
  const SPOT_DARK = .4;
  function spotlight(els, mode){
    spotOff(true);
    mode = mode || O.spot;
    const rs = els.map(rectOf).filter(r => r && r.width);
    if (!rs.length || mode === '0') return;
    const W = innerWidth, H = innerHeight;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W / 2); cv.height = Math.ceil(H / 2);   // half resolution: chunky, cheap
    cv.className = 'kofx-spot';
    const x = cv.getContext('2d');
    x.scale(.5, .5);
    x.fillStyle = 'rgba(10,2,5,' + SPOT_DARK + ')';
    x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'destination-out';
    rs.forEach(r => {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const R = Math.hypot(r.width, r.height) / 2 + 6;
      if (mode === 'rings'){
        [[R + 34, .3], [R + 22, .55], [R + 11, .8], [R, 1]].forEach(([rr, a]) => {
          x.fillStyle = 'rgba(0,0,0,' + a + ')';
          x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill();
        });
      } else {
        if (mode === 'beam'){
          const top = Math.max(0, r.top - 260), wTop = r.width * .35, wBot = r.width / 2 + 22;
          const grd = x.createLinearGradient(0, top, 0, cy);
          grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.75)');
          x.fillStyle = grd;
          x.beginPath(); x.moveTo(cx - wTop, top); x.lineTo(cx + wTop, top); x.lineTo(cx + wBot, cy); x.lineTo(cx - wBot, cy); x.closePath(); x.fill();
        }
        const g = x.createRadialGradient(cx, cy, R * .55, cx, cy, R + 60);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(cx, cy, R + 60, 0, Math.PI * 2); x.fill();
      }
    });
    spotEl = cv;
    document.body.appendChild(cv);
    void cv.offsetWidth;
    cv.classList.add('is-on');
  }
  function spotOff(now_){
    const s = spotEl; spotEl = null;
    if (!s) return;
    if (now_){ s.remove(); return; }
    s.classList.remove('is-on');
    setTimeout(() => s.remove(), 420);
  }

  /* ---------------- the big stamp ---------------- */
  let stampEl = null;
  function bigStamp(kos, anyKo){
    const f = feltBox();
    const el = document.createElement('div');
    el.className = 'kofx-stamp' + (anyKo ? '' : ' is-out');
    const word = ['', '', 'DOUBLE', 'TRIPLE', 'QUAD', 'PENTA'][kos] || (kos > 1 ? kos + 'x' : '');
    el.innerHTML = (anyKo && word ? '<small>' + word + '</small>' : '') + '<b>' + (anyKo ? 'K.O.!' : 'OUT!') + '</b>';
    el.style.left = (f.left + f.width / 2) + 'px';
    el.style.top = (f.top + f.height * .43) + 'px';
    document.body.appendChild(el);
    el.animate([
      { transform:'translate(-50%,-50%) scale(3.2) rotate(-6deg)', opacity:0 },
      { transform:'translate(-50%,-50%) scale(.86,1.12) rotate(-2deg)', opacity:1, offset:.6 },
      { transform:'translate(-50%,-50%) scale(1.06,.92) rotate(-3deg)', opacity:1, offset:.8 },
      { transform:'translate(-50%,-50%) scale(1) rotate(-3deg)', opacity:1 }
    ], { duration:230, easing:'steps(6,end)', fill:'forwards' });
    setTimeout(() => { shakeScreen(5, 200); Sound.koThunk(2.8); }, 140);
    stampEl = el;
  }
  function stampAway(){
    const el = stampEl; stampEl = null;
    if (!el) return;
    const dir = Math.random() < .5 ? -1 : 1;
    el.animate([
      { transform:'translate(-50%,-50%) scale(1) rotate(-3deg)', opacity:1 },
      { transform:'translate(calc(-50% + ' + (dir * 30) + 'px),-40%) scale(1.15) rotate(' + (dir * 14) + 'deg)', opacity:1, offset:.3 },
      { transform:'translate(calc(-50% + ' + (dir * 90) + 'px),60%) scale(.9) rotate(' + (dir * 40) + 'deg)', opacity:0 }
    ], { duration:420, easing:'steps(7,end)', fill:'forwards' });
    setTimeout(() => el.remove(), 440);
  }

  /* ---------------- readout writing (Enemy Cards V2 CRT) ---------------- */
  function readout(e, a, b, ink){
    const box = e && e.card && e.card.querySelector('.ec-read');
    if (!box){ if (e && e.actionSlot) e.actionSlot.textContent = (a + ' ' + (b || '')).trim(); return; }
    const glass = box.firstChild;
    if (e._ec) clearInterval(e._ec.rollT);
    if (ink) glass.dataset.ink = ink; else delete glass.dataset.ink;
    glass.querySelector('.ec-v').innerHTML = a;
    glass.querySelector('.ec-a').textContent = b || '';
    glass.classList.remove('ec-blip'); void glass.offsetWidth; glass.classList.add('ec-blip');
  }
  function releaseReadout(e){ if (e && e._ec){ e._ec.read = null; } }

  /* ---------------- faces held for a moment ---------------- */
  function holdFace(e, p, mood, ms){
    if (!e || !e.avatar || !settings.faces || p.eliminated) return;
    if (!e._kofxHold) e._kofxHold = { saved:e._mood || 'idle', n:0 };
    const n = ++e._kofxHold.n;
    e._faceLock = 'kofx';
    swapFace(e, p, mood, true);
    setTimeout(() => {
      if (!e._kofxHold || e._kofxHold.n !== n) return;
      const saved = e._kofxHold.saved; e._kofxHold = null;
      if (e._faceLock === 'kofx') e._faceLock = null;
      if (p.eliminated || !e.avatar.classList.contains('has-face')) return;
      e._mood = saved; swapFace(e, p, saved, false);
    }, ms);
  }

  const QUIPS = {
    rock:[['NOT','ME'],['STAY','TIGHT']], shark:[['FRESH','BLOOD'],['NEXT','?']], maniac:[['HA HA','HA!'],['BOOM!','']],
    station:[['OH','DEAR'],['POOR','LAMB']], grinder:[['ONE','LESS'],['STEADY','ON']], wildcard:[['WHEE!',''],['WILD!','']],
    professor:[['Q.E.D.',''],['NOTED','']], hammer:[['BONK!',''],['DOWN','GOES']]
  };
  const GLOATS = {
    rock:[['SIT','DOWN']], shark:[['EASY','MONEY']], maniac:[['BYE','BYE!']], station:[['SORRY','LOVE']],
    grinder:[['GOOD','GAME']], wildcard:[['OOPS!','']], professor:[['CHECK','MATE']], hammer:[['LIGHTS','OUT']]
  };
  const lines = (T, p) => pick(T[p.personality && p.personality.key] || [['GOOD','GAME']]);

  /* ---------------- the flight: the game's physics, with extras ------- */
  let slowUntil = 0, slowScale = 1;
  const FLIGHT_FACES = ['shocked1','dead1','panic1','baffled1','dead2','confused1','shock','dead3'];

  function contactOf(c, pvx, pvy){
    let nx = c.vx - pvx, ny = c.vy - pvy;
    const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
    return { x:c.x - nx * c.halfW, y:c.y - ny * c.halfH, nx, ny };
  }
  function onImpact(c, pvx, pvy, first, isExit, seatRects){
    const k = contactOf(c, pvx, pvy);
    if (O.sparks === 'sparks'){
      sparks(k.x, k.y, Math.atan2(k.ny, k.nx), isExit ? 16 : 10);
      if (isExit) shakeScreen(4, 180);
    }
    if (O.face === 'reacts' && c.p && c.kind === 'portrait'){
      c._fi = ((c._fi == null ? -1 : c._fi) + 1) % FLIGHT_FACES.length;
      c.el.innerHTML = renderFace(c.p, FLIGHT_FACES[c._fi]);
    }
    if (seatRects){
      const hit = seatRects.find(s => k.x > s.r.left - 12 && k.x < s.r.right + 12 && k.y > s.r.top - 12 && k.y < s.r.bottom + 12);
      if (hit && now() - (hit.e._kofxRattle || 0) > 250){
        hit.e._kofxRattle = now();
        restart(hit.e.card, 'ec-shudder');
        holdFace(hit.e, hit.p, pick(['shocked1','shock','angry1']), 850);
      }
    }
    if (first && (O.slow === 'first' || O.slow === 'both')){ slowUntil = now() + 380 * L().slow; slowScale = .22; }
    if (isExit && (O.slow === 'last' || O.slow === 'both')){ slowUntil = now() + 320 * L().slow; slowScale = .25; }
  }
  // TRAIL strength: how often a ghost drops, how strong it starts, how
  // long it lasts. HEAVY ('ghosts') is round 1's.
  const TRAIL = { faint:{ gap:95, a:.2, life:130 }, light:{ gap:62, a:.28, life:160 }, ghosts:{ gap:34, a:.4, life:210 } };
  function trail(c, t){
    const T = TRAIL[O.trail];
    if (!T || !c.emerged || c.done) return;
    if (t - (c._lastGhost || 0) < T.gap) return;
    c._lastGhost = t;
    const g = document.createElement('div');
    g.className = c.el.className + ' kofx-ghost';
    g.innerHTML = c.el.innerHTML;
    g.style.cssText = c.el.style.cssText;
    g.style.clipPath = '';
    g.style.opacity = T.a;
    g.style.animationDuration = T.life + 'ms';
    c.el.parentNode.insertBefore(g, c.el);
    setTimeout(() => g.remove(), T.life + 20);
  }
  function exitKind(c){ return O.exit === 'glass' ? 'glass' : O.exit === 'mix' ? (c._mix || (c._mix = Math.random() < .5 ? 'glass' : 'off')) : 'off'; }

  /* The last bounce becomes a flight at the camera: it grows, smacks the
     glass (a crack), holds, slides down it and drops away. */
  function glassExit(c){
    c.glass = true;
    const k = L().k * ((O.slow === 'last' || O.slow === 'both') ? 1.7 : 1);
    const f = feltBox();
    const x0 = c.x, y0 = c.y, r0 = c.rot;
    const tx = x0 + (f.left + f.width / 2 - x0) * .55, ty = y0 + (f.top + f.height * .45 - y0) * .55;
    // one more spin in the way it was already turning, landing near upright
    const S = 3.3, a = rand(-12, 12), spun = r0 + (Math.sign(c.vrot) || 1) * 360;
    const rEnd = a + 360 * Math.round((spun - a) / 360);
    const set = (x, y, s, r) => {
      c.el.style.left = (x - c.halfW) + 'px'; c.el.style.top = (y - c.halfH) + 'px';
      c.el.style.transform = 'rotate(' + r.toFixed(1) + 'deg) scale(' + s.toFixed(3) + ')';
    };
    c.el.style.clipPath = ''; c.el.style.zIndex = '2';
    Snd.whoosh(.3 * k);
    const D1 = 300 * k, t0 = now();
    return new Promise(res => {
      (function approach(){
        const t = Math.min(1, (now() - t0) / D1), e = t * t;
        set(x0 + (tx - x0) * e, y0 + (ty - y0) * e, 1 + (S - 1) * e, r0 + (rEnd - r0) * Math.sqrt(t));
        trail(c, now());
        if (t < 1){ requestAnimationFrame(approach); return; }
        // SMACK
        c.el.classList.add('kofx-onglass');
        if (O.face === 'reacts' && c.p) c.el.innerHTML = renderFace(c.p, pick(['dead1','dead2','dead3']));
        Snd.glass(); Sound.koBlast();
        haptic([50, 20, 70]);
        shakeScreen(9, 300); flash(90, .5);
        c.el.animate([{ transform:'rotate(' + rEnd + 'deg) scale(' + (S * 1.1) + ',' + (S * .9) + ')' }, { transform:'rotate(' + rEnd + 'deg) scale(' + S + ')' }], { duration:90, easing:'steps(3,end)' });
        const hold = 460 * L().k, slide = 720 * L().k, drop = 520;
        setTimeout(() => {
          Snd.slide(slide / 1000);
          const s0 = now();
          (function slideDown(){
            const t = Math.min(1, (now() - s0) / slide);
            set(tx, ty + 46 * t * t, S, rEnd + 5 * t);
            if (t < 1){ requestAnimationFrame(slideDown); return; }
            const d0 = now(), yS = ty + 46;
            (function fall(){
              const t = Math.min(1, (now() - d0) / drop);
              set(tx + 20 * t, yS + (innerHeight - yS + c.halfH * S + 60) * t * t, S - (S - 1.3) * t, rEnd + 5 + 50 * t * t);
              if (t < 1){ requestAnimationFrame(fall); return; }
              c.done = true; res();
            })();
          })();
        }, hold);
      })();
    });
  }
  function crack(x, y, r0){
    const R = 170, svg = crackSvg(R, Math.max(10, r0 * .18));
    svg.setAttribute('class', 'kofx-crack');
    svg.style.left = (x - R) + 'px'; svg.style.top = (y - R) + 'px';
    document.body.appendChild(svg);
    const live = 1500 * L().k;
    setTimeout(() => svg.animate([{ opacity:1 }, { opacity:0 }], { duration:420, easing:'steps(4,end)', fill:'forwards' }), live);
    setTimeout(() => svg.remove(), live + 450);
  }
  // a pixel crack: jagged spokes from the impact, chords between them
  function crackSvg(R, core){
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', R * 2); svg.setAttribute('height', R * 2);
    svg.setAttribute('viewBox', (-R) + ' ' + (-R) + ' ' + (R * 2) + ' ' + (R * 2));
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.style.position = 'absolute';
    const q = v => Math.round(v / 2) * 2;
    const spokes = [], N = 9 + Math.floor(Math.random() * 4);
    let d = '';
    for (let i = 0; i < N; i++){
      let a = i / N * Math.PI * 2 + rand(-.25, .25), rad = rand(core * .5, core);
      const pts = [[q(Math.cos(a) * rad), q(Math.sin(a) * rad)]];
      const len = rand(.55, 1) * (R - 8), steps = 3 + Math.floor(Math.random() * 3);
      for (let s = 1; s <= steps; s++){
        a += rand(-.28, .28); rad = len * s / steps;
        pts.push([q(Math.cos(a) * rad), q(Math.sin(a) * rad)]);
      }
      spokes.push(pts);
      d += 'M' + pts.map(p => p.join(' ')).join('L');
    }
    // rings: short chords between neighbouring spokes
    for (let i = 0; i < N; i++){
      const A = spokes[i], B = spokes[(i + 1) % N];
      [1, 2].forEach(j => { if (A[j] && B[j] && Math.random() < .6) d += 'M' + A[j].join(' ') + 'L' + B[j].join(' '); });
    }
    svg.innerHTML =
      '<path d="' + d + '" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="4" stroke-linecap="square"/>' +
      '<path d="' + d + '" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2" stroke-linecap="square"/>' +
      '<circle r="' + Math.round(core) + '" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" stroke-width="2"/>';
    return svg;
  }

  /* One rAF loop for everything in flight: portraits, buttons, cards. */
  function fly(cs, obsFor, seatRects, open){
    const cfg = KO_PORTRAIT_PHYSICS_CONFIG;
    const maxMs = 7000 * L().k;
    const glassJobs = [];
    return new Promise(resolve => {
      let last = now();
      function frame(t){
        let dt = Math.min(.032, (t - last) / 1000); last = t;
        if (t < slowUntil) dt *= slowScale;
        cs.forEach(c => {
          if (c.done || c.glass) return;
          if (t < c._activeAt){ applyPortraitTransform(c); return; }
          if (c.kind !== 'portrait' && !c.cleared && c.y + c.halfH < c.dashTop) c.cleared = true;
          const pvx = c.vx, pvy = c.vy, pc = c.impactCount, pe = c.exiting;
          stepPortrait(c, dt, obsFor(c));
          const exitNow = c.exiting && !pe;
          if (c.impactCount > pc || exitNow) onImpact(c, pvx, pvy, pc === 0 && c.impactCount > 0 && c.kind === 'portrait', exitNow, c.kind === 'portrait' ? seatRects : null);
          trail(c, t);
          if (c.kind === 'portrait' && c.readyToExit && !c.exiting && exitKind(c) === 'glass') glassJobs.push(glassExit(c));
        });
        for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++){
          if (cs[i].glass || cs[j].glass) continue;
          resolvePortraitPair(cs[i], cs[j]);
        }
        let allDone = true;
        cs.forEach(c => {
          if (c.done) return;
          if (c.glass){ allDone = false; return; }
          const m = cfg.exitMarginPx;
          const off = (c.exiting || c.kind !== 'portrait') && (c.x + c.halfW < -m || c.x - c.halfW > innerWidth + m || c.y + c.halfH < -m || c.y - c.halfH > innerHeight + m);
          if (off || t - c._t0 > maxMs) c.done = true; else allDone = false;
        });
        if (!allDone || (open && open())) requestAnimationFrame(frame);
        else Promise.all(glassJobs).then(resolve);
      }
      requestAnimationFrame(frame);
    });
  }
  function koObs(extra){ return koObstacles().concat(extra || []); }

  /* ---------------- THE K.O. ---------------- */
  let running = null;
  async function koSequence(entries){
    if (!entries.length) return;
    // Reduced Motion: the game's own instant end state. A single K.O. goes
    // to the original single path (the original group function would call
    // back into playElimination, which is this file now).
    if (quiet()) return entries.length === 1 ? ORIG.one(entries[0].p, { ko:entries[0].ko }) : ORIG.group(entries);
    const live = entries.map(({ p, ko }) => { const e = seatEls[p.id]; return (e && e.card) ? { p, ko, e } : null; }).filter(Boolean);
    if (!live.length) return;
    const anyKo = live.some(x => x.ko), koN = live.filter(x => x.ko).length;
    const cfg = anyKo ? ELIMINATION_CONFIG.koTimings : ELIMINATION_CONFIG.elimTimings;
    const shake = anyKo ? ELIMINATION_CONFIG.shakeIntensity.ko : ELIMINATION_CONFIG.shakeIntensity.elim;
    const doomed = new Set(live.map(x => x.p));
    const survivors = game.players.filter(p => !p.isHuman && !p.eliminated && !doomed.has(p)).map(p => ({ p, e:seatEls[p.id] })).filter(x => x.e && x.e.card);
    live.forEach(le => { le.e._faceLock = 'kofx-ko'; });

    const showFace = (le, mood) => { le.e._mood = null; le.e.avatar.classList.add('has-face'); swapFace(le.e, le.p, mood, false); };
    const hitAll = mult => {
      live.forEach(le => {
        const card = le.e.card, dir = Math.random() < .5 ? -1 : 1;
        card.style.setProperty('--hit-dx', Math.round(dir * (9 + 4 * mult) * shake) + 'px');
        card.style.setProperty('--hit-dy', Math.round((Math.random() < .4 ? -1 : 0) * (1 + mult)) + 'px');
        card.style.setProperty('--hit-ms', cfg.hitMs + 'ms');
        card.classList.remove('elim-hit'); void card.offsetWidth; card.classList.add('elim-hit');
      });
      Sound.koThunk(1 + mult * .35);
      haptic(18 + Math.round(mult * 10));
    };
    const clearHit = () => live.forEach(le => le.e.card.classList.remove('elim-hit'));

    if (O.spot !== '0') spotlight(live.map(le => le.e.card));
    await sleepK(cfg.settleMs);
    live.forEach(le => showFace(le, Math.random() < .5 ? 'shock' : 'shocked'));

    // BUILD-UP
    if (O.build === 'today' || O.build === 'both'){
      hitAll(1.0); await sleepK(cfg.hitMs + cfg.hitHoldMs); clearHit();
      await sleepK(cfg.hitGapMs);
      hitAll(1.8); await sleepK(cfg.hitMs + cfg.hitHoldMs); clearHit();
      if (O.build === 'both') await sleepK(120);
    }
    if (O.build === 'count' || O.build === 'both'){
      const faces = ['veryNervous1', 'terrified1', 'panic1'];
      for (let i = 0; i < 3; i++){
        live.forEach(le => {
          readout(le.e, '<span class="kofx-num">' + (3 - i) + '</span>', '', 'danger');
          le.e.card.dataset.rim = 'allin';
          restart(le.e.card, 'kofx-count');
          showFace(le, faces[i]);
        });
        Snd.bell(1 - i * .04);
        Sound.koThunk(.8 + i * .5);
        haptic(14 + i * 8);
        if (i === 2) hitAll(1.4);
        await sleep(L().count);
        clearHit();
      }
    }

    // STAMP
    live.forEach(le => {
      showFace(le, pickDeadMood());
      le.p.streetAction = { type:le.ko ? 'ko' : 'eliminated', label:le.ko ? 'K.O.!' : 'ELIMINATED!', amount:0 };
      releaseReadout(le.e);
      if (le.e.actionSlot){ le.e.actionSlot.classList.remove('elim-slam'); void le.e.actionSlot.offsetWidth; le.e.actionSlot.classList.add('elim-slam'); }
    });
    render();
    Sound.busted(false);
    if (anyKo){ Sound.humanKO(); haptic(40); }
    if (O.build !== 'today') Snd.finalBell();
    if (O.stamp === 'big') bigStamp(koN, anyKo);
    await sleepK(cfg.thunkGapMs + (O.stamp === 'big' ? 160 : 0));

    // POWER FAILS
    live.forEach(le => { le.e.card.style.setProperty('--fail-ms', cfg.failMs + 'ms'); le.e.card.classList.add('elim-fail'); });
    Sound.koThunk(2.4); haptic(anyKo ? 50 : 34);
    await sleepK(cfg.failMs);
    live.forEach(le => le.e.card.classList.add('elim-critical'));
    Sound.koFailClick();
    await sleepK(cfg.glitchMs);
    live.forEach(le => le.e.card.classList.remove('elim-critical'));

    // PRELOAD -> stillness
    live.forEach(le => {
      const wrap = le.e.avatar && le.e.avatar.closest('.avatar-wrap');
      if (wrap){ wrap.style.setProperty('--pressure-ms', (cfg.anticipateMs * L().k + L().hold) + 'ms'); wrap.classList.remove('pressure-build'); void wrap.offsetWidth; wrap.classList.add('pressure-build'); }
    });
    await sleep(cfg.anticipateMs * L().k + L().hold);

    // BLAM (staggered for a multi)
    const layer = document.createElement('div');
    layer.className = 'ko-physics-layer';
    document.body.appendChild(layer);
    const cs = [];
    const seatRects = O.seats === 'solid' ? survivors.map(s => ({ ...s, r:rectOf(s.e.card) })) : null;
    const obs = koObs(seatRects ? seatRects.map(s => ({ tag:'seat', rect:{ left:s.r.left, right:s.r.right, top:s.r.top, bottom:s.r.bottom } })) : []);
    // MULTI K.O.: TODAY fires them 80-140ms apart; STAGGER and SLOW fire
    // one after another, each with its own blast, the last the biggest.
    // The flight is already running, so each face joins it as it fires.
    const GAP = { stagger:[520, 660], slow:[860, 1020] }[O.multi];
    let launching = true, flying = null;
    const order = GAP ? live.slice().sort(() => Math.random() - .5) : live;
    for (let i = 0; i < order.length; i++){
      const le = order[i];
      const ar = rectOf(le.e.avatar);
      const c = launchPortrait(le.e, le.ko, layer);
      if (c){ c.kind = 'portrait'; c.p = le.p; cs.push(c); }
      if (!flying && cs.length) flying = fly(cs, () => obs, seatRects, () => launching);
      const crescendo = GAP ? 1 + i * .25 : 1;
      if (i === 0){
        stampAway();
        if (O.react !== '0') survivors.forEach(s => { holdFace(s.e, s.p, pick(['shocked1','shock','terrified1']), (1100 + (GAP ? GAP[1] * (order.length - 1) : 0)) * L().k); restart(s.e.card, 'ec-shudder'); });
      }
      if (O.blam !== '0' && (i === 0 || GAP)){ shakeScreen((anyKo ? 8 : 5) * crescendo, 280); flash(70, Math.min(.9, (anyKo ? .75 : .5) * crescendo)); }
      if (O.blam === 'debris' && ar) debris(ar.left + ar.width / 2, ar.bottom, faceColour(le.p));
      if (i < order.length - 1){
        if (GAP){
          // the ones still waiting rattle in their sockets
          order.slice(i + 1).forEach(w => restart(w.e.card, 'ec-shudder'));
          await sleep(rand(GAP[0], GAP[1]));
        } else await sleep(ELIMINATION_CONFIG.multiKoPopGapMin + Math.random() * (ELIMINATION_CONFIG.multiKoPopGapMax - ELIMINATION_CONFIG.multiKoPopGapMin));
      }
    }
    launching = false;
    if (flying) await flying;
    layer.remove();
    spotOff();

    // AFTERMATH
    live.forEach(le => {
      le.e.root.classList.add('dead');
      if (O.socket === 'static' || O.socket === 'both') staticSocket(le.e);
      if (O.socket === 'smoke' || O.socket === 'both') le.e._kofxSmoke = smoke(le.e.avatar, 4200 * L().k);
      le.e._faceLock = null;
    });
    await sleepK(cfg.aftermathMs);
    render();
    if (O.react === 'quip' && survivors.length && Math.random() < .75){
      const s = pick(survivors), [a, b] = lines(QUIPS, s.p);
      await sleep(300);
      readout(s.e, a, b, 'money');
      holdFace(s.e, s.p, pick(['smug1','cocky1','gloating1','happy1']), 1900);
      setTimeout(() => { releaseReadout(s.e); render(); }, 1900);
    }
  }
  function staticSocket(e){
    const av = e.avatar; if (!av) return;
    if (getComputedStyle(av).position === 'static') av.style.position = 'relative';
    const st = document.createElement('div');
    st.className = 'kofx-static';
    st.style.backgroundImage = 'url(' + snowTex() + ')';
    st.innerHTML = '<span>NO<br>SIGNAL</span>';
    av.appendChild(st);
  }
  let snowURL = null;
  function snowTex(){
    if (snowURL) return snowURL;
    const c = document.createElement('canvas'); c.width = c.height = 40;
    const x = c.getContext('2d'), d = x.createImageData(40, 40);
    for (let i = 0; i < d.data.length; i += 4){ const v = Math.random() < .5 ? Math.random() * 80 : 120 + Math.random() * 135; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    return (snowURL = c.toDataURL());
  }

  /* ---------------- YOUR GAME OVER ---------------- */
  function killerOf(g){
    const opp = g.players.filter(p => !p.isHuman && !p.eliminated);
    const named = g.run && g.run.bustedBy && g.run.bustedBy.names;
    const byName = named && opp.find(p => String(named).includes(p.name));
    return byName || opp.filter(p => seatEls[p.id] && seatEls[p.id].root.classList.contains('winner'))[0] || opp.sort((a, b) => b.chips - a.chips)[0] || null;
  }
  function makeBody(el, r, o){
    const cfg = KO_PORTRAIT_PHYSICS_CONFIG, vh = innerHeight, t = now();
    const c = {
      el, x:r.left + r.width / 2, y:r.top + r.height / 2, vx:o.vx, vy:o.vy, rot:0, vrot:o.vrot,
      halfW:r.width / 2, halfH:r.height / 2, impactCount:0, impactsTarget:o.impacts,
      readyToExit:false, exiting:false, done:false, lastImpactAt:0, emerged:true, housingBottomY:-1e9, _squashT0:0,
      _t0:t, _activeAt:t + (o.delay || 0), gravity:vh * cfg.gravityVh, dashboardKick:vh * cfg.dashboardKickVh,
      impactVelThreshold:vh * cfg.impactVelThresholdVh, exitSpeedMin:vh * cfg.exitSpeedMinVh, exitSpeedMax:vh * cfg.exitSpeedMaxVh,
      kind:o.kind, dashTop:o.dashTop, cleared:false
    };
    applyPortraitTransform(c);
    return c;
  }
  /* An exact copy of a part of the machine, free of the selectors that
     style it in place: every element's computed style is written onto the
     copy, so a card, a button or a lamp looks exactly as it did. */
  const SKIP = /^(animation|transition|will-change|position|inset|left|top|right|bottom|margin|transform|translate|rotate|scale|z-index|visibility|opacity|filter)/;
  function inlineAll(src, dst, root){
    const cs = getComputedStyle(src);
    for (let i = 0; i < cs.length; i++){
      const k = cs[i];
      if (root && SKIP.test(k)) continue;
      if (!root && /^(animation|transition|will-change)/.test(k)) continue;
      dst.style.setProperty(k, cs.getPropertyValue(k));
    }
    for (let i = 0; i < src.children.length; i++) if (dst.children[i]) inlineAll(src.children[i], dst.children[i], false);
  }
  function exactClone(src, r){
    const cl = src.cloneNode(true);
    cl.removeAttribute('id');
    cl.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    inlineAll(src, cl, true);
    cl.classList.remove('is-pressed');
    cl.classList.add('kofx-debris');
    cl.style.width = r.width + 'px'; cl.style.height = r.height + 'px';
    return cl;
  }
  let dashState = null;
  async function gameOver(g, killer, opts){
    const k = PACE[O.gopace] || 1, T = ms => sleep(ms * k);
    const frame = $id('hud-frame'), area = $id('action-area'), dock = $id('your-seat-dock');
    dashState = { blown:[], hidden:[], tilt:[], smokes:[], overlays:[], classed:[], reels:new Map() };
    await T(220);

    // THE KILLER GLOATS
    const ke = killer && seatEls[killer.id];
    if (O.killer === 'gloat' && ke && ke.card){
      spotlight([ke.card], O.spot === '0' ? 'soft' : O.spot);
      if (ke._ec) ke._ec.win = now() + 2600 * k;
      render();
      const [a, b] = lines(GLOATS, killer);
      readout(ke, a, b, 'money');
      holdFace(ke, killer, pick(['gloating1','gloating','smug1','cocky1']), 2600 * k);
      restart(ke.card, 'ec-shudder');
      Snd.kaching();
      await T(1250);
      spotOff();
      await T(120);
    }

    // THE HIT
    const hitDash = (m, px) => {
      [dock, area].forEach(el => restart(el, 'kofx-dhit', { '--kdx':(Math.random() < .5 ? -1 : 1) * px + 'px', '--kd-ms':'230ms' }));
      restart(frame, 'kofx-glitch');
      shakeScreen(px * .8, 240);
      Sound.koThunk(m);
      haptic(Math.round(24 + m * 10));
    };
    if (O.hit === 'thunks'){
      hitDash(1.5, 5); await T(330);
      hitDash(2.6, 9); await T(260);
    }

    // THE DAMAGE: a chain of failures, then the lights go
    await damageChain(g, k, T, frame, area, dock);

    // LIGHTS OUT
    await T(160);
    const lights = O.lights === 'mix' ? (Math.random() < .5 ? 'crt' : 'rubble') : O.lights;
    if (lights === 'tilt'){
      [...frame.querySelectorAll('.crt')].forEach(el => {
        const r = rectOf(el); if (!r || !r.width) return;
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        const m = document.createElement('div');
        m.className = 'kofx-tilt-msg' + (r.width < 110 ? ' is-small' : '');
        m.textContent = 'TILT';
        el.appendChild(m); dashState.tilt.push(m);
      });
      Snd.buzzer(.9 * k);
      haptic([60, 40, 60, 40, 60]);
      await T(1000);
      frame.classList.add('kofx-dead'); area.classList.add('kofx-dead');
      Sound.koThunk(1.2);
      await T(500);
    } else if (lights === 'crt'){
      frame.classList.add('kofx-dead'); area.classList.add('kofx-dead');
      await T(260);
      await crtOff();
      if (!opts || !opts.replay) return 'crt';   // stays black; the stage powers it back on
      await T(520);
      await crtOn();
    } else if (lights === 'rubble'){
      await rubble(k, T, frame, area, dock);
    } else {
      frame.classList.add('kofx-dead'); area.classList.add('kofx-dead');
      Sound.busted(true);
      await T(650);
    }
    return 'done';
  }

  /* ---------------- the damage chain ----------------
     Every failure is one part of the machine giving out. DAMAGE picks how
     many: BUTTONS ONLY (round 1: the fuse row and your cards), CHAIN
     REACTION (a random handful of the parts switched on), TOTAL WRECK
     (all of them). HOW MUCH: RANDOM, or BY THE LOSS (the bigger the hand
     that busted you, the more breaks). */
  function severity(g){
    const me = g && g.players.find(p => p.isHuman);
    const lost = me ? (me.totalBetHand || 0) : 0;
    const base = (g && g.startingStack) || 500;
    return lost ? Math.max(0, Math.min(1, lost / (base * 1.6))) : Math.random();
  }
  function buttonCount(sev){
    if (O.fuse === 'one') return 1;
    if (O.fuse === 'three') return 3;
    if (O.fuse === 'random') return Math.random() < .5 ? 1 : 3;
    if (O.fuse === 'any') return O.amount === 'loss' ? 1 + Math.round(sev * 2) : 1 + Math.floor(Math.random() * 3);
    return 0;
  }
  async function damageChain(g, k, T, frame, area, dock){
    const sev = (dashState.sev = dashState.sev != null ? dashState.sev : severity(g));
    const dashTop = (rectOf(dock) || { top:innerHeight * .7 }).top;
    const cs = [];
    let adding = true;
    const base = koObstacles().filter(o => o.tag !== 'card');
    const noDash = base.filter(o => o.tag !== 'dashboard');
    const layer = document.createElement('div'); layer.className = 'ko-physics-layer'; document.body.appendChild(layer);
    dashState.layer = layer;
    const flying = fly(cs, c => c.cleared ? base : noDash, null, () => adding);
    const vh = innerHeight, vw = innerWidth;
    // send a copy of `src` flying; `hide` leaves a gap where it was
    const launch = (src, o) => {
      const r = rectOf(src); if (!r || !r.width) return;
      const cl = exactClone(src, r);
      layer.appendChild(cl);
      const cx = r.left + r.width / 2;
      cs.push(makeBody(cl, r, Object.assign({
        kind:'debris', dashTop, impacts:1 + Math.floor(Math.random() * 2),
        vx:((cx < vw / 2 ? 1 : -1) * rand(.05, .3) + rand(-.12, .12)) * vw * 1.4,
        vy:-vh * rand(1.9, 2.5), vrot:(Math.random() < .5 ? -1 : 1) * rand(420, 900)
      }, o || {})));
    };

    const nBtn = buttonCount(sev);
    const parts = [];
    if (O.pScreens === 'on') parts.push('screen', 'screen', 'screen');
    if (O.pNumbers === 'on') parts.push('numbers');
    if (O.pLamps === 'on') parts.push('lamps');
    if (O.pRim === 'on') parts.push('rim');
    if (O.pKey === 'on') parts.push('key');
    if (O.pBracket === 'on') parts.push('bracket');
    let list = [];
    if (O.damage === 'wreck') list = parts.slice();
    else if (O.damage === 'chain'){
      const n = O.amount === 'loss' ? 1 + Math.round(sev * 4) : 1 + Math.floor(Math.random() * 4);
      list = parts.slice().sort(() => Math.random() - .5).slice(0, n);
    }
    const screens = ['hand-strength', 'banner', 'hud-invested'].map($id).filter(Boolean).sort(() => Math.random() - .5);
    let jobs = list.map(kind => kind === 'screen' ? () => failScreen(screens.shift(), launch) : FAIL[kind].bind(null, launch, k));
    if (nBtn) jobs.push(() => blowButtons(nBtn, launch, k));
    jobs = jobs.sort(() => Math.random() - .5);
    if (O.cards === 'pop') jobs.push(() => popCards(launch));

    if (jobs.length){
      Snd.zap();
      restart(frame, 'kofx-glitch');
      await T(220);
    }
    for (let i = 0; i < jobs.length; i++){
      await jobs[i]();
      if (i < jobs.length - 1) await T(rand(200, 430) * (O.damage === 'wreck' ? .6 : 1));
    }
    adding = false;
    await flying;
    layer.remove(); dashState.layer = null;
  }

  // a fixed overlay over one part (removed when the dashboard is restored)
  function overlay(r, cls, html){
    const o = document.createElement('div');
    o.className = 'kofx-over ' + cls;
    o.style.left = r.left + 'px'; o.style.top = r.top + 'px'; o.style.width = r.width + 'px'; o.style.height = r.height + 'px';
    if (html) o.innerHTML = html;
    document.body.appendChild(o);
    dashState.overlays.push(o);
    return o;
  }
  async function blowButtons(n, launch, k){
    const btns = ['btn-fold', 'btn-checkcall', 'btn-raise'].map($id).filter(b => b && rectOf(b).width && !b.classList.contains('kofx-blown'));
    const chosen = btns.sort(() => Math.random() - .5).slice(0, n);
    chosen.forEach(b => { const r = rectOf(b); sparks(r.left + r.width / 2, r.top + r.height / 2, -Math.PI / 2, 10); });
    await sleep(120);
    for (let i = 0; i < chosen.length; i++){
      const b = chosen[i], r = rectOf(b);
      launch(b);
      b.classList.add('kofx-blown'); dashState.blown.push(b);
      Sound.koBlast(); Snd.pop();
      sparks(r.left + r.width / 2, r.top + r.height / 2, -Math.PI / 2, 14);
      haptic([34, 18, 50]);
      shakeScreen(6, 220);
      dashState.smokes.push(smoke(b, 2600 * k));
      if (i < chosen.length - 1) await sleep(rand(110, 190));
    }
  }
  async function popCards(launch){
    const cards = [...document.querySelectorAll('.seat.you .seat-cards .card')].filter(c => rectOf(c).width);
    for (let i = 0; i < cards.length; i++){
      launch(cards[i], { kind:'card', vx:(i ? 1 : -1) * innerWidth * rand(.25, .5), vy:-innerHeight * rand(2, 2.6), vrot:(i ? 1 : -1) * rand(500, 900) });
      cards[i].classList.add('kofx-hidden'); dashState.hidden.push(cards[i]);
      Snd.pop(); Sound.koThunk(1.2);
      if (i < cards.length - 1) await sleep(90);
    }
  }
  /* A screen gives out one of four ways: its glass cracks, it floods with
     static, it switches itself off, or its glass pops out and flies. */
  async function failScreen(el, launch){
    const r = el && rectOf(el); if (!r || !r.width) return;
    const how = pick(['static', 'off', 'pop']);
    sparks(r.left + rand(.2, .8) * r.width, r.top + r.height / 2, -Math.PI / 2, 6);
    if (how === 'crack'){
      const o = overlay(r, 'kofx-over-crack');
      const R = Math.max(r.width, r.height) * .75;
      const svg = crackSvg(R, 5);
      svg.style.left = (rand(.2, .8) * r.width - R) + 'px'; svg.style.top = (rand(.2, .8) * r.height - R) + 'px';
      o.appendChild(svg);
      Snd.glass(.55); haptic(30);
    } else if (how === 'static'){
      const o = overlay(r, 'kofx-over-static');
      o.style.backgroundImage = 'url(' + snowTex() + ')';
      Snd.hiss(1.1);
    } else if (how === 'off'){
      overlay(r, 'kofx-over-black');
      const lit = overlay(r, 'kofx-over-lit');
      lit.animate([
        { clipPath:'inset(0 0 0 0)', opacity:.7 },
        { clipPath:'inset(46% 0 46% 0)', opacity:1, offset:.45 },
        { clipPath:'inset(47% 44% 47% 44%)', opacity:1, offset:.75 },
        { clipPath:'inset(47% 48% 47% 48%)', opacity:0 }
      ], { duration:420, easing:'steps(7,end)', fill:'forwards' });
      Snd.crtOff(.5);
    } else {
      launch(el, { vy:-innerHeight * rand(1.6, 2.1) });
      overlay(r, 'kofx-over-hole');
      Snd.glass(.4); Snd.pop();
      shakeScreen(4, 180);
    }
  }
  /* One drum, spinning on its own: a direction, a speed that drifts up and
     down, a random run length; then an overshoot past where it lands and
     a lurch back, and it jams. Each step is a fast roll of the drum's own
     strip, so it reads as a real reel, not text changing. */
  function rollStep(cell, from, to, up, ms){
    cell.innerHTML = up
      ? '<span class="reel-strip" aria-hidden="true"><span>' + from + '</span><span>' + to + '</span></span>'
      : '<span class="reel-strip" aria-hidden="true" style="transform:translateY(-50%)"><span>' + to + '</span><span>' + from + '</span></span>';
    cell.dataset.value = to;
    const strip = cell.firstChild;
    strip.animate(up ? [{ transform:'translateY(0)' }, { transform:'translateY(-50%)' }] : [{ transform:'translateY(-50%)' }, { transform:'translateY(0)' }],
      { duration:Math.max(30, ms * .85), easing:'steps(' + (ms > 90 ? 4 : 2) + ',end)', fill:'forwards' });
  }
  async function spinDrum(cell, t0, popAtMs, popIt){
    let d = Number(cell.dataset.value) || 0;
    let up = Math.random() < .5;
    const run = rand(900, 2300);
    let speed = rand(35, 110);                       // ms per digit
    const step = async (ms, dir) => {
      const next = (d + (dir ? 1 : 9)) % 10;
      rollStep(cell, d, next, dir, ms);
      d = next;
      if (Math.random() < .35) Snd.tick();
      await sleep(ms);
      if (popAtMs != null && now() - t0 > popAtMs) popIt(cell);
      return !cell._kofxPopped;
    };
    while (now() - t0 < run){
      if (!await step(speed, up)) return;
      speed = Math.max(28, Math.min(150, speed + rand(-18, 22)));
      if (Math.random() < .06) up = !up;             // a lurch the other way
    }
    // slowing to a stop, overshooting, lurching back
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++){ speed *= 1.35; if (!await step(Math.min(260, speed), up)) return; }
    const over = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < over; i++) if (!await step(70, up)) return;
    const back = 1 + Math.floor(Math.random() * over);
    for (let i = 0; i < back; i++) if (!await step(110 + i * 40, !up)) return;
    cell.classList.add('kofx-jam');
    Snd.tick(1.6);
  }
  const FAIL = {
    /* the stack's drums go haywire: every drum spins on its own, its own
       way and at its own speed, speeding up and slowing down, overshoots
       where it should stop, lurches back, and jams on red nonsense. Some
       of them (the $ plate too) spit clean out of the machine mid-spin. */
    async numbers(launch){
      const plate = $id('jackpot');
      const cells = [...document.querySelectorAll('#jackpot .reel-digit')];
      if (!plate || !cells.length) return;
      cells.forEach(c => { if (!dashState.reels.has(c)) dashState.reels.set(c, c.dataset.value || '0'); });
      restart(plate, 'kofx-plate-shake');
      Snd.zap();
      const sym = plate.querySelector('.jp-sym');
      const pool = cells.concat(sym ? [sym] : []);
      const nPop = Math.min(pool.length - 1, 1 + Math.floor(Math.random() * 3));
      const popping = new Set(pool.slice().sort(() => Math.random() - .5).slice(0, nPop));
      const popAt = new Map([...popping].map(c => [c, rand(350, 1500)]));
      const t0 = now();
      const popIt = c => {
        if (!popping.has(c) || c._kofxPopped) return;
        c._kofxPopped = true;
        launch(c, { vx:rand(-.55, .55) * innerWidth, vy:-innerHeight * rand(1.7, 2.4), vrot:(Math.random() < .5 ? -1 : 1) * rand(600, 1100) });
        c.classList.add('kofx-hidden'); dashState.hidden.push(c);
        const r = rectOf(c); sparks(r.left + r.width / 2, r.top, -Math.PI / 2, 8);
        Snd.pop(); Sound.koThunk(.9);
      };
      if (sym) setTimeout(() => popIt(sym), popAt.get(sym) || 0);
      await Promise.all(cells.map(c => spinDrum(c, t0, popAt.get(c), popIt)));
      restart(plate, 'kofx-plate-shake');
      Sound.koThunk(1.3); Snd.clank();
    },
    // the SB/BB bulbs pop and go dark; sometimes one shoots out
    async lamps(launch){
      const lamps = ['hud-sb-indicator', 'hud-bb-indicator'].map($id).filter(l => l && rectOf(l).width);
      for (const l of lamps){
        const r = rectOf(l);
        l.classList.add('kofx-lamp-pop'); dashState.classed.push([l, 'kofx-lamp-pop']);
        sparks(r.left + r.width / 2, r.top + r.height / 2, -Math.PI / 2, 7);
        Snd.bulb();
        if (Math.random() < .4){ launch(l, { vx:rand(-.5, .5) * innerWidth }); l.classList.add('kofx-hidden'); dashState.hidden.push(l); }
        await sleep(rand(90, 170));
      }
    },
    // the rim light shorts: sparks crawl along it, it flashes, it dies
    async rim(launch, k){
      const dock = $id('your-seat-dock'); if (!dock) return;
      const r = rectOf(dock);
      dashState.rimWas = dashState.rimWas !== undefined ? dashState.rimWas : (dock.dataset.rim || null);
      dock.dataset.rim = 'allin';
      restart(dock, 'kofx-rim-short');
      const t0 = now(), dir = Math.random() < .5 ? 1 : -1;
      Snd.hiss(.8);
      while (now() - t0 < 700){
        const f = (now() - t0) / 700, x = dir > 0 ? r.left + 10 + f * (r.width - 20) : r.right - 10 - f * (r.width - 20);
        sparks(x, r.top + 9, -Math.PI / 2, 3);
        await sleep(45);
      }
      dock.classList.add('kofx-rimdead');
      Sound.koThunk(.9);
    },
    // the settings key pops off
    async key(launch){
      const key = $id('open-settings'); if (!key || !rectOf(key).width) return;
      launch(key);
      key.classList.add('kofx-hidden'); dashState.hidden.push(key);
      const r = rectOf(key);
      sparks(r.left + r.width / 2, r.top + r.height / 2, -Math.PI / 2, 8);
      Snd.pop();
    },
    // a bracket snaps: the console lurches askew and stays crooked
    async bracket(){
      const dir = Math.random() < .5 ? -1 : 1;
      ['your-seat-dock', 'action-area'].map($id).forEach((el, i) => {
        if (!el) return;
        el.style.setProperty('--kx-rot', (dir * (i ? .7 : 1.3)) + 'deg');
        el.style.setProperty('--kx-drop', (i ? 3 : 5) + 'px');
        el.classList.add('kofx-askew');
        dashState.classed.push([el, 'kofx-askew']);
      });
      Snd.clank(); Sound.koThunk(2.2);
      shakeScreen(7, 240); haptic([40, 20, 40]);
    }
  };

  /* RUBBLE: no switch-off. What's left flickers, sputters and dies where
     it stands, smoke still curling out of the holes. */
  async function rubble(k, T, frame, area, dock){
    [frame, area].forEach(el => el.classList.add('kofx-flicker'));
    Snd.buzzer(.35); await T(380);
    const r = rectOf(dock);
    for (let i = 0; i < 3; i++){
      sparks(r.left + rand(.1, .9) * r.width, r.top + rand(.1, .6) * r.height, -Math.PI / 2, 6);
      Snd.hiss(.25);
      await T(rand(160, 300));
    }
    [frame, area].forEach(el => { el.classList.remove('kofx-flicker'); el.classList.add('kofx-dead', 'kofx-dead-deep'); });
    dock.classList.add('kofx-rimdead');
    Snd.powerDown(); Sound.koThunk(1.6);
    dashState.smokes.push(smoke(dock, 3200 * k));
    await T(1100);
  }

  let crtEl = null;
  function crtOff(){
    crtEl && crtEl.remove();
    const el = crtEl = document.createElement('div');
    el.className = 'kofx-tvoff';
    el.innerHTML = '<div class="kofx-tvoff-black"></div><div class="kofx-tvoff-glow"></div><div class="kofx-tvoff-line"></div>';
    document.body.appendChild(el);
    const black = el.children[0], glow = el.children[1], line = el.children[2];
    const W = innerWidth, H = innerHeight, cy = H / 2;
    Snd.crtOff(); haptic(30);
    const win = h => {
      const t = cy - h / 2, b = cy + h / 2;
      black.style.clipPath = 'polygon(evenodd,0px 0px,' + W + 'px 0px,' + W + 'px ' + H + 'px,0px ' + H + 'px,0px 0px,0px ' + t + 'px,0px ' + b + 'px,' + W + 'px ' + b + 'px,' + W + 'px ' + t + 'px,0px ' + t + 'px)';
      glow.style.left = '0px'; glow.style.width = W + 'px'; glow.style.top = t + 'px'; glow.style.height = h + 'px';
    };
    return new Promise(res => {
      const t0 = now(), A = 150, B = 190, C = 230;
      (function f(){
        const t = now() - t0;
        if (t < A){ const k = t / A; win(Math.max(3, H * (1 - k * k))); glow.style.opacity = (.15 + .5 * k).toFixed(2); }
        else if (t < A + B){ win(0); glow.style.opacity = 0; line.style.opacity = 1; line.style.width = Math.max(6, W * (1 - (t - A) / B)) + 'px'; line.style.height = (3 + 3 * (t - A) / B) + 'px'; }
        else if (t < A + B + C){ line.style.width = line.style.height = '6px'; line.style.opacity = (1 - (t - A - B) / C).toFixed(2); }
        else { line.style.opacity = 0; res(); return; }
        requestAnimationFrame(f);
      })();
    });
  }
  function crtOn(){
    const el = crtEl; if (!el) return Promise.resolve();
    const black = el.children[0], glow = el.children[1], line = el.children[2];
    const W = innerWidth, H = innerHeight, cy = H / 2;
    Snd.crtOn();
    const win = h => {
      const t = cy - h / 2, b = cy + h / 2;
      black.style.clipPath = 'polygon(evenodd,0px 0px,' + W + 'px 0px,' + W + 'px ' + H + 'px,0px ' + H + 'px,0px 0px,0px ' + t + 'px,0px ' + b + 'px,' + W + 'px ' + b + 'px,' + W + 'px ' + t + 'px,0px ' + t + 'px)';
      glow.style.left = '0px'; glow.style.width = W + 'px'; glow.style.top = t + 'px'; glow.style.height = h + 'px';
    };
    return new Promise(res => {
      const t0 = now(), A = 150, B = 200;
      (function f(){
        const t = now() - t0;
        if (t < A){ line.style.opacity = 1; line.style.height = '3px'; line.style.width = (W * t / A) + 'px'; }
        else if (t < A + B){ line.style.opacity = 0; const k = (t - A) / B; win(H * k * k); glow.style.opacity = (.6 * (1 - k)).toFixed(2); }
        else { el.remove(); if (crtEl === el) crtEl = null; res(); return; }
        requestAnimationFrame(f);
      })();
    });
  }
  // the dashboard as it was (buttons back, lights on)
  function restoreDash(){
    const s = dashState; dashState = null;
    if (s){
      s.smokes.forEach(h => h.stop = true);
      s.blown.forEach(b => { b.classList.remove('kofx-blown'); if (!quiet()) b.animate([{ transform:'translateY(14px) scale(.9)' }, { transform:'translateY(-4px)' }, { transform:'none' }], { duration:220, easing:'steps(4,end)' }); });
      s.hidden.forEach(c => { c.classList.remove('kofx-hidden'); delete c._kofxPopped; });
      s.tilt.forEach(m => m.remove());
      s.overlays.forEach(o => o.remove());
      s.classed.forEach(([el, c]) => el.classList.remove(c));
      s.reels.forEach((v, c) => { c.getAnimations().forEach(x => x.cancel()); c.classList.remove('kofx-jam'); delete c._kofxPopped; setReelRest(c, v); });
      const dock = $id('your-seat-dock');
      if (dock && s.rimWas !== undefined){ if (s.rimWas) dock.dataset.rim = s.rimWas; else delete dock.dataset.rim; }
      if (s.layer) s.layer.remove();
    }
    ['hud-frame', 'action-area', 'your-seat-dock'].forEach(id => { const el = $id(id); if (el) el.classList.remove('kofx-dead', 'kofx-dead-deep', 'kofx-flicker', 'kofx-rimdead', 'kofx-askew'); });
  }

  /* presentResultStage, wrapped: the game-over beat before a bust's
     result stage. Positive results pass straight through. */
  async function presentResultStageFx(g, model, opts){
    const wantsBeat = ['killer','hit','fuse','cards','lights'].some(k => O[k] !== '0') || O.damage !== 'buttons';
    if (!model || model.tone !== 'negative' || quiet() || !wantsBeat || g._kofxOver || !g.players.some(p => p.isHuman && p.chips <= 0))
      return ORIG.stage.apply(this, arguments);
    g._kofxOver = true;
    clearTimeout(autoDealT);
    $id('actions-row') && $id('actions-row').classList.add('disabled');
    const how = await gameOver(g, killerOf(g), {});
    const o = Object.assign({}, opts);
    const con = o.console;
    o.console = () => { if (con) con(); setTimeout(restoreDash, 650); };
    if (how === 'crt'){
      const felt = $id('felt');
      const done = ORIG.stage.call(this, g, model, o);
      const t0 = now();
      while (!(felt && felt.classList.contains('results-mode')) && now() - t0 < 6000) await sleep(40);
      // repaired in the dark: the machine comes back on rebooted
      restoreDash();
      await sleep(120);
      await crtOn();
      return done;
    }
    return ORIG.stage.call(this, g, model, o);
  }

  function install(){
    window.playEliminationGroup = koSequence;
    window.playElimination = (p, opts) => koSequence([{ p, ko:!!(opts && opts.ko) }]);
    window.presentResultStage = presentResultStageFx;
  }
  install();

  // iPhone only plays sound after a tap: wake the K.O. sounds on the first
  // touch, the same way the game's own Sound unlocks.
  ['pointerdown', 'touchend'].forEach(t => document.addEventListener(t, () => Snd.unlock(), { capture:true, passive:true }));

  return { order:O, unlock(){ Snd.unlock(); } };
})();
