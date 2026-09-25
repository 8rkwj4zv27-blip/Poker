/* ============================================================
   CHIP THROW LAB — how chips travel (docs/ui/CHIP_PLAN.md).

   The owner's note on chip-lab: many chips launched one after another on
   smooth, swaying arcs read as a liquid pouring out of the seat ("vomit").
   The brief: keep LOTS of chips, make every one feel like a real, heavy
   piece. This lab is one small physics engine with every idea as a switch:

     throw    stream (today) / handfuls / splash
     timing   even / irregular
     air      eased (today) / gravity: a true ballistic arc, the chip
              flipping end over end and landing flat
     shadow   each chip's own shadow on the felt, shrinking with height
     landing  settle / bounce + skid, with the odd roller on its edge
     react    chips already in a pile get knocked by a landing
     source   opponents' chips from the face (today) / the table edge /
              a chute in the felt under the seat
     sweep    stream (today) / push: each bet spot slides in as a group
     frames   smooth / stepped at 12fps

   Same production table mount as chip-lab (the real #table-screen and
   renderers on memory-only state). Presentation only; nothing is saved.
   ============================================================ */
(function(){
  'use strict';

  const OPT = { preset:'weight', throw:'handful', timing:'irregular', air:'gravity', shadow:'on', land:'bounce',
    roll:'on', react:'on', source:'chute', sweep:'push', frames:'smooth', speed:1, sound:'on' };
  const PRESETS = {
    today:  { throw:'stream',  timing:'even',      air:'eased',   shadow:'off', land:'settle', roll:'off', react:'off', source:'face',  sweep:'stream', frames:'smooth' },
    weight: { throw:'handful', timing:'irregular', air:'gravity', shadow:'on',  land:'bounce', roll:'on',  react:'on',  source:'chute', sweep:'push',   frames:'smooth' },
    splash: { throw:'splash',  timing:'irregular', air:'gravity', shadow:'on',  land:'bounce', roll:'on',  react:'on',  source:'edge',  sweep:'push',   frames:'smooth' },
    machine:{ throw:'handful', timing:'even',      air:'gravity', shadow:'on',  land:'settle', roll:'off', react:'on',  source:'chute', sweep:'push',   frames:'stepped' }
  };
  const PRESET_NOTES = {
    today:'What the game does now: one chip at a time on smooth swaying arcs, out of the face. For reference.',
    weight:'Recommended. Handfuls with uneven gaps, real gravity arcs with shadows, chips flip and land flat, bounce, skid, the odd roller, the pile gets knocked. Opponents\' chips come out of a chute in the felt.',
    splash:'Everything thrown at once on flights of different lengths: chips arrive in a burst, bounce, skid and knock into each other. Messy, but solid-messy.',
    machine:'Handfuls on gravity arcs, but the motion steps at 12fps like the rest of the machine, and chips land dead with no bounce.',
    custom:'Your own mix.'
  };

  /* ---------------- chips (weighted colour language, chip-lab option C) ---------------- */
  const COLOURS=['d-white','d-red','d-blue','d-green','d-black','d-purple','d-yellow'];
  const BB=20;
  let seed=7;
  function rnd(){ seed=(seed*1103515245+12345)>>>0; return (seed>>>8)/0x1000000; }
  const rint=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  function coloursFor(amount){
    const n=visualChipCount(amount), out=[];
    const centre=Math.max(0,Math.min(6,Math.log(Math.max(.5,amount/BB))/Math.log(3.2)));
    for (let i=0;i<n;i++){ const r=rnd(); out.push(COLOURS[Math.max(0,Math.min(6,Math.round(centre)+(r<.55?0:r<.85?-1:1)))]); }
    return out;
  }
  function makeChip(colour){
    const el=document.createElement('div');
    el.className='chip-disc cl-chip '+colour+' v-'+rint(1,3);
    return { el, colour, jx:rint(-1,1), lean:rint(-1,1), loose:true };
  }

  /* ---------------- piles (from chip-lab; positions also carry lz,
     the chip's height on its stack, which is where a flight lands) ---------------- */
  class Pile{
    constructor(el,kind,opts){ this.el=el; this.kind=kind; this.chips=[]; this.opts=opts||{}; this.clumps=[]; }
    get diam(){ return this.opts.diam||25; }
    get step(){ return this.opts.step||3; }
    size(){ const r=this.el.getBoundingClientRect(); return { w:r.width, h:r.height }; }
    layout(){ return this.kind==='bank' ? this.bankLayout() : this.stackLayout(); }
    slots(){
      const { w }=this.size(), d=this.diam, gap=this.opts.gap!=null?this.opts.gap:2;
      const sp=d+gap, cols=Math.max(1,Math.min(this.opts.maxCols||9,Math.floor(w/sp)));
      const cx=w/2-d/2, out=[], order=[0];
      for (let i=1;i<cols;i++) order.push(i%2?Math.ceil(i/2):-i/2);
      order.forEach((o,i)=>{
        out.push({ x:Math.round(cx+o*sp), y:0, z:40 });
        if (i<cols-1) out.push({ x:Math.round(cx+o*sp+(o<0?-sp/2:sp/2)), y:this.opts.backDy||7, z:20 });
      });
      return out;
    }
    stackLayout(){
      const slots=this.slots(), cap=this.opts.cap||9, stacks=[], pos=[];
      this.chips.forEach(c=>{
        let s=null;
        for (let i=stacks.length-1;i>=0;i--){ if (stacks[i].key===c.colour && stacks[i].n<cap){ s=stacks[i]; break; } }
        if (!s){
          if (stacks.length<slots.length){ s={ key:c.colour, slot:slots[stacks.length], n:0 }; stacks.push(s); }
          else s=stacks.reduce((a,b)=>b.n<a.n?b:a);
        }
        pos.push({ x:s.slot.x+c.jx, y:s.slot.y+s.n*this.step, z:s.slot.z+s.n, lz:s.n*this.step });
        s.n++;
      });
      return pos;
    }
    heapLayout(chips){
      const { w,h }=this.size(), d=this.diam, floor=Math.min(h*.62,10+chips.length*.55), pos=[];
      chips.forEach(c=>{
        if (!c.clump || !this.clumps.includes(c.clump)){
          let cl=this.clumps.find(k=>k.n<k.cap && k.open);
          if (!cl){ this.clumps.forEach(k=>k.open=false); cl={ x:rint(1,Math.max(1,Math.round(w-d-1))), y:rint(2,Math.round(floor)), n:0, cap:rint(2,6), open:true }; this.clumps.push(cl); }
          c.clump=cl; c.ci=cl.n; cl.n++;
        }
        const cl=c.clump;
        pos.push({ x:cl.x+c.lean*Math.min(2,c.ci), y:cl.y+c.ci*this.step, z:Math.round((h-cl.y)*4)+c.ci, lz:c.ci*this.step });
      });
      return pos;
    }
    rackLayout(chips){
      const { w,h }=this.size(), d=this.diam, sp=d+3;
      const cols=Math.max(1,Math.floor((w-4)/sp)), x0=Math.round((w-cols*sp)/2+1.5);
      const sorted=chips.slice().sort((a,b)=>COLOURS.indexOf(b.colour)-COLOURS.indexOf(a.colour));
      const by={}; sorted.forEach(c=>{ by[c.colour]=(by[c.colour]||0)+1; });
      const need=k=>Object.values(by).reduce((a,n)=>a+Math.ceil(n/k),0);
      const hard=Math.max(4,Math.floor((h-d-14)/this.step)+1);
      let cap=12; while (cap<hard && need(cap)>cols*2) cap+=2;
      const pos=new Map(); let col=-1, n=cap, last=null;
      sorted.forEach(c=>{
        if (c.colour!==last || n>=cap){ col++; n=0; last=c.colour; }
        const row=Math.floor(col/cols);
        pos.set(c,{ x:x0+(col%cols)*sp+(row?Math.round(sp/2):0), y:4+row*9+n*this.step, z:(row?10:60)+n, lz:n*this.step });
        n++;
      });
      return pos;
    }
    bankLayout(){
      const racked=this.chips.filter(c=>!c.loose), loose=this.chips.filter(c=>c.loose);
      const m=this.rackLayout(racked), hp=this.heapLayout(loose);
      const hm=new Map(loose.map((c,i)=>[c,{ ...hp[i], z:hp[i].z+200 }]));
      return this.chips.map(c=>m.get(c)||hm.get(c));
    }
    apply(opts){
      opts=opts||{};
      const pos=this.layout(), d=this.diam;
      this.chips.forEach((c,i)=>{
        const p=pos[i]; if (!p || c.flying) return;
        const el=c.el;
        const before=(!opts.snap && el.parentNode===this.el && !motionOff()) ? el.getBoundingClientRect() : null;
        if (el.parentNode!==this.el) this.el.appendChild(el);
        el.style.width=d+'px'; el.style.height=d+'px'; el.style.left=p.x+'px'; el.style.bottom=p.y+'px'; el.style.top='';
        el.style.zIndex=String(p.z); el.style.transform='';
        el.classList.toggle('cl-base', !pos.some((q,j)=>j!==i && q && Math.abs(q.x-p.x)<=3 && q.y<p.y && p.y-q.y<d));
        if (before){
          const a=el.getBoundingClientRect(), dx=before.left-a.left, dy=before.top-a.top;
          if (Math.abs(dx)>.5 || Math.abs(dy)>.5) el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{ duration:(opts.slideMs||240)/OPT.speed+(opts.stagger?i*opts.stagger:0), easing:opts.easing||'cubic-bezier(.3,.7,.25,1)' });
        }
      });
    }
    // Reserve the resting place for c; returns where a flight must land.
    reserve(c){
      c.flying=true; this.chips.push(c);
      const p=this.layout()[this.chips.length-1], r=this.el.getBoundingClientRect();
      const left=r.left+p.x, top=r.bottom-p.y-this.diam;
      return { gx:left+this.diam/2, gy:top+this.diam+p.lz, z:p.lz, d:this.diam, pile:this };
    }
    take(){
      if (!this.chips.length) return null;
      const pos=this.layout(); let best=-1, by=-1e9;
      this.chips.forEach((c,i)=>{
        if (c.flying) return;
        const covered=pos.some((q,j)=>j!==i && q && Math.abs(q.x-pos[i].x)<=3 && q.y>pos[i].y && q.y-pos[i].y<this.diam);
        if (!covered && pos[i].y>by){ by=pos[i].y; best=i; }
      });
      if (best<0) return null;
      const c=this.chips[best];
      const r=c.el.getBoundingClientRect();
      this.chips.splice(best,1);
      if (c.clump){ c.clump.n--; c.clump=null; }
      return { c, from:{ gx:r.left+r.width/2, gy:r.bottom, z:0, d:r.width } };
    }
    // A landing knocks the chips it lands near: a pixel or two, then back.
    jostle(gx,gy,power){
      if (OPT.react!=='on' || motionOff()) return;
      let n=0;
      for (const c of this.chips){
        if (c.flying || n>=5) continue;
        const r=c.el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.bottom;
        const dist=Math.hypot(cx-gx,cy-gy); if (dist>38) continue;
        const k=Math.max(1,Math.round((power||1)*(2-dist/30)));
        const dx=Math.sign(cx-gx||rnd()-.5)*k, dy=-Math.min(2,k);
        c.el.animate([{transform:'none'},{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{ duration:150/OPT.speed, easing:'steps(3,end)' });
        n++;
      }
    }
    clear(){ this.chips.forEach(c=>c.el.remove()); this.chips=[]; this.clumps=[]; }
  }

  /* ---------------- sound ---------------- */
  const soundAt={};
  function sfx(kind,power){
    if (OPT.sound!=='on') return;
    const now=performance.now(), gap={ land:26, bounce:34, roll:90, chute:40, collect:60 }[kind]||30;
    if (now-(soundAt[kind]||0)<gap) return; soundAt[kind]=now;
    if (kind==='land') Sound.chipLand();
    else if (kind==='bounce') Sound.chipBounce(power||.5);
    else if (kind==='roll') Sound.chipBounce(.18);
    else if (kind==='collect') Sound.chipCollect(power||.5);
    else if (kind==='chute') Sound.chipBounce(.35);
    else if (kind==='hatch') Sound.hatchOpen();
    else if (kind==='hatchClose') Sound.hatchClose();
    else if (kind==='tooth') Sound.wheelTooth(.6,false);
    else if (kind==='lock') Sound.counterLock(true);
  }

  /* ============================================================
     THE ENGINE. A flight is a chip in the air layer with a ground
     position (gx,gy: where it would touch the felt) and a height z above
     it. The sprite draws at gy-z; its shadow stays on the felt at gy.
     One rAF loop steps every flight; with frames=stepped it only redraws
     at 12fps, like the machine's other motion.
     ============================================================ */
  const G=2600;                         // px/s² of screen gravity
  let airLayer=null, shadowLayer=null, raf=0, lastT=0, lastBucket=-1;
  const flights=new Set();
  const ease={ inOut:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, out:t=>1-Math.pow(1-t,3) };

  function ensureLayers(){
    if (airLayer) return;
    shadowLayer=document.createElement('div'); shadowLayer.className='ct-shadows'; document.body.appendChild(shadowLayer);
    airLayer=document.createElement('div'); airLayer.className='ct-air'; document.body.appendChild(airLayer);
  }
  function loop(now){
    const dt=Math.min(.04,(now-lastT)/1000)*OPT.speed; lastT=now;
    const bucket=OPT.frames==='stepped'?Math.floor(now/83):now, redraw=bucket!==lastBucket; lastBucket=bucket;
    for (const f of Array.from(flights)){
      if (f.wait>0){ f.wait-=dt*1000; continue; }
      if (!f.started) begin(f);
      step(f,dt);
      if (f.done) finish(f); else if (redraw) draw(f);
    }
    raf=flights.size?requestAnimationFrame(loop):0;
  }
  function kick(){ if (!raf){ lastT=performance.now(); raf=requestAnimationFrame(loop); } }

  /* fly(chip, from, to, opts) -> Promise that resolves once the chip rests.
     from/to: { gx, gy, z, d }. to.pile: rest in that pile. to.vanish: drop
     out of sight on arrival. opts: T (s), wait (ms), mode override. */
  function fly(c,from,to,opts){
    opts=opts||{};
    ensureLayers();
    return new Promise(resolve=>{
      if (motionOff()){ land(c,to); resolve(); return; }
      const f={ c, from, to, opts, resolve, gx:from.gx, gy:from.gy, z:from.z||0, d:from.d, d0:from.d, t:0,
        wait:opts.wait||0, sx:1, sy:1, rot:0, phi:0, host:airLayer, ox:0, oy:0, bounced:false, started:false };
      c.flying=true;
      c.el.style.cssText='';
      c.el.style.left='0px'; c.el.style.top='0px'; c.el.style.bottom='auto';
      c.el.style.width=from.d+'px'; c.el.style.height=from.d+'px'; c.el.style.margin='0';
      c.el.classList.remove('cl-base');
      airLayer.appendChild(c.el);
      if (OPT.shadow==='on' && !opts.noShadow){ f.sh=document.createElement('i'); f.sh.className='ct-shadow'; f.sh.style.visibility='hidden'; shadowLayer.appendChild(f.sh); }
      if (f.wait>0) c.el.style.visibility='hidden';
      draw(f);
      flights.add(f); kick();
    });
  }
  function begin(f){
    f.started=true; f.c.el.style.visibility=''; if (f.sh) f.sh.style.visibility='';
    if (f.opts.onStart) f.opts.onStart();
    const mode=f.opts.mode || (OPT.air==='gravity'?'air':'eased');
    const dx=f.to.gx-f.gx, dy=f.to.gy-f.gy, dist=Math.hypot(dx,dy);
    f.dist=dist;
    if (mode==='eased'){
      f.phase='eased'; f.T=f.opts.T||Math.min(.76,Math.max(.4,.38+dist/1100));
      f.hop=-(10+Math.min(26,dist*.06)+rnd()*6); f.spin=(rnd()<.5?-1:1)*(20+rnd()*40);
      f.lane=((f.opts.i||0)%5-2)*Math.min(8,dist*.02); f.x0=f.gx; f.y0=f.gy; f.z0=f.z;
    } else if (mode==='slide'){
      f.phase='slide'; f.T=f.opts.T||Math.max(.28,.3+dist/1500); f.x0=f.gx; f.y0=f.gy; f.z0=f.z; f.lift=f.opts.lift!=null?f.opts.lift:3;
    } else {
      launchBallistic(f, f.opts.T || flightT(dist));
    }
  }
  // Aim a true ballistic arc. With bouncing on, aim a little short so the
  // bounce and skid carry the chip onto its exact resting place.
  function launchBallistic(f,T){
    f.phase='air'; f.T=T; f.t=0;
    const bounce=OPT.land==='bounce' && !f.to.noBounce;
    let ax=f.to.gx, ay=f.to.gy;
    if (bounce && f.dist>20){
      const skid=Math.min(24,f.dist*.12)+6;
      ax-= (f.to.gx-f.gx)/f.dist*skid; ay-=(f.to.gy-f.gy)/f.dist*skid;
    }
    f.vx=(ax-f.gx)/T; f.vy=(ay-f.gy)/T;
    f.vz=((f.to.z||0)-f.z)/T+.5*G*T;
    // Flip end over end a whole number of half-turns: always lands flat.
    f.phiRate=(f.opts.noFlip?0:rint(1,3))*Math.PI/T; f.phi=0;
  }
  function step(f,dt){
    f.t+=dt;
    const to=f.to;
    switch(f.phase){
      case 'eased':{
        const k=Math.min(1,f.t/f.T), e=ease.inOut(k), nx=-(to.gy-f.y0)/Math.max(1,f.dist), ny=(to.gx-f.x0)/Math.max(1,f.dist);
        const sw=f.lane*Math.sin(Math.PI*k);
        f.gx=f.x0+(to.gx-f.x0)*e+nx*sw; f.gy=f.y0+(to.gy-f.y0)*e+ny*sw;
        f.z=f.z0+((to.z||0)-f.z0)*e-f.hop*Math.sin(Math.PI*Math.min(1,k*1.1));
        f.rot=f.spin*Math.sin(Math.PI*k); f.d=f.d0+(to.d-f.d0)*k;
        if (k>=1){ f.z=to.z||0; touchdown(f,true); }
        break;
      }
      case 'slide':{
        const k=Math.min(1,f.t/f.T), e=ease.inOut(k);
        f.gx=f.x0+(to.gx-f.x0)*e; f.gy=f.y0+(to.gy-f.y0)*e;
        f.z=f.z0+((to.z||0)-f.z0)*e+f.lift*Math.sin(Math.PI*k); f.d=f.d0+(to.d-f.d0)*k;
        if (k>=1){ f.z=to.z||0; f.done=true; }
        break;
      }
      case 'air':{
        f.gx+=f.vx*dt; f.gy+=f.vy*dt; f.vz-=G*dt; f.z+=f.vz*dt; f.phi+=f.phiRate*dt;
        if (!f.bounced) f.d=f.d0+(to.d-f.d0)*Math.min(1,f.t/f.T);
        f.sy=Math.max(.18,Math.abs(Math.cos(f.phi)));
        if ((f.bounced || f.t>=f.T) && f.z<=(to.z||0) && f.vz<0){ f.z=to.z||0; f.sy=1; touchdown(f,false); }
        break;
      }
      case 'skid':{
        const k=Math.min(1,f.t/f.T), e=ease.out(k);
        f.gx=f.x0+(to.gx-f.x0)*e; f.gy=f.y0+(to.gy-f.y0)*e;
        if (k>=1) f.done=true;
        break;
      }
      case 'roll':{
        // On its edge: a curving roll with a growing wobble, then it falls flat.
        const k=Math.min(1,f.t/f.T), e=ease.out(k), u=1-e;
        f.gx=u*u*f.x0+2*u*e*f.cx+e*e*to.gx; f.gy=u*u*f.y0+2*u*e*f.cy+e*e*to.gy;
        f.sx=.3+.06*Math.sin(f.t*22); f.rot=(4+14*k)*Math.sin(f.t*(14-6*k))*f.rdir; f.z=(to.z||0)+2;
        if (Math.floor(f.t*9)!==f.lastTick){ f.lastTick=Math.floor(f.t*9); if (k<.9) sfx('roll'); }
        if (k>=1){ f.phase='flat'; f.t=0; }
        break;
      }
      case 'flat':{
        const k=Math.min(1,f.t/.09); f.sx=k<.5?.55:1; f.rot*=.5; f.z=to.z||0;
        if (k>=1){ f.sx=1; f.rot=0; sfx('land'); f.done=true; }
        break;
      }
      case 'fall':{
        // Inside the bank: dropped through the hatch, falling to the tray.
        f.gx+=f.vx*dt; f.vz-=G*dt; f.z+=f.vz*dt;
        if (f.z<=(to.z||0) && f.vz<0){
          f.z=to.z||0;
          if (OPT.land==='bounce' && !f.bounced && Math.abs(f.vz)>120){ f.bounced=true; f.vz=Math.abs(f.vz)*.22; f.vx=(to.gx-f.gx)/(2*f.vz/G); sfx('bounce',.4); to.pile.jostle(to.gx,to.gy,1); }
          else { f.gx=to.gx; f.done=true; }
        }
        break;
      }
    }
  }
  function touchdown(f,eased){
    const to=f.to;
    if (to.mouth){ enterBank(f); return; }
    if (to.pile && !f.knocked){ f.knocked=true; to.pile.jostle(to.gx,to.gy,1.2); }
    const off=Math.hypot(to.gx-f.gx,to.gy-f.gy);
    if (eased || OPT.land!=='bounce' || to.noBounce){ skidTo(f, off>1?70:0); if (!eased) sfx('land'); return; }
    if (!f.bounced){
      // The odd one lands on its edge and rolls.
      if (OPT.roll==='on' && (to.z||0)<=6 && !to.noRoll && rnd()<.1){
        f.phase='roll'; f.t=0; f.T=.5+rnd()*.3; f.x0=f.gx; f.y0=f.gy; f.rdir=rnd()<.5?-1:1;
        const mx=(f.gx+to.gx)/2, my=(f.gy+to.gy)/2, len=Math.max(18,off);
        f.cx=mx-(to.gy-f.gy)/len*f.rdir*22; f.cy=my+(to.gx-f.gx)/len*f.rdir*10;
        f.gy+=0; sfx('bounce',.5); return;
      }
      f.bounced=true;
      f.vz=Math.min(240,Math.abs(f.vz)*.3);
      const tHop=2*f.vz/G;
      f.vx=(to.gx-f.gx)*.72/tHop; f.vy=(to.gy-f.gy)*.72/tHop; f.phiRate=0; f.phi=0;
      sfx('bounce',.55);
      return;
    }
    sfx('land');
    skidTo(f, 70+Math.min(150,off*5));
  }
  function skidTo(f,ms){
    if (!ms){ f.done=true; return; }
    f.phase='skid'; f.t=0; f.T=ms/1000; f.x0=f.gx; f.y0=f.gy;
  }
  // Payouts: arrive at the hatch mouth, then continue as a fall inside the
  // (clipped) bank, landing on the chip's reserved spot.
  function enterBank(f){
    const b=f.to.bank;
    const r=bank.reserve(f.c);
    const br=b.getBoundingClientRect();
    f.to=r; f.host=b; f.ox=br.left; f.oy=br.top;
    b.appendChild(f.c.el);
    if (f.sh){ f.sh.remove(); f.sh=null; }
    f.z=r.gy-f.gy+f.z; f.gy=r.gy; f.d=r.d; f.sx=1; f.sy=1; f.rot=0;
    f.phase='fall'; f.vz=Math.min(-160,(Number.isFinite(f.vz)?f.vz:-300)*.6); f.bounced=false;
    const tFall=Math.max(.08,(Math.sqrt(f.vz*f.vz+2*G*Math.max(0,f.z-r.z))+f.vz)/G);
    f.vx=(r.gx-f.gx)/tFall;
  }
  function draw(f){
    const s=f.d/f.d0*(OPT.air==='gravity'&&f.phase==='air'?1+Math.min(.14,f.z/500):1);
    const x=Math.round(f.gx-f.d0/2-f.ox), y=Math.round(f.gy-f.z-f.d/2-f.d0/2-f.oy);
    const el=f.c.el;
    el.style.transform='translate('+x+'px,'+y+'px) rotate('+f.rot.toFixed(1)+'deg) scale('+(s*f.sx).toFixed(3)+','+(s*f.sy).toFixed(3)+')';
    el.style.zIndex=String(1000+Math.round(f.gy));
    if (f.sh){
      const w=f.d*.92*(1-Math.min(.45,f.z/220)), h=w*.42;
      f.sh.style.transform='translate('+Math.round(f.gx-w/2)+'px,'+Math.round(f.gy-h*.7)+'px)';
      f.sh.style.width=Math.round(w)+'px'; f.sh.style.height=Math.round(h)+'px';
      f.sh.style.opacity=(.42*(1-Math.min(.75,f.z/180))).toFixed(2);
    }
  }
  function finish(f){
    flights.delete(f);
    if (f.sh) f.sh.remove();
    land(f.c,f.to);
    f.resolve();
  }
  function land(c,to){
    c.flying=false;
    c.el.style.transform=''; c.el.style.visibility='';
    if (to.vanish){ c.el.remove(); return; }
    if (to.mouth){ const r=bank.reserve(c); c.flying=false; to=r; }
    if (to.pile){ to.pile.apply({snap:true}); if (!motionOff()) sfx('land'); }
  }

  // Airtime grows with distance, so a short toss stays low (apex ~G·T²/8:
  // ~20px for a toss to a bet spot, ~90px for a long throw to the bank).
  const flightT=dist=>Math.min(.55,Math.max(.22,.2+dist/900));

  /* ---------------- launch rhythm ---------------- */
  // Returns a launch time (ms) and a handful index for each of n chips.
  function rhythm(n){
    const out=[], irr=OPT.timing==='irregular';
    if (OPT.throw==='splash'){ for (let i=0;i<n;i++) out.push({ t:rnd()*70, g:0 }); return out; }
    if (OPT.throw==='handful'){
      let t=0, i=0, g=0;
      while (i<n){
        const size=irr?rint(2,6):4;
        for (let k=0;k<size && i<n;k++,i++) out.push({ t:t+rint(0,24), g });
        g++; t+=irr?rint(150,300):210;
      }
      return out;
    }
    const base=n<=3?90:n<=10?60:34; let t=0;
    for (let i=0;i<n;i++){ out.push({ t, g:i }); t+=irr?base*(.35+rnd()*1.6):base; }
    return out;
  }
  // Throw a list of {c, from, to} with the current rhythm.
  function throwAll(items, extra){
    const r=rhythm(items.length), gT={};
    return Promise.all(items.map((it,i)=>{
      const g=r[i].g;
      if (!(g in gT)) gT[g]=OPT.throw==='splash' ? null : .9+rnd()*.2;   // a handful shares its flight time
      const dist=Math.hypot(it.to.gx-it.from.gx,it.to.gy-it.from.gy);
      const baseT=flightT(dist);
      const T=OPT.throw==='splash' ? baseT*(.8+rnd()*.45) : baseT*gT[g];
      return fly(it.c,it.from,it.to,{ ...(extra||{}), wait:r[i].t, T:OPT.air==='gravity'?T:undefined, i, onStart:it.onStart });
    }));
  }

  /* ---------------- the table ---------------- */
  const card=code=>({ rank:code.slice(0,-1), suit:{s:'♠',h:'♥',d:'♦',c:'♣'}[code.slice(-1)], value:RANK_VALUES[code.slice(0,-1)] });
  const HOLE={ you:['9c','7c'], prof:['Ks','4d'], wild:['Ah','5h'], shark:['8s','8d'], maniac:['Jc','10c'] };
  const BOARD=['Qh','Jh','3d'].map(card);
  let P=null, pot=null, bank=null, spots={}, chutes={}, potValue=0, busy=false, oppTurn=0;

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
    flights.forEach(f=>{ if (f.sh) f.sh.remove(); f.c.el.remove(); }); flights.clear();
    if (airLayer) airLayer.innerHTML='';
    if (shadowLayer) shadowLayer.innerHTML='';
    busy=false; seed=7; oppTurn=0;
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
    buildLayers();
    potValue=0; paintPot(0);
    coloursFor(1000).forEach(col=>bank.chips.push(makeChip(col)));
    bank.apply({snap:true});
    status('Ready');
  }

  function buildLayers(){
    const felt=$('felt'), fr=felt.getBoundingClientRect();
    felt.querySelectorAll('.cl-spot,.cl-pot,.ct-chute').forEach(el=>el.remove());
    const potEl=document.createElement('div'); potEl.className='cl-pot'; felt.appendChild(potEl);
    pot=new Pile(potEl,'stack',{ diam:25, step:3, cap:10, maxCols:9, backDy:8 });
    $('pot-area').classList.remove('hidden');
    const pr=$('pot-area').querySelector('.pot-chip').getBoundingClientRect();
    Object.assign(potEl.style,{ width:'240px', height:'70px', left:Math.round(pr.left+pr.width/2-fr.left-120)+'px', top:Math.round(pr.top-fr.top-74)+'px' });
    spots={}; chutes={};
    P.forEach(p=>{
      const el=document.createElement('div'); el.className='cl-spot'+(p.isHuman?' is-you':'');
      el.innerHTML='<div class="cl-spot-ring"></div><div class="cl-spot-chips"></div><div class="cl-spot-plate"><span>0</span></div>';
      felt.appendChild(el);
      let x,y;
      if (p.isHuman){ x=fr.width*.80; y=fr.height*.80; }
      else {
        const cr=seatEls[p.id].cardsContainer.getBoundingClientRect();
        const ax=cr.left+cr.width/2-fr.left, ay=cr.bottom-fr.top;
        const px=pr.left+pr.width/2-fr.left, py=pr.top-fr.top-40;
        x=ax+(px-ax)*.22; y=Math.max(ay+56, ay+(py-ay)*.3);
        if (OPT.source==='chute'){
          const ch=document.createElement('div'); ch.className='ct-chute';
          ch.style.left=Math.round(x)+'px'; ch.style.top=Math.round(cr.bottom-fr.top+11)+'px';
          felt.appendChild(ch); chutes[p.id]=ch;
        }
      }
      el.style.left=Math.round(x)+'px'; el.style.top=Math.round(y)+'px';
      spots[p.id]={ el, pile:new Pile(el.querySelector('.cl-spot-chips'),'stack',{ diam:19, step:3, cap:8, maxCols:3, backDy:6, gap:1 }), amount:0 };
    });
    const hl=$('hud-left');
    hl.querySelectorAll('.cl-bank,.cl-hatch,.cl-tidy-hint').forEach(el=>el.remove());
    hl.dataset.bank='tidy';
    const bankEl=document.createElement('div'); bankEl.className='cl-bank'; hl.appendChild(bankEl);
    const hatch=document.createElement('div'); hatch.className='cl-hatch'; hatch.innerHTML='<i></i><i></i>'; hl.appendChild(hatch);
    const hint=document.createElement('div'); hint.className='cl-tidy-hint'; hint.textContent='TAP TO TIDY'; hl.appendChild(hint);
    bank=new Pile(bankEl,'bank',{ diam:21, step:3 });
    hl.onclick=tidy;
  }

  function paintPot(v){
    const el=$('pot-val'); if (el) el.textContent=Math.round(v).toLocaleString();
    $('pot-area').classList.toggle('cl-pot-empty', v<=0 && !pot.chips.length);
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
  function plate(id){ const s=spots[id]; s.el.classList.toggle('has-bet',s.amount>0); s.el.querySelector('.cl-spot-plate span').textContent=s.amount.toLocaleString(); }
  function say(who,what,cls,p){
    paintCRT($('banner'),actionRowsHTML(who,what,false),false);
    if (p && seatEls[p.id] && seatEls[p.id].actionSlot){ seatEls[p.id].actionSlot.className='action-slot '+(cls||''); seatEls[p.id].actionSlot.textContent=what; }
  }

  // Where an opponent's chips come from (and go back to).
  function source(p,i){
    const e=seatEls[p.id], d=17;
    if (OPT.source==='chute' && chutes[p.id]){
      const r=chutes[p.id].getBoundingClientRect();
      return { gx:r.left+r.width/2+rint(-2,2), gy:r.top+r.height/2+2, z:0, d, chute:chutes[p.id] };
    }
    if (OPT.source==='edge'){
      const r=e.cardsContainer.getBoundingClientRect();
      return { gx:r.left+r.width/2+rint(-8,8), gy:r.bottom+4, z:6, d };
    }
    const r=e.chips.getBoundingClientRect();
    return { gx:r.left+r.width/2, gy:r.top+r.height/2+d/2, z:0, d };
  }

  /* ---------------- moves ---------------- */
  async function oppBet(p,amount,label){
    p.chips=Math.max(0,p.chips-amount); updateSeatReels(seatEls[p.id].chips,p.chips);
    say(p.name.toUpperCase(),label.toUpperCase(),p.chips?'':'act-allin',p);
    const s=spots[p.id]; s.amount+=amount; plate(p.id);
    const items=coloursFor(amount).map((col,i)=>{
      const c=makeChip(col), from=source(p,i);
      return { c, from, to:s.pile.reserve(c), onStart:()=>{ if (from.chute){ from.chute.classList.remove('is-kick'); void from.chute.offsetWidth; from.chute.classList.add('is-kick'); sfx('chute'); } } };
    });
    await throwAll(items);
  }
  async function youBet(amount,label){
    const you=P[0]; you.chips=Math.max(0,you.chips-amount); updateJackpot(you.chips);
    you.totalBetHand+=amount; updateInvestedReel(you.totalBetHand);
    say('YOU',label.toUpperCase());
    const s=spots.you; s.amount+=amount; plate('you');
    const want=coloursFor(amount), items=[];
    for (const col of want){
      const t=bank.take(); if (!t) break;
      if (t.c.colour!==col){ t.c.el.classList.remove(t.c.colour); t.c.colour=col; t.c.el.classList.add(col); }
      t.c.loose=true;
      items.push({ c:t.c, from:t.from, to:s.pile.reserve(t.c) });
    }
    bank.apply({ slideMs:160 });
    await throwAll(items);
  }
  async function sweep(){
    const ids=Object.keys(spots).filter(id=>spots[id].pile.chips.length);
    if (!ids.length) return;
    const total=ids.reduce((a,id)=>a+spots[id].amount,0);
    say('DEALER','SWEEP');
    const all=[];
    ids.forEach((id,si)=>{
      const s=spots[id], chips=s.pile.chips.slice().reverse(); s.pile.chips=[];
      s.el.classList.add('is-sweeping');
      chips.forEach((c,ci)=>{
        const r=c.el.getBoundingClientRect(), lz=0;
        const from={ gx:r.left+r.width/2, gy:r.bottom+lz, z:lz, d:r.width };
        const to=pot.reserve(c);
        if (OPT.sweep==='push'){
          // The spot's chips go as one group: same start, same speed.
          all.push(fly(c,from,to,{ mode:'slide', wait:si*70, T:.34+Math.hypot(to.gx-from.gx,to.gy-from.gy)/1500, lift:3, noShadow:false })
            .then(()=>{ if (ci===0){ pot.jostle(to.gx,to.gy,1); sfx('collect',.5); } }));
        } else {
          all.push(fly(c,from,to,{ mode:'slide', wait:(si*55+ci*14), T:.42, lift:6 }).then(()=>{ if (ci%3===0) sfx('collect',.4); }));
        }
      });
    });
    const count=countPot(potValue+total,560+ids.length*60);
    await Promise.all(all); await count;
    ids.forEach(id=>{ spots[id].amount=0; spots[id].el.classList.remove('is-sweeping'); plate(id); });
  }
  async function ensurePot(){
    if (pot.chips.length) return;
    coloursFor(2000).forEach(col=>{ const c=makeChip(col); pot.chips.push(c); });
    pot.apply({snap:true}); potValue=2000; paintPot(2000);
    await new Promise(r=>setTimeout(r,250));
  }
  async function payYou(){
    await ensurePot();
    const you=P[0], won=potValue, start=you.chips;
    say('YOU WIN',won.toLocaleString());
    const hl=$('hud-left'), hatch=hl.querySelector('.cl-hatch');
    hatch.classList.add('is-open'); sfx('hatch');
    await new Promise(r=>setTimeout(r,160/OPT.speed));
    const hr=hatch.getBoundingClientRect(), bankEl=bank.el;
    const chips=pot.chips.slice().reverse(); pot.chips=[];
    let landed=0;
    const items=chips.map(c=>{
      const r=c.el.getBoundingClientRect();
      c.loose=true;
      return { c, from:{ gx:r.left+r.width/2, gy:r.bottom, z:0, d:r.width },
        to:{ gx:hr.left+hr.width*(.35+rnd()*.3), gy:hr.bottom-2, z:0, d:21, mouth:true, bank:bankEl, noBounce:true } };
    });
    const n=items.length;
    const run=throwAll(items).then(()=>{});
    // pot counts down and your reel counts up as chips actually arrive
    const iv=setInterval(()=>{
      const inBank=n-flights.size-(pot.chips.length);
      landed=Math.max(landed,Math.min(n,inBank));
      paintPot(Math.round(won*(1-landed/n)));
      you.chips=Math.round(start+won*landed/n); updateJackpot(you.chips);
    },120);
    await run; clearInterval(iv);
    you.chips=start+won; updateJackpot(you.chips); potValue=0; paintPot(0);
    await new Promise(r=>setTimeout(r,150/OPT.speed));
    hatch.classList.remove('is-open'); sfx('hatchClose');
  }
  async function payOpp(p){
    await ensurePot();
    const won=potValue, s=spots[p.id];
    say(p.name.toUpperCase()+' WINS',won.toLocaleString());
    // The dealer pushes the whole pot to the winner's spot in one go...
    const chips=pot.chips.slice().reverse(); pot.chips=[];
    const T=.5;
    const all=chips.map((c,i)=>{
      const r=c.el.getBoundingClientRect();
      return fly(c,{ gx:r.left+r.width/2, gy:r.bottom, z:0, d:r.width }, s.pile.reserve(c), { mode:'slide', T, lift:4, wait:(i%6)*6 });
    });
    s.amount=won; plate(p.id);
    await Promise.all([Promise.all(all), countPot(0,520)]);
    sfx('collect',.6);
    await new Promise(r=>setTimeout(r,380/OPT.speed));
    // ...then it's taken back to the seat in the current throw style.
    const back=s.pile.chips.slice().reverse(); s.pile.chips=[]; s.amount=0; plate(p.id);
    const items=back.map(c=>{
      const r=c.el.getBoundingClientRect(), dst=source(p);
      return { c, from:{ gx:r.left+r.width/2, gy:r.bottom, z:0, d:r.width }, to:{ gx:dst.gx, gy:dst.gy, z:dst.z, d:12, vanish:true, noBounce:true, noRoll:true } };
    });
    await throwAll(items,{ mode:OPT.air==='gravity'?undefined:'eased' });
    p.chips+=won; updateSeatReels(seatEls[p.id].chips,p.chips);
  }
  let tidying=false;
  async function tidy(){
    if (tidying || busy || !bank.chips.some(c=>c.loose)) return;
    tidying=true;
    const hl=$('hud-left'); hl.classList.add('is-tidying');
    const groups=[...new Set(bank.chips.filter(c=>c.loose).map(c=>c.colour))].sort((a,b)=>COLOURS.indexOf(b)-COLOURS.indexOf(a));
    for (const col of groups){
      bank.chips.forEach(c=>{ if (c.colour===col){ c.loose=false; c.clump=null; } });
      if (!bank.chips.some(c=>c.loose)) bank.clumps=[];
      bank.apply({ slideMs:210, stagger:6, easing:'cubic-bezier(.5,0,.2,1)' });
      sfx('tooth'); await new Promise(r=>setTimeout(r,120/OPT.speed));
    }
    await new Promise(r=>setTimeout(r,160)); sfx('lock');
    hl.classList.remove('is-tidying'); tidying=false;
  }

  const OPPS=['maniac','wild','prof','shark'];
  async function run(kind){
    if (busy) return;
    if (kind==='reset'){ setup(); return; }
    busy=true; status('Playing');
    try{
      const pl=id=>P.find(p=>p.id===id);
      if (kind==='opp-bet'){ const p=pl(OPPS[oppTurn++%OPPS.length]); await oppBet(p,180,'Raise 180'); }
      else if (kind==='opp-allin'){ const p=pl('maniac'); await oppBet(p,p.chips||1000,'All-In'); }
      else if (kind==='you-bet') await youBet(180,'Call 180');
      else if (kind==='you-allin') await youBet(P[0].chips,'All-In');
      else if (kind==='sweep') await sweep();
      else if (kind==='pay-you') await payYou();
      else if (kind==='pay-opp') await payOpp(pl('maniac'));
      else if (kind==='street'){
        await oppBet(pl('wild'),60,'Bet 60'); await wait(260);
        await oppBet(pl('maniac'),180,'Raise 180'); await wait(260);
        await youBet(180,'Call 180'); await wait(220);
        await oppBet(pl('wild'),120,'Call 180'); await wait(380);
        await sweep();
      }
      else if (kind==='showdown'){
        await oppBet(pl('maniac'),pl('maniac').chips||1000,'All-In'); await wait(300);
        await youBet(P[0].chips,'All-In'); await wait(400);
        await sweep(); await wait(500);
        await payYou();
      }
      status('Done · tap the bank to tidy');
    } catch(e){ console.error(e); status('Error'); }
    busy=false;
  }
  const wait=ms=>new Promise(r=>setTimeout(r,ms/OPT.speed));

  /* ---------------- panel ---------------- */
  function status(s){ $('cl-status').textContent=s.toUpperCase(); }
  function syncPanel(){
    document.querySelectorAll('.cl-seg').forEach(seg=>{
      const k=seg.dataset.opt;
      seg.querySelectorAll('button').forEach(b=>b.classList.toggle('is-on',String(OPT[k])===b.dataset.v));
    });
    $('ct-preset-note').textContent=PRESET_NOTES[OPT.preset];
  }
  function wirePanel(){
    document.querySelectorAll('.cl-seg').forEach(seg=>seg.addEventListener('click',ev=>{
      const b=ev.target.closest('button'); if (!b) return;
      const k=seg.dataset.opt, v=b.dataset.v;
      if (k==='preset'){ OPT.preset=v; Object.assign(OPT,PRESETS[v]); }
      else { OPT[k]=k==='speed'?Number(v):v; if (!['speed','sound'].includes(k)) OPT.preset='custom'; }
      settings.sound=OPT.sound==='on';
      syncPanel();
      if (k==='source' || k==='preset') setup();
    }));
    document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.run)));
    $('cl-tab').addEventListener('click',()=>{ const p=$('cl-panel'); p.hidden=!p.hidden; $('cl-tab').setAttribute('aria-expanded',String(!p.hidden)); });
  }

  async function init(){
    const q=new URLSearchParams(location.search);
    if (q.get('preset') && PRESETS[q.get('preset')]){ OPT.preset=q.get('preset'); Object.assign(OPT,PRESETS[OPT.preset]); }
    Object.keys(OPT).forEach(k=>{ if (q.get(k) && k!=='preset') OPT[k]=k==='speed'?Number(q.get(k)):q.get(k); });
    if (q.get('panel')==='off') $('cl-panel').hidden=true;
    await mountTable();
    syncPanel(); wirePanel();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    setup();
    window.__chipThrowLab={ run, OPT, setup, busy:()=>busy, flights:()=>flights.size,
      state:()=>({ bank:bank.chips.length, pot:pot.chips.length, air:airLayer?airLayer.children.length:0, flights:flights.size, you:P[0].chips }) };
  }
  init().catch(err=>{ console.error('[chip-throw-lab]',err); status('Failed to mount — serve over http'); });
})();
