"use strict";

/* ============================================================
   CARD SKIN (candidate, the card pilot: docs/ui/SKIN_PLAN.md)

   Puts the owner's own pixel art on the cards without touching how a card
   is dealt, turned, sized or scored. Every card in the game stays the same
   element with the same size and the same classes; this only lays a picture
   over it (css/card-skin.css: the card's ::after), so glows, dimming, the
   holder's shade and every animation carry on as before.

   The art comes in parts, per size tier (assets/skin/templates/cards/,
   cards.json says where everything lands):
     back    the whole back of a card
     face    a blank face: edge, paper, highlight; no rank or suit
     index   one sheet: the 13 ranks in black, the 13 in red, the four
             small suits, the four big pips
   and a face is put together here: the blank, then the rank, the small
   suit and the big pip at the places the game itself uses (a 10 pushes
   its suit over, as it does now).

   Tiers: L (your hand, 62x88), M (board and deck, 44x62), S (opponents,
   32x46). Any card is drawn from the tier nearest its size. A part the
   owner hasn't drawn for a tier comes from another tier they have drawn
   (scaled), then from the template, which is the game's own card, so a
   half-finished set never shows a hole. A drawing may be any whole
   multiple of its template's size (2x, 3x) for finer pixels.

   Not loaded by the game: skin-lab.html injects it into its copy.
     CardSkin.set({ manifest, art:{ 'L-back':img, 'M-index':img, ... },
                    templates:{ same keys } })   then applies at once
     CardSkin.off()          every card back to the game's own
     CardSkin.compose(t, rank, suit)   a canvas of one face (the lab's deck)
     CardSkin.check(key, img)          { ok, k, want } a drawing's size
   ============================================================ */
