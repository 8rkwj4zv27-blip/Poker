"use strict";

/* ============================================================
   ACTION DRUM LAB — the controls, inside the game (phone-first)

   Runs in the game copy action-drum-lab.html builds (the host is the
   Showdown Lab's, js/showdown-lab-host.js). A TUNE key opens a bottom
   sheet: TURN IT (send the console to each of its sides on demand, or a
   tour of all of them), THE DRUM (every choice about the turn) and
   SETTINGS (theme, sound, a fresh table). The real game plays underneath
   too: play a hand to a showdown and the drum turns for real.

   The demo sides are the game's own: showAwardConsole(),
   enterResultsConsole() and the rest, with their presses sent back to
   the keys row instead of into a real payout.

   Round 4: the AWARD KEY tab (opens first) dresses the AWARD POT key for
   your wins (the candidate js/award-key.js + css/award-key.css), and the
   drum's new NEXT HAND side is on TURN IT.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null, opp:'3', sound:'on', moment:null };
  const $id = id => document.getElementById(id);

  // every row's first option is the owner's round-1 pick (they matched my
  // suggestions except WHICH WAY: always down)
  const ROWS = [
    ['style','THE MECHANISM', [['drum','DRUM · 4 SIDES'],['reel','REEL · SPINS PAST'],['flap','FLAT FLAP'],['shipped','TODAY\'S FLIP']],
      'DRUM: a four-sided drum, the next side rolls up. REEL: it spins past two blank sides first, like a slot reel. FLAP: one flat panel turning over. TODAY\'S FLIP is the shipped one, to compare (on a phone it\'s the one that ghosts).'],
    ['speed','SPEED', [['med','MEDIUM'],['fast','FAST'],['slow','SLOW']]],
    ['settle','THE LANDING', [['clunk','CLUNK'],['bounce','BOUNCE'],['none','GLIDE IN']], 'CLUNK: it runs a little past and knocks back. BOUNCE: past, back, home. GLIDE: eases in and stops.'],
    ['motion','MOTION', [['stepped','CHUNKY · 20 FPS'],['stepped12','CHUNKIER · 12 FPS'],['smooth','SMOOTH']], 'Chunky moves in steps, like the rest of the machine\'s pixel animation.'],
    ['dir','WHICH WAY', [['down','ALWAYS DOWN'],['meaning','UP, THEN BACK DOWN'],['up','ALWAYS UP']], 'UP, THEN BACK DOWN: new keys roll up from below, and the drum rolls back down to FOLD / CHECK / RAISE.'],
    ['shade','SHADING', [['on','ON'],['off','OFF']], 'Each side darkens as it turns away from you.'],
    ['slats','DRUM PANELS', [['turn','WHILE IT TURNS'],['always','ALWAYS'],['off','NONE']], 'The painted panel behind each side\'s keys. WHILE IT TURNS keeps the bay exactly as it is today at rest.'],
    ['lip','THE WINDOW', [['turn','WHILE IT TURNS'],['on','ALWAYS'],['off','NONE']], 'Dark lips top and bottom, so the drum reads as turning inside the case.'],
    ['sound','SOUND', [['ticks','TICKS + CLUNK'],['clunk','CLUNK'],['off','OFF']]]
  ];
  const SUGGESTED = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  let order = Object.assign({}, SUGGESTED, state.order || {});
  const THEMES = [['burgundy','BURGUNDY'],['emerald','EMERALD'],['midnight','MIDNIGHT'],['slate','SLATE']];
  if (!state.theme) state.theme = 'burgundy';
  function save(){ if (host) host.set({ order:Object.assign({}, order) }); }
  function applyOrder(){ try{ ActionDrum.set(order); }catch(e){ console.error(e); } save(); }

  /* ---- round 4: the AWARD KEY for your wins (every first option is the owner's pick, live v0.50.0) ---- */
  const AK_ROWS = [
    ['finish','THE KEY WHEN IT\'S YOURS', [['velvet','VELVET + GOLD'],['gold','POLISHED GOLD'],['glow','LIT FROM UNDER'],['today','TODAY\'S KEY']],
      'GOLD: polished gold in hard bands, a glint crossing it now and then. VELVET: the machine\'s burgundy velvet, gold letters and rim. LIT FROM UNDER: today\'s colour, glowing and breathing.'],
    ['words','THE WORDS', [['collect','COLLECT'],['award','AWARD POT'],['yours','YOURS'],['take','TAKE IT']]],
    ['amount','THE AMOUNT', [['printed','PRINTED'],['plate','ON A CREAM PLATE']], 'A little cream plate on the key, like a playing card, or just printed after the words.'],
    ['arrive','AS IT LANDS', [['glint','A FLASH'],['none','NOTHING']], 'A flash across the key as the drum brings it up, with a tick.'],
    ['press','WHEN YOU PRESS', [['sparks','SPARKS + CLACK'],['none','JUST THE PRESS']], 'Gold sparks fly off its edges, with the counter\'s clack.'],
    ['tiers','BIGGER WINS', [['on','MORE SHINE'],['off','ALL THE SAME']], 'A big pot glints faster and the key gets a gold ring; a monster, faster still.'],
    ['theirs','THEIR POT', [['quiet','QUIET · PAY HARRY'],['today','TODAY\'S KEY']], 'Someone else\'s win: today\'s gold key, or the quiet case key saying who gets paid, so only your wins shine.']
  ];
  const AK_SUGGESTED = Object.fromEntries(AK_ROWS.map(r => [r[0], r[2][0][0]]));
  let akOrder = Object.assign({}, AK_SUGGESTED, state.ak || {});
  function applyAk(){ try{ AwardKey.set(akOrder); }catch(e){ console.error(e); } if (host) host.set({ ak:Object.assign({}, akOrder) }); }

  /* ---- the sides, on demand ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  let demo = null;   // which demo side is up, or null when the game owns the console
  const isResults = () => { const b = $id('btn-award-pot-console'); return b && (b.classList.contains('next-table-mode') || b.classList.contains('career-return-mode')); };
  function clearSecondary(){
    const face = $id('console-face-award'), second = $id('btn-result-secondary');
    if (face) face.classList.remove('has-secondary');
    if (second){ second.onclick = null; second.disabled = false; second.classList.add('hidden'); second.textContent = 'Main Menu'; }
  }
  function toPlay(){
    const nh = $id('btn-next-hand'); if (demo === 'nexthand' && nh) nh.classList.add('hidden');
    try{ AwardKey.demo(null); }catch(e){}
    if (isResults()) exitResultsConsole(); else hideAwardConsole();
    clearSecondary();
    const af = $id('actions-flip'); if (af) af.classList.remove('flipped');
    const q = $id('btn-quick-resolve'); if (q) q.disabled = true;
    demo = null;
    try{ updateActionControls(); }catch(e){}
  }
  const back = () => { try{ Sound.buttonRelease('award'); }catch(e){} toPlay(); };
  function award(label){
    const btn = $id('btn-award-pot-console');
    btn.disabled = false; btn.onclick = back;
    showAwardConsole(label);
  }
  const SIDES = {
    play: toPlay,
    award(){ award('Award Pot · 150'); },
    main(){ award('Award Main · 888'); },
    quick(){
      const af = $id('actions-flip'), q = $id('btn-quick-resolve');
      q.textContent = 'Quick Resolve'; q.disabled = false;
      af.classList.add('flipped');
    },
    show(){
      award('Award Pot · 60');
      const face = $id('console-face-award'), second = $id('btn-result-secondary');
      face.classList.add('has-secondary');
      second.classList.remove('hidden'); second.disabled = false; second.textContent = 'Show';
      second.onclick = back;
    },
    next(){ enterResultsConsole(back); },
    nexthand(){ const nh = $id('btn-next-hand'); if (nh) nh.classList.remove('hidden'); },
    // round 4: the award key, dressed for each kind of pot
    win(){ AwardKey.demo({ mine:true, split:false, amount:150, tier:'small', who:[] }); award('Award Pot · 150'); },
    winbig(){ AwardKey.demo({ mine:true, split:false, amount:420, tier:'big', who:[] }); award('Award Pot · 420'); },
    winmonster(){ AwardKey.demo({ mine:true, split:false, amount:1500, tier:'monster', who:[] }); award('Award Pot · 1,500'); },
    split(){ AwardKey.demo({ mine:true, split:true, amount:160, tier:'small', who:['Harry'] }); award('Award Pot · 320'); },
    sidepot(){ AwardKey.demo({ mine:true, split:false, amount:240, tier:'big', who:[] }); award('Award Side 1 · 240'); },
    theirs(){ AwardKey.demo({ mine:false, split:false, amount:888, tier:'big', who:['Harry'] }); award('Award Pot · 888'); },
    events(){ enterCareerResultsConsole(back); },
    runover(){ enterRunOverConsole(back, back); }
  };
  // Quick Resolve's real handler would start a real quick resolve: while a
  // demo side is up, its press only turns the drum back
  document.addEventListener('click', e => {
    if (demo === 'quick' && e.target.closest && e.target.closest('#btn-quick-resolve')){
      e.stopImmediatePropagation(); e.preventDefault(); back();
    }
    // NEXT HAND's real handler deals: on the demo side it only turns back
    if (demo === 'nexthand' && e.target.closest && e.target.closest('#btn-next-hand')){
      e.stopImmediatePropagation(); e.preventDefault(); back();
    }
  }, true);
  async function side(k){
    if (!SIDES[k]) return;
    // one side at a time: from a demo side, the drum goes home first
    if (demo && k !== 'play'){ toPlay(); await waitFor(() => !ActionDrum.state.spinning, 3000); await sleep(120); }
    else if (!demo && k !== 'play'){ const af = $id('actions-flip'); if (af && af.classList.contains('flipped')) af.classList.remove('flipped'); }
    SIDES[k]();
    demo = k === 'play' ? null : k;
  }
  let touring = false;
  async function tour(){
    if (touring) return; touring = true;
    try{
      for (const k of ['win','play','nexthand','play','quick','play','show','play','next','play','runover','play']){
        if (!touring) break;
        await side(k);
        await waitFor(() => !ActionDrum.state.spinning, 3000);
        await sleep(k === 'play' ? 700 : 1100);
      }
    } finally { touring = false; }
  }

  /* ---- the key and the sheet (the Showdown Lab's sheet, css/showdown-lab.css) ---- */
  const MOMENTS = [
    ['tour','A TOUR OF EVERY SIDE', true],
    ['nexthand','NEXT HAND', true],
    ['award','AWARD POT'], ['play','BACK TO THE KEYS'],
    ['quick','QUICK RESOLVE'], ['show','AWARD + SHOW'],
    ['main','AWARD MAIN'], ['next','NEXT TABLE'],
    ['events','BACK TO EVENTS'], ['runover','RUN OVER · 2 KEYS']
  ];
  const AK_MOMENTS = [
    ['realwin','A REAL HAND: EVERYONE FOLDS TO YOU', true],
    ['win','YOU WIN · SMALL'], ['winbig','YOU WIN · BIG'],
    ['winmonster','YOU WIN · MONSTER'], ['split','YOU SPLIT'],
    ['sidepot','YOUR SIDE POT'], ['theirs','HARRY WINS']
  ];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = (r, o) => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], (o || order)[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  let sheet, key;
  const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
  function build(){
    key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.id = 'sdl-key'; key.textContent = 'TUNE';
    const again = document.createElement('button');
    again.type = 'button'; again.className = 'sdl-key sdl-again-key'; again.textContent = 'TURN';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.id = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Action drum lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="ak" class="is-on">AWARD KEY</button><button type="button" data-tab="turn">TURN IT</button><button type="button" data-tab="drum">THE DRUM</button><button type="button" data-tab="settings">SETTINGS</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="ak"><p class="sdl-sub">Round 4: the AWARD POT key when the pot is yours. Each key below closes this sheet and brings the key up for that pot; press it to turn back. The top one plays a real hand you win. Your picks are under the moments.</p>' +
          '<div class="sdl-moments">' + AK_MOMENTS.map(m => '<button type="button" data-side="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<div data-ak-rows>' + AK_ROWS.map(r => row(r, akOrder)).join('') + '</div>' +
          '<div class="sdl-actions"><button type="button" data-act="akreset">START OVER</button><button type="button" data-act="akcopy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" data-ak-copy readonly hidden></textarea></section>' +
        '<section data-pane="turn" hidden><p class="sdl-sub">Each key closes this sheet and turns the console to that side. Press the side\'s own key (AWARD POT, NEXT TABLE...) to turn back. The TURN key in the corner goes AWARD POT and back. Or just play: a real showdown turns it too.</p><p class="sdl-sub">KNOCK TO CHECK is back: double-tap the dashboard case on your turn. Facing a bet, it refuses with a buzz.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-side="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div></section>' +
        '<section data-pane="drum" hidden>' + ROWS.map(row).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
        '<section data-pane="settings" hidden><h3>THE MACHINE</h3>' +
          '<div class="sdl-row"><div class="sdl-name">THEME</div>' + seg('theme', THEMES, state.theme) + '</div>' +
          '<div class="sdl-row"><div class="sdl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
          '<div class="sdl-row"><div class="sdl-name">REDUCED MOTION</div>' + seg('rm', [['off','OFF'],['on','ON']], state.rm || 'off') + '<p class="sdl-note">With it on the console swaps at once, no turn.</p></div>' +
          '<button type="button" class="sdl-again" data-act="deal">DEAL A FRESH TABLE</button></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(again); document.body.appendChild(sheet);
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    again.addEventListener('click', () => { open(false); if (demo === 'award') side('play'); else side('award'); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.side){
        open(false);
        const k = t.dataset.side;
        setTimeout(() => { if (k === 'tour') tour(); else if (k === 'realwin') realWin(); else { touring = false; side(k); } }, 260);
        return;
      }
      const s = t.closest('.sdl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        if (k === 'theme' || k === 'sound' || k === 'rm'){ state[k] = v; if (host) host.set({ [k]:v }); machine(); }
        else if (s.closest('[data-ak-rows]')){ akOrder[k] = v; applyAk(); }
        else { order[k] = v; applyOrder(); }
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        return;
      }
      if (t.dataset.act === 'deal'){ open(false); if (host) host.play(null); else deal(); return; }
      if (t.dataset.act === 'reset'){ order = Object.assign({}, SUGGESTED); applyOrder(); paint(); return; }
      if (t.dataset.act === 'akreset'){ akOrder = Object.assign({}, AK_SUGGESTED); applyAk(); paint(); return; }
      if (t.dataset.act === 'akcopy'){
        const text = 'Award key picks:\n' + AK_ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === akOrder[r[0]]) || ['', akOrder[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('[data-ak-copy]');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
        return;
      }
      if (t.dataset.act === 'copy'){
        const text = 'Action drum picks:\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === order[r[0]]) || ['', order[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('.sdl-copytext:not([data-ak-copy])');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }
  function paint(){
    document.querySelectorAll('.sdl-seg').forEach(s => {
      const k = s.dataset.key, cur = k === 'theme' || k === 'sound' || k === 'rm' ? (state[k] || 'off') : s.closest('[data-ak-rows]') ? akOrder[k] : order[k];
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === cur));
    });
  }
  function machine(){
    try{
      settings.theme = state.theme; document.body.setAttribute('data-theme', state.theme);
      settings.sound = state.sound !== 'off';
      settings.reduceMotion = state.rm === 'on';
      document.body.setAttribute('data-motion', state.rm === 'on' ? 'off' : 'on');
    }catch(e){}
  }
  async function deal(){
    startSinglePlayerRun({ opponentCount:3 });
    await waitFor(() => !!pendingHumanPlayer, 40000);
  }
  // A real hand you win: everyone still in folds to you at your turn, and
  // the game plays it out for real (the pot, AWARD POT, NEXT HAND).
  async function realWin(){
    if (toPlayIfDemo()) await waitFor(() => !ActionDrum.state.spinning, 3000);
    if (!game || game.over || !(await waitFor(() => pendingHumanPlayer && !$id('actions-row').classList.contains('disabled'), 1500))){
      await deal();
      await waitFor(() => pendingHumanPlayer && !$id('actions-row').classList.contains('disabled'), 40000);
    }
    try{
      game.players.filter(p => !p.isHuman && p.inHand && !p.folded).forEach(p => applyAction(p, { action:'fold' }));
      render();
      const c = game.currentBet - pendingHumanPlayer.betThisRound;
      humanAct(c > 0 ? 'call' : 'check');
    }catch(e){ console.error(e); }
  }
  function toPlayIfDemo(){ if (!demo) return false; toPlay(); return true; }
  window.__adLab = { side, tour, realWin, get ak(){ return Object.assign({}, akOrder); }, setAk(o){ Object.assign(akOrder, o); applyAk(); paint(); }, get order(){ return Object.assign({}, order); }, set(o){ Object.assign(order, o); applyOrder(); paint(); }, get demo(){ return demo; } };

  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    machine();
    build();
    ActionDrum.install();
    applyOrder();
    applyAk();
    if (host) host.set({ moment:null });
    deal().catch(err => console.error(err));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
