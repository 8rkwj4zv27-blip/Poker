/* ============================================================
   PACK OPENING V3 — the packet, drawn as pixels (lab only)

   The approved foil art (js/pack-ritual-art.js) is rasterised once
   at its native 96×156 and redrawn a pixel column at a time, so the
   packet can really deform:
   - the tear removes columns above a jagged line, one column at a time
   - the torn strip peels up on a hinge behind your finger, in stepped
     angles, then breaks free as its own object
   - columns near the tear front pinch up (tension); an empty wrapper
     crinkles
   - the foil catches the light: a stepped diagonal band that only
     lights foil pixels (print and ink stay matte)
   - turning it over is drawn, not squashed: the face narrows a column
     at a time, the near side grows taller and the pouch's crimped edge
     shows as a band of foil
   Layers inside .po-packet: back canvas (rear wall and inner lining),
   the card stack, front canvas (front face, flap, light). That
   sandwich is what keeps the cards INSIDE the packet.
   ============================================================ */
(() => {
  'use strict';
  const AW = 96, AH = 156, CW = 120, CH = 200, OX = 12, OY = 40, TY = 17;
  const PAL = {
    house:   { 'foil-base':'#bec9c3', 'foil-light':'#ecedd6', 'foil-dark':'#758a87', print:'#622c37', 'print-dark':'#3e202a', ink:'#ecddaf' },
    club:    { 'foil-base':'#92b0a1', 'foil-light':'#d4e4c8', 'foil-dark':'#5b8275', print:'#204b3a', 'print-dark':'#163627', ink:'#e6e8c3' },
    reserve: { 'foil-base':'#ae9773', 'foil-light':'#e3c69a', 'foil-dark':'#705363', print:'#30202e', 'print-dark':'#20151e', ink:'#f1d9a0' },
    // the packet machine's other editions (placeholders, lab only)
    alley:   { 'foil-base':'#a4a89a', 'foil-light':'#dcdfcf', 'foil-dark':'#6c7264', print:'#3e4a32', 'print-dark':'#29321f', ink:'#e4e6c8' },
    pub:     { 'foil-base':'#c29a5a', 'foil-light':'#efd29a', 'foil-dark':'#8a6230', print:'#6a3a14', 'print-dark':'#46250c', ink:'#f6e2b4' },
    casino:  { 'foil-base':'#9fb0c8', 'foil-light':'#dfe8f4', 'foil-dark':'#62738f', print:'#1f3a6e', 'print-dark':'#14264a', ink:'#e6eefa' },
    highroller:{ 'foil-base':'#c9a646', 'foil-light':'#f6dc8a', 'foil-dark':'#86691e', print:'#1c1a17', 'print-dark':'#0e0d0b', ink:'#f3d27a' },
    wild:    { 'foil-base':'#7fc4b8', 'foil-light':'#c8f0e4', 'foil-dark':'#4a8c84', print:'#6a1e5a', 'print-dark':'#46123c', ink:'#ffd6f2' },
    // the Career's free packets: the starter, and the one the house gives
    // you at rock bottom (faded and battered)
    starter: { 'foil-base':'#92b0a1', 'foil-light':'#d4e4c8', 'foil-dark':'#5b8275', print:'#2a5a3c', 'print-dark':'#1a3a26', ink:'#f0e6b8' },
    pity:    { 'foil-base':'#a59e8e', 'foil-light':'#cfc8b4', 'foil-dark':'#6e6758', print:'#5a4a3e', 'print-dark':'#3a3029', ink:'#d8ccaa' }
  };
  const NAME = { alley:'ALLEY', highroller:'HI-ROLLER', pity:'ON THE' };
  const SUB = { pity:'HOUSE' };
  // what the back says is inside (the lab's packets carry a bag of chips)
  const INSIDE = { pity:'3 CARDS' };
  const inside = series => INSIDE[series] || (window.CareerLink ? '4 CARDS' : '4 + 1');
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* Text in the game's pixel face, hard-thresholded so no pixel is soft. */
  function pixelText(ctx, text, cx, y, fill, shadow){
    const c = canvas(AW, 12), t = c.getContext('2d');
    t.font = '8px "Press Start 2P"'; t.textAlign = 'center'; t.textBaseline = 'top';
    t.fillStyle = '#000'; t.fillText(text, AW / 2, 2);
    const img = t.getImageData(0, 0, AW, 12), d = img.data;
    const paint = (col, dy = 0) => {
      const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
      const out = ctx.getImageData(0, y - 2 + dy, AW, 12), o = out.data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 110){ o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255; }
      ctx.putImageData(out, 0, y - 2 + dy);
    };
    if (shadow) paint(shadow, 1);
    paint(fill);
  }

  const artCache = new Map();
  async function art(series){
    if (artCache.has(series)) return artCache.get(series);
    const pal = PAL[series];
    try { await document.fonts.load('8px "Press Start 2P"'); } catch (e) {}
    const raster = async back => {
      const svg = PackRitualArt.packetArt(series, back)
        .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${AW}" height="${AH}" shape-rendering="crispEdges" `)
        .replace(/class="pko-([a-z-]+)"/g, (m, k) => `fill="${pal[k]}"`);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      const c = canvas(AW, AH), x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      if (!back){
        pixelText(x, 'POKER', 0, 27, pal.ink, pal['print-dark']);
        pixelText(x, 'FACES', 0, 37, pal.ink, pal['print-dark']);
        pixelText(x, NAME[series] || series.toUpperCase(), 0, 108, pal.ink, pal['print-dark']);
        pixelText(x, SUB[series] || 'EDITION', 0, 119, pal['foil-light'], pal['print-dark']);
        if (series === 'pity') batter(x, pal);
      } else {
        pixelText(x, 'POKER', 0, 40, pal.ink, pal['print-dark']);
        pixelText(x, 'FACES', 0, 50, pal.ink, pal['print-dark']);
        pixelText(x, 'HOUSE', 0, 84, pal['foil-light'], pal['print-dark']);
        pixelText(x, 'SEALED', 0, 94, pal['foil-light'], pal['print-dark']);
        pixelText(x, inside(series), 0, 112, pal.ink, pal['print-dark']);
      }
      return c;
    };
    const front = await raster(false), back = await raster(true);
    const out = { front, back, pal, mask:{ front:foilMask(front, pal), back:foilMask(back, pal) } };
    artCache.set(series, out);
    return out;
  }

  /* The rock-bottom packet has been about: a crease across it (worn
     through to the foil) and the print scuffed in places. Hard pixels in
     the palette's own colours, so the foil still knows what shines. */
  function batter(x, pal){
    const dot = (px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); };
    for (let px = 6; px < 90; px++){
      const py = Math.round(126 - px * .9);
      dot(px, py, pal['foil-dark']); if (px % 3) dot(px, py + 1, pal['foil-light']);
    }
    [[18, 30], [19, 30], [70, 58], [71, 59], [24, 118], [25, 118], [62, 126], [80, 44], [14, 96], [15, 97]]
      .forEach(([px, py]) => dot(px, py, pal['foil-base']));
  }

  /* Which pixels are bare foil (they shine) and which are printed (a
     little) or inked (not at all). */
  function foilMask(src, pal){
    const hex = k => [1, 3, 5].map(i => parseInt(pal[k].slice(i, i + 2), 16));
    const foil = ['foil-base', 'foil-light', 'foil-dark'].map(hex), print = ['print', 'print-dark'].map(hex);
    const same = (d, i, c) => Math.abs(d[i] - c[0]) < 6 && Math.abs(d[i + 1] - c[1]) < 6 && Math.abs(d[i + 2] - c[2]) < 6;
    const c = canvas(AW, AH), x = c.getContext('2d'), img = src.getContext('2d').getImageData(0, 0, AW, AH), d = img.data;
    const out = x.createImageData(AW, AH), o = out.data;
    for (let i = 0; i < d.length; i += 4){
      if (d[i + 3] < 128) continue;
      const a = foil.some(f => same(d, i, f)) ? 255 : print.some(f => same(d, i, f)) ? 70 : 0;
      o[i] = o[i + 1] = o[i + 2] = 255; o[i + 3] = a;
    }
    x.putImageData(out, 0, 0);
    return c;
  }

  function jagLine(){
    const j = []; let y = TY, run = 0;
    for (let x = 0; x < AW; x++){
      if (run-- <= 0){ y = Math.max(TY - 2, Math.min(TY + 2, y + [-1, 0, 1, 1, -1][Math.floor(Math.random() * 5)])); run = 1 + Math.floor(Math.random() * 3); }
      j.push(y);
    }
    return j;
  }

  class Packet {
    constructor(stage, series, price){
      this.stage = stage; this.series = series; this.price = price;
      this.el = document.createElement('div');
      this.el.className = 'po-packet';
      this.el.dataset.series = series;
      this.el.innerHTML = `<canvas class="po-pk-back" width="${CW}" height="${CH}"></canvas><div class="po-pk-stack"></div><canvas class="po-pk-front" width="${CW}" height="${CH}"></canvas><div class="po-tag"><i></i><b>$${price}</b></div>`;
      this.back = this.el.querySelector('.po-pk-back').getContext('2d');
      this.front = this.el.querySelector('.po-pk-front').getContext('2d');
      this.stackEl = this.el.querySelector('.po-pk-stack');
      this.tagEl = this.el.querySelector('.po-tag');
      this.body = new PO.Body(stage, this.el, { w:CW, h:CH, ax:OX + AW / 2, ay:OY + AH / 2, shadowW:AW, shadowH:AH, shadowY:0 });
      this.body.sh.classList.add('po-shadow-packet');
      Object.assign(this, { tear:0, dir:1, open:false, face:'front', pinch:0, slump:0, light:0, chips:false, seamHint:0, frame:0, cards:[], yaw:0, shine:-40, shineA:0 });
      this.shineC = canvas(AW, AH);
      this.jag = jagLine();
      this.ready = art(series).then(a => { this.art = a; this.draw(); });
    }
    cut(x){ return this.dir > 0 ? x < this.tear * AW : x >= AW - this.tear * AW; }
    get front_x(){ return this.dir > 0 ? Math.min(AW - 1, Math.floor(this.tear * AW)) : Math.max(0, AW - 1 - Math.floor(this.tear * AW)); }

    draw(){
      if (!this.art) return;
      const f = this.front, b = this.back, src = this.face === 'back' ? this.art.back : this.art.front, pal = this.art.pal;
      f.clearRect(0, 0, CW, CH); b.clearRect(0, 0, CW, CH);
      f.imageSmoothingEnabled = b.imageSmoothingEnabled = false;
      const lit = this.prepShine();
      const yr = this.yaw * Math.PI / 180;
      this.stackEl.style.visibility = Math.abs(Math.sin(yr)) > .02 ? 'hidden' : '';
      // the tag hangs off the front: edge-on and round the back it's out of sight
      this.tagEl.style.visibility = Math.abs(Math.sin(yr)) > .45 || this.face === 'back' ? 'hidden' : '';
      if (Math.abs(Math.sin(yr)) > .02) return this.drawTurned(f, src, pal, yr, lit);
      const torn = this.tear > 0, fx = this.front_x;
      // the rear wall and its inner lining, only where the top is gone
      if (torn){
        for (let x = 0; x < AW; x++){
          if (!this.cut(x) && !this.open) continue;
          const rj = this.jag[x] - 4 - (this.open ? 1 : 0);
          b.fillStyle = (x % 6 < 2) ? pal['foil-light'] : pal['foil-base'];
          b.fillRect(OX + x, OY + rj, 1, AH - rj);
          b.fillStyle = 'rgba(10,18,14,.55)'; // the dark of the inside, under the lip
          b.fillRect(OX + x, OY + rj + 3, 1, AH - rj - 3);
          if (this.light){
            b.fillStyle = `rgba(255,214,120,${(.35 + .3 * this.light).toFixed(2)})`;
            b.fillRect(OX + x, OY + rj, 1, 6);
          }
        }
      }
      // the front face, a column at a time
      for (let x = 0; x < AW; x++){
        const c = this.cut(x) || this.open, y0 = c ? this.jag[x] : 0;
        let dy = 0;
        if (this.pinch && !c && Math.abs(x - fx) < 6) dy = -Math.round((6 - Math.abs(x - fx)) / 3 * this.pinch);
        if (this.slump) dy += Math.round(Math.sin(x * .55 + 1.7) * 1.4 * this.slump + Math.sin(x * .17) * 1.2 * this.slump);
        f.drawImage(src, x, y0, 1, AH - y0, OX + x, OY + y0 + dy, 1, AH - y0);
        if (lit) f.drawImage(this.shineC, x, y0, 1, AH - y0, OX + x, OY + y0 + dy, 1, AH - y0);
      }
      // the seam: a stepped dotted line marching toward the corner you tear from
      if (!torn && this.seamHint && this.face === 'front'){
        f.fillStyle = pal.ink;
        for (let x = 2; x < AW - 2; x++) if ((x + this.frame) % 6 < 3) f.fillRect(OX + x, OY + TY, 1, 1);
      }
      // the torn strip, peeling up on its hinge behind the finger
      if (torn && !this.open && this.tear < 1){
        const strip = this.stripImage(), a = Math.min(1, this.tear * 2.4);
        const ang = PO.snap(this.dir * a * 32, 4) * Math.PI / 180;
        const hy = this.jag[fx];
        f.save();
        f.translate(OX + fx + (this.dir > 0 ? 0 : 1), OY + hy - Math.round(a * 3));
        f.rotate(ang);
        const x0 = this.dir > 0 ? 0 : fx + 1, x1 = this.dir > 0 ? fx : AW;
        f.drawImage(strip, x0, 0, x1 - x0, 24, x0 - fx, -hy, x1 - x0, 24);
        f.restore();
      }
      // light leaking from the mouth: the one Legendary tell
      if (this.light && torn){
        f.globalCompositeOperation = 'lighter';
        const beams = [[14, 6], [33, 4], [52, 8], [71, 4], [83, 5]];
        beams.forEach(([bx, bw], i) => {
          if (!this.open && !this.cut(bx)) return;
          const h = 10 + ((this.frame + i * 3) % 5) * 4 + this.light * 14;
          for (let k = 0; k < h; k += 2){
            f.fillStyle = `rgba(255,212,120,${((1 - k / h) * .5 * this.light).toFixed(3)})`;
            f.fillRect(OX + bx, OY + this.jag[bx] - 2 - k, bw, 2);
          }
        });
        f.globalCompositeOperation = 'source-over';
      }
      // chips that rolled to the mouth of the empty wrapper
      if (this.chips){
        [[30, '#c8322b', '#f08070'], [41, '#1f5fa8', '#7fb2e8'], [58, '#c8322b', '#f08070']].forEach(([cx, c1, c2], i) => {
          const y = OY + this.jag[cx] - 2 + (i === 1 ? 1 : 0);
          f.fillStyle = '#100a0a'; f.fillRect(OX + cx - 1, y - 1, 11, 5);
          f.fillStyle = c1; f.fillRect(OX + cx, y, 9, 3);
          f.fillStyle = c2; f.fillRect(OX + cx + 1, y, 7, 1);
          f.fillStyle = '#efe6c8'; f.fillRect(OX + cx + 3, y + 1, 2, 1);
          if ((this.frame + i * 7) % 28 < 2){ f.fillStyle = '#fff'; f.fillRect(OX + cx + 6, y - 2, 1, 1); f.fillRect(OX + cx + 5, y - 1, 3, 1); }
        });
      }
    }

    /* The light band, cut to the foil of the face that's showing. */
    prepShine(){
      if (this.shineA <= .02 || this.open) return false;
      const x = this.shineC.getContext('2d'), a = PO.snap(this.shineA, .25);
      if (!a) return false;
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, AW, AH);
      const pos = Math.round(this.shine);
      for (let y = 0; y < AH; y++){
        const sx = pos - Math.floor(y * .5);
        x.fillStyle = `rgba(255,250,226,${(.55 * a).toFixed(2)})`; x.fillRect(sx, y, 9, 1);
        x.fillStyle = `rgba(255,255,255,${(.8 * a).toFixed(2)})`; x.fillRect(sx + 3, y, 3, 1);
        x.fillStyle = `rgba(255,250,226,${(.4 * a).toFixed(2)})`; x.fillRect(sx + 13, y, 2, 1);
      }
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(this.art.mask[this.face], 0, 0);
      return true;
    }

    /* Mid-turn: the face narrows column by column, the near side stands
       taller (a pixel trapezoid), and the pouch's crimped edge shows. */
    drawTurned(f, src, pal, yr, lit){
      const c = Math.cos(yr), sn = Math.sin(yr);
      const w = Math.max(2, Math.round(AW * Math.abs(c) / 2) * 2);
      const e = Math.max(2, Math.round(5 * Math.abs(sn)));
      const nearLeft = c * sn > 0, x0 = OX + Math.round((AW - w - e) / 2), fx = nearLeft ? x0 + e : x0;
      const lean = Math.round(4 * Math.abs(sn));
      for (let i = 0; i < w; i++){
        const k = (i + .5) / w, near = nearLeft ? 1 - k : k, g = Math.round(near * lean), sx = Math.min(AW - 1, Math.floor(k * AW));
        f.drawImage(src, sx, 0, 1, AH, fx + i, OY - g, 1, AH + g * 2);
        if (lit) f.drawImage(this.shineC, sx, 0, 1, AH, fx + i, OY - g, 1, AH + g * 2);
      }
      // the crimped edge: dark foil, a bright crease, the crimp teeth top and bottom
      const ex = nearLeft ? x0 : fx + w;
      for (let j = 0; j < e; j++){
        const x = ex + j, out = nearLeft ? j === 0 : j === e - 1;
        f.fillStyle = out ? pal['foil-light'] : (j % 2 ? pal['foil-base'] : pal['foil-dark']);
        f.fillRect(x, OY - lean, 1, AH + lean * 2);
        f.fillStyle = pal['print-dark'];
        for (let y = 0; y < 12; y += 2){ f.fillRect(x, OY - lean + y, 1, 1); f.fillRect(x, OY + AH + lean - 1 - y, 1, 1); }
      }
      // a glint runs down the edge while it faces you
      if (Math.abs(sn) > .7){ f.fillStyle = '#fffbe8'; f.fillRect(nearLeft ? x0 : fx + w + e - 1, OY + 20 + ((this.frame * 9) % (AH - 40)), 1, 6); }
    }

    /* The top of the art above the jag, for the flap. */
    stripImage(){
      if (this._strip && this._stripFace === this.face) return this._strip;
      const c = canvas(AW, 24), x = c.getContext('2d'), src = this.face === 'back' ? this.art.back : this.art.front;
      for (let i = 0; i < AW; i++) x.drawImage(src, i, 0, 1, this.jag[i], i, 0, 1, this.jag[i]);
      // the cut edge shows the foil's white core
      x.fillStyle = this.art.pal['foil-light'];
      for (let i = 0; i < AW; i++) x.fillRect(i, this.jag[i] - 1, 1, 1);
      this._strip = c; this._stripFace = this.face;
      return c;
    }

    /* Break the strip free as its own object on the felt. */
    detachFlap(){
      const c = this.stripImage(), el = document.createElement('canvas');
      el.width = AW; el.height = 24; el.className = 'po-flap';
      el.getContext('2d').drawImage(c, 0, 0);
      const b = this.body, body = new PO.Body(this.stage, el, { w:AW, h:24, shadowW:AW, shadowH:6, shadowY:10 });
      // place it where the strip was: the top band of the packet, in stage space
      const rad = b.r * Math.PI / 180, s = b.s, oy = (TY / 2 - AH / 2) * s;
      body.set({ x:b.x - Math.sin(rad) * oy, y:b.y + Math.cos(rad) * oy - b.z, z:0, r:b.r + this.dir * 30, s });
      return body;
    }
  }

  window.POPacket = { Packet, art, AW, AH, CW, CH, OX, OY, TY };
})();
