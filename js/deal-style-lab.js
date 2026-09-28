"use strict";

/* ============================================================
   DEAL STYLE LAB — the controls, inside the game (phone-first)

   Runs in the game copy deal-style-lab.html builds (host:
   js/showdown-lab-host.js). The candidate is js/deal-styles.js. A TUNE
   key opens a sheet listing every style: PREVIEW flies it off the deck
   to cards on the table (nothing is dealt), the switch puts it in the
   mix, and its rarity sets how often it comes up. Up top: whether the
   style is rolled once per hand or for every card, slow motion, and a
   real DEAL. Picks survive a reload (the host keeps them).
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const $ = s => document.querySelector(s);
  const RARITY = [['common','COMMON'],['uncommon','UNCOMMON'],['rare','RARE'],['legendary','LEGENDARY']];
  const saved = (host && host.state.deal) || null;
  let slow = (host && host.state.dealSlow) || 'off';

  const baseSpeed = speedMult;
  // eslint-disable-next-line no-global-assign
  speedMult = function(){ return baseSpeed() * (slow === 'on' ? 2.5 : 1); };

  function order(){ return DealStyles.order; }
  function save(){ if (host) host.set({ deal:order(), dealSlow:slow }); }
  function set(patch){ DealStyles.apply(patch); forced = null; paintForced(); save(); paint(); }

  // roughly how often a style shows up, with ~10 cards a hand
  function odds(id){
    const O = order(), W = DealStyles.WEIGHT;
    if (!O.on[id]) return 'OFF';
    const on = DealStyles.STYLES.filter(s => O.on[s.id]);
    const solo = r => r === 'rare' || r === 'legendary';
    const total = on.reduce((t, s) => t + W[O.rarity[s.id]], 0);
    const pCard = W[O.rarity[id]] / total;
    if (solo(O.rarity[id]) || O.scope === 'card'){
      const pHand = 1 - Math.pow(1 - pCard, 10);
      return pHand >= .5 ? 'MOST HANDS' : 'ABOUT 1 HAND IN ' + Math.max(1, Math.round(1 / pHand));
    }
    const plain = on.filter(s => !solo(O.rarity[s.id]));
    const pt = plain.reduce((t, s) => t + W[O.rarity[s.id]], 0);
    const pHand = W[O.rarity[id]] / pt;
    return pHand >= .5 ? 'MOST HANDS' : 'ABOUT 1 HAND IN ' + Math.max(1, Math.round(1 / pHand));
  }

  /* ---- preview: one style off the deck to three cards on the table ---- */
  let previewing = false;
  async function preview(id){
    if (previewing) return;
    previewing = true;
    try{
      if (!$('#hud-mid .seat.you .seat-cards .card')) await dealAndWait();
      const targets = [];
      const opp = Array.from(document.querySelectorAll('.seat.ec-seat:not(.folded) > .seat-cards .card'));
      if (opp[0]) targets.push(opp[0]);
      const mine = $('#hud-mid .seat.you .seat-cards .card');
      if (mine) targets.push(mine);
      const far = opp.filter(c => c.closest('.seat') !== (opp[0] && opp[0].closest('.seat')));
      if (far.length) targets.push(far[far.length - 1]);
      for (const t of targets){
        DealerDeck.preview(t, DealStyles.make(id));
        await new Promise(r => setTimeout(r, 260 * speedMult()));
      }
      await new Promise(r => setTimeout(r, 900 * speedMult() * (id === 'royal' ? 2.4 : 1)));
    } finally { previewing = false; }
  }
  function dealAndWait(){
    return new Promise(res => {
      try{ startSinglePlayerRun({ opponentCount:3 }); }catch(e){ res(); return; }
      const t0 = performance.now();
      const tick = () => {
        const ok = typeof pendingHumanPlayer !== 'undefined' && pendingHumanPlayer && typeof game !== 'undefined' && game && game._humanCardsVisible;
        if (ok || performance.now() - t0 > 30000) res(); else setTimeout(tick, 120);
      };
      tick();
    });
  }

  /* ---- a whole hand: dealt in one style (or the mix) and played to the
     river, everyone checking or calling, so every card flies: yours,
     theirs, the flop, the turn and the river ---- */
  let forced = null, playing = false;
  function useStyle(id){
    forced = id || null;
    if (forced) DealerDeck.flightFor = () => DealStyles.make(forced);
    else DealStyles.apply({});
    paintForced();
  }
  function paintForced(){
    const b = $('.dsl-now');
    if (b) b.textContent = forced ? 'THIS HAND: ' + DealStyles.STYLES.find(s => s.id === forced).name + ' · TAP TO GO BACK TO THE MIX' : '';
    if (b) b.hidden = !forced;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function playHand(id){
    if (playing) return;
    playing = true;
    useStyle(id);
    const wasDev = DEV_MODE;
    // their thinking is cut short so the hand gets to the river quickly; the
    // flights themselves keep their real speed
    const think = aiThinkTime;
    // eslint-disable-next-line no-global-assign
    aiThinkTime = function(){ return Math.min(260, think.apply(this, arguments)); };
    try{
      try{ startSinglePlayerRun({ opponentCount:3 }); }catch(e){ return; }
      DEV_MODE = true;   // the engine only honours _devAutoCall in dev mode
      const t0 = performance.now();
      while (performance.now() - t0 < 90000){
        const g = typeof game !== 'undefined' ? game : null;
        if (g && g.players){
          g.players.forEach(p => { if (!p.isHuman && !p.folded && !p.allIn && !p.eliminated) p._devAutoCall = true; });
          const me = typeof pendingHumanPlayer !== 'undefined' ? pendingHumanPlayer : null;
          if (me && g.players.includes(me)){
            const call = g.currentBet - me.betThisRound;
            try{ humanAct(call > 0 ? 'call' : 'check'); }catch(e){}
          }
          if (g.phase === 'showdown' || g.phase === 'foldwin' || g.over) break;
        }
        await sleep(40);
      }
    } finally {
      // eslint-disable-next-line no-global-assign
      aiThinkTime = think;
      DEV_MODE = wasDev;
      try{ game && game.players && game.players.forEach(p => { p._devAutoCall = false; }); }catch(e){}
      playing = false;
    }
  }

  /* ---- the key and the sheet ---- */
  const seg = (key, opts, cur, extra) => '<div class="sdl-seg' + (extra ? ' ' + extra : '') + '" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  function rowHtml(s){
    const O = order();
    return '<div class="dsl-row" data-id="' + s.id + '">' +
      '<div class="dsl-head"><div class="dsl-title"><b>' + s.name + '</b><small class="dsl-odds"></small></div>' +
        '<button type="button" class="dsl-on" data-on="' + s.id + '" role="switch" aria-checked="' + !!O.on[s.id] + '" aria-label="' + s.name + ' in the mix"></button></div>' +
      '<p class="sdl-note">' + s.note + '</p>' +
      '<div class="dsl-plays"><button type="button" class="dsl-play" data-play="' + s.id + '" aria-label="Fly one ' + s.name + ' card">▶ FLY ONE</button>' +
        '<button type="button" class="dsl-play dsl-hand" data-hand="' + s.id + '" aria-label="Deal a whole hand in ' + s.name + '">▶ DEAL A WHOLE HAND</button></div>' +
      seg('rarity:' + s.id, RARITY, O.rarity[s.id], 'dsl-rarity') +
    '</div>';
  }
  function paint(){
    const O = order();
    document.querySelectorAll('.dsl-sheet .sdl-seg').forEach(g => {
      const k = g.dataset.key;
      const cur = k === 'scope' ? O.scope : k === 'slow' ? slow : O.rarity[k.split(':')[1]];
      g.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === cur));
    });
    document.querySelectorAll('.dsl-row').forEach(r => {
      const id = r.dataset.id, on = !!O.on[id];
      r.classList.toggle('is-off', !on);
      r.querySelector('.dsl-on').setAttribute('aria-checked', String(on));
      r.querySelector('.dsl-odds').textContent = odds(id);
    });
    const n = DealStyles.STYLES.filter(s => O.on[s.id]).length;
    const c = $('.dsl-count'); if (c) c.textContent = n ? n + ' IN THE MIX' : 'NONE ON: THE GAME USES FLICK';
  }
  function copyText(){
    const O = order();
    return 'Deal styles:\n- Rolled: ' + (O.scope === 'card' ? 'every card' : 'once per hand') + '\n' +
      DealStyles.STYLES.map(s => '- ' + s.name + ': ' + (O.on[s.id] ? RARITY.find(r => r[0] === O.rarity[s.id])[1] : 'OFF')).join('\n');
  }
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    const deal = document.createElement('button');
    deal.type = 'button'; deal.className = 'sdl-key sdl-again-key'; deal.textContent = 'DEAL';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet dsl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Deal style lab');
    sheet.innerHTML =
      '<div class="sdl-tabs"><button type="button" class="is-on dsl-count" tabindex="-1"></button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<p class="sdl-sub">▶ FLY ONE flies a style to a few cards on the table. ▶ DEAL A WHOLE HAND deals a fresh hand in just that style and plays it to the river (everyone checks or calls), so you see every card: yours, theirs, the flop, turn and river. The switch puts a style in the mix; its rarity sets how often it comes up. Rare and legendary ones only ever happen to one card, as a surprise. DEAL (top left) plays a whole hand from the mix.</p>' +
        '<div class="sdl-row"><div class="sdl-name">ROLL A STYLE</div>' + seg('scope', [['hand','ONCE PER HAND'],['card','EVERY CARD']], order().scope) + '</div>' +
        '<div class="sdl-row"><div class="sdl-name">SLOW MOTION</div>' + seg('slow', [['off','OFF'],['on','2.5× SLOWER']], slow) + '</div>' +
        '<div class="dsl-quick"><button type="button" data-act="all">ALL ON</button><button type="button" data-act="flick">FLICK ONLY</button><button type="button" data-act="deal">DEAL FROM THE MIX</button></div>' +
        DealStyles.STYLES.map(rowHtml).join('') +
        '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>' +
      '</div>';
    const now = document.createElement('button');
    now.type = 'button'; now.className = 'dsl-now'; now.hidden = true;
    now.addEventListener('click', () => useStyle(null));
    document.body.append(key, deal, now, sheet);
    const open = on => { sheet.classList.toggle('is-open', on); document.documentElement.classList.toggle('dsl-open', on); };
    key.addEventListener('click', () => open(true));
    deal.addEventListener('click', () => { open(false); playHand(null); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.hand){ open(false); playHand(t.dataset.hand); return; }
      if (t.dataset.play){
        open(false);
        await preview(t.dataset.play);
        open(true);
        return;
      }
      if (t.dataset.on){ const O = order(); set({ on:{ [t.dataset.on]:!O.on[t.dataset.on] } }); return; }
      const g = t.closest('.sdl-seg');
      if (g){
        const k = g.dataset.key, v = t.dataset.v;
        if (k === 'scope') set({ scope:v });
        else if (k === 'slow'){ slow = v; save(); paint(); }
        else set({ rarity:{ [k.split(':')[1]]:v } });
        return;
      }
      const act = t.dataset.act;
      if (act === 'all') set({ on:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, true])) });
      if (act === 'flick') set({ on:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, s.id === 'flick'])) });
      if (act === 'deal'){ open(false); playHand(null); }
      if (act === 'reset') set({ on:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, true])), rarity:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, s.rarity])), scope:'hand' });
      if (act === 'copy'){
        const text = copyText(), ta = sheet.querySelector('.sdl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
    paint();
  }

  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.theme = 'burgundy'; document.body.setAttribute('data-theme', 'burgundy'); }catch(e){}
    if (saved) DealStyles.apply(saved);
    build();
    dealAndWait();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);
})();
