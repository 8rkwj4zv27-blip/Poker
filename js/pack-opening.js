/* ============================================================
   PACK OPENING V3 — the scene (lab only). Slice 1: the packet.

   Plan: docs/career/PACK_OPENING_V3_PLAN.md. Beats in this slice:
   1 three packets are dealt onto the felt
   2 tap one: it comes forward; drag sideways to turn it over
   3 HOLD it (or the key) to buy: it trembles, the price and your bank
     count down together; let go early and nothing is bought; at the
     end it pops, spins once in the air and lands in front of you
   4 drag across the top seam to tear it: the tear follows your finger
     a pixel column at a time; the strip breaks free and lands
   5 drag the cards up out of the mouth: they come out with friction,
     slip free, land as a squared deck; the empty wrapper slumps aside
   Any tap during an animation finishes it. The key always does the
   next thing. Memory-only: no game saves, no Career transactions.
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, snap, ease, tween, wait, glide, squash, puff, jolt, every, S, Foil } = PO;
  const { Packet, AW, AH, OX, OY } = POPacket;
  const SERIES = [{ id:'house', name:'HOUSE', price:100 }, { id:'club', name:'CLUB', price:300 }, { id:'reserve', name:'RESERVE', price:1000 }];
  const CARD_W = 82, CARD_H = 120, STACK_X = 7, STACK_Y = 20, CARDS = 4, HOLD_MS = 650;
  const money = n => '$' + Math.round(n).toLocaleString('en-US');

  let root, stage, W = 0, H = 0, phase = 'boot', lock = false;
  let packets = [], chosen = null, deck = null, flap = null, wallet = 5000, packNo = 0;
  let pointer = null, charge = null, pull = 0, hasLegend = false, idleAt = 0, stopTick = null;
  const tune = { contents:'surprise', speed:1, sound:true, motion:true };
  const $ = id => root.querySelector('#' + id);

  /* ---------------- layout ---------------- */
  function measure(){ W = stage.el.clientWidth; H = stage.el.clientHeight; }
  const rowS = () => Math.min(1, (W * .28) / AW, (H * .38) / AH);
  const focusS = () => { const s = Math.min(2, (W * .62) / AW, (H * .6) / AH); return s >= 1.9 ? 2 : Math.round(s * 4) / 4; };
  const home = i => ({ x:W * (.2 + .3 * i), y:H * (i === 1 ? .43 : .46), s:rowS(), r:[-6, 0, 6][i], z:0, alpha:1, sx:1, sy:1 });
  const focus = () => ({ x:W / 2, y:H * .45, s:focusS(), r:0, z:4, alpha:1, sx:1, sy:1 });
  const aside = k => ({ x:k ? W * .9 : W * .1, y:H * .1, s:rowS() * .62, r:k ? 12 : -12, z:0, alpha:.75 });
  const deckSpot = () => ({ x:W / 2, y:H * .42, z:0, r:0, s:focusS(), sx:1, sy:1 });
  const wrapperSpot = () => ({ x:W * .23, y:H * .8, z:0, r:-27, s:Math.min(1.25, focusS() * .6), sx:1, sy:1 });

  /* ---------------- the machine around the felt ---------------- */
  function status(title, sub){ $('po-title').textContent = title; $('po-sub').textContent = sub || ''; }
  function figure(n, label){ $('po-fig').textContent = n; $('po-fig-l').textContent = label; }
  function key(label, sub, enabled = true){ $('po-key-label').textContent = label; $('po-key-sub').textContent = sub || ''; $('po-key').disabled = !enabled; }
  // the production reel: each digit that changes rolls over
  let shownBank = null;
  function bank(value = wallet){
    const digits = String(Math.max(0, Math.round(value))).padStart(5, '0'), was = shownBank ?? digits;
    shownBank = digits;
    $('po-bank').innerHTML = '<span class="jp-cell jp-sym">$</span>' + [...digits].map((n, i) => `<span class="jp-cell jp-digit${n !== was[i] ? ' is-turning' : ''}" style="--roll-delay:${i * 20}ms"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${was[i]}</span><span>${n}</span></span></span></span>`).join('');
    $('po-bank').setAttribute('aria-label', 'Lab bankroll ' + money(value));
  }
  function nudge(on, x, y){
    const n = $('po-nudge');
    n.hidden = !on;
    if (on){ n.style.left = Math.round(x) + 'px'; n.style.top = Math.round(y) + 'px'; }
  }

  /* ---------------- 1 · the deal ---------------- */
  async function dealIn(){
    phase = 'deal'; lock = true; chosen = null; hasLegend = false; pull = 0;
    status('THE HOUSE DEALS', 'THREE SEALED PACKETS'); figure('03', 'PACKETS'); key('PICK A PACKET', 'TAP ONE TO TAKE A LOOK', false);
    packets = SERIES.map(d => new Packet(stage, d.id, d.price));
    await Promise.all(packets.map(p => p.ready));
    packets.forEach(fillStack);
    packets.forEach((p, i) => { const h = home(i); p.el.style.zIndex = 10 + i; p.body.set({ ...h, x:h.x + (1 - i) * 30, y:-H * .35, z:40, r:h.r - 60 }); });
    await Promise.all(packets.map(async (p, i) => {
      await wait(i * 120);
      S.cardDeal();
      const h = home(i);
      await glide(p.body, h, 430, { easing:ease.out });
      S.cardLanded(); puff(stage, h.x, h.y + AH * h.s / 2, AW * h.s, { n:6 }); squash(p.body, .07);
    }));
    lock = false; phase = 'choose';
    status('PICK A PACKET', 'TAP ONE TO TAKE A LOOK');
  }

  /* ---------------- 2 · take a look ---------------- */
  async function select(p){
    if (chosen === p) return;
    lock = true; chosen = p; phase = 'selected';
    S.cardReturn(); Foil.rustle(.7);
    key('HOLD TO BUY', money(p.price) + ' · ' + p.series.toUpperCase() + ' EDITION', wallet >= p.price);
    let k = 0;
    await Promise.all(packets.map(q => {
      if (q === p){ q.el.style.zIndex = 30; return glide(q.body, focus(), 320, { arc:18 }).then(() => squash(q.body, .05)); }
      q.el.style.zIndex = 10;
      return glide(q.body, aside(k++), 300);
    }));
    lock = false;
    status(p.series.toUpperCase() + ' EDITION', 'HOLD TO BUY · DRAG TO TURN IT'); figure(money(p.price), 'PRICE');
    key('HOLD TO BUY', money(p.price) + ' · ' + p.series.toUpperCase() + ' EDITION', wallet >= p.price);
    if (wallet < p.price) status('NOT ENOUGH IN THE BANK', 'TUNE → +$5,000');
  }
  async function putBack(){
    if (!chosen) return;
    lock = true; const was = chosen; chosen = null; phase = 'choose';
    turnTo(was, 0);
    await Promise.all(packets.map((q, i) => glide(q.body, home(i), 300, { arc:8 })));
    packets.forEach((q, i) => q.el.style.zIndex = 10 + i);
    lock = false;
    status('PICK A PACKET', 'TAP ONE TO TAKE A LOOK'); figure('03', 'PACKETS'); key('PICK A PACKET', 'TAP ONE TO TAKE A LOOK', false);
  }
  // turning it over: squash to a sliver, swap the face, back out (stepped)
  function setYaw(p, deg){
    p.yaw = deg;
    const c = Math.cos(deg * Math.PI / 180), face = c < 0 ? 'back' : 'front';
    p.body.set({ sx:Math.max(.08, snap(Math.abs(c), .2)) });
    if (face !== p.face){ p.face = face; p.draw(); Foil.rustle(.5); }
    p.el.style.filter = `brightness(${(1 + snap(Math.abs(Math.sin(deg * Math.PI / 180)) * .18, .06)).toFixed(2)})`;
  }
  function turnTo(p, deg){
    const from = p.yaw || 0;
    return tween(220, e => setYaw(p, mix(from, deg, e))).then(() => { p.el.style.filter = ''; });
  }

  /* ---------------- 3 · hold to buy ---------------- */
  function startCharge(){
    const p = chosen;
    if (!p || wallet < p.price || charge) return;
    if (p.face !== 'front') { setYaw(p, 0); p.el.style.filter = ''; }
    Foil.unlock(); S.unlock();
    phase = 'charging';
    const f = focus();
    charge = { p:0, shown:p.price, motor:S.wheelMotor() || { set(){}, stop(){} }, jitterAt:0, jx:0, jy:0, jr:0 };
    status('BUYING…', 'KEEP HOLDING');
    stopTick = every((dt, now) => {
      if (!charge) return false;
      charge.p = Math.min(1, charge.p + dt * PO.speed * 1000 / HOLD_MS);
      const q = charge.p, amp = PO.reduced ? 0 : .5 + 2.8 * q * q;
      if (now - charge.jitterAt > 50){ charge.jitterAt = now; charge.jx = (Math.random() - .5) * 2 * amp; charge.jy = (Math.random() - .5) * 2 * amp; charge.jr = (Math.random() - .5) * 2 * q * 2.4; }
      p.body.set({ x:f.x + charge.jx, y:f.y + charge.jy, z:6 + 18 * q, r:PO.reduced ? 0 : charge.jr, sx:1 + .03 * q, sy:1 + .03 * q });
      p.el.style.filter = `brightness(${(1 + snap(q * .3, .06)).toFixed(2)}) saturate(${(1 + q * .3).toFixed(2)})`;
      charge.motor.set(.15 + q * .85);
      const shown = Math.ceil(p.price * (1 - q) / 5) * 5;
      if (shown !== charge.shown){
        if (Math.floor(shown / (p.price / 12)) !== Math.floor(charge.shown / (p.price / 12))) S.counterTick(true);
        charge.shown = shown;
        p.tagEl.querySelector('b').textContent = money(shown);
        bank(wallet - (p.price - shown));
        $('po-key-sub').textContent = money(shown) + ' TO GO';
      }
      if (q >= 1){ commit(); return false; }
    });
  }
  function releaseCharge(){
    if (!charge || charge.p >= 1) return;
    const p = chosen, c = charge; charge = null; stopTick?.();
    c.motor.stop();
    phase = 'selected';
    S.cardReturn();
    p.tagEl.querySelector('b').textContent = money(p.price); bank();
    p.el.style.filter = '';
    glide(p.body, focus(), 260, { easing:ease.back });
    status(p.series.toUpperCase() + ' EDITION', 'HOLD TO BUY · DRAG TO TURN IT');
    key('HOLD TO BUY', money(p.price) + ' · ' + p.series.toUpperCase() + ' EDITION');
  }
  async function commit(){
    const p = chosen, c = charge; charge = null; stopTick?.();
    c.motor.stop();
    lock = true; phase = 'bought'; packNo++;
    wallet -= p.price; bank(); S.counterLock(true);
    hasLegend = tune.contents === 'legendary' || (tune.contents === 'surprise' && Math.random() < 1 / 3);
    p.el.style.filter = '';
    p.tagEl.querySelector('b').textContent = 'SOLD';
    tearOffTag(p);
    status("IT'S YOURS", p.series.toUpperCase() + ' EDITION'); figure('04', 'INSIDE'); key('…', '', false);
    // the others go back to the house
    packets.filter(q => q !== p).forEach(q => glide(q.body, { y:-H * .3, alpha:0, r:q.body.r * 2 }, 300, { easing:ease.in }).then(() => q.body.remove()));
    packets = [p];
    // POP: squash, launch, one stepped turn in the air, land with weight
    const f = focus();
    await tween(90, e => p.body.set({ sx:1 + .14 * e, sy:1 - .16 * e, z:mix(24, 2, e), x:f.x, y:f.y, r:0 }));
    Foil.crinkle();
    await tween(560, (e, t) => {
      const lift = Math.sin(t * Math.PI) * Math.min(130, H * .2);
      const stretch = t < .25 ? 1 - t * 4 : 0;
      p.body.set({ z:2 + lift, sy:1 + .12 * stretch, sx:1, r:Math.sin(t * Math.PI * 2) * 4 });
      if (!PO.reduced) setYaw(p, t * 360);
    }, ease.lin);
    setYaw(p, 0); p.el.style.filter = '';
    p.body.set({ z:0, r:0 });
    S.deckSettle(); S.cardLanded(); jolt(stage.el, 2); puff(stage, f.x, f.y + AH * f.s / 2, AW * f.s, { n:10 });
    await squash(p.body, .12, 260);
    lock = false; phase = 'sealed';
    p.seamHint = 1; p.draw();
    status('TEAR IT OPEN', 'DRAG ACROSS THE TOP SEAM'); key('OPEN IT', 'OR DRAG ACROSS THE SEAM');
    idleAt = performance.now();
  }
  function tearOffTag(p){
    const r = p.tagEl.getBoundingClientRect(), st = stage.el.getBoundingClientRect();
    const tag = p.tagEl.cloneNode(true);
    tag.classList.add('po-tag-loose');
    tag.style.width = r.width + 'px'; tag.style.height = r.height + 'px';
    stage.fx.append(tag);
    p.tagEl.hidden = true;
    const x0 = r.left - st.left, y0 = r.top - st.top, dir = Math.random() < .5 ? -1 : 1;
    tween(700, (e, t) => {
      tag.style.transform = `translate(${Math.round(x0 + dir * 70 * t)}px,${Math.round(y0 - 50 * Math.sin(t * Math.PI * .7) + 260 * t * t)}px) rotate(${snap(dir * 300 * t, 30)}deg)`;
      tag.style.opacity = String(1 - Math.max(0, t - .7) / .3);
    }, ease.lin).then(() => tag.remove());
    Foil.crinkle();
  }

  /* ---------------- 4 · the tear ---------------- */
  function tearTo(p, t){
    const before = Math.floor(p.tear * AW);
    p.tear = clamp(Math.max(p.tear, t), 0, 1);
    const after = Math.floor(p.tear * AW);
    if (after > before){
      const now = performance.now();
      if (!p.crackAt || now - p.crackAt > 22){ p.crackAt = now; Foil.crackle(.7 + Math.random() * .5); }
    }
    if (hasLegend) p.light = clamp((p.tear - .3) * 1.6, 0, 1);
    p.seamHint = 0;
    p.draw();
  }
  async function finishTear(fast){
    const p = chosen;
    lock = true; phase = 'tearing';
    if (p.tear < 1){
      const from = p.tear;
      await tween(fast ? 140 : 520, e => {
        tearTo(p, mix(from, 1, e));
        p.body.set({ r:p.dir * 4 * Math.sin(e * Math.PI) });
      }, fast ? ease.out : ease.inOut);
    }
    p.pinch = 0;
    Foil.rip();
    flap = p.detachFlap();
    p.open = true; p.tear = 1; p.draw();
    const f = focus(), side = p.dir;
    // the strip flies off the way you tore it and lands on the felt
    glide(flap, { x:side > 0 ? W * .74 : W * .26, y:H * .13, r:side * 168, z:0, s:Math.min(1.25, focusS() * .6) }, 560, { arc:70, easing:ease.out })
      .then(() => { Foil.crinkle(); puff(stage, flap.x, flap.y + 8, AW * flap.s * .6, { n:4 }); squash(flap, .1); });
    // the packet springs back and puffs open; the cards jostle up into the mouth
    S.hatchOpen();
    glide(p.body, { ...f, r:0 }, 220, { easing:ease.back });
    tween(160, (e, t) => p.body.set({ sx:1 + Math.sin(t * Math.PI) * .06, sy:1 - Math.sin(t * Math.PI) * .04 }), ease.lin).then(() => p.body.set({ sx:1, sy:1 }));
    if (!PO.reduced) puff(stage, f.x, f.y - AH * f.s / 2 + 18 * f.s, AW * f.s * .7, { n:8, colour:POPacket_pal(p)['foil-light'] });
    await tween(200, e => setStackLift(p, 14 * e));
    lock = false; phase = 'open';
    status(hasLegend ? 'SOMETHING IN THERE IS GLOWING' : 'SEAL BROKEN', 'PULL THE CARDS UP AND OUT');
    key('PULL THEM OUT', 'OR DRAG THE CARDS UP');
    idleAt = performance.now();
  }
  const POPacket_pal = p => p.art.pal;

  /* ---------------- 5 · out of the mouth ---------------- */
  function fillStack(p){
    p.stackEl.innerHTML = Array.from({ length:CARDS }, () => '<div class="po-card ds-swatch" data-cb="crest"><div class="card back"></div></div>').join('');
    p.cards = [...p.stackEl.children];
    setStackLift(p, 0);
  }
  function setStackLift(p, lift){
    p.lift = lift;
    p.cards.forEach((c, i) => {
      const k = CARDS - 1 - i; // 0 = the card nearest the front
      const off = Math.floor((lift + pull * (1 - k * .09)) / 2) * 2;
      c.style.transform = `translate(${k % 2}px,${-off + k}px)`;
    });
  }
  function pullTo(p, v){
    const before = Math.floor(pull / 4);
    pull = clamp(v, 0, 64);
    if (Math.floor(pull / 4) !== before){ Foil.scrape(); if (pull > 6) S.cardDeal(); }
    setStackLift(p, p.lift);
    const f = focus();
    p.body.set({ y:f.y + pull * f.s * .35, r:Math.sin(pull * .3) * .8 });
  }
  async function slipFree(){
    const p = chosen;
    if (phase !== 'open') return;
    lock = true; phase = 'drawing';
    const f = focus(), from = pull, py = p.body.y;
    Foil.rustle(1.2);
    // the last of the stack slides out by itself as the wrapper drops away
    await tween(230, e => {
      pull = mix(from, 64, e); setStackLift(p, p.lift);
      p.body.set({ y:py + e * AH * f.s * .42 });
    }, ease.in);
    // hand the same card elements to a deck on the felt, exactly where they are
    const st = stage.el.getBoundingClientRect(), r = p.stackEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'po-deck';
    deck = new PO.Body(stage, el, { w:CARD_W, h:CARD_H, shadowW:CARD_W, shadowH:CARD_H });
    const cards = p.cards;
    // re-base the cards on the top card, so the deck sits where they are
    const offs = cards.map(c => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(c.style.transform); return m ? [+m[1], +m[2]] : [0, 0]; });
    const base = Math.min(...offs.map(o => o[1]));
    el.append(...cards);
    cards.forEach((c, i) => { c.style.transform = `translate(${offs[i][0]}px,${offs[i][1] - base}px)`; });
    deck.set({ x:r.left - st.left + r.width / 2, y:r.top - st.top + r.height / 2 + base * f.s, s:f.s, z:0 });
    p.light = 0; p.draw();
    el.style.zIndex = 40;
    p.cards = [];
    // the deck arcs to its spot and squares up, a card at a time
    const d = deckSpot();
    const wrapper = glide(p.body, wrapperSpot(), 480, { arc:10 }).then(async () => {
      Foil.crinkle();
      await tween(260, e => { p.slump = e; p.draw(); });
      p.chips = true; p.draw(); S.chipBounce(.55);
    });
    S.cardDeal();
    await glide(deck, d, 360, { arc:14 });
    S.cardLanded(); puff(stage, d.x, d.y + CARD_H * d.s / 2, CARD_W * d.s, { n:8 }); squash(deck, .07);
    for (let i = 0; i < cards.length; i++){
      const k = cards.length - 1 - i, c = cards[i];
      c.style.transform = `translate(0px,${k}px)`;
      if (i % 2) S.cardLanded();
      await wait(45);
    }
    S.deckSettle();
    await wrapper;
    startTicks();
    lock = false; phase = 'deck';
    status('FOUR INVITES, FACE DOWN', 'THE REVEAL IS SLICE 2'); figure('04', 'TO REVEAL');
    key('ANOTHER PACK', 'SLICE 1 ENDS HERE');
  }

  /* ---------------- the next packet ---------------- */
  async function anotherPack(){
    lock = true;
    const leaving = [deck, flap, chosen && chosen.body].filter(Boolean);
    await Promise.all(leaving.map((b, i) => glide(b, { x:b.x + (i % 2 ? 1 : -1) * W * .2, y:H * 1.25, r:b.r + (i % 2 ? 40 : -40), alpha:.4 }, 340, { easing:ease.in })));
    leaving.forEach(b => b.remove());
    deck = flap = null; packets = [];
    lock = false;
    dealIn();
  }
  function fresh(){
    PO.reset(); charge?.motor.stop(); charge = null;
    stage.objects.innerHTML = ''; stage.shadows.innerHTML = ''; stage.fx.innerHTML = '';
    packets = []; deck = flap = chosen = null; lock = false; pointer = null; pull = 0;
    nudge(false);
    startTicks();
    dealIn();
  }

  /* A slow clock for stepped details: the seam's marching dots, the
     light from the mouth, the chips glinting in the wrapper, the hint. */
  function startTicks(){
    stopTicks?.();
    let acc = 0;
    stopTicks = every(dt => {
      acc += dt;
      if (acc < 1 / 7) return;
      acc = 0;
      for (const p of packets){ if (p.seamHint || p.light || p.chips){ p.frame++; p.draw(); } }
      const p = chosen, idle = performance.now() - idleAt > 1600 && !pointer && !lock;
      if (p && idle && (phase === 'sealed' || phase === 'open')){
        const f = focus(), top = f.y - AH * f.s / 2;
        nudge(true, f.x + (phase === 'sealed' ? -AW * f.s * .35 : 0), top + (phase === 'sealed' ? 10 : -26));
        $('po-nudge').dataset.dir = phase === 'sealed' ? 'right' : 'up';
      } else nudge(false);
    });
  }
  let stopTicks = null;

  /* ---------------- input ---------------- */
  function local(p, px, py){
    const b = p.body, dx = px - b.x, dy = py - (b.y - b.z), a = -b.r * Math.PI / 180;
    return { x:(dx * Math.cos(a) - dy * Math.sin(a)) / (b.s * Math.max(.1, b.sx)) + AW / 2, y:(dx * Math.sin(a) + dy * Math.cos(a)) / (b.s * b.sy) + AH / 2 };
  }
  function at(e){ const r = stage.el.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
  function onDown(e){
    if (pointer || e.button > 0) return;
    Foil.unlock(); S.unlock(); idleAt = performance.now(); nudge(false);
    if (lock){ PO.finishAll(); return; } // tap to fast-forward
    const pt = at(e), el = e.target.closest('.po-packet'), p = el && packets.find(q => q.el === el);
    pointer = { id:e.pointerId, x0:pt.x, y0:pt.y, x:pt.x, y:pt.y, t:performance.now(), mode:null, p };
    stage.el.setPointerCapture(e.pointerId);
    if (phase === 'choose'){ if (p) pointer.mode = 'pick'; }
    else if (phase === 'selected'){
      if (p === chosen){ pointer.mode = 'press'; pointer.yaw0 = p.yaw || 0; pointer.timer = setTimeout(() => { if (pointer && pointer.mode === 'press') { pointer.mode = 'charge'; startCharge(); } }, 90); }
      else if (p) pointer.mode = 'pick';
      else pointer.mode = 'away';
    }
    else if (phase === 'sealed' && p === chosen){
      const l = local(p, pt.x, pt.y);
      if (l.y < 60 && l.y > -40){
        if (p.tear === 0) p.dir = l.x < AW / 2 ? 1 : -1;
        pointer.mode = 'tear'; pointer.t0 = p.tear; pointer.vx = 0; p.pinch = 1;
        p.body.live = true;
      }
    }
    else if (phase === 'open' && p === chosen){
      const l = local(p, pt.x, pt.y);
      if (l.y < 120){ pointer.mode = 'pull'; pointer.pull0 = pull; }
    }
    e.preventDefault();
  }
  function onMove(e){
    const q = pointer;
    if (!q || q.id !== e.pointerId) return;
    const pt = at(e), now = performance.now(), dt = Math.max(8, now - (q.tm || q.t));
    q.vx = (pt.x - q.x) / dt; q.tm = now; q.x = pt.x; q.y = pt.y;
    const dx = q.x - q.x0, dy = q.y - q.y0, moved = Math.hypot(dx, dy);
    if (q.mode === 'press' && moved > 8){ clearTimeout(q.timer); q.mode = 'turn'; }
    if (q.mode === 'charge' && moved > 16){ releaseCharge(); q.mode = 'turn'; q.x0 = q.x; q.yaw0 = chosen.yaw || 0; }
    if (q.mode === 'turn'){ setYaw(chosen, q.yaw0 + dx * 1.1); return; }
    if (q.mode === 'tear'){
      const p = chosen, s = p.body.s;
      tearTo(p, q.t0 + (dx * p.dir) / (AW * s * .92));
      // the packet is tugged toward your finger
      const f = focus(), tug = clamp(q.vx * p.dir * 5, 0, 7);
      p.body.set({ r:p.dir * (1.5 + tug), x:f.x + p.dir * Math.min(10, Math.max(0, dx * p.dir) * .06) });
      if (p.tear >= 1){ q.mode = null; p.body.live = false; finishTear(true); }
      return;
    }
    if (q.mode === 'pull'){
      pullTo(chosen, q.pull0 - dy / chosen.body.s);
      if (pull >= 46){ q.mode = null; slipFree(); }
    }
  }
  function onUp(e, cancel){
    const q = pointer;
    if (!q || q.id !== e.pointerId) return;
    pointer = null; clearTimeout(q.timer);
    try { stage.el.releasePointerCapture(e.pointerId); } catch (_) {}
    idleAt = performance.now();
    const tap = Math.hypot(q.x - q.x0, q.y - q.y0) < 8;
    if (q.mode === 'pick' && tap && !cancel) select(q.p);
    else if (q.mode === 'away' && tap && !cancel) putBack();
    else if (q.mode === 'charge') releaseCharge();
    else if (q.mode === 'turn'){ const y = chosen.yaw || 0; turnTo(chosen, Math.round(y / 180) * 180 % 360 === 0 ? Math.round(y / 360) * 360 : Math.round(y / 180) * 180); }
    else if (q.mode === 'tear'){
      const p = chosen; p.body.live = false; p.pinch = 0; p.draw();
      if (!cancel && q.vx * p.dir > .8 && p.tear > .3) finishTear(true);
      else { glide(p.body, focus(), 300, { easing:ease.back }); if (p.tear > 0 && p.tear < 1) status('HALF OPEN', 'KEEP TEARING'); }
    }
    else if (q.mode === 'pull'){
      if (!cancel && pull >= 26) slipFree();
      else { const from = pull; tween(200, e2 => pullTo(chosen, mix(from, 0, e2)), ease.back); }
    }
  }
  // a key press acts on the phase it started in: holding the key to buy
  // must not also open the packet when you let go
  let keyFrom = null, keyHeld = false;
  function onKeyDown(){
    Foil.unlock(); S.unlock(); idleAt = performance.now();
    keyFrom = lock ? null : phase; keyHeld = true;
    if (lock){
      PO.finishAll();
      // still settling into your hand: start buying as soon as it lands
      if (phase === 'selected') setTimeout(() => { if (keyHeld && !lock && phase === 'selected'){ keyFrom = 'selected'; startCharge(); } }, 0);
      return;
    }
    if (phase === 'selected') startCharge();
  }
  function onKeyUp(){
    const from = keyFrom; keyFrom = null; keyHeld = false;
    if (phase === 'charging') releaseCharge();
    else if (lock || from !== phase) return;
    else if (phase === 'sealed'){ chosen.dir = 1; finishTear(false); }
    else if (phase === 'open') { pullTo(chosen, 20); slipFree(); }
    else if (phase === 'deck') anotherPack();
  }

  /* ---------------- the lab sheet ---------------- */
  function sheet(){
    const s = $('po-sheet');
    s.hidden = !s.hidden;
  }
  function applyTune(){
    PO.speed = tune.speed;
    PO.reduced = !tune.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { settings.sound = tune.sound; } catch (e) {}
    root.querySelectorAll('[data-tune]').forEach(b => b.setAttribute('aria-pressed', String(String(tune[b.dataset.tune]) === b.dataset.v)));
  }

  function setup(){
    root = document.createElement('main');
    root.id = 'po'; root.className = 'lobby-card pc-housing';
    root.innerHTML = `
      <header class="po-top">
        <div class="po-brand">POKER FACES<small>THE PACK TABLE</small></div>
        <div class="po-wallet ch2-bankroll-housing"><div class="ch2-bankroll-reel po-bank" id="po-bank"></div></div>
        <button class="icon-btn" id="po-tune" aria-label="Lab controls">TUNE</button>
      </header>
      <div class="crt po-status" role="status" aria-live="polite">
        <div><span class="crt-line" id="po-title"></span><span class="crt-caption" id="po-sub"></span></div>
        <div class="po-count"><span class="crt-figure" id="po-fig">03</span><span class="crt-caption" id="po-fig-l">PACKETS</span></div>
      </div>
      <section class="po-stage" id="po-stage" data-theme="emerald" aria-label="The felt">
        <div class="felt"></div>
        <div class="po-shadows"></div><div class="po-objects"></div><div class="po-fx"></div>
        <i class="po-nudge" id="po-nudge" hidden></i>
      </section>
      <footer class="po-console">
        <div class="po-rail" aria-hidden="true"></div>
        <div class="pc-primary-cradle"><button class="pc-button pc-button-primary" id="po-key"><span class="pc-lamp is-amber"></span><span><span class="po-key-label" id="po-key-label"></span><small id="po-key-sub"></small></span><span class="pc-lamp is-amber"></span></button></div>
      </footer>
      <section class="po-sheet" id="po-sheet" hidden aria-label="Lab controls">
        <h2>PACK OPENING · SLICE 1</h2>
        <p>The packet: deal, pick, hold to buy, tear, draw. Lab money, nothing saved.</p>
        <label>NEXT PACK HOLDS</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="contents" data-v="surprise">SURPRISE</button><button class="pc-button pc-button-secondary" data-tune="contents" data-v="legendary">A LEGENDARY</button><button class="pc-button pc-button-secondary" data-tune="contents" data-v="none">NO LEGENDARY</button></div>
        <label>SPEED</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="speed" data-v="1">REAL</button><button class="pc-button pc-button-secondary" data-tune="speed" data-v="0.5">HALF</button><button class="pc-button pc-button-secondary" data-tune="speed" data-v="0.25">QUARTER</button></div>
        <label>SOUND · MOTION</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="sound" data-v="true">SOUND ON</button><button class="pc-button pc-button-secondary" data-tune="sound" data-v="false">OFF</button><button class="pc-button pc-button-secondary" data-tune="motion" data-v="true">MOTION ON</button><button class="pc-button pc-button-secondary" data-tune="motion" data-v="false">REDUCED</button></div>
        <div class="po-seg"><button class="pc-button pc-button-secondary" id="po-fresh">FRESH TABLE</button><button class="pc-button pc-button-secondary" id="po-credit">+$5,000</button><button class="pc-button pc-button-secondary" id="po-done">DONE</button></div>
      </section>`;
    document.body.classList.add('po-lab');
    const oldFelt = document.getElementById('felt'); if (oldFelt) oldFelt.id = 'po-parked-felt';
    const homeEl = document.getElementById('home');
    homeEl.classList.add('po-home'); homeEl.classList.remove('hidden');
    [...homeEl.classList].filter(c => c.startsWith('hb-')).forEach(c => homeEl.classList.remove(c));
    homeEl.append(root);
    const st = $('po-stage');
    st.querySelector('.felt').id = 'felt';
    stage = { el:st, shadows:st.querySelector('.po-shadows'), objects:st.querySelector('.po-objects'), fx:st.querySelector('.po-fx') };
    try { CoinWorld.setTray(null); } catch (e) {}
    st.addEventListener('pointerdown', onDown);
    st.addEventListener('pointermove', onMove);
    st.addEventListener('pointerup', e => onUp(e, false));
    st.addEventListener('pointercancel', e => onUp(e, true));
    const k = $('po-key');
    // the key keeps the pointer while it's held (its press travel must not
    // count as letting go)
    k.addEventListener('pointerdown', e => { try { k.setPointerCapture(e.pointerId); } catch (_) {} onKeyDown(); });
    k.addEventListener('pointerup', onKeyUp);
    k.addEventListener('pointercancel', () => { keyFrom = null; keyHeld = false; if (phase === 'charging') releaseCharge(); });
    k.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat){ e.preventDefault(); onKeyDown(); } });
    k.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); onKeyUp(); } });
    $('po-tune').onclick = sheet; $('po-done').onclick = sheet;
    $('po-fresh').onclick = () => { sheet(); fresh(); };
    $('po-credit').onclick = () => { wallet += 5000; bank(); if (phase === 'selected' && chosen) key('HOLD TO BUY', money(chosen.price) + ' · ' + chosen.series.toUpperCase() + ' EDITION', true); };
    root.querySelectorAll('[data-tune]').forEach(b => b.onclick = () => {
      const v = b.dataset.v; tune[b.dataset.tune] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; applyTune();
    });
    new ResizeObserver(() => {
      const w = W, h = H; measure();
      if (!w || (Math.abs(w - W) < 1 && Math.abs(h - H) < 1) || lock || pointer) return;
      if (phase === 'choose') packets.forEach((p, i) => p.body.set(home(i)));
      if (chosen && ['selected', 'sealed', 'open'].includes(phase)) chosen.body.set(focus());
    }).observe(st);
    measure(); bank(); applyTune(); startTicks();
    dealIn();
    // read-only diagnostics for the lab's checks
    window.PackOpening = { get state(){ return { phase, lock, wallet, packNo, hasLegend, tear:chosen?.tear ?? 0, pull, chosen:chosen?.series ?? null, packets:packets.length, deck:!!deck, size:{ W, H } }; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
