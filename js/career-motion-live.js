/* Live menu motion. Presentation only: Career transactions and poker state
   remain owned by the existing entry and game functions. */
let careerEntranceInFlight = false;
let careerEntranceRaf = 0;

function resetCareerEntrance(){
  if (careerEntranceRaf) cancelAnimationFrame(careerEntranceRaf);
  careerEntranceRaf = 0;
  careerEntranceInFlight = false;
  const app = $('app'), home = $('home'), career = $('career'), key = $('open-career');
  app?.classList.remove('career-entry-machine','career-entry-poweroff','career-entry-recess','career-entry-rolling','career-entry-rolled','career-entry-locked');
  if (home) home.inert = false;
  if (career) career.inert = false;
  if (key){ key.disabled = false; key.classList.remove('career-entry-pressed'); }
}

async function enterCareerFromHome(){
  const app = $('app'), home = $('home'), career = $('career'), key = $('open-career');
  if (!app || !home || !career || !key || home.classList.contains('hidden')) { showCareerScreen(); return; }
  if (careerEntranceInFlight) return;
  if (motionOff()){ showCareerScreen(); return; }
  careerEntranceInFlight = true;
  key.disabled = true;
  home.inert = true;
  key.classList.add('career-entry-pressed');
  app.classList.add('career-entry-machine','career-entry-poweroff');
  Sound.buttonPress('allin');
  haptic([25,18,42]);
  try{
    // Power-down, then the whole assembly retracts into its wheel socket.
    await sleep(240);
    app.classList.add('career-entry-recess');
    Sound.stageUnlock();
    await sleep(350);

    // Mount the real Career screen before the wheel starts. No snapshot of
    // money or event state is ever substituted for the actual reader.
    showCareerScreen({keepHomeVisible:true});
    career.inert = true;
    career.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    app.classList.add('career-entry-rolling');
    await new Promise(resolve => requestAnimationFrame(() => { app.classList.add('career-entry-rolled'); resolve(); }));

    // Ratchets follow measured travel, as on the table's stage wheel.
    const travel = Math.max(1,career.getBoundingClientRect().height+22);
    let notch = 0;
    const tick = () => {
      if (!app.classList.contains('career-entry-rolling')) return;
      const progress = Math.max(0,Math.min(1,(career.getBoundingClientRect().top+travel)/travel));
      while (notch<13 && progress >= (notch+1)/14){
        notch++;
        Sound.stageRollClick(Math.min(1,.32+notch/18),notch===13);
      }
      careerEntranceRaf = requestAnimationFrame(tick);
    };
    careerEntranceRaf = requestAnimationFrame(tick);
    await sleep(1200);
    cancelAnimationFrame(careerEntranceRaf);
    careerEntranceRaf = 0;
    app.classList.remove('career-entry-rolling');
    app.classList.add('career-entry-locked');
    Sound.stageLock();
    haptic([32,22,55]);
    await sleep(280);
    home.classList.add('hidden');
  } catch (error){
    console.error('Career entrance failed; opening the Career screen directly.',error);
    showCareerScreen();
  } finally{
    resetCareerEntrance();
  }
}

