"use strict";

/* ============================================================
   LOOK-DEV LAB — the controls and the new language, inside the game
   (Design Language 2, slice 1: a whole hand, start to finish)

   Runs in the game copy look-dev-lab.html builds (the host is
   js/showdown-lab-host.js, shared with the Showdown Lab). Play the hand
   yourself; the TUNE key's sheet switches between BEFORE (the game as it
   ships) and AFTER (the new language), the two lamps, idle life and the
   type candidates, and can deal straight into a win, a loss or an all-in.

   AFTER changes presentation only:
   - the lamp (js/look-dev-light.js), with drama on the showdown and award;
   - say it once: the hand named once, beaten seats dim, the console says
     YOU WIN and the number (css/look-dev-lab.css);
   - beats: cards squash and settle as they land, the flop thumps the
     cloth, the showdown holds a frame and pushes in, the hand readout grows
     with the hand, sparks fly from the pot to your bank;
   - idle life: the faces breathe, now and then one twitches; the lamp
     flickers;
   - sound on by default, with three cues of the game's own synth added
     for the new beats (the flop's thump, the showdown hit, each spark
     ticking into the bank).
   Picks survive each re-deal through the host (parent.__lab).
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const DEF = { dl2:'on', ll:'dom', k:'1.15', idle:'on', flicker:'on', spot:'on', fps:'off', smash:'calm', marquee:'now', machine:'now', print:'now', sound:'on' };
  const st = Object.assign({}, DEF, host && host.state.look || {});
  const save = () => { if (host) host.set({ look:Object.assign({}, st) }); };
  const $id = id => document.getElementById(id);
  const root = document.documentElement;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------------- the fonts under audition (lab only: Google Fonts) ---------------- */
  const FONTS = 'family=Jersey+10&family=Jersey+15&family=Silkscreen&family=Sixtyfour&family=VT323&family=Tiny5&family=Micro+5&family=DotGothic16&family=Handjet:wght@600&display=swap';
  function loadFonts(){
    if (document.querySelector('link[data-ll-fonts]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.llFonts = '';
    l.href = 'https://fonts.googleapis.com/css2?' + FONTS; document.head.appendChild(l);
  }

  /* ---------------- apply the switches ---------------- */
  let savedSmash = null;
  function apply(){
    const on = st.dl2 === 'on';
    root.classList.toggle('dl2', on);
    root.classList.toggle('ll-idle', on && st.idle === 'on');
    LookLight.setMode(on ? st.ll : 'off');
    LookLight.set({ flicker:st.flicker === 'on', spot:st.spot === 'on', k:Number(st.k) || 1 });
    ['marquee', 'machine', 'print'].forEach(k => { if (on && st[k] !== 'now') root.dataset['type' + k[0].toUpperCase() + k.slice(1)] = st[k]; else delete root.dataset['type' + k[0].toUpperCase() + k.slice(1)]; });
    // the award: AFTER keeps the pot from scattering over the board (the smash stays for monster pots only if asked)
    try{
      if (savedSmash === null) savedSmash = settings.sdSmash;
      settings.sdSmash = on ? (st.smash === 'calm' ? 'off' : savedSmash) : savedSmash;
      settings.sound = st.sound === 'on';
    }catch(e){}
    fpsEl.hidden = st.fps !== 'on';
    save();
  }

  /* ---------------- beats ---------------- */
  // a card landing (the deal and the board): squash, settle, a longer shadow while it does
  function land(el){
    if (!el || !root.classList.contains('dl2')) return;
    el.classList.remove('ll-land'); void el.offsetWidth; el.classList.add('ll-land');
    setTimeout(() => el.classList.remove('ll-land'), 380);
    if (el.closest('#board')){
      const n = $id('board').querySelectorAll('.card:not(.back)').length + $id('board').querySelectorAll('.card.back').length;
      const felt = $id('felt');
      if (felt && n <= 3){ felt.classList.remove('ll-thump'); void felt.offsetWidth; felt.classList.add('ll-thump'); try{ Sound.deckSettle(); }catch(e){} }
    }
  }
  function wrapDeal(){
    if (typeof dealCardFlight !== 'function' || dealCardFlight.__ll) return;
    const orig = dealCardFlight;
    const wrapped = async function(el, card, opts){ const r = await orig.apply(this, arguments); land(el); return r; };
    wrapped.__ll = true;
    dealCardFlight = wrapped;   // a global function binding: every caller looks it up by name
  }
  // the showdown: one held frame and a push in; the lamp answers who won
  function watchShowdown(){
    const felt = $id('felt'); if (!felt) return;
    let was = false;
    new MutationObserver(() => {
      const now = felt.classList.contains('showdown-winner-locked');
      if (now === was) return; was = now;
      root.classList.toggle('ll-shown', now);
      if (!now || !root.classList.contains('dl2')) return;
      felt.classList.remove('ll-push'); void felt.offsetWidth; felt.classList.add('ll-push');
      try{ Sound.stageLock(); }catch(e){}   // the hit: one heavy click as the frame holds
      setTimeout(() => felt.classList.remove('ll-push'), 1150);
      setTimeout(() => {
        const t = ($id('hud-result') || {}).textContent || '';
        LookLight.pulse(/you\s*win/i.test(t) ? (game && game.pot > game.bigBlind * 30 ? 'big' : 'win') : 'lose');
      }, 120);
    }).observe(felt, { attributes:true, attributeFilter:['class'] });
  }
  // the hand readout grows with the hand
  const TIERS = [[/royal|straight flush|four of a kind|quads/i, 3], [/full house|flush|straight|three of a kind|trips/i, 3], [/two pair/i, 2], [/pair/i, 1]];
  function watchReadout(){
    const hs = $id('hand-strength'); if (!hs) return;
    let last = '', lastTier = 0;
    new MutationObserver(() => {
      const t = hs.textContent.trim(); if (t === last) return; last = t;
      const tier = (TIERS.find(x => x[0].test(t)) || [0, 0])[1];
      hs.dataset.llTier = tier;
      if (tier > lastTier && root.classList.contains('dl2')){ hs.classList.remove('ll-grow'); void hs.offsetWidth; hs.classList.add('ll-grow'); if (tier >= 2) LookLight.pulse('hit'); }
      lastTier = tier;
    }).observe(hs, { childList:true, characterData:true, subtree:true });
  }
  // the award: sparks off the pot toward your bank, and the lamp warms
  function sparks(){
    const from = $id('pot-area'), to = $id('hud-tower') || $id('hud-left');
    if (!from || !to) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height * .4;
    for (let i = 0; i < 8; i++){
      const s = document.createElement('i'); s.className = 'll-spark';
      s.style.left = Math.round(ax + (Math.random() - .5) * 30) + 'px'; s.style.top = Math.round(ay + (Math.random() - .5) * 16) + 'px';
      s.style.setProperty('--ll-dx', Math.round(bx - ax + (Math.random() - .5) * 24) + 'px');
      s.style.setProperty('--ll-dy', Math.round(by - ay + (Math.random() - .5) * 18) + 'px');
      s.style.setProperty('--ll-t', (.45 + i * .05).toFixed(2) + 's');
      document.body.appendChild(s); setTimeout(() => s.remove(), 1100);
      setTimeout(() => { try{ Sound.counterTick(); }catch(e){} }, Math.round((.45 + i * .05) * 1000));   // each spark ticks as it reaches the bank
    }
  }
  function watchAward(){
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('#btn-award-pot-console');
      if (!b || !root.classList.contains('dl2')) return;
      if (/collect/i.test(b.textContent)){ sparks(); LookLight.pulse('hit'); }
    }, true);
  }
  // now and then one face twitches
  function twitchLoop(){
    setTimeout(() => {
      if (root.classList.contains('ll-idle')){
        const live = [...document.querySelectorAll('#felt .seat:not(.folded):not(.out) .avatar')];
        const a = live[Math.floor(Math.random() * live.length)];
        if (a){ a.classList.add('ll-twitch'); setTimeout(() => a.classList.remove('ll-twitch'), 200); }
      }
      twitchLoop();
    }, 2200 + Math.random() * 4200);
  }

  /* ---------------- moments: the real game, dealt to a situation ---------------- */
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  const human = () => game.players.find(p => p.isHuman);
  const opps = () => game.players.filter(p => !p.isHuman && !p.eliminated);
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !$id('actions-row').classList.contains('disabled') && !$id('console-flip').classList.contains('flipped'));
  async function deal(){
    startSinglePlayerRun({ opponentCount:4 });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
  }
  async function seat(n){
    for (let k = 0; k < 6; k++){
      await deal();
      const ins = opps().filter(p => p.inHand && !p.folded && !p.allIn);
      if (ins.length >= n){ const keep = ins.slice(0, n); opps().forEach(p => { if (!keep.includes(p) && p.inHand && !p.folded && !p.allIn) applyAction(p, { action:'fold' }); }); render(); return keep; }
    }
    throw new Error('could not seat the rivals');
  }
  const rankOf = (p, board) => evaluate7(p.hand.concat(board));
  function stack(test){
    const need = 5 - game.board.length; if (need <= 0) return;
    for (let t = 0; t < 6000; t++){
      const run = shuffle(game.deck.slice()).slice(0, need);
      if (!test(game.board.concat(run))) continue;
      const keys = new Set(run.map(cardKey));
      game.deck = game.deck.filter(c => !keys.has(cardKey(c))).concat(run.slice().reverse());
      return;
    }
  }
  // the moment is set up; the hand is still yours to play (the rivals just call along)
  const callAlong = rivals => { DEV_MODE = true; rivals.forEach(p => { p._devAutoCall = true; }); };
  const PLAYS = {
    async hand(){ await deal(); },
    async win(){ const [r] = await seat(1); stack(b => compareHands(rankOf(human(), b), rankOf(r, b)) > 0 && rankOf(human(), b).cat >= 2); callAlong([r]); },
    async lose(){ const [r] = await seat(1); stack(b => compareHands(rankOf(r, b), rankOf(human(), b)) > 0 && rankOf(human(), b).cat >= 1); callAlong([r]); },
    async allin(){ const [r] = await seat(1); stack(b => compareHands(rankOf(human(), b), rankOf(r, b)) > 0); DEV_MODE = true; r._devForceAllIn = true; },
    async foldwin(){ await deal(); opps().forEach(p => { if (p.inHand && !p.folded && !p.allIn) applyAction(p, { action:'fold' }); }); render(); }
  };
  let busy = false;
  async function run(m){
    if (busy || !PLAYS[m]) return; busy = true;
    try{ await PLAYS[m](); }catch(e){ console.error(e); } finally{ busy = false; }
  }

  /* ---------------- the key and the sheet ---------------- */
  const ROWS = {
    look:[
      ['dl2', 'THE LOOK', [['on', 'AFTER (NEW)'], ['off', 'BEFORE (NOW)']], 'BEFORE is the game exactly as it ships. Flip while a hand is on to compare.'],
      ['ll', 'THE LAMP', [['dom', 'A · LIGHT LAYERS'], ['gl', 'B · LIT CLOTH'], ['off', 'NO LAMP']], 'A: a stepped pool of light, shadows thrown away from the lamp, glints that slide. B: the cloth itself lit per pixel by the lamp (WebGL), with A\'s shadows and glints.'],
      ['k', 'LAMP STRENGTH', [['1', 'SOFT'], ['1.15', 'MEDIUM'], ['1.35', 'STRONG']]],
      ['spot', 'WHOSE TURN', [['on', 'A SMALL LIGHT'], ['off', 'FRAME ONLY']]],
      ['flicker', 'THE LAMP FLICKERS', [['on', 'NOW AND THEN'], ['off', 'STEADY']]],
      ['idle', 'THE FACES', [['on', 'BREATHE + TWITCH'], ['off', 'STILL']]],
      ['smash', 'THE AWARD', [['calm', 'POT TO YOU + SPARKS'], ['smash', 'THE SMASH (NOW)']], 'The smash scatters the pot over the board; the calm award sends it to your bank and leaves the cloth clean.'],
      ['sound', 'SOUND', [['on', 'ON'], ['off', 'OFF']]],
      ['fps', 'FRAME RATE', [['off', 'HIDE'], ['on', 'SHOW']], 'Shows frames per second in the corner, to check the lamps on your phone.']
    ],
    type:[
      ['marquee', 'MARQUEE · YOU WIN', [['now', 'NOW'], ['jersey10', 'JERSEY 10'], ['silkscreen', 'SILKSCREEN'], ['sixtyfour', 'SIXTYFOUR']]],
      ['machine', 'MACHINE · THE READOUTS', [['now', 'NOW'], ['vt323', 'VT323'], ['tiny5', 'TINY5'], ['micro5', 'MICRO 5']]],
      ['print', 'PRINT · TICKETS + CARDS', [['now', 'NOW'], ['jersey15', 'JERSEY 15'], ['dotgothic', 'DOTGOTHIC'], ['handjet', 'HANDJET']]]
    ]
  };
  const PRINT_FAMILY = { now:'var(--font-hdr)', jersey15:"'Jersey 15'", dotgothic:"'DotGothic16'", handjet:"'Handjet'" };
  const seg = (k, opts) => '<div class="sdl-seg" data-key="' + k + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (st[k] === o[0] ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  const MOMENTS = [['hand', 'DEAL A FRESH HAND', true], ['win', 'A HAND YOU WIN'], ['lose', 'A HAND YOU LOSE'], ['allin', 'THEY SHOVE · YOU WIN'], ['foldwin', 'EVERYONE FOLDS']];
  let fpsEl = null;
  function build(){
    fpsEl = document.createElement('div'); fpsEl.className = 'll-fps'; fpsEl.hidden = true; document.body.appendChild(fpsEl);
    setInterval(() => { if (!fpsEl.hidden) fpsEl.textContent = LookLight.fps + ' FPS · ' + (root.dataset.ll || 'off').toUpperCase(); }, 500);
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Look-dev lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist"><button type="button" data-tab="look" class="is-on">THE LOOK</button><button type="button" data-tab="hand">HANDS</button><button type="button" data-tab="type">TYPE</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="look"><p class="sdl-sub">Play the hand yourself. Flip THE LOOK between BEFORE and AFTER to compare the same table.</p>' + ROWS.look.map(row).join('') + '</section>' +
        '<section data-pane="hand" hidden><p class="sdl-sub">Each deals a fresh table set up for the moment; you still play it (FOLD, CHECK, RAISE as you like).</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div></section>' +
        '<section data-pane="type" hidden><p class="sdl-sub">Three voices: MARQUEE for the big words, MACHINE for the screens, PRINT for tickets and cards. NOW is today\'s font. These fonts load only in this lab.</p>' +
          ROWS.type.map(row).join('') +
          '<div class="ll-spec" id="ll-spec"><div class="s1">INVITATION · ADMIT ONE · NO. 04</div><div class="s2">Face to Face</div><div class="s3">2 PLAYERS · KNOCKOUT</div><div class="s4">TOP PRIZE <b>$60</b></div></div>' +
          '<p class="sdl-note">The card above shows the PRINT voice; the table\'s ticket uses it when a table starts.</p></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.moment){ open(false); if (host){ host.set({ moment:t.dataset.moment }); host.play(t.dataset.moment); } else run(t.dataset.moment); return; }
      const s = t.closest('.sdl-seg'); if (!s) return;
      st[s.dataset.key] = t.dataset.v;
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
      apply(); spec();
    });
    spec();
  }
  function spec(){ const el = $id('ll-spec'); if (el) el.style.setProperty('--ll-print', PRINT_FAMILY[st.print] || 'var(--font-hdr)'); }
  function paintSegs(){ document.querySelectorAll('.sdl-sheet .sdl-seg').forEach(s => s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', st[s.dataset.key] === b.dataset.v))); }

  /* ---------------- start ---------------- */
  // today's size of the two screens, measured before any font is swapped
  function holdScreens(){
    [['banner', '--ll-banner-h'], ['hand-strength', '--ll-hs-h']].forEach(([id, v]) => {
      const el = $id(id); const h = el && el.getBoundingClientRect().height;
      if (h > 4) root.style.setProperty(v, Math.round(h) + 'px');
    });
  }
  function start(){
    try{ settings.seenTour = true; settings.seenIntro = true; }catch(e){}
    loadFonts();
    build();
    wrapDeal(); watchShowdown(); watchReadout(); watchAward(); twitchLoop();
    const types = { marquee:st.marquee, machine:st.machine, print:st.print };
    Object.assign(st, { marquee:'now', machine:'now', print:'now' }); apply();
    // the screens get their size once the table is up, then the picked fonts go on
    waitFor(() => { const b = $id('banner'); return b && b.getBoundingClientRect().height > 4; }, 20000).then(() => { holdScreens(); Object.assign(st, types); apply(); });
    const m = host && host.state.moment;
    if (host) host.set({ moment:null });
    run(PLAYS[m] ? m : 'hand');
  }
  window.__lookLab = { get state(){ return Object.assign({}, st); }, set(o){ Object.assign(st, o); apply(); spec(); paintSegs(); }, run, get busy(){ return busy; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
