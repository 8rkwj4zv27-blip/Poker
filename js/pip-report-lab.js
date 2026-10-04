"use strict";

/* ============================================================
   P.I.P. REPORT LAB — the controls, inside the game (phone-first)

   Runs in the game copy pip-report-lab.html builds. Deals one real table
   with P.I.P. switched on, holds it still (the opponents never act), and
   puts each example hand's cards on it (js/pip-report-hands.js) as if the
   hand had just been paid: the console shows REPORT and DEAL, and P.I.P.'s
   lamp blinks when he has a report.
   - REPORT, or a tap on P.I.P., opens the report (js/coach-report.js).
   - DEAL closes it and puts the next example hand on the table.
   - TUNE (top left) opens the sheet: HANDS (pick one), THE LOOK (every
     option, first of each is my suggestion), THE GRADE (how it's worked
     out). Picks go to the report at once and survive a reload.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { opts:null, hand:0, sound:'off' };
  const $id = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }
  const HANDS = window.PIP_REPORT_HANDS || [];
  let opts = Object.assign({}, CoachReport.DEFAULTS, state.opts || {});
  let idx = Math.max(0, Math.min(HANDS.length - 1, state.hand || 0));
  let current = null;   // the staged hand, names filled in
  const save = () => { if (host) host.set({ opts:Object.assign({}, opts), hand:idx }); };

  /* ---- the sheet ---- */
  const LOOK = [
    ['arrive', 'HOW IT ARRIVES', 'SWITCHES ON: a line of light that opens into the screen. RISES UP: it comes up from behind the dashboard.'],
    ['pace', 'PACE', 'PLAYS THROUGH: the streets light up one by one, the grade lands last, then he talks (tap to skip). A STREET A TAP: you step through with NEXT.'],
    ['chance', 'YOUR CHANCE', 'BAR + TRUTH TICK: the bar is what you could know at the time; the little blue mark is where you really stood once their cards were shown. TWO LINES draws both across the hand.'],
    ['grade', 'THE GRADE', ''],
    ['face', 'P.I.P. ON THE SCREEN', 'His face in the corner, talking as he types.'],
    ['ink', 'INK', 'Ticks, crosses and the grade in colour, or everything in his one screen colour.'],
    ['numbers', 'NUMBERS', 'He only shows percentages once a lesson has taught them. See both: words now, numbers later.']
  ];
  const seg = (key, list, cur) => '<div class="prl-seg" data-key="' + key + '">' + list.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const GRADE_HELP =
    '<h3>A TO F, FOR HOW YOU PLAYED<small>Never for how it turned out. A lucky river can\'t lift it; a bad beat can\'t sink it. The result sits next to it.</small></h3>' +
    '<table class="prl-table"><tr><th>A</th><td>Every decision right, and something in the hand mattered (a bet, a call, a fold after the flop, a big all in).</td></tr>' +
    '<tr><th>B</th><td>Solid. Right or reasonable throughout, maybe a close call. Also a hand that asked little of you.</td></tr>' +
    '<tr><th>C</th><td>A small mistake, or one P.I.P. is only fairly sure of.</td></tr>' +
    '<tr><th>D</th><td>A clear mistake with real chips at stake.</td></tr>' +
    '<tr><th>F</th><td>A clear mistake that put half your stack or more at risk, or several clear mistakes.</td></tr></table>' +
    '<h3>HOW IT\'S WORKED OUT<small>P.I.P. already marks every decision: good, fine or a mistake, and how sure he is.</small></h3>' +
    '<ul class="prl-list"><li>A clear mistake counts 3.5, one he leans to 2, a close one 0.5. A close call that was fine counts 0.25.</li>' +
    '<li>Bigger pots count more (x1.5 at 25 big blinds or half your stack), small pots less (x0.6), so a sloppy call for a few chips can\'t sink a hand you played well for many.</li>' +
    '<li>A notably good play (a well-timed bluff, the right all in) wins 0.5 back.</li>' +
    '<li>Up to 0.1 is an A, up to 1 a B, up to 3 a C, up to 5.5 a D, more an F.</li></ul>' +
    '<h3>THE EXAMPLE HANDS<small>' + HANDS.map(h => h.title.toLowerCase().replace(/^./, c => c.toUpperCase())).join(' · ') + '</small></h3>' +
    '<p class="prl-sub">P.I.P.\'s marks and words in these are written by hand to match what his brain says. The blue truth is worked out from the real cards by the report itself.</p>';
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'prl-key'; key.id = 'prl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'prl-sheet'; sheet.id = 'prl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'P.I.P. report lab');
    sheet.innerHTML =
      '<div class="prl-tabs" role="tablist"><button type="button" data-tab="hands" class="is-on">HANDS</button><button type="button" data-tab="look">THE LOOK</button><button type="button" data-tab="grade">THE GRADE</button>' +
        '<button type="button" class="prl-close" aria-label="Close">✕</button></div>' +
      '<div class="prl-body">' +
        '<section data-pane="hands"><p class="prl-sub">Each one is put on the table as if it had just been paid. Then tap REPORT on the console, or tap P.I.P. DEAL moves on to the next one.</p>' +
          '<div class="prl-hands">' + HANDS.map((h, i) => '<button type="button" data-hand="' + i + '"><b>' + h.title + '</b><span>' + h.sub + '</span></button>').join('') + '</div></section>' +
        '<section data-pane="look" hidden>' + LOOK.map(([k, name, note]) => '<div class="prl-row"><div class="prl-name">' + name + '</div>' + seg(k, CoachReport.OPTIONS[k], opts[k]) + (note ? '<p class="prl-note">' + note + '</p>' : '') + '</div>').join('') +
          '<div class="prl-row"><div class="prl-name">SOUND</div>' + seg('sound', [['off', 'OFF'], ['on', 'ON']], state.sound || 'off') + '</div>' +
          '<div class="prl-actions"><button type="button" data-act="replay">SHOW IT AGAIN</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="prl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="grade" hidden>' + GRADE_HELP + '</section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.prl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.hand != null){ open(false); idx = Number(t.dataset.hand); save(); CoachReport.close(); stage(); return; }
      const s = t.closest('.prl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        if (k === 'sound'){ state.sound = v; if (host) host.set({ sound:v }); try{ settings.sound = v === 'on'; }catch(err){} return; }
        opts[k] = v; save(); CoachReport.apply(opts);
        return;
      }
      if (t.dataset.act === 'replay'){ open(false); CoachReport.close(); setTimeout(openReport, 260); return; }
      if (t.dataset.act === 'copy'){
        const text = 'P.I.P. report (round 1):\n' + LOOK.map(([k, name]) => '- ' + name + ': ' + (CoachReport.OPTIONS[k].find(o => o[0] === opts[k]) || ['', opts[k]])[1]).join('\n');
        const ta = sheet.querySelector('.prl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }

  /* ---- the console after a hand: REPORT and DEAL ---- */
  let keys = null;
  function installKeys(){
    const face = document.querySelector('.actions-face-play'), row = $id('actions-row');
    if (!face || !row) return;
    row.style.display = 'none';
    keys = document.createElement('div');
    keys.className = 'actions-row prp-keys';
    keys.innerHTML = '<button type="button" class="btn-check prp-key-report">Report<span class="prp-lamp"></span></button><button type="button" class="btn-raise prp-key-deal">Deal</button>';
    face.appendChild(keys);
    keys.querySelector('.prp-key-report').addEventListener('click', () => { press(); openReport(); });
    keys.querySelector('.prp-key-deal').addEventListener('click', async () => {
      press();
      if (CoachReport.isOpen()) await CoachReport.close();
      idx = (idx + 1) % HANDS.length; save();
      stage();
    });
    // a tap on P.I.P. opens it too (and only that, in the lab)
    document.addEventListener('click', e => {
      if (!(e.target.closest && e.target.closest('#coach-station'))) return;
      e.stopPropagation();
      if (current && CoachReport.worthIt(current) && !CoachReport.isOpen()) openReport();
    }, true);
  }
  const press = () => { try{ Sound.buttonRelease('check'); }catch(e){} try{ haptic(18); }catch(e){} };
  function paintKeys(){
    if (!keys || !current) return;
    const has = CoachReport.worthIt(current), rep = keys.querySelector('.prp-key-report');
    rep.classList.toggle('is-dark', !has);
    rep.classList.toggle('has-word', has && !current.seen);
    try{ CoachSet.notice(has && !current.seen); }catch(e){}
  }
  function openReport(){
    if (!current || !CoachReport.worthIt(current)) return;
    current.seen = true; paintKeys();
    CoachReport.open(current);
  }

  /* ---- put a hand on the table ---- */
  function fill(str, names){ return typeof str === 'string' ? str.replace(/\{([AB])\}/g, (m, k) => names[k] || m) : str; }
  function stage(quiet){
    const g = typeof game !== 'undefined' ? game : null; if (!g) return;
    const h = HANDS[idx]; if (!h) return;
    const opp = g.players.filter(p => !p.isHuman);
    const names = { A:(opp[0] || {}).name || 'Tony', B:(opp[1] || opp[0] || {}).name || 'Lucy' };
    const copy = JSON.parse(JSON.stringify(h));
    copy.summary = fill(copy.summary, names); copy.takeaway = fill(copy.takeaway, names);
    Object.values(copy.streets).forEach(st => { st.note = fill(st.note, names); });
    if (!quiet || !current) current = copy;
    const me = g.players.find(p => p.isHuman);
    me.hand = h.hole.map(c => Object.assign({}, c));
    g.board = h.board.map(c => Object.assign({}, c));
    // the one who showed shows their cards in their seat too
    if (h.shown && h.shown[0]){ const who = h.who === 'B' ? (opp[1] || opp[0]) : opp[0]; if (who) who.hand = h.shown[0].map(c => Object.assign({}, c)); }
    // nobody "is thinking": the hand is over
    g.currentIndex = g.players.indexOf(me);
    try{ render(); }catch(e){}
    const res = h.net > 0 ? 'YOU WON ' + h.net.toLocaleString() : h.net < 0 ? 'YOU LOST ' + (-h.net).toLocaleString() : 'YOU FOLDED';
    try{ setActionRows('HAND ' + h.n + ' OVER', res, false); }catch(e){}
    if (!quiet) paintKeys();
  }

  /* ---- start ---- */
  async function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = state.sound === 'on'; settings.coachBot = true; settings.autoDeal = false; }catch(e){}
    CoachReport.apply(opts);
    build();
    try{ startSinglePlayerRun({ opponentCount:3 }); }catch(e){ console.error(e); return; }
    await waitFor(() => game && game.handNumber >= 1 && game._humanCardsVisible === true && game.board, 30000);
    await sleep(300);
    // hold the table still: the opponents never finish thinking
    window.aiWait = () => new Promise(() => {});
    // the wait already running (and a decision in flight) finish now; the
    // next thinker then stops for good
    try{ releaseQuickResolveWait(); }catch(e){}
    await sleep(2500);
    installKeys();
    stage();
    // the TUNE key steps down to the report's bottom corner while it's open
    const key = $id('prl-key');
    setInterval(() => {
      // keep the staged hand on the table (a late action can't deal over it)
      if (current && game && (game.board.length !== HANDS[idx].board.length || game.players[game.currentIndex] && !game.players[game.currentIndex].isHuman)) stage(true);
      const r = CoachReport.isOpen() && document.querySelector('.prp');
      if (!r){ key.style.top = ''; key.style.left = ''; return; }
      const b = r.getBoundingClientRect();
      key.style.top = Math.round(b.bottom - 46) + 'px'; key.style.left = Math.round(b.left + 9) + 'px';
    }, 250);
  }
  window.__prLab = { stage, openReport, get current(){ return current; }, get idx(){ return idx; }, set idx(v){ idx = v; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
