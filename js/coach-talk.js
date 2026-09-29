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
  const DEFAULTS = { notch:'4', where:'across', look:'screen', textIn:'type', arrive:'pop', hold:'normal',
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
  const fill = (text, ctx) => text.replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null ? ctx[k] : m);
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
  function show(line, ctx, moment){
    if (!line) return;
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
      try{ if (sp) CoachBrain.record(sp, g, player); }catch(e){}
      try{
        if (!player || !decision) return r;
        const a = decision.action, amt = g.currentBet;
        if (player.isHuman){
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
          setTimeout(() => { if (pendingHumanPlayer === me) say(call > 0 ? 'yourPrice' : 'yourFree', ctxNow()); }, live ? 900 : 250);
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
            if (!last.ended && you && last.start[you.id] != null) CoachBrain.closeMissed(W.start[you.id] - last.start[you.id]);
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
        if (h) say(h.p < .06 ? 'dealtPremium' : h.p < .2 ? 'dealtStrong' : h.p < .5 ? 'dealtMiddle' : 'dealtWeak', h);
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
          try{ if (typeof CoachBrain !== 'undefined') CoachBrain.handEnd(g, me, delta); }catch(e){}
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
  function wireSetting(){
    const seg = $id('coach-talk-seg');
    const paint = () => { if (seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === O.notch)); };
    try{ if (settings.coachTalk) O.notch = String(settings.coachTalk); }catch(e){}
    if (seg) seg.querySelectorAll('button').forEach(b => { b.onclick = () => { O.notch = b.dataset.v; try{ settings.coachTalk = O.notch; saveSettings(); }catch(e){} paint(); }; });
    paint();
  }
  function start(){ hook(); wireSetting(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);

  return { apply, say, sayAny, clear:() => clear(true), OPTIONS, DEFAULTS, LINES, get order(){ return Object.assign({}, O); } };
})();
