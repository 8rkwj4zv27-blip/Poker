"use strict";

/* ============================================================
   COACH TALK (Coach Voice Lab, round 1: candidate, lab only)

   The coach speaks: a bubble from his little TV (the Speech Lab's card-
   stock bubble, typed on and growing to fit, or a dark-screen version in
   his own ink), his mouth moving on the tube, and his own blip: low,
   steady, one note, so he never sounds like one of the opponents.

   He speaks on real moments in real hands (a light hook on the game's own
   functions): your cards dealt, an opponent raising, your turn, what you
   did, the end of the hand, someone going out. He has no poker judgement
   yet (that's the Coach's brain, later): every line is either a plain
   reaction or an exact fact from the game's own maths (where your hand
   ranks among starting hands, the price of a call).

   THE TALK SLIDER: every line has the lowest notch it plays at.
     1 COMMENTS    reactions only: a big pot, a bad one, going out
     2 DEBRIEF     + how a hand ended, all in, someone knocked out
     3 TIPS        + the price when you face a bet, strong starting hands
     4 IN YOUR EAR + every deal, every raise, every move you make
   One line at a time; a newer, more important line waits its turn and
   stale ones are dropped.

   Presentation only: reads public facts and your own cards, never an
   opponent's hidden cards. Not loaded by the game; coach-voice-lab.html
   injects it. CoachTalk.apply(order), CoachTalk.say(moment, ctx).
   ============================================================ */
