"use strict";

/* ============================================================
   BANK LOAD (live v0.64.0) — how your bank fills when you sit down at a
   table: the table intro's bank step (Quick Deal, a run, a Career table).
   Built in the Bank Load Lab (bank-load-lab.html, round 1;
   docs/ui/BANK_LOAD_PLAN.md). Workshop → Bank picks one
   (settings.bankLoad):

   COUNT IN (default)  the hatch opens and the chips drop in one by one,
                       straight down onto their stacks, back row first,
                       the STACK readout counting up as they land.
   TRAY IN             the whole rack comes down into the box on its
                       tray, settles with a small bounce and a clunk, and
                       gleams.

   The finished rack is built FIRST, exactly as the game lays it out
   (CoinTable.syncHoard(true): the same coins, the same places), and the
   real coins stay hidden while a copy of them plays the entrance, clipped
   to the bank box. When it ends the copy goes and the real coins show, so
   the bank is always right underneath: a tap to skip, a bet, a resize can
   never leave it half-filled. TableIntro waits for the entrance's length.

   SHELVES: the rack's back rows stand on steps (a brass lip, a dark face),
   so a back stack never looks like it floats over the front ones.

   BankLoad.preview(box, style) plays the same entrance in any box built
   like the bank's (the Workshop's Bank tab).

   Presentation only: reads `game`, never changes poker state.
   ============================================================ */
// The owner's picks (round 1). The other values are the lab's dials.
const BANK_LOAD_OPT = {
  // COUNT IN
  entry:'drop',          // 'drop' (straight down onto its stack) | 'slot' (out of the slot, over to its stack)
  unit:'chip',           // 'chip' (one chip at a time) | 'stack' (whole stacks)
  order:'back',          // 'back' (back row first, left to right) | 'middle' (middle out)
  countMs:'1200',        // the whole count, ms
  readout:'count',       // 'count' (the STACK readout counts up with the chips) | 'once'
  // TRAY IN
  from:'above',          // 'above' (down through the top) | 'below'
  motion:'smooth',       // 'smooth' (eases in, small bounce) | 'stepped' (pixel steps, a hard stop)
  trayMs:'600',
  // both
  shelves:'on'           // 'on' | 'off'
};

