"use strict";

/* ============================================================
   SPEECH LAB — creature voices (round 2, lab only)

   Talking without words, the Animal Crossing / Hollow Knight / Minions
   family: every line is spoken as gibberish built from its own vowels,
   so "Go on, then" is three syllables on o, o, e, and a line replays the
   same way each time. Each character has a voice (pitch, range, pace,
   timbre) and the line's face bends it: angry is lower and punchier,
   nervous wobbles, smug slides down, a question rises at the end.

   Three styles, picked in the lab:
   - CREATURE: a buzzy source through two vowel filters (formants), one
     syllable per vowel group, with a little consonant click in front.
   - BLIPS: one short pitched pip per letter, the classic text-box voice.
   - GRUMBLE: the creature voice, muffled and low, like a mutter.

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
        // one gentle compressor so a shouted line never clips
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
     letter when typing, source wave, formant shift, and a quirk */
  const VOICES = {
    rock:      { hz:150, range:3,  pace:44, wave:'triangle', shift:1.10, quirk:'flat' },     // Nigel: nasal, level, put out
    shark:     { hz:215, range:4,  pace:36, wave:'triangle', shift:1.05, quirk:'down' },     // Lucy: cool, every phrase closes down
    maniac:    { hz:175, range:10, pace:24, wave:'sawtooth', shift:1.00, quirk:'bounce' },   // Tony: fast, all over the place
    station:   { hz:300, range:7,  pace:40, wave:'triangle', shift:1.18, quirk:'warble' },   // Mavis: high, a little wobble
    grinder:   { hz:120, range:3,  pace:42, wave:'sawtooth', shift:0.92, quirk:'flat' },     // Steve: low, tired
    wildcard:  { hz:255, range:11, pace:28, wave:'square',   shift:1.12, quirk:'bounce' },   // Roxy: bright, erratic
    professor: { hz:140, range:6,  pace:42, wave:'sawtooth', shift:0.98, quirk:'lecture' },  // Harry: rises to make a point, then down
    hammer:    { hz:82,  range:2,  pace:52, wave:'sawtooth', shift:0.85, quirk:'down' }      // Bruno: very low, very slow
  };
  const voiceOf = key => VOICES[key] || VOICES.grinder;

  // mood from the face the line is said with
  function moodOf(face){
    const f = String(face || '');
    if (/angry|displeased|furious|tilted/.test(f)) return { pitch:-2, vol:1.3, speed:1.1, wobble:0 };
    if (/nervous|worried|terrified|panic/.test(f)) return { pitch:2, vol:.85, speed:1.1, wobble:1 };
    if (/happy|joyful|ecstatic|relieved/.test(f)) return { pitch:2, vol:1, speed:1, wobble:0 };
    if (/smug|sly|scheming|cocky|gloating/.test(f)) return { pitch:-1, vol:1, speed:.92, wobble:0, slide:true };
    if (/suspicious|confused|baffled/.test(f)) return { pitch:0, vol:.9, speed:.95, wobble:0, rise:true };
    return { pitch:0, vol:1, speed:1, wobble:0 };
  }

  // vowel formants (F1, F2), roughly
  const FORMANTS = { a:[800,1200], e:[430,2000], i:[320,2300], o:[480,850], u:[340,720], y:[320,2300] };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

  /* A line becomes a list of syllables, each with where it starts in the
     text (so typing can trigger it) and its vowel. */
  function syllables(text){
    const out = [];
    const re = /[^aeiouy\s.,!?'’-]*[aeiouy]+/gi;
    let m;
    while ((m = re.exec(text))) out.push({ at:m.index, chunk:m[0].toLowerCase(), vowel:(m[0].match(/[aeiouy]/i) || ['a'])[0].toLowerCase() });
    return out;
  }

  let style = 'creature', level = 0.5;
  function set(o){ if (o.style) style = o.style; if (o.level != null) level = o.level; }

  // one syllable of the creature voice
  function syllable(c, out, t, v, mood, syl, i, n, text, muffled){
    const last = i === n - 1;
    let semi = (hash(syl.chunk + i) - .5) * v.range + mood.pitch - (i / Math.max(1, n)) * 1.5;   // gentle fall across the line
    if (v.quirk === 'bounce') semi += (i % 2 ? 2 : -1);
    if (v.quirk === 'lecture') semi += (i === Math.floor(n * .6) ? 4 : 0);
    if (last && /\?\s*$/.test(text)) semi += 5;
    if (last && (v.quirk === 'down' || mood.slide)) semi -= 3;
    if (last && /!\s*$/.test(text)) semi += 2;
    const f0 = v.hz * Math.pow(2, semi / 12) * (muffled ? .8 : 1);
    const dur = Math.max(.06, Math.min(.2, (syl.chunk.length * v.pace * .9) / 1000 / mood.speed));
    const osc = c.createOscillator();
    // a buzzy source for everyone (the vowel filters need harmonics to
    // work on); the character's own wave only colours the dry body
    osc.type = v.wave === 'square' ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 1.04, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * (mood.slide || v.quirk === 'down' ? .9 : .98), t + dur);
    if (v.quirk === 'warble' || mood.wobble){
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 9; lg.gain.value = f0 * .035;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + .05);
    }
    const [F1, F2] = FORMANTS[syl.vowel] || FORMANTS.a;
    const g = c.createGain();
    const peak = .5 * level * mood.vol * (v.trim || 1);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + .012);
    g.gain.setValueAtTime(peak, t + dur * .6);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    [[F1, 3, 1.4], [F2, 5, .9]].forEach(([F, Q, amt]) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = F * v.shift; bp.Q.value = Q;
      const a = c.createGain(); a.gain.value = amt;
      osc.connect(bp); bp.connect(a); a.connect(g);
    });
    // the dry body: the voice's own colour, kept under the vowels
    const lpd = c.createBiquadFilter(); lpd.type = 'lowpass'; lpd.frequency.value = 1400 * v.shift;
    const dry = c.createGain(); dry.gain.value = .22;
    osc.connect(lpd); lpd.connect(dry); dry.connect(g);
    if (muffled){
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = .7;
      g.connect(lp); lp.connect(out);
    } else g.connect(out);
    osc.start(t); osc.stop(t + dur + .03);
    // a little consonant click in front of the vowel
    if (!muffled && /^[bcdfghjklmnpqrstvwxz]/.test(syl.chunk)){
      const n2 = Math.floor(c.sampleRate * .018), buf = c.createBuffer(1, n2, c.sampleRate), d = buf.getChannelData(0);
      for (let k = 0; k < n2; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / n2);
      const s = c.createBufferSource(); s.buffer = buf;
      const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = /[sz]/.test(syl.chunk[0]) ? 5200 : 2600; hp.Q.value = 1.2;
      const ng = c.createGain(); ng.gain.value = .12 * level * mood.vol;
      s.connect(hp); hp.connect(ng); ng.connect(out); s.start(t); s.stop(t + .03);
    }
  }

  // one text-box pip
  function blip(c, out, t, v, mood, ch, i, text){
    const semi = (hash(ch + i) - .5) * Math.min(4, v.range) + mood.pitch + (/\?\s*$/.test(text) && i > text.length - 4 ? 4 : 0);
    const f0 = v.hz * 2.2 * Math.pow(2, semi / 12);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = v.wave === 'sawtooth' ? 'square' : v.wave;
    osc.frequency.setValueAtTime(f0, t);
    const peak = .3 * level * mood.vol * (v.trim || 1);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + .06);
  }

  /* The pacing plan for a line: when each letter appears (ms from the
     start), with pauses at punctuation. Typing and voice both read it. */
  function plan(key, text, face, even){
    const v = voiceOf(key), mood = moodOf(face);
    const per = (even ? 32 : v.pace) / mood.speed;
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

  /* Speak a line: schedules every sound against the letters' times, so
     it matches the typing exactly (or plays on its own if the text pops). */
  function schedule(c, out, t0, key, text, face, even){
    const v = voiceOf(key), mood = moodOf(face);
    const { times } = plan(key, text, face, even);
    if (style === 'blips'){
      let i = 0;
      for (let k = 0; k < text.length; k++){
        if (!/[a-z0-9]/i.test(text[k])) continue;
        if ((i++ % 2) === 0) blip(c, out, t0 + times[k] / 1000, v, mood, text[k], k, text);
      }
      return;
    }
    const syl = syllables(text);
    syl.forEach((s, i) => syllable(c, out, t0 + times[s.at] / 1000, v, mood, s, i, syl.length, text, style === 'grumble'));
  }
  function speak(key, text, face, even){
    const c = ac(); if (!c || style === 'off') return;
    try{ schedule(c, bus, c.currentTime + .03, key, text, face, even); }catch(e){}
  }

  /* For checks only: renders a line offline and measures it, so a voice
     can be proved audible and unclipped without a speaker. */
  async function measure(key, text, face, even){
    const { total } = plan(key, text, face, even);
    const rate = 22050, oc = new OfflineAudioContext(1, Math.ceil(rate * (total / 1000 + .6)), rate);
    const comp = oc.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(oc.destination);
    schedule(oc, comp, .02, key, text, face, even);
    const d = (await oc.startRendering()).getChannelData(0);
    let peak = 0, sum = 0, loud = 0;
    for (let i = 0; i < d.length; i++){ const a = Math.abs(d[i]); peak = Math.max(peak, a); sum += a * a; if (a > .02) loud++; }
    return { peak, rms:Math.sqrt(sum / d.length), voicedMs:Math.round(loud / rate * 1000), lineMs:Math.round(total), syllables:syllables(text).length };
  }

  return { speak, plan, set, unlock, measure, VOICES };
})();
