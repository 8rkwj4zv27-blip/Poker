"use strict";
// A staged visual study. Poker state exists only to render the original art.
(() => {
  const root=document.documentElement;
  const host=(()=>{try{return parent!==window?parent.__lab:null;}catch(e){return null;}  function fail(err){console.error('Perspective study:',err);const note=document.createElement('p');note.className='ps-caption';note.textContent='Study could not load — reload to retry.';$('app').appendChild(note);}
})();
  let view=host?.state.view||'perspective';
  const card=(rank,suit)=>({rank,suit,value:RANK_VALUES[rank]});
  function apply(){
    root.dataset.psView=view;
    if(host)host.set({view});
    document.querySelectorAll('[data-ps-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.psView===view)));
    document.getElementById('ps-caption').textContent=view==='perspective'?'PERSPECTIVE':'CURRENT VIEW';
  }
  function land(){
    const cards=[...document.querySelectorAll('#board > .card')];
    cards.forEach((el,i)=>{el.classList.remove('ps-land');void el.offsetWidth;el.style.setProperty('--ps-delay',i*110+'ms');el.classList.add('ps-land');});
  }
  function press(el){
    el.classList.remove('ps-press');void el.offsetWidth;el.classList.add('ps-press');
    setTimeout(()=>el.classList.remove('ps-press'),480);
  }
  async function start(){
    Object.assign(settings,{mode:'cash',gameType:'cash',opponents:3,stack:1000,blindLevel:0,lives:false,theme:'emerald',autoDeal:false,seenTour:true,coach:false,tableTalk:false,sound:false,cardBack:'crest'});
    applyRunTheme();TableIntro.uninstall();
    const realAI=aiDecide;
    aiDecide=async function(p,g){return {action:g.currentBet>p.betThisRound?'call':'check'};};
    startGame();
    const staged=game,deadline=performance.now()+30000;
    while(game===staged&&!(staged.phase==='flop'&&staged.board.length===3&&pendingHumanPlayer&&!$('actions-row').classList.contains('disabled'))&&performance.now()<deadline){
      if(staged.board.length===0&&pendingHumanPlayer&&!$('actions-row').classList.contains('disabled'))await humanAct(staged.currentBet>pendingHumanPlayer.betThisRound?'call':'check');
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    aiDecide=realAI;
    if(game!==staged||staged.board.length!==3)throw new Error('Staged flop could not load');
    staged.board=[card('K','♥'),card('Q','♥'),card('10','♣')];
    const human=staged.players.find(p=>p.isHuman);
    human.hand=[card('5','♥'),card('8','♦')];human._holeRevealed=[true,true];
    render();updateActionControls();
    const surface=document.createElement('div');surface.className='ps-surface';surface.setAttribute('aria-hidden','true');surface.innerHTML='<div class="ps-cloth"></div>';$('felt').prepend(surface);
    document.querySelectorAll('#felt .seat:not(.you)').forEach((el,i)=>el.dataset.psSeat=i);
    const lip=document.createElement('div');lip.className='ps-front';lip.setAttribute('aria-hidden','true');$('action-area').appendChild(lip);
    const control=document.createElement('button');control.className='ps-tune';control.textContent='TUNE';control.setAttribute('aria-label','Tune perspective study');$('app').appendChild(control);
    const caption=document.createElement('div');caption.id='ps-caption';caption.className='ps-caption';$('app').appendChild(caption);
    const shade=document.createElement('div');shade.className='ps-shade';shade.hidden=true;
    shade.innerHTML='<section class="ps-sheet" role="dialog" aria-modal="true" aria-labelledby="ps-title"><div class="ps-head"><h2 id="ps-title">VIEWPOINT STUDY · v0.66.1</h2><button aria-label="Close study controls">×</button></div><p>Same artwork. Same staged flop. Different construction.</p><div class="ps-options"><button data-ps-view="current">CURRENT</button><button data-ps-view="perspective">PERSPECTIVE</button></div><button class="ps-demo">REPLAY CARD LANDING</button><p>Tap any action key to feel its press. Keys do not play a hand in this visual study. Progress is not saved.</p></section>';
    $('app').appendChild(shade);
    const close=()=>{shade.hidden=true;control.focus();};
    control.onclick=()=>{shade.hidden=false;shade.querySelector('button').focus();};
    shade.querySelector('.ps-head button').onclick=close;
    shade.onclick=e=>{if(e.target===shade)close();const b=e.target.closest('[data-ps-view]');if(b){view=b.dataset.psView;apply();close();}};
    shade.querySelector('.ps-demo').onclick=()=>{close();land();};
    shade.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const bs=[...shade.querySelectorAll('button')],first=bs[0],last=bs.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    // Capture only this disposable scene. Original button finishes are retained.
    $('table-screen').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopImmediatePropagation();press(b);},true);
    $('table-screen').addEventListener('change',e=>{e.stopImmediatePropagation();},true);
    $('board').addEventListener('animationend',e=>e.target.classList.remove('ps-land'));
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(fail));else start().catch(fail);
  function fail(err){console.error('Perspective study:',err);const note=document.createElement('p');note.className='ps-caption';note.textContent='Study could not load — reload to retry.';$('app').appendChild(note);}
})();
