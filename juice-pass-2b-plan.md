Ready for review
Select text to add comments on the plan
Juice Pass 2B — Physical Chip Transfer System (simplified: perceptual continuity, not DOM identity)
Context
Juice Pass 2A (implemented, uncommitted) rebuilds the human bankroll and pot from scratch every render() via syncClumps() — a few real .chip-disc elements per "clump" with extra density faked via box-shadow, plus disposable .fly-chip ghosts for betting animation and a potMoundFreezeUntil timer hack to stop the resting pile from redrawing to its final shape before the ghosts finish traveling.

The user rejected this and initially asked for full persistent chip identity (the literal same DOM element traveling bank→pot). On reviewing that design, they simplified the requirement: no persistent chip identity is needed — what's needed is perceptual physical continuity. Concretely: when the human bets, the bank pile must visibly shrink chip-by-chip as each one launches (not stay full while ghosts fly out), and the pot must visibly grow chip-by-chip as each one lands (not jump to its final size early or redraw independently of the flight). The authoritative money can update instantly underneath; the visual pile counts are allowed to lag behind it for the ~300-500ms a transfer takes. This removes almost all the complexity of the previous plan (persistent pool arrays, per-chip DOM ownership, cancel/redirect tokens, slot-membership tracking) while still passing the real acceptance test: press CALL/BET/RAISE and it genuinely looks like individual chips left the visible bank pile and were added one-by-one to the visible pot.

No re-investigation was needed for this revision — line numbers/geometry below are the same facts already verified against the current working tree in the prior planning pass.

The mechanism: a "shown count" per pile, temporarily owned by an in-flight transfer
Two piles, two integers each pile's render actually uses:

let bankChipsShown = 0, potChipsShown = 0;     // what's currently drawn — allowed to lag the true value
let bankPending = 0, potPending = 0;           // how many chip-events are still outstanding for that pile
bankChipCountFor(chips) / potChipCountFor(amount) (pure functions of authoritative money, unchanged formulas from the prior plan — see below) compute the target count a pile should show once everything settles.
In render(): if bankPending===0, snap bankChipsShown = bankChipCountFor(p.chips) (and redraw); same for the pot with potPending. This is the idle/self-healing path — it's what makes every "no sensible source" case (rebuy, session start, a stray desync) resolve for free with zero special-case code, exactly like 2A's reconciliation did.
While pending>0 for a pile, render() leaves ...Shown alone — it's owned by the in-flight transfer, which is the only thing allowed to change it, one chip-event at a time.
A transfer of n chips from pile A to pile B: pendingA += n; pendingB += n up front. Each of the n chips is staggered (35-60ms apart, capped as below): at that chip's launch, shownA -= 1 (redraw A, one smaller) and pendingA -= 1; at that chip's landing (after its flight completes), shownB += 1 (redraw B, one bigger) and pendingB -= 1. Once all n chips have both launched and landed, both pendings are back to 0 and the piles exactly match their true derived targets — no drift, because n is always computed as the exact delta between the before/after target counts.
Overlapping transfers (e.g. two opponents betting in quick succession, or a bet immediately followed by a fold-win) compose correctly for free: every pile mutation is a relative +=1/-=1, not an absolute set, so concurrent staggered timelines just add up. No cancel-tokens, no per-chip ownership, no redirect logic — the previous plan's biggest source of complexity — are needed at all.
This is explicitly the "temporary lag, not a second money ledger" model the user described, made precise: the lag is bounded (exactly one animation's worth), self-correcting (idle path always snaps to the true value), and never stored as anything resembling a monetary amount — ...Shown/...Pending are visual chip counts, always derived from and converging to p.chips/game.pot.

What stays from 2A, what changes
Kept almost as-is: CHIP_DENOMS/chipTierForSlot (unchanged — still called fresh per redraw, coloring by current slot/amount, no per-chip memory needed since chips aren't individually tracked). The tower/clump geometry and measured constraints (below). The proven 3-stage release/travel/decisive-landing flight easing from flyChipVolley — reused for the new individual ghost flights essentially verbatim, just re-triggered per chip with the launch/landing hooks described above instead of fire-and-forget. .chip-disc's visual (squat puck, hard-banded gradient, pixel border, edge ticks) stays as the placeholder "resting/side" look, matching the user's "keep the artwork simple, real sprites come later" instruction.

Removed:

The box-shadow implied-extra-chip trick in syncClumps (~4298-4326) — at a 25-35 chip target and a 36-chip hard cap, every visible chip can just be a real element; there's no density-faking need at this scale, and the user explicitly wants genuinely visible individual chips, not implied ones.
potMoundFreezeUntil/freezePotMound/POT_MOUND_CATCH_MS (2886, 4635-4641, 4037) — superseded by the precise per-chip pending mechanism, which tracks real animation progress instead of guessing a fixed timeout.
flyChipsFrom/flyChipsToWinner/chipVolleyCount (4653-4664, 4668-4678, 4624-4628) — replaced by the new staggered per-chip transfer function described below (built on the same underlying flight technique, different orchestration).
2A's all-in/payout count bumps (the old +4/+5 "make it feel bigger" adjustments) — since n must now equal the exact delta driving real pile counts, inflating it would make the pile over/undershoot its target. If big moments should feel bigger, that's a flight-arc/sound/duration choice, not a count fudge.
No persistent chip pool, no chip objects, no bankChips/potChips arrays, no slotFor/tower-membership-by-index, no reparenting real elements between containers, no flight cancel-tokens. All of that is gone relative to the previous version of this plan — it existed only to support literal DOM continuity, which is no longer a requirement.

Count formulas (unchanged from the prior plan)
function bankChipCountFor(chips){
  if (!chips || chips<=0) return 0;
  const ref = (game && game.startingStack) || 1000;
  return Math.max(1, Math.min(36, Math.round(30 * Math.sqrt(chips/ref))));
}
function potChipCountFor(amount){   // same log-scale as 2A's potChipCount, cap raised 24→32
  if (!amount || amount<=0) return 0;
  const bb = (game && game.bigBlind) || 20;
  return Math.max(1, Math.min(32, Math.round(2 + 2.2*Math.log2(1 + amount/bb))));
}
~30 chips at a starting-stack-sized bankroll (within the requested 25-35 band), capped intelligently at both ends.

Geometry (measured against actual CSS, unchanged from the prior plan)
Bank (#hud-left, 897-902): 96px grid column, padding:6px 4px+border:2px → 84px usable width. At #hud-tower .chip-disc (18×11px, 907) + 2px gap: 4 towers = 78px (fits), 5 towers = 98px (doesn't). CHIP_MAX_TOWERS=4 is a measured ceiling.
Pot (#pot-stacks): felt width (max-width:560px) leaves far more room; not the binding constraint.
CHIP_PER_TOWER=9 both piles (4×9=36 exactly matches the bank cap). Chip sizes unchanged: bank 18×11px/−7px overlap, pot 24×14px/−10px overlap.
Fill order: sequential is simplest and there's no "always pull from the end" identity constraint forcing it anymore, but 2A's centre-weighted mound ordering for the pot (tallest tower in the middle) can be kept for the pot specifically since it's a pure function of shown count with no identity implications now — recommend keeping it for the pot (closer to the original visual target/mockup) and simple left-to-right sequential fill for the bank (matches the mockup's plain ascending-height row).
Rendering a pile from its shown count
Reuse 2A's syncClumps/heapLayout/potMoundLayout shape, split into a pure layout function and a diff-guarded DOM builder, minus the shadow-extra step:

function heapTowerHeights(shown){ /* same distribution 2A's heapLayout used, sequential, capped at 4×9 */ }
function potTowerHeights(shown){ /* same centre-weighted distribution 2A's potMoundLayout used, capped at 4×9 */ }
function renderPile(container, towerHeights, amount){
  // same dataset.sig diff-guard idiom as 2A's syncClumps (skip rebuild if unchanged)
  // build exactly sum(towerHeights) real .chip-disc children across towerHeights.length .chip-tower containers
  // colour via chipTierForSlot(amount, towerHeight, indexInTower) per chip, same as 2A — no per-chip memory
}
Called from render() as:

if (bankPending===0) bankChipsShown = bankChipCountFor(p.chips);
renderPile($('hud-tower'), heapTowerHeights(bankChipsShown), p.chips);
if (potPending===0) potChipsShown = potChipCountFor(g.pot);
renderPile($('pot-stacks'), potTowerHeights(potChipsShown), g.pot);
The transfer primitive
function chipStaggerGap(n){ return Math.max(35, Math.min(60, Math.round(300/Math.max(1,n)))); }

/* Moves `n` visual chips from one pile's shown-count to another's, as
   individually staggered ghost flights (reusing flyChipVolley's proven
   3-stage timing/easing). decSrc()/incDst() are called exactly once per
   chip, at that chip's own launch/landing — never in bulk — so the piles
   visibly shrink/grow gradually across the whole transfer instead of
   jumping. srcRect/dstRect are recomputed live per chip (getBoundingClientRect
   on the actual container elements), matching how 2A's flights already work. */
function transferPile(n, srcContainer, dstContainer, decSrc, incDst, addPending){
  if (n<=0) return;
  if (motionOff()){ for (let i=0;i<n;i++){ decSrc(); } for (let i=0;i<n;i++){ incDst(); } return; } // resolves same-tick, no pending needed
  addPending(n, n);   // pendingSrc += n, pendingDst += n
  const gap = chipStaggerGap(n);
  for (let i=0;i<n;i++){
    setTimeout(()=>{
      decSrc();                                   // shrink source now — visible immediately
      const a = srcContainer.getBoundingClientRect();
      const b = dstContainer.getBoundingClientRect();
      const ghost = spawnFlightGhost(a, b);        // same fixed-position .fly-chip technique as 2A
      settleGhost(ghost, ()=>{ incDst(); });        // grow destination only once this specific chip lands
    }, Math.min(i,11)*gap);   // stagger cap like 2A's flight — beyond ~12, later chips launch together
  }
}
Call-site integration
applyAction() (3309) — snapshot chips/pot before commitTo mutates them (no snapshot exists today), replace the current flight trigger (~3395):

const chipsBefore = player.chips, potBefore = g.pot;   // top of function
...
if (action!=='fold' && action!=='check'){
  if (player.isHuman){
    const n = Math.max(1, bankChipCountFor(chipsBefore) - bankChipCountFor(player.chips));
    transferPile(n, $('hud-tower'), $('pot-area'),
      ()=>{ bankChipsShown--; renderBank(); }, ()=>{ potChipsShown++; renderPot(); },
      (s,d)=>{ bankPending+=s; potPending+=d; });
  } else {
    const n = Math.max(1, potChipCountFor(g.pot) - potChipCountFor(potBefore));
    transferPile(n, seatEls[player.id].chips, $('pot-area'),
      ()=>{}, ()=>{ potChipsShown++; renderPot(); },              // no source pile for opponents
      (s,d)=>{ potPending+=d; });                                  // only the destination accrues pending
  }
}
(renderBank/renderPot are the two small render()-called wrappers shown above, callable standalone so the transfer hooks can trigger an immediate redraw without waiting for the next full render() tick.)

handleFoldWin() (3417) and handleShowdown() (3448) — replace the flight trigger(s) (3430, 3538) with a shared payoutTo(winner, n):

function payoutTo(winner, n){
  transferPile(n, $('pot-area'), winner.isHuman ? $('hud-tower') : seatEls[winner.id].chips,
    ()=>{ potChipsShown--; renderPot(); },
    winner.isHuman ? ()=>{ bankChipsShown++; renderBank(); } : ()=>{},
    (s,d)=>{ potPending+=s; if (winner.isHuman) bankPending+=d; });
}
Fold-win: payoutTo(winner, potChipsShown) (the whole current pot). Showdown/split pots: same largest-remainder proportional split as before (this part of the prior plan is unchanged and still correct — it only ever operated on counts, never on chip identity):

const ids = Array.from(winnerIds);
const startPool = potChipsShown;
const totalAward = ids.reduce((s,id)=>s+(g.players.find(p=>p.id===id)._award||0), 0);
let remaining = startPool;
ids.forEach((id,i)=>{
  const w = g.players.find(p=>p.id===id);
  const n = (i===ids.length-1) ? remaining : Math.min(remaining, Math.round(startPool*(w._award||0)/totalAward));
  remaining -= n;
  payoutTo(w, n);
});
initSeats() (4470) — reset bankChipsShown=potChipsShown=0; bankPending=potPending=0; alongside the existing human-specific setup block; the next render() naturally pops the bank to its starting-stack target with no special-case code (idle path, described above).

render() (4680) — delete the potFrozen branch (~4701-4709) and the syncClumps calls (pot + hud-tower), replace with the idle-snap + renderPile calls shown in the rendering section above.

clearAllCardDOM() (4444) — replace potStacks.innerHTML='' with clearing $('pot-stacks').innerHTML='' plus potChipsShown=0; potPending=0; so a hand boundary can't leave a stale pending count blocking future idle-snaps.

Human rebuy (5421) — no new code; the idle-snap path in render() handles it exactly like every other "money changed with no natural transfer source" case.

Risks / explicit flags
motionOff() must resolve decSrc/incDst synchronously (shown loop, no pending accrual) rather than skipping the transfer outright — the pile counts still have to end up correct even with animation off.
Stagger cap: capping the index (not the count) at 12 keeps a large flight's total launch window bounded regardless of how big n gets, consistent with 2A's own approach.
A hand ending mid-transfer (e.g. a fold-win right after a raise whose chips are still landing): payoutTo reads whatever potChipsShown is at that moment — if a couple of that raise's chips haven't landed yet, the payout flies out slightly fewer than the eventual true total, while the last arriving raise-chips land moments later. This is a real, accepted visual edge case (money is never wrong, just a brief overlap in a fast sequence) — restrained-first-pass, not worth special-casing now.
DOM churn: up to 36 bank + 32 pot real elements, rebuilt via the diff-guarded renderPile (only when shown/amount actually changed) — cheap, well below any real mobile perf concern, less churn than the existing card-dealing system already produces every hand.
Denomination coloring recomputes per redraw rather than being fixed per chip — this is correct and intentional now (no chip identity to keep it stable against), and matches how 2A already worked before this system existed.
Staged implementation order
shown/pending state + idle-snap rendering, no transfers yet. bankChipCountFor/potChipCountFor, heapTowerHeights/potTowerHeights, renderPile, wired into render()'s idle-snap path and initSeats()'s reset. Every money change (bets, payouts, rebuys) just idle-snaps instantly — proves the real-element geometry/coloring in isolation, no animation risk yet.
transferPile + the human-bet call site only. Verify: pressing Call/Bet/Raise visibly shrinks the HUD tower chip-by-chip and grows the pot chip-by-chip, staggered, with the correct final counts.
Extend to payouts (handleFoldWin, then handleShowdown's proportional loop) — same primitive, opposite direction.
Opponent-sourced pot growth (no source pile side) and pot→opponent payout (no destination pile side).
Delete obsolete 2A code (shadow-extra logic, freeze mechanism, old flight/count functions) — last, after confirming no remaining references.
Polish/verify — stagger feel, motionOff() correctness, split-pot test, rapid bet-then-fold-win test, rebuy test.
Verification
No poker-logic changes. Verification is visual, on the real device, per prior guidance. Specifically exercise: a human bet/call/raise (bank shrinks and pot grows chip-by-chip, staggered, never jumping), an all-in, a fold-win immediately after a raise, a split pot with 2+ winners, a human showdown win (pot drains into the HUD tower chip-by-chip), an opponent win (pot chips fly to their board and vanish), a rebuy, and reduced-motion mode (counts still end up correct, no animation).