const CardSkin = (() => {
  const TIERS = ['L', 'M', 'S'];
  const PARTS = ['back', 'face', 'index'];
  let manifest = null, art = {}, templates = {}, on = false;
  let cache = new Map();          // 'L:A♠' / 'M:back' -> data URL
  let observer = null, sweeping = false;

  /* ---------------- sizes ---------------- */
  function want(key){
    const [t, part] = key.split('-');
    const m = manifest && manifest.tiers[t];
    if (!m) return null;
    if (part === 'back') return { w:m.back.w, h:m.back.h };
    if (part === 'face') return { w:m.w, h:m.h };
    return { w:m.sheet.w, h:m.sheet.h };
  }
  // a drawing is right at 1x or any whole multiple of the template
  function check(key, img){
    const w = want(key);
    if (!w || !img) return { ok:false, k:1, want:w };
    const k = img.naturalWidth / w.w;
    const ok = Number.isInteger(k) && k >= 1 && img.naturalHeight === w.h * k;
    return { ok, k:ok ? k : Math.max(1, Math.round(k)), want:w };
  }

  /* ---------------- which picture for which part ---------------- */
  const own = key => !!art[key];
  // a part: the owner's for this tier, else the owner's for the nearest tier
  // that has one (bigger first), else the template
  function pick(t, part){
    if (own(t + '-' + part)) return { t, img:art[t + '-' + part], own:true };
    const order = { L:['M', 'S'], M:['L', 'S'], S:['M', 'L'] }[t];
    for (const u of order) if (own(u + '-' + part)) return { t:u, img:art[u + '-' + part], own:true };
    return templates[t + '-' + part] ? { t, img:templates[t + '-' + part], own:false } : null;
  }
  // a face needs its blank and its index sheet from the same tier, since
  // the sheet's places belong to that tier's card
  function faceTier(t){
    const score = u => (own(u + '-face') ? 1 : 0) + (own(u + '-index') ? 1 : 0);
    if (score(t) === 2) return t;
    let best = t, bs = score(t);
    ({ L:['M', 'S'], M:['L', 'S'], S:['M', 'L'] })[t].forEach(u => { if (score(u) > bs){ best = u; bs = score(u); } });
    return best;
  }
  const partOf = (u, part) => art[u + '-' + part] || templates[u + '-' + part] || null;

  /* ---------------- drawing ---------------- */
  function canvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  // how much finer than 1x a drawing is (1 when it's the wrong size: it is
  // then stretched to fit, and the lab says so)
  const scaleOf = (key, img) => { const c = check(key, img); return c.ok ? c.k : 1; };

  function compose(t, rank, suit){
    const u = faceTier(t), m = manifest.tiers[u];
    const face = partOf(u, 'face'), sheet = partOf(u, 'index');
    if (!face || !sheet) return null;
    const kf = scaleOf(u + '-face', face), ks = scaleOf(u + '-index', sheet);
    const K = Math.max(kf, ks);
    const [c, x] = canvas(m.w * K, m.h * K);
    x.drawImage(face, 0, 0, m.w * K, m.h * K);
    const gap = manifest.gap, rows = m.sheet.rows;
    const sw = m.sheet.w, sh = m.sheet.h;
    const sx = (sheet.naturalWidth || sw) / sw, sy = (sheet.naturalHeight || sh) / sh;   // the sheet's own pixels per template pixel
    const cell = (col, row, cw, ch, px, py) =>
      x.drawImage(sheet, col * (cw + gap) * sx, row * sy, cw * sx, ch * sy, px * K, py * K, cw * K, ch * K);
    const red = suit === '♥' || suit === '♦';
    const ri = manifest.ranks.indexOf(rank), si = manifest.suits.indexOf(suit);
    const [rw, rh] = m.cell.rank, [uw, uh] = m.cell.suit, [pw, ph] = m.cell.pip;
    cell(ri, red ? rows.rankRed : rows.rankBlack, rw, rh, m.place.rank[rank][0], m.place.rank[rank][1]);
    cell(si, rows.suit, uw, uh, m.place.suit[rank][0], m.place.suit[rank][1]);
    cell(si, rows.pip, pw, ph, m.place.pip[0], m.place.pip[1]);
    return c;
  }
  function backCanvas(t){
    const p = pick(t, 'back'); if (!p) return null;
    const m = manifest.tiers[p.t], k = scaleOf(p.t + '-back', p.img);
    const [c, x] = canvas(m.back.w * k, m.back.h * k);
    x.drawImage(p.img, 0, 0, c.width, c.height);
    return c;
  }
  function urlFor(t, rank, suit){
    const key = t + ':' + (rank ? rank + suit : 'back');
    if (!cache.has(key)){
      const c = rank ? compose(t, rank, suit) : backCanvas(t);
      cache.set(key, c ? { url:c.toDataURL('image/png'), w:c.width } : null);
    }
    return cache.get(key);
  }

  /* ---------------- the cards on screen ---------------- */
  // the tier a card is drawn from: the one nearest its laid-out width
  function tierFor(w){
    let best = 'M', d = Infinity;
    TIERS.forEach(t => { const tw = manifest.tiers[t].w; if (Math.abs(tw - w) < d){ d = Math.abs(tw - w); best = t; } });
    return best;
  }
  // the Settings sheet's back swatches show the game's own backs to choose
  // from, and the cards under the deck's top card only show their edges (a
  // line of trim, a line of ink each): they stay the game's, so the deck
  // still reads as a stack; each is dressed when it comes to the top
  const skip = el => el.classList.contains('card-turning') || el.classList.contains('ds-under') || !!el.closest('.ds-swatch, #deck-back-seg');
  function dress(el){
    if (skip(el)){ undress(el); return; }
    const back = el.classList.contains('back');
    let rank = null, suit = null;
    if (!back){
      const r = el.querySelector('.r'), s = el.querySelector('.s');
      if (!r || !s) return;
      rank = r.textContent.trim(); suit = s.textContent.trim();
      if (manifest.ranks.indexOf(rank) < 0 || manifest.suits.indexOf(suit) < 0) return;
    }
    const w = el.offsetWidth || 44;
    const t = tierFor(w);
    const cls = el.className.replace(/\s*\bskin-(on|shrunk)\b/g, '');
    const key = t + ':' + (back ? 'back' : rank + suit) + ':' + cls + ':' + w;
    if (el.dataset.skin === key) return;
    const u = urlFor(t, rank, suit);
    if (!u){ undress(el); return; }
    const cs = getComputedStyle(el);
    el.style.setProperty('--skin-card', 'url("' + u.url + '")');
    el.style.setProperty('--skin-bt', cs.borderTopWidth); el.style.setProperty('--skin-br', cs.borderRightWidth);
    el.style.setProperty('--skin-bb', cs.borderBottomWidth); el.style.setProperty('--skin-bl', cs.borderLeftWidth);
    // (only touched when they change: every class write is a mutation the
    // watcher sees)
    if (!el.classList.contains('skin-on')) el.classList.add('skin-on');
    // crisp when the picture lands on as many screen pixels as it has or
    // more (an iPhone has three to a CSS pixel); smooth when it's shrunk
    const shrunk = w * (window.devicePixelRatio || 1) < u.w - .5;
    if (el.classList.contains('skin-shrunk') !== shrunk) el.classList.toggle('skin-shrunk', shrunk);
    el.dataset.skin = key;
  }
  function undress(el){
    if (!el.classList.contains('skin-on') && !el.dataset.skin) return;
    if (el.classList.contains('skin-on') || el.classList.contains('skin-shrunk')) el.classList.remove('skin-on', 'skin-shrunk');
    ['--skin-card', '--skin-bt', '--skin-br', '--skin-bb', '--skin-bl'].forEach(p => el.style.removeProperty(p));
    delete el.dataset.skin;
  }
  function sweep(){
    if (sweeping) return;
    sweeping = true;
    try{ document.querySelectorAll('.card').forEach(el => on ? dress(el) : undress(el)); }
    finally{ sweeping = false; }
  }
  function watch(){
    if (observer) return;
    // before paint: a card dealt, turned or copied for a flight is dressed
    // in the same frame it appears
    observer = new MutationObserver(list => {
      if (!on) return;
      for (const m of list){
        if (m.type === 'childList' || (m.target.classList && m.target.classList.contains('card'))){ sweep(); return; }
      }
    });
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    addEventListener('resize', () => { if (on) sweep(); });
  }

  /* ---------------- the controls ---------------- */
  function set(opts){
    manifest = opts.manifest || manifest;
    art = Object.assign({}, opts.art || {});
    templates = Object.assign({}, opts.templates || templates);
    cache = new Map();
    on = !!manifest;
    document.querySelectorAll('.card[data-skin]').forEach(el => { delete el.dataset.skin; });
    watch(); sweep();
  }
  function off(){ on = false; cache = new Map(); sweep(); }
  return { set, off, compose:(t, r, s) => manifest ? compose(t, r, s) : null, back:t => manifest ? backCanvas(t) : null, check, want, get on(){ return on; }, TIERS, PARTS };
})();
