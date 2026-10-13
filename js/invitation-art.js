/* ============================================================
   INVITATION ART (placeholder) — a little pixel scene for each invitation
   event, until the owner's own art exists. Drawn on a 120 × 76 grid in
   hard-edged rectangles (the art window's shape), apart from every word on
   the card (js/invitation-cards.js), so a real picture replaces one entry:
     ART['back-room'] = '<img src="…" alt="">'
   ============================================================ */
(() => {
  'use strict';
  const W = 120, H = 76;
  const r = (x, y, w, h, c) => `<path d="M${x} ${y}h${w}v${h}h-${w}z" fill="${c}"/>`;
  const svg = body => `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${body}</svg>`;
  // a vertical band of colours, top to bottom (a stepped sky or wall)
  const bands = (cols, y0 = 0, y1 = H) => cols.map((c, i) => {
    const a = Math.round(y0 + (y1 - y0) * i / cols.length), b = Math.round(y0 + (y1 - y0) * (i + 1) / cols.length);
    return r(0, a, W, b - a, c);
  }).join('');
  // a 2-pixel checker of a colour over a rectangle (dithering)
  const dither = (x, y, w, h, c, step = 2) => { let s = ''; for (let j = y; j < y + h; j += step) for (let i = x + ((j - y) / step % 2) * step; i < x + w; i += step * 2) s += r(i, j, 1, 1, c); return s; };
  // a cone of light from (x, y) widening down to the floor
  const cone = (x, y, w0, w1, h, c) => { let s = ''; for (let j = 0; j < h; j += 2){ const w = Math.round(w0 + (w1 - w0) * j / h); s += r(Math.round(x - w / 2), y + j, w, 2, c); } return s; };
  const chip = (x, y, c, hi = '#f4ead0') => r(x, y, 8, 3, c) + r(x + 1, y - 1, 6, 1, c) + r(x + 2, y, 1, 3, hi) + r(x + 5, y, 1, 3, hi) + r(x, y + 3, 8, 1, '#0b0f0c');
  const stack = (x, y, c, n, hi) => Array.from({ length:n }, (_, i) => chip(x, y - i * 3, c, hi)).join('');
  const card = (x, y, red = false, back = false) => r(x + 1, y + 1, 9, 12, '#0b0f0c') + r(x, y, 9, 12, back ? '#7a2d38' : '#f4efe1')
    + (back ? r(x + 2, y + 2, 5, 8, '#a8495a') : r(x + 3, y + 4, 3, 4, red ? '#b8322b' : '#22201c'));
  const person = (x, y, c, face = '#e3c39a') => r(x + 2, y, 6, 6, face) + r(x + 3, y + 2, 1, 1, '#1a1210') + r(x + 6, y + 2, 1, 1, '#1a1210')
    + r(x, y + 6, 10, 9, c) + r(x + 1, y - 1, 8, 2, '#2a1a12');
  const star = (x, y, c) => r(x, y - 2, 1, 5, c) + r(x - 2, y, 5, 1, c);
  // a green table seen from the side, front edge at y
  const table = (x, y, w, felt = '#2f6b4a') => r(x, y - 6, w, 6, felt) + r(x + 2, y - 7, w - 4, 1, '#4f8f68') + r(x - 2, y, w + 4, 3, '#6b4a2a') + r(x - 2, y + 3, w + 4, 1, '#3a2614');

  const ART = {
    // a bare bulb over a back-room table, smoke hanging in the light
    'back-room':svg(bands(['#140b0c', '#1c1012', '#24161a', '#2c1a1e']) + r(0, 58, W, 18, '#1a0f10')
      + cone(60, 12, 14, 64, 46, '#3a2a1c') + cone(60, 12, 8, 40, 46, '#4a3622')
      + r(59, 0, 2, 8, '#0b0b0b') + r(54, 8, 12, 4, '#c9a35a') + r(57, 12, 6, 2, '#fff1b8')
      + dither(30, 18, 60, 10, '#5a4a3a', 3) + table(28, 58, 64)
      + card(46, 46) + card(57, 46, true) + card(68, 46, false, true) + stack(34, 50, '#b96a43', 3) + stack(80, 50, '#e4bb52', 4)
      + person(12, 40, '#3c2a4a') + person(98, 40, '#24384a')),
    // the table from above, every seat taken
    'full-house':svg(r(0, 0, W, H, '#1a1214') + dither(0, 0, W, H, '#241a1c', 4)
      + r(16, 14, 88, 48, '#6b4a2a') + r(18, 16, 84, 44, '#2f6b4a') + r(22, 20, 76, 36, '#3a7a55')
      + [[26, 8], [56, 6], [86, 8], [26, 60], [56, 62], [86, 60]].map(([x, y], i) => r(x, y, 10, 8, ['#a8495a', '#4a6a9a', '#c99a3a', '#5a8a5a', '#8a5aa8', '#c96a3a'][i]) + r(x + 2, y + 2, 6, 4, '#e3c39a')).join('')
      + card(40, 32) + card(51, 32, true) + card(62, 32) + card(73, 32, true) + stack(28, 40, '#e4bb52', 2) + stack(84, 40, '#b96a43', 3)),
    // last orders: the bar clock past two, the sign half off
    'closing-time':svg(bands(['#0e1424', '#141c30', '#1a2238']) + r(0, 50, W, 26, '#2a1810') + r(0, 50, W, 3, '#6b4a2a')
      + r(8, 8, 30, 12, '#1a0f10') + r(10, 10, 26, 8, '#3a1418') + r(12, 12, 4, 4, '#ff6a8a') + r(18, 12, 4, 4, '#5a2a30') + r(24, 12, 4, 4, '#ff6a8a') + r(30, 12, 4, 4, '#5a2a30')
      + r(78, 6, 26, 26, '#c9a35a') + r(80, 8, 22, 22, '#f4efe1') + r(90, 10, 2, 9, '#22201c') + r(91, 18, 7, 2, '#b8322b')
      + [[16, 38], [30, 40], [96, 38]].map(([x, y]) => r(x, y, 6, 12, '#7fb5c8') + r(x + 1, y + 2, 4, 5, '#c9a35a')).join('')
      + card(50, 40, false, true) + card(60, 41, false, true) + stack(72, 48, '#4a6a9a', 2)
      + dither(0, 22, W, 6, '#24304a', 3)),
    // two players across the felt, one card each between them
    'face-to-face':svg(bands(['#1a0c10', '#24101a', '#2e1420']) + cone(30, 0, 6, 30, 60, '#3a2028') + cone(90, 0, 6, 30, 60, '#2a2438')
      + table(18, 62, 84) + r(14, 26, 22, 30, '#0b0b0b') + r(17, 18, 16, 12, '#0b0b0b') + r(84, 26, 22, 30, '#0b0b0b') + r(87, 18, 16, 12, '#0b0b0b')
      + r(21, 22, 3, 2, '#e3c39a') + r(96, 22, 3, 2, '#e3c39a')
      + card(46, 46) + card(64, 46, true) + r(58, 38, 4, 4, '#e4bb52')),
    // stacks like towers, the city of chips
    'deep-pockets':svg(bands(['#0c1626', '#122036', '#1a2a44', '#24365a']) + star(14, 8, '#fff4c8') + star(102, 12, '#fff4c8') + star(70, 6, '#cfe0ff')
      + r(0, 66, W, 10, '#0b1a12') + stack(14, 62, '#4a6a9a', 6) + stack(28, 62, '#e4bb52', 12) + stack(44, 62, '#b96a43', 16)
      + stack(58, 62, '#e4bb52', 19) + stack(72, 62, '#a8495a', 14) + stack(86, 62, '#4a6a9a', 10) + stack(100, 62, '#e4bb52', 7)),
    // the sponsor's banner, two spotlights, confetti in the air
    'sponsored-night':svg(bands(['#1a0a1e', '#260e2a', '#321238']) + cone(18, 0, 4, 40, 70, '#3a1e40') + cone(102, 0, 4, 40, 70, '#3a1e40')
      + r(18, 10, 84, 18, '#7a5214') + r(20, 12, 80, 14, '#c9a35a') + r(24, 16, 72, 6, '#7a2d38') + r(30, 18, 60, 2, '#f4efe1')
      + table(26, 66, 68, '#3a7a55') + stack(40, 58, '#e4bb52', 4) + stack(72, 58, '#e4bb52', 5) + card(54, 50, true)
      + [[10, 34, '#ff6a8a'], [30, 40, '#7fd0ff'], [50, 32, '#fff4a0'], [86, 36, '#9aff9a'], [104, 42, '#ff6a8a'], [70, 30, '#7fd0ff'], [20, 50, '#fff4a0'], [96, 52, '#9aff9a']]
        .map(([x, y, c]) => r(x, y, 2, 2, c)).join('')),
    // one tower left standing at sundown, the crown on top
    'last-stack-wins':svg(bands(['#3a1424', '#6a2430', '#a83a2a', '#d8682a', '#f0a03a']) + r(46, 40, 28, 28, '#f6d06a') + r(42, 46, 36, 16, '#f6d06a')
      + r(0, 60, W, 16, '#1a0e0a') + r(10, 58, 30, 4, '#24140e') + r(80, 57, 34, 5, '#24140e')
      + stack(56, 58, '#2a1a14', 15, '#5a3a2a') + r(55, 7, 10, 3, '#e4bb52') + r(55, 4, 2, 3, '#e4bb52') + r(59, 3, 2, 4, '#e4bb52') + r(63, 4, 2, 3, '#e4bb52')
      + r(18, 62, 8, 2, '#0b0b0b') + r(92, 62, 10, 2, '#0b0b0b')),
    // a door left ajar on a lit room, the rope on its brass posts
    'private-game':svg(r(0, 0, W, H, '#200e14') + dither(0, 0, W, H, '#2a121a', 4) + r(0, 62, W, 14, '#140a0c')
      + r(40, 8, 40, 56, '#4a2a1a') + r(42, 10, 36, 54, '#f0c86a') + cone(60, 20, 30, 70, 44, '#e8b85a') + r(42, 10, 14, 54, '#6a3a22') + r(52, 36, 2, 3, '#e4bb52')
      + r(14, 44, 4, 20, '#c9a35a') + r(102, 44, 4, 20, '#c9a35a') + r(13, 42, 6, 3, '#f6dc8c') + r(101, 42, 6, 3, '#f6dc8c')
      + r(18, 48, 22, 3, '#a8243a') + r(80, 48, 22, 3, '#a8243a') + r(30, 50, 10, 2, '#a8243a') + r(80, 50, 10, 2, '#a8243a')),
    // the trophy on the last table, the crowd in the dark
    'final-table':svg(bands(['#0a0a14', '#10101e', '#161628']) + cone(60, 0, 8, 60, 64, '#24243a') + cone(60, 0, 4, 36, 64, '#2e2e48')
      + Array.from({ length:12 }, (_, i) => r(2 + i * 10, 50 + (i % 3), 7, 8, '#06060c') + r(3 + i * 10, 46 + (i % 3), 5, 5, '#06060c')).join('')
      + table(22, 70, 76) + r(52, 30, 16, 4, '#f6dc8c') + r(54, 34, 12, 12, '#e4bb52') + r(48, 34, 6, 7, '#c99a3a') + r(66, 34, 6, 7, '#c99a3a')
      + r(58, 46, 4, 6, '#b88a2a') + r(53, 52, 14, 4, '#e4bb52') + r(57, 36, 2, 6, '#fff4c8') + star(44, 26, '#fff4c8') + star(76, 28, '#fff4c8')),
    // the ticket itself, blazing
    'golden-ticket':svg(r(0, 0, W, H, '#2a1a08') + Array.from({ length:12 }, (_, i) => {
        const a = i * Math.PI / 6, x = Math.round(60 + Math.cos(a) * 70), y = Math.round(38 + Math.sin(a) * 50);
        let s = ''; for (let k = 0; k < 14; k++){ const t = k / 14; s += r(Math.round(60 + (x - 60) * t), Math.round(38 + (y - 38) * t), 3, 3, k % 2 ? '#5a3a10' : '#7a5214'); }
        return s;
      }).join('')
      + r(26, 22, 70, 34, '#7a5214') + r(24, 20, 70, 34, '#e3c06a') + r(28, 24, 62, 26, '#f6dc8c') + r(24, 33, 3, 8, '#2a1a08') + r(91, 33, 3, 8, '#2a1a08')
      + r(34, 30, 40, 3, '#7a5214') + r(34, 36, 50, 2, '#a8812e') + r(34, 41, 30, 2, '#a8812e') + r(78, 28, 8, 8, '#c9a35a') + r(80, 30, 4, 4, '#f6dc8c')
      + star(16, 12, '#fff4c8') + star(104, 10, '#fff4c8') + star(100, 62, '#fff4c8') + star(12, 60, '#fff4c8'))
  };
  window.InvitationArt = Object.freeze({ get:key => ART[key] || ART['back-room'], has:key => key in ART });
})();
