# The Table UI grammar

This document records the current isolated Design Lab direction. It is not approval to migrate a production screen.

## Physical machine

The textured board, cabinet, frames, bezels, buttons and switches are physical parts. They have hard edges, authored texture, visible thickness and tactile travel.

Text attached to a physical part is printed text. Printed text does not glow, flicker, blink or animate.

Examples:

- Button legends
- Panel and instrument labels
- Submenu headings
- Result-stage face labels

Printed markings use the P0 Production ink treatment: dark ink on a light face
carries a single pixel of light beneath it, and pale ink on a dark plate lies
flat. The header pixel face, uppercase setting and the printed hierarchy of
legend, heading, small label and semantic label are unchanged from production.

P4 Etched fill was selected first and then superseded once the whole set was
judged in the real game. Do not revive it without a new decision.

Semantic printed pigments are fixed rather than theme-derived, in the same way
the CRT roles are: gold means money at rest, coral means danger and destructive
action. Printed pigment sits below CRT light in brightness, because it is ink
rather than a lit phosphor.

Unavailable wording is dimmed as a whole control, as production already does. It
is not reprinted in a separate style.

## CRT output

A CRT displays information that can change while the machine is operating.

Examples:

- Previous actions
- The player's current hand description
- Awaiting-action and live-process messages
- Warnings
- Changeable supporting statistics

Every CRT is visibly recessed into the physical board with a thick housing, deep bezel, near-black convex glass, static scanlines, vignette, uneven illumination and restrained phosphor bloom.

CRT text has a subtle, occasional idle flicker or horizontal stutter. When its content changes it briefly blinks out and resynchronises like a channel change before settling on the new information. Persistent blinking is reserved for warnings, awaiting action and live processes.

Glass-reflection animation is not part of the system.

Semantic CRT colours:

- Green or amber: ordinary machine information
- Pale blue: live or current table information
- Gold: money, reward and restrained positive information
- Coral or red: danger, defeat and warnings

## Mechanical numbers

A rolling number represents a quantity being physically counted, accumulated or settled. The existing production reel treatment remains canonical. It uses vertical reels with visible intermediate digits, slight overshoot and independently staggered settling.

Use mechanical numbers for important totals such as score, winnings and other result-defining quantities. Ordinary supporting statistics remain CRT output or printed text according to whether they change.

Reduced motion resolves reels directly to their settled value.

The separate N0–N6 Design Lab readout exploration was rejected in full and removed. Do not invent a replacement counter style or revive those candidates.

## Major results

TABLE CLEARED and RUN OVER are two outcomes from the same physical result-stage chassis.

- The result name is printed on the rotating physical stage face.
- The important score or total is a mechanical number.
- Supporting changeable statistics are recessed CRT instruments.
- Positive and negative outcomes change semantic illumination and content, not chassis geometry.

## Current boundary

The UI Lab is the only implementation surface. No production screen, dashboard, gameplay system, save data, Career logic, service worker or manifest is changed until the Lab is approved.

## Current owner selections

- Frames: F0 Current Baseline. F2, F3 and F5 were tried on the assembled console and in the game, and the baseline was kept.
- Menu/launch button: retain the B0 current-cartridge construction with B0-C Soft Spring motion.
- Live-table large actions: production FOLD/CALL/RAISE remain their own canonical family and are untouched.
- CRT housing: C0 Current Upgrade.
- CRT visual behaviour: C0-G Static Burst.
- Printed markings: P0 Production ink.
- Mechanical numbers: retain the existing production treatment without a new Lab design.
- Major results: preserve the production TABLE CLEARED scale and chassis; RUN OVER must eventually become its negative sibling, but neither is approved for modification yet.

Selections recorded in browser storage are convenience state only. This document and the handover package are the durable source of truth.

## Rejected directions

- Redesigned or compacted player-dashboard geometry.
- Replacement cards, chips or other authored artwork.
- Animated glass reflections.
- Beige/serif/typewriter visual direction.
- Hardcoded single-palette styling or monochrome palette washes.
- Broad button-frame variation as a substitute for changing the button itself.
- Excessive button travel that appears to push through the cabinet.
- The complete N0–N6 mechanical-readout exploration.
- Clean modern UI, generic mobile buttons, thin cards or flattened machine depth.

## Current state

The system is live in the game as of 24 August 2026, delivered by
`css/06-machine-system.css`. See `handover/CURRENT_STATE.md` for exactly what
shipped and what remains unauthorised.

The isolated Design Lab (`design-lab.html`) and the comparison harness
(`preview.html`) remain in the repository as untracked working surfaces. Note
that "Original" in the harness now means the migrated game, not the
pre-migration one.
