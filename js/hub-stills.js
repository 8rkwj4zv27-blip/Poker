/* ============================================================
   CAREER HUB STILLS — four still layouts of the simplified hub, for the
   owner to compare and pick (lab only; nothing moves except the pick).

   The owner's brief (11 Oct): the bankroll reel full width across the top
   of the cabinet; the card slot in the middle of the cabinet, exactly the
   width of a card; a CRT either side, neat and symmetrical; the felt with
   a faint darker rectangle where three cards are thrown and arranged; a
   deck in a corner (tap: another card; a button sucks them all up and
   deals three fresh); chips that behave as in the game (the pile follows
   the bankroll); the dashboard key bay
   SHOP · PLAY · CARDS. Every part is the game's own: the reel, the CRTs,
   the felt, CoinWorld's chip art, the card faces, the keys. (P.I.P. comes
   in once a layout is picked: his set only draws as part of the table.)
   ============================================================ */
(() => {
  'use strict';
  const STILLS = [
    { id:'A', name:'ROLLERS', note:'Slot with rubber rollers in its mouth. CRTs: tonight and venues. Cards thrown loose. A modest pile.',
      slot:'rollers', crtL:['TONIGHT', '3 CARDS', 'DEALT FOR YOU'], crtR:['VENUES', '2/6', 'PUB CIRCUIT'], bank:4940, chips:'modest', deck:'left', lay:'thrown' },
    { id:'B', name:'LAMPS', note:'Slot with a lamp strip that lights as a card nears. CRTs: last table and next venue. Cards in a row, deck on the right, towers on the left.',
      slot:'lamps', crtL:['LAST TABLE', '2ND', '+$150 · PUB'], crtR:['NEXT VENUE', 'CARD CLUB', 'WIN AT THE PUB'], bank:12650, chips:'towers', deck:'right', lay:'row' },
    { id:'C', name:'PLAIN', note:'A plain machined mouth. CRTs: cards on the felt and your record. Cards fanned. Nearly broke: one short stack.',
      slot:'plain', crtL:['ON THE FELT', '3', 'OF 9 IN YOUR CASE'], crtR:['RECORD', '14', 'TABLES PLAYED'], bank:620, chips:'short', deck:'left', lay:'fan' },
    { id:'D', name:'HIGH ROLLER', note:'As A, but rich: the chips pile up round the felt.',
      slot:'rollers', crtL:['TONIGHT', '3 CARDS', 'DEALT FOR YOU'], crtR:['VENUES', '5/6', 'HIGH ROLLER'], bank:186400, chips:'rich', deck:'left', lay:'thrown' }
  ];
  const CW = 82, CH = 120;
  const host = (() => { try { return parent !== window && parent.__lab ? parent.__lab : null; } catch (e) { return null; } })();
  const state = host ? host.state : {};
  let root, felt, still = STILLS.find(s => s.id === state.still) || STILLS[0];
  const $ = s => root.querySelector(s);

  /* the full-width bankroll reel: the production Career part */
  function reel(n){
    const digits = String(Math.max(0, Math.round(n))).padStart(7, '0');
    let lead = true;
    return '<span class="jp-cell jp-sym">$</span>' + [...digits].map(d => {
      lead = lead && d === '0';
      return `<span class="jp-cell jp-digit${lead ? ' is-leading' : ''}"><span class="ch2-digit-window"><span class="ch2-digit-strip"><span>${d}</span><span>${d}</span></span></span></span>`;
    }).join('');
  }
  function crt(lines){
    return `<div class="crt hs-crt"><span class="crt-caption">${lines[0]}</span><span class="crt-figure">${lines[1]}</span><span class="crt-caption">${lines[2]}</span></div>`;
  }
  function slot(kind){
    const rollers = kind === 'rollers' ? '<i class="hs-roller is-top"></i><i class="hs-roller is-bottom"></i>' : '';
    const lamps = kind === 'lamps' ? '<span class="hs-lamps"><i></i><i></i><i></i><i></i><i></i></span>' : '';
    return `<div class="hs-slot is-${kind}">${lamps}<div class="hs-mouth">${rollers}<i class="hs-throat"></i></div><b class="hs-slot-label">INSERT CARD</b></div>`;
  }

  function build(){
    root = document.createElement('main');
    root.id = 'hs'; root.className = 'lobby-card pc-housing';
    root.innerHTML = `
      <header class="hs-rail"><button class="icon-btn hs-icon" type="button" aria-label="Back"><i class="ci-arrow is-left"></i></button><span class="hs-title">CAREER</span><button class="icon-btn hs-icon" id="hs-tune" type="button" aria-label="Pick a still">TUNE</button></header>
      <div class="hs-cabinet">
        <div class="ch2-bankroll-housing hs-bank"><div class="ch2-bankroll-reel" id="hs-reel"></div></div>
        <div class="hs-row"><div class="hs-crt-l"></div><div class="hs-slot-wrap"></div><div class="hs-crt-r"></div></div>
      </div>
      <section class="hs-felt" data-theme="emerald"><div class="felt"></div><i class="hs-spread"></i><div class="hs-objects"></div></section>
      <footer class="hs-console"><div class="ec-bay"><div class="actions-row hs-keys"><button class="btn-check" type="button">SHOP</button><button class="btn-raise" type="button">PLAY</button><button class="btn-check" type="button">CARDS</button></div></div></footer>
      <section class="po-sheet hs-sheet" id="hs-sheet" hidden aria-label="Pick a still">
        <h2>CAREER HUB · STILLS</h2>
        <p>Four stills of the simplified hub. Nothing moves yet: pick the one you like (or the parts of each).</p>
        <div class="hs-picks">${STILLS.map(s => `<button class="pc-button pc-button-secondary" data-still="${s.id}"><b>${s.id} · ${s.name}</b><small>${s.note}</small></button>`).join('')}</div>
        <div class="po-seg"><button class="pc-button pc-button-secondary" id="hs-done">DONE</button></div>
      </section>`;
    document.body.classList.add('hs-lab');
    const home = document.getElementById('home');
    home.classList.add('hs-home'); home.classList.remove('hidden');
    [...home.classList].filter(c => c.startsWith('hb-')).forEach(c => home.classList.remove(c));
    const oldFelt = document.getElementById('felt'); if (oldFelt) oldFelt.id = 'hs-parked-felt';
    home.append(root);
    felt = root.querySelector('.hs-felt');
    felt.querySelector('.felt').id = 'felt';
    $('#hs-tune').onclick = () => { $('#hs-sheet').hidden = !$('#hs-sheet').hidden; };
    $('#hs-done').onclick = () => { $('#hs-sheet').hidden = true; };
    root.querySelectorAll('[data-still]').forEach(b => b.onclick = () => { $('#hs-sheet').hidden = true; pick(b.dataset.still); });
  }

  function pick(id){
    still = STILLS.find(s => s.id === id) || STILLS[0];
    if (host) host.set({ still:still.id });
    root.querySelectorAll('[data-still]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.still === still.id)));
    render();
  }

  /* ---------------- one still ---------------- */
  function render(){
    $('#hs-reel').innerHTML = reel(still.bank);
    $('.hs-crt-l').innerHTML = crt(still.crtL);
    $('.hs-crt-r').innerHTML = crt(still.crtR);
    $('.hs-slot-wrap').innerHTML = slot(still.slot);
    root.dataset.still = still.id;
    requestAnimationFrame(() => requestAnimationFrame(layout));
  }
  function layout(){
    const W = felt.clientWidth, H = felt.clientHeight, objs = felt.querySelector('.hs-objects');
    objs.innerHTML = '';
    // the spread: a faint darker rectangle, card-proportioned, upper middle of the felt
    const s = Math.min(1.2, W * .27 / CW, H * .32 / CH);
    const spread = felt.querySelector('.hs-spread');
    const sw = Math.round(Math.min(W - 24, CW * s * 3.7)), sh = Math.round(CH * s * 1.5);
    const sx = Math.round((W - sw) / 2), sy = Math.round(H * .1);
    Object.assign(spread.style, { left:sx + 'px', top:sy + 'px', width:sw + 'px', height:sh + 'px' });
    // three cards, thrown (loose), in a row, or in a fan
    const cards = [EventCards.make('table', 'rare', 'pub-turbo'), EventCards.make('bomb', 'uncommon', 'pub-open'), EventCards.make('freezeout', 'common', 'back-room-five')];
    const cx = sx + sw / 2, cy = sy + sh / 2;
    const poses = {
      thrown:[{ x:cx - CW * s * 1.08, y:cy + 4, r:-9 }, { x:cx + 4, y:cy - 6, r:4 }, { x:cx + CW * s * 1.1, y:cy + 8, r:13 }],
      row:[{ x:cx - CW * s * 1.12, y:cy, r:0 }, { x:cx, y:cy, r:0 }, { x:cx + CW * s * 1.12, y:cy, r:0 }],
      fan:[{ x:cx - CW * s * .8, y:cy + 8, r:-12 }, { x:cx, y:cy - 2, r:0 }, { x:cx + CW * s * .8, y:cy + 8, r:12 }]
    }[still.lay];
    cards.forEach((c, i) => {
      const p = poses[i], el = document.createElement('div');
      el.className = 'hs-card';
      el.innerHTML = PokerCollectibleLab.objectHTML(c.spec);
      el.style.transform = `translate(${Math.round(p.x - CW / 2)}px,${Math.round(p.y - CH / 2)}px) rotate(${p.r}deg) scale(${s.toFixed(3)})`;
      el.style.zIndex = 10 + i;
      objs.append(el);
    });
    deck(objs, W, H, s);
    chips(W, H);
  }
  // the deck in a corner, with its two buttons: DEAL ONE (tap the deck) and the
  // reshuffle key that sucks the cards up and deals three fresh
  function deck(objs, W, H, s){
    const d = document.createElement('div'), right = still.deck === 'right';
    d.className = 'hs-deck' + (right ? ' is-right' : '');
    d.innerHTML = `<div class="hs-deck-stack" style="--s:${(s * .62).toFixed(3)}">${'<div class="hs-deck-card ds-swatch" data-cb="crest"><div class="card back"></div></div>'.repeat(5)}</div><button class="hs-deck-key" type="button" aria-label="Shuffle back and deal three"><i></i></button><b class="hs-deck-label">DEAL · SHUFFLE</b>`;
    objs.append(d);
  }
  // the bankroll as stacks of the game's own chip sprites (CoinWorld's art);
  // in the moving version they're live CoinWorld chips you can throw about
  function chips(W, H){
    const layer = felt.querySelector('.hs-objects');
    const plans = {
      short:[[.8, .88, 2, 't0']],
      modest:[[.6, .9, 5, 't2'], [.69, .91, 7, 't1'], [.78, .89, 4, 't0'], [.66, .96, 3, 't0']],
      towers:[[.12, .86, 9, 't3'], [.2, .89, 12, 't2'], [.28, .86, 7, 't1'], [.36, .9, 5, 't0'], [.22, .96, 4, 't1']],
      rich:[[.08, .5, 14, 't4'], [.08, .66, 16, 't3'], [.16, .58, 11, 't2'], [.92, .5, 15, 't4'], [.92, .66, 13, 't3'], [.84, .58, 10, 't2'],
            [.56, .9, 12, 't3'], [.64, .92, 16, 't4'], [.72, .89, 9, 't2'], [.8, .93, 14, 't3'], [.88, .9, 8, 't1'], [.48, .95, 5, 't1']]
    }[still.chips];
    plans.sort((p, q) => p[1] - q[1]).forEach(([fx, fy, n, col]) => {
      const x = Math.round(fx * W), y = Math.round(fy * H);
      for (let i = 0; i < n; i++){
        const c = CoinWorld.makeChip(col);
        CoinWorld.setFrame(c, 24, 0, false);
        Object.assign(c.el.style, { position:'absolute', left:(x - 12 + (i % 3 === 1 ? 1 : 0)) + 'px', top:(y - 15 - i * 4) + 'px', width:'24px', height:'29px', zIndex:String(20 + y) });
        c.el.classList.add('hs-chip');
        layer.append(c.el);
      }
    });
  }

  function setup(){
    build();
    pick(still.id);
    new ResizeObserver(() => layout()).observe(felt);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
