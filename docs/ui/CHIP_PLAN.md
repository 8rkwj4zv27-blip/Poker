# The CHIP plan

Proposal and working record for upgrading the chips: bank, bet spots, pot,
payouts and feel. Written 25 September 2026. Nothing here changes the
production game until the owner signs an option off in `chip-lab.html`.
Money stays authoritative in `player.chips` / `game.pot`: every change
below is presentation only, and poker logic is untouched.

## The principle

**Every chip should be somewhere you can see.** Today money is only
visible in your bank and the pot. Everywhere else it appears from nothing
or vanishes into nothing. Opponents' bets materialise out of the portrait,
their winnings disappear into the seat, and your winnings vanish at the bank
rim before the pile pops back in one go.

## What's weak today (found 25 Sep 2026)

1. **Bank:** a black well. $1,000 becomes about 27 chips squeezed into two
   towers in one corner, and roughly 70% of the box sits empty. The hatch
   is `display:none`. After a win the pile is rebuilt in one go
   (`rebuildBankPileFromState`).
2. **Colour means nothing:** colours cycle at random. A 20 call is about 2
   chips, a 200 raise about 9, a 1,000 all-in about 28, all confetti.
3. **Opponents have no chips:** only a reel.
4. **No bet spots:** bets go straight into the middle, so there's no
   street rhythm and you can't see who has put what in.
5. **Pot:** a small cluster on the plate, with overlaps that couldn't
   physically happen. Side pots never show as piles.
6. **One clink for everything.**

## Owner decisions so far

| # | Question | Answer (25 Sep) |
|---|---|---|
| 1 | Chip colour = value? | See options side by side first. Big bets must never read as one chip, and pots must look different by size. |
| 2 | Bet spots + sweep | **Yes**: "like a proper poker table". Must be smooth and polished. |
| 3 | Opponent chips | Worried about crowding. Leaning towards spots only; see options. |
| 4 | Bank style | Undecided; see options. Idea: tap the bank to tidy the mess. |

## Options in `chip-lab.html`

Serve the repo (`python3 -m http.server 8765`), open
`http://localhost:8765/chip-lab.html`, and flip the switches. Options can
also be set in the URL: `?value=weighted&seat=spot&bank=tidy&panel=off`.
The runs play a scripted hand on the real table: blinds into spots, streets
swept into the pot, an all-in, then the payout.

**1 · Chip values**
- **A Today:** the production count curve (`visualChipCount`), random colours.
- **B Denominations:** real casino maths (white 1 · red 5 · blue 10 ·
  green 25 · black 100 · purple 500 · yellow 1,000), coloured up but never
  fewer than 3 chips. Tidy and readable, but a huge pot is only a handful
  of chips (the "big bet, one chip" weirdness, softened).
- **C Weighted (recommended):** today's count curve, so a big bet always
  sends plenty of chips, with the colour mix shifting by size in big
  blinds: a 1BB call is pale, a 30BB pot is mostly black, a 100BB+ pot
  goes purple and gold. Pots differ by size *and* colour, and chips stay
  decorative (they never have to add up exactly).

How the big online games handle it: they typically show exact denomination
stacks next to a printed amount, so the number carries the accuracy and the
chips carry the feel. We already print the amount on the pot plate and now
on every bet spot, so C gets the feel without the one-chip problem.

**2 · Opponent chips**
- **A Spots only:** seats unchanged; chips come out of the seat into a
  spot below the cards.
- **B Spots + gauge:** a 10-cell lamp gauge under each reel (full at 2×
  the starting stack; amber under 30BB, coral under 15BB). It's
  instrumentation, not clutter.
- **C Spots + mini stack:** a small resting stack beside each seat.

**3 · Your bank**
- **A Rack:** one colour per groove, highest value on the left; it re-sorts
  after every intake.
- **B Heap:** a loose tray that fills upward as it gets richer.
- **C Heap + tidy:** loose until you tap it, then it racks itself colour by
  colour with a ratchet and a lock clunk. New winnings land loose again.

Every option shares the new hatch (it opens, chips drop through, it
closes), the pot counting down while the stack reel counts up, bet spots
with amount plates, and the sweep.

## Phases after sign-off

