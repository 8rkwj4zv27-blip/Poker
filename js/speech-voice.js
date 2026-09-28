"use strict";

/* ============================================================
   SPEECH LAB — the voices: blips (round 3, lab only)

   Talking without words, the text-box way: a little pitched pip as the
   letters type on. Round 2 tried a creature voice (vowel gibberish) and
   a muffled grumble as well; the owner found them a bit scary and picked
   BLIPS, so round 3 is blips only, with more choices:
   - SOUND: each character's own (round 3's pick), or one of the six for
     everyone.
   - HOW OFTEN: every letter, every other letter, or once a syllable.
   - PITCH: each character's own (Bruno low, Mavis high) or all the same.
   - MELODY: in tune (a five-note scale, so a line sounds like a little
     tune), free (round 2), or one steady note.
   A line always blips the same way (the pitches come from its letters),
   the typing and the blips share one letter-by-letter timing plan, and
   the line's face nudges it: angry lower, happy and nervous higher, a
   question rises at the end.

   Its own AudioContext (the game's Sound keeps its private), gated by
   the game's sound setting and unlocked by the first tap, as iOS wants.
   Nothing in the game loads this file.
   ============================================================ */
const SpeechVoice = (() => {
  let ctx = null, bus = null;
  const on = () => { try{ return !!settings.sound; }catch(e){ return true; } };
  function ac(){
    if (!on()) return null;
    if (!ctx){
      try{ const AC = window.AudioContext || window.webkitAudioContext; ctx = AC ? new AC() : null; }catch(e){ ctx = null; }
      if (ctx){
        // one gentle compressor so a busy line never clips
        bus = ctx.createDynamicsCompressor();
        bus.threshold.value = -18; bus.ratio.value = 4;
        bus.connect(ctx.destination);
      }
    }
    if (ctx && ctx.state === 'suspended'){ try{ ctx.resume(); }catch(e){} }
    return ctx;
  }
  const unlock = () => { ac(); };
  ['touchend', 'click'].forEach(ev => addEventListener(ev, unlock, { passive:true }));

  /* each character's voice: base pitch (Hz), range (semitones), ms per
     letter (THEIR OWN pace), how a phrase ends, and their own blip sound
     (owner, round 3: every character gets their own; six sounds for eight
     people, so two pairs share, told apart by pitch and pace). `trim`
     evens out how loud each one SOUNDS (owner, round 6: "they should all
     be the same volume"): measured through an ear-weighted filter
     (measure(..., weighted)) at the locked blip settings, then set so
     every character lands on the cast's average */
  const VOICES = {
    rock:      { hz:330, range:4,  pace:44, end:'flat', sound:'machine', trim:1.26 }, // Nigel: level, put out; clerical ticks
    shark:     { hz:440, range:5,  pace:36, end:'down', sound:'bell', trim:0.81 },    // Lucy: cool, glassy, every phrase closes down
    maniac:    { hz:370, range:9,  pace:24, end:'up',   sound:'chirp', trim:1.21 },   // Tony: fast, all over the place
    station:   { hz:560, range:7,  pace:40, end:'up',   sound:'soft', trim:0.96 },    // Mavis: high, gentle
    grinder:   { hz:300, range:3,  pace:42, end:'flat', sound:'pip', trim:0.78 },     // Steve: low, tired, plain
    wildcard:  { hz:520, range:10, pace:28, end:'up',   sound:'chirp', trim:1.18 },   // Roxy: bright, erratic (Tony's chirp, far higher)
    professor: { hz:350, range:6,  pace:42, end:'down', sound:'machine', trim:1.26 }, // Harry: lifts to make a point, then down (Nigel's ticks, livelier)
    hammer:    { hz:196, range:3,  pace:52, end:'down', sound:'wood', trim:0.73 }     // Bruno: very low, very slow, a knock at the door
  };
  const voiceOf = key => VOICES[key] || VOICES.grinder;

  // mood from the face the line is said with: a pitch nudge (the level
  // stays put: owner, round 6, everyone the same volume)
  function moodOf(face){
    const f = String(face || '');
    if (/angry|displeased|furious|tilted/.test(f)) return { pitch:-3, vol:1 };
    if (/nervous|worried|terrified|panic/.test(f)) return { pitch:2, vol:1 };
    if (/happy|joyful|ecstatic|relieved/.test(f)) return { pitch:2, vol:1 };
    if (/smug|sly|scheming|cocky|gloating/.test(f)) return { pitch:-1, vol:1 };
    return { pitch:0, vol:1 };
  }
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
  const SCALE = [0, 2, 4, 7, 9];     // major pentatonic: can't play a wrong note

  let opts = { sound:'own', often:'other', pitch:'own', melody:'key', level:.3, family:.5 };   // round 5's picks
  function set(o){ Object.assign(opts, o); }

  /* ---- the pips: (context, output, time, frequency, level) ---- */
  function env(c, t, peak, attack, len){
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + len);
    return g;
  }
  function tone(c, out, t, type, f, peak, attack, len, drop){
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f * (drop || 1), t);
    if (drop) o.frequency.exponentialRampToValueAtTime(f, t + Math.min(.03, len * .5));
    const g = env(c, t, peak, attack, len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + .02);
  }
  function click(c, out, t, freq, peak, len){
    const n = Math.max(1, Math.floor(c.sampleRate * len)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 3);
    const s = c.createBufferSource(); s.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.4;
    const g = c.createGain(); g.gain.value = peak;
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t); s.stop(t + len + .01);
  }
  /* Round 5 (owner: when they talk one after another it sounds a bit
     funny, "especially Bell"; keep the directions, bring them closer):
     every blip is now one shared core, a warm square pip, with the
     character's flavour mixed on top. `a` is how much flavour (the lab's
     FAMILY row): 1 is round 4's sounds as they were, lower pulls them
     toward the shared pip. The flavours scale with it too, so a CLOSE
     bell rings shorter and stays on its note instead of jumping an
     octave. */
  function core(c, out, t, f, peak){
    const o = c.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(f, t);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = env(c, t, peak, .005, .055);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + .08);
  }
  const FLAVOURS = {
    // round 2's pip: the core itself
    pip:     (c, out, t, f, v, a) => tone(c, out, t, 'square', f, .30 * v, .005, .05),
    // rounded and gentle: a triangle with a soft attack
    soft:    (c, out, t, f, v, a) => { tone(c, out, t, 'triangle', f, .36 * v, .012, .055 + .02 * a); tone(c, out, t, 'sine', f / 2, .13 * v * a, .012, .06); },
    // a Nintendo-ish chirp: drops onto its note (further the more flavour)
    chirp:   (c, out, t, f, v, a) => tone(c, out, t, 'square', f, .30 * v, .003, .045 + .02 * (1 - a), 1 + .5 * a),
    // woody and plucky, like a little marimba
    wood:    (c, out, t, f, v, a) => { tone(c, out, t, 'sine', f, .42 * v, .002, .06 + .03 * a, 1 + .25 * a); click(c, out, t, f * 3, .12 * v * a, .012); },
    // glassy, like a music box: the octave jump and the long ring only at full flavour
    bell:    (c, out, t, f, v, a) => { tone(c, out, t, 'sine', a > .8 ? f * 2 : f, .30 * v, .002, .06 + .1 * a * a); tone(c, out, t, 'sine', f * 5.4, .06 * v * a * a, .002, .05); },
    // the machine printing it: a teleprinter tick with a tiny tone under it
    machine: (c, out, t, f, v, a) => { click(c, out, t, 3800, .5 * v * (.4 + .6 * a), .009); tone(c, out, t, 'square', f, .16 * v, .002, .03); }
  };
  const SOUNDS = Object.fromEntries(Object.keys(FLAVOURS).map(k => [k, (c, out, t, f, v) => {
    const a = opts.family;
    if (a >= 1){ FLAVOURS[k](c, out, t, f, v, 1); return; }
    core(c, out, t, f, .26 * v * (1 - a));
    // the flavour goes through the core's warmth too, opening up with `a`
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600 + 5000 * a * a; lp.connect(out);
    FLAVOURS[k](c, lp, t, f, v * (.35 + .65 * a), a);
  }]));

  /* The pacing plan for a line: when each letter appears (ms from the
     start), with pauses at punctuation. Typing and blips both read it. */
  function plan(key, text, face, even){
    const per = even ? 32 : voiceOf(key).pace;
    const times = [];
    let t = 0;
    for (let i = 0; i < text.length; i++){
      times.push(t);
      const ch = text[i];
      t += ch === ' ' ? per * .6 : per;
      if (/[,;]/.test(ch)) t += per * 3;
      if (/[.!?]/.test(ch) && i < text.length - 1) t += per * 5;
    }
    return { times, total:t };
  }

  // which letters blip
  function beats(text){
    const out = [];
    if (opts.often === 'syllable'){
      const re = /[aeiouy]+/gi; let m;
      while ((m = re.exec(text))) out.push(m.index);
      return out;
    }
    let n = 0;
    for (let k = 0; k < text.length; k++){
      if (!/[a-z0-9]/i.test(text[k])) continue;
      if (opts.often === 'letter' || (n % 2) === 0) out.push(k);
      n++;
    }
    return out;
  }

  // the note for one blip, in semitones from the character's base
  function note(v, mood, text, k, idx, count){
    // FAMILY narrows how far each voice wanders, as well as its sound
    v = Object.assign({}, v, { range:v.range * (.5 + .5 * opts.family) });
    let semi;
    if (opts.melody === 'steady') semi = 0;
    else if (opts.melody === 'key'){
      const steps = Math.max(2, Math.round(v.range * 5 / 12) + 1);                  // scale steps the range covers
      const s = Math.floor(hash(text[k].toLowerCase() + k) * steps) - Math.floor(steps / 2);
      semi = SCALE[((s % 5) + 5) % 5] + 12 * Math.floor(s / 5);
    } else semi = (hash(text[k] + k) - .5) * v.range;
    semi += mood.pitch;
    const tail = idx >= count - 2;
    if (tail && /\?\s*$/.test(text)) semi += opts.melody === 'key' ? 7 : 5;
    else if (tail && v.end === 'down' && opts.melody !== 'steady') semi -= opts.melody === 'key' ? 3 : 2;
    return semi;
  }

  function schedule(c, out, t0, key, text, face, even){
    const v = voiceOf(key), mood = moodOf(face);
    const { times } = plan(key, text, face, even);
    // FAMILY also pulls the voices' pitches toward the middle (330 Hz)
    const base = opts.pitch === 'same' ? 400 : 330 * Math.pow(v.hz / 330, .35 + .65 * opts.family);
    const play = SOUNDS[opts.sound === 'own' ? v.sound : opts.sound] || SOUNDS.pip;
    const list = beats(text);
    const level = opts.level * mood.vol * (v.trim || 1);
    list.forEach((k, i) => play(c, out, t0 + times[k] / 1000, base * Math.pow(2, note(v, mood, text, k, i, list.length) / 12), level));
  }
  function speak(key, text, face, even){
    if (!(opts.level > 0)) return;          // SILENT: the bubble still talks, no blips
    const c = ac(); if (!c) return;
    try{ schedule(c, bus, c.currentTime + .03, key, text, face, even); }catch(e){}
  }

  /* For checks only: renders a line offline and measures it, so a voice
     can be proved audible and unclipped without a speaker. */
  async function measure(key, text, face, even, weighted){
    const { total } = plan(key, text, face, even);
    const rate = 44100, oc = new OfflineAudioContext(1, Math.ceil(rate * (total / 1000 + .6)), rate);
    const comp = oc.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    if (weighted){
      // roughly the K-weighting loudness meters use: the ear hears lows
      // less and the upper mids more, so a low knock and a bright chirp
      // at the same level don't sound the same
      const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 100; hp.Q.value = .5;
      const sh = oc.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 1500; sh.gain.value = 4;
      comp.connect(hp); hp.connect(sh); sh.connect(oc.destination);
    } else comp.connect(oc.destination);
    schedule(oc, comp, .02, key, text, face, even);
    const d = (await oc.startRendering()).getChannelData(0);
    let peak = 0, sum = 0, zc = 0, ring = 0;
    for (let i = 0; i < d.length; i++){ const a = Math.abs(d[i]); peak = Math.max(peak, a); sum += a * a; if (i && (d[i] > 0) !== (d[i - 1] > 0)) zc++; }
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > peak * .1) ring++;
    // brightness: zero crossings a second; ring: share of the line that's sounding
    return { peak, rms:Math.sqrt(sum / d.length), blips:beats(text).length, lineMs:Math.round(total), bright:Math.round(zc / (d.length / rate)), ring:ring / d.length };
  }

  return { speak, plan, set, unlock, measure, VOICES, SOUNDS:Object.keys(SOUNDS) };
})();
