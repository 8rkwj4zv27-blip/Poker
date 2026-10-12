/* ============================================================
   THE CARD ALBUM — stills (lab only; collection-book-lab.html)

   The owner's design (12 Oct, docs/career/COLLECTION_BOOK_PLAN.md): CARDS
   brings a big leather-bound book up from below the felt; it drops onto
   the table with a thunk, closed. Open it and the first page holds four
   rows of four. A card you have is bright; one you found but used up is
   very dim; one not found yet is an empty slot. Tap a card and it lights;
   tap again and it comes out to inspect. Numbered tabs along the top show
   where you are; you turn the page by dragging it.

   Five stills, each on the felt (the hub showing round the book) or
   filling the screen. Nothing moves yet: the TUNE key picks the still;
   a swipe across the screen steps through them.
   ============================================================ */
(() => {
  'use strict';
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const PAGES = 5, PER = 16, CW = 82, CH = 120;
  const STILLS = [
    { n:1, name:'JUST LANDED', open:false },
    { n:2, name:'PAGE 1', open:true, page:0 },
    { n:3, name:'A CARD LIT', open:true, page:0, lit:5 },
    { n:4, name:'TURNING', open:true, page:0, turning:true },
    { n:5, name:'PAGE 3', open:true, page:2 }
  ];
  let still = STILLS.some(s => s.n === +state.still) ? +state.still : 1;
  let frame = state.frame === 'full' ? 'full' : 'felt';
  let home, layer, sheet, tune;

  /* ---------------- the placeholder album ---------------- */
  // how organised the book will be is undecided: these 80 slots are
  // placeholders, fuller at the front and emptier towards the back
  const VENUES = ['back-room-five', 'back-room-freezeout', 'pub-open', 'pub-turbo', 'pub-freezeout',
    'card-club-six', 'card-club-deep', 'casino-main', 'back-room-heads-up'];
  const FILL = [.8, .62, .5, .3, .12];
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rarity = () => { const r = rand(); return r < .5 ? 'common' : r < .78 ? 'uncommon' : r < .94 ? 'rare' : 'legendary'; };
  const album = Array.from({ length:PAGES }, (_, p) => Array.from({ length:PER }, (_, i) => {
    const found = rand() < FILL[p], used = rand() < .3;
    if (!found) return { state:'empty' };
    const card = EventCards.make(EventCards.KINDS[(i + p * 3) % 4], rarity(), VENUES[Math.floor(rand() * VENUES.length)], { roster:false });
    return { state:used ? 'used' : 'have', card };
  }));
  // still 3 lights a card you have: the first one at or after slot 5
  const litSlot = page => { const s = album[page].findIndex((x, i) => i >= 5 && x.state === 'have'); return s < 0 ? album[page].findIndex(x => x.state === 'have') : s; };

  /* ---------------- the book ---------------- */
  const corners = '<i class="cb-pc is-tl"></i><i class="cb-pc is-tr"></i><i class="cb-pc is-bl"></i><i class="cb-pc is-br"></i>';
  function slot(x, lit){
    const face = x.card ? `<span class="cb-face">${PokerCollectibleLab.objectHTML(x.card.spec)}</span>` : '';
    return `<div class="cb-slot is-${x.state}${lit ? ' is-lit' : ''}">${face}${corners}</div>`;
  }
  const page = (p, cls, lit = -1) => `<div class="cb-page ${cls}"><div class="cb-grid">${album[p].map((x, i) => slot(x, i === lit)).join('')}</div><i class="cb-gutter"></i></div>`;
  function tabs(at, next){
    return `<div class="cb-tabs">${Array.from({ length:PAGES }, (_, i) => `<b class="cb-tab${i === at ? ' is-at' : ''}${i === next ? ' is-next' : ''}">${i + 1}</b>`).join('')}</div>`;
  }
  function closedHTML(){
    return `<div class="cb-closed">
      <div class="cb-back"></div>
      <div class="cb-edges"></div>
      <div class="cb-cover">
        <i class="cb-spine"></i>
        <i class="cb-tool"></i>
        <i class="cb-plaque"><b>&spades;</b></i>
        <i class="cb-cnr is-tl"></i><i class="cb-cnr is-tr"></i><i class="cb-cnr is-bl"></i><i class="cb-cnr is-br"></i>
      </div>
    </div>`;
  }
  function openHTML(s){
    const p = s.page, lit = s.lit != null ? litSlot(p) : -1;
    const leaves = s.turning
      ? page(p + 1, 'is-under') + `<i class="cb-cast"></i>` + page(p, 'is-turning')
      : page(p, 'is-top', lit);
    return `<div class="cb-open">
      <div class="cb-board"><i class="cb-hinge"></i></div>
      ${tabs(p, s.turning ? p + 1 : -1)}
      <div class="cb-block">
        <div class="cb-stack"></div>
        <div class="cb-leaves">${leaves}</div>
      </div>
    </div>`;
  }

  /* ---------------- where it sits ---------------- */
  // on the felt: inside the hub's felt, sized to its four rows, a strip of
  // felt showing round it; full screen: the whole of the game's frame, the
  // rows spread down the page
  function place(){
    const h = home.getBoundingClientRect(), full = frame === 'full';
    let r = { left:0, top:0, width:h.width, height:h.height };
    if (!full){
      const f = document.querySelector('.cm-felt').getBoundingClientRect();
      r = { left:f.left - h.left + 16, top:f.top - h.top + 16, width:f.width - 32, height:f.height - 32 };
    }
    // the cards: as big as four across allow (and four rows down)
    const board = full ? 12 : 9, tabH = 22, stack = 6, pad = 10, gx = 7;
    const iw = r.width - board * 2 - 10 - stack - pad * 2 - 8;
    const ih = r.height - board * 2 - tabH - stack - pad * 2;
    const cw = Math.max(36, Math.floor(Math.min((iw - gx * 3) / 4, (ih - 27) / 4 * CW / CH)));
    const ch = Math.round(cw * CH / CW);
    const gy = full ? Math.min(64, Math.floor((ih - ch * 4) / 5)) : 9;
    if (!full){
      const need = ch * 4 + gy * 3 + board * 2 + tabH + stack + pad * 2 + 8;
      r.top += Math.max(0, (r.height - need) / 2); r.height = Math.min(r.height, need);
    }
    Object.assign(layer.style, { left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', height:r.height + 'px' });
    layer.style.setProperty('--cb-cw', cw + 'px');
    layer.style.setProperty('--cb-ch', ch + 'px');
    layer.style.setProperty('--cb-gy', gy + 'px');
    layer.style.setProperty('--cb-k', (cw / 164).toFixed(4));
    layer.style.setProperty('--cb-board', board + 'px');
  }

  function render(){
    const s = STILLS.find(x => x.n === still);
    layer.className = 'cb-layer is-' + frame;
    layer.innerHTML = `<div class="cb-book">${s.open ? openHTML(s) : closedHTML()}</div>`;
    place();
    sheet.querySelectorAll('[data-still]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.still === still)));
    sheet.querySelectorAll('[data-frame]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.frame === frame)));
    if (host) host.set({ still, frame });
  }
  const step = d => { still = (still - 1 + d + STILLS.length) % STILLS.length + 1; render(); };

  /* ---------------- the lab's key and sheet ---------------- */
  function build(){
    home = document.getElementById('home');
    layer = document.createElement('div');
    tune = document.createElement('button');
    tune.type = 'button'; tune.className = 'icon-btn cb-tune'; tune.textContent = 'TUNE'; tune.setAttribute('aria-label', 'Tune');
    sheet = document.createElement('section');
    sheet.className = 'po-sheet cm-sheet cb-sheet'; sheet.hidden = true; sheet.setAttribute('aria-label', 'Tune');
    sheet.innerHTML = `
      <h2>THE CARD ALBUM</h2>
      <p>Stills, nothing moves yet. Bright: a card you have. Very dim: found, used up. Empty slot: not found yet. The cards are placeholders. Swipe across the screen for the next still.</p>
      <h3>STILL</h3>
      <div class="cm-seg">${STILLS.map(s => `<button class="pc-button pc-button-secondary" data-still="${s.n}">${s.n}</button>`).join('')}</div>
      <div class="cb-names">${STILLS.map(s => `<span>${s.n} ${s.name}</span>`).join('')}</div>
      <h3>THE BOOK</h3>
      <div class="cm-seg"><button class="pc-button pc-button-secondary" data-frame="felt">ON THE FELT</button><button class="pc-button pc-button-secondary" data-frame="full">FULL SCREEN</button></div>
      <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cb-done">DONE</button></div>`;
    home.append(layer, tune, sheet);
    const hubTune = document.getElementById('cm-tune');
    if (hubTune) hubTune.style.visibility = 'hidden';
    tune.onclick = () => { sheet.hidden = !sheet.hidden; };
    sheet.querySelector('#cb-done').onclick = () => { sheet.hidden = true; };
    sheet.querySelectorAll('[data-still]').forEach(b => b.onclick = () => { still = +b.dataset.still; render(); });
    sheet.querySelectorAll('[data-frame]').forEach(b => b.onclick = () => { frame = b.dataset.frame; render(); });
    // a swipe across the book: the next (or last) still
    let sx = null, sy = 0;
    layer.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    layer.addEventListener('pointerup', e => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    });
    layer.addEventListener('pointercancel', () => { sx = null; });
    new ResizeObserver(place).observe(home);
    render();
  }
  function start(){
    if (document.querySelector('#cm .cm-felt') && window.PokerCollectibleLab) build();
    else requestAnimationFrame(start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
