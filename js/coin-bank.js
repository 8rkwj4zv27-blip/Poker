"use strict";

/* ============================================================
   COIN BANK — the inside of your bank (the coin economy pass, v0.43.0;
   built in coin-bank-lab.html, Lab 2). The inside of your bank (#hud-left, the same
   90 x 155 housing) holding your stack in the felt's pieces: small coins
   (the small blind), big coins (5 small) and gold bars (5 big). Driven by
   js/coin-table.js when CoinWorld.OPT.bank is a style (Settings → Bank;
   CLASSIC keeps the old rack).

   Three styles, one machine underneath:
   - TUBES: a coin changer. Three glass tubes; coins stack edge-on like a
     coin roll and pay out from the bottom (the column drops), wins drop
     in at the top. The fill levels are the stack.
   - SHELVES: a lit velvet display case. Small coins on the top shelf,
     big coins on the middle, bars on the floor, in towers.
   - HOPPER: a glass-fronted tank of mixed gold, bars at the bottom, that
     fills up with the stack.

   The stack is always shown as pieces worth what it's worth at the small
   blind (as many as the style's room allows, the felt's change-up rule
   per column). When the pieces must change, it plays out: MAKING CHANGE
   (a bet needs small coins the bank hasn't got: a big coin pops into five
   small) and CHANGING UP (too many small coins: five pop into a big one).
   Presentation only: reads the stack, never changes it.
   ============================================================ */
