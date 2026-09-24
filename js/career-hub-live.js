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
  const shortVenue = venue => venue.replace(' CHAMPIONSHIP','').replace('HIGH ROLLER ROOM','HIGH ROLLER');
  const depart = launch => typeof careerDepartToTable === 'function' ? careerDepartToTable(launch) : launch();
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
    if (showBlink && !motionReduced()) { glass.classList.remove('crt-refresh'); void glass.offsetWidth; glass.classList.add('crt-refresh'); }
  }

  function cardStates(root, all, current){
    const rack = root.querySelector('#ch2-rack');
    rack.scrollLeft = 0;
    root.dataset.venue = all[current].key;
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
      node.style.setProperty('--card-x',(abs ? Math.sign(delta) * (abs === 1 ? 91 : 118) : 0) + '%');
      node.style.setProperty('--card-y',(abs ? abs === 1 ? 22 : 28 : 10) + 'px');
      node.style.setProperty('--card-scale',abs ? abs === 1 ? '.94' : '.9' : '1');
      node.style.zIndex = String(abs ? abs === 1 ? 18 : 1 : 30);
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
      '<header class="ch2-instrument"><div class="ch2-utility-row"><span class="pc-label ch2-instrument-title">Bankroll</span></div>' +
      '<div class="ch2-money-block"><div class="cpi-bankroll-housing ch2-bankroll-housing"><div class="amt-readout ch2-bankroll-reel" id="ch2-bankroll" role="img" aria-live="polite" aria-label="Bankroll ' + esc(amount(bank)) + '" style="grid-template-columns:21px repeat(' + Math.max(7,String(bank).length) + ',minmax(12px,1fr))">' + reelMarkup(bank) + '</div></div></div>' +
      '<button class="ch2-record crt" id="ch2-record" type="button"><span class="ch2-crt-glass crt__content" id="ch2-crt-glass"><span class="ch2-crt-stat"><small id="ch2-crt-label-a"></small><strong class="tabular" id="ch2-crt-value-a"></strong></span><span class="ch2-crt-stat"><small id="ch2-crt-label-b"></small><strong class="tabular" id="ch2-crt-value-b"></strong></span></span></button></header>' +
      '<section class="ch2-reader" aria-label="Career event browser"><div class="ch2-rack" id="ch2-rack"><div class="ch2-track" id="ch2-track" role="listbox" tabindex="0" aria-label="Career events. Swipe, tap an exposed ticket edge, or use left and right arrow keys">' + all.map(card).join('') + '</div></div></section>' +
      '<div class="ch2-intake" id="ch2-intake" aria-hidden="true"><span class="ch2-intake-mouth"></span></div>' +
      '<div class="pc-primary-cradle ch2-action-cradle"><span class="pc-slot-aperture" aria-hidden="true"><span class="pc-slot-door"></span></span><button class="pc-button pc-button-primary ch2-primary" id="ch2-primary" type="button"><span class="pc-lamp is-amber" aria-hidden="true"></span><span><strong id="ch2-primary-main"></strong><small id="ch2-primary-sub"></small></span><span class="pc-lamp is-amber" aria-hidden="true"></span></button></div>' +
      '</main>';
    const root = board.querySelector('#career-hub');
    const head = board.closest('.lobby-card')?.querySelector('.setup-head');
    if (head){
      head.querySelector('#ch2-secondary')?.remove();
      const secondary = document.createElement('button');
      secondary.id = 'ch2-secondary';
      secondary.className = 'ch2-secondary';
      secondary.type = 'button';
      head.appendChild(secondary);
    }
    const selected = () => all.findIndex(entry => entry.id === selectedId);
    const track = root.querySelector('#ch2-track');
    let settleTimer = 0;
    let suppressEdgeTapUntil = 0;
    const clearMotion = () => root.querySelectorAll('.ch2-card').forEach(card => {
      card.style.setProperty('--motion-x','0px');
      card.style.setProperty('--motion-angle','0deg');
      card.style.setProperty('--motion-lift','0px');
    });
    const move = delta => {
      if (accepting || turning) return;
      const at = selected();
      const next = Math.max(0,Math.min(all.length - 1,at + delta));
      if (next === at) return;
      window.clearTimeout(settleTimer);
      const cards = [...track.querySelectorAll('.ch2-card')];
      const oldPositions = cards.map(card => card.getBoundingClientRect().left);
      selectedId = all[next].id; flipped = false;
      root.querySelectorAll('.ch2-face.is-expressing').forEach(node => node.classList.remove('is-expressing'));
      track.classList.remove('is-settling');
      track.classList.add('is-dragging');
      clearMotion();
      cardStates(root,all,next);
      if (!motionReduced()) cards.forEach((card,i) => {
        if (Math.abs(i-next) > 1 && Math.abs(i-at) > 1) return;
        card.style.setProperty('--motion-x',(oldPositions[i]-card.getBoundingClientRect().left)+'px');
      });
      void track.offsetWidth;
      track.classList.remove('is-dragging');
      track.classList.add('is-settling');
      requestAnimationFrame(clearMotion);
      settleTimer = window.setTimeout(() => track.classList.remove('is-settling'),motionReduced() ? 0 : 390);
      Sound.buttonRelease('award');
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
    const rack = root.querySelector('#ch2-rack');
    rack.addEventListener('pointerdown',event => {
      if (accepting || turning || event.button > 0 || event.target.closest('button')) return;
      pointer = {id:event.pointerId,x:event.clientX,time:performance.now(),last:event.clientX,velocity:0,dragX:0};
      rack.setPointerCapture(event.pointerId);
      track.classList.remove('is-settling');
      track.classList.add('is-dragging');
    });
    rack.addEventListener('pointermove',event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const now = performance.now();
      pointer.velocity = .55 * pointer.velocity + .45 * ((event.clientX - pointer.last) / Math.max(8,now - pointer.time));
      pointer.last = event.clientX; pointer.time = now;
      const raw = event.clientX - pointer.x;
      const blocked = (raw > 0 && selected() === 0) || (raw < 0 && selected() === all.length-1);
      const cap = Math.min(210,rack.clientWidth*.57);
      pointer.dragX = Math.max(-cap,Math.min(cap,raw*(blocked ? .22 : 1)));
      const progress = Math.min(1,Math.abs(pointer.dragX)/Math.max(1,rack.clientWidth*.7));
      track.querySelectorAll('.ch2-card').forEach((card,i) => {
        const distance = i-selected();
        if (Math.abs(distance)>1) return;
        card.style.setProperty('--motion-x',pointer.dragX*(distance === 0 ? 1 : .82)+'px');
        card.style.setProperty('--motion-angle',distance === 0 ? Math.max(-2,Math.min(2,pointer.dragX/85))+'deg' : '0deg');
        card.style.setProperty('--motion-lift',distance === 0 ? -Math.round(progress*5)+'px' : '0px');
      });
    });
    const release = (event,cancelled = false) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const distance = pointer.dragX + pointer.velocity * 105;
      if (Math.abs(event.clientX-pointer.x)>12) suppressEdgeTapUntil = performance.now()+350;
      pointer = null;
      track.classList.remove('is-dragging');
      root.querySelectorAll('.ch2-card').forEach(card => {
        card.style.setProperty('--motion-angle','0deg');
        card.style.setProperty('--motion-lift','0px');
      });
      if (!cancelled && Math.abs(distance)>48 && selected()+(distance<0?1:-1)>=0 && selected()+(distance<0?1:-1)<all.length){
        move(distance<0?1:-1);
      } else {
        track.classList.add('is-settling');
        requestAnimationFrame(clearMotion);
        settleTimer = window.setTimeout(() => track.classList.remove('is-settling'),motionReduced() ? 0 : 320);
      }
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
    cardStates(root,all,current);
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

  function accept(root,entry,flip){
    if (!entry || accepting || turning || !['available','active'].includes(entry.state)) return;
    if (entry.state === 'active'){
      if (entry.cash) depart(startCareerCashSession);
      else depart(continueCareerEvent);
      return;
    }
    const price = entry.cash ? CAREER_CASH_CONFIG.buyIn : entry.event.buyIn;
    const confirm = () => {
      if (entry.cash ? !careerCanOpenCash() : !careerCanEnterEvent(entry.id)) { renderCareerScreen(); return; }
      accepting = true;
      const backButton = document.getElementById('career-back');
      if (backButton) backButton.disabled = true;
      const button = root.querySelector('#ch2-primary');
      button.disabled = true;
      button.classList.add('is-entry-pressed');
      const startBankroll = careerBankroll();
      if (flipped) { flipped = false; root.querySelector('.ch2-card.is-selected').classList.remove('is-flipped'); }
      const charge = () => {
        const accepted = entry.cash ? openCareerCashSession() : enterCareerEvent(entry.id);
        if (!accepted){ accepting = false; if (backButton) backButton.disabled = false; renderCareerScreen(); return; }
        const endBankroll = careerBankroll();
        const change = Math.max(0,startBankroll - endBankroll);
        const step = change <= 100 ? 10 : change <= 300 ? 20 : Math.max(50,Math.ceil(change / 12 / 10) * 10);
        const ticks = Math.max(1,Math.ceil(change / step));
        root.querySelector('#ch2-bankroll').setAttribute('aria-live','off');
        if (!motionReduced()) for(let n=1;n<=ticks;n++) queue(() => paintLiveBankroll(root,Math.max(endBankroll,startBankroll - n * step)), 35 + n * Math.max(35,Math.min(75,470 / ticks)));
        queue(() => {
          paintLiveBankroll(root,endBankroll);
          root.querySelector('#ch2-bankroll').setAttribute('aria-live','polite');
          accepting = false;
          if (entry.cash) startCareerCashSession(); else startCareerEvent();
        },motionReduced() ? 0 : 580);
      };
      if (motionReduced()) { charge(); return; }
      queue(() => button.classList.remove('is-entry-pressed'),115);
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
      queue(() => {
        charge();
        ticket.classList.add('is-paid','is-returning');
        root.querySelector('.ch2-bankroll-housing').classList.add('is-payment');
      },710);
      queue(() => { ticket.remove(); selectedCard.classList.remove('is-feeding'); root.classList.remove('is-accepting'); },1250);
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
