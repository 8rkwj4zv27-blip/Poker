"use strict";

/* ============================================================
   TABLE ROOM (v0.52.0) — room on the table for the bets

   The owner's picks from the Table Room Lab (table-room-lab.html,
   docs/ui/TABLE_ROOM_PLAN.md, 28 Sep 2026), and the player's own
   version of them in Settings → The table. The owner's worry: with a
   big bet, or all five shared cards out, the bets spilled over the top
   of the board (each opponent's square reached 34px over it).

     pot      the pot counter and its tray lower down the felt (px);
              potroom: 'grow' lets the pyramid use the room it gains,
              'air' keeps it as tall as before
     you      your bet spot: the square, or a wider, lower one
     pile     bets on a spot: 'spread' (as before), a little 'pile' like
              the pot's, or a 'loose' heap (a coin or two off the sides)
     their    their bet spots: the square, smaller, or wide
     lift     their spots higher towards the machine (px), or 'board':
              6px over the shared cards
     fade     how dark the bet marks are (%), 0 hides them
     mark     'square', or 'corners' only
     pods     the machines' size (% of the shipped .91 scale)
     coins    the chip size (px; 15 is the shipped SIZES.m)

   Presentation only: never touches poker state or money. Read by
   js/enemy-cards.js (the squares and spots), js/coin-table.js (the
   piles, the pot's room, the chip size) and css/table-room.css (the
   pot, the machines, the marks, through CSS variables set here).
   ============================================================ */
