/* ============================================================
   CHIP THROW LAB v4 — how chips travel (docs/ui/CHIP_PLAN.md).

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

  /* ---------------- options & presets ---------------- */
  const BASE={ art:'gold', body:'thick', depth:'on', overlap:'snug', size:'m', shadow:'on', throw:'bybet', hand:'bloom', timing:'irregular',
    flips:'many', toss:'off', source:'edge', bounces:'multi', rock:'on', roll:'on', knock:'on', juice:'on', after:'tap', sweep:'push',
    random:'fresh', sfx:'clack', rise:'on', group:'on' };
  BASE.overlap='snap'; BASE.stack='loose'; BASE.tidy='spread'; BASE.tray='well'; BASE.lip='on'; BASE.nums='pop'; BASE.sweep='jump';
  const OPT={ preset:'v8', ...BASE, speed:1, sound:'on' };
  const PRESETS={
    v8:   { ...BASE },
    chunky:{ ...BASE, sfx:'clackplus' },
    heavy:{ ...BASE, bounces:'dead', roll:'off', sfx:'thud' },
    v4:   { ...BASE, overlap:'snug', sfx:'coin' },
    v3:   { ...BASE, body:'thin', depth:'off', overlap:'free', sfx:'old', rise:'off', group:'off', toss:'on' },
    today:{ art:'current', body:'thin', depth:'off', overlap:'free', size:'l', shadow:'off', throw:'stream', hand:'rigid', timing:'even', flips:'one', toss:'off',
            source:'face', bounces:'one', rock:'off', roll:'off', knock:'off', juice:'off', after:'neat', sweep:'stream', random:'same',
            sfx:'old', rise:'off', group:'off', eased:true }
  };
  const NOTES={
    v8:'A slow, readable flip in every flight and a flip-pop off the first landing for a third of coins; the sweep hops coins into the pot; quieter tidy; the well is a rounded rectangle; no zoom punch.',
    chunky:'As V5 with CLACK+: the same click with a heavier thud under it.',
    heavy:'As V5, with dead landings (no bounce, no roll) and the THUD sound set.',
    v4:'The last version: snug overlap and the COIN sound set.',
    v3:'The last version, for comparison: thin coins, free overlap, the old clink, a tossed coin.',
    today:'What the game does now, for reference: one chip at a time on smooth swaying arcs, out of the face.',
    custom:'Your own mix.'
  };
  const SIZES={ s:13, m:15, l:17 };
  const D=()=>SIZES[OPT.size];
  // coin thickness (px, edge-on) and the stack step it gives at rest
  const THICK=d=>OPT.body==='thick'?Math.round(d*.52):Math.max(2,Math.round(d*.2));
  const STEP=()=>OPT.body==='thick'?Math.max(3,Math.round(THICK(D())*.57)):Math.max(2,Math.round(D()*.2));
  // sprite height: thick coins need a taller canvas for their edge
  const HR=()=>OPT.body==='thick'?1.2:1;
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
  function shape(d,h,c){
    const rx=d/2-.5, ry=Math.max(.6,rx*c), th=THICK(d), band=th*Math.sqrt(1-c*c);
    // bottom-aligned: the coin sits on the bottom of its sprite (1px left for the outline)
    return { rx, ry, band, cy:h-1.5-band-ry, cx:d/2 };
  }
  // paint(nx,ny,r,a) -> colour for a face pixel; bandPaint(nx) for the edge
  function render(d,c,paint,bandPaint,ink){
    const h=Math.round(d*HR());
    const cv=document.createElement('canvas'); cv.width=d; cv.height=h;
    const ctx=cv.getContext('2d'), img=ctx.createImageData(d,h), px=img.data;
    const s=shape(d,h,c), fill=new Array(d*h).fill(null);
    for (let y=0;y<h;y++) for (let x=0;x<d;x++){
      const nx=(x+.5-s.cx)/s.rx; if (Math.abs(nx)>1) continue;
      const ny=(y+.5-s.cy)/s.ry, r=Math.hypot(nx,ny);
      if (r<=1) fill[y*d+x]=paint(nx,ny,r,Math.atan2(ny,nx),s);
      else { const span=Math.sqrt(1-nx*nx)*s.ry, yy=y+.5; if (yy>=s.cy-span && yy<=s.cy+s.band+span) fill[y*d+x]=bandPaint(nx,s,x,(s.cy+s.band+span-yy)); }
    }
    const inkAt=[];
    for (let y=0;y<h;y++) for (let x=0;x<d;x++){
      if (fill[y*d+x]) continue;
      if ([[1,0],[-1,0],[0,1],[0,-1]].some(([ox,oy])=>{ const X=x+ox,Y=y+oy; return X>=0&&Y>=0&&X<d&&Y<h&&fill[Y*d+X]; })) inkAt.push(y*d+x);
    }
    inkAt.forEach(i=>{ fill[i]=ink; });
    for (let i=0;i<d*h;i++){ const p=fill[i]; if (!p) continue; px[i*4]=p[0]; px[i*4+1]=p[1]; px[i*4+2]=p[2]; px[i*4+3]=255; }
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
    if (OPT.body==='thick') return thickCoinFrame(d,c,back);
    let face=hex(GOLD.face), rim=hex(GOLD.rim), hi=hex(GOLD.hi), line=hex(GOLD.line);
    const band=hex(GOLD.band), band2=hex(GOLD.band2), ink=hex(GOLD.ink);
    if (back){ face=dark(face,.68); rim=dark(rim,.7); hi=dark(hi,.72); line=dark(line,.66); }
    return render(d,c,(nx,ny,r,a,s)=>{
      if (r>.74) return (!back && a<-1.6 && a>-2.8) ? hi : rim;
      if (!back && Math.abs(nx)<.8/s.rx && Math.abs(ny)<.5) return line;
      if (!back && nx>-.62 && nx<-.34 && Math.abs(ny)<.42) return hi;
      if (back && Math.abs(nx)<.8/s.rx && Math.abs(ny)<.4) return line;
      return face;
    },(nx,s,x)=>(x%2?band:band2),ink);
  }
  // The chunky coin: a bevelled rim (lit along the top, shaded along the
  // bottom), a slot line and highlight stripe, and a thick reeded edge
  // that darkens towards the felt.
  function thickCoinFrame(d,c,back){
    let face=hex('#f4c43e'), bevHi=hex('#ffe88a'), bevLo=hex('#b87a10'), hi=hex('#fff5c0'), line=hex('#c68a16');
    const e1=hex('#c98a1a'), e2=hex('#e8ad32'), eLo=hex('#7c4a06'), ink=hex('#2e1a04');
    if (back){ face=dark(face,.66); bevHi=dark(bevHi,.7); bevLo=dark(bevLo,.7); hi=dark(hi,.7); line=dark(line,.62); }
    return render(d,c,(nx,ny,r,a,s)=>{
      if (r>.76) return ny<-.1 ? bevHi : (ny>.25 ? bevLo : (a<0?bevHi:bevLo));
      if (!back && Math.abs(nx)<.8/s.rx && Math.abs(ny)<.5) return line;
      if (!back && nx>-.6 && nx<-.34 && Math.abs(ny)<.42) return hi;
      if (back && Math.abs(nx)<.8/s.rx && Math.abs(ny)<.36) return line;
      return face;
    },(nx,s,x,fromBottom)=>(fromBottom<1.2?eLo:(x%2?e1:e2)),ink);
  }
  function frames(col,d){
    const k=col+'|'+d+'|'+OPT.body;
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
          if (!cl){
            this.clumps.forEach(k=>k.open=false);
            // a new clump goes where it doesn't sit inside another: beside
            // it, or far enough behind to read as further back
            const clear=(x,y)=>this.clumps.every(k=>Math.abs(k.x-x)>=d*.95 || Math.abs(k.y-y)>=d*.62);
            let x=0, y=0, ok=false;
            for (let tries=0; tries<40 && !ok; tries++){ x=rint(1,Math.max(1,Math.round(w-d-1))); y=rint(2,Math.round(floor+tries*.6)); ok=clear(x,y); }
            if (!ok){
              // nowhere clear: grow the shortest clump instead
              const k=this.clumps.reduce((a,c)=>c.n<a.n?c:a,this.clumps[0]);
              if (k){ k.cap=k.n+1; k.open=true; cl=k; }
            }
            if (!cl){ cl={ x, y, n:0, cap:rint(2,6), open:true }; this.clumps.push(cl); }
          }
          c.clump=cl; c.ci=cl.n; cl.n++;
        }
        const cl=c.clump;
        pos.push({ x:cl.x+c.lean*Math.min(1,c.ci), y:cl.y+c.ci*this.step, z:Math.round((h-cl.y)*4)*64+c.ci });
      });
      return pos;
    }
    rackLayout(chips){
      const { w,h }=this.size(), d=this.diam, sp=d+3;
      const cols=Math.max(1,Math.floor((w-4)/sp)), x0=Math.round((w-cols*sp)/2+1.5);
      const sorted=chips.slice().sort((a,b)=>COLOURS.indexOf(b.colour)-COLOURS.indexOf(a.colour));
      const by={}; sorted.forEach(c=>{ by[c.colour]=(by[c.colour]||0)+1; });
      const need=k=>Object.values(by).reduce((a,n)=>a+Math.ceil(n/k),0);
      // one clean row of towers (a half-hidden back row read as merged
      // stacks); towers grow as tall as they need
      const hard=Math.max(4,Math.floor((h-d*HR()-6)/this.step)+1);
      let cap=Math.min(hard,8); while (need(cap)>cols && cap<200) cap++;
      const pos=new Map(), colH=new Array(cols).fill(0); let col=-1, n=cap, last=null;
      sorted.forEach(c=>{
        if (c.colour!==last || n>=cap){ col++; n=0; last=c.colour; }
        // more colours than towers: carry on up the same tower
        const cc=col%cols, lv=colH[cc]++;
        pos.set(c,{ x:x0+cc*sp, y:4+lv*this.step, z:60+lv });
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
        el.style.width=d+'px'; el.style.height=Math.round(d*(pixelArt()?HR():1))+'px'; el.style.left=p.x+'px'; el.style.bottom=p.y+'px'; el.style.zIndex=String(p.z);
        if (OPT.depth==='on') el.style.filter='drop-shadow(0 1px 0 rgba(28,14,0,.8))';
        el._base=0; el._f=''; c.frame=''; setFrame(c,d,REST,false);
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

  /* ---------------- sound ----------------
     OLD is the production chip sounds. THUD / CLACK / COIN are new coin
     sounds synthesised here (the game's own Sound module style: Web Audio,
     no assets): THUD a heavy low body, CLACK a dry arcade click, COIN a
     gold ring over a thud. GROUP folds 3+ landings inside ~70ms into one
     bigger chunk; RISE lifts each landing in a throw a semitone. */
  const Coin=(function(){
    let ctx=null, nbuf=null;
    function ac(){
      if (OPT.sound!=='on') return null;
      if (!ctx){ try{ const A=window.AudioContext||window.webkitAudioContext; ctx=A?new A():null; }catch(e){ ctx=null; } }
      if (ctx && ctx.state==='suspended'){ try{ ctx.resume(); }catch(e){} }
      return ctx;
    }
    function noiseBuf(c){ if (nbuf) return nbuf; nbuf=c.createBuffer(1,c.sampleRate*.3,c.sampleRate); const d=nbuf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return nbuf; }
    function tone(f0,f1,dur,type,vol,when){
      const c=ac(); if (!c) return;
      const t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
      o.type=type; o.frequency.setValueAtTime(f0,t); if (f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
      g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.004); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.02);
    }
    function noise(dur,vol,type,freq,q,when){
      const c=ac(); if (!c) return;
      const t=c.currentTime+(when||0), s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
      s.buffer=noiseBuf(c); f.type=type; f.frequency.value=freq; f.Q.value=q||1;
      g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t,Math.random()*.2); s.stop(t+dur+.02);
    }
    const V=v=>Math.max(.02,Math.min(1,v));
    // p: pitch multiplier; w: weight 0..1
    const SETS={
      thud:{
        land:(p,w)=>{ tone(150*p,70*p,.09,'sine',V(.42*w)); noise(.035,V(.16*w),'lowpass',1300*p,.7); },
        stack:(p,w)=>{ tone(210*p,110*p,.06,'sine',V(.3*w)); noise(.025,V(.2*w),'bandpass',1800*p,1.2); },
        bounce:(p,w)=>{ tone(180*p,110*p,.05,'sine',V(.22*w)); },
        chunk:(p,w)=>{ tone(120*p,55*p,.14,'sine',V(.55*w)); noise(.08,V(.26*w),'lowpass',1100,.7); noise(.05,V(.12*w),'bandpass',2000,1.5,.03); }
      },
      // CLACK (reworked): a hard block "tock" with a bright click on top and
      // a small body under it; onto a stack it's a double clack-ck
      clack:{
        land:(p,w)=>{ tone(860*p,640*p,.045,'triangle',V(.17*w)); noise(.02,V(.2*w),'highpass',2700*p,.9); tone(175*p,115*p,.05,'sine',V(.2*w)); },
        stack:(p,w)=>{ tone(1180*p,960*p,.03,'triangle',V(.18*w)); noise(.016,V(.22*w),'highpass',3300*p,.9); tone(1420*p,1250*p,.02,'triangle',V(.08*w),.017); noise(.01,V(.1*w),'highpass',3600,.9,.017); },
        bounce:(p,w)=>{ tone(1000*p,860*p,.025,'triangle',V(.1*w)); noise(.012,V(.12*w),'highpass',3000,.9); },
        chunk:(p,w)=>{ [0,.014,.03,.05].forEach((d,i)=>{ tone((900+i*110)*p,(720+i*90)*p,.035,'triangle',V(.13*w),d); noise(.016,V(.17*w),'highpass',2900,.9,d); }); tone(140*p,70*p,.1,'sine',V(.32*w)); }
      },
      // CLACK+: the same click with a heavier thud under it
      clackplus:{
        land:(p,w)=>{ tone(820*p,610*p,.045,'triangle',V(.16*w)); noise(.02,V(.19*w),'highpass',2600*p,.9); tone(135*p,68*p,.09,'sine',V(.36*w)); },
        stack:(p,w)=>{ tone(1120*p,920*p,.03,'triangle',V(.17*w)); noise(.016,V(.2*w),'highpass',3200*p,.9); tone(1360*p,1200*p,.02,'triangle',V(.07*w),.017); tone(165*p,90*p,.07,'sine',V(.28*w)); },
        bounce:(p,w)=>{ tone(960*p,820*p,.025,'triangle',V(.1*w)); tone(150*p,95*p,.05,'sine',V(.18*w)); },
        chunk:(p,w)=>{ [0,.014,.03,.05].forEach((d,i)=>{ tone((860+i*110)*p,(690+i*90)*p,.035,'triangle',V(.12*w),d); noise(.016,V(.16*w),'highpass',2800,.9,d); }); tone(115*p,55*p,.15,'sine',V(.5*w)); }
      },
      // CLAY: a real poker chip on felt, a short double tick of clay
      clay:{
        land:(p,w)=>{ noise(.012,V(.24*w),'bandpass',2300*p,2.2); noise(.01,V(.14*w),'bandpass',3500*p,2.5,.009); tone(320*p,240*p,.03,'sine',V(.14*w)); },
        stack:(p,w)=>{ noise(.01,V(.26*w),'bandpass',3000*p,2.6); noise(.008,V(.16*w),'bandpass',4200*p,2.8,.008); noise(.008,V(.1*w),'bandpass',3800*p,2.8,.02); },
        bounce:(p,w)=>{ noise(.008,V(.14*w),'bandpass',2800*p,2.4); },
        chunk:(p,w)=>{ [0,.012,.026,.04,.058].forEach((d,i)=>noise(.012,V(.2*w),'bandpass',(2200+i*300)*p,2.2,d)); tone(260*p,180*p,.05,'sine',V(.18*w)); }
      },
      // RETRO: an 8-bit coin blip, two quick square notes
      retro:{
        land:(p,w)=>{ tone(988*p,988*p,.035,'square',V(.06*w)); tone(1319*p,1319*p,.07,'square',V(.06*w),.035); },
        stack:(p,w)=>{ tone(1319*p,1319*p,.03,'square',V(.06*w)); tone(1760*p,1760*p,.06,'square',V(.055*w),.03); },
        bounce:(p,w)=>{ tone(784*p,784*p,.025,'square',V(.04*w)); },
        chunk:(p,w)=>{ [988,1175,1319,1568].forEach((f,i)=>tone(f*p,f*p,.045,'square',V(.055*w),i*.03)); }
      },
      // THOCK: a deep, soft keyboard-style thock
      thock:{
        land:(p,w)=>{ tone(430*p,290*p,.06,'triangle',V(.28*w)); noise(.03,V(.16*w),'lowpass',900*p,.8); },
        stack:(p,w)=>{ tone(560*p,400*p,.05,'triangle',V(.26*w)); noise(.022,V(.16*w),'lowpass',1300*p,.8); },
        bounce:(p,w)=>{ tone(500*p,380*p,.035,'triangle',V(.16*w)); },
        chunk:(p,w)=>{ [0,.02,.045].forEach((d,i)=>tone((400+i*60)*p,(280+i*40)*p,.06,'triangle',V(.24*w),d)); noise(.06,V(.18*w),'lowpass',800,.8); }
      },
      // CLINK: bright metal on metal, three inharmonic partials
      clink:{
        land:(p,w)=>{ noise(.006,V(.12*w),'highpass',5000,.8); tone(2400*p,2390*p,.09,'sine',V(.05*w)); tone(3710*p,3700*p,.07,'sine',V(.04*w)); tone(5130*p,5120*p,.05,'sine',V(.025*w)); },
        stack:(p,w)=>{ noise(.005,V(.12*w),'highpass',5500,.8); tone(2900*p,2890*p,.08,'sine',V(.05*w)); tone(4480*p,4470*p,.06,'sine',V(.035*w)); },
        bounce:(p,w)=>{ tone(2600*p,2590*p,.04,'sine',V(.035*w)); },
        chunk:(p,w)=>{ [0,.016,.034].forEach((d,i)=>{ tone((2300+i*350)*p,(2290+i*350)*p,.09,'sine',V(.045*w),d); tone((3600+i*400)*p,(3590+i*400)*p,.06,'sine',V(.03*w),d); }); }
      },
      // POP: a cartoon pop, a fast upward chirp with a click
      pop:{
        land:(p,w)=>{ tone(420*p,1300*p,.045,'sine',V(.2*w)); noise(.008,V(.12*w),'highpass',2500,.8); },
        stack:(p,w)=>{ tone(560*p,1700*p,.04,'sine',V(.2*w)); noise(.006,V(.12*w),'highpass',3000,.8); },
        bounce:(p,w)=>{ tone(500*p,1000*p,.03,'sine',V(.1*w)); },
        chunk:(p,w)=>{ [0,.025,.05].forEach((d,i)=>tone((380+i*90)*p,(1200+i*200)*p,.045,'sine',V(.18*w),d)); }
      },
      coin:{
        land:(p,w)=>{ tone(145*p,85*p,.07,'sine',V(.3*w)); noise(.014,V(.13*w),'bandpass',3400,1.4); tone(1880*p,1860*p,.11,'sine',V(.05*w),.004); tone(2830*p,2800*p,.08,'sine',V(.03*w),.004); },
        stack:(p,w)=>{ noise(.012,V(.16*w),'bandpass',4000,1.6); tone(2250*p,2230*p,.1,'sine',V(.06*w)); tone(3380*p,3350*p,.07,'sine',V(.035*w)); tone(200*p,120*p,.05,'sine',V(.2*w)); },
        bounce:(p,w)=>{ tone(2100*p,2080*p,.06,'sine',V(.035*w)); tone(170*p,110*p,.04,'sine',V(.16*w)); },
        chunk:(p,w)=>{ tone(115*p,60*p,.13,'sine',V(.5*w)); noise(.06,V(.2*w),'bandpass',2600,1); [0,.02,.045].forEach((d,i)=>tone((1800+i*260)*p,(1780+i*260)*p,.1,'sine',V(.04*w),d)); }
      }
    };
    // the payoff sting: a small rising chord in the current set's voice
    function sting(p){
      const wave=OPT.sfx==='retro'?'square':(OPT.sfx==='clink'||OPT.sfx==='coin'?'sine':'triangle');
      const v=wave==='square'?.045:.08;
      [1046,1318,1568].forEach((f,i)=>tone(f*p,f*p,.07,wave,v,i*.045));
      tone(2093*p,2093*p,.18,wave,v*.9,.14);
    }
    return { set:()=>SETS[OPT.sfx], unlock:()=>{ ac(); }, sting };
  })();
  let groupAt=[], chunkAt=0;
  function coinSfx(kind,power,pitch){
    const set=Coin.set(); if (!set) return false;
    const p=(pitch||1)*(.96+Math.random()*.08), w=Math.max(.35,Math.min(1,power==null?.8:power));
    const now=performance.now();
    if ((kind==='land'||kind==='stack') && OPT.group==='on'){
      groupAt=groupAt.filter(t=>now-t<70); groupAt.push(now);
      if (now-chunkAt<90) return true;                          // folded into the last chunk
      if (groupAt.length>=3){ chunkAt=now; set.chunk(p,Math.min(1,w*1.15)); return true; }
    }
    if (kind==='land') set.land(p*.94,w*.9);                            // felt: duller
    else if (kind==='stack') set.stack(p,w);
    // material: coin on the rail or a card is harder and higher than on felt
    else if (kind==='wall'||kind==='card') set.stack(p*(kind==='card'?1.3:1.18),.7);
    else if (kind==='bounce'||kind==='roll'||kind==='rock') set.bounce(p,kind==='roll'?.35:w*.8);
    else if (kind==='knock') set.stack(p*1.05,.9);
    else if (kind==='thump'){ set.chunk(p*.8,1); }
    else return false;
    return true;
  }
  const soundAt={};
  function sfx(kind,power,pitch){
    if (OPT.sound!=='on') return;
    if (kind==='sting'){ if (OPT.sfx!=='old') Coin.sting(pitch||1); else Sound.counterLock(true); return; }
    if (OPT.sfx!=='old' && ['land','stack','bounce','wall','card','roll','rock','knock','thump'].includes(kind)){
      const gap0={ bounce:18, roll:90, wall:50, rock:60, knock:40 }[kind]||0, now0=performance.now();
      if (gap0 && now0-(soundAt[kind]||0)<gap0) return; soundAt[kind]=now0;
      coinSfx(kind,power,pitch); return;
    }
    if (kind==='stack') kind='land';
    if (kind==='card') kind='wall';
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
  const active=new Set(), dirty=new Set(), zones={}, squashing=new Set();
  let WALLS=null;               // { felt:{L,T,R,B,rc}, blocks:[{L,T,R,B}] }
  let TRAY=null;                // the pot tray's inside edge, for its lip

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
    // a landing squash plays out even after the coin is at rest, then the
    // coin is redrawn at its true size (it used to stay stretched)
    squashing.forEach(b=>{ b.sq-=dt; dirty.add(b); if (b.sq<=0 || reduced){ b.sq=0; squashing.delete(b); } });
    dirty.forEach(draw); dirty.clear();
    raf=(active.size||squashing.size||freeze>0)?requestAnimationFrame(loop):0;
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
  function toRest(b){
    const was=b.state;
    b.state='rest'; b.t=0; b.vx=b.vy=b.vz=0;
    // every coin that comes to rest is checked against its neighbours (a
    // pushed group is relaxed as whole stacks by relaxStacks instead)
    void was;
    if (b.snapOnto){ b.snapOnto.claimed=null; b.snapOnto=null; }
    active.delete(b); dirty.add(b);
    if (b.sq>0) squashing.add(b);
    if (b.zone && OPT.depth==='on') b.zone.list.forEach(q=>{ if (q!==b && Math.abs(q.x-b.x)<b.d && Math.abs(q.y-b.y)<b.d) dirty.add(q); });
    kick(); onRest(b);
  }

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
  // The tray's lip: a coin sliding (or skimming low) in the pot bounces back
  // off the rim; a fast one hops over it.
  function lip(b){
    if (!TRAY || OPT.lip!=='on' || !b.zone || b.zone.id!=='pot' || b.z>4) return;
    const dx=b.x-TRAY.cx, dy=(b.y-TRAY.cy);
    let out, nx, ny;
    if (TRAY.oval){ const e=Math.hypot(dx/TRAY.rx,dy/TRAY.ry); out=e>1; const L=Math.max(.01,Math.hypot(dx/TRAY.rx**2,dy/TRAY.ry**2)); nx=dx/TRAY.rx**2/L; ny=dy/TRAY.ry**2/L;
      if (out){ b.x=TRAY.cx+dx/e; b.y=TRAY.cy+dy/e; } }
    else { out=Math.abs(dx)>TRAY.rx||Math.abs(dy)>TRAY.ry; nx=Math.abs(dx)/TRAY.rx>Math.abs(dy)/TRAY.ry?Math.sign(dx):0; ny=nx?0:Math.sign(dy);
      if (out){ b.x=TRAY.cx+Math.max(-TRAY.rx,Math.min(TRAY.rx,dx)); b.y=TRAY.cy+Math.max(-TRAY.ry,Math.min(TRAY.ry,dy)); } }
    if (!out) return;
    const vn=b.vx*nx+b.vy*ny, speed=Math.hypot(b.vx,b.vy);
    if (speed>260 && b.state==='slide'){ b.state='air'; b.vz=rr(120,170); b.t=.1; b.T=0; b.bounces=b.maxB; b.fr=Math.PI/.2; sfx('wall'); return; }
    if (vn>0){ b.vx-=1.5*vn*nx; b.vy-=1.5*vn*ny; sfx('wall'); }
  }
  function inBlock(x,y,d){
    if (!WALLS) return false;
    return WALLS.blocks.some(k=>x>k.L-d/2 && x<k.R+d/2 && y>k.T-1 && y<k.B+d*.85);
  }

  /* ---------------- zones: bet spots and the pot ---------------- */
  function zone(id,cx,cy,cap,maxSlots,radius){ return zones[id]={ id, cx, cy, cap, maxSlots, radius, list:[], neat:true, timer:0, amount:0 }; }
  function neatSlots(z,list){
    const d=D(), towers=OPT.tidy==='towers', sp=d+(towers?2:1), st=STEP(), slots=[], order=[0];
    for (let i=1;i<9;i++) order.push(i%2?Math.ceil(i/2):-i/2);
    order.forEach((o,i)=>{ slots.push({ x:z.cx+o*sp, y:z.cy }); if (i<8 && !towers) slots.push({ x:z.cx+(o+(o<0?-.5:.5))*sp, y:z.cy-Math.round(d*.42) }); });
    // never taller than the room above the pile (the pot sits under the board)
    const room=z.room?Math.max(2,Math.floor((z.room-d*HR()-2)/st)+1):99;
    const pool=towers?slots.length:z.maxSlots;
    // SPREAD: coins shared evenly over every stack; TOWERS: one row of tall
    // stacks (up to 8 high), as few as the coins need
    let cap=towers?Math.min(8,room):Math.min(z.cap,room,Math.max(1,Math.ceil(list.length/Math.min(pool,slots.length))));
    const max=towers?Math.max(1,Math.min(pool,Math.ceil(list.length/cap))):pool;
    const use=slots.slice(0,max), stacks=[], out=new Map();
    list.forEach(b=>{
      let s=null;
      for (let i=stacks.length-1;i>=0;i--) if (stacks[i].key===b.colour && stacks[i].n<cap){ s=stacks[i]; break; }
      if (!s){ if (stacks.length<use.length){ s={ key:b.colour, slot:use[stacks.length], n:0 }; stacks.push(s); } else s=stacks.reduce((a,c)=>c.n<a.n?c:a); }
      out.set(b,{ x:s.slot.x, y:s.slot.y, z:s.n*st, n:s.n });
      s.n++;
    });
    return out;
  }
  // free: coins may sit a quarter inside each other; snug: they only touch;
  // snap: a coin landing near another is pulled onto it (stacks build)
  const MIN_GAP=()=>OPT.overlap==='free'?.74:.94;
  const SUPPORT=()=>OPT.overlap==='snap'?.8:(OPT.overlap==='snug'?.5:.55);
  function supportUnder(b){
    if (!b.zone) return { h:0, o:null };
    let h=0, o=null;
    for (const q of b.zone.list){
      if (q===b || q.state!=='rest') continue;
      if (Math.hypot(q.x-b.x,(q.y-b.y)*1.4)<b.d*SUPPORT() && q.z+STEP()>h){ h=q.z+STEP(); o=q; }
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
      b.tidyTop=![...slots.values()].some(o=>o!==s && o.x===s.x && o.y===s.y && o.n>s.n);
      if (Math.hypot(s.x-b.x,s.y-b.y)<.6 && Math.abs(s.z-b.z)<.6) return;
      done.push(new Promise(res=>{
        const dist=Math.hypot(s.x-b.x,s.y-b.y);
        b.tx=s.x; b.ty=s.y; b.tz=s.z; b.resolve=res;
        b.T=.14+Math.min(.14,dist/900); b.arc=5+Math.min(14,dist*.12);
        b.wait=colourless?(s.n*55+(i%3)*12):(gi*95+s.n*22); b.state='wait'; b.next='tidy'; active.add(b); kick();
      }));
    });
    const beats=colourless?Math.max(...z.list.map(b=>slots.get(b).n))+1:groups.length;
    void beats; if (done.length) sfx('tooth');
    z.tidying=Promise.all(done).then(()=>{ z.tidying=null; if (done.length){ sfx('lock'); sfx('sting',1,1); glintPile(z); } });
    return z.tidying;
  }

  /* ---------------- launch ---------------- */
  // Target t = { x, y, z, d, zone?, slot?, vanish?, mouth? }
  function launch(b,t,o){
    o=o||{};
    b.target=t; b.opts=o; b.bounces=0; b.knocked=false; b.inFelt=false;
    b.maxB=OPT.bounces==='multi' ? rint(1,3) : (OPT.bounces==='dead' ? 0 : 1);
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
    if (s==='fall'){ b.state='air'; b.t=.1; return; }
    const dist=Math.hypot(t.x-b.x,t.y-b.y); b.dist=dist;
    if (s==='eased'){
      b.state='eased'; b.T=Math.min(.76,Math.max(.4,.38+dist/1100));
      b.hop=10+Math.min(26,dist*.06)+rnd()*6; b.spin=(rnd()<.5?-1:1)*(20+rnd()*40); b.lane=((b.opts.i||0)%5-2)*Math.min(8,dist*.02);
      return;
    }
    if (s==='shove'){
      // pushed along the felt: exactly enough speed to arrive; front coins tumble
      const L=Math.max(1,dist), v=Math.sqrt(2*FRICTION*L)*rr(.95,1.05);
      b.vx=(t.x-b.x)/L*v; b.vy=(t.y-b.y)/L*v; b.state='slide'; b.inFelt=true; b.d=b.d1;
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
    let flips=b.opts.flips!=null?b.opts.flips:2;
    // never faster than ~0.09s a half-turn, or the frames read as flicker
    flips=Math.max(flips%2?1:2,Math.min(flips,2*Math.floor(b.T/.18)));
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
        b.tilt=b.edge?0:Math.abs(Math.cos(b.phi)); b.back=!b.edge && Math.cos(b.phi)<0;
        if (b.glint && !b.glinted && pvz>0 && b.vz<=0){ b.glinted=true; glint(b); }
        if (t.vanish||t.mouth||t.rim){ if (b.t>=b.T) arrive(b,false); break; }
        if (!b.inFelt && insideFelt(b.x,b.y)) b.inFelt=true;
        if (b.inFelt && b.z<b.d*.8 && b.t>.08 && contain(b)) sfx('wall');
        if (b.z<4) lip(b);
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
        lip(b);
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
        if (contain(b)){ b.state='flat'; b.t=0; sfx('wall'); }
        if (!b.shunted && b.zone && k<.95){
          for (const q of b.zone.list){
            if (q===b || q.state!=='rest' || q.z>1 || Math.hypot(q.x-b.x,(q.y-b.y)*1.4)>b.d*.8) continue;
            const dx=b.tx-b.x0, dy=b.ty-b.y0, L=Math.max(1,Math.hypot(dx,dy)), v=L/b.T*1.6;
            shunt(q,dx/L*v,dy/L*v*.7); b.shunted=true; b.state='flat'; b.t=0; sfx('stack',.8); break;
          }
        }
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
        if (k>=1){
          b.x=b.tx; b.y=b.ty; b.z=b.tz; b.tilt=1; b.sq=.08;
          if (b.snapping){ b.snapping=false; sfx('stack',.8,rise(b)); if (b.zone) b.zone.neat=false; } else if (b.tidyTop) sfx('stack',.45);
          toRest(b);
        }
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
    if (t.rim){ b.target=t.then; arrive(b,true); return; }
    if (t.vanish || t.mouth){ arrive(b,true); return; }
    if (t.slot){ b.x=t.x; b.y=t.y; b.z=t.z||0; toRest(b); return; }
    if (t.x!=null && s!=='slide'){ b.x=t.x; b.y=t.y; }
    contain(b); b.z=supportUnder(b).h; finishRest(b);
  }

  function arrive(b,isEased){
    const t=b.target;
    if (t.vanish){ const r=b.resolve; b.resolve=null; removeBody(b); b.el.remove(); if (r) r(); return; }
    if (t.mouth){ dropIntoBank(b); return; }
    if (t.rim){
      // off the dashboard rim, a short hop into the hatch
      sfx('wall'); glint(b);
      b.target=t.then; b.opts={ ...b.opts, T:.24, flips:1, jx:0, jy:0 }; b.next='air'; begin(b); return;
    }
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; skid(b,isEased?1:70); if (!isEased) sfx('land'); return; }
    b.z=supportUnder(b).h; b.vx=0; b.vy=0; settle(b);
  }

  function impact(b,ground,hit){
    const t=b.target, speed=-b.vz;
    b.z=ground; b.sq=.09;
    // landed on a card, the deck or the plate: it bounces off and away
    if (inBlock(b.x,b.y,b.d) && !t.slot){
      b.vz=Math.max(140,speed*.35); b.bounces=Math.min(b.bounces,b.maxB-1);
      const before={ x:b.x, y:b.y }; contain(b);
      const L=Math.max(1,Math.hypot(b.x-before.x,b.y-before.y));
      b.vx=(b.x-before.x)/L*120+b.vx*.3; b.vy=(b.y-before.y)/L*90+b.vy*.3; b.x=before.x; b.y=before.y;
      b.fr=Math.PI*3; sfx('card'); return;
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
      const pop=b.bounces===0 && ground<1 && !t.slot && rnd()<.33;
      b.bounces++;
      b.vz=pop?rr(250,310):speed*b.e;
      if (pop){ b.vx*=.45; b.vy*=.45; }
      // flip on the bounce: a half or full turn in the hop, landing flat
      const tHop=2*b.vz/G;
      b.phi=0; b.fr=(pop?2:(tHop>.1?2:0))*Math.PI/Math.max(.05,tHop); b.flipGlint=true;
      if (t.slot){ b.vx=(t.x-b.x)*.72/tHop; b.vy=(t.y-b.y)*.72/tHop; }
      else if (!pop){ b.vx*=.55; b.vy*=.55; }
      sfx(ground>0?'stack':'bounce',speed/900,rise(b,true));
      // a coin landing on a tower sometimes rolls off it on its edge
      if (ground>0 && !t.slot && OPT.roll==='on' && rnd()<.25){
        const L=Math.max(1,Math.hypot(b.vx,b.vy)); b.edge=true; b.fr=0;
        b.vx=b.vx/L*rr(60,110)||rr(-80,80); b.vy=b.vy/L*rr(20,50)||rr(-20,20); b.vz=rr(60,110);
      }
      return;
    }
    b.vz=0; b.fr=0; b.tilt=1; b.back=false;
    sfx(ground>0?'stack':'land',Math.min(1,.45+speed/1400),rise(b));
    if (OPT.roll==='on' && ground<1 && (b.edge || (rnd()<.2 && speed>120))){ b.edge=false; startRoll(b); return; }
    b.edge=false;
    if (b.flipGlint && rnd()<.22) glint(b);
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; skid(b,70+Math.min(120,Math.hypot(t.x-b.x,t.y-b.y)*4)); return; }
    if (OPT.bounces==='dead'){ b.vx=0; b.vy=0; settle(b); return; }        // lands dead
    b.vx*=.7; b.vy*=.7; b.state='slide';
  }
  // RISE: each landing within one throw sounds a semitone higher (capped)
  function rise(b,peek){
    const c=b.opts&&b.opts.combo; if (!c || OPT.rise!=='on') return 1;
    const p=Math.pow(2,Math.min(c.n,14)/12); if (!peek) c.n++; return p;
  }
  function skid(b,ms){ b.x0=b.x; b.y0=b.y; b.T=ms/1000; b.t=0; b.state='skid'; }
  function startRoll(b){
    const t=b.target;
    b.state='roll'; b.t=0; b.T=rr(.6,1); b.x0=b.x; b.y0=b.y; b.rdir=rnd()<.5?-1:1; b.shunted=false;
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; }
    else {
      const v=Math.hypot(b.vx,b.vy), L=rr(22,46);
      const ux=v>1?b.vx/v:rr(-1,1), uy=v>1?b.vy/v:rr(-.5,.5);
      b.tx=b.x+ux*L; b.ty=b.y+uy*L*.5; b.tz=0;
      // never roll onto a card
      if (inBlock(b.tx,b.ty,b.d)){ b.tx=b.x; b.ty=b.y; }
    }
    const mx=(b.x0+b.tx)/2, my=(b.y0+b.ty)/2, L=Math.max(12,Math.hypot(b.tx-b.x0,b.ty-b.y0));
    b.cx=mx-(b.ty-b.y0)/L*b.rdir*16; b.cy=my+(b.tx-b.x0)/L*b.rdir*6;
    sfx('bounce',.4);
  }
  // SHUNT: a resting coin takes the speed of whatever hit it and slides on
  function shunt(q,vx,vy){
    if (q.zone) q.zone.neat=false;
    q.vx=vx; q.vy=vy; q.target={}; q.opts={}; q.state='slide'; q.t=0; active.add(q); kick();
  }
  function settle(b){
    const t=b.target||{};
    if (!t.slot){
      contain(b);
      if (OPT.overlap==='snap' && trySnap(b)) return;
      b.z=supportUnder(b).h;
    }
    if (OPT.rock==='on' && b.z<1 && rnd()<.22){
      b.state='rock'; b.t=0; b.T=rr(.2,.32);
      b.rockSeq=rnd()<.5?[.6,1,.82,1]:[.6,1];
      return;
    }
    finishRest(b);
  }
  // A coin is a solid disc: at the same height it can't sit inside another.
  // Push it clear (a coin is never moved into a card or off the felt), then
  // let it drop to whatever is now under it, and check again.
  function relaxCoin(b){
    if (!b.zone || OPT.overlap==='free') return;
    const min=b.d*MIN_GAP();
    for (let round=0; round<4; round++){
      for (let it=0; it<8; it++){
        let moved=false;
        for (const q of b.zone.list){
          if (q===b || q.state!=='rest' || Math.abs(q.z-b.z)>STEP()*.8) continue;
          const dx=b.x-q.x, dy=(b.y-q.y)*1.4, dist=Math.hypot(dx,dy);
          if (dist>=min) continue;
          const nx=dist>.01?dx/dist:(rnd()<.5?-1:1), ny=dist>.01?dy/dist:0, push=min-dist+.4;
          b.x+=nx*push; b.y+=ny*push/1.4; moved=true;
        }
        contain(b);
        if (!moved) break;
      }
      const sup=supportUnder(b);
      // a coin on a coin can't hang far off it: it would topple
      if (sup.o){
        const dx=b.x-sup.o.x, dy=b.y-sup.o.y, off=Math.hypot(dx,dy*1.4), lim=b.d*.3;
        if (off>lim){ b.x=sup.o.x+dx*lim/off; b.y=sup.o.y+dy*lim/off; }
      }
      if (Math.abs(sup.h-b.z)<.5 && round>0) break;
      b.z=sup.h;
    }
  }
  // After a push (sweep, pay-out) whole stacks can land inside each other:
  // treat each stack as one solid column and push the columns apart.
  function relaxStacks(z){
    if (OPT.overlap==='free' || !z.list.length) return;
    const stacks=[];
    z.list.slice().sort((a,c)=>a.z-c.z).forEach(b=>{
      const s=stacks.find(k=>Math.abs(k.x-b.x)<b.d*.45 && Math.abs(k.y-b.y)<b.d*.35 && b.z>=k.top+STEP()*.5 && (k.top=b.z,true));
      if (s) s.coins.push(b); else stacks.push({ x:b.x, y:b.y, d:b.d, top:b.z, coins:[b] });
    });
    // how far a stack's upper coins sit off its base
    stacks.forEach(k=>{ k.spread=Math.min(k.d*.3,Math.max(0,...k.coins.map(b=>Math.hypot(b.x-k.coins[0].x,(b.y-k.coins[0].y)*1.4)))); });
    for (let it=0; it<80; it++){
      let moved=false;
      for (let i=0;i<stacks.length;i++) for (let j=i+1;j<stacks.length;j++){
        const a=stacks[i], c=stacks[j], min=a.d*MIN_GAP()+a.spread+c.spread;
        const dx=c.x-a.x, dy=(c.y-a.y)*1.4, dist=Math.hypot(dx,dy);
        if (dist>=min) continue;
        const nx=dist>.01?dx/dist:(rnd()<.5?-1:1), ny=dist>.01?dy/dist:0, h=(min-dist)/2+.3;
        a.x-=nx*h; a.y-=ny*h/1.4; c.x+=nx*h; c.y+=ny*h/1.4; moved=true;
      }
      stacks.forEach(k=>{ const probe={ x:k.x, y:k.y, d:k.d, vx:0, vy:0 }; contain(probe); k.x=probe.x; k.y=probe.y; });
      if (!moved) break;
    }
    // slide each column the few px to its new place
    stacks.forEach(k=>k.coins.forEach(b=>{
      const dx=k.x-(k.coins[0].x), dy=k.y-(k.coins[0].y);
      if (Math.abs(dx)<.3 && Math.abs(dy)<.3) return;
      b.tx=b.x+dx; b.ty=b.y+dy; b.tz=b.z; b.lift=0; b.T=.09; b.wait=0; b.state='wait'; b.next='push'; b.target={}; b.opts={}; active.add(b);
    }));
    kick();
  }
  // SNAP: pull a settling coin onto the nearest stack top (max 6 high)
  function trySnap(b){
    if (!b.zone) return false;
    let best=null, bd=1e9;
    for (const q of b.zone.list){
      if (q===b || q.state!=='rest' || q.claimed) continue;       // another coin is already hopping onto it
      const covered=b.zone.list.some(r=>r!==q && r!==b && r.state==='rest' && r.z>q.z+.5 && Math.abs(r.x-q.x)<b.d*.5 && Math.abs(r.y-q.y)<b.d*.4);
      if (covered || q.z/STEP()>=5) continue;
      const dist=Math.hypot(q.x-b.x,(q.y-b.y)*1.4);
      if (dist<b.d*1.05 && dist<bd){ bd=dist; best=q; }
    }
    if (!best) return false;
    best.claimed=b; b.snapOnto=best;
    // LOOSE: v4's ±1px wobble; STRAIGHT: dead-centre towers; LEAN: every
    // stack leans one way, a pixel per coin
    let ox=0, oy=0;
    if (OPT.stack==='loose'){ ox=rint(-1,1); oy=rint(0,1); }
    else if (OPT.stack==='lean'){ if (!best.leanDir) best.leanDir=rnd()<.5?-1:1; ox=best.leanDir; }
    b.leanDir=best.leanDir;
    b.x0=b.x; b.y0=b.y; b.z0=b.z; b.tx=best.x+ox; b.ty=best.y+oy; b.tz=best.z+STEP();
    b.T=.07+Math.min(.06,bd/600); b.arc=3; b.t=0; b.state='tidy'; b.snapping=true;
    return true;
  }
  function finishRest(b){ if (b.zone && !(b.target&&b.target.slot)) b.zone.neat=false; toRest(b); }
  // TOPPLE: a tower leans a beat away from the hit, then spills top-first
  function stackAt(q){ return q.zone ? q.zone.list.filter(c=>c.state==='rest' && Math.abs(c.x-q.x)<c.d*.45 && Math.abs(c.y-q.y)<c.d*.4).sort((a,c)=>c.z-a.z) : [q]; }
  function topple(coins,dx,dy,power){
    if (coins.length<2) return false;
    const L=Math.max(.01,Math.hypot(dx,dy)); dx/=L; dy/=L;
    if (coins[0].zone) coins[0].zone.neat=false;
    const n=coins.length;
    coins.forEach((c,i)=>{ const lv=n-1-i; c.rx=Math.round(dx*lv*.7); dirty.add(c); });
    kick(); sfx('knock');
    const home=coins[0].zone, my=gen;
    setTimeout(()=>{
      coins.forEach((c,i)=>{
        const lv=n-1-i; c.rx=0; dirty.add(c);
        // only coins still resting in this pile topple: one that has since
        // been swept or paid out keeps going where it was sent
        if (my!==gen || c.state!=='rest' || c.zone!==home) return;
        if (lv===0){ shunt(c,dx*40*power,dy*20*power); return; }
        c.target={}; c.opts={}; c.bounces=0; c.maxB=1; c.e=.25; c.knocked=true; c.inFelt=true; c.edge=rnd()<.3;
        c.vx=dx*(40+lv*26)*power+rr(-15,15); c.vy=dy*(20+lv*12)*power+rr(-8,8); c.vz=rr(30,80);
        c.fr=c.edge?0:Math.PI*rint(1,2)/.3; c.phi=0; c.t=.1; c.T=0; c.d0=c.d1=c.d;
        c.wait=i*28; c.state='wait'; c.next='fall'; active.add(c);
      });
      kick();
    },70/OPT.speed);
    return true;
  }

  // Equal-mass chip collisions: a moving chip shoves what it hits.
  function collide(b){
    if (!b.zone) return;
    for (const q of b.zone.list){
      if (q===b || Math.abs(q.z-b.z)>STEP()*1.5) continue;
      if (q.state!=='rest' && q.state!=='slide') continue;
      const dx=b.x-q.x, dy=(b.y-q.y)*1.4, dist=Math.hypot(dx,dy), min=b.d*MIN_GAP();
      if (dist>=min || dist<.01) continue;
      const nx=dx/dist, ny=dy/dist, over=min-dist;
      const qMoves=q.z<1 && OPT.knock!=='off';
      const share=qMoves?.5:1;
      b.x+=nx*over*share; b.y+=ny*over*share/1.4;
      const rvx=b.vx-(q.vx||0), rvy=b.vy-(q.vy||0), vn=rvx*nx+rvy*ny;
      if (vn<0){
        if (qMoves && q.state==='rest' && -vn>30){
          // like pool balls: the hit coin takes most of the speed, the
          // hitter nearly stops, and the hit coin can go on to hit the next
          b.vx+=-vn*.9*nx; b.vy+=-vn*.9*ny;
          shunt(q,vn*.85*nx,vn*.85*ny/1.4); sfx('stack',.6);
        } else {
          const j=-(1.15)*vn/(qMoves?2:1);
          b.vx+=j*nx; b.vy+=j*ny;
          if (qMoves){
            q.vx=(q.vx||0)-j*nx; q.vy=(q.vy||0)-j*ny/1.4;
            if (q.state==='rest' && Math.hypot(q.vx,q.vy)>22){ q.target={}; q.zone.neat=false; q.state='slide'; q.t=0; active.add(q); }
            else if (q.state==='rest'){ q.vx=q.vy=0; }
          }
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
    // a hard hit on a tall tower topples it, away from the hit
    if (speed>300){
      const bases=near.filter(q=>q.z<1);
      for (const q of bases){
        const tower=stackAt(q);
        if (tower.length>=4 && rnd()<.6){ topple(tower,q.x-b.x||rr(-1,1),q.y-b.y,1+Math.min(.6,(speed-300)/800)); return; }
      }
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
  function glint(b){ glintAt(b.x+b.d*.22,b.y-b.z-b.d*.85); }
  function glintAt(x,y,delay){
    if (OPT.juice!=='on' || motionOff()) return;
    setTimeout(()=>{
      const p=document.createElement('i'); p.className='ct-glint';
      p.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px)';
      (air||document.body).appendChild(p); setTimeout(()=>p.remove(),260/OPT.speed);
    },(delay||0)/OPT.speed);
  }
  // a sparkle runs along the tops of the stacks when a tidy locks
  function glintPile(z){
    const tops=new Map();
    z.list.forEach(b=>{ const k=Math.round(b.x)+','+Math.round(b.y); if (!tops.has(k)||tops.get(k).z<b.z) tops.set(k,b); });
    [...tops.values()].sort((a,c)=>a.x-c.x).forEach((b,i)=>{ if (i%2===0) glintAt(b.x+b.d*.2,b.y-b.z-b.d*.95,i*28); });
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
    const hr=pixel?HR():1;
    if (!b.el._base){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=Math.round(dnow*hr)+'px'; }
    if (pixel){
      if (Math.abs(dnow-b.el._base)>1 && (b.state!=='air' || Math.abs(dnow-b.d1)<1)){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=Math.round(dnow*hr)+'px'; }
      setFrame(b.chip,b.el._base,ti,b.back&&b.state!=='rest');
    } else if (b.state!=='rest'){
      sy=Math.max(.18,b.tilt);
      if (b.state==='roll'){ sx=.32; sy=1; }
    }
    if (b.sq>0){ sx*=b.sq>.05?1.2:1.1; sy*=b.sq>.05?.76:.88; }
    const s=(b.d*lift)/b.el._base, H=Math.round(b.el._base*hr);
    // the sprite's bottom-centre sits on the chip's ground point (lifted by z)
    const x=Math.round(b.x-b.el._base/2+(b.rx||0)), y=Math.round(b.y-b.z-H);
    const rot=pixel?Math.round(b.rot/15)*15:Math.round(b.rot);
    b.el.style.transformOrigin='50% 100%';
    b.el.style.transform='translate('+x+'px,'+y+'px)'+(rot?' rotate('+rot+'deg)':'')+' scale('+(s*sx).toFixed(3)+','+(s*sy).toFixed(3)+')';
    b.el.style.zIndex=String(1000+Math.round(b.y*4+b.z));          // v4 order: keeps a stack's coins in order
    // depth: a hard shadow line under every coin; coins with one on top are darker
    if (OPT.depth==='on'){
      let covered=false;
      if (b.state==='rest' && b.zone) covered=b.zone.list.some(q=>q!==b && q.state==='rest' && q.z>b.z+.5 && Math.abs(q.x-b.x)<b.d*.62 && Math.abs(q.y-b.y)<b.d*.5);
      const f='drop-shadow(0 1px 0 rgba(28,14,0,.8))'+(covered?' brightness(.78)':'');
      if (b.el._f!==f){ b.el._f=f; b.el.style.filter=f; }
    } else if (b.el._f){ b.el._f=''; b.el.style.filter=''; }
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
    // an even number of half-turns (lands face-up), slow enough to read
    const flips=()=>OPT.flips==='many'?(rnd()<.7?2:4):2;
    if (kind==='stream'){
      const base=n<=3?90:n<=10?60:34; let t=0;
      for (let i=0;i<n;i++){ out.push({ t, T:1, flips:1 }); t+=irr?base*(.35+rnd()*1.6):base; }
      return out;
    }
    if (kind==='hop'){
      // the sweep: quick hops off the top of a pile, one full turn each
      let t=0;
      for (let i=0;i<n;i++){ out.push({ t, T:rr(.82,.98), flips:2 }); t+=rint(20,40); }
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
      for (let i=0;i<n;i++) out.push({ t:rnd()*90, T:rr(.92,1.2), flips:flips() });
      return out;
    }
    // lob and heave: blooming handfuls, each handful its own arc height
    const splashFrom=kind==='heave'?Math.ceil(n*.38):n;
    let t=0, i=0;
    while (i<splashFrom){
      const size=irr?rint(2,5):4, arc=rr(.9,1.12);
      for (let k=0;k<size && i<splashFrom;k++,i++) out.push({ t:t+(bloom?rint(0,50):rint(0,6)), T:arc*(bloom?rr(.9,1.1):1), flips:flips() });
      t+=irr?rint(70,140):100;
    }
    if (kind==='heave'){
      t+=60;
      for (;i<n;i++) out.push({ t:t+rnd()*110, T:rr(1,1.22), flips:flips() });
    }
    return out;
  }
  // items: [{ b, to, onStart }]
  function throwAll(items,kind,extra){
    const delay=(extra&&extra.delay)||0;
    const p=plan(items.length,kind);
    const big=extra&&extra.big?{ done:false }:null;
    const combo={ n:0 };
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
      return launch(it.b,it.to,{ big, combo, wait:pl.t+delay, T:eased()?undefined:T, i, mode:pl.mode, tumble:pl.tumble, grip:pl.grip, toss,
        jx:loose?rr(-6,6):0, jy:loose?rr(-3,3):0, flips, onStart:it.onStart }).then(()=>{ if (it.onLand) it.onLand(); });
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
    felt.querySelectorAll('.cl-spot,.cl-pot,.ct-chute,.ct-tray').forEach(el=>el.remove());
    felt.dataset.nums=OPT.nums;
    $('pot-area').classList.remove('hidden');
    const pr=$('pot-area').querySelector('.pot-chip').getBoundingClientRect();
    // the pot's tray: centred on the pot pile, drawn under the coins
    const TW=200, TH=58;
    const tray=document.createElement('div'); tray.className='ct-tray'; tray.dataset.tray=OPT.tray;
    Object.assign(tray.style,{ width:TW+'px', height:TH+'px', left:Math.round(pr.left+pr.width/2-fr.left-TW/2)+'px', top:Math.round(pr.top-fr.top-16-TH/2-5)+'px' });
    felt.appendChild(tray);
    TRAY=OPT.tray==='none'?null:{ cx:pr.left+pr.width/2, cy:pr.top-16-5, rx:TW/2-6, ry:TH/2-4, oval:false };
    zone('pot',pr.left+pr.width/2,pr.top-16,9,15,44);
    const bb=$('board').getBoundingClientRect();
    if (bb.height) zones.pot.room=(pr.top-16)-bb.bottom-10;
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
    const cols=coloursFor(amount), tick=ticker(p.id,z.amount-amount,amount,cols.length);
    plate(p.id,z.amount-amount);
    const items=cols.map(col=>{
      const s=source(p), b=body(makeChip(col),s.x,s.y,s.z,D()-2);
      return { b, to:targetIn(z,b), onStart:()=>chuteKick(s.chute), onLand:tick };
    });
    await throwAll(items,kind,{ big:allin });
    await zoneSettled(z,2500);
  }
  async function youBet(amount,label,allin){
    const my=gen;
    const you=P[0]; you.chips=Math.max(0,you.chips-amount); updateJackpot(you.chips);
    you.totalBetHand+=amount; updateInvestedReel(you.totalBetHand);
    say('YOU',label.toUpperCase());
    const z=zones['spot:you']; z.amount+=amount;
    const cols=coloursFor(amount), tick=ticker('you',z.amount-amount,amount,cols.length);
    plate('you',z.amount-amount);
    const items=[];
    for (const col of cols){
      const t=bank.take(); if (!t) break;
      if (t.c.colour!==col){ t.c.colour=col; t.c.frame=''; if (!pixelArt()) styleChip(t.c); }
      const r=t.rect, b=body(t.c,r.left+r.width/2,r.bottom,0,r.width);
      items.push({ b, to:targetIn(z,b), onLand:tick });
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
    const potPlate=document.querySelector('#pot-area .pot-chip');
    let shown=potValue;
    if (OPT.sweep==='jump'){
      // each pile empties into the pot top-first, coin by coin, in turn
      let delay=0; const throws=[];
      ids.forEach(k=>{
        const z=zones[k], list=z.list.slice().sort((a,c)=>c.z-a.z); z.list.length=0;
        const each=z.amount/Math.max(1,list.length);
        spotEls[k.slice(5)].classList.add('is-sweeping'); spotEls[k.slice(5)].classList.remove('is-pop');
        const items=list.map(b=>{ b.zone=null; b.inFelt=true; return { b, to:targetIn(pot,b), onLand:()=>{ shown+=each; paintPot(shown); punch(potPlate); } }; });
        throws.push(throwAll(items,'hop',{ delay }));
        delay+=160+list.length*24;
      });
      potValue+=total;
      await Promise.all(throws); guard(my);
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
    await Promise.all(all); guard(my);
    overshootPot(potValue);
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
    await waitMs(160); sfx('lock'); sfx('sting',1,1);
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
  function unlockAudio(){ Coin.unlock(); }
  function setOpt(k,v){
    if (k==='preset'){ OPT.preset=v; OPT.eased=false; Object.assign(OPT,PRESETS[v]); }
    else { OPT[k]=k==='speed'?Number(v):v; if (!['speed','sound','random'].includes(k)){ OPT.preset='custom'; OPT.eased=false; } }
    settings.sound=OPT.sound==='on';
    syncPanel();
    if (['source','preset','art','size','after','body','tray','nums'].includes(k)) setup();
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
      if (a.unlock) a.unlock();
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
    document.addEventListener('pointerdown',unlockAudio,{ capture:true });
    window.__chipThrowLab={ run:(k)=>{ unlockAudio(); return run(k); }, unlock:unlockAudio, OPT, setup, set:setOpt, last:()=>lastRun, busy:()=>busy, walls:()=>WALLS,
      state:()=>({ bank:bank.chips.length, pot:zones.pot.list.length, potNeat:zones.pot.neat, active:active.size,
        air:air?air.querySelectorAll('.cl-chip').length:0, you:P[0].chips,
        spots:Object.keys(zones).filter(k=>k.startsWith('spot:')).map(k=>k.slice(5)+':'+zones[k].list.length).join(' ') }),
      // where every resting chip on the felt is, for checks
      bodies:()=>Object.values(zones).flatMap(z=>z.list.map(b=>({ zone:z.id, x:b.x, y:b.y, z:b.z, d:b.d, state:b.state }))),
      blocked:()=>Object.values(zones).flatMap(z=>z.list).filter(b=>b.state==='rest' && b.z<1 && inBlock(b.x,b.y,b.d)).length,
      offFelt:()=>{ const F=WALLS.felt; return Object.values(zones).flatMap(z=>z.list).filter(b=>b.x<F.L||b.x>F.R||b.y<F.T||b.y>F.B+1).length; },
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
