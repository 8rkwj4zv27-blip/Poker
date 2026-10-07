"use strict";
(() => {
  const host=(()=>{try{return parent !== window && parent.__lab ? parent.__lab : null;}catch(e){return null;}})();
  const state=host ? host.state : {look:'crafted',room:'back',motion:true,guided:true,sound:false,sheet:false};
  const root=document.documentElement;
  let sheet,key,canvas,plaque,resize,observer;
  const notes={
    current:'The shipped Emerald table. Same hand, same positions.',
    refined:'A · Refined. Quiet enamel, clearer depth, restrained metal and warmer cloth.',
    crafted:'B · Crafted. Velvet casing, a stitched padded rail and a dithered pool of light.'
  };
  const save=()=>{if(host) host.set(state);};
  function apply(){
    root.dataset.palLook=state.look;root.dataset.palRoom=state.room;
    root.dataset.palStill=String(!state.motion);
    settings.reduceMotion=!state.motion;settings.sound=state.sound;
    root.dataset.motion=state.motion?'on':'off';
    document.querySelectorAll('[data-pal-choice]').forEach(b=>{
      const [group,value]=b.dataset.palChoice.split(':');
      b.setAttribute('aria-pressed',String(String(state[group])===value));
    });
    const caption=document.getElementById('pal-description');if(caption)caption.textContent=notes[state.look];
    if(plaque)plaque.textContent=state.room==='high'?'HIGH ROLLER':'BACK ROOM';
    if(state.look==='current'||!state.motion)document.querySelectorAll('.pal-arrive').forEach(c=>c.classList.remove('pal-arrive'));
    paintCloth();save();
  }
  const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  const rgb=a=>'rgb('+a.join(',')+')';
  // Draw at the actual CSS pixel size. No filter, blur, per-frame repaint,
  // texture image scaling or realism: two-pixel authored colour clusters.
  function paintCloth(){
    if(!canvas)return;
    const r=canvas.parentElement.getBoundingClientRect();
    const w=Math.round(r.width),h=Math.round(r.height);if(!w||!h)return;
    canvas.width=w;canvas.height=h;
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    const high=state.room==='high',bold=state.look==='crafted';
    const dark=high?[13,35,33]:[20,44,31];
    const light=high?[34,77,68]:[53,87,54];
    const bayer=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    const round=(x,y,width,height,radius)=>{
      c.beginPath();c.roundRect(x,y,width,height,radius);c.fill();
    };
    const inset=bold?18:10;
    c.fillStyle=high?'#080f14':'#170e12';round(0,0,w,h,48);
    c.fillStyle=bold?(high?'#a79563':'#794a49'):(high?'#738379':'#687b55');round(2,2,w-4,h-4,46);
    c.fillStyle=bold?(high?'#253035':'#462832'):(high?'#253438':'#2b3c2b');round(4,4,w-8,h-8,44);
    if(bold){
      c.fillStyle=high?'#344245':'#58323a';round(6,6,w-12,h-12,42);
      c.fillStyle=high?'#111c22':'#2c1820';round(11,11,w-22,h-22,38);
      c.fillStyle=high?'#867750':'#7b5340';round(14,14,w-28,h-28,35);
    }
    c.fillStyle='#07130f';round(inset-2,inset-2,w-2*inset+4,h-2*inset+4,49-inset);
    c.save();c.beginPath();c.roundRect(inset,inset,w-inset*2,h-inset*2,49-inset);c.clip();
    for(let y=inset;y<h-inset;y+=2){
      for(let x=inset;x<w-inset;x+=2){
        const dx=(x-w*.5)/(w*.61),dy=(y-h*.54)/(h*.54);
        const strength=Math.max(0,1-dx*dx-dy*dy);
        const levels=bold?5:3;
        const v=strength*(bold?.88:.65)*levels;
        const step=(Math.floor(v)+(v%1>bayer[(y/2)%4][(x/2)%4]/16?1:0))/levels;
        const a=mix(dark,light,step);
        const weave=((x/2+y/2)%2===0)?1:0;
        c.fillStyle=rgb(a.map(n=>n+weave));c.fillRect(x,y,2,2);
      }
    }
    // Contact shade under the inner rail, deliberately in hard bands.
    for(let i=0;i<3;i++){
      c.strokeStyle=['#06150e44','#06150e22','#06150e11'][i];c.lineWidth=2;
      c.beginPath();c.roundRect(inset+1+i*2,inset+1+i*2,w-inset*2-2-i*4,h-inset*2-2-i*4,48-inset-i*2);c.stroke();
    }
    c.restore();
    c.strokeStyle=bold?(high?'#b6a27388':'#b4826977'):'#080d0a88';c.lineWidth=1;c.setLineDash([6,8]);
    const seam=bold?9:6;
    c.beginPath();c.roundRect(seam,seam,w-seam*2,h-seam*2,49-seam);c.stroke();c.setLineDash([]);
    canvas.style.opacity='1';
    // A few scratches on the outer material, never across playable felt.
    if(!high){c.fillStyle='#91675a';[[5,h*.32,2,9],[w-9,h*.65,2,5],[w*.38,5,8,1]].forEach(a=>c.fillRect(...a.map(Math.round)));}
  }
  function build(){
    key=document.createElement('button');key.className='pal-key';key.type='button';key.textContent='TUNE';key.setAttribute('aria-label','Tune visual experiment');
    document.getElementById('app').appendChild(key);
    sheet=document.createElement('div');sheet.className='pal-shade';sheet.hidden=true;
    const options=(group,values,two)=>'<div class="pal-options'+(two?' pal-two':'')+'">'+values.map(([v,t])=>'<button type="button" data-pal-choice="'+group+':'+v+'" aria-pressed="false">'+t+'</button>').join('')+'</div>';
    sheet.innerHTML='<section class="pal-sheet" role="dialog" aria-modal="true" aria-labelledby="pal-title"><div class="pal-head"><h2 id="pal-title">PIXEL ATMOSPHERE<br>EXPERIMENT · v0.66.1</h2><button class="pal-close" aria-label="Close experiment controls">×</button></div>'+ 
      '<p id="pal-description"></p><div class="pal-label">THE FINISH · SWITCH DURING PLAY</div>'+options('look',[['current','CURRENT'],['refined','A · REFINED'],['crafted','B · CRAFTED']])+ 
      '<div class="pal-label">THE ROOM</div>'+options('room',[['back','BACK ROOM'],['high','HIGH ROLLER']],true)+
      '<div class="pal-label">MOTION</div>'+options('motion',[['true','ANIMATED'],['false','REDUCED']],true)+
      '<div class="pal-label">SOUND</div>'+options('sound',[['false','OFF'],['true','ON']],true)+
      '<div class="pal-label">THE HAND</div>'+options('guided',[['true','GUIDED'],['false','NORMAL AI']],true)+
      '<p class="pal-note">Guided opponents check and call so you can explore a complete hand. Room choices change atmosphere, with identical stakes. This copy keeps no progress.</p>'+ 
      '<button type="button" class="pal-play">NEW HAND</button><div class="pal-note">Close this panel to play. Switch finishes at any time to compare the same hand.</div></section>';
    document.getElementById('app').appendChild(sheet);
    const close=()=>{sheet.hidden=true;state.sheet=false;save();key.focus();};
    key.onclick=()=>{sheet.hidden=false;state.sheet=true;save();sheet.querySelector('.pal-close').focus();};
    sheet.querySelector('.pal-close').onclick=close;
    sheet.addEventListener('click',e=>{
      if(e.target===sheet){close();return;}
      const b=e.target.closest('[data-pal-choice]');if(!b)return;
      const [group,value]=b.dataset.palChoice.split(':');
      state[group]=['motion','guided','sound'].includes(group)?value==='true':value;
      if(group==='sound'&&state.sound)Sound.unlock();
      apply();
    });
    sheet.addEventListener('keydown',e=>{
      if(e.key==='Escape'){close();return;}
      if(e.key!=='Tab')return;
      const buttons=[...sheet.querySelectorAll('button')];const first=buttons[0],last=buttons[buttons.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    });
    sheet.querySelector('.pal-play').onclick=()=>{state.sheet=false;save();if(host)host.play();else location.reload();};
    if(state.sheet)sheet.hidden=false;
  }
  function materials(){
    const felt=document.getElementById('felt');
    canvas=document.createElement('canvas');canvas.className='pal-material';canvas.setAttribute('aria-hidden','true');felt.prepend(canvas);
    plaque=document.createElement('div');plaque.className='pal-room';felt.appendChild(plaque);
    resize=new ResizeObserver(paintCloth);resize.observe(felt);
    // A tiny contact settle after the existing sprite turn. Leave its
    // flight, flip timing and winning-hand treatment untouched.
    const board=document.getElementById('board');
    board.addEventListener('animationend',e=>{if(e.animationName==='palCardLand')e.target.classList.remove('pal-arrive');});
    observer=new MutationObserver(records=>{
      if(state.look==='current'||!state.motion)return;
      for(const record of records){
        const card=record.target;
        if((record.oldValue||'').split(' ').includes('card-turning')&&!card.classList.contains('card-turning')&&card.classList.contains('card')&&!card.classList.contains('back'))card.classList.add('pal-arrive');
      }
    });
    observer.observe(board,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
  }
  async function start(){
    Object.assign(settings,{mode:'cash',gameType:'cash',opponents:3,stack:1000,blindLevel:0,lives:false,theme:'emerald',autoDeal:false,seenTour:true,coach:false,tableTalk:false,sound:state.sound,cardBack:'crest'});
    applyRunTheme();
    // This is a table-finishing experiment, not an arrival redesign.
    TableIntro.uninstall();
    build();apply();
    const realAI=aiDecide;
    aiDecide=async function(p,g){return state.guided?{action:g.currentBet>p.betThisRound?'call':'check'}:realAI.apply(this,arguments);};
    startGame();materials();apply();
    // Start on a real flop, with an ordinary pot and a decision to make.
    // The deck and settlement are unmodified. Only preflop player calls
    // are automated in the disposable demo, then control belongs to you.
    if(state.guided){
      const g=game,end=performance.now()+30000;
      while(game===g&&!g.over&&g.board.length===0&&performance.now()<end){
        if(pendingHumanPlayer&& !document.getElementById('actions-row').classList.contains('disabled')){
          await humanAct(g.currentBet>pendingHumanPlayer.betThisRound?'call':'check');
        }
        await new Promise(resolve=>setTimeout(resolve,80));
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(fail));else start().catch(fail);
  function fail(err){key.textContent='RETRY';key.onclick=()=>location.reload();console.error('Pixel atmosphere lab:',err);}
})();
