"use strict";

/* ============================================================
   DEAL STYLES (candidate, Deal Style Lab) — how a card flies off the deck

   Every card the dealer deck deals (yours, theirs, the board) flies along
   a path of points (js/dealer-deck.js, fly(): [offset, travel, lift,
   turn, pitch, extraScale, easing, lateralCurve, yaw]). The shipped deal
   is FLICK. These are the other styles, and the picker that chooses one
   for each card:

   - the owner ticks which styles are in the mix and how rare each is
     (COMMON 10 / UNCOMMON 4 / RARE 1 / LEGENDARY 0.15 as weights)
   - EACH HAND: one common/uncommon style is rolled for the whole hand;
     EACH CARD: every card rolls its own
   - RARE and LEGENDARY styles are never a whole hand: any single card can
     roll one, as a surprise, on top of either mode
   - a style marked mirror flips its curve and lean at random, so a swoop
     can come round either side

   Presentation only: it hands DealerDeck a path and a decoration for the
   ghost; nothing in the game changes, and the cards land exactly where
   they always do (and still go under an opponent's cabinet, and still
   turn in the air on the way to your holder).

   Only the Lab loads this (deal-style-lab.html). DealStyles.apply(order)
   takes { on:{id:bool}, rarity:{id:level}, scope:'hand'|'card' }.
   ============================================================ */
