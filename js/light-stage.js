"use strict";

/* ============================================================
   LIGHT STAGE — the lit table (Light Lab, Stage 1 of
   docs/NEXT_LEVEL_PLAN.md). Lab only: never loaded by the game.

   One WebGL canvas behind the felt draws the cloth and the rail at a low
   internal resolution (pixels stay square, scaled up crisp), lit by real
   lights: the lamp over the table, a coloured light under each seat, and
   one event light for moments. Surfaces have normals (the rail's cushion,
   the weave, a printed line), the lamp casts shadows from what stands on
   the felt, and light is quantised into bands with an ordered dither, so
   it reads as pixel art rather than a smooth gradient.

   A second canvas over the table lights the game's own DOM parts (seat
   cards, the pot plate, cards, the deck) with the same lights, through
   soft-light blending, with a lit edge facing the lamp. SHOWCASE adds
   sprites with real normal maps (a face tile, a chip stack, two cards) to
   show what the Stage does once the table's parts move onto it.

   Plain WebGL 1, no dependencies. Coordinates are stage pixels, origin top
   left, y down; light positions use the same frame with z towards you.
   ============================================================ */
const LightStage = (() => {
  const LIGHTS = 8;          // 0 lamp, 1-5 seats, 6 event, 7 spare
  const OCC = 16;            // things that stand on the felt (shadows, DOM light)
  const MARGIN = 18;         // css px of rail and drop shadow around the felt

  const opts = {
    swing:'gentle', flicker:'rare', height:'mid', colour:'warm',
    rail:'game', weave:'fine', print:'gold',
    seats:'on', shadows:'on', domlight:'on', steps:'5', dither:'on', pixels:'3',
    show:'game', stage:'on', touch:'play', fps:'60'
  };
  const LAMP_COLOURS = { warm:[1.0,0.86,0.62], sodium:[1.0,0.70,0.34], cool:[0.74,0.88,1.0], neon:[1.0,0.42,0.86] };
  const SWING = { gentle:[0.06,7.0], still:[0,1], wild:[0.17,3.1] };
  const HEIGHT = { mid:0.78, low:0.46, high:1.25 };

  /* ---------- GLSL ---------- */
  const LIGHTING = `
    uniform vec4 uLP[${LIGHTS}];
    uniform vec4 uLC[${LIGHTS}];
    uniform vec3 uAmb;
    uniform float uSteps, uDither;
    float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float band(float v, float steps){
      float d = (bayer4(gl_FragCoord.xy) - 0.5) * uDither;
      return max(floor(v * steps + 0.5 + d) / steps, 0.0);
    }
    // diffuse light (rgb) and specular (rgb) at P with normal N, banded
    void lightAt(vec3 P, vec3 N, float gloss, float sheen, float lampShadow, out vec3 dif, out vec3 spc){
      dif = uAmb; spc = vec3(0.0);
      for (int i = 0; i < ${LIGHTS}; i++){
        vec3 Ld = uLP[i].xyz - P;
        float dist = length(Ld);
        vec3 L = Ld / max(dist, 0.001);
        float r = uLP[i].w;
        float att = 1.0 / (1.0 + dist * dist / (r * r));
        vec3 c = uLC[i].rgb * att * (i == 0 ? lampShadow : 1.0);
        float ndl = max(dot(N, L), 0.0);
        dif += c * ndl;
        vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
        spc += c * pow(max(dot(N, H), 0.0), gloss);
        dif += c * sheen * (1.0 - N.z) * 2.0;
      }
      if (uSteps > 0.0){
        float I = max(max(dif.r, dif.g), dif.b);
        dif *= band(I, uSteps) / max(I, 0.001);
        float S = max(max(spc.r, spc.g), spc.b);
        spc *= band(S, uSteps * 0.5) / max(S, 0.001);
      }
    }
    float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  `;
  const VS_FULL = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;
  const FS_FELT = `precision highp float;
    uniform vec2 uRes; uniform vec4 uFelt; uniform vec4 uGeo; uniform vec4 uGeo2;
    uniform vec3 uFeltA, uFeltB, uRail, uInk;
    uniform float uWeave, uPrint, uVelvet, uShadowStr, uShadowLen;
    uniform vec4 uOcc[${OCC}]; uniform float uOccH[${OCC}]; uniform float uOccN;
    ${LIGHTING}
    // uFelt: centre xy, half size zw; uGeo: felt radius, rail width, rail height, drop
    // uGeo2: stitch inset, print inset, stage scale, -
    float weave(vec2 p){
      if (uWeave < 0.5) return 0.0;
      vec2 c = uWeave > 1.5 ? floor(p / 2.0) : floor(p);
      return mod(c.x + c.y, 2.0) * 0.14;
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    float height(vec2 p){
      float d = sdRR(p - uFelt.xy, uFelt.zw, uGeo.x);
      if (d > 0.0){ float t = clamp(d / uGeo.y, 0.0, 1.0); return 0.8 + uGeo.z * pow(sin(t * 3.14159), 0.7); }
      return weave(p) - 0.9 * exp(d / 1.2);
    }
    void main(){
      vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
      float d = sdRR(p - uFelt.xy, uFelt.zw, uGeo.x);
      float railW = uGeo.y;
      if (d > railW){
        if (d < railW + 1.0){ gl_FragColor = vec4(uInk, 1.0); return; }
        float ds = sdRR(p - uFelt.xy - vec2(0.0, uGeo.w), uFelt.zw, uGeo.x);
        if (ds < railW + 1.0){ gl_FragColor = vec4(0.0, 0.0, 0.0, 0.5); return; }
        discard;
      }
      float h0 = height(p);
      vec3 N = normalize(vec3(h0 - height(p + vec2(1.0, 0.0)), h0 - height(p + vec2(0.0, 1.0)), 1.0));
      vec3 alb; float gloss = 8.0, spec = 0.04, sheen = 0.0;
      if (d > 0.0){
        if (uVelvet > 0.5){ alb = vec3(0.36, 0.09, 0.12); spec = 0.05; gloss = 5.0; sheen = 0.55; }
        else { alb = uRail; spec = 0.3; gloss = 22.0; }
        if (d < 1.0) alb *= 0.55;
      } else {
        vec2 c = uWeave > 1.5 ? floor(p / 2.0) : floor(p);
        alb = mod(c.x + c.y, 2.0) > 0.5 ? uFeltA : uFeltB;
        alb *= 0.93 + 0.14 * noise(p / 22.0);
        if (abs(d + uGeo2.x) < 0.6 && mod(p.x + p.y, 7.0) < 4.5) alb = vec3(0.03, 0.06, 0.04);
        if (uPrint > 0.5 && abs(d + uGeo2.y) < 0.6){ alb = vec3(0.79, 0.62, 0.22); spec = 0.9; gloss = 28.0; }
      }
      // the lamp's shadows: what stands on the felt, projected away from the lamp
      float sh = 1.0;
      vec3 lp = uLP[0].xyz;
      for (int i = 0; i < ${OCC}; i++){
        if (float(i) >= uOccN) break;
        float hh = uOccH[i] * uShadowLen;
        vec2 q = p + (lp.xy - p) * (hh / max(lp.z, 1.0));
        vec4 r = uOcc[i];
        float sd = sdRR(q - (r.xy + r.zw) * 0.5, (r.zw - r.xy) * 0.5, 1.5);
        float k = 0.6 + hh * 0.06;
        sh = min(sh, mix(1.0 - uShadowStr, 1.0, smoothstep(-k, k, sd)));
      }
      vec3 dif, spc;
      lightAt(vec3(p, h0), N, gloss, sheen, sh, dif, spc);
      gl_FragColor = vec4(alb * dif + spc * spec, 1.0);
    }`;
  const VS_SPRITE = `attribute vec2 aPos; uniform vec2 uRes; uniform vec4 uRect; varying vec2 vUV; varying vec2 vP;
    void main(){ vUV = aPos; vP = uRect.xy + aPos * uRect.zw; vec2 c = vP / uRes * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`;
  const FS_SPRITE = `precision highp float;
    uniform sampler2D uAlb, uNrm; uniform float uH, uGloss; varying vec2 vUV; varying vec2 vP;
    ${LIGHTING}
    void main(){
      vec4 a = texture2D(uAlb, vUV);
      if (a.a < 0.5) discard;
      vec4 n = texture2D(uNrm, vUV);
      vec3 N = normalize(vec3(n.r * 2.0 - 1.0, n.g * 2.0 - 1.0, n.b));
      vec3 dif, spc;
      lightAt(vec3(vP, uH), N, uGloss, 0.0, 1.0, dif, spc);
      gl_FragColor = vec4(a.rgb * min(dif, vec3(1.15)) + spc * n.a * 0.4, 1.0);
    }`;
  const FS_DOM = `precision highp float;
    uniform vec2 uRes; uniform vec4 uOcc[${OCC}]; uniform float uOccH[${OCC}]; uniform float uDomN; uniform float uStr;
    ${LIGHTING}
    void main(){
      vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
      float hit = -1.0; vec4 r = vec4(0.0); float hh = 0.0;
      for (int i = 0; i < ${OCC}; i++){
        if (float(i) >= uDomN) break;
        vec4 o = uOcc[i];
        if (p.x >= o.x && p.x <= o.z && p.y >= o.y && p.y <= o.w){ hit = float(i); r = o; hh = uOccH[i]; }
      }
      if (hit < 0.0) discard;
      vec3 dif, spc;
      lightAt(vec3(p, hh), vec3(0.0, 0.0, 1.0), 12.0, 0.0, 1.0, dif, spc);
      vec3 v = 0.5 * dif + 0.15 * spc;
      // a lit edge on the side facing the lamp, a dark one away from it
      float dl = p.x - r.x, dr = r.z - p.x, dt = p.y - r.y, db = r.w - p.y;
      float m = min(min(dl, dr), min(dt, db));
      if (m < 1.0){
        vec2 n = m == dl ? vec2(-1.0, 0.0) : m == dr ? vec2(1.0, 0.0) : m == dt ? vec2(0.0, -1.0) : vec2(0.0, 1.0);
        float f = dot(n, normalize(uLP[0].xy - p));
        v += f > 0.0 ? vec3(0.28) * f * uLC[0].rgb : vec3(-0.12);
      }
      gl_FragColor = vec4(clamp(v, 0.0, 1.0), uStr);
    }`;

  /* ---------- GL plumbing ---------- */
  function program(gl, vs, fs){
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
    const u = new Proxy({}, { get:(c, k) => k in c ? c[k] : (c[k] = gl.getUniformLocation(p, k)) });
    return { p, u };
  }
  function quad(gl){
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  function texture(gl, data, w, h){
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    return t;
  }
  const hex = c => { const m = /#?([0-9a-f]{6})/i.exec(c || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const cssVar = (name, fallback) => hex(getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

  /* ---------- normal maps for the showcase sprites ---------- */
  // Height = the object's shape (a coin's rounded rim, a tile's bevel and
  // pillow, a card's edge) plus its picture embossed by brightness (ink
  // sits lower than paper); normals from the height's slope.
  function bake(draw, w, h, shape, emboss, spec){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    draw(x, w, h);
    const src = x.getImageData(0, 0, w, h).data;
    const H = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++){
      const k = (y * w + i) * 4, lum = (src[k] * 0.3 + src[k + 1] * 0.59 + src[k + 2] * 0.11) / 255;
      const e = Math.min(i + 0.5, w - i - 0.5, y + 0.5, h - y - 0.5);
      let base = 0;
      if (shape === 'disc'){ const r = Math.hypot(i + 0.5 - w / 2, y + 0.5 - h / 2) / (w / 2); base = r < 1 ? 2.2 * Math.min(1, (1 - r) * 6) + (r < 0.62 && r > 0.5 ? -0.5 : 0) : 0; }
      else if (shape === 'tile'){ const nx = (i + 0.5) / w * 2 - 1, ny = (y + 0.5) / h * 2 - 1; base = Math.min(e, 2) + 1.4 * (1 - (nx * nx + ny * ny) / 2); }
      else base = Math.min(e, 1.2);
      H[y * w + i] = src[k + 3] < 128 ? 0 : base + (lum - 0.5) * emboss;
    }
    const alb = new Uint8Array(w * h * 4), nrm = new Uint8Array(w * h * 4);
    const at = (i, y) => H[Math.min(h - 1, y) * w + Math.min(w - 1, i)];
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++){
      const k = (y * w + i) * 4;
      let nx = at(i, y) - at(i + 1, y), ny = at(i, y) - at(i, y + 1), nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      nrm[k] = (nx * 0.5 + 0.5) * 255; nrm[k + 1] = (ny * 0.5 + 0.5) * 255; nrm[k + 2] = nz * 255; nrm[k + 3] = spec * 255;
      alb[k] = src[k]; alb[k + 1] = src[k + 1]; alb[k + 2] = src[k + 2]; alb[k + 3] = src[k + 3] < 128 ? 0 : 255;
    }
    return { alb, nrm, w, h };
  }
  const SUITS = {
    h:['.XX.XX.','XXXXXXX','XXXXXXX','.XXXXX.','..XXX..','...X...'],
    s:['...X...','..XXX..','.XXXXX.','XXXXXXX','XXXXXXX','...X...','..XXX..']
  };
  function drawCard(rank, suit){
    return (x, w, h) => {
      x.imageSmoothingEnabled = false;
      x.fillStyle = '#080405'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#F3E6C4'; x.fillRect(1, 1, w - 2, h - 2);
      x.fillStyle = '#D9C8A0'; x.fillRect(1, h - 2, w - 2, 1);
      const ink = suit === 'h' ? '#B3262B' : '#140709';
      x.fillStyle = ink; x.font = '8px "Press Start 2P", monospace'; x.textBaseline = 'top'; x.fillText(rank, 3, 3);
      const rows = SUITS[suit], sx = Math.round(w / 2 - 3.5), sy = Math.round(h / 2 - rows.length / 2 + 3);
      rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'X') x.fillRect(sx + i, sy + j, 1, 1); }));
      // crisp: the font's soft edges snap to ink or paper
      const d = x.getImageData(0, 0, w, h), inkRGB = hex(ink).map(v => v * 255);
      for (let y = 1; y < h - 2; y++) for (let i = 1; i < w - 1; i++){
        const k = (y * w + i) * 4, dark = d.data[k] + d.data[k + 1] + d.data[k + 2] < 420;
        d.data.set(dark ? inkRGB : [0xF3, 0xE6, 0xC4], k);
      }
      x.putImageData(d, 0, 0);
    };
  }
  const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

  /* ---------- state ---------- */
  let felt = null, cv = null, ov = null, gl = null, go = null, pF = null, pS = null, pD = null;
  let W = 0, H = 0, scale = 3, box = null, raf = 0, last = 0, frame = 0;
  let sprites = [], spriteReq = 0;
  const lamp = { rest:null, drag:null };
  const occ = { rects:new Float32Array(OCC * 4), h:new Float32Array(OCC), n:0, dom:0 };
  const LP = new Float32Array(LIGHTS * 4), LC = new Float32Array(LIGHTS * 4);
  const seatColour = new Map();
  const fx = { kind:null, t0:0, seat:null, blackout:0, blackTarget:0, flick:1, nextFlick:0, flickUntil:0 };
  const stats = { fps:0, ms:0 };

  function sampleSeatColour(card){
    const img = card.querySelector('img');
    const bg = img ? img.src : (getComputedStyle(card.querySelector('.avatar') || card).backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1];
    if (!bg) return [1.0, 0.72, 0.3];
    if (seatColour.has(bg)) return seatColour.get(bg);
    seatColour.set(bg, [1.0, 0.72, 0.3]);
    loadImg(bg).then(i => {
      if (!i) return;
      const c = document.createElement('canvas'); c.width = c.height = 1;
      const x = c.getContext('2d'); x.drawImage(i, 4, 4, 1, 1, 0, 0, 1, 1);
      const d = x.getImageData(0, 0, 1, 1).data;
      seatColour.set(bg, [d[0] / 255, d[1] / 255, d[2] / 255]);
    });
    return seatColour.get(bg);
  }

  function measure(){
    const r = felt.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    const s = Number(opts.pixels) || 3;
    const w = Math.round((r.width + MARGIN * 2) / s), h = Math.round((r.height + MARGIN * 2) / s);
    box = { x:r.left - MARGIN, y:r.top - MARGIN, w:r.width + MARGIN * 2, h:r.height + MARGIN * 2, fw:r.width, fh:r.height };
    if (w !== W || h !== H || s !== scale){
      W = w; H = h; scale = s;
      [cv, ov].forEach(c => { c.width = W; c.height = H; });
      lamp.rest = null; spriteReq++;
    }
    const b = felt.clientLeft || 0;
    Object.assign(cv.style, { left:-(MARGIN + b) + 'px', top:-(MARGIN + b) + 'px', width:box.w + 'px', height:box.h + 'px' });
    if (catcher) Object.assign(catcher.style, { left:box.x + 'px', top:box.y + 'px', width:box.w + 'px', height:box.h + 'px' });
    ov.style.left = box.x + 'px'; ov.style.top = box.y + 'px'; ov.style.width = box.w + 'px'; ov.style.height = box.h + 'px';
    return true;
  }
  // what stands on the felt, in stage pixels, with a height for shadows
  const STANDING = [['.seat-card', 34], ['#pot-area .pot-chip', 8], ['#board .card', 3], ['#dealer-deck', 12], ['.event-clock', 6]];
  function gather(){
    let n = 0;
    const add = (x0, y0, x1, y1, hgt) => {
      if (n >= OCC) return;
      occ.rects.set([x0, y0, x1, y1], n * 4); occ.h[n] = hgt; n++;
    };
    const seats = [];
    STANDING.forEach(([sel, hgt]) => document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || !el.offsetParent) return;
      if (r.right < box.x || r.left > box.x + box.w || r.bottom < box.y || r.top > box.y + box.h) return;
      add((r.left - box.x) / scale, (r.top - box.y) / scale, (r.right - box.x) / scale, (r.bottom - box.y) / scale, hgt / scale);
      if (sel === '.seat-card') seats.push({ el, r });
    }));
    occ.dom = n;
    if (opts.show === 'showcase') sprites.forEach(sp => add(sp.x, sp.y, sp.x + sp.w, sp.y + sp.h, sp.hgt));
    occ.n = n;
    colours = { a:cssVar('--felt-1', [0.10, 0.23, 0.16]), b:cssVar('--felt-2', [0.08, 0.19, 0.12]), rail:cssVar('--rail', [0.42, 0.26, 0.15]) };
    return seats;
  }
  let seats = [], colours = null;

  function setLight(i, x, y, z, r, rgb, k){
    LP.set([x, y, z, r], i * 4);
    LC.set([rgb[0] * k, rgb[1] * k, rgb[2] * k, 0], i * 4);
  }
  function lights(now){
    LP.fill(0); LC.fill(0);
    for (let i = 0; i < LIGHTS; i++) LP[i * 4 + 3] = 1;
    const t = now / 1000;
    if (!lamp.rest) lamp.rest = { x:W / 2, y:H * 0.5 };
    const [amp, period] = SWING[opts.swing] || SWING.gentle;
    const base = lamp.drag || lamp.rest;
    const sw = Math.sin(t * Math.PI * 2 / period);
    const lx = base.x + sw * amp * W, ly = base.y + Math.sin(t * Math.PI * 2 / period * 0.5) * amp * W * 0.35;
    const lz = W * (HEIGHT[opts.height] || HEIGHT.mid);

    // the flicker: the lamp's own nerves
    if (opts.flicker !== 'off'){
      const nervy = opts.flicker === 'nervous';
      if (now > fx.nextFlick){ fx.flickUntil = now + (nervy ? 60 + Math.random() * 140 : 120 + Math.random() * 160); fx.nextFlick = now + (nervy ? 900 + Math.random() * 2600 : 6000 + Math.random() * 9000); }
      fx.flick = now < fx.flickUntil ? (Math.random() < 0.5 ? 0.45 : 0.85) : (nervy ? 0.94 + Math.random() * 0.06 : 1);
    } else fx.flick = 1;

    // blackout eases in steps
    fx.blackout += Math.sign(fx.blackTarget - fx.blackout) * Math.min(Math.abs(fx.blackTarget - fx.blackout), 0.08);
    const bo = Math.round(fx.blackout * 4) / 4;

    let lampK = 1.95 * fx.flick, lampR = W * 0.72 * (1 - bo * 0.45), amb = 0.17 * (1 - bo * 0.85), seatK = 1.25 * (1 - bo);
    let ev = null;
    const e = (now - fx.t0) / 1000;
    if (fx.kind === 'allin'){
      if (e > 2.6) fx.kind = null;
      else { const pulse = Math.abs(Math.sin(e * Math.PI * 2.4)) * Math.exp(-e * 0.6); lampK *= 0.55 + 0.45 * Math.min(1, e / 2.6); ev = [W / 2, H * 0.98, 16, W * 0.6, [1, 0.12, 0.08], 3.2 * pulse]; }
    } else if (fx.kind === 'bighand'){
      if (e > 2.2) fx.kind = null;
      else { const f = Math.exp(-e * 2.2); lampK *= 1 + 1.1 * f; ev = [W / 2, H * 0.52, 26, W * 0.8, [1, 0.78, 0.3], 7 * f * (e < 0.06 ? 0.4 : 1)]; }
    } else if (fx.kind === 'powercut'){
      if (e > 1.6) fx.kind = null;
      else {
        const off = e > 0.32 && e < 0.95;
        const stutter = (e <= 0.32 || (e >= 0.95 && e < 1.45)) ? (Math.random() < 0.45 ? 0.1 : 1) : 1;
        lampK *= off ? 0 : stutter; seatK *= off ? 0 : stutter; amb *= off ? 0.25 : 1;
      }
    } else if (fx.kind === 'spot' && fx.seat){
      if (e > 2.8) fx.kind = null;
      else {
        const r = fx.seat.getBoundingClientRect();
        const f = Math.min(1, e * 4) * Math.min(1, (2.8 - e) * 2);
        lampK *= 1 - 0.45 * f;
        ev = [(r.left + r.width / 2 - box.x) / scale, (r.bottom - box.y) / scale + 6, 40, W * 0.3, [1, 0.86, 0.45], 3.4 * f];
      }
    }
    const col = LAMP_COLOURS[opts.colour] || LAMP_COLOURS.warm;
    setLight(0, lx, ly, lz, lampR, col, lampK);
    if (opts.seats === 'on') seats.slice(0, 5).forEach((s, i) => {
      const r = s.r;
      setLight(1 + i, (r.left + r.width / 2 - box.x) / scale, (r.bottom - box.y) / scale + 3, 5, W * 0.13, sampleSeatColour(s.el), seatK);
    });
    if (ev) setLight(6, ev[0], ev[1], ev[2], ev[3], ev[4], ev[5]);
    return [amb * (0.75 + col[0] * 0.25), amb * (0.8 + col[1] * 0.2), amb * (0.9 + col[2] * 0.1)];
  }

  // pieces (sprites, the DOM light) take twice the bands and no dither:
  // the checker belongs to the cloth, not to faces and cards
  function common(g, P, amb, piece){
    const steps = opts.steps === 'smooth' ? 0 : Number(opts.steps);
    g.uniform4fv(P.u.uLP, LP); g.uniform4fv(P.u.uLC, LC);
    g.uniform3fv(P.u.uAmb, amb);
    g.uniform1f(P.u.uSteps, piece ? steps * 2 : steps);
    g.uniform1f(P.u.uDither, !piece && opts.dither === 'on' ? 1 : 0);
  }
  function draw(now){
    raf = requestAnimationFrame(draw);
    const dt = now - last;
    if (opts.fps === '30' && dt < 30) return;
    last = now;
    if (dt > 0 && dt < 500){ stats.ms = stats.ms * 0.92 + dt * 0.08; stats.fps = Math.round(1000 / stats.ms); }
    const on = opts.stage === 'on' && felt && document.contains(felt) && measure();
    felt && felt.classList.toggle('ls-on', !!on);
    cv.style.display = ov.style.display = on ? '' : 'none';
    if (!on) return;
    if (frame++ % 3 === 0) seats = gather();
    if (spriteReq) buildSprites();
    const amb = lights(now);
    const s = scale, fw = box.fw / s, fh = box.fh / s, m = MARGIN / s;

    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pF.p); common(gl, pF, amb);
    gl.uniform2f(pF.u.uRes, W, H);
    gl.uniform4f(pF.u.uFelt, m + fw / 2, m + fh / 2, fw / 2, fh / 2);
    gl.uniform4f(pF.u.uGeo, 52 / s, 12 / s, 3.2, 6 / s);
    gl.uniform4f(pF.u.uGeo2, 7 / s, 30 / s, s, 0);
    gl.uniform3fv(pF.u.uFeltA, colours.a); gl.uniform3fv(pF.u.uFeltB, colours.b); gl.uniform3fv(pF.u.uRail, colours.rail);
    gl.uniform3fv(pF.u.uInk, [0.03, 0.016, 0.02]);
    gl.uniform1f(pF.u.uWeave, { flat:0, fine:1, coarse:2 }[opts.weave] || 0);
    gl.uniform1f(pF.u.uPrint, opts.print === 'gold' ? 1 : 0);
    gl.uniform1f(pF.u.uVelvet, opts.rail === 'velvet' ? 1 : 0);
    gl.uniform1f(pF.u.uShadowStr, opts.shadows === 'off' ? 0 : 0.62);
    gl.uniform1f(pF.u.uShadowLen, opts.shadows === 'long' ? 2.2 : 1);
    gl.uniform4fv(pF.u.uOcc, occ.rects); gl.uniform1fv(pF.u.uOccH, occ.h); gl.uniform1f(pF.u.uOccN, opts.shadows === 'off' ? 0 : occ.n);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (opts.show === 'showcase' && sprites.length){
      gl.useProgram(pS.p); common(gl, pS, amb, true);
      gl.uniform2f(pS.u.uRes, W, H);
      gl.uniform1i(pS.u.uAlb, 0); gl.uniform1i(pS.u.uNrm, 1);
      sprites.forEach(sp => {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sp.ta);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sp.tn);
        gl.uniform4f(pS.u.uRect, sp.x, sp.y, sp.w, sp.h);
        gl.uniform1f(pS.u.uH, sp.hgt); gl.uniform1f(pS.u.uGloss, sp.gloss);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    }

    go.viewport(0, 0, W, H); go.clearColor(0, 0, 0, 0); go.clear(go.COLOR_BUFFER_BIT);
    if (opts.domlight === 'on' && occ.dom){
      go.useProgram(pD.p); common(go, pD, amb, true);
      go.uniform2f(pD.u.uRes, W, H);
      go.uniform4fv(pD.u.uOcc, occ.rects); go.uniform1fv(pD.u.uOccH, occ.h); go.uniform1f(pD.u.uDomN, occ.dom);
      go.uniform1f(pD.u.uStr, 0.9);
      go.drawArrays(go.TRIANGLE_STRIP, 0, 4);
    }
  }

  // the showcase: a face tile, a chip stack and two cards, in the open
  // middle of the felt, all with normal maps
  async function buildSprites(){
    const req = spriteReq; spriteReq = 0;
    const s = scale, k = 3 / s;
    const face = await loadImg('assets/faces/0246-smug.PNG');
    const chips = [await loadImg('assets/chips/chip-red-01.png')];
    if (req !== spriteReq && spriteReq) return;
    // one row in the open felt between the seats and the board
    const list = [];
    const fw = Math.round(30 * k), cw = Math.round(26 * k), cdw = Math.round(24 * k), cdh = Math.round(34 * k), g = Math.round(7 * k);
    const row = fw + g + cw + 6 + g + cdw * 2 + 3;
    let x0 = Math.round(W / 2 - row / 2);
    const cy = Math.round(H * 0.4);
    if (face) list.push(Object.assign(bake((x, w, h) => {
      x.fillStyle = '#080405'; x.fillRect(0, 0, w, h);
      x.drawImage(face, 2, 2, w - 4, h - 4);
    }, fw, fw, 'tile', 1.6, 0.85), { x:x0, y:cy - Math.round(fw / 2), hgt:8 * k, gloss:30 }));
    x0 += fw + g;
    // a short stack: the same chip four times, each a step higher
    const chip = chips.find(Boolean);
    if (chip) for (let i = 0; i < 4; i++) list.push(Object.assign(bake((x, w, h) => x.drawImage(chip, 0, 0, w, h), cw, cw, 'disc', 1.6, 0.7),
      { x:x0, y:cy - Math.round(cw / 2) + Math.round(6 * k) - i * Math.round(3 * k), hgt:(2 + i * 2) * k, gloss:24 }));
    x0 += cw + 6 + g;
    [['A', 's'], ['K', 'h']].forEach(([r, su], i) => list.push(Object.assign(bake(drawCard(r, su), cdw, cdh, 'card', 1.2, 0.35),
      { x:x0 + i * (cdw + 3), y:cy - Math.round(cdh / 2), hgt:1.5, gloss:14 })));
    sprites.forEach(sp => { gl.deleteTexture(sp.ta); gl.deleteTexture(sp.tn); });
    sprites = list.map(sp => Object.assign(sp, { ta:texture(gl, sp.alb, sp.w, sp.h), tn:texture(gl, sp.nrm, sp.w, sp.h) }));
  }

  /* ---------- the lamp under your finger ---------- */
  let catcher = null;
  function lampTouch(on){
    if (on && !catcher){
      catcher = document.createElement('div');
      catcher.className = 'ls-catch';
      const to = e => { const r = cv.getBoundingClientRect(); lamp.drag = { x:(e.clientX - r.left) / scale, y:(e.clientY - r.top) / scale }; };
      catcher.addEventListener('pointerdown', e => { catcher.setPointerCapture(e.pointerId); to(e); });
      catcher.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') to(e); });
      catcher.addEventListener('pointerup', () => { if (lamp.drag) lamp.rest = lamp.drag; lamp.drag = null; });
      document.body.appendChild(catcher);
    }
    if (!on && catcher){ catcher.remove(); catcher = null; }
  }

  function mount(){
    if (cv) return true;
    felt = document.getElementById('felt');
    if (!felt) return false;
    cv = document.createElement('canvas'); cv.className = 'ls-stage'; cv.setAttribute('aria-hidden', 'true');
    ov = document.createElement('canvas'); ov.className = 'ls-domlight'; ov.setAttribute('aria-hidden', 'true');
    const attrs = { alpha:true, antialias:false, premultipliedAlpha:false, preserveDrawingBuffer:false };
    gl = cv.getContext('webgl', attrs); go = ov.getContext('webgl', attrs);
    if (!gl || !go){ cv = ov = null; return false; }
    pF = program(gl, VS_FULL, FS_FELT); pS = program(gl, VS_SPRITE, FS_SPRITE); quad(gl);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    pD = program(go, VS_FULL, FS_DOM); quad(go);
    felt.insertBefore(cv, felt.firstChild);
    document.body.appendChild(ov);
    raf = requestAnimationFrame(draw);
    return true;
  }
  function set(patch){
    const pixelsBefore = opts.pixels;
    Object.assign(opts, patch);
    if (opts.pixels !== pixelsBefore) W = 0;
    if ('show' in patch || 'pixels' in patch) spriteReq++;
    lampTouch(opts.touch === 'lamp' && opts.stage === 'on');
  }
  function flash(kind){
    if (kind === 'blackout'){ fx.blackTarget = fx.blackTarget ? 0 : 1; return !!fx.blackTarget; }
    fx.kind = kind; fx.t0 = performance.now();
    if (kind === 'spot'){ const s = [...document.querySelectorAll('.seat-card')].filter(e => e.offsetParent); fx.seat = s[Math.floor(Math.random() * s.length)] || null; }
    return true;
  }
  function centreLamp(){ lamp.rest = null; lamp.drag = null; }
  return { mount, set, flash, centreLamp, opts, stats, get blackout(){ return !!fx.blackTarget; } };
})();
