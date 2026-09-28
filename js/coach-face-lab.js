"use strict";

/* ============================================================
   COACH FACE LAB — the controls, inside the game (round 2, phone-first)

   Round 1 picked a painted face with thick glasses. Round 2 (owner): make
   him a bit of an AI bot, a little old CRT set plugged into the machine
   and plonked on the table, with a digital face. The candidate is
   js/coach-tv.js + css/coach-tv.css.

   Keys on the table: TUNE opens the bottom sheet; POWER switches him on
   and off (the dashboard button, in the game). Tap him to make him talk.
   The sheet's tabs:
     THE SET   case, finish, size, cable
     THE FACE  face style, screen ink, glasses, expressions
     POWER     how he arrives, deck side, copy picks, deal again
   Picks go straight to the set and to the host, so they survive DEAL AGAIN.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null };
  const TV = CoachTV;
  let order = Object.assign({}, TV.DEFAULTS, state.order && state.order.case ? state.order : {});

  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  function applyOrder(){ TV.apply(order); save(); paint(); }

  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = (name, key, opts, note) => '<div class="sdl-row"><div class="sdl-name">' + name + '</div>' + seg(key, opts, order[key]) + (note ? '<p class="sdl-note">' + note + '</p>' : '') + '</div>';
  // a tile holds a small copy of the set; its face is filled in afterwards
  const tile = (key, v, label, o) => '<button type="button" class="cfl-tile' + (order[key] === v ? ' is-on' : '') + '" data-key="' + key + '" data-v="' + v + '">' +
    '<span class="cfl-tile-set coach-station ctv ctv-case--' + o.case + ' ctv-finish--' + o.finish + '" data-o="' + encodeURIComponent(JSON.stringify(o)) + '">' + TV.setHTML(o) + '</span>' +
    '<span class="cfl-tile-name">' + label + '</span></button>';
  const withO = patch => Object.assign({}, order, patch);

  function setPane(){
    return '<h3>THE SET<small>Plonked on the felt next to your cards, plugged into the machine. The first of each is my suggestion.</small></h3>' +
      '<div class="cfl-grid cfl-grid--3">' + TV.CASES.map(c => tile('case', c[0], c[1], withO({ case:c[0] }))).join('') + '</div>' +
      row('PLASTIC', 'finish', TV.FINISHES) +
      row('SIZE', 'size', [['m', 'MEDIUM'], ['s', 'SMALL'], ['l', 'LARGE']]) +
      row('CABLE', 'cable', TV.CABLES, 'Out of the back of the set, over the rail, into the machine.');
  }
  function facePane(){
    return '<h3>HIS FACE<small>Digital, not painted. Same shapes, drawn three ways.</small></h3>' +
      '<div class="cfl-grid cfl-grid--3">' + TV.FACES.map(f => tile('face', f[0], f[1], withO({ face:f[0] }))).join('') + '</div>' +
      row('SCREEN INK', 'ink', TV.INKS, 'The inks the game\'s other screens use.') +
      row('GLASSES', 'glasses', [['on', 'ON (ROUND 1)'], ['off', 'OFF']]) +
      '<h3>HIS EXPRESSIONS<small>Tap one to show it on the table. Tap him on the table to make him talk.</small></h3>' +
      '<div class="cfl-grid cfl-grid--4">' + TV.MOODS.map(m => tile('mood', m[0], m[1], withO({ mood:m[0], case:'bare' }))).join('') + '</div>';
  }
  function powerPane(){
    return '<h3>SWITCHING HIM ON<small>POWER on the table is the dashboard button. Try it.</small></h3>' +
      row('HOW HE ARRIVES', 'power', TV.POWERS) +
      '<div class="sdl-row"><div class="sdl-name">DECK SIDE</div>' + seg('deckside', [['left', 'DECK LEFT'], ['right', 'DECK RIGHT']], (typeof settings !== 'undefined' && settings.deckSide === 'right') ? 'right' : 'left') +
        '<p class="sdl-note">The game\'s own setting (⚙ → The deck). He moves to the other side.</p></div>' +
      '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
      '<button type="button" class="sdl-again" data-act="deal">DEAL AGAIN</button>' +
      '<textarea class="sdl-copytext" readonly hidden></textarea>';
  }

  let sheet, key, pwr;
  function fillTiles(){
    sheet.querySelectorAll('.cfl-tile-set').forEach(async s => {
      const o = JSON.parse(decodeURIComponent(s.dataset.o));
      const pic = s.querySelector('.ctv-pic');
      if (pic) pic.innerHTML = await TV.faceSVG(o);
    });
  }
  function paint(){
    if (!sheet) return;
    const body = sheet.querySelector('.sdl-body'), top = body.scrollTop;
    sheet.querySelector('[data-pane="set"]').innerHTML = setPane();
    sheet.querySelector('[data-pane="face"]').innerHTML = facePane();
    sheet.querySelector('[data-pane="power"]').innerHTML = powerPane();
    body.scrollTop = top;
    fillTiles();
    if (pwr) pwr.classList.toggle('is-on', TV.on);
  }
  function build(){
    key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    pwr = document.createElement('button');
    pwr.type = 'button'; pwr.className = 'sdl-key cfl-power is-on'; pwr.textContent = 'POWER';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet cfl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Coach face lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="set" class="is-on">THE SET</button><button type="button" data-tab="face">THE FACE</button><button type="button" data-tab="power">POWER</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body"><section data-pane="set"></section><section data-pane="face" hidden></section><section data-pane="power" hidden></section></div>';
    document.body.appendChild(key); document.body.appendChild(pwr); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    pwr.addEventListener('click', async () => { await TV.power(!TV.on); pwr.classList.toggle('is-on', TV.on); });
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
      if (t.dataset.act === 'reset'){ order = Object.assign({}, TV.DEFAULTS); applyOrder(); return; }
      if (t.dataset.act === 'copy'){ copyPicks(t); return; }
      const holder = t.closest('[data-key]');
      if (!holder) return;
      const k = holder.dataset.key, v = t.dataset.v;
      if (k === 'deckside'){
        const b = document.querySelector('#deck-side-seg button[data-v="' + v + '"]');
        if (b) b.click(); else if (typeof settings !== 'undefined'){ settings.deckSide = v; }
        setTimeout(() => { TV.place(); paint(); }, 60);
        return;
      }
      order[k] = v;
      if (k === 'mood'){ TV.setMood(v); save(); paint(); return; }
      applyOrder();
    });
    paint();
  }
  function copyPicks(t){
    const name = (list, v) => { const r = list.find(x => x[0] === v); return r ? r[1] : v; };
    const text = 'COACH TV: ' + [
      'set ' + name(TV.CASES, order.case), 'plastic ' + name(TV.FINISHES, order.finish), 'size ' + ({ s:'small', m:'medium', l:'large' })[order.size],
      'cable ' + name(TV.CABLES, order.cable), 'face ' + name(TV.FACES, order.face), 'ink ' + name(TV.INKS, order.ink),
      'glasses ' + order.glasses, 'arrives ' + name(TV.POWERS, order.power)
    ].join(' · ');
    const ta = sheet.querySelector('.sdl-copytext');
    const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
    try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(e){ done(false); }
  }

  /* ---- start: a fresh table, sitting on your first decision ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    TV.apply(order);
    build();
    document.addEventListener('click', e => { if (e.target.closest('#coach-station')) TV.talk(1800); });
    try{ startSinglePlayerRun({ opponentCount:4 }); }catch(err){ console.error(err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
