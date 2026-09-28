"use strict";

/* ============================================================
   COACH TV (Coach Face Lab, round 2: candidate, lab only)

   Owner, round 2: the coach is a bit of an AI bot. Switch him on and a
   little old CRT set is plonked on the felt next to your cards, plugged
   into the machine, and a digital face comes up on its screen (not one
   of the painted faces). He keeps round 1's thick glasses.

   The screen is the game's own CRT component (.crt, css/crt.css), so its
   glass matches every other screen on the machine; data-ink picks one of
   the component's inks. The face is drawn three ways from the same
   shapes: PIXEL (a coarse grid), DOT MATRIX (lit LEDs on a dim grid) or
   VECTOR (thin glowing lines).

   Presentation only: nothing here reads a hand or game state. Not loaded
   by the game; coach-face-lab.html injects it into its copy.
   CoachTV.apply(order), CoachTV.power(on), CoachTV.setMood(m).
   ============================================================ */
const CoachTV = (() => {
  /* ---- the face: shapes on a 60 x 45 screen, shown cropped to VB ---- */
  const VB = '6 7 48 36';
  const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  // eyes sit well inside the glasses' frames, so the two never run together
  const EYES_CALM = '<rect x="15" y="16" width="10" height="5.5" rx="2"/><rect x="35" y="16" width="10" height="5.5" rx="2"/>';
  const MOODS = [
    ['calm', 'CALM', EYES_CALM + '<rect x="24" y="32" width="12" height="2.6" rx="1"/>'],
    ['pleased', 'PLEASED', '<rect x="15" y="14.5" width="10" height="8" rx="2.5"/><rect x="35" y="14.5" width="10" height="8" rx="2.5"/>' +
      '<path d="M22,31 Q30,37 38,31" ' + S + ' stroke-width="3"/>'],
    ['impressed', 'IMPRESSED', '<rect x="14.5" y="13.5" width="11" height="10" rx="3"/><rect x="34.5" y="13.5" width="11" height="10" rx="3"/>' +
      '<path d="M22,30 H38 Q38,38 30,38 Q22,38 22,30 Z"/>'],
    ['surprised', 'SURPRISED', '<circle cx="20" cy="18.5" r="5"/><circle cx="40" cy="18.5" r="5"/>' +
      '<circle cx="30" cy="34" r="3.2" ' + S + ' stroke-width="2.4"/>'],
    ['wince', 'WINCE', '<path d="M16,15 L24,18.5 L16,22" ' + S + ' stroke-width="3.2"/><path d="M44,15 L36,18.5 L44,22" ' + S + ' stroke-width="3.2"/>' +
      '<path d="M21,34 L25,31 L29,34 L33,31 L37,34" ' + S + ' stroke-width="2.6"/>'],
    ['unlucky', 'UNLUCKY', '<path d="M15,20 L25,17 L25,22.5 L15,22.5 Z"/><path d="M45,20 L35,17 L35,22.5 L45,22.5 Z"/>' +
      '<path d="M22,36 Q30,30.5 38,36" ' + S + ' stroke-width="3"/>'],
    ['thinking', 'THINKING', '<rect x="17" y="13" width="9" height="6" rx="2"/><rect x="37" y="13" width="9" height="6" rx="2"/>' +
      '<rect x="28" y="33" width="9" height="2.6" rx="1"/>'],
    ['talking', 'TALKING', EYES_CALM + '<rect x="24" y="29.5" width="12" height="6.5" rx="2"/>']
  ];
  const BLINK = '<rect x="15" y="18" width="10" height="2" rx="1"/><rect x="35" y="18" width="10" height="2" rx="1"/>';
  // round 1's thick frames, drawn on their own layer, a little dimmer than the face
  const GLASSES = '<g ' + S + ' stroke-width="2.2"><rect x="10.5" y="10" width="19" height="17" rx="3"/><rect x="30.5" y="10" width="19" height="17" rx="3"/>' +
    '<path d="M29.5,15.5 H30.5 M10.5,14 L5,12.5 M49.5,14 L55,12.5"/></g>';

  const moodSVG = id => (MOODS.find(m => m[0] === id) || MOODS[0])[2];
  // blink/talk frames swap only the eyes or the mouth of the current mood
  function shapes(mood, frame){
    let s = moodSVG(mood);
    if (frame === 'blink') s = s.replace(/^(<rect[^>]*\/><rect[^>]*\/>|<circle[^>]*\/><circle[^>]*\/>|<path[^>]*\/><path[^>]*\/>)/, BLINK);
    return s;
  }

  /* PIXEL and DOT MATRIX: the same shapes rasterised onto a coarse grid
     (through a canvas, cached), then drawn as square pixels or as LEDs. */
  const GRID = { pixel:[36, 27], dots:[30, 22] };
  const cache = new Map();
  function raster(style, svgInner){
    const key = style + '|' + svgInner;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    const [gw, gh] = GRID[style];
    const scale = 8;   // draw big, then average each cell, so thin lines survive
    const src = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + VB + '" width="' + gw * scale + '" height="' + gh * scale + '" color="#fff" fill="#fff">' + svgInner + '</svg>';
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = gw * scale; c.height = gh * scale;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const on = [];
        for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++){
          let sum = 0;
          for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) sum += d[(((gy * scale + yy) * c.width) + gx * scale + xx) * 4 + 3];
          if (sum / (scale * scale) > 70) on.push([gx, gy]);
        }
        cache.set(key, on); res(on);
      };
      img.onerror = () => res([]);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }
  async function faceSVG(o, frame){
    const face = shapes(o.mood, frame), specs = o.glasses === 'on' ? GLASSES : '';
    if (o.face === 'vector'){
      // thin glowing lines: fills become outlines
      const thin = svg => svg.replace(/<(rect|circle|path)((?![^>]*stroke=)[^>]*)\/>/g, '<$1$2 fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>')
        .replace(/stroke-width="(3\.2|3|2\.6|2\.4|2\.2)"/g, 'stroke-width="1.6"');
      return '<svg class="ctv-art ctv-art--vector" viewBox="' + VB + '" aria-hidden="true">' + thin(face) + (specs ? '<g class="ctv-specs">' + thin(specs) + '</g>' : '') + '</svg>';
    }
    const [gw, gh] = GRID[o.face] || GRID.pixel;
    const [lit, rim] = await Promise.all([raster(o.face, face), specs ? raster(o.face, specs) : []]);
    const faceCells = new Set(lit.map(p => p[0] + ',' + p[1]));
    const rimOnly = rim.filter(p => !faceCells.has(p[0] + ',' + p[1]));
    if (o.face === 'dots'){
      let dim = '';
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) dim += '<circle cx="' + (gx + .5) + '" cy="' + (gy + .5) + '" r=".36"/>';
      const led = p => '<circle cx="' + (p[0] + .5) + '" cy="' + (p[1] + .5) + '" r=".42"/>';
      return '<svg class="ctv-art ctv-art--dots" viewBox="0 0 ' + gw + ' ' + gh + '" aria-hidden="true"><g class="ctv-dim" fill="currentColor">' + dim + '</g>' +
        '<g class="ctv-specs" fill="currentColor">' + rimOnly.map(led).join('') + '</g><g fill="currentColor">' + lit.map(led).join('') + '</g></svg>';
    }
    const px = p => '<rect x="' + p[0] + '" y="' + p[1] + '" width="1.02" height="1.02"/>';
    return '<svg class="ctv-art ctv-art--pixel" viewBox="0 0 ' + gw + ' ' + gh + '" shape-rendering="crispEdges" aria-hidden="true">' +
      '<g class="ctv-specs" fill="currentColor">' + rimOnly.map(px).join('') + '</g><g fill="currentColor">' + lit.map(px).join('') + '</g></svg>';
  }

  /* ---- the set ---- */
  const CASES = [['portable', 'PORTABLE TV'], ['terminal', 'OLD TERMINAL'], ['testset', 'TEST SET']];
  const FINISHES = [['machine', 'MACHINE'], ['cream', 'CREAM PLASTIC'], ['gunmetal', 'GUNMETAL']];
  const FACES = [['pixel', 'PIXEL'], ['dots', 'DOT MATRIX'], ['vector', 'VECTOR']];
  const INKS = [['info', 'MACHINE GREEN'], ['money', 'GOLD'], ['live', 'BLUE']];
  const CABLES = [['console', 'INTO THE CONSOLE'], ['coiled', 'COILED'], ['none', 'NO CABLE']];
  const POWERS = [['drop', 'PLONKED DOWN + WARMS UP'], ['warm', 'JUST WARMS UP'], ['instant', 'INSTANT']];
  const SIZES = { s:78, m:92, l:106 };
  const DEFAULTS = { case:'portable', finish:'machine', face:'pixel', ink:'info', glasses:'on', cable:'console', power:'drop', size:'m', mood:'calm' };
  let O = Object.assign({}, DEFAULTS);

  function setHTML(o){
    const knobs = '<span class="ctv-knob"></span><span class="ctv-knob ctv-knob--sm"></span>';
    const grille = '<span class="ctv-grille"></span>';
    const side = o.case === 'portable' ? '<span class="ctv-side">' + knobs + grille + '</span>' : '';
    const under = o.case === 'testset' ? '<span class="ctv-under"><span class="ctv-knob ctv-knob--sm"></span><span class="ctv-knob ctv-knob--sm"></span><span class="ctv-knob ctv-knob--sm"></span><span class="ctv-led"></span></span>'
      : o.case === 'terminal' ? '<span class="ctv-under ctv-under--terminal"><span class="ctv-badge">COACH</span><span class="ctv-led"></span></span>' : '';
    const top = o.case === 'portable' ? '<span class="ctv-ears"></span>' : o.case === 'testset' ? '<span class="ctv-handle"></span>' : '';
    const foot = o.case === 'terminal' ? '<span class="ctv-stand"></span>' : '<span class="ctv-feet"></span>';
    return top +
      '<span class="ctv-case">' +
        '<span class="ctv-front"><span class="ctv-bezel"><span class="crt ctv-screen" data-ink="' + o.ink + '" data-crt-quiet><span class="ctv-pic"></span></span></span>' + side + '</span>' +
        under + (o.case === 'portable' ? '<span class="ctv-led ctv-led--front"></span>' : '') +
      '</span>' + foot;
  }
  const CABLE = {
    console:'<svg class="ctv-cable" viewBox="0 0 40 90" aria-hidden="true"><path d="M2,6 C18,8 26,24 22,44 C19,60 24,76 30,90"/></svg>',
    coiled:'<svg class="ctv-cable" viewBox="0 0 40 90" aria-hidden="true"><path d="M2,6 C14,6 20,14 20,22 c-6,0 -6,6 0,6 c6,0 6,6 0,6 c-6,0 -6,6 0,6 c6,0 6,6 0,6 c-6,0 -6,6 0,6 C20,64 26,78 30,90"/></svg>',
    none:''
  };

  /* ---------------- on the table ---------------- */
  let el = null, on = true, blinkT = null, talkT = null, token = 0;
  function mount(){
    const felt = document.getElementById('felt');
    if (!felt) return null;
    if (!el || !el.isConnected){
      el = document.createElement('div');
      el.id = 'coach-station';
      el.setAttribute('aria-label', 'Coach');
      felt.appendChild(el);
    }
    return el;
  }
  async function drawFace(frame){
    if (!el) return;
    const pic = el.querySelector('.ctv-pic');
    if (!pic) return;
    const my = ++token;
    const svg = await faceSVG(O, frame);
    if (my !== token && frame) return;
    pic.innerHTML = svg;
  }
  function paint(){
    if (!mount()) return;
    el.className = 'coach-station ctv ctv-case--' + O.case + ' ctv-finish--' + O.finish + ' ctv-face--' + O.face + (on ? '' : ' is-off');
    el.style.setProperty('--ctv-w', SIZES[O.size] + 'px');
    el.innerHTML = CABLE[O.cable] + setHTML(O);
    place();
    if (on) drawFace();
  }
  /* mirrors the dealer deck: the other side, bottoms level; the cable
     runs out of the back of the set, over the rail, into the console */
  function place(){
    if (!el) return;
    const felt = document.getElementById('felt');
    const st = felt && felt.querySelector('.dealer-station');
    if (!st) return;
    const fr = felt.getBoundingClientRect(), dr = st.getBoundingClientRect();
    if (!fr.width || !dr.width) return;
    const x0 = fr.left + felt.clientLeft, y0 = fr.top + felt.clientTop, w = felt.clientWidth;
    const deckX = dr.left + dr.width / 2 - x0;
    el.style.left = Math.round(w - deckX) + 'px';
    el.style.top = Math.round(dr.bottom - y0) + 'px';
    el.classList.toggle('ctv-left', deckX > w / 2);
  }

  /* idle life: a blink every few seconds */
  function idle(){
    clearTimeout(blinkT);
    if (!on || motionOffSafe()) return;
    blinkT = setTimeout(async () => {
      if (on && O.mood !== 'talking' && !talkT){ await drawFace('blink'); setTimeout(() => { if (on && !talkT) drawFace(); }, 140); }
      idle();
    }, 2600 + Math.random() * 2600);
  }
  const motionOffSafe = () => { try{ return typeof motionOff === 'function' && motionOff(); }catch(e){ return false; } };

  function apply(order){
    O = Object.assign({}, DEFAULTS, order || {});
    paint(); idle();
  }
  function setMood(m){ O.mood = m; stopTalk(); if (on) drawFace(); }
  /* TALKING (lab): the mouth flaps for a moment, as it will under a line */
  function talk(ms){
    stopTalk();
    if (!on) return;
    const was = O.mood; let open = false;
    talkT = setInterval(() => { open = !open; O.mood = open ? 'talking' : was; drawFace(); }, 110);
    setTimeout(() => { stopTalk(); O.mood = was; drawFace(); }, ms || 1800);
  }
  function stopTalk(){ clearInterval(talkT); talkT = null; }

  /* switching him on and off (the dashboard button, in the game) */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let busy = false;
  async function power(want){
    if (busy || want === on) return;
    busy = true;
    try{
      const quick = O.power === 'instant' || motionOffSafe();
      if (want){
        on = true; paint();
        if (!quick){
          if (O.power === 'drop'){ el.classList.add('ctv-drop'); await sleep(420); el.classList.remove('ctv-drop'); }
          el.classList.add('ctv-warm'); await sleep(900); el.classList.remove('ctv-warm');
        }
        idle();
      } else {
        clearTimeout(blinkT); stopTalk();
        if (!quick){
          el.classList.add('ctv-cool'); await sleep(520);
          if (O.power === 'drop'){ el.classList.add('ctv-lift'); await sleep(360); }
        }
        on = false;
        if (el) el.remove();
        el = null;
      }
    } finally { busy = false; }
  }

  function start(){
    apply(O);
    window.addEventListener('resize', place);
    new MutationObserver(() => setTimeout(place, 30)).observe(document.documentElement, { attributes:true, attributeFilter:['data-ds-where', 'data-ds-size'] });
    [200, 600, 1500, 3000].forEach(t => setTimeout(place, t));
    setInterval(() => { if (!on) return; if (!el || !el.isConnected) paint(); else place(); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);

  return { apply, setMood, talk, power, place, faceSVG, setHTML, MOODS, CASES, FINISHES, FACES, INKS, CABLES, POWERS, DEFAULTS,
    get on(){ return on; }, get order(){ return Object.assign({}, O); } };
})();
