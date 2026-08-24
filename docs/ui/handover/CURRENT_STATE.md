# Current visual-system state

This file records the owner decisions that are active at handover. “Selected” means approved for continued Lab development, not approved for production migration.

## Directional north star

Poker Faces is a strange, tactile, pixel-art poker machine covered in velvet and built from visible physical parts. It is not a clean modern app with retro decoration.

Preserve:

- portrait, iPhone-first composition;
- theatrical table space and deliberately dense lower console;
- chunky pixel geometry, hard shadows and stepped highlights;
- velvet, leather, polished wood and old electronic instrumentation;
- original cards, chips, characters, sprites and logo artwork;
- asymmetry and authored detail where they give a component personality;
- real screen layouts unless a separate layout change is approved.

Standardise construction and semantics, not every screen's composition.

## Durable owner decisions

| Area | Status | Current decision |
|---|---|---|
| Main Menu | Locked reference | Canonical menu/cabinet/shell aesthetic. Do not modify yet. |
| Main Menu Continue | Shelved | Known issue; leave untouched and do not let it distort the wider system. |
| Live-table action buttons | Locked reference | Production FOLD/CALL/CHECK/RAISE construction remains the canonical large-action family. |
| Menu/launch control | **In production** | B0 current cartridge with B0-C Soft Spring motion, on the menu control family only. Live-table action buttons keep their own press. |
| CRT housing | **In production** | C0 Current Upgrade. Recessed physical housing, deep bezel, near-black glass. |
| CRT visual effect | **In production** | C0-G Static Burst, delivered by retuning the existing `crtRefresh` keyframes that `paintCRT()` already triggers. |
| Printed markings | **In production** | P0 Production ink. P4 Etched fill was selected earlier and then superseded when the set was judged in the real game. |
| Animated reflection | Rejected | No moving glass-reflection sweep. Static scanlines/vignette and text/signal behaviour are allowed. |
| Frames | **Resolved** | F0 Current Baseline. F2, F3 and F5 were tried on the assembled console and in the real game; the baseline chassis was kept. |
| Mechanical numbers | Locked reference | Keep the existing production reel/stack/score treatment. The N0–N6 Lab exploration was rejected and removed. |
| Player dashboard | Layout locked | Exact production geometry, content, cards, chips, sprites, information placement and relationship to table. Only a future conservative visual correction may be explored. |
| TABLE CLEARED | Preservation locked | Strong production reference. Preserve full scale, information layout, stage/wheel relationship and physical presence. |
| RUN OVER | Future sibling | Eventually use the same chassis and mechanical stage as TABLE CLEARED with negative content/semantics. Do not modify either result now. |
| Hand Rankings | Future pilot | Still the intended first production migration, but only after Lab and composite approval. |
| Settings | Future treatment | Quieter utility sheet using shared construction; not part of the immediate task. |
| `assets/ui/` | Untouched | Its intended artwork role has not been discussed. Do not inspect, move, stage or alter it. |

## Semantic material and output grammar

### Physical component

Cabinets, textured boards, frames, bezels, buttons, switches and label plates are physical.

- They use hard edges, authored texture, visible thickness and tactile depth.
- Their text is printed on the part.
- Printed text never glows, flickers, blinks or animates.

### CRT output

A CRT displays information that changes while the machine operates.

- The screen is visibly recessed into a textured physical board.
- Near-black glass remains visually dominant across themes.
- Fine scanlines, corner vignette, slight uneven luminance and restrained bloom are appropriate.
- Text may flicker or stutter occasionally.
- A content change should blink/resynchronise like a finite channel change.
- Persistent blinking is reserved for warnings, awaiting action and genuine live processes.
- No moving reflection animation.

### Mechanical number

A mechanical number is a physically counted, accumulated or settled quantity.

- Use the current production reel system.
- It rolls vertically through intermediate digits, overshoots slightly and settles in staggered reels.
- Reduced motion settles directly.
- Do not introduce a new generic counter design.

### Printed output

Printed markings are decided. The treatment is P4 Etched fill.