| Phase | Scope |
|---|---|
| C1 Chip language | The chosen value mode replaces `pickChipColor`'s cycling; `visualChipCount` stays. |
| C2 Bank | The chosen bank replaces the `#hud-tower` grid inside the existing `#hud-left` box (dashboard geometry unchanged); the hatch comes back; no more rebuild pop. |
| C3 Bet spots + sweep | Per-seat spots on the felt, sweep at street end (`applyAction` presentation hook + a street-end hook), amount plates, dealer puck. |
| C4 Pot | Colour-grouped stacks with per-chip jitter (fixes impossible overlaps); pot plate counts up; side pots split into their own piles and plates. |
| C5 Payouts | Opponent wins slide to their spot then into the seat; split pots divide; the human SMASH ends in the chosen bank. F10 count-down/up. |
| C6 Feel | Clink by size (single, clatter, sweep rattle, all-in thunk), landing squash, Reduced Motion path throughout. |

New parts (bet spot, rack/tray, hatch, gauge) go into
`docs/ui/PATTERN_BOOK.md` and `validation/pattern-book-checks.js` once
signed off, before they reach the game.

## Chip motion (`chip-throw-lab.html`), 26 Sep 2026

Owner feedback on `chip-lab`: bet spots before the pot, the bank and the
tidy tap are good, but chip travel reads as liquid ("vomit"), worst when
it comes out of an opponent's face. Keep LOTS of chips; make each one a
heavy, real piece.

Why it read as liquid: one chip per flight at 34–90ms gaps (a stream),
chips spawned at the portrait, a different sideways sway and spin per
chip (droplets), and 400–700ms soft easing where the rest of the game
moves in hard, stepped beats.

The lab's switches (combine freely; four presets):
- **Throw:** stream (today) / handfuls of 2–6 with gaps / splash
  (everything at once on flights of different lengths).
- **Timing:** even / uneven.
- **Air:** eased (today) / gravity: a true ballistic arc whose height
  scales with distance, the chip flipping end over end and landing flat.
- **Shadow:** each chip's shadow stays on the felt, shrinking with height.
- **Landing:** settle / bounce + skid onto the exact slot.
- **Rollers:** about 1 in 10 flat landings rolls on its edge, wobbles and
  falls flat.
- **Pile knock:** a landing nudges nearby resting chips.
- **Source:** face (today) / table edge / a chute in the felt under each
  seat.
- **Sweep:** stream (today) / push (each spot slides in as a group).
- **Frames:** smooth / stepped at 12fps.

Presets: Today (reference) · Weight (recommended: handfuls, gravity,
shadows, bounce, rollers, knock, chute, push) · Splash · Machine (stepped
motion, dead landings).

### v2 (26 Sep 2026)

Owner on v1: the arc and landing feel really good. Push further: smaller,
simpler chips (the 350px art shrunk to 20px is noisy); handfuls looked
like two frozen stacks travelling; more bounce; flips; more knocks; maybe
messy, then tidy; "super video gamey, fun to watch over and over". The v1
drawer also hid the table.

v2 rebuilds the lab around a chip physics world: every chip on the felt
is a body (ground point, height, velocity), not a DOM pile slot.
- **Art:** current / pixel. Pixel chips are drawn by code at their real
  size, with six tilt frames (face, tilts, edge-on), so flips and rollers
  are real pixel animation. Resting chips use the table's viewing tilt.
  Placeholder art the owner can replace.
- **Size:** S 13 / M 15 / L 17px (bank chips +5).
- **Handfuls:** rigid (v1) / bloom: each chip has its own release time,
  speed, aim and flip count, so a handful spreads in the air.
- **Flips:** 1 / 2–6. **Bounces:** 1 / 1–3, glancing off chips they hit.
- **Coin wobble:** some chips spin down like a coin before dropping flat.
- **Knock-offs:** hard landings pop resting chips loose, and chips stacked
  on them topple. Sliding chips shove resting ones.
- **After landing:** neat (v1: straight to a slot) / mess then auto-tidy
  (colour by colour, ratchet and lock) / mess until you tap the felt.
- **Juice:** dust puffs, chute rattle, and a hit-stop plus stage shake on
  all-ins.
- **Lab chrome:** a trigger bar over the (inactive) action buttons, a
  settings drawer that closes on any trigger, Replay, and a sweep that
  puts bets down first if the spots are empty.
Presets: Today · Weight (recommended) · Chaos · Machine. Reduced Motion
places every chip directly where it ends.
