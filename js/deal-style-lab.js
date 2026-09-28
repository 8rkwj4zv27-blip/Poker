"use strict";

/* ============================================================
   DEAL STYLE LAB — the controls, inside the game (phone-first)

   Runs in the game copy deal-style-lab.html builds (host:
   js/showdown-lab-host.js). The candidate is js/deal-styles.js. A TUNE
   key opens a sheet listing every style:

     ▶ PLAY    deals a fresh hand with every card in that style, and
               stops at your turn (the real deal, nothing else plays)
     ON / OFF  whether the style is in the random mix
     rarity    how often it comes up in the mix

   DEAL (top left) deals a fresh hand from the mix. Round 3 (the owner):
   simpler than round 2's whole-hand autoplay, which could get stuck; a
   new PLAY or DEAL always just starts over.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const $ = s => document.querySelector(s);
  const RARITY = [['common','COMMON'],['uncommon','UNCOMMON'],['rare','RARE'],['epic','EPIC'],['legendary','LEGEND']];
  const TIER_NAME = { common:'COMMON', uncommon:'UNCOMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY' };
  const saved = (host && host.state.deal) || null;
  let slow = (host && host.state.dealSlow) || 'off';
  let sprite = (host && host.state.dealSprite) || 'on';
  let shadow = (host && host.state.dealShadow) || 'on';
  function applyLook(){
    try{ DealerDeck.apply(Object.assign(DealerDeck.order, { sprite })); }catch(e){}
    document.documentElement.classList.toggle('dsl-noshadow', shadow === 'off');
  }

  const baseSpeed = speedMult;
  // eslint-disable-next-line no-global-assign
  speedMult = function(){ return baseSpeed() * (slow === 'on' ? 2.5 : 1); };

  const order = () => DealStyles.order;
  function save(){ if (host) host.set({ deal:order(), dealSlow:slow, dealSprite:sprite, dealShadow:shadow }); }
  function set(patch){ DealStyles.apply(patch); save(); paint(); }

  // roughly how often a style shows up, with ~10 cards a hand
  function odds(id){
    const O = order(), W = DealStyles.WEIGHT;
    if (!O.on[id]) return 'OFF';
    const on = DealStyles.STYLES.filter(s => O.on[s.id]);
    const solo = r => !!DealStyles.SOLO[r];
    const total = on.reduce((t, s) => t + W[O.rarity[s.id]], 0);
    let pHand;
    if (solo(O.rarity[id]) || O.scope === 'card') pHand = 1 - Math.pow(1 - W[O.rarity[id]] / total, 10);
    else {
      const plain = on.filter(s => !solo(O.rarity[s.id]));
      pHand = W[O.rarity[id]] / plain.reduce((t, s) => t + W[O.rarity[s.id]], 0);
    }
    return pHand >= .5 ? 'MOST HANDS' : 'ABOUT 1 HAND IN ' + Math.max(1, Math.round(1 / pHand));
  }

  /* ---- deal a fresh hand: in one style, or from the mix ---- */
  let token = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function deal(id){
    const my = ++token;
    if (id) DealerDeck.flightFor = () => DealStyles.make(id);
    else DealStyles.apply({});
    try{ startSinglePlayerRun({ opponentCount:3 }); }catch(e){ console.error(e); }
    if (!id) return;
    // back to the mix once your two cards are in
    const t0 = performance.now();
    while (performance.now() - t0 < 30000){
      if (my !== token) return;
      if (typeof game !== 'undefined' && game && game._humanCardsVisible) break;
      await sleep(150);
    }
    if (my === token) DealStyles.apply({});
  }

  /* ---- the key and the sheet ---- */
  const seg = (key, opts, cur, extra) => '<div class="sdl-seg' + (extra ? ' ' + extra : '') + '" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  function rowHtml(s){
    const O = order();
    return '<div class="dsl-row" data-id="' + s.id + '">' +
      '<div class="dsl-head">' +
        '<button type="button" class="dsl-play" data-play="' + s.id + '" aria-label="Play ' + s.name + '">▶ PLAY</button>' +
        '<div class="dsl-title"><b>' + s.name + '</b><small class="dsl-odds"></small></div>' +
        '<button type="button" class="dsl-on" data-on="' + s.id + '" role="switch" aria-checked="' + !!O.on[s.id] + '" aria-label="' + s.name + ' in the mix"></button></div>' +
      '<p class="sdl-note">' + s.note + '</p>' +
      seg('rarity:' + s.id, RARITY, O.rarity[s.id], 'dsl-rarity') +
    '</div>';
  }
  function paint(){
    const O = order();
    document.querySelectorAll('.dsl-sheet .sdl-seg').forEach(g => {
      const k = g.dataset.key;
      const cur = k === 'scope' ? O.scope : k === 'slow' ? slow : k === 'sprite' ? sprite : k === 'shadow' ? shadow : O.rarity[k.split(':')[1]];
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
    const dealKey = document.createElement('button');
    dealKey.type = 'button'; dealKey.className = 'sdl-key sdl-again-key'; dealKey.textContent = 'DEAL';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet dsl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Deal style lab');
    sheet.innerHTML =
      '<div class="sdl-tabs"><button type="button" class="is-on dsl-count" tabindex="-1"></button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<p class="sdl-sub">▶ PLAY deals a fresh hand with every card in that style. The switch puts a style in the random mix; its rarity sets how often it comes up (rare, epic and legendary ones only ever hit one card, as a surprise). DEAL, top left, deals from the mix.</p>' +
        '<div class="sdl-row"><div class="sdl-name">THE CARD</div>' + seg('sprite', [['on','2.5D SPRITE'],['off','FLAT (TODAY)']], sprite) + '<p class="sdl-note">2.5D: the card leans, tips and catches the light in stepped frames like the chips, turns over with a squash, and the shuffle and flop do the same.</p></div>' +
        '<div class="sdl-row"><div class="sdl-name">SHADOW ON THE FELT</div>' + seg('shadow', [['on','ON'],['off','OFF']], shadow) + '</div>' +
        '<div class="sdl-row"><div class="sdl-name">IN THE MIX, ROLL A STYLE</div>' + seg('scope', [['hand','ONCE PER HAND'],['card','EVERY CARD']], order().scope) + '</div>' +
        '<div class="sdl-row"><div class="sdl-name">SLOW MOTION</div>' + seg('slow', [['off','OFF'],['on','2.5× SLOWER']], slow) + '</div>' +
        '<div class="dsl-quick"><button type="button" data-act="all">ALL ON</button><button type="button" data-act="flick">FLICK ONLY</button></div>' +
        DealStyles.TIERS.map(t => '<h3 class="dsl-tier dsl-tier-' + t + '">' + TIER_NAME[t] + '</h3>' + DealStyles.STYLES.filter(s => s.tier === t).map(rowHtml).join('')).join('') +
        '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>' +
      '</div>';
    document.body.append(key, dealKey, sheet);
    const open = on => { sheet.classList.toggle('is-open', on); document.documentElement.classList.toggle('dsl-open', on); };
    key.addEventListener('click', () => open(true));
    dealKey.addEventListener('click', () => { open(false); deal(null); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      try{ DealStyles.Sfx.unlock(); }catch(err){}
      if (t.dataset.play){ open(false); deal(t.dataset.play); return; }
      if (t.dataset.on){ const O = order(); set({ on:{ [t.dataset.on]:!O.on[t.dataset.on] } }); return; }
      const g = t.closest('.sdl-seg');
      if (g){
        const k = g.dataset.key, v = t.dataset.v;
        if (k === 'scope') set({ scope:v });
        else if (k === 'slow'){ slow = v; save(); paint(); }
        else if (k === 'sprite'){ sprite = v; applyLook(); save(); paint(); }
        else if (k === 'shadow'){ shadow = v; applyLook(); save(); paint(); }
        else set({ rarity:{ [k.split(':')[1]]:v } });
        return;
      }
      const act = t.dataset.act;
      if (act === 'all') set({ on:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, true])) });
      if (act === 'flick') set({ on:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, s.id === 'flick'])) });
      if (act === 'reset') set({ on:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, true])), rarity:Object.fromEntries(DealStyles.STYLES.map(s => [s.id, s.tier])), scope:'hand' });
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
    applyLook();
    build();
    deal(null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);
})();
