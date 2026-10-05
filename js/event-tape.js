"use strict";

/* ============================================================
   EVENT TAPE (v0.58.0) — what EVENT WON / EVENT LOST show about the event
   The owner, 29 Sep 2026 (docs/ui/END_SCREENS_PLAN.md): the result stage's
   big RESULT well becomes the event's story. The CHIP TAPE (your stack
   hand by hand, drawn in by a chart-recorder pen, K.O.s marked, a peak
   flag; a flatline when you bust, the ALL CHIPS ceiling when you win),
   then three small instruments: BUST-OUT ORDER, BEST HAND, LUCK METER.

   Two halves:
   - The recorder. finishHand() calls EventTape.afterHand() once per
     settled Career hand; a wrapper on advancePhase() notes your odds the
     moment an all-in has nothing left to bet (a runout). It only READS the
     game: no chip, pot, K.O. or settlement is touched. The record rides
     in the Career table save (g.tape) so a resumed event keeps its tape.
   - The stage. careerStageModel() hands the snapshot over as detail
     { kind:'tape' }; stageDetailHTML() asks EventTape.html() for the well,
     and wakeResultStage() asks EventTape.wake() to run the pen.

   Every screen here is the shared CRT (css/crt.css); css/event-tape.css
   is layout only. The chart and the gauge are canvases drawn in the CRT's
   own ink, read from the glass, so they change with the recipe.
   ============================================================ */
