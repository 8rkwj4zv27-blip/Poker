/* ============================================================
   CHIP THROW LAB v2 — how chips travel (docs/ui/CHIP_PLAN.md).

   v1 proved the arc and landing. The owner's v2 brief: smaller, simpler
   chips; handfuls that aren't two frozen stacks; more bounce; flips; more
   knocks; messy then tidy; "super video gamey, fun to watch over and
   over". So in v2 every chip on the felt is a physics body, not a DOM
   pile slot:

     - a body has a ground point (x,y: where it touches the felt), a
       height z, and velocities. It is drawn at y-z; its shadow stays on
       the felt at y.
     - flying bodies arc under gravity, flip through real pixel frames,
       bounce 1-3 times (glancing off chips they hit), then slide with
       friction, pushing and knocking resting chips (a hard hit pops a
       resting chip off; chips on top of it topple).
     - some land on their edge and roll; some spin down like a coin
       (wobble) before dropping flat.
     - "after landing" decides whether the mess stays, tidies itself into
       neat colour stacks once everything is still, or waits for a tap.
     - pixel art (optional): chips are drawn by code at their real size
       with flip frames (face, tilts, edge-on), replacing the downscaled
       350px illustrations.

   Your bank stays the chip-lab heap/rack pile (a DOM pile inside the
   dashboard). Same production table mount as chip-lab; memory only.
   ============================================================ */
