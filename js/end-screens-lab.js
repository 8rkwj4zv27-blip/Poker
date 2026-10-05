"use strict";

/* ============================================================
   END SCREENS LAB — the controls, inside the game (round 1, phone-first)
   (docs/ui/END_SCREENS_PLAN.md)

   Runs in the game copy the host page (end-screens-lab.html,
   js/end-screens-lab-host.js) builds: a TUNE key in the corner opens a
   bottom sheet. Everything it shows is the game's own code: the result
   stage with the chip tape (js/event-tape.js), the game over that keeps
   the wreck (js/knockout.js), the limping drum (js/action-drum.js) and
   P.I.P. going to the moon (js/coach-set.js). The lab only sets up the
   moment: a Career table with a made-up event behind it (EventTape.fixture)
   so a whole event doesn't have to be played to see the end of one, or a
   REAL EVENT to play yourself. Nothing is settled: no Career money moves.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { pip:'on', field:'4', length:'normal', luck:'auto', best:'on', sound:'on', moment:null };
  const $id = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(80); } return false; }

  const EVENT_BY_FIELD = { 3:'back-room-freezeout', 4:'card-club-deep', 6:'card-club-six' };
  const LENGTH = { short:7, normal:22, long:60 };
  const MOMENTS = [
    ['bust', 'YOU BUST · EVENT LOST', true],
    ['won', 'EVENT WON', true],
    ['cleared', 'TABLE CLEARED'],
    ['runover', 'RUN OVER'],
    ['real', 'PLAY A REAL EVENT', true]
  ];
  // The look. Every row switches live on the screen in view; the defaults
  // are the owner's round-3 order (EventTape.LOOK).
  const LOOKS = [
    ['counter', 'THE BIG NUMBER', [['drums', 'DRUMS ON THE CASING'], ['reel', 'ON THE GLASS (ROUND 2)'], ['bare', 'BIG DRUMS, NO FRAME']], 'All four end screens. Drums like your STACK, sat in a bay in the panel; the words beside them on a small screen.'],
    ['space', 'SPACING', [['standard', 'STANDARD'], ['roomy', 'ROOMY'], ['compact', 'COMPACT']], 'All four end screens.'],
    ['finish', 'FINISH / OUTLASTED', [['merged', 'ON THE BUST-OUT SCREEN'], ['panel', 'ITS OWN PANEL']], 'Event screens. Merged: "YOU FINISHED 3RD OF 4" heads the bust-out screen, and the panel steps out to give the tape room. Its own panel does not fit on a standard iPhone: the stage scrolls.'],
    ['tape', 'CHIP TAPE', [['tall', 'TALL: FILLS THE ROOM'], ['medium', 'MEDIUM: ROOM SPREAD EVENLY']]],
    ['bust', 'BUST-OUT ORDER', [['row', 'ROW OF FACES'], ['list', 'A LIST'], ['faces', 'FACES ONLY']]],
    ['luck', 'LUCK', [['both', 'WORD + STRIP + NUMBERS'], ['strip', 'STRIP + NUMBERS'], ['words', 'WORD + NUMBERS']]],
    ['se', 'ON SE-SIZED PHONES', [['scroll', 'STAGE SCROLLS'], ['small', 'SHRINK TO FIT']], 'Only shows on a phone 700px tall or less.']
  ];
  const lookState = () => Object.assign({}, EventTape.LOOK, state.look || {});
  const OPTIONS = [
    ['pip', 'P.I.P. ON THE TABLE', [['on', 'ON'], ['off', 'OFF']], 'He has to be there to be sent to the moon.'],
    ['field', 'FIELD', [['3', '3'], ['4', '4'], ['6', '6']]],
    ['length', 'EVENT LENGTH', [['short', '7 HANDS'], ['normal', '22 HANDS'], ['long', '60 HANDS']]],
    ['luck', 'LUCK', [['auto', 'AS IT WENT'], ['bad', 'RAN BAD'], ['fair', 'FAIR'], ['hot', 'RAN HOT'], ['none', 'NO ALL-INS']]],
    ['best', 'BEST HAND', [['on', 'A FULL HOUSE'], ['none', 'NO SHOWDOWN']]],
    ['sound', 'SOUND', [['on', 'ON'], ['off', 'OFF']]]
  ];
  const NEW = [
    'ROUND 3: back to screens fitted into the cabinet, with no words printed on the casing. The big number is real drums in a bay (all four end screens). Breathing room throughout, and the header back to full size. The LOOK tab has the choices.',
    'P.I.P. on a win: he hops, then drops under the table BEFORE the stage turns, so the wheel can\'t catch him.',
    'ROUND 2 (the cabinet): the well is one raised plastic panel like the FINISH / OUTLASTED deck, with the screens set into it. Labels are printed on the casing, not the glass. The bust-out faces sit in little portrait windows. LUCK is a strip meter (BAD to HOT, lit out from the middle).',
    'EVENT WON / EVENT LOST: the RESULT well is the event\'s story now.',
    'CHIP TAPE: your stack hand by hand, drawn in by a pen. K.O.s are little bursts, the flag is your peak, the dashed line is where you started. Bust: it flatlines to the edge with a tone. Win: it reaches the ALL CHIPS line.',
    'BUST-OUT ORDER: who went out when, first out on the left. Your K.O.s have a burst. After a bust, who got you is lit and the rest say STILL IN.',
    'BEST HAND: the best hand you showed down. LUCK METER: your all-ins that ran out, what you won against what the odds said.',
    'The small HANDS / FIELD / PRIZE row steps out (the tape and bust-out order say it). On SE-sized phones FINISH / OUTLASTED step out too.',
    'After a bust the dashboard STAYS wrecked, smouldering. The button drum limps round slowly to BACK TO EVENTS, and only that key gets its power back. It\'s all repaired on the way out.',
    'P.I.P.: blinks in a panic as the dashboard takes its hits, then gets blasted off the screen. His lead snaps (the frayed end stays on the dashboard) and he twinkles out in the sky. He\'s back at the next table. On a win he hops twice and ducks under the table out of the way.',
    'PLAY A REAL EVENT: a real Career event (the field above) with the real tape, on a pretend bankroll.'
  ];

  /* ---- the key and the sheet ---- */
  const lookSeg = (key, opts) => '<div class="esl-seg" data-look="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === lookState()[key] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  function setLook(patch){
    state.look = Object.assign({}, state.look || {}, patch);
    if (host) host.set({ look:state.look });
    try{ EventTape.look(lookState()); }catch(e){}
    document.querySelectorAll('.esl-seg[data-look]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === lookState()[sg.dataset.look])));
  }
  const seg = (key, opts) => '<div class="esl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === state[key] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'esl-key'; key.textContent = 'TUNE';
    const again = document.createElement('button');
    again.type = 'button'; again.className = 'esl-key esl-again-key'; again.textContent = 'AGAIN';
    const sheet = document.createElement('div');
    sheet.className = 'esl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'End screens lab');
    sheet.innerHTML =
      '<div class="esl-tabs" role="tablist"><button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="look">LOOK</button><button type="button" data-tab="new">WHAT\'S NEW</button>' +
        '<button type="button" class="esl-close" aria-label="Close">✕</button></div>' +
      '<div class="esl-body">' +
        '<section data-pane="moments"><p class="esl-sub">Each moment deals a fresh table and plays straight to the end of an event. AGAIN (top left) replays the last one.</p>' +
          '<div class="esl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '" class="is-wide">' + m[1] + '</button>').join('') + '</div>' +
          '<h3>THE EVENT<small>Made-up events for the two quick moments; the real event uses the field.</small></h3>' +
          OPTIONS.map(r => '<div class="esl-row"><div class="esl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + (r[3] ? '<p class="esl-note">' + r[3] + '</p>' : '') + '</div>').join('') +
        '</section>' +
        '<section data-pane="look" hidden><p class="esl-sub">Changes show at once on the screen behind. Play a moment first, then come here.</p>' +
          LOOKS.map(r => '<div class="esl-row"><div class="esl-name">' + r[1] + '</div>' + lookSeg(r[0], r[2]) + (r[3] ? '<p class="esl-note">' + r[3] + '</p>' : '') + '</div>').join('') +
          '<div class="esl-actions"><button type="button" data-act="reset">BACK TO THE GAME LOOK</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="esl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="new" hidden><h3>WHAT\'S IN IT</h3><ul class="esl-list">' + NEW.map(t => '<li>' + t + '</li>').join('') + '</ul></section>' +
      '</div>';
    document.body.append(key, again, sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    again.addEventListener('click', () => go(state.moment || 'bust'));
    sheet.querySelector('.esl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.moment){ open(false); go(t.dataset.moment); return; }
      const lk = t.closest('.esl-seg[data-look]');
      if (lk){ setLook({ [lk.dataset.look]:t.dataset.v }); return; }
      if (t.dataset.act === 'reset'){ state.look = {}; setLook({}); return; }
      if (t.dataset.act === 'copy'){
        const L = lookState();
        const text = 'End screens (round 3):\n' + LOOKS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === L[r[0]]) || ['', L[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('.esl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
        return;
      }
      const s = t.closest('.esl-seg');
      if (s){
        state[s.dataset.key] = t.dataset.v; if (host) host.set({ [s.dataset.key]:t.dataset.v });
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        applySettings();
      }
    });
  }
  function go(m){
    state.moment = m;
    if (host){ host.set({ moment:m }); host.play(m); } else run(m);
  }
  function applySettings(){
    try{
      settings.sound = state.sound !== 'off';
      settings.coachBot = state.pip !== 'off';
      if (typeof saveSettings === 'function') saveSettings();
    }catch(e){}
  }

  /* ---- the moments ---- */
  const human = () => game.players.find(p => p.isHuman);
  async function table(field){
    const ev = careerEventSnapshot(careerEventById(EVENT_BY_FIELD[field] || EVENT_BY_FIELD[4]));
    newGame({ mode:'career', difficulty:ev.difficulty, opponents:ev.opponentCount, stack:ev.stack, blindLevel:ev.initialBlindLevel });
    game.event = Object.assign({}, ev, { reward:makeEventRewardState() });
    showTableScreen(); initSeats(); render();
    // P.I.P. comes up on the table first, if he's switched on
    if (state.pip !== 'off') await waitFor(() => CoachSet.on && !CoachSet.busy, 12000);
    await sleep(900);
    return game;
  }
  async function present(won){
    const field = Number(state.field) || 4;
    const g = await table(field);
    const hands = LENGTH[state.length] || LENGTH.normal;
    const place = won ? 1 : Math.max(2, field - 1);
    const tape = EventTape.fixture(g, won, { hands, place, seed:Date.now() % 997 + 3,
      luck:state.luck === 'auto' ? null : state.luck, noAllins:state.luck === 'none', noBest:state.best === 'none' });
    // the table as the event left it
    const out = new Set(tape.out.filter(o => !o.you).map(o => o.id));
    const alive = g.players.filter(p => !p.isHuman && !out.has(p.id));
    g.players.forEach(p => { if (out.has(p.id)){ p.chips = 0; p.eliminated = true; p.inHand = false; } });
    const me = human();
    if (won){ me.chips = tape.total; }
    else {
      me.chips = 0;
      const each = Math.floor(tape.total / Math.max(1, alive.length));
      alive.forEach((p, i) => { p.chips = each + (i === 0 ? tape.total - each * alive.length : 0); });
      // the chip leader got you
      const killer = alive[0];
      if (killer){ const y = tape.out.find(o => o.you); if (y){ y.by = [killer.name]; y.hand = 'Full House'; } }
    }
    g.handNumber = tape.pts[tape.pts.length - 1][0];
    g.tape = tape;
    render();
    const model = buildCareerResultModel(g, { outcome:won ? 'win' : 'loss', place, prize:won ? g.event.prize : 0 });
    g.over = true;
    setBanner(won ? '<b>Event won.</b> Every opponent is out.' : '<b>Event over.</b> You were eliminated.');
    presentResultStage(g, careerStageModel(model), {
      prepare:() => { clearHumanReadouts(); powerDownCompletedEvent(g); },
      muck:won,
      console:() => enterCareerResultsConsole(() => go(state.moment))
    });
  }
  function real(){
    const field = Number(state.field) || 4, id = EVENT_BY_FIELD[field] || EVENT_BY_FIELD[4];
    try{
      materializeCareerRosters();
      career.bankroll = Math.max(career.bankroll || 0, careerEventById(id).buyIn * 10);
      if (!enterCareerEvent(id)){ setBanner('<b>Lab:</b> could not enter the event.'); return; }
      startCareerEvent();
    }catch(e){ setBanner('<b>Lab:</b> ' + String(e.message || e)); }
  }
  // TABLE CLEARED / RUN OVER: the game's own DEV fixtures
  async function fixtureStage(kind){
    try{ DEV_MODE = true; devTestResultStage(kind); }catch(e){ setBanner('<b>Lab:</b> ' + String(e.message || e)); }
    try{ teardownDevPanel(); }catch(e){}
  }
  function run(m){
    applySettings();
    if (m === 'real') return real();
    if (m === 'cleared') return fixtureStage('table-cleared');
    if (m === 'runover') return fixtureStage('run-over');
    return present(m === 'won').catch(e => { try{ setBanner('<b>Lab:</b> ' + String(e.message || e)); }catch(err){} });
  }

  function start(){
    try{ EventTape.look(lookState()); }catch(e){}
    build();
    applySettings();
    if (state.moment) setTimeout(() => run(state.moment), 400);
    else setTimeout(() => { const k = document.querySelector('.esl-key'); if (k) k.click(); }, 600);   // first visit: the moments
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 300)); else setTimeout(start, 300);
})();
