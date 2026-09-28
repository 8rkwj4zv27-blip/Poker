"use strict";

/* ============================================================
   CARD HOLDER (live v0.48.0) — the owner's order from the Card Holder Lab
   (card-holder-lab.html; docs/ui/CARD_HOLDER_PLAN.md)

   The lip your two cards sit in sits 10px clear of the hand-name screen
   below it: the holder and the cards rise, the screens stay put. The
   lip's position differs by phone size (css/05-responsive-and-arcade.css),
   so this measures the seat and writes the rise as --holder-lift, plus
   --holder-bury (how much card hides behind the lip, where the seat
   shadow starts). Styled by css/card-holder.css.

   Settings → The deck → Card holder: BRASS (the default) or CLASSIC,
   saved as settings.cardHolder, set on <html> as data-holder.
   Presentation only: nothing here touches the game.
   ============================================================ */
const CardHolder = (() => {
  const GAP = 10;
  const STYLES = ['brass', 'classic'];
  const root = document.documentElement;
  const px = v => parseFloat(v) || 0;

  function measure(){
    // the vars live on #hud-mid, which outlasts the seat (initSeats()
    // rebuilds .seat.you for every new table)
    const mid = document.getElementById('hud-mid');
    const seat = mid && mid.querySelector('.seat.you');
    const screen = document.getElementById('hand-strength');
    if (!seat || !screen) return;
    // measure the seat where it sits without the rise
    const was = mid.style.getPropertyValue('--holder-lift');
    mid.style.setProperty('--holder-lift', '0');
    const sr = seat.getBoundingClientRect(), hs = screen.getBoundingClientRect();
    // hidden (another screen, or the result console): keep what we had
    if (!sr.height || !hs.height){ mid.style.setProperty('--holder-lift', was || '0'); return; }
    const lip = getComputedStyle(seat, '::after');
    const lipTop = px(lip.top);
    const lipH = lip.boxSizing === 'border-box' ? px(lip.height) : px(lip.height) + px(lip.borderTopWidth) + px(lip.borderBottomWidth);
    const air = (hs.top - sr.top) - (lipTop + lipH);
    mid.style.setProperty('--holder-lift', String(Math.max(0, Math.round(GAP - air))));
    const cards = seat.querySelector('.seat-cards'), card = cards && cards.querySelector('.card');
    if (card){
      // layout offsets, not rects: a card lifted at the showdown mustn't count
      const bury = Math.round(cards.offsetTop + card.offsetTop + card.offsetHeight - lipTop);
      if (bury > 0) mid.style.setProperty('--holder-bury', String(bury));
    }
  }
  let queued = false;
  function remeasure(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; measure(); });
  }

  function apply(style){
    root.setAttribute('data-holder', STYLES.includes(style) ? style : STYLES[0]);
    paintSettings();
    remeasure();
  }
  function current(){ return STYLES.includes(settings.cardHolder) ? settings.cardHolder : STYLES[0]; }
  function paintSettings(){
    const v = root.getAttribute('data-holder');
    document.querySelectorAll('#holder-seg button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  }

  function start(){
    apply(current());
    document.querySelectorAll('#holder-seg button').forEach(b => {
      b.onclick = () => { settings.cardHolder = b.dataset.v; saveSettings(); apply(b.dataset.v); };
    });
    // the seat shows, hides and changes size with the table, the result
    // console and the phone's orientation; its cards come and go
    const mid = document.getElementById('hud-mid');
    if (mid && typeof ResizeObserver !== 'undefined'){
      const ro = new ResizeObserver(remeasure);
      ro.observe(mid);
      const screen = document.getElementById('hand-strength'); if (screen) ro.observe(screen);
      let watched = null;
      const watchSeat = () => {
        const cards = mid.querySelector('.seat.you .seat-cards');
        if (cards && cards !== watched){ if (watched) ro.unobserve(watched); ro.observe(cards); watched = cards; }
        remeasure();
      };
      new MutationObserver(watchSeat).observe(mid, { childList:true });
      watchSeat();
    }
    addEventListener('resize', remeasure);
    addEventListener('orientationchange', remeasure);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  return { apply, measure, GAP, STYLES };
})();
