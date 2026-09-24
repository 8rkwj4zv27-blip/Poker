# Dashboard V2

Polish pass over the player's dashboard (the bottom HUD and the button bay).
Approved direction, 24 September 2026: **keep the layout, finish the
machine**. Three bays, the card slot, the three big buttons and their
relationship to the table stay where they are; the housing, recesses,
lamps, labels, alignment and small parts change.

Status: **Lab built, awaiting the owner's picks.** Nothing here is live.

- Lab: `dashboard-lab.html` (isolated, never linked from production).
- Candidates: `css/dashboard-v2.css`, every option behind a
  `data-dv-<part>` attribute on `<html>`. No attribute = V1.

## What reads as V1

1. Case: a flat panel with a thin outline, not the Home cabinet's layered
   construction.
2. Chip bank: a black void, chips in one corner, no floor or label.
3. Card slot: the cards hang over a thin lip that looks clipped.
4. Screens: hand name and turn message are two loose boxes; STACK is loose
   text; the counter's thick gold frame is unlike anything else.
5. Right bay: SB/BB read as grey blocks, not lamps; its printed label
   glows (printed text shouldn't); uneven spacing; a dark strip on top.
6. Button bay: the buttons sit under a thin divider, not in a housing.
7. Raise drawer: form-like keys and slider.
8. Your turn: nothing on the machine shows it's waiting for you.
9. **Bug found while measuring:** on short phones (320×700, 390×664) V1
   clips the bottom of the stack counter by 8–13px. Every V2 stack option
   fixes this.

## Parts and options

| Part | V1 | Options |
|---|---|---|
| Case | as live | `tidy` · `cabinet` · `bolted` |
| Chip bank | as live | `tray` (felt-lined, lit floor, BANK printed) · `vault` (dark glass, gauge scale, cream plate) |
| Card slot | as live | `deep` (deeper slot, bevelled lip, notch) · `clamp` (riveted brass rail) |
| Screens | as live | `plate` (both screens seated in one raised plate) |
| Stack | as live | `plate` (gold only in the digits, STACK tab) · `window` (plate plus a meter-window surround) |
| Right bay | as live | `lamps` (SB/BB pilot lamps, flat print) · `grille` (lamps plus a slotted grille) |
| Button bay | as live | `cradle` · `hinge` (cradle plus a riveted hinge) |
| Raise drawer | as live | `drawer` (cabinet build, cream keys, fader) · `tiles` (drawer with dark-tile keys) |
| Your turn | none | `edge` (lamp strip on the case) · `pilots` (two pilot lamps) |

Directions (preset mixes): **A Tidy**, **B Cabinet** (recommended),
**C Instrument**. Parts can be mixed freely.

The raise drawer keeps its size: it has to cover the stack counter (it is
134px tall, and the counter sits 45px above the buttons), so "keep the
stack visible" is not possible without moving the cards. Showing the stack
inside the drawer would need a small presentation change; ask if wanted.

## Rules the candidates keep

- CRT glass, ink, flicker and blink are untouched (the Pattern Book owns
  them); only the housings around screens change.
- FOLD/CHECK/CALL/RAISE keep their locked finish.
- Printed text on physical parts does not glow.
- CSS only over the existing markup; the chip bank's box is unchanged, so
  the chip physics measured from it is unchanged.
- Reduced Motion: the your-turn lamps stay lit and stop blinking.

## After the owner picks

1. New parts go into the Pattern Book first (`PATTERN_BOOK.md`,
   `pattern-book.html`, `validation/pattern-book-checks.js`): likely the
   pilot lamp, bank tray, fader and button cradle.
2. Move into production one part per release, in this order: case + bays,
   screens + stack (with the short-phone fix), right bay, button bay, raise
   drawer, your-turn signal. Each release bumps `BUILD_VERSION` and the
   `sw.js` cache, runs the validation suites, and gets before/after
   screenshots at 320×700, 390×664, 393×852 and 430×932 with Reduced Motion
   on and off. The chosen rules go in before `css/machine-crt.css`, which
   stays the last stylesheet.
3. `css/dashboard-v2.css` then stays as the Lab's reference.
