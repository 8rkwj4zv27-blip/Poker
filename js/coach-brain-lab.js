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
      phase:'preflop', handNumber:0, handActions:[], streetRaises:0, pfRaises:0, pfAggressorId:null, mode:'cash', reads:{} };
    const post = (i, a) => { const p = players[i]; p.chips -= a; p.betThisRound += a; p.totalBetHand += a; g.pot += a; };
    post(sb, bb / 2); post(bbi, bb);
    return g;
  }
  function act(g, i, action, to){
    const p = g.players[i];
    if (action === 'fold') p.folded = true;
    else if (action === 'call' && g.currentBet <= p.betThisRound) action = 'check';
    else if (action === 'call'){ const need = Math.min(p.chips, g.currentBet - p.betThisRound); p.chips -= need; p.betThisRound += need; p.totalBetHand += need; g.pot += need; if (!p.chips) p.allIn = true; }
    else if (action === 'raise'){
      const need = to - p.betThisRound; p.chips -= need; p.betThisRound += need; p.totalBetHand += need; g.pot += need;
      if (!p.chips) p.allIn = true;
      g.minRaise = Math.max(g.minRaise, to - g.currentBet); g.currentBet = to;
      g.streetRaises++; g.pfAggressorId = p.id; g.pfRaises = g.streetRaises;
    }
    g.handActions.push({ id:p.id, name:p.name, street:'preflop', action, amount:p.betThisRound });
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
    ['8 BLINDS: LIMP ACE-NINE', 6, 0, 0, ['As', '9d'], 160, F([3, 4, 5]), ['call']]
  ];
  function playSpot(i){
    const [, n, dealer, you, hole, stack, before, mine] = SPOTS[i];
    const g = table(n, dealer, you, hole, stack);
    before.forEach(b => act(g, b[0], b[1], b[2]));
    const me = g.players[you], sp = CB.spot(g, me);
    act(g, you, mine[0], mine[1]);
    const d = { spot:sp, choice:CB.choice(sp, g, me) };
    d.judgement = CB.judgePreflop(sp, d.choice);
    d.advice = CB.advisePreflop(sp);
    return d;
  }

  /* ---------------- how a verdict reads ---------------- */
  const DID = { fold:'FOLDED', check:'CHECKED', call:'CALLED', raise:'RAISED', allin:'WENT ALL IN', bet:'BET' };
  const BEST = { fold:'FOLD', check:'CHECK', call:'CALL', raise:'RAISE', allin:'ALL IN' };
  function verdictCard(d, head){
    const j = d.judgement; if (!j) return '';
    const n = j.n, sp = d.spot;
    const nums = n.eq != null ? 'You win about ' + n.eq + '% against the hands that raise usually means. You needed ' + n.need + '%.'
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
      '<p class="sdl-note">The key beside ⚙ that switches him on. P.I.P.: his name in pixel letters. TV + PIP: the little TV with his name under it. THE TV: as it is in v0.54.</p></div>' +
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
