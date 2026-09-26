/* ============================================================
   CHIP LAB — prototype for docs/ui/CHIP_PLAN.md.

   Mounts the real #table-screen (fetched from index.html) and uses the
   shipped seat, card, reel and CRT renderers against memory-only state,
   exactly like showdown-rail-lab. On top of that it prototypes, as
   switchable options:
     1. chip values  — A today's count curve / B real denominations /
                       C weighted (today's count, colour by size)
     2. opponent chips — A bet spots only / B spots + stack gauge /
                         C spots + a small resting stack
     3. your bank    — A rack / B heap / C heap you tap to tidy
   plus bet spots, the end-of-street sweep, pot count-up and payouts.

   Presentation only: no poker logic runs here, nothing is saved. The
   chip sprites are the production .chip-disc classes; every other piece
   of chip motion lives in this file so the options can be compared
   without touching 06-presentation.js.
   ============================================================ */
(function(){
  'use strict';

  /* ---------------- options ---------------- */
  const OPT = { value:'weighted', seat:'spot', bank:'tidy', speed:1, motion:'on', sound:'on', theme:'emerald' };
  const NOTES = {
    value:{
      count:'Today: chip count grows with the amount (sub-linear), colours cycle at random. Big pots are bigger, but colour means nothing.',
      denom:'Real casino maths: white 1 · red 5 · blue 10 · green 25 · black 100 · purple 500 · yellow 1,000, coloured up so there are never fewer than 3. Tidy, readable, but a huge pot is only a few chips.',
      weighted:'Recommended. Today\'s count curve (a big bet always sends lots of chips) and the colour mix darkens with size in big blinds: small pots are pale, big pots go black, purple and gold.'
    },
    seat:{
      spot:'Seats stay exactly as they are. Chips come out of the seat into a bet spot on the felt and are swept into the pot at the end of each street.',
      gauge:'Bet spots, plus a thin stack gauge under each opponent\'s reel (full at 2× the starting stack; amber when short, coral when desperate). No extra chips on the felt.',
      stack:'Bet spots, plus a small resting stack tucked beside each seat\'s cards. Bets leave it, wins land on it. Judge the crowding.'
    },
    bank:{
      rack:'A sorted rack: one colour per groove, highest value on the left. Winnings drop through the hatch, then the rack re-sorts itself.',
      heap:'A loose tray: winnings drop through the hatch and land where they fall, in leaning little stacks.',
      tidy:'Starts loose, like B. Tap the bank and it racks itself, colour by colour. New winnings land loose again on top.'
    }
  };

  /* ---------------- chip language ---------------- */
  const COLOURS = ['d-white','d-red','d-blue','d-green','d-black','d-purple','d-yellow'];
  const DENOMS  = [1,5,10,25,100,500,1000];
  const BB = 20;
  const VARIANTS = ['v-1','v-2','v-3'];
  let seed = 7;
  function rnd(){ seed = (seed*1103515245 + 12345) >>> 0; return (seed >>> 8) / 0x1000000; }
  function rint(a,b){ return a + Math.floor(rnd()*(b-a+1)); }

  // Colours for `amount` in the current value mode. Order matters only as
  // the order chips are launched.
  function coloursFor(amount){
    if (amount<=0) return [];
    if (OPT.value==='denom'){
      let top = 0;
      for (let i=DENOMS.length-1;i>=0;i--){ if (amount/DENOMS[i]>=3){ top=i; break; } }
      const out=[]; let left=amount;
      for (let i=top;i>=0 && out.length<40;i--){
        while (left>=DENOMS[i] && out.length<40){ out.push(COLOURS[i]); left-=DENOMS[i]; }
      }
      return out;
    }
    const n = visualChipCount(amount);
    if (OPT.value==='count'){
      const out=[]; for (let i=0;i<n;i++) out.push(COLOURS[rint(0,6)]); return out;
    }
    // weighted: the tier centre moves one colour per ~3x in big blinds.
    const bbs = Math.max(.5, amount/BB);
    const centre = Math.max(0, Math.min(6, Math.log(bbs)/Math.log(3.2)));
    const out=[];
    for (let i=0;i<n;i++){
      const r=rnd();
      const off = r<.55 ? 0 : r<.85 ? -1 : 1;
      out.push(COLOURS[Math.max(0,Math.min(6,Math.round(centre)+off))]);
    }
    return out;
  }
  const rank = c => COLOURS.indexOf(c);

  /* ---------------- chips & piles ---------------- */
  // A chip is one DOM element for its whole life: bank -> spot -> pot ->
  // winner. Piles only decide where it rests.
  function makeChip(colour){
    const el=document.createElement('div');
    const variant=VARIANTS[rint(0,2)];
    el.className='chip-disc cl-chip '+colour+' '+variant;
    return { el, colour, jx:rint(-1,1), lean:rint(-1,1), loose:false };
  }

  class Pile{
    constructor(el, kind, opts){
      this.el=el; this.kind=kind; this.chips=[]; this.opts=opts||{};
      this.clumps=[];
    }
    get diam(){ return this.opts.diam||25; }
    get step(){ return this.opts.step||3; }
    size(){ const r=this.el.getBoundingClientRect(); return { w:r.width, h:r.height }; }
    // Every layout returns {x (left px), y (bottom px), z} for each chip.
    layout(){
      if (this.kind==='bank') return this.bankLayout();
      if (this.kind==='heap') return this.heapLayout(this.chips);
      return this.stackLayout();
    }
    slots(){
      const { w } = this.size(), d=this.diam, gap=this.opts.gap!=null?this.opts.gap:2;
      const sp=d+gap, cols=Math.max(1,Math.min(this.opts.maxCols||9, Math.floor(w/sp)));
      const cx=w/2-d/2, out=[];
      const order=[0]; for (let i=1;i<cols;i++) order.push(i%2? Math.ceil(i/2) : -i/2);
      // Front and back rows interleaved centre-out: the mound builds from the middle.
      order.forEach((o,i)=>{
        out.push({ x:Math.round(cx+o*sp), y:0, z:40 });
        if (i<cols-1) out.push({ x:Math.round(cx+o*sp+(o<0?-sp/2:sp/2)), y:this.opts.backDy||7, z:20 });
      });
      return out;
    }
    stackLayout(){
      const slots=this.slots(), cap=this.opts.cap||9, grouped=OPT.value!=='count';
      const stacks=[]; const pos=[];
      this.chips.forEach(c=>{
        const key=grouped?c.colour:'mix';
        let s=null;
        for (let i=stacks.length-1;i>=0;i--){ if (stacks[i].key===key && stacks[i].n<cap){ s=stacks[i]; break; } }
        if (!grouped && stacks.length<Math.min(4,slots.length) && (!s || s.n>=2)) s=null;
        if (!s){
          if (stacks.length<slots.length){ s={ key, slot:slots[stacks.length], n:0 }; stacks.push(s); }
          else { s=stacks.reduce((a,b)=>b.n<a.n?b:a); }
        }
        pos.push({ x:s.slot.x+c.jx, y:s.slot.y+s.n*this.step, z:s.slot.z+s.n });
        s.n++;
      });
      return pos;
    }
    heapLayout(chips){
      // Loose chips fall into leaning clumps scattered on the tray floor.
      // The loose tray fills upward as it gets richer: a poor bank is a thin
      // scatter, a rich one a real heap.
      const { w, h } = this.size(), d=this.diam, floor=Math.min(h*.62, (this.opts.floor||10)+chips.length*.55);
      const pos=[];
      chips.forEach(c=>{
        if (!c.clump || !this.clumps.includes(c.clump)){
          let cl=this.clumps.find(k=>k.n<k.cap && k.open);
          if (!cl){
            this.clumps.forEach(k=>k.open=false);
            cl={ x:rint(1,Math.max(1,Math.round(w-d-1))), y:rint(2,Math.round(floor)), n:0, cap:rint(2,6), open:true };
            this.clumps.push(cl);
          }
          c.clump=cl; c.ci=cl.n; cl.n++;
        }
        const cl=c.clump;
        pos.push({ x:cl.x+c.lean*Math.min(2,c.ci), y:cl.y+c.ci*this.step, z:Math.round((h-cl.y)*4)+c.ci });
      });
      return pos;
    }
    rackLayout(chips){
      const { w, h } = this.size(), d=this.diam, sp=d+3;
      const cols=Math.max(1,Math.floor((w-4)/sp)), x0=Math.round((w-cols*sp)/2+1.5);
      const sorted=chips.slice().sort((a,b)=>rank(b.colour)-rank(a.colour));
      // Short, even towers across two rows before any tower grows tall.
      const byColour={}; sorted.forEach(c=>{ byColour[c.colour]=(byColour[c.colour]||0)+1; });
      const need=k=>Object.values(byColour).reduce((a,n)=>a+Math.ceil(n/k),0);
      const hardCap=Math.max(4,Math.floor((h-d-14)/this.step)+1);
      let cap=12; while (cap<hardCap && need(cap)>cols*2) cap+=2;
      const pos=new Map(); let col=-1, n=cap, last=null, row=0;
      sorted.forEach(c=>{
        if (c.colour!==last || n>=cap){ col++; n=0; last=c.colour; }
        const cc=col%cols; row=Math.floor(col/cols);
        pos.set(c,{ x:x0+cc*sp+(row?Math.round(sp/2):0), y:4+row*9+n*this.step, z:(row?10:60)+n });
        n++;
      });
      return pos;
    }
    bankLayout(){
      const mode=OPT.bank;
      if (mode==='rack'){ const m=this.rackLayout(this.chips); return this.chips.map(c=>m.get(c)); }
      if (mode==='heap') return this.heapLayout(this.chips);
      // tidy: racked chips keep the rack, loose chips sit on top as a heap.
      const racked=this.chips.filter(c=>!c.loose), loose=this.chips.filter(c=>c.loose);
      const m=this.rackLayout(racked), hp=this.heapLayout(loose);
      const hm=new Map(loose.map((c,i)=>[c,{...hp[i],z:hp[i].z+200}]));
      return this.chips.map(c=>m.get(c)||hm.get(c));
    }
    // Applies the layout. Chips that moved slide (FLIP) unless `snap`.
    apply(opts){
      opts=opts||{};
      const pos=this.layout();
      const d=this.diam;
      this.chips.forEach((c,i)=>{
        const p=pos[i]; if (!p || c.flying) return;
        const el=c.el;
        const before = (!opts.snap && el.parentNode===this.el && !motionOff()) ? el.getBoundingClientRect() : null;
        if (el.parentNode!==this.el) this.el.appendChild(el);
        el.style.width=d+'px'; el.style.height=d+'px';
        el.style.left=p.x+'px'; el.style.bottom=p.y+'px'; el.style.zIndex=String(p.z);
        el.classList.toggle('cl-base', this.isBase(c,pos,i));
        if (before && !c.flying){
          const after=el.getBoundingClientRect();
          const dx=before.left-after.left, dy=before.top-after.top;
          if (Math.abs(dx)>.5 || Math.abs(dy)>.5){
            const dur=(opts.slideMs||260)*dur1()+ (opts.stagger? i*opts.stagger:0);
            el.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],
              { duration:dur, easing:opts.easing||'cubic-bezier(.3,.7,.25,1)' });
          }
        }
      });
    }
    isBase(c,pos,i){
      const p=pos[i];
      return !pos.some((q,j)=>j!==i && q && Math.abs(q.x-p.x)<=3 && q.y<p.y && Math.abs(q.y-p.y)<this.diam);
    }
    // Where chip c would rest if added now (viewport rect).
    reserve(c){
      c.flying=true;   // held here, not resting yet: apply() leaves it alone until it lands
      this.chips.push(c);
      const p=this.layout()[this.chips.length-1];
      const r=this.el.getBoundingClientRect();
      return { left:r.left+p.x, top:r.bottom-p.y-this.diam, width:this.diam, height:this.diam };
    }
    take(pref){
      if (!this.chips.length) return null;
      // Take from the top of a stack, preferring the wanted colour.
      const pos=this.layout();
      let best=-1, bestScore=-1e9;
      this.chips.forEach((c,i)=>{
        const covered=pos.some((q,j)=>j!==i && q && Math.abs(q.x-pos[i].x)<=3 && q.y>pos[i].y && q.y-pos[i].y<this.diam);
        if (covered) return;
        const score=(pref && c.colour===pref ? 1000 : 0) - (pref? Math.abs(rank(c.colour)-rank(pref))*10 : 0) + pos[i].y;
        if (score>bestScore){ bestScore=score; best=i; }
      });
      if (best<0) best=this.chips.length-1;
      const c=this.chips.splice(best,1)[0];
      if (c.clump){ c.clump.n--; c.clump=null; }
      return c;
    }
    clear(){ this.chips.forEach(c=>c.el.remove()); this.chips=[]; this.clumps=[]; }
  }

  /* ---------------- timing helpers ---------------- */
  let runToken=0;
  const dur1=()=>1/OPT.speed;
  function sleep(ms){ return new Promise(r=>setTimeout(r, motionOff()?0:ms*dur1())); }
  function guard(t){ if (t!==runToken) throw new Error('cancelled'); }
  let landSoundAt=0;
  function clink(kind, power){
    if (OPT.sound!=='on') return;
    const now=performance.now();
    if (kind==='land'){ if (now-landSoundAt<28) return; landSoundAt=now; Sound.chipLand(); }
    else if (kind==='collect') Sound.chipCollect(power||.6);
    else if (kind==='tooth') Sound.wheelTooth(.6,false);
    else if (kind==='lock') Sound.counterLock(true);
    else if (kind==='hatch') Sound.hatchOpen();
    else if (kind==='hatchClose') Sound.hatchClose();
    else if (kind==='allin') Sound.allIn(false);
  }

  /* One chip's journey from wherever it is now to rect `to`.
     style: 'bet' (arc + tumble), 'sweep' (low slide, raked in),
            'drop' (arc to the hatch mouth, then a fall into the tray). */
  function fly(c, to, style, opts){
    opts=opts||{};
    const el=c.el, from=el.isConnected ? el.getBoundingClientRect() : (opts.from||to);
    if (motionOff()){ c.flying=false; return Promise.resolve(); }
    c.flying=true;
    const layer=document.body;
    layer.appendChild(el);
    Object.assign(el.style,{ position:'fixed', left:from.left+'px', top:from.top+'px', bottom:'auto',
      width:from.width+'px', height:from.height+'px', zIndex:'600', margin:'0' });
    const dx=to.left-from.left, dy=to.top-from.top, s=to.width/Math.max(1,from.width);
    const dist=Math.hypot(dx,dy);
    let frames, dur;
    if (style==='sweep'){
      dur=(opts.dur||430)*dur1();
      const lift=-(2+Math.min(6,dist*.02));
      frames=[
        { transform:'translate(0,0) scale(1)', easing:'cubic-bezier(.5,0,.75,.35)' },
        { transform:'translate('+dx*.35+'px,'+(dy*.35+lift)+'px) scale('+(1+(s-1)*.35)+')', offset:.42, easing:'cubic-bezier(.2,.6,.3,1)' },
        { transform:'translate('+dx+'px,'+dy+'px) scale('+s+')' }
      ];
    } else if (style==='drop'){
      const mouth=opts.mouth; // rect of the hatch opening
      const mx=mouth.left+mouth.width/2-from.width/2-from.left, my=mouth.top-from.height-from.top;
      dur=(opts.dur||620)*dur1();
      const spin=(rnd()<.5?-1:1)*(90+rnd()*140);
      frames=[
        { transform:'translate(0,0) rotate(0deg) scale(1)', easing:'cubic-bezier(.25,.1,.35,1)' },
        { transform:'translate('+mx*.5+'px,'+(my*.5-26-rnd()*16)+'px) rotate('+spin*.5+'deg) scale('+(1+(s-1)*.5)+')', offset:.3, easing:'cubic-bezier(.45,0,.8,.5)' },
        { transform:'translate('+mx+'px,'+my+'px) rotate('+spin*.85+'deg) scale('+s+')', offset:.62, easing:'cubic-bezier(.55,0,1,.6)' },
        { transform:'translate('+dx+'px,'+(dy+2)+'px) rotate(0deg) scale('+s+','+(s*.86)+')', offset:.9, easing:'steps(2,end)' },
        { transform:'translate('+dx+'px,'+dy+'px) rotate(0deg) scale('+s+')' }
      ];
    } else {
      dur=(opts.dur||Math.min(760,380+dist*.9))*dur1();
      const hop=-(10+Math.min(26,dist*.06)+rnd()*6);
      const spin=(rnd()<.5?-1:1)*(20+rnd()*40);
      const lane=((opts.i||0)%5-2)*Math.min(8,dist*.02);
      const nx=-dy/Math.max(1,dist), ny=dx/Math.max(1,dist);
      const wp=(t,r)=>'translate('+(dx*t+nx*lane*Math.sin(Math.PI*t))+'px,'+(dy*t+ny*lane*Math.sin(Math.PI*t)+hop*Math.sin(Math.PI*t))+'px) rotate('+r+'deg) scale('+(1+(s-1)*t)+')';
      frames=[
        { transform:wp(0,0), easing:'cubic-bezier(.3,0,.5,.4)' },
        { transform:wp(.2,spin*.3), offset:.2, easing:'cubic-bezier(.3,0,.5,1)' },
        { transform:wp(.9,spin*.9), offset:.78, easing:'cubic-bezier(.2,.7,.3,1)' },
        { transform:'translate('+dx+'px,'+(dy+1.5)+'px) rotate(0deg) scale('+s+','+(s*.88)+')', offset:.93, easing:'steps(2,end)' },
        { transform:'translate('+dx+'px,'+dy+'px) rotate(0deg) scale('+s+')' }
      ];
    }
    const a=el.animate(frames,{ duration:dur, easing:'linear', fill:'forwards' });
    return a.finished.catch(()=>{}).then(()=>{ a.cancel(); c.flying=false; el.style.position=''; el.style.top=''; el.style.margin=''; });
  }

  /* ---------------- table mount ---------------- */
  async function mountTable(){
    // 'index.html' is the ordinary repo/local-server path. A hosted copy of
    // this Lab (e.g. published as a standalone artifact) can't publish a
    // file literally named index.html alongside its own page, so it ships
    // the same production file under 'prod-table.html' instead — try that
    // second, never first, so local dev always sees the live repo file.
    let src=null;
    for (const path of ['index.html','prod-table.html']){
      try{
        const res=await fetch(path,{cache:'no-store'});
        if (!res.ok) continue;
        const doc=new DOMParser().parseFromString(await res.text(),'text/html');
        const found=doc.querySelector('#table-screen');
        if (found){ src=found; break; }
      }catch(e){ /* try the next candidate */ }
    }
    if (!src) throw new Error('No #table-screen found (tried index.html, prod-table.html)');
    const screen=document.importNode(src,true);
    screen.classList.remove('hidden'); screen.classList.add('cl-table');
    $('cl-mount').replaceWith(screen);
    screen.querySelectorAll('button,input,select').forEach(el=>{ el.disabled=true; el.tabIndex=-1; });
  }

  const card=code=>({ rank:code.slice(0,-1), suit:{s:'♠',h:'♥',d:'♦',c:'♣'}[code.slice(-1)], value:RANK_VALUES[code.slice(0,-1)] });
  const BOARD=['Qh','Jh','3d','9h','10s'].map(card);
  const HOLE={ you:['9c','7c'], prof:['Ks','4d'], wild:['Ah','5h'], shark:['8s','8d'], maniac:['Jc','10c'] };

  let P=null;           // players
  let bank=null, pot=null, spots={}, minis={};
  let potValue=0, potShown=0, streetBets={};

  function seatRect(id){ const e=seatEls[id]; return e && e.card ? e.card.getBoundingClientRect() : null; }

  function setupState(bankAmount){
    runToken++;
    document.querySelectorAll('body > .cl-chip').forEach(el=>el.remove());
    settings.sound=OPT.sound==='on'; settings.haptics=false; settings.faces=true;
    settings.reduceMotion=OPT.motion==='off';
    seed=7;
    const mk=(id,name,isHuman,idx,chips)=>({ id,name,isHuman,hand:HOLE[id].map(card),chips,inHand:true,folded:false,allIn:false,
      eliminated:false,betThisRound:0,totalBetHand:0,streetAction:null,faceColorIdx:idx,personality:{thinkSpeed:1},startChips:chips });
    P=[ mk('you','You',true,0,bankAmount||1000), mk('prof','Prof',false,1,1000), mk('wild','Wildcard',false,2,1000),
        mk('shark','Shark',false,3,1000), mk('maniac','Maniac',false,4,1000) ];
    game={ mode:'cash', phase:'preflop', over:false, handNumber:1, smallBlind:10, bigBlind:20, players:P, board:[], pot:0,
      currentIndex:-1, currentBet:0, positions:{ prof:'SB', wild:'BB' } };
    initSeats();
    // Production piles are replaced by the lab's; keep theirs empty.
    resetPile($('hud-tower'),bankPile()); resetPile($('pot-stacks'),potPile());
    $('pot-area').classList.add('hidden');
    syncCardRow($('board'),[],[],false,'board');
    P.forEach(p=>{
      const e=seatEls[p.id]; if (!e) return;
      if (!p.isHuman) updateSeatReels(e.chips,p.chips);
      syncCardRow(e.cardsContainer,p.hand,p.isHuman?[false,false]:[true,true],!p.isHuman,'hole');
      if (e.actionSlot){ e.actionSlot.className='action-slot act-empty'; e.actionSlot.textContent='–'; }
      if (e.root) e.root.classList.remove('folded');
    });
    updateJackpot(P[0].chips); updateInvestedReel(0);
    $('table-meta').textContent='Hand 1 · 10/20 · Chip Lab';
    paintCRT($('hand-strength'),'<b>Nine-seven suited</b>',false);
    paintCRT($('banner'),actionRowsHTML('CHIP LAB','PICK A RUN',false),false);
    $('actions-row').classList.add('disabled');
    buildLayers();
    potValue=0; potShown=0; streetBets={};
    paintPot();
    // Resting chips: your bank and (option C) the opponents' stacks.
    coloursForStack(P[0].chips).forEach(col=>{ const c=makeChip(col); c.loose=OPT.bank!=='rack'; bank.chips.push(c); });
    bank.apply({snap:true});
    P.filter(p=>!p.isHuman).forEach(p=>{ if (minis[p.id]){ miniColours(p.chips).forEach(col=>minis[p.id].chips.push(makeChip(col))); minis[p.id].apply({snap:true}); } });
    paintGauges();
    status('Ready');
  }

  // A resting stack is a spread of colours, not one bet's worth.
  function coloursForStack(amount){
    if (OPT.value==='count') return coloursFor(amount);
    if (OPT.value==='denom'){
      // A starting stack: ~half in the top colour that gives 5+, the rest in change.
      let top=0; for (let i=DENOMS.length-1;i>=0;i--){ if (amount/DENOMS[i]>=8){ top=i; break; } }
      const out=[]; let left=amount;
      const topN=Math.floor(amount*.5/DENOMS[top]); for (let k=0;k<topN;k++){ out.push(COLOURS[top]); left-=DENOMS[top]; }
      for (let i=top-1;i>=0 && out.length<44;i--){
        const want=Math.floor(left*.6/DENOMS[i]); for (let k=0;k<want && out.length<44;k++){ out.push(COLOURS[i]); left-=DENOMS[i]; }
      }
      return out;
    }
    // weighted: same count curve; the stack's colours spread across three tiers.
    const base=coloursFor(amount);
    return base.map((c,i)=> i%3===0 ? COLOURS[Math.max(0,rank(c)-1)] : c);
  }
  const miniColours=amount=>coloursForStack(amount).slice(0, Math.max(2,Math.round(visualChipCount(amount)/3)));

  /* ---------------- layers on the felt ---------------- */
  function buildLayers(){
    const felt=$('felt');
    felt.querySelectorAll('.cl-spot,.cl-mini,.cl-pot,.cl-compare').forEach(el=>el.remove());
    document.querySelectorAll('.cl-gauge').forEach(el=>el.remove());
    const fr=felt.getBoundingClientRect();
    // Pot: the lab's own mound sits where production's does, over the plate.
    const potArea=$('pot-area');
    const potEl=document.createElement('div'); potEl.className='cl-pot'; felt.appendChild(potEl);
    pot=new Pile(potEl,'stack',{ diam:25, step:3, cap:10, maxCols:9, backDy:8 });
    placePot();
    // Bet spots: under each opponent's cards, and yours on the right of the pot.
    spots={};
    P.forEach(p=>{
      const el=document.createElement('div'); el.className='cl-spot'+(p.isHuman?' is-you':'');
      el.innerHTML='<div class="cl-spot-ring"></div><div class="cl-spot-chips"></div><div class="cl-spot-plate"><span>0</span></div>';
      felt.appendChild(el);
      let x,y;
      if (p.isHuman){ x=fr.width*.80; y=fr.height*.80; }
      else {
        const e=seatEls[p.id]; const cr=(e.cardsContainer||e.card).getBoundingClientRect();
        x=cr.left+cr.width/2-fr.left; y=cr.bottom-fr.top+44;
      }
      el.style.left=Math.round(x)+'px'; el.style.top=Math.round(y)+'px';
      spots[p.id]={ el, pile:new Pile(el.querySelector('.cl-spot-chips'),'stack',{ diam:19, step:3, cap:8, maxCols:3, backDy:6, gap:1 }), amount:0 };
    });
    // Option C: small resting stacks beside each opponent's cards.
    minis={};
    if (OPT.seat==='stack'){
      P.filter(p=>!p.isHuman).forEach((p,i)=>{
        const e=seatEls[p.id]; const cr=(e.cardsContainer).getBoundingClientRect(), sr=e.card.getBoundingClientRect();
        const el=document.createElement('div'); el.className='cl-mini'; felt.appendChild(el);
        const right = (cr.left+cr.width/2-fr.left) < fr.width/2;
        el.style.left=Math.round((right? sr.right-4 : sr.left-34)-fr.left)+'px';
        el.style.top=Math.round(cr.bottom-fr.top-40)+'px';
        minis[p.id]=new Pile(el,'stack',{ diam:15, step:2, cap:9, maxCols:2, backDy:5, gap:0 });
      });
    }
    // Option B: a stack gauge under each opponent's reel.
    if (OPT.seat==='gauge'){
      P.filter(p=>!p.isHuman).forEach(p=>{
        const e=seatEls[p.id]; const g=document.createElement('div'); g.className='cl-gauge';
        g.innerHTML='<i></i>'.repeat(10); e.chips.insertAdjacentElement('afterend',g);
      });
    }
    // Your bank.
    const hl=$('hud-left');
    hl.querySelectorAll('.cl-bank,.cl-hatch,.cl-tidy-hint').forEach(el=>el.remove());
    hl.dataset.bank=OPT.bank;
    const bankEl=document.createElement('div'); bankEl.className='cl-bank'; hl.appendChild(bankEl);
    const hatch=document.createElement('div'); hatch.className='cl-hatch'; hatch.innerHTML='<i></i><i></i>'; hl.appendChild(hatch);
    if (OPT.bank==='tidy'){ const h=document.createElement('div'); h.className='cl-tidy-hint'; h.textContent='TAP TO TIDY'; hl.appendChild(h); }
    bank=new Pile(bankEl,'bank',{ diam:21, step:3, floor:12 });
    hl.onclick=()=>{ if (OPT.bank==='tidy') tidyBank(); };
  }
  function placePot(){
    const felt=$('felt'), fr=felt.getBoundingClientRect();
    const plate=$('pot-area').querySelector('.pot-chip');
    $('pot-area').classList.remove('hidden');
    const pr=plate.getBoundingClientRect();
    const el=pot.el; const w=240, h=70;
    el.style.width=w+'px'; el.style.height=h+'px';
    el.style.left=Math.round(pr.left+pr.width/2-fr.left-w/2)+'px';
    el.style.top=Math.round(pr.top-fr.top-h-4)+'px';
    $('pot-area').classList.toggle('cl-pot-empty', potValue<=0);
  }
  function paintPot(){
    const v=$('pot-val'); if (v) v.textContent=Math.round(potShown).toLocaleString();
    $('pot-area').classList.toggle('cl-pot-empty', potShown<=0 && !pot.chips.length);
  }
  function countPot(to, ms){
    const from=potShown; potValue=to;
    if (motionOff()){ potShown=to; paintPot(); return Promise.resolve(); }
    const t0=performance.now(), d=ms*dur1();
    return new Promise(res=>{
      const tick=now=>{
        const k=Math.min(1,(now-t0)/d), e=1-Math.pow(1-k,3);
        potShown=from+(to-from)*e; paintPot();
        if (k<1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
  }
  function paintGauges(){
    if (OPT.seat!=='gauge') return;
    P.filter(p=>!p.isHuman).forEach(p=>{
      const g=seatEls[p.id].root.querySelector('.cl-gauge'); if (!g) return;
      const lit=Math.max(p.chips>0?1:0, Math.min(10, Math.round(p.chips/(p.startChips*2)*10)));
      const tone=p.chips/BB<15?'danger':p.chips/BB<30?'warn':'ok';
      g.dataset.tone=tone;
      Array.from(g.children).forEach((c,i)=>c.classList.toggle('on',i<lit));
    });
  }

  /* ---------------- betting ---------------- */
  function spotPlate(id){
    const s=spots[id]; s.el.classList.toggle('has-bet', s.amount>0);
    s.el.querySelector('.cl-spot-plate span').textContent=s.amount.toLocaleString();
  }
  function actionLabelSet(p,label,cls){
    const e=seatEls[p.id];
    if (e && e.actionSlot){ e.actionSlot.className='action-slot '+(cls||''); e.actionSlot.textContent=label; }
    if (p.isHuman) paintCRT($('banner'),actionRowsHTML('YOU',label.toUpperCase(),false),false);
    else paintCRT($('banner'),actionRowsHTML(p.name.toUpperCase(),label.toUpperCase(),false),false);
  }

  // p puts `add` more chips into their bet spot this street.
  async function bet(p, add, label){
    const t=runToken;
    if (add>0){
      p.chips-=add; streetBets[p.id]=(streetBets[p.id]||0)+add; p.totalBetHand+=add;
      if (p.chips<=0){ p.chips=0; p.allIn=true; }
    }
    actionLabelSet(p,label,p.allIn?'act-allin':'');
    if (!add) return;
    const s=spots[p.id];
    const want=coloursFor(add);
    const flights=[];
    const gap=want.length<=3?90:want.length<=10?60:34;
    if (p.isHuman) { updateJackpot(p.chips); updateInvestedReel(p.totalBetHand); }
    else updateSeatReels(seatEls[p.id].chips,p.chips);
    paintGauges();
    if (p.allIn) clink('allin');
    for (let i=0;i<want.length;i++){
      guard(t);
      let c=null;
      if (p.isHuman) c=bank.take(want[i]);
      else if (minis[p.id] && minis[p.id].chips.length) c=minis[p.id].take(want[i]);
      if (c){
        // The tray makes change: if the exact colour wasn't there, the chip
        // that leaves is re-struck as the right one before it lifts, so
        // what lands in the spot always reads as this bet.
        if (c.colour!==want[i]){ c.el.classList.remove(c.colour); c.colour=want[i]; c.el.classList.add(c.colour); }
        if (p.isHuman) c.loose=OPT.bank!=='rack';
      }
      else {
        c=makeChip(want[i]);
        const src=(seatEls[p.id].chips||seatEls[p.id].root).getBoundingClientRect();
        const d=19; document.body.appendChild(c.el);
        Object.assign(c.el.style,{ position:'fixed', left:(src.left+src.width/2-d/2)+'px', top:(src.top+src.height/2-d/2)+'px', width:d+'px', height:d+'px', zIndex:'600' });
      }
      const to=s.pile.reserve(c);
      if (p.isHuman) bank.apply({slideMs:180});
      else if (minis[p.id]) minis[p.id].apply({slideMs:160});
      flights.push(fly(c,to,'bet',{ i }).then(()=>{ if (t!==runToken) return; s.pile.apply({snap:true}); clink('land'); }));
      if (i===0){ s.amount+=add; spotPlate(p.id); }
      await sleep(gap);
    }
    await Promise.all(flights);
  }
  function fold(p){
    p.folded=true; p.inHand=false; actionLabelSet(p,'Fold','act-fold');
    const e=seatEls[p.id]; if (e && e.root) e.root.classList.add('folded');
    if (!p.isHuman) syncCardRow(e.cardsContainer,[],[],true,'hole');
  }

  /* The sweep: every bet spot is raked into the pot together. */
  async function sweep(){
    const t=runToken;
    const ids=Object.keys(spots).filter(id=>spots[id].pile.chips.length);
    if (!ids.length) return;
    const total=ids.reduce((a,id)=>a+spots[id].amount,0);
    await sleep(260);
    const all=[]; let k=0;
    ids.forEach((id,si)=>{
      const s=spots[id];
      s.el.classList.add('is-sweeping');
      // Top chips first, so each little stack leaves as a stack.
      const chips=s.pile.chips.slice().reverse(); s.pile.chips=[];
      chips.forEach((c,ci)=>{
        const to=pot.reserve(c);
        all.push(new Promise(r=>setTimeout(r,(si*55+ci*14)*(motionOff()?0:dur1()))).then(()=>{
          guard(t);
          return fly(c,to,'sweep',{ dur:420+si*10 }).then(()=>{ if (t!==runToken) return; pot.apply({snap:true}); if ((k++)%3===0) clink('collect',.45); });
        }).catch(()=>{}));
      });
    });
    const count=countPot(potValue+total, 520+ids.length*55);
    await Promise.all(all); await count;
    guard(t);
    ids.forEach(id=>{ spots[id].amount=0; spots[id].el.classList.remove('is-sweeping'); spotPlate(id); });
    Object.keys(streetBets).forEach(k2=>delete streetBets[k2]);
    P.forEach(p=>{ const e=seatEls[p.id]; if (e && e.actionSlot && !p.folded && !p.allIn){ e.actionSlot.className='action-slot act-empty'; e.actionSlot.textContent='–'; } });
    pot.apply({snap:true});
  }

  function dealBoard(n){ game.board=BOARD.slice(0,n); syncCardRow($('board'),game.board,game.board.map(()=>false),false,'board'); }

  /* ---------------- payouts ---------------- */
  async function payYou(){
    const t=runToken, you=P[0];
    const chips=pot.chips.slice().reverse();  // top of the mound first
    const won=potValue, start=you.chips;
    const hl=$('hud-left'), hatch=hl.querySelector('.cl-hatch');
    paintCRT($('banner'),actionRowsHTML('YOU WIN',won.toLocaleString(),false),false);
    await sleep(350);
    hatch.classList.add('is-open'); clink('hatch');
    await sleep(150);
    const hr=hatch.getBoundingClientRect();
    const mouth={ left:hr.left+hr.width*.3, width:hr.width*.4, top:hr.bottom-2 };
    let landed=0; const n=chips.length; const flights=[];
    for (let i=0;i<n;i++){
      guard(t);
      const c=chips[i]; pot.chips.splice(pot.chips.indexOf(c),1);
      c.loose=OPT.bank!=='rack';
      const to=bank.reserve(c);
      potShown=Math.round(won*(n-i-1)/n); paintPot();
      flights.push(fly(c,to,'drop',{ mouth, dur:560+(i%4)*30 }).then(()=>{
        if (t!==runToken) return;
        landed++;
        bank.apply({ slideMs:OPT.bank==='rack'?220:0 });
        clink('land');
        you.chips=Math.round(start+won*landed/n);
        if (landed%3===0 || landed===n) updateJackpot(you.chips);
      }));
      await sleep(i<6?70:i<20?42:28);
    }
    await Promise.all(flights);
    guard(t);
    you.chips=start+won; updateJackpot(you.chips);
    potValue=0; potShown=0; paintPot();
    await sleep(140);
    hatch.classList.remove('is-open'); clink('hatchClose');
    if (OPT.bank==='rack'){ await sleep(80); bank.apply({slideMs:300, stagger:4}); clink('lock'); }
  }
  async function payOpponent(p){
    const t=runToken;
    const chips=pot.chips.slice().reverse(); pot.chips=[];
    const won=potValue, s=spots[p.id];
    paintCRT($('banner'),actionRowsHTML(p.name.toUpperCase()+' WINS',won.toLocaleString(),false),false);
    await sleep(350);
    // Pushed to the winner's spot as one sliding heap...
    const all=chips.map((c,i)=>{
      const to=s.pile.reserve(c);
      return new Promise(r=>setTimeout(r,i*10*(motionOff()?0:dur1()))).then(()=>fly(c,to,'sweep',{ dur:520 })).then(()=>{ if (t===runToken){ s.pile.apply({snap:true}); if (i%4===0) clink('collect',.5); } });
    });
    const count=countPot(0,560);
    s.amount=won; spotPlate(p.id);
    await Promise.all(all); await count;
    guard(t);
    await sleep(420);
    // ...then gathered into the seat (or onto the resting stack).
    const mini=minis[p.id];
    const target=(seatEls[p.id].chips).getBoundingClientRect();
    const inChips=s.pile.chips.slice().reverse(); s.pile.chips=[];
    s.amount=0; spotPlate(p.id);
    const keep=mini ? Math.max(0, miniColours(p.chips+won).length - mini.chips.length) : 0;
    const flights=inChips.map((c,i)=>new Promise(r=>setTimeout(r,i*12*(motionOff()?0:dur1()))).then(()=>{
      if (mini && i<keep){ const to=mini.reserve(c); return fly(c,to,'sweep',{dur:380}).then(()=>{ if (t===runToken) mini.apply({snap:true}); }); }
      const to={ left:target.left+target.width/2-8, top:target.top+target.height/2-8, width:16, height:16 };
      return fly(c,to,'sweep',{dur:380}).then(()=>{ c.el.remove(); });
    }).then(()=>{ if (i%5===0) clink('collect',.35); }));
    await Promise.all(flights);
    guard(t);
    p.chips+=won; updateSeatReels(seatEls[p.id].chips,p.chips); paintGauges();
    potValue=0; potShown=0; paintPot();
  }

  /* ---------------- the bank: tidy ---------------- */
  let tidying=false;
  async function tidyBank(){
    if (tidying || !bank.chips.some(c=>c.loose)) return;
    tidying=true;
    const hl=$('hud-left'); hl.classList.add('is-tidying');
    // Colour by colour, highest first: each group ratchets into its groove.
    const groups=[...new Set(bank.chips.filter(c=>c.loose).map(c=>c.colour))].sort((a,b)=>rank(b)-rank(a));
    for (const col of groups){
      bank.chips.forEach(c=>{ if (c.colour===col){ c.loose=false; c.clump=null; } });
      if (!bank.chips.some(c=>c.loose)) bank.clumps=[];
      bank.apply({ slideMs:210, stagger:6, easing:'cubic-bezier(.5,0,.2,1)' });
      clink('tooth');
      await sleep(120);
    }
    await sleep(160);
    clink('lock'); hl.classList.remove('is-tidying');
    hl.classList.add('is-tidy'); setTimeout(()=>hl.classList.remove('is-tidy'),400);
    tidying=false;
  }

  /* ---------------- runs ---------------- */
  const pl=id=>P.find(p=>p.id===id);
  async function blinds(){ await Promise.all([ bet(pl('prof'),10,'SB 10'), sleep(160).then(()=>bet(pl('wild'),20,'BB 20')) ]); }
  async function handToTurn(){
    await blinds(); await sleep(350);
    fold(pl('shark')); await sleep(420);
    await bet(pl('maniac'),20,'Call 20'); await sleep(260);
    await bet(pl('you'),20,'Call 20'); await sleep(260);
    await bet(pl('prof'),10,'Call 20'); await sleep(220);
    actionLabelSet(pl('wild'),'Check',''); await sleep(380);
    await sweep(); await sleep(250);
    dealBoard(3); await sleep(700);
    actionLabelSet(pl('prof'),'Check',''); await sleep(300);
    await bet(pl('wild'),60,'Bet 60'); await sleep(300);
    await bet(pl('maniac'),180,'Raise 180'); await sleep(300);
    await bet(pl('you'),180,'Call 180'); await sleep(260);
    fold(pl('prof')); await sleep(260);
    await bet(pl('wild'),120,'Call 180'); await sleep(300);
    await sweep(); await sleep(250);
    dealBoard(4); await sleep(700);
  }
  async function run(kind){
    const t=runToken+1;
    if (kind==='bank-full'){ setupState(8000); status('Bank $8,000'); return; }
    setupState(P && kind!=='reset' ? P[0].startChips : 1000);
    if (kind==='reset') return;
    if (kind==='compare'){ compare(); return; }
    status('Playing');
    try{
      if (kind==='small'){
        await blinds(); await sleep(300);
        fold(pl('shark')); fold(pl('maniac')); await sleep(300);
        await bet(pl('you'),20,'Call 20'); await sleep(200);
        await bet(pl('prof'),10,'Call 20'); await sleep(200);
        actionLabelSet(pl('wild'),'Check',''); await sleep(300);
        await sweep(); dealBoard(3); await sleep(800);
        fold(pl('prof')); fold(pl('wild')); await sleep(400);
        await payYou();
      } else if (kind==='big'){
        await blinds(); await sleep(300);
        fold(pl('shark')); await sleep(250);
        await bet(pl('maniac'),1000,'All-In'); await sleep(350);
        await bet(pl('you'),P[0].chips,'All-In'); await sleep(250);
        fold(pl('prof')); fold(pl('wild')); await sleep(300);
        await sweep(); dealBoard(5); await sleep(900);
        await payYou();
      } else {
        await handToTurn();
        if (kind==='opp-win'){
          actionLabelSet(pl('wild'),'Check',''); await sleep(250);
          await bet(pl('maniac'),300,'Bet 300'); await sleep(300);
          await bet(pl('you'),300,'Call 300'); await sleep(250);
          fold(pl('wild')); await sleep(250);
          await sweep(); dealBoard(5); await sleep(900);
          await payOpponent(pl('maniac'));
        } else {
          actionLabelSet(pl('wild'),'Check',''); await sleep(250);
          await bet(pl('maniac'),800,'All-In'); await sleep(350);
          await bet(pl('you'),P[0].chips,'All-In'); await sleep(250);
          fold(pl('wild')); await sleep(250);
          await sweep(); dealBoard(5); await sleep(900);
          await payYou();
        }
      }
      if (t===runToken) status(OPT.bank==='tidy'?'Done · tap the bank to tidy':'Done');
    } catch(e){ if (e.message!=='cancelled') console.error(e); }
  }

  /* Pot sizes side by side, in the current value mode. */
  function compare(){
    const felt=$('felt'); const box=document.createElement('div'); box.className='cl-compare';
    const amounts=[30,150,600,2400,9000];
    box.innerHTML='<div class="cl-compare-head">POT SIZES · '+{count:'A TODAY',denom:'B DENOMS',weighted:'C WEIGHTED'}[OPT.value]+'</div><div class="cl-compare-grid"></div><div class="cl-compare-foot">TAP TO CLOSE</div>';
    felt.appendChild(box);
    const grid=box.querySelector('.cl-compare-grid');
    amounts.forEach(a=>{
      const cell=document.createElement('div'); cell.className='cl-compare-cell';
      cell.innerHTML='<div class="cl-compare-pile"></div><div class="pot-chip"><span class="pot-word">Pot</span><span class="v">'+a.toLocaleString()+'</span></div>';
      grid.appendChild(cell);
      const pile=new Pile(cell.querySelector('.cl-compare-pile'),'stack',{ diam:17, step:2, cap:10, maxCols:6, backDy:6, gap:1 });
      seed=11; coloursFor(a).forEach(col=>pile.chips.push(makeChip(col)));
      pile.apply({snap:true});
    });
    box.onclick=()=>box.remove();
    status('Pot sizes · '+OPT.value);
  }

  /* ---------------- panel ---------------- */
  function status(s){ $('cl-status').textContent=s.toUpperCase(); }
  function syncPanel(){
    document.querySelectorAll('.cl-seg').forEach(seg=>{
      const k=seg.dataset.opt;
      seg.querySelectorAll('button').forEach(b=>b.classList.toggle('is-on', String(OPT[k])===b.dataset.v));
    });
    document.querySelectorAll('[data-note]').forEach(n=>{ n.textContent=NOTES[n.dataset.note][OPT[n.dataset.note]]; });
    document.body.dataset.theme=OPT.theme;
    document.body.dataset.motion=OPT.motion;
  }
  function wirePanel(){
    document.querySelectorAll('.cl-seg').forEach(seg=>{
      seg.addEventListener('click',ev=>{
        const b=ev.target.closest('button'); if (!b) return;
        const k=seg.dataset.opt; OPT[k]= k==='speed' ? Number(b.dataset.v) : b.dataset.v;
        syncPanel();
        if (k==='sound'){ settings.sound=OPT.sound==='on'; return; }
        if (k==='speed') return;
        setupState(P?P[0].startChips:1000);
      });
    });
    document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.run)));
    $('cl-tab').addEventListener('click',()=>{
      const p=$('cl-panel'); p.hidden=!p.hidden; $('cl-tab').setAttribute('aria-expanded',String(!p.hidden));
    });
    window.addEventListener('resize',()=>{ clearTimeout(wirePanel._r); wirePanel._r=setTimeout(()=>setupState(P?P[0].startChips:1000),250); });
  }

  async function init(){
    const q=new URLSearchParams(location.search);
    ['value','seat','bank','motion','sound','theme'].forEach(k=>{ if (q.get(k)) OPT[k]=q.get(k); });
    if (q.get('speed')) OPT.speed=Number(q.get('speed'));
    if (q.get('panel')==='off') $('cl-panel').hidden=true;
    await mountTable();
    syncPanel(); wirePanel();
    // Let fonts and layout settle before the first measurement.
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    setupState(1000);
    window.__chipLab={ run, OPT, setup:setupState, tidy:tidyBank, state:()=>({ bank:bank.chips.length, pot:pot.chips.length, potValue, you:P[0].chips }) };
  }
  init().catch(err=>{ console.error('[chip-lab]',err); status('Failed to mount — serve over http'); });
})();
