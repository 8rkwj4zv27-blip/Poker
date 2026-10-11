/* ============================================================
   CAREER SHOP — the packet shop under the hub's cabinet (lab only).

   The owner's brief (11 Oct): the shop is tucked under the cabinet.
   Tap its overhang (or SHOP) and it slides out, stops with a chunk, and
   the packets in it jump. Pick a packet, hold to buy, and it's opened on
   the hub's own felt (tear, pull, flick through the cards) by the pack
   opening (js/pack-opening.js, embedded); KEEP puts the cards into the
   deck. Two shops to compare (TUNE):
   - THE GLASS CASE: a lit, velvet-lined case, a compartment per edition,
     a spare behind each; the glass rides up once it's out.
   - THE SPINNER: a wire rack that lowers on its rod; drag it round (it
     clicks a column at a time); the packets hang and swing.
   Lab money, nothing saved. Plan: docs/career/SHOP_PLAN.md.
   ============================================================ */
window.PO_EMBED = true;   // the pack opening runs on the hub's felt, not its own table
(() => {
  'use strict';
  const { clamp, mix, snap, ease, tween, wait, glide, squash, puff, jolt, every, S, Foil, Haptic } = PO;
  const { Packet, AW, AH } = POPacket;
  const SERIES = [{ id:'house', name:'HOUSE', price:100 }, { id:'club', name:'CLUB', price:300 }, { id:'reserve', name:'RESERVE', price:1000 }];
  const BY = Object.fromEntries(SERIES.map(d => [d.id, d]));
  const SHOPS = { case:'GLASS CASE', spinner:'SPINNER' };
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const look = { shop:SHOPS[state.shop] ? state.shop : 'case' };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const SHOW = 22;                 // how much of the shop shows under the cabinet when it's in

  let M, E, root, bay, unit, ustage, over;
  let out = false, moving = false, opening = false, offered = null;
  let slots = [];                  // { p, series, home, stock?, col?, tier? }
  let geo = null;                  // the unit's sizes (per shop)
  let rot = 0, spin = null;        // the spinner's turn (degrees) and its coast
  const $ = q => root.querySelector(q);

  /* ---------------- the machine's screens ---------------- */
  // the hub's two CRTs, in its own markup: a caption over a figure
  function crt(side, cap, fig, ink){
    const box = $('.cm-crt-' + side); if (!box) return;
    const size = fig.length <= 5 ? ' crt-figure--lg' : fig.length > 8 ? ' sh-fig-sm' : '';
    box.innerHTML = `<div class="crt cm-crt is-pair"${ink ? ` data-ink="${ink}"` : ''}><span class="crt-caption">${cap}</span><span class="crt-figure${size}">${fig}</span></div>`;
  }
  // the pack opening narrates in long lines; the hub's screens are small,
  // so each line is put the machine's short way
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
    if (/ EDITION$/.test(title)) return ['HOLD TO', 'BUY', 'live'];
    if (title === 'NOT ENOUGH IN THE BANK'){ const p = offered && BY[offered.series]; return ['SHORT', p ? money(p.price - M.wallet) : '', 'danger']; }
    if (title === 'COUNT IN') return ['COUNT IN', sub, 'money'];
    if (title === 'YOUR HAND') return /FLICK/.test(sub) ? ['FLICK THE', 'WRAPPER'] : ['KEEP', 'THEM'];
    if (SHORT[title]) return SHORT[title];
    if (KIND[title]) return [sub.split(' · ')[0].toUpperCase(), KIND[title]];
    // a hand's name: the last word big
    const w = title.split(' '), last = w.pop();
    return [w.join(' ') || 'YOUR HAND', last];
  }
  const ui = {
    status(title, sub){
      const [cap, fig, ink] = shortly(title, sub);
      crt('r', cap, fig, ink);
      if (title === 'LEGENDARY!' && !ui.saidLegend){ ui.saidLegend = true; setTimeout(() => M.pipSay('surprised', 'A legendary. Don’t put your coffee on it.'), 1600); }
    },
    figure(n, label){ crt('l', label, n, /PRIZE|PRICE/.test(label) ? 'money' : ''); },
    key(label, sub, on){ playKey(label, on); },
    keySub(){},
    bank(v){ M.showBank(v); },
    bankEl:() => M.reelEl,
    flash(){
      root.querySelectorAll('.cm-crt').forEach(c => { c.classList.remove('is-legend'); void c.offsetWidth; c.classList.add('is-legend'); });
      S.stageLock(); Foil.thud(.8);
    }
  };
  function playKey(label, on = true){
    const b = M.keyEl('play');
    b.textContent = label; b.disabled = !on;
    b.classList.toggle('sh-long', label.length > 9);
  }
  function idleScreens(){
    crt('l', 'THE SHOP', 'OPEN');
    crt('r', look.shop === 'spinner' ? 'SPIN IT ·' : 'PICK A', look.shop === 'spinner' ? 'PICK' : 'PACKET');
  }

  /* ---------------- the hub's keys ---------------- */
  function keys(){
    const shop = M.keyEl('shop'), cards = M.keyEl('cards');
    shop.classList.toggle('is-pressed', out || opening); shop.classList.toggle('sh-latched', out || opening);
    shop.disabled = opening; cards.disabled = out || opening;
    if (!out && !opening){ playKey('PLAY'); M.keyEl('play').disabled = false; }
    else if (out && !offered) playKey('PICK ONE', false);
  }
  // the hub asks first: while the shop's out (or opening) its keys are ours
  function key(k){
    if (k === 'shop'){ if (!opening) toggle(); return true; }
    if (out || opening) return true;   // the middle key is held, not clicked (below)
    return false;
  }
  function screens(){ return out || opening; }

  /* ---------------- layout ---------------- */
  function rel(el){ const a = el.getBoundingClientRect(), r = root.getBoundingClientRect(); return { x:a.left - r.left, y:a.top - r.top, w:a.width, h:a.height }; }
  function measure(){
    const cab = rel($('.cm-cabinet')), f = rel($('.cm-felt'));
    const top = cab.y + cab.h;
    Object.assign(bay.style, { left:Math.round(f.x - 6) + 'px', top:Math.round(top) + 'px', width:Math.round(f.w + 12) + 'px', height:Math.round(f.y + f.h - top) + 'px' });
    Object.assign(over.style, { left:Math.round(f.x) + 'px', top:Math.round(f.y) + 'px', width:Math.round(f.w) + 'px', height:Math.round(f.h) + 'px' });
    return { bayW:f.w + 12, feltH:f.h, feltW:f.w, dy:f.y - top };
  }
  // where a packet on offer sits: on the felt under the shop, as big as fits
  function offerSpot(W, H){
    if (!out || !geo) return null;
    const m = measure(), below = geo.h - m.dy, room = H - below;
    const s = clamp((room - 46) / AH, .62, 1.3);
    return { x:W / 2, y:below + room * .47, s };
  }

  /* ---------------- build ---------------- */
  function build(){
    root = M.root;
    bay = document.createElement('div'); bay.className = 'sh-bay';
    over = document.createElement('section'); over.className = 'sh-over'; over.setAttribute('aria-label', 'The felt: your packet');
    over.innerHTML = '<div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>';
    root.append(bay, over);
    const ostage = { el:over, shadows:over.querySelector('.po-shadows'), objects:over.querySelector('.po-objects'), fx:over.querySelector('.po-fx') };
    E = PackOpeningEmbed;
    E.attach({
      root, stage:ostage, ui,
      wallet:() => M.wallet, setWallet:v => { M.wallet = v; dear(); },
      focus:offerSpot,
      layout:{ handY:.66, squareY:.66, wrapY:.42, railLift:66 },
      onPutBack:putBack, onBought:bought, stow, done
    });
    // the felt under the shop: a tap there puts the packet on offer back
    M.felt.addEventListener('pointerdown', () => { if (out && offered && !moving && E.state.phase === 'selected') E.putBack(); });
    // the middle key holds to buy, and is the opening's one key
    const k = M.keyEl('play');
    k.addEventListener('pointerdown', e => { if (!(out && offered) && !opening) return; try { k.setPointerCapture(e.pointerId); } catch (_) {} E.keyDown(); });
    k.addEventListener('pointerup', () => { if ((out && offered) || opening) E.keyUp(); });
    k.addEventListener('pointercancel', () => E.keyCancel());
    sheet();
    make(look.shop);
    new ResizeObserver(() => { if (!moving) relayout(); }).observe(root);
  }
  function sheet(){
    const s = $('#cm-sheet');
    s.querySelector('h2').textContent = 'CAREER · SHOP';
    s.querySelector('p').textContent = 'Tap the strip under the cabinet (or SHOP): the shop slides out. Tap a packet, then hold it (or the green key) to buy. Tear it, pull the cards, flick through them, KEEP: they go into your deck. Lab money, nothing saved.';
    const seg = (key, opts) => `<div class="cm-seg" data-shop="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;
    const html = `<h3>THE SHOP</h3>${seg('shop', SHOPS)}
      <h3>NEXT PACKET HOLDS</h3>${seg('contents', { surprise:'SURPRISE', legendary:'A LEGEND', none:'NO LEGEND', double:'TWO' })}
      <h3>SPEED · SOUND</h3>${seg('speed', { 1:'REAL', 0.5:'HALF', 0.25:'QUARTER' })}${seg('sound', { true:'SOUND ON', false:'OFF' })}
      <div class="cm-seg"><button class="pc-button pc-button-secondary" id="sh-credit">+$5,000</button></div>`;
    s.querySelector('#cm-done').parentNode.insertAdjacentHTML('beforebegin', html);
    s.querySelectorAll('[data-shop] button').forEach(b => b.onclick = async () => {
      const k = b.parentNode.dataset.shop, v = b.dataset.v;
      if (k === 'shop'){ if (v !== look.shop) await swap(v); }
      else { E.tune[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; E.applyTune(); }
      marks();
    });
    s.querySelector('#sh-credit').onclick = () => { M.wallet = M.wallet + 5000; dear(); if (offered && E.state.phase === 'selected'){ E.putBack(); } };
    marks();
  }
  function marks(){
    $('#cm-sheet').querySelectorAll('[data-shop] button').forEach(b => {
      const k = b.parentNode.dataset.shop, v = k === 'shop' ? look.shop : E.tune[k];
      b.setAttribute('aria-pressed', String(String(v) === b.dataset.v));
    });
  }

  /* ---------------- the two shops ---------------- */
  function make(kind){
    slots.forEach(s => { s.p.body.remove(); s.stock?.body.remove(); }); slots = [];
    bay.innerHTML = '';
    const m = measure();
    unit = document.createElement('div');
    unit.className = 'sh-unit sh-' + kind;
    bay.append(unit);
    geo = kind === 'case' ? caseGeo(m) : rackGeo(m);
    unit.style.width = Math.round(geo.w) + 'px'; unit.style.height = Math.round(geo.h) + 'px';
    unit.style.setProperty('--sh-show', SHOW + 'px');
    unit.innerHTML = kind === 'case' ? caseHTML(geo) : rackHTML(geo);
    const st = unit.querySelector('.sh-stage');
    ustage = { el:st, shadows:st.querySelector('.po-shadows'), objects:st.querySelector('.po-objects'), fx:st.querySelector('.po-fx') };
    setY(out ? 0 : -(geo.h - SHOW));
    unit.querySelector('.sh-pull').onclick = () => { if (!opening) toggle(); };
    unit.addEventListener('pointerdown', down);
    unit.addEventListener('pointermove', move);
    unit.addEventListener('pointerup', e => up(e, false));
    unit.addEventListener('pointercancel', e => up(e, true));
    if (kind === 'case') fillCase(); else fillRack();
    dear();
  }
  function relayout(){
    if (!unit) return;
    const m = measure(), g = look.shop === 'case' ? caseGeo(m) : rackGeo(m);
    if (Math.abs(g.w - geo.w) < 1 && Math.abs(g.h - geo.h) < 1) return;
    if (offered || opening) return;  // never under a packet in play
    make(look.shop);
  }
  async function swap(kind){
    const was = out;
    if (out) await close(true);
    look.shop = kind; if (host) host.set({ shop:kind });
    make(kind);
    if (was) await open();
  }
  const setY = y => { unit.style.transform = `translate(-50%,${Math.round(y)}px)`; unit.dataset.y = String(y); };
  // the shop's packets are drawn as they are in the pack opening, but each
  // packet is a little object: its own price tag, a jump, a swing
  function packet(series, pose, { stock = false } = {}){
    const p = new Packet(ustage, series, BY[series].price);
    p.body.set({ ...pose, z:0, sx:1, sy:1, alpha:1 });
    p.el.classList.add('sh-packet');
    if (stock){ p.el.classList.add('sh-stock'); p.tagEl.hidden = true; p.body.sh?.remove(); p.body.sh = null; }
    return p;
  }
  // a tag on a string, swung: a few stepped swings and it hangs still
  function swingTag(p, kick){
    if (!p.tagEl || p.tagEl.hidden || PO.reduced) return;
    let th = 0, om = kick;
    every(dt => {
      om += (-th * 80 - om * 4) * dt; th = clamp(th + om * dt, -50, 50);
      p.tagEl.style.transform = `rotate(${9 + snap(th, 6)}deg)`;
      if (Math.abs(th) < 1 && Math.abs(om) < 4){ p.tagEl.style.transform = ''; return false; }
    });
  }
  // packets you can't afford: their tags go dim
  function dear(){ for (const s of slots) s.p.el.classList.toggle('sh-dear', BY[s.series].price > M.wallet); }

  /* ---- the glass case ---- */
  const FR = 9, TOP = 22, DIV = 6, SHELF = 10, FOOT = 8, LIP = 12;
  function caseGeo(m){
    const w = m.bayW - 18, compW = (w - FR * 2 - DIV * 2) / 3;
    const budget = Math.min(m.feltH * .5, 250) + m.dy;
    const k = Math.max(.4, Math.min(.66, (compW - 30) / AW, (budget - TOP - SHELF - FOOT - LIP - 30) / AH));
    const compH = Math.round(AH * k + 26);
    return { kind:'case', w, h:TOP + compH + SHELF + FOOT + LIP + 8, compW, compH, k };
  }
  function caseHTML(g){
    // (the window's children sit inside it; the shelves sit in the case, inside its 3px border)
    const comps = SERIES.map((d, i) => `<div class="sh-comp" style="left:${i * (g.compW + DIV)}px;width:${g.compW}px"></div>`).join('');
    const divs = [1, 2].map(i => `<i class="sh-div" style="left:${i * (g.compW + DIV) - DIV}px;width:${DIV}px"></i>`).join('');
    const shelves = SERIES.map((d, i) => `<i class="ec-lip sh-shelf" style="left:${FR - 3 + i * (g.compW + DIV) - 2}px;width:${g.compW + 4}px"></i>`).join('');
    return `
      <div class="sh-case-body" style="--top:${TOP}px;--comp-h:${g.compH}px;--shelf:${SHELF}px">
        <div class="sh-window">${comps}${divs}</div>
        <div class="sh-stage"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div>
        ${shelves}
        <div class="sh-glass-frame"><div class="sh-glass"><i class="sh-glass-rail"></i></div></div>
        <div class="sh-case-top"><b>PACKETS</b></div>
        <i class="sh-case-foot"></i>
      </div>
      <button class="sh-pull" type="button" aria-label="The shop: pull it out"><i class="ec-lip sh-lip"></i><i class="sh-handle"></i></button>`;
  }
  function caseHome(i, back){
    const g = geo, x = FR + i * (g.compW + DIV) + g.compW / 2 - 5, y = TOP + g.compH - AH * g.k / 2 + 1;
    return back ? { x:x + 7, y:y - 4, s:g.k * .96, r:0 } : { x, y, s:g.k, r:[-2, 1, -1][i] };
  }
  function fillCase(){
    SERIES.forEach((d, i) => {
      const stock = packet(d.id, caseHome(i, true), { stock:true });
      const p = packet(d.id, caseHome(i, false));
      slots.push({ p, stock, series:d.id, i, home:caseHome(i, false) });
    });
  }
  // a bought packet: the spare comes forward, a new spare goes in behind
  function restockCase(s){
    s.p = s.stock; s.p.el.classList.remove('sh-stock');
    s.p.tagEl.hidden = false;
    const b = s.p.body, sh = document.createElement('i'); sh.className = 'po-shadow po-shadow-packet';
    sh.style.width = AW + 'px'; sh.style.height = AH + 'px'; ustage.shadows.append(sh); b.sh = sh; b.shW = AW; b.shH = AH;
    b.set({ ...s.home });
    s.stock = packet(s.series, caseHome(s.i, true), { stock:true });
    s.stock.el.style.zIndex = '1'; s.p.el.style.zIndex = '2';
    dear();
  }

  /* ---- the spinner ---- */
  const COLS = 6, STEP = 360 / COLS;
  function rackGeo(m){
    const w = m.bayW - 18, budget = Math.min(m.feltH * .54, 300) + m.dy;
    const rod = 34, cap = 16, foot = 20, gap = 22;
    const k = Math.max(.38, Math.min(.56, (budget - rod - cap - foot - gap * 2) / (AH * 2)));
    const tierH = AH * k + gap, R = Math.min(w * .3, 104);
    return { kind:'spinner', w, h:rod + cap + tierH * 2 + foot, rod, cap, tierH, k, R, cx:w / 2 };
  }
  function rackHTML(g){
    const ring = (y, half) => `<svg class="sh-ring is-${half}" style="top:${Math.round(y - 12)}px" width="${g.w}" height="24" viewBox="0 0 ${g.w} 24" shape-rendering="crispEdges"><ellipse cx="${g.cx}" cy="12" rx="${Math.round(g.R + 10)}" ry="9" fill="none"/></svg>`;
    const rings = [0, 1].map(t => g.rod + g.cap + t * g.tierH);
    return `
      <i class="sh-rod" style="left:${Math.round(g.cx - 2)}px;height:${g.rod + 4}px"></i>
      <i class="sh-pole" style="left:${Math.round(g.cx - 2)}px;top:${g.rod}px;height:${Math.round(g.h - g.rod - 14)}px"></i>
      ${rings.map(y => ring(y, 'back')).join('')}
      <div class="sh-stage"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div>
      ${rings.map(y => ring(y, 'front')).join('')}
      <i class="sh-cap" style="left:${Math.round(g.cx - g.R * .55)}px;top:${g.rod - 2}px;width:${Math.round(g.R * 1.1)}px"></i>
      <i class="sh-hooks"></i>
      <button class="sh-pull sh-finial-pull" type="button" aria-label="The shop: lower it"><i class="sh-finial"></i></button>`;
  }
  // the columns round the rack: two of each edition
  function rackPose(s){
    const g = geo, th = (s.col * STEP + rot) * Math.PI / 180, c = Math.cos(th);
    const y = g.rod + g.cap + s.tier * g.tierH + 6 + AH * g.k / 2 - (1 - c) * 4;
    return { x:g.cx + Math.sin(th) * g.R, y, s:g.k * (.84 + .16 * c), c, deg:snap(((s.col * STEP + rot) % 360 + 540) % 360 - 180, 9) };
  }
  function fillRack(){
    for (let col = 0; col < COLS; col++) for (let tier = 0; tier < 2; tier++){
      const series = SERIES[Math.floor(col / 2)].id, s = { series, col, tier };
      s.p = packet(series, { x:0, y:0, s:geo.k, r:0 });
      s.p.body.sh?.remove(); s.p.body.sh = null;     // hanging in the air: no shadow on anything
      slots.push(s);
    }
    turn(rot, true);
  }
  // draw the rack at a turn: each packet round the circle, turned to match,
  // nearer is bigger, brighter and in front; the far side isn't shown
  function turn(to, force){
    rot = to;
    const hooks = [];
    for (const s of slots){
      if (s.away) continue;
      const q = rackPose(s), b = s.p.body;
      s.home = { x:q.x, y:q.y, s:q.s, r:0 };
      const seen = q.c > -.2;
      s.p.el.style.visibility = seen ? '' : 'hidden';
      s.p.el.style.zIndex = String(100 + Math.round(q.c * 50) + s.tier);
      s.p.el.style.filter = q.c > .97 ? '' : `brightness(${snap(.45 + .55 * Math.max(0, q.c), .1).toFixed(1)})`;
      if (!s.swinging) b.set({ x:q.x, y:q.y, s:q.s });
      if (force || q.deg !== s.p.yaw){
        s.p.yaw = q.deg; s.p.face = Math.abs(q.deg) > 90 ? 'back' : 'front';
        b.set({ shx:Math.max(.12, Math.abs(Math.cos(q.deg * Math.PI / 180))) });
        s.p.draw();
      }
      if (seen && s.tier === 0) hooks.push(q);
    }
    // the hooks the packets hang from, in front of the ring
    const h = unit.querySelector('.sh-hooks');
    if (h) h.innerHTML = slots.filter(s => !s.away && s.tier < 2).map(s => {
      const q = rackPose(s); if (q.c <= -.2) return '';
      return `<i style="left:${Math.round(q.x - 1)}px;top:${Math.round(q.y - AH * q.s / 2 - 8)}px;opacity:${(.5 + .5 * Math.max(0, q.c)).toFixed(1)}"></i>`;
    }).join('');
  }
  const front = () => Math.round(-rot / STEP);   // the column facing you
  // the rack turns to a column, a click a column
  function turnTo(to, ms = 260){
    const from = rot;
    let lastCol = Math.round(-from / STEP);
    return tween(ms, e => {
      turn(mix(from, to, e));
      const c = Math.round(-rot / STEP);
      if (c !== lastCol){ lastCol = c; S.wheelTooth(.6, false); Haptic.tick(4, 30); }
    }, ease.back).then(() => { turn(to); S.wheelCatch(); });
  }
  // let go spinning: it coasts, clicking past each column, and settles on one
  function coast(v){
    spin?.stop?.();
    let vel = clamp(v, -900, 900), lastCol = front(), stopped = false;
    const stop = () => { stopped = true; };
    spin = { stop };
    every(dt => {
      if (stopped) return false;
      vel *= Math.pow(.06, dt);
      turn(rot + vel * dt);
      const c = front();
      if (c !== lastCol){ lastCol = c; S.wheelTooth(.5 + Math.min(.5, Math.abs(vel) / 900), false); Haptic.tick(4, 30); }
      if (Math.abs(vel) < 40){ spin = null; turnTo(Math.round(rot / STEP) * STEP, 220); return false; }
    });
  }
  // a hanging packet swings from its hook (pivot at its top edge)
  function swing(s, kick){
    if (PO.reduced) return;
    s.swinging = true;
    let th = 0, om = kick;
    every(dt => {
      if (!s.swinging) return false;
      om += (-th * 60 - om * 2.6) * dt; th += om * dt;
      const h = AH * s.home.s / 2, a = th * Math.PI / 180;
      s.p.body.set({ x:s.home.x - Math.sin(a) * h, y:s.home.y - h * (1 - Math.cos(a)), r:th });
      if (Math.abs(th) < .6 && Math.abs(om) < 3){ s.swinging = false; s.p.body.set({ ...s.home, r:0 }); return false; }
    });
  }

  /* ---------------- out and in ---------------- */
  function toggle(){ return out ? close() : open(); }
  function setOut(v){ out = v; bay.classList.toggle('is-out', v); }
  async function open(){
    if (out || moving || opening) return;
    moving = true; setOut(true);
    S.unlock(); Foil.unlock();
    keys(); idleScreens();
    if (M.cards) M.sweepAway();          // the felt's cleared for the counter
    const g = geo, from = -(g.h - SHOW);
    // it's let go: it runs out on its rails, faster as it comes, a tooth a step
    S.wheelRelease(); Haptic.tick(8);
    if (look.shop === 'spinner') turnTo(rot - STEP, 520);   // the rack turns a little as it comes down
    const teeth = 6;
    let tooth = 0;
    await tween(PO.reduced ? 1 : 380, e => {
      setY(mix(from, 0, e));
      const t = Math.floor(e * teeth);
      if (t > tooth){ tooth = t; S.wheelTooth(.5 + e * .4, false); Haptic.tick(3, 20); }
    }, ease.in);
    // CHUNK: it hits the stop, bounces, locks
    S.wheelBolt(); S.wheelLock(); Haptic.tick(24, 0);
    jolt($('.cm-cabinet'), 3); jolt(over, 2);
    if (!PO.reduced){ setY(7); await wait(40); setY(-3); await wait(45); setY(1); await wait(40); }
    setY(0);
    jump();
    if (look.shop === 'case') await glass(true);
    moving = false;
    keys();
  }
  async function close(quick){
    if (!out || moving) return;
    if (offered){ E.putBack(); await wait(PO.reduced ? 0 : 380); }
    moving = true;
    spin?.stop(); spin = null;
    if (look.shop === 'case') await glass(false);
    const g = geo, to = -(g.h - SHOW);
    S.wheelRelease(); Haptic.tick(8);
    const teeth = 5;
    let tooth = 0;
    await tween(PO.reduced ? 1 : quick ? 200 : 340, e => {
      setY(mix(0, to, e));
      const t = Math.floor(e * teeth);
      if (t > tooth){ tooth = t; S.wheelTooth(.6, false); Haptic.tick(3, 20); }
    }, ease.inOut);
    S.wheelLock(); jolt($('.cm-cabinet'), 2); Haptic.tick(14, 0);
    setOut(false); moving = false;
    keys(); M.screens();
    if (!quick && !M.cards && !opening){ M.busy = true; await M.takeIn([]); M.busy = false; }
  }
  // everything in the shop jumps at the stop (and the tags swing)
  function jump(){
    slots.forEach((s, i) => {
      const b = s.p.body, k = .7 + Math.random() * .6;
      if (look.shop === 'spinner'){ swing(s, (Math.random() < .5 ? -1 : 1) * (60 + Math.random() * 70)); return; }
      wait(i * 30).then(() => glide(b, { z:10 * k, r:b.r + (Math.random() - .5) * 6 }, 80, { easing:ease.out }))
        .then(() => glide(b, { z:0, r:s.home.r }, 130, { easing:ease.in }))
        .then(() => { squash(b, .09, 200); if (i === 0) Foil.thud(.35); });
      swingTag(s.p, (Math.random() < .5 ? -1 : 1) * (160 + Math.random() * 120));
      if (s.stock) wait(i * 30 + 20).then(() => glide(s.stock.body, { z:6 * k }, 80)).then(() => glide(s.stock.body, { z:0 }, 120, { easing:ease.in }));
    });
    Foil.crinkle();
  }
  // the case's glass: it rides up into the top once the case is out
  async function glass(up){
    const g = unit.querySelector('.sh-glass'); if (!g) return;
    const h = geo.compH + SHELF + 2, steps = 6;
    if (up){ Foil.scrape(); }
    for (let i = 1; i <= steps; i++){
      const t = up ? i / steps : 1 - i / steps;
      g.style.transform = `translateY(${Math.round(-h * t)}px)`;
      if (i % 2) Foil.scrape();
      if (!PO.reduced) await wait(26);
    }
    if (up) S.hatchOpen(); else { S.hatchClose(); Haptic.tick(8); }
  }

  /* ---------------- picking one ---------------- */
  // from the shop's stage to the felt's (the same place on screen)
  function reparent(p, to){
    const a = p.body.stage.el.getBoundingClientRect(), b = to.el.getBoundingClientRect();
    p.body.set({ x:p.body.x + a.left - b.left, y:p.body.y + a.top - b.top });
    to.objects.append(p.el); if (p.body.sh) to.shadows.append(p.body.sh);
    p.body.stage = to;
  }
  const overStage = () => ({ el:over, shadows:over.querySelector('.po-shadows'), objects:over.querySelector('.po-objects'), fx:over.querySelector('.po-fx') });
  async function take(s){
    if (!out || moving || opening) return;
    if (offered === s) return;
    const ph = E.state.phase;
    if (ph !== 'idle' && ph !== 'selected') return;
    if (offered){ E.putBack(); }
    moving = true;
    const b = s.p.body;
    s.swinging = false;
    S.cardReturn(); Foil.rustle(.6); Haptic.tick(6);
    // off its shelf (or its hook): it lifts, then comes out to you
    if (look.shop === 'spinner'){ s.away = true; await glide(b, { y:b.y - 7, z:4, r:0 }, 90, { easing:ease.out }); }
    else await glide(b, { z:8, y:b.y - 4, r:0 }, 80, { easing:ease.out });
    s.p.el.style.filter = ''; s.p.el.classList.remove('sh-stock');
    if (s.p.yaw){ s.p.yaw = 0; s.p.face = 'front'; b.set({ shx:1 }); s.p.draw(); }
    if (!b.sh){ const sh = document.createElement('i'); sh.className = 'po-shadow po-shadow-packet'; sh.style.width = AW + 'px'; sh.style.height = AH + 'px'; b.sh = sh; b.shW = AW; b.shH = AH; ustage.shadows.append(sh); }
    reparent(s.p, overStage());
    s.p.el.style.zIndex = '30';
    offered = s;
    moving = false;
    await E.offer(s.p);
  }
  // the opening hands it back: up to the shelf (or the hook) it came from
  async function putBack(p){
    const s = slots.find(q => q.p === p); if (!s) return;
    if (offered === s) offered = null;
    keys(); idleScreens();
    const to = s.home, us = ustage.el.getBoundingClientRect(), os = over.getBoundingClientRect();
    S.cardReturn();
    await glide(p.body, { x:to.x + us.left - os.left, y:to.y + us.top - os.top, s:to.s, r:to.r || 0, z:6 }, 300, { arc:20 });
    reparent(p, ustage);
    if (look.shop === 'spinner'){
      p.body.sh?.remove(); p.body.sh = null;
      s.away = false; p.body.set({ z:0 }); turn(rot, true); swing(s, 70);
      Foil.crinkle();
    } else {
      await glide(p.body, { z:0 }, 90, { easing:ease.in });
      p.el.style.zIndex = '2';
      Foil.thud(.3); squash(p.body, .07); swingTag(p, 140);
    }
  }

  /* ---------------- bought: the shop goes away, the felt is yours ---------------- */
  function bought(p){
    const s = offered; offered = null; opening = true;
    over.classList.add('is-live');
    // the shop slides back in under the cabinet while the packet's in the air
    (async () => {
      moving = true;
      if (look.shop === 'case') await glass(false);
      const g = geo, to = -(g.h - SHOW);
      S.wheelRelease();
      await tween(PO.reduced ? 1 : 300, e => setY(mix(0, to, e)), ease.inOut);
      S.wheelLock(); jolt($('.cm-cabinet'), 2);
      setOut(false); moving = false;
      keys();
      // restocked out of sight
      if (look.shop === 'case') restockCase(s);
      else { s.p = packet(s.series, { x:0, y:0, s:geo.k, r:0 }); s.p.body.sh?.remove(); s.p.body.sh = null; s.away = false; turn(rot, true); dear(); }
    })();
  }
  // KEEP: the squared hand flies into the deck, the way the table sweeps
  async function stow(fan){
    S.cardReturn();
    await Promise.all(fan.map((c, i) => { c.body.sh?.remove(); return DealerDeck.collect(c.el, i * 90).then(() => c.body.remove()); }));
  }
  async function done(cards){
    opening = false; ui.saidLegend = false;
    over.classList.remove('is-live');
    keys(); M.screens();
    M.busy = true;
    await M.takeIn(cards);
    M.busy = false;
    if (Math.random() < .35) M.pipSay('pleased', pickOne(['Four more for the deck.', 'I had a feeling about that one.', 'Smell that? New cards.']));
  }
  const pickOne = a => a[Math.floor(Math.random() * a.length)];

  /* ---------------- touch on the shop ---------------- */
  let ptr = null;
  function down(e){
    if (ptr || e.button > 0 || !out || moving || opening) return;
    const el = e.target.closest('.sh-packet'), s = el && slots.find(q => q.p.el === el);
    ptr = { id:e.pointerId, x0:e.clientX, y0:e.clientY, x:e.clientX, t:performance.now(), s, rot0:rot, hist:[{ x:e.clientX, t:performance.now() }] };
    if (look.shop === 'spinner'){ spin?.stop(); spin = null; }
    try { unit.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function move(e){
    if (!ptr || e.pointerId !== ptr.id) return;
    const now = performance.now();
    ptr.x = e.clientX; ptr.hist.push({ x:e.clientX, t:now }); while (ptr.hist.length > 2 && now - ptr.hist[0].t > 90) ptr.hist.shift();
    if (look.shop !== 'spinner') return;
    const dx = e.clientX - ptr.x0;
    if (Math.abs(dx) > 6) ptr.turning = true;
    if (!ptr.turning) return;
    const before = front();
    turn(ptr.rot0 + dx / geo.R * 57.3 * .9);
    if (front() !== before){ S.wheelTooth(.5, false); Haptic.tick(4, 30); }
  }
  function up(e, cancel){
    if (!ptr || e.pointerId !== ptr.id) return;
    const q = ptr; ptr = null;
    if (q.turning){
      const a = q.hist[0], b = q.hist[q.hist.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000);
      const fresh = performance.now() - b.t < 60;
      coast(fresh && !cancel ? (b.x - a.x) / dt / geo.R * 57.3 * .9 : 0);
      return;
    }
    if (cancel || !q.s) return;
    if (look.shop === 'spinner'){
      // a packet round the side: the rack brings it round first
      const want = -q.s.col * STEP, d = ((want - rot) % 360 + 540) % 360 - 180;
      if (Math.abs(d) > STEP / 2){ turnTo(rot + d, 320); return; }
      if (Math.abs(d) > 2) turnTo(rot + d, 160);
    }
    take(q.s);
  }

  /* ---------------- start ---------------- */
  function setup(){
    M = window.CareerMain;
    if (!M || !window.PackOpeningEmbed) return;
    build();
    E.applyTune();
    keys();
    window.CareerShop = {
      key, screens,
      get out(){ return out; },
      get state(){ return { shop:look.shop, out, moving, opening, offered:offered?.series ?? null, rot, front:((front() % COLS) + COLS) % COLS, wallet:M.wallet, cards:M.cards, deck:M.deck, pool:M.pool, open:E.state }; },
      open, close, swap
    };
  }
  // after the hub has built itself
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0)); else setTimeout(setup, 0);
})();
