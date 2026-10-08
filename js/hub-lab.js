"use strict";

/* ============================================================
   HUB LAB — Career opens on your tickets (lab only, never loaded by the game)

   Runs inside the game copy that hub-lab.html builds. Career's screen
   becomes the hub the owner asked for (docs/career/PACKS_PLAN.md, Round 3):

     YOU        bankroll reel and your record, the same parts as today's
                Career screen
     TONIGHT    tickets dealt from your collection for you to choose from,
                each with the reason it was dealt (next step, overdue...)
     BUY IN     pick one: the console says what it is and what it costs
     DOORS      THE CASE (your collection) and THE VENDOR (packs)

   Every ticket is a real catalogue event with its real field of faces;
   the art window shows them until the owner's artwork goes in. TUNE
   switches the deal (3 in a row, 2 rows of 3, a hand of 5) and the
   ticket style (Ticket, Playing card, Slip).
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : {};
  const defaults = { deal:'grid6', style:'ticket', speed:1 };
  Object.keys(defaults).forEach(k => { if (state[k] == null) state[k] = defaults[k]; });
  const save = patch => { Object.assign(state, patch); if (host) host.set(patch); };
  const speed = () => Number(state.speed) || 1;
  const wait = ms => new Promise(r => setTimeout(r, ms / speed()));
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[ch]);
  const money = n => '$' + Number(n).toLocaleString('en-US');
  const short = n => n >= 1000 ? '$' + (Math.round(n / 100) / 10).toString().replace(/\.0$/, '') + 'K' : money(n);
  const S = {
    deal(){ try{ Sound.cardDeal(); }catch(e){} }, flip(){ try{ Sound.cardFlip(); }catch(e){} }, land(){ try{ Sound.cardLanded(); }catch(e){} },
    key(){ try{ Sound.buttonPress('thunk'); }catch(e){} }, tick(s){ try{ Sound.stageRollClick(s || .5, false); }catch(e){} }
  };
  const buzz = p => { try{ haptic(p); }catch(e){} };

  /* the venue key the tickets' paper colours use (career-hub-v2.css) */
  const VENUE_KEY = { 'BACK ROOM':'backroom', 'PUB CIRCUIT':'pub', 'CARD CLUB':'cardclub', 'CASINO FLOOR':'casino', 'HIGH ROLLER ROOM':'highroller', 'INVITATIONAL CHAMPIONSHIP':'invitational' };
  const VENUE_SHORT = { 'BACK ROOM':'BACK ROOM', 'PUB CIRCUIT':'PUB CIRCUIT', 'CARD CLUB':'CARD CLUB', 'CASINO FLOOR':'CASINO', 'HIGH ROLLER ROOM':'HIGH ROLLER', 'INVITATIONAL CHAMPIONSHIP':'INVITATIONAL' };
  const SUIT = { backroom:'♣', pub:'♥', cardclub:'♠', casino:'♦', highroller:'♠', invitational:'♥' };

  /* Tonight's six, as a career a little way in would be dealt them:
     the Back Room cleared, the Pub open, the Card Club a stretch. */
  const DEAL = [
    { id:'pub-freezeout', why:'NEXT STEP', note:'Win it and the Card Club opens' },
    { id:'back-room-five', why:'SAFE BET', note:'Paid in most of these. Builds your stack' },
    { id:'pub-open', why:'NEW', note:'Pulled from a Pub pack last night' },
    { id:'back-room-heads-up', why:'OVERDUE', note:'Not played in 6 visits' },
    { id:'pub-open', why:'WILD CARD', note:'Every 5th hand: bomb pot', wild:'BOMB POT NIGHT' },
    { id:'card-club-deep', why:'A STRETCH', note:'A big buy-in for your bankroll' }
  ];
  function ticketData(d){
    const e = careerEventById(d.id);
    const venue = VENUE_KEY[e.venue] || 'backroom';
    const roster = (() => { try{ return careerRosterFor(e.id) || []; }catch(err){ return []; } })();
    const paid = e.payouts.length;
    const title = d.wild || careerEventTitle(e);
    return {
      id:e.id, venue, venueName:VENUE_SHORT[e.venue] || e.venue, title, why:d.why, note:d.note, wild:!!d.wild,
      seats:e.opponentCount + 1, buyIn:e.buyIn, top:e.payouts[0],
      paidLine:paid + ' PAID', roster
    };
  }

  /* ---- a ticket ---- */
  function faces(t, max){
    return '<span class="hb-faces n' + Math.min(max, t.roster.length) + '">' + t.roster.slice(0, max).map(seat =>
      '<span class="hb-face">' + renderFace({ faceColorIdx:seat.faceColorIdx }, 'idle') + '</span>').join('') + '</span>';
  }
  function ticket(t, i){
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hb-t';
    el.dataset.venue = t.venue; el.dataset.i = i;
    if (t.wild) el.dataset.wild = '1';
    const suit = SUIT[t.venue];
    el.innerHTML =
      '<span class="hb-why">' + esc(t.why) + '</span>' +
      '<span class="hb-t-body">' +
        '<span class="hb-idx hb-idx-a" aria-hidden="true"><b>' + t.seats + '</b><i>' + suit + '</i></span>' +
        '<span class="hb-idx hb-idx-b" aria-hidden="true"><b>' + t.seats + '</b><i>' + suit + '</i></span>' +
        '<span class="hb-venue">' + esc(t.venueName) + '</span>' +
        '<span class="hb-art">' + faces(t, 5) + (t.wild ? '<span class="hb-tag">WILD</span>' : '') + '</span>' +
        '<span class="hb-title">' + esc(t.title) + '</span>' +
        '<span class="hb-line">' + t.seats + ' SEATS · ' + esc(t.paidLine) + '</span>' +
        '<span class="hb-money"><span><small>IN</small><b>' + short(t.buyIn) + '</b></span><span><small>TOP</small><b>' + short(t.top) + '</b></span></span>' +
        (t.wild ? '<span class="hb-foil" aria-hidden="true"><i></i></span>' : '') +
      '</span>';
    return el;
  }

  /* ---- the screen ---- */
  let root, tickets = [], selected = -1;
  function reel(v){
    const digits = String(Math.max(0, Math.floor(v))).padStart(7, '0');
    const lead = 7 - String(Math.max(0, Math.floor(v))).length;
    return '<span class="jp-cell jp-sym">$</span>' + digits.split('').map((d, i) => '<span class="jp-cell jp-digit' + (i < lead ? ' is-leading' : '') + '">' + d + '</span>').join('');
  }
  function build(){
    const careerEl = document.getElementById('career');
    if (!careerEl || document.getElementById('hb')) return;
    careerEl.classList.add('hb-on');
    try{
      career.bankroll = 1840; career.eventsPlayed = 14; career.eventsWon = 4;
      CAREER_EVENT_LIST.forEach(e => { career.unlocks[e.id] = true; });
    }catch(e){}
    root = document.createElement('div');
    root.id = 'hb'; root.className = 'hb';
    root.innerHTML =
      '<div class="hb-top">' +
        '<div class="hb-rail">' +
          '<button class="hb-key" id="hb-back" type="button" aria-label="Back to main menu"><span class="hb-nav" aria-hidden="true"></span></button>' +
          '<span class="hb-plate">CAREER</span>' +
          '<button class="hb-key" id="hb-set" type="button" aria-label="Settings">⚙</button>' +
        '</div>' +
        '<div class="hb-bank"><div class="hb-reel" id="hb-reel">' + reel(1840) + '</div></div>' +
        '<div class="hb-record crt" id="hb-record">' +
          '<span class="crt-cell"><small class="crt-caption">PLAYED</small><strong class="crt-figure tabular">14</strong></span>' +
          '<span class="crt-cell"><small class="crt-caption">WON</small><strong class="crt-figure tabular">4</strong></span>' +
          '<span class="crt-cell"><small class="crt-caption">CIRCUIT</small><strong class="crt-figure tabular">2/6</strong></span>' +
        '</div>' +
      '</div>' +
      '<div class="hb-felt">' +
        '<div class="hb-felt-head"><span class="hb-label">TONIGHT\'S TICKETS</span><button class="hb-key hb-redeal" id="hb-redeal" type="button">RE-DEAL</button></div>' +
        '<div class="hb-deal" id="hb-deal"></div>' +
      '</div>' +
      '<div class="hb-console">' +
        '<div class="hb-readout crt" id="hb-readout"><small class="crt-caption" id="hb-ro-a">PICK A TICKET</small><strong class="crt-line" id="hb-ro-b">TONIGHT\'S DEAL IS ON THE FELT</strong></div>' +
        '<div class="pc-primary-cradle hb-cradle"><span class="pc-slot-aperture" aria-hidden="true"><span class="pc-slot-door"></span></span>' +
          '<button class="pc-button pc-button-primary hb-buy" id="hb-buy" type="button" disabled><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong id="hb-buy-a">BUY IN</strong><small id="hb-buy-b">PICK A TICKET FIRST</small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div>' +
      '</div>' +
      '<div class="hb-doors">' +
        '<button class="btn-secondary hb-door" type="button"><span class="hb-door-ico is-case" aria-hidden="true"></span><span>THE CASE<small>23 TICKETS</small></span></button>' +
        '<button class="btn-secondary hb-door" type="button"><span class="hb-door-ico is-vendor" aria-hidden="true"></span><span>THE VENDOR<small>BUY PACKS</small></span></button>' +
      '</div>';
    careerEl.appendChild(root);
    root.querySelector('#hb-back').addEventListener('click', () => { S.key(); const real = document.getElementById('ch2-back'); if (real) real.click(); });
    root.querySelector('#hb-redeal').addEventListener('click', () => { S.key(); deal(); });
    root.querySelector('#hb-deal').addEventListener('click', e => { const t = e.target.closest('.hb-t'); if (t) pick(+t.dataset.i); });
    paintDeal(false);
    new MutationObserver(() => { if (!careerEl.classList.contains('hidden')) setTimeout(() => deal(), 260); }).observe(careerEl, { attributes:true, attributeFilter:['class'] });
  }
  function count(){ return state.deal === 'row3' ? 3 : state.deal === 'fan5' ? 5 : 6; }
  function paintDeal(hidden){
    const box = root.querySelector('#hb-deal');
    box.dataset.deal = state.deal; root.dataset.style = state.style;
    box.innerHTML = '';
    tickets = DEAL.slice(0, count()).map(ticketData);
    tickets.forEach((t, i) => {
      const el = ticket(t, i);
      el.style.setProperty('--i', i); el.style.setProperty('--n', tickets.length);
      el.insertAdjacentHTML('beforeend', '<span class="hb-back" aria-hidden="true"></span>');
      if (hidden) el.classList.add('is-down'); else el.classList.add('is-dealt');
      box.appendChild(el);
    });
    selected = -1; paintConsole();
  }
  async function deal(){
    paintDeal(true);
    const els = [...root.querySelectorAll('.hb-t')];
    await wait(120);
    for (const el of els){ el.classList.add('is-dealt'); S.deal(); buzz(5); await wait(90); }
    await wait(260);
    for (const el of els){ el.classList.remove('is-down'); S.flip(); await wait(85); }
  }
  function pick(i){
    if (selected === i){ selected = -1; } else selected = i;
    S.land(); buzz(8);
    root.querySelectorAll('.hb-t').forEach((el, j) => { el.classList.toggle('is-picked', j === selected); el.classList.toggle('is-dim', selected >= 0 && j !== selected); });
    paintConsole();
  }
  function paintConsole(){
    const t = tickets[selected];
    const buy = root.querySelector('#hb-buy');
    if (!t){
      root.querySelector('#hb-ro-a').textContent = 'PICK A TICKET';
      root.querySelector('#hb-ro-b').textContent = 'TONIGHT\'S DEAL IS ON THE FELT';
      root.querySelector('#hb-buy-a').textContent = 'BUY IN'; root.querySelector('#hb-buy-b').textContent = 'PICK A TICKET FIRST';
      buy.disabled = true; return;
    }
    root.querySelector('#hb-ro-a').textContent = t.why + ' · ' + t.venueName;
    root.querySelector('#hb-ro-b').textContent = t.note.toUpperCase();
    root.querySelector('#hb-buy-a').textContent = 'BUY IN ' + money(t.buyIn);
    root.querySelector('#hb-buy-b').textContent = t.title + ' · TOP PRIZE ' + money(t.top);
    buy.disabled = false;
  }

  /* ---- TUNE ---- */
  function tune(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'hbl-key'; key.textContent = 'TUNE';
    const sheet = document.createElement('div');
    sheet.className = 'hbl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Hub lab');
    const seg = (k, opts) => '<div class="hbl-seg" data-key="' + k + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (String(state[k]) === String(o[0]) ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
    sheet.innerHTML =
      '<div class="hbl-head"><b>HUB LAB</b><button type="button" class="hbl-close" aria-label="Close">✕</button></div>' +
      '<div class="hbl-body">' +
        '<h3>THE DEAL<small>How many tickets you\'re dealt, and how they lie.</small></h3>' +
        seg('deal', [['row3', '3 IN A ROW'], ['grid6', '2 ROWS OF 3'], ['fan5', 'A HAND OF 5']]) +
        '<h3>THE TICKET<small>Three plain designs, each with a window for your artwork.</small></h3>' +
        seg('style', [['ticket', 'TICKET'], ['card', 'PLAYING CARD'], ['slip', 'SLIP']]) +
        '<h3>MOTION</h3>' + seg('speed', [[1, 'REAL'], [.5, 'HALF'], [.25, 'QUARTER']]) +
      '</div>';
    (root ? root.querySelector('.hb-felt-head') : document.body).insertBefore(key, root ? root.querySelector('#hb-redeal') : null); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => { try{ Sound.unlock(); }catch(e){} open(!sheet.classList.contains('is-open')); });
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.classList.contains('hbl-close')){ open(false); return; }
      const s = t.closest('.hbl-seg'); if (!s) return;
      let v = t.dataset.v; if (s.dataset.key === 'speed') v = Number(v);
      save({ [s.dataset.key]:v });
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
      root.style.setProperty('--hb-speed', state.speed);
      if (s.dataset.key !== 'speed') deal();
    });
  }
  function start(){ build(); tune(); if (root) root.style.setProperty('--hb-speed', state.speed); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
