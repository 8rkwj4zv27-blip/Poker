"use strict";

/* ============================================================
   WORKSHOP RACK — the Workshop's picker (Settings Lab round 5;
   docs/ui/SETTINGS_PLAN.md). Candidate part: lab only for now.

   The Career event rack's feel (js/career-hub-live.js), as one picker
   any list can use: the items sit side by side, the one in the middle
   facing you and the others falling back; you drag it like the event
   tickets, it ratchets through notches you can hear, a throw carries a
   few items, the ends bounce, and the item it lands on rises a little.
   Landing calls onLand(i): the Workshop previews it. Choosing it is a
   separate key (USE THIS), so browsing never changes your setup.

   WorkshopRack.create({ items:[html], index, onLand(i), label(i) })
     -> { el, index, go(i, instant), refresh(i, html) }
   ============================================================ */
const WorkshopRack = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const softCap = (v, lim) => lim * Math.tanh(v / lim);
  const reduced = () => { try{ return motionOff(); }catch(e){ return false; } };
  const snd = (fn, ...a) => { try{ if (Sound[fn]) Sound[fn](...a); }catch(e){} };

  // where an item sits, d items from the middle (as the event rack's
  // cardGeometry, a little tighter: the picks are smaller than tickets)
  function geometry(d){
    const a = Math.min(Math.abs(d), 3);
    const x = a <= 1 ? 74 * a : a <= 2 ? 74 + 30 * (a - 1) : 104;
    return {
      x:(d < 0 ? -1 : 1) * x,
      y:a <= 1 ? 8 * a : 8 + 4 * Math.min(1, a - 1),
      scale:a <= 1 ? 1 - .14 * a : a <= 2 ? .86 - .08 * (a - 1) : .78,
      shade:.5 * Math.min(a, 1.4),
      visible:a < 2.6,
      z:Math.max(1, Math.round(30 - a * 10))
    };
  }

  function create(o){
    const el = document.createElement('div');
    el.className = 'wr-rack';
    el.setAttribute('role', 'listbox');
    el.tabIndex = 0;
    const track = document.createElement('div');
    track.className = 'wr-track';
    el.appendChild(track);
    const items = o.items.map((html, i) => {
      const it = document.createElement('div');
      it.className = 'wr-item'; it.dataset.i = String(i);
      it.setAttribute('role', 'option');
      it.innerHTML = html;
      track.appendChild(it);
      return it;
    });
    const last = items.length - 1;
    const P = { s:clamp(o.index || 0, 0, last), v:0, target:clamp(o.index || 0, 0, last), detent:-1, dragging:false, landed:true, wall:0, lastT:0, rise:0 };
    let raf = 0, ptr = null;
    const rubber = s => s < 0 ? -softCap(-s * .42, .24) : s > last ? last + softCap((s - last) * .42, .24) : s;
    const visualS = () => {
      const s = rubber(P.s);
      if (s < 0 || s > last || reduced()) return s;
      return s - .15 / (2 * Math.PI) * Math.sin(2 * Math.PI * (s - Math.round(s)));
    };
    function paint(){
      const s = visualS();
      items.forEach((it, i) => {
        const g = geometry(i - s), st = it.style;
        const here = Math.abs(i - s) < .5;
        st.transform = 'translate(calc(-50% + ' + g.x.toFixed(2) + '%),' + (g.y - (here ? 6 * P.rise : 0)).toFixed(1) + 'px) scale(' + g.scale.toFixed(3) + ')';
        st.opacity = g.visible ? '1' : '0';
        st.setProperty('--wr-shade', g.shade.toFixed(3));
        st.zIndex = String(g.z);
        it.classList.toggle('is-here', Math.round(s) === i);
        it.setAttribute('aria-selected', Math.round(s) === i ? 'true' : 'false');
      });
    }
    function notch(n, energy){
      if (n === P.detent) return;
      const first = P.detent < 0;
      P.detent = n;
      if (!first) snd('stageRollClick', clamp(energy, .12, 1), false);
    }
    function land(){
      P.landed = true;
      if (P.wall){ snd('koThunk', .45); el.classList.remove('is-stop'); void el.offsetWidth; el.classList.add('is-stop'); P.wall = 0; }
      else snd('cardLanded');
      if (o.onLand) o.onLand(P.target);
    }
    function tick(now){
      raf = 0;
      if (!el.isConnected) return;
      const dt = Math.min(.034, Math.max(.001, (now - (P.lastT || now - 16)) / 1000));
      P.lastT = now;
      const steps = Math.ceil(dt * 120), h = dt / steps;
      for (let n = 0; n < steps; n++){
        if (!P.dragging){
          const zeta = Math.abs(P.s - P.target) > 1.2 ? .88 : .64;
          P.v += (-150 * (P.s - P.target) - 2 * zeta * Math.sqrt(150) * P.v) * h;
          P.v = clamp(P.v, -26, 26);
          P.s += P.v * h;
        }
      }
      const riseGoal = P.dragging ? 0 : clamp(1 - Math.abs(P.s - P.target) * 4, 0, 1);
      P.rise += (riseGoal - P.rise) * Math.min(1, dt * 14);
      notch(clamp(Math.round(visualS()), 0, last), Math.abs(P.v) / 9 + .12);
      if (!P.dragging && !P.landed && Math.abs(P.s - P.target) < .03) land();
      paint();
      const resting = !P.dragging && Math.abs(P.s - P.target) < .0008 && Math.abs(P.v) < .01 && Math.abs(P.rise - riseGoal) < .01;
      if (resting){ P.s = P.target; P.v = 0; P.lastT = 0; paint(); return; }
      raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf){ P.lastT = 0; raf = requestAnimationFrame(tick); } };
    function go(i, instant){
      const next = clamp(i, 0, last);
      if (next === P.target && P.landed){ if (instant){ P.s = next; paint(); } return; }
      P.target = next; P.landed = false;
      if (instant || reduced()){ P.s = next; P.v = 0; P.detent = next; P.rise = 1; paint(); land(); return; }
      kick();
    }
    function step(delta){
      const next = clamp(P.target + delta, 0, last);
      if (next === P.target){ P.wall = delta; if (!reduced()){ P.v += delta * .9; P.landed = false; kick(); } else land(); return; }
      P.v += delta * 3;
      go(next);
    }

    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      P.s = rubber(P.s);
      const w = (items[0] && items[0].offsetWidth) || 100;
      ptr = { id:e.pointerId, x0:e.clientX, y0:e.clientY, lastX:e.clientX, t:performance.now(), vx:0, s0:P.s, base:clamp(Math.round(P.s), 0, last), moved:false, spacing:Math.max(60, w * .74) };
      try{ el.setPointerCapture(e.pointerId); }catch(err){}
      P.dragging = true; P.landed = false; P.v = 0; P.wall = 0;
      kick();
    });
    el.addEventListener('pointermove', e => {
      if (!ptr || ptr.id !== e.pointerId) return;
      const now = performance.now(), span = Math.max(8, now - ptr.t);
      ptr.vx = .5 * ptr.vx + .5 * ((e.clientX - ptr.lastX) / span);
      ptr.lastX = e.clientX; ptr.t = now;
      const dx = e.clientX - ptr.x0;
      if (!ptr.moved && Math.abs(dx) > 9){ ptr.moved = true; snd('cardFlip', false); }
      P.s = ptr.s0 - dx / ptr.spacing;
      kick();
    });
    const release = (e, cancelled) => {
      if (!ptr || ptr.id !== e.pointerId) return;
      const p = ptr; ptr = null;
      P.dragging = false;
      if (!p.moved && !cancelled){
        // a tap: on a side item goes to it; on the middle one does nothing
        const it = e.target.closest && e.target.closest('.wr-item');
        const i = it ? +it.dataset.i : p.base;
        P.s = rubber(P.s);
        if (i !== P.target){ go(i); return; }
        P.landed = true; kick(); return;
      }
      const outside = P.s < 0 ? -1 : P.s > last ? 1 : 0;
      P.s = rubber(P.s);
      const idle = performance.now() - p.t;
      const vIdx = clamp(-(idle > 130 ? 0 : p.vx * Math.exp(-idle / 110)) * 1000 / p.spacing, -26, 26);
      P.v = vIdx;
      // a throw is projected from its release speed: a flick travels a few
      // items, a gentle drag still steps one (the event rack's rule)
      const reach = P.s + vIdx * .24 + Math.sign(vIdx) * Math.max(0, Math.abs(vIdx) - 4) * .1 - p.base;
      const n = Math.abs(reach) < .18 ? 0 : Math.min(8, Math.max(1, Math.round(Math.abs(reach))));
      const wanted = p.base + Math.sign(reach) * n;
      const next = clamp(wanted, 0, last);
      if (wanted !== next || outside) P.wall = wanted < 0 || outside < 0 ? -1 : 1;
      P.target = next; P.landed = false;
      if (reduced()){ P.s = next; P.v = 0; paint(); land(); return; }
      kick();
    };
    el.addEventListener('pointerup', e => release(e, false));
    el.addEventListener('pointercancel', e => release(e, true));
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    });
    paint();
    P.detent = P.target;
    return {
      el,
      get index(){ return P.target; },
      go,
      refresh(i, html){ if (items[i]) items[i].innerHTML = html; }
    };
  }
  return { create };
})();
