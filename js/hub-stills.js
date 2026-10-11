/* ============================================================
   CAREER HUB STILL — the simplified hub, still, for the owner to judge
   (lab only; nothing moves).

   The owner's brief (11 Oct): the bankroll reel full width across the top
   of the cabinet; the plain card slot in the middle, a card wide, a CRT
   either side, all three slim and level; the felt with the cards thrown
   well apart; the deck in a corner (tap: another card; hold: the cards fly
   back and three fresh are dealt); the chips in the corner laid out as the
   game lays out the player's bank (CoinWorld's rack: rows of stacks
   stepping up to the back), sized by the bankroll; the dashboard key bay
   SHOP · PLAY · CARDS. Every part is the game's own.
   ============================================================ */
(() => {
  'use strict';
  // the two screens, three ways (TUNE): they share one grid either way
  const SCREENS = {
    pair:{ name:'LABEL + FIGURE', l:['IN HAND', '3'], r:['PLAYED', '14'] },
    big:{ name:'BIG FIGURE', l:['3', 'CARDS'], r:['2ND', 'BEST'] },
    lamp:{ name:'ONE LINE', l:['3 CARDS'], r:['14 TABLES'] }
  };
  const BANKS = [620, 12650, 186400];
  const DEALS = [3, 4, 5];
  const CW = 82, CH = 120;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  // what's on show: the screens, how many cards are out, the bankroll
  const look = { screens:SCREENS[state.screens] ? state.screens : 'pair', deal:+state.deal || 3, bank:+state.bank || BANKS[1] };
  let root, felt;
  const $ = s => root.querySelector(s);

  /* the full-width bankroll reel: the production Career part */
  function reel(n){
    const digits = String(Math.max(0, Math.round(n))).padStart(7, '0');
    let lead = true;
    return '<span class="jp-cell jp-sym">$</span>' + [...digits].map(d => {
      lead = lead && d === '0';
      return `<span class="jp-cell jp-digit${lead ? ' is-leading' : ''}"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${d}</span><span>${d}</span></span></span></span>`;
    }).join('');
  }
  // the two screens share one grid, so their lines sit at the same heights
  function crt(kind, side){
    const t = SCREENS[kind][side];
    if (kind === 'pair') return `<div class="crt hs-crt is-pair"><span class="crt-caption">${t[0]}</span><span class="crt-figure crt-figure--lg">${t[1]}</span></div>`;
    if (kind === 'big') return `<div class="crt hs-crt is-big"><span class="crt-figure crt-figure--lg">${t[0]}</span><span class="crt-caption">${t[1]}</span></div>`;
    return `<div class="crt hs-crt is-lamp"><span class="crt-row"><i class="crt-lamp"></i><span class="crt-line">${t[0]}</span></span></div>`;
  }
  const SLOT = '<div class="hs-slot"><div class="hs-mouth"><i class="hs-throat"></i></div><b class="hs-slot-label">INSERT CARD</b></div>';
  const seg = (key, opts) => `<div class="hs-seg" data-key="${key}">${Object.entries(opts).map(([v, n]) => `<button class="pc-button pc-button-secondary" data-v="${v}">${n}</button>`).join('')}</div>`;

  function build(){
    root = document.createElement('main');
    root.id = 'hs'; root.className = 'lobby-card pc-housing';
    root.innerHTML = `
      <header class="hs-rail"><button class="icon-btn hs-icon" type="button" aria-label="Back"><i class="ci-arrow is-left"></i></button><span class="hs-title">CAREER</span><button class="icon-btn hs-icon" id="hs-tune" type="button" aria-label="Pick a still">TUNE</button></header>
      <div class="hs-cabinet">
        <div class="ch2-bankroll-housing hs-bank"><div class="ch2-bankroll-reel" id="hs-reel"></div></div>
        <div class="hs-row"><div class="hs-crt-l"></div>${SLOT}<div class="hs-crt-r"></div></div>
      </div>
      <section class="hs-felt" data-theme="emerald"><div class="felt"></div><i class="hs-spread"></i><div class="hs-objects"></div></section>
      <footer class="hs-console"><div class="ec-bay"><div class="actions-row hs-keys"><button class="btn-check" type="button">SHOP</button><button class="btn-raise" type="button">PLAY</button><button class="btn-check" type="button">CARDS</button></div></div></footer>
      <section class="po-sheet hs-sheet" id="hs-sheet" hidden aria-label="Pick a still">
        <h2>CAREER HUB · STILL 3</h2>
        <p>Tap the deck for another card; hold it and the cards fly back and three fresh are dealt. Try the screens, a fourth or fifth card, and the bankroll the chips are counted from.</p>
        <h3>SCREENS</h3>${seg('screens', Object.fromEntries(Object.entries(SCREENS).map(([k, v]) => [k, v.name])))}
        <h3>CARDS OUT</h3>${seg('deal', Object.fromEntries(DEALS.map(n => [n, String(n)])))}
        <h3>BANKROLL</h3>${seg('bank', Object.fromEntries(BANKS.map(b => [b, '$' + b.toLocaleString('en-US')])))}
        <div class="hs-seg"><button class="pc-button pc-button-secondary" id="hs-done">DONE</button></div>
      </section>`;
    document.body.classList.add('hs-lab');
    const home = document.getElementById('home');
    home.classList.add('hs-home'); home.classList.remove('hidden');
    [...home.classList].filter(c => c.startsWith('hb-')).forEach(c => home.classList.remove(c));
    const oldFelt = document.getElementById('felt'); if (oldFelt) oldFelt.id = 'hs-parked-felt';
    home.append(root);
    felt = root.querySelector('.hs-felt');
    felt.querySelector('.felt').id = 'felt';
    $('#hs-tune').onclick = () => { $('#hs-sheet').hidden = !$('#hs-sheet').hidden; };
    $('#hs-done').onclick = () => { $('#hs-sheet').hidden = true; };
    root.querySelectorAll('.hs-seg[data-key] button').forEach(b => b.onclick = () => {
      const key = b.parentNode.dataset.key;
      look[key] = key === 'screens' ? b.dataset.v : +b.dataset.v;
      save({ [key]:look[key] }); render();
    });
  }
  function save(o){ if (host) host.set(o); }

  /* ---------------- one still ---------------- */
  function render(){
    $('#hs-reel').innerHTML = reel(look.bank);
    $('.hs-crt-l').innerHTML = crt(look.screens, 'l');
    $('.hs-crt-r').innerHTML = crt(look.screens, 'r');
    root.querySelectorAll('.hs-seg[data-key] button').forEach(b => b.setAttribute('aria-pressed', String(String(look[b.parentNode.dataset.key]) === b.dataset.v)));
    requestAnimationFrame(() => requestAnimationFrame(layout));
  }
  function layout(){
    const W = felt.clientWidth, H = felt.clientHeight, objs = felt.querySelector('.hs-objects');
    objs.innerHTML = '';
    // the corner things first: the deck bottom-left, the bank rack bottom-right
    const ds = .62;
    deck(objs, ds);
    const rackTop = rack(objs, W, H);
    // the spread: a faint darker rectangle over the rest of the felt
    const spread = felt.querySelector('.hs-spread');
    const sx = 12, sy = 12, sw = W - 24, sh = Math.max(CH, Math.min(H - 24, rackTop - 18) - sy);
    Object.assign(spread.style, { left:sx + 'px', top:sy + 'px', width:sw + 'px', height:sh + 'px' });
    // the cards thrown well apart across it; a fourth and fifth shuffle
    // them into two rows. Positions are fractions of the spread, each with
    // its own tilt and a little throw in it.
    const PLACES = {
      3:[[.17, .4, -7], [.5, .56, 3], [.83, .38, 9]],
      4:[[.24, .28, -6], [.74, .25, 5], [.3, .74, 4], [.76, .72, -8]],
      5:[[.18, .27, -8], [.5, .22, 2], [.82, .29, 9], [.33, .74, 5], [.69, .76, -6]]
    }[look.deal];
    const rows = look.deal > 3 ? 2 : 1;
    const s = Math.min(1.3, (sw - 24) / (CW * 3.3), (sh - 16) / (CH * (rows === 2 ? 2.15 : 1.25)));
    const ids = [['table', 'rare', 'pub-turbo'], ['bomb', 'uncommon', 'pub-open'], ['freezeout', 'common', 'back-room-five'], ['table', 'common', 'pub-open'], ['bomb', 'rare', 'back-room-five']];
    PLACES.forEach(([fx, fy, r], i) => {
      const c = EventCards.make(...ids[i]), el = document.createElement('div');
      el.className = 'hs-card';
      el.innerHTML = PokerCollectibleLab.objectHTML(c.spec);
      const x = sx + fx * sw, y = sy + fy * sh;
      el.style.transform = `translate(${Math.round(x - CW / 2)}px,${Math.round(y - CH / 2)}px) rotate(${r}deg) scale(${s.toFixed(3)})`;
      el.style.zIndex = 10 + i;
      objs.append(el);
    });
  }
  // the deck in the bottom-left corner: tap it for one more card, hold it
  // and the cards fly back and three fresh are dealt. No button.
  function deck(objs, ds){
    const d = document.createElement('div');
    d.className = 'hs-deck';
    d.innerHTML = `<div class="hs-deck-stack" style="--s:${ds}">${'<div class="hs-deck-card ds-swatch" data-cb="crest"><div class="card back"></div></div>'.repeat(5)}</div>`;
    objs.append(d);
  }

  /* ---------------- the chips: the game's bank rack, in the corner ---------------- */
  // As the table lays out the player's bank (js/coin-table.js): CoinWorld's
  // rack (rows of stacks one behind another, the back row tallest, the
  // dearest chips at the back middle), the count from the bankroll on the
  // table's own curve (its biggest HOW BIG), the colours by the game's change-making.
  function rack(objs, W, H){
    const CWd = CoinWorld, d = 17, sp = d + 1;
    CWd.OPT.size = 'l';
    const cols = Math.min(look.bank < 2000 ? 4 : look.bank < 50000 ? 5 : 6, Math.floor((W * .5) / sp));
    const box = { R:W - 14, B:H - 22 };
    box.L = box.R - (cols - 1) * sp - d - 2; box.T = box.B - 150;
    const z = { id:'hs-bank', cx:(box.L + box.R) / 2, cy:box.B, box, room:box.B - box.T - 4, rack:true, list:[] };
    const bb = look.bank / 20, count = Math.min(CWd.rackCapacity(z), Math.round(4 + 38 * Math.log10(1 + bb / 8)));
    const counts = CWd.composeTiers(Math.round(look.bank / 10), count).counts;
    const list = [];
    counts.forEach((n, t) => { for (let i = 0; i < n; i++) list.push({ colour:'t' + t }); });
    const places = CWd.rackSlots(z, list);
    let top = box.B;
    places.forEach((p, b) => {
      const c = CWd.makeChip(b.colour), h = Math.round(d * 1.2);
      CWd.setFrame(c, d, 1, false);
      const covered = list.some(q => q !== b && q.colour === b.colour && places.get(q).x === p.x && places.get(q).y === p.y && places.get(q).z > p.z);
      Object.assign(c.el.style, { position:'absolute', left:'0', top:'0', width:d + 'px', height:h + 'px',
        transform:`translate(${Math.round(p.x - d / 2)}px,${Math.round(p.y - p.z - h)}px)`,
        zIndex:String(1000 + Math.round(p.y * 4 + p.z)), filter:'drop-shadow(0 1px 0 rgba(28,14,0,.8))' + (covered ? ' brightness(.78)' : '') });
      c.el.classList.add('hs-chip');
      objs.append(c.el);
      top = Math.min(top, p.y - p.z - h);
    });
    return top;
  }

  function setup(){
    build();
    render();
    new ResizeObserver(() => layout()).observe(felt);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
