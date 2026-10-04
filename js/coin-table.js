/* ============================================================
   COIN TABLE · CHIPS (v0.46.0) — the table's coins as poker chips, built
   in the Chip Lab (chip-lab.html, docs/ui/CHIP_PLAN.md). Runs on
   js/coin-world.js. Grown from the Hoard Lab's table.

   What it adds: every bet and every pile counted in CHIP COINS (the
   world's tiers, x5 each, a lowest coin worth the small blind), the bank
   as a pot of them (the hoard's box zone: one colour per stack, richest
   in the middle, tap to tidy), and the SLOT (CoinWorld.OPT.bankIn):
   your bank's coin slot on its top edge. Wins stream to it one by one and
   drop through onto your pile; bets hop up out of it and on to the felt.
   Resting coins in the bank hide while something (the raise panel, a
   sheet) covers the box.
   ============================================================ */
const COIN_TABLE_ON = true;

const CoinTable = (function(){
  'use strict';
  const CW = window.CoinWorld;
  Object.assign(CW.OPT, { denom:'on', betCap:16, allinCap:24, spotCap:30, potCap:100 });
  // chips: the pot is always a pyramid, like the bank (owner)
  Object.assign(CW.OPT, { potShape:'pyramid' });
  // Lab 2 (coin-bank-lab.html): the bank's inside, js/coin-bank.js's View
  // in one of its styles; 'today' is the shipped rack (Lab 1 runs on it).
  // The game's bank is always the hoard (sync() keeps it so): start there,
  // or a bank drawn before the first sync() built the old tubes for a
  // moment and then failed to rebuild them as 'hoard'.
  Object.assign(CW.OPT, { bank:'hoard', bankLabels:'off', bankChange:3 });
  const denomOn = ()=>CW.OPT.denom!=='off';
  // one small coin is the small blind this hand
  const unit = ()=>Math.max(1, (game && game.smallBlind) || 1);
  // the throw's kind reads the bet in big blinds, whatever the level
  const kindOf = (amount, allin, canShove)=>CW.kindFor(amount*CW.BB/Math.max(1,(game && game.bigBlind)||CW.BB), allin, canShove);
  let laid = null;           // layout key when zones/walls/tray are current
  let shown = 0;             // the pot as the plate shows it: swept coins
  let sweeping = null;
  let leaving = 0;           // payout coins still on their way out of the tray
  let tapWired = false, audioWired = false;

  function on(){ return COIN_TABLE_ON && !!CW && !!$('felt') && !!$('table-screen'); }

  // the game's settings drive the world: sound on/off, speed (Fast/Relaxed,
  // QUICK RESOLVE, FAST DEV)
  function sync(){
    const O = CW.OPT;
    O.sound = settings.sound ? 'on' : 'off';
    O.sfx = settings.coinSound || 'clay';
    // (chips: your bank is always the chip pile; the old Settings → Bank
    // choices stay saved but no longer apply)
    O.bank = 'hoard';
    // the chip size (Settings → The table, js/table-room.js)
    if (typeof TableRoom!=='undefined') O.size = TableRoom.sizeKey();
    const m = typeof speedMult==='function' ? speedMult() : 1;
    O.speed = 1/Math.max(.15, m);
    if (!audioWired){
      audioWired = true;
      // iOS: the coin sounds' audio context wakes on a real touch
      document.addEventListener('pointerdown', ()=>CW.Coin.unlock(), { capture:true });
    }
  }

  /* ---------------- layout: tray, spots, walls ---------------- */
  // The five board places and the pot plate are measured even when they
  // aren't showing: placeholder cards are laid into the board row, and the
  // pot area is unhidden, for one synchronous measurement.
  function measure(fn){
    const board = $('board'), potArea = $('pot-area');
    const temp = [];
    const have = board ? board.children.length : 0;
    for (let i=have; i<5 && board; i++){
      const c = document.createElement('div');
      c.className = 'card ct-measure'; c.style.visibility = 'hidden';
      board.appendChild(c); temp.push(c);
    }
    const hid = potArea && potArea.classList.contains('hidden');
    // unhiding restarts the plate's intro slide-in (from zero height):
    // measure it at rest
    const plate = potArea && potArea.querySelector('.pot-chip');
    if (plate) plate.style.animation = 'none';
    if (hid) potArea.classList.remove('hidden');
    try { return fn(); }
    finally {
      temp.forEach(c=>c.remove());
      if (hid) potArea.classList.add('hidden');
      if (plate) plate.style.animation = '';
    }
  }
  function layoutKey(){
    const f = $('felt').getBoundingClientRect();
    // the seats' card rows too: an opponent's box can change height after
    // the spots are laid (their hearts row appears on the first render in
    // a house game), and the spots must follow their cards
    const rows = game ? game.players.map(p=>{
      const e = seatEls[p.id];
      // Enemy Cards V2: the seat itself (its tucked cards move on a deal
      // or a showdown, the spot must not)
      const ec = !p.isHuman && typeof EnemyCards!=='undefined' && EnemyCards.rowKey(p);
      return e && !p.isHuman ? (ec || Math.round(e.cardsContainer.getBoundingClientRect().bottom)) : '';
    }).join(',') : '';
    return [Math.round(f.left), Math.round(f.top), Math.round(f.width), Math.round(f.height),
      game ? game.players.map(p=>p.id).join(',') : '', rows].join('|');
  }
  function layout(){
    if (!on() || !game) return false;
    const key = layoutKey();
    if (laid===key && CW.zones.pot) { CW.buildWalls(); return true; }
    const felt = $('felt'), fr = felt.getBoundingClientRect();
    if (!fr.width) return false;
    CW.setHost($('table-screen'), [35,36]);
    CW.ensureLayers(); CW.alignLayers();
    measure(()=>{
      const pr = $('pot-area').querySelector('.pot-chip').getBoundingClientRect();
      // the plate is solid even while it's hidden (an empty pot)
      CW.setExtraBlocks(pr.width ? [{ L:pr.left, T:pr.top, R:pr.right, B:pr.bottom }] : []);
      CW.buildWalls();
      const bb = CW.boardRow();
      // the tray: a well centred on the pot pile, under the coins; its
      // bottom edge tucks 8px under the pot plate (the owner's 210 x 62,
      // table spacing pass)
      felt.querySelectorAll('.ct-tray').forEach(el=>el.remove());
      // (the Chip Lab: a bigger tray, 250 x 66, for the big pots)
      const TW=250, TH=66, cx=pr.left+pr.width/2, yc=pr.top+8-TH/2;
      const tray = document.createElement('div'); tray.className = 'ct-tray'; tray.dataset.tray = 'well';
      Object.assign(tray.style,{ width:TW+'px', height:TH+'px',
        left:Math.round(cx-fr.left-TW/2)+'px', top:Math.round(yc-fr.top-TH/2)+'px' });
      felt.appendChild(tray);
      // keep coins already on the felt: re-home each zone's list
      const old = {}; Object.keys(CW.zones).filter(k=>k!=='bank').forEach(k=>{ old[k] = CW.zones[k]; delete CW.zones[k]; });
      CW.zone('pot', cx, yc+5, 9, 15, 44);
      // (the pot lower down the felt keeps its old height when the room
      // it gained is for air: Settings → The table)
      if (bb) CW.zones.pot.room = (yc+5)-bb.B-10-(typeof TableRoom!=='undefined' ? TableRoom.airDrop() : 0);
      CW.setTray({ L:cx-TW/2+6, R:cx+TW/2-6, T:yc-TH/2+4, B:yc+TH/2-4 });
      // your cards, dealt or not: the spot sits just above them
      const mine = document.querySelector('#hud-mid .seat.you .seat-cards');
      const hr = mine && mine.getBoundingClientRect();
      game.players.forEach(p=>{
        const e = seatEls[p.id]; if (!e) return;
        let x, y, room=0;
        if (p.isHuman){
          if (hr && hr.height){ x = hr.left+hr.width/2-fr.left; y = hr.top-fr.top-14; }
          else { x = fr.width*.80; y = fr.height*.80; }
        }
        else {
          // their cards as dealt: before the deal the row is empty, and the
          // cards hang below its box, so measure a stand-in card
          let cr = e.cardsContainer.getBoundingClientRect();
          if (!e.cardsContainer.querySelector('.card')){
            const c = document.createElement('div');
            c.className = 'card back small ct-measure'; c.style.visibility = 'hidden';
            e.cardsContainer.appendChild(c);
            const k = c.getBoundingClientRect();
            c.remove();
            cr = { left:cr.left, width:cr.width, bottom:Math.max(cr.bottom, k.bottom) };
          } else {
            const b = Math.max(...[...e.cardsContainer.querySelectorAll('.card')].map(c=>c.getBoundingClientRect().bottom));
            cr = { left:cr.left, width:cr.width, bottom:Math.max(cr.bottom, b) };
          }
          const ax = cr.left+cr.width/2-fr.left, ay = cr.bottom-fr.top;
          const px = pr.left+pr.width/2-fr.left, py = pr.top-fr.top-40;
          x = ax+(px-ax)*.22; y = Math.max(ay+56, ay+(py-ay)*.3);
          if (bb){
            const rl = bb.L-fr.left, rR = bb.R-fr.left, rt = bb.T-fr.top, inset = 13;
            if (ax<rl){ x = (inset+rl)/2; y = rt+22; }
            else if (ax>rR){ x = (fr.width-inset+rR)/2; y = rt+22; }
            else { x = ax+(fr.width/2-ax)*.15; y = ay+(rt-ay)*.64; }
            // 10px nearer their cards than the first cut (owner's pick),
            // but never on them: a coin is drawn ~D+4px tall above its
            // base, so the base sits at least D+18px under their cards,
            // leaving a clear gap (v0.40.8)
            y = Math.max(y-10, ay+CW.D()+18);
            room = y-ay-4;
          }
        }
        // Enemy Cards V2: the bet square under the seat (above your cards)
        const ec = typeof EnemyCards!=='undefined' && EnemyCards.spot(p, fr);
        if (ec){ x = ec.x; y = ec.y; room = ec.room; }
        const z = CW.zone('spot:'+p.id, fr.left+x, fr.top+y+2, 7, 5, 16);
        if (room>0) z.room = room;
        // LITTLE PILE (js/table-room.js): the pot's shape, small, on the
        // spot's footprint; its stacks may stand up to the machine's cards
        // (theirs) or the pot counter (yours)
        if (ec && ec.pile){
          z.pile = ec.pile; z.shape = ec.shape;
          const limit = p.isHuman && pr.width ? Math.max(ec.top, pr.bottom+3) : ec.top;
          z.room = Math.max(CW.D()+6, z.cy-limit);
        }
      });
      Object.keys(old).forEach(k=>{
        const z = CW.zones[k] || CW.zones.pot;
        old[k].list.forEach(b=>{ b.zone = z; z.list.push(b); });
        z.amount += old[k].amount||0;
      });
    });
    // coins already down (or still landing) move onto their spot's new
    // place: scheduleTidy waits for any in flight
    Object.values(CW.zones).forEach(z=>{
      if (z.list.length && !z.hoard){ z.neat = false; CW.scheduleTidy(z); }
    });
    wireTap();
    laid = key;
    return true;
  }

  // Tap a tower: it topples away from your finger; a loose coin: it
  // flicks; empty felt: the piles tidy (the owner's MESS·TAP).
  function wireTap(){
    if (tapWired) return; tapWired = true;
    $('felt').addEventListener('click', ev=>{
      if (!on() || !CW.zones.pot) return;
      let hit=null, best=1e9;
      Object.values(CW.zones).forEach(z=>z.list.forEach(b=>{
        if (b.state!=='rest') return;
        const dd = Math.hypot(b.x-ev.clientX, b.y-b.z-b.d*.5-ev.clientY);
        if (dd<b.d*.9 && dd<best){ best=dd; hit=b; }
      }));
      if (hit){
        const tower = CW.stackAt(hit), base = tower[tower.length-1];
        const dx = base.x-ev.clientX || CW.rr(-1,1), dy = (base.y-ev.clientY)*.4;
        if (!CW.topple(tower,dx,dy,1.3)){
          const L = Math.max(1,Math.hypot(dx,dy));
          Object.assign(hit,{ target:{}, opts:{}, bounces:0, maxB:1, e:.3, knocked:true, inFelt:true, edge:false,
            vx:dx/L*CW.rr(60,100), vy:dy/L*CW.rr(20,40), vz:CW.rr(160,220), fr:Math.PI*2/.25, phi:0, t:.1, T:0, state:'air' });
          if (hit.zone) hit.zone.neat=false;
          CW.active.add(hit); CW.kick(); CW.sfx('stack',.7);
        }
        return;
      }
      // a tap tidies the pot into a pyramid (for the rest of the hand)
      const pot = CW.zones.pot;
      if (CW.OPT.potTap==='on' && count(pot) && !CW.zoneBusy(pot) && !pot.tidying){ pot.shape = 'pyramid'; pot.neat = false; }
      Object.values(CW.zones).forEach(z=>{ if (!z.hoard && !CW.zoneBusy(z)) CW.tidyZone(z); });
    });
  }

  /* ---------------- helpers ---------------- */
  const count = z=>z ? z.list.length : 0;
  function potRoom(){
    let n = count(CW.zones.pot);
    Object.keys(CW.zones).forEach(k=>{ if (k.startsWith('spot:')) n += count(CW.zones[k]); });
    return CW.LIM().pot-n;
  }
  // a bet's handful, trimmed to what its spot and the pot still have room
  // for (always at least one coin, so every bet is seen)
  const budget = (n,z)=>Math.max(Math.min(1,n), Math.min(n, potRoom(), CW.LIM().spot-count(z)));
  function targetIn(z){
    let x = z.cx+CW.rr(-5,5), y = z.cy+CW.rr(-3,3);
    const k = z.id==='pot' && CW.trayBox(CW.D());
    if (k){ x = Math.max(k.L+3,Math.min(k.R-3,x)); y = Math.max(k.T+2,Math.min(k.B-1,y)); }
    z.neat = false;
    return { x, y, z:0, zone:z, d:CW.D() };
  }
  const settled = z=>!z || !CW.zoneBusy(z);
  async function settle(zs, ms){
    const t0 = performance.now();
    while (performance.now()-t0 < ms && !zs.every(settled)) await new Promise(r=>setTimeout(r,40));
  }
  const within = (p,ms)=>Promise.race([p, new Promise(r=>setTimeout(r,ms))]);
  function edgeSource(p){
    // Enemy Cards V2: out of (and home to) the seat's coin cup
    const ec = typeof EnemyCards!=='undefined' && EnemyCards.coinSource(p);
    if (ec) return ec;
    const e = seatEls[p.id], r = (e.cardsContainer.getBoundingClientRect().width ? e.cardsContainer : e.root).getBoundingClientRect();
    return { x:r.left+r.width/2+CW.rr(-8,8), y:r.bottom+4, z:6 };
  }

  /* ---------------- your bank ---------------- */
  let bank = null, bankCap = Infinity, tidying = false;
  const human = ()=>game && game.players.find(p=>p.isHuman);
  /* THE BANK VIEW (Lab 2): your stack as the felt's pieces, at the small
     blind, in the chosen style. Bets pay out of it (making change first
     when they must), wins drop in at the top, and after either it settles
     to what the stack is worth (changing up, or topping up). */
  let view = null;
  const viewOn = ()=>CW.OPT.bank && CW.OPT.bank!=='today' && CW.OPT.bank!=='hoard' && !!window.CoinBank;

  /* ---------------- THE HOARD ---------------- */
  // the owner's picks (Chip Lab): BIG, gleam WHEN RICH, pyramid, THROUGH A SLOT, ONE BY ONE
  Object.assign(CW.OPT, { hoardSize:'.65', hoardGleam:'rich', hoardTidy:'pyramid', hoardRest:'pyramid', bankIn:'slot', winStyle:'stream', mergeShow:'none' });
  const chipsOn = ()=>!!CW.TIERS;
  // the bank's coin slot: the middle of its top edge, a little inside
  function slotAt(){
    const hl = $('hud-left'); if (!hl) return null;
    const r = hl.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+9 };
  }
  const hoardOn = ()=>CW.OPT.bank==='hoard';
  const HOARD_MAX = 52;
  const HOARD_CAP = { gold:20, 'gold-big':18, 'gold-bar':14 };
  const nOf = (z,col)=>z.list.filter(b=>b.colour===col).length;
  let hoardBox = null, hoardHidden = false, hoardTrack = 0, gleamTimer = 0;
  // the box: its floor is a shallow strip along the bottom (where pieces
  // stand), and the heap may climb to just under the top (room)
  const FLOOR = 40;
  function boxOf(hl){
    const r = hl.getBoundingClientRect();
    return { L:r.left+6, R:r.right-6, T:r.top+10, B:r.bottom-9, w:r.width, h:r.height };
  }
  const floorOf = k=>({ L:k.L, R:k.R, T:k.B-FLOOR, B:k.B });
  function ensureHoard(){
    const hl = $('hud-left'); if (!hl || !CW.zones) return null;
    let z = CW.zones.bank;
    if (!z){
      hl.querySelectorAll('.cw-bank').forEach(el=>el.remove());
      if (view){ view.clear(); view = null; }
      if (bank){ bank.el.remove(); bank = null; }
      hl.dataset.coins = 'on'; hl.dataset.hoard = 'on';
      if (!hl.querySelector('.hoard-well')){ const w = document.createElement('div'); w.className = 'hoard-well'; hl.appendChild(w); }
      CW.ensureLayers();
      const k = boxOf(hl); hoardBox = k;
      z = CW.zone('bank', (k.L+k.R)/2, k.B, 12, 30, 30);
      z.box = floorOf(k); z.room = k.B-k.T-4; z.hoard = true;
      // a hoard climbs: taller stacks than the pot's, the bars highest (at the back)
      z.bandH = { gold:4, 'gold-big':5, 'gold-bar':8 }; z.shape = CW.OPT.hoardRest;
      // chips: the bank is a rack, rows of stacks stepping up to the back
      if (chipsOn()) z.rack = true;
      if (!hl._hoardTap){ hl._hoardTap = true; hl.addEventListener('click', ()=>{ if (hoardOn()) tidyHoard(); }); }
      if (!hoardTrack) hoardTrack = requestAnimationFrame(trackHoard);
      if (!gleamTimer) gleamTimer = setInterval(gleam, 900);
    }
    return z;
  }
  // the dashboard slides with the table screen and flips for the award:
  // the hoard's pieces go with it, and hide while it's turned over
  function trackHoard(){ hoardTrack = requestAnimationFrame(trackHoard); trackOnce(); }
  function trackOnce(){
    const z = CW.zones && CW.zones.bank, hl = $('hud-left');
    if (!z || !hl || !hoardBox) return;
    const k = boxOf(hl), turned = hoardTurned(hl, k);
    // something over the box (the raise panel, a sheet): its resting coins
    // hide under it (a coin in flight stays in the air, over everything)
    const covered = !turned && [.3,.6,.88].some(f=>{ const e = document.elementFromPoint((k.L+k.R)/2, k.T+(k.B-k.T)*f); return e && !hl.contains(e); });
    z.list.forEach(b=>{ if (b.state!=='rest' || b.fresh) return; const v = (covered||turned) ? 'hidden' : ''; if (b.el.style.visibility!==v){ b.el.style.visibility = v; if (b.sh) b.sh.style.visibility = v; } });
    if (turned || turned !== hoardHidden){ hoardHidden = turned; z.list.forEach(b=>{ if (b.fresh && !turned) return; b.el.style.visibility = turned ? 'hidden' : ''; if (b.sh) b.sh.style.visibility = turned ? 'hidden' : ''; }); }
    if (turned) return;
    const dx = k.L-hoardBox.L, dy = k.T-hoardBox.T;
    if (Math.abs(dx)<.5 && Math.abs(dy)<.5) return;
    hoardBox = k;
    z.box = floorOf(k); z.cx += dx; z.cy += dy;
    z.list.forEach(b=>{ b.x += dx; b.y += dy; if (b.tx!=null){ b.tx += dx; b.ty += dy; } if (b.x0!=null){ b.x0 += dx; b.y0 += dy; } CW.dirty.add(b); });
    CW.kick();
  }
  // the bank swapped out (the award's result console) or turned over
  const hoardTurned = (hl, k)=>!hl.offsetParent || k.w<10 || (hoardBox && (Math.abs(k.w-hoardBox.w)>3 || Math.abs(k.h-hoardBox.h)>3));
  async function hoardShown(ms){
    const end = performance.now()+ms, hl = $('hud-left');
    while (performance.now()<end){ if (hl && !hoardTurned(hl, boxOf(hl))) return true; await new Promise(r=>setTimeout(r, 60)); }
    return false;
  }
  // how many pieces a stack earns: a few on the floor for a short stack,
  // a heap for a deep one (then it gets richer, not bigger)
  function hoardCount(chips){
    if (chipsOn() && CW.zones.bank){
      const bb = chips/Math.max(1, (game && game.bigBlind) || 20);
      // a gentle curve: a few stacks at 25 BB, about half full at 1,000 BB,
      // full only at massive numbers (HOW BIG scales it)
      const k = { '.65':38, '.45':30, '.3':22 }[String(CW.OPT.hoardSize)] || 24;
      return Math.max(chips>0 ? 3 : 0, Math.min(CW.rackCapacity(CW.zones.bank), Math.round(4 + k*Math.log10(1 + bb/8))));
    }
    const bb = chips/Math.max(1, (game && game.bigBlind) || 20);
    return Math.max(chips>0 ? 3 : 0, Math.min(HOARD_MAX, Math.round(3 + bb*(+CW.OPT.hoardSize||.45))));
  }
  const valueOf = list=>list.reduce((a,b)=>a+CW.valueOf(b.colour),0);
  // a piece the hoard gives up: the highest of its kind that nothing sits on
  function topOf(z, col){
    // (resting pieces first; one still falling in will do)
    let pool = z.list.filter(b=>b.state==='rest' && (!col || b.colour===col));
    if (!pool.length) pool = z.list.filter(b=>!col || b.colour===col);
    const free = pool.filter(b=>!z.list.some(q=>q!==b && q.state==='rest' && q.z>b.z+.5 && CW.clash(b.x,b.y,b.colour,b.d,q)));
    return (free.length ? free : pool).sort((a,c)=>c.z-a.z)[0] || null;
  }
  function dropIn(z, col, delay, instant){
    const k = CW.zoneBox(z, CW.pieceD(col), col);
    const x = CW.rr(k.L, k.R), y = k.B - CW.rr(0, Math.min(18, k.B-k.T));
    const b = CW.body(CW.makeChip(col), x, y, instant ? 0 : 70+CW.rr(0,30), CW.D());
    b.zone = z; z.list.push(b); b.target = {}; b.opts = {};
    if (instant || motionOff()){ if (!CW.seat(b, true)){ b.z = CW.supportUnder(b).h; CW.finishRest(b); } return Promise.resolve(); }
    b.vx = b.vy = b.vz = 0; b.fresh = true;
    return CW.launch(b, { x, y, z:0, zone:z, d:CW.D() }, { mode:'fall', wait:delay||0 });
  }
  function lift(b, instant){
    if (!b) return;
    if (b.zone) CW.removeFromZone(b);
    if (instant || motionOff() || !b.el.animate){ CW.removeBody(b); b.el.remove(); return; }
    CW.removeBody(b);
    b.el.animate([{ opacity:1 }, { opacity:0, transform:b.el.style.transform+' translateY(-8px)' }], { duration:200, fill:'forwards' }).onfinish = ()=>b.el.remove();
  }
  /* Settle the hoard to the stack: short, the missing value drops in;
     over, pieces lift off the top (a big one breaking into small change
     only when it must); then, over the piece count, five change up
     quietly. `instant`: no motion (a cold load). */
  // one settle at a time (a payout's and the next hand's can overlap)
  let hoardChain = Promise.resolve();
  function syncHoard(instant){
    hoardChain = hoardChain.then(()=>syncHoardNow(instant)).catch(e=>console.error(e));
    return hoardChain;
  }
  /* THE RACK, settled to the stack: pieces the stack no longer has lift
     off the tops (a richer one breaking into five when it must), past the
     count five change up, and what's missing drops in; every coin goes to
     its exact place (planZone), the others slide over to make room. */
  async function syncRack(instant){
    const h = human(), z = ensureHoard(); if (!h || !z) return;
    const T = CW.TIERS(), u = Math.max(1, (game && game.smallBlind) || 1), want = Math.round(h.chips/u);
    // the mix of colours the stack earns (as many coins as its count allows,
    // never more than the rack holds); each colour lifted or added to match
    // past all-gold-and-full the bank is simply full (the readout carries on)
    const most = CW.rackCapacity(z) * CW.valueOf(T[T.length-1]);
    const target = CW.composeTiers(Math.min(want, most), hoardCount(h.chips)).counts, adds = [];
    T.forEach((col,i)=>{
      let have = z.list.filter(b=>b.colour===col).length;
      for (; have>target[i]; have--) lift(topOf(z, col), instant);
      for (; have<target[i]; have++) adds.push(col);
    });
    const plan = CW.planZone(z, adds), moves = [CW.applyLayout(z, plan.map)];
    const order = adds.map((col,i)=>({ col, s:plan.extras[i] })).sort((a,c)=>a.s.z-c.s.z);
    order.forEach((o,i)=>{
      const b = CW.body(CW.makeChip(o.col), o.s.x, o.s.y, 0, CW.D());
      b.zone = z; z.list.push(b); b.target = {}; b.opts = {};
      if (instant || motionOff()){ b.x = o.s.x; b.y = o.s.y; b.z = o.s.z; CW.finishRest(b); return; }
      // it drops in from above onto its own stack
      b.z = Math.min(o.s.z + 46, (z.room||80) - 16); b.vx = b.vy = b.vz = 0; b.fresh = true;
      moves.push(CW.launch(b, { x:o.s.x, y:o.s.y, z:o.s.z, zone:z, slot:true, d:CW.D() }, { mode:'fall', wait:i*40 }));
    });
    await within(Promise.all(moves), 5000/CW.OPT.speed);
  }
  async function syncHoardNow(instant){
    if (chipsOn()) return syncRack(instant);
    const h = human(), z = ensureHoard(); if (!h || !z) return;
    const drops = [];
    const u = Math.max(1, (game && game.smallBlind) || 1), want = Math.round(h.chips/u);
    // past what the box holds: the hoard is simply full (every kind at
    // its cap); the STACK readout keeps the figure
    const capUnits = chipsOn() ? Infinity : HOARD_CAP.gold + HOARD_CAP['gold-big']*5 + HOARD_CAP['gold-bar']*25;
    if (want >= capUnits){
      let n0 = 0;
      Object.keys(HOARD_CAP).forEach(col=>{
        for (let i=nOf(z,col); i>HOARD_CAP[col]; i--) lift(topOf(z,col), instant);
        for (let i=nOf(z,col); i<HOARD_CAP[col]; i++) drops.push(dropIn(z, col, (n0++)*45, instant));
      });
      if (drops.length) await within(Promise.all(drops), 4000/CW.OPT.speed);
      await settleShape(z);
      return;
    }
    let diff = want - valueOf(z.list), n = 0;
    if (diff > 0){
      let kinds;
      if (chipsOn()){
        const t = CW.TIERS(), c = CW.composeTiers(diff, Math.max(1, hoardCount(h.chips)-z.list.length)).counts; kinds = [];
        for (let i=t.length-1;i>=0;i--) for (let k=0;k<c[i];k++) kinds.push(t[i]);
      } else {
        const c = CW.compose(diff, Math.max(1, hoardCount(h.chips)-z.list.length));
        kinds = [].concat(Array(c.bar).fill('gold-bar'), Array(c.big).fill('gold-big'), Array(c.gold).fill('gold'));
      }
      kinds.forEach(col=>drops.push(dropIn(z, col, (n++)*45, instant)));
    }
    for (let guard=0; diff<0 && guard<200; guard++){
      const need = -diff;
      const ladder = chipsOn() ? CW.TIERS().slice().reverse() : ['gold-bar','gold-big','gold'];
      const col = ladder.find(k=>CW.valueOf(k)<=need && z.list.some(b=>b.colour===k));
      if (col){ const b = topOf(z, col); lift(b, instant); diff += CW.valueOf(col); continue; }
      // only bigger pieces left: break the smallest into the next size down
      const up = chipsOn() ? CW.TIERS().slice(1) : ['gold-big','gold-bar'];
      const big = up.find(k=>z.list.some(b=>b.colour===k)); if (!big) break;
      const b = topOf(z, big); lift(b, true);
      const down = chipsOn() ? 't'+(+big.slice(1)-1) : (big==='gold-bar' ? 'gold-big' : 'gold');
      for (let i=0;i<5;i++) dropIn(z, down, 0, true);
      diff += 0;                       // same value, now in smaller pieces
    }
    // then the pile settles into its shape: the loose landings are fun,
    // the shape is what's measured to fit the box (no overlaps, nothing
    // over the top)
    if (drops.length) await within(Promise.all(drops), 4000/CW.OPT.speed);
    CW.mergeQuiet(z, hoardCount(h.chips));
    if (!chipsOn()) capKinds(z);
    await settleShape(z);
  }
  // what the box holds of each kind in its heap shape: past this the
  // hoard is full (small coins change up, then big coins; bars stop)
  function capKinds(z){
    while (nOf(z,'gold')>HOARD_CAP.gold) CW.mergeQuiet(z, 0, [['gold','gold-big']]);
    while (nOf(z,'gold-big')>HOARD_CAP['gold-big']) CW.mergeQuiet(z, 0, [['gold-big','gold-bar']]);
    for (let i=nOf(z,'gold-bar'); i>HOARD_CAP['gold-bar']; i--) lift(topOf(z,'gold-bar'), true);
  }
  async function settleShape(z){
    for (let i=0; i<30 && CW.zoneBusy(z); i++) await new Promise(r=>setTimeout(r, 60));
    z.shape = CW.OPT.hoardRest; z.neat = false;
    await CW.tidyZone(z);
  }
  function fillHoard(){ if (ensureHoard()) syncHoard(true); }
  function tidyHoard(){
    const z = CW.zones.bank; if (!z || CW.zoneBusy(z) || z.tidying) return;
    z.shape = CW.OPT.hoardTidy; z.neat = false; return CW.tidyZone(z);
  }
  // the richer you are, the more often the gold catches the light
  function gleam(){
    const z = CW.zones && CW.zones.bank, h = human();
    if (!hoardOn() || !z || !h || hoardHidden || motionOff() || !z.list.length || document.hidden) return;
    const bb = h.chips/Math.max(1, game.bigBlind||20), mode = CW.OPT.hoardGleam;
    if (mode==='off') return;
    const p = mode==='always' ? .35 : (bb<40 ? 0 : bb<80 ? .16 : bb<150 ? .3 : .45);
    if (CW.rnd()<p){ const b = topOf(z); if (b) CW.glintAt(b.x+b.d*CW.rr(-.2,.25), b.y-b.z-b.d*CW.rr(.7,1)); }
    if (mode!=='always' && bb>=100 && CW.rnd()<.08) CW.glintPile(z);
  }
  function ensureView(){
    const hl = $('hud-left'); if (!hl) return null;
    if (view && view.el.isConnected && view.style===CW.OPT.bank) return view;
    hl.querySelectorAll('.cw-bank').forEach(el=>el.remove());
    bank = null;
    const el = document.createElement('div'); el.className = 'cw-bank';
    hl.appendChild(el); hl.dataset.coins = 'on';
    view = new CoinBank.View(el, CW.OPT.bank);
    view.setLabels(CW.OPT.bankLabels, unit());
    return view;
  }
  const wantFor = chips=>ensureView().want(chips/unit());
  let settling = Promise.resolve();
  function settleView(opts){
    const h = human(); if (!h) return settling;
    const v = ensureView(); if (!v) return settling;
    settling = settling.then(()=>v.settle(wantFor(h.chips), Object.assign({ show:+CW.OPT.bankChange }, opts||{}))).catch(e=>console.error(e));
    return settling;
  }
  function ensureBank(){
    const hl = $('hud-left'); if (!hl) return null;
    if (bank && bank.el.isConnected) return bank;
    hl.querySelectorAll('.cw-bank').forEach(el=>el.remove());
    const el = document.createElement('div'); el.className = 'cw-bank';
    hl.appendChild(el); hl.dataset.coins = 'on';
    bank = new CW.BankPile(el);
    hl.addEventListener('click', tidyBank);
    return bank;
  }
  // the rack shows as many coins as your stack earns: short coins are
  // added racked, extras leave from the back
  function syncBank(snap){
    if (hoardOn()){ syncHoard(!!snap); return; }
    if (viewOn()){ settleView({ instant:!!snap }); return; }
    const h = human(), b = ensureBank(); if (!h || !b) return;
    const want = CW.bankCoins(h.chips);
    if (b.chips.length===want) return;
    while (b.chips.length<want){ const c = CW.makeChip('gold'); c.loose = false; b.chips.push(c); }
    while (b.chips.length>want){ const c = b.chips.shift(); if (c.clump){ c.clump.n--; c.clump = null; } if (c.el) c.el.remove(); }
    b.apply(snap ? { snap:true } : { slideMs:200 });
  }
  // render()'s idle check: an empty rack for a stack with money in it
  // (cold load, rebuy, resume) is filled at once
  function renderBank(){
    if (!on()) return;
    if (hoardOn()){
      const h = human(), z = ensureHoard(), paying = game && (game.phase==='showdown' || game.phase==='foldwin');
      if (h && z && !paying && bankPending===0 && !z.list.length && h.chips>0) fillHoard();
      return;
    }
    if (viewOn()){
      // (not while a hand is paid out: the winnings are on their way in)
      const h = human(), v = ensureView(), paying = game && (game.phase==='showdown' || game.phase==='foldwin');
      if (h && v && !paying && bankPending===0 && v.count()===0 && h.chips>0) settleView({ instant:true });
      return;
    }
    const h = human(), b = ensureBank(); if (!h || !b) return;
    if (bankPending===0 && b.chips.length===0 && h.chips>0) syncBank(true);
  }
  function rebuildBank(){ if (on()) syncBank(false); }
  function resetBank(){
    if (view) view.clear();
    // a new table: the hoard starts again from what the stack earns
    if (CW.zones && CW.zones.bank){ CW.zones.bank.list.forEach(b=>{ CW.removeBody(b); b.el.remove(); }); CW.zones.bank.list = []; }
    if (!bank) return;
    bank.chips.forEach(c=>c.el && c.el.remove()); bank.chips.length = 0; bank.clumps = [];
  }
  // TABLE INTRO: the rack fills through the hatch, a coin at a time
  function loadBank(){
    if (hoardOn()){ const z = ensureHoard(); if (!z) return 0; syncHoard(false); return 900; }
    if (viewOn()){ const v = ensureView(); if (!v) return 0; v.clear(); settleView({ stagger:26 }); return 900; }
    const h = human(), b = ensureBank(); if (!h || !b) return 0;
    resetBank(); syncBank(true);
    if (motionOff()) return 0;
    const els = b.chips.map(c=>c.el).reverse();
    els.forEach((el,i)=>{
      el.animate([{ transform:'translateY(-46px)', opacity:0 },{ transform:'translateY(-46px)', opacity:1, offset:.01 },{ transform:'translateY(1px) scale(1.1,.85)', offset:.8 },{ transform:'none' }],
        { duration:230, delay:i*26, easing:'cubic-bezier(.55,0,1,.6)', fill:'backwards' });
      if (i%3===0) setTimeout(()=>CW.sfx('stack', .6, 1+Math.min(.5,i/60)), i*26+190);
    });
    return els.length*26+260;
  }
  // tap the bank: loose coins file into the rack
  async function tidyBank(){
    if (hoardOn()) return;
    if (!on() || tidying || viewOn() || !bank || !bank.chips.some(c=>c.loose)) return;
    tidying = true;
    const hl = $('hud-left'); hl.classList.add('is-tidying');
    bank.chips.forEach(c=>{ c.loose = false; c.clump = null; });
    bank.clumps = [];
    bank.apply({ slideMs:210, stagger:6, easing:'cubic-bezier(.5,0,.2,1)' });
    await new Promise(r=>setTimeout(r, 380));
    hl.classList.remove('is-tidying'); tidying = false;
  }
  // coins leaving through the floor (an all-in with no room on the felt)
  function sinkBank(k){
    for (let i=0;i<k;i++){
      const t = bank.take(); if (!t) break;
      const c = t.c; if (c.clump){ c.clump.n--; c.clump = null; }
      if (motionOff() || !c.el.animate){ c.el.remove(); continue; }
      c.el.animate([{ transform:'none', opacity:1 },{ transform:'translateY(26px)', opacity:0 }],{ duration:260, delay:i*18, easing:'cubic-bezier(.5,0,1,.6)', fill:'forwards' }).onfinish = ()=>c.el.remove();
    }
  }
  // a payout coin reaching the hatch drops into the rack (loose, with a
  // squash), or melts in once the rack holds your stack's worth
  function dropIntoBank(b){
    const res = b.resolve; b.resolve = null;
    CW.removeBody(b);
    const bk = ensureBank(), hl = $('hud-left');
    if (!bk || bk.chips.length>=bankCap || b.chip.colour!=='gold'){ b.el.remove(); CW.sfx('stack', .6, CW.rise(b)); if (res) setTimeout(res,0); return; }
    const c = b.chip, hr = hl.getBoundingClientRect();
    c.loose = true;
    bk.chips.push(c);
    bk.apply({ snap:true });
    const r = c.el.getBoundingClientRect();
    const dx = b.x-(r.left+r.width/2), dy = (hr.top+4)-r.top;
    const pitch = CW.rise(b);
    if (!motionOff()){
      c.el.animate([
        { transform:'translate('+dx+'px,'+dy+'px)', easing:'cubic-bezier(.55,0,1,.6)' },
        { transform:'translate(0,1px) scale(1.12,.82)', offset:.74, easing:'steps(1,end)' },
        { transform:'translate(0,-3px)', offset:.86, easing:'cubic-bezier(.3,0,.7,1)' },
        { transform:'none' }
      ],{ duration:290/CW.OPT.speed });
      setTimeout(()=>CW.sfx('stack', .7, pitch), 210/CW.OPT.speed);
    }
    if (res) setTimeout(res, motionOff()?0:290/CW.OPT.speed);
  }

  /* ---------------- bets ---------------- */
  // `amount` just left `p`'s stack for their bet this street
  function bet(p, amount, allin){
    if (!on() || !(amount>0) || !layout()) return Promise.resolve();
    sync();
    const z = CW.zones['spot:'+p.id]; if (!z) return Promise.resolve();
    z.amount += amount;
    if (denomOn()) return betPieces(p, z, amount, allin);
    const items = [];
    if (p.isHuman){
      // the coins that leave are the ones the stack no longer earns, so the
      // rack always matches the stack (an all-in empties it; every bet
      // throws at least one coin, and one stays while there's money left)
      const bk = ensureBank(); if (!bk) return Promise.resolve();
      const have = bk.chips.length, keep = p.chips>0 ? Math.max(1, CW.bankCoins(p.chips)) : 0;
      const want = allin ? have : Math.max(Math.min(1,have), Math.min(have-(p.chips>0?1:0), have-keep));
      const n = Math.min(have, budget(want, z));
      if (allin && n<have) sinkBank(have-n);
      for (let i=0;i<n;i++){
        const t = bk.take(); if (!t) break;
        const r = t.rect, b = CW.body(t.c, r.left+r.width/2, r.bottom, 0, r.width);
        items.push({ b, to:targetIn(z) });
      }
      bk.apply({ slideMs:160 });
    } else {
      if (typeof EnemyCards!=='undefined') EnemyCards.slot(p, 700);
      const n = budget(CW.betCoins(amount, allin), z);
      for (let i=0;i<n;i++){
        const s = edgeSource(p), b = CW.body(CW.makeChip('gold'), s.x, s.y, s.z, CW.D()-2); b.fresh = true;
        items.push({ b, to:targetIn(z) });
      }
    }
    return within(CW.throwAll(items, kindOf(amount, allin, !p.isHuman), { big:allin }), 6000);
  }

  // THE DENOMINATIONS: the bet in small coins, as many pieces as the limits
  // allow, the same for everyone. Heavy pieces leave first, so the small
  // coins scatter round them.
  function piecesFor(amount, allin, z){
    const O = CW.OPT, units = Math.max(1, Math.round(amount/unit()));
    const cap = Math.min(allin ? O.allinCap : O.betCap, Math.max(1, O.spotCap-count(z)));
    const out = [];
    if (chipsOn()){
      // richest first, so the lower coins scatter round them
      const t = CW.TIERS(), c = CW.composeTiers(units, cap).counts;
      for (let i=t.length-1;i>=0;i--) for (let k=0;k<c[i];k++) out.push(t[i]);
      return out;
    }
    const c = CW.compose(units, cap);
    for (let i=0;i<c.bar;i++) out.push('gold-bar');
    for (let i=0;i<c.big;i++) out.push('gold-big');
    for (let i=0;i<c.gold;i++) out.push('gold');
    return out;
  }
  // your bet out of the bank view: change made first if it must be, each
  // piece thrown from where it sat, then the bank settles to the new stack
  async function betFromView(p, z, amount, allin, kinds){
    const v = ensureView(); if (!v) return;
    await settling;
    const out = await v.payOut(kinds, +CW.OPT.bankChange);
    const items = out.map(o=>{
      const r = o.rect, b = CW.body(CW.makeChip(o.k), r.left+r.width/2, r.bottom, 0, r.width*CW.D()/CW.pieceD(o.k));
      return { b, to:targetIn(z) };
    });
    const thrown = within(CW.throwAll(items, kindOf(amount, allin, false), { big:allin }), 6000);
    settleView();
    return thrown;
  }
  function betPieces(p, z, amount, allin){
    const kinds = piecesFor(amount, allin, z), items = [];
    if (p.isHuman && viewOn()) return betFromView(p, z, amount, allin, kinds);
    if (p.isHuman && hoardOn()){
      // off the top of the hoard: the piece of each kind that's highest;
      // one it hasn't got comes off the peak (settled after the hand)
      const hz = ensureHoard(); if (!hz) return Promise.resolve();
      kinds.forEach(col=>{
        let b = topOf(hz, col);
        if (b) CW.removeFromZone(b);
        else { const t = topOf(hz), k = hz.box; b = CW.body(CW.makeChip(col), t ? t.x : (k.L+k.R)/2, t ? t.y : k.B, t ? t.z+4 : 4, CW.D()); b.fresh = true; }
        const sl = CW.OPT.bankIn==='slot' && slotAt();
        // THE SLOT: up out of the bank through its slot, then on to the felt
        items.push({ b, to: sl ? { via:true, x:sl.x+CW.rr(-3,3), y:sl.y, z:0, d:CW.D(), flips2:2, then:targetIn(z) } : targetIn(z) });
      });
      // all in: nothing stays behind
      if (allin) hz.list.slice().forEach(b=>lift(b));
      // the rack closes up behind the coins that left
      if (chipsOn()) setTimeout(()=>CW.applyLayout(hz, CW.planZone(hz, []).map), 260/CW.OPT.speed);
      return within(CW.throwAll(items, kindOf(amount, allin, false), { big:allin }), 6000);
    }
    if (p.isHuman){
      // your rack gives up the coins your stack no longer earns: its small
      // coins fly as your small coins, the bigger pieces lift off its top
      const bk = ensureBank(); if (!bk) return Promise.resolve();
      const keep = p.chips>0 ? Math.max(1, CW.bankCoins(p.chips)) : 0;
      let spare = Math.max(0, bk.chips.length-keep);
      const hr = $('hud-left').getBoundingClientRect();
      kinds.forEach(col=>{
        let b;
        if (col==='gold' && spare>0){
          const t = bk.take();
          if (t){ spare--; const r = t.rect; b = CW.body(t.c, r.left+r.width/2, r.bottom, 0, r.width); }
        }
        if (!b){ b = CW.body(CW.makeChip(col), hr.left+hr.width*CW.rr(.3,.7), hr.top+6, 4, CW.D()); b.fresh = true; }
        items.push({ b, to:targetIn(z) });
      });
      if (spare>0) sinkBank(spare);
      bk.apply({ slideMs:160 });
    } else {
      if (typeof EnemyCards!=='undefined') EnemyCards.slot(p, 700);
      kinds.forEach(col=>{
        const s = edgeSource(p), b = CW.body(CW.makeChip(col), s.x, s.y, s.z, CW.D()-2); b.fresh = true;
        items.push({ b, to:targetIn(z) });
      });
    }
    return within(CW.throwAll(items, kindOf(amount, allin, !p.isHuman), { big:allin }), 6000);
  }

  /* ---------------- the sweep ---------------- */
  // every bet spot jumps into the tray, top coin first, spot by spot; the
  // plate counts up as they land. Awaited before the next street/award.
  function sweep(){
    if (!on() || !CW.zones.pot) return Promise.resolve();
    const ids = Object.keys(CW.zones).filter(k=>k.startsWith('spot:') && (count(CW.zones[k]) || CW.zones[k].amount>0));
    if (!ids.length) return Promise.resolve();
    if (sweeping) return sweeping;
    sync();
    sweeping = (async()=>{
      await settle(ids.map(k=>CW.zones[k]), 1400);
      layout();
      const pot = CW.zones.pot, plateEl = document.querySelector('#pot-area .pot-chip');
      let delay = 0; const throws = [];
      if (chipsOn()){
        // CHIPS: every coin's place in the tray planned first (the pile
        // shifts over to make room), then thrown in stack order, lowest
        // places first, so each lands on something and stays
        const all = [];
        ids.forEach(k=>{
          const z = CW.zones[k], list = z.list.slice(); z.list.length = 0;
          const amount = z.amount; z.amount = 0;
          if (!list.length){ shown += amount; return; }
          const each = amount/list.length;
          list.forEach(b=>{ b.zone = null; b.inFelt = true; all.push({ b, each }); });
        });
        // (the pile stays as it stands: they land on top of it)
        const at = CW.pileAdd(pot, all.map(o=>o.b.colour));
        all.forEach((o,i)=>{ o.s = at[i]; });
        all.sort((a,c)=>a.s.z-c.s.z);
        const items = all.map(o=>({ b:o.b, to:{ x:o.s.x, y:o.s.y, z:o.s.z, zone:pot, slot:true, d:CW.D() }, onLand:()=>{ shown += o.each; paint(); punch(plateEl); } }));
        if (items.length) throws.push(CW.throwAll(items, 'hop', { delay:0 }));
      } else ids.forEach(k=>{
        const z = CW.zones[k], list = z.list.slice().sort((a,c)=>c.z-a.z); z.list.length = 0;
        const amount = z.amount; z.amount = 0;
        const each = amount/Math.max(1,list.length);
        if (!list.length){ shown += amount; return; }
        const items = list.map(b=>{ b.zone = null; b.inFelt = true;
          return { b, to:targetIn(pot), onLand:()=>{ shown += each; paint(); punch(plateEl); } }; });
        throws.push(CW.throwAll(items, 'hop', { delay }));
        delay += 160+list.length*24;
      });
      await within(Promise.all(throws), 9000/CW.OPT.speed);
      shown = Math.round(shown);
      CW.sfx('collect', .6);
      paint();
      // the change-up: over the pot's limit, the pile gets richer, not bigger
      if (chipsOn()){
        // chips: the change-up is quiet, then the pile slides into shape
        if (pot.list.length > CW.OPT.potCap) await within(CW.mergePile(pot, CW.OPT.potCap), 12000/CW.OPT.speed);
        pot.neat = false;                 // a tap tidies it into the pyramid
      } else if (denomOn()) await within(CW.merge(pot, CW.OPT.potCap) || Promise.resolve(), 8000/CW.OPT.speed);
    })().finally(()=>{ sweeping = null; });
    return sweeping;
  }
  function punch(el){
    if (!el || motionOff()) return;
    el.classList.remove('is-tick'); void el.offsetWidth; el.classList.add('is-tick');
  }
  function paint(){
    const area = $('pot-area');
    if (area && (shown>0 || count(CW.zones.pot)>0)) area.classList.remove('hidden');
    if (typeof paintPotValue==='function') paintPotValue();
  }

  /* ---------------- payouts ---------------- */
  // `n` of the tray's coins go to `winner`. Yours pour through the hatch
  // (a big win: a heave, some hitting the dashboard rim first), an
  // opponent's slide to their spot and hop home to the seat.
  async function payout(winner, n, opts){
    opts = opts||{};
    if (!on() || !CW.zones.pot) return;
    sync(); layout();
    const pot = CW.zones.pot;
    const list = pot.list.slice().sort((a,c)=>c.z-a.z || (winner.isHuman ? c.y-a.y : a.y-c.y)).slice(0, Math.max(0,n));
    if (!list.length) return;
    list.forEach(b=>{ if (b.zone) CW.removeFromZone(b); });
    // until each coin has arrived it still counts as in the pot, so the
    // plate counts down as they go
    let left = list.length; leaving += left;
    const gone = ()=>{ if (left>0){ left--; leaving--; paintPotValue(); } };
    try {
      if (winner.isHuman) await payYou(winner, list, opts, gone);
      else await payOpp(winner, list, gone);
    } finally {
      leaving -= left; left = 0;
      if (!count(pot) && !leaving) shown = 0;
      paintPotValue();
    }
  }
  async function payYou(human, list, opts, gone){
    const hl = $('hud-left');
    if (!hl){ list.forEach(b=>{ CW.removeBody(b); b.el.remove(); }); return; }
    bankPending++;                    // render() must not rebuild the pile under us
    openHatch(); CW.sfx('hatch');
    if (opts.fanfare!==false) CW.sfx('win', 1);
    await new Promise(r=>setTimeout(r, motionOff()?0:150/CW.OPT.speed));
    const hr = hl.getBoundingClientRect();
    const big = !!opts.jackpot;
    bankCap = CW.bankCoins(human.chips);
    if (hoardOn()){
      // the win waits in the pot until your bank is back on screen (the
      // award swaps the dashboard out for a moment)
      await hoardShown(6000);
      trackOnce();
      const hz = ensureHoard();
      let onto = col=>{ const k = CW.zoneBox(hz, CW.pieceD(col), col); return { x:CW.rr(k.L, k.R), y:k.B-CW.rr(0, Math.min(16, k.B-k.T)), z:0, zone:hz, d:CW.D() }; };
      if (chipsOn()){
        // more than the rack holds: five of the commoner colour change up
        // in the tray first, quietly (the value's the same)
        const cap = CW.rackCapacity(hz);
        for (let guard=0; list.length + hz.list.length > cap && guard<200; guard++){
          const T = CW.TIERS(), cnt = T.map(t=>list.filter(b=>b.colour===t).length);
          let i = -1; for (let j=0;j<T.length-1;j++) if (cnt[j]>=5 && (i<0 || cnt[j]>cnt[i])) i = j;
          if (i<0){ if (hz.list.length) CW.mergeQuiet(hz, Math.max(0, cap - list.length)); break; }
          const five = list.filter(b=>b.colour===T[i]).slice(0,5), at = five[0];
          const nb = CW.body(CW.makeChip(T[i+1]), at.x, at.y, at.z, CW.D()); nb.state = 'rest';
          five.forEach(b=>{ list.splice(list.indexOf(b),1); CW.removeBody(b); b.el.remove(); gone(); });
          list.push(nb); leaving++;
        }
        // every coin's place on the rack, planned before it's thrown
        const plan = CW.planZone(hz, list.map(b=>b.colour)); CW.applyLayout(hz, plan.map);
        const at = new Map(list.map((b,i)=>[b, plan.extras[i]]));
        list.sort((a,c)=>at.get(a).z-at.get(c).z);
        onto = (col,b)=>{ const s = at.get(b); return { x:s.x, y:s.y, z:s.z, zone:hz, slot:true, d:CW.D() }; };
      }
      const sl = CW.OPT.bankIn==='slot' && slotAt();
      // THE SLOT: one by one to the slot, a click, and down onto the pile
      const items = list.map(b=>({ b, to: sl ? { via:true, x:sl.x+CW.rr(-2,2), y:sl.y, z:0, d:CW.D(), T2:.28, flips2:0, then:onto(b.colour,b) } : onto(b.colour,b), onLand:gone }));
      const style = CW.OPT.winStyle==='handfuls' ? (big ? 'heave' : 'lob') : 'stream';
      await within(CW.throwAll(items, sl ? style : (big ? 'heave' : (list.length<=3 ? 'flick' : 'lob')), { big }), 14000/CW.OPT.speed);
      await new Promise(r=>setTimeout(r, motionOff()?0:300/CW.OPT.speed));
      closeHatch(); CW.sfx('hatchClose');
      bankPending = Math.max(0, bankPending-1); bankCap = Infinity;
      await syncHoard(false);
      if (list.some(b=>b.colour==='gold-bar')) CW.glintPile(hz);
      return;
    }
    const v = viewOn() ? ensureView() : null;
    CW.hooks.mouth = v
      // the bank view: each piece drops into its own column
      ? b=>{ const res = b.resolve, col = b.colour; b.resolve = null; CW.removeBody(b); b.el.remove(); gone(); v.receive(col); if (res) setTimeout(res,0); }
      : b=>{ const res = b.resolve; b.resolve = ()=>{ gone(); if (res) res(); }; dropIntoBank(b); };
    const br = v && v.el.getBoundingClientRect();
    const mouthX = col=>{
      if (!v) return hr.left+hr.width*CW.rr(.35,.65);
      const e = v.S.entry(v.g, col); return br.left+e.x+CW.rr(-2,2);
    };
    const mouth = col=>({ x:mouthX(col), y:hr.top, z:0, mouth:true, d:v ? CW.D() : (bank ? bank.diam : CW.D()+5) });
    const items = list.map(b=>{
      if (big && CW.rnd()<.3) return { b, to:{ x:hr.left+CW.rr(-8,hr.width+8), y:hr.top-2, z:0, rim:true, d:CW.D()+5, then:mouth(b.colour) } };
      return { b, to:mouth(b.colour) };
    });
    await within(CW.throwAll(items, big ? 'heave' : (list.length<=3 ? 'flick' : 'lob'), { big }), 9000/CW.OPT.speed);
    CW.hooks.mouth = null;
    await new Promise(r=>setTimeout(r, motionOff()?0:150/CW.OPT.speed));
    closeHatch(); CW.sfx('hatchClose');
    bankPending = Math.max(0, bankPending-1);
    bankCap = Infinity;
    if (v){ await settleView(); return; }
    syncBank(false);
  }
  // an opponent's win: the coins fly straight home to the seat's cup, top
  // first; each clicks in and the seat's stack readout spins up its share
  async function payOpp(p, list, gone){
    if (typeof EnemyCards!=='undefined') EnemyCards.slot(p, 6000);
    CW.sfx('win', .5);
    const tick = typeof seatStackTick==='function' ? seatStackTick(p, list.length) : ()=>{};
    const back = list.slice().sort((a,c)=>c.z-a.z);
    const items = back.map(b=>{ const s = edgeSource(p); return { b, to:{ x:s.x, y:s.y, z:s.z, vanish:true, d:CW.D()-4 }, onLand:()=>{ gone(); tick(); } }; });
    try { await within(CW.throwAll(items, 'lob'), 8000/CW.OPT.speed); }
    finally { if (tick.end) tick.end(); }
    if (typeof EnemyCards!=='undefined') EnemyCards.slot(p, 380);
  }

  /* ---------------- state for the rest of the game ---------------- */
  function potCoins(){ return on() && CW.zones.pot ? count(CW.zones.pot)+leaving : 0; }
  function shownPot(){ return Math.round(shown); }
  // a hand boundary (clearAllCardDOM) or a fresh table: empty the world
  function clear(){
    if (!CW) return;
    // a new hand: the rack re-matches the stack (a lost hand leaves it short)
    if ((bank || view) && on() && bankPending===0) syncBank(false);
    // the hoard survives the hand boundary: its pieces are put back after
    // the world is emptied, then it settles to the new stack
    const hz = CW.zones && CW.zones.bank, keep = hz ? hz.list.filter(b=>b.el) : [];
    const sh = keep.length && keep[0].sh ? keep[0].sh.parentNode : null;
    CW.clearWorld();
    Object.values(CW.zones).forEach(z=>{ if (z.hoard) return; clearTimeout(z.timer); z.list.length = 0; z.amount = 0; z.neat = true; });
    if (hz){
      hz.list = keep; const air = CW.airLayer();
      keep.forEach(b=>{ b.state = 'rest'; if (air) air.appendChild(b.el); if (sh && b.sh) sh.appendChild(b.sh); CW.dirty.add(b); });
      CW.kick();
      if (on() && bankPending===0 && hoardOn()) syncHoard(false);
    }
    CW.hooks.mouth = null;
    shown = 0; sweeping = null; leaving = 0;
    CW.newPotShape();                 // each hand's pot builds its own way
    if (CW.zones.pot) delete CW.zones.pot.shape;
  }
  function reset(){ clear(); laid = null; resetBank(); }
  // Settings: a taste of the chosen set (a few coins landing and a stack)
  function preview(){
    if (!CW || !settings.sound) return;
    sync(); CW.Coin.unlock();
    [0,70,150].forEach((t,i)=>setTimeout(()=>CW.sfx(i<2?'land':'stack', .8, 1+i*.06), t));
  }

  // Settings → Bank changed: rebuild the inside at once, the same money
  function restyleBank(){
    if (!on() || !game) return;
    sync();
    if (view){ view.clear(); view.el.remove(); view = null; }
    if (bank){ bank.el.remove(); bank = null; }
    const hl = $('hud-left');
    if (CW.zones.bank){ CW.zones.bank.list.forEach(b=>{ CW.removeBody(b); b.el.remove(); }); delete CW.zones.bank; }
    if (hl){ delete hl.dataset.hoard; hl.querySelectorAll('.hoard-well').forEach(e=>e.remove()); }
    if (hoardOn()){ fillHoard(); return; }
    if (viewOn()){ const v = ensureView(); if (v) v.setLabels(CW.OPT.bankLabels, unit()); settleView({ instant:true }); }
    else syncBank(true);
  }
  return { on, layout, bet, sweep, payout, potCoins, shownPot, clear, reset, sync, piecesFor, unit, view:()=>view, ensureView, restyleBank,
    hoard:()=>CW.zones.bank, syncHoard, tidyHoard, fillHoard,
    renderBank, rebuildBank, loadBank, tidyBank, preview,
    // Settings → The table changed mid-game: lay the spots out again (the
    // coins on them move to their new places and re-tidy)
    relayout(){ laid = null; return layout(); } };
})();
