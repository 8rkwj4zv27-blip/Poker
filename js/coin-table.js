/* ============================================================
   COIN TABLE — with DENOMINATIONS and the BANK VIEW (the coin economy
   pass, v0.43.0; built in coin-denom-lab.html and coin-bank-lab.html).

   What changes (Lab 1): every bet, yours and theirs, is counted the same
   way. One small coin is the small blind; a bet is its size in small
   coins, thrown as small coins up to a limit (OPT.betCap, OPT.allinCap),
   five small becoming a big coin (five big a bar) only as far as it takes
   to fit. After each sweep the pot changes up the same way to stay within
   OPT.potCap. Your bank (the rack) is unchanged for now: your pieces leave
   from it, and it re-matches your stack. OPT.denom 'off' is today's
   counting, for comparison.

   The original notes follow.

   COIN TABLE — the game's side of the coin world (integration steps 2–3,
   docs/ui/CHIP_PLAN.md). Presentation only: reads `game`, never changes
   poker state or money.

   Every bet (blinds included) is thrown as gold coins onto the player's
   bet spot on the felt; at the end of each street (advancePhase) and
   before any award (handleFoldWin / handleShowdown) the spots jump into
   the pot tray; payouts carry the tray's coins to the winners: an
   opponent's go to their spot and home to the seat, yours pour through
   the bank hatch (the pot smash ceremony's burst included). The pot
   plate reads the swept pot, counting up as coins land.

   Your bank (step 4) is a coin rack in the bank housing (#hud-left, over
   the hidden chip-disc pile #hud-tower): as many coins as your stack
   earns (CoinWorld.bankCoins), racked in towers; coins a win drops in
   through the hatch land loose on top until you tap the bank to tidy.

   COIN_TABLE_ON=false restores the old chip flights exactly.
   ============================================================ */
const COIN_TABLE_ON = true;

