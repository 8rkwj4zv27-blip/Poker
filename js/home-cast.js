"use strict";

/* ============================================================
   HOME CAST — the four House Faces in the title-screen drawer

   Each launch deals the four portraits four DIFFERENT temperaments. A
   temperament is the reason behind every expression a face pulls:

     rest   the face it settles back to — who it is at a glance
     burst  three expressions flashed in quick succession when it flares
            (on landing in the boot, when tapped, now and then on its own)
     pool   the quieter moods it drifts between while idle
     react  what it pulls when a NEIGHBOUR flares next to it
     fx     how each flash lands: 'jolt' (a shake: temper, nerves) or
            'pop' (a bounce: glee, smugness, puzzlement)

   So the drawer is random per launch, but never arbitrary: the Hothead
   only ever gets angrier, the Nervy one flinches when the Showman next
   to it erupts, and a flare only reaches the faces sitting next to it.

   Idle life is deliberately sparse (one small change every ~2s, a flare
   every ten seconds or so) and silent; only a tap makes a sound. Runs
   only while the menu is showing and the tab is visible, and waits for
   the Home Boot to drop the faces in (js/home-boot.js calls arrive()).
   Reduced Motion: every face holds its rest mood, taps swap moods
   without the jolt/pop.

   Decorative only — NOT the in-table mood system. No poker state, no AI.
   Colour still goes through the same renderFace(p, mood) the table uses,
   so each portrait's tint stays correct for either art batch.
   ============================================================ */

const HOME_CAST_TEMPERS = {
  hothead: { rest:'displeased1', burst:['angry1','furious','angry'],
             pool:['displeased1','angry1','suspicious1','tilted','neutral2'], react:'angry1', fx:'jolt' },
  showman: { rest:'happy1', burst:['joyful1','ecstatic1','manic1'],
             pool:['happy1','happy2','cocky1','gloating1','joyful1'], react:'gloating1', fx:'pop' },
  schemer: { rest:'sly1', burst:['scheming1','smug1','gloating'],
             pool:['sly1','smug1','scheming1','suspicious2','cocky2'], react:'suspicious2', fx:'pop' },
  nervy:   { rest:'worried1', burst:['shocked1','panic1','veryNervous1'],
             pool:['nervous1','nervous2','worried1','veryNervous2','relieved1'], react:'shocked1', fx:'jolt' },
  thinker: { rest:'thinking1', burst:['confused1','baffled1','happyConfused1'],
             pool:['thinking1','thinking2','confused2','suspicious1','neutral4'], react:'confused1', fx:'pop' },
  deadpan: { rest:'neutral1', burst:['suspicious1','displeased1','neutral3'],
             pool:['neutral1','neutral3','neutral5','suspicious1'], react:'neutral3', fx:'pop' }
};

const HOME_CAST_CONFIG = {
  flashMs: 115,            // gap between the three burst expressions
  holdMs: 900,             // how long the last burst face is held
  reactDelayMs: 240,       // a neighbour takes a beat to react
  reactHoldMs: 950,
  idleMinMs: 1600, idleMaxMs: 2800,
  flareChance: .2,         // per idle tick
  calmChance: .12          // per idle tick: someone drifts back to rest
};

