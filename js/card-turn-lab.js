"use strict";

(function(){
  const card={rank:'A',suit:'♥',value:14};
  const el=$('ctl-card');
  let mode='normal';
  let refreshMs=0;
  let lastSample=null;
  let replayToken=0;

  function median(values){
    if (!values.length) return 0;
    const sorted=values.slice().sort((a,b)=>a-b);
    const middle=Math.floor(sorted.length/2);
    return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
  }

  function sampleFrames(probe,token){
    const timestamps=[];
    const transforms=new Set();
    let stopped=false;
    function frame(now){
      if (stopped || token!==replayToken) return;
      timestamps.push(now);
      if (probe && probe.isConnected) transforms.add(getComputedStyle(probe).transform);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return {
      stop(){
        stopped=true;
        const intervals=timestamps.slice(1).map((time,index)=>time-timestamps[index]);
        const observed=refreshMs||median(intervals);
        const gapThreshold=observed ? observed*1.75 : 0;
        lastSample={
          observedRefreshMs:observed,
          animationFrames:timestamps.length,
          averageMs:intervals.length?intervals.reduce((sum,value)=>sum+value,0)/intervals.length:0,
          longestMs:intervals.length?Math.max(...intervals):0,
          significantGaps:gapThreshold?intervals.filter(value=>value>gapThreshold).length:0,
          distinctTransforms:transforms.size,
          gapThresholdMs:gapThreshold
        };
        return lastSample;
      }
    };
  }

  async function measureRefresh(){
    const times=[];
    await new Promise(resolve=>{
      function frame(now){
        times.push(now);
        if (times.length>=25) resolve(); else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    refreshMs=median(times.slice(1).map((time,index)=>time-times[index]));
    $('ctl-sampler').textContent='Observed refresh interval '+refreshMs.toFixed(2)+'ms · replay to sample the card turn.';
  }

  function applyMode(next){
    mode=next;
    settings.reduceMotion=next==='reduced';
    settings.speed=next==='fast'?'fast':next==='slow'?'relaxed':'normal';
    document.body.dataset.motion=settings.reduceMotion?'off':'on';
    document.querySelectorAll('[data-mode]').forEach(button=>button.classList.toggle('active',button.dataset.mode===next));
  }

  function resetCard(){
    DealFX.cancelAll();
    cancelAllCardTurns();
    el.style.opacity='';
    setCardTurnFinal(el,true,card,false);
  }

  function reportSample(label,sample){
    $('ctl-sampler').textContent=
      label+' · refresh '+sample.observedRefreshMs.toFixed(2)+'ms · animation frames '+sample.animationFrames+
      ' · average '+sample.averageMs.toFixed(2)+'ms · longest '+sample.longestMs.toFixed(2)+'ms · significant gaps '+sample.significantGaps+
      ' (>'+sample.gapThresholdMs.toFixed(2)+'ms) · distinct transforms '+sample.distinctTransforms+
      ' · active turns '+activeCardTurns.size+' · active flights '+DealFX.activeCount();
  }

  async function replay(){
    const token=++replayToken;
    resetCard();
    $('ctl-state').textContent=mode==='reduced'?'Reduced motion':'Turning · '+mode;
    const promise=turnCard(el,false,card,false,$('ctl-kind').value);
    const probe=el.querySelector('.card-turn-flipper');
    const sampler=sampleFrames(probe,token);
    const completed=await promise;
    const sample=sampler.stop();
    if (token!==replayToken) return false;
    $('ctl-state').textContent=completed?'Landed':'Cancelled · safely landed';
    if (mode==='reduced'){
      $('ctl-sampler').textContent='Reduced motion · immediate face-up state · 0 animation objects · '+activeCardTurns.size+' active turns.';
    } else {
      reportSample('Turn',sample);
    }
    return completed;
  }

  async function repeat(){
    for (let index=0;index<12;index++) await replay();
    $('ctl-state').textContent='12 turns · clean';
  }

  function cancelMidway(){
    replay();
    const expected=(CARD_TURN_TIMING[$('ctl-kind').value]||CARD_TURN_TIMING.hole)*(settings.speed==='fast'?.55:settings.speed==='relaxed'?1.35:1);
    setTimeout(()=>cancelAllCardTurns(),Math.max(1,Math.round(expected*.45)));
  }

  async function replayFlight(style){
    const token=++replayToken;
    resetCard();
    const returning=style==='return';
    const from=returning?el:$('ctl-deck');
    const to=returning?$('ctl-deck'):el;
    const duration=returning?DEAL_TIMING.collectMs:DEAL_TIMING.dealMs;
    $('ctl-state').textContent=(returning?'Returning':'Dealing')+' · '+mode;
    el.style.opacity='0';
    const promise=DealFX.flyGhost(from,to,{duration,style,rotate:returning?720:360});
    const probe=document.querySelector('.fly-card');
    if (mode==='reduced'){
      const completed=await promise;
      el.style.opacity='';
      if (token!==replayToken) return false;
      $('ctl-state').textContent='Reduced motion';
      $('ctl-sampler').textContent='Reduced motion · immediate destination state · 0 flight animation objects · '+DealFX.activeCount()+' active flights.';
      return completed;
    }
    const sampler=sampleFrames(probe,token);
    const completed=await promise;
    el.style.opacity='';
    const sample=sampler.stop();
    if (token!==replayToken) return false;
    $('ctl-state').textContent=completed?(returning?'Returned':'Dealt'):'Flight cancelled · clean';
    reportSample(returning?'Return':'Deal',sample);
    return completed;
  }

  function cancelFlightMidway(){
    replayFlight('deal');
    const expected=DEAL_TIMING.dealMs*(settings.speed==='fast'?.55:settings.speed==='relaxed'?1.35:1);
    setTimeout(()=>DealFX.cancelAll(),Math.max(1,Math.round(expected*.45)));
  }

  $('ctl-replay').onclick=replay;
  $('ctl-repeat').onclick=repeat;
  $('ctl-cancel').onclick=cancelMidway;
  $('ctl-deal').onclick=()=>replayFlight('deal');
  $('ctl-return').onclick=()=>replayFlight('return');
  $('ctl-cancel-flight').onclick=cancelFlightMidway;
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{ applyMode(button.dataset.mode); replay(); });
  window.__cardTurnLab={
    replay,repeat,cancelMidway,replayDeal:()=>replayFlight('deal'),replayReturn:()=>replayFlight('return'),cancelFlightMidway,
    mode:value=>{ applyMode(value); return replay(); },
    kind:value=>{ $('ctl-kind').value=value; return replay(); },
    state:()=>({mode,kind:$('ctl-kind').value,lastSample,activeTurns:activeCardTurns.size,activeFlights:DealFX.activeCount(),ghosts:document.querySelectorAll('.fly-card').length,className:el.className,label:el.getAttribute('aria-label'),faces:el.querySelectorAll('.card-turn-face').length})
  };
  applyMode('normal');
  resetCard();
  measureRefresh();
})();