const CoinTable = (function(){
  'use strict';
  const CW = window.CoinWorld;
  Object.assign(CW.OPT, { denom:'on', betCap:16, allinCap:24, spotCap:30, potCap:60 });
  // Lab 2 (coin-bank-lab.html): the bank's inside, js/coin-bank.js's View
  // in one of its styles; 'today' is the shipped rack (Lab 1 runs on it)
  Object.assign(CW.OPT, { bank:'tubes', bankLabels:'off', bankChange:3 });
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
    // Settings → Bank: the inside (TUBES, SHELVES, HOPPER, CLASSIC), the
    // tube tags, how much making change plays out
    if (settings.bankStyle) O.bank = settings.bankStyle==='classic' ? 'today' : settings.bankStyle;
    if (settings.bankTags) O.bankLabels = settings.bankTags;
    if (settings.bankChange!=null) O.bankChange = +settings.bankChange;
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
      const TW=210, TH=62, cx=pr.left+pr.width/2, yc=pr.top+8-TH/2;
      const tray = document.createElement('div'); tray.className = 'ct-tray'; tray.dataset.tray = 'well';
      Object.assign(tray.style,{ width:TW+'px', height:TH+'px',
        left:Math.round(cx-fr.left-TW/2)+'px', top:Math.round(yc-fr.top-TH/2)+'px' });
      felt.appendChild(tray);
      // keep coins already on the felt: re-home each zone's list
      const old = {}; Object.keys(CW.zones).forEach(k=>{ old[k] = CW.zones[k]; delete CW.zones[k]; });
      CW.zone('pot', cx, yc+5, 9, 15, 44);
      if (bb) CW.zones.pot.room = (yc+5)-bb.B-10;
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
      if (z.list.length){ z.neat = false; CW.scheduleTidy(z); }
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
      // the pot re-picks its shape on every tap (so a tap reshapes a tidy pile)
      const pot = CW.zones.pot;
      if (CW.OPT.potTap==='on' && count(pot) && !CW.zoneBusy(pot) && !pot.tidying){ CW.newPotShape(CW.potShape()); pot.neat = false; }
      Object.values(CW.zones).forEach(z=>{ if (!CW.zoneBusy(z)) CW.tidyZone(z); });
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
  const viewOn = ()=>CW.OPT.bank && CW.OPT.bank!=='today' && !!window.CoinBank;
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
    if (!bank) return;
    bank.chips.forEach(c=>c.el && c.el.remove()); bank.chips.length = 0; bank.clumps = [];
  }
  // TABLE INTRO: the rack fills through the hatch, a coin at a time
  function loadBank(){
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
    const c = CW.compose(units, cap), out = [];
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
      ids.forEach(k=>{
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
      if (denomOn()) await within(CW.merge(pot, CW.OPT.potCap) || Promise.resolve(), 8000/CW.OPT.speed);
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
  // an opponent's win: the pile slides a short way toward them as a group
  // (raked in), then the coins hop home to the seat, top first
  async function payOpp(p, list, gone){
    if (typeof EnemyCards!=='undefined') EnemyCards.slot(p, 6000);
    const z = CW.zones['spot:'+p.id] || CW.zones.pot, pot = CW.zones.pot;
    CW.sfx('win', .5);
    setTimeout(()=>CW.sfx('collect', .5), 120/CW.OPT.speed);
    const L = Math.max(1, Math.hypot(z.cx-pot.cx, z.cy-pot.cy)), reach = Math.min(34, L*.3);
    let ux = (z.cx-pot.cx)/L*reach, uy = (z.cy-pot.cy)/L*reach;
    // the pile moves as one, only as far as the tray lets it: it bumps the
    // wall on the winner's side instead of riding up over the lip
    const k = CW.trayBox(CW.D(), 'gold');
    if (k){
      const xs = list.map(b=>b.x), ys = list.map(b=>b.y);
      ux = Math.max(Math.min(0, k.L-Math.min(...xs)), Math.min(Math.max(0, k.R-Math.max(...xs)), ux));
      uy = Math.max(Math.min(0, k.T-Math.min(...ys)), Math.min(Math.max(0, k.B-Math.max(...ys)), uy));
    }
    const all = list.map((b,i)=>{
      b.zone = pot; pot.list.push(b);
      const probe = { x:b.x+ux, y:b.y+uy, d:b.d, vx:0, vy:0 }; CW.holdIn(probe, pot);
      Object.assign(b,{ tx:probe.x, ty:probe.y, tz:b.z, lift:3, T:.34, wait:(i%6)*5, state:'wait', next:'push', target:{}, opts:{} });
      CW.active.add(b);
      return new Promise(res=>{ b.resolve = res; });
    });
    CW.kick();
    await within(Promise.all(all), 3000/CW.OPT.speed);
    await new Promise(r=>setTimeout(r, motionOff()?0:220/CW.OPT.speed));
    const back = list.slice().sort((a,c)=>c.z-a.z);
    back.forEach(b=>{ if (b.zone) CW.removeFromZone(b); });
    const items = back.map(b=>{ const s = edgeSource(p); return { b, to:{ x:s.x, y:s.y, z:s.z, vanish:true, d:CW.D()-4 }, onLand:gone }; });
    await within(CW.throwAll(items, 'lob'), 8000/CW.OPT.speed);
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
    CW.clearWorld();
    Object.values(CW.zones).forEach(z=>{ clearTimeout(z.timer); z.list.length = 0; z.amount = 0; z.neat = true; });
    CW.hooks.mouth = null;
    shown = 0; sweeping = null; leaving = 0;
    CW.newPotShape();                 // each hand's pot builds its own way
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
    if (viewOn()){ const v = ensureView(); if (v) v.setLabels(CW.OPT.bankLabels, unit()); settleView({ instant:true }); }
    else syncBank(true);
  }
  return { on, layout, bet, sweep, payout, potCoins, shownPot, clear, reset, sync, piecesFor, unit, view:()=>view, ensureView, restyleBank,
    renderBank, rebuildBank, loadBank, tidyBank, preview };
})();
