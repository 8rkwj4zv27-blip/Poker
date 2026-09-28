"use strict";

/* ============================================================
   COACH FACE LAB — the controls, inside the game (round 1, phone-first)

   Runs in the game copy coach-face-lab.html builds (js/coach-face-lab-
   host.js). A TUNE key opens a bottom sheet with three tabs:
     GLASSES  six pairs, side by side on his face; the frame colour
     FACE     his colour, the dealer's visor, his expressions
     SEAT     how he's housed, his size, which side the deck is on
   Picks go straight to the coach on the table (CoachFace.apply) and to
   the host, so they survive DEAL AGAIN. Tap the coach on the table to
   step through his expressions.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null };
  const $id = id => document.getElementById(id);
  const CF = CoachFace;
  let order = Object.assign({}, CF.DEFAULTS, state.order || {});
  let cycleT = null;

  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  function applyOrder(){ CF.apply(order); save(); paint(); }

  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = (name, key, opts, note) => '<div class="sdl-row"><div class="sdl-name">' + name + '</div>' + seg(key, opts, order[key]) + (note ? '<p class="sdl-note">' + note + '</p>' : '') + '</div>';
  const tile = (key, v, label, face, extra) => '<button type="button" class="cfl-tile' + (order[key] === v ? ' is-on' : '') + '" data-key="' + key + '" data-v="' + v + '">' +
    '<span class="cfl-tile-face' + (extra || '') + '">' + face + '</span><span class="cfl-tile-name">' + label + '</span></button>';

  function glassesPane(){
    return '<h3>THE GLASSES<small>Tap a pair to put it on him. The first is my suggestion.</small></h3>' +
      '<div class="cfl-grid">' + CF.GLASSES.map(g => tile('glasses', g.id, g.name, CF.faceHTML(Object.assign({}, order, { glasses:g.id })))).join('') + '</div>' +
      row('FRAME COLOUR', 'frame', [['auto', 'AS DRAWN'], ['black', 'BLACK'], ['gold', 'GOLD'], ['tortoise', 'TORTOISE'], ['silver', 'SILVER']], 'AS DRAWN keeps each pair\'s own colour.');
  }
  function facePane(){
    return '<h3>HIS COLOUR<small>None of the opponents wear these, so he never looks like one of them.</small></h3>' +
      '<div class="cfl-grid cfl-grid--4">' + CF.COLOURS.map(c => tile('colour', c[0], c[1], CF.faceHTML(Object.assign({}, order, { colour:c[0] })))).join('') + '</div>' +
      row('DEALER\'S VISOR', 'visor', [['off', 'OFF'], ['on', 'ON']], 'The old green card-room eyeshade.') +
      '<h3>HIS EXPRESSIONS<small>Kept to a calm few. Tap one, or tap him on the table to step through them.</small></h3>' +
      '<div class="cfl-grid cfl-grid--3">' + CF.MOODS.map(m => tile('mood', m[0], m[1], CF.faceHTML(Object.assign({}, order, { mood:m[0] })))).join('') + '</div>' +
      '<div class="sdl-row"><div class="sdl-name">CYCLE ON THE TABLE</div>' + seg('cycle', [['off', 'OFF'], ['on', 'ON']], cycleT ? 'on' : 'off') + '</div>';
  }
  function seatPane(){
    return '<h3>HOW HE SITS<small>Next to your cards, opposite the deck.</small></h3>' +
      '<div class="cfl-grid cfl-grid--3">' + CF.HOUSINGS.map(h => tile('housing', h[0], h[1], housingPreview(h[0]), ' cfl-tile-face--house')).join('') + '</div>' +
      row('SIZE', 'size', [['m', 'MEDIUM'], ['s', 'SMALL'], ['l', 'LARGE']]) +
      '<div class="sdl-row"><div class="sdl-name">DECK SIDE</div>' + seg('deckside', [['left', 'DECK LEFT'], ['right', 'DECK RIGHT']], (typeof settings !== 'undefined' && settings.deckSide === 'right') ? 'right' : 'left') +
        '<p class="sdl-note">The game\'s own setting (⚙ → The deck). He moves to the other side.</p></div>' +
      '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
      '<button type="button" class="sdl-again" data-act="deal">DEAL AGAIN</button>' +
      '<textarea class="sdl-copytext" readonly hidden></textarea>';
  }
  function housingPreview(h){
    return '<span class="coach-station cf-house-' + h + ' cfl-mini" style="--cf-size:52px;--cf-own:' + (CF.COLOURS.find(c => c[0] === order.colour) || CF.COLOURS[0])[2] + '"><span class="cf-case" style="display:block">' +
      (h === 'cabinet' ? '<span class="cf-plate" style="display:block">COACH</span>' : '') + '<span class="cf-screen" style="display:block">' + CF.faceHTML() + '</span></span></span>';
  }

  let sheet, key;
  function paint(){
    if (!sheet) return;
    const pane = n => sheet.querySelector('[data-pane="' + n + '"]');
    const top = sheet.querySelector('.sdl-body').scrollTop;
    pane('glasses').innerHTML = glassesPane();
    pane('face').innerHTML = facePane();
    pane('seat').innerHTML = seatPane();
    sheet.querySelector('.sdl-body').scrollTop = top;
  }
  function build(){
    key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet cfl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Coach face lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="glasses" class="is-on">GLASSES</button><button type="button" data-tab="face">FACE</button><button type="button" data-tab="seat">SEAT</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body"><section data-pane="glasses"></section><section data-pane="face" hidden></section><section data-pane="seat" hidden></section></div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        sheet.querySelector('.sdl-body').scrollTop = 0;
        return;
      }
      if (t.dataset.act === 'deal'){ if (host) host.play(); else location.reload(); return; }
      if (t.dataset.act === 'reset'){ order = Object.assign({}, CF.DEFAULTS); applyOrder(); return; }
      if (t.dataset.act === 'copy'){ copyPicks(t); return; }
      const holder = t.closest('[data-key]');
      if (!holder) return;
      const k = holder.dataset.key, v = t.dataset.v;
      if (k === 'cycle'){ setCycle(v === 'on'); paint(); return; }
      if (k === 'deckside'){
        const b = document.querySelector('#deck-side-seg button[data-v="' + v + '"]');
        if (b) b.click(); else if (typeof settings !== 'undefined'){ settings.deckSide = v; }
        setTimeout(() => { CF.place(); paint(); }, 60);
        return;
      }
      order[k] = v;
      applyOrder();
    });
    paint();
  }
  function copyPicks(t){
    const g = CF.GLASSES.find(x => x.id === order.glasses) || CF.GLASSES[0];
    const name = (list, v) => { const r = list.find(x => x[0] === v); return r ? r[1] : v; };
    const text = 'COACH FACE: ' + [
      'glasses ' + g.name, 'frame ' + (order.frame === 'auto' ? 'as drawn' : order.frame), 'colour ' + name(CF.COLOURS, order.colour),
      'visor ' + order.visor, 'housing ' + name(CF.HOUSINGS, order.housing), 'size ' + ({ s:'small', m:'medium', l:'large' })[order.size]
    ].join(' · ');
    const ta = sheet.querySelector('.sdl-copytext');
    const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
    try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(e){ done(false); }
  }
  function nextMood(){
    const i = CF.MOODS.findIndex(m => m[0] === order.mood);
    order.mood = CF.MOODS[(i + 1) % CF.MOODS.length][0];
    CF.setMood(order.mood); save();
  }
  function setCycle(on){
    clearInterval(cycleT); cycleT = null;
    if (on) cycleT = setInterval(nextMood, 1600);
  }

  /* ---- start: a fresh table, sitting on your first decision ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    CF.apply(order);
    build();
    document.addEventListener('click', e => { if (e.target.closest('#coach-station')) nextMood(); });
    try{ startSinglePlayerRun({ opponentCount:4 }); }catch(err){ console.error(err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