const DealStyles = (() => {
  const P = (o, t, l, z, x, s, e, c, y) => [o, t, l, z, x, s, e || null, c || 0, y || 0];
  const IN = 'cubic-bezier(.5,0,.9,.6)', OUT = 'cubic-bezier(.2,.7,.3,1)', SOFT = 'cubic-bezier(.3,0,.7,1)';
  const WEIGHT = { common:10, uncommon:4, rare:1, legendary:.15 };
  const SOLO = { rare:true, legendary:true };

  /* ---- the rare ones' dressing ---- */
  function spark(x, y, cls){
    const s = document.createElement('i');
    s.className = 'dsx-spark' + (cls ? ' ' + cls : '');
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', ((Math.random() - .5) * 26).toFixed(1) + 'px');
    s.style.setProperty('--dy', (8 + Math.random() * 22).toFixed(1) + 'px');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 700);
  }
  function trail(ghost, dur, from, to, cls){
    const t0 = performance.now();
    const tick = () => {
      if (!ghost.isConnected) return;
      const k = (performance.now() - t0) / dur;
      if (k >= from && k <= to){
        const r = ghost.getBoundingClientRect();
        spark(r.left + r.width * (.2 + Math.random() * .6), r.top + r.height * (.2 + Math.random() * .6), cls);
      }
      if (k < to) setTimeout(tick, 34);
    };
    tick();
  }
  function flash(rect, cls){
    const f = document.createElement('i');
    f.className = 'dsx-flash' + (cls ? ' ' + cls : '');
    f.style.left = (rect.left + rect.width / 2) + 'px'; f.style.top = (rect.top + rect.height / 2) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 600);
  }
  const royal = (ghost, anim, dur, at) => {
    ghost.classList.add('dsx-gold');
    trail(ghost, dur, .04, .3, 'gold');
    trail(ghost, dur, .52, .9, 'gold');
    setTimeout(() => { try{ Sound.cardFlip(true); }catch(e){} }, dur * .3);
    setTimeout(() => { flash(at.to, 'gold'); for (let i = 0; i < 10; i++) spark(at.to.left + at.to.width / 2, at.to.top + at.to.height * .7, 'gold burst'); }, dur * .9);
  };
  const beam = (ghost, anim, dur, at) => {
    ghost.classList.add('dsx-beam');
    trail(ghost, dur, .22, .56, 'beam');
    setTimeout(() => flash(at.from, 'beam'), dur * .12);
    setTimeout(() => flash(at.to, 'beam'), dur * .6);
  };

  /* ---- the styles ---- */
  const STYLES = [
    { id:'flick', name:'FLICK', rarity:'common', note:'Today\'s deal: a shallow, hand-thrown arc.', pace:1,
      points:() => DealerDeck.POINTS.flick },
    { id:'slide', name:'SLIDE', rarity:'common', note:'Pushed low across the felt, like a card under a finger.', pace:1.08,
      points:() => DealerDeck.POINTS.slide },
    { id:'lob', name:'LOB', rarity:'common', note:'Tossed high, drops into place with a little bounce.', pace:1.3, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.5)'),
      P(.22, .2, 44, -8, 10, 1.05, 'cubic-bezier(.2,.5,.4,1)', -4),
      P(.5, .56, 72, -4, 12, 1.08, IN, -6),
      P(.8, 1, 0, 2, 0, 1, OUT),
      P(.88, 1, 7, -1, 0, 1.01, IN),
      P(.95, 1, 0, 0, 0, 1, OUT),
      P(1, 1, 0, 0, 0, 1)] },
    { id:'whip', name:'WHIP', rarity:'common', note:'Fast and flat: snaps past its spot and settles back.', pace:.72, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.6,0,.9,.5)'),
      P(.62, 1.07, 2, -10, 0, 1.01, OUT),
      P(.78, .98, 0, 5, 0, 1, SOFT),
      P(.9, 1.01, 0, -2, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)] },
    { id:'swoop', name:'SWOOP', rarity:'uncommon', note:'Swings wide in a big curve (either side) and banks into its spot.', pace:1.15, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.5)'),
      P(.25, .2, 12, -18, 4, 1.02, 'cubic-bezier(.3,.2,.5,1)', -55),
      P(.55, .6, 16, -10, 4, 1.03, 'cubic-bezier(.4,0,.6,1)', -60),
      P(.85, .97, 4, 6, 0, 1.005, OUT, -12),
      P(.94, 1, 0, -1, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)] },
    { id:'skip', name:'SKIP', rarity:'uncommon', note:'Skims the felt and skips twice, like a flat stone.', pace:1.15, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.6)'),
      P(.22, .3, 14, -4, 6, 1.02, IN, -3),
      P(.4, .55, 0, 2, 0, 1, 'cubic-bezier(.1,.6,.4,1)', -2),
      P(.55, .72, 9, -3, 4, 1.01, IN, -1),
      P(.7, .88, 0, 2, 0, 1, 'cubic-bezier(.1,.6,.4,1)'),
      P(.8, .96, 4, -1, 2, 1, IN),
      P(.9, 1, 0, 0, 0, 1, OUT),
      P(1, 1, 0, 0, 0, 1)] },
    { id:'spin', name:'SPIN', rarity:'uncommon', note:'A full flat turn in the air, landing square.', pace:1,
      points:() => DealerDeck.POINTS.spin },
    { id:'flutter', name:'FLUTTER', rarity:'uncommon', note:'Floats up, then rocks side to side down to its spot, like a falling leaf.', pace:1.45, mirror:true, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.2,0,.4,1)'),
      P(.2, .25, 46, -6, 8, 1.05, 'ease-in-out', -6),
      P(.36, .42, 40, 14, 4, 1.05, 'ease-in-out', 6),
      P(.52, .6, 30, -12, 6, 1.04, 'ease-in-out', -5),
      P(.68, .78, 20, 10, 3, 1.03, 'ease-in-out', 4),
      P(.84, .94, 8, -6, 2, 1.01, 'ease-in-out', -2),
      P(.94, 1, 0, 2, 0, 1, SOFT),
      P(1, 1, 0, 0, 0, 1)] },
    { id:'tumble', name:'TUMBLE', rarity:'uncommon', note:'Goes end over end through the air.', pace:1.1, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.3,0,.6,.5)'),
      P(.3, .3, 26, -4, 120, 1.04, 'linear', -4),
      P(.6, .68, 24, -2, 250, 1.04, 'linear', -3),
      P(.86, .98, 6, 0, 352, 1.01, OUT),
      P(.94, 1, 0, 0, 360, 1, SOFT),
      P(1, 1, 0, 0, 360, 1)] },
    { id:'beam', name:'BEAM', rarity:'rare', note:'Rare. The machine zaps it: the card shrinks to a spark at the deck, streaks across and pops up in its spot.', pace:1.15, decorate:beam, points:() => [
      P(0, 0, 0, 0, 0, 1, 'steps(3,end)'),
      P(.2, 0, 6, 0, 0, .08, 'linear'),
      P(.28, 0, 6, 0, 0, .08, 'cubic-bezier(.6,0,.4,1)'),
      P(.56, 1, 6, 0, 0, .08, 'steps(3,end)'),
      P(.7, 1, 0, 0, 0, 1.16, 'steps(2,end)'),
      P(.82, 1, 0, 0, 0, .96, 'steps(2,end)'),
      P(1, 1, 0, 0, 0, 1)] },
    { id:'royal', name:'ROYAL FLOURISH', rarity:'legendary', note:'Legendary. The card rises out of the deck in gold light, spins twice, hangs at the top, then dives to its spot in a trail of sparks and lands with a flash.', pace:2.4, decorate:royal, points:() => [
      P(0, 0, 0, 0, 0, 1, 'cubic-bezier(.2,0,.3,1)'),
      P(.22, .08, 110, -180, 0, 1.35, 'linear'),
      P(.38, .1, 118, -540, 0, 1.4, OUT),
      P(.52, .1, 120, -720, 0, 1.4, 'cubic-bezier(.7,0,.9,.4)'),
      P(.84, 1, 6, -730, 0, 1.02, 'cubic-bezier(.2,.8,.3,1)'),
      P(.92, 1, 0, -722, 0, 1.06, SOFT),
      P(1, 1, 0, -720, 0, 1)] }
  ];
  const byId = id => STYLES.find(s => s.id === id);

  let O = { on:{}, rarity:{}, scope:'hand' };
  STYLES.forEach(s => { O.on[s.id] = true; O.rarity[s.id] = s.rarity; });

  // a style, ready to fly (mirrored at random if it can be)
  function make(s){
    let pts = s.points();
    if (s.mirror && Math.random() < .5) pts = pts.map(p => { const q = p.slice(); q[3] = -q[3]; q[7] = -(q[7] || 0); return q; });
    return { id:s.id, points:pts, pace:s.pace, decorate:s.decorate };
  }
  function roll(list){
    const total = list.reduce((t, s) => t + WEIGHT[O.rarity[s.id]], 0);
    let r = Math.random() * total;
    for (const s of list){ r -= WEIGHT[O.rarity[s.id]]; if (r <= 0) return s; }
    return list[list.length - 1];
  }
  let handKey = null, handStyle = null;
  function pick(){
    const on = STYLES.filter(s => O.on[s.id]);
    if (!on.length) return null;
    const plain = on.filter(s => !SOLO[O.rarity[s.id]]);
    // any single card can be the rare one
    const r = roll(on);
    if (SOLO[O.rarity[r.id]] || !plain.length) return r;
    if (O.scope === 'card') return r;
    const key = typeof game !== 'undefined' && game ? game.handNumber : 0;
    if (key !== handKey || !handStyle || !O.on[handStyle.id]){ handKey = key; handStyle = roll(plain); }
    return handStyle;
  }
  function apply(order){
    if (order){
      if (order.on) Object.assign(O.on, order.on);
      if (order.rarity) Object.assign(O.rarity, order.rarity);
      if (order.scope) O.scope = order.scope;
    }
    handStyle = null;
    DealerDeck.flightFor = () => { const s = pick(); return s ? make(s) : null; };
  }
  apply();
  return { STYLES, WEIGHT, apply, make:id => make(byId(id)), get order(){ return JSON.parse(JSON.stringify(O)); } };
})();
