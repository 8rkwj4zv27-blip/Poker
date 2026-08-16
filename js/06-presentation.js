"use strict";

/* ============================================================
   COACH
   ============================================================ */
function hideCoach(){
  $('coach').classList.add('hidden');
  const d=$('coach-draw'), w=$('coach-watch');
  if (d) d.classList.add('hidden');
  if (w) w.classList.add('hidden');
}
/* Both readouts are only meaningful while it's actually the human's turn.
   They must be cleared together the moment that stops being true — hiding
   only the coach here is what left "You have Ace high" stranded on screen
   through the whole showdown reveal. */
function clearHumanReadouts(){
  hideCoach();
  // The hand CRT is table instrumentation, not a turn-only coach readout.
  // It remains visible after the player acts or folds until the hand ends.
  updateHandInstrument();
}

async function updateCoach(){
  const p = pendingHumanPlayer;
  updateHandInstrument();
  if (!p) return;

  if (!settings.coach){ hideCoach(); return; }

  const token = ++coachToken;
  const g = game;
  const coach = $('coach');
  coach.classList.remove('hidden');
  $('coach-note').textContent = 'Working out the numbers…';
  $('coach-rec').textContent = '…';
  $('coach-rec').className = 'coach-rec';
  $('coach-equity').textContent = '—';
  $('coach-odds').textContent = '—';

  const numOpp = Math.max(1, g.players.filter(x=>x.inHand && !x.folded && x.id!=='you').length);
  const equity = await EquityService.get(p.hand, g.board, numOpp, 600);
  if (token !== coachToken || pendingHumanPlayer !== p) return;   // stale

  const toCall = Math.max(0, g.currentBet - p.betThisRound);
  const potOdds = toCall>0 ? toCall/(g.pot + toCall) : 0;

  $('coach-equity').textContent = Math.round(equity*100) + '%';
  $('coach-equity-bar').style.width = Math.round(equity*100) + '%';
  if (toCall>0){
    $('coach-odds').textContent = Math.round(potOdds*100) + '%';
    $('coach-odds').classList.remove('dim');
    $('coach-odds-bar').style.width = Math.round(potOdds*100) + '%';
  } else {
    $('coach-odds').textContent = 'No bet';
    $('coach-odds').classList.add('dim');
    $('coach-odds-bar').style.width = '0%';
  }

  let rec, cls, note;
  const oppWord = numOpp === 1 ? 'one opponent' : numOpp + ' opponents';
  if (toCall > 0){
    const margin = equity - potOdds;
    if (margin < -0.02){
      rec = 'Fold'; cls = 'rec-fold';
      note = 'Calling ' + toCall.toLocaleString() + ' needs about ' + Math.round(potOdds*100) +
             '% to break even, and this hand is running around ' + Math.round(equity*100) +
             '% against ' + oppWord + '.';
    } else if (equity > 0.72 && p.mayRaise){
      rec = 'Raise'; cls = '';
      note = 'At roughly ' + Math.round(equity*100) + '% against ' + oppWord +
             ', this is ahead often enough that building the pot is the higher-value line.';
    } else {
      rec = 'Call'; cls = 'rec-call';
      note = 'The call needs about ' + Math.round(potOdds*100) + '% and this is running around ' +
             Math.round(equity*100) + '%, so the price is workable' +
             (p.mayRaise ? '' : ' (the short all-in means raising isn\u2019t available here)') + '.';
    }
  } else {
    if (equity > 0.62){
      rec = 'Bet'; cls = '';
      note = 'Around ' + Math.round(equity*100) + '% against ' + oppWord +
             ' — betting here charges the hands still drawing against you.';
    } else {
      rec = 'Check'; cls = 'rec-call';
      note = 'Around ' + Math.round(equity*100) + '% against ' + oppWord +
             ' — checking keeps the pot small while the hand is still marginal.';
    }
  }
  $('coach-rec').textContent = rec;
  $('coach-rec').className = 'coach-rec ' + cls;
  $('coach-note').textContent = note;

  // ---- drawing guidance ----
  const drawEl = $('coach-draw'), watchEl = $('coach-watch');
  const draws = detectDraws(p.hand, g.board);
  const outsInfo = computeOuts(p.hand, g.board);
  const cardsToCome = g.board.length === 3 ? 2 : (g.board.length === 4 ? 1 : 0);
  const pct = n => Math.min(95, Math.round(n * (cardsToCome === 2 ? 4 : 2)));

  if (cardsToCome > 0 && draws.length){
    // the odds quote the specific draw, not every card that changes your hand
    const lead = draws.reduce((a,b)=> b.outs > a.outs ? b : a);
    const others = draws.filter(d=>d !== lead);
    let txt = 'You have ' + lead.text + '.';
    if (others.length) txt += ' You also hold ' + others.map(d=>d.text.split(' — ')[0]).join(' and ') + '.';
    txt += ' That is ' + lead.outs + ' clean outs — roughly ' + pct(lead.outs) + '% to complete it by the river' +
           (others.length ? ', a little more once the other draw is counted.' : '.');
    $('coach-draw-text').textContent = txt;
    drawEl.classList.remove('hidden');
  } else if (cardsToCome > 0 && outsInfo.outs > 0){
    $('coach-draw-text').textContent =
      outsInfo.outs + ' card' + (outsInfo.outs===1?'':'s') + ' would improve your hand — about ' +
      pct(outsInfo.outs) + '% to improve by the river.';
    drawEl.classList.remove('hidden');
  } else drawEl.classList.add('hidden');

  // ---- board threats ----
  const threats = boardThreats(g.board);
  if (threats.length){
    $('coach-watch-text').textContent = threats.slice(0, 2).join('; ') + '.';
    watchEl.classList.remove('hidden');
  } else watchEl.classList.add('hidden');
}

/* ============================================================
   RENDER
   ============================================================ */
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function seatPosition(seatIdx, total){
  if (seatIdx===0) return {left:'50%', top:'86%'};
  const k = total-1, i = seatIdx-1;
  const rx = 42, ry = k>=6 ? 37 : k===5 ? 42 : 32;
  const baseline = 38;
  if (k===1) return { left:'50%', top:(baseline-ry-4)+'%' };

  /* Seats are tall and narrow, so collision risk is fundamentally an X-axis
     problem. Spacing evenly in X (deriving Y from the ellipse) fixes the old
     arc-length approach's crowding at the flat sides — but 7-8 seats still
     don't fit in a single horizontal band at phone width. For those, seats
     alternate between two vertical tracks (a light zigzag): neighbors on the
     same track get double the effective X spacing, and cross-track neighbors
     are separated enough in Y that their tall boxes clear each other even
     when close in X. */
  const xSpreadFrac = k<=2 ? 0.62 : k===3 ? 0.66 : k===4 ? 0.86 : k===5 ? 0.85 : k===7 ? 0.97 : 1.0;
  const xMax = rx*xSpreadFrac;
  const x = -xMax + (2*xMax) * (i/(k-1));
  const left = 50 + x;

  // Shipped 4-opponent case: a hand-tuned shallow horseshoe instead of the
  // generic ellipse. The ellipse formula put outer seats (i=0,3) at
  // top≈21.7% vs inner seats (i=1,2) at top≈7.3% — a 14.3pt gap that reads
  // as "two seats up top, two seats noticeably lower" rather than a
  // horseshoe. This lookup narrows that gap directly; xSpreadFrac/left
  // above (horizontal, collision-avoidance-tuned) are untouched — this is
  // a vertical-only change. Starting values per the UI cleanup plan;
  // re-tune visually against the final seat-card footprint if needed.
  if (k===4){
    const top4 = (i===0 || i===3) ? 12 : 7;
    return { left: Math.max(9, Math.min(91, left))+'%', top: top4+'%' };
  }

  const angle = Math.acos(Math.max(-1, Math.min(1, x/rx)));
  let y = -ry*Math.sin(angle);
  if (k>=6) y += (i%2===0) ? (k===8?-25:-19) : (k===8?9:4);
  const top = baseline + y;
  // hard safety clamp: seats must never be able to render past the felt's
  // visible bounds, or (for the zigzagged large-table case) low enough to
  // reach the pot/board area, no matter what the placement math produces
  const maxTop = k>=6 ? 34 : 88;
  return { left: Math.max(9, Math.min(91, left))+'%', top: Math.max(6, Math.min(maxTop, top))+'%' };
}
function cardInner(card){
  return '<div class="ci"><span class="r">'+card.rank+'</span><span class="s">'+card.suit+'</span></div>' +
         '<div class="pip">'+card.suit+'</div>';
}
function cardClass(faceDown, card, small){
  let c = 'card' + (small?' small':'');
  c += faceDown ? ' back' : ' ' + SUIT_CLASS[card.suit];
  return c;
}
function cardLabel(faceDown, card){
  return faceDown ? 'Face-down card' : RANK_WORD[card.value] + ' of ' + SUIT_NAME[card.suit];
}
/* SFX V1 — `kind` ('board'|'hole', default 'hole') only affects the
   community-cards-read-slightly-stronger nuance in Sound.cardFlip(); it
   changes nothing about the actual flip visuals/timing. Sound only ever
   plays for a genuine reveal (!faceDown) — this codebase never actually
   flips a card back to face-down, but the guard costs nothing and keeps
   the contract honest. */
function flipCard(el, faceDown, card, small, kind){
  if (motionOff()){
    el.className = cardClass(faceDown, card, small);
    el.innerHTML = faceDown ? '' : cardInner(card);
    el.setAttribute('aria-label', cardLabel(faceDown, card));
    return;
  }
  if (!faceDown) Sound.cardFlip(kind==='board');
  el.classList.add('flip-out');
  setTimeout(()=>{
    el.className = cardClass(faceDown, card, small) + ' flip-in';
    el.innerHTML = faceDown ? '' : cardInner(card);
    el.setAttribute('aria-label', cardLabel(faceDown, card));
    setTimeout(()=>el.classList.remove('flip-in'), 190);
  }, 130);
}
function syncCardRow(container, cards, faceDownMask, small, kind){
  while (container.children.length > cards.length) container.lastElementChild.remove();
  for (let i=0;i<cards.length;i++){
    const card = cards[i], faceDown = faceDownMask[i];
    const state = faceDown ? 'back' : (card.rank+card.suit);
    let el = container.children[i];
    if (!el){
      el = document.createElement('div');
      el.className = cardClass(faceDown, card, small) + (motionOff()?'':' deal-anim');
      el.dataset.state = state;
      el.setAttribute('role','img');
      el.setAttribute('aria-label', cardLabel(faceDown, card));
      if (!faceDown) el.innerHTML = cardInner(card);
      container.appendChild(el);
    } else if (el.dataset.state !== state){
      flipCard(el, faceDown, card, small, kind);
      el.dataset.state = state;
    }
  }
}

/* ============================================================
   DEAL FX — physical card dealing/collecting, layered purely as a
   visual reaction on top of already-authoritative game state.
   syncCardRow above still owns every card's real content/position and
   its own state diffing; these helpers only control how a card's DOM
   element travels into (and later out of) view. Nothing here reads or
   writes `game`, so a skipped, interrupted, or redundant animation call
   can never duplicate a card or desync the board from the real hand —
   worst case a card just appears/vanishes instantly instead of flying.
   ============================================================ */
/* Every dealing/collecting duration lives here so the feel can be tuned
   from one place without hunting through the choreography functions. */
const DEAL_TIMING = {
  dealMs: 520,                // punchy flick, ~0.5-0.55s target per card, pre-speedMult
  dealStaggerMs: 420,         // near-sequential: next card releases just before/around the previous one landing
  flopStaggerMs: 420,         // same one-at-a-time rhythm for community cards
  settleBeforeFlipMs: 90,
  collectMs: 650,
  collectStaggerMaxMs: 140,   // randomized 0..this per card, for a lively non-uniform return
};

const DealFX = (function(){
  /* Weighted turn count for the END-OF-HAND RETURN only: 1 full rotation
     is the common case, 2 is an occasional flourish, 3 is genuinely rare.
     Always a clean multiple of 360 so the card is visually flat the
     instant it lands. */
  function pickTurns(){
    const r = Math.random();
    const n = r < 0.72 ? 1 : r < 0.97 ? 2 : 3;
    return n * 360 * (Math.random() < 0.5 ? -1 : 1);
  }
  /* Weighted spin for DEALT cards: a genuine full/half/double rotation
     around the card's exact centre (`.fly-card`'s transform-origin is
     50% 50%, not a corner — pivoting off-centre is what made rotation
     swing the card's visual centre in an arc instead of spinning in
     place). `peakDeg` is how far the card visibly spins during the fast
     part of the flight (accelerate+travel) — this is the number that
     actually differentiates "180" (a quick, light flick — most of its
     motion happens in the FAST phase, covering only a half-turn) from
     "360" (a full turn already complete by the time it's decelerating)
     from "720" (two full turns, a rarer flourish). `landDeg` is always
     the nearest clean multiple of 360, so every card is genuinely flat
     the instant it lands: for 180 that means the deceleration stage
     keeps rotating the SAME direction through the remaining half-turn
     (interpolated smoothly as part of that stage's own easing, not a
     separate snap) rather than reversing; for 360/720, landDeg equals
     peakDeg already, so the deceleration stage adds no extra rotation. */
  function pickSpin(){
    const r = Math.random();
    if (r < 0.60) return { peakDeg: 360, landDeg: 360 };
    if (r < 0.90) return { peakDeg: 180, landDeg: 360 };
    return { peakDeg: 720, landDeg: 720 };
  }

  /* Spawns a card-back ghost that starts as an EXACT pixel match
     (position + size, via getBoundingClientRect on both ends) of
     `fromEl` — on frame one it IS the source card, not a lookalike spawned
     nearby. It then runs a short chain of CSS transitions (the same
     chained setTimeout/style.transition technique flyChip() already
     uses for its chip toss, just with more stages) that together read as
     one continuous physical motion, travelling in a TRUE STRAIGHT LINE
     (the ghost's centre moves directly from origin to destination — no
     lateral arc/bulge) while it spins around its own centre:
       deal   — very brief release (still "attached") → sharp acceleration
                → fast confident travel → rapid deceleration into a crisp,
                flat landing. A wrist flick, not a frisbee.
       return — a brief tug toward the deck → an accelerating straight
                pull, spinning several turns → a firm landing exactly at
                the deck, fading out in that same final stage so nothing
                lingers at the destination.
     Scale is interpolated alongside translate/rotate, since origin and
     destination card sizes can legitimately differ (the deck's stack vs.
     a hole card).
     Deal ghosts are appended to document.body (position:fixed, high
     z-index) so they're clearly visible travelling across the felt.
     Return ghosts are appended to #felt instead (position:absolute) — see
     .fly-card.return in CSS for why: #app is itself position:fixed and so
     establishes its own stacking context, which means a body-level sibling
     can NEVER be placed behind anything inside #app by z-index alone, no
     matter how low. Reparenting the return ghost into #felt puts it in
     the SAME local stacking context as .dealer-deck, so a lower z-index
     there genuinely means "behind the deck." This was the actual bug
     behind cards appearing to queue near the deck instead of merging into
     it — not the flight curve or transform-origin (those were real fixes
     for real problems, but not this one). */
  function flyGhost(fromEl, toEl, opts){
    opts = opts || {};
    if (motionOff() || !fromEl || !toEl) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();

    const isReturn = opts.style === 'return';
    const felt = isReturn ? $('felt') : null;
    const container = felt || document.body;

    const ghost = document.createElement('div');
    ghost.className = 'card back fly-card' + (isReturn ? ' return' : '');
    if (felt){
      const cRect = felt.getBoundingClientRect();
      ghost.style.left = (a.left - cRect.left) + 'px';
      ghost.style.top = (a.top - cRect.top) + 'px';
    } else {
      ghost.style.left = a.left + 'px';
      ghost.style.top = a.top + 'px';
    }
    ghost.style.width = a.width + 'px';
    ghost.style.height = a.height + 'px';
    container.appendChild(ghost);

    const dx = b.left - a.left, dy = b.top - a.top;
    const sx = b.width / a.width, sy = b.height / a.height;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;      // unit vector, for the small release/tug nudge
    const dur = Math.round((opts.duration || DEAL_TIMING.dealMs) * speedMult());

    // A waypoint at fraction `distT` straight along the line from origin to
    // destination — no lateral offset — with rotation at an explicit
    // `rotDeg` and scale interpolated the same way as position. (Delta
    // math here is viewport-pixel-equivalent regardless of which
    // container the ghost lives in, since translate() is an offset, not
    // an absolute position — only the ghost's own untransformed left/top,
    // set above, needs to already be correct for that container.)
    function waypoint(distT, rotDeg){
      const sxT = 1 + (sx-1)*distT, syT = 1 + (sy-1)*distT;
      return 'translate('+(dx*distT)+'px,'+(dy*distT)+'px) scale('+sxT+','+syT+') rotate('+rotDeg+'deg)';
    }
    function nudgeTo(px){
      return 'translate('+(ux*px)+'px,'+(uy*px)+'px) scale(1,1) rotate(0deg)';
    }

    let stages;
    if (isReturn){
      const turns = opts.rotate != null ? opts.rotate : pickTurns();
      stages = [
        { t: nudgeTo(Math.min(6, dist*0.25)), frac:.10, ease:'cubic-bezier(.6,0,.9,.2)' },     // tug
        { t: waypoint(.55, turns*.55),        frac:.35, ease:'cubic-bezier(.55,0,.85,.35)' },  // accelerating pull
        { t: waypoint(1, turns),              frac:.55, ease:'cubic-bezier(.25,.4,.4,1)', fadeTo:0 }, // final approach — behind the deck, fading to gone in the same motion
      ];
    } else {
      const spin = opts.rotate != null
        ? { peakDeg: opts.rotate, landDeg: Math.ceil(opts.rotate/360)*360 || 360 }
        : pickSpin();
      const dir = Math.random() < 0.5 ? 1 : -1;
      stages = [
        { t: nudgeTo(Math.min(2, dist*0.10)),      frac:.05, ease:'cubic-bezier(.5,0,.85,.2)' },    // release — very brief, still attached
        { t: waypoint(.30, dir*spin.peakDeg*0.55), frac:.15, ease:'cubic-bezier(.15,.05,.25,.55)' }, // sharp acceleration
        { t: waypoint(.90, dir*spin.peakDeg),      frac:.45, ease:'cubic-bezier(.3,0,.5,1)' },       // fast confident travel — reaches the named spin checkpoint
        { t: waypoint(1, dir*spin.landDeg),        frac:.35, ease:'cubic-bezier(.1,.7,.2,1)' },      // decisive stop — resolves to a clean, flat landing
      ];
    }

    ghost.style.transform = 'translate(0,0) scale(1,1) rotate(0deg)';
    void ghost.offsetWidth;

    return new Promise(resolve=>{
      const run = (i)=>{
        if (i >= stages.length){ ghost.remove(); resolve(); return; }
        const s = stages[i];
        const stageDur = Math.max(1, Math.round(dur * s.frac));
        let transition = 'transform '+stageDur+'ms '+s.ease;
        if (s.fadeTo != null) transition += ', opacity '+stageDur+'ms '+s.ease;
        ghost.style.transition = transition;
        ghost.style.transform = s.t;
        if (s.fadeTo != null) ghost.style.opacity = String(s.fadeTo);
        setTimeout(()=>run(i+1), stageDur);
      };
      run(0);
    });
  }
  return { flyGhost };
})();