- Button legends, panel headings, tiny instrument labels and static result-stage labels are printed.
- They need a consistent hierarchy but must remain visibly attached to physical parts.
- The wording is cut into the part and flooded with pigment: a dark cut above each letter, a lit lip below it, and a fill brighter than the surrounding material.
- Tracking opens slightly relative to the older production ink. The header pixel face and uppercase setting are unchanged.
- Printed text still never glows, flickers, blinks, scrolls or inherits CRT behaviour.
- Semantic printed pigments are fixed across themes, like the CRT roles: gold is money at rest, coral is danger and destructive action. Printed pigment stays below CRT light in brightness.
- Unavailable wording dims the whole control, as production already does, rather than being reprinted in its own style.

The Lab specimen demonstrates the hierarchy across a large button legend, a
cabinet heading, small instrument labels, a money/statistic marking, a
warning/destructive marking and unavailable wording, all on one physical carrier.

## Semantic colour rules

Themes control machine materials and interface roles, not authored content artwork.

| Role | Direction |
|---|---|
| Ordinary machine information | Green or amber family; restrained. |
| Live/current table information | Pale blue. |
| Money, reward, restrained positive result | Warm gold. |
| Danger, defeat, destructive action | Coral/red. |
| CRT glass and deep wells | Near-neutral black, not a monochrome theme wash. |
| Cards, suits, chips, faces, logos and sprites | Preserve authored colours unless an existing deliberate variant applies. |

The active production themes are `emerald`, `midnight`, `burgundy` and `slate`.

## Current Design Lab selection matrix

| Lab family | Visible IDs | Current owner state | Durable interpretation |
|---|---|---|---|
| Frames & Panels | F0–F6 | Shortlist: F0, F2, F3, F5 | Traits to test in a later composite; no final frame. |
| B0 Press Motion | B0-A–B0-G | Selected: B0-C | B0 face/construction plus Soft Spring motion. |
| C0 CRT Effects | C0-A–C0-G | Selected: C0-G | C0 construction plus Static Burst visual behaviour. |
| Printed Markings | P0–P4 | Selected: P0 | Production ink, applied consistently. P4 superseded. |

Browser selection order may display the frame shortlist as `F0, F3, F2, F5`; the set, not the order, is meaningful.

## Selection storage

The active Lab reads only these isolated keys:

- `pokerFaces.designLab.frames.v1`
- `pokerFaces.designLab.buttonMotion.v1`
- `pokerFaces.designLab.crtEffects.v1`
- `pokerFaces.designLab.printedLabels.v1`

Older experimental keys may still exist in one browser profile, but the active Lab no longer reads them:

- `pokerFaces.designLab.buttons.v1`
- `pokerFaces.designLab.crts.v1`
- `pokerFaces.designLab.readouts.v1`

Do not rely on browser storage for project truth. A new browser profile will not contain the owner's selections; use this document.

## Production migration — completed 24 August 2026

The owner approved and the system is now live in the game. It is delivered by a
single new stylesheet, `css/06-machine-system.css`, loaded last so it layers over
the existing sheets without editing them.

Shipped:

- P0 Production ink for printed markings, including removing the glow that the
  result name previously carried, since printed text does not glow.
- C0 Current Upgrade recessed near-black CRT glass.
- C0-G Static Burst, by retuning the existing `crtRefresh` keyframes.
- B0-C Soft Spring on the menu control family.
- F0 baseline chassis, unchanged.
- Machine construction for the six screens that never had it: Classic table
  setup, Hand rankings, Score/awards, Career event list and Settings.
- Result stage: rim retimed from the bespoke teal to `--theme-rim`, board
  surround changed to cabinet material, and the board/frame gap made concentric
  and breakpoint-safe via `--stage-gap`.
- RUN OVER given the stage chassis and a rolling entrance matching TABLE
  CLEARED, by redefining the existing `runOverReportIn` keyframes.

**No JavaScript was changed.** No gameplay, poker logic, Career logic, saves,
statistics or results logic was touched. Production changes outside the new
stylesheet are two lines: the `<link>` in `index.html`, and the new file plus a
`CACHE_NAME` bump in `sw.js` so installed PWAs pick up the new shell.

Reverting is removing the one `<link>`.

## Still not authorised

A dashboard geometry correction, replacement authored artwork, or a shared
JavaScript component framework. RUN OVER matches TABLE CLEARED in look and
motion but is still architecturally a separate report card; making them one
chassis would need a change to results JavaScript.
