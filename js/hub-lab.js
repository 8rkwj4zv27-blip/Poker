"use strict";

/* ============================================================
   HUB LAB — Career opens on your tickets (lab only, never loaded by the game)

   Runs inside the game copy that hub-lab.html builds. Career's screen
   becomes the hub the owner asked for (docs/career/PACKS_PLAN.md, Round 3):

     YOU       bankroll reel and record, the same parts as today's Career
     TONIGHT   six tickets dealt from the deck in the corner of the felt,
               each tabbed with why it was dealt. Every kind of ticket has
               its own look: events are tickets, new formats are machine
               slips, character tables and wilds are playing cards, jinxes
               are dark slips
     PICK      tap a ticket to pick it; press and drag to pick it up and
               carry it; in the hand of five, slide along the fan
     FEED      drag the ticket into the slot, or press BUY IN: it goes in,
               the bankroll counts down and the real table rolls in
     DOORS     THE CASE and THE VENDOR (their screens are the next labs)

   Every ticket plays a real catalogue event with its real field of faces;
   the art window shows them until the owner's artwork goes in.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : {};
  const defaults = { deal:'grid6', speed:1 };
  Object.keys(defaults).forEach(k => { if (state[k] == null) state[k] = defaults[k]; });
  const save = patch => { Object.assign(state, patch); if (host) host.set(patch); };
  const speed = () => Number(state.speed) || 1;
  const wait = ms => new Promise(r => setTimeout(r, ms / speed()));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[ch]);
  const money = n => '$' + Number(n).toLocaleString('en-US');
  const short = n => n >= 1000 ? '$' + (Math.round(n / 100) / 10).toString().replace(/\.0$/, '') + 'K' : money(n);
  const S = {
    deal(){ try{ Sound.cardDeal(); }catch(e){} }, flip(){ try{ Sound.cardFlip(); }catch(e){} }, land(){ try{ Sound.cardLanded(); }catch(e){} },
    lift(){ try{ Sound.cardReturn(); }catch(e){} }, key(){ try{ Sound.buttonPress('thunk'); }catch(e){} },
    tick(s){ try{ Sound.stageRollClick(s || .5, false); }catch(e){} }, bite(){ try{ Sound.hatchClose(); }catch(e){} }
  };
  const buzz = p => { try{ haptic(p); }catch(e){} };
  const TW = 112, TH = 157;

  const VENUE_KEY = { 'BACK ROOM':'backroom', 'PUB CIRCUIT':'pub', 'CARD CLUB':'cardclub', 'CASINO FLOOR':'casino', 'HIGH ROLLER ROOM':'highroller', 'INVITATIONAL CHAMPIONSHIP':'invitational' };
  const VENUE_SHORT = { 'BACK ROOM':'BACK ROOM', 'PUB CIRCUIT':'PUB CIRCUIT', 'CARD CLUB':'CARD CLUB', 'CASINO FLOOR':'CASINO', 'HIGH ROLLER ROOM':'HIGH ROLLER', 'INVITATIONAL CHAMPIONSHIP':'INVITATIONAL' };
  const SUIT = { backroom:'♣', pub:'♥', cardclub:'♠', casino:'♦', highroller:'♠', invitational:'♥' };
  /* what each kind of ticket looks like */
  const STYLE = { event:'ticket', format:'slip', character:'card', wild:'card', jinx:'slip', big:'ticket' };

  /* Tonight's deals: a career a little way in (Back Room cleared, the
     Pub open, the Card Club a stretch). Each RE-DEAL draws six. */
  const POOL = [
    { id:'pub-freezeout', kind:'event', why:'NEXT STEP', note:'Win it and the Card Club opens' },
    { id:'back-room-heads-up', kind:'character', why:'OVERDUE', note:'Harry\'s been asking after you', title:'HARRY\'S TABLE', face:6, mood:'sly', who:'HARRY', rank:'H' },
    { id:'pub-turbo', kind:'format', why:'NEW', note:'Pulled from a Pub pack last night', title:'PUB TURBO', rule:'BLINDS UP EVERY 6 HANDS' },
    { id:'back-room-five', kind:'event', why:'SAFE BET', note:'Paid in most of these. Builds your stack' },
    { id:'pub-open', kind:'wild', why:'WILD CARD', note:'Every 5th hand all ante big: a bomb pot', title:'BOMB POT NIGHT', rule:'BOMB POT EVERY 5TH' },
    { id:'pub-freezeout', kind:'jinx', why:'JINX', note:'Blinds double. So does the prize', title:'MARKED DECK', rule:'BLINDS ×2 · PRIZE ×2' },
    { id:'card-club-deep', kind:'event', why:'A STRETCH', note:'A big buy-in for your bankroll' },
    { id:'pub-open', kind:'character', why:'FAVOURITE', note:'You\'ve won here twice', title:'LUCY\'S LOCK-IN', face:2, mood:'smug', who:'LUCY', rank:'L' },
    { id:'back-room-freezeout', kind:'format', why:'NEW', note:'A new format to try', title:'BOUNTY NIGHT', rule:'EVERY KO PAYS $40' },
    { id:'casino-main', kind:'big', why:'A STRETCH', note:'The Casino. One day.' }
  ];
  let dealNo = 0;
  function drawSix(){
    const picks = dealNo === 0 ? [0, 1, 2, 3, 4, 5] : shuffle([...POOL.keys()]).slice(0, 6);
    dealNo++;
    return picks.map(i => ticketData(POOL[i]));
  }
  function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function ticketData(d){
    const e = careerEventById(d.id);
    const venue = VENUE_KEY[e.venue] || 'backroom';
    const roster = (() => { try{ return careerRosterFor(e.id) || []; }catch(err){ return []; } })();
    return {
      id:e.id, kind:d.kind, style:STYLE[d.kind] || 'ticket', venue, venueName:VENUE_SHORT[e.venue] || e.venue,
      title:d.title || careerEventTitle(e), why:d.why, note:d.note, rule:d.rule || '', face:d.face, mood:d.mood, who:d.who, rank:d.rank,
      seats:e.opponentCount + 1, buyIn:e.buyIn, top:e.payouts[0], paid:e.payouts.length, roster
    };
  }

  /* ---- a ticket ---- */
  function artHTML(t){
    if (t.kind === 'character'){
      return '<span class="hb-hero">' + renderFace({ faceColorIdx:t.face }, t.mood || 'idle') + '<b>' + esc(t.who) + '</b></span>';
    }
    const n = Math.min(5, t.roster.length);
    return '<span class="hb-faces n' + n + '">' + t.roster.slice(0, n).map(seat => '<span class="hb-face">' + renderFace({ faceColorIdx:seat.faceColorIdx }, 'idle') + '</span>').join('') + '</span>';
  }
  function makeTicket(t, i){
    const el = document.createElement('div');
    el.className = 'hb-t';
    el.dataset.venue = t.venue; el.dataset.style = t.style; el.dataset.kind = t.kind; el.dataset.i = i;
    el.style.width = TW + 'px'; el.style.height = TH + 'px';
    const suit = SUIT[t.venue];
    const rank = t.rank || String(t.seats);
    const tag = t.kind === 'wild' ? '<span class="hb-tag is-wild">WILD</span>' : t.kind === 'jinx' ? '<span class="hb-tag is-jinx">JINX</span>' : t.kind === 'format' ? '<span class="hb-tag is-new">NEW FORMAT</span>' : '';
    el.innerHTML =
      '<span class="hb-why">' + esc(t.why) + '</span>' +
      '<span class="hb-card">' +
        '<span class="hb-t-body">' +
          '<span class="hb-idx hb-idx-a" aria-hidden="true"><b>' + rank + '</b><i>' + suit + '</i></span>' +
          '<span class="hb-idx hb-idx-b" aria-hidden="true"><b>' + rank + '</b><i>' + suit + '</i></span>' +
          '<span class="hb-venue">' + esc(t.venueName) + '</span>' +
          '<span class="hb-art">' + artHTML(t) + tag + '</span>' +
          '<span class="hb-title">' + esc(t.title) + '</span>' +
          '<span class="hb-line">' + esc(t.rule || (t.seats + ' SEATS · ' + t.paid + ' PAID')) + '</span>' +
          '<span class="hb-money"><span><small>IN</small><b>' + short(t.buyIn) + '</b></span><span><small>TOP</small><b>' + short(t.top) + '</b></span></span>' +
          (t.kind === 'wild' || t.kind === 'big' || t.kind === 'character' ? '<span class="hb-foil' + (t.kind === 'character' ? ' is-soft' : '') + '" aria-hidden="true"><i></i></span>' : '') +
        '</span>' +
        '<span class="hb-back" aria-hidden="true"></span>' +
      '</span>';
    return el;
  }

  /* ============================================================
     THE SPRINGS: every ticket lives in one layer over the whole hub, so
     it can be carried anywhere; the felt only says where its slot is
     ============================================================ */
  let root, layer, tickets = [], cards = [], picked = -1, holding = null, scrub = null, feeding = false, raf = 0, last = 0;
  function card(el, t, i){
    return { el, t, i, card:el.querySelector('.hb-card'), x:0, y:0, r:0, s:1, vx:0, vy:0, vr:0, vs:0, tx:0, ty:0, tr:0, ts:1, flip:0, tflip:0, home:{ x:0, y:0, r:0, s:1 }, z:i };
  }
  function slots(){
    const deal = root.querySelector('#hb-deal').getBoundingClientRect(), rr = root.getBoundingClientRect();
    const W = deal.width, H = deal.height, ox = deal.left - rr.left, oy = deal.top - rr.top;
    const n = cards.length, mode = state.deal;
    if (mode === 'fan5'){
      const s = clamp(Math.min(W * .42 / TW, H * .8 / TH), .8, 1.45);
      const sp = Math.min(TW * s * .5, (W - TW * s - 10) / Math.max(1, n - 1));
      return cards.map((c, i) => {
        const o = i - (n - 1) / 2;
        const lift = i === picked ? -TH * s * .22 : scrub && scrub.i === i ? -TH * s * .12 : 0;
        return { x:ox + W / 2 + o * sp, y:oy + H * .55 + o * o * 6 + lift, r:o * 6 * (i === picked ? .3 : 1), s:i === picked ? s * 1.08 : s };
      });
    }
    const cols = 3, rows = mode === 'row3' ? 1 : 2;
    const gapX = 8, gapY = 20;
    const s = Math.min(1.25, (W - gapX * (cols - 1) - 6) / (cols * TW), (H - gapY * (rows - 1) - 10) / (rows * TH));
    const cw = TW * s, ch = TH * s;
    const gx = ox + (W - (cols * cw + gapX * (cols - 1))) / 2, gy = oy + (H - (rows * ch + gapY * (rows - 1))) / 2 + 6;
    return cards.map((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const lift = i === picked ? -6 : 0;
      return { x:gx + col * (cw + gapX) + cw / 2, y:gy + row * (ch + gapY) + ch / 2 + lift, r:0, s:i === picked ? s * 1.07 : s };
    });
  }
  function rehome(){ const sl = slots(); cards.forEach((c, i) => { c.home = sl[i]; if (c !== holding && !c.feeding){ c.tx = sl[i].x; c.ty = sl[i].y; c.tr = sl[i].r; c.ts = sl[i].s; } }); }
  function step(now){
    const dt = Math.min(.04, (now - (last || now)) / 1000) * speed(); last = now;
    const k = 200, d = 20;
    cards.forEach(c => {
      if (c !== holding){
        c.vx += (k * (c.tx - c.x) - d * c.vx) * dt; c.x += c.vx * dt;
        c.vy += (k * (c.ty - c.y) - d * c.vy) * dt; c.y += c.vy * dt;
      }
      c.vr += (k * (c.tr - c.r) - d * c.vr) * dt; c.r += c.vr * dt;
      c.vs += (k * (c.ts - c.s) - d * c.vs) * dt; c.s += c.vs * dt;
      c.flip += clamp(c.tflip - c.flip, -dt * 6, dt * 6);
      c.el.style.transform = 'translate(' + (c.x - TW / 2).toFixed(1) + 'px,' + (c.y - TH / 2).toFixed(1) + 'px) rotate(' + c.r.toFixed(2) + 'deg) scale(' + c.s.toFixed(3) + ')';
      c.el.style.zIndex = String(c === holding ? 300 : c.feeding ? 2 : c.i === picked ? 120 : scrub && scrub.i === c.i ? 110 : 10 + c.z);
      // the turn: the card narrows to an edge and opens on its other face
      const f = c.flip, sx = Math.abs(Math.cos(f * Math.PI));
      c.card.style.transform = 'scaleX(' + Math.max(.02, sx).toFixed(3) + ')';
      c.el.classList.toggle('is-down', f < .5);
    });
    raf = requestAnimationFrame(step);
  }

  /* ---- the deal ---- */
  async function deal(){
    if (feeding) return;
    picked = -1; paintConsole();
    const deck = root.querySelector('#hb-deck').getBoundingClientRect(), rr = root.getBoundingClientRect();
    const dx = deck.left - rr.left + deck.width / 2, dy = deck.top - rr.top + deck.height / 2;
    // sweep any old ones back into the deck first
    if (cards.length){
      for (const c of cards.slice().reverse()){ c.tflip = 0; c.tx = dx; c.ty = dy; c.tr = 0; c.ts = .5; S.deal(); await wait(45); }
      await wait(320);
      cards.forEach(c => c.el.remove());
    }
    tickets = drawSix().slice(0, state.deal === 'row3' ? 3 : state.deal === 'fan5' ? 5 : 6);
    cards = tickets.map((t, i) => { const el = makeTicket(t, i); layer.appendChild(el); const c = card(el, t, i); Object.assign(c, { x:dx, y:dy, tx:dx, ty:dy, s:.5, ts:.5, r:-8 + i * 3, tr:-8 + i * 3, flip:0, tflip:0 }); return c; });
    rehome();
    cards.forEach(c => { c.tx = dx; c.ty = dy; c.ts = .5; });
    root.querySelector('#hb-deck').classList.add('is-dealing');
    await wait(160);
    for (const c of cards){
      c.tx = c.home.x; c.ty = c.home.y; c.tr = c.home.r + (Math.random() - .5) * 6; c.ts = c.home.s;
      c.vy = -380; S.deal(); buzz(5);
      await wait(115);
    }
    await wait(300);
    root.querySelector('#hb-deck').classList.remove('is-dealing');
    S.land();
    for (const c of cards){ c.tr = c.home.r; c.tflip = 1; c.ts = c.home.s * 1.08; S.flip(); await wait(90); c.ts = c.home.s; }
    root.querySelector('#hb-hint').textContent = state.deal === 'fan5' ? 'SLIDE ALONG · TAP TO PICK · DRAG TO THE SLOT' : 'TAP TO PICK · DRAG ONE TO THE SLOT';
    root.querySelector('#hb-hint').classList.add('is-on');
  }

  /* ---- picking: tap, carry, and the fan's scrub ---- */
  function at(e){ const rr = root.getBoundingClientRect(); return { x:e.clientX - rr.left, y:e.clientY - rr.top }; }
  function down(e){
    if (feeding) return;
    const el = e.target.closest('.hb-t'); const p = at(e);
    if (state.deal === 'fan5' && (el || inFelt(p))){
      e.preventDefault();
      const i = nearestFan(p.x);
      scrub = { id:e.pointerId, i, x0:p.x, y0:p.y, t:performance.now(), moved:false };
      S.tick(.4); rehome();
      return;
    }
    if (!el) return;
    e.preventDefault();
    const c = cards[+el.dataset.i];
    holding = null;
    c.press = { id:e.pointerId, x0:p.x, y0:p.y, ox:p.x - c.x, oy:p.y - c.y, lx:p.x, ly:p.y, lt:performance.now() };
    pressCard = c;
  }
  let pressCard = null;
  function move(e){
    const p = at(e);
    if (scrub && e.pointerId === scrub.id){
      e.preventDefault();
      // pulling up out of the fan picks that card up
      if (scrub.y0 - p.y > 34){
        const c = cards[scrub.i];
        scrub = null;
        startCarry(c, p, e.pointerId);
        return;
      }
      const i = nearestFan(p.x);
      if (i !== scrub.i){ scrub.i = i; scrub.moved = true; S.tick(.35); buzz(4); rehome(); }
      return;
    }
    const c = holding || pressCard;
    if (!c || !c.press || e.pointerId !== c.press.id) return;
    e.preventDefault();
    if (!holding){
      if (Math.hypot(p.x - c.press.x0, p.y - c.press.y0) < 8) return;
      startCarry(c, p, e.pointerId);
    }
    const now = performance.now(), dt = Math.max(8, now - c.press.lt);
    const vx = (p.x - c.press.lx) / dt * 16;
    c.press.lx = p.x; c.press.ly = p.y; c.press.lt = now;
    c.x = p.x - c.press.ox; c.y = p.y - c.press.oy; c.vx = c.vy = 0;
    c.tr = clamp(vx * 2, -16, 16);
    root.querySelector('#hb-slot').classList.toggle('is-near', overSlot(c));
  }
  function startCarry(c, p, id){
    holding = c;
    c.press = { id, x0:p.x, y0:p.y, ox:p.x - c.x, oy:p.y - c.y, lx:p.x, ly:p.y, lt:performance.now() };
    c.ts = c.home.s * 1.15;
    if (picked !== c.i){ picked = c.i; paintConsole(); rehome(); }
    root.classList.add('is-holding');
    S.lift(); buzz(10);
  }
  function up(e){
    if (scrub && e.pointerId === scrub.id){
      const i = scrub.i, moved = scrub.moved; scrub = null;
      choose(!moved && picked === i ? -1 : i);
      return;
    }
    const c = holding || pressCard;
    if (!c || !c.press || e.pointerId !== c.press.id) return;
    const wasCarry = holding === c;
    c.press = null; pressCard = null; holding = null;
    root.classList.remove('is-holding');
    root.querySelector('#hb-slot').classList.remove('is-near');
    if (wasCarry){
      if (overSlot(c)){ feed(c); return; }
      rehome(); S.land(); buzz(6);
      return;
    }
    choose(picked === c.i ? -1 : c.i);
  }
  function choose(i){
    picked = i;
    S.land(); buzz(8);
    rehome(); paintConsole();
  }
  function inFelt(p){ const r = root.querySelector('#hb-deal').getBoundingClientRect(), rr = root.getBoundingClientRect(); return p.y > r.top - rr.top - 20 && p.y < r.bottom - rr.top + 20; }
  function nearestFan(x){ let best = 0, bd = Infinity; cards.forEach((c, i) => { const d = Math.abs(c.home.x - x); if (d < bd){ bd = d; best = i; } }); return best; }
  function overSlot(c){ const r = root.querySelector('#hb-slot').getBoundingClientRect(), rr = root.getBoundingClientRect(); return c.y + TH * c.s * .3 > r.top - rr.top - 10; }

  /* ---- the console ---- */
  function paintConsole(){
    cards.forEach((c, j) => { c.el.classList.toggle('is-picked', j === picked); c.el.classList.toggle('is-dim', picked >= 0 && j !== picked); });
    const t = tickets[picked];
    const buy = root.querySelector('#hb-buy'), slot = root.querySelector('#hb-slot');
    slot.classList.toggle('is-ready', !!t);
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

  /* ---- the feed: into the slot, the money moves, the table rolls in ---- */
  async function feed(c){
    if (feeding) return;
    feeding = true;
    picked = c.i; paintConsole();
    const slot = root.querySelector('#hb-slot'), mouth = slot.querySelector('.hb-mouth');
    const rr = root.getBoundingClientRect(), mr = mouth.getBoundingClientRect();
    const mx = mr.left - rr.left + mr.width / 2, my = mr.top - rr.top + mr.height / 2;
    const s = clamp((mr.width - 6) / TW, .6, 1);
    c.feeding = true; c.tx = mx; c.ty = my - TH * s / 2 - 4; c.tr = 0; c.ts = s;
    slot.classList.add('is-taking');
    await wait(340);
    // bites: down into the mouth; the plate above it hides what's gone in
    c.el.classList.add('is-feeding');
    const bites = 6, h = TH * s;
    for (let b = 1; b <= bites; b++){
      c.ty = my - h / 2 - 4 + (h + 6) * b / bites; c.y = c.ty; c.vy = 0;
      c.el.style.setProperty('--cut', Math.round(TH * b / bites) + 'px');
      S.tick(.5 + b / bites * .5); buzz(5);
      await wait(115);
    }
    c.el.style.visibility = 'hidden';
    S.bite(); buzz([20, 10, 30]);
    // the real buy-in: the same functions today's Career uses
    const t = c.t;
    let entered = false;
    try{ entered = enterCareerEvent(t.id); }catch(e){ entered = false; }
    slot.classList.remove('is-taking');
    if (!entered){
      root.querySelector('#hb-ro-a').textContent = 'REJECTED';
      root.querySelector('#hb-ro-b').textContent = 'NOT ENOUGH IN THE BANKROLL';
      c.el.style.visibility = ''; c.el.classList.remove('is-feeding'); c.feeding = false; rehome(); feeding = false;
      return;
    }
    slot.classList.add('is-read');
    root.querySelector('#hb-ro-a').textContent = 'ENTRY PAID · ' + t.venueName;
    root.querySelector('#hb-ro-b').textContent = 'NOW SEATING: ' + t.title;
    await countBank(careerBankroll());
    await wait(320);
    const launch = () => { try{ startCareerEvent(); }catch(e){} };
    try{ if (typeof careerDepartToTable === 'function') careerDepartToTable(launch, { callout:t.title }); else launch(); }catch(e){ launch(); }
  }
  let shown = 0;
  function reel(v){
    const digits = String(Math.max(0, Math.floor(v))).padStart(7, '0');
    const lead = 7 - String(Math.max(0, Math.floor(v))).length;
    return '<span class="jp-cell jp-sym">$</span>' + digits.split('').map((d, i) => '<span class="jp-cell jp-digit' + (i < lead ? ' is-leading' : '') + '">' + d + '</span>').join('');
  }
  function countBank(to){
    const from = shown, t0 = performance.now(), dur = 700 / speed();
    return new Promise(res => {
      const tick = now => {
        const k = clamp((now - t0) / dur, 0, 1), q = Math.floor(k * 12) / 12;
        const v = Math.round(from + (to - from) * q);
        root.querySelector('#hb-reel').innerHTML = reel(v);
        if (k < 1){ if (Math.random() < .5) S.tick(.3); requestAnimationFrame(tick); } else { shown = to; res(); }
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---- the screen ---- */
  function build(){
    const careerEl = document.getElementById('career');
    if (!careerEl || document.getElementById('hb')) return;
    careerEl.classList.add('hb-on');
    root = document.createElement('div');
    root.id = 'hb'; root.className = 'hb';
    root.innerHTML =
      '<div class="hb-top">' +
        '<div class="hb-rail">' +
          '<button class="hb-key" id="hb-back" type="button" aria-label="Back to main menu"><span class="hb-nav" aria-hidden="true"></span></button>' +
          '<span class="hb-plate">CAREER</span>' +
          '<button class="hb-key" id="hb-set" type="button" aria-label="Settings">⚙</button>' +
        '</div>' +
        '<div class="hb-bank"><div class="hb-reel" id="hb-reel"></div></div>' +
        '<div class="hb-record crt" id="hb-record">' +
          '<span class="crt-cell"><small class="crt-caption">PLAYED</small><strong class="crt-figure tabular">14</strong></span>' +
          '<span class="crt-cell"><small class="crt-caption">WON</small><strong class="crt-figure tabular">4</strong></span>' +
          '<span class="crt-cell"><small class="crt-caption">CIRCUIT</small><strong class="crt-figure tabular">2/6</strong></span>' +
        '</div>' +
      '</div>' +
      '<div class="hb-felt">' +
        '<div class="hb-felt-head"><span class="hb-label">TONIGHT\'S TICKETS</span><button class="hb-key hb-redeal" id="hb-redeal" type="button">RE-DEAL</button>' +
          '<span class="hb-deck" id="hb-deck" aria-hidden="true"><i></i><i></i><i></i></span></div>' +
        '<div class="hb-deal" id="hb-deal"></div>' +
        '<div class="hb-hint" id="hb-hint"></div>' +
      '</div>' +
      '<div class="hb-console">' +
        '<div class="hb-slot" id="hb-slot"><span class="hb-slot-lamp" aria-hidden="true"></span><span class="hb-mouth" aria-hidden="true"><i></i></span><span class="hb-slot-word">INSERT TICKET</span></div>' +
        '<div class="hb-readout crt" id="hb-readout"><small class="crt-caption" id="hb-ro-a">PICK A TICKET</small><strong class="crt-line" id="hb-ro-b">TONIGHT\'S DEAL IS ON THE FELT</strong></div>' +
        '<div class="pc-primary-cradle hb-cradle"><span class="pc-slot-aperture" aria-hidden="true"><span class="pc-slot-door"></span></span>' +
          '<button class="pc-button pc-button-primary hb-buy" id="hb-buy" type="button" disabled><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong id="hb-buy-a">BUY IN</strong><small id="hb-buy-b">PICK A TICKET FIRST</small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div>' +
      '</div>' +
      '<div class="hb-doors">' +
        '<button class="btn-secondary hb-door" id="hb-case" type="button"><span class="hb-door-ico is-case" aria-hidden="true"></span><span>THE CASE<small>23 TICKETS</small></span></button>' +
        '<button class="btn-secondary hb-door" id="hb-vendor" type="button"><span class="hb-door-ico is-vendor" aria-hidden="true"></span><span>THE VENDOR<small>BUY PACKS</small></span></button>' +
      '</div>' +
      '<div class="hb-layer" id="hb-layer"></div>';
    careerEl.appendChild(root);
    layer = root.querySelector('#hb-layer');
    root.querySelector('#hb-back').addEventListener('click', () => { S.key(); const real = document.getElementById('ch2-back'); if (real) real.click(); });
    root.querySelector('#hb-redeal').addEventListener('click', () => { S.key(); deal(); });
    root.querySelector('#hb-buy').addEventListener('click', () => { const c = cards[picked]; if (c) feed(c); });
    ['#hb-case', '#hb-vendor'].forEach(id => root.querySelector(id).addEventListener('click', () => {
      S.key();
      root.querySelector('#hb-ro-a').textContent = id === '#hb-case' ? 'THE CASE' : 'THE VENDOR';
      root.querySelector('#hb-ro-b').textContent = 'ITS NEW SCREEN IS THE NEXT LAB';
    }));
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move, { passive:false });
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('touchmove', e => { if (holding || scrub) e.preventDefault(); }, { passive:false });
    raf = requestAnimationFrame(step);
    // the lab's pretend career is set once; after that the money is real
    let seeded = false, wasHidden = true;
    const enter = () => {
      if (!seeded){
        seeded = true;
        try{
          career.active = null; career.cash = null; career.bankroll = 1840; career.eventsPlayed = 14; career.eventsWon = 4;
          CAREER_EVENT_LIST.forEach(e => { career.unlocks[e.id] = true; }); saveCareer();
        }catch(e){}
      }
      shown = careerBankroll(); root.querySelector('#hb-reel').innerHTML = reel(shown);
      feeding = false;
      setTimeout(deal, 300);
    };
    new MutationObserver(() => {
      const hidden = careerEl.classList.contains('hidden');
      if (wasHidden && !hidden) enter();
      wasHidden = hidden;
    }).observe(careerEl, { attributes:true, attributeFilter:['class'] });
    new ResizeObserver(() => rehome()).observe(root);
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
        '<h3>THE DEAL<small>How many tickets you\'re dealt, and how they lie on the felt.</small></h3>' +
        seg('deal', [['grid6', '2 ROWS OF 3'], ['row3', '3 IN A ROW'], ['fan5', 'A HAND OF 5']]) +
        '<p class="hbl-note">In the hand of 5, slide your thumb along the fan: the card under it rises. Let go to pick it, or pull it up and out to carry it.</p>' +
        '<h3>MOTION</h3>' + seg('speed', [[1, 'REAL'], [.5, 'HALF'], [.25, 'QUARTER']]) +
      '</div>';
    root.querySelector('.hb-felt-head').insertBefore(key, root.querySelector('#hb-redeal'));
    document.body.appendChild(sheet);
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
      if (s.dataset.key === 'deal'){ open(false); dealNo = 0; deal(); }
    });
  }
  function start(){ build(); if (root){ tune(); root.style.setProperty('--hb-speed', state.speed); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