/* One dealt card's full choreography: hide the real (already
   state-correct) element, fly a matching ghost from the dealer deck to
   it, reveal it in place, then — unless deferred — flip it face-up a
   beat after landing if its true target state is face-up. The element's
   dataset.state is never touched here (syncCardRow already set it to
   the correct final value when it created the element), so a render()
   firing mid-flight always sees consistent state and safely no-ops. */
async function dealCardFlight(el, card, opts){
  opts = opts || {};
  const deck = $('dealer-deck');
  const deckTop = deck && deck.lastElementChild;   // the visible top card, not the wrapper
  if (!el) return;
  const small = el.classList.contains('small');
  if (motionOff() || !deckTop){ el.style.opacity = ''; return; }
  const wasFaceUp = !el.classList.contains('back');
  if (wasFaceUp){
    // travels as a back regardless of its eventual face; dataset.state
    // already holds the true final value and is left untouched
    el.className = cardClass(true, card, small);
    el.innerHTML = '';
  }
  el.style.opacity = '0';
  Sound.cardDeal();   // FWIP — leaves the dealer deck, right as the flight actually begins
  await DealFX.flyGhost(deckTop, el, { duration:DEAL_TIMING.dealMs, style:'deal' });
  el.style.opacity = '';
  Sound.cardLanded(); // soft PAP/TAK — reaches its destination (fires even for a deferred-flip flop card; the flip's own FWAP comes later)
  if (wasFaceUp && !opts.deferFlip){
    await sleep(Math.round(DEAL_TIMING.settleBeforeFlipMs * speedMult()));
    flipCard(el, false, card, small, opts.board ? 'board' : 'hole');
  }
}
/* Sweeps a card's element back toward the deck's exact top-card spot — a
   tug, then an accelerating magnetic pull, spinning as it goes — fading
   out during its final approach (see flyGhost's return stages) so it's
   gone by the moment it visually reaches the deck, rather than sitting
   fully visible at the destination first. Purely decorative: the real
   element is removed by clearAllCardDOM() shortly after via the existing
   flow. */
function collectCardFlight(el){
  const deck = $('dealer-deck');
  const deckTop = deck && deck.lastElementChild;
  if (!el || motionOff() || !deckTop) return Promise.resolve();
  el.style.opacity = '0';
  // SFX V1 — the one discrete moment this flight actually has: it fades
  // out during its own final approach (see the comment above), so there
  // is no clean separate "arrival" instant to hook a second sound to —
  // muckCards()' own existing random per-card stagger is what turns many
  // of these firing close together into the requested little cascade,
  // not any new timing invented here.
  Sound.cardReturn();
  return DealFX.flyGhost(el, deckTop, { duration:DEAL_TIMING.collectMs, style:'return' });
}

/* ============================================================
   VISUAL CHIPS — decorative only, no monetary meaning (chip
   simplification pass). Poker money (player.chips / game.pot) is the
   sole authority; visible chips are an approximate physical
   representation of it and never have to add up to it exactly.
   ============================================================ */
const CHIP_COLOR_CLASSES = ['d-cream','d-red','d-blue','d-green'];
/* Cycles through the four chip sprites purely for visual variety as a
   pile grows — colour carries no value/denomination meaning. */
function pickChipColor(container){
  const i = (container._chipCount||0) % CHIP_COLOR_CLASSES.length;
  return CHIP_COLOR_CLASSES[i];
}
/* Deterministic, sub-linear mapping from a money amount to an
   approximate number of visual chips — richer piles get proportionally
   MORE money per chip, not proportionally more chips, so a big
   bankroll/pot reads as substantially richer without the pile growing
   without bound. Art-direction targets only, not an accounting rule:
   tiny amounts → 1-3 chips, ~100 → 5-8, ~500 → 15-20, ~1000 → 25-30,
   ~2000 → 35-40, ~4000+ → 45-55 (capped). */
function visualChipCount(amount){
  if (!amount || amount<=0) return 0;
  const anchors = [[0,0],[10,1],[100,6],[500,18],[1000,28],[2000,38],[4000,50]];
  let count;
  if (amount>=4000){
    const slope = (50-38)/(4000-2000);
    count = 50 + (amount-4000)*slope;
  } else {
    count = anchors[anchors.length-1][1];
    for (let i=1;i<anchors.length;i++){
      const [a0,c0]=anchors[i-1], [a1,c1]=anchors[i];
      if (amount<=a1){ const f=(amount-a0)/(a1-a0); count = c0 + f*(c1-c0); break; }
    }
  }
  return Math.max(1, Math.min(60, Math.round(count)));
}

/* ---- physical pile state --------------------------------------------
   Piles used to be pure functions of their chip count: fully rebuilt
   (innerHTML='') on every render() call whenever that count OR the
   pile's authoritative money value changed. Money updates the instant a
   bet is committed — well before the chips have visually finished
   travelling — so that rebuild fired mid-flight and replayed every
   chip's pop-in animation at once, reading as the whole pile flashing.
   Piles are grown/shrunk incrementally, one chip element at a time, by
   exactly however much `shown` actually moved since the last sync — an
   already-settled chip is never touched, so nothing about it can flash.
   Each chip is also permanently assigned to a slot in a fixed grid (see
   buildPileGrid/buildSlotCaps below) rather than towers being
   recomputed from the current count, so growing/shrinking a pile never
   reshuffles which chips are where — a tower only ever gains or loses a
   chip at its own top, exactly like a real one. Colour is picked fresh
   per chip purely for visual variety (see pickChipColor) — no slot is
   locked to a colour, since colour carries no value/denomination
   meaning any more. */

/* ---- pile geometry: a small grid of physically non-overlapping slots --
   A pile is a front row of columns spaced at least one chip-diameter
   apart (so same-row towers can never touch or intersect), plus a second
   row nestled in the gaps between them for depth — offset up and behind,
   and painted at a lower z-index so a front tower can plausibly occlude
   a back one without ever fusing together. This is pure geometry (WHERE
   a chip sits); it knows nothing about colour — every slot can hold any
   colour, picked fresh per chip for visual variety. */
function buildPileGrid(w, h, diam, overlapStep, opts){
  opts = opts || {};
  // `inset` shrinks the usable region on both sides before any column
  // math happens — a small deliberate safety margin so the result stays
  // inside its box even if the live measurement feeding `w` is ever
  // slightly optimistic (font metrics, device pixel rounding, etc).
  const inset = opts.inset != null ? opts.inset : 0;
  const usableW = Math.max(diam, w - inset*2);
  const gap = opts.gap != null ? opts.gap : 3;
  const spacing = diam + gap;
  const cols = Math.max(1, Math.min(opts.maxCols || 4, Math.floor(usableW / spacing)));
  const rowSpan = cols * spacing;
  // Centre-x of the first column. Slot x values below convert this to a
  // CSS left-edge (subtracting diam/2) — a tower's rendered box is
  // exactly `diam` wide (it shrinks to its chip-disc children's width),
  // so `left:Xpx` places its LEFT edge at X, not its centre; storing the
  // already-converted left-edge here means every consumer of `slots` just
  // uses `.left = x + 'px'` directly with no risk of re-introducing that
  // half-chip-width offset (which is what let towers hang off the right
  // edge in the first place).
  const centerStartX = inset + Math.max(diam/2, (usableW - rowSpan)/2 + spacing/2);
  const backDx = spacing / 2;
  const backDy = opts.backDy != null ? opts.backDy : 6;
  const maxPerSlot = Math.max(2, Math.min(opts.maxPerSlot || 9, Math.floor((h - diam) / overlapStep) + 1));
  const slots = [];
  // `col`/`row` (0=front,1=back) identify each slot's position within its
  // own row independent of its pixel x — buildMoundCaps uses these to
  // taper stack heights by distance from each row's own centre column
  // without caring about the underlying pixel geometry at all.
  //
  // x is rounded to a whole CSS px here (not left as a fractional value
  // like 16.5px). Two adjacent slots share the same fractional offset
  // from centerStartX/backDx, so rounding both the same way preserves
  // the gap between them exactly — but leaving it fractional invited a
  // browser to round each tower's `left` independently at paint time
  // (device-pixel snapping), which could silently shrink a nominal 3px
  // gap by up to a device pixel or two. Whole numbers also match the
  // pixel-art/`image-rendering:pixelated` intent everywhere else here.
  for (let c=0; c<cols; c++) slots.push({ x: Math.round(centerStartX + c*spacing - diam/2), y:0, z:4, row:0, col:c });
  const backCols = Math.max(0, cols - 1);
  for (let c=0; c<backCols; c++) slots.push({ x: Math.round(centerStartX + backDx + c*spacing - diam/2), y: backDy, z:2, row:1, col:c });
  // Optional 3rd depth row (bank only, opts.extraRow) — same x pattern
  // and column count as the back row (still nested safely between front
  // columns, so the earlier containment proof still holds), just offset
  // further up/back and painted even further behind. Exists purely to
  // give the bank's tiny 2-front-column box an extra physical slot to
  // spread a large visual chip count into — the caller is responsible
  // for reducing `h` before calling this when
  // extraRow is set, so maxPerSlot already accounts for this row's chips
  // starting `backDy` px higher than the back row (see bankPile()).
  const extraCols = opts.extraRow ? backCols : 0;
  for (let c=0; c<extraCols; c++) slots.push({ x: Math.round(centerStartX + backDx + c*spacing - diam/2), y: backDy*2, z:1, row:2, col:c });
  return { slots, maxPerSlot, frontCols:cols, backCols, extraCols };
}
/* Per-slot height ceiling + fill/drain priority for a grid. `order` is
   the sequence slots are visited in when a NEW (currently-empty) slot
   needs to be started — sequential left-to-right for the bank. `caps`
   is a flat maxPerSlot for every slot (no taper — the bank is a plain
   compact heap, not a mound). Both are consumed by claimDestSlot/
   takeChipFromPile, which pick a slot dynamically at add/remove time based
   on each tower's CURRENT live height (read straight from the DOM) —
   never from a precomputed "chip #12 always goes here" sequence — so a
   chip always joins whatever's already the shortest eligible tower
   instead of ever starting (or being left behind as) a lone single. */
function buildSlotCaps(numSlots, maxPerSlot){
  const caps = new Array(numSlots).fill(maxPerSlot);
  const order = []; for (let i=0;i<numSlots;i++) order.push(i);
  return { caps, order };
}
/* Pot-only version: a "wonky pyramid" instead of the bank's flat heap.
   Each slot's cap tapers from a tall centre column down to shorter ones
   at the edges of its own row (front row tallest overall, back row
   scaled down a notch — sitting slightly behind reads as slightly lower
   too), with a small per-slot jitter so it isn't a perfectly symmetrical
   mound. `order` visits slots centre-out (front row before back row at
   the same distance), so a new stack only ever starts next-nearest to
   the middle, and — combined with claimDestSlot always preferring to
   extend whatever's already shortest-but-still-under-its-own-cap —
   chips build up the centre first and only spread outward once it's
   substantial, exactly like a real mound getting built up. */
function buildMoundCaps(grid, opts){
  opts = opts || {};
  const baseFront = opts.baseFront != null ? opts.baseFront : grid.maxPerSlot;
  const edgeFront  = opts.edgeFront  != null ? opts.edgeFront  : Math.max(2, Math.round(grid.maxPerSlot*0.45));
  const backScale  = opts.backScale  != null ? opts.backScale  : 0.7;
  let s = (opts.seed || 1) >>> 0;
  const rnd = ()=>{ s = (s*1103515245 + 12345) >>> 0; return (s >>> 8) / 0x1000000; };
  const frontCenter = (grid.frontCols - 1) / 2;
  const backCenter  = (grid.backCols  - 1) / 2;
  const centerOf = slot => slot.row===0 ? frontCenter : backCenter;
  const distOf = slot => {
    const c = centerOf(slot), maxDist = Math.max(1, c);
    return Math.abs(slot.col - c) / maxDist;
  };
  const caps = grid.slots.map(slot=>{
    const dist = distOf(slot);
    const base = slot.row===0 ? baseFront : Math.round(baseFront*backScale);
    const edge = slot.row===0 ? edgeFront : Math.max(2, Math.round(edgeFront*backScale));
    const h = Math.round(base - (base-edge)*dist);
    const jitter = Math.floor(rnd()*3) - 1; // -1, 0 or +1 — mild asymmetry
    return Math.max(2, Math.min(grid.maxPerSlot, h+jitter));
  });
  const order = grid.slots.map((_,i)=>i).sort((a,b)=>{
    const da = distOf(grid.slots[a]), db = distOf(grid.slots[b]);
    return da!==db ? da-db : grid.slots[a].row - grid.slots[b].row;
  });
  return { caps, order };
}
/* The real inner content box of a DOM element (clientWidth/Height minus
   its own padding) — used so the bank's grid is sized against the
   recessed compartment's actual rendered area rather than a guessed
   constant. Falls back to a known-good size if the element isn't laid
   out yet (e.g. measured before the table screen is first shown). */
function measureInner(el, fallbackW, fallbackH){
  if (!el) return { w: fallbackW, h: fallbackH };
  const cs = getComputedStyle(el);
  const w = el.clientWidth  - parseFloat(cs.paddingLeft||0)  - parseFloat(cs.paddingRight||0);
  const h = el.clientHeight - parseFloat(cs.paddingTop||0)   - parseFloat(cs.paddingBottom||0);
  return { w: w>0 ? w : fallbackW, h: h>0 ? h : fallbackH };
}
const BANK_CHIP_DIAM = 21, BANK_OVERLAP_STEP = 8;   // matches #hud-tower .chip-disc (21px, margin-top:-13px)
const POT_CHIP_DIAM  = 25, POT_OVERLAP_STEP  = 9;   // matches .chip-clump .chip-disc (25px, margin-top:-16px)
/* Genuine maximum stack height (in chips) for a tower rendered inside an
   `innerHeight`-px-tall area: how many `chipHeight`-tall, `overlapStep`-
   px-apart chips actually fit between a `topInset`/`bottomInset` safety
   margin, NOT a raw chip-count guess. First chip always fits fully
   (chipHeight); every additional one only needs `overlapStep` more px
   (that's the whole point of the negative-margin overlap). */
