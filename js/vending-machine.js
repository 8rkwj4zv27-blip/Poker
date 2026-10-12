/* ============================================================
   THE PACKET MACHINE — Career's shop as a vending machine (lab only).

   The owner's design (11 Oct, docs/career/VENDING_PLAN.md). SHOP on the
   hub: the space under the reel turns like the game's drum, a tooth at a
   time, and the machine rolls down and locks; its tube flickers on and
   the keys light row by row. Built like the Player Dashboard: one moulded
   frame, the checker case, sunk bays.
   - Choose: tap a packet to look at it: its key glows, the credit CRT
     shows its edition and price, the four lamps its chances (lit: always,
     blinking: maybe, dark: never). Tap it again (or its cream key) to put
     one in (the key's window shows how many). CLEAR empties it.
   - Pay: hold the green key. The chips leave the reel in a stream, the
     table's own 2.5D chips: each comes over and down, turning up onto its
     edge as it reaches the slot, pushes into the slit and goes in with a
     CHUNK, the next one already on its way.
   - Drop: a relay clicks, the key blinks, the motor hums; the packet tips
     off its shelf and falls the whole way, past the rows below, into the
     tray behind the ribbed PUSH flap, where it lands on the bottom (or on
     the ones already there), bounces and lies where it lands. The spare behind slides forward. Now and then one
     sticks: the glass shimmers; tap the machine (twice) to knock it free.
   - Take: tap PUSH (or the key): the flap swings in, a packet comes out
     to you; turn it, shake it; flick it down to send it to the hub.
   - Back on the hub (SHOP again): the packets you sent drop onto the felt
     in a pile, at the table's size; tap one and it's opened there with the
     pack opening (js/pack-opening.js, embedded). Its chips come out in a
     clear bag with the amount on it. The four cards are laid down among
     the others; the empty wrapper and the torn strip stay on the felt.
   - Things on the felt: pick them up, slide them, throw them (off the
     edge and they're gone). Drag across the bag's top corner to snip it:
     the chips spill out onto the felt; tap one and it bounces. The hub's
     clean-up spot clears the lot: the cards into the deck, the chips (and
     any bag still shut) into the bankroll, the rubbish away.
   Lab money, nothing saved.
   ============================================================ */
