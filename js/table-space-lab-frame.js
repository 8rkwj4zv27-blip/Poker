"use strict";
/* ============================================================
   TABLE SPACE LAB — the half that runs INSIDE the sandboxed game
   (table-space-lab.html injects it after every production script).

   Presentation experiments only: it restyles the live table from the
   lab's settings, moves the coin world's pot tray and bet spots to match,
   and measures the result. It never touches poker state or storage.

   1. The iPhone 15 Pro Max as an installed app: every env(safe-area-*)
      in the game's own stylesheets is rewritten to the device's insets
      (59px top, 34px bottom), so the frame lays out exactly as the phone
      does, status bar and home bar included.
   2. SpaceLab.apply(settings): one generated stylesheet plus the few
      moves CSS can't make (the settings key, the table print).
   3. The coin world: after the game lays out its tray and spots
      (CoinTable.layout -> CoinWorld.zone), adjust() re-places them for
      the current settings and tidies any coins already down.
   ============================================================ */
(function(){
  const SAFE = { top:59, bottom:34, left:0, right:0 };
  const $ = id => document.getElementById(id);
  const q = s => document.querySelector(s);

  /* ---------------- 1. device safe areas ---------------- */
  function emulateSafeArea(){
    const re = /env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g;
    const fix = v => v.replace(re, (m, side) => SAFE[side] + 'px');
    const walk = rules => {
      for (const r of rules){
        if (r.style){
          for (let i = 0; i < r.style.length; i++){
            const p = r.style[i], v = r.style.getPropertyValue(p);
            if (v && v.indexOf('safe-area-inset') !== -1) r.style.setProperty(p, fix(v), r.style.getPropertyPriority(p));
          }
        }
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const sh of document.styleSheets){ try{ walk(sh.cssRules); }catch(e){} }
  }

  /* ---------------- 2. the settings as a stylesheet ---------------- */
  const style = document.createElement('style');
  style.id = 'space-lab';
  document.head.appendChild(style);
  let S = null;

  function css(s, t){
    const out = [];
    const add = x => out.push(x);
    const ch = (...ks) => ks.some(k => s[k] !== t[k]);
    // TOP (the game has no top bar since v0.40.7; TRIM / FULL bring it
    // back, with its title, hand and blinds only)
    if (s.top === 'trim' || s.top === 'full'){
      add('#table-screen .topbar{display:flex!important}');
      add('#table-screen .table-main{padding-top:0!important}');
    }
    if (s.top === 'trim'){
      const pad = SAFE.top + s.topGap, h = s.topH;
      add(`.topbar{height:${pad + h}px!important;min-height:0!important;padding-top:${pad}px!important;padding-bottom:0!important;align-items:center!important}`);
      if (h < 34) add(`.topbar .meta{margin-top:0!important;font-size:${h < 30 ? 9 : 10}px!important}.topbar .brandmini{font-size:${h < 30 ? 8 : 9}px!important}`);
    }
    if (s.top === 'gone'){
      if (ch('topGap')) add(`#table-screen .table-main{padding-top:${SAFE.top + s.topGap}px!important}`);
      add(`.sl-print{position:absolute;left:0;right:0;top:${s.printY}%;transform:translateY(-50%);z-index:1;text-align:center;pointer-events:none;
        font-family:var(--font-hdr);font-size:7px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.2);text-shadow:0 1px 0 rgba(0,0,0,.35)}`);
      if (s.gear === 'felt'){
        add('#felt .sl-gear{position:absolute!important;right:18px;bottom:16px;z-index:7;width:30px!important;height:30px!important;min-width:0!important;min-height:0!important;font-size:13px!important}');
      }
    }
    // TABLE
    if (ch('boardY')) add(`#felt .board{top:${s.boardY}%!important}`);
    if (ch('potY')) add(`#felt .pot-area{top:${s.potY}%!important}`);
    if (ch('deckX','deckY','deckS')) add(`#felt .dealer-station{left:${s.deckX}%!important;top:${s.deckY}%!important;scale:${s.deckS / 100}}`);
    if (s.tray === 'box'){
      add('#felt .ct-tray[data-tray="well"]{border-radius:3px!important;background:rgba(0,0,0,.14)!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,.1),inset 0 3px 0 rgba(0,0,0,.22)!important}');
    }
    // OPPONENTS
    if (ch('podY')) add(`#felt .seat:not(.you){translate:0 ${s.podY}px!important}`);
    if (s.face !== 100) add(`#felt .seat:not(.you) .avatar-wrap{zoom:${s.face / 100}}`);
    if (ch('hole')) add(`#felt .seat:not(.you) .seat-cards{zoom:${s.hole / 100}!important}`);
    if (s.rows === 'slim'){
      add('#felt .seat:not(.you) .seat-card{padding:2px!important;gap:1px!important}');
      add('#felt .seat:not(.you) .seat-name{padding:0 4px!important;line-height:1.25!important}');
      add('#felt .seat:not(.you) .seat-chips{min-height:19px!important;padding:1px 2px 0!important}');
      add('#felt .seat:not(.you) .action-slot{min-height:0!important;margin-top:1px!important;padding:1px 3px!important;border-width:1px!important}');
    }
    if (s.action === 'name'){
      // the name strip shows the action while there is one; the name comes
      // back when the slot empties (a new street)
      add('#felt .seat:not(.you) .action-slot{order:-1;margin-top:0!important}');
      add('#felt .seat:not(.you) .action-slot.act-empty{display:none!important}');
      add('#felt .seat:not(.you) .seat-card:has(.action-slot:not(.act-empty)) .seat-name{display:none!important}');
    }
    // BET SPOTS
    add(`.sl-betbox{position:absolute;z-index:3;pointer-events:none;border-radius:3px;
      background:rgba(0,0,0,.12);box-shadow:inset 0 0 0 2px rgba(255,255,255,.1),inset 0 3px 0 rgba(0,0,0,.2)}`);
    // DASHBOARD
    // heights as drawn: the dock is --hud-dock-h + 7px; the key bay is
    // --action-area-h + 7px but squeezed today (91px on this phone), so it
    // is set outright
    if (ch('dockH')) add(`#table-screen{--hud-dock-h:${s.dockH - 7}px!important}`);
    if (ch('actH')){
      add(`#table-screen{--action-area-h:${s.actH - 7}px!important}`);
      add(`#app #action-area.dash-frame-base{height:${s.actH}px!important;flex:0 0 ${s.actH}px!important}`);
    }
    if (ch('rise')) add(`#app #hud-mid .seat.you .seat-cards{margin-top:-${s.rise}px!important}`);
    if (ch('btnH')) add(`#app .btn-fold,#app .btn-check,#app .btn-call,#app .btn-raise,#app .btn-award-console,#app .btn-quick-resolve{height:${s.btnH}px!important;min-height:${s.btnH}px!important}`);
    if (ch('foot')){
      add(`#app .dash-frame,#app #action-area.dash-frame-base{--dash-foot:${s.foot}px!important}`);
      add(`#app #action-area.dash-frame-base>.actions-dock{bottom:calc(var(--dash-band) + ${s.foot}px)!important}`);
    }
    if (s.readouts === 'compact'){
      // the same readouts with less air: shorter screens, no STACK label
      // (the owner's round-1 dashboard pick), tighter bays
      add('#app #hud-status-normal{gap:3px!important}');
      add('#app #hud-mid .hand-strength{min-height:0!important;margin-top:0!important;padding:3px 3px 2px!important}');
      add('#app #hud-mid .banner{min-height:0!important;padding:3px 3px 2px!important}');
      add('#app .stack-readout{margin-top:0!important}#app .stack-readout .instrument-label{display:none!important}');
      add('#app #jackpot{padding:2px!important}#app #jackpot .jp-cell{height:20px!important}');
      add('#app #hud-right{gap:3px!important;padding:3px 4px!important}#app #hud-right .bet-this-hand{min-height:0!important;gap:2px!important}');
      add('#app .dash-frame #hud-frame{padding-top:5px!important;padding-bottom:4px!important}');
    }
    return out.join('\n');
  }

  // the settings key and the table print: DOM moves CSS can't make. The
  // key's home is the dashboard's right bay (v0.40.7).
  let gearHome = null;
  function placeGear(){
    const gear = $('open-settings'); if (!gear) return;
    if (!gearHome) gearHome = { parent:gear.parentNode, next:gear.nextSibling };
    const want = S && S.top === 'gone' && S.gear === 'felt' ? $('felt') : gearHome.parent;
    gear.classList.toggle('sl-gear', want !== gearHome.parent);
    if (gear.parentNode === want) return;
    if (want === gearHome.parent) want.insertBefore(gear, gearHome.next && gearHome.next.parentNode === want ? gearHome.next : null);
    else want.appendChild(gear);
  }
  let printEl = null, metaObs = null;
  function placePrint(){
    const felt = $('felt'), meta = $('table-meta');
    if (!S || S.top !== 'gone' || S.print !== 'on'){ if (printEl) printEl.remove(); printEl = null; return; }
    if (!printEl){ printEl = document.createElement('div'); printEl.className = 'sl-print'; }
    if (printEl.parentNode !== felt) felt.appendChild(printEl);
    const copy = () => { if (printEl && meta) printEl.textContent = meta.textContent.replace(/\s*·\s*/g, '  ·  '); };
    copy();
    if (!metaObs && meta){ metaObs = new MutationObserver(copy); metaObs.observe(meta, { childList:true, characterData:true, subtree:true }); }
  }

  /* ---------------- 3. the coin world ---------------- */
  const CW = window.CoinWorld;
  let queued = false;
  if (CW){
    const zone0 = CW.zone;
    // CoinTable lays out through CW.zone(); re-place once its layout is done
    CW.zone = function(){
      const z = zone0.apply(this, arguments);
      if (!queued){ queued = true; queueMicrotask(() => { queued = false; adjust(); }); }
      return z;
    };
  }
  // the pot plate hides while the pot is empty: measure it at rest
  function withPotShown(fn){
    const area = $('pot-area'), plate = area && area.querySelector('.pot-chip');
    const hid = area && area.classList.contains('hidden');
    if (plate) plate.style.animation = 'none';
    if (hid) area.classList.remove('hidden');
    try{ return fn(); }
    finally{ if (hid) area.classList.add('hidden'); if (plate) plate.style.animation = ''; }
  }
  function heroCardsRect(){
    const cs = [...document.querySelectorAll('#hud-mid .seat.you .seat-cards .card')];
    const box = q('#hud-mid .seat.you .seat-cards');
    const rs = (cs.length ? cs : box ? [box] : []).map(e => e.getBoundingClientRect()).filter(r => r.width);
    if (!rs.length) return null;
    return { L:Math.min(...rs.map(r => r.left)), R:Math.max(...rs.map(r => r.right)), T:Math.min(...rs.map(r => r.top)), B:Math.max(...rs.map(r => r.bottom)) };
  }
  function adjust(){
    if (!CW || !S || !CW.zones.pot || typeof game === 'undefined' || !game) return;
    const felt = $('felt'), fr = felt.getBoundingClientRect();
    const pr = withPotShown(() => q('#pot-area .pot-chip').getBoundingClientRect());
    if (!pr.width) return;
    const bb = CW.boardRow();
    // the pot tray: above the plate (between it and the board) or below it
    const TW = S.trayW, TH = S.trayH, cx = pr.left + pr.width / 2;
    const yc = S.trayAt === 'below' ? pr.bottom - 8 + TH / 2 : pr.top + 8 - TH / 2;
    const tray = felt.querySelector('.ct-tray');
    if (tray) Object.assign(tray.style, { width:TW + 'px', height:TH + 'px',
      left:Math.round(cx - fr.left - TW / 2) + 'px', top:Math.round(yc - fr.top - TH / 2) + 'px' });
    const pot = CW.zones.pot;
    pot.cx = cx;
    if (S.trayAt === 'below'){ pot.cy = yc + TH / 2 - 6; pot.room = pot.cy - pr.bottom - 2; }
    else { pot.cy = yc + 5; pot.room = bb ? pot.cy - bb.B - 10 : undefined; }
    CW.setTray({ L:cx - TW / 2 + 6, R:cx + TW / 2 - 6, T:yc - TH / 2 + 4, B:yc + TH / 2 - 4 });
    // bet spots
    const hero = heroCardsRect();
    game.players.forEach(p => {
      const z = CW.zones['spot:' + p.id]; if (!z) return;
      if (!z.__base) z.__base = { cx:z.cx, cy:z.cy, room:z.room };
      const b = z.__base;
      if (p.isHuman){
        // the game's own spot is above your cards (v0.40.7)
        z.cx = b.cx; z.cy = b.cy;
        if (hero && S.you === 'right'){ z.cx = hero.R + 38; z.cy = Math.min(hero.T + 26, fr.bottom - 26); }
        if (S.you === 'old'){ z.cx = fr.left + fr.width * .80; z.cy = fr.top + fr.height * .80 + 2; }
      } else {
        z.cx = b.cx; z.cy = b.cy + S.oppDrop;
        if (b.room) z.room = b.room + S.oppDrop;
      }
    });
    CW.buildWalls();
    // bet boxes: one printed rectangle per spot, under the coins
    felt.querySelectorAll('.sl-betbox').forEach(e => e.remove());
    if (S.boxes === 'on'){
      const d = CW.D();
      game.players.forEach(p => {
        const z = CW.zones['spot:' + p.id]; if (!z || p.eliminated) return;
        const el = document.createElement('div'); el.className = 'sl-betbox';
        Object.assign(el.style, { width:S.boxW + 'px', height:S.boxH + 'px',
          left:Math.round(z.cx - fr.left - S.boxW / 2) + 'px', top:Math.round(z.cy - fr.top - d * .5 - S.boxH / 2 - 2) + 'px' });
        felt.appendChild(el);
      });
    }
    tidyAll(0);
  }
  // coins still moving (a throw, or the last tidy) are re-tidied once they
  // land, so they always end up on the current spots
  let tidyT = 0;
  function tidyAll(tries){
    clearTimeout(tidyT);
    let waiting = false;
    Object.values(CW.zones).forEach(z => {
      if (!z.list.length) return;
      if (CW.zoneBusy(z) || z.tidying){ waiting = true; return; }
      z.neat = false; CW.tidyZone(z);
    });
    if (waiting && tries < 12) tidyT = setTimeout(() => tidyAll(tries + 1), 250);
  }
  // a settings change that moves things without resizing the felt: the
  // game's layout is keyed on the felt's box, so nudge it once to re-run it
  function relayout(){
    const CT = typeof CoinTable === 'undefined' ? null : CoinTable;
    if (!CT || typeof game === 'undefined' || !game || !CT.on()) return;
    const felt = $('felt');
    felt.style.marginBottom = '-1px'; felt.style.height = 'calc(100% - 1px)';
    CT.layout();
    felt.style.marginBottom = ''; felt.style.height = '';
    CT.layout();
    adjust();
  }

  let T = null;
  function apply(s, today){
    S = Object.assign({}, s);
    if (today) T = Object.assign({}, today);
    style.textContent = css(S, T || S);
    placeGear(); placePrint();
    relayout();
  }

  /* ---------------- measuring ---------------- */
  // Board row as five cards, dealt or not (placeholder cards, as the coin
  // table measures it), so the numbers don't change street to street.
  function boardFull(){
    const board = $('board'); if (!board) return null;
    const temp = [];
    for (let i = board.children.length; i < 5; i++){ const c = document.createElement('div'); c.className = 'card'; c.style.visibility = 'hidden'; board.appendChild(c); temp.push(c); }
    try{ const r = board.getBoundingClientRect(); return { L:r.left, R:r.right, T:r.top, B:r.bottom }; }
    finally{ temp.forEach(c => c.remove()); }
  }
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { L:r.left, R:r.right, T:r.top, B:r.bottom } : null; };
  function measure(){
    const fr = box($('felt')); if (!fr) return null;
    const board = boardFull();
    const plate = withPotShown(() => box(q('#pot-area .pot-chip')));
    const tray = box(q('#felt .ct-tray'));
    const hero = heroCardsRect();
    const deck = box($('dealer-deck'));
    const pods = [...document.querySelectorAll('#felt .seat:not(.you)')].map(seat => {
      const parts = [seat.querySelector('.seat-card'), ...seat.querySelectorAll('.seat-cards .card')].map(box).filter(Boolean);
      return parts.length ? { L:Math.min(...parts.map(r => r.L)), R:Math.max(...parts.map(r => r.R)), T:Math.min(...parts.map(r => r.T)), B:Math.max(...parts.map(r => r.B)) } : null;
    }).filter(Boolean);
    const boxes = [...document.querySelectorAll('#felt .sl-betbox')].map(box).filter(Boolean);
    const overX = (a, b) => a.R > b.L && a.L < b.R;
    const podsLow = board ? Math.max(...pods.filter(p => overX(p, board)).map(p => p.B), fr.T) : fr.T;
    const potTop = Math.min(plate ? plate.T : 1e9, tray ? tray.T : 1e9);
    const potBot = Math.max(plate ? plate.B : 0, tray ? tray.B : 0);
    // open felt: sample the felt (inside its rail) and count the points
    // no part covers
    const solid = pods.concat([board, plate, tray, hero, deck].filter(Boolean), boxes);
    const inset = 14, step = 6;
    let open = 0, all = 0;
    for (let y = fr.T + inset; y < fr.B - inset; y += step) for (let x = fr.L + inset; x < fr.R - inset; x += step){
      all++;
      if (!solid.some(k => x >= k.L && x <= k.R && y >= k.T && y <= k.B)) open++;
    }
    const zones = CW ? CW.zones : {};
    const spotRoom = Object.keys(zones).filter(k => k.startsWith('spot:') && k !== 'spot:you' && zones[k].room).map(k => zones[k].room);
    return {
      felt: Math.round(fr.B - fr.T),
      openPct: all ? Math.round(open / all * 100) : 0,
      openArea: Math.round(open * step * step),
      podsToBoard: board ? Math.round(board.T - podsLow) : null,
      boardToPot: board ? Math.round(potTop - board.B) : null,
      potToHand: hero ? Math.round(hero.T - potBot) : null,
      potRoom: zones.pot && zones.pot.room ? Math.round(zones.pot.room) : null,
      spotRoom: spotRoom.length ? Math.round(Math.min(...spotRoom)) : null,
      dock: Math.round((box($('your-seat-dock')) || { B:0, T:0 }).B - (box($('your-seat-dock')) || { T:0 }).T),
      keys: Math.round(window.innerHeight - ((box($('action-area')) || { T:window.innerHeight }).T)),
      faces: (() => { const a = box(q('#felt .seat:not(.you) .avatar-wrap')); return a ? Math.round(a.R - a.L) : null; })()
    };
  }

  emulateSafeArea();
  window.SpaceLab = { apply, measure, relayout, adjust, get settings(){ return S; } };
})();
