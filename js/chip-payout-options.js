/* POT COLLECTION LAB — one real chip through pot, felt, bank and tower. */
(function(){
  'use strict';
  const COPY=Object.freeze({
    magnet:'A · Magnetic Rack — loose chips rattle in the tray, then the nearest pieces peel smoothly into balanced towers.',
    counter:'B · Casino Counter — the tray feeds alternating towers with a crisp left-right mechanical rhythm.',
    gather:'C · Croupier Gather — chips collect into small groups before the invisible mechanism stacks each packet.',
    overload:'D · Jackpot Overload — harder impact, livelier tray rebounds and a decisive final recovery for massive wins.'
  });
  const INTENSITY=Object.freeze({
    6:{name:'small',impact:.58,hitStop:36,free:430,settle:170,gap:48,dwell:260,stack:390,maxMs:7500},
    14:{name:'normal',impact:.82,hitStop:48,free:620,settle:230,gap:44,dwell:340,stack:460,maxMs:10000},
    24:{name:'big',impact:1.02,hitStop:58,free:760,settle:280,gap:39,dwell:390,stack:500,maxMs:12500},
    32:{name:'massive',impact:1.24,hitStop:70,free:900,settle:340,gap:36,dwell:440,stack:540,maxMs:15000}
  });
  const STYLE=Object.freeze({
    magnet:{suction:30,bankBounce:.48,stackK:54,stackDamp:12},
    counter:{suction:34,bankBounce:.42,stackK:72,stackDamp:14},
    gather:{suction:27,bankBounce:.52,stackK:48,stackDamp:11},
    overload:{suction:38,bankBounce:.60,stackK:66,stackDamp:12}
  });
  let active=null;
  function seeded(seed){let x=seed>>>0;return function(){x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
  function centre(r){return{x:r.left+r.width/2,y:r.top+r.height/2};}
  function nearestTier(n){return INTENSITY[n]||(n<10?INTENSITY[6]:n<20?INTENSITY[14]:n<28?INTENSITY[24]:INTENSITY[32]);}
  function pinChip(el,r,owner){
    document.body.appendChild(el);el.classList.add('payout-physics-chip');
    el.style.transition='none';el.style.position='fixed';el.style.margin='0';
    el.style.left=r.left+'px';el.style.top=r.top+'px';el.style.width=r.width+'px';el.style.height=r.height+'px';
    el.style.zIndex='500';el.style.pointerEvents='none';el.style.transformOrigin='50% 50%';el.style.willChange='transform';owner.nodes.add(el);
  }
  function clearChip(el){
    el.classList.remove('payout-physics-chip','is-in-bank','is-stacking','is-hero-chip');
    ['position','margin','left','top','width','height','zIndex','pointerEvents','transformOrigin','willChange','transform','transition'].forEach(k=>{el.style[k]='';});
  }
  function draw(c){c.el.style.transform='translate3d('+(c.x-c.origin.x).toFixed(2)+'px,'+(c.y-c.origin.y-c.lift).toFixed(2)+'px,0) rotate('+c.rot.toFixed(2)+'deg) scale('+c.scale.toFixed(3)+')';}
  function makeBankLayer(r,owner){
    const layer=document.createElement('div');layer.className='payout-bank-physics-layer';
    layer.style.clipPath='inset('+r.top+'px '+Math.max(0,innerWidth-r.right)+'px '+Math.max(0,innerHeight-r.bottom)+'px '+r.left+'px)';
    document.body.appendChild(layer);owner.layers.add(layer);return layer;
  }
  function impactPlate(point,tier,speed,owner){
    const plate=document.createElement('div');plate.className='payout-smash-weight tier-'+tier.name;
    plate.innerHTML='<span>'+(tier.name==='small'?'POT':'TOTAL')+'</span><b>+'+owner.amount.toLocaleString()+'</b>';
    plate.style.left=point.x+'px';plate.style.top=point.y+'px';document.body.appendChild(plate);owner.layers.add(plate);
    const duration=(tier.name==='massive'?690:tier.name==='small'?470:560)*speed;
    const animation=plate.animate([
      {transform:'translate(-50%,-190%) scale(.82)',opacity:0,offset:0,easing:'cubic-bezier(.18,.68,.22,1)'},
      {transform:'translate(-50%,-64%) scale(1.04)',opacity:1,offset:.36,easing:'cubic-bezier(.2,.72,.2,1)'},
      {transform:'translate(-50%,-50%) scale('+(.96+tier.impact*.05)+')',opacity:1,offset:.43,easing:'cubic-bezier(.12,.82,.18,1)'},
      {transform:'translate(-50%,-72%) scale(1)',opacity:1,offset:.66,easing:'cubic-bezier(.24,.1,.38,1)'},
      {transform:'translate(-50%,-92%) scale(.96)',opacity:0,offset:1}
    ],{duration,easing:'linear',fill:'both'});
    owner.animations.add(animation);animation.finished.finally(()=>{owner.animations.delete(animation);owner.layers.delete(plate);plate.remove();}).catch(()=>{});
  }
  function bounceSound(c,power){const now=performance.now();if(now-(c.lastSound||0)<85)return;c.lastSound=now;if(typeof Sound!=='undefined'&&Sound.chipBounce)Sound.chipBounce(clamp(power/330,.65,1.35));}
  function resolveFeltBounds(c,b,r){
    let hit=0;if(c.x-c.radius<b.left){c.x=b.left+c.radius;c.vx=Math.abs(c.vx)*r;hit=Math.abs(c.vx);}else if(c.x+c.radius>b.right){c.x=b.right-c.radius;c.vx=-Math.abs(c.vx)*r;hit=Math.abs(c.vx);}
    if(c.y-c.radius<b.top){c.y=b.top+c.radius;c.vy=Math.abs(c.vy)*r;hit=Math.max(hit,Math.abs(c.vy));}
    if(c.y+c.radius>b.bottom){c.y=b.bottom-c.radius;c.vy=-Math.abs(c.vy)*r;c.vx*=.88;hit=Math.max(hit,Math.abs(c.vy));}if(hit>135)bounceSound(c,hit);
  }
  function tableObstacles(includeDeck){
    const seen=new Set(),rects=[];
    const selector='#board .card,.seat .seat-cards .card'+(includeDeck?',#dealer-deck .card':'');
    document.querySelectorAll(selector).forEach(el=>{
      if(seen.has(el))return;seen.add(el);const r=el.getBoundingClientRect();if(!r.width)return;
      rects.push({left:r.left-2,right:r.right+2,top:r.top-2,bottom:r.bottom+2});
    });
    return rects;
  }
  function resolveObstacle(c,r,restitution){
    const screenY=c.y-c.lift,nx0=clamp(c.x,r.left,r.right),ny0=clamp(screenY,r.top,r.bottom),dx=c.x-nx0,dy=screenY-ny0;
    if(dx*dx+dy*dy>=c.radius*c.radius)return false;
    let nx,ny,dist=Math.hypot(dx,dy);
    if(dist>.01){nx=dx/dist;ny=dy/dist;}else{
      const edges=[{d:Math.abs(c.x-r.left),x:-1,y:0},{d:Math.abs(r.right-c.x),x:1,y:0},{d:Math.abs(screenY-r.top),x:0,y:-1},{d:Math.abs(r.bottom-screenY),x:0,y:1}].sort((a,b)=>a.d-b.d)[0];
      nx=edges.x;ny=edges.y;dist=-edges.d;
    }
    const push=c.radius-dist;c.x+=nx*push;c.y+=ny*push;const vn=c.vx*nx+c.vy*ny;
    if(vn<0){c.vx-=(1+restitution)*vn*nx;c.vy-=(1+restitution)*vn*ny;c.omega+=(nx*c.vy-ny*c.vx)*.7;bounceSound(c,Math.abs(vn));}
    return true;
  }
  function resolveTableObstacles(c,rects,restitution){for(const r of rects)resolveObstacle(c,r,restitution);}
  function resolveDashboard(c,dashY,gate,restitution){
    const screenY=c.y-c.lift;if(screenY+c.radius<=dashY)return false;
    const clears=c.x-c.radius>=gate.left&&c.x+c.radius<=gate.right;if(clears)return false;
    c.y=dashY-c.radius+c.lift;if(c.vy>0){const hit=c.vy;c.vy=-Math.max(105,c.vy*restitution);c.vx*=.86;c.omega+=(c.x<gate.center?1:-1)*95;bounceSound(c,hit);}return true;
  }
  function routeFor(c,o,geo){
    const b=geo.bounds,g=geo.gate,y=geo.dashY,side=c.index%2?1:-1,lane=(c.index%3)-1;
    const inside=x=>clamp(x,b.left+c.radius+5,b.right-c.radius-5),railX=b.left+c.radius+8,arcY=geo.arcY,mouthY=y-c.radius-8;
    const rail=[{x:railX,y:arcY},{x:railX,y:mouthY}],finish={x:g.center+lane*2,y:geo.bank.top+c.radius+18,final:true};
    if(o.variant==='counter')return[
      {x:inside(side<0?b.left+20:b.right-20),y:arcY+(c.index%3)*8},
      {x:inside(g.center-side*(84+lane*6)),y:arcY+18},...rail,finish
    ];
    if(o.variant==='gather'){const group=Math.floor(c.index/3),groupSide=group%2?1:-1;return[
      {x:inside(g.center+groupSide*(86+(group%3)*9)),y:arcY+(group%2)*18},
      {x:inside(g.center+groupSide*50),y:arcY+18},...rail,finish
    ];}
    if(o.variant==='overload')return[
      {x:inside(side<0?b.right-24:b.left+24),y:arcY+20+c.random*12},
      {x:inside(g.center-side*118),y:arcY-4},
      {x:inside(g.center+side*72),y:arcY+16},...rail,finish
    ];
    return[
      {x:inside(g.center+side*(72+lane*7)),y:arcY-(c.index%3)*10},...rail,finish
    ];
  }
  function collectionDelay(c,o){
    if(o.variant==='gather')return Math.floor(c.collectRank/3)*132+(c.collectRank%3)*14;
    if(o.variant==='overload')return c.collectRank*27;
    if(o.variant==='counter')return c.collectRank*42;
    return c.collectRank*o.tier.gap;
  }
  function resolveBankBounds(c,b,s){
    const p=7;let hit=0;if(c.x-c.radius<b.left+p){c.x=b.left+p+c.radius;c.vx=Math.abs(c.vx)*s.bankBounce;hit=Math.abs(c.vx);}else if(c.x+c.radius>b.right-p){c.x=b.right-p-c.radius;c.vx=-Math.abs(c.vx)*s.bankBounce;hit=Math.abs(c.vx);}
    if(c.y-c.radius<b.top+2){c.y=b.top+2+c.radius;c.vy=Math.abs(c.vy)*s.bankBounce;hit=Math.max(hit,Math.abs(c.vy));}
    if(c.y+c.radius>b.bottom-p){c.y=b.bottom-p-c.radius;c.vy=-Math.abs(c.vy)*s.bankBounce;c.vx*=.78;hit=Math.max(hit,Math.abs(c.vy));}if(hit>90)bounceSound(c,hit);
  }
  function resolvePairs(chips,restitution){
    for(let i=0;i<chips.length;i++){const a=chips[i];if(a.state!=='felt'&&a.state!=='bank')continue;for(let j=i+1;j<chips.length;j++){const b=chips[j];if(b.state!==a.state)continue;
      const dx=b.x-a.x,dy=b.y-a.y,min=a.radius+b.radius,ds=dx*dx+dy*dy;if(ds<=.01||ds>=min*min)continue;const d=Math.sqrt(ds),nx=dx/d,ny=dy/d,push=(min-d)*.5;
      a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel>=0)continue;const impulse=-(1+restitution)*rel*.5;
      a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
    }}
  }
  function collectionOrder(chips,variant,hatch){
    const list=chips.slice();if(variant==='counter')return list.sort((a,b)=>a.index-b.index);
    if(variant==='gather')return list.sort((a,b)=>Math.floor(a.index/3)-Math.floor(b.index/3)||a.x-b.x);
    if(variant==='overload')return list.sort((a,b)=>Number(a.rogue)-Number(b.rogue)||a.random-b.random);
    return list.sort((a,b)=>Math.hypot(a.x-hatch.x,a.y-hatch.y)-Math.hypot(b.x-hatch.x,b.y-hatch.y));
  }
  function enterBank(c,o,now){c.state='bank';c.enteredAt=now;c.lift=0;c.el.classList.add('is-in-bank');o.bankLayer.appendChild(c.el);c.vx*=.48;c.vy=Math.max(115,Math.abs(c.vy)*.42);if(typeof Sound!=='undefined'&&Sound.chipCollect)Sound.chipCollect(.78);if(o.onPhase)o.onPhase('bank');}
  function beginStack(c,o,now){
    c.state='stack';c.stackAt=now;c.el.classList.add('is-stacking');
    if(o.variant==='counter'){c.vy=-110;c.vx+=(c.index%2?1:-1)*45;}else if(o.variant==='gather'){c.vy=-55;c.vx+=(c.index%3-1)*35;}else if(o.variant==='overload'){c.vy=-90;c.vx+=(c.random-.5)*90;}
    if(o.onPhase)o.onPhase('stack');
  }
  function settleChip(c,o){if(c.state==='done')return;c.state='done';clearChip(c.el);settleSlot(o.bank,c.placeholder,c.el);o.nodes.delete(c.el);o.placeholders.delete(c.placeholder);o.landed++;if(typeof Sound!=='undefined'&&Sound.chipLand)Sound.chipLand();if(o.onLand)o.onLand(o.landed,o.chips.length);}
  function cancel(){if(active&&active.cancel)active.cancel();}
  async function play(options){
    cancel();const variant=COPY[options.variant]?options.variant:'magnet',count=Math.max(1,Math.min(32,options.count|0));
    const tier=nearestTier(count),style=STYLE[variant],speed=Math.max(.65,Number(options.speed)||1),stage=['full','smash','bank','stack'].includes(options.stage)?options.stage:'full';
    const o={cancelled:false,recovered:false,raf:0,nodes:new Set(),layers:new Set(),animations:new Set(),placeholders:new Set(),pot:options.pot,bank:options.bank,potPile:options.potPile,bankPile:options.bankPile,amount:Number(options.amount)||0,variant,tier,style,speed,stage,onLand:options.onLand,onPhase:options.onPhase,chips:[],landed:0,bankLayer:null};active=o;
    o.cancel=()=>{if(o.cancelled)return;o.cancelled=true;if(o.raf)cancelAnimationFrame(o.raf);o.animations.forEach(a=>{try{a.cancel();}catch(e){}});o.nodes.forEach(n=>n.remove());o.placeholders.forEach(n=>n.remove());o.layers.forEach(n=>n.remove());o.animations.clear();o.nodes.clear();o.placeholders.clear();o.layers.clear();$('felt')?.classList.remove('payout-impacting');if(active===o)active=null;};
    const potRect=o.pot.getBoundingClientRect(),bankRect=$('hud-left').getBoundingClientRect(),feltRect=$('felt').getBoundingClientRect(),dashRect=$('your-seat-dock').getBoundingClientRect();
    const potPoint=centre(potRect),hatch={x:bankRect.left+bankRect.width/2,y:bankRect.top-4},bounds={left:feltRect.left+6,right:feltRect.right-6,top:feltRect.top+8,bottom:dashRect.top-3};
    const deckRect=$('dealer-deck')&&$('dealer-deck').getBoundingClientRect();
    const deckCrowdsEntry=deckRect&&deckRect.width&&deckRect.left<bankRect.right+18&&deckRect.bottom>bankRect.top-110;
    const entryX=deckCrowdsEntry?clamp(Math.min(hatch.x,deckRect.left-18),bankRect.left+24,bankRect.right-24):hatch.x;
    const boardRect=$('board')&&$('board').getBoundingClientRect(),chipRadius=13,arcY=boardRect&&boardRect.width?Math.min(dashRect.top-chipRadius-12,boardRect.bottom+chipRadius+8):dashRect.top-68;
    const obstacles=tableObstacles(true),airObstacles=tableObstacles(false),gate={center:entryX,left:bankRect.left+11,right:bankRect.right-11},routeGeo={bounds,gate,dashY:dashRect.top,bank:bankRect,arcY};
    const random=seeded((Number(options.seed)||1)*997+count*41+variant.length*131+Math.round(innerWidth));o.bankLayer=makeBankLayer(bankRect,o);
    const rects=new Map();o.pot.querySelectorAll('.chip-disc').forEach(el=>rects.set(el,el.getBoundingClientRect()));
    for(let i=0;i<count;i++){const taken=takeChipFromPile(o.pot,o.potPile,rects);if(!taken)break;const claim=claimDestSlot(o.bank,o.bankPile);o.placeholders.add(claim.placeholder);const r=taken.rect,origin=centre(r),target=centre(claim.placeholder.getBoundingClientRect());
      const c={index:i,el:taken.el,origin,x:origin.x,y:origin.y,vx:0,vy:0,rot:0,omega:0,scale:1,lift:0,radius:r.width/2,placeholder:claim.placeholder,target,state:'held',random:random(),lane:(i%3)-1,rogue:variant==='overload'&&(i%7===2||i===count-1),hero:false,route:null,routeIndex:0,routePointAt:0,lastSound:0};pinChip(c.el,r,o);o.chips.push(c);draw(c);}
    const hero=o.chips[Math.max(0,Math.min(o.chips.length-1,Math.floor(o.chips.length*.67)))];hero.hero=true;hero.el.classList.add('is-hero-chip');
    if(!o.chips.length){o.cancel();return{landed:0,residue:0,durationMs:0};}
    if(document.body.dataset.motion==='off'){o.chips.forEach(c=>settleChip(c,o));o.layers.forEach(n=>n.remove());o.layers.clear();active=null;return{landed:o.landed,residue:0,durationMs:0,reduced:true,stage};}
    if(stage==='bank'||stage==='stack'){o.chips.forEach((c,i)=>{const cols=5,row=Math.floor(i/cols),col=i%cols;if(stage==='bank'){c.x=clamp(feltRect.left+35+col*((feltRect.width-70)/4),bounds.left+c.radius,bounds.right-c.radius);c.y=clamp(dashRect.top-80-row*18,bounds.top+c.radius,bounds.bottom-c.radius);c.state='felt';c.vx=(c.random-.5)*40;}else{c.x=clamp(bankRect.left+18+col*15,bankRect.left+c.radius+7,bankRect.right-c.radius-7);c.y=clamp(bankRect.bottom-20-row*13,bankRect.top+c.radius+4,bankRect.bottom-c.radius-7);c.state='bank';c.enteredAt=-(tier.dwell+i*8);c.el.classList.add('is-in-bank');o.bankLayer.appendChild(c.el);}draw(c);});}
    const ordered=collectionOrder(o.chips,variant,hatch);ordered.forEach((c,i)=>{c.collectRank=i;});
    const impactAt=220,moveAt=impactAt+tier.hitStop,collectAt=stage==='full'?moveAt+tier.free+tier.settle:stage==='bank'?220:0;
    const started=performance.now();let last=started,impactDone=false,hatchOpen=false;if(stage==='full'||stage==='smash')impactPlate(potPoint,tier,speed,o);
    return await new Promise(resolve=>{
      const finish=parked=>{if(o.cancelled)return;if(o.raf)cancelAnimationFrame(o.raf);o.raf=0;$('felt')?.classList.remove('payout-impacting');if(!parked&&typeof closeHatch==='function')closeHatch();o.layers.forEach(layer=>{if(layer!==o.bankLayer||!parked)layer.remove();});if(!parked){o.layers.clear();active=null;}resolve({landed:o.landed,residue:parked?0:o.nodes.size,durationMs:performance.now()-started,reduced:false,stage,parked:!!parked,recovered:o.recovered});};
      const tick=now=>{if(o.cancelled)return;const realDt=Math.min(34,now-last);last=now;const dt=(realDt/speed)/1000,sim=(now-started)/speed;
        if((stage==='full'||stage==='smash')&&sim<impactAt){const squeeze=Math.sin((sim/impactAt)*Math.PI)*.055*tier.impact;o.chips.forEach(c=>{c.x=c.origin.x+(potPoint.x-c.origin.x)*squeeze;c.y=c.origin.y+(potPoint.y-c.origin.y)*squeeze*.45;c.scale=1-squeeze*.12;draw(c);});}
        if((stage==='full'||stage==='smash')&&!impactDone&&sim>=impactAt){impactDone=true;$('felt')?.classList.add('payout-impacting');if(typeof feltImpactBump==='function')feltImpactBump();if(typeof Sound!=='undefined'&&Sound.arcadeReward)Sound.arcadeReward(tier.name==='massive'?'jackpot':tier.name==='big'?'strong':'standard','potWinnings');o.chips.forEach((c,i)=>{const side=i%2?1:-1,power=tier.impact*(variant==='overload'?1.12:1);c.state='felt';c.scale=1;c.vx=(side*(165+random()*270)+(random()-.5)*120)*power;c.vy=-(260+random()*350)*power;c.omega=side*(180+random()*420)*(variant==='overload'?1.18:1);if(c.rogue){c.vx*=1.38;c.vy*=1.22;c.omega*=1.35;}if(c.hero){const heroSide=random()>.5?1:-1,heroPower=tier.name==='small'?.74:tier.name==='normal'?1.02:tier.name==='big'?1.25:1.48;c.vx=heroSide*(650+random()*170)*heroPower;c.vy=-(610+random()*180)*heroPower;c.omega=-heroSide*(760+random()*360)*(variant==='overload'?1.24:1);c.scale=1.06;}});if(o.onPhase)o.onPhase('smash');}
        if(impactDone&&sim>moveAt)$('felt')?.classList.remove('payout-impacting');const feltChips=[],bankChips=[];
        o.chips.forEach(c=>{if(c.state==='done'||c.state==='held')return;
          if(c.state==='felt'){feltChips.push(c);if((stage==='full'||stage==='smash')&&sim<moveAt){draw(c);return;}const suctionStart=collectAt+collectionDelay(c,o);let underSuction=false,atFinal=false;
            if(stage!=='smash'&&sim>=suctionStart){underSuction=true;if(!hatchOpen){hatchOpen=true;if(typeof openHatch==='function')openHatch();if(o.onPhase)o.onPhase('suction');}if(!c.route){c.route=routeFor(c,o,routeGeo);c.routePointAt=sim;}let point=c.route[c.routeIndex],distance=Math.hypot(point.x-c.x,point.y-c.y),waypointMs=tier.name==='small'?480:tier.name==='normal'?600:tier.name==='big'?670:720;if(!point.final&&(distance<28||sim-c.routePointAt>waypointMs)){c.routeIndex++;c.routePointAt=sim;point=c.route[c.routeIndex];distance=Math.hypot(point.x-c.x,point.y-c.y);}atFinal=!!point.final;const ramp=clamp((sim-suctionStart)/420,0,1),k=style.suction*(point.final?1.18:.9)*(.24+.76*ramp);c.vx+=(point.x-c.x)*k*dt;c.vy+=(point.y-c.y)*k*dt;const damp=Math.exp(-(2.0+(point.final?5.4:3.1)*ramp)*dt);c.vx*=damp;c.vy*=damp;c.omega*=Math.exp(-1.25*dt);const liftTarget=point.final?Math.min(18,distance*.18):(o.variant==='overload'?28:o.variant==='counter'?20:23);c.lift+=(liftTarget-c.lift)*Math.min(1,6.5*dt);}else{c.vy+=880*dt;const damp=Math.exp(-1.15*dt);c.vx*=damp;c.vy*=damp;c.omega*=Math.exp(-.72*dt);c.lift*=Math.exp(-7*dt);}
            c.underSuction=underSuction;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.omega*dt;c.scale+=(1+(c.lift/260)-c.scale)*Math.min(1,5*dt);resolveTableObstacles(c,underSuction?airObstacles:obstacles,.7);resolveFeltBounds(c,{left:bounds.left,right:bounds.right,top:bounds.top,bottom:bankRect.bottom},tier.name==='massive'?.68:.58);resolveDashboard(c,dashRect.top,gate,.72);const left=gate.left+c.radius,right=gate.right-c.radius,entering=underSuction&&atFinal&&c.x>=left&&c.x<=right&&c.y-c.lift-c.radius>=bankRect.top;if(entering)enterBank(c,o,sim);
          }
          if(c.state==='bank'){bankChips.push(c);c.vy+=1050*dt;c.vx*=Math.exp(-.55*dt);c.omega*=Math.exp(-1*dt);c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=c.omega*dt;resolveBankBounds(c,bankRect,style);const dwell=tier.dwell+(variant==='gather'?Math.floor(c.index/3)*58:variant==='counter'?(c.index%2)*42:c.random*90);if(sim-c.enteredAt>=dwell)beginStack(c,o,sim);}
          if(c.state==='stack'){const age=sim-c.stackAt;let target=c.target;if(variant==='gather'&&age<150)target={x:bankRect.left+bankRect.width*(c.index%2?.68:.32),y:bankRect.bottom-30};const k=style.stackK,damp=Math.exp(-style.stackDamp*dt);c.vx+=(target.x-c.x)*k*dt;c.vy+=(target.y-c.y)*k*dt;c.vx*=damp;c.vy*=damp;c.x+=c.vx*dt;c.y+=c.vy*dt;c.rot+=(-c.rot)*Math.min(1,9*dt);const dist=Math.hypot(c.x-c.target.x,c.y-c.target.y);if(age>tier.stack&&dist<2.4){c.x=c.target.x;c.y=c.target.y;c.rot=0;draw(c);settleChip(c,o);return;}}
          draw(c);
        });resolvePairs(feltChips,.45);resolvePairs(bankChips,.34);feltChips.forEach(c=>{if(c.state!=='felt')return;resolveTableObstacles(c,c.underSuction?airObstacles:obstacles,.7);resolveDashboard(c,dashRect.top,gate,.72);draw(c);});bankChips.forEach(draw);
        if(stage==='smash'&&sim>=moveAt+tier.free+tier.settle){finish(true);return;}if(o.landed>=o.chips.length){finish(false);return;}
        if(now-started>tier.maxMs*speed){o.recovered=true;o.chips.filter(c=>c.state!=='done').forEach(c=>{c.x=c.target.x;c.y=c.target.y;c.rot=0;draw(c);settleChip(c,o);});finish(false);return;}o.raf=requestAnimationFrame(tick);
      };o.raf=requestAnimationFrame(tick);
    });
  }
  function state(){return active?{active:true,chips:active.nodes.size,layers:active.layers.size,placeholders:active.placeholders.size,landed:active.landed}:{active:false,chips:0,layers:0,placeholders:0,landed:0};}
  window.PayoutOptionFX=Object.freeze({play,cancel,state,copy:COPY,intensities:INTENSITY});
})();
