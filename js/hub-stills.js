/* ============================================================
   CAREER HUB STILLS — still layouts of the simplified hub, for the owner
   to compare and pick (lab only; nothing moves except the pick).

   The owner's brief (11 Oct): the bankroll reel full width across the top
   of the cabinet; the card slot in the middle of the cabinet, exactly the
   width of a card; a CRT either side, neat and symmetrical; the felt with
   a faint darker rectangle where three cards are thrown and arranged; a
   deck in a corner (tap: another card; a button sucks them all up and
   deals three fresh); chips that behave as in the game (the pile follows
   the bankroll); the dashboard key bay
   SHOP · PLAY · CARDS. Every part is the game's own: the reel, the CRTs,
   the felt, CoinWorld's chip art, the card faces, the keys. (P.I.P. comes
   in once a layout is picked: his set only draws as part of the table.)
   ============================================================ */
(() => {
  'use strict';
  // Round 2 (the owner picked the plain slot): the screens, the deck's
  // reset and the chip pile, three ways each. A still is a preset of the
  // three; TUNE also mixes them and sets the bankroll the pile is counted from.
  const SCREENS = {
    pair:{ name:'LABEL + FIGURE', l:['IN HAND', '3'], r:['PLAYED', '14'] },
    big:{ name:'BIG FIGURE', l:['3', 'CARDS'], r:['2ND', 'BEST'] },
    lamp:{ name:'ONE LINE', l:['3 CARDS'], r:['14 TABLES'] }
  };
  const RESETS = { lever:'A LEVER', rake:'THE RAKE', hold:'HOLD THE DECK' };
  const PILES = { pyramid:'PYRAMID', stair:'STAIR', rows:'LEVEL ROW' };
  const BANKS = [620, 12650, 186400];
  const STILLS = [
    { id:'E', name:'LEVER', note:'Two-line screens. Pull a little machine lever beside the deck to suck the cards up and deal three. The chips in a pyramid in the corner.',
      screens:'pair', reset:'lever', pile:'pyramid' },
    { id:'F', name:'RAKE', note:'One big figure per screen. A croupier\'s rake lies under the cards: drag it and it sweeps them back to the deck. The chips climb in steps into the corner.',
      screens:'big', reset:'rake', pile:'stair' },
    { id:'G', name:'DECK ONLY', note:'One line per screen. No button at all: tap the deck for a card, hold it and the cards fly back. The chips in one level row.',
      screens:'lamp', reset:'hold', pile:'rows' },
    { id:'H', name:'QUIET', note:'One line per screen, the rake, the pyramid: the least on the cabinet, the most on the felt.',
      screens:'lamp', reset:'rake', pile:'pyramid' }
  ];
  const CW = 82, CH = 120;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  const preset = STILLS.find(s => s.id === state.still) || STILLS[0];
  // what's on show: a still's three parts (mixable) and the bankroll
  const look = { screens:state.screens || preset.screens, reset:state.reset || preset.reset, pile:state.pile || preset.pile, bank:+state.bank || BANKS[2] };
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
        <h2>CAREER HUB · STILLS 2</h2>
        <p>The plain slot in all of them. Pick a still, or mix the parts below.</p>
        <div class="hs-picks">${STILLS.map(s => `<button class="pc-button pc-button-secondary" data-still="${s.id}"><b>${s.id} · ${s.name}</b><small>${s.note}</small></button>`).join('')}</div>
        <h3>SCREENS</h3>${seg('screens', Object.fromEntries(Object.entries(SCREENS).map(([k, v]) => [k, v.name])))}
        <h3>DEAL AGAIN WITH</h3>${seg('reset', RESETS)}
        <h3>CHIPS</h3>${seg('pile', PILES)}
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
    root.querySelectorAll('[data-still]').forEach(b => b.onclick = () => {
      const p = STILLS.find(s => s.id === b.dataset.still);
      Object.assign(look, { screens:p.screens, reset:p.reset, pile:p.pile });
      save({ still:p.id, screens:p.screens, reset:p.reset, pile:p.pile });
      $('#hs-sheet').hidden = true; render();
    });
    root.querySelectorAll('.hs-seg[data-key] button').forEach(b => b.onclick = () => {
      const key = b.parentNode.dataset.key;
      look[key] = key === 'bank' ? +b.dataset.v : b.dataset.v;
      save({ [key]:look[key] }); render();
    });
  }
  function save(o){ if (host) host.set(o); }

  /* ---------------- one still ---------------- */
  function render(){
    $('#hs-reel').innerHTML = reel(look.bank);
    $('.hs-crt-l').innerHTML = crt(look.screens, 'l');
    $('.hs-crt-r').innerHTML = crt(look.screens, 'r');
    const match = STILLS.find(s => s.screens === look.screens && s.reset === look.reset && s.pile === look.pile);
    root.querySelectorAll('[data-still]').forEach(b => b.setAttribute('aria-pressed', String(!!match && b.dataset.still === match.id)));
    root.querySelectorAll('.hs-seg[data-key] button').forEach(b => b.setAttribute('aria-pressed', String(String(look[b.parentNode.dataset.key]) === b.dataset.v)));
    requestAnimationFrame(() => requestAnimationFrame(layout));
  }
  function layout(){
    const W = felt.clientWidth, H = felt.clientHeight, objs = felt.querySelector('.hs-objects');
    objs.innerHTML = '';
    // the spread: a faint darker rectangle, card-proportioned, upper middle of the felt
    const s = Math.min(1.2, W * .27 / CW, H * .32 / CH);
    const spread = felt.querySelector('.hs-spread');
    const sw = Math.round(Math.min(W - 24, CW * s * 3.7)), sh = Math.round(CH * s * 1.5);
    const sx = Math.round((W - sw) / 2), sy = Math.round(H * .08);
    Object.assign(spread.style, { left:sx + 'px', top:sy + 'px', width:sw + 'px', height:sh + 'px' });
    // three cards, fanned
    const cards = [EventCards.make('table', 'rare', 'pub-turbo'), EventCards.make('bomb', 'uncommon', 'pub-open'), EventCards.make('freezeout', 'common', 'back-room-five')];
    const cx = sx + sw / 2, cy = sy + sh / 2;
    const poses = [{ x:cx - CW * s * .8, y:cy + 8, r:-12 }, { x:cx, y:cy - 2, r:0 }, { x:cx + CW * s * .8, y:cy + 8, r:12 }];
    cards.forEach((c, i) => {
      const p = poses[i], el = document.createElement('div');
      el.className = 'hs-card';
      el.innerHTML = PokerCollectibleLab.objectHTML(c.spec);
      el.style.transform = `translate(${Math.round(p.x - CW / 2)}px,${Math.round(p.y - CH / 2)}px) rotate(${p.r}deg) scale(${s.toFixed(3)})`;
      el.style.zIndex = 10 + i;
      objs.append(el);
    });
    const ds = s * .62;
    deck(objs, ds);
    if (look.reset === 'rake') rake(objs, sx + 6, sy + sh + 10, Math.round(sw * .78));
    pile(objs, W, H);
  }
  // the deck in the bottom-left corner: tap it for one more card. What
  // gathers the cards and deals three fresh is the still's reset.
  function deck(objs, ds){
    const d = document.createElement('div');
    d.className = 'hs-deck is-' + look.reset;
    d.innerHTML = `<div class="hs-deck-stack" style="--s:${ds.toFixed(3)}">${'<div class="hs-deck-card ds-swatch" data-cb="crest"><div class="card back"></div></div>'.repeat(5)}</div>`
      + (look.reset === 'lever' ? '<div class="hs-lever" aria-label="Pull to gather and deal three"><i class="hs-lever-arm"><b></b></i><i class="hs-lever-base"></i></div>' : '');
    objs.append(d);
  }
  // a croupier's rake, left lying under the cards: drag it to sweep them home
  function rake(objs, x, y, w){
    const r = document.createElement('div');
    r.className = 'hs-rake';
    Object.assign(r.style, { left:x + 'px', top:y + 'px', width:w + 'px' });
    r.innerHTML = '<i class="hs-rake-head"></i><i class="hs-rake-stick"></i>';
    objs.append(r);
  }

  /* ---------------- the chips: one tidy row in the corner ---------------- */
  // how many towers the bankroll earns, and which of the game's chip tiers
  // it reaches (CoinWorld.composeTiers: the bankroll in $10 units)
  function towerCount(){ const b = look.bank; return b < 1000 ? 1 : b < 10000 ? 3 : b < 60000 ? 5 : 7; }
  function tiers(){
    const { counts } = CoinWorld.composeTiers(look.bank / 10, 60);
    const out = []; counts.forEach((n, t) => { if (n) out.push('t' + t); });
    return out.reverse(); // dearest first
  }
  // heights, left to right: a pyramid peaks in the middle, the stair climbs
  // into the corner, the bank row is level
  function shape(n){
    const peak = Math.min(16, 5 + n * 2);
    if (look.pile === 'pyramid') return Array.from({ length:n }, (_, i) => Math.max(3, Math.round(peak * (1 - Math.abs(i - (n - 1) / 2) / ((n + 1) / 2)))));
    if (look.pile === 'stair') return Array.from({ length:n }, (_, i) => Math.max(3, Math.round(peak * (i + 1) / n)));
    return Array.from({ length:n }, () => Math.min(10, peak - 2));
  }
  function pile(objs, W, H){
    const n = towerCount(), hs = shape(n), cols = tiers(), dx = 27;
    // the dearest chips on the tallest towers
    const rank = hs.map((h, i) => i).sort((a, b) => hs[b] - hs[a] || b - a);
    const colOf = []; rank.forEach((i, k) => { colOf[i] = cols[Math.min(cols.length - 1, Math.floor(k * cols.length / n))]; });
    const bottom = H - 30, right = W - 30;
    hs.forEach((h, i) => {
      const x = right - (n - 1 - i) * dx;
      for (let k = 0; k < h; k++){
        const c = CoinWorld.makeChip(colOf[i]);
        CoinWorld.setFrame(c, 24, 0, false);
        Object.assign(c.el.style, { position:'absolute', left:Math.round(x - 12 + (k % 3 === 1 ? 1 : 0)) + 'px', top:Math.round(bottom - 15 - k * 4) + 'px', width:'24px', height:'29px', zIndex:'40' });
        c.el.classList.add('hs-chip');
        objs.append(c.el);
      }
    });
  }

  function setup(){
    build();
    render();
    new ResizeObserver(() => layout()).observe(felt);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
