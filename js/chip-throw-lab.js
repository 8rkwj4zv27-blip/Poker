/* ============================================================
   CHIP THROW LAB — how chips travel (docs/ui/CHIP_PLAN.md).

   Since integration step 1 the coin world itself (physics, pixel coins,
   spin, sounds) lives in js/coin-world.js, shared with the game; this
   file is the lab around it: the mounted production table, bet spots,
   pot tray, moves, PLAY HAND and the drawer. The history below is the
   engine's, kept for reference.

   v4, from the owner's notes on v3 ("pebbles", "cut-out paper", a
   fragile clink, arcs too extreme): chunky coins with a real edge and a
   bevelled rim; pile depth (a shadow line under every coin, covered coins
   darker); overlap free / snug / snap-onto-stacks; dead / 1 / 1–3
   bounces; four sound sets with a group "chunk" and rising pitch per
   throw; plates tick up per coin with a punch; calmer arcs, no tossed
   coin. Everything is a switch. The v3 notes below still describe the
   engine.


   v2 made every chip on the felt a physics body (ground point x,y, height
   z, velocity; drawn at y-z with its shadow on the felt at y). v3, from
   the owner's notes on v2:

     - CONTAINMENT: the table rail is a wall, and the board cards, deck,
       pot plate, seat cards and your hole cards are solid blocks on the
       felt. Chips bounce off them and never come to rest on them.
     - LANDING CONTROL: the first impact caps a chip's horizontal speed
       (felt grip), throws aim short by their predicted carry, and the felt
       grips harder the further a chip strays from its spot. Your long
       throws from the bank now land on your spot.
     - HEAVIER: stronger gravity, lower bounces, more friction, a squash
       frame on impact, mass-based chip-to-chip collisions (sliding chips
       and chips arriving low shove what they hit). The shimmering coin
       wobble is replaced by a rock: a slow tip or two, then a clunk.
     - COINS: a plain gold video-game coin drawn by code at its real size,
       with front, edge and a darker back, so a flip reads. Switchable to
       the v2 pixel colours or the original illustrated chips.
     - THROWS BY BET: a call is a low flick, a raise a lob of handfuls, a
       big raise a shove along the felt, an all-in a heave (quick handfuls,
       then a splash). One or two coins per throw are tossed high, flipping
       slowly with a glint at the top. Randomness is fresh on every run.
   Eased and stepped motion are gone (only TODAY still uses the old eased
   flight, for reference).

   Your bank stays the chip-lab heap/rack pile inside the dashboard. Same
   production table mount as chip-lab; memory only.
   ============================================================ */