(() => {
  const glass = $('home-title-glass');
  if (!glass) return;
  const layer = document.createElement('span');
  layer.className = 'home-glass-layer';
  layer.setAttribute('aria-hidden','true');
  glass.appendChild(layer);
  let active = null;
  let raf = 0;

  const colors = ['red','blue','green','purple','yellow','white'];
  const suits = ['♠','♥','♣','♦'];
  const ranks = [2,3,4,5,6,7,8,9,10,11,12,13,14];
  const random = (lo,hi) => lo+Math.random()*(hi-lo);
  function removeToy(){
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (active) active.el.remove();
    active = null;
  }
  function impactSound(toy,power){
    const now = performance.now();
    if (now-toy.lastSound < 80) return;
    toy.lastSound = now;
    if (toy.kind==='chip') Sound.chipBounce(Math.min(1.5,power));
    else if (toy.kind==='card') Sound.koPortraitClack(Math.min(1.6,power));
    else Sound.koPortraitImpact(Math.min(1.6,power),false);
    if (power>.9) haptic(8);
    glass.classList.remove('is-struck');
    void glass.offsetWidth;
    glass.classList.add('is-struck');
  }
  function buildToy(kind){
    const el = document.createElement('span');
    el.className = 'home-glass-object is-'+kind;
    if (kind==='face'){
      const colorIdx = Math.floor(Math.random()*FACE_COLORS.length);
      const moods = ['sly','smug','shock','happy','think'];
      el.innerHTML = renderFace({faceColorIdx:colorIdx},moods[Math.floor(Math.random()*moods.length)]);
    } else if (kind==='card'){
      const suit = suits[Math.floor(Math.random()*suits.length)];
      const value = ranks[Math.floor(Math.random()*ranks.length)];
      const card = {suit,value,rank:value===14?'A':value===13?'K':value===12?'Q':value===11?'J':String(value)};
      el.innerHTML = '<span class="'+cardClass(false,card,false)+'">'+cardInner(card)+'</span>';
    } else {
      const color = colors[Math.floor(Math.random()*colors.length)];
      const variant = 1+Math.floor(Math.random()*3);
      el.innerHTML = '<span class="chip-disc d-'+color+' v-'+variant+'"></span>';
    }
    layer.appendChild(el);
    return el;
  }
  function draw(toy){
    const t = Math.max(0,(performance.now()-toy.impactAt)/72);
    const a = t<1 ? (1-t)*.13 : 0;
    const sx = toy.impactAxis==='x' ? 1-a : 1+a;
    const sy = toy.impactAxis==='x' ? 1+a : 1-a;
    toy.el.style.left = toy.x+'px';
    toy.el.style.top = toy.y+'px';
    toy.el.style.transform = 'rotate('+toy.rot+'deg) scale('+sx.toFixed(3)+','+sy.toFixed(3)+')';
  }
  function step(now){
    const toy = active;
    if (!toy) return;
    if (document.hidden || $('home').classList.contains('hidden')){ removeToy(); return; }
    const dt = Math.min(.034,Math.max(.001,(now-toy.lastAt)/1000));
    toy.lastAt = now;
    toy.vy += toy.gravity*dt;
    toy.x += toy.vx*dt;
    toy.y += toy.vy*dt;
    toy.rot += toy.spin*dt;
    toy.spin *= Math.max(0,1-.22*dt);
    const maxX = Math.max(0,layer.clientWidth-toy.w);
    const maxY = Math.max(0,layer.clientHeight-toy.h);
    let axis = '';
    let speed = 0;
    if (toy.x<0 || toy.x>maxX){
      toy.x = Math.max(0,Math.min(maxX,toy.x));
      speed = Math.abs(toy.vx); toy.vx = -toy.vx*.81;
      toy.vy += random(-45,45); axis='x';
    }
    if (toy.y<0 || toy.y>maxY){
      toy.y = Math.max(0,Math.min(maxY,toy.y));
      speed = Math.max(speed,Math.abs(toy.vy)); toy.vy = -toy.vy*.76;
      toy.vx += random(-75,75); axis='y';
    }
    if (axis && speed>75){
      toy.impacts++;
      toy.impactAt = now;
      toy.impactAxis = axis;
      toy.spin += random(-180,180);
      // A hard first hit stays violent; later ones remain varied but decay.
      if (toy.impacts===1){ toy.vx*=.86; toy.vy*=.86; }
      impactSound(toy,speed/320);
    }
    draw(toy);
    if ((toy.impacts>=toy.target && now-toy.started>1100) || now-toy.started>3400){ removeToy(); return; }
    raf = requestAnimationFrame(step);
  }
  function launch(event){
    if (careerEntranceInFlight || $('home').classList.contains('hidden')) return;
    if (motionOff()){
      glass.classList.remove('is-struck'); void glass.offsetWidth; glass.classList.add('is-struck');
      return;
    }
    if (active){
      // A repeat tap punches the existing object again; never spawn a
      // second face/card/chip over it.
      active.vx += random(-360,360);
      active.vy -= random(260,430);
      active.spin += random(-360,360);
      if (active.kind==='chip') Sound.chipBounce(.8);
      else if (active.kind==='card') Sound.koPortraitClack(.8);
      else Sound.koPortraitImpact(.8,false);
      return;
    }
    const kind = ['face','card','chip'][Math.floor(Math.random()*3)];
    const el = buildToy(kind);
    const w = kind==='face'?54:kind==='card'?44:38;
    const h = kind==='face'?54:kind==='card'?62:38;
    const rect = layer.getBoundingClientRect();
    const fromX = Number.isFinite(event.clientX) ? event.clientX-rect.left : rect.width/2;
    const fromY = Number.isFinite(event.clientY) ? event.clientY-rect.top : rect.height/2;
    const now = performance.now();
    active = {
      el,kind,w,h,x:Math.max(0,Math.min(rect.width-w,fromX-w/2)),
      y:Math.max(0,Math.min(rect.height-h,fromY-h/2)),
      vx:random(290,510)*(Math.random()<.5?-1:1),vy:-random(260,450),
      gravity:random(520,790),rot:random(-18,18),spin:random(330,700)*(Math.random()<.5?-1:1),
      impacts:0,target:Math.floor(random(4,7)),started:now,lastAt:now,lastSound:0,impactAt:0,impactAxis:'y'
    };
    if (kind==='face') Sound.koBlast();
    else if (kind==='chip') Sound.chipLand();
    else Sound.koPortraitClack(1.2);
    haptic(12);
    draw(active);
    raf = requestAnimationFrame(step);
  }
  glass.addEventListener('click',launch);
  glass.addEventListener('keydown',event => {
    if (event.key==='Enter' || event.key===' '){ event.preventDefault(); launch(event); }
  });
})();
