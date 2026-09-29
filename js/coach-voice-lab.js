"use strict";

/* ============================================================
   COACH VOICE LAB — the controls, inside the game (round 1, phone-first)

   The coach talks: js/coach-talk.js + css/coach-talk.css, on the set and
   rig locked in the Face and Rig Labs (js/coach-set.js). Play real hands
   and he speaks on real moments, as much as the TALK SLIDER lets him. Or
   make him say any moment's line now.

   On the table: TUNE opens the sheet; SAY makes him say something that
   fits the table right now; the COACH key (next to ⚙) switches him on
   and off. Tap a bubble to dismiss it. The sheet:
     TRY IT   every moment as a key: he says its line straight away
     TALK     the talk slider, how long a line stays up
     BUBBLE   where it sits, the look, typing, how it arrives
     VOICE    his blip, pitch, how often it blips, pace, volume, mouth
   COPY MY PICKS (on TALK) copies every row as one line.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { order:null };
  const CS = CoachSet, CT = CoachTalk;
  const ROWS = {
    notch:{ tab:'talk', name:'THE TALK SLIDER', note:'1 COMMENTS: reactions only. 2 DEBRIEF: + how a hand ended, all ins, knock-outs. 3 TIPS: + the price when you face a bet, strong starting hands. 4 IN YOUR EAR: + every deal, raise and move.' },
    hold:{ tab:'talk', name:'HOW LONG A LINE STAYS UP', note:'Tap a bubble to put it away sooner.' },
    where:{ tab:'bubble', name:'WHERE IT SITS', note:'ABOVE HIM: over his set, the tail pointing down at his screen. BESIDE HIM: on the table side of him. ACROSS THE FELT: the full width, above him.' },
    look:{ tab:'bubble', name:'THE LOOK', note:'CARD STOCK: the opponents\' bubble from the Speech Lab. HIS SCREEN: dark glass in his own ink.' },
    textIn:{ tab:'bubble', name:'THE WORDS' },
    type:{ tab:'bubble', name:'TYPE', note:'The screen font is Press Start 2P, the buttons\' and CRT screens\' face. NUMBERS + CARDS: the words stay in the pixel face; numbers and card names (in capitals, like the hand readout) in the screen font. NUMBERS ONLY: card names stay in the pixel face.' },
    arrive:{ tab:'bubble', name:'HOW IT ARRIVES' },
    voice:{ tab:'voice', name:'HIS BLIP', note:'All low and steady, a notch under the opponents. STEADY PIP: one warm note. TELEPRINTER: a tick with a tiny tone. TWO NOTES: a little up-down. LOW HUM: a soft sine.' },
    pitch:{ tab:'voice', name:'PITCH' },
    often:{ tab:'voice', name:'HOW OFTEN IT BLIPS' },
    pace:{ tab:'voice', name:'TALKING PACE' },
    volume:{ tab:'voice', name:'VOLUME', note:'SILENT: he still types and his mouth still moves.' },
    mouth:{ tab:'voice', name:'HIS MOUTH' }
  };
  const KEYS = Object.keys(ROWS);
  let order = Object.assign({}, CT.DEFAULTS, state.order && state.order.notch ? state.order : {});
  const wasOn = state.on;

  function save(){ if (host) host.set({ order:Object.assign({}, order), on:CS.on }); }
  function applyOrder(){ CT.apply(order); save(); paint(); }

  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = k => '<div class="sdl-row"><div class="sdl-name">' + ROWS[k].name + '</div>' + seg(k, CT.OPTIONS[k], order[k]) + (ROWS[k].note ? '<p class="sdl-note">' + ROWS[k].note + '</p>' : '') + '</div>';

  /* every moment, with a line that fits the table as it is */
  const MOMENTS = [
    ['dealtPremium', 'DEALT: A STRONG HAND'], ['dealtWeak', 'DEALT: A WEAK HAND'], ['dealtMiddle', 'DEALT: IN BETWEEN'], ['dealtStrong', 'DEALT: GOOD'],
    ['oppRaise', 'THEY RAISE'], ['oppBigBet', 'THEY BET BIG'], ['oppAllIn', 'THEY GO ALL IN'],
    ['yourPrice', 'YOUR TURN: A BET TO CALL'], ['yourFree', 'YOUR TURN: NO BET'],
    ['youFold', 'YOU FOLD'], ['youCall', 'YOU CALL'], ['youRaise', 'YOU RAISE'], ['youAllIn', 'YOU GO ALL IN'],
    ['winBig', 'YOU WIN BIG'], ['winSmall', 'YOU WIN SMALL'], ['allFolded', 'THEY ALL FOLD'],
    ['loseShowdown', 'YOU LOSE AT SHOWDOWN'], ['loseBig', 'YOU LOSE BIG'], ['oppOut', 'SOMEONE\'S OUT'], ['youOut', 'YOU\'RE OUT']
  ];
  function sampleCtx(){
    const g = game || {}, me = (g.players || []).find(p => p.isHuman) || {}, opp = (g.players || []).find(p => !p.isHuman && !p.eliminated) || { name:'Tony' };
    let hole = 'Ace-King suited', pct = 3;
    try{ if (me.hand && me.hand.length === 2){ hole = describeHole(me.hand); pct = Math.max(1, Math.round(preflopPercentile(me.hand) * 100)); } }catch(e){}
    const call = Math.max(20, (g.currentBet || 0) - (me.betThisRound || 0)), pot = Math.max(60, g.pot || 0);
    return { hole, pct, name:opp.name, amt:(call * 3).toLocaleString(), call:call.toLocaleString(), pot:pot.toLocaleString(), odds:Math.round(call / (pot + call) * 100), won:(pot * 2).toLocaleString() };
  }

  /* TRY IT's deal keys say their line about an example hand of that kind,
     with its true rank (not whatever you happen to hold) */
  const exampleOf = (a, b, suited) => {
    try{
      const cards = [{ value:a, suit:'♠' }, { value:b, suit:suited ? '♠' : '♥' }];
      return { hole:describeHole(cards), pct:Math.max(1, Math.round(preflopPercentile(cards) * 100)) };
    }catch(e){ return {}; }
  };
  const EXAMPLE = {};
  try{
    EXAMPLE.dealtPremium = exampleOf(14, 14);
    EXAMPLE.dealtStrong = exampleOf(11, 10, true);
    EXAMPLE.dealtMiddle = exampleOf(9, 8);
    EXAMPLE.dealtWeak = exampleOf(7, 2);
  }catch(e){}
  const TABS = [
    ['try', 'TRY IT'], ['talk', 'TALK'], ['bubble', 'BUBBLE'], ['voice', 'VOICE']
  ];
  function pane(tab){
    if (tab === 'try'){
      return '<h3>TRY IT<small>Each key makes him say that moment\'s line now, with the table\'s real cards and names. Or just play: he talks on his own, as much as the talk slider lets him. The first of each row elsewhere is my suggestion.</small></h3>' +
        '<div class="sdl-moments cvl-moments">' + MOMENTS.map(m => '<button type="button" data-say="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>';
    }
    let html = KEYS.filter(k => ROWS[k].tab === tab).map(row).join('');
    if (tab === 'talk'){
      html += '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
        '<button type="button" class="sdl-again" data-act="deal">DEAL AGAIN</button>' +
        '<textarea class="sdl-copytext" readonly hidden></textarea>';
    }
    return html;
  }

  let sheet, key, sayKey;
  function paint(){
    if (!sheet) return;
    const body = sheet.querySelector('.sdl-body'), top = body.scrollTop;
    TABS.forEach(t => { sheet.querySelector('[data-pane="' + t[0] + '"]').innerHTML = pane(t[0]); });
    body.scrollTop = top;
  }
  const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
  function sayNow(){
    // something that fits the table right now
    const g = game || {}, me = (g.players || []).find(p => p.isHuman);
    let m = 'dealtMiddle';
    try{
      if (pendingHumanPlayer === me){ m = g.currentBet - me.betThisRound > 0 ? 'yourPrice' : 'yourFree'; }
      else if (me && me.hand && me.hand.length === 2){ const p = preflopPercentile(me.hand); m = p < .06 ? 'dealtPremium' : p < .2 ? 'dealtStrong' : p < .5 ? 'dealtMiddle' : 'dealtWeak'; }
    }catch(e){}
    CT.sayAny(m, sampleCtx());
  }
  function build(){
    key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    sayKey = document.createElement('button');
    sayKey.type = 'button'; sayKey.className = 'sdl-key sdl-again-key'; sayKey.textContent = 'SAY';
    sayKey.addEventListener('click', () => { open(false); sayNow(); });
    sheet = document.createElement('div');
    sheet.className = 'sdl-sheet cvl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Coach voice lab');
    sheet.innerHTML = '<div class="sdl-tabs" role="tablist">' + TABS.map((t, i) => '<button type="button" data-tab="' + t[0] + '"' + (i ? '' : ' class="is-on"') + '>' + t[1] + '</button>').join('') +
      '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' + TABS.map((t, i) => '<section data-pane="' + t[0] + '"' + (i ? ' hidden' : '') + '></section>').join('') + '</div>';
    document.body.append(key, sayKey, sheet);
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        sheet.querySelector('.sdl-body').scrollTop = 0;
        return;
      }
      if (t.dataset.say){
        open(false);
        const m = t.dataset.say, ctx = Object.assign(sampleCtx(), EXAMPLE[m] || {});
        if (!CS.on){ CS.power(true).then(() => CT.sayAny(m, ctx)); } else CT.sayAny(m, ctx);
        return;
      }
      const act = t.dataset.act;
      if (act === 'deal'){ save(); if (host) host.play(); else location.reload(); return; }
      if (act === 'reset'){ order = Object.assign({}, CT.DEFAULTS); applyOrder(); return; }
      if (act === 'copy'){ copyPicks(t); return; }
      const holder = t.closest('[data-key]');
      if (!holder) return;
      order[holder.dataset.key] = t.dataset.v;
      applyOrder();
      // hear the change straight away
      if (['voice', 'pitch', 'often', 'pace', 'volume', 'mouth', 'where', 'look', 'textIn', 'arrive', 'type'].includes(holder.dataset.key) && CS.on){ open(false); setTimeout(sayNow, 250); }
    });
    paint();
  }
  function copyPicks(t){
    const name = (k, v) => { const r = (CT.OPTIONS[k] || []).find(x => x[0] === v); return r ? r[1] : v; };
    const text = 'COACH VOICE: ' + KEYS.map(k => ROWS[k].name.toLowerCase() + ' ' + name(k, order[k])).join(' · ');
    const ta = sheet.querySelector('.sdl-copytext');
    const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
    try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(e){ done(false); }
  }

  /* ---- start: a fresh table; he comes on once it's dealt ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    CT.apply(order);
    build();
    document.addEventListener('click', e => { if (e.target.closest('#coach-key')) setTimeout(save, 50); });
    try{ startSinglePlayerRun({ opponentCount:4 }); }catch(err){ console.error(err); }
    // quick boot in this lab: it's about his voice
    CS.apply(Object.assign({}, CS.DEFAULTS, { bootLen:'quick' }));
    setTimeout(() => { if (wasOn || wasOn == null) CS.power(true).then(() => { save(); setTimeout(sayNow, 400); }); }, 2400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
