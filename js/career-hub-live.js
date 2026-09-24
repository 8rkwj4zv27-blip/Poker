/* Live Career Hub presentation. Career's catalogue, roster, risk confirmation,
   transaction and table-launch functions in 07-ui-wiring remain authoritative. */
(() => {
  'use strict';

  let selectedId = null;
  let flipped = false;
  let turning = false;
  let accepting = false;
  let recordIndex = 0;
  let recordTimer = null;
  let faceTimer = null;
  let motionTimers = [];
  let pointer = null;
  const amount = n => '$' + Number(n || 0).toLocaleString('en-US');
  const motionReduced = () => motionOff() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The CRT blink, cleared afterwards (as paintCRT does) so the glass returns
  // to its idle flicker instead of holding the finished burst.
  const crtBlink = glass => {
    glass.classList.remove('crt-refresh'); void glass.offsetWidth; glass.classList.add('crt-refresh');
    clearTimeout(glass._crtRefreshT);
    glass._crtRefreshT = setTimeout(() => glass.classList.remove('crt-refresh'), 250);
  };
  const shortVenue = venue => venue.replace(' CHAMPIONSHIP','').replace('HIGH ROLLER ROOM','HIGH ROLLER');
  const depart = (launch,options) => typeof careerDepartToTable === 'function' ? careerDepartToTable(launch,options) : launch();
  const queue = (fn, ms) => { const timer = window.setTimeout(fn, ms); motionTimers.push(timer); return timer; };

  function entries(){
    const all = [];
    CAREER_ROOMS.forEach(room => {
      if (room.venue === 'BACK ROOM') all.push({
        id:CAREER_CASH_CONFIG.id, venue:room.venue, title:'CASH TABLE',
        key:room.key, event:null, cash:true, state:careerCashState()
      });
      careerRoomEvents(room.venue).forEach(event => {
        const state = careerEventState(event.id);
        if (state !== 'hidden') all.push({
          id:event.id, venue:event.venue, title:careerEventTitle(event),
          key:room.key, event, cash:false, state
        });
      });
    });
    return all;
  }

  function choose(all){
    const live = career.cash ? CAREER_CASH_CONFIG.id : career.active?.eventId;
    if (live && all.some(entry => entry.id === live)) selectedId = live;
    else if (!all.some(entry => entry.id === selectedId)){
      const access = careerHighestAccess();
      selectedId = (all.find(entry => entry.venue === access && entry.state === 'available' && !entry.cash)
        || all.find(entry => entry.state === 'available' && !entry.cash) || all[0])?.id || null;
    }
    return Math.max(0, all.findIndex(entry => entry.id === selectedId));
  }

  function faces(entry){
    const roster = entry.cash ? career.cash?.roster : careerRosterFor(entry.id);
    if (!Array.isArray(roster) || !roster.length){
      return '<div class="ch2-opponents is-undrawn"><span>FIELD DRAWN AT BUY-IN</span></div>';
    }
    return '<div class="ch2-opponents">' + roster.map(seat => {
      const name = careerSeatName(seat) || 'VISITOR';
      const face = {faceColorIdx:seat.faceColorIdx};
      return '<span class="ch2-face"><span class="ch2-portrait-stack">' +
        '<span class="ch2-rest-art">' + renderFace(face,'idle') + '</span>' +
        '<span class="ch2-alt-art">' + renderFace(face,'think') + '</span></span>' +
        '<b>' + esc(name) + '</b></span>';
    }).join('') + '</div>';
  }

  function formatNote(entry){
    if (entry.cash) return 'Play hand by hand. Cash out your remaining stack between hands.';
    if (entry.id === SECOND_CHANCE_EVENT_ID) return 'One life. First place collects the prize; this event does not unlock a venue.';
    if (entry.event.playerCount === 2) return 'One opponent. One life. Winner takes the prize.';
    const paid = careerPayouts(entry.event).length;
    return paid === 1 ? 'One life. Last player standing collects the prize.'
      : 'One life. The top ' + paid + ' places pay; first place opens the next room.';
  }

  function card(entry, index){
    const event = entry.event;
    const buyIn = entry.cash ? CAREER_CASH_CONFIG.buyIn : event.buyIn;
    const players = entry.cash ? CAREER_CASH_CONFIG.playerCount : event.playerCount;
    const payouts = entry.cash ? [] : careerPayouts(event);
    const headline = entry.cash ? '$1 / $2 CASH' : amount(payouts[0]) + (payouts.length > 1 ? ' TOP PRIZE' : ' PRIZE');
    const detailFormat = entry.cash ? 'NO-RAKE CASH TABLE' : String(event.format).toUpperCase();
    const facts = entry.cash
      ? [['STARTING STACK',amount(CAREER_CASH_CONFIG.stack)],['BLINDS','$1 / $2 FIXED'],['TABLE',players + ' PLAYERS'],['CASH-OUT','BETWEEN HANDS']]
      : [['STARTING STACK',amount(event.stack)],['BLINDS RISE',event.handsPerBlindLevel + ' HANDS'],['TABLE',players + ' PLAYERS'],['THREAT',careerThreatOf(event).split('·').pop().trim()]];
    const factHTML = facts.map(([label,value]) => '<span class="ch2-brief-row' + (value.length > 11 ? ' is-long' : '') + '"><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></span>').join('');
    const payoutHTML = entry.cash ? '<strong>CASH OUT BETWEEN HANDS</strong>'
      : payouts.length > 1 ? '<div class="ch2-payout-places">' + payouts.map((value,i) =>
        '<span><small>' + ['1ST','2ND','3RD'][i] + '</small><b>' + esc(amount(value)) + '</b></span>').join('') + '</div>'
      : '<strong>' + esc(amount(payouts[0])) + ' TO 1ST</strong>';
    const requirement = entry.cash
      ? entry.state === 'active' ? amount(careerMoneyCommitted()) + ' ON THE TABLE'
        : entry.state === 'blocked' ? 'FINISH THE ACTIVE EVENT FIRST'
        : entry.state === 'unaffordable' ? amount(buyIn - careerBankroll()) + ' SHORT' : 'OPEN TO YOU NOW'
      : careerRequirementText(event, entry.state);
    return '<article class="ch2-card" data-index="' + index + '" data-event-id="' + esc(entry.id) + '" data-venue="' + entry.key + '" role="option" aria-label="' + esc(entry.venue + ', ' + entry.title) + '">' +
      '<div class="ch2-card-inner">' +
        '<section class="ch2-card-face ch2-card-front ch2-paper opponents-' + (players - 1) + '">' +
          '<header class="ch2-card-venue">' + esc(shortVenue(entry.venue)) + '</header>' +
          '<h2>' + esc(entry.title) + '</h2><div class="ch2-headline">' + esc(headline) + '</div>' +
          '<div class="ch2-card-stats"><span><small>BUY-IN</small><strong>' + esc(buyIn ? amount(buyIn) : 'FREE') + '</strong></span>' +
          '<span><small>PLAYERS</small><strong>' + players + '</strong></span></div>' +
          '<div class="ch2-opponent-stage"><span class="ch2-stage-label">YOUR TABLE</span>' + faces(entry) + '</div>' +
          '<div class="ch2-stamp ch2-stamp-lock">LOCKED</div><div class="ch2-stamp ch2-stamp-paid">ENTRY PAID</div>' +
          '<div class="ch2-requirement">' + esc(requirement) + '</div>' +
          '<button class="pc-button ch2-card-flip" type="button" data-card-flip="back">DETAILS</button>' +
        '</section>' +
        '<section class="ch2-card-face ch2-card-back ch2-paper" aria-hidden="true">' +
          '<header class="ch2-card-venue">' + esc(shortVenue(entry.venue)) + '</header>' +
          '<div class="ch2-back-title"><h2>' + esc(entry.title) + '</h2></div>' +
          '<div class="ch2-format-brief"><small>FORMAT</small><strong>' + esc(detailFormat) + '</strong><p>' + esc(formatNote(entry)) + '</p></div>' +
          '<div class="ch2-brief-list">' + factHTML + '</div>' +
          '<div class="ch2-back-hero"><small>' + (entry.cash ? 'TABLE RULE' : payouts.length > 1 ? 'PAYOUTS' : 'PRIZE') + '</small>' + payoutHTML + '</div>' +
          '<div class="ch2-back-entry"><span><small>BUY-IN</small><strong>' + esc(buyIn ? amount(buyIn) : 'FREE') + '</strong></span><b>' + esc(requirement) + '</b></div>' +
          '<button class="pc-button ch2-card-flip" type="button" data-card-flip="front">EVENT</button>' +
        '</section>' +
      '</div></article>';
  }

  function reelMarkup(value){
    const raw = String(Math.max(0, Math.floor(value || 0)));
    const digits = raw.padStart(7,'0');
    const firstLive = digits.length - raw.length;
    return '<span class="jp-cell jp-sym">$</span>' + [...digits].map((digit,i) =>
      '<span class="jp-cell jp-digit tabular' + (i < firstLive ? ' is-leading' : '') + '"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>' + digit + '</span><span>' + digit + '</span></span></span></span>').join('');
  }

  function stats(){
    const played = normalizeCareerCounter(career.eventsPlayed);
    const won = normalizeCareerCounter(career.eventsWon);
    return [
      [['EVENTS PLAYED',String(played).padStart(3,'0')],['EVENTS WON',String(won).padStart(3,'0')]],
      [['WIN RATE',played ? Math.round(won / played * 100) + '%' : '—'],['ON TABLE',amount(careerMoneyCommitted())]],
      [['TOTAL OWNED',amount(careerTotalOwned())],['HIGHEST ACCESS',shortVenue(careerHighestAccess())]]
    ];
  }

  function record(showBlink){
    const root = document.getElementById('career-hub');
    if (!root) return;
    const values = stats()[recordIndex % 3];
    root.querySelector('#ch2-crt-label-a').textContent = values[0][0];
    root.querySelector('#ch2-crt-value-a').textContent = values[0][1];
    root.querySelector('#ch2-crt-label-b').textContent = values[1][0];
    root.querySelector('#ch2-crt-value-b').textContent = values[1][1];
    root.querySelector('#ch2-record').setAttribute('aria-label', values[0].join(' ') + '. ' + values[1].join(' ') + '. Tap for next statistics');
    const glass = root.querySelector('#ch2-crt-glass');
    if (showBlink && !motionReduced()) crtBlink(glass);
  }

  /* Continuous rack geometry: `d` is a card's signed distance, in cards, from
     the reader's centre. Integer distances reproduce the approved resting
     layout exactly; everything between is interpolated. Tickets never fade:
     they stay solid, dim under an opacity-only shade layer, and slide under
     their neighbours and out past the clipped reader edges. */
  function cardGeometry(d){
    const a = Math.min(Math.abs(d),3);
    const x = a <= 1 ? 91 * a : a <= 2 ? 91 + 27 * (a - 1) : 118;
    return {
      x:(d < 0 ? -1 : 1) * x,
      y:a <= 1 ? 10 + 12 * a : a <= 2 ? 22 + 6 * (a - 1) : 28,
      scale:a <= 1 ? 1 - .06 * a : a <= 2 ? .94 - .04 * (a - 1) : .9,
      visible:a < 2.5,
      shade:.46 * Math.min(a,1),
      z:Math.max(1,Math.round(30 - a * 12))
    };
  }
  const softCap = (value,limit) => limit * Math.tanh(value / limit);
  const clamp = (value,lo,hi) => Math.max(lo,Math.min(hi,value));
  let rackRaf = 0;

  function cardStates(root, all, current){
    const rack = root.querySelector('#ch2-rack');
    rack.scrollLeft = 0;
    root.querySelectorAll('.ch2-card').forEach((node,i) => {
      const delta = i - current;
      const abs = Math.abs(delta);
      node.classList.toggle('is-selected',delta === 0);
      node.classList.toggle('is-near',abs === 1);
      node.classList.toggle('is-far',abs > 1);
      node.classList.toggle('is-left',delta < 0);
      node.classList.toggle('is-right',delta > 0);
      node.classList.toggle('is-flipped',delta === 0 && flipped);
      node.classList.toggle('is-locked',all[i].state === 'locked');
      node.classList.toggle('is-paid',all[i].state === 'active');
      node.setAttribute('aria-selected',String(delta === 0));
      node.tabIndex = delta === 0 ? 0 : -1;
      node.querySelector('.ch2-card-front').setAttribute('aria-hidden',String(delta === 0 && flipped));
      node.querySelector('.ch2-card-back').setAttribute('aria-hidden',String(!(delta === 0 && flipped)));
      node.querySelector('[data-card-flip="back"]').tabIndex = delta === 0 && !flipped ? 0 : -1;
      node.querySelector('[data-card-flip="front"]').tabIndex = delta === 0 && flipped ? 0 : -1;
    });
    rack.setAttribute('aria-label',all[current].venue + ', ' + all[current].title + ', ' + all[current].state);
    const currentEntry = all[current];
    const action = root.querySelector('#ch2-primary');
    const main = root.querySelector('#ch2-primary-main');
    const sub = root.querySelector('#ch2-primary-sub');
    action.disabled = accepting || !['available','active'].includes(currentEntry.state);
    action.className = 'pc-button pc-button-primary ch2-primary is-' + currentEntry.state;
    // The slot's lamps invite a ticket only when this one can be fed in.
    root.dataset.entry = currentEntry.state;
    slotReadout(root);
    if (currentEntry.state === 'active') { main.textContent = currentEntry.cash ? 'RESUME TABLE' : 'CONTINUE'; sub.textContent = 'SEAT ACCEPTED'; }
    else if (currentEntry.state === 'available') { main.textContent = currentEntry.cash ? 'BUY IN ' + amount(CAREER_CASH_CONFIG.buyIn) : currentEntry.event.buyIn ? 'BUY IN ' + amount(currentEntry.event.buyIn) : 'TAKE SEAT'; sub.textContent = 'TAKE SEAT'; }
    else if (currentEntry.state === 'unaffordable') { main.textContent = 'BANKROLL LOW'; sub.textContent = 'ENTRY UNAFFORDABLE'; }
    else { main.textContent = currentEntry.state === 'blocked' ? 'TABLE IN PLAY' : 'LOCKED'; sub.textContent = currentEntry.state === 'blocked' ? 'FINISH ACTIVE EVENT' : 'EVENT UNAVAILABLE'; }
    const secondary = document.getElementById('ch2-secondary');
    if (secondary){
      secondary.hidden = currentEntry.state !== 'active';
      secondary.disabled = accepting;
      secondary.textContent = currentEntry.cash ? 'CASH OUT ' + amount(careerMoneyCommitted()) : 'ABANDON EVENT';
      secondary.onclick = () => {
        if (currentEntry.cash) careerCashOutPressed();
        else careerAbandonPressed(currentEntry.id);
      };
    }
  }

  /* The slot's readout says what the slot is doing, in the DEALER READY
     voice. It follows the selected ticket's state (data-entry, set in
     cardStates) and the ticket feed's own stage classes on the hub, so
     neither the feed nor anything else has to call into it. */
  const SLOT_READOUT = { available:'INSERT TICKET', active:'ENTRY PAID', locked:'LOCKED', unaffordable:'FUNDS LOW', blocked:'TABLE IN PLAY' };
  function slotReadout(root){
    const text = root.querySelector('#ch2-slot-text');
    if (!text) return;
    const next = root.classList.contains('tf-accepted') ? 'ACCEPTED'
      : root.classList.contains('tf-shredding') ? 'SHREDDING'
      : root.classList.contains('tf-feeding') ? 'READING'
      : SLOT_READOUT[root.dataset.entry] || 'READY';
    if (text.textContent !== next) text.textContent = next;
  }
  function watchSlotReadout(root){
    if (typeof MutationObserver === 'undefined') return;
    new MutationObserver(() => slotReadout(root)).observe(root, { attributes:true, attributeFilter:['class','data-entry'] });
  }

  function mount(board){
    if (accepting) return;
    const backButton = document.getElementById('career-back');
    if (backButton) backButton.disabled = false;
    const all = entries();
    if (!all.length) return;
    const current = choose(all);
    flipped = false;
    const bank = careerBankroll();
    board.innerHTML = '<main class="ch2-machine" id="career-hub" aria-label="Career Hub">' +
      '<header class="ch2-instrument"><div class="ch2-utility-row"><button class="ch2-key" id="ch2-back" type="button" aria-label="Back to main menu"><span class="ch2-nav-mark" aria-hidden="true"></span></button><span class="pc-label ch2-instrument-title">Bankroll</span><button class="ch2-key" id="ch2-settings" type="button" aria-label="Settings">\u2699</button></div>' +
      '<div class="ch2-money-block"><div class="cpi-bankroll-housing ch2-bankroll-housing"><div class="amt-readout ch2-bankroll-reel" id="ch2-bankroll" role="img" aria-live="polite" aria-label="Bankroll ' + esc(amount(bank)) + '" style="grid-template-columns:21px repeat(' + Math.max(7,String(bank).length) + ',minmax(12px,1fr))">' + reelMarkup(bank) + '</div></div></div>' +
      '<button class="ch2-record crt" id="ch2-record" type="button"><span class="ch2-crt-glass crt__content machine-crt" id="ch2-crt-glass"><span class="ch2-crt-stat"><small id="ch2-crt-label-a"></small><strong class="tabular" id="ch2-crt-value-a"></strong></span><span class="ch2-crt-stat"><small id="ch2-crt-label-b"></small><strong class="tabular" id="ch2-crt-value-b"></strong></span></span></button></header>' +
      '<section class="ch2-reader" aria-label="Career event browser"><div class="ch2-rack" id="ch2-rack"><div class="ch2-track" id="ch2-track" role="listbox" tabindex="0" aria-label="Career events. Swipe, tap an exposed ticket edge, or use left and right arrow keys">' + all.map(card).join('') + '</div></div></section>' +
      // The console: one dark-plastic housing holding the ticket slot, the
      // main button and Abandon/Cash Out. In the slot only .ch2-intake and
      // .ch2-intake-mouth are load-bearing (the ticket feed finds the slot
      // by id and measures the mouth); the readout says what it is doing.
      '<div class="ch2-console">' +
      '<div class="ch2-intake" id="ch2-intake" aria-hidden="true">' +
        '<span class="ch2-intake-mouth"></span>' +
        '<span class="pc-display ch2-slot-readout machine-crt"><span class="pc-lamp ch2-slot-lamp"></span><span id="ch2-slot-text"></span></span>' +
      '</div>' +
      '<div class="pc-primary-cradle ch2-action-cradle"><span class="pc-slot-aperture" aria-hidden="true"><span class="pc-slot-door"></span></span><button class="pc-button pc-button-primary ch2-primary" id="ch2-primary" type="button"><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong id="ch2-primary-main"></strong><small id="ch2-primary-sub"></small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div>' +
      '<button class="ch2-secondary" id="ch2-secondary" type="button" hidden></button>' +
      '</div>' +
      '</main>';
    const root = board.querySelector('#career-hub');
    watchSlotReadout(root);
    // Back and Settings live on the cabinet's top rail. Back goes through
    // the screen's own #career-back (hidden with the old bottom strip), so
    // its handler and its disabled-while-buying-in state stay the one truth.
    root.querySelector('#ch2-back').onclick = () => {
      const back = document.getElementById('career-back');
      if (!back || back.disabled || accepting) return;
      Sound.buttonPress('check');
      back.click();
    };
    root.querySelector('#ch2-settings').onclick = () => {
      if (accepting) return;
      Sound.buttonPress('check');
      openOverlay('settings');
    };
    const selected = () => all.findIndex(entry => entry.id === selectedId);
    const track = root.querySelector('#ch2-track');
    const rack = root.querySelector('#ch2-rack');
    const reader = root.querySelector('.ch2-reader');
    const cards = [...track.querySelectorAll('.ch2-card')];
    const last = all.length - 1;
    let suppressEdgeTapUntil = 0;

    /* The rack is one continuous position `s` (in cards) driven by a spring.
       Hold springs give the grabbed ticket its finger pull, swing and press
       tilt; they are presentation only and never select anything. */
    const hold = () => ({x:0,v:0,goal:0});
    const phys = {
      s:current, v:0, target:current, held:current, detent:current,
      dragging:false, landed:true, wall:0, lastT:0,
      hy:hold(), lean:hold(), tx:hold(), ty:hold(), lift:hold(),
      // Per-ticket rise: the ticket being travelled towards lifts off the
      // stack, crosses over the current one, then lays down on the reader.
      rise:cards.map(hold), arriving:-1
    };
    const holds = [phys.hy,phys.lean,phys.tx,phys.ty,phys.lift];
    const spring = (q,k,zeta,h) => {
      q.v += (-k * (q.x - q.goal) - 2 * zeta * Math.sqrt(k) * q.v) * h;
      q.x += q.v * h;
    };
    const rubber = s => s < 0 ? -softCap(-s * .42,.24) : s > last ? last + softCap((s - last) * .42,.24) : s;
    // A shallow detent potential: the rack leans into each notch and snaps
    // over the midpoint, like a heavy rotary selector.
    const visualS = () => {
      const s = rubber(phys.s);
      if (s < 0 || s > last || motionReduced()) return s;
      return s - .15 / (2 * Math.PI) * Math.sin(2 * Math.PI * (s - Math.round(s)));
    };
    const paint = () => {
      const s = visualS();
      const lift = Math.max(0,phys.lift.x);
      cards.forEach((card,i) => {
        const d = i - s;
        const rise = Math.max(0,phys.rise[i].x);
        const far = Math.abs(d) >= 2.6 && i !== phys.held && rise < .001;
        if (far && card._far) return;
        card._far = far;
        const g = cardGeometry(d);
        const st = card.style;
        const held = i === phys.held;
        const heldLift = held ? lift : 0;
        const share = held ? 1 : Math.abs(d) < 1.5 ? .28 : 0;
        st.setProperty('--card-x',g.x.toFixed(3) + '%');
        st.setProperty('--card-y',(g.y - 5 * rise).toFixed(2) + 'px');
        st.setProperty('--card-scale',(g.scale * (1 + .03 * heldLift + .06 * rise)).toFixed(4));
        st.setProperty('--card-o',g.visible || rise > .001 ? '1' : '0');
        st.setProperty('--shade',(g.shade * (1 - .75 * Math.min(1,rise))).toFixed(3));
        st.setProperty('--hold-y',(held ? phys.hy.x : 0).toFixed(2) + 'px');
        st.setProperty('--lean',(phys.lean.x * share).toFixed(3) + 'deg');
        st.setProperty('--tilt-x',(held ? phys.tx.x : 0).toFixed(3) + 'deg');
        st.setProperty('--tilt-y',(held ? phys.ty.x : 0).toFixed(3) + 'deg');
        st.setProperty('--lift',Math.max(heldLift,rise).toFixed(3));
        const arriving = i === phys.arriving || rise > .02;
        st.zIndex = String(arriving ? 40 : held && lift > .04 ? 33 : g.z);
      });
    };
    // The ticket being travelled towards: set by the finger's direction while
    // dragging, never by the halfway point, so reversing never pops.
    const arrivingIndex = () => {
      const s = rubber(phys.s);
      const dir = phys.dragging && pointer ? s - pointer.base : phys.target - s;
      if (Math.abs(dir) < .015) return -1;
      const i = dir > 0 ? Math.ceil(s - 1e-6) : Math.floor(s + 1e-6);
      return i >= 0 && i <= last ? i : -1;
    };
    const jolt = dir => {
      reader.classList.remove('is-stop-left','is-stop-right');
      void reader.offsetWidth;
      reader.classList.add(dir < 0 ? 'is-stop-left' : 'is-stop-right');
      Sound.koThunk(.55);
      haptic(18);
    };
    const notchTo = (notch,energy) => {
      if (notch === phys.detent) return;
      const venueChange = all[notch].key !== all[phys.detent].key;
      phys.detent = notch;
      root.dataset.venue = all[notch].key;
      if (venueChange){ Sound.stageRollClick(1,true); haptic(14); }
      else { Sound.stageRollClick(clamp(energy,.12,1),false); haptic(5); }
    };
    const snap = () => {
      phys.s = phys.target; phys.v = 0; phys.held = phys.target; phys.landed = true;
      holds.forEach(q => { q.x = q.goal = q.v = 0; });
      phys.rise.forEach(q => { q.x = q.goal = q.v = 0; });
      phys.arriving = -1;
      notchTo(phys.target,.4);
      paint();
    };
    const tick = now => {
      rackRaf = 0;
      if (!root.isConnected) return;
      const dt = Math.min(.034,Math.max(.001,(now - (phys.lastT || now - 16)) / 1000));
      phys.lastT = now;
      if (phys.dragging && pointer){
        // A finger that stops moving stops pulling; the ticket swings back
        // on its own spring rather than freezing at its last lean.
        const fade = Math.exp(-(performance.now() - pointer.t) / 70);
        const vx = pointer.vx * fade, vy = pointer.vy * fade;
        const grip = pointer.gy >= 0 ? 1 : -1;
        phys.lean.goal = clamp(-vx * 6.5 * grip * (.55 + .45 * Math.abs(pointer.gy)),-10,10);
        // The spot under the finger presses in; the leading edge rises.
        phys.tx.goal = clamp(-pointer.gy * 4.5 + vy * 3.2,-8,8);
        phys.ty.goal = clamp(pointer.gx * 5.5 - vx * 2.6,-9,9);
        // The grabbed ticket settles lower as it is pushed out of the way.
        if (!motionReduced()) phys.lift.goal = 1 - .8 * clamp(Math.abs(rubber(phys.s) - pointer.base) / .5,0,1);
      }
      phys.arriving = motionReduced() ? -1 : arrivingIndex();
      phys.rise.forEach((q,i) => {
        if (i !== phys.arriving){ q.goal = 0; return; }
        // Held up while the finger carries it; lays down over the last stretch.
        q.goal = phys.dragging ? 1 : clamp(Math.abs(i - rubber(phys.s)) / .3,0,1);
      });
      const steps = Math.ceil(dt * 120), h = dt / steps;
      for (let n = 0; n < steps; n++){
        if (!phys.dragging){
          const zeta = Math.abs(phys.s - phys.target) > 1.2 ? .88 : .64;
          phys.v += (-150 * (phys.s - phys.target) - 2 * zeta * Math.sqrt(150) * phys.v) * h;
          phys.v = clamp(phys.v,-26,26);
          phys.s += phys.v * h;
        }
        spring(phys.hy,230,.46,h);
        spring(phys.lean,250,.34,h);
        spring(phys.tx,290,.5,h);
        spring(phys.ty,290,.5,h);
        spring(phys.lift,210,.82,h);
        phys.rise.forEach(q => { if (q.x || q.goal || q.v) spring(q,260,.62,h); });
      }
      notchTo(clamp(Math.round(visualS()),0,last),Math.abs(phys.v) / 9 + .12);
      if (!phys.dragging && !phys.landed && Math.abs(phys.s - phys.target) < .03){
        phys.landed = true;
        if (phys.wall) jolt(phys.wall); else Sound.cardLanded();
        phys.wall = 0;
      }
      paint();
      const resting = !phys.dragging && Math.abs(phys.s - phys.target) < .0008 && Math.abs(phys.v) < .01 &&
        holds.every(q => Math.abs(q.x - q.goal) < .01 && Math.abs(q.v) < .05) &&
        phys.rise.every(q => Math.abs(q.x) < .004 && Math.abs(q.v) < .05);
      if (resting){
        phys.s = phys.target; phys.v = 0; phys.lastT = 0;
        holds.forEach(q => { q.x = q.goal; q.v = 0; });
        phys.rise.forEach(q => { q.x = q.goal = q.v = 0; });
        phys.arriving = -1;
        phys.held = phys.target;
        paint();
        return;
      }
      rackRaf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!rackRaf){ phys.lastT = 0; rackRaf = requestAnimationFrame(tick); } };
    const commit = next => {
      if (next === phys.target) return;
      phys.target = next; phys.landed = false;
      selectedId = all[next].id; flipped = false;
      root.querySelectorAll('.ch2-face.is-expressing').forEach(node => node.classList.remove('is-expressing'));
      cardStates(root,all,next);
    };
    root._settleRack = () => { if (rackRaf) cancelAnimationFrame(rackRaf); rackRaf = 0; pointer = null; phys.dragging = false; snap(); };
    const move = delta => {
      if (accepting || turning || phys.dragging) return;
      const next = clamp(phys.target + delta,0,last);
      if (next === phys.target){
        jolt(delta);
        if (!motionReduced()){ phys.s += delta * .07; phys.v += delta * .8; kick(); }
        return;
      }
      commit(next);
      if (motionReduced()){ snap(); return; }
      phys.v += delta * 3;
      kick();
    };
    const flip = showBack => {
      if (accepting || turning) return;
      const selectedCard = root.querySelector('.ch2-card.is-selected');
      flipped = showBack; turning = true;
      selectedCard.classList.toggle('is-flipped',flipped);
      selectedCard.querySelector('.ch2-card-front').setAttribute('aria-hidden',String(flipped));
      selectedCard.querySelector('.ch2-card-back').setAttribute('aria-hidden',String(!flipped));
      selectedCard.querySelector('[data-card-flip="back"]').tabIndex = flipped ? -1 : 0;
      selectedCard.querySelector('[data-card-flip="front"]').tabIndex = flipped ? 0 : -1;
      queue(() => { turning = false; selectedCard.querySelector('[data-card-flip="' + (flipped ? 'front' : 'back') + '"]')?.focus(); },motionReduced() ? 0 : 640);
      Sound.buttonRelease('award');
    };
    root.querySelector('#ch2-record').onclick = () => { if (accepting) return; recordIndex = (recordIndex + 1) % 3; record(true); };
    track.onclick = event => {
      const button = event.target.closest('[data-card-flip]');
      if (button) flip(button.dataset.cardFlip === 'back');
    };
    track.addEventListener('keydown',event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight'){
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    root.querySelector('#ch2-primary').onclick = () => accept(root,all[selected()],flip);
    rack.addEventListener('pointerdown',event => {
      if (accepting || turning || event.button > 0 || event.target.closest('button')) return;
      // Catching a travelling rack grabs the ticket nearest the finger.
      phys.s = rubber(phys.s);
      phys.held = clamp(Math.round(phys.s),0,last);
      const card = cards[phys.held];
      const r = card.getBoundingClientRect();
      pointer = {
        id:event.pointerId, x0:event.clientX, y0:event.clientY, lastX:event.clientX, lastY:event.clientY,
        t:performance.now(), vx:0, vy:0, s0:phys.s, base:phys.held, moved:false,
        spacing:Math.max(120,card.offsetWidth * .91),
        gx:clamp((event.clientX - (r.left + r.width / 2)) / (r.width / 2),-1,1),
        gy:clamp((event.clientY - (r.top + r.height * .42)) / (r.height / 2),-1,1)
      };
      rack.setPointerCapture(event.pointerId);
      phys.dragging = true; phys.landed = false; phys.v = 0; phys.wall = 0;
      if (!motionReduced()){
        phys.lift.goal = 1;
        phys.lift.v += 3.5;
      }
      kick();
    });
    rack.addEventListener('pointermove',event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const now = performance.now();
      const span = Math.max(8,now - pointer.t);
      pointer.vx = .5 * pointer.vx + .5 * ((event.clientX - pointer.lastX) / span);
      pointer.vy = .5 * pointer.vy + .5 * ((event.clientY - pointer.lastY) / span);
      pointer.lastX = event.clientX; pointer.lastY = event.clientY; pointer.t = now;
      const dx = event.clientX - pointer.x0, dy = event.clientY - pointer.y0;
      if (!pointer.moved && Math.hypot(dx,dy) > 9){ pointer.moved = true; Sound.cardFlip(false); }
      phys.s = pointer.s0 - dx / pointer.spacing;
      phys.v = -pointer.vx * 1000 / pointer.spacing;
      // The ticket follows the finger off-axis too, up to a soft limit.
      // Less travel downward: the reader lip sits just below the ticket.
      if (!motionReduced()) phys.hy.goal = dy > 0 ? softCap(dy * .3,11) : softCap(dy * .34,22);
      kick();
    });
    const release = (event,cancelled = false) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const p = pointer;
      pointer = null;
      if (Math.abs(event.clientX - p.x0) > 12) suppressEdgeTapUntil = performance.now() + 350;
      phys.dragging = false;
      holds.forEach(q => { q.goal = 0; });
      const outside = phys.s < 0 ? -1 : phys.s > last ? 1 : 0;
      phys.s = rubber(phys.s);
      const idle = performance.now() - p.t;
      const vIdx = clamp(-(idle > 130 ? 0 : p.vx * Math.exp(-idle / 110)) * 1000 / p.spacing,-26,26);
      phys.v = vIdx;
      let next = clamp(Math.round(phys.s),0,last);
      if (!cancelled){
        // A throw is projected forward from its release speed, so a hard
        // flick travels several tickets and a gentle drag still steps one.
        // Faster throws carry disproportionately further, as on iOS.
        const throwReach = vIdx * .24 + Math.sign(vIdx) * Math.max(0,Math.abs(vIdx) - 4) * .1;
        const reach = phys.s + throwReach - p.base;
        const steps = Math.abs(reach) < .18 ? 0 : Math.min(8,Math.max(1,Math.round(Math.abs(reach))));
        const wanted = p.base + Math.sign(reach) * steps;
        next = clamp(wanted,0,last);
        if (wanted !== next || outside) phys.wall = wanted < 0 || outside < 0 ? -1 : 1;
        if (Math.abs(vIdx) > 7) Sound.cardDeal();
      }
      if (next === p.base && next === phys.target && !phys.wall && Math.abs(phys.s - next) < .03) phys.landed = true;
      commit(next);
      if (motionReduced()){ snap(); if (phys.wall) jolt(phys.wall); phys.wall = 0; return; }
      kick();
    };
    rack.addEventListener('pointerup',release);
    rack.addEventListener('pointercancel',event => release(event,true));
    rack.addEventListener('click',event => {
      if (event.target.closest('button') || performance.now()<suppressEdgeTapUntil) return;
      const x = event.clientX-rack.getBoundingClientRect().left;
      const edge = Math.max(36,Math.min(70,rack.clientWidth*.18));
      if (x<edge) move(-1);
      else if (x>rack.clientWidth-edge) move(1);
    });
    if (rackRaf) cancelAnimationFrame(rackRaf);
    rackRaf = 0;
    pointer = null;
    root.dataset.venue = all[current].key;
    cardStates(root,all,current);
    paint();
    record(false);
    window.clearInterval(recordTimer);
    recordTimer = window.setInterval(() => { if (!accepting && !document.getElementById('career')?.classList.contains('hidden')) { recordIndex = (recordIndex + 1) % 3; record(true); } },3200);
    window.clearTimeout(faceTimer);
    const faceBeat = () => {
      faceTimer = window.setTimeout(() => {
        const live = document.getElementById('career-hub');
        if (live && !accepting && !turning && !flipped && !motionReduced() && !document.getElementById('career')?.classList.contains('hidden')){
          const faces = [...live.querySelectorAll('.ch2-card.is-selected .ch2-face')];
          const face = faces[Math.floor(Math.random() * faces.length)];
          if (face){ face.classList.add('is-expressing'); window.setTimeout(() => face.classList.remove('is-expressing'),360); }
        }
        faceBeat();
      },3000 + Math.random() * 3600);
    };
    faceBeat();
  }

  function paintLiveBankroll(root,value){
    const reel = root.querySelector('#ch2-bankroll');
    if (!reel) return;
    const digits = String(Math.max(0,Math.floor(value || 0))).padStart(7,'0');
    const cells = [...reel.querySelectorAll('.jp-digit')];
    if (cells.length !== digits.length) reel.innerHTML = reelMarkup(value);
    else cells.forEach((cell,i) => {
      const faces = cell.querySelectorAll('.ch2-digit-strip > span');
      const next = digits[i];
      const previous = faces[1].textContent;
      cell.classList.toggle('is-leading',i < digits.length - String(Math.max(0,Math.floor(value || 0))).length);
      if (next === previous) return;
      faces[0].textContent = previous;
      faces[1].textContent = next;
      cell.classList.remove('is-turning');
      void cell.offsetWidth;
      cell.classList.add('is-turning');
    });
    reel.setAttribute('aria-label','Bankroll ' + amount(value));
  }

  function crt(root,labelA,valueA,labelB,valueB){
    root.querySelector('#ch2-crt-label-a').textContent = labelA;
    root.querySelector('#ch2-crt-value-a').textContent = valueA;
    root.querySelector('#ch2-crt-label-b').textContent = labelB;
    root.querySelector('#ch2-crt-value-b').textContent = valueB;
    const glass = root.querySelector('#ch2-crt-glass');
    if (!motionReduced()) crtBlink(glass);
  }

  /* The seat is accepted: lamps go green, the CRT confirms, and the machine
     rolls the table in. The launch is the real Career launch function. */
  function seatAndDepart(root,entry,launch){
    const button = root.querySelector('#ch2-primary');
    button.classList.add('is-seating');
    button.querySelectorAll('.pc-lamp').forEach(lamp => { lamp.classList.remove('is-amber'); lamp.classList.add('is-green'); });
    root.querySelector('#ch2-primary-main').textContent = entry.state === 'active' ? 'RESUMING' : 'SEAT ACCEPTED';
    root.querySelector('#ch2-primary-sub').textContent = entry.state === 'active' ? 'TABLE WAITING' : 'ENTRY PAID';
    crt(root,'NOW SEATING',entry.cash ? 'CASH TABLE' : entry.title,'ROOM',shortVenue(entry.venue));
    const done = () => {
      accepting = false;
      if (document.getElementById('table-screen')?.classList.contains('hidden')) renderCareerScreen();
    };
    Promise.resolve(depart(launch,{callout:entry.cash ? 'CASH TABLE' : entry.title})).then(done,done);
  }

  function accept(root,entry,flip){
    if (!entry || accepting || turning || !['available','active'].includes(entry.state)) return;
    root._settleRack?.();
    const button = root.querySelector('#ch2-primary');
    const backButton = document.getElementById('career-back');
    if (entry.state === 'active'){
      const launch = entry.cash ? startCareerCashSession : continueCareerEvent;
      if (motionReduced()){ launch(); return; }
      accepting = true;
      if (backButton) backButton.disabled = true;
      button.disabled = true;
      button.classList.add('is-entry-pressed');
      // Played on finger-down by press-feel.js; only a key/programmatic
      // press still needs it here.
      if (typeof pressFeelSounded !== 'function' || !pressFeelSounded(button)) Sound.buttonPress('allin');
      queue(() => button.classList.remove('is-entry-pressed'),115);
      queue(() => { Sound.buttonRelease('award'); seatAndDepart(root,entry,launch); },120);
      return;
    }
    const price = entry.cash ? CAREER_CASH_CONFIG.buyIn : entry.event.buyIn;
    const confirm = () => {
      if (entry.cash ? !careerCanOpenCash() : !careerCanEnterEvent(entry.id)) { renderCareerScreen(); return; }
      accepting = true;
      if (backButton) backButton.disabled = true;
      button.disabled = true;
      button.classList.add('is-entry-pressed');
      const startBankroll = careerBankroll();
      const launch = entry.cash ? startCareerCashSession : startCareerEvent;
      if (flipped) { flipped = false; root.querySelector('.ch2-card.is-selected').classList.remove('is-flipped'); }
      const timers = [];
      const later = (fn,ms) => { timers.push(window.setTimeout(fn,ms)); };
      const charge = () => {
        const accepted = entry.cash ? openCareerCashSession() : enterCareerEvent(entry.id);
        if (!accepted){ accepting = false; if (backButton) backButton.disabled = false; renderCareerScreen(); return false; }
        return true;
      };
      if (motionReduced()) {
        if (!charge()) return;
        accepting = false;
        launch();
        return;
      }
      // Played on finger-down by press-feel.js; only a key/programmatic
      // press still needs it here.
      if (typeof pressFeelSounded !== 'function' || !pressFeelSounded(button)) Sound.buttonPress('allin');
      haptic(16);
      later(() => button.classList.remove('is-entry-pressed'),115);
      // Optional replacement feed animation (js/ticket-feed.js, Lab only
      // for now). It gets the same charge/depart steps, so the money path
      // stays here; absent that file, the feed below runs unchanged.
      if (typeof careerTicketFeed === 'function'){
        careerTicketFeed({
          root, card:root.querySelector('.ch2-card.is-selected'), charge, startBankroll,
          paintBankroll:value => paintLiveBankroll(root,value),
          depart:instant => { if (instant){ accepting = false; launch(); } else seatAndDepart(root,entry,launch); }
        });
        return;
      }
      const selectedCard = root.querySelector('.ch2-card.is-selected');
      const cardRect = selectedCard.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const intake = root.querySelector('#ch2-intake').getBoundingClientRect();
      const ticket = selectedCard.cloneNode(true);
      ticket.classList.add('ch2-entry-ticket');
      ticket.setAttribute('aria-hidden','true');
      ticket.querySelectorAll('button').forEach(b => b.tabIndex = -1);
      ticket.style.left = cardRect.left - rootRect.left + 'px';
      ticket.style.top = cardRect.top - rootRect.top + 'px';
      ticket.style.width = cardRect.width + 'px';
      ticket.style.height = cardRect.height + 'px';
      ticket.style.setProperty('--entry-distance',intake.top - cardRect.top - 3 + 'px');
      root.appendChild(ticket);
      selectedCard.classList.add('is-feeding');
      root.classList.add('is-accepting');
      // The intake ratchets the ticket down and bites.
      [110,240,370,500].forEach((ms,i) => later(() => Sound.stageRollClick(.3 + i * .2,false),ms));
      later(() => { Sound.hatchClose(); haptic(12); },640);

      let skippable = false, finished = false;
      const endBankroll = () => careerBankroll();
      const tidy = () => {
        ticket.remove();
        selectedCard.classList.remove('is-feeding');
        root.classList.remove('is-accepting','is-stamped');
        paintLiveBankroll(root,endBankroll());
        root.querySelector('#ch2-bankroll').setAttribute('aria-live','polite');
      };
      const finish = instant => {
        if (finished) return;
        finished = true;
        root.removeEventListener('pointerdown',skip,true);
        timers.forEach(timer => window.clearTimeout(timer));
        tidy();
        if (instant){ accepting = false; launch(); }
        else seatAndDepart(root,entry,launch);
      };
      // Once the money has moved, a tap goes straight to the table.
      const skip = event => {
        if (!skippable) return;
        event.preventDefault();
        event.stopPropagation();
        swallowNextClick();
        finish(true);
      };
      root.addEventListener('pointerdown',skip,true);

      later(() => {
        if (!charge()){ finished = true; root.removeEventListener('pointerdown',skip,true); timers.forEach(timer => window.clearTimeout(timer)); return; }
        skippable = true;
        const end = endBankroll();
        const change = Math.max(0,startBankroll - end);
        const step = change <= 100 ? 10 : change <= 300 ? 20 : Math.max(50,Math.ceil(change / 12 / 10) * 10);
        const ticks = Math.max(1,Math.ceil(change / step));
        root.querySelector('#ch2-bankroll').setAttribute('aria-live','off');
        for (let n = 1; n <= ticks; n++) later(() => {
          paintLiveBankroll(root,Math.max(end,startBankroll - n * step));
          Sound.counterTick(true);
        },35 + n * Math.max(35,Math.min(75,470 / ticks)));
        later(() => paintLiveBankroll(root,end),580);
        selectedCard.classList.add('is-paid');
        ticket.classList.add('is-paid','is-returning');
        root.querySelector('.ch2-bankroll-housing').classList.add('is-payment');
        // The ENTRY PAID stamp lands as the ticket clears the intake.
        later(() => {
          Sound.koThunk(1.15);
          haptic([10,8,26]);
          root.classList.remove('is-stamped'); void root.offsetWidth; root.classList.add('is-stamped');
        },430);
      },710);
      later(tidy,1250);
      later(() => { Sound.buttonRelease('award'); haptic(20); finish(false); },1330);
    };
    if (entry.cash && careerBankroll() < CAREER_CASH_CONFIG.buyIn * 3){
      showConfirmDialog({title:'Take a bankroll shot?',body:'This $50 buy-in leaves ' + amount(careerBankroll() - price) + ' available. Your remaining table stack can be cashed out between hands.',confirmLabel:'Buy In',danger:false,onConfirm:confirm});
    } else if (!entry.cash && price > 0 && careerRiskBand(entry.event) === 'risky'){
      showConfirmDialog({title:'Take a bankroll shot?',body:'This ' + amount(price) + ' entry leaves ' + amount(careerBankroll() - price) + ' available. Permanent room access is never lost.',confirmLabel:'Enter Event',danger:false,onConfirm:confirm});
    } else confirm();
  }

  const originalRender = renderCareerScreen;
  renderCareerScreen = function(){
    originalRender();
    const board = document.getElementById('career-events');
    if (board) mount(board);
  };
})();
