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

## The candidate (`js/bank-load.js`, `css/bank-load.css`)

The finished rack is built first, exactly as the game lays it out
(`CoinTable.syncHoard(true)`), and the real coins stay hidden while a copy
of them plays the entrance, clipped to the box. When it ends the copy goes
and the real coins show, so the bank is always right underneath (a tap to
skip, a bet, a resize can't leave it half-filled). The intro waits for the
entrance's real length (lab: through `TABLE_INTRO_CONFIG.bank.settleMs`;
for the game, `table-intro.js` should await `CoinTable.loadBank()`).

- **A · COUNT IN** — the hatch opens and the chips come down through the
  slot stack by stack in a fixed order, the STACK readout counting up.
  Dials: where they come in (slot / straight down), whole stacks or chip by
  chip, order (back row first / middle out), time, readout.
- **C · TRAY IN** — the whole rack slides into the box on a brass-rimmed
  tray, locks with a clunk and gleams. Dials: from below / above, stepped
  or smooth, time.
- **SHELVES** (both) — each back row stands on a step, so nothing floats.
  A new part: needs sign-off and a Pattern Book entry before it ships.

## Lab

`bank-load-lab.html` (+ `js/bank-load-lab-host.js`, `js/bank-load-lab.js`,
sheet styles from `css/showdown-lab.css`). Phone-first: the real game full
screen; TUNE opens the sheet (LOAD · A · C), AGAIN loads the bank again on
the table that's up, SIT DOWN replays the whole table entrance. YOUR STACK
sets the chips for the next load ($200 – $25,000).

- Round 1 link: https://claude.ai/artifact/7oKKr6EvY958mCAsSN55tM

## Noticed, not in scope

After your blind is posted the rack re-settles to the new stack by sliding
every coin to a re-planned place (`syncRack`'s `applyLayout`): for a moment
the whole rack is a heap. That's the shipped per-bet behaviour, separate
from the load.
