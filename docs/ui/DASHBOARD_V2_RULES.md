# Dashboard V2 — the rules

Status: **signed off by the owner** (25 September 2026), with rule 6 widened
at their request. Every Dashboard V2
part, bespoke or shared, must pass these rules before it is shown. Written
after the owner rejected the Dashboard 2.0 lab for losing the game's visual
language (`DASHBOARD_V2_HANDOVER.md`). References: the Home screen with its
boot, the Career Hub, the Machine Wheel, the Pattern Book.

## 1. Universal parts stay as they are

Anything that appears across the game is used as-is, through its shared
class, never restyled for the dashboard:

- **CRT screens**: `machine-crt` glass, four inks, idle flicker, change blink.
- **Buttons and press feel**: FOLD / CHECK / CALL / RAISE (locked family),
  the cartridge hero button, dark-tile standard button, cream small key,
  danger key, choice rows, headers; the one thunk press, scaled by size.
- **Number wheels**: the reel counters (the gold-framed bankroll drum is the
  same part as the table's stack counter), with their roll and settle.
- **Lamps**: the square `pc-lamp` (amber / green / off / danger).
- **Machine Wheel** transitions and the boot's stepped switch-on.

Bespoke parts are allowed only for jobs unique to the dashboard (the card
tray, the chip bank, the bet-this-hand readout, the all-in charge key, the
card peek). A bespoke part is built from rules 2–5 and is added to the
Pattern Book before it ships.

## 2. Construction: every part sits in a housing

The Home and Career Hub look is one construction, repeated:

1. **Case**: the theme colour, faint checker texture, a bright rim line
   outside.
2. **Raised frame**: a thick bevel in the theme colour, light on the top and
   left, dark on the bottom and right.
3. **Recess**: near-black, sunk with a hard inner shadow along the top.
4. **Content**: glass, reels, paper, chips or keys.

Nothing floats on the case, and there are no frame-less boxes. Seams between
housings are dark and even.

## 3. Composition: few, big, aligned

- The Career Hub fills a screen with four blocks. The dashboard should read
  as a few clear instruments, not many small ones. Density comes from
  organisation, not from part count.
- Parts share edges and a common gutter. Parts never overlap. The one
  intended exception is the hole cards standing up out of their tray.
- Text sizes: printed labels at least 6px pixel caps; CRT text at least
  7px; the numbers that matter (stack, to call, bet) as large as their
  housing allows.
- Everything must read at 430 × 932 first, then 390 × 844 and 320 × 700,
  with nothing clipped.

## 4. Materials and colour: four materials, fixed meanings

- **Theme case**: the frames and housings (follows the four table themes).
- **Near-black**: recesses and glass.
- **Gold**: money and the hero button only.
- **Cream**: paper, cards and small keys.
- **Red**: only for danger, including the all-in moment.

No new colours, no gradient panels as a material, no glow except lamps and
CRT light, no hazard stripes, no thin outline frames. Hard pixel light:
2–4px bevels, hard offset shadows, 1px highlights.

## 5. Motion: mechanical, with a cause

Taken from the boot, the Machine Wheel, press feel and the Hub's ticket rack:

- **Stepped and pixel-snapped.** Wind-up, travel, overshoot, settle, lock.
- **Power states** switch on in steps with a relay click, never a fade.
- **Every movement has a cause.** Something is pressed, dropped, rolled,
  charged or locked. There is no ambient decoration that moves on its own.
- **Every mechanical move has its sound**, is skippable, and honours
  Reduced Motion.
- **Theatre is allowed to be big for big moments** (all-in, bust, big win),
  and small elsewhere.

## 6. The 2.0 lab's ideas, rebuilt properly

The owner wants creative options, all inside one visual style. Ideas from the
2.0 lab (levers, chip dragging, the bust break with keys falling off and
smoke, dials, warning lamps, a lit paytable) may come back as options, **but
only rebuilt to rules 1–5**: made of the game's own materials and housings,
readable, not overlapping, with motion that has a cause.

Still out: decorative machinery that moves on its own (the cogs), because
rule 5 already forbids it. Also out: the 2.0 lab's flat cases, stripes and
new colours.

## 7. Carried forward: behaviours the owner liked

- Double-tap the dashboard to check (knock); refused with a buzz when
  facing a bet.
- Card peek: press and hold to see your cards.
- Hold to charge ALL IN.
- The ALL IN moment: warning lights, a machine hum, a tense card-by-card
  run-out.

## 8. The process from here

The order form is built: `dashboard-order-lab.html` (see `docs/CODEMAP.md`).


1. Owner signs off these rules.
2. Dashboard jobs are listed: your cards, hand name, turn and amount to
   call, stack, bet this hand, blinds and dealer, chip bank, fold,
   check/call, raise and sizing, all-in.
3. **The order form**: a lab page that runs the **real game** (the real
   felt, seats, pot and dealer deck), with a form beside the phone. One row
   per job: V1's version plus two or three alternatives, all built to these
   rules. One row per behaviour, with intensity levels. One row for
   dashboard height. The real dashboard rebuilds from the order as it
   changes, and buttons put the real game into your turn, facing a bet,
   all-in, win and bust.
4. The owner's order becomes the build spec; new parts go into the Pattern
   Book; then production, one part per release. **Done to here** (25
   September 2026): the order is in `docs/ui/PATTERN_BOOK.md` (Dashboard V2).
