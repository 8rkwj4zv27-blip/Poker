/* ============================================================
   COIN WORLD — with DENOMINATIONS (the coin economy pass, v0.44.0; built
   in coin-denom-lab.html, whose candidate js/coin-denom-world.js this was).

   What it adds to the shipped world: three pieces, all gold, with a fixed
   ratio. A SMALL coin is the small blind; a BIG coin is five small; a BAR
   is five big (25 small). Each piece keeps its own size, thickness, sprite,
   flight and sound; a tower only ever holds one kind of piece, so the
   stacking, grid and push-apart rules (built for one coin size) still hold,
   run with each piece's own width. Bars rest as boxes (bricks), coins as
   discs. The pot tidies in bands: small coins in front, big coins behind,
   bars at the back. merge() is the change-up: five pieces jump up out of
   the pile, clink together and pop into the next piece up.

   Everything else is the shipped world unchanged (see js/coin-world.js
   for the original notes).
   ============================================================ */
(function(){
  'use strict';

  /* ---------------- options & presets ---------------- */
  const BASE={ art:'gold', body:'thick', depth:'on', overlap:'snug', size:'m', shadow:'on', throw:'bybet', hand:'bloom', timing:'irregular',
    flips:'many', toss:'off', source:'edge', bounces:'multi', rock:'on', roll:'on', knock:'on', juice:'on', after:'tap', sweep:'push',
    random:'fresh', sfx:'clack', rise:'on', group:'on' };
  BASE.overlap='snap'; BASE.stack='loose'; BASE.tidy='spread'; BASE.tray='well'; BASE.lip='on'; BASE.nums='pop'; BASE.sweep='jump';
  // the coin spin (v9): axis, turns per second, frames per turn, lighting, landing side
  BASE.spin='side'; BASE.spinSpeed='med'; BASE.spinFrames='16'; BASE.light='on'; BASE.lands='random';
  // v10: the owner's settled mix is the default
  Object.assign(BASE,{ sfx:'clay', nums:'off', spin:'toss', spinSpeed:'slow', lands:'heads', coins:'more' });
  // the pot's shape when it tidies (see potSlots): MIX picks one each hand
  // from these odds (or each tidy: potEvery), a tap on the felt re-picks
  Object.assign(BASE,{ potShape:'mix', potMix:{ pyramid:3, heap:3, rows:2 }, potEvery:'hand', potTap:'on' });
  // the denominations' look and feel (the lab's TUNE sheet sets these)
  Object.assign(BASE,{ bigScale:1.4, barScale:1.75, bigLook:'ring', barLook:'bullion', mergeShow:'some' });
  const OPT={ preset:'v11', ...BASE, speed:1, sound:'on' };
  const SIZES={ s:13, m:15, l:17 };
  const D=()=>SIZES[OPT.size];
  // coin thickness (px, edge-on) and the stack step it gives at rest
  const THICK=d=>OPT.body==='thick'?Math.round(d*.52):Math.max(2,Math.round(d*.2));
  const STEP=()=>OPT.body==='thick'?Math.max(3,Math.round(THICK(D())*.57)):Math.max(2,Math.round(D()*.2));
  // sprite height: thick coins need a taller canvas for their edge
  const HR=()=>OPT.body==='thick'?1.2:1;
  const eased=()=>!!OPT.eased;

  /* ---------------- the pieces (denominations) ----------------
     Value in small coins: SMALL 1, BIG 5, BAR 25. A piece's colour key is
     its kind ('gold', 'gold-big', 'gold-bar'): the tidy already keeps one
     colour per stack, so one kind per tower falls out of it. Sizes are the
     small coin's (D) scaled; a bar is a short brick seen from the table's
     tilt, a box on the felt (width across, DEPTH front to back). */
  const PIECES={ gold:{ v:1, name:'small' }, 'gold-big':{ v:5, name:'big' }, 'gold-bar':{ v:25, name:'bar' } };
  const KINDS=['gold','gold-big','gold-bar'];                // small to large
  const isBar=col=>col==='gold-bar';
  const isBig=col=>col==='gold-big';
  const scaleOf=col=>isBig(col)?(+OPT.bigScale||1.4):(isBar(col)?(+OPT.barScale||1.75):1);
  const pieceD=col=>Math.round(D()*scaleOf(col));
  // a bar's sprite: top face + front face, height to width
  const BAR_HR=.7, BAR_DEPTH=.46;
  const STEPd=d=>OPT.body==='thick'?Math.max(3,Math.round(THICK(d)*.57)):Math.max(2,Math.round(d*.2));
  const stepOf=q=>{ const col=typeof q==='string'?q:q.colour; return isBar(col)?Math.max(STEP()+1,Math.round(pieceD(col)*.24)):(isBig(col)?STEPd(pieceD(col)):STEP()); };
  const hrOf=col=>isBar(col)?BAR_HR:HR();
  const pieceH=col=>Math.round(pieceD(col)*hrOf(col));
  // front-to-back size on the felt, in the same units as a coin's width
  const depthOf=(col,d)=>isBar(col)?(d||pieceD(col))*BAR_DEPTH:(d||pieceD(col));
  // do two pieces' footprints overlap? discs for coins, boxes for bars
  function clash(x,y,col,d,q,qx,qy){
    qx=qx==null?q.x:qx; qy=qy==null?q.y:qy;
    const dx=Math.abs(qx-x), dyF=Math.abs(qy-y)*FORE;
    if (!isBar(col) && !isBar(q.colour)) return Math.hypot(dx,dyF)<(d+q.d)/2-.5;
    return dx<(d+q.d)/2-.5 && dyF<(depthOf(col,d)+depthOf(q.colour,q.d))/2-.5;
  }
  // pieces for `units` small coins, as many as `cap` allows: all small
  // coins, then five of the commoner kind (small or big) change up into
  // one of the next, only until the handful fits, so a big bet keeps a mix
  // (some small coins, big coins, a bar or two). Returns { gold, big, bar, n }.
  function upFrom(s,b){ return s>=5 && (s>=b || b<5) ? 'gold' : (b>=5 ? 'gold-big' : null); }
  function compose(units,cap){
    units=Math.max(0,Math.round(units)); cap=Math.max(1,cap|0);
    let s=units, b=0, r=0;
    while (s+b+r>cap){
      const k=upFrom(s,b); if (!k) break;
      if (k==='gold'){ s-=5; b++; } else { b-=5; r++; }
    }
    return { gold:s, big:b, bar:r, n:s+b+r };
  }
  const valueOf=col=>(PIECES[col]||PIECES.gold).v;

  /* ---------------- random (fresh every run unless "same") ---------------- */
  let seed=7;
  function reseed(){ seed=OPT.random==='same'?7:((Date.now()^Math.floor(Math.random()*1e9))>>>0)||7; }
  function rnd(){ seed=(seed*1103515245+12345)>>>0; return (seed>>>8)/0x1000000; }
  const rint=(a,b)=>a+Math.floor(rnd()*(b-a+1));
  const rr=(a,b)=>a+rnd()*(b-a);

  /* ---------------- chip language ---------------- */
  const COLOURS=['d-white','d-red','d-blue','d-green','d-black','d-purple','d-yellow'];
  const BB=20;
  /* COIN COUNTS (v10). FEW: a bet throws a handful that still grows with
     the money but flattens off fast; every pile has a limit (LIM), and
     coins thrown past it melt into the pile. LOTS is v9 (the game's own
     visualChipCount, one coin per ~$35). */
  const CURVES={
    few: { bet:[[0,0],[10,1],[20,2],[40,3],[100,4],[200,5],[400,7],[800,9],[1500,11],[3000,12]],
           bank:[[0,0],[20,2],[200,7],[1000,16],[2500,23],[5000,28]] },
    some:{ bet:[[0,0],[10,1],[20,2],[60,4],[180,7],[400,10],[1000,14],[2000,17],[4000,20]],
           bank:[[0,0],[20,2],[200,10],[1000,24],[3000,34],[6000,40]] },
    more:{ bet:[[0,0],[10,1],[20,2],[60,3],[100,5],[200,8],[400,12],[1000,18],[2000,22],[4000,24]],
           bank:[[0,0],[20,2],[200,10],[1000,24],[3000,34],[6000,40]] }
  };
  const LIMITS={ few:{ bet:12, allin:8, spot:14, pot:36, bank:28 }, some:{ bet:20, allin:12, spot:22, pot:50, bank:40 }, more:{ bet:24, allin:16, spot:30, pot:60, bank:40 }, lots:{ bet:60, allin:0, spot:999, pot:999, bank:999 } };
  const LIM=()=>LIMITS[OPT.coins]||LIMITS.few;
  function curve(pts,v){
    if (v<=0) return 0;
    for (let i=1;i<pts.length;i++){ const [a0,c0]=pts[i-1], [a1,c1]=pts[i]; if (v<=a1) return c0+(v-a0)/(a1-a0)*(c1-c0); }
    return pts[pts.length-1][1];
  }
  function betCoins(amount,allin){
    if (amount<=0) return 0;
    if (!CURVES[OPT.coins]) return visualChipCount(amount);
    let n=Math.max(1,Math.round(curve(CURVES[OPT.coins].bet,amount)));
    if (allin) n=Math.max(n,LIM().allin);
    return Math.min(LIM().bet,n);
  }
  function bankCoins(chips){
    if (chips<=0) return 0;
    if (!CURVES[OPT.coins]) return visualChipCount(chips);
    return Math.max(1,Math.min(LIM().bank,Math.round(curve(CURVES[OPT.coins].bank,chips))));
  }
  function coloursFor(amount,count){
    const n=count!=null?count:betCoins(amount), out=[];
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
  // the felt seen at the resting tilt: a pixel up the screen is FORE across
  // (a resting coin's face is TILTS[REST] as tall as it is wide)
  const FORE=1/TILTS[REST];
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
  function coinFrame(d,c,back,big){
    if (OPT.body==='thick') return thickCoinFrame(d,c,back,big);
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
  function thickCoinFrame(d,c,back,big){
    let face=hex('#f4c43e'), bevHi=hex('#ffe88a'), bevLo=hex('#b87a10'), hi=hex('#fff5c0'), line=hex('#c68a16');
    // BIG: RING (a raised ring inside the rim), DEEP (a richer, redder gold
    // with the ring), PLAIN (just bigger)
    const look=big?OPT.bigLook:'';
    if (look==='deep'){ face=hex('#eaa42c'); bevHi=hex('#ffd36a'); bevLo=hex('#a45e0a'); line=hex('#b0660c'); }
    const ring=look==='ring'||look==='deep';
    const e1=hex('#c98a1a'), e2=hex('#e8ad32'), eLo=hex('#7c4a06'), ink=hex('#2e1a04');
    if (back){ face=dark(face,.66); bevHi=dark(bevHi,.7); bevLo=dark(bevLo,.7); hi=dark(hi,.7); line=dark(line,.62); }
    return render(d,c,(nx,ny,r,a,s)=>{
      if (r>.76) return ny<-.1 ? bevHi : (ny>.25 ? bevLo : (a<0?bevHi:bevLo));
      if (ring && !back && Math.abs(r-.6)<.9/Math.max(3,Math.min(s.rx,s.ry*1.4))) return ny<0?bevLo:bevHi;
      if (!back && Math.abs(nx)<.8/s.rx && Math.abs(ny)<(ring?.36:.5)) return line;
      if (!back && nx>-.6 && nx<-.34 && Math.abs(ny)<.42) return hi;
      if (back && (Math.abs(r-.46)<.9/Math.max(3,Math.min(s.rx,s.ry*1.4)) || r<.14)) return line;
      return face;
    },(nx,s,x,fromBottom)=>(fromBottom<1.2?eLo:(x%2?e1:e2)),ink);
  }
  /* A GOLD BAR, drawn by code at width w: INGOT (a trapezoid: the top face
     narrower than the base, a stamped panel on top) or BRICK (square
     ends, three lines on its face). c is how much of the top face shows:
     1 at rest (the table's tilt), 0 edge-on in a tumble; `back` is the
     underside (darker, no stamp). */
  /* THE BAR, round 2 (owner: the ingot needs to be cooler). Three
     looks, each a small 3D solid rasterised face by face at the sprite's
     real size, then outlined:
     - STAMPED: a proper cast ingot. Sloped sides lit left and shaded
       right, a lit lip along the top's front edge, a recessed stamp panel
       with a bright mark, a diagonal glint across the top.
     - BULLION: the three-quarter vault bar. Its right end face shows, so
       it reads as a heavy block with depth; a rim-lit top, a small stamp.
     - TREASURE: the arcade bar. Chunky and bright: a yellow top with a
       star sparkle, an orange-gold face with a hot band and rivets.
     c is how much of the top shows (the table's tilt at rest, 0 edge-on in
     a tumble); `back` is the underside. */
  const BAR_LOOKS=['stamped','bullion','treasure'];
  function inPoly(pts,x,y){
    let inside=false;
    for (let i=0,j=pts.length-1;i<pts.length;j=i++){
      const [xi,yi]=pts[i], [xj,yj]=pts[j];
      if (((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  }
  function bar2Frame(w,c,back,look){
    const h=Math.round(w*BAR_HR);
    const topMax=Math.round(w*.34), frontMin=Math.max(4,Math.round(w*.23)), k=Math.min(1,c/TILTS[REST]);
    const tdep=Math.max(0,Math.round(topMax*k)), fh=frontMin+Math.round((1-k)*(h-2-frontMin-topMax));
    const yB=h-1.5, yF=yB-fh, yT=yF-tdep;
    const C=v=>{ const p=hex(v); return back?dark(p,.68):p; };
    const fill=new Array(w*h).fill(null), faces=[];
    if (look==='bullion'){
      const sk=Math.max(2,Math.round(w*.13)), ins=1;
      const Rf=w-1.5-sk;
      faces.push({ pts:[[Rf-ins,yF],[w-1.5-ins,yT],[w-1.5,yT+fh],[Rf,yB]], paint:(x,y)=>C(y<yF+1?'#c98a1a':(x>Rf+sk*.6?'#7f4a08':'#9c600f')) });
      faces.push({ pts:[[1.5+ins,yF],[Rf-ins,yF],[Rf,yB],[1.5,yB]], paint:(x,y)=>C(y>yB-1.2?'#7c4a06':(y<yF+1.2?'#f0bb44':(x<3.5?'#e6a83a':(y>yB-2.5?'#c4841e':'#d8962a')))) });
      faces.push({ pts:[[1.5+ins,yF],[Rf-ins,yF],[w-1.5-ins,yT],[1.5+ins+sk,yT]], paint:(x,y)=>{
        if (y>yF-1.2) return C('#fff0a0');
        const sh=(yF-y)/Math.max(1,tdep)*sk, lx=1.5+ins+sh;
        if (x<lx+1.2) return C('#ffe27a');
        if (!back && tdep>=6){ const cx=(lx+Rf-ins+sh)/2, cy=(yT+yF)/2; if (Math.abs(x-cx)<=4 && Math.abs(y-cy)<=1.5) return C(Math.abs(y-cy)<=.5&&Math.abs(x-cx)<=2.5&&((x|0)%2===0)?'#fff3b4':'#cf9420'); }
        return C('#f6c43c');
      } });
    } else if (look==='treasure'){
      const ins=1;
      faces.push({ pts:[[1.5+ins,yF],[w-1.5-ins,yF],[w-1.5,yF+1.5],[w-1.5,yB-1],[w-2.5,yB],[2.5,yB],[1.5,yB-1],[1.5,yF+1.5]], paint:(x,y)=>{
        if (y>yB-1.3) return C('#8a3f08');
        if (y>yB-2.6) return C('#b35a10');
        if (y<yF+1.4) return C('#ffd34a');
        if (!back && fh>=5 && Math.abs(y-(yF+(yB-yF)/2+.5))<.6 && (Math.abs(x-4.5)<.6 || Math.abs(x-(w-5.5))<.6)) return C('#8a3f08');
        return C('#ec9e1e');
      } });
      faces.push({ pts:[[1.5+ins,yF],[w-1.5-ins,yF],[w-2.5-ins,yT+1],[w-3.5-ins,yT],[3.5+ins,yT],[2.5+ins,yT+1]], paint:(x,y)=>{
        if (!back && tdep>=5){
          const sx=Math.round(w*.3), sy=Math.round(yT+tdep*.45);
          if ((Math.abs(x-.5-sx)<.6 && Math.abs(y-.5-sy)<1.6) || (Math.abs(y-.5-sy)<.6 && Math.abs(x-.5-sx)<1.6)) return C('#ffffff');
          if (Math.abs(x-.5-(w-7))<.6 && Math.abs(y-.5-(yT+2))<.6) return C('#fffbe0');
        }
        if (y>yF-1.3) return C('#fff3b4');
        return C(y<yT+2?'#f7cf3a':'#ffe25a');
      } });
    } else {
      // STAMPED
      const ins=Math.max(2,Math.round(w*.12));
      faces.push({ pts:[[1.5+ins,yF],[w-1.5-ins,yF],[w-1.5,yB],[1.5,yB]], paint:(x,y)=>{
        const t=(y-yF)/Math.max(1,yB-yF), L=1.5+ins*(1-t), R=w-1.5-ins*(1-t);
        if (y>yB-1.2) return C('#7c4a06');
        if (x<L+1.6) return C('#f2c24a');
        if (x>R-2.2) return C('#9c600f');
        if (y<yF+1.2) return C('#ffe07a');
        return C(y>yB-2.4?'#c0801c':'#d8962a');
      } });
      const tin=ins+1;
      faces.push({ pts:[[1.5+ins,yF],[w-1.5-ins,yF],[w-1.5-tin,yT],[1.5+tin,yT]], paint:(x,y)=>{
        if (y>yF-1.2) return C('#fff0a0');
        if (y<yT+1) return C('#e0a830');
        const L=1.5+tin, R=w-1.5-tin;
        if (!back){
          // a glint across the top, front-left to back-right
          const g=(x-L)-(yF-y)*1.1;
          if (g>2 && g<3.4 && !(tdep>=6 && x>L+3 && x<R-3 && y>yT+1.5 && y<yF-2)) return hex('#fffbe0');
          if (tdep>=6 && x>L+2.5 && x<R-2.5 && y>yT+1.2 && y<yF-1.8){
            const edge=x<L+3.6 || x>R-3.6 || y<yT+2.4 || y>yF-2.9;
            if (edge) return C('#c98e1e');
            const cx=(L+R)/2, cy=(yT+yF)/2;
            if (Math.abs(x-cx)+Math.abs(y-cy)*1.6<1.8) return hex('#fff3b4');
            return C('#e8b232');
          }
        }
        if (x<L+1.4) return C('#ffe070');
        if (x>R-1.4) return C('#d49a28');
        return C('#f6c43c');
      } });
    }
    for (let y=0;y<h;y++) for (let x=0;x<w;x++){
      for (let f=faces.length-1;f>=0;f--){ if (inPoly(faces[f].pts,x+.5,y+.5)){ fill[y*w+x]=faces[f].paint(x+.5,y+.5); break; } }
    }
    return paintFill(fill,w,h,hex('#2a1603'));
  }
  function barFrame(w,c,back){
    if (BAR_LOOKS.includes(OPT.barLook)) return bar2Frame(w,c,back,OPT.barLook);
    const h=Math.round(w*BAR_HR), ingot=OPT.barLook!=='brick';
    // at rest (c = the table's tilt) the whole top face shows
    const topMax=Math.round(w*.34), frontMin=Math.max(4,Math.round(w*.23)), k=Math.min(1,c/TILTS[REST]);
    const tdep=Math.max(0,Math.round(topMax*k)), fh=frontMin+Math.round((1-k)*(h-2-frontMin-topMax));
    const yB=h-2, yF0=yB-fh+1, yT0=yF0-tdep, ins=ingot?Math.max(2,Math.round(w*.11)):0;
    let top=hex('#f6c940'), topHi=hex('#fff3b4'), stamp=hex('#d39a22'), front=hex('#d99b24'), frontHi=hex('#eab23a'), end=hex('#b27410'), foot=hex('#7c4a06');
    if (back){ top=dark(top,.66); topHi=dark(topHi,.7); stamp=top; front=dark(front,.72); frontHi=dark(frontHi,.72); end=dark(end,.75); }
    const ink=hex('#2e1a04'), fill=new Array(w*h).fill(null);
    for (let y=yF0;y<=yB;y++){
      const t=fh>1?(y-yF0)/(fh-1):1, i=Math.round(ins*(1-t)), L=1+i, R=w-2-i;
      for (let x=L;x<=R;x++) fill[y*w+x]=y===yB?foot:(x<=L||x>=R?end:(y===yF0+1&&tdep>0?frontHi:front));
      if (!ingot && fh>6 && !back) [.3,.5,.7].forEach(k=>{ const x=Math.round(L+(R-L)*k); if (y>yF0+1 && y<yB-1) fill[y*w+x]=end; });
    }
    for (let y=yT0;y<yF0;y++){
      const t=tdep>1?(y-yT0)/(tdep-1):1, i=ins+(ingot?Math.round((1-t)*1):0), L=1+i, R=w-2-i;
      for (let x=L;x<=R;x++){
        let p=y===yF0-1?topHi:top;
        if (!back && ingot && tdep>=5 && y>yT0 && y<yF0-2 && x>L+2 && x<R-2 && (y===yT0+1||y===yF0-3||x===L+3||x===R-3)) p=stamp;
        if (!back && !ingot && tdep>=4 && y===yT0+1 && x>L+1 && x<L+Math.round((R-L)*.4)) p=topHi;
        fill[y*w+x]=p;
      }
    }
    return paintFill(fill,w,h,ink);
  }
  function paintFill(fill,w,h,ink){
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const ctx=cv.getContext('2d'), img=ctx.createImageData(w,h), px=img.data, inkAt=[];
    for (let y=0;y<h;y++) for (let x=0;x<w;x++){
      if (fill[y*w+x]) continue;
      if ([[1,0],[-1,0],[0,1],[0,-1]].some(([ox,oy])=>{ const X=x+ox,Y=y+oy; return X>=0&&Y>=0&&X<w&&Y<h&&fill[Y*w+X]; })) inkAt.push(y*w+x);
    }
    inkAt.forEach(i=>{ fill[i]=ink; });
    for (let i=0;i<w*h;i++){ const p=fill[i]; if (!p) continue; px[i*4]=p[0]; px[i*4+1]=p[1]; px[i*4+2]=p[2]; px[i*4+3]=255; }
    ctx.putImageData(img,0,0);
    return 'url('+cv.toDataURL()+')';
  }
  function frames(col,d){
    const k=col+'|'+d+'|'+OPT.body+'|'+(isBig(col)?OPT.bigLook:'')+'|'+(isBar(col)?OPT.barLook:'');
    if (frameCache[k]) return frameCache[k];
    const make=(c,back)=>col==='gold'?coinFrame(d,c,back):(isBig(col)?coinFrame(d,c,back,true):(isBar(col)?barFrame(d,c,back):chipFrame(col,d,c,back)));
    return frameCache[k]={ front:TILTS.map(c=>make(c,false)), back:TILTS.map(c=>make(c,true)) };
  }
  /* ============================================================
     COIN SPIN (v9). A coin in the air spins over and over, heads to tails:
     frames are drawn by code for the whole turn. SIDE spins about the
     upright axis (the coin narrows to a line, the classic video-game
     coin); TOSS about the level axis (a thumb-flipped coin); both show the
     coin's thick reeded edge as it turns, a lit heads face (slot line,
     highlight) and a darker tails face (a ring), and with LIGHT on the face
     brightens as it swings toward the light, with a white streak at the
     peak.
     ============================================================ */
  const spinCache={};
  function spinFrame(d,axis,k,N,big){
    const h=Math.round(d*HR()), light=OPT.light==='on';
    const look=big?OPT.bigLook:'', ring=look==='ring'||look==='deep';
    const key=[d,h,axis,k,N,light,OPT.body,look].join('|');
    if (spinCache[key]) return spinCache[key];
    // a spinning coin shows a coin-thin edge (the chunky resting thickness
    // made a turning coin read as a barrel)
    const th=Math.max(2,Math.round(d*(OPT.body==='thick'?.26:.2))), R=d/2-.6, a=2*Math.PI*k/N, c=Math.cos(a), sn=Math.sin(a);
    const heads=c>=0, face=Math.max(.07,Math.abs(c));
    // face ellipse radii and the edge band's sweep vector
    let ax, ay, bx, by;
    if (axis==='side'){ ax=R*face; ay=R*.86; bx=(sn>=0?1:-1)*th*Math.abs(sn); by=th*.35; }
    else { ax=R; ay=R*face; bx=0; by=(sn>=0?1:-1)*th*Math.abs(sn); }
    const cv=document.createElement('canvas'); cv.width=d; cv.height=h;
    const ctx=cv.getContext('2d'), img=ctx.createImageData(d,h), px=img.data;
    // centre the swept shape horizontally; sit it on the bottom of the sprite
    const minX=Math.min(-ax,-ax+bx), maxX=Math.max(ax,ax+bx), minY=Math.min(-ay,-ay+by), maxY=Math.max(ay,ay+by);
    const fx=d/2-(minX+maxX)/2, fy=h-1.5-maxY;
    const inFace=(x,y,ox,oy)=>{ const nx=(x-fx-ox)/ax, ny=(y-fy-oy)/ay; return nx*nx+ny*ny<=1; };
    // lighting: brightest when the face swings toward the light (front-left)
    const lit=light?Math.max(0,Math.cos(a-(heads?-.55:Math.PI-.55))):.6;
    const mul=light?(.72+.42*lit):1;
    const col=(hexs,m)=>hex(hexs).map(v=>Math.max(0,Math.min(255,Math.round(v*m))));
    const deep=look==='deep';
    const H={ face:col(deep?'#eaa42c':'#f4c43e',mul), bevHi:col(deep?'#ffd36a':'#ffe88a',mul), bevLo:col(deep?'#a45e0a':'#b87a10',mul), line:col(deep?'#b0660c':'#c68a16',mul), hi:col('#fff5c0',Math.min(1.15,mul)) };
    const T={ face:col('#c9962a',mul*.95), bevHi:col('#e0b24a',mul*.95), bevLo:col('#8a5a0c',mul*.95), mark:col('#8f6010',mul*.95) };
    const E1=col('#c98a1a',.95), E2=col('#e8ad32',1), ELo=hex('#7c4a06'), ink=hex('#2e1a04'), SPEC=hex('#fffbe8');
    const fill=new Array(d*h).fill(null);
    for (let y=0;y<h;y++) for (let x=0;x<d;x++){
      const X=x+.5, Y=y+.5;
      if (inFace(X,Y,0,0)){
        const nx=(X-fx)/ax, ny=(Y-fy)/ay, r=Math.hypot(nx,ny);
        let p;
        if (heads){
          if (r>.76) p=ny<-.1?H.bevHi:(ny>.25?H.bevLo:(nx<0?H.bevHi:H.bevLo));
          else if (ring && Math.abs(r-.6)<.9/Math.max(3,Math.min(ax,ay*1.4))) p=ny<0?H.bevLo:H.bevHi;
          else if (Math.abs(nx*ax)<.8 && Math.abs(ny)<(ring?.36:.5)) p=H.line;
          else if (nx>-.6 && nx<-.34 && Math.abs(ny)<.42 && ax>R*.45) p=H.hi;
          else p=H.face;
          // the specular streak at the peak of the swing
          if (light && lit>.9 && r<.8 && Math.abs(nx*.8-ny+.1)<.22) p=SPEC;
        } else {
          if (r>.76) p=ny<-.1?T.bevHi:T.bevLo;
          else if (Math.abs(r-.46)<.9/Math.max(3,Math.min(ax,ay*1.4)) || r<.14) p=T.mark;
          else p=T.face;
        }
        fill[y*d+x]=p; continue;
      }
      // the edge: the face swept back along the band vector
      for (let i=1;i<=8;i++){
        const t=i/8;
        if (inFace(X,Y,bx*t,by*t)){
          const alongX=axis==='side'?Y:X;
          fill[y*d+x]=(axis==='side'? (Math.floor(alongX)%2?E1:E2) : (Math.floor(alongX)%2?E1:E2));
          if (t>.8) fill[y*d+x]=ELo;
          break;
        }
      }
    }
    const inkAt=[];
    for (let y=0;y<h;y++) for (let x=0;x<d;x++){
      if (fill[y*d+x]) continue;
      if ([[1,0],[-1,0],[0,1],[0,-1]].some(([ox,oy])=>{ const X2=x+ox,Y2=y+oy; return X2>=0&&Y2>=0&&X2<d&&Y2<h&&fill[Y2*d+X2]; })) inkAt.push(y*d+x);
    }
    inkAt.forEach(i=>{ fill[i]=ink; });
    for (let i=0;i<d*h;i++){ const p=fill[i]; if (!p) continue; px[i*4]=p[0]; px[i*4+1]=p[1]; px[i*4+2]=p[2]; px[i*4+3]=255; }
    ctx.putImageData(img,0,0);
    return spinCache[key]='url('+cv.toDataURL()+')';
  }
  const SPIN_RATE={ slow:2.2, med:3.6, fast:5.5 };             // turns per second
  const spinOn=b=>OPT.spin!=='off' && OPT.art==='gold' && !b.edge && !isBar(b.colour);
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
    // v11 payout sounds, in the set's own voice
    const voice=()=>OPT.sfx==='retro'?'square':(OPT.sfx==='clink'||OPT.sfx==='coin'?'sine':'triangle');
    // the pot pushed across the felt: a short felt scrape under a rattle
    function scrape(w){
      noise(.22,V(.1*w),'bandpass',900,.7); noise(.18,V(.06*w),'bandpass',2400,1.2,.03);
      const set=SETS[OPT.sfx]; if (set) [0,.05,.11,.16].forEach(d=>setTimeout(()=>set.bounce(.9+Math.random()*.2,.5*w),d*1000));
    }
    // the hatch: a low mechanical clunk (open a touch higher than close)
    function clunk(open){ tone(open?120:95,open?70:55,.1,'sine',.32); noise(.04,.16,'lowpass',900,.8); if (open) noise(.02,.08,'bandpass',2600,2,.05); }
    // a win: a rising run in the set's voice; yours is bigger and ends on a chord
    function win(big){
      const wave=voice(), v=(wave==='square'?.045:.08)*(big?1:.6);
      const run=big?[784,988,1175,1568,1976]:[988,1175,1480];
      run.forEach((f,i)=>tone(f,f,.07,wave,v,i*.055));
      const end=run.length*.055;
      if (big){ [1568,1976,2349].forEach(f=>tone(f,f,.32,wave,v*.7,end)); const set=SETS[OPT.sfx]; if (set) setTimeout(()=>set.chunk(1.1,.8),end*1000); }
    }
    return { set:()=>SETS[OPT.sfx], unlock:()=>{ ac(); }, sting, scrape, clunk, win };
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
    if (OPT.sfx!=='old'){
      if (kind==='collect'){ Coin.scrape(power||.6); return; }
      if (kind==='hatch' || kind==='hatchClose'){ Coin.clunk(kind==='hatch'); return; }
      if (kind==='win'){ Coin.win(power>=1); return; }
    } else if (kind==='win'){ if (power>=1) Sound.counterLock(true); return; }
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
  // bumped by clearWorld: delayed work (a topple) started before it is dropped
  let worldGen=0;
  // caller hooks: mouth(b) takes a coin arriving at a { mouth:true } target
  const hooks={ mouth:null };
  let stuckCount=0; const stuckLog=[];
  let WALLS=null;               // { felt:{L,T,R,B,rc}, blocks:[{L,T,R,B}] }
  let TRAY=null;                // the pot tray's inside edge, for its lip

  // HOST: by default the layers are fixed to the page (the lab). The game
  // hosts them inside its table screen instead, so coins ride along when
  // the screen slides or rolls, and sit under the game's overlays: the
  // layers are then absolute, offset so their origin is still the
  // viewport's (every coordinate here is a client coordinate).
  let host=null, hostZ=null;
  function setHost(el,z){
    host=el||null; hostZ=z||null;
    if (air){ (host||document.body).append(shadows,air); alignLayers(); }
  }
  function alignLayers(){
    if (!air) return;
    [shadows,air].forEach((l,i)=>{
      if (host && host!==document.body){
        const r=host.getBoundingClientRect();
        Object.assign(l.style,{ position:'absolute', inset:'auto', left:(-r.left-host.clientLeft)+'px', top:(-r.top-host.clientTop)+'px', width:innerWidth+'px', height:innerHeight+'px' });
      } else Object.assign(l.style,{ position:'', inset:'', left:'', top:'', width:'', height:'' });
      l.style.zIndex=hostZ?String(hostZ[i]):'';
    });
  }
  function ensureLayers(){
    if (air) return;
    shadows=document.createElement('div'); shadows.className='ct-shadows';
    air=document.createElement('div'); air.className='ct-air';
    (host||document.body).append(shadows,air);
    alignLayers();
  }
  function kick(){ if (!raf){ lastT=performance.now(); raf=requestAnimationFrame(loop); } }
  function loop(now){
    let dt=Math.min(.035,(now-lastT)/1000)*OPT.speed; lastT=now;
    if (freeze>0){ freeze-=dt; dt=0; }
    const reduced=motionOff();
    for (const b of Array.from(active)){
      if (reduced){ snap(b); continue; }
      if (b.state==='wait'){ b.moving=0; b.wait-=dt*1000; if (b.wait>0) continue; begin(b); }
      // watchdog: a coin still moving after ~3.5s (trapped between walls,
      // jittering) is put down where it is (or where it was going)
      b.moving=(b.moving||0)+dt;
      if (b.moving>3.5){ b.moving=0; stuckLog.push({ state:b.state, col:b.colour, d:Math.round(b.d), zone:b.zone&&b.zone.id, x:Math.round(b.x), y:Math.round(b.y), z:Math.round(b.z), vx:Math.round(b.vx), vy:Math.round(b.vy), vz:Math.round(b.vz), t:b.target&&Object.keys(b.target).join('/') }); snap(b); stuckCount++; continue; }
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
    d=d*scaleOf(chip.colour);
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
    b.state='rest'; b.t=0; b.vx=b.vy=b.vz=0; b.moving=0;
    // every coin that comes to rest is checked against its neighbours (a
    // pushed group is relaxed as whole stacks by relaxStacks instead)
    void was;
    if (b.snapOnto){ b.snapOnto.claimed=null; b.snapOnto=null; }
    b.seatCell=null;
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
    const row=boardRow(); if (row) blocks.push({ ...row });
    add($('dealer-deck'));
    add(document.querySelector('#pot-area .pot-chip'));
    document.querySelectorAll('#felt .seat-card').forEach(add);
    // solid things the caller knows about that may not be showing yet (the
    // game's pot plate hides while the pot is empty)
    extraBlocks.forEach(k=>blocks.push({ ...k }));
    document.querySelectorAll('#hud-mid .seat-cards .card').forEach(add);
    WALLS={ felt:{ L:f.left+inset, T:f.top+inset, R:f.right-inset, B:f.bottom-inset, rc:40 }, blocks };
    fitTray();
  }
  // The board's five card places, dealt or not, are one solid block, so no
  // coin can sit in a gap between cards or where the turn and river will
  // land. Measured from layout offsets (a card mid-deal is transformed),
  // and remembered for streets with no cards out.
  let ROW=null;
  let extraBlocks=[];
  function boardRow(){
    const bd=$('board'), cards=bd?bd.querySelectorAll('.card'):[];
    if (cards.length){
      const br=bd.getBoundingClientRect(), c0=cards[0], cl=cards[cards.length-1];
      const cs=getComputedStyle(bd), gap=parseFloat(cs.columnGap)||parseFloat(cs.gap)||7;
      const w=c0.offsetWidth, full=5*w+4*gap, cx=br.left+(c0.offsetLeft+cl.offsetLeft+cl.offsetWidth)/2;
      ROW={ L:cx-full/2, R:cx+full/2, T:br.top+c0.offsetTop, B:br.top+c0.offsetTop+c0.offsetHeight };
    }
    return ROW;
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
  // Shrink the lip's walls clear of every solid block (the plate, the deck,
  // cards): a coin can never be pushed out of a block by one rule and back
  // into it by the other (that was the stuck, stuttering coin).
  function fitTray(){
    if (!TRAY || !WALLS) return;
    const r=D()/2, d=D(), cx=(TRAY.L+TRAY.R)/2, cy=(TRAY.T+TRAY.B)/2;
    WALLS.blocks.forEach(k=>{
      const L=k.L-r-1, R=k.R+r+1, T=k.T-2, B=k.B+d*.85+1;
      if (R<=TRAY.L || L>=TRAY.R || B<=TRAY.T || T>=TRAY.B) return;
      const cut={ left:R-TRAY.L, right:TRAY.R-L, top:B-TRAY.T, bottom:TRAY.B-T };
      const side=Object.keys(cut).filter(k2=>(k2==='left'&&k.R<cx)||(k2==='right'&&k.L>cx)||(k2==='top'&&k.B<cy)||(k2==='bottom'&&k.T>cy)).sort((a,c)=>cut[a]-cut[c])[0]||'bottom';
      if (side==='left') TRAY.L=R; else if (side==='right') TRAY.R=L; else if (side==='top') TRAY.T=B; else TRAY.B=T;
    });
  }
  // where a coin of size d may rest in the tray: its sides clear of the
  // walls, and its face clear of the back wall (a coin is drawn up from its
  // ground point, so the back wall needs the depth of its face)
  function trayBox(d,col){
    if (!TRAY) return null;
    const k={ L:TRAY.L+d/2, R:TRAY.R-d/2, T:TRAY.T+Math.round(depthOf(col||'gold',d)/FORE)-2, B:TRAY.B };
    // TRAY is cut clear of the blocks for a small coin; a bigger piece
    // reaches further, so its box is cut again at its own size (else the
    // plate bounces it out and the tray pulls it back in, for ever)
    if (d>D()+.5 && WALLS){
      const cx=(TRAY.L+TRAY.R)/2, cy=(TRAY.T+TRAY.B)/2;
      WALLS.blocks.forEach(b=>{
        const L=b.L-d/2-1, R=b.R+d/2+1, T=b.T-2, B=b.B+d*.85+1;
        if (R<=k.L || L>=k.R || B<=k.T || T>=k.B) return;
        const cut={ left:R-k.L, right:k.R-L, top:B-k.T, bottom:k.B-T };
        const side=Object.keys(cut).filter(s=>(s==='left'&&b.R<cx)||(s==='right'&&b.L>cx)||(s==='top'&&b.B<cy)||(s==='bottom'&&b.T>cy)).sort((a,c)=>cut[a]-cut[c])[0]||'bottom';
        if (side==='left') k.L=R; else if (side==='right') k.R=L; else if (side==='top') k.T=B; else k.B=T;
      });
    }
    return k;
  }
  // contain(), and a pot coin also stays inside the tray: every place a
  // coin is put to rest (a push apart, a settle, a nudge) goes through here
  function holdIn(b,z){
    contain(b);
    z=z||b.zone;
    const k=z && z.id==='pot' && OPT.lip==='on' ? trayBox(b.d,b.colour) : null;
    if (!k || k.R<=k.L || k.B<=k.T) return;
    b.x=Math.max(k.L,Math.min(k.R,b.x)); b.y=Math.max(k.T,Math.min(k.B,b.y));
  }
  function lip(b){
    if (!TRAY || OPT.lip!=='on' || !b.zone || b.zone.id!=='pot' || b.z>4) return;
    const k=trayBox(b.d,b.colour), L=k.L, Rr=k.R, T=k.T, B=k.B;
    if (Rr<=L || B<=T) return;
    let nx=0, ny=0;
    if (b.x<L){ b.x=L; nx=-1; } else if (b.x>Rr){ b.x=Rr; nx=1; }
    if (b.y<T){ b.y=T; ny=-1; } else if (b.y>B){ b.y=B; ny=1; }
    const out=nx||ny;
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
  // Two coins at rest touch edge to edge: their centres a coin apart on the
  // felt (foreshortened: a pixel up the screen is 1.4 across). A row set
  // half a coin across behind another sits just far enough back that the
  // faces meet instead of sinking into each other.
  const ROW_DY=sp=>Math.ceil(Math.sqrt(Math.max(0,D()*D()-sp*sp/4))/FORE);
  const mixed=list=>list.some(b=>b.colour!=='gold');
  function neatSlots(z,list){
    if (z.id==='pot') return mixed(list)?bandSlots(z,list):potSlots(z,list);
    if (mixed(list)) return spotSlots(z,list);
    const d=D(), towers=OPT.tidy==='towers', sp=d+(towers?2:1), st=STEP(), slots=[], order=[0], dy=ROW_DY(sp);
    for (let i=1;i<9;i++) order.push(i%2?Math.ceil(i/2):-i/2);
    order.forEach((o,i)=>{ slots.push({ x:z.cx+o*sp, y:z.cy }); if (i<8 && !towers) slots.push({ x:z.cx+(o+(o<0?-.5:.5))*sp, y:z.cy-dy }); });
    // never taller than the room above the pile (the pot sits under the board)
    const room=z.room?Math.max(2,Math.floor((z.room-(towers?0:dy)-d*HR()-2)/st)+1):99;
    const pool=towers?slots.length:z.maxSlots;
    // SPREAD: coins shared evenly over every stack; TOWERS: one row of tall
    // stacks (up to 8 high), as few as the coins need
    let cap=towers?Math.min(8,room):Math.min(z.cap,room,Math.max(1,Math.ceil(list.length/Math.min(pool,slots.length))));
    const max=towers?Math.max(1,Math.min(pool,Math.ceil(list.length/cap))):pool;
    const use=slots.slice(0,max), stacks=[], out=new Map();
    list.forEach(b=>{
      let s=null;
      for (let i=stacks.length-1;i>=0;i--) if (stacks[i].key===b.colour && stacks[i].n<cap){ s=stacks[i]; break; }
      if (!s){ if (stacks.length<use.length){ s={ key:b.colour, slot:use[stacks.length], n:0, k:stacks.length }; stacks.push(s); } else s=stacks.reduce((a,c)=>c.n<a.n?c:a); }
      out.set(b,{ x:s.slot.x, y:s.slot.y, z:s.n*st, n:s.n, k:s.k });
      s.n++;
    });
    return out;
  }

  /* A BET SPOT WITH MIXED PIECES: one row of towers, one kind per tower,
     the biggest pieces in the middle and small coins out to the sides, each
     tower no taller than the room above the spot allows. */
  function spotSlots(z,list){
    const stacks=[];
    KINDS.slice().reverse().forEach(col=>{
      const mine=list.filter(b=>b.colour===col); if (!mine.length) return;
      const st=stepOf(col), room=z.room?Math.max(1,Math.floor((z.room-pieceH(col)-2)/st)+1):99;
      const cap=Math.max(1,Math.min(z.cap,room)), k=Math.ceil(mine.length/cap);
      for (let i=0;i<k;i++) stacks.push({ col, d:pieceD(col), st, list:[] });
      const own=stacks.filter(s=>s.col===col);
      mine.forEach((b,i)=>own[i%own.length].list.push(b));
    });
    // place: first in the middle, then alternately right and left
    let right=null, left=null;
    stacks.forEach((s,i)=>{
      if (!i){ s.x=z.cx; right=left=s; return; }
      if (i%2){ s.x=right.x+(right.d+s.d)/2+1; right=s; }
      else { s.x=left.x-(left.d+s.d)/2-1; left=s; }
    });
    const mid=(right.x+right.d/2+left.x-left.d/2)/2, out=new Map();
    stacks.forEach((s,si)=>s.list.forEach((b,h)=>out.set(b,{ x:Math.round(s.x-(mid-z.cx)), y:z.cy, z:h*s.st, n:h, k:si })));
    return out;
  }

  /* THE POT WITH MIXED PIECES, in bands front to back: small coins, big
     coins, bars. Each band builds in the hand's shape (rows, pyramid, heap)
     with its own piece size, step and row depth; bands a piece's depth
     apart, so no footprint sits in another. The pile is low and wide, and
     climbs toward the back: small coins at most ~3 high, big coins ~4,
     bars ~6, so each band shows over the one in front (a bar tower at the
     back reads above the big coins). A band spreads across the tray before
     it takes a second row; when the tray is too shallow for every band's
     rows, the deepest band gives up a row and its stacks grow instead. */
  const BAND_H={ gold:3, 'gold-big':4, 'gold-bar':6 };
  function bandSlots(z,list){
    const shape=potShape||newPotShape(), heap=shape==='heap';
    const bands=KINDS.map(col=>{
      const d=pieceD(col), n=list.filter(b=>b.colour===col).length, sp=d+(heap?2:1);
      const box=trayBox(d,col)||{ L:z.cx-80, R:z.cx+80, T:z.cy-30, B:z.cy+4 };
      const dy=isBar(col)?Math.ceil((depthOf(col,d)+1)/FORE):Math.ceil(Math.sqrt(Math.max(0,d*d-sp*sp/4))/FORE);
      const maxCols=Math.max(1,Math.floor((box.R-box.L)/sp)+1), tall=BAND_H[col]+(heap?1:0);
      return { col, d, n, sp, dy, box, st:stepOf(col), dep:depthOf(col,d), tall, maxCols,
        rows:Math.max(1,Math.min(3,Math.ceil(n/(maxCols*tall)))) };
    }).filter(k=>k.n>0);
    // bars at the back stand taller than whatever is in front of them, so a
    // few bars make a column over the pile instead of hiding behind it
    const front=bands.filter(k=>!isBar(k.col));
    bands.forEach(k=>{ if (isBar(k.col) && front.length) k.tall=Math.max(k.tall,Math.max(...front.map(f=>f.tall))+(shape==='pyramid'?1:0)+3); });
    const gap=(a,c)=>Math.ceil(((a.dep+c.dep)/2+1)/FORE);
    const lay=yFront=>{
      let y=yFront;
      bands.forEach((k,i)=>{ if (i) y-=gap(bands[i-1],k); k.y0=y; y-=(k.rows-1)*k.dy; k.y1=y; });
      return Math.min(...bands.map(k=>k.y1-k.box.T));            // slack at the back
    };
    const yMax=Math.min(...bands.map(k=>k.box.B));
    let slack=lay(yMax);
    while (slack<0 && bands.some(k=>k.rows>1)){ bands.reduce((a,c)=>c.rows>a.rows?c:a).rows--; slack=lay(yMax); }
    // centre the pile front to back in the room left
    lay(yMax-Math.max(0,Math.floor(slack/2)));
    const capAt=(k,y)=>{ const room=z.room!=null?z.room+(y-z.cy):99; return Math.max(1,Math.min(12,Math.floor((room-pieceH(k.col)-2)/k.st)+1)); };
    const clampI=(v,a,b)=>Math.max(a,Math.min(b,v));
    const slots=[];
    bands.forEach((k,bi)=>{
      const r=k.rows, cx=(k.box.L+k.box.R)/2;
      // a stack's height: the band's own, never more than the room allows
      const capOf=y=>Math.min(capAt(k,y),k.tall+(shape==='pyramid'?1:0));
      let c0=clampI(Math.ceil(k.n/(r*Math.max(1,k.tall-1)))+(heap?1:0),r,k.maxCols);
      // wide enough for its pieces at that height
      const fits=c=>{ let t=0; for (let i=0;i<r;i++) t+=Math.max(1,c-i)*capOf(k.y0-i*k.dy); return t>=k.n; };
      while (!fits(c0) && c0<k.maxCols) c0++;
      // still too many: let the stacks grow to what the room allows
      const grow=!fits(c0);
      const weight=shape==='rows'?()=>1:(heap?(row,off)=>rr(.25,1.6)*(1-.35*off):(row,off)=>Math.pow((1+row*.9)*(1-.6*off),2.2));
      for (let row=0;row<r;row++){
        const c=Math.max(1,c0-(shape==='rows'?(row?1:0):row)), half=Math.max(1,(c0-1)/2);
        for (let i=0;i<c;i++){
          const o=i-(c-1)/2, y=k.y0-row*k.dy;
          slots.push({ col:k.col, d:k.d, st:k.st, band:bi, x:cx+o*k.sp, y, row, cap:grow?capAt(k,y):capOf(y), w:Math.max(.05,weight(row,Math.min(1,Math.abs(o)/half))), n:0 });
        }
      }
    });
    // the heap: stacks a pixel or two off the grid, where that clashes with nothing
    const free=(s,x,y)=>slots.every(q=>q===s || !clash(x,y,s.col,s.d,{ colour:q.col, d:q.d },q.x,q.y));
    if (heap) slots.forEach(s=>{
      const x=s.x+rint(-2,2), y=s.y+rint(-1,1), k=bands[s.band].box;
      if (x>=k.L && x<=k.R && y>=k.T && y<=k.B && free(s,x,y)){ s.x=x; s.y=y; }
    });
    const out=new Map();
    bands.forEach((k,bi)=>{
      const mine=slots.filter(s=>s.band===bi), cx=(k.box.L+k.box.R)/2;
      mine.sort((a,c)=>Math.abs(a.x-cx)-Math.abs(c.x-cx) || a.row-c.row);
      // bars fill the middle tower first, then the next out
      const fill=isBar(k.col);
      for (let i=0;i<k.n;i++){
        let best=null, bv=1e9;
        if (fill) best=mine.find(s=>s.n<s.cap)||null;
        else mine.forEach(s=>{ if (s.n>=s.cap) return; const v=(s.n+1)/s.w; if (v<bv){ bv=v; best=s; } });
        if (!best) best=mine.reduce((a,c)=>c.n<a.n?c:a);
        best.n++;
      }
      const pieces=list.filter(b=>b.colour===k.col); let i=0;
      mine.forEach(s=>{
        // a heap's stacks lean, only as far as the gap to their neighbours
        // lets the upper pieces go (half each way, so two can't meet)
        const room=slots.reduce((m,q)=>{
          if (q===s) return m;
          const dx=Math.abs(q.x-s.x), dyF=Math.abs(q.y-s.y)*FORE;
          const g=isBar(s.col)||isBar(q.col)?Math.max(dx-(s.d+q.d)/2,dyF-(depthOf(s.col,s.d)+depthOf(q.col,q.d))/2):Math.hypot(dx,dyF)-(s.d+q.d)/2;
          return Math.min(m,g);
        },99);
        const lim=Math.max(0,Math.min(3,Math.floor(room/2))), lean=heap&&!isBar(k.col)?(rnd()<.5?-1:1)*rr(0,.7):0;
        for (let h=0;h<s.n;h++){
          const b=pieces[i++]; if (!b) return;
          out.set(b,{ x:s.x+Math.round(clampI(h*lean,-lim,lim)), y:s.y, z:h*s.st, n:h, k:slots.indexOf(s) });
        }
      });
    });
    return out;
  }

  /* THE POT'S SHAPE. Each hand (and each tap on the empty felt) picks how
     the pile builds when it tidies: NEAT rows of even stacks, a PYRAMID
     (tallest at the back and in the middle, stepping down to the edges and
     the front, like a real pot) or a HEAP (uneven, leaning stacks and a
     coin or two lying loose). TOWERS went (owner: too tall). Every shape keeps
     its coins inside the tray, a coin apart, and under the board. */
  const POT_SHAPES=['pyramid','heap','rows'];
  let potShape=null;
  function newPotShape(avoid){
    if (OPT.potShape && OPT.potShape!=='mix') return (potShape=OPT.potShape);
    const w=OPT.potMix||{ rows:1 }, pool=POT_SHAPES.filter(k=>(w[k]||0)>0 && (k!==avoid || POT_SHAPES.filter(j=>(w[j]||0)>0).length<2));
    const total=pool.reduce((a,k)=>a+w[k],0);
    let r=rnd()*total; potShape=pool[pool.length-1]||'rows';
    for (const k of pool){ r-=w[k]; if (r<0){ potShape=k; break; } }
    return potShape;
  }
  function potSlots(z,list){
    const d=D(), st=STEP(), n=list.length, shape=potShape||newPotShape();
    const heap=shape==='heap', sp=d+(heap?2:1), dy=ROW_DY(sp);
    const k=trayBox(d)||{ L:z.cx-80, R:z.cx+80, T:z.cy-30, B:z.cy+4 };
    const maxCols=Math.max(1,Math.floor((k.R-k.L)/sp)+1), maxRows=Math.max(1,Math.floor((k.B-k.T)/dy)+1);
    // how many coins a stack standing at y may hold: the board is above it
    const capAt=y=>{ const room=z.room!=null?z.room+(y-z.cy):99; return Math.max(1,Math.min(12,Math.floor((room-d*HR()-2)/st)+1)); };
    const clampI=(v,a,b)=>Math.max(a,Math.min(b,v));
    // the rows, front first: how many stacks each, and each stack's weight
    // (its share of the coins) from where it stands
    let cols, weight;
    if (shape==='rows'){
      const c=clampI(Math.round(Math.sqrt(n*1.5)),1,Math.min(9,maxCols));
      cols=n>1&&maxRows>1?[c,Math.max(1,c-1)]:[c];
      weight=()=>1;
    } else {
      const r=clampI(n<4?1:n<10?2:n<22?3:4,1,maxRows);
      const c0=clampI(Math.ceil(Math.sqrt(n)*(heap?1.15:.95))+(heap?1:0),r,maxCols);
      cols=[]; for (let i=0;i<r;i++) cols.push(Math.max(1,c0-i));
      weight=heap?(row,off)=>rr(.25,1.6)*(1-.35*off):(row,off)=>Math.pow((1+row*.9)*(1-.6*off),2.2);
    }
    const rows=cols.length, cx=(k.L+k.R)/2;
    const yFront=clampI(Math.round((k.T+k.B)/2+(rows-1)*dy/2+2),k.T+(rows-1)*dy,k.B);
    const slots=[];
    cols.forEach((c,row)=>{
      for (let i=0;i<c;i++){
        const o=i-(c-1)/2, half=Math.max(1,(cols[0]-1)/2);
        const x=cx+o*sp, y=yFront-row*dy;
        if (heap && row>0 && c>2 && Math.abs(o)>=1 && rnd()<.15) continue;     // a gap in the pile
        slots.push({ x, y, row, cap:capAt(y), w:Math.max(.05,weight(row,Math.min(1,Math.abs(o)/half))), n:0 });
      }
    });
    // the heap: stacks a pixel or two off the grid, where that doesn't push
    // them into a neighbour
    if (heap) slots.forEach(s=>{
      const x=s.x+rint(-2,2), y=s.y+rint(-1,1);
      if (x>=k.L && x<=k.R && y>=k.T && y<=k.B && slots.every(q=>q===s || Math.hypot(q.x-x,(q.y-y)*FORE)>=d)){ s.x=x; s.y=y; }
    });
    if (heap && n>6){
      // a coin or two lying loose on the tray floor, off the pile's sides
      [-1,1].forEach(side=>{
        if (rnd()<.35) return;
        const x=cx+side*((cols[0]+1)/2+rr(.2,.7))*sp, y=clampI(yFront-rint(0,Math.min(1,rows-1))*dy+rint(-1,1),k.T,k.B);
        if (x<k.L || x>k.R) return;
        if (slots.every(s=>Math.hypot(s.x-x,(s.y-y)*FORE)>=d)) slots.push({ x, y, row:0, cap:1, w:3, n:0 });
      });
    }
    // centre first, so an uneven share goes to the middle
    slots.sort((a,c)=>Math.abs(a.x-cx)-Math.abs(c.x-cx) || a.row-c.row);
    // share the coins out in proportion to each stack's weight
    for (let i=0;i<n;i++){
      let best=null, bv=1e9;
      slots.forEach(s=>{ if (s.n>=s.cap) return; const v=(s.n+1)/s.w; if (v<bv){ bv=v; best=s; } });
      if (!best) best=slots.reduce((a,c)=>c.n<a.n?c:a);
      best.n++;
    }
    // hand the coins out, bottom up; a heap's stacks lean a little
    const out=new Map(); let i=0;
    slots.forEach((s,si)=>{
      const lean=heap?(rnd()<.5?-1:1)*rr(0,.7):0;
      for (let h=0;h<s.n;h++){
        const b=list[i++]; if (!b) return;
        const ox=heap?Math.round(clampI(h*lean,-3,3)):0;
        out.set(b,{ x:s.x+ox, y:s.y, z:h*st, n:h, k:si });
      }
    });
    return out;
  }
  // free: coins may sit a quarter inside each other; snug: they only touch;
  // snap: a coin landing near another is pulled onto it (stacks build)
  const MIN_GAP=()=>OPT.overlap==='free'?.74:1;
  const SUPPORT=()=>OPT.overlap==='snap'?.8:(OPT.overlap==='snug'?.5:.55);
  function supportUnder(b){
    if (!b.zone) return { h:0, o:null };
    let h=0, o=null;
    for (const q of b.zone.list){
      if (q===b || q.state!=='rest') continue;
      if (Math.hypot(q.x-b.x,(q.y-b.y)*FORE)<Math.min(b.d,q.d)*SUPPORT() && q.z+stepOf(q)>h){ h=q.z+stepOf(q); o=q; }
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
    if (z.id==='pot' && OPT.potEvery==='tidy') newPotShape(potShape);
    const slots=neatSlots(z,z.list), groups=[...new Set(z.list.map(b=>b.colour))], done=[];
    const colourless=groups.length===1;
    z.list.forEach((b,i)=>{
      const s=slots.get(b), gi=colourless?Math.floor(s.n/3):groups.indexOf(b.colour);
      b.tidyTop=![...slots.values()].some(o=>o!==s && o.k===s.k && o.n>s.n);
      if (Math.hypot(s.x-b.x,s.y-b.y)<.6 && Math.abs(s.z-b.z)<.6) return;
      done.push(new Promise(res=>{
        const dist=Math.hypot(s.x-b.x,s.y-b.y);
        b.tx=s.x; b.ty=s.y; b.tz=s.z; b.resolve=res;
        b.T=.14+Math.min(.14,dist/900); b.arc=5+Math.min(14,dist*.12);
        b.wait=colourless?(s.n*55+(i%3)*12):(gi*95+s.n*22); b.state='wait'; b.next='tidy'; active.add(b); kick();
      }));
    });
    const beats=colourless?Math.max(...z.list.map(b=>slots.get(b).n))+1:groups.length;
    void beats;                                                         // tidying is silent (owner: the noise was annoying)
    z.tidying=Promise.all(done).then(()=>{ z.tidying=null; if (done.length) glintPile(z); });
    return z.tidying;
  }

  /* ---------------- the change-up ----------------
     When a pile holds more pieces than `limit`, five small coins become a
     big one (five big, a bar) until it fits: the pile keeps its size and
     gets richer. The first few (OPT.mergeShow: SOME 3, ALL, NONE) play out:
     five pieces hop up off the pile to one point above it, clink together,
     pop into the bigger piece, and it drops back onto the pile. The rest
     change at once. Then the pile tidies (bigger pieces to the back). */
  const count=(z,col)=>z.list.filter(b=>b.colour===col).length;
  function mergePlan(z,limit){
    const out=[]; let g=count(z,'gold'), bg=count(z,'gold-big'), n=z.list.length;
    while (n>limit){
      const k=upFrom(g,bg); if (!k) break;
      if (k==='gold'){ g-=5; bg++; out.push(['gold','gold-big']); }
      else { bg-=5; out.push(['gold-big','gold-bar']); }
      n-=4;
    }
    return out;
  }
  // five of `from` off the pile: tops of towers first, near each other
  function pickFive(z,from){
    const pool=z.list.filter(b=>b.colour===from && b.state==='rest');
    const tops=pool.filter(b=>!pool.some(q=>q!==b && q.z>b.z+.5 && Math.abs(q.x-b.x)<b.d*.45 && Math.abs(q.y-b.y)<b.d*.4));
    const seed=tops.sort((a,c)=>c.z-a.z)[0]||pool[0]; if (!seed) return [];
    const took=[];
    while (took.length<5){
      const left=z.list.filter(b=>b.colour===from && b.state==='rest' && !took.includes(b));
      if (!left.length) break;
      // the top of whichever tower is nearest the first pick
      const free=left.filter(b=>!left.some(q=>q!==b && q.z>b.z+.5 && Math.abs(q.x-b.x)<b.d*.45 && Math.abs(q.y-b.y)<b.d*.4));
      const next=(free.length?free:left).sort((a,c)=>Math.hypot(a.x-seed.x,a.y-seed.y)-Math.hypot(c.x-seed.x,c.y-seed.y) || c.z-a.z)[0];
      took.push(next); removeFromZone(next);
    }
    return took;
  }
  const hold=ms=>new Promise(r=>setTimeout(r,motionOff()?0:ms/OPT.speed));
  function moveBody(b,x,y,z,T,arc,wait){
    return new Promise(res=>{
      b.tx=x; b.ty=y; b.tz=z; b.T=T; b.arc=arc; b.wait=wait||0; b.resolve=res;
      b.state='wait'; b.next='tidy'; b.target={}; b.opts={}; b.snapping=false; active.add(b); kick();
    });
  }
  async function mergeOne(z,from,to,show){
    const five=pickFive(z,from); if (five.length<5){ five.forEach(b=>{ b.zone=z; z.list.push(b); }); return false; }
    const k=trayBox(pieceD(to),to);
    let px=five.reduce((a,b)=>a+b.x,0)/5, py=five.reduce((a,b)=>a+b.y,0)/5;
    if (k){ px=Math.max(k.L,Math.min(k.R,px)); py=Math.max(k.T,Math.min(k.B,py)); }
    const pz=Math.max(...five.map(b=>b.z))+30;
    if (show && !motionOff()){
      // up off the pile, fanned out a little, then snapped together
      await Promise.all(five.map((b,i)=>moveBody(b,px+(i-2)*4,py,pz+(i%2)*3,.2,14,i*45)));
      sfx('stack',.7,1.25);
      await hold(70);
      await Promise.all(five.map(b=>moveBody(b,px,py,pz,.07,0,0)));
      sfx('stack',1,1.6); sfx('knock',.6,1.2);
    }
    five.forEach(b=>{ removeBody(b); b.el.remove(); });
    const c=makeChip(to), nb=body(c,px,py,show?pz:0,D());
    nb.state='rest';
    if (show && !motionOff()){
      nb.sq=.1; squashing.add(nb); dirty.add(nb); kick();
      popRing(px,py-pz-pieceH(to)/2,pieceD(to)); glintAt(px+pieceD(to)*.2,py-pz-pieceH(to)*.9);
      sfx('land',1,pitchOf(nb)*.9); if (isBar(to)) sfx('thump',.8);
      await hold(90);
      // it drops back onto the pile
      await launch(nb,{ x:px, y:py, z:0, zone:z, d:D() },{ T:.26, flips:0 });
    } else { nb.zone=z; z.list.push(nb); dirty.add(nb); kick(); }
    return true;
  }
  async function merge(z,limit,opts){
    opts=opts||{};
    if (!z || z.merging) return z&&z.merging;
    const steps=mergePlan(z,limit); if (!steps.length) return;
    const show=opts.show!=null?opts.show:({ all:99, some:3, none:0 }[OPT.mergeShow]??3);
    z.merging=(async()=>{
      for (let i=0;i<steps.length;i++) await mergeOne(z,steps[i][0],steps[i][1],i<show);
      z.neat=false; await tidyZone(z);
    })().finally(()=>{ z.merging=null; });
    return z.merging;
  }
  // a pixel ring bursting out from a change-up
  function popRing(x,y,d){
    if (OPT.juice!=='on' || motionOff() || !air) return;
    const p=document.createElement('i'); p.className='ct-pop';
    p.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px)'; p.style.setProperty('--d',Math.round(d*1.6)+'px');
    air.appendChild(p); setTimeout(()=>p.remove(),320/OPT.speed);
  }

  /* ---------------- launch ---------------- */
  // Target t = { x, y, z, d, zone?, slot?, vanish?, mouth? }
  function launch(b,t,o){
    o=o||{};
    b.target=t; b.opts=o; b.bounces=0; b.knocked=false; b.inFelt=false; b.blockHits=0;
    b.maxB=OPT.bounces==='multi' ? rint(1,3) : (OPT.bounces==='dead' ? 0 : 1);
    b.e=rr(.18,.32);
    // heavier pieces: a big coin bounces lower, a bar lands dead
    if (isBig(b.colour)){ b.maxB=Math.min(b.maxB,1); b.e=rr(.14,.22); }
    if (isBar(b.colour)){ b.maxB=0; b.e=.1; }
    b.d0=b.d; b.d1=(t.d||D())*scaleOf(b.colour);
    if (t.zone && b.zone!==t.zone){ if (b.zone) removeFromZone(b); b.zone=t.zone; t.zone.list.push(b); }
    b.wait=o.wait||0; b.state='wait'; b.next=o.mode||(eased()?'eased':'air');
    // only a brand-new coin (out of a seat) is hidden until it leaves; a
    // coin already in a pile stays where it is, visible, until its turn
    const hide=b.wait>0 && b.fresh;
    b.el.style.visibility=hide?'hidden':''; if (b.sh) b.sh.style.visibility=hide?'hidden':'';
    b.fresh=false;
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
    // (no aiming short across a card or the plate: it would land on it and
    // bounce between it and the tray for ever, e.g. your spot's coins
    // hopping up over the pot plate into the tray)
    const across=dist>1 && [.55,.7,.85].some(f=>inBlock(b.x+(t.x-b.x)*f,b.y+(t.y-b.y)*f,b.d1||b.d));
    const carry=t.vanish||t.mouth||t.slot||across?0:Math.min(dist*.45,hop+(vHop*.55*.7)**2/(2*FRICTION));
    let ax=t.x+(b.opts.jx||0), ay=t.y+(b.opts.jy||0);
    if (carry && dist>1){ ax-=(t.x-b.x)/dist*carry; ay-=(t.y-b.y)/dist*carry; }
    b.vx=(ax-b.x)/b.T; b.vy=(ay-b.y)/b.T;
    b.vz=((t.z||0)-b.z)/b.T+.5*G*b.T;
    let flips=b.opts.flips!=null?b.opts.flips:2;
    // a bar makes one slow end-over-end turn at most; a big coin fewer flips
    if (isBar(b.colour)) flips=Math.min(flips,2);
    else if (isBig(b.colour)) flips=Math.min(flips,2);
    // never faster than ~0.09s a half-turn, or the frames read as flicker
    flips=Math.max(flips%2?1:2,Math.min(flips,2*Math.floor(b.T/.18)));
    b.fr=flips*Math.PI/b.T; b.phi=0;
    b.vr=pixelArt()?0:(OPT.flips==='many'?rr(-300,300):0);
    b.glint=!!b.opts.toss; b.glinted=false;
    // the spin: axis per coin (MIXED picks one), a random start, either way
    b.axis=OPT.spin==='mixed'?(rnd()<.5?'side':'toss'):OPT.spin;
    b.spinA=rnd()*Math.PI*2; b.spinDir=rnd()<.5?-1:1;
    b.spinRate=(SPIN_RATE[OPT.spinSpeed]||3.6)*(b.opts.spinMul||1)*rr(.85,1.15)*(isBig(b.colour)?.7:1);
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
        if (b.spinRate) b.spinA+=b.spinDir*b.spinRate*2*Math.PI*dt;
        if (!b.bounces && b.T) b.d=b.d0+(b.d1-b.d0)*Math.min(1,b.t/b.T);
        b.tilt=b.edge?0:(spinOn(b)&&b.spinRate?1:Math.abs(Math.cos(b.phi))); b.back=!b.edge && !spinOn(b) && Math.cos(b.phi)<0;
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
        if (b.zone){ const off=Math.hypot(b.x-b.zone.cx,(b.y-b.zone.cy)*FORE)-b.zone.radius; if (off>0) grip+=off/22; }
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
            if (q===b || q.state!=='rest' || q.z>1 || Math.hypot(q.x-b.x,(q.y-b.y)*FORE)>b.d*.8) continue;
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
        if (k>=1){ b.tilt=1; b.rot=0; b.sq=.05; sfx('land'); if (!(b.target&&b.target.slot) && seat(b)) break; finishRest(b); }
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
          if (b.snapping){
            b.snapping=false;
            // the coin it hopped onto was taken away mid-hop: find another place
            if (b.zone && b.z>.5 && supportUnder(b).h<b.z-.5){ if (b.snapOnto){ b.snapOnto.claimed=null; b.snapOnto=null; } b.seatCell=null; settle(b); break; }
            sfx('stack',.8,rise(b)); if (b.zone) b.zone.neat=false;
          }
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
    holdIn(b);
    if (seat(b,true)) return;
    b.z=supportUnder(b).h; finishRest(b);
  }

  function arrive(b,isEased){
    const t=b.target;
    if (t.vanish){
      // MERGE: a coin past a pile's limit lands on it and melts in
      if (t.merge){ sfx('stack',.55,rise(b)); if (rnd()<.3) glintAt(b.x,b.y-b.z-b.d*.7); }
      else sfx('bounce',.35,rise(b));
      const r=b.resolve; b.resolve=null; removeBody(b); b.el.remove(); if (r) r(); return;
    }
    // a coin arriving at a mouth (the bank's hatch) is handed to the caller
    if (t.mouth){ if (hooks.mouth) hooks.mouth(b); else { const r=b.resolve; b.resolve=null; removeBody(b); b.el.remove(); if (r) r(); } return; }
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
      // wedged (a bigger piece squeezed between the plate and a resting
      // piece that pushes it back): after a few hits it takes the nearest
      // free place instead of bouncing for ever
      b.blockHits=(b.blockHits||0)+1;
      if (b.blockHits>3){ b.blockHits=0; b.vx=b.vy=b.vz=0; b.z=0; holdIn(b); settle(b); return; }
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
      if (b.spinRate) b.spinRate*=pop?1.1:.8;
      if (t.slot){ b.vx=(t.x-b.x)*.72/tHop; b.vy=(t.y-b.y)*.72/tHop; }
      else if (!pop){ b.vx*=.55; b.vy*=.55; }
      sfx(ground>0?'stack':'bounce',speed/900,rise(b,true)*pitchOf(b));
      // a coin landing on a tower sometimes rolls off it on its edge
      if (ground>0 && !t.slot && OPT.roll==='on' && !isBar(b.colour) && rnd()<.25){
        const L=Math.max(1,Math.hypot(b.vx,b.vy)); b.edge=true; b.fr=0;
        b.vx=b.vx/L*rr(60,110)||rr(-80,80); b.vy=b.vy/L*rr(20,50)||rr(-20,20); b.vz=rr(60,110);
      }
      return;
    }
    b.vz=0; b.fr=0; b.tilt=1; b.back=false;
    b.tails=OPT.lands==='random' && b.spinRate ? Math.cos(b.spinA)<0 : false;
    sfx(ground>0?'stack':'land',Math.min(1,.45+speed/1400)*(isBar(b.colour)?1.3:1),rise(b)*pitchOf(b));
    if (isBar(b.colour)) sfx('knock',.55,.62);
    if (OPT.roll==='on' && ground<1 && !isBar(b.colour) && (b.edge || (rnd()<(isBig(b.colour)?.08:.2) && speed>120))){ b.edge=false; startRoll(b); return; }
    b.edge=false;
    if (b.flipGlint && rnd()<.22) glint(b);
    if (t.slot){ b.tx=t.x; b.ty=t.y; b.tz=t.z||0; skid(b,70+Math.min(120,Math.hypot(t.x-b.x,t.y-b.y)*4)); return; }
    if (OPT.bounces==='dead'){ b.vx=0; b.vy=0; settle(b); return; }        // lands dead
    const drag=isBar(b.colour)?.3:(isBig(b.colour)?.55:.7);
    b.vx*=drag; b.vy*=drag; b.state='slide';
  }
  // RISE: each landing within one throw sounds a semitone higher (capped)
  // heavier pieces sound lower
  const pitchOf=b=>isBar(b.colour)?.6:(isBig(b.colour)?.8:1);
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
      holdIn(b);
      if (seat(b)) return;
      b.z=supportUnder(b).h;
    }
    if (OPT.rock==='on' && b.z<1 && !isBar(b.colour) && rnd()<.22){
      b.state='rock'; b.t=0; b.T=rr(.2,.32);
      b.rockSeq=rnd()<.5?[.6,1,.82,1]:[.6,1];
      return;
    }
    finishRest(b);
  }
  /* THE GRID. A loose coin comes to rest in a cell of an invisible grid
     over its zone: cells a coin apart across, rows set half a coin over
     and just far enough back that faces touch (ROW_DY), like the tidied
     piles. The cell nearest where it landed: a stack there, it hops on top
     (centred, with the loose wobble); empty, it slides the few px into it;
     full or taken, the next nearest. So a face never sinks into another,
     a coin never hangs off a stack, and nothing already down is moved.
     OVERLAP 'free' (the lab's old look) skips it. */
  function seat(b,instant){
    const z=b.zone; if (!z || OPT.overlap==='free') return false;
    const d=b.d, sp=D()+1, dy=ROW_DY(sp), k=z.id==='pot'&&OPT.lip==='on'?trayBox(d,b.colour):null;
    const rest=z.list.filter(q=>q!==b && q.state==='rest');
    const taken=z.list.filter(q=>q!==b && q.seatCell).map(q=>q.seatCell);
    const far=(x,y,q)=>Math.hypot(q.x-x,(q.y-y)*FORE);
    const cells=[];
    const j0=Math.round((b.y-z.cy)/dy);
    for (let j=j0-4;j<=j0+4;j++){
      const y=z.cy+j*dy, off=(j&1)*.5, i0=Math.round((b.x-z.cx)/sp-off);
      for (let i=i0-4;i<=i0+4;i++){
        const x=z.cx+(i+off)*sp;
        if (k && (x<k.L || x>k.R || y<k.T || y>k.B)) continue;
        if (inBlock(x,y,d)) continue;
        const pr={ x, y, d, vx:0, vy:0 }; contain(pr);
        if (Math.abs(pr.x-x)>.5 || Math.abs(pr.y-y)>.5) continue;              // against the rail
        cells.push({ x, y, dist:far(x,y,b) });
      }
    }
    cells.sort((a,c)=>a.dist-c.dist);
    for (const c of cells.slice(0,24)){
      if (taken.some(t=>Math.abs(t.x-c.x)<1 && Math.abs(t.y-c.y)<1)) continue;
      // a stack standing in (or near) the cell: hop onto its top coin
      // (only a tower of its own kind: one kind of piece per tower)
      const base=rest.filter(q=>q.z<.5 && q.colour===b.colour && far(c.x,c.y,q)<d*.6).sort((a,q)=>far(c.x,c.y,a)-far(c.x,c.y,q))[0];
      if (base){
        const top=rest.filter(q=>q.colour===b.colour && Math.abs(q.x-base.x)<d*.45 && Math.abs(q.y-base.y)<d*.4).sort((a,q)=>q.z-a.z)[0];
        const st=stepOf(top);
        if (top.claimed || top.z/st>=snapMax(z,b.colour)) continue;
        // nothing of another kind sits on it or leans into it
        if (rest.some(q=>q.colour!==b.colour && q.z>.5 && clash(base.x,base.y,b.colour,d,q))) continue;
        let ox=0, oy=0;
        if (OPT.stack==='loose'){ ox=rint(-1,1); oy=rint(0,1); }
        else if (OPT.stack==='lean'){ if (!top.leanDir) top.leanDir=rnd()<.5?-1:1; ox=top.leanDir; }
        b.leanDir=top.leanDir;
        // the wobble is around the base, so a stack never walks off itself
        const tx=Math.max(base.x-1,Math.min(base.x+1,top.x+ox)), ty=Math.max(base.y,Math.min(base.y+1,top.y+oy));
        return moveTo(b,{ x:tx, y:ty, z:top.z+st, cell:c, onto:top },instant);
      }
      // empty floor: no face at floor level within a coin of the cell
      if (rest.some(q=>q.z<stepOf(q)-.5 && clash(c.x,c.y,b.colour,d,q))) continue;
      // nor a cell under another kind's stack (a stack's top can hang a px over)
      if (rest.some(q=>q.z>=.5 && clash(c.x,c.y,b.colour,d,q))) continue;
      return moveTo(b,{ x:c.x, y:c.y, z:0, cell:c },instant);
    }
    return false;
  }
  function moveTo(b,t,instant){
    const z=b.zone; z.neat=false;
    const dist=Math.hypot(t.x-b.x,t.y-b.y);
    if (instant || (dist<.5 && Math.abs(t.z-b.z)<.5)){
      b.x=t.x; b.y=t.y; b.z=t.z; finishRest(b); return true;
    }
    b.seatCell={ x:t.cell.x, y:t.cell.y };
    if (t.onto){ t.onto.claimed=b; b.snapOnto=t.onto; }
    b.x0=b.x; b.y0=b.y; b.z0=b.z; b.tx=t.x; b.ty=t.y; b.tz=t.z;
    // onto a stack: the snap's little hop and clack; along the floor: a slide
    b.T=t.onto?.07+Math.min(.06,dist/600):.05+Math.min(.1,dist/260); b.arc=t.onto?3:0;
    b.t=0; b.state='tidy'; b.snapping=!!t.onto;
    active.add(b); kick();
    return true;
  }
  // A coin is a solid disc: at the same height it can't sit inside another.
  // Push it clear (a coin is never moved into a card, off the felt or out of
  // the tray), then let it drop to whatever is now under it, and check
  // again. (Unused since the grid: seat() places every loose coin.)
  function relaxCoin(b){
    if (!b.zone || OPT.overlap==='free') return;
    const min=b.d*MIN_GAP();
    for (let round=0; round<4; round++){
      for (let it=0; it<8; it++){
        let moved=false;
        for (const q of b.zone.list){
          if (q===b || q.state!=='rest' || Math.abs(q.z-b.z)>STEP()*.8) continue;
          const dx=b.x-q.x, dy=(b.y-q.y)*FORE, dist=Math.hypot(dx,dy);
          if (dist>=min) continue;
          const nx=dist>.01?dx/dist:(rnd()<.5?-1:1), ny=dist>.01?dy/dist:0, push=min-dist+.4;
          b.x+=nx*push; b.y+=ny*push/FORE; moved=true;
        }
        holdIn(b);
        if (!moved) break;
      }
      const sup=supportUnder(b);
      // a coin on a coin can't hang far off it: it would topple
      if (sup.o){
        const dx=b.x-sup.o.x, dy=b.y-sup.o.y, off=Math.hypot(dx,dy*FORE), lim=b.d*.3;
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
      const s=stacks.find(k=>k.colour===b.colour && Math.abs(k.x-b.x)<b.d*.45 && Math.abs(k.y-b.y)<b.d*.35 && b.z>=k.top+stepOf(b)*.5 && (k.top=b.z,true));
      if (s) s.coins.push(b); else stacks.push({ x:b.x, y:b.y, d:b.d, colour:b.colour, top:b.z, coins:[b] });
    });
    // how far a stack's upper coins sit off its base
    stacks.forEach(k=>{ k.spread=Math.min(k.d*.3,Math.max(0,...k.coins.map(b=>Math.hypot(b.x-k.coins[0].x,(b.y-k.coins[0].y)*FORE)))); });
    for (let it=0; it<80; it++){
      let moved=false;
      for (let i=0;i<stacks.length;i++) for (let j=i+1;j<stacks.length;j++){
        const a=stacks[i], c=stacks[j];
        const dx=c.x-a.x, dy=(c.y-a.y)*FORE;
        if (isBar(a.colour)||isBar(c.colour)){
          // boxes: push apart along the shallower overlap
          const ox=(a.d+c.d)/2+a.spread+c.spread-Math.abs(dx), oy=(depthOf(a.colour,a.d)+depthOf(c.colour,c.d))/2+a.spread+c.spread-Math.abs(dy);
          if (ox<=0 || oy<=0) continue;
          if (ox<oy){ const h=ox/2+.3, sx=dx>=0?1:-1; a.x-=sx*h; c.x+=sx*h; }
          else { const h=oy/2+.3, sy=dy>=0?1:-1; a.y-=sy*h/FORE; c.y+=sy*h/FORE; }
          moved=true; continue;
        }
        const min=(a.d+c.d)/2*MIN_GAP()+a.spread+c.spread, dist=Math.hypot(dx,dy);
        if (dist>=min) continue;
        const nx=dist>.01?dx/dist:(rnd()<.5?-1:1), ny=dist>.01?dy/dist:0, h=(min-dist)/2+.3;
        a.x-=nx*h; a.y-=ny*h/FORE; c.x+=nx*h; c.y+=ny*h/FORE; moved=true;
      }
      stacks.forEach(k=>{ const probe={ x:k.x, y:k.y, d:k.d, vx:0, vy:0 }; holdIn(probe,z); k.x=probe.x; k.y=probe.y; });
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
  const snapMax=(z,col)=>{ col=col||'gold'; return z.room?Math.max(1,Math.min(5,Math.floor((z.room-pieceH(col)-2)/stepOf(col)))):5; };
  // SNAP: pull a settling coin onto the nearest stack top (max 6 high)
  function trySnap(b){
    if (!b.zone) return false;
    let best=null, bd=1e9;
    for (const q of b.zone.list){
      if (q===b || q.state!=='rest' || q.claimed) continue;       // another coin is already hopping onto it
      const covered=b.zone.list.some(r=>r!==q && r!==b && r.state==='rest' && r.z>q.z+.5 && Math.abs(r.x-q.x)<b.d*.5 && Math.abs(r.y-q.y)<b.d*.4);
      if (covered || q.z/STEP()>=snapMax(b.zone,b.colour)) continue;
      const dist=Math.hypot(q.x-b.x,(q.y-b.y)*FORE);
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
  function stackAt(q){ return q.zone ? q.zone.list.filter(c=>c.state==='rest' && c.colour===q.colour && Math.abs(c.x-q.x)<c.d*.45 && Math.abs(c.y-q.y)<c.d*.4).sort((a,c)=>c.z-a.z) : [q]; }
  function topple(coins,dx,dy,power){
    if (coins.length<2) return false;
    const L=Math.max(.01,Math.hypot(dx,dy)); dx/=L; dy/=L;
    if (coins[0].zone) coins[0].zone.neat=false;
    const n=coins.length;
    coins.forEach((c,i)=>{ const lv=n-1-i; c.rx=Math.round(dx*lv*.7); dirty.add(c); });
    kick(); sfx('knock');
    const home=coins[0].zone, my=worldGen;
    setTimeout(()=>{
      coins.forEach((c,i)=>{
        const lv=n-1-i; c.rx=0; dirty.add(c);
        // only coins still resting in this pile topple: one that has since
        // been swept or paid out keeps going where it was sent
        if (my!==worldGen || c.state!=='rest' || c.zone!==home) return;
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
      const dx=b.x-q.x, dy=(b.y-q.y)*FORE, dist=Math.hypot(dx,dy), min=(b.d+q.d)/2*MIN_GAP();
      if (dist>=min || dist<.01) continue;
      const nx=dx/dist, ny=dy/dist, over=min-dist;
      // a stack (or a coin with one on it) stands firm; a lone coin can be
      // knocked away, and a sliding one shares the push
      const lone=q.z<1 && !q.claimed && !b.zone.list.some(r=>r!==q && r!==b && r.state==='rest' && r.z>q.z+.5 && Math.abs(r.x-q.x)<b.d*.5 && Math.abs(r.y-q.y)<b.d*.4);
      const qMoves=lone && OPT.knock!=='off';
      const share=qMoves && q.state==='slide'?.5:1;
      b.x+=nx*over*share; b.y+=ny*over*share/FORE;
      const rvx=b.vx-(q.vx||0), rvy=b.vy-(q.vy||0), vn=rvx*nx+rvy*ny;
      if (vn<0){
        if (qMoves && q.state==='rest' && -vn>30){
          // like pool balls: the hit coin takes most of the speed, the
          // hitter nearly stops, and the hit coin can go on to hit the next
          b.vx+=-vn*.9*nx; b.vy+=-vn*.9*ny;
          shunt(q,vn*.85*nx,vn*.85*ny/FORE); sfx('stack',.6);
        } else {
          const j=-(1.15)*vn/(qMoves?2:1);
          b.vx+=j*nx; b.vy+=j*ny;
          if (qMoves){
            q.vx=(q.vx||0)-j*nx; q.vy=(q.vy||0)-j*ny/FORE;
            if (q.state==='rest' && Math.hypot(q.vx,q.vy)>22){ q.target={}; q.zone.neat=false; q.state='slide'; q.t=0; active.add(q); }
            else if (q.state==='rest'){ q.vx=q.vy=0; }
          }
        }
      }
      if (qMoves && q.state==='slide'){ q.x-=nx*over*.5; q.y-=ny*over*.5/FORE; holdIn(q); dirty.add(q); }
    }
  }
  // A landing disturbs what's around it: shoves, or pops a chip loose.
  function knockAround(b,speed){
    if (!b.zone || OPT.knock==='off') return;
    const near=b.zone.list.filter(q=>q!==b && q.state==='rest' && Math.hypot(q.x-b.x,(q.y-b.y)*FORE)<b.d*1.2);
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
    const hr=pixel?hrOf(b.colour):1;
    if (!b.el._base){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=Math.round(dnow*hr)+'px'; }
    if (pixel){
      if (Math.abs(dnow-b.el._base)>1 && (b.state!=='air' || Math.abs(dnow-b.d1)<1)){ b.el._base=dnow; b.el.style.width=dnow+'px'; b.el.style.height=Math.round(dnow*hr)+'px'; }
      if (b.state==='air' && b.spinRate && spinOn(b)){
        const N=+OPT.spinFrames||16, turn=((b.spinA%(2*Math.PI))+2*Math.PI)%(2*Math.PI), big=isBig(b.colour);
        const k=Math.floor(turn/(2*Math.PI)*N)%N, key='spin|'+b.el._base+'|'+b.axis+'|'+k+'|'+N+'|'+OPT.light+'|'+(big?OPT.bigLook:'');
        if (b.chip.frame!==key){ b.chip.frame=key; b.el.style.backgroundImage=spinFrame(b.el._base,b.axis,k,N,big); }
      } else setFrame(b.chip,b.el._base,ti,b.state==='rest'?!!b.tails:(b.back&&b.state!=='rest'));
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
      if (b.state==='rest' && b.zone) covered=b.zone.list.some(q=>q!==b && q.state==='rest' && q.colour===b.colour && q.z>b.z+.5 && Math.abs(q.x-b.x)<b.d*.62 && Math.abs(q.y-b.y)<b.d*.5);
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
    if (kind==='test'){
      for (let i=0;i<n;i++) out.push({ t:i*420, T:2.4, flips:2 });
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
      if (kind==='test') T=Math.max(T,1.05);
      if (tossers.has(i)){ T=Math.max(.5,T*rr(1.7,2.1)); flips=rint(3,5); toss=true; }
      if (OPT.hand==='bloom'||kind!=='lob'){ it.b.x+=rr(-3,3); it.b.y+=rr(-2,2); }
      const loose=!it.to.slot&&!it.to.vanish&&!it.to.mouth;
      return launch(it.b,it.to,{ big, combo, wait:pl.t+delay, T:eased()?undefined:T, i, mode:pl.mode, tumble:pl.tumble, grip:pl.grip, toss,
        jx:loose?rr(-6,6):0, jy:loose?rr(-3,3):0, flips, onStart:it.onStart }).then(()=>{ if (it.onLand) it.onLand(); });
    }));
  }


  /* ---------------- world housekeeping (for callers) ---------------- */
  // empties the world: every body, every zone, every pending draw
  function clearWorld(){
    worldGen++;
    active.clear(); dirty.clear(); squashing.clear(); freeze=0;
    if (air) air.innerHTML=''; if (shadows) shadows.innerHTML='';
  }

  window.CoinWorld={
    hooks,
    OPT, BASE, BB, COLOURS, CURVES, LIMITS, LIM, SIZES, SPIN_RATE, G, FRICTION, GRIP,
    D, STEP, HR, THICK, ease, flightT, insideFelt, pixelArt, snapMax, eased,
    rnd, rint, rr, reseed,
    Coin, sfx, rise,
    active, dirty, squashing, zones, spinCache, frameCache,
    makeChip, styleChip, setFrame, frames, spinFrame, coloursFor, betCoins, bankCoins, curve,
    PIECES, KINDS, isBar, isBig, pieceD, pieceH, stepOf, depthOf, clash, compose, valueOf, merge, mergePlan, barFrame,
    BankPile,
    body, removeBody, removeFromZone, toRest, finishRest, kick, ensureLayers, draw, snap, arrive, begin,
    buildWalls, boardRow, contain, inBlock, fitTray, lip, trayBox, holdIn,
    zone, zoneBusy, neatSlots, seat, newPotShape, potShape:()=>potShape, POT_SHAPES, tidyZone, scheduleTidy, supportUnder, stackAt, topple,
    launch, throwAll, plan, kindFor,
    glint, glintAt, glintPile, shake, puff,
    clearWorld, setHost, alignLayers, setExtraBlocks:list=>{ extraBlocks=(list||[]).slice(); },
    setTray:t=>{ TRAY=t; fitTray(); }, tray:()=>TRAY, walls:()=>WALLS, airLayer:()=>air,
    stats:()=>({ stuck:stuckCount, log:stuckLog })
  };
})();
