# The Pattern Book

The visual library for The Table. It decides how every repeated part of the
machine looks, moves and sounds, so the same kind of part never appears with
a slightly different finish on two screens.

- **Live page:** `pattern-book.html` (isolated like the `*-lab.html` pages;
  production never links to it). Its CRT section runs on the real
  `css/machine-crt.css` and `js/machine-crt.js`.
- **Checks:** `node validation/pattern-book-checks.js`.

## The rule

**Same job, same finish.** Parts are grouped by the job they do (the one
main action on a screen, a small corner key, a CRT). Within a job, the
*finish* is identical everywhere: material, colour, bevel, depth, glow,
motion, press feel and sound. The *content* stays free: what it says,
how many lines, its width, and where it sits on the screen.

Different jobs keep different looks. Variety between jobs is intended;
drift within a job is not.

## Building something new

1. Look here first. If a part for that job exists, use its class. Don't
   restyle its finish locally.
2. If the job is new, or no existing finish fits, don't invent one in place.
   Propose 2–3 candidates shown on the real screens, get sign-off, then add
   the part here (a shared class, a section in `pattern-book.html`, a check
   in `validation/pattern-book-checks.js`) **before** using it in the game.
3. Changing an approved finish is a new sign-off, recorded below.

## Trying other looks: Finishes

Because each family is one shared set, trying a different look is one
switch. **Settings → Finishes** (`js/finishes.js`, a page inside the
Settings sheet) lists each set with its options; a tap applies it
everywhere at once, in the real game. Choices stay on that device only
(`localStorage` key `felt.finishes`); everyone else gets the defaults.

- The first option of every set is the signed-off default (blank id).
- An option is a named value of an attribute on `<html>` (e.g.
  `data-finish-crt-glass="amber"`); the set's stylesheet redefines that
  set's tokens for it. No screen is touched.
- To add an option: one entry in `FINISH_SETS`, plus its token block in the
  set's stylesheet. The check fails if an option has no tokens.
- To make an option the new default: move its tokens into the set's base
  tokens, record the sign-off below, and drop the option.
- `FINISHES_MENU = false` hides the menu and returns devices to defaults.

## How sign-off works

Each family is shown as a "Now" row (every real instance, cropped in the
game) and option rows (the same instances restyled in the running game with
one shared finish). The owner picks a row; it applies to all of them.
Motion and sound are signed off from live demos, never stills.

## Sign-off record, 24 September 2026

| Family | Approved | Status |
|---|---|---|
| CRT glass | **B** Blue record glass: blue-tinted near-black tube, soft recessed bezel, vignette, static scanlines, faint halo, no text bloom | **Live** v0.39.6 |
| CRT motion | **A** Flicker and blink: faint stepped idle flicker plus the static-burst blink on every content change | **Live** v0.39.6 |
| CRT ink | **A** Four meanings: info, live table, money, danger | **Live** v0.39.6 |
| Hero button | **A** Machine cartridge (Home: Career) | Approved, next |
| Standard button | **B** Dark tile (Home: Quick Deal) | Approved, next |
| Danger button | **D3** Dark key, coral print, coral inner edge | Approved, next |
| Small key | **B** Cream (Career keys), one square size for icon keys | Approved, next |
| Choice row | **A** Small bold labels (Settings) | Approved, next |
| Screen header | **A** Dark plate, cream title (Custom Game) | Approved, next |
| On/off switch, stepper | Only one version exists; approved as is | Settled |
| FOLD / CHECK / CALL / RAISE | Kept as their own locked family | Settled |
| Press feel | One heavy thunk on every button, scaled by size (big / standard / small), FOLD/CHECK/CALL/RAISE included | **Live** v0.39.7 |
| Number wheels, sound | Round 2, from live demos | To do |
| Dashboard V2 | The owner's order from the order form (25 September 2026); see **Dashboard V2** below | Approved, built in the lab; production next |

Approved-but-not-migrated families have reference captures in
`docs/ui/pattern-book/`. Each moves into a shared class, one family per
release, with before/after screenshots.

## CRT screens (live)

Any screen showing information that changes while the machine runs.

| Part | Rule | Owner |
|---|---|---|
| Use it | Add `machine-crt` to the screen element. Keep your own size, padding and layout. | `css/machine-crt.css` |
| Glass | Blue record glass. Never restyle it per screen; put finish changes in `machine-crt.css` (the check fails otherwise). | `#app .machine-crt` |
| Text | The CRT owns every character on its glass: colour and bloom come from the finish, never from the screen's own CSS (overridden with `!important`). Playing cards shown on a CRT keep their inks. | same |
| Ink | Declare the screen's meaning with `data-ink`: none = ordinary machine info, `live` = live table info, `money`, `danger`. Money reels inside any screen read as money; a strong made hand (tier 2–3) reads as money. Fixed across colour themes. | `--crt-ink-*` |
| Captions | One size (7px), spacing and dimmer ink on every screen, one line. | `--crt-label`, `--crt-ink-label` |
| Cells | The glass is one surface: no inner panels. Multi-cell screens divide it with one thin rule. | `--crt-rule` |
| Idle | Stepped flicker (5.8s cycle) on the `::after` layer, so the element itself stays free for its screen's own effects (e.g. the results stage's dormant dimming). | `--crt-flicker` |
| Change | Static-burst blink (`crt-refresh`, 0.23s) whenever the text changes. Automatic via `js/machine-crt.js`; `paintCRT()` and the Career record fire it themselves. A screen whose change is a number wheel or its own reveal sets `data-crt-blink="off"`. | `js/machine-crt.js`, `--crt-blink` |
| Reduced Motion | No flicker, no blink (the Reduced Motion setting and the OS preference). | same |

