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

### v6 (26 Sep 2026)

Owner on v5: the stacks went backwards (crooked, broken stacks in the
mess and when tidied): "it was better before". Only one extra sound set
wasn't enough. Throw and landing options aren't needed any more.

The regression: v5's draw order (front-to-back first) put an upper coin of
a leaning stack behind the coin it sits on, and the push-apart passes
nudged coins into crooked positions. v6:
- **Stacking is back to v4** (v4 draw order, no push-apart passes, v4's
  sweep squeeze). Kept from v5: the stretched-coin fix, and only one coin
  at a time can snap onto a stack top (no two coins in the same spot).
  The bank changes stay (clumps apart; one clean row of towers).
- **Stack options:** overlap free / snug / snap; stack style loose (v4's
  ±1px wobble) / straight (dead centre) / lean (each stack leans one way a
  pixel per coin); tidy shape spread (coins shared evenly over short
  stacks) / towers (one row of tall stacks). Tidy never builds taller than
  the room under the board.
- **Ten sound sets:** CLACK, CLACK+, CLAY (poker-chip tick), THOCK, THUD,
  COIN, CLINK (metal), RETRO (8-bit blip), POP, OLD; with group chunk and
  rising pitch.
- Throw and landing are fixed at the owner's favourites (bloom handfuls,
  uneven, gravity, 2–6 flips, edge source, 1–3 bounces, rock, rollers,
  knock-offs, juice, push sweep); the panel shows only stacks, sound, look,
  random and speed.

### v7 (26 Sep 2026)

Owner on v6: "proper amazing"; keep all ten sound sets as a player setting
in the real game. Chosen next: glints, toppling towers, shunts, the
big-moment punch, pot number overshoot, jackpot payouts, material sounds,
a payoff sting, tapping a tower to topple it; more flipping and spinning
(a flip on the bounce), more rolling; no rings on the felt; the pot gets a
tray (three styles to compare), the tray lip is a soft wall; bet numbers
to compare.

v7:
- **Flip on the bounce:** each bounce is a half or full turn, landing flat.
- **More rolling:** 20% of hard felt landings roll (was 8%), for longer;
  a coin landing on a tower sometimes rolls off it on its edge; a roller
  that hits a resting coin shunts it and falls flat.
- **Shunts:** a sliding coin hitting a resting one hands over ~85% of its
  speed (pool-ball style), so chains happen.
- **Toppling:** a hard landing next to a tower of 4+ (60% chance) makes it
  lean a beat, then spill top-first away from the hit; the base slides.
  Tapping a tower topples it away from your finger; tapping a loose coin
  flicks it; tapping empty felt (MESS·TAP) tidies.
- **Glints:** occasionally when a coin flips face-up and lands; along the
  stack tops when a tidy locks; on jackpot coins at the hatch.
- **Punch:** all-in first impacts add a 1.5% scale punch to the freeze and
  shake. **Pot overshoot:** the pot plate rolls past its value and back.
- **Jackpot:** wins of 800+ are thrown as a heave; ~30% of coins hit the
  dashboard rim first and hop into the hatch.
- **Material:** felt landings duller, coin-on-coin sharper, rail and cards
  harder and higher. **Sting:** a small rising chord in the current sound
  set's voice when a tidy locks (table or bank).
