"use strict";

/* ============================================================
   PACK LAB — the machine, the rip, the reveal, the case, the feed
   (lab only, never loaded by the game)

   Runs inside the game copy that pack-lab.html builds. Career's screen is
   replaced by the pack vendor:

     MACHINE  six rows of packs on coils. Pick a row, BUY: chips go in the
              slot, the coil turns, the pack catches, wobbles and drops
              into the tray. Tap the tray.
     STAGE    the pack in your hand. Drag across the top: the tear follows
              your finger. The cards push up, the wrapper falls away, and
              you flick through them. Rares make the machine hesitate.
     CASE     the cards file into the ticket case: a page per pack, empty
              slots for what's still out there, ×2 for duplicates.
     FEED     a card goes into the machine and on to a real table (the
              game's own buy-in, depart roll and Table Intro).

   Money: the lab spends the in-memory Career bankroll (the copy never
   touches a real save). Every card that plays runs an existing event.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : {};
  const defaults = { phase:'early', speed:1, force:'normal', sound:'on', autorip:'off' };
  Object.keys(defaults).forEach(k => { if (state[k] == null) state[k] = defaults[k]; });
  const save = patch => { Object.assign(state, patch); if (host) host.set(patch); };

  const T = PackArt.TIERS;
  const ROWS = T.slice().reverse();           // top of the glass: gold
  const speed = () => Number(state.speed) || 1;
  const wait = ms => new Promise(r => setTimeout(r, ms / speed()));
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const money = PackCards.money;
  const buzz = p => { try{ haptic(p); }catch(e){} };
  let root, glassCv, glassCtx, dropCv, dropCtx, S = 3;
  const GW = 70, COL_W = 22;
  let GH = 171, ROW_H = 28;

  /* ---- the lab's world: what you own, which rows are open ---- */
  const world = { owned:{}, fresh:new Set(), open:2, selected:0, tray:null, busy:false, view:'machine', caseTier:'alley' };
  function seedWorld(){
    world.owned = {}; world.fresh = new Set();
    const give = (id, n) => { world.owned[id] = (world.owned[id] || 0) + (n || 1); };
    if (state.phase === 'late'){
      world.open = 6;
      PackCards.LIST.forEach((c, i) => { if (c.kind !== 'chips' && (PackCards.RANK[c.rarity] < 2 || i % 3 === 0)) give(c.id, 1 + (i % 4 === 0 ? 1 : 0) + (c.rarity === 'common' ? 1 : 0)); });
      delete world.owned['gold-01'];
    } else {
      world.open = 2;
      ['alley-01', 'alley-02', 'alley-04'].forEach(id => give(id));
      give('alley-01');
    }
    world.selected = ROWS.findIndex(t => t.id === 'alley');
    setupCareer();
  }
  /* The copy's Career: every event playable, the bankroll the phase's. */
  function setupCareer(){
    try{
      if (typeof career === 'undefined' || !career) return;
      career.active = null; career.cash = null;
      CAREER_EVENT_LIST.forEach(e => { career.unlocks[e.id] = true; });
      career.bankroll = state.phase === 'late' ? 64000 : 640;
      saveCareer();
    }catch(e){}
  }
  const bank = () => { try{ return careerBankroll(); }catch(e){ return 0; } };
  const setBank = v => { try{ career.bankroll = Math.max(0, Math.round(v)); saveCareer(); }catch(e){} };
  const caseCount = () => Object.values(world.owned).reduce((a, b) => a + b, 0);
  const rowOpen = r => ROWS.length - 1 - r < world.open;

  /* ============================================================
     BUILD
     ============================================================ */
  function build(){
    const career = document.getElementById('career');
    if (!career || document.getElementById('pk')) return;
    career.classList.add('pk-on');
    root = document.createElement('div');
    root.id = 'pk'; root.className = 'pk is-machine';
    root.innerHTML =
      '<div class="pk-rail">' +
        '<button class="pk-key" id="pk-back" type="button" aria-label="Back to main menu"><span class="pk-nav" aria-hidden="true"></span></button>' +
        '<div class="pk-bank"><span class="pk-bank-label">BANKROLL</span><div class="pk-reel tabular" id="pk-reel" role="img" aria-label="Bankroll"></div></div>' +
        '<button class="pk-key pk-case-key" id="pk-case-key" type="button" aria-label="Ticket case"><span class="pk-case-ico" aria-hidden="true"></span><b class="tabular" id="pk-case-count">0</b></button>' +
      '</div>' +
      '<div class="pk-cab" id="pk-cab">' +
        '<div class="pk-marquee"><span class="pk-bulbs" aria-hidden="true"></span><span class="pk-marquee-title">PACK<i>·</i>VENDOR</span><span class="pk-bulbs is-b" aria-hidden="true"></span></div>' +
        '<div class="pk-body">' +
          '<div class="pk-glass-well" id="pk-well"><canvas id="pk-glass" aria-hidden="true"></canvas><div class="pk-glass-sheen" aria-hidden="true"></div><div class="pk-rows" id="pk-rows"></div></div>' +
          '<div class="pk-panel">' +
            '<div class="pk-crt crt" id="pk-crt"><small class="crt-caption" id="pk-crt-a"></small><strong class="crt-figure" id="pk-crt-b"></strong><span class="crt-line" id="pk-crt-c"></span><span class="crt-line" id="pk-crt-d"></span></div>' +
            '<div class="pk-keypad" id="pk-keypad">' + ROWS.slice().reverse().map(t => '<button type="button" class="pk-pad" data-tier="' + t.id + '"><span class="pk-pad-lamp"></span>' + t.key + '</button>').join('') + '</div>' +
            '<div class="pk-prices" id="pk-prices" aria-hidden="true"></div>' +
            '<div class="pk-slot" aria-hidden="true"><span class="pk-slot-mouth"><i></i></span><span class="pk-slot-label">CHIPS</span></div>' +
            '<div class="pc-primary-cradle pk-buy-cradle"><button class="pc-button pc-button-primary pk-buy" id="pk-buy" type="button"><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong id="pk-buy-main">BUY</strong><small class="tabular" id="pk-buy-sub"></small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div>' +
          '</div>' +
        '</div>' +
        '<div class="pk-tray" id="pk-tray"><div class="pk-tray-mouth"><canvas id="pk-tray-cv" aria-hidden="true"></canvas></div><button class="pk-flap" id="pk-flap" type="button" aria-label="Take your pack"><span class="pk-flap-lamp"></span><span class="pk-flap-word">PUSH</span></button></div>' +
        '<canvas class="pk-drop" id="pk-drop" aria-hidden="true"></canvas>' +
      '</div>' +
      stageHTML() + caseHTML();
    career.appendChild(root);
    glassCv = root.querySelector('#pk-glass'); glassCtx = glassCv.getContext('2d');
    dropCv = root.querySelector('#pk-drop'); dropCtx = dropCv.getContext('2d');
    // the row hit areas and their OUT OF ORDER signs
    const rows = root.querySelector('#pk-rows');
    rows.innerHTML = ROWS.map((t, r) => '<button type="button" class="pk-row" data-r="' + r + '" aria-label="' + t.name + ' pack"><span class="pk-ooo"><b>OUT OF ORDER</b><small>WIN AT ' + (ROWS[r + 1] ? ROWS[r + 1].name : '') + '</small></span></button>').join('');
    wire();
    seedWorld();
    layout();
    paintAll();
    loop();
    new ResizeObserver(() => layout()).observe(root);
    // returning from a table: back to the machine
    new MutationObserver(() => {
      if (!career.classList.contains('hidden')){ closeAll(); paintAll(); layout(); }
    }).observe(career, { attributes:true, attributeFilter:['class'] });
  }

  /* ============================================================
     LAYOUT: one whole-number pixel scale for the glass
     ============================================================ */
  function layout(){
    if (!root) return;
    const well = root.querySelector('#pk-well');
    const w = well.clientWidth, h = well.clientHeight;
    if (!w || !h) return;
    S = Math.max(2, Math.min(Math.floor((w - 4) / GW), Math.floor((h - 4) / 197), 4));
    // rows share whatever height the glass has: air above each pack
    ROW_H = clamp(Math.floor((Math.floor((h - 8) / S) - 5) / 6), 30, 40);
    GH = ROW_H * 6 + 5;
    glassCv.width = GW; glassCv.height = GH;
    glassCv.style.width = GW * S + 'px'; glassCv.style.height = GH * S + 'px';
    const rows = root.querySelector('#pk-rows');
    rows.style.width = GW * S + 'px'; rows.style.height = GH * S + 'px';
    root.style.setProperty('--pk-s', S + 'px');
    root.style.setProperty('--pk-row', ROW_H * S + 'px');
    // the drop canvas: from the glass's top down to the tray's floor
    const cab = root.querySelector('#pk-cab').getBoundingClientRect();
    const g = glassCv.getBoundingClientRect();
    const tray = root.querySelector('#pk-tray').getBoundingClientRect();
    const dh = Math.ceil((tray.bottom - g.top) / S);
    const dw = Math.ceil(cab.width / S);
    dropCv.width = dw; dropCv.height = dh;
    dropCv.style.width = dw * S + 'px'; dropCv.style.height = dh * S + 'px';
    dropCv.style.left = '0px'; dropCv.style.top = (g.top - cab.top) + 'px';
    world.glassX = Math.round((g.left - cab.left) / S);
    world.trayY = Math.round((tray.top - g.top) / S);
    world.trayFloor = Math.round((tray.bottom - g.top) / S);
    world.trayCx = Math.round((tray.left + tray.width / 2 - cab.left) / S);
    // the pack lying in the tray
    const tc = root.querySelector('#pk-tray-cv');
    tc.width = 30; tc.height = 16; tc.style.width = 30 * S + 'px'; tc.style.height = 16 * S + 'px';
    paintTray();
  }

  /* ============================================================
     THE GLASS: rows of packs, coils, the tube light
     ============================================================ */
  const vend = { r:-1, c:-1, phase:'', turn:0, grow:0, rock:0, refill:0 };
  const stockTurn = ROWS.map(() => [0, .33, .66]);
  let tube = 1, tubeNext = 0;
  function drawGlass(now){
    const g = glassCtx;
    g.clearRect(0, 0, GW, GH);
    // the cabinet's inside: a dark back wall, lit from the tube at the top
    for (let y = 0; y < GH; y++){
      const k = Math.max(0, 1 - y / GH);
      g.fillStyle = y % 2 ? '#150B0D' : '#170C0F';
      g.fillRect(0, y, GW, 1);
      if (k > .5){ g.fillStyle = 'rgba(255,230,160,' + ((k - .5) * .12 * tube).toFixed(3) + ')'; g.fillRect(0, y, GW, 1); }
    }
    // tube flicker: now and then it stutters
    if (now > tubeNext){ tube = Math.random() < .25 ? .55 + Math.random() * .3 : 1; tubeNext = now + (tube < 1 ? 60 + Math.random() * 90 : 1800 + Math.random() * 5200); }
    g.fillStyle = '#3B2A1C'; g.fillRect(2, 0, GW - 4, 2);
    g.fillStyle = tube < 1 ? '#D9C78F' : '#FFF6DA'; g.fillRect(4, 0, GW - 8, 1);
    ROWS.forEach((t, r) => {
      const open = rowOpen(r);
      const y0 = 3 + r * ROW_H + (ROW_H - 32);
      const lit = open ? (.82 + .18 * tube) * (1 - r * .03) : .16;
      // the row's back shelf shadow
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(1, y0 + 21, GW - 2, 2);
      if (r > 0){ g.fillStyle = 'rgba(255,230,160,' + (open ? .05 * tube : .01).toFixed(3) + ')'; g.fillRect(1, y0 - (ROW_H - 32), GW - 2, 1); }
      for (let c = 0; c < 3; c++){
        const x0 = 2 + c * COL_W;
        // the next pack behind, a step darker
        PackArt.pack(g, t.id, x0 + 3, y0, 17, 22, { small:true, lit:lit * .55 });
        const isVend = vend.r === r && vend.c === c;
        if (isVend){
          if (vend.phase === 'advance' || vend.phase === 'teeter'){
            const gw = Math.round(17 + vend.grow * 3), gh = Math.round(22 + vend.grow * 4);
            const ox = x0 + 2 - Math.round((gw - 17) / 2) + (vend.phase === 'teeter' ? vend.rock : 0);
            const oy = y0 + 1 + Math.round(vend.grow * 2);
            PackArt.pack(g, t.id, ox, oy, gw, gh, { small:true, lit });
          } else if (vend.phase === 'refill'){
            // the coil brings the next one forward
            const k = vend.refill;
            PackArt.pack(g, t.id, x0 + 3 - Math.round(k), y0 + 1 - Math.round(1 - k), 17, 22, { small:true, lit:lit * (.55 + .45 * k) });
          }
        } else {
          PackArt.pack(g, t.id, x0 + 2, y0 + 1, 17, 22, { small:true, lit, sheen:((now / 4000 + c * .2 + r * .1) % 1.6) - .3 });
        }
        PackArt.coil(g, x0 + 10.5, y0 + 17, 8, isVend ? vend.turn : stockTurn[r][c], !open);
        // the shelf lip and the tag
        g.fillStyle = open ? '#2B2E31' : '#18191B'; g.fillRect(x0, y0 + 23, COL_W - 1, 3);
        g.fillStyle = open ? '#8A9196' : '#3A3D40'; g.fillRect(x0, y0 + 23, COL_W - 1, 1);
        g.fillStyle = '#0B0709'; g.fillRect(x0 + 4, y0 + 25, 13, 7);
        g.fillStyle = open ? '#F4EFE1' : '#4A4740'; g.fillRect(x0 + 5, y0 + 25, 11, 6);
      }
      if (world.selected === r && open && !world.busy){
        const blink = Math.floor(now / 380) % 2;
        g.fillStyle = blink ? '#F2B431' : '#7A5A1A';
        g.fillRect(0, y0 + 27, 1, 2); g.fillRect(GW - 1, y0 + 27, 1, 2);
        g.fillRect(0, y0, 1, 2); g.fillRect(GW - 1, y0, 1, 2);
      }
    });
    // the glass edge
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, 1, GH);
  }
  // little shelf labels are drawn by drawGlass; this tags each row's columns
  function drawTags(){
    ROWS.forEach((t, r) => {
      if (!rowOpen(r)) return;
      const y0 = 3 + r * ROW_H + (ROW_H - 32);
      for (let c = 0; c < 3; c++) PackArt.text(glassCtx, t.key + (c + 1), 2 + c * COL_W + 7, y0 + 25, '#2A1A0E');
    });
  }

  /* ============================================================
     THE FALL: drawn on the drop canvas, over the glass and the tray
     ============================================================ */
  const fall = { on:false, x:0, y:0, vy:0, th:0, tier:'alley', land:0 };
  function drawFall(){
    dropCtx.clearRect(0, 0, dropCv.width, dropCv.height);
    if (!fall.on) return;
    const h = Math.max(2, Math.round(26 * Math.abs(Math.cos(fall.th))));
    const w = 20;
    const backSide = Math.cos(fall.th) < 0;
    const x = Math.round(fall.x - w / 2), y = Math.round(fall.y - h / 2);
    if (backSide){
      const t = PackArt.tier(fall.tier);
      dropCtx.fillStyle = t.lo; dropCtx.fillRect(x, y, w, h);
      dropCtx.fillStyle = t.seal; dropCtx.fillRect(x, y, w, 1); dropCtx.fillRect(x, y + h - 1, w, 1);
      dropCtx.fillStyle = 'rgba(0,0,0,.25)'; dropCtx.fillRect(x + 2, y + 1, w - 4, Math.max(0, h - 2));
    } else {
      const off = packSprite(fall.tier, w, 26);
      dropCtx.imageSmoothingEnabled = false;
      dropCtx.drawImage(off, x, y, w, h);
    }
  }
  const spriteCache = {};
  function packSprite(tier, w, h, big){
    const k = tier + w + 'x' + h + (big ? 'b' : '');
    if (spriteCache[k]) return spriteCache[k];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    PackArt.pack(c.getContext('2d'), tier, 0, 0, w, h, { small:!big, sheen:.35 });
    return (spriteCache[k] = c);
  }
  function paintTray(){
    const c = root && root.querySelector('#pk-tray-cv'); if (!c) return;
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    if (!world.tray) return;
    // lying in the tray, seen from above at an angle
    const sp = packSprite(world.tray, 20, 26);
    x.imageSmoothingEnabled = false;
    x.drawImage(sp, 5, 2, 20, 13);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(5, 14, 20, 1);
  }

  /* ============================================================
     THE PANEL: CRT, keypad, BUY
     ============================================================ */
  function crt(a, b, c, d){
    const set = (id, v) => { const el = root.querySelector(id); if (el.textContent !== v) el.textContent = v; };
    set('#pk-crt-a', a); set('#pk-crt-b', b); set('#pk-crt-c', c || ''); set('#pk-crt-d', d || '');
  }
  function paintPanel(){
    const t = ROWS[world.selected];
    const open = rowOpen(world.selected);
    root.querySelectorAll('.pk-pad').forEach(b => {
      const r = ROWS.findIndex(x => x.id === b.dataset.tier);
      b.classList.toggle('is-on', r === world.selected);
      b.classList.toggle('is-locked', !rowOpen(r));
    });
    const buy = root.querySelector('#pk-buy');
    if (world.tray){
      crt('TRAY', 'TAKE IT', 'YOUR PACK', 'IS WAITING');
      root.querySelector('#pk-buy-main').textContent = 'BUY';
      root.querySelector('#pk-buy-sub').textContent = 'TRAY FULL';
      buy.disabled = true;
      return;
    }
    if (!open){
      crt(t.key + ' · ' + t.short, 'LOCKED', 'OUT OF ORDER', 'WIN TO OPEN');
      root.querySelector('#pk-buy-main').textContent = 'LOCKED';
      root.querySelector('#pk-buy-sub').textContent = '';
      buy.disabled = true;
      return;
    }
    crt(t.key + ' · ' + t.short, money(t.price), t.cards + ' CARDS', t.odds);
    root.querySelector('#pk-buy-main').textContent = 'BUY';
    root.querySelector('#pk-buy-sub').textContent = money(t.price);
    buy.disabled = world.busy;
  }
  function paintPrices(){
    root.querySelector('#pk-prices').innerHTML = '<b>PRICE LIST</b>' + ROWS.map((t, r) =>
      '<span class="' + (rowOpen(r) ? '' : 'is-off') + (r === world.selected ? ' is-on' : '') + '"><i>' + t.key + '</i><em>' + t.short.split(' ')[0] + '</em><u class="tabular">' + money(t.price) + '</u></span>').join('');
  }
  function paintRows(){
    paintPrices();
    root.querySelectorAll('.pk-row').forEach(b => {
      const r = +b.dataset.r;
      b.classList.toggle('is-locked', !rowOpen(r));
      b.classList.toggle('is-on', r === world.selected);
    });
  }
  /* ---- the bankroll reel ---- */
  let shownBank = null, bankAnim = 0;
  function reelMarkup(v){
    const digits = String(Math.max(0, Math.floor(v))).padStart(7, '0');
    const lead = 7 - String(Math.max(0, Math.floor(v))).length;
    return '<span class="pk-reel-cell is-sign">$</span>' + digits.split('').map((d, i) => '<span class="pk-reel-cell' + (i < lead ? ' is-lead' : '') + '"><i>' + d + '</i></span>').join('');
  }
  function paintBank(v){
    const reel = root.querySelector('#pk-reel');
    const digits = String(Math.max(0, Math.floor(v))).padStart(7, '0');
    const lead = 7 - String(Math.max(0, Math.floor(v))).length;
    const cells = reel.querySelectorAll('.pk-reel-cell:not(.is-sign)');
    if (cells.length !== 7){ reel.innerHTML = reelMarkup(v); }
    else cells.forEach((cell, i) => {
      cell.classList.toggle('is-lead', i < lead);
      const el = cell.firstChild;
      if (el.textContent !== digits[i]){
        el.textContent = digits[i];
        cell.classList.remove('is-turn'); void cell.offsetWidth; cell.classList.add('is-turn');
      }
    });
    reel.setAttribute('aria-label', 'Bankroll ' + money(v));
    shownBank = v;
  }
  /* count the reel from what it shows to v, in machine steps */
  function countBank(v, ms, tick){
    cancelAnimationFrame(bankAnim);
    const from = shownBank == null ? v : shownBank;
    const t0 = performance.now(); const dur = (ms || 700) / speed();
    let last = -1;
    return new Promise(res => {
      const step = now => {
        const k = clamp((now - t0) / dur, 0, 1);
        const q = Math.floor(k * 14) / 14;
        const val = Math.round(from + (v - from) * (1 - Math.pow(1 - q, 2)));
        if (val !== last){ paintBank(val); if (tick && last !== -1) tick(); last = val; }
        if (k < 1) bankAnim = requestAnimationFrame(step); else { paintBank(v); res(); }
      };
      bankAnim = requestAnimationFrame(step);
    });
  }
  function paintCaseKey(bump){
    const n = caseCount();
    root.querySelector('#pk-case-count').textContent = String(n);
    if (bump){ const k = root.querySelector('#pk-case-key'); k.classList.remove('is-bump'); void k.offsetWidth; k.classList.add('is-bump'); }
  }
  function paintAll(){
    paintBank(bank());
    paintCaseKey();
    paintRows(); paintPanel(); paintTray();
    root.querySelector('#pk-flap').classList.toggle('is-full', !!world.tray);
  }

  /* ============================================================
     THE LOOP
     ============================================================ */
  function loop(now){
    now = now || performance.now();
    if (root && world.view === 'machine' && !document.getElementById('career').classList.contains('hidden')){
      drawGlass(now); drawTags(); drawFall();
    }
    requestAnimationFrame(loop);
  }

  /* ============================================================
     BUY → VEND → DROP
     ============================================================ */
  async function buy(){
    if (world.busy || world.tray) return;
    const r = world.selected, t = ROWS[r];
    if (!rowOpen(r)){ PackSound.deny(); return; }
    if (bank() < t.price){
      PackSound.deny(); buzz(30);
      crt(t.key + ' · ' + t.short, 'NO FUNDS', 'NEED ' + money(t.price), 'HAVE ' + money(bank()));
      root.querySelector('#pk-crt').classList.add('is-deny');
      await wait(1400); root.querySelector('#pk-crt').classList.remove('is-deny'); paintPanel();
      return;
    }
    world.busy = true; paintPanel();
    PackSound.unlock();
    const buyBtn = root.querySelector('#pk-buy');
    buyBtn.classList.add('is-held');
    // chips into the slot: one clink per chip, the reel counts down
    const slot = root.querySelector('.pk-slot');
    slot.classList.add('is-taking');
    const chips = clamp(Math.ceil(Math.log10(t.price) * 2), 3, 8);
    const before = bank();
    setBank(before - t.price);
    crt(t.key + ' · ' + t.short, money(t.price), 'CHIPS IN', '');
    countBank(bank(), 260 + chips * 110);
    for (let i = 0; i < chips; i++){
      PackSound.coin(); slot.classList.remove('is-chip'); void slot.offsetWidth; slot.classList.add('is-chip');
      await wait(110 + Math.random() * 40);
    }
    PackSound.coinDrop();
    slot.classList.remove('is-taking');
    buyBtn.classList.remove('is-held');
    crt(t.key + ' · ' + t.short, 'VENDING', 'PLEASE WAIT', '');
    await wait(220);
    await vendRow(r);
    world.busy = false;
    paintAll();
  }
  async function vendRow(r){
    const t = ROWS[r];
    const c = [1, 0, 2][Math.floor(Math.random() * 3)];
    vend.r = r; vend.c = c; vend.phase = 'advance'; vend.turn = stockTurn[r][c]; vend.grow = 0;
    const motor = PackSound.motor();
    motor.set(.2);
    // the coil turns once, in ratchet steps; the pack edges forward
    const steps = 8;
    for (let i = 1; i <= steps; i++){
      const from = vend.turn, to = stockTurn[r][c] + i / steps;
      const g0 = vend.grow, g1 = i / steps;
      motor.set(.55 + Math.sin(i / steps * Math.PI) * .45);
      // each step: a quick move, then a catch
      const t0 = performance.now(), dur = 120 / speed();
      while (performance.now() - t0 < dur){
        const k = clamp((performance.now() - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        vend.turn = from + (to - from) * e; vend.grow = g0 + (g1 - g0) * e;
        await frame();
      }
      vend.turn = to; vend.grow = g1;
      PackSound.ratchet(.6 + i / steps * .4);
      await wait(i === steps ? 60 : 40);
    }
    motor.stop(.08);
    stockTurn[r][c] = vend.turn % 1;
    PackSound.slide();
    // the catch: it hangs on the coil's lip and rocks
    vend.phase = 'teeter';
    const rocks = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rocks; i++){
      vend.rock = i % 2 ? -1 : 1; PackSound.tip(); await wait(110 + i * 40);
      vend.rock = 0; await wait(90 + Math.random() * 120);
    }
    // a little suspense now and then: it hangs a beat longer
    if (Math.random() < .35){ crt(t.key + ' · ' + t.short, '...', '', ''); await wait(520); }
    // the fall
    vend.phase = 'gone';
    fall.on = true; fall.tier = t.id;
    fall.x = world.glassX + 2 + c * COL_W + 10; fall.y = 3 + r * ROW_H + (ROW_H - 32) + 14;
    fall.vy = -.6; fall.th = 0;
    const floor = world.trayFloor - 6;
    PackSound.whoosh();
    let lastT = performance.now();
    let bounced = false;
    while (true){
      const now = performance.now();
      const dt = Math.min(40, now - lastT) / 16.67 * speed(); lastT = now;
      fall.vy += .32 * dt; fall.y += fall.vy * dt;
      fall.th += .19 * dt;
      // it drifts to the tray's middle as it drops
      fall.x += (world.trayCx - fall.x) * .05 * dt;
      if (fall.y >= floor){
        fall.y = floor;
        if (!bounced && fall.vy > 2){
          bounced = true; fall.vy = -fall.vy * .22;
          PackSound.thunk(t.id === 'gold' || t.id === 'high');
          buzz([30, 20, 18]);
          shake();
          fall.th = Math.PI / 2 + (Math.random() - .5) * .3;
        } else break;
      }
      await frame();
    }
    fall.th = Math.PI / 2;
    await wait(60);
    fall.on = false;
    world.tray = t.id;
    paintTray();
    root.querySelector('#pk-flap').classList.add('is-full');
    PackSound.flap(false);
    // the coil brings the next pack forward
    vend.phase = 'refill';
    for (let k = 0; k <= 6; k++){ vend.refill = k / 6; await wait(45); }
    vend.r = -1; vend.c = -1; vend.phase = '';
    crt('TRAY', 'TAKE IT', 'YOUR PACK', 'IS WAITING');
    PackSound.beep(true);
  }
  function shake(){
    const cab = root.querySelector('#pk-cab');
    cab.classList.remove('is-shake'); void cab.offsetWidth; cab.classList.add('is-shake');
  }

  /* ============================================================
     THE STAGE: the pack in your hand, the rip
     ============================================================ */
  function stageHTML(){
    return '<div class="pk-stage" id="pk-stage" aria-hidden="true">' +
      '<div class="pk-stage-bg"></div><canvas class="pk-rays" id="pk-rays"></canvas><div class="pk-stage-dim" id="pk-dim"></div>' +
      '<div class="pk-stage-head"><span class="pk-stage-pack" id="pk-stage-pack"></span><span class="pk-stage-count tabular" id="pk-stage-count"></span></div>' +
      '<div class="pk-hold" id="pk-hold"><div class="pk-stack" id="pk-stack"></div><canvas class="pk-hand" id="pk-hand"></canvas></div>' +
      '<div class="pk-hint" id="pk-hint"><span class="pk-hint-finger" aria-hidden="true"></span><span class="pk-hint-text" id="pk-hint-text">DRAG ACROSS THE TOP TO TEAR</span></div>' +
      '<canvas class="pk-fx" id="pk-fx"></canvas>' +
      '<div class="pk-glitch" id="pk-glitch" aria-hidden="true"></div>' +
      '<div class="pk-pile" id="pk-pile"></div>' +
      '<div class="pk-stage-foot" id="pk-stage-foot"><div class="pc-primary-cradle pk-file-cradle"><button class="pc-button pc-button-primary pk-file" id="pk-file" type="button"><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong>INTO THE CASE</strong><small id="pk-file-sub"></small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div></div>' +
    '</div>';
  }
  const PW = 62, PH = 90, MX = 16, MY = 34;
  const rip = { tier:'alley', img:null, S2:4, dir:0, ext:0, ys:[], done:false, drag:null, bob:0, sheen:.3, sound:null, lastAx:0, lastAy:0, crinkle:0, stripCv:null, gone:false };
  let stageRaf = 0;
  function openStage(tierId){
    world.view = 'stage';
    const st = root.querySelector('#pk-stage');
    root.classList.add('is-staged');
    st.classList.remove('is-out', 'is-reveal', 'is-done', 'is-hinted', 'is-torn');
    st.setAttribute('aria-hidden', 'false');
    const t = PackArt.tier(tierId);
    root.querySelector('#pk-stage-pack').textContent = t.name + ' PACK';
    root.querySelector('#pk-stage-count').textContent = t.cards + ' CARDS';
    root.querySelector('#pk-hint-text').textContent = 'DRAG ACROSS THE TOP TO TEAR';
    // the pack and its tear
    Object.assign(rip, { tier:tierId, dir:0, ext:0, ys:new Array(PW).fill(PackArt.tearY(PH)), done:false, drag:null, gone:false });
    rip.img = document.createElement('canvas'); rip.img.width = PW; rip.img.height = PH;
    rip.stripCv = document.createElement('canvas'); rip.stripCv.width = PW; rip.stripCv.height = 24;
    const hand = root.querySelector('#pk-hand');
    const vw = st.clientWidth, vh = st.clientHeight;
    rip.S2 = clamp(Math.floor(Math.min(vw * .7 / PW, vh * .5 / PH)), 2, 6);
    hand.width = PW + MX * 2; hand.height = PH + MY * 2;
    hand.style.width = hand.width * rip.S2 + 'px'; hand.style.height = hand.height * rip.S2 + 'px';
    hand.style.transform = '';
    const hold = root.querySelector('#pk-hold');
    hold.style.width = hand.width * rip.S2 + 'px'; hold.style.height = hand.height * rip.S2 + 'px';
    hold.classList.remove('is-out');
    root.querySelector('#pk-stack').innerHTML = '';
    root.querySelector('#pk-pile').innerHTML = '';
    root.querySelector('#pk-stage-foot').classList.remove('is-on');
    renderPackImg();
    // the dear packs glitter in your hand
    hold.querySelectorAll('.pk-spark').forEach(n => n.remove());
    if (tierId === 'gold' || tierId === 'high'){
      for (let i = 0; i < (tierId === 'gold' ? 12 : 7); i++){
        const sp = document.createElement('i');
        sp.className = 'pk-spark';
        const a = Math.random() * Math.PI * 2, d = .52 + Math.random() * .22;
        sp.style.left = 50 + Math.cos(a) * d * 62 + '%';
        sp.style.top = 50 + Math.sin(a) * d * 48 + '%';
        sp.style.animationDelay = (Math.random() * 1.6).toFixed(2) + 's';
        hold.appendChild(sp);
      }
    }
    // the pack lifts from the tray to your hand
    const trayRect = root.querySelector('#pk-tray').getBoundingClientRect();
    const handRect = hand.getBoundingClientRect();
    const dx = trayRect.left + trayRect.width / 2 - (handRect.left + handRect.width / 2);
    const dy = trayRect.top + trayRect.height / 2 - (handRect.top + handRect.height / 2);
    hold.animate([
      { transform:'translate(' + dx + 'px,' + dy + 'px) scale(.22) rotate(-8deg)', offset:0 },
      { transform:'translate(0,-14px) scale(1.04) rotate(2deg)', offset:.72 },
      { transform:'translate(0,4px) scale(.99) rotate(-1deg)', offset:.88 },
      { transform:'none', offset:1 }
    ], { duration:620 / speed(), easing:'steps(14,end)' });
    PackSound.lift();
    cancelAnimationFrame(stageRaf);
    const tick = now => { drawHand(now); drawRays(now); stageRaf = requestAnimationFrame(tick); };
    stageRaf = requestAnimationFrame(tick);
    setTimeout(() => { if (!rip.dir && world.view === 'stage') st.classList.add('is-hinted'); }, 1300 / speed());
    if (state.autorip === 'on') autoRip();
  }
  function renderPackImg(){
    const x = rip.img.getContext('2d');
    x.clearRect(0, 0, PW, PH);
    PackArt.pack(x, rip.tier, 0, 0, PW, PH, { sheen:rip.sheen });
  }
  function drawHand(now){
    const hand = root.querySelector('#pk-hand');
    const x = hand.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, hand.width, hand.height);
    if (rip.gone) return;
    // idle: a slow bob and the sheen drifting, faster while you hold it
    rip.bob = rip.drag ? 0 : (Math.floor(now / 520) % 2);
    const target = rip.drag ? clamp(rip.lastAx / PW, -.2, 1.2) : ((now / 3800) % 1.6) - .3;
    if (Math.abs(target - rip.sheen) > .04){ rip.sheen += (target - rip.sheen) * .2; renderPackImg(); }
    const ox = MX, oy = MY + rip.bob;
    const foil = ['gold', 'high', 'casino'].includes(rip.tier);
    const edge = foil ? '#FFF6DA' : rip.tier === 'alley' ? '#E9D9B0' : '#F4EFE1';
    // the shadow under the pack
    x.fillStyle = 'rgba(0,0,0,.35)';
    x.fillRect(ox + 4, oy + PH + 2, PW - 8, 2); x.fillRect(ox + 8, oy + PH + 4, PW - 16, 1);
    // the body: whole columns where it isn't torn yet, cut along the tear where it is
    for (let i = 0; i < PW; i++){
      const torn = isTorn(i);
      const y = torn ? rip.ys[i] : 0;
      x.drawImage(rip.img, i, y, 1, PH - y, ox + i, oy + y, 1, PH - y);
      if (torn){
        x.fillStyle = edge; x.fillRect(ox + i, oy + y, 1, 1);
        x.fillStyle = 'rgba(10,4,6,.55)'; x.fillRect(ox + i, oy + y + 1, 1, 1);
        // paper fibres on the cheap wrapper
        if (rip.tier === 'alley' && (i * 7) % 5 === 0){ x.fillStyle = edge; x.fillRect(ox + i, oy + y - 1, 1, 1); }
      }
    }
    // the strip: the torn length lifts and curls away from the hinge
    if (rip.ext > 0 && !rip.done){
      const s = rip.stripCv.getContext('2d');
      s.clearRect(0, 0, PW, 24);
      for (let i = 0; i < PW; i++){
        if (!isTorn(i)) continue;
        const y = rip.ys[i];
        s.drawImage(rip.img, i, 0, 1, y, i, 0, 1, y);
        s.fillStyle = edge; s.fillRect(i, y - 1, 1, 1);
      }
      const hinge = rip.dir > 0 ? rip.ext : PW - rip.ext;
      const ang = -rip.dir * Math.min(.5, rip.ext / PW * .7);
      x.save();
      x.translate(ox + hinge, oy + 2);
      x.rotate(ang);
      x.translate(-hinge, -2 - Math.min(3, rip.ext / 14));
      x.drawImage(rip.stripCv, 0, 0);
      x.restore();
    }
    // the hint line glints along the perforation until you start
    if (!rip.dir){
      const k = (now / 900) % 1;
      const gx = Math.floor(k * (PW + 10)) - 5;
      x.fillStyle = 'rgba(255,246,218,.85)';
      for (let i = 0; i < 4; i++){ const px = gx - i; if (px >= 1 && px < PW - 1) x.fillRect(ox + px, oy + PackArt.tearY(PH) + (i % 2), 1, 1); }
    }
  }
  const isTorn = i => rip.dir > 0 ? i < rip.ext : rip.dir < 0 ? i >= PW - rip.ext : false;
  function artPoint(e){
    const r = root.querySelector('#pk-hand').getBoundingClientRect();
    return { ax:(e.clientX - r.left) / rip.S2 - MX, ay:(e.clientY - r.top) / rip.S2 - MY };
  }
  function tearDown(e){
    if (world.view !== 'stage' || rip.done || rip.gone) return;
    if (e.target.closest('.pk-stack, .pk-pile, button')) return;
    const p = artPoint(e);
    if (p.ay > PH * .8 || p.ay < -MY || p.ax < -MX || p.ax > PW + MX) return;
    e.preventDefault();
    PackSound.unlock();
    rip.drag = { id:e.pointerId, x0:p.ax, y0:p.ay, t:performance.now() };
    rip.lastAx = p.ax; rip.lastAy = p.ay;
    if (!rip.sound) rip.sound = PackSound.tear(rip.tier);
    root.querySelector('#pk-stage').classList.remove('is-hinted');
    root.querySelector('#pk-stage').classList.add('is-gripped');
  }
  function tearMove(e){
    if (!rip.drag || rip.drag.id !== e.pointerId || rip.done) return;
    e.preventDefault();
    const p = artPoint(e);
    const now = performance.now();
    const dt = Math.max(8, now - (rip.drag.t || now));
    rip.drag.t = now;
    const vx = (p.ax - rip.lastAx) / dt * 16.7;
    if (!rip.dir){
      if (Math.abs(p.ax - rip.drag.x0) < 3) { rip.lastAx = p.ax; rip.lastAy = p.ay; return; }
      rip.dir = p.ax > rip.drag.x0 ? 1 : -1;
      root.querySelector('#pk-stage').classList.add('is-tearing');
    }
    // the tear runs to the finger (never back); fast fingers tear jagged
    const pos = rip.dir > 0 ? p.ax : PW - p.ax;
    const want = clamp(Math.round(pos), rip.ext, PW);
    const speedNow = Math.abs(vx);
    const baseY = PackArt.tearY(PH);
    let advanced = 0;
    while (rip.ext < want && advanced < 9){
      const i = rip.dir > 0 ? rip.ext : PW - 1 - rip.ext;
      const prevI = rip.dir > 0 ? i - 1 : i + 1;
      const prev = rip.ext === 0 ? baseY : rip.ys[prevI];
      const fy = baseY + (p.ay - rip.drag.y0) * .35;
      let y = prev + clamp(Math.round(fy - prev), -1, 1);
      if (speedNow > 4.2) y += Math.random() < .5 ? (Math.random() < .55 ? 1 : 2) * (Math.random() < .5 ? -1 : 1) : 0;
      else if (speedNow < .7 && rip.ext % 2 === 0) y += (rip.crinkle = -rip.crinkle || 1);
      rip.ys[i] = clamp(y, baseY - 4, baseY + 6);
      rip.ext++; advanced++;
    }
    if (advanced){
      rip.sound.set(clamp(speedNow / 5, .25, 1));
      if (speedNow < .9 && Math.random() < .5) PackSound.crinkle();
      if (Math.random() < .25) buzz(4);
    } else rip.sound.set(0);
    rip.lastAx = p.ax; rip.lastAy = p.ay;
    if (rip.ext >= PW) finishTear(vx);
  }
  function tearUp(e){
    if (!rip.drag || (e && rip.drag.id !== e.pointerId)) return;
    rip.drag = null;
    if (rip.sound) rip.sound.set(0);
    root.querySelector('#pk-stage').classList.remove('is-gripped');
    if (!rip.done && !rip.dir) root.querySelector('#pk-stage').classList.add('is-hinted');
  }
  async function autoRip(){
    await wait(900);
    rip.dir = 1;
    if (!rip.sound) rip.sound = PackSound.tear(rip.tier);
    const base = PackArt.tearY(PH);
    while (rip.ext < PW && world.view === 'stage'){
      for (let k = 0; k < 2 && rip.ext < PW; k++){
        rip.ys[rip.ext] = base + (rip.ext % 9 === 0 ? 1 : 0);
        rip.ext++;
      }
      rip.sound.set(.6);
      await frame();
    }
    finishTear(3);
  }
  async function finishTear(vx){
    if (rip.done) return;
    rip.done = true;
    if (rip.sound){ rip.sound.stop(.03); rip.sound = null; }
    rip.drag = null;
    PackSound.rip(); buzz([18, 12, 26]);
    const st = root.querySelector('#pk-stage');
    st.classList.remove('is-tearing', 'is-gripped', 'is-hinted');
    st.classList.add('is-torn');
    // the strip flies off as its own piece
    const s = rip.stripCv.getContext('2d');
    s.clearRect(0, 0, PW, 24);
    for (let i = 0; i < PW; i++){ const y = rip.ys[i]; s.drawImage(rip.img, i, 0, 1, y, i, 0, 1, y); }
    const hand = root.querySelector('#pk-hand');
    const hr = hand.getBoundingClientRect(), sr = st.getBoundingClientRect();
    const fly = document.createElement('canvas');
    fly.width = PW; fly.height = 24; fly.className = 'pk-strip';
    fly.getContext('2d').drawImage(rip.stripCv, 0, 0);
    fly.style.width = PW * rip.S2 + 'px'; fly.style.height = 24 * rip.S2 + 'px';
    fly.style.left = hr.left - sr.left + MX * rip.S2 + 'px'; fly.style.top = hr.top - sr.top + (MY + rip.bob - 3) * rip.S2 + 'px';
    st.appendChild(fly);
    const dir = rip.dir || 1;
    const vX = dir * (260 + Math.min(400, Math.abs(vx) * 60)), vY = -520 - Math.random() * 160, spin = dir * (300 + Math.random() * 300);
    const t0 = performance.now();
    const flyStep = now => {
      const t = (now - t0) / 1000 * speed();
      const px = vX * t, py = vY * t + 1500 * t * t;
      fly.style.transform = 'translate(' + Math.round(px) + 'px,' + Math.round(py) + 'px) rotate(' + Math.round(spin * t / 15) * 15 + 'deg)';
      if (t < 1.4) requestAnimationFrame(flyStep); else fly.remove();
    };
    requestAnimationFrame(flyStep);
    // now the strip is gone from the pack itself
    for (let i = 0; i < PW; i++){
      const x = rip.img.getContext('2d');
      x.clearRect(i, 0, 1, rip.ys[i]);
    }
    rip.ext = PW; rip.dir = rip.dir || 1;
    const shakeHand = hand.animate([{ transform:'translate(0,0)' }, { transform:'translate(' + (-dir * 6) + 'px,3px) rotate(' + (-dir * 2) + 'deg)' }, { transform:'translate(' + (dir * 3) + 'px,-1px)' }, { transform:'none' }], { duration:260 / speed(), easing:'steps(4,end)' });
    await shakeHand.finished.catch(() => {});
    await cardsOut();
  }

  /* ============================================================
     THE CARDS COME OUT, THE WRAPPER FALLS AWAY
     ============================================================ */
  let pull = [], pullIdx = 0;
  const CARD_W = 210, CARD_H = 294;
  function cardScale(){
    const st = root.querySelector('#pk-stage');
    return Math.min(1.3, (st.clientWidth - 64) / CARD_W, (st.clientHeight * .56) / CARD_H);
  }
  async function cardsOut(){
    pull = PackCards.open(rip.tier, state.force);
    pullIdx = 0;
    const stack = root.querySelector('#pk-stack');
    stack.innerHTML = '';
    // the stack sits inside the pack, behind the wrapper
    const k = (PW - 10) * rip.S2 / CARD_W;
    stack.style.setProperty('--k', k);
    const startY = (MY + PackArt.tearY(PH) + 6) * rip.S2;
    stack.style.left = (MX + 5) * rip.S2 + 'px';
    stack.style.top = startY + 'px';
    stack.style.width = CARD_W * k + 'px'; stack.style.height = CARD_H * k + 'px';
    pull.slice().reverse().forEach((card, i, arr) => {
      const el = PackCards.make(card, { faceDown:isSecret(card) });
      el.style.setProperty('--n', arr.length - 1 - i);
      stack.appendChild(el);
    });
    // they push up out of the opening, the top one first
    const cards = [...stack.children].reverse();
    PackSound.cardOut(0);
    const rise = CARD_H * k * .58;
    await Promise.all(cards.map((el, i) => el.animate([
      { transform:'translateY(0)' },
      { transform:'translateY(' + (-rise - i * 2 + 8) + 'px)', offset:.7 },
      { transform:'translateY(' + (-rise - i * 2) + 'px)' }
    ], { duration:(520 + i * 60) / speed(), easing:'steps(9,end)', fill:'forwards', delay:i * 40 / speed() }).finished.catch(() => {})));
    cards.forEach((el, i) => PackSound.cardOut(i));
    await wait(160);
    // the wrapper drops away; the stack comes forward
    const hand = root.querySelector('#pk-hand');
    PackSound.whoosh();
    const fallAnim = hand.animate([
      { transform:'none', opacity:1 },
      { transform:'translateY(40%) rotate(6deg)', opacity:1, offset:.6 },
      { transform:'translateY(120%) rotate(14deg)', opacity:0 }
    ], { duration:520 / speed(), easing:'steps(10,end)', fill:'forwards' });
    // move the stack to the stage's middle at its full size
    const st = root.querySelector('#pk-stage');
    const fr = stack.getBoundingClientRect();
    const target = cardScale();
    cards.forEach(el => { el.getAnimations().forEach(a => { a.commitStyles && a.commitStyles(); a.cancel(); }); });
    const stackLayer = document.createElement('div');
    stackLayer.className = 'pk-deck'; stackLayer.id = 'pk-deck';
    stackLayer.style.setProperty('--k', target);
    stackLayer.style.width = CARD_W * target + 'px'; stackLayer.style.height = CARD_H * target + 'px';
    st.appendChild(stackLayer);
    const dl = stackLayer.getBoundingClientRect();
    // carry each card across into the deck layer, keeping where it was
    const firstTop = fr.top - (CARD_H * k * .58);
    cards.slice().reverse().forEach(el => { el.style.transform = ''; stackLayer.appendChild(el); });
    stackLayer.animate([
      { transform:'translate(' + (fr.left - dl.left) + 'px,' + (firstTop - dl.top) + 'px) scale(' + (k / target) + ')', transformOrigin:'0 0' },
      { transform:'translate(0,-10px) scale(1.02)', transformOrigin:'0 0', offset:.8 },
      { transform:'none', transformOrigin:'0 0' }
    ], { duration:560 / speed(), easing:'steps(12,end)' });
    stack.innerHTML = '';
    await fallAnim.finished.catch(() => {});
    rip.gone = true;
    root.querySelector('#pk-hold').classList.add('is-out');
    st.classList.add('is-reveal');
    setPile();
    await wait(200);
    await topCard();
  }
  const isSecret = c => PackCards.RANK[c.rarity] >= 2 || c.kind === 'wild' || c.kind === 'jinx';
  function setPile(){
    const pile = root.querySelector('#pk-pile');
    pile.innerHTML = pull.map((c, i) => '<span class="pk-pile-slot" data-i="' + i + '"></span>').join('');
    paintCounter();
  }
  function paintCounter(){
    const left = pull.length - pullIdx;
    root.querySelector('#pk-stage-count').textContent = left > 0 ? 'CARD ' + (pullIdx + 1) + ' OF ' + pull.length : pull.length + ' CARDS';
  }
  const deck = () => root.querySelector('#pk-deck');
  const topEl = () => { const d = deck(); if (!d) return null; const live = [...d.children].filter(c => !c.dataset.gone); return live[live.length - 1] || null; };

  /* The card on top: a face-up one can be flicked away; a hidden one makes
     the machine hesitate until you turn it. */
  let hum = null;
  async function topCard(){
    const el = topEl();
    paintCounter();
    if (!el){ allOut(); return; }
    const card = pull[pullIdx];
    el.classList.add('is-top');
    if (card.kind === 'chips') setTimeout(() => chipBurst(el, card.chips), 260 / speed());
    if (el.classList.contains('is-down')){
      // the hesitation: lights dip in relay steps, the hum rises
      const st = root.querySelector('#pk-stage');
      st.classList.add('is-dim'); PackSound.relay(); await wait(160); PackSound.relay();
      hum = PackSound.hum(); hum.set(.25);
      el.classList.add('is-charging');
      root.querySelector('#pk-hint-text').textContent = 'TAP TO TURN IT OVER';
      st.classList.add('is-hinted', 'is-turnhint');
    } else {
      root.querySelector('#pk-hint-text').textContent = pullIdx === 0 ? 'FLICK IT AWAY · NEXT CARD' : 'FLICK · NEXT';
      root.querySelector('#pk-stage').classList.toggle('is-hinted', pullIdx === 0);
    }
  }
  async function turnOver(el){
    if (el.classList.contains('is-turning')) return;
    const card = pull[pullIdx];
    const st = root.querySelector('#pk-stage');
    st.classList.remove('is-hinted', 'is-turnhint');
    el.classList.add('is-turning');
    if (hum){ hum.set(.8); }
    buzz(12);
    PackSound.flip();
    // a slow quarter, a beat, then the snap round
    await el.querySelector('.pk-card-inner').animate([
      { transform:'rotateY(180deg)' }, { transform:'rotateY(120deg) scale(1.04)' }
    ], { duration:520 / speed(), easing:'steps(8,end)', fill:'forwards' }).finished.catch(() => {});
    await wait(160);
    const inner = el.querySelector('.pk-card-inner');
    const snap = inner.animate([
      { transform:'rotateY(120deg) scale(1.04)' }, { transform:'rotateY(-12deg) scale(1.1)', offset:.6 }, { transform:'rotateY(4deg) scale(1.02)', offset:.82 }, { transform:'rotateY(0deg) scale(1)' }
    ], { duration:440 / speed(), easing:'steps(9,end)', fill:'forwards' });
    setTimeout(() => {
      el.classList.remove('is-down', 'is-charging');
      if (hum){ hum.stop(.2); hum = null; }
      st.classList.remove('is-dim');
      reveal(el, card);
    }, 180 / speed());
    await snap.finished.catch(() => {});
    inner.getAnimations().forEach(a => a.cancel());
    el.classList.remove('is-turning');
    root.querySelector('#pk-hint-text').textContent = 'FLICK · NEXT';
  }
  function reveal(el, card){
    const st = root.querySelector('#pk-stage');
    if (card.kind === 'wild'){
      PackSound.glitch(); glitch(); buzz([10, 30, 10, 30, 40]);
      rays(card.rarity === 'foil' ? 'foil' : 'wild');
    } else if (card.kind === 'jinx'){
      PackSound.jinx(); buzz([60, 40, 60]);
      st.classList.add('is-jinx'); setTimeout(() => st.classList.remove('is-jinx'), 1600 / speed());
    } else {
      PackSound.reveal(card.rarity); buzz(card.rarity === 'foil' ? [20, 20, 20, 20, 60] : [20, 30, 40]);
      rays(card.rarity);
    }
    el.classList.add('is-revealed');
    const flash = document.createElement('div'); flash.className = 'pk-flash is-' + (card.kind === 'wild' ? 'wild' : card.rarity);
    st.appendChild(flash); setTimeout(() => flash.remove(), 700 / speed());
  }

  /* ---- flicking the top card into the pile ---- */
  let flick = null;
  function cardDown(e){
    const el = topEl();
    if (world.view !== 'stage' || !el || !e.target.closest('#pk-deck')) return;
    if (el.classList.contains('is-turning')) return;
    e.preventDefault();
    PackSound.unlock();
    if (el.classList.contains('is-down')){ turnOver(el); return; }
    flick = { id:e.pointerId, x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, t:performance.now(), vx:0, el };
    el.classList.add('is-held');
  }
  function cardMove(e){
    if (!flick || flick.id !== e.pointerId) return;
    e.preventDefault();
    const now = performance.now(), dt = Math.max(8, now - flick.t);
    flick.vx = (e.clientX - flick.x) / dt; flick.t = now;
    flick.x = e.clientX; flick.y = e.clientY;
    const dx = flick.x - flick.x0, dy = flick.y - flick.y0;
    flick.el.style.transform = 'translate(' + dx + 'px,' + dy * .4 + 'px) rotate(' + dx * .06 + 'deg)';
    // tilt the light across the card as it moves
    flick.el.style.setProperty('--glare', clamp(.5 + dx / 300, 0, 1));
  }
  function cardUp(e){
    if (!flick || flick.id !== e.pointerId) return;
    const f = flick; flick = null;
    const dx = f.x - f.x0, dy = f.y - f.y0;
    f.el.classList.remove('is-held');
    const tap = Math.abs(dx) < 8 && Math.abs(dy) < 8;
    if (tap || Math.abs(dx) > 70 || Math.abs(f.vx) > .5) flickAway(f.el, tap ? 1 : Math.sign(dx || f.vx || 1), dx, dy);
    else {
      f.el.animate([{ transform:f.el.style.transform }, { transform:'none' }], { duration:200 / speed(), easing:'steps(5,end)' });
      f.el.style.transform = '';
    }
  }
  async function flickAway(el, dir, dx, dy){
    const i = pullIdx;
    pullIdx++;
    el.dataset.gone = '1';
    el.classList.remove('is-top');
    PackSound.flick(); buzz(8);
    const st = root.querySelector('#pk-stage');
    st.classList.remove('is-hinted');
    // out to the side, then dealt into its slot in the pile
    const slot = root.querySelector('.pk-pile-slot[data-i="' + i + '"]');
    const er = el.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    const tx = sr.left - er.left + (dx || 0), ty = sr.top - er.top + (dy || 0) * .4;
    const start = el.style.transform || 'none';
    el.style.transform = '';
    const a = el.animate([
      { transform:start },
      { transform:'translate(' + (dir * 150 + (dx || 0)) + 'px,' + (-30 + (dy || 0) * .4) + 'px) rotate(' + dir * 16 + 'deg)', offset:.4 },
      { transform:'translate(' + tx + 'px,' + ty + 'px) rotate(' + (dir * 4) + 'deg) scale(' + (sr.width / er.width) + ')' }
    ], { duration:430 / speed(), easing:'steps(11,end)', fill:'forwards' });
    setTimeout(() => topCard(), 140 / speed());
    await a.finished.catch(() => {});
    PackSound.land();
    const card = pull[i];
    const mini = PackCards.mini(card, 0, !world.owned[card.id]);
    mini.tabIndex = -1;
    slot.appendChild(mini);
    slot.classList.add('is-filled');
    el.remove();
  }
  function allOut(){
    const st = root.querySelector('#pk-stage');
    st.classList.add('is-done');
    st.classList.remove('is-hinted');
    root.querySelector('#pk-stage-count').textContent = 'ALL ' + pull.length + ' CARDS';
    const fresh = pull.filter((c, i, a) => !world.owned[c.id] && a.indexOf(c) === i).length;
    root.querySelector('#pk-file-sub').textContent = fresh ? fresh + ' NEW FOR YOUR CASE' : 'NO NEW ONES · ALL DOUBLES';
    root.querySelector('#pk-stage-foot').classList.add('is-on');
    deck() && deck().remove();
  }
  async function fileCards(){
    const btn = root.querySelector('#pk-file');
    if (btn.disabled) return;
    btn.disabled = true;
    PackSound.unlock();
    const keyRect = root.querySelector('#pk-case-key').getBoundingClientRect();
    const minis = [...root.querySelectorAll('.pk-pile .pk-mini')];
    root.querySelector('#pk-stage-foot').classList.remove('is-on');
    for (let i = 0; i < minis.length; i++){
      const m = minis[i];
      const r = m.getBoundingClientRect();
      const card = pull[i];
      m.animate([
        { transform:'none' },
        { transform:'translate(' + (keyRect.left - r.left + keyRect.width / 2 - r.width / 2) * .5 + 'px,' + ((keyRect.top - r.top) * .5 - 60) + 'px) rotate(-8deg) scale(.8)', offset:.5 },
        { transform:'translate(' + (keyRect.left - r.left + keyRect.width / 2 - r.width / 2) + 'px,' + (keyRect.top - r.top) + 'px) scale(.2)', opacity:.4 }
      ], { duration:420 / speed(), easing:'steps(10,end)', fill:'forwards' });
      setTimeout(() => {
        if (card.kind !== 'chips'){
          if (!world.owned[card.id]) world.fresh.add(card.id);
          world.owned[card.id] = (world.owned[card.id] || 0) + 1;
        }
        PackSound.file(); paintCaseKey(true);
      }, 400 / speed());
      await wait(150);
    }
    await wait(520);
    btn.disabled = false;
    closeStage();
    // open on the page of the best new card
    const best = pull.filter(c => world.fresh.has(c.id)).pop();
    openCase(best ? best.tier : rip.tier, true);
  }
  function closeStage(){
    const st = root.querySelector('#pk-stage');
    st.classList.add('is-out');
    st.setAttribute('aria-hidden', 'true');
    cancelAnimationFrame(stageRaf);
    if (hum){ hum.stop(); hum = null; }
    if (rip.sound){ rip.sound.stop(); rip.sound = null; }
    setTimeout(() => { st.classList.remove('is-out', 'is-reveal', 'is-done', 'is-torn', 'is-dim', 'is-hinted'); root.classList.remove('is-staged'); }, 300);
    const d = deck(); if (d) d.remove();
    world.view = 'machine';
  }

  /* ---- the rays behind a big reveal, and the chip spill ---- */
  const fx = { rays:null };
  function rays(kind){
    if (kind === 'common') return;
    fx.rays = { kind, t0:performance.now() };
  }
  function drawRays(now){
    const cv = root.querySelector('#pk-rays');
    const st = root.querySelector('#pk-stage');
    const w = Math.ceil(st.clientWidth / 4), h = Math.ceil(st.clientHeight / 4);
    if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    const x = cv.getContext('2d');
    x.clearRect(0, 0, w, h);
    if (!fx.rays) return;
    const age = (now - fx.rays.t0) / 1000 * speed();
    const life = fx.rays.kind === 'foil' ? 3.2 : 2.2;
    if (age > life){ fx.rays = null; return; }
    const fade = age < .2 ? age / .2 : Math.max(0, 1 - (age - (life - .8)) / .8);
    const cx = w / 2, cy = h * .45;
    const n = 14, rot = Math.floor(age * 6) / 6 * .25;
    const col = fx.rays.kind === 'foil' ? '255,235,160' : fx.rays.kind === 'wild' ? '210,74,200' : fx.rays.kind === 'rare' ? '242,201,76' : '244,239,225';
    for (let i = 0; i < n; i++){
      const a0 = rot + i / n * Math.PI * 2, a1 = a0 + Math.PI / n * .7;
      x.beginPath(); x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(a0) * w, cy + Math.sin(a0) * w);
      x.lineTo(cx + Math.cos(a1) * w, cy + Math.sin(a1) * w);
      x.closePath();
      x.fillStyle = 'rgba(' + col + ',' + (.14 * fade).toFixed(3) + ')';
      x.fill();
    }
  }
  const chipImgs = ['red', 'blue', 'green', 'black', 'yellow', 'purple'].map(c => { const i = new Image(); i.src = 'assets/chips/chip-' + c + '-01.png'; return i; });
  function chipBurst(el, amount){
    if (!el.isConnected) return;
    const st = root.querySelector('#pk-stage');
    const cv = root.querySelector('#pk-fx');
    const r = st.getBoundingClientRect();
    cv.width = st.clientWidth; cv.height = st.clientHeight;
    const er = el.getBoundingClientRect();
    const n = clamp(Math.round(Math.log10(amount) * 7), 10, 34);
    const floor = Math.min(cv.height - 140, er.bottom - r.top + 40);
    const coins = [];
    for (let i = 0; i < n; i++) coins.push({
      x:er.left - r.left + er.width / 2 + (Math.random() - .5) * 30, y:er.top - r.top + er.height * .4,
      vx:(Math.random() - .5) * 9, vy:-6 - Math.random() * 9, s:18 + Math.random() * 8, img:chipImgs[i % chipImgs.length],
      bounces:0, rest:false, spin:Math.random() * 6
    });
    PackSound.reveal('uncommon');
    let collecting = false, last = performance.now();
    const reel = root.querySelector('#pk-reel').getBoundingClientRect();
    const tx = reel.left - r.left + reel.width / 2, ty = reel.top - r.top + reel.height / 2;
    const target = bank() + amount;
    const step = now => {
      const dt = Math.min(40, now - last) / 16.7 * speed(); last = now;
      const x = cv.getContext('2d');
      x.clearRect(0, 0, cv.width, cv.height);
      x.imageSmoothingEnabled = false;
      let alive = 0;
      coins.forEach(c => {
        if (c.done) return;
        alive++;
        if (!collecting){
          c.vy += .55 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
          if (c.y > floor){ c.y = floor; if (Math.abs(c.vy) > 2 && c.bounces < 3){ c.vy = -c.vy * .45; c.vx *= .7; c.bounces++; PackSound.chipLand(.6 / (c.bounces)); } else { c.vy = 0; c.vx *= .8; c.rest = true; } }
          if (c.x < 10 || c.x > cv.width - 10) c.vx = -c.vx;
        } else {
          const k = .16 * dt;
          c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
          if (Math.hypot(tx - c.x, ty - c.y) < 14){ c.done = true; PackSound.chip(); }
        }
        const sq = Math.abs(Math.cos(c.spin + now / 120)) * .6 + .4;
        x.drawImage(c.img, Math.round(c.x - c.s / 2), Math.round(c.y - c.s * sq / 2), Math.round(c.s), Math.round(c.s * (c.rest || collecting ? .5 : sq)));
      });
      if (!collecting && coins.every(c => c.rest)){ collecting = true; setBank(target); countBank(target, 900, () => PackSound.count()); }
      if (alive) requestAnimationFrame(step); else x.clearRect(0, 0, cv.width, cv.height);
    };
    requestAnimationFrame(step);
  }
  function glitch(){
    const g = root.querySelector('#pk-glitch');
    const st = root.querySelector('#pk-stage');
    st.classList.add('is-glitch');
    let n = 0;
    const t = setInterval(() => {
      g.innerHTML = Array.from({ length:6 }, () => '<i style="top:' + Math.floor(Math.random() * 100) + '%;height:' + (2 + Math.floor(Math.random() * 14)) + 'px;left:' + (Math.floor(Math.random() * 30) - 15) + 'px;background:' + ['#D24A8C', '#3FB7C6', '#F2C94C', '#6A1F7A', '#FFFFFF'][Math.floor(Math.random() * 5)] + '"></i>').join('');
      if (++n > 12){ clearInterval(t); g.innerHTML = ''; st.classList.remove('is-glitch'); }
    }, 55 / speed());
  }

  /* ============================================================
     THE CASE
     ============================================================ */
  function caseHTML(){
    return '<div class="pk-case" id="pk-case" aria-hidden="true">' +
      '<div class="pk-case-lid"><button class="pk-key" id="pk-case-close" type="button" aria-label="Close the case"><span class="pk-nav is-down" aria-hidden="true"></span></button>' +
        '<div class="pk-case-plate"><span class="pk-case-title">TICKET CASE</span><span class="pk-case-sum tabular" id="pk-case-sum"></span></div></div>' +
      '<div class="pk-case-tabs" id="pk-case-tabs">' + T.map(t => '<button type="button" class="pk-tab" data-tier="' + t.id + '" style="--tier:' + t.body + ';--tier-band:' + t.band + '"><b>' + t.key + '</b><small>' + t.short.split(' ')[0] + '</small></button>').join('') + '</div>' +
      '<div class="pk-case-page" id="pk-case-page"></div>' +
      '<div class="pk-case-foot" id="pk-case-foot">TAP A CARD TO PICK IT UP</div>' +
      '<div class="pk-inspect" id="pk-inspect" aria-hidden="true">' +
        '<div class="pk-intake" id="pk-intake"><span class="pk-intake-mouth"><i></i></span><span class="pk-intake-lamp" id="pk-intake-lamp"></span><span class="pk-intake-word" id="pk-intake-word">INSERT CARD</span></div>' +
        '<div class="pk-inspect-card" id="pk-inspect-card"></div>' +
        '<div class="pk-inspect-keys">' +
          '<button class="pk-key pk-key-wide" id="pk-inspect-back" type="button">BACK</button>' +
          '<div class="pc-primary-cradle pk-feed-cradle"><button class="pc-button pc-button-primary pk-feed" id="pk-feed" type="button"><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong id="pk-feed-main">FEED IT</strong><small class="tabular" id="pk-feed-sub"></small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function openCase(tierId, arriving){
    world.view = 'case';
    world.caseTier = tierId || world.caseTier;
    const c = root.querySelector('#pk-case');
    c.classList.add('is-open'); c.setAttribute('aria-hidden', 'false');
    root.classList.add('is-cased');
    PackSound.caseOpen();
    // the drawer ratchets out
    [0, 70, 140, 210].forEach((ms, i) => setTimeout(() => PackSound.ratchet(.5 + i * .15), ms / speed()));
    paintCase(arriving);
  }
  function closeCase(){
    const c = root.querySelector('#pk-case');
    c.classList.remove('is-open'); c.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-cased');
    closeInspect(true);
    PackSound.caseShut();
    world.fresh.clear();
    world.view = 'machine';
  }
  function paintCase(arriving){
    const tier = world.caseTier;
    root.querySelectorAll('.pk-tab').forEach(b => {
      b.classList.toggle('is-on', b.dataset.tier === tier);
      const set = PackCards.byTier[b.dataset.tier];
      b.classList.toggle('has-new', set.some(c => world.fresh.has(c.id)));
    });
    const set = PackCards.byTier[tier];
    const have = set.filter(c => world.owned[c.id]).length;
    const total = PackCards.LIST.filter(c => world.owned[c.id]).length;
    root.querySelector('#pk-case-sum').textContent = PackArt.tier(tier).short + ' ' + have + '/' + set.length + ' · ALL ' + total + '/' + PackCards.LIST.length;
    const page = root.querySelector('#pk-case-page');
    page.style.setProperty('--tier', PackArt.tier(tier).body);
    page.innerHTML = '';
    set.forEach((card, i) => {
      const slot = document.createElement('div');
      slot.className = 'pk-slot-cell';
      const n = world.owned[card.id] || 0;
      if (n){
        const isNew = world.fresh.has(card.id);
        const m = PackCards.mini(card, n, isNew);
        slot.appendChild(m);
        if (arriving && isNew){
          m.style.animationDelay = (i * 90) / speed() + 'ms';
          m.classList.add('is-arriving');
          setTimeout(() => { PackSound.stamp(); buzz(10); }, (260 + i * 90) / speed());
        }
      } else if (card.kind === 'chips'){
        slot.classList.add('is-empty', 'is-chips');
        slot.innerHTML = '<span class="pk-slot-no tabular">' + String(card.no).padStart(2, '0') + '</span><span class="pk-slot-q">$</span><span class="pk-slot-hint">PAID STRAIGHT IN</span>';
      } else {
        slot.classList.add('is-empty');
        slot.innerHTML = '<span class="pk-slot-no tabular">' + String(card.no).padStart(2, '0') + '</span><span class="pk-slot-q">?</span><span class="pk-slot-hint">' + card.rarity.toUpperCase() + '</span>';
      }
      page.appendChild(slot);
    });
  }
  /* ---- picking a card up, feeding it in ---- */
  let inspecting = null;
  function openInspect(id){
    const card = PackCards.byId[id];
    if (!card) return;
    inspecting = card;
    PackSound.flip(); buzz(6);
    const box = root.querySelector('#pk-inspect');
    box.classList.add('is-open'); box.setAttribute('aria-hidden', 'false');
    const holder = root.querySelector('#pk-inspect-card');
    holder.innerHTML = '';
    const el = PackCards.make(card);
    const k = Math.min(1.25, (holder.clientWidth - 24) / CARD_W, (holder.clientHeight - 8) / CARD_H);
    el.style.setProperty('--k', k);
    holder.style.setProperty('--k', k);
    el.classList.add('is-revealed');
    holder.appendChild(el);
    el.animate([{ transform:'translateY(60px) scale(.7) rotate(-6deg)', opacity:.2 }, { transform:'translateY(-6px) scale(1.02)', offset:.7 }, { transform:'none', opacity:1 }], { duration:320 / speed(), easing:'steps(8,end)' });
    const feed = root.querySelector('#pk-feed');
    const playable = !!card.plays;
    const can = playable && bank() >= card.buyIn;
    root.querySelector('#pk-feed-main').textContent = playable ? 'FEED IT' : card.kind === 'cosmetic' ? 'TRY IT ON' : 'PAID';
    root.querySelector('#pk-feed-sub').textContent = playable ? (can ? 'BUY IN ' + money(card.buyIn) : 'NEED ' + money(card.buyIn)) : card.kind === 'cosmetic' ? 'IN THE WORKSHOP, LATER' : '';
    feed.disabled = !can;
    root.querySelector('#pk-intake-word').textContent = playable ? 'INSERT CARD' : '';
    root.querySelector('#pk-intake').classList.toggle('is-idle', !playable);
    root.querySelector('#pk-intake-lamp').className = 'pk-intake-lamp' + (can ? ' is-amber' : '');
    // tilt: drag the card and the light runs across it
    el.addEventListener('pointermove', e => {
      if (!e.buttons && e.pointerType === 'mouse') return;
      const r = el.getBoundingClientRect();
      const nx = clamp((e.clientX - r.left) / r.width, 0, 1), ny = clamp((e.clientY - r.top) / r.height, 0, 1);
      el.style.setProperty('--glare', nx);
      el.querySelector('.pk-card-inner').style.transform = 'rotateY(' + Math.round((nx - .5) * 16) + 'deg) rotateX(' + Math.round((.5 - ny) * 12) + 'deg)';
    });
    el.addEventListener('pointerleave', () => { el.querySelector('.pk-card-inner').style.transform = ''; });
    el.addEventListener('pointerup', () => { el.querySelector('.pk-card-inner').style.transform = ''; });
  }
  function closeInspect(quiet){
    const box = root.querySelector('#pk-inspect');
    box.classList.remove('is-open', 'is-feeding'); box.setAttribute('aria-hidden', 'true');
    inspecting = null;
    if (!quiet) PackSound.flip();
  }
  async function feed(){
    const card = inspecting;
    if (!card || !card.plays) return;
    if (bank() < card.buyIn){ PackSound.deny(); return; }
    const box = root.querySelector('#pk-inspect');
    const holder = root.querySelector('#pk-inspect-card');
    const el = holder.querySelector('.pk-card');
    const intake = root.querySelector('#pk-intake');
    const mouth = intake.querySelector('.pk-intake-mouth');
    const feedBtn = root.querySelector('#pk-feed');
    feedBtn.disabled = true;
    box.classList.add('is-feeding');
    PackSound.unlock(); buzz(16);
    // the card lifts and narrows to the mouth, lined up under it
    const er = el.getBoundingClientRect(), mr = mouth.getBoundingClientRect();
    const k = (mr.width - 8) / er.width;
    const tx = mr.left + mr.width / 2 - (er.left + er.width / 2);
    const ty = mr.bottom - er.top - er.height * (1 - k) / 2 + 2;
    el.querySelector('.pk-card-inner').style.transform = '';
    const lift = el.animate([
      { transform:'none' },
      { transform:'translate(' + tx + 'px,' + (ty * .55) + 'px) scale(' + (k * 1.1) + ')', offset:.7 },
      { transform:'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')' }
    ], { duration:380 / speed(), easing:'steps(9,end)', fill:'forwards' });
    PackSound.lift();
    await lift.finished.catch(() => {});
    // bites: the mouth ratchets it in; whatever passes the mouth is inside
    intake.classList.add('is-biting');
    const bites = 7, h = er.height * k;
    for (let i = 1; i <= bites; i++){
      el.style.clipPath = 'inset(' + Math.round(h * i / bites / k) + 'px 0 0 0)';
      const tf = 'translate(' + tx + 'px,' + (ty - h * i / bites) + 'px) scale(' + k + ')';
      el.getAnimations().forEach(a => a.cancel());
      el.style.transform = tf;
      PackSound.ratchet(.6 + i / bites * .4); buzz(5);
      intake.classList.remove('is-bite'); void intake.offsetWidth; intake.classList.add('is-bite');
      await wait(130);
    }
    el.style.opacity = '0';
    // the grind, then the bankroll moves
    PackSound.stamp(); shake();
    intake.classList.add('is-grind');
    await wait(420);
    let entered = false;
    try{
      setBank(bank());
      entered = enterCareerEvent(card.plays);
    }catch(e){ entered = false; }
    intake.classList.remove('is-grind', 'is-biting');
    if (!entered){
      PackSound.deny();
      root.querySelector('#pk-intake-word').textContent = 'REJECTED';
      await wait(900);
      el.style.opacity = ''; el.style.clipPath = ''; el.style.transform = '';
      box.classList.remove('is-feeding'); feedBtn.disabled = false;
      return;
    }
    root.querySelector('#pk-intake-lamp').className = 'pk-intake-lamp is-green';
    root.querySelector('#pk-intake-word').textContent = 'ENTRY PAID';
    PackSound.beep(true);
    await countBank(bank(), 700, () => PackSound.count());
    if (!card.house){ world.owned[card.id]--; if (world.owned[card.id] <= 0) delete world.owned[card.id]; }
    paintCaseKey();
    await wait(260);
    // on to the real table
    closeInspect(true);
    root.querySelector('#pk-case').classList.remove('is-open');
    root.classList.remove('is-cased');
    world.view = 'machine';
    const launch = () => { try{ startCareerEvent(); }catch(e){} };
    try{
      if (typeof careerDepartToTable === 'function') careerDepartToTable(launch, { callout:card.title });
      else launch();
    }catch(e){ launch(); }
  }
  function closeAll(){
    if (world.view === 'stage') closeStage();
    if (world.view === 'case' || root.classList.contains('is-cased')){
      root.querySelector('#pk-case').classList.remove('is-open');
      root.classList.remove('is-cased');
      closeInspect(true);
    }
    world.view = 'machine';
  }

  /* ============================================================
     WIRING
     ============================================================ */
  function wire(){
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'pk-back'){ PackSound.key(); const real = document.getElementById('ch2-back'); if (real) real.click(); return; }
      if (b.id === 'pk-case-key'){ if (world.view === 'machine' && !world.busy){ openCase(world.caseTier); } return; }
      if (b.id === 'pk-case-close'){ closeCase(); return; }
      if (b.id === 'pk-buy'){ buy(); return; }
      if (b.id === 'pk-flap'){ takePack(); return; }
      if (b.id === 'pk-file'){ fileCards(); return; }
      if (b.id === 'pk-inspect-back'){ closeInspect(); return; }
      if (b.id === 'pk-feed'){ feed(); return; }
      if (b.classList.contains('pk-pad')){ select(ROWS.findIndex(t => t.id === b.dataset.tier)); return; }
      if (b.classList.contains('pk-row')){ select(+b.dataset.r); return; }
      if (b.classList.contains('pk-tab')){ world.caseTier = b.dataset.tier; PackSound.key(); paintCase(false); return; }
      if (b.classList.contains('pk-mini') && b.closest('#pk-case-page')){ openInspect(b.dataset.id); return; }
    });
    const st = root.querySelector('#pk-stage');
    st.addEventListener('pointerdown', e => { cardDown(e); if (!flick) tearDown(e); });
    st.addEventListener('pointermove', e => { cardMove(e); tearMove(e); }, { passive:false });
    st.addEventListener('pointerup', e => { cardUp(e); tearUp(e); });
    st.addEventListener('pointercancel', e => { cardUp(e); tearUp(e); });
    st.addEventListener('touchmove', e => { if (rip.drag || flick) e.preventDefault(); }, { passive:false });
  }
  function select(r){
    if (r < 0 || world.busy) return;
    PackSound.unlock();
    if (!rowOpen(r)){ PackSound.deny(); world.selected = r; paintRows(); paintPanel(); return; }
    if (world.selected !== r){ PackSound.key(); PackSound.beep(false); }
    world.selected = r;
    paintRows(); paintPanel();
  }
  async function takePack(){
    if (!world.tray || world.view !== 'machine') return;
    PackSound.unlock();
    const flap = root.querySelector('#pk-flap');
    flap.classList.add('is-pushed');
    PackSound.flap(true); buzz(10);
    await wait(180);
    const tier = world.tray;
    openStage(tier);
    world.tray = null;
    paintTray(); paintAll();
    setTimeout(() => flap.classList.remove('is-pushed', 'is-full'), 300);
  }

  /* ============================================================
     TUNE: the lab's controls
     ============================================================ */
  function tune(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'pkl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'pkl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Pack lab');
    const seg = (k, opts) => '<div class="pkl-seg" data-key="' + k + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (String(state[k]) === String(o[0]) ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
    sheet.innerHTML =
      '<div class="pkl-head"><b>PACK LAB</b><button type="button" class="pkl-close" aria-label="Close">✕</button></div>' +
      '<div class="pkl-body">' +
        '<h3>OPEN A PACK NOW<small>Straight into your hand, no buying.</small></h3>' +
        '<div class="pkl-grid">' + T.map(t => '<button type="button" data-pack="' + t.id + '" style="--tier:' + t.body + ';--tier-band:' + t.band + '">' + t.name + '</button>').join('') + '</div>' +
        '<h3>THE NEXT PULL<small>Force what\'s in the next pack, to see every reveal.</small></h3>' +
        seg('force', [['normal', 'AS IT FALLS'], ['rare', 'A RARE'], ['foil', 'A FOIL'], ['wild', 'A WILD'], ['jinx', 'A JINX'], ['chips', 'CHIPS'], ['all', 'ALL OF IT']]) +
        '<h3>YOUR CAREER<small>Early: two rows open, a few cards. Late: everything open, a full case.</small></h3>' +
        seg('phase', [['early', 'EARLY'], ['late', 'LATE']]) +
        '<div class="pkl-actions"><button type="button" data-act="cash">+ $10,000</button><button type="button" data-act="reset">START OVER</button></div>' +
        '<h3>MOTION AND SOUND</h3>' +
        '<div class="pkl-name">SPEED</div>' + seg('speed', [[1, 'REAL'], [.5, 'HALF'], [.25, 'QUARTER']]) +
        '<div class="pkl-name">THE RIP</div>' + seg('autorip', [['off', 'BY HAND'], ['on', 'AUTOMATIC']]) +
        '<div class="pkl-name">SOUND</div>' + seg('sound', [['on', 'ON'], ['off', 'OFF']]) +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => { PackSound.unlock(); open(!sheet.classList.contains('is-open')); });
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.classList.contains('pkl-close')){ open(false); return; }
      if (t.dataset.pack){
        open(false);
        if (document.getElementById('career').classList.contains('hidden')){ try{ showCareerScreen(); }catch(err){} }
        closeAll(); world.tray = null; paintAll();
        openStage(t.dataset.pack);
        return;
      }
      if (t.dataset.act === 'cash'){ setBank(bank() + 10000); countBank(bank(), 600); return; }
      if (t.dataset.act === 'reset'){ closeAll(); world.tray = null; seedWorld(); paintAll(); open(false); return; }
      const s = t.closest('.pkl-seg');
      if (s){
        const k = s.dataset.key; let v = t.dataset.v;
        if (k === 'speed') v = Number(v);
        save({ [k]:v });
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        if (k === 'sound'){ try{ settings.sound = v === 'on'; }catch(err){} PackSound.setMuted(v !== 'on'); }
        if (k === 'phase'){ closeAll(); world.tray = null; seedWorld(); paintAll(); }
        root.style.setProperty('--pk-speed', state.speed);
      }
    });
  }

  function start(){
    build();
    tune();
    if (root) root.style.setProperty('--pk-speed', state.speed);
    if (state.sound === 'off') PackSound.setMuted(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
