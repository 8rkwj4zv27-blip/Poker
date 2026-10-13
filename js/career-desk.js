/* ============================================================
   THE CAREER DESK — Career's main screen, as a felt desk (lab only)

   Plan: docs/career/CAREER_HUB_DESK_PLAN.md. Hosted by the pack scene
   (js/pack-opening.js), which owns the machine around it (bankroll reel,
   CRT, console) and hands over CareerLab: the wallet, the case, the album,
   the history, the venues reached, and the doors.

   On the desk:
   - THE SLOT, top: a brass mouth. Carry a card up to it (or press PLAY,
     or BUY IN on the inspect screen) and it bites the card; the CRT
     reads it; PAY (or push the card in) pays: your chips slide into the
     slot, the card ratchets in, the cabinet shudders, and the table plays
     (simulated in the lab). Winnings come back out of the slot as chips.
   - TONIGHT: three cards from your case on a brass lip, each tabbed with
     why it was dealt. Tap one to inspect it. Flick one off the desk and
     another is dealt in its place.
   - The things you can touch: matchbooks (one per venue reached; tap to
     open, hold to strike), the banker's lamp (pull the chain), the brass
     bell (ring for the shop), the card case (your album), your chips (tap
     to riffle them). And now and then, someone looks in.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, snap, ease, tween, wait, glide, squash, puff, burst, jolt, S, Foil, Haptic } = PO;
  const CW = 82, CH = 120;
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const ord = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'TH' : ({ 1:'ST', 2:'ND', 3:'RD' })[n % 10] || 'TH');
  const VENUES = [
    { id:'BACK ROOM', short:'BACK ROOM', c1:'#7a2d38', c2:'#e9d9a8', suit:'♣' },
    { id:'PUB CIRCUIT', short:'PUB', c1:'#2f6b45', c2:'#f0e2b0', suit:'♥' },
    { id:'CARD CLUB', short:'CARD CLUB', c1:'#2c4f86', c2:'#e6e1c4', suit:'♠' },
    { id:'CASINO FLOOR', short:'CASINO', c1:'#b23a2e', c2:'#f3d27a', suit:'♦' },
    { id:'HIGH ROLLER ROOM', short:'HIGH ROLLER', c1:'#1d1a20', c2:'#d9a93b', suit:'♠' },
    { id:'INVITATIONAL CHAMPIONSHIP', short:'INVITATIONAL', c1:'#4b2a63', c2:'#f3d27a', suit:'♥' }
  ];
  const NEXT = { 'BACK ROOM':'PUB CIRCUIT', 'PUB CIRCUIT':'CARD CLUB', 'CARD CLUB':'CASINO FLOOR', 'CASINO FLOOR':'HIGH ROLLER ROOM', 'HIGH ROLLER ROOM':'INVITATIONAL CHAMPIONSHIP' };
  const VISITOR_LINES = ['JUST LOOKING.', 'NICE CARDS.', 'SEE YOU AT THE TABLE.', 'DON’T MIND ME.', 'THAT ONE’S A TRAP.'];

  let L = null, el = null, st = null, W = 0, H = 0;
  let desk = [];          // the three cards on the lip: { c, card, why, i }
  let bitten = null;      // the card the slot is holding
  let busy = false, ptr = null, lampOn = true, pile = [], visitorAt = 0, visitorOn = false, entered = false;

  /* ---------------- pixel art ---------------- */
  const px = (w, h, rects, cls = '') => `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" aria-hidden="true">${rects.map(([x, y, rw, rh, f]) => `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${f}"/>`).join('')}</svg>`;
  const INK = '#1a0f0a', BRASS = '#d9a93b', BRASS_HI = '#fff1c4', BRASS_LO = '#7a4b0c';
  const LAMP = px(40, 60, [
    [8, 4, 24, 2, INK], [6, 6, 28, 2, INK], [4, 8, 32, 12, INK],
    [9, 5, 22, 1, '#7fd09a'], [7, 7, 26, 1, '#4e9b62'], [5, 9, 30, 9, '#2f6b45'], [7, 9, 10, 2, '#7fd09a'], [5, 18, 30, 1, '#1d4a30'],
    [6, 20, 28, 2, BRASS_LO], [7, 20, 26, 1, BRASS],
    [18, 22, 4, 26, INK], [19, 22, 2, 26, BRASS], [19, 22, 1, 26, BRASS_HI],
    [8, 48, 24, 4, INK], [6, 52, 28, 6, INK], [9, 49, 22, 2, BRASS], [7, 53, 26, 3, BRASS], [7, 53, 26, 1, BRASS_HI], [7, 56, 26, 1, BRASS_LO]
  ], 'hd-lamp-art');
  const BELL = px(36, 30, [
    [16, 2, 4, 2, INK], [17, 2, 2, 1, '#c9c2b0'], [15, 4, 6, 2, INK],
    [10, 6, 16, 2, INK], [7, 8, 22, 10, INK], [10, 7, 16, 1, BRASS], [8, 9, 20, 8, BRASS], [10, 9, 5, 3, BRASS_HI], [8, 15, 20, 2, BRASS_LO],
    [4, 18, 28, 3, INK], [5, 18, 26, 2, BRASS_LO], [2, 21, 32, 7, INK], [3, 22, 30, 5, '#6b3a22'], [3, 22, 30, 1, '#9a5a35'], [3, 26, 30, 1, '#3e1f12']
  ], 'hd-bell-art');
  const CASE = px(60, 44, [
    [2, 8, 56, 34, INK], [4, 10, 52, 30, '#541b25'], [4, 10, 52, 2, '#7a2d38'], [4, 37, 52, 3, '#2a0d14'],
    [6, 2, 48, 8, INK], [8, 3, 44, 6, '#f3e9c8'], [8, 4, 44, 1, '#a99668'], [8, 6, 44, 1, '#a99668'], [8, 8, 44, 1, '#a99668'],
    [24, 18, 12, 10, INK], [25, 19, 10, 8, BRASS], [26, 19, 8, 2, BRASS_HI], [28, 23, 4, 2, INK],
    [8, 32, 44, 1, '#3e1018']
  ], 'hd-case-art');
  const GLOVE = px(20, 18, [
    [4, 0, 12, 2, INK], [2, 2, 2, 10, INK], [16, 2, 2, 10, INK], [4, 2, 12, 10, '#f3efe4'], [7, 2, 1, 6, '#b9b2a2'], [10, 2, 1, 6, '#b9b2a2'], [13, 2, 1, 6, '#b9b2a2'],
    [4, 10, 12, 2, '#d8d2c4'], [2, 12, 16, 2, INK], [5, 14, 10, 4, INK], [6, 14, 8, 3, '#e6e0d2']
  ], 'hd-glove');
  function matchbook(v, open){
    const r = [[0, 0, 24, 34, INK], [1, 1, 22, 32, v.c1], [1, 1, 22, 1, 'rgba(255,255,255,.25)'], [3, 6, 18, 12, v.c2], [1, 26, 22, 7, '#2a1810']];
    for (let x = 2; x < 22; x += 3) r.push([x, 28, 1, 1, '#6b4a30'], [x + 1, 30, 1, 1, '#6b4a30']);
    // open: the cover folds back and the matches stand in a row
    if (open){ r.push([0, -12, 24, 13, INK], [1, -11, 22, 11, '#efe3bd']); for (let x = 2; x < 22; x += 4) r.push([x, -8, 3, 8, '#f3e9c8'], [x, -10, 3, 3, '#c8322b'], [x, -10, 1, 1, '#ff8a7a']); }
    return `<svg viewBox="0 ${open ? -12 : 0} 24 ${open ? 46 : 34}" width="24" height="${open ? 46 : 34}" shape-rendering="crispEdges" aria-hidden="true">${r.map(([x, y, w, h, f]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`).join('')}<text x="12" y="15" text-anchor="middle" font-size="9" fill="${v.c1}" font-family="serif">${v.suit}</text></svg>`;
  }

  /* ---------------- build ---------------- */
  function build(){
    el = L.container;
    el.innerHTML = `
      <div class="hd">
        <i class="hd-pool"></i>
        <div class="hd-print" aria-hidden="true">${px(32, 16, [[8, 2, 16, 2, '#8ff0b4'], [4, 4, 4, 2, '#8ff0b4'], [24, 4, 4, 2, '#8ff0b4'], [2, 6, 2, 4, '#8ff0b4'], [28, 6, 2, 4, '#8ff0b4'], [4, 10, 4, 2, '#8ff0b4'], [24, 10, 4, 2, '#8ff0b4'], [8, 12, 16, 2, '#8ff0b4'], [13, 5, 6, 6, '#8ff0b4'], [15, 7, 2, 2, '#1b3a2a']], 'hd-eye')}<b>THE HOUSE ALWAYS WATCHES</b></div>
        <div class="hd-slot" aria-label="The ticket slot"><b class="hd-slot-print">INSERT CARD ▼</b><i class="hd-slot-lamp"></i><i class="hd-slit"></i></div>
        <div class="hd-matches" aria-label="Venues reached"></div>
        <button class="hd-lamp" type="button" aria-label="The desk lamp">${LAMP}<i class="hd-chain"></i></button>
        <div class="hd-stage"><div class="hd-shadows"></div><div class="hd-objects"></div><div class="hd-fx"></div></div>
        <span class="ec-lip hd-lip"></span>
        <button class="hd-case" type="button" aria-label="The case: your album">${CASE}<b class="hd-case-n">0</b></button>
        <button class="hd-chips" type="button" aria-label="Your chips"></button>
        <button class="hd-bell" type="button" aria-label="Ring for the shop">${BELL}</button>
        <div class="hd-visitor" aria-hidden="true"></div>
        <i class="hd-dim"></i>
      </div>`;
    const s = el.querySelector('.hd-stage');
    st = { el:s, shadows:s.querySelector('.hd-shadows'), objects:s.querySelector('.hd-objects'), fx:s.querySelector('.hd-fx') };
    const root = el.querySelector('.hd');
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', e => up(e, false));
    root.addEventListener('pointercancel', e => up(e, true));
    el.querySelector('.hd-lamp').addEventListener('click', lamp);
    el.querySelector('.hd-bell').addEventListener('click', bell);
    el.querySelector('.hd-case').addEventListener('click', openCase);
    el.querySelector('.hd-chips').addEventListener('click', riffle);
  }
  function measure(){ W = el.clientWidth; H = el.clientHeight; }
  const cardS = () => Math.max(.8, Math.min(1.3, W * .285 / CW, H * .27 / CH));
  const spot = i => { const s = cardS(); return { x:W / 2 + (i - 1) * Math.min(W * .315, CW * s * 1.12), y:H * .55, s, r:[-3, 0, 3][i], z:0, sx:1, sy:1, alpha:1 }; };
  const slitY = () => el.querySelector('.hd-slit').offsetTop + el.querySelector('.hd-slot').offsetTop + 3;

  /* ---------------- entering and leaving ---------------- */
  function enter(){
    if (!el) build();
    measure();
    el.querySelector('.hd').classList.toggle('is-dark', !lampOn);
    drawMatches(); drawCount();
    S.unlock();
    // first visit, or back with something new in the case: tonight's cards are dealt afresh
    const fresh = L.held.some(c => c.isNew && !desk.some(d => d.card === c));
    if (!entered || (fresh && !bitten)){ entered = true; dealAll(!desk.length); }
    else layout();
    buildPile();
    hint();
    L.keys(true);
    idle();
  }
  function leave(){
    try { CoinWorld.clearWorld(); } catch (e) {}
    pile = [];
    L.keys(false);
  }
  function layout(){
    desk.forEach(d => { if (d.c && d !== bitten) d.c.body.set(spot(d.i)); });
    const lip = el.querySelector('.hd-lip'), s0 = spot(0);
    lip.style.top = Math.round(s0.y + CH * s0.s / 2 - 8) + 'px';
  }
  function hint(){
    if (bitten) return;
    L.status('TONIGHT', desk.length ? 'CARRY A CARD TO THE SLOT' : 'RING THE BELL FOR THE SHOP');
    L.figure(VENUES.filter(v => L.venues.has(v.id)).length + '/' + VENUES.length, 'VENUES');
  }

  /* ---------------- tonight's cards ---------------- */
  // why a card is on the desk tonight, in order of preference
  function suggest(taken, used = []){
    const free = L.held.filter(c => !taken.includes(c));
    const reached = VENUES.filter(v => L.venues.has(v.id)).map(v => v.id), top = reached[reached.length - 1];
    const picks = [
      ['NEW', free.find(c => c.isNew)],
      ['NEXT STEP', free.find(c => c.event.venue === top && c.event.buyIn <= L.wallet)],
      ['BIG ONE', free.find(c => c.tier >= 2)],
      ['SAFE BET', free.slice().sort((a, b) => a.event.buyIn - b.event.buyIn)[0]],
      ['A STRETCH', free.filter(c => c.event.buyIn <= L.wallet).sort((a, b) => b.event.buyIn - a.event.buyIn)[0]]
    ];
    for (const [why, c] of picks) if (c && !used.includes(why)) return { card:c, why };
    if (free.length) return { card:free[0], why:'ONE MORE' };
    // the house never lets the desk go bare: its own cards are always there
    return { card:Object.assign(EventCards.make('table', 'common', 'back-room-five'), { house:true }), why:'HOUSE' };
  }
  function makeDeskCard(card, why, i){
    const c = CardInspect.make(st, card, { side:'face' });
    c.el.classList.add('hd-card');
    if (card.house) c.el.classList.add('is-house');
    c.el.insertAdjacentHTML('beforeend', `<b class="hd-tab${why === 'NEW' ? ' is-new' : ''}">${why}</b>`);
    c.el.style.zIndex = 10 + i;
    return { c, card, why, i };
  }
  // dealt from the case, flicked across the felt one after another
  async function dealAll(first){
    desk.forEach(d => d.c.body.remove());
    desk = [];
    const taken = [];
    for (let i = 0; i < 3; i++){ const s = suggest(taken, desk.map(d => d.why)); taken.push(s.card); desk.push(makeDeskCard(s.card, s.why, i)); }
    layout();
    const from = caseSpot();
    desk.forEach(d => d.c.body.set({ ...from, s:spot(d.i).s * .5, r:-20, z:6 }));
    busy = true;
    await Promise.all(desk.map(async (d, i) => {
      await wait(first ? 120 + i * 110 : i * 90);
      S.cardDeal(); Haptic.tick(5);
      await glide(d.c.body, spot(d.i), 340, { arc:26, spin:-12 });
      S.cardLanded(); squash(d.c.body, .06, 160);
    }));
    busy = false;
    hint();
  }
  async function dealOne(i){
    const taken = desk.filter(d => d.i !== i).map(d => d.card);
    const s = suggest(taken, desk.filter(x => x.i !== i).map(x => x.why)), d = makeDeskCard(s.card, s.why, i);
    desk = desk.filter(x => x.i !== i).concat(d).sort((a, b) => a.i - b.i);
    d.c.body.set({ ...caseSpot(), s:spot(i).s * .5, r:-20, z:6 });
    S.cardDeal();
    await glide(d.c.body, spot(i), 320, { arc:24, spin:-10 });
    S.cardLanded(); squash(d.c.body, .06, 160);
  }
  function caseSpot(){
    const r = el.querySelector('.hd-case'), b = el.getBoundingClientRect(), c = r.getBoundingClientRect();
    return { x:c.left - b.left + c.width / 2, y:c.top - b.top + 6, r:0, z:0 };
  }

  /* ---------------- the slot ---------------- */
  // the slot's plate lies over the card: half of it in, half still showing
  const plateBottom = () => { const p = el.querySelector('.hd-slot'); return p.offsetTop + p.offsetHeight; };
  const biteSpot = () => { const s = Math.min(1, (el.querySelector('.hd-slit').clientWidth * .86) / CW); return { x:W / 2, y:plateBottom() - CH * s * .06, s, r:0, z:0, sx:1, sy:1 }; };
  async function bite(d){
    if (bitten || !d) return;
    bitten = d; busy = true;
    CardInspect.flat(d.c);
    d.c.el.style.zIndex = 40;
    d.c.el.classList.add('is-biting');
    S.cardReturn();
    await glide(d.c.body, { ...biteSpot(), y:biteSpot().y + 22 }, 240, { arc:16 });
    // the slot takes hold: a bite, a jerk, the reader wakes
    S.hatchClose(); Haptic.tick(14, 0); jolt(el.querySelector('.hd-slot'), 2);
    await glide(d.c.body, biteSpot(), 90, { easing:ease.in });
    el.querySelector('.hd').classList.add('is-reading');
    const ev = d.card.event;
    L.status(ev.venue + ' · ' + (ev.title || ev.name), 'ENTRY ' + money(ev.buyIn) + ' · PUSH IT IN TO PAY');
    L.figure(money(d.card.prize), 'TOP PRIZE');
    S.counterTick(true);
    L.keyPlay(d.card.house ? 'PAY ' + money(ev.buyIn) : 'PAY ' + money(ev.buyIn), true);
    busy = false;
  }
  async function unbite(){
    const d = bitten;
    if (!d) return;
    bitten = null;
    el.querySelector('.hd').classList.remove('is-reading');
    S.cardReturn();
    await glide(d.c.body, spot(d.i), 260, { arc:12, easing:ease.back });
    d.c.el.style.zIndex = 10 + d.i; d.c.el.classList.remove('is-biting');
    S.cardLanded();
    L.keyPlay('PLAY', true);
    hint();
  }
  /* PAY: the chips go in first, then the card ratchets in tooth by tooth,
     the cabinet shudders, and you're away to the table. */
  async function pay(){
    const d = bitten;
    if (!d || busy) return;
    const fee = d.card.event.buyIn;
    if (L.wallet < fee){ S.koFailClick(); Haptic.tick(8); L.status('NOT ENOUGH IN THE BANK', 'ENTRY ' + money(fee)); jolt(el.querySelector('.hd-slot'), 2); return; }
    busy = true;
    L.keyPlay('…', false);
    await chipsIn(fee);
    const from = L.wallet; L.wallet = from - fee;
    for (let i = 1; i <= 6; i++){ L.bank(from - fee * i / 6); S.counterTick(true); }
    S.counterLock(true);
    const b = d.c.body, y0 = b.y, travel = y0 - (el.querySelector('.hd-slot').offsetTop - CH * b.s / 2 - 2);
    const motor = S.wheelMotor() || { set(){}, stop(){} };
    // it goes in four teeth at a time, a click and a judder on each
    for (let t = 1; t <= 4; t++){
      motor.set(.3 + t * .15);
      await tween(70, e => b.set({ y:y0 - travel * (t - 1 + e) / 4 }), ease.out);
      S.stageRollClick(.6, t === 4); Haptic.tick(6, 30); jolt(el.querySelector('.hd-slot'), 1);
      if (!PO.reduced) await wait(60);
    }
    motor.stop();
    S.stageLock(); jolt(L.root, 3); Haptic.tick(20, 0);
    b.remove();
    el.querySelector('.hd').classList.remove('is-reading');
    if (!d.card.house) L.held.splice(L.held.indexOf(d.card), 1);
    desk = desk.filter(x => x !== d); bitten = null;
    drawCount();
    await table(d);
    await dealOne(d.i);
    busy = false;
    L.keyPlay('PLAY', true);
    hint();
  }
  /* The lab can't seat you at a real table: the house plays it out for
     you, and the result comes back out of the slot. */
  async function table(d){
    const hd = el.querySelector('.hd');
    hd.classList.add('is-playing');
    // its place on the lip holds a face-down marker while you're away
    const mark = CardInspect.make(st, d.card, { side:'back' });
    mark.el.classList.add('hd-card', 'is-marker');
    mark.el.insertAdjacentHTML('beforeend', '<b class="hd-tab">IN PLAY</b>');
    mark.body.set({ ...spot(d.i), y:spot(d.i).y - 40, alpha:0 });
    glide(mark.body, { ...spot(d.i) }, 220).then(() => S.cardLanded());
    L.status('AT THE TABLE', d.card.event.venue + ' · ' + d.card.event.playerCount + ' SEATS');
    S.showdownBegin();
    const hands = 8 + Math.floor(Math.random() * 14);
    for (let i = 1; i <= hands; i++){ L.figure(String(i).padStart(2, '0'), 'HANDS'); S.counterTick(false); await wait(PO.reduced ? 0 : 1300 / hands); }
    hd.classList.remove('is-playing');
    const n0 = d.card.event.playerCount, pays0 = d.card.payouts, roll0 = Math.random();
    const finish0 = Math.min(roll0 < .3 ? 1 : roll0 < .55 && pays0.length > 1 ? 2 : 2 + Math.ceil(Math.random() * (n0 - 1)), n0);
    // the marker tells you first: your place, then it's cleared away
    mark.el.querySelector('.hd-tab').textContent = pays0[finish0 - 1] ? ord(finish0) + '!' : 'OUT';
    mark.el.classList.toggle('is-lost', !pays0[finish0 - 1]);
    squash(mark.body, .08, 160); Foil.thud(pays0[finish0 - 1] ? .4 : .8);
    await wait(PO.reduced ? 0 : 420);
    await glide(mark.body, pays0[finish0 - 1] ? { alpha:0, y:spot(d.i).y - 30 } : { alpha:0, y:spot(d.i).y + 30, r:spot(d.i).r + 8 }, 200);
    mark.body.remove();
    const finish = finish0, prize = pays0[finish - 1] || 0;
    L.record(d.card, finish, prize);
    if (prize){
      L.status(finish === 1 ? 'YOU WON IT!' : 'YOU FINISHED ' + ord(finish), '+' + money(prize));
      L.figure(money(prize), finish === 1 ? 'WON' : 'PAID');
      S.arcadeReward(finish === 1 ? 'elite' : 'strong');
      await chipsOut(prize);
      const from = L.wallet; L.wallet = from + prize;
      for (let i = 1; i <= 8; i++){ L.bank(from + prize * i / 8); S.counterTick(true); await wait(40); }
      S.counterLock(true);
      if (finish === 1) await venueWon(d.card.event.venue);
    } else {
      L.status('OUT IN ' + ord(finish), d.card.event.venue + ' · BETTER LUCK NEXT TIME');
      L.figure(money(0), 'PAID');
      S.koFailClick(); Haptic.tick(10);
      L.keyPlay('PLAY', false);
      await wait(PO.reduced ? 0 : 700);
    }
  }
  // a first win in a venue opens the next one: its matchbook comes out of the slot
  async function venueWon(venue){
    const next = NEXT[venue];
    if (!next || L.venues.has(next)) return;
    L.venues.add(next);
    const v = VENUES.find(x => x.id === next), i = VENUES.indexOf(v);
    drawMatches(i);
    const m = el.querySelectorAll('.hd-match')[i], b = el.getBoundingClientRect(), r = m.getBoundingClientRect();
    m.style.visibility = 'hidden';
    const fly = document.createElement('div');
    fly.className = 'hd-match-fly'; fly.innerHTML = matchbook(v, false);
    el.querySelector('.hd').append(fly);
    const sx = W / 2, sy = slitY(), tx = r.left - b.left + r.width / 2, ty = r.top - b.top + r.height / 2;
    L.status(v.short + ' OPENS', 'A MATCHBOOK FOR THE DESK');
    S.arcadeReward('jackpot'); Haptic.tick(20, 0);
    await tween(PO.reduced ? 1 : 700, (e, t) => {
      fly.style.transform = `translate(${Math.round(mix(sx, tx, e) - 14)}px,${Math.round(mix(sy, ty, e) - 20 - Math.sin(t * Math.PI) * 60)}px) rotate(${snap((1 - e) * 540, 45)}deg) scale(${(2 - e).toFixed(2)})`;
    }, ease.out);
    fly.remove(); m.style.visibility = '';
    m.classList.add('is-new');
    S.cardLanded(); puff({ fx:el.querySelector('.hd-fx') }, tx, ty + 14, 30, { n:6, colour:'#f3d27a' });
  }

  /* ---------------- your chips ---------------- */
  function pileSpots(n){
    const r = el.querySelector('.hd-chips').getBoundingClientRect(), out = [];
    // three stacks, filled in turn, each chip a few pixels up its stack
    for (let i = 0; i < n; i++){ const k = i % 3, lvl = Math.floor(i / 3); out.push({ x:r.left + 18 + k * 34, y:r.bottom - 16 - lvl * 5 - (k === 1 ? 8 : 0) }); }
    return out;
  }
  function buildPile(){
    try {
      CoinWorld.clearWorld();
      CoinWorld.setHost(el.querySelector('.hd'), [2, 6]); CoinWorld.setExtraBlocks([]); CoinWorld.buildWalls();
      const t = CoinWorld.composeTiers(Math.max(1, Math.round(L.wallet / 100)), 9), cols = [];
      t.counts.forEach((n, k) => { for (let i = 0; i < n; i++) cols.push('t' + k); });
      const spots = pileSpots(cols.length);
      pile = cols.map((col, i) => { const c = CoinWorld.body(CoinWorld.makeChip(col), spots[i].x, spots[i].y, 0, 26); CoinWorld.launch(c, { x:spots[i].x, y:spots[i].y, d:26 }, { T:.01, flips:0 }); return c; });
    } catch (e) { pile = []; }
  }
  // a riffle: the stacks hop and fall back in turn, clacking
  async function riffle(){
    if (!pile.length || busy) return;
    Haptic.tick(6);
    const spots = pileSpots(pile.length);
    await Promise.all(pile.map(async (c, i) => {
      await CoinWorld.launch(c, { x:spots[i].x, y:spots[i].y - 14, d:26 }, { wait:PO.reduced ? 0 : (i % 3) * 70 + Math.floor(i / 3) * 25, T:PO.reduced ? .01 : .16, flips:PO.reduced ? 0 : 1, i });
      await CoinWorld.launch(c, { x:spots[i].x, y:spots[i].y, d:26 }, { T:PO.reduced ? .01 : .14, flips:0, i });
    }));
  }
  // paying: a few chips slide off the pile into the slot
  async function chipsIn(fee){
    if (!pile.length) return;
    const r = el.querySelector('.hd-slit').getBoundingClientRect(), n = Math.min(pile.length, Math.max(1, Math.round(fee / 100)));
    const go = pile.splice(pile.length - n, n);
    await Promise.all(go.map((c, i) => CoinWorld.launch(c, { x:r.left + r.width / 2 + (i - n / 2) * 6, y:r.top + 4, d:14, vanish:true }, { wait:PO.reduced ? 0 : i * 60, T:PO.reduced ? .01 : .32, flips:PO.reduced ? 0 : 2, i })));
  }
  // winnings: chips spit out of the slot and onto your pile
  async function chipsOut(prize){
    try {
      const r = el.querySelector('.hd-slit').getBoundingClientRect(), t = CoinWorld.composeTiers(Math.max(1, Math.round(prize / 100)), 7), cols = [];
      t.counts.forEach((n, k) => { for (let i = 0; i < n; i++) cols.push('t' + k); });
      const spots = pileSpots(pile.length + cols.length).slice(pile.length);
      const out = cols.map((col, i) => { const c = CoinWorld.body(CoinWorld.makeChip(col), r.left + r.width / 2, r.top + 6, 30, 20); c.fresh = true; return c; });
      pile.push(...out);
      await Promise.all(out.map((c, i) => CoinWorld.launch(c, { x:spots[i].x, y:spots[i].y, d:26 }, { wait:PO.reduced ? 0 : i * 70, T:PO.reduced ? .01 : .4, flips:PO.reduced ? 0 : 3, i })));
    } catch (e) {}
  }

  /* ---------------- the things on the desk ---------------- */
  function drawMatches(fresh = -1){
    el.querySelector('.hd-matches').innerHTML = VENUES.map((v, i) => L.venues.has(v.id)
      ? `<button class="hd-match${i === fresh ? ' is-new' : ''}" type="button" data-i="${i}" aria-label="${v.short}">${matchbook(v, false)}</button>`
      : `<span class="hd-match is-empty" aria-hidden="true"></span>`).join('');
  }
  function drawCount(){ el.querySelector('.hd-case-n').textContent = L.held.length; }
  // tap a matchbook: it opens on its venue; hold it: strike a match
  function matchTap(m){
    const v = VENUES[+m.dataset.i], open = !m.classList.contains('is-open');
    el.querySelectorAll('.hd-match.is-open').forEach(x => { x.classList.remove('is-open'); x.innerHTML = matchbook(VENUES[+x.dataset.i], false); });
    if (!open){ hint(); return; }
    m.classList.add('is-open'); m.classList.remove('is-new'); m.innerHTML = matchbook(v, true);
    Foil.crinkle(); Haptic.tick(5);
    const h = L.historyFor(v.id);
    L.status(v.id, h.played ? 'PLAYED ' + h.played + ' · BEST ' + ord(h.best) + (h.won ? ' · WON ' + money(h.won) : '') : 'NOT PLAYED HERE YET');
  }
  function strike(m){
    if (m.querySelector('.hd-flame')) return;
    if (!m.classList.contains('is-open')) matchTap(m);
    Foil.rip(); setTimeout(() => Foil.crackle(.6), 60); Haptic.tick(12, 0);
    const f = document.createElement('i');
    f.className = 'hd-flame'; m.append(f);
    burst({ fx:el.querySelector('.hd-fx') }, m.getBoundingClientRect().left - el.getBoundingClientRect().left + 8, m.getBoundingClientRect().top - el.getBoundingClientRect().top - 14, { n:6, colours:['#ffd36b', '#ff9a3c'], vx:[-20, 20], vy:[-80, -30], g:60, life:.5, size:2, spread:4 });
    setTimeout(() => { f.classList.add('is-out'); Foil.thud(.15); }, 1500);
    setTimeout(() => f.remove(), 2100);
  }
  // the banker's lamp: pull the chain. In the dark the felt shows its secret.
  function lamp(){
    lampOn = !lampOn;
    const b = el.querySelector('.hd-lamp');
    b.classList.remove('is-pulled'); void b.offsetWidth; b.classList.add('is-pulled');
    S.buttonPress('key'); S.stageRollClick(.4, true); Haptic.tick(8);
    el.querySelector('.hd').classList.toggle('is-dark', !lampOn);
  }
  // the brass bell: ding, and the shop answers
  async function bell(){
    if (busy) return;
    const b = el.querySelector('.hd-bell');
    b.classList.remove('is-rung'); void b.offsetWidth; b.classList.add('is-rung');
    Foil.bell(); Haptic.tick(10);
    await wait(260);
    L.door('packs');
  }
  function openCase(){
    if (busy) return;
    const b = el.querySelector('.hd-case');
    b.classList.remove('is-open'); void b.offsetWidth; b.classList.add('is-open');
    S.hatchOpen(); Haptic.tick(8);
    setTimeout(() => L.door('album'), 220);
  }
  // now and then, someone looks in
  function idle(){ visitorAt = performance.now() + 25000 + Math.random() * 20000; }
  function tick(){
    if (!el || L.view !== 'hub' || busy || ptr || bitten || visitorOn || CardInspect.isOpen) return;
    if (performance.now() > visitorAt) visitor();
  }
  async function visitor(force){
    if (visitorOn) return;
    visitorOn = true;
    const v = el.querySelector('.hd-visitor'), face = { faceColorIdx:Math.floor(Math.random() * 6) };
    // a table regular peeks over the edge of the felt, one gloved hand gripping it
    try { v.innerHTML = `<span class="hd-v-face"><span class="hd-v-rest">${renderFace(face, 'idle')}</span><span class="hd-v-alt">${renderFace(face, 'think')}</span></span>${GLOVE}`; } catch (e) { visitorOn = false; return; }
    v.classList.remove('is-ducking'); v.classList.add('is-in');
    S.cardReturn();
    await wait(900); v.classList.add('is-glance'); await wait(500); v.classList.remove('is-glance');
    await wait(force ? 1400 : 1000);
    if (v.classList.contains('is-in')){ v.classList.remove('is-in'); L.status('…', VISITOR_LINES[Math.floor(Math.random() * VISITOR_LINES.length)]); setTimeout(hint, 1800); }
    await wait(400);
    visitorOn = false; idle();
  }
  function shoo(){
    const v = el.querySelector('.hd-visitor');
    if (!v.classList.contains('is-in')) return;
    v.classList.add('is-ducking'); v.classList.remove('is-in');
    S.cardDeal(); Haptic.tick(6);
    L.status('…', 'ALRIGHT, ALRIGHT.');
    setTimeout(hint, 1600);
  }

  /* ---------------- touch ---------------- */
  function at(e){ const r = el.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
  function cardAt(target){ const c = target.closest('.ec-card'); return c && desk.find(d => d.c.el === c); }
  function down(e){
    if (ptr || e.button > 0) return;
    idle();
    if (busy){ PO.finishAll(); return; }
    if (e.target.closest('.hd-visitor')){ shoo(); return; }
    const p = at(e), d = cardAt(e.target), m = e.target.closest('.hd-match:not(.is-empty)');
    if (!d && !m) return;
    ptr = { id:e.pointerId, x0:p.x, y0:p.y, x:p.x, y:p.y, t:performance.now(), vx:0, vy:0, d, m, mode:d ? (d === bitten ? 'bitten' : 'card') : 'match' };
    if (m) ptr.timer = setTimeout(() => { if (ptr && ptr.mode === 'match'){ ptr.mode = 'struck'; strike(m); } }, 420);
    if (d && d !== bitten){ ptr.ox = d.c.body.x - p.x; ptr.oy = d.c.body.y - p.y; glide(d.c.body, { z:8 }, 70); Foil.scrape(); Haptic.tick(5); }
    try { el.querySelector('.hd').setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }
  function move(e){
    const q = ptr;
    if (!q || q.id !== e.pointerId) return;
    const p = at(e), now = performance.now(), dt = Math.max(8, now - (q.tm || q.t));
    q.vx = mix(q.vx, (p.x - q.x) / dt, .5); q.vy = mix(q.vy, (p.y - q.y) / dt, .5); q.tm = now; q.x = p.x; q.y = p.y;
    const dx = q.x - q.x0, dy = q.y - q.y0, moved = Math.hypot(dx, dy);
    if (q.mode === 'card' && moved > 8){ q.mode = 'carry'; q.d.c.el.style.zIndex = 30; S.cardReturn(); }
    if (q.mode === 'carry'){
      // carried: it lifts, leans into the move, and the slot wakes as it nears
      const near = q.y + q.oy < slitY() + 110;
      el.querySelector('.hd').classList.toggle('is-near', near);
      CardInspect.setBank(q.d.c, clamp(q.vx * 40, -40, 40));
      q.d.c.body.set({ x:q.x + q.ox, y:q.y + q.oy, z:14, r:clamp(q.vx * 10, -10, 10) });
    }
    if (q.mode === 'bitten' && dy > 24){ q.mode = null; unbite(); }
    if (q.mode === 'match' && moved > 10){ clearTimeout(q.timer); q.mode = null; }
  }
  function up(e, cancel){
    const q = ptr;
    if (!q || q.id !== e.pointerId) return;
    ptr = null; clearTimeout(q.timer);
    try { el.querySelector('.hd').releasePointerCapture(e.pointerId); } catch (_) {}
    el.querySelector('.hd').classList.remove('is-near');
    const tap = Math.hypot(q.x - q.x0, q.y - q.y0) < 8, fresh = performance.now() - (q.tm || 0) < 60;
    if (q.mode === 'match' && tap && !cancel) matchTap(q.m);
    else if (q.mode === 'bitten' && tap && !cancel) pay();
    else if (q.mode === 'card'){
      glide(q.d.c.body, { z:0 }, 90);
      if (tap && !cancel) inspect(q.d);
    }
    else if (q.mode === 'carry'){
      const d = q.d;
      CardInspect.flat(d.c);
      if (!cancel && q.y + q.oy < slitY() + 110){ bite(d); return; }
      // flicked off the side of the desk: another is dealt in its place
      if (!cancel && fresh && Math.abs(q.vx) > .9 && Math.abs(q.vx) > Math.abs(q.vy)){ flickAway(d, Math.sign(q.vx)); return; }
      glide(d.c.body, spot(d.i), 260, { arc:10, easing:ease.back }).then(() => { d.c.el.style.zIndex = 10 + d.i; S.cardLanded(); squash(d.c.body, .05, 140); });
    }
  }
  async function flickAway(d, dir){
    busy = true;
    Foil.flutter(); Haptic.tick(6);
    await glide(d.c.body, { x:dir > 0 ? W + CW : -CW, r:dir * 40, z:20 }, 240, { easing:ease.in });
    d.c.body.remove();
    if (d.card.isNew) d.card.isNew = false;
    await dealOne(d.i);
    busy = false;
  }
  function inspect(d){
    const run = desk.filter(x => x !== bitten);
    CardInspect.open({
      items:run.map(x => ({ card:x.card, source:() => x.c.el })),
      index:Math.max(0, run.indexOf(d)),
      key:{ label:'BUY IN', press:async (item, i, api) => {
        const pick = run[api.index];
        await api.close();
        await bite(pick);
        await pay();
      } }
    });
  }

  /* ---------------- the keys: CASE · PLAY · SHOP ---------------- */
  async function key(name){
    if (CardInspect.isOpen) return;
    if (busy && name !== 'play'){ PO.finishAll(); return; }
    if (name === 'case') return openCase();
    if (name === 'shop') return bell();
    // PLAY: the first press puts tonight's best card in the slot, the second pays
    if (bitten) return pay();
    if (busy) return;
    if (desk.length) await bite(desk[0]);
  }

  window.CareerDesk = {
    init(lab){ L = lab; setInterval(tick, 1000); },
    enter, leave, key, visitor:() => visitor(true),
    resize(){ if (el && L.view === 'hub'){ measure(); layout(); } },
    get state(){ return { cards:desk.length, bitten:bitten ? bitten.card.uid : null, why:desk.map(d => d.why), lamp:lampOn, pile:pile.length, busy }; }
  };
})();
