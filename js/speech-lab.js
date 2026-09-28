"use strict";

/* ============================================================
   SPEECH LAB — the controls and the candidate close-up, inside the game
   (round 3, phone-first)

   Runs in the game copy the host page (speech-lab.html,
   js/speech-lab-host.js) builds. The game plays an ordinary hand; about a
   second after the chosen opponent acts, they say a line
   (js/speech-lines.js) in their own blip voice (js/speech-voice.js),
   their face changes to match it, and the line types on in time with the
   voice. The SAY key makes them say another one straight away.

   Rounds 1 and 2 are locked in: the CLOSE-UP in CARD STOCK, a medium face
   framed in the seat's colour with the name under it, a bubble that grows
   as it types, low, on the speaker's side, popping in. The voice is
   BLIPS; round 3 gives the blips their choices (js/speech-voice.js).

   Presentation only: the lab wraps applyAction to hear who acted, and
   calls the game's own face chain (playReactionSequence). No poker,
   AI or save code is touched.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { picks:null, opp:'4', sound:'on' };
  const $id = id => document.getElementById(id);

  /* ---- the picks (every row's first option is my suggestion) ---- */
  const LOCKED_LIST = ['Where: close-up', 'Look: card stock', 'Face: medium, in their colour', 'Name: under the face',
    'Bubble: grows as it types', 'Height: low', 'Side: their side', 'Arrival: pops'];
  // round 2's close-up picks, fixed
  const CLOSE = { face:'72', fit:'grow', frame:'own', name:'plate', height:'low', side:'theirs', arrive:'pop' };
  const SECTIONS = [
    { title:'THE BLIPS', sub:'Every character has their own blip now. Changing a row plays a sample.', rows:[
      ['blip', 'SOUND', [['own','THEIR OWN'],['pip','PIP'],['soft','SOFT'],['chirp','CHIRP'],['wood','WOOD'],['bell','BELL'],['machine','MACHINE']],
        'Their own: Nigel and Harry tick like a machine, Lucy is a bell, Tony and Roxy chirp, Mavis is soft, Steve a plain pip, Bruno a wooden knock. Or pick one sound for everyone to compare.'],
      ['family', 'HOW DIFFERENT', [['0.5','CLOSE'],['0.3','CLOSER'],['0.7','A BIT APART'],['1','ROUND 4']],
        'How far each character\'s blip strays from one shared pip, and their pitches from each other. Lower sounds more like one family.'],
      ['often', 'HOW OFTEN', [['other','EVERY OTHER LETTER'],['letter','EVERY LETTER'],['syllable','EVERY SYLLABLE']]],
      ['melody', 'MELODY', [['key','IN TUNE'],['free','FREE (ROUND 2)'],['steady','ONE NOTE']],
        'In tune: the notes come from a five-note scale, so a line sounds like a little tune. One note: level, only a question rises.'],
      ['pitch', 'PITCH', [['own','THEIR OWN'],['same','ALL THE SAME']], 'Their own: Bruno low, Mavis high.'],
      ['vol', 'VOLUME', [['0.3','LOW'],['0.5','MEDIUM'],['0.8','HIGH']]],
      ['pace', 'TALKING PACE', [['even','EVERYONE THE SAME'],['own','THEIR OWN']], 'Their own: Tony gabbles, Bruno takes his time.']
    ]},
    { title:'THE LINE', rows:[
      ['who', 'WHO SPEAKS', [['any','ANYONE'],['left','LEFT SEAT'],['top','TOP SEAT'],['right','RIGHT SEAT']], 'Anyone: a different opponent each hand, and SAY goes round the table.'],
      ['len', 'LINES', [['long','LONG'],['short','SHORT']]],
      ['text', 'TEXT', [['type','TYPES ON'],['pop','ALL AT ONCE']]]
    ]}
  ];
  const ROWS = SECTIONS.flatMap(s => s.rows);
  const DEFAULTS = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  const picks = Object.assign({}, DEFAULTS, state.picks || {}, CLOSE);
  const save = () => { if (host) host.set({ picks:Object.assign({}, picks) }); };
  const voiceSet = () => { try{ SpeechVoice.set({ family:Number(picks.family), sound:picks.blip, often:picks.often, melody:picks.melody, pitch:picks.pitch, level:Number(picks.vol) }); }catch(e){} };
  voiceSet();

  /* ---- who is speaking ---- */
  const opps = () => (game && game.players || []).filter(p => !p.isHuman && !p.eliminated && seatEls[p.id]);
  const rectOf = p => { const e = seatEls[p.id]; return (e.root || e.card).getBoundingClientRect(); };
  let anyTarget = null, anyTurn = 0;
  function speaker(){
    const list = opps();
    if (!list.length) return null;
    if (picks.who === 'any') return list.includes(anyTarget) ? anyTarget : list[0];
    const by = f => list.slice().sort((a, b) => f(rectOf(a)) - f(rectOf(b)))[0];
    if (picks.who === 'left') return by(r => r.left);
    if (picks.who === 'right') return by(r => -r.right);
    const mid = innerWidth / 2;
    return by(r => r.top * 4 + Math.abs(r.left + r.width / 2 - mid));
  }

  /* ---- lines: each pool goes round in a shuffled order, no repeats ---- */
  const decks = {};
  const keyOf = p => p.personality && SPEECH_LINES[p.personality.key] ? p.personality.key : 'grinder';
  function lineFor(p, group){
    const key = keyOf(p);
    const pool = SPEECH_LINES[key][group][picks.len];
    const id = key + group + picks.len;
    if (!decks[id] || !decks[id].length) decks[id] = pool.map((_, i) => i).sort(() => Math.random() - .5);
    return pool[decks[id].pop()];
  }
  const groupOf = action => action === 'fold' ? 'fold' : (action === 'call' || action === 'check') ? 'call' : 'bet';

  /* ---- the close-up ---- */
  let live = null;        // { el, timers, p }
  function clear(now){
    if (!live) return;
    const l = live; live = null;
    l.timers.forEach(clearTimeout);
    const e = seatEls[l.p.id];
    if (e && e.card) e.card.classList.remove('spk-speaking');
    if (now || motionOff()) l.el.remove();
    else { l.el.classList.add('is-out'); setTimeout(() => l.el.remove(), 220); }
    // the face goes back to whatever the table says it should be
    if (e && !l.p.eliminated){ e._mood = null; try{ setMood(l.p.id, restingMood(l.p)); }catch(err){} }
  }

  function say(p, group){
    if (!p) return;
    clear(true);
    const [text, face] = lineFor(p, group);
    const key = keyOf(p);
    const e = seatEls[p.id];
    const felt = $id('felt').getBoundingClientRect();
    const seat = rectOf(p);
    const onRight = seat.left + seat.width / 2 > felt.left + felt.width * 0.6;
    const right = picks.side === 'theirs' && onRight;
    const name = String(p.name || '').toUpperCase();
    const own = (e && e.root && e.root.style.getPropertyValue('--ec-own')) || '#B69A7A';

    const el = document.createElement('div');
    el.className = ['spk', 'spk--close', 'spk--card', 'spk-fit-' + picks.fit, 'spk-frame-' + picks.frame,
      'spk-arrive-' + picks.arrive, right ? 'is-right' : ''].join(' ');
    el.setAttribute('role', 'status');
    el.style.setProperty('--spk-face', picks.face + 'px');
    el.style.setProperty('--spk-own', own);
    el.innerHTML =
      '<div class="spk-portrait"><div class="spk-face">' + renderFace(p, face) + '</div>' +
        (picks.name === 'plate' ? '<div class="spk-plate">' + name + '</div>' : '') + '</div>' +
      '<div class="spk-box">' + (picks.name === 'bubble' ? '<div class="spk-name">' + name + '</div>' : '') +
        '<div class="spk-text"><span class="spk-said"></span><span class="spk-rest"></span></div><i class="spk-tail" aria-hidden="true"></i></div>';
    const typed = picks.text === 'type' && !motionOff();
    el.querySelector(typed ? '.spk-rest' : '.spk-said').textContent = text;
    document.body.appendChild(el);

    // the row spans the felt; the bubble inside it sizes to the line
    const pad = 10;
    el.style.left = (felt.left + pad) + 'px';
    el.style.width = (felt.width - pad * 2) + 'px';
    const h = el.offsetHeight;
    const seatsBottom = Math.max(...opps().map(q => rectOf(q).bottom));
    let top;
    if (picks.height === 'mid'){
      const boardTop = felt.top + felt.height * 0.44;
      top = seatsBottom + Math.max(8, (boardTop - seatsBottom - h) / 2);
    } else {
      // just above your own hole cards, which stand up into the felt
      const me = game.players.find(q => q.isHuman), mine = me && seatEls[me.id] && seatEls[me.id].cardsContainer;
      const cardsTop = mine ? mine.getBoundingClientRect().top : 0;
      const floor = cardsTop > felt.top + felt.height * 0.5 ? cardsTop - 10 : felt.bottom - 16;
      top = Math.min(felt.bottom - 16, floor) - h;
    }
    el.style.top = Math.round(top) + 'px';
    el.style.setProperty('--spk-from', (right ? 1 : -1) * felt.width * 0.6 + 'px');

    // their seat lights up and their face changes to match the line
    if (e && e.card) e.card.classList.add('spk-speaking');
    const plan = SpeechVoice.plan(key, text, face, picks.pace === 'even');
    const hold = Math.min(6000, 1800 + text.length * 45);
    try{ playReactionSequence(p.id, [{ mood:face, ms:plan.total + hold + 400 }]); }catch(err){}

    live = { el, p, timers:[] };
    const lead = motionOff() ? 0 : 160;     // the bubble lands, then they start
    const l = live;
    l.timers.push(setTimeout(() => { try{ SpeechVoice.speak(key, text, face, picks.pace === 'even'); }catch(err){} }, lead));
    if (typed){
      const said = el.querySelector('.spk-said'), rest = el.querySelector('.spk-rest');
      plan.times.forEach((ms, i) => l.timers.push(setTimeout(() => {
        said.textContent = text.slice(0, i + 1); rest.textContent = text.slice(i + 1);
      }, lead + ms)));
    }
    l.timers.push(setTimeout(() => { if (live === l) clear(false); }, lead + (typed ? plan.total : 0) + hold));
    el.addEventListener('click', () => clear(false));
    requestAnimationFrame(() => el.classList.add('is-in'));
  }

  /* ---- hearing who acted: the speaker talks once a hand ---- */
  let spokenHand = -1, lastGroup = null, pending = null, anyHand = -1;
  const realApply = window.applyAction;
  window.applyAction = function(player, decision){
    const out = realApply.apply(this, arguments);
    try{
      if (picks.who === 'any' && anyHand !== game.handNumber){
        anyHand = game.handNumber;
        const list = opps().filter(q => q.inHand && !q.folded);
        anyTarget = list[Math.floor(Math.random() * list.length)] || null;
      }
      const s = speaker();
      if (s && player === s && decision){
        lastGroup = groupOf(decision.action);
        if (spokenHand !== game.handNumber){
          spokenHand = game.handNumber;
          const g = lastGroup;
          clearTimeout(pending);
          pending = setTimeout(() => say(s, g), motionOff() ? 300 : 1000);
        }
      }
    }catch(err){ console.error(err); }
    return out;
  };

  /* ---- the keys and the sheet ---- */
  const seg = (key, opts, cur) => '<div class="spl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="spl-row"><div class="spl-name">' + r[1] + '</div>' + seg(r[0], r[2], picks[r[0]]) + (r[3] ? '<p class="spl-note">' + r[3] + '</p>' : '') + '</div>';
  let groupTurn = 0;
  function sayNow(){
    if (picks.who === 'any'){ const list = opps(); anyTarget = list[anyTurn++ % Math.max(1, list.length)]; }
    const g = lastGroup && groupTurn === 0 ? lastGroup : ['bet', 'call', 'fold'][groupTurn % 3];
    groupTurn++;
    say(speaker(), g);
  }
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'spl-key'; key.textContent = 'TUNE';
    const sayKey = document.createElement('button');
    sayKey.type = 'button'; sayKey.className = 'spl-key spl-say-key'; sayKey.textContent = 'SAY';
    const sheet = document.createElement('div');
    sheet.className = 'spl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Speech lab');
    sheet.innerHTML =
      '<div class="spl-top"><span>SPEECH LAB · ROUND 5</span><button type="button" class="spl-close" aria-label="Close">✕</button></div>' +
      '<div class="spl-body">' +
        '<p class="spl-sub">Play the hand as normal. A second after the chosen opponent acts, they say something. SAY makes them say another line straight away. Tap a bubble to dismiss it. Sound needs one tap first on an iPhone.</p>' +
        '<div class="spl-actions"><button type="button" data-act="say">SAY SOMETHING</button><button type="button" data-act="deal">NEW TABLE</button></div>' +
        SECTIONS.map(s => '<h3>' + s.title + (s.sub ? '<small>' + s.sub + '</small>' : '') + '</h3>' + s.rows.map(row).join('')).join('') +
        '<h3>THE TABLE</h3>' +
        '<div class="spl-row"><div class="spl-name">OPPONENTS</div>' + seg('opp', [['4','4'],['6','6']], state.opp) + '<p class="spl-note">Changing this deals a new table.</p></div>' +
        '<div class="spl-row"><div class="spl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
        '<h3>LOCKED IN<small>Your round-1 and round-2 picks.</small></h3><ul class="spl-locked">' + LOCKED_LIST.map(t => '<li>' + t + '</li>').join('') + '</ul>' +
        '<div class="spl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
        '<textarea class="spl-copytext" readonly hidden></textarea>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sayKey); document.body.appendChild(sheet);
    // the keys sit either side of the board, in the felt's empty margins
    const place = () => {
      const f = $id('felt').getBoundingClientRect();
      const y = f.top + f.height * 0.5 - 22;
      key.style.left = (f.left + 8) + 'px'; key.style.top = y + 'px';
      sayKey.style.left = (f.right - 8 - 44) + 'px'; sayKey.style.top = y + 'px';
    };
    place(); addEventListener('resize', place);
    setTimeout(place, 600); setTimeout(place, 2000);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    const paint = () => sheet.querySelectorAll('.spl-seg').forEach(s => {
      const k = s.dataset.key, cur = k === 'opp' || k === 'sound' ? state[k] : picks[k];
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === cur));
    });
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sayKey.addEventListener('click', () => { open(false); sayNow(); });
    sheet.querySelector('.spl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', ev => {
      const t = ev.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'say'){ open(false); setTimeout(sayNow, 250); return; }
      if (t.dataset.act === 'deal'){ open(false); clear(true); deal(); return; }
      if (t.dataset.act === 'reset'){ Object.assign(picks, DEFAULTS, CLOSE); save(); voiceSet(); paint(); return; }
      if (t.dataset.act === 'copy'){
        const text = 'Speech Lab (round 5):\n' + ROWS.map(r => '- ' + r[1] + ': ' + r[2].find(o => o[0] === picks[r[0]])[1]).join('\n') + '\n- OPPONENTS: ' + state.opp;
        const ta = sheet.querySelector('.spl-copytext');
        const fin = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => fin(true), () => fin(false)); }catch(err){ fin(false); }
        return;
      }
      const s = t.closest('.spl-seg');
      if (!s) return;
      const k = s.dataset.key, v = t.dataset.v;
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
      if (k === 'opp'){ state.opp = v; if (host) host.set({ opp:v }); open(false); clear(true); deal(); return; }
      if (k === 'sound'){ state.sound = v; if (host) host.set({ sound:v }); try{ settings.sound = v === 'on'; }catch(err){} return; }
      picks[k] = v; save();
      if (['blip', 'family', 'often', 'melody', 'pitch', 'vol', 'pace'].includes(k)){
        voiceSet();
        // a sample, so the voice can be heard as it's picked
        const sp = speaker(); if (sp) try{ SpeechVoice.speak(keyOf(sp), 'Go on, then. Show me.', 'neutral1', picks.pace === 'even'); }catch(err){}
      }
      if (k === 'len') groupTurn = 0;
    });
  }

  function deal(){
    spokenHand = -1; lastGroup = null; groupTurn = 0; anyHand = -1;
    startSinglePlayerRun({ opponentCount:Number(state.opp) || 4 });
  }

  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}   // it has its own lab
    try{ settings.sound = state.sound !== 'off'; }catch(e){}
    build();
    deal();
    addEventListener('resize', () => clear(true));
  }
  window.__splLab = { say:(g) => say(speaker(), g || 'bet'), sayNow, clear, picks, deal, get live(){ return live && live.el; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
