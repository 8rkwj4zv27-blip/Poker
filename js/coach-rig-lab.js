"use strict";

/* ============================================================
   COACH RIG LAB — the controls, inside the game (round 1, phone-first)

   The coach's lead and his boot, on the look the owner locked in the
   Coach Face Lab (CUBE, DASHBOARD, CLEAN lines, from under the table, the
   turn paired at random). The candidate is js/coach-set.js +
   css/coach-set.css: every row below is one of its options.

   On the table: the COACH key (next to ⚙) switches him on and off. TUNE
   opens the sheet:
     THE LEAD   style, colour, length, where it leaves the set, the jump
                on the landing, 14 a second or smooth
     THE PLUG   plug, jack, how it goes in and comes out, a spark
     THE BOOT   power up the lead, the tube, what it says, how he wakes,
                the lamp, length, sound
     SWITCH-OFF how the tube goes off; deck side; copy picks; deal again
   Every tab starts with the same four keys: SWITCH ON, SWITCH OFF,
   REPLUG (the lead out and back in, with the boot) and REBOOT (the tube
   only). Picks go to the set at once and to the host (they survive DEAL
   AGAIN); COPY MY PICKS copies them all as one line.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null };
  const CS = CoachSet;
  const RIG = {
    lead:{ tab:'lead', name:'THE LEAD', note:'THICK: two pixels of rubber. COILED: a telephone-cord curl. BRAIDED: two tones twisted.' },
    leadCol:{ tab:'lead', name:'COLOUR', note:'DASHBOARD: the console\'s own case colour.' },
    length:{ tab:'lead', name:'LENGTH' },
    exit:{ tab:'lead', name:'WHERE IT LEAVES THE SET' },
    leadJolt:{ tab:'lead', name:'ON THE THUD', note:'The lead jumps when he lands and settles back.' },
    leadStep:{ tab:'lead', name:'HOW IT MOVES', note:'14 A SECOND: stepped like the chips and cards. SMOOTH: every frame.' },
    plug:{ tab:'plug', name:'THE PLUG' },
    jack:{ tab:'plug', name:'THE JACK', note:'On the dashboard\'s top edge. The lamp lights once he\'s booted.' },
    plugIn:{ tab:'plug', name:'GOING IN', note:'LIFTED IN: arcs over. SLID ALONG: dragged along the dashboard\'s edge and dropped in. SNAPS IN: one quick step.' },
    unplug:{ tab:'plug', name:'COMING OUT', note:'YANKED: flicks up and falls back. SLID OUT: drawn out along the edge.' },
    spark:{ tab:'plug', name:'SPARK', note:'A little crackle of pixels as it goes in.' },
    power:{ tab:'boot', name:'POWER UP THE LEAD', note:'LEAD LIGHTS UP: the lead fills with light from the jack to the set. ONE PULSE: a single pixel runs up it.' },
    tube:{ tab:'boot', name:'THE TUBE', note:'TYPES A LINE: the words below, typed. SYSTEM CHECK: SYS OK, MEM OK, CAM OK, then the words. SCANS DOWN: a bar draws his face. FLICKERS ON: on, off, on.' },
    says:{ tab:'boot', name:'WHAT IT SAYS', note:'For TYPES A LINE and SYSTEM CHECK.' },
    wake:{ tab:'boot', name:'HOW HE WAKES' },
    led:{ tab:'boot', name:'THE LAMP WHILE BOOTING', note:'On the front of the set, and the jack\'s lamp once he\'s up.' },
    bootLen:{ tab:'boot', name:'LENGTH', note:'QUICK is for switching him on in the middle of a hand.' },
    coachSound:{ tab:'boot', name:'HIS SOUNDS', note:'Thud, clack, relay, tube, ticks.' },
    shutdown:{ tab:'off', name:'SWITCHING OFF', note:'Then the lead goes dark, the plug comes out and he\'s swiped off.' }
  };
  const KEYS = Object.keys(RIG);
  let order = Object.assign({}, CS.DEFAULTS, state.order && state.order.lead ? state.order : {});
  const wasOn = state.on;

  function save(){ if (host) host.set({ order:Object.assign({}, order), on:CS.on }); }
  function applyOrder(){ CS.apply(order); save(); paint(); }

  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = k => '<div class="sdl-row"><div class="sdl-name">' + RIG[k].name + '</div>' + seg(k, CS.OPTIONS[k], order[k]) + (RIG[k].note ? '<p class="sdl-note">' + RIG[k].note + '</p>' : '') + '</div>';
  const actions = '<div class="crl-acts"><button type="button" data-act="on">SWITCH ON</button><button type="button" data-act="off">SWITCH OFF</button>' +
    '<button type="button" data-act="replug">REPLUG</button><button type="button" data-act="reboot">REBOOT</button></div>';
  const TABS = [
    ['lead', 'THE LEAD', 'The aux lead from the set to the jack on the dashboard. The first of each is my suggestion.'],
    ['plug', 'THE PLUG', 'REPLUG takes it out and puts it back, so you can watch both.'],
    ['boot', 'THE BOOT', 'REBOOT runs the tube off and on again without moving him.'],
    ['off', 'SWITCH-OFF', 'SWITCH OFF shows it; the COACH key next to ⚙ does the same.']
  ];
  function pane(tab){
    const t = TABS.find(x => x[0] === tab);
    let html = actions + '<h3>' + t[1] + '<small>' + t[2] + '</small></h3>' + KEYS.filter(k => RIG[k].tab === tab).map(row).join('');
    if (tab === 'off'){
      html += '<div class="sdl-row"><div class="sdl-name">DECK SIDE</div>' + seg('deckside', [['left', 'DECK LEFT'], ['right', 'DECK RIGHT']], (typeof settings !== 'undefined' && settings.deckSide === 'right') ? 'right' : 'left') +
        '<p class="sdl-note">The game\'s own setting (⚙ → The deck). He and his jack sit on the other side.</p></div>' +
        '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
        '<button type="button" class="sdl-again" data-act="deal">DEAL AGAIN</button>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>';
    }
    return html;
  }

  let sheet, key;
  function paint(){
    if (!sheet) return;
    const body = sheet.querySelector('.sdl-body'), top = body.scrollTop;
    TABS.forEach(t => { sheet.querySelector('[data-pane="' + t[0] + '"]').innerHTML = pane(t[0]); });
    body.scrollTop = top;
  }
  const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
  function build(){
    key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet crl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Coach rig lab');
    sheet.innerHTML = '<div class="sdl-tabs" role="tablist">' + TABS.map((t, i) => '<button type="button" data-tab="' + t[0] + '"' + (i ? '' : ' class="is-on"') + '>' + t[1] + '</button>').join('') +
      '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' + TABS.map((t, i) => '<section data-pane="' + t[0] + '"' + (i ? ' hidden' : '') + '></section>').join('') + '</div>';
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
      if (act === 'replug' || act === 'reboot'){
        open(false);
        if (!CS.on) await CS.power(true);
        await (act === 'replug' ? CS.replug() : CS.reboot());
        return;
      }
      if (act === 'deal'){ save(); if (host) host.play(); else location.reload(); return; }
      if (act === 'reset'){ order = Object.assign({}, CS.DEFAULTS); applyOrder(); return; }
      if (act === 'copy'){ copyPicks(t); return; }
      const holder = t.closest('[data-key]');
      if (!holder) return;
      const k = holder.dataset.key, v = t.dataset.v;
      if (k === 'deckside'){
        const b = document.querySelector('#deck-side-seg button[data-v="' + v + '"]');
        if (b) b.click(); else if (typeof settings !== 'undefined'){ settings.deckSide = v; }
        setTimeout(paint, 80);
        return;
      }
      order[k] = v;
      applyOrder();
    });
    paint();
  }
  function copyPicks(t){
    const name = (k, v) => { const r = (CS.OPTIONS[k] || []).find(x => x[0] === v); return r ? r[1] : v; };
    const text = 'COACH RIG: ' + KEYS.map(k => RIG[k].name.toLowerCase() + ' ' + name(k, order[k])).join(' · ');
    const ta = sheet.querySelector('.sdl-copytext');
    const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
    try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(e){ done(false); }
  }

  /* ---- start: a fresh table; he comes on once it's dealt ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    CS.apply(order);
    build();
    document.addEventListener('click', e => { if (e.target.closest('#coach-station')) CS.talk(1600); });
    document.addEventListener('click', e => { if (e.target.closest('#coach-key')) setTimeout(save, 50); });
    try{ startSinglePlayerRun({ opponentCount:4 }); }catch(err){ console.error(err); }
    setTimeout(() => { if (wasOn || wasOn == null) CS.power(true).then(save); }, 2600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
