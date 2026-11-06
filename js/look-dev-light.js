"use strict";

/* ============================================================
   LOOK-DEV LAB — the lamp over the table (Design Language 2, slice 1)

   Lab only (look-dev-lab.html, docs/ui/POLISH_AUDIT_PLAN.md and the
   Design Language 2 plan). A single light source — a lamp hanging above
   the board — lights the felt and everything on it, in two candidates:

   A  'dom'   Fake 3D. A banded (pixel-stepped) pool of lamp light over the
              felt, every card, seat, deck and chip pile throwing a hard
              shadow AWAY from the lamp and carrying a glint that slides as
              it moves. All CSS variables, set here once a frame.
   B  'gl'    The felt itself is lit for real: a WebGL layer under the
              table draws the cloth from a generated height map (the weave,
              a little nap noise), lit per pixel by the lamp as a point
              light, quantised into steps with an ordered dither so it stays
              pixel art (one art pixel = 2 screen points, the felt's own
              check). Objects keep A's shadows and glints.

   Drama runs through one number, the lamp's gain: LookLight.pulse()
   warms or dims it for a moment (a win, a bust), a slow flicker keeps it
   alive, and the seat whose turn it is gets its own small pool.

   No libraries; plain WebGL 1. Presentation only: reads positions, never
   game state beyond what is on screen.
   ============================================================ */
