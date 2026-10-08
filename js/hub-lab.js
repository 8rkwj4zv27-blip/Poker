"use strict";
/* Round 4: three invitations and a top reader. Lab only, in-memory saves.
   Printed terms, advertised rosters and the entry transaction remain Career's. */
(() => {
  const host=(()=>{try{return parent!==window && parent.__lab ? parent.__lab:null;}catch(_){return null;}})();
  const state=host ? host.state:{};
  const query=new URLSearchParams(host ? parent.location.search:location.search);
  Object.assign(state,{speed:1,motion:'full',pose:query.get('pose')||'play',brief:'paper',...state});
  const save=p=>{Object.assign(state,p);if(host)host.set(p);};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=v=>'$'+Number(v).toLocaleString('en-US');
  const reduced=()=>state.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const still=()=>state.pose!=='play';
  const wait=ms=>new Promise(r=>setTimeout(r,reduced()||still()?0:ms/state.speed));
  const sound=(name,...args)=>{if(!still()&&!reduced()){try{Sound[name](...args);}catch(_){}}};
  const buzz=v=>{if(!still()&&!reduced()){try{haptic(v);}catch(_){}}};
  const TW=152,TH=216;
  const VENUES={'BACK ROOM':['backroom','BACK ROOM'],'PUB CIRCUIT':['pub','PUB CIRCUIT'],'CARD CLUB':['cardclub','CARD CLUB'],'CASINO FLOOR':['casino','CASINO'],'HIGH ROLLER ROOM':['highroller','HIGH ROLLER'],'INVITATIONAL CHAMPIONSHIP':['invitational','INVITATIONAL']};
  const POOL=[
    {id:'pub-freezeout',kind:'event',why:'NEXT STEP',note:'Win here to open the Card Club.'},
    {id:'back-room-heads-up',kind:'character',why:'A PRIVATE TABLE',note:'One opponent. One invitation. Winner takes the pot.'},
    {id:'pub-turbo',kind:'format',why:'A CHANGE OF PACE',note:'A shorter stack and quicker blinds. Same Hold’em.',title:'PUB TURBO'},
    {id:'back-room-five',kind:'event',why:'TWO PLACES PAID',note:'Five players. First and second take home a prize.'},
    {id:'pub-open',kind:'event',why:'TWO PLACES PAID',note:'A bigger field with a second paid place.'},
    {id:'card-club-deep',kind:'event',why:'A BIGGER SHOT',note:'More chips and more time to play.',title:'DEEP STACK'}
  ];
  let root,layer,cards=[],picked=-1,press=null,holding=null,dealing=false,busy=false,raf=0,last=0,epoch=0,dealNo=0,shown=0;
  let tuneSheet,tuneKey,scrim,seeded=false,wasHidden=true;
  const visible=()=>root&&!document.getElementById('career').classList.contains('hidden');
  const phase=n=>{root.dataset.phase=n;};
  const box=el=>{const a=el.getBoundingClientRect(),b=root.getBoundingClientRect();return{x:a.left-b.left,y:a.top-b.top,w:a.width,h:a.height};};
  const point=e=>{const r=root.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const wake=()=>{if(!raf&&visible()){last=0;raf=requestAnimationFrame(step);}};
  function data(d){
    const event=careerEventById(d.id),roster=careerRosterFor(d.id)||[],who=d.kind==='character'?careerSeatName(roster[0]).toUpperCase():'';
    return {...d,event,roster,who,venue:VENUES[event.venue][0],venueName:VENUES[event.venue][1],title:who?who+'’S TABLE':d.title||careerEventTitle(event),price:event.buyIn,style:d.kind==='character'?'card':d.kind==='format'?'slip':'ticket'};
  }
  const portrait=(seat,mood='idle')=>renderFace({faceColorIdx:seat.faceColorIdx},mood);
  function ticket(t,i){
    const el=document.createElement('button');el.type='button';el.className='hb-t';el.dataset.i=i;el.dataset.kind=t.kind;el.dataset.style=t.style;el.dataset.venue=t.venue;
    el.setAttribute('aria-label',t.venueName+', '+t.title+', entry '+money(t.price)+'. Inspect ticket');el.setAttribute('aria-pressed','false');
    const art=t.kind==='character'?'<span class="hb-hero">'+portrait(t.roster[0],'sly')+'</span>':'<span class="hb-faces">'+t.roster.slice(0,4).map(s=>'<span class="hb-face">'+portrait(s)+'</span>').join('')+'</span>';
    el.innerHTML='<span class="hb-shadow" aria-hidden="true"></span><span class="hb-card"><span class="hb-t-body"><span class="hb-venue">'+esc(t.venueName)+'</span><span class="hb-title">'+esc(t.title)+'</span><span class="hb-art">'+art+'</span><span class="hb-kind">'+(t.kind==='character'?'PRIVATE INVITATION':t.kind==='format'?'TURBO FREEZEOUT':'ADMIT ONE')+'</span><span class="hb-stub"><span class="hb-serial">'+(t.kind==='character'?'H /':t.kind==='format'?'T /':'Nº')+' 0'+(i+1)+'</span><span class="hb-price"><small>ENTRY</small><b>'+money(t.price)+'</b></span></span>'+(t.kind==='character'?'<span class="hb-foil" aria-hidden="true"><i></i></span>':'')+'</span><span class="hb-back" aria-hidden="true"><i>PF</i></span><span class="hb-shade" aria-hidden="true"></span></span>';
    el.addEventListener('click',e=>{if(e.detail===0&&!busy&&!dealing)choose(picked===i?-1:i);});
    el.addEventListener('keydown',e=>{
      if(busy||dealing)return;
      if(e.key==='Escape'){e.preventDefault();choose(-1);}
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const j=(i+(e.key==='ArrowRight'?1:2))%3;choose(j);cards[j].el.focus({preventScroll:true});}
    });
    layer.appendChild(el);
    return{el,t,i,x:0,y:0,r:0,s:1,vx:0,vy:0,vr:0,vs:0,tx:0,ty:0,tr:0,ts:1,flip:1,tflip:1,feeding:false};
  }
  function slots(){
    const a=box(root.querySelector('#hb-deal')),W=a.w,H=a.h;
    const rest=Math.min(1.08,(W-20)/(TW*2.45),H*.67/TH),spread=Math.min(W*.34,TW*rest*.86,(root.clientWidth-TW*rest*1.2)/2-8);
    const bh=state.brief==='paper'?root.querySelector('#hb-brief').offsetHeight:64;
    const zoom=Math.min(1.42,(W-64)/TW,(H-bh-15)/TH);
    return cards.map((c,i)=>{
      if(picked===i)return{x:a.x+W/2,y:a.y+TH*zoom/2+8,r:0,s:zoom};
      if(picked>=0){const side=cards.filter(other=>other.i!==picked).indexOf(c)===0?-1:1;return{x:a.x+W/2+side*W*.34,y:a.y+H*.38+(i%2)*10,r:side*11,s:rest*.78};}
      return{x:a.x+W/2+(i-1)*spread,y:a.y+H*.46+(i===0?18:i===2?28:0),r:[-8,1,7][i],s:rest};
    });
  }
  function rehome(){
    if(!root||!cards.length)return;
    const homes=slots();cards.forEach((c,i)=>{c.home=homes[i];if(c!==holding&&!c.feeding){c.tx=c.home.x;c.ty=c.home.y;c.tr=c.home.r;c.ts=c.home.s;}});wake();
  }
  function step(now){
    raf=0;if(!visible()||document.hidden)return;
    const dt=Math.min(.032,(now-(last||now))/1000)*state.speed;last=now;let moving=false;
    cards.forEach(c=>{
      const instant=reduced()||still();
      if(c!==holding){if(instant){c.x=c.tx;c.y=c.ty;c.vx=c.vy=0;}else{c.vx+=(210*(c.tx-c.x)-26*c.vx)*dt;c.x+=c.vx*dt;c.vy+=(210*(c.ty-c.y)-26*c.vy)*dt;c.y+=c.vy*dt;}}
      if(instant){c.r=c.tr;c.s=c.ts;c.flip=c.tflip;}else{c.vr+=(220*(c.tr-c.r)-27*c.vr)*dt;c.r+=c.vr*dt;c.vs+=(220*(c.ts-c.s)-27*c.vs)*dt;c.s+=c.vs*dt;c.flip+=clamp(c.tflip-c.flip,-dt*5.5,dt*5.5);}
      c.el.style.transform='translate('+Math.round(c.x-TW/2)+'px,'+Math.round(c.y-TH/2)+'px) rotate('+c.r.toFixed(2)+'deg) scale('+c.s.toFixed(3)+')';
      c.el.style.zIndex=String(c===holding?100:c.i===picked?60:10+c.i);
      c.el.querySelector('.hb-card').style.transform='scaleX('+Math.max(.025,Math.abs(Math.cos(c.flip*Math.PI))).toFixed(3)+')';
      c.el.classList.toggle('is-down',c.flip<.5);c.el.style.setProperty('--lift',c===holding?'12px':c.i===picked?'8px':'3px');
      if(Math.abs(c.tx-c.x)+Math.abs(c.ty-c.y)+Math.abs(c.vx)+Math.abs(c.vy)>.4||Math.abs(c.tr-c.r)+Math.abs(c.vr)+Math.abs(c.ts-c.s)+Math.abs(c.vs)+Math.abs(c.tflip-c.flip)>.02)moving=true;
    });
    if(moving||holding)raf=requestAnimationFrame(step);
  }
  function status(a,b){root.querySelector('#hb-ro-a').textContent=a;root.querySelector('#hb-ro-b').textContent=b;}
  function lock(on){
    busy=on;['#hb-back','#hb-set','#hb-redeal','#hb-case','#hb-vendor'].forEach(id=>root.querySelector(id).disabled=on);
    tuneKey.disabled=on;cards.forEach(c=>c.el.disabled=on||dealing);paint();
  }
  function paint(){
    const t=cards[picked]&&cards[picked].t;root.classList.toggle('is-selected',!!t);root.classList.toggle('is-reduced',reduced()||still());
    cards.forEach(c=>{c.el.classList.toggle('is-picked',c.i===picked);c.el.classList.toggle('is-dim',!!t&&c.i!==picked);c.el.setAttribute('aria-pressed',String(c.i===picked));});
    const brief=root.querySelector('#hb-brief'),slot=root.querySelector('#hb-slot'),key=root.querySelector('#hb-feed');
    brief.hidden=!t||busy;brief.inert=!t||busy;brief.classList.toggle('is-face-only',state.brief!=='paper');slot.classList.toggle('is-ready',!!t);
    root.querySelector('#hb-slot-word').textContent=t?'ENTRY '+money(t.price):'TICKET READER';
    root.querySelector('#hb-hint').textContent=t?'FLICK UP TO FEED · TAP FELT TO PUT BACK':'THREE INVITATIONS. PICK YOUR TABLE.';
    if(!t){root.classList.remove('is-resuming');if(!busy)status('TONIGHT’S TICKETS','PICK ONE UP TO TAKE A LOOK');return;}
    const event=t.event,entryState=careerEventState(t.id);
    root.querySelector('#hb-brief-title').textContent=t.why;
    root.querySelector('#hb-specs').innerHTML='<span><small>FIELD</small><b>'+(event.opponentCount+1)+' PLAYERS</b></span><span><small>STACK</small><b>'+event.stack.toLocaleString('en-US')+'</b></span><span><small>BLINDS UP</small><b>'+event.handsPerBlindLevel+' HANDS</b></span>';
    root.querySelector('#hb-payout').textContent='PAYS '+event.payouts.map((v,i)=>(i+1)+(i===0?'ST':i===1?'ND':'RD')+' '+money(v)).join(' · ');
    root.querySelector('#hb-field').textContent=t.roster.map(careerSeatName).join(' · ');key.textContent='FEED IT · '+money(t.price);key.disabled=busy||entryState!=='available';
    const resuming=careerHasActiveEvent()&&career.active.eventId===t.id;root.classList.toggle('is-resuming',resuming);
    if(resuming){key.textContent='CONTINUE EVENT';key.disabled=busy;root.querySelector('#hb-slot-word').textContent='ENTRY ALREADY PAID';if(!busy)status('ENTRY ALREADY PAID',t.title+' · CONTINUE YOUR TABLE');return;}
    if(!busy){if(entryState==='unaffordable')status('ENTRY '+money(t.price),'NOT ENOUGH IN THE BANKROLL');else if(entryState!=='available')status('TICKET UNAVAILABLE',careerRequirementText(event,entryState));else status(t.venueName+' · '+t.title,t.note);}
  }
  function choose(i){if(busy||dealing||(careerHasActiveEvent()&&(i<0||cards[i].t.id!==career.active.eventId)))return;if(still()){cards.forEach(c=>c.feeding=false);root.classList.remove('is-docking');}picked=i;paint();rehome();phase(i<0?'idle':'selected');sound(i<0?'cardLanded':'cardReturn');buzz(6);}
  function shuffled(items){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  async function deal(){
    if(busy||dealing||!visible())return;
    dealing=true;const token=++epoch;picked=-1;paint();phase('dealing');root.querySelector('#hb-redeal').disabled=true;
    const d=box(root.querySelector('#hb-deck')),dx=d.x+d.w/2,dy=d.y+d.h/2;
    cards.forEach(c=>{c.el.disabled=true;c.tx=dx;c.ty=dy;c.tr=0;c.ts=.25;c.tflip=0;});wake();if(cards.length)await wait(260);
    if(token!==epoch||!visible()){dealing=false;return;}
    cards.forEach(c=>c.el.remove());const pool=careerHasActiveEvent()?[POOL.find(d=>d.id===career.active.eventId),...POOL.filter(d=>d.id!==career.active.eventId).slice(0,2)]:(dealNo++===0?POOL.slice(0,3):shuffled(POOL).slice(0,3));
    cards=pool.map((d,i)=>ticket(data(d),i));rehome();
    cards.forEach(c=>{Object.assign(c,{x:dx,y:dy,tx:dx,ty:dy,r:-12,s:.25,ts:.25,flip:0,tflip:0});c.el.disabled=true;});root.querySelector('#hb-deck').classList.add('is-dealing');wake();
    for(const c of cards){if(token!==epoch||!visible()){dealing=false;return;}Object.assign(c,{tx:c.home.x,ty:c.home.y,tr:c.home.r,ts:c.home.s});sound('cardDeal');buzz(4);wake();await wait(125);c.tflip=1;wake();}
    await wait(340);if(token!==epoch||!visible()){dealing=false;return;}
    dealing=false;root.querySelector('#hb-deck').classList.remove('is-dealing');cards.forEach(c=>c.el.disabled=false);root.querySelector('#hb-redeal').disabled=false;sound('cardLanded');phase('idle');
    if(careerHasActiveEvent()){picked=0;paint();rehome();phase('resume');cards.forEach(c=>c.el.disabled=true);root.querySelector('#hb-redeal').disabled=true;return;}
    if(state.pose==='selected')choose(1);
    if(state.pose==='feed'){choose(0);dock(cards[0]);phase('preview-feed');status('ENTRY '+money(cards[0].t.price),'TICKET HELD AT THE READER');}
  }
  function down(e){
    if(busy||dealing||!visible()||e.button>0)return;const el=e.target.closest('.hb-t');if(!el)return;
    e.preventDefault();try{Sound.unlock();}catch(_){}
    const c=cards[Number(el.dataset.i)],p=point(e);press={c,id:e.pointerId,x0:p.x,y0:p.y,ox:p.x-c.x,oy:p.y-c.y,lx:p.x,ly:p.y,lt:e.timeStamp,vy:0};el.setPointerCapture(e.pointerId);
  }
  function move(e){
    if(!press||press.id!==e.pointerId)return;e.preventDefault();const p=point(e),c=press.c,now=e.timeStamp,dt=Math.max(1,now-press.lt);
    if(!holding&&Math.hypot(p.x-press.x0,p.y-press.y0)<7)return;
    if(!holding){holding=c;picked=c.i;paint();rehome();phase('holding');root.classList.add('is-holding');c.ts=Math.min(1.4,c.home.s*1.08);sound('cardReturn');buzz(8);}
    press.vy=(p.y-press.ly)/dt;c.x=p.x-press.ox;c.y=p.y-press.oy;c.vx=c.vy=0;c.tr=reduced()?0:clamp((p.x-press.lx)/dt*5,-13,13);press.lx=p.x;press.ly=p.y;press.lt=now;
    root.querySelector('#hb-slot').classList.toggle('is-near',overSlot(c));wake();
  }
  function release(e,cancel=false){
    if(!press||press.id!==e.pointerId)return;const p=point(e),a=press,c=a.c,carried=holding===c;
    press=null;holding=null;root.classList.remove('is-holding');root.querySelector('#hb-slot').classList.remove('is-near');if(c.el.hasPointerCapture(e.pointerId))c.el.releasePointerCapture(e.pointerId);
    if(cancel){rehome();phase(picked<0?'idle':'selected');return;}
    if(carried){const flick=!reduced()&&e.timeStamp-a.lt<110&&a.vy<-.55&&a.y0-p.y>44&&a.y0-p.y>Math.abs(a.x0-p.x)*1.25&&Math.abs(a.x0-p.x)<110;if(overSlot(c)||flick){requestFeed(c);return;}rehome();phase('selected');sound('cardLanded');return;}
    choose(picked===c.i?-1:c.i);
  }
  function overSlot(c){const m=box(root.querySelector('.hb-mouth'));return Math.abs(c.x-(m.x+m.w/2))<Math.max(44,(m.w-TW*c.s*.5)/2)&&Math.abs(c.y-TH*c.s/2-(m.y+m.h/2))<18;}
  function dock(c){const m=box(root.querySelector('.hb-mouth'));c.feeding=true;c.tx=m.x+m.w/2;c.ts=Math.min(1,(m.w-8)/TW);c.ty=m.y+m.h/2+TH*c.ts/2-2;c.tr=0;root.classList.add('is-docking');root.querySelector('#hb-slot').classList.add('is-near');wake();}
  function returnTicket(c,message){
    c.feeding=false;c.el.style.visibility='';root.classList.remove('is-docking','is-taking');root.querySelector('#hb-slot').classList.remove('is-near','is-taking');lock(false);rehome();phase('selected');if(message)status('TICKET RETURNED',message);sound('cardLanded');
  }
  async function requestFeed(c){
    if(busy||dealing||!c||!visible())return;
    if(still()){picked=c.i;paint();dock(c);phase('preview-feed');return;}
    if(!careerCanEnterEvent(c.t.id)){picked=c.i;paint();rehome();phase('selected');return;}
    picked=c.i;lock(true);phase('docking');dock(c);status('ENTRY '+money(c.t.price),'READER ACCEPTING YOUR INVITATION');await wait(300);
    if(!visible()){returnTicket(c);return;}
    if(careerRiskBand(c.t.event)==='risky'){
      phase('warning');status('ENTRY '+money(c.t.price),'LEAVES '+money(careerBankroll()-c.t.price)+' IN YOUR BANKROLL');
      showConfirmDialog({title:'Take a bankroll shot?',body:'This '+money(c.t.price)+' entry leaves '+money(careerBankroll()-c.t.price)+' available. Permanent room access is never lost.',confirmLabel:'Feed ticket · '+money(c.t.price),danger:false,onConfirm:()=>{root.inert=false;accept(c);},onCancel:()=>{root.inert=false;returnTicket(c,'NO ENTRY PAID');c.el.focus({preventScroll:true});}});
      root.inert=true;document.getElementById('confirm-dialog-no').focus({preventScroll:true});
    }else accept(c);
  }
  async function accept(c){
    if(!busy||!visible()){returnTicket(c);return;}
    phase('feeding');root.classList.add('is-taking');root.querySelector('#hb-slot').classList.add('is-taking');status('FEEDING '+c.t.title,'ENTRY '+money(c.t.price));
    const startY=c.ty,h=TH*c.ts;
    for(let i=1;i<=5;i++){c.ty=startY-h*i/5;wake();sound('stageRollClick',.35+i*.07,false);buzz(4);await wait(95);}
    c.el.style.visibility='hidden';
    // The sole debit: Career rechecks eligibility, freezes terms, and persists.
    if(!enterCareerEvent(c.t.id)){returnTicket(c,'ENTRY NOT AVAILABLE · NO MONEY TAKEN');return;}
    phase('paid');root.classList.remove('is-taking');root.classList.add('is-paid');status('ENTRY PAID · '+money(c.t.price),'NOW SEATING '+c.t.title);sound('hatchClose');buzz([10,8,20]);await countBank(careerBankroll());await wait(180);
    const launch=()=>startCareerEvent();if(reduced())launch();else careerDepartToTable(launch,{callout:c.t.title});
  }
  function reel(v){const digits=String(Math.max(0,Math.floor(v))).padStart(7,'0'),lead=7-String(Math.max(0,Math.floor(v))).length;return'<span class="jp-cell jp-sym">$</span>'+digits.split('').map((d,i)=>'<span class="jp-cell jp-digit'+(i<lead?' is-leading':'')+'">'+d+'</span>').join('');}
  async function countBank(to){
    if(reduced()){shown=to;root.querySelector('#hb-reel').innerHTML=reel(to);return;}
    const from=shown;for(let i=1;i<=9;i++){root.querySelector('#hb-reel').innerHTML=reel(Math.round(from+(to-from)*i/9));sound('counterTick',true);await wait(45);}shown=to;
  }
  function openTune(on){root.inert=on;tuneSheet.classList.toggle('is-open',on);tuneSheet.inert=!on;tuneSheet.setAttribute('aria-hidden',String(!on));scrim.hidden=!on;tuneKey.setAttribute('aria-expanded',String(on));if(on)tuneSheet.querySelector('button').focus({preventScroll:true});else if(visible())tuneKey.focus({preventScroll:true});}
  function tune(){
    tuneKey=root.querySelector('#hb-tune');scrim=document.createElement('div');scrim.className='hbl-scrim';scrim.hidden=true;
    tuneSheet=document.createElement('div');tuneSheet.className='hbl-sheet';tuneSheet.inert=true;tuneSheet.setAttribute('role','dialog');tuneSheet.setAttribute('aria-label','Hub lab');tuneSheet.setAttribute('aria-modal','true');tuneSheet.setAttribute('aria-hidden','true');
    const seg=(k,opts)=>'<div class="hbl-seg" data-key="'+k+'">'+opts.map(o=>'<button type="button" data-v="'+o[0]+'" class="'+(String(state[k])===String(o[0])?'is-on':'')+'">'+o[1]+'</button>').join('')+'</div>';
    tuneSheet.innerHTML='<div class="hbl-head"><b>HUB · ROUND 4</b><button type="button" class="hbl-close" aria-label="Close">✕</button></div><div class="hbl-body"><h3>COMPOSITION STUDIES</h3>'+seg('pose',[['play','PLAY'],['rest','REST'],['selected','SELECTED'],['feed','AT THE SLOT']])+'<p>Stills use the same tickets and layout. PLAY enables paid entry in this throwaway career.</p><h3>SELECTED TICKET</h3>'+seg('brief',[['paper','PAPER BRIEF'],['face','FACE ONLY']])+'<h3>MOTION</h3>'+seg('motion',[['full','FULL'],['reduced','REDUCED']])+seg('speed',[[1,'REAL'],[.5,'HALF'],[.25,'QUARTER']])+'<h3>BANKROLL FIXTURE</h3><div class="hbl-seg" data-key="bank"><button type="button" data-v="1840">$1,840</button><button type="button" data-v="350">$350 · RISKY</button><button type="button" data-v="50">$50 · LOW</button></div><p>The Case and Vendor are preview doors. Tickets play their printed catalogue terms; pack rules and collecting are not implemented here.</p></div>';
    document.body.append(scrim,tuneSheet);tuneKey.addEventListener('click',()=>openTune(true));scrim.addEventListener('click',()=>openTune(false));
    tuneSheet.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();openTune(false);}
      if(e.key==='Tab'){const nodes=[...tuneSheet.querySelectorAll('button')],first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    });
    tuneSheet.addEventListener('click',e=>{
      const key=e.target.closest('button');if(!key)return;if(key.classList.contains('hbl-close')){openTune(false);return;}
      const group=key.closest('[data-key]');if(!group)return;const k=group.dataset.key,v=['speed','bank'].includes(k)?Number(key.dataset.v):key.dataset.v;
      if(k==='bank'){career.bankroll=v;saveCareer();shown=v;root.querySelector('#hb-reel').innerHTML=reel(v);}else save({[k]:v});
      group.querySelectorAll('button').forEach(b=>b.classList.toggle('is-on',b===key));root.style.setProperty('--hb-speed',state.speed);paint();rehome();
      if(k==='pose'||k==='bank'){openTune(false);cards.forEach(c=>c.feeding=false);root.classList.remove('is-docking');dealNo=0;deal();}
    });
  }
  function build(){
    const careerEl=document.getElementById('career');if(!careerEl||document.getElementById('hb'))return;careerEl.classList.add('hb-on');root=document.createElement('div');root.id='hb';root.className='hb';root.dataset.phase='idle';
    root.innerHTML='<header class="hb-top"><div class="hb-rail"><button type="button" class="ch2-key hb-key" id="hb-back" aria-label="Back to main menu"><span class="hb-nav" aria-hidden="true"></span></button><span class="hb-plate">CAREER</span><button type="button" class="ch2-key hb-key" id="hb-set" aria-label="Settings">⚙</button></div><div class="hb-bank"><span class="hb-bank-label">BANKROLL</span><div class="hb-reel" id="hb-reel" aria-label="Bankroll"></div></div><div class="hb-readout crt" data-crt-quiet id="hb-readout" aria-live="polite"><small class="crt-caption" id="hb-ro-a">TONIGHT’S TICKETS</small><span class="crt-line" id="hb-ro-b">PICK ONE UP TO TAKE A LOOK</span></div><div class="hb-record"><span>PLAYED <b>14</b></span><span>WON <b>4</b></span><span>CIRCUIT <b>2/6</b></span></div><div class="hb-slot" id="hb-slot"><span class="hb-slot-lamp" aria-hidden="true"></span><span class="hb-mouth" aria-hidden="true"><i></i></span><span class="hb-slot-word" id="hb-slot-word">TICKET READER</span></div></header><section class="hb-felt" aria-label="Tonight’s tickets"><div class="hb-felt-head"><span class="hb-label">TONIGHT’S<br>TICKETS</span><button type="button" class="ch2-key hb-key hb-tune" id="hb-tune" aria-expanded="false">TUNE</button><button type="button" class="ch2-key hb-key hb-redeal" id="hb-redeal" aria-label="Shuffle tonight’s tickets">SHUFFLE</button><span class="hb-deck" id="hb-deck" aria-hidden="true"><i></i><i></i><i>PF</i></span></div><div class="hb-deal" id="hb-deal"><article class="hb-brief" id="hb-brief" hidden inert><span class="hb-brief-title" id="hb-brief-title"></span><div class="hb-specs" id="hb-specs"></div><span class="hb-payout" id="hb-payout"></span><span class="hb-field" id="hb-field"></span><div class="hb-brief-keys"><button type="button" class="btn-secondary hb-return" id="hb-return">PUT BACK</button><button type="button" class="btn-secondary hb-feed" id="hb-feed">FEED IT</button></div></article></div><div class="hb-hint" id="hb-hint">THREE INVITATIONS. PICK YOUR TABLE.</div></section><footer class="hb-doors"><button type="button" class="btn-secondary hb-door" id="hb-case"><span class="hb-door-ico is-case" aria-hidden="true"></span>THE CASE</button><button type="button" class="btn-secondary hb-door" id="hb-vendor"><span class="hb-door-ico is-vendor" aria-hidden="true"></span>THE VENDOR</button></footer><div class="hb-layer" id="hb-layer"></div>';
    careerEl.appendChild(root);layer=root.querySelector('#hb-layer');tune();
    root.querySelector('#hb-back').addEventListener('click',()=>document.getElementById('ch2-back').click());root.querySelector('#hb-set').addEventListener('click',()=>{openOverlay('settings');});
    root.querySelector('#hb-redeal').addEventListener('click',()=>{sound('cardDeal');deal();});root.querySelector('#hb-return').addEventListener('click',()=>choose(-1));root.querySelector('#hb-feed').addEventListener('click',()=>{if(careerHasActiveEvent())continueCareerEvent();else requestFeed(cards[picked]);});
    ['case','vendor'].forEach(name=>root.querySelector('#hb-'+name).addEventListener('click',()=>status('THE '+name.toUpperCase(),'THIS DOOR IS THE NEXT LAB')));
    root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move,{passive:false});root.addEventListener('pointerup',e=>release(e));root.addEventListener('pointercancel',e=>release(e,true));root.addEventListener('lostpointercapture',e=>{if(press&&press.id===e.pointerId)release(e,true);});
    document.getElementById('confirm-dialog').addEventListener('keydown',e=>{
      if(root.dataset.phase!=='warning')return;
      const no=document.getElementById('confirm-dialog-no'),yes=document.getElementById('confirm-dialog-yes');
      if(e.key==='Escape'){e.preventDefault();no.click();}
      if(e.key==='Tab'){e.preventDefault();(document.activeElement===no?yes:no).focus();}
    });
    root.querySelector('#hb-deal').addEventListener('click',e=>{if(e.target.id==='hb-deal'&&picked>=0)choose(-1);});
    const enter=()=>{
      if(!seeded){seeded=true;career.active=null;career.cash=null;career.bankroll=1840;career.eventsPlayed=14;career.eventsWon=4;CAREER_EVENT_LIST.forEach(e=>career.unlocks[e.id]=true);careerRosterStore()['back-room-heads-up']=[{personalityKey:'professor',faceColorIdx:6}];saveCareer();}
      shown=careerBankroll();root.querySelector('#hb-reel').innerHTML=reel(shown);busy=false;dealing=false;holding=null;press=null;root.classList.remove('is-docking','is-taking','is-paid');cards.forEach(c=>{c.feeding=false;c.el.style.visibility='';});lock(false);deal();
    };
    new MutationObserver(()=>{const hidden=careerEl.classList.contains('hidden');if(wasHidden&&!hidden)enter();if(!wasHidden&&hidden){++epoch;dealing=false;press=null;holding=null;cancelAnimationFrame(raf);raf=0;openTune(false);}wasHidden=hidden;}).observe(careerEl,{attributes:true,attributeFilter:['class']});
    const layoutObserver=new ResizeObserver(()=>rehome());layoutObserver.observe(root);layoutObserver.observe(root.querySelector('#hb-brief'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(press)release({pointerId:press.id,clientX:0,clientY:0},true);cancelAnimationFrame(raf);raf=0;}else wake();});
    if(still())showCareerScreen();else if(query.has('hub'))document.getElementById('open-career').click();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
