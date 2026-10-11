/* ============================================================
   THE PACKET MACHINE — Career's shop as a vending machine (lab only).

   The owner's design (11 Oct, docs/career/VENDING_PLAN.md). SHOP on the
   hub: the space under the reel turns like the game's drum, a tooth at a
   time, and the machine rolls down and locks; its tube flickers on and
   the keys light row by row. Built like the Player Dashboard: one moulded
   frame, the checker case, sunk bays.
   - Choose: tap a packet or the cream key under it; again for another
     (the key's window shows how many). The credit CRT shows the last one
     touched, its price and the total; the four lamps its chances (lit:
     always, blinking: maybe, dark: never). CLEAR empties it.
   - Pay: hold the green key. Each chip leaves the reel as the table's own
     2.5D chip, comes down face showing, turns up onto its edge over the
     slot, pushes into the slit and goes in with a CHUNK.
   - Drop: a relay clicks, the key blinks, the motor hums; the packet tips
     off its shelf and falls the whole way, past the rows below, into the
     tray behind the ribbed PUSH flap, where it lands, bounces and lies
     where it lands. The spare behind slides forward. Now and then one
     sticks: the glass shimmers; tap the machine (twice) to knock it free.
   - Take: tap PUSH (or the key): the flap swings in, a packet comes out
     to you; turn it, shake it; flick it down to send it to the hub.
   - Back on the hub (SHOP again): the packets you sent drop onto the felt
     in a pile; tap one and it's opened there with the pack opening
     (js/pack-opening.js, embedded); KEEP puts the cards into the deck.
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
  const FLOOR = .46;     // how squashed the tray's floor is: seen from above

  let M, E, root, drum, vm, chipsEl, handEl, pileEl, openEl;
  let G = null;          // the window's geometry
  let slots = [], order = [], tray = [], pile = [], sent = 0;
  let mode = 'hub';      // hub · rolling · idle · paying · dispensing · stuck · taking · opening
  let shown = null;      // the edition the CRT is showing
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
          <div class="vm-floor-wrap"><div class="vm-stage vm-floor">${STAGE}</div></div>
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
  function region(){
    const row = rel($('.cm-row')), cab = rel($('.cm-cabinet')), felt = rel($('.cm-felt'));
    return { x:cab.x, y:row.y - 4, w:cab.w, h:felt.y + felt.h + 6 - (row.y - 4) };
  }
  function layout(){
    const r = region();
    Object.assign(drum.style, { left:r.x + 'px', top:r.y + 'px', width:r.w + 'px', height:r.h + 'px' });
    const con = rel($('.cm-console'));
    Object.assign(handEl.style, { left:'0', top:'0', width:'100%', height:Math.round(con.y - 4) + 'px' });
    const f = rel($('.cm-felt'));
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
  // the tray's floor: its depth seen squashed, so packets lie on it
  function sizeTray(){
    const tr = vq('.vm-tray'), w = vq('.vm-floor-wrap'), h = tr.clientHeight - 4;
    G.trayH = h; G.trayW = tr.clientWidth - 4;
    Object.assign(w.style, { height:Math.round(h / FLOOR) + 'px', transform:`scaleY(${FLOOR})` });
  }
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
    c.innerHTML = `<span class="crt-caption">${cap}</span><span class="crt-figure${fig.length > 7 ? ' vm-fig-sm' : ''}">${fig}</span><span class="vm-total">${line || ''}</span>`;
  }
  function panel(){
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
  function choose(s){
    if (mode !== 'idle' || !s) return;
    if (!s.id){ S.wheelRelay(.4); Foil.thud(.25); Haptic.tick(6); jolt(s.keyEl, 1); return; }
    if (s.count >= 9){ Foil.thud(.3); return; }
    s.count++; order.push(s); shown = s.id;
    S.counterTick(true); Haptic.tick(8);
    flip(s);
    // the packet answers: a little hop forward
    const b = s.p.body, f = frontPose(s);
    glide(b, { z:5, s:G.k * 1.05 }, 70, { easing:ease.out }).then(() => glide(b, { z:0, s:f.s }, 110, { easing:ease.in })).then(() => squash(b, .05, 140));
    panel(); keys();
  }
  function clearAll(){
    if (mode !== 'idle') return;
    if (!order.length){ shown = null; panel(); return; }
    S.wheelRelay(.6); Haptic.tick(10);
    const lit = slots.filter(s => s.count);
    order = []; shown = null;
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
    mode = 'idle'; shown = null;
    panel(); keys();
  }
  // how many chips, and of what colour, make the price
  function chipsFor(due){
    const n = clamp(Math.round(Math.sqrt(due / 22)), 2, 9);
    const each = due / n, tier = each < 40 ? 't0' : each < 120 ? 't1' : each < 400 ? 't2' : 't3';
    return Array.from({ length:n }, () => tier);
  }
  async function payChips(due){
    const cols = chipsFor(due), from = M.wallet, n = cols.length;
    const reel = rel(M.reelEl), slit = vq('.vm-slit');
    let paid = 0, slotFree = Promise.resolve();
    crt('PAID', money(0), 'OF ' + money(due), 'money');
    const flights = cols.map((col, i) => wait(PO.reduced ? 0 : i * 210).then(() => fly(col, reel, i)));
    for (let i = 0; i < n; i++){
      const chip = await flights[i];
      await slotFree;
      let done;
      slotFree = new Promise(r => { done = r; });
      await insert(chip, slit);
      paid = i === n - 1 ? due : Math.round(due * (i + 1) / n / 5) * 5;
      M.showBank(from - paid);
      crt('PAID', money(paid), 'OF ' + money(due), 'money');
      S.counterTick(true);
      done();
    }
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
  // (x, y) is the middle of the chip itself (edge-on, its band sits low in the sprite)
  function drawChip(c){
    if (c.frame !== c.tilt){ c.frame = c.tilt; c.el.style.backgroundImage = c.f.front[c.tilt]; }
    const oy = c.tilt >= 5 ? .69 : c.tilt >= 3 ? .62 : .56;
    c.el.style.transformOrigin = `50% ${oy * 100}%`;
    c.el.style.transform = `translate(${Math.round(c.x - c.d / 2)}px,${Math.round(c.y - c.h * oy)}px) rotate(${snap(c.rot, 15)}deg)`;
  }
  // up out of the reel, over, and down to just above the slot, turning as it comes
  async function fly(col, reel, i){
    const d = vm.classList.contains('is-compact') ? 26 : 30;
    const c = chipEl(col, d);
    c.clip.style.height = '100%';
    const sl = rel(vq('.vm-slit')), sx = sl.x + sl.w / 2, top = sl.y;
    const x0 = reel.x + reel.w * rr(.3, .7), y0 = reel.y + reel.h * .5, x1 = sx - 16, y1 = top - d * 1.7;
    const spin = (i % 2 ? 1 : -1) * rr(200, 320);
    S.chipBounce(.35); Haptic.tick(4);
    await tween(PO.reduced ? 1 : 440, (e, t) => {
      c.x = mix(x0, x1, e); c.y = mix(y0, y1, e) - Math.sin(t * Math.PI) * 54;
      c.rot = spin * (1 - e);
      c.tilt = t < .5 ? 1 : 2;
      drawChip(c);
    }, ease.inOut);
    c.hoverAt = performance.now();
    return c;
  }
  // over the slot it turns up onto its edge, lines up, pushes in, and CHUNK
  async function insert(c, slit){
    const sl = rel(slit), sx = sl.x + sl.w / 2, top = sl.y;
    // the slit's lip hides whatever's gone in
    c.clip.style.height = Math.round(top + 1) + 'px';
    const x0 = c.x, y0 = c.y;
    for (const [tilt, rot] of [[3, 30], [4, 60], [5, 90]]){
      c.tilt = tilt; c.rot = rot;
      c.x = mix(x0, sx, tilt / 5); c.y = mix(y0, top - c.d * .55, tilt / 5);
      drawChip(c);
      if (!PO.reduced) await wait(46);
    }
    Foil.scrape(); Haptic.tick(4, 40);
    if (!PO.reduced) await wait(70);
    // pushed in: it goes a third of the way and catches
    await tween(PO.reduced ? 1 : 120, e => { c.y = mix(top - c.d * .55, top - c.d * .12, e); drawChip(c); }, ease.out);
    c.x = sx + 1; drawChip(c);
    if (!PO.reduced) await wait(60);
    c.x = sx; drawChip(c);
    // CHUNK: the mechanism takes it
    c.y = top + c.d; drawChip(c);
    S.wheelBolt(); S.chipCollect(.7); Haptic.tick(18, 0);
    jolt(vq('.vm-plate'), 2);
    slit.classList.add('is-lit'); setTimeout(() => slit.classList.remove('is-lit'), 130);
    c.clip.remove();
    if (!PO.reduced) await wait(70);
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
    // where it will come to rest on the tray's floor
    const fx = clamp(rel(win, vm).x + b.x - rel(trEl, vm).x + rr(-30, 30), AW * G.k * .5, G.trayW - AW * G.k * .5);
    const fyFloor = G.trayH / FLOOR * rr(.42, .7);
    const trayTop = rel(trEl, vm).y, winTop = rel(win, vm).y;
    // in the machine's coordinates
    const x0 = rel(win, vm).x + b.x, y0 = winTop + b.y, tx = rel(trEl, vm).x + fx, ty = trayTop + 2 + (G.trayH - (G.trayH / FLOOR - fyFloor) * FLOOR);
    const g = 2400, dist = ty - y0 - AH * b.s * .15, T = Math.sqrt(2 * Math.max(40, dist) / g);
    const spin = pick([-1, 1]) * rr(1.1, 1.8), wob = pick([-1, 1]);
    let inTray = false, ph = .35;
    await tween(PO.reduced ? 1 : T * 1000, (e, t) => {
      const y = y0 + .5 * g * (t * T) ** 2, x = mix(x0, tx, t * t);
      // end over end: the face, its edge, its back, its edge…
      ph = .35 + spin * t * T * 2;
      const c = Math.cos(ph * Math.PI);
      const face = c < 0 ? 'back' : 'front';
      if (face !== p.face){ p.face = face; p.draw(); }
      // into the tray: behind the bay's edge and the ribbed flap
      if (!inTray && y > rel(trEl, vm).y - 2){ inTray = true; reparent(p, stageOf(vq('.vm-tfall'))); }
      const st = inTray ? rel(trEl, vm) : rel(win, vm);
      b.set({ x:x - st.x, y:y - st.y, sy:Math.max(.14, Math.abs(c)), r:wob * 9 * Math.sin(t * Math.PI * 1.5), s:G.k * (1.04 - .1 * t) });
    }, ease.lin);
    if (!inTray) reparent(p, stageOf(vq('.vm-tfall')));
    land(p, fx, fyFloor);
  }
  // down onto the floor: it lies where it lands, bounces once, slides, settles
  function land(p, fx, fy){
    const floor = stageOf(vq('.vm-floor'));
    floor.objects.append(p.el); p.body.stage = floor;
    if (p.face !== 'front' && Math.random() < .6){ p.face = 'front'; p.draw(); }
    const b = p.body, r0 = rr(-50, 50), s = G.k * .94;
    b.set({ x:fx, y:fy, z:0, r:r0, s, sx:1, sy:1 });
    const sh = document.createElement('i'); sh.className = 'po-shadow po-shadow-packet';
    Object.assign(sh.style, { width:AW + 'px', height:AH + 'px' }); floor.shadows.append(sh);
    b.sh = sh; b.shW = AW; b.shH = AH; b.dirty = true;
    tray.push(p);
    p.el.style.zIndex = String(10 + tray.length);
    // THUNK: the flap knocks, the machine jolts
    S.cardLanded(); Foil.thud(.75); Haptic.tick(20, 0);
    jolt(vm, 2); knock();
    puff(floor, fx, fy + AH * s * .3, AW * s, { n:6, colour:'#5a3a34' });
    squash(b, .12, 200);
    // one bounce, a slide, a turn
    const dx = rr(-18, 18), dr = rr(-24, 24);
    return glide(b, { z:26, x:fx + dx * .5, r:r0 + dr * .6 }, 120, { easing:ease.out })
      .then(() => glide(b, { z:0, x:fx + dx, r:r0 + dr }, 140, { easing:ease.in }))
      .then(() => { S.cardLanded(); Foil.thud(.3); squash(b, .06, 160); nudgeAround(p); })
      .then(() => glide(b, { x:clamp(fx + dx * 1.3, AW * s * .45, G.trayW - AW * s * .45), r:r0 + dr * 1.15 }, 160, { easing:ease.out }));
  }
  // packets it lands on are knocked aside
  function nudgeAround(p){
    const b = p.body;
    tray.forEach(q => {
      if (q === p) return;
      const o = q.body, dx = o.x - b.x, dy = (o.y - b.y) * FLOOR, d = Math.hypot(dx, dy), near = AW * b.s * .6;
      if (d > near) return;
      const k = (near - d) / near, ux = d ? dx / d : pick([-1, 1]);
      glide(o, { x:clamp(o.x + ux * 18 * k, AW * o.s * .45, G.trayW - AW * o.s * .45), r:o.r + rr(-14, 14) * k }, 160, { easing:ease.out });
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
    b.set({ x:r.left - hr.left + r.width / 2, y:r.top - hr.top + r.height / 2, s:G.k * .94, sy:FLOOR, z:0 });
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
    const fx = rr(.3, .7) * G.trayW, fy = G.trayH / FLOOR * .55;
    const tx = fr.left - hr.left + fx, ty = fr.top - hr.top + fy * FLOOR;
    S.cardReturn();
    await glide(p.body, { x:tx, y:ty, s:G.k * .94, sy:FLOOR, r:rr(-40, 40) }, 280, { arc:30, easing:ease.in });
    floor.objects.append(p.el); if (p.body.sh) floor.shadows.append(p.body.sh);
    p.body.stage = floor; p.body.set({ x:fx, y:fy, sy:1 });
    tray.push(p); S.cardLanded(); Foil.thud(.4);
    putAway();
  }
  async function putAway(){
    const dimEl = handEl.querySelector('.vm-dim');
    handEl.classList.remove('is-live');
    tween(200, e => { dimEl.style.opacity = snap(.6 * (1 - e), .15).toFixed(2); });
    const f = vq('.vm-flap');
    for (const a of [-48, -20, 6, 0]){ f.style.transform = a ? `perspective(220px) rotateX(${a}deg)` : ''; await wait(PO.reduced ? 0 : 45); }
    S.hatchClose(); Foil.thud(.3);
    mode = 'idle'; shown = null; panel(); keys();
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
    if (i != null && !isNaN(i)){ e.preventDefault(); choose(slots[i]); }
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
    shown = null; panel(); crt('', '', '');
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
  let pileStage = null, pileKids = [];
  function pileBox(){
    const f = rel($('.cm-felt')), w = Math.min(150, f.w * .42), h = 150;
    Object.assign(pileEl.style, { left:Math.round(f.x + f.w - w - 14) + 'px', top:Math.round(f.y + 16) + 'px', width:Math.round(w) + 'px', height:h + 'px' });
    pileStage = stageOf(pileEl.querySelector('.vm-stage'));
    return { w, h };
  }
  // the ones you sent drop onto the felt, one on top of another
  async function dropPile(){
    const { w, h } = pileBox(), s = .58;
    const fresh = pile.slice(pileKids.length);
    for (const series of fresh){
      const p = new Packet(pileStage, series, 0);
      p.tagEl.hidden = true; p.el.classList.add('vm-packet');
      const n = pileKids.length, x = w / 2 + rr(-18, 18), y = h / 2 + rr(-10, 10), r = rr(-28, 28);
      p.body.set({ x, y:-70, s, r:r - 40, z:30, sx:1, sy:1 });
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
    if (mode !== 'hub' || !pileKids.length) return;
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
    'RARE!':['A', 'RARE', 'live'], 'LEGENDARY!':['A', 'LEGEND', 'money'], '…':['', '…'],
    'KEEPING THEM':['INTO YOUR', 'DECK'], 'COUNT IN':['COUNT IN', '', 'money']
  };
  const KIND = { 'TABLE EVENT':'TABLE', 'FREEZEOUT':'FREEZE', 'BOMB':'BOMB', 'WILD EVENT':'WILD' };
  function shortly(title, sub){
    if (title === 'COUNT IN') return ['COUNT IN', sub, 'money'];
    if (title === 'YOUR HAND') return /FLICK/.test(sub) ? ['FLICK THE', 'WRAPPER'] : ['KEEP', 'THEM'];
    if (SHORT[title]) return SHORT[title];
    if (KIND[title]) return [sub.split(' · ')[0].toUpperCase(), KIND[title]];
    const w = title.split(' '), last = w.pop();
    return [w.join(' ') || 'YOUR HAND', last];
  }
  let saidLegend = false;
  function attachOpening(){
    E = window.PackOpeningEmbed;
    if (!E) return;
    E.attach({
      root, stage:stageOf(openEl),
      ui:{
        status(title, sub){
          const [cap, fig, ink] = shortly(title, sub || '');
          hubCrt('r', cap, fig, ink);
          if (title === 'LEGENDARY!' && !saidLegend){ saidLegend = true; setTimeout(() => M.pipSay('surprised', 'A legendary. Don’t put your coffee on it.'), 1600); }
        },
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
      async stow(fan){
        S.cardReturn();
        await Promise.all(fan.map((c, i) => { c.body.sh?.remove(); return DealerDeck.collect(c.el, i * 90).then(() => c.body.remove()); }));
      },
      done(cards){
        mode = 'hub'; saidLegend = false;
        openEl.classList.remove('is-live');
        M.addToCase(cards);
        keys(); M.screens();
        if (Math.random() < .35) M.pipSay('pleased', pick(['Four more for the deck.', 'I had a feeling about that one.', 'Smell that? New cards.']));
      }
    });
  }

  /* ---------------- the lab's sheet ---------------- */
  function sheet(){
    const s = $('#cm-sheet');
    s.querySelector('h2').textContent = 'CAREER · THE PACKET MACHINE';
    s.querySelector('p').textContent = 'SHOP rolls the machine down. Tap packets (again for another), hold the green key to pay, watch them drop. Tap PUSH to take one: turn it, shake it, flick it down to send it. SHOP again: they wait on the felt; tap one to open it. Lab money, nothing saved.';
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
    s.querySelector('#vm-credit').onclick = () => { M.wallet = M.wallet + 5000; };
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
    window.CareerShop = {
      key, screens,
      get out(){ return mode !== 'hub'; },
      keepOff:() => pileKids.length ? pileEl.getBoundingClientRect() : null
    };
    pileBox(); layout(); keys();
    new ResizeObserver(() => { if (mode === 'idle'){ layout(); } else if (mode === 'hub'){ layout(); pileBox(); } }).observe(root);
    // read-only diagnostics for the lab's checks
    window.VendingLab = {
      get state(){ return { mode, cols:G?.C, rows:G?.R, k:G?.k, order:order.map(s => s.id), total:total(), wallet:M.wallet, tray:tray.length, inHand:!!inHand, pile:pile.length, stuck:!!stuckP, deck:M.pool, cards:M.cards, open:E.state.phase }; },
      slots:() => slots.map(s => ({ i:s.i, id:s.id, r:s.r, c:s.c, count:s.count }))
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0)); else setTimeout(setup, 0);
})();