(function(){
  'use strict';

  /* ---------------- options & presets ---------------- */
  const OPT={ preset:'weight', art:'pixel', size:'m', throw:'handful', hand:'bloom', timing:'irregular', air:'gravity',
    flips:'many', bounces:'multi', wobble:'on', roll:'on', after:'auto', knock:'on', juice:'on', shadow:'on',
    source:'chute', sweep:'push', frames:'smooth', speed:1, sound:'on' };
  const PRESETS={
    today:  { art:'current', size:'l', throw:'stream',  hand:'rigid', timing:'even',      air:'eased',   flips:'one',  bounces:'one',   wobble:'off', roll:'off', after:'neat', knock:'off', juice:'off', shadow:'off', source:'face',  sweep:'stream', frames:'smooth' },
    weight: { art:'pixel',   size:'m', throw:'handful', hand:'bloom', timing:'irregular', air:'gravity', flips:'many', bounces:'multi', wobble:'on',  roll:'on',  after:'auto', knock:'on',  juice:'on',  shadow:'on',  source:'chute', sweep:'push',   frames:'smooth' },
    chaos:  { art:'pixel',   size:'m', throw:'splash',  hand:'bloom', timing:'irregular', air:'gravity', flips:'many', bounces:'multi', wobble:'on',  roll:'on',  after:'tap',  knock:'on',  juice:'on',  shadow:'on',  source:'edge',  sweep:'push',   frames:'smooth' },
    machine:{ art:'pixel',   size:'m', throw:'handful', hand:'bloom', timing:'even',      air:'gravity', flips:'one',  bounces:'one',   wobble:'off', roll:'off', after:'auto', knock:'off', juice:'on',  shadow:'on',  source:'chute', sweep:'push',   frames:'stepped' }
  };
  const NOTES={
    today:'What the game does now, for reference: one chip at a time, smooth swaying arcs, out of the face.',
    weight:'Recommended. Pixel chips in blooming handfuls from the chute: they flip, bounce 1–3 times, glance off each other, knock chips loose, sometimes roll or spin down like a coin. Once everything is still, the pile tidies itself.',
    chaos:'Everything thrown at once, and the mess stays until you tap the felt. Maximum physics.',
    machine:'Blooming handfuls, but motion steps at 12fps like the rest of the machine, landings are dead, then the pile tidies.',
    custom:'Your own mix.'
  };
  const SIZES={ s:13, m:15, l:17 };
  const D=()=>SIZES[OPT.size];
  const STEP=()=>Math.max(2,Math.round(D()*.2));

  /* ---------------- random ---------------- */
  let seed=7;
  function rnd(){ seed=(seed*1103515245+12345)>>>0; return (seed>>>8)/0x1000000; }
  const rint=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  const rr=(a,b)=>a+rnd()*(b-a);

  /* ---------------- chip colour language (chip-lab option C) ---------------- */
  const COLOURS=['d-white','d-red','d-blue','d-green','d-black','d-purple','d-yellow'];
  const BB=20;
  function coloursFor(amount){
    const n=visualChipCount(amount), out=[];
    const centre=Math.max(0,Math.min(6,Math.log(Math.max(.5,amount/BB))/Math.log(3.2)));
    for (let i=0;i<n;i++){ const r=rnd(); out.push(COLOURS[Math.max(0,Math.min(6,Math.round(centre)+(r<.55?0:r<.85?-1:1)))]); }
    return out;
  }

  /* ============================================================
     PIXEL CHIPS — drawn by code at their real size, one frame per tilt.
     A frame is the chip seen at tilt c (1 = face-on, 0 = edge-on): the
     face ellipse squashes to c and the edge band grows by sqrt(1-c²).
     Resting chips use c≈.82, matching the table's viewing angle, so a
     pile reads as stacked discs.
     ============================================================ */
  const PAL={
    'd-white': ['#ece5d2','#a39a82','#fffaf0','#c9362c'],
    'd-red':   ['#c8322b','#7e1c17','#ee6a60','#f4efe1'],
    'd-blue':  ['#2f6fbf','#1b4478','#63a0e6','#f4efe1'],
    'd-green': ['#2e8b57','#1a5534','#58bd83','#f4efe1'],
    'd-black': ['#2c2c31','#131316','#55555f','#f4efe1'],
    'd-purple':['#7b41b3','#4a2470','#a46ad8','#f4efe1'],
    'd-yellow':['#e3b134','#98701a','#fbd977','#3a2a06']
  };
  const TILTS=[1,.82,.6,.38,.18,0];
  const REST=1;                                  // index of the resting tilt
  const frameCache={};
  function hex(h){ const n=parseInt(h.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
  function drawFrame(col,d,c){
    const [face,edge,hi,notch]=PAL[col].map(hex), ink=[13,15,12];
    const cv=document.createElement('canvas'); cv.width=d; cv.height=d;
    const ctx=cv.getContext('2d'), img=ctx.createImageData(d,d), px=img.data;
    const rx=d/2-.5, ry=Math.max(.6,rx*c), th=Math.max(2,Math.round(d*.2)), band=th*Math.sqrt(1-c*c);
    const cy=(d-(2*ry+band))/2+ry, cx=d/2;
    const fill=new Array(d*d).fill(null);
    for (let y=0;y<d;y++) for (let x=0;x<d;x++){
      const nx=(x+.5-cx)/rx; if (Math.abs(nx)>1) continue;
      const ny=(y+.5-cy)/ry, r=Math.hypot(nx,ny);
      if (r<=1){
        const a=Math.atan2(ny,nx);
        const nd=Math.min(...[-2.356,-.785,.785,2.356].map(k=>Math.abs(Math.atan2(Math.sin(a-k),Math.cos(a-k)))));
        let p=face;
        if (r>.7 && nd<.3) p=notch;
        else if (Math.abs(r-.56)<.9/Math.max(3,Math.min(rx,ry*1.6))) p=edge;
        else if (r>.6 && r<.9 && a<-1.7 && a>-2.9) p=hi;
        fill[y*d+x]=p;
      } else {
        const span=Math.sqrt(1-nx*nx)*ry, yy=y+.5;
        if (yy>=cy-span && yy<=cy+band+span){
          const stripe=[-.55,0,.55].some(k=>Math.abs(nx-k)<1.1/rx);
          fill[y*d+x]=stripe&&band>=1.5?notch:edge;
        }
      }
    }
    // 1px ink outline round the whole shape
    const inkAt=[];
    for (let y=0;y<d;y++) for (let x=0;x<d;x++){
      if (fill[y*d+x]) continue;
      if ([[1,0],[-1,0],[0,1],[0,-1]].some(([ox,oy])=>{ const X=x+ox,Y=y+oy; return X>=0&&Y>=0&&X<d&&Y<d&&fill[Y*d+X]; })) inkAt.push(y*d+x);
    }
    inkAt.forEach(i=>{ fill[i]=ink; });
    for (let i=0;i<d*d;i++){ const p=fill[i]; if (!p) continue; px[i*4]=p[0]; px[i*4+1]=p[1]; px[i*4+2]=p[2]; px[i*4+3]=255; }
    ctx.putImageData(img,0,0);
    return 'url('+cv.toDataURL()+')';
  }
  function frames(col,d){
    const k=col+'|'+d;
    return frameCache[k]||(frameCache[k]=TILTS.map(c=>drawFrame(col,d,c)));
  }
  const tiltIndex=c=>{ let best=0; TILTS.forEach((t,i)=>{ if (Math.abs(t-c)<Math.abs(TILTS[best]-c)) best=i; }); return best; };

  /* ---------------- chip element ---------------- */
  function makeChip(colour){
    const el=document.createElement('div');
    const c={ el, colour, variant:'v-'+rint(1,3), jx:rint(-1,1), lean:rint(-1,1), loose:true, frame:-1 };
    styleChip(c);
    return c;
  }
  function styleChip(c){
    if (OPT.art==='pixel'){ c.el.className='cl-chip ct-px'; }
    else { c.el.className='chip-disc cl-chip '+c.colour+' '+c.variant; c.el.style.backgroundImage=''; }
    c.frame=-1;
  }
  function setFrame(c,d,i){
    if (OPT.art!=='pixel') return;
    const key=d*10+i; if (c.frame===key) return;
    c.frame=key; c.el.style.backgroundImage=frames(c.colour,d)[i];
  }

  /* ---------------- the bank: chip-lab's heap/rack pile ---------------- */
  class BankPile{
    constructor(el){ this.el=el; this.chips=[]; this.clumps=[]; }
    get diam(){ return D()+5; }
    get step(){ return STEP(); }
    size(){ const r=this.el.getBoundingClientRect(); return { w:r.width, h:r.height }; }
    heapLayout(chips){
      const { w,h }=this.size(), d=this.diam, floor=Math.min(h*.62,10+chips.length*.55), pos=[];
      chips.forEach(c=>{
        if (!c.clump || !this.clumps.includes(c.clump)){
          let cl=this.clumps.find(k=>k.n<k.cap && k.open);
          if (!cl){ this.clumps.forEach(k=>k.open=false); cl={ x:rint(1,Math.max(1,Math.round(w-d-1))), y:rint(2,Math.round(floor)), n:0, cap:rint(2,6), open:true }; this.clumps.push(cl); }
          c.clump=cl; c.ci=cl.n; cl.n++;
        }
        const cl=c.clump;
        pos.push({ x:cl.x+c.lean*Math.min(2,c.ci), y:cl.y+c.ci*this.step, z:Math.round((h-cl.y)*4)+c.ci });
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
        pos.set(c,{ x:x0+(col%cols)*sp+(row?Math.round(sp/2):0), y:4+row*9+n*this.step, z:(row?10:60)+n });
        n++;
      });
      return pos;
    }
    layout(){
      const racked=this.chips.filter(c=>!c.loose), loose=this.chips.filter(c=>c.loose);
      const m=this.rackLayout(racked), hp=this.heapLayout(loose);
      const hm=new Map(loose.map((c,i)=>[c,{ ...hp[i], z:hp[i].z+200 }]));
      return this.chips.map(c=>m.get(c)||hm.get(c));
    }
    apply(opts){
      opts=opts||{};
      const pos=this.layout(), d=this.diam;
      this.chips.forEach((c,i)=>{
        const p=pos[i]; if (!p) return;
        const el=c.el;
        const before=(!opts.snap && el.parentNode===this.el && !motionOff()) ? el.getBoundingClientRect() : null;
        if (el.parentNode!==this.el) this.el.appendChild(el);
        const bg=el.style.backgroundImage;
        el.style.cssText='';
        if (OPT.art==='pixel') el.style.backgroundImage=bg;
        el.style.width=d+'px'; el.style.height=d+'px'; el.style.left=p.x+'px'; el.style.bottom=p.y+'px'; el.style.zIndex=String(p.z);
        el._base=0; c.frame=-1; setFrame(c,d,REST);
        el.classList.toggle('cl-base', !pos.some((q,j)=>j!==i && q && Math.abs(q.x-p.x)<=3 && q.y<p.y && p.y-q.y<d));
        if (before){
          const a=el.getBoundingClientRect(), dx=before.left-a.left, dy=before.top-a.top;
          if (Math.abs(dx)>.5 || Math.abs(dy)>.5) el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{ duration:(opts.slideMs||240)/OPT.speed+(opts.stagger?i*opts.stagger:0), easing:opts.easing||'cubic-bezier(.3,.7,.25,1)' });
        }
      });
    }
    take(){
      const pos=this.layout(); let best=-1, by=-1e9;
      this.chips.forEach((c,i)=>{
        const covered=pos.some((q,j)=>j!==i && q && Math.abs(q.x-pos[i].x)<=3 && q.y>pos[i].y && q.y-pos[i].y<this.diam);
        if (!covered && pos[i].y>by){ by=pos[i].y; best=i; }
      });
      if (best<0) return null;
      const c=this.chips[best], r=c.el.getBoundingClientRect();
      this.chips.splice(best,1);
      if (c.clump){ c.clump.n--; c.clump=null; }
      return { c, rect:r };
    }
  }

  /* ---------------- sound ---------------- */
  const soundAt={};
  function sfx(kind,power){
    if (OPT.sound!=='on') return;
    const now=performance.now(), gap={ land:24, bounce:22, roll:90, chute:40, collect:60, wobble:20, knock:40 }[kind]||30;
    if (now-(soundAt[kind]||0)<gap) return; soundAt[kind]=now;
    if (kind==='land') Sound.chipLand();
    else if (kind==='bounce') Sound.chipBounce(Math.max(.15,Math.min(1,power||.5)));
    else if (kind==='knock') Sound.chipBounce(.7);
    else if (kind==='roll') Sound.chipBounce(.16);
    else if (kind==='wobble') Sound.chipBounce(Math.max(.08,power||.2));
    else if (kind==='collect') Sound.chipCollect(power||.5);
    else if (kind==='chute') Sound.chipBounce(.35);
    else if (kind==='hatch') Sound.hatchOpen();
    else if (kind==='hatchClose') Sound.hatchClose();
    else if (kind==='tooth') Sound.wheelTooth(.6,false);
    else if (kind==='lock') Sound.counterLock(true);
    else if (kind==='thump') Sound.chipCollect(1);
  }

  /* ============================================================
     THE WORLD
     ============================================================ */
  const G=2600;                 // px/s² screen gravity
  const FRICTION=1100;          // px/s² sliding friction on felt
  const ease={ inOut:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, out:t=>1-Math.pow(1-t,3) };
  let air=null, shadows=null, raf=0, lastT=0, lastBucket=-1, freeze=0;
  const active=new Set();       // bodies being stepped
  const dirty=new Set();        // bodies needing a redraw
  const zones={};

  function ensureLayers(){
    if (air) return;
    shadows=document.createElement('div'); shadows.className='ct-shadows'; document.body.appendChild(shadows);
    air=document.createElement('div'); air.className='ct-air'; document.body.appendChild(air);
  }
  function kick(){ if (!raf){ lastT=performance.now(); raf=requestAnimationFrame(loop); } }
  function loop(now){
    let dt=Math.min(.04,(now-lastT)/1000)*OPT.speed; lastT=now;
    if (freeze>0){ freeze-=dt; dt=0; }
    const bucket=OPT.frames==='stepped'?Math.floor(now/83):now, redraw=bucket!==lastBucket; lastBucket=bucket;
    const reduced=motionOff();
    for (const b of Array.from(active)){
      if (reduced){ snap(b); continue; }
      if (b.state==='wait'){ b.wait-=dt*1000; if (b.wait>0) continue; begin(b); }
      if (dt>0) step(b,dt);
      dirty.add(b);
    }
    if (redraw){ dirty.forEach(draw); dirty.clear(); }
    raf=(active.size||dirty.size||freeze>0)?requestAnimationFrame(loop):0;
  }

  /* A body wraps a chip on the felt (or in the air). */
  function body(chip,x,y,z,d){
    ensureLayers();
    const b={ chip, el:chip.el, colour:chip.colour, x, y, z:z||0, d, d0:d, d1:d, vx:0, vy:0, vz:0, rot:0, vr:0, phi:0, fr:0,
      tilt:1, state:'rest', zone:null, bounces:0, maxB:1, e:.35, t:0, target:{}, opts:{} };
    const bg=chip.el.style.backgroundImage;
    chip.el.style.cssText=''; if (bg) chip.el.style.backgroundImage=bg;
    chip.el.style.left='0px'; chip.el.style.top='0px';
    chip.el.classList.remove('cl-base');
    chip.el._base=0;
    air.appendChild(chip.el);
    b.sh=document.createElement('i'); b.sh.className='ct-shadow'; shadows.appendChild(b.sh);
    return b;
  }
  function removeBody(b){
    active.delete(b); dirty.delete(b);
    if (b.sh){ b.sh.remove(); b.sh=null; }
    if (b.zone){ const i=b.zone.list.indexOf(b); if (i>=0) b.zone.list.splice(i,1); b.zone=null; }
  }
  function toRest(b){ b.state='rest'; b.t=0; active.delete(b); dirty.add(b); kick(); onRest(b); }

  /* ---------------- zones: bet spots and the pot ---------------- */
  function zone(id,cx,cy,cap,maxSlots){ return zones[id]={ id, cx, cy, cap, maxSlots, list:[], neat:true, timer:0, amount:0 }; }
  // Neat layout: colour-grouped stacks, centre-out, a back row between.
  function neatSlots(z,list){
    const d=D(), sp=d+1, st=STEP(), slots=[], order=[0];
    for (let i=1;i<9;i++) order.push(i%2?Math.ceil(i/2):-i/2);
    order.forEach((o,i)=>{ slots.push({ x:z.cx+o*sp, y:z.cy }); if (i<8) slots.push({ x:z.cx+(o+(o<0?-.5:.5))*sp, y:z.cy-Math.round(d*.42) }); });
    const use=slots.slice(0,z.maxSlots), stacks=[], out=new Map();
    list.forEach(b=>{
      let s=null;
      for (let i=stacks.length-1;i>=0;i--) if (stacks[i].key===b.colour && stacks[i].n<z.cap){ s=stacks[i]; break; }
      if (!s){ if (stacks.length<use.length){ s={ key:b.colour, slot:use[stacks.length], n:0 }; stacks.push(s); } else s=stacks.reduce((a,c)=>c.n<a.n?c:a); }
      out.set(b,{ x:s.slot.x, y:s.slot.y, z:s.n*st, n:s.n });
      s.n++;
    });
    return out;
  }
  function supportUnder(b){
    if (!b.zone) return { h:0, o:null };
    let h=0, o=null;
    for (const q of b.zone.list){
      if (q===b || q.state!=='rest') continue;
      if (Math.hypot(q.x-b.x,(q.y-b.y)*1.4)<b.d*.55 && q.z+STEP()>h){ h=q.z+STEP(); o=q; }
    }
    return { h, o };
  }
  function onRest(b){
    if (b.resolve){ const r=b.resolve; b.resolve=null; r(); }
    const z=b.zone; if (!z) return;
    if (OPT.after==='auto' && !z.neat) scheduleTidy(z);
  }
  function zoneBusy(z){ return z.list.some(q=>q.state!=='rest'); }
  function scheduleTidy(z){
    clearTimeout(z.timer);
    z.timer=setTimeout(()=>{ if (!zones[z.id] || zones[z.id]!==z) return; if (!zoneBusy(z) && !z.neat) tidyZone(z); else if (!z.neat) scheduleTidy(z); }, 380/OPT.speed);
  }
  // The machine squares the pile: colour by colour, each chip hops to its stack.
  function tidyZone(z){
    if (z.tidying) return z.tidying;
    if (z.neat || !z.list.length) return Promise.resolve();
    z.neat=true; clearTimeout(z.timer);
    const slots=neatSlots(z,z.list);
    const groups=[...new Set(z.list.map(b=>b.colour))];
    const done=[];
    groups.forEach((col,gi)=>{
      setTimeout(()=>sfx('tooth'),gi*95/OPT.speed);
      z.list.filter(b=>b.colour===col).forEach(b=>{
        const s=slots.get(b);
        if (Math.hypot(s.x-b.x,s.y-b.y)<.6 && Math.abs(s.z-b.z)<.6) return;
        done.push(new Promise(res=>{
          const dist=Math.hypot(s.x-b.x,s.y-b.y);
          b.tx=s.x; b.ty=s.y; b.tz=s.z; b.resolve=res;
          b.T=.14+Math.min(.14,dist/900); b.arc=5+Math.min(14,dist*.12);
          b.wait=(gi*95+s.n*22); b.state='wait'; b.next='tidy'; active.add(b); kick();
        }));
      });
    });
    z.tidying=Promise.all(done).then(()=>{ z.tidying=null; if (done.length) sfx('lock'); });
    return z.tidying;
  }

  /* ---------------- launch ---------------- */
  // Target t = { x, y, z, d, zone?, slot?, vanish?, mouth? }
  function launch(b,t,o){
    o=o||{};
    b.target=t; b.opts=o; b.bounces=0; b.knocked=false;
    b.maxB=OPT.bounces==='multi' ? rint(1,3) : 1;
    b.e=rr(.26,.44);
    b.d0=b.d; b.d1=t.d||D();
    if (t.zone && b.zone!==t.zone){ if (b.zone) removeFromZone(b); b.zone=t.zone; t.zone.list.push(b); }
    b.wait=o.wait||0; b.state='wait'; b.next=o.mode||(OPT.air==='gravity'?'air':'eased');
    b.el.style.visibility=b.wait>0?'hidden':''; if (b.sh) b.sh.style.visibility=b.wait>0?'hidden':'';
    active.add(b); dirty.add(b); kick();
    return new Promise(res=>{ b.resolve=res; });
  }
  function removeFromZone(b){ const i=b.zone.list.indexOf(b); if (i>=0) b.zone.list.splice(i,1); b.zone=null; }
  const flightT=dist=>Math.min(.55,Math.max(.22,.2+dist/900));
  function begin(b){
    b.el.style.visibility=''; if (b.sh) b.sh.style.visibility='';
    if (b.opts && b.opts.onStart){ const f=b.opts.onStart; b.opts.onStart=null; f(); }
    const t=b.target, s=b.next;
    b.x0=b.x; b.y0=b.y; b.z0=b.z; b.t=0;
    if (s==='tidy' || s==='push'){ b.state=s; return; }
    const dist=Math.hypot(t.x-b.x,t.y-b.y); b.dist=dist;
    if (s==='eased'){
      b.state='eased'; b.T=Math.min(.76,Math.max(.4,.38+dist/1100));
      b.hop=10+Math.min(26,dist*.06)+rnd()*6; b.spin=(rnd()<.5?-1:1)*(20+rnd()*40); b.lane=((b.opts.i||0)%5-2)*Math.min(8,dist*.02);
      return;
    }
    // ballistic: aim a touch short so bounces carry it the rest of the way
    b.state='air'; b.T=b.opts.T||flightT(dist);
    let ax=t.x+(b.opts.jx||0), ay=t.y+(b.opts.jy||0);
    const short=!t.vanish&&!t.mouth&&dist>20 ? Math.min(18,dist*.1)+3 : 0;
    if (short){ ax-=(t.x-b.x)/dist*short; ay-=(t.y-b.y)/dist*short; }
    b.vx=(ax-b.x)/b.T; b.vy=(ay-b.y)/b.T;
    b.vz=((t.z||0)-b.z)/b.T+.5*G*b.T;
    const flips=b.opts.flips!=null?b.opts.flips:(OPT.flips==='many'?rint(2,6):1);
    b.fr=flips*Math.PI/b.T; b.phi=0;
    b.vr=OPT.art==='pixel'?0:(OPT.flips==='many'?rr(-300,300):0);
  }

  /* ---------------- step ---------------- */
  function step(b,dt){
    b.t+=dt;
    const t=b.target;
    switch(b.state){
      case 'eased':{
        const k=Math.min(1,b.t/b.T), e=ease.inOut(k), L=Math.max(1,b.dist);
        const nx=-(t.y-b.y0)/L, ny=(t.x-b.x0)/L, sw=b.lane*Math.sin(Math.PI*k);
        b.x=b.x0+(t.x-b.x0)*e+nx*sw; b.y=b.y0+(t.y-b.y0)*e+ny*sw;
        b.z=b.z0+((t.z||0)-b.z0)*e+b.hop*Math.sin(Math.PI*Math.min(1,k*1.1));
        b.rot=b.spin*Math.sin(Math.PI*k); b.d=b.d0+(b.d1-b.d0)*k; b.tilt=1;
        if (k>=1){ b.rot=0; b.x=t.x; b.y=t.y; b.z=t.z||0; arrive(b,true); }
        break;
      }
      case 'air':{
        b.x+=b.vx*dt; b.y+=b.vy*dt; b.vz-=G*dt; b.z+=b.vz*dt; b.phi+=b.fr*dt; b.rot+=b.vr*dt;
        if (!b.bounces) b.d=b.d0+(b.d1-b.d0)*Math.min(1,b.t/b.T);
        b.tilt=Math.abs(Math.cos(b.phi));
        if (t.vanish||t.mouth){ if (b.t>=b.T) arrive(b,false); break; }
        if (b.vz<0){
          const sup=t.slot?{ h:t.z||0, o:null }:(b.z<40?supportUnder(b):{ h:0, o:null });
          if (b.z<=sup.h) impact(b,sup.h,sup.o);
        }
        break;
      }
      case 'slide':{
        const v=Math.hypot(b.vx,b.vy), dec=FRICTION*dt;
        if (v<=dec || v<6){ b.vx=0; b.vy=0; settle(b); break; }
        b.vx*=(v-dec)/v; b.vy*=(v-dec)/v;
        b.x+=b.vx*dt; b.y+=b.vy*dt;
        collide(b);
        const sup=supportUnder(b);
        if (sup.h<b.z-.5){ b.state='air'; b.vz=0; b.fr=0; b.maxB=0; b.t=0; b.T=0; b.bounces=1; }   // slid off a stack: drop
        break;
      }
      case 'skid':{
        const k=Math.min(1,b.t/b.T), e=ease.out(k);
        b.x=b.x0+(b.tx-b.x0)*e; b.y=b.y0+(b.ty-b.y0)*e; b.z=b.tz;
        if (k>=1) settle(b);
        break;
      }
      case 'roll':{
        const k=Math.min(1,b.t/b.T), e=ease.out(k), u=1-e;
        b.x=u*u*b.x0+2*u*e*b.cx+e*e*b.tx; b.y=u*u*b.y0+2*u*e*b.cy+e*e*b.ty;
        b.tilt=0; b.rot=(4+16*k)*Math.sin(b.t*(15-7*k))*b.rdir; b.z=b.tz+1;
        if (Math.floor(b.t*9)!==b.tick){ b.tick=Math.floor(b.t*9); if (k<.9) sfx('roll'); }
        if (k>=1){ b.state='flat'; b.t=0; }
        break;
      }
      case 'flat':{
        const k=Math.min(1,b.t/.12); b.tilt=[0,.18,.38,.6,.82][Math.min(4,Math.floor(k*5))]; b.rot*=.6; b.z=b.tz;
        if (k>=1){ b.tilt=1; b.rot=0; sfx('land'); finishRest(b); }
        break;
      }
      case 'wobble':{
        // A coin spinning down: faster and faster, lower and lower, then flat.
        const k=Math.min(1,b.t/b.T), freq=5+30*k*k, amp=Math.pow(1-k,1.1);
        const prev=b.wph; b.wph+=2*Math.PI*freq*dt;
        b.tilt=1-.62*amp*Math.abs(Math.sin(b.wph)); b.rot=amp*10*Math.sin(b.wph*.5);
        if (Math.floor(prev/Math.PI)!==Math.floor(b.wph/Math.PI) && amp>.08) sfx('wobble',.08+amp*.3);
        if (k>=1){ b.tilt=1; b.rot=0; sfx('land'); finishRest(b); }
        break;
      }
      case 'tidy':{
        const k=Math.min(1,b.t/b.T), e=ease.inOut(k);
        b.x=b.x0+(b.tx-b.x0)*e; b.y=b.y0+(b.ty-b.y0)*e; b.z=b.z0+(b.tz-b.z0)*e+b.arc*Math.sin(Math.PI*k);
        b.tilt=k<1?.82:1;
        if (k>=1){ b.x=b.tx; b.y=b.ty; b.z=b.tz; b.tilt=1; sfx('land'); toRest(b); }
        break;
      }
      case 'push':{
        const k=Math.min(1,b.t/b.T), e=ease.inOut(k);
        b.x=b.x0+(b.tx-b.x0)*e; b.y=b.y0+(b.ty-b.y0)*e; b.z=b.z0+(b.tz-b.z0)*e+(b.lift||3)*Math.sin(Math.PI*k);
        if (k>=1){ b.x=b.tx; b.y=b.ty; b.z=b.tz; toRest(b); }
        break;
      }
    }
  }

  // Reduced Motion: every chip goes straight to where it would end up.
  function snap(b){
    b.el.style.visibility=''; if (b.sh) b.sh.style.visibility='';
    if (b.opts && b.opts.onStart){ b.opts.onStart=null; }
    const s=b.state==='wait'?b.next:b.state, t=b.target||{};
    b.tilt=1; b.rot=0; b.d=b.d1||b.d;
    if (s==='push' || s==='tidy'){ b.x=b.tx; b.y=b.ty; b.z=b.tz; toRest(b); return; }
    if (t.vanish || t.mouth){ arrive(b,true); return; }
    if (t.slot){ b.x=t.x; b.y=t.y; b.z=t.z||0; toRest(b); return; }
    if (t.x!=null && (s==='air'||s==='eased')){ b.x=t.x; b.y=t.y; }
    b.z=supportUnder(b).h; finishRest(b);
  }

  // Flight over without a physical landing: into the hatch, back into
  // the seat, or (eased mode) straight onto the felt.
  function arrive(b,eased){
    const t=b.target;
    if (t.vanish){ const r=b.resolve; b.resolve=null; removeBody(b); b.el.remove(); if (r) r(); return; }
    if (t.mouth){ dropIntoBank(b); return; }
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; skid(b,eased?1:70); if (!eased) sfx('land'); return; }
    b.z=supportUnder(b).h; b.vx=0; b.vy=0; settle(b);
  }

  function impact(b,ground,hit){
    const t=b.target, speed=-b.vz;
    b.z=ground;
    if (!b.knocked){
      b.knocked=true;
      if (OPT.juice==='on' && ground===0 && speed>260) puff(b.x,b.y,speed);
      if (b.opts.big && OPT.juice==='on' && !b.opts.big.done){ b.opts.big.done=true; freeze=.055; shake(); sfx('thump'); }
      knockAround(b,speed);
    }
    // glance off a chip it hits
    if (hit && !t.slot && rnd()<.5){ const L=Math.max(1,Math.hypot(b.x-hit.x,b.y-hit.y)); b.vx+=(b.x-hit.x)/L*rr(60,140); b.vy+=(b.y-hit.y)/L*rr(30,70); }
    if (b.bounces<b.maxB && speed>150){
      b.bounces++;
      b.vz=speed*b.e; b.fr*=.35;
      if (t.slot){
        const tHop=2*b.vz/G;
        b.vx=(t.x-b.x)*.72/tHop; b.vy=(t.y-b.y)*.72/tHop;
      } else { b.vx*=.62; b.vy*=.62; }
      sfx('bounce',speed/900);
      return;
    }
    b.vz=0; b.fr=0; b.tilt=1;
    sfx('land');
    if (OPT.roll==='on' && ground<1 && rnd()<.1 && speed>120){ startRoll(b); return; }
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; skid(b,80+Math.min(140,Math.hypot(t.x-b.x,t.y-b.y)*5)); return; }
    b.vx*=.75; b.vy*=.75; b.state='slide';
  }
  function skid(b,ms){ b.x0=b.x; b.y0=b.y; b.T=ms/1000; b.t=0; b.state='skid'; }
  function startRoll(b){
    const t=b.target;
    b.state='roll'; b.t=0; b.T=rr(.5,.8); b.x0=b.x; b.y0=b.y; b.rdir=rnd()<.5?-1:1;
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; }
    else {
      const v=Math.hypot(b.vx,b.vy), L=rr(18,40);
      const ux=v>1?b.vx/v:rr(-1,1), uy=v>1?b.vy/v:rr(-.5,.5);
      b.tx=b.x+ux*L; b.ty=b.y+uy*L*.5; b.tz=0;
    }
    const mx=(b.x0+b.tx)/2, my=(b.y0+b.ty)/2, L=Math.max(12,Math.hypot(b.tx-b.x0,b.ty-b.y0));
    b.cx=mx-(b.ty-b.y0)/L*b.rdir*20; b.cy=my+(b.tx-b.x0)/L*b.rdir*8;
    sfx('bounce',.4);
  }
  function settle(b){
    const t=b.target||{};
    if (!t.slot) b.z=supportUnder(b).h;
    if (OPT.wobble==='on' && b.z<1 && rnd()<(t.slot?.12:.2)){ b.state='wobble'; b.t=0; b.T=rr(.7,1.2); b.wph=0; return; }
    finishRest(b);
  }
  function finishRest(b){ if (b.zone && !(b.target&&b.target.slot)) b.zone.neat=false; toRest(b); }

  // Sliding chips push resting ones; a hard shove sets them sliding too.
  function collide(b){
    if (!b.zone) return;
    for (const q of b.zone.list){
      if (q===b || Math.abs(q.z-b.z)>STEP()*1.5) continue;
      if (q.state!=='rest' && q.state!=='slide') continue;
      const dx=b.x-q.x, dy=(b.y-q.y)*1.4, dist=Math.hypot(dx,dy), min=b.d*.72;
      if (dist>=min || dist<.01) continue;
      const nx=dx/dist, ny=dy/dist, over=min-dist;
      b.x+=nx*over*.6; b.y+=ny*over*.6/1.4;
      const vn=b.vx*nx+b.vy*ny;
      if (vn<0){ b.vx-=1.4*vn*nx; b.vy-=1.4*vn*ny; }
      if (q.state==='rest' && q.z<1 && OPT.knock!=='off'){
        q.x-=nx*over*.4; q.y-=ny*over*.4/1.4;
        const imp=Math.abs(vn)*.55;
        if (imp>25){ q.vx=-nx*imp; q.vy=-ny*imp/1.4; q.target={}; q.zone.neat=false; q.state='slide'; q.t=0; active.add(q); }
        dirty.add(q);
      }
    }
  }
  // A landing disturbs what's around it: nudges, or pops a chip loose.
  function knockAround(b,speed){
    if (!b.zone || OPT.knock==='off') return;
    const near=b.zone.list.filter(q=>q!==b && q.state==='rest' && Math.hypot(q.x-b.x,(q.y-b.y)*1.4)<b.d*1.2);
    if (b.target.slot){
      // neat piles only shiver
      near.slice(0,5).forEach(q=>{ const tr=q.el.style.transform; q.el.animate([{transform:tr},{transform:tr+' translate('+rint(-2,2)+'px,-1px)'},{transform:tr}],{ duration:140/OPT.speed, easing:'steps(3,end)' }); });
      return;
    }
    let popped=0;
    near.sort((a,c)=>c.z-a.z).forEach(q=>{
      const L=Math.max(1,Math.hypot(q.x-b.x,q.y-b.y));
      if (speed>330 && popped<2 && rnd()<.55){
        // popped off: a short hop away from the hit
        popped++; b.zone.neat=false;
        pop(q, (q.x-b.x)/L*rr(50,120), (q.y-b.y)/L*rr(25,60), rr(160,260)+speed*.12, OPT.bounces==='multi'?rint(0,2):0);
        sfx('knock');
        // anything stacked on it topples
        b.zone.list.forEach(s=>{ if (s!==q && s.state==='rest' && s.z>q.z && Math.hypot(s.x-q.x,s.y-q.y)<q.d*.5) pop(s,(q.x-b.x)/L*rr(20,50),rr(-10,10),rr(40,90),0); });
      } else if (q.z<1){
        const imp=speed*.08;
        q.vx=(q.x-b.x)/L*imp; q.vy=(q.y-b.y)/L*imp*.6; q.target={}; q.state='slide'; q.t=0; active.add(q); b.zone.neat=false;
      }
    });
  }
  function pop(q,vx,vy,vz,maxB){
    q.target={}; q.opts={}; q.bounces=0; q.maxB=maxB; q.e=.3; q.knocked=true;
    q.vx=vx; q.vy=vy; q.vz=vz; q.fr=rint(1,2)*Math.PI*3; q.phi=0; q.t=0; q.T=.3; q.d0=q.d1=q.d;
    q.state='air'; active.add(q); kick();
  }

  /* ---------------- juice ---------------- */
  function puff(x,y,speed){
    const p=document.createElement('i'); p.className='ct-puff'+(speed>600?' is-big':'');
    p.style.transform='translate('+Math.round(x)+'px,'+Math.round(y-2)+'px)';
    air.appendChild(p);
    setTimeout(()=>p.remove(),300/OPT.speed);
  }
  function shake(){
    // Shake the stage behind the felt (transforming #felt itself would
    // lift its wood-rail ::before over the cloth) plus the chip layers.
    if (motionOff()) return;
    const k=[{transform:'translate(0,0)'},{transform:'translate(2px,1px)'},{transform:'translate(-2px,0)'},{transform:'translate(1px,-1px)'},{transform:'translate(0,0)'}];
    [$('stage-bay'),air,shadows].forEach(el=>{ if (el) el.animate(k,{ duration:170/OPT.speed, easing:'steps(4,end)' }); });
  }

  /* ---------------- draw ---------------- */
  function draw(b){
    if (!b.el.isConnected || b.el.parentNode!==air) return;
    const pixel=OPT.art==='pixel';
    const lift=b.state==='air'?1+Math.min(.12,b.z/500):1;
    const dnow=Math.max(6,Math.round(b.d));
    const ti=b.state==='rest'?REST:(b.tilt>=.92?0:tiltIndex(b.tilt));
    let sx=1, sy=1;
    if (!b.el._base){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=dnow+'px'; }
    const base=b.el._base;
    if (pixel){
      // swap to frames drawn at the chip's current size once it's close
      if (Math.abs(dnow-base)>1 && (b.state!=='air' || Math.abs(dnow-b.d1)<1)){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=dnow+'px'; }
      setFrame(b.chip,b.el._base,ti);
    } else if (b.state!=='rest'){
      sy=Math.max(.18,b.tilt);
      if (b.state==='roll'){ sx=.32; sy=1; }
    }
    const s=(b.d*lift)/b.el._base;
    const x=Math.round(b.x-b.el._base/2), y=Math.round(b.y-b.z-b.d*lift/2-b.el._base/2);
    const rot=pixel?Math.round(b.rot/15)*15:Math.round(b.rot);
    b.el.style.transform='translate('+x+'px,'+y+'px)'+(rot?' rotate('+rot+'deg)':'')+' scale('+(s*sx).toFixed(3)+','+(s*sy).toFixed(3)+')';
    b.el.style.zIndex=String(1000+Math.round(b.y*4+b.z));
    if (b.sh){
      const onStack=b.state==='rest'&&b.z>1;
      if (OPT.shadow!=='on' || onStack){ b.sh.style.opacity='0'; }
      else {
        const w=b.d*.95*(1-Math.min(.45,b.z/220)), h=Math.max(2,w*.4);
        b.sh.style.transform='translate('+Math.round(b.x-w/2)+'px,'+Math.round(b.y-h*.75)+'px)';
        b.sh.style.width=Math.round(w)+'px'; b.sh.style.height=Math.round(h)+'px';
        b.sh.style.opacity=(b.state==='rest'?.28:.42*(1-Math.min(.75,b.z/180))).toFixed(2);
      }
    }
  }

  /* ---------------- throw rhythm ---------------- */
  function rhythm(n){
    const out=[], irr=OPT.timing==='irregular', bloom=OPT.hand==='bloom';
    if (OPT.throw==='splash'){ for (let i=0;i<n;i++) out.push({ t:rnd()*80, g:i }); return out; }
    if (OPT.throw==='handful'){
      let t=0, i=0, g=0;
      while (i<n){
        const size=irr?rint(2,6):4;
        for (let k=0;k<size && i<n;k++,i++) out.push({ t:t+(bloom?rint(0,60):rint(0,6)), g });
        g++; t+=irr?rint(170,320):230;
      }
      return out;
    }
    const base=n<=3?90:n<=10?60:34; let t=0;
    for (let i=0;i<n;i++){ out.push({ t, g:i }); t+=irr?base*(.35+rnd()*1.6):base; }
    return out;
  }
  // items: [{ b, to, onStart }]
  function throwAll(items,extra){
    const r=rhythm(items.length), group={}, bloom=OPT.hand==='bloom';
    const big=extra&&extra.big?{ done:false }:null;
    return Promise.all(items.map((it,i)=>{
      const g=r[i].g;
      if (!group[g]) group[g]={ T:.9+rnd()*.2, flips:OPT.flips==='many'?rint(2,6):1 };
      const dist=Math.hypot(it.to.x-it.b.x,it.to.y-it.b.y);
      let T=flightT(dist);
      if (OPT.throw==='splash') T*=rr(.8,1.25);
      else if (OPT.throw==='handful') T*=bloom?group[g].T*rr(.86,1.14):group[g].T;
      if (bloom||OPT.throw!=='handful'){ it.b.x+=rr(-3,3); it.b.y+=rr(-2,2); }
      const loose=!it.to.slot&&!it.to.vanish&&!it.to.mouth;
      return launch(it.b,it.to,{ big, wait:r[i].t, T:OPT.air==='gravity'?T:undefined, i,
        jx:loose||bloom?rr(-7,7):0, jy:loose||bloom?rr(-4,4):0,
        flips:OPT.throw==='handful'&&!bloom?group[g].flips:undefined, onStart:it.onStart });
    }));
  }

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
    gen++;
    active.clear(); dirty.clear(); freeze=0;
    if (air) air.innerHTML=''; if (shadows) shadows.innerHTML='';
    Object.values(zones).forEach(z=>clearTimeout(z.timer));
    Object.keys(zones).forEach(k=>delete zones[k]);
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
    buildTable();
    potValue=0; paintPot(0);
    coloursFor(1000).forEach(col=>bank.chips.push(makeChip(col)));
    bank.apply({snap:true});
    status('Ready');
  }

  function buildTable(){
    const felt=$('felt'), fr=felt.getBoundingClientRect();
    felt.querySelectorAll('.cl-spot,.cl-pot,.ct-chute').forEach(el=>el.remove());
    $('pot-area').classList.remove('hidden');
    const pr=$('pot-area').querySelector('.pot-chip').getBoundingClientRect();
    const ring=document.createElement('div'); ring.className='cl-pot';
    Object.assign(ring.style,{ width:'240px', height:'40px', left:Math.round(pr.left+pr.width/2-fr.left-120)+'px', top:Math.round(pr.top-fr.top-44)+'px' });
    felt.appendChild(ring);
    zone('pot',pr.left+pr.width/2,pr.top-16,9,15);
    spotEls={}; chutes={};
    P.forEach(p=>{
      const el=document.createElement('div'); el.className='cl-spot'+(p.isHuman?' is-you':'');
      el.innerHTML='<div class="cl-spot-ring"></div><div class="cl-spot-plate"><span>0</span></div>';
      felt.appendChild(el);
      let x,y;
      if (p.isHuman){ x=fr.width*.80; y=fr.height*.80; }
      else {
        const cr=seatEls[p.id].cardsContainer.getBoundingClientRect();
        const ax=cr.left+cr.width/2-fr.left, ay=cr.bottom-fr.top, px=pr.left+pr.width/2-fr.left, py=pr.top-fr.top-40;
        x=ax+(px-ax)*.22; y=Math.max(ay+56, ay+(py-ay)*.3);
        if (OPT.source==='chute'){
          const ch=document.createElement('div'); ch.className='ct-chute';
          ch.style.left=Math.round(ax)+'px'; ch.style.top=Math.round(ay+11)+'px';
          felt.appendChild(ch); chutes[p.id]=ch;
        }
      }
      el.style.left=Math.round(x)+'px'; el.style.top=Math.round(y)+'px';
      spotEls[p.id]=el;
      zone('spot:'+p.id,fr.left+x,fr.top+y+2,7,5);
    });
    const hl=$('hud-left');
    hl.querySelectorAll('.cl-bank,.cl-hatch,.cl-tidy-hint').forEach(el=>el.remove());
    hl.dataset.bank='tidy';
    const bankEl=document.createElement('div'); bankEl.className='cl-bank'; hl.appendChild(bankEl);
    const hatch=document.createElement('div'); hatch.className='cl-hatch'; hatch.innerHTML='<i></i><i></i>'; hl.appendChild(hatch);
    const hint=document.createElement('div'); hint.className='cl-tidy-hint'; hint.textContent='TAP TO TIDY'; hl.appendChild(hint);
    bank=new BankPile(bankEl);
    hl.onclick=tidyBank;
    felt.onclick=()=>{ if (OPT.after==='tap') Object.values(zones).forEach(z=>{ if (!zoneBusy(z)) tidyZone(z); }); };
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
  function plate(id){ const z=zones['spot:'+id], el=spotEls[id]; el.classList.toggle('has-bet',z.amount>0); el.querySelector('.cl-spot-plate span').textContent=z.amount.toLocaleString(); }
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
  // The target for a chip landing in zone z: its neat slot, or loose.
  function targetIn(z,b){
    if (OPT.after==='neat'){
      if (b.zone!==z){ if (b.zone) removeFromZone(b); b.zone=z; z.list.push(b); }
      const s=neatSlots(z,z.list).get(b);
      return { x:s.x, y:s.y, z:s.z, zone:z, slot:true, d:D() };
    }
    z.neat=false;
    return { x:z.cx+rr(-5,5), y:z.cy+rr(-3,3), z:0, zone:z, d:D() };
  }
  const waitMs=ms=>new Promise(r=>setTimeout(r,motionOff()?0:ms/OPT.speed));
  async function zoneSettled(z,max){
    const t0=performance.now(), my=gen;
    while (performance.now()-t0<(max||5000)/OPT.speed && my===gen){
      if (!zoneBusy(z) && (OPT.after!=='auto' || z.neat)) return;
      await new Promise(r=>setTimeout(r,60));
    }
  }
  function guard(my){ if (my!==gen) throw new Error('cancelled'); }

  /* ---------------- moves ---------------- */
  function chuteKick(ch){ if (!ch) return; ch.classList.remove('is-kick'); void ch.offsetWidth; ch.classList.add('is-kick'); sfx('chute'); }
  async function oppBet(p,amount,label,big){
    const my=gen;
    p.chips=Math.max(0,p.chips-amount); updateSeatReels(seatEls[p.id].chips,p.chips);
    say(p.name.toUpperCase(),label.toUpperCase(),p.chips?'':'act-allin',p);
    const z=zones['spot:'+p.id]; z.amount+=amount; plate(p.id);
    if (OPT.source==='chute' && chutes[p.id] && OPT.juice==='on' && !motionOff()){ chutes[p.id].classList.add('is-rattle'); await waitMs(120); chutes[p.id].classList.remove('is-rattle'); }
    guard(my);
    const items=coloursFor(amount).map(col=>{
      const s=source(p), b=body(makeChip(col),s.x,s.y,s.z,D()-2);
      return { b, to:targetIn(z,b), onStart:()=>chuteKick(s.chute) };
    });
    await throwAll(items,{ big });
    await zoneSettled(z,2500);
  }
  async function youBet(amount,label,big){
    const my=gen;
    const you=P[0]; you.chips=Math.max(0,you.chips-amount); updateJackpot(you.chips);
    you.totalBetHand+=amount; updateInvestedReel(you.totalBetHand);
    say('YOU',label.toUpperCase());
    const z=zones['spot:you']; z.amount+=amount; plate('you');
    const items=[];
    for (const col of coloursFor(amount)){
      const t=bank.take(); if (!t) break;
      if (t.c.colour!==col){ t.c.colour=col; t.c.frame=-1; if (OPT.art!=='pixel') styleChip(t.c); }
      const r=t.rect, b=body(t.c,r.left+r.width/2,r.bottom,0,r.width);
      items.push({ b, to:targetIn(z,b) });
    }
    bank.apply({ slideMs:160 });
    guard(my);
    await throwAll(items,{ big });
    await zoneSettled(z,2500);
  }
  function neatFill(z,amount){
    z.amount+=amount;
    coloursFor(amount).forEach(col=>{ const b=body(makeChip(col),z.cx,z.cy,0,D()); b.zone=z; z.list.push(b); });
    const s=neatSlots(z,z.list);
    z.list.forEach(b=>{ const q=s.get(b); b.x=q.x; b.y=q.y; b.z=q.z; b.state='rest'; dirty.add(b); });
    z.neat=true; kick();
  }
  async function sweep(){
    const my=gen;
    let ids=Object.keys(zones).filter(k=>k.startsWith('spot:') && zones[k].list.length);
    if (!ids.length){
      // nothing out there yet: put some bets down so the sweep has work
      [['maniac',180],['wild',180],['you',180]].forEach(([id,a])=>{ neatFill(zones['spot:'+id],a); plate(id); });
      ids=Object.keys(zones).filter(k=>k.startsWith('spot:') && zones[k].list.length);
      await waitMs(600); guard(my);
    }
    say('DEALER','SWEEP');
    const pot=zones.pot, total=ids.reduce((a,k)=>a+zones[k].amount,0), all=[];
    ids.forEach((k,si)=>{
      const z=zones[k], list=z.list.slice(); z.list.length=0;
      spotEls[k.slice(5)].classList.add('is-sweeping');
      const off={ x:pot.cx-z.cx+rr(-12,12), y:pot.cy-z.cy+rr(-4,4) };
      list.forEach((b,ci)=>{
        b.zone=pot; pot.list.push(b);
        let tx=b.x+off.x, ty=b.y+off.y, tz=b.z;
        if (OPT.after==='neat'){ const s=neatSlots(pot,pot.list).get(b); tx=s.x; ty=s.y; tz=s.z; }
        b.tx=tx; b.ty=ty; b.tz=tz; b.lift=3;
        const dist=Math.hypot(tx-b.x,ty-b.y);
        if (OPT.sweep==='push'){ b.T=.34+dist/1500; b.wait=si*70; }
        else { b.T=.42; b.wait=si*55+ci*14; b.lift=6; }
        b.state='wait'; b.next='push'; b.target={}; b.opts={}; active.add(b);
        all.push(new Promise(res=>{ b.resolve=res; }));
      });
    });
    kick();
    if (OPT.after!=='neat') pot.neat=false;
    const count=countPot(potValue+total,560+ids.length*60);
    await Promise.all(all); await count; guard(my);
    sfx('collect',.6);
    ids.forEach(k=>{ zones[k].amount=0; const id=k.slice(5); spotEls[id].classList.remove('is-sweeping'); plate(id); });
    // the dealer squares the pot (unless the mess is waiting for a tap)
    if (OPT.after==='auto'){ await waitMs(200); guard(my); await tidyZone(pot); }
  }
  async function ensurePot(){
    const pot=zones.pot;
    if (pot.list.length) return;
    neatFill(pot,2000); potValue=2000; paintPot(2000);
    await waitMs(400);
  }
  // Pot -> your bank: thrown at the hatch, then dropped inside the tray.
  function dropIntoBank(b){
    const res=b.resolve; b.resolve=null;
    removeBody(b);
    const c=b.chip, hr=$('hud-left').getBoundingClientRect();
    c.loose=true;
    bank.chips.push(c);
    bank.apply({ snap:true });
    const r=c.el.getBoundingClientRect();
    const dx=b.x-(r.left+r.width/2), dy=(hr.top+4)-r.top;
    if (!motionOff()){
      c.el.animate(OPT.bounces==='multi'?[
        { transform:'translate('+dx+'px,'+dy+'px)', easing:'cubic-bezier(.55,0,1,.6)' },
        { transform:'translate(0,1px) scale(1.08,.86)', offset:.72, easing:'steps(1,end)' },
        { transform:'translate(0,-4px)', offset:.84, easing:'cubic-bezier(.3,0,.7,1)' },
        { transform:'none' }
      ]:[
        { transform:'translate('+dx+'px,'+dy+'px)', easing:'cubic-bezier(.55,0,1,.6)' },{ transform:'none' }
      ],{ duration:300/OPT.speed });
      setTimeout(()=>sfx('land'),210/OPT.speed);
    }
    if (res) setTimeout(res,motionOff()?0:300/OPT.speed);
  }
  async function payYou(){
    const my=gen;
    await ensurePot(); guard(my);
    const pot=zones.pot, you=P[0], won=potValue, start=you.chips;
    say('YOU WIN',won.toLocaleString());
    const hl=$('hud-left'), hatch=hl.querySelector('.cl-hatch');
    hatch.classList.add('is-open'); sfx('hatch');
    await waitMs(160); guard(my);
    const hr=hatch.getBoundingClientRect();
    const list=pot.list.slice().sort((a,c)=>c.z-a.z||a.y-c.y); pot.list.length=0;
    list.forEach(b=>{ b.zone=null; });
    const n=list.length; let landed=0;
    const items=list.map(b=>({ b, to:{ x:hr.left+hr.width*rr(.35,.65), y:hr.bottom, z:0, mouth:true, d:bank.diam } }));
    const tallied=throwAll(items).then(()=>{});
    items.forEach(it=>{ const r=it.b.resolve; it.b.resolve=()=>{ landed++; paintPot(Math.round(won*(1-landed/n))); you.chips=Math.round(start+won*landed/n); updateJackpot(you.chips); if (r) r(); }; });
    await tallied; guard(my);
    you.chips=start+won; updateJackpot(you.chips); potValue=0; paintPot(0);
    await waitMs(160);
    hatch.classList.remove('is-open'); sfx('hatchClose');
  }
  async function payOpp(p){
    const my=gen;
    await ensurePot(); guard(my);
    const pot=zones.pot, won=potValue, z=zones['spot:'+p.id];
    say(p.name.toUpperCase()+' WINS',won.toLocaleString());
    // the dealer pushes the whole pot across in one slide...
    const list=pot.list.slice(); pot.list.length=0;
    const off={ x:z.cx-pot.cx, y:z.cy-pot.cy };
    const all=list.map((b,i)=>{
      b.zone=z; z.list.push(b);
      b.tx=b.x+off.x; b.ty=b.y+off.y; b.tz=b.z; b.lift=4; b.T=.5; b.wait=(i%6)*6; b.state='wait'; b.next='push'; b.target={}; b.opts={}; active.add(b);
      return new Promise(res=>{ b.resolve=res; });
    });
    kick();
    z.amount=won; plate(p.id);
    await Promise.all([Promise.all(all), countPot(0,520)]); guard(my);
    sfx('collect',.6);
    await waitMs(420); guard(my);
    // ...and it goes back into the seat in the current throw style
    const back=z.list.slice().sort((a,c)=>c.z-a.z); z.list.length=0; z.amount=0; plate(p.id);
    const items=back.map(b=>{ b.zone=null; const s=source(p); return { b, to:{ x:s.x, y:s.y, z:s.z, vanish:true, d:D()-4 } }; });
    await throwAll(items); guard(my);
    p.chips+=won; updateSeatReels(seatEls[p.id].chips,p.chips);
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
      sfx('tooth'); await waitMs(120);
    }
    await waitMs(160); sfx('lock');
    hl.classList.remove('is-tidying'); tidying=false;
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
      if (kind==='opp-bet'){ const p=pl(OPPS[oppTurn++%OPPS.length]); await oppBet(p,180,'Raise 180'); }
      else if (kind==='opp-allin'){ const p=pl('maniac'); await oppBet(p,p.chips||1000,'All-In',true); }
      else if (kind==='you-bet') await youBet(180,'Call 180');
      else if (kind==='you-allin') await youBet(P[0].chips,'All-In',true);
      else if (kind==='sweep') await sweep();
      else if (kind==='pay-you') await payYou();
      else if (kind==='pay-opp') await payOpp(pl('maniac'));
      else if (kind==='street'){
        await oppBet(pl('wild'),60,'Bet 60'); await waitMs(200); guard(my);
        await oppBet(pl('maniac'),180,'Raise 180'); await waitMs(200); guard(my);
        await youBet(180,'Call 180'); await waitMs(160); guard(my);
        await oppBet(pl('wild'),120,'Call 180'); await waitMs(450); guard(my);
        await sweep();
      }
      else if (kind==='showdown'){
        await oppBet(pl('maniac'),pl('maniac').chips||1000,'All-In',true); await waitMs(250); guard(my);
        await youBet(P[0].chips,'All-In',true); await waitMs(450); guard(my);
        await sweep(); await waitMs(500); guard(my);
        await payYou();
      }
      if (my===gen) status(OPT.after==='tap'?'Done · tap the felt to tidy':'Done · ↻ to replay');
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
  function wire(){
    document.querySelectorAll('.cl-seg').forEach(seg=>seg.addEventListener('click',ev=>{
      const b=ev.target.closest('button'); if (!b) return;
      const k=seg.dataset.opt, v=b.dataset.v;
      if (k==='preset'){ OPT.preset=v; Object.assign(OPT,PRESETS[v]); }
      else { OPT[k]=k==='speed'?Number(v):v; if (!['speed','sound'].includes(k)) OPT.preset='custom'; }
      settings.sound=OPT.sound==='on';
      syncPanel();
      if (['source','preset','art','size','after'].includes(k)) setup();
    }));
    document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.run)));
    $('ct-gear').addEventListener('click',()=>{ const d=$('ct-drawer'); d.hidden=!d.hidden; $('ct-gear').classList.toggle('is-on',!d.hidden); });
  }

  async function init(){
    const q=new URLSearchParams(location.search);
    if (q.get('preset') && PRESETS[q.get('preset')]){ OPT.preset=q.get('preset'); Object.assign(OPT,PRESETS[OPT.preset]); }
    Object.keys(OPT).forEach(k=>{ if (q.get(k) && k!=='preset') OPT[k]=k==='speed'?Number(q.get(k)):q.get(k); });
    if (q.get('reduce')==='1') settings.reduceMotion=true;
    await mountTable();
    syncPanel(); wire();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    setup();
    window.__chipThrowLab={ run, OPT, setup, busy:()=>busy,
      state:()=>({ bank:bank.chips.length, pot:zones.pot.list.length, potNeat:zones.pot.neat, active:active.size,
        air:air?air.querySelectorAll('.cl-chip').length:0, you:P[0].chips,
        spots:Object.keys(zones).filter(k=>k.startsWith('spot:')).map(k=>k.slice(5)+':'+zones[k].list.length).join(' ') }) };
  }
  init().catch(err=>{ console.error('[chip-throw-lab]',err); status('Failed to mount — serve over http'); });
})();
