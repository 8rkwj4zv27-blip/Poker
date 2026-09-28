"use strict";

/* ============================================================
   SPEECH LAB — the controls and the candidate bubbles, inside the game
   (round 1, phone-first)

   Runs in the game copy the host page (speech-lab.html,
   js/speech-lab-host.js) builds. The game plays an ordinary hand; about a
   second after the chosen opponent acts, they say a line (js/speech-lines.js)
   and their face changes to match it. The SAY key makes them say another
   one straight away, so the looks can be compared without waiting.

   Three places for the bubble (WHERE):
   - SEAT: a speech bubble straight off the speaker's seat, tail up at the
     face, kept inside the felt.
   - LANE: one fixed place for all speech, a wide bubble across the upper
     felt between the seats and the board; the tail reaches the speaker.
   - CLOSE-UP: the speaker's face, big, rises over the lower felt with the
     bubble beside it.
   Two finishes (LOOK): cream card stock like the playing cards, or dark
   glass with gold ink like the machine's screens. Both are candidates
   for a new Pattern Book part; nothing here is live.

   Presentation only: the lab wraps applyAction to hear who acted, and
   calls the game's own face chain (playReactionSequence). No poker,
   AI or save code is touched.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { picks:null, opp:'4', sound:'on' };
  const $id = id => document.getElementById(id);

  /* ---- the picks (every row's first option is my suggestion) ---- */
  const ROWS = [
    ['where', 'WHERE', [['seat','FROM THE SEAT'],['lane','FIXED LANE'],['close','CLOSE-UP']],
      'Seat: the bubble comes off their seat. Lane: always the same place, the tail finds them. Close-up: their face, big, over the lower felt.'],
    ['look', 'LOOK', [['card','CARD STOCK'],['glass','DARK GLASS']],
      'Card stock: cream like the playing cards. Dark glass: gold ink, like the machine\'s screens.'],
    ['who', 'WHO SPEAKS', [['top','TOP SEAT'],['left','LEFT SEAT'],['right','RIGHT SEAT']],
      'The side seats are where room is tightest.'],
    ['len', 'LINES', [['short','SHORT'],['long','LONG']], 'Long lines test the worst case.'],
    ['text', 'TEXT', [['pop','ALL AT ONCE'],['type','TYPES ON']]]
  ];
  const DEFAULTS = Object.fromEntries(ROWS.map(r => [r[0], r[2][0][0]]));
  const picks = Object.assign({}, DEFAULTS, state.picks || {});
  const save = () => { if (host) host.set({ picks:Object.assign({}, picks) }); };

  /* ---- who is speaking ---- */
  const opps = () => (game && game.players || []).filter(p => !p.isHuman && !p.eliminated && seatEls[p.id]);
  const rectOf = p => { const e = seatEls[p.id]; return (e.root || e.card).getBoundingClientRect(); };
  function speaker(){
    const list = opps();
    if (!list.length) return null;
    const by = f => list.slice().sort((a, b) => f(rectOf(a)) - f(rectOf(b)))[0];
    if (picks.who === 'left') return by(r => r.left);
    if (picks.who === 'right') return by(r => -r.right);
    // the top seat: highest on the table, and nearest the middle on a tie
    const mid = innerWidth / 2;
    return by(r => r.top * 4 + Math.abs(r.left + r.width / 2 - mid));
  }

  /* ---- lines: each pool goes round in a shuffled order, no repeats ---- */
  const decks = {};
  function lineFor(p, group){
    const key = p.personality && SPEECH_LINES[p.personality.key] ? p.personality.key : 'grinder';
    const pool = SPEECH_LINES[key][group][picks.len];
    const id = key + group + picks.len;
    if (!decks[id] || !decks[id].length) decks[id] = pool.map((_, i) => i).sort(() => Math.random() - .5);
    return pool[decks[id].pop()];
  }
  const groupOf = action => action === 'fold' ? 'fold' : (action === 'call' || action === 'check') ? 'call' : 'bet';

  /* ---- the bubble ---- */
  let live = null;        // { el, timer, typing, p }
  function clear(now){
    if (!live) return;
    const l = live; live = null;
    clearTimeout(l.timer); clearInterval(l.typing);
    const e = seatEls[l.p.id];
    if (e && e.card) e.card.classList.remove('spk-speaking');
    if (now || motionOff()) l.el.remove();
    else { l.el.classList.add('is-out'); setTimeout(() => l.el.remove(), 200); }
    // the face goes back to whatever the table says it should be
    if (e && !l.p.eliminated){ e._mood = null; try{ setMood(l.p.id, restingMood(l.p)); }catch(err){} }
  }

  function say(p, group){
    if (!p) return;
    clear(true);
    const [text, face] = lineFor(p, group);
    const e = seatEls[p.id];
    const felt = $id('felt').getBoundingClientRect();
    const seat = rectOf(p);
    const el = document.createElement('div');
    el.className = 'spk spk--' + picks.where + ' spk--' + picks.look;
    el.setAttribute('role', 'status');
    const name = String(p.name || '').toUpperCase();
    el.innerHTML =
      (picks.where === 'close' ? '<div class="spk-portrait"><div class="spk-face">' + renderFace(p, face) + '</div><div class="spk-plate">' + name + '</div></div>' : '') +
      '<div class="spk-box">' + (picks.where === 'close' ? '' : '<div class="spk-name">' + name + '</div>') +
        '<div class="spk-text"><span class="spk-said"></span><span class="spk-rest"></span></div><i class="spk-tail" aria-hidden="true"></i></div>';
    // typed lines start unsaid (the rest keeps the bubble's final size)
    el.querySelector(picks.text === 'type' && !motionOff() ? '.spk-rest' : '.spk-said').textContent = text;
    document.body.appendChild(el);
    const box = el.querySelector('.spk-box');
    const tail = el.querySelector('.spk-tail');
    const pad = 8;

    if (picks.where === 'seat' || picks.where === 'lane'){
      const lane = picks.where === 'lane';
      const w = lane ? felt.width - pad * 4 : Math.min(250, felt.width - pad * 2);
      el.style.width = w + 'px';
      const cx = seat.left + seat.width / 2;
      const left = lane ? felt.left + pad * 2 : Math.max(felt.left + pad, Math.min(felt.right - pad - w, cx - w / 2));
      // under the lowest seat card (their hole cards hang below it)
      const seatsBottom = Math.max(...opps().map(q => rectOf(q).bottom));
      const top = lane ? seatsBottom + 34 : seat.bottom + 22;
      el.style.left = left + 'px'; el.style.top = top + 'px';
      tail.style.left = Math.max(14, Math.min(w - 30, cx - left - 8)) + 'px';
      if (lane) tail.style.height = (top - seat.bottom + 2) + 'px';
      el.style.transformOrigin = (cx - left) + 'px 0';
    } else {
      // the close-up: over the lower felt, clear of the console
      const w = felt.width - pad * 3;
      el.style.width = w + 'px';
      el.style.left = (felt.left + pad * 1.5) + 'px';
      el.style.top = (felt.bottom - 14 - 132) + 'px';
      const cx = seat.left + seat.width / 2;
      el.classList.toggle('is-right', cx > felt.left + felt.width * 0.62);
    }

    // their seat lights up and their face changes to match the line
    if (e && e.card) e.card.classList.add('spk-speaking');
    const chars = text.length;
    const hold = Math.min(6500, 2000 + chars * 55);
    try{ playReactionSequence(p.id, [{ mood:face, ms:hold + 400 }]); }catch(err){}

    live = { el, p, timer:null, typing:null };
    const done = () => { if (live && live.el === el) live.timer = setTimeout(() => clear(false), hold); };
    if (picks.text === 'type' && !motionOff()){
      const said = el.querySelector('.spk-said'), rest = el.querySelector('.spk-rest');
      let i = 0;
      live.typing = setInterval(() => {
        i = Math.min(chars, i + 1);
        said.textContent = text.slice(0, i); rest.textContent = text.slice(i);
        if (i >= chars){ clearInterval(live && live.typing); done(); }
      }, 32);
    } else done();
    el.addEventListener('click', () => clear(false));
    requestAnimationFrame(() => el.classList.add('is-in'));
  }

  /* ---- hearing who acted: the chosen speaker talks once a hand ---- */
  let spokenHand = -1, lastGroup = null, pending = null;
  const realApply = window.applyAction;
  window.applyAction = function(player, decision){
    const out = realApply.apply(this, arguments);
    try{
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
    const s = speaker();
    const g = lastGroup && groupTurn === 0 ? lastGroup : ['bet', 'call', 'fold'][groupTurn % 3];
    groupTurn++;
    say(s, g);
  }
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'spl-key'; key.textContent = 'TUNE';
    const sayKey = document.createElement('button');
    sayKey.type = 'button'; sayKey.className = 'spl-key spl-say-key'; sayKey.textContent = 'SAY';
    const sheet = document.createElement('div');
    sheet.className = 'spl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Speech lab');
    sheet.innerHTML =
      '<div class="spl-top"><span>SPEECH LAB</span><button type="button" class="spl-close" aria-label="Close">✕</button></div>' +
      '<div class="spl-body">' +
        '<p class="spl-sub">Play the hand as normal. A second after the chosen opponent acts, they say something. SAY makes them say another line straight away. Tap a bubble to dismiss it.</p>' +
        '<div class="spl-actions"><button type="button" data-act="say">SAY SOMETHING</button><button type="button" data-act="deal">NEW TABLE</button></div>' +
        ROWS.map(row).join('') +
        '<h3>THE TABLE</h3>' +
        '<div class="spl-row"><div class="spl-name">OPPONENTS</div>' + seg('opp', [['4','4'],['6','6']], state.opp) + '<p class="spl-note">Changing this deals a new table.</p></div>' +
        '<div class="spl-row"><div class="spl-name">SOUND</div>' + seg('sound', [['on','ON'],['off','OFF']], state.sound) + '</div>' +
        '<div class="spl-actions"><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
        '<textarea class="spl-copytext" readonly hidden></textarea>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(sayKey); document.body.appendChild(sheet);
    // the keys sit either side of the board, in the felt's empty margins,
    // clear of every seat and of the close-up
    const place = () => {
      const f = $id('felt').getBoundingClientRect();
      const y = f.top + f.height * 0.5 - 22;
      key.style.left = (f.left + 8) + 'px'; key.style.top = y + 'px';
      sayKey.style.left = (f.right - 8 - 44) + 'px'; sayKey.style.right = 'auto'; sayKey.style.top = y + 'px';
    };
    place(); addEventListener('resize', place);
    setTimeout(place, 600); setTimeout(place, 2000);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sayKey.addEventListener('click', () => { open(false); sayNow(); });
    sheet.querySelector('.spl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', ev => {
      const t = ev.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'say'){ open(false); setTimeout(sayNow, 250); return; }
      if (t.dataset.act === 'deal'){ open(false); clear(true); deal(); return; }
      if (t.dataset.act === 'copy'){
        const text = 'Speech Lab (round 1):\n' + ROWS.map(r => '- ' + r[1] + ': ' + r[2].find(o => o[0] === picks[r[0]])[1]).join('\n') + '\n- OPPONENTS: ' + state.opp;
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
      if (k === 'len') groupTurn = 0;
    });
  }

  function deal(){
    spokenHand = -1; lastGroup = null; groupTurn = 0;
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
