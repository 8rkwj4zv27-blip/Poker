"use strict";

/* ============================================================
   WORKSHOP RACK — the Workshop's picker (Settings Lab round 6;
   docs/ui/SETTINGS_PLAN.md). Candidate part: lab only for now.

   The Career event rack, as one picker any list can use. Its motion is
   the event rack's own (js/career-hub-live.js), ported number for
   number: the same card geometry, the same position spring and detent,
   the same grab (finger pull, lean, press tilt, lift and its hard drop
   shadow), the ticket being travelled towards rising over the current
   one, the same throw projection, notch clicks, landing knock and end
   jolt. Only the cards are different: whatever the list hands it (a
   playing card, a deal-style ticket).

   Landing calls onLand(i): the Workshop previews it. Choosing is a
   separate key, so browsing never changes your setup.

   WorkshopRack.create({ items:[html], index, onLand(i) })
     -> { el, index, go(i), refresh(i, html) }
   ============================================================ */
const WorkshopRack = (() => {
  // js/career-hub-live.js cardGeometry, unchanged
  function cardGeometry(d){
    const a = Math.min(Math.abs(d),3);
    const x = a <= 1 ? 91 * a : a <= 2 ? 91 + 27 * (a - 1) : 118;
    return {
      x:(d < 0 ? -1 : 1) * x,
      y:a <= 1 ? 10 + 12 * a : a <= 2 ? 22 + 6 * (a - 1) : 28,
      scale:a <= 1 ? 1 - .06 * a : a <= 2 ? .94 - .04 * (a - 1) : .9,
      visible:a < 2.5,
      shade:.46 * Math.min(a,1),
      z:Math.max(1,Math.round(30 - a * 12))
    };
  }
  const softCap = (value,limit) => limit * Math.tanh(value / limit);
  const clamp = (value,lo,hi) => Math.max(lo,Math.min(hi,value));
  const motionReduced = () => { try{ return motionOff(); }catch(e){ return false; } };
  const sfx = (fn,...a) => { try{ if (Sound[fn]) Sound[fn](...a); }catch(e){} };
  const buzz = ms => { try{ haptic(ms); }catch(e){} };

  function create(o){
    const rack = document.createElement('div');
    rack.className = 'wr-reader';
    rack.innerHTML = '<div class="wr-rack" tabindex="0" role="listbox"><div class="wr-track"></div></div>';
    const inner = rack.querySelector('.wr-rack');
    const track = rack.querySelector('.wr-track');
    const cards = o.items.map((html,i) => {
      const c = document.createElement('div');
      c.className = 'wr-card'; c.dataset.i = String(i); c.setAttribute('role','option');
      c.innerHTML = '<div class="wr-card-inner">' + html + '</div>';
      track.appendChild(c);
      return c;
    });
    const last = cards.length - 1;
    const start = clamp(o.index || 0,0,last);
    let rackRaf = 0, pointer = null;

    /* js/career-hub-live.js, from "The rack is one continuous position"
       to the release handler: the same state, springs and constants. */
    const hold = () => ({x:0,v:0,goal:0});
    const phys = {
      s:start, v:0, target:start, held:start, detent:start,
      dragging:false, landed:true, wall:0, lastT:0,
      hy:hold(), lean:hold(), tx:hold(), ty:hold(), lift:hold(),
      rise:cards.map(hold), arriving:-1
    };
    const holds = [phys.hy,phys.lean,phys.tx,phys.ty,phys.lift];
    const spring = (q,k,zeta,h) => {
      q.v += (-k * (q.x - q.goal) - 2 * zeta * Math.sqrt(k) * q.v) * h;
      q.x += q.v * h;
    };
    const rubber = s => s < 0 ? -softCap(-s * .42,.24) : s > last ? last + softCap((s - last) * .42,.24) : s;
    const visualS = () => {
      const s = rubber(phys.s);
      if (s < 0 || s > last || motionReduced()) return s;
      return s - .15 / (2 * Math.PI) * Math.sin(2 * Math.PI * (s - Math.round(s)));
    };
    const paint = () => {
      const s = visualS();
      const lift = Math.max(0,phys.lift.x);
      cards.forEach((card,i) => {
        const d = i - s;
        const rise = Math.max(0,phys.rise[i].x);
        const far = Math.abs(d) >= 2.6 && i !== phys.held && rise < .001;
        if (far && card._far) return;
        card._far = far;
        const g = cardGeometry(d);
        const st = card.style;
        const held = i === phys.held;
        const heldLift = held ? lift : 0;
        const share = held ? 1 : Math.abs(d) < 1.5 ? .28 : 0;
        st.setProperty('--card-x',g.x.toFixed(3) + '%');
        st.setProperty('--card-y',(g.y - 5 * rise).toFixed(2) + 'px');
        st.setProperty('--card-scale',(g.scale * (1 + .03 * heldLift + .06 * rise)).toFixed(4));
        st.setProperty('--card-o',g.visible || rise > .001 ? '1' : '0');
        st.setProperty('--shade',(g.shade * (1 - .75 * Math.min(1,rise))).toFixed(3));
        st.setProperty('--hold-y',(held ? phys.hy.x : 0).toFixed(2) + 'px');
        st.setProperty('--lean',(phys.lean.x * share).toFixed(3) + 'deg');
        st.setProperty('--tilt-x',(held ? phys.tx.x : 0).toFixed(3) + 'deg');
        st.setProperty('--tilt-y',(held ? phys.ty.x : 0).toFixed(3) + 'deg');
        st.setProperty('--lift',Math.max(heldLift,rise).toFixed(3));
        const arriving = i === phys.arriving || rise > .02;
        st.zIndex = String(arriving ? 40 : held && lift > .04 ? 33 : g.z);
        card.classList.toggle('is-selected',i === phys.target);
      });
    };
    const arrivingIndex = () => {
      const s = rubber(phys.s);
      const dir = phys.dragging && pointer ? s - pointer.base : phys.target - s;
      if (Math.abs(dir) < .015) return -1;
      const i = dir > 0 ? Math.ceil(s - 1e-6) : Math.floor(s + 1e-6);
      return i >= 0 && i <= last ? i : -1;
    };
    const jolt = dir => {
      rack.classList.remove('is-stop-left','is-stop-right');
      void rack.offsetWidth;
      rack.classList.add(dir < 0 ? 'is-stop-left' : 'is-stop-right');
      sfx('koThunk',.55);
      buzz(18);
    };
    const notchTo = (notch,energy) => {
      if (notch === phys.detent) return;
      phys.detent = notch;
      sfx('stageRollClick',clamp(energy,.12,1),false); buzz(5);
    };
    const landed = () => { if (o.onLand) o.onLand(phys.target); };
    const snap = () => {
      phys.s = phys.target; phys.v = 0; phys.held = phys.target; phys.landed = true;
      holds.forEach(q => { q.x = q.goal = q.v = 0; });
      phys.rise.forEach(q => { q.x = q.goal = q.v = 0; });
      phys.arriving = -1;
      notchTo(phys.target,.4);
      paint();
    };
    const tick = now => {
      rackRaf = 0;
      if (!rack.isConnected) return;
      const dt = Math.min(.034,Math.max(.001,(now - (phys.lastT || now - 16)) / 1000));
      phys.lastT = now;
      if (phys.dragging && pointer){
        const fade = Math.exp(-(performance.now() - pointer.t) / 70);
        const vx = pointer.vx * fade, vy = pointer.vy * fade;
        const grip = pointer.gy >= 0 ? 1 : -1;
        phys.lean.goal = clamp(-vx * 6.5 * grip * (.55 + .45 * Math.abs(pointer.gy)),-10,10);
        phys.tx.goal = clamp(-pointer.gy * 4.5 + vy * 3.2,-8,8);
        phys.ty.goal = clamp(pointer.gx * 5.5 - vx * 2.6,-9,9);
        if (!motionReduced()) phys.lift.goal = 1 - .8 * clamp(Math.abs(rubber(phys.s) - pointer.base) / .5,0,1);
      }
      phys.arriving = motionReduced() ? -1 : arrivingIndex();
      phys.rise.forEach((q,i) => {
        if (i !== phys.arriving){ q.goal = 0; return; }
        q.goal = phys.dragging ? 1 : clamp(Math.abs(i - rubber(phys.s)) / .3,0,1);
      });
      const steps = Math.ceil(dt * 120), h = dt / steps;
      for (let n = 0; n < steps; n++){
        if (!phys.dragging){
          const zeta = Math.abs(phys.s - phys.target) > 1.2 ? .88 : .64;
          phys.v += (-150 * (phys.s - phys.target) - 2 * zeta * Math.sqrt(150) * phys.v) * h;
          phys.v = clamp(phys.v,-26,26);
          phys.s += phys.v * h;
        }
        spring(phys.hy,230,.46,h);
        spring(phys.lean,250,.34,h);
        spring(phys.tx,290,.5,h);
        spring(phys.ty,290,.5,h);
        spring(phys.lift,210,.82,h);
        phys.rise.forEach(q => { if (q.x || q.goal || q.v) spring(q,260,.62,h); });
      }
      notchTo(clamp(Math.round(visualS()),0,last),Math.abs(phys.v) / 9 + .12);
      if (!phys.dragging && !phys.landed && Math.abs(phys.s - phys.target) < .03){
        phys.landed = true;
        if (phys.wall) jolt(phys.wall); else sfx('cardLanded');
        phys.wall = 0;
        landed();
      }
      paint();
      const resting = !phys.dragging && Math.abs(phys.s - phys.target) < .0008 && Math.abs(phys.v) < .01 &&
        holds.every(q => Math.abs(q.x - q.goal) < .01 && Math.abs(q.v) < .05) &&
        phys.rise.every(q => Math.abs(q.x) < .004 && Math.abs(q.v) < .05);
      if (resting){
        phys.s = phys.target; phys.v = 0; phys.lastT = 0;
        holds.forEach(q => { q.x = q.goal; q.v = 0; });
        phys.rise.forEach(q => { q.x = q.goal = q.v = 0; });
        phys.arriving = -1;
        phys.held = phys.target;
        paint();
        return;
      }
      rackRaf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!rackRaf){ phys.lastT = 0; rackRaf = requestAnimationFrame(tick); } };
    const commit = next => {
      if (next === phys.target) return;
      phys.target = next; phys.landed = false;
    };
    const move = delta => {
      if (phys.dragging) return;
      const next = clamp(phys.target + delta,0,last);
      if (next === phys.target){
        jolt(delta);
        if (!motionReduced()){ phys.s += delta * .07; phys.v += delta * .8; kick(); }
        return;
      }
      commit(next);
      if (motionReduced()){ snap(); landed(); return; }
      phys.v += delta * 3;
      kick();
    };
    inner.addEventListener('keydown',event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight'){
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    inner.addEventListener('pointerdown',event => {
      if (event.button > 0) return;
      phys.s = rubber(phys.s);
      phys.held = clamp(Math.round(phys.s),0,last);
      const card = cards[phys.held];
      const r = card.getBoundingClientRect();
      pointer = {
        id:event.pointerId, x0:event.clientX, y0:event.clientY, lastX:event.clientX, lastY:event.clientY,
        t:performance.now(), vx:0, vy:0, s0:phys.s, base:phys.held, moved:false,
        spacing:Math.max(120,card.offsetWidth * .91),
        gx:clamp((event.clientX - (r.left + r.width / 2)) / (r.width / 2),-1,1),
        gy:clamp((event.clientY - (r.top + r.height * .42)) / (r.height / 2),-1,1)
      };
      try{ inner.setPointerCapture(event.pointerId); }catch(e){}
      phys.dragging = true; phys.landed = false; phys.v = 0; phys.wall = 0;
      if (!motionReduced()){
        phys.lift.goal = 1;
        phys.lift.v += 3.5;
      }
      kick();
    });
    inner.addEventListener('pointermove',event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const now = performance.now();
      const span = Math.max(8,now - pointer.t);
      pointer.vx = .5 * pointer.vx + .5 * ((event.clientX - pointer.lastX) / span);
      pointer.vy = .5 * pointer.vy + .5 * ((event.clientY - pointer.lastY) / span);
      pointer.lastX = event.clientX; pointer.lastY = event.clientY; pointer.t = now;
      const dx = event.clientX - pointer.x0, dy = event.clientY - pointer.y0;
      if (!pointer.moved && Math.hypot(dx,dy) > 9){ pointer.moved = true; sfx('cardFlip',false); }
      phys.s = pointer.s0 - dx / pointer.spacing;
      phys.v = -pointer.vx * 1000 / pointer.spacing;
      if (!motionReduced()) phys.hy.goal = dy > 0 ? softCap(dy * .3,11) : softCap(dy * .34,22);
      kick();
    });
    const release = (event,cancelled = false) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const p = pointer;
      pointer = null;
      phys.dragging = false;
      holds.forEach(q => { q.goal = 0; });
      // a tap (no drag) on a neighbour steps to it, as the event rack's edges do
      if (!p.moved && !cancelled){
        const r = inner.getBoundingClientRect();
        const side = event.clientX < r.left + r.width * .2 ? -1 : event.clientX > r.right - r.width * .2 ? 1 : 0;
        phys.s = rubber(phys.s);
        if (side){ move(side); return; }
        phys.landed = true; kick(); return;
      }
      const outside = phys.s < 0 ? -1 : phys.s > last ? 1 : 0;
      phys.s = rubber(phys.s);
      const idle = performance.now() - p.t;
      const vIdx = clamp(-(idle > 130 ? 0 : p.vx * Math.exp(-idle / 110)) * 1000 / p.spacing,-26,26);
      phys.v = vIdx;
      let next = clamp(Math.round(phys.s),0,last);
      if (!cancelled){
        const throwReach = vIdx * .24 + Math.sign(vIdx) * Math.max(0,Math.abs(vIdx) - 4) * .1;
        const reach = phys.s + throwReach - p.base;
        const steps = Math.abs(reach) < .18 ? 0 : Math.min(8,Math.max(1,Math.round(Math.abs(reach))));
        const wanted = p.base + Math.sign(reach) * steps;
        next = clamp(wanted,0,last);
        if (wanted !== next || outside) phys.wall = wanted < 0 || outside < 0 ? -1 : 1;
        if (Math.abs(vIdx) > 7) sfx('cardDeal');
      }
      if (next === p.base && next === phys.target && !phys.wall && Math.abs(phys.s - next) < .03) phys.landed = true;
      commit(next);
      if (motionReduced()){ snap(); if (phys.wall) jolt(phys.wall); phys.wall = 0; landed(); return; }
      kick();
    };
    inner.addEventListener('pointerup',release);
    inner.addEventListener('pointercancel',event => release(event,true));
    paint();
    return {
      el:rack,
      get index(){ return phys.target; },
      go(i){ const n = clamp(i,0,last); if (n === phys.target) return; commit(n); kick(); },
      refresh(i,html){ if (cards[i]) cards[i].firstElementChild.innerHTML = html; }
    };
  }
  return { create };
})();
