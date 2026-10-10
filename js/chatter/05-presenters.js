(function(global){
  'use strict';

  function node(cls){
    var el=document.createElement('div');
    el.className=cls;
    el.innerHTML='<span class="cht-copy-wrap"><span class="cht-copy"></span><i class="cht-cursor" aria-hidden="true"></i></span><i class="cht-tail" aria-hidden="true"></i>';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    return el;
  }
  function seatDirection(seat){
    var x=parseFloat(seat.root.style.left||'50');
    if(x<=12) return 'edge-left dir-right';
    if(x>=88) return 'edge-right dir-left';
    if(x<47) return 'dir-right';
    if(x>53) return 'dir-left';
    return 'dir-centre';
  }
  function speaker(ctx,id,on){
    var seat=ctx.seats[id];
    if(seat) seat.root.classList.toggle('cht-speaking',!!on);
  }
  function clearSpeakers(ctx){
    Object.keys(ctx.seats).forEach(function(id){
      ctx.seats[id].root.classList.remove('cht-speaking','cht-lane-seat');
    });
  }
  function lineCount(copy){
    if(!copy||!copy.firstChild||!global.document.createRange) return 1;
    var range=global.document.createRange(),tops=[];
    range.selectNodeContents(copy);
    Array.prototype.forEach.call(range.getClientRects(),function(rect){
      var top=Math.round(rect.top);
      if(tops.indexOf(top)===-1) tops.push(top);
    });
    return tops.length||1;
  }

  function bubblePresenter(spec){
    var ctx=null,items={};
    function itemFor(beat){
      var id=beat.resident.id,seat=ctx.seats[id],item=items[id];
      if(!seat) return null;
      if(!item){
        item=items[id]=node('cht-bubble');
        if(spec.family==='wide') ctx.felt.appendChild(item);
        else seat.root.appendChild(item);
      }
      item.className='cht-bubble cht-'+spec.family+' cht-'+spec.tone+' '+seatDirection(seat);
      item.style.setProperty('--speaker-x',parseFloat(seat.root.style.left||'50')+'%');
      item.dataset.candidate=spec.key;
      return item;
    }
    return {
      key:spec.key,
      family:spec.family,
      maxChars:spec.maxChars,
      mount:function(c){
        ctx=c;
        ctx.felt.classList.add('cht-mode-'+spec.key.toLowerCase(),'cht-family-'+spec.family);
        if(spec.family!=='wide') Object.keys(ctx.seats).forEach(function(id){
          var x=parseFloat(ctx.seats[id].root.style.left||'50');
          if(x>22&&x<78) ctx.seats[id].root.classList.add('cht-lane-seat');
        });
      },
      unmount:function(){
        this.clearAll();
        if(ctx) ctx.felt.classList.remove('cht-mode-'+spec.key.toLowerCase(),'cht-family-'+spec.family);
        ctx=null;
      },
      canFit:function(text){ return String(text).length<=spec.maxChars; },
      show:function(beat){
        var item=itemFor(beat); if(!item) return;
        item.querySelector('.cht-copy').textContent='';
        item.classList.remove('is-typing','cht-fit-fail');
        void item.offsetWidth;
        item.classList.add('is-in');
        speaker(ctx,beat.resident.id,true);
      },
      setText:function(beat,text,typing){
        var item=items[beat.resident.id]; if(!item) return;
        item.querySelector('.cht-copy').textContent=text;
        item.classList.toggle('is-typing',!!typing);
      },
      verifyFit:function(beat){
        var item=items[beat.resident.id]; if(!item) return false;
        var copy=item.querySelector('.cht-copy');
        return lineCount(copy)<=2 && copy.scrollWidth<=copy.clientWidth+1;
      },
      showFailure:function(beat){
        var item=itemFor(beat); if(!item) return;
        item.querySelector('.cht-copy').textContent='LINE TOO LONG FOR '+spec.key;
        item.classList.remove('is-typing');
        item.classList.add('cht-fit-fail','is-in');
        speaker(ctx,beat.resident.id,true);
      },
      hide:function(beat){
        var item=items[beat.resident.id]; if(item) item.classList.remove('is-in','is-typing');
        speaker(ctx,beat.resident.id,false);
      },
      clearAll:function(){
        Object.keys(items).forEach(function(id){ items[id].remove(); });
        items={};
        if(ctx) clearSpeakers(ctx);
      }
    };
  }

  var BUILD={
    E1:function(){ return bubblePresenter({key:'E1',family:'elastic',tone:'clean',maxChars:50}); },
    E2:function(){ return bubblePresenter({key:'E2',family:'elastic',tone:'paper',maxChars:50}); }
  };
  var META={
    E1:'Elastic / clean',E2:'Elastic / paper-backed'
  };
  global.ChatterPresenters={
    ORDER:['E1','E2'],
    create:function(key){ return (BUILD[key]||BUILD.E1)(); },
    meta:function(){ return this.ORDER.map(function(key){ return {key:key,name:META[key]}; }); }
  };
})(this);
