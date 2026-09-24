/* Machine CRT — the content-change blink for every `.machine-crt`.

   The Pattern Book's CRT motion is "flicker and blink": whenever a screen's
   text changes it blinks out and resynchronises (the `crt-refresh` class,
   styled in css/machine-crt.css). paintCRT() in 05-game-engine.js and the
   Career record already fire it themselves; this watches the rest (Home's
   readout and stats, the Career slot) so no CRT just swaps its text.

   Presentation only. A screen whose changes are shown by a number wheel
   opts out with data-crt-blink="off". Rapid runs of changes (the Home
   Boot's spinning stats) settle into one blink at the end. A screen's first
   text is never blinked, and a blink its own code already started is never
   doubled. Reduced Motion: no blink. */
(function(){
  const SETTLE_MS = 120;   // quiet time before a run of changes counts as one
  const BLINK_MS = 250;    // matches paintCRT(): the .23s burst plus a frame

  const seen = new WeakSet();
  const lastText = new WeakMap();
  const timers = new WeakMap();

  function blink(el){
    if (typeof motionOff === 'function' && motionOff()) return;
    el.classList.remove('crt-refresh'); void el.offsetWidth; el.classList.add('crt-refresh');
    clearTimeout(el._crtRefreshT);
    el._crtRefreshT = setTimeout(() => el.classList.remove('crt-refresh'), BLINK_MS);
  }

  function settle(el){
    const text = el.textContent;
    const prev = lastText.get(el) || '';
    if (text === prev) return;
    lastText.set(el, text);
    // A screen built empty and filled a moment later is showing its first
    // text, not changing it.
    if (!prev.trim()) return;
    if (!el.classList.contains('crt-refresh')) blink(el);
  }

  const watcher = new MutationObserver(records => {
    for (const r of records){
      const el = r.target.nodeType === 1 ? r.target.closest('.machine-crt') : r.target.parentElement && r.target.parentElement.closest('.machine-crt');
      if (!el || el.dataset.crtBlink === 'off') continue;
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => settle(el), SETTLE_MS));
    }
  });

  function adopt(el){
    if (seen.has(el)) return;
    seen.add(el);
    lastText.set(el, el.textContent);
    watcher.observe(el, { childList:true, characterData:true, subtree:true });
  }

  function scan(root){
    if (root.nodeType !== 1) return;
    if (root.classList.contains('machine-crt')) adopt(root);
    root.querySelectorAll('.machine-crt').forEach(adopt);
  }

  // Career and the results stage build their CRTs on the fly.
  new MutationObserver(records => {
    for (const r of records) r.addedNodes.forEach(scan);
  }).observe(document.body, { childList:true, subtree:true });
  scan(document.body);
})();