In the game: Home readout and stats; Career record and ticket slot; table
hand readout, turn banner, bet and raise readouts; results-stage score,
instruments, stat bank, trophy case and run progress.

Changes from the earlier C0 system that this sign-off superseded: the glass
is blue-tinted with a soft bezel instead of the flat near-black C0 tube; CRT
text has no phosphor bloom; idle flicker and the change blink now apply to
every CRT, not only the table's; Career's record text moved from blue to the
info ink (blue is reserved for live table information).

## Press feel (live)

Every button presses the same way: the heavy thunk from the big Career /
Buy In keys, scaled by the key's mass. Owner: `js/press-feel.js` +
`css/press-feel.css`.

| Size | Buttons | Sink | Bounce back | Sound |
|---|---|---|---|---|
| Big | `.pc-button-primary`, `.btn-primary`, FOLD/CHECK/CALL/RAISE, Award Pot, Quick Resolve, `.wide-btn` | 5px | overshoot 3, dip 2, lift 1, settle (300ms) | `allin` clunk (+ casing knock on the cartridges) |
| Standard | `.pc-button-secondary`, `.btn-secondary`, choice rows, quick bets, Career secondary keys | 3px | overshoot 2, dip 1, settle (240ms) | `thunk` |
| Small | `.icon-btn`, `.ch2-key`, `.table-save`, steppers | 2px | overshoot 1, settle (170ms) | `key` |

- The press happens on finger-down; the bounce plays on release, in pixel
  steps. A key the game holds down (the Career launch) stays down.
- The table actions keep their own per-action press sounds (fold, check,
  raise…); they take the motion only. Their rest position is 1px proud, so
  their travel is measured from there (`--pf-rest`).
- A click handler that used to play its own press sound calls
  `pressFeelSounded(button)` first.
- New buttons: use one of the listed classes and the press comes free. A
  button family that isn't listed gets no press until it's added to `SIZES`
  in `press-feel.js` (and this table).
- Finishes options: Thunk (default), Heavy, Light, Original (each button's
  pre-book press, for comparison).
- Reduced Motion: the face still sinks while held, but doesn't bounce.

## Dashboard V2 (approved, lab-built)

The player's dashboard, ordered by the owner on the Dashboard V2 order form
(`dashboard-order-lab.html`, rules in `docs/ui/DASHBOARD_V2_RULES.md`). The
parts are built in `css/dashboard-order.css` and `js/dashboard-order.js`
behind `data-do-*` attributes; they are **not in the game yet**. When one
moves into production it becomes a shared class, gets a section in
`pattern-book.html`, and its check below moves from the lab file to the
live one. Universal parts inside the dashboard (CRT glass, FOLD / CHECK /
CALL / RAISE, the reel counters, cream small keys, press feel) keep their
own entries above and are used as they are.

| Part | Order | The finish |
|---|---|---|
| Frame | **SMOOTH** | The dashboard is its own instrument, lifted off the table by a dark gap: one moulded shell behind the whole console (top, sides and bottom as one rounded piece, so the bevels follow the corners with no joins), 2px ink edge, two-step soft bevel, hard shadow under it. The case inside is one checker surface; a dark groove seams the instruments from the key bay. |
| Recess | **HARD SUNK** | Every bay: near-black, 2px ink edge, a hard 5px shadow along the top, a lit lip below. |
| Rim light | **CHANNEL**, **BOLD** | A groove running round the frame, dark at rest. It is the machine's one state light: your turn amber (steady), all in red (slow pulse), a win warm (brief), bust flickers out and stays dark. Every change switches on in steps with a relay click. It never sits over the cards. |
| Layout | fixed | The bank (left) and the blinds + bet (right) mirror each other; the screen sits between them under the cards. The three share a top line and a bottom line. The stack drum runs the full width of the dashboard under them, with no label. |
| Screen | fixed | One CRT, a fixed size whatever it says: a fixed hand line on top (two short lines on narrow phones), the turn lines below. It only changes size when the mode changes (the result face). |
| Card tray | **V1** | Today's lip. The cards stand up out of the machine; the tray and the screen never touch. New tray options are a later pass. |
| Blinds | **PUCKS** | Round tokens, cream and lifted when the blind is yours. |
| Bet this hand | **SMALL DRUM** | A small reel counter (the stack's own part, gold frame) under the blinds in the right bay, with a printed THIS HAND caption. |
| Button bay | **CRADLE** | One shallow recessed cradle; the key tops sit level inside its rim and nothing overlaps it. |
| Raise | **BARREL**, **FADER** | RAISE rolls the instrument panel over, in steps with an overshoot and a lock, to the sizing face; the drum's next face shows edge-on inside its top. The face: printed title, cream cancel key, the raise drum in a gold frame, a chunky cream fader cap in a deep slot that clicks at each notch, cream quick keys, the hold-to-charge ALL IN key. Every change rolls the drum. (The animation gets its own pass.) |
| Behaviours | **ON** | Knock to check (double-tap the case; refused with a buzz facing a bet; the whole machine jolts, never the case alone), card peek (a setting, off by default in the game), hold to charge ALL IN. |

Parked for later passes: the raise animation, card tray options, the
theatre pass (ALL IN moment, bust, win), and the chip bank and chips.
