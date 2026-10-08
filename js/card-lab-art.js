"use strict";

/* ============================================================
   CARD LAB — the pixel art (lab only, never loaded by the game)

   Every card is one canvas at art resolution (88 × 124 art pixels),
   scaled up whole. Nothing is a picture file: the four illustrations,
   the three frame directions and the card back are drawn here, in code,
   with a small set of pixel tools:

     px / rect / line / disc / ellipse / poly   hard-edged shapes
     ramp()      a value 0..1 quantised to a colour ramp with 4×4 ordered
                 dithering, which is how the scenes are lit
     sprite()    hand-placed pixels from rows of characters
     text5()     a proportional 5×7 pixel font for titles
     text3()     a 3×5 pixel font for the small print

   Scenes are drawn at 84 × 120 (the full-art window) and animate from a
   time t in seconds; the smaller frames show a window of them.
   ============================================================ */
const CardArt = (() => {
  const W = 88, H = 124, SW = 84, SH = 120;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function tools(ctx){
    const T = {
      ctx,
      px(x, y, c){ ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, w, h, c){ ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); },
      line(x0, y0, x1, y1, c){
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        ctx.fillStyle = c;
        for (;;){ ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy){ err += dy; x0 += sx; } if (e2 <= dx){ err += dx; y0 += sy; } }
      },
      disc(cx, cy, r, c){ T.ellipse(cx, cy, r, r, c); },
      ellipse(cx, cy, rx, ry, c){
        ctx.fillStyle = c;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++){
          const dy = (y + .5 - cy) / ry;
          if (Math.abs(dy) > 1) continue;
          const half = rx * Math.sqrt(1 - dy * dy);
          const a = Math.round(cx - half), b = Math.round(cx + half);
          if (b > a) ctx.fillRect(a, y, b - a, 1);
        }
      },
      poly(pts, c){
        ctx.fillStyle = c;
        let minY = Infinity, maxY = -Infinity;
        pts.forEach(p => { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++){
          const xs = [];
          for (let i = 0; i < pts.length; i++){
            const a = pts[i], b = pts[(i + 1) % pts.length];
            if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5)){
              xs.push(a[0] + (y + .5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
            }
          }
          xs.sort((p, q) => p - q);
          for (let i = 0; i + 1 < xs.length; i += 2){ const a = Math.round(xs[i]), b = Math.round(xs[i + 1]); if (b > a) ctx.fillRect(a, y, b - a, 1); }
        }
      },
      /* a field of values quantised to a colour ramp, dithered */
      field(x0, y0, w, h, fn, ramp){
        const n = ramp.length;
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++){
          const v = fn(x, y);
          if (v == null) continue;
          T.px(x, y, ramp[rampIndex(v, n, x, y)]);
        }
      },
      sprite(rows, x, y, pal, flip){
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++){
            const ch = row[flip ? row.length - 1 - i : i];
            const c = pal[ch];
            if (c){ ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); }
          }
        });
      }
    };
    return T;
  }
  function rampIndex(v, n, x, y){
    const f = Math.max(0, Math.min(.9999, v)) * (n - 1);
    const i = Math.floor(f), frac = f - i;
    const th = (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;
    return Math.min(n - 1, frac > th ? i + 1 : i);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h >>> 0) / 4294967296; };

  /* ---------------- fonts ---------------- */
  const F5 = {
    A:['.###.','#...#','#...#','#####','#...#','#...#','#...#'], B:['####.','#...#','#...#','####.','#...#','#...#','####.'],
    C:['.###.','#...#','#....','#....','#....','#...#','.###.'], D:['####.','#...#','#...#','#...#','#...#','#...#','####.'],
    E:['#####','#....','#....','####.','#....','#....','#####'], F:['#####','#....','#....','####.','#....','#....','#....'],
    G:['.###.','#...#','#....','#.###','#...#','#...#','.####'], H:['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
    I:['###','.#.','.#.','.#.','.#.','.#.','###'], J:['..###','...#.','...#.','...#.','#..#.','#..#.','.##..'],
    K:['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'], L:['#....','#....','#....','#....','#....','#....','#####'],
    M:['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'], N:['#...#','##..#','#.#.#','#..##','#...#','#...#','#...#'],
    O:['.###.','#...#','#...#','#...#','#...#','#...#','.###.'], P:['####.','#...#','#...#','####.','#....','#....','#....'],
    Q:['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'], R:['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
    S:['.####','#....','#....','.###.','....#','....#','####.'], T:['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
    U:['#...#','#...#','#...#','#...#','#...#','#...#','.###.'], V:['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
    W:['#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#'], X:['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
    Y:['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'], Z:['#####','....#','...#.','..#..','.#...','#....','#####'],
    0:['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'], 1:['.#.','##.','.#.','.#.','.#.','.#.','###'],
    2:['.###.','#...#','....#','...#.','..#..','.#...','#####'], 3:['####.','....#','....#','.###.','....#','....#','####.'],
    4:['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'], 5:['#####','#....','####.','....#','....#','#...#','.###.'],
    6:['.###.','#....','#....','####.','#...#','#...#','.###.'], 7:['#####','....#','...#.','..#..','.#...','.#...','.#...'],
    8:['.###.','#...#','#...#','.###.','#...#','#...#','.###.'], 9:['.###.','#...#','#...#','.####','....#','....#','.###.'],
    "'":['#','#','#','.','.','.','.'], '-':['....','....','....','####','....','....','....'], '.':['.','.','.','.','.','.','#'],
    '!':['#','#','#','#','#','.','#'], '$':['..#..','.####','#.#..','.###.','..#.#','####.','..#..'], '/':['....#','...#.','...#.','..#..','.#...','.#...','#....'],
    ':':['.','#','.','.','.','#','.'], '?':['.###.','#...#','...#.','..#..','..#..','.....','..#..'], '&':['.##..','#..#.','#.#..','.#...','#.#.#','#..#.','.##.#'],
    ' ':['.','.','.','.','.','.','.'], '+':['.....','..#..','..#..','#####','..#..','..#..','.....'], '×':['.....','#...#','.#.#.','..#..','.#.#.','#...#','.....']
  };
  const F3 = {
    A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110', E:'111100110100111',
    F:'111100110100100', G:'011100101101011', H:'101101111101101', I:'111010010010111', J:'001001001101010',
    K:'101101110101101', L:'100100100100111', M:'101111111101101', N:'110101101101101', O:'010101101101010',
    P:'110101110100100', Q:'010101101110011', R:'110101110101101', S:'011100010001110', T:'111010010010010',
    U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101', Y:'101101010010010',
    Z:'111001010100111', 0:'111101101101111', 1:'010110010010111', 2:'110001010100111', 3:'110001010001110',
    4:'101101111001001', 5:'111100110001110', 6:'011100111101111', 7:'111001010010010', 8:'111101111101111',
    9:'111101111001110', '$':'011110010011110', '-':'000000111000000', '.':'000000000000010', '/':'001001010100100',
    "'":'010010000000000', '!':'010010010000010', ',':'000000000010100', ':':'000010000010000', '?':'110001010000010',
    '+':'000010111010000', '×':'000101010101000', '·':'000000010000000', '%':'101001010100101', ' ':'000000000000000'
  };
  function text5Width(s){ s = String(s).toUpperCase(); let w = 0; for (const ch of s){ const g = F5[ch] || F5['?']; w += g[0].length + 1; } return Math.max(0, w - 1); }
  function text5(T, s, x, y, c, shadow){
    s = String(s).toUpperCase();
    if (shadow) text5(T, s, x + 1, y + 1, shadow);
    let cx = x;
    for (const ch of s){
      const g = F5[ch] || F5['?'];
      g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') T.px(cx + i, y + j, c); });
      cx += g[0].length + 1;
    }
  }
  function text5C(T, s, cx, y, c, shadow){ text5(T, s, Math.round(cx - text5Width(s) / 2), y, c, shadow); }
  function text3(T, s, x, y, c, shadow){
    s = String(s).toUpperCase();
    if (shadow) text3(T, s, x + 1, y + 1, shadow);
    for (let i = 0; i < s.length; i++){
      const g = F3[s[i]] || F3['?'];
      for (let p = 0; p < 15; p++) if (g[p] === '1') T.px(x + i * 4 + (p % 3), y + Math.floor(p / 3), c);
    }
  }
  const text3W = s => String(s).length * 4 - 1;
  function text3C(T, s, cx, y, c, shadow){ text3(T, s, Math.round(cx - text3W(s) / 2), y, c, shadow); }
  function wrap3(s, max){
    const words = String(s).toUpperCase().split(' '), lines = [];
    let cur = '';
    words.forEach(w => { if ((cur ? cur + ' ' + w : w).length > max){ if (cur) lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; });
    if (cur) lines.push(cur);
    return lines;
  }

  /* ============================================================
     THE SCENES (84 × 120)
     ============================================================ */
  const cache = {};
  function layer(key, draw){
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = SW; c.height = SH;
    draw(tools(c.getContext('2d')));
    return (cache[key] = c);
  }

  /* ---- 1. HARRY'S TABLE: the back room, the bulb, the fedora, the cigar ---- */
  const HARRY = {
    focus:22,
    draw(T, t){
      const sway = Math.round(Math.sin(t * 1.4) * 1.6);
      const flick = (Math.floor(t * 9) % 23 === 0) ? .55 : 1;
      const lx = 42 + sway, ly = 13;
      // the brick wall, lit by the bulb (cached per sway step and flicker)
      const wall = layer('harry-wall' + sway + (flick < 1 ? 'f' : ''), L => {
        const BR = ['#0B0608', '#170C0B', '#26140F', '#3A1F15', '#55301C', '#744424', '#96602F'];
        const MO = ['#070405', '#0F0807', '#1A0E0B', '#28160F', '#3A2114', '#4E2D19', '#66401F'];
        L.field(0, 0, SW, 86, (x, y) => {
          const row = Math.floor(y / 5), off = row % 2 ? 4 : 0;
          const mortar = y % 5 === 4 || (x + off) % 9 === 8;
          const d = Math.hypot((x - lx) * .9, (y - ly) * 1.15);
          let v = Math.max(0, 1 - d / 62) * flick;
          // the cone below the shade is brighter
          const cone = y > ly ? Math.max(0, 1 - Math.abs(x - lx) / (6 + (y - ly) * .7)) * .35 : 0;
          v = Math.min(1, v * .95 + cone * flick);
          const n = (hash(Math.floor((x + off) / 9), row) - .5) * .12;
          return mortar ? v * .75 : v + n;
        }, BR);
        // the mortar ramp over the mortar lines only
        L.field(0, 0, SW, 86, (x, y) => {
          const row = Math.floor(y / 5), off = row % 2 ? 4 : 0;
          const mortar = y % 5 === 4 || (x + off) % 9 === 8;
          if (!mortar) return null;
          const d = Math.hypot((x - lx) * .9, (y - ly) * 1.15);
          return Math.max(0, 1 - d / 62) * flick * .9;
        }, MO);
        // a framed poster, half lost in the dark
        L.rect(6, 22, 15, 20, '#120A09'); L.rect(7, 23, 13, 18, '#2A1A14');
        L.rect(8, 24, 11, 8, '#4A2A1C'); L.px(13, 27, '#7A4A2A'); L.px(12, 28, '#7A4A2A'); L.px(14, 28, '#7A4A2A');
        L.rect(9, 34, 9, 1, '#3A241A'); L.rect(9, 36, 7, 1, '#3A241A');
      });
      T.ctx.drawImage(wall, 0, 0);
      // the cord and the shade
      T.line(42, 0, lx, ly - 4, '#1A1210');
      T.poly([[lx - 6, ly + 1], [lx + 6, ly + 1], [lx + 3, ly - 4], [lx - 3, ly - 4]], '#2E3A2A');
      T.line(lx - 6, ly + 1, lx + 6, ly + 1, '#4E6046');
      T.px(lx - 2, ly - 3, '#5E7256');
      // the bulb
      T.ellipse(lx, ly + 3, 2.5, 2.5, flick < 1 ? '#C9A04A' : '#FFF6DA');
      if (flick === 1){ T.px(lx - 1, ly + 2, '#FFFFFF'); }
      // HARRY: suit, shoulders
      const bob = Math.floor(t * 1.1) % 2;
      T.poly([[16, 104], [68, 104], [64, 74], [54, 68], [30, 68], [20, 74]], '#120D14');
      T.poly([[30, 68], [38, 68], [42, 84], [36, 104], [28, 104]], '#1E1624');
      T.poly([[54, 68], [46, 68], [42, 84], [48, 104], [56, 104]], '#1E1624');
      T.poly([[38, 68], [46, 68], [42, 82]], '#E8DCC8');
      T.poly([[40, 70], [44, 70], [43, 80], [41, 80]], '#7A1522');
      T.line(30, 68, 41, 84, '#2E2436'); T.line(54, 68, 43, 84, '#2E2436');
      // the face: a purple block, lit from above
      const fx = 28, fy = 38 + bob, fw = 28, fh = 28;
      T.rect(fx - 1, fy - 1, fw + 2, fh + 2, '#0B0709');
      T.field(fx, fy, fw, fh, (x, y) => .95 - (y - fy) / fh * .7 - Math.abs(x - (fx + fw / 2 + sway)) / fw * .35, ['#3A1552', '#5A2680', '#7A35A8', '#9A4CC8', '#B56CE0']);
      // the fedora
      T.poly([[fx - 6, fy + 3], [fx + fw + 6, fy + 3], [fx + fw + 3, fy - 1], [fx - 3, fy - 1]], '#141016');
      T.poly([[fx + 3, fy - 1], [fx + fw - 3, fy - 1], [fx + fw - 5, fy - 12], [fx + fw / 2, fy - 14], [fx + 5, fy - 12]], '#1C1620');
      T.rect(fx + 3, fy - 4, fw - 6, 3, '#6B2330');
      T.line(fx + 5, fy - 12, fx + fw / 2, fy - 14, '#3A3242');
      T.line(fx - 6, fy + 3, fx + fw + 6, fy + 3, '#2E2834');
      T.rect(fx, fy + 4, fw, 2, '#2A0F3C');
      // the eyes: heavy lids, looking off to the side
      const look = Math.sin(t * .7) > .6 ? -1 : 1;
      const blink = (t % 4.2) < .12;
      [[fx + 5, fy + 9], [fx + 17, fy + 9]].forEach(([ex, ey], i) => {
        T.rect(ex - 1, ey - 1, 8, 7, '#0B0709');
        if (blink){ T.rect(ex, ey + 2, 6, 1, '#1A0A22'); return; }
        T.rect(ex, ey, 6, 5, '#F4EFE1');
        T.rect(ex, ey, 6, 2, '#6A2C92');
        T.rect(ex, ey + 2, 6, 1, '#C9C0D4');
        T.rect(ex + 2 + look, ey + 2, 2, 3, '#0B0709');
        T.px(ex + 2 + look, ey + 2, '#3A3A44');
        // brows angled in (sly)
        T.line(ex - 1, ey - 3 + (i ? 1 : 0), ex + 6, ey - 3 + (i ? 0 : 1), '#1A0A22');
      });
      // the smirk and the cigar
      T.line(fx + 9, fy + 21, fx + 17, fy + 21, '#1A0A22');
      T.line(fx + 17, fy + 21, fx + 20, fy + 19, '#1A0A22');
      T.px(fx + 9, fy + 20, '#1A0A22');
      const cx0 = fx + 19, cy0 = fy + 20;
      T.line(cx0, cy0, cx0 + 9, cy0 - 2, '#5A3A1E'); T.line(cx0, cy0 + 1, cx0 + 9, cy0 - 1, '#3E2412');
      T.px(cx0 + 3, cy0, '#C99A3A'); T.px(cx0 + 3, cy0 + 1, '#8D6818');
      const ember = (Math.floor(t * 3) % 2) ? '#F2C94C' : '#E06A2A';
      T.px(cx0 + 10, cy0 - 2, ember); T.px(cx0 + 10, cy0 - 1, '#C8322B');
      // the smoke, curling up through the light
      for (let k = 0; k < 14; k++){
        const age = ((t * .32 + k / 14) % 1);
        const sx = cx0 + 10 + Math.sin(age * 7 + k) * (2 + age * 7) + age * 4;
        const sy = cy0 - 3 - age * 52;
        const col = age < .3 ? '#C8C0C4' : age < .65 ? '#8A8090' : '#4A4250';
        T.px(sx, sy, col);
        if (age < .55) T.px(sx + 1, sy, col);
      }
      // the table: felt in the light, the rail at the bottom
      T.field(0, 86, SW, 22, (x, y) => Math.max(0, 1 - Math.hypot((x - lx) * .6, (y - 92) * 2) / 40) * flick + .05, ['#06140D', '#0D2A1D', '#174631', '#245D43', '#2F7553']);
      T.rect(0, 86, SW, 1, '#245D43');
      T.rect(0, 107, SW, 13, '#452A16'); T.rect(0, 107, SW, 2, '#8A5A35'); T.rect(0, 109, SW, 1, '#6B4226');
      T.rect(0, 118, SW, 2, '#1E120A');
      // his chips, his cards, the pot
      const stack = (x, n, c, c2) => { for (let i = 0; i < n; i++){ const y = 99 - i * 2; T.rect(x, y, 9, 3, '#0B0709'); T.rect(x + 1, y, 7, 2, c); T.px(x + 2 + (i % 2) * 4, y, c2); } };
      stack(8, 5, '#C8322B', '#F4EFE1'); stack(18, 7, '#22201C', '#E8B83A'); stack(62, 4, '#2B4F9E', '#F4EFE1'); stack(70, 6, '#E8B83A', '#7A5A10');
      // two cards, face down, one corner lifted (he's peeking)
      T.rect(33, 92, 10, 13, '#0B0709'); T.rect(34, 93, 8, 11, '#6B1A24'); T.rect(35, 94, 6, 9, '#8A2A35');
      T.poly([[41, 91], [52, 93], [50, 105], [39, 103]], '#0B0709');
      T.poly([[42, 92], [51, 94], [49, 104], [40, 102]], '#F4EFE1');
      T.px(44, 95, '#C8322B'); T.px(45, 95, '#C8322B'); T.px(44, 96, '#C8322B');
      // the vignette
      vignette(T, .5);
    }
  };

  /* ---- 2. BOMB POT NIGHT: a fizzing bomb on a pile of chips ---- */
  const BOMB = {
    focus:28,
    draw(T, t){
      // the burst behind it, turning in steps
      const rot = Math.floor(t * 4) / 4 * .12;
      T.field(0, 0, SW, SH, (x, y) => {
        const a = Math.atan2(y - 60, x - 40) + rot, d = Math.hypot(x - 40, y - 60);
        const stripe = (Math.floor((a + Math.PI) / (Math.PI / 9)) % 2) ? .25 : 0;
        return clamp(1 - d / 78 + stripe, 0, 1);
      }, ['#3A0A10', '#6B1418', '#A3242E', '#D2452A', '#E8782A', '#F2B431', '#FFE17B']);
      // speed lines at the edges
      for (let k = 0; k < 6; k++){ const y = 10 + k * 18 + (Math.floor(t * 8) % 3); T.line(0, y, 6 + (k % 3) * 2, y, '#FFE17B'); T.line(SW - 1, y + 9, SW - 7 - (k % 2) * 3, y + 9, '#FFE17B'); }
      // the pot: a heap of chips
      const chipC = [['#C8322B', '#F4EFE1'], ['#2B4F9E', '#F4EFE1'], ['#22201C', '#E8B83A'], ['#E8B83A', '#7A5A10'], ['#3F9E58', '#F4EFE1'], ['#F4EFE1', '#C8322B']];
      const py = 86;
      T.ellipse(42, py + 4, 38, 8, '#2A0A0E');
      for (let i = 0; i < 52; i++){
        const r = hash(i, 7), q = hash(i, 13);
        const a = r * Math.PI * 2, rr = Math.sqrt(q);
        const x = 42 + Math.cos(a) * rr * 34, y = py + Math.sin(a) * rr * 6 - (1 - rr) * 8;
        const [c, c2] = chipC[i % chipC.length];
        T.ellipse(x, y, 4.5, 2, '#0B0709'); T.ellipse(x, y - 1, 4, 1.6, c);
        T.px(x - 2, y - 1, c2); T.px(x + 2, y - 1, c2);
      }
      // a few chips knocked loose, rolling in the foreground
      [[10, 104], [70, 108], [24, 112]].forEach(([x, y], i) => { const [c, c2] = chipC[(i * 2) % 6]; T.ellipse(x, y, 4.5, 2, '#0B0709'); T.ellipse(x, y - 1, 4, 1.6, c); T.px(x - 2, y - 1, c2); T.px(x + 2, y - 1, c2); });
      // the bomb, jittering harder as the fuse runs down
      const fuse = 1 - (t % 6) / 6;
      const shake = fuse < .35 ? (Math.floor(t * 20) % 2 ? 1 : -1) : (Math.floor(t * 6) % 7 === 0 ? 1 : 0);
      const bx = 38 + shake, by = 62, R = 16;
      T.ellipse(bx + 2, by + R - 1, 15, 3, 'rgba(0,0,0,.45)');
      T.disc(bx, by, R + 1, '#0B0709');
      T.field(bx - R, by - R, R * 2 + 1, R * 2 + 1, (x, y) => {
        const d = Math.hypot(x + .5 - bx, y + .5 - by);
        if (d > R) return null;
        return clamp(1 - Math.hypot(x - (bx - 6), y - (by - 7)) / 26, 0, 1);
      }, ['#101018', '#1C1C28', '#2C2C3E', '#44445C', '#62627E']);
      T.rect(bx - 9, by - 10, 4, 2, '#9A9AB4'); T.rect(bx - 10, by - 8, 2, 3, '#9A9AB4'); T.px(bx - 8, by - 11, '#E6E6F2');
      // a rim of warm light from the burst behind
      for (let a = -2.4; a < -.6; a += .08) T.px(bx + Math.cos(a) * R, by + Math.sin(a) * R, '#E8782A');
      T.sprite(['...##...', '..####..', '..####..', '##.##.##', '########', '##.##.##', '...##...', '..####..'], bx - 4, by - 1, { '#':'#E8DCC8' });
      // the cap and the fuse
      T.rect(bx - 5, by - R - 4, 10, 6, '#0B0709'); T.rect(bx - 4, by - R - 3, 8, 4, '#4A4A5A');
      T.rect(bx - 4, by - R - 3, 8, 1, '#8A8AA0'); T.px(bx - 2, by - R - 1, '#2A2A36'); T.px(bx + 1, by - R - 1, '#2A2A36');
      const pts = [];
      for (let i = 0; i <= 20; i++){ const s2 = i / 20; pts.push([bx + 3 + s2 * 26, by - R - 4 - Math.sin(s2 * 2.6) * 10 - s2 * 3]); }
      const burnt = Math.floor(fuse * 20);
      for (let i = 0; i < burnt; i++){ T.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 2 ? '#C8A060' : '#8A6A3A'); }
      const sp = pts[burnt], fl = Math.floor(t * 14) % 3;
      const sc = ['#FFFFFF', '#FFE17B', '#F2B431'][fl];
      T.px(sp[0], sp[1], '#FFFFFF');
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => T.px(sp[0] + a * (fl + 1), sp[1] + b * (fl + 1), sc));
      [[1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(([a, b]) => T.px(sp[0] + a * (2 - fl % 2), sp[1] + b * (2 - fl % 2), '#E8782A'));
      for (let k = 0; k < 9; k++){
        const age = (t * 1.6 + k / 9) % 1;
        const a = hash(k, Math.floor(t * 1.6 + k / 9)) * Math.PI * 2;
        T.px(sp[0] + Math.cos(a) * age * 11, sp[1] + Math.sin(a) * age * 11 + age * age * 6, age < .5 ? '#FFE17B' : '#E8782A');
      }
      vignette(T, .35);
    }
  };

  /* ---- 3. THE GHOST SEAT: moonlight, an empty chair, someone in it ---- */
  const GHOST = {
    focus:24,
    draw(T, t){
      const room = layer('ghost-room', L => {
        // the dark casino, blue-violet
        L.field(0, 0, SW, SH, (x, y) => {
          const shaft = Math.max(0, 1 - Math.abs((x - 52) - (y - 10) * -.38) / 15) * (y < 104 ? 1 : 0);
          return clamp(.12 + shaft * .55 - y / SH * .06, 0, 1);
        }, ['#07060E', '#0E0C1C', '#16142C', '#221F42', '#343062', '#4A4686']);
        // the tall window, the moon in it
        L.rect(44, 4, 26, 36, '#07060E');
        L.ellipse(57, 8, 13, 6, '#07060E');
        L.field(46, 4, 22, 35, (x, y) => (Math.hypot(x - 57, y - 8) < 12 || y >= 8) ? .25 + (1 - y / 40) * .5 : null, ['#0E1430', '#16204A', '#22306A', '#34488E']);
        L.disc(61, 15, 6, '#E9E8F4'); L.disc(62, 14, 5.5, '#F8F6FF');
        L.px(59, 13, '#C9C8DC'); L.px(63, 17, '#C9C8DC'); L.px(60, 17, '#D9D8EA');
        [[49, 9], [53, 24], [65, 30], [50, 33], [67, 7]].forEach(([x, y]) => L.px(x, y, '#C9D8FF'));
        L.rect(56, 4, 1, 36, '#2A2A40'); L.rect(46, 21, 22, 1, '#2A2A40');
        L.rect(44, 39, 26, 2, '#3A3656');
        // curtains
        L.field(36, 0, 8, 46, (x, y) => .3 + Math.sin(x * 1.3) * .2, ['#2A0A14', '#4A1222', '#6B1A2E']);
        L.field(70, 0, 8, 46, (x, y) => .3 + Math.sin(x * 1.3) * .2, ['#2A0A14', '#4A1222', '#6B1A2E']);
        // the empty velvet chair
        L.poly([[24, 92], [60, 92], [58, 44], [50, 36], [34, 36], [26, 44]], '#0B0709');
        L.field(27, 38, 30, 52, (x, y) => {
          const tuft = ((x - 27) % 6 === 3 && (y - 38) % 7 === 3) ? -.3 : 0;
          return clamp(.65 - Math.abs(x - 44) / 30 + (1 - (y - 38) / 52) * .15 + tuft + ((x - 52) > -4 ? .25 : 0), 0, 1);
        }, ['#2A0A10', '#4A1220', '#6E1A2C', '#922838', '#B04050']);
        L.line(26, 44, 34, 36, '#C99A3A'); L.line(34, 36, 50, 36, '#E8B83A'); L.line(50, 36, 58, 44, '#C99A3A');
        L.rect(20, 66, 8, 26, '#0B0709'); L.rect(21, 67, 6, 24, '#6E1A2C'); L.rect(21, 67, 6, 2, '#C99A3A');
        L.rect(56, 66, 8, 26, '#0B0709'); L.rect(57, 67, 6, 24, '#922838'); L.rect(57, 67, 6, 2, '#E8B83A');
      });
      T.ctx.drawImage(room, 0, 0);
      // the ghost, breathing in and out of sight
      const fade = .7 + Math.sin(t * 1.7) * .2;
      const fy = Math.round(Math.sin(t * 1.2) * 2);
      const g = T.ctx;
      g.globalAlpha = clamp(fade, .1, .92);
      const gx = 42, gy = 50 + fy;
      g.globalAlpha = clamp(fade * .35, .05, .4);
      T.ellipse(gx, gy + 8, 16, 22, '#7FE8E0');
      g.globalAlpha = clamp(fade, .1, .92);
      T.ellipse(gx, gy, 10, 10, '#BFF4F0');
      T.poly([[gx - 10, gy], [gx + 10, gy], [gx + 13, gy + 30], [gx - 13, gy + 30]], '#BFF4F0');
      // the wavy hem
      for (let i = 0; i < 26; i++){ const x = gx - 13 + i; const yy = gy + 30 + Math.round(Math.sin(i * .8 + t * 5) * 2); T.rect(x, gy + 28, 1, yy - gy - 27, '#BFF4F0'); }
      T.ellipse(gx - 3, gy - 3, 5, 5, '#E8FFFC');
      g.globalAlpha = Math.min(1, fade + .3);
      // hollow eyes and an O of a mouth
      T.rect(gx - 6, gy - 2, 3, 4, '#0E2A36'); T.rect(gx + 3, gy - 2, 3, 4, '#0E2A36');
      T.ellipse(gx, gy + 6, 2, 2.5, '#0E2A36');
      // its arms reaching for the pot
      g.globalAlpha = clamp(fade, .1, .8);
      T.poly([[gx - 10, gy + 12], [gx - 6, gy + 14], [gx - 14, gy + 34], [gx - 18, gy + 33]], '#9FE4E0');
      T.poly([[gx + 10, gy + 12], [gx + 6, gy + 14], [gx + 14, gy + 34], [gx + 18, gy + 33]], '#9FE4E0');
      g.globalAlpha = 1;
      // the table and the stack it's pushed all in
      T.field(0, 90, SW, 16, (x, y) => .45 - Math.abs(x - 44) / 90 + (y - 90) / 40, ['#06140D', '#0D2A1D', '#174631', '#245D43']);
      T.rect(0, 106, SW, 14, '#2A1A0E'); T.rect(0, 106, SW, 2, '#6B4226'); T.rect(0, 108, SW, 1, '#452A16');
      for (let i = 0; i < 11; i++){ const y = 101 - i * 2; T.rect(36, y, 13, 3, '#0B0709'); T.rect(37, y, 11, 2, i % 3 === 2 ? '#F4EFE1' : '#22201C'); T.px(39 + (i % 2) * 6, y, '#E8B83A'); }
      T.rect(52, 97, 8, 11, '#0B0709'); T.rect(53, 98, 6, 9, '#F4EFE1');
      T.sprite(['.#.', '###', '###', '.#.'], 54, 100, { '#':'#22201C' });
      // drifting motes
      for (let k = 0; k < 12; k++){
        const age = (t * .18 + k / 12) % 1;
        const x = 30 + hash(k, 3) * 28 + Math.sin(age * 6 + k) * 3, y = 92 - age * 70;
        g.globalAlpha = (1 - age) * .9;
        T.px(x, y, '#D8FFFC');
        g.globalAlpha = 1;
      }
      vignette(T, .45);
    }
  };

  /* ---- 4. MARKED DECK: candlelight, a black cat, one card that glows ---- */
  const MARKED = {
    focus:16,
    draw(T, t){
      const fl = Math.floor(t * 10);
      const flick = .85 + hash(fl, 1) * .2;
      const lx = 17, ly = 40;
      // the room: only the candle lights it
      T.field(0, 0, SW, SH, (x, y) => clamp((1 - Math.hypot(x - lx, (y - ly) * 1.15) / 74) * flick * .85, 0, 1),
        ['#06040A', '#0C0814', '#150F20', '#20182E', '#2E2240', '#403052']);
      // the felt
      T.field(0, 86, SW, 34, (x, y) => clamp(.62 - Math.hypot(x - lx - 10, y - 90) / 70, 0, 1) * flick, ['#05100A', '#0A1C12', '#11301E', '#184228', '#205434']);
      T.rect(0, 86, SW, 1, '#11301E');
      // THE CAT: big, black, sitting on the table
      const C = '#050307', RIM = '#3A2650', RIM2 = '#55386E';
      const tail = (i, n) => { const s2 = i / n; return [70 + s2 * 9 + Math.sin(t * 2.1 + s2 * 3.2) * 3.5 * s2, 82 - s2 * 30 + Math.cos(t * 2.1 + s2 * 2) * 2 * s2]; };
      for (let i = 0; i < 26; i++){ const [x, y] = tail(i, 26); T.rect(x, y, 3, 3, C); }
      T.ellipse(57, 66, 15, 20, C);                    // body
      T.ellipse(57, 84, 17, 4, C);                     // haunches on the felt
      T.rect(49, 70, 5, 16, C); T.rect(59, 70, 5, 16, C); // front legs
      T.ellipse(51, 86, 4, 2, C); T.ellipse(62, 86, 4, 2, C);
      T.disc(56, 36, 12, C);                           // head
      T.poly([[45, 32], [47, 18], [54, 27]], C);       // ears
      T.poly([[58, 27], [65, 18], [67, 32]], C);
      T.poly([[47, 30], [48, 22], [52, 28]], '#1E1428'); T.poly([[60, 28], [64, 22], [65, 30]], '#1E1428');
      // candle rim light down its left side
      for (let y = 26; y < 86; y++){
        let x = 0;
        if (y < 48) x = 56 - Math.sqrt(Math.max(0, 144 - (y - 36) * (y - 36))); else x = 57 - 15 * Math.sqrt(Math.max(0, 1 - ((y - 66) / 20) * ((y - 66) / 20)));
        if (y >= 70 && y < 86) x = 49;
        const lit = flick > .95 ? RIM2 : RIM;
        T.px(Math.round(x), y, lit);
        if (y % 3 === 0) T.px(Math.round(x) + 1, y, RIM);
      }
      // the eyes: almonds of green, slit pupils, watching the card
      const blink = (t % 5.5) < .14;
      [[49, 34], [58, 34]].forEach(([ex, ey]) => {
        if (blink){ T.rect(ex, ey + 1, 6, 1, '#2A4A10'); return; }
        T.sprite(['.####.', '######', '.####.'], ex, ey, { '#':'#B6F04A' });
        T.px(ex + 1, ey, '#E4FF9A'); T.px(ex + 2, ey, '#E4FF9A');
        const look = Math.sin(t * .8) > .3 ? 2 : 3;
        T.rect(ex + look, ey, 1, 3, '#050307');
      });
      T.px(55, 39, '#6A3A52'); T.px(56, 39, '#6A3A52');
      [[44, 40, 50, 39], [44, 42, 50, 41], [62, 39, 68, 40], [62, 41, 68, 42]].forEach(([a, b, c, d]) => T.line(a, b, c, d, '#2A2236'));
      // the candle, its holder and its flame
      T.rect(lx - 4, ly + 4, 8, 30, '#0B0709');
      T.rect(lx - 3, ly + 5, 6, 28, '#E8DCC8'); T.rect(lx - 3, ly + 5, 2, 28, '#FFF6E6'); T.rect(lx + 2, ly + 5, 1, 28, '#A89880');
      T.rect(lx + 1, ly + 6, 2, 7, '#FFF6E6'); T.px(lx + 2, ly + 13, '#E8DCC8');
      T.rect(lx - 7, ly + 32, 14, 3, '#0B0709'); T.rect(lx - 6, ly + 32, 12, 2, '#C99A3A'); T.rect(lx - 6, ly + 32, 12, 1, '#FFE17B');
      T.rect(lx - 9, ly + 35, 18, 3, '#0B0709'); T.rect(lx - 8, ly + 35, 16, 2, '#8D6818');
      T.px(lx, ly + 3, '#22201C');
      const fs = fl % 4;
      const flame = [['..y..', '.yWy.', '.yWy.', 'yWWWy', '.yWy.', '..o..'], ['...y.', '..yWy', '.yWy.', 'yWWWy', '.yWy.', '..o..'], ['.y...', 'yWy..', '.yWy.', 'yWWWy', '.yWy.', '..o..'], ['..y..', '..y..', '.yWy.', 'yWWWy', '.yWy.', '..o..']][fs];
      T.sprite(flame, lx - 2, ly - 4, { y:'#F2B431', W:'#FFF6DA', o:'#E06A2A' });
      // the deck, fanned on the felt
      for (let i = 0; i < 6; i++){
        const ang = -.55 + i * .2, ox = 22 + i * 5, oy = 118;
        const c = Math.cos(ang), s2 = Math.sin(ang);
        const k = (u, v) => [ox + u * c - v * s2, oy + u * s2 + v * c];
        T.poly([k(-7, -24), k(7, -24), k(7, 0), k(-7, 0)], '#0B0709');
        T.poly([k(-6, -23), k(6, -23), k(6, -1), k(-6, -1)], '#5A1520');
        T.poly([k(-4, -21), k(4, -21), k(4, -3), k(-4, -3)], '#7A2A35');
      }
      // THE MARKED CARD, propped up against the cat, glowing
      const pulse = .5 + Math.sin(t * 3) * .5;
      T.field(22, 50, 30, 44, (x, y) => {
        const d = Math.hypot(x - 36, y - 68);
        return d < 17 ? clamp((1 - d / 17) * (.35 + pulse * .65), 0, 1) : null;
      }, ['#0C1A10', '#1A3410', '#2E5A16', '#4E8A1E', '#8ACC34']);
      T.poly([[28, 56], [44, 54], [46, 82], [30, 84]], '#0B0709');
      T.poly([[29, 57], [43, 55], [45, 81], [31, 83]], '#F4EFE1');
      T.line(29, 57, 43, 55, '#FFFFFF');
      text3(T, 'A', 31, 59, '#22201C');
      T.sprite(['..#..', '.###.', '#####', '##.##', '..#..', '.###.'], 34, 66, { '#':'#22201C' });
      // the mark: an inked eye that opens and shuts
      const g = pulse > .5 ? '#4E8A1E' : '#2E5A16';
      T.sprite(['.ggg.', 'gwkwg', '.ggg.'], 36, 76, { g, w:'#B6F04A', k:'#050307' });
      vignette(T, .55);
    }
  };
  function vignette(T, k){
    const g = T.ctx;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++){
      const dx = (x - SW / 2) / (SW / 2), dy = (y - SH / 2) / (SH / 2);
      const v = (dx * dx * .6 + dy * dy * .5) * k;
      const th = (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;
      if (v > .32 + th * .4){ g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(x, y, 1, 1); }
    }
  }
  const SCENES = { harry:HARRY, bomb:BOMB, ghost:GHOST, marked:MARKED };

  /* ============================================================
     THE CARDS: what each one says
     ============================================================ */
  const CARDS = [
    { id:'harry', scene:'harry', kind:'CHARACTER', rarity:'rare', tier:'BACK ALLEY', title:"HARRY'S TABLE", sub:'THE BACK TABLE', rule:"HARRY'S GAME. BEAT HIM HEADS-UP AND HE'LL REMEMBER.", flavour:"BEAT HIM. HE'LL REMEMBER.", buyIn:'$100', pays:'$200', seats:'2', set:'AL 07/10', accent:'#7A35A8', accentHi:'#B56CE0' },
    { id:'bomb', scene:'bomb', kind:'WILD', rarity:'rare', tier:'PUB CIRCUIT', title:'BOMB POT NIGHT', sub:'THE RULES BEND', rule:'EVERY 5TH HAND ALL ANTE BIG. STRAIGHT TO THE FLOP.', flavour:'EVERY 5TH HAND: BOOM.', buyIn:'$300', pays:'$1,050', seats:'5', set:'PB 09/10', accent:'#D2452A', accentHi:'#FFE17B' },
    { id:'ghost', scene:'ghost', kind:'WILD', rarity:'foil', tier:'CASINO', title:'THE GHOST SEAT', sub:'ONE NIGHT ONLY', rule:'AN EMPTY CHAIR GOES ALL IN EVERY HAND. CALL IT.', flavour:'IT GOES ALL IN. EVERY HAND.', buyIn:'$3,000', pays:'$9,000', seats:'5', set:'CA 05/09', accent:'#4A4686', accentHi:'#BFF4F0' },
    { id:'marked', scene:'marked', kind:'JINX', rarity:'uncommon', tier:'PUB CIRCUIT', title:'MARKED DECK', sub:'YOUR CHOICE', rule:'BLINDS DOUBLE. SO DOES THE PRIZE. THE CAT WATCHES.', flavour:'THE CAT IS WATCHING.', buyIn:'$300', pays:'$2,400', seats:'4', set:'PB 10/10', accent:'#6AA824', accentHi:'#B6F04A' }
  ];

  /* ============================================================
     THE FRAMES (88 × 124)
     ============================================================ */
  const sceneCv = {};
  function sceneCanvas(id, t){
    const c = sceneCv[id] || (sceneCv[id] = Object.assign(document.createElement('canvas'), { width:SW, height:SH }));
    const x = c.getContext('2d');
    x.clearRect(0, 0, SW, SH);
    SCENES[id].draw(tools(x), t);
    return c;
  }
  function cutCorners(T){ [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].forEach(([x, y]) => T.ctx.clearRect(x, y, 1, 1)); T.ctx.clearRect(1, 0, 1, 1); T.ctx.clearRect(0, 1, 1, 1); T.ctx.clearRect(W - 2, 0, 1, 1); T.ctx.clearRect(W - 1, 1, 1, 1); T.ctx.clearRect(0, H - 2, 1, 1); T.ctx.clearRect(1, H - 1, 1, 1); T.ctx.clearRect(W - 1, H - 2, 1, 1); T.ctx.clearRect(W - 2, H - 1, 1, 1); }
  function gem(T, rarity, x, y, c){
    const big = { common:['..#..', '.###.', '#####', '.###.', '..#..'], uncommon:['..#..', '.#.#.', '#...#', '.#.#.', '..#..'], rare:['#.#.#', '.###.', '#####', '.###.', '#.#.#'], foil:['..#..', '..#..', '#####', '..#..', '..#..'] }[rarity];
    T.sprite(big, x, y, { '#':c });
  }

  /* A: PARLOUR — a cream playing card with an engraved border */
  function frameParlour(T, card, scene, t){
    const ink = '#22201C', cream = '#F4EFE1', paper2 = '#E9E1CC';
    T.rect(0, 0, W, H, ink);
    T.field(1, 1, W - 2, H - 2, (x, y) => .55 + hash(x >> 2, y >> 2) * .25 + (y / H) * -.1, [paper2, '#EFE7D4', cream]);
    // the engraved border: two rules and corner knots
    const ac = card.accent;
    T.rect(3, 3, W - 6, 1, ac); T.rect(3, H - 4, W - 6, 1, ac); T.rect(3, 3, 1, H - 6, ac); T.rect(W - 4, 3, 1, H - 6, ac);
    for (let i = 6; i < W - 6; i += 3){ T.px(i, 5, '#C9BC98'); T.px(i, H - 6, '#C9BC98'); }
    [[4, 4], [W - 9, 4], [4, H - 9], [W - 9, H - 9]].forEach(([x, y]) => T.sprite(['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], x, y, { '#':ac }));
    // the kind and the gem
    text3(T, card.kind, 11, 8, ac);
    gem(T, card.rarity, W - 16, 7, card.rarity === 'foil' ? '#C99A2E' : ac);
    // the window
    const wx = 6, wy = 15, ww = 76, wh = 54;
    T.rect(wx - 1, wy - 1, ww + 2, wh + 2, ink);
    T.ctx.drawImage(scene, 4, card.focus, ww, wh, wx, wy, ww, wh);
    T.rect(wx, wy + wh, ww, 1, '#5A4A30');
    // the title and sub
    text5C(T, card.title, W / 2, 73, ink);
    text3C(T, card.sub, W / 2, 82, '#7A6A4A');
    // the rule, boxed
    T.rect(8, 89, W - 16, 1, '#C9BC98');
    wrap3(card.rule, 18).slice(0, 3).forEach((l, i) => text3(T, l, 9, 92 + i * 6, '#3A3020'));
    // the foot
    T.rect(8, 111, W - 16, 1, '#C9BC98');
    text3(T, card.set, 8, 114, '#8A7A5A');
    const money = card.buyIn;
    text3(T, money, W - 8 - text3W(money), 114, ink);
    cutCorners(T);
  }

  /* B: ENAMEL — a machine-issued ticket: brass, rivets, a CRT strip */
  function frameEnamel(T, card, scene, t){
    const brass = ['#5A400C', '#8D6818', '#C99A3A', '#E8B83A', '#FFE17B'];
    T.rect(0, 0, W, H, '#0B0709');
    T.field(1, 1, W - 2, H - 2, (x, y) => {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (e <= 2) return e === 0 ? .95 : e === 1 ? .7 : .3;
      return null;
    }, brass);
    T.field(3, 3, W - 6, H - 6, (x, y) => .55 - y / H * .35 + (hash(x, y) - .5) * .08, ['#2A0A10', '#3E0F18', '#541520', '#6E1E2C']);
    // the ticket notches at the waist
    T.ctx.clearRect(0, 58, 3, 8); T.ctx.clearRect(W - 3, 58, 3, 8);
    T.rect(2, 58, 1, 8, '#5A400C'); T.rect(W - 3, 58, 1, 8, '#5A400C');
    // rivets
    [[6, 6], [W - 8, 6], [6, H - 8], [W - 8, H - 8]].forEach(([x, y]) => { T.rect(x, y, 2, 2, '#C99A3A'); T.px(x, y, '#FFE17B'); T.px(x + 1, y + 1, '#5A400C'); });
    // the bezel and the picture, with scanlines
    const wx = 10, wy = 10, ww = 68, wh = 52;
    T.rect(wx - 3, wy - 3, ww + 6, wh + 6, '#4A4F53'); T.rect(wx - 2, wy - 2, ww + 4, wh + 4, '#B9BDC0'); T.rect(wx - 2, wy - 2, ww + 4, 1, '#F1F4F2'); T.rect(wx - 1, wy - 1, ww + 2, wh + 2, '#0B0709');
    T.ctx.drawImage(scene, 8, card.focus + 2, ww, wh, wx, wy, ww, wh);
    T.ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = wy; y < wy + wh; y += 2) T.ctx.fillRect(wx, y, ww, 1);
    // the kind, an enamel tag over the bezel
    const kw = text3W(card.kind) + 6;
    T.rect(wx - 1, wy - 5, kw, 8, '#0B0709'); T.rect(wx, wy - 4, kw - 2, 6, card.accent); text3(T, card.kind, wx + 2, wy - 3, '#FFF6DA');
    gem(T, card.rarity, W - 17, wy - 5, card.rarity === 'foil' ? '#FFE17B' : '#E8B83A');
    // the brass nameplate
    T.rect(4, 68, W - 8, 13, '#0B0709');
    T.field(5, 69, W - 10, 11, (x, y) => .85 - (y - 69) / 11 * .5, brass);
    text5C(T, card.title, W / 2 + 1, 72, '#FFE9A0');
    text5C(T, card.title, W / 2, 71, '#3A2A0A');
    // the CRT strip with the rule
    T.rect(7, 84, W - 14, 26, '#0B0709');
    T.rect(8, 85, W - 16, 24, '#0C1A12');
    wrap3(card.rule, 18).slice(0, 3).forEach((l, i) => text3(T, l, 10, 88 + i * 7, '#B6E0AF'));
    T.ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 85; y < 109; y += 2) T.ctx.fillRect(8, y, W - 16, 1);
    // the foot, stamped into the brass
    text3(T, card.set, 9, H - 11, '#C99A3A');
    text3(T, card.buyIn, W - 9 - text3W(card.buyIn), H - 11, '#FFE17B');
  }

  /* C: FULL ART — the picture is the card */
  function frameFull(T, card, scene, t){
    const edge = card.rarity === 'foil' ? ['#8D6818', '#E8B83A', '#FFF1B8'] : card.rarity === 'rare' ? ['#5A400C', '#C99A3A', '#E8B83A'] : ['#0B0709', '#2A2420', '#4A403A'];
    T.rect(0, 0, W, H, '#0B0709');
    T.ctx.drawImage(scene, 0, 0, SW, SH, 2, 2, SW, SH);
    // the border: a ring of the rarity's metal
    T.rect(1, 1, W - 2, 1, edge[2]); T.rect(1, 1, 1, H - 2, edge[1]); T.rect(W - 2, 1, 1, H - 2, edge[0]); T.rect(1, H - 2, W - 2, 1, edge[0]);
    // the top: kind and gem on a dark band
    T.ctx.globalAlpha = .55; T.rect(2, 2, SW, 11, '#0B0709'); T.ctx.globalAlpha = 1;
    text3(T, card.kind, 6, 5, card.accentHi, '#0B0709');
    gem(T, card.rarity, W - 12, 4, card.rarity === 'foil' ? '#FFE17B' : card.accentHi);
    // the bottom plate: a dithered fade to dark, the title, the rule
    T.field(2, 78, SW, 44, (x, y) => (y - 78) / 20, ['rgba(0,0,0,0)', 'rgba(11,7,9,.55)', 'rgba(11,7,9,.85)', '#0B0709']);
    text5C(T, card.title, W / 2, 90, '#FFF6DA', '#0B0709');
    text3C(T, card.sub, W / 2, 99, card.accentHi);
    wrap3(card.flavour || card.rule, 20).slice(0, 2).forEach((l, i) => text3C(T, l, W / 2, 107 + i * 6, '#C9BCA0'));
    text3(T, card.buyIn, W - 5 - text3W(card.buyIn), H - 6, '#E8B83A');
    // a tiny stats strip in the very bottom corners
    text3(T, card.set, 5, H - 6 - 0, '#6A5A4A');
    void t;
  }

  /* ---- the card back ---- */
  function back(T, rarity){
    T.rect(0, 0, W, H, '#0B0709');
    T.field(1, 1, W - 2, H - 2, (x, y) => {
      const d1 = (x + y) % 10, d2 = (x - y + 1000) % 10;
      return d1 === 0 || d2 === 0 ? .65 : .25 + (1 - y / H) * .15;
    }, ['#2A0A10', '#3E0F18', '#5A1520', '#7A2A35']);
    // lattice studs
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if ((x + y) % 10 === 0 && (x - y + 1000) % 10 === 0) T.px(x, y, '#C99A3A');
    // the frame
    const g = '#E8B83A', g2 = '#8D6818';
    T.rect(4, 4, W - 8, 1, g); T.rect(4, H - 5, W - 8, 1, g); T.rect(4, 4, 1, H - 8, g); T.rect(W - 5, 4, 1, H - 8, g);
    T.rect(6, 6, W - 12, 1, g2); T.rect(6, H - 7, W - 12, 1, g2); T.rect(6, 6, 1, H - 12, g2); T.rect(W - 7, 6, 1, H - 12, g2);
    // the medallion: a Poker Face
    const mx = W / 2, my = H / 2;
    T.disc(mx, my, 20, '#0B0709'); T.disc(mx, my, 19, '#C99A3A'); T.disc(mx, my, 17, '#2A0A10');
    T.rect(mx - 10, my - 10, 20, 20, '#0B0709');
    T.field(mx - 9, my - 9, 18, 18, (x, y) => .9 - (y - (my - 9)) / 18 * .6, ['#8D6818', '#C99A3A', '#E8B83A', '#FFE17B']);
    T.rect(mx - 6, my - 4, 4, 4, '#0B0709'); T.rect(mx + 2, my - 4, 4, 4, '#0B0709');
    T.px(mx - 5, my - 4, '#FFF6DA'); T.px(mx + 3, my - 4, '#FFF6DA');
    T.rect(mx - 5, my + 3, 10, 1, '#0B0709'); T.px(mx - 6, my + 2, '#0B0709'); T.px(mx + 5, my + 2, '#0B0709');
    // the suits at the four points
    const pal = { '#':'#E8B83A' };
    T.sprite(['..#..', '.###.', '#####', '#.#.#', '..#..', '.###.'], mx - 2, 12, pal);
    T.sprite(['.#.#.', '#####', '#####', '.###.', '..#..'], mx - 2, H - 18, pal);
    T.sprite(['..#..', '.###.', '#####', '.###.', '..#..'], 11, my - 2, pal);
    T.sprite(['..#..', '.###.', '#.#.#', '#####', '..#..', '.###.'], W - 16, my - 3, pal);
    text3C(T, 'POKER FACES', W / 2, my + 24, '#E8B83A');
    if (rarity === 'rare' || rarity === 'foil'){
      T.rect(1, 1, W - 2, 1, '#FFE17B'); T.rect(1, H - 2, W - 2, 1, '#FFE17B'); T.rect(1, 1, 1, H - 2, '#FFE17B'); T.rect(W - 2, 1, 1, H - 2, '#FFE17B');
    }
    cutCorners(T);
  }

  /* ---- the foil: a band of light that sweeps, and sparkles ---- */
  function foil(T, t, strength){
    const g = T.ctx;
    const pos = ((t * .55) % 1.8) - .4;
    const cx = pos * (W + H);
    for (let y = 0; y < H; y++){
      const x0 = cx - y * .7;
      for (let x = Math.max(0, Math.floor(x0 - 10)); x < Math.min(W, x0 + 10); x++){
        const d = Math.abs(x - x0) / 10;
        const th = (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;
        if (1 - d > th){
          const hue = ['rgba(255,140,210,', 'rgba(255,240,160,', 'rgba(140,235,255,'][Math.floor((x + y) / 6) % 3];
          g.fillStyle = hue + (strength * .32).toFixed(2) + ')';
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    for (let k = 0; k < 6; k++){
      const life = (t * 1.3 + k / 6) % 1;
      if (life > .4) continue;
      const x = Math.floor(hash(k, Math.floor(t * 1.3 + k / 6)) * (W - 8)) + 4, y = Math.floor(hash(k + 9, Math.floor(t * 1.3 + k / 6)) * (H - 8)) + 4;
      const s = life < .2 ? 1 : 2;
      g.fillStyle = '#FFFFFF';
      g.fillRect(x, y, 1, 1);
      g.fillStyle = 'rgba(255,250,220,.85)';
      g.fillRect(x - s, y, 1, 1); g.fillRect(x + s, y, 1, 1); g.fillRect(x, y - s, 1, 1); g.fillRect(x, y + s, 1, 1);
    }
  }

  const FRAMES = { parlour:frameParlour, enamel:frameEnamel, full:frameFull };
  function drawFront(ctx, card, frame, t){
    const T = tools(ctx);
    ctx.clearRect(0, 0, W, H);
    const scene = sceneCanvas(card.scene, t);
    (FRAMES[frame] || frameParlour)(T, Object.assign({ focus:SCENES[card.scene].focus }, card), scene, t);
    if (card.rarity === 'foil') foil(T, t, 1);
    else if (card.rarity === 'rare') foil(T, t * .6, .35);
  }
  function drawBack(ctx, rarity){ ctx.clearRect(0, 0, W, H); back(tools(ctx), rarity); }

  return { W, H, CARDS, drawFront, drawBack, FRAMES:Object.keys(FRAMES) };
})();
