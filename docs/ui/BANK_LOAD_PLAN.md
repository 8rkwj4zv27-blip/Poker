# Bank Load — how your bank fills when you sit down

The table intro's bank step (Quick Deal, a run, a Career table): what the
owner sees as the chips arriving in the bank box.

## Why (looked at 2026-10-05)

Measured in an emulated iPhone on a Quick Deal ($1,000 = 36 chips):

1. **The chips don't come in through anything.** `CoinTable.syncRack` drops
   each chip from just above its own final place, ordered by height across
   the whole rack: it reads as rain all over the box.
2. **The intro doesn't wait for it.** `TableIntro`'s bank step waits for
   the stacks `buildBankStacks()` returns, and the coin table returns none
   (`CoinTable.loadBank()`'s 900 ms is ignored), so it gives the bank about
   0.4 s; the fill takes 1.5 s+. The hatch shut with ~8 of 36 chips in.
3. **The finished rack looks broken.** Its back rows stand higher in the
   box with nothing under them, so back stacks seem to float.

## Live in v0.64.0 (`js/bank-load.js`, `css/bank-load.css`)

The finished rack is built first, exactly as the game lays it out
(`CoinTable.syncHoard(true)`), and the real coins stay hidden while a copy
of them plays the entrance, clipped to the box. When it ends the copy goes
and the real coins show, so the bank is always right underneath (a tap to
skip, a bet, a resize can't leave it half-filled). `table-intro.js`'s bank step
waits for the entrance's real length (what `CoinTable.loadBank()` returns).

- **A · COUNT IN** — the hatch opens and the chips come down through the
  slot stack by stack in a fixed order, the STACK readout counting up.
  Dials: where they come in (slot / straight down), whole stacks or chip by
  chip, order (back row first / middle out), time, readout.
- **C · TRAY IN** — the whole rack slides into the box on a brass-rimmed
  tray, locks with a clunk and gleams. Dials: from below / above, stepped
  or smooth, time.
- **SHELVES** (both) — each back row stands on a step, so nothing floats.
  Signed off with the picks; recorded in the Pattern Book.

## The owner's picks (round 1, 5 Oct 2026) — live

Both are offered: Workshop → **Bank** → FILLING YOUR BANK
(`settings.bankLoad`), with a preview in your bank's own box. Count in is
the default.

- **Count in:** shelves on, straight down, chip by chip, back row first,
  1.2 s, the readout counts up.
- **Tray in:** shelves on, from above, smooth + bounce, 0.6 s.

## Lab

`bank-load-lab.html` (+ `js/bank-load-lab-host.js`, `js/bank-load-lab.js`,
sheet styles from `css/showdown-lab.css`). Phone-first: the real game full
screen; TUNE opens the sheet (LOAD · A · C), AGAIN loads the bank again on
the table that's up, SIT DOWN replays the whole table entrance. YOUR STACK
sets the chips for the next load ($200 – $25,000).

- Lab link (round 1; republished with the live picks in v0.64.0): https://claude.ai/artifact/7oKKr6EvY958mCAsSN55tM

## Fixed in v0.64.1: the rack jumbling after a bet

After your blind (any bet, any win) the rack was laid out again from
scratch (`rackSlots` in `js/coin-world.js`: coins sorted by value, heights
shared out again), so nearly every coin was handed a new place and the
whole rack hopped at once. `keepPlaces()` now gives each colour's places
to the coins already standing on one, then the nearest; new coins take
what's left. Measured in an emulated iPhone, coins moving at once: blind
36 → 3, win +300 27 → 4, win +2,000 38 → 5, a drop to $600 27 → 14 (the
rack loses a row there, so some must move).