const LookLight = (() => {
  const S = { mode:'off', gain:1, warm:0, flicker:true, spot:true, fps:0, k:1 };   // k: the lamp's strength (the lab's SOFT / MEDIUM / STRONG)
  const LAMP = { x:.5, y:.30, z:.55 };   // in felt space: x,y as fractions, z as height over the cloth (in felt widths)
  let felt = null, pool = null, spotEl = null, gl = null, glCanvas = null, prog = null, raf = 0;
  let pulseT = null, frames = 0, lastFpsAt = 0, frameN = 0;

  const $ = id => document.getElementById(id);
  const root = document.documentElement;

  /* ---------- A: the pool, the spot, shadows and glints ----------
     Shadows and glints are drawn on two layers of their own (one under
     everything on the cloth, one over it) rather than as filters on the
     objects, so no seat or card state that already uses a filter (folded,
     beaten, unlit) is ever overridden. */
  let shadows = null, glints = null;
  const layer = (cls) => { const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-hidden', 'true'); return d; };
  function ensureLayers(){
    felt = $('felt'); if (!felt) return false;
    if (!shadows || !shadows.isConnected){ shadows = layer('ll-shadows'); felt.insertBefore(shadows, felt.firstChild); }
    if (glCanvas && glCanvas.isConnected && shadows.previousSibling !== glCanvas) felt.insertBefore(glCanvas, shadows);
    if (!pool || !pool.isConnected){ pool = layer('ll-pool'); felt.appendChild(pool); }
    if (!spotEl || !spotEl.isConnected){ spotEl = layer('ll-spot'); felt.appendChild(spotEl); }
    if (!glints || !glints.isConnected){ glints = layer('ll-glints'); felt.appendChild(glints); }
    return true;
  }
  // What sits on the cloth and throws a shadow; what is shiny enough to glint.
  const LIT = '#felt .seat-card, #felt .board .card, #felt .seat-cards .card, #felt .dealer-deck, #felt .pot-area:not(.hidden), #felt .event-clock';
  const SHINY = '#felt .board .card:not(.back), #felt .seat-cards .card:not(.back), #felt .dealer-deck';
  const snap = v => Math.round(v / 2) * 2;   // the 2-point art grid
  function pooled(box, n, cls){
    while (box.children.length < n) box.appendChild(document.createElement('i'));
    for (let i = 0; i < box.children.length; i++) box.children[i].style.display = i < n ? '' : 'none';
    return box.children;
  }
  function visibleRect(el){
    if (el.closest('.hidden')) return null;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? r : null;
  }
  function shade(){
    const fr = felt.getBoundingClientRect(); if (!fr.width) return;
    const lx = fr.left + fr.width * LAMP.x, ly = fr.top + fr.height * LAMP.y;
    root.style.setProperty('--ll-lx', Math.round(lx - fr.left) + 'px');
    root.style.setProperty('--ll-ly', Math.round(ly - fr.top) + 'px');
    const reach = fr.width * .9;
    const lit = [...document.querySelectorAll(LIT)].map(el => [el, visibleRect(el)]).filter(x => x[1]);
    const sh = pooled(shadows, lit.length);
    lit.forEach(([el, r], i) => {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = cx - lx, dy = cy - ly, d = Math.hypot(dx, dy) || 1;
      const lift = el.closest('.ll-land') ? 2 : 1;            // a card still settling throws a longer shadow
      const len = Math.min(12, 3 + 9 * d / reach) * lift;
      const q = sh[i].style, rad = getComputedStyle(el).borderRadius;
      q.left = snap(r.left - fr.left + dx / d * len) + 'px'; q.top = snap(r.top - fr.top + dy / d * len + 2) + 'px';
      q.width = Math.round(r.width) + 'px'; q.height = Math.round(r.height) + 'px'; q.borderRadius = rad;
      q.opacity = (.5 * Math.min(1.15, S.gain)).toFixed(2);
    });
    const shiny = [...document.querySelectorAll(SHINY)].map(el => [el, visibleRect(el)]).filter(x => x[1]);
    const gl2 = pooled(glints, shiny.length);
    shiny.forEach(([el, r], i) => {
      const dx = r.left + r.width / 2 - lx;
      const q = gl2[i].style;
      q.left = Math.round(r.left - fr.left) + 'px'; q.top = Math.round(r.top - fr.top) + 'px';
      q.width = Math.round(r.width) + 'px'; q.height = Math.round(r.height) + 'px';
      // the glint slides across the face as the card sits further from the lamp
      q.setProperty('--llg', Math.round(50 - dx / reach * 140) + '%');
    });
    // the turn's own small light
    const act = S.spot && visibleRect(document.querySelector('#felt .seat.active .seat-card') || document.body) && document.querySelector('#felt .seat.active .seat-card');
    if (act){
      const r = act.getBoundingClientRect();
      spotEl.style.left = Math.round(r.left - fr.left + r.width / 2) + 'px';
      spotEl.style.top = Math.round(r.top - fr.top + r.height * .55) + 'px';
      spotEl.classList.add('is-on');
    } else spotEl.classList.remove('is-on');
  }

  /* ---------- the lamp's gain: pulses and the flicker ---------- */
  function gainNow(t){
    let g = S.k, w = 0;
    if (pulseT){
      const k = (t - pulseT.at) / pulseT.ms;
      if (k >= 1) pulseT = null;
      else { const env = k < .15 ? k / .15 : 1 - (k - .15) / .85; g += pulseT.gain * env; w += pulseT.warm * env; }
    }
    if (S.flicker){
      // mostly steady, now and then a tiny gutter: a filament, not a strobe
      const n = Math.sin(t * .0021) * Math.sin(t * .0057 + 1.3);
      if (n > .93) g -= (n - .93) * 1.4;
    }
    S.gain = g; S.warm = w;
    root.style.setProperty('--ll-gain', g.toFixed(3));
    root.style.setProperty('--ll-warm', w.toFixed(3));
  }
  function pulse(kind){
    const P = { win:{ gain:.38, warm:1, ms:1400 }, big:{ gain:.6, warm:1, ms:2000 }, lose:{ gain:-.35, warm:0, ms:1600 }, bust:{ gain:-.6, warm:0, ms:2400 }, hit:{ gain:.25, warm:.4, ms:420 } };
    const p = P[kind]; if (!p) return;
    pulseT = Object.assign({ at:performance.now() }, p);
  }

  /* ---------- B: the lit cloth (WebGL 1) ---------- */
  const VS = 'attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
  const FS = [
    'precision mediump float;',
    'varying vec2 uv;',
    'uniform vec2 res;',          // canvas size in art pixels
    'uniform vec3 lamp;',         // x,y in art pixels (y down), z height in art pixels
    'uniform vec3 c1; uniform vec3 c2;',
    'uniform float gain; uniform float warm; uniform float t;',
    'uniform vec2 spot; uniform float spotOn;',
    'float hash(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }',
    'float noise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }',
    // the cloth's height: a fine weave and a soft nap, so the light rakes across it
    'float h(vec2 q){ float w = (sin(q.x * 3.14159) * .5 + .5) * (sin(q.y * 3.14159 + 1.57) * .5 + .5);',
    '  return w * .5 + noise(q * .21) * .16 + noise(q * .06) * .22; }',
    // a true 4x4 ordered dither (Bayer), so the steps break up evenly, never as noise
    'float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }',
    'float bayer(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }',
    'void main(){',
    '  vec2 q = vec2(uv.x, 1. - uv.y) * res;',      // art-pixel coords, y down
    '  vec2 cell = floor(q);',
    '  float hx = h(cell + vec2(1., 0.)) - h(cell - vec2(1., 0.));',
    '  float hy = h(cell + vec2(0., 1.)) - h(cell - vec2(0., 1.));',
    '  vec3 n = normalize(vec3(-hx, -hy, 2.2));',
    '  vec3 L = vec3(lamp.xy - cell, lamp.z); float d = length(L); L /= d;',
    '  float diff = max(dot(n, L), 0.);',
    '  float fall = 1. / (1. + pow(d / (res.x * .62), 2.4));',
    '  float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 18.) * .25;',
    '  float s = (spotOn > .5) ? .32 / (1. + pow(length(cell - spot) / 26., 2.6)) : 0.;',
    '  float light = (.42 + diff * fall * 1.1 * gain + s) ;',
    // quantise into steps with an ordered dither: lit pixel art, not a smooth gradient
    '  float steps = 7.;',
    '  float lq = floor(light * steps + bayer(cell) * .9) / steps;',
    '  vec3 base = mix(c2, c1, step(.5, fract((cell.x + cell.y) * .5)));',
    '  vec3 lampCol = mix(vec3(1., .94, .80), vec3(1., .80, .52), warm);',
    '  vec3 col = base * lq * lampCol * 1.12 + lampCol * spec * fall * gain * .6;',
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');
  const ART = 2;   // screen points per art pixel (the felt's own check)
  function rgb(v){
    const m = String(v || '').match(/\d+(\.\d+)?/g); if (!m) return [.1, .3, .2];
    if (/^#/.test(String(v).trim())){ const h = String(v).trim().slice(1); const x = h.length === 3 ? h.split('').map(c => c + c).join('') : h; return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16) / 255); }
    return m.slice(0, 3).map(Number).map(c => c / 255);
  }
  function glStart(){
    if (gl) return true;
    glCanvas = document.createElement('canvas'); glCanvas.className = 'll-gl'; glCanvas.setAttribute('aria-hidden', 'true');
    gl = glCanvas.getContext('webgl', { antialias:false, premultipliedAlpha:false, preserveDrawingBuffer:false });
    if (!gl){ glCanvas = null; return false; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return true;
  }
  function glDraw(t){
    if (!gl || !felt) return;
    if (glCanvas.parentNode !== felt) felt.insertBefore(glCanvas, felt.firstChild);   // under the shadows
    const fr = felt.getBoundingClientRect();
    const w = Math.max(2, Math.round(fr.width / ART)), h = Math.max(2, Math.round(fr.height / ART));
    if (glCanvas.width !== w || glCanvas.height !== h){ glCanvas.width = w; glCanvas.height = h; gl.viewport(0, 0, w, h); }
    const cs = getComputedStyle(root);
    const u = n => gl.getUniformLocation(prog, n);
    gl.uniform2f(u('res'), w, h);
    gl.uniform3f(u('lamp'), w * LAMP.x, h * LAMP.y, w * LAMP.z);
    gl.uniform3fv(u('c1'), rgb(cs.getPropertyValue('--felt-1')));
    gl.uniform3fv(u('c2'), rgb(cs.getPropertyValue('--felt-2')));
    gl.uniform1f(u('gain'), S.gain); gl.uniform1f(u('warm'), S.warm); gl.uniform1f(u('t'), t);
    const on = spotEl && spotEl.classList.contains('is-on');
    gl.uniform1f(u('spotOn'), on ? 1 : 0);
    if (on) gl.uniform2f(u('spot'), parseFloat(spotEl.style.left) / ART, parseFloat(spotEl.style.top) / ART);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- the loop ---------- */
  function tick(t){
    raf = 0;
    if (S.mode === 'off') return;
    frames++;
    if (t - lastFpsAt >= 1000){ S.fps = Math.round(frames * 1000 / (t - lastFpsAt)); frames = 0; lastFpsAt = t; }
    const visible = (felt = $('felt')) && !$('table-screen').classList.contains('hidden');
    if (visible && ensureLayers()){
      gainNow(t);
      if ((frameN++ & 1) === 0) shade();   // positions every other frame is plenty
      if (S.mode === 'gl') glDraw(t);
    }
    raf = requestAnimationFrame(tick);
  }
  function setMode(m){
    S.mode = m;
    root.dataset.ll = m;
    if (m === 'gl' && !glStart()){ S.mode = 'dom'; root.dataset.ll = 'dom'; }
    if (m !== 'gl' && glCanvas && glCanvas.parentNode) glCanvas.remove();
    if (m === 'off'){ [pool, spotEl, shadows, glints].forEach(x => x && x.remove()); pool = spotEl = shadows = glints = null; }
    else if (!raf){ lastFpsAt = performance.now(); frames = 0; raf = requestAnimationFrame(tick); }
    return S.mode;
  }
  return { setMode, pulse, set(o){ Object.assign(S, o); }, get state(){ return Object.assign({}, S); }, get fps(){ return S.fps; } };
})();
