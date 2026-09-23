/* Career Hub V2 Lab
   Deliberately isolated: no production JavaScript, save access, localStorage,
   Career transaction or navigation call is made from this file. Catalogue
   values and portrait paths mirror the live game as disposable fixtures. */
(() => {
  'use strict';

  const FACES = [
    { name:'Harry', src:'assets/faces/red-sly01.PNG', expression:'assets/faces/red-thinking01.PNG' },
    { name:'Tony', src:'assets/faces/yellow-thinking01.PNG', expression:'assets/faces/yellow-thinking02.PNG' },
    { name:'Lucy', src:'assets/faces/purple-sly01.PNG', expression:'assets/faces/purple-thinking01.PNG' },
    { name:'Nigel', src:'assets/faces/blue-thinking01.PNG', expression:'assets/faces/blue-thinking02.PNG' },
    { name:'Steve', src:'assets/faces/red-gloating01.PNG', expression:'assets/faces/red-tilted01.PNG' }
  ];
  const EVENTS = [
    { id:'back-room-cash', venueKey:'backroom', venue:'BACK ROOM', title:'CASH TABLE', headline:'$1 / $2 CASH', buyIn:50, players:4, format:'NO-RAKE CASH TABLE', formatNote:'Play one hand at a time. Leave and cash out between hands.', stack:50, paceLabel:'BLINDS', paceValue:'$1 / $2 FIXED', payoutLabel:'TABLE RULE', payout:'CASH OUT BETWEEN HANDS', difficulty:'MODERATE', opponents:3, state:'available' },
    { id:'back-room-3-hand', venueKey:'backroom', venue:'BACK ROOM', title:'3-HAND', headline:'$300 PRIZE', buyIn:100, players:3, format:'3-PLAYER FREEZEOUT', formatNote:'One life. Last player standing wins the prize.', stack:500, paceLabel:'BLINDS RISE', paceValue:'10 HANDS', payoutLabel:'PRIZE', payout:'$300 TO 1ST', difficulty:'MODERATE', opponents:2, state:'completed' },
    { id:'back-room-heads-up', venueKey:'backroom', venue:'BACK ROOM', title:'HEADS-UP', headline:'$200 PRIZE', buyIn:100, players:2, format:'HEADS-UP FREEZEOUT', formatNote:'One opponent. One life. Winner takes all.', stack:600, paceLabel:'BLINDS RISE', paceValue:'8 HANDS', payoutLabel:'PRIZE', payout:'$200 TO 1ST', difficulty:'MODERATE', opponents:1, state:'available' },
    { id:'pub-turbo', venueKey:'pub', venue:'PUB CIRCUIT', title:'TURBO', headline:'$1,200 PRIZE', buyIn:300, players:4, format:'4-PLAYER TURBO', formatNote:'One life. Fast blind pressure. Winner takes all.', stack:600, paceLabel:'BLINDS RISE', paceValue:'6 HANDS', payoutLabel:'PRIZE', payout:'$1,200 TO 1ST', difficulty:'SERIOUS', opponents:3, state:'locked', requirement:'WIN A BACK ROOM EVENT' },
    { id:'card-club-deep', venueKey:'cardclub', venue:'CARD CLUB', title:'DEEP STACK', headline:'$4,000 PRIZE', buyIn:1000, players:4, format:'4-PLAYER DEEP STACK', formatNote:'One life. More starting money and more room to play.', stack:1500, paceLabel:'BLINDS RISE', paceValue:'12 HANDS', payoutLabel:'PRIZE', payout:'$4,000 TO 1ST', difficulty:'SHARP', opponents:3, state:'locked', requirement:'WIN A PUB CIRCUIT EVENT' },
    { id:'casino-main', venueKey:'casino', venue:'CASINO FLOOR', title:'MAIN EVENT', headline:'$9,000 TOP PRIZE', buyIn:3000, players:6, format:'6-PLAYER TOP-3', formatNote:'One life. Three places pay; first place advances.', stack:1200, paceLabel:'BLINDS RISE', paceValue:'10 HANDS', payoutLabel:'PAYOUTS', payout:'$9K · $6K · $3K', difficulty:'EXPERT', opponents:5, state:'locked', requirement:'WIN A CARD CLUB EVENT' },
    { id:'high-roller-feature', venueKey:'highroller', venue:'HIGH ROLLER', title:'FEATURE TABLE', headline:'$40,000 PRIZE', buyIn:10000, players:4, format:'4-PLAYER DEEP STACK', formatNote:'One life. Deep stacks against an elite field.', stack:2000, paceLabel:'BLINDS RISE', paceValue:'12 HANDS', payoutLabel:'PRIZE', payout:'$40,000 TO 1ST', difficulty:'ELITE', opponents:3, state:'locked', requirement:'WIN A CASINO FLOOR EVENT' },
    { id:'invitational-final', venueKey:'invitational', venue:'INVITATIONAL', title:'THE FINAL', headline:'$100,000 TOP PRIZE', buyIn:30000, players:6, format:'6-PLAYER CHAMPIONSHIP', formatNote:'One life. Three paid places at the final table.', stack:2400, paceLabel:'BLINDS RISE', paceValue:'12 HANDS', payoutLabel:'PAYOUTS', payout:'$100K · $50K · $30K', difficulty:'CHAMPIONSHIP', opponents:5, state:'locked', requirement:'WIN A HIGH ROLLER EVENT' }
  ];
  const RECORD_CHANNELS = [
    [{ label:'GAMES PLAYED', value:'014' }, { label:'GAMES WON', value:'005' }],
    [{ label:'GAMES LOST', value:'009' }, { label:'WIN RATE', value:'36%' }],
    [{ label:'HANDS PLAYED', value:'286' }, { label:'HAND WIN RATE', value:'42%' }],
    [{ label:'BIGGEST POT', value:'$530' }, { label:'BEST HAND', value:'FLUSH' }]
  ];

  const machine = document.getElementById('home');
  const track = document.getElementById('ch2-track');
  const rack = document.getElementById('ch2-rack');
  const primary = document.getElementById('ch2-primary');
  const mainCopy = document.getElementById('ch2-primary-main');
  const subCopy = document.getElementById('ch2-primary-sub');
  const bankrollEl = document.getElementById('ch2-bankroll');
  const recordEl = document.getElementById('ch2-record');
  const crtGlass = document.getElementById('ch2-crt-glass');
  const crtLabelA = document.getElementById('ch2-crt-label-a');
  const crtValueA = document.getElementById('ch2-crt-value-a');
  const crtLabelB = document.getElementById('ch2-crt-label-b');
  const crtValueB = document.getElementById('ch2-crt-value-b');
  const labPanel = document.getElementById('ch2-lab-panel');
  const labToggle = document.getElementById('ch2-lab-toggle');
  const eventSelect = document.getElementById('ch2-event-select');
  const bankrollSelect = document.getElementById('ch2-bankroll-select');
  const intake = document.getElementById('ch2-intake');
  const bankrollHousing = document.querySelector('.ch2-bankroll-housing');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.getElementById('ch2-motion');

  const state = {
    index:0, forcedState:'auto', bankroll:500, paid:false, accepting:false, flipped:false,
    pointerId:null, startX:0, lastX:0, lastTime:0, velocity:0, dragX:0,
    reducedMotion:motionPreference.matches, recordIndex:0, recordTimer:null, turning:false, turnTimer:null,
    faceTimer:null, faceRestTimer:null, entryTimers:[], entryTicket:null
  };

  if (new URLSearchParams(location.search).has('lab')) document.body.classList.add('ch2-lab-enabled');
  else labToggle.hidden = true;
  if (state.reducedMotion) document.documentElement.dataset.motion = 'off';

  const money = value => '$' + Number(value).toLocaleString('en-US');
  const selectedEvent = () => EVENTS[state.index];
  const selectedState = () => state.paid ? 'paid' : (state.forcedState === 'auto' ? selectedEvent().state : state.forcedState);
  FACES.forEach(face => { const preload = new Image(); preload.src = face.expression; });

  function portraitHTML(face, locked) {
    return `<span class="ch2-face${locked ? ' is-hidden' : ''}"><img src="${face.src}" data-rest="${face.src}" data-expression="${face.expression}" alt="${locked ? '' : face.name}" draggable="false"><b>${locked ? '?' : face.name}</b></span>`;
  }

  function restoreFaces() {
    window.clearTimeout(state.faceRestTimer);
    track.querySelectorAll('.ch2-face img.is-expressing').forEach(img => {
      img.src = img.dataset.rest;
      img.classList.remove('is-expressing');
    });
  }

  function scheduleFaces() {
    window.clearTimeout(state.faceTimer);
    state.faceTimer = window.setTimeout(() => {
      const visible = track.querySelector('.ch2-card.is-selected');
      const mode = selectedState();
      if (!state.reducedMotion && !state.accepting && !state.turning && !state.flipped &&
          !track.classList.contains('is-dragging') && (mode === 'available' || mode === 'completed')) {
        const faces = [...visible.querySelectorAll('.ch2-card-front .ch2-face:not(.is-hidden) img')];
        const img = faces[Math.floor(Math.random() * faces.length)];
        if (img) {
          img.src = img.dataset.expression;
          img.classList.add('is-expressing');
          state.faceRestTimer = window.setTimeout(() => {
            img.src = img.dataset.rest;
            img.classList.remove('is-expressing');
          }, 360);
        }
      }
      scheduleFaces();
    }, 3000 + Math.random() * 3600);
  }

  function cardHTML(event, index) {
    const faces = Array.from({length:event.opponents}, (_, i) => portraitHTML(FACES[(index + i) % FACES.length], false)).join('');
    const facts = [
      ['STARTING STACK', money(event.stack)],
      [event.paceLabel, event.paceValue],
      ['TABLE', `${event.players} PLAYERS`],
      ['THREAT', event.difficulty]
    ].map(pair => `<span class="ch2-brief-row${String(pair[1]).length > 11 ? ' is-long' : ''}"><small>${pair[0]}</small><strong>${pair[1]}</strong></span>`).join('');
    const payoutAmounts = event.payoutLabel === 'PAYOUTS' ? event.payout.match(/\$[\d,]+K?/g) : null;
    const payout = payoutAmounts
      ? `<div class="ch2-payout-places">${payoutAmounts.map((amount, place) => `<span><small>${['1ST','2ND','3RD'][place]}</small><b>${amount}</b></span>`).join('')}</div>`
      : `<strong>${event.payout}</strong>`;

    return `<article class="ch2-card" data-index="${index}" data-venue="${event.venueKey}" role="option" aria-label="${event.venue}, ${event.title}">
      <div class="ch2-card-inner">
        <section class="ch2-card-face ch2-card-front ch2-paper opponents-${event.opponents}">
          <header class="ch2-card-venue">${event.venue}</header>
          <h2>${event.title}</h2>
          <div class="ch2-headline">${event.headline}</div>
          <div class="ch2-card-stats">
            <span><small>BUY-IN</small><strong>${event.buyIn ? money(event.buyIn) : 'FREE'}</strong></span>
            <span><small>PLAYERS</small><strong>${event.players}</strong></span>
          </div>
          <div class="ch2-opponent-stage"><span class="ch2-stage-label">YOUR TABLE</span><div class="ch2-opponents">${faces}</div></div>
          <div class="ch2-stamp ch2-stamp-lock">LOCKED</div>
          <div class="ch2-stamp ch2-stamp-complete">COMPLETED</div>
          <div class="ch2-stamp ch2-stamp-paid">ENTRY PAID</div>
          <div class="ch2-requirement"></div>
          <button class="pc-button ch2-card-flip" type="button" data-card-flip="back">DETAILS</button>
        </section>
        <section class="ch2-card-face ch2-card-back ch2-paper" aria-hidden="true">
          <header class="ch2-card-venue">${event.venue}</header>
          <div class="ch2-back-title"><h2>${event.title}</h2></div>
          <div class="ch2-format-brief"><small>FORMAT</small><strong>${event.format}</strong><p>${event.formatNote}</p></div>
          <div class="ch2-brief-list">${facts}</div>
          <div class="ch2-back-hero"><small>${event.payoutLabel}</small>${payout}</div>
          <div class="ch2-back-entry"><span><small>BUY-IN</small><strong>${money(event.buyIn)}</strong></span><b>${event.requirement || 'OPEN TO YOU NOW'}</b></div>
          <button class="pc-button ch2-card-flip" type="button" data-card-flip="front">EVENT</button>
        </section>
      </div>
    </article>`;
  }

  function build() {
    track.innerHTML = EVENTS.map(cardHTML).join('');
    eventSelect.innerHTML = EVENTS.map((event, index) => `<option value="${index}">${event.venue} · ${event.title}</option>`).join('');
    document.querySelector('[data-state="auto"]').setAttribute('aria-pressed', 'true');
    render(true);
  }

  function paintBankroll(amount, rolling = false) {
    const digits = String(Math.max(0, Math.floor(Number(amount) || 0))).padStart(7, '0').slice(-7);
    const previous = bankrollEl.dataset.current || digits;
    const firstLive = Math.max(0, digits.length - String(Math.max(0, Math.floor(Number(amount) || 0))).length);
    bankrollEl.innerHTML = '<span class="jp-cell jp-sym">$</span>' + digits.split('').map((digit, index) =>
      `<span class="jp-cell jp-digit tabular${index < firstLive ? ' is-leading' : ''}${rolling && previous[index] !== digit ? ' is-turning' : ''}" style="--roll-delay:${(6 - index) * 28}ms"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${rolling ? previous[index] : digit}</span><span>${digit}</span></span></span></span>`
    ).join('');
    bankrollEl.dataset.current = digits;
    bankrollEl.dataset.cells = '8';
    bankrollEl.setAttribute('aria-label', `Bankroll ${money(amount)}`);
    bankrollEl.classList.toggle('is-rolling', rolling);
  }

  function renderRecord(animate = true) {
    const channel = RECORD_CHANNELS[state.recordIndex];
    if (animate && !state.reducedMotion) {
      crtGlass.classList.remove('crt-refresh');
      void crtGlass.offsetWidth;
      crtGlass.classList.add('crt-refresh');
      window.setTimeout(() => crtGlass.classList.remove('crt-refresh'), 250);
    }
    crtLabelA.textContent = channel[0].label;
    crtValueA.textContent = channel[0].value;
    crtLabelB.textContent = channel[1].label;
    crtValueB.textContent = channel[1].value;
    recordEl.setAttribute('aria-label', `${channel[0].label} ${channel[0].value}. ${channel[1].label} ${channel[1].value}. Tap for next statistics`);
  }

  function advanceRecord() {
    state.recordIndex = (state.recordIndex + 1) % RECORD_CHANNELS.length;
    renderRecord();
  }

  function tactile(pattern = 8) {
    if (!state.reducedMotion && navigator.vibrate) navigator.vibrate(pattern);
  }

  function scheduleRecord() {
    window.clearInterval(state.recordTimer);
    state.recordTimer = window.setInterval(() => { if (!state.accepting) advanceRecord(); }, 3200);
  }

  function cardState(card, event, index) {
    card.classList.remove('is-selected','is-near','is-far','is-left','is-right','is-available','is-locked','is-completed','is-paid','is-flipped');
    const delta = index - state.index;
    const abs = Math.abs(delta);
    const currentState = index === state.index ? selectedState() : event.state;
    card.classList.add(`is-${currentState}`);
    card.classList.toggle('is-selected', delta === 0);
    card.classList.toggle('is-near', abs === 1);
    card.classList.toggle('is-far', abs > 1);
    card.classList.toggle('is-left', delta < 0);
    card.classList.toggle('is-right', delta > 0);
    card.classList.toggle('is-flipped', delta === 0 && state.flipped);
    card.setAttribute('aria-selected', String(delta === 0));
    card.tabIndex = delta === 0 ? 0 : -1;

    let x = 0, y = 10, scale = 1, z = 30;
    if (abs === 1) { x = Math.sign(delta) * 91; y = 22; scale = .94; z = 18; }
    if (abs > 1) { x = Math.sign(delta) * 118; y = 28; scale = .9; z = 1; }
    card.style.setProperty('--card-x', `${x}%`);
    card.style.setProperty('--card-y', `${y}px`);
    card.style.setProperty('--card-scale', scale);
    card.style.zIndex = String(z);

    const req = card.querySelector('.ch2-requirement');
    req.textContent = currentState === 'locked' ? (event.requirement || 'WIN THE PREVIOUS VENUE') : '';
    card.querySelectorAll('.ch2-face').forEach(face => face.classList.toggle('is-hidden', currentState === 'locked'));
    card.querySelector('.ch2-card-front').setAttribute('aria-hidden', String(delta === 0 && state.flipped));
    card.querySelector('.ch2-card-back').setAttribute('aria-hidden', String(!(delta === 0 && state.flipped)));
    card.querySelector('[data-card-flip="back"]').tabIndex = delta === 0 && !state.flipped ? 0 : -1;
    card.querySelector('[data-card-flip="front"]').tabIndex = delta === 0 && state.flipped ? 0 : -1;
  }

  function render(initial = false) {
    const event = selectedEvent();
    machine.dataset.venue = event.venueKey;
    track.querySelectorAll('.ch2-card').forEach((card, index) => cardState(card, EVENTS[index], index));
    eventSelect.value = String(state.index);
    paintBankroll(state.bankroll);

    const mode = selectedState();
    const unaffordable = (mode === 'available' || mode === 'completed') && state.bankroll < event.buyIn;
    primary.disabled = mode === 'locked' || mode === 'paid' || unaffordable || state.accepting;
    primary.classList.remove('is-available','is-locked','is-completed','is-paid','is-unaffordable');
    primary.classList.add(unaffordable ? 'is-unaffordable' : `is-${mode}`);
    if (mode === 'locked') {
      mainCopy.textContent = 'LOCKED';
      subCopy.textContent = 'EVENT UNAVAILABLE';
    } else if (mode === 'paid') {
      mainCopy.textContent = 'SEAT ACCEPTED';
      subCopy.textContent = '';
    } else if (unaffordable) {
      mainCopy.textContent = 'BANKROLL LOW';
      subCopy.textContent = `${money(event.buyIn - state.bankroll)} SHORT`;
    } else {
      mainCopy.textContent = `BUY IN ${money(event.buyIn)}`;
      subCopy.textContent = 'TAKE SEAT';
    }
    if (!initial) rack.setAttribute('aria-label', `${event.venue}, ${event.title}, ${mode}`);
  }

  function select(index, direction = 0) {
    if (state.accepting) return;
    const next = Math.max(0, Math.min(EVENTS.length - 1, index));
    if (next === state.index) return;
    state.index = next;
    rack.scrollLeft = 0;
    restoreFaces();
    state.paid = false;
    state.accepting = false;
    state.flipped = false;
    state.turning = false;
    window.clearTimeout(state.turnTimer);
    track.querySelectorAll('.ch2-card').forEach(card => card.classList.remove('is-turning-back','is-turning-front'));
    rack.classList.remove('is-turning');
    track.classList.remove('is-dragging','is-settling');
    void track.offsetWidth;
    track.classList.add('is-settling');
    track.style.setProperty('--drag-x', `${direction * -10}px`);
    requestAnimationFrame(() => track.style.setProperty('--drag-x', '0px'));
    window.setTimeout(() => track.classList.remove('is-settling'), state.reducedMotion ? 0 : 270);
    tactile(6);
    render();
  }

  function onPointerDown(event) {
    if (state.accepting || state.turning || event.button > 0 || event.target.closest('.ch2-card-flip,.ch2-arrow')) return;
    state.pointerId = event.pointerId;
    state.startX = state.lastX = event.clientX;
    state.lastTime = performance.now();
    state.velocity = 0;
    state.dragX = 0;
    rack.setPointerCapture(event.pointerId);
    track.classList.remove('is-settling');
    track.classList.add('is-dragging');
  }

  function onPointerMove(event) {
    if (event.pointerId !== state.pointerId) return;
    const now = performance.now();
    const dx = event.clientX - state.lastX;
    const dt = Math.max(8, now - state.lastTime);
    state.velocity = state.velocity * .55 + (dx / dt) * .45;
    state.dragX = Math.max(-125, Math.min(125, event.clientX - state.startX));
    state.lastX = event.clientX;
    state.lastTime = now;
    track.style.setProperty('--drag-x', `${state.dragX}px`);
  }

  function onPointerUp(event) {
    if (event.pointerId !== state.pointerId) return;
    const projected = state.dragX + state.velocity * 105;
    const direction = projected < -48 ? 1 : projected > 48 ? -1 : 0;
    state.pointerId = null;
    track.classList.remove('is-dragging');
    if (direction) select(state.index + direction, direction);
    else {
      track.classList.add('is-settling');
      track.style.setProperty('--drag-x', '0px');
      window.setTimeout(() => track.classList.remove('is-settling'), state.reducedMotion ? 0 : 220);
    }
  }

  function flipSelected(showBack) {
    if (state.accepting || state.turning) return;
    rack.scrollLeft = 0;
    restoreFaces();
    const selected = track.querySelector('.ch2-card.is-selected');
    const turnClass = showBack ? 'is-turning-back' : 'is-turning-front';
    selected.classList.remove('is-turning-back','is-turning-front');
    void selected.offsetWidth;
    selected.classList.add(turnClass);
    rack.classList.add('is-turning');
    state.turning = true;
    state.flipped = showBack;
    tactile(7);
    render();
    state.turnTimer = window.setTimeout(() => {
      selected.classList.remove(turnClass);
      rack.classList.remove('is-turning');
      state.turning = false;
      selected.querySelector(`[data-card-flip="${showBack ? 'front' : 'back'}"]`)?.focus();
    }, state.reducedMotion ? 0 : 640);
  }

  function runEntry() {
    const event = selectedEvent();
    if (state.accepting || state.turning || primary.disabled || selectedState() === 'locked' || state.bankroll < event.buyIn) return;
    if (state.reducedMotion) {
      state.bankroll -= event.buyIn;
      state.flipped = false;
      state.paid = true;
      render();
      return;
    }
    restoreFaces();
    window.clearInterval(state.recordTimer);
    tactile([9,28,12]);
    const queue = (callback, delay) => state.entryTimers.push(window.setTimeout(callback, state.reducedMotion ? 0 : delay));
    const openingBankroll = state.bankroll;
    const closingBankroll = openingBankroll - event.buyIn;

    const countDown = () => {
      const change = openingBankroll - closingBankroll;
      const step = change <= 100 ? 10 : change <= 300 ? 20 : Math.max(50, Math.ceil(change / 12 / 10) * 10);
      const ticks = Math.max(1, Math.ceil(change / step));
      bankrollEl.setAttribute('aria-live', 'off');
      for (let tick = 1; tick <= ticks; tick++) {
        queue(() => paintBankroll(Math.max(closingBankroll, openingBankroll - tick * step)), 35 + tick * Math.max(35, Math.min(75, 470 / ticks)));
      }
    };

    const feed = () => {
      const selectedCard = track.querySelector('.ch2-card.is-selected');
      const cardRect = selectedCard.getBoundingClientRect();
      const machineRect = machine.getBoundingClientRect();
      const intakeRect = intake.getBoundingClientRect();
      const ticket = selectedCard.cloneNode(true);
      ticket.classList.remove('is-turning-back','is-turning-front','is-flipped');
      ticket.classList.add('ch2-entry-ticket');
      ticket.setAttribute('aria-hidden','true');
      ticket.querySelectorAll('button').forEach(button => { button.tabIndex = -1; });
      ticket.style.left = `${cardRect.left - machineRect.left}px`;
      ticket.style.top = `${cardRect.top - machineRect.top}px`;
      ticket.style.width = `${cardRect.width}px`;
      ticket.style.height = `${cardRect.height}px`;
      ticket.style.setProperty('--entry-distance', `${intakeRect.top - cardRect.top - 3}px`);
      machine.appendChild(ticket);
      state.entryTicket = ticket;
      selectedCard.classList.add('is-feeding');
      selectedCard.setAttribute('aria-hidden','true');
      machine.classList.add('is-accepting');
      primary.classList.add('is-entry-pressed');
      queue(() => primary.classList.remove('is-entry-pressed'), 115);

      queue(() => {
        ticket.classList.add('is-paid','is-returning');
        bankrollHousing.classList.add('is-payment');
        countDown();
      }, 710);
      queue(() => {
        state.bankroll = closingBankroll;
        bankrollEl.setAttribute('aria-live', 'polite');
        selectedCard.classList.remove('is-feeding');
        selectedCard.removeAttribute('aria-hidden');
        ticket.remove();
        state.entryTicket = null;
        state.paid = true;
        state.accepting = false;
        machine.classList.remove('is-accepting');
        bankrollHousing.classList.remove('is-payment');
        primary.classList.remove('is-entry-pressed');
        render();
        scheduleRecord();
      }, 1270);
    };

    if (state.flipped) {
      flipSelected(false);
      state.accepting = true;
      primary.disabled = true;
      queue(feed, 650);
    } else {
      state.accepting = true;
      primary.disabled = true;
      feed();
    }
  }

  function resetEntry() {
    state.entryTimers.forEach(window.clearTimeout);
    state.entryTimers = [];
    state.entryTicket?.remove();
    state.entryTicket = null;
    machine.classList.remove('is-accepting','menu-launching');
    bankrollHousing.classList.remove('is-payment');
    restoreFaces();
    state.paid = false;
    state.accepting = false;
    state.flipped = false;
    state.turning = false;
    window.clearTimeout(state.turnTimer);
    state.bankroll = Number(bankrollSelect.value);
    bankrollEl.setAttribute('aria-live', 'polite');
    primary.classList.remove('is-entry-pressed');
    machine.classList.remove('menu-launching');
    track.querySelectorAll('.ch2-card').forEach(card => {
      card.classList.remove('is-accepted','is-feeding','is-turning-back','is-turning-front');
      card.removeAttribute('aria-hidden');
    });
    rack.classList.remove('is-turning');
    render();
    scheduleRecord();
  }

  document.getElementById('ch2-prev').addEventListener('click', () => select(state.index - 1, -1));
  document.getElementById('ch2-next').addEventListener('click', () => select(state.index + 1, 1));
  rack.addEventListener('pointerdown', onPointerDown);
  rack.addEventListener('pointermove', onPointerMove);
  rack.addEventListener('pointerup', onPointerUp);
  rack.addEventListener('pointercancel', onPointerUp);
  track.addEventListener('click', event => {
    const control = event.target.closest('[data-card-flip]');
    if (control) flipSelected(control.dataset.cardFlip === 'back');
  });
  primary.addEventListener('click', runEntry);
  recordEl.addEventListener('click', () => { if (state.accepting) return; tactile(5); advanceRecord(); scheduleRecord(); });
  document.getElementById('ch2-reset').addEventListener('click', resetEntry);

  labToggle.addEventListener('click', () => {
    const open = labPanel.hidden;
    labPanel.hidden = !open;
    labToggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('[data-state]').forEach(button => button.addEventListener('click', () => {
    if (state.accepting) return;
    state.forcedState = button.dataset.state;
    state.paid = false;
    document.querySelectorAll('[data-state]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  }));
  eventSelect.addEventListener('change', () => select(Number(eventSelect.value)));
  bankrollSelect.addEventListener('change', () => { if (state.accepting) return; state.bankroll = Number(bankrollSelect.value); state.paid = false; render(); });
  motionToggle.addEventListener('change', event => {
    state.reducedMotion = event.target.checked || motionPreference.matches;
    document.documentElement.dataset.motion = state.reducedMotion ? 'off' : 'on';
    if (state.reducedMotion) restoreFaces();
    renderRecord(false);
  });
  motionPreference.addEventListener('change', () => {
    state.reducedMotion = motionToggle.checked || motionPreference.matches;
    document.documentElement.dataset.motion = state.reducedMotion ? 'off' : 'on';
    if (state.reducedMotion) restoreFaces();
    renderRecord(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') select(state.index - 1, -1);
    if (event.key === 'ArrowRight') select(state.index + 1, 1);
    if (event.key === 'Escape' && state.flipped) flipSelected(false);
  });

  build();
  renderRecord(false);
  scheduleRecord();
  scheduleFaces();
})();
