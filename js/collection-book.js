/* ============================================================
   THE CARD ALBUM — js/collection-book.js (lab only; collection-book-lab.html)

   The owner's design (12 Oct, docs/career/COLLECTION_BOOK_PLAN.md, round 2):
   CARDS brings a big leather-bound book up from behind the console; it
   lifts, then drops onto the table with a thunk, closed. It covers the
   table and felt; the reel, the feeder and the keys stay in view.
   - Drag the cover open from its right edge (a tap opens it for you).
   - Three rows of three on a page. A card you have is bright; one found
     but used up is very dim; one not found yet is an empty slot.
   - Drag a page left and it follows your finger, lifting over the tabs;
     past halfway it falls over, short of that it drops back. Drag right
     for the page before. Or tap the pull tab on the right (on a page) or
     the left (back one). Tap a numbered tab: the pages riffle over to it.
   - Tap a card: it lifts a little and lights. Tap it again: it comes out
     to the inspect screen, and goes back into its place when you're done.
     With SLEEVES (the lab's option) each card sits in a thin plastic
     sleeve: it slides out of the top, and is tucked back in after.
   - CARDS again: the cover shuts, the book lifts and sinks away. While
     it's out the other two keys are dark.
   How the cards are organised is open: these are placeholders.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, ease, tween, wait, puff, jolt, S, Foil, Haptic } = PO;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const PAGES = 5, PER = 9, CW = 82, CH = 120;
  let sleeves = !!state.sleeves;

  let cm, layer, book, shadow, coverEl, tabsEl, leavesEl, castEl, fx, sheet;
  let mode = 'away';     // away · moving · closed · open
  let cur = 0;           // the page open
  let lit = null;        // the slot lit by a first tap
  let y0 = 0;            // the book's offset when it's down behind the console

  /* ---------------- the placeholder album ---------------- */
  const VENUES = ['back-room-five', 'back-room-freezeout', 'pub-open', 'pub-turbo', 'pub-freezeout',
    'card-club-six', 'card-club-deep', 'casino-main', 'back-room-heads-up'];
  const FILL = [.85, .66, .5, .3, .12];
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rarity = () => { const r = rand(); return r < .5 ? 'common' : r < .78 ? 'uncommon' : r < .94 ? 'rare' : 'legendary'; };
  const album = Array.from({ length:PAGES }, (_, p) => Array.from({ length:PER }, (_, i) => {
    const found = rand() < FILL[p], used = rand() < .3;
    if (!found) return { state:'empty' };
    const card = EventCards.make(EventCards.KINDS[(i + p * 2) % 4], rarity(), VENUES[Math.floor(rand() * VENUES.length)], { roster:false });
    return { state:used ? 'used' : 'have', card };
  }));

  /* ---------------- build ---------------- */
  const corners = '<i class="cb-pc is-tl"></i><i class="cb-pc is-tr"></i><i class="cb-pc is-bl"></i><i class="cb-pc is-br"></i>';
  function slotHTML(x, p, i){
    const face = x.card ? `<span class="cb-face">${PokerCollectibleLab.objectHTML(x.card.spec)}</span>` : '';
    return `<div class="cb-slot is-${x.state}" data-p="${p}" data-i="${i}">${face}${sleeves ? '<i class="cb-sleeve"></i>' : corners}</div>`;
  }
  function pagesHTML(){
    return album.map((pg, p) => `<div class="cb-page" data-p="${p}"><div class="cb-grid">${pg.map((x, i) => slotHTML(x, p, i)).join('')}</div><i class="cb-gutter"></i></div>`).join('');
  }
  function build(){
    cm = document.getElementById('cm');
    layer = document.createElement('div');
    layer.className = 'cb-layer';
    layer.innerHTML = `
      <i class="cb-shadow"></i>
      <div class="cb-book">
        <div class="cb-board"><i class="cb-hinge"></i></div>
        <div class="cb-tabs">${Array.from({ length:PAGES }, (_, i) => `<b class="cb-tab" data-p="${i}">${i + 1}</b>`).join('')}</div>
        <div class="cb-block"><div class="cb-stack"></div><div class="cb-leaves"></div></div>
        <button class="cb-turn is-back" type="button" aria-label="Back a page"></button>
        <button class="cb-turn is-next" type="button" aria-label="Next page"></button>
        <div class="cb-cover"><i class="cb-spine"></i><b class="cb-mark">&spades;</b></div>
      </div>
      <div class="cb-fx"></div>`;
    cm.insertBefore(layer, cm.querySelector('.cm-console'));
    book = layer.querySelector('.cb-book'); shadow = layer.querySelector('.cb-shadow');
    coverEl = layer.querySelector('.cb-cover'); tabsEl = layer.querySelector('.cb-tabs');
    leavesEl = layer.querySelector('.cb-leaves'); fx = { fx:layer.querySelector('.cb-fx') };
    fillPages();
    // the lab's sheet, on the hub's own TUNE key
    sheet = document.createElement('section');
    sheet.className = 'po-sheet cm-sheet cb-sheet'; sheet.hidden = true; sheet.setAttribute('aria-label', 'Tune');
    sheet.innerHTML = `
      <h2>THE CARD ALBUM</h2>
      <p>CARDS brings the book up. Drag the cover open, or tap it. Drag a page left to turn it, right to turn back; tap a tab to flick through. Tap a card to light it, tap again to take it out. CARDS again puts the book away. The cards are placeholders.</p>
      <h3>SLEEVES</h3>
      <div class="cm-seg"><button class="pc-button pc-button-secondary" data-sleeves="0">CORNERS</button><button class="pc-button pc-button-secondary" data-sleeves="1">SLEEVES</button></div>
      <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cb-done">DONE</button></div>`;
    cm.append(sheet);
    const tune = document.getElementById('cm-tune');
    tune.onclick = () => { sheet.hidden = !sheet.hidden; };
    sheet.querySelector('#cb-done').onclick = () => { sheet.hidden = true; };
    sheet.querySelectorAll('[data-sleeves]').forEach(b => b.onclick = () => {
      sleeves = b.dataset.sleeves === '1';
      if (host) host.set({ sleeves });
      unlight(); fillPages(); marks();
    });
    marks();
    layer.addEventListener('pointerdown', down);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', e => up(e, true));
    new ResizeObserver(() => { if (mode !== 'away') place(); }).observe(cm);
  }
  function marks(){ sheet.querySelectorAll('[data-sleeves]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.sleeves === '1') === sleeves))); }
  function fillPages(){
    leavesEl.innerHTML = pagesHTML() + '<i class="cb-cast"></i>';
    castEl = leavesEl.querySelector('.cb-cast');
    stackPages();
  }
  const pageEl = p => leavesEl.querySelector(`.cb-page[data-p="${p}"]`);
  // the pages from the open one back, the open one on top; the turned ones hidden
  function stackPages(){
    leavesEl.querySelectorAll('.cb-page').forEach(el => {
      const p = +el.dataset.p;
      el.style.zIndex = String((PAGES - p) * 2);
      el.hidden = p < cur;
      el.style.transform = '';
      el.style.filter = '';
    });
    castEl.style.opacity = '0';
    tabsEl.querySelectorAll('.cb-tab').forEach(t => t.classList.toggle('is-at', +t.dataset.p === cur));
    layer.querySelector('.cb-turn.is-back').classList.toggle('is-off', cur === 0);
    layer.querySelector('.cb-turn.is-next').classList.toggle('is-off', cur === PAGES - 1);
  }

  /* ---------------- where it sits: over the table ---------------- */
  function place(){
    const c = cm.getBoundingClientRect(), f = document.querySelector('.cm-felt').getBoundingClientRect();
    const k = document.querySelector('.cm-console').getBoundingClientRect(), cab = document.querySelector('.cm-cabinet').getBoundingClientRect();
    const left = Math.round(f.left - c.left - cm.clientLeft - 8), right = Math.round(f.right - c.left - cm.clientLeft + 8);
    const top = Math.round(cab.bottom - c.top - cm.clientTop + 8), bottom = Math.round(k.top - c.top - cm.clientTop - 8);
    const W = right - left, H = bottom - top;
    Object.assign(layer.style, { left:left + 'px', top:top + 'px', width:W + 'px', height:H + 'px' });
    y0 = k.top - c.top - cm.clientTop - top;   // its top edge level with the console's: out of sight
    // three across, as big as the page allows; the rows spread down it
    const board = 10, hinge = 14, tabs = 24, stack = 5, pad = 14, gx = 14;
    const iw = W - board * 2 - hinge - stack - pad * 2 - 6, ih = H - board * 2 - tabs - stack - pad * 2;
    const cw = Math.floor(Math.min((iw - gx * 2) / 3, (ih - 40) / 3 * CW / CH)), ch = Math.round(cw * CH / CW);
    const gy = clamp(Math.floor((ih - ch * 3) / 4), 10, 48);
    const s = layer.style;
    s.setProperty('--cb-cw', cw + 'px'); s.setProperty('--cb-ch', ch + 'px');
    s.setProperty('--cb-gx', gx + 'px'); s.setProperty('--cb-gy', gy + 'px');
    s.setProperty('--cb-k', (cw / 164).toFixed(4));
  }
  // the book's pose: y (0 = down on the table) and lift (1 = on the table,
  // more = raised toward you); its shadow stays on the table and spreads
  function pose(y, lift = 1){
    book.style.transform = `translateY(${Math.round(y)}px) scale(${lift.toFixed(3)})`;
    const up = (lift - 1) * 20;
    shadow.style.transform = `translateY(${Math.round(y + 6 + up * 18)}px) scale(${(1 + up * .2).toFixed(3)})`;
    shadow.style.opacity = clamp(1 - up * .9, .35, 1).toFixed(2);
  }

  /* ---------------- in and out ---------------- */
  const keyEl = k => CareerMain.keyEl(k);
  function darkKeys(){
    CareerMain.setKey(keyEl('shop'), 'SHOP', false);
    CareerMain.setKey(keyEl('play'), keyEl('play').dataset.label || 'REDEAL', false);
    keyEl('play').classList.remove('is-ready');
  }
  async function bringUp(){
    mode = 'moving';
    sheet.hidden = true;
    cur = 0; fillPages();
    coverEl.hidden = false; coverEl.style.transform = '';
    place();
    layer.classList.add('is-out');
    darkKeys();
    pose(y0, 1);
    S.cardReturn(); Haptic.tick(8);
    // up from behind the console, lifting as it comes
    await tween(PO.reduced ? 1 : 420, e => pose(mix(y0, -16, e), mix(1, 1.05, e)), ease.out);
    await wait(PO.reduced ? 0 : 70);
    // and dropped
    await tween(PO.reduced ? 1 : 130, e => pose(mix(-16, 0, e), mix(1.05, 1, e)), ease.in);
    thunk();
    mode = 'closed';
  }
  function thunk(){
    pose(0, 1);
    Foil.thud(1); S.stageLock(); Haptic.tick(20, 0);
    jolt(document.querySelector('.cm-cabinet'), 3); jolt(document.querySelector('.cm-console'), 2);
    book.style.scale = '1 .985';
    setTimeout(() => { book.style.scale = ''; }, 90);
    const W = layer.clientWidth, H = layer.clientHeight;
    puff(fx, W / 2, H - 2, W, { n:10, colour:'#2c4a36' });
    puff(fx, W / 2, 4, W * .8, { n:6, colour:'#2c4a36' });
  }
  async function putAway(){
    mode = 'moving';
    unlight();
    if (coverEl.hidden) await shut();
    await tween(PO.reduced ? 1 : 150, e => pose(mix(0, -12, e), mix(1, 1.04, e)), ease.out);
    S.cardReturn(); Haptic.tick(8);
    await tween(PO.reduced ? 1 : 380, e => pose(mix(-12, y0, e), mix(1.04, 1, e)), ease.in);
    layer.classList.remove('is-out');
    mode = 'away';
    CareerMain.keys();
  }
  function toggle(){
    if (mode === 'moving' || CardInspect.isOpen) return;
    if (mode === 'away') bringUp(); else putAway();
  }

  /* ---------------- the cover ---------------- */
  const coverAt = a => { coverEl.style.transform = `rotateY(${a.toFixed(1)}deg)`; };
  async function openCover(from = 0){
    mode = 'moving';
    Foil.rustle(.5); Haptic.tick(8);
    await tween(PO.reduced ? 1 : 380 * (1 - from), e => coverAt(-90 * mix(from, 1, e)), ease.inOut);
    coverEl.hidden = true;
    S.hatchOpen();
    mode = 'open';
  }
  async function shut(){
    coverEl.hidden = false; coverAt(-90);
    Foil.rustle(.4);
    await tween(PO.reduced ? 1 : 300, e => coverAt(-90 * (1 - e)), ease.in);
    coverEl.style.transform = '';
    Foil.thud(.5); Haptic.tick(10);
    await wait(PO.reduced ? 0 : 80);
  }

  /* ---------------- turning pages ---------------- */
  // a page's turn t: 0 flat, 1 stood on the binding (and gone past it);
  // it catches the light as it lifts, and throws a shadow on the next
  function turnAt(p, t){
    const el = pageEl(p);
    el.hidden = false;
    el.style.transform = t ? `rotateY(${(-90 * t).toFixed(1)}deg)` : '';
    el.style.filter = t ? `brightness(${(1 + .18 * t).toFixed(3)})` : '';
    castEl.style.zIndex = String((PAGES - p) * 2 - 1);
    castEl.style.opacity = (Math.sin(t * Math.PI) * .7).toFixed(2);
  }
  // over (forward) from t, or back down (dir -1) from t
  async function finishTurn(p, from, over, ms = 300){
    const to = over ? 1 : 0;
    mode = 'moving';
    if (over) Foil.flutter();
    await tween(PO.reduced ? 1 : ms * Math.abs(to - from) + 40, e => turnAt(p, mix(from, to, e)), over ? ease.in : ease.out);
    if (over === (p === cur)){
      // a page went over: the next is open; or the one before came back down
      cur = over ? p + 1 : p;
      Foil.rustle(.25); Haptic.tick(6);
    }
    stackPages();
    mode = 'open';
  }
  // a tab: the pages riffle over (or back) one after another
  async function riffle(to){
    if (to === cur) return;
    mode = 'moving';
    unlight();
    const fwd = to > cur, list = fwd ? range(cur, to) : range(to, cur).reverse();
    await Promise.all(list.map((p, k) => wait(PO.reduced ? 0 : k * 90).then(async () => {
      if (!fwd) turnAt(p, 1);
      Foil.flutter();
      await tween(PO.reduced ? 1 : 200, e => turnAt(p, fwd ? e : 1 - e), fwd ? ease.in : ease.out);
      if (fwd){ pageEl(p).hidden = true; tabsEl.querySelectorAll('.cb-tab').forEach(t => t.classList.toggle('is-at', +t.dataset.p === p + 1)); }
      else tabsEl.querySelectorAll('.cb-tab').forEach(t => t.classList.toggle('is-at', +t.dataset.p === p));
    })));
    cur = to; stackPages();
    Foil.rustle(.3); Haptic.tick(8);
    mode = 'open';
  }
  // a pull tab: one page on, or one back, turned for you
  async function tapTurn(d){
    if (d > 0 ? cur === PAGES - 1 : cur === 0){ Foil.thud(.25); Haptic.tick(6); return; }
    mode = 'moving';
    unlight();
    Foil.rustle(.2);
    if (d > 0) await finishTurn(cur, 0, true, 420);
    else { turnAt(cur - 1, 1); await finishTurn(cur - 1, 1, false, 420); }
    mode = 'open';
  }
  const range = (a, b) => Array.from({ length:b - a }, (_, i) => a + i);

  /* ---------------- cards ---------------- */
  function unlight(){
    if (!lit) return;
    lit.classList.remove('is-lit');
    lit = null;
  }
  function light(slot){
    if (lit === slot) return;
    unlight();
    lit = slot; slot.classList.add('is-lit');
    Foil.rustle(.2); Haptic.tick(6);
  }
  const faceOf = slot => slot.querySelector('.cb-face');
  const slide = (slot, to, ms) => {
    const f = faceOf(slot), from = parseFloat(f.dataset.out || 0);
    return tween(PO.reduced ? 1 : ms, e => { const v = mix(from, to, e); f.dataset.out = v; f.style.translate = `0 ${Math.round(-v * slot.clientHeight)}px`; }, ease.inOut);
  };
  // out to the inspect screen: through the cards on this page; with
  // sleeves it slides up out of the sleeve first, and is tucked back after
  async function takeOut(slot){
    mode = 'moving';
    const slots = [...pageEl(cur).querySelectorAll('.cb-slot:not(.is-empty)')];
    if (sleeves){
      Foil.rustle(.35); await slide(slot, .42, 200);
      // open from a task of its own, so its card is posed before the next paint
      await new Promise(r => setTimeout(r, 0));
    }
    const items = slots.map(s => ({ card:album[cur][+s.dataset.i].card, source:() => faceOf(s) }));
    mode = 'open';
    CardInspect.open({
      items, index:slots.indexOf(slot),
      onClose:async at => {
        const back = slots[at];
        unlight();
        if (sleeves){
          mode = 'moving';
          // the card it went back to is slid out: it's pushed home
          if (back !== slot){ faceOf(slot).style.translate = ''; faceOf(slot).dataset.out = 0; faceOf(back).dataset.out = .42; faceOf(back).style.translate = `0 ${Math.round(-.42 * back.clientHeight)}px`; }
          Foil.rustle(.3);
          await slide(back, 0, 240);
          faceOf(back).style.translate = '';
          Haptic.tick(6);
          mode = 'open';
        }
      }
    });
  }

  /* ---------------- touch ---------------- */
  let ptr = null;
  function down(e){
    if (ptr || mode === 'moving' || mode === 'away' || CardInspect.isOpen) return;
    const what = mode === 'closed' ? 'cover' : e.target.closest('.cb-turn') ? 'turn' : e.target.closest('.cb-tab') ? 'tab' : e.target.closest('.cb-block') ? 'page' : null;
    if (!what) return;
    ptr = { id:e.pointerId, x:e.clientX, y:e.clientY, t:performance.now(), what, el:e.target, drag:null, vx:0, lx:e.clientX, lt:performance.now() };
    layer.setPointerCapture?.(e.pointerId);
  }
  function move(e){
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, now = performance.now();
    ptr.vx = (e.clientX - ptr.lx) / Math.max(1, now - ptr.lt); ptr.lx = e.clientX; ptr.lt = now;
    if (!ptr.drag){
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      if (ptr.what === 'cover' && dx < 0) ptr.drag = 'cover';
      else if (ptr.what === 'page' && dx < 0 && cur < PAGES - 1) ptr.drag = 'next';
      else if (ptr.what === 'page' && dx > 0 && cur > 0) ptr.drag = 'back';
      else return;
      unlight();
      if (ptr.drag !== 'cover') Foil.rustle(.2);
    }
    const W = leavesEl.clientWidth * .85;
    if (ptr.drag === 'cover'){ ptr.v = clamp(-dx / W, 0, 1); coverAt(-90 * ptr.v); }
    else if (ptr.drag === 'next'){ ptr.v = clamp(-dx / W, 0, 1); turnAt(cur, ptr.v); }
    else { ptr.v = clamp(1 - dx / W, 0, 1); turnAt(cur - 1, ptr.v); }
  }
  function up(e, cancel){
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = ptr; ptr = null;
    if (p.drag){
      // past halfway, or flicked, it goes; otherwise it drops back
      const v = p.v || 0;
      if (p.drag === 'cover'){
        if (!cancel && (v > .45 || p.vx < -.6)) openCover(v);
        else tween(160 * v + 20, e2 => coverAt(-90 * v * (1 - e2)), ease.out);
      }
      else if (p.drag === 'next') finishTurn(cur, v, !cancel && (v > .45 || p.vx < -.6));
      else finishTurn(cur - 1, v, cancel || !(v < .55 || p.vx > .6));
      return;
    }
    if (cancel || performance.now() - p.t > 600) return;
    // a tap
    if (p.what === 'cover') return openCover();
    if (p.what === 'turn') return tapTurn(p.el.closest('.cb-turn').classList.contains('is-next') ? 1 : -1);
    if (p.what === 'tab') return riffle(+p.el.closest('.cb-tab').dataset.p);
    const slot = p.el.closest('.cb-slot');
    if (!slot || slot.classList.contains('is-empty')) return unlight();
    if (lit === slot) takeOut(slot); else light(slot);
  }

  window.CareerAlbum = {
    toggle,
    get out(){ return mode !== 'away'; },
    // read-only, for the lab's checks
    get state(){ return { mode, page:cur, lit:lit ? +lit.dataset.i : null, sleeves }; }
  };
  function start(){
    if (window.CareerMain && document.querySelector('#cm .cm-felt')) build();
    else requestAnimationFrame(start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