const HeroCast = (() => {
  const cfg = HOME_CAST_CONFIG;
  let faces = [];
  let idleTimer = 0;

  const pick = list => list[Math.floor(Math.random() * list.length)];
  const home = () => $('home');
  const menuLive = () => {
    const el = home();
    return el && !el.classList.contains('hidden') && !document.hidden;
  };
  const booting = () => { const el = home(); return !!el && el.classList.contains('hb-boot'); };

  function clearFace(f){ f.timers.forEach(clearTimeout); f.timers = []; }
  function later(f, ms, fn){ f.timers.push(setTimeout(fn, ms)); }

  function show(f, mood, fx){
    f.mood = mood;
    f.cell.innerHTML = renderFace(f.p, mood);
    if (!fx || motionOff()) return;
    const img = f.cell.querySelector('.face');
    if (img){ void img.offsetWidth; img.classList.add(fx === 'jolt' ? 'face-jolt' : 'face-pop'); }
  }
  function rest(f){ f.busy = false; if (f.mood !== f.t.rest) show(f, f.t.rest, 'pop'); }

  /* Three flashes of its temperament, a hold, then back to itself. */
  function burst(f){
    clearFace(f);
    f.busy = true;
    if (motionOff()){
      show(f, f.t.burst[f.t.burst.length - 1]);
      later(f, cfg.holdMs, () => rest(f));
      return;
    }
    f.t.burst.forEach((mood, i) => later(f, i * cfg.flashMs, () => show(f, mood, f.t.fx)));
    later(f, (f.t.burst.length - 1) * cfg.flashMs + cfg.holdMs, () => rest(f));
  }

  function react(f){
    clearFace(f);
    f.busy = true;
    show(f, f.t.react, f.t.fx);
    later(f, cfg.reactHoldMs + Math.random() * 300, () => rest(f));
  }

  /* A flare is heard by the faces beside it; the far end usually shrugs
     it off. */
  function flare(i, withNeighbours){
    const f = faces[i];
    if (!f) return;
    burst(f);
    if (!withNeighbours) return;
    faces.forEach((o, j) => {
      if (j === i) return;
      const chance = Math.abs(j - i) === 1 ? .65 : .2;
      if (Math.random() < chance) later(o, cfg.reactDelayMs + Math.random() * 120, () => react(o));
    });
  }

  function idleTick(){
    idleTimer = setTimeout(idleTick, cfg.idleMinMs + Math.random() * (cfg.idleMaxMs - cfg.idleMinMs));
    if (!menuLive() || booting() || motionOff()) return;
    const free = faces.filter(f => !f.busy);
    if (!free.length) return;
    const roll = Math.random();
    if (roll < cfg.flareChance){
      flare(faces.indexOf(pick(free)), true);
    } else if (roll < cfg.flareChance + cfg.calmChance){
      const f = pick(free);
      if (f.mood !== f.t.rest) show(f, f.t.rest, 'pop');
    } else {
      const f = pick(free);
      const pool = f.t.pool.filter(m => m !== f.mood);
      show(f, pick(pool), Math.random() < .5 ? f.t.fx : null);
    }
  }

  function preload(){
    const seen = new Set();
    faces.forEach(f => [f.t.rest, f.t.react, ...f.t.burst, ...f.t.pool].forEach(mood => {
      const src = faceArtPath(mood);
      if (!src || seen.has(src)) return;
      seen.add(src);
      const img = new Image();
      img.src = src;
    }));
  }

  function init(){
    const wrap = $('hero-faces');
    if (!wrap || typeof FACE_ART === 'undefined' || faces.length) return;
    // Four distinct colours from the palette every opponent seat draws
    // from, and four distinct temperaments.
    const colorIdxs = shuffle(FACE_COLORS.map((_, i) => i)).slice(0, 4);
    const tempers = shuffle(Object.keys(HOME_CAST_TEMPERS)).slice(0, colorIdxs.length);
    faces = colorIdxs.map((colorIdx, i) => {
      const cell = document.createElement('div');
      cell.className = 'hf';
      cell.dataset.temper = tempers[i];
      wrap.appendChild(cell);
      // A minimal player-shaped object: renderFace only reads faceColorIdx.
      const f = { cell, p:{ faceColorIdx:colorIdx }, t:HOME_CAST_TEMPERS[tempers[i]], mood:null, busy:false, timers:[] };
      show(f, f.t.rest);
      return f;
    });
    preload();
    wrap.addEventListener('pointerdown', poke);
    if (!motionOff()) idleTimer = setTimeout(idleTick, 2400);
  }

  function poke(event){
    const cell = event.target.closest('.hf');
    const i = faces.findIndex(f => f.cell === cell);
    if (i < 0 || booting()) return;
    Sound.koPortraitClack(.55);
    flare(i, true);
  }

  /* Boot: face i has just hit the tray. */
  function arrive(i){ flare(i, false); }

  /* Boot skipped: everyone straight to who they are. */
  function settle(){ faces.forEach(f => { clearFace(f); f.busy = false; show(f, f.t.rest); }); }

  return { init, arrive, settle, get count(){ return faces.length; } };
})();

/* Called by wireUI() (08-dev-mode.js). */
function initHeroFaces(){ HeroCast.init(); }
