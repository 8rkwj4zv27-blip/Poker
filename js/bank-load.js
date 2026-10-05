"use strict";

/* ============================================================
   BANK LOAD (candidate, Bank Load Lab) — how your bank fills when you sit
   down at a table (the table intro's bank step: Quick Deal, a run, a
   Career table).

   The finished rack is built FIRST, exactly as the game lays it out
   (CoinTable.syncHoard(true): the same coins, the same places), and the
   real coins stay hidden while a copy of them plays the entrance, clipped
   to the bank box. When it ends, the copy goes and the real coins show.
   So the bank is always right underneath: a tap to skip, a bet, a resize
   can never leave it half-filled.

   Two entrances (the owner's picks from the first look):
   A · COUNT IN  the cashier counts you in: the hatch opens and the chips
                 come down through the slot stack by stack, in a fixed
                 order, the STACK readout counting up as they land.
   C · TRAY IN   the rack is loaded whole: a tray of stacks slides into
                 the box, locks with a clunk, and gleams.

   SHELVES: the rack's back rows stand on visible steps, so a back stack
   never looks like it's floating over the front ones.

   Presentation only: reads `game`, never changes poker state.
   ============================================================ */
const BANK_LOAD_OPT = {
  style:'count',         // 'count' (A) | 'tray' (C)
  // A · COUNT IN
  entry:'slot',          // 'slot' (out of the slot, over to its stack) | 'drop' (straight down onto its stack)
  unit:'stack',          // 'stack' (whole stacks) | 'chip' (one chip at a time)
  order:'back',          // 'back' (back row first, left to right) | 'middle' (middle out)
  countMs:'1200',        // the whole count, ms
  readout:'count',       // 'count' (the STACK readout counts up with the chips) | 'once'
  // C · TRAY IN
  from:'below',          // 'below' | 'above' (down through the top)
  motion:'stepped',      // 'stepped' (pixel steps, a hard stop) | 'smooth' (eases in, small bounce)
  trayMs:'600',
  // both
  shelves:'on'           // 'on' | 'off'
};

