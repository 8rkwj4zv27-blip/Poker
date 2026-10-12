/* ============================================================
   EVENT CARD + INSPECT — one part for every place a card shows
   (the pack opening, the album, the Career hub). Lab until signed off.

   CardInspect.make(stage, card)   the card object: back, face, fold flap,
                                   thickness edge and shade, on a PO.Body
   setTurn / setBank / spin / flat / faceUp   the toy: turn it, bank it,
                                   flick it and it spins with momentum
   CardInspect.open({ items, index, key, onClose })
     items: [{ card, source:() => element, locked, lines }]  what you can swipe
            through (lines: the CRT's own lines, e.g. the album's history;
            a line can be { t, money:true })
            through; the card rises from its source and goes back to it
     host:  the screen root it mounts in (default #home): the keys take
            that screen's own styles, exactly as its other keys do
     key:   { label, sub, press(item, index, api) }   the big key; without
            press it closes. api.consume() posts the card into the machine
            (it's used up) instead of returning it.
     swipeUp(item, index, api)   optional: flick the card up and it's
            handed over; api.sendTo(pose) flies it to a point on the screen
            (the Career hub's feeder) and closes, the source in its place.
   The screen lives on its own top layer, above whatever opened it: the
   card lifts, the house dims a step, and a drawer rises from below with
   a small CRT and the dashboard's key bay. The card does the talking (it
   prints the event, rarity and top prize); the CRT adds only what the
   card can't: where and what, the entry and seats, and a third line
   when there's something worth saying (second place pays). Flick the
   card left or right (or the ◄ ► keys) for the next one; tap it for a
   half turn; tap away, or flick it down, to put it back.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, snap, ease, tween, glide, squash, every, S, Foil, Haptic } = PO;
  const CW = 82, CH = 120;
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* ---------------- the card object ---------------- */
  function make(stage, card, { side = 'back' } = {}){
    const spec = card.spec, el = document.createElement('div'), face = PokerCollectibleLab.objectHTML(spec);
    el.className = 'ec-card'; el.dataset.side = side; el.dataset.rarity = spec.rarity; el.dataset.kind = spec.kind; el.dataset.uid = card.uid;
    el.innerHTML = `<div class="ec-back ds-swatch" data-cb="crest"><div class="card back"></div><i class="ec-glint"></i></div>`
      + `<div class="ec-face">${face}<i class="ec-frost"></i><i class="po-fuse"></i></div><i class="ec-shade"></i>`
      + `<div class="ec-flap" hidden aria-hidden="true"><div class="ec-flap-in">${face}</div></div><i class="ec-edge"></i>`;
    const body = new PO.Body(stage, el, { w:CW, h:CH, shadowW:CW, shadowH:CH });
    el.style.zIndex = 60;
    return { el, body, card, spec, fold:0, stops:[], extras:[], shown:false, yaw:0 };
  }

  /* ---------------- the toy ---------------- */
  // the flip's sliver shows the card's thickness: cream stock, dark core
  function setTurn(c, v){
    v = Math.max(.06, v);
    c.body.set({ sx:v });
    c.el.querySelector('.ec-edge').style.width = (v > .9 ? 0 : Math.min(36, 3 / v)).toFixed(1) + 'px';
  }
  // banked: stepped skew and shade, the edge on the side turning away, the foil band moves
  function setBank(c, yaw, pitch = 0){
    yaw = snap(yaw, 6);
    c.yaw = yaw;
    const r = yaw * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), v = Math.max(.06, Math.abs(cs));
    const side = cs < 0 ? 'back' : 'face';
    if (c.el.dataset.side !== side){ c.el.dataset.side = side; Foil.flutter(); }
    c.body.set({ sx:v, sy:1 - clamp(Math.abs(pitch), 0, 40) * .003 });
    c.el.querySelector('.ec-edge').style.width = (v > .95 ? 0 : Math.min(36, 3 / v)).toFixed(1) + 'px';
    c.el.classList.toggle('edge-left', sn * cs < 0);
    c.el.style.setProperty('--sk', snap(sn * 7 * Math.sign(cs || 1), 1.75).toFixed(2) + 'deg');
    c.el.style.setProperty('--shade', snap(Math.abs(sn) * .45 + clamp(pitch, -40, 40) * .004, .08).toFixed(2));
    const face = c.el.querySelector('.ec-face .ccl-object');
    face.classList.add('is-inspected', 'is-held');
    face.style.setProperty('--sheen-x', Math.round(sn * 120) + '%');
    face.style.setProperty('--light-strength', (.25 + Math.abs(sn) * .5).toFixed(2));
  }
  function spin(c, v, done){
    c.spin?.();
    let vel = clamp(v * 1000, -1800, 1800);
    const settle = () => {
      c.spin = null;
      const from = c.yaw || 0, to = Math.round(from / 180) * 180;
      return tween(260, e => setBank(c, mix(from, to, e)), ease.back).then(() => { flat(c); S.cardLanded(); done?.(); });
    };
    if (Math.abs(vel) < 150 || PO.reduced){ settle(); return; }
    let half = Math.floor((c.yaw || 0) / 180);
    const stop = every(dt => {
      setBank(c, (c.yaw || 0) + vel * dt * PO.speed);
      const h = Math.floor(c.yaw / 180);
      if (h !== half){ half = h; S.cardFlip(false); Haptic.tick(5, 60); }
      vel *= Math.pow(.3, dt * PO.speed);
      if (Math.abs(vel) < 220){ settle(); return false; }
    });
    c.spin = () => { stop(); c.spin = null; };
  }
  // back to a flat card, whichever face is up
  function flat(c){
    c.yaw = ((c.yaw || 0) % 360 + 360) % 360;
    c.body.set({ sx:1, sy:1 });
    c.el.querySelector('.ec-edge').style.width = '0px';
    c.el.style.setProperty('--sk', '0deg'); c.el.style.setProperty('--shade', '0');
    c.el.querySelector('.ec-face .ccl-object').classList.remove('is-held');
  }
  function faceUp(c){
    c.spin?.();
    if (c.el.dataset.side === 'face' && !(c.yaw % 360)){ flat(c); return Promise.resolve(); }
    const from = c.yaw || 0, to = Math.round(from / 360) * 360;
    return tween(200, e => setBank(c, mix(from, to, e)), ease.out).then(() => flat(c));
  }

  /* ---------------- the inspect screen ---------------- */
  let ui = null, opts = null, idx = 0, cur = null, busy = false, ptr = null, typing = 0;

  function build(){
    if (ui) return;
    const el = document.createElement('section');
    el.className = 'ci'; el.id = 'ci'; el.hidden = true;
    el.setAttribute('aria-label', 'Card details');
    el.innerHTML = `
      <i class="ci-dim"></i>
      <div class="ci-stage"><div class="ci-shadows"></div><div class="ci-objects"></div><div class="ci-fx"></div></div>
      <button class="icon-btn ci-back" type="button" hidden>BACK</button>
      <div class="ci-pips" aria-hidden="true"></div>
      <div class="ci-drawer">
        <div class="crt ci-crt" data-crt-quiet></div>
        <div class="ec-bay"><div class="actions-row ci-keys">
          <button class="btn-check ci-step" type="button" data-step="-1" aria-label="Previous card"><i class="ci-arrow is-left"></i></button>
          <button class="btn-check ci-key" type="button"></button>
          <button class="btn-check ci-step" type="button" data-step="1" aria-label="Next card"><i class="ci-arrow"></i></button>
        </div></div>
      </div>`;
    (document.getElementById('home') || document.body).append(el);
    const st = el.querySelector('.ci-stage');
    ui = {
      el, dim:el.querySelector('.ci-dim'), drawer:el.querySelector('.ci-drawer'), pips:el.querySelector('.ci-pips'),
      crt:el.querySelector('.ci-crt'), key:el.querySelector('.ci-key'), back:el.querySelector('.ci-back'),
      stage:{ el:st, shadows:st.querySelector('.ci-shadows'), objects:st.querySelector('.ci-objects'), fx:st.querySelector('.ci-fx') }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', e => up(e, false));
    el.addEventListener('pointercancel', e => up(e, true));
    el.querySelectorAll('.ci-step').forEach(b => b.addEventListener('click', () => step(+b.dataset.step)));
    ui.key.addEventListener('click', press);
    ui.back.addEventListener('click', () => close());
    document.addEventListener('keydown', e => {
      if (!ui.open) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  }

  // where the card sits: centred in the space above the drawer, as big as fits
  function target(){
    // offsetTop: where the drawer sits, not where its entrance has it now
    const W = ui.el.clientWidth, top = ui.drawer.offsetTop;
    const s = clamp(Math.floor(Math.min((top - 30) / CH, W * .66 / CW, 3) * 4) / 4, 1, 3);
    return { x:W / 2, y:Math.max(CH * s / 2 + 12, top / 2 + 4), s, r:0, z:12, sx:1, sy:1, alpha:1 };
  }
  // where a card comes from: its source on the screen underneath
  function poseOf(item){
    if (item.pose) return item.pose();
    const el = item.source?.();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width ? { x:r.left + r.width / 2, y:r.top + r.height / 2, s:r.width / CW, r:0, z:0 } : null;
  }
  function hide(item){ const el = item.source?.(); if (el){ el.style.visibility = 'hidden'; item._hidden = el; } }
  function unhide(item){ if (item._hidden){ item._hidden.style.visibility = ''; item._hidden = null; } }

  async function open(o){
    build();
    if (ui.open) return;
    opts = o; idx = clamp(o.index || 0, 0, o.items.length - 1); ui.open = true; busy = true;
    const host = o.host || document.getElementById('home') || document.body;
    if (ui.el.parentNode !== host) host.append(ui.el);
    ui.el.hidden = false;
    ui.back.hidden = !o.key?.press;
    ui.el.querySelectorAll('.ci-step').forEach(b => b.classList.toggle('is-off', o.items.length < 2));
    keyText();
    ui.drawer.style.transform = 'translateY(105%)';
    S.hatchOpen(); Haptic.tick(8);
    const drawer = tween(260, e => { ui.drawer.style.transform = `translateY(${Math.round((1 - e) * 105)}%)`; ui.dim.style.opacity = snap(.66 * e, .11).toFixed(2); }, ease.out)
      .then(() => { ui.drawer.style.transform = ''; S.stageLock(); Haptic.tick(10, 0); });
    await Promise.all([drawer, enter(idx, 0)]);
    busy = false;
    opts.onIndex?.(idx);
  }

  async function enter(i, dir){
    const item = opts.items[i];
    const c = make(ui.stage, item.card, { side:'face' });
    c.el.classList.add('ci-card');
    if (item.locked) c.el.classList.add('is-locked');
    fill(item); // first: the drawer's height decides how big the card can be
    const to = target(), from = dir ? null : poseOf(item);
    hide(item);
    c.body.set(from ? { ...from, sx:1, sy:1, alpha:1 } : { ...to, x:dir > 0 ? ui.el.clientWidth + CW * to.s : -CW * to.s, r:dir * 14 });
    cur = { c, item };
    S.cardReturn(); Foil.flutter(); Haptic.tick(6);
    pips(i, to);
    await glide(c.body, to, from ? 300 : 220, { arc:from ? 28 : 6, easing:from ? ease.out : ease.back });
    squash(c.body, .05, 160); S.cardLanded();
  }
  // which card of the run this is: a row of pixel pips under the card
  function pips(i, to){
    const n = opts.items.length;
    ui.pips.innerHTML = n > 1 ? opts.items.map((_, k) => `<i class="${k === i ? 'is-on' : ''}"></i>`).join('') : '';
    ui.pips.style.top = Math.round(to.y + CH * to.s / 2 + 12) + 'px';
  }
  async function leave(dir){
    const { c, item } = cur;
    cur = null;
    if (dir) c.spin?.(); else await faceUp(c); // a flicked card flies as it is
    // closing, it goes home to its source; swapping, it's thrown off the side
    const home = dir ? null : poseOf(item);
    const to = home ? { ...home, z:0 } : { x:dir > 0 ? -CW * c.body.s : ui.el.clientWidth + CW * c.body.s, r:-dir * 18, z:6 };
    if (!home) Foil.flutter();
    await glide(c.body, to, home ? 240 : 200, { arc:home ? 22 : 4, easing:home ? ease.inOut : ease.in });
    if (home) S.cardLanded();
    unhide(item); c.body.remove();
  }
  async function step(d){
    if (!ui?.open || busy || !cur) return;
    const n = idx + d;
    if (n < 0 || n >= opts.items.length){
      // the end of the run: the card shrugs
      Foil.thud(.3); Haptic.tick(6);
      glide(cur.c.body, { x:target().x, r:0 }, 260, { easing:ease.back });
      flat(cur.c);
      return;
    }
    busy = true; idx = n;
    await Promise.all([leave(d), enter(n, d)]);
    busy = false;
    opts.onIndex?.(idx);
  }
  async function close(){
    if (!ui?.open || busy) return;
    busy = true;
    const at = idx;
    S.hatchClose(); Haptic.tick(6);
    ui.pips.innerHTML = '';
    await Promise.all([
      cur ? leave(0) : null,
      tween(220, e => { ui.drawer.style.transform = `translateY(${Math.round(e * 105)}%)`; ui.dim.style.opacity = snap(.66 * (1 - e), .11).toFixed(2); }, ease.in)
    ]);
    ui.el.hidden = true; ui.open = false; busy = false;
    opts.onClose?.(at);
  }
  // the card is used up: it goes down into the machine instead of back
  async function consume(){
    if (!cur) return;
    const { c, item } = cur;
    cur = null; busy = true;
    await faceUp(c);
    S.cardDeal();
    await glide(c.body, { y:ui.el.clientHeight + CH * c.body.s, s:c.body.s * .7, r:0, z:0 }, 320, { easing:ease.in });
    S.stageLock(); Haptic.tick(14, 0);
    c.body.remove(); unhide(item);
    busy = false;
  }
  // the card flies off to a point on the screen (pose: page coordinates)
  // and the screen closes; whatever opened it takes the card from there
  async function sendTo(pose){
    if (!cur) return;
    const { c, item } = cur, r = ui.el.getBoundingClientRect();
    cur = null; busy = true;
    await faceUp(c);
    S.cardDeal(); Haptic.tick(10);
    ui.pips.innerHTML = '';
    await Promise.all([
      glide(c.body, { ...pose, x:pose.x - r.left, y:pose.y - r.top }, 300, { easing:ease.out }),
      tween(240, e => { ui.drawer.style.transform = `translateY(${Math.round(e * 105)}%)`; ui.dim.style.opacity = snap(.66 * (1 - e), .11).toFixed(2); }, ease.in)
    ]);
    unhide(item); c.body.remove();
    ui.el.hidden = true; ui.open = false; busy = false;
    opts.onClose?.(idx);
  }
  async function press(){
    if (!ui?.open || busy) return;
    if (!opts.key?.press) return close();
    await opts.key.press(opts.items[idx], idx, { consume, close:() => close(), get index(){ return idx; } });
  }
  function keyText(){
    ui.key.textContent = opts.key?.label || 'BACK';
    // a key that commits (BUY IN) is green, like RAISE; BACK is the gold one
    ui.key.className = (opts.key?.press ? 'btn-raise' : 'btn-check') + ' ci-key';
  }

  /* The CRT: two lines (where and what; entry and seats), and a third
     only when there's something worth saying. The prize is on the card. */
  function fill(item){
    const d = EventCards.describe(item.card);
    let lines = item.lines;
    if (!lines){
      lines = item.locked
        ? ['NOT YET FOUND', 'PULL ONE FROM A PACK']
        : [d.venue + ' · ' + d.title, 'ENTRY ' + money(d.entry) + ' · ' + d.seats + ' SEATS'];
      if (!item.locked && d.payouts.length > 1) lines.push({ t:'2ND PAYS ' + money(d.payouts[1]), money:true });
    }
    ui.crt.innerHTML = lines.map(l => typeof l === 'string' ? { t:l } : l).map(l => `<span class="crt-line ci-line${l.money ? ' crt-money' : ''}">${esc(l.t)}</span>`).join('');
    typeOn();
  }
  // the lines come up one after another, each with a soft relay tick
  function typeOn(){
    const id = ++typing, parts = [...ui.crt.querySelectorAll('.ci-line')];
    if (PO.reduced) return;
    parts.forEach(p => p.style.visibility = 'hidden');
    parts.forEach((p, i) => setTimeout(() => { if (id !== typing) return; p.style.visibility = ''; S.counterTick(false); }, 90 + i * 70));
  }

  /* ---------------- input ---------------- */
  function down(e){
    if (!ui.open || ptr || e.button > 0) return;
    if (e.target.closest('button')) return;
    if (busy){ PO.finishAll(); return; }
    const onCard = cur && e.target.closest('.ec-card') === cur.c.el;
    ptr = { id:e.pointerId, x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, t:performance.now(), vx:0, vy:0, mode:onCard ? 'card' : (e.target.closest('.ci-drawer') ? 'drawer' : 'away'), yaw0:cur?.c.yaw || 0 };
    if (onCard) cur.c.spin?.();
    try { ui.el.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function move(e){
    const q = ptr;
    if (!q || q.id !== e.pointerId) return;
    const now = performance.now(), dt = Math.max(8, now - (q.tm || q.t));
    q.vx = mix(q.vx, (e.clientX - q.x) / dt, .5); q.vy = mix(q.vy, (e.clientY - q.y) / dt, .5);
    q.x = e.clientX; q.y = e.clientY; q.tm = now;
    const dx = q.x - q.x0, dy = q.y - q.y0;
    if (q.mode === 'card' && Math.hypot(dx, dy) > 8) q.mode = 'toy';
    if (q.mode === 'toy' && cur){
      // you're carrying it: it follows your finger and banks into the move
      const t = target();
      setBank(cur.c, q.yaw0 + clamp(dx * .35, -50, 50), dy * .5);
      cur.c.body.set({ x:t.x + dx, y:t.y + clamp(dy * .4, opts.swipeUp ? -90 : -14, 60), r:clamp(dx * .04, -8, 8) });
    }
  }
  function up(e, cancel){
    const q = ptr;
    if (!q || q.id !== e.pointerId) return;
    ptr = null;
    try { ui.el.releasePointerCapture(e.pointerId); } catch (_) {}
    if (cancel || !ui.open) return;
    const dx = q.x - q.x0, dy = q.y - q.y0, tap = Math.hypot(dx, dy) < 8, fresh = performance.now() - (q.tm || 0) < 60;
    if (q.mode === 'card' && tap && cur) spin(cur.c, .9);
    else if (q.mode === 'toy' && cur){
      // flick it down and it goes back where it came from
      if (dy > 70 && Math.abs(dx) < dy * .8 && fresh && q.vy > .4){ close(); return; }
      // flick it up (where that means something) and it's handed over
      if (opts.swipeUp && dy < -60 && Math.abs(dx) < -dy * .8 && fresh && q.vy < -.4){
        busy = true;
        opts.swipeUp(opts.items[idx], idx, { sendTo:p => { busy = false; return sendTo(p); }, close:() => { busy = false; return close(); } });
        return;
      }
      // flick it sideways (or carry it far enough) for the next card
      const W = ui.el.clientWidth;
      if (opts.items.length > 1 && Math.abs(dx) > Math.abs(dy) && ((fresh && Math.abs(q.vx) > .45) || Math.abs(dx) > W * .28)){ step(dx < 0 ? 1 : -1); return; }
      const t = target();
      glide(cur.c.body, { x:t.x, y:t.y, r:0 }, 240, { easing:ease.back });
      faceUp(cur.c);
    }
    else if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (q.mode === 'away' && tap) close();
  }

  window.CardInspect = {
    make, setTurn, setBank, spin, flat, faceUp, open, close, step,
    get isOpen(){ return !!ui?.open; },
    get index(){ return idx; }
  };
})();