function maxStackHeightFor(innerHeight, chipHeight, overlapStep, topInset, bottomInset){
  const usable = innerHeight - topInset - bottomInset;
  if (usable < chipHeight) return 1;
  return 1 + Math.floor((usable - chipHeight) / overlapStep);
}
/* Live gap (px) between the board's bottom edge and the pot plate's
   current top edge — the actual room this table layout leaves for the
   mound to grow upward before it would visually reach the community
   cards. A real measurement, not a guessed constant, taken once before
   the pot pile ever grows tall (pot-stacks starts at its default tiny
   size, so this reads the NATURAL gap, not one already inflated by a
   previous measurement). Falls back to a conservative constant if
   either element isn't laid out yet. */
function measurePotHeadroom(fallback){
  const board = $('board'), potArea = $('pot-area');
  if (!board || !potArea) return fallback;
  const boardRect = board.getBoundingClientRect();
  const potRect = potArea.getBoundingClientRect();
  if (!boardRect.height || !potRect.height) return fallback;
  const gap = potRect.top - boardRect.bottom;
  // Reserve room for the pot-chip label (and the gap above the mound)
  // that also lives inside .pot-area above .pot-stacks, plus a generous
  // safety margin before the boundary itself — Juice Pass 2C.2
  // deliberately prefers a visibly lower mound over using every
  // technically-available pixel.
  return gap>0 ? Math.max(45, Math.min(fallback, gap - 56)) : fallback;
}

/* Built lazily (needs the real DOM) and cached — the bank compartment is
   a fixed-width HUD grid column, so one real measurement is as good as a
   thousand; recomputing on every render would risk the pile visibly
   reshuffling, which is explicitly not wanted.
   Juice Pass 2C.1: maxPerSlot is a genuine geometry calculation
   (maxStackHeightFor), hard-capped at 14 — "the recessed bank box is a
   hard physical container". A 3rd depth row (extraRow) gives the bank 4
   physical slots (2 front + 1 back + 1 further back) instead of 3,
   giving a large bankroll's visual chip count more room to spread out
   without needing a taller single tower; it reuses the back row's
   proven-safe x positions (only y/z differ), and the height budget fed
   into maxStackHeightFor is reduced by this row's own extra y-offset up
   front, so even its higher-starting chips can't out-grow the box.
   Juice Pass 2C.2: the rendered chip shrank ~11% (BANK_CHIP_DIAM
   24→21px), which — at the still-mandatory exact 3px gap — is enough
   for a 3rd FRONT column to legitimately fit the same measured width
   that only fit 2 before (see buildPileGrid's own floor(usableW/
   spacing) — this isn't a hardcoded redesign, maxCols:3 is just the new
   ceiling and the real math still decides what actually fits). More
   columns to spread real breathing room across, not a deeper single
   tower. */
let _bankPile = null;
function bankPile(){
  if (_bankPile) return _bankPile;
  const area = measureInner($('hud-left'), 84, 130);
  const backDy = 6;
  const effectiveH = area.h - backDy*2; // worst case: the extra row's own headroom
  const maxPerSlot = Math.min(14, maxStackHeightFor(effectiveH, BANK_CHIP_DIAM, BANK_OVERLAP_STEP, 4, 4));
  const grid = buildPileGrid(area.w, area.h, BANK_CHIP_DIAM, BANK_OVERLAP_STEP, { maxCols:3, backDy, gap:3, inset:3, maxPerSlot, extraRow:true });
  const { caps, order } = buildSlotCaps(grid.slots.length, grid.maxPerSlot);
  const tower = $('hud-tower');
  // #hud-tower gets an explicit box matching the measured area so the
  // absolutely-positioned towers inside it have a real coordinate space
  // to sit in — #hud-left's own overflow:hidden (see CSS) is the hard
  // backstop that guarantees nothing can render past its border even if
  // this measurement is ever imperfect.
  if (tower){ tower.style.width = area.w+'px'; tower.style.height = area.h+'px'; }
  _bankPile = { grid, caps, order, cap: grid.slots.length*grid.maxPerSlot };
  return _bankPile;
}
/* The pot floats on open felt with no hard edge to measure horizontally,
   so its WIDTH still gets a fixed compact-but-roomy budget — "a broad
   mound", and per this pass, SIGNIFICANTLY more horizontal/depth slots
   than the bank (maxCols:9 here vs the bank's 3 — up from 7 last pass,
   both because the felt has the room and because the smaller chip
   (POT_CHIP_DIAM 28→25px) fits more columns in the same budget). Its
   HEIGHT comes from a genuine measurement (measurePotHeadroom): the pot
   must never grow tall enough to visually reach the community cards, so
   maxPerSlot is derived from the real live gap between the board and
   the pot plate, hard-capped at 16 (down from 20 — Juice Pass 2C.2
   deliberately lowers the PRACTICAL ceiling, not just the hard one).
   Uses buildMoundCaps (not buildSlotCaps) so the pile still reads as a
   wonky pyramid — tall centre, tapering to shorter edge/back stacks —
   but with explicit baseFront/edgeFront overrides well below
   maxPerSlot's own ceiling (see the call below) so even the CENTRE
   column only grows to a moderate height before claimDestSlot's normal
   "extend shortest, else start the next slot" logic is forced to open a
   neighbouring stack — width before height — with the hard ceiling only
   ever used as an absolute last resort once every slot is already at
   its own (lower) preferred cap. */
let _potPile = null;
function potPile(){
  if (_potPile) return _potPile;
  const potW = 260;
  const potH = measurePotHeadroom(100);
  const maxPerSlot = Math.min(16, maxStackHeightFor(potH, POT_CHIP_DIAM, POT_OVERLAP_STEP, 4, 6));
  const grid = buildPileGrid(potW, potH, POT_CHIP_DIAM, POT_OVERLAP_STEP, { maxCols:9, backDy:8, gap:3, maxPerSlot });
  // Preferred (not hard) centre/edge heights — deliberately well under
  // maxPerSlot so the mound spreads wide long before any tower nears the
  // real ceiling. The edge:centre RATIO is also closer to 1 than before
  // (edge is ~73% of centre height, was 45%) — a gentler falloff so the
  // difference between neighbouring stacks is gradual, avoiding one or
  // two dominant "skyscraper" columns against everything else short.
  const { caps, order } = buildMoundCaps(grid, {
    seed:9137,
    baseFront: Math.max(3, Math.round(maxPerSlot*0.55)),
    edgeFront: Math.max(2, Math.round(maxPerSlot*0.40))
  });
  const stacks = $('pot-stacks');
  if (stacks){ stacks.style.width = potW+'px'; stacks.style.height = potH+'px'; }
  _potPile = { grid, caps, order, cap: grid.slots.length*grid.maxPerSlot };
  return _potPile;
}

/* Live height of a tower, read straight from the DOM rather than kept as
   separate bookkeeping — there's exactly one source of truth for "how
   tall is this stack" (its actual child count). Includes reserved
   placeholders (see claimDestSlot) as well as real chips — see
   realTowerHeight below for the real-chips-only count. */
function towerHeight(container, slotIdx){
  const t = container._towers && container._towers[slotIdx];
  return t ? t.children.length : 0;
}
/* Ensures a pile's tower DOM element for `slotIdx` exists (creating and
   positioning it at its fixed grid slot on first use) and returns it.
   Pure geometry/DOM-scaffolding, no chip content. */
function getOrCreateTower(container, pile, slotIdx){
  if (!container._towers) container._towers = {};
  let tower = container._towers[slotIdx];
  if (!tower){
    tower = document.createElement('div');
    tower.className = 'chip-clump';
    const slot = pile.grid.slots[slotIdx];
    tower.style.left = slot.x + 'px';
    tower.style.bottom = slot.y + 'px';
    tower.style.zIndex = String(slot.z);
    container._towers[slotIdx] = tower;
    container.appendChild(tower);
  }
  return tower;
}
/* Real (non-placeholder) height of a tower — how many chips are actually
   resting there right now, excluding reserved-but-not-yet-landed
   placeholders (see claimDestSlot). Used when TAKING a chip from a pile,
   so a slot that's merely reserved (not yet arrived) is never mistaken
   for a source of a real chip to pluck. */
function realTowerHeight(container, slotIdx){
  const t = container._towers && container._towers[slotIdx];
  if (!t) return 0;
  let n = 0;
  for (const c of t.children) if (c.style.visibility !== 'hidden') n++;
  return n;
}
/* Same 3-tier slot-choice priority Pass 3A's pileAddChip always used
   (extend shortest under cap -> next empty slot -> grow shortest to hard
   cap), reading towerHeight (which already includes any reserved
   placeholders below — see claimDestSlot). Picks a slot, then — Pass
   3C.1 — immediately inserts a real, invisible `.chip-disc` placeholder
   into that slot's tower rather than bumping an integer tally. Because
   it's a genuine DOM child sharing the exact same box-model rules as a
   real chip, three things follow for free: every later towerHeight()
   read (including other concurrent claims on the same pile) already sees
   this reservation as real height; the placeholder's own
   getBoundingClientRect() IS this chip's true final resting box, laid
   out by the browser exactly as it will be once the real chip takes its
   place — not a guessed one; and because nothing else can alter that box
   between reservation and landing (the placeholder physically holds the
   space the whole time), measuring it at launch and again right before
   landing (see flyChip) is guaranteed to agree. Caller must eventually
   call settleSlot() to swap the placeholder for the real element. */
function claimDestSlot(container, pile){
  let slotIdx=-1, best=Infinity;
  pile.order.forEach(idx=>{
    const h = towerHeight(container, idx);
    if (h>0 && h<pile.caps[idx] && h<best){ best=h; slotIdx=idx; }
  });
  if (slotIdx===-1){
    const found = pile.order.find(idx=>towerHeight(container, idx)===0);
    if (found!=null) slotIdx = found;
  }
  if (slotIdx===-1){
    best=Infinity;
    pile.order.forEach(idx=>{
      const h = towerHeight(container, idx);
      if (h<pile.grid.maxPerSlot && h<best){ best=h; slotIdx=idx; }
    });
  }
  if (slotIdx===-1) slotIdx = pile.order[0]; // defensive: every slot already at absolute capacity
  const tower = getOrCreateTower(container, pile, slotIdx);
  const placeholder = document.createElement('div');
  placeholder.className = 'chip-disc';
  placeholder.style.visibility = 'hidden';
  tower.appendChild(placeholder);
  return { slotIdx, tower, placeholder };
}
/* Swaps a reserved placeholder for the real chip element in the exact
   DOM position it already occupied — a plain in-place replace, not a
   re-layout, since the placeholder's box already IS the chip's rect. */
function settleSlot(container, placeholder, el){
  placeholder.replaceWith(el);
  container._chipCount = (container._chipCount||0) + 1;
}
/* Removes and returns the REAL DOM chip element (plus its exact
   on-screen rect just before removal) that should physically depart a
   pile next: always the shortest currently-resting tower's top REAL chip
   — same "no stray singles" priority Pass 3A's pileRemoveChip always
   used (using realTowerHeight so a slot that's only holding a reserved
   placeholder is never treated as a source). Walks back past any
   placeholder sitting above the topmost real chip (possible if this same
   tower is also someone else's reserved destination — never happens for
   an ordinary bet, but flyChip's source/dest roles are generic). Real,
   immediate removal; no reservation bookkeeping needed on the departure
   side, since by the time chip N's departure runs, every earlier chip in
   the same staggered transfer has already been removed for real
   (departures fire in strict launch order). Returns null if the pile has
   no real chip to give. The caller owns the returned element from here
   on — it is never destroyed, only ever moved. */
function takeChipFromPile(container, pile){
  if (!container._towers) return null;
  let slotIdx=-1, best=Infinity;
  pile.order.forEach(idx=>{
    const h = realTowerHeight(container, idx);
    if (h>0 && h<best){ best=h; slotIdx=idx; }
  });
  if (slotIdx===-1) return null;
  const tower = container._towers[slotIdx];
  let el = tower.lastElementChild;
  while (el && el.style.visibility==='hidden') el = el.previousElementSibling;
  if (!el) return null;
  // Pass 3C.4: strip the one-shot bootstrap pop-in class before this chip is
  // ever reparented. CSS Animations tied to a class restart from their
  // `from` keyframe whenever their element is removed from the render tree
  // and reinserted — exactly what reparenting into the flight layer does —
  // and while running, an Animation's value for a property overrides any
  // inline style for that same property. Left in place, `disc-in`
  // (animation:discIn, still matching this element forever since it's never
  // otherwise removed) hijacks `transform` for its own 180ms on every single
  // flight, which is what made chips look like they were fading/scaling in
  // place instead of moving. Safe to strip unconditionally: by the time any
  // chip is ever taken for a flight, its one-time pop-in has already long
  // since played out.
  el.classList.remove('disc-in');
  const rect = el.getBoundingClientRect();
  el.remove();
  container._chipCount = Math.max(0, (container._chipCount||0) - 1);
  return { el, rect };
}
/* Instantly creates and rests a brand-new chip in a pile — no flight, no
   source. Only for moments with genuinely no physical chip to move: cold
   table load, rebuy, save/resume reconstruction, and (see resetPile)
   never for an ordinary bank<->pot transfer, which always moves a real
   existing chip (see flyChip). */
function createRestingChip(container, pile, forcedCls){
  const { placeholder } = claimDestSlot(container, pile);
  const cls = forcedCls || pickChipColor(container);
  const d = document.createElement('div');
  d.className = 'chip-disc ' + cls + (motionOff() ? '' : ' disc-in');
  settleSlot(container, placeholder, d);
  return d;
}
/* Hard-clears a pile back to empty — only for moments with genuinely no
   physical source for the new chips (fresh table/rebuy, or the pot
   boundary between hands — see clearAllCardDOM()). */
function resetPile(container, pile){
  if (!container) return;
  container.innerHTML = '';
  container._chipCount = 0;
  container._towers = {};
}
/* Cold-start/recovery only: populates an EMPTY pile with visualChipCount(amount)
   generic chips. Never used for an ordinary transfer — only table load,
   rebuy, and save/resume reconstruction (render()'s bootstrap check
   gates this to exactly those cases: pending===0 and the pile is
   genuinely empty). */
function bootstrapPile(container, pile, amount){
  const n = visualChipCount(amount);
  for (let i=0;i<n;i++){ createRestingChip(container, pile); }
}
function renderBank(){
  const p = game && game.players.find(x=>x.isHuman);
  const container = $('hud-tower');
  if (!container || !p) return;
  // Empty-pile-only bootstrap (see the big comment on render()'s pot
  // section for why this must never fire on a pile that already has
  // real, transfer-tracked chips in it).
  if (bankPending===0 && (container._chipCount||0)===0 && p.chips>0){
    bootstrapPile(container, bankPile(), p.chips);
  }
}
function renderPot(){
  const g = game;
  const container = $('pot-stacks');
  if (!container || !g) return;
  if (potPending===0 && (container._chipCount||0)===0 && g.pot>0){
    bootstrapPile(container, potPile(), g.pot);
  }
}

/* Vertical fruit-machine reels. Game values change immediately; this one
   display system is shared by the player, opponents, hand investment and
   raise tray. Increases climb and decreases run backwards. */
function setReelRest(cell, ch){
  cell.innerHTML = '<span class="reel-strip" aria-hidden="true"><span>'+esc(ch)+'</span><span>'+esc(ch)+'</span></span>';
  cell.dataset.value = ch;
  cell.classList.remove('rolling-up','rolling-down');
}
function rollReelCell(cell, ch, delay, mine, direction){
  const old = cell.dataset.value == null ? ch : cell.dataset.value;
  clearTimeout(cell._reelStartT); clearTimeout(cell._reelEndT);
  cell.classList.remove('rolling-up','rolling-down');
  const down = direction==='down';
  cell.innerHTML = down
    ? '<span class="reel-strip" aria-hidden="true" style="transform:translateY(-50%)"><span>'+esc(ch)+'</span><span>'+esc(old)+'</span></span>'
    : '<span class="reel-strip" aria-hidden="true"><span>'+esc(old)+'</span><span>'+esc(ch)+'</span></span>';
  cell.dataset.value = ch;
  if (motionOff() || old===ch){ setReelRest(cell,ch); return; }
  cell._reelStartT = setTimeout(()=>{
    void cell.offsetWidth;
    cell.classList.add(down ? 'rolling-down' : 'rolling-up');
    cell._reelEndT = setTimeout(()=>{
      setReelRest(cell,ch);
      Sound.counterTick(!!mine);
    },310);
  },delay||0);
}

function ensureFixedReel(el, digits){
  if (!el) return [];
  let cells = Array.from(el.querySelectorAll('.reel-digit'));
  if (cells.length===digits) return cells;
  cells.forEach(c=>c.remove());
  cells=[];
  for (let i=0;i<digits;i++){
    const c=document.createElement('span');
    c.className='jp-cell jp-digit reel-digit reel-cell tabular';
    setReelRest(c,'0'); el.appendChild(c); cells.push(c);
  }
  el.dataset.reelValue='';
  return cells;
}

