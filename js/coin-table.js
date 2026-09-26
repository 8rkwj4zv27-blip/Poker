/* ============================================================
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
    return [Math.round(f.left), Math.round(f.top), Math.round(f.width), Math.round(f.height),
      game ? game.players.map(p=>p.id).join(',') : ''].join('|');
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
      // the tray: a well centred on the pot pile, under the coins
      felt.querySelectorAll('.ct-tray').forEach(el=>el.remove());
      const TW=200, TH=58;
      const tray = document.createElement('div'); tray.className = 'ct-tray'; tray.dataset.tray = 'well';
      Object.assign(tray.style,{ width:TW+'px', height:TH+'px',
        left:Math.round(pr.left+pr.width/2-fr.left-TW/2)+'px', top:Math.round(pr.top-fr.top-16-TH/2-5)+'px' });
      felt.appendChild(tray);
      // keep coins already on the felt: re-home each zone's list
      const old = {}; Object.keys(CW.zones).forEach(k=>{ old[k] = CW.zones[k]; delete CW.zones[k]; });
      CW.zone('pot', pr.left+pr.width/2, pr.top-16, 9, 15, 44);
      if (bb) CW.zones.pot.room = (pr.top-16)-bb.B-10;
      CW.setTray({ L:pr.left+pr.width/2-TW/2+6, R:pr.left+pr.width/2+TW/2-6, T:pr.top-16-5-TH/2+4, B:pr.top-16-5+TH/2-4 });
      game.players.forEach(p=>{
        const e = seatEls[p.id]; if (!e) return;
        let x, y, room=0;
        if (p.isHuman){ x = fr.width*.80; y = fr.height*.80; }
        else {
          const cr = e.cardsContainer.getBoundingClientRect();
          const ax = cr.left+cr.width/2-fr.left, ay = cr.bottom-fr.top;
          const px = pr.left+pr.width/2-fr.left, py = pr.top-fr.top-40;
          x = ax+(px-ax)*.22; y = Math.max(ay+56, ay+(py-ay)*.3);
          if (bb){
            const rl = bb.L-fr.left, rR = bb.R-fr.left, rt = bb.T-fr.top, inset = 13;
            if (ax<rl){ x = (inset+rl)/2; y = rt+22; }
            else if (ax>rR){ x = (fr.width-inset+rR)/2; y = rt+22; }
            else { x = ax+(fr.width/2-ax)*.15; y = ay+(rt-ay)*.64; }
            room = y-ay-4;
          }
        }
        const z = CW.zone('spot:'+p.id, fr.left+x, fr.top+y+2, 7, 5, 16);
        if (room>0) z.room = room;
      });
      Object.keys(old).forEach(k=>{
        const z = CW.zones[k] || CW.zones.pot;
        old[k].list.forEach(b=>{ b.zone = z; z.list.push(b); });
        z.amount += old[k].amount||0;
      });
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
    const T = CW.tray();
    if (z.id==='pot' && T){ x = Math.max(T.L+10,Math.min(T.R-10,x)); y = Math.max(T.T+6,Math.min(T.B-3,y)); }
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
    const e = seatEls[p.id], r = (e.cardsContainer.getBoundingClientRect().width ? e.cardsContainer : e.root).getBoundingClientRect();
    return { x:r.left+r.width/2+CW.rr(-8,8), y:r.bottom+4, z:6 };
  }

  /* ---------------- your bank ---------------- */
  let bank = null, bankCap = Infinity, tidying = false;
  const human = ()=>game && game.players.find(p=>p.isHuman);
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
    const h = human(), b = ensureBank(); if (!h || !b) return;
    if (bankPending===0 && b.chips.length===0 && h.chips>0) syncBank(true);
  }
  function rebuildBank(){ if (on()) syncBank(false); }
  function resetBank(){
    if (!bank) return;
    bank.chips.forEach(c=>c.el && c.el.remove()); bank.chips.length = 0; bank.clumps = [];
  }
  // TABLE INTRO: the rack fills through the hatch, a coin at a time
  function loadBank(){
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
    if (!on() || tidying || !bank || !bank.chips.some(c=>c.loose)) return;
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
    if (!bk || bk.chips.length>=bankCap){ b.el.remove(); CW.sfx('stack', .6, CW.rise(b)); if (res) setTimeout(res,0); return; }
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
    const items = [];
    if (p.isHuman){
      // coins come off the top of the rack: an all-in empties it,
      // otherwise a handful by the bet's size (one always stays while
      // there's money left)
      const bk = ensureBank(); if (!bk) return Promise.resolve();
      const have = bk.chips.length;
      const want = allin ? have : Math.max(Math.min(1,have), Math.min(have-1, CW.betCoins(amount)));
      const n = Math.min(have, budget(want, z));
      if (allin && n<have) sinkBank(have-n);
      for (let i=0;i<n;i++){
        const t = bk.take(); if (!t) break;
        const r = t.rect, b = CW.body(t.c, r.left+r.width/2, r.bottom, 0, r.width);
        items.push({ b, to:targetIn(z) });
      }
      bk.apply({ slideMs:160 });
    } else {
      const n = budget(CW.betCoins(amount, allin), z);
      for (let i=0;i<n;i++){
        const s = edgeSource(p), b = CW.body(CW.makeChip('gold'), s.x, s.y, s.z, CW.D()-2); b.fresh = true;
        items.push({ b, to:targetIn(z) });
      }
    }
    return within(CW.throwAll(items, CW.kindFor(amount, allin, !p.isHuman), { big:allin }), 6000);
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
    CW.hooks.mouth = b=>{ const res = b.resolve; b.resolve = ()=>{ gone(); if (res) res(); }; dropIntoBank(b); };
    const mouth = ()=>({ x:hr.left+hr.width*CW.rr(.35,.65), y:hr.top, z:0, mouth:true, d:bank ? bank.diam : CW.D()+5 });
    const items = list.map(b=>{
      if (big && CW.rnd()<.3) return { b, to:{ x:hr.left+CW.rr(-8,hr.width+8), y:hr.top-2, z:0, rim:true, d:CW.D()+5, then:mouth() } };
      return { b, to:mouth() };
    });
    await within(CW.throwAll(items, big ? 'heave' : (list.length<=3 ? 'flick' : 'lob'), { big }), 9000/CW.OPT.speed);
    CW.hooks.mouth = null;
    await new Promise(r=>setTimeout(r, motionOff()?0:150/CW.OPT.speed));
    closeHatch(); CW.sfx('hatchClose');
    bankPending = Math.max(0, bankPending-1);
    bankCap = Infinity;
    syncBank(false);
  }
  // an opponent's win: the pile slides a short way toward them as a group
  // (raked in), then the coins hop home to the seat, top first
  async function payOpp(p, list, gone){
    const z = CW.zones['spot:'+p.id] || CW.zones.pot, pot = CW.zones.pot;
    CW.sfx('win', .5);
    setTimeout(()=>CW.sfx('collect', .5), 120/CW.OPT.speed);
    const L = Math.max(1, Math.hypot(z.cx-pot.cx, z.cy-pot.cy)), reach = Math.min(34, L*.3);
    const ux = (z.cx-pot.cx)/L*reach, uy = (z.cy-pot.cy)/L*reach;
    const all = list.map((b,i)=>{
      b.zone = pot; pot.list.push(b);
      const probe = { x:b.x+ux, y:b.y+uy, d:b.d, vx:0, vy:0 }; CW.contain(probe);
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
  }

  /* ---------------- state for the rest of the game ---------------- */
  function potCoins(){ return on() && CW.zones.pot ? count(CW.zones.pot)+leaving : 0; }
  function shownPot(){ return Math.round(shown); }
  // a hand boundary (clearAllCardDOM) or a fresh table: empty the world
  function clear(){
    if (!CW) return;
    CW.clearWorld();
    Object.values(CW.zones).forEach(z=>{ clearTimeout(z.timer); z.list.length = 0; z.amount = 0; z.neat = true; });
    CW.hooks.mouth = null;
    shown = 0; sweeping = null; leaving = 0;
  }
  function reset(){ clear(); laid = null; resetBank(); }
  // Settings: a taste of the chosen set (a few coins landing and a stack)
  function preview(){
    if (!CW || !settings.sound) return;
    sync(); CW.Coin.unlock();
    [0,70,150].forEach((t,i)=>setTimeout(()=>CW.sfx(i<2?'land':'stack', .8, 1+i*.06), t));
  }

  return { on, layout, bet, sweep, payout, potCoins, shownPot, clear, reset, sync,
    renderBank, rebuildBank, loadBank, tidyBank, preview };
})();
