"use strict";

/* ============================================================
   BANK LOAD LAB — the controls, inside the game (round 1, phone-first)

   Runs in the game copy the host page (bank-load-lab.html,
   js/bank-load-lab-host.js) builds, with the candidate js/bank-load.js.
   A small TUNE key opens a bottom sheet: LOAD (which entrance, sit down
   at a table again, the stack, the shelves), A · COUNT IN and C · TRAY IN
   (each one's dials). AGAIN replays the bank load on the table that's up.
   Picks reach the candidate at once and the host, so they survive the
   reload a fresh sit-down starts with. The sheet's look is the Showdown
   Lab's (css/showdown-lab.css).
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, stack:'1000', sound:'on', moment:null };
  const O = BANK_LOAD_OPT;
  if (state.order) Object.assign(O, state.order);

  // Every row's first option is my suggestion.
  const BOTH = [
    ['style','WHICH ENTRANCE', [['count','A · COUNT IN'],['tray','C · TRAY IN']]],
    ['shelves','SHELVES', [['on','ON'],['off','OFF']], 'The back rows of the rack stand on steps, so they don\'t look like they float over the front ones.']
  ];
  const A = [
    ['entry','WHERE THEY COME IN', [['slot','THROUGH THE SLOT'],['drop','STRAIGHT DOWN']], 'The slot: out of the middle of the top edge and over to their stack. Straight down: each falls in right above its stack.'],
    ['unit','HOW', [['stack','WHOLE STACKS'],['chip','CHIP BY CHIP']]],
    ['order','ORDER', [['back','BACK ROW FIRST'],['middle','MIDDLE OUT']]],
    ['countMs','TIME', [['1200','1.2 S'],['900','0.9 S'],['1600','1.6 S']]],
    ['readout','STACK READOUT', [['count','COUNTS UP'],['once','ALL AT ONCE']], 'COUNTS UP: the figure climbs with each stack that lands.']
  ];
  const C = [
    ['from','FROM', [['below','BELOW'],['above','ABOVE']]],
    ['motion','MOTION', [['stepped','STEPPED + HARD STOP'],['smooth','SMOOTH + BOUNCE']]],
    ['trayMs','TIME', [['600','0.6 S'],['450','0.45 S'],['900','0.9 S']]]
  ];
  const ROWS = BOTH.concat(A, C);
  const STACKS = [['1000','$1,000'],['200','$200'],['5000','$5,000'],['25000','$25,000']];

  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], O[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  function save(){ if (host) host.set({ order:Object.fromEntries(ROWS.map(r => [r[0], O[r[0]]])) }); }

  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    const again = document.createElement('button');
    again.type = 'button'; again.className = 'sdl-key sdl-again-key'; again.textContent = 'AGAIN';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Bank load lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="load" class="is-on">LOAD</button><button type="button" data-tab="a">A · COUNT IN</button><button type="button" data-tab="c">C · TRAY IN</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="load"><p class="sdl-sub">AGAIN (top left) loads the bank again on this table. SIT DOWN plays the whole table entrance from the start.</p>' +
          BOTH.slice(0, 1).map(row).join('') +
          '<div class="sdl-moments" style="margin-top:10px">' +
            '<button type="button" class="is-wide" data-go="again">LOAD THE BANK AGAIN</button>' +
            '<button type="button" data-go="quick">SIT DOWN · QUICK DEAL</button><button type="button" data-go="single">SIT DOWN · A RUN</button></div>' +
          '<h3>YOUR STACK<small>For the next load.</small></h3>' +
          '<div class="sdl-row">' + seg('stack', STACKS, state.stack) + '</div>' +
          BOTH.slice(1).map(row).join('') +
          '<div class="sdl-row"><div class="sdl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="a" hidden><h3>A · COUNT IN<small>The hatch opens and the chips come in stack by stack, the readout counting up.</small></h3>' + A.map(row).join('') +
          '<button type="button" class="sdl-again" data-go="again">LOAD AGAIN</button></section>' +
        '<section data-pane="c" hidden><h3>C · TRAY IN<small>The whole rack slides into the box on its tray and locks with a clunk.</small></h3>' + C.map(row).join('') +
          '<button type="button" class="sdl-again" data-go="again">LOAD AGAIN</button></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(again); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    again.addEventListener('click', () => { open(false); loadAgain(); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.go){
        open(false);
        const g = t.dataset.go;
        if (g === 'again'){ loadAgain(); return; }
        if (host) host.play(g); else sitDown(g);
        return;
      }
      const s = t.closest('.sdl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        if (k === 'stack' || k === 'sound'){
          state[k] = v; if (host) host.set({ [k]:v });
          if (k === 'sound') try{ settings.sound = v === 'on'; CoinTable.sync(); }catch(err){}
        } else { O[k] = v; save(); if (k === 'shelves') BankLoad.paintShelves(); }
        // the entrance picked here and on its own tab stay in step
        sheet.querySelectorAll('.sdl-seg[data-key="' + k + '"] button').forEach(b => b.classList.toggle('is-on', b.dataset.v === v));
        return;
      }
      if (t.dataset.act === 'reset'){
        ROWS.forEach(r => { O[r[0]] = r[2][0][0]; }); save();
        sheet.querySelectorAll('.sdl-seg').forEach(s2 => { const k = s2.dataset.key; if (k === 'stack' || k === 'sound') return; s2.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === O[k])); });
        BankLoad.paintShelves();
        return;
      }
      if (t.dataset.act === 'copy'){
        const text = 'Bank load (round 1):\n' + ROWS.filter(r => !(O.style === 'count' ? C : A).includes(r))
          .map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === O[r[0]]) || ['', O[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('.sdl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }

  // the lab's stack: your chips for the next load (a lab copy, never a save)
  BankLoad.beforeLoad = h => { const v = +state.stack; if (v > 0 && h.chips !== v){ h.chips = v; try{ render(); }catch(e){} } };

  let busy = false;
  async function loadAgain(){
    if (busy || !game) return;
    busy = true;
    try{
      openHatch(); Sound.hatchOpen();
      await new Promise(r => setTimeout(r, 150));
      await BankLoad.play();
      closeHatch(); Sound.hatchClose();
    }catch(err){ console.error(err); }
    finally{ busy = false; }
  }
  function sitDown(kind){
    if (kind === 'single') startSinglePlayerRun({ opponentCount:3 });
    else { const q = document.getElementById('quick-play'); if (q) q.click(); else startGame(); }
  }
  window.__bllLab = { loadAgain, sitDown, opt:O };

  function start(){
    try{ settings.sound = state.sound !== 'off'; settings.seenTour = true; }catch(e){}   // the first-turn tour would sit over the bank
    build();
    const m = state.moment;
    if (host) host.set({ moment:null });
    sitDown(m || 'quick');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