const CoachTalk = (() => {
  const $id = id => document.getElementById(id);
  const motionOffSafe = () => { try{ return typeof motionOff === 'function' && motionOff(); }catch(e){ return false; } };

  /* ---------------- the order ---------------- */
  const OPTIONS = {
    notch:[['4', '4 · IN YOUR EAR'], ['3', '3 · TIPS'], ['2', '2 · DEBRIEF'], ['1', '1 · COMMENTS']],
    help:[['3', '3 · ADVICE'], ['4', '4 · TELL ME'], ['2', '2 · HINTS'], ['1', '1 · WATCH']],
    where:[['above', 'ABOVE HIM'], ['beside', 'BESIDE HIM'], ['across', 'ACROSS THE FELT']],
    look:[['card', 'CARD STOCK'], ['screen', 'HIS SCREEN']],
    textIn:[['type', 'TYPES ON'], ['all', 'ALL AT ONCE']],
    arrive:[['pop', 'POPS'], ['rise', 'RISES UP']],
    hold:[['normal', 'NORMAL'], ['short', 'SHORT'], ['long', 'LONG']],
    voice:[['steady', 'STEADY PIP'], ['tick', 'TELEPRINTER'], ['two', 'TWO NOTES'], ['hum', 'LOW HUM']],
    pitch:[['low', 'LOW'], ['mid', 'MIDDLE'], ['deep', 'DEEPER']],
    often:[['other', 'EVERY OTHER LETTER'], ['letter', 'EVERY LETTER'], ['syllable', 'EVERY SYLLABLE']],
    pace:[['normal', 'NORMAL'], ['slow', 'SLOWER'], ['fast', 'FASTER']],
    volume:[['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH'], ['silent', 'SILENT']],
    mouth:[['blip', 'OPENS ON EACH BLIP'], ['open', 'OPEN WHILE HE TALKS'], ['still', 'STAYS STILL']],
    type:[['mixed', 'NUMBERS + CARDS IN THE SCREEN FONT'], ['numbers', 'NUMBERS ONLY'], ['screen', 'ALL IN THE SCREEN FONT'], ['screenlc', 'SCREEN FONT, UPPER + LOWER CASE'], ['pixel', 'ROUND 1']]
  };
  // The owner's picks (Voice Lab round 1, 29 Sep 2026)
  const DEFAULTS = { notch:'4', help:'3', where:'across', look:'screen', textIn:'type', arrive:'pop', hold:'normal',
    voice:'tick', pitch:'low', often:'other', pace:'fast', volume:'medium', mouth:'blip', type:'mixed' };
  let O = Object.assign({}, DEFAULTS);
  function apply(order){ O = Object.assign({}, DEFAULTS, order || {}); }
  // (the game keeps the notch in settings; apply() from a lab overrides it)

  /* ---------------- the lines ----------------
     Flat and plain (the owner's brief): clear, informative, the odd short
     reaction, never a nickname for the player, no catchphrases. Each is
     [notch, mood, text]; {slots} are filled from the game. */
  const LINES = {
    dealtPremium:[[3, 'pleased', '{hole}. That’s in the top {pct}% of starting hands.'], [3, 'pleased', '{hole}. A hand worth playing properly.'], [3, 'impressed', '{hole}. You won’t see many better than that.']],
    dealtStrong:[[4, 'calm', '{hole}. Better than most. Top {pct}%.'], [4, 'pleased', '{hole}. A good start.']],
    dealtMiddle:[[4, 'calm', '{hole}. Playable, depending on what happens before you.'], [4, 'thinking', '{hole}. Middle of the pack. Top {pct}%.']],
    dealtWeak:[[4, 'calm', '{hole}. Most of the time this one gets folded.'], [4, 'calm', '{hole}. Bottom half of starting hands.'], [4, 'wince', '{hole}. Not much to work with.']],
    oppRaise:[[4, 'thinking', '{name} has raised. That usually means a decent hand.'], [4, 'calm', '{name} raised to {amt}. Worth noting.']],
    oppBigBet:[[3, 'thinking', '{name} bet big. Big bets tend to mean strong hands.'], [3, 'surprised', 'That’s a big bet from {name}.']],
    oppAllIn:[[2, 'surprised', '{name} is all in.'], [2, 'thinking', '{name} has put everything in.']],
    yourPrice:[[3, 'thinking', '{call} to call, {pot} in the pot. You’d need to win about {odds}% of the time.'], [3, 'calm', 'It costs {call}. The pot’s {pot}. That’s the price.']],
    yourFree:[[4, 'calm', 'Nobody’s bet. You can check for free.'], [4, 'calm', 'Your turn. Checking costs nothing here.']],
    youFold:[[4, 'calm', 'Folded. Fine.'], [4, 'calm', 'Out of this one.']],
    youCall:[[4, 'calm', 'Called.'], [4, 'thinking', 'Called. Let’s see the next card.']],
    youRaise:[[4, 'pleased', 'Raised. Let’s see who comes along.'], [4, 'calm', 'You’ve raised to {amt}.']],
    youAllIn:[[2, 'surprised', 'All in. No going back now.'], [2, 'thinking', 'Everything’s in the middle.']],
    winBig:[[1, 'impressed', 'Nice pot.'], [1, 'pleased', 'That’s a good one. {won} to you.'], [1, 'impressed', 'Well played. That was a big pot.']],
    winSmall:[[2, 'pleased', 'Took it down.'], [2, 'calm', 'Small pot, but it’s yours.']],
    allFolded:[[2, 'pleased', 'They all folded. Sometimes a bet is enough.'], [2, 'calm', 'No callers. That’s yours.']],
    loseShowdown:[[1, 'unlucky', 'Didn’t go your way.'], [1, 'unlucky', 'They had it that time.']],
    loseBig:[[1, 'wince', 'That one hurt.'], [1, 'unlucky', 'Unlucky. That was a lot of chips.']],
    oppOut:[[2, 'calm', '{name}’s out.'], [2, 'pleased', 'That’s {name} gone.']],
    youOut:[[1, 'unlucky', 'That’s the run over. We’ll go again.'], [1, 'unlucky', 'Out. It happens.']]
  };
  const lastUsed = {};
  function pick(moment){
    const pool = (LINES[moment] || []).filter(l => l[0] <= +O.notch);
    if (!pool.length) return null;
    // no line twice in a row for the same moment
    const fresh = pool.filter(l => l[2] !== lastUsed[moment]);
    const l = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh : pool).length)];
    lastUsed[moment] = l[2];
    return l;
  }
  // blanks fill in lower case ("one player", "a flush draw"); a sentence
  // that starts with one gets its capital back
  const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null ? ctx[k] : m)
    .replace(/(^|[.?!]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
  /* TYPE: the numbers and the card names are what he's telling you, so by
     default they're set in the machine's screen font (Press Start 2P, the
     buttons' and CRTs' face), which reads far better at this size; the
     words stay in the pixel face. The line is split into runs; typing
     reveals it a character at a time across the runs. */
  const CARDWORDS = /\b(?:Pocket (?:Twos|Threes|Fours|Fives|Sixes|Sevens|Eights|Nines|Tens|Jacks|Queens|Kings|Aces)|(?:Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Jack|Queen|King|Ace)-(?:Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Jack|Queen|King|Ace) (?:suited|offsuit))\b/g;
  function runs(text){
    const out = [];
    const re = new RegExp(CARDWORDS.source + '|\\d[\\d,]*(?:\\.\\d+)?%?', 'g');
    let last = 0, m;
    while ((m = re.exec(text))){
      if (m.index > last) out.push({ t:text.slice(last, m.index), key:false });
      out.push({ t:m[0], key:/\d/.test(m[0][0]) ? 'num' : 'card' });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t:text.slice(last), key:false });
    return out;
  }
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  function htmlUpTo(rs, n){
    let left = n, html = '';
    for (const r of rs){
      if (left <= 0) break;
      const part = r.t.slice(0, left); left -= part.length;
      html += r.key ? '<b class="ctk-key ctk-' + r.key + '">' + esc(part) + '</b>' : esc(part);
    }
    return html;
  }

  /* ---------------- his voice ----------------
     A warm square pip through a low filter, like the opponents' shared
     core but lower and steadier. The letter-by-letter timing is the
     Speech Lab's plan (pauses at commas and full stops), so the typing,
     the blips and his mouth share one clock. */
  let actx = null, bus = null;
  const soundOn = () => { try{ return !!settings.sound; }catch(e){ return true; } };
  function ac(){
    if (!soundOn()) return null;
    if (!actx){ try{ const AC = window.AudioContext || window.webkitAudioContext; actx = AC ? new AC() : null; }catch(e){ actx = null; }
      if (actx){ bus = actx.createDynamicsCompressor(); bus.threshold.value = -18; bus.ratio.value = 4; bus.connect(actx.destination); } }
    if (actx && actx.state === 'suspended'){ try{ actx.resume(); }catch(e){} }
    return actx;
  }
  ['touchend', 'click'].forEach(ev => addEventListener(ev, () => ac(), { passive:true }));
  const LEVEL = { low:.3, medium:.5, high:.8, silent:0 };
  const BASE = { low:220, mid:290, deep:165 };
  const PACE = { normal:34, slow:44, fast:26 };
  function plan(text){
    const per = PACE[O.pace] || 34, times = []; let t = 0;
    for (let i = 0; i < text.length; i++){
      times.push(t);
      const ch = text[i];
      t += ch === ' ' ? per * .6 : per;
      if (/[,;]/.test(ch)) t += per * 3;
      if (/[.!?]/.test(ch) && i < text.length - 1) t += per * 5;
    }
    return { times, total:t };
  }
  function beats(text){
    const out = [];
    if (O.often === 'syllable'){ const re = /[aeiouy]+/gi; let m; while ((m = re.exec(text))) out.push(m.index); return out; }
    let n = 0;
    for (let k = 0; k < text.length; k++){ if (!/[a-z0-9]/i.test(text[k])) continue; if (O.often === 'letter' || n % 2 === 0) out.push(k); n++; }
    return out;
  }
  function blip(c, t, f, v, i){
    const env = (peak, a, len) => { const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + len); g.connect(bus); return g; };
    const osc = (type, fr, g, len) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(fr, t); o.connect(g); o.start(t); o.stop(t + len + .02); return o; };
    if (O.voice === 'tick'){
      const n = Math.floor(c.sampleRate * .01), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 3);
      const s = c.createBufferSource(); s.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.4;
      const g = env(.45 * v, .002, .02); s.connect(bp).connect(g); s.start(t);
      osc('square', f, env(.12 * v, .002, .03), .03);
    } else if (O.voice === 'hum'){
      const g = env(.5 * v, .012, .075); const o = osc('sine', f * .9, g, .075); o.frequency.linearRampToValueAtTime(f * .86, t + .07);
      osc('triangle', f * 1.8, env(.08 * v, .012, .05), .05);
    } else {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = env(.3 * v, .005, .055); lp.connect(g);
      const o = c.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(O.voice === 'two' ? (i % 2 ? f * 1.19 : f) : f, t); o.connect(lp); o.start(t); o.stop(t + .08);
    }
  }
  function speakSound(text){
    const v = LEVEL[O.volume]; if (!(v > 0)) return;
    const c = ac(); if (!c) return;
    const { times } = plan(text), f = BASE[O.pitch] || 220, t0 = c.currentTime + .03;
    // one note: the last blip of a question lifts a little, that's all
    const list = beats(text);
    list.forEach((k, i) => { const up = i >= list.length - 2 && /\?\s*$/.test(text) ? 1.12 : 1; try{ blip(c, t0 + times[k] / 1000, f * up, v, i); }catch(e){} });
  }

  /* ---------------- the bubble ---------------- */
  let live = null, queue = null;
  function clear(now){
    if (!live) return;
    const l = live; live = null;
    l.timers.forEach(clearTimeout);
    try{ CoachSet.mouth(false); }catch(e){}
    if (now || motionOffSafe()) l.el.remove();
    else { l.el.classList.add('is-out'); setTimeout(() => l.el.remove(), 180); }
    // anything waiting goes next
    if (queue && !now){ const q = queue; queue = null; if (performance.now() - q.at < 4500) setTimeout(() => show(q.line, q.ctx, q.moment), 350); }
  }
  function place(el){
    const tv = $id('coach-station'), felt = $id('felt');
    if (!tv || !felt) return;
    const t = tv.getBoundingClientRect(), f = felt.getBoundingClientRect();
    const onRight = t.left + t.width / 2 > f.left + f.width / 2;
    const pad = 12, gap = 10;
    el.classList.toggle('is-left', !onRight);
    el.style.maxWidth = '';
    if (O.where === 'beside'){
      // on the table side of him, level with his screen, clear of your cards
      const right = onRight ? t.left - gap : f.right - pad, left = onRight ? f.left + pad : t.right + gap;
      el.style.maxWidth = Math.max(120, right - left) + 'px';
      el.dataset.tail = onRight ? 'right' : 'left';
      const w = el.offsetWidth, h = el.offsetHeight;
      el.style.left = Math.round(onRight ? right - w : left) + 'px';
      el.style.top = Math.round(Math.max(f.top + pad, t.top + t.height * .32 - h / 2)) + 'px';
    } else {
      const left = f.left + pad, right = f.right - pad;
      el.style.maxWidth = (O.where === 'across' ? right - left : Math.round((right - left) * .78)) + 'px';
      if (O.where === 'across') el.style.width = (right - left) + 'px'; else el.style.width = '';
      el.dataset.tail = 'down';
      const w = el.offsetWidth, h = el.offsetHeight;
      const x = O.where === 'across' ? left : onRight ? Math.max(left, t.right - w) : Math.min(right - w, t.left);
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(t.top - gap - h) + 'px';
      // the tail sits over his screen
      el.style.setProperty('--ctk-tail-x', Math.round(Math.min(w - 22, Math.max(10, t.left + t.width * .42 - x))) + 'px');
    }
  }
  // a lab's explanation holds the floor: the live table's lines wait
  let holdUntil = 0, holding = false;
  function show(line, ctx, moment){
    if (!line) return;
    if (!holding && performance.now() < holdUntil) return;
    try{ if (!CoachSet.on || CoachSet.busy) return; }catch(e){ return; }
    if (live){
      // one at a time: keep the most important waiting line (lower notch wins)
      if (!queue || line[0] <= queue.line[0]) queue = { line, ctx, moment, at:performance.now() };
      return;
    }
    const text = fill(line[2], ctx || {});
    const el = document.createElement('div');
    el.className = 'ctk ctk--' + O.look + ' ctk-arrive-' + O.arrive + ' ctk-type-' + O.type;
    const rs = runs(text);
    el.setAttribute('role', 'status');
    el.dataset.moment = moment || '';
    el.innerHTML = '<div class="ctk-text"><span class="ctk-said"></span><span class="ctk-rest"></span></div><i class="ctk-tail" aria-hidden="true"></i>';
    const typed = O.textIn === 'type' && !motionOffSafe();
    // lay out on the finished line, then type into it (it grows as it types)
    el.querySelector('.ctk-said').innerHTML = htmlUpTo(rs, text.length);
    ($id('app') || document.body).appendChild(el);
    place(el);
    if (typed){ el.querySelector('.ctk-said').innerHTML = ''; el.querySelector('.ctk-rest').textContent = text; el.classList.add('is-typing'); }
    try{ CoachSet.setMood(line[1]); }catch(e){}
    const p = plan(text);
    const hold = ({ short:.6, normal:1, long:1.6 })[O.hold] * Math.min(6000, 1800 + text.length * 45);
    const l = live = { el, timers:[] };
    const lead = motionOffSafe() ? 0 : 140;
    l.timers.push(setTimeout(() => speakSound(text), lead));
    if (typed){
      const said = el.querySelector('.ctk-said'), rest = el.querySelector('.ctk-rest');
      p.times.forEach((ms, i) => l.timers.push(setTimeout(() => { said.innerHTML = htmlUpTo(rs, i + 1); rest.textContent = text.slice(i + 1); }, lead + ms)));
    }
    // his mouth
    if (O.mouth === 'blip'){
      beats(text).forEach(k => {
        l.timers.push(setTimeout(() => { try{ CoachSet.mouth(true); }catch(e){} }, lead + p.times[k]));
        l.timers.push(setTimeout(() => { try{ CoachSet.mouth(false); }catch(e){} }, lead + p.times[k] + 60));
      });
    } else if (O.mouth === 'open'){
      l.timers.push(setTimeout(() => { try{ CoachSet.mouth(true); }catch(e){} }, lead));
      l.timers.push(setTimeout(() => { try{ CoachSet.mouth(false); }catch(e){} }, lead + (typed ? p.total : 600)));
    }
    l.timers.push(setTimeout(() => { if (live === l) clear(false); }, lead + (typed ? p.total : 0) + hold));
    l.timers.push(setTimeout(() => { try{ if (live === l) CoachSet.setMood('calm'); }catch(e){} }, lead + (typed ? p.total : 0) + hold - 200));
    el.addEventListener('click', () => clear(false));
    requestAnimationFrame(() => el.classList.add('is-in'));
  }
  /* A judged line: its notch comes from the verdict's confidence, not the
     line. First key that has lines wins (e.g. 'x.now.leans', then 'x.now'). */
  function lineFor(keys){
    for (const k of keys){
      const pool = LINES[k] || [];
      if (!pool.length) continue;
      const fresh = pool.filter(l => l[2] !== lastUsed[k]);
      const l = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh : pool).length)];
      lastUsed[k] = l[2];
      return l;
    }
    return null;
  }
  function sayAt(keys, ctx, notch, lead, tail){
    if (notch > +O.notch) return false;
    const l = lineFor(keys); if (!l) return false;
    let text = l[2];
    if (lead){ const ll = lineFor([lead]); if (ll) text = ll[2] + ' ' + text; }
    if (tail){ const tl = lineFor([tail]); if (tl) text = text + ' ' + tl[2]; }
    try{ document.dispatchEvent(new CustomEvent('coachtalk', { detail:{ moment:keys[0], notch:+O.notch } })); }catch(e){}
    show([notch, l[1], text], ctx || {}, keys[0]);
    return true;
  }
  function say(moment, ctx){
    // (the lab listens for this to show what he tried to say and why not)
    try{ document.dispatchEvent(new CustomEvent('coachtalk', { detail:{ moment, notch:+O.notch } })); }catch(e){}
    show(pick(moment), ctx || {}, moment);
  }
  // for the lab: say a moment's line whatever the notch
  function sayAny(moment, ctx){
    const pool = LINES[moment] || []; if (!pool.length) return;
    const l = pool[Math.floor(Math.random() * pool.length)];
    clear(true); queue = null; show(l, ctx || {}, moment);
  }

  /* ---------------- hearing the game ----------------
     Public facts only, plus your own cards. */
  const fmt = n => Math.round(n).toLocaleString();
  const human = () => (game && game.players || []).find(p => p.isHuman);
  function holeCtx(){
    const me = human(); if (!me || !me.hand || me.hand.length < 2) return null;
    let pct = 50;
    try{ pct = preflopPercentile(me.hand) * 100; }catch(e){}
    return { hole:describeHole(me.hand), pct:Math.max(1, Math.round(pct)), p:pct / 100, pair:me.hand[0].value === me.hand[1].value };
  }
  function ctxNow(extra){
    const g = game || {}, me = human() || {};
    const call = Math.max(0, (g.currentBet || 0) - (me.betThisRound || 0));
    return Object.assign({ call:fmt(call), pot:fmt(g.pot || 0), odds:call ? Math.round(call / ((g.pot || 0) + call) * 100) : 0 }, extra || {});
  }
  /* ---------------- his brain speaking (docs/coach/BRAIN_PLAN.md) ----------------
     A word right after you act (only when it's worth one), and the reason
     after the hand. Judged lines take their notch from the verdict:
       a clear mistake      1 COMMENTS    ("Too loose from there.")
       a notable good play  2 DEBRIEF     ("Good fold.")
       a lean either way    3 TIPS
       the reasons          2 DEBRIEF, and close calls at 4 IN YOUR EAR
     One word a hand at most; praise is rationed so it stays worth hearing. */
  const SEAT_ON = { BTN:'on the button', CO:'in the cutoff', HJ:'in the hijack', LJ:'in the lojack', UTG:'under the gun',
    'UTG+1':'in early position', 'UTG+2':'in early position', SB:'in the small blind', BB:'in the big blind' };
  const SEAT_FROM = { BTN:'from the button', CO:'from the cutoff', HJ:'from the hijack', LJ:'from the lojack', UTG:'from under the gun',
    'UTG+1':'from early position', 'UTG+2':'from early position', SB:'from the small blind', BB:'from the big blind' };
  const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const players = n => (NUMW[n] || n) + (n === 1 ? ' player' : ' players');
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  function slots(sp, j){
    const n = (j && j.n) || {}, seat = (sp && sp.seat) || n.seat;
    return {
      hole: sp ? sp.holeFacts.name : '', pct: n.pct != null ? n.pct : sp ? Math.max(1, Math.round(sp.holeFacts.pct * 100)) : '',
      range: n.range != null ? n.range : '', seatOn: SEAT_ON[seat] || 'here', seatFrom: SEAT_FROM[seat] || 'from here',
      SeatFrom: cap(SEAT_FROM[seat] || 'from here'), behindP: players(sp ? sp.actingAfter : 0),
      bb: n.bb != null ? n.bb : '', size: n.size != null ? n.size : '', call: fmt(n.call || 0), odds: n.odds != null ? n.odds : '',
      eq: n.eq != null ? n.eq : '', need: n.need != null ? n.need : '', raiser: n.raiser || 'they', limpersP: players(n.limpers || 0),
      raiserFrom: SEAT_FROM[n.raiserSeat] || 'from there',
      // after the flop
      bettor: n.bettor || 'they', betSize: n.betSize || 'a bet', handName: n.handName || (sp && sp.holeFacts ? sp.holeFacts.name : ''),
      drawName: n.drawName || 'a draw', DrawName: cap(n.drawName || 'a draw'), outs: n.outs != null ? n.outs : '', hitNext: n.hitNext != null ? n.hitNext : '', pot: fmt(n.pot != null ? n.pot : sp ? sp.pot : 0)
    };
  }
  const MOVE_WORD = { fold:'fold', check:'check', call:'call', raise:'raise', allin:'go all in' };

  /* ---------------- advice before you act (the HELP dial) ----------------
     HELP 1 WATCH: none. 2 HINTS: what to think about, not the move.
     3 ADVICE: the move and why; a lean says so; a close one says it's close.
     4 TELL ME: always the move, with the numbers and the size.
     Unprompted, it plays at TIPS (3) on the big decisions (a raise to face,
     a short stack, a premium hand, anything not clear-cut) and at IN YOUR
     EAR (4) on every decision bar folding junk. Tapping him always gets it. */
  function adviceCtx(a, sp){
    return Object.assign(slots(sp, a.judgement), { to: a.to ? fmt(a.to) : '', toBB: a.toBB,
      lean: MOVE_WORD[a.move], alt: MOVE_WORD[a.alt] || '', Lean: cap(MOVE_WORD[a.move]), Alt: cap(MOVE_WORD[a.alt] || '') });
  }
  function sayAdvice(a, sp, help, notch){
    const ctx = adviceCtx(a, sp);
    if (help <= 1) return false;
    const drawing = a.kind === 'post' && a.n && a.n.drawName && !['overpair', 'top-pair', 'two-pair', 'set', 'trips', 'straight', 'flush', 'full-house', 'quads', 'straight-flush'].includes(a.n.made);
    if (help === 2) return sayAt(drawing ? ['hint.post.draw', 'hint.post'] : ['hint.' + a.kind], ctx, notch);
    const key = drawing ? ['advise.post.' + a.move + '.draw', 'advise.post.' + a.move] : ['advise.' + a.kind + '.' + a.move];
    if (help === 3 && a.sure === 'close' && a.alt) return sayAt(['advise.close'], ctx, notch);
    return sayAt(key, ctx, notch, null, a.sure === 'leans' ? 'advise.tail.leans' : a.sure === 'close' ? 'advise.tail.leans' : null);
  }
  const A = { handNo:-1, advice:null, spot:null };
  function yourTurn(me){
    const g = game;
    if (typeof CoachBrain === 'undefined' || !['preflop', 'flop', 'turn', 'river'].includes(g.phase)) return false;
    // (after the flop he advises when you face a bet; betting is step 3b)
    const sp = CoachBrain.spot(g, me), a = CoachBrain.advise(sp);
    A.handNo = g.handNumber; A.advice = a; A.spot = sp;
    if (!a) return false;
    const help = +O.help, talk = +O.notch;
    if (help <= 1 || talk < 3) return false;
    const junkFold = a.kind !== 'post' && a.move === 'fold' && a.sure === 'clear' && sp.holeFacts.pct > 0.5;
    const big = ['vsRaise', 'vsReraise', 'short', 'post'].includes(a.kind) || sp.holeFacts.pct < 0.06 || a.sure !== 'clear';
    if (junkFold || (talk < 4 && !big)) return false;
    if (live && !live.judged) clear(true);
    return sayAdvice(a, sp, help, 3);
  }

  /* ---------------- tap him: his read, now ----------------
     Your turn before the flop: his advice in full (whatever the dial).
     Your turn after the flop: what you have, what you're drawing to and
     your chance, the price. Not your turn: the read without the price.
     Between hands: the last hand's lesson. Tap again soon after: a layer
     deeper (the lesson, or the term explained). */
  const T = { at:0, step:0, topic:null };
  const DRAW_NAME = d => d.flush && (d.oesd || d.gutshot) ? 'a flush and straight draw' : d.flush ? 'a flush draw' : d.oesd ? 'an open-ended straight draw' : d.gutshot ? 'an inside straight draw' : null;
  function sayText(text, mood, ctx, moment){
    clear(true); queue = null;
    try{ document.dispatchEvent(new CustomEvent('coachtalk', { detail:{ moment, notch:+O.notch } })); }catch(e){}
    show([1, mood || 'calm', text], ctx || {}, moment);
  }
  const textOf = (key, ctx) => { const l = lineFor([key]); return l ? { text:fill(l[2], ctx), mood:l[1] } : null; };
  function tapRead(me){
    const g = game;
    const sp = CoachBrain.spot(g, me);
    if (!sp) return null;
    const r = CoachBrain.readNow(sp), mine = pendingHumanPlayer === me;
    const ctx = Object.assign(slots(sp, null), { call:fmt(r.toCall), pot:fmt(r.pot), odds:r.odds });
    const parts = [];
    if (r.street === 'preflop'){
      if (mine){ const a = CoachBrain.advisePreflop(sp); if (a){ A.advice = a; A.spot = sp; A.handNo = g.handNumber;
        const c = adviceCtx(a, sp); const t = textOf(a.sure === 'close' && a.alt ? 'advise.close' : 'advise.' + a.kind + '.' + a.move, c);
        if (t) parts.push(t); return { parts, topic:a.lesson ? 'lesson.' + a.lesson : null }; } }
      const t = textOf('read.pre.wait', ctx); if (t) parts.push(t);
      return { parts, topic:'explain.position' };
    }
    const made = r.boardPlays ? 'boardPlays' : ['straight', 'flush', 'full-house', 'quads', 'straight-flush'].includes(r.made) ? 'big' : r.made;
    const m = textOf('read.made.' + made, Object.assign({}, ctx, { handName:r.handName }));
    if (m) parts.push(m);
    const dn = DRAW_NAME(r.draws || {});
    if (dn && r.left){
      const d = textOf('read.draw', Object.assign({}, ctx, { drawName:dn, DrawName:cap(dn), outs:r.drawOuts, hitPct:r.hitPct, byWhen: r.left === 2 ? 'by the river' : 'on the river' }));
      if (d) parts.push(d);
    }
    let topic = dn ? 'explain.outs' : r.made === 'top-pair' ? 'explain.kicker' : 'explain.equity';
    const adv = mine && r.toCall > 0 ? CoachBrain.advise(sp) : null;
    if (adv){
      // a bet in front of you: what he'd do (with the numbers) takes the price's place
      A.advice = adv; A.spot = sp; A.handNo = g.handNumber;
      const c = adviceCtx(adv, sp);
      const drawing = adv.n && adv.n.drawName && dn;
      const t = textOf(adv.sure === 'close' && adv.alt ? 'advise.close' : drawing && LINES['advise.post.' + adv.move + '.draw'] ? 'advise.post.' + adv.move + '.draw' : 'advise.post.' + adv.move, c);
      if (t) parts.push(t);
      topic = 'lesson.' + (adv.lesson || 'pot-odds');
    } else if (mine){
      if (r.toCall > 0 && dn && r.left){
        const hitNext = Math.round(r.drawOuts / (52 - 2 - sp.board.length) * 100);
        const dp = textOf('read.drawprice', Object.assign({}, ctx, { hitNext })); if (dp) parts.push(dp);
        topic = 'explain.potodds';
      } else {
        const p = textOf(r.toCall > 0 ? 'read.price.bet' : 'read.price.free', ctx); if (p) parts.push(p);
        if (r.toCall > 0) topic = 'explain.potodds';
      }
    }
    if (r.threats && r.threats.length && parts.length < 3){ const t = textOf('read.threat', Object.assign({}, ctx, { threat:r.threats[0] })); if (t) parts.push(t); }
    return { parts, topic };
  }
  function onTap(){
    try{ if (!CoachSet.on || CoachSet.busy) return; }catch(e){ return; }
    const g = game, me = human();
    const now = performance.now();
    const again = now - T.at < 12000 && T.topic;
    T.at = now;
    try{ CoachSet.look('you'); }catch(e){}
    if (again && T.step === 0){
      T.step = 1;
      const t = textOf(T.topic, {}); if (t){ sayText(t.text, t.mood, {}, T.topic); return; }
    }
    T.step = 0;
    const inHand = g && me && me.inHand && !me.folded && me.hand && me.hand.length === 2 && ['preflop', 'flop', 'turn', 'river'].includes(g.phase);
    if (inHand){
      const r = tapRead(me);
      if (r && r.parts.length){ T.topic = r.topic; sayText(r.parts.map(p => p.text).join(' '), r.parts[0].mood, {}, 'tap.read'); return; }
    }
    if (g && me && me.folded && ['preflop', 'flop', 'turn', 'river'].includes(g.phase)){
      const t = textOf('read.pre.out', {}); T.topic = null; if (t) sayText(t.text, t.mood, {}, 'tap.out'); return;
    }
    // between hands: the last hand's most useful lesson
    try{
      const h = CoachBrain.history[CoachBrain.history.length - 1];
      const judged = h ? h.decisions.filter(d => d.judgement) : [];
      const top = judged.length ? judged.reduce((a, d) => SCORE(d.judgement) > SCORE(a.judgement) ? d : a) : null;
      if (top && SCORE(top.judgement) >= 1){
        const j = top.judgement, lv = j.confidence === 'leans';
        const t = textOf(lv && LINES[j.tag + '.why.leans'] ? j.tag + '.why.leans' : j.tag + '.why', slots(top.spot, j));
        if (t){ T.topic = j.lesson ? 'lesson.' + j.lesson : null; sayText(t.text, t.mood, {}, 'tap.last'); return; }
      }
    }catch(e){}
    const t = textOf('read.between', {}); T.topic = null; if (t) sayText(t.text, t.mood, {}, 'tap.between');
  }
  const SCORE = j => !j ? 0 : j.verdict === 'mistake' ? (j.confidence === 'clear' ? 5 : j.confidence === 'leans' ? 4 : 1)
    : j.notable ? 3 : j.confidence === 'close' ? 1 : 0;
  const B = { handNo:-1, worded:false, praisedAt:-9, lessons:{}, told:{}, worded2:{} };
  /* right after you act: returns true if he said something */
  function wordNow(d){
    const j = d && d.judgement; if (!j) return false;
    const g = game || {};
    if (B.handNo !== g.handNumber){ B.handNo = g.handNumber; B.worded = false; }
    if (B.worded) return false;
    let notch = 0;
    if (j.verdict === 'mistake') notch = j.confidence === 'clear' ? 1 : j.confidence === 'leans' ? 3 : 0;
    else if (j.notable && j.confidence !== 'close'){
      // he told you to; no need to praise you for listening
      if (A.advice && A.handNo === g.handNumber && A.advice.move === (d.choice && d.choice.action)) return false;
      // praise: not every hand (rarer at the quieter notches)
      if (g.handNumber - B.praisedAt < (+O.notch >= 4 ? 2 : 4)) return false;
      notch = j.verdict === 'good' ? 2 : 3;
    }
    if (!notch) return false;
    // the same word again soon after is nagging: skip it (the reminder
    // comes after the hand instead)
    const last = B.worded2[j.tag];
    if (last != null && g.handNumber - last <= (j.confidence === 'clear' ? 2 : 4)) return false;
    const keys = j.confidence === 'leans' ? [j.tag + '.now.leans', j.tag + '.now'] : [j.tag + '.now'];
    if (!keys.some(k => (LINES[k] || []).length) || notch > +O.notch) return false;
    // what you just did outranks the line about your turn: it goes
    if (live && !live.judged) clear(true);
    if (!sayAt(keys, slots(d.spot, j), notch)) return false;
    if (live) live.judged = true;
    B.worded = true; B.worded2[j.tag] = g.handNumber;
    if (j.verdict !== 'mistake') B.praisedAt = g.handNumber;
    return true;
  }
  /* after the hand: the decision that most needs talking about, and the
     first time a lesson comes up, the lesson */
  function debrief(h){
    if (!h || !h.decisions || !h.end) return;
    const judged = h.decisions.filter(d => d.judgement);
    if (!judged.length) return;
    const top = judged.reduce((a, d) => SCORE(d.judgement) > SCORE(a.judgement) ? d : a);
    const j = top.judgement, sc = SCORE(j);
    if (!sc) return;
    const notch = sc === 1 ? 4 : 2;
    const net = h.end.net || 0;
    const lead = j.verdict === 'mistake' && sc >= 4 && net > 0 ? 'lead.wonAnyway'
      : j.verdict !== 'mistake' && sc >= 3 && net < 0 && h.end.showdown ? 'lead.lostAnyway' : null;
    // the same mistake again soon after: a short reminder, not the speech
    const hn = h.n, seen = B.told[j.tag];
    B.told[j.tag] = hn;
    if (seen != null && hn - seen <= (sc >= 5 ? 3 : 6)){
      if (j.verdict === 'mistake' && j.lesson && sc >= 4) afterTalk(() => sayAt(['again.' + j.lesson], {}, 3));
      return;
    }
    const keys = j.confidence === 'leans' ? [j.tag + '.why.leans', j.tag + '.why'] : [j.tag + '.why'];
    const ctx = slots(top.spot, j);
    const lesson = sc >= 3 && j.lesson && !B.lessons[j.lesson] && (LINES['lesson.' + j.lesson] || []).length ? j.lesson : null;
    afterTalk(() => {
      if (!sayAt(keys, ctx, notch, lead)) return;
      if (lesson){ B.lessons[lesson] = true; afterTalk(() => sayAt(['lesson.' + lesson], {}, 2)); }
    });
  }
  /* wait for him to finish what he's saying (up to 12s), then go */
  function afterTalk(fn){
    const t0 = performance.now();
    B.pending = (B.pending || 0) + 1;
    const go = () => { B.pending = Math.max(0, B.pending - 1); try{ fn(); }catch(e){} };
    // quiet, and still quiet a beat later (a line can start in between)
    let quietSince = 0;
    const tick = () => {
      const now = performance.now();
      if (!live && !queue){ if (!quietSince) quietSince = now; if (now - quietSince >= 300) return go(); }
      else quietSince = 0;
      if (now - t0 < 15000) setTimeout(tick, 100);
      else B.pending = Math.max(0, B.pending - 1);
    };
    setTimeout(tick, 0);
  }
  /* for a lab: the whole explanation of a decision now, whatever the
     notch: the word, the reason, and the lesson (as if the first time) */
  function explain(d, advice){
    const j = d && d.judgement; if (!j) return false;
    const ctx = slots(d.spot, j), lv = j.confidence === 'leans';
    clear(true); queue = null;
    holdUntil = performance.now() + 40000;
    const own = fn => { holding = true; try{ return fn(); } finally{ holding = false; } };
    const done = () => { holdUntil = performance.now() + 6000; };   // (until the last line has been read)
    const why = () => {
      own(() => sayAt(lv ? [j.tag + '.why.leans', j.tag + '.why'] : [j.tag + '.why'], ctx, 1));
      if (j.lesson && (LINES['lesson.' + j.lesson] || []).length) afterTalk(() => { own(() => sayAt(['lesson.' + j.lesson], {}, 1)); done(); });
      else done();
    };
    const word = () => { if (own(() => sayAt(lv ? [j.tag + '.now.leans', j.tag + '.now'] : [j.tag + '.now'], ctx, 1))) afterTalk(why); else why(); };
    // (a lab: what he'd have told you first, at the HELP setting)
    if (advice && own(() => sayAdvice(advice, d.spot, Math.max(2, +O.help), 1))) afterTalk(word); else word();
    return true;
  }
  /* your cards, with where you sit (a fact, IN YOUR EAR) */
  function dealtLine(g, me, h){
    let seat = null, behind = 0;
    try{ const i = g.players.indexOf(me); seat = CoachBrain.seatLabel(g, i); behind = CoachBrain.actingAfter(g, i); }catch(e){}
    const band = h.p < .06 ? 'premium' : h.p < .2 ? 'strong' : h.p < .5 ? 'middle' : 'weak';
    const group = { UTG:'early', 'UTG+1':'early', 'UTG+2':'early', LJ:'middle', HJ:'middle', CO:'late', BTN:'late', SB:'blinds', BB:'blinds' }[seat];
    if (group && +O.notch >= 4 && LINES['dealt.' + band + '.' + group]){
      return sayAt(['dealt.' + band + '.' + group], Object.assign({}, h, { seatOn:SEAT_ON[seat], behindP:players(behind) }), 4);
    }
    return say(band === 'premium' ? 'dealtPremium' : band === 'strong' ? 'dealtStrong' : band === 'middle' ? 'dealtMiddle' : 'dealtWeak', h);
  }

  let hooked = false;
  function hook(){
    if (hooked || typeof applyAction !== 'function') return;
    hooked = true;
    const realApply = window.applyAction;
    window.applyAction = function(player, decision){
      const g = game, before = g ? g.currentBet : 0, pot = g ? g.pot : 0;
      // his brain reads your decision before it's applied (the price you faced)
      let sp = null;
      try{ if (player && player.isHuman && typeof CoachBrain !== 'undefined') sp = CoachBrain.spot(g, player); }catch(e){}
      const r = realApply.apply(this, arguments);
      let rec = null;
      try{ if (sp) rec = CoachBrain.record(sp, g, player); }catch(e){}
      try{
        if (!player || !decision) return r;
        const a = decision.action, amt = g.currentBet;
        if (player.isHuman){
          if (wordNow(rec)) return r;
          if (player.allIn) say('youAllIn');
          else if (a === 'fold') say('youFold');
          else if (a === 'call' || a === 'check') { if (a === 'call') say('youCall'); }
          else if (a === 'raise' || a === 'bet') say('youRaise', { amt:fmt(amt) });
        } else if (player.allIn && (a === 'raise' || a === 'bet' || a === 'call' || a === 'allin')){
          say('oppAllIn', { name:player.name });
        } else if (a === 'raise' || a === 'bet'){
          const size = amt - before;
          if (size >= Math.max(1, pot) * .6) say('oppBigBet', { name:player.name, amt:fmt(amt) });
          else say('oppRaise', { name:player.name, amt:fmt(amt) });
        }
      }catch(e){}
      return r;
    };
    const realCoach = window.updateCoach;
    window.updateCoach = function(){
      const r = realCoach.apply(this, arguments);
      try{
        const me = human();
        if (me && pendingHumanPlayer === me){
          const call = Math.max(0, game.currentBet - me.betThisRound);
          // let the deal line finish first
          setTimeout(() => {
            if (pendingHumanPlayer !== me) return;
            // before the flop his advice (the HELP dial) takes the place of the price
            let advised = false;
            try{ advised = yourTurn(me); }catch(e){}
            if (!advised) say(call > 0 ? 'yourPrice' : 'yourFree', ctxNow());
          }, live ? 900 : 250);
        }
      }catch(e){}
      return r;
    };
    watch();
  }

  /* the deal and the end of a hand are watched from the game's state, not
     by wrapping its functions (other parts of the table swap those in and
     out): a new hand number is a deal; the phase reaching a showdown or
     everyone folding, with the pot paid out, is the end. */
  let W = { n:-1, start:{}, dealt:false, ended:false, endAt:0 };
  function watch(){
    setInterval(() => {
      const g = game; if (!g || !g.players) return;
      if (g.handNumber !== W.n){
        const last = W;
        W = { n:g.handNumber, start:{}, dealt:false, ended:false, endAt:0, seen:performance.now() };
        g.players.forEach(p => { W.start[p.id] = p.chips + (p.totalBetHand || 0); });
        try{
          if (typeof CoachBrain !== 'undefined'){
            // the last hand finished between two looks (a fold fast-forwards it)
            const you = human();
            if (!last.ended && you && last.start[you.id] != null){
              const done = CoachBrain.closeMissed(W.start[you.id] - last.start[you.id]);
              if (done) debrief(done);
            }
            CoachBrain.handStart(g, W.start);
          }
        }catch(e){}
      }
      const me = human();
      try{ if (me && typeof CoachBrain !== 'undefined') CoachBrain.observe(g, me); }catch(e){}
      // your cards: once they've landed
      if (!W.dealt && me && me.hand && me.hand.length === 2 && performance.now() - W.seen > 1300){
        W.dealt = true;
        const h = holeCtx();
        // (not over the last hand's debrief)
        if (h && !B.pending && !live) dealtLine(g, me, h);
      }
      // the end of the hand, once the pot's been paid
      if (!W.ended && (g.phase === 'showdown' || g.phase === 'foldwin')){
        if (!W.endAt) W.endAt = performance.now();
        if ((g.pot || 0) === 0 || performance.now() - W.endAt > 5000){
          W.ended = true;
          if (!me) return;
          const bb = g.bigBlind || g.bb || 20;
          const delta = me.chips - (W.start[me.id] != null ? W.start[me.id] : me.chips);
          const showdown = g.phase === 'showdown' && me.inHand && !me.folded;
          let done = null;
          try{ if (typeof CoachBrain !== 'undefined') done = CoachBrain.handEnd(g, me, delta); }catch(e){}
          if (done) setTimeout(() => debrief(done), 450);
          setTimeout(() => {
            if (me.chips <= 0) say('youOut');
            else if (delta > 0) say(delta >= bb * 10 ? 'winBig' : !showdown ? 'allFolded' : 'winSmall', { won:fmt(delta) });
            else if (delta < 0 && showdown) say(-delta >= bb * 10 ? 'loseBig' : 'loseShowdown');
            g.players.forEach(p => { if (!p.isHuman && p.chips <= 0 && W.start[p.id] > 0) say('oppOut', { name:p.name }); });
          }, 400);
        }
      }
    }, 200);
  }

  /* Settings → Coach talk (coachTalk, '1'-'4'): the talk slider */
  function wireHelp(){
    const seg = $id('coach-help-seg');
    const paint = () => { if (seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === O.help)); };
    try{ if (settings.coachHelp) O.help = String(settings.coachHelp); }catch(e){}
    if (seg) seg.querySelectorAll('button').forEach(b => { b.onclick = () => { O.help = b.dataset.v; try{ settings.coachHelp = O.help; saveSettings(); }catch(e){} paint(); }; });
    paint();
  }
  function wireSetting(){
    const seg = $id('coach-talk-seg');
    const paint = () => { if (seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === O.notch)); };
    try{ if (settings.coachTalk) O.notch = String(settings.coachTalk); }catch(e){}
    if (seg) seg.querySelectorAll('button').forEach(b => { b.onclick = () => { O.notch = b.dataset.v; try{ settings.coachTalk = O.notch; saveSettings(); }catch(e){} paint(); }; });
    paint();
  }
  function start(){
    // his brain's library (js/coach-lines.js)
    try{ if (typeof CoachLines !== 'undefined') Object.keys(CoachLines.lines).forEach(k => { if (!LINES[k]) LINES[k] = CoachLines.lines[k]; }); }catch(e){}
    hook(); wireSetting(); wireHelp();
    // tap his screen: his read of the hand, now
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#coach-station')) onTap(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);

  return { apply, say, sayAt, sayAny, slots, debrief, explain, sayAdvice, onTap, clear:() => clear(true), OPTIONS, DEFAULTS, LINES, get order(){ return Object.assign({}, O); } };
})();