/* Compact readouts grow by one physical drum only when the value gains a
   digit. Existing drums stay right-aligned, so the surrounding opponent
   card / HUD column never jumps. */
function ensureDynamicReel(el, digits){
  if (!el) return [];
  let cells=Array.from(el.querySelectorAll('.reel-digit'));
  while (cells.length<digits){
    const c=document.createElement('span');
    c.className='jp-cell jp-digit reel-digit reel-cell tabular reel-added';
    setReelRest(c,'0');
    el.insertBefore(c,cells[0]||null);
    cells.unshift(c);
    if (!motionOff()) setTimeout(()=>c.classList.remove('reel-added'),220);
  }
  while (cells.length>digits){ cells.shift().remove(); }
  el.dataset.reelDigits=String(digits);
  return cells;
}

function updateFixedReel(el, value, options){
  if (!el) return;
  const opts=options||{}, digits=opts.digits||6;
  const amount=Math.max(0,Math.min(Math.pow(10,digits)-1,Math.round(Number(value)||0)));
  const text=String(amount).padStart(digits,'0');
  const previous=Number(el.dataset.reelNumber);
  const direction=Number.isFinite(previous) && amount<previous ? 'down' : 'up';
  const cells=opts.dynamic ? ensureDynamicReel(el,digits) : ensureFixedReel(el,digits);
  const ariaTarget=opts.ariaTarget||el;
  ariaTarget.setAttribute('aria-label',(opts.label||'Amount')+': '+amount.toLocaleString());
  if (el.dataset.reelValue===text) return;
  el.dataset.reelValue=text; el.dataset.reelNumber=String(amount);
  let leading=true, changed=0, lastDelay=0;
  cells.forEach((cell,i)=>{
    const ch=text[i];
    const dim=leading && ch==='0' && i<cells.length-1;
    if (!dim) leading=false;
    cell.classList.toggle('dim',dim);
    if (cell.dataset.value!==ch){
      lastDelay=changed*(opts.cascade==null ? 22 : opts.cascade);
      rollReelCell(cell,ch,lastDelay,!!opts.mine,direction); changed++;
    }
  });
  clearTimeout(el._reelLockT);
  if (changed && !motionOff() && opts.lock){
    el._reelLockT=setTimeout(()=>Sound.counterLock(!!opts.mine),lastDelay+340);
  }
}

function updateCompactReel(el, value, options){
  if (!el) return;
  const amount=Math.max(0,Math.round(Number(value)||0));
  const digits=String(amount).length+1; // one dim "ghost" zero before the live amount
  updateFixedReel(el,amount,{...(options||{}),digits,dynamic:true});
}

/* Player stack: six fixed reels with dim leading zeroes. */
function buildJackpot(){
  const j = $('jackpot'); if (!j) return;
  ensureFixedReel(j,6);
}
function updateJackpot(v){
  const j = $('jackpot'); if (!j) return;
  updateFixedReel(j,v,{label:'Player stack',mine:true,lock:true,cascade:24});
}

/* Opponents show only the live digits plus one dim leading drum. */
function updateSeatReels(el, value){
  if (!el) return;
  el.classList.add('mini-jackpot'); el.setAttribute('role','img');
  if (!el.querySelector('.jp-sym')) el.insertAdjacentHTML('afterbegin','<span class="jp-cell jp-sym">$</span>');
  updateCompactReel(el,value,{label:'Opponent stack',cascade:18});
}

function updateInvestedReel(value){
  const el=$('hud-invested');
  const amount=Math.max(0,Math.round(Number(value)||0));
  if (!el) return;
  el.textContent='$'+String(amount).padStart(3,'0');
  el.setAttribute('aria-label','Bet this hand: '+amount.toLocaleString());
}

function updateRaiseReel(value){
  const outer=$('raise-amt');
  const reels=outer && outer.querySelector('.raise-reels');
  updateFixedReel(reels,value,{label:'Raise to',ariaTarget:outer,mine:true,cascade:14});
}
let raiseReelLastAt=0, raiseReelPendingT=0, raiseReelPendingValue=0;
function queueRaiseReel(value, immediate){
  raiseReelPendingValue=value;
  const now=Date.now(), wait=Math.max(0,62-(now-raiseReelLastAt));
  clearTimeout(raiseReelPendingT);
  if (immediate || wait===0){
    raiseReelLastAt=now; updateRaiseReel(value); return;
  }
  raiseReelPendingT=setTimeout(()=>{
    raiseReelLastAt=Date.now(); updateRaiseReel(raiseReelPendingValue);
  },wait);
}
function clearAllCardDOM(){
  const board = $('board');
  if (board) board.innerHTML = '';
  resetPile($('pot-stacks'), potPile());
  // A hand boundary can't leave a stale pending count blocking future
  // bootstrap checks — any in-flight pot transfer is visually done by now.
  potPending = 0;
  Object.values(seatEls).forEach(e=>{
    e.cardsContainer.innerHTML = '';
    e.root.classList.remove('winner', 'winner-pulse');
    e.bubble.classList.remove('show');
  });
  const frame = $('hud-frame');
  if (frame) frame.classList.remove('hud-frame-win', 'hud-frame-win-flash');
}
async function muckCards(){
  if (motionOff()) return;
  const all = [];
  const board = $('board');
  if (board) all.push(...board.children);
  Object.values(seatEls).forEach(e=>all.push(...e.cardsContainer.children));
  if (!all.length) return;
  // sweep every live card back toward the deck at once, with a small random
  // per-card stagger so the return feels lively rather than perfectly uniform
  await Promise.all(all.map(async el=>{
    await sleep(Math.random() * DEAL_TIMING.collectStaggerMaxMs * speedMult());
    await collectCardFlight(el);
  }));
  Sound.deckSettle(); // the cascade's own capstone, once every card has genuinely finished returning
}

function initSeats(){
  const felt = $('felt');
  const hudMid = $('hud-mid');
  felt.querySelectorAll('.seat').forEach(el=>el.remove());
  if (hudMid) hudMid.querySelectorAll('.seat').forEach(el=>el.remove());
  seatEls = {};
  const n = game.players.length;
  const opponents = n - 1;

  // tuned for the 4-opponent portrait table, boxed layout — the box needs
  // interior room for two small cards side by side, so seats are a touch
  // wider than the old totem version; then the old shrink curve for bigger
  // fields (functional but untuned since we're only shipping 4-max for now)
  const scale = opponents<=3 ? 1.0 : opponents===4 ? 0.88 : opponents===5 ? 0.8 : opponents===6 ? 0.7 : opponents===7 ? 0.6 : 0.52;
  felt.style.setProperty('--seat-w', Math.round(98*scale)+'px');
  // the face is a portrait inside the box now, not the block itself — it
  // grows faster than the seat box so it reads as the panel's focal point.
  // Sized to roughly match the width of the three-heart row above it.
  felt.style.setProperty('--avatar-w', Math.round(78*scale)+'px');
  felt.style.setProperty('--card-h', Math.round(48*scale)+'px');
  felt.classList.add('compact-seats');

  game.players.forEach((p, idx)=>{
    const root = document.createElement('div');
    root.className = 'seat' + (p.isHuman ? ' you' : '');
    if (!p.isHuman){
      const pos = seatPosition(idx, n);
      root.style.left = pos.left;
      root.style.top = pos.top;
    }
    const initials = p.isHuman
      ? (p.name.trim().slice(0,2).toUpperCase() || 'YO')
      : p.name.split(' ').filter(w=>w!=='The').map(w=>w[0]).slice(0,2).join('');
    if (p.isHuman){
      // the human seat carries only the cards + action bubble; everything
      // else (tower, jackpot, hearts, plates, action-slot) lives in the
      // static HUD frame. Hidden stubs keep every generic seatEls hook
      // resolvable.
      root.innerHTML =
        '<div class="avatar-wrap hidden"><div class="turn-ring"></div><div class="avatar">'+esc(initials)+'</div></div>' +
        '<span class="seat-chips hidden"></span>' +
        '<div class="chip-stack hidden" aria-hidden="true"></div>' +
        '<div class="seat-cards"></div>' +
        '<div class="action-bubble"></div>';
    } else {
      // one bordered box per opponent: name, hearts, face, chips, fixed
      // action-slot and protruding hole cards all live inside the same
      // frame — nothing floats loose outside it.
      root.innerHTML =
        '<div class="seat-card">' +
          '<span class="seat-name">'+esc(p.name)+'</span>' +
          '<div class="hearts hidden" aria-hidden="true"></div>' +
          '<div class="avatar-wrap">' +
            '<div class="turn-ring"></div>' +
            '<div class="avatar">'+esc(initials)+'</div>' +
            '<div class="pos-btn hidden"></div>' +
          '</div>' +
          '<span class="seat-chips tabular"></span>' +
          '<div class="action-slot act-empty">–</div>' +
          '<div class="seat-cards"></div>' +
        '</div>' +
        '<div class="action-bubble"></div>';
    }
    if (p.isHuman && hudMid) hudMid.insertBefore(root, hudMid.firstChild); else felt.appendChild(root);
    const avatar = root.querySelector('.avatar');
    if (p.isHuman){
      avatar.style.background = settings.avatarColour;
      avatar.style.color = '#1a1408';
    } else if (settings.faces){
      avatar.classList.add('has-face');
      avatar.innerHTML = renderFace(p.personality && p.personality.key, 'idle', aiHue(idx));
    }
    seatEls[p.id] = {
      root, avatar,
      chips: root.querySelector('.seat-chips'),
      posEl: root.querySelector('.pos-btn'),
      chipStack: root.querySelector('.chip-stack'),
      hearts: root.querySelector('.hearts'),
      cardsContainer: root.querySelector('.seat-cards'),
      actionSlot: root.querySelector('.action-slot'),
      bubble: root.querySelector('.action-bubble'),
      card: root.querySelector('.seat-card')
    };
    if (p.isHuman){
      // repoint the human's hooks at the static HUD frame elements
      const e = seatEls[p.id];
      e.hearts = $('hud-hearts');
      e.posEl = null;
      // Human actions are narrated by the centre CRT; the old right-column
      // action slot remains only as an inert compatibility stub in markup.
      e.actionSlot = null;
      if (e.hearts) e.hearts.dataset.n = '';
      buildJackpot();
      // Fresh table/rebuy: no natural transfer source for the starting
      // stack, so reset to empty and let render()'s bootstrap check pop
      // the bank pile straight to a freshly-decomposed target — same as
      // every other "money changed with no transfer" case.
      resetPile($('hud-tower'), bankPile()); resetPile($('pot-stacks'), potPile());
      bankPending = 0; potPending = 0;
    }
  });
}

function flashAction(playerId, label){
  if (!bubblesAllowed('action')) return;
  const e = seatEls[playerId];
  if (!e || !label) return;
  e.bubble.textContent = label;
  e.bubble.classList.toggle('is-fold', label==='Fold');
  e.bubble.classList.add('show');
  clearTimeout(e._t);
  e._t = setTimeout(()=>e.bubble.classList.remove('show'), 1100);
}

/* ============================================================
   PHYSICAL CHIP FLIGHT (Pass 3B). A chip that visually leaves a pile is
   the same physical DOM element that lands in the destination pile —
   never destroyed and replaced by a fresh lookalike, never a decoupled
   ghost standing in for it. flyChip() owns one chip's whole journey:
   take the real element from its source (or create one, for an
   opponent's seat, which has no persistent visible pile of its own),
   reserve its real destination slot BEFORE the flight starts (see
   claimDestSlot), fly it there in a small arc, and finally re-parent
   that SAME element into the destination tower — or, when there's no
   persistent destination (a payout landing at an opponent's seat, which
   never keeps a visible resting pile), fade it out and discard it.
   ============================================================ */

/* A non-pile flight endpoint (an opponent's seat chip-count label, or
   their whole seat card as a fallback) is just a screen ANCHOR — where
   the chip should visually originate or arrive — not a chip-shaped box.
   Chips are always square by construction (every .chip-disc CSS rule
   enforces width===height), but a text label or seat card almost never
   is; borrowing its raw rect directly for a flight endpoint pairs a
   non-square box against the (always square) other end of the flight,
   forcing scaleX and scaleY to diverge for most of the journey — visibly
   stretching the circular chip artwork into an ellipse. Squaring the
   anchor here (same centre point, a diameter derived from the anchor's
   own footprint) guarantees every flight endpoint is square, so scaleX
   and scaleY stay equal the whole time no matter what the anchor is. */
function squareAnchor(rect){
  if (!rect || !rect.width || !rect.height) return null;
  const d = Math.min(rect.width, rect.height) || 24;
  const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
  return { left: cx-d/2, top: cy-d/2, width: d, height: d };
}
/* Flies one real chip between two points on the table. Exactly one of
   {srcContainer+srcPile} / {srcEl} describes the start:
     - srcContainer+srcPile: take the actual chip already resting there
       (see takeChipFromPile) — used for the bank and the pot, which both
       keep a persistent visual pile.
     - srcEl: no real chip exists yet (an opponent's seat has no visible
       resting pile) — a fresh one is created, starting its flight from
       srcEl's on-screen position.
   Likewise exactly one of {dstContainer+dstPile} / {dstEl} describes the
   end:
     - dstContainer+dstPile: the chip becomes a REAL, permanent child of
       that pile's destination tower, reserved (see claimDestSlot) before
       the flight starts so its landing position is already known.
     - dstEl: no persistent pile to join (an opponent's seat) — the chip
       flies to dstEl's position, fades, and is discarded.
   onLand(el) fires once the chip has actually settled (or been
   discarded) — used for pending-counter bookkeeping by transferChips. */
