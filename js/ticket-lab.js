/* ============================================================
   TICKET LAB — printed Career event ticket, reference harness.

   As of the production integration this Lab renders the REAL production
   ticket: the same class names, the same markup shape and the same
   stylesheet rules that js/07-ui-wiring.js emits into the Career
   directory. Nothing about the ticket is redrawn here, so the Lab cannot
   drift from what ships.

   Isolation contract:
     - loads NO production GAME logic — no Career state, no save, no
       unlock, no table, no engine, no directory renderer;
     - addresses NO production element id;
     - every event value below is a disposable in-memory fixture.

   The ONE production file it does load is js/02-support-systems.js, for
   the real Sound module. That is deliberate: the sound audition has to
   audition the voices that actually ship, not a copy of them.

   INTENDED SOUND, now implemented as three auditionable voices in
   Sound.ticketPrint() (js/02-support-systems.js):
     A. RECEIPT             light, fast paper chatter, small finishing click
     B. MECHANICAL TICKET   firm engagement click, chunky ratcheting feed,
                            substantial final locking clunk   [RECOMMENDED]
     C. PREMIUM TICKET      quieter smoother feed, crisp metal stamp,
                            controlled heavy settlement
   ============================================================ */
(function(){
  'use strict';

  var FACE_ART = {
    idle:'assets/faces/legacy-idle.jpg',   think:'assets/faces/legacy-think.jpg',
    smug:'assets/faces/legacy-smug.jpg',   angry:'assets/faces/legacy-angry.jpg',
    sly:'assets/faces/red-sly01.PNG',      gloating:'assets/faces/red-gloating01.PNG'
  };
  var FACE_HUES = [0, 32, 240, 136, 179, 217, 279, 335];
  var THREAT_FACES = {
    MODERATE:['idle','think','idle','think','think','idle'],
    SERIOUS: ['smug','sly','angry','gloating','smug','sly']
  };
  /* Canonical personality names — mirrors PERSONALITIES_ALL. */
  var PERSONAS = ['Rock','Shark','Maniac','Station','Grinder','Wildcard','Prof','Hammer'];

  /* One fixture per PRESTIGE TIER, so all four can be seen even though
     the later venues are not implemented in production yet. The Back Room
     and Pub Circuit entries mirror the real catalogue. */
  var EVENTS = [
    { id:'back-room-freezeout', key:'backroom', prestige:'basic', venue:'BACK ROOM',
      title:'3-HAND', name:'BACK ROOM 3-HAND', buyIn:100, players:3, stack:500,
      format:'FREEZEOUT', payout:'$300 TO 1ST', threat:'MODERATE' },
    { id:'pub-open', key:'pub', prestige:'standard', venue:'PUB CIRCUIT',
      title:'5-HAND', name:'PUB CIRCUIT 5-HAND', buyIn:300, players:5, stack:750,
      format:'FREEZEOUT', payout:'$1,050 TO 1ST · $450 TO 2ND', threat:'SERIOUS' },
    { id:'card-club-6hand', key:'cardclub', prestige:'premium', venue:'CARD CLUB',
      title:'6-HAND', name:'CARD CLUB 6-HAND', buyIn:1000, players:6, stack:1500,
      format:'FREEZEOUT', payout:'$4,000 TO 1ST · $1,600 TO 2ND', threat:'SERIOUS' },
    { id:'invitational-final', key:'invitational', prestige:'luxury', venue:'INVITATIONAL CHAMPIONSHIP',
      title:'FINAL', name:'INVITATIONAL FINAL', buyIn:25000, players:6, stack:5000,
      format:'FREEZEOUT', payout:'$150,000 TO 1ST · $60,000 TO 2ND', threat:'SERIOUS' }
  ];

  /* Mirrors careerStatusWord() in js/07-ui-wiring.js. */
  var STATUS_WORD = { available:'OPEN', active:'ENTRY PAID', locked:'LOCKED',
                      unaffordable:'SHORT', invitational:'INVITATION' };

  var state = { eventIndex:0, status:'available', seats:null };

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v).replace(/[&<>"]/g, function(c){
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }

  function current(){
    var e = EVENTS[state.eventIndex];
    return { e:e, seats:Math.max(1, Math.min(5, state.seats == null ? e.players - 1 : state.seats)) };
  }
  function fixtureRoster(i, seats, threat){
    var moods = THREAT_FACES[threat] || THREAT_FACES.MODERATE, out = [];
    for (var n = 0; n < seats; n++){
      // stride 3 is coprime with the roster length, so a field never
      // repeats a personality
      out.push({ name:PERSONAS[(i + n * 3) % PERSONAS.length],
                 hue:FACE_HUES[(i * 2 + n * 3) % FACE_HUES.length],
                 mood:moods[n % moods.length] });
    }
    return out;
  }
  function serial(id){
    var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000000;
    return String(h).padStart(6, '0');
  }

  /* The production ticket, class for class. Compare against
     careerTrayHTML() in js/07-ui-wiring.js. */
  function ticketHTML(){
    var cur = current(), e = cur.e;
    var st = state.status, word = STATUS_WORD[st] || 'CLOSED';
    var roster = fixtureRoster(state.eventIndex, cur.seats, e.threat);
    var seal = (e.prestige === 'premium' || e.prestige === 'luxury')
      ? '<span class="cdir-tk-seal"></span>' : '';
    var ser = (e.prestige === 'premium' || e.prestige === 'luxury')
      ? '<span class="cdir-tk-serial">NO. ' + serial(e.id) + '</span>' : '';
    var faces = roster.map(function(s){
      var f = s.hue ? 'filter:hue-rotate(' + s.hue + 'deg) saturate(1.05);' : '';
      return '<span class="cdir-seat"><span class="cdir-hf">' +
        '<img class="face" src="' + FACE_ART[s.mood] + '" alt="" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated;' + f + '">' +
        '</span><span class="cdir-seat-name">' + esc(s.name) + '</span></span>';
    }).join('');
    var facts = [['Players', e.players], ['Stack', e.stack.toLocaleString()], ['Format', e.format]]
      .map(function(p){ return '<span class="cdir-tk-fact"><span>' + p[0] + '</span><b>' + p[1] + '</b></span>'; }).join('');
    var note = st === 'locked' ? 'UNLOCKS BY WINNING BACK ROOM 3-HAND'
      : st === 'unaffordable' ? 'NEEDS $220 MORE THAN YOU HOLD'
      : st === 'active' ? 'BUY-IN OF $' + e.buyIn.toLocaleString() + ' IS STAKED'
      : st === 'invitational' ? 'BY INVITATION ONLY' : 'OPEN TO YOU NOW';
    var prominent = (st === 'locked' || st === 'unaffordable' || st === 'invitational') ? ' is-requirement' : '';

    return '<div class="cdir-paper" data-prestige="' + e.prestige + '" id="tk-paper">' +
      '<div class="cdir-perf"></div>' +
      '<div class="cdir-paperbody">' +
        (st === 'active' ? '<span class="cdir-tk-punch"></span>' : '') +
        '<div class="cdir-tk-venue cdir-tk-venue-' + e.key + '">' + esc(e.venue) + '</div>' +
        '<h3 class="cdir-tk-name">' + esc(e.title) + '</h3>' +
        '<div class="cdir-tk-ref">' + esc(e.name) + '</div>' +
        '<div class="cdir-tk-stampline">' +
          '<span class="cdir-tk-stamp is-' + st + '">' + esc(word) + '</span>' +
          '<span class="cdir-tk-threat"><b>TABLE</b>' + e.threat + '</span></div>' +
        '<div class="cdir-tk-rule"></div>' +
        '<div class="cdir-tk-money">' +
          '<div class="cdir-tk-payout"><span>Payout</span><b>' + esc(e.payout) + '</b></div>' +
          '<div class="cdir-tk-entry"><span>Entry</span><b>' +
            (e.buyIn === 0 ? 'FREE' : '$' + e.buyIn.toLocaleString()) + '</b></div></div>' +
        '<div class="cdir-tk-rule"></div>' +
        '<div class="cdir-tk-rosterhead">Your table</div>' +
        '<div class="cdir-faces">' + faces + '</div>' +
        '<div class="cdir-tk-rule"></div>' +
        '<div class="cdir-tk-facts">' + facts + '</div>' +
        '<p class="cdir-tk-note' + prominent + '">' + esc(note) + '</p>' +
        '<div class="cdir-tk-footer">' + seal +
          '<span class="cdir-tk-footmark">TICKET ' + esc(e.id.toUpperCase()) + '</span>' + ser +
        '</div>' +
      '</div></div>';
  }

  function controlsHTML(){
    var st = state.status;
    if (st === 'active'){
      return '<div class="cdir-cradle"><button type="button" class="cdir-primary">' +
        '<span class="pc-lamp is-amber"></span><span class="cdir-legend-wrap">' +
        '<span class="cdir-legend">Continue</span><small>' + esc(current().e.title) + '</small></span>' +
        '<span class="pc-lamp is-amber"></span></button></div>' +
        '<button type="button" class="cdir-abandon">Abandon Event</button>';
    }
    if (st === 'available'){
      return '<div class="cdir-cradle"><button type="button" class="cdir-primary">' +
        '<span class="pc-lamp is-amber"></span><span class="cdir-legend-wrap">' +
        '<span class="cdir-legend">Take Seat</span></span>' +
        '<span class="pc-lamp is-amber"></span></button></div>';
    }
    var word = st === 'unaffordable' ? 'Bankroll short'
      : st === 'invitational' ? 'By invitation only' : 'Locked';
    return '<div class="cdir-locked-strip"><span class="pc-lamp"></span><span>' + word + '</span></div>';
  }

  function render(print){
    var cur = current(), e = cur.e;
    var row = $('tk-row');
    row.className = 'tk-eventrow cdir-room cdir-room-' + e.key;
    row.innerHTML =
      '<header class="cdir-room-plate"><span class="cdir-room-name">' + esc(e.venue) + '</span></header>' +
      '<div class="cdir-room-bay"><div class="cdir-hatch is-open">' +
        '<div class="cdir-mount-plaque"><button type="button" class="cdir-cassette" id="tk-plaque">' +
          '<span class="cdir-cassette-name">' + esc(e.title) + '</span>' +
          '<span class="cdir-money-value">' +
            (e.buyIn === 0 ? 'FREE ENTRY' : '$' + e.buyIn.toLocaleString() + ' ENTRY') +
          '</span></button></div>' +
        '<div class="cdir-tray" id="tk-tray"><div class="cdir-tray-inner">' +
          '<div class="cdir-slot" id="tk-slot"><i></i></div>' +
          '<div class="cdir-feed">' + ticketHTML() + '</div>' +
          '<div class="cdir-mount">' + controlsHTML() + '</div>' +
        '</div></div>' +
      '</div></div>';
    $('tk-plaque').onclick = function(){ open(); };
    if (print) startPrint();
  }

  /* The production print sequence, and the production sound call. */
  function startPrint(){
    var paper = $('tk-paper'), slot = $('tk-slot');
    slot.classList.add('is-open');
    var reduced = document.body.getAttribute('data-motion') === 'off';
    if (reduced){ paper.classList.add('is-settled'); }
    else {
      paper.classList.remove('is-printing','is-settled');
      void paper.offsetWidth;
      paper.classList.add('is-printing');
      paper.addEventListener('animationend', function done(){
        paper.classList.remove('is-printing');
        paper.classList.add('is-settled');
        paper.removeEventListener('animationend', done);
      });
    }
    // Sound is independent of the motion preference, exactly as in
    // production, and only ever follows this explicit action.
    Sound.unlock();
    Sound.ticketPrint();
  }
  function open(){ render(true); }

  function setActive(sel, el){
    document.querySelectorAll(sel).forEach(function(b){ b.classList.remove('active'); });
    if (el) el.classList.add('active');
  }
  function bind(){
    document.querySelectorAll('[data-tk-event]').forEach(function(b){
      b.onclick = function(){ state.eventIndex = +b.dataset.tkEvent; state.seats = null;
        setActive('[data-tk-event]', b); open(); };
    });
    document.querySelectorAll('[data-tk-status]').forEach(function(b){
      b.onclick = function(){ state.status = b.dataset.tkStatus; setActive('[data-tk-status]', b); open(); };
    });
    document.querySelectorAll('[data-tk-seats]').forEach(function(b){
      b.onclick = function(){ state.seats = +b.dataset.tkSeats; setActive('[data-tk-seats]', b); open(); };
    });
    document.querySelectorAll('[data-tk-theme]').forEach(function(b){
      b.onclick = function(){ document.body.setAttribute('data-theme', b.dataset.tkTheme);
        setActive('[data-tk-theme]', b); };
    });
    document.querySelectorAll('[data-tk-motion]').forEach(function(b){
      b.onclick = function(){ document.body.setAttribute('data-motion', b.dataset.tkMotion);
        setActive('[data-tk-motion]', b); open(); };
    });
    /* ---- sound audition ----
       Each button auditions one REAL production voice and, separately,
       sets the voice production will print with. Nothing plays until one
       of these is pressed. */
    document.querySelectorAll('[data-tk-voice]').forEach(function(b){
      b.onclick = function(){
        var name = b.dataset.tkVoice;
        settings.sound = true;               // the Lab is an audition booth
        Sound.unlock();
        Sound.setTicketVoice(name);
        setActive('[data-tk-voice]', b);
        Sound.ticketPrint(name);
        $('tk-voice-readout').textContent =
          'Production voice: ' + Sound.getTicketVoice().toUpperCase();
      };
    });
    $('tk-audition-print').onclick = function(){
      settings.sound = true; Sound.unlock(); open();
    };
    $('tk-audition-mute').onclick = function(){
      settings.sound = false;
      $('tk-voice-readout').textContent = 'Sound OFF — printing is silent.';
      open();
    };
  }

  bind();
  // Sound is OFF until the player asks for it, and nothing sounds on load.
  settings.sound = false;
  $('tk-voice-readout').textContent = 'Production voice: ' + Sound.getTicketVoice().toUpperCase();
  render(false);
  window.__ticketLab = { open:open, state:state };
})();
