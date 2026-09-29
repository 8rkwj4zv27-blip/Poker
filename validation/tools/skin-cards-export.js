"use strict";
/* SKIN · CARD TEMPLATES — renders the game's own cards into drawing
   templates for the owner (docs/ui/SKIN_PLAN.md, the card pilot).

   Usage (from the repo root, with a local server running):
     python3 -m http.server 8765
     NODE_PATH=$(npm root -g) node validation/tools/skin-cards-export.js

   Writes assets/skin/templates/cards/:
     cards-L-back.png   cards-L-face.png   cards-L-index.png   (your hand)
     cards-M-back.png   cards-M-face.png   cards-M-index.png   (board, deck)
     cards-S-back.png   cards-S-face.png   cards-S-index.png   (opponents)
     cards-?-index-guide.png   the index sheet with every cell shaded
     cards.json         where every part of the index sheet lands on a card

   How: the real game page loads (every stylesheet, the player's default
   settings), then a stage is laid over it holding cards inside copies of
   their real contexts (your card holder, the board, an opponent's seat, the
   dealer deck), so the game's own rules size and dress them. Each part is
   captured on its own (the blank face, then only the rank, only the small
   suit, only the big pip) at one screen pixel per CSS pixel, with the
   background transparent, and cut into the sheet. Soft edges are made hard
   (alpha 50%) so every template pixel is a whole pixel.

   Then it proves the cut: every card of every tier is put back together
   from the parts exactly as js/card-skin.js does it, and compared with the
   game's real card. A pixel only counts as wrong away from a glyph's soft
   edge; the run fails on any. (SKIN_NUDGE=1 shifts every rank a pixel in
   the proof only: the run must then fail, which shows the proof can see.)
*/
const path = require('path');
const fs = require('fs');
const { withPage } = require('./touch-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets', 'skin', 'templates', 'cards');
const URL = process.env.SKIN_URL || 'http://localhost:8765/index.html';

// the three sizes a card is drawn at on an iPhone-sized table
const TIERS = {
  L: { name:'YOUR HAND', ctx:'hand' },
  M: { name:'BOARD + DECK', ctx:'board', backCtx:'deck' },
  S: { name:'OPPONENTS', ctx:'seat', small:true }
};
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];
const SUIT_CLASS = { '♠':'spade', '♥':'heart', '♦':'diamond', '♣':'club' };
const GAP = 4;          // transparent pixels between cells on the index sheet
const PITCH = 100;      // stage grid: one card per 100px square (your hand's card is 88 tall)
const COLS = 3;         // three across fits a 390px-wide phone
const VIEW = { width:390, height:844 };   // an iPhone: the game's phone rules apply, not its tablet ones

