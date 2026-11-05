"use strict";

/* ============================================================
   CHIP COLOURS LAB — the controls, inside the game (phone-first)

   Runs in the game copy chip-colours-lab.html builds (with the Showdown
   Lab's host, js/showdown-lab-host.js, which keeps the picks across a
   reload). A TUNE key opens a bottom sheet:

     WHITE CHIP      what a white chip is worth at 10/20 (the game: 2,
                     since v0.71.4; 10 before); a cheaper white means more chips per
                     bet, so the game's "five of a colour change up" step
                     brings in red, green, black and purple sooner
     AS BLINDS RISE  chip values follow the blinds, or stay fixed (the
                     game, since v0.71.4) so bigger stakes show richer colours
     MOST IN A BET   the most chips one bet throws (today 16)
     BLINDS          the next hand's blinds, every stack reset to 50 big
                     blinds, to watch the colours climb

   Live: it sets CoinWorld.OPT.white / betCap / allinCap (read by
   js/coin-table.js) and rebuilds your bank at the new values. The chip
   key and the example bets in the sheet show the picks at the table's
   blinds. Lab only: never loaded by the game.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const TODAY = { white:'2', mode:'fixed', cap:'16', blinds:'10' };
  const st = Object.assign({}, TODAY, (host && host.state.chip) || {});
  const CW = () => window.CoinWorld;
  const BLINDS = { '10':[10,20], '25':[25,50], '50':[50,100], '100':[100,200], '250':[250,500] };
  const NAMES = ['WHITE','RED','GREEN','BLACK','PURPLE','GOLD'];
  let pendingBlinds = null;

  function save(){ if (host) host.set({ chip:Object.assign({}, st) }); }
  const unitNow = () => { try{ return CoinTable.unit(); }catch(e){ return 10; } };
  function apply(rebuild){
    const W = CW(); if (!W) return;
    W.OPT.white = st.mode === 'fixed' ? { fixed:+st.white } : { div:10 / +st.white };
    W.OPT.betCap = +st.cap; W.OPT.allinCap = +st.cap + 8;
    if (rebuild){ try{ if (typeof game !== 'undefined' && game && CoinTable.on()) CoinTable.restyleBank(); }catch(e){} }
    paint();
  }

  /* ---- the next hand's blinds (and 50 big blinds each) ---- */
  const startHand = window.startNewHand;
  if (typeof startHand === 'function'){
    window.startNewHand = function(){
      if (pendingBlinds && typeof game !== 'undefined' && game){
        const [sb, bb] = pendingBlinds; pendingBlinds = null;
        game.smallBlind = sb; game.bigBlind = bb;
        game.players.forEach(p => { if (!p.eliminated) p.chips = bb * 50; });
        setTimeout(() => apply(true), 0);
      }
      return startHand.apply(this, arguments);
    };
  }

  /* ---- the sheet ---- */
  const ROWS = [
    ['white','WHITE CHIP IS WORTH', [['10','10'],['5','5'],['2','2 · TODAY'],['1','1']], 'At 10/20 blinds. The cheaper the white, the more chips each bet needs, so more of them change up into the other colours.'],
    ['mode','AS BLINDS RISE', [['follow','VALUES FOLLOW'],['fixed','FIXED VALUES · TODAY']], 'FOLLOW: a raise of 3 big blinds looks the same at any stakes. FIXED: the same chips keep their value, so bigger blinds bring in richer colours.'],
    ['cap','MOST CHIPS IN ONE BET', [['16','16 · TODAY'],['12','12'],['20','20'],['24','24']], 'An all in throws up to 8 more.'],
    ['blinds','BLINDS FROM THE NEXT HAND', [['10','10/20'],['25','25/50'],['50','50/100'],['100','100/200'],['250','250/500']], 'Every stack is reset to 50 big blinds when they change.']
  ];
  const seg = (key, opts) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === String(st[key]) ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  let sheet, keyEl;
  function build(){
    keyEl = document.createElement('button');
    keyEl.type = 'button'; keyEl.className = 'sdl-key'; keyEl.textContent = 'TUNE';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet ccl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Chip colours lab');
    sheet.innerHTML =
      '<div class="sdl-tabs"><button type="button" class="is-on" tabindex="-1">CHIP COLOURS</button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<h3>THE CHIPS NOW<small class="ccl-blinds"></small></h3><div class="ccl-key"></div>' +
        '<h3>A BET, AS THROWN<small>What each bet is made of with these picks.</small></h3><div class="ccl-bets"></div>' +
        ROWS.map(row).join('') +
        '<div class="sdl-actions"><button type="button" data-act="today">BACK TO TODAY</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>' +
      '</div>';
    document.body.appendChild(keyEl); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); keyEl.classList.toggle('is-on', on); if (on) paint(); };
    keyEl.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = b.closest('.sdl-seg');
      if (s){
        const k = s.dataset.key; st[k] = b.dataset.v; save();
        s.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
        if (k === 'blinds') pendingBlinds = BLINDS[st.blinds];
        apply(k !== 'blinds');
        return;
      }
      if (b.dataset.act === 'today'){
        Object.assign(st, TODAY); save();
        sheet.querySelectorAll('.sdl-seg').forEach(g => g.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x.dataset.v === String(st[g.dataset.key]))));
        pendingBlinds = BLINDS[st.blinds]; apply(true);
      }
      if (b.dataset.act === 'copy'){
        const t = sheet.querySelector('.sdl-copytext');
        t.value = 'Chip Colours Lab picks: white chip ' + st.white + ' (at 10/20), values ' + (st.mode === 'fixed' ? 'fixed' : 'follow the blinds') + ', most chips in a bet ' + st.cap + '.';
        t.hidden = false; t.select(); try{ navigator.clipboard.writeText(t.value); }catch(err){}
      }
    });
  }

  /* ---- the chip key and the example bets ---- */
  function chip(tier, d){
    const W = CW(), el = document.createElement('i');
    el.className = 'ccl-chip ccl-' + tier;
    try{ const f = W.frames(tier, d); if (f && f.front && f.front[0]){ el.style.backgroundImage = f.front[0]; el.classList.add('is-art'); } }catch(e){}
    return el;
  }
  const money = n => n >= 1000 ? (n / 1000).toLocaleString(undefined, { maximumFractionDigits:2 }) + 'K' : String(+n.toFixed(2));
  function paint(){
    if (!sheet || !CW()) return;
    const W = CW(), u = unitNow(), T = W.TIERS();
    const sb = (typeof game !== 'undefined' && game && game.smallBlind) || 10, bb = (typeof game !== 'undefined' && game && game.bigBlind) || 20;
    sheet.querySelector('.ccl-blinds').textContent = 'At this table\'s blinds, ' + sb + '/' + bb + (pendingBlinds ? ' (' + pendingBlinds.join('/') + ' from the next hand)' : '') + '.';
    const key = sheet.querySelector('.ccl-key'); key.innerHTML = '';
    T.forEach((t, i) => {
      const cell = document.createElement('div'); cell.className = 'ccl-keycell';
      cell.appendChild(chip(t, 26));
      cell.insertAdjacentHTML('beforeend', '<b>' + money(u * Math.pow(5, i)) + '</b><small>' + NAMES[i] + '</small>');
      key.appendChild(cell);
    });
    const bets = sheet.querySelector('.ccl-bets'); bets.innerHTML = '';
    [['THE BIG BLIND', 1, false], ['A CALL · 3 BB', 3, false], ['A RAISE · 8 BB', 8, false], ['A BIG RAISE · 25 BB', 25, false], ['ALL IN · 50 BB', 50, true]].forEach(([name, n, allin]) => {
      const amount = n * bb, units = Math.max(1, Math.round(amount / u));
      const c = W.composeTiers(units, allin ? +st.cap + 8 : +st.cap).counts;
      const line = document.createElement('div'); line.className = 'ccl-bet';
      const total = c.reduce((a, b) => a + b, 0);
      line.innerHTML = '<div class="ccl-betname">' + name + '<small>' + amount.toLocaleString() + ' · ' + total + ' chips</small></div>';
      const pile = document.createElement('div'); pile.className = 'ccl-pile';
      for (let i = T.length - 1; i >= 0; i--) for (let k = 0; k < c[i]; k++) pile.appendChild(chip(T[i], 16));
      line.appendChild(pile); bets.appendChild(line);
    });
  }

  /* ---- go: picks applied, a table dealt ---- */
  function go(){
    build();
    if (st.blinds !== '10') pendingBlinds = BLINDS[st.blinds];
    apply(false);
    setTimeout(() => {
      try{ if (typeof game === 'undefined' || !game || game.over) startSinglePlayerRun(); }catch(e){}
    }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
