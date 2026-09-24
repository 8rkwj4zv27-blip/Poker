"use strict";

/* ============================================================
   HOME BOOT — "the cabinet switches on"

   Plays once per cold launch, on the main menu, before the player's
   first touch. The menu is already built and fully rendered underneath;
   this only switches its parts on, in the order a real machine would:

     1. MAINS    the dark cabinet clunks up to full light in three
                 stepped relay jumps
     2. TEST     the top readout runs a short self-test, amber lamp
                 blinking; lines tick over one at a time
     3. MARQUEE  the POKER FACES letters catch one by one like marquee
                 bulbs (each flickers before it holds), then the stripe
                 under them runs out segment by segment
     4. CAST     the four House Faces shutters snap open left to right
     5. STATS    the stats display flickers on, digits spin, then settle
     6. BAY      the control-bay lamps blink, the buttons light top to
                 bottom
     7. READY    the readout reads DEALER READY, its lamp turns green

   ~1.6s at 1x. A tap (or key) anywhere jumps to the finished menu; that
   tap is swallowed so it can never also press a button. Reduced Motion
   skips the boot entirely. Returning to the menu from a sub-screen or a
   table never replays it — only a real page load does.

   SOUND. A cold launch has no user gesture, so on iOS (and most
   browsers) audio is still locked when the boot runs. Every sound here is
   guarded by Sound.audible(), so nothing is queued on a suspended context
   to burst out later. A tap to skip DOES unlock audio, and gets the
   finishing clunk + ready tone.

   PRESENTATION ONLY: classes on #home and text in the top readout. Never
   touches storage, settings or game state. The "armed" (dark) state is
   applied by a tiny inline script right after #home in index.html so the
   lit menu never flashes first; that script also carries a fail-safe that
   un-darkens the menu if this file never runs.

   Tuning lives in HOME_BOOT_CONFIG; boot-lab.html replays it with speed
   and sound switches.
   ============================================================ */

const HOME_BOOT_CONFIG = {
  enabled: true,
  timeScale: 1,                 // 0.5 = half speed (Lab only)
  mainsAt: 140,                 // relay clunk; the cabinet steps up to full light
  test: { at: 330, stepMs: 150, lines: ['SELF TEST', 'DECK 52 OK', 'CHIPS OK', 'FACES OK'] },
  marquee: { at: 380, letterMs: 44 },
  cast: { at: 800, faceMs: 85 },
  stats: { at: 1000, spinMs: 220 },
  bay: { at: 1110, buttonMs: 65 },
  readyAt: 1440,
  endAt: 1640
};