const BankLoad = (() => {
  const O = BANK_LOAD_OPT;
  const CW = window.CoinWorld, CT = typeof CoinTable !== 'undefined' ? CoinTable : null;
  if (!CW || !CT) return null;
  const STYLES = ['count','tray'];
  const styleNow = () => STYLES.includes(settings.bankLoad) ? settings.bankLoad : 'count';
  const hl = () => document.getElementById('hud-left');
  const human = () => game && game.players.find(p => p.isHuman);
  const reduced = () => typeof motionOff === 'function' && motionOff();
  const speed = () => Math.max(.15, typeof speedMult === 'function' ? speedMult() : 1);
  const timeScale = () => Math.max(.05, (typeof TABLE_INTRO_CONFIG !== 'undefined' && TABLE_INTRO_CONFIG.timeScale) || 1);
  // how long an entrance takes, before the game's speed
  const baseMs = style => style === 'tray' ? +O.trayMs + 260 : +O.countMs + 120;

  /* ---------- the stacks, in the order they're loaded ---------- */
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
  // every row but the front one stands on a step: its lip at the row's
  // floor, its face down to the floor of the row in front
  function shelvesIn(box, bodies){
    let el = box.querySelector(':scope > .bl-shelves');
    const rows = O.shelves === 'on' ? [...new Set(bodies.filter(b => b.state === 'rest').map(b => Math.round(b.y)))].sort((a, c) => a - c) : [];
    if (rows.length < 2){ if (el) el.remove(); return null; }
    if (!el){ el = document.createElement('div'); el.className = 'bl-shelves'; box.appendChild(el); }
    const top = box.getBoundingClientRect().top + box.clientTop;
    el.innerHTML = rows.slice(0, -1).map((y, i) => '<i style="top:' + (y - top - 1) + 'px;height:' + (rows[i + 1] - y + 1) + 'px"></i>').join('');
    return el;
  }
  let shelfKey = '';
  function paintShelves(){
    const box = hl(), z = CW.zones && CW.zones.bank;
    if (!box || !box.offsetParent) return;
    const r = box.getBoundingClientRect();
    const rows = z ? [...new Set(z.list.filter(b => b.state === 'rest').map(b => Math.round(b.y)))].join(',') : '';
    const key = rows + '|' + Math.round(r.top) + '|' + Math.round(r.height) + '|' + O.shelves;
    if (key === shelfKey) return;
    shelfKey = key;
    shelvesIn(box, z ? z.list : []);
  }
  // the rack grows and shrinks a row at a time as the stack changes
  setInterval(() => { if (!run) paintShelves(); }, 300);

  /* ---------- an entrance: a copy of the rack, clipped to the box ---------- */
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
  /* Plays `style` in `box` over `bodies` (resting coins already in their
     places, drawn), lasting `ms`. onLand(fraction of the value landed) as
     they land. Returns { clip, anims, timers }; the caller ends it. */
  function entrance(box, bodies, style, ms, onLand){
    const fx = { anims:[], timers:[] };
    const later = (fn, t) => fx.timers.push(setTimeout(fn, t));
    const { clip, rig, r } = rigFor(box);
    fx.clip = clip;
    const coins = bodies.map(b => cloneCoin(b, rig));
    const shelves = box.querySelector(':scope > .bl-shelves');
    if (style === 'tray') trayIn(fx, later, rig, r, box, shelves, ms, onLand);
    else countIn(fx, later, coins, r, ms, onLand);
    return fx;
  }

  /* COUNT IN */
  function countIn(fx, later, coins, r, ms, onLand){
    const by = new Map(coins.map(c => [c.b, c]));
    const stacks = ordered(stacksOf(coins.map(c => c.b)));
    const units = O.unit === 'chip' ? stacks.flatMap(s => s.map(b => [b])) : stacks;
    const n = units.length, k = ms / Math.max(1, baseMs('count'));
    const fall = Math.round((O.unit === 'chip' ? 210 : 250) * k);
    const span = Math.max(0, ms - 120 * k - fall);
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
        fx.anims.push(c.el.animate(kf, { duration:fall, delay:t0, fill:'backwards', easing:'linear' }));
        if (c.sh) fx.anims.push(c.sh.animate([{ opacity:0 }, { opacity:0, offset:.8 }, { opacity:1 }], { duration:fall, delay:t0, fill:'backwards' }));
      });
      later(() => {
        CW.sfx('stack', O.unit === 'chip' ? .5 : .7, 1 + Math.min(.45, i / Math.max(1, n) * .45));
        landed += u.reduce((a, b) => a + CW.valueOf(b.colour), 0);
        if (onLand) onLand(landed / total);
      }, t0 + fall * .82);
    });
  }

  /* TRAY IN */
  function trayIn(fx, later, rig, r, box, shelves, ms, onLand){
    // the tray they stand on rides in with them
    const tray = document.createElement('div'); tray.className = 'bl-tray';
    Object.assign(tray.style, { left:(r.left + box.clientLeft + 4) + 'px', width:(r.width - box.clientLeft * 2 - 8) + 'px', top:(r.bottom - box.clientTop - 7) + 'px' });
    rig.insertBefore(tray, rig.firstChild);
    const H = r.height + 8, from = O.from === 'above' ? -H : H;
    const move = Math.max(120, ms - 260 * ms / Math.max(1, baseMs('tray')));
    const kf = O.motion === 'smooth'
      ? [{ translate:'0px ' + from + 'px', easing:'cubic-bezier(.2,.7,.3,1)' }, { translate:'0px ' + (from > 0 ? -3 : 3) + 'px', offset:.78 }, { translate:'0px 0px' }]
      : [{ translate:'0px ' + from + 'px', easing:'steps(7,end)' }, { translate:'0px 0px', offset:.86 }, { translate:'0px ' + (from > 0 ? 2 : -2) + 'px', offset:.93 }, { translate:'0px 0px' }];
    fx.anims.push(rig.animate(kf, { duration:move, fill:'backwards' }));
    if (shelves) fx.anims.push(shelves.animate(kf.map(f => Object.assign({}, f)), { duration:move, fill:'backwards' }));
    later(() => {
      try{ Sound.hatchClose(); }catch(e){}
      CW.sfx('stack', 1, .82);
      if (onLand) onLand(1);
      if (box.animate) fx.anims.push(box.animate([{ translate:'0px 2px' }, { translate:'0px 0px' }], { duration:120, easing:'steps(2,end)' }));
    }, move * .78);
  }
  function stop(fx, keepCopy){
    if (!fx) return;
    fx.timers.forEach(clearTimeout);
    fx.anims.forEach(a => { try{ a.cancel(); }catch(e){} });
    if (!keepCopy && fx.clip) fx.clip.remove();
  }

  /* ---------- the table's load ---------- */
  // the STACK readout, held while the count runs (06-presentation.js's
  // updateJackpot asks BankLoad.holdsReadout)
  let holdReadout = false;
  const readout = v => { try{ updateJackpot(v, true); }catch(e){} };
  let run = null;   // { fx, timers, resolve, done }
  function hide(list, on){
    list.forEach(b => {
      b.fresh = on;                     // CoinTable's box tracker leaves fresh coins alone
      b.el.style.visibility = on ? 'hidden' : '';
      if (b.sh) b.sh.style.visibility = on ? 'hidden' : '';
    });
  }
  function finish(){
    if (!run) return;
    const r = run; run = null;
    stop(r.fx);
    r.timers.forEach(clearTimeout);
    const z = CW.zones.bank;
    if (z){ hide(z.list, false); z.list.forEach(b => CW.dirty.add(b)); CW.kick(); }
    const sh = hl() && hl().querySelector(':scope > .bl-shelves'); if (sh) sh.style.translate = '';
    holdReadout = false;
    const h = human(); if (h) readout(h.chips);
    shelfKey = ''; paintShelves();
    r.resolve();
  }
  // TableIntro's bank step: returns how long it takes (before the intro's
  // own time scale), and the rack is right whatever happens next
  function load(){
    finish();
    const h = human(), box = hl();
    if (!h || !box || !CT.on()) return 0;
    if (typeof BankLoad.beforeLoad === 'function') BankLoad.beforeLoad(h);
    CT.sync();
    // the finished rack, laid out at once
    const z0 = CW.zones.bank;
    if (z0){ z0.list.slice().forEach(b => { CW.removeBody(b); b.el.remove(); }); z0.list = []; }
    const style = styleNow();
    const ms = reduced() ? 0 : Math.round(baseMs(style) / speed());
    let resolve; const done = new Promise(res => { resolve = res; });
    run = { fx:null, timers:[], resolve, done };
    const mine = run;
    if (style === 'count' && O.readout === 'count' && ms){ holdReadout = true; readout(0); }
    CT.syncHoard(true).then(() => {
      if (run !== mine) return;
      const z = CW.zones.bank;
      if (!z || !z.list.length || !ms){ finish(); return; }
      z.list.forEach(b => CW.draw(b));
      shelfKey = ''; paintShelves();
      hide(z.list, true);
      const scaled = ms / timeScale();
      run.fx = entrance(box, z.list.slice(), style, scaled, f => { if (holdReadout) readout(Math.round(h.chips * f)); });
      run.timers.push(setTimeout(() => { const zb = CW.zones.bank; if (zb) CW.glintPile(zb); }, scaled - 60));
      run.timers.push(setTimeout(finish, scaled + 40));
    }).catch(e => { console.error(e); finish(); });
    return ms;
  }

  /* ---------- a preview, in any box built like the bank ---------- */
  // The rack a Quick Deal loads: $1,000 at 10/20, as many chips as
  // coin-table.js's hoardCount() gives at its default size.
  const previews = new WeakMap();
  function preview(box, style, opts){
    opts = opts || {};
    const old = previews.get(box);
    if (old){ stop(old.fx); old.timers.forEach(clearTimeout); }
    box.querySelectorAll(':scope > .bl-clip').forEach(e => e.remove());
    if (!box.getBoundingClientRect().width) return Promise.resolve();
    try{ CT.sync(); }catch(e){}
    const r = box.getBoundingClientRect();
    const k = { L:r.left + 6, R:r.right - 6, T:r.top + 10, B:r.bottom - 9 };
    const id = 'bl:preview';
    const z = CW.zone(id, (k.L + k.R) / 2, k.B, 12, 30, 30);
    z.box = { L:k.L, R:k.R, T:k.B - 40, B:k.B }; z.room = k.B - k.T - 4; z.hoard = true; z.rack = true;
    const chips = opts.chips || 1000, sb = opts.sb || 10, bb = opts.bb || 20;
    const want = Math.max(3, Math.min(CW.rackCapacity(z), Math.round(4 + 38 * Math.log10(1 + chips / bb / 8))));
    const T = CW.TIERS(), counts = CW.composeTiers(Math.round(chips / sb), want).counts, adds = [];
    T.forEach((col, i) => { for (let j = 0; j < counts[i]; j++) adds.push(col); });
    const plan = CW.planZone(z, adds);
    const bodies = adds.map((col, i) => {
      const s = plan.extras[i];
      const b = CW.body(CW.makeChip(col), s.x, s.y, s.z, CW.D());
      b.zone = z; z.list.push(b);
      return b;
    });
    bodies.forEach(b => CW.draw(b));
    shelvesIn(box, bodies);
    const kind = style === 'tray' ? 'tray' : 'count';
    const ms = reduced() ? 0 : baseMs(kind);
    const fx = entrance(box, bodies, kind, Math.max(1, ms), opts.onLand);
    // the copy stays as the rack at rest; the coins it was copied from go
    bodies.forEach(b => { CW.removeBody(b); b.el.remove(); });
    delete CW.zones[id];
    const p = { fx, timers:[] };
    previews.set(box, p);
    if (!ms){ stop(fx, true); if (opts.onLand) opts.onLand(1); return Promise.resolve(); }
    return new Promise(res => p.timers.push(setTimeout(() => { fx.timers.forEach(clearTimeout); res(); }, ms + 40)));
  }

  return {
    load, finish, preview, paintShelves, opt:O, STYLES, style:styleNow,
    get running(){ return !!run; },
    get holdsReadout(){ return holdReadout; },
    // the current load, settled (resolves at once when nothing is loading)
    get done(){ return run ? run.done : Promise.resolve(); },
    beforeLoad:null
  };
})();
