(function(){
  'use strict';

  var frame=document.getElementById('lab-frame');
  var phone=document.getElementById('lab-phone');
  var current=document.getElementById('lab-current');
  var line=document.getElementById('lab-line');
  var stage=null,pending=[];
  var device={w:393,h:852};
  var visual='E1',soundOn=true,lastSample='harry',seatCount=5;
  var NAMES={
    'E1':'ELASTIC / CLEAN','E2':'ELASTIC / PAPER-BACKED'
  };

  function withStage(fn){ if(stage) fn(stage); else pending.push(fn); }
  function activate(selector,node){
    document.querySelectorAll(selector).forEach(function(b){ b.classList.toggle('is-on',b===node); });
  }
  function fit(){
    phone.style.setProperty('--phone-w',device.w+'px');
    phone.style.setProperty('--phone-h',device.h+'px');
    var preview=document.querySelector('.lab-preview');
    var scale=Math.min(1,(preview.clientWidth-46)/device.w,(preview.clientHeight-82)/device.h);
    phone.style.setProperty('--phone-fit',Math.max(.46,scale).toFixed(3));
  }
  function fire(sample){
    withStage(function(s){
      var result=s.sample(sample);
      if(result&&result.key) lastSample=result.key;
      else lastSample=sample;
      if(result&&result.label) line.textContent=result.label;
    });
  }

  window.ChatterStageReady=function(api){
    if(stage) return;
    stage=api;
    stage.setVisual(visual);
    stage.setSoundEnabled(soundOn);
    pending.splice(0).forEach(function(fn){ fn(stage); });
    fire('harry');
  };
  function adopt(){
    if(stage) return true;
    try{
      var api=frame.contentWindow&&frame.contentWindow.ChatterStage;
      if(api){ window.ChatterStageReady(api); return true; }
    }catch(e){}
    return false;
  }
  frame.addEventListener('load',adopt);
  var attempts=0;
  var poll=setInterval(function(){ if(adopt()||++attempts>100) clearInterval(poll); },60);

  document.addEventListener('click',function(e){
    var b=e.target.closest('button');
    if(!b) return;
    if(b.dataset.visual){
      visual=b.dataset.visual;
      activate('[data-visual]',b);
      current.textContent=visual+' · '+NAMES[visual];
      withStage(function(s){ s.setVisual(visual); });
      fire(lastSample);
    }else if(b.dataset.sound){
      soundOn=b.dataset.sound!=='mute';
      activate('[data-sound]',b);
      withStage(function(s){ s.setSoundEnabled(soundOn); if(soundOn) s.replaySound(); });
    }else if(b.dataset.sample){
      fire(b.dataset.sample);
    }else if(b.dataset.device){
      var bits=b.dataset.device.split('x');
      device={w:parseInt(bits[0],10),h:parseInt(bits[1],10)};
      activate('[data-device]',b);
      fit();
    }
  });

  function key(k,e){
    if(e&&(e.metaKey||e.ctrlKey||e.altKey)) return;
    if(/^[1-2]$/.test(k)){
      var keys=['E1','E2'];
      document.querySelector('[data-visual="'+keys[parseInt(k,10)-1]+'"]').click();
    }else if(k==='m'||k==='M'){
      document.querySelector('[data-sound="'+(soundOn?'mute':'repeat')+'"]').click();
    }else if(k===' '||k==='Spacebar'){
      fire(lastSample);
      if(e) e.preventDefault();
    }else if(k==='['||k===']'){
      seatCount=Math.max(4,Math.min(6,seatCount+(k===']'?1:-1)));
      withStage(function(s){ s.setSeats(seatCount); });
      fire(lastSample);
    }
  }
  window.ChatterLabKey=key;
  document.addEventListener('keydown',function(e){ key(e.key,e); });
  window.addEventListener('resize',fit);
  fit();
})();
