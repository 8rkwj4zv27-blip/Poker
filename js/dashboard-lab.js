/* ============================================================
   DASHBOARD LAB — visual-refinement comparison only.

   One static fixture of the production player dashboard
   (#your-seat-dock + .actions-dock, verbatim production markup and
   classes), shown at 393x852. Four buttons (D0/T1/T2/T3) toggle a
   single data-option attribute on the specimen; every option shares
   the exact same markup and geometry — see css/dashboard-lab.css for
   what each option actually changes.

   Not wired to production. Loaded only by dashboard-lab.html, which is
   unlinked from index.html and absent from sw.js.
   ============================================================ */
(function(){
'use strict';

var SUIT_CLASS = {'♠':'spade','♥':'heart','♦':'diamond','♣':'club'};
var OPTIONS = [
  {key:'d0', label:'D0 · Baseline'},
  {key:'t1', label:'T1 · Tidy'},
  {key:'t2', label:'T2 · Unified cabinet'},
  {key:'t3', label:'T3 · CRT emphasis'}
];

function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* mirrors cardInner()/cardClass() in js/06-presentation.js */
function card(rank, suit){
  return '<div class="card ' + SUIT_CLASS[suit] + '">' +
    '<div class="ci"><span class="r">' + esc(rank) + '</span><span class="s">' + suit + '</span></div>' +
    '<div class="pip">' + suit + '</div></div>';
}

/* mirrors reelCells() in js/result-stage-lab.js — same .jp-cell reel
   the production stack/pot/result readouts already use. */
function reel(amount, prefix){
  var out = '<span class="jp-cell jp-sym">' + esc(prefix) + '</span>';
  String(amount).split('').forEach(function(ch){
    out += ch === ','
      ? '<span class="jp-cell jp-sym jp-comma">,</span>'
      : '<span class="jp-cell jp-digit tabular">' + ch + '</span>';
  });
  return out;
}

function chipTower(colors){
  return '<div class="chip-stack">' + colors.map(function(c){
    return '<div class="chip-disc ' + c + '"></div>';
  }).join('') + '</div>';
}

/* ---- single static game-state fixture ---- */
function specimenHTML(){
  return (
    '<div class="felt-wrap"><div class="felt"></div></div>' +
    '<div id="your-seat-dock">' +
      '<div id="hud-frame">' +
        '<div id="hud-left">' +
          '<div id="hud-tower" aria-hidden="true">' +
            chipTower(['d-red v-1','d-blue v-2','d-green v-1','d-yellow v-3']) +
          '</div>' +
        '</div>' +
        '<div id="hud-mid">' +
          '<div class="seat you">' +
            '<div class="seat-cards">' + card('K','♦') + card('7','♣') + '</div>' +
          '</div>' +
          '<div id="hud-status">' +
            '<div id="hud-status-normal">' +
              '<div class="hand-strength crt-screen crt-hand hand-tier-2" id="hand-strength"><b>Two Pair, Kings and Sevens</b></div>' +
              '<div class="banner crt-screen crt-action" id="banner">' +
                '<span class="crt-line-primary">Sam checks.</span>' +
                '<span class="crt-line-secondary">Your turn — check or raise</span>' +
              '</div>' +
              '<div class="stack-readout">' +
                '<span class="instrument-label">Stack</span>' +
                '<div id="jackpot" role="img" aria-label="Player stack: 1,240">' + reel('1,240','$') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="hud-right">' +
          '<div class="hearts hidden" id="hud-hearts" aria-hidden="true"></div>' +
          '<div class="blind-lamps" aria-label="Blind position">' +
            '<div class="blind-indicator is-on"><span>SB</span></div>' +
            '<div class="blind-indicator"><span>BB</span></div>' +
          '</div>' +
          '<div class="bet-this-hand">' +
            '<span class="instrument-label">Bet this hand</span>' +
            '<div class="crt-screen" id="hud-invested" role="img" aria-label="Bet this hand: 120">$120</div>' +
          '</div>' +
          '<div class="action-slot act-empty hidden" id="hud-action">&ndash;</div>' +
          '<div class="pos-btn hidden" id="hud-pos"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="action-area">' +
      '<div class="actions-dock">' +
        '<div class="action-console">' +
          '<div class="console-flip">' +
            '<div class="console-face console-face-actions">' +
              '<div class="actions-flip">' +
                '<div class="actions-face actions-face-play">' +
                  '<div class="actions-row">' +
                    '<button class="btn-fold" type="button">Fold</button>' +
                    '<button class="btn-check" type="button">Call 120</button>' +
                    '<button class="btn-raise" type="button">Raise</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function renderChrome(root){
  root.className = 'lab-shell';
  root.innerHTML =
    '<header class="lab-bar">' +
      '<h1>Player dashboard — D0/T1/T2/T3</h1>' +
      '<nav class="lab-picker">' +
        OPTIONS.map(function(o, i){
          return '<button type="button" data-option="' + o.key + '"' +
            (i === 0 ? ' class="is-on"' : '') + '>' + esc(o.label) + '</button>';
        }).join('') +
      '</nav>' +
    '</header>' +
    '<div class="lab-single">' +
      '<figure class="lab-cell">' +
        '<figcaption>393 &times; 852</figcaption>' +
        '<div class="lab-device" id="lab-device" data-option="d0">' + specimenHTML() + '</div>' +
      '</figure>' +
    '</div>';

  var device = root.querySelector('#lab-device');
  var buttons = root.querySelectorAll('[data-option]');
  buttons.forEach(function(b){
    b.onclick = function(){
      var key = b.getAttribute('data-option');
      device.setAttribute('data-option', key);
      buttons.forEach(function(x){ x.classList.toggle('is-on', x === b); });
    };
  });
}

function boot(){
  renderChrome(document.getElementById('lab-root'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