window.PO_EMBED = true;
(() => {
  'use strict';
  const { clamp, mix, snap, ease, tween, wait, glide, squash, puff, jolt, every, S, Foil, Haptic } = PO;
  const { Packet, AW, AH } = POPacket;
  // the editions (placeholders): price, and chances for C, UC, R, L
  // (s: always, f: maybe, o: never)
  const ED = {
    alley:{ name:'ALLEY', price:50, odds:'sfoo' }, house:{ name:'HOUSE', price:100, odds:'sffo' },
    pub:{ name:'PUB', price:150, odds:'ssfo' }, club:{ name:'CLUB', price:300, odds:'ssff' },
    wild:{ name:'WILD', price:500, odds:'fsff' }, casino:{ name:'CASINO', price:750, odds:'fssf' },
    reserve:{ name:'RESERVE', price:1000, odds:'ossf' }, highroller:{ name:'HI-ROLLER', price:2500, odds:'ofss' }
  };
  const RAR = [['common', 'C'], ['uncommon', 'UC'], ['rare', 'R'], ['legendary', 'L']];
  // the window, top row first; null is a sold-out column
  const GRID = {
    4:['highroller', 'casino', 'reserve', null, 'club', 'wild', 'club', 'pub', 'house', 'pub', 'alley', 'house', 'house', 'club', 'alley', 'house'],
    5:['highroller', 'reserve', 'casino', 'wild', null, 'club', 'pub', 'club', 'wild', 'club', 'house', 'alley', 'pub', 'house', 'pub', 'house', 'club', 'alley', 'house', 'alley']
  };
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const saved = host ? host.state : {};
  const look = { cols:+saved.cols === 5 ? 5 : 4, rows:+saved.rows === 3 ? 3 : 4, paint:saved.paint !== 'off', stuck:['never', 'sometimes', 'next'].includes(saved.stuck) ? saved.stuck : 'sometimes' };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // what's in each edition's bag of chips (placeholders)
  const BAG = { alley:20, house:40, pub:50, club:75, wild:100, casino:120, reserve:150, highroller:300 };

  let M, E, root, drum, vm, chipsEl, handEl, pileEl, openEl;
  let G = null;          // the window's geometry
  let slots = [], order = [], tray = [], pile = [], sent = 0;
  let mode = 'hub';      // hub · rolling · idle · paying · dispensing · stuck · taking · opening
  let shown = null;      // the edition the CRT is showing
  let sel = null;        // the slot you're looking at (its key glows)
  let inHand = null;     // the packet out of the tray, in your hand
  let knocks = 0, stuckP = null, freed = null;
  const $ = q => root.querySelector(q);
  const vq = q => vm.querySelector(q);
  const stageOf = el => ({ el, shadows:el.querySelector('.po-shadows'), objects:el.querySelector('.po-objects'), fx:el.querySelector('.po-fx') });
  const STAGE = '<div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>';
  function rel(el, to = root){ const a = el.getBoundingClientRect(), r = to.getBoundingClientRect(); return { x:a.left - r.left, y:a.top - r.top, w:a.width, h:a.height }; }

  /* ---------------- the hub's screens and keys ---------------- */
  function hubCrt(side, cap, fig, ink){
    const box = $('.cm-crt-' + side); if (!box) return;
    const size = fig.length <= 5 ? ' crt-figure--lg' : fig.length > 8 ? ' vm-fig-sm' : '';
    box.innerHTML = `<div class="crt cm-crt is-pair"${ink ? ` data-ink="${ink}"` : ''}><span class="crt-caption">${cap}</span><span class="crt-figure${size}">${fig}</span></div>`;
  }
  // the hub owns its screens unless packets are waiting (or one's open)
  function screens(){
    if (mode === 'opening') return true;
    if (mode !== 'hub' || !pile.length) return false;
    hubCrt('l', 'IN HAND', String(M.cards)); hubCrt('r', 'WAITING', String(pile.length), 'live');
    return true;
  }
  function midKey(label, on = true){
    const b = M.keyEl('play');
    b.textContent = label; b.disabled = !on;
    b.classList.toggle('vm-long', label.length > 9);
  }
  function keys(){
    const shop = M.keyEl('shop'), cards = M.keyEl('cards'), down = mode !== 'hub' && mode !== 'opening';
    shop.classList.toggle('is-pressed', down); shop.classList.toggle('vm-latched', down);
    shop.disabled = mode === 'rolling' || mode === 'opening' || mode === 'paying' || mode === 'dispensing' || mode === 'stuck';
    cards.disabled = mode !== 'hub';
    if (mode === 'hub'){ midKey('PLAY'); return; }
    if (mode === 'idle'){
      if (tray.length && !order.length) midKey('TAKE');
      else midKey(order.length ? 'HOLD TO BUY' : 'PICK ONE', order.length > 0);
    }
    if (mode === 'paying' || mode === 'dispensing' || mode === 'stuck' || mode === 'rolling') midKey('…', false);
    if (mode === 'taking') midKey('SEND');
  }
  // the hub asks first: while the machine is down (or a packet's open) the keys are ours
  function key(k){
    if (k === 'shop'){ if (mode === 'hub') rollIn(); else if (mode === 'idle' || mode === 'taking') rollOut(); return true; }
    if (mode === 'hub') return false;
    if (k === 'play' && mode === 'idle' && tray.length && !order.length){ take(); return true; }
    if (k === 'play' && mode === 'taking'){ send(0, 1.2); return true; }
    return true;   // HOLD TO BUY and the opening's key are held, not clicked (see build)
  }

  /* ---------------- the machine: build ---------------- */
  function build(){
    root = M.root;
    drum = document.createElement('div'); drum.className = 'vm-drum'; drum.hidden = true;
    drum.innerHTML = `<section class="vm is-off" data-theme="burgundy" aria-label="The packet machine"><div class="vm-case">
      <div class="vm-front">
        <div class="vm-bay vm-window">
          <div class="vm-back"></div><i class="vm-tube"></i>
          <div class="vm-stage vm-show">${STAGE}</div>
          <div class="vm-rails"></div>
          <div class="vm-stage vm-fall">${STAGE}</div>
          <div class="vm-glass"></div><div class="vm-shimmer"></div>
          <div class="vm-paint">CARD PACKETS</div>
        </div>
        <div class="vm-bay vm-tray">
          <div class="vm-stage vm-floor">${STAGE}</div>
          <div class="vm-stage vm-tfall">${STAGE}</div>
          <button class="vm-flap" type="button" aria-label="Push: take your packets"><b>PUSH</b></button>
        </div>
      </div>
      <aside class="vm-side">
        <div class="vm-bay"><div class="crt vm-crt"></div></div>
        <div class="vm-bay vm-slot"><div class="vm-plate"><i class="vm-ring"></i><i class="vm-slit"></i></div></div>
        <div class="vm-bay vm-lamps">${RAR.map(([r, c]) => `<div class="vm-lamp-row" data-r="${r}"><i class="vm-lamp"></i><span>${c}</span></div>`).join('')}</div>
        <button class="vm-clear" type="button">CLEAR</button>
        <div class="vm-bay vm-grille"><i></i></div>
      </aside>
    </div></section>`;
    chipsEl = document.createElement('div'); chipsEl.className = 'vm-chips';
    handEl = document.createElement('div'); handEl.className = 'vm-hand';
    handEl.innerHTML = `<i class="vm-dim"></i><div class="vm-stage">${STAGE}</div>`;
    pileEl = document.createElement('div'); pileEl.className = 'vm-pile';
    pileEl.innerHTML = `<div class="vm-stage">${STAGE}</div>`;
    openEl = document.createElement('section'); openEl.className = 'vm-open'; openEl.innerHTML = STAGE;
    root.append(drum, chipsEl, handEl, pileEl, openEl);
    vm = drum.querySelector('.vm');
    vm.addEventListener('pointerdown', vmDown);
    vq('.vm-clear').addEventListener('pointerdown', () => { vq('.vm-clear').classList.add('is-down'); clearAll(); setTimeout(() => vq('.vm-clear').classList.remove('is-down'), 120); });
    vq('.vm-flap').addEventListener('click', () => { if (mode === 'idle' && tray.length) take(); });
    handEl.addEventListener('pointerdown', handDown);
    handEl.addEventListener('pointermove', handMove);
    handEl.addEventListener('pointerup', e => handUp(e, false));
    handEl.addEventListener('pointercancel', e => handUp(e, true));
    pileEl.addEventListener('pointerdown', pileDown);
    // the green key: hold to buy here; the opening's key on the hub
    const k = M.keyEl('play');
    k.addEventListener('pointerdown', e => {
      if (mode === 'opening'){ try { k.setPointerCapture(e.pointerId); } catch (_) {} E.keyDown(); return; }
      if (mode === 'idle' && order.length){ try { k.setPointerCapture(e.pointerId); } catch (_) {} holdBuy(); }
    });
    k.addEventListener('pointerup', () => { if (mode === 'opening') E.keyUp(); else letGo(); });
    k.addEventListener('pointercancel', () => { if (mode === 'opening') E.keyCancel(); else letGo(); });
    attachOpening();
  }

  /* ---------------- layout ---------------- */
  // the drum: from the top of the cabinet's screen row to the foot of the felt
  // (measured where the hub's faces sit, not where the roll has pushed them)
  function unmoved(el){
    const r = rel(el), t = /(-?[\d.]+)px$/.exec(el.style.translate || '');
    if (t) r.y -= +t[1];
    return r;
  }
  function region(){
    const row = unmoved($('.cm-row')), cab = rel($('.cm-cabinet')), felt = unmoved($('.cm-felt'));
    return { x:cab.x, y:row.y - 4, w:cab.w, h:felt.y + felt.h + 6 - (row.y - 4) };
  }
  function layout(){
    const r = region();
    Object.assign(drum.style, { left:r.x + 'px', top:r.y + 'px', width:r.w + 'px', height:r.h + 'px' });
    const con = rel($('.cm-console'));
    Object.assign(handEl.style, { left:'0', top:'0', width:'100%', height:Math.round(con.y - 4) + 'px' });
    const f = unmoved($('.cm-felt'));
    Object.assign(openEl.style, { left:f.x + 'px', top:f.y + 'px', width:f.w + 'px', height:f.h + 'px' });
    vm.classList.toggle('is-compact', r.h < 520);
    vm.classList.toggle('no-paint', !look.paint);
    vm.style.setProperty('--vm-side', (r.w < 380 ? 76 : 86) + 'px');
    if (mode === 'hub') return;
    sizeWindow();
  }
  function sizeWindow(){
    const win = vq('.vm-window'), tr = vq('.vm-tray');
    const front = vq('.vm-front'), W = win.clientWidth, Hf = front.clientHeight, C = look.cols;
    const compact = vm.classList.contains('is-compact');
    const P = look.paint ? 32 : 14, RL = 22, gap = 7, trayMin = compact ? 60 : 84, trayMax = compact ? 84 : 116;
    const avail = Hf - gap - P - 6;
    let R = look.rows, k;
    const colW = W / C;
    for (;;){
      k = Math.min(.72, (colW - 6) / AW, ((avail - trayMin) / R - RL - 10) / AH);
      if (k >= .36 || R <= 2) break;
      R--;
    }
    // the tray takes what's left, up to a point; the shelves share the rest
    const need = AH * k + 10 + RL, trayH = clamp(avail - need * R, trayMin, trayMax);
    const rowH = Math.floor((avail - trayH) / R);
    win.style.height = (P + rowH * R + 6) + 'px';
    vm.style.setProperty('--vm-paint', clamp(Math.floor(W / 14), 12, 19) + 'px');
    vm.style.setProperty('--vm-tag', (colW < 64 ? 6 : 7) + 'px');
    vm.style.setProperty('--vm-key', (colW < 56 ? 15 : colW < 64 ? 18 : 22) + 'px');
    const before = G && G.k === k && G.R === R && G.C === C && Math.abs(G.W - W) < 1;
    G = { W, C, R, k, rowH, P, RL, colW, trayH:tr.clientHeight };
    if (!before) stock();
    sizeTray();
  }
  function sizeTray(){
    const tr = vq('.vm-tray');
    G.trayH = tr.clientHeight - 4; G.trayW = tr.clientWidth - 4;
  }
  // where a packet comes to rest in the tray: on the bottom, or on the
  // ones already lying there (seen straight on, as it is)
  function restFor(x, r){
    const s = G.k * .94, a = r * Math.PI / 180, w = AW * s, h = AH * s;
    const ex = (w * Math.abs(Math.cos(a)) + h * Math.abs(Math.sin(a))) / 2, ey = (w * Math.abs(Math.sin(a)) + h * Math.abs(Math.cos(a))) / 2;
    x = clamp(x, ex + 2, G.trayW - ex - 2);
    let bottom = G.trayH - 3;
    tray.forEach(q => { if (Math.abs(q.body.x - x) < ex + q.ex * .6) bottom = Math.min(bottom, q.body.y - q.ey * .3); });
    return { x, y:Math.max(bottom - ey, ey + 2), r, s, ex, ey };
  }
  // mostly lying down; now and then one leans
  const restAngle = () => (Math.random() < .78 ? rr(70, 100) : rr(28, 50)) * pick([-1, 1]);
  const slotX = s => G.colW * (s.c + .5);
  const shelfY = s => G.P + G.rowH * (s.r + 1) - G.RL;
  const frontPose = s => ({ x:slotX(s), y:shelfY(s) - AH * G.k / 2 + 2, s:G.k, r:[-1, 0, 1, 0, -1][s.c] || 0, z:0, sx:1, sy:1, alpha:1 });
  const sparePose = s => ({ x:slotX(s) + 4, y:shelfY(s) - AH * G.k / 2 - 1, s:G.k * .97, r:0, z:0, sx:1, sy:1, alpha:1 });

  /* ---------------- stocking the window ---------------- */
  function packet(stage, series, pose, { spare = false } = {}){
    const p = new Packet(stage, series, 0);
    p.tagEl.hidden = true;
    p.el.classList.add('vm-packet');
    p.body.set({ z:0, sx:1, sy:1, ...pose });
    p.body.render(performance.now());   // in place from its first frame
    if (spare) dim(p, .42);
    return p;
  }
  function dim(p, v){ p.el.querySelectorAll('canvas').forEach(c => { c.style.filter = v >= 1 ? '' : `brightness(${v})`; }); }
  function stock(){
    slots.forEach(s => { s.p?.body.remove(); s.spare?.body.remove(); });
    const show = stageOf(vq('.vm-show')), ids = GRID[G.C].slice(0, G.C * G.R);
    slots = ids.map((id, i) => ({ i, id, r:Math.floor(i / G.C), c:i % G.C, count:0 }));
    vq('.vm-rails').innerHTML = Array.from({ length:G.R }, (_, r) => `<div class="vm-rail" style="top:${G.P + G.rowH * (r + 1) - G.RL}px;height:${G.RL}px;grid-template-columns:repeat(${G.C},1fr)">${
      slots.filter(s => s.r === r).map(s => `<span class="vm-cell"><span class="vm-tag">${s.id ? (G.colW < 62 ? String(ED[s.id].price) : ED[s.id].price.toLocaleString('en-US')) : '—'}</span><span class="vm-key${s.id ? '' : ' is-out'}" data-i="${s.i}"><b>${s.id ? '' : '×'}</b></span></span>`).join('')}</div>`).join('');
    slots.forEach(s => {
      s.keyEl = vq(`.vm-key[data-i="${s.i}"]`);
      if (!s.id) return;
      s.spare = packet(show, s.id, sparePose(s), { spare:true });
      s.p = packet(show, s.id, frontPose(s));
      s.p.el.dataset.i = s.i;
    });
    order = []; slots.forEach(s => mark(s));
  }

  /* ---------------- the credit screen and the lamps ---------------- */
  const total = () => order.reduce((a, s) => a + ED[s.id].price, 0);
  function crt(cap, fig, line, ink){
    const c = vq('.vm-crt');
    c.dataset.ink = ink || '';
    c.innerHTML = `<span class="crt-caption">${cap}</span><span class="crt-figure${fig.length > 5 ? ' vm-fig-sm' : ''}">${fig}</span><span class="vm-total">${line || ''}</span>`;
  }
  // the window reads at a glance: the one you're looking at lit up, the
  // ones you can't afford (with what's in the basket) dimmed
  function shade(){
    const left = M.wallet - total();
    slots.forEach(s => {
      if (!s.p) return;
      const dear = mode !== 'paying' && mode !== 'dispensing' && mode !== 'stuck' && ED[s.id].price > left && !s.count;
      s.p.el.classList.toggle('is-lit', sel === s);
      s.p.el.classList.toggle('is-dear', dear && sel !== s);
      s.keyEl?.parentNode.classList.toggle('is-dear', dear);
    });
  }
  function panel(){
    shade();
    if (mode === 'paying') return;
    if (!shown){ crt('PICK A', 'PACKET', order.length ? 'TOTAL ' + money(total()) : (tray.length ? tray.length + ' IN TRAY' : '')); lamps(null); return; }
    const d = ED[shown];
    crt(d.name, money(d.price), order.length ? 'TOTAL ' + money(total()) : '', 'money');
    lamps(d.odds);
  }
  // the lamps change with a relay: dark for a frame, then the new state
  let lampT = 0;
  function lamps(odds){
    const rows = [...vm.querySelectorAll('.vm-lamp')];
    rows.forEach(l => { l.className = 'vm-lamp'; });
    clearTimeout(lampT);
    if (!odds) return;
    lampT = setTimeout(() => rows.forEach((l, i) => { const o = odds[i]; l.className = 'vm-lamp' + (o === 's' ? ' is-steady' : o === 'f' ? ' is-flicker' : ''); }), 70);
  }
  function mark(s){
    if (!s.id || !s.keyEl) return;
    s.keyEl.classList.toggle('is-on', s.count > 0);
    s.keyEl.querySelector('b').textContent = s.count ? String(s.count) : '';
  }
  // the number in the key's window flips over
  function flip(s){
    s.keyEl.classList.add('is-flip');
    setTimeout(() => { mark(s); s.keyEl.classList.remove('is-flip'); }, 55);
  }

  /* ---------------- choosing ---------------- */
  // a packet: the first tap looks at it, the next puts one in; a key puts one in
  function choose(s, add){
    if (mode !== 'idle' || !s) return;
    if (!s.id){ S.wheelRelay(.4); Foil.thud(.25); Haptic.tick(6); jolt(s.keyEl, 1); return; }
    if (!add && sel !== s){ peek(s); return; }
    if (s.count >= 9){ Foil.thud(.3); return; }
    if (sel !== s) peek(s, true);
    s.count++; order.push(s);
    S.counterTick(true); Haptic.tick(8);
    flip(s);
    hop(s, 1.05);
    panel(); keys();
  }
  // looked at: its key glows, the screen and the lamps show it
  function peek(s, quiet){
    sel?.keyEl.classList.remove('is-sel');
    sel = s; shown = s.id;
    s.keyEl.classList.add('is-sel');
    if (!quiet){ S.counterTick(false); Haptic.tick(5); hop(s, 1.025); panel(); }
  }
  function unpeek(){ sel?.keyEl.classList.remove('is-sel'); sel = null; shown = null; }
  // the packet answers: a little hop forward
  function hop(s, k){
    const b = s.p.body, f = frontPose(s);
    glide(b, { z:5 * (k - 1) / .05, s:G.k * k }, 70, { easing:ease.out }).then(() => glide(b, { z:0, s:f.s }, 110, { easing:ease.in })).then(() => squash(b, .05, 140));
  }
  function clearAll(){
    if (mode !== 'idle') return;
    if (!order.length){ unpeek(); panel(); return; }
    S.wheelRelay(.6); Haptic.tick(10);
    const lit = slots.filter(s => s.count);
    order = []; unpeek();
    lit.forEach((s, i) => setTimeout(() => { s.count = 0; flip(s); S.counterTick(false); }, i * 45));
    panel(); keys();
  }

  /* ---------------- paying: chips into the slot ---------------- */
  let holdT = 0;
  function holdBuy(){
    clearTimeout(holdT);
    M.keyEl('play').classList.add('is-ready');
    holdT = setTimeout(buy, 420);
  }
  function letGo(){ clearTimeout(holdT); M.keyEl('play').classList.remove('is-ready'); }
  async function buy(){
    M.keyEl('play').classList.remove('is-ready');
    if (mode !== 'idle' || !order.length) return;
    const due = total();
    if (due > M.wallet){
      crt('SHORT', money(due - M.wallet), 'TOTAL ' + money(due), 'danger');
      Foil.thud(.5); Haptic.tick(20, 0); jolt(vq('.vm-crt'), 2);
      setTimeout(panel, 1400);
      return;
    }
    mode = 'paying'; keys();
    await payChips(due);
    mode = 'dispensing'; keys();
    await dispenseAll();
    mode = 'idle'; unpeek();
    panel(); keys();
  }
  // how many chips, and of what colour, make the price
  function chipsFor(due){
    const n = clamp(Math.round(Math.sqrt(due / 22)), 2, 9);
    const each = due / n, tier = each < 40 ? 't0' : each < 120 ? 't1' : each < 400 ? 't2' : 't3';
    return Array.from({ length:n }, () => tier);
  }
  // the chips go in as a stream: each leaves the reel so it reaches the
  // slot just as the one before has gone in
  async function payChips(due){
    const cols = chipsFor(due), from = M.wallet, n = cols.length;
    const reel = rel(M.reelEl), slit = vq('.vm-slit');
    const gap = PO.reduced ? 0 : 300;
    let went = 0;
    crt('PAID', money(0), 'OF ' + money(due), 'money');
    await Promise.all(cols.map((col, i) => wait(i * gap).then(() => feed(col, reel, slit, i)).then(() => {
      went++;
      const paid = went === n ? due : Math.round(due * went / n / 5) * 5;
      M.showBank(from - paid);
      crt('PAID', money(paid), 'OF ' + money(due), 'money');
      S.counterTick(true);
    })));
    M.wallet = from - due;
    S.counterLock(true);
    await wait(160);
  }
  // a chip: the table's own sprite; tilt 0 shows its whole face, 5 its edge
  function chipEl(col, d){
    const f = CoinWorld.frames(col, d), h = Math.round(d * CoinWorld.HR());
    const clip = document.createElement('div'); clip.className = 'vm-chip-clip';
    const el = document.createElement('i'); el.className = 'vm-chip';
    Object.assign(el.style, { width:d + 'px', height:h + 'px' });
    clip.append(el); chipsEl.append(clip);
    return { clip, el, f, d, h, x:0, y:0, rot:0, tilt:1, frame:-1 };
  }
  // (x, y) is the middle of the chip itself (edge-on, its band sits low in
  // the sprite); k its size (nearer is bigger); lit how much light it gets;
  // (ox, oy) where its clip box sits
  function drawChip(c){
    if (c.frame !== c.tilt){ c.frame = c.tilt; c.el.style.backgroundImage = c.f.front[c.tilt]; }
    const oy = c.tilt >= 5 ? .69 : c.tilt >= 3 ? .62 : .56, k = c.k || 1;
    c.el.style.transformOrigin = `50% ${oy * 100}%`;
    c.el.style.transform = `translate(${Math.round(c.x - (c.ox || 0) - c.d / 2)}px,${Math.round(c.y - (c.oy || 0) - c.h * oy)}px) rotate(${snap(c.rot, 15)}deg) scale(${snap(k, .05)})`;
    const lit = c.lit ?? 1;
    if (lit !== c.litWas){ c.litWas = lit; c.el.style.filter = lit < 1 ? `brightness(${snap(lit, .1).toFixed(1)})` : ''; }
  }
  // one chip, one unbroken movement, never still: up out of the reel, over
  // and down, face showing and spinning, turning onto its edge as it lines
  // up with the slit in front of it; it meets the plate and is pushed in
  // (only what's inside the slit's opening shows, going darker and smaller
  // as it goes), then it rolls down the chute inside and CLUNKs into the box
  const FLY = .74, MEET = .8;   // where the flight ends and the push begins (of the whole)
  async function feed(col, reel, slit, i){
    const d = vm.classList.contains('is-compact') ? 26 : 30;
    const c = chipEl(col, d);
    c.clip.style.height = '100%';
    const sl = rel(slit), sx = sl.x + sl.w / 2, sy = sl.y + sl.h / 2;
    const x0 = reel.x + reel.w * rr(.3, .7), y0 = reel.y + reel.h * .5;
    const cx = mix(x0, sx, .85), cy = Math.min(y0, sl.y) - 70;
    const spin = (i % 2 ? 1 : -1) * rr(200, 320);
    const plate = vq('.vm-plate'), ring = vq('.vm-ring');
    let met = false, inside = false;
    S.chipBounce(.35); Haptic.tick(4);
    await tween(PO.reduced ? 1 : 840, (e, t) => {
      if (t < FLY){
        // the flight: a curve that comes down onto the slit from above, eased
        // out of the reel but arriving at speed (a thumb doesn't stop short)
        const q0 = t / FLY, u = q0 * q0 * (2 - q0) * .7 + q0 * .3, v = 1 - u;
        c.x = v * v * x0 + 2 * v * u * cx + u * u * sx;
        c.y = v * v * y0 + 2 * v * u * cy + u * u * sy;
        const q = t / FLY;
        if (q < .55){ c.tilt = q < .3 ? 1 : 2; c.rot = spin * (1 - q / .55); }
        else { const k = (q - .55) / .45; c.tilt = Math.min(5, 3 + Math.floor(k * 3)); c.rot = 90 * Math.min(1, k * 1.2); }
        // nearer the viewer as it comes in: a touch bigger than at the plate
        c.k = 1 + .14 * Math.sin(Math.min(1, q * 1.1) * Math.PI / 2);
      } else if (t < MEET){
        // it meets the plate: the last of the nearness goes, the rim gives
        const k = (t - FLY) / (MEET - FLY);
        c.x = sx; c.y = sy + 1 - k; c.tilt = 5; c.rot = 90; c.k = 1.14 - .12 * ease.out(k);
        if (!met){ met = true; Foil.scrape(); S.chipClink(.45); Haptic.tick(6, 40); ring.style.translate = '0 1px'; }
      } else {
        // pushed in: only what's in the slit's opening shows, going darker
        // and smaller as it goes deeper, and then it's gone
        if (!inside){
          inside = true; Haptic.tick(10, 0);
          Object.assign(c.clip.style, { left:sl.x + 'px', top:sl.y + 'px', width:sl.w + 'px', height:sl.h + 'px', right:'auto' });
          c.ox = sl.x; c.oy = sl.y;
        }
        // (deeper is a little higher, as everything here is seen from above)
        const k = ease.out((t - MEET) / (1 - MEET));
        c.x = sx; c.y = sy - 4 * k; c.k = 1.02 - .5 * k; c.lit = 1 - .85 * k;
      }
      drawChip(c);
    }, ease.lin);
    c.clip.remove();
    ring.style.translate = '';
    slit.classList.add('is-lit'); setTimeout(() => slit.classList.remove('is-lit'), 60);
    // inside: it rolls down the chute, tick, tick, tick, and CLUNKs into the box
    for (const [ms, k] of PO.reduced ? [] : [[70, .5], [60, .4], [55, .3], [50, .22]]){
      await wait(ms);
      try { CoinWorld.sfx('roll', k); } catch (e) { S.chipBounce(.16); }
      Haptic.tick(3, 40);
      plate.style.translate = `0 ${k > .35 ? 1 : 0}px`;
    }
    plate.style.translate = '';
    S.wheelBolt(); S.chipCollect(.7); Haptic.tick(18, 0);
    jolt(plate, 2); jolt(vm, 1);
  }

  /* ---------------- the drop ---------------- */
  async function dispenseAll(){
    const queue = order.slice();
    let first = true;
    for (const s of queue){
      const stuck = look.stuck === 'next' ? first : look.stuck === 'sometimes' && Math.random() < .12;
      first = false;
      await dispense(s, stuck);
      s.count--; mark(s);
      order.splice(order.indexOf(s), 1);
      if (!PO.reduced) await wait(200);
    }
    if (look.stuck === 'next'){ look.stuck = 'sometimes'; if (host) host.set({ stuck:'sometimes' }); marks(); }
    crt('IN THE', 'TRAY', tray.length + (tray.length === 1 ? ' PACKET' : ' PACKETS'), 'live');
    lamps(null);
  }
  async function dispense(s, stuck){
    shown = s.id; lamps(ED[s.id].odds);
    crt(ED[s.id].name, 'DROP', '', 'live');
    // the relay, the key's lamp blinks, the motor hums
    S.wheelRelay(.8); Haptic.tick(8);
    for (let i = 0; i < 2; i++){ s.keyEl.classList.add('is-blink'); await wait(70); s.keyEl.classList.remove('is-blink'); await wait(60); }
    const motor = S.wheelMotor();
    motor.set(.55); jolt(vm, 1);
    const p = s.p, b = p.body, f = frontPose(s);
    p.el.classList.remove('is-lit', 'is-dear');
    // it tips forward off the shelf: its top comes down at you
    p.el.style.zIndex = '40';
    await tween(PO.reduced ? 1 : 170, e => b.set({ sy:1 - .3 * e, y:f.y + 7 * e, s:f.s * (1 + .04 * e), r:f.r * (1 - e) }), ease.in);
    motor.stop();
    restock(s);
    if (stuck){ await stick(s, p); }
    S.cardDeal(); Foil.flutter();
    await fall(p, s);
  }
  // the spare comes forward with a click; a new spare drops in behind
  function restock(s){
    const sp = s.spare, show = stageOf(vq('.vm-show'));
    s.p = sp; s.p.el.dataset.i = s.i;
    sp.el.style.zIndex = '2';
    let k = .42;
    glide(sp.body, frontPose(s), 200, { easing:ease.out }).then(() => { S.counterTick(false); squash(sp.body, .04, 120); });
    const steps = every(() => { k = Math.min(1, k + .2); dim(sp, k); if (k >= 1) return false; });
    s.spare = packet(show, s.id, { ...sparePose(s), alpha:0 }, { spare:true });
    s.spare.el.style.zIndex = '1';
    tween(260, e => s.spare.body.set({ alpha:snap(e, .34) }));
    return steps;
  }

  /* ---- the fall: past the rows below, into the tray ---- */
  async function fall(p, s){
    const fallW = stageOf(vq('.vm-fall')), win = vq('.vm-window'), trEl = vq('.vm-tray');
    reparent(p, fallW);
    p.body.sh?.remove(); p.body.sh = null;
    const b = p.body;
    // where it will come to rest in the tray
    const wr = rel(win, vm), tr = rel(trEl, vm);
    const r0 = restAngle(), fx = clamp(wr.x + b.x - tr.x + rr(-30, 30), AW * G.k * .4, G.trayW - AW * G.k * .4);
    const rest = restFor(fx, r0);
    // in the machine's coordinates
    const x0 = wr.x + b.x, y0 = wr.y + b.y, tx = tr.x + 2 + rest.x, ty = tr.y + 2 + rest.y;
    const g = 2400, dist = ty - y0, T = Math.sqrt(2 * Math.max(40, dist) / g);
    const spin = pick([-1, 1]) * rr(1.1, 1.8);
    let inTray = false, ph = .35;
    await tween(PO.reduced ? 1 : T * 1000, (e, t) => {
      const y = y0 + .5 * g * (t * T) ** 2, x = mix(x0, tx, t * t);
      // end over end: the face, its edge, its back, its edge…
      ph = .35 + spin * t * T * 2;
      const c = Math.cos(ph * Math.PI);
      const face = c < 0 ? 'back' : 'front';
      if (face !== p.face){ p.face = face; p.draw(); }
      // into the tray: behind the bay's edge and the ribbed flap
      if (!inTray && y > tr.y - 2){ inTray = true; reparent(p, stageOf(vq('.vm-tfall'))); }
      const st = inTray ? tr : wr;
      b.set({ x:x - st.x, y:y - st.y, sy:Math.max(.14, Math.abs(c)), r:mix(0, r0, t * t), s:mix(G.k * 1.04, rest.s, t) });
    }, ease.lin);
    if (!inTray) reparent(p, stageOf(vq('.vm-tfall')));
    land(p, rest);
  }
  // down on the bottom (or on the others): it lands, bounces once, and lies there
  function land(p, rest){
    reparent(p, stageOf(vq('.vm-floor')));
    if (p.face !== 'front' && Math.random() < .6){ p.face = 'front'; p.draw(); }
    const b = p.body, { x, y, r, s } = rest;
    b.set({ x, y, z:0, r, s, sx:1, sy:1 });
    p.ex = rest.ex; p.ey = rest.ey;
    tray.push(p);
    p.el.style.zIndex = String(10 + tray.length);
    // THUNK: the flap knocks, the machine jolts
    S.cardLanded(); Foil.thud(.75); Haptic.tick(20, 0);
    jolt(vm, 2); knock();
    puff(stageOf(vq('.vm-floor')), x, y + p.ey * .8, p.ex * 2, { n:6, colour:'#5a3a34' });
    squash(b, .12, 200);
    nudgeAround(p);
    // one bounce, and it settles a touch round
    const dr = rr(-8, 8);
    return glide(b, { y:y - 12, r:r + dr * .5 }, 110, { easing:ease.out })
      .then(() => glide(b, { y, r:r + dr }, 130, { easing:ease.in }))
      .then(() => { S.cardLanded(); Foil.thud(.3); squash(b, .06, 160); });
  }
  // the ones it lands on are knocked about
  function nudgeAround(p){
    const b = p.body;
    tray.forEach(q => {
      if (q === p || Math.abs(q.body.x - b.x) > p.ex + q.ex * .6) return;
      glide(q.body, { r:q.body.r + rr(-6, 6), y:q.body.y + 1 }, 140, { easing:ease.out });
      Foil.crinkle();
    });
  }
  // the PUSH flap: something hit it from behind
  function knock(){
    const f = vq('.vm-flap');
    const seq = [-9, 5, -2, 0];
    seq.forEach((a, i) => setTimeout(() => { f.style.transform = a ? `perspective(220px) rotateX(${a}deg)` : ''; }, i * 55));
  }

  /* ---- stuck: it hangs on the rail; the glass shimmers; knock it free ---- */
  function stick(s, p){
    mode = 'stuck'; keys();
    stuckP = p; knocks = 0;
    const b = p.body, f = frontPose(s);
    glide(b, { sy:.68, r:6, y:f.y + 14 }, 120, { easing:ease.out }).then(() => { Foil.thud(.4); S.cardLanded(); });
    vm.classList.add('is-stuck');
    // it hangs there, rocking a little
    const stopRock = every((dt, now) => { if (mode !== 'stuck') return false; b.set({ r:6 + Math.sin(now / 260) * 1.5 }); });
    return new Promise(res => { freed = () => { vm.classList.remove('is-stuck'); stuckP = null; freed = null; mode = 'dispensing'; keys(); res(); }; });
  }
  // a knock on the machine: it shakes; the second gets it out
  function thump(){
    knocks++;
    S.koThunk(.5 + knocks * .3); Foil.thud(.9); Haptic.tick(26, 0);
    const v = vm;
    [4, -3, 2, -1, 0].forEach((px, i) => setTimeout(() => { v.style.translate = px ? `${px}px ${Math.abs(px) / 2}px` : ''; }, i * 40));
    if (stuckP){
      const b = stuckP.body;
      glide(b, { r:knocks === 1 ? -4 : 14, sy:.62 }, 80).then(() => glide(b, { r:knocks === 1 ? 8 : 2 }, 120));
    }
    if (knocks >= 2) setTimeout(() => freed?.(), 140);
  }

  /* ---------------- taking them out ---------------- */
  async function take(){
    if (mode !== 'idle' || !tray.length) return;
    mode = 'taking'; keys();
    const f = vq('.vm-flap');
    S.hatchOpen(); Foil.crinkle(); Haptic.tick(8);
    for (const a of [-22, -48, -70]){ f.style.transform = `perspective(220px) rotateX(${a}deg)`; await wait(PO.reduced ? 0 : 40); }
    handEl.classList.add('is-live');
    await liftOut();
  }
  // the one on top comes up out of the tray to you
  async function liftOut(){
    const p = tray.pop(); if (!p) return;
    inHand = p;
    const hs = stageOf(handEl.querySelector('.vm-stage')), r = p.el.querySelector('.po-pk-front').getBoundingClientRect(), hr = handEl.getBoundingClientRect();
    hs.objects.append(p.el); if (p.body.sh) hs.shadows.append(p.body.sh);
    p.body.stage = hs;
    const b = p.body;
    // where it is now, on screen: squashed flat as it lies
    b.set({ x:r.left - hr.left + r.width / 2, y:r.top - hr.top + r.height / 2, s:G.k * .94, sy:1, z:0 });
    if (p.face !== 'front'){ p.face = 'front'; p.draw(); }
    const W = handEl.clientWidth, H = handEl.clientHeight, s = Math.min(1.9, W / AW * .5);
    const dimEl = handEl.querySelector('.vm-dim');
    tween(220, e => { dimEl.style.opacity = snap(.6 * e, .15).toFixed(2); });
    S.cardReturn(); Foil.rustle(.8);
    await glide(b, { x:W / 2, y:H * .48, s, sy:1, r:0, z:10 }, 360, { arc:40, easing:ease.out });
    squash(b, .05, 140);
    crt('FLICK IT', 'DOWN', 'TO SEND', 'live');
  }
  // flicked down: it drops away (to the hub)
  async function send(vx, vy){
    const p = inHand; if (!p) return;
    inHand = null;
    const b = p.body, x0 = b.x, y0 = b.y, H = handEl.clientHeight, spin = vx > 0 ? 1 : -1;
    Foil.flutter(); S.cardDeal(); Haptic.tick(10);
    await tween(PO.reduced ? 1 : 420, (e, t) => {
      b.set({ x:x0 + vx * 300 * t, y:y0 + vy * 260 * t + 1500 * t * t, r:snap(spin * 70 * t, 15), z:0 });
    }, ease.lin);
    b.remove();
    pile.push(p.series); sent++;
    crt('SENT', String(sent), 'TO THE HUB', 'live');
    S.counterTick(true);
    if (tray.length){ await wait(160); await liftOut(); }
    else putAway();
  }
  // a tap off it: back into the tray it goes
  async function putBack(){
    const p = inHand; if (!p) return;
    inHand = null;
    const floor = stageOf(vq('.vm-floor')), fr = vq('.vm-floor').getBoundingClientRect(), hr = handEl.getBoundingClientRect();
    const rest = restFor(rr(.3, .7) * G.trayW, restAngle());
    S.cardReturn();
    await glide(p.body, { x:fr.left - hr.left + rest.x, y:fr.top - hr.top + rest.y, s:rest.s, r:rest.r }, 280, { arc:30, easing:ease.in });
    floor.objects.append(p.el); if (p.body.sh) floor.shadows.append(p.body.sh);
    p.body.stage = floor; p.body.set({ x:rest.x, y:rest.y });
    p.ex = rest.ex; p.ey = rest.ey;
    tray.push(p); p.el.style.zIndex = String(10 + tray.length);
    S.cardLanded(); Foil.thud(.4);
    putAway();
  }
  async function putAway(){
    const dimEl = handEl.querySelector('.vm-dim');
    handEl.classList.remove('is-live');
    tween(200, e => { dimEl.style.opacity = snap(.6 * (1 - e), .15).toFixed(2); });
    const f = vq('.vm-flap');
    for (const a of [-48, -20, 6, 0]){ f.style.transform = a ? `perspective(220px) rotateX(${a}deg)` : ''; await wait(PO.reduced ? 0 : 45); }
    S.hatchClose(); Foil.thud(.3);
    mode = 'idle'; unpeek(); panel(); keys();
  }
  // the packet in your hand: turn it, shake it, flick it down
  let hp = null;
  function handDown(e){
    if (mode !== 'taking' || hp) return;
    const onIt = inHand && e.target.closest('.vm-packet') === inHand.el;
    hp = { id:e.pointerId, x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, t:performance.now(), onIt, hist:[{ x:e.clientX, y:e.clientY, t:performance.now() }], yaw0:inHand?.yaw || 0 };
    try { handEl.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function handMove(e){
    if (!hp || e.pointerId !== hp.id || !inHand) return;
    const now = performance.now(), q = hp;
    q.hist.push({ x:e.clientX, y:e.clientY, t:now }); while (q.hist.length > 2 && now - q.hist[0].t > 90) q.hist.shift();
    const dx = e.clientX - q.x0, dy = e.clientY - q.y0, vx = (e.clientX - q.x) / Math.max(8, now - (q.tm || q.t));
    q.x = e.clientX; q.y = e.clientY; q.tm = now;
    if (!q.onIt) return;
    const b = inHand.body, W = handEl.clientWidth, H = handEl.clientHeight;
    // it follows your finger down a little; sideways it turns
    const yaw = snap(q.yaw0 + dx * 1.2, 9);
    if (yaw !== inHand.yaw){
      inHand.yaw = yaw;
      const c = Math.cos(yaw * Math.PI / 180), face = c < 0 ? 'back' : 'front';
      if (face !== inHand.face){ inHand.face = face; Foil.flutter(); }
      b.set({ shx:Math.max(.12, Math.abs(c)) }); inHand.draw();
    }
    b.set({ x:W / 2 + dx * .15, y:H * .48 + Math.max(-20, dy * .6), r:clamp(dx * .04, -6, 6) });
    // shaken: you can hear the five things inside
    const sg = Math.sign(vx);
    if (Math.abs(vx) > .8 && sg && sg !== q.shake){ if (q.shake && now - (q.shakeAt || 0) > 80){ q.shakeAt = now; Foil.scrape(); S.cardLanded(); Haptic.tick(5, 40); } q.shake = sg; }
  }
  function handUp(e, cancel){
    if (!hp || e.pointerId !== hp.id) return;
    const q = hp; hp = null;
    if (!inHand) return;
    const a = q.hist[0], z = q.hist[q.hist.length - 1], dt = Math.max(16, z.t - a.t);
    const vx = (z.x - a.x) / dt, vy = (z.y - a.y) / dt, moved = Math.hypot(q.x - q.x0, q.y - q.y0), fresh = performance.now() - z.t < 70;
    // a flick down, or a long drag down, sends it
    const down = q.y - q.y0;
    if (!cancel && q.onIt && ((fresh && vy > .6 && vy > Math.abs(vx)) || down > handEl.clientHeight * .16)){ send(vx, Math.max(vy, .8)); return; }
    if (!cancel && !q.onIt && moved < 8){ putBack(); return; }
    // back to the middle; the turn settles on the nearest face
    const b = inHand.body, W = handEl.clientWidth, H = handEl.clientHeight, p = inHand, from = p.yaw || 0, to = Math.round(from / 180) * 180;
    glide(b, { x:W / 2, y:H * .48, r:0 }, 220, { easing:ease.back });
    tween(200, e2 => { const y = snap(mix(from, to, e2), 9); p.yaw = y; const c = Math.cos(y * Math.PI / 180); p.face = c < 0 ? 'back' : 'front'; b.set({ shx:Math.max(.12, Math.abs(c)) }); p.draw(); }, ease.out).then(() => { p.yaw = ((to % 360) + 360) % 360; });
  }

  /* ---------------- touches on the machine ---------------- */
  function vmDown(e){
    if (mode === 'stuck'){ e.preventDefault(); thump(); return; }
    if (mode !== 'idle') return;
    const k = e.target.closest('.vm-key'), pk = e.target.closest('.vm-packet');
    const i = k ? +k.dataset.i : pk && pk.dataset.i != null ? +pk.dataset.i : null;
    if (i != null && !isNaN(i)){ e.preventDefault(); choose(slots[i], !!k); }
  }

  /* ---------------- the roll: the hub turns away, the machine comes down ---------------- */
  const hubFaces = () => [$('.cm-row'), $('.cm-felt'), pileEl];
  async function roll(dir){
    const H = drum.clientHeight, teeth = 8, faces = hubFaces();
    // the teeth are steps: nothing may smooth them (the hub's parts have transitions of their own)
    faces.forEach(f => { if (f){ f.style.visibility = ''; f.style.transition = 'none'; } });
    S.wheelRelease(); Haptic.tick(8);
    jolt($('.cm-cabinet'), 1);
    if (!PO.reduced) await wait(90);
    const set = y => {
      // dir 1: the machine comes down from the top; the hub goes down and away
      vm.style.transform = `translateY(${Math.round(y)}px)`;
      const hubY = dir > 0 ? y + H : y + H;
      faces.forEach(f => { if (f) f.style.translate = `0 ${Math.round(hubY)}px`; });
    };
    const from = dir > 0 ? -H : 0, to = dir > 0 ? 0 : -H;
    if (!PO.reduced){
      for (let t = 1; t <= teeth; t++){
        const y = mix(from, to, ease.inOut(t / teeth));
        set(y); S.wheelTooth(.5 + t / teeth * .4, false); Haptic.tick(3, 20);
        await wait(52);
      }
      if (dir > 0){
        set(10); S.wheelCatch(); await wait(50);
        set(-3); await wait(40);
      }
    }
    set(to);
    S.wheelLock(); Haptic.tick(16, 0);
    jolt($('.cm-cabinet'), dir > 0 ? 3 : 2);
    if (dir > 0) faces.forEach(f => { if (f) f.style.visibility = 'hidden'; });
  }
  async function rollIn(){
    if (mode !== 'hub') return;
    mode = 'rolling'; keys();
    S.unlock(); Foil.unlock();
    drum.hidden = false; drum.style.pointerEvents = 'auto';
    vm.classList.add('is-off');
    layout();
    vm.style.transform = `translateY(${-drum.clientHeight}px)`;
    unpeek(); panel(); crt('', '', '');
    await roll(1);
    await boot();
    mode = 'idle'; panel(); keys();
  }
  // the tube flickers on; the keys light row by row; the screen warms
  async function boot(){
    const tube = vq('.vm-tube');
    S.bootFilament();
    if (!PO.reduced){
      for (const on of [1, 0, 1, 0, 0, 1]){ vm.classList.toggle('is-off', !on); if (on) Foil.note(2, .15); await wait(on ? 50 : 70); }
    }
    vm.classList.remove('is-off');
    tube.style.opacity = '';
    for (let r = 0; r < G.R; r++){
      slots.filter(s => s.r === r && s.id).forEach(s => s.keyEl.classList.add('is-blink'));
      S.counterTick(false);
      if (!PO.reduced) await wait(60);
      slots.filter(s => s.r === r && s.id).forEach(s => s.keyEl.classList.remove('is-blink'));
    }
    S.bootReady();
    // everything on the shelves settles as the machine comes to life
    slots.forEach((s, i) => { if (s.p) wait(i * 12).then(() => glide(s.p.body, { z:4 }, 60).then(() => glide(s.p.body, { z:0 }, 90, { easing:ease.in })).then(() => squash(s.p.body, .04, 120))); });
  }
  async function rollOut(){
    if (mode !== 'idle' && mode !== 'taking') return;
    // whatever's in your hand or the tray comes with you
    if (inHand){ const p = inHand; inHand = null; p.body.remove(); pile.push(p.series); }
    tray.splice(0).forEach(p => { p.body.remove(); pile.push(p.series); });
    handEl.classList.remove('is-live'); handEl.querySelector('.vm-dim').style.opacity = '0';
    vq('.vm-flap').style.transform = '';
    order = []; slots.forEach(s => { s.count = 0; mark(s); });
    mode = 'rolling'; keys();
    vm.classList.add('is-off'); S.bootFilament();
    await wait(PO.reduced ? 0 : 120);
    await roll(-1);
    hubFaces().forEach(f => { if (f) f.style.translate = ''; });
    void root.offsetHeight;
    requestAnimationFrame(() => hubFaces().forEach(f => { if (f) f.style.transition = ''; }));
    drum.hidden = true; drum.style.pointerEvents = '';
    mode = 'hub'; keys();
    sent = 0;
    await dropPile();
    M.screens();
  }

  /* ---------------- the hub: the packets waiting ---------------- */
  // a packet on the hub is the table's size: a little wider than a card
  const tableS = () => M.scale;
  // the pile lands on a clear patch of felt and stays there till it's gone
  let pileStage = null, pileKids = [], pileAt = null;
  function pileBox(){
    const f = unmoved($('.cm-felt')), s = tableS(), w = Math.round(AW * s * 1.3), h = Math.round(AH * s * 1.08);
    if (!pileKids.length || !pileAt) pileAt = clearSpot(w, h, f);
    const x = clamp(pileAt.x, w / 2, f.w - w / 2), y = clamp(pileAt.y, h / 2, f.h - h / 2);
    Object.assign(pileEl.style, { left:Math.round(f.x + x - w / 2) + 'px', top:Math.round(f.y + y - h / 2) + 'px', width:w + 'px', height:h + 'px' });
    pileStage = stageOf(pileEl.querySelector('.vm-stage'));
    return { w, h, s };
  }
  // the ones you sent drop onto the felt, one on top of another
  async function dropPile(){
    const { w, h, s } = pileBox();
    pileKids.forEach(p => p.body.set({ s }));
    const fresh = pile.slice(pileKids.length);
    for (const series of fresh){
      const p = new Packet(pileStage, series, 0);
      p.tagEl.hidden = true; p.el.classList.add('vm-packet');
      const n = pileKids.length, x = w / 2 + rr(-8, 8), y = h / 2 + rr(-6, 6), r = rr(-14, 14);
      p.body.set({ x, y:-h * .6, s, r:r - 40, z:30, sx:1, sy:1 });
      p.body.render(performance.now());
      p.el.style.zIndex = String(10 + n);
      pileKids.push(p);
      await p.ready;
      S.cardDeal(); Foil.flutter();
      await glide(p.body, { x, y, r, z:0 }, 300, { easing:ease.in });
      S.cardLanded(); Foil.thud(.4); Haptic.tick(8);
      puff(pileStage, x, y + AH * s * .4, AW * s, { n:5 });
      squash(p.body, .08, 180);
      M.screens();
      await wait(PO.reduced ? 0 : 90);
    }
  }
  // tap the pile: the top one is opened on the felt
  function pileDown(e){
    if (mode !== 'hub' || !pileKids.length || M.busy) return;
    const el = e.target.closest('.vm-packet'); if (!el) return;
    e.preventDefault();
    const p = pileKids.pop(); pile.pop();
    // from the pile to the felt's middle, where the opening runs
    const os = stageOf(openEl), a = pileEl.getBoundingClientRect(), b = openEl.getBoundingClientRect();
    p.body.set({ x:p.body.x + a.left - b.left, y:p.body.y + a.top - b.top });
    os.objects.append(p.el); if (p.body.sh) os.shadows.append(p.body.sh);
    p.body.stage = os;
    mode = 'opening'; keys();
    openEl.classList.add('is-live');
    E.layout({ tableS:tableS() });
    E.openOwned(p);
  }

  /* ---------------- the opening, on the hub's felt ---------------- */
  // the opening narrates in long lines; the hub's screens are small
  const SHORT = {
    'BUYING…':['KEEP', 'HOLDING', 'live'], "IT'S YOURS":["IT'S", 'YOURS', 'money'],
    'TEAR IT OPEN':['TEAR THE', 'SEAM'], 'HALF OPEN':['KEEP', 'TEARING'],
    'SOMETHING IN THERE IS GLOWING':['SOMETHING', 'GLOWS', 'money'], 'SEAL BROKEN':['PULL THEM', 'OUT'],
    'FOUR CARDS, FACE DOWN':['TAP TO', 'TURN'], 'NEXT CARD':['TAP FOR', 'NEXT'], 'LAST ONE…':['LAST', 'ONE'],
    'SQUEEZE IT':['PEEL THE', 'CORNER'], 'YOU SAW IT':['TAP TO', 'TURN'], 'STILL FACE DOWN':['TAP TO', 'TURN'],
    'RARE!':['A', 'RARE', 'live'], 'LEGENDARY!':['A', 'LEGEND', 'money'], '…':['', '…']
  };
  const KIND = { 'TABLE EVENT':'TABLE', 'FREEZEOUT':'FREEZE', 'BOMB':'BOMB', 'WILD EVENT':'WILD' };
  function shortly(title, sub){
    if (SHORT[title]) return SHORT[title];
    if (KIND[title]) return [sub.split(' · ')[0].toUpperCase(), KIND[title]];
    const w = title.split(' '), last = w.pop();
    return [w.join(' ') || 'YOUR HAND', last];
  }
  function attachOpening(){
    E = window.PackOpeningEmbed;
    if (!E) return;
    E.attach({
      root, stage:stageOf(openEl),
      ui:{
        status(title, sub){ const [cap, fig, ink] = shortly(title, sub || ''); hubCrt('r', cap, fig, ink); },
        figure(n, label){ hubCrt('l', label, n, /PRIZE|PRICE/.test(label) ? 'money' : ''); },
        key(label, sub, on){ midKey(label, on); },
        keySub(){},
        bank(v){ M.showBank(v); },
        bankEl:() => M.reelEl,
        flash(){
          root.querySelectorAll('.cm-crt').forEach(c => { c.classList.remove('is-legend'); void c.offsetWidth; c.classList.add('is-legend'); });
          S.stageLock(); Foil.thud(.8);
        }
      },
      wallet:() => M.wallet, setWallet:v => { M.wallet = v; },
      focus:() => null,
      layout:{ handY:.66, squareY:.66, wrapY:.42, railLift:66 },
      onPutBack(){}, onBought(){},
      bag:at => dropBag(at),
      stow:fan => M.layDown(fan),
      done({ wrapper, flap }){
        mode = 'hub';
        openEl.classList.remove('is-live');
        // (they were there before the cards were laid down: under them)
        if (wrapper){ wrapper.el.style.zIndex = '30'; leave('wrapper', wrapper.body, wrapper, true); }
        if (flap){ flap.el.style.zIndex = '30'; leave('flap', flap, null, true); }
        keys(); M.screens();
      }
    });
  }

  /* ---------------- things left on the felt ----------------
     The empty wrappers, the torn strips and the bags of chips stay on the
     hub's felt (under the cards) as things: pick them up, slide them, throw
     them; off the edge and they're gone. */
  let feltStage = null;
  const loose = [];
  function leave(kind, body, p, under = false){
    const a = body.stage.el.getBoundingClientRect(), b = feltStage.el.getBoundingClientRect();
    body.set({ x:body.x + a.left - b.left, y:body.y + a.top - b.top });
    feltStage.objects.append(body.el); if (body.sh) feltStage.shadows.append(body.sh);
    body.stage = feltStage;
    body.el.classList.add('vm-loose');
    if (!under) M.raise(body.el);
    const it = { kind, body, p };
    loose.push(it);
    return it;
  }
  let lp = null;
  const fl = e => { const r = feltStage.el.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; };
  function feltDown(e){
    if (mode !== 'hub' || lp || M.busy) return;
    // a chip: it bounces
    const hitC = chipAt(e.clientX, e.clientY);
    if (hitC && !e.target.closest('.cm-card')){ e.preventDefault(); bounceChip(hitC, e.clientX, e.clientY); return; }
    const el = e.target.closest('.vm-loose'), it = el && loose.find(q => q.body.el === el);
    if (!it) return;
    e.preventDefault();
    const pt = fl(e), b = it.body, now = performance.now();
    lp = { id:e.pointerId, it, x0:pt.x, y0:pt.y, x:pt.x, y:pt.y, ox:b.x - pt.x, oy:b.y - pt.y, t:now, hist:[{ ...pt, t:now }], mode:'press' };
    if (it.kind === 'bag' && !it.open){ const l = bagLocal(b, pt.x, pt.y); if (l.y < BH * .42 && l.x > BW * .35) lp.mode = 'snip'; }
    M.raise(it.body.el);
    try { feltStage.el.setPointerCapture(e.pointerId); } catch (_) {}
    if (it.kind === 'bag') S.chipBounce(.2); else Foil.crinkle();
    Haptic.tick(5);
  }
  function feltMove(e){
    const q = lp; if (!q || e.pointerId !== q.id) return;
    const pt = fl(e), now = performance.now();
    q.x = pt.x; q.y = pt.y;
    q.hist.push({ ...pt, t:now }); while (q.hist.length > 2 && now - q.hist[0].t > 90) q.hist.shift();
    const moved = Math.hypot(q.x - q.x0, q.y - q.y0);
    if (q.mode === 'snip'){ snipTo(q.it, Math.abs(q.x - q.x0) / (BW * q.it.body.s * .55)); return; }
    if (q.mode === 'press' && moved > 8) q.mode = 'drag';
    if (q.mode === 'drag'){
      const v = vel(q), b = q.it.body;
      b.set({ x:q.x + q.ox, y:q.y + q.oy, z:6, r:b.r + clamp(v.x / 400, -3, 3) });
    }
  }
  function vel(q){ const a = q.hist[0], z = q.hist[q.hist.length - 1], dt = Math.max(16, z.t - a.t); return { x:(z.x - a.x) / dt * 1000, y:(z.y - a.y) / dt * 1000, fresh:performance.now() - z.t < 70 }; }
  function feltUp(e){
    const q = lp; if (!q || e.pointerId !== q.id) return;
    lp = null;
    const it = q.it, b = it.body;
    if (q.mode === 'snip'){ if ((it.cut || 0) < 1) snipTo(it, 0, true); return; }
    if (q.mode === 'press'){
      // a tap: it hops (a bag of chips rattles)
      glide(b, { z:8 }, 70, { easing:ease.out }).then(() => glide(b, { z:0 }, 110, { easing:ease.in })).then(() => squash(b, .08, 140));
      if (it.kind === 'bag' && !it.open){ S.chipBounce(.5); Foil.scrape(); } else Foil.crinkle();
      return;
    }
    // let go: it slides on, or flies off the edge and is gone
    const v = vel(q), W = feltStage.el.clientWidth, H = feltStage.el.clientHeight, vx = v.fresh ? v.x : 0, vy = v.fresh ? v.y : 0;
    const tx = b.x + vx * .14, ty = b.y + vy * .14;
    if (it.kind !== 'bag' && (tx < -30 || tx > W + 30 || ty < -30 || ty > H + 30) && Math.hypot(vx, vy) > 500){
      loose.splice(loose.indexOf(it), 1);
      Foil.flutter(); Haptic.tick(8);
      tween(380, (e2, t) => b.set({ x:b.x + vx * .016, y:b.y + vy * .016, z:6 + Math.sin(t * Math.PI) * 20, r:b.r + Math.sign(vx || 1) * 18, alpha:1 - t }), ease.lin).then(() => b.remove());
      return;
    }
    const m = 14, x = clamp(tx, m, W - m), y = clamp(ty, m, H - m);
    glide(b, { x, y, z:0, r:b.r + clamp(vx / 30, -40, 40) }, 240, { easing:ease.out }).then(() => {
      squash(b, .06, 140);
      if (it.kind === 'bag'){ S.chipBounce(.3); Foil.thud(.3); } else Foil.crinkle();
    });
  }

  /* ---- the bag of chips: clear plastic, the amount on a sticker ---- */
  const BW = 44, BH = 54, CUT = 13;
  const CHIP_INK = { t0:['#efe6c8', '#b3392f'], t1:['#d0362a', '#f3eee2'], t2:['#1f9a57', '#f3eee2'], t3:['#2a2630', '#e0b54a'] };
  function chipCols(value){
    const out = [];
    try { CoinWorld.composeTiers(value, 9).counts.forEach((n, k) => { for (let i = 0; i < n; i++) out.push('t' + k); }); } catch (e) {}
    // a handful at least: the biggest broken into smaller ones
    for (let g = 0; out.length < 5 && g < 9; g++){
      const top = out.reduce((a, c) => c > a ? c : a, 't0');
      if (top === 't0') break;
      out.splice(out.indexOf(top), 1, ...Array(2).fill('t' + (+top[1] - 1)));
    }
    return out.length ? out : ['t0', 't0', 't0', 't1', 't1'];
  }
  function drawBag(it){
    const c = it.ctx, cut = it.open ? 1 : 0, part = it.cut || 0;
    c.clearRect(0, 0, BW, BH);
    const L = 3, R = BW - 3, T = 3, B = BH - 2;
    const inside = (x, y) => !(cut && x > R - CUT + (y - T));
    // the plastic: barely there, brighter at its edges
    for (let y = T; y < B; y++) for (let x = L; x < R; x++){
      if (!inside(x, y)) continue;
      const edge = x === L || x === R - 1 || y === T || y === B - 1 || (cut && x === R - CUT + (y - T));
      c.fillStyle = edge ? 'rgba(236,248,250,.78)' : y < T + 6 ? 'rgba(226,242,246,.30)' : 'rgba(214,234,240,.16)';
      c.fillRect(x, y, 1, 1);
    }
    // the chips inside, in a heap at the bottom
    it.cols.slice(0, it.open ? 0 : 9).forEach((col, i) => {
      const [face, band] = CHIP_INK[col] || CHIP_INK.t0, row = i < 4 ? 0 : i < 7 ? 1 : 2, k = i - [0, 4, 7][row];
      const x = L + 4 + k * 9 + row * 4 + (row === 1 ? 1 : 0), y = B - 6 - row * 4 - (k % 2);
      c.fillStyle = 'rgba(10,6,6,.55)'; c.fillRect(x, y + 1, 10, 4);
      c.fillStyle = face; c.fillRect(x, y, 10, 3);
      c.fillStyle = band; c.fillRect(x + 2, y, 2, 3); c.fillRect(x + 6, y, 2, 3);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 1, y, 8, 1);
    });
    // the seal: a zip across the top
    for (let x = L + 1; x < R - 1; x++){ if (!inside(x, T + 6)) continue; c.fillStyle = 'rgba(168,214,236,.95)'; c.fillRect(x, T + 6, 1, 1); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x, T + 7, 1, 1); }
    // a glint down the plastic
    c.fillStyle = 'rgba(255,255,255,.42)';
    for (let k = 0; k < 18; k += 2) c.fillRect(L + 4 + Math.floor(k / 3), T + 14 + k, 1, 2);
    // the sticker with the amount
    c.drawImage(it.label, Math.round((BW - it.label.width) / 2), 17);
    // the snip so far: a nick along the corner
    if (!cut && part > 0){
      c.fillStyle = '#fff';
      const n = Math.round(CUT * part);
      for (let k = 0; k < n; k++) c.fillRect(R - CUT + k, T + k, 1, 1);
    }
  }
  function sticker(text){
    const w = text.length * 8 + 6, h = 12, cv = Object.assign(document.createElement('canvas'), { width:w, height:h }), x = cv.getContext('2d');
    x.fillStyle = '#efe4c4'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c9b88e'; x.fillRect(0, h - 1, w, 1); x.fillRect(w - 1, 0, 1, h);
    const t = Object.assign(document.createElement('canvas'), { width:w, height:h }), tx = t.getContext('2d');
    tx.font = '8px "Press Start 2P"'; tx.textBaseline = 'top'; tx.fillStyle = '#000'; tx.fillText(text, 3, 2);
    const img = tx.getImageData(0, 0, w, h), d = img.data;
    x.fillStyle = '#3a1810';
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 110){ const p = i / 4; x.fillRect(p % w, Math.floor(p / w), 1, 1); }
    return cv;
  }
  // it comes out of the packet with the cards and drops onto the felt
  async function dropBag({ x, y, series }){
    try { await document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
    const value = BAG[series] || 40;
    const el = Object.assign(document.createElement('canvas'), { width:BW, height:BH, className:'vm-bag' });
    const os = stageOf(openEl), body = new PO.Body(os, el, { w:BW, h:BH, shadowW:BW, shadowH:BH * .4, shadowY:BH * .3 });
    const it = { kind:'bag', body, value, cols:chipCols(value), ctx:el.getContext('2d'), label:sticker(money(value)), open:false, cut:0 };
    drawBag(it);
    const s = tableS(), W = openEl.clientWidth, H = openEl.clientHeight;
    body.set({ x, y, z:20, r:0, s:s * .8, sx:1, sy:1, alpha:1 });
    body.render(performance.now());
    el.style.zIndex = '45';
    S.chipBounce(.6); Foil.crinkle();
    const { x:tx, y:ty } = clearSpot(BW * s, BH * s);
    await glide(body, { x:tx, y:ty, z:0, r:rr(-25, 25), s }, 460, { arc:50, easing:ease.out });
    S.chipBounce(.8); Foil.thud(.4); Haptic.tick(10);
    puff(os, tx, ty + BH * s * .4, BW * s, { n:5 });
    squash(body, .12, 200);
    // left on the hub's felt with the rest
    const l = leave('bag', body);
    Object.assign(l, it, { body });
  }
  // somewhere on the felt clear of the cards out, the deck, the clean-up
  // spot, the packets waiting and the bags (f: the felt where it sits still)
  function clearSpot(w, h, f = M.felt.getBoundingClientRect()){
    const W = f.width || f.w, H = f.height || f.h, o = M.felt.getBoundingClientRect();
    const busy = [...M.felt.querySelectorAll('.cm-card, .cm-pad, .cm-station, .vm-bag')].map(e => e.getBoundingClientRect())
      .map(r => ({ left:r.left - o.left, right:r.right - o.left, top:r.top - o.top, bottom:r.bottom - o.top }));
    if (pileKids.length){ const r = pileEl.getBoundingClientRect(); busy.push({ left:r.left - o.left, right:r.right - o.left, top:r.top - o.top, bottom:r.bottom - o.top }); }
    let best = null, least = 1e9;
    for (let i = 0; i < 40; i++){
      const x = rr(w * .7, W - w * .7), y = rr(h * .7, H - h * .7);
      const over = busy.reduce((a, r) => a + Math.max(0, Math.min(x + w / 2, r.right) - Math.max(x - w / 2, r.left)) * Math.max(0, Math.min(y + h / 2, r.bottom) - Math.max(y - h / 2, r.top)), 0);
      if (over < least){ least = over; best = { x, y }; }
      if (!over) break;
    }
    return best;
  }
  function bagLocal(b, px, py){
    const dx = px - b.x, dy = py - (b.y - b.z), a = -b.r * Math.PI / 180;
    return { x:(dx * Math.cos(a) - dy * Math.sin(a)) / b.s + BW / 2, y:(dx * Math.sin(a) + dy * Math.cos(a)) / b.s + BH / 2 };
  }
  // drag across its top corner: the plastic gives, a nick at a time; all
  // the way and the corner comes off and the chips pour out
  function snipTo(it, v, back){
    if (it.open) return;
    const was = it.cut || 0;
    it.cut = back ? 0 : clamp(Math.max(was, v), 0, 1);
    if (Math.floor(it.cut * 6) !== Math.floor(was * 6) && !back){ Foil.crackle(.5 + it.cut * .4, it.cut); Haptic.tick(4, 50); }
    drawBag(it);
    if (it.cut >= 1) spillBag(it);
  }
  async function spillBag(it){
    it.open = true; lp = null;
    Foil.rip(); Haptic.tick(20);
    drawBag(it);
    const b = it.body, s = b.s;
    // the corner, snipped off: it flutters away
    const bit = Object.assign(document.createElement('canvas'), { width:CUT, height:CUT, className:'vm-bit' });
    const bx = bit.getContext('2d'); bx.fillStyle = 'rgba(236,248,250,.8)';
    for (let k = 0; k < CUT; k++) bx.fillRect(k, 0, CUT - k, 1);
    const cb = new PO.Body(feltStage, bit, { w:CUT, h:CUT, shadowW:CUT, shadowH:4, shadowY:4 });
    const a = b.r * Math.PI / 180, ox = (BW / 2 - CUT / 2) * s, oy = (-BH / 2 + CUT / 2) * s;
    const cx = b.x + ox * Math.cos(a) - oy * Math.sin(a), cy = b.y + ox * Math.sin(a) + oy * Math.cos(a);
    cb.set({ x:cx, y:cy, z:4, r:b.r, s, sx:1, sy:1, alpha:1 });
    glide(cb, { x:cx + rr(20, 40), y:cy + rr(-10, 20), z:0, r:b.r + rr(90, 200) }, 420, { arc:30 }).then(() => leave('flap', cb));
    // it tips, the cut corner down, and the chips pour out of it
    await glide(b, { r:b.r + 50, z:6 }, 160, { easing:ease.out });
    const f = feltStage.el.getBoundingClientRect(), d = Math.round(M.scale * 82 * .22);
    const mouth = () => { const a2 = b.r * Math.PI / 180; return { x:f.left + b.x + ox * Math.cos(a2) - oy * Math.sin(a2), y:f.top + b.y + ox * Math.sin(a2) + oy * Math.cos(a2) - b.z }; };
    try {
      CoinWorld.setHost(feltStage.el, [3, 3]);   // on top of whatever they land on CoinWorld.setExtraBlocks([]); CoinWorld.buildWalls();
      const m = mouth();
      const out = it.cols.map((col, i) => {
        const c = CoinWorld.body(CoinWorld.makeChip(col), m.x, m.y, 10, d);
        c.fresh = true; chips.push(c);
        return CoinWorld.launch(c, { x:clamp(m.x + rr(-20, 70), f.left + d, f.right - d), y:clamp(m.y + rr(10, 70), f.top + d, f.bottom - d), d },
          { T:PO.reduced ? .01 : .3 + i * .015, wait:PO.reduced ? 0 : 30 + i * 55, flips:PO.reduced ? 0 : 1 + (i % 3), i });
      });
      chipValue += it.value;
      Foil.rustle(.6);
      await Promise.all(out);
    } catch (e) { chipValue += it.value; }
    it.value = 0;
    await glide(b, { r:b.r - 20, z:0 }, 200, { easing:ease.in });
    squash(b, .06, 140); Foil.crinkle();
  }

  /* ---- the chips on the felt: tap one and it bounces ---- */
  const chips = [];
  let chipValue = 0;
  function chipAt(x, y){
    let hit = null, best = 1e9;
    chips.forEach(b => {
      if (b.state !== 'rest') return;
      const d = Math.hypot(b.x - x, b.y - b.z - b.d * .5 - y);
      if (d < b.d * .9 && d < best){ best = d; hit = b; }
    });
    return hit;
  }
  function bounceChip(hit, x, y){
    const CW = CoinWorld, dx = hit.x - x || CW.rr(-1, 1), dy = (hit.y - y) * .4, L = Math.max(1, Math.hypot(dx, dy));
    Object.assign(hit, { target:{}, opts:{}, bounces:0, maxB:1, e:.3, knocked:true, inFelt:true, edge:false,
      vx:dx / L * CW.rr(60, 100), vy:dy / L * CW.rr(20, 40), vz:CW.rr(160, 220), fr:Math.PI * 2 / .25, phi:0, t:.1, T:0, state:'air' });
    CW.active.add(hit); CW.kick(); CW.sfx('stack', .7); Haptic.tick(6);
  }

  /* ---- the hub's clean-up spot: the shop's things go too ---- */
  // the rubbish goes into the spot and away; the chips (and any bag still
  // shut) go into the bankroll, and the reel counts them in
  async function sweep(pc){
    const things = loose.splice(0);
    let value = chipValue; chipValue = 0;
    const r = M.reelEl.getBoundingClientRect();
    const away = things.map((it, i) => {
      const b = it.body;
      if (it.kind === 'bag' && !it.open){
        value += it.value;
        const f = feltStage.el.getBoundingClientRect();
        return wait(i * 50).then(() => glide(b, { x:r.left + r.width / 2 - f.left, y:r.top + r.height / 2 - f.top, s:b.s * .5, z:20, alpha:.4 }, 380, { arc:40, easing:ease.in })).then(() => { S.chipCollect(.6); b.remove(); });
      }
      return wait(i * 50).then(() => glide(b, { x:pc.x, y:pc.y, r:b.r + rr(-90, 90), s:b.s * .55, z:0 }, 280, { arc:12, easing:ease.in }))
        .then(() => tween(140, e => b.set({ alpha:1 - e, s:b.s * (1 - e * .3) }))).then(() => { Foil.crinkle(); b.remove(); });
    });
    const home = chips.splice(0).map((c, i) => CoinWorld.launch(c, { x:r.left + r.width / 2, y:r.top + r.height / 2, d:14, vanish:true }, { wait:PO.reduced ? 0 : i * 40, T:PO.reduced ? .01 : .34, flips:PO.reduced ? 0 : 1, i }));
    await Promise.all([...away, ...home]);
    if (home.length){ try { CoinWorld.clearWorld(); } catch (e) {} }
    if (value){ hubCrt('r', 'COUNT IN', '+' + money(value), 'money'); await M.countIn(value); }
  }

  /* ---------------- the lab's sheet ---------------- */
  function sheet(){
    const s = $('#cm-sheet');
    s.querySelector('h2').textContent = 'CAREER · THE PACKET MACHINE';
    s.querySelector('p').textContent = 'SHOP rolls the machine down. Tap a packet to look, again (or its key) to put one in; hold the green key to pay, watch them drop. Tap PUSH to take one: turn it, shake it, flick it down to send it. SHOP again: they wait on the felt; tap one to open it. Snip the bag of chips across its top corner. Tap the outline opposite the deck to clear the felt. Lab money, nothing saved.';
    const seg = (key, opts) => `<div class="vm-seg" data-vm="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;
    s.querySelector('#cm-done').parentNode.insertAdjacentHTML('beforebegin', `
      <h3>THE WINDOW</h3>${seg('cols', { 4:'4 ACROSS', 5:'5 ACROSS' })}${seg('rows', { 4:'4 ROWS', 3:'3 ROWS' })}
      <h3>PAINT ON THE GLASS</h3>${seg('paint', { on:'CARD PACKETS', off:'OFF' })}
      <h3>A PACKET STICKS</h3>${seg('stuck', { never:'NEVER', sometimes:'NOW AND THEN', next:'THE NEXT ONE' })}
      <h3>NEXT PACKET OPENED HOLDS</h3>${seg('contents', { surprise:'SURPRISE', legendary:'A LEGEND', none:'NO LEGEND' })}
      <h3>SPEED</h3>${seg('speed', { 1:'REAL', 0.5:'HALF', 0.25:'QUARTER' })}
      <div class="vm-seg"><button class="pc-button pc-button-secondary" id="vm-credit">+$5,000</button></div>`);
    s.querySelectorAll('[data-vm] button').forEach(b => b.onclick = () => {
      const k = b.parentNode.dataset.vm, v = b.dataset.v;
      if (k === 'contents' || k === 'speed'){ E.tune[k] = isNaN(+v) ? v : +v; E.applyTune(); }
      else {
        look[k] = k === 'paint' ? v === 'on' : k === 'stuck' ? v : +v;
        if (host) host.set({ [k]:v });
        if ((k === 'cols' || k === 'rows' || k === 'paint') && mode === 'idle'){ G = null; layout(); }
      }
      marks();
    });
    s.querySelector('#vm-credit').onclick = () => { M.wallet = M.wallet + 5000; if (mode === 'idle') panel(); };
    marks();
  }
  function marks(){
    $('#cm-sheet').querySelectorAll('[data-vm] button').forEach(b => {
      const k = b.parentNode.dataset.vm;
      const v = k === 'paint' ? (look.paint ? 'on' : 'off') : (k === 'contents' || k === 'speed') ? E?.tune[k] : look[k];
      b.setAttribute('aria-pressed', String(String(v) === b.dataset.v));
    });
  }

  /* ---------------- reparenting ---------------- */
  function reparent(p, to){
    const a = p.body.stage.el.getBoundingClientRect(), b = to.el.getBoundingClientRect();
    p.body.set({ x:p.body.x + a.left - b.left, y:p.body.y + a.top - b.top });
    to.objects.append(p.el); if (p.body.sh) to.shadows.append(p.body.sh);
    p.body.stage = to;
  }

  /* ---------------- start ---------------- */
  function setup(){
    M = window.CareerMain;
    if (!M || !window.PackOpeningEmbed) return;
    build(); sheet();
    E.applyTune();
    feltStage = stageOf(M.felt);
    M.felt.addEventListener('pointerdown', feltDown);
    M.felt.addEventListener('pointermove', feltMove);
    M.felt.addEventListener('pointerup', feltUp);
    M.felt.addEventListener('pointercancel', feltUp);
    window.CareerShop = {
      key, screens, sweep,
      get out(){ return mode !== 'hub'; },
      keepOff:() => [...(pileKids.length ? [pileEl.getBoundingClientRect()] : []), ...loose.filter(q => q.kind === 'bag').map(q => q.body.el.getBoundingClientRect())]
    };
    pileBox(); layout(); keys();
    new ResizeObserver(() => { if (mode === 'idle'){ layout(); } else if (mode === 'hub'){ layout(); pileBox(); } }).observe(root);
    // read-only diagnostics for the lab's checks
    window.VendingLab = {
      get state(){ return { mode, cols:G?.C, rows:G?.R, k:G?.k, sel:sel?.id || null, order:order.map(s => s.id), total:total(), wallet:M.wallet, tray:tray.length, inHand:!!inHand, pile:pile.length, stuck:!!stuckP, pool:M.pool, deck:M.deck, cards:M.cards, open:E.state.phase, loose:loose.map(q => q.kind + (q.open ? ':open' : '')), chips:chips.length, busy:M.busy }; },
      slots:() => slots.map(s => ({ i:s.i, id:s.id, r:s.r, c:s.c, count:s.count })),
      // where on screen a point of the bag is (fractions of it), and a chip
      // a corner of the bag nothing's lying on: [fx, fy]
      bagGrip(){
        const bag = loose.find(q => q.kind === 'bag').body.el;
        for (const fy of [.2, .3, .12]) for (const fx of [.45, .55, .65, .4]){ const [x, y] = this.bagPoint(fx, fy); if (document.elementFromPoint(x, y)?.closest('.vm-bag') === bag) return [fx, fy]; }
        return null;
      },
      bagPoint(fx, fy){
        const b = loose.find(q => q.kind === 'bag').body, f = feltStage.el.getBoundingClientRect(), a = b.r * Math.PI / 180;
        const lx = (fx - .5) * BW * b.s, ly = (fy - .5) * BH * b.s;
        return [f.left + b.x + lx * Math.cos(a) - ly * Math.sin(a), f.top + b.y - b.z + lx * Math.sin(a) + ly * Math.cos(a)];
      },
      chipPoint(){
        const at = c => [c.x, c.y - c.z - c.d * .5];
        const c = chips.find(q => { const [x, y] = at(q), e = document.elementFromPoint(x, y); return q.state === 'rest' && !e.closest('.vm-pile, .cm-card, .vm-loose, .cm-station, .cm-pad'); }) || chips[0];
        return at(c);
      }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0)); else setTimeout(setup, 0);
})();
