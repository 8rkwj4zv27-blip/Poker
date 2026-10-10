/* Visual fixtures only. No game modules, storage, transactions or PWA hooks. */
(() => {
  'use strict';

  const {cards,rarities,rarityKeys,specimen,objectHTML} = window.PokerCollectibleLab;
  let view = 'rarities';
  let selectedEvent = 2;
  let selectedRarity = 'common';
  let specimens = [];
  const grid = document.getElementById('ccl-grid');
  const dialog = document.getElementById('ccl-inspector');
  const stage = document.getElementById('ccl-inspect-stage');
  const closeKey = document.getElementById('ccl-close');
  const finishKey = document.getElementById('ccl-finish');
  const motionKey = document.getElementById('ccl-motion');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let reduced = preference.matches;
  let requestedReduced = null;
  let closing = false;
  let pointer = null;
  let entryAnimation = null;
  let materialFrame = 0;
  let pendingMovement = null;

  let pickups = [];
  function renderDrawer() {
    specimens = view === 'rarities' ? rarityKeys.map(rarity=>specimen(cards[selectedEvent],rarity)) : cards.map(card=>specimen(card,selectedRarity));
    grid.innerHTML = specimens.map((card,i)=>`<div class="ccl-slot"><button class="ccl-pickup" type="button" data-card="${i}" aria-label="Inspect ${card.title}, ${rarities[card.rarity].name}">${objectHTML(card)}</button></div>`).join('');
    pickups = [...grid.querySelectorAll('.ccl-pickup')];
    document.querySelectorAll('[data-view]').forEach(key=>key.setAttribute('aria-pressed',String(key.dataset.view===view)));
    const choices = view === 'rarities' ? cards.map((card,i)=>({value:String(i),label:['TABLE','ICE','BOMB','WILD'][i],name:card.title})) : rarityKeys.map(rarity=>({value:rarity,label:rarities[rarity].code,name:rarities[rarity].name}));
    const controls = document.getElementById('ccl-set-keys');
    controls.setAttribute('aria-label',view === 'rarities' ? 'Choose event to compare' : 'Choose drawer rarity');
    controls.innerHTML = choices.map(choice=>`<button class="ccl-key" type="button" data-set="${choice.value}" aria-label="${choice.name}" aria-pressed="${choice.value === (view === 'rarities' ? String(selectedEvent) : selectedRarity)}">${choice.label}</button>`).join('');
    document.getElementById('ccl-set-label').textContent = view === 'rarities' ? `${['TABLE','ICE','BOMB','WILD'][selectedEvent]} / C → L` : `${rarities[selectedRarity].code} / SET 01`;
    document.getElementById('ccl-set-note').textContent = view === 'rarities' ? `${cards[selectedEvent].title} / ${selectedEvent === 0 ? 'APPROVED TABLE SET' : 'COMPOSITION STUDY'}` : `${rarities[selectedRarity].name.toUpperCase()} / FOUR EVENT TYPES`;
  }
  document.querySelector('.ccl-view-keys').addEventListener('click',event=>{
    const key = event.target.closest('[data-view]');
    if (!key || view === key.dataset.view) return;
    view = key.dataset.view;
    renderDrawer();
    key.focus({preventScroll:true});
  });
  document.getElementById('ccl-set-keys').addEventListener('click',event=>{
    const key = event.target.closest('[data-set]');
    if (!key) return;
    const value = key.dataset.set;
    if (view === 'rarities') selectedEvent = Number(value); else selectedRarity = value;
    renderDrawer();
    document.querySelector(`[data-set="${value}"]`).focus({preventScroll:true});
  });
  document.getElementById('ccl-blind').addEventListener('click',event=>{
    const hidden = document.body.dataset.blind !== 'true';
    document.body.dataset.blind = String(hidden);
    event.currentTarget.setAttribute('aria-pressed',String(hidden));
    document.getElementById('ccl-blind-state').textContent = hidden ? 'HIDDEN' : 'SHOWN';
  });
  renderDrawer();

  function applyMotion() {
    reduced = preference.matches || requestedReduced === true;
    motionKey.disabled = preference.matches;
    document.body.dataset.motion = reduced ? 'off' : 'on';
    motionKey.setAttribute('aria-pressed', String(reduced));
    document.getElementById('ccl-motion-state').textContent = reduced ? 'OFF' : 'ON';
    finishKey.disabled = reduced;
    finishKey.textContent = reduced ? 'FINISH AT REST' : specimens[index].material === 'paper' && specimens[index].finish === 'paper' ? 'LIFT THE STOCK' : specimens[index].material === 'singed' ? 'STILL SIZZLING' : 'CATCH THE LIGHT';
    if (reduced) {
      if (entryAnimation) entryAnimation.cancel();
      resetHold();
      stage.querySelector('.ccl-object')?.classList.remove('is-finishing','is-sizzling');
    }
  }
  function replayFinish() {
    const object = stage.querySelector('.ccl-object');
    if (!object || reduced || closing) return;
    object.classList.remove('is-finishing','is-sizzling');
    void object.offsetWidth;
    object.classList.add('is-finishing');
    if (specimens[index].material === 'singed') object.classList.add('is-sizzling');
    if (specimens[index].material === 'paper' && specimens[index].finish === 'paper') object.animate([
      {transform:'translateY(0)'},{transform:'translateY(-7px)',offset:.4},{transform:'translateY(0)'}
    ],{duration:350,easing:'cubic-bezier(.2,.7,.2,1)'});
  }
  function renderInspect(fromDrawer) {
    if (entryAnimation) entryAnimation.cancel();
    resetHold();
    pickups.forEach((button,i)=>button.classList.toggle('is-away', i===index));
    stage.innerHTML = objectHTML(specimens[index], true);
    document.getElementById('ccl-inspect-title').textContent = `${rarities[specimens[index].rarity].name.toUpperCase()} / ${specimens[index].issue}`;
    document.getElementById('ccl-inspect-title').setAttribute('aria-label', `Inspect ${specimens[index].title}, ${specimens[index].rarity}`);
    document.getElementById('ccl-inspect-note').textContent = specimens[index].note;
    applyMotion();
    const object = stage.firstElementChild;
    if (!reduced && fromDrawer) {
      const source = pickups[index].getBoundingClientRect();
      const target = object.getBoundingClientRect();
      entryAnimation = object.animate([
        {transform:`translate(${source.x+source.width/2-target.x-target.width/2}px,${source.y+source.height/2-target.y-target.height/2}px) scale(${source.width/target.width}) rotate(-2deg)`},
        {transform:'translate(0,0) scale(1) rotate(0deg)'}
      ],{duration:360,easing:'cubic-bezier(.2,.8,.2,1)'});
    } else if (!reduced) {
      entryAnimation = object.animate([{transform:'translateY(8px)',opacity:.7},{transform:'translateY(0)',opacity:1}],{duration:180});
    }
    if (specimens[index].material !== 'paper' || specimens[index].finish !== 'paper') replayFinish();
  }
  function openInspect(nextIndex) {
    if (closing) return;
    index = nextIndex;
    if (!dialog.open) dialog.showModal();
    renderInspect(true);
  }
  function moveInspect(direction) {
    if (!dialog.open || closing) return;
    index = (index + direction + specimens.length) % specimens.length;
    renderInspect(false);
  }
  async function closeInspect() {
    if (closing || !dialog.open) return;
    closing = true;
    resetHold();
    if (entryAnimation) entryAnimation.cancel();
    const object = stage.firstElementChild;
    object.classList.remove('is-finishing','is-sizzling');
    if (!reduced) {
      const target = pickups[index].getBoundingClientRect();
      const source = object.getBoundingClientRect();
      const settle = object.animate([{transform:'translateY(0)',opacity:1},{transform:`translate(${target.x+target.width/2-source.x-source.width/2}px,${target.y+target.height/2-source.y-source.height/2}px) scale(${target.width/source.width})`,opacity:.25}],{duration:220,easing:'cubic-bezier(.4,0,.8,.8)'});
      await settle.finished.catch(()=>{});
    }
    dialog.close();
    pickups.forEach(button=>button.classList.remove('is-away'));
    pickups[index].focus({preventScroll:true});
    closing = false;
  }
  function resetHold() {
    const object = stage.firstElementChild;
    const heldPointer = pointer;
    pointer = null;
    cancelAnimationFrame(materialFrame);
    materialFrame = 0;
    pendingMovement = null;
    if (object) {
      if (heldPointer && object.hasPointerCapture(heldPointer.id)) object.releasePointerCapture(heldPointer.id);
      object.classList.remove('is-held');
      delete object.dataset.expression;
      ['--drag-x','--drag-y','--tilt-x','--tilt-y','--sheen-x','--light-x','--light-y','--reflect-angle','--light-strength'].forEach(property=>object.style.removeProperty(property));
    }
  }
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-card]');
    if (button) openInspect(Number(button.dataset.card));
  });
  closeKey.addEventListener('click', closeInspect);
  finishKey.addEventListener('click', replayFinish);
  document.getElementById('ccl-prev').addEventListener('click',()=>moveInspect(-1));
  document.getElementById('ccl-next').addEventListener('click',()=>moveInspect(1));
  motionKey.addEventListener('click',()=>{requestedReduced=!reduced;applyMotion();});
  preference.addEventListener('change',applyMotion);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeInspect();});
  dialog.addEventListener('click',event=>{
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) closeInspect();
  });
  dialog.addEventListener('keydown',event=>{
    if (event.key==='ArrowLeft' || event.key==='ArrowRight') {event.preventDefault();moveInspect(event.key==='ArrowLeft' ? -1 : 1);}
  });
  stage.addEventListener('pointerdown',event=>{
    const object = event.target.closest('.ccl-object');
    if (!object || reduced || closing || pointer || (event.pointerType==='mouse' && event.button!==0)) return;
    if (entryAnimation) entryAnimation.cancel();
    pointer = {id:event.pointerId,x:event.clientX,y:event.clientY};
    if (specimens[index].finish !== 'paper') object.classList.remove('is-finishing');
    object.classList.add('is-held');
    object.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if (!pointer || pointer.id!==event.pointerId) return;
    const dx = Math.max(-60,Math.min(60,event.clientX-pointer.x));
    const dy = Math.max(-60,Math.min(60,event.clientY-pointer.y));
    pendingMovement = {dx,dy};
    // At most one material update per display frame; no layout reads in the drag.
    if (!materialFrame) materialFrame = requestAnimationFrame(()=>{
      materialFrame = 0;
      if (!pointer || !pendingMovement) return;
      const object = stage.firstElementChild;
      const {dx,dy} = pendingMovement;
      if (specimens[index].kind === 'wild' && specimens[index].tier === 3) object.dataset.expression = dx > 22 ? 'wink' : 'grin';
      object.style.setProperty('--tilt-x',`${-dy/8}deg`);
      object.style.setProperty('--tilt-y',`${dx/8}deg`);
      object.style.setProperty('--drag-x',`${dx/7}px`);
      object.style.setProperty('--drag-y',`${dy/7-4}px`);
      if (specimens[index].finish !== 'paper') {
        object.style.setProperty('--sheen-x',`${dx*1.2}%`);
        object.style.setProperty('--light-x',`${50+dx*.65}%`);
        object.style.setProperty('--light-y',`${50+dy*.65}%`);
        object.style.setProperty('--reflect-angle',`${115+dx*.55-dy*.3}deg`);
        object.style.setProperty('--light-strength',String(.22+(Math.abs(dx)+Math.abs(dy))/300));
      }
    });
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>stage.addEventListener(type,event=>{
    if (pointer && event.pointerId===pointer.id) resetHold();
  }));
  window.addEventListener('blur',resetHold);
  applyMotion();
})();
