/* ============================================================
   CHATTER STAGE — the production phone screen, dressed as a live hand
   This runs inside chatter-stage.html, which is the production table
   screen verbatim. Its job is to fill that screen with plausible
   fixture state (a board, a pot, seated residents, HUD instruments)
   and then expose one small API so the Lab shell outside the iframe
   can drive chatter without knowing anything about how it works.

   Isolation contract:
     - loads ONE production script (02-support-systems.js) and calls
       only renderFace() and pixelHeartSVG() from it;
     - reads and writes NO Career save, localStorage key or unlock;
     - runs no poker logic — nothing here deals, bets or evaluates.

   Table geometry below is COPIED from production as fixture values:
     SEAT_MAPS      js/06-presentation.js:145
     seat scale     js/06-presentation.js:1394
     reel cells     js/06-presentation.js:1065 (setReelRest)
   ============================================================ */
(function(global){
  'use strict';

  var R = global.ChatterResidents, V = global.ChatterVoice, P = global.ChatterPresenters;

  var $ = function(id){ return document.getElementById(id); };

  /* ---------------- production geometry, copied as fixture -------- */
  var SEAT_MAPS = {
    3: [{left:22.3, top:14},{left:50, top:6},{left:77.7, top:14}],
    4: [{left:13.9, top:12},{left:38, top:7},{left:62, top:7},{left:86.1, top:12}],
    5: [{left:8, top:17},{left:29, top:10.5},{left:50, top:7},{left:71, top:10.5},{left:92, top:17}],
    6: [{left:7, top:18},{left:24.2, top:10},{left:41.4, top:6.5},
        {left:58.6, top:6.5},{left:75.8, top:10},{left:93, top:18}]
  };
  function scaleFor(n){ return n<=3 ? 1.0 : n===4 ? 0.88 : n===5 ? 0.80 : 0.77; }
  function seatWFor(n, avatarW, scale){
    return n<=4 ? Math.round(98*scale) : n===5 ? avatarW+12 : avatarW+6;
  }

  var BOARD = [
    {r:'A', s:'♠', c:'spade'},   {r:'9', s:'♥', c:'heart'},
    {r:'Q', s:'♣', c:'club'},    {r:'4', s:'♦', c:'diamond'},
    {r:'J', s:'♠', c:'spade'}
  ];
  var HOLE = [ {r:'A', s:'♥', c:'heart'}, {r:'9', s:'♠', c:'spade'} ];
  var STACKS = ['1200','860','2340','540','1015','720'];

  /* ---------------- state ---------------- */
  var felt, rail;
  var seats = {}, seatedIds = [], seatCount = 5;
  var presenter = null, presenterKey = 'E1';
  var soundEnabled = true, street = 5;
  var timers = [], playToken = 0, nextIndex = 0, lastSampleKey = 'harry';

  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function emitLog(entry){ logListeners.forEach(function(fn){ try{ fn(entry); }catch(e){} }); }

  /* ---------------- production-shaped fixture builders ------------ */
  function cardHTML(card, small){
    return '<div class="card ' + (small ? 'small ' : '') + card.c + '">' +
      '<div class="ci"><span class="r">' + card.r + '</span><span class="s">' + card.s + '</span></div>' +
      '<div class="pip">' + card.s + '</div></div>';
  }
  /* Mirrors setReelRest() exactly — a resting drum is two identical
     faces stacked inside an overflow-hidden cell, which is what lets
     production roll it without a reflow. */
  function reelCell(ch, extra){
    return '<span class="jp-cell jp-digit reel-digit reel-cell tabular' + (extra||'') + '">' +
      '<span class="reel-strip" aria-hidden="true"><span>' + ch + '</span><span>' + ch + '</span></span>' +
      '</span>';
  }
  function fillReel(el, digits, width){
    if (!el) return;
    var s = String(digits);
    while (s.length < width) s = '0' + s;
    var html = '';
    for (var i=0;i<s.length;i++){
      var lead = /^0+$/.test(s.slice(0, i+1));
      html += reelCell(s[i], lead ? ' dim' : '');
    }
    el.innerHTML = '<span class="jp-cell jp-sym">$</span>' + html;
  }
  function heartsHTML(n){
    var h = '';
    for (var k=0;k<3;k++){
      h += '<span class="h' + (k<n?'':' off') + '">' +
        (typeof pixelHeartSVG === 'function' ? pixelHeartSVG() : '') + '</span>';
    }
    return h;
  }
  /* A static approximation of bankPile()'s three-slot bank tower. The
     real one measures #hud-left and lays absolute towers into a grid;
     none of that affects chatter, so this reproduces the LOOK (three
     overlapping columns of real .chip-disc art) without the machinery. */
  function buildBankTower(){
    var t = $('hud-tower');
    if (!t) return;
    var colours = ['d-red','d-blue','d-black','d-green','d-white','d-purple','d-yellow'];
    var html = '<div class="chs-tower-row">';
    [7,9,6].forEach(function(count, col){
      html += '<div class="chs-tower-col">';
      for (var i=0;i<count;i++){
        var c = colours[(col*3 + i) % colours.length];
        html += '<div class="chip-disc ' + c + ' v-' + (1 + ((i+col) % 3)) + '"></div>';
      }
      html += '</div>';
    });
    t.innerHTML = html + '</div>';
  }

  function faceHTML(res, art){
    if (typeof renderFace === 'function') return renderFace(R.facePlayer(res), art);
    return '<span class="face"></span>';
  }

  /* ---------------- the table ---------------- */
  function buildBoard(){
    var b = $('board');
    if (!b) return;
    b.innerHTML = BOARD.slice(0, street).map(function(c){ return cardHTML(c, false); }).join('');
  }

  function buildHumanSeat(){
    var mid = $('hud-mid');
    if (!mid) return;
    var old = mid.querySelector('.seat.you');
    if (old) old.remove();
    var root = document.createElement('div');
    root.className = 'seat you';
    root.innerHTML =
      '<div class="avatar-wrap hidden"><div class="turn-ring"></div><div class="avatar">YO</div></div>' +
      '<span class="seat-chips hidden"></span>' +
      '<div class="chip-stack hidden" aria-hidden="true"></div>' +
      '<div class="seat-cards">' + HOLE.map(function(c){ return cardHTML(c, false); }).join('') + '</div>' +
      '<div class="action-bubble"></div>';
    mid.insertBefore(root, mid.firstChild);
  }

  function buildSeats(n){
    seatCount = n;
    Array.prototype.slice.call(felt.querySelectorAll('.seat')).forEach(function(el){ el.remove(); });
    seats = {};
    seatedIds = R.ids.slice(0, Math.min(n, R.ids.length));
    /* A six-handed table needs six seat BOXES but the prototype cast is
       five. Rather than duplicate a resident — which would give two
       chairs the same id and quietly break every presenter's per-seat
       lookup — the sixth chair is an empty socket, exactly as
       production renders a seat whose player has been knocked out. The
       geometry under test is the box spacing, and five speakers across
       six of the tightest positions exercises every adjacent pair that
       matters, including the two centre seats. */
    var emptyChairs = Math.max(0, n - seatedIds.length);

    var scale = scaleFor(n);
    var avatarW = Math.round(78*scale);
    felt.style.setProperty('--seat-w', seatWFor(n, avatarW, scale) + 'px');
    felt.style.setProperty('--avatar-w', avatarW + 'px');
    felt.style.setProperty('--card-h', Math.round(48*scale) + 'px');
    felt.classList.add('compact-seats');
    felt.classList.remove('opponents-4','opponents-5','opponents-6');
    if (n>=4 && n<=6) felt.classList.add('opponents-' + n);

    var map = SEAT_MAPS[n] || SEAT_MAPS[4];
    seatedIds.forEach(function(id, i){
      var res = R.byId(id);
      var pos = map[i];
      var root = document.createElement('div');
      root.className = 'seat';
      root.style.left = pos.left + '%';
      root.style.top = pos.top + '%';
      if (pos.left <= 10) root.classList.add('seat-edge-l');
      else if (pos.left >= 90) root.classList.add('seat-edge-r');
      root.innerHTML =
        '<div class="seat-card">' +
          '<span class="seat-name">' + esc(res.name) + '</span>' +
          '<div class="hearts" aria-hidden="true">' + heartsHTML(i===2 ? 2 : 3) + '</div>' +
          '<div class="avatar-wrap">' +
            '<div class="turn-ring"></div>' +
            '<div class="avatar has-face"></div>' +
            '<div class="pos-btn hidden"></div>' +
          '</div>' +
          '<span class="seat-chips tabular mini-jackpot" role="img"></span>' +
          '<div class="action-slot ' + (i===1 ? 'act-raise' : 'act-empty') + '">' +
            (i===1 ? 'RAISE' : '–') + '</div>' +
          '<div class="seat-cards">' +
            '<div class="card back small"></div><div class="card back small"></div>' +
          '</div>' +
        '</div>' +
        '<div class="action-bubble"></div>';
      felt.appendChild(root);
      var avatar = root.querySelector('.avatar');
      avatar.innerHTML = faceHTML(res, res.rest);
      fillReel(root.querySelector('.seat-chips'), STACKS[i % STACKS.length], 4);
      /* One seat wears the turn indicator, as it always would mid-hand. */
      if (i === 1) root.classList.add('active');
      seats[id] = {
        root: root,
        card: root.querySelector('.seat-card'),
        cards: root.querySelector('.seat-cards'),
        avatar: avatar,
        index: i
      };
    });

    for (var e=0; e<emptyChairs; e++){
      var idx = seatedIds.length + e;
      var epos = map[idx];
      if (!epos) break;
      var chair = document.createElement('div');
      chair.className = 'seat seat-empty';
      chair.style.left = epos.left + '%';
      chair.style.top = epos.top + '%';
      if (epos.left <= 10) chair.classList.add('seat-edge-l');
      else if (epos.left >= 90) chair.classList.add('seat-edge-r');
      chair.innerHTML =
        '<div class="seat-card">' +
          '<span class="seat-name">Empty</span>' +
          '<div class="hearts" aria-hidden="true">' + heartsHTML(0) + '</div>' +
          '<div class="avatar-wrap"><div class="turn-ring"></div>' +
            '<div class="avatar socket-dead"></div></div>' +
          '<span class="seat-chips tabular mini-jackpot"></span>' +
          '<div class="action-slot act-empty">–</div>' +
          '<div class="seat-cards"></div>' +
        '</div>';
      felt.appendChild(chair);
    }
  }

  /* ---------------- portraits ---------------- */
  var faces = {
    set: function(id, art){
      var s = seats[id], res = R.byId(id);
      if (!s || !res) return;
      s.avatar.innerHTML = faceHTML(res, art);
    },
    rest: function(id){
      var res = R.byId(id);
      if (res) faces.set(id, res.rest);
    },
    restAll: function(){ seatedIds.forEach(faces.rest); }
  };

  /* ---------------- six visual presenters ---------------- */
  function ctxFor(){
    return {
      felt:felt, rail:rail, seats:seats,
      renderFace:function(res,art){ return faceHTML(res,art); }
    };
  }
  function stopPlayback(){
    playToken++;
    timers.forEach(function(t){ clearTimeout(t); });
    timers=[];
    if(presenter&&presenter.clearAll) presenter.clearAll();
    faces.restAll();
    V.stopAll();
  }
  function later(fn,ms,token){
    timers.push(setTimeout(function(){ if(token===playToken) fn(); },ms));
  }
  function mountPresenter(key){
    stopPlayback();
    if(presenter&&presenter.unmount) presenter.unmount();
    presenterKey=P.ORDER.indexOf(key)!==-1?key:'E1';
    presenter=P.create(presenterKey);
    presenter.mount(ctxFor());
  }
  function remountPresenter(){ mountPresenter(presenterKey); }

  /* Static samples are intentionally tiny: this is a visual/SFX lab,
     not a dialogue architecture prototype. */
  var SAMPLES={
    harry:{ label:'Harry: “Here he is!”', beats:[{who:'harry',text:'Here he is!',role:'smug'}] },
    lucy:{ label:'Lucy: “Very dramatic.”', beats:[{who:'lucy',text:'Very dramatic.',role:'cross'}] },
    tony:{ label:'Tony: “You worry about yourself.”', beats:[{who:'tony',text:'You worry about yourself.',role:'pleased'}] },
    nigel:{ label:'Nigel: “Honestly.”', beats:[{who:'nigel',text:'Honestly.',role:'cross'}] },
    steve:{ label:'Steve: “Didn’t like that.”', beats:[{who:'steve',text:'Didn’t like that.',role:'rattled'}] },
    long:{ label:'Lucy: “Steady on, Tony. You’re making the felt nervous.”', beats:[{who:'lucy',text:'Steady on, Tony. You’re making the felt nervous.',role:'sly'}] },
    exchange:{ label:'Harry → Tony: “Steady on.” / “You worry about yourself.”', beats:[
      {who:'harry',text:'Steady on.',role:'smug'},
      {who:'tony',text:'You worry about yourself.',role:'pleased'}
    ]}
  };
  var NEXT=['nigel','steve','long','tony','harry','lucy'];

  function dwellFor(text,total){
    if(total>1) return Math.max(1550,Math.min(2100,1100+text.length*38));
    return Math.max(2100,Math.min(3300,1450+text.length*48));
  }
  function typingPlan(text){
    var group=text.length<=20?2:3,steps=[];
    for(var end=group;end<text.length;end+=group) steps.push(text.slice(0,end));
    steps.push(text);
    var sounding=[];
    steps.forEach(function(part,index){
      var previous=index?steps[index-1].length:0;
      if(/[A-Za-z0-9]/.test(text.slice(previous,part.length))) sounding.push(index);
    });
    var ticks={};
    sounding.forEach(function(index){ ticks[index]=true; });
    return {
      steps:steps,
      ticks:ticks,
      lastSounding:sounding.length?sounding[sounding.length-1]:-1,
      stepMs:text.length<=20?46:40,
      openingMs:70
    };
  }
  function play(beats){
    stopPlayback();
    var token=playToken,total=beats.length,at=0;
    beats.forEach(function(beat,index){
      var res=R.byId(beat.who); if(!res||!seats[beat.who]) return;
      var dwell=dwellFor(beat.text,total);
      var payload={resident:res,text:beat.text,role:beat.role,art:R.moodArt(res,beat.role),index:index,total:total,dwell:dwell};
      var fits=presenter.canFit(payload.text);
      if(!fits){
        later(function(){
          faces.set(beat.who,payload.art);
          presenter.showFailure(payload);
          if(global.console&&console.warn) console.warn('[Chatter Lab] '+presenterKey+' rejected overlong line: '+payload.text);
        },at,token);
        later(function(){ presenter.hide(payload); },at+1900,token);
        later(function(){ faces.rest(beat.who); },at+2000,token);
        at+=2120;
        return;
      }
      var plan=typingPlan(payload.text),start=at;
      later(function(){
        faces.set(beat.who,payload.art);
        presenter.show(payload);
        V.beginPhrase();
      },start,token);
      later(function(){ V.open(); },start+34,token);
      plan.steps.forEach(function(copy,stepIndex){
        var when=start+plan.openingMs+stepIndex*plan.stepMs;
        later(function(){
          var final=stepIndex===plan.steps.length-1;
          presenter.setText(payload,copy,!final);
          if(plan.ticks[stepIndex]) V.tick({final:stepIndex===plan.lastSounding});
          if(final&&!presenter.verifyFit(payload)){
            presenter.showFailure(payload);
            if(global.console&&console.warn) console.warn('[Chatter Lab] '+presenterKey+' failed rendered two-line fit: '+payload.text);
          }
        },when,token);
      });
      var reveal=plan.openingMs+(plan.steps.length-1)*plan.stepMs;
      later(function(){ presenter.hide(payload); },start+reveal+dwell,token);
      later(function(){ faces.rest(beat.who); },start+reveal+dwell+100,token);
      at+=reveal+dwell+(total>1?220:0);
    });
    return at;
  }
  function sample(key){
    if(key==='next') key=NEXT[nextIndex++%NEXT.length];
    if(!SAMPLES[key]) key='harry';
    lastSampleKey=key;
    play(SAMPLES[key].beats);
    return {key:key,label:SAMPLES[key].label};
  }

  /* ---------------- the lab API ---------------- */
  function boot(){
    felt=$('felt'); rail=$('cht-rail');
    buildBoard();
    buildBankTower();
    fillReel($('jackpot'),'3480',6);
    var hearts=$('hud-hearts');
    if(hearts){ hearts.innerHTML=heartsHTML(2); hearts.classList.remove('hidden'); }
    var sb=$('hud-sb-indicator'); if(sb) sb.classList.add('is-on');
    buildHumanSeat();
    buildSeats(seatCount);
    mountPresenter(presenterKey);

    global.ChatterStage={
      ready:true,
      visuals:function(){ return P.meta(); },
      getVisual:function(){ return presenterKey; },
      setVisual:function(key){ mountPresenter(key); },
      getSoundEnabled:function(){ return soundEnabled; },
      setSoundEnabled:function(on){ soundEnabled=!!on; V.enabled=soundEnabled; if(!soundEnabled) V.stopAll(); },
      replaySound:function(){ return sample(lastSampleKey); },
      sample:sample,
      residents:function(){ return R.all.map(function(r){ return {id:r.id,name:r.name,seated:seatedIds.indexOf(r.id)!==-1}; }); },
      setSeats:function(n){ stopPlayback(); buildSeats(n); remountPresenter(); },
      getSeats:function(){ return seatCount; },
      setStreet:function(n){ street=Math.max(0,Math.min(5,n)); buildBoard(); },
      stop:stopPlayback
    };

    document.addEventListener('keydown',function(e){
      try{
        if(global.parent&&global.parent!==global&&global.parent.ChatterLabKey) global.parent.ChatterLabKey(e.key,e);
      }catch(err){}
    });
    try{
      if(global.parent&&global.parent!==global&&global.parent.ChatterStageReady) global.parent.ChatterStageReady(global.ChatterStage);
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})(this);
