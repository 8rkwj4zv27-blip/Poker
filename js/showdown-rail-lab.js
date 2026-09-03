/* ============================================================
   SHOWDOWN RAIL LAB — production-native deterministic presentation.

   This page mounts the real #table-screen DOM from index.html, then uses
   the shipped seat/card/chip/reel/CRT renderers against memory-only fixture
   state. It never loads the live UI wiring, starts a game, or calls a save.
   The five-card presentation is one awaited WAAPI timeline with one 22ms
   stagger source. Every cancellation path owns and clears its animations.
   ============================================================ */
(function(){
  'use strict';

  const TIMING=Object.freeze({
    settleMs:150,
    staggerMs:22,
    flightMinMs:440,
    flightMaxMs:520,
    treatmentMs:150,
    readableHoldMs:1050,
    clearMs:190
  });
  let fixture=SHOWDOWN_RAIL_FIXTURES[0];
  let model=null;
  let phase='loading';
  let runToken=0;
  let activeAnimations=new Set();
  let activeSampler=null;
  let lastSample=null;
  let fullInProgress=false;
  let storageBaseline='';

  function storageSnapshot(){
    const items={};
    for (let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      items[key]=localStorage.getItem(key);
    }
    return JSON.stringify(items,Object.keys(items).sort());
  }

  function setState(text,nextPhase){
    phase=nextPhase||phase;
    const el=$('sdr-state');
    if (el) el.textContent=text;
  }

  function controlsLocked(locked){
    ['sdr-fixture','sdr-theme','sdr-before','sdr-replay','sdr-full'].forEach(id=>{
      const el=$(id); if (el) el.disabled=!!locked;
    });
    document.querySelectorAll('[data-motion-choice]').forEach(el=>{ el.disabled=!!locked; });
  }

  function track(animation){
    activeAnimations.add(animation);
    return animation.finished.then(
      ()=>{ activeAnimations.delete(animation); return true; },
      ()=>{ activeAnimations.delete(animation); return false; }
    );
  }

  function cancelActivePresentation(){
    runToken++;
    if (activeSampler) activeSampler.stop();
    activeSampler=null;
    activeAnimations.forEach(animation=>{ try{ animation.cancel(); }catch(e){} });
    activeAnimations.clear();
    document.querySelectorAll('.sdr-source-card').forEach(el=>{
      el.style.visibility='';
      el.classList.remove('sdr-unused-source');
    });
    document.querySelectorAll('.sdr-winner-seat').forEach(el=>el.classList.remove('sdr-winner-seat'));
    const lane=$('sdr-inspection-lane');
    if (lane){
      lane.className='sdr-inspection-lane';
      const destinations=$('sdr-destinations');
      if (destinations) destinations.replaceChildren();
    }
    document.querySelectorAll('.score-smash-layer,.chip-physics-layer').forEach(el=>el.remove());
  }

  function waitFrame(){ return new Promise(resolve=>requestAnimationFrame(resolve)); }

  function waitOnTimeline(ms,token){
    const lane=$('sdr-inspection-lane');
    if (!lane || token!==runToken) return Promise.resolve(false);
    const animation=lane.animate([{opacity:1},{opacity:1}],{duration:ms,fill:'none'});
    return track(animation);
  }

  function startFrameSampler(probe,token){
    const timestamps=[];
    const transforms=new Set();
    let running=true,raf=0;
    function sample(now){
      if (!running || token!==runToken) return;
      timestamps.push(now);
      if (probe && probe.isConnected) transforms.add(getComputedStyle(probe).transform);
      raf=requestAnimationFrame(sample);
    }
    raf=requestAnimationFrame(sample);
    return {
      stop(){
        if (!running) return lastSample;
        running=false; cancelAnimationFrame(raf);
        const intervals=timestamps.slice(1).map((n,i)=>n-timestamps[i]);
        const total=intervals.reduce((n,v)=>n+v,0);
        lastSample={
          frames:timestamps.length,
          averageMs:intervals.length?total/intervals.length:0,
          longestMs:intervals.length?Math.max(...intervals):0,
          over34:intervals.filter(v=>v>34).length,
          distinctTransforms:transforms.size
        };
        const out=$('sdr-sampler');
        if (out) out.textContent='Frames '+lastSample.frames+' · avg '+lastSample.averageMs.toFixed(1)+'ms · longest '+lastSample.longestMs.toFixed(1)+'ms · >34ms '+lastSample.over34+' · transforms '+lastSample.distinctTransforms;
        return lastSample;
      }
    };
  }

  function productionCard(card,faceDown,className){
    const el=document.createElement('div');
    el.className=cardClass(faceDown,card,false)+(className?' '+className:'');
    el.setAttribute('role','img');
    el.setAttribute('aria-label',cardLabel(faceDown,card));
    if (!faceDown) el.innerHTML=cardInner(card);
    return el;
  }

  async function mountProductionTable(){
    const response=await fetch('index.html',{cache:'no-store'});
    if (!response.ok) throw new Error('Could not load production table markup');
    const doc=new DOMParser().parseFromString(await response.text(),'text/html');
    const source=doc.querySelector('#table-screen');
    if (!source) throw new Error('Production #table-screen was not found');
    const screen=document.importNode(source,true);
    screen.classList.remove('hidden');
    screen.classList.add('sdr-preview-table');
    screen.setAttribute('aria-label','Production table showdown preview');
    $('sdr-production-mount').replaceWith(screen);
    screen.querySelectorAll('button,input,select').forEach(el=>{ el.disabled=true; el.tabIndex=-1; });
    const lane=document.createElement('div');
    lane.className='sdr-inspection-lane';
    lane.id='sdr-inspection-lane';
    lane.setAttribute('aria-label','Arranged winning five cards');
    lane.innerHTML='<div class="sdr-destinations" id="sdr-destinations"></div>';
    $('felt').appendChild(lane);
  }

  function fixturePlayer(raw,index){
    return {
      id:raw.id,name:raw.name,isHuman:raw.isHuman,hand:raw.hole.slice(),chips:raw.isHuman?980:1120,
      inHand:true,folded:false,allIn:true,eliminated:false,betThisRound:0,totalBetHand:raw.isHuman?180:220,
      streetAction:{type:'allin',label:'All-In'},_holeRevealed:[true,true],_reveal:!raw.hidden,
      faceColorIdx:index%6,personality:{thinkSpeed:1}
    };
  }

  function tagSourceCards(container,cards,source){
    Array.from(container.children).forEach((el,index)=>{
      const card=cards[index]; if (!card) return;
      el.classList.remove('deal-anim','flip-in','flip-out');
      el.classList.add('sdr-source-card');
      el.dataset.cardSource=source;
      el.dataset.cardKey=cardKey(card);
    });
  }

  function renderFixtureState(){
    cancelActivePresentation();
    lastSample=null;
    settings.sound=false;
    settings.haptics=false;
    settings.faces=true;
    settings.reduceMotion=document.body.dataset.motion==='off';
    _bankPile=null; _potPile=null;
    bankPending=0; potPending=0; humanBankDisplayFreeze=null;
    const players=fixture.players.map(fixturePlayer);
    const human=players.find(p=>p.isHuman);
    game={
      mode:'elimination',phase:'showdown',over:false,handNumber:42,smallBlind:10,bigBlind:20,
      players,board:fixture.board.slice(),pot:model.award.amount,currentIndex:-1,currentBet:220,
      positions:Object.fromEntries(players.map((p,i)=>[p.id,i===0?'BTN':i===1?'BB':'SB'])),
      run:{arcade:makeArcadeRunState()}
    };
    initSeats();
    renderBank();
    renderPot();
    $('pot-area').classList.remove('hidden');
    $('pot-val').textContent=game.pot.toLocaleString();
    syncCardRow($('board'),game.board,game.board.map(()=>false),false,'board');
    tagSourceCards($('board'),game.board,'board');
    players.forEach(player=>{
      const seat=seatEls[player.id];
      if (!seat) return;
      if (!player.isHuman) updateSeatReels(seat.chips,player.chips);
      syncCardRow(seat.cardsContainer,player.hand,player.isHuman?player.hand.map(()=>false):player.hand.map(()=>!player._reveal),!player.isHuman,'hole');
      tagSourceCards(seat.cardsContainer,player.hand,player.id);
      if (seat.actionSlot){ seat.actionSlot.className='action-slot act-allin'; seat.actionSlot.textContent='All-In'; }
    });
    updateJackpot(human.chips);
    updateInvestedReel(human.totalBetHand);
    setArcadeMode(true);
    updateArcadeHUD();
    $('table-meta').textContent='Hand 42 · 10/20 · Showdown fixture';
    paintCRT($('hand-strength'),'<b>Showdown locked</b>',false);
    paintCRT($('banner'),actionRowsHTML('SHOWDOWN','VERIFYING FIVE',false),false);
    $('actions-row').classList.add('disabled');
    $('sdr-note').textContent=fixture.note;
    $('sdr-sampler').textContent='Frame sampler waits for a replay.';
    setState('Before showdown','before');
    controlsLocked(false);
  }

  function sourceFor(card){
    return document.querySelector('.sdr-source-card[data-card-source="'+card.source+'"][data-card-key="'+card.key+'"]');
  }

  function buildDestinations(){
    const fragment=document.createDocumentFragment();
    const entries=model.cards.map((card,index)=>{
      const source=sourceFor(card);
      const startsDown=!!(source&&source.classList.contains('back'));
      const shell=document.createElement('div');
      shell.className='sdr-destination-card';
      shell.dataset.cardKey=card.key;
      shell.dataset.source=card.source;
      shell.dataset.treatment=card.treatment;
      shell.dataset.faceDown=String(startsDown);
      const flipper=document.createElement('div');
      flipper.className='sdr-flight-flipper';
      if (startsDown) flipper.appendChild(productionCard(card,true,'sdr-flight-face sdr-flight-back'));
      flipper.appendChild(productionCard(card,false,'sdr-flight-face sdr-flight-front'));
      shell.appendChild(flipper);
      fragment.appendChild(shell);
      return {card,index,source,shell,flipper,startsDown,animations:[]};
    });
    $('sdr-destinations').replaceChildren(fragment);
    return entries;
  }

  function winnerTargets(){
    return model.winnerIds.map(id=>seatEls[id]&&seatEls[id].root).filter(Boolean);
  }

  async function animateTableSettle(reduced,token){
    const winnerIds=new Set(model.winnerIds);
    const unused=Array.from(document.querySelectorAll('.sdr-source-card')).filter(el=>{
      const source=el.dataset.cardSource;
      const key=el.dataset.cardKey;
      return !model.cards.some(card=>card.source===source&&card.key===key);
    });
    const motions=[];
    if (reduced){
      unused.forEach(el=>el.classList.add('sdr-unused-source'));
      winnerTargets().forEach(root=>root.classList.add('sdr-winner-seat'));
      document.querySelectorAll('.seat').forEach(root=>{
        const id=Object.keys(seatEls).find(key=>seatEls[key].root===root);
        if (!winnerIds.has(id)) root.style.opacity='.88';
      });
      return token===runToken;
    }
    unused.forEach(el=>{
      const animation=el.animate([{opacity:1},{opacity:.68}],{duration:TIMING.settleMs,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
      motions.push(track(animation).then(ok=>{ if(ok&&token===runToken){el.classList.add('sdr-unused-source');animation.cancel();} }));
    });
    winnerTargets().forEach(root=>{
      root.classList.add('sdr-winner-seat');
      const target=root.querySelector('.seat-card')||root.querySelector('.seat-cards')||root;
      const animation=target.animate([
        {transform:'translateY(0) scale(1)'},
        {transform:'translateY(-2px) scale(1.018)',offset:.46},
        {transform:'translateY(0) scale(1)'}
      ],{duration:520,easing:'cubic-bezier(.2,.75,.3,1)',fill:'none'});
      motions.push(track(animation));
    });
    document.querySelectorAll('.seat').forEach(root=>{
      const id=Object.keys(seatEls).find(key=>seatEls[key].root===root);
      if (!winnerIds.has(id)) root.style.opacity='.88';
    });
    await Promise.all(motions);
    return token===runToken;
  }

  function flightDuration(from,to){
    const distance=Math.hypot((from.left+from.width/2)-(to.left+to.width/2),(from.top+from.height/2)-(to.top+to.height/2));
    return Math.max(TIMING.flightMinMs,Math.min(TIMING.flightMaxMs,Math.round(440+distance*.12)));
  }

  async function animateWinningFive(entries,token){
    const geometry=entries.map(entry=>({
      from:entry.source&&entry.source.getBoundingClientRect(),
      to:entry.shell.getBoundingClientRect()
    }));
    entries.forEach((entry,index)=>{
      const geo=geometry[index];
      if (!geo.from||!geo.from.width||!geo.to.width) return;
      const dx=geo.from.left-geo.to.left,dy=geo.from.top-geo.to.top;
      const sx=geo.from.width/geo.to.width,sy=geo.from.height/geo.to.height;
      const duration=flightDuration(geo.from,geo.to);
      const delay=index*TIMING.staggerMs;
      entry.shell.classList.add('is-ready');
      entry.shell.style.transform='translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')';
      entry.shell.style.willChange='transform';
      entry.flipper.style.willChange=entry.startsDown?'transform':'';
      if (entry.source) entry.source.style.visibility='hidden';
      const flight=entry.shell.animate([
        {transform:'translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')',offset:0,easing:'cubic-bezier(.32,0,.55,.35)'},
        {transform:'translate('+(dx*.91)+'px,'+(dy*.91-9)+'px) scale('+(sx*1.035)+','+(sy*1.035)+')',offset:.18,easing:'cubic-bezier(.18,.7,.24,1)'},
        {transform:'translate('+(dx*.10)+'px,'+(dy*.08-5)+'px) scale(1.015)',offset:.82,easing:'cubic-bezier(.2,.72,.24,1)'},
        {transform:'translate(0,-2px) scale(1.01)',offset:.95,easing:'cubic-bezier(.2,.75,.3,1)'},
        {transform:'translate(0,0) scale(1)',offset:1}
      ],{duration,delay,easing:'linear',fill:'both'});
      entry.animations.push(flight);
      if (entry.startsDown){
        const flip=entry.flipper.animate([
          {transform:'rotateY(0deg)',offset:0},
          {transform:'rotateY(0deg)',offset:.30,easing:'cubic-bezier(.3,0,.7,1)'},
          {transform:'rotateY(180deg)',offset:.72},
          {transform:'rotateY(180deg)',offset:1}
        ],{duration,delay,easing:'linear',fill:'both'});
        entry.animations.push(flip);
      }
    });
    const cardAnimations=entries.flatMap(entry=>entry.animations);
    activeSampler=startFrameSampler(entries[0]&&entries[0].shell,token);
    const finished=await Promise.all(cardAnimations.map(track));
    if (activeSampler){ activeSampler.stop(); activeSampler=null; }
    if (token!==runToken||finished.some(ok=>!ok)) return false;
    entries.forEach(entry=>{
      entry.shell.style.transform='none';
      entry.shell.style.willChange='';
      entry.flipper.style.transform=entry.startsDown?'rotateY(180deg)':'none';
      entry.flipper.style.willChange='';
      entry.animations.forEach(animation=>animation.cancel());
    });
    return true;
  }

  async function revealReduced(entries,token){
    entries.forEach(entry=>{
      entry.shell.classList.add('is-ready');
      entry.flipper.style.transform=entry.startsDown?'rotateY(180deg)':'none';
      if (entry.source) entry.source.style.visibility='hidden';
    });
    const lane=$('sdr-inspection-lane');
    const fade=lane.animate([{opacity:0},{opacity:1}],{duration:180,easing:'cubic-bezier(.2,.7,.3,1)',fill:'both'});
    const ok=await track(fade);
    if (ok&&token===runToken){ lane.style.opacity='1'; fade.cancel(); }
    lastSample={frames:0,averageMs:0,longestMs:0,over34:0,distinctTransforms:0,reduced:true};
    $('sdr-sampler').textContent='Reduced motion · direct crossfade · no travelling-card transforms.';
    return ok&&token===runToken;
  }

  function settlePresentation(){
    const lane=$('sdr-inspection-lane');
    lane.classList.add('is-settled');
    paintCRT($('hand-strength'),'<b>'+esc(model.handName)+'</b>',false);
    paintCRT($('banner'),'<span class="crt-line-primary">'+esc((model.winnerLabel+' · '+model.handName).toUpperCase())+'</span>',false);
    setState('Settled · '+model.handName,'settled');
  }

  async function clearWinningFive(token){
    const lane=$('sdr-inspection-lane');
    lane.classList.add('is-clearing');
    const fade=lane.animate([{opacity:1},{opacity:0}],{duration:TIMING.clearMs,easing:'cubic-bezier(.4,0,.7,1)',fill:'forwards'});
    const ok=await track(fade);
    if (!ok||token!==runToken) return false;
    fade.cancel();
    lane.className='sdr-inspection-lane';
    $('sdr-destinations').replaceChildren();
    document.querySelectorAll('.sdr-source-card').forEach(el=>{ el.style.visibility=''; });
    return true;
  }

  async function runProductionPayout(token){
    if (token!==runToken) return;
    paintCRT($('banner'),actionRowsHTML('POT SYSTEM','COLLECTING',false),false);
    const winners=model.winnerIds.map(id=>game.players.find(p=>p.id===id)).filter(Boolean);
    const human=game.players.find(p=>p.isHuman);
    const amountEach=Math.floor(model.award.amount/Math.max(1,winners.length));
    winners.forEach(player=>{ player.chips+=amountEach; });
    const visible=Math.max(1,$('pot-stacks')._chipCount||0);
    const humanWinner=winners.find(player=>player.isHuman);
    const others=winners.filter(player=>!player.isHuman);
    let remaining=visible;
    for (let i=0;i<others.length;i++){
      const count=humanWinner?Math.max(1,Math.floor(visible/winners.length)):(i===others.length-1?remaining:Math.max(1,Math.floor(visible/winners.length)));
      remaining=Math.max(0,remaining-count);
      await payoutTo(others[i],count);
      updateSeatReels(seatEls[others[i].id].chips,others[i].chips);
    }
    if (humanWinner&&remaining>0){
      await runPotSmashSequence({potN:remaining,scoreTotal:Math.max(100,Math.round(model.award.amount/4)),human});
      updateJackpot(human.chips);
    }
    game.pot=0;
    $('pot-val').textContent='0';
    $('pot-area').classList.add('hidden');
    paintCRT($('banner'),actionRowsHTML('PAYOUT COMPLETE',model.split?'SPLIT POT SETTLED':'CHIPS SETTLED',false),false);
    setState('Full sequence complete','complete');
  }

  async function replay(full){
    if (fullInProgress) return;
    renderFixtureState();
    model=buildShowdownRailModel(fixture);
    const token=runToken;
    const reduced=settings.reduceMotion;
    controlsLocked(true);
    setState(reduced?'Reduced-motion reveal':'Cards assembling','playing');
    paintCRT($('banner'),actionRowsHTML('SHOWDOWN','VERIFYING FIVE',false),false);
    const lane=$('sdr-inspection-lane');
    const entries=buildDestinations();
    lane.classList.add('is-present');
    const settlePromise=animateTableSettle(reduced,token);
    await waitFrame();
    const cardsReady=reduced?await revealReduced(entries,token):await animateWinningFive(entries,token);
    await settlePromise;
    if (!cardsReady||token!==runToken) return;
    settlePresentation();
    const held=await waitOnTimeline(TIMING.readableHoldMs,token);
    if (!held||token!==runToken) return;
    if (full){
      fullInProgress=true;
      if (await clearWinningFive(token)) await runProductionPayout(token);
      fullInProgress=false;
    }
    controlsLocked(false);
  }

  function setMotion(value){
    if (fullInProgress) return;
    document.body.dataset.motion=value;
    settings.reduceMotion=value==='off';
    document.querySelectorAll('[data-motion-choice]').forEach(button=>{
      const active=button.dataset.motionChoice===value;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    replay(false);
  }

  async function selectFixture(id){
    if (fullInProgress) return;
    fixture=showdownRailFixtureById(id);
    model=buildShowdownRailModel(fixture);
    renderFixtureState();
    await replay(false);
  }

  async function init(){
    storageBaseline=storageSnapshot();
    await mountProductionTable();
    const picker=$('sdr-fixture');
    SHOWDOWN_RAIL_FIXTURES.forEach(item=>{
      const option=document.createElement('option');
      option.value=item.id; option.textContent=item.name; picker.appendChild(option);
    });
    picker.onchange=()=>selectFixture(picker.value);
    $('sdr-theme').onchange=event=>{ document.body.dataset.theme=event.target.value; };
    $('sdr-before').onclick=()=>{ if(!fullInProgress){ model=buildShowdownRailModel(fixture); renderFixtureState(); } };
    $('sdr-replay').onclick=()=>replay(false);
    $('sdr-full').onclick=()=>replay(true);
    document.querySelectorAll('[data-motion-choice]').forEach(button=>{ button.onclick=()=>setMotion(button.dataset.motionChoice); });
    model=buildShowdownRailModel(fixture);
    renderFixtureState();
    await replay(false);
    window.__showdownRailLab={
      fixtureIds:SHOWDOWN_RAIL_FIXTURES.map(item=>item.id),
      select:selectFixture,
      replay:()=>replay(false),
      full:()=>replay(true),
      before:()=>{ model=buildShowdownRailModel(fixture); renderFixtureState(); },
      state:()=>({fixture:fixture.id,phase,motion:document.body.dataset.motion,model,lastSample,activeAnimations:activeAnimations.size,storageUnchanged:storageSnapshot()===storageBaseline}),
      timing:TIMING
    };
  }

  init().catch(error=>{
    console.error('[showdown-rail-lab]',error);
    setState('Prototype failed to mount','error');
  });
})();
