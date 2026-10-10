# Poker Faces — Pack Opening Lab, Pass 2

2026-10-10. Built in the isolated `career-pack-opening-lab.html` after the owner
rejected Pass 1 and explicitly authorised a substantial tactile rebuild.

## What changed

The same packet and contents now persist from selection through tearing,
extraction, handling, inspection and the received pile. Cards begin inside a
clipped pocket, between rear lining and front foil; their lower sections remain
occluded during the pull. Partial tears retain their jagged damage and curled
strip. The detached strip and collapsed wrapper remain movable on the felt.

The extracted stack is face-up. Drag follows the hand directly; tilt and landing
settle with springs. Short peeks retain the current find; deliberate flicks park
it nearby. Received cards remain reachable, with stack fanning, spread, revisit
and gathering controls. Automatic card flips and fly-off-screen transitions are
removed. Manual turning uses connected front, reverse and stock-edge surfaces.

Inspection lifts the same card on the same table. Event name, rarity and prize
appear above it, with event details and synopsis below. The rejected optical
reader is removed. Drag rotates the whole object; turn/front controls and Escape
return are also available. The original handling pose is restored on return.

All 16 approved Table/Bomb/Wild/Freezeout invitation faces and illustrative
prizes remain supplied by the existing shared lab renderer. First discoveries
have finite material/light/audio accents. Bomb sheds external hot pixels; Wild
has displaced print and an expressive tilt response; premium Freezeout finds
have cold motes. Revisits do not replay the discovery ceremony. Rarity effects
never require a separate blocking reveal screen.

The chip find is a compact foil sleeve with a hanging reward tag. Pouring it
releases 8 or 10 actual current gameplay chips, using the seven colour families
and their three sprite variants. They emerge at the sleeve mouth, fall, bounce,
clack, overlap and remain draggable. The amount readout uses four drums. An
optional sixth find shows the authentic Classic card back with a paper band.
No invented sample chips or cabinet swatches remain.

## Critical review and corrections

Functional success in Pass 1 did not establish a good opening experience. This
pass reviewed the object's visual continuity, contact, timing, phone layout and
static artwork as separate concerns.

| Finding during review | Correction |
|---|---|
| Opening controls fell below the short-phone viewport | Compressed short-phone instrumentation and made stage height responsive; main controls checked at 320px and 375×667 |
| Inspection dimmed the very card being examined | Lifted that same node above the dimmed scene; kept readable information above/below |
| Wrapper cast an oversized flat shadow | Scoped packet contact shadow and matched turning shadows to object orientation |
| Spring translation lagged behind a held card | Direct hand-following translation; springs reserved for settling and angular response |
| A narrow chip sleeve left an oversized next card behind it | Rested the waiting stack smaller and to the left during chip handling |
| Chip reward read like a generic large voucher | Built a foil sleeve and separate hanging paper tag |
| Chip pile obscured the next invitation's prize | Moved the landing zone lower on the felt and preserved the sleeve-mouth launch origin |
| Cosmetic sample read as a poster containing a tiny item | Made the authentic card-back print fill the object, with a small paper band |
| Top crimping vanished behind the packet front at some angles | Corrected foil/seal depth order; checked sealed, reverse and torn views |
| Packet reverse felt less authored than its front | Reused the authored reverse artwork, with contents count matching five/six finds |
| Chip sound was too much like a reward tone | Shortened it into a brief high/low contact clack |
| Cold particles gave ordinary Freezeout too much ceremony | Reserved that accent for Rare/Legendary |
| Tall desktop fixed heights wasted or exceeded available space | Bound normal and inspection stages to viewport height; focused checks at 900×740 and 768×1024 |

These revisions address observed shortcomings. They do not establish the owner's
subjective approval or claim a numerical quality score.

## Assessment against the brief

**Physical continuity:** verified persistent node identity from packet pocket to
felt to inspection. Mouth occlusion, partial tearing, the detached strip, manual
turning, short peeks, received cards and pouring were inspected in staged frames
and a recorded sequence. This is controlled 2.5D presentation, not a full material
or rigid-body simulation.

**Player agency:** packet handling, rip/draw, card movement, fanning, manual
turning, chip movement and revisits are active interactions. Cancelling a draw
returns it; cancelling a card gesture does not advance. A partial tear keeps its
physical damage. Buttons provide equivalents and preserve the same objects.

**Poker Faces identity:** the felt/burgundy/mustard machine, authored foil packets,
approved pixel invitations, chunky stock/shadows, current game chips and Classic
back use the established palette and artwork. This assessment is a visual review,
not owner sign-off.

**Desirable discovery:** static rarity construction remains the primary signal.
The first encounter adds finite material/sound response and distinct Bomb/Wild/
Freezeout personality. Ordinary and two-Legendary fixtures were checked, as were
muted and Reduced Motion openings. Audio balance still needs a real phone listen.

**Robust handling:** browser and touch checks cover interruption, returns,
repeated openings, narrow layouts and cleanup. No production storage is written.
Real-device latency, thermal performance and refresh-rate behaviour are unproven.

## Verification and evidence

- 346 browser assertions across eight complete packets, including 41 inspection
  cycles and all 16 invitation editions. Sizes: 320×700, 375×667, 390×844,
  430×932 and 768×1024. Ordinary, double-Legendary and cosmetic fixtures included.
- 20 real dispatched touch assertions plus three repeated Reduced Motion/muted
  openings: partial tear cancellation/resume, cancelled extraction, successful
  extraction, peek, cancelled drag, deliberate flick, inspection rotation, chip
  pour/nudge, reset during tear and mid-tear motion switch.
- Persistent objects, contents order/count, return/revisit, whole-object turns,
  inspection bounds, reachable main controls, no horizontal overflow, no storage
  writes and no browser errors checked.
- Focused final sealed/reverse/torn/inspection checks at 390×844, 900×740 and
  768×1024 after the final seam and responsive corrections.
- 115 Career event checks and 41 Career result checks pass. Implementation and
  browser/touch check script syntax pass.
- Captures: `validation/career-pack-opening-screenshots/pass2/`. Representative
  peek, flick, pouring, chip pile, Bomb reveal/inspection/reverse and keeping
  frames accompany `opening-motion.webm`.

Reproducible check scripts:
`validation/career-pack-opening-browser-checks.cjs` and
`validation/career-pack-opening-touch-checks.cjs`.
They use externally available Playwright and install no dependency. Optional
`POKER_PLAYWRIGHT_MODULE` resolves that existing module; `POKER_CHROMIUM` selects
an existing executable; `POKER_LAB_ORIGIN` overrides the local preview origin.
Default origin is `http://127.0.0.1:8766`.

## Remaining review

Owner experience review is next, followed by actual iPhone touch/audio/timing
review. Browser captures and emulated touch cannot prove 120Hz feel or that the
moment is satisfying to the owner. No claim of a 10/10 or owner approval is made.

This lab uses fixed review contents and illustrative prices/event terms. Bomb
and Wild formats remain explicitly under review. No odds, purchase, inventory,
duplicate, cosmetic ownership, bankroll or redemption logic is implemented.
Production poker, save/settings/statistics and PWA integration are untouched by
this pass. No dependencies, commit or merge were added. Production next task
remains unchanged.
