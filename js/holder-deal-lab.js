"use strict";

/* ============================================================
   HOLDER DEAL LAB — how your two cards arrive in the card holder
   (docs/ui/CARD_HOLDER_PLAN.md, "Round 3: the turn")

   The owner: the holder is a shallow shelf the cards slip into, so a card
   turning over while it sits in it reads as a deep box. Two candidates,
   both ending the same way (the card turns clear of the lip, above the
   holder, then slips down into the groove):

     A · TURNS IN THE AIR   the card turns over during the last part of its
                            flight, arrives face up just above the lip,
                            and slips in.
     B · TURNS ABOVE        the card lands face down just above the lip,
                            turns there, and slips in.
     TODAY                  the shipped deal: lands in the groove, turns in it.

   Runs inside the game copy card-holder-deal-lab.html builds (host:
   js/showdown-lab-host.js). Only your own hole cards change: this wraps
   the live dealCardFlight (the dealer deck's) for opts.revealAfter cards
   in your seat and hands everything else straight back. Game state is
   never touched; the caller still marks the card revealed when this
   resolves, exactly as with the shipped flight.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const saved = (host && host.state.turn) || {};
  const pick = { mode:saved.mode || 'a', slow:saved.slow || 'off' };
  const MODES = [['a','A · TURNS IN THE AIR'],['b','B · TURNS ABOVE, SLIPS IN'],['today','TODAY']];
  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, Math.round(ms))));
  const save = () => { if (host) host.set({ turn:Object.assign({}, pick) }); };

  /* ---- slow motion: the game's own speed, stretched ---- */
  const baseSpeed = speedMult;
  // eslint-disable-next-line no-global-assign
  speedMult = function(){ return baseSpeed() * (pick.slow === 'on' ? 3 : 1); };

  /* ---- the candidate ---- */
  // how far above its seat the card turns: clear of the lip, with a hair to spare
  function liftPx(){
    const mid = document.getElementById('hud-mid');
    const bury = parseFloat(mid && mid.style.getPropertyValue('--holder-bury')) || 11;
    return bury + 4;
  }
  // the card slides down into the groove, and the groove takes it
  async function slipIn(el, h){
    if (!el.isConnected) return;
    const a = el.animate([{ transform:'translateY(' + (-h) + 'px)' }, { transform:'translateY(0)' }],
      { duration:Math.round(150 * speedMult()), easing:'cubic-bezier(.5,0,.9,.6)', fill:'forwards' });
    await a.finished.catch(() => {});
    el.style.transform = '';
    try{ a.cancel(); }catch(e){}
    try{ Sound.cardLanded(); }catch(e){}
  }
  // the deck's landing puff belongs on the felt, not above the brass
  function dropPuff(el){
    const r = el.getBoundingClientRect();
    document.querySelectorAll('.ds-puff').forEach(p => {
      if (Math.abs(parseFloat(p.style.top) - (r.bottom - 2)) < 3 && Math.abs(parseFloat(p.style.left) - (r.left + r.width / 2)) < 3) p.remove();
    });
  }
  // A: catch the ghost the deck flies to this card and give it two faces
  function turnGhostInFlight(el, card){
    // the face exactly as it will sit in the seat (fonts, seat shadow)
    const probe = document.createElement('div');
    probe.className = cardClass(false, card, false);
    probe.innerHTML = cardInner(card);
    probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none';
    el.parentNode.appendChild(probe);
    const cs = getComputedStyle(probe);
    const look = { bg:cs.backgroundImage, bgc:cs.backgroundColor, shadow:cs.boxShadow, radius:cs.borderRadius, sizes:{} };
    ['.r','.s','.pip'].forEach(s => { const n = probe.querySelector(s); if (n) look.sizes[s] = getComputedStyle(n).fontSize; });
    probe.remove();

    let done = false;
    const mo = new MutationObserver(recs => {
      if (done) return;
      const r = el.getBoundingClientRect();
      for (const rec of recs) for (const g of rec.addedNodes){
        if (done || !(g instanceof HTMLElement) || !g.classList.contains('fly-card') || g.classList.contains('return')) continue;
        if (Math.abs(parseFloat(g.style.left) - r.left) > 1.5 || Math.abs(parseFloat(g.style.top) - r.top) > 1.5) continue;
        done = true; mo.disconnect();
        dress(g, look, card);
      }
    });
    mo.observe(document.body, { childList:true });
    setTimeout(() => mo.disconnect(), 4000 * speedMult());
  }
  function dress(ghost, look, card){
    const back = document.createElement('div');
    back.className = String(ghost.className).replace(/\bfly-card\b/, '').trim() + ' card-turn-face card-turn-current';
    back.style.cssText = 'width:100%;height:100%';
    const front = document.createElement('div');
    front.className = cardClass(false, card, false) + ' card-turn-face card-turn-target';
    front.innerHTML = cardInner(card);
    front.style.cssText = 'width:100%;height:100%;background-image:' + look.bg + ';background-color:' + look.bgc + ';box-shadow:' + look.shadow + ';border-radius:' + look.radius;
    Object.entries(look.sizes).forEach(([s, fs]) => { const n = front.querySelector(s); if (n) n.style.fontSize = fs; });
    const flipper = document.createElement('div');
    flipper.className = 'card-turn-flipper';
    flipper.append(back, front);
    ghost.className = 'card card-turning fly-card';
    ghost.replaceChildren(flipper);
    const anim = ghost.getAnimations()[0];
    const dur = anim ? anim.effect.getComputedTiming().duration : 400;
    // over the second half of the flight: up off the arc, over, and square
    flipper.animate([
      { transform:'rotateY(0deg)', offset:0 },
      { transform:'rotateY(0deg)', offset:.36, easing:'cubic-bezier(.35,0,.65,1)' },
      { transform:'rotateY(-92deg)', offset:.6, easing:'cubic-bezier(.2,.72,.28,1)' },
      { transform:'rotateY(-180deg)', offset:.86 },
      { transform:'rotateY(-180deg)', offset:1 }
    ], { duration:dur, easing:'linear', fill:'both' });
    setTimeout(() => { try{ Sound.cardFlip(false); }catch(e){} }, dur * .4);
  }

  let orig = null;
  async function dealYourCard(el, card, opts){
    const h = liftPx();
    el.style.transform = 'translateY(' + (-h) + 'px)';
    if (pick.mode === 'a'){
      // the flight lands face up: the card underneath is face up already
      // (still hidden until the flight lands)
      const flight = orig.call(this, el, card, { deferFlip:true });
      setCardTurnFinal(el, false, card, false);
      turnGhostInFlight(el, card);
      const landed = await flight;
      if (!el.isConnected){ return; }
      dropPuff(el);
      if (landed === false){ el.style.transform = ''; return; }
      await wait(60 * speedMult());
      await slipIn(el, h);
      return;
    }
    // B
    await orig.call(this, el, card, { deferFlip:true });
    if (!el.isConnected) return;
    dropPuff(el);
    await wait(DEAL_TIMING.settleBeforeFlipMs * speedMult());
    if (el.isConnected) await turnCard(el, false, card, false, 'hole');
    await wait(40 * speedMult());
    await slipIn(el, h);
  }
  function install(){
    orig = dealCardFlight;
    // eslint-disable-next-line no-global-assign
    dealCardFlight = function(el, card, opts){
      const mine = el && opts && opts.revealAfter && el.closest && el.closest('#hud-mid .seat.you');
      if (!mine || pick.mode === 'today' || motionOff()) return orig.apply(this, arguments);
      return dealYourCard.call(this, el, card, opts);
    };
  }

  /* ---- the key and the sheet ---- */
  const seg = (key, opts) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === pick[key] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  function paint(){
    document.querySelectorAll('.hdl-sheet .sdl-seg').forEach(s => s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === pick[s.dataset.key])));
  }
  function newHand(){ try{ startSinglePlayerRun({ opponentCount:3 }); }catch(e){ console.error(e); } }
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    const deal = document.createElement('button');
    deal.type = 'button'; deal.className = 'sdl-key sdl-again-key'; deal.textContent = 'DEAL';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet hdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Holder deal lab');
    sheet.innerHTML =
      '<div class="sdl-tabs"><button type="button" class="is-on" tabindex="-1">YOUR CARDS ARRIVE</button><button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<div class="sdl-row"><div class="sdl-name">THE TURN</div>' + seg('mode', MODES) +
          '<p class="sdl-note">A: turns over in the last part of its flight, then slips down into the holder. B: lands just above the holder face down, turns there, then slips in. Both turn clear of the brass lip.</p></div>' +
        '<div class="sdl-row"><div class="sdl-name">SLOW MOTION</div>' + seg('slow', [['off','OFF'],['on','3× SLOWER']]) + '</div>' +
        '<button type="button" class="sdl-again" data-act="deal">DEAL A HAND</button>' +
      '</div>';
    document.body.append(key, deal, sheet);
    const open = on => { sheet.classList.toggle('is-open', on); document.documentElement.classList.toggle('hdl-open', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    deal.addEventListener('click', () => { open(false); newHand(); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'deal'){ open(false); newHand(); return; }
      const s = t.closest('.sdl-seg');
      if (s){ pick[s.dataset.key] = t.dataset.v; save(); paint(); }
    });
  }

  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = true; }catch(e){}
    try{ settings.theme = 'burgundy'; document.body.setAttribute('data-theme', 'burgundy'); }catch(e){}
    install();
    build();
    newHand();
  }
  // after the dealer deck has put its own dealCardFlight in (it installs on
  // DOMContentLoaded, and its listener was added first)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);
})();