(function(){
  'use strict';

  const CW=window.CoinWorld;
  const { OPT, BASE, BB, COLOURS, LIM, D, STEP, HR, ease, pixelArt, rnd, rint, rr, reseed,
    Coin, sfx, rise, active, dirty, squashing, zones, spinCache,
    makeChip, styleChip, coloursFor, betCoins, bankCoins, BankPile,
    body, removeBody, removeFromZone, kick, draw, contain, inBlock, boardRow, buildWalls,
    zone, zoneBusy, neatSlots, tidyZone, stackAt, topple, launch, throwAll, kindFor,
    glintAt, glintPile, clearWorld, spinFrame } = CW;

  /* ---------------- presets (lab only) ---------------- */
  const PRESETS={
    v11:  { ...BASE },
    v10:  { ...BASE, coins:'few' },
    v9:   { ...BASE },
    chunky:{ ...BASE, sfx:'clackplus' },
    heavy:{ ...BASE, bounces:'dead', roll:'off', sfx:'thud' },
    v4:   { ...BASE, overlap:'snug', sfx:'coin' },
    v3:   { ...BASE, body:'thin', depth:'off', overlap:'free', sfx:'old', rise:'off', group:'off', toss:'on' },
    today:{ art:'current', body:'thin', depth:'off', overlap:'free', size:'l', shadow:'off', throw:'stream', hand:'rigid', timing:'even', flips:'one', toss:'off',
            source:'face', bounces:'one', rock:'off', roll:'off', knock:'off', juice:'off', after:'neat', sweep:'stream', random:'same',
            sfx:'old', rise:'off', group:'off', eased:true }
  };
  const NOTES={
    v11:'MORE coins per bet (between SOME and LOTS) is the default. Coins no longer melt into piles on the felt: a bet only throws what the pot has room for, so every pile sweeps in whole. Wins now have sound: a jingle, the pot scraping across, the hatch clunking.',
    v10:'Your settled mix is now built in. Bets throw far fewer coins, and every pile has a limit: coins past it land and melt into the pile. Coins can no longer land in the board row (all five card places are solid). PLAY HAND deals a real hand you play from the bar.',
    v9:'Coins now spin over and over in the air, heads to tails (see COIN SPIN). Fixed: piles stay visible while they empty; the pot tray can no longer trap a coin; a watchdog puts down any coin still moving after 3.5s, so nothing can hang. Tidying is silent.',
    chunky:'As V5 with CLACK+: the same click with a heavier thud under it.',
    heavy:'As V5, with dead landings (no bounce, no roll) and the THUD sound set.',
    v4:'The last version: snug overlap and the COIN sound set.',
    v3:'The last version, for comparison: thin coins, free overlap, the old clink, a tossed coin.',
    today:'What the game does now, for reference: one chip at a time on smooth swaying arcs, out of the face.',
    custom:'Your own mix.'
  };
  /* ---------------- the table ---------------- */
  const card=code=>({ rank:code.slice(0,-1), suit:{s:'♠',h:'♥',d:'♦',c:'♣'}[code.slice(-1)], value:RANK_VALUES[code.slice(0,-1)] });
  const HOLE={ you:['9c','7c'], prof:['Ks','4d'], wild:['Ah','5h'], shark:['8s','8d'], maniac:['Jc','10c'] };
  const BOARD=['Qh','Jh','3d'].map(card);
  let P=null, bank=null, chutes={}, spotEls={}, potValue=0, busy=false, oppTurn=0, lastRun=null, gen=0;

  async function mountTable(){
    let src=null;
    for (const path of ['index.html','prod-table.html']){
      try{
        const res=await fetch(path,{cache:'no-store'}); if (!res.ok) continue;
        const found=new DOMParser().parseFromString(await res.text(),'text/html').querySelector('#table-screen');
        if (found){ src=found; break; }
      }catch(e){}
    }
    if (!src) throw new Error('No #table-screen found');
    const screen=document.importNode(src,true);
    screen.classList.remove('hidden'); screen.classList.add('cl-table');
    $('cl-mount').replaceWith(screen);
    screen.querySelectorAll('button,input,select').forEach(el=>{ el.disabled=true; el.tabIndex=-1; });
  }

  function setup(){
    gen++; reseed();
    clearWorld();
    Object.values(zones).forEach(z=>clearTimeout(z.timer));
    Object.keys(zones).forEach(k=>delete zones[k]);
    busy=false; oppTurn=0;
    if (askResolve) askResolve=null;
    if ($('ct-play')){ $('ct-play').hidden=true; $('ct-main').hidden=false; }
    settings.sound=OPT.sound==='on'; settings.haptics=false; settings.faces=true; settings.reduceMotion=false;
    const mk=(id,name,isHuman,idx)=>({ id,name,isHuman,hand:HOLE[id].map(card),chips:1000,inHand:true,folded:false,allIn:false,
      eliminated:false,betThisRound:0,totalBetHand:0,streetAction:null,faceColorIdx:idx,personality:{thinkSpeed:1} });
    P=[ mk('you','You',true,0), mk('prof','Prof',false,1), mk('wild','Wildcard',false,2), mk('shark','Shark',false,3), mk('maniac','Maniac',false,4) ];
    game={ mode:'cash', phase:'flop', over:false, handNumber:1, smallBlind:10, bigBlind:20, players:P, board:BOARD, pot:0, currentIndex:-1, currentBet:0, positions:{} };
    initSeats();
    resetPile($('hud-tower'),bankPile()); resetPile($('pot-stacks'),potPile());
    syncCardRow($('board'),BOARD,[false,false,false],false,'board');
    P.forEach(p=>{
      const e=seatEls[p.id]; if (!e) return;
      if (!p.isHuman) updateSeatReels(e.chips,p.chips);
      syncCardRow(e.cardsContainer,p.hand,p.isHuman?[false,false]:[true,true],!p.isHuman,'hole');
      if (e.actionSlot){ e.actionSlot.className='action-slot act-empty'; e.actionSlot.textContent='–'; }
    });
    updateJackpot(1000); updateInvestedReel(0);
    $('table-meta').textContent='Hand 1 · 10/20 · Chip Throw Lab';
    paintCRT($('hand-strength'),'<b>Nine-seven suited</b>',false);
    paintCRT($('banner'),actionRowsHTML('THROW LAB','PICK A MOVE',false),false);
    $('actions-row').classList.add('disabled');
    buildTable();
    potValue=0; paintPot(0);
    coloursFor(0,bankCoins(P[0].chips)).forEach(col=>bank.chips.push(makeChip(col)));
    bank.apply({snap:true});
    // cards dealt with an animation: measure the solid blocks once they've landed
    buildWalls(); setTimeout(()=>{ if (!busy) buildWalls(); },700);
    status('Ready');
  }

  function buildTable(){
    const felt=$('felt'), fr=felt.getBoundingClientRect();
    felt.querySelectorAll('.cl-spot,.cl-pot,.ct-chute,.ct-tray').forEach(el=>el.remove());
    felt.dataset.nums=OPT.nums;
    $('pot-area').classList.remove('hidden');
    const pr=$('pot-area').querySelector('.pot-chip').getBoundingClientRect();
    // the pot's tray: centred on the pot pile, drawn under the coins
    const TW=200, TH=58;
    const tray=document.createElement('div'); tray.className='ct-tray'; tray.dataset.tray=OPT.tray;
    Object.assign(tray.style,{ width:TW+'px', height:TH+'px', left:Math.round(pr.left+pr.width/2-fr.left-TW/2)+'px', top:Math.round(pr.top-fr.top-16-TH/2-5)+'px' });
    felt.appendChild(tray);
    CW.setTray(OPT.tray==='none'?null:{ L:pr.left+pr.width/2-TW/2+6, R:pr.left+pr.width/2+TW/2-6, T:pr.top-16-5-TH/2+4, B:pr.top-16-5+TH/2-4 });
    zone('pot',pr.left+pr.width/2,pr.top-16,9,15,44);
    const bb=$('board').getBoundingClientRect();
    if (bb.height) zones.pot.room=(pr.top-16)-bb.bottom-10;
    spotEls={}; chutes={};
    P.forEach(p=>{
      const el=document.createElement('div'); el.className='cl-spot'+(p.isHuman?' is-you':'');
      el.innerHTML='<div class="cl-spot-ring"></div><div class="cl-spot-plate"><span>0</span></div>';
      felt.appendChild(el);
      let x,y,room=0;
      if (p.isHuman){ x=fr.width*.80; y=fr.height*.80; }
      else {
        // v10: every spot sits clear of the five-card board row. A seat
        // beside the row bets into the strip between the row and the rail;
        // a seat above it bets into the band between its cards and the row.
        // Each spot's towers are capped by the room above it (room), so a
        // pile never climbs onto the seat's cards.
        const cr=seatEls[p.id].cardsContainer.getBoundingClientRect(), row=boardRow();
        const ax=cr.left+cr.width/2-fr.left, ay=cr.bottom-fr.top, px=pr.left+pr.width/2-fr.left, py=pr.top-fr.top-40;
        x=ax+(px-ax)*.22; y=Math.max(ay+56, ay+(py-ay)*.3);
        if (row){
          const rl=row.L-fr.left, rR=row.R-fr.left, rt=row.T-fr.top, inset=13;
          if (ax<rl){ x=(inset+rl)/2; y=rt+22; }
          else if (ax>rR){ x=(fr.width-inset+rR)/2; y=rt+22; }
          else { x=ax+(fr.width/2-ax)*.15; y=ay+(rt-ay)*.64; }
          room=y-ay-4;
        }
        if (OPT.source==='chute'){
          const ch=document.createElement('div'); ch.className='ct-chute';
          ch.style.left=Math.round(ax)+'px'; ch.style.top=Math.round(ay+11)+'px';
          felt.appendChild(ch); chutes[p.id]=ch;
        }
      }
      el.style.left=Math.round(x)+'px'; el.style.top=Math.round(y)+'px';
      spotEls[p.id]=el;
      zone('spot:'+p.id,fr.left+x,fr.top+y+2,7,5,16);
      if (room>0) zones['spot:'+p.id].room=room;
    });
    const hl=$('hud-left');
    hl.querySelectorAll('.cl-bank,.cl-hatch,.cl-tidy-hint').forEach(el=>el.remove());
    hl.dataset.bank='tidy';
    const bankEl=document.createElement('div'); bankEl.className='cl-bank'; hl.appendChild(bankEl);
    const hatch=document.createElement('div'); hatch.className='cl-hatch'; hatch.innerHTML='<i></i><i></i>'; hl.appendChild(hatch);
    const hint=document.createElement('div'); hint.className='cl-tidy-hint'; hint.textContent='TAP TO TIDY'; hl.appendChild(hint);
    bank=new BankPile(bankEl);
    hl.onclick=tidyBank;
    felt.onclick=ev=>{
      // tap a tower: it topples away from your finger; tap a loose coin: it
      // flicks; tap empty felt (with MESS·TAP): the piles tidy
      let hit=null, best=1e9;
      Object.values(zones).forEach(z=>z.list.forEach(b=>{
        if (b.state!=='rest') return;
        const cx=b.x, cy=b.y-b.z-b.d*.5, dd=Math.hypot(cx-ev.clientX,cy-ev.clientY);
        if (dd<b.d*.9 && dd<best){ best=dd; hit=b; }
      }));
      if (hit){
        const tower=stackAt(hit), base=tower[tower.length-1];
        const dx=base.x-ev.clientX||rr(-1,1), dy=(base.y-ev.clientY)*.4;
        if (!topple(tower,dx,dy,1.3)){
          const L=Math.max(1,Math.hypot(dx,dy));
          hit.target={}; hit.opts={}; hit.bounces=0; hit.maxB=1; hit.e=.3; hit.knocked=true; hit.inFelt=true; hit.edge=false;
          hit.vx=dx/L*rr(60,100); hit.vy=dy/L*rr(20,40); hit.vz=rr(160,220); hit.fr=Math.PI*2/.25; hit.phi=0; hit.t=.1; hit.T=0;
          if (hit.zone) hit.zone.neat=false; hit.state='air'; active.add(hit); kick(); sfx('stack',.7);
        }
        return;
      }
      if (OPT.after==='tap') Object.values(zones).forEach(z=>{ if (!zoneBusy(z)) tidyZone(z); });
    };
  }

  // a mechanical counter: rolls past the true pot, then snaps back
  function overshootPot(v){
    const plateEl=document.querySelector('#pot-area .pot-chip');
    if (motionOff()){ paintPot(v); return; }
    paintPot(v+Math.max(2,Math.round(v*.035))); punch(plateEl);
    setTimeout(()=>{ paintPot(v+Math.max(1,Math.round(v*.012))); },70/OPT.speed);
    setTimeout(()=>{ paintPot(v); punch(plateEl); },150/OPT.speed);
  }
  function paintPot(v){
    const el=$('pot-val'); if (el) el.textContent=Math.round(v).toLocaleString();
    $('pot-area').classList.toggle('cl-pot-empty', v<=0);
  }
  function countPot(to,ms){
    const from=potValue; potValue=to;
    if (motionOff()){ paintPot(to); return Promise.resolve(); }
    const t0=performance.now(), d=ms/OPT.speed;
    return new Promise(res=>{
      const tick=now=>{ const k=Math.min(1,(now-t0)/d); paintPot(from+(to-from)*ease.out(k)); if (k<1) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }
  function plate(id,shown){
    const z=zones['spot:'+id], el=spotEls[id], v=shown==null?z.amount:shown;
    el.classList.toggle('has-bet',v>0 || z.amount>0);
    if (v<=0){ el.classList.remove('is-pop'); clearTimeout(popTimers[id]); }
    el.querySelector('.cl-spot-plate span').textContent=Math.round(v).toLocaleString();
  }
  const popTimers={};
  function popPlate(id){
    if (OPT.nums!=='pop') return;
    const el=spotEls[id]; if (!el) return;
    el.classList.add('is-pop'); clearTimeout(popTimers[id]);
    popTimers[id]=setTimeout(()=>el.classList.remove('is-pop'),1100/OPT.speed);
  }
  function punch(el){ if (!el || motionOff()) return; el.classList.remove('is-tick'); void el.offsetWidth; el.classList.add('is-tick'); }
  // a bet's plate counts up coin by coin as they land
  function ticker(id,from,amount,n){
    let k=0; const plateEl=spotEls[id].querySelector('.cl-spot-plate');
    return ()=>{ k++; plate(id,from+amount*Math.min(1,k/n)); punch(plateEl); popPlate(id); };
  }
  function say(who,what,cls,p){
    paintCRT($('banner'),actionRowsHTML(who,what,false),false);
    if (p && seatEls[p.id] && seatEls[p.id].actionSlot){ seatEls[p.id].actionSlot.className='action-slot '+(cls||''); seatEls[p.id].actionSlot.textContent=what; }
  }
  function source(p){
    const e=seatEls[p.id];
    if (OPT.source==='chute' && chutes[p.id]){ const r=chutes[p.id].getBoundingClientRect(); return { x:r.left+r.width/2+rr(-2,2), y:r.top+r.height/2+2, z:0, chute:chutes[p.id] }; }
    if (OPT.source==='edge'){ const r=e.cardsContainer.getBoundingClientRect(); return { x:r.left+r.width/2+rr(-8,8), y:r.bottom+4, z:6 }; }
    const r=e.chips.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2+D()/2, z:0 };
  }
  function targetIn(z,b){
    if (OPT.after==='neat'){
      if (b.zone!==z){ if (b.zone) removeFromZone(b); b.zone=z; z.list.push(b); }
      const s=neatSlots(z,z.list).get(b);
      return { x:s.x, y:s.y, z:s.z, zone:z, slot:true, d:D() };
    }
    z.neat=false;
    let x=z.cx+rr(-5,5), y=z.cy+rr(-3,3);
    const TRAY=CW.tray();
    if (z.id==='pot' && TRAY){ x=Math.max(TRAY.L+10,Math.min(TRAY.R-10,x)); y=Math.max(TRAY.T+6,Math.min(TRAY.B-3,y)); }
    return { x, y, z:0, zone:z, d:D() };
  }
  // coins already heading for the pot: in it, or sitting on a bet spot
  function potRoom(){
    let n=zones.pot?zones.pot.list.length:0;
    Object.keys(zones).forEach(k=>{ if (k.startsWith('spot:')) n+=zones[k].list.length; });
    return LIM().pot-n;
  }
  // a bet's handful, trimmed to what its spot and the pot still have room
  // for (always at least one coin, so every bet is seen)
  const budget=(n,z)=>Math.max(Math.min(1,n),Math.min(n,potRoom(),LIM().spot-z.list.length));
  const waitMs=ms=>new Promise(r=>setTimeout(r,motionOff()?0:ms/OPT.speed));
  async function zoneSettled(z,max){
    const t0=performance.now(), my=gen;
    while (performance.now()-t0<(max||5000)/OPT.speed && my===gen){
      if (!zoneBusy(z) && (OPT.after!=='auto' || z.neat)) return;
      await new Promise(r=>setTimeout(r,50));
    }
  }
  const within=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(r,ms/OPT.speed))]);
  function guard(my){ if (my!==gen) throw new Error('cancelled'); }

  /* ---------------- moves ---------------- */
  function chuteKick(ch){ if (!ch) return; ch.classList.remove('is-kick'); void ch.offsetWidth; ch.classList.add('is-kick'); sfx('chute'); }
  async function oppBet(p,amount,label,allin){
    const my=gen;
    p.chips=Math.max(0,p.chips-amount); updateSeatReels(seatEls[p.id].chips,p.chips);
    say(p.name.toUpperCase(),label.toUpperCase(),p.chips?'':'act-allin',p);
    const z=zones['spot:'+p.id]; z.amount+=amount; plate(p.id);
    if (OPT.source==='chute' && chutes[p.id] && OPT.juice==='on' && !motionOff()){ chutes[p.id].classList.add('is-rattle'); await waitMs(110); chutes[p.id].classList.remove('is-rattle'); }
    guard(my);
    const kind=kindFor(amount,allin,OPT.source!=='face');
    const cols=coloursFor(amount,budget(betCoins(amount,allin),z)), tick=ticker(p.id,z.amount-amount,amount,cols.length);
    plate(p.id,z.amount-amount);
    const items=cols.map(col=>{
      const s=source(p), b=body(makeChip(col),s.x,s.y,s.z,D()-2); b.fresh=true;
      return { b, to:targetIn(z,b), onStart:()=>chuteKick(s.chute), onLand:tick };
    });
    await within(throwAll(items,kind,{ big:allin }),6000);
    await zoneSettled(z,2500);
  }
  async function youBet(amount,label,allin){
    const my=gen;
    const you=P[0]; you.chips=Math.max(0,you.chips-amount); updateJackpot(you.chips);
    you.totalBetHand+=amount; updateInvestedReel(you.totalBetHand);
    say('YOU',label.toUpperCase());
    const z=zones['spot:you']; z.amount+=amount;
    // all-in empties the bank; otherwise a handful by the bet's size
    const want=allin?bank.chips.length:Math.max(Math.min(1,bank.chips.length),Math.min(bank.chips.length-1,betCoins(amount)));
    const n=Math.min(bank.chips.length,budget(want,z));
    // all-in with no room left for all of the bank: the rest drop back into the machine
    if (allin && n<bank.chips.length) sinkBank(bank.chips.length-n);
    const cols=coloursFor(amount,n), tick=ticker('you',z.amount-amount,amount,Math.max(1,cols.length));
    plate('you',z.amount-amount);
    const items=[];
    for (const col of cols){
      const t=bank.take(); if (!t) break;
      if (t.c.colour!==col){ t.c.colour=col; t.c.frame=''; if (!pixelArt()) styleChip(t.c); }
      const r=t.rect, b=body(t.c,r.left+r.width/2,r.bottom,0,r.width);
      items.push({ b, to:targetIn(z,b), onLand:tick });
    }
    bank.apply({ slideMs:160 });
    if (!items.length) plate('you');
    guard(my);
    // your chips come from the bank, off the felt: never a shove
    await within(throwAll(items,kindFor(amount,allin,false),{ big:allin }),6000);
    await zoneSettled(z,2500);
  }
  function neatFill(z,amount){
    z.amount+=amount;
    coloursFor(amount).forEach(col=>{ const b=body(makeChip(col),z.cx,z.cy,0,D()); b.zone=z; z.list.push(b); });
    const s=neatSlots(z,z.list);
    z.list.forEach(b=>{ const q=s.get(b); b.x=q.x; b.y=q.y; b.z=q.z; b.state='rest'; dirty.add(b); });
    z.neat=true; kick(); setTimeout(()=>{ dirty.forEach(draw); dirty.clear(); },0);
  }
  async function sweep(){
    const my=gen;
    let ids=Object.keys(zones).filter(k=>k.startsWith('spot:') && (zones[k].list.length || zones[k].amount>0));
    if (!ids.length){
      [['maniac',180],['wild',180],['you',180]].forEach(([id,a])=>{ neatFill(zones['spot:'+id],a); plate(id); });
      ids=Object.keys(zones).filter(k=>k.startsWith('spot:') && zones[k].list.length);
      await waitMs(600); guard(my);
    }
    say('DEALER','SWEEP');
    const pot=zones.pot, total=ids.reduce((a,k)=>a+zones[k].amount,0), all=[];
    const potPlate=document.querySelector('#pot-area .pot-chip');
    let shown=potValue;
    if (OPT.sweep==='jump'){
      // each pile empties into the pot top-first, coin by coin, in turn
      let delay=0; const throws=[];
      ids.forEach(k=>{
        const z=zones[k], list=z.list.slice().sort((a,c)=>c.z-a.z); z.list.length=0;
        const each=z.amount/Math.max(1,list.length);
        spotEls[k.slice(5)].classList.add('is-sweeping'); spotEls[k.slice(5)].classList.remove('is-pop');
        const items=list.map(b=>{ b.zone=null; b.inFelt=true; const to=targetIn(pot,b); return { b, to, onLand:()=>{ shown+=each; paintPot(shown); punch(potPlate); } }; });
        throws.push(throwAll(items,'hop',{ delay }));
        delay+=160+list.length*24;
      });
      potValue+=total;
      await within(Promise.all(throws),9000); guard(my);
      overshootPot(potValue);
      sfx('collect',.6);
      ids.forEach(k=>{ zones[k].amount=0; const id=k.slice(5); spotEls[id].classList.remove('is-sweeping'); plate(id); });
      if (OPT.after==='auto'){ await waitMs(200); guard(my); await tidyZone(pot); }
      return;
    }
    ids.forEach((k,si)=>{
      const z=zones[k], list=z.list.slice(); z.list.length=0;
      const each=z.amount/Math.max(1,list.length);
      spotEls[k.slice(5)].classList.add('is-sweeping');
      // each spot's chips arrive as a squeezed group inside the pot area
      const aim={ x:pot.cx+rr(-26,26), y:pot.cy+rr(-5,4) };
      list.forEach((b,ci)=>{
        b.zone=pot; pot.list.push(b);
        let tx=aim.x+(b.x-z.cx)*.55, ty=aim.y+(b.y-z.cy)*.55, tz=b.z;
        if (OPT.after==='neat'){ const s=neatSlots(pot,pot.list).get(b); tx=s.x; ty=s.y; tz=s.z; }
        else {
          // never onto a card or the plate
          const probe={ x:tx, y:ty, d:b.d, vx:0, vy:0 }; contain(probe); tx=probe.x; ty=probe.y;
        }
        b.tx=tx; b.ty=ty; b.tz=tz; b.lift=3;
        const dist=Math.hypot(tx-b.x,ty-b.y);
        if (OPT.sweep==='push'){ b.T=.32+dist/1500; b.wait=si*70; }
        else { b.T=.42; b.wait=si*55+ci*14; b.lift=6; }
        b.state='wait'; b.next='push'; b.target={}; b.opts={}; active.add(b);
        all.push(new Promise(res=>{ b.resolve=res; }).then(()=>{ shown+=each; paintPot(shown); if (ci%2===0) punch(potPlate); }));
      });
    });
    kick();
    if (OPT.after!=='neat') pot.neat=false;
    potValue+=total;
    await within(Promise.all(all),6000); guard(my);
    overshootPot(potValue);
    sfx('collect',.6);
    ids.forEach(k=>{ zones[k].amount=0; const id=k.slice(5); spotEls[id].classList.remove('is-sweeping'); plate(id); });
    if (OPT.after==='auto'){ await waitMs(200); guard(my); await tidyZone(pot); }
  }
  // COIN TOSS test: six coins from your bank, thrown high and slow into the
  // pot, one at a time, so the spin can be studied
  async function tossTest(){
    const my=gen, z=zones.pot, items=[];
    say('TOSS TEST','WATCH THE SPIN');
    for (let i=0;i<6;i++){
      const t=bank.take(); if (!t) break;
      const r=t.rect, b=body(t.c,r.left+r.width/2,r.bottom,0,r.width);
      items.push({ b, to:targetIn(z,b) });
    }
    bank.apply({ slideMs:160 });
    await within(throwAll(items,'test'),12000); guard(my);
  }
  async function ensurePot(){
    const pot=zones.pot;
    if (pot.list.length) return;
    neatFill(pot,2000); potValue=2000; paintPot(2000);
    await waitMs(400);
  }
  // the bank holds a limited number of coins for your stack (bankCoins);
  // a payout coin past that melts in at the hatch
  let bankCap=Infinity;
  function dropIntoBank(b){
    const res=b.resolve; b.resolve=null;
    removeBody(b);
    if (bank.chips.length>=bankCap){
      b.el.remove(); sfx('stack',.6,rise(b));
      if (rnd()<.3){ const hr=$('hud-left').getBoundingClientRect(); glintAt(b.x,hr.top-2); }
      if (res) setTimeout(res,0); return;
    }
    const c=b.chip, hr=$('hud-left').getBoundingClientRect();
    c.loose=true;
    bank.chips.push(c);
    bank.apply({ snap:true });
    const r=c.el.getBoundingClientRect();
    const dx=b.x-(r.left+r.width/2), dy=(hr.top+4)-r.top;
    const pitch=rise(b);
    if (b.opts && b.opts.big && rnd()<.3) glintAt(b.x,hr.top-2,120);
    if (!motionOff()){
      c.el.animate([
        { transform:'translate('+dx+'px,'+dy+'px)', easing:'cubic-bezier(.55,0,1,.6)' },
        { transform:'translate(0,1px) scale(1.12,.82)', offset:.74, easing:'steps(1,end)' },
        { transform:'translate(0,-3px)', offset:.86, easing:'cubic-bezier(.3,0,.7,1)' },
        { transform:'none' }
      ],{ duration:290/OPT.speed });
      setTimeout(()=>sfx('stack',.7,pitch),210/OPT.speed);
    }
    if (res) setTimeout(res,motionOff()?0:290/OPT.speed);
  }
  // pays you `amount` with the given pot coins (default: the whole pot)
  async function payYou(amount,coins,label){
    const my=gen;
    if (amount==null){ await ensurePot(); guard(my); }
    const pot=zones.pot, you=P[0], won=amount!=null?amount:potValue, start=you.chips, from=potValue;
    say('YOU WIN',label||won.toLocaleString());
    sfx('win',1);
    bankCap=bankCoins(start+won);
    const hatch=$('hud-left').querySelector('.cl-hatch');
    hatch.classList.add('is-open'); sfx('hatch');
    await waitMs(150); guard(my);
    const hr=hatch.getBoundingClientRect();
    const list=(coins||pot.list.slice()).sort((a,c)=>c.z-a.z||a.y-c.y);
    list.forEach(b=>{ if (b.zone) removeFromZone(b); });
    const n=Math.max(1,list.length); let landed=0;
    // JACKPOT: a big win comes faster than the hatch can take it: some coins
    // hit the dashboard rim first and hop in
    const jackpot=won>=800 && OPT.juice==='on';
    const hl=$('hud-left').getBoundingClientRect();
    const items=list.map(b=>{
      const mouth={ x:hr.left+hr.width*rr(.35,.65), y:hr.bottom, z:0, mouth:true, d:bank.diam };
      if (jackpot && rnd()<.3) return { b, to:{ x:hl.left+rr(-8,hl.width+8), y:hl.top-2, z:0, rim:true, d:bank.diam, then:mouth } };
      return { b, to:mouth };
    });
    const tallied=throwAll(items,jackpot?'heave':(kindFor(won,false,false)==='flick'?'flick':'lob'),{ big:jackpot }).then(()=>{});
    items.forEach(it=>{ const r=it.b.resolve; it.b.resolve=()=>{ landed++; paintPot(Math.round(from-won*landed/n)); you.chips=Math.round(start+won*landed/n); updateJackpot(you.chips); if (r) r(); }; });
    await within(tallied,9000); guard(my);
    you.chips=start+won; updateJackpot(you.chips); potValue=Math.max(0,from-won); paintPot(potValue);
    bankCap=Infinity; topUpBank();
    await waitMs(150);
    hatch.classList.remove('is-open'); sfx('hatchClose');
  }
  async function payOpp(p,amount,coins,label){
    const my=gen;
    if (amount==null){ await ensurePot(); guard(my); }
    const pot=zones.pot, won=amount!=null?amount:potValue, z=zones['spot:'+p.id], from=potValue;
    say(p.name.toUpperCase()+' WINS',label||won.toLocaleString());
    sfx('win',.5); setTimeout(()=>sfx('collect',.5),120/OPT.speed);
    const list=coins||pot.list.slice();
    const all=list.map((b,i)=>{
      if (b.zone) removeFromZone(b);
      b.zone=z; z.list.push(b);
      const probe={ x:z.cx+(b.x-pot.cx)*.5, y:z.cy+(b.y-pot.cy)*.5, d:b.d, vx:0, vy:0 }; contain(probe);
      b.tx=probe.x; b.ty=probe.y; b.tz=b.z; b.lift=4; b.T=.5; b.wait=(i%6)*6; b.state='wait'; b.next='push'; b.target={}; b.opts={}; active.add(b);
      return new Promise(res=>{ b.resolve=res; });
    });
    kick();
    z.amount=won; plate(p.id);
    await within(Promise.all([Promise.all(all), countPot(Math.max(0,from-won),520)]),6000); guard(my);
    sfx('collect',.6);
    await waitMs(420); guard(my);
    const back=z.list.slice().sort((a,c)=>c.z-a.z); z.list.length=0; z.amount=0; plate(p.id);
    const items=back.map(b=>{ b.zone=null; const s=source(p); return { b, to:{ x:s.x, y:s.y, z:s.z, vanish:true, d:D()-4 } }; });
    await within(throwAll(items,'lob'),8000); guard(my);
    p.chips+=won; updateSeatReels(seatEls[p.id].chips,p.chips);
  }
  // after a payout or a new hand the bank shows as many coins as your stack
  // earns (bankCoins): short coins drop in, extras slide away
  function topUpBank(){
    const want=bankCoins(P[0].chips);
    if (bank.chips.length===want) return;
    while (bank.chips.length<want) bank.chips.push(makeChip('gold'));
    while (bank.chips.length>want){ const c=bank.chips.shift(); if (c.clump){ c.clump.n--; c.clump=null; } if (c.el) c.el.remove(); }
    bank.apply({ slideMs:200 });
  }
  // coins taken back into the machine: they drop through the bank's floor
  function sinkBank(k){
    const out=[];
    for (let i=0;i<k;i++){ const t=bank.take(); if (!t) break; out.push(t.c); }
    out.forEach((c,i)=>{
      if (c.clump){ c.clump.n--; c.clump=null; }
      if (motionOff() || !c.el.animate){ c.el.remove(); return; }
      c.el.animate([{ transform:'none', opacity:1 },{ transform:'translateY(26px)', opacity:0 }],{ duration:260/OPT.speed, delay:i*18/OPT.speed, easing:'cubic-bezier(.5,0,1,.6)', fill:'forwards' }).onfinish=()=>c.el.remove();
    });
    if (out.length){ sfx('hatch'); setTimeout(()=>sfx('hatchClose'),240/OPT.speed); }
  }
  let tidying=false;
  async function tidyBank(){
    if (tidying || !bank.chips.some(c=>c.loose)) return;
    tidying=true;
    const hl=$('hud-left'); hl.classList.add('is-tidying');
    const groups=[...new Set(bank.chips.filter(c=>c.loose).map(c=>c.colour))].sort((a,b)=>COLOURS.indexOf(b)-COLOURS.indexOf(a));
    for (const col of groups){
      bank.chips.forEach(c=>{ if (c.colour===col){ c.loose=false; c.clump=null; } });
      if (!bank.chips.some(c=>c.loose)) bank.clumps=[];
      bank.apply({ slideMs:210, stagger:6, easing:'cubic-bezier(.5,0,.2,1)' });
      await waitMs(120);
    }
    await waitMs(160);
    hl.classList.remove('is-tidying'); tidying=false;
  }

  /* ============================================================
     PLAY A HAND (v10): a real hand of Hold'em on the lab table, so the
     coins can be judged in the flow of play. Blinds, four streets of
     betting, showdown with side pots, using the game's own deck and hand
     evaluator (01-poker-math.js). Opponents follow a simple lab rule of
     thumb (hand strength, pot odds, a style per seat), not the game's AI.
     Your moves come from the bar. Stacks carry over between hands; a
     broke seat buys back in for 1,000.
     ============================================================ */
  let H=null, handNo=1, askResolve=null;
  const r10=v=>Math.max(BB,Math.round(v/10)*10);
  const nameOf=p=>p.isHuman?'YOU':p.name.toUpperCase();
  const canAct=p=>!p.folded && p.chips>0;
  const liveCount=()=>P.filter(p=>!p.folded).length;
  const potTotal=()=>potValue+P.reduce((a,p)=>a+p.betThisRound,0);
  const STYLE={ prof:{ loose:-.06, agg:.3 }, wild:{ loose:.1, agg:.5 }, shark:{ loose:0, agg:.45 }, maniac:{ loose:.14, agg:.8 } };
  function clearFelt(){
    Object.values(zones).forEach(z=>{ clearTimeout(z.timer); z.list.forEach(b=>{ if (b.sh) b.sh.remove(); b.el.remove(); }); z.list.length=0; z.amount=0; z.neat=true; });
    clearWorld();
    P.forEach(p=>plate(p.id)); potValue=0; paintPot(0);
  }
  function foldLook(p){
    const e=seatEls[p.id];
    if (e.root) e.root.classList.add('folded');
    e.cardsContainer.style.opacity=p.isHuman?'.45':'.35';
  }
  function showHandText(){
    const you=P[0];
    paintCRT($('hand-strength'),'<b>'+(you.folded?'Folded':describePlayerHand(you.hand,H.board))+'</b>',false);
  }
  function newHand(){
    clearFelt();
    H={ board:[], put:{}, cur:0, minRaise:BB, raises:0, dealer:H?(H.dealer+1)%P.length:0, deck:shuffle(createDeck()) };
    P.forEach(p=>{
      if (p.chips<=0) p.chips=1000;
      p.folded=false; p.allIn=false; p.betThisRound=0; p.totalBetHand=0; H.put[p.id]=0;
      p.hand=[H.deck.pop(),H.deck.pop()];
      const e=seatEls[p.id]; if (!e) return;
      if (e.root) e.root.classList.remove('folded');
      e.cardsContainer.style.opacity='';
      if (!p.isHuman) updateSeatReels(e.chips,p.chips);
      syncCardRow(e.cardsContainer,p.hand,p.isHuman?[false,false]:[true,true],!p.isHuman,'hole');
      if (e.actionSlot){ e.actionSlot.className='action-slot act-empty'; e.actionSlot.textContent='–'; }
    });
    game.board=H.board; syncCardRow($('board'),[],[],false,'board');
    updateJackpot(P[0].chips); updateInvestedReel(0); topUpBank();
    $('table-meta').textContent='Hand '+(handNo++)+' · 10/20 · Chip Throw Lab';
    showHandText();
  }
  function strength(p){
    if (!H.board.length){
      const [a,c]=p.hand; let s=(a.value+c.value-4)/24*.6;
      if (a.value===c.value) s+=.35+a.value/60;
      if (a.suit===c.suit) s+=.06;
      if (Math.abs(a.value-c.value)===1) s+=.04;
      return Math.min(1,s);
    }
    const r=evaluate7([...p.hand,...H.board]);
    return Math.min(1,[.15,.45,.64,.74,.82,.86,.92,.97,1,1][r.cat]+(r.tiebreak[0]||0)/200);
  }
  function decide(p){
    const st=STYLE[p.id]||{ loose:0, agg:.4 }, toCall=Math.max(0,H.cur-p.betThisRound), pot=potTotal();
    const s=strength(p)+st.loose+rr(-.1,.1);
    const canRaise=P.some(q=>q!==p && canAct(q)) && p.chips>toCall && H.raises<4;
    const raiseTo=()=>H.cur?H.cur+Math.max(H.minRaise,r10(pot*rr(.5,.9))):r10(pot*rr(.45,.75));
    if (canRaise && s>.9 && rnd()<st.agg*.35) return { k:'allin' };
    if (toCall===0) return canRaise && s>.58 && rnd()<st.agg ? { k:'raise', to:raiseTo() } : { k:'check' };
    const odds=toCall/(pot+toCall);
    if (s<.18+odds*.45 && rnd()>.1) return { k:'fold' };
    if (canRaise && s>.74 && rnd()<st.agg*.7) return { k:'raise', to:raiseTo() };
    return { k:'call' };
  }
  function askYou(){
    const you=P[0], toCall=Math.max(0,H.cur-you.betThisRound), row=$('ct-play'), main=$('ct-main');
    const most=you.chips+you.betThisRound;
    const raiseTo=!H.board.length && H.raises===0 ? 3*BB : (H.cur?H.cur+Math.max(H.minRaise,r10(potTotal()*.6)):r10(potTotal()*.6));
    const canRaise=P.some(q=>q!==you && canAct(q)) && you.chips>toCall && H.raises<4;
    const btn=k=>row.querySelector('[data-act="'+k+'"]');
    btn('fold').hidden=toCall<=0;
    btn('call').innerHTML=toCall<=0?'CHECK':(toCall>=you.chips?'CALL<br>ALL-IN':'CALL<br>'+toCall);
    btn('raise').hidden=!canRaise || raiseTo>=most;
    btn('raise').innerHTML=(H.cur?'RAISE<br>TO ':'BET<br>')+raiseTo;
    btn('raise').dataset.to=raiseTo;
    btn('allin').hidden=!canRaise;
    row.hidden=false; main.hidden=true; status('Your move');
    say('YOUR MOVE',toCall>0?'TO CALL '+toCall:'CHECK OR BET');
    return new Promise(res=>{ askResolve=k=>{ row.hidden=true; main.hidden=false; askResolve=null; status('Playing'); res(k==='raise'?{ k, to:Number(btn('raise').dataset.to) }:{ k }); }; });
  }
  async function putIn(p,amount,label,allin){
    if (amount<=0) return;
    p.betThisRound+=amount; H.put[p.id]+=amount;
    if (p.isHuman) await youBet(amount,label,allin); else await oppBet(p,amount,label,allin);
  }
  // returns true if the action re-opens the betting
  async function doAct(p,act){
    const toCall=Math.max(0,H.cur-p.betThisRound);
    if (act.k==='fold'){ p.folded=true; foldLook(p); say(nameOf(p),'FOLD','act-fold',p); if (p.isHuman) showHandText(); return false; }
    if (act.k==='check' || (act.k==='call' && toCall===0)){ say(nameOf(p),'CHECK','',p); return false; }
    let to=act.k==='call'?H.cur:(act.k==='allin'?p.betThisRound+p.chips:act.to);
    const put=Math.max(0,Math.min(p.chips,to-p.betThisRound)); to=p.betThisRound+put;
    const allin=put>=p.chips, raised=to>H.cur;
    const label=allin?'All-In':(raised?(H.cur?'Raise '+to:'Bet '+to):'Call '+put);
    if (raised){ H.minRaise=Math.max(H.minRaise,to-H.cur); H.cur=to; H.raises++; }
    await putIn(p,put,label,allin);
    return raised;
  }
  async function bettingRound(first){
    const my=gen;
    let need=new Set(P.filter(canAct)), i=first;
    while (need.size && liveCount()>1){
      const p=P[i%P.length]; i++;
      if (!need.has(p)) continue;
      need.delete(p);
      const toCall=Math.max(0,H.cur-p.betThisRound);
      if (toCall===0 && !P.some(q=>q!==p && canAct(q))) continue;       // nobody left to bet against
      const act=p.isHuman?await askYou():decide(p);
      guard(my);
      if (await doAct(p,act)) need=new Set(P.filter(q=>q!==p && canAct(q)));
      guard(my);
      await waitMs(p.isHuman?120:300); guard(my);
    }
  }
  async function endStreet(){
    const my=gen;
    if (Object.keys(zones).some(k=>k.startsWith('spot:') && (zones[k].list.length || zones[k].amount>0))){ await waitMs(250); guard(my); await sweep(); guard(my); }
    P.forEach(p=>{ p.betThisRound=0; });
    H.cur=0; H.minRaise=BB; H.raises=0;
  }
  function sidePots(){
    const live=P.filter(p=>!p.folded), levels=[...new Set(live.map(p=>H.put[p.id]))].sort((a,b)=>a-b), out=[];
    let prev=0;
    levels.forEach(L=>{
      let amt=0; P.forEach(p=>{ amt+=Math.max(0,Math.min(H.put[p.id],L)-prev); });
      if (amt>0) out.push({ amt, elig:live.filter(p=>H.put[p.id]>=L) });
      prev=L;
    });
    let extra=0; P.forEach(p=>{ extra+=Math.max(0,H.put[p.id]-prev); });
    if (extra && out.length) out[out.length-1].amt+=extra;
    return out;
  }
  async function showdown(){
    const my=gen, live=P.filter(p=>!p.folded), res={}, award={};
    if (live.length===1){ award[live[0].id]=potValue; }
    else {
      say('SHOWDOWN','');
      live.forEach(p=>{ if (!p.isHuman) syncCardRow(seatEls[p.id].cardsContainer,p.hand,[false,false],true,'hole'); res[p.id]=evaluate7([...p.hand,...H.board]); });
      await waitMs(900); guard(my);
      sidePots().forEach(pt=>{
        let best=[];
        pt.elig.forEach(p=>{ const c=best.length?compareHands(res[p.id],res[best[0].id]):1; if (c>0) best=[p]; else if (c===0) best.push(p); });
        const each=Math.floor(pt.amt/best.length/10)*10;
        best.forEach((p,i)=>{ award[p.id]=(award[p.id]||0)+(i===0?pt.amt-each*(best.length-1):each); });
      });
    }
    // winners paid one by one, opponents first, you last; each takes its
    // share of the pot's coins from its own side of the tray
    const order=Object.keys(award).filter(id=>award[id]>0).map(id=>P.find(p=>p.id===id)).sort((a,b)=>(a.isHuman?1:0)-(b.isHuman?1:0));
    let coins=zones.pot.list.slice().sort((a,b)=>a.x-b.x), left=potValue;
    for (let i=0;i<order.length;i++){
      const w=order[i], a=award[w.id], last=i===order.length-1;
      const k=last?coins.length:Math.round(coins.length*a/Math.max(1,left));
      const mine=w.isHuman?coins.splice(coins.length-k,k):coins.splice(0,k); left-=a;
      const label=res[w.id]?describeMade(res[w.id]).toUpperCase():a.toLocaleString();
      if (w.isHuman) await payYou(a,mine,label); else await payOpp(w,a,mine,label);
      guard(my); await waitMs(300); guard(my);
    }
  }
  async function playHand(){
    const my=gen, n=P.length;
    newHand(); await waitMs(600); guard(my);
    const at=k=>(H.dealer+k)%n;
    const sb=P[at(1)], bb=P[at(2)];
    await putIn(sb,Math.min(BB/2,sb.chips),'Small blind',sb.chips<=BB/2); guard(my); await waitMs(200); guard(my);
    await putIn(bb,Math.min(BB,bb.chips),'Big blind',bb.chips<=BB); guard(my); await waitMs(250); guard(my);
    H.cur=BB; H.minRaise=BB; H.raises=0;
    await bettingRound(at(3)); guard(my);
    for (const [name,k] of [['FLOP',3],['TURN',1],['RIVER',1]]){
      if (liveCount()<=1) break;
      await endStreet(); guard(my);
      for (let j=0;j<k;j++) H.board.push(H.deck.pop());
      syncCardRow($('board'),H.board,H.board.map(()=>false),false,'board');
      say('DEALER',name); showHandText();
      await waitMs(700); guard(my);
      if (P.filter(canAct).length>=2) await bettingRound(at(1));
      guard(my);
    }
    await endStreet(); guard(my);
    await showdown();
  }
  const BOARD5=['Qh','Jh','3d','8c','2s'].map(card);
  function cycleBoard(){
    const n=[3,4,5,0][([3,4,5,0].indexOf($('board').children.length)+1)%4];
    game.board=BOARD5.slice(0,n);
    syncCardRow($('board'),game.board,game.board.map(()=>false),false,'board');
    say('BOARD',n?n+' CARDS':'EMPTY');
  }

  const OPPS=['maniac','wild','prof','shark'];
  async function run(kind){
    closeDrawer();
    if (kind==='replay'){ if (!lastRun) return; setup(); await waitMs(150); kind=lastRun; }
    else if (kind==='reset'){ setup(); return; }
    else if (busy) return;
    lastRun=kind;
    const my=gen;
    busy=true; status('Playing'); markBar(kind);
    try{
      const pl=id=>P.find(p=>p.id===id);
      const next=()=>pl(OPPS[oppTurn++%OPPS.length]);
      if (kind==='opp-call') await oppBet(next(),20,'Call 20');
      else if (kind==='opp-bet') await oppBet(next(),180,'Raise 180');
      else if (kind==='opp-big') await oppBet(next(),400,'Raise 400');
      else if (kind==='opp-allin'){ const p=pl('maniac'); await oppBet(p,p.chips||1000,'All-In',true); }
      else if (kind==='you-call') await youBet(20,'Call 20');
      else if (kind==='you-bet') await youBet(180,'Call 180');
      else if (kind==='you-allin') await youBet(P[0].chips,'All-In',true);
      else if (kind==='sweep') await sweep();
      else if (kind==='toss-test') await tossTest();
      else if (kind==='play') await playHand();
      else if (kind==='board') cycleBoard();
      else if (kind==='pay-you') await payYou();
      else if (kind==='pay-opp') await payOpp(pl('maniac'));
      else if (kind==='street'){
        await oppBet(pl('wild'),60,'Bet 60'); await waitMs(160); guard(my);
        await oppBet(pl('maniac'),400,'Raise 400'); await waitMs(160); guard(my);
        await youBet(400,'Call 400'); await waitMs(140); guard(my);
        await oppBet(pl('prof'),20,'Call 20'); await waitMs(140); guard(my);
        await oppBet(pl('wild'),340,'Call 400'); await waitMs(380); guard(my);
        await sweep();
      }
      else if (kind==='showdown'){
        await oppBet(pl('maniac'),pl('maniac').chips||1000,'All-In',true); await waitMs(220); guard(my);
        await youBet(P[0].chips,'All-In',true); await waitMs(380); guard(my);
        await sweep(); await waitMs(420); guard(my);
        await payYou();
      }
      if (my===gen) status(kind==='play'?'Hand over · play another':(OPT.after==='tap'?'Done · tap the felt to tidy':'Done · ↻ to replay'));
    } catch(e){ if (e.message!=='cancelled'){ console.error(e); status('Error'); } }
    if (my===gen){ busy=false; markBar(null); }
  }

  /* ---------------- lab chrome: bottom bar + drawer ---------------- */
  function status(s){ const el=$('ct-status'); if (el) el.textContent=s.toUpperCase(); }
  function markBar(kind){ document.querySelectorAll('.ct-bar [data-run]').forEach(b=>b.classList.toggle('is-live',b.dataset.run===kind)); }
  function closeDrawer(){ $('ct-drawer').hidden=true; $('ct-gear').classList.remove('is-on'); }
  function syncPanel(){
    document.querySelectorAll('.cl-seg').forEach(seg=>{
      const k=seg.dataset.opt;
      seg.querySelectorAll('button').forEach(b=>b.classList.toggle('is-on',String(OPT[k])===b.dataset.v));
    });
    $('ct-note').textContent=NOTES[OPT.preset];
    $('ct-preset-name').textContent=OPT.preset.toUpperCase();
  }
  function unlockAudio(){ Coin.unlock(); try{ if (Sound && Sound.unlock) Sound.unlock(); }catch(e){} }
  function setOpt(k,v){
    if (k==='preset'){ OPT.preset=v; OPT.eased=false; Object.assign(OPT,PRESETS[v]); }
    else { OPT[k]=k==='speed'?Number(v):v; if (!['speed','sound','random'].includes(k)){ OPT.preset='custom'; OPT.eased=false; } }
    settings.sound=OPT.sound==='on';
    syncPanel();
    if (['source','preset','art','size','after','body','tray','nums','coins'].includes(k)) setup();
    if (k==='light' || k==='body'){ Object.keys(spinCache).forEach(x=>delete spinCache[x]); }
  }
  function wire(){
    document.querySelectorAll('.cl-seg').forEach(seg=>seg.addEventListener('click',ev=>{
      const b=ev.target.closest('button'); if (!b) return;
      setOpt(seg.dataset.opt,b.dataset.v);
    }));
    document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.run)));
    document.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>{ if (askResolve) askResolve(b.dataset.act); }));
    $('ct-gear').addEventListener('click',()=>{ const d=$('ct-drawer'); d.hidden=!d.hidden; $('ct-gear').classList.toggle('is-on',!d.hidden); });
    window.addEventListener('resize',()=>{ clearTimeout(wire.t); wire.t=setTimeout(()=>{ if (!busy) setup(); },300); });
  }

  /* Desktop: the production table is built to fill a phone screen, so on
     a wide window this page hosts itself in a phone-sized frame (scaled
     to fit the window height) and keeps every trigger and option visible
     beside it, driving the framed lab through its __chipThrowLab API. */
  function desktop(){
    document.body.classList.add('ct-desk-mode');
    $('app').remove();
    const wrap=document.createElement('div'); wrap.className='ct-desk';
    const stage=document.createElement('div'); stage.className='ct-desk-stage';
    const frame=document.createElement('iframe'); frame.className='ct-desk-frame'; frame.title='Chip Throw Lab table';
    frame.setAttribute('allow','autoplay');
    const u=new URL(location.href); u.searchParams.set('embed','1'); frame.src=u.toString();
    stage.appendChild(frame);
    const side=document.createElement('div'); side.className='ct-desk-side';
    const hint=document.createElement('p'); hint.className='ct-desk-hint';
    hint.textContent='Phone-sized table on the left (scaled to fit). Tap the bank to tidy it; with MESS·TAP, click the felt.';
    const bar=document.querySelector('.ct-bar'), drawer=$('ct-drawer');
    drawer.hidden=false; $('ct-gear').hidden=true;
    side.append(bar,drawer,hint);
    wrap.append(stage,side); document.body.appendChild(wrap);
    const fit=()=>{
      const sc=Math.min(1,(innerHeight-24)/844,Math.max(.4,(innerWidth-440)/390));
      stage.style.width=Math.round(390*sc)+'px'; stage.style.height=Math.round(844*sc)+'px';
      frame.style.transform='scale('+sc+')';
    };
    fit(); addEventListener('resize',fit);
    const api=()=>{ try{ return frame.contentWindow.__chipThrowLab; }catch(e){ return null; } };
    side.addEventListener('click',ev=>{
      const b=ev.target.closest('button'), a=api(); if (!b || !a) return;
      if (a.unlock) a.unlock();
      if (b.dataset.run){ a.run(b.dataset.run); return; }
      if (b.dataset.act){ a.act(b.dataset.act); return; }
      const seg=b.closest('.cl-seg');
      if (seg){ a.set(seg.dataset.opt,b.dataset.v); Object.assign(OPT,a.OPT); syncPanel(); }
    });
    let synced=false;
    setInterval(()=>{
      const a=api(); if (!a) return;
      if (!synced){ synced=true; Object.assign(OPT,a.OPT); syncPanel(); }
      try{
        const fd=frame.contentDocument;
        status(fd.getElementById('ct-status').textContent); markBar(a.busy()?a.last():null);
        // the play row (your move) lives in the frame: mirror it here
        const src=fd.getElementById('ct-play'), dst=$('ct-play');
        if (src && dst){
          if (dst.innerHTML!==src.innerHTML) dst.innerHTML=src.innerHTML;
          dst.hidden=src.hidden; $('ct-main').hidden=!src.hidden;
        }
      }catch(e){}
    },200);
  }

  async function init(){
    const q=new URLSearchParams(location.search);
    const embed=q.get('embed')==='1';
    if (embed) document.body.classList.add('ct-embed');
    else if (window.matchMedia && matchMedia('(min-width:760px)').matches){ syncPanel(); desktop(); return; }
    if (q.get('preset') && PRESETS[q.get('preset')]){ OPT.preset=q.get('preset'); Object.assign(OPT,PRESETS[OPT.preset]); }
    Object.keys(OPT).forEach(k=>{ if (q.get(k) && k!=='preset') OPT[k]=k==='speed'?Number(q.get(k)):q.get(k); });
    CW.hooks.mouth=dropIntoBank;
    await mountTable();
    syncPanel(); wire();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    setup();
    document.addEventListener('pointerdown',unlockAudio,{ capture:true });
    window.__chipThrowLab={ run:(k)=>{ unlockAudio(); return run(k); }, unlock:unlockAudio, act:k=>{ if (askResolve) askResolve(k); }, asking:()=>!!askResolve, hand:()=>H&&{ board:H.board.length, put:{ ...H.put }, cur:H.cur, chips:P.map(p=>p.chips), folded:P.map(p=>p.folded), pot:potValue }, OPT, setup, set:setOpt, last:()=>lastRun, busy:()=>busy, walls:CW.walls,
      state:()=>({ bank:bank.chips.length, pot:zones.pot.list.length, potNeat:zones.pot.neat, active:active.size,
        air:CW.airLayer()?CW.airLayer().querySelectorAll('.cl-chip').length:0, you:P[0].chips,
        spots:Object.keys(zones).filter(k=>k.startsWith('spot:')).map(k=>k.slice(5)+':'+zones[k].list.length).join(' ') }),
      // where every resting chip on the felt is, for checks
      bodies:()=>Object.values(zones).flatMap(z=>z.list.map(b=>({ zone:z.id, x:b.x, y:b.y, z:b.z, d:b.d, state:b.state }))),
      blocked:()=>Object.values(zones).flatMap(z=>z.list).filter(b=>b.state==='rest' && b.z<1 && inBlock(b.x,b.y,b.d)).length,
      offFelt:()=>{ const F=CW.walls().felt; return Object.values(zones).flatMap(z=>z.list).filter(b=>b.x<F.L||b.x>F.R||b.y<F.T||b.y>F.B+1).length; },
      stuck:()=>CW.stats().stuck, stuckLog:()=>CW.stats().log,
      hiddenWaiting:()=>Array.from(document.querySelectorAll('.ct-air .cl-chip')).filter(el=>el.style.visibility==='hidden').length,
      spinStrip:(axis,N,d)=>Array.from({length:N},(_,k)=>spinFrame(d||D(),axis,k,N)),
      orphans:()=>{ const inZones=new Set(Object.values(zones).flatMap(z=>z.list.map(b=>b.el))); return Array.from(document.querySelectorAll('.ct-air .cl-chip')).filter(el=>!inZones.has(el)).length; },
      overlapPairs:()=>{ const out=[]; Object.values(zones).forEach(z=>{ const L=z.list.filter(b=>b.state==='rest'); for (let i=0;i<L.length;i++) for (let j=i+1;j<L.length;j++){ const a=L[i], c=L[j]; if (Math.abs(a.z-c.z)<=STEP()*.8 && Math.hypot(a.x-c.x,(a.y-c.y)*1.4)<a.d*.88) out.push([z.id,Math.round(a.x),Math.round(a.y),Math.round(a.z),Math.round(c.x),Math.round(c.y),Math.round(c.z),a.d,c.d].join(',')); } }); return out; },
      // resting coins at the same height sitting inside each other
      overlaps:()=>{ let n=0; Object.values(zones).forEach(z=>{ const L=z.list.filter(b=>b.state==='rest'); for (let i=0;i<L.length;i++) for (let j=i+1;j<L.length;j++){ const a=L[i], c=L[j]; if (Math.abs(a.z-c.z)<=STEP()*.8 && Math.hypot(a.x-c.x,(a.y-c.y)*1.4)<a.d*.88) n++; } }); return n; },
      // resting coins still drawn squashed/stretched
      stretched:()=>Object.values(zones).flatMap(z=>z.list).filter(b=>b.state==='rest' && /scale\(([\d.]+),([\d.]+)\)/.test(b.el.style.transform) && (()=>{ const m=b.el.style.transform.match(/scale\(([\d.]+),([\d.]+)\)/); return Math.abs(m[1]-m[2])>.02; })()).length,
      spotMiss:id=>{ const z=zones['spot:'+id]; return z.list.map(b=>Math.round(Math.hypot(b.x-z.cx,b.y-z.cy))); } };
  }
  init().catch(err=>{ console.error('[chip-throw-lab]',err); status('Failed to mount — serve over http'); });
})();