const TableRoom = (function(){
  const OPTIONS = {
    pot:['0','10','20','30','40'],
    potroom:['grow','air'],
    you:['sq','w90','w110','w130'],
    pile:['spread','pile','loose'],
    their:['57','48','w72','w76'],
    lift:['0','8','16','board'],
    fade:['13','8','5','0'],
    mark:['square','corners'],
    pods:['100','96','93','90'],
    coins:['15','14','13','12']
  };
  // the owner's picks: the table as it ships
  const DEFAULTS = { pot:'30', potroom:'grow', you:'w130', pile:'pile', their:'w72', lift:'16', fade:'5', mark:'corners', pods:'90', coins:'13' };
  // the table before this pass (v0.51)
  const CLASSIC = { pot:'0', potroom:'grow', you:'sq', pile:'spread', their:'57', lift:'0', fade:'13', mark:'square', pods:'100', coins:'15' };
  const YOURS = { w90:[90, 40], w110:[110, 34], w130:[130, 30] };
  const THEIRS = { '48':{ sq:48 }, w72:{ w:72, h:34 }, w76:{ w:76, h:28 } };
  const SIZE_KEY = { '15':'m', '14':'ms', '13':'s', '12':'xs' };

  function opts(){
    const saved = (typeof settings !== 'undefined' && settings.tableRoom) || {};
    const o = Object.assign({}, DEFAULTS);
    Object.keys(OPTIONS).forEach(k => { if (OPTIONS[k].includes(String(saved[k]))) o[k] = String(saved[k]); });
    return o;
  }
  const CW = () => window.CoinWorld;

  /* ---------------- geometry (js/enemy-cards.js) ---------------- */
  // your spot's size: the square (from the chip size) or a wide one
  function yourSpot(d){
    const w = YOURS[opts().you];
    if (w) return { w:w[0], h:w[1] };
    const S = Math.round(d * 3.2 + 6);
    return { w:S, h:S };
  }
  // theirs, given the card's layout width and its drawn scale
  function theirSpot(d, cardW, k){
    const t = THEIRS[opts().their];
    if (!t){ const S = Math.round(Math.min(d * 3.4 + 6, cardW * .7)); return { w:S, h:S }; }
    if (t.sq){ const S = Math.round(Math.min(t.sq, cardW * .7)); return { w:S, h:S }; }
    return { w:Math.round(Math.min(t.w, cardW * k)), h:t.h };
  }
  // how far the machine's own shrinking lifts its spot: the machine is
  // drawn from its top middle at `scale`, so its bottom rises by what it
  // lost; `k` is the drawn scale, `h` the card's layout bottom in the seat
  function podLift(k, h){
    const f = +opts().pods / 100;
    return f < 1 ? Math.max(0, (k / f - k) * h) : 0;
  }
  // their spot's top, felt-local: from where the spot sat (`top`), or
  // just over the shared cards (`boardTop`, felt-local) when set so
  function theirTop(top, h, boardTop){
    const l = opts().lift;
    if (l === 'board') return boardTop == null ? top : boardTop - 6 - h;
    return top - (+l || 0);
  }
  const pileOn = () => opts().pile !== 'spread';
  const pileShape = () => opts().pile === 'loose' ? 'heap' : 'pyramid';

  /* ---------------- the coin world (js/coin-table.js) ---------------- */
  const sizeKey = () => SIZE_KEY[opts().coins] || 'm';
  // the pot keeps its old height unless the room it gained is for a
  // taller pile
  const airDrop = () => opts().potroom === 'air' ? +opts().pot : 0;
  // chips already down take a new size where they lie
  function resizeCoins(){
    const c = CW(); if (!c) return;
    const key = sizeKey();
    if (c.OPT.size === key) return;
    c.OPT.size = key;
    Object.values(c.zones).forEach(z => z.list.forEach(b => {
      const d = c.pieceD(b.colour);
      b.d = d; b.d0 = d; b.d1 = d;
      c.dirty.add(b);
    }));
    c.kick();
  }

  /* ---------------- applying ---------------- */
  function paintVars(){
    const o = opts(), r = document.documentElement;
    r.style.setProperty('--tr-pot', (+o.pot) + 'px');
    r.style.setProperty('--tr-pods', String(+o.pods / 100));
    r.style.setProperty('--tr-fade', String(+o.fade / 100));
    r.style.setProperty('--tr-ink', String(Math.min(.45, +o.fade / 100 * 2.6)));
    r.dataset.trMark = +o.fade ? o.mark : 'none';
  }
  // a change mid-game: repaint, re-place the spots, re-tidy every pile
  function apply(){
    paintVars();
    resizeCoins();
    const CT = typeof CoinTable === 'undefined' ? null : CoinTable;
    const g = typeof game === 'undefined' ? null : game;
    if (!g) return;
    try{ if (typeof render === 'function') render(); }catch(e){}
    if (!CT || !CT.on()) return;
    try{ CT.rebuildBank(); }catch(e){}
    CT.relayout();
  }

  /* ---------------- Settings → The table ---------------- */
  function paintSettings(){
    const o = opts();
    document.querySelectorAll('#settings-table-room .segmented[data-tr]').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === o[seg.dataset.tr]));
    });
    const same = t => Object.keys(OPTIONS).every(k => o[k] === t[k]);
    document.querySelectorAll('#tr-quick-seg button').forEach(b => b.classList.toggle('active', same(b.dataset.act === 'classic' ? CLASSIC : DEFAULTS)));
  }
  function save(o){
    settings.tableRoom = o;
    if (typeof saveSettings === 'function') saveSettings();
    paintSettings();
    apply();
  }
  function wireSettings(){
    document.querySelectorAll('#settings-table-room .segmented[data-tr] button').forEach(b => {
      b.onclick = () => { const o = opts(); o[b.closest('[data-tr]').dataset.tr] = b.dataset.v; save(o); };
    });
    document.querySelectorAll('#tr-quick-seg button').forEach(b => {
      b.onclick = () => save(Object.assign({}, b.dataset.act === 'classic' ? CLASSIC : DEFAULTS));
    });
    paintSettings();
  }

  function start(){
    paintVars();
    const c = CW(); if (c) c.OPT.size = sizeKey();
    wireSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  return { OPTIONS, DEFAULTS, CLASSIC, opts, yourSpot, theirSpot, podLift, theirTop, pileOn, pileShape, sizeKey, airDrop, apply };
})();