const BankLoad = (() => {
  const O = BANK_LOAD_OPT;
  const CW = window.CoinWorld, CT = typeof CoinTable !== 'undefined' ? CoinTable : null;
  if (!CW || !CT) return null;
  const hl = () => document.getElementById('hud-left');
  const human = () => game && game.players.find(p => p.isHuman);
  const reduced = () => typeof motionOff === 'function' && motionOff();
  const speed = () => Math.max(.15, typeof speedMult === 'function' ? speedMult() : 1);

  /* ---------- the readout: held while the count runs ---------- */
  const realJackpot = window.updateJackpot;
  let holdReadout = false;
  window.updateJackpot = function(v){ if (holdReadout) return; return realJackpot.apply(this, arguments); };
  const readout = v => { try{ realJackpot(v); }catch(e){} };

  /* ---------- the copy, clipped to the box ---------- */
  let run = null;   // { clip, coins, timers, anims, done, resolve }
  function rigFor(box){
    const r = box.getBoundingClientRect();
    const clip = document.createElement('div'); clip.className = 'bl-clip';
    const rig = document.createElement('div'); rig.className = 'bl-rig';
    Object.assign(rig.style, { left:-(r.left + box.clientLeft) + 'px', top:-(r.top + box.clientTop) + 'px', width:innerWidth + 'px', height:innerHeight + 'px' });
    clip.appendChild(rig); box.appendChild(clip);
    return { clip, rig, r };
  }
  function cloneCoin(b, rig){
    const sh = b.sh ? b.sh.cloneNode(true) : null;
    const el = b.el.cloneNode(true);
    el.style.visibility = ''; if (sh) sh.style.visibility = '';
    if (sh) rig.appendChild(sh);
    rig.appendChild(el);
    return { b, el, sh };
  }
  function hide(list, on){
    list.forEach(b => {
      b.fresh = on;                     // CoinTable's box tracker leaves fresh coins alone
      b.el.style.visibility = on ? 'hidden' : '';
      if (b.sh) b.sh.style.visibility = on ? 'hidden' : '';
    });
  }
  const later = (fn, ms) => { if (!run) return; run.timers.push(setTimeout(fn, ms)); };

  /* the stacks as they stand: one group per place, bottom coin first */
  function stacksOf(list){
    const m = new Map();
    list.forEach(b => { const k = Math.round(b.x) + ',' + Math.round(b.y); (m.get(k) || m.set(k, []).get(k)).push(b); });
    return [...m.values()].map(s => s.sort((a, c) => a.z - c.z));
  }
  function ordered(stacks){
    const cx = stacks.reduce((a, s) => a + s[0].x, 0) / Math.max(1, stacks.length);
    return stacks.sort((a, c) => O.order === 'middle'
      ? (Math.abs(a[0].x - cx) - Math.abs(c[0].x - cx)) || (a[0].y - c[0].y)
      : (a[0].y - c[0].y) || (a[0].x - c[0].x));
  }

  /* ---------- the shelves ---------- */
  let shelfKey = '';
  function paintShelves(){
    const box = hl(), z = CW.zones && CW.zones.bank;
    if (!box) return;
    let el = box.querySelector('.bl-shelves');
    const rows = z && O.shelves === 'on' ? [...new Set(z.list.filter(b => b.state === 'rest').map(b => Math.round(b.y)))].sort((a, c) => a - c) : [];
    const r = box.getBoundingClientRect();
    const key = rows.join(',') + '|' + Math.round(r.top) + '|' + Math.round(r.height) + '|' + O.shelves;
    if (key === shelfKey && el) return;
    shelfKey = key;
    if (!rows.length){ if (el) el.remove(); return; }
    if (!el){ el = document.createElement('div'); el.className = 'bl-shelves'; box.appendChild(el); }
    const top = r.top + box.clientTop;
    // every row but the front one stands on a step: its lip at the row's
    // floor, its face down to the floor of the row in front
    el.innerHTML = rows.slice(0, -1).map((y, i) => '<i style="top:' + (y - top - 1) + 'px;height:' + (rows[i + 1] - y + 1) + 'px"></i>').join('');
  }
  setInterval(() => { if (!run) paintShelves(); }, 300);

  /* ---------- the load ---------- */
  function finish(){
    if (!run) return;
    const r = run; run = null;
    r.timers.forEach(clearTimeout);
    r.anims.forEach(a => { try{ a.cancel(); }catch(e){} });
    if (r.clip) r.clip.remove();
    const z = CW.zones.bank;
    if (z){ hide(z.list, false); z.list.forEach(b => CW.dirty.add(b)); CW.kick(); }
    const sh = hl() && hl().querySelector('.bl-shelves'); if (sh) sh.style.translate = '';
    holdReadout = false;
    const h = human(); if (h) readout(h.chips);
    shelfKey = ''; paintShelves();
    r.resolve();
  }

  // returns the ms the entrance takes (the intro waits for it)
  function play(){
    finish();
    const h = human(), box = hl();
    if (!h || !box || !CT.on()) return { ms:0, done:Promise.resolve() };
    if (typeof BankLoad.beforeLoad === 'function') BankLoad.beforeLoad(h);
    CT.sync();
    // the finished rack, laid out at once
    const z0 = CW.zones.bank;
    if (z0){ z0.list.slice().forEach(b => { CW.removeBody(b); b.el.remove(); }); z0.list = []; }
    const k = Math.max(.05, (typeof TABLE_INTRO_CONFIG !== 'undefined' && TABLE_INTRO_CONFIG.timeScale) || 1);
    const ms = reduced() ? 0 : Math.round((O.style === 'tray' ? +O.trayMs + 260 : +O.countMs + 120) / speed() / k);
    let resolve; const done = new Promise(r => { resolve = r; });
    run = { clip:null, timers:[], anims:[], resolve };
    const mine = run;
    if (O.style === 'count' && O.readout === 'count' && !reduced()){ holdReadout = true; readout(0); }
    CT.syncHoard(true).then(() => {
      if (run !== mine) return;
      const z = CW.zones.bank;
      if (!z || !z.list.length || reduced()){ finish(); return; }
      z.list.forEach(b => CW.draw(b));
      shelfKey = ''; paintShelves();
      hide(z.list, true);
      const { clip, rig, r } = rigFor(box);
      run.clip = clip;
      const coins = z.list.map(b => cloneCoin(b, rig));
      if (O.style === 'tray') trayIn(coins, rig, r, box, ms);
      else countIn(coins, r, ms, h);
      later(finish, ms + 40);
    }).catch(e => { console.error(e); finish(); });
    return { ms, done };
  }

  /* A · COUNT IN */
  function countIn(coins, r, ms, h){
    const by = new Map(coins.map(c => [c.b, c]));
    const stacks = ordered(stacksOf(coins.map(c => c.b)));
    const units = O.unit === 'chip' ? stacks.flatMap(s => s.map(b => [b])) : stacks;
    const n = units.length;
    const fall = Math.round((O.unit === 'chip' ? 210 : 250) / speed());
    const span = Math.max(0, ms - 120 - fall);
    // the count speeds up as it goes
    const at = i => n < 2 ? 0 : span * (.45 * (i / (n - 1)) + .55 * (1 - Math.pow(1 - i / (n - 1), 2)));
    const total = coins.reduce((a, c) => a + CW.valueOf(c.b.colour), 0) || 1;
    const sx = r.left + r.width / 2, sy = r.top + 6;
    let landed = 0;
    units.forEach((u, i) => {
      const base = u[0], t0 = at(i);
      const fromX = O.entry === 'slot' ? sx - base.x : 0;
      // start above the box's top edge (clipped), so it comes in through the top
      const fromY = (O.entry === 'slot' ? sy : r.top) - (base.y - base.z) - base.d * 1.6;
      u.forEach(b => {
        const c = by.get(b); if (!c) return;
        const kf = [];
        // a gravity drop: x eases over early, y accelerates
        for (let s = 0; s <= 6; s++){
          const t = s / 6, ex = 1 - Math.pow(1 - t, 2), ey = t * t;
          kf.push({ offset:t * .82, translate:Math.round(fromX * (1 - ex)) + 'px ' + Math.round(fromY * (1 - ey)) + 'px', scale:'1 1' });
        }
        kf.push({ offset:.9, translate:'0px 1px', scale:'1.14 .84' });
        kf.push({ offset:1, translate:'0px 0px', scale:'1 1' });
        run.anims.push(c.el.animate(kf, { duration:fall, delay:t0, fill:'backwards', easing:'linear' }));
        if (c.sh) run.anims.push(c.sh.animate([{ opacity:0 }, { opacity:0, offset:.8 }, { opacity:1 }], { duration:fall, delay:t0, fill:'backwards' }));
      });
      later(() => {
        CW.sfx('stack', O.unit === 'chip' ? .5 : .7, 1 + Math.min(.45, i / Math.max(1, n) * .45));
        landed += u.reduce((a, b) => a + CW.valueOf(b.colour), 0);
        if (holdReadout) readout(Math.round(h.chips * landed / total));
      }, t0 + fall * .82);
    });
    later(() => { CW.glintPile(CW.zones.bank); }, ms - 60);
  }

  /* C · TRAY IN */
  function trayIn(coins, rig, r, box, ms){
    // the tray they stand on rides in with them
    const tray = document.createElement('div'); tray.className = 'bl-tray';
    Object.assign(tray.style, { left:(r.left + box.clientLeft + 4) + 'px', width:(r.width - box.clientLeft * 2 - 8) + 'px', top:(r.bottom - box.clientTop - 7) + 'px' });
    rig.insertBefore(tray, rig.firstChild);
    const shelves = box.querySelector('.bl-shelves');
    const H = r.height + 8, from = O.from === 'above' ? -H : H;
    const move = Math.max(120, ms - 260);
    const kf = O.motion === 'smooth'
      ? [{ translate:'0px ' + from + 'px', easing:'cubic-bezier(.2,.7,.3,1)' }, { translate:'0px ' + (from > 0 ? -3 : 3) + 'px', offset:.78 }, { translate:'0px 0px' }]
      : [{ translate:'0px ' + from + 'px', easing:'steps(7,end)' }, { translate:'0px 0px', offset:.86 }, { translate:'0px ' + (from > 0 ? 2 : -2) + 'px', offset:.93 }, { translate:'0px 0px' }];
    run.anims.push(rig.animate(kf, { duration:move, fill:'backwards' }));
    if (shelves) run.anims.push(shelves.animate(kf.map(f => Object.assign({}, f)), { duration:move, fill:'backwards' }));
    later(() => {
      try{ Sound.hatchClose(); }catch(e){}
      CW.sfx('stack', 1, .82);
      if (box.animate) run.anims.push(box.animate([{ translate:'0px 2px' }, { translate:'0px 0px' }], { duration:120, easing:'steps(2,end)' }));
    }, move * .86);
    later(() => { CW.glintPile(CW.zones.bank); }, move + 140);
  }

  /* ---------- into the game ---------- */
  // the table intro's bank step: our entrance, and the intro waits for it
  CT.loadBank = function(){
    const { ms } = play();
    if (typeof TABLE_INTRO_CONFIG !== 'undefined'){
      const b = TABLE_INTRO_CONFIG.bank;
      b.settleMs = Math.max(140, ms - b.dropMs + 60);
    }
    return ms;
  };
  // a tap that hurries the intro lands on the finished rack at once
  const render0 = CT.renderBank;
  CT.renderBank = function(){ if (run) finish(); return render0.apply(this, arguments); };

  return { play:() => play().done, finish, get running(){ return !!run; }, paintShelves, opt:O, beforeLoad:null };
})();
