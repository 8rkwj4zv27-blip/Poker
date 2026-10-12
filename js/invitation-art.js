/* ============================================================
   INVITATION ART (lab, placeholder) — one simple symbol per invitation
   event, kept apart from every word on the card (js/invitation-cards.js)
   so the owner's own illustrations can replace these one by one.

   Each entry is the picture for one `art` key, drawn on the event cards'
   96 × 72 pixel grid in hard-edged rectangles. To use real artwork, set
   that key to an image instead, e.g.
     'back-room': '<img src="assets/cards/back-room.png" alt="">'
   (art lives in art-source/ until it is ready to ship; CLAUDE.md).
   ============================================================ */
(() => {
  'use strict';
  const r = (x, y, w, h, c) => `<path d="M${x} ${y}h${w}v${h}h-${w}z" fill="${c}"/>`;
  const svg = body => `<svg viewBox="0 0 96 72" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${body}</svg>`;
  // the shared backdrop: a plain felt panel, so every symbol reads alike
  const felt = (top = '#1f4a36', floor = '#173a2a') => r(0, 0, 96, 72, top) + r(0, 52, 96, 20, floor);
  const card = (x, y, c = '#f4efe1', pip = '#2a2a24') => r(x + 1, y + 1, 14, 20, '#0d0f0c') + r(x, y, 14, 20, c) + r(x + 5, y + 7, 4, 6, pip);
  const chip = (x, y, c) => r(x - 6, y - 2, 12, 5, '#0d1f17') + r(x - 6, y - 4, 12, 5, c) + r(x - 2, y - 3, 4, 2, '#eee2b8');
  const stack = (x, y, c, n) => Array.from({ length:n }, (_, i) => chip(x, y - i * 4, c)).join('');

  const ART = {
    'back-room':svg(felt() + r(45, 0, 6, 10, '#2a2218') + r(36, 10, 24, 6, '#c9a35a') + r(40, 16, 16, 2, '#ffe9a8') +
      r(16, 40, 64, 14, '#0c241a') + r(18, 38, 60, 12, '#2f6b4a') + card(30, 30) + card(50, 30, '#f4efe1', '#b3322b')),
    'full-house':svg(felt() + r(20, 26, 56, 22, '#0c241a') + r(22, 24, 52, 20, '#2f6b4a') +
      [[24, 14], [44, 10], [64, 14], [24, 50], [44, 54], [64, 50]].map(([x, y]) => r(x, y, 8, 8, '#e3c37a')).join('')),
    'closing-time':svg(felt() + r(30, 10, 36, 36, '#0d0f0c') + r(32, 8, 32, 32, '#f4efe1') + r(47, 12, 2, 13, '#2a2a24') +
      r(47, 24, 11, 2, '#b3322b') + r(36, 44, 24, 4, '#c9a35a')),
    'face-to-face':svg(felt() + card(22, 22) + card(60, 22, '#f4efe1', '#b3322b') + r(40, 30, 16, 4, '#e3c37a')),
    'deep-pockets':svg(felt() + stack(32, 52, '#5b7fa3', 8) + stack(56, 52, '#c9a35a', 10)),
    'sponsored-night':svg(felt('#3a1f30', '#2a1622') + r(14, 14, 68, 18, '#c9a35a') + r(16, 16, 64, 14, '#7a2d38') +
      r(26, 21, 44, 4, '#f4efe1') + r(20, 32, 4, 24, '#2a2218') + r(72, 32, 4, 24, '#2a2218') + stack(48, 56, '#e3c37a', 3)),
    'last-stack-wins':svg(felt() + r(38, 8, 20, 4, '#e3c37a') + r(38, 4, 4, 4, '#e3c37a') + r(46, 4, 4, 4, '#e3c37a') + r(54, 4, 4, 4, '#e3c37a') +
      stack(48, 56, '#b96a43', 9)),
    'bounty-night':svg(felt('#3a2418', '#2a1a12') + r(30, 14, 36, 36, '#d9c48c') + r(36, 20, 24, 24, '#7a2d38') +
      r(42, 26, 12, 12, '#d9c48c') + r(46, 30, 4, 4, '#7a2d38') + r(47, 8, 2, 48, '#1a120c') + r(24, 31, 48, 2, '#1a120c')),
    'threes-company':svg(felt() + card(26, 24) + card(41, 18, '#f4efe1', '#b3322b') + card(56, 24)),
    'private-game':svg(felt('#24171f', '#1a1016') + r(30, 18, 16, 16, '#c9a35a') + r(34, 22, 8, 8, '#24171f') +
      r(46, 24, 26, 4, '#c9a35a') + r(62, 28, 4, 6, '#c9a35a') + r(68, 28, 4, 8, '#c9a35a')),
    'final-table':svg(felt() + r(34, 8, 28, 4, '#e3c37a') + r(36, 12, 24, 16, '#c9a35a') + r(28, 12, 6, 10, '#c9a35a') +
      r(62, 12, 6, 10, '#c9a35a') + r(44, 28, 8, 10, '#a7853f') + r(36, 38, 24, 6, '#c9a35a') + r(32, 44, 32, 4, '#7d6230')),
    'pair-pressure':svg(felt('#2a2140', '#1f1830') + card(30, 26) + card(48, 26) + r(44, 8, 8, 4, '#e3c37a') +
      r(40, 12, 16, 4, '#e3c37a') + r(46, 16, 4, 6, '#e3c37a')),
    'golden-ticket':svg(r(0, 0, 96, 72, '#3a2a12') + r(0, 52, 96, 20, '#2a1e0c') + r(14, 18, 68, 36, '#7d5a1c') +
      r(12, 16, 68, 36, '#e3c06a') + r(16, 20, 60, 28, '#f6dc8c') + r(12, 30, 4, 8, '#3a2a12') + r(76, 30, 4, 8, '#3a2a12') +
      r(26, 30, 44, 4, '#7d5a1c') + r(32, 38, 32, 3, '#a7853f'))
  };
  window.InvitationArt = Object.freeze({ get:key => ART[key] || ART['back-room'], keys:Object.keys(ART) });
})();