function flyChip(opts){
  const { srcContainer, srcPile, srcEl, dstContainer, dstPile, dstEl, fast, onLand } = opts;
  let el, a;
  if (srcContainer && srcPile){
    const taken = takeChipFromPile(srcContainer, srcPile);
    if (!taken){ if (onLand) onLand(null); return; }
    el = taken.el; a = taken.rect;
  } else {
    a = squareAnchor(srcEl ? srcEl.getBoundingClientRect() : null);
    if (!a) a = { left: innerWidth/2, top: innerHeight/2, width:24, height:24 };
    el = document.createElement('div');
    el.className = 'chip-disc ' + pickChipColor(dstContainer || {_chipCount:0});
  }

  let placeholder=null;
  if (dstContainer && dstPile){
    placeholder = claimDestSlot(dstContainer, dstPile).placeholder;
  }

  const land = ()=>{
    if (placeholder){
      settleSlot(dstContainer, placeholder, el);
    } else {
      el.remove();
    }
    // Chip SFX v0.1 — the one safe hook into flyChip(): fires exactly at
    // the real landing moment, same as everything else land() already
    // does, so audio always follows the true visible rhythm rather than
    // an independent timer. Skipped under motionOff() — that path lands
    // every queued chip synchronously in one tick (see transferChips),
    // which would fire many chip sounds simultaneously with no visual
    // motion to reinforce them.
    if (!motionOff()) Sound.chipLand();
    if (onLand) onLand(el);
  };

  if (motionOff() || !a.width){
    el.style.cssText = '';
    land();
    return;
  }

  // The real target box — the reserved placeholder's own live layout
  // (see claimDestSlot), never hand-computed pixel math or a prediction —
  // so bank (21px) vs pot (25px) chip sizing, stacking overlap and
  // colour are all automatically correct with zero manual geometry here.
  // Its rect can't drift between now and landing (the placeholder
  // physically holds that space in the tower the whole flight), so
  // reading it now is trustworthy — it's read again fresh right before
  // the final approach below purely as a belt-and-braces guarantee.
  const rectOf = ()=> placeholder ? placeholder.getBoundingClientRect()
    : (dstEl ? squareAnchor(dstEl.getBoundingClientRect()) : a);
  const b0 = rectOf();
  if (!b0 || !b0.width){ land(); return; }

  // Reparent into the unclipped flight layer, pinned to its exact old
  // position first (the "IS the source chip on frame one" technique
  // DealFX.flyGhost already uses for cards) — nothing jumps, because on
  // the very first frame it is pixel-identical to where it just was.
  // transition is explicitly off here (Pass 3C.2) so this pin can never
  // itself be animated, whatever this reused element's transition was
  // left at by a previous flight.
  document.body.appendChild(el);
  el.style.transition = 'none';
  el.style.position = 'fixed';
  el.style.margin = '0';
  el.style.left = a.left + 'px';
  el.style.top = a.top + 'px';
  el.style.width = a.width + 'px';
  el.style.height = a.height + 'px';
  el.style.zIndex = '500';
  el.style.pointerEvents = 'none';
  el.style.transformOrigin = '50% 50%';
  el.style.willChange = 'transform';
  el.style.transform = 'translate(0,0) scale(1,1) rotate(0deg)';
  void el.offsetWidth;

  // Every delta below is CENTRE-to-centre, not corner-to-corner. With
  // transform-origin at the box's own centre (so ROTATION spins the chip
  // in place rather than swinging it around a corner), translate(dx,dy)
  // moves that centre by an exact px amount regardless of whatever scale
  // is composed with it — so centre-to-centre math is what actually lands
  // the box's edges on the destination rect exactly. Corner-to-corner
  // math (the previous approach) is off by half the width/height
  // difference between the source and destination chip sizes — e.g.
  // bank's 21px vs the pot's 25px — which was exactly the small but
  // consistent landing-snap this pass fixes: every single bank→pot flight
  // was quietly resting ~2px away from where its final transform said it
  // should be, because the browser's own flex layout (with no transform
  // involved) doesn't have that corner-vs-centre pivot error.
  const aCx = a.left + a.width/2, aCy = a.top + a.height/2;
  const centerDelta = (r)=>({ dx:(r.left+r.width/2)-aCx, dy:(r.top+r.height/2)-aCy, sx:r.width/a.width, sy:r.height/a.height });
  const d0 = centerDelta(b0);
  const hop = -(6 + Math.random()*8);            // the "small arc" — a lift mid-flight, not a straight line
  const spin = (Math.random()<.5?-1:1) * (18 + Math.random()*30);  // a modest tumble, always resolved flat by landing
  const dur = Math.round((fast ? 230 : 700) * speedMult());
  const s1 = Math.max(1, Math.round(dur*0.18)), s2 = Math.max(1, Math.round(dur*0.64)), s3 = Math.max(1, dur - s1 - s2);
  function waypoint(t, rotDeg){
    const sxT = 1+(d0.sx-1)*t, syT = 1+(d0.sy-1)*t;
    return 'translate('+(d0.dx*t)+'px,'+(d0.dy*t+hop*Math.sin(Math.PI*Math.min(1,t*1.15)))+'px) scale('+sxT+','+syT+') rotate('+rotDeg+'deg)';
  }

  // Pass 3C.2: the pin above (transition:none, at the source rect) has to
  // actually be PAINTED before we switch the transition on and move the
  // chip — a single requestAnimationFrame only guarantees we're at the
  // start of a frame whose style has been committed, not that the
  // browser has presented that frame to the screen yet. Nesting a second
  // rAF inside the first is the standard guarantee that a full pinned
  // frame has been committed AND painted first, so the animation below
  // has a real, on-screen "before" state to animate away from. Without
  // this, the browser can coalesce the pin and the first animated frame
  // into a single frame, and the chip appears to blip straight to
  // wherever the animation is partway through instead of visibly leaving
  // its source position.
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      // Pass 3C.4: release+arc is ONE continuous Web Animations API
      // timeline (was two separately re-triggered CSS transitions,
      // reassigning `transition`+`transform` a second time via setTimeout
      // mid-flight). Real captured on-device data showed that second
      // reassignment could leave the browser without a properly-registered
      // running transition — the chip would freeze at whatever value the
      // cascade last resolved to for a few hundred ms instead of
      // continuing to move. A single animate() call has no such handoff —
      // it's one timeline the browser owns start to finish — while still
      // tracing the same release-then-arc path (a keyframe at the old
      // waypoint(0.16) fraction) with the same two per-segment easing
      // curves as before, so the visual shape of the motion is unchanged.
      const midOffset = 0.16 / 0.93;
      const anim = el.animate([
        { transform: 'translate(0,0) scale(1,1) rotate(0deg)', easing: 'cubic-bezier(.4,0,.7,.3)' },
        { transform: waypoint(0.16, spin*0.25), offset: midOffset, easing: 'cubic-bezier(.35,0,.6,1)' },
        { transform: waypoint(0.93, spin*0.9) }
      ], { duration: s1+s2, fill: 'forwards' });
      anim.onfinish = ()=>{
        // commitStyles()+cancel() bakes the animation's current frame into
        // a plain inline style and releases the animation's hold on
        // `transform` — the exact same category of "an Animation outranks
        // inline styles for a property it's controlling" that made the
        // stale disc-in class hijack flights in the first place, so this
        // handoff has to be explicit rather than left to fill:'forwards'
        // lingering indefinitely.
        anim.commitStyles();
        anim.cancel();
        // Re-measured fresh right here, immediately before the final
        // approach, rather than reusing d0 from launch — the literal
        // guarantee (not just an assumption) that the flying chip's last
        // frame and the resting chip's first frame are pixel-identical. A
        // gentle back-out ease gives a 1-2px settle/bounce on arrival: the
        // curve overshoots slightly mid-transition, but a CSS transition
        // always ENDS exactly on the value it's given, so the chip still
        // comes to rest precisely on the real target — there's nothing
        // left to snap to once it gets there. Nothing else is animating
        // `transform` at this point (the WAAPI animation above was just
        // explicitly cancelled), so this is a single, uncontested
        // transition — the one stage the on-device capture already showed
        // behaving correctly.
        const d = centerDelta(rectOf());
        el.style.transition = 'transform '+s3+'ms cubic-bezier(.3,1.15,.4,1)';
        el.style.transform = 'translate('+d.dx+'px,'+d.dy+'px) scale('+d.sx+','+d.sy+') rotate(0deg)';
        setTimeout(()=>{
          el.style.position=''; el.style.margin=''; el.style.left=''; el.style.top='';
          el.style.width=''; el.style.height=''; el.style.zIndex=''; el.style.pointerEvents='';
          el.style.transformOrigin=''; el.style.transform=''; el.style.transition=''; el.style.willChange='';
          land();
        }, s3);
      };
    });
  });
}
/* Per-chip launch stagger. Bets stay readable without dragging: a couple
   of chips is a quick flick, ordinary bets land in the ~80-120ms band
   (clearly readable as individual launches), and huge/all-in transfers
   compress somewhat so they don't get tedious. Payouts pass fast:true for
   a noticeably snappier, more energetic release — same shape, scaled
   down. */
function chipStaggerGap(n, fast){
  const base = n<=2 ? 70 : n<=6 ? 110 : n<=12 ? 95 : n<=20 ? 80 : 65;
  return fast ? Math.max(30, Math.round(base*0.55)) : base;
}
/* Large-transfer acceleration — v0.1. chipStaggerGap() above is
   UNCHANGED and still anchors the pace — this only decides how that pace
   is approached across a transfer instead of holding it flat from the
   first chip. For a big payout/all-in, chipStaggerGap()'s own return
   value was already the transfer's fast/dense end (e.g. ~36ms for a
   40-chip fast payout) — the problem was the FRONT of the transfer using
   that same tight spacing too, with no readable build-up first. This
   scales that value up into a slower opening gap and eases back DOWN to
   it (now effectively the floor/steady-state pace) as `launched`
   progresses toward `n`, using an ease-in curve (progress²) so the
   speed-up itself builds momentum rather than snapping partway through.
   Ordinary small transfers (n<=10) are excluded entirely — they finish
   well inside chipStaggerGap()'s own existing "couple chips"/"ordinary
   bet" tiers, never long enough for a build-up to read as anything but
   noise, and are returned completely unchanged. */
function chipStaggerGapAt(n, launched, fast){
  const floorGap = chipStaggerGap(n, fast);
  if (n <= 10) return floorGap;
  const startGap = Math.round(floorGap * 2.6);
  const progress = Math.min(1, launched / (n-1));
  const eased = progress*progress;
  return Math.round(startGap - (startGap-floorGap)*eased);
}
/* How many chips may be simultaneously mid-flight (launched, not yet
   landed) at once. Pass 3C.3: NOT a launch-rate limiter — the gap above
   already paces launches — this is a hard ceiling on concurrent
   in-flight chips so a very large transfer (a 40+ chip all-in) can't
   still end up with dozens of simultaneous CSS transitions / will-change
   compositor layers / pending placeholder-swaps in flight together, even
   though at ordinary pacing (duration ÷ gap ≈ 5) it almost never
   actually binds. */
const MAX_CONCURRENT_FLIGHTS = 6;

/* Launches `n` flyChip() calls as one controlled, self-correcting queue —
   the batch version of a bank<->pot (or pot<->opponent-seat) transfer.
   `src`/`dst` are {container,pile} or {el}, exactly matching flyChip's
   own contract.

   Pass 3C.3 root-cause fix: this used to fire `n` INDEPENDENT
   setTimeout(fn, i*gap) timers, all computed up front relative to a
   single reference point. That has two concrete failures: (1) it hard-
   capped the effective offset for large i, so a big transfer launched a
   whole tail of chips at the exact same instant; and (2) independent
   fixed-offset timers don't self-correct — if the main thread is busy
   for any reason (another chip's forced layout read, a render() call,
   anything), every timer whose due-time has already passed fires back to
   back the instant the thread frees up, so several chips launch, claim a
   slot, and pin in the same frame. Visually that's indistinguishable
   from "the chip just appeared" — and it gets WORSE the more chips there
   are, exactly matching what large transfers were doing.

   The fix is a single lane: launch one chip, then wait `gap` ms AND for
   an in-flight slot to free up (whichever is later) before launching the
   next. Because each wait is scheduled off the PREVIOUS launch's own
   real completion (not a precomputed cumulative offset), a stall delays
   the whole queue instead of compressing it — there is no way for two
   launches to end up sharing a frame except by genuine bad luck, not by
   timer drift. Once a chip is actually launched it's just a running CSS
   transition (see flyChip) — cheap, compositor-driven, costs nothing
   further from this queue.

   addPending(s,d) mirrors the pre-3B transferPile's bookkeeping
   contract: called once up front with (n,n) so both piles read "busy"
   for the whole transfer, then (-1,0) at each chip's own launch and
   (0,-1) at each landing — src pending reaches 0 once every chip has
   left, dst pending once every chip has arrived, which is what lets
   render()'s idle-snap safely resume correcting that pile again
   afterwards (see the bankPending===0/potPending===0 checks).

   Showdown revamp — now returns a Promise that resolves once every one of
   the `n` chips has genuinely landed (or, for n<=0/motionOff(), resolves
   immediately once that's already true), so a caller can await REAL
   completion instead of guessing a duration. Every exit path is covered
   so this can never hang: n<=0 resolves before any bookkeeping starts;
   motionOff() lands every chip synchronously (flyChip's own motionOff()
   branch calls land() before returning) before the loop that produces
   this Promise even exits; and on the normal path, flyChip's onLand
   fires exactly once per chip on every one of its own exit paths,
   including the takeChipFromPile source-exhaustion failure (onLand(null)
   still counts), so the `landed` counter below is mathematically
   guaranteed to reach `n`. */
function transferChips(n, src, dst, addPending, fast){
  if (n<=0) return Promise.resolve();
  if (motionOff()){
    for (let i=0;i<n;i++){
      flyChip({ srcContainer:src.container, srcPile:src.pile, srcEl:src.el,
        dstContainer:dst.container, dstPile:dst.pile, dstEl:dst.el, fast });
    }
    return Promise.resolve();
  }
  return new Promise(resolve=>{
    addPending(n, n);
    let launched = 0, active = 0, landed = 0, gateOpen = true;

    const pump = ()=>{
      if (launched>=n || !gateOpen || active>=MAX_CONCURRENT_FLIGHTS) return;
      gateOpen = false;
      launched++; active++;
      addPending(-1, 0);
      flyChip({
        srcContainer:src.container, srcPile:src.pile, srcEl:src.el,
        dstContainer:dst.container, dstPile:dst.pile, dstEl:dst.el,
        fast, onLand: ()=>{ active--; landed++; addPending(0,-1); if (landed>=n) resolve(); pump(); }
      });
      // chipStaggerGapAt (not the old flat chipStaggerGap) — see its own
      // comment: large transfers accelerate as `launched` climbs toward
      // `n`, small ones are returned unchanged.
      if (launched<n) setTimeout(()=>{ gateOpen = true; pump(); }, chipStaggerGapAt(n, launched, fast));
    };
    pump();
  });
}

/* Payout: `n` real pot chips leave the pot and travel to the winner's
   pile — shared by handleFoldWin() and handleShowdown()'s consolidated
   award sequence. `n` is just a chip count (see the callers for how it's
   derived from the money award). Faster/more energetic release than a
   bet (fast:true — see chipStaggerGap). Returns transferChips()'s
   completion Promise so callers can await every chip actually landing. */
function payoutTo(winner, n){
  if (!n || n<=0) return Promise.resolve();
  const potContainer = $('pot-stacks'), pPile = potPile();
  const e = seatEls[winner.id];
  const src = { container: potContainer, pile: pPile };
  const dst = winner.isHuman
    ? { container: $('hud-tower'), pile: bankPile() }
    : { el: (e && e.chips) || (e && e.root) };
  return transferChips(n, src, dst, (s,d)=>{ potPending+=s; if (winner.isHuman) bankPending+=d; }, true);
}

/* ============================================================
   POT SMASH — the human pot-win reward breakdown, TOTAL stamp and real
   pot-chip physics burst. Replaces the earlier score-smash prototype,
   whose smash always ran AFTER payoutTo() had already flown every real
   pot chip into the bank — so it had nothing left to smash and fell back
   to yanking already-arrived bank chips instead. Here the human's own
   share of the pot is deliberately NOT sent through payoutTo() at all;
   this whole module owns those chips instead, from the moment they leave
   #pot-stacks (still full, organised towers) to the moment they're
   settled for real into #hud-tower — see runHumanPotSmashCeremony's
   caller in runShowdownAwardSequence for how the normal payoutTo() path
   is bypassed for the human specifically while every other winner still
   uses it, unchanged, concurrently.
   Timings are deliberately NOT run through speedMult()/pacedSleep() —
   same reasoning as playElimination()'s K.O./ELIMINATED sequence (see
   FAST_DEV's own comment): this is a real payoff moment, not "boring
   setup" to blitz through under FAST DEV.
   ============================================================ */

/* Reward breakdown pacing — juice pass v2: more breathing room per line,
   still adaptive (a long list compresses, never truncates). Per-item
   duration uses budgetMs/sqrt(n) rather than a straight budgetMs/n split
   — division alone would roughly halve the pace every time the list
   grows by one more item; the gentler sqrt falloff is what lets a 1-2
   item list sit near maxPerItemMs (a deliberate, satisfying beat) while a
   6+ item list still tapers down toward minPerItemMs instead of racing
   there. Roughly: n=1-2 -> ~750-900ms/item, n=3-5 -> ~550-700ms/item,
   n=6+ -> ~400-500ms/item, keeping a long breakdown's total runtime in
   the ~2.5-3.0s ballpark before TOTAL. totalRevealMs/anticipationMs sit
   outside that budget entirely — TOTAL is the hero beat, not another
   list item (see presentRewardBreakdown/item 3 of the juice pass). */
const REWARD_BREAKDOWN_CONFIG = {
  budgetMs: 1200, minPerItemMs: 400, maxPerItemMs: 900,
  totalRevealMs: 320, anticipationMs: 460
};
/* Free-bounce/attraction physics tuning — see runPotBreakPhysics() and
   its helpers. Deliberately simple (no chip-vs-chip collision, two static
   axis-aligned bounds) per the "controlled chaos, not a physics engine"
   brief. Juice pass v2: freeMs stretched from 850ms to ~2.5s, so
   restitution/damping are retuned alongside it — the original values were
   tuned for a sub-second burst and would have every chip settled to a
   near-standstill long before a 2.5s window elapsed; higher restitution
   and lower damping keep chips genuinely bouncing/rotating for most of
   the extended window instead of just resting there. */
const POT_SMASH_PHYSICS_CONFIG = {
  freeMs: 2500,              // shared free-bounce budget — one clock for every chip, so the burst reads as one event. Target range 2300-2700ms.
  hitStopMs: 60,             // micro impact-freeze at the instant TOTAL lands, before anything reacts — felt more than seen
  gravity: 1350,             // px/s^2 — slightly floatier arc than before, suited to the longer window
  restitution: 0.64,         // velocity retained (perpendicular component) on a boundary bounce — raised so multiple bounces persist over 2.5s
  floorFriction: 0.78,       // extra horizontal damping specifically on a dashboard-floor contact
  airDamping: 0.22,          // per-second velocity decay while airborne — lowered so chips keep travelling/rattling, not just dying out
  angularDamping: 0.5,       // per-second spin decay — lowered so chips keep visibly rotating through more of the free phase
  minBounceSoundVel: 70,     // px/s — below this a "bounce" is a silent graze (raised: a longer bounce phase means far more collision events, so the floor is stricter)
  softBounceVel: 150,        // below this: a small soft "ping"
  hardBounceVel: 420,        // at/above this: a stronger "plonk" — edge/dashboard hits read heavier than a gentle mid-table graze
  bounceSoundGapMs: 70,      // per-chip minimum re-trigger gap, independent of Sound.chipBounce's own cross-chip density window
  releaseStaggerMaxMs: 120,  // tower-breakup stagger — upper/earlier-pulled chips pop free slightly before lower/later ones (item 6)
  attractStaggerMaxMs: 260,  // collection begins slightly staggered per chip, not all at once — widened for the longer, larger bursts
  attractMs: 340,            // per-chip ease-in duration once it starts homing to the bank
  attractPow: 2.2,           // ease-in exponent — weak start, quickly ramping, "increasingly decisive" pull (item 10)
  lateSnapFraction: 0.82,    // the last ~18% of chips (by attraction start order) get a faster, punchier "snap" finish
  lateSnapMsMult: 0.68,      // their attractMs is shortened by this factor
  lateSnapPow: 3.4,          // and eased with a steeper exponent — a harder final pull
  attractBowMin: 14, attractBowMax: 40  // px — lateral "curve" bowed into the attraction path so it reads as being pulled in, not just sliding in a straight line
};

