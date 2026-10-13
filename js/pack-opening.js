/* ============================================================
   PACK OPENING V3 — the scene (lab only). Slices 1 to 3.

   Plan: docs/career/PACK_OPENING_V3_PLAN.md. Beats:
   1 three packets are dealt onto the felt; pick them up, slide them,
     throw them (they bounce off the rails and land with a puff)
   2 tap one: it comes forward; drag sideways to turn it over (it
     coasts and settles); the foil catches the light as it moves
   3 HOLD it (or the key) to buy: it trembles, the price and your bank
     count down together; let go early and nothing is bought; at the
     end it pops, spins once in the air and lands in front of you
   4 drag across the top seam to tear it: the tear follows your finger
     a pixel column at a time; the strip breaks free and lands
   5 drag the cards up out of the mouth: they come out with friction,
     slip free, land as a squared deck; the empty wrapper slumps aside
   6 the reveal: tap or flick the deck and the top card flies up and
     flips; hold it to squeeze the corner and peek at the index first.
     Each tier lands harder; a Legendary dims the house, hangs on its
     edge, slams, lights up the CRT and plays its own event flourish
   7 the haul: the hand lifts out of the lip; tap a card to bank it,
     spin it and read it; flick the wrapper away and its chips spill;
     KEEP posts the hand into the collection, the chips count in, and
     the house deals again
   Any tap during an animation finishes it. The key always does the
   next thing. Memory-only: no game saves, no Career transactions.

   EMBEDDED (window.PO_EMBED, set by js/vending-machine.js): no table of its
   own. The Career hub hands it one packet (openOwned) and its reel and
   middle key stand in for the machine around the felt. Everything is
   sized to the hub's table (L.tableS). It runs the tear and the pull;
   the chips count in (cfg.bag); once the cards are out, face down, they
   are handed to the hub as a deck with the wrapper and the strip, which
   land somewhere different each time (cfg.handOver). When the player taps
   the hub's deck (all the packets' cards in one), the reveal runs on it
   (session): each card turned is handed to the hub to put down
   (cfg.place); tapping the deck again turns the next, tapping anywhere
   else gives the deck back (cfg.deckBack).
   ============================================================ */
