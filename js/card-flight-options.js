"use strict";

(function(){
  const $=id=>document.getElementById(id);
  const stage=$('cfo-stage');
  const deck=$('cfo-deck');
  const targets=Array.from(document.querySelectorAll('.cfo-target>.card'));
  const active=new Set();
  let direction='deal';
  let playback='normal';
  let token=0;
  let refreshMs=0;

  const MOTION={
    deal:{name:'Dealer flick',duration:560,points:[
        [0,0,0,0,0,1,'cubic-bezier(.38,0,.62,1)',0],[.10,.025,8,-7,5,1.012,'cubic-bezier(.25,0,.48,.38)',-2],
        [.24,.16,23,-12,7,1.018,'cubic-bezier(.16,.05,.28,.74)',-8],[.68,.78,27,4,3,1.01,'cubic-bezier(.24,.58,.3,1)',-5],
        [.90,1,4,-2,0,1.004,'cubic-bezier(.18,.78,.22,1)',0],[.96,1,-2,1,0,1.008,'cubic-bezier(.3,0,.7,1)',0],[1,1,0,0,0,1,null,0]
      ]},
    return:{name:'House sweep',duration:610,points:[
        [0,0,0,0,0,1,'cubic-bezier(.38,0,.62,1)',0],[.10,.025,9,6,6,1.014,'cubic-bezier(.24,0,.46,.35)',3],
        [.26,.18,25,11,7,1.018,'cubic-bezier(.14,.04,.25,.76)',10],[.70,.80,24,-4,3,1.01,'cubic-bezier(.25,.56,.3,1)',7],
        [.91,1,4,2,0,1.004,'cubic-bezier(.16,.8,.22,1)',0],[.97,1,-2,-1,0,1.008,'cubic-bezier(.3,0,.7,1)',0],[1,1,0,0,0,1,null,0]
      ]}
  };

  function median(values){
    if (!values.length) return 0;
    const sorted=values.slice().sort((a,b)=>a-b);
    const mid=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  }

  function buildDeck(){
    deck.replaceChildren();
    for (let index=0;index<10;index++){
      const card=document.createElement('div');
      card.className='card back small cfo-deck-card';
      card.style.setProperty('--layer',String(index));
      card.dataset.remaining=String(43+index);
      deck.appendChild(card);
    }
  }

  function availableDeckTop(){
    return Array.from(deck.children).reverse().find(card=>card.style.visibility!=='hidden')||null;
  }

  function nextEmptyDeckLayer(){
    return Array.from(deck.children).find(card=>card.style.visibility==='hidden')||null;
  }

  function treatment(){ return MOTION[direction]; }

  function cancelAll(){
    token++;
    active.forEach(run=>{
      run.cancelled=true;
      try{ run.animation.cancel(); }catch(error){}
      try{ run.shadowAnimation.cancel(); }catch(error){}
      run.shell.remove();
    });
    active.clear();
    stage.classList.remove('is-running');
  }

  function prepareScene(){
    buildDeck();
    if (direction==='return'){
      Array.from(deck.children).slice(-5).forEach(card=>{ card.style.visibility='hidden'; });
      targets.forEach(card=>{ card.style.opacity='1'; });
    } else {
      targets.forEach(card=>{ card.style.opacity='0'; });
    }
  }

  function resetStage(){
    cancelAll();
    prepareScene();
    $('cfo-status').textContent='Ready';
    $('cfo-readout').textContent=refreshMs
      ? 'Observed refresh interval '+refreshMs.toFixed(2)+'ms · choose a treatment and '+(direction==='return'?'return':'deal')+'.'
      : 'Measuring this browser’s refresh interval…';
  }

  function transformFor(point,source,destination){
    const [,travel,lift,turn,pitch,extra,,curve=0]=point;
    const sourceX=source.left+source.width/2, sourceY=source.top+source.height/2;
    const destinationX=destination.left+destination.width/2, destinationY=destination.top+destination.height/2;
    const routeX=destinationX-sourceX, routeY=destinationY-sourceY;
    const distance=Math.hypot(routeX,routeY)||1;
    const normalX=-routeY/distance, normalY=routeX/distance;
    const x=sourceX+routeX*travel+normalX*curve;
    const y=sourceY+routeY*travel+normalY*curve-lift;
    const sx=(source.width/destination.width+(1-source.width/destination.width)*travel)*extra;
    const sy=(source.height/destination.height+(1-source.height/destination.height)*travel)*extra;
    return 'perspective(800px) translate3d('+(x-destinationX)+'px,'+(y-destinationY)+'px,'+lift*.55+'px) rotateZ('+turn+'deg) rotateX('+pitch+'deg) scale('+sx+','+sy+')';
  }

  function sampleFlight(shell,runToken){
    const timestamps=[];
    const transforms=new Set();
    let stopped=false;
    function frame(now){
      if (stopped||runToken!==token) return;
      timestamps.push(now);
      if (shell.isConnected) transforms.add(getComputedStyle(shell).transform);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return ()=>{
      stopped=true;
      const intervals=timestamps.slice(1).map((time,index)=>time-timestamps[index]);
      const observed=refreshMs||median(intervals);
      const threshold=observed?observed*1.75:0;
      return {
        frames:timestamps.length,distinct:transforms.size,observed,
        longest:intervals.length?Math.max(...intervals):0,
        gaps:threshold?intervals.filter(value=>value>threshold).length:0
      };
    };
  }

  async function flyTo(targetCard,index,total,runToken){
    const returning=direction==='return';
    const source=returning?targetCard:availableDeckTop();
    const destination=returning?nextEmptyDeckLayer():targetCard;
    if (!source||!destination||source.style.opacity==='0'||runToken!==token) return false;
    const sourceRect=source.getBoundingClientRect();
    const destinationRect=destination.getBoundingClientRect();
    const choice=treatment();
    const resolved={points:choice.points,spin:0};
    const shell=document.createElement('div');
    shell.className='cfo-flight-shell';
    shell.style.left=destinationRect.left+'px';
    shell.style.top=destinationRect.top+'px';
    shell.style.width=destinationRect.width+'px';
    shell.style.height=destinationRect.height+'px';
    const shadow=document.createElement('div');
    shadow.className='cfo-flight-shadow';
    const card=source.cloneNode(false);
    card.className='card back small';
    shell.append(shadow,card);
    document.body.appendChild(shell);

    const frames=resolved.points.map(point=>{
      const frame={transform:transformFor(point,sourceRect,destinationRect),offset:point[0]};
      if (point[6]) frame.easing=point[6];
      return frame;
    });
    const duration=choice.duration*(playback==='slow'?2.5:1);
    const animation=shell.animate(frames,{duration,easing:'linear',fill:'both'});
    const shadowAnimation=shadow.animate([
      {opacity:.20,transform:'translate3d(0,2px,-1px) scale(.92)',offset:0},
      {opacity:.62,transform:'translate3d(7px,13px,-1px) scale(1.08)',offset:.30,easing:'ease-out'},
      {opacity:.45,transform:'translate3d(4px,8px,-1px) scale(1.03)',offset:.78,easing:'ease-in'},
      {opacity:.18,transform:'translate3d(0,3px,-1px) scale(1)',offset:1}
    ],{duration,easing:'linear',fill:'both'});
    const run={shell,animation,shadowAnimation,cancelled:false};
    active.add(run);
    stage.classList.add('is-running');
    if (returning) source.style.opacity='0';
    else source.style.visibility='hidden';
    $('cfo-status').textContent=total>1?(returning?'Returning ':'Dealing ')+(index+1)+' / '+total:choice.name;
    const stopSample=sampleFlight(shell,runToken);

    let completed=true;
    try{ await animation.finished; }catch(error){ completed=false; }
    const sample=stopSample();
    if (run.cancelled||runToken!==token) return false;

    const landing=shell.getBoundingClientRect();
    const drift=Math.hypot(
      landing.left+landing.width/2-(destinationRect.left+destinationRect.width/2),
      landing.top+landing.height/2-(destinationRect.top+destinationRect.height/2)
    );
    if (returning) destination.style.visibility='visible';
    else destination.style.opacity='1';
    shell.remove();
    try{ shadowAnimation.cancel(); }catch(error){}
    active.delete(run);
    stage.classList.toggle('is-running',active.size>0);
    $('cfo-readout').textContent=
      choice.name+(resolved.spin?' · '+Math.abs(resolved.spin)+'° '+(resolved.spin<0?'left':'right'):'')+' · '+Math.round(duration)+'ms · observed '+sample.observed.toFixed(2)+'ms · '+sample.frames+' frames / '+sample.distinct+
      ' distinct · longest '+sample.longest.toFixed(2)+'ms · '+sample.gaps+' significant gaps · landing drift '+drift.toFixed(2)+'px';
    return completed;
  }

  async function playOne(){
    resetStage();
    const runToken=token;
    const completed=await flyTo(targets[2],0,1,runToken);
    if (completed&&runToken===token) $('cfo-status').textContent=direction==='return'?'Stacked exactly':'Landed exactly';
    return completed;
  }

  async function playFive(){
    resetStage();
    const runToken=token;
    const order=direction==='return'?targets.slice().reverse():targets;
    for (let index=0;index<order.length;index++){
      if (!await flyTo(order[index],index,order.length,runToken)) return false;
      if (index<targets.length-1) await new Promise(resolve=>setTimeout(resolve,playback==='slow'?180:70));
    }
    if (runToken===token) $('cfo-status').textContent=direction==='return'?'Deck rebuilt cleanly':'Five clean landings';
    return true;
  }

  function paintSelection(){
    document.querySelectorAll('[data-direction]').forEach(button=>button.classList.toggle('active',button.dataset.direction===direction));
    $('cfo-replay').textContent=direction==='return'?'Return one':'Deal one';
    $('cfo-sequence').textContent=direction==='return'?'Return five':'Deal five';
  }

  async function measureRefresh(){
    const times=[];
    await new Promise(resolve=>{
      function frame(now){ times.push(now); times.length>=25?resolve():requestAnimationFrame(frame); }
      requestAnimationFrame(frame);
    });
    refreshMs=median(times.slice(1).map((time,index)=>time-times[index]));
    $('cfo-readout').textContent='Observed refresh interval '+refreshMs.toFixed(2)+'ms · choose a treatment and '+(direction==='return'?'return':'deal')+'.';
  }

  document.querySelectorAll('[data-direction]').forEach(button=>button.onclick=()=>{
    direction=button.dataset.direction;
    paintSelection();
    resetStage();
  });
  document.querySelectorAll('[data-speed]').forEach(button=>button.onclick=()=>{
    playback=button.dataset.speed;
    document.querySelectorAll('[data-speed]').forEach(item=>item.classList.toggle('active',item===button));
  });
  $('cfo-replay').onclick=playOne;
  $('cfo-sequence').onclick=playFive;
  $('cfo-cancel').onclick=resetStage;

  window.__cardFlightOptions={
    playOne,playFive,reset:resetStage,
    direction:name=>{ if (MOTION[name]){ direction=name; paintSelection(); resetStage(); } },
    state:()=>({direction,playback,active:active.size,flightCards:document.querySelectorAll('.cfo-flight-shell').length,visibleTargets:targets.filter(card=>card.style.opacity==='1').length,visibleDeckCards:Array.from(deck.children).filter(card=>card.style.visibility!=='hidden').length})
  };
  prepareScene();
  paintSelection();
  measureRefresh();
})();