/* Landing point for the TOTAL stamp — centred on the pot plate itself
   ("over the felt near the pot position"), falling back to the felt's own
   centre if the pot plate isn't laid out for some reason. */
function scoreSmashImpactPoint(){
  const rect = ($('pot-area') && $('pot-area').getBoundingClientRect())
    || ($('felt') && $('felt').getBoundingClientRect());
  if (!rect || !rect.width) return null;
  return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
}
/* Small physical "thud" on the table itself — the one existing mechanism
   this reuses is the class-triggered CSS keyframe technique already used
   by .hud-frame-win (celebrateWinnerSeat) and .score-impact, just aimed
   at #felt instead. */
function feltImpactBump(){
  const felt = $('felt');
  if (!felt || motionOff()) return;
  felt.classList.remove('felt-impact'); void felt.offsetWidth; felt.classList.add('felt-impact');
}
/* Two static axis-aligned bounds, measured once per sequence rather than
   per frame (a ~1s ceremony doesn't need to react to mid-flight resizes).
   `left`/`right`/`top` come from the felt itself — the edges chips bounce
   off. `bottom` is the player's own dashboard's TOP edge (#your-seat-dock,
   the dense console CLAUDE.md calls out — cards/chips/meters/controls) —
   chips bounce off it like a physical shelf instead of visually plowing
   into the button row underneath. No geometry for opponent seats/board —
   chips are explicitly allowed to fly over them (see the design brief);
   this is controlled chaos against two simple boundaries, not real
   per-element collision. */
function potSmashBounds(){
  const felt = $('felt'), dash = $('your-seat-dock');
  const feltRect = felt && felt.getBoundingClientRect();
  const dashRect = dash && dash.getBoundingClientRect();
  return {
    left: feltRect && feltRect.width ? feltRect.left : 0,
    right: feltRect && feltRect.width ? feltRect.right : innerWidth,
    top: feltRect && feltRect.width ? feltRect.top : 0,
    bottom: dashRect && dashRect.width ? dashRect.top : innerHeight
  };
}
/* One reward line's worth of sequential presentation — hero name, its own
   point value, then the running subtotal so far. Reuses the existing
   #arcade-reward-layer/#arcade-hero/#arcade-secondaries/#arcade-total DOM
   (previously only #arcade-hero/#arcade-total were ever written to;
   #arcade-secondaries — present in the markup, never wired up — now
   carries each item's own "+N" so the hero name and its point value read
   together while #arcade-total carries the running subtotal). Deliberately
   does NOT touch a.score/#arcade-score-machine — the permanent SCORE HUD
   only starts moving at the smash's own impact instant (see
   runPotSmashSequence), not per breakdown line. */
async function presentRewardBreakdown(early){
  const items = early && early.awards;
  const layer = $('arcade-reward-layer');
  if (!layer || !items || !items.length) return;
  const cfg = REWARD_BREAKDOWN_CONFIG;
  const perItemMs = Math.max(cfg.minPerItemMs, Math.min(cfg.maxPerItemMs, Math.round(cfg.budgetMs/Math.sqrt(items.length))));
  let subtotal = 0;
  for (const item of items){
    subtotal += item.def.base*item.count;
    clearArcadeLayer();
    layer.className = 'arcade-reward-layer pot-smash-breakdown tier-'+(item.def.tier||'small')+' cat-'+(item.def.type||'result');
    layer.classList.remove('hidden');
    $('arcade-hero').textContent = item.def.name;
    $('arcade-secondaries').innerHTML = '<span class="arcade-secondary">+'+(item.def.base*item.count).toLocaleString()+'</span>';
    $('arcade-total').textContent = subtotal.toLocaleString();
    void layer.offsetWidth; layer.classList.add('is-live');
    Sound.arcadeReward(item.def.tier||'small', item.id);
    await arcadeDelay(perItemMs);
  }
  clearArcadeLayer();
  layer.className = 'arcade-reward-layer pot-smash-breakdown is-total';
  layer.classList.remove('hidden');
  $('arcade-hero').textContent = 'TOTAL';
  $('arcade-total').textContent = '+'+Math.round(early.total).toLocaleString();
  $('arcade-total').classList.remove('is-ready'); void $('arcade-total').offsetWidth; $('arcade-total').classList.add('is-ready');
  void layer.offsetWidth; layer.classList.add('is-live');
  await arcadeDelay(cfg.totalRevealMs);
  await arcadeDelay(cfg.anticipationMs);
  clearArcadeLayer();
}
/* Applies one physics chip's current x/y/rot state to its DOM element.
   Elements are position:fixed inside #chip-physics-layer, positioned by
   plain left/top (not transform:translate) so the per-frame physics math
   stays simple absolute coordinates — transform is reserved for rotation
   only. */
function applyChipTransform(c){
  c.el.style.left = (c.x - c.radius) + 'px';
  c.el.style.top = (c.y - c.radius) + 'px';
  c.el.style.transform = 'rotate(' + c.rot + 'deg)';
}
/* Launch-class weighting for the initial burst (item 5 of the juice
   pass) — a real tower breaking apart doesn't send every chip out at a
   uniform speed: a few go flying, most get a solid medium shove, and a
   handful near the bottom/sheltered barely escape before gravity/the
   next bounce takes over. Picked independently per chip (not tied to
   pull order) so the mix reads as physical variety, not a pattern. */
function pickLaunchClass(){
  const r = Math.random();
  if (r < 0.14) return 'hard';
  if (r < 0.82) return 'medium';
  return 'soft';
}
const LAUNCH_CLASS_SPEED = {
  hard:   { min:480, max:640, kickMin:190, kickMax:280, spinMin:260, spinMax:520 },
  medium: { min:230, max:420, kickMin:100, kickMax:190, spinMin:150, spinMax:320 },
  soft:   { min:70,  max:180, kickMin:20,  kickMax:80,  spinMin:70,  spinMax:170 }
};
/* Pulls one real chip off the pot pile, pins it at its exact resting rect
   (same "IS the chip on frame one" technique flyChip already uses), and
   gives it an outward velocity radial from the impact point relative to
   ITS OWN tower's actual on-screen position — different towers already
   sit at different distances/angles from the impact, so varied launch
   vectors fall out naturally without any per-chip hand tuning; the
   launch-class speed above layers deliberate variety on top of that.
   `pullIndex` (this chip's 0-based order among the whole burst — earlier
   pulls tend to be a tower's own topmost chips, see takeChipFromPile) also
   drives a small releaseDelay so the tower visibly breaks apart in a
   quick stagger rather than every chip going free on the same frame
   (item 6) — the chip stays pinned exactly at its resting rect, doing
   nothing, until that delay elapses (see runPhysicsFreePhase). */
function spawnPhysicsChip(taken, impactPoint, layer, pullIndex){
  const { el, rect } = taken;
  el.classList.remove('disc-in');
  el.style.transition = 'none';
  el.style.position = 'fixed';
  el.style.margin = '0';
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  el.style.width = rect.width + 'px';
  el.style.height = rect.height + 'px';
  el.style.pointerEvents = 'none';
  el.style.willChange = 'left,top,transform';
  layer.appendChild(el);

  const cfg = POT_SMASH_PHYSICS_CONFIG;
  const cx = rect.left+rect.width/2, cy = rect.top+rect.height/2;
  const dx = cx-impactPoint.x, dy = cy-impactPoint.y, dist = Math.hypot(dx,dy);
  let angle = dist<4 ? Math.random()*Math.PI*2 : Math.atan2(dy,dx);
  angle += (Math.random()-0.5)*0.9;                 // spread, so a tower's chips don't all launch in lockstep
  const lc = LAUNCH_CLASS_SPEED[pickLaunchClass()];
  const speed = lc.min + Math.random()*(lc.max-lc.min);
  const kick = lc.kickMin + Math.random()*(lc.kickMax-lc.kickMin);
  const spin = lc.spinMin + Math.random()*(lc.spinMax-lc.spinMin);

  const attractDelay = Math.random()*cfg.attractStaggerMaxMs;
  const lateSnap = attractDelay > cfg.attractStaggerMaxMs*cfg.lateSnapFraction;

  return {
    el,
    x:cx, y:cy,
    vx: Math.cos(angle)*speed,
    vy: Math.sin(angle)*speed - kick,
    rot:0, vrot:(Math.random()<0.5?-1:1)*spin,
    radius: rect.width/2,
    state:'free', lastBounceAt:0,
    releaseDelay: Math.min(cfg.releaseStaggerMaxMs, (pullIndex||0)*2) + Math.random()*40,
    attractDelay,
    attractMs: lateSnap ? cfg.attractMs*cfg.lateSnapMsMult : cfg.attractMs,
    attractPow: lateSnap ? cfg.lateSnapPow : cfg.attractPow,
    bowAmount: (Math.random()<0.5?-1:1) * (cfg.attractBowMin + Math.random()*(cfg.attractBowMax-cfg.attractBowMin))
  };
}
function maybePlayBounceSound(c, vel){
  const cfg = POT_SMASH_PHYSICS_CONFIG;
  if (vel < cfg.minBounceSoundVel) return;
  const now = performance.now();
  if (now-c.lastBounceAt < cfg.bounceSoundGapMs) return;
  c.lastBounceAt = now;
  // soft ping / normal clack / stronger plonk, keyed off how hard this
  // particular collision actually was (item 9) — not every bounce sounds
  // the same.
  const power = vel < cfg.softBounceVel ? 0.7 : vel < cfg.hardBounceVel ? 1.0 : 1.4;
  Sound.chipBounce(power);
}
/* One free-flight integration step: gravity + air damping, then a simple
   circle-vs-edge clamp+restitution against the two static bounds — no
   chip-vs-chip collision (deliberately out of scope; "controlled chaos,
   not a physics engine"). */
function stepFreeChip(c, dt, bounds){
  const cfg = POT_SMASH_PHYSICS_CONFIG;
  c.vy += cfg.gravity*dt;
  c.x += c.vx*dt; c.y += c.vy*dt;
  const damp = Math.max(0, 1-cfg.airDamping*dt);
  c.vx *= damp; c.vy *= damp;
  c.rot += c.vrot*dt;
  c.vrot *= Math.max(0, 1-cfg.angularDamping*dt);

  let bounceVel = 0;
  if (c.x-c.radius < bounds.left){ c.x = bounds.left+c.radius; c.vx = -c.vx*cfg.restitution; bounceVel = Math.abs(c.vx); }
  else if (c.x+c.radius > bounds.right){ c.x = bounds.right-c.radius; c.vx = -c.vx*cfg.restitution; bounceVel = Math.abs(c.vx); }
  if (c.y-c.radius < bounds.top){ c.y = bounds.top+c.radius; c.vy = -c.vy*cfg.restitution; bounceVel = Math.max(bounceVel, Math.abs(c.vy)); }
  else if (c.y+c.radius > bounds.bottom){
    c.y = bounds.bottom-c.radius; c.vy = -c.vy*cfg.restitution; c.vx *= cfg.floorFriction;
    bounceVel = Math.max(bounceVel, Math.abs(c.vy));
  }
  if (bounceVel>0) maybePlayBounceSound(c, bounceVel);
  applyChipTransform(c);
}
/* Shared rAF clock driving every free-flight chip for a fixed wall-clock
   budget — one clock, not per-chip timers, so the burst reads as one
   coordinated event rather than chips drifting out of sync with each
   other. Each chip stays completely still at its exact pulled-from-the-
   tower position until its own releaseDelay elapses (measured from this
   phase's real start, t0) — that's the tower-breakup stagger (item 6):
   chips pop free in a quick cascade instead of the whole tower vanishing
   on one frame, without any dedicated stack-physics simulation. */
