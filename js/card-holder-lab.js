"use strict";

/* ============================================================
   CARD HOLDER LAB — the controls, inside the game (phone-first)

   Runs in the game copy card-holder-lab.html builds (the host is the
   shared js/showdown-lab-host.js). A TUNE key opens a bottom sheet
   (css/showdown-lab.css's sheet, css/card-holder-lab.css's looks):
   LOOKS (whole combinations to flip between) and TUNE (every part on its
   own). Everything applies at once, on the hand that's dealt.

   The holder is two pseudo-elements on .seat.you: ::before the dark slot
   behind the cards, ::after the front lip. This page measures the seat
   (where the lip ends, where the screen starts, how much card hides
   behind the lip) and writes the vars css/card-holder-lab.css uses, so
   the GAP is the real air between the lip and the screen on any phone.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const root = document.documentElement;

  const ROWS = [
    ['lip','THE LIP', [['moulded','A · MOULDED'],['brass','B · BRASS'],['stepped','E · STEPPED'],['current','TODAY']],
      'A: a lit top edge, a flat face, a dark underside. B: the instrument gold with a screw at each end. E: a shallow stepped front, wider at the foot.'],
    ['seat','SEAT SHADOW (C)', [['on','ON'],['off','OFF']], 'A soft shade rises up the card faces from the groove, and the slot behind gets deeper.'],
    ['width','WIDTH (D)', [['current','TODAY'],['snug','SNUG'],['wide','WIDE']], 'Snug hugs the two cards. Wide runs almost the full centre bay.'],
    ['gap','GAP TO THE SCREEN', [['0','0'],['4','4'],['6','6'],['8','8'],['10','10'],['12','12']], 'Pixels of air between the lip and the hand-name screen. On a big iPhone today it\'s 0: the lip sits right on the screen\'s edge. If there\'s already that much air, nothing moves.'],
    ['room','MAKE ROOM BY', [['up','HOLDER RISES'],['down','SCREENS DROP']], 'Rises: the lip and cards move up the dashboard, the screens stay put. Drop: the screens below move down instead.'],
    ['hang','CARD OVERHANG', [['-3','LOWER'],['0','TODAY'],['3','HIGHER'],['6','HIGHEST']], 'How far the cards stand up out of the holder, on top of the gap.'],
    ['theme','TABLE', [['burgundy','BURGUNDY'],['emerald','EMERALD'],['midnight','MIDNIGHT'],['slate','SLATE']]]
  ];
  const LOOKS = [
    ['yours','YOUR PICK · BRASS + C · 10PX', { lip:'brass', seat:'on', width:'current', gap:'10', room:'up', hang:'0' }],
    ['mine','A · MOULDED + C · 8PX', { lip:'moulded', seat:'on', width:'current', gap:'8', room:'up', hang:'0' }],
    ['stepped','E · STEPPED + C', { lip:'stepped', seat:'on', width:'current', gap:'8', room:'up', hang:'0' }],
    ['snug','A · SNUG · NO SHADOW', { lip:'moulded', seat:'off', width:'snug', gap:'8', room:'up', hang:'0' }],
    ['wide','B · WIDE TRAY', { lip:'brass', seat:'on', width:'wide', gap:'8', room:'up', hang:'0' }],
    ['today','TODAY (AS SHIPPED)', { lip:'current', seat:'off', width:'current', gap:'0', room:'up', hang:'0' }]
  ];
  const DEFAULT = Object.assign({ theme:'burgundy' }, LOOKS[0][2]);
  const pick = Object.assign({}, DEFAULT, (host && host.state.holder) || {});

  /* ---- geometry ---- */
  const px = v => parseFloat(v) || 0;
  function measure(){
    const seat = document.querySelector('#hud-mid .seat.you');
    const screen = document.getElementById('hand-strength');
    if (!seat || !screen) return;
    // measure with the lab's own offsets off
    seat.style.setProperty('--ch-lift', '0'); seat.style.setProperty('--ch-hang', '0');
    const prev = seat.style.transition; seat.style.transition = 'none';
    const sr = seat.getBoundingClientRect(), hs = screen.getBoundingClientRect();
    const card = seat.querySelector('.card'), cards = seat.querySelector('.seat-cards');
    const lip = getComputedStyle(seat, '::after');
    const lipH = lip.boxSizing === 'border-box' ? px(lip.height) : px(lip.height) + px(lip.borderTopWidth) + px(lip.borderBottomWidth);
    const lipTop = px(lip.top), lipBottom = lipTop + lipH;
    const air = (hs.top - sr.top) - lipBottom;               // today's gap (can be negative)
    const lift = Math.max(0, Number(pick.gap) - air);
    const mid = document.getElementById('hud-mid').getBoundingClientRect().width;
    let w = null;
    if (pick.width === 'snug' && cards) w = Math.round(cards.getBoundingClientRect().width + 10);
    if (pick.width === 'wide') w = Math.round(mid + 4);
    if (w) root.style.setProperty('--ch-w', w + 'px');
    if (card) root.style.setProperty('--ch-bury', Math.max(0, Math.round(card.getBoundingClientRect().bottom - sr.top - lipTop)));
    seat.style.setProperty('--ch-lift', String(lift));
    seat.style.setProperty('--ch-hang', String(Number(pick.hang) || 0));
    void seat.offsetHeight; seat.style.transition = prev;
    state.readout = 'Lip ' + Math.round(lipH) + 'px tall, ' + Math.round(w || px(lip.width) + (lip.boxSizing === 'border-box' ? 0 : 4)) + 'px wide. Air before the rise: ' + Math.round(air) + 'px; the holder ' + (pick.room === 'up' ? 'rises ' : 'pushes the screens down ') + Math.round(lift) + 'px.';
    const r = document.querySelector('.chl-readout'); if (r) r.textContent = state.readout;
  }
  const state = { readout:'' };

  function apply(){
    ['lip','seat','width','room'].forEach(k => root.setAttribute('data-ch-' + k, pick[k]));
    try{ settings.theme = pick.theme; }catch(e){}
    document.body.setAttribute('data-theme', pick.theme);
    if (host) host.set({ holder:Object.assign({}, pick) });
    requestAnimationFrame(measure);
    paint();
  }

  /* ---- the key and the sheet ---- */
  const seg = (key, opts) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === pick[key] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  function paint(){
    document.querySelectorAll('.chl-sheet .sdl-seg').forEach(s => {
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === pick[s.dataset.key]));
    });
    document.querySelectorAll('.chl-look button').forEach(b => {
      const look = LOOKS.find(l => l[0] === b.dataset.look)[2];
      b.classList.toggle('is-mine', Object.keys(look).every(k => look[k] === pick[k]));
    });
  }
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    const deal = document.createElement('button');
    deal.type = 'button'; deal.className = 'sdl-key sdl-again-key'; deal.textContent = 'DEAL';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet chl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Card holder lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="looks" class="is-on">LOOKS</button><button type="button" data-tab="tune">TUNE</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="looks"><p class="sdl-sub">Whole combinations. Tap one and watch the holder below. DEAL (next to TUNE) gives you fresh cards.</p>' +
          '<div class="chl-look">' + LOOKS.map(l => '<button type="button" data-look="' + l[0] + '">' + l[1] + '</button>').join('') + '</div>' +
          '<p class="chl-readout"></p></section>' +
        '<section data-pane="tune" hidden>' + ROWS.map(row).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
      '</div>';
    document.body.append(key, deal, sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); root.classList.toggle('chl-open', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    deal.addEventListener('click', () => { open(false); newHand(); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.look){ Object.assign(pick, LOOKS.find(l => l[0] === t.dataset.look)[2]); apply(); return; }
      const s = t.closest('.sdl-seg');
      if (s){ pick[s.dataset.key] = t.dataset.v; apply(); return; }
      if (t.dataset.act === 'reset'){ Object.assign(pick, DEFAULT); apply(); return; }
      if (t.dataset.act === 'copy'){
        const text = 'Card holder:\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === pick[r[0]]) || ['', pick[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('.sdl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }

  /* ---- a fresh hand, left standing at your turn ---- */
  function newHand(){
    try{ startSinglePlayerRun({ opponentCount:3 }); }catch(e){ console.error(e); }
    // the seat re-renders as the cards land; measure again once they're down
    [300, 1200, 2600, 4200].forEach(ms => setTimeout(measure, ms));
  }

  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = false; }catch(e){}
    build();
    apply();
    newHand();
    addEventListener('resize', () => requestAnimationFrame(measure));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
