"use strict";

/* ============================================================
   NEW TUBES — the Bank Tubes Lab's candidate (coin-tubes-lab.html). Adds
   one style to the live CoinBank (js/coin-bank.js) without changing it;
   the game never loads this file.

   Kept simple (owner): the shipped TUBES, reading better.
   - Two tubes, small coins and big coins, each coin tipped toward you (the
     felt's resting tilt) so a stack reads as a pile of coins, not a coil.
   - The bars stacked on a low shelf across the bottom, three wide: no
     empty bar tube.
   - Warm light down from the lamp, clearer glass (css/coin-bank-tubes2.css).
   Same counting, same change-making, same pay-out from the bottom.
   ============================================================ */
(function(){
  if (!window.CoinBank) return;
  const SIZE = CoinBank.SIZE;
  const hOf = k => Math.round(SIZE[k] * (k === 'gold-bar' ? .7 : CoinWorld.HR()));
  CoinBank.STYLES.tubes2 = {
    build(el){
      el.insertAdjacentHTML('beforeend',
        '<i class="t2-wall"></i><i class="t2-lamp"></i><i class="t2-slot"></i>' +
        '<i class="t2-tube" data-k="gold"><i class="t2-glass"></i></i><i class="t2-tube" data-k="gold-big"><i class="t2-glass"></i></i>' +
        '<i class="t2-shelf"></i><i class="t2-floor"></i>');
    },
    geom(W, H){
      // the bars' shelf: up to three layers of three, under the tubes
      const barStep = 6, barLayers = 3, shelfY = 4 + (barLayers - 1) * barStep + hOf('gold-bar') + 3;
      const w = { gold:SIZE.gold + 8, 'gold-big':SIZE['gold-big'] + 8 }, gap = 6;
      const total = w.gold + w['gold-big'] + gap;
      let x = Math.round((W - total) / 2); const col = {};
      ['gold','gold-big'].forEach(k => { col[k] = { x, w:w[k] }; x += w[k] + gap; });
      const floor = shelfY + 4, top = H - 14;
      const step = { gold:4, 'gold-big':5 };
      const cap = { 'gold-bar':barLayers * 3 };
      ['gold','gold-big'].forEach(k => { cap[k] = Math.max(1, Math.floor((top - floor - hOf(k)) / step[k]) + 1); });
      return { W, H, col, floor, top, step, cap, shelfY, barStep };
    },
    place(g, el){
      ['gold','gold-big'].forEach(k => { const t = el.querySelector('.t2-tube[data-k="' + k + '"]'); if (!t) return;
        Object.assign(t.style, { left:g.col[k].x + 'px', width:g.col[k].w + 'px', bottom:(g.floor - 2) + 'px', height:(g.top - g.floor + 8) + 'px' }); });
      const s = el.querySelector('.t2-shelf'); if (s) s.style.bottom = (g.shelfY - 1) + 'px';
    },
    slot(g, k, i){
      if (k === 'gold-bar'){
        // middle, left, right; then the next layer up
        const lv = Math.floor(i / 3), at = [1, 0, 2][i % 3], d = SIZE[k], sp = Math.floor((g.W - 6) / 3);
        return { x:3 + at * sp + Math.round((sp - d) / 2), y:4 + lv * g.barStep, z:10 + lv * 3 + (at === 1 ? 1 : 0), view:'rest' };
      }
      const d = SIZE[k], c = g.col[k];
      return { x:c.x + Math.round((c.w - d) / 2), y:g.floor + i * g.step[k], z:10 + i, view:'rest' };
    },
    exit:(pieces) => pieces[0].k === 'gold-bar' ? pieces[pieces.length - 1] : pieces[0],
    entry:(g, k) => k === 'gold-bar' ? { x:g.W / 2, y:g.shelfY + 30 } : { x:g.col[k].x + g.col[k].w / 2, y:g.top + 10 },
    label:(g, k) => ({ x:k === 'gold-bar' ? g.W / 2 : g.col[k].x + g.col[k].w / 2 })
  };
})();
