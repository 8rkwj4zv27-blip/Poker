"use strict";

/* ============================================================
   EVENT CLOCK — the little CRT on the felt in a Career invitation
   (owner, 13 Oct 2026). In a hand-limited event it reads HAND n/N; in a
   knock-out, the time played (MM:SS, kept with the table's save).

   It finds a clear spot by itself, away from the seats, their bet
   squares, the board's tray, the deck and P.I.P.: the free spot nearest
   the middle of the gap between the seats and the board. Pick it up and
   put it anywhere; flick it and it slides on the felt, knocks off the
   rails and settles where it stops. Where you leave it is kept
   (settings.eventClock, as fractions of the felt), unless at this table
   it would cover a seat: then it takes the clear spot instead. A touch on
   it is never a touch on the table.

   Presentation only: it reads the game, and writes nothing but its own
   place (settings) and the time played (game.clockMs, which the table's
   save carries). Hidden while the table powers up (js/table-intro.js) and
   once the result stage has the felt.
   ============================================================ */
const EventClock = (() => {
  const OBSTACLES = '.seat, .ec-square, .ct-tray, .dealer-station, #coach-station, .pot-area:not(.hidden)';
  const MARGIN = 4, STEP = 6;
  const FRICTION = .035, BOUNCE = .55, MIN_FLICK = 320;
  let el = null, screenEl = null, labelEl = null;
  let pos = null;          // { x, y }: its top-left in the felt, px
  let placedFor = '';      // the table it was placed for (seats and size)
  let drag = null, slide = 0, tick = 0, lastTick = 0;

  const felt = () => document.getElementById('felt');
  const reduced = () => { try{ return typeof motionOff === 'function' && motionOff(); }catch(e){ return false; } };
  const play = (name, ...a) => { try{ if (typeof Sound !== 'undefined' && Sound[name]) Sound[name](...a); }catch(e){} };
  const buzz = p => { try{ if (typeof haptic === 'function') haptic(p); }catch(e){} };

  // what it shows, and whether this table has it at all
  function limitOf(g){
    return g && g.mode === 'career' && g.event && g.event.funding === 'house' && Number.isInteger(g.event.handLimit) && g.event.handLimit >= 1
      ? g.event.handLimit : 0;
  }
  const wanted = g => !!(g && g.mode === 'career' && g.event && g.event.funding === 'house');
  function readout(g){
    const limit = limitOf(g);
    if (limit) return ['HAND', Math.min(limit, Math.max(1, g.handNumber || 1)) + '/' + limit];
    const s = Math.floor((g.clockMs || 0) / 1000);
    return ['TIME', String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')];
  }

  function build(f){
    el = document.createElement('div');
    el.id = 'event-clock'; el.className = 'event-clock';
    el.setAttribute('role', 'timer');
    el.innerHTML = '<span class="instrument-label event-clock-label"></span>' +
      '<div class="event-clock-screen crt-screen crt" data-crt-quiet data-ink="live"></div>';
    labelEl = el.querySelector('.event-clock-label');
    screenEl = el.querySelector('.event-clock-screen');
    el.addEventListener('pointerdown', down);
    // nothing on it reaches the table (a tap, a peek, knock to check)
    ['click', 'pointerup', 'touchstart', 'touchend'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
    f.appendChild(el);
  }

  /* ---------------- where it sits ---------------- */
  const local = (r, f) => { const b = f.getBoundingClientRect(); return { x:r.left - b.left, y:r.top - b.top, w:r.width, h:r.height }; };
  function obstacles(f){
    return [...f.querySelectorAll(OBSTACLES)].map(n => local(n.getBoundingClientRect(), f)).filter(r => r.w > 0 && r.h > 0);
  }
  const hits = (a, b) => a.x < b.x + b.w + MARGIN && a.x + a.w + MARGIN > b.x && a.y < b.y + b.h + MARGIN && a.y + a.h + MARGIN > b.y;
  function clear(p, f, obs){
    const r = { x:p.x, y:p.y, w:el.offsetWidth, h:el.offsetHeight };
    return r.x >= 0 && r.y >= 0 && r.x + r.w <= f.clientWidth && r.y + r.h <= f.clientHeight && !obs.some(o => hits(r, o));
  }
  // the free spot nearest the middle of the gap between the seats (with
  // their bets) and the board's tray
  function auto(f, obs){
    const W = f.clientWidth, H = f.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    const tray = f.querySelector('.ct-tray');
    const trayTop = tray ? local(tray.getBoundingClientRect(), f).y : H * .5;
    const above = obs.filter(o => o.y + o.h <= trayTop + 1);
    const seatsBottom = above.length ? Math.max(...above.map(o => o.y + o.h)) : 0;
    const ax = W / 2 - w / 2, ay = (seatsBottom + trayTop) / 2 - h / 2;
    let best = null, bestD = Infinity;
    for (let y = 0; y + h <= H; y += STEP){
      for (let x = 0; x + w <= W; x += STEP){
        const d = Math.hypot(x - ax, (y - ay) * 1.4);
        if (d < bestD && clear({ x, y }, f, obs)){ best = { x, y }; bestD = d; }
      }
    }
    return best || { x:Math.max(0, ax), y:Math.max(0, ay) };
  }
  function saved(f){
    try{
      const s = settings.eventClock;
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) return { x:s.x * f.clientWidth, y:s.y * f.clientHeight };
    }catch(e){}
    return null;
  }
  function place(f){
    const obs = obstacles(f), mine = saved(f);
    pos = mine && clear(mine, f, obs) ? mine : auto(f, obs);
    paint();
  }
  function paint(rot = 0){
    if (!el || !pos) return;
    el.style.transform = 'translate(' + Math.round(pos.x) + 'px,' + Math.round(pos.y) + 'px)' + (rot ? ' rotate(' + rot + 'deg)' : '');
  }
  function remember(f){
    try{
      settings.eventClock = { x:+(pos.x / f.clientWidth).toFixed(4), y:+(pos.y / f.clientHeight).toFixed(4) };
      saveSettings();
    }catch(e){}
  }

  /* ---------------- pick it up, put it down, flick it ---------------- */
  function down(e){
    e.preventDefault(); e.stopPropagation();
    const f = felt();
    if (!f || !pos || drag) return;
    cancelAnimationFrame(slide);
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
    drag = { id:e.pointerId, dx:e.clientX - pos.x, dy:e.clientY - pos.y, x0:e.clientX, y0:e.clientY, moved:false,
      samples:[{ t:performance.now(), x:e.clientX, y:e.clientY }] };
    el.classList.add('is-held');
    play('cardReturn'); buzz(8);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function move(e){
    if (!drag || e.pointerId !== drag.id) return;
    const f = felt();
    drag.moved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6;
    pos = { x:clampX(f, e.clientX - drag.dx), y:clampY(f, e.clientY - drag.dy) };
    drag.samples.push({ t:performance.now(), x:e.clientX, y:e.clientY });
    if (drag.samples.length > 8) drag.samples.shift();
    paint();
  }
  const clampX = (f, x) => Math.max(0, Math.min(f.clientWidth - el.offsetWidth, x));
  const clampY = (f, y) => Math.max(0, Math.min(f.clientHeight - el.offsetHeight, y));
  function up(e){
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.classList.remove('is-held');
    const now = performance.now(), s = d.samples.filter(p => now - p.t < 100);
    let vx = 0, vy = 0;
    if (s.length > 1){ const a = s[0], b = s[s.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000); vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; }
    if (!reduced() && Math.hypot(vx, vy) > MIN_FLICK) return flick(vx, vy);
    settle();
  }
  // it slides on the felt, knocks off the rails, tumbling in steps
  function flick(vx, vy){
    const f = felt();
    let last = performance.now(), rot = 0;
    const spin = Math.sign(vx || 1) * Math.min(720, Math.hypot(vx, vy) * .35);
    play('chipBounce');
    const frame = now => {
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      const k = Math.pow(FRICTION, dt);
      vx *= k; vy *= k;
      pos.x += vx * dt; pos.y += vy * dt;
      const knock = v => { if (Math.abs(v) > 150){ play('cardLanded'); buzz(6); } };
      if (pos.x < 0 || pos.x > f.clientWidth - el.offsetWidth){ pos.x = clampX(f, pos.x); knock(vx); vx = -vx * BOUNCE; }
      if (pos.y < 0 || pos.y > f.clientHeight - el.offsetHeight){ pos.y = clampY(f, pos.y); knock(vy); vy = -vy * BOUNCE; }
      rot = (rot + spin * dt * (Math.hypot(vx, vy) / 1000)) % 360;
      paint(Math.round(rot / 15) * 15);
      if (Math.hypot(vx, vy) > 40) slide = requestAnimationFrame(frame);
      else { slide = 0; paint(); settle(); }
    };
    slide = requestAnimationFrame(frame);
  }
  // set down: a thud; if it came to rest over a seat or the board, it's
  // nudged off to the nearest clear spot; then its place is kept
  function settle(){
    const f = felt();
    if (!f) return;
    const obs = obstacles(f);
    if (!clear(pos, f, obs)){
      const from = pos, to = nearest(f, obs, from);
      if (to) pos = to;
      if (to && !reduced()) nudge(from, to);
    }
    paint();
    el.classList.remove('is-down'); void el.offsetWidth; el.classList.add('is-down');
    play('cardLanded'); buzz([6, 10, 14]);
    remember(f);
  }
  function nearest(f, obs, from){
    const w = el.offsetWidth, h = el.offsetHeight;
    let best = null, bestD = Infinity;
    for (let y = 0; y + h <= f.clientHeight; y += STEP){
      for (let x = 0; x + w <= f.clientWidth; x += STEP){
        const d = Math.hypot(x - from.x, y - from.y);
        if (d < bestD && clear({ x, y }, f, obs)){ best = { x, y }; bestD = d; }
      }
    }
    return best;
  }
  function nudge(from, to){
    el.animate([
      { transform:'translate(' + Math.round(from.x) + 'px,' + Math.round(from.y) + 'px)' },
      { transform:'translate(' + Math.round(to.x) + 'px,' + Math.round(to.y) + 'px)' }
    ], { duration:180, easing:'steps(4,end)' });
  }

  /* ---------------- the time played (knock-outs), and a look round ---------------- */
  function running(g){
    const t = document.getElementById('table-screen');
    return wanted(g) && !limitOf(g) && !g.over && t && !t.classList.contains('hidden') && !document.hidden;
  }
  function startTicking(){
    if (tick) return;
    lastTick = performance.now();
    tick = setInterval(() => {
      const g = typeof game !== 'undefined' ? game : null, now = performance.now();
      if (running(g)){
        g.clockMs = (g.clockMs || 0) + Math.min(5000, now - lastTick);
        if (el) show(g);
      }
      lastTick = now;
      if (!el || !el.isConnected){ clearInterval(tick); tick = 0; return; }
      keepClear();
    }, 1000);
  }
  function show(g){
    const [label, text] = readout(g);
    if (labelEl.textContent !== label) labelEl.textContent = label;
    if (screenEl.textContent !== text) screenEl.textContent = text;
    el.setAttribute('aria-label', label === 'HAND' ? 'Hand ' + text.replace('/', ' of ') : 'Time played ' + text);
  }

  /* Each render of the table (js/06-presentation.js renderHandLimit). */
  function update(g){
    const f = felt();
    if (!wanted(g) || !f){ remove(); return; }
    if (!el || !el.isConnected) build(f);
    show(g);
    startTicking();
    // placed once the table's seats are out, and again if the table changes
    const key = f.clientWidth + 'x' + f.clientHeight + ':' + f.querySelectorAll('.seat').length;
    const powering = document.getElementById('table-screen')?.classList.contains('ti-primed');
    if (drag || slide || powering || !f.clientWidth) return;
    if (key !== placedFor){ placedFor = key; place(f); return; }
    keepClear();
  }
  // The table's parts can arrive after it (the bet squares lay out once
  // the cards are dealt; the pot comes and goes): if one now lies under
  // it, it takes the clear spot. Each render, and every second.
  function keepClear(){
    const f = felt();
    if (!el || !pos || drag || slide || !f || !f.clientWidth) return;
    if (document.getElementById('table-screen')?.classList.contains('ti-primed')) return;
    if (clear(pos, f, obstacles(f))) return;
    const from = pos;
    place(f);
    if (!reduced() && (from.x !== pos.x || from.y !== pos.y)) nudge(from, pos);
  }
  function remove(){
    cancelAnimationFrame(slide); slide = 0;
    if (el) el.remove();
    el = screenEl = labelEl = null; pos = null; placedFor = ''; drag = null;
  }
  addEventListener('resize', () => { placedFor = ''; });

  return { update, remove, get el(){ return el; }, get pos(){ return pos && { ...pos }; } };
})();
