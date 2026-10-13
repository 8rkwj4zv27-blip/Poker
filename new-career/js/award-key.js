"use strict";

/* ============================================================
   AWARD KEY (live v0.50.0) — the owner's order from the Action Drum Lab,
   round 4 (docs/ui/ACTION_DRUM_PLAN.md; docs/ui/PATTERN_BOOK.md, Action
   drum). Installs itself at load; the lab tunes it through AwardKey.set().

   The AWARD POT key dressed up when the pot is YOURS: a finish of its own
   (gold, velvet or a glow), its own words (COLLECT · 1,500), a glint as
   the drum lands it and sparks when you press it. Someone else's pot
   keeps today's key, or a quieter PAY HARRY.

   Presentation only. It learns whose pot it is the way the dashboard's
   result readout does: by wrapping showHudResultConsole(potResults),
   which js/showdown.js calls just before every AWARD key (the same
   wrapping js/knockout.js does to presentResultStage). The key itself is
   still the shared .btn-award-console; the win is a state on it
   (data-ak="mine" | "theirs"), and the button keeps its id, handler and
   an aria-label with the game's own words.
   ============================================================ */
(() => {
  // The owner's order: VELVET + GOLD, COLLECT, the amount PRINTED, a flash
  // as it lands, sparks + clack, more shine for bigger wins, and their pot
  // as the quiet PAY HARRY key.
  const DEFAULTS = { finish:'velvet', words:'collect', amount:'printed', arrive:'glint', press:'sparks', theirs:'quiet', tiers:'on' };
  const opts = Object.assign({}, DEFAULTS);
  const BIG_BB = 10, MONSTER_BB = 30;        // js/showdown.js's own tiers
  const $ = id => document.getElementById(id);
  const quiet = () => { try{ return motionOff(); }catch(e){ return false; } };
  const snd = (name, ...a) => { try{ if (typeof Sound !== 'undefined' && Sound[name]) Sound[name](...a); }catch(e){} };

  let last = null;   // the pot the next AWARD key pays: { mine, split, amount, tier, who }

  function read(potResults){
    if (!Array.isArray(potResults) || !potResults.length){ last = null; return; }
    let amount = 0, all = 0; const who = new Set();
    potResults.forEach(r => {
      all += r.amount || 0;
      (r.winnerShares || []).forEach(s => { if (s.id === 'you') amount += s.amount || 0; });
      (r.winnerIds || []).forEach((id, i) => { if (id !== 'you') who.add((r.winners && r.winners[i]) || id); });
    });
    const mine = amount > 0;
    const bb = (mine ? amount : all) / Math.max(1, (typeof game !== 'undefined' && game && game.bigBlind) || 1);
    last = { mine, split: mine && who.size > 0, amount: mine ? amount : all,
      tier: bb >= MONSTER_BB ? 'monster' : bb >= BIG_BB ? 'big' : 'small', who: [...who] };
  }

  // Put the key in its state for the pot `last` describes (or plain).
  function dress(){
    const btn = $('btn-award-pot-console'); if (!btn) return;
    const face = $('console-face-award');
    const label = btn.textContent;
    const award = /^award\b/i.test(label) && !(face && face.classList.contains('sd-lit'));
    btn.removeAttribute('data-ak'); btn.removeAttribute('data-ak-tier');
    btn.removeAttribute('aria-label');
    if (!award || !last) return;
    const m = label.match(/^(.*?)\s*·\s*([\d,]+)\s*$/);
    const amt = m ? m[2] : last.amount.toLocaleString();
    if (last.mine){
      btn.setAttribute('data-ak', 'mine');
      if (opts.tiers === 'on') btn.setAttribute('data-ak-tier', last.tier);
      const word = { collect:'Collect', award:(m ? m[1] : 'Award Pot'), yours:'Yours', take:'Take it' }[opts.words] || 'Collect';
      btn.setAttribute('aria-label', label);
      btn.innerHTML = '<span class="ak-word">' + word + (last.split ? ' <small>split</small>' : '') + '</span>' +
        '<span class="ak-amt">' + amt + '</span>';
    } else if (opts.theirs === 'quiet'){
      btn.setAttribute('data-ak', 'theirs');
      const name = last.who.length === 1 ? last.who[0] : 'them';
      btn.setAttribute('aria-label', label);
      btn.textContent = 'Pay ' + name + ' · ' + amt;
    }
  }

  function wrap(){
    if (typeof showHudResultConsole !== 'function' || typeof showAwardConsole !== 'function') return false;
    const hud = showHudResultConsole, hideHud = hideHudResultConsole, show = showAwardConsole;
    window.showHudResultConsole = function(potResults){ read(potResults); return hud.apply(this, arguments); };
    window.hideHudResultConsole = function(){ const r = hideHud.apply(this, arguments); last = null; return r; };
    window.showAwardConsole = function(){ const r = show.apply(this, arguments); dress(); return r; };
    return true;
  }

  /* ---- the arrival: a glint as the drum lands the key ---- */
  function watchArrival(){
    const face = $('console-face-award'); if (!face) return;
    let was = face.classList.contains('ad-live');
    new MutationObserver(() => {
      const now = face.classList.contains('ad-live');
      if (now && !was) arrive();
      was = now;
    }).observe(face, { attributes:true, attributeFilter:['class'] });
  }
  function arrive(){
    const btn = $('btn-award-pot-console');
    if (!btn || btn.getAttribute('data-ak') !== 'mine' || opts.arrive === 'none' || quiet()) return;
    btn.classList.remove('ak-arrive'); void btn.offsetWidth; btn.classList.add('ak-arrive');
    setTimeout(() => btn.classList.remove('ak-arrive'), 900);
    snd('counterTick', true);
  }

  /* ---- the press: sparks off the key, and a clack ---- */
  document.addEventListener('pointerdown', e => {
    const btn = e.target.closest && e.target.closest('#btn-award-pot-console[data-ak="mine"]');
    if (!btn || btn.disabled || btn.classList.contains('sd-hold') || opts.press === 'none') return;
    snd('counterLock', true);
    if (!quiet()) sparks(btn);
  }, true);
  function sparks(btn){
    const host = $('action-console'); if (!host) return;
    const hb = host.getBoundingClientRect(), kb = btn.getBoundingClientRect();
    const n = btn.getAttribute('data-ak-tier') === 'small' ? 14 : 22;
    for (let i = 0; i < n; i++){
      const s = document.createElement('i');
      s.className = 'ak-spark';
      const edge = i % 4, t = Math.random();
      const x = edge < 2 ? kb.left + t * kb.width : (edge === 2 ? kb.left : kb.right);
      const y = edge === 0 ? kb.top : edge === 1 ? kb.bottom - 6 : kb.top + t * kb.height;
      const dx = edge === 2 ? -1 : edge === 3 ? 1 : (t - .5) * 1.6;
      const dy = edge === 0 ? -1 : edge === 1 ? .4 : (Math.random() - .7);
      s.style.left = (x - hb.left) + 'px'; s.style.top = (y - hb.top) + 'px';
      s.style.setProperty('--dx', Math.round(dx * (18 + Math.random() * 22)) + 'px');
      s.style.setProperty('--dy', Math.round(dy * (16 + Math.random() * 22)) + 'px');
      s.style.animationDelay = Math.round(Math.random() * 60) + 'ms';
      host.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }

  function applyOpts(){
    const r = document.documentElement;
    Object.keys(DEFAULTS).forEach(k => r.setAttribute('data-ak-' + k, opts[k]));
  }
  function set(patch){ Object.assign(opts, patch || {}); applyOpts(); dress(); }
  // The lab's demo keys: dress the key for a pot without playing one.
  function demo(pot){ last = pot || null; }

  window.AwardKey = { set, demo, get opts(){ return Object.assign({}, opts); }, DEFAULTS };
  function install(){ applyOpts(); if (wrap()) watchArrival(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
