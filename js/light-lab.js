"use strict";

/* ============================================================
   LIGHT LAB — the controls, inside the game (Stage 1 of
   docs/NEXT_LEVEL_PLAN.md). Lab only: never loaded by the game.

   Runs in the game copy light-lab.html builds. A Quick Deal table starts
   at once and plays for real under the Light Stage (js/light-stage.js).
   The TUNE key opens a bottom sheet (the Showdown Lab's sheet, shared):
   MOMENTS fires the lights' events, TUNE has every option (each row's
   first option is the suggestion), and ABOUT says what this is and how
   fast it runs. The LIGHTS key next to TUNE flips between the lit Stage
   and today's table. Picks go to the host, so a new table keeps them.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { picks:null };

  const GROUPS = [
    { title:'THE LAMP', sub:'The light hanging over the table. Drag it around with TOUCH: MOVE THE LAMP below.', rows:[
      ['swing','SWING', [['gentle','GENTLE'],['still','STILL'],['wild','WILD']]],
      ['flicker','FLICKER', [['rare','NOW AND THEN'],['off','NEVER'],['nervous','NERVOUS']]],
      ['height','HEIGHT', [['mid','MIDDLE'],['low','LOW + MOODY'],['high','HIGH + EVEN']]],
      ['colour','COLOUR', [['warm','WARM BULB'],['sodium','SODIUM'],['cool','COOL CASINO'],['neon','NEON']]]
    ]},
    { title:'THE TABLE', sub:'The felt and rail are drawn on the Stage, with real bumps for the light to catch.', rows:[
      ['rail','RAIL', [['game','YOUR SKIN\'S RAIL'],['velvet','BURGUNDY VELVET']]],
      ['weave','WEAVE', [['fine','FINE'],['coarse','COARSE'],['flat','FLAT']]],
      ['print','PRINTED LINE', [['gold','GOLD'],['none','NONE']], 'A gold betting line printed on the felt. Shiny ink catches the lamp.']
    ]},
    { title:'LIGHT AND SHADOW', rows:[
      ['seats','SEAT LIGHTS', [['on','ON'],['off','OFF']], 'A light under each seat in that player\'s colour.'],
      ['shadows','SHADOWS', [['on','FROM THE LAMP'],['long','LONG'],['off','OFF']], 'Seats, cards, the pot and the deck cast shadows away from the lamp, so they move as it swings.'],
      ['domlight','LIGHT THE PIECES', [['on','ON'],['off','OFF']], 'The seat cards, pot and cards pick up the same light, with a lit edge facing the lamp.'],
      ['steps','LIGHT BANDS', [['5','FIVE'],['3','THREE'],['8','EIGHT'],['smooth','SMOOTH']], 'Light falls off in steps, like pixel art, not a smooth airbrush.'],
      ['dither','DITHER', [['on','ON'],['off','OFF']], 'A fine checker where two bands meet.'],
      ['pixels','PIXEL SIZE', [['3','3'],['2','2 (FINER)'],['4','4 (CHUNKIER)']], 'How many screen points each Stage pixel covers.']
    ]},
    { title:'LOOK AND TEST', rows:[
      ['show','SHOW', [['game','THE GAME'],['showcase','+ SHOWCASE']], 'SHOWCASE adds a face, a chip stack and two cards drawn on the Stage with real normal maps: what everything would look like once it moves onto the Stage.'],
      ['touch','TOUCH', [['play','PLAY THE GAME'],['lamp','MOVE THE LAMP']], 'MOVE THE LAMP: drag on the table to hold the lamp; let go and it swings from there.'],
      ['fps','FRAME RATE', [['60','60'],['30','30 (SAVES BATTERY)']]]
    ]}
  ];
  const ROWS = GROUPS.flatMap(g => g.rows);
  const SUGGESTED = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  const picks = Object.assign({}, SUGGESTED, { stage:'on' }, state.picks || {});
  const save = () => { if (host) host.set({ picks:Object.assign({}, picks) }); };

  const MOMENTS = [
    ['allin','ALL IN', 'Red light pulses up from your side; the lamp dips.'],
    ['bighand','BIG HAND', 'A gold flare off the board and a lamp surge.'],
    ['spot','SPOTLIGHT', 'A light drops onto one player.'],
    ['powercut','POWER CUT', 'The lamp stutters out and buzzes back.'],
    ['blackout','BLACKOUT', 'Only the lamp, tight and hard. Tap again to bring the room back.'],
    ['centre','CENTRE THE LAMP', 'Put the lamp back over the middle.']
  ];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], picks[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';

  let sheet = null, lightsKey = null, fpsEl = null;
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    lightsKey = document.createElement('button');
    lightsKey.type = 'button'; lightsKey.className = 'sdl-key sdl-again-key ll-lights-key';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Light lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="tune">TUNE</button><button type="button" data-tab="about">ABOUT</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="moments"><p class="sdl-sub">The table is a real game: play it with the keys as usual. These fire the lights\' moments on top.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
          '<ul class="ll-notes">' + MOMENTS.map(m => '<li><b>' + m[1] + '</b> ' + m[2] + '</li>').join('') + '</ul>' +
          '<button type="button" class="sdl-again" data-act="newtable">DEAL A NEW TABLE</button></section>' +
        '<section data-pane="tune" hidden>' + GROUPS.map(g => '<h3>' + g.title + (g.sub ? '<small>' + g.sub + '</small>' : '') + '</h3>' + g.rows.map(row).join('')).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="about" hidden><h3>THE LIGHT LAB<small>Stage 1 of the next-level plan.</small></h3>' +
          '<p class="sdl-sub">The felt and rail are drawn by the phone\'s graphics chip at a low resolution, so pixels stay square, and lit by real lights that move: the lamp, a light under each seat, and the moments\' lights. Surfaces have bumps (the weave, the rail\'s cushion) so light rakes across them, and everything standing on the felt casts a shadow away from the lamp.</p>' +
          '<p class="sdl-sub">The seat cards, cards and pot are still today\'s pieces with light laid over them. SHOWCASE (in TUNE) shows pieces drawn properly on the Stage with normal maps: that is where this goes next if you like it.</p>' +
          '<h3>HOW IT RUNS</h3><p class="sdl-sub ll-fps">…</p>' +
          '<p class="sdl-sub">Tell me: does it feel like a game now? Too dark, too busy, too slow on your phone? Does the phone get warm after a few minutes?</p></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(lightsKey); document.body.appendChild(sheet);
    fpsEl = sheet.querySelector('.ll-fps');
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    lightsKey.addEventListener('click', () => { picks.stage = picks.stage === 'on' ? 'off' : 'on'; apply(); });
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.moment){
        const m = t.dataset.moment;
        if (m === 'centre'){ LightStage.centreLamp(); return; }
        if (picks.stage !== 'on'){ picks.stage = 'on'; apply(); }
        const on = LightStage.flash(m);
        if (m === 'blackout') t.classList.toggle('is-on', on);
        open(false);
        return;
      }
      if (t.dataset.act === 'newtable'){ open(false); if (host) host.reload(); else deal(); return; }
      if (t.dataset.act === 'reset'){ ROWS.forEach(r => { picks[r[0]] = SUGGESTED[r[0]]; }); apply(); paint(); return; }
      if (t.dataset.act === 'copy'){
        const out = sheet.querySelector('.sdl-copytext');
        out.hidden = false;
        out.value = 'LIGHT LAB PICKS\n' + ROWS.map(r => r[1] + ': ' + (r[2].find(o => o[0] === picks[r[0]]) || r[2][0])[1]).join('\n');
        out.select(); try{ document.execCommand('copy'); }catch(err){}
        return;
      }
      const s = t.closest('.sdl-seg');
      if (s){ picks[s.dataset.key] = t.dataset.v; apply(); paint(); }
    });
    setInterval(() => {
      if (!sheet.classList.contains('is-open')) return;
      const s = LightStage.stats;
      fpsEl.textContent = picks.stage === 'on' ? s.fps + ' frames a second (' + s.ms.toFixed(1) + ' ms each). Above 50 is smooth.' : 'Lights are off.';
    }, 500);
  }
  function paint(){
    sheet.querySelectorAll('.sdl-seg').forEach(s => s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === picks[s.dataset.key])));
    lightsKey.textContent = picks.stage === 'on' ? 'LIGHTS ON' : 'LIGHTS OFF';
    lightsKey.classList.toggle('is-off', picks.stage !== 'on');
  }
  function apply(){ LightStage.set(picks); save(); if (sheet) paint(); }

  function deal(){ startSinglePlayerRun({ opponentCount:4 }); }
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}   // it has its own lab
    build();
    if (!LightStage.mount()){
      sheet.querySelector('[data-pane="moments"]').insertAdjacentHTML('afterbegin', '<p class="sdl-sub">This phone or browser has no WebGL, so the lit Stage can\'t run here. The game falls back to today\'s look.</p>');
    }
    apply();
    deal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
