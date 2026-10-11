/* ============================================================
   VENDING STILLS — the packet machine, still (lab only; nothing moves).

   The owner's brief (11 Oct): the shop is a vending machine that rolls
   down with the wheel in place of the hub's felt. A cigarette machine
   crossed with an old vending machine: packets face-out in a lit window,
   CARD PACKETS painted on the glass (TUNE turns it off), a price tag and
   a chunky cream button under each packet (tap again for another: a flip
   counter), the drop well the packet falls the whole way down, a plastic
   PUSH flap. Beside it a chunky dashboard over red velvet: the credit
   CRT, the chip slot, the rarity lamps (steady = always, flicker =
   maybe), five pips (cards guaranteed), CLEAR. Bought packets fan out in
   your hand (flick down to send) and wait on the hub's felt.
   Every still is a frame of that, for the owner to judge on the phone.
   ============================================================ */
(() => {
  'use strict';
  const { Packet, AW, AH } = POPacket;
  const SERIES = [{ id:'house', name:'HOUSE', price:100 }, { id:'club', name:'CLUB', price:300 }, { id:'reserve', name:'RESERVE', price:1000 }];
  // what each edition promises: per rarity 'steady' (always), 'flicker' (maybe) or off; cards for sure (of five)
  const ODDS = {
    house:{ common:'steady', uncommon:'flicker', rare:'flicker', legendary:'', cards:3 },
    club:{ common:'steady', uncommon:'steady', rare:'flicker', legendary:'flicker', cards:4 },
    reserve:{ common:'', uncommon:'steady', rare:'steady', legendary:'flicker', cards:5 }
  };
  const RAR = [['common', 'C', 'COMMON'], ['uncommon', 'UC', 'UNCOMMON'], ['rare', 'R', 'RARE'], ['legendary', 'L', 'LEGEND']];
  const STILLS = {
    idle:'1 · LIT, WAITING', chosen:'2 · TWO CHOSEN', coin:'3 · A CHIP IN THE SLOT', falling:'4 · FALLING',
    tray:'5 · IN THE TRAY', stuck:'6 · STUCK', hand:'7 · IN YOUR HAND', hub:'8 · WAITING ON THE HUB'
  };
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const look = { still:STILLS[state.still] ? state.still : 'idle', paint:state.paint !== 'off', tray:state.tray === 'window' ? 'window' : 'flap' };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');

  let M, root, vm, made = [];
  const $ = q => root.querySelector(q);

  /* ---------------- the hub around it ---------------- */
  function crt(side, cap, fig, ink){
    const size = fig.length <= 5 ? ' crt-figure--lg' : '';
    $('.cm-crt-' + side).innerHTML = `<div class="crt cm-crt is-pair"${ink ? ` data-ink="${ink}"` : ''}><span class="crt-caption">${cap}</span><span class="crt-figure${size}">${fig}</span></div>`;
  }
  function keys(mid, on = true){
    const shop = M.keyEl('shop'), play = M.keyEl('play'), cards = M.keyEl('cards');
    const inShop = look.still !== 'hub';
    shop.classList.toggle('is-pressed', inShop);
    play.textContent = mid; play.disabled = !on; play.style.fontSize = mid.length > 9 ? '9px' : '';
    cards.disabled = inShop;
  }

  /* ---------------- the machine ---------------- */
  const keyHTML = (d, i) => `<span class="vm-key-wrap"><span class="vm-key" data-i="${i}"><i></i></span><b class="vm-flip is-zero">0</b></span>`;
  function build(){
    vm = document.createElement('section');
    vm.className = 'vm'; vm.setAttribute('aria-label', 'The packet machine');
    vm.innerHTML = `
      <div class="vm-front">
        <div class="vm-bezel vm-show">
          <div class="vm-back"></div><i class="vm-tube"></i>
          <div class="vm-stage"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div>
          <i class="ec-lip vm-shelf"></i>
          <div class="vm-tags">${SERIES.map(d => `<span class="vm-tag">${d.price.toLocaleString('en-US')}<small>$</small></span>`).join('')}</div>
          <div class="vm-glass"></div><div class="vm-shimmer"></div>
          <div class="vm-paint">CARD PACKETS</div>
        </div>
        <div class="vm-rail">${SERIES.map(keyHTML).join('')}</div>
        <div class="vm-bezel vm-well">
          <div class="vm-back"></div>
          <div class="vm-stage"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div>
          <i class="vm-ledge"></i><div class="vm-guts"></div><div class="vm-glass"></div>
        </div>
        <div class="vm-tray"><i class="vm-mouth"></i>
          <div class="vm-stage"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div>
          <div class="vm-flap"><b>PUSH</b></div>
        </div>
      </div>
      <aside class="vm-side">
        <div class="crt vm-crt" id="vm-crt"></div>
        <div class="vm-slot"><div class="vm-plate"><i class="vm-well-ring"></i><i class="vm-slit"></i></div></div>
        <div class="vm-label">CHANCES</div>
        <div class="vm-lamps">${RAR.map(([r, c]) => `<div class="vm-lamp-row" data-r="${r}"><i class="vm-lamp"></i><span>${c}</span></div>`).join('')}
          <div class="vm-legend"><i class="vm-lamp is-steady"></i> ALWAYS<br><i class="vm-lamp is-flicker"></i> MAYBE</div></div>
        <div class="vm-label">CARDS FOR SURE</div>
        <div class="vm-pips">${[0, 1, 2, 3, 4].map(() => '<i class="vm-pip"></i>').join('')}</div>
        <div class="vm-clear">CLEAR</div>
        <div class="vm-velvet"></div>
      </aside>`;
    root.append(vm);
  }
  const stageOf = el => ({ el, shadows:el.querySelector('.po-shadows'), objects:el.querySelector('.po-objects'), fx:el.querySelector('.po-fx') });
  function rel(el){ const a = el.getBoundingClientRect(), r = root.getBoundingClientRect(); return { x:a.left - r.left, y:a.top - r.top, w:a.width, h:a.height }; }
  // the machine takes the felt's place, out to the edges of its rim
  function place(){
    const f = rel($('.cm-felt'));
    Object.assign(vm.style, { left:Math.round(f.x - 10) + 'px', top:Math.round(f.y - 10) + 'px', width:Math.round(f.w + 20) + 'px', height:Math.round(f.h + 18) + 'px' });
  }
  // the window sized to its packets: room for the paint, the packet, the shelf and the tags
  let k = .7;
  function sizeWindow(){
    const show = $('.vm-show'), w = show.clientWidth, col = w / 3;
    // a short screen squeezes the machine: smaller tray and keys, lamps in a square
    const tall = vm.clientHeight;
    vm.classList.toggle('is-compact', tall < 560);
    const rest = (tall < 560 ? 40 + 52 + 34 : 48 + 84 + 70) + 30 + 40 + 26;
    k = Math.max(.42, Math.min(.84, (col - 8) / AW, (tall - rest) / AH));
    const shelfY = 40 + Math.round(AH * k);
    show.style.height = (shelfY + 30) + 'px';
    $('.vm-shelf').style.top = shelfY + 'px';
    $('.vm-tags').style.top = (shelfY + 4) + 'px';
    vm.style.setProperty('--vm-paint', Math.max(12, Math.min(18, Math.floor(w / 12.5))) + 'px');
    // the well's insides: each column's guide rails and its gate
    const well = $('.vm-well'), ww = well.clientWidth, wc = ww / 3;
    $('.vm-guts').innerHTML = [0, 1, 2].map(i => `<i class="vm-guide" style="left:${Math.round(wc * i + wc / 2 - AW * k * .5 - 7)}px"></i><i class="vm-guide" style="left:${Math.round(wc * i + wc / 2 + AW * k * .5 + 3)}px"></i><i class="vm-gate" data-i="${i}" style="left:${Math.round(wc * i + wc / 2 - AW * k * .5 - 4)}px;width:${Math.round(AW * k + 8)}px"></i>`).join('');
    return { col, shelfY, wc };
  }

  /* ---------------- packets ---------------- */
  function packet(stage, series, pose, { stock = false, alpha = 1 } = {}){
    const p = new Packet(stage, series, 0);
    p.tagEl.hidden = true;
    p.body.set({ z:0, sx:1, sy:1, ...pose, alpha });
    if (stock){ p.el.querySelectorAll('canvas').forEach(c => { c.style.filter = 'brightness(.42)'; }); p.body.sh?.remove(); p.body.sh = null; }
    made.push(p);
    return p;
  }
  function clearPackets(){ made.forEach(p => p.body.remove()); made = []; }
  // the window's packets: a spare behind each, the front one standing on the shelf
  function fillWindow(g, { gone = [], stuck = null } = {}){
    const st = stageOf($('.vm-show .vm-stage'));
    SERIES.forEach((d, i) => {
      const x = g.col * (i + .5), y = g.shelfY - AH * k / 2 + 2;
      packet(st, d.id, { x:x + 5, y:y - 4, s:k * .97 }, { stock:true });
      if (gone.includes(d.id)) return;
      if (stuck === d.id){ packet(st, d.id, { x:x + 1, y:y + AH * k * .2, s:k, sy:.72, r:7 }); return; }
      packet(st, d.id, { x, y, s:k, r:[-1, 0, 1][i] });
    });
  }
  function chosen(counts){
    vm.querySelectorAll('.vm-key').forEach((b, i) => {
      const n = counts[SERIES[i].id] || 0, f = b.parentNode.querySelector('.vm-flip');
      b.classList.toggle('is-on', n > 0);
      f.textContent = String(n); f.classList.toggle('is-zero', !n);
    });
  }
  function panel(series, total, paid){
    const d = SERIES.find(s => s.id === series), o = ODDS[series];
    $('#vm-crt').innerHTML = d
      ? `<span class="crt-caption">${d.name}</span><span class="crt-figure">${money(d.price)}</span><span class="vm-total">${paid != null ? 'PAID ' + money(paid) : total ? 'TOTAL ' + money(total) : 'EDITION'}</span>`
      : '<span class="crt-caption">PICK A</span><span class="crt-figure">PACKET</span><span class="vm-total">TAP ONE</span>';
    vm.querySelectorAll('.vm-lamp-row').forEach(r => {
      const s = o ? o[r.dataset.r] : '';
      r.classList.toggle('is-flicker', s === 'flicker');
      r.querySelector('.vm-lamp').className = 'vm-lamp' + (s ? ' is-' + s : '');
    });
    vm.querySelectorAll('.vm-pip').forEach((p, i) => p.classList.toggle('is-on', !!o && i < o.cards));
  }

  /* ---------------- a chip: the table's own 2.5D sprite ---------------- */
  // tilt: 0 = flat face up (at the table's tilt) … 5 = edge-on; turn: degrees
  // (x, y) is the middle of the chip itself: edge-on, its band sits low in the sprite
  function chip(colour, d, tilt, x, y, turn = 0, alpha = 1, clipTo = null){
    const f = CoinWorld.frames(colour, d), hr = CoinWorld.HR(), h = Math.round(d * hr), oy = tilt >= 5 ? .69 : .56;
    const el = document.createElement('i');
    el.className = 'vm-chip';
    Object.assign(el.style, { width:d + 'px', height:h + 'px', backgroundImage:f.front[tilt], opacity:String(alpha), transformOrigin:`50% ${oy * 100}%`,
      left:Math.round(x - d / 2) + 'px', top:Math.round(y - h * oy) + 'px', transform:turn ? `rotate(${turn}deg)` : '', filter:'drop-shadow(1px 2px 0 rgba(0,0,0,.6))' });
    if (!clipTo){ vm.append(el); return el; }
    const c = document.createElement('div'); c.className = 'vm-chip-clip';
    Object.assign(c.style, clipTo);
    el.style.left = (parseFloat(el.style.left) - parseFloat(clipTo.left)) + 'px';
    el.style.top = (parseFloat(el.style.top) - parseFloat(clipTo.top)) + 'px';
    c.append(el); vm.append(c);
    return el;
  }

  /* ---------------- the stills ---------------- */
  function show(){
    clearPackets();
    vm.querySelectorAll('.vm-chip, .vm-chip-clip, .vm-hand').forEach(e => e.remove());
    root.querySelectorAll('.vm-pile').forEach(e => e.remove());
    vm.classList.toggle('no-paint', !look.paint);
    vm.classList.remove('is-stuck');
    $('.vm-tray').classList.toggle('is-window', look.tray === 'window');
    $('.vm-flap').classList.remove('is-bumped');
    const s = look.still;
    vm.hidden = s === 'hub';
    window.CareerShop.out = s !== 'hub';
    if (s === 'hub') return hub();
    place();
    const g = sizeWindow();
    crt('l', 'THE SHOP', 'OPEN'); crt('r', 'WAITING', '0');
    if (s === 'idle'){ fillWindow(g); chosen({}); panel(null); keys('PICK ONE', false); }
    if (s === 'chosen'){ fillWindow(g); chosen({ club:2, house:1 }); panel('club', 700); keys('HOLD TO BUY'); }
    if (s === 'coin') coin(g);
    if (s === 'falling') falling(g);
    if (s === 'tray') tray(g);
    if (s === 'stuck'){ fillWindow(g, { stuck:'club' }); chosen({ club:1 }); panel('club', 300, 300); vm.classList.add('is-stuck'); keys('…', false); crt('r', 'WAITING', '0'); }
    if (s === 'hand') hand(g);
  }
  function coin(g){
    fillWindow(g); chosen({ club:2, house:1 }); panel('club', 700, 450); keys('HOLD TO BUY');
    M.showBank(M.wallet - 450);
    // one chip pushing into the slit, turned on its edge; the next on its way down, face up
    const v = vm.getBoundingClientRect(), sl = $('.vm-slit').getBoundingClientRect(), b = 3;
    const sx = sl.left - v.left - b + sl.width / 2, top = sl.top - v.top - b;
    const d = 30;
    // halfway in: turned up on its edge; below the slit's lip it's gone
    chip('t2', d, 5, sx, top + 4, 90, 1, { left:(sx - 22) + 'px', top:(top - 44) + 'px', width:'44px', height:'45px' });
    // the next, coming down from the reel, face showing, starting to turn
    const up = vm.classList.contains('is-compact') ? 28 : 42;
    chip('t2', d + 4, 1, sx - 16, top - up, -16);
  }
  function falling(g){
    fillWindow(g, { gone:['club'] }); chosen({ club:1, house:1 }); panel('club', 700, 700); keys('…', false);
    const well = $('.vm-well'), st = stageOf(well.querySelector('.vm-stage')), x = g.wc * 1.5, y = well.clientHeight * .5, s = k * .96;
    well.querySelector('.vm-gate[data-i="1"]').classList.add('is-open');
    // the spare behind is already sliding forward into the window
    const show = stageOf($('.vm-show .vm-stage'));
    packet(show, 'club', { x:x + 2, y:g.shelfY - AH * k / 2, s:k * .985 });
    // falling: a step of the pose a frame, a faint trail of the last two
    packet(st, 'club', { x, y:y - 46, s, r:-2 }, { alpha:.14 });
    packet(st, 'club', { x, y:y - 22, s, r:-5 }, { alpha:.3 });
    packet(st, 'club', { x, y, s, r:-8, sy:.95 });
  }
  function tray(g){
    fillWindow(g); chosen({}); panel('club'); keys('…', false);
    crt('r', 'IN THE', 'TRAY', 'live');
    const t = $('.vm-tray'), st = stageOf(t.querySelector('.vm-stage')), w = t.clientWidth, s = k * .74;
    const m = vm.classList.contains('is-compact') ? 7 : 12;
    packet(st, 'house', { x:w * .34, y:AH * s / 2 + m + 2, s, r:-9 });
    packet(st, 'club', { x:w * .52, y:AH * s / 2 + m, s, r:4 });
    packet(st, 'club', { x:w * .68, y:AH * s / 2 + m + 4, s, r:13 });
  }
  function hand(g){
    fillWindow(g); chosen({}); panel(null);
    keys('SEND ALL');
    crt('r', 'FLICK DOWN', 'SEND', 'live');
    const h = document.createElement('div'); h.className = 'vm-hand';
    Object.assign(h.style, { left:'0', top:'0', width:'100%', height:'100%' });
    h.innerHTML = '<i class="vm-dim"></i><div class="vm-stage"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div>';
    vm.append(h);
    const st = stageOf(h.querySelector('.vm-stage')), W = vm.clientWidth, H = vm.clientHeight, s = Math.min(1.3, W / (AW * 3.1));
    [['house', -1], ['club', 0], ['club', 1]].forEach(([id, i]) => packet(st, id, { x:W / 2 + i * AW * s * .72, y:H * .6 + Math.abs(i) * 10, s, r:i * 11, z:i ? 0 : 6 }));
  }
  function hub(){
    crt('l', 'IN HAND', '0'); crt('r', 'WAITING', '3', 'live');
    keys('PLAY');
    const f = rel($('.cm-felt')), box = document.createElement('div');
    box.className = 'vm-pile';
    const w = 130, h = 150;
    Object.assign(box.style, { left:Math.round(f.x + f.w - w - 18) + 'px', top:Math.round(f.y + 22) + 'px', width:w + 'px', height:h + 'px' });
    box.innerHTML = '<div class="vm-stage"><div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div></div>';
    root.append(box);
    const st = stageOf(box.querySelector('.vm-stage')), s = .66;
    [['house', -16, -8, 6], ['club', 9, 10, 0], ['club', -3, -2, -8]].forEach(([id, r, dx, dy]) => packet(st, id, { x:w / 2 + dx, y:h / 2 + dy, s, r }));
  }

  /* ---------------- the sheet ---------------- */
  function sheet(){
    const s = $('#cm-sheet');
    s.querySelector('h2').textContent = 'PACKET MACHINE · STILLS';
    s.querySelector('p').textContent = 'Stills of the vending machine that rolls down in place of the felt. Nothing moves yet: pick a still, then try the glass with or without its paint, and the two trays.';
    const seg = (key, opts) => `<div class="vm-sheet-seg" data-vm="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;
    s.querySelector('#cm-done').parentNode.insertAdjacentHTML('beforebegin', `<h3>STILL</h3>${seg('still', STILLS)}
      <h3>PAINT ON THE GLASS</h3>${seg('paint', { on:'CARD PACKETS', off:'OFF' })}
      <h3>THE TRAY</h3>${seg('tray', { flap:'PUSH FLAP', window:'SMOKED WINDOW' })}`);
    s.querySelectorAll('[data-vm] button').forEach(b => b.onclick = () => {
      const key = b.parentNode.dataset.vm, v = b.dataset.v;
      look[key] = key === 'paint' ? v === 'on' : v;
      if (host) host.set({ [key]:key === 'paint' ? (look.paint ? 'on' : 'off') : v });
      marks(); show();
    });
    marks();
  }
  function marks(){
    $('#cm-sheet').querySelectorAll('[data-vm] button').forEach(b => {
      const key = b.parentNode.dataset.vm, v = key === 'paint' ? (look.paint ? 'on' : 'off') : look[key];
      b.setAttribute('aria-pressed', String(v === b.dataset.v));
    });
  }

  /* ---------------- start ---------------- */
  function setup(){
    M = window.CareerMain;
    if (!M) return;
    root = M.root;
    // the hub's keys and screens are the machine's while it's down
    window.CareerShop = { key:() => look.still !== 'hub', screens:() => true, out:false };
    build(); sheet();
    // the hub's cards are swept into the deck before the machine comes down
    setTimeout(async () => { await M.sweepAway(); show(); }, 3200);
    show();
    new ResizeObserver(() => show()).observe(root);
    window.VendingStills = { get look(){ return { ...look }; }, show:v => { look.still = v; show(); } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0)); else setTimeout(setup, 0);
})();
