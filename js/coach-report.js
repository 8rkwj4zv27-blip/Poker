"use strict";

/* ============================================================
   P.I.P. REPORT (candidate, lab only: pip-report-lab.html)

   The end-of-hand breakdown the owner asked for (4 Oct 2026): a big CRT
   readout from P.I.P., above the dashboard, after the pot is paid and
   before the next deal. Tap only: it opens from the REPORT key or a tap on
   P.I.P., and a DEAL key starts the next hand.

   What it shows (docs/coach/REPORT_PLAN.md):
   - a GRADE, A to F, for how you played (never for how it turned out),
     next to the RESULT;
   - the four streets as columns: the cards, your chance of winning
     (what you could know at the time, and the truth once their cards
     were shown), the pot, your decisions stamped, what their betting said;
   - where the hand was won or lost;
   - P.I.P.'s words: a summary, one takeaway, and a note per street.

   Pure parts (grade, chanceWord, truthEquity, pivot) take plain data so
   the game can feed them from CoachBrain's hand record later. The screen
   (open/close) is drawn in the machine's fonts; its glass and ink are
   set here for the lab and become a Pattern Book part on sign-off.
   ============================================================ */
const CoachReport = (() => {
  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const LABEL = { preflop:'PRE', flop:'FLOP', turn:'TURN', river:'RIVER' };
  const NAME = { preflop:'before the flop', flop:'on the flop', turn:'on the turn', river:'on the river' };
  const BOARD_AT = { preflop:0, flop:3, turn:4, river:5 };

  const OPTIONS = {
    arrive:[['switch', 'SWITCHES ON'], ['rise', 'RISES UP'], ['flicker', 'FLICKERS ON']],
    pace:[['play', 'PLAYS THROUGH'], ['step', 'A STREET A TAP'], ['still', 'ALL AT ONCE']],
    chance:[['tick', 'BAR + TRUTH TICK'], ['bar', 'ONE BAR'], ['line', 'TWO LINES']],
    grade:[['stamp', 'STAMPED LETTER'], ['dial', 'NEEDLE DIAL'], ['readout', 'PRINTED LINE']],
    face:[['on', 'HIS FACE'], ['off', 'TEXT ONLY']],
    ink:[['marks', 'MARKS IN COLOUR'], ['mono', 'ALL HIS INK']],
    numbers:[['words', 'WORDS (NOT TAUGHT YET)'], ['numbers', 'NUMBERS (TAUGHT)']]
  };
  const DEFAULTS = Object.fromEntries(Object.entries(OPTIONS).map(([k, v]) => [k, v[0][0]]));
  let O = Object.assign({}, DEFAULTS);
  function apply(o){ Object.assign(O, o || {}); if (cur) render(cur.model, true); }

  /* ---------------- the grade ----------------
     Each decision P.I.P. judged: { street, verdict: good|fine|mistake,
     confidence: clear|leans|close, notable, potBB (the pot when you
     decided, in big blinds), risk (the share of your stack the decision
     put in) }. A grade marks how you played, never the result.

     Faults: a clear mistake 3.5, a mistake he leans to 2, a close one
     0.5; a close "fine" 0.25. Bigger pots count for more (x1.5 when
     the pot is 25 big blinds or more or half your stack went in, x0.6
     for a small pot), so a sloppy call for a few chips can't sink a hand
     played well for many. A notably good play earns 0.5 back (never
     below nothing).
       A  no faults, and something in the hand mattered
       B  faults up to 1 (a close call or two), or a hand that asked little
       C  up to 3 (a small mistake, or one he's fairly sure of)
       D  up to 5.5 (a clear mistake with real chips at stake)
       F  more, or a clear mistake that put half your stack or more at risk */
  const STAKE = d => (d.risk >= 0.5 || d.potBB >= 25) ? 1.5 : (d.potBB < 8 && (d.risk || 0) < 0.15) ? 0.6 : 1;
  function fault(d){
    if (d.verdict === 'mistake') return (d.confidence === 'clear' ? 3.5 : d.confidence === 'leans' ? 2 : 0.5) * STAKE(d);
    if (d.verdict === 'fine' && d.confidence === 'close') return 0.25;
    return 0;
  }
  function grade(decisions){
    const ds = (decisions || []).filter(d => d && d.verdict);
    if (!ds.length) return null;
    let total = ds.reduce((s, d) => s + fault(d), 0);
    const credit = ds.filter(d => d.verdict === 'good' && d.notable).length * 0.5;
    total = Math.max(0, total - credit);
    const atRisk = ds.some(d => d.verdict === 'mistake' && d.confidence === 'clear' && d.risk >= 0.5);
    const mattered = ds.some(d => d.street !== 'preflop' || d.notable || d.risk >= 0.25);
    const letter = atRisk || total > 5.5 ? 'F' : total > 3 ? 'D' : total > 1 ? 'C' : total > 0.1 || !mattered ? 'B' : 'A';
    // the decision that weighed most (for the reason line)
    const worst = ds.reduce((a, d) => fault(d) > fault(a) ? d : a, ds[0]);
    return { letter, total:Math.round(total * 100) / 100, worst:fault(worst) > 0 ? worst : null, mistakes:ds.filter(d => d.verdict === 'mistake').length, count:ds.length };
  }
  function gradeReason(g, net){
    if (!g) return '';
    const w = g.worst, where = w ? NAME[w.street] : '';
    switch (g.letter){
      case 'A': return net < 0 ? 'Every decision right. The cards did the rest.' : 'Every decision right.';
      case 'B': return w ? 'Solid. One close call ' + where + '.' : 'Solid. Nothing hard asked of you.';
      case 'C': return w && w.verdict === 'mistake' && w.confidence === 'clear' ? 'A small mistake ' + where + ', in a small pot.' : 'A mistake ' + where + '.';
      case 'D': return 'A clear mistake ' + where + ', with real chips at stake.';
      default: return g.mistakes > 1 ? 'Several clear mistakes. The worst ' + where + '.' : 'A clear mistake ' + where + ' that put your chips at risk.';
    }
  }

  /* ---------------- your chance ---------------- */
  // in words until P.I.P. has taught the numbers
  function chanceWord(eq, opts){
    if (eq == null) return '';
    const o = opts || {};
    if (o.final) return eq >= 0.99 ? 'WON' : eq <= 0.01 ? 'BEATEN' : 'SPLIT';
    if (eq >= 0.75) return 'WELL AHEAD';
    if (eq >= 0.55) return 'AHEAD';
    if (eq >= 0.45) return 'CLOSE';
    if (o.draw && eq >= 0.15) return 'DRAWING';
    if (eq >= 0.25) return 'BEHIND';
    return 'WELL BEHIND';
  }
  const pct = eq => Math.round(eq * 100) + '%';
  /* The truth: your chance against the cards they actually showed, from
     this street's board. Every runout counted after the flop; before the
     flop a seeded sample (the same answer every time). Uses the game's
     own evaluator. */
  function truthEquity(hole, opps, board){
    if (typeof evaluate7 !== 'function' || !opps || !opps.length) return null;
    const key = c => c.rank + c.suit;
    const used = new Set(hole.concat(board).concat(...opps).map(key));
    const deck = createDeck().filter(c => !used.has(key(c)));
    const need = 5 - board.length;
    let score = 0, n = 0;
    const settle = b => {
      const mine = evaluate7(hole.concat(b));
      let best = 1, ties = 1;   // 1 = you're best so far
      for (const o of opps){
        const c = compareHands(evaluate7(o.concat(b)), mine);
        if (c > 0){ best = 0; break; }
        if (c === 0) ties++;
      }
      score += best ? 1 / ties : 0; n++;
    };
    if (need === 0) settle(board);
    else if (need === 1) deck.forEach(c => settle(board.concat([c])));
    else if (need === 2){ for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) settle(board.concat([deck[i], deck[j]])); }
    else {
      let s = 7919;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let t = 0; t < 2500; t++){
        const pick = [], taken = new Set();
        while (pick.length < need){ const i = Math.floor(rnd() * deck.length); if (!taken.has(i)){ taken.add(i); pick.push(deck[i]); } }
        settle(board.concat(pick));
      }
    }
    return n ? score / n : null;
  }

  /* Where it was won or lost: the street you folded, the street they
     folded, or (cards shown) the street whose card swung it most your way
     or against you. */
  function pivot(m){
    if (m.ended === 'folded') return { street:m.endStreet, word:'FOLDED HERE' };
    if (m.ended === 'foldwin') return { street:m.endStreet, word:'WON HERE' };
    const t = STREETS.map(s => m.streets[s] && m.streets[s].truth);
    if (t.some(v => v == null)) return null;
    const win = m.net > 0, lose = m.net < 0;
    let best = null, bestD = 0;
    STREETS.forEach((s, i) => {
      const d = t[i] - (i ? t[i - 1] : 0.5);
      const v = win ? d : lose ? -d : Math.abs(d);
      if (best === null || v > bestD){ best = s; bestD = v; }
    });
    return { street:best, word: win ? 'WON HERE' : lose ? 'LOST HERE' : 'SPLIT HERE' };
  }

  /* ---------------- the model ----------------
     A hand as the report needs it (the lab hand-builds these; the game
     would build them from CoachBrain's record):
       { n, net, ended: showdown|foldwin|folded, endStreet, hole, board,
         shown: [[card,card], ...] (their cards, only if shown),
         streets: { preflop:{ pot, yourIn, you:[{ act, verdict, confidence,
           notable, potBB, risk }], them, read, know, note, figs }, ... },
         summary, takeaway }  */
  function build(h){
    const m = Object.assign({}, h);
    m.streets = {};
    STREETS.forEach(s => {
      const src = h.streets[s];
      const reached = !!src;
      const board = (h.board || []).slice(0, BOARD_AT[s]);
      const dealt = s === 'preflop' || (h.board || []).length >= BOARD_AT[s];
      const st = Object.assign({ street:s, reached, dealt, cards: s === 'preflop' ? h.hole : (h.board || []).slice(BOARD_AT[s] - (s === 'flop' ? 3 : 1), BOARD_AT[s]) }, src || {});
      st.truth = h.shown && h.shown.length && dealt ? truthEquity(h.hole, h.shown, board) : null;
      m.streets[s] = st;
    });
    m.decisions = STREETS.flatMap(s => (m.streets[s].you || []).map(d => Object.assign({ street:s }, d)));
    m.grade = grade(m.decisions);
    m.reason = gradeReason(m.grade, h.net);
    m.pivot = pivot(m);
    m.finalPot = Math.max(1, ...STREETS.map(s => m.streets[s].pot || 0));
    return m;
  }
  // a hand worth a report: something past a fold before the flop, or a mistake
  const worthIt = h => !!h && (Object.keys(h.streets || {}).some(s => s !== 'preflop')
    || ((h.streets.preflop && h.streets.preflop.you) || []).some(d => d.verdict === 'mistake' || d.act !== 'folded'));

  /* ---------------- drawing ---------------- */
  const $el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  const RED = { '♥':1, '♦':1 };
  const mini = c => c ? '<span class="prp-card' + (RED[c.suit] ? ' is-red' : '') + '"><b>' + esc(c.rank) + '</b><i>' + esc(c.suit) + '</i></span>' : '<span class="prp-card is-none"></span>';
  // pixel marks, 5x5: a tick, a wave, a cross
  const MARK = {
    good:['....#', '...#.', '#.#..', '.#...', '.....'],
    fine:['....#', '...#.', '#.#..', '.#...', '.....'],
    close:['.....', '.#...', '#.#.#', '...#.', '.....'],
    mistake:['#...#', '.#.#.', '..#..', '.#.#.', '#...#']
  };
  const markSVG = rows => '<svg class="prp-mark-i" viewBox="0 0 5 5" aria-hidden="true">' +
    rows.flatMap((r, y) => [...r].map((ch, x) => ch === '#' ? '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="currentColor"/>' : '')).join('') + '</svg>';
  const markOf = d => d.verdict === 'mistake' ? 'mistake' : d.verdict === 'fine' && d.confidence === 'close' ? 'close' : d.verdict === 'fine' ? 'fine' : 'good';
  // his face, 13x9 art pixels: two dots and a mouth
  const MOUTHS = {
    calm:[[6, 4, 8]], smile:[[5, 3, 3], [5, 9, 9], [6, 4, 8]], flat:[[6, 4, 8]], frown:[[5, 4, 8], [6, 3, 3], [6, 9, 9]],
    talk:[[5, 5, 7], [6, 5, 7]], wince:[[6, 3, 5], [5, 6, 6], [6, 7, 9]]
  };
  function faceSVG(mood, blink){
    const px = [];
    if (!blink){ px.push([2, 3, 2, 2], [2, 8, 2, 2]); } else { px.push([3, 3, 2, 1], [3, 8, 2, 1]); }
    (MOUTHS[mood] || MOUTHS.calm).forEach(([y, x0, x1]) => px.push([y, x0, x1 - x0 + 1, 1]));
    return '<svg viewBox="0 0 13 9" aria-hidden="true">' + px.map(([y, x, w, h]) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="currentColor"/>').join('') + '</svg>';
  }
  const moodFor = g => !g ? 'calm' : g.letter === 'A' || g.letter === 'B' ? 'smile' : g.letter === 'C' ? 'flat' : 'frown';

  const SEGS = 8;
  function barHTML(eq, truth, show){
    const on = eq == null ? 0 : Math.round(eq * SEGS);
    let h = '<span class="prp-barwrap"><span class="prp-bar">';
    for (let i = 0; i < SEGS; i++) h += '<i style="--i:' + i + '"' + (i < on ? ' class="is-on"' : '') + '></i>';
    h += '</span>';
    if (show && truth != null) h += '<span class="prp-tick" style="--x:' + (Math.max(0.02, Math.min(0.98, truth)) * 100).toFixed(1) + '%"></span>';
    return h + '</span>';
  }
  function potHTML(st, finalPot){
    if (!st.pot) return '';
    const on = Math.max(1, Math.round(st.pot / finalPot * SEGS)), mine = Math.min(on, Math.round((st.yourIn || 0) / finalPot * SEGS));
    let h = '<span class="prp-bar prp-bar--pot">';
    for (let i = 0; i < SEGS; i++) h += '<i style="--i:' + i + '" class="' + (i < mine ? 'is-mine' : i < on ? 'is-on' : '') + '"></i>';
    return h + '</span><span class="prp-num">' + st.pot.toLocaleString() + '</span>';
  }
  function chanceCell(st, m){
    const final = st.street === 'river' && st.truth != null;
    const words = O.numbers === 'words';
    if (!st.dealt) return '<span class="prp-dim">—</span>';
    if (O.chance === 'line') return '';
    const know = st.know, truth = st.truth;
    // all in, nothing to decide: their cards are up, so the truth is the bar
    const main = know != null ? know : truth;
    if (main == null) return '<span class="prp-dim">—</span>';
    const label = know != null
      ? (words ? chanceWord(know, { draw:st.draw }) : pct(know))
      : (words ? chanceWord(truth, { final }) : final ? chanceWord(truth, { final }) : pct(truth));
    const tick = O.chance === 'tick' && know != null && truth != null;
    return barHTML(main, truth, tick) + '<span class="prp-word' + (know == null ? ' is-truth' : '') + '">' + esc(label) + '</span>';
  }
  // TWO LINES: one stepped graph across the four columns
  function lineSVG(m){
    const W = 280, H = 46, col = W / 4;
    const y = eq => (H - 6) - eq * (H - 12);
    const path = key => {
      let d = '', started = false;
      STREETS.forEach((s, i) => {
        const v = m.streets[s][key]; if (v == null){ return; }
        const x0 = i * col + 6, x1 = (i + 1) * col - 6;
        d += (started ? ' L' : 'M') + x0 + ' ' + y(v).toFixed(1) + ' L' + x1 + ' ' + y(v).toFixed(1);
        started = true;
      });
      return d;
    };
    const k = path('know'), t = path('truth');
    const mid = y(0.5).toFixed(1);
    return '<svg class="prp-line" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<line x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '" class="prp-line-mid"/>' +
      (t ? '<path d="' + t + '" class="prp-line-truth"/>' : '') + (k ? '<path d="' + k + '" class="prp-line-know"/>' : '') + '</svg>';
  }
  function gradeHTML(m){
    const g = m.grade, L = g ? g.letter : '–';
    const net = m.net, res = net > 0 ? 'WON ' + net.toLocaleString() : net < 0 ? 'LOST ' + (-net).toLocaleString() : 'EVEN';
    const resInk = net > 0 ? 'is-money' : net < 0 ? 'is-loss' : '';
    if (O.grade === 'readout'){
      return '<div class="prp-receipt">' +
        '<div class="prp-rl"><span>HOW YOU PLAYED</span><i></i><b class="prp-g prp-g--' + L + ' prp-g-letter">' + L + '</b></div>' +
        '<div class="prp-rl"><span>RESULT</span><i></i><b class="' + resInk + '">' + res + '</b></div>' +
        '<p class="prp-reason">' + esc(m.reason) + '</p></div>';
    }
    let left;
    if (O.grade === 'dial'){
      const idx = { F:0, D:1, C:2, B:3, A:4 }[L];
      const ang = idx == null ? 0 : -72 + idx * 36;
      left = '<div class="prp-dial prp-g--' + L + '" style="--ang:' + ang + 'deg">' +
        '<svg viewBox="0 0 100 60" aria-hidden="true"><path d="M6 54 A44 44 0 0 1 94 54" class="prp-dial-arc"/>' +
        ['F', 'D', 'C', 'B', 'A'].map((x, i) => { const a = (-162 + i * 36) * Math.PI / 180; return '<text x="' + (50 + 35 * Math.cos(a)).toFixed(1) + '" y="' + (54 + 35 * Math.sin(a) + 4).toFixed(1) + '" class="prp-dial-t' + (x === L ? ' is-on' : '') + '">' + x + '</text>'; }).join('') +
        '</svg><span class="prp-needle"></span><span class="prp-hub"></span></div>';
    } else {
      left = '<div class="prp-stamp prp-g--' + L + '"><span class="prp-g-letter">' + L + '</span></div>';
    }
    return left + '<div class="prp-res"><span class="prp-cap">HOW YOU PLAYED · RESULT</span><span class="prp-fig ' + resInk + '">' + res + '</span><p class="prp-reason">' + esc(m.reason) + '</p></div>';
  }
  function columnHTML(st, m){
    const s = st.street, piv = m.pivot && m.pivot.street === s;
    const cards = s === 'preflop' ? (m.hole || []).map(mini).join('') : (st.dealt ? st.cards.map(mini).join('') : '<span class="prp-notdealt">NOT DEALT</span>');
    const you = (st.you || []).length
      ? st.you.map(d => '<span class="prp-act prp-mk--' + markOf(d) + '">' + markSVG(MARK[markOf(d)]) + '<span>' + esc(d.act) + '</span></span>').join('')
      : st.reached ? '<span class="prp-act prp-dim"><span>' + esc(st.youNote || (st.dealt ? 'all in' : '')) + '</span></span>' : '';
    return '<div class="prp-col' + (piv ? ' is-pivot' : '') + (st.dealt ? '' : ' is-off') + '" data-street="' + s + '" role="button" tabindex="0" aria-label="' + LABEL[s] + ': P.I.P.\'s note">' +
      '<div class="prp-sh"><span>' + LABEL[s] + '</span>' + (piv ? '<em>' + m.pivot.word + '</em>' : '') + '</div>' +
      '<div class="prp-cards">' + cards + '</div>' +
      '<div class="prp-chance">' + chanceCell(st, m) + '</div>' +
      '<div class="prp-pot">' + potHTML(st, m.finalPot) + '</div>' +
      '<div class="prp-you">' + you + '</div>' +
      '<div class="prp-them">' + (st.them ? '<span>' + esc(st.them) + '</span>' : '') + (st.read ? '<b>' + esc(st.read) + '</b>' : '') + '</div>' +
      '</div>';
  }
  function figsLine(st){
    if (O.numbers !== 'numbers' || !st || !st.figs) return '';
    const f = st.figs, parts = [];
    if (f.eq != null) parts.push('YOUR CHANCE ' + f.eq + '%');
    if (f.need != null) parts.push('A CALL NEEDED ' + f.need + '%');
    if (st.truth != null && st.dealt) parts.push('WITH THEIR CARDS ' + pct(st.truth));
    return parts.join(' · ');
  }

  /* ---------------- the screen ---------------- */
  let root = null, cur = null;
  const motionOff = () => { try{ return typeof window.motionOff === 'function' ? window.motionOff() : matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function place(){
    if (!root) return;
    const dock = document.getElementById('your-seat-dock');
    const vh = window.innerHeight;
    let bottom = dock ? dock.getBoundingClientRect().top : vh * 0.66;
    root.style.bottom = Math.max(0, Math.round(vh - bottom + 4)) + 'px';
  }
  function render(m, keep){
    const sel = keep && cur ? cur.sel : null;
    root.dataset.arrive = O.arrive; root.dataset.chance = O.chance; root.dataset.grade = O.grade; root.dataset.ink = O.ink; root.dataset.face = O.face;
    root.innerHTML =
      '<div class="prp-glass">' +
        '<header class="prp-head">' + (O.face === 'on' ? '<span class="prp-face">' + faceSVG(moodFor(m.grade)) + '</span>' : '') +
          '<span class="prp-title">P.I.P. REPORT</span><span class="prp-hand">HAND ' + (m.n || '') + '</span>' +
          '<button type="button" class="prp-x" aria-label="Back to the table">✕</button></header>' +
        '<section class="prp-verdict">' + gradeHTML(m) + '</section>' +
        '<section class="prp-grid">' +
          '<div class="prp-labels"><span class="l-sh"></span><span class="l-cards">CARDS</span><span class="l-chance">CHANCE' +
            (O.chance === 'tick' && m.shown && m.shown.length ? '<small><i class="prp-key-tick"></i>THEIR CARDS</small>' : '') +
            (O.chance === 'line' ? '<small><i class="prp-key-know"></i>KNEW<br><i class="prp-key-truth"></i>TRUTH</small>' : '') +
          '</span><span class="l-pot">POT<small><i class="prp-key-mine"></i>YOURS</small></span><span class="l-you">YOU</span><span class="l-them">THEM</span></div>' +
          '<div class="prp-cols">' + STREETS.map(s => columnHTML(m.streets[s], m)).join('') +
            (O.chance === 'line' ? '<div class="prp-linebox">' + lineSVG(m) + '</div>' : '') + '</div>' +
        '</section>' +
        '<section class="prp-talk" aria-live="polite"><div class="prp-talk-h"><span class="prp-talk-who">P.I.P.</span><button type="button" class="prp-back" hidden>◄ SUMMARY</button></div>' +
          '<p class="prp-text"></p><p class="prp-take"></p><p class="prp-figs"></p></section>' +
        '<footer class="prp-foot"><span class="prp-hint"></span><button type="button" class="prp-next" hidden>NEXT STREET ▸</button></footer>' +
      '</div>';
    cur = { model:m, sel, shown:STREETS.length, typing:null };
    if (keep){
      root.querySelectorAll('.prp-col').forEach(c => c.classList.add('is-lit'));
      root.classList.remove('is-playing', 'is-stepping');
      root.classList.add('is-graded');
    }
    if (keep){ if (sel) selectStreet(sel, true); else talkSummary(true); }
    root.classList.add('is-done');
    hint();
  }
  function hint(){
    if (!root) return;
    const h = root.querySelector('.prp-hint'), nx = root.querySelector('.prp-next');
    if (!h) return;
    const stepping = cur && cur.stepping;
    nx.hidden = !stepping;
    h.textContent = cur && cur.playing ? 'TAP TO SKIP' : stepping ? '' : 'TAP A STREET FOR HIS NOTE';
  }
  // typing, his mouth on every other letter
  async function type(el, text, instant){
    const token = {};
    if (cur) cur.typing = token;
    el.textContent = '';
    if (instant || motionOff()){ el.textContent = text; mouth(false); return; }
    for (let i = 1; i <= text.length; i++){
      if (!cur || cur.typing !== token){ return; }
      el.textContent = text.slice(0, i);
      if (i % 2 === 0) mouth(i % 4 === 0);
      await sleep(text[i - 1] === '.' ? 120 : 22);
    }
    mouth(false);
  }
  function mouth(open){
    const f = root && root.querySelector('.prp-face'); if (!f || !cur) return;
    f.innerHTML = faceSVG(open ? 'talk' : moodFor(cur.model.grade));
  }
  function talkSummary(instant){
    if (!cur) return;
    cur.sel = null;
    root.querySelectorAll('.prp-col').forEach(c => c.classList.remove('is-sel'));
    root.querySelector('.prp-talk-who').textContent = 'P.I.P.';
    root.querySelector('.prp-back').hidden = true;
    root.querySelector('.prp-figs').textContent = '';
    const take = root.querySelector('.prp-take');
    take.textContent = '';
    const mine = cur;
    type(root.querySelector('.prp-text'), cur.model.summary || '', instant).then(() => { if (cur === mine && !cur.sel && !cur.playing && root.querySelector('.prp-take') === take) take.textContent = cur.model.takeaway ? '▸ ' + cur.model.takeaway : ''; });
  }
  function selectStreet(s, instant){
    if (!cur) return;
    const st = cur.model.streets[s];
    if (cur.sel === s && !instant){ talkSummary(); return; }
    cur.sel = s;
    root.querySelectorAll('.prp-col').forEach(c => c.classList.toggle('is-sel', c.dataset.street === s));
    root.querySelector('.prp-talk-who').textContent = 'P.I.P. · ' + LABEL[s];
    root.querySelector('.prp-back').hidden = false;
    root.querySelector('.prp-take').textContent = '';
    root.querySelector('.prp-figs').textContent = figsLine(st);
    type(root.querySelector('.prp-text'), st.note || (st.dealt ? '' : 'The hand was over before this card.'), instant);
  }

  /* PLAYS THROUGH: the columns light up one street at a time, the bars
     fill, the stamps land, the grade comes last, then he talks. */
  async function playThrough(token){
    const cols = [...root.querySelectorAll('.prp-col')];
    root.classList.add('is-playing'); cur.playing = true; hint();
    root.querySelector('.prp-text').textContent = '';
    root.querySelector('.prp-take').textContent = '';
    for (let i = 0; i < cols.length; i++){
      if (cur.token !== token) return;
      cols[i].classList.add('is-lit');
      if (root.querySelector('.prp-line')) root.querySelector('.prp-linebox').style.setProperty('--shown', ((i + 1) / 4 * 100) + '%');
      await sleep(cols[i].classList.contains('is-off') ? 260 : 620);
    }
    if (cur.token !== token) return;
    await sleep(160);
    finishPlay();
  }
  function finishPlay(){
    if (!cur) return;
    cur.token = {};
    cur.playing = false;
    root.classList.remove('is-playing');
    root.querySelectorAll('.prp-col').forEach(c => c.classList.add('is-lit'));
    const lb = root.querySelector('.prp-linebox'); if (lb) lb.style.setProperty('--shown', '100%');
    root.classList.add('is-graded');
    hint();
    talkSummary(false);
  }
  /* A STREET A TAP: each NEXT reveals a column with its note. */
  function stepNext(){
    const cols = [...root.querySelectorAll('.prp-col')];
    const i = cols.findIndex(c => !c.classList.contains('is-lit'));
    if (i < 0) return;
    cols[i].classList.add('is-lit');
    const lb = root.querySelector('.prp-linebox'); if (lb) lb.style.setProperty('--shown', ((i + 1) / 4 * 100) + '%');
    selectStreet(cols[i].dataset.street);
    if (i === cols.length - 1 || cols.slice(i + 1).every(c => c.classList.contains('is-off'))){
      cols.forEach(c => c.classList.add('is-lit'));
      cur.stepping = false;
      root.classList.remove('is-stepping');
      root.classList.add('is-graded');
      hint();
      setTimeout(() => { if (cur && cur.sel === cols[i].dataset.street) talkSummary(); }, 1800);
    }
  }

  let onClose = null;
  async function open(h, opts){
    const o = opts || {};
    onClose = o.onClose || null;
    const app = document.getElementById('app') || document.body;
    if (!root){
      root = $el('div', 'prp');
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'P.I.P. report');
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.prp-col')){ e.preventDefault(); onClick(e); } });
      window.addEventListener('resize', place);
    }
    if (!root.isConnected) app.appendChild(root);
    const m = build(h);
    render(m);
    place();
    root.classList.remove('is-done', 'is-graded', 'is-playing', 'is-stepping', 'is-out');
    root.hidden = false;
    const still = O.pace === 'still' || motionOff();
    const token = cur.token = {};
    if (still){ root.querySelectorAll('.prp-col').forEach(c => c.classList.add('is-lit')); root.classList.add('is-graded'); talkSummary(true); }
    else {
      root.querySelector('.prp-text').textContent = '';
      root.querySelector('.prp-take').textContent = '';
      const lb = root.querySelector('.prp-linebox'); if (lb) lb.style.setProperty('--shown', '0%');
    }
    // arrive
    root.classList.remove('is-in'); void root.offsetWidth;
    root.classList.add('is-arriving');
    if (!motionOff()) await sleep(O.arrive === 'flicker' ? 420 : 360);
    root.classList.remove('is-arriving'); root.classList.add('is-in');
    if (cur.token !== token) return;
    if (still) return;
    if (O.pace === 'step'){ cur.stepping = true; root.classList.add('is-stepping'); hint(); stepNext(); return; }
    playThrough(token);
  }
  async function close(){
    if (!root || root.hidden) return;
    if (cur){ cur.token = {}; cur.typing = null; }
    root.classList.add('is-out');
    if (!motionOff()) await sleep(220);
    root.hidden = true;
    root.classList.remove('is-out', 'is-in');
    const f = onClose; onClose = null; if (f) f();
  }
  function onClick(e){
    const t = e.target;
    if (t.closest('.prp-x')){ close(); return; }
    if (cur && cur.playing){ finishPlay(); return; }
    if (t.closest('.prp-next')){ stepNext(); return; }
    if (t.closest('.prp-back')){ talkSummary(); return; }
    if (cur && cur.stepping) return;
    const col = t.closest('.prp-col');
    if (col && !col.classList.contains('is-off')) selectStreet(col.dataset.street);
    else if (col) selectStreet(col.dataset.street);
  }
  const isOpen = () => !!(root && !root.hidden && root.isConnected);

  return { open, close, isOpen, apply, build, grade, gradeReason, chanceWord, truthEquity, pivot, worthIt, OPTIONS, DEFAULTS, get options(){ return Object.assign({}, O); } };
})();
if (typeof window !== 'undefined') window.CoachReport = CoachReport;
if (typeof module !== 'undefined') module.exports = CoachReport;