- **Table:** dotted rings removed. POT TRAY well (a dish pressed into the
  felt) / panel (printed box, gold pinstripe) / brass (raised rim) / none.
  TRAY LIP: coins sliding in the pot bounce off the rim; fast ones hop
  over. BET NUMBERS off / pop-up (only while a seat's coins land) /
  always.
- Fixed while testing: a topple timed within 70ms of a payout could take
  over coins already flying to the bank; Reduced Motion didn't route the
  jackpot rim hop. All coins now reach the bank in every configuration.

### v8 (26 Sep 2026)

Owner on v7: still not seeing coins flip like a coin toss; the all-in zoom
punch made the table border flash; the sweep glides as a pile (wants coins
jumping into the pot); the tidy noise is too frequent; the well should be
a rectangle like the brass tray.

Why no visible flip: flights last ~0.3s and did up to 3 full turns, about
3 frames per half-turn, which reads as flicker. v8:
- **Readable flips:** each flight turns an even number of half-turns
  (usually one full turn), never faster than ~0.09s per half-turn; the
  back of the coin is much darker so the turn-over reads.
- **Flip-pop:** a third of coins jump up off their first felt landing
  (~0.17s hop) and do one full, visible flip before settling.
- **No zoom punch** (freeze and shake stay).
- **Sweep JUMP (default):** each pile empties into the pot top-first,
  coin by coin (20–40ms apart), a full flip each, landing with the full
  physics. GLIDE keeps the old slide.
- **Quieter tidy:** one ratchet at the start, a click only when each
  stack's top coin lands, then lock + sting once.
- **Well** is a rounded rectangle; all tray lips are rectangular.

### v9 (26 Sep 2026)

Owner on v8: still no visible coin toss ("spin over itself, heads to
tails, heads to tails"); remove the tidy noise entirely; pot/pile coins
vanished while waiting to fly ("they move from an invisible pot"); a coin
occasionally stutters and the lab can't advance.

Bugs:
- **Invisible piles:** every coin waiting its turn was hidden, including
  coins already in a pile. Only brand-new coins (out of a seat) hide now.
  Measured during pay-you, sweep and pay-out: 0 pile coins hidden.
- **Stuck coin:** the pot tray's lip overlapped the solid pot plate, so a
  coin could be pushed out of one and back into the other every frame. The
  lip is now fitted clear of every block, pot landings aim inside it, a
  watchdog puts down any coin still moving after 3.5s, and every wait in a
  move has a time limit.
- **Tidy noise:** removed (ratchet, clicks, lock and sting).

**Coin spin:** the v7/v8 flip squashed the coin vertically, which from the
table's viewing angle reads as breathing, not spinning, and turned too
fast. v9 draws a full spin cycle by code: SIDE (about the upright axis,
the classic video-game coin narrowing to its edge) or TOSS (about the
level axis); a coin-thin reeded edge (the chunky resting thickness made a
turning coin look like a barrel); a lit heads face with slot line and a
darker tails face with a ring; LIGHT brightens the face toward the light
with a white streak at the peak. It spins continuously while airborne, at
a fixed readable rate (SLOW 2.2 / MED 3.6 / FAST 5.5 turns a second, 8 or
16 frames a turn), keeps spinning through bounces, and lands on whichever
face it was showing (or always heads). TOSS TEST throws six coins high
and slow into the pot for inspection.

### v10 (26 Sep 2026)

Owner on v9: the toss is great; settled on a mix (CLAY, TOSS spin on
SLOW, lands HEADS, WELL tray with lip, JUMP sweep, bet numbers OFF,
SNAP/LOOSE, MESS·TAP). Big pots and a big bank look silly; coins land in
the gaps between board cards and on opponents' cards; what about the turn
and river? Merging coins into bigger coins, bars and diamonds is deferred
(new sprites and animation; how it stacks is open).

- **Settled mix built in.** The drawer is cut to SOUND (all ten sets: the
  future player option), COINS per bet, and SPEED. Other options still
  read from the URL for comparison.
- **Fewer coins (COINS FEW, default).** A bet's coin count follows a
  flattening curve (10→1, 20→2, 100→4, 400→7, 1500→11, capped at 12; an
  all-in throws at least 8). The bank shows a stack-sized count (1,000→16,
  capped 28) and is topped up or trimmed at each new hand and payout.
  SOME is between; LOTS is v9's `visualChipCount`.
- **Pile limits.** A bet spot holds 14 coins, the pot 36, the bank 28.
  Coins thrown past a limit land on one of the pile's stacks and melt in
  (a stack tick, sometimes a glint); the numbers still count them.
- **Board row is one solid block**, all five card places whether dealt or
  not (measured from layout offsets, remembered for an empty board).
- **Bet spots clear of the row.** Seats beside the row bet into the strip
  between it and the rail; seats above it bet into the band under their
  cards. Snap towers are capped by the room above each spot, so a pile
  never climbs onto the seat's cards.
- **PLAY HAND:** a real hand on the lab table (game's deck, `evaluate7`,
  `compareHands`, `describeMade`): blinds, four streets, showdown with
  side pots and split pots, winners paid their share of the pot's coins.
  Opponents follow a simple lab rule of thumb (strength, pot odds, a style
  per seat), not the game's AI. The bar becomes FOLD / CHECK·CALL / RAISE
  / ALL-IN on your move. Stacks carry over; a broke seat rebuys 1,000.
  BOARD 3·4·5 lays out a flop, turn or river for testing.

Next: production integration (plan first): the throw/sweep/payout engine
and the sound-set setting into the game, driven by real game events.

### v11 (26 Sep 2026)

Owner on v10: didn't love coins flying into a pile and melting; no sound
when anyone wins; wants more coins than SOME, fewer than LOTS; start
pushing into the game (gold coins everywhere, Career included; CLAY
default).

- **MORE** (default): 20→2, 100→5, 400→12, 1,000→18, capped 24; all-in
  at least 16. Pot ~60, bank 40, spot 30.
- **No melting on the felt:** a bet throws only what its spot and the pot
  still have room for (at least one coin), so every pile sweeps in whole.
  Only a big win pours its extra coins into the hatch (a real opening).
  An all-in with no room for the whole bank drops the rest back through
  the bank floor.
- **Win sounds** in the set's own voice: a rising run (yours bigger, ending
  on a chord), the pot scraping across, the hatch clunk. They had been
  routed to the old engine, which the lab never woke.

## Production integration

Presentation only: `game` state, pot building, awards and Career money
stay exactly as they are. Each step ships playable and tested.

What production does today (read 26 Sep 2026): `applyAction()` flies
chips straight from the bank (`#hud-tower`, `bankPile()`) or a seat into
the pot pile (`#pot-stacks`, `potPile()`) via `transferChips`/`flyChip`;
blinds post instantly (`postBlind`); `advancePhase()` just zeroes
`betThisRound` (its comment notes the resting pile to sweep was removed).
Payout is `runShowdownAwardSequence()` (shared by `handleShowdown` and
`handleFoldWin`): showdown rail, AWARD POT button, then `payoutTo()` per
winner; a human win in a reward-bearing mode runs
`runHumanPotSmashCeremony()` instead (reward breakdown, score plate slam,
`runPotBreakPhysics` bursting the real pot chips and attracting them
through the hatch, then `rebuildBankPileFromState`). Piles bootstrap from
state in `renderBank`/`renderPot` (cold load, rebuy, resume) and
`table-intro.js` loads the bank through the hatch.

1. **Coin engine as its own file** — DONE. `js/coin-world.js` +
   `css/coin-world.css`, loaded by `index.html` and precached by `sw.js`,
   unused by the game. The lab now runs on it (one copy of the engine).
2. **Bets and the sweep.** A table adapter in the game builds the walls,
   bet spots and pot tray from the live table, throws every bet (blinds
   included) onto the player's spot from `applyAction`/`postBlind`, and
   sweeps the spots into the tray from `advancePhase`, `handleFoldWin`
   and `handleShowdown` (awaited, before the next street is dealt or the
   award). The old pot pile is retired for the tray; the pot plate keeps
   reading `game.pot`. Coin counts: MORE curves and limits. Reduced
   Motion: coins snap to where they end. `cancelAllChipFlights` and the
   between-hand clear empty the world.
3. **Payouts.** `payoutTo()` for opponents: coins to the winner's spot,
   then home to the seat. Your wins: through the hatch; inside the pot
   smash ceremony, the coins burst and are drawn into the hatch by the
   coin world instead of `runPotBreakPhysics`'s chip DOM, keeping the
   ceremony's order and timing (breakdown → plate slam → burst → bank →
   money reveal). Split and side pots share the tray's coins by amount.