(function(){
  const CW = window.CoinWorld;
  const KINDS = ['gold','gold-big','gold-bar'];
  const V = { gold:1, 'gold-big':5, 'gold-bar':25 };
  // the pieces in the bank, a touch smaller than on the felt (a 76px bay)
  const SIZE = { gold:14, 'gold-big':19, 'gold-bar':24 };
  const hold = ms => new Promise(r => setTimeout(r, motionOff() ? 0 : ms / CW.OPT.speed));
  const sfx = (k, p, q) => { try{ CW.sfx(k, p, q); }catch(e){} };

  // sprites: coins at rest (the table's tilt), edge-on (in a tube) or just
  // tipped (the top coin of a tube); bars at rest
  // (in a tube each coin is tipped just enough to show a sliver of gold face)
  const REST = 1, EDGE = 4, LID = 3;
  const frameOf = (col, view) => {
    const d = SIZE[col], f = CW.frames(col, d);
    return f.front[col === 'gold-bar' ? REST : (view === 'edge' ? EDGE : view === 'lid' ? LID : REST)];
  };
  const hOf = col => Math.round(SIZE[col] * (col === 'gold-bar' ? .7 : CW.HR()));

  /* ---------------- the three styles ----------------
     Each lays out a count of each kind in the bay (W x H, y up from the
     floor) and says how many of each fit. slots(kind, n) returns the
     places, bottom first (the order they fill). */
  const STYLES = {
    tubes:{
      build(el){
        el.insertAdjacentHTML('beforeend', '<i class="cb-lamp"></i><i class="cb-slot"></i>' +
          KINDS.map(k => '<i class="cb-tube" data-k="' + k + '"><i class="cb-glass"></i></i>').join('') + '<i class="cb-plinth"></i>');
      },
      geom(W, H){
        const w = { gold:SIZE.gold + 4, 'gold-big':SIZE['gold-big'] + 4, 'gold-bar':SIZE['gold-bar'] + 2 }, gap = 3;
        const total = w.gold + w['gold-big'] + w['gold-bar'] + gap * 2;
        let x = Math.round((W - total) / 2); const col = {};
        KINDS.forEach(k => { col[k] = { x, w:w[k] }; x += w[k] + gap; });
        const floor = 9, top = H - 13;
        const step = { gold:3, 'gold-big':4, 'gold-bar':6 };
        const cap = {}; KINDS.forEach(k => { cap[k] = Math.max(1, Math.floor((top - floor - hOf(k)) / step[k]) + 1); });
        return { col, floor, top, step, cap };
      },
      place(g, el){
        KINDS.forEach(k => { const t = el.querySelector('.cb-tube[data-k="' + k + '"]'); if (!t) return;
          Object.assign(t.style, { left:g.col[k].x + 'px', width:g.col[k].w + 'px', bottom:(g.floor - 2) + 'px', height:(g.top - g.floor + 6) + 'px' }); });
      },
      slot(g, k, i, n){
        const d = SIZE[k], c = g.col[k];
        return { x:c.x + Math.round((c.w - d) / 2), y:g.floor + i * g.step[k], z:10 + i, view:k === 'gold-bar' ? 'rest' : (i === n - 1 ? 'lid' : 'edge') };
      },
      // pays out from the bottom of a tube; wins drop in at the top
      exit:(pieces) => pieces[0],
      entry:(g, k) => ({ x:g.col[k].x + g.col[k].w / 2, y:g.top + 10 }),
      label:(g, k) => ({ x:g.col[k].x + g.col[k].w / 2 })
    },
    shelves:{
      build(el){ el.insertAdjacentHTML('beforeend', '<i class="cb-lamp"></i><i class="cb-slot"></i><i class="cb-velvet"></i><i class="cb-shelf" data-s="1"></i><i class="cb-shelf" data-s="2"></i>'); },
      geom(W, H){
        // floor: bars; middle shelf: big coins; top shelf: small coins
        const band = { 'gold-bar':{ y:4, h:40 }, 'gold-big':{ y:48, h:38 }, gold:{ y:90, h:32 } };
        const step = { gold:CW.STEP() - 1, 'gold-big':CW.STEP(), 'gold-bar':6 };
        const cols = { gold:5, 'gold-big':3, 'gold-bar':3 }, cap = {}, per = {};
        KINDS.forEach(k => { per[k] = Math.max(1, Math.floor((band[k].h - hOf(k)) / step[k]) + 1); cap[k] = per[k] * cols[k]; });
        return { W, H, band, step, cols, cap, per };
      },
      place(g, el){
        el.querySelectorAll('.cb-shelf').forEach(s => { s.style.bottom = (s.dataset.s === '1' ? g.band['gold-big'].y - 4 : g.band.gold.y - 4) + 'px'; });
      },
      slot(g, k, i){
        // towers filled round-robin from the middle out, so a shelf reads full across
        const n = g.cols[k], t = i % n, lv = Math.floor(i / n), d = SIZE[k], sp = Math.floor(g.W / n);
        const order = [...Array(n).keys()].sort((a, c) => Math.abs(a - (n - 1) / 2) - Math.abs(c - (n - 1) / 2) || a - c);
        const at = order[t];
        return { x:Math.round(at * sp + (sp - d) / 2), y:g.band[k].y + lv * g.step[k], z:10 + lv, view:'rest' };
      },
      exit:(pieces) => pieces[pieces.length - 1],
      entry:(g, k) => ({ x:g.W / 2, y:g.H - 6 }),
      label:null
    },
    hopper:{
      build(el){ el.insertAdjacentHTML('beforeend', '<i class="cb-lamp"></i><i class="cb-slot"></i><i class="cb-tank"><i class="cb-glass"></i><i class="cb-level"></i></i><i class="cb-chute"></i>'); },
      geom(W, H){
        const floor = 10, top = H - 16;
        // layers bottom up: bars, big coins, small coins; rows staggered
        const per = { 'gold-bar':3, 'gold-big':4, gold:5 }, rise = { 'gold-bar':6, 'gold-big':5, gold:4 };
        return { W, H, floor, top, per, rise, cap:{ gold:60, 'gold-big':40, 'gold-bar':15 }, total:48 };
      },
      place(){},
      // all kinds share one heap: slots depend on what's under them
      heap:true,
      slotAll(g, counts){
        const out = {}; let y = g.floor, jitter = 0;
        ['gold-bar','gold-big','gold'].forEach(k => {
          out[k] = []; const n = counts[k] || 0, per = g.per[k], d = SIZE[k], sp = (g.W - 8) / per;
          for (let i = 0; i < n; i++){
            const row = Math.floor(i / per), inRow = i % per, off = row % 2 ? sp / 2 : 0;
            const cols = row % 2 ? per - 1 : per, x = 4 + off + (inRow % cols) * sp + (sp - d) / 2;
            jitter = (i * 7919 % 5) - 2;
            out[k].push({ x:Math.round(Math.min(g.W - d - 2, x + jitter * .5)), y:Math.round(y + row * g.rise[k] + (jitter > 1 ? 1 : 0)), z:10 + Math.round((y + row * g.rise[k])) * 2 + (i % 2), view:'rest' });
          }
          if (n) y += (Math.ceil(n / per) - 1) * g.rise[k] + g.rise[k] + 1;
        });
        out.level = y;
        return out;
      },
      exit:(pieces) => pieces[pieces.length - 1],
      entry:(g) => ({ x:g.W / 2, y:g.H - 8 }),
      label:null
    }
  };

  /* ---------------- how the stack is shown ----------------
     As many pieces as each column (or the tank) holds: small coins until
     their column is full, then five small become a big coin, then five big
     a bar. Past every column's room the columns stay full (the STACK
     readout carries the exact figure). */
  function counts(style, g, units){
    units = Math.max(0, Math.round(units));
    if (style === 'hopper'){ const c = CW.compose(units, g.total); return { gold:c.gold, 'gold-big':c.big, 'gold-bar':c.bar }; }
    let s = units, b = 0, r = 0;
    while (s > g.cap.gold && s >= 5){ s -= 5; b++; }
    while (b > g.cap['gold-big'] && b >= 5){ b -= 5; r++; }
    return { gold:s, 'gold-big':b, 'gold-bar':Math.min(r, g.cap['gold-bar']) };
  }

  class View{
    constructor(el, style){
      this.el = el; this.style = style; this.S = STYLES[style]; this.p = { gold:[], 'gold-big':[], 'gold-bar':[] };
      el.classList.add('cb-bank'); el.dataset.style = style;
      el.innerHTML = '';
      this.S.build(el);
      this.labels = null;
      this.geom();
    }
    geom(){
      const r = this.el.getBoundingClientRect();
      this.W = Math.round(r.width) || 76; this.H = Math.round(r.height) || 134;
      this.g = this.S.geom(this.W, this.H);
      this.S.place(this.g, this.el);
      return this.g;
    }
    get diam(){ return CW.D(); }
    count(){ return KINDS.reduce((a, k) => a + this.p[k].length, 0); }
    have(){ const o = {}; KINDS.forEach(k => { o[k] = this.p[k].length; }); return o; }
    value(){ return KINDS.reduce((a, k) => a + this.p[k].length * V[k], 0); }
    want(units){ return counts(this.style, this.g, units); }
    setLabels(mode, unit){
      this.el.querySelectorAll('.cb-tag').forEach(t => t.remove());
      if (!mode || mode === 'off' || !this.S.label) return;
      KINDS.forEach(k => {
        const t = document.createElement('i'); t.className = 'cb-tag'; t.dataset.k = k;
        t.style.left = Math.round(this.S.label(this.g, k).x) + 'px';
        t.textContent = mode === 'counts' ? '×' + this.p[k].length : (unit * V[k] >= 1000 ? (unit * V[k] / 1000) + 'K' : String(unit * V[k]));
        this.el.appendChild(t);
      });
      this.labelMode = mode; this.unit = unit;
    }
    paintLabels(){ if (this.labelMode === 'counts') this.el.querySelectorAll('.cb-tag').forEach(t => { t.textContent = '×' + this.p[t.dataset.k].length; }); }
    slots(){
      const out = {};
      if (this.S.heap){ const all = this.S.slotAll(this.g, this.have()); KINDS.forEach(k => { out[k] = all[k]; }); this.level = all.level; }
      else KINDS.forEach(k => { const n = this.p[k].length; out[k] = this.p[k].map((_, i) => this.S.slot(this.g, k, i, n)); });
      return out;
    }
    make(k){
      const el = document.createElement('i'); el.className = 'cb-piece';
      const d = SIZE[k]; el.style.width = d + 'px'; el.style.height = hOf(k) + 'px';
      this.el.appendChild(el);
      return { k, el, view:'' };
    }
    // put every piece where it belongs; `slide` animates the moves (FLIP)
    render(opts){
      opts = opts || {};
      const sl = this.slots();
      KINDS.forEach(k => this.p[k].forEach((q, i) => {
        const s = sl[k][i]; if (!s) return;
        const before = !opts.snap && q.placed && !motionOff() ? q.el.getBoundingClientRect() : null;
        if (q.view !== s.view){ q.view = s.view; q.el.style.backgroundImage = frameOf(k, s.view); }
        Object.assign(q.el.style, { left:s.x + 'px', bottom:s.y + 'px', zIndex:String(s.z) });
        q.placed = true; q.slot = s;
        if (before){
          const a = q.el.getBoundingClientRect(), dx = before.left - a.left, dy = before.top - a.top;
          if (Math.abs(dx) > .5 || Math.abs(dy) > .5) q.el.animate([{ transform:'translate(' + dx + 'px,' + dy + 'px)' }, { transform:'none' }], { duration:(opts.slideMs || 180) / CW.OPT.speed, easing:'cubic-bezier(.45,0,.35,1)' });
        }
      }));
      const lv = this.el.querySelector('.cb-level'); if (lv && this.level != null) lv.style.bottom = Math.round(this.level + 2) + 'px';
      this.paintLabels();
    }
    // a piece drops into place from `from` (bay coordinates, y up), with a squash
    drop(q, from, delay){
      if (motionOff() || !q.slot) return Promise.resolve();
      const s = q.slot, dx = from.x - (s.x + SIZE[q.k] / 2), dy = -(from.y - s.y);
      const a = q.el.animate([
        { transform:'translate(' + dx + 'px,' + dy + 'px)', opacity:0, offset:0 },
        { opacity:1, offset:.08 },
        { transform:'translate(0,1px) scale(1.12,.84)', offset:.78, easing:'steps(1,end)' },
        { transform:'translate(0,-2px)', offset:.88 },
        { transform:'none' }
      ], { duration:(200 + Math.min(160, Math.abs(dy) * 1.4)) / CW.OPT.speed, delay:(delay || 0) / CW.OPT.speed, easing:'cubic-bezier(.55,0,1,.6)', fill:'backwards' });
      return new Promise(r => { a.onfinish = r; a.oncancel = r; setTimeout(() => sfx('stack', .55, q.k === 'gold' ? 1.2 : q.k === 'gold-big' ? .95 : .7), ((delay || 0) + 190) / CW.OPT.speed); });
    }
    add(k, from, delay){
      const q = this.make(k); this.p[k].push(q); this.render({ snap:false });
      return this.drop(q, from || this.S.entry(this.g, k), delay);
    }
    // the piece the bank pays out of a column (TUBES: the bottom one)
    take(k){
      const list = this.p[k]; if (!list.length) return null;
      const q = this.S.exit(list), r = q.el.getBoundingClientRect();
      list.splice(list.indexOf(q), 1); q.el.remove();
      return { q, rect:r };
    }
    // the top piece of a column (for a change-up or a break)
    top(k){ const list = this.p[k]; if (!list.length) return null; const q = list.reduce((a, c) => (c.slot && a.slot && c.slot.y > a.slot.y) ? c : a, list[list.length - 1]); return q; }
    pop(x, y, d){
      if (motionOff()) return;
      const p = document.createElement('i'); p.className = 'cb-pop';
      p.style.left = Math.round(x) + 'px'; p.style.bottom = Math.round(y) + 'px'; p.style.setProperty('--d', Math.round(d * 1.7) + 'px');
      this.el.appendChild(p); setTimeout(() => p.remove(), 330 / CW.OPT.speed);
    }
    changer(){ return { x:this.W / 2, y:this.H - 22 }; }
    // five `from` pieces become one `to` (up), or one `from` becomes five `to` (down)
    async convert(from, to, show){
      const up = V[to] > V[from];
      const pt = this.changer();
      if (up){
        const five = []; for (let i = 0; i < 5; i++){ const q = this.top(from); if (!q) break; this.p[from].splice(this.p[from].indexOf(q), 1); five.push(q); }
        if (show && !motionOff()){
          await Promise.all(five.map((q, i) => {
            const r0 = q.el.getBoundingClientRect(), br = this.el.getBoundingClientRect();
            const dx = pt.x - (r0.left - br.left + r0.width / 2), dy = (br.bottom - r0.bottom) - pt.y;
            return q.el.animate([{ transform:'none' }, { transform:'translate(' + dx + 'px,' + dy + 'px)' }], { duration:170 / CW.OPT.speed, delay:i * 35 / CW.OPT.speed, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards' }).finished.catch(() => {});
          }));
          sfx('stack', 1, 1.6); sfx('knock', .5, 1.2);
          this.pop(pt.x, pt.y, SIZE[to]);
        }
        five.forEach(q => q.el.remove());
        const q = this.make(to); this.p[to].push(q); this.render({ snap:false });
        if (show) await this.drop(q, pt);
      } else {
        const q = this.top(from); if (!q) return;
        this.p[from].splice(this.p[from].indexOf(q), 1);
        if (show && !motionOff()){
          const r0 = q.el.getBoundingClientRect(), br = this.el.getBoundingClientRect();
          const dx = pt.x - (r0.left - br.left + r0.width / 2), dy = (br.bottom - r0.bottom) - pt.y;
          await q.el.animate([{ transform:'none' }, { transform:'translate(' + dx + 'px,' + dy + 'px) scale(1.15)' }], { duration:170 / CW.OPT.speed, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards' }).finished.catch(() => {});
          sfx('knock', .6, 1.4); this.pop(pt.x, pt.y, SIZE[from]);
        }
        q.el.remove();
        const five = []; for (let i = 0; i < 5; i++){ const n = this.make(to); this.p[to].push(n); five.push(n); }
        this.render({ snap:false });
        if (show) await Promise.all(five.map((n, i) => this.drop(n, pt, i * 45)));
      }
      this.render({ slideMs:160 });
    }
    /* Bring the bank to `want` (counts): first the changes that keep the
       value (a break or a change-up; the first `show` of them play out),
       then whatever's left is added (dropped in at the top) or taken away
       (lifted out). */
    async settle(want, opts){
      opts = opts || {};
      const show = opts.instant || motionOff() ? 0 : (opts.show != null ? opts.show : 3);
      let shown = 0;
      const d = () => { const o = {}; KINDS.forEach(k => { o[k] = (want[k] || 0) - this.p[k].length; }); return o; };
      const pairs = [['gold','gold-big'], ['gold-big','gold-bar']];
      for (let guard = 0; guard < 80; guard++){
        const dd = d(); let did = false;
        for (const [lo, hi] of pairs){
          if (dd[lo] >= 5 && dd[hi] < 0 && this.p[hi].length){ await this.convert(hi, lo, shown++ < show); did = true; break; }
          if (dd[lo] <= -5 && dd[hi] > 0 && this.p[lo].length >= 5){ await this.convert(lo, hi, shown++ < show); did = true; break; }
        }
        if (!did) break;
      }
      const dd = d(), drops = [];
      KINDS.forEach(k => {
        for (let i = 0; i < -dd[k]; i++){
          const q = this.top(k); if (!q) break;
          this.p[k].splice(this.p[k].indexOf(q), 1);
          if (opts.instant || motionOff()) q.el.remove();
          else q.el.animate([{ opacity:1 }, { transform:'translateY(-10px)', opacity:0 }], { duration:220 / CW.OPT.speed, delay:i * 25, fill:'forwards' }).onfinish = () => q.el.remove();
        }
      });
      let n = 0;
      KINDS.slice().reverse().forEach(k => {
        for (let i = 0; i < dd[k]; i++){
          const q = this.make(k); this.p[k].push(q);
          drops.push([q, n++]);
        }
      });
      this.render({ snap:!!opts.instant, slideMs:180 });
      if (!opts.instant) await Promise.all(drops.map(([q, i]) => this.drop(q, this.S.entry(this.g, q.k), i * (opts.stagger || 30))));
      this.paintLabels();
    }
    /* A bet: the pieces it throws leave the bank. Any the bank hasn't got
       it makes change for first (a bigger piece pops into five). Returns
       each piece's start rect for the felt throw. */
    async payOut(kinds, show){
      const need = {}; kinds.forEach(k => { need[k] = (need[k] || 0) + 1; });
      let shown = 0;
      for (const [lo, hi] of [['gold-big','gold-bar'], ['gold','gold-big']]){
        // (bars into big first, so big coins can then break into small)
        while ((need[lo] || 0) > this.p[lo].length && this.p[hi].length) await this.convert(hi, lo, shown++ < (show == null ? 2 : show));
      }
      if ((need.gold || 0) > this.p.gold.length && !this.p['gold-big'].length && this.p['gold-bar'].length){
        await this.convert('gold-bar', 'gold-big', shown++ < 2); await this.convert('gold-big', 'gold', shown++ < 2);
      }
      const out = [];
      kinds.forEach(k => {
        const t = this.take(k);
        if (t) out.push({ k, rect:t.rect });
        else { const e = this.S.entry(this.g, k), br = this.el.getBoundingClientRect(); out.push({ k, rect:{ left:br.left + e.x - SIZE[k] / 2, width:SIZE[k], bottom:br.bottom - e.y, top:br.bottom - e.y - hOf(k) } }); }
      });
      this.render({ slideMs:150 });
      return out;
    }
    // a win's piece arriving at the hatch drops into its column
    receive(k){
      const cap = this.g.cap[k] != null ? this.g.cap[k] : 99;
      if (this.p[k].length >= cap || (this.S.heap && this.count() >= this.g.total)){ sfx('stack', .6); return Promise.resolve(); }
      return this.add(k);
    }
    clear(){ KINDS.forEach(k => { this.p[k].forEach(q => q.el.remove()); this.p[k] = []; }); }
  }

  window.CoinBank = { View, STYLES, counts, SIZE, V };
})();
