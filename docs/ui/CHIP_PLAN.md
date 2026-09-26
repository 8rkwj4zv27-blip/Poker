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

### v3 (26 Sep 2026)

Owner on v2: good, but your chips overshot your spot; after a sweep chips
sat on the cards; overshooting chips nearly left the screen; collisions
could be better and chips clunkier; the wobble shimmered; flips weren't
visible; every throw looked the same; handfuls were slow; eased and
stepped didn't work. Size M is right. The coin should be a plain gold
video-game coin (no symbol, which wouldn't read at this size), with the
old colours kept as an option. After throws and returns: the chip areas
(bank, pots).

v3:
- **Containment:** the rail is a wall; board cards, deck, pot plate, seat
  cards and your hole cards are solid blocks. Coins bounce off them and
  never rest on them. The sweep and pay-outs clamp their targets clear of
  them. Checked over repeated runs: 0 coins resting on cards, 0 off the
  felt.
- **Landing control:** the first impact caps horizontal speed (felt
  grip), throws aim short by their predicted carry, and the felt grips
  harder away from a chip's spot. Measured over 6 runs each: your raise
  lands a median of 11px from the spot centre (v3 before the carry fix:
  26px); opponents' raise 10px, call 5px.
- **Heavier:** gravity 3300 (was 2600), bounce 0.18–0.32, friction 1500,
  a squash frame on impact, equal-mass chip collisions (in the air too,
  when low), two physics half-steps per frame. The wobble became a rock:
  a slow tip or two, then a clunk.
- **Coin:** a gold coin drawn by code (face, darker rim, slot line,
  highlight, reeded edge, darker back), so flips read. ART switch: gold /
  colours (v2 pixel) / original.
- **Throws by bet:** call = flick, raise = lob (blooming handfuls, each
  with its own arc height, 70–140ms apart), big raise (15BB+) = shove along
  the felt with the front coins tumbling, all-in = heave (handfuls, then a
  splash). One or two coins per throw are tossed high with 3–5 flips and a
  glint. Randomness is fresh each run (SAME for identical replays).
- Eased and stepped removed; the owner's v2 settings are the new V3
  default (edge source, mess until tap). V3 + TIDY auto-tidies.

### v4 (26 Sep 2026)

Owner on v3: better, but coins feel like light pebbles or cut-out paper
(heavy overlap, no thickness), the clink is fragile, piles aren't
satisfying, and the tossed coin looks silly. It needs to pop and click.
Coins and chips do overlap in life, so overlap stays an option; snapping
to be shown as an option; bouncing is fine but give options; give sound
options including rising pitch.

v4 (all switches; presets V4 · SNAP · HEAVY · V3 · TODAY):
- **Coin body:** thin / thick. Thick coins have a real reeded edge (about
  half the diameter edge-on, ~5px at rest), a bevelled rim lit along the
  top and shaded underneath, and a taller sprite; stacks step by the edge.
- **Pile depth:** a hard 1px shadow line under every coin; coins with a
  coin on top are drawn darker.
- **Overlap:** free (v3) / snug (coins only touch) / snap (a coin that
  lands near another hops onto it, stacks up to six).
- **Bounces:** dead / 1 / 1–3. Landings squash for two frames.
- **Sound set:** old (production chips) / thud / clack / coin, synthesised
  in the lab (Web Audio, no assets). Group chunk folds 3+ landings within
  ~70ms into one bigger sound; rising pitch lifts each landing in a throw
  a semitone (capped at +14), including coins dropping into your bank.
- **Plates** tick up coin by coin with a punch, pot included on the sweep.
- **Calmer arcs:** handful arcs vary ±~10%, all-in ±~11%, no tossed coin.

### v5 (26 Sep 2026)

Owner on v4: "much much better… super satisfying". Preferred settings:
V4 with SNAP overlap and the CLACK sound (now the V5 default). Remaining
problems: some coins looked stretched (wider than the rest); stacked coins
sat inside each other, "clipping" or merged, in piles, the pot and the
bank; sound could be better, CLACK the favourite.

Causes and fixes:
- **Stretched coins:** the landing squash was drawn on a coin's final
  frame and never redrawn once it came to rest. The squash now plays out
  and the coin is redrawn at true size (0 stretched coins in every check).
- **Draw order:** coins were layered by y·4 + height, so a tall back stack
  could draw over a front stack. Now front-to-back first, then height.
- **A solid border:** every coin that comes to rest is pushed clear of any
  coin at the same height; a coin resting on another can hang at most ~30%
  off it; only one coin at a time can snap onto a stack top (several used
  to land on the same spot in the same frame). After a sweep or pay-out,
  whole stacks are separated as columns. Checked over 27 samples per
  preset: overlapping pairs 22 (v4: 2,166), on cards 0, off felt 0.
- **Bank:** loose clumps are placed clear of each other; the tidy rack is
  one clean row of towers (the half-hidden back row read as merged).
- **Sound:** CLACK reworked (a triangle "tock", a bright click, a small
  body; a double clack-ck onto a stack; a four-hit cascade for the group
  chunk). CLACK+ adds a heavier thud underneath. Presets: V5 · CLACK+ ·
  HEAVY · V4 · TODAY.
