/* ============================================================
   EVENT CARD + INSPECT — one part for every place a card shows
   (the pack opening, the album, the Career hub). Lab until signed off.

   CardInspect.make(stage, card)   the card object: back, face, fold flap,
                                   thickness edge and shade, on a PO.Body
   setTurn / setBank / spin / flat / faceUp   the toy: turn it, bank it,
                                   flick it and it spins with momentum
   CardInspect.open({ items, index, key, onClose })
     items: [{ card, source:() => element, locked }]  what you can swipe
            through; the card rises from its source and goes back to it
     host:  the screen root it mounts in (default #home): the keys take
            that screen's own styles, exactly as its other keys do
     key:   { label, sub, press(item, index, api) }   the big key; without
            press it closes. api.consume() posts the card into the machine
            (it's used up) instead of returning it.
   The screen lives on its own top layer, above whatever opened it: the
   card lifts, the house dims a step, and a drawer rises from below with
   the seats (the real opponents) and a CRT that types the details on.
   Drag the card to tilt it, flick it to spin; swipe the screen (or the
   ◄ ► keys) for the next card; tap away, or flick the card down, to put
   it back.
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
  let ui = null, opts = null, idx = 0, cur = null, busy = false, ptr = null, blinkT = 0, typing = 0;

  function build(){
    if (ui) return;
    const el = document.createElement('section');
    el.className = 'ci'; el.id = 'ci'; el.hidden = true;
    el.setAttribute('aria-label', 'Card details');
    el.innerHTML = `
      <i class="ci-dim"></i>
      <div class="ci-stage"><div class="ci-shadows"></div><div class="ci-objects"></div><div class="ci-fx"></div></div>
      <button class="icon-btn ci-back" type="button" hidden>BACK</button>
      <div class="ci-drawer">
        <div class="ci-seats"><div class="ci-faces"></div><span class="ec-lip ci-lip"></span></div>
        <div class="crt ci-crt" data-crt-quiet></div>
        <div class="ci-keys">
          <button class="pc-button pc-button-secondary ci-step" type="button" data-step="-1" aria-label="Previous card"><i class="ci-arrow is-left"></i></button>
          <div class="pc-primary-cradle ci-cradle"><button class="pc-button pc-button-primary ci-key" type="button"><span class="pc-lamp is-amber"></span><span><span class="ci-key-label"></span><small class="ci-key-sub"></small></span><span class="pc-lamp is-amber"></span></button></div>
          <button class="pc-button pc-button-secondary ci-step" type="button" data-step="1" aria-label="Next card"><i class="ci-arrow"></i></button>
        </div>
      </div>`;
    (document.getElementById('home') || document.body).append(el);
    const st = el.querySelector('.ci-stage');
    ui = {
      el, dim:el.querySelector('.ci-dim'), drawer:el.querySelector('.ci-drawer'), faces:el.querySelector('.ci-faces'),
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
    const s = clamp(Math.floor(Math.min((top - 30) / CH, W * .6 / CW, 2.5) * 4) / 4, 1, 2.5);
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
    ui.el.querySelectorAll('.ci-step').forEach(b => b.hidden = o.items.length < 2);
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
    const to = target(), from = poseOf(item);
    hide(item);
    c.body.set(from ? { ...from, sx:1, sy:1, alpha:1 } : { ...to, x:dir > 0 ? ui.el.clientWidth + CW * to.s : -CW * to.s, r:dir * 14 });
    cur = { c, item };
    S.cardReturn(); Foil.flutter(); Haptic.tick(6);
    await glide(c.body, to, from ? 300 : 240, { arc:from ? 28 : 10 });
    squash(c.body, .05, 160); S.cardLanded();
  }
  async function leave(dir){
    const { c, item } = cur;
    cur = null;
    await faceUp(c);
    const home = poseOf(item);
    const to = home ? { ...home, z:0 } : { x:dir > 0 ? -CW * c.body.s : ui.el.clientWidth + CW * c.body.s, r:-dir * 14 };
    await glide(c.body, to, 240, { arc:home ? 22 : 8, easing:ease.inOut });
    if (home) S.cardLanded();
    unhide(item); c.body.remove();
  }
  async function step(d){
    if (!ui?.open || busy || !cur) return;
    const n = idx + d;
    if (n < 0 || n >= opts.items.length){
      // the end of the run: the card shrugs
      Foil.thud(.3); Haptic.tick(6);
      tween(180, (e, t) => cur.c.body.set({ x:target().x + Math.sin(t * Math.PI * 2) * 8 * -d * (1 - t) }), ease.lin);
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
    clearTimeout(blinkT);
    S.hatchClose(); Haptic.tick(6);
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
  async function press(){
    if (!ui?.open || busy) return;
    if (!opts.key?.press) return close();
    await opts.key.press(opts.items[idx], idx, { consume, close:() => close(), get index(){ return idx; } });
  }
  function keyText(){
    ui.el.querySelector('.ci-key-label').textContent = opts.key?.label || 'BACK';
    ui.el.querySelector('.ci-key-sub').textContent = opts.key?.sub || (opts.items.length > 1 ? 'SWIPE FOR THE NEXT CARD' : '');
  }

  /* The drawer: the seats (the real faces), then the CRT types the
     details on a line at a time. */
  function fill(item){
    const d = EventCards.describe(item.card), n = opts.items.length;
    clearTimeout(blinkT);
    if (item.locked){
      ui.faces.innerHTML = Array.from({ length:d.opponents }, () => '<span class="ch2-face ci-seat is-empty"><span class="ci-empty">?</span><b>?</b></span>').join('');
    } else if (item.card.roster){
      ui.faces.innerHTML = item.card.roster.map((seat, i) => {
        const face = { faceColorIdx:seat.faceColorIdx };
        let rest = '', alt = '';
        try { rest = renderFace(face, 'idle'); alt = renderFace(face, 'think'); } catch (e) {}
        return `<span class="ch2-face ci-seat" style="--i:${i}"><span class="ch2-portrait-stack"><span class="ch2-rest-art">${rest}</span><span class="ch2-alt-art">${alt}</span></span><b>${esc(d.names[i] || 'VISITOR')}</b></span>`;
      }).join('');
    } else {
      ui.faces.innerHTML = Array.from({ length:d.opponents }, () => '<span class="ch2-face ci-seat is-empty"><span class="ci-empty"></span><b>&nbsp;</b></span>').join('');
    }
    ui.faces.dataset.n = d.opponents;
    const count = n > 1 ? ` · ${idx + 1}/${n}` : '';
    const prize = item.locked ? '?' : money(d.payouts[0]);
    const rows = item.locked ? [
      ['', `<span class="crt-line">NOT YET FOUND</span>`],
      ['RARITY', `<span class="crt-line">${d.rarity}</span>`],
      ['', `<span class="crt-line ci-wrap">PULL ONE FROM A PACK TO SEE WHAT IT PLAYS.</span>`]
    ] : [
      ['PAYS', `<span class="crt-line crt-money">${d.payouts.length > 1 ? d.payouts.map((p, i) => ['1ST', '2ND', '3RD'][i] + ' ' + money(p)).join(' · ') : 'WINNER TAKES ' + money(d.payouts[0])}</span>`],
      ['TABLE', `<span class="crt-line">${d.seats} SEATS · YOU + ${d.opponents}</span>`],
      ['ENTRY', `<span class="crt-line">${money(d.entry)} · STACK ${d.stack.toLocaleString('en-US')}</span>`],
      ['BLINDS', `<span class="crt-line">${d.blinds} · UP EVERY ${d.every} HANDS</span>`],
      ['FIELD', `<span class="crt-meter ci-meter" style="--v:${d.field * 20}%"><i></i></span>`],
      ['TWIST', `<span class="crt-line ci-wrap">${esc(d.twist)}</span>`]
    ];
    const seatsNote = !item.locked && !item.card.roster ? `<span class="crt-caption ci-note">THE TABLE IS DRAWN WHEN YOU PULL ONE</span>` : '';
    ui.crt.innerHTML = `<div class="ci-head"><span class="crt-line ci-title">${esc(item.locked ? '? · ' + d.rarity : d.venue + ' · ' + d.title)}</span><span class="crt-caption ci-sub">${esc((item.locked ? 'NOT YET PULLED' : d.format + ' · ' + d.rarity) + count)}</span><span class="crt-figure crt-money ci-prize">${prize}</span><span class="crt-caption ci-prize-l">TOP PRIZE</span></div>`
      + `<div class="ci-rows">${rows.map(([k, v]) => `<span class="crt-caption ci-k">${k}</span><span class="ci-v">${v}</span>`).join('')}</div>${seatsNote}`;
    typeOn();
    blink();
  }
  // the rows come up one after another, each with a soft relay tick
  function typeOn(){
    const id = ++typing, parts = [...ui.crt.querySelectorAll('.ci-head, .ci-k, .ci-v, .ci-note')], seats = [...ui.faces.children];
    parts.forEach(p => p.style.visibility = 'hidden');
    seats.forEach(s => s.classList.remove('is-in'));
    if (PO.reduced){ parts.forEach(p => p.style.visibility = ''); seats.forEach(s => s.classList.add('is-in')); return; }
    seats.forEach((s, i) => setTimeout(() => { if (id === typing){ s.classList.add('is-in'); if (i % 2 === 0) Foil.thud(.15); } }, 60 + i * 70));
    parts.forEach((p, i) => setTimeout(() => { if (id !== typing) return; p.style.visibility = ''; if (i % 2 === 0) S.counterTick(false); }, 120 + i * 34));
  }
  // the faces aren't pictures: now and then one of them glances
  function blink(){
    clearTimeout(blinkT);
    blinkT = setTimeout(() => {
      const f = [...ui.faces.querySelectorAll('.ci-seat:not(.is-empty)')];
      if (f.length && ui.open){
        const s = f[Math.floor(Math.random() * f.length)];
        s.classList.add('is-expressing');
        setTimeout(() => s.classList.remove('is-expressing'), 320);
      }
      if (ui.open) blink();
    }, 1400 + Math.random() * 1800);
  }

  /* ---------------- input ---------------- */
  function down(e){
    if (!ui.open || ptr || e.button > 0) return;
    if (e.target.closest('button')) return;
    if (busy){ PO.finishAll(); return; }
    const onCard = cur && e.target.closest('.ec-card') === cur.c.el;
    ptr = { id:e.pointerId, x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, t:performance.now(), vx:0, vy:0, vyaw:0, mode:onCard ? 'card' : (e.target.closest('.ci-drawer') ? 'drawer' : 'away'), yaw0:cur?.c.yaw || 0 };
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
      const before = cur.c.yaw || 0;
      setBank(cur.c, q.yaw0 + dx * 1.2, dy * .5);
      q.vyaw = mix(q.vyaw, ((cur.c.yaw || 0) - before) / dt, .5);
      cur.c.body.set({ y:target().y + clamp(dy * .25, -10, 40) });
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
      glide(cur.c.body, { y:target().y }, 160, { easing:ease.back });
      spin(cur.c, fresh ? q.vyaw : 0);
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
