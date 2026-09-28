"use strict";

/* ============================================================
   FELT LAB — the controls, inside the game (phone-first)

   Runs in the game copy the host page (felt-lab.html,
   js/felt-lab-host.js) builds. Everything here is presentation only: it
   repaints the table (.felt) and never touches a rule of the game.

   What it can change:
   - RAIL:  the rim round the table (material, width) and the stitching
            sewn into the felt (style, thread, where it runs)
   - FELT:  the cloth pattern, its colour, the light over it, the theme
   - MARKS: markings printed on the felt (card slots, lettering), the bet
            spots, and where the felt meets the console
   - LOOKS: whole combinations, flipped with the arrow keys
   - SCENE: the table at a moment of a hand (deal, flop, river,
            showdown, heads-up, full table, empty), played by the real
            engine with DEV auto-calls, then left standing

   The rail, the stitching and the printed markings are drawn in one SVG
   laid under everything else on the felt (.fl-art), so they follow the
   table's real rounded shape. Cloth and light are background layers on
   .felt (css/felt-lab.css). The shipped table is untouched when every pick
   is AS NOW; the BEFORE key (hold) shows it at any time.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { picks:null, look:null, scene:'flop' };
  const root = document.documentElement;
  const $id = id => document.getElementById(id);

  /* ---- the options (first of each row is the table as it ships, v0.47.0 on) ---- */
  const TABS = {
    rail:[
      ['rail','RAIL', [['asis','AS NOW'],['oak','CHUNKY OAK'],['studs','BRASS STUDS'],['leather','PADDED LEATHER'],['velvet','VELVET + GOLD PIPING'],['inlay','MAHOGANY INLAY'],['noir','BLACK + GOLD'],['chrome','ARCADE CHROME'],['bulbs','MARQUEE BULBS']],
        'Every rail but AS NOW shows the whole rim, top included, so the table sits a few pixels further in.'],
      ['rw','RAIL WIDTH', [['auto','AS DESIGNED'],['14','SLIM'],['20','MEDIUM'],['26','CHUNKY']]],
      ['stitch','STITCHING', [['asis','AS NOW (LONG, DARK, BY THE RAIL)'],['olddash','BEFORE V0.47'],['none','NONE'],['running','RUNNING'],['long','LONG STITCH'],['pick','PICK DOTS'],['double','DOUBLE'],['braid','BRAID'],['cross','CROSS-STITCH'],['welt','PRESSED SEAM']]],
      ['scol','THREAD', [['gold','GOLD'],['cream','CREAM'],['accent','THEME ACCENT'],['tone','TONE ON TONE'],['dark','DARK']], 'Thread colour is shared by the stitching, a stitched board box and stitched bet spots.'],
      ['splace','WHERE IT RUNS', [['line','BETTING LINE'],['edge','BY THE RAIL'],['both','BOTH']]]
    ],
    felt:[
      ['cloth','CLOTH', [['asis','AS NOW (FINE CHECK)'],['oldcheck','BEFORE V0.47'],['coarse','BIG CHECK'],['tweed','TWEED'],['nap','VELVET NAP'],['diamond','DIAMOND WEAVE'],['flat','FLAT']]],
      ['fcol','FELT COLOUR', [['theme','AS THEME'],['casino','CASINO GREEN'],['deep','DEEP GREEN'],['blue','BLUE BAIZE'],['red','RED VELVET'],['teal','PETROL TEAL'],['plum','PLUM'],['noir','CHARCOAL']]],
      ['light','LIGHT', [['asis','AS NOW (SOFT LAMP)'],['oldoval','BEFORE V0.47'],['none','NONE'],['lamp','LAMP POOL'],['vignette','DARK CORNERS'],['both','LAMP + CORNERS'],['overhead','BILLIARD LAMP'],['smoke','SMOKY ROOM']],
        'Lamps centre on the board. LAMP POOL is stepped in pixel bands; AS NOW is a smooth fade.'],
      ['theme','THEME', [['emerald','EMERALD'],['burgundy','BURGUNDY'],['midnight','MIDNIGHT'],['slate','SLATE']], 'The player\'s own palette setting. Rails and stitching that use the theme follow it.']
    ],
    marks:[
      ['board','BOARD MARKING', [['none','NONE'],['slots','CARD SLOTS'],['box','STITCHED BOX'],['frame','PRINTED FRAME'],['slotsbox','SLOTS + BOX']], 'Where the five community cards land. Best seen on the EMPTY or DEAL scene.'],
      ['print','PRINTED ON THE FELT', [['none','NONE'],['word','WORDMARK'],['arc','ARC LETTERING'],['suits','SUIT PIPS'],['all','WORDMARK + ARC']]],
      ['spots','BET SPOTS', [['asis','AS NOW'],['stitched','STITCHED'],['rings','RINGS'],['gold','GOLD BOX'],['pressed','PRESSED'],['none','HIDDEN']]],
      ['seam','FELT MEETS CONSOLE', [['asis','AS NOW'],['shadow','SHADOW'],['brass','BRASS BAR'],['lip','DEEP LIP']]]
    ]
  };
  const ROWS = [].concat(TABS.rail, TABS.felt, TABS.marks);
  const ASIS = { rail:'asis', rw:'auto', stitch:'asis', scol:'gold', splace:'line', cloth:'asis', fcol:'theme', light:'asis', theme:'emerald',
    board:'none', print:'none', spots:'asis', seam:'asis' };
  const L = (name, blurb, p) => ({ name, blurb, picks:Object.assign({}, ASIS, p) });
  const LOOKS = [
    L('AS NOW', 'The table as it ships (v0.47.0): long dark stitch by the rail, fine check, soft lamp.', {}),
    L('BEFORE V0.47', 'The table before the felt pass: faint dashed line, big check, hard-edged oval.', { stitch:'olddash', cloth:'oldcheck', light:'oldoval' }),
    L('CASINO CLASSIC', 'Oak rail, gold betting line, lamp over the board, printed slots and arc.',
      { rail:'oak', stitch:'running', scol:'gold', splace:'line', cloth:'asis', fcol:'casino', light:'lamp', board:'slots', print:'arc', spots:'rings', seam:'shadow' }),
    L('VELVET MACHINE', 'Padded burgundy leather, double gold stitch, tweed felt, brass bar to the console.',
      { rail:'leather', stitch:'double', scol:'gold', splace:'edge', cloth:'tweed', light:'both', board:'box', print:'word', spots:'stitched', seam:'brass' }),
    L('BRASS PARLOUR', 'Walnut with brass studs, cream stitch by the rail, a soft lamp.',
      { rail:'studs', stitch:'long', scol:'cream', splace:'edge', cloth:'asis', fcol:'deep', light:'asis', board:'frame', print:'suits', spots:'gold', seam:'shadow' }),
    L('MARQUEE', 'A rail of chasing bulbs, braided thread, dark corners.',
      { rail:'bulbs', stitch:'braid', scol:'gold', splace:'line', cloth:'coarse', light:'vignette', board:'slotsbox', print:'all', spots:'rings', seam:'brass' }),
    L('BACKROOM', 'Slim mahogany, a pressed seam, one billiard lamp, flat dark cloth.',
      { rail:'inlay', rw:'14', stitch:'welt', scol:'tone', splace:'line', cloth:'flat', fcol:'deep', light:'overhead', board:'slots', spots:'pressed', seam:'lip' }),
    L('ARCADE', 'Riveted chrome, pick-dot stitching in the theme colour, printed frame.',
      { rail:'chrome', stitch:'pick', scol:'accent', splace:'both', cloth:'asis', light:'lamp', board:'frame', print:'word', spots:'gold', seam:'lip' }),
    L('HIGH ROLLER', 'Black leather with gold piping, velvet nap, a smoky room.',
      { rail:'noir', stitch:'double', scol:'gold', splace:'line', cloth:'nap', fcol:'deep', light:'smoke', board:'box', print:'arc', spots:'stitched', seam:'brass' }),
    L('RED ROOM', 'Velvet and gold on red felt, cross-stitch, burgundy theme.',
      { rail:'velvet', stitch:'cross', scol:'gold', splace:'line', cloth:'nap', fcol:'red', light:'both', theme:'burgundy', board:'slots', print:'word', spots:'stitched', seam:'brass' }),
    L('BLUE BAIZE', 'Chunky oak on blue cloth, cream thread, diamond weave.',
      { rail:'oak', rw:'26', stitch:'running', scol:'cream', splace:'both', cloth:'diamond', fcol:'blue', light:'asis', board:'box', print:'suits', spots:'rings', seam:'shadow' })
  ];
  const SCENES = [
    ['deal','THE DEAL · 4 RIVALS'], ['flop','THE FLOP · 3 IN'], ['river','THE RIVER · 3 IN'], ['showdown','SHOWDOWN · 2 IN'],
    ['headsup','HEADS-UP · THE TURN'], ['full','FULL TABLE · 6 RIVALS'], ['empty','EMPTY TABLE', true]
  ];

  let picks = Object.assign({}, ASIS, state.picks || {});
  let look = state.look == null ? 0 : state.look;
  let shown = picks;   // what the table is showing: the picks, or AS NOW while BEFORE is held
  function save(){ if (host) host.set({ picks:Object.assign({}, picks), look }); }

  /* ---- geometry: felt size, corner radius, the board ---- */
  const RAIL_W = { asis:12, oak:20, studs:22, leather:24, velvet:20, inlay:18, noir:22, chrome:18, bulbs:22 };
  const railW = () => shown.rail === 'asis' ? 12 : (shown.rw === 'auto' ? RAIL_W[shown.rail] : Number(shown.rw));
  const THREAD = { gold:'rgba(232,184,58,.78)', cream:'rgba(244,239,225,.62)', accent:'var(--accent)', tone:'rgba(255,255,255,.17)', dark:'rgba(0,0,0,.42)' };

  const f2 = n => Math.round(n * 2) / 2;
  function rr(x, y, w, h, r){
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    x = f2(x); y = f2(y); w = f2(w); h = f2(h); r = f2(r);
    return 'M' + (x + r) + ',' + y + 'H' + (x + w - r) + 'A' + r + ',' + r + ' 0 0 1 ' + (x + w) + ',' + (y + r) +
      'V' + (y + h - r) + 'A' + r + ',' + r + ' 0 0 1 ' + (x + w - r) + ',' + (y + h) +
      'H' + (x + r) + 'A' + r + ',' + r + ' 0 0 1 ' + x + ',' + (y + h - r) + 'V' + (y + r) + 'A' + r + ',' + r + ' 0 0 1 ' + (x + r) + ',' + y + 'Z';
  }
  // a stroke running parallel to the felt's outer edge: off > 0 is out on the rail, off < 0 is in on the cloth
  let G = null;
  function ring(off, width, paint, o){
    o = o || {};
    const d = rr(-off, -off, G.W + off * 2, G.H + off * 2, Math.max(4, G.R + off));
    return '<path d="' + d + '" fill="none" style="stroke:' + paint + '" stroke-width="' + width + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + (o.offset ? ' stroke-dashoffset="' + o.offset + '"' : '') +
      (o.cap ? ' stroke-linecap="' + o.cap + '"' : '') + (o.op != null ? ' opacity="' + o.op + '"' : '') + (o.cls ? ' class="' + o.cls + '"' : '') + '/>';
  }
  const vGrad = (id, stops, rw) => '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + (-rw) + '" x2="0" y2="' + (G.H + rw) + '">' +
    stops.map(s => '<stop offset="' + s[0] + '" style="stop-color:' + s[1] + (s[2] != null ? ';stop-opacity:' + s[2] : '') + '"/>').join('') + '</linearGradient>';
  const bands = (hi, mid, lo) => [[0, hi], [.09, hi], [.09, mid], [.8, mid], [.8, lo], [1, lo]];
  const shade = rw => vGrad('flg-shade', [[0, '#fff', .2], [.08, '#fff', .2], [.08, '#fff', 0], [.8, '#000', 0], [.8, '#000', .3], [1, '#000', .3]], rw);
  const INK = '#0D0F0C';

  /* ---- the rails ---- */
  const RAILS = {
    oak(rw){
      return [vGrad('flg-wood', bands('var(--rail-hi)', 'var(--rail)', 'var(--rail-lo)'), rw),
        ring(rw / 2, rw, 'url(#flg-wood)'),
        ring(rw * .3, 1.5, 'var(--rail-lo)', { dash:'22 6 9 11 30 5', op:.6 }),
        ring(rw * .6, 1.5, 'var(--rail-lo)', { dash:'14 9 26 4 11 7', offset:13, op:.5 }),
        ring(rw * .8, 1, 'var(--rail-hi)', { dash:'9 17 19 8', op:.45 }),
        ring(rw - 2.5, 2, 'var(--rail-hi)', { op:.8 }),
        ring(2, 4, '#000', { op:.35 }),
        ring(rw, 2, INK)];
    },
    studs(rw){
      const dash = '0 26';
      return [vGrad('flg-wood', bands('#6B4226', '#4A2C17', '#2A170B'), rw),
        ring(rw / 2, rw, 'url(#flg-wood)'),
        ring(rw * .25, 1.5, '#2A170B', { dash:'18 7 30 5', op:.6 }),
        ring(rw * .75, 1.5, '#2A170B', { dash:'11 13 24 6', op:.6 }),
        ring(rw - 2.5, 2, '#7E5230', { op:.9 }),
        ring(2, 4, '#000', { op:.35 }),
        ring(rw / 2, 8, INK, { dash, cap:'round' }),
        ring(rw / 2, 6, '#8D6818', { dash, cap:'round' }),
        ring(rw / 2, 4, '#E8B83A', { dash, cap:'round' }),
        ring(rw / 2, 1.5, '#FFF0BD', { dash, cap:'round' }),
        ring(rw, 2, INK)];
    },
    leather(rw){
      return [shade(rw),
        ring(rw / 2, rw, '#541B25'),
        ring(rw * .52, rw * .42, '#6A2530'),
        ring(rw * .56, rw * .16, '#7A2D38'),
        ring(rw * .6, 1.5, '#A0475A', { op:.6 }),
        ring(rw / 2, rw, 'url(#flg-shade)'),
        ring(2, 3, '#2A0D14'), ring(rw - 2, 3, '#2A0D14'),
        ring(rw / 2, 5, '#2A0D14', { dash:'0 30', cap:'round' }),
        ring(rw / 2, 2, '#A0475A', { dash:'0 30', cap:'round', op:.7 }),
        ring(rw, 2, INK)];
    },
    velvet(rw){
      return [shade(rw),
        ring(rw / 2, rw, '#3A0F18'),
        ring(rw / 2, rw - 6, '#4C1520', { dash:'1 2' }),
        ring(rw * .55, rw * .25, '#5A1B27', { op:.7 }),
        ring(rw / 2, rw, 'url(#flg-shade)'),
        ring(2, 4, '#8D6818'), ring(2, 2, '#E8B83A'), ring(1.5, .8, '#FFE17B'),
        ring(rw - 2, 3, '#8D6818'), ring(rw - 2.2, 1, '#E8B83A'),
        ring(rw, 2, INK)];
    },
    inlay(rw){
      return [vGrad('flg-wood', bands('#A04A2C', '#7A2E1C', '#4A1A0E'), rw),
        ring(rw / 2, rw, 'url(#flg-wood)'),
        ring(rw * .25, 1, '#4A1A0E', { dash:'16 8 28 6', op:.7 }),
        ring(rw * .78, 1, '#4A1A0E', { dash:'20 5 12 9', op:.7 }),
        ring(rw / 2, 4, '#1A0A05'), ring(rw / 2, 1.5, '#E8B83A'),
        ring(rw - 2, 2, '#B55A38', { op:.8 }),
        ring(2, 4, '#000', { op:.35 }),
        ring(rw, 2, INK)];
    },
    noir(rw){
      return [shade(rw),
        ring(rw / 2, rw, '#161213'),
        ring(rw * .52, rw * .4, '#221B1C'),
        ring(rw * .56, rw * .14, '#2F2627'),
        ring(rw / 2, rw, 'url(#flg-shade)'),
        ring(rw * .24, 1.2, '#F4EFE1', { dash:'4 3', op:.45 }),
        ring(rw * .8, 1.2, '#F4EFE1', { dash:'4 3', op:.45 }),
        ring(2, 4, '#8D6818'), ring(2, 2, '#E8B83A'),
        ring(rw, 2, INK)];
    },
    chrome(rw){
      return [shade(rw),
        ring(rw / 2, rw, '#5B656C'),
        ring(rw * .78, rw * .34, '#C9D2D7'),
        ring(rw * .48, rw * .28, '#98A4AB'),
        ring(rw * .86, 1.5, '#FFFFFF', { op:.85 }),
        ring(rw * .16, rw * .2, '#3C4449'),
        ring(rw / 2, rw, 'url(#flg-shade)'),
        ring(rw / 2, 6, '#2E3438', { dash:'0 44', cap:'round' }),
        ring(rw / 2, 3, '#DDE4E8', { dash:'0 44', cap:'round' }),
        ring(1.5, 3, INK, { op:.7 }),
        ring(rw, 2, INK)];
    },
    bulbs(rw){
      const d = '0 18', lit = '0 36';
      return [ring(rw / 2, rw, '#2A1216'),
        ring(2, 3, '#8D6818'), ring(2, 1, '#E8B83A'),
        ring(rw - 2, 3, '#8D6818'), ring(rw - 2, 1, '#E8B83A'),
        ring(rw / 2, 10, '#140709', { dash:d, cap:'round' }),
        ring(rw / 2, 6, '#6B4A14', { dash:d, cap:'round' }),
        '<g class="fl-chase">' +
          ring(rw / 2, 14, '#FFD36B', { dash:lit, cap:'round', op:.22 }) +
          ring(rw / 2, 6, '#FFE9A8', { dash:lit, cap:'round' }) +
          ring(rw / 2, 2.5, '#FFFFFF', { dash:lit, cap:'round' }) + '</g>',
        ring(rw, 2, INK)];
    }
  };

  /* ---- the stitching ---- */
  function stitches(){
    if (shown.stitch === 'asis' || shown.stitch === 'none') return '';
    const t = THREAD[shown.scol] || THREAD.gold;
    const at = shown.stitch === 'olddash' ? [12] : shown.splace === 'both' ? [8, 26] : shown.splace === 'edge' ? [8] : [24];
    const one = d => {
      switch (shown.stitch){
        case 'running': return ring(-d, 2, t, { dash:'6 4' });
        case 'long':    return ring(-d, 2, t, { dash:'11 5' });
        case 'pick':    return ring(-d, 2, t, { dash:'2 5' });
        case 'double':  return ring(-d, 2, t, { dash:'6 4' }) + ring(-d - 5, 2, t, { dash:'6 4' });
        case 'braid':   return ring(-d, 2, t, { dash:'5 5' }) + ring(-d - 3, 2, t, { dash:'5 5', offset:5 });
        case 'cross':   return ring(-d, 2, t, { dash:'3 3' }) + ring(-d - 2, 2, t, { dash:'3 3', offset:3 }) + ring(-d - 4, 2, t, { dash:'3 3' });
        case 'olddash': return ring(-d, 2, 'rgba(255,255,255,.10)', { dash:'4 4' });
        case 'welt':    return ring(-d, 3, 'rgba(0,0,0,.34)') + ring(-d - 2.5, 1.5, t, { op:.8 });
      }
      return '';
    };
    return at.map(one).join('');
  }

  /* ---- markings printed on the felt ---- */
  const INKG = 'rgba(232,184,58,', SLOT = 'rgba(0,0,0,.16)';
  function marks(){
    const b = G.board, out = [];
    const total = b.cw * 5 + b.gap * 4, x0 = b.cx - total / 2, y0 = b.cy - b.ch / 2;
    const t = THREAD[shown.scol] || THREAD.gold;
    if (shown.board === 'slots' || shown.board === 'slotsbox'){
      for (let i = 0; i < 5; i++){
        const x = x0 + i * (b.cw + b.gap);
        out.push('<path d="' + rr(x, y0, b.cw, b.ch, 3) + '" fill="' + SLOT + '" style="stroke:rgba(255,255,255,.09)" stroke-width="1.5"/>');
      }
    }
    if (shown.board === 'box' || shown.board === 'slotsbox'){
      out.push('<path d="' + rr(x0 - 7, y0 - 7, total + 14, b.ch + 14, 9) + '" fill="none" style="stroke:' + t + '" stroke-width="2" stroke-dasharray="6 4"/>');
    }
    if (shown.board === 'frame'){
      out.push('<path d="' + rr(x0 - 8, y0 - 8, total + 16, b.ch + 16, 4) + '" fill="rgba(0,0,0,.08)" style="stroke:' + INKG + '.34)" stroke-width="1.5"/>');
      out.push('<path d="' + rr(x0 - 12, y0 - 12, total + 24, b.ch + 24, 6) + '" fill="none" style="stroke:' + INKG + '.2)" stroke-width="1"/>');
      [[x0 - 12, y0 - 12], [x0 + total + 12, y0 - 12], [x0 - 12, y0 + b.ch + 12], [x0 + total + 12, y0 + b.ch + 12]].forEach(p => {
        out.push('<rect x="' + (p[0] - 3) + '" y="' + (p[1] - 3) + '" width="6" height="6" transform="rotate(45 ' + p[0] + ' ' + p[1] + ')" fill="' + INKG + '.45)"/>');
      });
    }
    const pr = shown.print;
    if (pr === 'word' || pr === 'all'){
      const y = Math.round(b.gapMid + 3);
      out.push('<text x="' + b.cx + '" y="' + y + '" text-anchor="middle" font-family="\'Press Start 2P\',monospace" font-size="13" letter-spacing="3" fill="' + INKG + '.2)">THE TABLE</text>');
      out.push('<rect x="' + (b.cx - 92) + '" y="' + (y - 6) + '" width="16" height="2" fill="' + INKG + '.2)"/>', '<rect x="' + (b.cx + 76) + '" y="' + (y - 6) + '" width="16" height="2" fill="' + INKG + '.2)"/>');
    }
    if (pr === 'arc' || pr === 'all'){
      // a smile under the pot: its lowest point just above your bet spot
      const r = 230, cy = Math.min(b.lowBottom - 10, b.lowTop + 38) - r;
      const a = 0.6, sx = b.cx - r * Math.sin(a), ex = b.cx + r * Math.sin(a), ay = cy + r * Math.cos(a);
      out.push('<path id="fl-arc" d="M' + sx + ',' + ay + ' A' + r + ',' + r + ' 0 0 0 ' + ex + ',' + ay + '" fill="none"/>');
      out.push('<text font-family="\'Press Start 2P\',monospace" font-size="8" letter-spacing="2" fill="' + INKG + '.3)"><textPath href="#fl-arc" startOffset="50%" text-anchor="middle">NO LIMIT · TEXAS HOLD\'EM</textPath></text>');
      const r2 = r - 15, sx2 = b.cx - r2 * Math.sin(a * .98), ex2 = b.cx + r2 * Math.sin(a * .98), ay2 = cy + r2 * Math.cos(a * .98);
      out.push('<path d="M' + sx2 + ',' + ay2 + ' A' + r2 + ',' + r2 + ' 0 0 0 ' + ex2 + ',' + ay2 + '" fill="none" style="stroke:' + INKG + '.2)" stroke-width="1.5" stroke-dasharray="3 3"/>');
    }
    if (pr === 'suits'){
      const pip = (ch, x, y, red) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="17" font-family="system-ui,sans-serif" fill="' + (red ? 'rgba(200,50,43,.26)' : 'rgba(0,0,0,.26)') + '">' + ch + '</text>';
      const lx = x0 - 30, rx = x0 + total + 30;
      out.push(pip('♠', lx, b.cy - 6, false), pip('♥', lx, b.cy + 18, true), pip('♦', rx, b.cy - 6, true), pip('♣', rx, b.cy + 18, false));
    }
    return out.join('');
  }

  /* ---- drawing ---- */
  let art = null, pending = false;
  function measure(){
    const felt = $id('felt'); if (!felt) return null;
    const fr = felt.getBoundingClientRect();
    const R = parseFloat(getComputedStyle(felt).borderTopLeftRadius) || 52;
    const bd = $id('board'), br = bd.getBoundingClientRect();
    const card = bd.querySelector('.card');
    const cr = card ? card.getBoundingClientRect() : null;
    const gap = parseFloat(getComputedStyle(bd).columnGap) || 7;
    const board = { cx:br.left + br.width / 2 - fr.left, cy:br.top + br.height / 2 - fr.top, cw:cr ? cr.width : 44, ch:cr ? cr.height : 62, gap };
    // the clear bands for printing: under the board (down to the pot tray), and under the pot (down to your bet spot)
    const top = el => el && el.getBoundingClientRect().height ? el.getBoundingClientRect().top - fr.top : null;
    const bot = el => el && el.getBoundingClientRect().height ? el.getBoundingClientRect().bottom - fr.top : null;
    const tray = felt.querySelector('.ct-tray'), you = felt.querySelector('.ec-square[data-id="you"]');
    const boardBottom = board.cy + board.ch / 2;
    board.gapMid = ((top(tray) || boardBottom + 56) + boardBottom) / 2;
    board.lowTop = Math.max(bot($id('pot-area')) || 0, bot(tray) || 0, boardBottom + 110);
    board.lowBottom = top(you) || board.lowTop + 50;
    return { felt, W:felt.offsetWidth, H:felt.offsetHeight, R, board };
  }
  function draw(){
    pending = false;
    G = measure(); if (!G) return;
    if (!art || !G.felt.contains(art)){
      art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      art.setAttribute('class', 'fl-art'); art.setAttribute('aria-hidden', 'true');
      G.felt.insertBefore(art, G.felt.firstChild);
    }
    const rw = railW();
    root.style.setProperty('--fl-rw', rw + 'px');
    root.style.setProperty('--fl-R', G.R + 'px');
    root.style.setProperty('--fl-by', (G.board.cy / G.H * 100).toFixed(1) + '%');
    const dock = $id('your-seat-dock');
    if (dock) root.style.setProperty('--fll-bottom', Math.round(innerHeight - dock.getBoundingClientRect().top + 10) + 'px');
    root.style.setProperty('--fl-thread', THREAD[shown.scol] || THREAD.gold);
    art.setAttribute('width', G.W); art.setAttribute('height', G.H);
    art.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    const rail = RAILS[shown.rail] ? RAILS[shown.rail](rw) : [];
    const defs = rail.filter(s => s.startsWith('<linearGradient'));
    const body = rail.filter(s => !s.startsWith('<linearGradient'));
    art.innerHTML = '<defs>' + defs.join('') + '</defs><g class="fl-rail">' + body.join('') + '</g>' +
      '<g class="fl-marks">' + marks() + '</g><g class="fl-stitch">' + stitches() + '</g>';
  }
  const redraw = () => { if (!pending){ pending = true; requestAnimationFrame(draw); } };

  /* ---- tweed: a small tile of cloth pixels in the felt's own colours ---- */
  function tweed(){
    const felt = $id('felt'); if (!felt) return;
    const cs = getComputedStyle(felt);
    const c1 = cs.getPropertyValue('--felt-1').trim() || '#1A3A2A', c2 = cs.getPropertyValue('--felt-2').trim() || '#15301F';
    const cv = document.createElement('canvas'); cv.width = cv.height = 48;
    const x = cv.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    x.fillStyle = c2; x.fillRect(0, 0, 48, 48);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++){
      const r = rnd();
      if (r < .42){ x.fillStyle = c1; x.fillRect(i * 2, j * 2, 2, 2); }
      else if (r < .47){ x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(i * 2, j * 2, 2, 2); }
      else if (r < .53){ x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(i * 2, j * 2, 2, 2); }
    }
    root.style.setProperty('--fl-tweed', 'url(' + cv.toDataURL() + ')');
  }

  /* ---- applying picks ---- */
  function apply(p){
    p = p || picks;
    root.setAttribute('data-fl-lab', '');
    ['rail', 'stitch', 'cloth', 'fcol', 'light', 'spots', 'seam'].forEach(k => root.setAttribute('data-fl-' + k, p[k]));
    shown = p;
    try{
      if (typeof settings !== 'undefined' && settings.theme !== p.theme){ settings.theme = p.theme; applyRunTheme(); }
    }catch(e){}
    tweed();
    draw();
    // the felt may have moved in (a full rail): let the table re-place its bet spots and coins
    setTimeout(() => { try{ window.dispatchEvent(new Event('resize')); if (typeof render === 'function' && typeof game !== 'undefined' && game) render(); }catch(e){} redraw(); }, 30);
  }
  function commit(){ apply(picks); save(); paintSheet(); paintBar(); }

  /* ---- the keys and the sheet ---- */
  const seg = (key, opts, cur) => '<div class="fll-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="fll-row"><div class="fll-name">' + r[1] + '</div>' + seg(r[0], r[2], picks[r[0]]) + (r[3] ? '<p class="fll-note">' + r[3] + '</p>' : '') + '</div>';
  let sheet, bar, nameEl;
  const isLook = () => LOOKS[look] && ROWS.every(r => LOOKS[look].picks[r[0]] === picks[r[0]]);
  function build(){
    bar = document.createElement('div');
    bar.className = 'fll-bar';
    bar.innerHTML = '<button type="button" class="fll-key fll-before" data-bar="before">HOLD FOR BEFORE</button>' +
      '<button type="button" class="fll-key" data-bar="tune">TUNE</button>' +
      '<button type="button" class="fll-key fll-arrow" data-bar="prev" aria-label="Previous look">◀</button>' +
      '<button type="button" class="fll-key fll-arrow" data-bar="next" aria-label="Next look">▶</button>' +
      '<div class="fll-look" aria-live="polite"></div>';
    nameEl = bar.querySelector('.fll-look');
    sheet = document.createElement('div');
    sheet.className = 'fll-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Felt lab');
    sheet.innerHTML =
      '<div class="fll-tabs" role="tablist">' +
        ['looks', 'rail', 'felt', 'marks', 'scene'].map((t, i) => '<button type="button" data-tab="' + t + '"' + (i === 0 ? ' class="is-on"' : '') + '>' + t.toUpperCase() + '</button>').join('') +
        '<button type="button" class="fll-close" aria-label="Close">✕</button></div>' +
      '<div class="fll-body">' +
        '<section data-pane="looks"><p class="fll-sub">Whole combinations to start from. ◀ ▶ on the table flips through them with the drawer closed. Change any row after and it becomes your own mix.</p>' +
          '<div class="fll-looks">' + LOOKS.map((l, i) => '<button type="button" data-look="' + i + '"><b>' + l.name + '</b><span>' + l.blurb + '</span></button>').join('') + '</div></section>' +
        '<section data-pane="rail" hidden>' + TABS.rail.map(row).join('') + '</section>' +
        '<section data-pane="felt" hidden>' + TABS.felt.map(row).join('') + '</section>' +
        '<section data-pane="marks" hidden>' + TABS.marks.map(row).join('') + '</section>' +
        '<section data-pane="scene" hidden><p class="fll-sub">Deals a fresh table and plays it to the moment, then leaves it standing. Your picks stay.</p>' +
          '<div class="fll-scenes">' + SCENES.map(s => '<button type="button" data-scene="' + s[0] + '"' + (s[2] ? ' class="is-wide"' : '') + '>' + s[1] + '</button>').join('') + '</div>' +
          '<div class="fll-actions"><button type="button" data-act="reset">BACK TO AS NOW</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="fll-copytext" readonly hidden></textarea></section>' +
      '</div>';
    document.body.appendChild(bar); document.body.appendChild(sheet);

    const open = on => { sheet.classList.toggle('is-open', on); bar.querySelector('[data-bar="tune"]').classList.toggle('is-on', on); };
    const step = d => { look = (look + d + LOOKS.length) % LOOKS.length; picks = Object.assign({}, LOOKS[look].picks); commit(); };
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-bar]'); if (!b) return;
      if (b.dataset.bar === 'tune') open(!sheet.classList.contains('is-open'));
      if (b.dataset.bar === 'prev') step(-1);
      if (b.dataset.bar === 'next') step(1);
    });
    // BEFORE: hold to see the table as it ships, let go to come back
    const before = bar.querySelector('[data-bar="before"]');
    const show = on => { before.classList.toggle('is-on', on); apply(on ? Object.assign({}, ASIS, { theme:picks.theme }) : picks); };
    before.addEventListener('pointerdown', e => { e.preventDefault(); show(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => before.addEventListener(t, () => { if (before.classList.contains('is-on')) show(false); }));
    before.addEventListener('contextmenu', e => e.preventDefault());

    sheet.querySelector('.fll-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.look != null){ look = Number(t.dataset.look); picks = Object.assign({}, LOOKS[look].picks); commit(); return; }
      if (t.dataset.scene){
        open(false); save();
        if (host) host.play(t.dataset.scene); else stage(t.dataset.scene);
        return;
      }
      const s = t.closest('.fll-seg');
      if (s){ picks[s.dataset.key] = t.dataset.v; commit(); return; }
      if (t.dataset.act === 'reset'){ look = 0; picks = Object.assign({}, ASIS, { theme:picks.theme }); commit(); return; }
      if (t.dataset.act === 'copy'){
        const text = 'Felt lab picks' + (isLook() ? ' (look: ' + LOOKS[look].name + ')' : ' (my own mix)') + ':\n' +
          ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === picks[r[0]]) || ['', picks[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('.fll-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }
  function paintSheet(){
    if (!sheet) return;
    sheet.querySelectorAll('.fll-seg').forEach(s => s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === picks[s.dataset.key])));
    sheet.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('is-on', isLook() && Number(b.dataset.look) === look));
  }
  function paintBar(){ if (nameEl) nameEl.textContent = isLook() ? (look + 1) + '/' + LOOKS.length + ' · ' + LOOKS[look].name : 'YOUR MIX'; }

  /* ---- scenes: the real engine, played to a moment and left standing ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !$id('actions-row').classList.contains('disabled') && !$id('console-flip').classList.contains('flipped'));
  const passive = () => { const call = game.currentBet - pendingHumanPlayer.betThisRound; humanAct(call > 0 ? 'call' : 'check'); };
  // [rivals dealt in (the game seats 4-6), rivals still in the hand, board cards, play on to the showdown]
  const PLAN = { deal:[4, 4, 0], flop:[4, 3, 3], river:[4, 3, 5], showdown:[4, 2, 5, true], headsup:[4, 1, 4], full:[6, 6, 3], empty:[4, 4, -1] };
  let staged = false;
  async function stage(scene){
    staged = false;
    const [seats, keep, board, toShowdown] = PLAN[scene] || PLAN.flop;
    if (board < 0){ startSinglePlayerRun({ opponentCount:seats, deferHand:true }); redraw(); staged = true; return; }
    DEV_MODE = true; FAST_DEV = true;
    startSinglePlayerRun({ opponentCount:seats });
    const kept = game.players.filter(p => !p.isHuman).slice(0, keep);
    let trimmed = keep >= seats;
    await waitFor(() => {
      kept.forEach(p => { if (p.inHand && !p.folded && !p.allIn) p._devAutoCall = true; });
      // the rest fold at your first turn (the game always seats at least four)
      if (!trimmed && myTurn()){
        game.players.forEach(p => { if (!p.isHuman && !kept.includes(p) && p.inHand && !p.folded) applyAction(p, { action:'fold' }); });
        trimmed = true; render();
      }
      if (toShowdown && game.board.length >= 4) FAST_DEV = false;   // the award waits for a press, not the dev auto-click
      const done = toShowdown ? (game.phase === 'showdown' || game.over) : (game.board.length >= board && myTurn());
      if (!done && myTurn()) passive();
      return done;
    }, 90000);
    game.players.forEach(p => { delete p._devAutoCall; });
    DEV_MODE = false; FAST_DEV = false;
    redraw(); staged = true;
  }
  window.__flLab = { stage, get staged(){ return staged; }, get picks(){ return Object.assign({}, picks); }, set(p){ Object.assign(picks, p); commit(); }, looks:LOOKS.map(l => l.name), look(i){ look = i; picks = Object.assign({}, LOOKS[i].picks); commit(); } };

  /* ---- start ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = false; }catch(e){}
    build(); apply(picks); paintSheet(); paintBar();
    const felt = $id('felt');
    if (felt && window.ResizeObserver) new ResizeObserver(redraw).observe(felt);
    const bd = $id('board');
    if (bd) new MutationObserver(redraw).observe(bd, { childList:true });
    window.addEventListener('resize', redraw);
    stage(state.scene || 'flop').catch(err => console.error(err));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
