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
    reserve: { 'foil-base':'#ae9773', 'foil-light':'#e3c69a', 'foil-dark':'#705363', print:'#30202e', 'print-dark':'#20151e', ink:'#f1d9a0' }
  };
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
        pixelText(x, series.toUpperCase(), 0, 108, pal.ink, pal['print-dark']);
        pixelText(x, 'EDITION', 0, 119, pal['foil-light'], pal['print-dark']);
      } else {
        pixelText(x, 'POKER', 0, 40, pal.ink, pal['print-dark']);
        pixelText(x, 'FACES', 0, 50, pal.ink, pal['print-dark']);
        pixelText(x, 'HOUSE', 0, 84, pal['foil-light'], pal['print-dark']);
        pixelText(x, 'SEALED', 0, 94, pal['foil-light'], pal['print-dark']);
        pixelText(x, '4 + 1', 0, 112, pal.ink, pal['print-dark']);
      }
      return c;
    };
    const out = { front:await raster(false), back:await raster(true), pal };
    artCache.set(series, out);
    return out;
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
      Object.assign(this, { tear:0, dir:1, open:false, face:'front', pinch:0, slump:0, light:0, chips:false, seamHint:0, frame:0, cards:[] });
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
