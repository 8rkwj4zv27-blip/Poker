/* ============================================================
   SHOWDOWN RAIL LAB — isolated deterministic presentation harness.

   Visual clones travel from fixture-owned source cards into the rail. The
   source DOM never moves, and this page loads no live game engine, settlement,
   save, AI, pot-award or hand-cleanup code.
   ============================================================ */
(function(){
  'use strict';

  var timers=[];
  var fixture=SHOWDOWN_RAIL_FIXTURES[0];
  var model=null;
  var phase='before';

  function $(id){ return document.getElementById(id); }
  function later(fn,ms){ var id=setTimeout(fn,ms); timers.push(id); return id; }
  function clearTimers(){ timers.forEach(clearTimeout); timers=[]; }
  function escText(value){ return String(value); }

  function sourceCard(card,faceDown,small,source){
    var el=document.createElement('div');
    el.className=cardClass(faceDown,card,small);
    el.dataset.cardKey=cardKey(card);
    el.dataset.cardSource=source;
    el.setAttribute('role','img');
    el.setAttribute('aria-label',cardLabel(faceDown,card));
    if (!faceDown) el.innerHTML=cardInner(card);
    return el;
  }

  function seatHTML(player,index){
    var seat=document.createElement('section');
    seat.className='sdr-seat '+(player.isHuman?'is-human':'is-opponent');
    seat.dataset.playerId=player.id;
    if (!player.isHuman) seat.style.setProperty('--seat-index',String(index));
    var name=document.createElement('strong');
    name.className='sdr-seat-name';
    name.textContent=player.isHuman?'YOU':player.name.toUpperCase();
    var avatar=document.createElement('div');
    avatar.className='sdr-avatar';
    avatar.innerHTML='<img src="assets/faces/legacy-idle.jpg" alt="">';
    var chips=document.createElement('span');
    chips.className='sdr-seat-stack tabular';
    chips.textContent=player.isHuman?'$980':'$1,120';
    var cards=document.createElement('div');
    cards.className='sdr-hole-cards';
    player.hole.forEach(function(card){
      cards.appendChild(sourceCard(card,!player.isHuman&&player.hidden,true,player.id));
    });
    seat.appendChild(name);
    if (!player.isHuman) seat.appendChild(avatar);
    seat.appendChild(chips);
    seat.appendChild(cards);
    return seat;
  }

  function renderFixture(){
    clearTimers();
    model=buildShowdownRailModel(fixture);
    phase='before';
    document.body.dataset.motion=document.body.dataset.motion||'on';
    $('sdr-note').textContent=fixture.note;
    $('sdr-pot').textContent=model.award.text;
    $('sdr-state').textContent='Before showdown';
    $('sdr-replay').disabled=false;

    var seats=$('sdr-seats');
    seats.replaceChildren();
    var opponentIndex=0;
    fixture.players.forEach(function(player){
      seats.appendChild(seatHTML(player,player.isHuman?0:opponentIndex++));
    });
    seats.style.setProperty('--opponents',String(opponentIndex));

    var board=$('sdr-board');
    board.replaceChildren();
    fixture.board.forEach(function(card){ board.appendChild(sourceCard(card,false,false,'board')); });
    resetPresentation();
  }

  function resetPresentation(){
    clearTimers();
    phase='before';
    var table=$('sdr-table'), rail=$('sdr-rail');
    table.classList.remove('is-settling','is-result','is-reduced');
    rail.classList.remove('is-armed','is-settled');
    $('sdr-rail-cards').replaceChildren();
    $('sdr-winner').textContent='';
    $('sdr-hand').textContent='';
    $('sdr-award').textContent='';
    document.querySelectorAll('.sdr-winning-source,.sdr-source-lifted,.is-award-winner').forEach(function(el){
      el.classList.remove('sdr-winning-source','sdr-source-lifted','is-award-winner');
    });
    $('sdr-state').textContent='Before showdown';
    $('sdr-replay').disabled=false;
  }

  function sourceFor(card){
    return document.querySelector('[data-card-source="'+card.source+'"][data-card-key="'+card.key+'"]');
  }

  function faceRailCard(shell,card){
    var face=shell.querySelector('.sdr-card-face');
    face.className=cardClass(false,card,false)+' sdr-card-face';
    face.innerHTML=cardInner(card);
    face.setAttribute('aria-label',cardLabel(false,card));
  }

  function buildRailCards(reduced){
    var railCards=$('sdr-rail-cards');
    railCards.replaceChildren();
    var fragment=document.createDocumentFragment();
    var entries=model.cards.map(function(card,index){
      var source=sourceFor(card);
      if (source) source.classList.add('sdr-winning-source');
      var shell=document.createElement('div');
      shell.className='sdr-rail-card';
      shell.dataset.cardKey=card.key;
      shell.dataset.source=card.source;
      shell.dataset.treatment=card.treatment;
      shell.style.setProperty('--stagger',String(index));
      var startsDown=!!(source&&source.classList.contains('back'));
      var face=sourceCard(card,startsDown,false,card.source);
      face.classList.add('sdr-card-face');
      shell.appendChild(face);
      fragment.appendChild(shell);
      return {card:card,index:index,source:source,shell:shell,startsDown:startsDown};
    });
    railCards.appendChild(fragment);

    if (reduced){
      entries.forEach(function(entry){
        faceRailCard(entry.shell,entry.card);
        entry.shell.classList.add('is-reduced-ready');
        later(function(){ if (entry.source) entry.source.classList.add('sdr-source-lifted'); },40);
      });
      return;
    }

    var geometry=entries.map(function(entry){
      return {
        from:entry.source?entry.source.getBoundingClientRect():null,
        to:entry.shell.getBoundingClientRect()
      };
    });
    entries.forEach(function(entry){
      var card=entry.card, index=entry.index, source=entry.source, shell=entry.shell;
      if (source){
        var from=geometry[index].from, to=geometry[index].to;
        shell.style.setProperty('--from-x',(from.left-to.left)+'px');
        shell.style.setProperty('--from-y',(from.top-to.top)+'px');
        shell.style.setProperty('--from-sx',String(from.width/Math.max(1,to.width)));
        shell.style.setProperty('--from-sy',String(from.height/Math.max(1,to.height)));
        shell.classList.add('is-at-source');
      }
      later(function(){
        if (source) source.classList.add('sdr-source-lifted');
        shell.classList.add('is-flying');
      },190+index*55);
      if (entry.startsDown){
        later(function(){
          shell.classList.add('is-turning');
          later(function(){ faceRailCard(shell,card); shell.classList.remove('is-turning'); },95);
        },460+index*35);
      }
    });
  }

  function showResult(){
    $('sdr-winner').textContent=model.winnerLabel;
    $('sdr-hand').textContent=model.handName;
    $('sdr-award').textContent=model.award.text;
    $('sdr-table').classList.add('is-result');
    $('sdr-rail').classList.add('is-settled');
    $('sdr-state').textContent='Settled · '+model.handName;
    phase='settled';
  }

  function replay(){
    resetPresentation();
    model=buildShowdownRailModel(fixture);
    var reduced=document.body.dataset.motion==='off';
    phase='playing';
    $('sdr-state').textContent=reduced?'Reduced-motion reveal':'Showdown in motion';
    $('sdr-replay').disabled=true;
    model.winnerIds.forEach(function(id){
      var seat=document.querySelector('[data-player-id="'+id+'"]');
      if (seat) seat.classList.add('is-award-winner');
    });
    $('sdr-table').classList.add('is-settling');
    if (reduced) $('sdr-table').classList.add('is-reduced');
    $('sdr-rail').classList.add('is-armed');
    buildRailCards(reduced);
    later(showResult,reduced?140:900);
    later(function(){ $('sdr-replay').disabled=false; },reduced?550:1450);
  }

  function setMotion(value){
    document.body.dataset.motion=value;
    document.querySelectorAll('[data-motion-choice]').forEach(function(button){
      var active=button.dataset.motionChoice===value;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    replay();
  }

  function init(){
    var picker=$('sdr-fixture');
    SHOWDOWN_RAIL_FIXTURES.forEach(function(item){
      var option=document.createElement('option');
      option.value=item.id;
      option.textContent=item.name;
      picker.appendChild(option);
    });
    picker.onchange=function(){ fixture=showdownRailFixtureById(picker.value); renderFixture(); later(replay,90); };
    $('sdr-before').onclick=resetPresentation;
    $('sdr-replay').onclick=replay;
    document.querySelectorAll('[data-motion-choice]').forEach(function(button){
      button.onclick=function(){ setMotion(button.dataset.motionChoice); };
    });
    renderFixture();
    later(replay,160);
    window.__showdownRailLab={
      fixtureIds:SHOWDOWN_RAIL_FIXTURES.map(function(item){ return item.id; }),
      select:function(id){ picker.value=id; picker.onchange(); },
      replay:replay,
      before:resetPresentation,
      state:function(){ return {fixture:fixture.id,phase:phase,motion:document.body.dataset.motion,model:model}; }
    };
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
