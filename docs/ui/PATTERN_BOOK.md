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
| Number wheels, press feel, sound | Round 2, from live demos | To do |

Approved-but-not-migrated families have reference captures in
`docs/ui/pattern-book/`. Each moves into a shared class, one family per
release, with before/after screenshots.

## CRT screens (live)

Any screen showing information that changes while the machine runs.

| Part | Rule | Owner |
|---|---|---|
| Use it | Add `machine-crt` to the screen element. Keep your own size, padding and layout. | `css/machine-crt.css` |
| Glass | Blue record glass. Never restyle it per screen; put finish changes in `machine-crt.css` (the check fails otherwise). | `#app .machine-crt` |
| Text | No bloom or text shadow. Mechanical-number reels inside a CRT (`.amt-readout`, `.jp-cell`) keep their own treatment. | same |
| Idle | Stepped flicker (5.8s cycle) on the `::after` layer, so the element itself stays free for its screen's own effects (e.g. the results stage's dormant dimming). | `--crt-flicker` |
| Change | Static-burst blink (`crt-refresh`, 0.23s) whenever the text changes. Automatic via `js/machine-crt.js`; `paintCRT()` and the Career record fire it themselves. A screen whose change is a number wheel or its own reveal sets `data-crt-blink="off"`. | `js/machine-crt.js`, `--crt-blink` |
| Ink | `--crt-ink-info` ordinary machine information · `--crt-ink-live` live table information · `--crt-ink-money` money and reward · `--crt-ink-danger` danger and warnings. Fixed across colour themes. | `:root` in `machine-crt.css` |
| Reduced Motion | No flicker, no blink (the Reduced Motion setting and the OS preference). | same |

In the game: Home readout and stats; Career record and ticket slot; table
hand readout, turn banner, bet and raise readouts; results-stage score,
instruments, stat bank, trophy case and run progress.

Changes from the earlier C0 system that this sign-off superseded: the glass
is blue-tinted with a soft bezel instead of the flat near-black C0 tube; CRT
text has no phosphor bloom; idle flicker and the change blink now apply to
every CRT, not only the table's; Career's record text moved from blue to the
info ink (blue is reserved for live table information).