4. **Your bank.** The coin rack (bank limit 40) replaces the chip-disc
   pile: `renderBank`, `rebuildBankPileFromState`, `postBlind`'s trim,
   Career resume and the table intro's hatch load all go through it.
5. **Settings.** The ten sound sets as a player option (default CLAY),
   saved with the existing settings without disturbing any stored value;
   the old chip sounds remain as OLD.

Validation grows with each step (a coin-world suite: counts, limits,
walls, sweep totals, no coin left on a card); `chip-motion-checks.js` is
updated where it asserts the old pile behaviour.

## Status after release (v0.40.4, 26 Sep 2026)

Integration steps 1–5 are live on `main` (#18, freeze fix #19). The
owner played it on the phone: the coin animations "look great … a big
success". `COIN_TABLE_ON=false` in `js/coin-table.js` restores the old
chips.

Lesson from #19: every file a release changes must carry a new `?v=`
query in `index.html` and `sw.js`. GitHub Pages lets phones cache files
for ~10 minutes, and a mix of old and new files froze the table on entry.

## Next: a table spacing pass (owner, 26 Sep 2026)

The coins (bet spots, the pot tray) added objects to a table that was
laid out without them, and things now pile up on each other. The owner
wants a whole-screen spacing review that frees room without hurting
player UX. They also propose **scrapping the XP / score award and the
SCORE bar** at the top of run mode: the pot smash's XP slam no longer
reads as the payoff now the coins do the work. That is a product
decision to confirm and plan (it touches `04-modes-and-scoring.js`'s
reward system, the pot smash ceremony and `SCORING_SPEC.md`) before any
code.

Seen in the owner's phone screenshots (3-handed run, Dashboard V2):
- Opponent bet piles sit on or just under the seat's hole cards. With
  two seats side by side, the spot ends up hard against the cards; a
  lone blind coin can rest on a seat card.
- The pot pile's towers climb onto the bottom of the board row (turn and
  river especially); the tray sits close under the board.
- The SCORE bar takes a full row at the top of the screen.
- Your own spot (bottom right of the felt) reads as a stray coin in empty
  felt.
- (Fixed in v0.40.5) the bank rack drifted from the stack: bets took coins
  by bet size and nothing topped it back up, so it could show fewer coins
  at $320 than at $268. Your bets now throw the coins the stack no longer
  earns, and the rack re-matches the stack at every new hand.

Spot placement lives in `layout()` in `js/coin-table.js` (the same rules as
the lab's `buildTable`). Tower heights are capped by `zone.room`; the tray
is a fixed 200×58 well above the pot plate.