const EventTape = (() => {
  const P = 2;                           // screen pixels per art pixel
  const MAX_POINTS = 600;
  const $id = id => document.getElementById(id);
  const quiet = () => { try{ return motionOff(); }catch(e){ return false; } };
  const money = n => '$' + Math.max(0, Math.round(n || 0)).toLocaleString('en-US');
  const E = s => (typeof esc === 'function' ? esc(s) : String(s));
  const ord = n => (typeof ordinal === 'function' ? ordinal(n) : n + '').toUpperCase();

  /* ---------------- the recorder ---------------- */
  const recording = g => !!g && g.mode === 'career' && !!g.event && Array.isArray(g.players);
  function human(g){ return g.players.find(p => p.isHuman); }
  function ensure(g){
    if (g.tape && g.tape.v === 1) return g.tape;
    const me = human(g);
    const start = me ? (Number.isFinite(g._humanStart) ? g._humanStart : me.chips) : 0;
    const total = g.players.reduce((s, p) => s + Math.max(0, p.chips || 0) + Math.max(0, p.totalBetHand || 0), 0)
      || (g.startingStack || start) * g.players.length;
    g.tape = {
      v:1,
      start:g.startingStack || start,
      total:Math.max(total, (g.startingStack || 0) * g.players.length),
      pts:[[Math.max(0, (g.handNumber || 1) - 1), start, g.blindLevel || 0]],
      out:[], best:null, allins:[], field:g.players.length
    };
    return g.tape;
  }
  // who won the pot layer a player's own last chips were in (the engine's
  // K.O. rule, resolveEliminations()), for the bust-out order
  function beatenBy(g, outcome, id){
    if (!outcome || outcome.type !== 'showdown' || !Array.isArray(outcome.potResults)) return null;
    let pot = null;
    outcome.potResults.forEach(r => { if (r.eligible && r.eligible.includes(id)) pot = r; });
    if (!pot || !pot.winnerIds) return null;
    const ids = [...pot.winnerIds].filter(x => x !== id);
    return { ids, hand:pot.hand || '' };
  }
  function afterHand(g, outcome, netProfit){
    if (!recording(g)) return;
    try{
      const t = ensure(g), me = human(g), h = g.handNumber || 0;
      if (!me) return;
      const last = t.pts[t.pts.length - 1];
      if (last && last[0] === h && t.pts.length > 1) return;       // already noted
      // best showdown hand
      const shown = outcome && outcome.type === 'showdown' && Array.isArray(outcome.contenders) && outcome.contenders.some(p => p.id === me.id);
      if (shown && me._handRes && typeof updateTrackedBest === 'function') updateTrackedBest(t, 'best', me._handRes);
      // an all-in that ran out: what the odds said against what happened
      if (t.pend && t.pend.h === h){
        const won = allInResult(outcome, me.id, netProfit);
        t.allins.push({ h, eq:t.pend.eq, won });
      }
      delete t.pend;
      // who went out this hand, in the order they finished
      const known = new Set(t.out.map(o => o.id));
      const gone = g.players.filter(p => !p.isHuman && p.eliminated && !known.has(p.id));
      const youOut = me.chips <= 0 && !known.has(me.id);
      const busted = gone.concat(youOut ? [me] : []);
      if (busted.length){
        const left = g.players.filter(p => !p.eliminated && p.chips > 0).length;
        const startOf = p => Number.isFinite(p._handStartChips) ? p._handStartChips : 0;
        // bigger stack at the start of the hand places higher; a tie goes
        // your way, as careerFinishPlace() settles it
        busted.sort((a, b) => (startOf(b) - startOf(a)) || (a.isHuman ? -1 : b.isHuman ? 1 : 0)).forEach((p, i) => {
          const by = beatenBy(g, outcome, p.id);
          const byYou = !!(by && by.ids.includes(me.id));
          const names = by ? by.ids.map(id => (g.players.find(x => x.id === id) || {}).name).filter(Boolean) : [];
          t.out.push({
            id:p.id, you:!!p.isHuman, name:p.isHuman ? 'YOU' : p.name,
            fc:Number.isInteger(p.faceColorIdx) ? p.faceColorIdx : null,
            h, place:left + 1 + i, ko:byYou && !p.isHuman,
            by:names.slice(0, 2), hand:by ? by.hand : ''
          });
        });
      }
      t.pts.push([h, Math.max(0, me.chips), g.blindLevel || 0]);
      if (t.pts.length > MAX_POINTS) t.pts.splice(1, t.pts.length - MAX_POINTS);
    }catch(e){ /* the tape is a record: it never stops a hand */ }
  }
  // How much of what you were playing for you took: your share of every
  // contested pot you were in (a K.O. on the main pot while a side pot
  // goes elsewhere is still a win against the odds that called it).
  function allInResult(outcome, id, netProfit){
    if (outcome && outcome.type === 'showdown' && Array.isArray(outcome.potResults)){
      let stake = 0, got = 0;
      outcome.potResults.forEach(r => {
        if (!r.eligible || !r.eligible.includes(id) || (r.contested != null && r.contested < 2)) return;
        stake += r.amount || 0;
        got += (r.winnerShares || []).filter(x => x.id === id).reduce((n, x) => n + x.amount, 0);
      });
      if (stake > 0) return Math.max(0, Math.min(1, got / stake));
    }
    return netProfit > 0 ? 1 : 0;
  }

  // a runout: everyone left is all in (or one player isn't, and it's not you)
  const liveOf = g => g.players.filter(p => p.inHand && !p.folded && !p.eliminated);
  function isRunout(g){
    const live = liveOf(g), free = live.filter(p => !p.allIn);
    return ['preflop', 'flop', 'turn'].includes(g.phase) && live.length >= 2 && free.length <= 1 && !free.some(p => p.isHuman) && live.some(p => p.isHuman);
  }
  function noteRunout(g){
    if (!recording(g) || !isRunout(g)) return;
    const t = ensure(g);
    if (t.pend && t.pend.h === g.handNumber) return;
    try{
      const map = (typeof Showdown !== 'undefined' && Showdown.equities) ? Showdown.equities(g) : null;
      const me = human(g);
      if (!map || !me || !map.has(me.id)) return;
      t.pend = { h:g.handNumber, eq:Math.max(0, Math.min(1, map.get(me.id) / 100)) };
    }catch(e){}
  }
  function install(){
    if (typeof advancePhase !== 'function') return;
    const inner = advancePhase;
    advancePhase = function(){
      try{ if (typeof game !== 'undefined' && game) noteRunout(game); }catch(e){}
      return inner.apply(this, arguments);
    };
  }
  // what a save may bring back: plain numbers and short strings only
  function clean(t){
    if (!t || t.v !== 1 || !Array.isArray(t.pts)) return null;
    const num = x => Number.isFinite(x) ? x : 0;
    const out = {
      v:1, start:num(t.start), total:num(t.total), field:num(t.field),
      pts:t.pts.filter(p => Array.isArray(p) && p.length >= 2).slice(-MAX_POINTS).map(p => [num(p[0]), Math.max(0, num(p[1])), num(p[2])]),
      out:(Array.isArray(t.out) ? t.out : []).slice(0, 12).map(o => ({
        id:String(o.id || ''), you:!!o.you, name:String(o.name || '').slice(0, 24), fc:Number.isInteger(o.fc) ? o.fc : null,
        h:num(o.h), place:num(o.place), ko:!!o.ko, by:(Array.isArray(o.by) ? o.by : []).slice(0, 2).map(s => String(s).slice(0, 24)), hand:String(o.hand || '').slice(0, 40)
      })),
      best:t.best && t.best.result && Array.isArray(t.best.cards) ? t.best : null,
      allins:(Array.isArray(t.allins) ? t.allins : []).slice(-60).map(a => ({ h:num(a.h), eq:Math.max(0, Math.min(1, num(a.eq))), won:Math.max(0, Math.min(1, num(a.won))) }))
    };
    return out.pts.length ? out : null;
  }
  const snapshot = g => (g && g.tape ? clean(JSON.parse(JSON.stringify(g.tape))) : null);

  /* ---------------- a made-up event (DEV tests and the lab) ---------------- */
  function fixture(g, won, o){
    o = o || {};
    const opp = (g.players || []).filter(p => !p.isHuman);
    const field = (g.players || []).length || 4;
    const start = g.startingStack || 1500, total = start * field;
    const hands = o.hands || (won ? 26 : 19);
    let rnd = o.seed || 7;
    const r = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
    const order = opp.slice().sort(() => r() - .5);
    const youPlace = won ? 1 : Math.max(2, Math.min(field, o.place || field - 1));
    const outs = [];     // [hand, player, place]
    // opponents who finish below you go out along the way
    const below = won ? order : order.slice(0, field - youPlace);
    below.forEach((p, i) => outs.push([Math.round(hands * (i + 1) / (below.length + (won ? 0 : 1))) , p, field - i]));
    let v = start;
    const pts = [[0, start, 0]];
    for (let h = 1; h <= hands; h++){
      const ko = outs.find(x => x[0] === h);
      const lvl = Math.floor((h - 1) / 6);
      if (won && h === hands) v = total;
      else if (!won && h === hands) v = 0;
      else if (ko && won) v += start * (.7 + r() * .4);
      else {
        const swing = (r() - (won ? .42 : .55)) * start * (.35 + lvl * .12);
        v = Math.max(start * .12, Math.min(total * .82, v + swing));
        if (!won && h === hands - 2) v = Math.max(start * .3, v * .45);
      }
      pts.push([h, Math.round(v), lvl]);
    }
    const out = outs.map(([h, p, place]) => ({ id:p.id, you:false, name:p.name, fc:Number.isInteger(p.faceColorIdx) ? p.faceColorIdx : null,
      h:Math.min(h, hands), place, ko:won || r() < .5, by:[], hand:'' }));
    const killer = !won ? order[order.length - 1] : null;
    if (!won) out.push({ id:'you', you:true, name:'YOU', fc:null, h:hands, place:youPlace, ko:false, by:killer ? [killer.name] : [], hand:'Full House' });
    const best = { result:{ cat:6, tiebreak:[6, 8] }, name:'Full House, Sixes over Eights',
      cards:[{ rank:'6', suit:'♠', value:6 }, { rank:'6', suit:'♥', value:6 }, { rank:'6', suit:'♦', value:6 }, { rank:'8', suit:'♣', value:8 }, { rank:'8', suit:'♠', value:8 }] };
    // luck: 'bad' | 'fair' | 'hot' (default: bad on a loss, a bit lucky on a win)
    const at = f => Math.max(1, Math.min(hands, Math.round(hands * f)));
    const LUCK = {
      bad:[{ h:at(.35), eq:.66, won:0 }, { h:at(.65), eq:.81, won:0 }, { h:hands, eq:.58, won:0 }],
      fair:[{ h:at(.3), eq:.5, won:1 }, { h:at(.6), eq:.55, won:0 }, { h:at(.9), eq:.45, won:.5 }],
      hot:[{ h:at(.2), eq:.22, won:1 }, { h:at(.5), eq:.31, won:1 }, { h:at(.8), eq:.4, won:1 }],
      bitlucky:[{ h:at(.2), eq:.38, won:1 }, { h:at(.45), eq:.71, won:1 }, { h:at(.75), eq:.55, won:0 }]
    };
    const allins = LUCK[o.luck] || (won ? LUCK.bitlucky : LUCK.bad);
    return clean({ v:1, start, total, field, pts, out, best:o.noBest ? null : best, allins:o.noAllins ? [] : allins });
  }

  /* ---------------- the stage ----------------
     The well is a cabinet: one raised plastic panel (the moulding of the
     FINISH / OUTLASTED deck) with four screens fitted into it: the chip
     tape, the bust-out order, best hand and luck. Every word is on the
     glass; the casing carries none. The look options (bust-out layout,
     luck, tape height, spacing) are CSS, set as data-es-* on <html>
     (EventTape.LOOK, css/result-cabinet.css), so the same markup serves
     them all. */
  const head = (l, r) => '<div class="et-head"><span class="crt-caption">' + l + '</span>' + (r ? '<span class="crt-caption">' + r + '</span>' : '') + '</div>';
  function html(d){
    const t = d.tape, won = !!d.won;
    const peak = t.pts.reduce((m, p) => p[1] > m[1] ? p : m, t.pts[0]);
    const hands = Math.max(0, t.pts[t.pts.length - 1][0] - t.pts[0][0]);
    return '<div class="et-well pc-raised pc-material-plastic" data-result-beat="trophy">' +
      '<div class="et-chart pc-display crt" data-crt-quiet data-ink="' + (won ? 'live' : 'danger') + '">' +
        head('CHIP TAPE · ' + hands + ' HAND' + (hands === 1 ? '' : 'S'), 'PEAK ' + E(money(peak[1]))) +
        '<div class="et-plot"><canvas class="et-canvas" aria-hidden="true"></canvas>' +
          (t.total && peakCeil(t, won) >= t.total ? '<span class="et-ceil crt-caption">ALL CHIPS</span>' : '') + '</div>' +
        '<div class="et-verdict"><span class="crt-line stage-statement">' + E(d.line) + '</span>' +
          '<span class="crt-caption">' + E(verdictSub(d)) + '</span></div>' +
      '</div>' +
      outHTML(d) +
      '<div class="et-pair">' + bestHTML(t.best) + luckHTML(t.allins) + '</div>' +
    '</div>';
  }
  function verdictSub(d){
    const t = d.tape, me = t.out.find(o => o.you);
    const bits = [];
    if (!d.won && me && me.by.length) bits.push('BY ' + me.by.join(' + ') + (me.hand ? ' · ' + me.hand : ''));
    else if (!d.won && me) bits.push('HAND ' + me.h);
    bits.push(d.sub);
    return bits.join(' · ').toUpperCase();
  }
  function outHTML(d){
    const t = d.tape, won = !!d.won, field = Math.max(t.field || 0, t.out.length + 1);
    const me = t.out.find(o => o.you);
    const youPlace = won ? 1 : (d.place || (me && me.place) || field);
    // everyone who went out, last place first; then you; then, after a
    // loss, whoever was still sitting (the one who got you lit)
    const outs = t.out.filter(o => !o.you).slice().sort((a, b) => b.place - a.place);
    const cells = outs.map(o => seat(o, 'out'));
    cells.push(youSeat(youPlace, won, me));
    if (!won){
      const killer = me && me.by[0];
      (d.alive || []).forEach(a => cells.push(seat({ name:a.name, fc:a.fc }, a.name === killer ? 'killer' : 'alive')));
    }
    return '<div class="et-out pc-display crt" data-crt-quiet>' +
      // your finish rides on this screen (the FINISH / OUTLASTED panel
      // steps out of EVENT WON / EVENT LOST unless the FINISH look says so)
      head('BUST-OUT ORDER', 'YOU FINISHED ' + ord(youPlace) + ' OF ' + field) +
      '<ol class="et-seats" style="--n:' + cells.length + '">' + cells.join('') + '</ol></div>';
  }
  function faceImg(fc, mood){
    try{ return typeof renderFace === 'function' ? renderFace({ faceColorIdx:fc }, mood) : ''; }catch(e){ return ''; }
  }
  function seat(o, kind){
    const mood = kind === 'out' ? 'dead1' : kind === 'killer' ? 'gloating1' : 'neutral1';
    const tag = kind === 'out' ? ord(o.place) + ' · H' + o.h : kind === 'killer' ? 'GOT YOU' : 'STILL IN';
    return '<li class="et-seat is-' + kind + (o.ko ? ' is-ko' : '') + '">' +
      '<span class="et-face">' + faceImg(o.fc, mood) + (o.ko ? '<i class="et-ko" aria-hidden="true"></i>' : '') + '</span>' +
      '<span class="et-name crt-caption">' + E(String(o.name || '').slice(0, 9)) + '</span>' +
      '<span class="et-tag crt-caption' + (kind === 'killer' ? ' crt-danger' : '') + '">' + E(tag) + '</span></li>';
  }
  function youSeat(place, won, me){
    return '<li class="et-seat is-you' + (won ? ' is-won' : ' is-dead') + '">' +
      '<span class="et-face et-you"><span class="crt-caption">YOU</span>' + (won ? '' : '<i class="et-x" aria-hidden="true"></i>') + '</span>' +
      '<span class="et-name crt-caption">' + (won ? 'WINNER' : 'YOU') + '</span>' +
      '<span class="et-tag crt-caption">' + E(ord(place)) + (!won && me ? ' · H' + me.h : '') + '</span></li>';
  }
  function bestHTML(best){
    if (!best){
      return '<div class="et-best pc-display crt" data-crt-quiet>' + head('BEST HAND') +
        '<span class="et-none crt-line">NO SHOWDOWN</span><span class="crt-caption">NOTHING TURNED OVER</span></div>';
    }
    let cards = '', cat = best.name, desc = '';
    try{
      const split = splitHandText(best.result.cat, best.name);
      cat = split.category; desc = split.descriptor || '';
      cards = arrangeHandForDisplay(best.result.cat, best.cards)
        .map(c => '<div class="' + cardClass(false, c, true) + '" aria-label="' + E(cardLabel(false, c)) + '">' + cardInner(c) + '</div>').join('');
    }catch(e){}
    return '<div class="et-best pc-display crt" data-crt-quiet>' + head('BEST HAND') +
      '<div class="crt-cards et-cards">' + cards + '</div>' +
      '<span class="crt-line et-best-name">' + E(String(cat).toUpperCase()) + '</span>' +
      (desc ? '<span class="crt-caption et-best-desc">' + E(desc) + '</span>' : '') + '</div>';
  }
  // Luck: how many all-ins you won against how many the odds said you
  // would. Only runouts count (an all-in called on the river had no luck
  // left in it).
  function luckOf(allins){
    const n = allins.length, exp = allins.reduce((s, a) => s + a.eq, 0), got = allins.reduce((s, a) => s + a.won, 0);
    const diff = got - exp;
    const word = !n ? 'NO ALL-INS' : diff <= -.9 ? 'RAN BAD' : diff <= -.35 ? 'BIT UNLUCKY' : diff < .35 ? 'FAIR' : diff < .9 ? 'BIT LUCKY' : 'RAN HOT';
    return { n, exp, got, diff, word };
  }
  // the verdict, a strip meter (BAD to HOT, lit out from the middle), and
  // the numbers; the LUCK look option shows some or all of them
  function luckHTML(allins){
    const L = luckOf(allins);
    const fmt = x => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return '<div class="et-luck pc-display crt" data-crt-quiet' + (L.n && L.diff <= -.35 ? ' data-ink="danger"' : L.n && L.diff >= .35 ? ' data-ink="money"' : '') + '>' +
      head('LUCK') +
      '<span class="crt-line et-luck-word">' + L.word + '</span>' +
      '<div class="et-strip"><span class="crt-caption">BAD</span><canvas class="et-gauge" aria-hidden="true" data-diff="' + (L.n ? L.diff.toFixed(3) : '') + '"></canvas><span class="crt-caption">HOT</span></div>' +
      (L.n ? '<span class="crt-caption et-luck-nums">WON ' + fmt(L.got) + ' OF ' + L.n + '</span><span class="crt-caption et-luck-nums">ODDS SAID ' + fmt(L.exp) + '</span>'
           : '<span class="crt-caption et-luck-nums">NO ALL-INS RAN OUT</span>') + '</div>';
  }

  /* The look: the owner's signed-off order (End Screens Lab round 3, 5 Oct
     2026): BIG DRUMS, NO FRAME · STANDARD spacing · FINISH on the bust-out
     screen · TALL tape · FACES ONLY · WORD + STRIP + NUMBERS · SE phones
     scroll. The lab still offers the other options. Set on <html> as
     data-es-*; css/result-cabinet.css reads them. */
  const LOOK = { bust:'faces', counter:'bare', space:'standard', luck:'both', tape:'tall', finish:'merged', se:'scroll' };
  function look(patch){
    const r = document.documentElement;
    Object.keys(LOOK).forEach(k => {
      const v = patch && patch[k] != null ? patch[k] : (r.getAttribute('data-es-' + k) || LOOK[k]);
      r.setAttribute('data-es-' + k, v);
    });
    try{ document.querySelectorAll('.et-well').forEach(w => paintStatic(w, w._etDetail)); }catch(e){}
  }

  /* ---------------- drawing ---------------- */
  function peakCeil(t, won){
    const peak = Math.max(...t.pts.map(p => p[1]), t.start);
    if (won) return t.total || peak;
    return Math.min(t.total || Infinity, Math.max(peak * 1.25, t.start * 2));
  }
  function inkOf(el, sel){
    const x = el.querySelector(sel);
    return x ? getComputedStyle(x).color : '#FF8A7A';
  }
  function fit(canvas){
    const r = canvas.getBoundingClientRect();
    const w = Math.max(20, Math.floor(r.width / P)), h = Math.max(12, Math.floor(r.height / P));
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    return [w, h];
  }
  // The tape up to `upto` hands (fractional: the pen mid-hand), in art pixels.
  function drawChart(canvas, d, upto, tail){
    const t = d.tape, won = !!d.won;
    const [W, H] = fit(canvas);
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, W, H);
    const root = canvas.closest('.et-chart');
    const ink = inkOf(root, '.crt-line'), dim = inkOf(root, '.crt-caption');
    const pts = t.pts, h0 = pts[0][0], h1 = pts[pts.length - 1][0];
    const span = Math.max(1, h1 - h0);
    const tailW = won ? 4 : Math.max(10, Math.round(W * .12));
    const L = 2, R = W - 2 - tailW, T = 3, B = H - 5;
    const yMax = peakCeil(t, won) || 1;
    const X = h => Math.round(L + (h - h0) / span * (R - L));
    const Y = v => Math.round(B - Math.max(0, Math.min(1, v / yMax)) * (B - T));
    const px = (col, x, y, w, hh) => { c.fillStyle = col; c.fillRect(x, y, w || 1, hh || 1); };
    // the grid: base line, start line (dashed), the ceiling, level changes
    for (let x = L; x <= W - 2; x += 2) px(dim, x, B + 1);
    const ys = Y(t.start);
    c.globalAlpha = .7; for (let x = L; x <= R; x += 4) px(dim, x, ys, 2, 1); c.globalAlpha = 1;
    if (yMax >= t.total){ c.globalAlpha = .55; for (let x = L; x <= W - 2; x += 3) px(dim, x, T); c.globalAlpha = 1; }
    for (let i = 1; i < pts.length; i++) if (pts[i][2] !== pts[i - 1][2]){
      const x = X(pts[i - 1][0]); c.globalAlpha = .35; for (let y = T; y <= B; y += 3) px(dim, x, y); c.globalAlpha = 1;
      px(dim, x - 1, B + 2, 3, 2);
    }
    // the trace, stepped: flat through a hand, then straight to the result
    const until = h0 + upto;
    let lastX = X(h0), lastY = Y(pts[0][1]);
    const fill = [];
    for (let i = 1; i < pts.length; i++){
      const [h, v] = pts[i];
      const xa = X(pts[i - 1][0]), xb = X(h), ya = Y(pts[i - 1][1]), yb = Y(v);
      if (pts[i - 1][0] >= until) break;
      const k = Math.min(1, (until - pts[i - 1][0]) / Math.max(1e-6, h - pts[i - 1][0]));
      const xe = Math.round(xa + (xb - xa) * k);
      for (let x = xa; x <= xe; x++){ px(ink, x, ya); fill.push([x, ya]); }
      lastX = xe; lastY = ya;
      if (k >= 1){
        for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) px(ink, xb, y);
        lastX = xb; lastY = yb;
      }
    }
    // a faint wash under the trace
    c.globalAlpha = .16; fill.forEach(([x, y]) => px(ink, x, y + 1, 1, Math.max(0, B - y))); c.globalAlpha = 1;
    // the peak flag
    const peak = pts.reduce((m, p) => p[1] > m[1] ? p : m, pts[0]);
    if (peak[0] > h0 && peak[0] <= until && !(won && peak[1] >= t.total)){
      const x = X(peak[0]), y = Y(peak[1]);
      px(ink, x, y - 6, 1, 6); px(ink, x + 1, y - 6, 3, 1); px(ink, x + 1, y - 5, 2, 1);
    }
    // your K.O.s: a little burst on the trace
    t.out.filter(o => o.ko && o.h <= until).forEach(o => {
      const p = pts.find(q => q[0] === o.h); if (!p) return;
      const x = X(o.h), y = Y(p[1]) - 4;
      [[0, -2], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [0, 2]].forEach(([a, b]) => px(ink, x + a, y + b));
      px('#FFF6E0', x, y);
    });
    // the end: a flatline to the edge, or the ceiling
    const done = upto >= span;
    if (done && !won){
      const tx = Math.round(X(h1) + (W - 2 - X(h1)) * Math.max(0, Math.min(1, tail)));
      for (let x = X(h1); x <= tx; x++) px(ink, x, B);
      if (tail > 0){ px('#FFF6E0', tx, B - 1, 2, 2); }
    } else if (done && won){
      [[-3, -2], [3, -2], [0, -3], [-2, 2], [2, 2]].forEach(([a, b]) => px('#FFF6E0', lastX + a, lastY + 2 + b));
    } else if (upto > 0){
      px('#FFF6E0', lastX, lastY - 1, 2, 2);        // the pen
    }
  }
  function drawGauge(canvas){
    const [W, H] = fit(canvas);
    const c = canvas.getContext('2d'); c.clearRect(0, 0, W, H);
    const root = canvas.closest('.et-luck');
    const ink = inkOf(root, '.crt-line'), dim = inkOf(root, '.crt-caption');
    const raw = canvas.dataset.diff, has = raw !== '' && raw != null;
    const diff = has ? Math.max(-1.5, Math.min(1.5, +raw)) : 0;
    // 15 cells; the middle one is FAIR; lit from the middle out to the reading
    const N = 15, mid = 7, gap = 1, cw = Math.max(2, Math.floor((W - gap * (N - 1)) / N));
    const x0 = Math.floor((W - (cw * N + gap * (N - 1))) / 2), y = 1, h = Math.max(3, H - 2);
    const reach = has ? Math.round(diff / 1.5 * mid) : 0;
    for (let i = 0; i < N; i++){
      const k = i - mid;
      const lit = has && (k === 0 || (reach < 0 ? k < 0 && k >= reach : k > 0 && k <= reach));
      c.fillStyle = lit ? ink : dim; c.globalAlpha = lit ? 1 : .28;
      c.fillRect(x0 + i * (cw + gap), y, cw, h);
    }
    c.globalAlpha = 1;
    c.fillStyle = dim; c.fillRect(x0 + mid * (cw + gap) + Math.floor(cw / 2), 0, 1, 1);
  }

  /* ---------------- the wake: the pen runs ---------------- */
  let beeper = null;
  function beep(on){
    try{
      if (!on){ if (beeper){ beeper.g.gain.setTargetAtTime(0.0001, beeper.ctx.currentTime, .05); beeper.o.stop(beeper.ctx.currentTime + .3); beeper = null; } return; }
      if (typeof settings !== 'undefined' && !settings.sound) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = beep.ctx || (beep.ctx = new AC());
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 988;
      g.gain.setValueAtTime(.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.022, ctx.currentTime + .02);
      o.connect(g).connect(ctx.destination); o.start();
      beeper = { ctx, o, g };
    }catch(e){}
  }
  const sfx = (name, ...a) => { try{ if (typeof Sound !== 'undefined' && Sound[name]) Sound[name](...a); }catch(e){} };
  function paintStatic(el, d){
    const chart = el.querySelector('.et-canvas');
    if (chart && d && d.tape) drawChart(chart, d, 1e9, 1);
    el.querySelectorAll('.et-gauge').forEach(drawGauge);
  }
  async function wake(el, d){
    if (!el || !d || !d.tape) return;
    const well = el.querySelector('.et-well'); if (!well) return;
    well._etDetail = d;
    const chart = well.querySelector('.et-canvas');
    well.querySelectorAll('.et-gauge').forEach(drawGauge);
    const t = d.tape, span = Math.max(1, t.pts[t.pts.length - 1][0] - t.pts[0][0]);
    const redraw = () => { if (chart && chart.isConnected) paintStatic(well, d); };
    addEventListener('resize', redraw);
    if (quiet() || !chart){ paintStatic(well, d); return; }
    const dur = Math.max(1100, Math.min(2600, 500 + span * 80));
    const FR = 1000 / 20;
    const t0 = performance.now();
    let lastH = -1;
    const kos = new Set(t.out.filter(o => o.ko).map(o => o.h - t.pts[0][0]));
    await new Promise(res => {
      const tick = now => {
        if (!chart.isConnected){ res(); return; }
        const el_ = Math.floor((now - t0) / FR) * FR, f = Math.min(1, el_ / dur);
        const upto = f * span;
        drawChart(chart, d, upto, 0);
        const hNow = Math.floor(upto);
        if (hNow !== lastH){
          lastH = hNow;
          if (kos.has(hNow)) sfx('koThunk', .6); else sfx('counterTick');
        }
        if (f < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    if (!chart.isConnected) return;
    if (d.won){
      sfx('counterLock');
      drawChart(chart, d, span, 1);
      return;
    }
    // the flatline runs to the edge with its tone
    beep(true);
    const t1 = performance.now(), TAIL = 1100;
    await new Promise(res => {
      const tick = now => {
        if (!chart.isConnected){ res(); return; }
        const f = Math.min(1, Math.floor((now - t1) / (1000 / 20)) * (1000 / 20) / TAIL);
        drawChart(chart, d, span, f);
        if (f < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    beep(false);
  }

  install();
  try{ look(); }catch(e){}
  return { LOOK, look, afterHand, snapshot, clean, fixture, html, wake, paint:paintStatic, luckOf, noteRunout, isRunout };
})();