function runPhysicsFreePhase(chips, bounds, budgetMs){
  return new Promise(resolve=>{
    const t0 = performance.now();
    let last = t0;
    const endAt = t0 + budgetMs;
    function frame(now){
      const dt = Math.min(0.032, (now-last)/1000);
      last = now;
      chips.forEach(c=>{
        if (now-t0 < c.releaseDelay) return;
        stepFreeChip(c, dt, bounds);
      });
      if (now < endAt) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}
/* Shared rAF clock easing every chip from wherever the free phase left it
   into its own reserved bank slot — one clock driving all of them (not N
   independent per-chip rAF loops/timers), same efficiency reasoning as
   runPhysicsFreePhase above; a huge pot can mean dozens of chips
   attracting inside the same window, and this is a mobile PWA first.
   Each chip only claims its real bank slot (claimDestSlot) the instant
   ITS OWN stagger delay elapses — not all up front — so the slot's real
   final rect is known before its ease starts (same guarantee flyChip's
   placeholder trick relies on) and later-starting chips still see earlier
   ones' reservations already reflected in tower height.
   The ease itself uses each chip's own attractPow (item 10) — a power
   curve rather than a straight lerp so early progress is barely
   perceptible and the pull becomes visibly more decisive as it nears the
   bank; a chip flagged as a "late snap" (the last ~18% to start, see
   spawnPhysicsChip) gets a shorter attractMs and a steeper attractPow, so
   the very last few chips visibly snap home harder/faster for a
   satisfying finish rather than the whole burst just petering out evenly.
   A small perpendicular "bow" (sine-shaped, zero at both ends) is layered
   on top of the straight-line lerp so the path visibly curves in toward
   the bank instead of sliding there in a flat line — reads as magnetism,
   not a slide. settleSlot() on arrival hands the element back to the real
   bank pile for good — same primitive an ordinary payout uses, so nothing
   about the DOM handoff is bespoke to this effect. */
function runPhysicsAttractionPhase(chips, bankContainer, bankP){
  if (!chips.length) return Promise.resolve();
  return new Promise(resolve=>{
    const start = performance.now();
    let remaining = chips.length;
    function frame(now){
      chips.forEach(c=>{
        if (c.state==='collected') return;
        if (c.state==='free'){
          if (now-start < c.attractDelay) return;
          c.state = 'attracting';
          c._placeholder = claimDestSlot(bankContainer, bankP).placeholder;
          c._startX = c.x; c._startY = c.y; c._startRot = c.rot; c._t0 = now;
        }
        const t = Math.min(1, (now-c._t0)/c.attractMs), eased = Math.pow(t, c.attractPow);
        const target = c._placeholder.getBoundingClientRect();
        const tx = target.left+target.width/2, ty = target.top+target.height/2;
        const dxT = tx-c._startX, dyT = ty-c._startY;
        const bow = Math.sin(Math.PI*t) * c.bowAmount, bowLen = Math.hypot(dxT,dyT) || 1;
        c.x = c._startX + dxT*eased + (-dyT/bowLen)*bow;
        c.y = c._startY + dyT*eased + (dxT/bowLen)*bow;
        c.rot = c._startRot + (0-c._startRot)*eased;
        applyChipTransform(c);
        if (t<1) return;
        c.state = 'collected';
        c.el.style.position=''; c.el.style.left=''; c.el.style.top=''; c.el.style.width='';
        c.el.style.height=''; c.el.style.margin=''; c.el.style.transform=''; c.el.style.willChange='';
        c.el.style.pointerEvents=''; c.el.style.transition='';
        settleSlot(bankContainer, c._placeholder, c.el);
        bankPending = Math.max(0, bankPending-1);
        Sound.chipCollect();
        remaining--;
      });
      if (remaining>0) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}
/* Full free-physics burst for the human's own `potN` real pot chips:
   pulls them for real off #pot-stacks (the SAME takeChipFromPile()
   primitive flyChip() uses — never a decorative clone), bounces them for
   a fixed budget, then magnetically collects them into the real bank
   pile. potPending/bankPending are held busy for the whole operation —
   the exact same mutual-exclusion convention transferChips()'s
   addPending callback already uses — so render()'s renderPot()/
   renderBank() idle-bootstrap checks can never fight this in-flight
   physics layer for the same DOM elements. */
async function runPotBreakPhysics(potN, impactPoint){
  if (!(potN>0)) return;
  const potContainer = $('pot-stacks'), pPile = potPile();
  const bankContainer = $('hud-tower'), bankP = bankPile();
  potPending += potN; bankPending += potN;

  const layer = document.createElement('div');
  layer.className = 'chip-physics-layer';
  document.body.appendChild(layer);

  const bounds = potSmashBounds();
  const chips = [];
  for (let i=0;i<potN;i++){
    const taken = takeChipFromPile(potContainer, pPile);
    if (!taken){ potPending = Math.max(0, potPending-1); bankPending = Math.max(0, bankPending-1); continue; }
    potPending = Math.max(0, potPending-1);
    chips.push(spawnPhysicsChip(taken, impactPoint, layer, i));
  }
  if (!chips.length){ layer.remove(); return; }

  await runPhysicsFreePhase(chips, bounds, POT_SMASH_PHYSICS_CONFIG.freeMs);
  await runPhysicsAttractionPhase(chips, bankContainer, bankP);
  layer.remove();
}
/* Top-level pot-smash orchestrator: TOTAL plate drop -> impact (felt
   thud/sound/haptic, permanent SCORE HUD begins rolling here, real pot
   chips burst into free physics) -> plate rebound/hold/fade (cosmetic,
   runs concurrently with the physics/score work below it, not gating it)
   -> awaits both the physics burst/collection and the score roll before
   returning, so the caller can safely treat this as one atomic beat.
   Reduced motion takes a fully separate, much shorter branch (see below)
   rather than trying to run the same timeline at 0ms — it reuses the
   ordinary, already-motionOff-aware payoutTo() to move the human's chips
   instantly and correctly instead. */
async function runPotSmashSequence({ potN, scoreTotal, human }){
  const g = game, a = g && g.run && g.run.arcade;
  if (!a) return;
  const tier = scoreTotal>=1000 ? 'large' : scoreTotal>=250 ? 'medium' : 'small';

  const rollScore = async()=>{
    const target = a.score+scoreTotal; a.score = target;
    const machine = $('arcade-score-machine');
    if (machine){
      machine.classList.remove('score-impact','score-jackpot'); void machine.offsetWidth;
      machine.classList.add(tier==='large'?'score-jackpot':'score-impact');
    }
    await rollArcadeCounter(a, target, tier);
  };

  const point = scoreSmashImpactPoint();
  if (motionOff() || !point){
    Sound.scoreSmash(scoreTotal>=1000);
    haptic(scoreTotal>=1000?[46,22,60]:[36,18,48]);
    await Promise.all([ payoutTo(human, potN), rollScore() ]);
    return;
  }

  const layer = document.createElement('div');
  layer.className = 'score-smash-layer';
  const plate = document.createElement('div');
  plate.className = 'score-smash-plate';
  plate.textContent = '+' + Math.round(scoreTotal).toLocaleString();
  plate.style.left = point.x+'px'; plate.style.top = point.y+'px';
  layer.appendChild(plate);
  document.body.appendChild(layer);

  const dropAnim = plate.animate([
    { transform:'translate(-50%,-50%) translateY(-150px) scale(.7,1.2) rotate(-3deg)', opacity:0, offset:0 },
    { transform:'translate(-50%,-50%) translateY(-12px) scale(.8,1.12) rotate(-2deg)', opacity:1, offset:.74, easing:'cubic-bezier(.55,0,.85,.35)' },
    { transform:'translate(-50%,-50%) translateY(3px) scale(1.34,.62) rotate(0deg)', opacity:1, offset:1 }
  ], { duration:190, easing:'cubic-bezier(.3,0,.75,.15)', fill:'forwards' });
  try{ await dropAnim.finished; }catch(e){}
  dropAnim.commitStyles(); dropAnim.cancel();

  // Micro impact-freeze (item 4 of the juice pass) — a very short hold
  // right at contact, before anything reacts, so the hit reads as
  // heavier. Meant to be felt more than consciously noticed; this branch
  // only ever runs when motion is on, so reduced-motion users never see
  // this pause at all (they take the instant fallback above instead).
  await sleep(POT_SMASH_PHYSICS_CONFIG.hitStopMs);

  // IMPACT — felt thud, sound, haptic, the permanent SCORE HUD starting
  // to roll, and the real pot chips bursting into physics all fire off
  // this exact instant (the moment the plate's own fall says it landed).
  feltImpactBump();
  Sound.scoreSmash(scoreTotal>=1000);
  haptic(scoreTotal>=1000?[46,22,60,18,34]:[36,18,48]);
  const scorePromise = rollScore();
  const physicsPromise = runPotBreakPhysics(potN, point);

  const reboundAnim = plate.animate([
    { transform:'translate(-50%,-50%) translateY(3px) scale(1.34,.62) rotate(0deg)' },
    { transform:'translate(-50%,-50%) translateY(-7px) scale(.9,1.09) rotate(0deg)', offset:.5, easing:'cubic-bezier(.2,.7,.3,1)' },
    { transform:'translate(-50%,-50%) translateY(0) scale(1,1) rotate(0deg)' }
  ], { duration:130, easing:'cubic-bezier(.3,.9,.4,1)', fill:'forwards' });
  try{ await reboundAnim.finished; }catch(e){}
  reboundAnim.commitStyles(); reboundAnim.cancel();

  await sleep(200);

  const fadeAnim = plate.animate([
    { transform:'translate(-50%,-50%) translateY(0) scale(1,1)', opacity:1 },
    { transform:'translate(-50%,-50%) translateY(-16px) scale(.8,.8)', opacity:0 }
  ], { duration:170, easing:'cubic-bezier(.4,0,.8,1)', fill:'forwards' });
  try{ await fadeAnim.finished; }catch(e){}
  layer.remove();

  await Promise.all([physicsPromise, scorePromise]);
}
/* Whole-ceremony entry point for a human pot win: freezes the bank
   readout at its pre-win value (amendment 1 — the visual story must stay
   "chips enter bank -> money appears", never the reverse, even though
   player.chips itself is already correct underneath), presents the
   uncapped reward breakdown, runs the smash/physics/collection, then
   unfreezes the readout and rolls it to the true value right as
   collection finishes. Wrapped in queueArcadePresentation so it can never
   visually overlap a DEV-triggered test or a second real hand. */
function runHumanPotSmashCeremony(g, outcome, potN, preWinChips){
  return queueArcadePresentation(async()=>{
    if (game!==g || !g.run || !g.run.arcade) return;
    const human = g.players.find(p=>p.isHuman);
    const early = await evaluateArcadeAwardsEarly(g, outcome);
    if (!early){ await payoutTo(human, potN); return; }
    humanBankDisplayFreeze = preWinChips;
    updateJackpot(preWinChips);
    // finally, not just a trailing pair of statements — if anything above
    // throws mid-ceremony, the stack reel must never be left permanently
    // stuck on the pre-win value (amendment 1 is about a brief, correct
    // delay, not a silently wrong display).
    try{
      await presentRewardBreakdown(early);
      await runPotSmashSequence({ potN, scoreTotal: early.total, human });
    } finally {
      humanBankDisplayFreeze = null;
      updateJackpot(human.chips);
    }
    // Settle beat (item 11) — a small, deliberate breathing pause once the
    // last physical chip has actually landed, so the payout reads as
    // finished rather than immediately cutting into whatever's next
    // (K.O./TABLE CLEAR presentation, the next-hand button). Placed after
    // the freeze already cleared, so it never delays the money reveal
    // itself — only what comes after it.
    await sleep(motionOff() ? 0 : 200);
    if (early.luck) await presentArcadeCommentary(g, early.luck, true);
    else if (early.commentary) await presentArcadeCommentary(g, early.commentary, false);
  });
}

function render(){
  if (DEV_MODE) refreshDevPanel();
  updateArcadeHUD();
  if (!game || game.phase==='setup') return;
  const g = game;

  const meta = $('table-meta');
  if (meta){
    meta.textContent = 'Hand ' + g.handNumber + ' · ' + g.smallBlind + '/' + g.bigBlind +
      (g.mode==='tournament' ? ' · Tournament' : '') +
      (g.mode==='elimination' && g.run ? ' · Table '+g.run.tableNumber : '');
  }

  const feltEl = $('felt');
  if (feltEl) feltEl.classList.toggle('live',
    ['preflop','flop','turn','river'].includes(g.phase) && !g.over);

  const potArea = $('pot-area');
  const potContainer = $('pot-stacks');
  // The numeric readout always reflects the authoritative pot instantly.
  // renderPot() only ever POPULATES an empty pile (see its own bootstrap
  // check) — it must never re-derive/replace a pile that already has
  // real chips in it. Every chip that's ever added to or removed from
  // the pot goes through a tracked transferChips() call except blinds
  // (posted directly, no animation), so an empty-pile bootstrap is what
  // makes blinds appear. Visibility also has to consider the pile's own
  // _chipCount, not just g.pot, so the plate stays up while a payout's
  // last chips are still draining out after g.pot has already dropped
  // to 0.
  renderPot();
  if (g.pot>0 || (potContainer && (potContainer._chipCount||0)>0)){
    potArea.classList.remove('hidden');
    $('pot-val').textContent = g.pot.toLocaleString();
  } else {
    potArea.classList.add('hidden');
  }

  syncCardRow($('board'), g.board, g.board.map(()=>false), false, 'board');

  g.players.forEach((p, idx)=>{
    const e = seatEls[p.id];
    if (!e) return;
    e.root.classList.toggle('folded', !!p.folded);
    e.root.classList.toggle('out', (!p.inHand || p.eliminated) && g.handNumber>0 && !p.folded);
    e.root.classList.toggle('active', idx===g.currentIndex && !['showdown','foldwin'].includes(g.phase) && !g.over);
    // No visual Dealer marker (removed) — g.dealerIndex itself still drives
    // assignBlinds()/computePositions() below and elsewhere, unchanged.
    // Broadened beyond livesEnabled (cash+hearts) to also cover elimination
    // mode's own eliminated players — playElimination() adds this class
    // itself the moment its POP stage lands, and render() must not strip
    // it back off on the very next redraw (g.livesEnabled is false there).
    e.root.classList.toggle('dead', !!p.eliminated && (!!g.livesEnabled || g.mode==='elimination'));
    if (e.hearts){
      if (g.livesEnabled && !p.eliminated){
        const n = Math.max(0, p.lives|0);
        if (e.hearts.dataset.n !== String(n)){
          e.hearts.dataset.n = String(n);
          let h = '';
          for (let k=0;k<3;k++) h += '<span class="h'+(k<n?'':' off')+'">'+pixelHeartSVG()+'</span>';
          e.hearts.innerHTML = h;
        }
        e.hearts.classList.remove('hidden');
        if (e.hearts.classList.contains('heart-hit')){
          clearTimeout(e._heartT);
          e._heartT = setTimeout(()=>e.hearts.classList.remove('heart-hit'), 700);
        }
      } else e.hearts.classList.add('hidden');
    }
    if (!p.isHuman) updateSeatReels(e.chips,p.chips);
    if (p.isHuman){
      // renderBank() only ever populates a genuinely empty pile (a
      // fresh table, a rebuy, or blinds posted while it happens to be
      // sitting empty already) — it never re-derives/replaces a pile
      // that already has chips being tracked by real transfers, or a
      // completed bet's landed chips could get silently trimmed right
      // after arriving.
      renderBank();
      // Pot-smash bank-display freeze (amendment 1) — while a human
      // pot-smash ceremony is in flight (see runHumanPotSmashCeremony in
      // this file), the real p.chips is already correct, but the reel
      // readout must keep showing its pre-win value until the physical
      // chips finish being collected, so the visual story stays "chips
      // enter bank -> money appears" and never the reverse. Every render()
      // call funnels through this one line, so it doesn't matter how many
      // times render() fires during the ceremony.
      updateJackpot(humanBankDisplayFreeze!=null ? humanBankDisplayFreeze : p.chips);
      updateInvestedReel(p.totalBetHand);
      const position = g.positions && g.positions[p.id];
      $('hud-sb-indicator').classList.toggle('is-on',position==='SB');
      $('hud-bb-indicator').classList.toggle('is-on',position==='BB');
    }
    if (e.posEl){
      const label = g.positions && g.positions[p.id];
      if (label==='SB' || label==='BB'){ e.posEl.textContent = label; e.posEl.classList.remove('hidden'); }
      else e.posEl.classList.add('hidden');
    }

    const mine = p.isHuman;
    syncCardRow(e.cardsContainer, p.hand, mine ? p.hand.map(()=>false) : p.hand.map(()=>!p._reveal), !mine, 'hole');

    // Fixed action-display slot — always rendered, same footprint whether
    // a player just checked or just shoved. Replaces the old floating
    // .seat-bet chip and .seat-tag All-In pill. betThisRound itself is
    // untouched and still drives call/raise math elsewhere; this only
    // changes how the *label* is presented.
    if (e.actionSlot){
      const sa = p.streetAction;
      const label = sa ? sa.label : '–';
      // Character-length-keyed font steps (mirrors .seat-chips.chip-sz2/
      // .chip-sz3) so "Raise to 1,240" always fits on one line at full
      // digit precision instead of ellipsis-truncating meaningful info —
      // see fmtActionAmount() for the abbreviation fallback that keeps
      // even extreme values inside this smallest tier.
      const sizeCls = !sa ? '' : label.length>=14 ? ' txt-sz3' : label.length>=10 ? ' txt-sz2' : '';
      e.actionSlot.className = 'action-slot ' + (sa ? 'act-' + sa.type : 'act-empty') + sizeCls;
      e.actionSlot.textContent = label;
    }
  });

  updateHandInstrument();
  updateActionControls();
}

/* The raise tray is an overlay belonging to the fixed action region. It
   opens over the lower dashboard without changing or translating any of
   the scoreboard/felt/dashboard/action boundaries. */
function openRaisePanel(){
  const panel = $('raise-panel');
  panel.classList.add('show');
}
/* Safe to call even when the tray is already closed (finishHand/humanAct
   call it unconditionally as a reset). Performs no poker action and
   touches no game state — purely a UI close. */
function closeRaisePanel(){
  $('raise-panel').classList.remove('show');
}

function syncSliderFill(){
  const s = $('raise-slider');
  if (!s) return;
  const min = parseFloat(s.min)||0, max = parseFloat(s.max)||100, v = parseFloat(s.value)||0;
  const pct = max>min ? Math.max(0, Math.min(100, ((v-min)/(max-min))*100)) : 0;
  s.style.setProperty('--fill', pct.toFixed(1)+'%');
}

function updateActionControls(){
  const g = game;
  const banner = $('banner');
  const row = $('actions-row');
  if (!pendingHumanPlayer){
    paintBanner(bannerOverride !== null ? bannerOverride : describeCurrentTurn());
    // Persistent-but-inert: the row stays in its fixed position through AI
    // turns rather than disappearing (row visibility itself is only ever
    // toggled with 'hidden' between hands, in finishHand/concludeGame).
    // Labels reset to neutral defaults so a dimmed row never shows a stale
    // call/raise amount left over from the player's last turn.
    if (row) row.classList.add('disabled');
    const cc0 = $('btn-checkcall');
    cc0.textContent = 'Check'; cc0.className = 'btn-check';
    $('btn-raise').textContent = 'Raise';
    return;
  }
  if (row) row.classList.remove('disabled');
  const p = pendingHumanPlayer;
  const toCall = g.currentBet - p.betThisRound;
  paintActionRows('YOUR TURN',toCall>0 ? toCall.toLocaleString()+' TO CALL' : 'CHECK OR BET',false);

  const cc = $('btn-checkcall');
  cc.textContent = toCall>0 ? 'Call ' + toCall.toLocaleString() : 'Check';
  cc.className = toCall>0 ? 'btn-call' : 'btn-check';

  const raiseBtn = $('btn-raise');
  const panelOpen = $('raise-panel').classList.contains('show');
  raiseBtn.textContent = panelOpen ? 'Confirm' : (toCall>0 ? 'Raise' : 'Bet');
  $('btn-fold').classList.remove('btn-disabled');

  const maxTotal = p.chips + p.betThisRound;
  const minTotal = Math.min(maxTotal, Math.max(g.currentBet + g.minRaise, p.betThisRound + g.bigBlind));
  const slider = $('raise-slider');
  /* step MUST stay 1. A coarse step silently rewrites values assigned to a
     range input as well as real drags. Free movement keeps the mechanical
     slider smooth and guarantees the displayed total is the committed one. */
  slider.min = minTotal; slider.max = maxTotal; slider.step = 1;
  if (!panelOpen) slider.value = minTotal;
  if (parseInt(slider.value,10) < minTotal) slider.value = minTotal;

  // raising is unavailable if you've already acted and face only a short all-in,
  // or you simply can't cover a legal raise
  const canAffordRaise = maxTotal > g.currentBet;
  if (!p.mayRaise || !canAffordRaise || p.chips<=0) raiseBtn.classList.add('btn-disabled');
  else raiseBtn.classList.remove('btn-disabled');

  updateRaiseReel(parseInt(slider.value,10));
  syncSliderFill();
}

function describeCurrentTurn(){
  const g = game;
  if (g.over || ['showdown','foldwin'].includes(g.phase)) return '';
  const p = g.players[g.currentIndex];
  return p ? actionRowsHTML(p.name,'IS THINKING…',true) : '';
}

function renderLog(){
  if (!logDirty) return;
  const el = $('log-list');
  if (!el || !game) return;
  el.innerHTML = game.log.slice().reverse()
    .map(entry=>'<div'+(entry.m?' class="marker"':'')+'>'+esc(entry.t)+'</div>').join('');
  logDirty = false;
}

/* Pass 1 showdown revamp — pure DISPLAY reordering of an already-final
   winning five (the poker math is done; this only decides which order to
   lay them out in so the hand reads naturally). Straights/straight
   flushes/royals become one ascending run; flushes/high-card become
   descending rank; every grouped hand (pair, two pair, trips, full house,
   quads) groups same-rank cards together — largest/highest group first —
   with kickers trailing by descending rank. */
function arrangeHandForDisplay(cat, cards){
  if (cat===8 || cat===9 || cat===4) return cards.slice().sort((a,b)=>a.value-b.value);
  if (cat===5 || cat===0) return cards.slice().sort((a,b)=>b.value-a.value);
  const counts = {};
  cards.forEach(c=>{ counts[c.value] = (counts[c.value]||0)+1; });
  const groups = Object.keys(counts).map(v=>({value:+v, n:counts[v]}))
    .sort((a,b)=> b.n-a.n || b.value-a.value);
  const out = [];
  groups.forEach(g=>{ out.push(...cards.filter(c=>c.value===g.value)); });
  return out;
}
/* Presentation-only split of describeMade()'s combined output into a
   category line (from HAND_NAMES) and a plain descriptor line, for the
   two-line HUD result console (e.g. "TWO PAIR" / "Fours & Twos"). Does
   NOT touch hand evaluation — pure string derivation from data
   evaluate7WithCards/describeMade already produced. */
function splitHandText(cat, handStr){
  if (cat == null || !handStr) return { category:'', descriptor:'' };
  const category = HAND_NAMES[cat];
  if (cat === 9) return { category, descriptor:'' };               // Royal Flush: describeMade returns just the name, no comma to split
  if (cat === 0) return { category, descriptor: handStr };          // High Card: describeMade's default case has no category prefix at all
  const prefix = category + ', ';
  const descriptor = handStr.indexOf(prefix) === 0 ? handStr.slice(prefix.length) : handStr;
  return { category, descriptor };
}

/* Showdown result console — pass 4. Replaces the old floating winner
   plaque entirely: builds the HUD result content (see
   showHudResultConsole() below) instead of a separate .result-card
   overlay. Ports the same main/side-pot consolidation the old
   showAwardPlaque() used verbatim: primary = main pot; a side pot
   entirely swept by the (sole) main-pot winner folds into the primary
   amount instead of getting its own line; otherwise it's a secondary
   .pot-line row, the same muted idiom the session-review/gameover card
   already uses. No portrait here — see celebrateWinnerSeat(), the
   winning SEAT (or, for the human, the HUD itself) is the "who won"
   signal now, not a duplicated avatar. */
function buildResultHTML(potResults){
  const main = potResults[0];
  const mainWinnerIds = new Set(main.winnerIds);
  let primaryAmount = main.amount;
  const secondary = [];
  potResults.slice(1).forEach(pot=>{
    const sweptByMainWinner = main.winnerIds.length===1 && pot.winnerIds.every(id=>mainWinnerIds.has(id));
    if (sweptByMainWinner) primaryAmount += pot.amount;
    else secondary.push(pot);
  });

  const single = main.winnerIds.length === 1;
  const mine = main.winnerIds.indexOf('you') !== -1;
  const { category, descriptor } = splitHandText(main.cat, main.hand);

  let html = '<div class="hr-name">' + esc(main.winners.join(' & ')) + (single ? ' WINS' : ' SPLIT') + '</div>';
  if (category) html += '<div class="hr-cat">' + esc(category.toUpperCase()) + '</div>';
  if (descriptor) html += '<div class="hr-desc">' + esc(descriptor) + '</div>';
  html += '<div class="hr-label">Won</div>';
  html += '<div class="amt-readout' + (mine?' mine':'') + '" id="hud-result-amt"></div>';

  secondary.forEach(pot=>{
    const potMine = pot.winnerIds.indexOf('you') !== -1;
    const body = '<b>' + esc(pot.winners.join(' & ')) + '</b> ' + (pot.split ? 'split' : 'wins') + (pot.hand ? ' · ' + esc(pot.hand) : '');
    html += '<div class="pot-line' + (potMine?' mine':'') + '"><span class="pl-tag">' + esc(pot.label).toUpperCase() +
      '</span><span class="pl-body">' + body + '</span><span class="pl-amt">' + pot.amount.toLocaleString() + '</span></div>';
  });

  return { html, primaryAmount, mine };
}
/* One-shot payout digit-cell readout — reuses .jp-cell/.jp-digit/.tick/
   jpTick/.jp-sym verbatim (see #jackpot/buildJackpot()/updateJackpot(),
   the player's own live, diffed, 6-digit-capped bankroll counter). This
   is a deliberately separate, fresh widget: built once per hand, dynamic
   digit count (no clamp), a leading '$' cell (same static-symbol idiom
   #jackpot itself already uses) rather than a '+', with comma cells
   (.jp-comma, a narrow variant of the same static-symbol treatment) at
   the usual thousands groupings — reads as a payout/jackpot amount
   ($1,449), not a stat delta. Only the '$'/',' symbol cells are excluded
   from the digit tick reveal (see revealResultAmount, which only ever
   selects .jp-digit) — same convention #jackpot's own '$' cell follows. */
function buildResultAmount(container, amount){
  if (!container) return;
  container.innerHTML = '';
  const sym = document.createElement('span');
  sym.className = 'jp-cell jp-sym';
  sym.textContent = '$';
  container.appendChild(sym);
  Array.from(Math.max(0, amount|0).toLocaleString()).forEach(ch=>{
    const c = document.createElement('span');
    if (ch === ','){
      c.className = 'jp-cell jp-sym jp-comma';
      c.textContent = ',';
    } else {
      c.className = 'jp-cell jp-digit tabular';
      c.textContent = ch;
    }
    container.appendChild(c);
  });
}
/* Staggered per-digit "tick" reveal, reusing jpTick as-is (no new
   keyframes). The digits already show their correct final value the
   instant they're built (see buildResultAmount) — this is a pure
   flourish layered on top, never something correctness depends on. mine
   plays a slightly slower/punchier stagger so the human's own reveal
   hits harder, per the approved human-celebration adjustment. */
function revealResultAmount(container, mine){
  if (!container || motionOff()) return;
  const gap = mine ? 60 : 45;
  const digits = container.querySelectorAll('.jp-digit');
  digits.forEach((c,i)=>{
    c.classList.remove('tick');
    setTimeout(()=>{ void c.offsetWidth; c.classList.add('tick'); Sound.counterTick(mine); }, i*gap);
  });
  // SFX V1 — the firmer CLACK once the LAST digit's own tick animation
  // (jpTick, .22s) has actually finished settling, not before.
  if (digits.length) setTimeout(()=>Sound.counterLock(mine), (digits.length-1)*gap + 220);
}
/* Showdown result console — the bottom HUD (#hud-frame) temporarily
   transforms in place instead of a floating panel covering the felt.
   #hud-status-normal (banner/hand-strength/jackpot) and .hud-result
   cross-fade; #hud-status's own height is measured via offsetHeight and
   written to --status-h since the two faces are not comparable heights, unlike the
   AWARD POT console-flip's near-equal-height faces. Width MUST be
   widened (frame.classList.add('result-mode')) before the result
   content's height is measured — reading resultEl.offsetHeight forces
   the browser to lay it out at whatever width is current, so measuring
   before widening would capture the WRONG (pre-wrap) height. .seat.you's
   hole cards — always the first child of #hud-mid, see initSeats() — sit
   entirely outside #hud-status and are never touched by any of this. */
function showHudResultConsole(potResults){
  const frame = $('hud-frame'), status = $('hud-status'), resultEl = $('hud-result');
  if (!frame || !status || !resultEl) return;

  status.style.setProperty('--status-h', status.offsetHeight + 'px');
  status.classList.add('animating-height');
  void status.offsetHeight; // commit the start-height frame before the target changes, so the transition has a real 'from' state (same technique as the chip-flight pin-then-animate code)

  const { html, primaryAmount, mine } = buildResultHTML(potResults);
  resultEl.innerHTML = html;
  buildResultAmount($('hud-result-amt'), primaryAmount);

  frame.classList.add('result-mode');           // widen BEFORE measuring (see comment above)
  status.style.setProperty('--status-h', resultEl.offsetHeight + 'px');
  status.classList.add('showing-result');

  requestAnimationFrame(()=>revealResultAmount($('hud-result-amt'), mine));
}
function hideHudResultConsole(){
  const frame = $('hud-frame'), status = $('hud-status'), normalEl = $('hud-status-normal');
  if (!frame) return;
  if (!status || !status.classList.contains('showing-result')){ frame.classList.remove('result-mode'); return; }

  frame.classList.remove('result-mode');        // narrow the frame back BEFORE measuring, so the returning face's height reflects its real (narrow) wrap width
  const normalH = normalEl.offsetHeight;         // still position:absolute (showing-result not removed yet), measurable without disturbing anything
  status.style.setProperty('--status-h', normalH + 'px');
  status.classList.remove('showing-result');     // triggers the actual cross-fade + height transition back

  status.addEventListener('transitionend', function done(){
    status.classList.remove('animating-height');
    status.style.removeProperty('--status-h');
    status.removeEventListener('transitionend', done);
  });
}
function hideResultCard(){
  const el=$('result-card');
  if (el) el.remove();
  const screen=$('table-screen');
  if (screen) screen.classList.remove('run-dead');
}
/* Flips the bottom action console from the normal FOLD/CHECK/RAISE row
   over to the single AWARD POT face (or back). The underlying
   actions-row stays exactly as updateActionControls() left it — dimmed
   and non-interactive — the whole time; flipping never re-enables it. */
function showAwardConsole(label){
  const btn = $('btn-award-pot-console');
  if (btn) btn.textContent = label;
  const flip = $('console-flip');
  if (flip) flip.classList.add('flipped');
}
function hideAwardConsole(){
  const flip = $('console-flip');
  if (flip) flip.classList.remove('flipped');
}
/* Resolves once the player presses the bottom console's own AWARD POT
   face — the literal "wait as long as the player wants" mechanism. The
   press itself flips the console back to the normal row before
   resolving; the existing hideResultCard()+220ms beat right after this
   resolves gives that flip time to finish before payout continues. */
function waitForAwardPot(){
  return new Promise(resolve=>{
    const btn = $('btn-award-pot-console');
    if (!btn){ resolve(); return; }
    // SFX V1 — the KA-CHUNK: "the machine has released the pot." No
    // victory flourish here (the winner sting already played earlier,
    // see runShowdownAwardSequence) — this is purely the mechanical
    // latch/release, then the chip cascade becomes the audio star.
    btn.onclick = ()=>{ Sound.buttonRelease('award'); hideAwardConsole(); resolve(); };
    // FAST DEV — this is the one pacing point that normally waits on a
    // real tap with no timeout at all; a rapid KO-testing loop can't sit
    // here forever, so synthesize the exact same click a real press would
    // fire (same handler, same Sound/hideAwardConsole/resolve path).
    if (DEV_MODE && FAST_DEV) setTimeout(()=>{ if (btn.onclick) btn.click(); }, 60);
  });
}
/* Showdown revamp — the one shared award pipeline both handleShowdown and
   handleFoldWin delegate to. ONE consolidated moment for the whole hand,
   regardless of how many pots computePots() produced: hero-highlight the
   main pot's exact winning five on the table (skipped for a fold-win pot,
   which has no evaluated hand — see highlightWinningCards; side-pot-only
   winners deliberately do NOT get their own five-card glow, so there's
   never more than one competing highlight on the table at once — they're
   represented on the result console's secondary lines instead), react on
   the winning seat(s) (celebrateWinnerSeat), transform the bottom HUD into
   the result console (showHudResultConsole — no floating panel any more),
   wait for exactly ONE AWARD POT press, then settle every pot's money at
   once and pay every distinct winner in one coordinated burst of
   concurrent chip flights. finishHand() (and therefore any busted/rebuy
   UI, and the next-hand timer/button it arms) only runs after every one
   of those flights has genuinely finished landing — awaited for real via
   transferChips()/payoutTo()'s completion Promise, not guessed at — which
   is what makes it structurally impossible for the next hand to clear the
   pot while a payout is still visually in flight. */
async function runShowdownAwardSequence(potResults, contenders){
  const g = game;
  const winnerIds = new Set();
  potResults.forEach(pot=>pot.winnerIds.forEach(id=>winnerIds.add(id)));

  const main = potResults[0];
  if (main.cards) highlightWinningCards(main, contenders);

  winnerIds.forEach(id=>celebrateWinnerSeat(id));

  showHudResultConsole(potResults);
  const totalAmount = potResults.reduce((s,r)=>s+r.amount, 0);
  showAwardConsole('Award Pot · ' + totalAmount.toLocaleString());
  await waitForAwardPot();
  hideHudResultConsole();
  // keep the winning-five highlight visible a tiny beat longer before
  // the pot becomes the focus, per the approved sequencing.
  await (motionOff() ? sleep(0) : pacedSleep(220));

  // Captured BEFORE the real money mutation below — the one thing a
  // human pot-smash ceremony needs that isn't derivable afterwards: what
  // the stack reel should keep showing while it's frozen (see amendment 1
  // / runHumanPotSmashCeremony).
  const human = g.players.find(p=>p.isHuman);
  const preWinHumanChips = human ? human.chips : 0;

  potResults.forEach(pot=>{
    pot.winnerShares.forEach(s=>{
      const w = g.players.find(p=>p.id===s.id);
      if (w) w.chips += s.amount;
    });
    g.pot = Math.max(0, g.pot - pot.amount);
  });

  // Merge every pot's shares by player id so a player who won both the
  // main pot and a side pot gets ONE coordinated chip flight instead of
  // two separate bursts (requirement: correct multi-recipient payouts
  // that still feel like one settlement, not several modal-ish steps).
  const totalByPlayer = new Map();
  potResults.forEach(pot=>pot.winnerShares.forEach(s=>{
    totalByPlayer.set(s.id, (totalByPlayer.get(s.id)||0) + s.amount);
  }));

  let remainingPile = $('pot-stacks')._chipCount || 0;
  const ids = [...totalByPlayer.keys()];
  const visualByPlayer = new Map();
  ids.forEach((id,k)=>{
    const amt = totalByPlayer.get(id);
    const n = (k===ids.length-1) ? remainingPile
      : Math.min(remainingPile, Math.round(remainingPile * amt / Math.max(1,totalAmount)));
    remainingPile -= n;
    visualByPlayer.set(id, n);
  });

  const wasShowdown = potResults.length!==1 || potResults[0].hand!==null;
  const outcome = wasShowdown
    ? { type:'showdown', potResults, contenders, winnerIds }
    : { type:'foldwin', winner:g.players.find(p=>p.id===potResults[0].winnerIds[0]), amount:potResults[0].amount };

  // Human pot-smash ceremony (elimination/arcade mode, human won at least
  // one pot layer this hand) replaces the ordinary payoutTo() flight for
  // the human's own share only — see runHumanPotSmashCeremony/
  // runPotSmashSequence above. It owns the human's real pot-chip DOM
  // elements from #pot-stacks all the way to #hud-tower; every OTHER
  // winner this hand (any AI, on a side pot the human didn't also win)
  // still goes through the unchanged payoutTo() path, fired concurrently
  // — they have no shared pile with the human's own ceremony to contend
  // over. The freeze is armed before the FIRST render() below so the
  // stack reel never flashes the post-win amount even on that very first
  // redraw (see amendment 1).
  const humanArcadeWin = g.mode==='elimination' && g.run && g.run.arcade && totalByPlayer.has('you');
  if (humanArcadeWin) humanBankDisplayFreeze = preWinHumanChips;

  render();
  // fired concurrently, then genuinely awaited — finishHand() below is
  // unreachable until every winner's chips have actually landed.
  if (humanArcadeWin){
    const aiIds = ids.filter(id=>id!=='you');
    const aiPayout = Promise.all(aiIds.map(id=>payoutTo(g.players.find(p=>p.id===id), visualByPlayer.get(id))));
    await runHumanPotSmashCeremony(g, outcome, visualByPlayer.get('you'), preWinHumanChips);
    await aiPayout;
  } else {
    await Promise.all(ids.map(id=>payoutTo(g.players.find(p=>p.id===id), visualByPlayer.get(id))));
  }

  await finishHand(outcome);
}


