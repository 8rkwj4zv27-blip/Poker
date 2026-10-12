"use strict";

/* Presentation experiment, injected into the Hub host's isolated copy.
   The spring / carry / squash-turn / six-bite feed descend from hub-lab.js.
   No Career transactions, poker entry or persistence calls live here. */
(() => {
  const M = EventCardLabModel;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
  const money = n => '$' + n.toLocaleString('en-US');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const quiet = () => media.matches || document.documentElement.dataset.motion === 'off';
  const wait = ms => new Promise(r => setTimeout(r, quiet() ? 0 : ms));
  const sound = name => { if (settings.sound && typeof Sound[name] === 'function') Sound[name](); };
  let root, layer, sheet, scrim, raf = 0, last = 0, picked = -1, press = null, holding = null, feeding = false;
  let suppressClick = 0, placeholder = false, openFocus = null;
  const cards = [];

  function cardHTML(t, index) {
    const grades = { common:'•', uncommon:'••', rare:'◆', legendary:'✦' };
    return '<span class="ecl-stock">' +
      '<span class="ecl-venue">' + M.venues[t.venue] + '</span>' +
      '<span class="ecl-art' + (placeholder ? ' is-placeholder' : '') + '"><img src="' + esc(t.art) + '" alt="' + esc(t.artAlt) + '" draggable="false"></span>' +
      '<strong class="ecl-title">' + esc(t.shortTitle) + '</strong>' +
      '<span class="ecl-category"><i aria-hidden="true">' + M.marks[t.category] + '</i>' + t.category.toUpperCase() + '</span>' +
      '<span class="ecl-terms"><span><small>ENTRY</small><b>' + money(t.buyIn) + '</b></span><span><small>TOP PRIZE</small><b>' + money(t.top) + '</b></span></span>' +
      '<span class="ecl-footer"><span class="ecl-grade"><i aria-hidden="true">' + grades[t.rarity] + '</i>' + t.rarity.toUpperCase() + '</span><span class="ecl-number">0' + (index + 1) + '</span></span>' +
      '<span class="ecl-foil" aria-hidden="true"></span><span class="ecl-shade" aria-hidden="true"></span></span>';
  }
  function paintCard(c) {
    const t = c.data;
    ['rarity', 'category', 'venue'].forEach(k => { c.el.dataset[k] = t[k]; });
    c.el.setAttribute('aria-label', M.label(t) + '. Inspect ticket');
    c.el.innerHTML = cardHTML(t, c.i);
  }
  function paint(c) {
    const w = Math.round(c.w), h = Math.round(w * 1.4);
    c.el.style.width = w + 'px'; c.el.style.height = h + 'px';
    c.el.style.transform = 'translate(' + Math.round(c.x - w / 2) + 'px,' + Math.round(c.y - h / 2) + 'px) rotate(' + (Math.round(c.r * 2) / 2) + 'deg)';
    c.el.style.zIndex = c === holding ? '300' : c.feeding ? '150' : c.i === picked ? '120' : String(10 + c.i);
    // The Hub's upright-axis squash flip, with a single visible stock face.
    const f = c.flip;
    c.el.querySelector('.ecl-stock').style.transform = 'scaleX(' + Math.max(.04, Math.abs(Math.cos(f * Math.PI))).toFixed(2) + ')';
    c.el.style.setProperty('--ecl-glint', clamp(50 + c.r * 4, 0, 100) + '%');
  }
  function tick(now) {
    raf = 0;
    const dt = Math.min(.032, (now - (last || now - 16)) / 1000); last = now;
    let moving = false;
    cards.forEach(c => {
      for (const k of ['x','y','r','w','flip']) {
        const target = c['t' + k];
        if (quiet()) { c[k] = target; c['v' + k] = 0; }
        else if (!(holding === c && (k === 'x' || k === 'y'))) {
          c['v' + k] += (200 * (target - c[k]) - 20 * c['v' + k]) * dt;
          c[k] += c['v' + k] * dt;
          if (Math.abs(target - c[k]) < .05 && Math.abs(c['v' + k]) < .1) { c[k] = target; c['v' + k] = 0; }
          else moving = true;
        }
      }
      paint(c);
    });
    if (moving) raf = requestAnimationFrame(tick);
  }
  function wake() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
  function layout() {
    const rr = root.getBoundingClientRect(), dr = root.querySelector('#ecl-deal').getBoundingClientRect();
    const ox = dr.left - rr.left, oy = dr.top - rr.top;
    const normal = Math.floor(Math.min(120, (dr.width - 16) / 3));
    const inspect = Math.floor(Math.min(230, (dr.height - 34) / 1.4, dr.width - 100));
    cards.forEach(c => {
      const isPicked = picked === c.i;
      let col = c.i;
      if (picked >= 0 && !isPicked) col = c.i === (picked + 1) % 3 ? 2 : 0;
      c.home = { x: ox + dr.width / 2 + (col - 1) * (normal + 8), y: oy + dr.height / 2 + (picked >= 0 && !isPicked ? 18 : 0), w: normal, r: 0 };
      if (isPicked) c.home = { x:ox + dr.width / 2, y:oy + dr.height / 2 - 2, w:inspect, r:0 };
      if (c !== holding && !c.feeding) Object.entries(c.home).forEach(([k,v]) => { c['t' + k] = v; });
    });
    wake();
  }
  function consoleText(a, b) {
    root.querySelector('#ecl-ro-a').textContent = a;
    root.querySelector('#ecl-ro-b').textContent = b;
  }
  function selection() {
    cards.forEach(c => {
      c.el.classList.toggle('is-selected', c.i === picked);
      c.el.classList.toggle('is-dim', picked >= 0 && c.i !== picked);
      c.el.setAttribute('aria-pressed', String(c.i === picked));
    });
    const t = cards[picked]?.data;
    root.querySelector('#ecl-feed').disabled = !t || feeding;
    root.querySelector('#ecl-tune').disabled = feeding;
    root.querySelector('#ecl-rest').disabled = feeding;
    root.querySelector('#ecl-deal-again').disabled = feeding;
    root.querySelector('#ecl-slot').classList.toggle('is-ready', !!t);
    consoleText(t ? t.category.toUpperCase() + ' · ' + M.venues[t.venue] : 'PICK A TICKET', t ? t.seats + ' SEATS · SAMPLE TERMS' : 'TAP TO INSPECT · DRAG TO THE SLOT');
    root.querySelector('#ecl-feed-note').textContent = t ? 'READER PREVIEW' : 'PICK A TICKET FIRST';
    root.querySelector('#ecl-hint').textContent = t ? 'Drag to slot · tap again to put down' : 'Tap to inspect · pick up and carry';
  }
  function choose(i) { if (feeding) return; picked = i; selection(); layout(); sound('cardLanded'); }
  function point(e) { const r = root.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; }
  function overSlot(p) {
    const r = root.querySelector('.hb-mouth').getBoundingClientRect(), rr = root.getBoundingClientRect();
    return p.x >= r.left-rr.left-12 && p.x <= r.right-rr.left+12 && p.y >= r.top-rr.top-24 && p.y <= r.bottom-rr.top+28;
  }
  function down(e) {
    const el = e.target.closest('.ecl-card');
    if (!el || feeding || e.button > 0 || press) return;
    e.preventDefault();
    if (settings.sound) Sound.unlock();
    el.focus({preventScroll:true}); el.setPointerCapture(e.pointerId);
    const c = cards[+el.dataset.i], p = point(e);
    press = { c, id:e.pointerId, start:p, ox:p.x-c.x, oy:p.y-c.y, lastX:p.x };
  }
  function move(e) {
    if (!press || e.pointerId !== press.id) return;
    e.preventDefault();
    const p = point(e), c = press.c;
    if (!holding && Math.hypot(p.x-press.start.x,p.y-press.start.y) < 8) return;
    if (!holding) {
      holding = c; picked = c.i; selection(); layout();
      c.tw = Math.min(230, c.home.w * 1.06); c.el.classList.add('is-held'); sound('cardReturn');
    }
    c.x = c.tx = p.x-press.ox; c.y = c.ty = p.y-press.oy;
    c.vx = c.vy = 0; c.tr = quiet() ? 0 : clamp((p.x-press.lastX)*1.3,-12,12);
    press.lastX = p.x;
    root.querySelector('#ecl-slot').classList.toggle('is-near', overSlot(p));
    wake();
  }
  function up(e, cancelled = false) {
    if (!press || e.pointerId !== press.id) return;
    const c = press.c, carried = holding === c, p = point(e);
    press = null; holding = null;
    c.el.classList.remove('is-held');
    root.querySelector('#ecl-slot').classList.remove('is-near');
    suppressClick = performance.now() + 300;
    if (c.el.hasPointerCapture(e.pointerId)) c.el.releasePointerCapture(e.pointerId);
    if (cancelled) { layout(); return; }
    if (carried) { if (overSlot(p)) feed(c); else { layout(); sound('cardLanded'); } }
    else choose(picked === c.i ? -1 : c.i);
  }
  async function feed(c) {
    if (feeding || !c) return;
    feeding = true; c.feeding = true; selection();
    const slot = root.querySelector('#ecl-slot'), rr = root.getBoundingClientRect(), mr = slot.querySelector('.hb-mouth').getBoundingClientRect();
    const w = mr.width-8, mx = mr.left-rr.left+mr.width/2, my = mr.top-rr.top+mr.height/2;
    slot.classList.add('is-taking');
    if (!quiet()) {
      c.tx = mx; c.tw = w; c.ty = my-w*1.4/2-4; c.tr = 0; wake();
      await wait(400);
      for (let bite=1; bite<=6; bite++) {
        c.y = c.ty = my-w*1.4/2-4+w*1.4*bite/6; c.vy=0;
        c.el.style.clipPath = 'inset(0 0 ' + Math.round(bite*100/6) + '% 0)';
        paint(c); sound('cardLanded'); await wait(105);
      }
    }
    c.el.style.visibility = 'hidden';
    slot.classList.remove('is-taking'); slot.classList.add('is-read'); sound('hatchClose');
    consoleText('TICKET READ', 'RETURNING TICKET · NO ENTRY CHARGED');
    await wait(650);
    c.el.style.visibility = ''; c.el.style.clipPath = '';
    c.x = c.tx = mx; c.y = c.ty = my-w*1.4/2-4; c.w=c.tw=w;
    c.feeding=false; feeding=false; selection(); layout();
    consoleText('TICKET RETURNED', 'READER PREVIEW · NO ENTRY CHARGED');
    await wait(500); slot.classList.remove('is-read');
  }
  function deal() {
    if (feeding) return;
    choose(-1);
    if (quiet()) return;
    const rr=root.getBoundingClientRect(), dr=root.querySelector('#ecl-deal').getBoundingClientRect();
    cards.forEach((c,i) => {
      c.x=dr.right-rr.left-10; c.y=dr.top-rr.top+10; c.w=25; c.r=-8+i*3; c.flip=.5; c.tflip=0;
    });
    sound('cardDeal'); wake();
  }
  function openSheet(on) {
    if (on && feeding) return;
    if (on) { openFocus=document.activeElement; updateSheet(); }
    sheet.hidden=!on; scrim.hidden=!on; root.inert=on;
    if (on) sheet.querySelector('button').focus();
    else if (openFocus?.isConnected) openFocus.focus({preventScroll:true});
  }
  function updateSheet() {
    const index = picked < 0 ? 0 : picked, t=cards[index].data;
    sheet.querySelector('#ecl-target').value=String(index);
    Object.keys(M.axes).forEach(k => { sheet.querySelector('[data-axis="'+k+'"]').value=t[k]; });
    sheet.querySelector('#ecl-art-source').value=placeholder?'placeholder':'faces';
    sheet.querySelector('#ecl-sound').value=settings.sound?'on':'off';
  }
  function tune() {
    scrim=document.createElement('div');scrim.className='ecl-scrim';scrim.hidden=true;
    sheet=document.createElement('section');sheet.className='hbl-sheet ecl-sheet';sheet.hidden=true;sheet.tabIndex=-1;
    sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','ecl-sheet-title');
    const select=(id,label,values) => '<label for="'+id+'">'+label+'</label><select id="'+id+'">'+values.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select>';
    sheet.innerHTML='<div class="hbl-head"><b id="ecl-sheet-title">CARD SYSTEM LAB</b><button class="hbl-close ch2-key" aria-label="Close tuning" type="button">✕</button></div><div class="hbl-body">'+
      '<p class="hbl-note">One ticket, three independent layers. These are visual fixtures. Feeding returns the card; no event starts and no entry is charged.</p>'+
      select('ecl-target','Ticket',M.fixtures.map((t,i)=>[i,t.title]))+
      Object.entries(M.axes).map(([k,values])=>select('ecl-'+k,k[0].toUpperCase()+k.slice(1),values.map(v=>[v,k==='venue'?M.venues[v]:v.toUpperCase()])).replace('<select ','<select data-axis="'+k+'" ')).join('')+
      '<h3>PROVE THE MIX</h3><div class="ecl-presets"><button class="btn-secondary" type="button" data-mix="legendary">LEGENDARY CLASSIC</button><button class="btn-secondary" type="button" data-mix="common">COMMON WILD</button></div>'+
      select('ecl-art-source','Illustration window',[['faces','EXISTING GAME ART'],['placeholder','CLEAN PLACEHOLDER']])+
      select('ecl-sound','Machine sound',[['off','OFF'],['on','ON']])+
      '<p class="hbl-note">Rarity: stock, metallic print and foil. Category: the gameplay mark and word. Venue: the printed header band. Your artwork replaces the same 8:5 window on every card.</p></div>';
    document.body.append(scrim,sheet);
    scrim.addEventListener('click',()=>openSheet(false));
    sheet.querySelector('.hbl-close').addEventListener('click',()=>openSheet(false));
    sheet.addEventListener('change',e=>{
      const el=e.target;
      if(el.id==='ecl-target'){picked=Number(el.value);selection();layout();updateSheet();return;}
      const c=cards[picked<0?0:picked];
      if(el.dataset.axis)c.data=M.withAxis(c.data,el.dataset.axis,el.value);
      if(el.id==='ecl-art-source')placeholder=el.value==='placeholder';
      if(el.id==='ecl-sound'){settings.sound=el.value==='on';if(settings.sound)Sound.unlock();}
      cards.forEach(paintCard);selection();wake();
    });
    sheet.addEventListener('click',e=>{
      const mix=e.target.closest('[data-mix]');if(!mix)return;
      const c=cards[picked<0?0:picked];
      c.data=M.withAxis(M.withAxis(c.data,'rarity',mix.dataset.mix),'category',mix.dataset.mix==='legendary'?'classic':'wild');
      paintCard(c);selection();updateSheet();wake();
    });
    sheet.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();openSheet(false);}
      if(e.key==='Tab'){
        const controls=[...sheet.querySelectorAll('button,select')],first=controls[0],end=controls.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}
        else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}
      }
    });
  }
  function start() {
    const careerEl=document.getElementById('career');
    if(!careerEl)return;
    settings.sound=false;
    document.getElementById('home').classList.add('hidden');
    careerEl.classList.remove('hidden');careerEl.classList.add('ecl-on');
    root=document.createElement('div');root.id='event-card-lab';root.className='hb ecl';
    root.innerHTML='<div class="hb-top"><div class="hb-rail"><button class="hb-key ch2-key" id="ecl-rest" aria-label="Put selected ticket down" type="button"><span class="hb-nav" aria-hidden="true"></span></button><span class="hb-plate">EVENT CARDS</span><button class="hb-key ch2-key" id="ecl-tune" type="button">TUNE</button></div><div class="hb-bank"><div class="hb-reel">'+
      '<span class="jp-cell jp-sym">$</span>'+['0','0','0','1','8','4','0'].map((d,i)=>'<span class="jp-cell jp-digit'+(i<3?' is-leading':'')+'">'+d+'</span>').join('')+'</div></div></div>'+
      '<div class="hb-felt"><div class="hb-felt-head"><span class="hb-label">TONIGHT\'S TICKETS</span><button class="hb-key ch2-key hb-redeal" id="ecl-deal-again" type="button">DEAL</button></div><div class="hb-deal" id="ecl-deal"></div><div class="hb-hint" id="ecl-hint"></div></div>'+
      '<div class="hb-console"><div class="hb-slot" id="ecl-slot"><span class="hb-slot-lamp" aria-hidden="true"></span><span class="hb-mouth" aria-hidden="true"><i></i></span><span class="hb-slot-word">INSERT TICKET</span></div><div class="hb-readout crt" role="status"><small class="crt-caption" id="ecl-ro-a"></small><span class="crt-line" id="ecl-ro-b"></span></div><div class="pc-primary-cradle hb-cradle"><span class="pc-slot-aperture" aria-hidden="true"><span class="pc-slot-door"></span></span><button class="pc-button pc-button-primary hb-buy" id="ecl-feed" type="button" disabled><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong>FEED TICKET</strong><small id="ecl-feed-note"></small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div></div><div class="hb-layer"></div>';
    careerEl.append(root);layer=root.querySelector('.hb-layer');
    M.fixtures.forEach((t,i)=>{
      const el=document.createElement('button');el.type='button';el.className='ecl-card';el.dataset.i=String(i);el.setAttribute('aria-pressed','false');
      const c={el,i,data:{...t},x:0,y:0,r:0,w:100,flip:0,tx:0,ty:0,tr:0,tw:100,tflip:0,vx:0,vy:0,vr:0,vw:0,vflip:0};
      cards.push(c);paintCard(c);layer.append(el);
      el.addEventListener('click',()=>{if(performance.now()>suppressClick)choose(picked===i?-1:i);});
    });
    root.querySelector('#ecl-rest').addEventListener('click',()=>choose(-1));
    root.querySelector('#ecl-deal-again').addEventListener('click',deal);
    root.querySelector('#ecl-tune').addEventListener('click',()=>openSheet(true));
    root.querySelector('#ecl-feed').addEventListener('click',()=>feed(cards[picked]));
    root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move,{passive:false});
    root.addEventListener('pointerup',e=>up(e));root.addEventListener('pointercancel',e=>up(e,true));
    root.addEventListener('lostpointercapture',e=>up(e,true));
    root.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();choose(-1);}
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const i=(picked+(e.key==='ArrowRight'?1:2)+3)%3;choose(i);cards[i].el.focus();}
    });
    tune();selection();layout();
    cards.forEach(c=>{Object.entries(c.home).forEach(([k,v])=>{c[k]=c['t'+k]=v;});paint(c);});
    new ResizeObserver(layout).observe(root);
    media.addEventListener('change',layout);
    new MutationObserver(layout).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(press)up({pointerId:press.id,clientX:0,clientY:0},true);cancelAnimationFrame(raf);raf=0;}else wake();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