(() => {
  'use strict';
  const { clamp, mix, snap, ease, tween, wait, glide, squash, puff, burst, jolt, every, S, Foil, Haptic } = PO;
  const { Packet, AW, AH, OX, OY } = POPacket;
  const { setTurn, setBank, spin, flat, faceUp } = CardInspect;
  const SERIES = [{ id:'house', name:'HOUSE', price:100 }, { id:'club', name:'CLUB', price:300 }, { id:'reserve', name:'RESERVE', price:1000 }];
  const CARD_W = 82, CARD_H = 120, STACK_X = 7, STACK_Y = 20, CARDS = 4, HOLD_MS = 650;
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  // the Career lab (career-hub-lab.html) opens on the desk; this table becomes the packet shop
  const CAREER = !!window.CAREER_LAB;
  const EMBED = !!window.PO_EMBED;
  // embedded: the host's machine (ui) and its hooks (cfg); see attach()
  let ui = null, cfg = null, nudgeEl = null;
  // where the hand, its squaring, the wrapper and the torn strip sit
  // (fractions of the felt); tableS (embedded): the host table's scale,
  // which everything left on it shares
  const L = { handY:.83, squareY:.8, wrapY:.56, flapY:.13, deckX:.83, deckY:.62, railLift:0, tableS:0 };

  let root, stage, W = 0, H = 0, phase = 'boot', lock = false;
  let packets = [], chosen = null, deck = null, flap = null, wallet = 5000, packNo = 0;
  let pointer = null, charge = null, pull = 0, hasLegend = false, idleAt = 0, stopTick = null;
  let coast = null, zTop = 0;
  const tune = { contents:'surprise', event:'random', speed:1, sound:true, motion:true, haptics:true };
  const $ = id => root.querySelector('#' + id);

  /* ---------------- layout ---------------- */
  function measure(){ W = stage.el.clientWidth; H = stage.el.clientHeight; }
  const rowS = () => Math.min(1, (W * .28) / AW, (H * .38) / AH);
  const focusS = () => { const s = Math.min(2, (W * .62) / AW, (H * .6) / AH); return s >= 1.9 ? 2 : Math.round(s * 4) / 4; };
  // where each packet rests: dealt into a row, then wherever you leave it
  const slot = i => ({ fx:.2 + .3 * i, fy:i === 1 ? .43 : .46, r:[-6, 0, 6][i] });
  const home = p => ({ x:W * p.home.fx, y:H * p.home.fy, s:rowS(), r:p.home.r, z:0, alpha:1, sx:1, sy:1 });
  const focus = () => ({ x:W / 2, y:H * .45, s:focusS(), r:0, z:4, alpha:1, sx:1, sy:1, ...(cfg?.focus?.(W, H) || {}) });
  const aside = k => ({ x:k ? W * .9 : W * .1, y:H * .1, s:rowS() * .62, r:k ? 12 : -12, z:0, alpha:.75 });
  const deckSpot = () => ({ x:W * L.deckX, y:H * L.deckY, z:0, r:4, s:L.tableS || Math.min(1.2, focusS() * .6), sx:1, sy:1 });
  const wrapperSpot = () => ({ x:W * .16, y:H * L.wrapY, z:0, r:-27, s:L.tableS || Math.min(1, focusS() * .46), sx:1, sy:1 });

  /* ---------------- the machine around the felt ---------------- */
  function status(title, sub){ if (ui) return ui.status(title, sub || ''); $('po-title').textContent = title; $('po-sub').textContent = sub || ''; }
  function figure(n, label){ if (ui) return ui.figure(n, label); $('po-fig').textContent = n; $('po-fig-l').textContent = label; }
  function key(label, sub, enabled = true){ if (ui) return ui.key(label, sub || '', enabled); $('po-key-label').textContent = label; $('po-key-sub').textContent = sub || ''; $('po-key').disabled = !enabled; }
  function keySub(sub){ if (ui) return ui.keySub(sub); $('po-key-sub').textContent = sub; }
  const bankEl = () => ui ? ui.bankEl() : $('po-bank');
  // the production reel: each digit that changes rolls over
  let shownBank = null;
  function bank(value = wallet){
    if (ui) return ui.bank(value);
    const digits = String(Math.max(0, Math.round(value))).padStart(5, '0'), was = shownBank ?? digits;
    shownBank = digits;
    $('po-bank').innerHTML = '<span class="jp-cell jp-sym">$</span>' + [...digits].map((n, i) => `<span class="jp-cell jp-digit${n !== was[i] ? ' is-turning' : ''}" style="--roll-delay:${i * 20}ms"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${was[i]}</span><span>${n}</span></span></span></span>`).join('');
    $('po-bank').setAttribute('aria-label', 'Lab bankroll ' + money(value));
  }
  function nudge(on, x, y){
    const n = nudgeEl;
    n.hidden = !on;
    if (on){ n.style.left = Math.round(x) + 'px'; n.style.top = Math.round(y) + 'px'; }
  }

  /* ---------------- 1 · the deal ---------------- */
  async function dealIn(){
    phase = 'deal'; lock = true; chosen = null; hasLegend = false; pull = 0;
    status(CAREER ? 'THE PACKET SHOP' : 'THE HOUSE DEALS', 'THREE SEALED PACKETS'); figure('03', 'PACKETS'); key('PICK A PACKET', 'TAP ONE TO TAKE A LOOK', false);
    packets = SERIES.map(d => new Packet(stage, d.id, d.price));
    await Promise.all(packets.map(p => p.ready));
    packets.forEach(fillStack);
    if (CAREER) return dispense();
    packets.forEach((p, i) => { p.home = slot(i); const h = home(p); p.el.style.zIndex = 12 - i; p.body.set({ ...h, x:h.x + (1 - i) * 30, y:-H * .35, z:40, r:h.r - 60 }); });
    await Promise.all(packets.map(async (p, i) => {
      await wait(i * 120);
      S.cardDeal(); Foil.flutter();
      const h = home(p), skid = (1 - i) * 14 + 4;
      // dealt with a flick: it touches down short, then skids home on the felt
      await glide(p.body, { ...h, x:h.x + skid, y:h.y - 10, r:h.r - 8 }, 380, { easing:ease.out });
      S.cardLanded(); Foil.thud(.35); Haptic.tick(8);
      puff(stage, h.x + skid, h.y - 10 + AH * h.s / 2, AW * h.s, { n:6 });
      Foil.scrape();
      await glide(p.body, h, 150, { easing:ease.out });
      squash(p.body, .06);
    }));
    lock = false; phase = 'choose';
    status('PICK A PACKET', 'TAP ONE · OR MOVE THEM ABOUT');
  }

  /* The shop's machine: each packet waits behind a brass hatch. The hatch
     clunks open, the packet drops onto the counter felt and bounces. */
  const hatchAt = i => { const h = $('po-hatches').children[i], st = stage.el.getBoundingClientRect(), r = h.getBoundingClientRect(); return { x:r.left - st.left + r.width / 2, y:r.top - st.top + r.height * .6 }; };
  async function dispense(){
    packets.forEach((p, i) => { p.home = slot(i); p.el.style.zIndex = 12 - i; const a = hatchAt(i); p.body.set({ ...home(p), x:a.x, y:a.y, z:0, s:rowS() * .3, alpha:0, r:0 }); });
    await Promise.all(packets.map(async (p, i) => {
      await wait(PO.reduced ? 0 : 140 + i * 170);
      const hatch = $('po-hatches').children[i];
      hatch.classList.add('is-open'); S.hatchOpen(); Haptic.tick(8);
      await glide(p.body, { alpha:1, s:rowS() * .6, z:10 }, 90);
      Foil.crinkle();
      const h = home(p);
      await glide(p.body, { ...h, x:h.x + (1 - i) * 4, y:h.y - 6, z:0 }, 360, { arc:46, easing:ease.in });
      S.cardLanded(); Foil.thud(.4); Haptic.tick(10); puff(stage, h.x, h.y + AH * h.s / 2, AW * h.s, { n:6 });
      squash(p.body, .12, 260);
      await glide(p.body, h, 140, { easing:ease.out });
      setTimeout(() => { hatch.classList.remove('is-open'); S.hatchClose(); }, 120);
    }));
    lock = false; phase = 'choose';
    status('THE PACKET SHOP', 'TAP ONE · OR MOVE THEM ABOUT');
  }
  // the packets you didn't buy go back up into their hatches
  function restock(q){
    const i = SERIES.findIndex(d => d.id === q.series), hatch = $('po-hatches').children[i], a = hatchAt(i);
    hatch.classList.add('is-open'); S.hatchOpen();
    return glide(q.body, { x:a.x, y:a.y, z:10, s:rowS() * .3, alpha:0, r:0 }, 320, { arc:30, easing:ease.in })
      .then(() => { q.body.remove(); hatch.classList.remove('is-open'); S.hatchClose(); });
  }

  /* Packets are objects: pick one up, slide it, throw it. It lifts off
     the felt (its shadow drifts), leans into the direction it's moving,
     catches the light, bounces off the rails and off the other packets,
     and lands with a puff. */
  function liftPacket(p){
    stopCoast(p);
    p.el.style.zIndex = 20 + (++zTop);
    p.drag = { r:p.body.r, dist:0 };
    Foil.crinkle(); S.cardReturn(); Haptic.tick(8);
    tween(90, e => p.body.set({ z:mix(0, 16, e), s:rowS() * (1 + .06 * e) }));
  }
  function dragPacket(p, x, y, vx, vy){
    const b = p.body, hw = AW * b.s / 2, hh = AH * b.s / 2;
    const nx = clamp(x, hw * .6, W - hw * .6), ny = clamp(y, hh * .5, H - hh * .95);
    p.drag.dist += Math.hypot(nx - b.x, ny - b.y);
    if (p.drag.dist > 46){ p.drag.dist = 0; Foil.rustle(.35); }
    const lean = clamp(vx * 22, -16, 16);
    p.shine = clamp(nx / W, 0, 1) * 230 - 40; p.shineA = Math.min(1, .35 + Math.abs(vx) * 1.4);
    b.set({ x:nx, y:ny, r:p.home.r + lean });
    p.draw();
    // slide it into another packet and you shove that one along the felt
    for (const q of packets){
      if (q === p || q.coastStop) continue;
      const dx = q.body.x - nx, dy = q.body.y - ny, d = Math.hypot(dx, dy), min = AW * b.s * .72;
      if (d < min && d > 0){
        const sp = Math.max(.35, Math.hypot(vx, vy));
        throwPacket(q, dx / d * sp * .8, dy / d * sp * .8, true);
        knock(q, sp * 1000);
      }
    }
  }
  /* A packet sliding on (or flying over) the felt. vx, vy in px/ms;
     grounded: it was shoved, not thrown, so it never leaves the felt. */
  function throwPacket(p, vx, vy, grounded = false){
    stopCoast(p);
    const b = p.body;
    let landed = PO.reduced || grounded, vz = 0;
    vx = clamp(vx, -2.2, 2.2) * 1000; vy = clamp(vy, -2.2, 2.2) * 1000;
    if (PO.reduced) land(p, true);
    let rest = 0;
    const stop = every(dt => {
      dt *= PO.speed;
      const hw = AW * b.s / 2 * .6, top = AH * b.s / 2 * .5, bottom = H - AH * b.s / 2 * .95;
      let x = b.x + vx * dt, y = b.y + vy * dt;
      // the rails: it bounces off, loses most of its speed, and the box feels it
      if (x < hw || x > W - hw){ x = clamp(x, hw, W - hw); vx = -vx * .4; bump(p, Math.abs(vx)); }
      if (y < top || y > bottom){ y = clamp(y, top, bottom); vy = -vy * .4; bump(p, Math.abs(vy)); }
      if (!landed){ vz -= 1400 * dt; const z = Math.max(0, b.z + vz * dt); b.z = z; if (z <= 0){ landed = true; land(p, false); } }
      // on the felt it can knock into the others: it hands over most of its speed
      if (landed){
        for (const q of packets){
          if (q === p) continue;
          const dx = q.body.x - x, dy = q.body.y - y, d = Math.hypot(dx, dy), min = AW * b.s * .72;
          if (d >= min || d === 0) continue;
          const nx = dx / d, ny = dy / d, along = vx * nx + vy * ny;
          if (along <= 0) continue;
          x -= nx * (min - d) * .5; y -= ny * (min - d) * .5;
          vx -= nx * along * .7; vy -= ny * along * .7;
          throwPacket(q, nx * along * .65 / 1000, ny * along * .65 / 1000, true);
          knock(q, along);
        }
      }
      const sp = Math.hypot(vx, vy), drag = Math.pow(landed ? .02 : .5, dt);
      vx *= drag; vy *= drag;
      if (landed && sp > 60 && (rest += sp * dt) > 30){ rest = 0; Foil.scrape(); }
      p.shineA = Math.max(0, p.shineA - dt * 2); p.shine += vx * dt * .3;
      b.set({ x, y, r:mix(b.r, p.home.r + clamp(vx * .012, -12, 12), .25), s:rowS() * (landed ? 1 : 1.06) });
      p.draw();
      if (landed && sp < 14){
        p.coastStop = null;
        p.home = { fx:b.x / W, fy:b.y / H, r:p.home.r };
        b.set({ r:p.home.r, s:rowS() }); p.shineA = 0; p.draw();
        return false;
      }
    });
    p.coastStop = stop;
  }
  // stop one packet (or all of them) where it is, and make that its home
  function stopCoast(only){
    for (const p of only ? [only] : packets){
      if (!p.coastStop) continue;
      p.coastStop(); p.coastStop = null;
      p.home = { fx:p.body.x / W, fy:p.body.y / H, r:p.home.r }; p.body.set({ z:0, s:rowS() });
    }
  }
  function knock(q, power){
    const k = Math.min(1, power / 900);
    Foil.thud(.25 + k * .5); Foil.crinkle(); S.cardLanded(); Haptic.tick(10);
    squash(q.body, .05 + k * .05, 160);
  }
  function bump(p, power){
    if (power < 40) return;
    const k = Math.min(1, power / 900);
    Foil.thud(.3 + k * .6); S.cardLanded(); jolt(stage.el, k > .5 ? 2 : 1); Haptic.tick(k > .5 ? 16 : 8);
    squash(p.body, .04 + k * .06, 160);
  }
  function land(p, quiet){
    const b = p.body;
    b.set({ z:0 });
    if (quiet) return;
    Foil.thud(.5); S.cardLanded(); Haptic.tick(12);
    puff(stage, b.x, b.y + AH * b.s / 2, AW * b.s, { n:6 });
    squash(b, .07);
  }

  /* The price tag hangs on a string: it swings when the packet moves,
     shakes when you shake it, and settles in a few stepped swings. */
  function swingTags(dt){
    if (!dt) return;
    for (const p of packets){
      if (!p.tagEl || p.tagEl.hidden || !p.body) continue;
      const b = p.body, vx = (b.x - (p.lx ?? b.x)) / dt, vy = (b.y - b.z - (p.ly ?? b.y - b.z)) / dt;
      const ax = (vx - (p.lvx || 0)) / dt, ay = (vy - (p.lvy || 0)) / dt;
      p.lx = b.x; p.ly = b.y - b.z; p.lvx = vx; p.lvy = vy;
      p.th = p.th || 0; p.om = p.om || 0;
      // swung by sideways shoves (and a little by lifts), pulled straight by gravity
      p.om += (-p.th * 70 - p.om * 3.2 - clamp(ax, -6000, 6000) * .018 + clamp(ay, -6000, 6000) * .004 * Math.sign(p.th || 1)) * dt;
      p.th = clamp(p.th + p.om * dt, -55, 55);
      const shown = snap(p.th - b.r * .5, 6);
      if (shown !== p.thShown){ p.thShown = shown; p.tagEl.style.transform = `rotate(${9 + shown}deg)`; }
    }
  }

  /* ---------------- 2 · take a look ---------------- */
  async function select(p){
    if (chosen === p) return;
    stopCoast();
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
    sweep(p, 520);
    key('HOLD TO BUY', money(p.price) + ' · ' + p.series.toUpperCase() + ' EDITION', wallet >= p.price);
    if (wallet < p.price) status('NOT ENOUGH IN THE BANK', 'TUNE → +$5,000');
  }
  async function putBack(){
    if (!chosen) return;
    if (EMBED){ const was = chosen; turnTo(was, 0); chosen = null; packets = []; phase = 'idle'; cfg.onPutBack?.(was); return; }
    lock = true; const was = chosen; chosen = null; phase = 'choose';
    turnTo(was, 0);
    await Promise.all(packets.map(q => glide(q.body, home(q), 300, { arc:8 })));
    S.cardLanded(); Foil.thud(.35);
    packets.forEach((q, i) => q.el.style.zIndex = 12 - i);
    lock = false;
    status('PICK A PACKET', 'TAP ONE · OR MOVE THEM ABOUT'); figure('03', 'PACKETS'); key('PICK A PACKET', 'TAP ONE TO TAKE A LOOK', false);
  }
  /* Turning it over is drawn by the packet itself (a narrowing face,
     the crimped edge, the near side standing taller); the yaw is
     stepped like every other pose, and the light slides across the
     foil as it turns. The shadow narrows with it. */
  function setYaw(p, deg){
    deg = snap(deg, 9);
    if (deg === p.yaw) return;
    p.yaw = deg;
    const r = deg * Math.PI / 180, c = Math.cos(r), face = c < 0 ? 'back' : 'front';
    if (face !== p.face){ p.face = face; Foil.flutter(); }
    const t = (((deg % 180) + 180) % 180) / 180;
    p.shine = mix(-40, 200, t); p.shineA = Math.min(1, Math.abs(Math.sin(r * 2)) * 1.3);
    p.body.set({ shx:Math.max(.12, Math.abs(c)) });
    p.draw();
  }
  function turnTo(p, deg, ms = 220){
    const from = p.yaw || 0;
    return tween(ms, e => setYaw(p, mix(from, deg, e)), ease.back).then(() => { p.shineA = 0; p.draw(); });
  }
  const nearestFace = y => Math.round(y / 180) * 180;
  // let go mid-turn and it keeps spinning, slows on the felt's friction,
  // then drops onto the nearer face
  function coastTurn(p, v){
    let vel = clamp(v * 1000, -1500, 1500);
    if (Math.abs(vel) < 120 || PO.reduced){ turnTo(p, nearestFace(p.yaw || 0)).then(() => turnLanded(p)); return; }
    const stop = every(dt => {
      if (chosen !== p || phase !== 'selected') return false;
      setYaw(p, (p.yaw || 0) + vel * dt * PO.speed);
      vel *= Math.pow(.12, dt * PO.speed);
      if (Math.abs(vel) < 200){
        coast = null;
        const to = vel > 0 ? Math.ceil(p.yaw / 180) * 180 : Math.floor(p.yaw / 180) * 180;
        turnTo(p, to, 260).then(() => turnLanded(p));
        return false;
      }
    });
    coast = { stop:() => stop(), p:null };
  }
  function turnLanded(p){
    p.yaw = ((p.yaw % 360) + 360) % 360;
    Foil.crinkle(); squash(p.body, .05, 160);
  }
  /* The light catching the foil: a band sweeps the packet once. */
  function sweep(p, ms = 650){
    if (PO.reduced || p.sweeping) return;
    p.sweeping = true;
    tween(ms, e => { p.shine = mix(-40, 210, e); p.shineA = Math.sin(e * Math.PI) * .9; p.draw(); }, ease.inOut)
      .then(() => { p.sweeping = false; p.shineA = 0; p.draw(); });
  }

  /* ---------------- 3 · hold to buy ---------------- */
  function startCharge(){
    const p = chosen;
    if (!p || wallet < p.price || charge) return;
    if (coast){ coast.stop(); coast = null; }
    if (p.face !== 'front' || (p.yaw || 0) % 360) turnTo(p, Math.round((p.yaw || 0) / 360) * 360, 160).then(() => { p.yaw = 0; });
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
      // the foil flickers faster as it's about to go
      p.shine = ((now / (420 - 300 * q)) % 1) * 250 - 40; p.shineA = .3 + .7 * q; p.draw();
      if (Math.random() < dt * (2 + 10 * q)) Foil.crackle(.25 + .4 * q);
      charge.motor.set(.15 + q * .85);
      const shown = Math.ceil(p.price * (1 - q) / 5) * 5;
      if (shown !== charge.shown){
        // a ratchet you can feel: a click and a tick every twelfth of the price
        if (Math.floor(shown / (p.price / 12)) !== Math.floor(charge.shown / (p.price / 12))){ S.counterTick(true); Haptic.tick(6, 30); }
        charge.shown = shown;
        p.tagEl.querySelector('b').textContent = money(shown);
        bank(wallet - (p.price - shown));
        keySub(money(shown) + ' TO GO');
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
    p.shineA = 0; p.draw();
    glide(p.body, focus(), 260, { easing:ease.back });
    status(p.series.toUpperCase() + ' EDITION', 'HOLD TO BUY · DRAG TO TURN IT');
    key('HOLD TO BUY', money(p.price) + ' · ' + p.series.toUpperCase() + ' EDITION');
  }
  async function commit(){
    const p = chosen, c = charge; charge = null; stopTick?.();
    c.motor.stop();
    lock = true; phase = 'bought'; packNo++;
    wallet -= p.price; cfg?.setWallet(wallet); bank(); S.counterLock(true);
    hasLegend = tune.contents === 'legendary' || tune.contents === 'double' || (tune.contents === 'surprise' && Math.random() < 1 / 3);
    p.shineA = 0; p.yaw = 0; p.draw();
    contents = EventCards.pack(p.series, { legend:hasLegend, double:tune.contents === 'double', event:tune.event }); revealed = 0;
    p.tagEl.querySelector('b').textContent = 'SOLD';
    tearOffTag(p);
    status("IT'S YOURS", p.series.toUpperCase() + ' EDITION'); figure('04', 'INSIDE'); key('…', '', false);
    // the others go back to the house
    packets.filter(q => q !== p).forEach(q => CAREER ? restock(q) : glide(q.body, { y:-H * .3, alpha:0, r:q.body.r * 2 }, 300, { easing:ease.in }).then(() => q.body.remove()));
    packets = [p];
    // embedded: the shop puts itself away, and the felt in front of you clears
    cfg?.onBought?.(p);
    // POP: squash, launch, one stepped turn in the air, land with weight
    // (where it lands may have moved: embedded, it comes down centre felt)
    const x0 = EMBED ? p.body.x : focus().x, y0 = EMBED ? p.body.y : focus().y, s0 = p.body.s;
    await tween(90, e => p.body.set({ sx:1 + .14 * e, sy:1 - .16 * e, z:mix(24, 2, e), x:x0, y:y0, r:0 }));
    Foil.crinkle(); Haptic.tick(20);
    const f = focus();
    await tween(560, (e, t) => {
      const lift = Math.sin(t * Math.PI) * Math.min(130, H * .2);
      const stretch = t < .25 ? 1 - t * 4 : 0;
      p.body.set({ x:mix(x0, f.x, e), y:mix(y0, f.y, e), s:EMBED ? mix(s0, f.s, e) : s0, z:2 + lift, sy:1 + .12 * stretch, sx:1, r:Math.sin(t * Math.PI * 2) * 4 });
      if (!PO.reduced) setYaw(p, t * 360);
    }, ease.lin);
    setYaw(p, 0); p.yaw = 0; p.shineA = 0; p.draw();
    p.body.set({ z:0, r:0, shx:1 });
    S.deckSettle(); S.cardLanded(); jolt(stage.el, 2); Haptic.tick(18); puff(stage, f.x, f.y + AH * f.s / 2, AW * f.s, { n:10 });
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
      // each crackle a little higher than the last; flecks of foil fly off the tear
      if (!p.crackAt || now - p.crackAt > 22){ p.crackAt = now; Foil.crackle(.7 + Math.random() * .5, p.tear); Haptic.tick(5, 55); }
      if (!PO.reduced && after % 3 === 0){
        const b = p.body, fx = p.front_x, pal = p.art.pal;
        burst(stage, b.x + (fx - AW / 2) * b.s, b.y - b.z + (POPacket.TY - AH / 2) * b.s, { n:2, colours:[pal['foil-light'], pal['foil-base'], pal.ink], vx:p.dir > 0 ? [10, 110] : [-110, -10], vy:[-150, -50], g:520, life:.5, size:2, spread:3 });
      }
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
    Foil.rip(); Haptic.tick(24);
    flap = p.detachFlap();
    p.open = true; p.tear = 1; p.draw();
    const f = focus(), side = p.dir;
    // the strip flies off the way you tore it and lands on the felt
    // (embedded, on a table that keeps them: somewhere a little different each time)
    const jx = EMBED ? (Math.random() - .5) * W * .3 : 0, jy = EMBED ? (Math.random() - .5) * H * .16 : 0;
    glide(flap, { x:(side > 0 ? W * .74 : W * .26) + jx, y:H * L.flapY + jy, r:side * 168 + (EMBED ? (Math.random() - .5) * 140 : 0), z:0, s:L.tableS || Math.min(1.25, focusS() * .6) }, 560, { arc:70, easing:ease.out })
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
    if (Math.floor(pull / 4) !== before){ Foil.scrape(); Haptic.tick(4, 50); if (pull > 6) S.cardDeal(); }
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
    // embedded: the chips come out with the cards, in a bag, and drop to the felt
    if (EMBED) cfg.bag?.({ x:p.body.x, y:p.body.y - AH * p.body.s * .42, series:p.series });
    const ws = wrapperSpot();
    if (EMBED) Object.assign(ws, { x:ws.x + Math.random() * W * .3, y:ws.y + (Math.random() - .5) * H * .14, r:(Math.random() - .5) * 120 });
    const wrapper = glide(p.body, ws, 480, { arc:10 }).then(async () => {
      Foil.crinkle();
      await tween(260, e => { p.slump = e; p.draw(); });
      if (!EMBED){ p.chips = true; p.draw(); S.chipBounce(.55); }
    });
    S.cardDeal();
    await glide(deck, d, 360, { arc:14 });
    S.cardLanded(); Haptic.tick(14); puff(stage, d.x, d.y + CARD_H * d.s / 2, CARD_W * d.s, { n:8 }); squash(deck, .07);
    for (let i = 0; i < cards.length; i++){
      const k = cards.length - 1 - i, c = cards[i];
      c.style.transform = `translate(0px,${k}px)`;
      if (i % 2) S.cardLanded();
      await wait(45);
    }
    S.deckSettle();
    await wrapper;
    if (EMBED) return handOver();
    startTicks();
    enterDeck();
  }
  // embedded: the host's deck, tapped: the reveal runs on it, from where
  // it lies; the touch that started it is passed on (down)
  function session({ deck:d, cards }){
    if (phase !== 'idle' || !cards.length) return false;
    measure();
    const a = d.stage.el.getBoundingClientRect(), b = stage.el.getBoundingClientRect();
    d.set({ x:d.x + a.left - b.left, y:d.y + a.top - b.top });
    stage.objects.append(d.el); if (d.sh) stage.shadows.append(d.sh);
    d.stage = stage;
    deck = d; contents = cards.slice(); revealed = 0; fan = []; rc = null;
    lock = false; phase = 'deck';
    enterDeck();
    return true;
  }
  // the deck goes back to the host with whatever's left in it
  function endSession(){
    const left = { deck, cards:contents.slice(revealed) };
    deck = rc = null; contents = []; revealed = 0; fan = [];
    pointer = null;
    lock = false; phase = 'idle';
    cfg.deckBack(left);
  }
  // embedded: the cards are out, face down; the host takes them, the
  // wrapper and the strip, and the opening waits for the next packet
  function handOver(){
    const left = { cards:contents.slice(), deck, wrapper:chosen, flap };
    deck = rc = flap = chosen = null; packets = []; fan = []; contents = []; revealed = 0;
    lock = false; phase = 'idle';
    cfg.handOver(left);
  }

  /* ---------------- 6 · the reveal ----------------
     Tap or flick the deck: the top card flies up and squash-flips.
     Hold the deck: the card comes up face down and you peel its corner
     back to see the index (C, UC, R, L) before you commit. Rare and
     better give themselves away a moment early: a glint runs round the
     back's trim as the card leaves the deck. Each tier lands harder. */
  const Cards = () => window.PokerCollectibleLab;
  const EVENT = {
    table:{ a:'#8fd4a2', b:'#f3d27a', name:'TABLE' }, freezeout:{ a:'#a8e4f0', b:'#eaf8ff', name:'FREEZEOUT' },
    bomb:{ a:'#ff9a3c', b:'#ffd36b', name:'BOMB' }, wild:{ a:'#d38cff', b:'#7ff0e0', name:'WILD' }
  };
  const PEEK = 36, TURN_OVER = 50; // fold depth (card px) to read the index, and to throw it over
  let contents = [], revealed = 0, rc = null, fan = [];
  const revealSpot = () => ({ x:W / 2, y:H * .38, s:focusS(), r:0, z:6, sx:1, sy:1, alpha:1 });
  // turned cards stand in the brass card-holder lip, fanned like a hand
  const railSpot = i => { const s = L.tableS || Math.min(.66, focusS() * .33), k = i - 1.5; return { x:W / 2 + k * CARD_W * s * .8, y:H - CARD_H * s / 2 + 18 - L.railLift + Math.abs(k) * 3, s, r:k * 7, z:0, sx:1, sy:1 }; };
  // when the pack is done the fan lifts out of the lip into a held hand
  const handSpot = (i, n = fan.length) => { const s = L.tableS || Math.min(.86, focusS() * .42), k = i - (n - 1) / 2; return { x:W / 2 + k * CARD_W * s * .82, y:H * L.handY + k * k * 3, s, r:k * 8, z:0, sx:1, sy:1 }; };

  function enterDeck(){
    lock = false;
    if (revealed >= contents.length){ if (EMBED) return endSession(); enterHaul(); return; }
    phase = 'deck';
    status(revealed ? 'NEXT CARD' : 'FOUR CARDS, FACE DOWN', 'TAP TO TURN · HOLD TO SQUEEZE');
    figure(String(contents.length - revealed).padStart(2, '0'), 'TO REVEAL');
    key('TURN ONE OVER', 'OR HOLD THE DECK TO SQUEEZE');
    idleAt = performance.now();
  }

  // the top card leaves the deck exactly where it lay
  function takeTop(){
    const card = CardInspect.make(stage, contents[revealed]);
    deck.el.lastElementChild?.remove();
    card.body.set({ x:deck.x, y:deck.y - deck.z, z:deck.z, s:deck.s, r:deck.r });
    if (!deck.el.children.length){ const d = deck; deck = null; d.remove(); }
    tell(card);
    return card;
  }
  // rare and better: a glint runs round the back's trim on the way up
  function tell(card){
    if (card.spec.tier < 2) return;
    card.el.classList.add('is-tell');
    setTimeout(() => Foil.note(card.spec.tier === 3 ? 16 : 14, .35), 120);
    if (card.spec.tier === 3) setTimeout(() => Foil.note(18, .3), 360);
  }
  async function revealNext(how){
    if (phase !== 'deck' || !deck) return;
    lock = true; phase = 'lifting';
    if (revealed === contents.length - 1) await lastCard();
    rc = takeTop();
    S.cardDeal(); Foil.flutter(); Haptic.tick(6);
    const to = revealSpot();
    await glide(rc.body, { ...to, z:24 }, how === 'flick' ? 200 : 300, { arc:34, spin:how === 'flick' ? -10 : 4 });
    await flip(rc);
  }

  // the last card: the deck beats once, lub-dub, before it lets go
  async function lastCard(){
    status('LAST ONE…', ''); figure('01', 'TO REVEAL');
    const d = deck, x0 = d.x;
    for (const k of [1, .7]){
      Foil.thud(.6 * k); Haptic.tick(14);
      await tween(110, (e, t) => d.set({ z:Math.sin(t * Math.PI) * 4 * k, sx:1 + Math.sin(t * Math.PI) * .04 * k, sy:1 - Math.sin(t * Math.PI) * .03 * k }), ease.lin);
      await wait(70);
    }
    d.set({ x:x0, z:0, sx:1, sy:1 });
    await wait(160);
  }
  // the CRT counts the card's top prize up like a payout meter
  let prizeRun = 0;
  async function countPrize(sp){
    const id = ++prizeRun, steps = 5 + sp.tier * 3, to = sp.prize, unit = to >= 1000 ? 50 : 10;
    for (let i = 1; i <= steps; i++){
      if (id !== prizeRun) return;
      figure(money(i === steps ? to : Math.round(to * i / steps / unit) * unit), 'TOP PRIZE');
      if (i < steps) S.counterTick(true); else S.counterLock(true);
      await new Promise(r => setTimeout(r, PO.reduced ? 0 : (34 + i * 7) / PO.speed));
    }
  }

  async function flip(card){
    const sp = card.spec, L = sp.tier === 3;
    lock = true; phase = 'flipping';
    if (card.fold) await tween(90, e => setFold(card, card.fold * (1 - e)), ease.in);
    card.el.querySelector('.ec-flap').hidden = true;
    if (L) await dip(true);
    S.cardFlip(sp.tier >= 2); Foil.flutter();
    if (card.body.z < 14) glide(card.body, { z:24 }, 140, { easing:ease.out });
    await tween(L ? 170 : 110, e => setTurn(card, 1 - e), ease.in);
    card.el.dataset.side = 'face'; Haptic.tick(8);
    // a Legendary hangs on its edge for a beat, the edge burning
    if (L){ card.el.classList.add('is-hot'); Foil.note(12, .5); S.wheelCatch(); await wait(PO.reduced ? 0 : 280); card.el.classList.remove('is-hot'); }
    await tween(L ? 100 : 140, e => setTurn(card, e), ease.out);
    setTurn(card, 1);
    Foil.note(revealed * 2 + (sp.tier >= 2 ? 3 : 0), .9);
    card.shown = true;
    await moment(card);
    revealed++;
    lock = false; phase = 'shown';
    const last = revealed >= contents.length;
    key(last ? (EMBED ? 'PUT IT DOWN' : 'INTO YOUR HAND') : 'NEXT CARD', last ? 'THE LAST ONE' : 'OR TAP THE DECK');
    idleAt = performance.now();
  }

  async function moment(card){
    const sp = card.spec, b = card.body, to = revealSpot(), name = Cards().rarities[sp.rarity].name.toUpperCase();
    const face = card.el.querySelector('.ccl-object');
    const cx = () => b.x, cy = () => b.y - b.z, cw = () => CARD_W * b.s, ch = () => CARD_H * b.s;
    if (sp.tier === 3) return legendary(card);
    await glide(b, to, 150, { easing:ease.in });
    S.cardLanded(); Haptic.tick(10 + sp.tier * 4); countPrize(sp);
    puff(stage, to.x, to.y + ch() / 2, cw(), { n:6 + sp.tier * 3 });
    squash(b, .06 + sp.tier * .03);
    if (sp.tier >= 1){ face.classList.add('is-inspected', 'is-finishing'); }
    if (sp.tier === 1){
      S.arcadeReward('strong');
      burst(stage, cx(), cy(), { n:10, colours:['#a0d9b9', '#F3E6C4'], vx:[-90, 90], vy:[-150, -40], g:240, life:.55, size:2, w:cw(), h:ch() * .7 });
    }
    if (sp.tier === 2){
      // the rare hops off the felt, haloed, with a shower of blue sparks
      card.el.classList.add('is-aura');
      await glide(b, { z:to.z + 36 }, 170, { easing:ease.out });
      S.arcadeReward('elite'); lamps();
      burst(stage, cx(), cy(), { n:20, colours:['#8bb5d1', '#dfe9db', '#3565a2'], vx:[-200, 200], vy:[-240, -40], g:420, life:.8, size:3, w:cw(), h:ch() });
      await glide(b, to, 190, { easing:ease.in });
      S.cardLanded(); Foil.thud(.6); jolt(stage.el, 2); squash(b, .1); Haptic.tick(18);
      puff(stage, to.x, to.y + ch() / 2, cw(), { n:10 });
      status('RARE!', sp.title + ' · ' + sp.edition);
      return;
    }
    status(sp.title, name + ' · ' + sp.edition);
  }

  /* ---------------- the Legendary ---------------- */
  async function legendary(card){
    const sp = card.spec, b = card.body, to = revealSpot(), col = EVENT[sp.kind];
    const face = card.el.querySelector('.ccl-object');
    // SLAM: it comes down hard and oversized
    await tween(120, e => b.set({ s:mix(to.s * 1.3, to.s, e), z:mix(46, to.z, e), x:to.x, y:to.y, r:0 }), ease.in);
    flash(); S.koThunk(1.8); jolt(root, 4); Haptic.tick(30, 0); setTimeout(() => Haptic.tick(20, 0), 110);
    countPrize(sp);
    squash(b, .16, 320);
    rays(card, col);
    puff(stage, to.x, to.y + CARD_H * to.s / 2, CARD_W * to.s, { n:14 });
    burst(stage, to.x, to.y - to.z, { n:26, colours:[col.a, col.b, '#fff4cc'], vx:[-240, 240], vy:[-280, -60], g:440, life:.9, size:3, w:CARD_W * to.s * .8, h:CARD_H * to.s * .5 });
    // everything else on the felt jumps
    [chosen?.body, flap, deck, ...fan.map(c => c.body)].filter(Boolean).forEach((o, i) => {
      glide(o, { z:8 + (i % 3) * 4 }, 90).then(() => glide(o, { z:0 }, 170, { easing:ease.in })).then(() => squash(o, .08));
    });
    S.chipBounce(.9);
    S.arcadeReward('jackpot');
    face.classList.add('is-inspected', 'is-finishing');
    status('LEGENDARY!', col.name + ' · ' + sp.edition);
    await wait(240);
    crtFlash();
    flourish(card, col);
    await dip(false, sp.kind === 'table');
    bob(card);
  }
  function dip(on, keepSpot){
    const d = stage.objects.querySelector('.po-dip') || Object.assign(document.createElement('i'), { className:'po-dip' });
    if (!d.parentNode) stage.objects.append(d);
    root.classList.toggle('is-dipped', on);
    if (on){ S.showdownBegin(); status('…', ''); }
    const from = +d.style.opacity || 0, to = on ? .62 : keepSpot ? .25 : 0;
    return tween(on ? 300 : 360, e => { d.style.opacity = snap(mix(from, to, e), .1).toFixed(2); });
  }
  function flash(){
    if (PO.reduced) return;
    const f = document.createElement('i');
    f.className = 'po-flash'; stage.fx.append(f);
    tween(200, (e, t) => { f.style.opacity = t < .3 ? '.9' : t < .6 ? '.45' : '0'; }, ease.lin).then(() => f.remove());
  }
  function rays(card, col){
    const r = document.createElement('i'), b = card.body;
    r.className = 'po-rays';
    r.style.setProperty('--ray', col.a); r.style.setProperty('--ray2', col.b);
    r.style.left = Math.round(b.x) + 'px'; r.style.top = Math.round(b.y - 6) + 'px';
    r.style.width = r.style.height = Math.round(CARD_H * b.s * 2.1) + 'px';
    stage.objects.append(r);
    card.extras.push(r);
  }
  // the machine announces it: the CRT flashes in steps and the relay clunks
  function crtFlash(){
    if (ui) return ui.flash();
    const c = root.querySelector('.po-status');
    c.classList.remove('is-legend'); void c.offsetWidth; c.classList.add('is-legend');
    S.stageLock(); Foil.thud(.8);
    setTimeout(() => c.classList.remove('is-legend'), 1400);
  }
  // the per-event flourish
  function flourish(card, col){
    const b = card.body, k = card.spec.kind, face = card.el.querySelector('.ccl-object');
    const corner = () => [b.x + CARD_W * b.s * .44, b.y - b.z - CARD_H * b.s * .46];
    if (k === 'bomb'){
      card.el.classList.add('fx-bomb'); S.koSocketSpark();
      let t = 0, acc = 0;
      card.stops.push(every(dt => {
        t += dt; acc += dt;
        if (acc > (t < 2 ? .14 : .5)){ acc = 0; const [x, y] = corner(); burst(stage, x, y, { n:t < 2 ? 4 : 2, colours:['#ff9a3c', '#ffd36b', '#e45c31'], vx:[-40, 60], vy:[-140, -60], g:90, life:.7, size:2, spread:4 }); if (t < 2 && Math.random() < .5) Foil.crackle(.4); }
      }));
    }
    if (k === 'wild'){
      face.classList.add('po-misreg');
      Foil.chord([392, 415, 523, 554, 784], .8);
      [0, 120, 260].forEach(ms => setTimeout(() => jolt(card.el, 1), ms));
    }
    if (k === 'freezeout'){
      card.el.classList.add('fx-frost');
      for (let i = 0; i < 8; i++) setTimeout(() => Foil.crackle(.6), i * 70);
      Foil.chord([1568, 2093, 2637], .5);
      burst(stage, b.x, b.y - b.z, { n:14, colours:['#eaf8ff', '#a8e4f0'], vx:[-60, 60], vy:[-30, 30], g:0, life:.9, size:2, w:CARD_W * b.s, h:CARD_H * b.s });
    }
    if (k === 'table'){
      const spot = document.createElement('i');
      spot.className = 'po-spot';
      spot.style.setProperty('--x', Math.round(b.x) + 'px'); spot.style.setProperty('--y', Math.round(b.y) + 'px');
      spot.style.setProperty('--r', Math.round(CARD_H * b.s * .66) + 'px');
      stage.objects.append(spot); card.extras.push(spot);
      requestAnimationFrame(() => spot.classList.add('is-on'));
      for (let i = 0; i < 4; i++) setTimeout(() => {
        burst(stage, W * (.15 + .23 * i), -10, { n:7, colours:['#c8322b', '#1f5fa8', '#efe6c8', '#2f7a43'], vx:[-40, 40], vy:[20, 90], g:620, life:1.3, size:4, spread:30 });
        S.chipBounce(.5 + i * .1);
      }, i * 110);
    }
  }
  // it floats a little above the felt until you take it
  function bob(card){
    if (PO.reduced) return;
    let t = 0;
    const z0 = card.body.z;
    card.stops.push(every(dt => { t += dt; card.body.set({ z:z0 + 3 + Math.round(Math.sin(t * 2.4) * 3) }); }));
  }
  function lamps(){
    root.classList.remove('is-lamps'); void root.offsetWidth; root.classList.add('is-lamps');
    setTimeout(() => root.classList.remove('is-lamps'), 1000);
  }
  function clearShown(){
    for (const c of [rc, ...fan].filter(Boolean)){ c.stops.forEach(f => f()); c.stops = []; c.extras.forEach(x => x.remove()); c.extras = []; }
    stage.objects.querySelector('.po-dip')?.remove();
    root.classList.remove('is-dipped');
  }

  /* The card you just turned goes down into a little fan by the rail. */
  function stow(){
    const card = rc;
    if (!card || !card.shown) return;
    rc = null;
    if (card.yaw) faceUp(card);
    card.stops.forEach(f => f()); card.stops = [];
    card.extras.forEach(x => x.remove()); card.extras = [];
    stage.objects.querySelector('.po-dip')?.remove();
    card.el.classList.remove('is-aura');
    // embedded: the host puts it down on its table
    if (EMBED){ root.classList.remove('is-dipped'); cfg.place(card); return; }
    const i = fan.length; fan.push(card);
    card.el.style.zIndex = 20 + i;
    S.cardReturn();
    glide(card.body, railSpot(i), 280, { arc:16 }).then(() => { S.cardLanded(); squash(card.body, .06, 160); });
  }

  /* ---------------- the squeeze ---------------- */
  async function startSqueeze(){
    if (phase !== 'deck' || !deck) return;
    lock = true; phase = 'lifting';
    if (revealed === contents.length - 1) await lastCard();
    rc = takeTop();
    S.cardDeal(); Haptic.tick(6);
    await glide(rc.body, { ...revealSpot(), z:10 }, 240, { arc:14 });
    rc.el.querySelector('.ec-flap').hidden = false;
    lock = false; phase = 'squeeze';
    status('SQUEEZE IT', 'DRAG TO PEEL THE CORNER BACK');
  }
  /* Fold the back's top-right corner over along a diagonal crease: the
     back loses that triangle and the face's top-left corner (where the
     index sits) shows on the flap, turned as real card would be. */
  function setFold(card, d){
    d = clamp(Math.round(d), 0, 64);
    if (d === card.fold) return;
    const was = card.fold, c = CARD_W - d;
    card.fold = d;
    card.el.querySelector('.ec-back').style.clipPath = d ? `polygon(0 0,${c}px 0,${CARD_W}px ${d}px,${CARD_W}px ${CARD_H}px,0 ${CARD_H}px)` : '';
    const f = card.el.querySelector('.ec-flap-in');
    f.style.transform = `matrix(0,-1,1,0,${c},${CARD_W - c})`;
    f.style.clipPath = `polygon(0 0,${d}px 0,0 ${d}px)`;
    if (Math.floor(d / 5) !== Math.floor(was / 5)){ Foil.scrape(); Haptic.tick(3, 40); }
    if (was < PEEK && d >= PEEK){ S.counterTick(true); Haptic.tick(12, 0); card.peeked = true; }
  }
  function endSqueeze(cancel){
    const card = rc;
    if (!card || phase !== 'squeeze') return;
    if (!cancel && card.fold >= TURN_OVER){ flip(card); return; }
    phase = 'peek';
    const from = card.fold;
    S.cardReturn();
    tween(200, e => setFold(card, from * (1 - e)), ease.back).then(() => { if (phase === 'peek') card.el.querySelector('.ec-flap').hidden = true; });
    status(card.peeked ? 'YOU SAW IT' : 'STILL FACE DOWN', 'TAP TO TURN IT OVER');
    key('TURN IT OVER', 'OR SQUEEZE AGAIN');
  }

  /* ---------------- 7 · the haul ----------------
     The fan lifts out of the lip into a held hand (NEW on cards you
     haven't had before). Tap a card to pick it up and play with it.
     The empty wrapper rattles: flick it off the felt and the chips spill
     out of it. KEEP squares the hand, posts it into the collection slot,
     the chips go home to the bank, and the house deals again. */
  const BONUS = { house:40, club:75, reserve:150 }; // the "+1": a few chips in every packet
  const seen = new Set();
  let chips = [], spilling = null, collection = 0;
  const held = [], found = new Map(); // the cards in your case (playable), and every design you've pulled

  async function enterHaul(){
    lock = true; phase = 'lifting';
    S.cardDeal(); Foil.rustle(.6);
    await Promise.all(fan.map(async (c, i) => {
      await wait(i * 50);
      c.el.style.zIndex = 20 + i;
      await glide(c.body, handSpot(i), 300, { arc:22 });
      const k = c.spec.kind + ':' + c.spec.rarity;
      if (!seen.has(k)){ seen.add(k); newPip(c); }
    }));
    S.cardLanded(); Haptic.tick(10);
    // the machine reads your four cards as a poker hand
    const h = handName();
    status(h.name, h.sub);
    await wait(120);
    let step = 0;
    for (const c of fan){
      if (!h.kinds.includes(c.spec.kind)) continue;
      Foil.note(5 + step++ * 2, .8); Haptic.tick(8);
      glide(c.body, { z:16 }, 90, { easing:ease.out }).then(() => glide(c.body, { z:0 }, 140, { easing:ease.in })).then(() => squash(c.body, .06, 140));
      await wait(110);
    }
    S.arcadeReward(h.tier);
    if (h.tier !== 'strong') lamps();
    // embedded: a beat to read it, then the hand is laid down on the host's table
    lock = false; phase = 'haul';
    figure(String(fan.length).padStart(2, '0'), 'IN HAND');
    key('KEEP', chosen ? 'FLICK THE WRAPPER · TAP A CARD' : 'TAP A CARD TO LOOK');
    idleAt = performance.now();
  }
  const PLURAL = { table:'TABLES', freezeout:'FREEZEOUTS', bomb:'BOMBS', wild:'WILDS' };
  function handName(){
    const n = {};
    fan.forEach(c => { n[c.spec.kind] = (n[c.spec.kind] || 0) + 1; });
    const ks = Object.keys(n).sort((a, b) => n[b] - n[a]), [a, b] = ks;
    if (n[a] >= 4) return { name:'FOUR OF A KIND', sub:'FOUR ' + PLURAL[a], tier:'jackpot', kinds:[a] };
    if (n[a] === 3) return { name:'THREE ' + PLURAL[a], sub:'TRIPS', tier:'elite', kinds:[a] };
    if (n[a] === 2 && n[b] === 2) return { name:'TWO PAIR', sub:PLURAL[a] + ' AND ' + PLURAL[b], tier:'elite', kinds:[a, b] };
    if (n[a] === 2) return { name:'PAIR OF ' + PLURAL[a], sub:'YOUR HAND', tier:'strong', kinds:[a] };
    return { name:'A RAINBOW', sub:'ONE OF EACH', tier:'strong', kinds:ks };
  }
  function newPip(c){
    const n = document.createElement('i');
    n.className = 'po-new'; n.textContent = 'NEW';
    c.el.append(n);
    Foil.note(10 + fan.indexOf(c) * 2, .4);
  }

  /* Tap a card in your hand: the shared inspect screen lifts it out,
     and you can swipe through the rest of the hand from there. */
  async function inspect(card){
    if (phase !== 'haul') return;
    phase = 'inspect';
    card.el.querySelector('.ec-new')?.remove();
    glide(card.body, { z:0 }, 60);
    await CardInspect.open({
      items:fan.map(c => ({ card:c.card, source:() => c.el })),
      index:fan.indexOf(card),
      onClose:() => {
        phase = 'haul';
        figure(String(fan.length).padStart(2, '0'), 'IN HAND');
        status('YOUR HAND', chosen ? 'FLICK THE WRAPPER OFF THE FELT' : 'KEEP THEM');
        key('KEEP', chosen ? 'FLICK THE WRAPPER · TAP A CARD' : 'TAP A CARD TO LOOK');
      }
    });
  }
  /* During the opening: tap the card you just turned to look at it (and
     flick back through the ones already turned). BACK and the opening
     carries on where it was. */
  async function inspectShown(){
    if (phase !== 'shown' || !rc) return;
    phase = 'inspect';
    const run = [...fan, rc];
    await CardInspect.open({
      items:run.map(c => ({ card:c.card, source:() => c.el })),
      index:run.length - 1,
      onClose:() => { phase = 'shown'; idleAt = performance.now(); }
    });
  }

  /* ---- the wrapper: it rattles; flick it away and the chips fall out ---- */
  function rattle(power = .5){
    const p = chosen;
    if (!p || p.tossed) return;
    S.chipBounce(.2 + power * .3); Foil.crinkle();
    tween(220, (e, t) => p.body.set({ r:wrapperSpot().r + Math.sin(t * Math.PI * 4) * 4 * power * (1 - t) }), ease.lin);
  }
  async function tossWrapper(vx, vy){
    const p = chosen;
    if (!p || p.tossed) return;
    p.tossed = true;
    // the key throws it up and off to the left
    if (Math.hypot(vx, vy) < .4){ vx = -1.1; vy = -.5; }
    const b = p.body, x0 = b.x, y0 = b.y, z0 = b.z, r0 = b.r, spinDir = vx < 0 ? -1 : 1;
    Foil.crinkle(); Foil.flutter(); S.cardReturn();
    spilling = spill(p); Haptic.tick(16);
    await tween(560, (e, t) => {
      b.set({ x:x0 + vx * 600 * t, y:y0 + vy * 600 * t + 520 * t * t, z:z0 + Math.sin(Math.min(1, t * 1.4) * Math.PI) * 50, r:r0 + snap(spinDir * 600 * t, 30), alpha:t > .7 ? 1 - (t - .7) / .3 : 1 });
      p.slump = 1 + Math.sin(t * 12) * .4; p.draw();
    }, ease.lin);
    b.remove(); packets = packets.filter(q => q !== p);
    chosen = null;
    if (phase === 'haul') key('KEEP', 'TAP A CARD TO LOOK');
  }
  // the torn strip, flicked away: it tumbles off the felt with a flutter
  function tossFlap(vx, vy){
    const f = flap;
    if (!f) return;
    flap = null;
    Foil.flutter(); Haptic.tick(8);
    const x0 = f.x, y0 = f.y, r0 = f.r;
    tween(500, (e, t) => f.set({ x:x0 + vx * 520 * t, y:y0 + vy * 520 * t + 420 * t * t, z:8 + Math.sin(t * Math.PI) * 30, r:r0 + snap(Math.sign(vx || 1) * 720 * t, 30), alpha:t > .7 ? 1 - (t - .7) / .3 : 1 }), ease.lin).then(() => f.remove());
  }
  // real table chips, out of the wrapper's mouth, bouncing off the cabinet
  function spill(p){
    p.chips = false; p.draw();
    const st = stage.el.getBoundingClientRect(), b = p.body;
    const value = BONUS[p.series] || 40;
    try {
      CoinWorld.setHost(stage.el, [1, 3]); CoinWorld.setExtraBlocks([]); CoinWorld.buildWalls();
      const tiers = CoinWorld.composeTiers(value, 9), cols = [];
      tiers.counts.forEach((n, k) => { for (let i = 0; i < n; i++) cols.push('t' + k); });
      const mouthY = st.top + b.y - b.z - AH * b.s * .4;
      chips = cols.map((col, i) => {
        const c = CoinWorld.body(CoinWorld.makeChip(col), st.left + b.x, mouthY, 30 + i * 3, 22);
        c.fresh = true;
        return c;
      });
      chips.value = value;
      return Promise.all(chips.map((c, i) => CoinWorld.launch(c, { x:st.left + W * (.28 + (i % 4) * .11) + (Math.random() - .5) * 30, y:st.top + H * (.54 + Math.floor(i / 4) * .07) + (Math.random() - .5) * 22, d:22 },
        { T:PO.reduced ? .01 : .34 + i * .02, wait:PO.reduced ? 0 : 40 + i * 50, flips:PO.reduced ? 0 : 2 + (i % 3), i })));
    } catch (e) { chips = []; chips.value = value; return Promise.resolve(); }
  }
  // chips home: they fly into the bank and the reel counts them in
  async function chipsHome(){
    await spilling;
    const value = chips.value || 0;
    if (chips.length){
      const r = bankEl().getBoundingClientRect();
      await Promise.all(chips.map((c, i) => CoinWorld.launch(c, { x:r.left + r.width / 2, y:r.top + r.height / 2, d:14, vanish:true }, { wait:PO.reduced ? 0 : i * 40, T:PO.reduced ? .01 : .34, flips:PO.reduced ? 0 : 1, i })));
    }
    chips = []; spilling = null;
    if (!value) return;
    const from = wallet; wallet += value; cfg?.setWallet(wallet);
    status('COUNT IN', '+' + money(value));
    const steps = 8;
    for (let i = 1; i <= steps; i++){ bank(from + value * i / steps); S.counterTick(true); await wait(55); }
    S.counterLock(true);
  }

  /* ---- KEEP ---- */
  async function keep(){
    if (phase !== 'haul') return;
    lock = true; phase = 'keeping';
    nudge(false);
    fan.forEach(c => c.el.querySelector('.po-new')?.remove());
    if (chosen && !chosen.tossed){ await tossWrapper(0, 0); }
    status('KEEPING THEM', String(fan.length) + ' INTO THE COLLECTION');
    // square the hand: two taps, like the dealer's deck
    const sq = { x:W / 2, y:H * L.squareY, s:handSpot(0).s, z:0, sx:1, sy:1 };
    S.cardReturn();
    await Promise.all(fan.map((c, i) => glide(c.body, { ...sq, r:i % 2 ? 2 : -2, y:sq.y - i }, 220)));
    S.cardLanded(); Haptic.tick(10, 0); fan.forEach(c => squash(c.body, .05, 140));
    await wait(120);
    fan.forEach(c => c.body.set({ r:0 }));
    S.deckSettle(); jolt(stage.el, 1); Haptic.tick(14, 0);
    await wait(120);
    // into the slot: up to it, then down behind its lip
    const slot = $('po-slot'), sr = slot.getBoundingClientRect(), st = stage.el.getBoundingClientRect();
    const sx = sr.left - st.left + sr.width / 2, sy = sr.top - st.top + sr.height / 2;
    S.cardDeal();
    await Promise.all(fan.map(c => glide(c.body, { x:sx, y:sy - 34, s:.42, r:0 }, 300, { arc:30 })));
    await Promise.all(fan.map((c, i) => wait(i * 60).then(() => tween(140, e => c.body.set({ y:sy - 34 + e * 30, sy:1 - e * .6, alpha:1 - e }), ease.in)).then(() => {
      collection++; c.card.isNew = true; held.push(c.card); found.set(c.card.design, { ...c.card, roster:null });
      S.counterTick(true); jolt(slot, 2); Haptic.tick(8, 0);
      Foil.note(7 + i * 2, .6);
      slot.classList.remove('is-lit'); void slot.offsetWidth; slot.classList.add('is-lit');
      $('po-slot-n').textContent = String(collection).padStart(3, '0');
    })));
    S.stageLock();
    fan.forEach(c => c.body.remove()); fan = [];
    figure(String(collection).padStart(3, '0'), 'COLLECTED');
    await chipsHome();
    // sweep the torn strip away and deal again
    if (flap){ const f = flap; flap = null; await glide(f, { x:-W * .3, y:f.y + 20, r:f.r - 90, alpha:.3 }, 300, { easing:ease.in }); f.remove(); }
    try { CoinWorld.clearWorld(); } catch (e) {}
    deck = rc = null; packets = []; chosen = null;
    lock = false;
    dealIn();
  }

  /* ---------------- the faces of the machine ----------------
     packs: the packet shop (this table); album: every design you've
     pulled, with your history in it; hub: the Career desk
     (js/career-desk.js). Changing face rolls the felt over like the
     game's drum, a tooth at a time. */
  let view = 'packs', saved = null, rolling = false;
  const RCODE = { common:'C', uncommon:'UC', rare:'R', legendary:'L' };
  const KNAME = { table:'TABLE', freezeout:'FREEZEOUT', bomb:'BOMB', wild:'WILD' };
  async function door(to, { instant = false } = {}){
    if (to === view || rolling || lock || CardInspect.isOpen || pointer) return;
    if (view === 'packs') saved = { t:$('po-title').textContent, s:$('po-sub').textContent, f:$('po-fig').textContent, fl:$('po-fig-l').textContent, k:$('po-key-label').textContent, ks:$('po-key-sub').textContent, kd:$('po-key').disabled };
    rolling = true;
    const from = view, dir = to === 'hub' ? -1 : 1;
    if (!instant) await roll(dir, 'out');
    if (from === 'hub') CareerDesk.leave();
    view = to;
    $('po-album').hidden = to !== 'album'; $('po-hub').hidden = to !== 'hub';
    stage.el.classList.toggle('is-away', to !== 'packs');
    $('po-back').hidden = !CAREER || to === 'hub';
    $('po-brand-sub').textContent = to === 'hub' ? 'CAREER' : to === 'album' ? 'ALBUM' : CAREER ? 'SHOP' : 'THE PACK TABLE';
    $('po-hatches').hidden = !CAREER || to !== 'packs';
    root.querySelectorAll('[data-door]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.door === to)));
    if (to === 'album') renderAlbum();
    else if (to === 'hub') CareerDesk.enter();
    else if (CAREER && !packets.length && !deck) dealIn();
    else if (saved){ status(saved.t, saved.s); figure(saved.f, saved.fl); key(saved.k, saved.ks, !saved.kd); }
    if (!instant) await roll(dir, 'in');
    rolling = false;
  }
  // the felt rolls away a tooth at a time, the next face rolls in, overshoots and locks
  async function roll(dir, part){
    if (PO.reduced) return;
    const el = stage.el, h = H || el.clientHeight, teeth = 5;
    el.classList.add('is-rolling');
    if (part === 'out'){
      S.wheelRelease(); Haptic.tick(8);
      for (let t = 1; t <= teeth; t++){ el.style.setProperty('--roll', Math.round(dir * -h * t / teeth) + 'px'); S.wheelTooth(.8, false); Haptic.tick(3, 20); await wait(26); }
    } else {
      for (let t = teeth - 1; t >= 0; t--){ el.style.setProperty('--roll', Math.round(dir * h * t / teeth) + 'px'); S.wheelTooth(.6, t === 0); await wait(30); }
      el.style.setProperty('--roll', Math.round(dir * -10) + 'px'); S.wheelCatch(); await wait(50);
      el.style.setProperty('--roll', Math.round(dir * 3) + 'px'); await wait(40);
      el.style.setProperty('--roll', '0px'); S.wheelLock(); Haptic.tick(12, 0);
      el.classList.remove('is-rolling');
    }
  }
  function mini(card, cls = ''){
    return `<span class="po-mini-card ${cls}">${Cards().objectHTML(card.spec)}</span>`;
  }
  function scaleMinis(box){
    const cell = box.querySelector('.po-mini-card');
    if (cell) box.style.setProperty('--k', (cell.clientWidth / 164).toFixed(4));
  }
  /* The album: one slot per design, kinds down, rarities across. */
  function renderAlbum(){
    const grid = $('po-album-grid'), ds = EventCards.designs();
    grid.innerHTML = ds.map(d => {
      const f = found.get(d), r = d.split(':')[1], n = held.filter(c => c.design === d).length;
      return `<button class="po-mini${f ? '' : ' is-unfound'}" type="button" data-design="${d}">${f ? mini(f) : `<span class="po-mini-card po-mini-q"><b>?</b><small>${RCODE[r]}</small></span>`}${n ? `<i class="po-mini-n">×${n}</i>` : ''}</button>`;
    }).join('');
    scaleMinis(grid);
    status('THE ALBUM', found.size + ' OF ' + ds.length + ' DESIGNS FOUND'); figure(String(found.size).padStart(2, '0'), 'FOUND');
    key(CAREER ? 'BACK TO THE DESK' : 'BACK TO THE PACK TABLE', 'TAP A CARD TO LOOK');
  }
  // inspecting a design shows your history with it
  function albumInspect(btn){
    const ds = EventCards.designs(), buttons = [...$('po-album-grid').children];
    const items = ds.map((d, i) => {
      const [k, r] = d.split(':'), f = found.get(d), h = history.get(d), src = () => buttons[i].querySelector('.po-mini-card');
      if (!f) return { card:EventCards.make(k, r, 'back-room-five', { roster:false }), locked:true, source:src };
      const n = held.filter(c => c.design === d).length;
      const lines = [KNAME[k] + ' · ' + r.toUpperCase() + (n ? ' · ' + n + ' IN YOUR CASE' : '')];
      if (h){ lines.push('PLAYED ' + h.played + ' · BEST ' + ord(h.best)); if (h.won) lines.push({ t:'WON ' + money(h.won) + ' WITH IT', money:true }); }
      else lines.push('NOT PLAYED YET');
      return { card:f, source:src, lines };
    });
    CardInspect.open({ items, index:buttons.indexOf(btn) });
  }
  const ord = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'TH' : ({ 1:'ST', 2:'ND', 3:'RD' })[n % 10] || 'TH');

  /* ---------------- Career state (memory only, the lab's) ---------------- */
  const history = new Map(), venueHistory = new Map(), venues = new Set(['BACK ROOM']);
  function record(card, finish, prize){
    for (const [map, k] of [[history, card.design], [venueHistory, card.event.venue]]){
      const h = map.get(k) || { played:0, best:99, won:0 };
      h.played++; h.best = Math.min(h.best, finish); h.won += prize;
      map.set(k, h);
    }
  }
  // a career a little way in: the Back Room cleared, the Pub open, a few cards in the case
  function seed(){
    venues.add('PUB CIRCUIT');
    wallet = 3000;
    [['table', 'common', 'back-room-five'], ['freezeout', 'common', 'back-room-freezeout'], ['bomb', 'uncommon', 'pub-open'], ['wild', 'common', 'pub-freezeout'], ['table', 'rare', 'pub-turbo'], ['freezeout', 'uncommon', 'back-room-heads-up']]
      .forEach(([k, r, e]) => { const c = EventCards.make(k, r, e); held.push(c); found.set(c.design, { ...c, roster:null }); });
    held[4].isNew = true;
    record(held[0], 2, 150); record(held[0], 4, 0);
  }
  const CareerLab = {
    get root(){ return root; }, get view(){ return view; },
    get container(){ return $('po-hub'); },
    get wallet(){ return wallet; }, set wallet(v){ wallet = v; },
    held, found, venues,
    status, figure, bank, door, record,
    historyFor:venue => venueHistory.get(venue) || { played:0, best:0, won:0 },
    keys(on){ root.classList.toggle('is-desk', on); },
    keyPlay(label, enabled){ const b = $('po-play'); b.textContent = label; b.disabled = !enabled; b.className = 'btn-raise po-play-key'; b.id = 'po-play'; }
  };

  function fresh(){
    PO.reset(); charge?.motor.stop(); charge = null; coast = null;
    clearShown(); fan = []; rc = null; chips = []; spilling = null; root.classList.remove('is-dipped');
    if (CardInspect.isOpen) CardInspect.close();
    try { CoinWorld.clearWorld(); } catch (e) {}
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
      swingTags(dt * PO.speed);
      acc += dt;
      if (acc < 1 / 7) return;
      acc = 0;
      for (const p of packets){ if (p.seamHint || p.light || p.chips){ p.frame++; p.draw(); } }
      // now and then the light catches one of the packets
      if (!lock && !pointer && ['choose', 'selected', 'sealed'].includes(phase) && performance.now() - (lastSweep || 0) > 3600){
        lastSweep = performance.now();
        const live = packets.filter(p => !p.open && (phase === 'choose' || p === chosen));
        if (live.length) sweep(live[(sweepAt++) % live.length]);
      }
      // the empty wrapper rattles now and then: there's something in it
      if (!EMBED && phase === 'haul' && chosen && !chosen.tossed && !pointer && performance.now() - idleAt > 2400 && performance.now() - (lastRattle || 0) > 2600){ lastRattle = performance.now(); rattle(.5); }
      const p = chosen, idle = performance.now() - idleAt > 1600 && !pointer && !lock;
      if (p && idle && (phase === 'sealed' || phase === 'open')){
        const f = focus(), top = f.y - AH * f.s / 2;
        nudge(true, f.x + (phase === 'sealed' ? -AW * f.s * .35 : 0), top + (phase === 'sealed' ? 10 : -26));
        nudgeEl.dataset.dir = phase === 'sealed' ? 'right' : 'up';
      } else nudge(false);
    });
  }
  let stopTicks = null, lastSweep = 0, sweepAt = 0, lastRattle = 0;

  /* ---------------- input ---------------- */
  function local(p, px, py){
    const b = p.body, dx = px - b.x, dy = py - (b.y - b.z), a = -b.r * Math.PI / 180;
    return { x:(dx * Math.cos(a) - dy * Math.sin(a)) / (b.s * Math.max(.1, b.sx)) + AW / 2, y:(dx * Math.sin(a) + dy * Math.cos(a)) / (b.s * b.sy) + AH / 2 };
  }
  function at(e){ const r = stage.el.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
  function onDown(e){
    // the desk and the album handle their own touches
    if (view !== 'packs' || rolling) return;
    if (EMBED && phase === 'idle') return;
    if (pointer || e.button > 0) return;
    Foil.unlock(); S.unlock(); idleAt = performance.now(); nudge(false);
    if (lock){ PO.finishAll(); return; } // tap to fast-forward
    const pt = at(e), el = e.target.closest('.po-packet'), p = el && packets.find(q => q.el === el);
    const onDeck = !!(deck && e.target.closest('.po-deck'));
    pointer = { id:e.pointerId, x0:pt.x, y0:pt.y, x:pt.x, y:pt.y, t:performance.now(), mode:null, p, vx:0, vy:0, vyaw:0 };
    stage.el.setPointerCapture(e.pointerId);
    // the torn strip is a thing too: pick it up, flick it away
    if (flap && !['sealed', 'open'].includes(phase) && e.target.closest('.po-flap') === flap.el){
      pointer.mode = 'flap'; pointer.ox = flap.x - pt.x; pointer.oy = flap.y - pt.y;
      flap.el.style.zIndex = 70; flap.set({ z:8 }); Foil.crinkle(); Haptic.tick(6);
      e.preventDefault(); return;
    }
    if (phase === 'choose'){ if (p){ stopCoast(p); pointer.mode = 'pick'; pointer.ox = p.body.x - pt.x; pointer.oy = p.body.y - pt.y; } }
    else if (phase === 'selected'){
      if (p === chosen){ if (coast){ coast.stop(); coast = null; } pointer.mode = 'press'; pointer.yaw0 = p.yaw || 0; pointer.timer = setTimeout(() => { if (pointer && pointer.mode === 'press') { pointer.mode = 'charge'; startCharge(); } }, 90); }
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
    else if (phase === 'shown' && rc && e.target.closest('.ec-card') === rc.el){ rc.spin?.(); pointer.mode = 'shownPress'; pointer.card = rc; pointer.yaw0 = rc.yaw || 0; }
    else if (phase === 'shown'){
      stow();
      // embedded: a tap anywhere but the deck puts the card down and gives the deck back
      if (EMBED && !(onDeck && revealed < contents.length)){ pointer.mode = null; endSession(); return; }
      enterDeck();
      if (phase === 'deck' && onDeck) deckPress(pointer); else pointer.mode = null;
    }
    else if (EMBED && phase === 'deck' && !onDeck){ pointer.mode = null; endSession(); return; }
    else if (phase === 'haul'){
      const cel = e.target.closest('.ec-card'), card = cel && fan.find(c => c.el === cel);
      // a card in your hand rises under your finger
      if (card){ pointer.mode = 'cardPress'; pointer.card = card; glide(card.body, { z:8 }, 70); Foil.scrape(); Haptic.tick(5); }
      else if (p && p === chosen && !p.tossed){ pointer.mode = 'wrapPress'; pointer.ox = p.body.x - pt.x; pointer.oy = p.body.y - pt.y; }
    }

    else if (phase === 'deck' && onDeck) deckPress(pointer);
    else if (phase === 'peek'){
      pointer.mode = 'peekPress';
      pointer.timer = setTimeout(() => { if (pointer && pointer.mode === 'peekPress' && phase === 'peek'){ pointer.mode = 'squeeze'; phase = 'squeeze'; rc.el.querySelector('.ec-flap').hidden = false; creep(pointer); status('SQUEEZE IT', 'DRAG TO PEEL THE CORNER BACK'); } }, 170);
    }
    e.preventDefault();
  }
  // on the deck: a tap turns one over, a flick throws it over, a hold squeezes
  function deckPress(q){
    q.mode = 'deck';
    q.timer = setTimeout(async () => {
      if (!pointer || pointer !== q || q.mode !== 'deck') return;
      q.mode = 'squeeze';
      await startSqueeze();
      if (pointer === q && q.mode === 'squeeze') creep(q); else endSqueeze(false);
    }, 170);
  }
  // held still, the corner still lifts a little: the card breathes
  function creep(q){
    q.creep = 0;
    every(dt => {
      if (pointer !== q || q.mode !== 'squeeze' || phase !== 'squeeze') return false;
      q.creep = Math.min(14, q.creep + dt * 26 * PO.speed);
      squeezeTo(q);
    });
  }
  function squeezeTo(q){
    if (!rc || phase !== 'squeeze') return;
    const dist = Math.hypot(q.x - q.x0, q.y - q.y0) / rc.body.s;
    setFold(rc, (q.creep || 0) + dist * .9);
  }
  function onMove(e){
    const q = pointer;
    if (!q || q.id !== e.pointerId) return;
    const pt = at(e), now = performance.now(), dt = Math.max(8, now - (q.tm || q.t));
    const vx = (pt.x - q.x) / dt, vy = (pt.y - q.y) / dt;
    q.vx = mix(q.vx, vx, .5); q.vy = mix(q.vy, vy, .5); q.tm = now; q.x = pt.x; q.y = pt.y;
    const dx = q.x - q.x0, dy = q.y - q.y0, moved = Math.hypot(dx, dy);
    if (q.mode === 'pick' && phase === 'choose' && moved > 8){ q.mode = 'drag'; liftPacket(q.p); }
    if (q.mode === 'drag'){ dragPacket(q.p, q.x + q.ox, q.y + q.oy, q.vx, q.vy); return; }
    if (q.mode === 'press' && moved > 8){ clearTimeout(q.timer); q.mode = 'turn'; }
    if (q.mode === 'charge' && moved > 16){ releaseCharge(); q.mode = 'turn'; q.x0 = q.x; q.yaw0 = chosen.yaw || 0; }
    if (q.mode === 'flap'){ flap.set({ x:q.x + q.ox, y:q.y + q.oy, r:flap.r + clamp(q.vx * 6, -8, 8) }); return; }
    if (q.mode === 'cardPress' && moved > 10){ glide(q.card.body, { z:0 }, 100); q.mode = null; }
    if (q.mode === 'turn'){
      // shake it and you can hear (and feel) the cards inside
      const sgn = Math.sign(vx);
      if (Math.abs(vx) > .7 && sgn && sgn !== q.shakeSign){
        if (q.shakeSign && now - (q.shakeAt || 0) > 80){ q.shakeAt = now; Foil.scrape(); S.cardLanded(); Haptic.tick(6, 40); chosen.body.set({ x:focus().x + sgn * 4 }); }
        q.shakeSign = sgn;
      }
      const before = chosen.yaw || 0;
      setYaw(chosen, q.yaw0 + dx * 1.1);
      q.vyaw = mix(q.vyaw, ((chosen.yaw || 0) - before) / dt, .5);
      // you're holding it: it tilts toward your finger as you turn it
      chosen.body.set({ r:clamp(dy * .05, -6, 6), z:4 + Math.min(10, moved * .05) });
      return;
    }
    if (q.mode === 'shownPress' && moved > 8){ q.mode = 'toy'; S.cardReturn(); }
    if (q.mode === 'toy'){
      const before = q.card.yaw || 0;
      setBank(q.card, q.yaw0 + dx * 1.2, dy * .5);
      q.vyaw = mix(q.vyaw, ((q.card.yaw || 0) - before) / dt, .5);
      return;
    }
    if (q.mode === 'wrapPress' && moved > 6){ q.mode = 'wrap'; chosen.body.set({ z:12 }); rattle(.4); }
    if (q.mode === 'wrap'){
      const b = chosen.body;
      b.set({ x:q.x + q.ox, y:q.y + q.oy, r:wrapperSpot().r + clamp(q.vx * 20, -18, 18) });
      return;
    }
    if (q.mode === 'deck' && moved > 12){ clearTimeout(q.timer); q.mode = null; revealNext('flick'); return; }
    if (q.mode === 'peekPress' && moved > 10){ clearTimeout(q.timer); q.mode = null; }
    if (q.mode === 'squeeze'){ squeezeTo(q); return; }
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
    // a finger that stopped before lifting isn't a throw
    const fresh = performance.now() - (q.tm || 0) < 60;
    if (q.mode === 'pick' && tap && !cancel) select(q.p);
    else if (q.mode === 'drag') throwPacket(q.p, fresh ? q.vx : 0, fresh ? q.vy : 0);
    else if (q.mode === 'away' && tap && !cancel && phase === 'selected') putBack();
    else if (q.mode === 'charge') releaseCharge();
    else if (q.mode === 'turn'){
      glide(chosen.body, focus(), 220, { easing:ease.back });
      coastTurn(chosen, fresh && !cancel ? q.vyaw : 0);
    }
    else if (q.mode === 'deck' && !cancel) revealNext('tap');
    else if (q.mode === 'flap'){
      const sp = Math.hypot(q.vx, q.vy);
      if (!cancel && fresh && sp > .3) tossFlap(q.vx, q.vy);
      else glide(flap, { z:0 }, 120, { easing:ease.in }).then(() => { Foil.crinkle(); puff(stage, flap.x, flap.y + 8, AW * flap.s * .5, { n:3 }); });
    }
    else if (q.mode === 'shownPress' && tap && !cancel) inspectShown();
    else if (q.mode === 'toy') spin(q.card, fresh && !cancel ? q.vyaw : 0);
    else if (q.mode === 'cardPress' && tap && !cancel) inspect(q.card);
    else if (q.mode === 'wrapPress' && tap && !cancel) rattle(1);
    else if (q.mode === 'wrap'){
      const sp = Math.hypot(q.vx, q.vy);
      // a flick, or a long drag off toward the edge, throws it away
      const far = Math.hypot(q.x - q.x0, q.y - q.y0) > 90;
      if (!cancel && ((fresh && sp > .3) || far)) tossWrapper(sp > .3 ? q.vx : (q.x - q.x0) / 120, sp > .3 ? q.vy : (q.y - q.y0) / 120);
      else { glide(chosen.body, wrapperSpot(), 240, { easing:ease.back }).then(() => { Foil.thud(.4); rattle(.6); }); }
    }
    else if (q.mode === 'peekPress' && tap && !cancel) flip(rc);
    else if (q.mode === 'squeeze') endSqueeze(cancel);
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
    if (view !== 'packs'){ keyFrom = 'door'; return; }
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
    if (from === 'door'){ door(CAREER ? 'hub' : 'packs'); return; }
    if (phase === 'charging') releaseCharge();
    else if (lock || from !== phase || pointer) return;
    else if (phase === 'sealed'){ chosen.dir = 1; finishTear(false); }
    else if (phase === 'open') { pullTo(chosen, 20); slipFree(); }
    else if (phase === 'deck') revealNext('key');
    else if (phase === 'peek') flip(rc);
    else if (phase === 'shown'){ stow(); enterDeck(); if (phase === 'deck') revealNext('key'); }
    else if (phase === 'haul') keep();
    else if (phase === 'inspect') CardInspect.close();
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
    Haptic.on = tune.haptics;
    root.querySelectorAll('[data-tune]').forEach(b => b.setAttribute('aria-pressed', String(String(tune[b.dataset.tune]) === b.dataset.v)));
  }

  function setup(){
    root = document.createElement('main');
    root.id = 'po'; root.className = 'lobby-card pc-housing';
    root.innerHTML = `
      <header class="po-top">
        <button class="icon-btn po-back" id="po-back" type="button" hidden aria-label="Back to the desk">◄ DESK</button>
        <div class="po-brand">POKER FACES<small id="po-brand-sub">THE PACK TABLE</small></div>
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
        <div class="po-view po-album" id="po-album" hidden><div class="po-album-grid" id="po-album-grid"></div></div>
        <div class="po-view po-hub" id="po-hub" hidden></div>
        <div class="po-hatches" id="po-hatches" hidden aria-hidden="true">${SERIES.map(d => `<span class="po-hatch" data-series="${d.id}"><i class="po-hatch-door"></i><b>${d.name}<small>${money(d.price)}</small></b><i class="po-hatch-lamp"></i></span>`).join('')}</div>
        <div class="po-slot" id="po-slot" aria-label="Collection"><span class="ec-lip po-slot-lip"></span><span class="po-slot-n" id="po-slot-n">000</span></div>
      </section>
      <footer class="po-console">
        <div class="ec-lip po-rail" aria-hidden="true"></div>
        <div class="ec-bay po-desk-keys"><div class="actions-row"><button class="btn-check" type="button" id="po-case-key">CASE</button><button class="btn-raise po-play-key" type="button" id="po-play">PLAY</button><button class="btn-check" type="button" id="po-shop-key">SHOP</button></div></div>
        <div class="pc-primary-cradle po-one-key"><button class="pc-button pc-button-primary" id="po-key"><span class="pc-lamp is-amber"></span><span><span class="po-key-label" id="po-key-label"></span><small id="po-key-sub"></small></span><span class="pc-lamp is-amber"></span></button></div>
      </footer>
      <section class="po-sheet" id="po-sheet" hidden aria-label="Lab controls">
        <h2>PACK OPENING · SLICE 4</h2>
        <p>Move the packets about, pick one, hold to buy, tear, draw, turn the cards (tap, flick, or hold to squeeze), play with your hand, flick the wrapper away, KEEP. Lab money, nothing saved.</p>
        <label>DOORS</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-door="hub">DESK</button><button class="pc-button pc-button-secondary" data-door="packs" aria-pressed="true">SHOP</button><button class="pc-button pc-button-secondary" data-door="album">ALBUM</button></div>
        <div class="po-seg"><button class="pc-button pc-button-secondary" id="po-fill">FIND ALL 16 + 3 CARDS</button><button class="pc-button pc-button-secondary" id="po-visitor">A VISITOR, NOW</button></div>
        <label>NEXT PACK HOLDS</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="contents" data-v="surprise">SURPRISE</button><button class="pc-button pc-button-secondary" data-tune="contents" data-v="legendary">A LEGENDARY</button><button class="pc-button pc-button-secondary" data-tune="contents" data-v="none">NO LEGENDARY</button><button class="pc-button pc-button-secondary" data-tune="contents" data-v="double">TWO</button></div>
        <label>LEGENDARY EVENT</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="event" data-v="random">ANY</button><button class="pc-button pc-button-secondary" data-tune="event" data-v="table">TABLE</button><button class="pc-button pc-button-secondary" data-tune="event" data-v="freezeout">FREEZE</button><button class="pc-button pc-button-secondary" data-tune="event" data-v="bomb">BOMB</button><button class="pc-button pc-button-secondary" data-tune="event" data-v="wild">WILD</button></div>
        <label>SPEED</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="speed" data-v="1">REAL</button><button class="pc-button pc-button-secondary" data-tune="speed" data-v="0.5">HALF</button><button class="pc-button pc-button-secondary" data-tune="speed" data-v="0.25">QUARTER</button></div>
        <label>SOUND · MOTION</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="sound" data-v="true">SOUND ON</button><button class="pc-button pc-button-secondary" data-tune="sound" data-v="false">OFF</button><button class="pc-button pc-button-secondary" data-tune="motion" data-v="true">MOTION ON</button><button class="pc-button pc-button-secondary" data-tune="motion" data-v="false">REDUCED</button></div>
        <label>HAPTICS (IPHONE: SAFARI 18+)</label>
        <div class="po-seg"><button class="pc-button pc-button-secondary" data-tune="haptics" data-v="true">ON</button><button class="pc-button pc-button-secondary" data-tune="haptics" data-v="false">OFF</button></div>
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
    nudgeEl = $('po-nudge');
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
    root.querySelectorAll('[data-door]').forEach(b => b.onclick = () => { $('po-sheet').hidden = true; door(b.dataset.door); });
    $('po-fill').onclick = () => {
      EventCards.designs().forEach(d => { if (!found.has(d)){ const [k, r] = d.split(':'); found.set(d, EventCards.make(k, r, EventCards.SERIES.house[0], { roster:false })); } });
      ['house', 'club', 'reserve'].forEach(s => held.push(EventCards.make(EventCards.KINDS[Math.floor(Math.random() * 4)], 'common', EventCards.SERIES[s][0])));
      $('po-sheet').hidden = true;
      if (view === 'album') renderAlbum(); else if (view === 'hub'){ CareerDesk.leave(); CareerDesk.enter(); }
    };
    $('po-album').addEventListener('click', e => { const b = e.target.closest('.po-mini'); if (b) albumInspect(b); });
    $('po-back').onclick = () => door('hub');
    $('po-visitor').onclick = () => { $('po-sheet').hidden = true; if (view !== 'hub') door('hub'); setTimeout(() => CareerDesk.visitor(), 700); };
    $('po-case-key').onclick = () => CareerDesk.key('case');
    $('po-play').onclick = () => CareerDesk.key('play');
    $('po-shop-key').onclick = () => CareerDesk.key('shop');
    $('po-fresh').onclick = () => { sheet(); fresh(); };
    $('po-credit').onclick = () => { wallet += 5000; bank(); if (phase === 'selected' && chosen) key('HOLD TO BUY', money(chosen.price) + ' · ' + chosen.series.toUpperCase() + ' EDITION', true); };
    root.querySelectorAll('[data-tune]').forEach(b => b.onclick = () => {
      const v = b.dataset.v; tune[b.dataset.tune] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; applyTune();
    });
    new ResizeObserver(() => {
      const w = W, h = H; measure();
      if (!w || (Math.abs(w - W) < 1 && Math.abs(h - H) < 1) || lock || pointer) return;
      if (phase === 'choose') packets.forEach(p => p.body.set(home(p)));
      if (chosen && ['selected', 'sealed', 'open'].includes(phase)) chosen.body.set(focus());
      CareerDesk.resize();
    }).observe(st);
    measure(); bank(); applyTune(); startTicks();
    CareerDesk.init(CareerLab);
    if (CAREER){ root.classList.add('is-career'); seed(); bank(); door('hub', { instant:true }); }
    else dealIn();
    // read-only diagnostics for the lab's checks
    window.PackOpening = { get state(){ return { phase, lock, wallet, packNo, hasLegend, tear:chosen?.tear ?? 0, pull, chosen:chosen?.series ?? null, packets:packets.length, deck:!!deck, size:{ W, H }, contents:contents.map(c => c.rarity), revealed, fan:fan.length, collection, chips:chips.length, wrapper:!!(chosen && chosen.open && !chosen.tossed), inspecting:CardInspect.isOpen, view, held:held.length, found:found.size, desk:CareerDesk.state, venues:[...venues], played:[...history.values()].reduce((a, h) => a + h.played, 0), fold:rc?.fold ?? 0, shown:rc?.shown ? rc.spec.rarity : null, homes:packets.map(p => p.home && [+p.home.fx.toFixed(3), +p.home.fy.toFixed(3)]) }; } };
  }
  /* Embedded on another felt (the Career hub). cfg:
     root    the host's machine (jolts, the dip's dimming, lamps)
     stage   { el, shadows, objects, fx } over the host's felt
     ui      status(t, s) figure(n, l) key(l, s, on) keySub(s) bank(v)
             bankEl() flash(): the host's reel, screens and key
     wallet, setWallet(v), focus(W, H) (where a packet on offer sits),
     layout  overrides for L (handY, squareY, wrapY, flapY, deckX, deckY, railLift, tableS)
     onPutBack(p) onBought(p) bag({ x, y, series })
     handOver({ cards, deck, wrapper, flap }) place(card) deckBack({ deck, cards }):
     the host's hooks */
  function attach(c){
    cfg = c; ui = c.ui; root = c.root; stage = c.stage;
    Object.assign(L, c.layout || {});
    phase = 'idle';
    nudgeEl = Object.assign(document.createElement('i'), { className:'po-nudge', hidden:true });
    stage.el.append(nudgeEl);
    const st = stage.el;
    st.addEventListener('pointerdown', onDown);
    st.addEventListener('pointermove', onMove);
    st.addEventListener('pointerup', e => onUp(e, false));
    st.addEventListener('pointercancel', e => onUp(e, true));
    new ResizeObserver(() => {
      const w = W, h = H; measure();
      if (!w || (Math.abs(w - W) < 1 && Math.abs(h - H) < 1) || lock || pointer) return;
      if (chosen && ['selected', 'sealed', 'open'].includes(phase)) chosen.body.set(focus());
    }).observe(st);
    measure(); startTicks();
  }
  // the shop hands over a packet on this felt: it's on offer
  function offer(p){
    if (phase !== 'idle' && phase !== 'selected') return;
    if (charge) return;
    wallet = cfg.wallet();
    packets = [p]; chosen = null;
    p.yaw = p.yaw || 0; p.face = 'front';
    if (!p.cards.length) fillStack(p);
    measure();
    return select(p);
  }
  // a packet you already own, from the host's pile: it comes to the middle
  // of the felt sealed, ready to tear
  async function openOwned(p){
    if (phase !== 'idle') return;
    // the New Career preview: the packet's cards are the ones drawn when it
    // was bought, and tearing it open moves them into your cards (saved)
    const saved = window.CareerLink && p.pktId ? CareerLink.open(p.pktId) : null;
    if (window.CareerLink && !saved) return false;
    wallet = cfg.wallet(); measure();
    packets = [p]; chosen = p; packNo++;
    pull = 0; deck = flap = rc = null; fan = [];
    p.yaw = 0; p.face = 'front'; p.body.set({ shx:1 });
    if (!p.cards.length) fillStack(p);
    if (saved){ contents = saved; hasLegend = saved.some(c => c.rarity === 'legendary'); revealed = 0; }
    else {
      hasLegend = tune.contents === 'legendary' || tune.contents === 'double' || (tune.contents === 'surprise' && Math.random() < 1 / 3);
      contents = EventCards.pack(p.series, { legend:hasLegend, double:tune.contents === 'double', event:tune.event }); revealed = 0;
    }
    lock = true; phase = 'bought';
    S.cardReturn(); Foil.rustle(.7);
    const f = focus();
    await glide(p.body, { ...f, z:0, r:0 }, 420, { arc:60 });
    S.cardLanded(); Foil.thud(.5); Haptic.tick(14);
    puff(stage, f.x, f.y + AH * f.s / 2, AW * f.s, { n:10 });
    await squash(p.body, .1, 240);
    lock = false; phase = 'sealed';
    p.seamHint = 1; p.draw();
    status('TEAR IT OPEN', 'DRAG ACROSS THE TOP SEAM'); figure('04', 'INSIDE'); key('OPEN IT', 'OR DRAG ACROSS THE SEAM');
    idleAt = performance.now();
  }
  if (EMBED){
    window.PackOpeningEmbed = {
      attach, offer, putBack, openOwned, session, down:e => onDown(e),
      // a tap off the felt altogether: the card turned goes down, the deck back
      putDown(){ if (phase === 'shown' && !lock){ stow(); endSession(); } },
      // the host's table can change size between openings
      layout(o){ Object.assign(L, o); },
      keyDown:onKeyDown, keyUp:onKeyUp,
      keyCancel(){ keyFrom = null; keyHeld = false; if (phase === 'charging') releaseCharge(); },
      finish(){ PO.finishAll(); },
      // (in the game, the player's own sound, motion and haptics settings)
      tune, applyTune:() => { if (window.CareerLink){ tune.sound = !!settings.sound; tune.motion = !settings.reduceMotion; tune.haptics = settings.haptics !== false; } PO.speed = tune.speed; PO.reduced = !tune.motion || matchMedia('(prefers-reduced-motion: reduce)').matches; try { settings.sound = tune.sound; } catch (e) {} Haptic.on = tune.haptics; },
      get state(){ return { phase, lock, wallet, packNo, hasLegend, chosen:chosen?.series ?? null, tear:chosen?.tear ?? 0, pull, deck:!!deck, contents:contents.map(c => c.rarity), revealed, fan:fan.length, chips:chips.length, wrapper:!!(chosen && chosen.open && !chosen.tossed), inspecting:CardInspect.isOpen, fold:rc?.fold ?? 0, shown:rc?.shown ? rc.spec.rarity : null }; }
    };
  } else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
