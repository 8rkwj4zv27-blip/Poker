"use strict";

(function(){
  const $=id=>document.getElementById(id);
  const stage=$('cfo-stage');
  const deck=$('cfo-deck');
  const targets=Array.from(document.querySelectorAll('.cfo-target>.card'));
  const active=new Set();
  let variant='dealer';
  let playback='normal';
  let token=0;
  let refreshMs=0;

  const VARIANTS={
    dealer:{
      name:'Dealer flick',duration:560,
      description:'A visible pickup and shallow hand-thrown arc, with restrained wrist movement and a precise landing.',
      points:[
        [0,0,0,0,0,1,'cubic-bezier(.38,0,.62,1)'],
        [.10,.025,8,-7,5,1.012,'cubic-bezier(.25,0,.48,.38)'],
        [.24,.16,23,-12,7,1.018,'cubic-bezier(.16,.05,.28,.74)'],
        [.68,.78,27,4,3,1.01,'cubic-bezier(.24,.58,.3,1)'],
        [.90,1,4,-2,0,1.004,'cubic-bezier(.18,.78,.22,1)'],
        [.96,1,-2,1,0,1.008,'cubic-bezier(.3,0,.7,1)'],
        [1,1,0,0,0,1,null]
      ]
    },
    casino:{
      name:'Casino pitch',duration:535,
      description:'A quicker, showier pitch with a higher arc and visible planar turn, caught flat at the destination.',
      points:[
        [0,0,0,0,0,1,'cubic-bezier(.38,0,.62,1)'],
        [.08,.025,7,-9,6,1.012,'cubic-bezier(.2,0,.45,.35)'],
        [.25,.22,22,22,7,1.02,'cubic-bezier(.12,.05,.24,.76)'],
        [.67,.82,19,68,3,1.012,'cubic-bezier(.28,.5,.34,1)'],
        [.89,1,4,11,0,1.004,'cubic-bezier(.16,.8,.22,1)'],
        [.96,1,-2,-2,0,1.009,'cubic-bezier(.3,0,.7,1)'],
        [1,1,0,0,0,1,null]
      ]
    },
    machine:{
      name:'Machine feed',duration:490,
      description:'A nearly straight mechanical feed: tiny pickup, decisive acceleration and a crisp slot-like stop.',
      points:[
        [0,0,0,0,0,1,'cubic-bezier(.42,0,.62,1)'],
        [.08,.02,3,-2,2,1.006,'cubic-bezier(.22,0,.48,.32)'],
        [.20,.12,5,-4,3,1.008,'cubic-bezier(.1,.03,.2,.78)'],
        [.72,.90,5,3,1,1.004,'cubic-bezier(.22,.7,.25,1)'],
        [.89,1,1,0,0,1,'cubic-bezier(.12,.86,.18,1)'],
        [.95,1,-2,0,0,1.01,'cubic-bezier(.3,0,.7,1)'],
        [1,1,0,0,0,1,null]
      ]
    }
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

  function resetStage(){
    cancelAll();
    buildDeck();
    targets.forEach(card=>{ card.style.opacity='0'; });
    $('cfo-deck-count').textContent='52';
    $('cfo-status').textContent='Ready';
  }

  function transformFor(point,source,destination){
    const [,travel,lift,turn,pitch,extra]=point;
    const sourceX=source.left+source.width/2, sourceY=source.top+source.height/2;
    const destinationX=destination.left+destination.width/2, destinationY=destination.top+destination.height/2;
    const x=sourceX+(destinationX-sourceX)*travel;
    const y=sourceY+(destinationY-sourceY)*travel-lift;
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

  async function flyTo(target,index,total,runToken){
    const source=availableDeckTop();
    if (!source||runToken!==token) return false;
    const sourceRect=source.getBoundingClientRect();
    const destinationRect=target.getBoundingClientRect();
    const treatment=VARIANTS[variant];
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

    const frames=treatment.points.map(point=>{
      const frame={transform:transformFor(point,sourceRect,destinationRect),offset:point[0]};
      if (point[6]) frame.easing=point[6];
      return frame;
    });
    const duration=treatment.duration*(playback==='slow'?2.5:1);
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
    source.style.visibility='hidden';
    $('cfo-deck-count').textContent=String(51-index);
    $('cfo-status').textContent=total>1?'Dealing '+(index+1)+' / '+total:treatment.name;
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
    target.style.opacity='1';
    shell.remove();
    try{ shadowAnimation.cancel(); }catch(error){}
    active.delete(run);
    stage.classList.toggle('is-running',active.size>0);
    $('cfo-readout').textContent=
      treatment.name+' · '+Math.round(duration)+'ms · observed '+sample.observed.toFixed(2)+'ms · '+sample.frames+' frames / '+sample.distinct+
      ' distinct · longest '+sample.longest.toFixed(2)+'ms · '+sample.gaps+' significant gaps · landing drift '+drift.toFixed(2)+'px';
    return completed;
  }

  async function dealOne(){
    resetStage();
    const runToken=token;
    const completed=await flyTo(targets[2],0,1,runToken);
    if (completed&&runToken===token) $('cfo-status').textContent='Landed exactly';
    return completed;
  }

  async function dealFive(){
    resetStage();
    const runToken=token;
    for (let index=0;index<targets.length;index++){
      if (!await flyTo(targets[index],index,targets.length,runToken)) return false;
      if (index<targets.length-1) await new Promise(resolve=>setTimeout(resolve,playback==='slow'?180:70));
    }
    if (runToken===token) $('cfo-status').textContent='Five clean landings';
    return true;
  }

  async function compareAll(){
    resetStage();
    const compareToken=token;
    for (const name of ['dealer','casino','machine']){
      if (compareToken!==token) return;
      variant=name; paintSelection();
      buildDeck(); targets.forEach(card=>card.style.opacity='0');
      const completed=await flyTo(targets[2],0,1,compareToken);
      if (!completed||compareToken!==token) return;
      await new Promise(resolve=>setTimeout(resolve,playback==='slow'?650:260));
    }
    if (compareToken===token) $('cfo-status').textContent='Comparison complete';
  }

  function paintSelection(){
    document.querySelectorAll('[data-variant]').forEach(button=>button.classList.toggle('active',button.dataset.variant===variant));
    $('cfo-variant-name').textContent=VARIANTS[variant].name;
    $('cfo-description').textContent=VARIANTS[variant].description;
  }

  async function measureRefresh(){
    const times=[];
    await new Promise(resolve=>{
      function frame(now){ times.push(now); times.length>=25?resolve():requestAnimationFrame(frame); }
      requestAnimationFrame(frame);
    });
    refreshMs=median(times.slice(1).map((time,index)=>time-times[index]));
    $('cfo-readout').textContent='Observed refresh interval '+refreshMs.toFixed(2)+'ms · choose a treatment and deal.';
  }

  document.querySelectorAll('[data-variant]').forEach(button=>button.onclick=()=>{
    cancelAll(); variant=button.dataset.variant; paintSelection(); dealOne();
  });
  document.querySelectorAll('[data-speed]').forEach(button=>button.onclick=()=>{
    playback=button.dataset.speed;
    document.querySelectorAll('[data-speed]').forEach(item=>item.classList.toggle('active',item===button));
  });
  $('cfo-replay').onclick=dealOne;
  $('cfo-sequence').onclick=dealFive;
  $('cfo-compare').onclick=compareAll;
  $('cfo-cancel').onclick=resetStage;

  window.__cardFlightOptions={
    dealOne,dealFive,compareAll,reset:resetStage,
    choose:name=>{ if (VARIANTS[name]){ variant=name; paintSelection(); } },
    state:()=>({variant,playback,active:active.size,flightCards:document.querySelectorAll('.cfo-flight-shell').length,visibleTargets:targets.filter(card=>card.style.opacity==='1').length,visibleDeckCards:Array.from(deck.children).filter(card=>card.style.visibility!=='hidden').length})
  };
  buildDeck();
  paintSelection();
  measureRefresh();
})();
