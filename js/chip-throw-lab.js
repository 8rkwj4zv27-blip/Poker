/* ============================================================
   CHIP THROW LAB v3 — how chips travel (docs/ui/CHIP_PLAN.md).

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

  /* ---------------- options & presets ---------------- */
  const BASE={ art:'gold', size:'m', shadow:'on', throw:'bybet', hand:'bloom', timing:'irregular', flips:'many', toss:'on',
    source:'edge', bounces:'multi', rock:'on', roll:'on', knock:'on', juice:'on', after:'tap', sweep:'push', random:'fresh' };
  const OPT={ preset:'v3', ...BASE, speed:1, sound:'on' };
  const PRESETS={
    v3:   { ...BASE },
    auto: { ...BASE, after:'auto' },
    chaos:{ ...BASE, throw:'splash', after:'tap' },
    today:{ art:'current', size:'l', shadow:'off', throw:'stream', hand:'rigid', timing:'even', flips:'one', toss:'off',
            source:'face', bounces:'one', rock:'off', roll:'off', knock:'off', juice:'off', after:'neat', sweep:'stream', random:'same', eased:true }
  };
  const NOTES={
    v3:'Your v2 settings plus v3: gold coins, walls and solid cards, controlled landings, heavier physics, throws by bet size, coin tosses. The mess stays until you tap the felt.',
    auto:'As V3, but once everything is still the machine tidies each pile into stacks by itself.',
    chaos:'Every bet is one big splash. The mess stays until you tap the felt.',
    today:'What the game does now, for reference: one chip at a time on smooth swaying arcs, out of the face.',
    custom:'Your own mix.'
  };
  const SIZES={ s:13, m:15, l:17 };
  const D=()=>SIZES[OPT.size];
  const STEP=()=>Math.max(2,Math.round(D()*.2));
  const eased=()=>!!OPT.eased;

  /* ---------------- random (fresh every run unless "same") ---------------- */
  let seed=7;
  function reseed(){ seed=OPT.random==='same'?7:((Date.now()^Math.floor(Math.random()*1e9))>>>0)||7; }
  function rnd(){ seed=(seed*1103515245+12345)>>>0; return (seed>>>8)/0x1000000; }
  const rint=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  const rr=(a,b)=>a+rnd()*(b-a);

  /* ---------------- chip language ---------------- */
  const COLOURS=['d-white','d-red','d-blue','d-green','d-black','d-purple','d-yellow'];
  const BB=20;
  function coloursFor(amount){
    const n=visualChipCount(amount), out=[];
    if (OPT.art==='gold'){ for (let i=0;i<n;i++) out.push('gold'); return out; }
    const centre=Math.max(0,Math.min(6,Math.log(Math.max(.5,amount/BB))/Math.log(3.2)));
    for (let i=0;i<n;i++){ const r=rnd(); out.push(COLOURS[Math.max(0,Math.min(6,Math.round(centre)+(r<.55?0:r<.85?-1:1)))]); }
    return out;
  }

  /* ============================================================
     PIXEL ART — chips and coins drawn by code at their real size.
     Frames per tilt c (1 = face-on, 0 = edge-on) for the FRONT and a
     darker BACK, so a flip visibly turns over. Resting chips use the
     table's viewing tilt (.82).
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
  //                 face       rim/edge    highlight  inner line  outline
  const GOLD={ face:'#f2c23c', rim:'#c98c16', hi:'#fff1a6', line:'#b87d10', ink:'#3a2206', band:'#a8690c', band2:'#e0a52a' };
  const TILTS=[1,.82,.6,.38,.18,0];
  const REST=1;
  const frameCache={};
  function hex(h){ const n=parseInt(h.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
  const dark=(p,k)=>p.map(v=>Math.round(v*k));
  function shape(d,c){
    const rx=d/2-.5, ry=Math.max(.6,rx*c), th=Math.max(2,Math.round(d*.2)), band=th*Math.sqrt(1-c*c);
    return { rx, ry, band, cy:(d-(2*ry+band))/2+ry, cx:d/2 };
  }
  // paint(nx,ny,r,a) -> colour for a face pixel; bandPaint(nx) for the edge
  function render(d,c,paint,bandPaint,ink){
    const cv=document.createElement('canvas'); cv.width=d; cv.height=d;
    const ctx=cv.getContext('2d'), img=ctx.createImageData(d,d), px=img.data;
    const s=shape(d,c), fill=new Array(d*d).fill(null);
    for (let y=0;y<d;y++) for (let x=0;x<d;x++){
      const nx=(x+.5-s.cx)/s.rx; if (Math.abs(nx)>1) continue;
      const ny=(y+.5-s.cy)/s.ry, r=Math.hypot(nx,ny);
      if (r<=1) fill[y*d+x]=paint(nx,ny,r,Math.atan2(ny,nx),s);
      else { const span=Math.sqrt(1-nx*nx)*s.ry, yy=y+.5; if (yy>=s.cy-span && yy<=s.cy+s.band+span) fill[y*d+x]=bandPaint(nx,s,x); }
    }
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
  function chipFrame(col,d,c,back){
    let [face,edge,hi,notch]=PAL[col].map(hex); const ink=[13,15,12];
    if (back){ face=dark(face,.8); hi=dark(hi,.8); notch=dark(notch,.85); }
    return render(d,c,(nx,ny,r,a,s)=>{
      const nd=Math.min(...[-2.356,-.785,.785,2.356].map(k=>Math.abs(Math.atan2(Math.sin(a-k),Math.cos(a-k)))));
      if (r>.7 && nd<.3) return notch;
      if (Math.abs(r-.56)<.9/Math.max(3,Math.min(s.rx,s.ry*1.6))) return edge;
      if (!back && r>.6 && r<.9 && a<-1.7 && a>-2.9) return hi;
      return face;
    },(nx,s)=>([-.55,0,.55].some(k=>Math.abs(nx-k)<1.1/s.rx)&&s.band>=1.5?notch:edge),ink);
  }
  // A plain gold video-game coin: bright face, darker rim, a slot line down
  // the middle, a highlight stripe; reeded edge; darker, plainer back.
  function coinFrame(d,c,back){
    let face=hex(GOLD.face), rim=hex(GOLD.rim), hi=hex(GOLD.hi), line=hex(GOLD.line);
    const band=hex(GOLD.band), band2=hex(GOLD.band2), ink=hex(GOLD.ink);
    if (back){ face=dark(face,.84); rim=dark(rim,.84); hi=dark(hi,.86); line=dark(line,.84); }
    return render(d,c,(nx,ny,r,a,s)=>{
      if (r>.74) return (!back && a<-1.6 && a>-2.8) ? hi : rim;
      if (!back && Math.abs(nx)<.8/s.rx && Math.abs(ny)<.5) return line;
      if (!back && nx>-.62 && nx<-.34 && Math.abs(ny)<.42) return hi;
      if (back && Math.abs(nx)<.8/s.rx && Math.abs(ny)<.4) return line;
      return face;
    },(nx,s,x)=>(x%2?band:band2),ink);
  }
  function frames(col,d){
    const k=col+'|'+d;
    if (frameCache[k]) return frameCache[k];
    const make=(c,back)=>col==='gold'?coinFrame(d,c,back):chipFrame(col,d,c,back);
    return frameCache[k]={ front:TILTS.map(c=>make(c,false)), back:TILTS.map(c=>make(c,true)) };
  }
  const tiltIndex=c=>{ let best=0; TILTS.forEach((t,i)=>{ if (Math.abs(t-c)<Math.abs(TILTS[best]-c)) best=i; }); return best; };
  const pixelArt=()=>OPT.art==='gold'||OPT.art==='pixel';

  /* ---------------- chip element ---------------- */
  function makeChip(colour){
    const el=document.createElement('div');
    const c={ el, colour, variant:'v-'+rint(1,3), jx:rint(-1,1), lean:rint(-1,1), loose:true, frame:'' };
    styleChip(c);
    return c;
  }
  function styleChip(c){
    if (pixelArt()) c.el.className='cl-chip ct-px';
    else { c.el.className='chip-disc cl-chip '+c.colour+' '+c.variant; c.el.style.backgroundImage=''; }
    c.frame='';
  }
  function setFrame(c,d,i,back){
    if (!pixelArt()) return;
    const key=d+'|'+i+'|'+(back?1:0); if (c.frame===key) return;
    c.frame=key; const f=frames(c.colour,d); c.el.style.backgroundImage=(back?f.back:f.front)[i];
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
        if (pixelArt()) el.style.backgroundImage=bg;
        el.style.width=d+'px'; el.style.height=d+'px'; el.style.left=p.x+'px'; el.style.bottom=p.y+'px'; el.style.zIndex=String(p.z);
        el._base=0; c.frame=''; setFrame(c,d,REST,false);
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
    const now=performance.now(), gap={ land:26, bounce:22, roll:90, chute:40, collect:60, knock:40, wall:50, rock:60 }[kind]||30;
    if (now-(soundAt[kind]||0)<gap) return; soundAt[kind]=now;
    if (kind==='land') Sound.chipCollect(.32);                  // heavier than chipLand
    else if (kind==='bounce') Sound.chipBounce(Math.max(.2,Math.min(1,power||.5)));
    else if (kind==='knock') Sound.chipBounce(.75);
    else if (kind==='wall') Sound.chipBounce(.45);
    else if (kind==='roll') Sound.chipBounce(.16);
    else if (kind==='rock') Sound.chipLand();
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
  const G=3300;                 // px/s² — heavier than v2's 2600
  const FRICTION=1500;          // px/s² sliding friction on felt
  const GRIP=150;               // max horizontal px/s kept after first impact
  const ease={ inOut:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, out:t=>1-Math.pow(1-t,3) };
  let air=null, shadows=null, raf=0, lastT=0, freeze=0;
  const active=new Set(), dirty=new Set(), zones={};
  let WALLS=null;               // { felt:{L,T,R,B,rc}, blocks:[{L,T,R,B}] }

  function ensureLayers(){
    if (air) return;
    shadows=document.createElement('div'); shadows.className='ct-shadows'; document.body.appendChild(shadows);
    air=document.createElement('div'); air.className='ct-air'; document.body.appendChild(air);
  }
  function kick(){ if (!raf){ lastT=performance.now(); raf=requestAnimationFrame(loop); } }
  function loop(now){
    let dt=Math.min(.035,(now-lastT)/1000)*OPT.speed; lastT=now;
    if (freeze>0){ freeze-=dt; dt=0; }
    const reduced=motionOff();
    for (const b of Array.from(active)){
      if (reduced){ snap(b); continue; }
      if (b.state==='wait'){ b.wait-=dt*1000; if (b.wait>0) continue; begin(b); }
      if (dt>0){
        // two half-steps: collisions and walls stay solid at speed
        step(b,dt/2); if (b.state!=='rest' && active.has(b)) step(b,dt/2);
      }
      dirty.add(b);
    }
    dirty.forEach(draw); dirty.clear();
    raf=(active.size||freeze>0)?requestAnimationFrame(loop):0;
  }

  function body(chip,x,y,z,d){
    ensureLayers();
    const b={ chip, el:chip.el, colour:chip.colour, x, y, z:z||0, d, d0:d, d1:d, vx:0, vy:0, vz:0, rot:0, vr:0, phi:0, fr:0,
      tilt:1, back:false, sq:0, state:'rest', zone:null, bounces:0, maxB:1, e:.25, t:0, target:{}, opts:{}, inFelt:false };
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
    if (b.zone) removeFromZone(b);
  }
  function removeFromZone(b){ const i=b.zone.list.indexOf(b); if (i>=0) b.zone.list.splice(i,1); b.zone=null; }
  function toRest(b){ b.state='rest'; b.t=0; b.vx=b.vy=b.vz=0; active.delete(b); dirty.add(b); kick(); onRest(b); }

  /* ---------------- walls: the rail and the solid things on the felt ---------------- */
  function buildWalls(){
    const f=$('felt').getBoundingClientRect(), inset=13;
    const blocks=[];
    const add=el=>{ if (!el) return; const r=el.getBoundingClientRect(); if (r.width>2 && r.height>2) blocks.push({ L:r.left, T:r.top, R:r.right, B:r.bottom }); };
    document.querySelectorAll('#board .card').forEach(add);
    add($('dealer-deck'));
    add(document.querySelector('#pot-area .pot-chip'));
    document.querySelectorAll('#felt .seat-card').forEach(add);
    document.querySelectorAll('#hud-mid .seat-cards .card').forEach(add);
    WALLS={ felt:{ L:f.left+inset, T:f.top+inset, R:f.right-inset, B:f.bottom-inset, rc:40 }, blocks };
  }
  const insideFelt=(x,y)=>WALLS && x>WALLS.felt.L && x<WALLS.felt.R && y>WALLS.felt.T && y<WALLS.felt.B;
  // Keeps a chip's footprint (x±r, y-d..y) on the felt and off every block.
  // Returns true if it hit something (velocity reflected, heavily damped).
  function contain(b){
    if (!WALLS) return false;
    const r=b.d/2, d=b.d; let hit=false;
    const F=WALLS.felt;
    // rounded rail: corner arcs, then straight edges
    const cx=Math.min(Math.max(b.x,F.L+F.rc),F.R-F.rc), cy=Math.min(Math.max(b.y-r,F.T+F.rc),F.B-F.rc);
    const dx=b.x-cx, dy=(b.y-r)-cy, dist=Math.hypot(dx,dy), lim=F.rc-r;
    if ((dx||dy) && dist>lim && Math.abs(dx)>0 && Math.abs(dy)>0){
      const nx=dx/dist, ny=dy/dist; b.x=cx+nx*lim; b.y=cy+ny*lim+r;
      const vn=b.vx*nx+b.vy*ny; if (vn>0){ b.vx-=1.5*vn*nx; b.vy-=1.5*vn*ny; } hit=true;
    }
    if (b.x<F.L+r){ b.x=F.L+r; if (b.vx<0) b.vx*=-.45; hit=true; }
    if (b.x>F.R-r){ b.x=F.R-r; if (b.vx>0) b.vx*=-.45; hit=true; }
    if (b.y<F.T+d){ b.y=F.T+d; if (b.vy<0) b.vy*=-.45; hit=true; }
    if (b.y>F.B){ b.y=F.B; if (b.vy>0) b.vy*=-.45; hit=true; }
    for (const k of WALLS.blocks){
      const L=k.L-r, R=k.R+r, T=k.T-1, B=k.B+d*.85;
      if (b.x<=L || b.x>=R || b.y<=T || b.y>=B) continue;
      const pl=b.x-L, pr=R-b.x, pt=b.y-T, pb=B-b.y, m=Math.min(pl,pr,pt,pb);
      if (m===pl){ b.x=L; if (b.vx>0) b.vx*=-.4; }
      else if (m===pr){ b.x=R; if (b.vx<0) b.vx*=-.4; }
      else if (m===pt){ b.y=T; if (b.vy>0) b.vy*=-.4; }
      else { b.y=B; if (b.vy<0) b.vy*=-.4; }
      hit=true;
    }
    return hit;
  }
  function inBlock(x,y,d){
    if (!WALLS) return false;
    return WALLS.blocks.some(k=>x>k.L-d/2 && x<k.R+d/2 && y>k.T-1 && y<k.B+d*.85);
  }

  /* ---------------- zones: bet spots and the pot ---------------- */
  function zone(id,cx,cy,cap,maxSlots,radius){ return zones[id]={ id, cx, cy, cap, maxSlots, radius, list:[], neat:true, timer:0, amount:0 }; }
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
    z.timer=setTimeout(()=>{ if (zones[z.id]!==z) return; if (!zoneBusy(z) && !z.neat) tidyZone(z); else if (!z.neat) scheduleTidy(z); }, 380/OPT.speed);
  }
  function tidyZone(z){
    if (z.tidying) return z.tidying;
    if (z.neat || !z.list.length) return Promise.resolve();
    z.neat=true; clearTimeout(z.timer);
    const slots=neatSlots(z,z.list), groups=[...new Set(z.list.map(b=>b.colour))], done=[];
    const colourless=groups.length===1;
    z.list.forEach((b,i)=>{
      const s=slots.get(b), gi=colourless?Math.floor(s.n/3):groups.indexOf(b.colour);
      if (Math.hypot(s.x-b.x,s.y-b.y)<.6 && Math.abs(s.z-b.z)<.6) return;
      done.push(new Promise(res=>{
        const dist=Math.hypot(s.x-b.x,s.y-b.y);
        b.tx=s.x; b.ty=s.y; b.tz=s.z; b.resolve=res;
        b.T=.14+Math.min(.14,dist/900); b.arc=5+Math.min(14,dist*.12);
        b.wait=colourless?(s.n*55+(i%3)*12):(gi*95+s.n*22); b.state='wait'; b.next='tidy'; active.add(b); kick();
      }));
    });
    const beats=colourless?Math.max(...z.list.map(b=>slots.get(b).n))+1:groups.length;
    for (let g=0;g<beats;g++) setTimeout(()=>sfx('tooth'),g*(colourless?55:95)/OPT.speed);
    z.tidying=Promise.all(done).then(()=>{ z.tidying=null; if (done.length) sfx('lock'); });
    return z.tidying;
  }

  /* ---------------- launch ---------------- */
  // Target t = { x, y, z, d, zone?, slot?, vanish?, mouth? }
  function launch(b,t,o){
    o=o||{};
    b.target=t; b.opts=o; b.bounces=0; b.knocked=false; b.inFelt=false;
    b.maxB=OPT.bounces==='multi' ? rint(1,3) : 1;
    b.e=rr(.18,.32);
    b.d0=b.d; b.d1=t.d||D();
    if (t.zone && b.zone!==t.zone){ if (b.zone) removeFromZone(b); b.zone=t.zone; t.zone.list.push(b); }
    b.wait=o.wait||0; b.state='wait'; b.next=o.mode||(eased()?'eased':'air');
    b.el.style.visibility=b.wait>0?'hidden':''; if (b.sh) b.sh.style.visibility=b.wait>0?'hidden':'';
    active.add(b); dirty.add(b); kick();
    return new Promise(res=>{ b.resolve=res; });
  }
  const flightT=dist=>Math.min(.52,Math.max(.21,.19+dist/950));
  function begin(b){
    b.el.style.visibility=''; if (b.sh) b.sh.style.visibility='';
    if (b.opts.onStart){ const f=b.opts.onStart; b.opts.onStart=null; f(); }
    const t=b.target, s=b.next;
    b.x0=b.x; b.y0=b.y; b.z0=b.z; b.t=0;
    if (s==='tidy' || s==='push'){ b.state=s; return; }
    const dist=Math.hypot(t.x-b.x,t.y-b.y); b.dist=dist;
    if (s==='eased'){
      b.state='eased'; b.T=Math.min(.76,Math.max(.4,.38+dist/1100));
      b.hop=10+Math.min(26,dist*.06)+rnd()*6; b.spin=(rnd()<.5?-1:1)*(20+rnd()*40); b.lane=((b.opts.i||0)%5-2)*Math.min(8,dist*.02);
      return;
    }
    if (s==='shove'){
      // pushed along the felt: exactly enough speed to arrive; front coins tumble
      const L=Math.max(1,dist), v=Math.sqrt(2*FRICTION*L)*rr(.95,1.05);
      b.vx=(t.x-b.x)/L*v; b.vy=(t.y-b.y)/L*v; b.state='slide'; b.inFelt=true;
      if (b.opts.tumble){ b.state='air'; b.vz=rr(90,170); b.T=0; b.bounces=1; b.maxB=2; b.fr=Math.PI*rr(4,8); }
      return;
    }
    // ballistic: aim short by the predicted carry so the chip finishes on target
    b.state='air'; b.T=b.opts.T||flightT(dist);
    const vh=dist/b.T, vLand=G*b.T/2, grip=b.opts.grip||GRIP;
    // after the first impact: speed capped by grip, then x.55 per bounce
    const vHop=Math.min(vh,grip)*.55, hop=vHop*2*(vLand*.25)/G*(OPT.bounces==='multi'?1.3:1);
    const carry=t.vanish||t.mouth||t.slot?0:Math.min(dist*.45,hop+(vHop*.55*.7)**2/(2*FRICTION));
    let ax=t.x+(b.opts.jx||0), ay=t.y+(b.opts.jy||0);
    if (carry && dist>1){ ax-=(t.x-b.x)/dist*carry; ay-=(t.y-b.y)/dist*carry; }
    b.vx=(ax-b.x)/b.T; b.vy=(ay-b.y)/b.T;
    b.vz=((t.z||0)-b.z)/b.T+.5*G*b.T;
    const flips=b.opts.flips!=null?b.opts.flips:(OPT.flips==='many'?rint(2,6):1);
    b.fr=flips*Math.PI/b.T; b.phi=0;
    b.vr=pixelArt()?0:(OPT.flips==='many'?rr(-300,300):0);
    b.glint=!!b.opts.toss; b.glinted=false;
  }

  /* ---------------- step ---------------- */
  function step(b,dt){
    b.t+=dt;
    if (b.sq>0) b.sq-=dt;
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
        b.x+=b.vx*dt; b.y+=b.vy*dt; const pvz=b.vz; b.vz-=G*dt; b.z+=b.vz*dt; b.phi+=b.fr*dt; b.rot+=b.vr*dt;
        if (!b.bounces && b.T) b.d=b.d0+(b.d1-b.d0)*Math.min(1,b.t/b.T);
        b.tilt=Math.abs(Math.cos(b.phi)); b.back=Math.cos(b.phi)<0;
        if (b.glint && !b.glinted && pvz>0 && b.vz<=0){ b.glinted=true; glint(b); }
        if (t.vanish||t.mouth){ if (b.t>=b.T) arrive(b,false); break; }
        if (!b.inFelt && insideFelt(b.x,b.y)) b.inFelt=true;
        if (b.inFelt && b.z<b.d*.8 && b.t>.08 && contain(b)) sfx('wall');
        if (b.z<STEP()*1.5) collide(b);
        if (b.vz<0){
          const sup=t.slot?{ h:t.z||0, o:null }:(b.z<40?supportUnder(b):{ h:0, o:null });
          if (b.z<=sup.h) impact(b,sup.h,sup.o);
        }
        break;
      }
      case 'slide':{
        const v=Math.hypot(b.vx,b.vy);
        // the felt grips harder the further a chip strays from its spot
        let grip=1;
        if (b.zone){ const off=Math.hypot(b.x-b.zone.cx,(b.y-b.zone.cy)*1.4)-b.zone.radius; if (off>0) grip+=off/22; }
        const dec=FRICTION*grip*dt;
        if (v<=dec || v<8){ b.vx=0; b.vy=0; settle(b); break; }
        b.vx*=(v-dec)/v; b.vy*=(v-dec)/v;
        b.x+=b.vx*dt; b.y+=b.vy*dt;
        if (contain(b)) sfx('wall');
        collide(b);
        const sup=supportUnder(b);
        if (sup.h<b.z-.5){ b.state='air'; b.vz=0; b.fr=0; b.maxB=0; b.t=0; b.T=0; b.bounces=1; }
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
        b.tilt=0; b.back=false; b.rot=(4+14*k)*Math.sin(b.t*(13-6*k))*b.rdir; b.z=b.tz+1;
        if (contain(b)){ b.state='flat'; b.t=0; }
        if (Math.floor(b.t*8)!==b.tick){ b.tick=Math.floor(b.t*8); if (k<.9) sfx('roll'); }
        if (k>=1){ b.state='flat'; b.t=0; }
        break;
      }
      case 'flat':{
        const k=Math.min(1,b.t/.11); b.tilt=[0,.18,.38,.6,.82][Math.min(4,Math.floor(k*5))]; b.rot*=.5; b.z=b.tz||0;
        if (k>=1){ b.tilt=1; b.rot=0; b.sq=.05; sfx('land'); finishRest(b); }
        break;
      }
      case 'rock':{
        // a heavy tip or two, then a clunk: no shimmer
        const k=Math.min(1,b.t/b.T), seq=b.rockSeq;
        const i=Math.min(seq.length-1,Math.floor(k*seq.length));
        b.tilt=seq[i]; b.rx=(i%2?1:-1)*(i<seq.length-1?1:0);
        if (k>=1){ b.tilt=1; b.rx=0; b.sq=.05; sfx('rock'); finishRest(b); }
        break;
      }
      case 'tidy':{
        const k=Math.min(1,b.t/b.T), e=ease.inOut(k);
        b.x=b.x0+(b.tx-b.x0)*e; b.y=b.y0+(b.ty-b.y0)*e; b.z=b.z0+(b.tz-b.z0)*e+b.arc*Math.sin(Math.PI*k);
        b.tilt=k<1?.82:1; b.back=false;
        if (k>=1){ b.x=b.tx; b.y=b.ty; b.z=b.tz; b.tilt=1; b.sq=.05; sfx('land'); toRest(b); }
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

  function snap(b){
    b.el.style.visibility=''; if (b.sh) b.sh.style.visibility='';
    if (b.opts && b.opts.onStart) b.opts.onStart=null;
    const s=b.state==='wait'?b.next:b.state, t=b.target||{};
    b.tilt=1; b.rot=0; b.back=false; b.d=b.d1||b.d;
    if (s==='push' || s==='tidy'){ b.x=b.tx; b.y=b.ty; b.z=b.tz; toRest(b); return; }
    if (t.vanish || t.mouth){ arrive(b,true); return; }
    if (t.slot){ b.x=t.x; b.y=t.y; b.z=t.z||0; toRest(b); return; }
    if (t.x!=null && s!=='slide'){ b.x=t.x; b.y=t.y; }
    contain(b); b.z=supportUnder(b).h; finishRest(b);
  }

  function arrive(b,isEased){
    const t=b.target;
    if (t.vanish){ const r=b.resolve; b.resolve=null; removeBody(b); b.el.remove(); if (r) r(); return; }
    if (t.mouth){ dropIntoBank(b); return; }
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; skid(b,isEased?1:70); if (!isEased) sfx('land'); return; }
    b.z=supportUnder(b).h; b.vx=0; b.vy=0; settle(b);
  }

  function impact(b,ground,hit){
    const t=b.target, speed=-b.vz;
    b.z=ground; b.sq=.06;
    // landed on a card, the deck or the plate: it bounces off and away
    if (inBlock(b.x,b.y,b.d) && !t.slot){
      b.vz=Math.max(140,speed*.35); b.bounces=Math.min(b.bounces,b.maxB-1);
      const before={ x:b.x, y:b.y }; contain(b);
      const L=Math.max(1,Math.hypot(b.x-before.x,b.y-before.y));
      b.vx=(b.x-before.x)/L*120+b.vx*.3; b.vy=(b.y-before.y)/L*90+b.vy*.3; b.x=before.x; b.y=before.y;
      b.fr=Math.PI*3; sfx('wall'); return;
    }
    if (!b.knocked){
      b.knocked=true;
      // felt grip: the first impact takes most of the forward speed
      const vh=Math.hypot(b.vx,b.vy), cap=b.opts.grip||GRIP;
      if (vh>cap){ b.vx*=cap/vh; b.vy*=cap/vh; }
      if (OPT.juice==='on' && ground===0 && speed>300) puff(b.x,b.y,speed);
      if (b.opts.big && OPT.juice==='on' && !b.opts.big.done){ b.opts.big.done=true; freeze=.06; shake(); sfx('thump'); }
      knockAround(b,speed);
    }
    if (hit && !t.slot && rnd()<.5){ const L=Math.max(1,Math.hypot(b.x-hit.x,b.y-hit.y)); b.vx+=(b.x-hit.x)/L*rr(50,110); b.vy+=(b.y-hit.y)/L*rr(25,55); }
    if (b.bounces<b.maxB && speed>170){
      b.bounces++;
      b.vz=speed*b.e; b.fr*=.3;
      if (t.slot){ const tHop=2*b.vz/G; b.vx=(t.x-b.x)*.72/tHop; b.vy=(t.y-b.y)*.72/tHop; }
      else { b.vx*=.55; b.vy*=.55; }
      sfx('bounce',speed/900);
      return;
    }
    b.vz=0; b.fr=0; b.tilt=1; b.back=false;
    sfx('land');
    if (OPT.roll==='on' && ground<1 && rnd()<.08 && speed>140){ startRoll(b); return; }
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; skid(b,70+Math.min(120,Math.hypot(t.x-b.x,t.y-b.y)*4)); return; }
    b.vx*=.7; b.vy*=.7; b.state='slide';
  }
  function skid(b,ms){ b.x0=b.x; b.y0=b.y; b.T=ms/1000; b.t=0; b.state='skid'; }
  function startRoll(b){
    const t=b.target;
    b.state='roll'; b.t=0; b.T=rr(.45,.7); b.x0=b.x; b.y0=b.y; b.rdir=rnd()<.5?-1:1;
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; }
    else {
      const v=Math.hypot(b.vx,b.vy), L=rr(16,34);
      const ux=v>1?b.vx/v:rr(-1,1), uy=v>1?b.vy/v:rr(-.5,.5);
      b.tx=b.x+ux*L; b.ty=b.y+uy*L*.5; b.tz=0;
      // never roll onto a card
      if (inBlock(b.tx,b.ty,b.d)){ b.tx=b.x; b.ty=b.y; }
    }
    const mx=(b.x0+b.tx)/2, my=(b.y0+b.ty)/2, L=Math.max(12,Math.hypot(b.tx-b.x0,b.ty-b.y0));
    b.cx=mx-(b.ty-b.y0)/L*b.rdir*16; b.cy=my+(b.tx-b.x0)/L*b.rdir*6;
    sfx('bounce',.4);
  }
  function settle(b){
    const t=b.target||{};
    if (!t.slot){ contain(b); b.z=supportUnder(b).h; }
    if (OPT.rock==='on' && b.z<1 && rnd()<.22){
      b.state='rock'; b.t=0; b.T=rr(.2,.32);
      b.rockSeq=rnd()<.5?[.6,1,.82,1]:[.6,1];
      return;
    }
    finishRest(b);
  }
  function finishRest(b){ if (b.zone && !(b.target&&b.target.slot)) b.zone.neat=false; toRest(b); }

  // Equal-mass chip collisions: a moving chip shoves what it hits.
  function collide(b){
    if (!b.zone) return;
    for (const q of b.zone.list){
      if (q===b || Math.abs(q.z-b.z)>STEP()*1.5) continue;
      if (q.state!=='rest' && q.state!=='slide') continue;
      const dx=b.x-q.x, dy=(b.y-q.y)*1.4, dist=Math.hypot(dx,dy), min=b.d*.74;
      if (dist>=min || dist<.01) continue;
      const nx=dx/dist, ny=dy/dist, over=min-dist;
      const qMoves=q.z<1 && OPT.knock!=='off';
      const share=qMoves?.5:1;
      b.x+=nx*over*share; b.y+=ny*over*share/1.4;
      const rvx=b.vx-(q.vx||0), rvy=b.vy-(q.vy||0), vn=rvx*nx+rvy*ny;
      if (vn<0){
        const j=-(1.15)*vn/(qMoves?2:1);
        b.vx+=j*nx; b.vy+=j*ny;
        if (qMoves){
          q.vx=(q.vx||0)-j*nx; q.vy=(q.vy||0)-j*ny/1.4;
          if (q.state==='rest' && Math.hypot(q.vx,q.vy)>22){ q.target={}; q.zone.neat=false; q.state='slide'; q.t=0; active.add(q); }
          else if (q.state==='rest'){ q.vx=q.vy=0; }
        }
      }
      if (qMoves){ q.x-=nx*over*.5; q.y-=ny*over*.5/1.4; contain(q); dirty.add(q); }
    }
  }
  // A landing disturbs what's around it: shoves, or pops a chip loose.
  function knockAround(b,speed){
    if (!b.zone || OPT.knock==='off') return;
    const near=b.zone.list.filter(q=>q!==b && q.state==='rest' && Math.hypot(q.x-b.x,(q.y-b.y)*1.4)<b.d*1.2);
    if (b.target.slot){
      near.slice(0,5).forEach(q=>{ const tr=q.el.style.transform; q.el.animate([{transform:tr},{transform:tr+' translate('+rint(-2,2)+'px,-1px)'},{transform:tr}],{ duration:140/OPT.speed, easing:'steps(3,end)' }); });
      return;
    }
    let popped=0;
    near.sort((a,c)=>c.z-a.z).forEach(q=>{
      const L=Math.max(1,Math.hypot(q.x-b.x,q.y-b.y));
      if (speed>380 && popped<2 && rnd()<.5){
        popped++; b.zone.neat=false;
        pop(q,(q.x-b.x)/L*rr(50,110),(q.y-b.y)/L*rr(25,55),rr(170,260)+speed*.1,OPT.bounces==='multi'?rint(0,1):0);
        sfx('knock');
        b.zone.list.forEach(s=>{ if (s!==q && s.state==='rest' && s.z>q.z && Math.hypot(s.x-q.x,s.y-q.y)<q.d*.5) pop(s,(q.x-b.x)/L*rr(20,45),rr(-10,10),rr(50,100),0); });
      } else if (q.z<1){
        const imp=speed*.09;
        q.vx=(q.x-b.x)/L*imp; q.vy=(q.y-b.y)/L*imp*.6; q.target={}; q.state='slide'; q.t=0; active.add(q); b.zone.neat=false;
      }
    });
  }
  function pop(q,vx,vy,vz,maxB){
    q.target={}; q.opts={}; q.bounces=0; q.maxB=maxB; q.e=.22; q.knocked=true; q.inFelt=true;
    q.vx=vx; q.vy=vy; q.vz=vz; q.fr=rint(1,2)*Math.PI*3; q.phi=0; q.t=.1; q.T=0; q.d0=q.d1=q.d;
    q.state='air'; active.add(q); kick();
  }

  /* ---------------- juice ---------------- */
  function puff(x,y,speed){
    const p=document.createElement('i'); p.className='ct-puff'+(speed>650?' is-big':'');
    p.style.transform='translate('+Math.round(x)+'px,'+Math.round(y-2)+'px)';
    air.appendChild(p); setTimeout(()=>p.remove(),300/OPT.speed);
  }
  function glint(b){
    if (OPT.juice!=='on') return;
    const p=document.createElement('i'); p.className='ct-glint';
    p.style.transform='translate('+Math.round(b.x+b.d*.25)+'px,'+Math.round(b.y-b.z-b.d*.8)+'px)';
    air.appendChild(p); setTimeout(()=>p.remove(),260/OPT.speed);
  }
  function shake(){
    if (motionOff()) return;
    const k=[{transform:'translate(0,0)'},{transform:'translate(2px,1px)'},{transform:'translate(-2px,0)'},{transform:'translate(1px,-1px)'},{transform:'translate(0,0)'}];
    [$('stage-bay'),air,shadows].forEach(el=>{ if (el) el.animate(k,{ duration:170/OPT.speed, easing:'steps(4,end)' }); });
  }

  /* ---------------- draw ---------------- */
  function draw(b){
    if (!b.el.isConnected || b.el.parentNode!==air) return;
    const pixel=pixelArt();
    const lift=b.state==='air'?1+Math.min(.14,b.z/450):1;
    const dnow=Math.max(6,Math.round(b.d));
    const ti=b.state==='rest'?REST:(b.tilt>=.92?0:tiltIndex(b.tilt));
    let sx=1, sy=1;
    if (!b.el._base){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=dnow+'px'; }
    if (pixel){
      if (Math.abs(dnow-b.el._base)>1 && (b.state!=='air' || Math.abs(dnow-b.d1)<1)){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=dnow+'px'; }
      setFrame(b.chip,b.el._base,ti,b.back&&b.state!=='rest');
    } else if (b.state!=='rest'){
      sy=Math.max(.18,b.tilt);
      if (b.state==='roll'){ sx=.32; sy=1; }
    }
    if (b.sq>0){ sx*=1.16; sy*=.8; }
    const s=(b.d*lift)/b.el._base;
    const x=Math.round(b.x-b.el._base/2+(b.rx||0)), y=Math.round(b.y-b.z-b.d*lift/2-b.el._base/2+(b.sq>0?1:0));
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

  /* ============================================================
     THROWS. plan(n, kind) returns, per chip, when it leaves and how it
     flies. kind: flick (a call), lob (a raise: handfuls), shove (a big
     raise along the felt), heave (all-in: handfuls then a splash).
     OPT.throw 'bybet' picks the kind; the others force one.
     ============================================================ */
  function kindFor(amount,allin,canShove){
    if (OPT.throw==='stream') return 'stream';
    if (OPT.throw==='handful') return 'lob';
    if (OPT.throw==='splash') return 'splash';
    if (allin) return 'heave';
    if (amount<=3*BB) return 'flick';
    if (amount>=15*BB && canShove) return 'shove';
    return 'lob';
  }
  function plan(n,kind){
    const out=[], irr=OPT.timing==='irregular', bloom=OPT.hand==='bloom';
    const flips=()=>OPT.flips==='many'?rint(2,6):1;
    if (kind==='stream'){
      const base=n<=3?90:n<=10?60:34; let t=0;
      for (let i=0;i<n;i++){ out.push({ t, T:1, flips:1 }); t+=irr?base*(.35+rnd()*1.6):base; }
      return out;
    }
    if (kind==='flick'){
      let t=0;
      for (let i=0;i<n;i++){ out.push({ t, T:rr(.72,.88), flips:rint(1,2), grip:230 }); t+=rint(55,110); }
      return out;
    }
    if (kind==='shove'){
      // most slide out as a group; the front few tumble off the top
      for (let i=0;i<n;i++) out.push({ t:rint(0,90), mode:'shove', tumble:i>=n*.72 });
      return out;
    }
    if (kind==='splash'){
      for (let i=0;i<n;i++) out.push({ t:rnd()*90, T:rr(.85,1.35), flips:flips() });
      return out;
    }
    // lob and heave: blooming handfuls, each handful its own arc height
    const splashFrom=kind==='heave'?Math.ceil(n*.38):n;
    let t=0, i=0;
    while (i<splashFrom){
      const size=irr?rint(2,5):4, arc=rr(.85,1.3);
      for (let k=0;k<size && i<splashFrom;k++,i++) out.push({ t:t+(bloom?rint(0,50):rint(0,6)), T:arc*(bloom?rr(.9,1.1):1), flips:flips() });
      t+=irr?rint(70,140):100;
    }
    if (kind==='heave'){
      t+=60;
      for (;i<n;i++) out.push({ t:t+rnd()*110, T:rr(.95,1.5), flips:flips() });
    }
    return out;
  }
  // items: [{ b, to, onStart }]
  function throwAll(items,kind,extra){
    const p=plan(items.length,kind);
    const big=extra&&extra.big?{ done:false }:null;
    // one or two coins in each throw get tossed high, flipping slowly
    const tossers=new Set();
    if (OPT.toss==='on' && kind!=='shove' && kind!=='stream' && items.length>=3){
      const k=items.length>=10?2:1;
      while (tossers.size<k) tossers.add(rint(0,items.length-1));
    }
    return Promise.all(items.map((it,i)=>{
      const pl=p[i], dist=Math.hypot(it.to.x-it.b.x,it.to.y-it.b.y);
      let T=flightT(dist)*(pl.T||1), flips=pl.flips, toss=false;
      if (tossers.has(i)){ T=Math.max(.5,T*rr(1.7,2.1)); flips=rint(3,5); toss=true; }
      if (OPT.hand==='bloom'||kind!=='lob'){ it.b.x+=rr(-3,3); it.b.y+=rr(-2,2); }
      const loose=!it.to.slot&&!it.to.vanish&&!it.to.mouth;
      return launch(it.b,it.to,{ big, wait:pl.t, T:eased()?undefined:T, i, mode:pl.mode, tumble:pl.tumble, grip:pl.grip, toss,
        jx:loose?rr(-6,6):0, jy:loose?rr(-3,3):0, flips, onStart:it.onStart });
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
    gen++; reseed();
    active.clear(); dirty.clear(); freeze=0;
    if (air) air.innerHTML=''; if (shadows) shadows.innerHTML='';
    Object.values(zones).forEach(z=>clearTimeout(z.timer));
    Object.keys(zones).forEach(k=>delete zones[k]);
    busy=false; oppTurn=0;
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
    // cards dealt with an animation: measure the solid blocks once they've landed
    buildWalls(); setTimeout(()=>{ if (!busy) buildWalls(); },700);
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
    zone('pot',pr.left+pr.width/2,pr.top-16,9,15,44);
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
      zone('spot:'+p.id,fr.left+x,fr.top+y+2,7,5,16);
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
      await new Promise(r=>setTimeout(r,50));
    }
  }
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
    const items=coloursFor(amount).map(col=>{
      const s=source(p), b=body(makeChip(col),s.x,s.y,s.z,D()-2);
      return { b, to:targetIn(z,b), onStart:()=>chuteKick(s.chute) };
    });
    await throwAll(items,kind,{ big:allin });
    await zoneSettled(z,2500);
  }
  async function youBet(amount,label,allin){
    const my=gen;
    const you=P[0]; you.chips=Math.max(0,you.chips-amount); updateJackpot(you.chips);
    you.totalBetHand+=amount; updateInvestedReel(you.totalBetHand);
    say('YOU',label.toUpperCase());
    const z=zones['spot:you']; z.amount+=amount; plate('you');
    const items=[];
    for (const col of coloursFor(amount)){
      const t=bank.take(); if (!t) break;
      if (t.c.colour!==col){ t.c.colour=col; t.c.frame=''; if (!pixelArt()) styleChip(t.c); }
      const r=t.rect, b=body(t.c,r.left+r.width/2,r.bottom,0,r.width);
      items.push({ b, to:targetIn(z,b) });
    }
    bank.apply({ slideMs:160 });
    guard(my);
    // your chips come from the bank, off the felt: never a shove
    await throwAll(items,kindFor(amount,allin,false),{ big:allin });
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
    let ids=Object.keys(zones).filter(k=>k.startsWith('spot:') && zones[k].list.length);
    if (!ids.length){
      [['maniac',180],['wild',180],['you',180]].forEach(([id,a])=>{ neatFill(zones['spot:'+id],a); plate(id); });
      ids=Object.keys(zones).filter(k=>k.startsWith('spot:') && zones[k].list.length);
      await waitMs(600); guard(my);
    }
    say('DEALER','SWEEP');
    const pot=zones.pot, total=ids.reduce((a,k)=>a+zones[k].amount,0), all=[];
    ids.forEach((k,si)=>{
      const z=zones[k], list=z.list.slice(); z.list.length=0;
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
        all.push(new Promise(res=>{ b.resolve=res; }));
      });
    });
    kick();
    if (OPT.after!=='neat') pot.neat=false;
    const count=countPot(potValue+total,540+ids.length*60);
    await Promise.all(all); await count; guard(my);
    sfx('collect',.6);
    ids.forEach(k=>{ zones[k].amount=0; const id=k.slice(5); spotEls[id].classList.remove('is-sweeping'); plate(id); });
    if (OPT.after==='auto'){ await waitMs(200); guard(my); await tidyZone(pot); }
  }
  async function ensurePot(){
    const pot=zones.pot;
    if (pot.list.length) return;
    neatFill(pot,2000); potValue=2000; paintPot(2000);
    await waitMs(400);
  }
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
      c.el.animate([
        { transform:'translate('+dx+'px,'+dy+'px)', easing:'cubic-bezier(.55,0,1,.6)' },
        { transform:'translate(0,1px) scale(1.12,.82)', offset:.74, easing:'steps(1,end)' },
        { transform:'translate(0,-3px)', offset:.86, easing:'cubic-bezier(.3,0,.7,1)' },
        { transform:'none' }
      ],{ duration:290/OPT.speed });
      setTimeout(()=>sfx('land'),210/OPT.speed);
    }
    if (res) setTimeout(res,motionOff()?0:290/OPT.speed);
  }
  async function payYou(){
    const my=gen;
    await ensurePot(); guard(my);
    const pot=zones.pot, you=P[0], won=potValue, start=you.chips;
    say('YOU WIN',won.toLocaleString());
    const hatch=$('hud-left').querySelector('.cl-hatch');
    hatch.classList.add('is-open'); sfx('hatch');
    await waitMs(150); guard(my);
    const hr=hatch.getBoundingClientRect();
    const list=pot.list.slice().sort((a,c)=>c.z-a.z||a.y-c.y); pot.list.length=0;
    list.forEach(b=>{ b.zone=null; });
    const n=list.length; let landed=0;
    const items=list.map(b=>({ b, to:{ x:hr.left+hr.width*rr(.35,.65), y:hr.bottom, z:0, mouth:true, d:bank.diam } }));
    const tallied=throwAll(items,kindFor(won,false,false)==='flick'?'flick':'lob').then(()=>{});
    items.forEach(it=>{ const r=it.b.resolve; it.b.resolve=()=>{ landed++; paintPot(Math.round(won*(1-landed/n))); you.chips=Math.round(start+won*landed/n); updateJackpot(you.chips); if (r) r(); }; });
    await tallied; guard(my);
    you.chips=start+won; updateJackpot(you.chips); potValue=0; paintPot(0);
    await waitMs(150);
    hatch.classList.remove('is-open'); sfx('hatchClose');
  }
  async function payOpp(p){
    const my=gen;
    await ensurePot(); guard(my);
    const pot=zones.pot, won=potValue, z=zones['spot:'+p.id];
    say(p.name.toUpperCase()+' WINS',won.toLocaleString());
    const list=pot.list.slice(); pot.list.length=0;
    const all=list.map((b,i)=>{
      b.zone=z; z.list.push(b);
      const probe={ x:z.cx+(b.x-pot.cx)*.5, y:z.cy+(b.y-pot.cy)*.5, d:b.d, vx:0, vy:0 }; contain(probe);
      b.tx=probe.x; b.ty=probe.y; b.tz=b.z; b.lift=4; b.T=.5; b.wait=(i%6)*6; b.state='wait'; b.next='push'; b.target={}; b.opts={}; active.add(b);
      return new Promise(res=>{ b.resolve=res; });
    });
    kick();
    z.amount=won; plate(p.id);
    await Promise.all([Promise.all(all), countPot(0,520)]); guard(my);
    sfx('collect',.6);
    await waitMs(420); guard(my);
    const back=z.list.slice().sort((a,c)=>c.z-a.z); z.list.length=0; z.amount=0; plate(p.id);
    const items=back.map(b=>{ b.zone=null; const s=source(p); return { b, to:{ x:s.x, y:s.y, z:s.z, vanish:true, d:D()-4 } }; });
    await throwAll(items,'lob'); guard(my);
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
      const next=()=>pl(OPPS[oppTurn++%OPPS.length]);
      if (kind==='opp-call') await oppBet(next(),20,'Call 20');
      else if (kind==='opp-bet') await oppBet(next(),180,'Raise 180');
      else if (kind==='opp-big') await oppBet(next(),400,'Raise 400');
      else if (kind==='opp-allin'){ const p=pl('maniac'); await oppBet(p,p.chips||1000,'All-In',true); }
      else if (kind==='you-call') await youBet(20,'Call 20');
      else if (kind==='you-bet') await youBet(180,'Call 180');
      else if (kind==='you-allin') await youBet(P[0].chips,'All-In',true);
      else if (kind==='sweep') await sweep();
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
  function setOpt(k,v){
    if (k==='preset'){ OPT.preset=v; OPT.eased=false; Object.assign(OPT,PRESETS[v]); }
    else { OPT[k]=k==='speed'?Number(v):v; if (!['speed','sound','random'].includes(k)){ OPT.preset='custom'; OPT.eased=false; } }
    settings.sound=OPT.sound==='on';
    syncPanel();
    if (['source','preset','art','size','after'].includes(k)) setup();
  }
  function wire(){
    document.querySelectorAll('.cl-seg').forEach(seg=>seg.addEventListener('click',ev=>{
      const b=ev.target.closest('button'); if (!b) return;
      setOpt(seg.dataset.opt,b.dataset.v);
    }));
    document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.run)));
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
      if (b.dataset.run){ a.run(b.dataset.run); return; }
      const seg=b.closest('.cl-seg');
      if (seg){ a.set(seg.dataset.opt,b.dataset.v); Object.assign(OPT,a.OPT); syncPanel(); }
    });
    let synced=false;
    setInterval(()=>{
      const a=api(); if (!a) return;
      if (!synced){ synced=true; Object.assign(OPT,a.OPT); syncPanel(); }
      try{ status(frame.contentDocument.getElementById('ct-status').textContent); markBar(a.busy()?a.last():null); }catch(e){}
    },200);
  }

  async function init(){
    const q=new URLSearchParams(location.search);
    const embed=q.get('embed')==='1';
    if (embed) document.body.classList.add('ct-embed');
    else if (window.matchMedia && matchMedia('(min-width:760px)').matches){ syncPanel(); desktop(); return; }
    if (q.get('preset') && PRESETS[q.get('preset')]){ OPT.preset=q.get('preset'); Object.assign(OPT,PRESETS[OPT.preset]); }
    Object.keys(OPT).forEach(k=>{ if (q.get(k) && k!=='preset') OPT[k]=k==='speed'?Number(q.get(k)):q.get(k); });
    await mountTable();
    syncPanel(); wire();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    setup();
    window.__chipThrowLab={ run, OPT, setup, set:setOpt, last:()=>lastRun, busy:()=>busy, walls:()=>WALLS,
      state:()=>({ bank:bank.chips.length, pot:zones.pot.list.length, potNeat:zones.pot.neat, active:active.size,
        air:air?air.querySelectorAll('.cl-chip').length:0, you:P[0].chips,
        spots:Object.keys(zones).filter(k=>k.startsWith('spot:')).map(k=>k.slice(5)+':'+zones[k].list.length).join(' ') }),
      // where every resting chip on the felt is, for checks
      bodies:()=>Object.values(zones).flatMap(z=>z.list.map(b=>({ zone:z.id, x:b.x, y:b.y, z:b.z, d:b.d, state:b.state }))),
      blocked:()=>Object.values(zones).flatMap(z=>z.list).filter(b=>b.state==='rest' && b.z<1 && inBlock(b.x,b.y,b.d)).length,
      offFelt:()=>{ const F=WALLS.felt; return Object.values(zones).flatMap(z=>z.list).filter(b=>b.x<F.L||b.x>F.R||b.y<F.T||b.y>F.B+1).length; },
      spotMiss:id=>{ const z=zones['spot:'+id]; return z.list.map(b=>Math.round(Math.hypot(b.x-z.cx,b.y-z.cy))); } };
  }
  init().catch(err=>{ console.error('[chip-throw-lab]',err); status('Failed to mount — serve over http'); });
})();
