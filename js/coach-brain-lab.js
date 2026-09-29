"use strict";

/* ============================================================
   P.I.P. BRAIN LAB — the controls, inside the game (round 1, phone-first)

   Step 2 of his brain (docs/coach/BRAIN_PLAN.md): he judges every decision
   you make before the flop. Play real hands and he speaks as he would in
   the game: a word right after you act when it's worth one, the reason
   after the hand, and a lesson the first time one comes up.

   On the table: TUNE opens the sheet; the key beside ⚙ switches him on and
   off. Tap a bubble to put it away. The sheet:
     TRY IT        set spots: each key plays a decision and he explains it
                   in full (the word, the reason, the lesson)
     HIS VERDICTS  every decision you've made here, with his verdict, how
                   sure he is, the better move and the numbers; tap one to
                   hear it again
     TALK          the talk slider and the HELP dial
     KEY           his key's face
   COPY MY PICKS (on KEY) copies the rows as one line.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : {};
  const CS = CoachSet, CT = CoachTalk, CB = CoachBrain;
  let picks = Object.assign({ keyFace:CS.DEFAULTS.keyFace || 'pip', notch:'4', help:'3' }, state.picks || {});
  const wasOn = state.on;

  function save(){ if (host) host.set({ picks:Object.assign({}, picks), on:CS.on }); }
  function applyPicks(){
    CS.apply(Object.assign({}, CS.DEFAULTS, { bootLen:'quick', keyFace:picks.keyFace }));
    CT.apply(Object.assign({}, CT.order, { notch:picks.notch, help:picks.help }));
    try{ settings.coachTalk = picks.notch; settings.coachHelp = picks.help; }catch(e){}
    save();
  }

  /* ---------------- set spots, on a pretend table ----------------
     A hand-built table like the test suite's (validation/coach-brain-checks.js):
     n seats, the button at `dealer`, you at `you`, blinds posted. */
  const card = code => {
    const r = code[0] === 'T' ? '10' : code[0], s = { s:'♠', h:'♥', d:'♦', c:'♣' }[code[1]];
    return { rank:r, suit:s, value:RANK_VALUES[r] };
  };
  function table(n, dealer, you, hole, stack){
    const bb = 20;
    const players = Array.from({ length:n }, (_, i) => ({
      id: i === you ? 'you' : 'p' + i, name: i === you ? 'You' : ['Tony', 'Mavis', 'Lucy', 'Nigel', 'Roxy', 'Steve'][i % 6], isHuman: i === you,
      chips: stack || 2000, hand: i === you ? hole.map(card) : [], inHand:true, folded:false, allIn:false, eliminated:false,
      betThisRound:0, totalBetHand:0, mayRaise:true }));
    const sb = (dealer + 1) % n, bbi = (dealer + 2) % n;
    const g = { players, board:[], pot:0, currentBet:bb, minRaise:bb, bigBlind:bb, dealerIndex:dealer, sbIndex:sb, bbIndex:bbi,
      phase:'preflop', handNumber:0, handActions:[], handLog:[], streetRaises:0, pfRaises:0, pfAggressorId:null, mode:'cash', reads:{} };
    const post = (i, a) => { const p = players[i]; p.chips -= a; p.betThisRound += a; p.totalBetHand += a; g.pot += a; };
    post(sb, bb / 2); post(bbi, bb);
    return g;
  }
  function act(g, i, action, to){
    const p = g.players[i];
    const toCall = g.currentBet - p.betThisRound;
    if (action === 'fold') p.folded = true;
    else if (action === 'call' && g.currentBet <= p.betThisRound) action = 'check';
    else if (action === 'call'){ const need = Math.min(p.chips, g.currentBet - p.betThisRound); p.chips -= need; p.betThisRound += need; p.totalBetHand += need; g.pot += need; if (!p.chips) p.allIn = true; }
    else if (action === 'raise'){
      const need = to - p.betThisRound; p.chips -= need; p.betThisRound += need; p.totalBetHand += need; g.pot += need;
      if (!p.chips) p.allIn = true;
      g.minRaise = Math.max(g.minRaise, to - g.currentBet); g.currentBet = to;
      g.streetRaises++; if (g.phase === 'preflop'){ g.pfAggressorId = p.id; g.pfRaises = g.streetRaises; }
    }
    if (action === 'raise' && g.phase !== 'preflop' && g.streetRaises === 1) action = 'bet';
    g.handActions.push({ id:p.id, name:p.name, street:g.phase, action, amount:p.betThisRound });
    // the engine's public log after the flop
    if (g.phase !== 'preflop'){
      const code = action === 'bet' || action === 'raise' ? (toCall > 0 ? 'r' : 'b') : action === 'call' ? 'c' : action === 'check' ? 'k' : null;
      if (code) g.handLog.push({ id:p.id, n:g.board.length, a:code });
    }
  }
  function street(g, phase, cards){
    g.phase = phase; g.board.push(...cards.map(card)); g.currentBet = 0; g.minRaise = g.bigBlind; g.streetRaises = 0;
    g.players.forEach(p => { p.betThisRound = 0; });
  }
  // [label, seats, button, you, your cards, stack, before you [[seat, action, to]], you do [action, to]]
  const F = s => s.map(i => [i, 'fold']);
  const SPOTS = [
    ['RAISE SEVEN-TWO UNDER THE GUN', 6, 0, 3, ['7s', '2h'], 2000, [], ['raise', 60]],
    ['RAISE KING-EIGHT ON THE BUTTON', 6, 0, 0, ['Ks', '8h'], 2000, F([3, 4, 5]), ['raise', 60]],
    ['FOLD ACE-KING, NOBODY IN', 6, 0, 3, ['As', 'Kh'], 2000, [], ['fold']],
    ['FOLD ACE-FIVE UNDER THE GUN', 6, 0, 3, ['As', '5h'], 2000, [], ['fold']],
    ['LIMP WITH QUEENS', 6, 0, 3, ['Qs', 'Qh'], 2000, [], ['call']],
    ['LIMP WITH JACK-FOUR', 6, 0, 3, ['Js', '4h'], 2000, [], ['call']],
    ['RAISE ACES TO 8 BIG BLINDS', 6, 0, 3, ['As', 'Ah'], 2000, [], ['raise', 160]],
    ['ALL IN, ACE-KING, 100 BLINDS', 6, 0, 5, ['As', 'Kd'], 2000, F([3, 4]), ['raise', 2000]],
    ['RAISE A LIMPER: ACE-QUEEN', 6, 0, 5, ['As', 'Qd'], 2000, [[3, 'call'], [4, 'fold']], ['raise', 80]],
    ['BIG BLIND: FOLD WHEN IT\'S FREE', 6, 0, 2, ['8s', '3d'], 2000, [[3, 'call'], [4, 'fold'], [5, 'fold'], [0, 'fold'], [1, 'call']], ['fold']],
    ['CALL A RAISE WITH KING-NINE', 6, 0, 5, ['Ks', '9h'], 2000, [[3, 'raise', 60], [4, 'fold']], ['call']],
    ['RE-RAISE WITH QUEENS', 6, 0, 5, ['Qs', 'Qh'], 2000, [[3, 'raise', 60], [4, 'fold']], ['raise', 180]],
    ['JUST CALL WITH QUEENS', 6, 0, 5, ['Qs', 'Qh'], 2000, [[3, 'raise', 60], [4, 'fold']], ['call']],
    ['FOLD ACE-JACK TO AN EARLY RAISE', 6, 0, 5, ['As', 'Jh'], 2000, [[3, 'raise', 60], [4, 'fold']], ['fold']],
    ['BIG BLIND: DEFEND NINE-SEVEN SUITED', 6, 0, 2, ['9s', '7s'], 2000, F([3, 4, 5]).concat([[0, 'raise', 50], [1, 'fold']]), ['call']],
    ['BIG BLIND: FOLD KING-TEN', 6, 0, 2, ['Ks', 'Td'], 2000, F([3, 4, 5]).concat([[0, 'raise', 50], [1, 'fold']]), ['fold']],
    ['8 BLINDS: SHOVE ACE-NINE', 6, 0, 0, ['As', '9d'], 160, F([3, 4, 5]), ['raise', 160]],
    ['8 BLINDS: FOLD ACE-NINE', 6, 0, 0, ['As', '9d'], 160, F([3, 4, 5]), ['fold']],
    ['8 BLINDS: LIMP ACE-NINE', 6, 0, 0, ['As', '9d'], 160, F([3, 4, 5]), ['call']],
    // (29 Sep: you have 1,400; Lucy in the big blind has only 70 behind)
    ['LUCY IS SHORT: FOLD SIX-TWO', 3, 0, 0, ['6d', '2d'], 1400, [[1, 'fold']], ['fold'], { chips:{ 2:70 } }],
    ['LUCY IS SHORT: ALL IN KING-TEN', 3, 0, 0, ['Ks', 'Td'], 1400, [[1, 'fold']], ['raise', 1400], { chips:{ 2:70 } }],
    // after the flop: the button raised, you called in the big blind; you check, they bet
    ['FLOP: CALL A FLUSH DRAW, HALF POT', 'post', ['Ah', '5h'], ['Kh', '9h', '2c'], 0.5, ['call']],
    ['FLOP: CHASE A GUTSHOT, POT BET', 'post', ['7s', '5d'], ['Kh', '9h', '8c'], 1.0, ['call']],
    ['FLOP: CALL WITH NOTHING', 'post', ['Qs', '3d'], ['Kh', '9h', '2c'], 0.5, ['call']],
    ['FLOP: FOLD TOP PAIR', 'post', ['Ks', 'Qd'], ['Kh', '9c', '2d'], 0.5, ['fold']],
    ['FLOP: JUST CALL WITH A SET', 'post', ['9s', '9d'], ['Kh', '9c', '2d'], 0.5, ['call']],
    ['FLOP: RAISE WITH A SET', 'post', ['9s', '9d'], ['Kh', '9c', '2d'], 0.5, ['raise', 3]],
    ['RIVER: CALL A BIG BET, BOTTOM PAIR', 'post', ['2s', '3d'], ['Kh', '9c', '2d', 'Js', '5h'], 1.0, ['call']],
    ['RIVER: FOLD A MISSED FLUSH', 'post', ['Ah', '5h'], ['Kh', '9h', '2c', '3s', 'Jd'], 0.7, ['fold']],
    // (29 Sep: they checked the flop and bet the turn; you have 400 left)
    ['TURN: THEY WAKE UP, CALL A STRAIGHT DRAW', 'post', ['9s', '8s'], ['7h', '6c', '2d', 'Kd'], 0.4, ['call'], { stack:400 }],
    ['TURN: ALL IN OVER THEIR BET, STRAIGHT DRAW', 'post', ['9s', '8s'], ['7h', '6c', '2d', 'Kd'], 0.5, ['allin'], { stack:400 }],
    // checked to you: you raised on the button, the big blind called and checks to you
    ['RIVER: CHECK TWO PAIR', 'bet', ['As', '2c'], ['Ah', '5d', '2s', '6d', '3d'], 'check'],
    ['RIVER: BET TWO PAIR', 'bet', ['As', '2c'], ['Ah', '5d', '2s', '6d', '3d'], 'bet'],
    ['FLOP: BET TOP PAIR', 'bet', ['Ks', 'Qd'], ['Kh', '7c', '2d'], 'bet'],
    ['FLOP: CHECK A MIDDLE PAIR', 'bet', ['7s', '8d'], ['Kh', '7c', '2d'], 'check'],
    ['FLOP: BET A FLUSH DRAW', 'bet', ['Ah', '5h'], ['Kh', '9h', '2c'], 'bet'],
    ['TURN: ALL IN ON A STRAIGHT DRAW (400 LEFT)', 'bet', ['9s', '8s'], ['7h', '6c', '2d', 'Kd'], 'allin', { stack:400 }],
    ['TURN: STRAIGHT DRAW, A CALLER, 120 LEFT: CHECK', 'bet', ['9s', '8s'], ['7h', '6c', '2d', 'Kd'], 'check', { stack:120, caller:true }],
    ['FLOP: BLUFF ONE PLAYER', 'bet', ['Qs', 'Jd'], ['8h', '4c', '2d'], 'bet'],
    ['FLOP: BLUFF TWO PLAYERS', 'bet', ['Qs', 'Jd'], ['8h', '4c', '2d'], 'bet', { two:true }],
    ['RIVER: CHECK WITH NOTHING', 'bet', ['Qs', 'Jd'], ['8h', '4c', '2d', '3s', '7h'], 'check'],
    // (29 Sep: the hand that knocks you out: a short word, no lesson; tap him for the rest)
    ['OUT: ALL IN ON A DRAW, AND MISSED', 'hurt', 'TURN: ALL IN ON A STRAIGHT DRAW (400 LEFT)'],
    ['OUT: A GOOD CALL THAT LOST', 'hurt', 'FLOP: CALL A FLUSH DRAW, HALF POT']
  ];
  function playBet(spec){
    const [, , hole, board, mine, opts] = spec;
    const two = opts && opts.two;
    const g = table(6, 0, 0, hole, 2000);
    [3, 4, 5].forEach(i => act(g, i, 'fold'));
    act(g, 0, 'raise', 50); act(g, 1, two ? 'call' : 'fold'); act(g, 2, 'call');
    street(g, 'flop', board.slice(0, 3));
    const round = () => { if (two) act(g, 1, 'check'); act(g, 2, 'check'); act(g, 0, 'check'); };
    if (board.length > 3){ round(); street(g, 'turn', [board[3]]); }
    if (board.length > 4){ round(); street(g, 'river', [board[4]]); }
    if (two) act(g, 1, 'check');
    act(g, 2, 'check');
    const me = g.players[0];
    if (opts && opts.stack) me.chips = opts.stack;
    if (opts && opts.caller) g.reads = { p2:{ hands:30, facedBet:12, foldedToBet:1 } };
    const sp = CB.spot(g, me);
    act(g, 0, mine === 'check' ? 'check' : 'raise', mine === 'allin' ? me.chips : mine === 'bet' ? Math.round(g.pot * 0.6 / 10) * 10 : 0);
    const d = { spot:sp, choice:CB.choice(sp, g, me) };
    d.judgement = CB.judge(sp, d.choice);
    d.advice = CB.advise(sp);
    return d;
  }
  function playPost(spec){
    const [, , hole, board, frac, mine, opts] = spec;
    const g = table(6, 0, 2, hole, 2000);
    [3, 4, 5].forEach(i => act(g, i, 'fold')); act(g, 0, 'raise', 50); act(g, 1, 'fold'); act(g, 2, 'call');
    street(g, 'flop', board.slice(0, 3));
    if (board.length > 3){ act(g, 2, 'check'); act(g, 0, 'check'); street(g, 'turn', [board[3]]); }
    if (board.length > 4){ act(g, 2, 'check'); act(g, 0, 'check'); street(g, 'river', [board[4]]); }
    act(g, 2, 'check'); act(g, 0, 'raise', Math.round(g.pot * frac));
    const me = g.players[2];
    if (opts && opts.stack) me.chips = opts.stack;
    const sp = CB.spot(g, me);
    act(g, 2, mine[0] === 'allin' ? 'raise' : mine[0], mine[0] === 'allin' ? me.chips + me.betThisRound : mine[0] === 'raise' ? g.currentBet * mine[1] : 0);
    const d = { spot:sp, choice:CB.choice(sp, g, me) };
    d.judgement = CB.judge(sp, d.choice);
    d.advice = CB.advise(sp);
    return d;
  }
  function playSpot(i){
    if (SPOTS[i][1] === 'post') return playPost(SPOTS[i]);
    if (SPOTS[i][1] === 'bet') return playBet(SPOTS[i]);
    const [, n, dealer, you, hole, stack, before, mine, opts] = SPOTS[i];
    const g = table(n, dealer, you, hole, stack);
    if (opts && opts.chips) Object.keys(opts.chips).forEach(k => { g.players[+k].chips = opts.chips[k]; });
    before.forEach(b => act(g, b[0], b[1], b[2]));
    const me = g.players[you], sp = CB.spot(g, me);
    act(g, you, mine[0], mine[1]);
    const d = { spot:sp, choice:CB.choice(sp, g, me) };
    d.judgement = CB.judge(sp, d.choice);
    d.advice = CB.advise(sp);
    return d;
  }

  /* ---------------- how a verdict reads ---------------- */
  const DID = { fold:'FOLDED', check:'CHECKED', call:'CALLED', raise:'RAISED', allin:'WENT ALL IN', bet:'BET' };
  const BEST = { fold:'FOLD', check:'CHECK', call:'CALL', raise:'RAISE', allin:'ALL IN' };
  function verdictCard(d, head){
    const j = d.judgement; if (!j) return '';
    const n = j.n, sp = d.spot;
    const nums = j.kind === 'bet' ? (n.handName + (n.drawName ? ', ' + n.drawName : '') + '. Checked to you, against ' + n.players + (n.players === 1 ? ' player' : ' players') +
        ': you win about ' + n.eq + '% of the time. A bluff of ' + n.sizeWords + ' needs them to fold ' + n.foldNeed + '%; they fold about ' + n.fold + '% here. Their betting says: ' + n.story + '.')
      : j.kind === 'post' ? (n.handName + (n.drawName ? ', ' + n.drawName + ' (' + n.outs + ' outs)' : '') + '. Facing ' + n.betSize + ': you win about ' + n.eq + '% against the hands that bet like that. You needed ' + n.need + '%.')
      : n.eq != null ? 'You win about ' + n.eq + '% against the hands that raise usually means. You needed ' + n.need + '%.'
      : n.range != null ? 'Your hand: top ' + n.pct + '%. From ' + (sp.seat || 'there') + ', a sound player plays the top ' + n.range + '%.' : '';
    return '<div class="cbl-card is-' + j.verdict + '">' + (head ? '<div class="cbl-head">' + head + '</div>' : '') +
      '<div class="cbl-line">' + (sp.seat || '') + ' · ' + sp.holeFacts.name.toUpperCase() + ' · ' + (DID[d.choice.action] || d.choice.action) + '</div>' +
      '<div class="cbl-verdict">' + j.verdict.toUpperCase() + ' · ' + j.confidence.toUpperCase() + (j.best !== d.choice.action ? ' · BETTER: ' + (BEST[j.best] || j.best) : '') + '</div>' +
      '<div class="cbl-nums">' + nums + '</div><div class="cbl-tag">' + j.tag + ' · lesson: ' + (j.lesson || '-') + '</div></div>';
  }
  function allJudged(){
    const hands = CB.history.concat(CB.hand ? [CB.hand] : []);
    const out = [];
    hands.forEach(h => (h.decisions || []).forEach(d => { if (d.judgement) out.push({ n:h.n, d }); }));
    return out.reverse();
  }

  /* ---------------- the sheet ---------------- */
  const TABS = [['try', 'TRY IT'], ['log', 'HIS VERDICTS'], ['talk', 'TALK'], ['key', 'KEY']];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  let lastTry = null;
  function pane(tab){
    if (tab === 'try'){
      return '<h3>TRY IT<small>Each key plays one decision on a pretend table. P.I.P. says what he\'d have told you before you acted (at your HELP setting), then the word he\'d say straight away, the reason after the hand, and the lesson. Or just play: on your turn he advises, and you can TAP HIS SCREEN any time for his read (tap again for the why).</small></h3>' +
        (lastTry ? verdictCard(lastTry, 'LAST SPOT') : '') +
        '<div class="sdl-moments">' + SPOTS.map((s, i) => '<button type="button" data-spot="' + i + '">' + s[0] + '</button>').join('') + '</div>';
    }
    if (tab === 'log'){
      const all = allJudged();
      return '<h3>HIS VERDICTS<small>Every decision you\'ve made before the flop here, newest first: what he thought, how sure he was, and the numbers. Tap one to hear him explain it.</small></h3>' +
        (all.length ? all.slice(0, 40).map((x, i) => '<button type="button" class="cbl-row" data-log="' + i + '">' + verdictCard(x.d, 'HAND ' + x.n) + '</button>').join('')
          : '<p class="sdl-note">Nothing yet. Play a hand.</p>');
    }
    if (tab === 'talk'){
      return '<div class="sdl-row"><div class="sdl-name">THE TALK SLIDER</div>' + seg('notch', CT.OPTIONS.notch, picks.notch) +
        '<p class="sdl-note">1 COMMENTS: only a clear mistake gets a word. 2 DEBRIEF: + good plays, and the reasons after the hand. 3 TIPS: + his advice on the big decisions, and the smaller mistakes. 4 IN YOUR EAR: everything: advice on every decision, your seat when you\'re dealt in, close calls called close.</p></div>' +
        '<div class="sdl-row"><div class="sdl-name">HELP: HOW DIRECT HE IS</div>' + seg('help', CT.OPTIONS.help, picks.help) +
        '<p class="sdl-note">Before you act, before the flop (after the flop comes next). ADVICE: what he\'d do and why; says so when it\'s close. TELL ME: always the move, with the numbers and the size. HINTS: what to think about, not the move. WATCH: nothing before you act; he teaches afterwards. Tapping his screen always gets his full read.</p></div>' +
        '<button type="button" class="sdl-again" data-act="deal">DEAL AGAIN</button>';
    }
    return '<div class="sdl-row"><div class="sdl-name">HIS KEY</div>' + seg('keyFace', CS.OPTIONS.keyFace, picks.keyFace) +
      '<p class="sdl-note">The key beside ⚙ that switches him on (bottom right of the dashboard). HIS FACE: his two dots and mouth on a little dark screen, lit green when he\'s on. PIP IN BIG LETTERS: his name in the buttons\' lettering. THE TV: as it was in v0.54.</p></div>' +
      '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
      '<textarea class="sdl-copytext" readonly hidden></textarea>';
  }

  let sheet, key;
  function paint(){
    if (!sheet) return;
    const body = sheet.querySelector('.sdl-body'), top = body.scrollTop;
    TABS.forEach(t => { sheet.querySelector('[data-pane="' + t[0] + '"]').innerHTML = pane(t[0]); });
    body.scrollTop = top;
  }
  const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); if (on) paint(); };
  const withHim = fn => { if (!CS.on) CS.power(true).then(() => setTimeout(fn, 300)); else fn(); };
  function build(){
    const css = document.createElement('style');
    css.textContent = '.cbl-card{ text-align:left; padding:8px 10px; margin:0 0 8px; border:2px solid #080405; background:#1B0C0F; color:#E9DFC6; font:11px/1.45 var(--font-body,system-ui); }' +
      '.cbl-card.is-good{ box-shadow:inset 4px 0 0 #6FCF8E; } .cbl-card.is-fine{ box-shadow:inset 4px 0 0 #E8B83A; } .cbl-card.is-mistake{ box-shadow:inset 4px 0 0 #E0603A; }' +
      '.cbl-head{ font:8px var(--font-hdr); color:#B69A7A; margin-bottom:4px; } .cbl-line,.cbl-verdict{ font:8px/1.6 var(--font-hdr); } .cbl-verdict{ color:#F3D27A; }' +
      '.cbl-nums{ margin-top:4px; } .cbl-tag{ margin-top:3px; font-size:10px; color:#8C7A66; }' +
      '.cbl-row{ display:block; width:100%; padding:0; border:0; background:none; min-height:44px; }';
    document.head.append(css);
    key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'P.I.P. brain lab');
    sheet.innerHTML = '<div class="sdl-tabs" role="tablist">' + TABS.map((t, i) => '<button type="button" data-tab="' + t[0] + '"' + (i ? '' : ' class="is-on"') + '>' + t[1] + '</button>').join('') +
      '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' + TABS.map((t, i) => '<section data-pane="' + t[0] + '"' + (i ? ' hidden' : '') + '></section>').join('') + '</div>';
    document.body.append(key, sheet);
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        paint(); sheet.querySelector('.sdl-body').scrollTop = 0;
        return;
      }
      if (t.dataset.spot && SPOTS[+t.dataset.spot][1] === 'hurt'){
        // that decision, then the hand that knocked you out: what he says over it
        const d = playSpot(SPOTS.findIndex(s => s[0] === SPOTS[+t.dataset.spot][2]));
        lastTry = d; open(false);
        const start = d.spot.stack + d.spot.yourBet + 100;
        withHim(() => CT.labDebrief({ n:(typeof game !== 'undefined' && game ? game.handNumber : 0), decisions:[d], startStack:start, end:{ net:-start, showdown:true } }));
        return;
      }
      if (t.dataset.spot){
        const d = playSpot(+t.dataset.spot);
        lastTry = d; open(false);
        withHim(() => CT.explain(d, d.advice));
        return;
      }
      if (t.dataset.log){
        const x = allJudged()[+t.dataset.log];
        if (x){ open(false); withHim(() => CT.explain(x.d)); }
        return;
      }
      const act = t.dataset.act;
      if (act === 'deal'){ save(); if (host) host.play(); else location.reload(); return; }
      if (act === 'reset'){ picks = { keyFace:CS.DEFAULTS.keyFace || 'pip', notch:'4', help:'3' }; applyPicks(); paint(); return; }
      if (act === 'copy'){ copyPicks(t); return; }
      const holder = t.closest('[data-key]');
      if (!holder) return;
      picks[holder.dataset.key] = t.dataset.v;
      applyPicks(); paint();
    });
    paint();
  }
  function copyPicks(t){
    const name = (opts, v) => { const r = (opts || []).find(x => x[0] === v); return r ? r[1] : v; };
    const text = 'P.I.P. BRAIN LAB: key ' + name(CS.OPTIONS.keyFace, picks.keyFace) + ' · talk ' + name(CT.OPTIONS.notch, picks.notch) + ' · help ' + name(CT.OPTIONS.help, picks.help);
    const ta = sheet.querySelector('.sdl-copytext');
    const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
    try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(e){ done(false); }
  }

  /* ---- start: a fresh table; he comes on once it's dealt ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    build();
    document.addEventListener('click', e => { if (e.target.closest('#coach-key')) setTimeout(save, 50); });
    try{ startSinglePlayerRun({ opponentCount:4 }); }catch(err){ console.error(err); }
    setTimeout(() => {
      applyPicks();
      if (wasOn || wasOn == null) CS.power(true).then(save);
    }, 2400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
