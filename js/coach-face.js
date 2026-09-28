"use strict";

/* ============================================================
   COACH FACE (Coach Face Lab, round 1: candidate, lab only)

   The coach's portrait: one of the game's own faces (the 0242-0275
   expression pack) in a colour none of the opponents wear, with glasses
   drawn over it as a vector overlay, so the pair stays put while the
   expression under it changes. He sits on the felt next to your cards,
   on the opposite side from the dealer deck (measured from the deck, so
   Settings → The deck moves him too).

   Presentation only: nothing here reads a hand, a decision or game state.
   Not loaded by the game; coach-face-lab.html injects it into its copy.
   CoachFace.apply(order) takes the picks; CoachFace.faceHTML(order) draws
   a portrait anywhere (the lab's gallery uses it).
   ============================================================ */
const CoachFace = (() => {
  const ART = 'assets/faces/';
  // His moods: a small, calm set (the owner asked for a flat character).
  const MOODS = [
    ['calm', 'CALM', '0264-neutral'],
    ['pleased', 'PLEASED', '0249-neutral'],
    ['impressed', 'IMPRESSED', '0252-happy'],
    ['surprised', 'SURPRISED', '0253-confused'],
    ['wince', 'WINCE', '0275-displeased'],
    ['sympathy', 'UNLUCKY', '0242-worried']
  ];
  // Colours none of the eight opponents use (FACE_COLORS).
  const COLOURS = [
    ['slate', 'SLATE', '#7F8792'],
    ['silver', 'SILVER', '#B4B9C1'],
    ['cream', 'CREAM', '#E3D3AA'],
    ['mustard', 'MUSTARD', '#CF9E33']
  ];
  const FRAMES = { black:'#15131A', gold:'#E3B23C', tortoise:'#7B4A25', silver:'#AEB6BF' };
  const GLINT = '<path d="M15.5,25 Q17.5,19 23.5,17.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" stroke-linecap="round"/>';
  const glint = (dx, dy) => '<g transform="translate(' + dx + ',' + (dy || 0) + ')">' + GLINT + '</g>';
  // The right lens is the left one mirrored about x = 51 (the eyes' centre line).
  const pair = left => left + '<g transform="matrix(-1,0,0,1,102,0)">' + left + '</g>';

  /* Six pairs, drawn on a 100 x 100 face. f = the frame colour. */
  const GLASSES = [
    { id:'browline', name:'BROWLINE', frame:'black', svg:f =>
        pair('<path d="M9,23 C9,49 44,49 44,23" fill="rgba(255,255,255,.07)" stroke="' + FRAMES.gold + '" stroke-width="1.8"/>' +
             '<path d="M7.5,23.5 Q9,15 26.5,15 Q44,15 45.5,22.5" fill="none" stroke="' + f + '" stroke-width="6" stroke-linecap="round"/>' +
             '<path d="M7.5,21 L0,19" stroke="' + f + '" stroke-width="3.4"/>') +
        '<path d="M45,22.5 Q51,18.5 57,22.5" fill="none" stroke="' + FRAMES.gold + '" stroke-width="2"/>' + glint(0, 7) + glint(49, 7) },
    { id:'round', name:'ROUND WIRE', frame:'gold', svg:f =>
        pair('<circle cx="26.5" cy="30" r="16.5" fill="rgba(255,255,255,.08)" stroke="' + f + '" stroke-width="2.6"/>' +
             '<path d="M10,29 L1,26" stroke="' + f + '" stroke-width="2.6" stroke-linecap="round"/>') +
        '<path d="M43,28 Q51,21.5 59,28" fill="none" stroke="' + f + '" stroke-width="2.6"/>' + glint(0) + glint(49) },
    { id:'halfmoon', name:'HALF-MOON READERS', frame:'gold', svg:f =>
        pair('<path d="M9.5,31 H43.5 A17,15 0 0 1 9.5,31 Z" fill="rgba(255,255,255,.1)" stroke="' + f + '" stroke-width="2.8" stroke-linejoin="round"/>' +
             '<path d="M9.5,31.5 L1,28.5" stroke="' + f + '" stroke-width="2.6" stroke-linecap="round"/>') +
        '<path d="M43.5,33 Q51,29 58.5,33" fill="none" stroke="' + f + '" stroke-width="2.6"/>' +
        '<g transform="translate(1,17)">' + GLINT + '</g><g transform="translate(50,17)">' + GLINT + '</g>' },
    { id:'horn', name:'THICK FRAMES', frame:'black', svg:f =>
        pair('<rect x="8.5" y="15.5" width="36" height="29" rx="7" fill="rgba(255,255,255,.07)" stroke="' + f + '" stroke-width="4.6"/>' +
             '<path d="M8.5,21 L0,19" stroke="' + f + '" stroke-width="4.6"/>') +
        '<path d="M44.5,25 L57.5,25" stroke="' + f + '" stroke-width="4.6"/>' + glint(-1, 1) + glint(48, 1) },
    { id:'tinted', name:'TINTED GOLD', frame:'gold', svg:f =>
        pair('<path d="M9,17 H44.5 Q46.5,19 44,32 Q40,46.5 26.5,46.5 Q13,46.5 9.5,33 Q7,21 9,17 Z" fill="rgba(214,160,40,.38)" stroke="' + f + '" stroke-width="2.2" stroke-linejoin="round"/>' +
             '<path d="M9,19 L0,17" stroke="' + f + '" stroke-width="2.2"/>') +
        '<path d="M44.5,18 L57.5,18 M46,24 Q51,21 56,24" fill="none" stroke="' + f + '" stroke-width="2"/>' + glint(0, 1) + glint(49, 1) },
    { id:'ovals', name:'LITTLE OVALS + CHAIN', frame:'silver', svg:f =>
        pair('<ellipse cx="27" cy="34" rx="14" ry="10.5" fill="rgba(255,255,255,.1)" stroke="' + f + '" stroke-width="2.2"/>') +
        '<path d="M41,33 Q51,26 61,33" fill="none" stroke="' + f + '" stroke-width="2"/>' +
        '<path d="M14,39 Q6,66 16,101" fill="none" stroke="' + FRAMES.gold + '" stroke-width="1.5" stroke-dasharray="1.6 1.3"/>' +
        '<g transform="translate(5,13) scale(.8)">' + GLINT + '</g><g transform="translate(53,13) scale(.8)">' + GLINT + '</g>' }
  ];
  const VISOR = '<path d="M0,0 H100 V11 Q51,20 0,11 Z" fill="rgba(46,160,90,.62)"/>' +
    '<path d="M0,11 Q51,20 100,11" fill="none" stroke="#1C5A34" stroke-width="2.2"/>' +
    '<path d="M0,2.5 H100" stroke="rgba(0,0,0,.35)" stroke-width="2"/>';

  const HOUSINGS = [['cabinet', 'MINI CABINET'], ['monitor', 'LITTLE SCREEN'], ['bare', 'JUST THE FACE']];
  const SIZES = { s:60, m:72, l:86 };
  const DEFAULTS = { glasses:'browline', frame:'auto', colour:'slate', visor:'off', housing:'cabinet', size:'m', mood:'calm' };
  let O = Object.assign({}, DEFAULTS);

  const find = (list, id) => list.find(x => (x.id || x[0]) === id) || list[0];
  const colourHex = id => find(COLOURS, id)[2];
  const frameHex = (g, frame) => FRAMES[frame === 'auto' || !FRAMES[frame] ? g.frame : frame];

  /* The face art is authored purple; the same recolour matrix the game
     uses for opponents (faceTintK, js/02-support-systems.js) takes it to
     his colour, so linework and eye whites stay put. */
  const SOURCE = [171, 85, 216];
  function tintK(hex){
    if (typeof faceTintK === 'function') return faceTintK(hex, SOURCE);
    const r0 = SOURCE[0] / 255, mid0 = (SOURCE[1] + SOURCE[2]) / 510;
    return [1, 3, 5].map(i => ((parseInt(hex.slice(i, i + 2), 16) / 255) - mid0) / (r0 - mid0));
  }
  function ensureFilters(){
    if (document.getElementById('coach-tints')) return;
    const defs = COLOURS.map(c => {
      const rows = tintK(c[2]).map(k => { const off = ((1 - k) / 2).toFixed(4); return k.toFixed(4) + ' ' + off + ' ' + off + ' 0 0'; }).join(' ');
      return '<filter id="coach-tint-' + c[0] + '" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' + rows + ' 0 0 0 1 0"/></filter>';
    }).join('');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'coach-tints'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = '<defs>' + defs + '</defs>';
    document.body.appendChild(svg);
  }

  function faceHTML(o){
    o = Object.assign({}, O, o || {});
    ensureFilters();
    const g = find(GLASSES, o.glasses);
    const art = find(MOODS, o.mood)[2];
    return '<span class="cf-face" style="--cf-own:' + colourHex(o.colour) + '">' +
      '<img class="cf-art" src="' + ART + art + '.PNG" alt="" draggable="false" style="filter:url(#coach-tint-' + find(COLOURS, o.colour)[0] + ')">' +
      '<svg class="cf-specs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        (o.visor === 'on' ? VISOR : '') + g.svg(frameHex(g, o.frame)) +
      '</svg></span>';
  }

  /* ---------------- on the table ---------------- */
  let el = null;
  function mount(){
    const felt = document.getElementById('felt');
    if (!felt) return null;
    if (!el || !el.isConnected){
      el = document.createElement('div');
      el.className = 'coach-station';
      el.id = 'coach-station';
      el.setAttribute('aria-label', 'Coach');
      felt.appendChild(el);
    }
    return el;
  }
  function paint(){
    if (!mount()) return;
    el.className = 'coach-station cf-house-' + O.housing;
    el.style.setProperty('--cf-size', SIZES[O.size] + 'px');
    el.style.setProperty('--cf-own', colourHex(O.colour));
    el.innerHTML = '<div class="cf-case">' +
      (O.housing === 'cabinet' ? '<div class="cf-plate">COACH</div>' : '') +
      '<div class="cf-screen">' + faceHTML() + '</div></div>';
    place();
  }
  /* Mirrors the dealer deck: same height on the felt, the other side,
     bottoms level. */
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
  }
  function apply(order){
    O = Object.assign({}, DEFAULTS, order || {});
    paint();
  }
  function setMood(m){ O.mood = m; if (!el) return paint(); const f = el.querySelector('.cf-screen'); if (f){ f.innerHTML = faceHTML(); f.classList.remove('cf-pop'); void f.offsetWidth; f.classList.add('cf-pop'); } }

  function start(){
    apply(O);
    window.addEventListener('resize', place);
    new MutationObserver(() => setTimeout(place, 30)).observe(document.documentElement, { attributes:true, attributeFilter:['data-ds-where', 'data-ds-size'] });
    // the table lays itself out after a deal; settle with it
    [200, 600, 1500, 3000].forEach(t => setTimeout(place, t));
    setInterval(() => { if (el && !el.isConnected) paint(); else place(); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);

  return { apply, setMood, place, faceHTML, MOODS, COLOURS, GLASSES, HOUSINGS, FRAMES, DEFAULTS, get order(){ return Object.assign({}, O); } };
})();
