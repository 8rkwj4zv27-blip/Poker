# Poker Faces — Opening Bench, Pass 1

2026-10-10. Isolated playable prototype; agent assessment ready for owner review.
The owner authorised the build and requested a digital card reader instead of
printed invitation reverses. This is not a production pack implementation.

## Built experience

`career-pack-opening-lab.html` presents three foil packets on green felt inside
the burgundy machine: silver/oxblood House, green/mint Club and dark/gold Reserve.
Their illustrative issue prices are $100 / $300 / $1,000. Pickup, tilt, packet
reverse inspection and return are available before breaking the seal.

Drag the broad seam sideways to rip, then pull the exposed stack upward. The
empty wrapper slumps to the corner; its torn strip stays on the felt. Flick
through four invitations and a physical extra, revisit discoveries, then lay
out all five finds. Each phase also has a labelled physical control. Arrow keys
move between finds, and Escape ejects the reader or returns a sealed packet.

All 16 existing event/rarity editions are reused as actual HTML/SVG objects.
They remain available in the original Card Visual Lab. Four mixed review sets
cover every pair; ordinary and double-Legendary studies test contrasting rhythms.
LOAD STUDY resets the starting fixture; packet series and subsequent fresh
openings vary the coverage row. Order is fixed on selection and is never sorted
or rerolled during opening. These studies do not model production probabilities.

Tap a find to seat it between optical-reader rails. Its face stays visible while
the CRT shows event name, matching prize, format, field, stack, blind pace and
synopsis. EJECT restores the exact reveal position and focus. Table and
Freezeout terms are illustrative; Bomb and Wild display special-event flavour
with unsettled conditions labelled FORMAT UNDER REVIEW. Their game rules have
not been defined by this visual lab.

Physical extras: a mint chip with a real PF reverse stamp, the Night Shift card
back and an oxblood/brass cabinet swatch. The swatch can preview its trim locally
on this bench. The chip still turns instantly with Reduced Motion enabled.

## Critical assessment and corrections

**Packet desirability.** The original top seal overwhelmed the packet at choice
size and a second drawn crimp remained after lifting it. Refined the cap while
retaining its broad hit area, removed the duplicate crimp, corrected Reserve's
caption/rule collision and matched the discarded foil to its packet. All three
prints are recognisable at 320px and share one believable construction.

**Handling continuity.** An instant wrapper relocation made extraction feel like
a screen replacement. It now settles concurrently with the rising stack. The
torn mouth appears during the committed rip; the exposed stack gives a broad
upward grip. Short/cancelled tears return sealed. This is a bounded, staged
physical illusion rather than a free-form tear simulation.

**Rarity hierarchy.** Authored card compositions and stock establish value before
effects. Initial back-turn plus face-settle timing is 270ms Common, 330ms
Uncommon, 430ms Rare and 660ms Legendary. A subsequent find also includes a
210ms departure; first extraction adds 460ms. Legendary gets a local bench-light
echo and its own finite material response. Sound uses foil/paper noise, dry
landings, a chip clack and restrained tier accents. Revisits use a 160ms settle
without another discovery ceremony. No required reading pause follows landing.

**Stable machine.** Revealed finds originally increased cabinet height. Their
46px pocket is now reserved from the choice frame. The hint area also retains
its height. The cabinet stays stable through choice, handling, opening, every
reveal and final spread at all tested sizes.

**Reader quality.** A broad reader heading selector accidentally recoloured and
resized card titles. It is now scoped to the CRT. All 16 inspected titles match
their original styling. The chip and label originally overlapped; a physical
vertical arrangement now keeps the name clear. Found-pocket extras use actual
miniature objects rather than placeholder symbols. The face-up card and digital
brief read as parts of one Poker Faces machine.

**Interaction safety.** Card capture is attached to the actual object so a tap
reliably opens its reader. Inspection tilt and stack advance belong to different
states. A gesture commits at most one transition; reset cancels obsolete
animations/audio and defeats stale completions. Returning preserves contents
and cursor. Mute stops currently scheduled sources as well as future sounds.

**Assessment.** This is a cohesive and polished prototype of the requested
opening moment: attractive sealed objects, a hand-led opening, distinctive
discoveries and calm inspection. The physical extras break the invitation
rhythm without introducing another reward UI. Its strongest moment is lifting
a premium card into the reader while the material stays responsive above the
CRT. Browser evidence supports presenting it for owner experience review; it
does not establish real-device feel or parity with a shipped commercial game.

## Verification evidence

- 90 inspect/return cycles: 320×700, 375×667, 390×844, 393×852, 430×932 and
  1024×900; three packet series and all five objects per opening.
- All 16 event/rarity pairs reachable, all six studies checked, reader/front
  prizes agree, exact cursor restored, original title styles preserved.
- All packet fronts/reverses, the torn packet, all 16 readers, all three extras,
  representative reveals and the final contents spread captured. Tear,
  extraction and face-settle animation frames were inspected separately.
- Emulated touch: foil handling, short/cancelled/committed tears, exposed-stack
  pull, cancelled and committed flick, actual card tap and reader tilt/release.
- Mouse Wild Legendary wink and release reset; chip stamp reversal; keyboard
  previous/Escape and return focus; trim preview/restore.
- Reset during tear, extraction and reveal; Reduced Motion switched during an
  opening; system Reduced Motion; mute removes active and future audio sources.
- No horizontal overflow, cabinet growth, observed page errors or localStorage
  writes. Original 16-card drawer screenshots are byte-identical after the
  shared lab-renderer extraction. Syntax and whitespace checks pass. Existing
  Career suites: 115 event checks and 41 result checks pass.

Screenshots: `validation/career-pack-opening-screenshots/`. Browser checks used
the available bundled Playwright/Chromium runtime; no repository dependency was
added. Screen emulation and staged frames do not prove iPhone Safari audio,
finger feel, compositor smoothness or 120Hz performance. Synthesised audio
lifecycle was verified; a listening pass on the target phone remains pending.

## Scope and next review

New scoped HTML/CSS/controller plus a lab-only shared renderer. Only the Card
Visual Lab's script wiring/controller changes to reuse that renderer. Original
card CSS, authored art, prizes and interactions remain the visual baseline.
Career documents record this owner-directed milestone; production phase order
is unchanged. No production logic, save/settings/statistics, inventory,
ownership, purchasing, rules, dependencies, commit or merge changed.

Next: owner experience review and real iPhone timing/audio/material assessment.
Final Bomb/Wild formats, drop rates and production reward handling remain
separate decisions. Do not mark owner approval or device verification complete
from this agent assessment.
