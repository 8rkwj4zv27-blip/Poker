"use strict";

/* ============================================================
   ACTION DRUM — candidate (lab only: loaded by action-drum-lab.html,
   never by the game yet)

   The bottom console's modes (FOLD/CHECK/RAISE, QUICK RESOLVE, AWARD POT,
   the results keys) are the sides of one drum that turns to bring the next
   one up. It replaces the two nested CSS flips (#console-flip and
   #actions-flip, css/03-action-console.css), whose hidden back faces
   iPhone Safari sometimes still draws: the old keys peeking out from
   behind the new ones.

   Why this can't ghost: nothing here relies on backface-visibility or
   preserve-3d. Each side is projected on its own (a perspective() in its
   own transform), JS decides which sides face you, and once the drum
   stops every side but the one you're looking at is visibility:hidden and
   has no transform at all.

   The game keeps driving the console exactly as it does today, by the
   .flipped classes on #console-flip and #actions-flip (showAwardConsole,
   syncQuickResolveControl, activateResultsConsole...). The drum watches
   those and turns to match, so no game code changes and every button,
   id and handler stays where it is.
   ============================================================ */
(() => {
  const DEFAULTS = { style:'drum', speed:'med', settle:'clunk', motion:'stepped', dir:'meaning', shade:'on', lip:'turn', slats:'turn', sound:'ticks' };
  const opts = Object.assign({}, DEFAULTS);
  const SPEED = { fast:240, med:360, slow:520 };
  const $ = id => document.getElementById(id);

  let on = false, flip, aflip, awardBtn, consoleEl, lip;
  let faces = null, plates = [];
  let D = 0;                 // the drum's angle, degrees
  let slots = new Map();     // side element -> its angle on the drum
  let current = 'play', shown = null, spinning = false, queued = null, raf = 0;

  const elOf = k => k === 'play' ? faces.play : k === 'quick' ? faces.quick : faces.award;
  function target(){
    if (flip.classList.contains('flipped')){
      return awardBtn && (awardBtn.classList.contains('next-table-mode') || awardBtn.classList.contains('career-return-mode')) ? 'results' : 'award';
    }
    return aflip.classList.contains('flipped') ? 'quick' : 'play';
  }
  const reduced = () => { try{ return motionOff(); }catch(e){ return false; } };
  const sound = (name, ...a) => { try{ if (typeof Sound !== 'undefined' && Sound[name]) Sound[name](...a); }catch(e){} };

  /* ---- the sides ---- */
  const every = () => [faces.play, faces.quick, faces.award].concat(plates);
  function plate(i){
    const p = document.createElement('div');
    p.className = 'ad-plate'; p.setAttribute('aria-hidden', 'true');
    p.innerHTML = '<i></i><span>' + (i % 2 ? '· THE TABLE ·' : '♠ ♥ ♣ ♦') + '</span><i></i>';
    flip.appendChild(p);
    return p;
  }
  function rest(){
    every().forEach(el => {
      const live = el === shown;
      el.style.transform = live ? 'none' : '';
      el.style.visibility = live ? 'visible' : 'hidden';
      el.style.filter = '';
      el.classList.toggle('ad-live', live);
    });
    plates.forEach(p => { p.style.visibility = 'hidden'; });
    flip.classList.remove('ad-spinning');
    if (consoleEl) consoleEl.classList.remove('ad-spinning');
  }
  function paint(){
    const h = faces.play.offsetHeight || 70;
    const r = opts.style === 'flap' ? 0 : h / 2;
    const P = Math.max(360, h * 7);
    every().forEach(el => {
      if (!slots.has(el)){ el.style.visibility = 'hidden'; return; }
      const rel = slots.get(el) - D;
      const c = Math.cos(rel * Math.PI / 180);
      if (c <= 0.02){ el.style.visibility = 'hidden'; return; }
      el.style.visibility = 'visible';
      el.style.transform = 'perspective(' + P + 'px) translateZ(' + (-r) + 'px) rotateX(' + (-rel) + 'deg) translateZ(' + r + 'px)';
      el.style.filter = opts.shade === 'on' ? 'brightness(' + (0.3 + 0.7 * c).toFixed(3) + ')' : '';
    });
  }

  /* ---- the turn ---- */
  function ease(t){
    // accelerate off the catch, then the settle: where the drum is, as a
    // fraction of the turn plus an overshoot in degrees
    const inOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    if (opts.settle === 'none') return [inOut(t), 0];
    if (opts.settle === 'clunk'){
      if (t < .72) return [Math.pow(t / .72, 2.2), 0];
      const u = (t - .72) / .28;
      return [1, 9 * Math.sin(Math.PI * u) * (1 - u)];
    }
    // bounce: over, back under, home
    if (t < .6) return [Math.pow(t / .6, 2.2), 0];
    const u = (t - .6) / .4;
    return [1, 14 * Math.exp(-4 * u) * Math.sin(u * Math.PI * 2.5)];
  }
  function spinTo(key){
    const toEl = elOf(key), fromEl = shown;
    if (toEl === fromEl){ current = key; return Promise.resolve(); }
    const up = opts.dir === 'up' || (opts.dir === 'meaning' && key !== 'play') ? 1 : -1;
    const step = opts.style === 'flap' ? 180 : 90;
    const steps = opts.style === 'reel' ? 3 : 1;
    const from = D, to = D + up * step * steps;
    slots = new Map();
    slots.set(fromEl, from);
    if (opts.style === 'reel') plates.slice(0, steps - 1).forEach((p, i) => slots.set(p, from + up * step * (i + 1)));
    slots.set(toEl, to);
    current = key; shown = toEl;
    if (reduced() || opts.style === 'shipped'){ D = to; rest(); return Promise.resolve(); }

    spinning = true;
    flip.classList.add('ad-spinning');
    if (consoleEl) consoleEl.classList.add('ad-spinning');
    const dur = (SPEED[opts.speed] || 360) * (steps > 1 ? 1.9 : 1);
    const frame = opts.motion === 'smooth' ? 0 : opts.motion === 'stepped12' ? 1000 / 12 : 1000 / 20;
    const t0 = performance.now();
    let passed = 0;
    return new Promise(done => {
      const tick = now => {
        let el = now - t0;
        if (frame) el = Math.floor(el / frame) * frame;
        const t = Math.min(1, el / dur);
        const [f, over] = ease(t);
        D = from + (to - from) * f + up * over;
        const crossed = Math.floor(Math.abs(D - from) / step + 0.5);
        if (crossed > passed && crossed <= steps){
          passed = crossed;
          if (opts.sound === 'ticks' && crossed < steps) sound('wheelTooth', 1, false);
        }
        paint();
        if (t < 1){ raf = requestAnimationFrame(tick); return; }
        D = to;
        if (opts.sound !== 'off') sound('wheelCatch');
        rest();
        spinning = false;
        done();
      };
      raf = requestAnimationFrame(tick);
    });
  }
  async function sync(){
    if (!on || spinning) return;
    let k = target();
    while (on && elOf(k) !== shown){
      await spinTo(k);
      k = target();   // the game may have moved on while it turned
    }
    current = k;
  }
  let pending = false;
  const schedule = () => { if (pending) return; pending = true; Promise.resolve().then(() => { pending = false; sync(); }); };

  /* ---- install / options ---- */
  let mo = null;
  function install(){
    if (on) return true;
    flip = $('console-flip'); aflip = $('actions-flip'); awardBtn = $('btn-award-pot-console'); consoleEl = $('action-console');
    if (!flip || !aflip) return false;
    faces = { play:flip.querySelector('.actions-face-play'), quick:flip.querySelector('.actions-face-quick'), award:$('console-face-award') };
    if (!faces.play || !faces.quick || !faces.award) return false;
    plates = [plate(0), plate(1)];
    if (consoleEl && !lip){ lip = document.createElement('div'); lip.className = 'ad-lip'; lip.setAttribute('aria-hidden', 'true'); consoleEl.appendChild(lip); }
    on = true;
    document.documentElement.classList.add('ad-drum');
    applyOpts();
    current = target(); shown = elOf(current); D = 0; slots = new Map([[shown, 0]]);
    rest();
    mo = new MutationObserver(schedule);
    mo.observe(flip, { attributes:true, attributeFilter:['class'] });
    mo.observe(aflip, { attributes:true, attributeFilter:['class'] });
    if (awardBtn) mo.observe(awardBtn, { attributes:true, attributeFilter:['class'] });
    return true;
  }
  function uninstall(){
    if (!on) return;
    on = false; cancelAnimationFrame(raf); spinning = false;
    if (mo) mo.disconnect();
    every().forEach(el => { el.style.transform = ''; el.style.visibility = ''; el.style.filter = ''; el.classList.remove('ad-live'); });
    plates.forEach(p => p.remove()); plates = [];
    if (lip){ lip.remove(); lip = null; }
    flip.classList.remove('ad-spinning'); if (consoleEl) consoleEl.classList.remove('ad-spinning');
    document.documentElement.classList.remove('ad-drum');
  }
  function applyOpts(){
    const r = document.documentElement;
    ['style','lip','slats'].forEach(k => r.setAttribute('data-ad-' + k, opts[k]));
  }
  function set(patch){
    Object.assign(opts, patch || {});
    if (opts.style === 'shipped'){ uninstall(); applyOpts(); return; }
    if (!on) install();
    applyOpts();
  }

  window.ActionDrum = {
    install, uninstall, set, sync,
    get opts(){ return Object.assign({}, opts); },
    get state(){ return { on, current, spinning, angle:D }; },
    DEFAULTS
  };
})();
