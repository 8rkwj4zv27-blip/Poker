/* ============================================================
   RESULT STAGE LAB — Phase 1, isolated visual review only.

   Four required outcomes (TABLE CLEARED, RUN OVER, EVENT WON,
   EVENT LOST) rendered through ONE shared construction derived from
   production TABLE CLEARED (tableClearedHTML(), js/05-game-engine.js).

   Nothing here is wired to production. This file is loaded only by
   result-stage-lab.html, which is unlinked from index.html and absent
   from sw.js. Values are fixtures taken from the four review
   screenshots and from fields the game already calculates.

   Two views:
     ?specimen=<key>  a single device-sized specimen and nothing else
     (default)        lab chrome: four selectors + one 393x852 iframe,
                      or an all-four overview at a wider viewport
   The specimen always lives in an iframe so four of them can sit side
   by side without duplicating production element ids.
   ============================================================ */
(function(){
'use strict';

var SUIT_CLASS = {'♠':'spade','♥':'heart','♦':'diamond','♣':'club'};

function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* ---- shared primitives, mirroring production ---- */

/* buildResultCounter()'s markup, as a string. Digit cells tick, symbol
   cells do not — the same split production uses. */
function reelCells(amount, prefix){
  var out = '';
  if (prefix) out += '<span class="jp-cell jp-sym">' + esc(prefix) + '</span>';
  String(amount).split('').forEach(function(ch){
    if (ch === ',' || ch === '$' || ch === '+' || ch === '-'){
      out += '<span class="jp-cell jp-sym' + (ch===','?' jp-comma':'') + '">' + esc(ch) + '</span>';
    } else {
      out += '<span class="jp-cell jp-digit tabular">' + esc(ch) + '</span>';
    }
  });
  return out;
}
/* Six or more cells is where a reel stops fitting its instrument at
   393px; the shared layer has a one-size-down variant for it. */
function isLong(amount, prefix){
  return (String(prefix||'').length + String(amount).length) >= 6;
}
function reel(amount, prefix){ return reelCells(amount, prefix); }

function card(rank, suit){
  return '<div class="card small ' + SUIT_CLASS[suit] + '">' +
    '<div class="ci"><span class="r">' + rank + '</span><span class="s">' + suit + '</span></div>' +
    '<div class="pip">' + suit + '</div></div>';
}

/* Region 1 — heading. Identical construction in all four: context
   eyebrow, result word, machine lamp. */
function head(eyebrow, title){
  return '<header class="stage-results-head pc-raised pc-material-plastic">' +
    '<span>' + esc(eyebrow) + '</span><strong>' + esc(title) + '</strong>' +
    '<i aria-hidden="true"></i></header>';
}

/* Region 2 — the one primary score / reward / financial result.
   Mechanical reel readout + the persistent carry-forward legend. */
function hero(label, amount, prefix, carryLabel, carryValue){
  return '<div class="stage-score-hero pc-display">' +
    '<span class="stage-instrument-label">' + esc(label) + '</span>' +
    '<div class="amt-readout stage-score-readout' + (isLong(amount,prefix)?' is-long':'') + '">' +
      reel(amount, prefix) + '</div>' +
    '<span class="stage-score-carry"><span>' + esc(carryLabel) + '</span>' +
    '<strong class="tabular">' + esc(carryValue) + '</strong></span></div>';
}

/* Region 3a — the two framed instruments. */
function instrument(label, body){
  return '<div class="stage-instrument pc-display">' +
    '<span class="stage-instrument-label">' + esc(label) + '</span>' + body + '</div>';
}
function instrumentReel(label, amount, prefix){
  return instrument(label, '<div class="amt-readout' + (isLong(amount,prefix)?' is-long':'') + '">' +
    reel(amount, prefix) + '</div>');
}
function instrumentLamps(label, lit, total, readout){
  var lamps = '';
  for (var i=0;i<total;i++) lamps += '<span class="stage-ko-slot' + (i<lit?' lit':'') + '"></span>';
  return instrument(label,
    '<div class="stage-ko-lamps">' + lamps + '</div>' +
    '<div class="stage-ko-readout tabular">' + esc(readout) + '</div>');
}
function instrumentBig(label, value){
  return instrument(label, '<div class="stage-ko-readout stage-big-readout tabular">' + esc(value) + '</div>');
}

/* Region 3b — the three-slot CRT memory bank. Production cycles pages
   here (startTableStatCycle); the lab cycles the same way so the
   specimen is live rather than a still. */
function recap(pages){
  return '<div class="stage-results-recap pc-display" data-stage-bank=\'' +
      esc(JSON.stringify(pages)).replace(/'/g,'&#39;') + '\'>' +
    pages[0].map(function(stat,i){
      return '<div class="stage-recap-cell" data-stage-stat="' + i + '">' +
        '<span class="stage-instrument-label">' + esc(stat[0]) + '</span>' +
        '<strong class="stage-recap-value tabular">' + esc(stat[1]) + '</strong></div>';
    }).join('') + '</div>';
}

/* The lamp strip. Positive: production's FLAWLESS SHOWDOWNS. Negative:
   the same module carrying the defeated-by line. */
function lampStrip(tone, text){
  return '<div class="stage-recap-lamp' + (tone==='negative'?' is-negative':'') + '">' +
    '<span class="pc-lamp ' + (tone==='negative'?'is-danger':'is-amber') + '"></span>' +
    '<span class="stage-recap-lamp-text">' + esc(text) + '</span></div>';
}

function deck(instruments, pages, lamp){
  return '<div class="stage-results-deck pc-raised pc-material-plastic">' +
    '<div class="stage-results-instruments">' + instruments + '</div>' +
    recap(pages) + (lamp || '') + '</div>';
}

/* Region 4 — best hand / outcome detail. Same well, two contents. */
function trophyHand(cards, name, desc){
  return '<div class="stage-trophy pc-display">' +
    '<div class="stage-trophy-label">Best hand</div>' +
    '<div class="stage-trophy-cards">' + cards + '</div>' +
    '<div class="stage-trophy-name">' + esc(name) + '</div>' +
    '<div class="stage-trophy-desc">' + esc(desc) + '</div></div>';
}
function trophyEmpty(){
  return '<div class="stage-trophy pc-display">' +
    '<div class="stage-trophy-label">Best hand</div>' +
    '<div class="stage-trophy-empty">No showdown hand recorded</div></div>';
}
function trophyStatement(label, line, sub){
  return '<div class="stage-trophy stage-trophy--statement pc-display">' +
    '<div class="stage-trophy-label">' + esc(label) + '</div>' +
    '<div class="stage-statement">' + esc(line) + '</div>' +
    (sub ? '<div class="stage-statement-sub">' + esc(sub) + '</div>' : '') + '</div>';
}

/* Region 5 — lower progression / status. */
function progress(label, value, next){
  return '<div class="stage-run-progress pc-display">' +
    '<span>' + esc(label) + '</span><strong class="tabular">' + esc(value) + '</strong>' +
    '<em>' + esc(next) + '</em></div>';
}

function machine(parts){
  return '<div class="stage-results-machine pc-material-leather">' + parts.join('') + '</div>';
}

/* ============================================================
   FIXTURES — one entry per required outcome.
   ============================================================ */

var BEST_HAND_CARDS =
  card('6','♠') + card('6','♦') + card('6','♣') +
  card('8','♦') + card('8','♠');

var OUTCOMES = {

  /* ---- 1. TABLE CLEARED — the canonical reference, unchanged ---- */
  'table-cleared': {
    label: 'Table cleared',
    tone: 'positive',
    meta: 'Hand 2 · 10/20 · Table 1',
    score: '0000040',
    dash: 'dormant',
    banner: 'TABLE CLEARED.<br>EVERY OPPONENT IS ELIMINATED.',
    scanner: 'HAND SCANNER READY',
    stack: '$000530',
    invested: '$000',
    actions: [{label:'NEXT TABLE', kind:'primary'}],
    stage: machine([
      head('TABLE 1', 'CLEARED'),
      hero('Table score', '40', '+', 'RUN TOTAL', '0000040'),
      deck(
        instrumentReel('Finish stack', '530', '$') +
        instrumentLamps('K.O.s', 0, 6, '0 / 6'),
        [
          [['Hands won','1 / 1'],['Showdowns won','0 / 0'],['Biggest pot','$530']],
          [['High water','$530'],['Win rate','100%'],['Table length','1 HAND']]
        ]
      ),
      trophyEmpty(),
      progress('TABLES CLEARED', '1', 'NEXT: TABLE 2')
    ])
  },

  /* ---- 2. RUN OVER — negative sibling of TABLE CLEARED ---- */
  'run-over': {
    label: 'Run over',
    tone: 'negative',
    meta: 'Hand 4 · 10/20 · Table 1',
    score: '0000780',
    dash: 'dormant',
    banner: 'RUN OVER.<br>OUT OF CHIPS.',
    scanner: 'FULL HOUSE, SIXES OVER EIGHTS',
    stack: '$000000',
    invested: '$070',
    actions: [{label:'NEW RUN', kind:'primary'}, {label:'MAIN MENU', kind:'secondary'}],
    stage: machine([
      head('BUSTED ON TABLE 1', 'RUN OVER'),
      hero('Final score', '0000780', '', 'RUN RECORD', 'NEW HIGH SCORE'),
      deck(
        instrumentReel('Table reached', '1', '') +
        instrumentBig('K.O.s', '0'),
        [
          [['Hands won','3 / 4'],['Scoring events','2'],['Biggest pot','$530']],
          [['Total hands','4'],['Biggest reward','+0'],['Win rate','75%']]
        ],
        lampStrip('negative', 'BUSTED BY MANIAC · FOUR OF A KIND, SIXES')
      ),
      trophyHand(BEST_HAND_CARDS, 'FULL HOUSE', 'Sixes over Eights'),
      progress('TABLES CLEARED', '0', 'NO REBUY')
    ])
  },

  /* ---- 3. EVENT WON — positive, career ---- */
  'event-won': {
    label: 'Event won',
    tone: 'positive',
    meta: 'Hand 1 · 10/20',
    score: '0000000',
    dash: 'event-complete',
    banner: 'EVENT WON.<br>EVERY OPPONENT IS OUT.',
    scanner: '',
    stack: '',
    invested: '',
    actions: [{label:'BACK TO EVENTS', kind:'primary'}],
    stage: machine([
      head('BACK ROOM FREEZEOUT', 'EVENT WON'),
      hero('Prize', '300', '+$', 'BANKROLL', '$600'),
      deck(
        instrumentBig('Finish', '1ST') +
        instrumentBig('Event score', '0'),
        [
          [['Hands','1'],['Field','6'],['Buy-in','$100']]
        ]
      ),
      trophyStatement('Result', 'EVERY OPPONENT IS OUT', 'FIRST OF SIX · FREEZEOUT'),
      progress('EVENT COMPLETE', '', 'NEXT: EVENTS BOARD')
    ])
  },

  /* ---- 4. EVENT LOST — negative, career ---- */
  'event-lost': {
    label: 'Event lost',
    tone: 'negative',
    meta: 'Hand 3 · 10/20',
    score: '0000540',
    dash: 'event-complete',
    banner: 'EVENT OVER.<br>YOU WERE ELIMINATED.',
    scanner: '',
    stack: '',
    invested: '',
    actions: [{label:'BACK TO EVENTS', kind:'primary'}],
    stage: machine([
      head('BACK ROOM FREEZEOUT', 'EVENT LOST'),
      hero('Buy-in lost', '100', '-$', 'BANKROLL', '$500'),
      deck(
        instrumentBig('Finish', '3RD') +
        instrumentBig('Event score', '540'),
        [
          [['Hands','3'],['Field','6'],['Buy-in','$100']]
        ]
      ),
      trophyStatement('Result', 'YOU WERE ELIMINATED', 'THIRD OF SIX · FREEZEOUT'),
      progress('EVENT ENDED', '', 'NEXT: EVENTS BOARD')
    ])
  }
};

var ORDER = ['table-cleared','run-over','event-won','event-lost'];

/* ============================================================
   SPECIMEN — production table-screen shell around the stage.
   Reproduced from index.html so the chassis sits in the real recessed
   stage bay at the real dimensions, with the real dormant dashboard
   and the real results-mode action console beneath it.
   ============================================================ */

function actionFaceHTML(actions){
  if (actions.length === 1){
    return '<button class="btn-award-console next-table-mode" type="button">' +
      esc(actions[0].label) + '</button>';
  }
  return '<div class="results-actions-row">' + actions.map(function(a){
    return '<button class="btn-award-console ' +
      (a.kind==='secondary' ? 'results-secondary' : 'next-table-mode') +
      '" type="button">' + esc(a.label) + '</button>';
  }).join('') + '</div>';
}

function specimenHTML(o){
  return '' +
  '<div id="app">' +
    '<div id="table-screen" class="screen arcade-active">' +
      '<div class="table-main">' +
        '<div class="topbar">' +
          '<div class="table-identity"><div class="brandmini">POKER</div>' +
            '<div class="meta">' + esc(o.meta) + '</div></div>' +
          '<div class="table-tools">' +
            '<button class="table-save" type="button">Save</button>' +
            '<button class="icon-btn table-settings" aria-label="Settings">⚙</button>' +
          '</div>' +
        '</div>' +
        '<div class="arcade-score-machine" aria-hidden="true">' +
          '<div class="arcade-score-label"><strong>SCORE</strong></div>' +
          '<div class="arcade-score-digits">' +
            o.score.split('').map(function(d){ return '<span>' + d + '</span>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="felt-wrap">' +
          '<div class="stage-bay" id="stage-bay">' +
            '<div class="felt results-mode tone-' + o.tone + '" id="felt">' +
              '<div class="stage-results tone-' + o.tone + ' wake-head wake-score wake-instruments wake-recap wake-trophy wake-progress" id="result-card">' +
                o.stage +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="your-seat-dock">' +
          '<div id="hud-frame" class="' + o.dash + '">' +
            '<div id="hud-left">' +
              '<div id="hud-tower" aria-hidden="true"></div>' +
              '<div class="bank-hatch" aria-hidden="true">' +
                '<div class="bank-hatch-leaf bank-hatch-leaf-l"></div>' +
                '<div class="bank-hatch-leaf bank-hatch-leaf-r"></div></div>' +
            '</div>' +
            '<div id="hud-mid"><div id="hud-status"><div id="hud-status-normal">' +
              '<div class="hand-strength crt-screen crt-hand">' + (o.scanner||'') + '</div>' +
              '<div class="banner crt-screen crt-action">' + o.banner + '</div>' +
              (o.stack ? '<div class="stack-readout">' +
                '<span class="instrument-label">Stack</span>' +
                '<div id="jackpot" role="img">' + reel(o.stack.replace('$',''), '$') + '</div></div>' : '') +
            '</div></div></div>' +
            '<div id="hud-right">' +
              (o.invested ? '<div class="blind-lamps" aria-label="Blind position">' +
                '<div class="blind-indicator"><span>SB</span></div>' +
                '<div class="blind-indicator"><span>BB</span></div></div>' +
              '<div class="bet-this-hand">' +
                '<span class="instrument-label">Bet this hand</span>' +
                '<div class="crt-screen" id="hud-invested">' + esc(o.invested) + '</div></div>' : '') +
              '<div class="hud-speaker" aria-hidden="true">' +
                new Array(21).join('<i></i>') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="action-area">' +
        '<div class="actions-dock">' +
          '<div class="action-console" id="action-console">' +
            '<div class="console-flip flipped" id="console-flip">' +
              '<div class="console-face console-face-actions">' +
                '<div class="actions-flip"><div class="actions-face actions-face-play">' +
                  '<div class="actions-row disabled">' +
                    '<button class="btn-fold">Fold</button>' +
                    '<button class="btn-check">Check</button>' +
                    '<button class="btn-raise">Raise</button>' +
                  '</div></div></div>' +
              '</div>' +
              '<div class="console-face console-face-award">' + actionFaceHTML(o.actions) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* The live CRT memory bank, exactly as production cycles it. */
function startBanks(root){
  root.querySelectorAll('[data-stage-bank]').forEach(function(bank){
    var pages;
    try { pages = JSON.parse(bank.getAttribute('data-stage-bank')); } catch(e){ return; }
    if (!pages || pages.length < 2) return;
    var page = 0;
    var first = true;
    (function swap(){
      setTimeout(function(){
        if (!bank.isConnected) return;
        bank.classList.add('is-switching');
        setTimeout(function(){
          page = (page + 1) % pages.length;
          bank.querySelectorAll('[data-stage-stat]').forEach(function(cell,i){
            var stat = pages[page][i];
            if (!stat) return;
            cell.querySelector('.stage-instrument-label').textContent = stat[0];
            cell.querySelector('.stage-recap-value').textContent = stat[1];
          });
          setTimeout(function(){ bank.classList.remove('is-switching'); },150);
          swap();
        },140);
      }, first ? (first=false, 6000) : 3900);
    })();
  });
}

/* ============================================================
   VIEWS
   ============================================================ */

function frameFor(key){
  return '<iframe class="lab-device" title="' + esc(OUTCOMES[key].label) + '" ' +
    'src="result-stage-lab.html?specimen=' + encodeURIComponent(key) + '" ' +
    'width="393" height="852" loading="eager"></iframe>';
}

function renderLab(root){
  var current = (location.hash || '#table-cleared').slice(1);
  if (!OUTCOMES[current]) current = 'table-cleared';
  var overview = location.hash === '#overview';

  root.className = 'lab-shell';
  root.innerHTML =
    '<header class="lab-bar">' +
      '<h1>Result stage — four outcomes</h1>' +
      '<nav class="lab-picker">' +
        ORDER.map(function(k){
          return '<button type="button" data-outcome="' + k + '"' +
            (!overview && k===current ? ' class="is-on"' : '') + '>' +
            esc(OUTCOMES[k].label) + '</button>';
        }).join('') +
        '<button type="button" data-overview class="lab-overview-btn' +
          (overview?' is-on':'') + '">All four</button>' +
      '</nav>' +
    '</header>' +
    (overview
      ? '<div class="lab-grid">' + ORDER.map(function(k){
          return '<figure class="lab-cell"><figcaption>' + esc(OUTCOMES[k].label) +
            '</figcaption>' + frameFor(k) + '</figure>';
        }).join('') + '</div>'
      : '<div class="lab-single"><figure class="lab-cell"><figcaption>' +
          esc(OUTCOMES[current].label) + ' · 393 × 852</figcaption>' +
          frameFor(current) + '</figure></div>');

  root.querySelectorAll('[data-outcome]').forEach(function(b){
    b.onclick = function(){ location.hash = b.getAttribute('data-outcome'); };
  });
  root.querySelector('[data-overview]').onclick = function(){ location.hash = 'overview'; };
}

function boot(){
  var root = document.getElementById('lab-root');
  var key = new URLSearchParams(location.search).get('specimen');
  if (key && OUTCOMES[key]){
    document.body.classList.add('lab-specimen');
    root.innerHTML = specimenHTML(OUTCOMES[key]);
    startBanks(root);
    return;
  }
  renderLab(root);
  window.addEventListener('hashchange', function(){ renderLab(root); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
