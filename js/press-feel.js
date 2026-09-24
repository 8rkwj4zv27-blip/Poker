"use strict";

/* ============================================================
   PRESS FEEL — the big yellow buttons press like real keys

   For every .pc-button-primary on the menu (#home) and the Career Hub
   (#career-hub):

     DOWN   the moment the finger lands: the face sinks into its body,
            the lamps on it flare, the casing takes a 1px knock, and the
            press clunk plays (it used to wait for the finger to lift)
     UP     the face springs back in pixel steps: past its rest, back
            down, a last small lift, settle

   A button the game deliberately HOLDS down after the press (the menu's
   Career key stays sunk while the screen rolls away) is left held: the
   spring only plays when the key actually comes back up.

   The press clunk now happens on DOWN, so the click handlers that used
   to play it on release ask pressFeelSounded(button) first and skip
   theirs if this already played it. Keyboard/programmatic presses never
   set it, so they sound exactly as before.

   Presentation only; never calls or blocks the buttons' own handlers.
   Reduced Motion: the face still sinks while held, but no spring.
   ============================================================ */

const PRESS_FEEL_CONFIG = {
  soundWindowMs: 900,       // how long a DOWN clunk counts for the click
  hitMs: 110                // the casing knock
};

const PressFeel = (() => {
  const cfg = PRESS_FEEL_CONFIG;
  const HELD = ['career-entry-pressed', 'pc-launch-clunk'];
  let active = null;

  const target = event => {
    const btn = event.target.closest && event.target.closest('.pc-button-primary');
    if (!btn || btn.disabled) return null;
    return btn.closest('#home, #career-hub') ? btn : null;
  };

  function down(event){
    if (event.button > 0) return;
    const btn = target(event);
    if (!btn) return;
    active = btn;
    btn.classList.remove('pf-spring');
    btn.classList.add('pf-down');
    const cradle = btn.closest('.pc-primary-cradle');
    if (cradle && !motionOff()){
      cradle.classList.remove('pf-hit'); void cradle.offsetWidth; cradle.classList.add('pf-hit');
      setTimeout(() => cradle.classList.remove('pf-hit'), cfg.hitMs);
    }
    Sound.buttonPress('allin');
    btn.dataset.pfSounded = String(performance.now());
  }

  function up(){
    const btn = active;
    active = null;
    if (!btn) return;
    btn.classList.remove('pf-down');
    // The click (and whatever it starts) runs right after pointerup; look
    // once it has, so a key the game now holds down is left holding.
    setTimeout(() => {
      if (motionOff() || HELD.some(c => btn.classList.contains(c))) return;
      btn.classList.remove('pf-spring'); void btn.offsetWidth; btn.classList.add('pf-spring');
    }, 0);
  }

  function springEnded(event){
    if (event.animationName === 'pfSpring') event.target.classList.remove('pf-spring');
  }

  function install(){
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('animationend', springEnded, true);
  }

  /* True (once) if the DOWN clunk for this button just played. */
  function sounded(btn){
    const at = Number(btn && btn.dataset.pfSounded);
    if (btn) delete btn.dataset.pfSounded;
    return !!at && performance.now() - at < cfg.soundWindowMs;
  }

  return { install, sounded };
})();

function pressFeelSounded(btn){ return PressFeel.sounded(btn); }

PressFeel.install();
