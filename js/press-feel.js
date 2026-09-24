"use strict";

/* ============================================================
   PRESS FEEL — every button presses like a real key (Pattern Book)

   One press for the whole machine: the heavy thunk that began on the big
   yellow buttons. It is scaled by the key's mass, so the character is the
   same everywhere and only the weight changes:

     big    Career, Buy In, Deal Me In, dialog confirms, FOLD/CHECK/CALL/
            RAISE, Award Pot   — deepest sink, fullest bounce, the clunk
     std    Custom Game, Done, Cancel, choice rows, quick bets — a lighter
            sink and bounce, the same clunk a touch lighter
     small  ⚙ ← Save, steppers — a short sink, one small bounce, a tick-thunk

     DOWN   the moment the finger lands the face sinks (and, on the big
            cartridges, the lamps flare and the casing takes a 1px knock)
            and the press sound plays
     UP     the face springs back in pixel steps: past its rest, back
            down, a last small lift, settle

   Travel and bounce per size are CSS tokens in css/press-feel.css; the
   Finishes menu (js/finishes.js) can swap them for a heavier or lighter
   set, or turn this off to compare with each button's original press.

   A button the game deliberately HOLDS down after the press (the menu's
   Career key stays sunk while the screen rolls away) is left held.

   The table actions keep their own per-action press sounds (fold, check,
   raise…) from 08-dev-mode.js; they only take the motion. Click handlers
   that used to play a press sound ask pressFeelSounded(button) first and
   skip theirs if this already played it. Keyboard/programmatic presses
   never set it, so they sound as before.

   Presentation only; never calls or blocks the buttons' own handlers.
   Reduced Motion: the face still sinks while held, but no spring.
   ============================================================ */

const PRESS_FEEL_CONFIG = {
  soundWindowMs: 900,       // how long a DOWN sound counts for the click
  hitMs: 110                // the casing knock
};

const PressFeel = (() => {
  const cfg = PRESS_FEEL_CONFIG;
  const HELD = ['career-entry-pressed', 'pc-launch-clunk'];
  // Allow-listed families by mass. Anything not listed (the Career ticket
  // rack, sliders, switches, seats) is left alone.
  const SIZES = [
    ['big',   '.pc-button-primary, .btn-primary, .btn-fold, .btn-check, .btn-call, .btn-raise, .btn-award-console, .btn-quick-resolve, .wide-btn'],
    ['small', '.icon-btn, .ch2-key, .table-save, .stepper button'],
    ['std',   '.pc-button-secondary, .btn-secondary, .segmented button, .quick-bet, .ch2-secondary, .ch2-card-flip, .cdir-primary, .cdir-abandon']
  ];
  const SOUND = { big:'allin', std:'thunk', small:'key' };
  // These play their own press sound on pointerdown.
  const OWN_SOUND = '#btn-fold, #btn-checkcall, #btn-raise, #btn-award-pot-console, #btn-quick-resolve';
  let active = null;

  const off = () => document.documentElement.dataset.finishPress === 'original';

  function sizeOf(btn){
    for (const [size, sel] of SIZES) if (btn.matches(sel)) return size;
    return null;
  }

  function target(event){
    const btn = event.target.closest && event.target.closest('button');
    if (!btn || btn.disabled) return null;
    const size = sizeOf(btn);
    if (!size) return null;
    // "Original" keeps only the big cartridges' press (the pre-book state).
    if (off() && !(btn.matches('.pc-button-primary') && btn.closest('#home, #career-hub'))) return null;
    return { btn, size };
  }

  function down(event){
    if (event.button > 0) return;
    const hit = target(event);
    if (!hit) return;
    const { btn, size } = hit;
    active = btn;
    btn.dataset.pf = size;
    btn.classList.remove('pf-spring');
    btn.classList.add('pf-down');
    const cradle = btn.closest('.pc-primary-cradle');
    if (cradle && !motionOff()){
      cradle.classList.remove('pf-hit'); void cradle.offsetWidth; cradle.classList.add('pf-hit');
      setTimeout(() => cradle.classList.remove('pf-hit'), cfg.hitMs);
    }
    if (!btn.matches(OWN_SOUND)){
      Sound.buttonPress(off() ? 'allin' : SOUND[size]);
      btn.dataset.pfSounded = String(performance.now());
    }
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

  /* True (once) if the DOWN sound for this button just played. */
  function sounded(btn){
    const at = Number(btn && btn.dataset.pfSounded);
    if (btn) delete btn.dataset.pfSounded;
    return !!at && performance.now() - at < cfg.soundWindowMs;
  }

  return { install, sounded };
})();

function pressFeelSounded(btn){ return PressFeel.sounded(btn); }

PressFeel.install();
