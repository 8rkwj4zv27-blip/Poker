"use strict";

/* ============================================================
   COACH FACE LAB — the controls, inside the game (round 3, phone-first)

   Round 3 (owner): he's the little Poker Machine's soul plugged into a
   TV. Two small dots and a mouth, pixel art, 2.5D with weight like the
   chips, pulled out from under the table by the dashboard and put down
   with a heavy thud, swiped off the same way, plugged visibly into a
   COACH key next to ⚙, and a proper blink boot. Candidate:
   js/coach-set.js + css/coach-set.css.

   On the table: the COACH key (next to ⚙) switches him on and off, as it
   will in the game. TUNE opens the sheet. Tap him to make him talk.
     THE SET   which TV, its plastic, glasses
     THE FACE  screen ink, expressions, where he looks
     ARRIVAL   how he comes and goes, weight, jolt, dust, boot, cable
   Picks go to the set at once and to the host, so they survive DEAL AGAIN.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null };
  const CS = CoachSet;
  let order = Object.assign({}, CS.DEFAULTS, state.order && state.order.from ? state.order : {});
  const wasOn = !!state.on;

  function save(){ if (host) host.set({ order:Object.assign({}, order), on:CS.on }); }
  function applyOrder(){ CS.apply(order); save(); paint(); }

  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = (name, key, note) => '<div class="sdl-row"><div class="sdl-name">' + name + '</div>' + seg(key, CS.OPTIONS[key], order[key]) + (note ? '<p class="sdl-note">' + note + '</p>' : '') + '</div>';
  const tile = (key, v, label, o) => '<button type="button" class="cfl-tile' + (order[key] === v ? ' is-on' : '') + '" data-key="' + key + '" data-v="' + v + '">' +
    '<span class="cfl-still" data-o="' + encodeURIComponent(JSON.stringify(o)) + '"></span><span class="cfl-tile-name">' + label + '</span></button>';
  const withO = patch => Object.assign({}, order, patch);

  function setPane(){
    return '<h3>THE SET<small>The machine\'s soul, in a little TV. Pixel art, drawn like the chips and cards. The first of each is my suggestion.</small></h3>' +
      '<div class="cfl-grid cfl-grid--3">' + CS.OPTIONS.set.map(s => tile('set', s[0], s[1], withO({ set:s[0] }))).join('') + '</div>' +
      row('PLASTIC', 'finish') +
      row('GLASSES', 'glasses', 'Two little pixel frames round his eyes. Off by default now he\'s the machine.');
  }
  function facePane(){
    return '<h3>HIS FACE<small>Two dots and a mouth. Tap one to show it on him.</small></h3>' +
      '<div class="cfl-grid cfl-grid--4">' + CS.MOODS.map(m => tile('mood', m[0], m[1], withO({ mood:m[0] }))).join('') + '</div>' +
      row('SCREEN INK', 'ink') +
      '<div class="sdl-row"><div class="sdl-name">WHERE HE LOOKS</div><div class="sdl-seg" data-key="look">' +
        [['you', 'AT YOU'], ['pot', 'THE POT'], ['player', 'A PLAYER'], ['ahead', 'AHEAD']].map(o => '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
        '</div><p class="sdl-note">On his own he blinks and now and then glances round the table.</p></div>';
  }
  function arrivalPane(){
    return '<h3>ON AND OFF<small>The COACH key next to ⚙ is the real switch. Or use these.</small></h3>' +
      '<div class="sdl-actions"><button type="button" data-act="on">SWITCH ON</button><button type="button" data-act="off">SWITCH OFF</button></div>' +
      row('HOW HE ARRIVES', 'from', 'Under the table: pulled up from beside the dashboard and put down. Swiped back off the same way.') +
      row('WEIGHT', 'weight') +
      row('WHEN HE LANDS', 'jolt', 'The table and the chips jump.') +
      row('DUST', 'dust') +
      row('BOOT', 'boot', 'Full: power up the cable, a click, a dot, a line, static, then his eyes blink on and look round.') +
      row('CABLE', 'cable') +
      '<div class="sdl-row"><div class="sdl-name">DECK SIDE</div>' + seg('deckside', [['left', 'DECK LEFT'], ['right', 'DECK RIGHT']], (typeof settings !== 'undefined' && settings.deckSide === 'right') ? 'right' : 'left') +
        '<p class="sdl-note">The game\'s own setting (⚙ → The deck). He sits on the other side.</p></div>' +
      '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
      '<button type="button" class="sdl-again" data-act="deal">DEAL AGAIN</button>' +
      '<textarea class="sdl-copytext" readonly hidden></textarea>';
  }

  let sheet, key;
  function fillTiles(){
    sheet.querySelectorAll('.cfl-still').forEach(s => { s.innerHTML = ''; CS.still(JSON.parse(decodeURIComponent(s.dataset.o)), s); });
  }
  function paint(){
    if (!sheet) return;
    const body = sheet.querySelector('.sdl-body'), top = body.scrollTop;
    sheet.querySelector('[data-pane="set"]').innerHTML = setPane();
    sheet.querySelector('[data-pane="face"]').innerHTML = facePane();
    sheet.querySelector('[data-pane="arrival"]').innerHTML = arrivalPane();
    body.scrollTop = top;
    fillTiles();
  }
  const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
  function build(){
    key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet cfl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Coach face lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="set" class="is-on">THE SET</button><button type="button" data-tab="face">THE FACE</button><button type="button" data-tab="arrival">ARRIVAL</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body"><section data-pane="set"></section><section data-pane="face" hidden></section><section data-pane="arrival" hidden></section></div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        sheet.querySelector('.sdl-body').scrollTop = 0;
        return;
      }
      const act = t.dataset.act;
      if (act === 'on' || act === 'off'){ open(false); await CS.power(act === 'on'); save(); return; }
      if (act === 'deal'){ save(); if (host) host.play(); else location.reload(); return; }
      if (act === 'reset'){ order = Object.assign({}, CS.DEFAULTS); applyOrder(); return; }
      if (act === 'copy'){ copyPicks(t); return; }
      const holder = t.closest('[data-key]');
      if (!holder) return;
      const k = holder.dataset.key, v = t.dataset.v;
      if (k === 'look'){ open(false); CS.look(v, v === 'ahead' ? 0 : 2200); return; }
      if (k === 'deckside'){
        const b = document.querySelector('#deck-side-seg button[data-v="' + v + '"]');
        if (b) b.click(); else if (typeof settings !== 'undefined'){ settings.deckSide = v; }
        setTimeout(paint, 80);
        return;
      }
      order[k] = v;
      if (k === 'mood'){ CS.setMood(v); save(); paint(); return; }
      applyOrder();
    });
    paint();
  }
  function copyPicks(t){
    const name = (k, v) => { const r = (CS.OPTIONS[k] || []).find(x => x[0] === v); return r ? r[1] : v; };
    const text = 'COACH SET: ' + ['set', 'finish', 'glasses', 'ink', 'from', 'weight', 'jolt', 'dust', 'boot', 'cable'].map(k => k + ' ' + name(k, order[k])).join(' · ');
    const ta = sheet.querySelector('.sdl-copytext');
    const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
    try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(e){ done(false); }
  }

  /* ---- start: a fresh table, sitting on your first decision ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    CS.apply(order);
    build();
    document.addEventListener('click', e => { if (e.target.closest('#coach-station')) CS.talk(1600); });
    document.addEventListener('click', e => { if (e.target.closest('#coach-key')) setTimeout(save, 50); });
    try{ startSinglePlayerRun({ opponentCount:4 }); }catch(err){ console.error(err); }
    // he comes on by himself once the table's dealt (the owner can switch him off)
    setTimeout(() => { if (wasOn || state.on == null) CS.power(true).then(save); }, 2600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
