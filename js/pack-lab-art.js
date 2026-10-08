"use strict";

/* ============================================================
   PACK LAB — the pixel art (lab only, never loaded by the game)

   Everything the pack lab draws on canvas, at art resolution: one art
   pixel is one canvas pixel, and the canvas is scaled up by a whole
   number with image-rendering:pixelated, so it stays crisp on a phone.

     PackArt.TIERS         the six packs: colours, names, prices
     PackArt.text()        a 3x5 pixel font for labels on the art
     PackArt.pack()        a pack wrapper at any size
     PackArt.coil()        a vending coil's front loop, at any turn
     PackArt.scene()       the little picture in a card's art window
     PackArt.back()        the card back
   ============================================================ */
const PackArt = (() => {
  /* ---- the six tiers (bottom row of the machine first) ---- */
  const TIERS = [
    { id:'alley',  key:'A', name:'BACK ALLEY',  short:'ALLEY',  price:25,   cards:5,
      body:'#8C6A43', hi:'#B48E5E', lo:'#5E4429', ink:'#2B1D10', band:'#D8C49A', bandInk:'#3A2A16', seal:'#6B5134', emblem:'lamp',   odds:'RARE 1 IN 8' },
    { id:'pub',    key:'B', name:'PUB CIRCUIT', short:'PUB',    price:75,   cards:5,
      body:'#2F6B43', hi:'#4F9466', lo:'#1A4029', ink:'#0E2416', band:'#E9D9A8', bandInk:'#1F3B27', seal:'#24553A', emblem:'pint',   odds:'RARE 1 IN 5' },
    { id:'club',   key:'C', name:'CARD CLUB',   short:'CLUB',   price:250,  cards:5,
      body:'#2B3F73', hi:'#4A64A6', lo:'#17244A', ink:'#0B1430', band:'#C9D3E6', bandInk:'#1A2650', seal:'#22356A', emblem:'club',   odds:'RARE 1 IN 4' },
    { id:'casino', key:'D', name:'CASINO',      short:'CASINO', price:750,  cards:5,
      body:'#A3242E', hi:'#D24A4C', lo:'#64131B', ink:'#33080D', band:'#F2D27A', bandInk:'#5A1218', seal:'#7C1A23', emblem:'dice',   odds:'RARE 1 IN 3' },
    { id:'high',   key:'E', name:'HIGH ROLLER', short:'HIGH ROLLER', price:2500, cards:5,
      body:'#1E1C24', hi:'#3A3744', lo:'#0C0B10', ink:'#000000', band:'#E2B640', bandInk:'#1A1408', seal:'#14131A', emblem:'crown',  odds:'RARE 1 IN 2' },
    { id:'gold',   key:'F', name:'INVITATIONAL', short:'GOLD',  price:7500, cards:6,
      body:'#D9A52E', hi:'#FFE58A', lo:'#8C6414', ink:'#3D2A05', band:'#7A1522', bandInk:'#FFE7A0', seal:'#B0222E', emblem:'star',   odds:'INVITATION GUARANTEED' }
  ];
  const tier = id => TIERS.find(t => t.id === id) || TIERS[0];

  /* ---- 3x5 pixel font ---- */
  const G = {
    A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110', E:'111100110100111',
    F:'111100110100100', G:'011100101101011', H:'101101111101101', I:'111010010010111', J:'001001001101010',
    K:'101101110101101', L:'100100100100111', M:'101111111101101', N:'110101101101101', O:'010101101101010',
    P:'110101110100100', Q:'010101101110011', R:'110101110101101', S:'011100010001110', T:'111010010010010',
    U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101', Y:'101101010010010',
    Z:'111001010100111', 0:'111101101101111', 1:'010110010010111', 2:'110001010100111', 3:'110001010001110',
    4:'101101111001001', 5:'111100110001110', 6:'011100111101111', 7:'111001010010010', 8:'111101111101111',
    9:'111101111001110', '$':'011110010011110', '-':'000000111000000', '.':'000000000000010', '/':'001001010100100',
    "'":'010010000000000', '!':'010010010000010', '×':'000101010101000', '+':'000010111010000', ':':'000010000010000',
    '?':'110001010000010', '¢':'010111100111010', '&':'010101010101011', ' ':'000000000000000'
  };
  function textWidth(s){ return s.length ? s.length * 4 - 1 : 0; }
  function text(ctx, s, x, y, colour, shadow){
    s = String(s).toUpperCase();
    if (shadow) text(ctx, s, x + 1, y + 1, shadow);
    ctx.fillStyle = colour;
    for (let i = 0; i < s.length; i++){
      const g = G[s[i]] || G['?'];
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1);
    }
  }
  function textC(ctx, s, cx, y, colour, shadow){ text(ctx, s, Math.round(cx - textWidth(String(s)) / 2), y, colour, shadow); }

  /* ---- sprites: one character per pixel, '.' is clear ---- */
  const SPRITES = {
    lamp:  ['...o...','.ooooo.','oyWyyyo','oyyyyyo','oyyyyyo','.ooooo.','...o...','...o...','..ooo..'],
    pint:  ['.WWWWW.','oWWWWWo','oyyyyyo','oyyyyyo','oyyyyyo','oyyyyyo','.oyyyo.','.ooooo.'],
    club:  ['...o...','..ooo..','..ooo..','oo.o.oo','ooooooo','oo.o.oo','...o...','..ooo..'],
    dice:  ['ooooooo','okoooko','ooooooo','oookooo','ooooooo','okoooko','ooooooo'],
    crown: ['y..y..y','yy.y.yy','yyyyyyy','yWyWyWy','yyyyyyy','ooooooo'],
    star:  ['...y...','...y...','yyyWyyy','.yyWyy.','..yyy..','.yy.yy.','yy...yy'],
    heart: ['.oo.oo.','ooooooo','ooooooo','.ooooo.','..ooo..','...o...'],
    spade: ['...o...','..ooo..','.ooooo.','ooooooo','oo.o.oo','...o...','..ooo..'],
    diamond:['...o...','..ooo..','.ooooo.','ooooooo','.ooooo.','..ooo..','...o...'],
    cat:   ['o.....o','oo...oo','ooooooo','oyoooyo','ooooooo','.ooooo.','..o.o..'],
    bolt:  ['...yy','..yy.','.yy..','yyyy.','..yy.','.yy..','yy...'],
    eye:   ['...ooo...','.ooWWWoo.','oWWyyyWWo','oWyyoyyWo','oWWyyyWWo','.ooWWWoo.','...ooo...'],
    skull: ['.ooooo.','ooooooo','oWoooWo','ooooooo','.oo.oo.','.o.o.o.']
  };
  function sprite(ctx, name, x, y, pal){
    const rows = SPRITES[name];
    if (!rows) return;
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++){
        const c = pal[row[i]];
        if (c){ ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); }
      }
    });
  }
  const spriteSize = name => { const r = SPRITES[name] || ['']; return { w:r[0].length, h:r.length }; };

  /* A tiny repeatable random, so a pack's creases are the same every frame. */
  function rng(seed){ let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

  /* ---- the pack ----
     w,h: art pixels. opts.small: the machine size (fewer details).
     opts.lit: 0..1 how lit (the machine's tube light), opts.sheen: 0..1
     where the foil glint sits (moves with tilt). */
  function pack(ctx, tierId, x, y, w, h, opts = {}){
    const t = tier(tierId);
    const small = !!opts.small;
    const crimp = small ? 2 : Math.max(3, Math.round(h * .045));
    const r = rng(tierId.length * 977 + w * 13 + h);
    // body
    ctx.fillStyle = t.body; ctx.fillRect(x, y + crimp, w, h - crimp * 2);
    // crimped seals: teeth at both ends, ribbed
    for (let side = 0; side < 2; side++){
      const sy = side ? y + h - crimp : y;
      ctx.fillStyle = t.seal; ctx.fillRect(x, sy, w, crimp);
      ctx.fillStyle = t.lo;
      for (let i = 0; i < w; i += 2) ctx.fillRect(x + i, sy, 1, crimp);
      // teeth on the outer edge
      ctx.clearRect(x, side ? sy + crimp - 1 : sy, w, 1);
      ctx.fillStyle = t.seal;
      for (let i = 0; i < w; i += 2) ctx.fillRect(x + i, side ? sy + crimp - 1 : sy, 1, 1);
    }
    // left light and right shade, as if the wrapper is pillowed
    ctx.fillStyle = t.hi; ctx.fillRect(x, y + crimp, 1, h - crimp * 2);
    if (!small) ctx.fillRect(x + 1, y + crimp + 1, 1, h - crimp * 2 - 2);
    ctx.fillStyle = t.lo; ctx.fillRect(x + w - 1, y + crimp, 1, h - crimp * 2);
    if (!small) ctx.fillRect(x + w - 2, y + crimp + 1, 1, h - crimp * 2 - 2);
    // a pillow: the seams pinch in under the crimp
    ctx.fillStyle = t.lo; ctx.fillRect(x, y + crimp, w, 1); ctx.fillRect(x, y + h - crimp - 1, w, 1);

    const inner = { x:x + 2, y:y + crimp + 2, w:w - 4, h:h - crimp * 2 - 4 };
    // per tier wrapper detail
    if (t.id === 'alley'){
      // brown paper: creases
      ctx.fillStyle = t.lo;
      const n = small ? 3 : 9;
      for (let i = 0; i < n; i++){
        let cx = inner.x + Math.floor(r() * inner.w), cy = inner.y + Math.floor(r() * inner.h);
        const len = 3 + Math.floor(r() * (small ? 4 : 10)), dx = r() < .5 ? 1 : -1;
        for (let k = 0; k < len; k++){
          if (cx >= inner.x && cx < inner.x + inner.w && cy < inner.y + inner.h) ctx.fillRect(cx, cy, 1, 1);
          cx += dx; cy += r() < .6 ? 1 : 0;
        }
      }
      ctx.fillStyle = t.hi;
      for (let i = 0; i < n; i++) ctx.fillRect(inner.x + Math.floor(r() * inner.w), inner.y + Math.floor(r() * inner.h), 1, 1);
    } else if (t.id === 'pub'){
      ctx.fillStyle = t.band;
      ctx.fillRect(x, y + Math.round(h * .26), w, 1); ctx.fillRect(x, y + Math.round(h * .74), w, 1);
    } else if (t.id === 'club'){
      ctx.fillStyle = t.hi;
      for (let i = inner.x + 1; i < inner.x + inner.w; i += small ? 4 : 5) ctx.fillRect(i, inner.y, 1, inner.h);
    } else if (t.id === 'casino'){
      ctx.fillStyle = t.lo;
      const s = small ? 4 : 6;
      for (let j = 0; j < inner.h; j += s) for (let i = (j / s) % 2 ? s / 2 : 0; i < inner.w; i += s){
        ctx.fillRect(inner.x + i, inner.y + j, 1, 1); ctx.fillRect(inner.x + i - 1, inner.y + j + 1, 3, 1); ctx.fillRect(inner.x + i, inner.y + j + 2, 1, 1);
      }
    } else if (t.id === 'high'){
      ctx.fillStyle = '#C99A2E';
      ctx.fillRect(inner.x, inner.y, inner.w, 1); ctx.fillRect(inner.x, inner.y + inner.h - 1, inner.w, 1);
      ctx.fillRect(inner.x, inner.y, 1, inner.h); ctx.fillRect(inner.x + inner.w - 1, inner.y, 1, inner.h);
      if (!small){
        ctx.fillStyle = '#6E5420';
        ctx.fillRect(inner.x + 2, inner.y + 2, inner.w - 4, 1); ctx.fillRect(inner.x + 2, inner.y + inner.h - 3, inner.w - 4, 1);
      }
    } else if (t.id === 'gold'){
      // foil: diagonal light bands
      for (let j = 0; j < inner.h + 4; j++) for (let i = 0; i < inner.w + 4; i++){
        const d = (i + j) % (small ? 9 : 14);
        if (d === 0 || d === 1){ ctx.fillStyle = d ? '#F6CF5A' : t.hi; ctx.fillRect(x + i, y + crimp + j, 1, 1); }
      }
      ctx.fillStyle = t.hi; ctx.fillRect(x, y + crimp, w, h - crimp * 2 > 0 ? 0 : 0);
    }

    // the tear strip: a perforation under the top seal, with a notch
    if (!small){
      const py = y + crimp + 5;
      ctx.fillStyle = t.lo;
      for (let i = x + 1; i < x + w - 1; i += 3) ctx.fillRect(i, py, 2, 1);
      ctx.fillStyle = t.hi;
      for (let i = x + 1; i < x + w - 1; i += 3) ctx.fillRect(i, py + 1, 2, 1);
      ctx.clearRect(x, py - 1, 2, 3); ctx.fillStyle = t.lo; ctx.fillRect(x + 2, py - 1, 1, 3);
    }
    // the label: a band across the middle with the emblem in a window
    const twoLine = !small && textWidth(t.name) > w - 6;
    const bandH = small ? 7 : twoLine ? 15 : 11;
    const bandY = y + Math.round(h * (small ? .56 : .5));
    ctx.fillStyle = t.ink; ctx.fillRect(x, bandY - 1, w, bandH + 2);
    ctx.fillStyle = t.band; ctx.fillRect(x, bandY, w, bandH);
    if (!small){
      ctx.fillStyle = t.ink; ctx.globalAlpha = .18; ctx.fillRect(x, bandY + bandH - 2, w, 2); ctx.globalAlpha = 1;
      const words = t.name.split(' ');
      if (twoLine && words.length > 1){
        textC(ctx, words[0], x + w / 2, bandY + 2, t.bandInk);
        textC(ctx, words.slice(1).join(' '), x + w / 2, bandY + 8, t.bandInk);
      } else textC(ctx, t.name, x + w / 2, bandY + Math.round((bandH - 5) / 2), t.bandInk);
    } else {
      ctx.fillStyle = t.bandInk;
      for (let i = x + 2; i < x + w - 2; i += 2) ctx.fillRect(i, bandY + 3, 1, 1);
    }

    // emblem medallion above the band
    const es = spriteSize(t.emblem);
    const pal = { o:['high','club','casino'].includes(t.id) ? t.band : t.ink, y:t.id === 'gold' ? '#FFF1B8' : '#F2C94C', W:'#FFF6DA', k:t.ink };
    if (t.id === 'gold') pal.o = t.ink;
    const top = small ? y + crimp + 2 : y + crimp + 10;
    const em = small ? 1 : Math.max(1, Math.min(3, Math.floor((bandY - 3 - top - 6) / es.h)));
    const medW = small ? es.w + 2 : es.w * em + 6, medH = small ? es.h + 2 : es.h * em + 6;
    const mx = x + Math.round((w - medW) / 2), my = small ? top : top + Math.max(0, Math.round((bandY - 1 - top - medH) / 2));
    if (!small){
      ctx.fillStyle = t.ink; ctx.fillRect(mx - 1, my - 1, medW + 2, medH + 2);
      ctx.fillStyle = t.id === 'high' ? '#2D2A35' : t.id === 'gold' ? '#F0C552' : t.lo; ctx.fillRect(mx, my, medW, medH);
      ctx.fillStyle = t.hi; ctx.fillRect(mx, my, medW, 1); ctx.fillRect(mx, my, 1, medH);
      // the emblem, drawn at 2x inside the medallion
      const off = document.createElement('canvas'); off.width = es.w; off.height = es.h;
      sprite(off.getContext('2d'), t.emblem, 0, 0, pal);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, mx + 3, my + 3, es.w * em, es.h * em);
    } else {
      sprite(ctx, t.emblem, x + Math.round((w - es.w) / 2), my, pal);
    }

    // price tag sticker (big pack only) and the wax seal on gold
    if (!small){
      if (t.id === 'gold'){
        const sx = x + Math.round(w / 2) - 5, sy = bandY + bandH + Math.max(2, Math.round((y + h - crimp - bandY - bandH - 11) / 2));
        ctx.fillStyle = '#5E0D14'; ctx.fillRect(sx + 1, sy, 9, 11); ctx.fillRect(sx, sy + 1, 11, 9);
        ctx.fillStyle = t.seal; ctx.fillRect(sx + 2, sy + 1, 7, 9); ctx.fillRect(sx + 1, sy + 2, 9, 7);
        ctx.fillStyle = '#D9454F'; ctx.fillRect(sx + 3, sy + 2, 3, 1); ctx.fillRect(sx + 2, sy + 3, 1, 2);
        sprite(ctx, 'diamond', sx + 2, sy + 2, { o:'#5E0D14' });
      } else {
        const label = '$' + t.price.toLocaleString('en-US').replace(/,/g, '');
        const tw = textWidth(label) + 4;
        const tx = x + Math.round((w - tw) / 2), ty = bandY + bandH + Math.max(3, Math.round((y + h - crimp - bandY - bandH - 7) / 2));
        ctx.fillStyle = '#1A120A'; ctx.fillRect(tx - 1, ty - 1, tw + 2, 9);
        ctx.fillStyle = '#F4EFE1'; ctx.fillRect(tx, ty, tw, 7);
        text(ctx, label, tx + 2, ty + 1, '#A3242E');
      }
    }
    // the sheen: a soft diagonal glint that slides with tilt
    const sheen = opts.sheen == null ? .3 : opts.sheen;
    const gx = x + Math.round(sheen * (w + h)) - h;
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = t.id === 'alley' ? .07 : t.id === 'gold' || t.id === 'high' ? .22 : .14;
    for (let j = 0; j < h - crimp * 2; j++){
      const sx = gx + j;
      const a = Math.max(x, sx), b = Math.min(x + w, sx + (small ? 2 : 4));
      if (b > a) ctx.fillRect(a, y + crimp + (h - crimp * 2 - 1 - j), b - a, 1);
    }
    ctx.globalAlpha = 1;
    // lighting (the machine's tube)
    if (opts.lit != null && opts.lit < 1){
      ctx.fillStyle = '#000000'; ctx.globalAlpha = Math.min(.82, 1 - opts.lit); ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    }
  }

  /* ---- a vending coil's front loop ----
     Seen from the front: a wire ring round the lower half of the pack and
     the wire's cut end, which travels round the ring as the coil turns. */
  function coil(ctx, cx, cy, rad, turn, dim){
    const steel = dim ? '#4A4C4E' : '#B9BDC0', dark = dim ? '#25272A' : '#5B6064', hi = dim ? '#6A6D70' : '#F1F4F2';
    // the ring, as pixel circle (midpoint)
    const plot = (px, py, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); };
    // the next turn of the spiral, further back and dimmer
    for (let a = 10; a < 170; a += 3){
      const r2 = a * Math.PI / 180;
      plot(cx + Math.cos(r2) * (rad - 1), cy - 3 + Math.sin(r2) * (rad - 1) * .5, dark);
    }
    for (let a = 0; a < 360; a += 2){
      const rad2 = a * Math.PI / 180;
      const px = cx + Math.cos(rad2) * rad, py = cy + Math.sin(rad2) * rad * .55;
      if (Math.sin(rad2) <= -.05) continue; // the back of the loop is behind the pack
      plot(px, py + 1, dark);
      plot(px, py, Math.cos(rad2) < -.3 ? hi : steel);
    }
    // the wire runs back from the loop, a short way into the dark
    plot(cx - rad, cy - 1, dark); plot(cx + rad, cy - 1, dark);
    // glint that walks with the turn
    const g = turn * Math.PI * 2;
    const gx = cx + Math.cos(Math.PI * .5 + Math.sin(g) * .9) * rad, gy = cy + Math.sin(Math.PI * .5 + Math.sin(g) * .9) * rad * .55;
    plot(gx, gy, hi);
    // the cut end of the wire, a short stub pointing along the turn
    const e = Math.PI * .15 + g;
    const ex = cx + Math.cos(e) * rad, ey = cy + Math.sin(e) * rad * .55;
    if (Math.sin(e) > -.2){ plot(ex, ey, hi); plot(ex + Math.cos(e + 1.6) * 1.2, ey + Math.sin(e + 1.6) * .8, steel); }
  }

  /* ---- the card back ---- */
  function back(ctx, w, h, rarity){
    ctx.fillStyle = '#4A1520'; ctx.fillRect(0, 0, w, h);
    // lattice
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){
      const d1 = (i + j) % 8, d2 = (i - j + 800) % 8;
      if (d1 === 0 || d2 === 0){ ctx.fillStyle = '#6B2330'; ctx.fillRect(i, j, 1, 1); }
      if (d1 === 0 && d2 === 0){ ctx.fillStyle = '#C99A3A'; ctx.fillRect(i, j, 1, 1); }
    }
    // frame
    ctx.fillStyle = '#E8B83A';
    ctx.fillRect(3, 3, w - 6, 1); ctx.fillRect(3, h - 4, w - 6, 1); ctx.fillRect(3, 3, 1, h - 6); ctx.fillRect(w - 4, 3, 1, h - 6);
    ctx.fillStyle = '#2A0B11';
    ctx.fillRect(4, 4, w - 8, 1); ctx.fillRect(4, 4, 1, h - 8);
    // centre plate
    const pw = Math.min(w - 14, 34), ph = 22, px = Math.round((w - pw) / 2), py = Math.round((h - ph) / 2);
    ctx.fillStyle = '#1A070C'; ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    ctx.fillStyle = '#E8B83A'; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#4A1520'; ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    textC(ctx, 'POKER', w / 2, py + 4, '#F6D06B', '#1A070C');
    textC(ctx, 'FACES', w / 2, py + 12, '#F4EFE1', '#1A070C');
    // suits in the corners
    const pal = { o:'#E8B83A' };
    sprite(ctx, 'spade', 7, 7, pal); sprite(ctx, 'heart', w - 14, 8, pal);
    sprite(ctx, 'diamond', 7, h - 14, pal); sprite(ctx, 'club', w - 14, h - 14, pal);
    if (rarity === 'rare' || rarity === 'foil'){
      ctx.fillStyle = rarity === 'foil' ? '#FFF1B8' : '#F2C94C';
      ctx.fillRect(1, 1, w - 2, 1); ctx.fillRect(1, h - 2, w - 2, 1); ctx.fillRect(1, 1, 1, h - 2); ctx.fillRect(w - 2, 1, 1, h - 2);
    }
  }

  /* ---- the art window on a card face ----
     kind: event | format | big | challenge | jinx | wild | chips | cosmetic
     Drawn small (about 56 x 30) and scaled by the card. */
  function scene(ctx, w, h, card, phase){
    phase = phase || 0;
    const t = tier(card.tier);
    const k = card.kind;
    const R = rng(card.id.length * 31 + card.id.charCodeAt(0) * 7);
    if (k === 'wild'){
      // a swirl of shifting colour bands
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){
        const v = Math.sin((i - w / 2) * .18 + phase) + Math.cos((j - h / 2) * .22 - phase * .7) + Math.sin(Math.hypot(i - w / 2, j - h / 2) * .35 - phase * 1.6);
        const idx = ((Math.floor((v + 3) * 1.5)) % 5 + 5) % 5;
        ctx.fillStyle = ['#2A0B3D', '#6A1F7A', '#D24A8C', '#F2C94C', '#3FB7C6'][idx];
        ctx.fillRect(i, j, 1, 1);
      }
      const s = card.glyph || 'eye';
      const sz = spriteSize(s);
      ctx.fillStyle = '#000'; ctx.globalAlpha = .35; ctx.fillRect(Math.round(w / 2 - sz.w), Math.round(h / 2 - sz.h) + 1, sz.w * 2 + 2, sz.h * 2 + 1); ctx.globalAlpha = 1;
      const off = document.createElement('canvas'); off.width = sz.w; off.height = sz.h;
      sprite(off.getContext('2d'), s, 0, 0, { o:'#120617', W:'#FFF6DA', y:'#FFE58A' });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, Math.round(w / 2 - sz.w), Math.round(h / 2 - sz.h), sz.w * 2, sz.h * 2);
      return;
    }
    if (k === 'jinx'){
      ctx.fillStyle = '#14101A'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++){ ctx.fillStyle = R() < .5 ? '#2A2235' : '#1E1828'; ctx.fillRect(Math.floor(R() * w), Math.floor(R() * h), 1, 1); }
      // a moon and a black cat on a rail
      ctx.fillStyle = '#E9E2C0'; ctx.fillRect(w - 14, 4, 6, 6); ctx.fillRect(w - 15, 5, 8, 4);
      ctx.fillStyle = '#14101A'; ctx.fillRect(w - 12, 4, 4, 5);
      ctx.fillStyle = '#4B2E1E'; ctx.fillRect(0, h - 6, w, 2);
      ctx.fillStyle = '#2C1A10'; ctx.fillRect(0, h - 4, w, 4);
      const blink = Math.floor(phase * 1.3) % 7 === 0;
      const off = document.createElement('canvas'); off.width = 7; off.height = 7;
      sprite(off.getContext('2d'), 'cat', 0, 0, { o:'#050407', y:blink ? '#050407' : '#C8E04A' });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, Math.round(w / 2 - 7), h - 20, 14, 14);
      ctx.fillStyle = '#050407'; ctx.fillRect(Math.round(w / 2) + 6, h - 12, 1, 6); ctx.fillRect(Math.round(w / 2) + 7, h - 13, 1, 2);
      return;
    }
    if (k === 'chips'){
      ctx.fillStyle = '#1E4A33'; ctx.fillRect(0, 0, w, h);
      for (let j = 0; j < h; j += 2) for (let i = (j / 2) % 2; i < w; i += 2){ ctx.fillStyle = '#245A3E'; ctx.fillRect(i, j, 1, 1); }
      const cols = ['#E8B83A', '#C8322B', '#2B4F9E', '#22201C', '#F4EFE1'];
      const stacks = 5;
      for (let s = 0; s < stacks; s++){
        const sx = 6 + s * Math.floor((w - 12) / stacks), hgt = 3 + Math.floor(R() * 6) + (s === 2 ? 4 : 0);
        const c = cols[s % cols.length];
        for (let n = 0; n < hgt; n++){
          const cy = h - 5 - n * 2;
          ctx.fillStyle = '#0B1A12'; ctx.fillRect(sx - 1, cy, 9, 3);
          ctx.fillStyle = c; ctx.fillRect(sx, cy, 7, 2);
          ctx.fillStyle = '#F4EFE1'; ctx.fillRect(sx + 1 + (n % 2) * 4, cy, 1, 1);
        }
      }
      // sparkle
      const sp = Math.floor(phase * 2) % 3;
      ctx.fillStyle = '#FFF6DA'; ctx.fillRect(10 + sp * 14, 4, 1, 3); ctx.fillRect(9 + sp * 14, 5, 3, 1);
      return;
    }
    if (k === 'cosmetic'){
      // a fan of three card backs in the cosmetic's colours
      ctx.fillStyle = '#1B1117'; ctx.fillRect(0, 0, w, h);
      for (let j = 0; j < h; j++){ ctx.fillStyle = j % 4 ? '#22161D' : '#2B1C24'; ctx.fillRect(0, j, w, 1); }
      const c = card.swatch || ['#2B4F9E', '#E8B83A'];
      for (let n = 0; n < 3; n++){
        const bx = Math.round(w / 2 - 15 + n * 8), by = 4 + Math.abs(n - 1) * 2;
        ctx.fillStyle = '#0B0709'; ctx.fillRect(bx - 1, by - 1, 16, 23);
        ctx.fillStyle = c[0]; ctx.fillRect(bx, by, 14, 21);
        ctx.fillStyle = c[1];
        for (let j = 0; j < 21; j++) for (let i = 0; i < 14; i++) if ((i + j) % 4 === 0 && (i - j + 40) % 4 === 0) ctx.fillRect(bx + i, by + j, 1, 1);
        ctx.fillRect(bx + 1, by + 1, 12, 1); ctx.fillRect(bx + 1, by + 19, 12, 1);
      }
      return;
    }
    // events, formats, big money, challenges: a table seen from above
    const feltA = k === 'big' ? '#5A1520' : t.id === 'pub' ? '#1F5A35' : t.id === 'club' ? '#1F3D5A' : t.id === 'casino' ? '#174631' : t.id === 'high' ? '#2C2236' : t.id === 'gold' ? '#4A1520' : '#24452F';
    const feltB = k === 'big' ? '#4A111A' : '#00000000';
    ctx.fillStyle = '#120B09'; ctx.fillRect(0, 0, w, h);
    // room light
    for (let j = 0; j < h; j++){ ctx.fillStyle = j < h / 2 ? '#1A110D' : '#160E0B'; ctx.fillRect(0, j, w, 1); }
    // lamp cone
    ctx.fillStyle = '#F2C94C'; ctx.globalAlpha = .07;
    for (let j = 0; j < h; j++){ const half = 4 + j * .9; ctx.fillRect(Math.round(w / 2 - half), j, Math.round(half * 2), 1); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3A2A12'; ctx.fillRect(Math.round(w / 2) - 3, 0, 6, 2);
    ctx.fillStyle = '#F6D06B'; ctx.fillRect(Math.round(w / 2) - 2, 2, 4, 1);
    // table: an oval rail and felt
    const tx = 5, ty = Math.round(h * .38), tw = w - 10, th = h - ty - 3;
    for (let j = 0; j < th; j++){
      const yy = (j / (th - 1)) * 2 - 1;
      const half = Math.sqrt(Math.max(0, 1 - yy * yy)) * tw / 2;
      const x0 = Math.round(w / 2 - half), x1 = Math.round(w / 2 + half);
      ctx.fillStyle = '#6B4226'; ctx.fillRect(x0, ty + j, x1 - x0, 1);
      if (j > 1 && j < th - 2){
        const inner = Math.max(0, half - 3);
        ctx.fillStyle = feltA; ctx.fillRect(Math.round(w / 2 - inner), ty + j, Math.round(inner * 2), 1);
        if (k === 'big' && j % 2){ ctx.fillStyle = feltB; }
      }
    }
    ctx.fillStyle = '#8A5A35'; ctx.fillRect(Math.round(w / 2 - tw / 2 + 6), ty, tw - 12, 1);
    // seats: little heads round the far side
    const seats = Math.max(1, Math.min(7, (card.seats || 4) - 1));
    const headCols = ['#AB55D8', '#6969C9', '#DF8E2F', '#6EA6FF', '#4E9F63', '#4B9D9C', '#D3578B'];
    for (let s = 0; s < seats; s++){
      const a = Math.PI * (1 + (s + 1) / (seats + 1));
      const hx = Math.round(w / 2 + Math.cos(a) * (tw / 2 + 1) - 2), hy = Math.round(ty + th / 2 + Math.sin(a) * (th / 2 + 2) - 3);
      ctx.fillStyle = '#0B0709'; ctx.fillRect(hx - 1, hy - 1, 6, 6);
      ctx.fillStyle = headCols[s % headCols.length]; ctx.fillRect(hx, hy, 4, 4);
      const look = Math.floor(phase + s) % 4 === 0 ? 1 : 0;
      ctx.fillStyle = '#0B0709'; ctx.fillRect(hx + look, hy + 1, 1, 1); ctx.fillRect(hx + 2 + look, hy + 1, 1, 1);
    }
    // a pot of chips in the middle, bigger with the stakes
    const potN = k === 'big' ? 9 : ({ alley:2, pub:3, club:4, casino:5, high:6, gold:8 })[t.id] || 3;
    for (let n = 0; n < potN; n++){
      const px = Math.round(w / 2 - potN + n * 2 + (n % 2)), py = ty + Math.round(th / 2) - (n % 3);
      ctx.fillStyle = '#0B0709'; ctx.fillRect(px - 1, py - 1, 4, 3);
      ctx.fillStyle = ['#E8B83A', '#C8322B', '#F4EFE1', '#2B4F9E'][n % 4]; ctx.fillRect(px, py, 2, 1);
    }
    // two cards on the felt
    ctx.fillStyle = '#0B0709'; ctx.fillRect(Math.round(w / 2) - 7, ty + Math.round(th / 2) + 2, 13, 6);
    ctx.fillStyle = '#F4EFE1'; ctx.fillRect(Math.round(w / 2) - 6, ty + Math.round(th / 2) + 3, 5, 4); ctx.fillRect(Math.round(w / 2) + 0, ty + Math.round(th / 2) + 3, 5, 4);
    ctx.fillStyle = '#C8322B'; ctx.fillRect(Math.round(w / 2) - 4, ty + Math.round(th / 2) + 4, 1, 2);
    ctx.fillStyle = '#22201C'; ctx.fillRect(Math.round(w / 2) + 2, ty + Math.round(th / 2) + 4, 1, 2);
    if (k === 'challenge'){
      // a target ring over the table
      ctx.fillStyle = '#F2C94C';
      const cx = w - 11, cy = 8;
      for (let a = 0; a < 360; a += 20){ const r2 = a * Math.PI / 180; ctx.fillRect(Math.round(cx + Math.cos(r2) * 5), Math.round(cy + Math.sin(r2) * 5), 1, 1); }
      ctx.fillRect(cx - 1, cy - 1, 3, 3); ctx.fillStyle = '#C8322B'; ctx.fillRect(cx, cy, 1, 1);
    }
    if (k === 'format'){
      sprite(ctx, card.glyph || 'bolt', 4, 3, { y:'#F2C94C' });
    }
    if (k === 'big'){
      ctx.fillStyle = '#F6D06B';
      const tw2 = textWidth('$$$');
      text(ctx, '$$$', w - tw2 - 4, 4, '#F6D06B', '#3A0A10');
    }
  }

  // where the perforation sits on a big pack (art pixels from its top)
  const tearY = h => Math.max(3, Math.round(h * .045)) + 5;

  return { TIERS, tier, tearY, text, textC, textWidth, sprite, spriteSize, pack, coil, back, scene, rng };
})();
