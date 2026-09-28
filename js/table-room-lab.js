"use strict";

/* ============================================================
   TABLE ROOM LAB — inside the game copy (phone-first)

   The owner's worry (28 Sep 2026): the table feels crammed when a big bet
   comes in or all five shared cards are out — the bets spill over the top
   of the board, and the cards already sit on the bet squares. The
   owner's plan, tried live here on the real game:

     THE POT      moves down the felt (same tray, same pile, more room
                  for the pyramid under the board)
     YOUR BET     a wider, lower spot instead of the square, so your bet
                  settles in under the lower pot
     THE BETS     little piles like the pot's instead of spreading out
                  (every coin still there)
     THEIR SPOTS  smaller and/or a little higher, clear of the board
     SQUARES      fainter, or just their corners
     MACHINES     a touch smaller (faces and money still readable)

   Presentation only: never touches poker state, money or storage. The
   game's own code is unchanged; this wraps EnemyCards.spot/paint (where
   the bet squares and spots are) and CoinWorld.zone (to shape the piles
   after CoinTable lays the table out), and adds one stylesheet.

   The frame is the owner's phone (iPhone 15 Pro Max, installed app):
   every env(safe-area-*) in the game's stylesheets becomes 59px top /
   34px bottom, as table-space-lab-frame.js does.

   Moments play the real game to the crowded bits; the AI is scripted
   (aiDecide wrapped) only while a moment runs.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { picks:null, opp:'3', sound:'on', moment:null, sheet:false };
  const $id = id => document.getElementById(id);
  const CW = window.CoinWorld;

  /* ---------------- the phone ---------------- */
  const SAFE = { top:59, bottom:34, left:0, right:0 };
  function emulateSafeArea(){
    const re = /env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g;
    const fix = v => v.replace(re, (m, side) => SAFE[side] + 'px');
    const walk = rules => {
      for (const r of rules){
        if (r.style){
          for (let i = 0; i < r.style.length; i++){
            const p = r.style[i], v = r.style.getPropertyValue(p);
            if (v && v.indexOf('safe-area-inset') !== -1) r.style.setProperty(p, fix(v), r.style.getPropertyPriority(p));
          }
        }
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const sh of document.styleSheets){ try{ walk(sh.cssRules); }catch(e){} }
  }

  /* ---------------- the picks ---------------- */
  // Every row: [key, label, options, note]. TODAY (shown as CLASSIC) is the
  // table before v0.52; the lab starts the game on TableRoom.CLASSIC.
  const GROUPS = [
    { title:'THE POT', sub:'Same tray, same pile. Lower down the felt, the pyramid gets more room under the shared cards.', rows:[
      ['pot','MOVE THE POT DOWN', [['0','CLASSIC'],['10','10 PX'],['20','20 PX'],['30','30 PX'],['40','40 PX']]],
      ['potroom','THE ROOM IT GAINS', [['air','SAME PILE, MORE AIR'],['grow','A TALLER PILE']], 'SAME PILE keeps the pyramid as tall as today, so there\'s a gap under the shared cards. TALLER lets the biggest pots stack up into the new room.']
    ]},
    { title:'YOUR BET', sub:'The spot above your cards. Wider and lower, so your coins sit in under the pot.', rows:[
      ['you','YOUR SPOT', [['sq','SQUARE (CLASSIC)'],['w90','WIDE'],['w110','WIDER'],['w130','WIDEST']]]
    ]},
    { title:'THE BETS', sub:'How a bet sits on its spot. Every coin is still there.', rows:[
      ['pile','BETS ON THE SPOT', [['spread','SPREAD (CLASSIC)'],['pile','LITTLE PILE'],['loose','LOOSE PILE']], 'LITTLE PILE is the pot\'s pyramid, small. LOOSE PILE is the same with uneven, leaning stacks.']
    ]},
    { title:'THEIR SPOTS', sub:'Under each machine. Today they reach over the top of the shared cards.', rows:[
      ['their','SHAPE', [['57','SQUARE (CLASSIC)'],['48','SMALLER SQUARE'],['w72','WIDE'],['w76','WIDE + LOW']], 'WIDE is your spot\'s idea under their machines too: the pile spreads sideways in a low heap instead of reaching down.'],
      ['lift','HEIGHT', [['0','CLASSIC'],['8','8 PX UP'],['16','16 PX UP'],['board','JUST ABOVE THE CARDS']], 'JUST ABOVE THE CARDS sits each spot 6px over the shared cards, wherever the machine ends. Their tucked cards stay in view either way.']
    ]},
    { title:'THE SQUARES', sub:'The darker felt marking each bet spot.', rows:[
      ['fade','HOW DARK', [['13','CLASSIC'],['8','FAINTER'],['5','FAINTEST'],['0','GONE']]],
      ['mark','THE MARK', [['square','SQUARE'],['corners','CORNERS ONLY']]]
    ]},
    { title:'THE MACHINES', sub:'The opponents\' cabinets, cards and all. Shrinking them lifts their spots with them.', rows:[
      ['pods','SIZE', [['100','CLASSIC'],['96','96%'],['93','93%'],['90','90%']]]
    ]},
    { title:'THE CHIPS', sub:'Every chip on the table and in your bank, same artwork drawn smaller. Piles, throws and the pot pyramid all work the same; smaller chips fit more in the same room.', rows:[
      ['coins','CHIP SIZE', [['15','CLASSIC'],['14','A LITTLE SMALLER'],['13','SMALLER'],['12','SMALLEST']]]
    ]}
  ];
  const ROWS = GROUPS.flatMap(g => g.rows);
  const TODAY = { pot:'0', potroom:'air', you:'sq', pile:'spread', their:'57', lift:'0', fade:'13', mark:'square', pods:'100', coins:'15' };
  // where the lab opens: the owner's picks (28 Sep 2026)
  const START = { pot:'30', potroom:'grow', you:'w130', pile:'pile', their:'w72', lift:'16', fade:'5', mark:'corners', pods:'90', coins:'13' };
  let picks = Object.assign({}, START, state.picks || {});
  let shown = picks;                 // what's on the table (TODAY while held)
  const save = () => { if (host) host.set({ picks:Object.assign({}, picks) }); };

  /* ---------------- geometry: the bet squares ----------------
     The game's own (js/enemy-cards.js geom()), with the lab's sizes and
     heights. Felt-local (padding box) coordinates. The machines are drawn
     at `scale` (css/05: .91) from their top middle; shrinking them further
     lifts the square by what the machine lost at the bottom. */
  const S0 = .91;
  const WIDE = { w90:[90, 40], w110:[110, 34], w130:[130, 30] };
  const THEIRS = { '48':{ sq:48 }, w72:{ w:72, h:34 }, w76:{ w:76, h:28 } };
  const felt = () => $id('felt');
  const podScale = el => { const s = parseFloat(getComputedStyle(el).scale); return Number.isFinite(s) ? s : 1; };
  function geom(p){
    const f = felt(); if (!f || !CW || typeof seatEls === 'undefined') return null;
    const e = seatEls[p.id]; if (!e) return null;
    const d = CW.D();
    if (p.isHuman){
      const cards = document.querySelector('#hud-mid .seat.you .seat-cards');
      const r = cards && cards.getBoundingClientRect();
      if (!r || !r.width) return null;
      const fr = f.getBoundingClientRect(), ox = fr.left + f.clientLeft, oy = fr.top + f.clientTop;
      const w = WIDE[shown.you];
      const W = w ? w[0] : Math.round(d * 3.2 + 6), H = w ? w[1] : W;
      const top = r.top - 10 - H;
      return { x:r.left + r.width / 2 - ox, y:top + H / 2 - oy, w:W, h:H };
    }
    const card = e.card; if (!card || !card.offsetWidth || !e._ec) return null;
    const n = typeof game !== 'undefined' && game ? game.players.filter(q => !q.isHuman).length : 3;
    const bottom = e.root.offsetTop + card.offsetTop + card.offsetHeight;
    const t = THEIRS[shown.their], k = podScale(e.root);
    let W, H;
    if (!t) W = H = Math.round(Math.min(d * 3.4 + 6, card.offsetWidth * .7));
    else if (t.sq) W = H = Math.round(Math.min(t.sq, card.offsetWidth * .7));
    else { W = Math.round(Math.min(t.w, card.offsetWidth * k)); H = t.h; }
    const lost = (S0 - k) * (card.offsetTop + card.offsetHeight);
    let top = bottom + (n >= 5 ? 18 : 22) + 12 - Math.max(0, lost);
    const bt = shown.lift === 'board' ? boardTop() : null;
    if (bt !== null) top = bt - 6 - H;
    else top -= (+shown.lift || 0);
    return { x:e.root.offsetLeft + e.root.offsetWidth / 2, y:top + H / 2, w:W, h:H };
  }
  // the top of the shared cards' row, felt-local (dealt or not: the coin
  // world remembers the row from its last measure)
  function boardTop(){
    const f = felt(), b = CW && CW.boardRow ? CW.boardRow() : null;
    if (!f || !b) return null;
    const r = f.getBoundingClientRect();
    return b.T - r.top - f.clientTop;
  }
  // the square in viewport coordinates
  function squareRect(p){
    const q = geom(p), f = felt(); if (!q || !f) return null;
    const r = f.getBoundingClientRect(), ox = r.left + f.clientLeft, oy = r.top + f.clientTop;
    return { L:ox + q.x - q.w / 2, R:ox + q.x + q.w / 2, T:oy + q.y - q.h / 2, B:oy + q.y + q.h / 2, cx:ox + q.x, cy:oy + q.y, w:q.w, h:q.h };
  }

  /* ---------------- wrapping the game's squares and spots ---------------- */
  const EC = typeof EnemyCards !== 'undefined' ? EnemyCards : null;
  if (EC){
    const paint0 = EC.paint;
    EC.spot = function(p, fr){
      const k = squareRect(p), c = CW; if (!k || !c) return null;
      return { x:k.cx - fr.left, y:k.cy + c.D() * .45 - fr.top - 2, room:k.h - 4 };
    };
    EC.paint = function(){
      paint0.apply(this, arguments);
      paintSquares();
    };
  }
  function paintSquares(){
    const f = felt(); if (!f || typeof game === 'undefined' || !game) return;
    game.players.forEach(p => {
      const el = f.querySelector('.ec-square[data-id="' + p.id + '"]'); if (!el) return;
      const q = geom(p); if (!q) return;
      const L = Math.round(q.x - q.w / 2) + 'px', T = Math.round(q.y - q.h / 2) + 'px', W = q.w + 'px', H = q.h + 'px';
      if (el.style.left !== L || el.style.top !== T || el.style.width !== W || el.style.height !== H){ el.style.left = L; el.style.top = T; el.style.width = W; el.style.height = H; }
    });
  }

  /* ---------------- the piles ----------------
     After CoinTable lays out (it builds every zone through CW.zone), each
     bet spot gets a box on its square and the pot's shape, so the coins
     tidy into a little pyramid (or heap) sitting on the square. */
  let queued = false;
  if (CW){
    const zone0 = CW.zone;
    CW.zone = function(){
      const z = zone0.apply(this, arguments);
      if (!queued){ queued = true; queueMicrotask(() => { queued = false; shapePiles(); }); }
      return z;
    };
  }
  function plateRect(){
    const area = $id('pot-area'), plate = area && area.querySelector('.pot-chip'); if (!plate) return null;
    const hid = area.classList.contains('hidden');
    plate.style.animation = 'none';
    if (hid) area.classList.remove('hidden');
    try{ const r = plate.getBoundingClientRect(); return r.width ? r : null; }
    finally{ if (hid) area.classList.add('hidden'); plate.style.animation = ''; }
  }
  function tuckedBottom(p){
    const e = seatEls[p.id]; if (!e) return null;
    const cs = [...e.cardsContainer.querySelectorAll('.card')].map(c => c.getBoundingClientRect().bottom);
    return cs.length ? Math.max(...cs) : e.card.getBoundingClientRect().bottom;
  }
  function shapePiles(){
    if (!CW || typeof game === 'undefined' || !game) return;
    const pile = shown.pile !== 'spread', plate = plateRect();
    // the pot keeps today's height unless the room it gained is for a
    // taller pile (CoinTable measured the room from the lower tray)
    const pot = CW.zones.pot;
    if (pot && pot.room && shown.potroom !== 'grow' && pot.__roomFor !== pot.cy){ pot.room -= +shown.pot; pot.__roomFor = pot.cy; }
    game.players.forEach(p => {
      const z = CW.zones['spot:' + p.id]; if (!z) return;
      if (!pile){ delete z.box; delete z.shape; return; }
      const k = squareRect(p); if (!k) return;
      const d = CW.D();
      // the floor: the lower part of the square; the stacks rise from it
      // The footprint is only for planning the pile. The coin world treats
      // a zone's box as walls too, but a bet must land, bounce and spill
      // as today (and settle in time for the sweep), so the box is only
      // there while the spot is neat: a new bet (targetIn) or a knock marks
      // it untidy, the walls vanish, and the tidy that follows (neat again
      // first, then the plan) builds the pile from wherever they fell.
      const foot = { L:k.L + 1, R:k.R - 1, T:k.T + Math.max(3, Math.round(k.h * .2)), B:k.B - 3 };
      Object.defineProperty(z, 'box', { configurable:true, enumerable:true, get(){ return this.neat ? foot : undefined; } });
      z.shape = shown.pile === 'loose' ? 'heap' : 'pyramid';
      z.cx = k.cx; z.cy = k.B - 4;
      // how tall a stack may stand: theirs up to their tucked cards, yours
      // up to the pot counter
      const limit = p.isHuman ? (plate ? plate.bottom + 3 : k.T - 20) : (tuckedBottom(p) || k.T - 20) + 2;
      z.room = Math.max(d + 6, z.cy - limit);
    });
    tidyAll(0);
  }
  let tidyT = 0;
  function tidyAll(tries){
    clearTimeout(tidyT);
    let waiting = false;
    Object.values(CW.zones).forEach(z => {
      if (!z.list.length || z.hoard) return;
      if (CW.zoneBusy(z) || z.tidying){ waiting = true; return; }
      z.neat = false; CW.tidyZone(z);
    });
    if (waiting && tries < 12) tidyT = setTimeout(() => tidyAll(tries + 1), 250);
  }

  /* ---------------- the stylesheet ---------------- */
  const style = document.createElement('style');
  style.id = 'trl-style';
  function css(s){
    const out = [];
    if (s.pot !== '0') out.push(`@media (orientation:portrait){ #felt .pot-area{ top:calc(77.5% + ${+s.pot}px); } }`);
    if (s.pods !== '100') out.push(`.felt .seat:not(.you){ scale:${(S0 * s.pods / 100).toFixed(4)}; }`);
    const a = +s.fade / 100;
    if (!a) out.push('.felt .ec-square{ display:none; }');
    else if (s.mark === 'corners'){
      // four little L-shaped corners, darker than a square so they read
      const c = `rgba(0,0,0,${Math.min(.45, a * 2.6).toFixed(3)})`, g = `linear-gradient(${c},${c})`, L = 8, t = 2;
      out.push(`.felt .ec-square{ background:
        ${g} left top/${L}px ${t}px no-repeat, ${g} left top/${t}px ${L}px no-repeat,
        ${g} right top/${L}px ${t}px no-repeat, ${g} right top/${t}px ${L}px no-repeat,
        ${g} left bottom/${L}px ${t}px no-repeat, ${g} left bottom/${t}px ${L}px no-repeat,
        ${g} right bottom/${L}px ${t}px no-repeat, ${g} right bottom/${t}px ${L}px no-repeat; }`);
    }
    else if (s.fade !== '13') out.push(`.felt .ec-square{ background:rgba(0,0,0,${a}); }`);
    return out.join('\n');
  }
  // the coin table lays out when the felt's box changes: nudge it
  function relayout(){
    const CT = typeof CoinTable === 'undefined' ? null : CoinTable;
    if (!CT || typeof game === 'undefined' || !game || !CT.on()) return;
    const f = felt();
    f.style.marginBottom = '-1px'; f.style.height = 'calc(100% - 1px)';
    CT.layout();
    f.style.marginBottom = ''; f.style.height = '';
    CT.layout();
    shapePiles();
  }
  function show(s){
    shown = s;
    sizeCoins(s.coins);
    style.textContent = css(s);
    try{ if (typeof render === 'function' && typeof game !== 'undefined' && game) render(); }catch(e){}
    paintSquares();
    relayout();
    setTimeout(meters, 60);
  }

  /* ---------------- the chips' size ----------------
     One coin size for the whole coin world (CoinWorld.D(), 15px today:
     SIZES.m). Each chip's sprite is drawn from its artwork at the size
     asked for, so a smaller one is the same chip. Chips already down take
     the new size where they lie; the piles then re-tidy to it. */
  function sizeCoins(v){
    if (!CW) return;
    // the game's own setting too: CoinTable's sync() sets the size from it
    try{ settings.tableRoom = Object.assign({}, settings.tableRoom || {}, { coins:v || '15' }); }catch(e){}
    const key = v === '15' || !v ? 'm' : 'trl' + v;
    if (key !== 'm') CW.SIZES[key] = +v;
    if (CW.OPT.size === key) return;
    CW.OPT.size = key;
    Object.values(CW.zones).forEach(z => z.list.forEach(b => {
      const d = CW.pieceD(b.colour);
      b.d = d; b.d0 = d; b.d1 = d;
      CW.dirty.add(b);
    }));
    try{ if (typeof CoinTable !== 'undefined') CoinTable.rebuildBank(); }catch(e){}
    CW.kick();
  }

  /* ---------------- measuring ---------------- */
  function boardRect(){
    const b = CW && CW.boardRow ? CW.boardRow() : null;
    return b ? { T:b.T, B:b.B, L:b.L, R:b.R } : null;
  }
  function measure(){
    if (typeof game === 'undefined' || !game) return null;
    const board = boardRect(), plate = plateRect();
    let clear = null;
    if (board) game.players.forEach(p => {
      if (p.isHuman || p.eliminated) return;
      const k = squareRect(p); if (!k || k.R < board.L || k.L > board.R) return;
      const g = Math.round(board.T - k.B);
      clear = clear === null ? g : Math.min(clear, g);
    });
    const me = game.players.find(p => p.isHuman), mk = me && squareRect(me);
    const pot = CW && CW.zones.pot;
    return {
      clear,
      pile:pot && pot.room ? Math.round(pot.room) : null,
      mine:mk && plate ? Math.round(mk.T - plate.bottom) : null
    };
  }
  function meters(){
    const el = $id('trl-meters'); if (!el) return;
    const m = measure(); if (!m){ el.textContent = ''; return; }
    const line = (label, v, good) => '<div class="trl-meter' + (v !== null && !good(v) ? ' is-bad' : '') + '"><span>' + label + '</span><b>' +
      (v === null ? '–' : (v >= 0 ? v + ' PX' : 'OVER ' + (-v) + ' PX')) + '</b></div>';
    el.innerHTML = line('THEIR SQUARES TO THE BOARD', m.clear, v => v >= 0) +
      line('ROOM FOR THE POT PILE', m.pile, v => v > 0) +
      line('YOUR SPOT TO THE POT COUNTER', m.mine, v => v >= 0);
  }

  /* ---------------- the key and the sheet ---------------- */
  const MOMENTS = [
    ['bigbet', 'A BIG BET · ALL FIVE CARDS', true],
    ['allbets', 'EVERYONE BETS · HELD BEFORE THE POT', true],
    ['monster', 'MONSTER POT · SHOWDOWN'],
    ['deal', 'NEW HAND']
  ];
  const seg = (key, opts, cur) => '<div class="trl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="trl-row"><div class="trl-name">' + r[1] + '</div>' + seg(r[0], r[2], picks[r[0]]) + (r[3] ? '<p class="trl-note">' + r[3] + '</p>' : '') + '</div>';
  let sheet = null, goKey = null;
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'trl-key'; key.id = 'trl-key'; key.textContent = 'TUNE';
    const today = document.createElement('button');
    today.type = 'button'; today.className = 'trl-key trl-today'; today.textContent = 'HOLD: CLASSIC';
    goKey = document.createElement('button');
    goKey.type = 'button'; goKey.className = 'trl-key trl-go'; goKey.textContent = 'POT IT'; goKey.hidden = true;
    sheet = document.createElement('div');
    sheet.className = 'trl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Table room lab');
    sheet.innerHTML =
      '<div class="trl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="tune">THE TABLE</button>' +
        '<button type="button" class="trl-close" aria-label="Close">✕</button></div>' +
      '<div class="trl-body">' +
        '<section data-pane="moments"><p class="trl-sub">Each one deals a fresh table and plays the real game to the crowded moment. Your picks stay on. Hold HOLD: CLASSIC (top right) any time to see the table as it was before v0.52.</p>' +
          '<div class="trl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<h3>THE TABLE<small>Opponents at the table.</small></h3>' +
          '<div class="trl-row">' + seg('opp', [['2','2'],['3','3'],['4','4'],['5','5']], state.opp) + '</div>' +
          '<div class="trl-row"><div class="trl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div></section>' +
        '<section data-pane="tune" hidden>' +
          '<div class="trl-meters" id="trl-meters"></div>' +
          GROUPS.map(g => '<h3>' + g.title + '<small>' + g.sub + '</small></h3>' + g.rows.map(row).join('')).join('') +
          '<div class="trl-actions"><button type="button" data-act="today">ALL CLASSIC</button><button type="button" data-act="start">MY PICKS</button></div>' +
          '<button type="button" class="trl-copy" data-act="copy">COPY MY PICKS</button>' +
          '<textarea class="trl-copytext" readonly hidden></textarea></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(today); document.body.appendChild(goKey); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); if (host) host.set({ sheet:on }); if (on) meters(); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.trl-close').addEventListener('click', () => open(false));
    // HOLD: CLASSIC — the table before v0.52 while a finger is down
    const hold = on => { today.classList.toggle('is-on', on); show(on ? TODAY : picks); };
    today.addEventListener('pointerdown', e => { e.preventDefault(); try{ today.setPointerCapture(e.pointerId); }catch(err){} hold(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => today.addEventListener(t, () => { if (today.classList.contains('is-on')) hold(false); }));
    today.addEventListener('contextmenu', e => e.preventDefault());
    goKey.addEventListener('click', release);
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        meters();
        return;
      }
      if (t.dataset.moment){
        open(false);
        if (host){ host.set({ sheet:false }); host.play(t.dataset.moment); } else run(t.dataset.moment);
        return;
      }
      const s = t.closest('.trl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        if (k === 'opp' || k === 'sound'){
          state[k] = v; if (host) host.set({ [k]:v });
          if (k === 'sound') try{ settings.sound = v === 'on'; }catch(err){}
          return;
        }
        picks[k] = v; save(); show(picks);
        return;
      }
      if (t.dataset.act === 'today' || t.dataset.act === 'start'){
        picks = Object.assign({}, t.dataset.act === 'today' ? TODAY : START); save(); paint(); show(picks); return;
      }
      if (t.dataset.act === 'copy'){
        const text = 'Table room lab, my picks:\n' + ROWS.map(r => {
          const g = GROUPS.find(x => x.rows.includes(r));
          return '- ' + g.title + ' · ' + r[1] + ': ' + (r[2].find(o => o[0] === picks[r[0]]) || ['', picks[r[0]]])[1];
        }).join('\n') + '\n(' + ROWS.map(r => r[0] + '=' + picks[r[0]]).join('&') + ')';
        const ta = sheet.querySelector('.trl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
    if (state.sheet) open(true);
  }
  function paint(){
    if (!sheet) return;
    sheet.querySelectorAll('.trl-seg').forEach(s => {
      const k = s.dataset.key, cur = k === 'opp' || k === 'sound' ? state[k] : picks[k];
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === cur));
    });
  }

  /* ---------------- moments: the real game, played to the moment ---------------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  const setDev = (on, fast) => { DEV_MODE = !!on; FAST_DEV = !!(on && fast); };
  const human = () => game.players.find(p => p.isHuman);
  const opps = () => game.players.filter(p => !p.isHuman && !p.eliminated);
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !$id('actions-row').classList.contains('disabled') && !$id('console-flip').classList.contains('flipped'));
  const toCall = () => game.currentBet - pendingHumanPlayer.betThisRound;
  const passive = () => humanAct(toCall() > 0 ? 'call' : 'check');
  const round5 = n => Math.max(game.bigBlind, Math.round(n / game.smallBlind) * game.smallBlind);
  // a cash table like the owner's: 3 opponents (quick runs only seat 4-6)
  async function deal(need){
    pendingHumanPlayer = null;
    Object.assign(settings, { mode:'cash', gameType:'cash', opponents:Math.max(Number(state.opp) || 3, need || 1), stack:1000, blindLevel:0, lives:false });
    startGame();
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    await sleep(200);
  }
  // the AI, scripted for a moment (aiDecide is the game's own entry point)
  let script = null;
  if (typeof aiDecide === 'function'){
    const ai0 = aiDecide;
    aiDecide = async function(p, g){
      const f = script && script(p, g);
      return f || ai0.apply(this, arguments);
    };
  }
  const call = (p, g) => ({ action:g.currentBet - p.betThisRound > 0 ? 'call' : 'check' });

  // coins held on their spots at the end of a street, till POT IT
  let gate = null, openGate = null;
  if (typeof CoinTable !== 'undefined'){
    const sweep0 = CoinTable.sweep;
    CoinTable.sweep = async function(){
      if (gate) await gate;
      return sweep0.apply(this, arguments);
    };
  }
  function holdSweep(){ gate = new Promise(r => { openGate = r; }); }
  function release(){ goKey.hidden = true; const r = openGate; gate = null; openGate = null; script = null; if (r) r(); }

  const PLAYS = {
    async deal(){ await deal(); },
    // someone bets big on the river, into you, with all five cards out
    async bigbet(){
      let bet = false;
      script = (p, g) => {
        if (p.isHuman) return null;
        if (g.phase !== 'river') return call(p, g);
        if (!bet && g.currentBet === 0){ bet = true; return { action:'bet', amount:round5(Math.max(g.pot, 8 * g.bigBlind)) }; }
        return call(p, g);
      };
      setDev(true, true);
      await deal();
      await waitFor(() => {
        if (game.board.length >= 4) setDev(false);
        if (myTurn()){
          if (game.phase === 'river' && toCall() > 0) return true;
          passive();
        }
        return game.phase === 'showdown' || game.over;
      }, 90000);
      setDev(false);
    },
    // the river: you bet, one raises, everyone calls; the coins wait on
    // their spots until you tap POT IT
    async allbets(){
      let raised = false, held = false;
      script = (p, g) => {
        if (p.isHuman) return null;
        if (g.phase !== 'river') return call(p, g);
        if (g.currentBet === 0) return { action:'bet', amount:round5(Math.max(g.pot * .6, 5 * g.bigBlind)) };
        if (!raised){ raised = true; return { action:'raise', amount:round5(g.currentBet * 2.5) }; }
        return call(p, g);
      };
      setDev(true, true);
      await deal();
      await waitFor(() => {
        if (game.board.length >= 4) setDev(false);
        if (game.phase === 'river' && !held){ held = true; holdSweep(); }
        if (myTurn()){
          if (game.phase === 'river' && game.currentBet === 0){
            const b = wagerBounds(game, pendingHumanPlayer);
            humanAct('raise', Math.max(b.min, Math.min(b.max, round5(Math.max(game.pot * .6, 5 * game.bigBlind)))));
          } else passive();
        }
        if (gate && game.phase === 'river' && !pendingHumanPlayer && isBettingRoundComplete()){
          goKey.hidden = false; return true;
        }
        return game.phase === 'showdown' || game.over;
      }, 90000);
      setDev(false);
    },
    // everyone deep and all in: the biggest pile, every hand shown
    async monster(){
      script = (p, g) => p.isHuman ? null : call(p, g);
      await deal();
      script = null;
      const rivals = opps().filter(p => p.inHand && !p.folded);
      [human(), ...rivals].forEach(p => { p.chips = Math.max(1, Math.round(45 * game.bigBlind) - p.betThisRound); });
      render();
      setDev(true, false);
      rivals.forEach(p => { p._devForceAllIn = true; });
      if (myTurn()) humanAct('allin');
      await waitFor(() => { if (myTurn()) passive(); return game.phase === 'showdown' || game.over; }, 90000);
      setDev(false);
    }
  };
  let busy = false;
  async function run(m){
    if (busy || !PLAYS[m]) return;
    busy = true;
    try{ await PLAYS[m](); }catch(err){ console.error(err); }
    finally{ busy = false; if (!gate) script = null; setTimeout(meters, 400); }
  }
  window.__trl = { run, show, measure, get picks(){ return Object.assign({}, picks); }, set(o){ Object.assign(picks, o); save(); paint(); show(picks); }, get busy(){ return busy; }, release };

  /* ---------------- start ---------------- */
  function start(){
    emulateSafeArea();
    document.head.appendChild(style);
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = state.sound !== 'off'; }catch(e){}
    // Since v0.52 the game ships the owner's picks (js/table-room.js):
    // the lab starts it on CLASSIC, the table before, and re-places
    // everything itself, so its CLASSIC is the old table
    try{ settings.tableRoom = Object.assign({}, TableRoom.CLASSIC); TableRoom.apply(); }catch(e){}
    // the owner's table: burgundy velvet, the chequered deck
    try{ settings.theme = 'burgundy'; applyRunTheme(); }catch(e){}
    try{ const b = document.querySelector('#deck-back-seg button[data-v="check"]'); if (b) b.click(); }catch(e){}
    build();
    show(picks);
    const m = state.moment || 'bigbet';
    if (host) host.set({ moment:null });
    run(m).then(() => show(picks));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
