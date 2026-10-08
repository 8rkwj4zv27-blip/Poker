"use strict";

/* ============================================================
   CARD LAB — your hand (lab only, never loaded by the game)

   Runs inside the game copy that card-lab.html builds. Career's screen
   becomes a table with your hand on it:

     DEAL     the cards fly from the deck into a fan, face down, then turn
              over one by one
     PICK UP  press a card and it lifts and follows your finger on a
              spring, leaning with how fast you move it; let go and it
              springs back into the hand
     LOOK     tap a card: it comes up to the middle, tilt it with your
              finger, tap it to turn it over, tap the table to put it back
     FEED     drag a card up into the reader: it is taken in, the reader
              reads it, and (in the lab) hands it back

   TUNE switches the frame (Parlour, Enamel, Full art), deals again and
   slows everything down. The art is js/card-lab-art.js.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : {};
  const defaults = { frame:'parlour', speed:1, anim:'on' };
  Object.keys(defaults).forEach(k => { if (state[k] == null) state[k] = defaults[k]; });
  const save = patch => { Object.assign(state, patch); if (host) host.set(patch); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const speed = () => Number(state.speed) || 1;
  const wait = ms => new Promise(r => setTimeout(r, ms / speed()));
  const S = { deal(){ try{ Sound.cardDeal(); }catch(e){} }, land(){ try{ Sound.cardLanded(); }catch(e){} }, flip(){ try{ Sound.cardFlip(); }catch(e){} },
    lift(){ try{ Sound.cardReturn(); }catch(e){} }, tick(s){ try{ Sound.stageRollClick(s || .5, false); }catch(e){} }, bite(){ try{ Sound.hatchClose(); }catch(e){} },
    key(){ try{ Sound.buttonPress('thunk'); }catch(e){} } };
  const buzz = p => { try{ haptic(p); }catch(e){} };

  const CW = 88, CH = 124;
  let root, cards = [], raf = 0, last = 0, grabbed = null, inspecting = null, feeding = false, dealt = false, unit = 2;

  /* ---- a card: its element, its canvases, its spring ---- */
  function makeCard(data, i){
    const el = document.createElement('div');
    el.className = 'cl-card';
    el.innerHTML = '<div class="cl-inner"><canvas class="cl-face cl-front" width="' + CW + '" height="' + CH + '"></canvas><canvas class="cl-face cl-back" width="' + CW + '" height="' + CH + '"></canvas><i class="cl-glare"></i></div>';
    const c = {
      data, el, i, inner:el.querySelector('.cl-inner'), front:el.querySelector('.cl-front'), back:el.querySelector('.cl-back'),
      x:0, y:0, r:0, s:1, vx:0, vy:0, vr:0, vs:0, tx:0, ty:0, tr:0, ts:1,
      flip:1, tflip:1, tiltX:0, tiltY:0, z:i, home:{ x:0, y:0, r:0, s:1 }
    };
    CardArt.drawBack(c.back.getContext('2d'), data.rarity);
    paintFront(c, 0);
    el.addEventListener('pointerdown', e => grab(e, c));
    return c;
  }
  function paintFront(c, t){ CardArt.drawFront(c.front.getContext('2d'), c.data, state.frame, t); }

  /* ---- layout: the hand's fan, the deck, the reader ---- */
  function geometry(){
    const w = root.clientWidth, h = root.clientHeight;
    // one card is two or three art pixels to the screen pixel, whole numbers
    unit = w >= 400 ? 2 : 2;
    const cw = CW * unit, ch = CH * unit;
    const handScale = clamp((w * .43) / cw, .55, .95);
    const n = cards.length, mid = (n - 1) / 2;
    const cardW = cw * handScale;
    const spacing = Math.min(cardW * .58, (w - cardW - 28) / Math.max(1, n - 1));
    const cx = w / 2, baseY = h - ch * handScale * .5 - Math.max(22, parseFloat(getComputedStyle(root).paddingBottom) || 0) - 46;
    cards.forEach((c, i) => {
      const o = i - mid;
      c.home = { x:cx + o * spacing, y:baseY + o * o * 6, r:o * 5.5, s:handScale };
    });
    const deck = root.querySelector('#cl-deck').getBoundingClientRect(), rr = root.getBoundingClientRect();
    return { w, h, cw, ch, handScale, deck:{ x:deck.left - rr.left + deck.width / 2, y:deck.top - rr.top + deck.height / 2 } };
  }

  /* ---- the springs ---- */
  function step(now){
    const dt = Math.min(.04, (now - (last || now)) / 1000) * speed();
    last = now;
    const k = 190, d = 19;
    cards.forEach(c => {
      if (c !== grabbed){
        c.vx += (k * (c.tx - c.x) - d * c.vx) * dt; c.x += c.vx * dt;
        c.vy += (k * (c.ty - c.y) - d * c.vy) * dt; c.y += c.vy * dt;
      }
      c.vr += (k * (c.tr - c.r) - d * c.vr) * dt; c.r += c.vr * dt;
      c.vs += (k * (c.ts - c.s) - d * c.vs) * dt; c.s += c.vs * dt;
      const fd = c.tflip - c.flip;
      c.flip += clamp(fd, -dt * 4.2, dt * 4.2);
      c.tiltX *= Math.pow(.02, dt); c.tiltY *= Math.pow(.02, dt);
      if (c === inspecting && c.hoverTilt){ c.tiltX = c.hoverTilt.x; c.tiltY = c.hoverTilt.y; }
      paint(c);
    });
    // the art animates at a steady 12 a second
    if (state.anim === 'on'){
      const t = now / 1000;
      if (!step.lastArt || now - step.lastArt > 83){ step.lastArt = now; cards.forEach(c => { if (c.flip > .5 || c === inspecting) paintFront(c, t); }); }
    }
    raf = requestAnimationFrame(step);
  }
  function paint(c){
    const lift = c === grabbed || c === inspecting ? 1 : 0;
    c.el.style.transform = 'translate(' + Math.round(c.x - CW * unit / 2) + 'px,' + Math.round(c.y - CH * unit / 2) + 'px) rotate(' + c.r.toFixed(2) + 'deg) scale(' + c.s.toFixed(3) + ')';
    c.el.style.zIndex = String(c === grabbed ? 300 : c === inspecting ? 250 : c.feeding ? 5 : 10 + c.z);
    // the turn: rotateY carries the flip, and the tilt rides on top
    const flipDeg = (1 - c.flip) * 180;
    c.inner.style.transform = 'rotateX(' + c.tiltX.toFixed(1) + 'deg) rotateY(' + (flipDeg + c.tiltY).toFixed(1) + 'deg)';
    c.el.classList.toggle('is-up', !!lift);
    c.el.style.setProperty('--glare', clamp(.5 + c.tiltY / 40, 0, 1).toFixed(3));
  }

  /* ---- the deal ---- */
  async function deal(){
    dealt = false;
    const g = geometry();
    cards.forEach((c, i) => {
      Object.assign(c, { x:g.deck.x, y:g.deck.y, r:-4 + i * 2, s:.42, vx:0, vy:0, vr:0, vs:0, tx:g.deck.x, ty:g.deck.y, tr:-4 + i * 2, ts:.42, flip:0, tflip:0, z:i });
      c.el.style.visibility = 'visible';
    });
    root.querySelector('#cl-deck').classList.add('is-dealing');
    await wait(260);
    for (let i = 0; i < cards.length; i++){
      const c = cards[i];
      c.tx = c.home.x; c.ty = c.home.y; c.tr = c.home.r; c.ts = c.home.s;
      c.vy = -900; c.vr = (i % 2 ? 1 : -1) * 400;
      S.deal(); buzz(6);
      await wait(150);
    }
    await wait(420);
    S.land();
    // turn them over, left to right, each one lifting as it turns
    for (let i = 0; i < cards.length; i++){
      const c = cards[i];
      c.ts = c.home.s * 1.12; c.ty = c.home.y - 18;
      c.tflip = 1; S.flip(); buzz(8);
      await wait(130);
      c.ts = c.home.s; c.ty = c.home.y;
    }
    root.querySelector('#cl-deck').classList.remove('is-dealing');
    dealt = true;
    hint('PICK A CARD UP · TAP ONE TO LOOK · DRAG ONE INTO THE READER');
  }

  /* ---- picking up ---- */
  function grab(e, c){
    if (!dealt || feeding || c.feeding) return;
    e.preventDefault(); e.stopPropagation();
    try{ Sound.unlock(); }catch(err){}
    if (inspecting && c === inspecting){
      c.press = { x:e.clientX, y:e.clientY, t:performance.now(), id:e.pointerId };
      return;
    }
    if (inspecting) return;
    const rr = root.getBoundingClientRect();
    grabbed = c;
    c.drag = { id:e.pointerId, ox:e.clientX - rr.left - c.x, oy:e.clientY - rr.top - c.y, sx:e.clientX, sy:e.clientY, t:performance.now(), lx:e.clientX, ly:e.clientY, lt:performance.now(), moved:false };
    c.ts = c.home.s * 1.18; c.tr = 0;
    S.lift(); buzz(10);
    root.classList.add('is-holding');
  }
  function move(e){
    const c = grabbed;
    if (inspecting && inspecting.press && e.pointerId === inspecting.press.id){
      tiltInspect(e);
      return;
    }
    if (inspecting && e.pointerType !== 'touch') tiltInspect(e);
    if (!c || !c.drag || e.pointerId !== c.drag.id) return;
    e.preventDefault();
    const rr = root.getBoundingClientRect();
    const now = performance.now(), dt = Math.max(8, now - c.drag.lt);
    const vx = (e.clientX - c.drag.lx) / dt * 16, vy = (e.clientY - c.drag.ly) / dt * 16;
    c.drag.lx = e.clientX; c.drag.ly = e.clientY; c.drag.lt = now;
    if (Math.hypot(e.clientX - c.drag.sx, e.clientY - c.drag.sy) > 6) c.drag.moved = true;
    c.x = e.clientX - rr.left - c.drag.ox; c.y = e.clientY - rr.top - c.drag.oy;
    c.vx = c.vy = 0;
    // it leans into the way you move it, and tips toward you
    c.tr = clamp(vx * 2.2, -18, 18);
    c.tiltY = clamp(vx * 3, -24, 24); c.tiltX = clamp(-vy * 3, -24, 24);
    root.querySelector('#cl-reader').classList.toggle('is-near', overReader(c));
  }
  function release(e){
    if (inspecting && inspecting.press && e.pointerId === inspecting.press.id){
      const p = inspecting.press; inspecting.press = null; inspecting.hoverTilt = null;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 10) turnOver(inspecting);
      return;
    }
    const c = grabbed;
    if (!c || !c.drag || e.pointerId !== c.drag.id) return;
    const moved = c.drag.moved, quick = performance.now() - c.drag.t < 260;
    c.drag = null; grabbed = null;
    root.classList.remove('is-holding');
    root.querySelector('#cl-reader').classList.remove('is-near');
    if (overReader(c)){ feed(c); return; }
    if (!moved && quick){ inspect(c); return; }
    home(c);
    S.land(); buzz(6);
  }
  function home(c){ c.tx = c.home.x; c.ty = c.home.y; c.tr = c.home.r; c.ts = c.home.s; }
  function overReader(c){
    const r = root.querySelector('#cl-reader').getBoundingClientRect(), rr = root.getBoundingClientRect();
    return c.y - (CH * unit * c.s) / 2 < r.bottom - rr.top + 16;
  }

  /* ---- looking at one ---- */
  function inspect(c){
    inspecting = c;
    const w = root.clientWidth, h = root.clientHeight;
    const s = Math.min((w - 48) / (CW * unit), (h * .62) / (CH * unit));
    c.tx = w / 2; c.ty = h * .46; c.tr = 0; c.ts = s;
    root.classList.add('is-looking');
    hint('TILT IT · TAP IT TO TURN IT OVER · TAP THE TABLE TO PUT IT BACK');
    S.lift(); buzz(8);
  }
  function tiltInspect(e){
    const c = inspecting; if (!c) return;
    const r = c.el.getBoundingClientRect();
    const nx = clamp((e.clientX - r.left) / r.width, 0, 1), ny = clamp((e.clientY - r.top) / r.height, 0, 1);
    c.hoverTilt = { x:(.5 - ny) * 26, y:(nx - .5) * 30 };
  }
  function turnOver(c){ c.tflip = c.tflip > .5 ? 0 : 1; S.flip(); buzz(8); }
  function putBack(){
    const c = inspecting; if (!c) return;
    inspecting = null; c.hoverTilt = null;
    if (c.tflip < .5) c.tflip = 1;
    home(c);
    root.classList.remove('is-looking');
    hint('PICK A CARD UP · TAP ONE TO LOOK · DRAG ONE INTO THE READER');
    S.land();
  }

  /* ---- the reader: the card goes in, is read, comes back ---- */
  async function feed(c){
    feeding = true; c.feeding = true;
    const reader = root.querySelector('#cl-reader'), mouth = reader.querySelector('.cl-mouth');
    const rr = root.getBoundingClientRect(), mr = mouth.getBoundingClientRect();
    const mx = mr.left - rr.left + mr.width / 2, my = mr.top - rr.top + mr.height / 2;
    const s = (mr.width - 10) / (CW * unit);
    // line up under the mouth, square, narrowed to fit
    c.tx = mx; c.ty = my + (CH * unit * s) / 2 + 8; c.tr = 0; c.ts = s; c.tiltX = c.tiltY = 0;
    reader.classList.add('is-taking');
    crt('READING', '...');
    await wait(320);
    // the bites: up into the mouth in steps; the plate hides what's inside
    const steps = 6, h = CH * unit * s;
    for (let i = 1; i <= steps; i++){
      c.ty = my + (h / 2 + 8) - (h + 10) * i / steps;
      c.y = c.ty; c.vy = 0;
      S.tick(.5 + i / steps * .5); buzz(5);
      mouth.classList.remove('is-bite'); void mouth.offsetWidth; mouth.classList.add('is-bite');
      await wait(120);
    }
    c.el.style.visibility = 'hidden';
    S.bite(); buzz([20, 10, 30]);
    reader.classList.add('is-read');
    crt(c.data.title, 'SEATED · BUY-IN ' + c.data.buyIn);
    await wait(1500);
    // the lab hands it back: out of the mouth and home
    reader.classList.remove('is-read', 'is-taking');
    c.el.style.visibility = 'visible';
    c.y = my - h / 2; c.ty = my + h / 2 + 30; c.vy = 600;
    S.deal();
    await wait(260);
    c.feeding = false;
    home(c);
    feeding = false;
    crt('FEED A CARD', 'TO TAKE YOUR SEAT');
  }

  /* ---- the screen ---- */
  function crt(a, b){ root.querySelector('#cl-crt-a').textContent = a; root.querySelector('#cl-crt-b').textContent = b; }
  let hintT = 0;
  function hint(s){
    const h = root.querySelector('#cl-hint');
    h.textContent = s; h.classList.add('is-on');
    clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('is-on'), 5200 / speed());
  }
  function build(){
    const career = document.getElementById('career');
    if (!career || document.getElementById('cl')) return;
    career.classList.add('cl-on');
    root = document.createElement('div');
    root.id = 'cl'; root.className = 'cl';
    root.innerHTML =
      '<div class="cl-felt" aria-hidden="true"></div>' +
      '<div class="cl-top">' +
        '<button class="cl-key" id="cl-back" type="button" aria-label="Back to main menu"><span class="cl-nav" aria-hidden="true"></span></button>' +
        '<div class="cl-reader" id="cl-reader">' +
          '<span class="cl-lamp" aria-hidden="true"></span>' +
          '<span class="cl-mouth" aria-hidden="true"><i></i></span>' +
          '<span class="cl-crt crt" id="cl-crt"><small class="crt-caption" id="cl-crt-a">FEED A CARD</small><strong class="crt-line" id="cl-crt-b">TO TAKE YOUR SEAT</strong></span>' +
        '</div>' +
      '</div>' +
      '<div class="cl-deck" id="cl-deck" aria-hidden="true"><canvas width="' + CW + '" height="' + CH + '"></canvas><canvas width="' + CW + '" height="' + CH + '"></canvas><canvas width="' + CW + '" height="' + CH + '"></canvas></div>' +
      '<div class="cl-hint" id="cl-hint"></div>';
    career.appendChild(root);
    root.querySelectorAll('#cl-deck canvas').forEach(cv => CardArt.drawBack(cv.getContext('2d'), 'common'));
    cards = CardArt.CARDS.map(makeCard);
    cards.forEach(c => { c.el.style.width = CW * unit + 'px'; c.el.style.height = CH * unit + 'px'; c.el.style.visibility = 'hidden'; root.appendChild(c.el); });
    root.querySelector('#cl-back').addEventListener('click', () => { S.key(); const real = document.getElementById('ch2-back'); if (real) real.click(); });
    root.addEventListener('pointermove', move, { passive:false });
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerdown', e => { if (inspecting && !e.target.closest('.cl-card')) putBack(); });
    root.addEventListener('touchmove', e => { if (grabbed || inspecting) e.preventDefault(); }, { passive:false });
    raf = requestAnimationFrame(step);
    new MutationObserver(() => { if (!career.classList.contains('hidden')) setTimeout(deal, 300); }).observe(career, { attributes:true, attributeFilter:['class'] });
    new ResizeObserver(() => { if (dealt){ geometry(); cards.forEach(c => { if (c !== grabbed && c !== inspecting && !c.feeding) home(c); }); } }).observe(root);
  }

  /* ---- TUNE ---- */
  function tune(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'cll-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'cll-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Card lab');
    const seg = (k, opts) => '<div class="cll-seg" data-key="' + k + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (String(state[k]) === String(o[0]) ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
    sheet.innerHTML =
      '<div class="cll-head"><b>CARD LAB</b><button type="button" class="cll-close" aria-label="Close">✕</button></div>' +
      '<div class="cll-body">' +
        '<h3>THE FRAME<small>Three ways to dress the same four cards.</small></h3>' +
        seg('frame', [['parlour', 'PARLOUR'], ['enamel', 'ENAMEL'], ['full', 'FULL ART']]) +
        '<p class="cll-note"><b>PARLOUR</b> a cream playing card with an engraved border. <b>ENAMEL</b> a ticket the machine issued: brass, rivets, a green screen. <b>FULL ART</b> the picture is the card.</p>' +
        '<div class="cll-actions"><button type="button" data-act="deal">DEAL AGAIN</button></div>' +
        '<h3>MOTION</h3>' +
        '<div class="cll-name">SPEED</div>' + seg('speed', [[1, 'REAL'], [.5, 'HALF'], [.25, 'QUARTER']]) +
        '<div class="cll-name">THE PICTURES MOVE</div>' + seg('anim', [['on', 'ON'], ['off', 'STILL']]) +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => { try{ Sound.unlock(); }catch(e){} open(!sheet.classList.contains('is-open')); });
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.classList.contains('cll-close')){ open(false); return; }
      if (t.dataset.act === 'deal'){
        open(false);
        if (document.getElementById('career').classList.contains('hidden')){ try{ showCareerScreen(); }catch(err){} }
        if (inspecting) putBack();
        deal();
        return;
      }
      const s = t.closest('.cll-seg');
      if (!s) return;
      let v = t.dataset.v; if (s.dataset.key === 'speed') v = Number(v);
      save({ [s.dataset.key]:v });
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
      if (s.dataset.key === 'frame') cards.forEach(c => paintFront(c, performance.now() / 1000));
      if (root) root.style.setProperty('--cl-speed', state.speed);
    });
  }

  function start(){ build(); tune(); if (root) root.style.setProperty('--cl-speed', state.speed); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
