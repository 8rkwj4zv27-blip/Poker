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
    dealtPremium:[[3, 'pleased', '{hole}. One of the best starting hands there is.'], [3, 'pleased', '{hole}. A hand worth playing properly.'], [3, 'impressed', '{hole}. You won’t see many better than that.'], [3, 'pleased', '{hole}. That’s a good one.']],
    dealtStrong:[[4, 'calm', '{hole}. Better than most.'], [4, 'pleased', '{hole}. A good start.'], [4, 'calm', '{hole}. A decent hand.']],
    dealtMiddle:[[4, 'calm', '{hole}. Playable, depending on what happens before you.'], [4, 'thinking', '{hole}. Middle of the pack.'], [4, 'thinking', '{hole}. Could go either way.']],
    dealtWeak:[[4, 'calm', '{hole}. Most of the time this one gets folded.'], [4, 'calm', '{hole}. A weak hand.'], [4, 'wince', '{hole}. Not much to work with.'], [4, 'calm', '{hole}. Probably a fold.']],
    oppRaise:[[4, 'thinking', '{name} has raised. That usually means a decent hand.'], [4, 'calm', '{name} raised to {amt}.'], [4, 'thinking', 'A raise from {name}. Take note.'], [4, 'calm', '{name} wants more in the pot.']],
    oppBigBet:[[3, 'thinking', '{name} bet big. Big bets tend to mean strong hands.'], [3, 'surprised', 'That’s a big bet from {name}.'], [3, 'thinking', '{name} put a lot in there.'], [3, 'thinking', 'A big one from {name}. They mean it, usually.']],
    oppAllIn:[[2, 'surprised', '{name} is all in.'], [2, 'thinking', '{name} has put everything in.'], [2, 'surprised', 'All in from {name}.']],
    yourPrice:[[3, 'thinking', '{call} to call, {pot} in the pot. You’d need to win about {odds}% of the time.'], [3, 'calm', 'It costs {call}. The pot’s {pot}.'], [3, 'calm', '{call} to stay in. {pot} to win.']],
    yourFree:[[4, 'calm', 'Nobody’s bet.'], [4, 'calm', 'Your turn. Checking costs nothing.'], [4, 'calm', 'It’s free to check.']],
    youFold:[[4, 'calm', 'Folded.'], [4, 'calm', 'Out of this one.'], [4, 'calm', 'Next one.']],
    youCall:[[4, 'calm', 'Called.'], [4, 'thinking', 'Called. Let’s see the next card.'], [4, 'calm', 'You’re in.']],
    youRaise:[[4, 'pleased', 'Raised. Let’s see who comes along.'], [4, 'calm', 'You’ve raised to {amt}.'], [4, 'calm', 'Raised.']],
    youAllIn:[[2, 'surprised', 'All in. No going back now.'], [2, 'thinking', 'Everything’s in the middle.'], [2, 'thinking', 'All in. Now we wait.']],
    winBig:[[1, 'impressed', 'Nice pot.'], [1, 'pleased', 'That’s a good one. {won} to you.'], [1, 'impressed', 'That was a big pot.'], [1, 'pleased', 'A big win. {won}.'], [1, 'impressed', 'That’s a pot worth winning.']],
    winSmall:[[2, 'pleased', 'Took it down.'], [2, 'calm', 'Small pot, but it’s yours.'], [2, 'pleased', 'Yours.'], [2, 'calm', 'A small one. They add up.']],
    allFolded:[[2, 'pleased', 'They all folded. Sometimes a bet is enough.'], [2, 'calm', 'No callers. That’s yours.'], [2, 'pleased', 'Nobody wanted to fight you for it.'], [2, 'calm', 'Everyone folded. Pot’s yours.']],
    loseShowdown:[[1, 'unlucky', 'Didn’t go your way.'], [1, 'unlucky', 'They had it that time.'], [1, 'unlucky', 'Beaten that time.'], [1, 'calm', 'Their hand was better.']],
    loseBig:[[1, 'wince', 'That one hurt.'], [1, 'unlucky', 'Unlucky. That was a lot of chips.'], [1, 'wince', 'A big one to lose.'], [1, 'unlucky', 'Painful. Shake it off.']],
    oppOut:[[2, 'calm', '{name}’s out.'], [2, 'pleased', 'That’s {name} gone.'], [2, 'calm', '{name} is out of chips.']],
    youOut:[[1, 'unlucky', 'That’s the run over. We’ll go again.'], [1, 'unlucky', 'Out. It happens.'], [1, 'calm', 'Out of chips. Next time.']]
  };

  /* Which wording: every one of a moment's lines is used before any comes
     round again (and never the same one twice running), so he doesn't
     repeat himself. For this session. */
  const lastUsed = {}, usedSet = {};
  function choose(key, pool){
    const used = usedSet[key] || (usedSet[key] = new Set());
    let fresh = pool.filter(l => !used.has(l[2]));
    if (!fresh.length){ used.clear(); fresh = pool.filter(l => l[2] !== lastUsed[key]); if (!fresh.length) fresh = pool; }
    const l = fresh[Math.floor(Math.random() * fresh.length)];
    used.add(l[2]); lastUsed[key] = l[2];
    return l;
  }
  function pick(moment){
    const pool = (LINES[moment] || []).filter(l => l[0] <= +O.notch);
    if (!pool.length) return null;
    return choose(moment, pool);
  }
  // blanks fill in lower case ("one player", "a flush draw"); a sentence
  // that starts with one gets its capital back
  // {t:name}: a poker word, in plain words until its lesson has been said;
  // {Name}: a blank with a capital, when the line needs one
  const fill = (text, ctx) => text
    .replace(/\{t:(\w+)\}/g, (m, k) => termText(k))
    .replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null ? ctx[k]
      : /^[A-Z]/.test(k) && ctx[k[0].toLowerCase() + k.slice(1)] != null ? cap(String(ctx[k[0].toLowerCase() + k.slice(1)])) : m)
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

  /* ---------------- poker words he's taught you ----------------
     A lesson teaches its words (CoachLines.terms: via); from then on his
     lines use them. Kept under his own storage key, 'pip.coach' (nothing
     else is touched). */
  const MEM_KEY = 'pip.coach';
  let MEM = { terms:{} };
  try{ const raw = localStorage.getItem(MEM_KEY); if (raw) MEM = Object.assign({ terms:{} }, JSON.parse(raw)); }catch(e){}
  const saveMem = () => { try{ localStorage.setItem(MEM_KEY, JSON.stringify(MEM)); }catch(e){} };
  const TERMS = () => (typeof CoachLines !== 'undefined' && CoachLines.terms) || {};
  const knows = lesson => !!MEM.terms[lesson];
  function termText(k){ const t = TERMS()[k]; if (!t) return k; return knows(t.via) ? t.term : t.plain; }
  function learnFrom(key){
    const m = /^lesson\.(.+?)(?:\.opp)?$/.exec(key || ''); if (!m || MEM.terms[m[1]]) return;
    MEM.terms[m[1]] = Date.now(); saveMem();
  }

  /* ---------------- the bubble ---------------- */
  let live = null, queue = null;
  // A line belongs to the public situation that produced it, not merely
  // to the player object (which survives deals and re-raises).
  function sceneStamp(){
    try{
      const g = game, me = human();
      return JSON.stringify([g && g.handNumber, g && g.phase, g && g.currentBet, g && g.pot,
        g && (g.handActions || []).length, g && g._humanCardsVisible,
        me && me.chips, me && me.betThisRound, me && me.folded,
        typeof pendingHumanPlayer !== 'undefined' && pendingHumanPlayer === me]);
    }catch(e){ return ''; }
  }
  function clear(now){
    if (now) queue = null;
    if (!live) return;
    const l = live; live = null;
    l.timers.forEach(clearTimeout);
    try{ CoachSet.mouth(false); }catch(e){}
    if (now || motionOffSafe()) l.el.remove();
    else { l.el.classList.add('is-out'); setTimeout(() => l.el.remove(), 180); }
    // anything waiting goes next
    if (queue && !now){ const q = queue; queue = null; if (performance.now() - q.at < 4500) setTimeout(() => { if (q.stamp === sceneStamp()) show(q.line, q.ctx, q.moment); }, 350); }
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
      let top = t.top - gap - h;
      // clear of the pot readout (owner 29 Sep 2026): lifted above it, but
      // never onto the cards on the table; where there isn't room, as high
      // as the cards allow, so it covers as little of the pot as it can
      const pot = $id('pot-area');
      if (pot && !pot.classList.contains('hidden')){
        const p = pot.getBoundingClientRect();
        if (p.height && p.right > x && p.left < x + w && top + h > p.top - 4 && top < p.bottom){
          const board = felt.querySelector('.board');
          const b = board ? board.getBoundingClientRect() : null;
          const floor = b && b.height ? b.bottom + 6 : f.top + pad;
          top = Math.min(top, Math.max(floor, p.top - 6 - h));
        }
      }
      el.style.top = Math.round(top) + 'px';
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
      if (!queue || line[0] <= queue.line[0]) queue = { line, ctx, moment, at:performance.now(), stamp:sceneStamp() };
      return;
    }
    const text = fill(line[2], ctx || {});
    if (/^advise\./.test(moment || '') && ctx && ctx._decisionId != null) A.shownId = ctx._decisionId;
    try{ const hn = game ? game.handNumber : -1; if (T.saidHand !== hn){ T.saidHand = hn; T.said = new Set(); } T.said.add(text.trim()); }catch(e){}
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
    const l = live = { el, timers:[], stamp:sceneStamp(), lab:holding };
    const lead = motionOffSafe() ? 0 : 140;
    // An interrupted lesson has not yet taught its vocabulary.
    l.timers.push(setTimeout(() => { if (live === l && (l.lab || l.stamp === sceneStamp())) learnFrom(moment); }, lead + (typed ? p.total : 0) + Math.min(1500, hold)));
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
      return choose(k, pool);
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
  // seats in plain words until the position lesson
  const PLAIN_ON = { BTN:'on the dealer button', CO:'one seat before the dealer button', HJ:'two seats before the dealer button', LJ:'three seats before the dealer button',
    UTG:'in the first seat to act', 'UTG+1':'in an early seat', 'UTG+2':'in an early seat', SB:'in the small blind', BB:'in the big blind' };
  const PLAIN_FROM = { BTN:'from the dealer button', CO:'from one seat before the dealer button', HJ:'from two seats before the dealer button', LJ:'from three seats before the dealer button',
    UTG:'from the first seat to act', 'UTG+1':'from an early seat', 'UTG+2':'from an early seat', SB:'from the small blind', BB:'from the big blind' };
  const seatOn = s => (knows('position') ? SEAT_ON : PLAIN_ON)[s] || 'here';
  const seatFrom = s => (knows('position') ? SEAT_FROM : PLAIN_FROM)[s] || 'from there';
  const handWords = p => p == null ? 'a hand' : p <= 0.03 ? 'one of the very best starting hands' : p <= 0.08 ? 'a very strong starting hand'
    : p <= 0.18 ? 'a strong starting hand' : p <= 0.35 ? 'a decent starting hand' : p <= 0.55 ? 'an average starting hand' : 'a weak starting hand';
  // (lines say "about {rangeWords}")
  const rangeWords = r => !r ? 'their best hands' : r >= 70 ? 'most hands' : '1 hand in ' + Math.max(2, Math.round(100 / r));
  /* Short because of THEM: when you cover a short opponent, a line's
     '.opp' wording goes first ("Lucy only has 7 big blinds", not "you're
     short"). */
  const shortKeys = (keys, n) => n && n.shortOpp ? keys.reduce((o, k) => o.concat([k + '.opp', k]), []) : keys;
  function slots(sp, j){
    const n = (j && j.n) || {}, seat = (sp && sp.seat) || n.seat;
    return {
      shortOpp: n.shortOpp || 'they',
      hole: sp ? sp.holeFacts.name : '', pct: n.pct != null ? n.pct : sp ? Math.max(1, Math.round(sp.holeFacts.pct * 100)) : '',
      handWords: handWords(sp ? sp.holeFacts.pct : null), rangeWords: rangeWords(n.range),
      range: n.range != null ? n.range : '', seatOn: seatOn(seat), seatFrom: seatFrom(seat),
      SeatFrom: cap(seatFrom(seat)), behindP: players(sp ? sp.actingAfter : 0),
      bb: n.bb != null ? n.bb : '', size: n.size != null ? n.size : '', call: fmt(n.call || 0), odds: n.odds != null ? n.odds : '',
      eq: n.eq != null ? n.eq : '', need: n.need != null ? n.need : '', raiser: n.raiser || 'they', limpersP: players(n.limpers || 0),
      raiserFrom: seatFrom(n.raiserSeat),
      // checked to you
      opp: n.opp || 'they', valueTargets:n.valueTargets || 'weaker hands', to: n.to != null ? fmt(n.to) : '', sizeWords: n.sizeWords || 'half the pot', fold: n.fold != null ? n.fold : '', foldNeed: n.foldNeed != null ? n.foldNeed : '',
      players: n.players || '', won: '',
      // after the flop
      bettor: n.bettor || 'they', betSize: n.betSize || 'a bet', handName: n.handName || (sp && sp.holeFacts ? sp.holeFacts.name : ''),
      drawName: n.drawName || 'a draw', DrawName: cap(n.drawName || 'a draw'), outs: n.outs != null ? n.outs : '', hitNext: n.hitNext != null ? n.hitNext : '', pot: fmt(n.pot != null ? n.pot : sp ? sp.pot : 0)
    };
  }
  const MOVE_WORD = { fold:'fold', check:'check', call:'call', raise:'raise', bet:'bet', allin:'go all in' };

  /* ---------------- advice before you act (the HELP dial) ----------------
     HELP 1 WATCH: none. 2 HINTS: what to think about, not the move.
     3 ADVICE: the move and why; a lean says so; a close one says it's close.
     4 TELL ME: always the move, with the numbers and the size.
     Unprompted, it plays at TIPS (3) on the big decisions (a raise to face,
     a short stack, a premium hand, anything not clear-cut) and at IN YOUR
     EAR (4) on every decision bar folding junk. Tapping him always gets it. */
  function adviceCtx(a, sp){
    return Object.assign(slots(sp, a.judgement), { _decisionId:sp.decisionId, to: a.to ? fmt(a.to) : a.n && a.n.to ? fmt(a.n.to) : '', toBB: a.toBB,
      // the one player the story is about
      opp: a.stories && a.stories.one ? a.stories.one.name : (a.n && a.n.opp) || 'they',
      lean: MOVE_WORD[a.move], alt: MOVE_WORD[a.alt] || '', Lean: cap(MOVE_WORD[a.move]), Alt: cap(MOVE_WORD[a.alt] || '') });
  }
  /* what their betting says, as the lead-in to his advice after the flop */
  function storyKey(a){
    const st = a && a.stories; if (!st || !st.list.length) return null;
    if (st.one){
      // (a pattern, "keeps betting", only once there is one)
      const k = 'story.' + st.one.kind + (st.one.again && LINES['story.' + st.one.kind + '.again.one'] ? '.again' : '') + '.one';
      return LINES[k] ? k : null;
    }
    if (st.all === 'mixed') return 'story.mixed';
    const k = 'story.' + st.all + '.all'; return LINES[k] ? k : null;
  }
  // (one opponent with a habit worth knowing, when it changes the advice)
  function habitKey(a){
    const h = a && a.stories && a.stories.one && a.stories.one.habit;
    return h && LINES['habit.' + h] ? 'habit.' + h : null;
  }
  function adviceKeys(a){
    const drawing = a.kind === 'post' && a.n && a.n.drawName && !['overpair', 'top-pair', 'two-pair', 'set', 'trips', 'straight', 'flush', 'full-house', 'quads', 'straight-flush'].includes(a.n.made);
    if (a.kind === 'post') return drawing ? ['advise.post.' + a.move + '.draw', 'advise.post.' + a.move] : ['advise.post.' + a.move];
    if (a.kind === 'bet'){
      const t = a.tag || '';
      if (a.move === 'check') return t === 'bet.check.draw.deep' ? ['advise.bet.check.draw', 'advise.bet.check']
        : t === 'bet.check.medium' || t === 'bet.check.draw' ? ['advise.bet.check']
        : (a.n && a.n.players > 1) ? ['advise.bet.check.multi', 'advise.bet.check.weak'] : ['advise.bet.check.weak'];
      if (a.plan && t.indexOf('bet.value') === 0){
        if (a.plan.purpose === 'keep-worse-in') return ['advise.bet.bet.keep', 'advise.bet.bet'];
        if (a.plan.purpose === 'charge-draws') return ['advise.bet.bet.charge', 'advise.bet.bet'];
        if (a.plan.purpose === 'ask-caller-more') return ['advise.bet.bet.caller', 'advise.bet.bet'];
        if (a.plan.purpose === 'commit-shallow') return a.move === 'allin' ? ['advise.bet.bet.commit', 'advise.bet.bet'] : ['advise.bet.bet.commit.match', 'advise.bet.bet'];
      }
      return t.indexOf('bet.semi') === 0 ? ['advise.bet.bet.draw', 'advise.bet.bet'] : t.indexOf('bet.bluff') === 0 ? ['advise.bet.bet.bluff'] : ['advise.bet.bet'];
    }
    return shortKeys(['advise.' + a.kind + '.' + a.move], a.n);
  }
  function sayAdvice(a, sp, help, notch){
    const ctx = adviceCtx(a, sp);
    if (help <= 1) return false;
    const drawing = a.kind === 'post' && a.n && a.n.drawName && !['overpair', 'top-pair', 'two-pair', 'set', 'trips', 'straight', 'flush', 'full-house', 'quads', 'straight-flush'].includes(a.n.made);
    const lead = storyKey(a);
    if (help === 2) return sayAt(drawing ? ['hint.post.draw', 'hint.post'] : shortKeys(['hint.' + a.kind], a.n), ctx, notch, lead);
    const said = help === 3 && a.sure === 'close' && a.alt ? sayAt(['advise.close'], ctx, notch, lead)
      : sayAt(adviceKeys(a), ctx, notch, lead, a.sure === 'leans' || a.sure === 'close' ? 'advise.tail.leans' : habitKey(a));
    return said;
  }
  const A = { handNo:-1, advice:null, spot:null, shownId:null };
  function yourTurn(me){
    const g = game;
    if ((live && live.lab) || performance.now() < holdUntil) return false;
    if (typeof CoachBrain === 'undefined' || !['preflop', 'flop', 'turn', 'river'].includes(g.phase)) return false;
    // (every street: facing a bet, or checked to you: bet or check)
    const sp = CoachBrain.spot(g, me), a = CoachBrain.advise(sp);
    A.handNo = g.handNumber; A.advice = a; A.spot = sp;
    if (!a) return false;
    const help = +O.help, talk = +O.notch;
    if (help <= 1 || talk < 3) return false;
    const junkFold = a.kind !== 'post' && a.move === 'fold' && a.sure === 'clear' && sp.holeFacts.pct > 0.5;
    const big = ['vsRaise', 'vsReraise', 'short', 'post'].includes(a.kind) || (a.kind === 'bet' && a.move !== 'check') || sp.holeFacts.pct < 0.06 || a.sure !== 'clear';
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
  const T = { ctx:null, items:null, i:0 };
  const DRAW_NAME = d => d.flush && (d.oesd || d.gutshot) ? 'a flush and straight draw' : d.flush ? 'a flush draw' : d.oesd ? 'an open-ended straight draw' : d.gutshot ? 'an inside straight draw' : null;
  function sayText(text, mood, ctx, moment){
    clear(true); queue = null;
    try{ document.dispatchEvent(new CustomEvent('coachtalk', { detail:{ moment, notch:+O.notch } })); }catch(e){}
    show([1, mood || 'calm', text], ctx || {}, moment);
  }
  const textOf = (key, ctx) => { const l = lineFor([].concat(key)); return l ? { text:fill(l[2], ctx), mood:l[1] } : null; };
  function tapRead(me){
    const g = game;
    const sp = CoachBrain.spot(g, me);
    if (!sp) return null;
    const r = CoachBrain.readNow(sp), mine = pendingHumanPlayer === me;
    const ctx = Object.assign(slots(sp, null), { call:fmt(r.toCall), pot:fmt(r.pot), odds:r.odds });
    const parts = [];
    if (r.street === 'preflop'){
      if (mine){ const a = CoachBrain.advisePreflop(sp); if (a){ A.advice = a; A.spot = sp; A.handNo = g.handNumber;
        const c = adviceCtx(a, sp); const t = textOf(a.sure === 'close' && a.alt ? 'advise.close' : adviceKeys(a), c);
        if (t) parts.push(t); return { parts, topic:a.lesson ? 'lesson.' + a.lesson : null, n:a.n, ctx:c }; } }
      const t = textOf('read.pre.wait', ctx); if (t) parts.push(t);
      return { parts, topic:'explain.position' };
    }
    /* after the flop: what you have, what their betting says, and (your
       turn) what to do about it. A fact only if it helps you decide. */
    const made = r.boardPlays ? 'boardPlays' : ['straight', 'flush', 'full-house', 'quads', 'straight-flush'].includes(r.made) ? 'big' : r.made;
    const m = textOf('read.made.' + made, Object.assign({}, ctx, { handName:r.handName }));
    if (m) parts.push(m);
    const dn = DRAW_NAME(r.draws || {});
    const adv = mine ? CoachBrain.advise(sp) : null;
    const st = CoachBrain.stories(sp);
    const sk = storyKey({ stories:st });
    if (sk){ const t = textOf(sk, Object.assign({}, ctx, { opp: st.one ? st.one.name : 'they' })); if (t) parts.push(t); }
    let topic = dn ? 'explain.outs' : r.made === 'top-pair' ? 'explain.kicker' : 'explain.equity';
    if (adv){
      A.advice = adv; A.spot = sp; A.handNo = g.handNumber;
      const c = adviceCtx(adv, sp);
      const t = textOf(adv.sure === 'close' && adv.alt ? 'advise.close' : adviceKeys(adv), c);
      if (t) parts.push(t);
      topic = adv.lesson ? 'lesson.' + adv.lesson : topic;
      return { parts, topic, n:adv.n, ctx:c };
    } else {
      if (dn && r.left){
        const d = textOf('read.draw', Object.assign({}, ctx, { drawName:dn, outs:r.drawOuts, hitPct:r.hitPct, byWhen: r.left === 2 ? 'by the last card' : 'on the last card' }));
        if (d) parts.push(d);
      }
      if (r.threats && r.threats.length && parts.length < 3){ const t = textOf('read.threat', Object.assign({}, ctx, { threat:r.threats[0] })); if (t) parts.push(t); }
    }
    return { parts, topic };
  }
  /* Tapping him steps through what he has to say about this moment, one
     thing per tap, and never loops back: his read, then the lesson behind
     it, then a tip; then "that's all" until the moment changes (your turn,
     a new street, the result, the next hand). */
  function tapContext(g, me){
    const flip = $id('console-flip');
    const result = !!(flip && flip.classList.contains('flipped'));
    return [sceneStamp(), result ? 'result' : ''].join('|');
  }
  function tapItems(g, me){
    const items = [];
    const push = (key, ctx, moment) => { const t = textOf(key, ctx || {}); if (t) items.push({ text:t.text, mood:t.mood, moment:moment || [].concat(key)[0] }); };
    const flip = $id('console-flip');
    const result = !!(flip && flip.classList.contains('flipped'));
    const inHand = !result && g && me && me.inHand && !me.folded && me.hand && me.hand.length === 2 && ['preflop', 'flop', 'turn', 'river'].includes(g.phase);
    if (inHand){
      const r = tapRead(me);
      if (r && r.parts.length) items.push({ text:r.parts.map(p => p.text).join(' '), mood:r.parts[0].mood, moment:'tap.read' });
      if (r && r.topic) push(shortKeys([r.topic], r.n), r.ctx);
      const lesson = r && r.topic && r.topic.indexOf('lesson.') === 0 ? r.topic.slice(7) : null;
      if (lesson) push(shortKeys(['tip.' + lesson], r.n), r.ctx);
      return items;
    }
    if (!result && g && me && me.folded && ['preflop', 'flop', 'turn', 'river'].includes(g.phase)){
      push('read.pre.out'); push('tip.watching');
      return items;
    }
    // the result's up but the cards are still running out (an all in):
    // nothing to judge yet
    if (result && g && (!B.last || B.last.n !== g.handNumber)){ push('read.wait'); return items; }
    // the result, or between hands: this hand (or the last one), in full
    const v = B.last;
    if (v && v.v && v.v.whyText){
      items.push({ text:fill(v.v.whyText, v.v.ctx), mood:v.v.mood || 'calm', moment:'tap.verdict' });
      if (v.v.lesson){ push(shortKeys(['lesson.' + v.v.lesson], v.v.j.n), v.v.ctx); push(shortKeys(['tip.' + v.v.lesson], v.v.j.n), v.v.ctx); }
      if (v.v.extraTip) push(v.v.extraTip);
    } else if (v && v.summary) {
      push(v.summary, v.ctx);
      push('tip.general');
    } else push('read.between');
    return items;
  }
  function onTap(){
    try{ if (!CoachSet.on || CoachSet.busy) return; }catch(e){ return; }
    explainGen++; holdUntil = 0;
    const g = game, me = human();
    try{ CoachSet.look('you'); }catch(e){}
    const ctxKey = tapContext(g, me);
    if (T.ctx !== ctxKey || !T.items){ T.ctx = ctxKey; T.items = tapItems(g, me); T.i = 0; }
    // (anything he's already said this hand is skipped)
    while (T.i < T.items.length && T.said && T.said.has(T.items[T.i].text.trim())) T.i++;
    const it = T.items[T.i++];
    if (it){
      sayText(it.text, it.mood, {}, it.moment);
      if (live && it.moment === 'tap.read' && pendingHumanPlayer === me && A.spot && A.spot === CoachBrain.spot(g, me)) A.shownId = A.spot.decisionId;
      return;
    }
    const done = textOf('tap.done', {});
    if (done) sayText(done.text, done.mood, {}, 'tap.done');
  }
  const SCORE = j => !j ? 0 : j.verdict === 'mistake' ? (j.confidence === 'clear' ? 5 : j.confidence === 'leans' ? 4 : 1)
    : j.notable ? 3 : j.confidence === 'close' ? 1 : 0;
  const B = { handNo:-1, worded:false, praisedAt:-9, lessons:{}, told:{}, worded2:{} };
  /* right after you act: returns true if he said something */
  function wordNow(d){
    const j = d && d.judgement; if (!j) return false;
    if ((live && live.lab) || performance.now() < holdUntil) return false;
    const g = game || {};
    if (B.handNo !== g.handNumber){ B.handNo = g.handNumber; B.worded = false; }
    if (B.worded) return false;
    let notch = 0;
    if (j.verdict === 'mistake') notch = j.confidence === 'clear' ? 1 : j.confidence === 'leans' ? 3 : 0;
    else if (j.notable && j.confidence !== 'close'){
      // he told you to; no need to praise you for listening
      if (d.followedAdvice && d.adviceShown) return false;
      // praise: not every hand (rarer at the quieter notches)
      if (g.handNumber - B.praisedAt < (+O.notch >= 4 ? 2 : 4)) return false;
      notch = j.verdict === 'good' ? 2 : 3;
    }
    if (!notch) return false;
    // the same word again soon after is nagging: skip it (the reminder
    // comes after the hand instead)
    const last = B.worded2[j.tag];
    if (last != null && g.handNumber - last <= (j.confidence === 'clear' ? 2 : 4)) return false;
    const keys = shortKeys(j.confidence === 'leans' ? [j.tag + '.now.leans', j.tag + '.now'] : [j.tag + '.now'], j.n);
    if (!keys.some(k => (LINES[k] || []).length) || notch > +O.notch) return false;
    // what you just did outranks the line about your turn: it goes
    if (live && !live.judged) clear(true);
    if (!sayAt(keys, slots(d.spot, j), notch)) return false;
    if (live) live.judged = true;
    B.worded = true; B.worded2[j.tag] = g.handNumber;
    if (j.verdict !== 'mistake') B.praisedAt = g.handNumber;
    return true;
  }
  /* After the hand: the decision that most needs talking about. Said the
     moment the result is shown (with COLLECT still up), in place of the
     plain result line; never carried into the next hand (a tap brings it
     back). The first time a lesson comes up, the lesson follows. */
  function verdictOf(h){
    if (!h || !h.decisions || !h.end) return null;
    const judged = h.decisions.filter(d => d.judgement);
    if (!judged.length) return null;
    // the decision that matters most: how wrong or right it was, then later
    // streets and bigger pots over a close call before the flop
    const STREET = { preflop:0, flop:0.2, turn:0.35, river:0.5 };
    const weight = d => SCORE(d.judgement) + (SCORE(d.judgement) >= 3 ? (STREET[d.spot.street] || 0) + Math.min(0.5, (d.spot.potBB || 0) / 60) : 0);
    const top = judged.reduce((a, d) => weight(d) > weight(a) ? d : a);
    const j = top.judgement, sc = SCORE(j);
    if (!sc) return null;
    const net = h.end.net || 0;
    // everyone folded to you: its own words where there are some
    const terminal = judged[judged.length - 1];
    const foldWin = net > 0 && !h.end.showdown && top === terminal && ['bet', 'raise', 'allin'].includes(top.choice.action);
    const lead = j.tag === 'bet.missed' && net > 0 ? 'lead.wonButMore'
      : j.verdict === 'mistake' && sc >= 4 && net > 0 ? 'lead.wonAnyway'
      : j.verdict !== 'mistake' && sc >= 3 && net < 0 && h.end.showdown ? 'lead.lostAnyway' : null;
    const lv = j.confidence === 'leans';
    const keys = shortKeys((foldWin ? [j.tag + '.why.foldwin'] : []).concat(lv ? [j.tag + '.why.leans', j.tag + '.why'] : [j.tag + '.why']), j.n);
    const ctx = Object.assign(slots(top.spot, j), { won:fmt(Math.max(0, net)) });
    const committed = j.tag === 'bet.value.commit' || (top.recommendation && top.recommendation.plan && top.recommendation.plan.shove);
    const extraTip = foldWin && !committed && top.spot.holeFacts && top.spot.holeFacts.pct <= 0.06 ? 'tip.bigHands' : null;
    return { top, j, sc, notch: sc === 1 ? 4 : 2, keys, lead, ctx, lesson:j.lesson, extraTip, foldWin };
  }
  function debrief(h, onScreen){
    const v = verdictOf(h);
    // (kept for tapping him, whether or not he says it now)
    const summary = !h || !h.end ? null : h.end.net > 0 ? (h.end.showdown ? 'sum.won' : 'sum.allFolded') : h.end.net < 0 ? (h.end.showdown ? 'sum.lost' : h.end.folded ? 'sum.folded' : 'sum.lost') : 'sum.even';
    B.last = { n: h ? h.n : -1, v, summary, ctx:{ won:fmt(Math.max(0, h && h.end ? h.end.net : 0)) } };
    if (!v) return false;
    // the words he'd say, fixed now (so a tap later gives the same verdict)
    const l = lineFor(v.keys), ll = v.lead ? lineFor([v.lead]) : null;
    if (!l) return false;
    v.whyText = (ll ? ll[2] + ' ' : '') + l[2]; v.mood = l[1];
    if (!onScreen || (live && live.lab) || performance.now() < holdUntil) return false;
    const hn = h.n, seen = B.told[v.j.tag];
    B.told[v.j.tag] = hn;
    /* a hand that hurt (owner 29 Sep 2026): you're out, or you lost half
       your chips or more. No lesson over it: a short word, and the verdict
       and lesson wait for a tap. */
    const net = h.end.net || 0, start = h.startStack;
    const out = start != null && start + net <= 0;
    if (net < 0 && (out || (start > 0 && -net >= start * 0.5))){
      const fine = v.j.verdict !== 'mistake';
      clear(true); queue = null;
      return sayAt([out ? (fine ? 'comfort.out.fine' : 'comfort.out') : (fine ? 'comfort.fine' : 'comfort.hurt')], {}, 1);
    }
    // the same mistake again soon after: a short reminder, not the speech
    if (seen != null && hn - seen <= (v.sc >= 5 ? 3 : 6)){
      if (v.j.verdict === 'mistake' && v.j.lesson && v.sc >= 4){
        const sizeCorrection = (v.j.lesson === 'value-betting' && v.j.tag !== 'bet.missed') || /heavy/.test(v.j.tag);
        return sayAt(sizeCorrection ? v.keys : shortKeys(['again.' + v.j.lesson], v.j.n), v.ctx, 3);
      }
      return false;
    }
    if (v.notch > +O.notch) return false;
    clear(true); queue = null;
    show([v.notch, v.mood, v.whyText], v.ctx, v.keys[0]);
    const lesson = v.sc >= 3 && v.lesson && !B.lessons[v.lesson] && !knows(v.lesson) && (LINES['lesson.' + v.lesson] || []).length ? v.lesson : null;
    // (checked again when it's due: a tap may have taught it meanwhile)
    if (lesson){ B.lessons[lesson] = true; afterTalk(() => { if (game && game.handNumber === hn && !knows(lesson)) sayAt(shortKeys(['lesson.' + lesson], v.j.n), v.ctx, 2); }); }
    return true;
  }
  /* wait for him to finish what he's saying (up to 12s), then go */
  function afterTalk(fn, lab){
    const t0 = performance.now();
    const stamp = sceneStamp();
    B.pending = (B.pending || 0) + 1;
    const go = () => { B.pending = Math.max(0, B.pending - 1); try{ fn(); }catch(e){} };
    // quiet, and still quiet a beat later (a line can start in between)
    let quietSince = 0;
    const tick = () => {
      const now = performance.now();
      if (!lab && stamp !== sceneStamp()){ B.pending = Math.max(0, B.pending - 1); return; }
      // (and never while your new cards are still face down: the reveal is yours)
      const dealing = typeof game !== 'undefined' && game && game._humanCardsVisible === false;
      if (!live && !queue && !dealing){ if (!quietSince) quietSince = now; if (now - quietSince >= 300) return go(); }
      else quietSince = 0;
      if (now - t0 < 15000) setTimeout(tick, 100);
      else B.pending = Math.max(0, B.pending - 1);
    };
    setTimeout(tick, 0);
  }
  /* for a lab: the whole explanation of a decision now, whatever the
     notch: the word, the reason, and the lesson (as if the first time) */
  let explainGen = 0;
  function explain(d, advice){
    const j = d && d.judgement; if (!j) return false;
    const ctx = slots(d.spot, j), lv = j.confidence === 'leans', sk = ks => shortKeys(ks, j.n);
    // (a newer explanation cancels what's still waiting from this one)
    const gen = ++explainGen, own0 = fn => () => { if (gen === explainGen) fn(); };
    clear(true); queue = null;
    holdUntil = performance.now() + 40000;
    const own = fn => { holding = true; try{ return fn(); } finally{ holding = false; } };
    const done = () => { holdUntil = performance.now() + 6000; };   // (until the last line has been read)
    const why = () => {
      own(() => sayAt(sk(lv ? [j.tag + '.why.leans', j.tag + '.why'] : [j.tag + '.why']), ctx, 1));
      if (j.lesson && (LINES['lesson.' + j.lesson] || []).length) afterTalk(own0(() => { own(() => sayAt(sk(['lesson.' + j.lesson]), ctx, 1)); done(); }), true);
      else done();
    };
    const word = () => { if (own(() => sayAt(sk(lv ? [j.tag + '.now.leans', j.tag + '.now'] : [j.tag + '.now']), ctx, 1))) afterTalk(own0(why), true); else why(); };
    // (a lab: what he'd have told you first, at the HELP setting)
    if (advice && own(() => sayAdvice(advice, d.spot, Math.max(2, +O.help), 1))) afterTalk(own0(word), true); else word();
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
      try{ if (sp) rec = CoachBrain.record(sp, g, player, { adviceShown:A.shownId === sp.decisionId }); }catch(e){}
      try{
        if (!player || !decision) return r;
        const a = decision.action, amt = g.currentBet;
        if (player.isHuman){
          if (wordNow(rec)) return r;
          // (a plain "Called." every time is noise: only now and then)
          if (!player.allIn && Math.random() < 0.65) return r;
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
          const stamp = sceneStamp();
          // let the deal line finish first
          setTimeout(() => {
            if (pendingHumanPlayer !== me || stamp !== sceneStamp() || game._humanCardsVisible === false) return;
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
      if (live && !live.lab && live.stamp !== sceneStamp()) clear(true);
      if (g.handNumber !== W.n){
        const last = W;
        W = { n:g.handNumber, start:{}, dealt:false, ended:false, endAt:0, seen:performance.now(), visAt:0 };
        g.players.forEach(p => { W.start[p.id] = p.chips + (p.totalBetHand || 0); });
        try{
          if (typeof CoachBrain !== 'undefined'){
            // the last hand finished between two looks (a fold fast-forwards it)
            const you = human();
            if (!last.ended && you && last.start[you.id] != null){
              const done = CoachBrain.closeMissed(W.start[you.id] - last.start[you.id]);
              // (too late to say it now: kept for a tap)
              if (done) debrief(done, false);
            }
            CoachBrain.handStart(g, W.start);
            // someone went out last hand (known for sure once the next is dealt)
            g.players.forEach(p => { if (!p.isHuman && last.start && last.start[p.id] > 0 && (p.eliminated || p.chips <= 0 && !p.inHand)) say('oppOut', { name:p.name }); });
          }
        }catch(e){}
      }
      const me = human();
      try{ if (me && typeof CoachBrain !== 'undefined') CoachBrain.observe(g, me); }catch(e){}
      // your cards: only once they've been turned over for you (the reveal is
      // yours), a beat after; a table that never says so, after a moment
      const vis = g._humanCardsVisible === true || (g._humanCardsVisible === undefined && performance.now() - W.seen > 2500);
      if (vis && !W.visAt) W.visAt = performance.now();
      if (!W.dealt && me && me.hand && me.hand.length === 2 && W.visAt && performance.now() - W.visAt > 350){
        W.dealt = true;
        const h = holeCtx();
        // (not over the last hand's debrief)
        if (h && !B.pending && !live) dealtLine(g, me, h);
      }
      /* the end of the hand: the moment the winner is shown and the COLLECT
         key comes up (#console-flip), before the pot is paid: he works the
         result out from the pots and the hands shown. Otherwise when the
         pot's been paid, or after 20 seconds. */
      // (everyone folding before the flop goes straight to the award screen
      // with the phase still 'preflop': the screen itself is the signal)
      const flip = $id('console-flip');
      const shownNow = !!(flip && flip.classList.contains('flipped')) && W.dealt;
      if (!W.ended && (g.phase === 'showdown' || g.phase === 'foldwin' || shownNow)){
        if (!W.endAt) W.endAt = performance.now();
        let net = null;
        if (shownNow && me){ try{ net = CoachBrain.settle(g, me); }catch(e){ net = null; } }
        const paid = (g.pot || 0) === 0;
        if (net == null && (paid || performance.now() - W.endAt > 20000) && me) net = me.chips - (W.start[me.id] != null ? W.start[me.id] : me.chips);
        if (net != null){
          W.ended = true;
          if (!me) return;
          const bb = g.bigBlind || g.bb || 20;
          const showdown = g.phase === 'showdown' && me.inHand && !me.folded;
          // your stack once this pot's paid
          const after = paid ? me.chips : me.chips + net + (me.totalBetHand || 0);
          let done = null;
          try{ if (typeof CoachBrain !== 'undefined') done = CoachBrain.handEnd(g, me, net); }catch(e){}
          // his verdict on the hand straight away, while the result's up; the
          // plain result line only when he has nothing more useful to say
          const endedHand = g.handNumber;
          setTimeout(() => {
            if (game !== g || game.handNumber !== endedHand) return;
            let spoke = false;
            try{ spoke = done ? debrief(done, true) : false; }catch(e){}
            if (spoke) return;
            if (after <= 0) say('youOut');
            else if (net > 0) say(net >= bb * 10 ? 'winBig' : !showdown ? 'allFolded' : 'winSmall', { won:fmt(net) });
            else if (net < 0 && showdown) say(-net >= bb * 10 ? 'loseBig' : 'loseShowdown');
          }, 200);
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

  // for a lab: the end-of-hand word for a made-up hand, now
  const labDebrief = h => { explainGen++; holdUntil = 0; clear(true); queue = null; return debrief(h, true); };
  return { apply, say, sayAt, sayAny, slots, debrief, labDebrief, verdictOf, explain, sayAdvice, onTap, clear:() => clear(true), OPTIONS, DEFAULTS, LINES, get order(){ return Object.assign({}, O); } };
})();