const HomeBoot = (() => {
  const cfg = HOME_BOOT_CONFIG;
  const STAGES = ['hb-boot', 'hb-mains', 'hb-rule', 'hb-stats', 'hb-bay', 'hb-ready'];
  let run = null;

  const home = () => $('home');
  const speed = () => Number(cfg.timeScale) || 1;
  const t = ms => ms / speed();
  const readoutText = () => $('home-readout-text');

  /* Marquee letters: each character of the brand wrapped once in a <b>,
     so it can light on its own. <b> (not <span>) on purpose: the brand's
     `span:last-child` rule offsets the whole FACES line and must not also
     catch the last letter. */
  function letters(){
    const brand = document.querySelector('#home .hero .brand');
    if (!brand) return [];
    if (!brand.querySelector('.hb-l')){
      brand.querySelectorAll(':scope > span').forEach(line => {
        const text = line.textContent;
        line.textContent = '';
        for (const ch of text){
          const b = document.createElement('b');
          b.className = 'hb-l';
          b.textContent = ch;
          line.appendChild(b);
        }
      });
    }
    return [...brand.querySelectorAll('.hb-l')];
  }

  /* Bulbs don't catch in reading order. A fixed shuffle (not random) so
     every launch looks the same and it can be tuned by eye. */
  const LETTER_ORDER = [0, 3, 1, 4, 2, 9, 6, 8, 5, 7];

  function play(){
    const el = home();
    const housing = $('menu-contraption');
    if (!el || !housing) return;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(() => {
      if (!run) return;
      // The menu can be left mid-boot by code (a direct route, a lab);
      // then there is nothing to switch on.
      if (el.classList.contains('hidden')) { finish(false); return; }
      try { fn(); } catch (e) { console.error('Home boot step failed', e); finish(false); }
    }, t(ms)));
    const sound = fn => { if (Sound.audible()) fn(); };

    run = { timers, spins: [] };
    if (speed() !== 1) el.style.setProperty('--hb-slow', String(1 / speed()));
    el.classList.add('hb-boot');
    housing.inert = true;
    el.addEventListener('pointerdown', skip, true);
    document.addEventListener('keydown', skip, true);

    // The self-test lines are shorter than DEALER READY; hold the
    // readout's width so the top bar never reflows under them.
    const readout = el.querySelector('.pc-ready-readout');
    if (readout) readout.style.minWidth = readout.offsetWidth + 'px';
    const text = readoutText();
    if (text) text.textContent = '';

    // 1. MAINS
    at(cfg.mainsAt, () => {
      el.classList.add('hb-mains');
      sound(() => { Sound.stageLock(); Sound.wheelRelay(.7); });
    });

    // 2. SELF-TEST readout
    cfg.test.lines.forEach((line, i) => at(cfg.test.at + i * cfg.test.stepMs, () => {
      if (text) text.textContent = line;
      sound(() => Sound.counterTick(i === 0));
    }));

    // 3. MARQUEE letters, then the stripe
    const ls = letters();
    const order = LETTER_ORDER.filter(i => i < ls.length)
      .concat(ls.map((_, i) => i).filter(i => !LETTER_ORDER.includes(i)));
    order.forEach((idx, n) => at(cfg.marquee.at + n * cfg.marquee.letterMs, () => {
      ls[idx].classList.add('hb-lit');
      if (n % 2 === 0) sound(() => Sound.bootFilament());
    }));
    at(cfg.marquee.at + order.length * cfg.marquee.letterMs + 40, () => {
      el.classList.add('hb-rule');
      sound(() => Sound.wheelRelay(.45));
    });

    // 4. CAST shutters
    [...el.querySelectorAll('.hero-faces .hf')].forEach((cell, i) => at(cfg.cast.at + i * cfg.cast.faceMs, () => {
      cell.classList.add('hb-open');
      sound(() => Sound.hatchOpen());
    }));

    // 5. STATS — flicker on, digits spin, settle on the real values
    at(cfg.stats.at, () => {
      el.classList.add('hb-stats');
      spinDigits(el);
      sound(() => Sound.wheelRelay(.5));
    });

    // 6. BAY — buttons light top to bottom
    at(cfg.bay.at, () => {
      el.classList.add('hb-bay');
      sound(() => Sound.consoleShift());
    });
    [...el.querySelectorAll('.pc-control-bay .pc-button, .pc-control-bay .home-row .btn-secondary')]
      .forEach((btn, i) => at(cfg.bay.at + 60 + i * cfg.bay.buttonMs, () => {
        btn.classList.add('hb-on');
        sound(() => Sound.wheelRelay(.35));
      }));

    // 7. READY
    at(cfg.readyAt, () => {
      el.classList.add('hb-ready');
      if (text) text.textContent = 'DEALER READY';
      sound(() => Sound.bootReady());
    });
    at(cfg.endAt, () => finish(false));
  }

  /* Each stat's value text is swapped for random digits a few times, then
     restored EXACTLY — renderStats() owns the real text; this never
     computes a number of its own. */
  function spinDigits(el){
    el.querySelectorAll('.stats-card .stat-cell .v').forEach(v => {
      const real = v.textContent;
      if (!/\d/.test(real)) return;
      const stop = performance.now() + t(cfg.stats.spinMs);
      const spin = setInterval(() => {
        if (!run || performance.now() >= stop){
          clearInterval(spin);
          v.textContent = real;
          return;
        }
        v.textContent = real.replace(/\d/g, () => String(Math.floor(Math.random() * 10)));
      }, 45);
      run.spins.push(() => { clearInterval(spin); v.textContent = real; });
    });
  }

  function skip(event){
    if (!run) return;
    if (event.type === 'keydown' && event.key === 'Tab') return;
    event.preventDefault();
    event.stopPropagation();
    // This tap is a user gesture: audio can unlock now, so the skip gets
    // its clunk even on a cold iOS launch.
    Sound.unlock();
    if (event.type === 'pointerdown') swallowNextClick();
    finish(true);
  }

  /* On touch, the browser synthesises the click after the finger lifts,
     at whatever is under it — by then the menu is live again. The tap
     that skips the boot must never also press a button, so its click is
     eaten: once, and only until just after that finger lifts, so a later
     real tap is never lost however long the skipping press was held. */
  function swallowNextClick(){
    let timer = setTimeout(done, 5000);
    function eat(e){ e.preventDefault(); e.stopPropagation(); done(); }
    function lifted(){ clearTimeout(timer); timer = setTimeout(done, 400); }
    function done(){
      clearTimeout(timer);
      document.removeEventListener('click', eat, true);
      document.removeEventListener('pointerup', lifted, true);
      document.removeEventListener('pointercancel', lifted, true);
    }
    document.addEventListener('click', eat, true);
    document.addEventListener('pointerup', lifted, true);
    document.addEventListener('pointercancel', lifted, true);
  }

  function finish(skipped){
    const el = home();
    if (!run) return;
    run.timers.forEach(clearTimeout);
    run.spins.forEach(stop => stop());
    run = null;
    if (el){
      el.removeEventListener('pointerdown', skip, true);
      el.classList.remove(...STAGES);
      el.style.removeProperty('--hb-slow');
      el.querySelectorAll('.hb-lit, .hb-open, .hb-on').forEach(n => n.classList.remove('hb-lit', 'hb-open', 'hb-on'));
    }
    document.removeEventListener('keydown', skip, true);
    const housing = $('menu-contraption');
    if (housing) housing.inert = false;
    const readout = el && el.querySelector('.pc-ready-readout');
    if (readout) readout.style.minWidth = '';
    const text = readoutText();
    if (text) text.textContent = 'DEALER READY';
    if (skipped){ Sound.stageLock(); Sound.bootReady(); }
  }

  /* Called once, after wireUI() has built the menu. */
  function start(){
    window.clearTimeout(window.__homeBootFailsafe);
    const el = home();
    if (!el) return;
    const ok = cfg.enabled && !motionOff() && !document.hidden && !el.classList.contains('hidden');
    if (!ok){ el.classList.remove(...STAGES); return; }
    play();
  }

  /* Lab replay: put the menu back in the dark and run again. */
  function replay(){
    if (run) finish(false);
    const el = home();
    if (el) el.classList.add('hb-boot');
    play();
  }

  return { start, replay, config: cfg, finish: () => finish(false), get running(){ return !!run; } };
})();

/* wireUI() is queued for DOMContentLoaded by 08-dev-mode.js (loaded just
   before this file), so queuing after it runs the boot on a built menu. */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => HomeBoot.start());
else HomeBoot.start();