/* ---------------- the page side ---------------- */
function stageInPage(args){
  const { TIERS, RANKS, SUITS, SUIT_CLASS, PITCH, COLS } = args;
  const css = `
    html,body{ background:transparent !important; }
    body > *:not(#skin-stage){ display:none !important; }
    #skin-stage{ position:fixed; left:0; top:0; z-index:2147483647; display:block; background:transparent; }
    #skin-stage *{ transition:none !important; animation:none !important; }
    #skin-stage .sk-slot{ position:absolute; width:${PITCH}px; height:${PITCH}px; }
    #skin-stage .sk-ctx, #skin-stage .sk-ctx *:not(.card):not(.card *){
      position:static !important; transform:none !important; filter:none !important; inset:auto !important;
      zoom:1 !important; scale:none !important; translate:none !important; rotate:none !important;
      width:auto !important; height:auto !important; margin:0 !important; padding:0 !important; gap:0 !important;
      background:none !important; border:0 !important; box-shadow:none !important; display:block !important; opacity:1 !important;
    }
    #skin-stage .sk-ctx::before, #skin-stage .sk-ctx::after,
    #skin-stage .sk-ctx *:not(.card)::before, #skin-stage .sk-ctx *:not(.card)::after{ display:none !important; }
    #skin-stage .card{ position:relative !important; left:0 !important; top:0 !important; margin:0 !important; transform:none !important; zoom:1 !important; scale:none !important; translate:none !important; rotate:none !important; }
    /* your hand's face carries the holder's shade from the groove: that is
       the holder's, not the card's, and stays in the game on top of any art */
    #skin-stage .card:not(.back){ background:var(--card-face) !important; }
    #skin-stage .sk-blank .ci, #skin-stage .sk-blank .pip{ visibility:hidden !important; }
    #skin-stage .card.sk-layer:not(.back){ background:transparent !important; border-color:transparent !important; box-shadow:none !important; }
    #skin-stage .sk-layer .ci > *, #skin-stage .sk-layer .pip{ visibility:hidden !important; }
    #skin-stage .sk-layer.sk-only-r .r, #skin-stage .sk-layer.sk-only-s .s, #skin-stage .sk-layer.sk-only-pip .pip{ visibility:visible !important; }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const stage = document.createElement('div'); stage.id = 'skin-stage'; document.body.appendChild(stage);
  // a card inside a copy of its real context, so the game's own rules dress it
  const wrap = (ctx, cardHTML) => {
    if (ctx === 'hand') return '<div class="sk-ctx" id="hud-mid"><div class="seat you"><div class="seat-cards">' + cardHTML + '</div></div></div>';
    if (ctx === 'board') return '<div class="sk-ctx board">' + cardHTML + '</div>';
    if (ctx === 'seat') return '<div class="sk-ctx felt opponents-3" id="felt"><div class="seat ec-seat"><div class="seat-cards ec-out">' + cardHTML + '</div></div></div>';
    if (ctx === 'deck') return '<div class="sk-ctx" id="felt"><div class="dealer-station"><div class="dealer-deck"><div class="card back ds-top" style="--ds-i:0"></div></div></div></div>';
    throw new Error('context ' + ctx);
  };
  const cardHTML = (t, rank, suit, extra) => {
    const cls = 'card' + (TIERS[t].small ? ' small' : '') + (rank ? ' ' + SUIT_CLASS[suit] : ' back') + (extra ? ' ' + extra : '');
    return '<div class="' + cls + '">' + (rank ? '<div class="ci"><span class="r">' + rank + '</span><span class="s">' + suit + '</span></div><div class="pip">' + suit + '</div>' : '') + '</div>';
  };
  const slots = [];
  let n = 0;
  const add = (t, kind, rank, suit, extra, ctx) => {
    const col = n % COLS, row = Math.floor(n / COLS); n++;
    const el = document.createElement('div');
    el.className = 'sk-slot'; el.style.left = (col * PITCH) + 'px'; el.style.top = (row * PITCH) + 'px';
    el.innerHTML = wrap(ctx || TIERS[t].ctx, cardHTML(t, rank, suit, extra));
    stage.appendChild(el);
    slots.push({ t, kind, rank, suit, el });
  };
  Object.keys(TIERS).forEach(t => {
    add(t, 'back', null, null, '', TIERS[t].backCtx || TIERS[t].ctx);
    add(t, 'face', 'A', '♠', 'sk-blank');
    RANKS.forEach(r => add(t, 'rank-black', r, '♠', 'sk-layer sk-only-r'));
    RANKS.forEach(r => add(t, 'rank-red', r, '♥', 'sk-layer sk-only-r'));
    SUITS.forEach(s => add(t, 'suit', 'A', s, 'sk-layer sk-only-s'));
    SUITS.forEach(s => add(t, 'pip', 'A', s, 'sk-layer sk-only-pip'));
    // the real thing, for the round-trip proof
    RANKS.forEach(r => SUITS.forEach(s => add(t, 'real', r, s, '')));
  });
  const W = COLS * PITCH, H = Math.ceil(n / COLS) * PITCH;
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  // measure every card and its parts, relative to the card's outer edge
  const o = stage.getBoundingClientRect();
  const out = slots.map(s => {
    const card = s.el.querySelector('.card');
    const c = card.getBoundingClientRect();
    const rel = sel => { const e = card.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x:b.left - c.left, y:b.top - c.top, w:b.width, h:b.height }; };
    return { t:s.t, kind:s.kind, rank:s.rank, suit:s.suit, x:c.left - o.left, y:c.top - o.top, w:c.width, h:c.height, r:rel('.r'), s:rel('.s'), pip:rel('.pip') };
  });
  return { W, H, slots:out };
}

/* the cutting, in the page (a canvas does the pixel work) */
async function cutInPage(args){
  const { shots, stage, TIERS, RANKS, SUITS, GAP } = args;
  const full = document.createElement('canvas'); full.width = stage.W; full.height = stage.H;
  const fx = full.getContext('2d');
  for (const sh of shots){ const img = new Image(); img.src = 'data:image/png;base64,' + sh.png; await img.decode(); fx.drawImage(img, 0, sh.y); }
  const px = fx.getImageData(0, 0, full.width, full.height);
  // hard pixels: alpha is all or nothing
  for (let i = 3; i < px.data.length; i += 4) px.data[i] = px.data[i] >= 128 ? 255 : 0;
  for (let i = 0; i < px.data.length; i += 4) if (!px.data[i + 3]){ px.data[i] = px.data[i + 1] = px.data[i + 2] = 0; }
  fx.putImageData(px, 0, 0);
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const crop = (x, y, w, h) => { const c = canvas(w, h); c.getContext('2d').drawImage(full, x, y, w, h, 0, 0, w, h); return c; };
  const inkBox = (x, y, w, h) => {   // the drawn pixels inside a box, in box coordinates
    const d = fx.getImageData(x, y, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3]){ if (i < x0) x0 = i; if (j < y0) y0 = j; if (i > x1) x1 = i; if (j > y1) y1 = j; }
    return x1 < 0 ? null : { x:x0, y:y0, w:x1 - x0 + 1, h:y1 - y0 + 1 };
  };
  const round = b => ({ x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.w), h:Math.round(b.h) });
  const files = {}, manifest = { version:1, gap:GAP, ranks:RANKS, suits:SUITS, tiers:{} };
  const report = {};
  for (const t of Object.keys(TIERS)){
    const S = stage.slots.filter(s => s.t === t);
    const back = S.find(s => s.kind === 'back'), face = S.find(s => s.kind === 'face');
    const W = Math.round(face.w), H = Math.round(face.h);
    const bw = Math.round(back.w), bh = Math.round(back.h);
    files['cards-' + t + '-back.png'] = crop(back.x, back.y, bw, bh);
    files['cards-' + t + '-face.png'] = crop(face.x, face.y, W, H);
    // a cell for each part: the part's own box, grown to hold every glyph's ink
    const cellFor = (list, key) => {
      let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
      list.forEach(s => {
        const b = round(s[key]); x1 = Math.max(x1, b.w); y1 = Math.max(y1, b.h);
        const ink = inkBox(s.x, s.y, W, H);
        if (ink){ x0 = Math.min(x0, ink.x - b.x); y0 = Math.min(y0, ink.y - b.y); x1 = Math.max(x1, ink.x + ink.w - b.x); y1 = Math.max(y1, ink.y + ink.h - b.y); }
      });
      return { dx:x0, dy:y0, w:x1 - x0, h:y1 - y0 };
    };
    const rankSlots = S.filter(s => s.kind === 'rank-black' || s.kind === 'rank-red');
    const suitSlots = S.filter(s => s.kind === 'suit'), pipSlots = S.filter(s => s.kind === 'pip');
    const rc = cellFor(rankSlots, 'r'), sc = cellFor(suitSlots, 's'), pc = cellFor(pipSlots, 'pip');
    // the sheet: black ranks, red ranks, small suits, big pips
    const rowW = [13 * rc.w + 12 * GAP, 13 * rc.w + 12 * GAP, 4 * sc.w + 3 * GAP, 4 * pc.w + 3 * GAP];
    const rows = { rankBlack:0, rankRed:rc.h + GAP, suit:2 * (rc.h + GAP), pip:2 * (rc.h + GAP) + sc.h + GAP };
    const sheetW = Math.max(...rowW), sheetH = rows.pip + pc.h;
    const sheet = canvas(sheetW, sheetH), sx = sheet.getContext('2d');
    const cut = (s, key, cell, dx, dy) => { const b = round(s[key]); sx.drawImage(full, s.x + b.x + cell.dx, s.y + b.y + cell.dy, cell.w, cell.h, dx, dy, cell.w, cell.h); };
    RANKS.forEach((r, i) => {
      cut(S.find(s => s.kind === 'rank-black' && s.rank === r), 'r', rc, i * (rc.w + GAP), rows.rankBlack);
      cut(S.find(s => s.kind === 'rank-red' && s.rank === r), 'r', rc, i * (rc.w + GAP), rows.rankRed);
    });
    SUITS.forEach((u, i) => {
      cut(suitSlots.find(s => s.suit === u), 's', sc, i * (sc.w + GAP), rows.suit);
      cut(pipSlots.find(s => s.suit === u), 'pip', pc, i * (pc.w + GAP), rows.pip);
    });
    files['cards-' + t + '-index.png'] = sheet;
    // the guide: the same sheet with each cell shaded, to keep on a layer
    // under the drawing (anything drawn outside a cell never reaches a card)
    const guide = canvas(sheetW, sheetH), gx = guide.getContext('2d');
    const shade = (n, cell, y, count) => { for (let i = 0; i < count; i++){ gx.fillStyle = (i + n) % 2 ? '#CFE3F2' : '#F2D3DF'; gx.fillRect(i * (cell.w + GAP), y, cell.w, cell.h); } };
    shade(0, rc, rows.rankBlack, 13); shade(1, rc, rows.rankRed, 13); shade(0, sc, rows.suit, 4); shade(1, pc, rows.pip, 4);
    gx.drawImage(sheet, 0, 0);
    files['cards-' + t + '-index-guide.png'] = guide;
    // where each cell lands on a card: rank and small suit move with the
    // rank (a 10 is two characters wide), the big pip never moves
    const real = S.filter(s => s.kind === 'real');
    const place = { rank:{}, suit:{}, pip:null };
    RANKS.forEach(r => {
      const s = real.find(q => q.rank === r);
      const b = round(s.r), u = round(s.s);
      place.rank[r] = [b.x + rc.dx, b.y + rc.dy];
      place.suit[r] = [u.x + sc.dx, u.y + sc.dy];
    });
    { const b = round(real[0].pip); place.pip = [b.x + pc.dx, b.y + pc.dy]; }
    manifest.tiers[t] = {
      name:TIERS[t].name, w:W, h:H, back:{ w:bw, h:bh },
      cell:{ rank:[rc.w, rc.h], suit:[sc.w, sc.h], pip:[pc.w, pc.h] },
      sheet:{ w:sheetW, h:sheetH, rows },
      place
    };
    // the proof: put every card back together from the parts, compare
    const m = manifest.tiers[t];
    let worst = 0, total = 0, edges = 0, drift = 0;
    for (const s of real){
      const c = canvas(W, H), cx = c.getContext('2d');
      cx.drawImage(files['cards-' + t + '-face.png'], 0, 0);
      const red = s.suit === '♥' || s.suit === '♦', ri = RANKS.indexOf(s.rank), si = SUITS.indexOf(s.suit);
      const [rx0, ry] = m.place.rank[s.rank], rx = rx0 + (args.nudge || 0), [ux, uy] = m.place.suit[s.rank], [qx, qy] = m.place.pip;
      cx.drawImage(sheet, ri * (rc.w + GAP), red ? rows.rankRed : rows.rankBlack, rc.w, rc.h, rx, ry, rc.w, rc.h);
      cx.drawImage(sheet, si * (sc.w + GAP), rows.suit, sc.w, sc.h, ux, uy, sc.w, sc.h);
      cx.drawImage(sheet, si * (pc.w + GAP), rows.pip, pc.w, pc.h, qx, qy, pc.w, pc.h);
      // compared as ink or no ink: the game's glyphs have soft edges (half
      // ink, half card) and the templates make each of those a whole pixel,
      // so a pixel only counts when one side has ink and the other doesn't
      const a = cx.getImageData(0, 0, W, H).data, b = fx.getImageData(s.x, s.y, W, H).data;
      const blank = files['cards-' + t + '-face.png'].getContext('2d').getImageData(0, 0, W, H).data;
      const off = (d, i) => Math.abs(d[i] - blank[i]) + Math.abs(d[i + 1] - blank[i + 1]) + Math.abs(d[i + 2] - blank[i + 2]);
      // how far full ink is from the card, per colour: black ink is further than red
      const full = { black:0, red:0 };
      for (let i = 0; i < b.length; i += 4) if (blank[i + 3]){ const k = b[i] > b[i + 2] + 60 ? 'red' : 'black'; full[k] = Math.max(full[k], off(b, i)); }
      // the game's ink, pixel by pixel: 1 ink, 0 card, .5 a soft edge
      const inkOf = i => { if (!blank[i + 3]) return 0; const o = off(b, i) / (full[b[i] > b[i + 2] + 60 ? 'red' : 'black'] || 1); return o >= .62 ? 1 : o <= .38 ? 0 : .5; };
      const inkMap = new Float32Array(W * H);
      for (let p = 0; p < W * H; p++) inkMap[p] = inkOf(p * 4);
      // a pixel that disagrees is only wrong when it is well inside a glyph
      // or well clear of one (every neighbour agrees with it in the game).
      // Right on a glyph's edge the game's soft pixel can round either way.
      let diff = 0, edge = 0;
      const mask = args.debug ? cx.getImageData(0, 0, W, H) : null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
        const p = y * W + x, i = p * 4;
        if (!blank[i + 3] || inkMap[p] === .5) continue;
        if ((off(a, i) > 0) === (inkMap[p] === 1)) continue;
        let inside = true;
        for (let j = -1; j <= 1 && inside; j++) for (let k = -1; k <= 1; k++){
          const q = (y + j) * W + (x + k);
          if (y + j < 0 || y + j >= H || x + k < 0 || x + k >= W || inkMap[q] !== inkMap[p]){ inside = false; break; }
        }
        if (inside){ diff++; if (mask) mask.data.set([255, 0, 255, 255], i); } else edge++;
      }
      // and the middle of each part's ink (rank, suit, pip) sits where the
      // game's does, within 0.8px (the soft edges alone move it up to about
      // 0.65px; a one-pixel slip moves it 1.1px or more): this sees a slip that only
      // moves edges on the big cards
      const parts = [[rx, ry, rc], [ux, uy, sc], [qx, qy, pc]];
      for (const [px0, py0, cell] of parts){
        let ax = 0, ay = 0, an = 0, bx = 0, by = 0, bn = 0;
        for (let y = Math.max(0, py0); y < Math.min(H, py0 + cell.h); y++) for (let x = Math.max(0, px0); x < Math.min(W, px0 + cell.w); x++){
          const i = (y * W + x) * 4; if (!blank[i + 3]) continue;
          if (off(a, i) > 0){ ax += x; ay += y; an++; }
          const w = Math.min(1, off(b, i) / (full[b[i] > b[i + 2] + 60 ? 'red' : 'black'] || 1)); bx += x * w; by += y * w; bn += w;
        }
        if (an && bn){ const d = Math.max(Math.abs(ax / an - bx / bn), Math.abs(ay / an - by / bn)); drift = Math.max(drift, d); if (d > .8) diff++; }
      }
      worst = Math.max(worst, diff); total += diff; edges += edge;
      if (mask && diff && diff >= worst){ const d = canvas(W, H); d.getContext('2d').putImageData(mask, 0, 0); files['debug-' + t + '-worst-' + s.rank + '.png'] = d; files['debug-' + t + '-worst-real.png'] = crop(s.x, s.y, W, H); }
    }
    report[t] = { size:W + 'x' + H, back:bw + 'x' + bh, sheet:sheetW + 'x' + sheetH, misplacedPx:total, softEdgePxPerCard:+(edges / real.length).toFixed(1), worstPartDriftPx:+drift.toFixed(2) };
  }
  const png = {};
  for (const [k, c] of Object.entries(files)) png[k] = c.toDataURL('image/png').split(',')[1];
  return { png, manifest, report };
}

async function main(){
  await withPage({ ...VIEW, deviceScaleFactor:1 }, async page => {
    await page.goto(URL);
    await page.evaluate(() => { try{ localStorage.clear(); }catch(e){} });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const stage = await page.evaluate(stageInPage, { TIERS, RANKS, SUITS, SUIT_CLASS, PITCH, COLS });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    // the stage is taller than the phone: slide it up a screen at a time
    const shots = [];
    const step = Math.floor(VIEW.height / PITCH) * PITCH;
    for (let y = 0; y < stage.H; y += step){
      await page.evaluate(y => { document.getElementById('skin-stage').style.transform = 'translateY(' + (-y) + 'px)'; }, y);
      await page.waitForTimeout(50);
      const h = Math.min(step, stage.H - y);
      shots.push({ y, png:(await page.screenshot({ clip:{ x:0, y:0, width:stage.W, height:h }, omitBackground:true })).toString('base64') });
    }
    const res = await page.evaluate(cutInPage, { shots, stage, TIERS, RANKS, SUITS, GAP, debug:!!process.env.SKIN_DEBUG, nudge:+(process.env.SKIN_NUDGE || 0) });
    fs.mkdirSync(OUT, { recursive:true });
    for (const [k, b64] of Object.entries(res.png)) fs.writeFileSync(path.join(OUT, k), Buffer.from(b64, 'base64'));
    fs.writeFileSync(path.join(OUT, 'cards.json'), JSON.stringify(res.manifest, null, 1) + '\n');
    console.log(JSON.stringify(res.report, null, 1));
    const bad = Object.entries(res.report).filter(([, r]) => r.misplacedPx > 0);
    if (page._errors.length) console.log('page errors (the game underneath):', page._errors.length);
    if (bad.length){ console.error('ROUND TRIP FAILED: ' + bad.map(([t]) => t).join(', ')); process.exitCode = 1; }
    else console.log('Round trip OK: every card rebuilds from its parts. Wrote ' + Object.keys(res.png).length + ' files + cards.json to ' + path.relative(ROOT, OUT));
  });
}
main().catch(e => { console.error(e); process.exit(1); });
