/* ============================================================
   CHATTER — DIRECTOR
   Decides WHETHER anyone speaks, WHO speaks, and in what order —
   then drives a presenter, the portraits and the voice through the
   resulting beats.

   The single most important thing in this file is that it says NO a
   lot. Chatter is background flavour: most eligible moments must pass
   in silence or the table becomes a sitcom. Four independent gates
   have to agree before a line is heard:

     1. global cooldown   — nothing at all for N seconds after a line
     2. trigger chance    — each trigger has its own base rate
     3. resident chance   — chattiness, plus a per-resident cooldown
     4. density cap       — at most N lines inside a rolling window

   Exchanges are rarer still: a two-beat reply is occasional, and a
   three-beat is reserved for an authored punchline whose whole cast
   happens to be seated.

   Every refusal is REPORTED rather than swallowed (`verdict.reason`),
   which is what lets the Design Lab show pacing as a visible log
   instead of asking anyone to take the pacing on trust.

   Async identity: every run takes a monotonic token and every timer
   checks it before touching the DOM, so a replayed or interrupted
   sequence can never have a stale beat land over a newer one.
   ============================================================ */
(function(global){
  'use strict';

  var DEFAULTS = {
    /* The one knob that sets how talkative the table is overall.
       Every trigger's own base chance is multiplied by it, so the
       relative rates authored in 02-lines.js are preserved while the
       whole cast can be quietened or loosened together. 0.5 is the
       prototype default and puts a line roughly every third or fourth
       hand at a normal event cadence — see the pacing simulation
       recorded in docs. */
    speakScale:         0.5,
    globalCooldownMs:   9000,
    residentCooldownMs: 16000,
    densityWindowMs:    60000,
    densityMax:         2,
    twoBeatChance:      0.26,
    threeBeatChance:    0.07,
    beatGapMs:          420,
    dwellBaseMs:        1150,
    dwellPerCharMs:     42,
    dwellMinMs:         1500,
    dwellMaxMs:         4200,
    settleMs:           600,
    dwellScale:         1
  };

  function create(opts){
    opts = opts || {};
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
    if (opts.config) for (var k2 in opts.config) cfg[k2] = opts.config[k2];

    var presenter = opts.presenter || null;
    var faces     = opts.faces || null;
    var voice     = opts.voice || global.ChatterVoice || null;
    var seated    = (opts.seated || global.ChatterResidents.ids).slice();
    var listeners = [];
    /* Injectable clock. Production leaves it alone and gets wall time;
       the Design Lab's pacing demo supplies a virtual one so it can
       show what twenty minutes of table time does to the gates
       without anyone sitting through twenty minutes. Beat playback
       still runs on real timers — only the GATE arithmetic is
       virtualised, so the visuals never lie about speed. */
    var clock     = opts.clock || function(){ return Date.now(); };

    var token = 0;
    var timers = [];
    var lastSpokeAt = 0;
    var lastByResident = {};
    var recent = [];              // timestamps for the density window

    function now(){ return clock(); }
    function emit(ev){ listeners.forEach(function(fn){ try{ fn(ev); }catch(e){} }); }
    function later(fn, ms, my){
      var id = setTimeout(function(){ if (my === token) fn(); }, ms);
      timers.push(id);
      return id;
    }
    function clearTimers(){
      timers.forEach(clearTimeout);
      timers = [];
    }

    function dwellFor(text){
      var d = cfg.dwellBaseMs + cfg.dwellPerCharMs * (text||'').length;
      d = Math.max(cfg.dwellMinMs, Math.min(cfg.dwellMaxMs, d));
      return Math.round(d * cfg.dwellScale);
    }

    function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

    /* ---- gates ---------------------------------------------------
       Returns null to allow, or a reason string to refuse. Ordered
       cheapest-and-most-decisive first so the log reads as a story:
       "silent because we only just heard someone", not "silent
       because a die came up wrong". */
    function refuse(trigger, actorId){
      var t = now();
      if (t - lastSpokeAt < cfg.globalCooldownMs) return 'global cooldown';
      recent = recent.filter(function(x){ return t - x < cfg.densityWindowMs; });
      if (recent.length >= cfg.densityMax) return 'density cap';
      if (actorId && (t - (lastByResident[actorId]||0)) < cfg.residentCooldownMs) return 'resident cooldown';
      var meta = global.ChatterLines.triggerMeta(trigger);
      var chance = (meta ? meta.chance : 0.4) * cfg.speakScale;
      var res = global.ChatterResidents.byId(actorId);
      if (res) chance *= res.chattiness;
      if (Math.random() > chance) return 'silent roll';
      return null;
    }

    /* ---- beat construction --------------------------------------
       An authored exchange is preferred when one exists for this
       trigger and its whole cast is seated; otherwise a single line.
       The exchange roll happens BEFORE the line lookup so a table
       with no authored exchange never silently becomes chattier. */
    function buildBeats(trigger, actorId, forceShape){
      var shape = forceShape || 'auto';
      var candidates = global.ChatterLines.exchangesFor(trigger, seated);

      if (shape === 'auto'){
        var roll = Math.random();
        if (roll < cfg.threeBeatChance) shape = 'three';
        else if (roll < cfg.threeBeatChance + cfg.twoBeatChance) shape = 'two';
        else shape = 'single';
      }

      if (shape === 'two' || shape === 'three'){
        var want = shape === 'three' ? 3 : 2;
        var fit = candidates.filter(function(x){ return x.beats.length === want; });
        if (!fit.length) fit = candidates.filter(function(x){ return x.beats.length >= 2; });
        if (fit.length){
          var ex = pick(fit);
          return ex.beats.slice(0, want).map(function(b){
            return { who:b.who, text:b.t, role:b.m };
          });
        }
        shape = 'single';                       // no authored exchange fits
      }

      var speaker = actorId || pick(seated);
      var lines = global.ChatterLines.linesFor(speaker, trigger);
      if (!lines || !lines.length) return null;
      var line = pick(lines);
      return [{ who:speaker, text:line.t, role:line.m }];
    }

    /* ---- playback ------------------------------------------------ */
    function play(beats, meta){
      var my = ++token;
      clearTimers();
      if (presenter && presenter.clearAll) presenter.clearAll();

      var at = 0;
      beats.forEach(function(beat, i){
        var res = global.ChatterResidents.byId(beat.who);
        var art = global.ChatterResidents.moodArt(res, beat.role);
        var dwell = dwellFor(beat.text);
        var payload = {
          resident: res, text: beat.text, role: beat.role, art: art,
          index: i, total: beats.length, dwell: dwell
        };

        later(function(){
          if (faces && faces.set) faces.set(beat.who, art);
          if (presenter && presenter.show) presenter.show(payload);
          /* One shared dialogue chirp for every resident — the sound
             takes no character and no text, only the mood that points
             its pitch flick. See js/chatter/03-voice.js. */
          if (voice && voice.speak && opts.voiceOn !== false){
            voice.speak({ mood: beat.role });
          }
          emit({ type:'beat', beat:payload, trigger:meta.trigger });
        }, at, my);

        later(function(){
          if (presenter && presenter.hide) presenter.hide(payload);
        }, at + dwell, my);

        later(function(){
          if (faces && faces.rest) faces.rest(beat.who);
        }, at + dwell + cfg.settleMs, my);

        at += dwell + cfg.beatGapMs;
        lastByResident[beat.who] = now();
      });

      lastSpokeAt = now() + at;         // cooldown starts from the END of the exchange
      recent.push(now());
      later(function(){ emit({ type:'done', trigger:meta.trigger }); }, at, my);
      return at;
    }

    return {
      config: cfg,
      setSeated: function(ids){ seated = ids.slice(); },
      getSeated: function(){ return seated.slice(); },
      setPresenter: function(p){
        if (presenter && presenter.clearAll) presenter.clearAll();
        presenter = p;
      },
      on: function(fn){ listeners.push(fn); },

      /* The one entry point. `opt.force` bypasses the pacing gates
         (the Lab's manual trigger buttons, and nothing else);
         `opt.shape` forces 'single' | 'two' | 'three'; `opt.text`
         and `opt.role` inject a custom line for the length tests. */
      fire: function(trigger, opt){
        opt = opt || {};
        var actorId = opt.actor || null;
        if (!opt.force){
          var why = refuse(trigger, actorId);
          if (why){
            var v = { spoke:false, reason:why, trigger:trigger };
            emit({ type:'silent', reason:why, trigger:trigger, actor:actorId });
            return v;
          }
        }
        var beats;
        if (opt.beats){
          /* An explicit beat list, used by the Lab's stress scenarios to
             put two NAMED seats in conversation — adjacent, opposite
             sides of the table, a three-beat chain — which the authored
             exchanges cannot express because their cast is fixed. */
          beats = opt.beats.map(function(b){
            return { who:b.who, text:b.text || b.t, role:b.role || b.m || 'rest' };
          }).filter(function(b){ return b.who && b.text; });
        } else if (opt.text){
          beats = [{ who: actorId || seated[0], text: opt.text, role: opt.role || 'rest' }];
        } else {
          beats = buildBeats(trigger, actorId, opt.shape);
        }
        if (!beats || !beats.length){
          emit({ type:'silent', reason:'no line', trigger:trigger, actor:actorId });
          return { spoke:false, reason:'no line', trigger:trigger };
        }
        var ms = play(beats, { trigger:trigger });
        emit({ type:'spoke', trigger:trigger, beats:beats, ms:ms });
        return { spoke:true, beats:beats, ms:ms, trigger:trigger };
      },

      /* Hard stop: cancels every scheduled beat, clears the presenter
         and settles every portrait. The token bump is what makes an
         in-flight timer inert rather than merely unscheduled. */
      reset: function(){
        token++;
        clearTimers();
        if (presenter && presenter.clearAll) presenter.clearAll();
        if (faces && faces.restAll) faces.restAll();
        if (voice && voice.stopAll) voice.stopAll();
      },

      /* Clears only the pacing history, so the Lab can re-test the
         gates without waiting out a real cooldown. */
      clearHistory: function(){
        lastSpokeAt = 0; lastByResident = {}; recent = [];
      }
    };
  }

  global.ChatterDirector = { create:create, DEFAULTS:DEFAULTS };
})(this);
