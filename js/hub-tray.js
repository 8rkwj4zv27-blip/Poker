/* ============================================================
   HUB TRAY — the Career hub as stills (lab only, nothing moves)

   The owner's brief (12 Oct): a clean felt. In its top third a small
   rectangular wooden tray, a stitched seam round it, where three cards
   are laid out, each named for why it was dealt: REGULAR · STEP UP ·
   BIG ONE. The middle key is REDEAL (the three swept off, three more
   tossed in); with a card swiped up into the feeder it's PLAY. After the
   shop the tray holds the packets to open instead; an opened packet's
   cards lie piled on the felt and the middle key says ADD (they're
   gathered into the collection). The cabinet is the reel and the feeder
   only: no CRTs.

   Four stills (TUNE): the hand, a card in the feeder, packets waiting,
   a packet opened. Two trays (a flush inlay, a sunk tray) and two ways
   of naming the places (burnt into the wood, or paper tags that come
   and go with the cards).
   ============================================================ */
(() => {
  'use strict';
  const CW = 82, CH = 120;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const saved = host ? host.state : {};

  const SCENES = { hand:'THE HAND', fed:'IN THE FEEDER', packets:'PACKETS', opened:'OPENED' };
  const TRAYS = { inlay:'FLUSH INLAY', sunk:'SUNK TRAY' };
  const NAMES = { burnt:'BURNT IN', tags:'PAPER TAGS' };
  const WAITING = { open:'OPEN', unlit:'UNLIT' };
  const PLACES = ['REGULAR', 'STEP UP', 'BIG ONE'];
  const pickOf = (o, v, d) => o[v] ? v : d;
  const look = {
    scene:pickOf(SCENES, saved.scene, 'hand'), tray:pickOf(TRAYS, saved.tray, 'inlay'),
    names:pickOf(NAMES, saved.names, 'burnt'), waiting:pickOf(WAITING, saved.waiting, 'open')
  };

  let root, felt, stage, trayEl, slotEl, mouthEl;
  let s = 1, things = [];
  const $ = q => root.querySelector(q);

  // the cards and packets the stills show (the lab's placeholders)
  const HAND = [['table', 'common', 'back-room-five'], ['freezeout', 'uncommon', 'pub-open'], ['table', 'rare', 'casino-main']];
  const PILE = [['table', 'common', 'pub-turbo'], ['bomb', 'common', 'card-club-deep'], ['freezeout', 'uncommon', 'pub-freezeout'], ['table', 'rare', 'card-club-six']];
  const PACKETS = [['club', 'pub'], ['house'], ['highroller']];   // per place, bottom first
  let hand, pile;

  /* ---------------- the cabinet ---------------- */
  function reel(n){
    const digits = String(Math.max(0, Math.round(n))).padStart(7, '0');
    let lead = true;
    return '<span class="jp-cell jp-sym">$</span>' + [...digits].map(d => {
      lead = lead && d === '0';
      return `<span class="jp-cell jp-digit${lead ? ' is-leading' : ''}"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${d}</span><span>${d}</span></span></span></span>`;
    }).join('');
  }

  /* ---------------- build ---------------- */
  const seg = (key, opts) => `<div class="cm-seg" data-key="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;
  function build(){
    root = document.createElement('main');
    root.id = 'cm'; root.className = 'lobby-card pc-housing ht';
    root.innerHTML = `
      <header class="cm-rail"><button class="icon-btn cm-icon" type="button" aria-label="Back"><i class="ci-arrow is-left"></i></button><span class="cm-title">CAREER</span><button class="icon-btn cm-icon" id="cm-tune" type="button" aria-label="Tune">TUNE</button></header>
      <div class="cm-cabinet ht-cabinet">
        <div class="ch2-bankroll-housing cm-bank"><div class="ch2-bankroll-reel" id="cm-reel"></div></div>
        <div class="ht-feeder"><b class="ht-plate">INSERT CARD</b><div class="ht-mouth"><i class="ht-throat"></i></div></div>
      </div>
      <section class="cm-felt ht-felt" data-theme="emerald"><div class="felt">
        <div class="ht-tray"><div class="ht-wood">${PLACES.map((n, i) => `<div class="ht-place" data-i="${i}"><i class="ht-spot"></i><b class="ht-name">${n}</b></div>`).join('')}</div></div>
        <div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>
      </div></section>
      <footer class="cm-console"><div class="cm-console-case"><div class="ec-bay"><div class="actions-row cm-keys"><button class="btn-check" type="button" data-key="shop">SHOP</button><button class="btn-raise" type="button" data-key="mid">REDEAL</button><button class="btn-check" type="button" data-key="cards">CARDS</button></div></div></div></footer>
      <section class="po-sheet cm-sheet" id="cm-sheet" hidden aria-label="Tune">
        <h2>CAREER · THE TRAY</h2>
        <p>Stills: nothing moves yet. Pick a moment, a tray and how the places are named.</p>
        <h3>MOMENT</h3>${seg('scene', SCENES)}
        <h3>TRAY</h3>${seg('tray', TRAYS)}
        <h3>NAMES</h3>${seg('names', NAMES)}
        <h3>MIDDLE KEY WITH PACKETS WAITING</h3>${seg('waiting', WAITING)}
        <div class="cm-seg"><button class="pc-button pc-button-secondary" id="cm-done">DONE</button></div>
      </section>`;
    document.body.classList.add('cm-lab');
    const home = document.getElementById('home');
    home.classList.add('cm-home'); home.classList.remove('hidden');
    [...home.classList].filter(c => c.startsWith('hb-')).forEach(c => home.classList.remove(c));
    home.append(root);
    felt = $('.cm-felt > .felt');
    stage = { el:felt, objects:felt.querySelector('.po-objects'), shadows:felt.querySelector('.po-shadows'), fx:felt.querySelector('.po-fx') };
    trayEl = $('.ht-tray'); slotEl = $('.ht-feeder'); mouthEl = $('.ht-mouth');
    $('#cm-reel').innerHTML = reel(12650);
    $('#cm-tune').onclick = () => { $('#cm-sheet').hidden = !$('#cm-sheet').hidden; };
    $('#cm-done').onclick = () => { $('#cm-sheet').hidden = true; };
    root.querySelectorAll('.cm-seg[data-key] button').forEach(b => b.onclick = () => {
      const key = b.parentNode.dataset.key;
      look[key] = b.dataset.v;
      if (host) host.set({ [key]:look[key] });
      draw();
    });
    hand = HAND.map(a => EventCards.make(...a));
    pile = PILE.map(a => EventCards.make(...a));
  }
  function marks(){ root.querySelectorAll('.cm-seg[data-key] button').forEach(b => b.setAttribute('aria-pressed', String(look[b.parentNode.dataset.key] === b.dataset.v))); }

  /* ---------------- sizes ---------------- */
  // three cards across the tray, as big as the felt allows
  function measure(){
    const W = felt.clientWidth;
    s = Math.min(1.3, (W - 64) / (CW * 3 + 28));
    root.style.setProperty('--ht-card-w', Math.round(CW * s) + 'px');
    root.style.setProperty('--ht-card-h', Math.round(CH * s) + 'px');
  }
  // the middle of a place's card spot, in the felt's own coordinates
  function spot(i){
    const r = $(`.ht-place[data-i="${i}"] .ht-spot`).getBoundingClientRect(), f = felt.getBoundingClientRect();
    return { x:r.left + r.width / 2 - f.left, y:r.top + r.height / 2 - f.top };
  }
  // where a card comes out of the feeder: the mouth's lower lip
  function mouth(){
    const r = mouthEl.getBoundingClientRect(), f = felt.getBoundingClientRect();
    return { x:r.left + r.width / 2 - f.left, y:r.bottom - 4 - f.top };
  }

  /* ---------------- the things on the felt ---------------- */
  function clear(){ things.forEach(t => t.body.remove()); things = []; }
  function card(c, pose, { cls } = {}){
    const it = CardInspect.make(stage, c, { side:'face' });
    it.el.classList.add('cm-card'); if (cls) it.el.classList.add(cls);
    it.body.set({ z:0, sx:1, sy:1, alpha:1, s, ...pose });
    it.body.render(performance.now());
    things.push(it);
    return it;
  }
  function packet(series, pose){
    const p = new POPacket.Packet(stage, series, 0);
    p.tagEl.hidden = true;
    p.body.set({ z:0, sx:1, sy:1, alpha:1, s:CH * s / POPacket.AH, ...pose });
    p.body.render(performance.now());
    things.push(p);
    return p;
  }
  // a card lying in its place: square, but laid by hand
  const SKEW = [-2, 1, -1];

  /* ---------------- the stills ---------------- */
  function keys(mid, { lit = true } = {}){
    const b = $('[data-key="mid"]');
    b.textContent = mid; b.classList.toggle('ht-unlit', !lit);
  }
  function draw(){
    marks();
    measure();
    clear();
    root.dataset.tray = look.tray; root.dataset.names = look.names; root.dataset.scene = look.scene;
    const plate = $('.ht-plate');
    plate.textContent = 'INSERT CARD'; slotEl.classList.remove('is-fed');
    // the tags are on the tray only while cards are on it
    const tagged = look.scene === 'hand' || look.scene === 'fed';
    root.querySelectorAll('.ht-place').forEach(p => p.classList.toggle('has-tag', tagged));
    if (look.scene === 'hand'){
      hand.forEach((c, i) => card(c, { ...spot(i), r:SKEW[i] }));
      keys('REDEAL');
    }
    if (look.scene === 'fed'){
      // STEP UP was swiped up: it hangs half into the feeder, its place empty
      [0, 2].forEach(i => card(hand[i], { ...spot(i), r:SKEW[i] }));
      const m = mouth(), it = card(hand[1], { x:m.x, y:m.y, r:0 }, { cls:'ht-fed' });
      it.el.style.zIndex = '90';
      it.el.style.clipPath = `inset(${CH / 2}px 0 0 0)`;
      it.body.sh?.remove();
      const d = EventCards.describe(hand[1]);
      plate.textContent = (d.venue + ' · ' + d.title).toUpperCase();
      slotEl.classList.add('is-fed');
      keys('PLAY');
    }
    if (look.scene === 'packets' || look.scene === 'opened'){
      // the packets wait in the places, stacked where there are two
      const left = look.scene === 'opened' ? PACKETS.map((a, i) => i === 0 ? a.slice(0, 1) : a) : PACKETS;
      left.forEach((stack, i) => stack.forEach((series, k) => packet(series, { ...spot(i), y:spot(i).y - k * 4, x:spot(i).x + k * 3, r:SKEW[i] + k * 3 })));
      if (look.scene === 'packets') keys('OPEN', { lit:look.waiting === 'open' });
    }
    if (look.scene === 'opened'){
      // one opened: its cards dropped in a loose pile on the open felt
      const W = felt.clientWidth, H = felt.clientHeight, t = trayEl.offsetTop + trayEl.offsetHeight;
      const cx = W / 2, cy = t + (H - t) * .5;
      const fan = [[-34, 10, -14], [-8, -6, -4], [20, 4, 9], [40, -2, 18]];
      pile.forEach((c, i) => card(c, { x:cx + fan[i][0] * s, y:cy + fan[i][1] * s, r:fan[i][2] }));
      keys('ADD');
    }
  }

  /* ---------------- start ---------------- */
  function setup(){
    build();
    requestAnimationFrame(() => {
      draw();
      // the packets' art arrives a moment later; the stills redraw on resize
      let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 80); }).observe(felt);
    });
  }
  window.HubTray = { get look(){ return { ...look }; }, draw };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
