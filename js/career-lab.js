/* ============================================================
   CAREER LAB — physical event directory
   A scrollable column of room dividers and event hatches, mounted in
   one Career cabinet. Cheapest and easiest at the top; cost, field and
   threat rise on the way down.

   Isolation contract:
     - loads and calls NO production JavaScript;
     - reads and writes NO Career save, localStorage, unlock or game state;
     - addresses NO production element id;
     - every value below is a disposable in-memory Lab fixture.

   Behavioural references (referenced, never called):
     paintCRT()          js/05-game-engine.js:477    finite refresh on change
     buildResultDigits() js/06-presentation.js:3999  reel cell structure
     renderFace()        js/02-support-systems.js:497 face <img> + hue filter
     FACE_ART            js/02-support-systems.js:122 portrait paths
     FACE_COLORS         js/02-support-systems.js:344 hue-rotate palette
   ============================================================ */
(function(){
  'use strict';

  var RECOVERY_THRESHOLD = 100;

  /* Production portrait paths and hues, used as fixture art. No new
     artwork is authored and no roster is persisted. */
  var FACE_ART = {
    idle:'assets/faces/legacy-idle.jpg',   think:'assets/faces/legacy-think.jpg',
    smug:'assets/faces/legacy-smug.jpg',   angry:'assets/faces/legacy-angry.jpg',
    sly:'assets/faces/red-sly01.PNG',      gloating:'assets/faces/red-gloating01.PNG'
  };
  var FACE_HUES = [0, 32, 240, 136, 179, 217, 279, 335];

  /* A MODERATE table wears milder expressions; a SERIOUS table wears
     stronger ones. Difficulty is never carried by an unexplained lamp. */
  var THREAT_FACES = {
    MODERATE:['idle','think','idle','think'],
    SERIOUS: ['smug','sly','angry','gloating']
  };

  /* ---------------- fixture catalogue ----------------
     Mirrors the implemented events in js/04-modes-and-scoring.js:33-108.
     Copied as fixture values; that file is never loaded. */
  var EVENTS = [
    { id:'second-chance', room:'BACK ROOM', name:'SECOND CHANCE',
      buyIn:0, field:3, stack:500, format:'FREEZEOUT', payout:'$150 TO 1ST',
      threat:'MODERATE', requires:null, recovery:true },
    { id:'back-room-freezeout', room:'BACK ROOM', name:'BACK ROOM FREEZEOUT',
      buyIn:100, field:3, stack:500, format:'FREEZEOUT', payout:'$300 TO 1ST',
      threat:'MODERATE', requires:null },
    { id:'pub-freezeout', room:'PUB CIRCUIT', name:'PUB CIRCUIT FREEZEOUT',
      buyIn:300, field:4, stack:750, format:'FREEZEOUT', payout:'$1,200 TO 1ST',
      threat:'SERIOUS', requires:'back-room-freezeout' },
    { id:'pub-open', room:'PUB CIRCUIT', name:'PUB CIRCUIT OPEN',
      buyIn:300, field:5, stack:750, format:'FREEZEOUT', payout:'$1,050 TO 1ST · $450 TO 2ND',
      threat:'SERIOUS', requires:'back-room-freezeout' }
  ];

  var ROOMS = [
    { name:'BACK ROOM',                 key:'backroom',     open:true },
    { name:'PUB CIRCUIT',               key:'pub',          open:true },
    { name:'CARD CLUB',                 key:'cardclub',     open:false },
    { name:'CASINO FLOOR',              key:'casino',       open:false },
    { name:'HIGH ROLLER ROOM',          key:'highroller',   open:false },
    { name:'INVITATIONAL CHAMPIONSHIP', key:'invitational', open:false }
  ];

  function eventById(id){
    for (var i=0;i<EVENTS.length;i++) if (EVENTS[i].id === id) return EVENTS[i];
    return null;
  }

  /* Independent examples, never a chronological chain. Events played and
     events won are Lab fixture values: Career does not persist them. */
  var FIXTURES = {
    S1:  { bankroll:500, access:'BACK ROOM',   played:0,  won:0, active:null },
    S2:  { bankroll:40,  access:'BACK ROOM',   played:6,  won:0, active:null },
    S3:  { bankroll:400, access:'BACK ROOM',   played:3,  won:0, active:'back-room-freezeout' },
    S3b: { bankroll:40,  access:'BACK ROOM',   played:7,  won:0, active:'second-chance' },
    S4:  { bankroll:80,  access:'PUB CIRCUIT', played:14, won:1, active:null }
  };
  var ENTER_TO = { 'back-room-freezeout':'S3', 'second-chance':'S3b' };
  var ABANDON_TO = { S3:'S1', S3b:'S2' };

  var state = { fixture:'S1', open:null, shownBankroll:null };

  /* ---------------- derived state ---------------- */
  function unlocked(fx, ev){ return !ev.requires || fx.access !== 'BACK ROOM'; }

  function eventState(fx, ev){
    if (fx.active) return fx.active === ev.id ? 'active' : 'blocked';
    if (ev.recovery && !(fx.bankroll < RECOVERY_THRESHOLD)) return 'hidden';
    if (!unlocked(fx, ev)) return 'locked';
    if (fx.bankroll < ev.buyIn) return 'unaffordable';
    return 'available';
  }

  function entryText(ev){
    return ev.buyIn === 0 ? 'FREE ENTRY' : '$' + ev.buyIn.toLocaleString() + ' ENTRY';
  }

  function requirementText(fx, ev, st){
    if (st === 'locked'){
      var req = eventById(ev.requires);
      return 'UNLOCKS BY WINNING ' + (req ? req.name : '');
    }
    if (st === 'unaffordable')
      return 'NEEDS $' + (ev.buyIn - fx.bankroll).toLocaleString() + ' MORE THAN YOU HOLD';
    if (st === 'blocked') return 'UNAVAILABLE WHILE AN EVENT IS ACTIVE';
    if (st === 'active')  return ev.buyIn === 0 ? 'NO BUY-IN TAKEN' : 'BUY-IN OF $' + ev.buyIn.toLocaleString() + ' IS STAKED';
    return ev.buyIn === 0 ? 'OPEN WHILE YOUR BANKROLL IS UNDER $100' : 'OPEN TO YOU NOW';
  }

  /* ---------------- reel ----------------
     Cell structure mirrors buildResultDigits(container, text, prefix). */
  var BANKROLL_DIGITS = 7;

  /* One physical '$' cell plus seven mechanical digit cells, fixed-width
     whole dollars and no comma. Leading zeroes stay visible on their
     reels but take production's existing dim/inactive treatment
     (.jp-digit.dim, css/02-screens.css:1370); significant digits keep
     the live money treatment. */
  function buildBankrollCells(container, amount){
    container.innerHTML = '';
    var sym = document.createElement('span');
    sym.className = 'jp-cell jp-sym'; sym.textContent = '$';
    container.appendChild(sym);

    var text = String(Math.max(0, amount | 0));
    if (text.length > BANKROLL_DIGITS) text = text.slice(-BANKROLL_DIGITS);
    var padded = ('0000000' + text).slice(-BANKROLL_DIGITS);
    var firstSignificant = padded.length - text.length;

    padded.split('').forEach(function(ch, i){
      var c = document.createElement('span');
      c.className = 'jp-cell jp-digit tabular' + (i < firstSignificant ? ' dim' : '');
      c.textContent = ch;
      container.appendChild(c);
    });
  }

  /* One existing jpTick settle, and ONLY when the displayed bankroll
     actually changed. Opening an event never reaches this. */
  function paintBankroll(amount){
    var el = document.getElementById('cl-bankroll');
    var changed = state.shownBankroll !== null && state.shownBankroll !== amount;
    buildBankrollCells(el, amount);
    el.setAttribute('aria-label', 'Career bankroll ' + amount + ' dollars');
    if (changed){
      el.querySelectorAll('.jp-digit:not(.dim)').forEach(function(c, i){
        c.classList.remove('tick');
        setTimeout(function(){ void c.offsetWidth; c.classList.add('tick'); }, i * 45);
      });
    }
    state.shownBankroll = amount;
  }

  /* One finite refresh burst, only when the text actually changes.
     Mirrors paintCRT()'s dedupe-then-burst without calling it. */
  function setCRT(key, text){
    var el = document.querySelector('[data-cl-crt="' + key + '"]');
    if (!el) return;
    var next = String(text == null ? '' : text);
    if (el.dataset.clText === next) return;
    el.dataset.clText = next;
    el.textContent = next;
    burst(el.closest('.cl-crt') || el.closest('.pc-display') || el);
  }

  /* One finite refresh burst on an element, reusing production's own
     .crt-refresh hook and its 250ms lifetime. */
  function burst(host){
    host.classList.remove('crt-refresh');
    void host.offsetWidth;
    host.classList.add('crt-refresh');
    clearTimeout(host._clT);
    host._clT = setTimeout(function(){ host.classList.remove('crt-refresh'); }, 250);
  }

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------------- the opened tray ----------------
     Built only when a hatch opens, so no face exists while closed. */
  function buildTray(fx, ev, st){
    var tray = el('div', 'cl-tray');
    var inner = el('div', 'cl-tray-inner pc-recess');

    /* 1. Opponent lineup — production's own face drawer, frames and
          portraits. Count follows the event's field. */
    var bay = el('div', 'cl-bay cl-bay-' + ev.threat.toLowerCase());
    bay.appendChild(el('span', 'pc-label cl-bay-label', 'Table'));
    var faces = el('div', 'cl-faces');
    var moods = THREAT_FACES[ev.threat];
    for (var i = 0; i < ev.field - 1; i++){
      var frame = el('span', 'hf cl-hf');
      var img = document.createElement('img');
      img.className = 'face face-img';
      img.src = FACE_ART[moods[i % moods.length]];
      img.alt = '';
      img.draggable = false;
      img.style.filter = 'hue-rotate(' + FACE_HUES[(i * 3 + ev.field) % FACE_HUES.length] + 'deg)';
      frame.appendChild(img);
      faces.appendChild(frame);
    }
    bay.appendChild(faces);
    inner.appendChild(bay);

    /* 2. TABLE THREAT — a flat printed label on its bezel and a separate
          bounded status window. Never a row of unexplained lamps. */
    var threat = el('div', 'cl-threat is-' + ev.threat.toLowerCase());
    threat.appendChild(el('span', 'pc-label', 'Table threat'));
    var tw = el('span', 'cl-threat-well cl-crt');
    tw.appendChild(el('span', 'cl-threat-value', ev.threat));
    threat.appendChild(tw);
    if (ev.threat === 'SERIOUS') threat.appendChild(el('span', 'cl-threat-mark'));
    inner.appendChild(threat);

    /* 3-7. Entry, field, starting stack, format, payout. */
    var terms = el('div', 'cl-terms');
    [['Entry', ev.buyIn === 0 ? 'FREE' : '$' + ev.buyIn.toLocaleString()],
     ['Players', String(ev.field)],
     ['Stack', ev.stack.toLocaleString()],
     ['Format', ev.format]].forEach(function(pair){
      var mod = el('div', 'cl-term');
      mod.appendChild(el('span', 'pc-label', pair[0]));
      var well = el('span', 'cl-term-well cl-crt');
      well.appendChild(el('span', 'cl-term-value', pair[1]));
      mod.appendChild(well);
      terms.appendChild(mod);
    });
    inner.appendChild(terms);

    /* 4. Payout — one wider instrument. Money stays warm gold. */
    var payout = el('div', 'cl-payout');
    payout.appendChild(el('span', 'pc-label', 'Payout'));
    var pw = el('span', 'cl-payout-well cl-crt');
    pw.appendChild(el('span', 'cl-payout-value', ev.payout));
    payout.appendChild(pw);
    inner.appendChild(payout);

    /* 5. Availability or unlock requirement — one narrow status strip. */
    var note = el('div', 'cl-note-well cl-crt');
    note.appendChild(el('span', 'cl-note', requirementText(fx, ev, st)));
    inner.appendChild(note);

    /* 9. Primary action, and the destructive control when active. */
    var actions = el('div', 'cl-actions');
    var cradle = el('div', 'cl-cradle');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cl-primary';
    btn.appendChild(el('span', 'pc-lamp is-amber'));
    var legendWrap = el('span', 'cl-legend-wrap');
    var legend = el('span', 'cl-legend');
    if (st === 'active'){ legend.textContent = 'Continue'; legendWrap.appendChild(legend);
      legendWrap.appendChild(el('small', null, ev.name)); }
    else if (st === 'available'){ legend.textContent = 'Take Seat'; legendWrap.appendChild(legend); }
    else if (st === 'unaffordable'){
      legend.textContent = 'Need $' + (ev.buyIn - fx.bankroll).toLocaleString() + ' More';
      legendWrap.appendChild(legend); btn.disabled = true; }
    else { legend.textContent = 'Locked'; legendWrap.appendChild(legend); btn.disabled = true; }
    btn.appendChild(legendWrap);
    btn.appendChild(el('span', 'pc-lamp is-amber'));
    if (btn.disabled) btn.classList.add('is-disabled');
    cradle.appendChild(btn);
    actions.appendChild(cradle);

    btn.onclick = function(){
      if (st === 'available' && ENTER_TO[ev.id]) setFixture(ENTER_TO[ev.id]);
      /* CONTINUE performs its physical press and writes nothing. */
    };

    if (st === 'active'){
      var ab = document.createElement('button');
      ab.type = 'button';
      ab.className = 'cl-abandon';
      ab.textContent = 'Abandon Event';
      ab.onclick = function(){ if (ABANDON_TO[state.fixture]) setFixture(ABANDON_TO[state.fixture]); };
      actions.appendChild(ab);
    }
    inner.appendChild(actions);

    tray.appendChild(inner);
    return tray;
  }

  /* ---------------- one event hatch ---------------- */
  function buildHatch(fx, ev, st){
    var hatch = el('div', 'cl-hatch is-' + st);
    /* A chunky horizontal cassette seated in its own mounting aperture.
       The name is printed on the cassette face; the entry price sits in
       its own small recessed money window. */
    var mount = el('div', 'cl-mount');
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'cl-cassette';
    head.setAttribute('aria-expanded', String(state.open === ev.id));
    head.appendChild(el('span', 'cl-cassette-name', ev.name));
    var money = el('span', 'cl-money-window cl-crt');
    money.appendChild(el('span', 'cl-money-value', entryText(ev)));
    head.appendChild(money);
    if (st === 'active' || st === 'locked'){
      head.appendChild(el('span', 'cl-flag is-' + st, st === 'active' ? 'ACTIVE' : 'LOCKED'));
    }
    mount.appendChild(head);
    hatch.appendChild(mount);

    if (state.open === ev.id){
      hatch.classList.add('is-open');
      var tray = buildTray(fx, ev, st);
      hatch.appendChild(tray);
      /* Stepped mechanical extension: the tray's real layout height is
         animated in three discrete beats, so following events are
         genuinely pushed down rather than overlaid. */
      requestAnimationFrame(function(){
        var h = tray.firstChild.getBoundingClientRect().height;
        tray.style.height = '0px';
        void tray.offsetHeight;
        tray.classList.add('is-extending');
        tray.style.height = h + 'px';
        tray.addEventListener('transitionend', function once(){
          tray.classList.remove('is-extending');
          tray.style.height = 'auto';
          tray.removeEventListener('transitionend', once);
        });
        tray.querySelectorAll('.cl-hf').forEach(function(f, i){
          setTimeout(function(){ f.classList.add('face-pop'); }, 150 + i * 70);
        });
        /* Every opened tray resynchronises its glass once. A SERIOUS
           table takes one extra brief sync stutter — never a continuous
           blink or a permanent glitch. */
        var glass = tray.querySelectorAll('.cl-crt');
        glass.forEach(function(g){ burst(g); });
        if (ev.threat === 'SERIOUS'){
          setTimeout(function(){ glass.forEach(function(g){ burst(g); }); }, 210);
        }
      });
    }

    head.onclick = function(){
      /* The cassette depresses before the tray beneath it releases. */
      head.classList.add('cl-pressed');
      setTimeout(function(){ head.classList.remove('cl-pressed'); }, 120);
      state.open = (state.open === ev.id) ? null : ev.id;   // only one open at a time
      render();
    };
    return hatch;
  }

  /* ---------------- render ---------------- */
  function render(){
    var fx = FIXTURES[state.fixture];
    var dir = document.getElementById('cl-directory');

    paintBankroll(fx.bankroll);
    setCRT('access', fx.access);
    setCRT('played', String(fx.played));
    setCRT('won', String(fx.won));

    dir.innerHTML = '';

    /* An active event is pinned above the directory and opens by default,
       with the whole room listing kept underneath for context. */
    if (fx.active){
      var act = eventById(fx.active);
      var pin = el('div', 'cl-pinned');
      pin.appendChild(el('span', 'pc-label cl-pin-label', 'Event in progress'));
      pin.appendChild(buildHatch(fx, act, 'active'));
      dir.appendChild(pin);
    }

    ROOMS.forEach(function(room){
      /* Each venue is a substantial recessed machine bay: a physical
         nameplate above, its cassettes or locked compartment inside. */
      var section = el('section', 'cl-room cl-room-' + room.key);
      var plate = el('div', 'cl-room-plate');
      plate.appendChild(el('span', 'cl-room-name', room.name));
      section.appendChild(plate);

      var bay = el('div', 'cl-room-bay');

      if (!room.open){
        var door = el('div', 'cl-door');
        door.appendChild(el('span', 'cl-door-text', 'LOCKED · COMING SOON'));
        bay.appendChild(door);
      } else {
        EVENTS.filter(function(ev){ return ev.room === room.name; }).forEach(function(ev){
          var st = eventState(fx, ev);
          if (st === 'hidden') return;
          if (fx.active === ev.id) return;   // already pinned above
          bay.appendChild(buildHatch(fx, ev, st));
        });
      }
      section.appendChild(bay);
      dir.appendChild(section);
    });

    document.querySelectorAll('[data-cl-fixture]').forEach(function(b){
      b.setAttribute('aria-pressed', String(b.dataset.clFixture === state.fixture));
    });
  }

  function setFixture(name){
    if (!FIXTURES[name]) return;
    state.fixture = name;
    state.open = FIXTURES[name].active || null;   // an active event opens by default
    render();
    document.getElementById('cl-directory').scrollTop = 0;
  }

  document.querySelectorAll('[data-cl-fixture]').forEach(function(b){
    b.onclick = function(){ setFixture(b.dataset.clFixture); };
  });
  document.querySelectorAll('[data-cl-theme]').forEach(function(b){
    b.onclick = function(){ document.body.dataset.theme = b.dataset.clTheme; };
  });

  render();

  /* ---------------- numeric geometry report ---------------- */
  function measure(){
    var frame = document.querySelector('.cl-frame');
    var dir = document.getElementById('cl-directory');
    var report = {
      fixture:state.fixture, open:state.open,
      viewport:window.innerWidth + '×' + window.innerHeight,
      frameOverflowX:Math.max(0, frame.scrollWidth - frame.clientWidth),
      frameOverflowY:Math.max(0, frame.scrollHeight - frame.clientHeight),
      directory:{ client:dir.clientHeight, scroll:dir.scrollHeight,
                  scrollable:dir.scrollHeight > dir.clientHeight },
      rows:[], openTrays:document.querySelectorAll('.cl-hatch.is-open').length,
      facesWhileClosed:0, controls:[], tooSmall:[], clipped:[], wrapped:[],
      instrumentH:Math.round(document.querySelector('.cl-instrument').getBoundingClientRect().height),
      directoryH:dir.clientHeight,
      reelCells:document.querySelectorAll('#cl-bankroll .jp-cell').length,
      reelText:[].map.call(document.querySelectorAll('#cl-bankroll .jp-cell'), function(c){ return c.textContent; }).join(''),
      reelDim:document.querySelectorAll('#cl-bankroll .jp-digit.dim').length,
      theme:document.body.dataset.theme
    };

    document.querySelectorAll('[data-cl-region]').forEach(function(n){
      report.rows.push({ region:n.getAttribute('data-cl-region'),
        client:n.clientHeight, scroll:n.scrollHeight,
        over:Math.max(0, n.scrollHeight - n.clientHeight) });
    });

    document.querySelectorAll('.cl-hatch:not(.is-open) .face').forEach(function(){
      report.facesWhileClosed++;
    });

    document.querySelectorAll('.pc-housing button, .cl-directory button').forEach(function(b){
      var h = Math.round(b.getBoundingClientRect().height);
      report.controls.push({ cls:String(b.className).slice(0,30), h:h });
      if (h < 44) report.tooSmall.push({ cls:String(b.className).slice(0,40), h:h });
    });

    /* Horizontal clipping only: the directory scrolls vertically by design,
       and an open tray legitimately extends its scroll height. */
    document.querySelectorAll('.pc-housing *').forEach(function(n){
      if (n.scrollWidth - n.clientWidth > 1)
        report.clipped.push({ el:String(n.className).slice(0,34), w:n.clientWidth, sw:n.scrollWidth });
    });

    document.querySelectorAll('.pc-housing .pc-label, .pc-housing .cl-note, .pc-housing .cl-cassette-name, .pc-housing .cl-money-value, .pc-housing .cl-room-name, .pc-housing .cl-legend, .pc-housing .cl-term-value, .pc-housing .cl-payout-value, .pc-housing .cl-threat-value, .pc-housing .cl-door-text, .pc-housing .cl-stat-value, .pc-housing .cl-nameplate-value, .pc-housing .cl-flag').forEach(function(n){
      if (!n.firstChild || n.firstChild.nodeType !== 3 || !n.textContent.trim()) return;
      var cs = getComputedStyle(n);
      var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      /* Measure the TEXT's own box, not the padded element: a padded
         one-line label is not a wrapped one. */
      var range = document.createRange();
      range.selectNodeContents(n);
      var rects = range.getClientRects();
      if (rects.length > 1 || (rects[0] && rects[0].height > lh * 1.6))
        report.wrapped.push({ el:String(n.className).slice(0,26),
          text:n.textContent.trim().slice(0,26), lines:rects.length,
          h:Math.round(rects[0] ? rects[0].height : 0), lh:Math.round(lh) });
    });

    return report;
  }

  window.__careerLabReport = measure;
  window.__careerLabSetFixture = setFixture;
  window.__careerLabOpen = function(id){ state.open = id; render(); };
})();
