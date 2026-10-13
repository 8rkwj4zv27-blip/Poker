/* ============================================================
   THE CARD ALBUM — js/collection-book.js (lab only; collection-book-lab.html)

   The owner's design (12 Oct, docs/career/COLLECTION_BOOK_PLAN.md, round 3):
   CARDS brings a big leather-bound book up from behind the console and
   puts it on the table, closed. It covers the table and felt; the reel,
   the feeder and the keys stay in view.
   - ARRIVAL (lab option): LIFT (raised and dropped) or THROW (carried up,
     slammed down: a freeze on impact, the cabinet shakes, the reel
     rattles, the keys bump, dust, a skid and a settle).
   - Drag the cover open from its right edge (a tap opens it for you).
   - Three rows of three on a page. A card you have is bright; one found
     but used up is very dim; one not found yet is an empty slot.
   - Drag a page left and it follows your finger, over the tabs; past
     halfway it falls over, short of that it drops back. Drag right for the
     page before. The pull tabs either side turn one for you; a numbered
     tab riffles to its page. TURN (lab option): FLAT (one stiff sheet) or
     CURL (the page bends, in stepped frames, peeling from where you hold).
   - Tap a card: it lifts a little and lights. Tap it again: it comes out
     to the inspect screen, and goes back into its place after. In SLEEVES
     (lab option) it catches, slides out of its plastic sleeve with a
     wobble and pops free with a glint; it goes back in tilted, catches
     the mouth, slides down and tucks home.
   - Hold a card you have: it comes out of its sleeve into your fingers.
     Carry it up to the reader (INSERT CARD) and let go: it goes half in,
     the middle key lights PLAY. Let go anywhere else: back into its
     sleeve. A used-up card won't come out. Flicking a card up out of the
     inspect screen sends it to the reader too. Another card carried up
     swaps with the one in it; tap the card in the reader and it flies
     back into its sleeve.
   - PLAY: the book shuts and sinks away, the card goes in (used up), and
     the screen wheels round to the table (the real hand-off isn't wired;
     tap the table to come back).
   - CARDS again: the cover shuts, the book lifts and sinks away (a card
     in the reader goes home first). While it's out SHOP is dark.
   How the cards are organised is open: these are placeholders.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, ease, tween, wait, glide, squash, puff, burst, jolt, S, Foil, Haptic } = PO;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const PAGES = 5, PER = 9, CW = 82, CH = 120;
  const opt = {
    arrival:state.arrival === 'lift' ? 'lift' : 'throw',
    turn:state.turn === 'flat' ? 'flat' : 'curl',
    sleeves:state.sleeves !== false
  };

  let cm, layer, book, shadow, coverEl, tabsEl, leavesEl, castEl, fx, sheet, fstage;
  let mode = 'away';     // away · moving · closed · open
  let cur = 0;           // the page open
  let lit = null;        // the slot lit by a first tap
  let fedSlot = null;    // the slot whose card is in the reader
  let y0 = 0;            // the book's offset when it's down behind the console
  const R = ms => PO.reduced ? 1 : ms;

  /* ---------------- a few sounds of its own ---------------- */
  const Snd = (() => {
    let ctx = null;
    const ac = () => {
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { ctx = null; }
      return ctx;
    };
    // the game's own sound switch (a global, not on window)
    const on = () => { try { return typeof settings === 'undefined' || settings.sound !== false; } catch (e) { return true; } };
    function noise(dur, vol, f0, f1, q = 1, type = 'bandpass'){
      const c = ac(); if (!c || !on()) return;
      const n = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
      src.buffer = buf; f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(c.destination); src.start(t); src.stop(t + dur);
    }
    return {
      unlock:ac,
      // the book hits the table: a low boom under a wooden knock
      boom(power = 1){
        const c = ac(); if (!c || !on()) return;
        const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
        o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(34, t + .4);
        g.gain.setValueAtTime(.55 * power, t); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + .46);
        noise(.22, .5 * power, 420, 90, .8, 'lowpass');
        noise(.06, .18 * power, 1600, 700, 2);
      },
      // plastic: a card sliding in or out of its sleeve
      shhk(out = true){ noise(.2, .05, out ? 1500 : 4200, out ? 4600 : 1400, 2.5); },
      tick(){ noise(.03, .07, 2600, 2400, 3); },
      // a page landing
      flap(){ noise(.09, .1, 900, 300, .9, 'lowpass'); }
    };
  })();

  /* ---------------- the placeholder album ---------------- */
  const VENUES = ['back-room-five', 'back-room-freezeout', 'pub-open', 'pub-turbo', 'pub-freezeout',
    'card-club-six', 'card-club-deep', 'casino-main', 'back-room-heads-up'];
  const FILL = [.85, .66, .5, .3, .12];
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rarity = () => { const r = rand(); return r < .5 ? 'common' : r < .78 ? 'uncommon' : r < .94 ? 'rare' : 'legendary'; };
  let album = Array.from({ length:PAGES }, (_, p) => Array.from({ length:PER }, (_, i) => {
    const found = rand() < FILL[p], used = rand() < .3;
    if (!found) return { state:'empty' };
    const card = EventCards.make(EventCards.KINDS[(i + p * 2) % 4], rarity(), VENUES[Math.floor(rand() * VENUES.length)], { roster:false });
    return { state:used ? 'used' : 'have', card };
  }));
  // the New Career preview (js/career-link.js): one place per event, in
  // catalogue order; an event you hold shows your card (bright, playable),
  // one you don't shows its design dimmed. Rebuilt each time the book opens.
  const LINK = window.CareerLink || null;
  function fromLink(){
    const list = LINK.albumPages();
    return Array.from({ length:PAGES }, (_, p) => Array.from({ length:PER }, (_, i) => {
      const e = list[p * PER + i];
      if (!e) return { state:'empty' };
      return e.count ? { state:'have', card:e.cards[0], count:e.count } : { state:'used', card:e.design };
    }));
  }
  const entry = slot => album[+slot.dataset.p][+slot.dataset.i];

  /* ---------------- build ---------------- */
  const corners = '<i class="cb-pc is-tl"></i><i class="cb-pc is-tr"></i><i class="cb-pc is-bl"></i><i class="cb-pc is-br"></i>';
  function slotHTML(x, p, i){
    const face = x.card ? `<span class="cb-face">${PokerCollectibleLab.objectHTML(x.card.spec)}</span>` : '';
    return `<div class="cb-slot is-${x.state}" data-p="${p}" data-i="${i}">${face}${opt.sleeves ? '<i class="cb-sleeve"></i>' : corners}</div>`;
  }
  function pagesHTML(){
    return album.map((pg, p) => `<div class="cb-page" data-p="${p}"><div class="cb-grid">${pg.map((x, i) => slotHTML(x, p, i)).join('')}</div><i class="cb-gutter"></i></div>`).join('');
  }
  const seg = (key, opts) => `<h3>${key.toUpperCase()}</h3><div class="cm-seg" data-opt="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;
  function build(){
    cm = document.getElementById('cm');
    layer = document.createElement('div');
    layer.className = 'cb-layer';
    layer.innerHTML = `
      <i class="cb-shadow"></i>
      <div class="cb-book">
        <div class="cb-thick"></div>
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
    // a stage laid exactly over the felt, above the book: the card in your
    // fingers and the card in the reader live on it (the hub's feeder
    // works in the felt's coordinates)
    const fe = document.createElement('div');
    fe.className = 'cb-feed';
    fe.innerHTML = '<div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>';
    cm.insertBefore(fe, cm.querySelector('.cm-console'));
    fstage = { el:fe, objects:fe.querySelector('.po-objects'), shadows:fe.querySelector('.po-shadows'), fx:fe.querySelector('.po-fx') };
    fe.addEventListener('pointerdown', e => {
      // the card in the reader, tapped: it goes home
      if (e.target.closest('.ec-card') && CareerMain.fed?.album && mode === 'open'){ e.stopPropagation(); CareerMain.unfeed(); }
    });
    fillPages();
    // the lab's sheet, on the hub's own TUNE key (only in the lab)
    if (!LINK) labSheet();
    layer.addEventListener('pointerdown', down);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', e => up(e, true));
    new ResizeObserver(() => { if (mode !== 'away') place(); }).observe(cm);
  }
  function labSheet(){
    sheet = document.createElement('section');
    sheet.className = 'po-sheet cm-sheet cb-sheet'; sheet.hidden = true; sheet.setAttribute('aria-label', 'Tune');
    sheet.innerHTML = `
      <h2>THE CARD ALBUM</h2>
      <p>CARDS brings the book. Drag the cover open, or tap it. Drag a page, or tap the pull tabs; tap a number to flick through. Tap a card to light it, tap again to take it out. Hold a card and carry it up to INSERT CARD, then PLAY. The cards are placeholders.</p>
      ${seg('arrival', { lift:'LIFT', throw:'THROW' })}
      ${seg('turn', { flat:'FLAT', curl:'CURL' })}
      ${seg('cards', { corners:'CORNERS', sleeves:'SLEEVES' })}
      <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cb-done">DONE</button></div>`;
    cm.append(sheet);
    document.getElementById('cm-tune').onclick = () => { sheet.hidden = !sheet.hidden; };
    sheet.querySelector('#cb-done').onclick = () => { sheet.hidden = true; };
    sheet.querySelectorAll('[data-opt] button').forEach(b => b.onclick = () => {
      const k = b.parentNode.dataset.opt, v = b.dataset.v;
      if (k === 'arrival') opt.arrival = v;
      if (k === 'turn') opt.turn = v;
      if (k === 'cards' && !CareerMain.fed?.album){ opt.sleeves = v === 'sleeves'; unlight(); fillPages(); }
      if (host) host.set({ arrival:opt.arrival, turn:opt.turn, sleeves:opt.sleeves });
      marks();
    });
    marks();
  }
  function marks(){
    const now = { arrival:opt.arrival, turn:opt.turn, cards:opt.sleeves ? 'sleeves' : 'corners' };
    sheet.querySelectorAll('[data-opt] button').forEach(b => b.setAttribute('aria-pressed', String(now[b.parentNode.dataset.opt] === b.dataset.v)));
  }
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
      el.style.transform = ''; el.style.filter = ''; el.style.visibility = '';
    });
    castEl.style.opacity = '0';
    tabsEl.querySelectorAll('.cb-tab').forEach(t => t.classList.toggle('is-at', +t.dataset.p === cur));
    layer.querySelector('.cb-turn.is-back').classList.toggle('is-off', cur === 0);
    layer.querySelector('.cb-turn.is-next').classList.toggle('is-off', cur === PAGES - 1);
  }

  /* ---------------- where it sits: over the table ---------------- */
  const local = (r, of) => ({ left:r.left - of.left - cm.clientLeft, top:r.top - of.top - cm.clientTop });
  function place(){
    const c = cm.getBoundingClientRect(), f = document.querySelector('.cm-felt').getBoundingClientRect();
    const k = document.querySelector('.cm-console').getBoundingClientRect(), cab = document.querySelector('.cm-cabinet').getBoundingClientRect();
    const left = Math.round(local(f, c).left - 8), right = Math.round(local(f, c).left + f.width + 8);
    const top = Math.round(local(cab, c).top + cab.height + 8), bottom = Math.round(local(k, c).top - 8);
    const W = right - left, H = bottom - top;
    Object.assign(layer.style, { left:left + 'px', top:top + 'px', width:W + 'px', height:H + 'px' });
    y0 = local(k, c).top - top;   // its top edge level with the console's: out of sight
    // the feed stage: exactly over the felt itself
    const fr = CareerMain.feltEl.getBoundingClientRect(), fl = local(fr, c);
    Object.assign(fstage.el.style, { left:fl.left + 'px', top:fl.top + 'px', width:fr.width + 'px', height:fr.height + 'px' });
    // three across, as big as the page allows; the rows spread down it
    const board = 10, hinge = 14, tabs = 24, stack = 5, pad = 14, gx = 14, thick = 6;
    const iw = W - board * 2 - hinge - stack - pad * 2 - 6, ih = H - board * 2 - tabs - stack - pad * 2 - thick;
    const cw = Math.floor(Math.min((iw - gx * 2) / 3, (ih - 40) / 3 * CW / CH)), ch = Math.round(cw * CH / CW);
    const gy = clamp(Math.floor((ih - ch * 3) / 4), 10, 48);
    const s = layer.style;
    s.setProperty('--cb-cw', cw + 'px'); s.setProperty('--cb-ch', ch + 'px');
    s.setProperty('--cb-gx', gx + 'px'); s.setProperty('--cb-gy', gy + 'px');
    s.setProperty('--cb-k', (cw / 164).toFixed(4));
  }
  // the book's pose: y and x (0 = down on the table), lift (1 = on the
  // table, more = raised toward you) and a turn; its shadow stays on the table
  function pose(y, lift = 1, r = 0, x = 0){
    book.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) rotate(${r.toFixed(2)}deg) scale(${lift.toFixed(3)})`;
    const up = (lift - 1) * 20;
    shadow.style.transform = `translate(${Math.round(x + up * 6)}px,${Math.round(y + 6 + up * 18)}px) rotate(${r.toFixed(2)}deg) scale(${(1 + up * .2).toFixed(3)})`;
    shadow.style.opacity = clamp(1 - up * .9, .3, 1).toFixed(2);
  }

  /* ---------------- in and out ---------------- */
  const keyEl = k => CareerMain.keyEl(k);
  function setKeys(){
    CareerMain.setKey(keyEl('shop'), 'SHOP', false);
    // the middle key says PLAY while the book is out, lit once a card is in
    const ready = !!CareerMain.fed?.album;
    CareerMain.setKey(keyEl('play'), 'PLAY', ready);
    keyEl('play').classList.toggle('is-ready', ready);
  }
  async function bringUp(){
    mode = 'moving';
    if (sheet) sheet.hidden = true;
    Snd.unlock();
    if (LINK) album = fromLink();
    cur = 0; fillPages();
    coverEl.hidden = false; coverEl.style.transform = '';
    place();
    layer.classList.add('is-out'); fstage.el.classList.add('is-out');
    setKeys();
    pose(y0);
    S.cardReturn(); Haptic.tick(8);
    if (opt.arrival === 'throw') await slam(); else await drop();
    mode = 'closed';
  }
  // LIFT: up from behind the console, lifting as it comes, and dropped
  async function drop(){
    await tween(R(420), e => pose(mix(y0, -16, e), mix(1, 1.05, e)), ease.out);
    await wait(R(70));
    await tween(R(130), e => pose(mix(-16, 0, e), mix(1.05, 1, e)), ease.in);
    pose(0);
    Foil.thud(1); S.stageLock(); Haptic.tick(20, 0);
    jolt(document.querySelector('.cm-cabinet'), 3); jolt(document.querySelector('.cm-console'), 2);
    dust(1);
  }
  // THROW: carried up high and tilted, a beat in the air, slammed down in
  // a few hard frames; a freeze on impact, the machine shakes, then the
  // book skids a little and settles square
  async function slam(){
    await tween(R(320), e => pose(mix(y0, -44, e), mix(1, 1.11, e), mix(0, -4, e)), ease.out);
    await tween(R(130), e => pose(-44 - 5 * e, 1.11 + .01 * e, -4 + .5 * e), ease.out);
    // the slam: stepped, five frames
    for (let i = 1; i <= 5; i++){
      const e = ease.in(i / 5);
      pose(mix(-49, 0, e), mix(1.12, 1, e), mix(-3.5, 1.6, e), mix(0, 4, e));
      await wait(R(24));
    }
    // impact: squashed, held for two frames
    book.style.scale = '1.02 .955';
    Snd.boom(1); Foil.thud(1.2); S.stageLock(); Haptic.tick(30, 0); setTimeout(() => Haptic.tick(16, 0), 110);
    await wait(R(70));
    book.style.scale = '.995 1.015';
    dust(1.8);
    shake(cm, 6, 5);
    rattle();
    ['shop', 'play', 'cards'].forEach((k, i) => setTimeout(() => jolt(keyEl(k), 3), 30 + i * 45));
    await wait(R(50));
    book.style.scale = '';
    // the skid, and square again
    await tween(R(260), e => pose(0, 1, mix(1.6, 0, e), mix(4, 0, e)), ease.out);
    pose(0);
  }
  function dust(power){
    const W = layer.clientWidth, H = layer.clientHeight, n = Math.round(8 * power);
    puff(fx, W / 2, H - 2, W, { n:n + 2, colour:'#2c4a36' });
    puff(fx, W / 2, 4, W * .8, { n, colour:'#2c4a36' });
    if (power > 1){
      burst(fx, 4, H * .6, { n:6, colours:['#2c4a36', '#3d5e47'], vx:[-90, -20], vy:[-60, -10], g:200, life:.4, size:3, spread:H * .5 });
      burst(fx, W - 4, H * .6, { n:6, colours:['#2c4a36', '#3d5e47'], vx:[20, 90], vy:[-60, -10], g:200, life:.4, size:3, spread:H * .5 });
    }
  }
  // the whole machine takes the hit: stepped offsets, dying away
  function shake(el, n, amp){
    if (PO.reduced) return;
    let i = 0;
    const go = () => {
      if (i >= n){ el.style.translate = ''; return; }
      const a = Math.round(amp * (1 - i / n));
      el.style.translate = `${i % 2 ? -a : a}px ${Math.round(a * .6) * (i % 3 === 0 ? 1 : -1)}px`;
      i++; setTimeout(go, 32);
    };
    go();
  }
  // the reel's digits rattle in their windows
  function rattle(){
    if (PO.reduced) return;
    const ds = [...document.querySelectorAll('#cm-reel .ch2-digit-strip')];
    [0, 1, 2, 3].forEach(f => setTimeout(() => ds.forEach((d, i) => { d.style.translate = f === 3 ? '' : `0 ${((i + f) % 3 - 1) * 2}px`; }), f * 40));
  }
  async function putAway(){
    mode = 'moving';
    unlight();
    if (coverEl.hidden) await shut();
    await tween(R(150), e => pose(mix(0, -12, e), mix(1, 1.04, e)), ease.out);
    S.cardReturn(); Haptic.tick(8);
    await tween(R(380), e => pose(mix(-12, y0, e), mix(1.04, 1, e)), ease.in);
    layer.classList.remove('is-out');
    mode = 'away';
  }
  async function toggle(){
    if (mode === 'moving' || CardInspect.isOpen) return;
    if (mode === 'away') return bringUp();
    // a card of ours in the reader goes home first
    if (CareerMain.fed?.album){ mode = 'moving'; await CareerMain.unfeed(); await homing; }
    await putAway();
    fstage.el.classList.remove('is-out');
    CareerMain.keys();
  }

  /* ---------------- the cover ---------------- */
  const coverAt = a => { coverEl.style.transform = `rotateY(${a.toFixed(1)}deg)`; };
  async function openCover(from = 0){
    mode = 'moving';
    Foil.rustle(.5); Haptic.tick(8);
    await tween(R(380 * (1 - from)), e => coverAt(-90 * mix(from, 1, e)), ease.inOut);
    coverEl.hidden = true;
    S.hatchOpen();
    mode = 'open';
  }
  async function shut(){
    coverEl.hidden = false; coverAt(-90);
    Foil.rustle(.4);
    await tween(R(300), e => coverAt(-90 * (1 - e)), ease.in);
    coverEl.style.transform = '';
    Foil.thud(.5); Haptic.tick(10);
    await wait(R(80));
  }

  /* ---------------- turning pages ---------------- */
  // a page's turn t: 0 flat, 1 stood on the binding (and gone past it).
  // turner(p, gy) → { set(t), end() }: FLAT turns the page as one stiff
  // sheet; CURL lays strips of it in a chain that bows, shaded where it
  // faces away, in stepped frames
  function turner(p){
    const el = pageEl(p);
    el.hidden = false;
    el.style.zIndex = String((PAGES - p) * 2);
    castEl.style.zIndex = String((PAGES - p) * 2 - 1);
    const cast = t => { castEl.style.opacity = (Math.sin(t * Math.PI) * .7).toFixed(2); };
    if (opt.turn === 'flat') return {
      set(t){
        el.style.transform = t ? `rotateY(${(-90 * t).toFixed(1)}deg)` : '';
        el.style.filter = t ? `brightness(${(1 + .18 * t).toFixed(3)})` : '';
        cast(t);
      },
      end(){}
    };
    const W = el.offsetWidth, N = 12, w = W / N;
    const strips = Array.from({ length:N }, (_, i) => {
      const s = el.cloneNode(true);
      s.removeAttribute('data-p'); s.classList.add('cb-strip');
      s.querySelectorAll('[data-p]').forEach(q => q.removeAttribute('data-p'));
      s.style.transform = ''; s.style.zIndex = el.style.zIndex; s.style.visibility = '';
      s.style.clipPath = `inset(-60px ${Math.max(0, W - (i + 1) * w - 1).toFixed(1)}px -60px ${Math.max(0, i * w - 1).toFixed(1)}px)`;
      s.insertAdjacentHTML('beforeend', '<i class="cb-shade"></i>');
      leavesEl.append(s);
      return { el:s, shade:s.lastChild };
    });
    el.style.visibility = 'hidden';
    return {
      set(t){
        t = Math.round(clamp(t, 0, 1) * 20) / 20;          // stepped: a flipbook, not a blend
        const bow = Math.sin(t * Math.PI) * 78, base = 90 * Math.pow(t, 1.35);
        let x = 0, z = 0;
        strips.forEach(({ el:s, shade }, i) => {
          const a = Math.min(178, base + bow * Math.pow((i + 1) / N, 1.7));
          s.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${(-a).toFixed(1)}deg) translateX(${(-i * w).toFixed(1)}px)`;
          s.classList.toggle('is-back', a > 90);
          // facing you: lit; turning away: darker; the crest catches the light
          const lum = Math.cos((a - 28) * Math.PI / 180);
          shade.style.background = lum < .86 ? `rgba(0,0,0,${((.86 - lum) * .75).toFixed(2)})` : `rgba(255,236,220,${((lum - .86) * .9).toFixed(2)})`;
          const r = a * Math.PI / 180;
          x += w * Math.cos(r); z += w * Math.sin(r);
        });
        cast(t);
      },
      end(){ strips.forEach(q => q.el.remove()); el.style.visibility = ''; }
    };
  }
  // the page you uncovered: a breath of dust from the binding, its cards settle
  function landed(p){
    const el = pageEl(p); if (!el) return;
    el.classList.remove('is-settle'); void el.offsetWidth; el.classList.add('is-settle');
    setTimeout(() => el.classList.remove('is-settle'), 260);
    const b = layer.querySelector('.cb-block').getBoundingClientRect(), l = layer.getBoundingClientRect();
    puff(fx, b.left - l.left + 4, b.top - l.top + b.height * .5, 10, { n:4, colour:'#6b4a3a' });
  }
  // over (forward) from t, or back down from t
  async function finishTurn(tr, p, from, over, ms = 300){
    const to = over ? 1 : 0;
    mode = 'moving';
    if (over) Foil.flutter();
    await tween(R(ms * Math.abs(to - from) + 40), e => tr.set(mix(from, to, e)), over ? ease.in : ease.out);
    tr.end();
    if (over === (p === cur)){
      // a page went over: the next is open; or the one before came back down
      cur = over ? p + 1 : p;
      Snd.flap(); Haptic.tick(6);
      landed(cur);
    }
    stackPages();
    mode = 'open';
  }
  // a pull tab: one page on, or one back, turned for you
  async function tapTurn(d){
    if (d > 0 ? cur === PAGES - 1 : cur === 0){ Foil.thud(.25); Haptic.tick(6); return; }
    unlight();
    Foil.rustle(.2);
    if (d > 0){ const tr = turner(cur); await finishTurn(tr, cur, 0, true, 440); }
    else { const tr = turner(cur - 1); tr.set(1); await finishTurn(tr, cur - 1, 1, false, 440); }
  }
  // a tab: the pages riffle over (or back), quick, one after another
  async function riffle(to){
    if (to === cur) return;
    mode = 'moving';
    unlight();
    const fwd = to > cur, list = fwd ? range(cur, to) : range(to, cur).reverse();
    const tab = p => tabsEl.querySelectorAll('.cb-tab').forEach(t => t.classList.toggle('is-at', +t.dataset.p === p));
    await Promise.all(list.map((p, k) => wait(R(k * 70)).then(async () => {
      const tr = turner(p);
      if (!fwd) tr.set(1);
      Foil.flutter();
      await tween(R(190), e => tr.set(fwd ? e : 1 - e), fwd ? ease.in : ease.out);
      tr.end();
      if (fwd){ pageEl(p).hidden = true; tab(p + 1); } else tab(p);
    })));
    cur = to; stackPages();
    Snd.flap(); Foil.thud(.3); Haptic.tick(10);
    landed(cur);
    mode = 'open';
  }
  const range = (a, b) => Array.from({ length:b - a }, (_, i) => a + i);

  /* ---------------- a card in its place ---------------- */
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
  const sleeveOf = slot => slot.querySelector('.cb-sleeve');
  // how far out of its place the card is (v: 0 home, 1 a whole card
  // height), nudged sideways and turned
  function setOut(slot, v, x = 0, r = 0){
    const f = faceOf(slot);
    f.dataset.out = v;
    f.style.translate = v || x ? `${Math.round(x)}px ${Math.round(-v * slot.clientHeight)}px` : '';
    f.style.rotate = r ? `${r.toFixed(1)}deg` : '';
  }
  const outOf = slot => parseFloat(faceOf(slot).dataset.out || 0);
  function flash(slot, cls, ms){
    const s = sleeveOf(slot); if (!s) return;
    s.classList.remove(cls); void s.offsetWidth; s.classList.add(cls);
    setTimeout(() => s.classList.remove(cls), ms);
  }
  function glint(slot){
    const g = document.createElement('i');
    g.className = 'cb-glint';
    faceOf(slot).append(g);
    setTimeout(() => g.remove(), 320);
  }
  // out of the sleeve: it catches, slides up in steps with a wobble as the
  // plastic flexes, and the last bit pops free with a glint. Corners: it
  // just lifts out of them
  async function pullOut(slot, to = .62, quick = false){
    if (!opt.sleeves){ await tween(R(110), e => setOut(slot, mix(0, .06, e)), ease.out); return; }
    setOut(slot, .02); Snd.tick(); Haptic.tick(6);
    await wait(R(quick ? 40 : 80));
    sleeveOf(slot).classList.add('is-flex');
    Snd.shhk(true);
    const n = quick ? 4 : 6;
    for (let i = 1; i <= n; i++){
      setOut(slot, mix(.02, to - .1, ease.inOut(i / n)), i % 2 ? 1 : -1, (i % 2 ? .6 : -.6));
      await wait(R(quick ? 28 : 40));
    }
    setOut(slot, to);
    sleeveOf(slot).classList.remove('is-flex');
    flash(slot, 'is-flash', 160); glint(slot);
    Haptic.tick(8);
    await wait(R(50));
  }
  // back in: it arrives tilted, catches the sleeve's mouth (which opens),
  // slides down in steps and tucks home with a snap; the sheen settles
  async function tuckIn(slot, from = .62){
    if (!opt.sleeves){
      await tween(R(150), e => setOut(slot, mix(outOf(slot), 0, e)), ease.in);
      setOut(slot, 0); S.cardLanded(); Haptic.tick(6);
      return;
    }
    const s = sleeveOf(slot);
    setOut(slot, from, 0, 4);
    s.classList.add('is-open');
    await wait(R(60));
    Snd.shhk(false);
    const n = 6;
    for (let i = 1; i <= n; i++){
      setOut(slot, mix(from, .08, ease.inOut(i / n)), i % 2 ? -1 : 1, mix(4, 0, i / n));
      await wait(R(38));
    }
    setOut(slot, 0);
    s.classList.remove('is-open');
    Foil.thud(.2); Snd.tick(); Haptic.tick(8);
    flash(slot, 'is-settle', 280);
  }
  // a used-up card won't come out: it lifts, shakes and drops back
  async function refuse(slot){
    Foil.thud(.35); Haptic.tick(10);
    for (const x of [2, -2, 2, -1, 0]){ setOut(slot, x ? .025 : 0, x); await wait(R(40)); }
    setOut(slot, 0);
  }
  // the inspect screen: through the cards on this page; with sleeves the
  // card comes out of its sleeve first and is tucked back after. Flicked
  // up, it goes to the reader
  async function takeOut(slot){
    mode = 'moving';
    const slots = [...pageEl(cur).querySelectorAll('.cb-slot:not(.is-empty)')].filter(s => s !== fedSlot);
    await pullOut(slot);
    // open from a task of its own, so its card is posed before the next paint
    await new Promise(r => setTimeout(r, 0));
    let sent = false;
    mode = 'open';
    CardInspect.open({
      items:slots.map(s => ({ card:entry(s).card, source:() => faceOf(s), slot:s })),
      index:slots.indexOf(slot),
      swipeUp:async (item, idx, api) => {
        if (entry(item.slot).state !== 'have') return api.close();
        if (CareerMain.fed?.album) await CareerMain.unfeed();
        if (CareerMain.fed || CareerMain.busy) return api.close();
        sent = true;
        const m = CareerMain.lip(), f = CareerMain.feltEl.getBoundingClientRect(), s = CareerMain.scale;
        const c = CardInspect.make(fstage, item.card, { side:'face' });
        c.body.set({ x:m.x, y:m.y + CH * s / 2 + 2, s, r:0, z:0, sx:1, sy:1, alpha:1 });
        c.body.render(performance.now());
        c.el.style.visibility = 'hidden';
        await api.sendTo({ x:f.left + m.x, y:f.top + m.y + CH * s / 2 + 2, s, r:0, z:0 });
        c.el.style.visibility = '';
        hideFace(item.slot);
        if (item.slot !== slot) setOut(slot, 0);
        feedIn(item.slot, c, true);
      },
      onClose:async at => {
        unlight();
        if (sent) return;
        const back = slots[at];
        if (back !== slot){ setOut(slot, 0); setOut(back, opt.sleeves ? .62 : .06); }
        mode = 'moving';
        await tuckIn(back);
        mode = 'open';
      }
    });
  }

  /* ---------------- into the reader ---------------- */
  const hideFace = slot => { faceOf(slot).style.visibility = 'hidden'; };
  const showFace = slot => { faceOf(slot).style.visibility = ''; };
  // a slot's card as a pose on the feed stage, v out of its place
  function slotPose(slot, v = 0, r = 0){
    const sr = slot.getBoundingClientRect(), fr = fstage.el.getBoundingClientRect();
    return { x:sr.left + sr.width / 2 - fr.left, y:sr.top + sr.height / 2 - fr.top - v * sr.height, s:sr.width / CW, r, z:0, sx:1, sy:1, alpha:1 };
  }
  function nearReader(cx, cy){
    const m = CareerMain.mouthEl.getBoundingClientRect();
    return cx > m.left - 30 && cx < m.right + 30 && cy < m.bottom + 60;
  }
  function feedIn(slot, c, placed = false){
    fedSlot = slot;
    return CareerMain.feedOther(c, entry(slot).card, {
      album:true,
      back:t => { flyHome(slot, t.c); },
      beforePlay:async () => { await putAway(); },
      afterPlay:() => played(slot),
      // the preview plays it for real: the book just lets go of it
      linkPlayed:() => { fedSlot = null; fstage.el.classList.remove('is-out'); }
    }, { placed }).then(setKeys);
  }
  // out of the reader and home: it flies down to its sleeve and is tucked in
  let homing = Promise.resolve();
  function flyHome(slot, c){ return (homing = home(slot, c)); }
  async function home(slot, c){
    fedSlot = null;
    setKeys();
    c.el.style.clipPath = '';
    S.cardReturn(); Foil.flutter();
    await glide(c.body, slotPose(slot, opt.sleeves ? .62 : .06, 4), R(320), { arc:24, easing:ease.out });
    c.body.remove();
    setOut(slot, opt.sleeves ? .62 : .06, 0, 4);
    showFace(slot);
    await tuckIn(slot);
  }
  // PLAY: it's used up; the screen wheels round to the table
  async function played(slot){
    const x = entry(slot);
    x.state = 'used';
    slot.classList.remove('is-have'); slot.classList.add('is-used');
    setOut(slot, 0); showFace(slot);
    fedSlot = null;
    fstage.el.classList.remove('is-out');
    await wheelToTable();
  }

  /* ---------------- the wheel round to the table (lab) ---------------- */
  async function wheelToTable(){
    const app = document.getElementById('app'), home = document.getElementById('home'), table = document.getElementById('table-screen');
    if (typeof machineWheelRig !== 'function' || !app || !table){ CareerMain.keys(); return; }
    const P = MACHINE_WHEEL_CONFIG.profiles.table;
    const rig = machineWheelRig(app, { z:{ back:47, face:50, front:56 } });
    let ready = false;
    // the real hand-off isn't wired: tap the table to come back
    const back = async () => {
      if (!ready) return;
      ready = false;
      table.removeEventListener('pointerdown', back, true);
      const B = MACHINE_WHEEL_CONFIG.profiles.back, rig2 = machineWheelRig(app, { z:{ back:47, face:50, front:56 } });
      try {
        home.style.visibility = '';
        rig2.claim(table, 0);
        await rig2.release(table, B);
        rig2.park(home, .72);
        await rig2.roll(table, home, B);
        await rig2.lock(home, B);
      } finally {
        rig2.destroy();
        table.classList.add('hidden');
        CareerMain.keys();
      }
    };
    table.addEventListener('pointerdown', back, true);
    home.inert = true;
    try {
      rig.claim(home, 0);
      await rig.release(home, P);
      rig.park(table, .72);
      table.classList.remove('hidden'); table.inert = true;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await rig.roll(home, table, P);
      await rig.lock(table, P);
    } finally {
      rig.destroy();
      home.inert = false; table.inert = false;
      home.style.visibility = 'hidden';
    }
    ready = true;
  }

  /* ---------------- touch ---------------- */
  let ptr = null;
  function down(e){
    if (ptr || mode === 'moving' || mode === 'away' || CardInspect.isOpen) return;
    Snd.unlock();
    const what = mode === 'closed' ? 'cover' : e.target.closest('.cb-turn') ? 'turn' : e.target.closest('.cb-tab') ? 'tab' : e.target.closest('.cb-block') ? 'page' : null;
    if (!what) return;
    const now = performance.now(), slot = what === 'page' ? e.target.closest('.cb-slot') : null;
    ptr = { id:e.pointerId, x:e.clientX, y:e.clientY, cx:e.clientX, cy:e.clientY, t:now, what, el:e.target, drag:null, vx:0, lx:e.clientX, lt:now };
    layer.setPointerCapture?.(e.pointerId);
    // a card held: it comes out into your fingers
    if (slot && !slot.classList.contains('is-empty') && slot !== fedSlot){
      const me = ptr;
      ptr.timer = setTimeout(() => { if (ptr === me && !me.drag) hold(me, slot); }, 320);
    }
  }
  async function hold(p, slot){
    p.held = { slot, ready:false };
    unlight();
    if (entry(slot).state !== 'have'){ p.held = null; p.done = true; return refuse(slot); }
    mode = 'moving';
    book.classList.add('is-dim');
    await pullOut(slot, .62, true);
    // now a card in your hand, on the stage over the book
    const c = CardInspect.make(fstage, entry(slot).card, { side:'face' });
    const at = slotPose(slot, .62);
    c.body.set({ ...at, z:10 });
    c.body.render(performance.now());
    hideFace(slot); setOut(slot, 0);
    Foil.flutter(); Haptic.tick(10);
    const fr = fstage.el.getBoundingClientRect();
    p.held = { slot, c, dx:at.x - (p.cx - fr.left), dy:at.y - (p.cy - fr.top), ready:true };
    if (p.ended) return release(p);
    carry(p);
  }
  function carry(p){
    const h = p.held, fr = fstage.el.getBoundingClientRect();
    h.c.body.set({ x:p.cx - fr.left + h.dx, y:p.cy - fr.top + h.dy, r:clamp((p.vx || 0) * 6, -10, 10) });
    CareerMain.slotEl.classList.toggle('is-near', nearReader(p.cx, p.cy));
  }
  async function release(p){
    const { slot, c } = p.held;
    CareerMain.slotEl.classList.remove('is-near');
    book.classList.remove('is-dim');
    if (!p.cancel && nearReader(p.cx, p.cy)){
      // a swap: the card in the reader goes home first
      if (CareerMain.fed?.album) await CareerMain.unfeed();
      if (!CareerMain.fed && !CareerMain.busy){ mode = 'open'; await feedIn(slot, c); return; }
    }
    await flyHome(slot, c);
    mode = 'open';
  }
  function move(e){
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, now = performance.now();
    ptr.vx = (e.clientX - ptr.lx) / Math.max(1, now - ptr.lt); ptr.lx = e.clientX; ptr.lt = now;
    ptr.cx = e.clientX; ptr.cy = e.clientY;
    if (ptr.held){ if (ptr.held.ready) carry(ptr); return; }
    if (ptr.done) return;
    if (!ptr.drag){
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimeout(ptr.timer);
      if (Math.abs(dx) < Math.abs(dy)) return;
      if (ptr.what === 'cover' && dx < 0) ptr.drag = 'cover';
      else if (ptr.what === 'page' && dx < 0 && cur < PAGES - 1){ ptr.drag = 'next'; ptr.tr = turner(cur); }
      else if (ptr.what === 'page' && dx > 0 && cur > 0){ ptr.drag = 'back'; ptr.tr = turner(cur - 1); }
      else return;
      unlight();
      if (ptr.drag !== 'cover') Foil.rustle(.2);
    }
    const W = leavesEl.clientWidth * .85;
    if (ptr.drag === 'cover'){ ptr.v = clamp(-dx / W, 0, 1); coverAt(-90 * ptr.v); }
    else if (ptr.drag === 'next'){ ptr.v = clamp(-dx / W, 0, 1); ptr.tr.set(ptr.v); }
    else { ptr.v = clamp(1 - dx / W, 0, 1); ptr.tr.set(ptr.v); }
  }
  function up(e, cancel){
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = ptr; ptr = null;
    clearTimeout(p.timer);
    p.cancel = !!cancel;
    if (p.held){ p.ended = true; if (p.held.ready) release(p); return; }
    if (p.done) return;
    if (p.drag){
      // past halfway, or flicked, it goes; otherwise it drops back
      const v = p.v || 0;
      if (p.drag === 'cover'){
        if (!cancel && (v > .45 || p.vx < -.6)) openCover(v);
        else tween(160 * v + 20, e2 => coverAt(-90 * v * (1 - e2)), ease.out);
      }
      else if (p.drag === 'next') finishTurn(p.tr, cur, v, !cancel && (v > .45 || p.vx < -.6));
      else finishTurn(p.tr, cur - 1, v, cancel || !(v < .55 || p.vx > .6));
      return;
    }
    if (cancel || performance.now() - p.t > 600) return;
    // a tap
    if (p.what === 'cover') return openCover();
    if (p.what === 'turn') return tapTurn(p.el.closest('.cb-turn').classList.contains('is-next') ? 1 : -1);
    if (p.what === 'tab') return riffle(+p.el.closest('.cb-tab').dataset.p);
    const slot = p.el.closest('.cb-slot');
    if (!slot || slot.classList.contains('is-empty') || slot === fedSlot) return unlight();
    if (lit === slot) takeOut(slot); else light(slot);
  }

  window.CareerAlbum = {
    toggle,
    get out(){ return mode !== 'away'; },
    // read-only, for the lab's checks
    get state(){ return { mode, page:cur, lit:lit ? +lit.dataset.i : null, fed:fedSlot ? +fedSlot.dataset.p * 10 + +fedSlot.dataset.i : null, ...opt }; }
  };
  function start(){
    if (window.CareerMain && document.querySelector('#cm .cm-felt')) build();
    else if (window.CareerLink) document.addEventListener('career-hub-built', () => requestAnimationFrame(start), { once:true });
    else requestAnimationFrame(start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
