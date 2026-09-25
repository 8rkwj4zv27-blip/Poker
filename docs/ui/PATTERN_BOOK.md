# The Pattern Book

The visual library for The Table. It decides how every repeated part of the
machine looks, moves and sounds, so the same kind of part never appears with
a slightly different finish on two screens.

- **Live page:** `pattern-book.html` (isolated like the `*-lab.html` pages;
  production never links to it). Its CRT section runs on the real
  `css/crt.css` and `js/crt.js` with the game's recipe.
- **Labs:** `crt-lab.html`, every game CRT with presets and dials.
- **Checks:** `node validation/pattern-book-checks.js` (reads every live
  stylesheet) and `node validation/tools/crt-consistency.js` (compares
  every CRT part as the browser draws it; needs the local server).

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
- The CRT look is the game's recipe or a CRT Lab preset (`CRT.PRESETS`);
  picking one rewrites the `data-crt-*` dials on `<html>`. The press is a
  named value of `data-finish-press`, whose tokens live in
  `css/press-feel.css`. No screen is touched.
- To add an option: a preset in `CRT.PRESETS` (CRT) or an entry in
  `FINISH_SETS` plus its token block (press). The check fails if an option
  has nothing behind it.
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
| CRT screens | Rebuilt as one component and chosen in the CRT Lab: **Pulp (tweaked)** · glass dark · glow 1 · scanlines 4 · RGB split 0 · grain 4 · curve 0 · flicker 4 · rolling bar 1 · VHS tears 4 · ghosting 2 · change: channel · ink: mono | **Live** v0.40.0 |
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

Any screen showing information that changes while the machine runs. Every
one is the same component, `css/crt.css` + `js/crt.js`. It was rebuilt from
scratch rather than layered on the older per-screen recipes: those were
stripped of every glass and text declaration, keeping only each screen's
layout.

**Anatomy.** A CRT can only be built from these parts:

| Part | Rule | Class |
|---|---|---|
| Glass | The screen itself. Its layout (size, padding, grid, flex) is the screen's own; everything visual is the component's. | `.crt` |
| Line | Status text. Plain text inside a CRT is a Line: 7px, regular, one spacing. Narrow phones step every line down together (6.5px ≤389px, 5px ≤350px). | `.crt-line` or none |
| Figure | A number or a result word: 13px, or 17px for the big ones. | `.crt-figure`, `.crt-figure--lg` |
| Caption | A small label: 7px, dimmer ink. | `.crt-caption` |
| Cells | Side-by-side sections, one thin rule between them; no inner panels. | `.crt-cell` |
| Lamp, meter, cards | An indicator lamp, a progress meter, playing cards (keep their own inks). | `.crt-lamp`, `.crt-meter`, `.crt-cards` |
| Ink | By meaning on the screen: none (info), `live`, `money`, `danger`; `.crt-danger` on a single element. Strong hands and money reels read as money; the negative results tone inks the score and statement as danger. The recipe's ink scheme can fold these together (the game uses mono). | `data-ink` |

**Look.** Twelve dials, set once on `<html>` in `index.html` (the recipe
above): tint, glow (always in em), scanlines, RGB split, grain, curve,
flicker, rolling bar, VHS tears, ghosting, change effect, ink scheme. The
component turns them into tokens; no screen sets any of them.

**Changes.** `js/crt.js` watches every `.crt`. Whoever rewrites a screen
(the table's `paintCRT`, the Home Boot, Career's record pages, the results
stat bank), the recipe's change effect plays and the old text ghosts out.
Rapid runs settle into one change; first text is never a change;
`data-crt-quiet` opts out a screen whose changes are a number wheel or its
own reveal (bet, raise, results score and instruments, Home stats). Reduced
Motion: text just swaps.

**Rules.**
- To add a CRT: put `crt` on the element, give its text the roles above,
  and set `data-ink` if it isn't ordinary info. Layout in your own CSS.
- Never set a CRT's colour, font, glow, background, border or animation
  anywhere but `css/crt.css`. `validation/pattern-book-checks.js` reads
  every live stylesheet and fails on it; `validation/tools/crt-consistency.js`
  opens every screen and fails if two same parts are drawn differently.
- Mechanical-number reels inside a CRT keep their own geometry (Round 2),
  and take the CRT's ink and glow.

In the game: Home readout and stats; Career record and ticket slot; table
hand readout, turn banner, bet and raise readouts; results-stage score,
instruments, stat bank, trophy case and run progress.

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
